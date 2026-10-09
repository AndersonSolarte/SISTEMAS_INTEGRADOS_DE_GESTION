import api from './api';

const unwrap = (response) => response.data?.data;

const planMejoramientoService = {
  catalogs: () => api.get('/autoevaluacion/planes-mejoramiento/catalogs').then(unwrap),
  downloadTariffTemplate: () => api.get('/autoevaluacion/planes-mejoramiento/tarifas/plantilla', { responseType: 'blob' }),
  importTariffs: (file, vigencia) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('vigencia', vigencia);
    return api.post('/autoevaluacion/planes-mejoramiento/tarifas/importar', formData).then((response) => response.data);
  },
  searchResponsables: (q) => api.get('/autoevaluacion/planes-mejoramiento/responsables', { params: { q } }).then(unwrap),
  executionBadge: () => api.get('/autoevaluacion/planes-mejoramiento/ejecucion/badge').then(unwrap),
  assignPlan: (id, payload) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/asignar`, payload).then((response) => response.data),
  workflowAction: (id, payload) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/flujo`, payload).then((response) => response.data),
  syncAutoevaluacion: (payload = {}) => api.post('/autoevaluacion/planes-mejoramiento/sync-autoevaluacion', payload).then(unwrap),
  linkedAutoevaluacion: (programa) => api.get('/autoevaluacion/planes-mejoramiento/linked-autoevaluacion', { params: { programa } }).then(unwrap),
  unlinkAutoevaluacion: (payload) => api.post('/autoevaluacion/planes-mejoramiento/unlink-autoevaluacion', payload).then(unwrap),
  list: (params = {}) => api.get('/autoevaluacion/planes-mejoramiento', { params }).then(unwrap),
  get: (id) => api.get(`/autoevaluacion/planes-mejoramiento/${id}`).then(unwrap),
  create: (payload) => api.post('/autoevaluacion/planes-mejoramiento', payload).then(unwrap),
  update: (id, payload) => api.put(`/autoevaluacion/planes-mejoramiento/${id}`, payload).then(unwrap),
  uploadEvidence: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/autoevaluacion/planes-mejoramiento/${id}/evidencias`, formData).then(unwrap);
  },
  remove: (id) => api.delete(`/autoevaluacion/planes-mejoramiento/${id}`).then((response) => response.data),
  exportExcel: (id) => api.get(`/autoevaluacion/planes-mejoramiento/${id}/export`, {
    responseType: 'blob',
    timeout: 120000
  })
};

export default planMejoramientoService;
