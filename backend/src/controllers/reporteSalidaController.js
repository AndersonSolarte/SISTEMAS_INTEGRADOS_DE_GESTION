const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { Documento, PlanAccion, ReporteSalidaSolicitud, RecursoHumanoAdministrativo, User, UserModulePermission } = require('../models');
const { encryptPayload, decryptPayload } = require('../utils/secureUrlToken');
const {
  getReporteSalidaRecipients,
  getReporteSalidaFeatureState,
  isReporteSalidaDocumento,
  isReporteSalidaEnabled,
  setReporteSalidaFeatureState
} = require('../config/reporteSalidaConfig');
const { ensureReporteSalidaDocx, ensureReporteSalidaPdf, formatMinutes } = require('../services/reporteSalidaPdfService');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const { ROLES } = require('../constants/roles');

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const publicBackendUrl = process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL || frontendUrl;

const featureDisabled = (res) =>
  res.status(403).json({ success: false, message: 'El formulario de reporte de salida aun no esta habilitado.' });

const isAdminUser = (user) => String(user?.role || '') === 'administrador';
const SEGUIMIENTO_REPORTE_ROLES = [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA];
const REPOSICION_PENDIENTE_ESTADOS = ['pendiente', 'programada', 'incumplida'];

const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

const sanitizeText = (value, max = 250) => String(value || '').trim().slice(0, max);

