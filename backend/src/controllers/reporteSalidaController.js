const crypto = require('crypto');
const { Op } = require('sequelize');
const { Documento, PlanAccion, ReporteSalidaSolicitud, User } = require('../models');
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
  role: user.role
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
  if (!payload?.jefeInmediatoUserId) return 'Debe seleccionar jefe inmediato.';
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
    const where = { estado: 'activo' };
    if (search) {
      where[Op.or] = [
        { nombre: { [Op.iLike]: `%${search}%` } },
        { email: { [Op.iLike]: `%${search}%` } },
        { username: { [Op.iLike]: `%${search}%` } }
      ];
    }
    const users = await User.findAll({
      where,
      attributes: ['id', 'nombre', 'email', 'username', 'role'],
      order: [['nombre', 'ASC']],
      limit: 20
    });
    res.json({ success: true, data: users });
  } catch (error) {
    res.status(500).json({ success: false, message: 'No se pudo buscar jefes inmediatos' });
  }
};

const listarDependencias = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const rows = await PlanAccion.findAll({
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
    const dependencias = rows
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

const radicarSolicitud = async (req, res) => {
  if (!(await getReporteSalidaFeatureState())) return featureDisabled(res);
  try {
    const errorMessage = validateRadicacionPayload(req.body, req.user);
    if (errorMessage) return res.status(400).json({ success: false, message: errorMessage });

    const documento = await Documento.findByPk(req.body.documentoId);
    if (!documento || !isReporteSalidaDocumento(documento)) {
      return res.status(400).json({ success: false, message: 'El formulario solo esta disponible para THM-DP-FR-002 REPORTE DE SALIDA.' });
    }

    const jefe = await User.findOne({ where: { id: req.body.jefeInmediatoUserId, estado: 'activo' } });
    if (!jefe) return res.status(400).json({ success: false, message: 'El jefe inmediato seleccionado no existe o no esta activo.' });
    if (Number(jefe.id) === Number(req.user.id)) {
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
      jefe_inmediato_user_id: jefe.id,
      solicitante_snapshot: buildSnapshot(req.user),
      jefe_snapshot: buildSnapshot(jefe),
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
  getFeatureConfig,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig
};
