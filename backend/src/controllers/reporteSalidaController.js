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
const { getDependencyEmail } = require('../config/dependencyEmails');
const { ROLES } = require('../constants/roles');

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const publicBackendUrl = process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL || frontendUrl;
const ACADEMIC_VICERRECTORIA_EMAIL = getDependencyEmail('Vicerrectoria Academica') || 'viceacad@unicesmag.edu.co';
const RECTORIA_EMAIL = getDependencyEmail('Rectoria') || 'rectoria@unicesmag.edu.co';
const DEFAULT_DECLARACION_SIN_ADJUNTO_SALUD = 'Declaro que al momento de radicar esta solicitud no cuento con archivos adjuntos o soportes para cargar en el sistema. Entiendo que la Oficina de Gestion del Talento Humano y/o Seguridad y Salud en el Trabajo podran requerir en cualquier momento los soportes correspondientes; por tanto, me comprometo a conservarlos despues de la atencion o tramite y a suministrarlos oportunamente cuando sean solicitados.';

const featureDisabled = (res) =>
  res.status(403).json({ success: false, message: 'El formulario de reporte de salida aun no esta habilitado.' });

const isAdminUser = (user) => String(user?.role || '') === 'administrador';
const SEGUIMIENTO_REPORTE_ROLES = [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA];
const REPOSICION_PENDIENTE_ESTADOS = ['pendiente', 'programada', 'incumplida'];

const hashToken = (token) => crypto.createHash('sha256').update(String(token || '')).digest('hex');

const sanitizeText = (value, max = 250) => String(value || '').trim().slice(0, max);

const formatDateOnly = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split('-');
  return year && month && day ? `${day}/${month}/${year}` : text;
};

const formatHourAmPm = (value) => {
  if (!value) return '';
  const match = String(value).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return String(value).trim();
  let hour = Number(match[1]);
  const minutes = match[2];
  if (!Number.isFinite(hour)) return String(value).trim();
  const suffix = hour >= 12 ? 'p. m.' : 'a. m.';
  hour %= 12;
  if (hour === 0) hour = 12;
  return `${hour}:${minutes} ${suffix}`;
};

const cleanDependenciaLabel = (value) =>
  sanitizeText(value, 400)
    .replace(/^[A-Z]{0,3}\d+[_\-\s]+/i, '')
    .replace(/\s+/g, ' ')
    .trim();

const hasDependenciaCode = (value) => /^[A-Z]{0,3}\d+[_\-\s]+/i.test(sanitizeText(value, 400));

const looksLikeInstitutionalDependencia = (value) => {
  const text = cleanDependenciaLabel(value).toLowerCase();
  if (!text || text.length < 4) return false;
  if (/\b(acta|actas|revision|revisiÃ³n|micro|curriculo|currÃ­culo|actividad|actividades|indicador|indicadores|meta|metas|proyecto|programacion|programaciÃ³n)\b/i.test(text)) {
    return false;
  }
  return /\b(departamento|vicerrectoria|vicerrectorÃ­a|direccion|direcciÃ³n|oficina|facultad|programa|centro|unidad|rectoria|rectorÃ­a|biblioteca|bienestar|juridica|jurÃ­dica|finanzas|admisiones|registro|planeacion|planeaciÃ³n|aseguramiento|talento|gestion humana|gestiÃ³n humana|gestion del talento humano|gestiÃ³n del talento humano|talento humano)\b/i.test(text);
};

const isDependenciaOption = (value) => hasDependenciaCode(value) || looksLikeInstitutionalDependencia(value);

const normalizeForMatch = (val) => String(val || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9\s]/gi, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toLowerCase();

const isDocenteCargo = (value) => /\bdocente\b/.test(normalizeForMatch(value));

const isVicerrectoriaAcademica = (value) => {
  const normalized = normalizeForMatch(value);
  return normalized.includes('vicerrectoria academica') || normalized.includes('vicerectoria academica');
};

const VICERRECTORIA_CANONICAL_NAMES = [
  'Vicerrectoria Academica',
  'Vicerrectoria de Investigacion y Extension',
  'Vicerrectoria Financiera y de Desarrollo Institucional',
  'VicerrectorÃ­a para la Evangelizacion de las Culturas'
];

const canonicalVicerrectoriaName = (value) => {
  const normalized = normalizeForMatch(value);
  if (!normalized) return '';
  if (normalized.includes('rectoria') && !normalized.includes('vicerrectoria') && !normalized.includes('vicerectoria')) return 'Rectoria';
  return VICERRECTORIA_CANONICAL_NAMES.find((name) => normalizeForMatch(name) === normalized) || sanitizeText(value, 220);
};

const isRectoriaAuthority = (value) => canonicalVicerrectoriaName(value) === 'Rectoria';

const normalizeDocument = (value) => String(value || '').replace(/\D/g, '');
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const sameEmail = (left, right) => {
  const a = normalizeEmail(left);
  const b = normalizeEmail(right);
  if (!a || !b) return false;
  if (a === b) return true;

  const mapping = {
    'sbolanos@unicesmag.edu.co': 'viceacad@unicesmag.edu.co',
    'jajimenez@unicesmag.edu.co': 'viceinvestiga@unicesmag.edu.co',
    'jcnandar@unicesmag.edu.co': 'viceadfin@unicesmag.edu.co',
    'mpagreda@unicesmag.edu.co': 'vicebien@unicesmag.edu.co'
  };

  if (mapping[a] === b || mapping[b] === a) return true;
  return false;
};

const AUTHORITY_RECIPIENTS = {
  Rectoria: {
    nombre: process.env.REPORTE_SALIDA_RECTORIA_NOMBRE || 'LUIS EDUARDO RUBIANO GUAQUETA',
    cargo: process.env.REPORTE_SALIDA_RECTORIA_CARGO || 'Rector',
    email: RECTORIA_EMAIL,
    aliases: ['rectoria@unicesmag.edu.co']
  },
  'Vicerrectoria Academica': {
    nombre: process.env.REPORTE_SALIDA_VICERRECTORIA_ACADEMICA_NOMBRE || 'SANDRA LUCIA BOLAÃƒâ€˜OS DELGADO',
    cargo: process.env.REPORTE_SALIDA_VICERRECTORIA_ACADEMICA_CARGO || 'Vicerrectora AcadÃ©mica',
    email: getDependencyEmail('Vicerrectoria Academica') || ACADEMIC_VICERRECTORIA_EMAIL,
    aliases: ['viceacad@unicesmag.edu.co', 'sbolanos@unicesmag.edu.co']
  },
  'Vicerrectoria de Investigacion y Extension': {
    nombre: process.env.REPORTE_SALIDA_VICERRECTORIA_INVESTIGACION_NOMBRE || 'JAVIER ALEJANDRO JIMENEZ TOLEDO',
    cargo: process.env.REPORTE_SALIDA_VICERRECTORIA_INVESTIGACION_CARGO || 'Vicerrector de InvestigaciÃ³n y ExtensiÃ³n',
    email: getDependencyEmail('Vicerrectoria de Investigacion y Extension') || 'viceinvestiga@unicesmag.edu.co',
    aliases: ['viceinvestiga@unicesmag.edu.co', 'jajimenez@unicesmag.edu.co']
  },
  'Vicerrectoria Financiera y de Desarrollo Institucional': {
    nombre: process.env.REPORTE_SALIDA_VICERRECTORIA_FINANCIERA_NOMBRE || 'JUAN CARLOS NANDAR LÃƒâ€œPEZ',
    cargo: process.env.REPORTE_SALIDA_VICERRECTORIA_FINANCIERA_CARGO || 'Vicerrector Financiero y de Desarrollo Institucional',
    email: getDependencyEmail('Vicerrectoria Financiera y de Desarrollo Institucional') || 'viceadfin@unicesmag.edu.co',
    aliases: ['viceadfin@unicesmag.edu.co', 'jcnandar@unicesmag.edu.co']
  },
  'VicerrectorÃ­a para la Evangelizacion de las Culturas': {
    nombre: process.env.REPORTE_SALIDA_VICERRECTORIA_EVANGELIZACION_NOMBRE || 'MARIA DEL PILAR AGREDA GUERRERO',
    cargo: process.env.REPORTE_SALIDA_VICERRECTORIA_EVANGELIZACION_CARGO || 'Vicerrectora para la EvangelizaciÃ³n de las Culturas',
    email: getDependencyEmail('Vicerrectoria para la Evangelizacion de las Culturas') || 'vicebien@unicesmag.edu.co',
    aliases: ['vicebien@unicesmag.edu.co', 'mpagreda@unicesmag.edu.co']
  }
};

const getAuthorityRecipient = async (authorityName, fallbackEmail = '') => {
  const canonicalName = canonicalVicerrectoriaName(authorityName);
  const entry = AUTHORITY_RECIPIENTS[canonicalName] || null;
  const emails = Array.from(new Set([
    normalizeEmail(fallbackEmail),
    normalizeEmail(entry?.email),
    ...(entry?.aliases || []).map(normalizeEmail)
  ].filter(Boolean)));

  let userRow = null;
  if (emails.length) {
    userRow = await User.findOne({
      where: { email: { [Op.in]: emails } },
      attributes: ['nombre', 'email', 'cargo'],
      raw: true
    });
  }

  return {
    nombre: sanitizeText(userRow?.nombre || entry?.nombre || authorityName, 255).toUpperCase(),
    cargo: sanitizeText(userRow?.cargo || entry?.cargo || authorityName, 255),
    email: sanitizeText(entry?.email || fallbackEmail || userRow?.email || '', 255)
  };
};

const getOfficialAuthorityEmailForActor = (actor = {}) => {
  const email = normalizeEmail(actor.email);
  if (!email) return '';
  const entry = Object.values(AUTHORITY_RECIPIENTS).find((authority) => {
    const authorityEmails = [authority.email, ...(authority.aliases || [])].map(normalizeEmail);
    return authorityEmails.includes(email);
  });
  return entry?.email || actor.email || '';
};

const getInitialApprovalRecipientEmail = (solicitud = {}) =>
  getOfficialAuthorityEmailForActor(solicitud.jefe_snapshot || {}) || solicitud.jefe_snapshot?.email || '';

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

const findBestUserMatch = (users, target) => {
  if (!target) return null;
  const targetNorm = normalizeForMatch(target);
  if (!targetNorm) return null;

  // 1. Exact match by name
  let match = users.find((u) => normalizeForMatch(u.nombre) === targetNorm);
  if (match) return match;

  // 2. Exact match by cargo
  match = users.find((u) => normalizeForMatch(u.cargo) === targetNorm);
  if (match) return match;

  // 3. Token-based ranking match
  const targetTokens = tokenizeName(targetNorm);
  if (!targetTokens.length) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const user of users) {
    const nameTokens = tokenizeName(user.nombre);
    if (nameTokens.length) {
      const commonNameTokens = nameTokens.filter(t => targetTokens.includes(t)).length;
      const minRequired = Math.min(2, targetTokens.length);
      if (commonNameTokens >= minRequired && commonNameTokens > bestScore) {
        bestScore = commonNameTokens;
        bestMatch = user;
      }
    }

    const cargoTokens = tokenizeName(user.cargo);
    if (cargoTokens.length) {
      const commonCargoTokens = cargoTokens.filter(t => targetTokens.includes(t)).length;
      const minRequired = Math.min(2, targetTokens.length);
      if (commonCargoTokens >= minRequired && commonCargoTokens > bestScore) {
        bestScore = commonCargoTokens;
        bestMatch = user;
      }
    }
  }

  return bestMatch;
};

