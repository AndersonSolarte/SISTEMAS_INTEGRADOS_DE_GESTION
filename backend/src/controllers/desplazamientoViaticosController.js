const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { DesplazamientoViaticosSolicitud, ReporteSalidaSolicitud, SystemSetting } = require('../models');
const { getDependencyEmail } = require('../config/dependencyEmails');
const { sequelize } = require('../config/database');
const { decryptPayload, encryptPayload } = require('../utils/secureUrlToken');
const { getDesplazamientoViaticosRecipients, normalizeEmail } = require('../config/desplazamientoViaticosConfig');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const { AUTHORIZATION_TEXT, LEGALIZATION_NOTICE, buildXlsxAttachment, calculateDays } = require('../services/desplazamientoViaticos/formatService');
const { buildLiquidationPdfAttachment, buildPdfAttachment } = require('../services/desplazamientoViaticos/pdfService');
const { ensureReporteSalidaPdf } = require('../services/reporteSalidaPdfService');

const publicBackendUrl = process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5000';
const BASE_DETAIL_NAMES = [
  'Manutención',
  'Alojamiento',
  'Transporte local diario',
  'Transporte aeropuerto ciudad de origen',
  'Transporte aeropuerto ciudad de destino',
  'Transporte terrestre intermunicipal'
];
const DEMO_TREASURY_EMAIL = 'gp.planeacion@unicesmag.edu.co';
const usedDemoLiquidationTokens = new Set();
const usedDemoTreasuryTokens = new Set();
const usedDemoFinancialTokens = new Set();
const DEMO_PROCESSED_SETTING_KEY = 'desplazamiento_viaticos_demo_tokens_procesados';
const revokedDemoTokenHashes = new Set([
  '097ba874fb3d8cd53838ec1248c421ca721620cf5ff39d4392b520a5369db16b'
]);

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');
const isDemoTokenProcessed = async (tokenHash, memorySet) => {
  if (memorySet.has(tokenHash)) return true;
  const setting = await SystemSetting.findByPk(DEMO_PROCESSED_SETTING_KEY);
  const record = setting?.value?.tokens?.[tokenHash];
  if (!record) return false;
  if (record.expiresAt && new Date(record.expiresAt).getTime() < Date.now()) return false;
  memorySet.add(tokenHash);
  return true;
};
const markDemoTokenProcessed = async (tokenHash, memorySet, expiresAt = null) => {
  const [setting] = await SystemSetting.findOrCreate({
    where: { key: DEMO_PROCESSED_SETTING_KEY },
    defaults: { value: { tokens: {} } }
  });
  const currentTokens = setting.value?.tokens && typeof setting.value.tokens === 'object' ? setting.value.tokens : {};
  const now = Date.now();
  const activeTokens = Object.fromEntries(Object.entries(currentTokens).filter(([, record]) => (
    !record?.expiresAt || new Date(record.expiresAt).getTime() >= now
  )));
  activeTokens[tokenHash] = {
    processedAt: new Date().toISOString(),
    expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : new Date(now + 24 * 60 * 60 * 1000).toISOString()
  };
  await setting.update({ value: { tokens: activeTokens } });
  memorySet.add(tokenHash);
};
const money = (value) => {
  const number = Number(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(number) && number >= 0 ? number : 0;
};
const parseLiquidationBody = (body = {}) => {
  const supportsRemovableBaseRows = body.liquidationRowsVersion === '2';
  const detalles = BASE_DETAIL_NAMES.flatMap((detalle, index) => {
    if (supportsRemovableBaseRows && body[`baseIncluded${index}`] !== '1') return [];
    const valorDiario = money(body[`valorDiario${index}`]);
    const dias = Math.max(0, Math.trunc(money(body[`dias${index}`])));
    return [{ detalle, valorDiario, dias, valorTotal: valorDiario * dias }];
  });
  const extraCount = Math.min(30, Math.max(0, Math.trunc(money(body.extraCount))));
  for (let index = 0; index < extraCount; index += 1) {
    const detalle = clean(body[`extraDetalle${index}`], 120);
    const valorDiario = money(body[`extraValorDiario${index}`]);
    const dias = Math.max(0, Math.trunc(money(body[`extraDias${index}`])));
    if (!detalle && (valorDiario > 0 || dias > 0)) return { error: 'Debe escribir el nombre de cada concepto adicional.' };
    if (detalle) detalles.push({ detalle, valorDiario, dias, valorTotal: valorDiario * dias });
  }
  return {
    detalles,
    totalAnticipo: detalles.reduce((total, item) => total + item.valorTotal, 0),
    observaciones: clean(body.observaciones, 2000)
  };
};
const isEligibleDestination = (salida = {}) => {
  const alcance = normalize(salida.alcance);
  if (alcance === 'nacional' || alcance === 'internacional') return true;
  return alcance === 'regional' && Boolean(clean(salida.municipio)) && normalize(salida.municipio) !== 'pasto';
};
const appendTrace = (solicitud, event, actor = {}, detail = {}) => [
  ...(solicitud.trazabilidad || []),
  { event, actor, detail, at: new Date().toISOString() }
];

const NORMAL_REPORT_EVENT_BY_STAGE = {
  jefe: 'aprobada_jefe',
  vicerrectoria_dependencia: 'aprobada_vicerrectoria_academica',
  sst: 'aprobada_sst',
  rectoria: 'aprobada_rectoria',
  gestion_humana: 'aprobada_gestion_humana'
};

const NORMAL_PENDING_STATE_BY_STAGE = {
  jefe: 'pendiente_aprobacion_jefe',
  vicerrectoria_dependencia: 'pendiente_aprobacion_vicerrectoria_academica',
  sst: 'pendiente_aprobacion_sst',
  rectoria: 'pendiente_aprobacion_rectoria',
  gestion_humana: 'pendiente_aprobacion_gestion_humana'
};

const buildNormalReportData = ({ consecutivo, userId, documentoId, jefeUserId, personal, jefe, laboral, salida, viaticos, steps }) => ({
  consecutivo,
  user_id: userId,
  documento_id: documentoId,
  jefe_inmediato_user_id: jefeUserId || null,
  estado: NORMAL_PENDING_STATE_BY_STAGE[(steps || []).find((step) => NORMAL_PENDING_STATE_BY_STAGE[step.key])?.key] || 'pendiente_aprobacion_jefe',
  solicitante_snapshot: { ...personal, username: personal.documento },
  jefe_snapshot: jefe,
  datos_formulario: {
    tx_id: crypto.randomUUID(),
    personal: { nombre: personal.nombre, documento: personal.documento, correo: personal.email },
    laboral,
    salida: {
      ...salida,
      categoria: 'propias_cargo',
      duracionTipo: 'menos_media_jornada'
    },
    viaticos,
    plan_aprobacion_normal: (steps || []).filter((step) => ['jefe', 'vicerrectoria_dependencia', 'sst', 'rectoria', 'gestion_humana'].includes(step.key)),
    reposicion: {},
    origen_flujo: 'desplazamiento_viaticos'
  },
  tiempo_solicitado_minutos: null,
  reposicion_aplica: false,
  reposicion_minutos: 0,
  reposicion_estado: 'no_aplica',
  trazabilidad: [{ event: 'radicada', actor: personal, at: new Date().toISOString() }]
});

const getLinkedNormalReport = async (solicitud) => {
  const reportId = Number(solicitud.datos_viaticos?.reporteSalidaSolicitudId || 0);
  return reportId > 0 ? ReporteSalidaSolicitud.findByPk(reportId) : null;
};

const syncNormalReportApproval = async (solicitud, step, actor, detail = {}) => {
  const event = NORMAL_REPORT_EVENT_BY_STAGE[step.key];
  if (!event) return null;
  const report = await getLinkedNormalReport(solicitud);
  if (!report) return null;
  const at = new Date();
  const traceEntries = [{ event, actor, detail, at: at.toISOString() }];
  if (step.key === 'rectoria' && step.fulfillsImmediateBoss) {
    traceEntries.unshift({ event: 'aprobada_jefe', actor, detail: { aprobacionUnificadaConRectoria: true }, at: at.toISOString() });
  }
  const values = { trazabilidad: [...(report.trazabilidad || []), ...traceEntries] };
  if (step.key === 'jefe') {
    values.estado = 'aprobada_jefe';
    values.jefe_aprobado_at = at;
  } else if (step.key === 'vicerrectoria_dependencia') {
    values.estado = 'aprobada_vicerrectoria_academica';
    values.vicerrectoria_aprobado_at = at;
  } else if (step.key === 'sst') {
    values.estado = 'aprobada_sst';
    values.enviado_sst_at = at;
  } else if (step.key === 'rectoria') {
    values.estado = 'aprobada_rectoria';
    values.rectoria_aprobado_at = at;
    if (step.fulfillsImmediateBoss) values.jefe_aprobado_at = at;
  } else if (step.key === 'gestion_humana') {
    values.estado = 'finalizada';
    values.gestion_humana_aprobado_at = at;
    values.finalizado_at = at;
  }
  await report.update(values);
  return report;
};

const syncNormalReportRejection = async (solicitud, step, actor, observacion) => {
  if (!NORMAL_REPORT_EVENT_BY_STAGE[step.key]) return null;
  const report = await getLinkedNormalReport(solicitud);
  if (!report) return null;
  await report.update({
    estado: 'no_aprobada',
    trazabilidad: [...(report.trazabilidad || []), {
      event: `rechazada_${step.key}`,
      actor,
      detail: { observacion },
      at: new Date().toISOString()
    }]
  });
  return report;
};

const buildDemoSolicitud = (liquidacion = {}) => ({
  consecutivo: 'PRUEBA-ADF-PP-FR-004-2026-0005',
  created_at: new Date(),
  solicitante_snapshot: { nombre: 'COLABORADOR DE PRUEBA', documento: '0000000000', email: 'adsolarte@unicesmag.edu.co' },
  datos_laborales: { dependencia: 'Dirección de Planeación y Aseguramiento de la Calidad', cargo: 'Cargo de prueba' },
  datos_salida: { fecha: '2026-08-10', fechaRegreso: '2026-08-12', horaInicio: '08:00', horaFin: '18:00' },
  datos_viaticos: {
    lugarVisitar: 'Entidad de prueba - Bogotá',
    numeroDiasSolicitados: 3,
    objetoComision: 'Prueba controlada de liquidación.',
    autorizacionAceptada: true
  },
  plan_aprobacion: [],
  trazabilidad: [],
  liquidacion
});

const buildSupportAttachment = (solicitud) => {
  const support = solicitud.datos_viaticos?.soporteAdjunto || {};
  const filename = path.basename(clean(support.filename, 240));
  if (!filename) return null;
  const filepath = path.join(__dirname, '../../uploads/desplazamientos_viaticos', filename);
  if (!fs.existsSync(filepath)) return null;
  return { filename: path.basename(clean(support.originalName, 240)) || filename, path: filepath };
};

const buildActor = (key, name, email) => ({ key, nombre: name, email: normalizeEmail(email) });

const isRectoriaAssignment = (laboral = {}) => {
  const vice = normalize(laboral.vicerrectoria);
  return vice.includes('rectoria') && !vice.includes('vicerrectoria') && !vice.includes('vicerectoria');
};

const isAcademicVicerrectoriaAssignment = (laboral = {}) => {
  const vice = normalize(laboral.vicerrectoria);
  return (vice.includes('vicerrectoria') || vice.includes('vicerectoria')) && vice.includes('academica');
};

const isResearchVicerrectoriaAssignment = (laboral = {}) => {
  const vice = normalize(laboral.vicerrectoria);
  return (vice.includes('vicerrectoria') || vice.includes('vicerectoria'))
    && vice.includes('investigacion')
    && vice.includes('extension');
};

const isEvangelizationVicerrectoriaAssignment = (laboral = {}) => {
  const vice = normalize(laboral.vicerrectoria);
  return (vice.includes('vicerrectoria') || vice.includes('vicerectoria'))
    && vice.includes('evangelizacion')
    && vice.includes('culturas');
};

const isVicerrectorImmediateBoss = (jefe = {}, institutionalEmail = '') => {
  const email = normalizeEmail(jefe.email);
  const role = normalize(jefe.cargo);
  return Boolean(
    (email && email === normalizeEmail(institutionalEmail))
    || /(^|\s)vice(?:rrector|rector)(?=\s|$|\()/.test(role)
  );
};

const isRectorImmediateBoss = (jefe = {}, rectoriaEmail = '') => {
  const email = normalizeEmail(jefe.email);
  const role = normalize(jefe.cargo);
  const hasRectorRole = /(^|\s)rector(?=\s|$|\()/.test(role)
    && !/(^|\s)vice(?:rrector|rector)(?=\s|$|\()/.test(role);
  return Boolean(
    (email && email === normalizeEmail(rectoriaEmail))
    || hasRectorRole
  );
};

const buildApprovalPlan = ({ jefe = {}, laboral = {} }) => {
  const recipients = getDesplazamientoViaticosRecipients();
  const dependenciaEmail = normalizeEmail(getDependencyEmail(laboral.dependencia));
  const viceDependenciaEmail = normalizeEmail(getDependencyEmail(laboral.vicerrectoria));
  const rectoriaAssignment = isRectoriaAssignment(laboral);
  const academicAssignment = isAcademicVicerrectoriaAssignment(laboral);
  const researchAssignment = isResearchVicerrectoriaAssignment(laboral);
  const evangelizationAssignment = isEvangelizationVicerrectoriaAssignment(laboral);
  const rectorIsBoss = rectoriaAssignment && isRectorImmediateBoss(jefe, recipients.rectoria);
  const steps = [];

  if (rectoriaAssignment) {
    if (!rectorIsBoss) {
      steps.push({ key: 'jefe', label: 'Jefe inmediato', email: normalizeEmail(jefe.email), action: 'approval' });
    }
    steps.push({ key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' });
    steps.push({
      key: 'rectoria',
      label: rectorIsBoss ? 'Rector – jefe inmediato y autoridad de Rectoría' : 'Rectoría',
      email: recipients.rectoria,
      action: 'approval',
      fulfillsImmediateBoss: rectorIsBoss
    });
  } else if (academicAssignment) {
    const directorEmail = normalizeEmail(jefe.email);
    const programEmail = dependenciaEmail && dependenciaEmail !== directorEmail ? dependenciaEmail : '';
    steps.push({
      key: 'jefe',
      label: 'Director de Programa – jefe inmediato',
      email: directorEmail,
      action: 'approval',
      alternateApprovalEmail: programEmail,
      alternateApprovalLabel: laboral.dependencia || 'Programa académico',
      alternateAccessSource: 'programa_academico',
      alternateAuthorityLabel: 'Vicerrectoría Académica',
      alternateAbsenceRole: 'Director de Programa'
    });
    steps.push(
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' },
      { key: 'vicerrectoria_dependencia', label: 'Vicerrectoría Académica', email: recipients.academica, action: 'approval' },
      { key: 'rectoria', label: 'Rectoría', email: recipients.rectoria, action: 'approval' }
    );
  } else if (researchAssignment) {
    const vicePersonalEmail = normalizeEmail(jefe.email);
    const viceInstitutionalEmail = recipients.investigacion !== vicePersonalEmail ? recipients.investigacion : '';
    steps.push({
      key: 'jefe',
      label: 'Vicerrector de Investigación y Extensión – jefe inmediato',
      email: vicePersonalEmail,
      action: 'approval',
      alternateApprovalEmail: viceInstitutionalEmail,
      alternateApprovalLabel: 'Vicerrectoría de Investigación y Extensión',
      alternateAccessSource: 'vicerrectoria_investigacion',
      alternateAuthorityLabel: 'Vicerrectoría de Investigación y Extensión',
      alternateAbsenceRole: 'Vicerrector de Investigación y Extensión'
    });
    steps.push(
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' },
      { key: 'rectoria', label: 'Rectoría', email: recipients.rectoria, action: 'approval' }
    );
  } else if (evangelizationAssignment) {
    const bossEmail = normalizeEmail(jefe.email);
    const viceIsBoss = isVicerrectorImmediateBoss(jefe, recipients.evangelizacion);
    const alternateEmail = viceIsBoss && recipients.evangelizacion !== bossEmail
      ? recipients.evangelizacion
      : '';
    steps.push({
      key: 'jefe',
      label: viceIsBoss
        ? 'Vicerrector para la Evangelización de las Culturas – jefe inmediato'
        : 'Jefe inmediato',
      email: bossEmail,
      action: 'approval',
      alternateApprovalEmail: alternateEmail,
      alternateApprovalLabel: viceIsBoss ? 'Vicerrectoría para la Evangelización de las Culturas' : '',
      alternateAccessSource: viceIsBoss ? 'vicerrectoria_evangelizacion' : '',
      alternateAuthorityLabel: viceIsBoss ? 'Vicerrectoría para la Evangelización de las Culturas' : '',
      alternateAbsenceRole: viceIsBoss ? 'Vicerrector para la Evangelización de las Culturas' : ''
    });
    steps.push(
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' },
      { key: 'rectoria', label: 'Rectoría', email: recipients.rectoria, action: 'approval' }
    );
  } else {
    steps.push({ key: 'jefe', label: 'Jefe inmediato', email: normalizeEmail(jefe.email), action: 'approval' });
    if (viceDependenciaEmail && viceDependenciaEmail !== recipients.financiera) {
      steps.push({ key: 'vicerrectoria_dependencia', label: laboral.vicerrectoria || 'Vicerrectoría correspondiente', email: viceDependenciaEmail, action: 'approval' });
    }
    steps.push(
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' },
      { key: 'rectoria', label: 'Rectoría', email: recipients.rectoria, action: 'approval' }
    );
  }
  steps.push(
    { key: 'gestion_humana', label: 'Gestión Humana', email: recipients.gestionHumana, action: 'approval' },
    { key: 'tecnico_contable', label: 'Técnico contable', email: recipients.tecnicoContable, action: 'liquidacion' },
    {
      key: 'financiera_final',
      label: 'Vicerrectoría Financiera y de Desarrollo Institucional',
      email: recipients.financiera,
      action: 'approval',
      infoEmails: (rectoriaAssignment || academicAssignment || researchAssignment || evangelizationAssignment) ? [] : [dependenciaEmail].filter((email) => email && email !== recipients.financiera)
    },
    { key: 'tesoreria', label: 'Tesorería / Pagaduría', email: recipients.tesoreria, action: 'pago' }
  );
  return { steps: steps.filter((step) => step.email), dependenciaEmail, rectoriaAssignment, academicAssignment, researchAssignment, evangelizationAssignment, rectorIsBoss };
};

const nextConsecutivo = async () => {
  const year = new Date().getFullYear();
  const prefix = `ADF-PP-FR-004-${year}-`;
  const last = await DesplazamientoViaticosSolicitud.findOne({
    where: { consecutivo: { [Op.like]: `${prefix}%` } },
    order: [['id', 'DESC']]
  });
  const next = Number(String(last?.consecutivo || '').split('-').pop()) + 1 || 1;
  return `${prefix}${String(next).padStart(4, '0')}`;
};

const createStageToken = (solicitud, step, accessSource = 'primary') => encryptPayload({
    purpose: 'desplazamiento_viaticos_action',
    solicitudId: solicitud.id,
    stage: step.key,
    accessSource,
    nonce: crypto.randomBytes(12).toString('hex')
  }, null);

const issueTokens = async (solicitud, step) => {
  const primary = createStageToken(solicitud, step, 'primary');
  const alternateAccessSource = step.alternateAccessSource || 'alternate';
  const alternate = step.alternateApprovalEmail
    ? createStageToken(solicitud, step, alternateAccessSource)
    : null;
  const plan = [...(solicitud.plan_aprobacion || [])];
  const stepIndex = Number(solicitud.paso_actual || 0);
  plan[stepIndex] = {
    ...plan[stepIndex],
    actionTokenHashes: [
      { source: 'primary', hash: hashToken(primary) },
      ...(alternate ? [{ source: alternateAccessSource, hash: hashToken(alternate) }] : [])
    ]
  };
  await solicitud.update({
    plan_aprobacion: plan,
    token_accion_hash: hashToken(primary),
    token_etapa: step.key,
    estado: step.action === 'liquidacion'
      ? 'pendiente_liquidacion'
      : step.action === 'pago'
        ? 'pendiente_autorizacion_pago'
        : `pendiente_aprobacion_${step.key}`
  });
  return { primary, alternate };
};

const formatTripMoment = (date, time) => {
  const rawDate = clean(date, 20);
  const dateLabel = /^(\d{4})-(\d{2})-(\d{2})$/.test(rawDate)
    ? rawDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
    : rawDate;
  return [dateLabel, clean(time, 12)].filter(Boolean).join(' · ') || 'Sin información';
};

const summaryHtml = (solicitud) => {
  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const days = calculateDays(salida, viaticos.numeroDiasSolicitados);
  const field = (label, value, className = '') => `<div class="summary-field ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || 'No registrado')}</strong></div>`;
  return `
    <style>
      .page-title{font-size:26px;letter-spacing:-.35px;margin-bottom:18px;border:0;padding:0}
      .notice{position:relative;border:1px solid #f4d58d;border-left:0;border-radius:12px;padding:15px 18px 15px 48px;background:linear-gradient(135deg,#fffaf0,#fff7dd);box-shadow:0 5px 16px rgba(146,95,10,.07);margin:0 0 20px}
      .notice:before{content:'i';position:absolute;left:16px;top:15px;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;background:#d97706;color:#fff;font:700 14px Georgia,serif}
      .summary-card{overflow:hidden;margin:0 0 20px;border:1px solid #dce6f2;border-radius:16px;background:#fff;box-shadow:0 12px 28px rgba(15,45,80,.08)}
      .summary-head{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:18px 20px;background:linear-gradient(135deg,#0b3a6f,#125394);color:#fff}
      .summary-eyebrow{display:block;margin-bottom:3px;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase;color:#bfdbfe}
      .summary-code{display:block;font-size:17px;line-height:1.25;letter-spacing:.15px}
      .summary-days{flex:0 0 auto;min-width:68px;padding:8px 13px;border:1px solid rgba(255,255,255,.25);border-radius:999px;background:rgba(255,255,255,.13);text-align:center;font-size:13px;font-weight:700;white-space:nowrap}
      .summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;padding:6px 20px 16px}
      .summary-field{min-width:0;padding:13px 12px;border-bottom:1px solid #e8eef5}
      .summary-field span{display:block;margin-bottom:4px;color:#64748b;font-size:10px;font-weight:800;letter-spacing:.65px;text-transform:uppercase}
      .summary-field strong{display:block;color:#1e293b;font-size:14px;line-height:1.4;overflow-wrap:anywhere}
      .summary-field-wide{grid-column:1/-1}
      .summary-destination{margin:12px 12px 4px;padding:14px 16px;border:1px solid #cfe0f5;border-radius:12px;background:#f4f8fd}
      .summary-destination strong{font-size:16px;color:#0b3a6f}
      .summary-timeline{grid-column:1/-1;display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:10px;padding:14px 12px;border-bottom:1px solid #e8eef5}
      .summary-moment{padding:11px 13px;border-radius:10px;background:#f8fafc}
      .summary-moment span{display:block;margin-bottom:3px;color:#64748b;font-size:10px;font-weight:800;letter-spacing:.65px;text-transform:uppercase}
      .summary-moment strong{color:#172033;font-size:14px}
      .summary-arrow{color:#1d4ed8;font-size:20px;font-weight:700}
      .legal-notice{position:relative;margin:0 0 24px;padding:16px 18px 16px 50px;border:1px solid #f3d28e;border-radius:12px;background:#fffbeb;color:#713f12;font-size:14px;line-height:1.5}
      .legal-notice:before{content:'!';position:absolute;left:17px;top:17px;width:22px;height:22px;border-radius:7px;display:grid;place-items:center;background:#f59e0b;color:#fff;font-weight:900}
      @media(max-width:640px){.page-title{font-size:21px}.summary-head{align-items:flex-start;padding:16px}.summary-grid{grid-template-columns:1fr;padding:5px 12px 12px}.summary-field-wide,.summary-timeline{grid-column:1}.summary-timeline{grid-template-columns:1fr;padding:12px}.summary-arrow{transform:rotate(90deg);text-align:center;line-height:1}.summary-days{min-width:auto}.notice{padding-left:44px}.legal-notice{padding-left:45px}}
    </style>
    <section class="summary-card" aria-label="Resumen de la solicitud">
      <header class="summary-head">
        <div><span class="summary-eyebrow">Solicitud de desplazamiento</span><strong class="summary-code">${escapeHtml(solicitud.consecutivo)}</strong></div>
        <div class="summary-days">${escapeHtml(days)} ${Number(days) === 1 ? 'día' : 'días'}</div>
      </header>
      <div class="summary-grid">
        ${field('Solicitante', personal.nombre)}
        ${field('Documento', personal.documento)}
        ${field('Dependencia', laboral.dependencia)}
        ${field('Cargo', laboral.cargo)}
        ${field('Destino', viaticos.lugarVisitar || salida.municipio || salida.pais, 'summary-field-wide summary-destination')}
        <div class="summary-timeline">
          <div class="summary-moment"><span>Salida</span><strong>${escapeHtml(formatTripMoment(salida.fecha, salida.horaInicio))}</strong></div>
          <div class="summary-arrow" aria-hidden="true">→</div>
          <div class="summary-moment"><span>Regreso</span><strong>${escapeHtml(formatTripMoment(salida.fechaRegreso, salida.horaFin))}</strong></div>
        </div>
        ${field('Objeto de la comisión', viaticos.objetoComision, 'summary-field-wide')}
      </div>
    </section>
    <div class="legal-notice"><strong>Importante:</strong> ${escapeHtml(LEGALIZATION_NOTICE.replace(/^IMPORTANTE:\s*/i, ''))}</div>`;
};

const emailStep = async (solicitud, step, tokenBundle) => {
  const primaryToken = typeof tokenBundle === 'string' ? tokenBundle : tokenBundle.primary;
  const alternateToken = typeof tokenBundle === 'string' ? null : tokenBundle.alternate;
  const actionUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/accion/${primaryToken}`;
  const isFinancialStage = ['tecnico_contable', 'tesoreria', 'financiera_final'].includes(step.key);
  const isTechnicianStage = step.key === 'tecnico_contable';
  const normalReport = isFinancialStage ? null : await getLinkedNormalReport(solicitud);
  const [attachment, pdfAttachment] = await Promise.all([
    isTechnicianStage
      ? Promise.resolve(null)
      : buildXlsxAttachment(solicitud, { includeFinancial: isFinancialStage }),
    isFinancialStage
      ? buildLiquidationPdfAttachment(solicitud)
      : normalReport
        ? ensureReporteSalidaPdf(normalReport)
        : buildPdfAttachment(solicitud, { includeFinancial: false })
  ]);
  const supportAttachment = buildSupportAttachment(solicitud);
  const title = step.key === 'sst'
    ? 'Validación de salida y ampliación de cobertura ARL'
    : step.action === 'liquidacion'
    ? 'Liquidación de viáticos pendiente'
    : step.action === 'pago'
      ? 'Autorización de pago pendiente'
      : step.action === 'tramite'
        ? 'Trámite de Tesorería pendiente'
      : step.key === 'financiera_final'
        ? 'Revisión y aprobación financiera pendiente'
      : `Visto bueno pendiente: ${step.label}`;
  const buttonLabel = step.action === 'liquidacion'
    ? 'Generar liquidación de viáticos y gastos de viaje'
    : step.action === 'pago'
      ? 'Autorizar pago'
      : step.action === 'tramite'
        ? 'Tramitar solicitud'
      : 'Revisar solicitud';
  const stageInstruction = step.key === 'sst'
    ? '<p>Revise las condiciones de la salida y gestione la validación o ampliación de la cobertura de la ARL antes de otorgar el visto bueno.</p>'
    : '';
  const html = renderInstitutionalTemplate({
    title,
    introHtml: `<p>Saludo de paz y bien,</p><p>La solicitud de desplazamiento <strong>${escapeHtml(solicitud.consecutivo)}</strong> requiere su actuación como <strong>${escapeHtml(step.label)}</strong>.</p>`,
    bodyHtml: `${stageInstruction}${summaryHtml(solicitud)}<p style="text-align:center;margin:22px 0"><a href="${actionUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">${buttonLabel}</a></p>`
  });
  const result = await sendInstitutionalEmail({
    to: step.email,
    subject: `${solicitud.consecutivo} | ${title}`,
    text: `${title}. Ingrese a ${actionUrl}`,
    html,
    attachments: [pdfAttachment, attachment, supportAttachment].filter(Boolean)
  });
  let alternateResult = null;
  if (alternateToken && step.alternateApprovalEmail) {
    const alternateActionUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/accion/${alternateToken}`;
    const absenceRole = step.alternateAbsenceRole || step.label;
    const authorityLabel = step.alternateAuthorityLabel || step.alternateApprovalLabel || 'la autoridad correspondiente';
    alternateResult = await sendInstitutionalEmail({
      to: step.alternateApprovalEmail,
      subject: `${solicitud.consecutivo} | Acceso alterno para visto bueno`,
      text: `La solicitud ${solicitud.consecutivo} requiere el visto bueno de ${absenceRole}. Este acceso alterno solo debe utilizarse ante su ausencia y exige observación.`,
      html: renderInstitutionalTemplate({
        title: 'Acceso alterno para visto bueno',
        introHtml: `<p>Saludo de paz y bien,</p><p>Se remite al correo institucional de <strong>${escapeHtml(step.alternateApprovalLabel || 'la dependencia')}</strong> un acceso alterno para la solicitud <strong>${escapeHtml(solicitud.consecutivo)}</strong>.</p>`,
        bodyHtml: `<div style="padding:14px 16px;border-left:4px solid #d97706;background:#fffbeb;color:#713f12;margin-bottom:18px"><strong>Uso restringido:</strong> este acceso solo debe utilizarse cuando ${escapeHtml(absenceRole)} no se encuentre disponible. La actuación se registrará a nombre de ${escapeHtml(authorityLabel)}, exige una observación y quedará identificada en la trazabilidad.</div>${summaryHtml(solicitud)}<p style="text-align:center;margin:22px 0"><a href="${alternateActionUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Revisar solicitud</a></p>`
      }),
      attachments: [pdfAttachment, attachment, supportAttachment].filter(Boolean)
    });
  }
  const infoEmails = [...new Set((step.infoEmails || []).filter(Boolean).map(normalizeEmail))];
  if (step.key === 'financiera_final' && infoEmails.length) {
    await sendInstitutionalEmail({
      to: infoEmails,
      subject: `${solicitud.consecutivo} | Copia para revisión financiera`,
      text: `La solicitud ${solicitud.consecutivo} fue remitida a la Vicerrectoría Financiera y de Desarrollo Institucional. Después de su aprobación pasará a Tesorería/Pagaduría para autorizar el pago. Esta copia es informativa.`,
      html: renderInstitutionalTemplate({
        title: 'Copia informativa - revisión financiera',
        introHtml: '<p>Saludo de paz y bien,</p><p>La solicitud fue remitida a la Vicerrectoría Financiera y de Desarrollo Institucional. Una vez aprobada pasará a Tesorería/Pagaduría para autorizar el pago. Esta copia no contiene un botón de aprobación.</p>',
        bodyHtml: summaryHtml(solicitud)
      }),
      attachments: [pdfAttachment, attachment, supportAttachment].filter(Boolean)
    });
  }
  return alternateResult
    ? { success: result.success && alternateResult.success, primary: result, alternate: alternateResult }
    : result;
};

const sendRadicationCopies = async (solicitud, recipients = []) => {
  const targetEmails = [...new Set(recipients.filter(Boolean).map(normalizeEmail))];
  if (!targetEmails.length) return { success: true };
  const normalReport = await getLinkedNormalReport(solicitud);
  const pdfAttachment = normalReport
    ? await ensureReporteSalidaPdf(normalReport)
    : await buildPdfAttachment(solicitud, { includeFinancial: false });
  const supportAttachment = buildSupportAttachment(solicitud);
  const firstStep = (solicitud.plan_aprobacion || [])[0];
  return sendInstitutionalEmail({
    to: targetEmails,
    subject: `${solicitud.consecutivo} | Solicitud de desplazamiento radicada`,
    text: `La solicitud ${solicitud.consecutivo} fue radicada y enviada a ${firstStep?.label || 'la primera etapa de aprobación'}.`,
    html: renderInstitutionalTemplate({
      title: 'Solicitud de desplazamiento radicada',
      introHtml: `<p>Saludo de paz y bien,</p><p>Se remite copia informativa de la solicitud radicada. La primera actuación corresponde a <strong>${escapeHtml(firstStep?.label || 'la instancia responsable')}</strong>.</p>`,
      bodyHtml: summaryHtml(solicitud)
    }),
    attachments: [pdfAttachment, supportAttachment].filter(Boolean)
  });
};

const sendRequesterNotice = async (solicitud, title, message, { final = false } = {}) => {
  const recipient = solicitud.solicitante_snapshot?.email || solicitud.solicitante_snapshot?.correo;
  if (!recipient) return { success: false, error: 'Solicitante sin correo' };
  const [attachment, pdfAttachment] = await Promise.all([
    buildXlsxAttachment(solicitud, { includeFinancial: final }),
    final ? buildLiquidationPdfAttachment(solicitud) : buildPdfAttachment(solicitud, { includeFinancial: false })
  ]);
  const supportAttachment = buildSupportAttachment(solicitud);
  return sendInstitutionalEmail({
    to: recipient,
    subject: `${solicitud.consecutivo} | ${title}`,
    text: message,
    html: renderInstitutionalTemplate({ title, introHtml: `<p>Saludo de paz y bien,</p><p>${escapeHtml(message)}</p>`, bodyHtml: summaryHtml(solicitud) }),
    attachments: [pdfAttachment, attachment, supportAttachment].filter(Boolean)
  });
};

const sendNormalReportFinalCopies = async (solicitud, report = null) => {
  const normalReport = report || await getLinkedNormalReport(solicitud);
  if (!normalReport) return { success: false, error: 'No se encontró el reporte de salida vinculado.' };
  const pdfAttachment = await ensureReporteSalidaPdf(normalReport);
  const supportAttachment = buildSupportAttachment(solicitud);
  const recipients = getDesplazamientoViaticosRecipients();
  const dependenciaEmail = normalizeEmail(getDependencyEmail(solicitud.datos_laborales?.dependencia));
  const authorityEmail = isAcademicVicerrectoriaAssignment(solicitud.datos_laborales)
    ? recipients.academica
    : isRectoriaAssignment(solicitud.datos_laborales)
      ? recipients.rectoria
      : isResearchVicerrectoriaAssignment(solicitud.datos_laborales)
        ? recipients.investigacion
        : isEvangelizationVicerrectoriaAssignment(solicitud.datos_laborales)
          ? recipients.evangelizacion
          : normalizeEmail(getDependencyEmail(solicitud.datos_laborales?.vicerrectoria));
  const rectoriaFinalCopyEmail = isResearchVicerrectoriaAssignment(solicitud.datos_laborales)
    ? recipients.rectoria
    : '';
  const targets = [...new Set([
    recipients.sst,
    recipients.gestionHumana,
    dependenciaEmail,
    authorityEmail,
    rectoriaFinalCopyEmail
  ].filter(Boolean).map(normalizeEmail))];
  const results = await Promise.all(targets.map((email) => sendInstitutionalEmail({
    to: email,
    subject: `${solicitud.consecutivo} | Reporte de salida aprobado`,
    text: `El reporte de salida ${solicitud.consecutivo} finalizó su flujo de autorización. Se adjunta el PDF aprobado.`,
    html: renderInstitutionalTemplate({
      title: 'Reporte de salida aprobado',
      introHtml: '<p>Saludo de paz y bien,</p><p>Gestión Humana aprobó el reporte de salida. Se remite copia informativa del documento finalizado.</p>',
      bodyHtml: summaryHtml(solicitud)
    }),
    attachments: [pdfAttachment, supportAttachment].filter(Boolean)
  })));
  return { success: results.every((result) => result.success), recipients: targets, results };
};

const sendFinalizedCopies = async (solicitud) => {
  const recipients = getDesplazamientoViaticosRecipients();
  const normalReport = await getLinkedNormalReport(solicitud);
  const [liquidationPdfAttachment, normalReportPdfAttachment] = await Promise.all([
    buildLiquidationPdfAttachment(solicitud),
    normalReport ? ensureReporteSalidaPdf(normalReport) : Promise.resolve(null)
  ]);
  const supportAttachment = buildSupportAttachment(solicitud);
  const collaboratorEmail = normalizeEmail(solicitud.solicitante_snapshot?.email || solicitud.solicitante_snapshot?.correo);
  const financialRecipients = [...new Set([
    recipients.tecnicoContable,
    recipients.financiera
  ].filter(Boolean).map(normalizeEmail))];
  const results = [];
  if (collaboratorEmail) {
    results.push(await sendInstitutionalEmail({
      to: collaboratorEmail,
      subject: `${solicitud.consecutivo} | Solicitud aprobada y finalizada`,
      text: `Tesorería/Pagaduría autorizó el pago de la solicitud ${solicitud.consecutivo}. Se adjuntan el reporte de salida y la liquidación final firmada.`,
      html: renderInstitutionalTemplate({
        title: 'Solicitud aprobada y finalizada',
        introHtml: '<p>Saludo de paz y bien,</p><p>Tesorería/Pagaduría autorizó el pago y finalizó la solicitud. Como colaborador solicitante, recibe el reporte de salida aprobado y la liquidación final firmada.</p>',
        bodyHtml: summaryHtml(solicitud)
      }),
      attachments: [normalReportPdfAttachment, liquidationPdfAttachment, supportAttachment].filter(Boolean)
    }));
  }
  results.push(...await Promise.all(financialRecipients.map((email) => sendInstitutionalEmail({
    to: email,
    subject: `${solicitud.consecutivo} | Liquidación final y pago autorizado`,
    text: `Tesorería/Pagaduría autorizó el pago de la liquidación de viáticos ${solicitud.consecutivo}.`,
    html: renderInstitutionalTemplate({
      title: 'Liquidación final y pago autorizado',
      introHtml: '<p>Saludo de paz y bien,</p><p>Tesorería/Pagaduría autorizó el pago. Se adjunta exclusivamente la liquidación final con todas las firmas electrónicas.</p>',
      bodyHtml: summaryHtml(solicitud)
    }),
    attachments: [liquidationPdfAttachment, supportAttachment].filter(Boolean)
  }))));
  return { success: results.length > 0 && results.every((result) => result.success), results };
};

const advance = async (solicitud, actor, detail = {}) => {
  const plan = solicitud.plan_aprobacion || [];
  const current = plan[solicitud.paso_actual];
  const nextIndex = solicitud.paso_actual + 1;
  const traceEvent = current.action === 'approval' ? `aprobado_${current.key}` : `completado_${current.key}`;
  await solicitud.update({
    paso_actual: nextIndex,
    trazabilidad: appendTrace(solicitud, traceEvent, actor, detail),
    token_accion_hash: null,
    token_etapa: null
  });
  const next = plan[nextIndex];
  if (!next) return null;
  const tokens = await issueTokens(solicitud, next);
  await emailStep(solicitud, next, tokens);
  return next;
};

const validatePayload = (body = {}) => {
  const issues = [];
  const salida = body.salida || {};
  const viaticos = body.viaticos || {};
  if (body.isSalidaMultiple) issues.push('La solicitud de viáticos solo aplica a salidas individuales.');
  if (salida.categoria !== 'propias_cargo') issues.push('La solicitud de viáticos solo aplica a salidas misionales.');
  if (!isEligibleDestination(salida)) issues.push('El destino seleccionado no habilita la solicitud de viáticos.');
  if (viaticos.requiereViaticos !== true) issues.push('Debe confirmar que el desplazamiento requiere viáticos.');
  ['lugarVisitar', 'fechaEvento', 'objetoComision', 'centroCosto', 'alojamiento', 'transporte', 'tipoCuenta', 'entidadBancaria', 'numeroCuenta'].forEach((field) => {
    if (!clean(viaticos[field])) issues.push(`Falta completar ${field}.`);
  });
  if (!Number.isInteger(Number(viaticos.numeroDiasSolicitados)) || Number(viaticos.numeroDiasSolicitados) < 1) issues.push('Debe digitar una cantidad válida de días solicitados.');
  if (!viaticos.autorizacionAceptada) issues.push('Debe aceptar la autorización de descuento.');
  if (!Number(body.documentoId)) issues.push('No fue posible identificar el formato de reporte de salida.');
  if (!salida.fecha || !salida.fechaRegreso || !salida.horaInicio || !salida.horaFin) issues.push('Debe completar las fechas y horas del desplazamiento.');
  if (!body.jefeInmediato?.email) issues.push('El jefe inmediato debe tener correo registrado.');
  if (!clean(body.laboral?.dependencia) || !clean(body.laboral?.cargo) || !clean(body.laboral?.vicerrectoria)) issues.push('La información laboral está incompleta.');
  if (!['Hotel', 'Casa de familia', 'No requiere'].includes(viaticos.alojamiento)) issues.push('Seleccione una opción válida de alojamiento.');
  if (!['Terrestre', 'Aéreo', 'Mixto'].includes(viaticos.transporte)) issues.push('Seleccione una opción válida de transporte.');
  if (!['Ahorros', 'Corriente'].includes(viaticos.tipoCuenta)) issues.push('Seleccione un tipo de cuenta válido.');
  const start = new Date(`${salida.fecha || ''}T${salida.horaInicio || ''}`);
  const end = new Date(`${salida.fechaRegreso || ''}T${salida.horaFin || ''}`);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end <= start) issues.push('La fecha y hora de regreso deben ser posteriores a la salida.');
  return issues;
};

const radicarSolicitud = async (req, res) => {
  try {
    const issues = validatePayload(req.body);
    if (issues.length) return res.status(400).json({ success: false, message: issues[0], issues });
    const body = req.body;
    const personal = {
      nombre: clean(req.user?.nombre || body.personal?.nombre, 150),
      documento: clean(req.user?.username || body.personal?.documento, 50),
      email: normalizeEmail(req.user?.email || body.personal?.correo)
    };
    const laboral = {
      dependencia: clean(body.laboral?.dependencia, 250),
      vicerrectoria: clean(body.laboral?.vicerrectoria, 250),
      cargo: clean(body.laboral?.cargo, 250)
    };
    const jefe = {
      nombre: clean(body.jefeInmediato?.nombre || body.jefeInmediato?.jefe_inmediato, 180),
      email: normalizeEmail(body.jefeInmediato?.email),
      cargo: clean(body.jefeInmediato?.cargo, 180),
      dependencia: clean(body.jefeInmediato?.dependencia, 220)
    };
    const { steps, dependenciaEmail } = buildApprovalPlan({ jefe, laboral });
    if (!steps.length) return res.status(400).json({ success: false, message: 'No fue posible construir el flujo de aprobación.' });
    const consecutivo = await nextConsecutivo();
    const transaction = await sequelize.transaction();
    let solicitud;
    try {
      const normalReport = await ReporteSalidaSolicitud.create(buildNormalReportData({
        consecutivo,
        userId: req.user.id,
        documentoId: Number(body.documentoId),
        jefeUserId: body.jefeInmediatoUserId,
        personal,
        jefe,
        laboral,
        salida: body.salida,
        viaticos: body.viaticos,
        steps
      }), { transaction });
      solicitud = await DesplazamientoViaticosSolicitud.create({
        consecutivo,
        user_id: req.user.id,
        documento_id: body.documentoId,
        jefe_inmediato_user_id: body.jefeInmediatoUserId || null,
        solicitante_snapshot: personal,
        jefe_snapshot: jefe,
        datos_laborales: laboral,
        datos_salida: body.salida,
        datos_viaticos: {
          ...body.viaticos,
          reporteSalidaSolicitudId: normalReport.id,
          soporteAdjunto: body.viaticos?.soporteAdjunto ? {
            filename: path.basename(clean(body.viaticos.soporteAdjunto.filename, 240)),
            originalName: path.basename(clean(body.viaticos.soporteAdjunto.originalName, 240))
          } : null,
          autorizacionTexto: AUTHORIZATION_TEXT,
          avisoLegalizacion: LEGALIZATION_NOTICE
        },
        plan_aprobacion: steps,
        trazabilidad: [{ event: 'radicada', actor: personal, at: new Date().toISOString() }]
      }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    const tokens = await issueTokens(solicitud, steps[0]);
    const alternateFirstStepEmail = normalizeEmail(steps[0].alternateApprovalEmail);
    const radicationCopyRecipients = [personal.email, dependenciaEmail]
      .filter((email) => normalizeEmail(email) !== alternateFirstStepEmail);
    await Promise.all([
      emailStep(solicitud, steps[0], tokens),
      sendRadicationCopies(solicitud, radicationCopyRecipients)
    ]);
    return res.status(201).json({ success: true, message: 'Solicitud de desplazamiento con viáticos radicada exitosamente.', consecutivo: solicitud.consecutivo, flujo: 'desplazamiento_viaticos' });
  } catch (error) {
    console.error('[desplazamientos-viaticos] Error al radicar:', error);
    return res.status(500).json({ success: false, message: 'No fue posible radicar la solicitud de desplazamiento.' });
  }
};

const findActiveActionByToken = async (token) => {
  if (!String(token || '').trim()) return null;
  try {
    const payload = decryptPayload(token);
    if (payload?.purpose !== 'desplazamiento_viaticos_action' || !payload.solicitudId || !payload.stage) return null;
    const solicitud = await DesplazamientoViaticosSolicitud.findByPk(payload.solicitudId);
    if (!solicitud || solicitud.token_etapa !== payload.stage) return null;
    const step = (solicitud.plan_aprobacion || [])[solicitud.paso_actual];
    if (!step || step.key !== payload.stage) return null;
    const currentHash = hashToken(token);
    const acceptedHashes = (step.actionTokenHashes || []).map((entry) => entry.hash);
    const isPrimaryLegacyToken = solicitud.token_accion_hash === currentHash;
    if (!isPrimaryLegacyToken && !acceptedHashes.includes(currentHash)) return null;
    return { solicitud, payload, step };
  } catch (_) {
    return null;
  }
};

const findProcessedAction = async (token) => {
  try {
    const payload = decryptPayload(token);
    if (payload?.purpose !== 'desplazamiento_viaticos_action' || !payload.solicitudId || !payload.stage) return null;
    const solicitud = await DesplazamientoViaticosSolicitud.findByPk(payload.solicitudId);
    if (!solicitud) return null;
    const trace = (solicitud.trazabilidad || []).find((entry) => (
      entry.event === `aprobado_${payload.stage}`
      || entry.event === `completado_${payload.stage}`
      || entry.event === `no_aprobado_${payload.stage}`
    ));
    return trace ? { solicitud, stage: payload.stage, trace } : null;
  } catch (_) {
    return null;
  }
};

const page = (title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" href="/api/desplazamientos-viaticos/assets/escudo.png"><link rel="apple-touch-icon" href="/api/desplazamientos-viaticos/assets/escudo.png"><title>${escapeHtml(title)}</title><style>body{margin:0;padding:28px 16px;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155}.card{max-width:900px;margin:0 auto;background:#fff;border:1px solid #dbeafe;border-radius:14px;box-shadow:0 12px 35px #0f172a1f;overflow:hidden}.institutional-image{display:block;width:100%;height:auto;max-height:175px;object-fit:contain;background:#fff}.brand-bar{background:#0b3a6f;color:#fff;padding:14px 26px}.brand-name{font-size:15px;font-weight:800;letter-spacing:.4px}.brand-subtitle{font-size:11px;margin-top:4px;opacity:.95}.body{padding:26px 30px 30px}.page-title{margin:0 0 20px;padding:0 0 12px;border-bottom:2px solid #e5eef9;color:#0b3a6f;font-size:22px;line-height:1.25}.content{font-size:15px;line-height:1.55}.institutional-signature{margin-top:30px;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}.institutional-signature strong{display:block;margin-top:5px;color:#0b3a6f;font-size:13px}button{border:0;border-radius:8px;padding:12px 18px;font-weight:700;cursor:pointer}.ok{background:#166534;color:#fff}.bad{background:#b91c1c;color:#fff}.primary{background:#1d4ed8;color:#fff}.remove-row{background:#dc2626;color:#fff;border:1px solid #b91c1c;padding:10px 14px}.remove-row:hover{background:#b91c1c}.currency-input{display:flex;align-items:center;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;background:#fff;margin:5px 0 12px;overflow:hidden}.currency-input span{padding:0 0 0 10px;font-weight:700;color:#334155}.currency-input input{border:0;outline:0;margin:0;padding-left:6px;background:transparent}input,textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:7px;margin:5px 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #dbe3ee;text-align:left}th{background:#e8eef6}.actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:20px}.notice{padding:12px;background:#fffbeb;border-left:4px solid #d97706;margin:15px 0}.add-concept{display:block;margin:12px 0 0}.observations-label{display:block;margin-top:28px;margin-bottom:5px;font-weight:600}@media(max-width:640px){body{padding:0}.card{border-radius:0;border-left:0;border-right:0}.body{padding:20px 16px}.page-title{font-size:19px}.institutional-image{max-height:120px}table{font-size:12px}th,td{padding:6px}}</style></head><body><main class="card"><img class="institutional-image" src="/api/desplazamientos-viaticos/assets/encabezado-correos.png" alt="Universidad CESMAG"><div class="brand-bar"><div class="brand-name">SIAC UNICESMAG</div><div class="brand-subtitle">Sistema Interno de Aseguramiento de la Calidad</div></div><section class="body"><h1 class="page-title">${escapeHtml(title)}</h1><div class="content">${body}</div><footer class="institutional-signature"><em>Fraternalmente,</em><strong>SIAC UNICESMAG</strong><span>Hombres nuevos para tiempos nuevos</span></footer></section></main></body></html>`;

const liquidacionForm = (solicitud, token, nonce, { demo = false, demoCanSubmit = false, demoTechnicianOnly = false } = {}) => {
  const rows = `<tr hidden><td colspan="5"><input type="hidden" name="liquidationRowsVersion" value="2"></td></tr>${BASE_DETAIL_NAMES.map((name, index) => `<tr data-liquidation-row><td><input type="hidden" name="baseIncluded${index}" value="1">${escapeHtml(name)}</td><td><div class="currency-input"><span aria-hidden="true">$</span><input class="valor-diario" inputmode="numeric" type="number" min="0" step="1" name="valorDiario${index}" value="0" aria-label="Valor diario en pesos para ${escapeHtml(name)}" required></div></td><td><input class="dias" inputmode="numeric" type="number" min="0" step="1" name="dias${index}" value="0" required></td><td class="row-total">$0</td><td><button class="remove-row" type="button" aria-label="Eliminar ${escapeHtml(name)}">Eliminar</button></td></tr>`).join('')}`;
  const calculator = `<script nonce="${nonce}">(()=>{const body=document.getElementById('liquidacion-detalles');const count=document.getElementById('extra-count');const money=n=>new Intl.NumberFormat('es-CO',{style:'currency',currency:'COP',maximumFractionDigits:0}).format(n||0);const update=()=>{let grand=0;body.querySelectorAll('tr[data-liquidation-row]').forEach(row=>{const v=Number(row.querySelector('.valor-diario').value||0);const d=Number(row.querySelector('.dias').value||0);const total=v*d;grand+=total;row.querySelector('.row-total').textContent=money(total)});document.getElementById('total-anticipo').textContent=money(grand)};document.getElementById('agregar-concepto').addEventListener('click',()=>{const i=Number(count.value||0);if(i>=30)return;const row=document.createElement('tr');row.setAttribute('data-liquidation-row','');row.innerHTML='<td><input class="detalle-extra" name="extraDetalle'+i+'" maxlength="120" placeholder="Nombre del concepto" required></td><td><div class="currency-input"><span aria-hidden="true">$</span><input class="valor-diario" inputmode="numeric" type="number" min="0" step="1" name="extraValorDiario'+i+'" value="0" aria-label="Valor diario en pesos" required></div></td><td><input class="dias" inputmode="numeric" type="number" min="0" step="1" name="extraDias'+i+'" value="0" required></td><td class="row-total">$0</td><td><button class="remove-row" type="button" aria-label="Eliminar concepto">Eliminar</button></td>';body.appendChild(row);count.value=String(i+1);row.querySelector('.detalle-extra').focus();update()});body.addEventListener('input',update);body.addEventListener('click',event=>{const button=event.target.closest('.remove-row');if(button){button.closest('tr').remove();update()}});update()})()</script>`;
  const demoNotice = demoTechnicianOnly
    ? '<div class="notice"><strong>PRUEBA EXCLUSIVA DEL TÉCNICO:</strong> puede diligenciar y procesar la liquidación. No se enviará a Tesorería, no se notificará a otros correos y no se modificará una solicitud real.</div>'
    : demoCanSubmit
      ? `<div class="notice"><strong>PRUEBA CONTROLADA:</strong> al enviar, la liquidación llegará exclusivamente a ${escapeHtml(DEMO_TREASURY_EMAIL)}. No avanzará por el flujo institucional ni modificará una solicitud real.</div>`
    : demo ? '<div class="notice"><strong>VISTA DE PRUEBA:</strong> puede escribir valores y verificar todos los cálculos. Esta pantalla no guarda información ni envía la liquidación a Tesorería.</div>' : '';
  const submitButton = demo && !demoCanSubmit
    ? '<button type="button" disabled style="background:#94a3b8;color:#fff;cursor:not-allowed">Vista de prueba — envío a Tesorería deshabilitado</button>'
    : demoTechnicianOnly
      ? '<button class="primary" type="submit">Procesar liquidación de prueba</button>'
    : demoCanSubmit
      ? '<button class="primary" type="submit">Enviar liquidación de prueba a Tesorería</button>'
    : '<button class="primary" type="submit">Enviar liquidación a Tesorería</button>';
  const formAction = demoCanSubmit
    ? `/api/desplazamientos-viaticos/prueba/liquidacion/${token}`
    : demo ? '#' : `/api/desplazamientos-viaticos/accion/${token}`;
  return page('Generar liquidación de viáticos y gastos de viaje', `${demoNotice}${summaryHtml(solicitud)}<form method="post" action="${formAction}">${demo && !demoCanSubmit ? '' : '<input type="hidden" name="accion" value="liquidar">'}<input id="extra-count" type="hidden" name="extraCount" value="0"><table><thead><tr><th>Detalle</th><th>Valor diario (COP)</th><th>No. días</th><th>Valor total (COP)</th><th>Acción</th></tr></thead><tbody id="liquidacion-detalles">${rows}</tbody><tfoot><tr><th colspan="3">TOTAL ANTICIPO</th><th id="total-anticipo">$0</th><th></th></tr></tfoot></table><button id="agregar-concepto" class="primary add-concept" type="button">+ Agregar otro concepto</button><label class="observations-label">Observaciones a la liquidación</label><textarea name="observaciones" maxlength="2000" rows="4" placeholder="Escriba aquí las observaciones de la liquidación..."></textarea>${submitButton}</form>${calculator}`);
};

const approvalForm = (solicitud, step, token, { accessSource = 'primary' } = {}) => {
  const isAlternateAccess = accessSource === step.alternateAccessSource && step.key === 'jefe';
  const privacyNotice = ['sst', 'gestion_humana'].includes(step.key)
    ? '<div class="notice">Esta vista contiene únicamente la información del permiso. La liquidación financiera se gestiona posteriormente y con acceso restringido.</div>'
    : '';
  const delegatedNotice = isAlternateAccess
    ? `<div class="notice"><strong>Acceso alterno de ${escapeHtml(step.alternateApprovalLabel || 'la dependencia')}.</strong> Utilice este enlace únicamente cuando ${escapeHtml(step.alternateAbsenceRole || step.label)} no esté disponible. La observación es obligatoria y este acceso quedará identificado en la trazabilidad a nombre de ${escapeHtml(step.alternateAuthorityLabel || step.alternateApprovalLabel || 'la autoridad correspondiente')}.</div>`
    : '';
  const observationLabel = isAlternateAccess ? 'Observación obligatoria de la actuación delegada' : 'Observación (obligatoria si no aprueba)';
  return page(`Revisión pendiente: ${step.label}`, `${summaryHtml(solicitud)}${privacyNotice}${delegatedNotice}<form method="post" action="/api/desplazamientos-viaticos/accion/${token}"><div class="actions"><button class="ok" name="accion" value="aprobar" type="submit">Dar visto bueno</button><button class="bad" name="accion" value="rechazar" type="submit">No aprobar</button></div><label>${observationLabel}</label><textarea name="observacion" maxlength="1200" rows="4"${isAlternateAccess ? ' required' : ''}></textarea></form>`);
};

const treasuryForm = (solicitud, token) => page('Autorizar pago en Tesorería / Pagaduría', `${summaryHtml(solicitud)}<p>La liquidación ya cuenta con la aprobación de la Vicerrectoría Financiera y de Desarrollo Institucional. Revise el documento y autorice el pago para finalizar la solicitud.</p><form method="post" action="/api/desplazamientos-viaticos/accion/${token}"><label>Observación de Tesorería / Pagaduría</label><textarea name="observacion" maxlength="1200" rows="4"></textarea><button class="primary" name="accion" value="autorizar_pago" type="submit">Autorizar pago</button></form>`);

const legacyTreasuryForm = (solicitud, token) => page('Tramitar solicitud en Tesorería', `${summaryHtml(solicitud)}<div class="notice"><strong>Solicitud iniciada con el flujo anterior.</strong> Esta actuación se conserva únicamente para finalizar correctamente solicitudes que ya estaban en curso.</div><form method="post" action="/api/desplazamientos-viaticos/accion/${token}"><label>Observación de Tesorería</label><textarea name="observacion" maxlength="1200" rows="4"></textarea><button class="primary" name="accion" value="tramitar" type="submit">Tramitar solicitud</button></form>`);

const mostrarAccion = async (req, res) => {
  const actionContext = await findActiveActionByToken(req.params.token);
  if (!actionContext) {
    const processed = await findProcessedAction(req.params.token);
    if (processed) return res.status(409).send(page('Solicitud procesada', '<p>Esta actuación ya fue registrada correctamente. El enlace es de un solo uso y no permite realizar nuevamente el proceso.</p>'));
    return res.status(404).send(page('Enlace no disponible', '<p>El enlace no existe o dejó de estar vigente.</p>'));
  }
  const { solicitud, payload, step } = actionContext;
  if (!step || step.key !== solicitud.token_etapa) return res.status(409).send(page('Etapa no disponible', '<p>Esta etapa ya no está activa.</p>'));
  const nonce = crypto.randomBytes(18).toString('base64');
  res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'`);
  if (step.action === 'liquidacion') return res.send(liquidacionForm(solicitud, req.params.token, nonce));
  if (step.action === 'pago') return res.send(treasuryForm(solicitud, req.params.token));
  if (step.action === 'tramite') return res.send(legacyTreasuryForm(solicitud, req.params.token));
  return res.send(approvalForm(solicitud, step, req.params.token, { accessSource: payload.accessSource }));
};

const mostrarDemoLiquidacion = async (req, res) => {
  try {
    if (revokedDemoTokenHashes.has(hashToken(req.params.token))) {
      return res.status(410).send(page('Prueba revocada', '<p>Este enlace de prueba fue anulado y ya no permite acceder a la liquidación.</p>'));
    }
    const payload = decryptPayload(req.params.token);
    const demoTechnicianOnly = payload?.purpose === 'demo_liquidacion_solo_tecnico';
    const demoCanSubmit = demoTechnicianOnly || payload?.purpose === 'demo_liquidacion_viaticos_envio';
    if (!demoCanSubmit && payload?.purpose !== 'demo_liquidacion_viaticos') throw new Error('Propósito inválido');
    if (demoCanSubmit && await isDemoTokenProcessed(hashToken(req.params.token), usedDemoLiquidationTokens)) {
      return res.status(409).send(page('Solicitud procesada', '<p>La liquidación de prueba ya fue enviada. Este enlace es de un solo uso.</p>'));
    }
    const nonce = crypto.randomBytes(18).toString('base64');
    res.setHeader('Content-Security-Policy', `default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}'; form-action ${demoCanSubmit ? "'self'" : "'none'"}; base-uri 'none'; frame-ancestors 'none'`);
    const solicitudDemo = buildDemoSolicitud();
    solicitudDemo.solicitante_snapshot.email = payload.email || '';
    return res.send(liquidacionForm(solicitudDemo, req.params.token, nonce, { demo: true, demoCanSubmit, demoTechnicianOnly }));
  } catch (_) {
    return res.status(404).send(page('Vista de prueba no disponible', '<p>El enlace de prueba no es válido o ya expiró.</p>'));
  }
};

const procesarDemoLiquidacion = async (req, res) => {
  try {
    if (revokedDemoTokenHashes.has(hashToken(req.params.token))) {
      return res.status(410).send(page('Prueba revocada', '<p>Este enlace de prueba fue anulado y no permite procesar la liquidación.</p>'));
    }
    const payload = decryptPayload(req.params.token);
    const technicianOnly = payload?.purpose === 'demo_liquidacion_solo_tecnico';
    if (!technicianOnly && payload?.purpose !== 'demo_liquidacion_viaticos_envio') throw new Error('Propósito inválido');
    const tokenHash = hashToken(req.params.token);
    if (await isDemoTokenProcessed(tokenHash, usedDemoLiquidationTokens)) {
      return res.status(409).send(page('Prueba ya enviada', '<p>Esta liquidación de prueba ya fue enviada y el enlace no puede utilizarse nuevamente.</p>'));
    }
    const liquidacion = parseLiquidationBody(req.body);
    if (liquidacion.error) return res.status(400).send(page('Falta el detalle', `<p>${escapeHtml(liquidacion.error)}</p>`));
    if (technicianOnly) {
      await markDemoTokenProcessed(tokenHash, usedDemoLiquidationTokens, payload.exp);
      return res.send(page('Solicitud procesada', `<p>La liquidación de prueba por <strong>$${liquidacion.totalAnticipo.toLocaleString('es-CO')}</strong> fue procesada correctamente.</p><p>No se envió ningún correo adicional y no se modificó una solicitud real. Este enlace quedó cerrado.</p>`));
    }
    const solicitudDemo = buildDemoSolicitud(liquidacion);
    solicitudDemo.solicitante_snapshot.email = payload.email || '';
    solicitudDemo.trazabilidad = [{ event: 'completado_tecnico_contable', actor: { nombre: 'Técnico contable de prueba', email: payload.email || '' }, at: new Date().toISOString() }];
    const financialToken = encryptPayload({
      purpose: 'demo_financiera_aprobar',
      technicianEmail: payload.email || '',
      liquidacion
    }, 24 * 60 * 60);
    const financialUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/prueba/financiera/${financialToken}`;
    const pdfAttachment = await buildLiquidationPdfAttachment(solicitudDemo);
    const html = renderInstitutionalTemplate({
      title: 'PRUEBA - Revisión y aprobación financiera',
      introHtml: '<p><strong>ESTE ES UN CORREO DE PRUEBA. NO REALICE NINGÚN TRÁMITE REAL.</strong></p><p>El técnico contable diligenció la liquidación. Corresponde realizar la revisión y aprobación financiera.</p>',
      bodyHtml: `${summaryHtml(solicitudDemo)}<p><strong>Total anticipo:</strong> $${liquidacion.totalAnticipo.toLocaleString('es-CO')}</p><p><strong>Observaciones:</strong> ${escapeHtml(liquidacion.observaciones || 'Sin observaciones')}</p><p style="text-align:center;margin:22px 0"><a href="${financialUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Revisar y aprobar liquidación</a></p>`
    });
    const result = await sendInstitutionalEmail({
      to: normalizeEmail(payload.email || 'adsolarte@unicesmag.edu.co'),
      subject: `${solicitudDemo.consecutivo} | PRUEBA - Aprobación financiera`,
      text: `Correo de prueba. Total del anticipo: $${liquidacion.totalAnticipo.toLocaleString('es-CO')}.`,
      html,
      attachments: [pdfAttachment]
    });
    if (!result.success) throw new Error(result.error || 'No fue posible enviar el correo de prueba.');
    await markDemoTokenProcessed(tokenHash, usedDemoLiquidationTokens, payload.exp);
    return res.send(page('Solicitud procesada', `<p>La liquidación de prueba por <strong>$${liquidacion.totalAnticipo.toLocaleString('es-CO')}</strong> fue enviada a la revisión financiera de prueba.</p><p>Este enlace quedó cerrado y no permite un segundo envío.</p>`));
  } catch (error) {
    return res.status(400).send(page('No fue posible enviar la prueba', `<p>${escapeHtml(error.message || 'El enlace no es válido o ya expiró.')}</p>`));
  }
};

const mostrarDemoTesoreria = async (req, res) => {
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'demo_tesoreria_tramitar') throw new Error('Propósito inválido');
    const tokenHash = hashToken(req.params.token);
    if (await isDemoTokenProcessed(tokenHash, usedDemoTreasuryTokens)) return res.status(409).send(page('Pago ya autorizado', '<p>Esta autorización de pago de prueba ya fue registrada.</p>'));
    const solicitudDemo = buildDemoSolicitud(payload.liquidacion || {});
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    return res.send(page('Autorizar pago de prueba en Tesorería', `${summaryHtml(solicitudDemo)}<p>La liquidación ya fue aprobada por la Vicerrectoría Financiera. Al confirmar se autorizará el pago y finalizará la prueba.</p><form method="post" action="/api/desplazamientos-viaticos/prueba/tesoreria/${req.params.token}"><label>Observación de Tesorería / Pagaduría</label><textarea name="observacion" maxlength="1200" rows="4"></textarea><button class="primary" type="submit">Autorizar pago</button></form>`));
  } catch (_) {
    return res.status(404).send(page('Vista de prueba no disponible', '<p>El enlace no es válido o ya expiró.</p>'));
  }
};

const procesarDemoTesoreria = async (req, res) => {
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'demo_tesoreria_tramitar') throw new Error('Propósito inválido');
    const tokenHash = hashToken(req.params.token);
    if (await isDemoTokenProcessed(tokenHash, usedDemoTreasuryTokens)) return res.status(409).send(page('Pago ya autorizado', '<p>Esta autorización de pago de prueba ya fue registrada.</p>'));
    const technicianEmail = normalizeEmail(payload.technicianEmail || 'adsolarte@unicesmag.edu.co');
    const liquidacion = payload.liquidacion || {};
    const solicitudDemo = buildDemoSolicitud(liquidacion);
    solicitudDemo.trazabilidad = [
      { event: 'completado_tecnico_contable', actor: { nombre: 'Técnico contable de prueba', email: technicianEmail }, at: new Date(Date.now() - 120000).toISOString() },
      { event: 'aprobado_financiera_final', actor: { nombre: 'Vicerrectoría Financiera de prueba', email: technicianEmail }, at: new Date(Date.now() - 60000).toISOString() },
      { event: 'completado_tesoreria', actor: { nombre: 'Tesorería / Pagaduría de prueba', email: DEMO_TREASURY_EMAIL }, detail: { observacion: clean(req.body.observacion, 1200), pagoAutorizado: true }, at: new Date().toISOString() }
    ];
    const pdfAttachment = await buildLiquidationPdfAttachment(solicitudDemo);
    const result = await sendInstitutionalEmail({
      to: technicianEmail,
      subject: `${solicitudDemo.consecutivo} | PRUEBA - Pago autorizado y solicitud finalizada`,
      text: 'Prueba controlada finalizada. Se adjunta la liquidación con las tres actuaciones registradas.',
      html: renderInstitutionalTemplate({
        title: 'PRUEBA - Pago autorizado y solicitud finalizada',
        introHtml: '<p><strong>ESTE ES UN CORREO DE PRUEBA.</strong></p><p>Tesorería/Pagaduría autorizó el pago. La liquidación contiene las actuaciones del técnico contable, Vicerrectoría Financiera y Tesorería.</p>',
        bodyHtml: summaryHtml(solicitudDemo)
      }),
      attachments: [pdfAttachment]
    });
    if (!result.success) throw new Error(result.error || 'No fue posible enviar el cierre de prueba.');
    await markDemoTokenProcessed(tokenHash, usedDemoTreasuryTokens, payload.exp);
    return res.send(page('Pago autorizado y prueba finalizada', `<p>La liquidación final fue enviada exclusivamente a <strong>${escapeHtml(technicianEmail)}</strong>. Este enlace quedó cerrado.</p>`));
  } catch (error) {
    return res.status(400).send(page('No fue posible tramitar la prueba', `<p>${escapeHtml(error.message || 'El enlace no es válido o ya expiró.')}</p>`));
  }
};

const mostrarDemoFinanciera = async (req, res) => {
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'demo_financiera_aprobar') throw new Error('Propósito inválido');
    const tokenHash = hashToken(req.params.token);
    if (await isDemoTokenProcessed(tokenHash, usedDemoFinancialTokens)) return res.status(409).send(page('Prueba ya aprobada', '<p>La aprobación financiera de prueba ya fue registrada.</p>'));
    const solicitudDemo = buildDemoSolicitud(payload.liquidacion || {});
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
    return res.send(approvalForm(solicitudDemo, { key: 'financiera_final', label: 'Vicerrectoría Financiera y de Desarrollo Institucional' }, req.params.token).replace(`/api/desplazamientos-viaticos/accion/${req.params.token}`, `/api/desplazamientos-viaticos/prueba/financiera/${req.params.token}`));
  } catch (_) {
    return res.status(404).send(page('Vista de prueba no disponible', '<p>El enlace no es válido o ya expiró.</p>'));
  }
};