const cleanDependenciaLabel = (value) =>
  sanitizeText(value, 400)
    .replace(/^[A-Z]{0,3}\d+[_\-\s]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasDependenciaCode = (value) => /^[A-Z]{0,3}\d+[_\-\s]+/i.test(sanitizeText(value, 400));

const looksLikeInstitutionalDependencia = (value) => {
  const text = cleanDependenciaLabel(value).toLowerCase();
  if (!text || text.length < 4) return false;
  if (/\b(acta|actas|revision|revisión|micro|curriculo|currículo|actividad|actividades|indicador|indicadores|meta|metas|proyecto|programacion|programación)\b/i.test(text)) {
    return false;
  }
  return /\b(departamento|vicerrectoria|vicerrectoría|direccion|dirección|oficina|facultad|programa|centro|unidad|rectoria|rectoría|biblioteca|bienestar|juridica|jurídica|finanzas|admisiones|registro|planeacion|planeación|aseguramiento|talento|gestion humana|gestión humana)\b/i.test(text);
};

const isDependenciaOption = (value) => hasDependenciaCode(value) || looksLikeInstitutionalDependencia(value);

const normalizeForMatch = (val) => String(val || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/gi, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const normalizeDocument = (value) => String(value || '').replace(/\D/g, '');

const tokenizeName = (value) => normalizeForMatch(value)
  .split(/\s+/)
  .map((token) => token.trim())
  .filter((token) => token.length >= 3);
const namesLookRelated = (left, right) => {
  const leftText = normalizeForMatch(left);
  const rightText = normalizeForMatch(right);
  if (!leftText || !rightText) return false;
  if (leftText === rightText) return true;

  const escapeRegExp = (str) => String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regexRight = new RegExp(`\\b${escapeRegExp(rightText)}\\b`, 'i');
  const regexLeft = new RegExp(`\\b${escapeRegExp(leftText)}\\b`, 'i');
  if (regexRight.test(leftText) || regexLeft.test(rightText)) return true;

  const leftTokenList = tokenizeName(leftText);
  const rightTokens = tokenizeName(rightText);
  if (!leftTokenList.length || !rightTokens.length) return false;

  const leftTokens = new Set(leftTokenList);
  const matches = rightTokens.filter((token) => leftTokens.has(token)).length;
  return matches >= Math.min(2, rightTokens.length);
};


const JEFE_CARGO_KEYWORDS = [
  'asesor',
  'asesora',
  'auditor',
  'auditora interna',
  'decana',
  'decano',
  'director',
  'directora',
  'gerente',
  'jefe',
  'vicerrector',
  'rector'
];

const isJefeCargo = (value) => {
  const cargo = normalizeForMatch(value);
  if (!cargo) return false;
  return JEFE_CARGO_KEYWORDS.some((keyword) => cargo.includes(keyword));
};

const getLatestAdministrativoYear = async () => {
  const latest = await RecursoHumanoAdministrativo.findOne({
    where: { anio: { [Op.ne]: null } },
    attributes: ['anio'],
    order: [['anio', 'DESC']],
    raw: true
  });
  return latest?.anio || null;
};

const getPeriodRank = (value) => {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!raw) return 0;
  if (raw.includes('IIP') || /\bII\b/.test(raw) || /\bSEGUNDO\b/.test(raw) || /\b2\b/.test(raw)) return 2;
  if (raw.includes('IP') || /\bI\b/.test(raw) || /\bPRIMER\b/.test(raw) || /\b1\b/.test(raw)) return 1;
  return 0;
};

const getPeriodLabel = (rank) => {
  if (rank === 2) return 'IIP';
  if (rank === 1) return 'IP';
  return '';
};

const getLatestAdministrativos = async () => {
  const latestYear = await getLatestAdministrativoYear();
  if (!latestYear) return { latestYear: null, latestPeriod: '', rows: [] };

  const yearRows = await RecursoHumanoAdministrativo.findAll({
    where: { anio: latestYear },
    attributes: ['anio', 'periodo', 'numero_cedula', 'nombre_empleado', 'cargo_especifico', 'dependencia', 'estado_laboral', 'raw_data'],
    order: [
      ['periodo', 'DESC'],
      ['dependencia', 'ASC'],
      ['nombre_empleado', 'ASC']
    ],
    raw: true
  });

  const latestPeriodRank = Math.max(0, ...yearRows.map((row) => getPeriodRank(row.periodo)));
  const rows = latestPeriodRank > 0
    ? yearRows.filter((row) => getPeriodRank(row.periodo) === latestPeriodRank)
    : yearRows;

  return { latestYear, latestPeriod: getPeriodLabel(latestPeriodRank), rows };
};

const uniqueSortedValues = (values) => {
  const seen = new Set();
  return values
    .map((value) => sanitizeText(value, 400))
    .filter(Boolean)
    .filter((value) => {
      const key = normalizeForMatch(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => a.localeCompare(b, 'es'));
};

const serializeLaboralRow = (row) => ({
  dependencia: cleanDependenciaLabel(row.dependencia),
  cargo: sanitizeText(row.cargo_especifico, 220),
  nombre: sanitizeText(row.nombre_empleado, 220),
  documento: sanitizeText(row.numero_cedula, 80),
  anio: row.anio,
  periodo: sanitizeText(row.periodo, 40)
});

const findCurrentAdministrativeRow = (rows, user) => {
  const userDoc = normalizeDocument(user?.username);
  const userName = normalizeForMatch(user?.nombre);
  if (userDoc) {
    const byDoc = rows.find((row) => normalizeDocument(row.numero_cedula) === userDoc);
    if (byDoc) return byDoc;
  }
  if (userName) {
    return rows.find((row) => normalizeForMatch(row.nombre_empleado) === userName) || null;
  }
  return null;
};

const getRawDataValue = (rawData, keys = []) => {
  if (!rawData || typeof rawData !== 'object') return '';
  const normalizedKeys = keys.map((key) => normalizeForMatch(key));
  const entry = Object.entries(rawData).find(([key]) => {
    const normalizedKey = normalizeForMatch(key);
    return normalizedKeys.some((expected) =>
      normalizedKey === expected ||
      normalizedKey.includes(expected) ||
      expected.includes(normalizedKey)
    );
  });
  return entry ? sanitizeText(entry[1], 220) : '';
};

const getAdministrativeEmail = (row) => {
  const direct = getRawDataValue(row.raw_data, [
    'correo',
    'correo electronico',
    'correo electrónico',
    'correo institucional',
    'email',
    'email institucional',
    'e-mail',
    'mail'
  ]);
  if (direct && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(direct)) return direct;
  return '';
};

const mapAdministrativeBosses = async (rows, search = '') => {
  const bossRows = rows.filter((row) => isJefeCargo(row.cargo_especifico));
  if (!bossRows.length) return [];

  const users = await User.findAll({
    where: { estado: 'activo' },
    attributes: ['id', 'nombre', 'email', 'username', 'role'],
    order: [['nombre', 'ASC']],
    raw: true
  });

  const term = normalizeForMatch(search);
  const seen = new Set();
  return bossRows
    .map((row, index) => {
      const doc = normalizeDocument(row.numero_cedula);
      const user = users.find((candidate) =>
        (doc && normalizeDocument(candidate.username) === doc) ||
        namesLookRelated(candidate.nombre, row.nombre_empleado)
      );
      const rawEmail = getAdministrativeEmail(row);
      return {
        id: user?.id ? `user:${user.id}` : `rh:${doc || normalizeForMatch(row.nombre_empleado) || index}`,
        userId: user?.id || null,
        nombre: sanitizeText(row.nombre_empleado, 220),
        email: rawEmail || user?.email || '',
        username: sanitizeText(row.numero_cedula, 80),
        cargo: sanitizeText(row.cargo_especifico, 220),
        dependencia: cleanDependenciaLabel(row.dependencia),
        anio: row.anio,
        periodo: sanitizeText(row.periodo, 40),
        source: 'recurso_humano_administrativos'
      };
    })
    .filter(Boolean)
    .filter((boss) => {
      const key = normalizeDocument(boss.username) || `${normalizeForMatch(boss.nombre)}|${normalizeForMatch(boss.cargo)}|${normalizeForMatch(boss.dependencia)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .filter((boss) => {
      if (!term) return true;
      return [boss.nombre, boss.email, boss.username, boss.cargo, boss.dependencia]
        .some((value) => normalizeForMatch(value).includes(term));
    })
    .slice(0, 80);
};

const serializeUserLaboralRow = (user) => ({
  dependencia: cleanDependenciaLabel(user.dependencia),
  cargo: sanitizeText(user.cargo, 220),
  jefe_inmediato: sanitizeText(user.jefe_inmediato, 220),
  nombre: sanitizeText(user.nombre, 220),
  documento: sanitizeText(user.username, 80),
  email: sanitizeText(user.email, 220),
  userId: user.id,
  source: 'users'
});

const getUserProfileLaboralRows = async () => {
  return User.findAll({
    where: { estado: 'activo' },
    attributes: ['id', 'nombre', 'email', 'username', 'role', 'dependencia', 'cargo', 'jefe_inmediato'],
    order: [['dependencia', 'ASC'], ['cargo', 'ASC'], ['nombre', 'ASC']],
    raw: true
  });
};

const findCurrentUserProfileRow = (rows, user) => {
  const userId = Number(user?.id || 0);
  const userDoc = normalizeDocument(user?.username);
  const userEmail = normalizeForMatch(user?.email);
  return rows.find((row) =>
    (userId && Number(row.id) === userId) ||
    (userDoc && normalizeDocument(row.username) === userDoc) ||
    (userEmail && normalizeForMatch(row.email) === userEmail)
  ) || null;
};

const mapUserProfileBosses = (rows, search = '') => {
  const term = normalizeForMatch(search);
  const seen = new Set();
  const bosses = [];

  const pushBoss = (boss) => {
    const key = normalizeForMatch(boss.nombre) || normalizeDocument(boss.username) || String(boss.id || '');
    if (!key || seen.has(key)) return;
    seen.add(key);
    bosses.push(boss);
  };

  rows.forEach((row, index) => {
    const jefeNombre = sanitizeText(row.jefe_inmediato, 220);
    if (!jefeNombre) return;
    const matchedUser = rows.find((candidate) =>
      normalizeForMatch(candidate.nombre) === normalizeForMatch(jefeNombre) ||
      normalizeForMatch(candidate.cargo) === normalizeForMatch(jefeNombre) ||
      namesLookRelated(candidate.nombre, jefeNombre) ||
      namesLookRelated(candidate.cargo, jefeNombre)
    );
    pushBoss({
      id: matchedUser?.id ? `user:${matchedUser.id}` : `profile-jefe:${normalizeForMatch(jefeNombre) || index}`,
      userId: matchedUser?.id || null,
      nombre: matchedUser?.nombre || jefeNombre,
      email: matchedUser?.email || '',
      username: matchedUser?.username || '',
      cargo: matchedUser?.cargo || '',
      dependencia: matchedUser?.dependencia || '',
      jefe_inmediato: jefeNombre,
      source: 'users'
    });
  });

  rows
    .filter((row) => isJefeCargo(row.cargo))
    .forEach((row) => {
      pushBoss({
        id: `user:${row.id}`,
        userId: row.id,
        nombre: row.nombre,
        email: row.email || '',
        username: row.username || '',
        cargo: row.cargo || '',
        dependencia: row.dependencia || '',
        jefe_inmediato: row.nombre || '',
        source: 'users'
      });
    });

  return bosses
    .filter((boss) => {
      if (!term) return true;
      return [boss.nombre, boss.email, boss.username, boss.cargo, boss.dependencia]
        .some((value) => normalizeForMatch(value).includes(term));
    })
    .sort((a, b) => String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es'))
    .slice(0, 120);
};

const WORK_BLOCKS = [
  { start: '07:00', end: '12:00' },
  { start: '14:00', end: '18:00' }
];

const parseDateOnly = (date) => {
  if (!date) return null;
  const parsed = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const timeToMinutes = (time) => {
  const [hours, minutes] = String(time || '').split(':').map(Number);
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return hours * 60 + minutes;
};

const toIsoDate = (date) => date.toISOString().slice(0, 10);

const isBusinessDay = (date) => {
  const day = date.getDay();
  return day >= 1 && day <= 5 && !isColombiaHoliday(date);
};

const addDays = (date, days) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};

const nextMonday = (date) => {
  const next = new Date(date);
  const diff = (8 - next.getDay()) % 7;
  next.setDate(next.getDate() + diff);
  return next;
};

const getEasterDate = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31) - 1;
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month, day);
};

const getColombiaHolidaySet = (year) => {
  const dates = new Set();
  const addFixed = (month, day) => dates.add(toIsoDate(new Date(year, month - 1, day)));
  const addMoved = (month, day) => dates.add(toIsoDate(nextMonday(new Date(year, month - 1, day))));
  addFixed(1, 1);
  addFixed(5, 1);
  addFixed(7, 20);
  addFixed(8, 7);
  addFixed(12, 8);
  addFixed(12, 25);
  addMoved(1, 6);
  addMoved(3, 19);
  addMoved(6, 29);
  addMoved(8, 15);
  addMoved(10, 12);
  addMoved(11, 1);
  addMoved(11, 11);
  const easter = getEasterDate(year);
  [-3, -2, 43, 64, 71].forEach((offset) => dates.add(toIsoDate(addDays(easter, offset))));
  return dates;
};

const holidayCache = new Map();

const isColombiaHoliday = (date) => {
  const year = date.getFullYear();
  if (!holidayCache.has(year)) holidayCache.set(year, getColombiaHolidaySet(year));
  return holidayCache.get(year).has(toIsoDate(date));
};

const diffBusinessMinutes = (startDate, endDate, startTime, endTime) => {
  const fromDate = parseDateOnly(startDate);
  const toDate = parseDateOnly(endDate || startDate);
  const fromMinutes = timeToMinutes(startTime);
  const toMinutesValue = timeToMinutes(endTime);
  if (!fromDate || !toDate || fromMinutes == null || toMinutesValue == null || toDate < fromDate) return null;

  if (toIsoDate(fromDate) === toIsoDate(toDate) && toMinutesValue <= fromMinutes) return null;

  let total = 0;
  const cursor = new Date(fromDate);
  while (cursor <= toDate) {
    if (isBusinessDay(cursor)) {
      const current = toIsoDate(cursor);
      const rangeStart = current === toIsoDate(fromDate) ? fromMinutes : 0;
      const rangeEnd = current === toIsoDate(toDate) ? toMinutesValue : 24 * 60;
      WORK_BLOCKS.forEach((block) => {
        const blockStart = timeToMinutes(block.start);
        const blockEnd = timeToMinutes(block.end);
        total += Math.max(0, Math.min(rangeEnd, blockEnd) - Math.max(rangeStart, blockStart));
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return total > 0 ? total : null;
};

const diffElapsedMinutes = (startDate, endDate, startTime, endTime) => {
  const fromDate = parseDateOnly(startDate);
  const toDate = parseDateOnly(endDate || startDate);
  const fromMinutes = timeToMinutes(startTime);
  const toMinutesValue = timeToMinutes(endTime);
  if (!fromDate || !toDate || fromMinutes == null || toMinutesValue == null || toDate < fromDate) return null;
  const from = new Date(fromDate);
  from.setMinutes(fromMinutes);
  const to = new Date(toDate);
  to.setMinutes(toMinutesValue);
  if (to <= from) return null;
  return Math.round((to.getTime() - from.getTime()) / 60000);
};

const buildSnapshot = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  username: user.username,
  role: user.role,
  dependencia: cleanDependenciaLabel(user.dependencia),
  cargo: sanitizeText(user.cargo, 220),
  jefe_inmediato: sanitizeText(user.jefe_inmediato, 220)
});

const buildAdministrativeBossSnapshot = (boss = {}) => ({
  id: boss.userId || null,
  nombre: sanitizeText(boss.nombre, 220),
  email: sanitizeText(boss.email, 220),
  username: sanitizeText(boss.username, 80),
  role: sanitizeText(boss.source, 80) || 'recurso_humano_administrativos',
  cargo: sanitizeText(boss.cargo, 220),
  dependencia: cleanDependenciaLabel(boss.dependencia),
  jefe_inmediato: sanitizeText(boss.jefe_inmediato || boss.nombre, 220),
  source: sanitizeText(boss.source, 80) || 'recurso_humano_administrativos'
});

const appendTrace = (solicitud, event, actor = null, detail = {}) => ([
  ...(Array.isArray(solicitud.trazabilidad) ? solicitud.trazabilidad : []),
  {
    event,
    actor: actor ? buildSnapshot(actor) : null,
    detail,
    at: new Date().toISOString()
  }
]);

const canManageSeguimientoReportes = async (user) => {
  if (!user) return false;
  if (SEGUIMIENTO_REPORTE_ROLES.includes(String(user.role || ''))) return true;
  if (!UserModulePermission) return false;
  const count = await UserModulePermission.count({
    where: {
      user_id: user.id,
      can_view: true,
      module_key: 'seguimiento_reportes_rrhh'
    }
  });
  return count > 0;
};

const pendingReposicionWhere = () => ({
  estado: 'finalizada',
  reposicion_aplica: true,
  reposicion_estado: { [Op.in]: REPOSICION_PENDIENTE_ESTADOS }
});

const bossScopeWhere = (user) => {
  const conditions = [{ jefe_inmediato_user_id: user.id }];
  const email = sanitizeText(user.email, 180);
  if (email) conditions.push({ jefe_snapshot: { [Op.contains]: { email } } });
  return { [Op.or]: conditions };
};

const ownPendingReposicionWhere = (user) => ({
  ...pendingReposicionWhere(),
  user_id: user.id
});

const bossPendingReposicionWhere = (user) => ({
  ...pendingReposicionWhere(),
  ...bossScopeWhere(user)
});

const resolveSeguimientoAccess = async (user) => {
  const canManageAll = await canManageSeguimientoReportes(user);
  const [ownPending, bossPending] = await Promise.all([
    ReporteSalidaSolicitud.count({ where: ownPendingReposicionWhere(user) }),
    ReporteSalidaSolicitud.count({ where: bossPendingReposicionWhere(user) })
  ]);

  let mode = 'sin_pendientes';
  if (canManageAll) mode = 'gestion_humana';
  else if (bossPending > 0) mode = ownPending > 0 ? 'jefe_y_colaborador' : 'jefe';
  else if (ownPending > 0) mode = 'colaborador';

  return {
    canView: canManageAll || ownPending > 0 || bossPending > 0,
    canManageAll,
    canValidateReposicion: canManageAll,
    canManageTeamReposicion: bossPending > 0,
    mode,
    counts: { ownPending, bossPending }
  };
};

const renderApprovalPage = ({
  res,
  status = 200,
  tone = 'success',
  title,
  message,
  solicitud = null,
  nextStep = '',
  actionLabel = 'Ir al sistema',
  actionUrl = frontendUrl
}) => {
  const tones = {
    success: { bg: '#ecfdf5', border: '#86efac', color: '#047857', icon: '&#10003;' },
    info: { bg: '#eff6ff', border: '#93c5fd', color: '#1d4ed8', icon: 'i' },
    warning: { bg: '#fffbeb', border: '#fcd34d', color: '#b45309', icon: '!' },
    error: { bg: '#fef2f2', border: '#fca5a5', color: '#b91c1c', icon: '!' }
  };
  const theme = tones[tone] || tones.info;
  const consecutivo = solicitud?.consecutivo || '';
  const solicitante = solicitud?.solicitante_snapshot?.nombre || '';
  const estado = solicitud?.estado || '';
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeNextStep = escapeHtml(nextStep);
  const safeConsecutivo = escapeHtml(consecutivo);
  const safeSolicitante = escapeHtml(solicitante);
  const safeEstado = escapeHtml(estado.replace(/_/g, ' '));
  const safeActionUrl = escapeHtml(actionUrl);
  const safeActionLabel = escapeHtml(actionLabel);

  return res.status(status).type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/png" href="${frontendUrl}/Logo%20Universidad%20CESMAG.png" />
  <title>${safeTitle} | SIAC UNICESMAG</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #dbe6f5;
      --brand: #2457e6;
      --navy: #0b1730;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 20% 0%, rgba(36, 87, 230, 0.16), transparent 32%),
        linear-gradient(135deg, #f8fbff 0%, #eef4ff 48%, #f7fbff 100%);
      color: var(--ink);
      display: grid;
      place-items: center;
      padding: 28px;
    }
    .shell {
      width: min(760px, 100%);
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
      overflow: hidden;
    }
    .top {
      padding: 22px 26px;
      background: linear-gradient(90deg, #0b1730, #123a7a);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brandmark {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.13);
      border: 1px solid rgba(255, 255, 255, 0.24);
      display: grid;
      place-items: center;
      font-weight: 900;
      letter-spacing: .08em;
    }
    .brand-title { font-weight: 900; font-size: 18px; line-height: 1.15; }
    .brand-subtitle { margin-top: 3px; color: #bfdbfe; font-size: 13px; }
    .content { padding: 30px; }
    .status {
      display: flex;
      gap: 18px;
      align-items: flex-start;
    }
    .icon {
      flex: 0 0 auto;
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: ${theme.bg};
      border: 1px solid ${theme.border};
      color: ${theme.color};
      display: grid;
      place-items: center;
      font-size: 28px;
      font-weight: 950;
    }
    h1 {
      margin: 0;
      font-size: clamp(24px, 4vw, 34px);
      line-height: 1.08;
      letter-spacing: 0;
    }
    .message {
      margin: 10px 0 0;
      color: #334155;
      font-size: 16px;
      line-height: 1.6;
    }
    .details {
      margin-top: 26px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: #f8fbff;
    }
    .detail {
      padding: 16px;
      border-right: 1px solid var(--line);
      min-width: 0;
    }
    .detail:last-child { border-right: 0; }
    .label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 900;
      letter-spacing: .06em;
    }
    .value {
      margin-top: 7px;
      font-weight: 850;
      color: #0f172a;
      overflow-wrap: anywhere;
    }
    .note {
      margin-top: 22px;
      padding: 15px 16px;
      border-radius: 14px;
      background: ${theme.bg};
      border: 1px solid ${theme.border};
      color: #334155;
      line-height: 1.5;
    }
    .actions {
      margin-top: 26px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    a, button {
      border: 0;
      border-radius: 12px;
      padding: 12px 18px;
      font-weight: 850;
      text-decoration: none;
      cursor: pointer;
      font-size: 14px;
      font-family: inherit;
    }
    .primary {
      background: var(--brand);
      color: #fff;
      box-shadow: 0 10px 22px rgba(36, 87, 230, .24);
    }
    .ghost {
      background: #eef4ff;
      color: #1d4ed8;
    }
    @media (max-width: 640px) {
      body { padding: 14px; }
      .top, .content { padding: 20px; }
      .status { flex-direction: column; }
      .details { grid-template-columns: 1fr; }
      .detail { border-right: 0; border-bottom: 1px solid var(--line); }
      .detail:last-child { border-bottom: 0; }
      .actions { justify-content: stretch; }
      a, button { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div class="brandmark">SIAC</div>
      <div>
        <div class="brand-title">UNICESMAG</div>
        <div class="brand-subtitle">Reporte de salida | Gestion Humana</div>
      </div>
    </section>
    <section class="content">
      <div class="status">
        <div class="icon">${theme.icon}</div>
        <div>
          <h1>${safeTitle}</h1>
          <p class="message">${safeMessage}</p>
        </div>
      </div>
      ${solicitud ? `<div class="details">
        <div class="detail"><div class="label">Solicitud</div><div class="value">${safeConsecutivo}</div></div>
        <div class="detail"><div class="label">Colaborador</div><div class="value">${safeSolicitante || 'No disponible'}</div></div>
        <div class="detail"><div class="label">Estado</div><div class="value">${safeEstado || 'No disponible'}</div></div>
      </div>` : ''}
      ${safeNextStep ? `<div class="note">${safeNextStep}</div>` : ''}
      <div class="actions">
        <button class="primary" type="button" onclick="window.close();">Cerrar ventana</button>
      </div>
    </section>
  </main>
</body>
</html>`);
};

const validateRadicacionPayload = (payload, user) => {
  const personal = payload?.personal || {};
  const salida = payload?.salida || {};
  const reposicion = payload?.reposicion || {};
  const laboral = payload?.laboral || {};

  const documentoDigitado = sanitizeText(personal.documento || user.username, 40);
  if (String(documentoDigitado) !== String(user.username || '')) {
    return 'La solicitud solo puede radicarse para el usuario autenticado.';
  }

  if (!payload?.documentoId) return 'Documento del formato requerido.';
  if (!payload?.jefeInmediatoUserId && !payload?.jefeInmediato?.email) {
    return 'Debe seleccionar un jefe inmediato con correo registrado en Recurso Humano.';
  }
  if (!salida.tipo) return 'Debe seleccionar el tipo de salida.';
  if (salida.tipo === 'otra' || (String(salida.tipo).startsWith('otra:') && String(salida.tipo).substring(5).trim() === '')) {
    return 'Debe especificar el motivo para la opcion "Otra, ¿Cual?".';
  }
  if (salida.tipo === 'terapias') {
    if (!salida.terapiasList || salida.terapiasList.length === 0) return 'Debe indicar al menos una terapia y completarla.';
    for (let i = 0; i < salida.terapiasList.length; i++) {
      const t = salida.terapiasList[i];
      if (!t.fecha || !t.horaInicio || !t.horaFin) return `Complete fecha, hora inicio y hora fin para la terapia #${i + 1}.`;
    }
  } else {
    if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio || !salida.horaFin) return 'Debe indicar fecha de salida, hora de salida, fecha de regreso y hora de regreso.';
  }

  let requestedMinutes = 0;
  if (salida.tipo === 'terapias') {
    requestedMinutes = (salida.terapiasList || []).reduce((acc, t) => acc + (diffBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0), 0);
  } else {
    requestedMinutes = diffBusinessMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin);
  }
  if (!requestedMinutes) return 'El rango de salida no contiene tiempo laboral valido segun la jornada lunes a viernes, sin festivos de Colombia, de 7:00 a 12:00 y de 14:00 a 18:00.';

  if (salida.tipo === 'diligencia_personal') {
    const hasReposicionPlan = Boolean(reposicion.fecha || reposicion.fechaFin || reposicion.horaInicio || reposicion.horaFin);
    if (hasReposicionPlan && (!reposicion.fecha || !reposicion.fechaFin || !reposicion.horaInicio || !reposicion.horaFin)) {
      return 'Complete todos los campos del plan inicial de reposicion o dejelos vacios para gestionarlo luego en seguimiento.';
    }
    if (hasReposicionPlan) {
      const replacementMinutes = diffElapsedMinutes(reposicion.fecha, reposicion.fechaFin, reposicion.horaInicio, reposicion.horaFin);
      if (!replacementMinutes) return 'El rango del plan inicial de reposicion no es valido. Revise fecha y hora de inicio y fin.';
    }
  }

  if (!laboral.dependencia || !laboral.cargo) return 'Dependencia y cargo son obligatorios.';
  return null;
};

const serializeSolicitud = (solicitud) => {
  const row = typeof solicitud.toJSON === 'function' ? solicitud.toJSON() : solicitud;
  return {
    ...row,
    tiempoSolicitadoLabel: formatMinutes(row.tiempo_solicitado_minutos),
    reposicionLabel: formatMinutes(row.reposicion_minutos),
    solicitante: row.solicitante_snapshot,
    jefe: row.jefe_snapshot
  };
};

const buildReporteSalidaAttachments = async (solicitud) => {
  const docx = await ensureReporteSalidaDocx(solicitud);
  const pdf = await ensureReporteSalidaPdf(solicitud, docx);
  const attachments = [pdf];
  
  const adjuntoPath = solicitud.datos_formulario?.adjunto_path;
  if (adjuntoPath) {
    const fullPath = path.join(__dirname, '../../uploads/adjuntos_reporte', adjuntoPath);
    if (fs.existsSync(fullPath)) {
      attachments.push({
        filename: `Soporte_Medico_${solicitud.consecutivo}${path.extname(adjuntoPath)}`,
        path: fullPath
      });
    }
  }
  
  return attachments;
};

const buildTerapiasHtml = (solicitud) => {
  const salida = solicitud.datos_formulario?.salida;
  if (salida?.tipo !== 'terapias' || !salida?.terapiasList?.length) return '';
  const rows = salida.terapiasList.map((t, idx) => `<tr><td style="padding:4px;border:1px solid #ddd;text-align:center;">Terapia ${idx + 1}</td><td style="padding:4px;border:1px solid #ddd;text-align:center;">${escapeHtml(t.fecha)}</td><td style="padding:4px;border:1px solid #ddd;text-align:center;">${escapeHtml(t.horaInicio)} - ${escapeHtml(t.horaFin)}</td></tr>`).join('');
  return `<div style="margin: 15px 0;"><strong>Detalle de terapias:</strong><table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;"><thead><tr><th style="text-align:center;padding:4px;border:1px solid #ddd;background:#f3f4f6;">#</th><th style="text-align:center;padding:4px;border:1px solid #ddd;background:#f3f4f6;">Fecha</th><th style="text-align:center;padding:4px;border:1px solid #ddd;background:#f3f4f6;">Horario</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

const sendJefeApprovalEmail = async (solicitud, token, attachments) => {
  const jefe = solicitud.jefe_snapshot || {};
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  const subject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Aprobacion jefe inmediato`;
  const html = renderInstitutionalTemplate({
    title: 'Solicitud de aprobacion de reporte de salida',
    introHtml: `<p>Cordial saludo, <strong>${escapeHtml(jefe.nombre)}</strong>.</p><p>El colaborador <strong>${escapeHtml(solicitante.nombre)}</strong> radico una solicitud de reporte de salida.</p>`,
    bodyHtml: `
      <p><strong>Solicitud:</strong> ${escapeHtml(solicitud.consecutivo)}</p>
      <p><strong>Tiempo solicitado:</strong> ${escapeHtml(formatMinutes(solicitud.tiempo_solicitado_minutos))}</p>
      ${buildTerapiasHtml(solicitud)}
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">Aprobar salida</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">No aprobar</a>
      </div>
      <p>Si decide no aprobar la solicitud, haga clic en el botón "No aprobar" para ingresar el motivo de su decisión.</p>
    `
  });
  return sendInstitutionalEmail({
    to: jefe.email,
    subject,
    text: `Solicitud ${solicitud.consecutivo}. Para aprobar ingrese a ${approveUrl}. Para rechazar ingrese a ${rejectUrl}.`,
    html,
    attachments
  });
};

const sendGestionHumanaApprovalEmail = async (solicitud, token, attachments) => {
  const recipients = getReporteSalidaRecipients();
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  const subject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Aprobacion Gestion Humana`;
  const html = renderInstitutionalTemplate({
    title: 'Aprobacion pendiente de Gestion Humana',
    introHtml: `<p>La solicitud <strong>${escapeHtml(solicitud.consecutivo)}</strong> fue aprobada por el jefe inmediato.</p>`,
    bodyHtml: `
      <p><strong>Colaborador:</strong> ${escapeHtml(solicitante.nombre)}</p>
      <p><strong>Tiempo solicitado:</strong> ${escapeHtml(formatMinutes(solicitud.tiempo_solicitado_minutos))}</p>
      ${buildTerapiasHtml(solicitud)}
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">Aprobar Gestion Humana</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">No aprobar</a>
      </div>
      <p>Si decide no aprobar la solicitud, haga clic en el botón "No aprobar" para ingresar el motivo de su decisión.</p>
    `
  });
  return sendInstitutionalEmail({
    to: recipients.gestionHumana,
    subject,
    text: `Solicitud ${solicitud.consecutivo} aprobada por jefe. Para finalizar ingrese a ${approveUrl}. Para rechazar ingrese a ${rejectUrl}.`,
    html,
    attachments
  });
};

const sendFinalEmails = async (solicitud, attachments) => {
  const recipients = getReporteSalidaRecipients();
  const subject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Solicitud aprobada`;
  const userHtml = renderInstitutionalTemplate({
    title: 'Reporte de salida aprobado',
    introHtml: `<p>Cordial saludo, <strong>${escapeHtml(solicitud.solicitante_snapshot?.nombre)}</strong>.</p>`,
    bodyHtml: `<p>Gestion Humana aprobo su reporte de salida. Se adjunta el PDF digital FR-002 diligenciado y aprobado.</p>
      ${buildTerapiasHtml(solicitud)}`
  });

  const userEmailsTo = [
    solicitud.solicitante_snapshot?.email,
    solicitud.jefe_snapshot?.email
  ].filter(Boolean);

  const userResult = await sendInstitutionalEmail({
    to: userEmailsTo,
    subject,
    text: `El reporte de salida ${solicitud.consecutivo} de ${solicitud.solicitante_snapshot?.nombre} fue aprobado por Gestion Humana. Se adjunta PDF digital FR-002 aprobado.`,
    html: userHtml,
    attachments
  });

  let sstResult = { success: false };
  if (recipients.sst) {
    sstResult = await sendInstitutionalEmail({
      to: [recipients.sst],
      subject: `SST: ${subject}`,
      text: `El reporte de salida ${solicitud.consecutivo} de ${solicitud.solicitante_snapshot?.nombre} fue aprobado. Se adjunta copia del PDF para control de Seguridad y Salud en el Trabajo.`,
      html: renderInstitutionalTemplate({
        title: 'Copia SST: Reporte de salida aprobado',
        introHtml: `<p>Cordial saludo, equipo de <strong>Seguridad y Salud en el Trabajo</strong>.</p>`,
        bodyHtml: `<p>Se ha finalizado la aprobacion del reporte de salida para <strong>${escapeHtml(solicitud.solicitante_snapshot?.nombre)}</strong>.</p><p>Se adjunta el PDF correspondiente para sus registros y control.</p>${buildTerapiasHtml(solicitud)}`
      }),
      attachments
    });
  }

  return { userResult, sstResult };
};

const searchJefes = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const search = sanitizeText(req.query.search, 80);
    const userRows = await getUserProfileLaboralRows();
    if (userRows.length) {
      const bosses = mapUserProfileBosses(userRows, search)
        .filter((boss) => !boss.userId || Number(boss.userId) !== Number(req.user?.id));
      return res.json({ success: true, data: bosses });
    }

    const { rows } = await getLatestAdministrativos();
    const bosses = (await mapAdministrativeBosses(rows, search))
      .filter((boss) => !boss.userId || Number(boss.userId) !== Number(req.user?.id));
    res.json({ success: true, data: bosses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo buscar jefes inmediatos' });
  }
};

const listarDependencias = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const userRows = await getUserProfileLaboralRows();
    const userDependencias = uniqueSortedValues(userRows.map((row) => cleanDependenciaLabel(row.dependencia)));
    if (userRows.length) {
      return res.json({ success: true, data: userDependencias });
    }

    const { rows: rhRows } = await getLatestAdministrativos();
    const rhDependencias = uniqueSortedValues(rhRows.map((row) => cleanDependenciaLabel(row.dependencia)));
    if (rhDependencias.length) {
      return res.json({ success: true, data: rhDependencias });
    }

    const planRows = await PlanAccion.findAll({
      where: {
        dependencia: { [Op.ne]: null },
        deleted_at: null
      },
      attributes: ['dependencia'],
      group: ['dependencia'],
      order: [['dependencia', 'ASC']],
      raw: true
    });

    const seen = new Set();
    const dependencias = planRows
      .map((row) => row.dependencia)
      .filter(isDependenciaOption)
      .map((dependencia) => cleanDependenciaLabel(dependencia))
      .filter(Boolean)
      .filter((dep) => {
        const key = dep.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => a.localeCompare(b, 'es'));

    res.json({ success: true, data: dependencias });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo consultar el listado de dependencias' });
  }
};

const getCatalogoLaboral = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const userRows = await getUserProfileLaboralRows();
    if (userRows.length) {
      const current = findCurrentUserProfileRow(userRows, req.user);
      const relaciones = userRows.map(serializeUserLaboralRow).filter((row) => row.dependencia || row.cargo || row.jefe_inmediato);
      const jefes = mapUserProfileBosses(userRows, req.query.search || '')
        .filter((boss) => !boss.userId || Number(boss.userId) !== Number(req.user?.id));

      return res.json({
        success: true,
        data: {
          anio: null,
          source: 'users',
          dependencias: uniqueSortedValues(relaciones.map((row) => row.dependencia)),
          cargos: uniqueSortedValues(relaciones.map((row) => row.cargo)),
          jefes,
          relaciones,
          currentEmployee: current ? {
            nombre: sanitizeText(current.nombre, 220),
            documento: sanitizeText(current.username, 80),
            correo: sanitizeText(current.email, 220),
            dependencia: cleanDependenciaLabel(current.dependencia),
            cargo: sanitizeText(current.cargo, 220),
            jefe_inmediato: sanitizeText(current.jefe_inmediato, 220),
            source: 'users'
          } : null,
          periodo: '',
          periodoLabel: 'Base de usuarios'
        }
      });
    }

    const { latestYear, latestPeriod, rows } = await getLatestAdministrativos();
    const current = findCurrentAdministrativeRow(rows, req.user);
    const jefes = (await mapAdministrativeBosses(rows, req.query.search || ''))
      .filter((boss) => !boss.userId || Number(boss.userId) !== Number(req.user?.id));

    res.json({
      success: true,
      data: {
        anio: latestYear,
        source: 'recurso_humano_administrativos',
        dependencias: uniqueSortedValues(rows.map((row) => cleanDependenciaLabel(row.dependencia))),
        cargos: uniqueSortedValues(rows.map((row) => row.cargo_especifico)),
        relaciones: rows.map(serializeLaboralRow).filter((row) => row.dependencia || row.cargo),
        currentEmployee: current ? {
          nombre: sanitizeText(current.nombre_empleado, 220),
          documento: sanitizeText(current.numero_cedula, 80),
          dependencia: cleanDependenciaLabel(current.dependencia),
          cargo: sanitizeText(current.cargo_especifico, 220),
          jefe_inmediato: '',
          anio: current.anio,
          periodo: sanitizeText(current.periodo, 40)
        } : null,
        periodo: latestPeriod,
        periodoLabel: [latestYear, latestPeriod].filter(Boolean).join(' '),
        jefes
      }
    });
  } catch (error) {
    console.error('Error consultando catalogo laboral reporte salida:', error);
    res.status(500).json({ success: false, message: 'No se pudo consultar el catalogo laboral' });
  }
};