const findBestRhMatch = (rhRows, target) => {
  if (!target) return null;
  const targetNorm = normalizeForMatch(target);
  if (!targetNorm) return null;

  // 1. Exact match by name
  let match = rhRows.find((r) => normalizeForMatch(r.nombre_empleado) === targetNorm);
  if (match) return match;

  // 2. Exact match by cargo
  match = rhRows.find((r) => normalizeForMatch(r.cargo_especifico) === targetNorm);
  if (match) return match;

  // 3. Token-based ranking match
  const targetTokens = tokenizeName(targetNorm);
  if (!targetTokens.length) return null;

  let bestMatch = null;
  let bestScore = 0;

  for (const row of rhRows) {
    const nameTokens = tokenizeName(row.nombre_empleado);
    if (nameTokens.length) {
      const commonNameTokens = nameTokens.filter(t => targetTokens.includes(t)).length;
      const minRequired = Math.min(2, targetTokens.length);
      if (commonNameTokens >= minRequired && commonNameTokens > bestScore) {
        bestScore = commonNameTokens;
        bestMatch = row;
      }
    }

    const cargoTokens = tokenizeName(row.cargo_especifico);
    if (cargoTokens.length) {
      const commonCargoTokens = cargoTokens.filter(t => targetTokens.includes(t)).length;
      const minRequired = Math.min(2, targetTokens.length);
      if (commonCargoTokens >= minRequired && commonCargoTokens > bestScore) {
        bestScore = commonCargoTokens;
        bestMatch = row;
      }
    }
  }

  return bestMatch;
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
    'correo electrÃ³nico',
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
      const user = (doc && users.find((candidate) => normalizeDocument(candidate.username) === doc)) ||
                   findBestUserMatch(users, row.nombre_empleado);
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
  vicerrectoria: sanitizeText(user.vicerrectoria, 220),
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
    attributes: ['id', 'nombre', 'email', 'username', 'role', 'dependencia', 'vicerrectoria', 'cargo', 'jefe_inmediato'],
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
    const matchedUser = findBestUserMatch(rows, jefeNombre);
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

const formatTimeAmPmLabel = (time24) => {
  if (!time24) return '';
  const [hStr, mStr] = String(time24).split(':');
  const h = parseInt(hStr, 10);
  if (Number.isNaN(h)) return String(time24);
  const ampm = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mStr || '00'} ${ampm}`;
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
  return diffElapsedMinutes(startDate, endDate, startTime, endTime);
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

const countBusinessDays = (startDate, endDate) => {
  const fromDate = parseDateOnly(startDate);
  const toDate = parseDateOnly(endDate || startDate);
  if (!fromDate || !toDate || toDate < fromDate) return null;
  let count = 0;
  let current = new Date(fromDate);
  while (current <= toDate) {
    if (isBusinessDay(current)) count += 1;
    current = addDays(current, 1);
  }
  return count;
};

const buildSnapshot = (user) => ({
  id: user.id,
  nombre: user.nombre,
  email: user.email,
  username: user.username,
  role: user.role,
  dependencia: cleanDependenciaLabel(user.dependencia),
  vicerrectoria: sanitizeText(user.vicerrectoria, 220),
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

const getSolicitudLaboral = (solicitud = {}) => solicitud.datos_formulario?.laboral || {};
const getSolicitudSalida = (solicitud = {}) => solicitud.datos_formulario?.salida || {};

const getSolicitudVicerrectoria = (solicitud = {}) => {
  const laboral = getSolicitudLaboral(solicitud);
  const solicitante = solicitud.solicitante_snapshot || {};
  return canonicalVicerrectoriaName(laboral.vicerrectoria || solicitante.vicerrectoria || '');
};

const isAcademicTeacherSolicitud = (solicitud = {}) => {
  const laboral = getSolicitudLaboral(solicitud);
  const solicitante = solicitud.solicitante_snapshot || {};
  const cargo = laboral.cargo || solicitante.cargo || '';
  return isDocenteCargo(cargo) && isVicerrectoriaAcademica(getSolicitudVicerrectoria(solicitud));
};

const isOficioSolicitud = (solicitud = {}) => {
  const duracionTipo = getSolicitudSalida(solicitud).duracionTipo;
  return Boolean(duracionTipo && duracionTipo !== 'menos_media_jornada');
};

const isPermisoElectoralSinVicerrectoria = (solicitud = {}) => {
  const tipo = getSolicitudSalida(solicitud).tipo;
  return ['jurado_votacion', 'voto_jurado', 'sufragante', 'voto_sufragante'].includes(tipo);
};

const getAuthorityAfterBoss = (solicitud = {}) => {
  if (!isOficioSolicitud(solicitud)) return null;
  if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;
  if (getSolicitudSalida(solicitud).duracionTipo === '3_mas_dias' && isRectoriaAuthority(getSolicitudVicerrectoria(solicitud))) {
    return null;
  }
  const vicerrectoriaName = getSolicitudVicerrectoria(solicitud);
  if (isRectoriaAuthority(vicerrectoriaName)) {
    return {
      stage: 'rectoria',
      estado: 'pendiente_aprobacion_rectoria',
      tokenColumn: 'aprobacion_rectoria_token_hash',
      correoColumn: 'correo_rectoria_enviado_at',
      name: 'Rectoria',
      email: RECTORIA_EMAIL,
      label: 'Rectoria'
    };
  }
  if (vicerrectoriaName) {
    return {
      stage: 'vicerrectoria_academica',
      estado: 'pendiente_aprobacion_vicerrectoria_academica',
      tokenColumn: 'aprobacion_vicerrectoria_token_hash',
      correoColumn: 'correo_vicerrectoria_enviado_at',
      name: vicerrectoriaName,
      email: getDependencyEmail(vicerrectoriaName) || ACADEMIC_VICERRECTORIA_EMAIL,
      label: vicerrectoriaName
    };
  }
  return null;
};

const requiresRectoriaApproval = () => false;

const requiresSstApproval = (solicitud = {}) => {
  const salida = getSolicitudSalida(solicitud);
  const categoria = salida.categoria || salida.category;
  return categoria === 'propias_cargo' && salida.tipo !== 'salida_campus' && ['Nacional', 'Internacional'].includes(salida.alcance);
};

const createApprovalToken = (stage, consecutivo) =>
  encryptPayload({ purpose: 'reporte_salida_approve', stage, consecutivo }, null);

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
      module_key: 'recurso_humano_seguimiento'
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
  const getEstadoLabel = (est) => {
    switch (est) {
      case 'pendiente_aprobacion_jefe':
        return 'pendiente aprobacion jefe inmediato';
      case 'aprobada_jefe':
        return 'aprobado por jefe inmediato';
      case 'pendiente_aprobacion_gestion_humana':
        return 'pendiente aprobacion gestion del talento humano';
      case 'aprobada_gestion_humana':
        return 'aprobado por gestion del talento humano';
      case 'pendiente_aprobacion_sst':
        return 'pendiente aprobacion sst';
      case 'aprobada_sst':
        return 'aprobado por sst';
      case 'finalizada':
        return 'finalizada';
      case 'no_aprobada':
        return 'no aprobada';
      default:
        return est.replace(/_/g, ' ');
    }
  };
  const safeEstado = escapeHtml(getEstadoLabel(estado));
  const safeActionUrl = escapeHtml(actionUrl);
  const safeActionLabel = escapeHtml(actionLabel);

  res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline';");
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
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
    .close-alert {
      display: none;
      margin-top: 20px;
      padding: 14px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 12px;
      color: #1e3a8a;
      font-size: 13.5px;
      text-align: center;
      line-height: 1.5;
      font-weight: 500;
      box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);
    }
  </style>
  <script>
    function closeWindow() {
      // 1. Mostrar el aviso de cierre inmediatamente
      const msgEl = document.getElementById('close-msg');
      if (msgEl) {
        msgEl.style.display = 'block';
      }
      
      // 2. Intentar cerrar la pestaÃ±a directamente
      try {
        window.close();
      } catch (e) {
        console.log('Error window.close:', e);
      }
      
      try {
        var win = window.open('', '_self', '');
        if (win) win.close();
      } catch (e) {
        console.log('Error window.open.close:', e);
      }
    }
  </script>
</head>
<body>
  <main class="shell">
    <section class="top">
      <div class="brandmark">SIAC</div>
      <div>
        <div class="brand-title">UNICESMAG</div>
        <div class="brand-subtitle">Reporte de salida | Gestion del Talento Humano</div>
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
        <button class="primary" type="button" onclick="closeWindow()">Cerrar ventana</button>
      </div>
      <div id="close-msg" class="close-alert">
        ${tone === 'success' 
          ? '<strong>Ã‚Â¡Listo!</strong> La transacciÃ³n fue registrada. Ya puedes cerrar esta pestaÃ±a de forma segura usando la <strong>X</strong> de tu navegador.' 
          : 'Ya puedes cerrar esta pestaÃ±a de forma segura usando la <strong>X</strong> de tu navegador.'}
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
    return 'Debe especificar el motivo para la opcion "Otra, Ã‚Â¿Cual?".';
  }
  if (salida.tipo === 'terapias') {
    if (!salida.terapiasList || salida.terapiasList.length === 0) return 'Debe indicar al menos una terapia y completarla.';
    for (let i = 0; i < salida.terapiasList.length; i++) {
      const t = salida.terapiasList[i];
      if (!t.fecha || !t.horaInicio || !t.horaFin) return `Complete fecha, hora inicio y hora fin para la terapia #${i + 1}.`;
    }
  } else {
    const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
    if (isSaludNoTerapias) {
      if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio) {
        return 'Debe indicar fecha de salida, fecha de regreso y hora de salida.';
      }
    } else {
      if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio || !salida.horaFin) {
        return 'Debe indicar fecha de salida, hora de salida, fecha de regreso y hora de regreso.';
      }
    }
  }

  if (['jurado_votacion', 'sufragante'].includes(salida.tipo) && salida.duracionTipo !== 'menos_media_jornada') {
    return 'Los permisos electorales (jurado de votaciÃ³n y sufragante) solo pueden registrarse con duraciÃ³n de hasta media jornada.';
  }

  if (salida.tipo === 'entierro_companero' && salida.duracionTipo !== 'menos_media_jornada') {
    return 'El permiso por entierro de companeras/os de trabajo solo puede registrarse con duracion de hasta media jornada.';
  }

  if (salida.tipo === 'obligaciones_escolares' && salida.duracionTipo !== 'menos_media_jornada') {
    return 'El permiso por asistencia a obligaciones escolares solo puede registrarse con duracion de hasta media jornada.';
  }

  let requestedMinutes = 0;
  if (salida.tipo === 'terapias') {
    requestedMinutes = (salida.terapiasList || []).reduce((acc, t) => acc + (diffBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0), 0);
  } else {
    const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
    requestedMinutes = isSaludNoTerapias
      ? (salida.horaFin ? diffElapsedMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin) : 0)
      : diffBusinessMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin);
  }
  const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
  const isHoraFinOptional = isSaludNoTerapias && !salida.horaFin;

  if (!isHoraFinOptional && !requestedMinutes) {
    if (salida.fecha === salida.fechaRegreso && salida.horaInicio && salida.horaFin) {
      return `La hora de regreso (${formatTimeAmPmLabel(salida.horaFin)}) debe ser posterior a la hora de salida (${formatTimeAmPmLabel(salida.horaInicio)}). Seleccione una hora mayor.`;
    }
    return 'El rango de salida no es valido. Revise que la fecha y hora final sean posteriores a la inicial.';
  }

  const bodyReposicionMinutos = parseInt(payload?.reposicion_minutos, 10);
  const reposicionMinutosVal = isNaN(bodyReposicionMinutos) ? 0 : bodyReposicionMinutos;
  if (reposicionMinutosVal > 0) {
    const hasReposicionPlan = Boolean(reposicion.fecha || reposicion.fechaFin || reposicion.horaInicio || reposicion.horaFin);
    if (hasReposicionPlan && (!reposicion.fecha || !reposicion.fechaFin || !reposicion.horaInicio || !reposicion.horaFin)) {
      return 'Complete todos los campos del plan inicial de reposiciÃ³n o dÃ©jelos vacÃ­os para gestionarlo luego en seguimiento.';
    }
    if (hasReposicionPlan) {
      const replacementMinutes = diffElapsedMinutes(reposicion.fecha, reposicion.fechaFin, reposicion.horaInicio, reposicion.horaFin);
      if (!replacementMinutes) return 'El rango del plan inicial de reposiciÃ³n no es vÃ¡lido. Revise fecha y hora de inicio y fin.';
    }
  }

  const categoria = sanitizeText(salida.categoria || salida.category || '', 100);
  if (categoria === 'propias_cargo' && salida.tipo !== 'salida_campus') {
    if (!salida.entidadDestino) return 'Debe especificar la entidad de destino.';
    if (!salida.alcance) return 'Debe seleccionar el alcance de la actividad.';
    if (salida.alcance === 'Internacional' && !salida.pais) {
      return 'Debe seleccionar el paÃ­s de destino para salidas internacionales.';
    }
    if (salida.alcance === 'Nacional') {
      if (!salida.departamento) return 'Debe seleccionar el departamento para salidas nacionales.';
      if (!salida.municipio) return 'Debe seleccionar el municipio para salidas nacionales.';
    }
    if (salida.alcance === 'Regional' && !salida.municipio) {
      return 'Debe seleccionar el municipio para salidas regionales.';
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

const buildReporteSalidaPdfAttachment = async (solicitud) => {
  const pdf = await ensureReporteSalidaPdf(solicitud);
  return pdf;
};

const buildReporteSalidaSupportAttachment = (solicitud) => {
  const adjuntoPath = solicitud.datos_formulario?.adjunto_path;
  if (adjuntoPath) {
    const fullPath = path.join(__dirname, '../../uploads/adjuntos_reporte', adjuntoPath);
    if (fs.existsSync(fullPath)) {
      return {
        filename: `Soporte_${solicitud.consecutivo}${path.extname(adjuntoPath)}`,
        path: fullPath
      };
    }
  }
  return null;
};

const deleteSupportFile = (solicitud) => {
  const adjuntoPath = solicitud.datos_formulario?.adjunto_path;
  if (adjuntoPath) {
    const fullPath = path.join(__dirname, '../../uploads/adjuntos_reporte', adjuntoPath);
    if (fs.existsSync(fullPath)) {
      try {
        fs.unlinkSync(fullPath);
        console.log(`[deleteSupportFile] Archivo de soporte eliminado del servidor: ${adjuntoPath}`);
      } catch (err) {
        console.error(`[deleteSupportFile] Error al eliminar soporte: ${err.message}`);
      }
    }
  }
};

const buildReporteSalidaAttachments = async (solicitud) => {
  const pdf = await buildReporteSalidaPdfAttachment(solicitud);
  const support = buildReporteSalidaSupportAttachment(solicitud);
  return [pdf, support].filter(Boolean);
};

const getNextConsecutivo = async (now) => {
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const dateStr = `${day}${month}${year}`;
  const prefix = `RS-${dateStr}-`;
  
  const count = await ReporteSalidaSolicitud.count({
    where: {
      consecutivo: {
        [Op.like]: `${prefix}%`
      }
    }
  });
  
  let sequenceNumber = count + 1;
  let consecutivo = `${prefix}${String(sequenceNumber).padStart(3, '0')}`;
  
  let exists = await ReporteSalidaSolicitud.findOne({ where: { consecutivo } });
  while (exists) {
    sequenceNumber++;
    consecutivo = `${prefix}${String(sequenceNumber).padStart(3, '0')}`;
    exists = await ReporteSalidaSolicitud.findOne({ where: { consecutivo } });
  }
  
  return consecutivo;
};

const buildTerapiasHtml = (solicitud) => {
  const salida = solicitud.datos_formulario?.salida;
  if (salida?.tipo !== 'terapias' || !salida?.terapiasList?.length) return '';
  const rows = salida.terapiasList.map((t, idx) => `<tr><td style="padding:4px;border:1px solid #ddd;text-align:center;">Terapia ${idx + 1}</td><td style="padding:4px;border:1px solid #ddd;text-align:center;">${escapeHtml(t.fecha)}</td><td style="padding:4px;border:1px solid #ddd;text-align:center;">${escapeHtml(t.horaInicio)} - ${escapeHtml(t.horaFin)}</td></tr>`).join('');
  return `<div style="margin: 15px 0;"><strong>Detalle de terapias:</strong><table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;"><thead><tr><th style="text-align:center;padding:4px;border:1px solid #ddd;background:#f3f4f6;">#</th><th style="text-align:center;padding:4px;border:1px solid #ddd;background:#f3f4f6;">Fecha</th><th style="text-align:center;padding:4px;border:1px solid #ddd;background:#f3f4f6;">Horario</th></tr></thead><tbody>${rows}</tbody></table></div>`;
};

const getReporteSalidaEmailLabel = (solicitud) => {
  const duracionTipo = solicitud.datos_formulario?.salida?.duracionTipo;
  if (duracionTipo === '1_2_dias') return 'OFICIO DE SOLICITUD DE SALIDA - 1 O 2 DIAS';
  if (duracionTipo === '3_mas_dias') return 'OFICIO DE SOLICITUD DE SALIDA - 3 O MAS DIAS';
  return 'REPORTE DE SALIDA';
};

const getThreadHeadersFromId = (threadId) =>
  threadId ? { 'In-Reply-To': threadId, 'References': threadId } : {};

const getThreadMessageId = (solicitud, key) =>
  solicitud?.datos_formulario?.[key] || solicitud?.datos_formulario?.thread_message_id || '';

const getUserThreadSubject = (solicitud) =>
  `${getReporteSalidaEmailLabel(solicitud)} ${solicitud.consecutivo} | Comprobante de radicacion`;

const getWorkflowThreadSubject = (solicitud) =>
  `${getReporteSalidaEmailLabel(solicitud)} ${solicitud.consecutivo} | Colaborador(a): ${solicitud.solicitante_snapshot?.nombre || ''}`;

const mergeThreadMessageIds = (solicitud, ids = {}) => ({
  ...(solicitud.datos_formulario || {}),
  ...Object.fromEntries(Object.entries(ids).filter(([, value]) => Boolean(value)))
});

const sendColaboradorRadicacionEmail = async (solicitud, attachments) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const subject = getUserThreadSubject(solicitud);
  const html = renderInstitutionalTemplate({
    title: `Comprobante de radicacion de ${isOficio ? 'oficio de salida' : 'reporte de salida'}: ${escapeHtml(solicitud.consecutivo)}`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(solicitante.nombre)}</p><p>Reciba un cordial saludo. En atenciÃ³n a su solicitud de ${isOficio ? 'oficio de salida' : 'reporte de salida'}, nos permitimos informarle que esta ha sido radicada correctamente y se encuentra actualmente en proceso de revisiÃ³n y aprobaciÃ³n por parte de su jefe inmediato.</p>`,
    bodyHtml: `
      ${buildTerapiasHtml(solicitud)}
      <p>Se adjunta el PDF generado de su solicitud para su respectivo control y archivo.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">DirecciÃ³n de PlaneaciÃ³n y Aseguramiento de la Calidad</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">SIAC UNICESMAG</p>
    `
  });
  return sendInstitutionalEmail({
    to: solicitante.email,
    subject,
    text: `Su solicitud ${solicitud.consecutivo} ha sido radicada y estÃ¡ en proceso de revisiÃ³n.`,
    html,
    attachments
  });
};

const getDependencyNotificationTarget = (solicitud = {}) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_formulario?.laboral || {};
  const dependencia = laboral.dependencia || solicitante.dependencia || '';
  const fallback = laboral.vicerrectoria || solicitante.vicerrectoria || '';
  const dependenciaEmail = getDependencyEmail(dependencia);
  const fallbackEmail = getDependencyEmail(fallback);
  return {
    email: dependenciaEmail || fallbackEmail || '',
    label: dependenciaEmail ? dependencia : (fallback || dependencia),
    source: dependenciaEmail ? 'dependencia' : (fallbackEmail ? 'vicerrectoria' : '')
  };
};

const getDependencyApprovalActor = (solicitud = {}) => {
  const target = getDependencyNotificationTarget(solicitud);
  const depEmail = target.email;
  const dependenciaLabel = target.label;
  if (!depEmail) return null;
  return {
    nombre: dependenciaLabel ? `Dependencia - ${dependenciaLabel}` : 'Dependencia',
    email: depEmail,
    role: 'dependencia',
    cargo: 'Dependencia'
  };
};

const getInitialApprovalActor = (solicitud = {}, via = '') => {
  if (via === 'dependencia') {
    return getDependencyApprovalActor(solicitud) || {
      nombre: 'Dependencia',
      email: '',
      role: 'dependencia',
      cargo: 'Dependencia'
    };
  }
  return {
    ...(solicitud.jefe_snapshot || {}),
    role: 'jefe_inmediato'
  };
};

const getInitialApprovalLabel = (actor = {}, fallbackJefe = {}) =>
  actor.role === 'dependencia'
    ? (actor.nombre || 'Dependencia')
    : (fallbackJefe.nombre || actor.nombre || 'Jefe Inmediato');

const getInitialApprovalTrace = (solicitud = {}) => {
  const traces = Array.isArray(solicitud.trazabilidad) ? solicitud.trazabilidad : [];
  return [...traces].reverse().find((trace) => [
    'aprobada_dependencia',
    'visto_bueno_dependencia',
    'aprobada_jefe',
    'visto_bueno_jefe'
  ].includes(trace.event)) || null;
};

const getInitialApprovalSummary = (solicitud = {}) => {
  const trace = getInitialApprovalTrace(solicitud);
  const actor = trace?.actor || {};
  const viaDependencia = ['aprobada_dependencia', 'visto_bueno_dependencia'].includes(trace?.event);
  const jefe = solicitud.jefe_snapshot || {};
  return {
    actor,
    viaDependencia,
    label: viaDependencia ? (actor.nombre || 'Dependencia') : (jefe.nombre || actor.nombre || 'Jefe Inmediato'),
    roleLabel: viaDependencia ? 'Dependencia' : 'Jefe Inmediato',
    actionLabel: trace?.event?.startsWith('visto_bueno') ? 'Visto bueno' : 'Aprobado'
  };
};

const sendDependenciaRadicacionInfoEmail = async (solicitud, token, attachments, headers = {}) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_formulario?.laboral || {};
  const jefe = solicitud.jefe_snapshot || {};
  const target = getDependencyNotificationTarget(solicitud);
  const depEmail = target.email;
  const dependenciaLabel = target.label;

  if (!depEmail) {
    return { success: false, skipped: true, reason: 'dependency_email_not_configured' };
  }
  if (sameEmail(depEmail, jefe.email)) {
    return { success: false, skipped: true, reason: 'dependency_email_same_as_jefe' };
  }
  if (sameEmail(depEmail, solicitante.email)) {
    return { success: false, skipped: true, reason: 'dependency_email_same_as_solicitante' };
  }

  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const labelText = isOficio ? 'OFICIO DE SOLICITUD DE SALIDA' : 'REPORTE DE SALIDA';
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}?via=dependencia`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}?via=dependencia`;
  const subject = getWorkflowThreadSubject(solicitud);
  const html = renderInstitutionalTemplate({
    title: `Revision de dependencia - ${isOficio ? 'Oficio de salida' : 'Reporte de salida'}`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) equipo de dependencia.</p><p>Reciba un cordial saludo. Se informa que el/la colaborador(a) <strong>${escapeHtml(solicitante.nombre || '')}</strong>, adscrito(a) a <strong>${escapeHtml(dependenciaLabel)}</strong>, radico una solicitud de ${isOficio ? 'oficio de salida' : 'reporte de salida'} en el sistema. Este correo permite realizar seguimiento interno y, cuando el jefe inmediato no se encuentre disponible, autorizar o no autorizar la salida desde la dependencia.</p>`,
    bodyHtml: `
      <p><strong>Colaborador(a):</strong> ${escapeHtml(solicitante.nombre || '')}</p>
      <p><strong>Cargo:</strong> ${escapeHtml(laboral.cargo || solicitante.cargo || '')}</p>
      <p><strong>Jefe inmediato asignado:</strong> ${escapeHtml(jefe.nombre || 'No especificado')}</p>
      ${buildTerapiasHtml(solicitud)}
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">AUTORIZAR SALIDA</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">NO AUTORIZAR SALIDA</a>
      </div>
      <p>Si la dependencia autoriza o no autoriza primero, el enlace del jefe inmediato quedara registrado como ya procesado para evitar duplicidad.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">DirecciÃ³n de PlaneaciÃ³n y Aseguramiento de la Calidad</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">SIAC UNICESMAG</p>
    `
  });

  return sendInstitutionalEmail({
    to: depEmail,
    subject,
    text: `Solicitud ${solicitud.consecutivo} radicada por ${solicitante.nombre || ''}. Autorizar: ${approveUrl}. No autorizar: ${rejectUrl}.`,
    html,
    attachments,
    headers
  });
};

const sendGestionHumanaApprovalEmail = async (solicitud, token, attachments) => {
  const recipients = getReporteSalidaRecipients();
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  
  const approveLabel = 'APROBAR SALIDA';
  const rejectLabel = 'RECHAZAR SALIDA';
  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const labelText = getReporteSalidaEmailLabel(solicitud);
  const initialApproval = getInitialApprovalSummary(solicitud);
  
  const subject = getWorkflowThreadSubject(solicitud);
  const html = renderInstitutionalTemplate({
    title: 'AprobaciÃ³n pendiente de GestiÃ³n del Talento Humano',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimados(as) integrantes,</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">Equipo de GestiÃ³n del Talento Humano</p><p>Reciba un cordial saludo. En atenciÃ³n al trÃ¡mite de ${isOficio ? 'oficio de salida' : 'reporte de salida'} <strong>${escapeHtml(solicitud.consecutivo)}</strong> del/de la colaborador(a) <strong>${escapeHtml(solicitante.nombre)}</strong>, se informa que este ha sido debidamente ${initialApproval.actionLabel.toLowerCase()} por ${escapeHtml(initialApproval.roleLabel.toLowerCase())} (<strong>${escapeHtml(initialApproval.label)}</strong>) y se encuentra listo para su revisiÃ³n y aval correspondiente por parte de GestiÃ³n del Talento Humano.</p>`,
    bodyHtml: `
      <p><strong>Colaborador(a):</strong> ${escapeHtml(solicitante.nombre)}</p>
      ${buildTerapiasHtml(solicitud)}
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">${approveLabel}</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">${rejectLabel}</a>
      </div>
      <p>Si decide no autorizar la solicitud, haga clic en el botÃ³n "No autorizar salida" para ingresar el motivo de su decisiÃ³n.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">${escapeHtml(initialApproval.label)}</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${escapeHtml(initialApproval.roleLabel)}</p>
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
        <strong>Flujo de firmas:</strong><br/>
        â€¢ Solicitado por: ${escapeHtml(solicitante.nombre)}<br/>
        â€¢ ${escapeHtml(initialApproval.actionLabel)} por ${escapeHtml(initialApproval.roleLabel)}: ${escapeHtml(initialApproval.label)}
      </p>
    `
  });
  const threadId = solicitud.datos_formulario?.thread_message_id;
  const headers = threadId ? { 'In-Reply-To': threadId, 'References': threadId } : {};

  return sendInstitutionalEmail({
    to: recipients.gestionHumana,
    subject,
    text: `Solicitud ${solicitud.consecutivo} ${initialApproval.actionLabel.toLowerCase()} por ${initialApproval.roleLabel}. Para finalizar ingrese a ${approveUrl}. Para rechazar ingrese a ${rejectUrl}.`,
    html,
    attachments,
    headers
  });
};

