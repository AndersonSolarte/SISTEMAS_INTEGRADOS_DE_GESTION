import api from './api';

const favoritoService = {
  getFavorites: async () => {
    const response = await api.get('/favoritos');
    return response.data;
  },
  getFavoriteIds: async () => {
    const response = await api.get('/favoritos/ids');
    return response.data;
  },
  addFavorite: async (documentoId) => {
    const response = await api.post(`/favoritos/${documentoId}`);
    return response.data;
  },
  removeFavorite: async (documentoId) => {
    const response = await api.delete(`/favoritos/${documentoId}`);
    return response.data;
  }
};

export default favoritoService;
