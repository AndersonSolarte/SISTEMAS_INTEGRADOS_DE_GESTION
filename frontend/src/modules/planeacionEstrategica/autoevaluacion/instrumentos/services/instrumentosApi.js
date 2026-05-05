import api from '../../../../../services/api';

const unwrap = (response) => response.data;

const instrumentosApi = {
  dashboard: () => api.get('/autoevaluacion/instrumentos/dashboard').then(unwrap),
  list: (params = {}) => api.get('/autoevaluacion/instrumentos', { params }).then(unwrap),
  get: (id) => api.get(`/autoevaluacion/instrumentos/${id}`).then(unwrap),
  preview: (id) => api.get(`/autoevaluacion/instrumentos/${id}/preview`).then(unwrap),
  create: (payload) => api.post('/autoevaluacion/instrumentos', payload).then(unwrap),
  update: (id, payload) => api.put(`/autoevaluacion/instrumentos/${id}`, payload).then(unwrap),
  publish: (id) => api.post(`/autoevaluacion/instrumentos/${id}/publish`).then(unwrap),
  close: (id) => api.post(`/autoevaluacion/instrumentos/${id}/close`).then(unwrap),
  archive: (id) => api.post(`/autoevaluacion/instrumentos/${id}/archive`).then(unwrap),
  delete: (id) => api.delete(`/autoevaluacion/instrumentos/${id}`).then(unwrap),
  restore: (id) => api.post(`/autoevaluacion/instrumentos/${id}/restore`).then(unwrap),
  duplicate: (id) => api.post(`/autoevaluacion/instrumentos/${id}/duplicate`).then(unwrap),
  results: (id) => api.get(`/autoevaluacion/instrumentos/${id}/results`).then(unwrap),
  statistics: (id) => api.get(`/autoevaluacion/instrumentos/${id}/statistics`).then(unwrap),
  qr: (id) => api.get(`/autoevaluacion/instrumentos/${id}/qr`).then(unwrap),
  questionBank: (params = {}) => api.get('/autoevaluacion/instrumentos/question-bank', { params }).then(unwrap),
  createQuestionBank: (payload) => api.post('/autoevaluacion/instrumentos/question-bank', payload).then(unwrap),
  publicGet: (code) => api.get(`/public/instrumentos/${code}`).then(unwrap),
  publicSubmit: (code, payload) => api.post(`/public/instrumentos/${code}/responses`, payload).then(unwrap)
};

export default instrumentosApi;