const sendAuthorityApprovalEmail = async ({ solicitud, token, authorityName, authorityEmail, stageLabel, attachments = [] }) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const labelText = getReporteSalidaEmailLabel(solicitud);
  const initialApproval = getInitialApprovalSummary(solicitud);
  const subject = getWorkflowThreadSubject(solicitud);
  const html = renderInstitutionalTemplate({
    title: `AprobaciÃ³n pendiente de ${stageLabel}`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(authorityName)}</p><p>Reciba un cordial saludo. El/la colaborador(a) <strong>${escapeHtml(solicitante.nombre || '')}</strong> cuenta con ${initialApproval.actionLabel.toLowerCase()} de ${escapeHtml(initialApproval.roleLabel.toLowerCase())} (<strong>${escapeHtml(initialApproval.label)}</strong>) y requiere aprobaciÃ³n de ${escapeHtml(stageLabel)} para continuar el trÃ¡mite institucional.</p>`,
    bodyHtml: `
      ${buildTerapiasHtml(solicitud)}
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">APROBAR SALIDA</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">NO APROBAR SALIDA</a>
      </div>
      <p>Si decide no aprobar la solicitud, haga clic en el botÃ³n rojo para ingresar el motivo de su decisiÃ³n.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">${escapeHtml(initialApproval.label)}</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">${escapeHtml(initialApproval.actionLabel)} de ${escapeHtml(initialApproval.roleLabel)}</p>
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
        <strong>Flujo de firmas:</strong><br/>
        â€¢ Solicitado por: ${escapeHtml(solicitante.nombre || '')}<br/>
        â€¢ ${escapeHtml(initialApproval.actionLabel)} por ${escapeHtml(initialApproval.roleLabel)}: ${escapeHtml(initialApproval.label)}
      </p>
    `
  });
  const threadId = solicitud.datos_formulario?.thread_message_id;
  const headers = threadId ? { 'In-Reply-To': threadId, 'References': threadId } : {};
  return sendInstitutionalEmail({
    to: authorityEmail,
    subject,
    text: `Solicitud ${solicitud.consecutivo} requiere aprobaciÃ³n de ${stageLabel}. Para aprobar ingrese a ${approveUrl}. Para rechazar ingrese a ${rejectUrl}.`,
    html,
    attachments,
    headers
  });
};

const sendSSTApprovalEmail = async (solicitud, token, attachments) => {
  const recipients = getReporteSalidaRecipients();
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  
  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const labelText = getReporteSalidaEmailLabel(solicitud);
  const initialApproval = getInitialApprovalSummary(solicitud);
  
  const subject = getWorkflowThreadSubject(solicitud);
  const alcance = solicitud.datos_formulario?.salida?.alcance || 'Nacional/Internacional';
  const html = renderInstitutionalTemplate({
    title: 'Visto bueno pendiente de SST',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimados(as) integrantes,</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">Equipo de Seguridad y Salud en el Trabajo (SST)</p><p>Reciba un cordial saludo. En atencion al tramite del ${isOficio ? 'oficio de salida' : 'reporte de salida'} de alcance misional (${escapeHtml(alcance)}) con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong> del/de la colaborador(a) <strong>${escapeHtml(solicitante.nombre)}</strong>, se informa que la solicitud cuenta con la aprobacion de Gestion del Talento Humano y requiere su validacion y visto bueno final de seguridad por su parte.</p>`,
    bodyHtml: `
      <p><strong>Colaborador(a):</strong> ${escapeHtml(solicitante.nombre)}</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">AUTORIZAR SALIDA</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">NO AUTORIZAR SALIDA</a>
      </div>
      <p>Si decide no autorizar la solicitud, haga clic en el boton "No autorizar salida" para ingresar el motivo de su decision.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">Equipo de Gestion del Talento Humano</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Universidad CESMAG</p>
      <p style="margin: 8px 0 0 0; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 6px;">
        <strong>Flujo de firmas:</strong><br/>
        &bull; Solicitado por: ${escapeHtml(solicitante.nombre)}<br/>
        &bull; ${escapeHtml(initialApproval.actionLabel)} por ${escapeHtml(initialApproval.roleLabel)}: ${escapeHtml(initialApproval.label)}<br/>
        &bull; Aprobado por: Gestion del Talento Humano
      </p>
    `
  });
  const threadId = solicitud.datos_formulario?.thread_message_id;
  const headers = threadId ? { 'In-Reply-To': threadId, 'References': threadId } : {};

  return sendInstitutionalEmail({
    to: recipients.sst,
    subject,
    text: `Solicitud ${solicitud.consecutivo} requiere visto bueno de SST. Para finalizar ingrese a ${approveUrl}. Para rechazar ingrese a ${rejectUrl}.`,
    html,
    attachments,
    headers
  });
};

const sendFinalEmails = async (solicitud, pdfAttachment, supportAttachment) => {
  const recipients = getReporteSalidaRecipients();
  const nombreColaborador = solicitud.solicitante_snapshot?.nombre || '';
  const dependenciaTarget = getDependencyNotificationTarget(solicitud);
  const dependencialabel = dependenciaTarget.label || solicitud.datos_formulario?.laboral?.dependencia || '';

  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  
  const userThreadSubject = getUserThreadSubject(solicitud);
  const workflowThreadSubject = getWorkflowThreadSubject(solicitud);
  const flowSST = solicitud.datos_formulario?.salida?.alcance === 'Internacional' || solicitud.datos_formulario?.salida?.alcance === 'Nacional';
  const initialApproval = getInitialApprovalSummary(solicitud);
  
  // Firma para el Colaborador, LÃ­der de Dependencia y SST (Firma Talento Humano)
  const finalApprovalGHHtml = `
    <p style="margin: 0; font-weight: bold; color: #0b3a6f;">Oficina de GestiÃ³n del Talento Humano</p>
    <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">SIAC UNICESMAG</p>
    <div style="margin: 12px 0 0 0; font-size: 11.5px; color: #15803d; border-top: 1px dashed #e2e8f0; padding-top: 8px; line-height: 1.45;">
      <span style="font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; display: block; margin-bottom: 4px;">âœ“ Flujo de Firmas Completado:</span>
      â€¢ Solicitado por: ${escapeHtml(nombreColaborador)}<br/>
      â€¢ ${escapeHtml(initialApproval.actionLabel)} por ${escapeHtml(initialApproval.roleLabel)}: ${escapeHtml(initialApproval.label)}<br/>
      â€¢ Aprobado por: GestiÃ³n del Talento Humano<br/>
      ${flowSST ? '&bull; Visto bueno por: Seguridad y Salud en el Trabajo (SST)<br/>' : ''}
    </div>
  `;

  // Firma para GestiÃ³n del Talento Humano (Su propio correo: solo "Fraternalmente," y el flujo de aprobaciÃ³n, sin redundancia)
  const finalApprovalGHCopyHtml = `
    <div style="margin: 0; font-size: 11.5px; color: #15803d; padding-top: 4px; line-height: 1.45;">
      <span style="font-weight: 800; color: #166534; text-transform: uppercase; letter-spacing: 0.5px; font-size: 10px; display: block; margin-bottom: 4px;">âœ“ Flujo de Firmas Completado:</span>
      â€¢ Solicitado por: ${escapeHtml(nombreColaborador)}<br/>
      â€¢ ${escapeHtml(initialApproval.actionLabel)} por ${escapeHtml(initialApproval.roleLabel)}: ${escapeHtml(initialApproval.label)}<br/>
      â€¢ Aprobado por: GestiÃ³n del Talento Humano<br/>
      ${flowSST ? '&bull; Visto bueno por: Seguridad y Salud en el Trabajo (SST)<br/>' : ''}
    </div>
  `;

  // 1. Correo para el/la Colaborador(a) (Solo el PDF firmado)
  const userHtml = renderInstitutionalTemplate({
    title: `${isOficio ? 'Oficio de salida' : 'Reporte de salida'} aprobado`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(nombreColaborador)}</p><p>Reciba un cordial saludo. En atenciÃ³n a su trÃ¡mite de ${isOficio ? 'oficio de salida' : 'reporte de salida'} con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong>, nos complace informarle que la solicitud ha sido aprobada de manera exitosa y finalizada en el sistema.</p>`,
    bodyHtml: `<p>Se adjunta el PDF ${isOficio ? 'del oficio' : 'digital FR-002'} debidamente firmado para sus registros.</p>
      ${buildTerapiasHtml(solicitud)}`,
    senderHtml: finalApprovalGHHtml
  });

  const userResult = await sendInstitutionalEmail({
    to: solicitud.solicitante_snapshot?.email,
    subject: userThreadSubject,
    text: `Su ${isOficio ? 'oficio de salida' : 'reporte de salida'} ${solicitud.consecutivo} ha sido aprobado exitosamente. Se adjunta PDF firmado.`,
    html: userHtml,
    attachments: [pdfAttachment].filter(Boolean),
    headers: getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_colaborador'))
  });

  // 2. Correo de Copia de control para LÃ­der de Dependencia / Jefe Inmediato
  let depResult = { success: false, recipients: [] };
  const copyRecipients = [];
  const depEmail = dependenciaTarget.email;
  const solicitanteEmail = solicitud.solicitante_snapshot?.email;
  if (depEmail && !sameEmail(depEmail, solicitanteEmail)) copyRecipients.push({ type: 'dependencia', email: depEmail });
  
  const jefeEmail = getInitialApprovalRecipientEmail(solicitud);
  if (jefeEmail && !copyRecipients.some((recipient) => sameEmail(recipient.email, jefeEmail))) {
    copyRecipients.push({ type: 'jefe', email: jefeEmail });
  }

  if (copyRecipients.length > 0) {
    const depHtml = renderInstitutionalTemplate({
      title: `Copia de control - ${isOficio ? 'Oficio de salida' : 'Reporte de salida'} aprobado`,
      introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a). LÃ­der de Dependencia / Jefe Inmediato,</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(solicitud.jefe_snapshot?.nombre || 'LÃ­der / Jefe Inmediato')}</p><p>Reciba un cordial saludo. Para su respectiva informaciÃ³n y control interno, nos permitimos remitirle copia del ${isOficio ? 'oficio de salida aprobado' : 'reporte de salida aprobado'} para el/la colaborador(a) <strong>${escapeHtml(nombreColaborador)}</strong>, adscrito(a) a su dependencia (<strong>${escapeHtml(dependencialabel)}</strong>).</p>`,
      bodyHtml: `<p>Se adjunta el PDF ${isOficio ? 'del oficio' : 'digital FR-002'} debidamente firmado y aprobado.</p>
        ${buildTerapiasHtml(solicitud)}`,
      senderHtml: finalApprovalGHHtml
    });

    const copyResults = [];
    for (const recipient of copyRecipients) {
      let result = await sendInstitutionalEmail({
        to: recipient.email,
        subject: workflowThreadSubject,
        text: `Se remite copia del ${isOficio ? 'oficio' : 'reporte'} de salida aprobado del/de la colaborador(a) ${nombreColaborador} perteneciente a su dependencia. Se adjunta PDF firmado.`,
        html: depHtml,
        attachments: [pdfAttachment].filter(Boolean),
        headers: getThreadHeadersFromId(getThreadMessageId(
          solicitud,
          recipient.type === 'dependencia' ? 'thread_message_id_dependencia' : 'thread_message_id_jefe'
        ))
      });

      if (!result.success && recipient.type === 'dependencia') {
        console.error('[reporte-salida] Reintentando copia final a dependencia sin headers de hilo:', recipient.email, result.error || '');
        const retryResult = await sendInstitutionalEmail({
          to: recipient.email,
          subject: workflowThreadSubject,
          text: `Se remite copia del ${isOficio ? 'oficio' : 'reporte'} de salida aprobado del/de la colaborador(a) ${nombreColaborador} perteneciente a su dependencia. Se adjunta PDF firmado.`,
          html: depHtml,
          attachments: [pdfAttachment].filter(Boolean)
        });
        result = {
          ...retryResult,
          error: retryResult.success ? '' : (retryResult.error || result.error || ''),
          retriedWithoutThread: true
        };
      }

      console.log('[reporte-salida] Copia final enviada:', {
        consecutivo: solicitud.consecutivo,
        tipo: recipient.type,
        email: recipient.email,
        success: Boolean(result.success),
        retry: Boolean(result.retriedWithoutThread),
        error: result.error || ''
      });
      copyResults.push({
        ...recipient,
        success: result.success,
        error: result.error || '',
        retriedWithoutThread: Boolean(result.retriedWithoutThread)
      });
    }
    depResult = {
      success: copyResults.some((item) => item.success),
      recipients: copyResults,
      error: copyResults.filter((item) => !item.success).map((item) => `${item.email}: ${item.error || 'no enviado'}`).join(' | ')
    };
  }

  // 3. Correo para GestiÃ³n del Talento Humano (PDF firmado + Soporte MÃ©dico/Adjunto)
  let ghResult = { success: false };
  if (recipients.gestionHumana) {
    const ghHtml = renderInstitutionalTemplate({
      title: `${isOficio ? 'Oficio' : 'Reporte'} de salida aprobado - Registro GestiÃ³n del Talento Humano`,
      introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0;">Estimados(as) integrantes,</p><p style="margin: 0 0 16px 0;"><strong>Equipo de GestiÃ³n del Talento Humano</strong></p><p>Reciba un cordial saludo. Se remite el ${isOficio ? 'oficio de salida' : 'reporte de salida'} debidamente finalizado y aprobado del/de la colaborador(a) <strong>${escapeHtml(nombreColaborador)}</strong> para su respectivo registro e incorporaciÃ³n en la carpeta de la hoja de vida.</p>`,
      bodyHtml: `<p>Se adjunta el PDF firmado y el soporte adjunto correspondiente para sus registros.</p>
        ${buildTerapiasHtml(solicitud)}`,
      senderHtml: finalApprovalGHCopyHtml
    });

    ghResult = await sendInstitutionalEmail({
      to: [recipients.gestionHumana],
      subject: workflowThreadSubject,
      text: `Se remite el ${isOficio ? 'oficio' : 'reporte'} de salida aprobado y el soporte adjunto para el/la colaborador(a) ${nombreColaborador} para su respectivo registro.`,
      html: ghHtml,
      attachments: [pdfAttachment, supportAttachment].filter(Boolean),
      headers: getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_gestion_humana'))
    });
  }

  // 4. Correo para SST (PDF firmado + Soporte MÃ©dico/Adjunto)
  let sstResult = { success: false };
  if (recipients.sst) {
    const sstHtml = renderInstitutionalTemplate({
      title: `${isOficio ? 'Oficio' : 'Reporte'} de salida aprobado - Control SST`,
      introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0;">Estimados(as) integrantes,</p><p style="margin: 0 0 16px 0;"><strong>Equipo de Seguridad y Salud en el Trabajo (SST)</strong></p><p>Reciba un cordial saludo. Se remite el ${isOficio ? 'oficio de salida' : 'reporte de salida'} debidamente finalizado y aprobado del/de la colaborador(a) <strong>${escapeHtml(nombreColaborador)}</strong> para su respectivo control y seguimiento de SST.</p>`,
      bodyHtml: `<p>Se adjunta el PDF firmado y el soporte adjunto correspondiente para su control.</p>
        ${buildTerapiasHtml(solicitud)}`,
      senderHtml: finalApprovalGHCopyHtml
    });

    sstResult = await sendInstitutionalEmail({
      to: [recipients.sst],
      subject: workflowThreadSubject,
      text: `Se remite el ${isOficio ? 'oficio' : 'reporte'} de salida aprobado y el soporte adjunto para el/la colaborador(a) ${nombreColaborador} para su respectivo control de SST.`,
      html: sstHtml,
      attachments: [pdfAttachment, supportAttachment].filter(Boolean),
      headers: getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_sst'))
    });
  }

  return { userResult, depResult, ghResult, sstResult };
};

const sendJefeApprovalEmail = async (solicitud, token, attachments, headers = {}) => {
  const jefe = solicitud.jefe_snapshot || {};
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  
  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const labelText = getReporteSalidaEmailLabel(solicitud);
  
  const subject = `${labelText} ${solicitud.consecutivo} | Colaborador(a): ${solicitante.nombre || ''}`;
  const html = renderInstitutionalTemplate({
    title: `Solicitud de aprobacion de ${isOficio ? 'oficio de salida' : 'reporte de salida'}`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(jefe.nombre)}</p><p>Reciba un cordial saludo. En atencion a su tramite de ${isOficio ? 'oficio de salida' : 'reporte de salida'} con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong>, nos complace informarle que la solicitud ha sido aprobada de manera exitosa y finalizada en el sistema.</p>`,
    bodyHtml: `<p>Se adjunta el PDF ${isOficio ? 'del oficio' : 'digital FR-002'} debidamente firmado para sus registros.</p>
      ${buildTerapiasHtml(solicitud)}`,
    senderHtml: finalApprovalGHHtml
  });

  const userResult = await sendInstitutionalEmail({
    to: solicitud.solicitante_snapshot?.email,
    subject: userThreadSubject,
    text: `Su ${isOficio ? 'oficio de salida' : 'reporte de salida'} ${solicitud.consecutivo} ha sido aprobado exitosamente. Se adjunta PDF firmado.`,
    html: userHtml,
    attachments: [pdfAttachment].filter(Boolean),
    headers
  });

  // 2. Correo para la Dependencia y el Jefe Inmediato (Copia de control, Solo el PDF firmado)
  let depResult = { success: false };
  const copyRecipients = [];
  const dependenciaTarget = getDependencyNotificationTarget(solicitud);
  const depEmail = dependenciaTarget.email;
  const dependencialabel = dependenciaTarget.label || solicitud.datos_formulario?.laboral?.dependencia || '';
  const solicitanteEmail = solicitud.solicitante_snapshot?.email;
  if (depEmail && !sameEmail(depEmail, solicitanteEmail)) copyRecipients.push(depEmail);
  
  const jefeEmail = getInitialApprovalRecipientEmail(solicitud);
  if (jefeEmail && !copyRecipients.includes(jefeEmail)) {
    copyRecipients.push(jefeEmail);
  }

  if (copyRecipients.length > 0) {
    const depHtml = renderInstitutionalTemplate({
      title: `Copia de control - ${isOficio ? 'Oficio de salida' : 'Reporte de salida'} aprobado`,
      introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a). LÃ­der de Dependencia / Jefe Inmediato,</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(solicitud.jefe_snapshot?.nombre || 'LÃ­der / Jefe Inmediato')}</p><p>Reciba un cordial saludo. Para su respectiva informaciÃ³n y control interno, nos permitimos remitirle copia del ${isOficio ? 'oficio de salida aprobado' : 'reporte de salida aprobado'} para el/la colaborador(a) <strong>${escapeHtml(nombreColaborador)}</strong>, adscrito(a) a su dependencia (<strong>${escapeHtml(dependencialabel)}</strong>).</p>`,
      bodyHtml: `<p>Se adjunta el PDF ${isOficio ? 'del oficio' : 'digital FR-002'} debidamente firmado y aprobado.</p>
        ${buildTerapiasHtml(solicitud)}`,
      senderHtml: finalApprovalGHHtml
    });

    depResult = await sendInstitutionalEmail({
      to: copyRecipients,
      subject: workflowThreadSubject,
      text: `Se remite copia del ${isOficio ? 'oficio' : 'reporte'} de salida aprobado del/de la colaborador(a) ${nombreColaborador} perteneciente a su dependencia. Se adjunta PDF firmado.`,
      html: depHtml,
      attachments: [pdfAttachment].filter(Boolean),
      headers
    });
  }

  // 3. Correo para Gestion del Talento Humano (PDF firmado + Soporte MÃ©dico/Adjunto)
  let ghResult = { success: false };
  if (recipients.gestionHumana) {
    const ghHtml = renderInstitutionalTemplate({
      title: `${isOficio ? 'Oficio' : 'Reporte'} de salida aprobado - Registro Gestion del Talento Humano`,
      introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0;">Estimados(as) integrantes,</p><p style="margin: 0 0 16px 0;"><strong>Equipo de Gestion del Talento Humano</strong></p><p>Reciba un cordial saludo. Se remite el ${isOficio ? 'oficio de salida' : 'reporte de salida'} debidamente finalizado y aprobado del/de la colaborador(a) <strong>${escapeHtml(nombreColaborador)}</strong> para su respectivo registro e incorporaciÃ³n en la carpeta de la hoja de vida.</p>`,
      bodyHtml: `<p>Se adjunta el PDF firmado y el soporte adjunto correspondiente para sus registros.</p>
        ${buildTerapiasHtml(solicitud)}`,
      senderHtml: finalApprovalGHCopyHtml
    });

    ghResult = await sendInstitutionalEmail({
      to: [recipients.gestionHumana],
      subject: workflowThreadSubject,
      text: `Se remite el ${isOficio ? 'oficio' : 'reporte'} de salida aprobado y el soporte adjunto para el/la colaborador(a) ${nombreColaborador} para su respectivo registro.`,
      html: ghHtml,
      attachments: [pdfAttachment, supportAttachment].filter(Boolean),
      headers
    });
  }

  // 4. Correo para SST (PDF firmado + Soporte MÃ©dico/Adjunto)
  let sstResult = { success: false };
  if (recipients.sst) {
    const sstHtml = renderInstitutionalTemplate({
      title: `Control SST - ${isOficio ? 'Oficio' : 'Reporte'} de salida aprobado`,
      introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0;">Estimados(as) integrantes,</p><p style="margin: 0 0 16px 0;"><strong>Equipo de Seguridad y Salud en el Trabajo (SST)</strong></p><p>Reciba un cordial saludo. Se remite la solicitud de ${isOficio ? 'oficio de salida' : 'reporte de salida'} aprobada del/de la colaborador(a) <strong>${escapeHtml(nombreColaborador)}</strong> para su correspondiente registro y control preventivo.</p>`,
      bodyHtml: `<p>Se adjunta el PDF firmado y el soporte adjunto correspondiente para su registro y control.</p>
        ${buildTerapiasHtml(solicitud)}`,
      senderHtml: finalApprovalGHHtml
    });

    sstResult = await sendInstitutionalEmail({
      to: [recipients.sst],
      subject: workflowThreadSubject,
      text: `Se remite el ${isOficio ? 'oficio' : 'reporte'} de salida aprobado y el soporte adjunto para el/la colaborador(a) ${nombreColaborador} para su respectivo control de SST.`,
      html: sstHtml,
      attachments: [pdfAttachment, supportAttachment].filter(Boolean),
      headers
    });
  }

  return { userResult, depResult, ghResult, sstResult };
};

