const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const { DesplazamientoViaticosSolicitud, ReporteSalidaSolicitud, SystemSetting, ViaticosLegalizacion } = require('../models');
const { getDependencyEmail } = require('../config/dependencyEmails');
const { sequelize } = require('../config/database');
const { decryptPayload, encryptPayload } = require('../utils/secureUrlToken');
const { getDesplazamientoViaticosRecipients, normalizeEmail } = require('../config/desplazamientoViaticosConfig');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const { AUTHORIZATION_TEXT, LEGALIZATION_NOTICE, buildXlsxAttachment, calculateDays, getVisibleLiquidationDetails } = require('../services/desplazamientoViaticos/formatService');
const { buildLiquidationPdfAttachment, buildPdfAttachment } = require('../services/desplazamientoViaticos/pdfService');
const { ensureReporteSalidaPdf } = require('../services/reporteSalidaPdfService');
const { addColombiaBusinessDays } = require('../utils/colombiaBusinessDays');

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
  const detalles = [];

  BASE_DETAIL_NAMES.forEach((detalle, index) => {
    if (supportsRemovableBaseRows && body[`baseIncluded${index}`] !== '1') return;
    const valorDiario = money(body[`valorDiario${index}`]);
    const dias = Math.max(0, Math.trunc(money(body[`dias${index}`])));
    if (valorDiario > 0 || dias > 0) {
      if (valorDiario <= 0 || dias < 1) return;
      detalles.push({ detalle, valorDiario, dias, valorTotal: valorDiario * dias });
    }
  });

  const extraCount = Math.min(30, Math.max(0, Math.trunc(money(body.extraCount))));
  for (let index = 0; index < extraCount; index += 1) {
    const detalle = clean(body[`extraDetalle${index}`], 120);
    const valorDiario = money(body[`extraValorDiario${index}`]);
    const dias = Math.max(0, Math.trunc(money(body[`extraDias${index}`])));
    if (!detalle && (valorDiario > 0 || dias > 0)) return { error: 'Debe escribir el nombre de cada concepto adicional.' };
    if (detalle) {
      if (valorDiario <= 0 || dias < 1) return { error: `Debe asignar valor diario y mínimo 1 día para el concepto extra "${detalle}".` };
      detalles.push({ detalle, valorDiario, dias, valorTotal: valorDiario * dias });
    }
  }

  if (!detalles.length) return { error: 'Debe ingresar al menos un concepto con valor diario mayor a cero y días autorizados para la liquidación.' };

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

const formatDateOnly = (date) => date.toISOString().slice(0, 10);

const ensureLegalizacion = async (solicitud) => {
  const fechaRegreso = String(solicitud.datos_salida?.fechaRegreso || '').slice(0, 10) || formatDateOnly(new Date());
  const detalles = (solicitud.liquidacion?.detalles || []).filter((item) => Number(item.valorTotal) > 0).map((item, index) => ({
    id: `concepto-${index + 1}`,
    detalle: clean(item.detalle, 120),
    valorAnticipo: Number(item.valorTotal) || 0,
    valorLegalizado: null,
    diferencia: null
  }));
  const today = formatDateOnly(new Date());
  const [legalizacion] = await ViaticosLegalizacion.findOrCreate({
    where: { solicitud_id: solicitud.id },
    defaults: {
      solicitud_id: solicitud.id,
      user_id: solicitud.user_id,
      estado: today < fechaRegreso ? 'pendiente_habilitacion' : 'pendiente_legalizacion',
      fecha_habilitacion: fechaRegreso,
      fecha_limite: addColombiaBusinessDays(fechaRegreso, 3),
      detalles,
      trazabilidad: [{ event: 'pago_autorizado', at: new Date().toISOString() }]
    }
  });
  return legalizacion;
};

const NORMAL_REPORT_EVENT_BY_STAGE = {
  jefe: 'aprobada_jefe',
  financiera_previa: 'aprobada_vicerrectoria_financiera',
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
    plan_aprobacion_normal: (steps || []).filter((step) => ['jefe', 'financiera_previa', 'vicerrectoria_dependencia', 'sst', 'rectoria', 'gestion_humana'].includes(step.key)),
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
    values.estado = 'aprobada_gestion_humana';
    values.gestion_humana_aprobado_at = at;
  }
  await report.update(values);
  return report;
};