const radicarSolicitud = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const isSalidaMultiple = req.body.isSalidaMultiple === true;

    const documento = await Documento.findByPk(req.body.documentoId);
    if (!documento || !isReporteSalidaDocumento(documento)) {
      return res.status(400).json({ success: false, message: 'El formulario solo esta disponible para THM-DP-FR-002 REPORTE DE SALIDA.' });
    }

    const salida = req.body.salida || {};
    const reposicion = req.body.reposicion || {};

    if (isSalidaMultiple) {
      // Validate group payload
      const participantes = req.body.participantes || [];
      if (!participantes.length) {
        return res.status(400).json({ success: false, message: 'Debe agregar al menos un participante para la salida grupal.' });
      }
      for (const p of participantes) {
        if (!p.nombre || !p.documento || !p.correo || !p.dependencia || !p.cargo) {
          return res.status(400).json({ success: false, message: 'Todos los participantes deben tener nombre, documento, correo, dependencia y cargo.' });
        }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.correo)) {
          return res.status(400).json({ success: false, message: `El correo "${p.correo}" del participante ${p.nombre} no es valido.` });
        }
      }
      if (!salida.tipo) return res.status(400).json({ success: false, message: 'Debe seleccionar el tipo de salida.' });
      if (salida.tipo === 'otra' || (String(salida.tipo).startsWith('otra:') && String(salida.tipo).substring(5).trim() === '')) {
        return res.status(400).json({ success: false, message: 'Debe especificar el motivo para la opcion "Otra, ¿Cual?".' });
      }
      if (salida.tipo === 'terapias') {
        if (!salida.terapiasList || salida.terapiasList.length === 0) return res.status(400).json({ success: false, message: 'Debe indicar al menos una terapia y completarla.' });
        for (let i = 0; i < salida.terapiasList.length; i++) {
          const t = salida.terapiasList[i];
          if (!t.fecha || !t.horaInicio || !t.horaFin) return res.status(400).json({ success: false, message: `Complete fecha, hora inicio y hora fin para la terapia #${i + 1}.` });
        }
      } else {
        if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio || !salida.horaFin) {
          return res.status(400).json({ success: false, message: 'Debe indicar fecha de salida, hora de salida, fecha de regreso y hora de regreso.' });
        }
      }
      let requestedMinutes = 0;
      if (salida.tipo === 'terapias') {
        requestedMinutes = (salida.terapiasList || []).reduce((acc, t) => acc + (diffBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0), 0);
      } else {
        requestedMinutes = diffBusinessMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin);
      }
      if (!requestedMinutes) {
        return res.status(400).json({ success: false, message: 'El rango de salida no contiene tiempo laboral valido.' });
      }

      const now = new Date();
      const grupo_id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      const token = encryptPayload({ purpose: 'reporte_salida_approve_grupo', grupo_id }, 60 * 60 * 24 * 15);
      const tokenHash = hashToken(token);

      const creadas = [];

      for (let i = 0; i < participantes.length; i++) {
        const p = participantes[i];
        
        let participantUser = await User.findOne({
          where: {
            [Op.or]: [
              { username: String(p.documento).trim() },
              { email: String(p.correo).trim() }
            ]
          }
        });

        if (!participantUser) {
          const internalPassword = crypto.randomBytes(24).toString('hex');
          participantUser = await User.create({
            nombre: p.nombre,
            email: String(p.correo).trim(),
            username: String(p.documento).trim(),
            dependencia: p.dependencia,
            cargo: p.cargo,
            password: internalPassword,
            role: ROLES.CONSULTA,
            estado: 'activo',
            must_change_password: false
          });
        }

        const consecutivo = `RS-${now.getFullYear()}-${String(Date.now()).slice(-8)}-${i + 1}`;

        const solicitud = await ReporteSalidaSolicitud.create({
          consecutivo,
          user_id: participantUser.id,
          documento_id: documento.id,
          jefe_inmediato_user_id: null,
          solicitante_snapshot: buildSnapshot(participantUser),
          jefe_snapshot: {},
          estado: 'pendiente_aprobacion_gestion_humana',
          datos_formulario: {
            grupo_id,
            is_salida_multiple: true,
            personal: {
              nombre: sanitizeText(p.nombre),
              documento: sanitizeText(p.documento),
              correo: sanitizeText(p.correo)
            },
            laboral: {
              dependencia: cleanDependenciaLabel(p.dependencia),
              cargo: sanitizeText(p.cargo)
            },
            salida: {
              tipo: sanitizeText(salida.tipo, 60),
              fecha: sanitizeText(salida.fecha, 20),
              fechaRegreso: sanitizeText(salida.fechaRegreso || salida.fecha, 20),
              horaInicio: sanitizeText(salida.horaInicio, 10),
              horaFin: sanitizeText(salida.horaFin, 10),
              motivo: sanitizeText(salida.motivo, 600),
              campusSalida: sanitizeText(salida.campusSalida, 100),
              campusDestino: sanitizeText(salida.campusDestino, 100),
              especialidadMedica: sanitizeText(salida.especialidadMedica, 100),
              terapiasList: salida.terapiasList || []
            },
            reposicion: {
              fecha: '',
              fechaFin: '',
              horaInicio: '',
              horaFin: '',
              observacion: ''
            },
            parametrizacion_tiempo: {
              fecha_calculo: now.toISOString(),
              criterio_salida: 'horas adeudadas segun jornada laboral institucional',
              criterio_reposicion: 'horas acumuladas por seguimiento, sin restriccion de dia',
              jornada_salida: {
                dias_laborales: 'lunes a viernes',
                excluye: ['sabados', 'domingos', 'festivos_colombia'],
                bloques: WORK_BLOCKS
              }
            }
          },
          tiempo_solicitado_minutos: requestedMinutes,
          reposicion_aplica: false,
          reposicion_minutos: null,
          reposicion_estado: 'no_aplica',
          aprobacion_gh_token_hash: tokenHash,
          trazabilidad: [{ event: 'radicada_grupal', actor: buildSnapshot(req.user), at: now.toISOString() }]
        });

        creadas.push(solicitud);
      }

      const emailResult = await sendGestionHumanaGroupApprovalEmail(creadas, token);

      for (const solicitud of creadas) {
        await solicitud.update({
          correo_gh_enviado_at: emailResult.success ? new Date() : null,
          trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_gestion_humana_enviado' : 'correo_gestion_humana_error', null, { error: emailResult.error || '' })
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Salida grupal radicada exitosamente. Se envio un correo a Gestion Humana para aprobacion.',
        data: creadas.map(serializeSolicitud)
      });
    }

    // Single Exit Flow
    const errorMessage = validateRadicacionPayload(req.body, req.user);
    if (errorMessage) return res.status(400).json({ success: false, message: errorMessage });

    const jefePayload = req.body.jefeInmediato || {};
    const jefe = req.body.jefeInmediatoUserId
      ? await User.findOne({ where: { id: req.body.jefeInmediatoUserId, estado: 'activo' } })
      : null;
    const shouldUseAdministrativeBoss = !jefe || jefePayload?.source === 'recurso_humano_administrativos' || jefePayload?.cargo;
    const jefeSnapshot = shouldUseAdministrativeBoss
      ? buildAdministrativeBossSnapshot({
        ...jefePayload,
        userId: jefe?.id || jefePayload.userId,
        email: jefePayload.email || jefe?.email || ''
      })
      : buildSnapshot(jefe);
    if (!jefe && !jefeSnapshot.email) {
      return res.status(400).json({ success: false, message: 'El jefe inmediato seleccionado desde Recurso Humano no tiene correo registrado.' });
    }
    if (jefe && Number(jefe.id) === Number(req.user.id)) {
      return res.status(400).json({ success: false, message: 'El jefe inmediato debe ser un usuario diferente al solicitante.' });
    }

    let requestedMinutes = 0;
    if (salida.tipo === 'terapias') {
      requestedMinutes = (salida.terapiasList || []).reduce((acc, t) => acc + (diffBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0), 0);
    } else {
      requestedMinutes = diffBusinessMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin);
    }
    const hasReposicionPlan = Boolean(reposicion.fecha || reposicion.fechaFin || reposicion.horaInicio || reposicion.horaFin);
    const replacementMinutes = salida.tipo === 'diligencia_personal' && hasReposicionPlan
      ? diffElapsedMinutes(reposicion.fecha, reposicion.fechaFin, reposicion.horaInicio, reposicion.horaFin)
      : null;

    const now = new Date();
    const consecutivo = `RS-${now.getFullYear()}-${String(Date.now()).slice(-8)}`;
    const token = encryptPayload({ purpose: 'reporte_salida_approve', stage: 'jefe', consecutivo }, 60 * 60 * 24 * 15);
    const solicitud = await ReporteSalidaSolicitud.create({
      consecutivo,
      user_id: req.user.id,
      documento_id: documento.id,
      jefe_inmediato_user_id: jefe?.id || null,
      solicitante_snapshot: buildSnapshot(req.user),
      jefe_snapshot: jefeSnapshot,
      datos_formulario: {
        tx_id: crypto.randomUUID(),
        personal: {
          nombre: sanitizeText(req.body.personal?.nombre || req.user.nombre),
          documento: sanitizeText(req.body.personal?.documento || req.user.username),
          correo: sanitizeText(req.user.email)
        },
        laboral: {
          dependencia: cleanDependenciaLabel(req.body.laboral?.dependencia),
          cargo: sanitizeText(req.body.laboral?.cargo)
        },
        salida: {
          tipo: sanitizeText(salida.tipo, 60),
          fecha: sanitizeText(salida.fecha, 20),
          fechaRegreso: sanitizeText(salida.fechaRegreso || salida.fecha, 20),
          horaInicio: sanitizeText(salida.horaInicio, 10),
          horaFin: sanitizeText(salida.horaFin, 10),
          motivo: sanitizeText(salida.motivo, 600),
          campusSalida: sanitizeText(salida.campusSalida, 100),
          campusDestino: sanitizeText(salida.campusDestino, 100),
          especialidadMedica: sanitizeText(salida.especialidadMedica, 100),
          terapiasList: salida.terapiasList || []
        },
        reposicion: {
          fecha: sanitizeText(reposicion.fecha, 20),
          fechaFin: sanitizeText(reposicion.fechaFin || reposicion.fecha, 20),
          horaInicio: sanitizeText(reposicion.horaInicio, 10),
          horaFin: sanitizeText(reposicion.horaFin, 10),
          observacion: sanitizeText(reposicion.observacion, 600)
        },
        parametrizacion_tiempo: {
          fecha_calculo: now.toISOString(),
          criterio_salida: 'horas adeudadas segun jornada laboral institucional',
          criterio_reposicion: 'horas acumuladas por seguimiento, sin restriccion de dia',
          jornada_salida: {
            dias_laborales: 'lunes a viernes',
            excluye: ['sabados', 'domingos', 'festivos_colombia'],
            bloques: WORK_BLOCKS
          }
        }
      },
      tiempo_solicitado_minutos: requestedMinutes,
      reposicion_aplica: salida.tipo === 'diligencia_personal',
      reposicion_minutos: replacementMinutes,
      reposicion_estado: salida.tipo === 'diligencia_personal' ? (replacementMinutes ? 'programada' : 'pendiente') : 'no_aplica',
      aprobacion_jefe_token_hash: hashToken(token),
      trazabilidad: [{ event: 'radicada', actor: buildSnapshot(req.user), at: now.toISOString() }]
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud radicada. Se procesara el envio de correo al jefe inmediato.',
      data: serializeSolicitud(solicitud)
    });

    // Procesar PDF y correo en segundo plano (fire-and-forget)
    Promise.resolve().then(async () => {
      try {
        const attachments = await buildReporteSalidaAttachments(solicitud);
        await solicitud.update({ pdf_generado_at: new Date() });
        const emailResult = await sendJefeApprovalEmail(solicitud, token, attachments);
        await solicitud.update({
          correo_jefe_enviado_at: emailResult.success ? new Date() : null,
          trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_jefe_enviado' : 'correo_jefe_error', req.user, { error: emailResult.error || '' })
        });
      } catch (bgError) {
        console.error('Error en segundo plano (Reporte Salida PDF/Email):', bgError);
      }
    });
  } catch (error) {
    console.error('Error radicando reporte de salida:', error);
    res.status(500).json({ success: false, message: 'Error interno: ' + error.message });
  }
};

