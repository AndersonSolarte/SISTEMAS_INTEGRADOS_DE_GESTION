const SETTING_KEY = 'digital_meeting_minute_form';

const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const isMeetingMinuteDocument = (document) => {
  const code = normalize(document?.codigo);
  const title = normalize(document?.titulo);
  return ['COM-ID-FR-002', 'COM-IF-FR-002'].includes(code) && title.includes('REGISTRO DE ASISTENCIA Y REUNION');
};

const getMeetingMinuteFeatureState = async () => {
  const { SystemSetting } = require('../models');
  const setting = await SystemSetting.findByPk(SETTING_KEY);
  if (setting && Object.prototype.hasOwnProperty.call(setting.value || {}, 'enabled')) return Boolean(setting.value.enabled);
  return String(process.env.ENABLE_DIGITAL_MEETING_MINUTE_FORM || '').trim().toLowerCase() === 'true';
};

const setMeetingMinuteFeatureState = async (enabled, userId = null) => {
  const { SystemSetting } = require('../models');
  const [setting] = await SystemSetting.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: { value: { enabled: Boolean(enabled) }, updated_by: userId }
  });
  await setting.update({ value: { enabled: Boolean(enabled) }, updated_by: userId });
  return Boolean(enabled);
};

module.exports = { getMeetingMinuteFeatureState, isMeetingMinuteDocument, setMeetingMinuteFeatureState };
