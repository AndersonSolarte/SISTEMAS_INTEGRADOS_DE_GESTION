import api from './api';

const isNotFoundError = (error) => Number(error?.response?.status || 0) === 404;

const gestionInformacionService = {
  getEstadisticas: (params = {}) =>
    api.get('/planeacion/gestion-informacion', { params, timeout: 120000 }).then((r) => r.data),
  getResumen: (params = {}) =>
    api.get('/planeacion/gestion-informacion/resumen', { params, timeout: 60000 }).then((r) => r.data),
  getCargues: (params = {}) =>
    api.get('/planeacion/gestion-informacion/cargues', { params, timeout: 60000 }).then((r) => r.data),
  getPlanAccionDashboard: () =>
    api.get('/planeacion/gestion-informacion', {
      params: { aggregate: 'plan_accion_dashboard', categoria: 'Plan de Acción' },
      timeout: 120000
    }).then((r) => r.data),
  downloadTemplate: (categoria, subcategoria = '', subsubcategoria = '') =>
    api.get('/planeacion/gestion-informacion/template', {
      params: { categoria, subcategoria, subsubcategoria, _ts: Date.now() },
      responseType: 'blob'
    }),
  downloadContextoExternoNormalizado: (variable) =>
    api.get('/planeacion/gestion-informacion/contexto-externo/export', {
      params: { categoria: 'poblacional', subcategoria: 'Contexto Externo', variable },
      responseType: 'blob',
      timeout: 0
    }),
  downloadCargueErrores: (params = {}) =>
    api.get('/planeacion/gestion-informacion/cargues/errors/export', { params, responseType: 'blob', timeout: 0 }),
  downloadCargueBase: (params = {}) =>
    api.get('/planeacion/gestion-informacion/cargues/base/export', { params, responseType: 'blob', timeout: 0 }),
  getMatriculadosGeoDashboard: (params = {}) =>
    api.get('/planeacion/gestion-informacion', {
      params: { categoria: 'Poblacional', aggregate: 'matriculados_geo_dashboard', ...params },
      timeout: 120000
    }).then((r) => r.data),
  getMatriculadosIncidencias: async (params = {}) => {
    try {
      const response = await api.get('/planeacion/gestion-informacion/matriculados-incidencias', { params, timeout: 60000 });
      return response.data;
    } catch (error) {
      if (!isNotFoundError(error)) throw error;
      const fallback = await api.get('/planeacion/gestion-informacion/divipola/incidencias', { params, timeout: 60000 });
      return fallback.data;
    }
  },
  resolveMatriculadosIncidencia: (id, payload = {}) =>
    api.put(`/planeacion/gestion-informacion/divipola/incidencias/${id}`, payload).then((r) => r.data),
  importExcel: (categoria, file, subcategoria = '', subsubcategoria = '') => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('categoria', categoria);
    if (subcategoria) formData.append('subcategoria', subcategoria);
    if (subsubcategoria) formData.append('subsubcategoria', subsubcategoria);
    return api
      .post('/planeacion/gestion-informacion/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 0
      })
      .then((r) => r.data);
  },
  clearCategoria: (categoria, subcategoria = '', subsubcategoria = '', credentials = {}) =>
    api.delete('/planeacion/gestion-informacion/clear', { data: { categoria, subcategoria, subsubcategoria, ...credentials } }).then((r) => r.data),
  exportPlanAccionPlantilla: (payload) =>
    api.post('/planeacion/gestion-informacion/plan-accion/export', payload, { responseType: 'blob', timeout: 120000 }),
  exportPlanAccionActa: (payload) =>
    api.post('/planeacion/gestion-informacion/plan-accion/acta/export', payload, { responseType: 'blob', timeout: 120000 }),
  sugerirIndicadorPlanAccion: (actividad) =>
    api.post('/planeacion/gestion-informacion/plan-accion/sugerir-indicador', { actividad }, { timeout: 180000 }).then((r) => r.data),
  createEstadistica: (payload) => api.post('/planeacion/gestion-informacion', payload).then((r) => r.data),
  updateEstadistica: (id, payload) => api.put(`/planeacion/gestion-informacion/${id}`, payload).then((r) => r.data),
  deleteEstadistica: (id) => api.delete(`/planeacion/gestion-informacion/${id}`).then((r) => r.data)
};

export default gestionInformacionService;