const sendJefeRadicacionApprovalEmail = async (solicitud, token, attachments, headers = {}) => {
  const jefe = solicitud.jefe_snapshot || {};
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const rejectUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`;
  const isOficio = solicitud.datos_formulario?.salida?.duracionTipo && solicitud.datos_formulario?.salida?.duracionTipo !== 'menos_media_jornada';
  const labelText = getReporteSalidaEmailLabel(solicitud);
  const subject = `${labelText} ${solicitud.consecutivo} | Colaborador(a): ${solicitante.nombre || ''}`;
  const html = renderInstitutionalTemplate({
    title: `Solicitud de autorizacion de ${isOficio ? 'oficio de salida' : 'reporte de salida'}`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(jefe.nombre || '')}</p><p>Reciba un cordial saludo. En atencion a los procesos institucionales del Sistema de Gestion de Calidad, se informa que el/la colaborador(a) <strong>${escapeHtml(solicitante.nombre || '')}</strong> ha radicado una solicitud, la cual requiere su revision y autorizacion como jefe inmediato.</p>`,
    bodyHtml: `
      ${buildTerapiasHtml(solicitud)}
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">AUTORIZAR SALIDA</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">NO AUTORIZAR SALIDA</a>
      </div>
      <p>Si decide no autorizar la solicitud, haga clic en el boton "No autorizar salida" para ingresar el motivo de su decision.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #0b3a6f;">Sistema SIAC UNICESMAG</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Sistema Interno de Aseguramiento de la Calidad</p>
    `
  });

  return sendInstitutionalEmail({
    to: getInitialApprovalRecipientEmail(solicitud),
    subject,
    text: `Solicitud ${solicitud.consecutivo} pendiente de autorizacion. Autorizar: ${approveUrl}. No autorizar: ${rejectUrl}.`,
    html,
    attachments,
    headers
  });
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
            vicerrectoria: sanitizeText(current.vicerrectoria, 220),
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

const resolveJefeForParticipant = async (p, userRows, rhRows) => {
  const doc = normalizeDocument(p.documento);
  const email = normalizeForMatch(p.correo);
  
  // 1. Try to find in userRows
  let partRow = userRows.find(row => 
    (doc && normalizeDocument(row.username) === doc) || 
    (email && normalizeForMatch(row.email) === email)
  );

  // 2. If not found, try to find in rhRows
  if (!partRow && rhRows) {
    partRow = rhRows.find(row => 
      (doc && normalizeDocument(row.numero_cedula) === doc)
    );
  }

  const jefeNombre = partRow?.jefe_inmediato || '';
  if (!jefeNombre) {
    return {};
  }

  // 3. Find this boss in userRows
  const bossUser = findBestUserMatch(userRows, jefeNombre);

  if (bossUser) {
    return buildSnapshot(bossUser);
  }

  // 4. Try to find this boss in rhRows
  if (rhRows) {
    const bossRh = findBestRhMatch(rhRows, jefeNombre);

    if (bossRh) {
      return buildAdministrativeBossSnapshot({
        userId: null,
        nombre: bossRh.nombre_empleado,
        email: getAdministrativeEmail(bossRh) || '',
        username: bossRh.numero_cedula || '',
        cargo: bossRh.cargo_especifico,
        dependencia: bossRh.dependencia,
        jefe_inmediato: bossRh.nombre_empleado,
        source: 'recurso_humano_administrativos'
      });
    }
  }

  // Fallback
  return {
    nombre: jefeNombre,
    email: '',
    cargo: '',
    dependencia: ''
  };
};

const sendJefeGroupRadicacionNotificationEmail = async (solicitud, jefeSnapshot, allParticipants) => {
  if (!jefeSnapshot || !jefeSnapshot.email) return { success: false, error: 'No email' };
  
  const solicitante = solicitud.solicitante_snapshot || {};
  const salida = solicitud.datos_formulario?.salida || {};

  const subject = `REPORTE DE SALIDA GRUPAL - NOTIFICACION INFORMATIVA | Colaborador(a): ${solicitante.nombre || ''}`;
  
  const mapping = {
    cita_eps: 'Cita medica por EPS',
    cita_particular: 'Cita medica particular',
    urgencia_medica: 'Urgencia Medica',
    diligencia_personal: 'Diligencia personal',
    compensatorio: 'Compensatorio',
    ponencia: 'Ponencia',
    visita_ies: 'Visita a otras IES',
    capacitacion: 'Capacitacion',
    proyecto_investigacion: 'Proyecto de investigacion',
    asistente_congreso: 'Asistente a congreso',
    practica_academica: 'Practica academica',
    torneo_deportivo: 'Participante en torneo deportivo',
    voto_jurado: 'Permiso: Jurado de votacion',
    voto_sufragante: 'Permiso: Sufragante',
    calamidad_domestica: 'Permiso: Calamidad domestica',
    entierro_companero: 'Permiso: Entierro companeros',
    comision_sindical: 'Permiso: Comisiones sindicales',
    matrimonio: 'Permiso: Matrimonio',
    lactancia: 'Permiso: Lactancia',
    luto_conyuge: 'Licencia luto: Conyuge',
    luto_companero: 'Licencia luto: Companero(a)',
    luto_familiar: 'Licencia luto: Familiar',
    actos_funebres: 'Licencia: Actos funebres',
    cuidado_ninez: 'Licencia: Cuidado ninez',
    jurado_votacion: 'Permiso: Jurado de votacion',
    sufragante: 'Permiso: Sufragante',
    cargos_oficiales_transitorios: 'Permiso: DesempeÃ±o de cargos oficiales transitorios',
    comisiones_sindicales: 'Permiso: Comisiones sindicales',
    obligaciones_escolares: 'Permiso: Obligaciones escolares',
    citaciones_judiciales: 'Permiso: Citaciones judiciales, administrativas y de policia',
    cuidado_hijo_ley_2174: 'Permiso: Cuidado de hijo(a) - Ley 2174 de 2021'
  };

  const getSubtypeLabel = (tipo) => {
    if (!tipo) return '';
    if (mapping[tipo]) return mapping[tipo];
    if (tipo.startsWith('otra:')) return `Otra: ${tipo.substring(5)}`;
    return tipo;
  };

  const participantsListHtml = allParticipants.map((p, idx) => `
    <tr>
      <td style="padding:8px;border:1px solid #ddd;text-align:center;">${idx + 1}</td>
      <td style="padding:8px;border:1px solid #ddd;"><strong>${escapeHtml(p.nombre)}</strong> ${idx === 0 ? '<span style="color:#0f52ba;font-size:11px;font-weight:bold;">(LÃ­der)</span>' : ''}</td>
      <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(p.cargo)}</td>
      <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(p.dependencia)}</td>
    </tr>
  `).join('');

  const html = renderInstitutionalTemplate({
    title: 'NotificaciÃ³n Informativa - Reporte de Salida Grupal',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(jefeSnapshot.nombre)}</p><p>Reciba un cordial saludo. Le informamos que su colaborador(a) a cargo, <strong>${escapeHtml(solicitante.nombre)}</strong>, participarÃ¡ en una actividad grupal que requiere un reporte de salida.</p>`,
    bodyHtml: `
      <p><strong>Tipo de salida / Motivo:</strong> ${escapeHtml(getSubtypeLabel(salida.tipo))}${salida.motivo ? ` - ${escapeHtml(salida.motivo)}` : ''}</p>
      <p><strong>Fecha y hora salida:</strong> ${escapeHtml(salida.fecha)} ${escapeHtml(salida.horaInicio)}</p>
      <p><strong>Fecha y hora regreso:</strong> ${escapeHtml(salida.fechaRegreso)} ${escapeHtml(salida.horaFin)}</p>
      
      <p><strong>Participantes de la actividad:</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:13px;text-align:left;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th style="padding:8px;border:1px solid #ddd;text-align:center;width:40px;">#</th>
            <th style="padding:8px;border:1px solid #ddd;">Colaborador(a)</th>
            <th style="padding:8px;border:1px solid #ddd;">Cargo</th>
            <th style="padding:8px;border:1px solid #ddd;">Dependencia</th>
          </tr>
        </thead>
        <tbody>
          ${participantsListHtml}
        </tbody>
      </table>

      <p style="font-weight:bold;color:#1e3a8a;">Nota importante:</p>
      <p>Dado que esta es una <strong>solicitud de salida grupal</strong>, la aprobaciÃ³n correspondiente serÃ¡ gestionada directamente por el equipo de <strong>Gestion del Talento Humano</strong> (y por <strong>Seguridad y Salud en el Trabajo</strong> en caso de ser una salida nacional/internacional). Por lo tanto, <strong>no se requiere ninguna acciÃ³n de aprobaciÃ³n por su parte</strong>.</p>
    `
  });

  return sendInstitutionalEmail({
    to: jefeSnapshot.email,
    subject,
    text: `Su colaborador(a) ${solicitante.nombre} participarÃ¡ en una salida grupal. AprobaciÃ³n a cargo de Gestion del Talento Humano y/o SST.`,
    html
  });
};

const sendIndividualColaboradorFinalEmail = async (solicitud, pdfAttachment) => {
  const nombreColaborador = solicitud.solicitante_snapshot?.nombre || '';
  const headers = getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_colaborador'));
  const threadSubject = getUserThreadSubject(solicitud);

  const userHtml = renderInstitutionalTemplate({
    title: 'Reporte de salida aprobado',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(nombreColaborador)}</p><p>Reciba un cordial saludo. Su reporte de salida individual ha sido aprobado exitosamente.</p>`,
    bodyHtml: `<p>Su reporte de salida individual ha sido aprobado exitosamente.</p>
      <p>Se adjunta el PDF digital FR-002 debidamente firmado para sus registros.</p>
      ${buildTerapiasHtml(solicitud)}`
  });

  return sendInstitutionalEmail({
    to: solicitud.solicitante_snapshot?.email,
    subject: threadSubject,
    text: `Su reporte de salida ${solicitud.consecutivo} ha sido aprobado exitosamente. Se adjunta PDF digital FR-002 firmado.`,
    html: userHtml,
    attachments: [pdfAttachment].filter(Boolean),
    headers
  });
};

