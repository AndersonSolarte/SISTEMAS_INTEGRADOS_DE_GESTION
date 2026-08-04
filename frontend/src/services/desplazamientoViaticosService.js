import api from './api';

const desplazamientoViaticosService = {
  radicarSolicitud: async (payload) => {
    const response = await api.post('/desplazamientos-viaticos/solicitudes', payload, { timeout: 60000 });
    return response.data;
  },

  uploadAdjunto: async (formData) => {
    const response = await api.post('/desplazamientos-viaticos/adjuntos', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return response.data;
  },

  descargarFormato: async (id) => {
    const response = await api.get(`/desplazamientos-viaticos/solicitudes/${id}/formato`, { responseType: 'blob' });
    return response.data;
  },

  descargarPdf: async (id) => {
    const response = await api.get(`/desplazamientos-viaticos/solicitudes/${id}/formato.pdf`, { responseType: 'blob' });
    return response.data;
  }
};

export default desplazamientoViaticosService;
