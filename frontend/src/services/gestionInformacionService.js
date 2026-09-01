import api from './api';

const isNotFoundError = (error) => Number(error?.response?.status || 0) === 404;

const gestionInformacionService = {
  getEstadisticas: (params = {}) =>
    api.get('/planeacion/gestion-informacion', { params, timeout: 120000 }).then((r) => r.data),
  exportCaracterizacionRecords: (params = {}) =>
    api.get('/planeacion/gestion-informacion/caracterizacion/export', {
      params,
      responseType: 'blob',
      timeout: 120000
    }),
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
  getBackupMonitor: () =>
    api.get('/planeacion/gestion-informacion/database/backup-monitor', { timeout: 60000 }).then((r) => r.data),
  runAutomaticBackupNow: () =>
    api.post('/planeacion/gestion-informacion/database/backup-monitor/run').then((r) => r.data),
  pauseAutomaticBackups: () =>
    api.post('/planeacion/gestion-informacion/database/backup-monitor/pause').then((r) => r.data),
  resumeAutomaticBackups: () =>
    api.post('/planeacion/gestion-informacion/database/backup-monitor/resume').then((r) => r.data),
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
  cleanContextoExterno: (file, lista) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lista', lista);
    return api.post('/planeacion/gestion-informacion/contexto-externo/limpiar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      responseType: 'blob',
      timeout: 0
    });
  },
  createContextoExternoCleaningJob: (file, lista) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('lista', lista);
    return api.post('/planeacion/gestion-informacion/contexto-externo/cleaning-jobs', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 0
    }).then((r) => r.data);
  },
  getContextoExternoCleaningJobs: () =>
    api.get('/planeacion/gestion-informacion/contexto-externo/cleaning-jobs', { timeout: 60000 }).then((r) => r.data),
  downloadContextoExternoCleaningJob: (jobId) =>
    api.get(`/planeacion/gestion-informacion/contexto-externo/cleaning-jobs/${jobId}/download`, {
      responseType: 'blob',
      timeout: 0
    }),
  retryContextoExternoCleaningJob: (jobId) =>
    api.post(`/planeacion/gestion-informacion/contexto-externo/cleaning-jobs/${jobId}/retry`).then((r) => r.data),
  deleteContextoExternoCleaningJob: (jobId) =>
    api.delete(`/planeacion/gestion-informacion/contexto-externo/cleaning-jobs/${jobId}`).then((r) => r.data),
  approveContextoExternoReview: (reviewId) =>
    api.post(`/planeacion/gestion-informacion/contexto-externo/reviews/${reviewId}/approve`).then((r) => r.data),
  rejectContextoExternoReview: (reviewId) =>
    api.delete(`/planeacion/gestion-informacion/contexto-externo/reviews/${reviewId}`).then((r) => r.data),
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
  getPesvParqueaderos: (params = {}) =>
    api.get('/pesv/parqueaderos', { params, timeout: 60000 }).then((r) => r.data),
  lookupPesvPersona: (identificacion) =>
    api.get('/pesv/parqueaderos/lookup-persona', { params: { identificacion } }).then((r) => r.data),
  createPesvParqueadero: (payload) =>
    api.post('/pesv/parqueaderos', payload).then((r) => r.data),
  updatePesvParqueadero: (id, payload) =>
    api.put(`/pesv/parqueaderos/${id}`, payload).then((r) => r.data),
  reactivatePesvParqueadero: (id) =>
    api.put(`/pesv/parqueaderos/${id}/reactivate`).then((r) => r.data),
  deletePesvParqueadero: (id) =>
    api.delete(`/pesv/parqueaderos/${id}`).then((r) => r.data),
  importPesvParqueaderos: (file, replace = true) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('replace', String(replace));
    return api.post('/pesv/parqueaderos/import', formData, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 }).then((r) => r.data);
  },
  downloadPesvParqueaderosTemplate: () =>
    api.get('/pesv/parqueaderos/template', { responseType: 'blob', timeout: 60000 }).then((r) => r),
  exportPesvParqueaderos: (params = {}) =>
    api.get('/pesv/parqueaderos/export', { params, responseType: 'blob', timeout: 60000 }).then((r) => r),
  notifyPesvExpiry: (id, tipo = 'soat', force = false) =>
    api.post(`/pesv/parqueaderos/${id}/notificar`, { tipo, force }).then((r) => r.data),
  startPesvRuntValidation: (id) =>
    api.post(`/pesv/parqueaderos/${id}/runt/session`).then((r) => r.data),
  getPesvRuntValidation: (sessionId) =>
    api.get(`/pesv/parqueaderos/runt/sessions/${sessionId}`, { timeout: 30000 }).then((r) => r.data),
  capturePesvRuntManual: (sessionId, payload) =>
    api.post(`/pesv/parqueaderos/runt/sessions/${sessionId}/capture-manual`, payload).then((r) => r.data),
  confirmPesvRuntValidation: (sessionId) =>
    api.post(`/pesv/parqueaderos/runt/sessions/${sessionId}/confirm`).then((r) => r.data),
  notifyPesvRuntUpdate: (sessionId) =>
    api.post(`/pesv/parqueaderos/runt/sessions/${sessionId}/notificar-actualizacion`).then((r) => r.data),
  getPesvRuntHistory: (id) =>
    api.get(`/pesv/parqueaderos/${id}/runt/history`, { timeout: 30000 }).then((r) => r.data),
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