const procesarDemoFinanciera = async (req, res) => {
  try {
    const payload = decryptPayload(req.params.token);
    if (payload?.purpose !== 'demo_financiera_aprobar') throw new Error('Propósito inválido');
    if (clean(req.body.accion, 30) !== 'aprobar') return res.status(400).send(page('Acción inválida', '<p>Esta prueba solo permite confirmar la aprobación final.</p>'));
    const tokenHash = hashToken(req.params.token);
    if (await isDemoTokenProcessed(tokenHash, usedDemoFinancialTokens)) return res.status(409).send(page('Prueba ya aprobada', '<p>La aprobación financiera de prueba ya fue registrada.</p>'));
    const technicianEmail = normalizeEmail(payload.technicianEmail || 'adsolarte@unicesmag.edu.co');
    const liquidacion = payload.liquidacion || {};
    const solicitudDemo = buildDemoSolicitud(liquidacion);
    solicitudDemo.trazabilidad = [
      { event: 'completado_tecnico_contable', actor: { nombre: 'Técnico contable de prueba', email: technicianEmail }, at: new Date(Date.now() - 60000).toISOString() },
      { event: 'aprobado_financiera_final', actor: { nombre: 'Vicerrectoría Financiera de prueba', email: technicianEmail }, at: new Date().toISOString() }
    ];
    const treasuryToken = encryptPayload({ purpose: 'demo_tesoreria_tramitar', technicianEmail, liquidacion }, 24 * 60 * 60);
    const treasuryUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/prueba/tesoreria/${treasuryToken}`;
    const pdfAttachment = await buildLiquidationPdfAttachment(solicitudDemo);
    const result = await sendInstitutionalEmail({
      to: DEMO_TREASURY_EMAIL,
      subject: `${solicitudDemo.consecutivo} | PRUEBA - Autorización de pago`,
      text: `Prueba controlada. La liquidación fue aprobada financieramente y requiere autorización de pago en ${treasuryUrl}`,
      html: renderInstitutionalTemplate({
        title: 'PRUEBA - Autorización de pago',
        introHtml: '<p><strong>ESTE ES UN CORREO DE PRUEBA.</strong></p><p>La Vicerrectoría Financiera aprobó la liquidación. Tesorería/Pagaduría debe autorizar el pago para finalizar.</p>',
        bodyHtml: `${summaryHtml(solicitudDemo)}<p style="text-align:center;margin:22px 0"><a href="${treasuryUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Autorizar pago</a></p>`
      }),
      attachments: [pdfAttachment]
    });
    if (!result.success) throw new Error(result.error || 'No fue posible enviar la autorización de pago de prueba.');
    await markDemoTokenProcessed(tokenHash, usedDemoFinancialTokens, payload.exp);
    return res.send(page('Aprobación financiera registrada', `<p>La liquidación fue enviada exclusivamente a <strong>${escapeHtml(DEMO_TREASURY_EMAIL)}</strong> para autorizar el pago.</p>`));
  } catch (error) {
    return res.status(400).send(page('No fue posible finalizar la prueba', `<p>${escapeHtml(error.message || 'El enlace no es válido o ya expiró.')}</p>`));
  }
};

