import api from './api';

export const getEstadoLegalizacion = () => api.get('/legalizacion-viaticos/estado-propio').then((response) => response.data);
export const getMisLegalizaciones = () => api.get('/legalizacion-viaticos/mis-legalizaciones').then((response) => response.data);
export const presentarLegalizacion = (id, formData) => api.post(`/legalizacion-viaticos/${id}/presentar`, formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }).then((response) => response.data);
export const getSolicitudesViaticos = (params = {}) => api.get('/legalizacion-viaticos/gestion/solicitudes', { params }).then((response) => response.data);
export const getSolicitudViaticos = (id) => api.get(`/legalizacion-viaticos/gestion/solicitudes/${id}`).then((response) => response.data);
export const validarLegalizacion = (id, payload) => api.post(`/legalizacion-viaticos/gestion/${id}/validar`, payload, { timeout: 120000 }).then((response) => response.data);
export const getEstadisticasViaticos = () => api.get('/legalizacion-viaticos/estadisticas/resumen').then((response) => response.data);
export const getAccionAdministrativaViaticos = (id) => api.post(`/desplazamientos-viaticos/solicitudes/${id}/accion-admin`).then((response) => response.data);
export const reenviarAprobacionViaticos = (id) => api.post(`/desplazamientos-viaticos/solicitudes/${id}/reenviar-aprobacion`).then((response) => response.data);
export const reenviarDocumentosFinalesViaticos = (id) => api.post(`/desplazamientos-viaticos/solicitudes/${id}/reenviar-documentos-finales`, {}, { timeout: 120000 }).then((response) => response.data);
export const getAccionAdministrativaViaticosPorReporte = (reporteId) => api.post(`/desplazamientos-viaticos/solicitudes/reporte/${reporteId}/accion-admin`).then((response) => response.data);
export const attachmentUrl = (legalizacionId, fileId) => `${api.defaults.baseURL}/legalizacion-viaticos/${legalizacionId}/adjuntos/${fileId}`;
export const legalizacionPdfUrl = (legalizacionId) => `${api.defaults.baseURL}/legalizacion-viaticos/${legalizacionId}/pdf`;
const openBlob = async (request) => {
  const popup = window.open('about:blank', '_blank');
  try {
    const response = await request;
    const url = URL.createObjectURL(response.data);
    if (popup) { popup.opener = null; popup.location.href = url; }
    else window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (error) {
    if (popup) popup.close();
    throw error;
  }
};
export const abrirFormatoViaticos = (id) => openBlob(api.get(`/desplazamientos-viaticos/solicitudes/${id}/formato.pdf`, { responseType: 'blob', timeout: 60000 }));
export const abrirSoporteSolicitudViaticos = (id) => openBlob(api.get(`/desplazamientos-viaticos/solicitudes/${id}/soporte`, { responseType: 'blob', timeout: 60000 }));
export const abrirReporteSalidaViaticos = (reporteId) => openBlob(api.get(`/reporte-salida/solicitudes/${reporteId}/documento-temporal`, { responseType: 'blob', timeout: 60000 }));
export const actualizarSolicitudViaticosAdmin = (id, payload) => api.put(`/desplazamientos-viaticos/solicitudes/${id}/admin`, payload).then((response) => response.data);
export const eliminarSolicitudViaticosAdmin = (reporteId, observacion) => api.delete(`/reporte-salida/solicitudes/${reporteId}`, { data: { observacion, origen: 'panel_viaticos' } }).then((response) => response.data);
export const abrirAdjuntoLegalizacion = async (legalizacionId, fileId) => {
  const response = await api.get(`/legalizacion-viaticos/${legalizacionId}/adjuntos/${fileId}`, { responseType: 'blob', timeout: 60000 });
  const url = URL.createObjectURL(response.data);
  window.open(url, '_blank', 'noopener,noreferrer');
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
};
