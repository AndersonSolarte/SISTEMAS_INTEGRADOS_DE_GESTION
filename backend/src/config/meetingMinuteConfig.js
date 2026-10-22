const SETTING_KEY = 'digital_meeting_minute_form';

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const MEETING_MINUTE_FORMATS = {
  'COM-ID-FR-002': {
    code: 'COM-ID-FR-002',
    codes: ['COM-ID-FR-002', 'COM-IF-FR-002'],
    title: 'REGISTRO DE ASISTENCIA Y REUNIÓN',
    normalizedTitleMatch: 'REGISTRO DE ASISTENCIA Y REUNION',
    label: 'COM-ID-FR-002 – Registro de Asistencia y Reunión',
    shortLabel: 'Registro de Asistencia y Reunión',
    version: '2',
    dateLabel: '18/SEP/2026',
    consecutivePrefix: 'ACTA'
  },
  'COM-GD-FR-012': {
    code: 'COM-GD-FR-012',
    codes: ['COM-GD-FR-012'],
    title: 'ACTA DE REUNIÓN CONSEJOS Y COMITÉS',
    normalizedTitleMatch: 'ACTA DE REUNION CONSEJOS Y COMITES',
    label: 'COM-GD-FR-012 – Acta de Reunión Consejos y Comités',
    shortLabel: 'Acta de Reunión Consejos y Comités',
    version: '2',
    dateLabel: '15/SEP/2023',
    consecutivePrefix: 'ACTA-CC'
  }
};

const isAttendanceMeetingMinuteDocument = (document) => {
  const code = normalize(document?.codigo);
  const title = normalize(document?.titulo);
  return ['COM-ID-FR-002', 'COM-IF-FR-002'].includes(code)
    && (!title || title.includes('REGISTRO DE ASISTENCIA Y REUNION'));
};

const isCouncilMeetingMinuteDocument = (document) => {
  const code = normalize(document?.codigo);
  const title = normalize(document?.titulo);
  return code === 'COM-GD-FR-012'
    && (!title || title.includes('ACTA DE REUNION CONSEJOS Y COMITES') || title.includes('CONSEJOS Y COMITES'));
};

const isMeetingMinuteDocument = (document) => (
  isAttendanceMeetingMinuteDocument(document) || isCouncilMeetingMinuteDocument(document)
);

const resolveMeetingMinuteFormatCode = (input) => {
  if (!input) return 'COM-ID-FR-002';
  if (typeof input === 'string') {
    const clean = normalize(input);
    if (clean === 'COM-GD-FR-012' || clean.includes('CONSEJOS Y COMITES')) return 'COM-GD-FR-012';
    return 'COM-ID-FR-002';
  }
  const explicitFormat = normalize(
    input?.format_code
    || input?.content?.format_code
    || input?.document?.codigo
    || input?.codigo
  );
  if (explicitFormat === 'COM-GD-FR-012') return 'COM-GD-FR-012';
  if (isCouncilMeetingMinuteDocument(input?.document || input)) return 'COM-GD-FR-012';
  return 'COM-ID-FR-002';
};

const getMeetingMinuteFormatMeta = (input) => {
  const code = resolveMeetingMinuteFormatCode(input);
  return MEETING_MINUTE_FORMATS[code] || MEETING_MINUTE_FORMATS['COM-ID-FR-002'];
};

// Estado por formato. `enabled` se conserva por compatibilidad y corresponde
// al formato original COM-ID-FR-002. Los formatos nuevos inician desactivados
// hasta que el administrador los habilite desde Consulta de Documentos.
const readSettingValue = async () => {
  const { SystemSetting } = require('../models');
  const setting = await SystemSetting.findByPk(SETTING_KEY);
  return setting?.value || {};
};

const getMeetingMinuteFormatStates = async () => {
  const value = await readSettingValue();
  const legacyEnabled = Object.prototype.hasOwnProperty.call(value, 'enabled')
    ? Boolean(value.enabled)
    : String(process.env.ENABLE_DIGITAL_MEETING_MINUTE_FORM || '').trim().toLowerCase() === 'true';
  const stored = value.formats && typeof value.formats === 'object' ? value.formats : {};
  return {
    'COM-ID-FR-002': Object.prototype.hasOwnProperty.call(stored, 'COM-ID-FR-002') ? Boolean(stored['COM-ID-FR-002']) : legacyEnabled,
    'COM-GD-FR-012': Boolean(stored['COM-GD-FR-012'])
  };
};

const isMeetingMinuteFormatEnabled = async (formatCode) => {
  const states = await getMeetingMinuteFormatStates();
  return Boolean(states[resolveMeetingMinuteFormatCode(formatCode)]);
};

const getMeetingMinuteFeatureState = async () => (await getMeetingMinuteFormatStates())['COM-ID-FR-002'];

const setMeetingMinuteFormatState = async (formatCode, enabled, userId = null) => {
  const { SystemSetting } = require('../models');
  const code = resolveMeetingMinuteFormatCode(formatCode);
  const states = await getMeetingMinuteFormatStates();
  states[code] = Boolean(enabled);
  const value = { enabled: states['COM-ID-FR-002'], formats: states };
  const [setting] = await SystemSetting.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: { value, updated_by: userId }
  });
  await setting.update({ value, updated_by: userId });
  return states;
};

const setMeetingMinuteFeatureState = async (enabled, userId = null) => {
  const states = await setMeetingMinuteFormatState('COM-ID-FR-002', enabled, userId);
  return states['COM-ID-FR-002'];
};

module.exports = {
  MEETING_MINUTE_FORMATS,
  getMeetingMinuteFeatureState,
  getMeetingMinuteFormatMeta,
  getMeetingMinuteFormatStates,
  isAttendanceMeetingMinuteDocument,
  isCouncilMeetingMinuteDocument,
  isMeetingMinuteDocument,
  isMeetingMinuteFormatEnabled,
  resolveMeetingMinuteFormatCode,
  setMeetingMinuteFeatureState,
  setMeetingMinuteFormatState
};