const aprobarDesdeCorreo = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'warning',
      title: 'Formulario no habilitado',
      message: 'El flujo de reporte de salida aun no esta activo.',
      nextStep: 'La solicitud no fue procesada. Cuando el administrador habilite nuevamente el formulario, podra usar el enlace correspondiente.'
    });
  }
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'reporte_salida_approve' || !payload?.consecutivo || !payload?.stage) {
      return renderApprovalPage({
        res,
        status: 403,
        tone: 'error',
        title: 'Enlace no autorizado',
        message: 'El enlace de aprobacion no corresponde a una solicitud valida.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo institucional.'
      });
    }
    const solicitud = await ReporteSalidaSolicitud.findOne({ where: { consecutivo: payload.consecutivo } });
    if (!solicitud) {
      return renderApprovalPage({
        res,
        status: 404,
        tone: 'warning',
        title: 'Solicitud no encontrada',
        message: 'No se encontro una solicitud asociada a este enlace.',
        nextStep: 'Puede que la solicitud haya sido eliminada o que el enlace no corresponda al sistema actual.'
      });
    }

    const tokenHash = hashToken(req.params.token);
    if (payload.stage === 'jefe') {
      if (solicitud.estado !== 'pendiente_aprobacion_jefe') {
        const isRechazada = solicitud.estado === 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isRechazada ? 'Solicitud rechazada' : 'Solicitud ya procesada',
          message: isRechazada 
            ? 'Esta solicitud fue rechazada anteriormente y no puede ser aprobada.' 
            : 'Esta aprobacion ya fue registrada previamente.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional desde este enlace.'
        });
      }
      if (solicitud.aprobacion_jefe_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token de aprobacion esperado para esta solicitud.',
          solicitud,
          nextStep: 'Por seguridad, la aprobacion no fue registrada.'
        });
      }
      const ghToken = encryptPayload({ purpose: 'reporte_salida_approve', stage: 'gestion_humana', consecutivo: solicitud.consecutivo }, 60 * 60 * 24 * 15);
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'pendiente_aprobacion_gestion_humana',
        jefe_aprobado_at: new Date(),
        aprobacion_jefe_token_hash: null,
        aprobacion_gh_token_hash: hashToken(ghToken),
        trazabilidad: appendTrace(solicitud, 'aprobada_jefe', null)
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_jefe',
          aprobacion_jefe_token_hash: tokenHash
        }
      });
      if (!updatedCount) {
        await solicitud.reload();
        return renderApprovalPage({
          res,
          tone: 'info',
          title: 'Solicitud ya procesada',
          message: 'Esta aprobacion ya fue registrada previamente.',
          solicitud,
          nextStep: 'El boton de aprobacion ya fue utilizado y quedo inhabilitado para nuevos registros.'
        });
      }
      await solicitud.reload();
      const attachments = await buildReporteSalidaAttachments(solicitud);
      const emailResult = await sendGestionHumanaApprovalEmail(solicitud, ghToken, attachments);
      await solicitud.update({
        correo_gh_enviado_at: emailResult.success ? new Date() : null,
        trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_gestion_humana_enviado' : 'correo_gestion_humana_error', null, { error: emailResult.error || '' })
      });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Aprobacion registrada',
        message: 'La solicitud fue enviada a Gestion Humana para revision y aprobacion.',
        solicitud,
        nextStep: 'Gestion Humana recibira el correo con el PDF diligenciado para continuar el flujo.'
      });
    }

    if (payload.stage === 'gestion_humana') {
      if (solicitud.estado !== 'pendiente_aprobacion_gestion_humana') {
        const isRechazada = solicitud.estado === 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isRechazada ? 'Solicitud rechazada' : 'Solicitud ya procesada',
          message: isRechazada 
            ? 'Esta solicitud fue rechazada anteriormente y no puede ser aprobada.' 
            : 'Esta aprobacion ya fue registrada previamente.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional desde este enlace.'
        });
      }
      if (solicitud.aprobacion_gh_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token de aprobacion esperado para Gestion Humana.',
          solicitud,
          nextStep: 'Por seguridad, la aprobacion no fue registrada.'
        });
      }
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'finalizada',
        gestion_humana_aprobado_at: new Date(),
        finalizado_at: new Date(),
        aprobacion_gh_token_hash: null,
        trazabilidad: appendTrace(solicitud, 'aprobada_gestion_humana', null)
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_gestion_humana',
          aprobacion_gh_token_hash: tokenHash
        }
      });
      if (!updatedCount) {
        await solicitud.reload();
        return renderApprovalPage({
          res,
          tone: 'info',
          title: 'Solicitud ya procesada',
          message: 'Esta aprobacion ya fue registrada previamente.',
          solicitud,
          nextStep: 'El boton de aprobacion ya fue utilizado y quedo inhabilitado para nuevos registros.'
        });
      }
      await solicitud.reload();
      solicitud.trazabilidad = appendTrace(solicitud, 'notificacion_final_enviada', null, { usuario: true, sst: true });
      const attachments = await buildReporteSalidaAttachments(solicitud);
      const results = await sendFinalEmails(solicitud, attachments);
      await solicitud.update({
        correo_usuario_enviado_at: results.userResult.success ? new Date() : null,
        correo_sst_enviado_at: results.sstResult.success ? new Date() : null,
        enviado_sst_at: results.sstResult.success ? new Date() : null,
        trazabilidad: appendTrace(solicitud, 'notificacion_final_enviada', null, {
          usuario: results.userResult.success,
          sst: results.sstResult.success
        })
      });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Aprobacion registrada',
        message: 'Se notifico al usuario y se envio el PDF a Seguridad y Salud en el Trabajo.',
        solicitud,
        nextStep: 'El flujo quedo finalizado y la trazabilidad permanece registrada en Seguimiento a reportes.'
      });
    }

    return renderApprovalPage({
      res,
      status: 400,
      tone: 'warning',
      title: 'Etapa no valida',
      message: 'El enlace no indica una etapa reconocida del flujo de aprobacion.',
      solicitud,
      nextStep: 'Use el boton original enviado desde el correo institucional.'
    });
  } catch (error) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'error',
      title: 'Enlace vencido o invalido',
      message: 'No fue posible validar el enlace de aprobacion.',
      nextStep: 'Solicite un nuevo enlace si requiere procesar esta aprobacion.'
    });
  }
};

