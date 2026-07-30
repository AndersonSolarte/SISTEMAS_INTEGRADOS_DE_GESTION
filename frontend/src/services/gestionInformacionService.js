import api from './api';

const isNotFoundError = (error) => Number(error?.response?.status || 0) === 404;

const gestionInformacionService = {
  getEstadisticas: (params = {}) =>
    api.get('/planeacion/gestion-informacion', { params, timeout: 120000 }).then((r) => r.data),
  getResumen: (params = {}) =>
    api.get('/planeacion/gestion-informacion/resumen', { params, timeout: 60000 }).then((r) => r.data),
  getCargues: (params = {}) =>
    api.get('/planeacion/gestion-informacion/cargues', { params, timeout: 60000 }).then((r) => r.data),
  getDatabaseHealth: () =>
    api.get('/planeacion/gestion-informacion/database/health', { timeout: 60000 }).then((r) => r.data),
  getSystemTablesCatalog: () =>
    api.get('/planeacion/gestion-informacion/database/tables-catalog', { timeout: 60000 }).then((r) => r.data),
  exportTableData: (table, format = 'csv') =>
    api.get('/planeacion/gestion-informacion/database/export-table', {
      params: { table, format }, responseType: 'blob', timeout: 0
    }),
  downloadDatabaseDump: (credentials) =>
    api.post('/planeacion/gestion-informacion/database/backup-dump', credentials, { responseType: 'blob', timeout: 0 }),
  restoreDatabaseDump: (file, credentials) => {
    const formData = new FormData();
    formData.append('backup', file);
    formData.append('googleCredential', credentials.googleCredential);
    formData.append('turnstileToken', credentials.turnstileToken);
    return api.post('/planeacion/gestion-informacion/database/restore-dump', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }, timeout: 0
    }).then((response) => response.data);
  },
  getPlanAccionDashboard: () =>
    api.get('/planeacion/gestion-informacion', {
      params: { aggregate: 'plan_accion_dashboard', categoria: 'Plan de Acción', _ts: Date.now() },
      timeout: 120000
    }).then((r) => r.data),
  getAutoevaluacionDashboard: (params = {}) =>
    api.get('/planeacion/gestion-informacion', {
      params: { aggregate: 'autoevaluacion_dashboard', categoria: 'Autoevaluación', ...params },
      timeout: 120000
    }).then((r) => r.data),
  getRegistrosCalificadosDashboard: (params = {}) =>
    api.get('/planeacion/gestion-informacion', {
      params: { aggregate: 'registros_calificados_dashboard', categoria: 'Registros Calificados y Acreditacion', ...params },
      timeout: 120000
    }).then((r) => r.data),
  getRegistrosCalificadosEvidencias: (id) =>
    api.get(`/planeacion/gestion-informacion/registros-calificados/${id}/evidencias`, { timeout: 60000 }).then((r) => r.data),
  updateAutoevaluacionAspecto: (id, payload) =>
    api.put(`/planeacion/gestion-informacion/autoevaluacion/aspectos/${id}`, payload).then((r) => r.data),
  createAutoevaluacionParticipante: (payload) =>
    api.post('/planeacion/gestion-informacion/autoevaluacion/participantes', payload).then((r) => r.data),
  updateAutoevaluacionParticipante: (id, payload) =>
    api.put(`/planeacion/gestion-informacion/autoevaluacion/participantes/${id}`, payload).then((r) => r.data),
  deleteAutoevaluacionParticipante: (id) =>
    api.delete(`/planeacion/gestion-informacion/autoevaluacion/participantes/${id}`).then((r) => r.data),
  createAutoevaluacionPrograma: (payload) =>
    api.post('/planeacion/gestion-informacion/autoevaluacion/programas', payload).then((r) => r.data),
  updateAutoevaluacionPrograma: (id, payload) =>
    api.put(`/planeacion/gestion-informacion/autoevaluacion/programas/${id}`, payload).then((r) => r.data),
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
  getMovilidadDashboard: (params = {}) =>
    api.get('/planeacion/gestion-informacion', {
      params: { aggregate: 'movilidad_dashboard', ...params },
      timeout: 60000
    }).then((r) => r.data),
  getConveniosDashboard: (params = {}) =>
    api.get('/planeacion/gestion-informacion', {
      params: { aggregate: 'convenios_dashboard', ...params },
      timeout: 60000
    }).then((r) => r.data),
  getEvidenciasDrive: (folderUrl) =>
    api.get('/evidencias', { params: { folderUrl }, timeout: 60000 }).then((r) => r.data),
  createEstadistica: (payload) => api.post('/planeacion/gestion-informacion', payload).then((r) => r.data),
  updateEstadistica: (id, payload) => api.put(`/planeacion/gestion-informacion/${id}`, payload).then((r) => r.data),
  deleteEstadistica: (id) => api.delete(`/planeacion/gestion-informacion/${id}`).then((r) => r.data),
  getInfraestructuras: (params = {}) =>
    api.get('/planeacion/gestion-informacion/infraestructura', { params, timeout: 60000 }).then((r) => r.data),
  createInfraestructura: (payload) =>
    api.post('/planeacion/gestion-informacion/infraestructura', payload).then((r) => r.data),
  updateInfraestructura: (id, payload) =>
    api.put(`/planeacion/gestion-informacion/infraestructura/${id}`, payload).then((r) => r.data),
  deleteInfraestructura: (id) =>
    api.delete(`/planeacion/gestion-informacion/infraestructura/${id}`).then((r) => r.data),
  uploadInfraestructuraTemplate: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/planeacion/gestion-informacion/infraestructura/upload-template', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000
    }).then((r) => r.data);
  },
  getEdificacionesReferencia: () =>
    api.get('/planeacion/gestion-informacion/infraestructura/edificaciones-referencia', { timeout: 60000 }).then((r) => r.data),
  createEdificacionReferencia: (payload) =>
    api.post('/planeacion/gestion-informacion/infraestructura/edificaciones-referencia', payload).then((r) => r.data),
  updateEdificacionReferencia: (id, payload) =>
    api.put(`/planeacion/gestion-informacion/infraestructura/edificaciones-referencia/${id}`, payload).then((r) => r.data),
  deleteEdificacionReferencia: (id) =>
    api.delete(`/planeacion/gestion-informacion/infraestructura/edificaciones-referencia/${id}`).then((r) => r.data),
  uploadAuditorioFoto: (groupKey, file) => {
    const formData = new FormData();
    formData.append('groupKey', groupKey);
    formData.append('foto', file);
    return api.post('/planeacion/gestion-informacion/infraestructura/auditorios/foto', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }).then((r) => r.data);
  }
};

export default gestionInformacionService;
