import api from './api';

const reporteSalidaService = {
  getConfig: async () => {
    const response = await api.get('/reporte-salida/config');
    return response.data;
  },

  updateConfig: async (enabled) => {
    const response = await api.patch('/reporte-salida/config', { enabled });
    return response.data;
  },

  searchJefes: async (search = '') => {
    const response = await api.get('/reporte-salida/jefes', { params: { search } });
    return response.data;
  },

  getDependencias: async () => {
    const response = await api.get('/reporte-salida/dependencias');
    return response.data;
  },

  getCatalogoLaboral: async () => {
    const response = await api.get('/reporte-salida/catalogo-laboral');
    return response.data;
  },

  radicarSolicitud: async (payload) => {
    const response = await api.post('/reporte-salida/solicitudes', payload, { timeout: 60000 });
    return response.data;
  },

  uploadAdjunto: async (formData) => {
    const response = await api.post('/reporte-salida/upload-adjunto', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return response.data;
  },

  listarSolicitudes: async (params = {}) => {
    const response = await api.get('/reporte-salida/solicitudes', { params });
    return response.data;
  },

  getSeguimiento: async (params = {}) => {
    const response = await api.get('/reporte-salida/seguimiento', { params });
    return response.data;
  },

  getSeguimientoBadge: async () => {
    const response = await api.get('/reporte-salida/seguimiento/badge');
    return response.data;
  },

  actualizarReposicion: async (id, payload) => {
    const response = await api.patch(`/reporte-salida/solicitudes/${id}/reposicion`, payload);
    return response.data;
  }
};

export default reporteSalidaService;
