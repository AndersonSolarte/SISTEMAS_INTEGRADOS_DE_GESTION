import api from './api';

const documentoService = {
  getDocumentos: async (filters = {}, page = 1, limit = 10) => {
    const response = await api.get('/documentos', { params: { ...filters, page, limit } });
    return response.data;
  }
};

export default documentoService;