import api from './api';

const documentoService = {
  getDocumentos: async (filters = {}, page = 1, limit = 10) => {
    const response = await api.get('/documentos', { params: { ...filters, page, limit }, timeout: 60000 });
    return response.data;
  },
  getEstadisticaDocumental: async (filters = {}) => {
    const response = await api.get('/documentos/estadistica-documental', { params: filters });
    return response.data;
  }
};

export default documentoService;