const listarSolicitudes = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const estado = sanitizeText(req.query.estado, 80);
    const search = sanitizeText(req.query.search, 100);
    const where = {};
    if (estado) where.estado = estado;
    if (search) {
      where[Op.or] = [
        { consecutivo: { [Op.iLike]: `%${search}%` } },
        { solicitante_snapshot: { [Op.contains]: { nombre: search } } }
      ];
    }
    const { count, rows } = await ReporteSalidaSolicitud.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });
    res.json({
      success: true,
      data: {
        solicitudes: rows.map(serializeSolicitud),
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo listar solicitudes' });
  }
};

const getSeguimientoPersonal = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 50)));
    const estado = sanitizeText(req.query.estado, 80);
    const access = await resolveSeguimientoAccess(req.user);

    if (!access.canView) {
      return res.json({
        success: true,
        data: {
          access,
          solicitudes: [],
          pagination: { total: 0, page, limit, totalPages: 0 }
        }
      });
    }

    let where = {};
    if (access.canManageAll) {
      if (estado) where.estado = estado;
    } else {
      const scopedConditions = [];
      if (access.counts.bossPending > 0) scopedConditions.push(bossPendingReposicionWhere(req.user));
      if (access.counts.ownPending > 0) scopedConditions.push(ownPendingReposicionWhere(req.user));
      where = scopedConditions.length === 1 ? scopedConditions[0] : { [Op.or]: scopedConditions };
      if (estado) where = { [Op.and]: [where, { estado }] };
    }

    const { count, rows } = await ReporteSalidaSolicitud.findAndCountAll({
      where,
      order: [['created_at', 'DESC']],
      limit,
      offset: (page - 1) * limit
    });

    res.json({
      success: true,
      data: {
        access,
        solicitudes: rows.map(serializeSolicitud),
        pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo consultar el seguimiento de reposiciones' });
  }
};

const getSeguimientoBadge = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const access = await resolveSeguimientoAccess(req.user);
    res.json({
      success: true,
      data: {
        access
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo consultar el badge de reposiciones' });
  }
};

const actualizarReposicion = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const rolesPrivilegiados = ['administrador', 'gestion_informacion', 'planeacion_estrategica'];
    const tienePrivilegio = rolesPrivilegiados.includes(req.user.role) || (req.user.menuPermissions || []).includes('seguimiento_reportes_rrhh');
    
    const solicitud = await ReporteSalidaSolicitud.findByPk(req.params.id);
    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    if (!tienePrivilegio && solicitud.jefe_inmediato_user_id !== req.user.id) {
      return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar la reposición de esta solicitud.' });
    }
    if (!solicitud.reposicion_aplica) {
      return res.status(400).json({ success: false, message: 'Esta solicitud no requiere reposicion de tiempo.' });
    }
    if (solicitud.estado !== 'finalizada') {
      return res.status(400).json({ success: false, message: 'La reposicion solo puede validarse cuando el reporte esta finalizado por Gestion Humana.' });
    }

    let nextEstado = sanitizeText(req.body?.estado, 40);
    const horasAbonadas = parseFloat(req.body?.horasAbonadas) || 0;
    const minutosAbonados = Math.round(horasAbonadas * 60);

    const previousData = solicitud.datos_formulario || {};
    const minutosYaPagados = previousData.reposicion_minutos_pagados || 0;
    const nuevoTotalPagados = minutosYaPagados + minutosAbonados;
    const tiempoTotal = solicitud.reposicion_minutos || solicitud.tiempo_solicitado_minutos || 0;

    if (nuevoTotalPagados >= tiempoTotal && tiempoTotal > 0) {
      nextEstado = 'cumplida';
    }

    if (!['pendiente', 'programada', 'cumplida', 'incumplida'].includes(nextEstado)) {
      return res.status(400).json({ success: false, message: 'Estado de reposicion no valido.' });
    }

    const observacion = sanitizeText(req.body?.observacion, 600);
    const now = new Date();
    
    await solicitud.update({
      reposicion_estado: nextEstado,
      observacion_gestion_humana: observacion || solicitud.observacion_gestion_humana,
      datos_formulario: {
        ...previousData,
        reposicion_minutos_pagados: nuevoTotalPagados,
        reposicion_validacion: {
          estado: nextEstado,
          observacion,
          horas_abonadas_esta_sesion: horasAbonadas,
          validado_por: buildSnapshot(req.user),
          validado_at: now.toISOString()
        }
      },
      trazabilidad: appendTrace(solicitud, `reposicion_${nextEstado}`, req.user, { observacion, horas_abonadas: horasAbonadas })
    });

    await solicitud.reload();
    res.json({
      success: true,
      message: nextEstado === 'cumplida' ? 'Reposicion de tiempo validada.' : 'Seguimiento de reposicion actualizado.',
      data: serializeSolicitud(solicitud)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo actualizar la reposicion de tiempo' });
  }
};

const eliminarSolicitud = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const solicitud = await ReporteSalidaSolicitud.findByPk(req.params.id);
    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }
    await solicitud.destroy();
    res.json({ success: true, message: 'Solicitud eliminada correctamente.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo eliminar la solicitud.' });
  }
};

const editarSolicitudAdmin = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const solicitud = await ReporteSalidaSolicitud.findByPk(req.params.id);
    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    const { estado, reposicion_aplica, tiempo_solicitado_minutos } = req.body;

    const updateData = {};
    if (estado) updateData.estado = sanitizeText(estado, 50);
    if (reposicion_aplica !== undefined) updateData.reposicion_aplica = Boolean(reposicion_aplica);
    if (tiempo_solicitado_minutos !== undefined) {
      updateData.tiempo_solicitado_minutos = parseInt(tiempo_solicitado_minutos, 10);
      // Actualizar también reposicion_minutos si aplica
      updateData.reposicion_minutos = updateData.tiempo_solicitado_minutos;
    }

    updateData.trazabilidad = appendTrace(solicitud, 'edicion_administrativa', req.user, { 
      cambios: Object.keys(updateData) 
    });

    await solicitud.update(updateData);
    await solicitud.reload();

    res.json({
      success: true,
      message: 'Solicitud editada correctamente.',
      data: serializeSolicitud(solicitud)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo editar la solicitud.' });
  }
};