const sendGroupFinalConsolidatedEmail = async (solicitudes, pdfAttachments) => {
  const recipients = getReporteSalidaRecipients();
  const leaderSol = solicitudes.find(s => s.datos_formulario?.is_leader === true) || solicitudes[0];
  const leaderEmail = leaderSol?.solicitante_snapshot?.email;
  const leaderNombre = leaderSol?.solicitante_snapshot?.nombre || '';
  const consecutivoGroup = leaderSol.consecutivo.split('-').slice(0, 3).join('-') + '-GRUPO';
  const salida = leaderSol.datos_formulario?.salida || {};

  const to = [recipients.sst, leaderEmail].filter(Boolean);
  if (!to.length) return { success: false, error: 'No recipients' };

  const threadSubject = `REPORTE DE SALIDA GRUPAL APROBADO ${consecutivoGroup} | [APROBADO]`;

  const mapping = {
    cita_eps: 'Cita medica por EPS',
    cita_particular: 'Cita medica particular',
    urgencia_medica: 'Urgencia Medica',
    diligencia_personal: 'Diligencia personal',
    compensatorio: 'Compensatorio',
    ponencia: 'Ponencia',
    visita_ies: 'Visita a otras IES',
    capacitacion: 'Capacitacion',
    proyecto_investigacion: 'Proyecto de investigacion',
    asistente_congreso: 'Asistente a congreso',
    practica_academica: 'Practica academica',
    torneo_deportivo: 'Participante en torneo deportivo',
    voto_jurado: 'Permiso: Jurado de votacion',
    voto_sufragante: 'Permiso: Sufragante',
    calamidad_domestica: 'Permiso: Calamidad domestica',
    entierro_companero: 'Permiso: Entierro companeros',
    comision_sindical: 'Permiso: Comisiones sindicales',
    matrimonio: 'Permiso: Matrimonio',
    lactancia: 'Permiso: Lactancia',
    luto_conyuge: 'Licencia luto: Conyuge',
    luto_companero: 'Licencia luto: Companero(a)',
    luto_familiar: 'Licencia luto: Familiar',
    actos_funebres: 'Licencia: Actos funebres',
    cuidado_ninez: 'Licencia: Cuidado ninez',
    jurado_votacion: 'Permiso: Jurado de votacion',
    sufragante: 'Permiso: Sufragante',
    cargos_oficiales_transitorios: 'Permiso: DesempeÃ±o de cargos oficiales transitorios',
    comisiones_sindicales: 'Permiso: Comisiones sindicales',
    obligaciones_escolares: 'Permiso: Obligaciones escolares',
    citaciones_judiciales: 'Permiso: Citaciones judiciales, administrativas y de policia',
    cuidado_hijo_ley_2174: 'Permiso: Cuidado de hijo(a) - Ley 2174 de 2021'
  };

  const getSubtypeLabel = (tipo) => {
    if (!tipo) return '';
    if (mapping[tipo]) return mapping[tipo];
    if (tipo.startsWith('otra:')) return `Otra: ${tipo.substring(5)}`;
    return tipo;
  };

  const participantsListHtml = solicitudes.map((sol, idx) => {
    const p = sol.solicitante_snapshot || {};
    return `
      <tr>
        <td style="padding:8px;border:1px solid #ddd;text-align:center;">${idx + 1}</td>
        <td style="padding:8px;border:1px solid #ddd;"><strong>${escapeHtml(p.nombre)}</strong> ${sol.datos_formulario?.is_leader ? '<span style="color:#0f52ba;font-size:11px;font-weight:bold;">(LÃ­der)</span>' : ''}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(p.cargo)}</td>
        <td style="padding:8px;border:1px solid #ddd;">${escapeHtml(p.dependencia)}</td>
        <td style="padding:8px;border:1px solid #ddd;font-family:monospace;font-weight:bold;color:#0b3a6f;">${escapeHtml(sol.consecutivo)}</td>
      </tr>
    `;
  }).join('');

  const html = renderInstitutionalTemplate({
    title: 'NotificaciÃ³n de AprobaciÃ³n - Reporte de Salida Grupal',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a). LÃ­der de Actividad,</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(leaderNombre)}</p><p>Reciba un cordial saludo. Se ha finalizado de manera exitosa el proceso de revisiÃ³n y aprobaciÃ³n de la salida grupal liderada por su parte.</p>`,
    bodyHtml: `
      <p><strong>Grupo ID / Consecutivo General:</strong> ${escapeHtml(consecutivoGroup)}</p>
      <p><strong>Tipo de salida / Motivo:</strong> ${escapeHtml(getSubtypeLabel(salida.tipo))}${salida.motivo ? ` - ${escapeHtml(salida.motivo)}` : ''}</p>
      <p><strong>Fecha y hora salida:</strong> ${escapeHtml(salida.fecha)} ${escapeHtml(salida.horaInicio)}</p>
      <p><strong>Fecha y hora regreso:</strong> ${escapeHtml(salida.fechaRegreso)} ${escapeHtml(salida.horaFin)}</p>
      
      <p><strong>RelaciÃ³n de colaboradores(as) aprobados(as):</strong></p>
      <table style="width:100%;border-collapse:collapse;margin:15px 0;font-size:13px;text-align:left;">
        <thead>
          <tr style="background-color:#f1f5f9;">
            <th style="padding:8px;border:1px solid #ddd;text-align:center;width:40px;">#</th>
            <th style="padding:8px;border:1px solid #ddd;">Colaborador(a)</th>
            <th style="padding:8px;border:1px solid #ddd;">Cargo</th>
            <th style="padding:8px;border:1px solid #ddd;">Dependencia</th>
            <th style="padding:8px;border:1px solid #ddd;">Consecutivo Solicitud</th>
          </tr>
        </thead>
        <tbody>
          ${participantsListHtml}
        </tbody>
      </table>

      <p>Se adjuntan en este correo todos los reportes de salida individuales (PDF digital FR-002) debidamente firmados y aprobados para su registro general de SST y control del lÃ­der de la actividad.</p>
    `
  });

  return sendInstitutionalEmail({
    to,
    subject: threadSubject,
    text: `El reporte de salida grupal ${consecutivoGroup} ha sido aprobado. Se adjuntan los PDFs individuales de todos los participantes.`,
    html,
    attachments: pdfAttachments.filter(Boolean)
  });
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
        return res.status(400).json({ success: false, message: 'Debe especificar el motivo para la opcion "Otra, Ã‚Â¿Cual?".' });
      }
      if (sanitizeText(salida.categoria || salida.category || '', 100) === 'propias_cargo' && salida.tipo !== 'salida_campus' && !salida.entidadDestino) {
        return res.status(400).json({ success: false, message: 'Debe especificar la entidad de destino.' });
      }
      if (salida.tipo === 'terapias') {
        if (!salida.terapiasList || salida.terapiasList.length === 0) return res.status(400).json({ success: false, message: 'Debe indicar al menos una terapia y completarla.' });
        for (let i = 0; i < salida.terapiasList.length; i++) {
          const t = salida.terapiasList[i];
          if (!t.fecha || !t.horaInicio || !t.horaFin) return res.status(400).json({ success: false, message: `Complete fecha, hora inicio y hora fin para la terapia #${i + 1}.` });
        }
      } else {
        const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
        if (isSaludNoTerapias) {
          if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio) {
            return res.status(400).json({ success: false, message: 'Debe indicar fecha de salida, fecha de regreso y hora de salida.' });
          }
        } else {
          if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio || !salida.horaFin) {
            return res.status(400).json({ success: false, message: 'Debe indicar fecha de salida, hora de salida, fecha de regreso y hora de regreso.' });
          }
        }
      }
      let requestedMinutes = 0;
      if (salida.tipo === 'terapias') {
        requestedMinutes = (salida.terapiasList || []).reduce((acc, t) => acc + (diffBusinessMinutes(t.fecha, t.fecha, t.horaInicio, t.horaFin) || 0), 0);
      } else {
        const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
        requestedMinutes = isSaludNoTerapias
          ? (salida.horaFin ? diffElapsedMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin) : 0)
          : diffBusinessMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin);
      }
      const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
      const isHoraFinOptional = isSaludNoTerapias && !salida.horaFin;
      if (!isHoraFinOptional && !requestedMinutes) {
        return res.status(400).json({ success: false, message: 'El rango de salida no es valido. Revise que la fecha y hora final sean posteriores a la inicial.' });
      }
      const now = new Date();
      const grupo_id = crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');
      const token = encryptPayload({ purpose: 'reporte_salida_approve_grupo', grupo_id }, null);
      const tokenHash = hashToken(token);

      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = now.getFullYear();
      const dateStr = `${day}${month}${year}`;
      const basePrefix = `RS-${dateStr}-`;

      let currentSeq = await ReporteSalidaSolicitud.count({
        where: {
          consecutivo: {
            [Op.like]: `${basePrefix}%`
          }
        }
      }) + 1;

      const userRows = await getUserProfileLaboralRows();
      const { rows: rhRows } = await getLatestAdministrativos();

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

        let consecutivo = `${basePrefix}${String(currentSeq).padStart(3, '0')}`;
        let exists = await ReporteSalidaSolicitud.findOne({ where: { consecutivo } });
        while (exists) {
          currentSeq++;
          consecutivo = `${basePrefix}${String(currentSeq).padStart(3, '0')}`;
          exists = await ReporteSalidaSolicitud.findOne({ where: { consecutivo } });
        }
        currentSeq++;

        const jefeSnapshot = await resolveJefeForParticipant(p, userRows, rhRows);
        const jefe_inmediato_user_id = jefeSnapshot?.id && String(jefeSnapshot.id).startsWith('user:') 
          ? Number(jefeSnapshot.id.substring(5)) 
          : null;

        const solicitud = await ReporteSalidaSolicitud.create({
          consecutivo,
          user_id: participantUser.id,
          documento_id: documento.id,
          jefe_inmediato_user_id,
          solicitante_snapshot: buildSnapshot(participantUser),
          jefe_snapshot: jefeSnapshot,
          estado: 'pendiente_aprobacion_gestion_humana',
          datos_formulario: {
            grupo_id,
            is_salida_multiple: true,
            is_leader: i === 0,
            adjunto_path: req.body.datos_formulario?.adjunto_path ? sanitizeText(req.body.datos_formulario.adjunto_path, 255) : null,
            personal: {
              nombre: sanitizeText(p.nombre),
              documento: sanitizeText(p.documento),
              correo: sanitizeText(p.correo)
            },
            laboral: {
              dependencia: cleanDependenciaLabel(p.dependencia),
              vicerrectoria: sanitizeText(p.vicerrectoria, 220),
              cargo: sanitizeText(p.cargo)
            },
            salida: {
              tipo: sanitizeText(salida.tipo, 60),
              fecha: sanitizeText(salida.fecha, 20),
              fechaRegreso: sanitizeText(salida.fechaRegreso || salida.fecha, 20),
              horaInicio: sanitizeText(salida.horaInicio, 10),
              horaFin: sanitizeText(salida.horaFin, 10),
              motivo: sanitizeText(salida.motivo, 600),
              entidadDestino: sanitizeText(salida.entidadDestino, 255),
              campusSalida: sanitizeText(salida.campusSalida, 100),
              campusDestino: sanitizeText(salida.campusDestino, 100),
              especialidadMedica: sanitizeText(salida.especialidadMedica, 100),
              terapiasList: salida.terapiasList || [],
              categoria: sanitizeText(salida.categoria || salida.category || '', 100),
              alcance: (salida.categoria === 'propias_cargo' && salida.tipo !== 'salida_campus') ? sanitizeText(salida.alcance || 'Local', 100) : 'Local',
              pais: (salida.categoria === 'propias_cargo' && salida.alcance === 'Internacional') ? sanitizeText(salida.pais || '', 100) : '',
              departamento: (salida.categoria === 'propias_cargo' && salida.alcance === 'Nacional') ? sanitizeText(salida.departamento || '', 100) : '',
              municipio: (salida.categoria === 'propias_cargo' && ['Nacional', 'Regional'].includes(salida.alcance)) ? sanitizeText(salida.municipio || '', 100) : ''
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

        if (jefeSnapshot?.email) {
          sendJefeGroupRadicacionNotificationEmail(solicitud, jefeSnapshot, participantes).catch(err => {
            console.error(`Error enviando correo informativo al jefe de la solicitud grupal ${solicitud.consecutivo}:`, err);
          });
        }

        creadas.push(solicitud);
      }

      const emailResult = await sendGestionHumanaGroupApprovalEmail(creadas, token);
      const thread_message_id = emailResult.messageId || null;

      for (const solicitud of creadas) {
        await solicitud.update({
          correo_gh_enviado_at: emailResult.success ? new Date() : null,
          datos_formulario: {
            ...solicitud.datos_formulario,
            thread_message_id
          },
          trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_gestion_humana_enviado' : 'correo_gestion_humana_error', null, { error: emailResult.error || '' })
        });
      }

      return res.status(201).json({
        success: true,
        message: 'Salida grupal radicada exitosamente. Se envio un correo a Gestion del Talento Humano para aprobacion.',
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
      const isSaludNoTerapias = (salida.categoria || salida.category) === 'salud' && salida.tipo !== 'terapias';
      requestedMinutes = isSaludNoTerapias
        ? (salida.horaFin ? diffElapsedMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin) : 0)
        : diffBusinessMinutes(salida.fecha, salida.fechaRegreso, salida.horaInicio, salida.horaFin);
    }
    const isOficio = salida.duracionTipo && salida.duracionTipo !== 'menos_media_jornada';
    const duracionDiasSolicitada = parseInt(salida.duracionDias, 10);
    const selectedVicerrectoriaName = canonicalVicerrectoriaName(req.body.laboral?.vicerrectoria || req.user.vicerrectoria || '');
    const isSaludNoAdjuntoDeclarado = (salida.categoria || salida.category) === 'salud' && salida.noCuentaAdjunto === true;
    const declaracionSinAdjunto = isSaludNoAdjuntoDeclarado
      ? sanitizeText(salida.declaracionSinAdjunto || DEFAULT_DECLARACION_SIN_ADJUNTO_SALUD, 1200)
      : '';
    if (salida.duracionTipo === '1_2_dias' && ![1, 2].includes(duracionDiasSolicitada)) {
      return res.status(400).json({ success: false, message: 'Seleccione si el permiso sera de 1 o 2 dias.' });
    }

    if (salida.duracionTipo === '3_mas_dias' && (!Number.isInteger(duracionDiasSolicitada) || duracionDiasSolicitada < 3)) {
      return res.status(400).json({ success: false, message: 'Digite una cantidad de dias igual o mayor a 3.' });
    }
    if (isOficio && !selectedVicerrectoriaName) {
      return res.status(400).json({ success: false, message: 'Seleccione la vicerrectoria o Rectoria a la que pertenece el colaborador.' });
    }
    const currentUserVicerrectoria = sanitizeText(req.user.vicerrectoria, 220);
    if (isOficio && selectedVicerrectoriaName && selectedVicerrectoriaName !== currentUserVicerrectoria) {
      await User.update({ vicerrectoria: selectedVicerrectoriaName }, { where: { id: req.user.id } });
      req.user.vicerrectoria = selectedVicerrectoriaName;
      if (typeof req.user.setDataValue === 'function') {
        req.user.setDataValue('vicerrectoria', selectedVicerrectoriaName);
      }
    }
    
    // Dynamic Oficio generation on backend
    let codigoDependencia = '';
    let destinatarioTratamiento = 'SeÃ±or(a)';
    let destinatarioNombre = '';
    let destinatarioCargo = '';
    let destinatarioEmpresa = 'UNICESMAG';
    let destinatarioDireccionEmail = '';
    let destinatarioTelefono = '7240000';
    let destinatarioUbicacion = 'San Juan de Pasto, NariÃ±o';
    let destinatarioPais = 'Colombia';
    let oficioAsunto = '';
    let oficioCuerpo = '';
    let oficioDespedida = 'Cordialmente,';
    let oficioAnexos = 'Ninguno';
    let oficioProyecto = req.user.nombre || '';

    if (isOficio) {
      // 1. Dependencia Code
      const depName = req.body.laboral?.dependencia || req.user.dependencia || '';
      const words = depName.replace(/de|la|y|del|o/gi, '').split(/\s+/).filter(Boolean);
      const code = words.map(w => w[0]).join('').toUpperCase().slice(0, 5);
      codigoDependencia = code || 'DP';

      const userVicerrectoriaName = selectedVicerrectoriaName;
      const oficioDirigidoARectoria = salida.duracionTipo === '3_mas_dias' || isRectoriaAuthority(userVicerrectoriaName);
      const oficioAuthorityName = oficioDirigidoARectoria ? 'Rectoria' : (userVicerrectoriaName || '');
      const oficioAuthorityEmail = oficioDirigidoARectoria ? RECTORIA_EMAIL : (getDependencyEmail(oficioAuthorityName) || '');
      const authorityRecipient = oficioAuthorityName
        ? await getAuthorityRecipient(oficioAuthorityName, oficioAuthorityEmail)
        : null;

      // 2. Destinatario
      if (oficioAuthorityName) {
        destinatarioNombre = authorityRecipient?.nombre || oficioAuthorityName.toUpperCase();
        destinatarioCargo = authorityRecipient?.cargo || (oficioDirigidoARectoria ? 'Rectoria' : oficioAuthorityName);
        destinatarioDireccionEmail = authorityRecipient?.email || oficioAuthorityEmail;
        if (oficioDirigidoARectoria) {
          destinatarioTratamiento = 'Fray';
          destinatarioCargo = 'Rector';
          destinatarioEmpresa = 'Universidad CESMAG';
        }
      } else {
        destinatarioNombre = (jefeSnapshot.nombre || '').toUpperCase();
        destinatarioCargo = jefeSnapshot.cargo || 'Jefe Inmediato';
        destinatarioDireccionEmail = jefeSnapshot.email || '';
      }

      // 3. Treatment
      const cargoLower = (destinatarioCargo || jefeSnapshot.cargo || '').toLowerCase();
      if (cargoLower.includes('decano') || cargoLower.includes('rector') || cargoLower.includes('vicerrec')) {
        destinatarioTratamiento = oficioDirigidoARectoria ? 'Fray' : 'Señor(a)';
      }

      // 4. VicerrectorÃ­a
      const getVicerrectoriaByDependency = (dep) => {
        if (!dep) return 'UNICESMAG';
        const d = dep.toLowerCase();
        if (d.includes('sistemas') || d.includes('electronica') || d.includes('psicologia') || d.includes('derecho') || 
            d.includes('arquitectura') || d.includes('diseno') || d.includes('licenciatura') || d.includes('educacion') || 
            d.includes('quimica') || d.includes('idiomas') || d.includes('humanidades') || d.includes('ciencias basica') || 
            d.includes('administracion') || d.includes('contaduria') || d.includes('posgrado') || d.includes('practicas') ||
            d.includes('marketing')) {
          return 'VicerrectorÃ­a AcadÃ©mica';
        }
        if (d.includes('investigacion') || d.includes('extension') || d.includes('egresado') || d.includes('relaciones inter')) {
          return 'VicerrectorÃ­a de InvestigaciÃ³n y ExtensiÃ³n';
        }
        if (d.includes('deporte') || d.includes('cultura') || d.includes('acompanamiento') || d.includes('desarrollo humano') || d.includes('evangelizacion') || d.includes('bienestar')) {
          return 'VicerrectorÃ­a para la EvangelizaciÃ³n de las Culturas';
        }
        if (d.includes('financiera') || d.includes('desarrollo institucional') || d.includes('bienes') || d.includes('servicios') ||
            d.includes('compras') || d.includes('contabilidad') || d.includes('cartera') || d.includes('tesoreria') ||
            d.includes('juridica') || d.includes('mantenimiento') || d.includes('seguridad y salud') || d.includes('talento') ||
            d.includes('infraestructura') || d.includes('medios educativos') || d.includes('biblioteca') || d.includes('comunicaciones') ||
            d.includes('planeacion') || d.includes('proyectos') || d.includes('san damian')) {
          return 'VicerrectorÃ­a Financiera y de Desarrollo Institucional';
        }
        return 'UNICESMAG';
      };
      const vName = oficioAuthorityName || getVicerrectoriaByDependency(depName || jefeSnapshot.dependencia);
      destinatarioEmpresa = oficioDirigidoARectoria
        ? 'Universidad CESMAG'
        : (vName ? `${vName} / UNICESMAG` : 'UNICESMAG');

      // 5. Asunto
      const getTipoLabel = (tipo) => {
        const types = {
          cita_eps: 'Cita medica por EPS',
          cita_particular: 'Cita medica particular',
          terapias: 'Terapias o tratamiento medico',
          urgencia_medica: 'Urgencia medica',
          diligencia_personal: 'Diligencia personal',
          ponencia: 'Ponencia/Conferencia',
          visita_ies: 'Visita a otras IES/Entidades',
          capacitacion: 'Capacitacion/Curso externo',
          proyecto_investigacion: 'Trabajo de campo / Investigacion',
          asistente_congreso: 'Asistente a congreso/evento',
          practica_academica: 'Practica academica extramuros',
          torneo_deportivo: 'Torneo deportivo/Representacion',
          salida_campus: 'Salida de campus (mision institucional)',
          otra: 'Otra actividad propia del cargo'
        };
        if (String(tipo).startsWith('otra:')) {
          return String(tipo).substring(5) || 'Otra';
        }
        return types[tipo] || tipo || '';
      };
      const tipoLabel = getTipoLabel(salida.tipo);
      oficioAsunto = `Solicitud de permiso de salida - ${tipoLabel}`;

      // 6. Anexos
      if (isSaludNoAdjuntoDeclarado) {
        oficioAnexos = 'Declaracion de no contar con soporte al momento de radicar';
      } else if (req.body.datos_formulario?.adjunto_path) {
        oficioAnexos = 'Soporte adjunto en plataforma';
      }

      // 7. Cuerpo
      const isSalidaMultiple = Boolean(req.body.isSalidaMultiple);
      const totalDias = duracionDiasSolicitada;
      const formattedStartDate = formatDateOnly(salida.fecha);
      const formattedEndDate = formatDateOnly(salida.fechaRegreso || salida.fecha);
      const startHour = formatHourAmPm(salida.horaInicio);
      const endHour = formatHourAmPm(salida.horaFin);
      const motivoDescr = String(salida.motivo || '').trim();
      const oficioDurationText = totalDias === 1 ? 'un (1) dia' : `${totalDias} dias`;
      const activityText = tipoLabel || 'la actividad registrada';
      const categoriaSalida = salida.categoria || salida.category || '';
      const alcance = String(salida.alcance || '').trim();
      const entidadDestino = String(salida.entidadDestino || '').trim();
      const requestSubject = isSalidaMultiple
        ? 'para que el grupo de colaboradores registrado en el sistema haga uso del permiso de salida'
        : 'para hacer uso del permiso de salida';
      const fechaHoraText = endHour
        ? `durante el periodo comprendido entre el ${formattedStartDate} a las ${startHour} y el ${formattedEndDate} a las ${endHour}, correspondiente a ${oficioDurationText}`
        : `durante el periodo comprendido entre el ${formattedStartDate} a las ${startHour} y hasta el ${formattedEndDate}, correspondiente a ${oficioDurationText}, con hora de regreso no registrada y asumida al cierre de la jornada laboral correspondiente`;

      const locationValues = [salida.municipio, salida.departamento].filter(Boolean).join(', ');
      const entityText = entidadDestino ? `ante la entidad o institucion ${entidadDestino}` : '';
      const hasPropiasCargoDetails = categoriaSalida === 'propias_cargo' && salida.tipo !== 'salida_campus';
      let contextText = '';
      if (hasPropiasCargoDetails) {
        if (alcance === 'Internacional') {
          contextText = `La actividad corresponde a una salida de alcance internacional${salida.pais ? `, con destino a ${salida.pais}` : ''}${entityText ? `, ${entityText}` : ''}.`;
        } else if (alcance === 'Nacional') {
          contextText = `La actividad corresponde a una salida de alcance nacional${locationValues ? `, con destino a ${locationValues}` : ''}${entityText ? `, ${entityText}` : ''}.`;
        } else if (alcance === 'Regional') {
          contextText = `La actividad corresponde a una salida de alcance regional${salida.municipio ? `, con destino al municipio de ${salida.municipio}` : ''}${entityText ? `, ${entityText}` : ''}.`;
        } else if (entityText) {
          contextText = `La actividad se desarrollara ${entityText}.`;
        }
      }

      const isHealth = categoriaSalida === 'salud';
      const healthDetail = salida.especialidadMedica
        ? `, en la especialidad de ${salida.especialidadMedica}`
        : '';
      const purposeText = hasPropiasCargoDetails
        ? `para atender la actividad institucional relacionada con ${activityText}`
        : isHealth
          ? `para atender ${activityText}${healthDetail}`
          : `para atender el permiso correspondiente a ${activityText}`;

      const closingText = isSalidaMultiple
        ? 'Agradecemos la atencion prestada y la colaboracion brindada para el tramite de la presente solicitud.'
        : 'Agradezco la atencion prestada y la colaboracion brindada para el tramite de la presente solicitud.';
      const openingText = `Respetuosamente, solicito autorizacion ${requestSubject} ${fechaHoraText}, ${purposeText}.${contextText ? ` ${contextText}` : ''}`;

      oficioCuerpo = [
        openingText,
        closingText
      ].filter(Boolean).join('\n\n');
    }

    const bodyReposicionMinutos = parseInt(req.body.reposicion_minutos, 10);
    const finalReposicionMinutos = isOficio ? 0 : (isNaN(bodyReposicionMinutos) ? 0 : bodyReposicionMinutos);
    const reposicionAplica = !isOficio && finalReposicionMinutos > 0;
    const hasReposicionPlan = Boolean(reposicion.fecha || reposicion.fechaFin || reposicion.horaInicio || reposicion.horaFin);
    const reposicionEstado = reposicionAplica ? (hasReposicionPlan ? 'programada' : 'pendiente') : 'no_aplica';

    const now = new Date();
    const consecutivo = await getNextConsecutivo(now);
    const token = encryptPayload({ purpose: 'reporte_salida_approve', stage: 'jefe', consecutivo }, null);
    const solicitud = await ReporteSalidaSolicitud.create({
      consecutivo,
      user_id: req.user.id,
      documento_id: documento.id,
      jefe_inmediato_user_id: jefe?.id || null,
      solicitante_snapshot: buildSnapshot(req.user),
      jefe_snapshot: jefeSnapshot,
      datos_formulario: {
        tx_id: crypto.randomUUID(),
        adjunto_path: !isSaludNoAdjuntoDeclarado && req.body.datos_formulario?.adjunto_path ? sanitizeText(req.body.datos_formulario.adjunto_path, 255) : null,
        personal: {
          nombre: sanitizeText(req.body.personal?.nombre || req.user.nombre),
          documento: sanitizeText(req.body.personal?.documento || req.user.username),
          correo: sanitizeText(req.user.email)
        },
        laboral: {
          dependencia: cleanDependenciaLabel(req.body.laboral?.dependencia),
          vicerrectoria: sanitizeText(selectedVicerrectoriaName || req.user.vicerrectoria, 220),
          cargo: sanitizeText(req.body.laboral?.cargo)
        },
        salida: {
          tipo: sanitizeText(salida.tipo, 60),
          fecha: sanitizeText(salida.fecha, 20),
          fechaRegreso: sanitizeText(salida.fechaRegreso || salida.fecha, 20),
          horaInicio: sanitizeText(salida.horaInicio, 10),
          horaFin: sanitizeText(salida.horaFin, 10),
          motivo: sanitizeText(salida.motivo, 600),
          entidadDestino: sanitizeText(salida.entidadDestino, 255),
          campusSalida: sanitizeText(salida.campusSalida, 100),
          campusDestino: sanitizeText(salida.campusDestino, 100),
          especialidadMedica: sanitizeText(salida.especialidadMedica, 100),
          terapiasList: salida.terapiasList || [],
          categoria: sanitizeText(salida.categoria || salida.category || '', 100),
          compartirAdjuntoJefe: true,
          noCuentaAdjunto: isSaludNoAdjuntoDeclarado,
          declaracionSinAdjunto,
          alcance: (salida.categoria === 'propias_cargo' && salida.tipo !== 'salida_campus') ? sanitizeText(salida.alcance || 'Local', 100) : 'Local',
          pais: (salida.categoria === 'propias_cargo' && salida.alcance === 'Internacional') ? sanitizeText(salida.pais || '', 100) : '',
          departamento: (salida.categoria === 'propias_cargo' && salida.alcance === 'Nacional') ? sanitizeText(salida.departamento || '', 100) : '',
          municipio: (salida.categoria === 'propias_cargo' && ['Nacional', 'Regional'].includes(salida.alcance)) ? sanitizeText(salida.municipio || '', 100) : '',
          duracionTipo: sanitizeText(salida.duracionTipo || 'menos_media_jornada', 50),
          duracionDias: isOficio ? duracionDiasSolicitada : 0,
          codigoDependencia: sanitizeText(codigoDependencia || '', 50),
          destinatarioTratamiento: sanitizeText(destinatarioTratamiento || '', 100),
          destinatarioNombre: sanitizeText(destinatarioNombre || '', 255),
          destinatarioCargo: sanitizeText(destinatarioCargo || '', 255),
          destinatarioEmpresa: sanitizeText(destinatarioEmpresa || '', 255),
          destinatarioDireccionEmail: sanitizeText(destinatarioDireccionEmail || '', 255),
          destinatarioTelefono: sanitizeText(destinatarioTelefono || '', 100),
          destinatarioUbicacion: sanitizeText(destinatarioUbicacion || '', 255),
          destinatarioPais: sanitizeText(destinatarioPais || '', 100),
          oficioAsunto: sanitizeText(oficioAsunto || '', 500),
          oficioCuerpo: sanitizeText(oficioCuerpo || '', 5000),
          oficioDespedida: sanitizeText(oficioDespedida || '', 100),
          oficioAnexos: sanitizeText(oficioAnexos || '', 1000),
          oficioProyecto: sanitizeText(oficioProyecto || '', 255)
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
      reposicion_aplica: reposicionAplica,
      reposicion_minutos: finalReposicionMinutos,
      reposicion_estado: reposicionEstado,
      aprobacion_jefe_token_hash: hashToken(token),
      trazabilidad: [{ event: 'radicada', actor: buildSnapshot(req.user), at: now.toISOString() }]
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud radicada. Se procesara el envio de correo al jefe inmediato.',
      data: serializeSolicitud(solicitud)
    });

    // Procesar PDF y correos en segundo plano
    Promise.resolve().then(async () => {
      try {
        const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
        const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
        await solicitud.update({ pdf_generado_at: new Date() });
        
        // 1. Enviar correo de radicaciÃ³n al colaborador primero
        const radAttachments = [pdfAttachment];
        if (supportAttachment) radAttachments.push(supportAttachment);
        const radResult = await sendColaboradorRadicacionEmail(solicitud, radAttachments.filter(Boolean));
        
        // Guardamos el messageId por destinatario para mantener el hilo en cada bandeja.
        const thread_message_id = radResult?.messageId || null;
        const dependenciaInfoResult = await sendDependenciaRadicacionInfoEmail(solicitud, token, [pdfAttachment, supportAttachment].filter(Boolean));

        // 2. El jefe inmediato recibe el PDF y el soporte cuando exista.
        const jefeAttachments = [pdfAttachment];
        if (supportAttachment) {
          jefeAttachments.push(supportAttachment);
        }

        const emailResult = await sendJefeRadicacionApprovalEmail(solicitud, token, jefeAttachments.filter(Boolean));
        
        const trazabilidadConDependencia = appendTrace(
          solicitud,
          dependenciaInfoResult.success ? 'correo_dependencia_radicacion_enviado' : 'correo_dependencia_radicacion_omitido',
          req.user,
          { error: dependenciaInfoResult.error || dependenciaInfoResult.reason || '' }
        );

        await solicitud.update({
          correo_jefe_enviado_at: emailResult.success ? new Date() : null,
          datos_formulario: mergeThreadMessageIds(solicitud, {
            thread_message_id,
            thread_message_id_colaborador: thread_message_id,
            thread_message_id_dependencia: dependenciaInfoResult?.messageId,
            thread_message_id_jefe: emailResult?.messageId
          }),
          trazabilidad: appendTrace(
            { trazabilidad: trazabilidadConDependencia },
            emailResult.success ? 'correo_jefe_enviado' : 'correo_jefe_error',
            req.user,
            { error: emailResult.error || '' }
          )
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
      const initialApprovalVia = String(req.body?.via || req.query?.via || '').trim().toLowerCase() === 'dependencia' ? 'dependencia' : 'jefe';
      const initialApprovalActor = getInitialApprovalActor(solicitud, initialApprovalVia);
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
      const authorityAfterBoss = getAuthorityAfterBoss(solicitud);
      const skipAuthorityAfterBoss = authorityAfterBoss && sameEmail(authorityAfterBoss.email, solicitud.jefe_snapshot?.email);
      const skippedVicerrectoria = skipAuthorityAfterBoss && authorityAfterBoss.stage === 'vicerrectoria_academica';
      const skippedRectoriaFromBoss = skipAuthorityAfterBoss && authorityAfterBoss.stage === 'rectoria';
      const shouldGoToRectoriaAfterSkippedVicerrectoria = skippedVicerrectoria && requiresRectoriaApproval(solicitud) && !sameEmail(RECTORIA_EMAIL, solicitud.jefe_snapshot?.email);
      const skippedRectoriaAfterVicerrectoria = skippedVicerrectoria && requiresRectoriaApproval(solicitud) && sameEmail(RECTORIA_EMAIL, solicitud.jefe_snapshot?.email);
      const nextStage = shouldGoToRectoriaAfterSkippedVicerrectoria
        ? 'rectoria'
        : (skipAuthorityAfterBoss ? 'gestion_humana' : (authorityAfterBoss?.stage || 'gestion_humana'));
      const nextEstado = shouldGoToRectoriaAfterSkippedVicerrectoria
        ? 'pendiente_aprobacion_rectoria'
        : (skipAuthorityAfterBoss ? 'pendiente_aprobacion_gestion_humana' : (authorityAfterBoss?.estado || 'pendiente_aprobacion_gestion_humana'));
      const nextTokenColumn = shouldGoToRectoriaAfterSkippedVicerrectoria
        ? 'aprobacion_rectoria_token_hash'
        : (skipAuthorityAfterBoss ? 'aprobacion_gh_token_hash' : (authorityAfterBoss?.tokenColumn || 'aprobacion_gh_token_hash'));
      const nextToken = createApprovalToken(nextStage, solicitud.consecutivo);
      const baseTrace = appendTrace(
        solicitud,
        authorityAfterBoss
          ? (initialApprovalVia === 'dependencia' ? 'visto_bueno_dependencia' : 'visto_bueno_jefe')
          : (initialApprovalVia === 'dependencia' ? 'aprobada_dependencia' : 'aprobada_jefe'),
        initialApprovalActor,
        { via: initialApprovalVia }
      );
      const skippedTrace = [
        ...(skippedVicerrectoria ? [{
          event: 'aprobada_vicerrectoria_academica',
          actor: { nombre: authorityAfterBoss.name, email: authorityAfterBoss.email, role: 'vicerrectoria' },
          detail: { omitido_envio_correo: true, motivo: 'mismo_correo_que_jefe_inmediato' },
          at: new Date().toISOString()
        }] : []),
        ...(skippedRectoriaFromBoss || skippedRectoriaAfterVicerrectoria ? [{
          event: 'aprobada_rectoria',
          actor: { nombre: 'Rectoria', email: RECTORIA_EMAIL, role: 'rectoria' },
          detail: { omitido_envio_correo: true, motivo: 'mismo_correo_que_etapa_anterior' },
          at: new Date().toISOString()
        }] : [])
      ];
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: nextEstado,
        jefe_aprobado_at: new Date(),
        ...(skippedVicerrectoria ? { vicerrectoria_aprobado_at: new Date() } : {}),
        ...(skippedRectoriaFromBoss || skippedRectoriaAfterVicerrectoria ? { rectoria_aprobado_at: new Date() } : {}),
        aprobacion_jefe_token_hash: null,
        [nextTokenColumn]: hashToken(nextToken),
        trazabilidad: [...baseTrace, ...skippedTrace]
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
      const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
      const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
      const nextAttachments = [pdfAttachment, supportAttachment].filter(Boolean);
      const emailResult = nextStage === 'rectoria'
        ? await sendAuthorityApprovalEmail({
            solicitud,
            token: nextToken,
            authorityName: 'Rectoria',
            authorityEmail: RECTORIA_EMAIL,
            stageLabel: 'Rectoria',
            attachments: nextAttachments
          })
        : nextStage === 'vicerrectoria_academica'
          ? await sendAuthorityApprovalEmail({
              solicitud,
              token: nextToken,
              authorityName: authorityAfterBoss.name,
              authorityEmail: authorityAfterBoss.email,
              stageLabel: authorityAfterBoss.label,
              attachments: nextAttachments
            })
        : await sendGestionHumanaApprovalEmail(solicitud, nextToken, nextAttachments);
      const nextThreadKey = nextStage === 'rectoria'
        ? 'thread_message_id_rectoria'
        : nextStage === 'vicerrectoria_academica'
          ? 'thread_message_id_vicerrectoria'
          : 'thread_message_id_gestion_humana';
      await solicitud.update({
        ...(nextStage === 'rectoria'
          ? { correo_rectoria_enviado_at: emailResult.success ? new Date() : null }
          : nextStage === 'vicerrectoria_academica'
            ? { correo_vicerrectoria_enviado_at: emailResult.success ? new Date() : null }
            : { correo_gh_enviado_at: emailResult.success ? new Date() : null }),
        datos_formulario: mergeThreadMessageIds(solicitud, {
          [nextThreadKey]: emailResult?.messageId
        }),
        trazabilidad: appendTrace(solicitud, emailResult.success
          ? (nextStage === 'rectoria' ? 'correo_rectoria_enviado' : (nextStage === 'vicerrectoria_academica' ? 'correo_vicerrectoria_academica_enviado' : 'correo_gestion_humana_enviado'))
          : (nextStage === 'rectoria' ? 'correo_rectoria_error' : (nextStage === 'vicerrectoria_academica' ? 'correo_vicerrectoria_academica_error' : 'correo_gestion_humana_error')), null, { error: emailResult.error || '' })
      });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Aprobacion registrada',
        message: initialApprovalVia === 'dependencia'
          ? 'La autorizacion fue registrada por la dependencia y la solicitud continuo el flujo correspondiente.'
          : 'La solicitud fue enviada a Gestion del Talento Humano para revision y aprobacion.',
        solicitud,
        nextStep: 'Gestion del Talento Humano recibira el correo con el PDF diligenciado para continuar el flujo.'
      });
    }

    if (payload.stage === 'vicerrectoria_academica') {
      if (solicitud.estado !== 'pendiente_aprobacion_vicerrectoria_academica') {
        const isRechazada = solicitud.estado === 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isRechazada ? 'Solicitud rechazada' : 'Solicitud ya procesada',
          message: isRechazada ? 'Esta solicitud fue rechazada anteriormente y no puede ser aprobada.' : 'Esta aprobacion ya fue registrada previamente.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional desde este enlace.'
        });
      }
      if (solicitud.aprobacion_vicerrectoria_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token de aprobacion esperado para la Vicerrectoria.',
          solicitud,
          nextStep: 'Por seguridad, la aprobacion no fue registrada.'
        });
      }

      const vicerrectoriaName = getSolicitudVicerrectoria(solicitud) || 'Vicerrectoria';
      const vicerrectoriaEmail = getDependencyEmail(vicerrectoriaName) || ACADEMIC_VICERRECTORIA_EMAIL;
      const goesToRectoria = requiresRectoriaApproval(solicitud);
      const skipRectoriaAfterVicerrectoria = goesToRectoria && sameEmail(RECTORIA_EMAIL, vicerrectoriaEmail);
      const nextStage = goesToRectoria && !skipRectoriaAfterVicerrectoria ? 'rectoria' : 'gestion_humana';
      const nextToken = createApprovalToken(nextStage, solicitud.consecutivo);
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: goesToRectoria && !skipRectoriaAfterVicerrectoria ? 'pendiente_aprobacion_rectoria' : 'pendiente_aprobacion_gestion_humana',
        vicerrectoria_aprobado_at: new Date(),
        ...(skipRectoriaAfterVicerrectoria ? { rectoria_aprobado_at: new Date() } : {}),
        aprobacion_vicerrectoria_token_hash: null,
        ...(goesToRectoria && !skipRectoriaAfterVicerrectoria
          ? { aprobacion_rectoria_token_hash: hashToken(nextToken) }
          : { aprobacion_gh_token_hash: hashToken(nextToken) }),
        trazabilidad: [
          ...appendTrace(solicitud, 'aprobada_vicerrectoria_academica', { nombre: vicerrectoriaName, email: vicerrectoriaEmail, role: 'vicerrectoria' }),
          ...(skipRectoriaAfterVicerrectoria ? [{
            event: 'aprobada_rectoria',
            actor: { nombre: 'Rectoria', email: RECTORIA_EMAIL, role: 'rectoria' },
            detail: { omitido_envio_correo: true, motivo: 'mismo_correo_que_vicerrectoria' },
            at: new Date().toISOString()
          }] : [])
        ]
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_vicerrectoria_academica',
          aprobacion_vicerrectoria_token_hash: tokenHash
        }
      });
      if (!updatedCount) {
        await solicitud.reload();
        return renderApprovalPage({ res, tone: 'info', title: 'Solicitud ya procesada', message: 'Esta aprobacion ya fue registrada previamente.', solicitud, nextStep: 'El boton de aprobacion ya fue utilizado.' });
      }
      await solicitud.reload();
      const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
      const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
      const nextAttachments = [pdfAttachment, supportAttachment].filter(Boolean);
      const emailResult = goesToRectoria && !skipRectoriaAfterVicerrectoria
        ? await sendAuthorityApprovalEmail({
            solicitud,
            token: nextToken,
            authorityName: 'Rectoria',
            authorityEmail: RECTORIA_EMAIL,
            stageLabel: 'Rectoria',
            attachments: nextAttachments
          })
        : await sendGestionHumanaApprovalEmail(solicitud, nextToken, nextAttachments);
      await solicitud.update({
        ...(goesToRectoria && !skipRectoriaAfterVicerrectoria
          ? { correo_rectoria_enviado_at: emailResult.success ? new Date() : null }
          : { correo_gh_enviado_at: emailResult.success ? new Date() : null }),
        datos_formulario: mergeThreadMessageIds(solicitud, {
          [goesToRectoria && !skipRectoriaAfterVicerrectoria ? 'thread_message_id_rectoria' : 'thread_message_id_gestion_humana']: emailResult?.messageId
        }),
        trazabilidad: appendTrace(solicitud, emailResult.success
          ? (goesToRectoria && !skipRectoriaAfterVicerrectoria ? 'correo_rectoria_enviado' : 'correo_gestion_humana_enviado')
          : (goesToRectoria && !skipRectoriaAfterVicerrectoria ? 'correo_rectoria_error' : 'correo_gestion_humana_error'), null, { error: emailResult.error || '' })
      });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Aprobacion registrada',
        message: goesToRectoria ? 'La solicitud fue enviada a Rectoria para aprobacion.' : 'La solicitud fue enviada a Gestion del Talento Humano para revision y aprobacion.',
        solicitud,
        nextStep: goesToRectoria ? 'Rectoria recibira el correo con el PDF diligenciado para continuar el flujo.' : 'Gestion del Talento Humano recibira el correo con el PDF diligenciado para continuar el flujo.'
      });
    }

    if (payload.stage === 'rectoria') {
      if (solicitud.estado !== 'pendiente_aprobacion_rectoria') {
        const isRechazada = solicitud.estado === 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isRechazada ? 'Solicitud rechazada' : 'Solicitud ya procesada',
          message: isRechazada ? 'Esta solicitud fue rechazada anteriormente y no puede ser aprobada.' : 'Esta aprobacion ya fue registrada previamente.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional desde este enlace.'
        });
      }
      if (solicitud.aprobacion_rectoria_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token de aprobacion esperado para Rectoria.',
          solicitud,
          nextStep: 'Por seguridad, la aprobacion no fue registrada.'
        });
      }
      const ghToken = createApprovalToken('gestion_humana', solicitud.consecutivo);
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'pendiente_aprobacion_gestion_humana',
        rectoria_aprobado_at: new Date(),
        aprobacion_rectoria_token_hash: null,
        aprobacion_gh_token_hash: hashToken(ghToken),
        trazabilidad: appendTrace(solicitud, 'aprobada_rectoria', { nombre: 'Rectoria', email: RECTORIA_EMAIL, role: 'rectoria' })
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_rectoria',
          aprobacion_rectoria_token_hash: tokenHash
        }
      });
      if (!updatedCount) {
        await solicitud.reload();
        return renderApprovalPage({ res, tone: 'info', title: 'Solicitud ya procesada', message: 'Esta aprobacion ya fue registrada previamente.', solicitud, nextStep: 'El boton de aprobacion ya fue utilizado.' });
      }
      await solicitud.reload();
      const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
      const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
      const emailResult = await sendGestionHumanaApprovalEmail(solicitud, ghToken, [pdfAttachment, supportAttachment].filter(Boolean));
      await solicitud.update({
        correo_gh_enviado_at: emailResult.success ? new Date() : null,
        datos_formulario: mergeThreadMessageIds(solicitud, {
          thread_message_id_gestion_humana: emailResult?.messageId
        }),
        trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_gestion_humana_enviado' : 'correo_gestion_humana_error', null, { error: emailResult.error || '' })
      });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Aprobacion registrada',
        message: 'La solicitud fue enviada a Gestion del Talento Humano para revision y aprobacion.',
        solicitud,
        nextStep: 'Gestion del Talento Humano recibira el correo con el PDF diligenciado para continuar el flujo.'
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
          message: 'El enlace no coincide con el token de aprobacion esperado para Gestion del Talento Humano.',
          solicitud,
          nextStep: 'Por seguridad, la aprobacion no fue registrada.'
        });
      }
      const isMisionalNacionalOInternacional = requiresSstApproval(solicitud);

      if (isMisionalNacionalOInternacional) {
        const sstToken = encryptPayload({ purpose: 'reporte_salida_approve', stage: 'sst', consecutivo: solicitud.consecutivo }, null);
        const [updatedCount] = await ReporteSalidaSolicitud.update({
          estado: 'pendiente_aprobacion_sst',
          gestion_humana_aprobado_at: new Date(),
          aprobacion_gh_token_hash: null,
          aprobacion_sst_token_hash: hashToken(sstToken),
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
        const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
        const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
        const emailResult = await sendSSTApprovalEmail(solicitud, sstToken, [pdfAttachment, supportAttachment].filter(Boolean));
        await solicitud.update({
          correo_sst_enviado_at: emailResult.success ? new Date() : null,
          datos_formulario: mergeThreadMessageIds(solicitud, {
            thread_message_id_sst: emailResult?.messageId
          }),
          trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_sst_enviado' : 'correo_sst_error', null, { error: emailResult.error || '' })
        });
        return renderApprovalPage({
          res,
          tone: 'success',
          title: 'Aprobacion registrada',
          message: 'La solicitud fue enviada a Seguridad y Salud en el Trabajo para su aprobacion.',
          solicitud,
          nextStep: 'SST recibira el correo con el PDF diligenciado para continuar el flujo.'
        });
      } else {
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
        const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
        const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
        const results = await sendFinalEmails(solicitud, pdfAttachment, supportAttachment);
        deleteSupportFile(solicitud);
        await solicitud.update({
          correo_usuario_enviado_at: results.userResult.success ? new Date() : null,
          correo_sst_enviado_at: results.sstResult.success ? new Date() : null,
          enviado_sst_at: results.sstResult.success ? new Date() : null,
          trazabilidad: appendTrace(solicitud, 'notificacion_final_enviada', null, {
            usuario: results.userResult.success,
            dependencia: results.depResult.success,
            dependencia_destinatarios: results.depResult.recipients || [],
            dependencia_error: results.depResult.error || '',
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
    }

    if (payload.stage === 'sst') {
      if (solicitud.estado !== 'pendiente_aprobacion_sst') {
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
      if (solicitud.aprobacion_sst_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token de aprobacion esperado para SST.',
          solicitud,
          nextStep: 'Por seguridad, la aprobacion no fue registrada.'
        });
      }
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'finalizada',
        finalizado_at: new Date(),
        aprobacion_sst_token_hash: null,
        trazabilidad: appendTrace(solicitud, 'aprobada_sst', { nombre: 'Seguridad y Salud en el Trabajo', role: 'sst' })
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_sst',
          aprobacion_sst_token_hash: tokenHash
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
      const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
      const supportAttachment = buildReporteSalidaSupportAttachment(solicitud);
      const results = await sendFinalEmails(solicitud, pdfAttachment, supportAttachment);
      deleteSupportFile(solicitud);
      await solicitud.update({
        correo_usuario_enviado_at: results.userResult.success ? new Date() : null,
        correo_sst_enviado_at: results.sstResult.success ? new Date() : null,
        enviado_sst_at: results.sstResult.success ? new Date() : null,
        trazabilidad: appendTrace(solicitud, 'notificacion_final_enviada', null, {
          usuario: results.userResult.success,
          dependencia: results.depResult.success,
          dependencia_destinatarios: results.depResult.recipients || [],
          dependencia_error: results.depResult.error || '',
          sst: results.sstResult.success
        })
      });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Aprobacion registrada',
        message: 'Se notifico al usuario y se envio el PDF finalizado.',
        solicitud,
        nextStep: 'El flujo quedo finalizado.'
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
      return res.status(403).json({ success: false, message: 'No tienes permiso para actualizar la reposiciÃ³n de esta solicitud.' });
    }
    if (!solicitud.reposicion_aplica) {
      return res.status(400).json({ success: false, message: 'Esta solicitud no requiere reposicion de tiempo.' });
    }
    if (solicitud.estado !== 'finalizada') {
      return res.status(400).json({ success: false, message: 'La reposicion solo puede validarse cuando el reporte esta finalizado por Gestion del Talento Humano.' });
    }

    let nextEstado = sanitizeText(req.body?.estado, 40);
    const horasAbonadas = parseFloat(req.body?.horasAbonadas) || 0;
    if (horasAbonadas <= 0) {
      return res.status(400).json({ success: false, message: 'La cantidad de horas a abonar debe ser mayor que cero.' });
    }
    const minutosAbonados = Math.round(horasAbonadas * 60);

    const previousData = solicitud.datos_formulario || {};
    const minutosYaPagados = previousData.reposicion_minutos_pagados || 0;
    const tiempoTotal = solicitud.reposicion_minutos || solicitud.tiempo_solicitado_minutos || 0;

    if (minutosYaPagados >= tiempoTotal && tiempoTotal > 0) {
      return res.status(400).json({ success: false, message: 'La reposiciÃ³n para esta solicitud ya ha sido completada en su totalidad.' });
    }

    const minutosPendientes = tiempoTotal - minutosYaPagados;
    if (minutosAbonados > minutosPendientes) {
      const horasPendientes = (minutosPendientes / 60).toFixed(2);
      return res.status(400).json({
        success: false,
        message: `La cantidad de horas ingresada (${horasAbonadas}h) excede el saldo de tiempo pendiente de reponer (${horasPendientes}h).`
      });
    }

    const nuevoTotalPagados = minutosYaPagados + minutosAbonados;

    if (nuevoTotalPagados >= tiempoTotal && tiempoTotal > 0) {
      if (req.body?.estado === 'pendiente') {
        return res.status(400).json({
          success: false,
          message: 'No se puede guardar la reposiciÃ³n en estado "Pendiente" si se ha completado la totalidad de las horas.'
        });
      }
      nextEstado = 'cumplida';
    } else {
      nextEstado = 'pendiente';
    }

    if (!['pendiente', 'cumplida'].includes(nextEstado)) {
      return res.status(400).json({ success: false, message: 'Estado de reposicion no valido.' });
    }

    const observacionNueva = sanitizeText(req.body?.observacion, 600);
    const now = new Date();
    
    let observacionAcumulada = solicitud.observacion_gestion_humana || '';
    const formattedTime = now.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const actorName = req.user.nombre || 'Gestion del Talento Humano';
    const msgComentario = observacionNueva ? ` - "${observacionNueva}"` : '';
    const entradaLog = `[${formattedTime}] ${actorName}: AbonÃ³ ${horasAbonadas} hrs${msgComentario}`;
    
    observacionAcumulada = observacionAcumulada 
      ? `${observacionAcumulada}\n${entradaLog}`
      : entradaLog;
    
    await solicitud.update({
      reposicion_estado: nextEstado,
      observacion_gestion_humana: observacionAcumulada,
      datos_formulario: {
        ...previousData,
        reposicion_minutos_pagados: nuevoTotalPagados,
        reposicion_validacion: {
          estado: nextEstado,
          observacion: observacionNueva,
          horas_abonadas_esta_sesion: horasAbonadas,
          validado_por: buildSnapshot(req.user),
          validado_at: now.toISOString()
        }
      },
      trazabilidad: appendTrace(solicitud, `reposicion_${nextEstado}`, req.user, { observacion: observacionNueva, horas_abonadas: horasAbonadas })
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

    const grupoId = solicitud.datos_formulario?.grupo_id;
    if (grupoId) {
      const solicitudesGrupo = await ReporteSalidaSolicitud.findAll({
        where: sequelize.literal(`datos_formulario->>'grupo_id' = :grupoId`),
        replacements: { grupoId }
      });
      for (const s of solicitudesGrupo) {
        await s.destroy();
      }
      return res.json({ success: true, message: `Salida grupal eliminada correctamente (${solicitudesGrupo.length} registros).` });
    }

    await solicitud.destroy();
    res.json({ success: true, message: 'Solicitud eliminada correctamente.' });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'No se pudo eliminar la solicitud.',
      error: error.message,
      detail: error.original?.detail || null
    });
  }
};

const limpiarMocks = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const deletedCount = await ReporteSalidaSolicitud.destroy({
      where: {
        consecutivo: {
          [Op.like]: 'RS-MOCK-%'
        }
      }
    });
    res.json({
      success: true,
      message: `Se eliminaron ${deletedCount} registros de prueba de manera exitosa.`
    });
  } catch (error) {
    console.error('Error al limpiar mocks:', error);
    res.status(500).json({
      success: false,
      message: 'No se pudo limpiar los datos de prueba.',
      error: error.message
    });
  }
};

const editarSolicitudAdmin = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const solicitud = await ReporteSalidaSolicitud.findByPk(req.params.id);
    if (!solicitud) {
      return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
    }

    const { estado, reposicion_aplica, tiempo_solicitado_minutos, reposicion_minutos_pagados, observacion } = req.body;
    const estadoSolicitado = sanitizeText(estado, 50);
    const observacionAdmin = sanitizeText(observacion, 600);

    if (
      solicitud.estado === 'pendiente_aprobacion_gestion_humana' &&
      ['finalizada', 'no_aprobada'].includes(estadoSolicitado)
    ) {
      if (estadoSolicitado === 'no_aprobada' && !observacionAdmin) {
        return res.status(400).json({ success: false, message: 'Debe ingresar la justificacion del rechazo.' });
      }

      const now = new Date();
      const actorName = req.user.nombre || 'Gestion del Talento Humano';
      const nextTraceEvent = estadoSolicitado === 'finalizada' ? 'aprobada_gestion_humana' : 'rechazada_gestion_humana';
      const nextTraceDetail = estadoSolicitado === 'finalizada'
        ? { aprobada_desde: 'modulo_gestion_humana' }
        : {
            actorName,
            justificacion: observacionAdmin
          };

      const updateData = {
        estado: estadoSolicitado,
        trazabilidad: appendTrace(solicitud, nextTraceEvent, req.user, nextTraceDetail)
      };

      if (estadoSolicitado === 'finalizada') {
        updateData.gestion_humana_aprobado_at = now;
        updateData.finalizado_at = now;
      }

      if (observacionAdmin) {
        const logEntry = `[${now.toLocaleString('es-CO', {
          timeZone: 'America/Bogota',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        })}] ${actorName}: ${estadoSolicitado === 'finalizada' ? 'Aprobacion administrativa GH' : 'Rechazo administrativo GH'}${observacionAdmin ? ` - "${observacionAdmin}"` : ''}`;
        updateData.observacion_gestion_humana = solicitud.observacion_gestion_humana
          ? `${solicitud.observacion_gestion_humana}\n${logEntry}`
          : logEntry;
      }

      await solicitud.update(updateData);
      await solicitud.reload();

      if (estadoSolicitado === 'finalizada') {
        const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
        const userEmailResult = await sendIndividualColaboradorFinalEmail(solicitud, pdfAttachment);
        await solicitud.update({
          correo_usuario_enviado_at: userEmailResult.success ? new Date() : null,
          trazabilidad: appendTrace(solicitud, userEmailResult.success ? 'correo_usuario_enviado' : 'correo_usuario_error', null, { error: userEmailResult.error || '' })
        });
        await solicitud.reload();
        return res.json({
          success: true,
          message: 'Solicitud aprobada correctamente desde Gestion del Talento Humano.',
          data: serializeSolicitud(solicitud)
        });
      }

      deleteSupportFile(solicitud);
      await sendGHRejectionEmails({ solicitud, justificacion: observacionAdmin });
      return res.json({
        success: true,
        message: 'Solicitud rechazada correctamente desde Gestion del Talento Humano.',
        data: serializeSolicitud(solicitud)
      });
    }

    const updateData = {};
    const logDetails = [];

    if (estadoSolicitado && estadoSolicitado !== solicitud.estado) {
      updateData.estado = estadoSolicitado;
      logDetails.push(`Estado a "${estadoSolicitado.replace(/_/g, ' ')}"`);
    }

    if (reposicion_aplica !== undefined && Boolean(reposicion_aplica) !== solicitud.reposicion_aplica) {
      updateData.reposicion_aplica = Boolean(reposicion_aplica);
      logDetails.push(`Aplica reposiciÃ³n: ${updateData.reposicion_aplica ? 'SÃƒÂ' : 'NO'}`);
    }

    if (tiempo_solicitado_minutos !== undefined) {
      const nuevoMinutos = parseInt(tiempo_solicitado_minutos, 10);
      const antiguoMinutos = solicitud.tiempo_solicitado_minutos || 0;
      if (nuevoMinutos !== antiguoMinutos) {
        updateData.tiempo_solicitado_minutos = nuevoMinutos;
        updateData.reposicion_minutos = nuevoMinutos;
        logDetails.push(`Horas adeudadas de ${(antiguoMinutos / 60).toFixed(0)}h a ${(nuevoMinutos / 60).toFixed(0)}h`);
      }
    }

    const previousData = solicitud.datos_formulario || {};
    const antiguoPagados = previousData.reposicion_minutos_pagados || 0;
    let nuevoPagados = antiguoPagados;

    if (reposicion_minutos_pagados !== undefined) {
      nuevoPagados = parseInt(reposicion_minutos_pagados, 10);
      if (nuevoPagados !== antiguoPagados) {
        logDetails.push(`Horas abonadas corregidas de ${(antiguoPagados / 60).toFixed(0)}h a ${(nuevoPagados / 60).toFixed(0)}h`);
        updateData.datos_formulario = {
          ...previousData,
          reposicion_minutos_pagados: nuevoPagados
        };
      }
    }

    const finalAplica = updateData.reposicion_aplica !== undefined 
      ? updateData.reposicion_aplica 
      : solicitud.reposicion_aplica;

    const finalMinutos = updateData.reposicion_minutos !== undefined 
      ? updateData.reposicion_minutos 
      : (solicitud.reposicion_minutos || solicitud.tiempo_solicitado_minutos || 0);

    let nextReposicionEstado = solicitud.reposicion_estado;

    if (!finalAplica) {
      nextReposicionEstado = 'no_aplica';
    } else {
      if (nuevoPagados >= finalMinutos && finalMinutos > 0) {
        nextReposicionEstado = 'cumplida';
      } else {
        nextReposicionEstado = 'pendiente';
      }
    }

    if (nextReposicionEstado !== solicitud.reposicion_estado) {
      updateData.reposicion_estado = nextReposicionEstado;
      logDetails.push(`ReposiciÃ³n a "${nextReposicionEstado}"`);
    }

    const commentValidador = sanitizeText(observacion, 600);
    const now = new Date();
    const formattedTime = now.toLocaleString('es-CO', {
      timeZone: 'America/Bogota',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    const actorName = req.user.nombre || 'Administrador del Sistema';

    let logEntry = '';
    if (logDetails.length > 0) {
      const msgComment = commentValidador ? ` - "${commentValidador}"` : '';
      logEntry = `[${formattedTime}] ${actorName}: EdiciÃ³n Administrativa (${logDetails.join(', ')})${msgComment}`;
    } else if (commentValidador) {
      logEntry = `[${formattedTime}] ${actorName}: Comentario - "${commentValidador}"`;
    }

    if (logEntry) {
      let observacionAcumulada = solicitud.observacion_gestion_humana || '';
      updateData.observacion_gestion_humana = observacionAcumulada 
        ? `${observacionAcumulada}\n${logEntry}`
        : logEntry;
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

const renderRejectionFormPage = ({ res, solicitud, token, stage, via }) => {
  const consecutivo = solicitud?.consecutivo || '';
  const solicitante = solicitud?.solicitante_snapshot?.nombre || '';
  const safeConsecutivo = escapeHtml(consecutivo);
  const safeSolicitante = escapeHtml(solicitante);
  const safeActionUrl = escapeHtml(`${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/rechazar/${encodeURIComponent(token)}`);
  const safeVia = escapeHtml(String(via || '').trim().toLowerCase() === 'dependencia' ? 'dependencia' : '');
  const stageLabel = stage === 'jefe' ? 'Jefe Inmediato' : 'Gestion del Talento Humano';

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
      grid-template-columns: repeat(2, minmax(0, 1fr));
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
          <p class="message">Por favor ingrese la justificacion del rechazo. Este motivo sera enviado al/a la colaborador(a).</p>
        </div>
      </div>
      <div class="details">
        <div class="detail"><div class="label">Solicitud</div><div class="value">${safeConsecutivo}</div></div>
        <div class="detail"><div class="label">Colaborador(a)</div><div class="value">${safeSolicitante || 'No disponible'}</div></div>
      </div>
      <form method="POST" action="${safeActionUrl}">
        <input type="hidden" name="via" value="${safeVia}">
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
  const subject = getUserThreadSubject(solicitud);
  const headers = getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_colaborador'));
  const html = renderInstitutionalTemplate({
    title: 'Reporte de salida no aprobado',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(solicitante.nombre)}</p><p>Reciba un cordial saludo. En atenciÃ³n a su solicitud de reporte de salida con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong>, lamentamos informarle que la solicitud ha sido marcada como no aprobada por su jefe inmediato, <strong>${escapeHtml(rejectedBy)}</strong>.</p>`,
    bodyHtml: `
      <p><strong>Motivo / Justificacion del rechazo:</strong></p>
      <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
        ${escapeHtml(justificacion)}
      </div>
      <p>Consulte mas informacion en el modulo de Seguimiento a reportes del sistema SIAC.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #b91c1c;">${escapeHtml(rejectedBy)}</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Jefe Inmediato</p>
    `
  });
  return sendInstitutionalEmail({
    to: solicitante.email,
    subject,
    text: `Su solicitud ${solicitud.consecutivo} fue rechazada por ${rejectedBy}. Motivo: ${justificacion}`,
    html,
    headers
  });
};

const sendGHRejectionEmails = async ({ solicitud, justificacion, isSST = false }) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const jefe = solicitud.jefe_snapshot || {};
  
  const actorName = isSST ? 'Seguridad y Salud en el Trabajo' : 'Gestion del Talento Humano';
  
  const userSubject = getUserThreadSubject(solicitud);
  const userHeaders = getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_colaborador'));
  const userHtml = renderInstitutionalTemplate({
    title: `Reporte de salida no aprobado por ${actorName}`,
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(solicitante.nombre)}</p><p>Reciba un cordial saludo. En atenciÃ³n a su trÃ¡mite de reporte de salida con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong>, lamentamos informarle que la solicitud ha sido marcada como no aprobada por parte del <strong>${escapeHtml(actorName)}</strong>.</p>`,
    bodyHtml: `
      <p><strong>Motivo / Justificacion del rechazo:</strong></p>
      <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
        ${escapeHtml(justificacion)}
      </div>
      <p>Consulte mas informacion en el modulo de Seguimiento a reportes del sistema SIAC.</p>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #b91c1c;">Equipo de ${escapeHtml(actorName)}</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Universidad CESMAG</p>
    `
  });

  const bossSubject = getWorkflowThreadSubject(solicitud);
  const bossHeaders = getThreadHeadersFromId(getThreadMessageId(solicitud, 'thread_message_id_jefe'));
  const bossHtml = renderInstitutionalTemplate({
    title: 'Notificacion de rechazo de reporte de salida',
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0; color: #475569;">Estimado(a) Sr(a).</p><p style="margin: 0 0 16px 0; font-size: 16px; font-weight: bold; color: #0b3a6f;">${escapeHtml(jefe.nombre)}</p><p>Reciba un cordial saludo. En atenciÃ³n al seguimiento de personal a su cargo, le informamos que la solicitud de reporte de salida del/de la colaborador(a) <strong>${escapeHtml(solicitante.nombre)}</strong> con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong> ha sido devuelta como no aprobada por parte del <strong>${escapeHtml(actorName)}</strong>.</p>`,
    bodyHtml: `
      <p><strong>Motivo / Justificacion del rechazo:</strong></p>
      <div style="margin:15px 0;padding:12px 16px;background:#fef2f2;border-left:4px solid #e11d48;color:#1e293b;font-style:italic;border-radius:4px;">
        ${escapeHtml(justificacion)}
      </div>
    `,
    senderHtml: `
      <p style="margin: 0; font-weight: bold; color: #b91c1c;">Equipo de ${escapeHtml(actorName)}</p>
      <p style="margin: 2px 0 0 0; font-size: 12px; color: #64748b;">Universidad CESMAG</p>
    `
  });

  const userResult = await sendInstitutionalEmail({
    to: solicitante.email,
    subject: userSubject,
    text: `Su solicitud ${solicitud.consecutivo} fue rechazada por ${actorName}. Motivo: ${justificacion}`,
    html: userHtml,
    headers: userHeaders
  });

  let bossResult = { success: false };
  const jefeEmail = getInitialApprovalRecipientEmail(solicitud);
  if (jefeEmail) {
    bossResult = await sendInstitutionalEmail({
      to: jefeEmail,
      subject: bossSubject,
      text: `La solicitud ${solicitud.consecutivo} del/de la colaborador(a) ${solicitante.nombre} fue rechazada por ${actorName}. Motivo: ${justificacion}`,
      html: bossHtml,
      headers: bossHeaders
    });
  }

  return { userResult, bossResult };
};const renderAutoApprovePage = ({ res, actionUrl }) => {
  return res.type('html').send(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Procesando AprobaciÃ³n | SIAC UNICESMAG</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      background: #f8fbff;
      color: #0f172a;
      font-family: Inter, "Segoe UI", Arial, sans-serif;
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .loader-container {
      text-align: center;
    }
    .spinner {
      width: 50px;
      height: 50px;
      border: 5px solid #dbe6f5;
      border-top-color: #0b3a6f;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 20px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    h2 { margin: 0 0 8px; color: #0b1730; font-size: 20px; }
    p { margin: 0; color: #64748b; font-size: 14px; }
  </style>
</head>
<body>
  <div class="loader-container">
    <div class="spinner"></div>
    <h2>Procesando solicitud...</h2>
    <p>Por favor espere un momento mientras se registra la aprobaciÃ³n.</p>
  </div>
  <form id="auto-form" action="${escapeHtml(actionUrl)}" method="POST"></form>
  <script>
    document.getElementById('auto-form').submit();
  </script>
</body>
</html>`);
};

const mostrarFormularioAprobacion = async (req, res) => {
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
        message: 'El enlace no corresponde a una solicitud valida.',
        nextStep: 'Verifique que esta usando el boton original recibido en el correo.'
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
    
    // Validar si ya fue procesada en esta etapa
    if (payload.stage === 'jefe') {
      if (solicitud.estado !== 'pendiente_aprobacion_jefe') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente.' 
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
          nextStep: 'Por seguridad, no se puede procesar.'
        });
      }
    } else if (payload.stage === 'vicerrectoria_academica') {
      if (solicitud.estado !== 'pendiente_aprobacion_vicerrectoria_academica') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada
            ? 'Esta solicitud ya fue aprobada anteriormente.'
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de la Vicerrectoria.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_vicerrectoria_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para la Vicerrectoria.',
          solicitud,
          nextStep: 'Por seguridad, no se puede procesar.'
        });
      }
    } else if (payload.stage === 'rectoria') {
      if (solicitud.estado !== 'pendiente_aprobacion_rectoria') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada
            ? 'Esta solicitud ya fue aprobada anteriormente.'
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Rectoria.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_rectoria_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para Rectoria.',
          solicitud,
          nextStep: 'Por seguridad, no se puede procesar.'
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
            ? 'Esta solicitud ya fue aprobada anteriormente.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Gestion del Talento Humano.',
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
          message: 'El enlace no coincide con el token esperado para Gestion del Talento Humano.',
          solicitud,
          nextStep: 'Por seguridad, no se puede procesar.'
        });
      }
    } else if (payload.stage === 'sst') {
      if (solicitud.estado !== 'pendiente_aprobacion_sst') {
        const isAprobada = solicitud.estado === 'finalizada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de SST.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_sst_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para SST.',
          solicitud,
          nextStep: 'Por seguridad, no se puede procesar.'
        });
      }
    }

    return renderAutoApprovePage({ res, actionUrl: req.originalUrl });
  } catch (error) {
    console.error('Error mostrando formulario de aprobacion:', error);
    return renderApprovalPage({
      res,
      status: 500,
      tone: 'error',
      title: 'Error de servidor',
      message: 'Ocurrio un error al cargar el formulario de aprobacion.',
      nextStep: 'Intente nuevamente mas tarde.'
    });
  }
};

const mostrarFormularioAprobacionGrupo = async (req, res) => {
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
        nextStep: 'Verifique que esta usando el boton original recibido en el correo.'
      });
    }
    const { grupo_id } = payload;
    const tokenHash = hashToken(req.params.token);
    const solicitudes = await ReporteSalidaSolicitud.findAll({
      where: {
        datos_formulario: {
          [Op.contains]: { grupo_id }
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
        message: 'Este grupo ya no se encuentra pendiente de aprobacion de Gestion del Talento Humano.',
        nextStep: 'No es necesario realizar ninguna accion adicional.'
      });
    }

    const solicitudEjemplo = solicitudes[0];

    return renderAutoApprovePage({ res, actionUrl: req.originalUrl });
  } catch (error) {
    console.error('Error mostrando formulario de aprobacion de grupo:', error);
    return renderApprovalPage({
      res,
      status: 500,
      tone: 'error',
      title: 'Error de servidor',
      message: 'Ocurrio un error al cargar el formulario de aprobacion de grupo.',
      nextStep: 'Intente nuevamente mas tarde.'
    });
  }
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
    } else if (payload.stage === 'vicerrectoria_academica') {
      if (solicitud.estado !== 'pendiente_aprobacion_vicerrectoria_academica') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.'
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de la Vicerrectoria.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_vicerrectoria_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para la Vicerrectoria.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }
    } else if (payload.stage === 'rectoria') {
      if (solicitud.estado !== 'pendiente_aprobacion_rectoria') {
        const isAprobada = solicitud.estado !== 'no_aprobada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.'
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Rectoria.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_rectoria_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para Rectoria.',
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
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Gestion del Talento Humano.',
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
          message: 'El enlace no coincide con el token esperado para Gestion del Talento Humano.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }
    } else if (payload.stage === 'sst') {
      if (solicitud.estado !== 'pendiente_aprobacion_sst') {
        const isAprobada = solicitud.estado === 'finalizada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de SST.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_sst_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para SST.',
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
      stage: payload.stage,
      via: req.query?.via
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

    if (payload.stage === 'vicerrectoria_academica' || payload.stage === 'rectoria') {
      const isVicerrectoriaStage = payload.stage === 'vicerrectoria_academica';
      const expectedEstado = isVicerrectoriaStage ? 'pendiente_aprobacion_vicerrectoria_academica' : 'pendiente_aprobacion_rectoria';
      const expectedTokenHash = isVicerrectoriaStage ? solicitud.aprobacion_vicerrectoria_token_hash : solicitud.aprobacion_rectoria_token_hash;
      const currentVicerrectoria = getSolicitudVicerrectoria(solicitud) || 'Vicerrectoria';
      const actorName = isVicerrectoriaStage ? currentVicerrectoria : 'Rectoria';
      const actorEmail = isVicerrectoriaStage ? (getDependencyEmail(currentVicerrectoria) || ACADEMIC_VICERRECTORIA_EMAIL) : RECTORIA_EMAIL;
      const tokenColumn = isVicerrectoriaStage ? 'aprobacion_vicerrectoria_token_hash' : 'aprobacion_rectoria_token_hash';
      const eventName = isVicerrectoriaStage ? 'rechazada_vicerrectoria_academica' : 'rechazada_rectoria';
      if (solicitud.estado !== expectedEstado || expectedTokenHash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: solicitud.estado === expectedEstado ? 403 : 200,
          tone: solicitud.estado === expectedEstado ? 'error' : 'info',
          title: solicitud.estado === expectedEstado ? 'Enlace no autorizado' : 'Solicitud ya procesada',
          message: solicitud.estado === expectedEstado
            ? `El enlace no coincide con el token esperado para ${actorName}.`
            : `Esta solicitud ya no se encuentra pendiente de aprobacion de ${actorName}.`,
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'no_aprobada',
        [tokenColumn]: null,
        trazabilidad: appendTrace(solicitud, eventName, { nombre: actorName, email: actorEmail, role: payload.stage }, { actorName, justificacion })
      }, {
        where: { id: solicitud.id, estado: expectedEstado, [tokenColumn]: tokenHash }
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
      deleteSupportFile(solicitud);
      await sendGHRejectionEmails({ solicitud, justificacion });
      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Rechazo registrado',
        message: `La solicitud ha sido rechazada por ${actorName}.`,
        solicitud,
        nextStep: 'Se ha notificado al/a la colaborador(a) y a su jefe inmediato con el motivo correspondiente.'
      });
    }

    if (payload.stage === 'jefe') {
      const initialApprovalVia = String(req.body?.via || req.query?.via || '').trim().toLowerCase() === 'dependencia' ? 'dependencia' : 'jefe';
      const initialApprovalActor = getInitialApprovalActor(solicitud, initialApprovalVia);
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
        trazabilidad: appendTrace(solicitud, initialApprovalVia === 'dependencia' ? 'rechazada_dependencia' : 'rechazada_jefe', initialApprovalActor, {
          actorName: getInitialApprovalLabel(initialApprovalActor, solicitud.jefe_snapshot),
          actorEmail: initialApprovalActor.email || solicitud.jefe_snapshot?.email,
          via: initialApprovalVia,
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
      deleteSupportFile(solicitud);
      await sendCollaboratorRejectionEmail({
        solicitud,
        rejectedBy: initialApprovalVia === 'dependencia' ? 'su dependencia' : 'su jefe inmediato',
        justificacion
      });

      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Rechazo registrado',
        message: 'La solicitud ha sido rechazada y se ha notificado al/a la colaborador(a).',
        solicitud,
        nextStep: 'El/la colaborador(a) recibirÃ¡ un correo institucional explicando el motivo del rechazo.'
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
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de Gestion del Talento Humano.',
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
          message: 'El enlace no coincide con el token esperado para Gestion del Talento Humano.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }

      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'no_aprobada',
        aprobacion_gh_token_hash: null,
        trazabilidad: appendTrace(solicitud, 'rechazada_gestion_humana', null, {
          actorName: 'Gestion del Talento Humano',
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
      deleteSupportFile(solicitud);
      await sendGHRejectionEmails({
        solicitud,
        justificacion
      });

      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Rechazo registrado',
        message: 'La solicitud ha sido rechazada por Gestion del Talento Humano.',
        solicitud,
        nextStep: 'Se ha notificado al/a la colaborador(a) y a su jefe inmediato con el motivo correspondiente.'
      });
    } else if (payload.stage === 'sst') {
      if (solicitud.estado !== 'pendiente_aprobacion_sst') {
        const isAprobada = solicitud.estado === 'finalizada';
        return renderApprovalPage({
          res,
          tone: 'info',
          title: isAprobada ? 'Solicitud aprobada' : 'Solicitud ya procesada',
          message: isAprobada 
            ? 'Esta solicitud ya fue aprobada anteriormente y no puede ser rechazada.' 
            : 'Esta solicitud ya no se encuentra pendiente de aprobacion de SST.',
          solicitud,
          nextStep: 'No es necesario realizar ninguna accion adicional.'
        });
      }
      if (solicitud.aprobacion_sst_token_hash !== tokenHash) {
        return renderApprovalPage({
          res,
          status: 403,
          tone: 'error',
          title: 'Enlace no autorizado',
          message: 'El enlace no coincide con el token esperado para SST.',
          solicitud,
          nextStep: 'Por seguridad, el rechazo no fue registrado.'
        });
      }

      const [updatedCount] = await ReporteSalidaSolicitud.update({
        estado: 'no_aprobada',
        aprobacion_sst_token_hash: null,
        trazabilidad: appendTrace(solicitud, 'rechazada_sst', { nombre: 'Seguridad y Salud en el Trabajo', role: 'sst' }, {
          actorName: 'Seguridad y Salud en el Trabajo',
          justificacion
        })
      }, {
        where: {
          id: solicitud.id,
          estado: 'pendiente_aprobacion_sst',
          aprobacion_sst_token_hash: tokenHash
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
      deleteSupportFile(solicitud);
      await sendGHRejectionEmails({
        solicitud,
        justificacion,
        isSST: true
      });

      return renderApprovalPage({
        res,
        tone: 'success',
        title: 'Rechazo registrado',
        message: 'La solicitud ha sido rechazada por Seguridad y Salud en el Trabajo.',
        solicitud,
        nextStep: 'Se ha notificado al/a la colaborador(a) y a su jefe inmediato con el motivo correspondiente.'
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
  const subject = `REPORTE DE SALIDA GRUPAL ${consecutivoGroup} | AprobaciÃ³n Gestion del Talento Humano`;

  const mapping = {
    cita_eps: 'Cita medica por EPS',
    cita_particular: 'Cita medica particular',
    urgencia_medica: 'Urgencia Medica',
    diligencia_personal: 'Diligencia personal',
    compensatorio: 'Compensatorio',
    ponencia: 'Ponencia',
    visita_ies: 'Visita a otras IES',
    capacitacion: 'Capacitacion',
    proyecto_investigacion: 'Proyecto de investigacion',
    asistente_congreso: 'Asistente a congreso',
    practica_academica: 'Practica academica',
    torneo_deportivo: 'Participante en torneo deportivo',
    voto_jurado: 'Permiso: Jurado de votacion',
    voto_sufragante: 'Permiso: Sufragante',
    calamidad_domestica: 'Permiso: Calamidad domestica',
    entierro_companero: 'Permiso: Entierro companeros',
    comision_sindical: 'Permiso: Comisiones sindicales',
    matrimonio: 'Permiso: Matrimonio',
    lactancia: 'Permiso: Lactancia',
    luto_conyuge: 'Licencia luto: Conyuge',
    luto_companero: 'Licencia luto: Companero(a)',
    luto_familiar: 'Licencia luto: Familiar',
    actos_funebres: 'Licencia: Actos funebres',
    cuidado_ninez: 'Licencia: Cuidado ninez',
    jurado_votacion: 'Permiso: Jurado de votacion',
    sufragante: 'Permiso: Sufragante',
    cargos_oficiales_transitorios: 'Permiso: DesempeÃ±o de cargos oficiales transitorios',
    comisiones_sindicales: 'Permiso: Comisiones sindicales',
    obligaciones_escolares: 'Permiso: Obligaciones escolares',
    citaciones_judiciales: 'Permiso: Citaciones judiciales, administrativas y de policia',
    cuidado_hijo_ley_2174: 'Permiso: Cuidado de hijo(a) - Ley 2174 de 2021'
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
    introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0;">Estimados(as) integrantes de Gestion del Talento Humano,</p><p>Reciba un cordial saludo. Se ha radicado en el sistema un reporte de salida de modalidad grupal con un total de <strong>${solicitudes.length}</strong> colaboradores(as) participantes, la cual requiere su respectiva validacion y aprobacion.</p>`,
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
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">AUTORIZAR SALIDA</a>
        <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;margin:5px 10px;">NO AUTORIZAR SALIDA</a>
      </div>
      <p>Al hacer clic en "Autorizar Salida", se autorizaran de manera individual los reportes de todos(as) los(as) colaboradores(as) listados(as) y se les enviara a cada uno(a) su respectivo archivo aprobado por correo.</p>
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
        <div class="brand-subtitle">Reporte de salida | Gestion del Talento Humano</div>
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
      </div>
      
      <h3 style="margin-top:20px;margin-bottom:5px;font-size:14px;color:#475569;text-transform:uppercase;font-weight:900;letter-spacing:.03em;">Integrantes del grupo:</h3>
      <ul class="participants-list">
        ${listItems}
      </ul>

      <form method="POST" action="${safeActionUrl}">
        <div class="form-group">
          <label class="field-label" for="justificacion">Justificacion del Rechazo</label>
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
    const pdfAttachments = [];

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
        try {
          const pdfAttachment = await buildReporteSalidaPdfAttachment(solicitud);
          const userEmailResult = await sendIndividualColaboradorFinalEmail(solicitud, pdfAttachment);
          
          if (pdfAttachment) {
            pdfAttachments.push(pdfAttachment);
          }
          
          deleteSupportFile(solicitud);
          
          await solicitud.update({
            correo_usuario_enviado_at: userEmailResult.success ? new Date() : null,
            correo_sst_enviado_at: new Date(),
            enviado_sst_at: new Date(),
            trazabilidad: appendTrace(solicitud, 'notificacion_final_enviada', null, {
              usuario: userEmailResult.success,
              sst: true
            })
          });
        } catch (err) {
          console.error(`Error procesando notificacion final de grupo para solicitud ${solicitud.consecutivo}:`, err);
        }
      }
    }

    if (approvedCount > 0) {
      try {
        await sendGroupFinalConsolidatedEmail(solicitudes, pdfAttachments);
      } catch (err) {
        console.error('Error enviando correo consolidado final de grupo:', err);
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
        message: 'Este grupo ya no se encuentra pendiente de aprobacion de Gestion del Talento Humano.',
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
            actorName: 'Gestion del Talento Humano',
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
        deleteSupportFile(solicitud);
        try {
          const solicitante = solicitud.solicitante_snapshot || {};
          const userSubject = `REPORTE DE SALIDA GRUPAL ${solicitud.consecutivo} | Solicitud no aprobada por Gestion del Talento Humano`;
          const userHtml = renderInstitutionalTemplate({
            title: 'Reporte de salida grupal no aprobado por Gestion del Talento Humano',
            introHtml: `<p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 4px 0;">Estimado(a) colaborador(a),</p><p style="margin: 0 0 16px 0;"><strong>${escapeHtml(solicitante.nombre)}</strong></p><p>Reciba un cordial saludo. En atenciÃ³n a la solicitud de reporte de salida de modalidad grupal en la que participaba con consecutivo <strong>${escapeHtml(solicitud.consecutivo)}</strong>, lamentamos informarle que la solicitud ha sido marcada como no aprobada por parte de <strong>Gestion del Talento Humano</strong>.</p>`,
            bodyHtml: `
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
            text: `Su solicitud de salida grupal ${solicitud.consecutivo} fue rechazada por Gestion del Talento Humano. Motivo: ${justificacion}`,
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
      message: `Se registro el rechazo para ${rejectedCount} solicitudes del grupo por Gestion del Talento Humano.`,
      nextStep: 'Se ha notificado a cada uno(a) de los(as) colaboradores(as) por correo institucional con el motivo correspondiente.'
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
    console.log('[verificarReportePublico] Iniciando verificacion para ID:', searchId);
    let solicitud = null;

    if (searchId && searchId.length === 36 && searchId.includes('-')) {
      // Intento 1: Usando ruta JSON estandar de Sequelize (punto y dot notation)
      try {
        solicitud = await ReporteSalidaSolicitud.findOne({
          where: {
            'datos_formulario.tx_id': searchId
          }
        });
      } catch (err1) {
        console.error('[verificarReportePublico] Error en Intento 1 (dot notation):', err1.message);
      }

      // Intento 2: Usando literal sql de postgres
      if (!solicitud) {
        try {
          solicitud = await ReporteSalidaSolicitud.findOne({
            where: ReporteSalidaSolicitud.sequelize.literal(`datos_formulario->>'tx_id' = :searchId`),
            replacements: { searchId }
          });
        } catch (err2) {
          console.error('[verificarReportePublico] Error en Intento 2 (literal):', err2.message);
        }
      }

      // Intento 3: Usando contains operador jsonb
      if (!solicitud) {
        try {
          solicitud = await ReporteSalidaSolicitud.findOne({
            where: {
              datos_formulario: {
                [Op.contains]: { tx_id: searchId }
              }
            }
          });
        } catch (err3) {
          console.error('[verificarReportePublico] Error en Intento 3 (contains):', err3.message);
        }
      }
    }

    // Intento 4: Por ID o consecutivo
    if (!solicitud) {
      try {
        solicitud = await ReporteSalidaSolicitud.findOne({
          where: {
            [Op.or]: [
              { id: isNaN(searchId) ? 0 : Number(searchId) },
              { consecutivo: searchId }
            ]
          }
        });
      } catch (err4) {
        console.error('[verificarReportePublico] Error en Intento 4 (id/consecutivo):', err4.message);
      }
    }

    if (!solicitud) {
      console.warn('[verificarReportePublico] No se encontro ninguna solicitud para:', searchId);
      return res.status(404).json({ success: false, message: 'El reporte no existe o fue eliminado.' });
    }

    let solicitante = solicitud.solicitante_snapshot;
    if (typeof solicitante === 'string') {
      try { solicitante = JSON.parse(solicitante); } catch (e) { solicitante = {}; }
    }
    const nombre = solicitante?.nombre || 'Desconocido';
    const documento = solicitante?.documento || solicitante?.username || 'Desconocido';

    let datosForm = solicitud.datos_formulario || {};
    if (typeof datosForm === 'string') {
      try { datosForm = JSON.parse(datosForm); } catch (e) { datosForm = {}; }
    }

    const resData = {
      success: true,
      data: {
        id: solicitud.id,
        tx_id: datosForm?.tx_id || '',
        consecutivo: solicitud.consecutivo,
        createdAt: solicitud.createdAt || solicitud.created_at,
        estado: solicitud.estado,
        solicitante: {
          nombre,
          documento,
          cargo: datosForm?.laboral?.cargo || 'No especificado',
          dependencia: datosForm?.laboral?.dependencia || 'No especificada'
        },
        jefe_aprobado_at: solicitud.jefe_aprobado_at,
        gestion_humana_aprobado_at: solicitud.gestion_humana_aprobado_at
      }
    };
    console.log('[verificarReportePublico] Verificacion exitosa para:', searchId);
    return res.json(resData);
  } catch (error) {
    console.error('Error grave en verificarReportePublico:', error);
    return res.status(500).json({ success: false, message: 'Error interno del servidor: ' + error.message });
  }
};

module.exports = {
  aprobarDesdeCorreo,
  mostrarFormularioAprobacion,
  mostrarFormularioAprobacionGrupo,
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
  limpiarMocks,
  editarSolicitudAdmin,
  verificarReportePublico
};