const procesarAccion = async (req, res) => {
  try {
    const actionContext = await findActiveActionByToken(req.params.token);
    if (!actionContext) {
      const processed = await findProcessedAction(req.params.token);
      if (processed) return res.status(409).send(page('Solicitud procesada', '<p>Esta actuación ya fue registrada. El enlace no permite procesarla nuevamente.</p>'));
      return res.status(404).send(page('Enlace no disponible', '<p>El enlace no es válido.</p>'));
    }
    const { solicitud, payload, step } = actionContext;
    if (!step || step.key !== solicitud.token_etapa) return res.status(409).send(page('Etapa no disponible', '<p>Esta etapa ya no está activa.</p>'));
    const isAlternateAccess = payload.accessSource === step.alternateAccessSource && step.key === 'jefe';
    const actor = isAlternateAccess
      ? buildActor(step.key, `${step.alternateApprovalLabel || 'Programa académico'} – acceso alterno`, step.alternateApprovalEmail)
      : buildActor(step.key, step.label, step.email);
    const accion = clean(req.body.accion, 30);
    const actionObservation = clean(req.body.observacion, 1200);
    if (isAlternateAccess && !actionObservation) {
      return res.status(400).send(page('Observación obligatoria', `<p>Debe explicar la ausencia de ${escapeHtml(step.alternateAbsenceRole || step.label)} y el motivo de utilización del acceso alterno de ${escapeHtml(step.alternateApprovalLabel || 'la dependencia')}.</p>`));
    }
    if (step.action === 'approval') {
      if (accion === 'rechazar') {
        const observacion = actionObservation;
        if (!observacion) return res.status(400).send(page('Falta la observación', '<p>Debe indicar el motivo por el cual no aprueba la solicitud.</p>'));
        await solicitud.update({ estado: 'no_aprobada', token_accion_hash: null, token_etapa: null, trazabilidad: appendTrace(solicitud, `no_aprobado_${step.key}`, actor, { observacion }) });
        await syncNormalReportRejection(solicitud, step, actor, observacion);
        await sendRequesterNotice(solicitud, 'Solicitud no aprobada', `La solicitud no fue aprobada por ${step.label}. Motivo: ${observacion}`);
        return res.send(page('Decisión registrada', '<p>La solicitud fue marcada como no aprobada y se notificó al colaborador.</p>'));
      }
      if (accion !== 'aprobar') return res.status(400).send(page('Acción inválida', '<p>No fue posible identificar la decisión.</p>'));
      const approvalDetail = {
        observacion: actionObservation,
        ...(isAlternateAccess ? {
          accesoAlterno: true,
          origenAcceso: payload.accessSource,
          autoridadAlterna: step.alternateAuthorityLabel || step.alternateApprovalLabel
        } : {})
      };
      const normalReport = await syncNormalReportApproval(solicitud, step, actor, approvalDetail);
      if (step.key === 'gestion_humana' && normalReport) {
        await sendNormalReportFinalCopies(solicitud, normalReport);
      }
      const next = await advance(solicitud, actor, approvalDetail);
      if (step.key === 'financiera_final' && !next) {
        await solicitud.update({ estado: 'finalizada', finalizado_at: new Date() });
        await sendFinalizedCopies(solicitud);
        return res.send(page('Solicitud aprobada y finalizada', '<p>La solicitud pertenecía al flujo anterior y fue finalizada correctamente. Se enviaron los documentos finales a los destinatarios correspondientes.</p>'));
      }
      return res.send(page('Visto bueno registrado', `<p>Su actuación fue registrada correctamente.${next ? ` La solicitud pasó a ${escapeHtml(next.label)}.` : ''}</p>`));
    }
    if (step.action === 'liquidacion') {
      if (accion !== 'liquidar') return res.status(400).send(page('Acción inválida', '<p>Debe enviar la liquidación.</p>'));
      const liquidacion = parseLiquidationBody(req.body);
      if (liquidacion.error) return res.status(400).send(page('Falta el detalle', `<p>${escapeHtml(liquidacion.error)}</p>`));
      const { detalles, totalAnticipo, observaciones } = liquidacion;
      await solicitud.update({
        liquidacion: { detalles, totalAnticipo, observaciones }
      });
      const next = await advance(solicitud, actor);
      return res.send(page('Solicitud procesada', `<p>La liquidación por $${totalAnticipo.toLocaleString('es-CO')} fue registrada y enviada a ${escapeHtml(next?.label || 'la siguiente etapa')}.</p><p>El enlace del técnico contable quedó cerrado y no puede utilizarse nuevamente.</p>`));
    }
    if (step.action === 'pago') {
      if (accion !== 'autorizar_pago') return res.status(400).send(page('Acción inválida', '<p>Debe confirmar la autorización del pago.</p>'));
      const trace = appendTrace(solicitud, 'completado_tesoreria', actor, {
        observacion: actionObservation,
        pagoAutorizado: true
      });
      await solicitud.update({
        estado: 'finalizada',
        paso_actual: solicitud.paso_actual + 1,
        token_accion_hash: null,
        token_etapa: null,
        trazabilidad: trace,
        finalizado_at: new Date()
      });
      await sendFinalizedCopies(solicitud);
      return res.send(page('Pago autorizado y solicitud finalizada', '<p>La autorización de pago fue registrada correctamente. El colaborador recibió ambos formatos; el técnico contable y la Vicerrectoría Financiera recibieron la liquidación final firmada.</p>'));
    }
    if (step.action === 'tramite') {
      if (accion !== 'tramitar') return res.status(400).send(page('Acción inválida', '<p>Debe confirmar el trámite.</p>'));
      const next = await advance(solicitud, actor, { observacion: actionObservation, flujoAnterior: true });
      return res.send(page('Solicitud tramitada', `<p>La actuación de la solicitud iniciada con el flujo anterior fue registrada.${next ? ` Pasó a ${escapeHtml(next.label)}.` : ''}</p>`));
    }
    return res.status(400).send(page('Etapa inválida', '<p>No se pudo procesar la etapa actual.</p>'));
  } catch (error) {
    console.error('[desplazamientos-viaticos] Error procesando acción:', error);
    return res.status(500).send(page('Error', '<p>No fue posible procesar la actuación. Intente nuevamente.</p>'));
  }
};

