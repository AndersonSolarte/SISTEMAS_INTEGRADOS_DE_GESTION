const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

export const isMeetingMinuteDocument = (document) => {
  const code = normalize(document?.codigo);
  const title = normalize(document?.titulo);
  return ['COM-ID-FR-002', 'COM-IF-FR-002'].includes(code) && title.includes('REGISTRO DE ASISTENCIA Y REUNION');
};
