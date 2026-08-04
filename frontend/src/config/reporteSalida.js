export const REPORTE_SALIDA_ENABLED = String(process.env.REACT_APP_ENABLE_REPORTE_SALIDA_FORM || '').toLowerCase() === 'true';

// El desarrollo de viáticos permanece instalado, pero oculto hasta que la
// Universidad autorice su publicación. Debe habilitarse explícitamente en el
// entorno de compilación con REACT_APP_ENABLE_DESPLAZAMIENTO_VIATICOS=true.
export const DESPLAZAMIENTO_VIATICOS_ENABLED = String(
  process.env.REACT_APP_ENABLE_DESPLAZAMIENTO_VIATICOS || ''
).toLowerCase() === 'true';

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