const getFeatureConfig = async (req, res) => {
  try {
    const enabled = await getReporteSalidaFeatureState();
    res.json({ success: true, data: { enabled, canToggle: isAdminUser(req.user) } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo consultar la configuracion del reporte de salida' });
  }
};

const updateFeatureConfig = async (req, res) => {
  try {
    if (!isAdminUser(req.user)) {
      return res.status(403).json({ success: false, message: 'Solo el administrador puede activar o desactivar este formulario.' });
    }
    const enabled = await setReporteSalidaFeatureState(Boolean(req.body?.enabled), req.user.id);
    res.json({
      success: true,
      message: enabled ? 'Formulario de reporte de salida activado.' : 'Formulario de reporte de salida desactivado.',
      data: { enabled, canToggle: true }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo actualizar la configuracion del reporte de salida' });
  }
};

const renderRejectionFormPage = ({ res, solicitud, token, stage }) => {
  const consecutivo = solicitud?.consecutivo || '';
  const solicitante = solicitud?.solicitante_snapshot?.nombre || '';
  const safeConsecutivo = escapeHtml(consecutivo);
  const safeSolicitante = escapeHtml(solicitante);
  const safeActionUrl = escapeHtml(`${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`);
  const stageLabel = stage === 'jefe' ? 'Jefe Inmediato' : 'Gestion Humana';

  return res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rechazar Solicitud | SIAC UNICESMAG</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #dbe6f5;
      --brand: #e11d48;
      --navy: #0b1730;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 20% 0%, rgba(225, 29, 72, 0.1), transparent 32%),
        linear-gradient(135deg, #fcf8f8 0%, #fff1f2 48%, #fcf8f8 100%);
      color: var(--ink);
      display: grid;
      place-items: center;
      padding: 28px;
    }
    .shell {
      width: min(760px, 100%);
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
      overflow: hidden;
    }
    .top {
      padding: 22px 26px;
      background: linear-gradient(90deg, #0b1730, #b91c1c);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brandmark {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.13);
      border: 1px solid rgba(255, 255, 255, 0.24);
      display: grid;
      place-items: center;
      font-weight: 900;
      letter-spacing: .08em;
    }
    .brand-title { font-weight: 900; font-size: 18px; line-height: 1.15; }
    .brand-subtitle { margin-top: 3px; color: #fecdd3; font-size: 13px; }
    .content { padding: 30px; }
    .status {
      display: flex;
      gap: 18px;
      align-items: flex-start;
    }
    .icon {
      flex: 0 0 auto;
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #e11d48;
      display: grid;
      place-items: center;
      font-size: 28px;
      font-weight: 950;
    }
    h1 {
      margin: 0;
      font-size: clamp(24px, 4vw, 34px);
      line-height: 1.08;
      letter-spacing: 0;
    }
    .message {
      margin: 10px 0 0;
      color: #334155;
      font-size: 16px;
      line-height: 1.6;
    }
    .details {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: #fff8f8;
    }
    .detail {
      padding: 16px;
      border-right: 1px solid var(--line);
      min-width: 0;
    }
    .detail:last-child { border-right: 0; }
    .label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 900;
      letter-spacing: .06em;
    }
    .value {
      margin-top: 7px;
      font-weight: 850;
      color: #0f172a;
      overflow-wrap: anywhere;
    }
    .form-group {
      margin-top: 26px;
    }
    label.field-label {
      display: block;
      font-weight: 900;
      color: #334155;
      font-size: 14px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    textarea {
      width: 100%;
      height: 120px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      font-family: inherit;
      font-size: 15px;
      color: var(--ink);
      background: #fcfcfc;
      resize: vertical;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    textarea:focus {
      outline: 0;
      border-color: #e11d48;
      box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.15);
      background: #fff;
    }
    .actions {
      margin-top: 26px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 12px 24px;
      font-weight: 850;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.1s, opacity 0.2s;
    }
    button:active {
      transform: scale(0.98);
    }
    .ghost {
      background: #f1f5f9;
      color: #475569;
    }
    .primary {
      background: var(--brand);
      color: #fff;
      box-shadow: 0 10px 22px rgba(225, 29, 72, .24);
    }
    @media (max-width: 640px) {
      body { padding: 14px; }
      .top, .content { padding: 20px; }
      .status { flex-direction: column; }
      .details { grid-template-columns: 1fr; }
      .detail { border-right: 0; border-bottom: 1px solid var(--line); }
      .detail:last-child { border-bottom: 0; }
      .actions { justify-content: stretch; }
      button { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div class="brandmark">SIAC</div>
      <div>
        <div class="brand-title">UNICESMAG</div>
        <div class="brand-subtitle">Reporte de salida | ${stageLabel}</div>
      </div>
    </section>
    <section class="content">
      <div class="status">
        <div class="icon">&#10007;</div>
        <div>
          <h1>No aprobar solicitud</h1>
          <p class="message">Por favor ingrese la justificacion del rechazo. Este motivo sera enviado al colaborador.</p>
        </div>
      </div>
      <div class="details">
        <div class="detail"><div class="label">Solicitud</div><div class="value">${safeConsecutivo}</div></div>
        <div class="detail"><div class="label">Colaborador</div><div class="value">${safeSolicitante || 'No disponible'}</div></div>
        <div class="detail"><div class="label">Tiempo</div><div class="value">${escapeHtml(formatMinutes(solicitud.tiempo_solicitado_minutos))}</div></div>
      </div>
      <form method="POST" action="${safeActionUrl}">
        <div class="form-group">
          <label class="field-label" for="justificacion">Justificacion del rechazo *</label>
          <textarea id="justificacion" name="justificacion" required placeholder="Escriba aqui los motivos detallados del rechazo..."></textarea>
        </div>
        <div class="actions">
          <button class="ghost" type="button" onclick="window.location.href='${frontendUrl}';">Volver al sistema</button>
          <button type="submit" class="primary">Confirmar rechazo</button>
        </div>
      </form>
    </section>
  </main>
</body>
</html>`);
};

const sendCollaboratorRejectionEmail = async ({ solicitud, rejectedBy, justificacion }) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const subject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Solicitud no aprobada`;
  const html = renderInstitutionalTemplate({
    title: 'Reporte de salida no aprobado',
    introHtml: `<p>Cordial saludo, <strong>${escapeHtml(solicitante.nombre)}</strong>.</p><p>Le informamos que su solicitud de reporte de salida fue rechazada por <strong>${escapeHtml(rejectedBy)}</strong>.</p>`,
    bodyHtml: `
      <p><strong>Solicitud:</strong> ${escapeHtml(solicitud.consecutivo)}</p>
      <p><strong>Motivo / Justificacion del rechazo:</strong></p>
      <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
        ${escapeHtml(justificacion)}
      </div>
      <p>Consulte mas informacion en el modulo de Seguimiento a reportes del sistema SIAC.</p>
    `
  });
  return sendInstitutionalEmail({
    to: solicitante.email,
    subject,
    text: `Su solicitud ${solicitud.consecutivo} fue rechazada por ${rejectedBy}. Motivo: ${justificacion}`,
    html
  });
};

const sendGHRejectionEmails = async ({ solicitud, justificacion }) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const jefe = solicitud.jefe_snapshot || {};
  
  const userSubject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Solicitud no aprobada por Gestion Humana`;
  const userHtml = renderInstitutionalTemplate({
    title: 'Reporte de salida no aprobado por Gestion Humana',
    introHtml: `<p>Cordial saludo, <strong>${escapeHtml(solicitante.nombre)}</strong>.</p><p>Le informamos que su solicitud de reporte de salida fue rechazada por <strong>Gestion Humana</strong>.</p>`,
    bodyHtml: `
      <p><strong>Solicitud:</strong> ${escapeHtml(solicitud.consecutivo)}</p>
      <p><strong>Motivo / Justificacion del rechazo:</strong></p>
      <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
        ${escapeHtml(justificacion)}
      </div>
      <p>Consulte mas informacion en el modulo de Seguimiento a reportes del sistema SIAC.</p>
    `
  });

  const bossSubject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Solicitud no aprobada por Gestion Humana`;
  const bossHtml = renderInstitutionalTemplate({
    title: 'Notificacion de rechazo de reporte de salida',
    introHtml: `<p>Cordial saludo, <strong>${escapeHtml(jefe.nombre)}</strong>.</p><p>Le informamos que la solicitud de reporte de salida de su colaborador <strong>${escapeHtml(solicitante.nombre)}</strong> fue rechazada por <strong>Gestion Humana</strong>.</p>`,
    bodyHtml: `
      <p><strong>Solicitud:</strong> ${escapeHtml(solicitud.consecutivo)}</p>
      <p><strong>Motivo / Justificacion del rechazo:</strong></p>
      <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
        ${escapeHtml(justificacion)}
      </div>
    `
  });

  const userResult = await sendInstitutionalEmail({
    to: solicitante.email,
    subject: userSubject,
    text: `Su solicitud ${solicitud.consecutivo} fue rechazada por Gestion Humana. Motivo: ${justificacion}`,
    html: userHtml
  });

  let bossResult = { success: false };
  if (jefe.email) {
    bossResult = await sendInstitutionalEmail({
      to: jefe.email,
      subject: bossSubject,
      text: `La solicitud ${solicitud.consecutivo} del colaborador ${solicitante.nombre} fue rechazada por Gestion Humana. Motivo: ${justificacion}`,
      html: bossHtml
    });
  }

  return { userResult, bossResult };
};

const mostrarFormularioRechazo = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'warning',
      title: 'Formulario no habilitado',
      message: 'El flujo de reporte de salida aun no esta activo.',
      nextStep: 'La solicitud no fue procesada. Cuando el administrador habilite nuevamente el formulario, podra usar el enlace correspondiente.'
    });
  }
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'reporte_salida_approve' || !payload?.consecutivo || !payload?.stage) {
      return renderApprovalPage({
        res,
        status: 403,
        tone: 'error',
        title: 'Enlace no autorizado',
        message: 'El enlace de rechazo no corresponde a una solicitud valida.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo institucional.'
      });
    }
    const solicitud = await ReporteSalidaSolicitud.findOne({ where: { consecutivo: payload.consecutivo } });
    if (!solicitud) {
      return renderApprovalPage({
        res,
        status: 404,
        tone: 'warning',
        title: 'Solicitud no encontrada',
        message: 'No se encontro una solicitud asociada a este enlace.',
        nextStep: 'Puede que la solicitud haya sido eliminada.'
      });
    }

    const tokenHash = hashToken(req.params.token);
    if (payload.stage === 'jefe') {
      if (solicitud.estado !== 'pendiente_aprobacion_jefe') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion del jefe.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_jefe_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para esta solicitud.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }
    } else if (payload.stage === 'gestion_humana') {
      if (solicitud.estado !== 'pendiente_aprobacion_gestion_humana') {
        const isAprobada = solicitud.estado === 'finalizada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Gestion Humana.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_gh_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para Gestion Humana.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }
    } else {
      return renderApprovalPage({
        res,
        status: 400,
        tone: 'warning',
        title: 'Etapa no valida',
        message: 'El enlace no indica una etapa reconocida del flujo.',
        solicitud,
        nextStep: 'Use el boton original enviado desde el correo institucional.'
      });
    }

    return renderRejectionFormPage({
      res,
      solicitud,
      token: req.params.token,
      stage: payload.stage
    });
  } catch (error) {
    console.error('Error mostrando formulario de rechazo:', error);
    return renderApprovalPage({
      res,
      status: 500,
      tone: 'error',
      title: 'Error de servidor',
      message: 'Ocurrio un error al cargar el formulario de rechazo.',
      nextStep: 'Intente nuevamente mas tarde.'
    });
  }
};

const procesarRechazo = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'warning',
      title: 'Formulario no habilitado',
      message: 'El flujo de reporte de salida aun no esta activo.',
      nextStep: 'La solicitud no fue procesada.'
    });
  }
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'reporte_salida_approve' || !payload?.consecutivo || !payload?.stage) {
      return renderApprovalPage({
        res,
        status: 403,
        tone: 'error',
        title: 'Enlace no autorizado',
        message: 'El enlace de rechazo no corresponde a una solicitud valida.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo institucional.'
      });
    }
    const solicitud = await ReporteSalidaSolicitud.findOne({ where: { consecutivo: payload.consecutivo } });
    if (!solicitud) {
      return renderApprovalPage({
        res,
        status: 404,
        tone: 'warning',
        title: 'Solicitud no encontrada',
        message: 'No se encontro una solicitud asociada a este enlace.',
        nextStep: 'Puede que la solicitud haya sido eliminada.'
      });
    }

    const tokenHash = hashToken(req.params.token);
    const justificacion = sanitizeText(req.body.justificacion, 800) || 'Sin justificacion especificada.';

    if (payload.stage === 'jefe') {
      if (solicitud.estado !== 'pendiente_aprobacion_jefe') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion del jefe.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_jefe_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para esta solicitud.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }

      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'no_aprobada',
        aprobacion_jefe_token_hash: null,
        trazabilidad: appendTrace(solicitud, 'rechazada_jefe', null, {
          actorName: solicitud.jefe_snapshot?.nombre,
          actorEmail: solicitud.jefe_snapshot?.email,
          justificacion
        })
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_jefe',
          aprobacion_jefe_token_hash: tokenHash
        }
      });

      if (!updatedCount) {
        await solicitud.reload();
        return renderApprovalPage({
          res,
          tone: 'info',
          title: 'Solicitud ya procesada',
          message: 'Esta solicitud ya fue procesada previamente.',
          solicitud,
          nextStep: 'El boton de aprobacion/rechazo ya fue utilizado.'
        });
      }

      await solicitud.reload();
      await sendCollaboratorRejectionEmail({
        solicitud,
        rejectedBy: 'su jefe inmediato',
        justificacion
      });

      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Rechazo registrado',
        message: 'La solicitud ha sido rechazada y se ha notificado al colaborador.',
        solicitud,
        nextStep: 'El colaborador recibira un correo institucional explicando el motivo del rechazo.'
      });

    } else if (payload.stage === 'gestion_humana') {
      if (solicitud.estado !== 'pendiente_aprobacion_gestion_humana') {
        const isAprobada = solicitud.estado === 'finalizada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Gestion Humana.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_gh_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para Gestion Humana.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }

      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'no_aprobada',
        aprobacion_gh_token_hash: null,
        trazabilidad: appendTrace(solicitud, 'rechazada_gestion_humana', null, {
          actorName: 'Gestion Humana',
          justificacion
        })
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_gestion_humana',
          aprobacion_gh_token_hash: tokenHash
        }
      });

      if (!updatedCount) {
        await solicitud.reload();
        return renderApprovalPage({
          res,
          tone: 'info',
          title: 'Solicitud ya procesada',
          message: 'Esta solicitud ya fue procesada previamente.',
          solicitud,
          nextStep: 'El boton de aprobacion/rechazo ya fue utilizado.'
        });
      }

      await solicitud.reload();
      await sendGHRejectionEmails({
        solicitud,
        justificacion
      });

      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Rechazo registrado',
        message: 'La solicitud ha sido rechazada por Gestion Humana.',
        solicitud,
        nextStep: 'Se ha notificado al colaborador y a su jefe inmediato con el motivo correspondiente.'
      });
    }

  } catch (error) {
    console.error('Error procesando rechazo de reporte de salida:', error);
    return renderApprovalPage({
      res,
      status: 500,
      tone: 'error',
      title: 'Error de servidor',
      message: 'Ocurrio un error al registrar el rechazo de la solicitud.',
      nextStep: 'Intente nuevamente mas tarde.'
    });
  }
};

