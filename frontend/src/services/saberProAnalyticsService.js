import api from './api';

const saberProAnalyticsService = {
  getFiltros: () => api.get('/planeacion/gestion-informacion/saber-pro/filtros').then((r) => r.data),
  getFiltrosCascade: (filters = {}) => api.post('/planeacion/gestion-informacion/saber-pro/filtros/cascade', { filters }).then((r) => r.data),
  getOverview: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/overview', { filters }).then((r) => r.data),
  getCharts: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/charts', { filters }).then((r) => r.data),
  getTable: ({ filters = {}, pagination = { page: 1, pageSize: 20 }, sort = [{ field: 'puntaje_global', direction: 'desc' }] } = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/table', { filters, pagination, sort }).then((r) => r.data),
  getControlChart: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/control-chart', { filters }).then((r) => r.data),
  getValueAddedIndividual: ({ filters = {}, pagination = { page: 1, pageSize: 20 }, sort = [{ field: 'anio', direction: 'desc' }] } = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/value-added/individual', { filters, pagination, sort }).then((r) => r.data),
  getValueAddedGeneral: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/value-added/general', { filters }).then((r) => r.data),
  getValueAddedStats: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/value-added/stats', { filters }).then((r) => r.data),
  getValueAddedNbc: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/value-added/nbc', { filters }).then((r) => r.data),
  getResultadosNbc: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/nbc', { filters }).then((r) => r.data),
  getResultadosNbcDetalle: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/nbc/detalle', { filters }).then((r) => r.data),
  getResultadosProgramas: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/programas', { filters }).then((r) => r.data),
  getResultadosProgramaDetalle: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/programas/detalle', { filters }).then((r) => r.data),
  getResultadosInstitucional: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/institucional', { filters }).then((r) => r.data),
  getResultadosDestacados: ({ filters = {}, pagination = { page: 1, pageSize: 50 } } = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/destacados', { filters, pagination }).then((r) => r.data),
  getResultadosComparativaS11Spr: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/comparativa-s11-spr', { filters }, { timeout: 60000 }).then((r) => r.data),
  getDocumentosEstudiantes: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/documentos-estudiantes', { filters }).then((r) => r.data),
  getComparativaEstudianteDetalle: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/resultados/comparativa-estudiante', { filters }, { timeout: 30000 }).then((r) => r.data)
};

export default saberProAnalyticsService;
