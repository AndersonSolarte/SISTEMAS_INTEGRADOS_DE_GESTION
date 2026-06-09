export const REPORTE_SALIDA_ENABLED = String(process.env.REACT_APP_ENABLE_REPORTE_SALIDA_FORM || '').toLowerCase() === 'true';

export const REPORTE_SALIDA_DOCUMENT_CODE = 'THM-DP-FR-002';

const normalize = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

export const isReporteSalidaDocument = (doc) => {
  const codigo = normalize(doc?.codigo);
  const titulo = normalize(doc?.titulo);
  return codigo === REPORTE_SALIDA_DOCUMENT_CODE && titulo.includes('REPORTE DE SALIDA');
};