const descargarFormato = async (req, res) => {
  const solicitud = await DesplazamientoViaticosSolicitud.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!solicitud) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
  const hasLiquidation = Array.isArray(solicitud.liquidacion?.detalles);
  const attachment = await buildXlsxAttachment(solicitud, { includeFinancial: hasLiquidation });
  res.setHeader('Content-Type', attachment.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  return res.send(attachment.content);
};

const descargarPdf = async (req, res) => {
  const solicitud = await DesplazamientoViaticosSolicitud.findOne({ where: { id: req.params.id, user_id: req.user.id } });
  if (!solicitud) return res.status(404).json({ success: false, message: 'Solicitud no encontrada.' });
  let attachment;
  if (Array.isArray(solicitud.liquidacion?.detalles)) {
    attachment = await buildLiquidationPdfAttachment(solicitud);
  } else {
    const normalReport = await getLinkedNormalReport(solicitud);
    attachment = normalReport
      ? await ensureReporteSalidaPdf(normalReport)
      : await buildPdfAttachment(solicitud, { includeFinancial: false });
  }
  res.setHeader('Content-Type', attachment.contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${attachment.filename}"`);
  return res.send(attachment.content || await fs.promises.readFile(attachment.path));
};

module.exports = {
  descargarFormato,
  descargarPdf,
  mostrarAccion,
  mostrarDemoFinanciera,
  mostrarDemoLiquidacion,
  mostrarDemoTesoreria,
  procesarAccion,
  procesarDemoFinanciera,
  procesarDemoLiquidacion,
  procesarDemoTesoreria,
  radicarSolicitud
};
