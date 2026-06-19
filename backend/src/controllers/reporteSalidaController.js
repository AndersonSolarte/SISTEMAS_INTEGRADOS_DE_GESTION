const crypto = require('crypto');
const { Op } = require('sequelize');
const { Documento, PlanAccion, ReporteSalidaSolicitud, RecursoHumanoAdministrativo, User } = require('../models');
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

const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
const publicBackendUrl = process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL || frontendUrl;

const featureDisabled = (res) =>
  res.status(403).json({ success: false, message: 'El formulario de reporte de salida aun no esta habilitado.' });

const isAdminUser = (user) => String(user?.role || '') === 'administrador';

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

const normalizeForMatch = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
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
  if (leftText === rightText || leftText.includes(rightText) || rightText.includes(leftText)) return true;

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
  const users = await User.findAll({
    where: { estado: 'activo' },
    attributes: ['id', 'nombre', 'email', 'username', 'role', 'dependencia', 'cargo', 'jefe_inmediato'],
    order: [['dependencia', 'ASC'], ['cargo', 'ASC'], ['nombre', 'ASC']],
    raw: true
  });
  return users.filter((user) => user.dependencia || user.cargo || user.jefe_inmediato);
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
      namesLookRelated(candidate.nombre, jefeNombre)
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

const parseDateTime = (date, time) => {
  if (!date || !time) return null;
  const normalizedTime = String(time).trim();
  const iso = `${String(date).slice(0, 10)}T${normalizedTime.length === 5 ? `${normalizedTime}:00` : normalizedTime}`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const diffMinutes = (date, start, end) => {
  const from = parseDateTime(date, start);
  const to = parseDateTime(date, end);
  if (!from || !to || to <= from) return null;
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
        <button class="ghost" type="button" onclick="window.close()">Cerrar ventana</button>
        <a class="primary" href="${safeActionUrl}">${safeActionLabel}</a>
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
  if (!salida.fecha || !salida.horaInicio || !salida.horaFin) return 'Debe indicar fecha, hora inicio y hora fin de salida.';

  const requestedMinutes = diffMinutes(salida.fecha, salida.horaInicio, salida.horaFin);
  if (!requestedMinutes) return 'La hora fin de salida debe ser mayor que la hora inicio.';

  if (salida.tipo === 'diligencia_personal') {
    if (!reposicion.fecha || !reposicion.horaInicio || !reposicion.horaFin) {
      return 'Para diligencia personal debe indicar fecha y horario de reposicion.';
    }
    const replacementMinutes = diffMinutes(reposicion.fecha, reposicion.horaInicio, reposicion.horaFin);
    if (!replacementMinutes) return 'La hora fin de reposicion debe ser mayor que la hora inicio.';
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
  const pdf = await ensureReporteSalidaPdf(solicitud);
  const docx = await ensureReporteSalidaDocx(solicitud);
  return [pdf, docx];
};

const sendJefeApprovalEmail = async (solicitud, token, attachments) => {
  const jefe = solicitud.jefe_snapshot || {};
  const solicitante = solicitud.solicitante_snapshot || {};
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const subject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Aprobacion jefe inmediato`;
  const html = renderInstitutionalTemplate({
    title: 'Solicitud de aprobacion de reporte de salida',
    introHtml: `<p>Cordial saludo, <strong>${escapeHtml(jefe.nombre)}</strong>.</p><p>El colaborador <strong>${escapeHtml(solicitante.nombre)}</strong> radico una solicitud de reporte de salida.</p>`,
    bodyHtml: `
      <p><strong>Solicitud:</strong> ${escapeHtml(solicitud.consecutivo)}</p>
      <p><strong>Tiempo solicitado:</strong> ${escapeHtml(formatMinutes(solicitud.tiempo_solicitado_minutos))}</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Aprobar salida</a>
      </div>
      <p>Si no aprueba la salida, no realice ninguna accion desde este correo.</p>
    `
  });
  return sendInstitutionalEmail({
    to: jefe.email,
    subject,
    text: `Solicitud ${solicitud.consecutivo}. Para aprobar ingrese a ${approveUrl}. Si no aprueba, no realice ninguna accion.`,
    html,
    attachments
  });
};

const sendGestionHumanaApprovalEmail = async (solicitud, token, attachments) => {
  const recipients = getReporteSalidaRecipients();
  const approveUrl = `${publicBackendUrl.replace(/\/$/, '')}/api/reporte-salida/aprobar/${encodeURIComponent(token)}`;
  const subject = `REPORTE DE SALIDA ${solicitud.consecutivo} | Aprobacion Gestion Humana`;
  const html = renderInstitutionalTemplate({
    title: 'Aprobacion pendiente de Gestion Humana',
    introHtml: `<p>La solicitud <strong>${escapeHtml(solicitud.consecutivo)}</strong> fue aprobada por el jefe inmediato.</p>`,
    bodyHtml: `
      <p><strong>Colaborador:</strong> ${escapeHtml(solicitud.solicitante_snapshot?.nombre)}</p>
      <p><strong>Tiempo solicitado:</strong> ${escapeHtml(formatMinutes(solicitud.tiempo_solicitado_minutos))}</p>
      <div style="text-align:center;margin:20px 0;">
        <a href="${approveUrl}" style="display:inline-block;background:#0b3a6f;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700;">Aprobar Gestion Humana</a>
      </div>
    `
  });
  return sendInstitutionalEmail({
    to: recipients.gestionHumana,
    subject,
    text: `Solicitud ${solicitud.consecutivo}. Para aprobar Gestion Humana ingrese a ${approveUrl}.`,
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
    bodyHtml: '<p>Gestion Humana aprobo su reporte de salida. Se adjunta el PDF digital FR-002 diligenciado y aprobado. Tambien se incluye el Word oficial diligenciado como soporte editable.</p>'
  });
  const sstHtml = renderInstitutionalTemplate({
    title: 'Reporte de salida para conocimiento SST',
    introHtml: '<p>Se informa la salida aprobada de un colaborador.</p>',
    bodyHtml: `<p><strong>Colaborador:</strong> ${escapeHtml(solicitud.solicitante_snapshot?.nombre)}</p><p>Se adjunta PDF digital FR-002 informativo y Word oficial diligenciado como respaldo.</p>`
  });

  const userResult = await sendInstitutionalEmail({
    to: solicitud.solicitante_snapshot.email,
    subject,
    text: `Su reporte de salida ${solicitud.consecutivo} fue aprobado por Gestion Humana. Se adjunta PDF digital FR-002 y Word diligenciado.`,
    html: userHtml,
    attachments
  });
  const sstResult = await sendInstitutionalEmail({
    to: recipients.sst,
    subject: `REPORTE DE SALIDA ${solicitud.consecutivo} | Informacion SST`,
    text: `Reporte de salida aprobado para conocimiento SST. Solicitud ${solicitud.consecutivo}. Se adjunta PDF digital FR-002 y Word diligenciado.`,
    html: sstHtml,
    attachments
  });
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
    if (userDependencias.length) {
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
    const errorMessage = validateRadicacionPayload(req.body, req.user);
    if (errorMessage) return res.status(400).json({ success: false, message: errorMessage });

    const documento = await Documento.findByPk(req.body.documentoId);
    if (!documento || !isReporteSalidaDocumento(documento)) {
      return res.status(400).json({ success: false, message: 'El formulario solo esta disponible para THM-DP-FR-002 REPORTE DE SALIDA.' });
    }

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

    const salida = req.body.salida || {};
    const reposicion = req.body.reposicion || {};
    const requestedMinutes = diffMinutes(salida.fecha, salida.horaInicio, salida.horaFin);
    const replacementMinutes = salida.tipo === 'diligencia_personal'
      ? diffMinutes(reposicion.fecha, reposicion.horaInicio, reposicion.horaFin)
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
          horaInicio: sanitizeText(salida.horaInicio, 10),
          horaFin: sanitizeText(salida.horaFin, 10),
          motivo: sanitizeText(salida.motivo, 600)
        },
        reposicion: {
          fecha: sanitizeText(reposicion.fecha, 20),
          horaInicio: sanitizeText(reposicion.horaInicio, 10),
          horaFin: sanitizeText(reposicion.horaFin, 10),
          observacion: sanitizeText(reposicion.observacion, 600)
        }
      },
      tiempo_solicitado_minutos: requestedMinutes,
      reposicion_aplica: salida.tipo === 'diligencia_personal',
      reposicion_minutos: replacementMinutes,
      reposicion_estado: salida.tipo === 'diligencia_personal' ? 'programada' : 'no_aplica',
      aprobacion_jefe_token_hash: hashToken(token),
      trazabilidad: [{ event: 'radicada', actor: buildSnapshot(req.user), at: now.toISOString() }]
    });

    const attachments = await buildReporteSalidaAttachments(solicitud);
    await solicitud.update({ pdf_generado_at: new Date() });
    const emailResult = await sendJefeApprovalEmail(solicitud, token, attachments);
    await solicitud.update({
      correo_jefe_enviado_at: emailResult.success ? new Date() : null,
      trazabilidad: appendTrace(solicitud, emailResult.success ? 'correo_jefe_enviado' : 'correo_jefe_error', req.user, { error: emailResult.error || '' })
    });

    res.status(201).json({
      success: true,
      message: 'Solicitud radicada. Se envio correo al jefe inmediato para aprobacion.',
      data: serializeSolicitud(solicitud)
    });
  } catch (error) {
    console.error('Error radicando reporte de salida:', error);
    res.status(500).json({ success: false, message: 'No se pudo radicar la solicitud' });
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
        return renderApprovalPage({
          res,
          tone: 'info',
          title: 'Solicitud ya procesada',
          message: 'Esta aprobacion ya fue registrada previamente.',
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
      await solicitud.update({
        estado: 'pendiente_aprobacion_gestion_humana',
        jefe_aprobado_at: new Date(),
        aprobacion_gh_token_hash: hashToken(ghToken),
        trazabilidad: appendTrace(solicitud, 'aprobada_jefe', null)
      });
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
        return renderApprovalPage({
          res,
          tone: 'info',
          title: 'Solicitud ya procesada',
          message: 'Esta aprobacion ya fue registrada previamente.',
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
      await solicitud.update({
        estado: 'finalizada',
        gestion_humana_aprobado_at: new Date(),
        finalizado_at: new Date(),
        trazabilidad: appendTrace(solicitud, 'aprobada_gestion_humana', null)
      });
      await solicitud.reload();
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

module.exports = {
  aprobarDesdeCorreo,
  getCatalogoLaboral,
  getFeatureConfig,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig
};