const sendGestionHumanaGroupApprovalEmail = async (solicitudes, token) => {
  const recipients = getReporteSalidaRecipients();
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar-grupo/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar-grupo/${encodeURIComponent(token)}`;
  
  const consecutivoGroup = solicitudes[0].consecutivo.split('-').slice(0, 3).join('-') + '-GRUPO';
  const subject = `REPORTE DE SALIDA GRUPAL ${consecutivoGroup} | Aprobacion Gestion Humana`;

  const mapping = {
    cita_eps: 'Cita medica por EPS',
    cita_particular: 'Cita medica particular',
    urgencia_medica: 'Urgencia Medica',
    diligencia_personal: 'Diligencia personal',
    ponencia: 'Ponencia',
    visita_ies: 'Visita a otras IES',
    capacitacion: 'Capacitacion',
    proyecto_investigacion: 'Proyecto de investigacion',
    asistente_congreso: 'Asistente a congreso',
    practica_academica: 'Practica academica',
    torneo_deportivo: 'Participante en torneo deportivo'
  };
  const getSubtypeLabel = (tipo) => {
    if (!tipo) return '';
    if (mapping[tipo]) return mapping[tipo];
    if (tipo.startsWith('otra:')) return `Otra: ${tipo.substring(5)}`;
    return tipo;
  };

  let tableRows = '';
  for (const sol of solicitudes) {
    const p = sol.datos_formulario?.personal || {};
    const lab = sol.datos_formulario?.laboral || {};
    tableRows += `
      <tr>
        <td style="border:1px solid #dbe6f5;padding:8px;">${escapeHtml(p.nombre)}</td>
        <td style="border:1px solid #dbe6f5;padding:8px;">${escapeHtml(lab.cargo)}</td>
        <td style="border:1px solid #dbe6f5;padding:8px;">${escapeHtml(lab.dependencia)}</td>
        <td style="border:1px solid #dbe6f5;padding:8px;">${escapeHtml(p.correo)}</td>
      </tr>
    `;
  }

  const html = renderInstitutionalTemplate({
    title: 'Aprobacion de Salida Grupal',
    introHtml: `<p>Se ha registrado un reporte de salida grupal con <strong>${solicitudes.length}</strong> participantes.</p>`,
    bodyHtml: `
      <p><strong>Detalles de la salida:</strong></p>
      <ul>
        <li><strong>Tipo de salida:</strong> ${escapeHtml(getSubtypeLabel(solicitudes[0].datos_formulario?.salida?.tipo))}</li>
        <li><strong>Fecha y hora salida:</strong> ${escapeHtml(solicitudes[0].datos_formulario?.salida?.fecha)} a las ${escapeHtml(solicitudes[0].datos_formulario?.salida?.horaInicio)}</li>
        <li><strong>Fecha y hora regreso:</strong> ${escapeHtml(solicitudes[0].datos_formulario?.salida?.fechaRegreso)} a las ${escapeHtml(solicitudes[0].datos_formulario?.salida?.horaFin)}</li>
        <li><strong>Tiempo por persona:</strong> ${escapeHtml(formatMinutes(solicitudes[0].tiempo_solicitado_minutos))}</li>
        <li><strong>Motivo:</strong> ${escapeHtml(solicitudes[0].datos_formulario?.salida?.motivo || 'N/A')}</li>
      </ul>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:13px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="border:1px solid #dbe6f5;padding:8px;text-align:left;">Nombre</th>
            <th style="border:1px solid #dbe6f5;padding:8px;text-align:left;">Cargo</th>
            <th style="border:1px solid #dbe6f5;padding:8px;text-align:left;">Dependencia</th>
            <th style="border:1px solid #dbe6f5;padding:8px;text-align:left;">Correo</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">Aprobar Grupo</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">No aprobar Grupo</a>
      </div>
      <p>Al hacer clic en "Aprobar Grupo", se aprobaran de manera individual los reportes de todos los colaboradores listados y se les enviara a cada uno su respectivo archivo aprobado por correo.</p>
    `
  });

  return sendInstitutionalEmail({
    to: recipients.gestionHumana,
    subject,
    text: `Solicitud de salida grupal con ${solicitudes.length} participantes. Para aprobar ingrese a ${approveUrl}.`,
    html
  });
};

const renderRejectionFormPageGrupo = ({ res, solicitudes, token }) => {
  const consecutivo = solicitudes[0]?.consecutivo.split('-').slice(0, 3).join('-') + '-GRUPO';
  const safeConsecutivo = escapeHtml(consecutivo);
  const safeActionUrl = escapeHtml(`${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar-grupo/${encodeURIComponent(token)}`);
  
  let listItems = '';
  for (const sol of solicitudes) {
    listItems += `<li>${escapeHtml(sol.datos_formulario?.personal?.nombre)} (${escapeHtml(sol.datos_formulario?.personal?.documento)})</li>`;
  }

  return res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Rechazar Grupo | SIAC UNICESMAG</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      --ink: #0f172a;
      --muted: #64748b;
      --line: #dbe6f5;
      --brand: #e11d48;
      --navy: #0b1730;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background:
        radial-gradient(circle at 20% 0%, rgba(225, 29, 72, 0.1), transparent 32%),
        linear-gradient(135deg, #fcf8f8 0%, #fff1f2 48%, #fcf8f8 100%);
      color: var(--ink);
      display: grid;
      place-items: center;
      padding: 28px;
    }
    .shell {
      width: min(760px, 100%);
      background: #fff;
      border: 1px solid var(--line);
      border-radius: 18px;
      box-shadow: 0 24px 70px rgba(15, 23, 42, 0.16);
      overflow: hidden;
    }
    .top {
      padding: 22px 26px;
      background: linear-gradient(90deg, #0b1730, #b91c1c);
      color: #fff;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brandmark {
      width: 46px;
      height: 46px;
      border-radius: 14px;
      background: rgba(255, 255, 255, 0.13);
      border: 1px solid rgba(255, 255, 255, 0.24);
      display: grid;
      place-items: center;
      font-weight: 900;
      letter-spacing: .08em;
    }
    .brand-title { font-weight: 900; font-size: 18px; line-height: 1.15; }
    .brand-subtitle { margin-top: 3px; color: #fecdd3; font-size: 13px; }
    .content { padding: 30px; }
    .status {
      display: flex;
      gap: 18px;
      align-items: flex-start;
    }
    .icon {
      flex: 0 0 auto;
      width: 58px;
      height: 58px;
      border-radius: 18px;
      background: #fff1f2;
      border: 1px solid #fecdd3;
      color: #e11d48;
      display: grid;
      place-items: center;
      font-size: 28px;
      font-weight: 950;
    }
    h1 {
      margin: 0;
      font-size: clamp(24px, 4vw, 34px);
      line-height: 1.08;
      letter-spacing: 0;
    }
    .message {
      margin: 10px 0 0;
      color: #334155;
      font-size: 16px;
      line-height: 1.6;
    }
    .details {
      margin-top: 22px;
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      border: 1px solid var(--line);
      border-radius: 14px;
      overflow: hidden;
      background: #fff8f8;
    }
    .detail {
      padding: 16px;
      border-right: 1px solid var(--line);
      min-width: 0;
    }
    .detail:last-child { border-right: 0; }
    .label {
      color: var(--muted);
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 900;
      letter-spacing: .06em;
    }
    .value {
      margin-top: 7px;
      font-weight: 850;
      color: #0f172a;
      overflow-wrap: anywhere;
    }
    .form-group {
      margin-top: 26px;
    }
    label.field-label {
      display: block;
      font-weight: 900;
      color: #334155;
      font-size: 14px;
      margin-bottom: 8px;
      text-transform: uppercase;
      letter-spacing: .03em;
    }
    textarea {
      width: 100%;
      height: 120px;
      padding: 14px;
      border: 1px solid var(--line);
      border-radius: 12px;
      font-family: inherit;
      font-size: 15px;
      color: var(--ink);
      background: #fcfcfc;
      resize: vertical;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    textarea:focus {
      outline: 0;
      border-color: #e11d48;
      box-shadow: 0 0 0 3px rgba(225, 29, 72, 0.15);
      background: #fff;
    }
    .actions {
      margin-top: 26px;
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      justify-content: flex-end;
    }
    button {
      border: 0;
      border-radius: 12px;
      padding: 12px 24px;
      font-weight: 850;
      font-size: 14px;
      cursor: pointer;
      font-family: inherit;
      transition: transform 0.1s, opacity 0.2s;
    }
    button:active {
      transform: scale(0.98);
    }
    .ghost {
      background: #f1f5f9;
      color: #475569;
    }
    .primary {
      background: var(--brand);
      color: #fff;
      box-shadow: 0 10px 22px rgba(225, 29, 72, .24);
    }
    .participants-list {
      margin-top: 15px;
      padding-left: 20px;
      font-size: 14px;
      color: #334155;
      line-height: 1.5;
    }
    @media (max-width: 640px) {
      body { padding: 14px; }
      .top, .content { padding: 20px; }
      .status { flex-direction: column; }
      .details { grid-template-columns: 1fr; }
      .detail { border-right: 0; border-bottom: 1px solid var(--line); }
      .detail:last-child { border-bottom: 0; }
      .actions { justify-content: stretch; }
      button { width: 100%; text-align: center; }
    }
  </style>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div class="brandmark">SIAC</div>
      <div>
        <div class="brand-title">UNICESMAG</div>
        <div class="brand-subtitle">Reporte de salida | Gestion Humana</div>
      </div>
    </section>
    <section class="content">
      <div class="status">
        <div class="icon">&#10007;</div>
        <div>
          <h1>No aprobar salida grupal</h1>
          <p class="message">Por favor ingrese la justificacion del rechazo. Este motivo sera enviado por correo a todos los participantes del grupo.</p>
        </div>
      </div>
      <div class="details">
        <div class="detail"><div class="label">Grupo</div><div class="value">${safeConsecutivo}</div></div>
        <div class="detail"><div class="label">Participantes</div><div class="value">${solicitudes.length} personas</div></div>
        <div class="detail"><div class="label">Tiempo / pers.</div><div class="value">${escapeHtml(formatMinutes(solicitudes[0].tiempo_solicitado_minutos))}</div></div>
      </div>
      
      <h3 style="margin-top:20px;margin-bottom:5px;font-size:14px;color:#475569;text-transform:uppercase;font-weight:900;letter-spacing:.03em;">Integrantes del grupo:</h3>
      <ul class="participants-list">
        ${listItems}
      </ul>

      <form method="POST" action="${safeActionUrl}">
        <div class="form-group">
          <label class="field-label" for="justificacion">Justificación del Rechazo</label>
          <textarea id="justificacion" name="justificacion" required placeholder="Escriba aqui el motivo por el cual no aprueba esta salida grupal..."></textarea>
        </div>
        <div class="actions">
          <button type="button" class="ghost" onclick="window.location.href='${frontendUrl}';">Volver al sistema</button>
          <button type="submit" class="primary">Enviar Rechazo</button>
        </div>
      </form>
    </section>
  </main>
</body>
</html>`);
};

