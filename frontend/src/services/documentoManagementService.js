import api from './api';

const documentoManagementService = {
  // Listar documentos
  getDocumentos: async (params = {}) => {
    const response = await api.get('/management/documentos', { params });
    return response.data;
  },

  // Obtener un documento
  getDocumento: async (id) => {
    const response = await api.get(`/management/documentos/${id}`);
    return response.data;
  },

  // Crear documento
  createDocumento: async (formData) => {
    const response = await api.post('/management/documentos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Actualizar documento
  updateDocumento: async (id, formData) => {
    const response = await api.put(`/management/documentos/${id}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  // Eliminar documento
  deleteDocumento: async (id) => {
    const response = await api.delete(`/management/documentos/${id}`);
    return response.data;
  },

  // Restaurar documento
  restoreDocumento: async (id) => {
    const response = await api.post(`/management/documentos/${id}/restore`);
    return response.data;
  },

  // Descargar documento
  downloadDocumento: async (id) => {
    const response = await api.get(`/management/documentos/${id}/download`, {
      responseType: 'blob'
    });
    return response.data;
  }
};

export default documentoManagementService;