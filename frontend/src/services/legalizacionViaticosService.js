import api from './api';

export const getEstadoLegalizacion = () => api.get('/legalizacion-viaticos/estado-propio').then((response) => response.data);
export const getMisLegalizaciones = () => api.get('/legalizacion-viaticos/mis-legalizaciones').then((response) => response.data);
export const presentarLegalizacion = (id, formData) => api.post(`/legalizacion-viaticos/${id}/presentar`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }).then((response) => response.data);
export const getSolicitudesViaticos = (params = {}) => api.get('/legalizacion-viaticos/gestion/solicitudes', { params }).then((response) => response.data);
export const getSolicitudViaticos = (id) => api.get(`/legalizacion-viaticos/gestion/solicitudes/${id}`).then((response) => response.data);
export const validarLegalizacion = (id, payload) => api.post(`/legalizacion-viaticos/gestion/${id}/validar`, payload, { timeout: 120000 }).then((response) => response.data);
export const getEstadisticasViaticos = () => api.get('/legalizacion-viaticos/estadisticas/resumen').then((response) => response.data);
export const attachmentUrl = (legalizacionId, fileId) => `${api.defaults.baseURL}/legalizacion-viaticos/${legalizacionId}/adjuntos/${fileId}`;
export const legalizacionPdfUrl = (legalizacionId) => `${api.defaults.baseURL}/legalizacion-viaticos/${legalizacionId}/pdf`;
export const abrirAdjuntoLegalizacion = async (legalizacionId, fileId) => {
  const response = await api.get(`/legalizacion-viaticos/${legalizacionId}/adjuntos/${fileId}`, { responseType: 'blob', timeout: 60000 });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};