const aprobarGrupoDesdeCorreo = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'warning',
      title: 'Formulario no habilitado',
      message: 'El flujo de reporte de salida aun no esta activo.',
      nextStep: 'La solicitud no fue procesada.'
    });
  }
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'reporte_salida_approve_grupo' || !payload?.grupo_id) {
      return renderApprovalPage({
        res,
        status: 403,
        tone: 'error',
        title: 'Enlace no autorizado',
        message: 'El enlace de aprobacion no corresponde a un grupo valido.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo institucional.'
      });
    }

    const { grupo_id } = payload;
    const tokenHash = hashToken(req.params.token);

    const solicitudes = await ReporteSalidaSolicitud.findAll({
      where: {
        datos_formulario: {
          [Op.contains]: {
            grupo_id
          }
        }
      }
    });

    if (!solicitudes.length) {
      return renderApprovalPage({
        res,
        status: 404,
        tone: 'warning',
        title: 'Grupo no encontrado',
        message: 'No se encontraron solicitudes asociadas a este grupo.',
        nextStep: 'Puede que las solicitudes hayan sido eliminadas.'
      });
    }

    const pendientes = solicitudes.filter(s => s.estado === 'pendiente_aprobacion_gestion_humana');
    if (!pendientes.length) {
      return renderApprovalPage({
        res,
        tone: 'info',
        title: 'Grupo ya procesado',
        message: 'Esta aprobacion de grupo ya fue registrada previamente.',
        nextStep: 'No es necesario realizar ninguna accion adicional.'
      });
    }

    let approvedCount = 0;
    for (const solicitud of pendientes) {
      if (solicitud.aprobacion_gh_token_hash === tokenHash) {
        await ReporteSalidaSolicitud.update({
          estado: 'finalizada',
          gestion_humana_aprobado_at: new Date(),
          finalizado_at: new Date(),
          aprobacion_gh_token_hash: null,
          trazabilidad: appendTrace(solicitud, 'aprobada_gestion_humana', null)
        }, {
          where: {
            id: solicitud.id,
            estado: 'pendiente_aprobacion_gestion_humana',
            aprobacion_gh_token_hash: tokenHash
          }
        });
        
        approvedCount++;

        await solicitud.reload();
        solicitud.trazabilidad = appendTrace(solicitud, 'notificacion_final_enviada', null, { usuario: true, sst: true });
        try {
          const attachments = await buildReporteSalidaAttachments(solicitud);
          const results = await sendFinalEmails(solicitud, attachments);
          await solicitud.update({
            correo_usuario_enviado_at: results.userResult.success ? new Date() : null,
            correo_sst_enviado_at: results.sstResult.success ? new Date() : null,
            enviado_sst_at: results.sstResult.success ? new Date() : null,
            trazabilidad: appendTrace(solicitud, 'notificacion_final_enviada', null, {
              usuario: results.userResult.success,
              sst: results.sstResult.success
            })
          });
        } catch (err) {
          console.error(`Error enviando notificaciones finales para solicitud ${solicitud.consecutivo}:`, err);
        }
      }
    }

    return renderApprovalPage({
      res,
      tone: 'success',
      title: 'Aprobacion de Grupo registrada',
      message: `Se aprobo exitosamente el reporte de salida para ${approvedCount} participantes de manera individual.`,
      nextStep: 'A cada participante se le ha enviado su respectivo formato PDF y soporte editable por correo.'
    });

  } catch (error) {
    console.error('Error aprobando grupo desde correo:', error);
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'error',
      title: 'Enlace vencido o invalido',
      message: 'No fue posible procesar la aprobacion del grupo.',
      nextStep: 'Solicite un nuevo enlace de aprobacion.'
    });
  }
};

const mostrarFormularioRechazoGrupo = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'warning',
      title: 'Formulario no habilitado',
      message: 'El flujo de reporte de salida aun no esta activo.',
      nextStep: 'La solicitud no fue procesada.'
    });
  }
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'reporte_salida_approve_grupo' || !payload?.grupo_id) {
      return renderApprovalPage({
        res,
        status: 403,
        tone: 'error',
        title: 'Enlace no autorizado',
        message: 'El enlace de rechazo no corresponde a un grupo valido.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo institucional.'
      });
    }

    const { grupo_id } = payload;
    const tokenHash = hashToken(req.params.token);

    const solicitudes = await ReporteSalidaSolicitud.findAll({
      where: {
        datos_formulario: {
          [Op.contains]: {
            grupo_id
          }
        }
      }
    });

    if (!solicitudes.length) {
      return renderApprovalPage({
        res,
        status: 404,
        tone: 'warning',
        title: 'Grupo no encontrado',
        message: 'No se encontro una solicitud asociada a este enlace.',
        nextStep: 'Puede que la solicitud haya sido eliminada.'
      });
    }

    const pendientes = solicitudes.filter(s => s.estado === 'pendiente_aprobacion_gestion_humana');
    if (!pendientes.length) {
      return renderApprovalPage({
        res,
        tone: 'info',
        title: 'Grupo ya procesado',
        message: 'Este grupo ya no se encuentra pendiente de aprobacion de Gestion Humana.',
        nextStep: 'No es necesario realizar ninguna accion adicional.'
      });
    }

    return renderRejectionFormPageGrupo({
      res,
      solicitudes: pendientes,
      token: req.params.token
    });
  } catch (error) {
    console.error('Error mostrando formulario de rechazo de grupo:', error);
    return renderApprovalPage({
      res,
      status: 500,
      tone: 'error',
      title: 'Error de servidor',
      message: 'Ocurrio un error al cargar el formulario de rechazo de grupo.',
      nextStep: 'Intente nuevamente mas tarde.'
    });
  }
};

const procesarRechazoGrupo = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) {
    return renderApprovalPage({
      res,
      status: 403,
      tone: 'warning',
      title: 'Formulario no habilitado',
      message: 'El flujo de reporte de salida aun no esta activo.',
      nextStep: 'La solicitud no fue procesada.'
    });
  }
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'reporte_salida_approve_grupo' || !payload?.grupo_id) {
      return renderApprovalPage({
        res,
        status: 403,
        tone: 'error',
        title: 'Enlace no autorizado',
        message: 'El enlace de rechazo no corresponde a un grupo valido.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo institucional.'
      });
    }

    const { grupo_id } = payload;
    const tokenHash = hashToken(req.params.token);
    const justificacion = sanitizeText(req.body.justificacion, 800) || 'Sin justificacion especificada.';

    const solicitudes = await ReporteSalidaSolicitud.findAll({
      where: {
        datos_formulario: {
          [Op.contains]: {
            grupo_id
          }
        }
      }
    });

    if (!solicitudes.length) {
      return renderApprovalPage({
        res,
        status: 404,
        tone: 'warning',
        title: 'Grupo no encontrado',
        message: 'No se encontraron solicitudes asociadas a este grupo.',
        nextStep: 'Puede que las solicitudes hayan sido eliminadas.'
      });
    }

    const pendientes = solicitudes.filter(s => s.estado === 'pendiente_aprobacion_gestion_humana');
    if (!pendientes.length) {
      return renderApprovalPage({
        res,
        tone: 'info',
        title: 'Grupo ya procesado',
        message: 'Esta solicitud de grupo ya fue procesada previamente.',
        nextStep: 'El boton de aprobacion/rechazo ya fue utilizado.'
      });
    }

    let rejectedCount = 0;
    for (const solicitud of pendientes) {
      if (solicitud.aprobacion_gh_token_hash === tokenHash) {
        await ReporteSalidaSolicitud.update({
          estado: 'no_aprobada',
          aprobacion_gh_token_hash: null,
          trazabilidad: appendTrace(solicitud, 'rechazada_gestion_humana', null, {
            actorName: 'Gestion Humana',
            justificacion
          })
        }, {
          where: {
            id: solicitud.id,
            estado: 'pendiente_aprobacion_gestion_humana',
            aprobacion_gh_token_hash: tokenHash
          }
        });

        rejectedCount++;
        
        await solicitud.reload();
        try {
          const solicitante = solicitud.solicitante_snapshot || {};
          const userSubject = `REPORTE DE SALIDA GRUPAL ${solicitud.consecutivo} | Solicitud no aprobada por Gestion Humana`;
          const userHtml = renderInstitutionalTemplate({
            title: 'Reporte de salida grupal no aprobado por Gestion Humana',
            introHtml: `<p>Cordial saludo, <strong>${escapeHtml(solicitante.nombre)}</strong>.</p><p>Le informamos que la solicitud de reporte de salida grupal en la que participaba fue rechazada por <strong>Gestion Humana</strong>.</p>`,
            bodyHtml: `
              <p><strong>Solicitud:</strong> ${escapeHtml(solicitud.consecutivo)}</p>
              <p><strong>Motivo / Justificacion del rechazo:</strong></p>
              <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
                ${escapeHtml(justificacion)}
              </div>
              <p>Consulte mas informacion en el modulo de Seguimiento a reportes del sistema SIAC.</p>
            `
          });

          await sendInstitutionalEmail({
            to: solicitante.email,
            subject: userSubject,
            text: `Su solicitud de salida grupal ${solicitud.consecutivo} fue rechazada por Gestion Humana. Motivo: ${justificacion}`,
            html: userHtml
          });
        } catch (err) {
          console.error(`Error enviando email de rechazo a participante de solicitud ${solicitud.consecutivo}:`, err);
        }
      }
    }

    return renderApprovalPage({
      res,
      tone: 'success',
      title: 'Rechazo de Grupo registrado',
      message: `Se registro el rechazo para ${rejectedCount} solicitudes del grupo por Gestion Humana.`,
      nextStep: 'Se ha notificado a cada uno de los colaboradores por correo institucional con el motivo correspondiente.'
    });

  } catch (error) {
    console.error('Error procesando rechazo de grupo:', error);
    return renderApprovalPage({
      res,
      status: 500,
      tone: 'error',
      title: 'Error de servidor',
      message: 'Ocurrio un error al registrar el rechazo de la solicitud grupal.',
      nextStep: 'Intente nuevamente mas tarde.'
    });
  }
};

const getReposicionesPropias = async (req, res) => {
  try {
    const solicitudes = await ReporteSalidaSolicitud.findAll({
      where: {
        user_id: req.user.id,
        reposicion_aplica: true
      },
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: solicitudes.map(serializeSolicitud) });
  } catch (error) {
    console.error('Error in getReposicionesPropias:', error);
    res.status(500).json({ success: false, message: 'Error al consultar reposiciones propias' });
  }
};

const getReposicionesEquipo = async (req, res) => {
  try {
    const rolesPrivilegiados = ['administrador', 'gestion_informacion', 'planeacion_estrategica'];
    const tienePrivilegio = rolesPrivilegiados.includes(req.user.role) || (req.user.menuPermissions || []).includes('seguimiento_reportes_rrhh');
    
    const whereClause = { reposicion_aplica: true };
    if (!tienePrivilegio) {
      whereClause.jefe_inmediato_user_id = req.user.id;
    }

    const solicitudes = await ReporteSalidaSolicitud.findAll({
      where: whereClause,
      order: [['created_at', 'DESC']]
    });
    res.json({ success: true, data: solicitudes.map(serializeSolicitud) });
  } catch (error) {
    console.error('Error in getReposicionesEquipo:', error);
    res.status(500).json({ success: false, message: 'Error al consultar reposiciones del equipo' });
  }
};

const verificarReportePublico = async (req, res) => {
  try {
    const searchId = req.params.id;
    let solicitud = null;

    if (searchId.length === 36 && searchId.includes('-')) {
      solicitud = await ReporteSalidaSolicitud.findOne({
        where: {
          datos_formulario: {
            [Op.contains]: { tx_id: searchId }
          }
        }
      });
    }

    if (!solicitud) {
      solicitud = await ReporteSalidaSolicitud.findOne({
        where: {
          [Op.or]: [
            { id: isNaN(searchId) ? 0 : Number(searchId) },
            { consecutivo: searchId }
          ]
        }
      });
    }

    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'El reporte no existe o fue eliminado.' });
    }

    let solicitante = solicitud.solicitante_snapshot;
    if (typeof solicitante === 'string') {
      try { solicitante = JSON.parse(solicitante); } catch (e) { solicitante = {}; }
    }
    const nombre = solicitante?.nombre || 'Desconocido';
    const documento = solicitante?.documento || solicitante?.username || 'Desconocido';

    return res.json({
      success: true,
      data: {
        id: solicitud.id,
        tx_id: solicitud.datos_formulario?.tx_id || '',
        consecutivo: solicitud.consecutivo,
        createdAt: solicitud.createdAt,
        estado: solicitud.estado,
        solicitante: {
          nombre,
          documento,
          cargo: solicitud.datos_formulario?.laboral?.cargo || 'No especificado',
          dependencia: solicitud.datos_formulario?.laboral?.dependencia || 'No especificada'
        },
        jefe_aprobado_at: solicitud.jefe_aprobado_at,
        gestion_humana_aprobado_at: solicitud.gestion_humana_aprobado_at
      }
    });
  } catch (error) {
    console.error('Error en verificarReportePublico:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor.' });
  }
};

module.exports = {
  aprobarDesdeCorreo,
  mostrarFormularioRechazo,
  procesarRechazo,
  aprobarGrupoDesdeCorreo,
  mostrarFormularioRechazoGrupo,
  procesarRechazoGrupo,
  actualizarReposicion,
  getCatalogoLaboral,
  getFeatureConfig,
  getSeguimientoBadge,
  getSeguimientoPersonal,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig,
  getReposicionesPropias,
  getReposicionesEquipo,
  eliminarSolicitud,
  editarSolicitudAdmin,
  verificarReportePublico
};
