import api from './api';

const saberProAnalyticsService = {
  getFiltros: () => api.get('/planeacion/gestion-informacion/saber-pro/filtros').then((r) => r.data),
  getOverview: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/overview', { filters }).then((r) => r.data),
  getCharts: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/charts', { filters }).then((r) => r.data),
  getTable: ({ filters = {}, pagination = { page: 1, pageSize: 20 }, sort = [{ field: 'puntaje_global', direction: 'desc' }] } = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/table', { filters, pagination, sort }).then((r) => r.data),
  getControlChart: (filters = {}) =>
    api.post('/planeacion/gestion-informacion/saber-pro/control-chart', { filters }).then((r) => r.data)
};

export default saberProAnalyticsService;
