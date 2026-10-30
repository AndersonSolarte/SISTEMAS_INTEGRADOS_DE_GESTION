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
  assignActivity: (id, uid, payload) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/asignar`, payload).then((response) => response.data),
  activityWorkflowAction: (id, uid, payload) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/flujo`, payload).then((response) => response.data),
  activityCorrectionAction: (id, uid, correctionId, payload) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/correcciones/${encodeURIComponent(correctionId)}`, payload).then((response) => response.data),
  syncAutoevaluacion: (payload = {}) => api.post('/autoevaluacion/planes-mejoramiento/sync-autoevaluacion', payload).then(unwrap),
  linkedAutoevaluacion: (programa) => api.get('/autoevaluacion/planes-mejoramiento/linked-autoevaluacion', { params: { programa } }).then(unwrap),
  unlinkAutoevaluacion: (payload) => api.post('/autoevaluacion/planes-mejoramiento/unlink-autoevaluacion', payload).then(unwrap),
  list: (params = {}) => api.get('/autoevaluacion/planes-mejoramiento', { params }).then(unwrap),
  get: (id) => api.get(`/autoevaluacion/planes-mejoramiento/${id}`).then(unwrap),
  create: (payload) => api.post('/autoevaluacion/planes-mejoramiento', payload).then(unwrap),
  update: (id, payload) => api.put(`/autoevaluacion/planes-mejoramiento/${id}`, payload).then(unwrap),
  syncDriveRepository: (id) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/repositorio-drive/sincronizar`).then(unwrap),
  getActionPlanCandidates: (id, uid) => api.get(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/planes-accion-candidatos`).then(unwrap),
  linkToActionPlan: (id, uid, payload) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/vincular-plan-accion`, payload).then(unwrap),
  unlinkFromActionPlan: (id, uid) => api.post(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/desvincular-plan-accion`).then(unwrap),
  uploadActivityEvidence: (id, uid, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/autoevaluacion/planes-mejoramiento/${id}/actividades/${encodeURIComponent(uid)}/evidencias`, formData).then(unwrap);
  },
  uploadEvidence: (id, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/autoevaluacion/planes-mejoramiento/${id}/evidencias`, formData).then(unwrap);
  },
  remove: (id) => api.delete(`/autoevaluacion/planes-mejoramiento/${id}`).then((response) => response.data),
  exportExcel: (id) => api.get(`/autoevaluacion/planes-mejoramiento/${id}/export`, {
    responseType: 'blob',
    timeout: 120000
  }),
  downloadTemplate: (programa = '') => api.get('/autoevaluacion/planes-mejoramiento/plantilla', {
    params: programa ? { programa } : {},
    responseType: 'blob'
  }),
  importExcel: (file, planId = null, programa = '') => {
    const formData = new FormData();
    formData.append('file', file);
    if (planId) formData.append('planId', planId);
    if (programa) formData.append('programa', programa);
    const url = planId
      ? `/autoevaluacion/planes-mejoramiento/${planId}/importar`
      : '/autoevaluacion/planes-mejoramiento/importar';
    return api.post(url, formData, { timeout: 180000 }).then((response) => response.data);
  }
};

export default planMejoramientoService;
