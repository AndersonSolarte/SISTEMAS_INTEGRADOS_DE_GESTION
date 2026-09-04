const path = require('path');

const normalizeFlag = (value) => String(value || '').trim().toLowerCase() === 'true';
const SETTING_KEY = 'reporte_salida_form';

const REPORT_DOCUMENT_CODE = 'THM-DP-FR-002';
const REPORT_DOCUMENT_TITLE = 'REPORTE DE SALIDA';

const isReporteSalidaEnabled = () => normalizeFlag(process.env.ENABLE_REPORTE_SALIDA_FORM);

const getReporteSalidaFeatureState = async () => {
  try {
    const { SystemSetting } = require('../models');
    const setting = await SystemSetting.findByPk(SETTING_KEY);
    if (setting && Object.prototype.hasOwnProperty.call(setting.value || {}, 'enabled')) {
      return Boolean(setting.value.enabled);
    }
  } catch (_) {
    // During early model loading, fall back to env.
  }
  return isReporteSalidaEnabled();
};

const setReporteSalidaFeatureState = async (enabled, userId = null) => {
  const { SystemSetting } = require('../models');
  const [setting] = await SystemSetting.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: { value: { enabled: Boolean(enabled) }, updated_by: userId }
  });
  if (setting.value?.enabled !== Boolean(enabled) || Number(setting.updated_by || 0) !== Number(userId || 0)) {
    await setting.update({ value: { enabled: Boolean(enabled) }, updated_by: userId });
  }
  return Boolean(enabled);
};

const getReporteSalidaRecipients = () => ({
  gestionHumana: String(process.env.REPORTE_SALIDA_GESTION_HUMANA_EMAIL || 'talento.humano@unicesmag.edu.co').trim().toLowerCase(),
  sst: String(process.env.REPORTE_SALIDA_SST_EMAIL || 'seguridadysalud@unicesmag.edu.co').trim().toLowerCase(),
  proyeccionSocial: String(process.env.REPORTE_SALIDA_PROYECCION_SOCIAL_EMAIL || 'proyeccionsocial@unicesmag.edu.co').trim().toLowerCase()
});

const getReporteSalidaTemplatePath = () => {
  const configured = String(process.env.REPORTE_SALIDA_TEMPLATE_PATH || '').trim();
  return configured ? path.resolve(configured) : '';
};

const normalizeText = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const isReporteSalidaDocumento = (documento) => {
  const codigo = normalizeText(documento?.codigo);
  const titulo = normalizeText(documento?.titulo);
  return codigo === REPORT_DOCUMENT_CODE && titulo.includes(REPORT_DOCUMENT_TITLE);
};

const isProyeccionSocialLeaderSolicitud = (solicitud = {}) => {
  const solicitante = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_formulario?.laboral || {};
  const email = String(solicitante.email || '').trim().toLowerCase();
  const cargo = String(laboral.cargo || solicitante.cargo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const nombre = String(solicitante.nombre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const proyeccionSocialEmail = String(process.env.REPORTE_SALIDA_PROYECCION_SOCIAL_EMAIL || 'proyeccionsocial@unicesmag.edu.co').trim().toLowerCase();

  if (email && email === proyeccionSocialEmail) return true;
  if (nombre.includes('mery')) return true;
  if (cargo.includes('coordinador') && cargo.includes('proyeccion social')) return true;

  return false;
};

module.exports = {
  REPORT_DOCUMENT_CODE,
  REPORT_DOCUMENT_TITLE,
  getReporteSalidaRecipients,
  getReporteSalidaFeatureState,
  getReporteSalidaTemplatePath,
  isReporteSalidaDocumento,
  isReporteSalidaEnabled,
  isProyeccionSocialLeaderSolicitud,
  setReporteSalidaFeatureState
};