const syncNormalReportRejection = async (solicitud, step, actor, observacion) => {
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

const syncAdminViaticosApproval = async (normalReport, actor = {}, observation = '') => {
  if (!normalReport) return null;
  const viaticosSolicitud = await DesplazamientoViaticosSolicitud.findOne({
    where: {
      [Op.or]: [
        { consecutivo: normalReport.consecutivo },
        sequelize.where(
          sequelize.cast(sequelize.json('datos_viaticos.reporteSalidaSolicitudId'), 'text'),
          String(normalReport.id)
        )
      ]
    }
  });
  if (!viaticosSolicitud) return null;
  if (['no_aprobada', 'finalizada', 'pago_autorizado_pendiente_legalizacion', 'legalizacion_finalizada'].includes(viaticosSolicitud.estado)) {
    return viaticosSolicitud;
  }
  const plan = viaticosSolicitud.plan_aprobacion || [];
  const currentStep = plan[viaticosSolicitud.paso_actual];
  if (!currentStep) return viaticosSolicitud;

  const adminActor = {
    nombre: actor.nombre || 'Administrador SIAC',
    email: actor.email || 'adsolarte@unicesmag.edu.co',
    cargo: 'Administrador SIAC',
    dependencia: 'Dirección de Planeación y Aseguramiento de la Calidad'
  };
  const approvalDetail = {
    observacion: observation || 'Aprobada por Administrador SIAC desde el panel de gestión',
    via: 'admin_dashboard'
  };

  const next = await advance(viaticosSolicitud, adminActor, approvalDetail);
  if (currentStep.key === 'financiera_final' && !next) {
    await viaticosSolicitud.update({ estado: 'finalizada', finalizado_at: new Date() });
    await sendFinalizedCopies(viaticosSolicitud);
  }
  return viaticosSolicitud;
};

const syncAdminViaticosRejection = async (normalReport, actor = {}, observation = '') => {
  if (!normalReport) return null;
  const viaticosSolicitud = await DesplazamientoViaticosSolicitud.findOne({
    where: {
      [Op.or]: [
        { consecutivo: normalReport.consecutivo },
        sequelize.where(
          sequelize.cast(sequelize.json('datos_viaticos.reporteSalidaSolicitudId'), 'text'),
          String(normalReport.id)
        )
      ]
    }
  });
  if (!viaticosSolicitud) return null;
  if (viaticosSolicitud.estado === 'no_aprobada') return viaticosSolicitud;

  const plan = viaticosSolicitud.plan_aprobacion || [];
  const currentStep = plan[viaticosSolicitud.paso_actual] || { key: 'admin', label: 'Administrador' };
  const adminActor = {
    nombre: actor.nombre || 'Administrador SIAC',
    email: actor.email || 'adsolarte@unicesmag.edu.co',
    cargo: 'Administrador SIAC',
    dependencia: 'Dirección de Planeación y Aseguramiento de la Calidad'
  };
  await viaticosSolicitud.update({
    estado: 'no_aprobada',
    token_accion_hash: null,
    token_etapa: null,
    trazabilidad: appendTrace(viaticosSolicitud, `no_aprobado_${currentStep.key}`, adminActor, { observacion: observation })
  });
  await sendRequesterNotice(viaticosSolicitud, 'Solicitud no aprobada', `La solicitud fue rechazada por el administrador. Motivo: ${observation}`);
  return viaticosSolicitud;
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

const buildApprovalPlan = ({ jefe = {}, laboral = {}, personal = {} }) => {
  const recipients = getDesplazamientoViaticosRecipients();
  const dependenciaEmail = normalizeEmail(getDependencyEmail(laboral.dependencia));
  const viceDependenciaEmail = normalizeEmail(getDependencyEmail(laboral.vicerrectoria));
  const rectoriaAssignment = isRectoriaAssignment(laboral);
  const academicAssignment = isAcademicVicerrectoriaAssignment(laboral);
  const researchAssignment = isResearchVicerrectoriaAssignment(laboral);
  const evangelizationAssignment = isEvangelizationVicerrectoriaAssignment(laboral);
  const rectorIsBoss = isRectorImmediateBoss(jefe, recipients.rectoria);
  const isJuanCarlosNandarRequest = normalizeEmail(personal.email) === normalizeEmail(recipients.financiera)
    && normalize(personal.nombre).includes('juan carlos nandar lopez');
  const rectorOwnRequest = rectorIsBoss
    && normalize(personal.nombre).includes('luis eduardo rubiano guaqueta');
  const rectorApprovalEmail = rectorOwnRequest
    ? (normalizeEmail(jefe.email) || recipients.rectoria)
    : recipients.rectoria;
  const steps = [];
  const financialReview = {
    key: 'financiera_previa',
    label: 'Vicerrectoría Financiera y de Desarrollo Institucional',
    email: recipients.financiera,
    action: 'approval',
    alternateApprovalEmail: recipients.financieraInstitucional,
    alternateApprovalLabel: 'Vicerrectoría Financiera y de Desarrollo Institucional',
    alternateAccessSource: 'vicerrectoria_financiera_institucional',
    alternateAuthorityLabel: 'Vicerrectoría Financiera y de Desarrollo Institucional',
    alternateObservationRequired: false,
    parallelEquivalentAccess: true
  };

  if (rectorIsBoss) {
    steps.push({
      key: 'rectoria',
      label: 'Rector – jefe inmediato y autoridad de Rectoría',
      email: rectorApprovalEmail,
      action: 'approval',
      fulfillsImmediateBoss: true
    });
    steps.push(financialReview);
    steps.push({ key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' });
  } else if (rectoriaAssignment) {
    if (!rectorIsBoss) {
      steps.push({ key: 'jefe', label: 'Jefe inmediato', email: normalizeEmail(jefe.email), action: 'approval' });
      steps.push(financialReview);
      steps.push({ key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' });
      steps.push({ key: 'rectoria', label: 'Rectoría', email: recipients.rectoria, action: 'approval' });
    }
  } else if (academicAssignment) {
    const requesterName = normalize(personal.nombre);
    const bossName = normalize(jefe.nombre);
    const dependencyName = normalize(laboral.dependencia);
    const academicViceIsBoss = isVicerrectorImmediateBoss(jefe, recipients.academica)
      || bossName.includes('sandra lucia bolanos delgado');
    const isDesignProgram = dependencyName.includes('programa academico')
      && dependencyName.includes('diseno grafico');
    const isArchitectureProgram = dependencyName.includes('programa academico')
      && dependencyName.includes('arquitectura');
    const designProgramOnly = isDesignProgram
      && bossName.includes('karen eugenia ocana figueroa')
      && !requesterName.includes('karen eugenia ocana figueroa');
    const architectureProgramOnly = isArchitectureProgram
      && bossName.includes('lilian magali martinez crespo')
      && !requesterName.includes('lilian magali martinez crespo');
    const routesOnlyToProgram = designProgramOnly || architectureProgramOnly;
    const restrictedProgramOwnerRequest = (isDesignProgram && requesterName.includes('karen eugenia ocana figueroa'))
      || (isArchitectureProgram && requesterName.includes('lilian magali martinez crespo'));
    const directorEmail = routesOnlyToProgram
      ? dependenciaEmail
      : academicViceIsBoss
        ? recipients.academica
        : normalizeEmail(jefe.email);
    const programEmail = !routesOnlyToProgram
      && !restrictedProgramOwnerRequest
      && !academicViceIsBoss
      && dependenciaEmail
      && dependenciaEmail !== directorEmail
      ? dependenciaEmail
      : '';
    steps.push({
      key: 'jefe',
      label: routesOnlyToProgram
        ? `${laboral.dependencia} – aprobación institucional`
        : academicViceIsBoss
          ? 'Vicerrectora Académica – jefe inmediato y autoridad académica'
          : 'Director de Programa – jefe inmediato',
      email: directorEmail,
      action: 'approval',
      alternateApprovalEmail: programEmail,
      alternateApprovalLabel: laboral.dependencia || 'Programa académico',
      alternateAccessSource: 'programa_academico',
      alternateAuthorityLabel: 'Vicerrectoría Académica',
      alternateAbsenceRole: 'Director de Programa'
    });
    steps.push(financialReview);
    if (!academicViceIsBoss) {
      steps.push({ key: 'vicerrectoria_dependencia', label: 'Vicerrectoría Académica', email: recipients.academica, action: 'approval' });
    }
    steps.push(
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' },
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
      financialReview,
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
    steps.push(financialReview);
    if (!viceIsBoss) {
      steps.push({
        key: 'vicerrectoria_dependencia',
        label: 'Vicerrectoría para la Evangelización de las Culturas',
        email: recipients.evangelizacion,
        action: 'approval'
      });
    }
    steps.push(
      { key: 'sst', label: 'Seguridad y Salud en el Trabajo', email: recipients.sst, action: 'approval' },
      { key: 'rectoria', label: 'Rectoría', email: recipients.rectoria, action: 'approval' }
    );
  } else {
    steps.push({ key: 'jefe', label: 'Jefe inmediato', email: normalizeEmail(jefe.email), action: 'approval' });
    steps.push(financialReview);
    const financialViceEmails = new Set([
      normalizeEmail(recipients.financiera),
      normalizeEmail(recipients.financieraInstitucional)
    ].filter(Boolean));
    if (viceDependenciaEmail && !financialViceEmails.has(viceDependenciaEmail)) {
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
    { key: 'tesoreria', label: 'Tesorería / Pagaduría', email: recipients.tesoreria, action: 'pago', infoEmails: [recipients.financiera] }
  );
  return {
    steps: steps.filter((step) => step.email && !(isJuanCarlosNandarRequest && step.key === 'financiera_previa')),
    dependenciaEmail,
    rectoriaAssignment,
    academicAssignment,
    researchAssignment,
    evangelizationAssignment,
    rectorIsBoss
  };
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
  const plan = [...(solicitud.plan_aprobacion || [])];
  const stepIndex = plan.findIndex((s) => s.key === step.key);
  const targetIndex = stepIndex >= 0 ? stepIndex : Number(solicitud.paso_actual || 0);
  const primary = createStageToken(solicitud, step, 'primary');
  const alternateAccessSource = step.alternateAccessSource || 'alternate';
  const alternate = step.alternateApprovalEmail
    ? createStageToken(solicitud, step, alternateAccessSource)
    : null;
  plan[targetIndex] = {
    ...plan[targetIndex],
    actionTokenHashes: [
      { source: 'primary', hash: hashToken(primary) },
      ...(alternate ? [{ source: alternateAccessSource, hash: hashToken(alternate) }] : [])
    ]
  };
  solicitud.paso_actual = targetIndex;
  solicitud.plan_aprobacion = plan;
  solicitud.token_etapa = step.key;
  solicitud.token_accion_hash = hashToken(primary);
  await solicitud.update({
    paso_actual: targetIndex,
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

const formatTime12h = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return raw;
  const period = hour < 12 ? 'a. m.' : 'p. m.';
  const hour12 = hour % 12 || 12;
  return `${String(hour12).padStart(2, '0')}:${match[2]} ${period}`;
};

const formatTripMoment = (date, time) => {
  const rawDate = clean(date, 20);
  const dateLabel = /^(\d{4})-(\d{2})-(\d{2})$/.test(rawDate)
    ? rawDate.replace(/^(\d{4})-(\d{2})-(\d{2})$/, '$3/$2/$1')
    : rawDate;
  const timeLabel = formatTime12h(time);
  return [dateLabel, timeLabel].filter(Boolean).join(' · ') || 'Sin información';
};

const summaryHtml = (solicitud) => {
  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const days = calculateDays(salida, viaticos.numeroDiasSolicitados);

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden; background-color: #ffffff; margin: 16px 0 18px 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <!-- Encabezado de la tarjeta -->
      <tr>
        <td style="padding: 12px 18px; background-color: #0b3a6f; color: #ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td valign="middle" align="left">
                <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #93c5fd; margin-bottom: 2px;">SOLICITUD DE DESPLAZAMIENTO</div>
                <div style="font-size: 15.5px; font-weight: 800; color: #ffffff; letter-spacing: 0.2px;">${escapeHtml(solicitud.consecutivo)}</div>
              </td>
              <td valign="middle" align="right" style="white-space: nowrap;">
                <span style="display: inline-block; padding: 4px 12px; background-color: rgba(255, 255, 255, 0.18); border-radius: 14px; font-size: 12px; font-weight: 700; color: #ffffff;">
                  ${escapeHtml(days)} ${Number(days) === 1 ? 'día' : 'días'} de comisión
                </span>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Datos Clave Resumidos -->
      <tr>
        <td style="padding: 14px 18px; background-color: #f8fafc;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top" style="padding-bottom: 10px; padding-right: 10px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">COLABORADOR</div>
                <div style="font-size: 13px; font-weight: 700; color: #0f172a;">${escapeHtml(personal.nombre || 'No registrado')}</div>
                <div style="font-size: 11.5px; color: #475569;">C.C. ${escapeHtml(personal.documento || 'No registrado')}</div>
              </td>
              <td width="50%" valign="top" style="padding-bottom: 10px;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">DEPENDENCIA Y CARGO</div>
                <div style="font-size: 12.5px; font-weight: 600; color: #0f172a;">${escapeHtml(laboral.dependencia || 'No registrada')}</div>
                <div style="font-size: 11.5px; color: #475569;">${escapeHtml(laboral.cargo || 'No registrado')}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" valign="top" style="padding-top: 6px; padding-right: 10px; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">DESTINO</div>
                <div style="font-size: 13.5px; font-weight: 700; color: #0b3a6f;">${escapeHtml(viaticos.lugarVisitar || salida.municipio || salida.pais || 'No registrado')}</div>
              </td>
              <td width="50%" valign="top" style="padding-top: 6px; border-top: 1px solid #e2e8f0;">
                <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">FECHAS DEL VIAJE</div>
                <div style="font-size: 12px; font-weight: 700; color: #0f172a;">${escapeHtml(formatTripMoment(salida.fecha, salida.horaInicio))}</div>
                <div style="font-size: 11.5px; color: #475569;">hasta ${escapeHtml(formatTripMoment(salida.fechaRegreso, salida.horaFin))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- Objeto de la comisión -->
      <tr>
        <td style="padding: 12px 18px; border-top: 1px solid #e2e8f0; background-color: #ffffff;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">OBJETO DE LA COMISIÓN</div>
          <div style="font-size: 12.5px; color: #334155; line-height: 1.45;">${escapeHtml(viaticos.objetoComision || salida.motivo || 'No registrado')}</div>
        </td>
      </tr>

      ${viaticos.centroCosto ? `
      <tr>
        <td style="padding: 8px 18px 12px 18px; background-color: #ffffff;">
          <div style="font-size: 10px; font-weight: 700; text-transform: uppercase; color: #64748b; margin-bottom: 2px;">CENTRO DE COSTOS ASIGNADO</div>
          <div style="font-size: 12px; font-weight: 700; color: #0b3a6f;">${escapeHtml(viaticos.centroCosto)}</div>
        </td>
      </tr>
      ` : ''}
    </table>

    <!-- Aviso Normativo Acuerdo 001 de 2013 -->
    <div style="margin: 0 0 16px 0; padding: 8px 12px; border-left: 3px solid #d97706; background-color: #fffbeb; border-radius: 4px; font-size: 11.5px; color: #92400e; line-height: 1.4;">
      <strong style="color: #b45309;">Aviso Normativo:</strong> ${escapeHtml(LEGALIZATION_NOTICE.replace(/^IMPORTANTE:\s*/i, ''))}
    </div>`;
};

const formatCop = (value) => new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0
}).format(Number(value) || 0);

const financialAmountHtml = (solicitud) => {
  const total = Number(solicitud.liquidacion?.totalAnticipo);
  const hasLiquidation = Number.isFinite(total) && total > 0;

  if (!hasLiquidation) return '';

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px 0; border: 1px solid #bfdbfe; border-radius: 8px; background-color: #f0f6ff; border-collapse: separate;">
      <tr>
        <td style="padding: 12px 16px;">
          <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.6px; text-transform: uppercase; color: #1e40af; margin-bottom: 3px;">VALOR TOTAL DEL ANTICIPO LIQUIDADO</div>
          <div style="font-size: 20px; font-weight: 800; color: #0b3a6f; line-height: 1.2;">
            ${escapeHtml(formatCop(total))}
          </div>
          <div style="font-size: 11.5px; color: #475569; margin-top: 4px;">
            Liquidación formal registrada por el Técnico Contable para trámite de pago.
          </div>
        </td>
      </tr>
    </table>`;
};

const emailStep = async (solicitud, step, tokenBundle) => {
  const primaryToken = typeof tokenBundle === 'string' ? tokenBundle : tokenBundle.primary;
  const alternateToken = typeof tokenBundle === 'string' ? null : tokenBundle.alternate;
  const actionUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/accion/${primaryToken}`;
  const isFinancialStage = ['tecnico_contable', 'tesoreria', 'financiera_final'].includes(step.key);
  const normalReport = await getLinkedNormalReport(solicitud);
  const [viaticosPdfAttachment, normalReportPdfAttachment] = await Promise.all([
    isFinancialStage
      ? buildLiquidationPdfAttachment(solicitud)
      : buildPdfAttachment(solicitud, { includeFinancial: false }),
    normalReport
      ? ensureReporteSalidaPdf(normalReport)
      : Promise.resolve(null)
  ]);
  const supportAttachment = buildSupportAttachment(solicitud);
  const title = step.key === 'sst'
    ? 'Validación de salida y ampliación de cobertura ARL'
    : step.action === 'liquidacion'
    ? 'Liquidación de viáticos y gastos de viaje pendiente'
    : step.action === 'pago'
      ? 'Autorización y trámite de pago de viáticos pendiente'
      : step.action === 'tramite'
        ? 'Trámite de Tesorería pendiente'
      : step.key === 'financiera_previa'
        ? 'Revisión y aprobación financiera pendiente'
      : `Visto bueno pendiente: ${step.label}`;
  const buttonLabel = step.action === 'liquidacion'
    ? 'Generar liquidación de viáticos y gastos de viaje'
    : step.action === 'pago'
      ? 'Autorizar pago de viáticos'
      : step.action === 'tramite'
        ? 'Tramitar solicitud de viáticos'
      : 'Revisar solicitud y dar visto bueno';
  const stageInstruction = step.key === 'sst'
    ? '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 16px 0; background-color: #eff6ff; border-left: 4px solid #2563eb; border-radius: 4px;"><tr><td style="padding: 10px 14px; color: #1e3a8a; font-size: 13px; line-height: 1.45;">Por favor verifique las condiciones del desplazamiento y gestione la validación o ampliación de cobertura ante la ARL antes de otorgar el visto bueno.</td></tr></table>'
    : '';
  const financialAmount = isFinancialStage ? financialAmountHtml(solicitud) : '';
  const actionButtonHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 24px auto;">
      <tr>
        <td align="center" style="background-color: #15803d; border-radius: 8px; box-shadow: 0 4px 14px rgba(21, 128, 61, 0.35);">
          <a href="${actionUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14.5px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">
            ${escapeHtml(buttonLabel)} →
          </a>
        </td>
      </tr>
    </table>`;
  const html = renderInstitutionalTemplate({
    title,
    introHtml: `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">La solicitud de desplazamiento <strong>${escapeHtml(solicitud.consecutivo)}</strong> requiere su actuación formal en calidad de <strong>${escapeHtml(step.label)}</strong>.</p>`,
    bodyHtml: `${stageInstruction}${summaryHtml(solicitud)}${financialAmount}${actionButtonHtml}`
  });
  const result = await sendInstitutionalEmail({
    to: step.email,
    subject: `${solicitud.consecutivo} | ${title}`,
    text: `${title}. Ingrese a ${actionUrl}`,
    html,
    attachments: [viaticosPdfAttachment, normalReportPdfAttachment, supportAttachment].filter(Boolean)
  });
  let alternateResult = null;
  if (alternateToken && step.alternateApprovalEmail) {
    const alternateActionUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/accion/${alternateToken}`;
    const absenceRole = step.alternateAbsenceRole || step.label;
    const authorityLabel = step.alternateAuthorityLabel || step.alternateApprovalLabel || 'la autoridad correspondiente';
    const isParallelEquivalent = Boolean(step.parallelEquivalentAccess);
    const alternateButtonHtml = `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 24px auto;">
        <tr>
          <td align="center" style="background-color: #15803d; border-radius: 8px; box-shadow: 0 4px 14px rgba(21, 128, 61, 0.35);">
            <a href="${alternateActionUrl}" target="_blank" style="display: inline-block; padding: 14px 28px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; font-size: 14.5px; font-weight: 800; color: #ffffff; text-decoration: none; border-radius: 8px; letter-spacing: 0.3px;">
              ${escapeHtml(buttonLabel)} →
            </a>
          </td>
        </tr>
      </table>`;
    alternateResult = await sendInstitutionalEmail({
      to: step.alternateApprovalEmail,
      subject: isParallelEquivalent ? `${solicitud.consecutivo} | ${title}` : `${solicitud.consecutivo} | Acceso alterno para visto bueno`,
      text: isParallelEquivalent
        ? `${title}. Ingrese a ${alternateActionUrl}. El enlace quedará cerrado cuando alguno de los dos destinatarios registre la decisión.`
        : `La solicitud ${solicitud.consecutivo} requiere el visto bueno de ${absenceRole}. Este acceso alterno solo debe utilizarse ante su ausencia y exige observación.`,
      html: renderInstitutionalTemplate({
        title: isParallelEquivalent ? title : 'Acceso alterno para visto bueno',
        introHtml: isParallelEquivalent
          ? `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">La solicitud de desplazamiento <strong>${escapeHtml(solicitud.consecutivo)}</strong> requiere la actuación de <strong>${escapeHtml(authorityLabel)}</strong>. Este acceso tiene la misma validez institucional que el remitido a la Vicerrectoría Financiera.</p>`
          : `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">Se remite al correo institucional de <strong>${escapeHtml(step.alternateApprovalLabel || 'la dependencia')}</strong> un acceso alterno para la solicitud <strong>${escapeHtml(solicitud.consecutivo)}</strong>.</p>`,
        bodyHtml: isParallelEquivalent
          ? `${summaryHtml(solicitud)}${financialAmount}${alternateButtonHtml}<p style="color:#64748b;font-size:12px;text-align:center;">La solicitud solo puede procesarse una vez. Cuando uno de los dos destinatarios registre la decisión, el otro enlace quedará cerrado automáticamente.</p>`
          : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 0 0 18px 0; border-left: 4px solid #d97706; background-color: #fffbeb; border-radius: 4px;"><tr><td style="padding: 12px 16px; color: #92400e; font-size: 13px; line-height: 1.45;"><strong>Uso restringido:</strong> Este acceso solo debe utilizarse cuando ${escapeHtml(absenceRole)} no se encuentre disponible. La actuación se registrará formalmente a nombre de ${escapeHtml(authorityLabel)}, exige una observación y quedará identificada en la trazabilidad institucional.</td></tr></table>${summaryHtml(solicitud)}${financialAmount}${alternateButtonHtml}`
      }),
      attachments: [pdfAttachment, attachment, supportAttachment].filter(Boolean)
    });
  }
  const infoEmails = [...new Set((step.infoEmails || []).filter(Boolean).map(normalizeEmail))];
  if (step.key === 'tesoreria' && infoEmails.length) {
    await sendInstitutionalEmail({
      to: infoEmails,
      subject: `${solicitud.consecutivo} | Copia informativa de liquidación remitida a Tesorería`,
      text: `La liquidación ${solicitud.consecutivo} fue remitida a Tesorería/Pagaduría para autorizar el pago. Esta copia para la Vicerrectoría Financiera es informativa.`,
      html: renderInstitutionalTemplate({
        title: 'Copia informativa de liquidación',
        introHtml: '<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">El Técnico Contable registró la liquidación de viáticos y la remitió a Tesorería / Pagaduría para autorizar el pago. Esta copia es de carácter informativo.</p>',
        bodyHtml: `${summaryHtml(solicitud)}${financialAmountHtml(solicitud)}`
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
      introHtml: `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">Se remite copia informativa de la solicitud de desplazamiento radicada. La primera actuación de visto bueno corresponde a <strong>${escapeHtml(firstStep?.label || 'la instancia responsable')}</strong>.</p>`,
      bodyHtml: summaryHtml(solicitud)
    }),
    attachments: [pdfAttachment, supportAttachment].filter(Boolean)
  });
};

const sendRequesterNotice = async (solicitud, title, message, { final = false, includeAttachments = false } = {}) => {
  const recipient = solicitud.solicitante_snapshot?.email || solicitud.solicitante_snapshot?.correo;
  if (!recipient) return { success: false, error: 'Solicitante sin correo' };
  const [attachment, pdfAttachment] = includeAttachments ? await Promise.all([
    buildXlsxAttachment(solicitud, { includeFinancial: final }),
    final ? buildLiquidationPdfAttachment(solicitud) : buildPdfAttachment(solicitud, { includeFinancial: false })
  ]) : [null, null];
  const supportAttachment = includeAttachments ? buildSupportAttachment(solicitud) : null;
  return sendInstitutionalEmail({
    to: recipient,
    subject: `${solicitud.consecutivo} | ${title}`,
    text: message,
    html: renderInstitutionalTemplate({
      title,
      introHtml: `<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">${escapeHtml(message)}</p>`,
      bodyHtml: summaryHtml(solicitud)
    }),
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
      introHtml: '<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">Gestión Humana aprobó el reporte de salida. Se remite copia informativa del documento finalizado con todas las firmas electrónicas.</p>',
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
  const finalRecipients = [...new Set([
    recipients.tecnicoContable,
    recipients.financiera,
    recipients.tesoreria,
    recipients.gestionHumana,
    recipients.sst
  ].filter(Boolean).map(normalizeEmail))];
  const results = [];
  if (collaboratorEmail) {
    results.push(await sendInstitutionalEmail({
      to: collaboratorEmail,
      subject: `${solicitud.consecutivo} | Pago autorizado - pendiente de legalización`,
      text: `Tesorería/Pagaduría autorizó el pago de la solicitud ${solicitud.consecutivo}. Se adjuntan los dos formatos firmados. La legalización se habilitará en la fecha de regreso y tendrá un plazo de tres días hábiles.`,
      html: renderInstitutionalTemplate({
        title: 'Pago autorizado · Pendiente de legalización',
        introHtml: '<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">Tesorería / Pagaduría ha autorizado el pago de su anticipo de viáticos. Se remite copia del reporte de salida y de la liquidación oficial debidamente firmados. El módulo de legalización se habilitará automáticamente en la fecha de regreso y dispondrá de tres (3) días hábiles conforme al Acuerdo 001 de 2013.</p>',
        bodyHtml: summaryHtml(solicitud)
      }),
      attachments: [normalReportPdfAttachment, liquidationPdfAttachment, supportAttachment].filter(Boolean)
    }));
  }
  results.push(...await Promise.all(finalRecipients.map((email) => sendInstitutionalEmail({
    to: email,
    subject: `${solicitud.consecutivo} | Liquidación final y pago autorizado`,
    text: `Tesorería/Pagaduría autorizó el pago de la liquidación de viáticos ${solicitud.consecutivo}. Se adjuntan el formato de salida y la liquidación de viáticos firmados.`,
    html: renderInstitutionalTemplate({
      title: 'Liquidación final y pago autorizado',
      introHtml: '<p style="margin: 0 0 10px 0;">Saludo de paz y bien,</p><p style="margin: 0 0 14px 0;">Tesorería / Pagaduría ha autorizado el pago del anticipo. Se adjuntan el reporte de salida y la liquidación final de viáticos con todas las firmas y actuaciones registradas.</p>',
      bodyHtml: summaryHtml(solicitud)
    }),
    attachments: [normalReportPdfAttachment, liquidationPdfAttachment, supportAttachment].filter(Boolean)
  }))));
  return { success: results.length > 0 && results.every((result) => result.success), results };
};

const advance = async (solicitud, actor, detail = {}) => {
  const plan = [...(solicitud.plan_aprobacion || [])];
  const current = plan[solicitud.paso_actual];
  const nextIndex = Number(solicitud.paso_actual || 0) + 1;
  const traceEvent = current.action === 'approval' ? `aprobado_${current.key}` : `completado_${current.key}`;
  solicitud.paso_actual = nextIndex;
  solicitud.trazabilidad = appendTrace(solicitud, traceEvent, actor, detail);
  solicitud.token_accion_hash = null;
  solicitud.token_etapa = null;
  await solicitud.update({
    paso_actual: nextIndex,
    trazabilidad: solicitud.trazabilidad,
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
  ['lugarVisitar', 'fechaEvento', 'objetoComision', 'alojamiento', 'transporte', 'tipoCuenta', 'entidadBancaria', 'numeroCuenta'].forEach((field) => {
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
    const { steps, dependenciaEmail } = buildApprovalPlan({ jefe, laboral, personal });
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

const page = (title, body) => `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="icon" type="image/png" href="/api/desplazamientos-viaticos/assets/escudo.png"><link rel="apple-touch-icon" href="/api/desplazamientos-viaticos/assets/escudo.png"><title>${escapeHtml(title)}</title><style>body{margin:0;padding:28px 16px;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155}button,input,textarea,select,table{font-family:inherit}.card{max-width:900px;margin:0 auto;background:#fff;border:1px solid #dbeafe;border-radius:14px;box-shadow:0 12px 35px #0f172a1f;overflow:hidden}.institutional-image{display:block;width:100%;height:auto;max-height:175px;object-fit:contain;background:#fff}.brand-bar{background:#0b3a6f;color:#fff;padding:14px 26px}.brand-name{font-size:15px;font-weight:800;letter-spacing:.4px}.brand-subtitle{font-size:11px;margin-top:4px;opacity:.95}.body{padding:26px 30px 30px}.page-title{margin:0 0 20px;padding:0 0 12px;border-bottom:2px solid #e5eef9;color:#0b3a6f;font-size:22px;line-height:1.25}.content{font-size:15px;line-height:1.55}.institutional-signature{margin-top:30px;padding-top:18px;border-top:1px solid #e2e8f0;color:#64748b;font-size:12px}.institutional-signature strong{display:block;margin-top:5px;color:#0b3a6f;font-size:13px}button{border:0;border-radius:8px;padding:12px 26px;font-size:14px;font-weight:700;cursor:pointer;transition:all .15s ease;min-width:160px;text-align:center}button:hover{opacity:.92;transform:translateY(-1px);box-shadow:0 6px 16px rgba(0,0,0,.15)}.ok{background:#166534;color:#fff;box-shadow:0 4px 12px rgba(22,101,52,.2)}.bad{background:#b91c1c;color:#fff;box-shadow:0 4px 12px rgba(185,28,28,.2)}.primary{background:#0b3a6f;color:#fff;box-shadow:0 4px 12px rgba(11,58,111,.2)}.remove-row{min-width:auto;background:#dc2626;color:#fff;border:1px solid #b91c1c;padding:8px 14px;font-size:12px}.remove-row:hover{background:#b91c1c}.currency-input{display:flex;align-items:center;width:100%;box-sizing:border-box;border:1px solid #cbd5e1;border-radius:7px;background:#fff;margin:5px 0 12px;overflow:hidden}.currency-input span{padding:0 0 0 10px;font-weight:700;color:#334155}.currency-input input{border:0;outline:0;margin:0;padding-left:6px;background:transparent}input,textarea{box-sizing:border-box;width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:7px;margin:5px 0 12px}table{width:100%;border-collapse:collapse}th,td{padding:8px;border:1px solid #dbe3ee;text-align:left}th{background:#e8eef6}.actions{display:flex;gap:16px;flex-wrap:wrap;justify-content:center;align-items:center;margin:28px auto 10px;width:100%;text-align:center}.notice{padding:12px;background:#fffbeb;border-left:4px solid #d97706;margin:15px 0}.add-concept{display:inline-block;min-width:auto;margin:0}.observations-label{display:block;margin-top:28px;margin-bottom:5px;font-weight:600}@media(max-width:640px){body{padding:0}.card{border-radius:0;border-left:0;border-right:0}.body{padding:20px 16px}.page-title{font-size:19px}.institutional-image{max-height:120px}table{font-size:12px}th,td{padding:6px}.actions{flex-direction:column;width:100%}.actions button{width:100%}}</style></head><body><main class="card"><img class="institutional-image" src="/api/desplazamientos-viaticos/assets/encabezado-correos.png" alt="Universidad CESMAG"><div class="brand-bar"><div class="brand-name">SIAC UNICESMAG</div><div class="brand-subtitle">Sistema Interno de Aseguramiento de la Calidad</div></div><section class="body"><h1 class="page-title">${escapeHtml(title)}</h1><div class="content">${body}</div><footer class="institutional-signature"><em>Fraternalmente,</em><strong>SIAC UNICESMAG</strong><span>Hombres nuevos para tiempos nuevos</span></footer></section></main></body></html>`;

const formatDocumentDate = (value) => {
  if (!value) return 'No registrado';
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}/.test(raw)
    ? new Date(`${raw.slice(0, 10)}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('es-CO');
};

const formatDocumentTime = (value) => {
  const raw = clean(value, 12);
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw || 'No registrado';
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return raw;
  return `${hour % 12 || 12}:${match[2]} ${hour < 12 ? 'a. m.' : 'p. m.'}`;
};

const findTrace = (solicitud, key) => [...(solicitud.trazabilidad || [])].reverse().find((entry) => (
  entry.event === `aprobado_${key}`
  || entry.event === `completado_${key}`
  || entry.event === `no_aprobado_${key}`
  || (key === 'jefe' && entry.event === 'aprobada_jefe')
  || (key === 'financiera_previa' && entry.event === 'aprobada_vicerrectoria_financiera')
  || (key === 'vicerrectoria_dependencia' && entry.event === 'aprobada_vicerrectoria_academica')
  || (key === 'sst' && entry.event === 'aprobada_sst')
  || (key === 'rectoria' && entry.event === 'aprobada_rectoria')
  || (key === 'gestion_humana' && entry.event === 'aprobada_gestion_humana')
));

const renderDepartureSignatures = (solicitud, currentStepKey) => {
  const radication = (solicitud.trazabilidad || []).find((entry) => entry.event === 'radicada');
  const collaborator = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const plan = solicitud.plan_aprobacion || [];
  const txId = `SGC-DEV-${solicitud.id}-${solicitud.consecutivo || '2026'}`;

  const departureSteps = plan.filter((step) => !['tecnico_contable', 'tesoreria'].includes(step.key));

  const formatTraceDate = (d) => {
    if (!d) return 'No registrado';
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleString('es-CO');
  };

  const signatureBoxes = [];

  // 1. Firma del Solicitante (Aceptación Electrónica)
  signatureBoxes.push(`
    <div style="border: 1px solid #cbd5e1; border-radius: 4px; overflow: hidden; background: #ffffff;">
      <div style="background-color: #f1f5f9; color: #1e293b; font-weight: 800; font-size: 10.5px; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #cbd5e1;">
        Firma del Trabajador Solicitante
      </div>
      <div style="padding: 10px 12px; font-size: 11px; line-height: 1.45; color: #1e293b;">
        <div style="font-weight: 700; color: #334155; font-size: 10.5px; margin-bottom: 2px;">Firmado electrónicamente por:</div>
        <div style="font-weight: 800; color: #0b3a6f; font-size: 12.5px; text-transform: uppercase;">${escapeHtml(collaborator.nombre || 'Colaborador')}</div>
        <div><strong>Documento:</strong> ${escapeHtml(collaborator.documento || collaborator.username || 'No registrado')}</div>
        <div><strong>Cargo:</strong> ${escapeHtml(laboral.cargo || collaborator.cargo || 'No registrado')}</div>
        <div><strong>Fecha y hora:</strong> ${formatTraceDate(radication?.at || solicitud.created_at)}</div>
        <div style="font-size: 9px; color: #64748b; margin-top: 4px; font-family: monospace;">ID Transacción: ${escapeHtml(txId)}</div>
      </div>
    </div>
  `);

  // 2. Firmas de los pasos del plan de salida
  departureSteps.forEach((step) => {
    const trace = findTrace(solicitud, step.key);
    const isCurrent = step.key === currentStepKey;
    const isApproved = Boolean(trace && trace.event !== `no_aprobado_${step.key}`);
    const isRejected = trace?.event === `no_aprobado_${step.key}`;

    let contentHtml = '';
    let actorName = trace?.actor?.nombre || trace?.actor?.email || step.nombre || step.label;
    let actorCargo = trace?.actor?.cargo || step.label;

    if (isApproved) {
      contentHtml = `
        <div style="font-weight: 700; color: #334155; font-size: 10.5px; margin-bottom: 2px;">Firmado electrónicamente por:</div>
        <div style="font-weight: 800; color: #0b3a6f; font-size: 12.5px; text-transform: uppercase;">${escapeHtml(actorName)}</div>
        <div><strong>Cargo:</strong> ${escapeHtml(actorCargo)}</div>
        <div><strong>Fecha y hora:</strong> ${formatTraceDate(trace.at)}</div>
        <div style="font-size: 9px; color: #64748b; margin-top: 4px; font-family: monospace;">ID Transacción: ${escapeHtml(txId)}</div>
      `;
    } else if (isRejected) {
      contentHtml = `
        <div style="font-weight: 700; color: #991b1b; font-size: 10.5px; margin-bottom: 2px;">No aprobado por:</div>
        <div style="font-weight: 800; color: #991b1b; font-size: 12.5px; text-transform: uppercase;">${escapeHtml(actorName)}</div>
        <div><strong>Cargo:</strong> ${escapeHtml(actorCargo)}</div>
        <div><strong>Fecha y hora:</strong> ${formatTraceDate(trace.at)}</div>
        <div style="font-size: 10.5px; color: #991b1b; margin-top: 3px;"><strong>Motivo:</strong> ${escapeHtml(trace.observacion || trace.motivo || 'Sin observación')}</div>
      `;
    } else if (isCurrent) {
      contentHtml = `
        <div style="font-weight: 700; color: #0b3a6f; font-size: 11px; margin-bottom: 2px;">Pendiente de firma y visto bueno</div>
        <div style="color: #475569; font-size: 10.5px; line-height: 1.35;">Espacio reservado para la firma electrónica de <strong>${escapeHtml(step.label)}</strong>.</div>
        <div style="margin-top: 5px; font-size: 10px; color: #0b3a6f; font-style: italic;">Utilice el panel inferior para emitir su visto bueno formal.</div>
      `;
    } else {
      contentHtml = `
        <div style="font-weight: 600; color: #64748b; font-size: 10.5px; margin-bottom: 2px;">Estado: Pendiente</div>
        <div style="color: #94a3b8; font-size: 10px;">Esta etapa se habilitará una vez aprobadas las instancias previas.</div>
      `;
    }

    const headerBg = isApproved ? '#f1f5f9' : (isRejected ? '#fef2f2' : (isCurrent ? '#eff6ff' : '#f8fafc'));
    const headerColor = isApproved ? '#0b3a6f' : (isRejected ? '#991b1b' : (isCurrent ? '#1e3a8a' : '#475569'));
    const borderCol = isCurrent ? '#93c5fd' : '#cbd5e1';

    signatureBoxes.push(`
      <div style="border: 1px solid ${borderCol}; border-radius: 4px; overflow: hidden; background: #ffffff;">
        <div style="background-color: ${headerBg}; color: ${headerColor}; font-weight: 800; font-size: 10.5px; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${borderCol};">
          ${escapeHtml(step.label)}
        </div>
        <div style="padding: 10px 12px; font-size: 11px; line-height: 1.45; color: #1e293b;">
          ${contentHtml}
        </div>
      </div>
    `);
  });

  return `
    <section class="fr004-section" style="padding-top:0">
      <h2 class="fr004-section-title">Control de Firmas Electrónicas y Aprobaciones de Salida</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-bottom: 18px;">
        ${signatureBoxes.join('')}
      </div>
    </section>
  `;
};

const renderLiquidationSectionHtml = (solicitud, currentStepKey) => {
  const liquidacion = solicitud.liquidacion || {};
  const visibleDetails = getVisibleLiquidationDetails(liquidacion);
  const total = Number(liquidacion.totalAnticipo) || visibleDetails.reduce((sum, item) => sum + (Number(item.valorTotal) || 0), 0);
  const plan = solicitud.plan_aprobacion || [];
  const financialSteps = plan.filter((step) => ['tecnico_contable', 'tesoreria'].includes(step.key));
  const txId = `SGC-DEV-${solicitud.id}-${solicitud.consecutivo || '2026'}`;

  const formatTraceDate = (d) => {
    if (!d) return 'No registrado';
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleString('es-CO');
  };

  const rowsHtml = visibleDetails.map((item) => `
    <tr style="border-bottom: 1px solid #e2e8f0;">
      <td style="padding: 9px 12px; font-size: 12px; color: #1e293b; font-weight: 600;">${escapeHtml(item.detalle)}</td>
      <td style="padding: 9px 12px; font-size: 12px; text-align: right; color: #334155;">$${Number(item.valorDiario || 0).toLocaleString('es-CO')}</td>
      <td style="padding: 9px 12px; font-size: 12px; text-align: center; color: #334155;">${escapeHtml(item.dias)}</td>
      <td style="padding: 9px 12px; font-size: 12px; text-align: right; font-weight: 700; color: #0b3a6f;">$${Number(item.valorTotal || 0).toLocaleString('es-CO')}</td>
    </tr>
  `).join('');

  const finBoxes = financialSteps.map((step) => {
    const trace = findTrace(solicitud, step.key);
    const isCurrent = step.key === currentStepKey;
    const isApproved = Boolean(trace && trace.event !== `no_aprobado_${step.key}`);
    const isRejected = trace?.event === `no_aprobado_${step.key}`;

    let contentHtml = '';
    let actorName = trace?.actor?.nombre || trace?.actor?.email || step.nombre || step.label;
    let actorCargo = trace?.actor?.cargo || step.label;

    if (isApproved) {
      contentHtml = `
        <div style="font-weight: 700; color: #166534; font-size: 10.5px; margin-bottom: 2px;">FIRMADO ELECTRÓNICAMENTE:</div>
        <div style="font-weight: 800; color: #0b3a6f; font-size: 12.5px; text-transform: uppercase;">${escapeHtml(actorName)}</div>
        <div><strong>Cargo:</strong> ${escapeHtml(actorCargo)}</div>
        <div><strong>Fecha y hora:</strong> ${formatTraceDate(trace.at)}</div>
        <div style="font-size: 9px; color: #64748b; margin-top: 4px; font-family: monospace;">ID Transacción: ${escapeHtml(txId)}</div>
      `;
    } else if (isRejected) {
      contentHtml = `
        <div style="font-weight: 700; color: #991b1b; font-size: 10.5px; margin-bottom: 2px;">No autorizado por:</div>
        <div style="font-weight: 800; color: #991b1b; font-size: 12.5px; text-transform: uppercase;">${escapeHtml(actorName)}</div>
        <div><strong>Cargo:</strong> ${escapeHtml(actorCargo)}</div>
        <div><strong>Fecha y hora:</strong> ${formatTraceDate(trace.at)}</div>
        <div style="font-size: 10.5px; color: #991b1b; margin-top: 3px;"><strong>Motivo:</strong> ${escapeHtml(trace.observacion || trace.motivo || 'Sin observación')}</div>
      `;
    } else if (isCurrent) {
      contentHtml = `
        <div style="font-weight: 700; color: #0b3a6f; font-size: 11px; margin-bottom: 2px;">Pendiente de autorización de pago</div>
        <div style="color: #475569; font-size: 10.5px; line-height: 1.35;">Espacio reservado para la firma electrónica de <strong>${escapeHtml(step.label)}</strong>.</div>
        <div style="margin-top: 5px; font-size: 10px; color: #0b3a6f; font-style: italic;">Utilice el panel inferior para registrar la decisión.</div>
      `;
    } else {
      contentHtml = `
        <div style="font-weight: 600; color: #64748b; font-size: 10.5px; margin-bottom: 2px;">Estado: Pendiente</div>
        <div style="color: #94a3b8; font-size: 10px;">Esta etapa se habilitará al liquidar los viáticos.</div>
      `;
    }

    const headerBg = isApproved ? '#f0fdf4' : (isRejected ? '#fef2f2' : (isCurrent ? '#eff6ff' : '#f8fafc'));
    const headerColor = isApproved ? '#166534' : (isRejected ? '#991b1b' : (isCurrent ? '#1e3a8a' : '#475569'));
    const borderCol = isCurrent ? '#93c5fd' : (isApproved ? '#86efac' : '#cbd5e1');

    return `
      <div style="border: 1px solid ${borderCol}; border-radius: 4px; overflow: hidden; background: #ffffff;">
        <div style="background-color: ${headerBg}; color: ${headerColor}; font-weight: 800; font-size: 10.5px; padding: 7px 10px; text-align: center; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid ${borderCol};">
          ${escapeHtml(step.label)}
        </div>
        <div style="padding: 10px 12px; font-size: 11px; line-height: 1.45; color: #1e293b;">
          ${contentHtml}
        </div>
      </div>
    `;
  }).join('');

  return `
    <section class="fr004-section" style="padding-top:0">
      <h2 class="fr004-section-title">Liquidación de Viáticos y Gastos de Viaje</h2>
      <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 6px; margin-bottom: 14px; background: #ffffff;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11.5px;">
          <thead>
            <tr style="background-color: #0b3a6f; color: #ffffff;">
              <th style="padding: 10px 12px; text-align: left; font-size: 11px; font-weight: 800; text-transform: uppercase;">Detalle</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 140px;">Valor diario (COP)</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 90px;">No. días</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 11px; font-weight: 800; text-transform: uppercase; width: 160px;">Valor total (COP)</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="4" style="padding: 10px; text-align: center; color: #64748b;">Pendiente de registrar conceptos.</td></tr>'}
          </tbody>
          <tfoot>
            <tr style="background-color: #dbeafe; border-top: 2px solid #0b3a6f;">
              <th colspan="3" style="padding: 10px 12px; text-align: right; font-size: 12.5px; font-weight: 800; color: #0b3a6f; text-transform: uppercase;">TOTAL ANTICIPO:</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 13.5px; font-weight: 800; color: #0b3a6f;">$${total.toLocaleString('es-CO')}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      ${liquidacion.observaciones ? `
      <div style="margin-bottom: 16px; padding: 10px 14px; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px;">
        <div style="font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; margin-bottom: 3px;">Observaciones a la liquidación</div>
        <div style="font-size: 12px; color: #1e293b; line-height: 1.4;">${escapeHtml(liquidacion.observaciones)}</div>
      </div>
      ` : ''}

      <h2 class="fr004-section-title">Control de Firmas Electrónicas del Flujo Financiero</h2>
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; margin-bottom: 18px;">
        ${finBoxes}
      </div>
    </section>
  `;
};

const renderTraceabilitySection = (solicitud) => {
  const formatTraceDate = (d) => {
    if (!d) return 'No registrado';
    const date = new Date(d);
    return Number.isNaN(date.getTime()) ? String(d) : date.toLocaleString('es-CO');
  };

  const traces = solicitud.trazabilidad || [];
  const traceRows = traces.map((t) => {
    const detailStr = t.motivo || t.observacion || t.justificacion || (t.event === 'radicada' ? 'Se registró la solicitud en el sistema.' : 'Procesado exitosamente.');
    const actorStr = t.actor?.nombre || t.actor?.email || 'Sistema SIAC';
    return `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 7px 10px; font-size: 10.5px; color: #475569; white-space: nowrap;">${formatTraceDate(t.at)}</td>
        <td style="padding: 7px 10px; font-size: 10.5px; font-weight: 700; color: #0b3a6f;">${escapeHtml(t.event)}</td>
        <td style="padding: 7px 10px; font-size: 10.5px; color: #334155;">${escapeHtml(actorStr)}</td>
        <td style="padding: 7px 10px; font-size: 10.5px; color: #475569;">${escapeHtml(detailStr)}</td>
      </tr>
    `;
  }).join('');

  return `
    <section class="fr004-section" style="padding-top:0">
      <h2 class="fr004-section-title">Trazabilidad Cronológica del Trámite</h2>
      <div style="overflow-x: auto; border: 1px solid #cbd5e1; border-radius: 4px; margin-bottom: 12px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
          <thead>
            <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
              <th style="padding: 8px 10px; text-align: left; font-weight: 800; font-size: 10.5px; color: #475569; text-transform: uppercase;">Fecha y Hora</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 800; font-size: 10.5px; color: #475569; text-transform: uppercase;">Evento / Acción</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 800; font-size: 10.5px; color: #475569; text-transform: uppercase;">Responsable</th>
              <th style="padding: 8px 10px; text-align: left; font-weight: 800; font-size: 10.5px; color: #475569; text-transform: uppercase;">Detalle / Observación</th>
            </tr>
          </thead>
          <tbody>
            ${traceRows || '<tr><td colspan="4" style="padding: 8px; text-align: center; color: #94a3b8;">Sin registros de trazabilidad adicionales.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
  `;
};

const liquidationRequestDocumentHtml = (solicitud, { currentStepKey = null, formId = 'action-form', isTechnician = false } = {}) => {
  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const days = calculateDays(salida, viaticos.numeroDiasSolicitados) || 'No registrado';
  const destination = viaticos.lugarVisitar || salida.entidadDestino || salida.municipio || salida.pais;
  const readonlyField = (label, value, className = '') => `<div class="fr004-field ${className}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value || 'No registrado')}</strong></div>`;

  const centroCostoField = isTechnician
    ? `<div class="fr004-field"><label for="centro-costo-input">Centro de costos asignado <span class="fr004-required">*</span></label><input class="fr004-editable" id="centro-costo-input" form="${formId}" name="centroCosto" maxlength="100" value="${escapeHtml(viaticos.centroCosto || '')}" placeholder="Digite el centro de costos" required></div>`
    : `<div class="fr004-field"><label for="centro-costo-input">Centro de costos asignado</label><input class="fr004-editable" id="centro-costo-input" form="${formId}" name="centroCosto" maxlength="100" value="${escapeHtml(viaticos.centroCosto || '')}" placeholder="Centro de costos"></div>`;

  const alojamientoOptions = ['Hotel', 'Casa de familia', 'No requiere'];
  const currentAlojamiento = (viaticos.alojamiento || '').toLowerCase();
  const alojamientoField = `<div class="fr004-field"><label for="alojamiento-input">Alojamiento <span class="fr004-required">*</span></label><select class="fr004-editable" id="alojamiento-input" form="${formId}" name="alojamiento" style="margin:2px 0 0;padding:5px 8px;border:1.5px solid #cbd5e1;background:#fff;color:#172033;font-size:11.5px;font-weight:700" required>${alojamientoOptions.map(opt => `<option value="${opt}"${currentAlojamiento.includes(opt.toLowerCase()) || (opt === 'Hotel' && !currentAlojamiento) ? ' selected' : ''}>${opt}</option>`).join('')}</select></div>`;

  const transporteOptions = ['Terrestre', 'Aéreo', 'Mixto'];
  const currentTransporte = (viaticos.transporte || '').toLowerCase();
  const transporteField = `<div class="fr004-field"><label for="transporte-input">Transporte <span class="fr004-required">*</span></label><select class="fr004-editable" id="transporte-input" form="${formId}" name="transporte" style="margin:2px 0 0;padding:5px 8px;border:1.5px solid #cbd5e1;background:#fff;color:#172033;font-size:11.5px;font-weight:700" required>${transporteOptions.map(opt => `<option value="${opt}"${currentTransporte.includes(opt.toLowerCase()) || (opt === 'Aéreo' && !currentTransporte) ? ' selected' : ''}>${opt}</option>`).join('')}</select></div>`;

  const tipoCuentaField = `<div class="fr004-field"><label for="tipo-cuenta-input">Tipo de cuenta <span class="fr004-required">*</span></label><select class="fr004-editable" id="tipo-cuenta-input" form="${formId}" name="tipoCuenta" style="margin:2px 0 0;padding:5px 8px;border:1.5px solid #cbd5e1;background:#fff;color:#172033;font-size:11.5px;font-weight:700" required><option value="Ahorros"${viaticos.tipoCuenta === 'Ahorros' ? ' selected' : ''}>Ahorros</option><option value="Corriente"${viaticos.tipoCuenta === 'Corriente' ? ' selected' : ''}>Corriente</option></select></div>`;

  const bankOptions = ['Bancolombia', 'Davivienda', 'Banco AV Villas', 'Otro'];
  const currentBank = viaticos.entidadBancaria || 'Bancolombia';
  const allBankOptions = bankOptions.some(b => b.toLowerCase() === currentBank.toLowerCase())
    ? bankOptions
    : [currentBank, ...bankOptions];

  const entidadBancariaField = `<div class="fr004-field fr004-span-2"><label for="entidad-bancaria-input">Entidad bancaria <span class="fr004-required">*</span></label><select class="fr004-editable" id="entidad-bancaria-input" form="${formId}" name="entidadBancaria" style="margin:2px 0 0;padding:5px 8px;border:1.5px solid #cbd5e1;background:#fff;color:#172033;font-size:11.5px;font-weight:700" required>${allBankOptions.map(b => `<option value="${escapeHtml(b)}"${b.toLowerCase() === currentBank.toLowerCase() ? ' selected' : ''}>${escapeHtml(b)}</option>`).join('')}</select></div>`;

  const numeroCuentaField = `<div class="fr004-field fr004-span-2"><label for="numero-cuenta-input">Número de cuenta (Corregible) <span class="fr004-required">*</span></label><input class="fr004-editable" id="numero-cuenta-input" form="${formId}" name="numeroCuenta" maxlength="60" value="${escapeHtml(viaticos.numeroCuenta || '')}" placeholder="Número de cuenta bancaria" required></div>`;

  const hasLiquidation = Array.isArray(solicitud.liquidacion?.detalles) && solicitud.liquidacion.detalles.length > 0;
  const isTreasuryOrFinal = currentStepKey === 'tesoreria' || ['pendiente_autorizacion_pago', 'pago_autorizado_pendiente_legalizacion', 'finalizada'].includes(solicitud.estado);
  const showLiquidationSection = hasLiquidation || isTreasuryOrFinal;

  return `
    <style>
      body{padding:20px 12px}.card{max-width:1080px;border:0;background:transparent;box-shadow:none;overflow:visible}.institutional-image,.page-title,.institutional-signature{display:none}.brand-bar{display:block;margin:0 0 18px;padding:16px 22px;border-radius:12px;background:linear-gradient(135deg,#0b3a6f,#124f8d);box-shadow:0 9px 24px rgba(11,58,111,.18)}.brand-name{font-size:16px}.brand-subtitle{font-size:11px}.body{padding:0}.fr004-document{overflow:hidden;margin:0 0 20px;border:1px solid #bfd0e3;border-radius:16px;background:#fff;box-shadow:0 14px 34px rgba(15,52,96,.09)}
      .fr004-header{display:grid;grid-template-columns:minmax(155px,195px) 1fr minmax(140px,170px);min-height:82px;border-bottom:2px solid #0b3a6f}
      .fr004-logo{display:flex;align-items:center;justify-content:center;padding:9px 12px;border-right:1px solid #cad7e6;background:#fff}.fr004-logo img{display:block;width:100%;max-width:165px;height:auto}
      .fr004-title{display:flex;align-items:center;justify-content:center;padding:10px 14px;text-align:center;color:#0b3a6f;font-size:18px;font-weight:900;line-height:1.12;letter-spacing:.1px}
      .fr004-meta{display:flex;flex-direction:column;justify-content:center;padding:9px 13px;border-left:1px solid #cad7e6;background:#f8fafc;color:#475569;font-size:10px;line-height:1.45}.fr004-meta strong{color:#0b3a6f}
      .fr004-section{padding:11px 14px}.fr004-section-title{margin:0 0 7px;padding:6px 9px;border-left:4px solid #1d4ed8;border-radius:0 7px 7px 0;background:linear-gradient(90deg,#eaf2ff,#f6f9fd);color:#0b3a6f;font-size:10.5px;font-weight:900;letter-spacing:.65px;text-transform:uppercase}
      .fr004-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid #dbe5f0;border-left:1px solid #dbe5f0}.fr004-field{display:flex;min-width:0;min-height:36px;padding:6px 9px;border-right:1px solid #dbe5f0;border-bottom:1px solid #dbe5f0;background:#fff;flex-direction:column;justify-content:center}.fr004-field:nth-child(3n+1){background:#f8fbff}.fr004-field span,.fr004-field label{display:block;margin-bottom:2px;color:#334155;font-size:8.5px;font-weight:800;line-height:1.15;letter-spacing:.4px;text-transform:uppercase}.fr004-field strong{display:block;color:#172033;font-size:11.5px;line-height:1.22;overflow-wrap:anywhere}.fr004-field input.fr004-editable{margin:2px 0 0;padding:5px 8px;border:1.5px solid #cbd5e1;background:#fff;color:#172033;font-size:11.5px;font-weight:700}.fr004-field input.fr004-editable:required:invalid{border-color:#dc2626;background:#fffafa;box-shadow:0 0 0 2px rgba(220,38,38,.08)}.fr004-field input.fr004-editable:focus{outline:2px solid rgba(220,38,38,.13);border-color:#dc2626}.fr004-required{color:#b91c1c}.fr004-span-2{grid-column:span 2}.fr004-span-4{grid-column:1/-1}.fr004-emphasis{background:#edf5ff!important}.fr004-emphasis strong{color:#0b3a6f;font-size:12px}
      .fr004-authorization{margin:0 12px 10px;padding:9px 11px;border:1px solid #b9e5d0;border-left:3px solid #059669;border-radius:9px;background:#f0fdf7;color:#334155;font-size:10.5px;line-height:1.35}.fr004-authorization strong{color:#047857}.fr004-legal{margin:0 12px 12px;padding:8px 10px;border:1px solid #f2d18b;border-left:3px solid #d97706;border-radius:8px;background:#fffbeb;color:#713f12;font-size:10.5px;line-height:1.35}
      .liquidation-panel{margin-top:18px;padding:16px;border:1px solid #d7e2ef;border-radius:16px;background:#fff;box-shadow:0 10px 26px rgba(15,52,96,.07)}.liquidation-panel-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:12px}.liquidation-panel-head h2{margin:0;color:#0b3a6f;font-size:19px}.liquidation-panel-head p{margin:3px 0 0;color:#475569;font-size:12px}.liquidation-badge{padding:6px 10px;border-radius:999px;background:#e8f1ff;color:#1d4ed8;font-size:10.5px;font-weight:800;white-space:nowrap}.liquidation-table-wrap{overflow-x:auto;border:1px solid #d7e2ef;border-radius:12px}.liquidation-table-wrap table{min-width:760px}.liquidation-table-wrap thead th{padding:9px;background:#0b3a6f;color:#fff;font-size:11.5px}.liquidation-table-wrap tbody td{padding:7px 9px;vertical-align:middle}.liquidation-table-wrap tfoot th{padding:9px;background:#e8f0fa;color:#0b3a6f}.liquidation-table-wrap input{margin:0;padding:7px 9px}.liquidation-table-wrap .currency-input{margin:0}.liquidation-table-wrap .remove-row{padding:8px 12px}.liquidation-actions{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:12px}
      @media(max-width:760px){.card{max-width:none}.fr004-header{grid-template-columns:1fr 1fr}.fr004-logo{border-bottom:1px solid #cad7e6}.fr004-title{grid-column:1/-1;grid-row:2;border-top:1px solid #cad7e6}.fr004-meta{border-left:1px solid #cad7e6;border-bottom:1px solid #cad7e6}.fr004-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.fr004-span-4{grid-column:1/-1}.liquidation-panel{padding:14px}.liquidation-panel-head{align-items:flex-start;flex-direction:column}}
      @media(max-width:480px){body{padding:0}.brand-bar{margin:0 0 12px;border-radius:0;padding:14px 16px}.fr004-header{display:block}.fr004-logo,.fr004-meta{border:0;border-bottom:1px solid #cad7e6}.fr004-title{font-size:18px}.fr004-grid{grid-template-columns:1fr}.fr004-span-2,.fr004-span-4{grid-column:1}.fr004-section{padding:12px}.fr004-authorization,.fr004-legal{margin-left:12px;margin-right:12px}}
    </style>
    <article class="fr004-document" aria-label="Solicitud de desplazamiento fuera de la ciudad">
      <header class="fr004-header">
        <div class="fr004-logo"><img src="/api/desplazamientos-viaticos/assets/logo-formatos.jpg" alt="Universidad CESMAG"></div>
        <div class="fr004-title">SOLICITUD DE DESPLAZAMIENTO<br>FUERA DE LA CIUDAD</div>
        <div class="fr004-meta"><strong>CÓDIGO: ADF-PP-FR-004</strong><span>VERSIÓN: 6</span><span>FECHA: 14/ENE/2025</span></div>
      </header>
      <section class="fr004-section">
        <h2 class="fr004-section-title">Datos de la solicitud y de la comisión</h2>
        <div class="fr004-grid">
          ${readonlyField('Fecha de solicitud', formatDocumentDate(solicitud.created_at || new Date()))}
          ${readonlyField('Programa / Dependencia', laboral.dependencia, 'fr004-span-2')}
          ${readonlyField('Documento', personal.documento)}
          ${readonlyField('Nombre del empleado', personal.nombre, 'fr004-span-2')}
          ${readonlyField('Cargo', laboral.cargo)}
          ${readonlyField('Correo electrónico', personal.email || personal.correo)}
          ${readonlyField('Lugar a visitar', destination, 'fr004-span-2 fr004-emphasis')}
          ${readonlyField('Fecha del evento', formatDocumentDate(viaticos.fechaEvento || salida.fecha))}
          ${readonlyField('No. días solicitados', days)}
          ${readonlyField('Día de salida', formatDocumentDate(salida.fecha))}
          ${readonlyField('Hora de salida', formatDocumentTime(salida.horaInicio))}
          ${readonlyField('Día de regreso', formatDocumentDate(salida.fechaRegreso))}
          ${readonlyField('Hora de regreso', formatDocumentTime(salida.horaFin))}
          ${readonlyField('Objeto de la comisión', viaticos.objetoComision || salida.motivo, 'fr004-span-4 fr004-emphasis')}
          ${readonlyField('Observaciones especiales', viaticos.observacionesEspeciales || 'Sin observaciones', 'fr004-span-4')}
        </div>
      </section>
      <section class="fr004-section" style="padding-top:0">
        <h2 class="fr004-section-title">Logística y consignación</h2>
        <div class="fr004-grid">
          ${centroCostoField}
          ${alojamientoField}
          ${transporteField}
          ${tipoCuentaField}
          ${entidadBancariaField}
          ${numeroCuentaField}
        </div>
      </section>
      <div class="fr004-authorization"><strong>Autorización aceptada electrónicamente por el colaborador.</strong><br>${escapeHtml(viaticos.autorizacionTexto || AUTHORIZATION_TEXT)}</div>
      
      <!-- Firmas de Salida y Permiso -->
      ${renderDepartureSignatures(solicitud, currentStepKey)}

      <!-- Aviso Normativo -->
      <div class="fr004-legal"><strong>IMPORTANTE:</strong> ${escapeHtml((viaticos.avisoLegalizacion || LEGALIZATION_NOTICE).replace(/^IMPORTANTE:\s*/i, ''))}</div>

      <!-- Tabla de Liquidación y Firmas Financieras (Si ya fue liquidada o está en Tesorería) -->
      ${showLiquidationSection ? renderLiquidationSectionHtml(solicitud, currentStepKey) : ''}

      <!-- Trazabilidad del Trámite -->
      ${renderTraceabilitySection(solicitud)}
    </article>`;
};

const liquidacionForm = (solicitud, token, nonce, { demo = false, demoCanSubmit = false, demoTechnicianOnly = false } = {}) => {
  const rows = `<tr hidden><td colspan="5"><input type="hidden" name="liquidationRowsVersion" value="2"></td></tr>${BASE_DETAIL_NAMES.map((name, index) => `<tr data-liquidation-row><td><input type="hidden" name="baseIncluded${index}" value="1">${escapeHtml(name)}</td><td><div class="currency-input"><span aria-hidden="true">$</span><input class="valor-diario" inputmode="numeric" type="number" min="0" step="1" name="valorDiario${index}" value="0" aria-label="Valor diario en pesos para ${escapeHtml(name)}" oninput="window.calcLiquidation && window.calcLiquidation()"></div></td><td><input class="dias" inputmode="numeric" type="number" min="0" step="1" name="dias${index}" value="0" oninput="window.calcLiquidation && window.calcLiquidation()"></td><td class="row-total">$0</td><td><button class="remove-row" type="button" aria-label="Eliminar ${escapeHtml(name)}">Eliminar</button></td></tr>`).join('')}`;
  const calculator = `<script>
(function() {
  function formatMoney(num) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(num || 0);
  }
  function parseVal(val) {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    var cleanStr = String(val || '').replace(/[^0-9.-]/g, '');
    var n = parseFloat(cleanStr);
    return isNaN(n) ? 0 : n;
  }
  function recalculate() {
    var body = document.getElementById('liquidacion-detalles');
    if (!body) return;
    var rows = body.querySelectorAll('tr[data-liquidation-row]');
    var grandTotal = 0;
    rows.forEach(function(row) {
      var vInput = row.querySelector('.valor-diario');
      var dInput = row.querySelector('.dias');
      var tCell = row.querySelector('.row-total');
      var v = vInput ? parseVal(vInput.value) : 0;
      var d = dInput ? Math.max(0, Math.floor(parseVal(dInput.value))) : 0;
      var rowTotal = v * d;
      grandTotal += rowTotal;
      if (tCell) {
        tCell.textContent = formatMoney(rowTotal);
      }
    });
    var totalEl = document.getElementById('total-anticipo');
    if (totalEl) {
      totalEl.textContent = formatMoney(grandTotal);
    }
  }
  window.calcLiquidation = recalculate;

  function init() {
    var body = document.getElementById('liquidacion-detalles');
    var addBtn = document.getElementById('agregar-concepto');
    var countInput = document.getElementById('extra-count');

    if (body) {
      body.addEventListener('input', recalculate);
      body.addEventListener('change', recalculate);
      body.addEventListener('keyup', recalculate);
      body.addEventListener('paste', function() { setTimeout(recalculate, 50); });
      body.addEventListener('click', function(e) {
        var btn = e.target.closest('.remove-row');
        if (btn) {
          var tr = btn.closest('tr');
          if (tr) {
            tr.remove();
            recalculate();
          }
        }
      });
    }

    if (addBtn && countInput && body) {
      addBtn.addEventListener('click', function(e) {
        e.preventDefault();
        var i = parseInt(countInput.value, 10) || 0;
        if (i >= 30) return;
        var tr = document.createElement('tr');
        tr.setAttribute('data-liquidation-row', '');
        tr.innerHTML = '<td><input class="detalle-extra" name="extraDetalle' + i + '" maxlength="120" placeholder="Nombre del concepto" required></td>' +
          '<td><div class="currency-input"><span aria-hidden="true">$</span><input class="valor-diario" inputmode="numeric" type="number" min="0" step="1" name="extraValorDiario' + i + '" value="0" aria-label="Valor diario en pesos" required oninput="window.calcLiquidation && window.calcLiquidation()"></div></td>' +
          '<td><input class="dias" inputmode="numeric" type="number" min="0" step="1" name="extraDias' + i + '" value="0" required oninput="window.calcLiquidation && window.calcLiquidation()"></td>' +
          '<td class="row-total">$0</td>' +
          '<td><button class="remove-row" type="button" aria-label="Eliminar concepto">Eliminar</button></td>';
        body.appendChild(tr);
        countInput.value = String(i + 1);
        var inputFirst = tr.querySelector('.detalle-extra');
        if (inputFirst) inputFirst.focus();
        recalculate();
      });
    }

    recalculate();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  window.addEventListener('load', recalculate);
  setTimeout(recalculate, 200);
})();
</script>`;
  const demoNotice = demoTechnicianOnly
    ? '<div class="notice"><strong>PRUEBA EXCLUSIVA DEL TÉCNICO:</strong> puede diligenciar y procesar la liquidación. No se enviará a Tesorería, no se notificará a otros correos y no se modificará una solicitud real.</div>'
    : demoCanSubmit
      ? `<div class="notice"><strong>PRUEBA CONTROLADA:</strong> al enviar, la liquidación llegará exclusivamente a ${escapeHtml(DEMO_TREASURY_EMAIL)}. No avanzará por el flujo institucional ni modificará una solicitud real.</div>`
    : demo ? '<div class="notice"><strong>VISTA DE PRUEBA:</strong> puede escribir valores y verificar todos los cálculos. Esta pantalla no guarda información ni envía la liquidación a Tesorería.</div>' : '';
  const submitButton = demo && !demoCanSubmit
    ? '<button type="button" disabled style="background:#94a3b8;color:#fff;cursor:not-allowed">Vista de prueba — envío a Tesorería deshabilitado</button>'
    : demoTechnicianOnly
      ? '<button class="primary" type="submit" onclick="document.getElementById(\'form-accion\').value=\'liquidar\';">Procesar liquidación de prueba</button>'
    : demoCanSubmit
      ? '<button class="primary" type="submit" onclick="document.getElementById(\'form-accion\').value=\'liquidar\';">Enviar liquidación de prueba a Tesorería</button>'
    : '<div class="actions"><button class="primary" type="submit" onclick="document.getElementById(\'form-accion\').value=\'liquidar\';">Enviar liquidación a Tesorería</button><button class="bad" type="submit" formnovalidate onclick="document.getElementById(\'form-accion\').value=\'rechazar\';">Rechazar financiación</button></div>';
  const formAction = demoCanSubmit
    ? `/api/desplazamientos-viaticos/prueba/liquidacion/${token}`
    : demo ? '#' : `/api/desplazamientos-viaticos/accion/${token}`;
  const hiddenDemoAction = demo && demoCanSubmit ? '<input type="hidden" name="accion" value="liquidar">' : '<input type="hidden" id="form-accion" name="accion" value="liquidar">';
  return page('Generar liquidación de viáticos y gastos de viaje', `<form id="liquidacion-form" method="post" action="${formAction}">${hiddenDemoAction}<input id="extra-count" type="hidden" name="extraCount" value="0">${demoNotice}${liquidationRequestDocumentHtml(solicitud, { currentStepKey: 'tecnico_contable', formId: 'liquidacion-form', isTechnician: true })}<section class="liquidation-panel"><div class="liquidation-panel-head"><div><h2>Liquidación de viáticos y gastos de viaje</h2><p>Registre únicamente los conceptos autorizados que realmente serán utilizados.</p></div><span class="liquidation-badge">Valores en pesos colombianos (COP)</span></div><div class="liquidation-table-wrap"><table><thead><tr><th>Detalle</th><th>Valor diario (COP)</th><th>No. días</th><th>Valor total (COP)</th><th>Acción</th></tr></thead><tbody id="liquidacion-detalles">${rows}</tbody><tfoot><tr><th colspan="3">TOTAL ANTICIPO</th><th id="total-anticipo">$0</th><th></th></tr></tfoot></table></div><div class="liquidation-actions"><button id="agregar-concepto" class="primary add-concept" type="button">+ Agregar otro concepto</button><span style="color:#64748b;font-size:12px">Puede eliminar los conceptos que no apliquen.</span></div><label class="observations-label">Observaciones a la liquidación</label><textarea name="observaciones" maxlength="2000" rows="4" placeholder="Escriba aquí las observaciones de la liquidación..."></textarea>${submitButton}</section></form>${calculator}`);
};

const approvalForm = (solicitud, step, token, { accessSource = 'primary' } = {}) => {
  const isAlternateAccess = accessSource === step.alternateAccessSource;
  const isParallelEquivalent = isAlternateAccess && Boolean(step.parallelEquivalentAccess);
  const alternateObservationRequired = isAlternateAccess && step.alternateObservationRequired !== false;
  const privacyNotice = ['sst', 'gestion_humana'].includes(step.key)
    ? '<div class="notice">Esta vista contiene únicamente la información del permiso. La liquidación financiera se gestiona posteriormente y con acceso restringido.</div>'
    : '';
  const delegatedNotice = isParallelEquivalent
    ? '<div class="notice"><strong>Acceso institucional equivalente.</strong> Este enlace fue enviado al buzón de la Vicerrectoría Financiera y tiene la misma validez que el remitido al Vicerrector. La primera decisión registrada cerrará ambos enlaces.</div>'
    : isAlternateAccess
    ? `<div class="notice"><strong>Acceso alterno de ${escapeHtml(step.alternateApprovalLabel || 'la dependencia')}.</strong> Utilice este enlace únicamente cuando ${escapeHtml(step.alternateAbsenceRole || step.label)} no esté disponible. La observación es obligatoria y este acceso quedará identificado en la trazabilidad a nombre de ${escapeHtml(step.alternateAuthorityLabel || step.alternateApprovalLabel || 'la autoridad correspondiente')}.</div>`
    : '';
  const observationLabel = alternateObservationRequired ? 'Observación obligatoria de la actuación delegada' : 'Observación (obligatoria si no aprueba)';
  return page(`Revisión pendiente: ${step.label}`, `<form id="action-form" method="post" action="/api/desplazamientos-viaticos/accion/${token}">${liquidationRequestDocumentHtml(solicitud, { currentStepKey: step.key, formId: 'action-form', isTechnician: false })}${privacyNotice}${delegatedNotice}<label class="observations-label" style="display:block;margin-top:24px;font-weight:700;color:#0b3a6f;">${observationLabel}</label><textarea name="observacion" maxlength="1200" rows="4"${alternateObservationRequired ? ' required' : ''} placeholder="Escriba aquí sus observaciones..."></textarea><div class="actions"><button class="ok" name="accion" value="aprobar" type="submit">Dar visto bueno</button><button class="bad" name="accion" value="rechazar" type="submit">No aprobar</button></div></form>`);
};

const treasuryForm = (solicitud, token) => page('Autorizar pago en Tesorería / Pagaduría', `<form id="action-form" method="post" action="/api/desplazamientos-viaticos/accion/${token}">${liquidationRequestDocumentHtml(solicitud, { currentStepKey: 'tesoreria', formId: 'action-form', isTechnician: false })}<p style="margin:16px 0 12px;color:#475569">Revise la liquidación registrada por el Técnico Contable y decida si autoriza el pago.</p><label class="observations-label" style="display:block;margin-top:16px;font-weight:700;color:#0b3a6f;">Observación de Tesorería / Pagaduría (obligatoria si no autoriza)</label><textarea name="observacion" maxlength="1200" rows="4" placeholder="Escriba aquí sus observaciones..."></textarea><div class="actions"><button class="ok" name="accion" value="autorizar_pago" type="submit">Autorizar pago</button><button class="bad" name="accion" value="rechazar_pago" type="submit">No autorizar pago</button></div></form>`);

const legacyTreasuryForm = (solicitud, token) => page('Tramitar solicitud en Tesorería', `<form id="action-form" method="post" action="/api/desplazamientos-viaticos/accion/${token}">${liquidationRequestDocumentHtml(solicitud, { currentStepKey: 'tesoreria', formId: 'action-form', isTechnician: false })}<div class="notice"><strong>Solicitud iniciada con el flujo anterior.</strong> Esta actuación se conserva únicamente para finalizar correctamente solicitudes que ya estaban en curso.</div><label class="observations-label" style="display:block;margin-top:16px;font-weight:700;color:#0b3a6f;">Observación de Tesorería</label><textarea name="observacion" maxlength="1200" rows="4" placeholder="Escriba aquí sus observaciones..."></textarea><div class="actions"><button class="primary" name="accion" value="tramitar" type="submit">Tramitar solicitud</button></div></form>`);

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
  res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; form-action *;");
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
    res.setHeader("Content-Security-Policy", `default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; form-action ${demoCanSubmit ? '*' : "'none'"};`);
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
    const centroCosto = clean(req.body.centroCosto, 100);
    if (!centroCosto) return res.status(400).send(page('Centro de costos obligatorio', '<p>El Técnico Contable debe registrar el centro de costos antes de procesar la liquidación.</p>'));
    const liquidacion = parseLiquidationBody(req.body);
    if (liquidacion.error) return res.status(400).send(page('Falta el detalle', `<p>${escapeHtml(liquidacion.error)}</p>`));
    if (technicianOnly) {
      await markDemoTokenProcessed(tokenHash, usedDemoLiquidationTokens, payload.exp);
      return res.send(page('Solicitud procesada', `<p>La liquidación de prueba por <strong>$${liquidacion.totalAnticipo.toLocaleString('es-CO')}</strong> fue procesada correctamente.</p><p>No se envió ningún correo adicional y no se modificó una solicitud real. Este enlace quedó cerrado.</p>`));
    }
    const solicitudDemo = buildDemoSolicitud(liquidacion);
    solicitudDemo.solicitante_snapshot.email = payload.email || '';
    solicitudDemo.trazabilidad = [{ event: 'completado_tecnico_contable', actor: { nombre: 'Técnico contable de prueba', email: payload.email || '' }, at: new Date().toISOString() }];
    const treasuryToken = encryptPayload({
      purpose: 'demo_tesoreria_tramitar',
      technicianEmail: payload.email || '',
      liquidacion
    }, 24 * 60 * 60);
    const treasuryUrl = `${publicBackendUrl}/api/desplazamientos-viaticos/prueba/tesoreria/${treasuryToken}`;
    const pdfAttachment = await buildLiquidationPdfAttachment(solicitudDemo);
    const html = renderInstitutionalTemplate({
      title: 'PRUEBA - Autorización de pago en Tesorería',
      introHtml: '<p><strong>ESTE ES UN CORREO DE PRUEBA. NO REALICE NINGÚN TRÁMITE REAL.</strong></p><p>El técnico contable diligenció la liquidación. De acuerdo con el flujo actualizado, pasa directamente a Tesorería/Pagaduría para autorizar el pago.</p>',
      bodyHtml: `${summaryHtml(solicitudDemo)}<p><strong>Total anticipo:</strong> $${liquidacion.totalAnticipo.toLocaleString('es-CO')}</p><p><strong>Observaciones:</strong> ${escapeHtml(liquidacion.observaciones || 'Sin observaciones')}</p><p style="text-align:center;margin:22px 0"><a href="${treasuryUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:700">Autorizar pago de prueba</a></p>`
    });
    const result = await sendInstitutionalEmail({
      to: DEMO_TREASURY_EMAIL,
      subject: `${solicitudDemo.consecutivo} | PRUEBA - Autorización de pago`,
      text: `Correo de prueba. Total del anticipo: $${liquidacion.totalAnticipo.toLocaleString('es-CO')}.`,
      html,
      attachments: [pdfAttachment]
    });
    if (!result.success) throw new Error(result.error || 'No fue posible enviar el correo de prueba.');
    await markDemoTokenProcessed(tokenHash, usedDemoLiquidationTokens, payload.exp);
    return res.send(page('Solicitud procesada', `<p>La liquidación de prueba por <strong>$${liquidacion.totalAnticipo.toLocaleString('es-CO')}</strong> fue enviada directamente a Tesorería/Pagaduría de prueba.</p><p>Este enlace quedó cerrado y no permite un segundo envío.</p>`));
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
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; form-action *;");
    return res.send(page('Autorizar pago de prueba en Tesorería', `${summaryHtml(solicitudDemo)}<p>La liquidación fue registrada por el Técnico Contable y remitida directamente a Tesorería/Pagaduría. Al confirmar se autorizará el pago y finalizará la prueba.</p><form method="post" action="/api/desplazamientos-viaticos/prueba/tesoreria/${req.params.token}"><label>Observación de Tesorería / Pagaduría</label><textarea name="observacion" maxlength="1200" rows="4"></textarea><button class="primary" type="submit">Autorizar pago</button></form>`));
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
      { event: 'completado_tesoreria', actor: { nombre: 'Tesorería / Pagaduría de prueba', email: DEMO_TREASURY_EMAIL }, detail: { observacion: clean(req.body.observacion, 1200), pagoAutorizado: true }, at: new Date().toISOString() }
    ];
    const pdfAttachment = await buildLiquidationPdfAttachment(solicitudDemo);
    const result = await sendInstitutionalEmail({
      to: technicianEmail,
      subject: `${solicitudDemo.consecutivo} | PRUEBA - Pago autorizado y solicitud finalizada`,
      text: 'Prueba controlada finalizada. Se adjunta la liquidación con las actuaciones del Técnico Contable y Tesorería.',
      html: renderInstitutionalTemplate({
        title: 'PRUEBA - Pago autorizado y solicitud finalizada',
        introHtml: '<p><strong>ESTE ES UN CORREO DE PRUEBA.</strong></p><p>Tesorería/Pagaduría autorizó el pago. La liquidación contiene las actuaciones del Técnico Contable y Tesorería, conforme al flujo actualizado.</p>',
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
    res.setHeader("Content-Security-Policy", "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; script-src * 'unsafe-inline' 'unsafe-eval'; style-src * 'unsafe-inline'; form-action *;");
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
    const isAlternateAccess = payload.accessSource === step.alternateAccessSource;
    const actor = isAlternateAccess
      ? buildActor(
        step.key,
        step.parallelEquivalentAccess
          ? `${step.alternateApprovalLabel || step.label} – buzón institucional`
          : `${step.alternateApprovalLabel || 'Programa académico'} – acceso alterno`,
        step.alternateApprovalEmail
      )
      : buildActor(step.key, step.label, step.email);
    const accion = clean(req.body.accion, 30);
    const actionObservation = clean(req.body.observacion, 1200);
    if (isAlternateAccess && step.alternateObservationRequired !== false && !actionObservation) {
      return res.status(400).send(page('Observación obligatoria', `<p>Debe explicar la ausencia de ${escapeHtml(step.alternateAbsenceRole || step.label)} y el motivo de utilización del acceso alterno de ${escapeHtml(step.alternateApprovalLabel || 'la dependencia')}.</p>`));
    }

    // Persistir correcciones en información bancaria y logística realizadas por la autoridad
    const submittedEntidad = clean(req.body.entidadBancaria, 100);
    const submittedTipo = clean(req.body.tipoCuenta, 30);
    const submittedNumero = clean(req.body.numeroCuenta, 60);
    const submittedCentroCosto = clean(req.body.centroCosto, 100);
    const submittedAlojamiento = clean(req.body.alojamiento, 50);
    const submittedTransporte = clean(req.body.transporte, 50);

    if (submittedEntidad || submittedTipo || submittedNumero || submittedCentroCosto || submittedAlojamiento || submittedTransporte) {
      const currentViaticos = { ...(solicitud.datos_viaticos || {}) };
      if (submittedEntidad) currentViaticos.entidadBancaria = submittedEntidad;
      if (submittedTipo) currentViaticos.tipoCuenta = submittedTipo;
      if (submittedNumero) currentViaticos.numeroCuenta = submittedNumero;
      if (submittedCentroCosto) currentViaticos.centroCosto = submittedCentroCosto;
      if (submittedAlojamiento) currentViaticos.alojamiento = submittedAlojamiento;
      if (submittedTransporte) currentViaticos.transporte = submittedTransporte;
      
      await solicitud.update({ datos_viaticos: currentViaticos });

      // Sincronizar también con el reporte de salida normal vinculado
      const linkedReport = await getLinkedNormalReport(solicitud);
      if (linkedReport) {
        const formData = { ...(linkedReport.datos_formulario || {}) };
        formData.viaticos = { ...(formData.viaticos || {}), ...currentViaticos };
        await linkedReport.update({ datos_formulario: formData });
      }
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
          accesoAlterno: !step.parallelEquivalentAccess,
          accesoInstitucionalEquivalente: Boolean(step.parallelEquivalentAccess),
          origenAcceso: payload.accessSource,
          autoridadAlterna: step.alternateAuthorityLabel || step.alternateApprovalLabel
        } : {})
      };
      await syncNormalReportApproval(solicitud, step, actor, approvalDetail);
      const next = await advance(solicitud, actor, approvalDetail);
      if (step.key === 'financiera_final' && !next) {
        await solicitud.update({ estado: 'finalizada', finalizado_at: new Date() });
        await sendFinalizedCopies(solicitud);
        return res.send(page('Solicitud aprobada y finalizada', '<p>La solicitud pertenecía al flujo anterior y fue finalizada correctamente. Se enviaron los documentos finales a los destinatarios correspondientes.</p>'));
      }
      return res.send(page('Visto bueno registrado', `<p>Su actuación fue registrada correctamente.${next ? ` La solicitud pasó a ${escapeHtml(next.label)}.` : ''}</p>`));
    }
    if (step.action === 'liquidacion') {
      if (accion === 'rechazar') {
        const observacion = clean(req.body.observaciones || req.body.observacion, 2000);
        if (!observacion) return res.status(400).send(page('Falta la observación', '<p>Debe indicar por qué no se financiarán los viáticos o gastos de viaje.</p>'));
        await solicitud.update({
          estado: 'no_aprobada',
          token_accion_hash: null,
          token_etapa: null,
          trazabilidad: appendTrace(solicitud, 'no_aprobado_tecnico_contable', actor, { observacion })
        });
        await syncNormalReportRejection(solicitud, step, actor, observacion);
        await sendRequesterNotice(solicitud, 'Financiación de viáticos no aprobada', `La solicitud fue rechazada por ${step.label}, en la etapa de liquidación. Motivo: ${observacion}`);
        return res.send(page('Decisión registrada', '<p>La financiación fue rechazada, los enlaces pendientes quedaron cerrados y se notificó al colaborador sin adjuntar documentos finales.</p>'));
      }
      if (accion !== 'liquidar') return res.status(400).send(page('Acción inválida', '<p>Debe enviar la liquidación o rechazarla con una observación.</p>'));
      const centroCosto = clean(req.body.centroCosto, 100);
      if (!centroCosto) return res.status(400).send(page('Centro de costos obligatorio', '<p>Debe registrar el centro de costos antes de enviar la liquidación.</p>'));
      const liquidacion = parseLiquidationBody(req.body);
      if (liquidacion.error) return res.status(400).send(page('Falta el detalle', `<p>${escapeHtml(liquidacion.error)}</p>`));
      const { detalles, totalAnticipo, observaciones } = liquidacion;
      solicitud.datos_viaticos = { ...(solicitud.datos_viaticos || {}), centroCosto };
      solicitud.liquidacion = { detalles, totalAnticipo, observaciones };
      await solicitud.update({
        datos_viaticos: solicitud.datos_viaticos,
        liquidacion: solicitud.liquidacion
      });
      const linkedReport = await getLinkedNormalReport(solicitud);
      if (linkedReport) {
        await linkedReport.update({
          trazabilidad: [...(linkedReport.trazabilidad || []), {
            event: 'liquidada_tecnico_contable',
            actor,
            detail: { totalAnticipo, centroCosto },
            at: new Date().toISOString()
          }]
        });
      }
      const next = await advance(solicitud, actor, { totalAnticipo, centroCosto, observaciones });
      return res.send(page('Solicitud procesada', `<p>La liquidación por $${totalAnticipo.toLocaleString('es-CO')} fue registrada y enviada a ${escapeHtml(next?.label || 'la siguiente etapa')}.</p><p>El enlace del técnico contable quedó cerrado y no puede utilizarse nuevamente.</p>`));
    }
    if (step.action === 'pago') {
      if (accion === 'rechazar_pago') {
        if (!actionObservation) return res.status(400).send(page('Falta la observación', '<p>Debe indicar por qué no autoriza el pago.</p>'));
        await solicitud.update({
          estado: 'no_aprobada',
          token_accion_hash: null,
          token_etapa: null,
          trazabilidad: appendTrace(solicitud, 'no_aprobado_tesoreria', actor, { observacion: actionObservation })
        });
        await syncNormalReportRejection(solicitud, step, actor, actionObservation);
        await sendRequesterNotice(solicitud, 'Pago de viáticos no autorizado', `La solicitud fue rechazada por ${step.label}, en la etapa de autorización de pago. Motivo: ${actionObservation}`);
        return res.send(page('Decisión registrada', '<p>El pago no fue autorizado, el enlace quedó cerrado y se notificó al colaborador sin adjuntar documentos finales.</p>'));
      }
      if (accion !== 'autorizar_pago') return res.status(400).send(page('Acción inválida', '<p>Debe autorizar o no autorizar el pago.</p>'));
      const trace = appendTrace(solicitud, 'completado_tesoreria', actor, {
        observacion: actionObservation,
        pagoAutorizado: true
      });
      await solicitud.update({
        estado: 'pago_autorizado_pendiente_legalizacion',
        paso_actual: solicitud.paso_actual + 1,
        token_accion_hash: null,
        token_etapa: null,
        trazabilidad: trace,
        finalizado_at: new Date()
      });
      const linkedReport = await getLinkedNormalReport(solicitud);
      if (linkedReport) {
        await linkedReport.update({
          estado: 'finalizada',
          finalizado_at: new Date(),
          trazabilidad: [...(linkedReport.trazabilidad || []), {
            event: 'pago_autorizado_tesoreria',
            actor,
            detail: { pagoAutorizado: true, viaticosFinalizados: true },
            at: new Date().toISOString()
          }]
        });
      }
      await ensureLegalizacion(solicitud);
      await sendFinalizedCopies(solicitud);
      await sendNormalReportFinalCopies(solicitud, linkedReport);
      return res.send(page('Pago autorizado', '<p>La autorización de pago fue registrada correctamente. Los dos formatos finales fueron distribuidos y la solicitud quedó pendiente de legalización desde la fecha de regreso.</p>'));
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
  _internals: { buildApprovalPlan, parseLiquidationBody, liquidationRequestDocumentHtml, validatePayload },
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
  radicarSolicitud,
  syncAdminViaticosApproval,
  syncAdminViaticosRejection
};
