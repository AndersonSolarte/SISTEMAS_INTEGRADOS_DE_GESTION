import api from './api';

const oficinaJuridicaService = {
  getProfile: () => api.get('/oficina-juridica/perfil').then((r) => r.data),
  list: (params = {}) => api.get('/oficina-juridica/casos', { params }).then((r) => r.data),
  get: (id) => api.get(`/oficina-juridica/casos/${id}`).then((r) => r.data),
  create: (payload) => api.post('/oficina-juridica/casos', payload).then((r) => r.data),
  update: (id, payload) => api.patch(`/oficina-juridica/casos/${id}`, payload).then((r) => r.data),
  assign: (id, payload) => api.post(`/oficina-juridica/casos/${id}/asignar`, payload).then((r) => r.data),
  vistoBueno: (id, payload = {}) => api.post(`/oficina-juridica/casos/${id}/visto-bueno`, payload).then((r) => r.data),
  transition: (id, payload) => api.post(`/oficina-juridica/casos/${id}/transicion`, payload).then((r) => r.data),
  stats: (params = {}) => api.get('/oficina-juridica/estadisticas', { params }).then((r) => r.data),
  upload: (id, file, tipo = 'soporte') => {
    const data = new FormData();
    data.append('archivo', file);
    data.append('tipo', tipo);
    return api.post(`/oficina-juridica/casos/${id}/adjuntos`, data, { headers: { 'Content-Type': 'multipart/form-data' } }).then((r) => r.data);
  },
  importExcel: (file) => {
    const data = new FormData();
    data.append('archivo', file);
    return api.post('/oficina-juridica/importar', data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 180000 }).then((r) => r.data);
  },
  downloadExcel: () => api.get('/oficina-juridica/exportar', { responseType: 'blob', timeout: 180000 }),
  downloadAttachment: (id) => api.get(`/oficina-juridica/adjuntos/${id}`, { responseType: 'blob' })
};

export default oficinaJuridicaService;
