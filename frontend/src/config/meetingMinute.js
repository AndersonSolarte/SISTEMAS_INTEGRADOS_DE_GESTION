const normalize = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

export const MEETING_MINUTE_FORMATS = {
  'COM-ID-FR-002': {
    code: 'COM-ID-FR-002',
    codes: ['COM-ID-FR-002', 'COM-IF-FR-002'],
    title: 'REGISTRO DE ASISTENCIA Y REUNIÓN',
    shortLabel: 'Registro de Asistencia y Reunión',
    label: 'COM-ID-FR-002 – Registro de Asistencia y Reunión',
    version: '2',
    dateLabel: '18/SEP/2026',
    defaultDocument: {
      codigo: 'COM-ID-FR-002',
      titulo: 'REGISTRO DE ASISTENCIA Y REUNION',
      version: '2',
      fecha_creacion: '2026-09-18'
    }
  },
  'COM-GD-FR-012': {
    code: 'COM-GD-FR-012',
    codes: ['COM-GD-FR-012'],
    title: 'ACTA DE REUNIÓN CONSEJOS Y COMITÉS',
    shortLabel: 'Acta de Reunión Consejos y Comités',
    label: 'COM-GD-FR-012 – Acta de Reunión Consejos y Comités',
    version: '2',
    dateLabel: '15/SEP/2023',
    defaultDocument: {
      codigo: 'COM-GD-FR-012',
      titulo: 'ACTA DE REUNIÓN CONSEJOS Y COMITÉS',
      version: '2',
      fecha_creacion: '2023-09-15'
    }
  }
};

export const MEETING_MINUTE_FORMAT_LIST = [
  MEETING_MINUTE_FORMATS['COM-ID-FR-002'],
  MEETING_MINUTE_FORMATS['COM-GD-FR-012']
];

export const isAttendanceMeetingMinuteDocument = (document) => {
  const code = normalize(document?.codigo);
  const title = normalize(document?.titulo);
  return ['COM-ID-FR-002', 'COM-IF-FR-002'].includes(code)
    && (!title || title.includes('REGISTRO DE ASISTENCIA Y REUNION'));
};

export const isCouncilMeetingMinuteDocument = (document) => {
  const code = normalize(document?.codigo);
  const title = normalize(document?.titulo);
  return code === 'COM-GD-FR-012'
    && (!title || title.includes('ACTA DE REUNION CONSEJOS Y COMITES') || title.includes('CONSEJOS Y COMITES'));
};

export const isMeetingMinuteDocument = (document) => (
  isAttendanceMeetingMinuteDocument(document) || isCouncilMeetingMinuteDocument(document)
);

export const resolveMeetingMinuteFormatCode = (input) => {
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

export const getMeetingMinuteFormatMeta = (input) => {
  const code = resolveMeetingMinuteFormatCode(input);
  return MEETING_MINUTE_FORMATS[code] || MEETING_MINUTE_FORMATS['COM-ID-FR-002'];
};
