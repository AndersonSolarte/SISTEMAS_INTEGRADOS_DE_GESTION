import api from './api';

const freshRequest = (params = {}) => ({
  params: { ...params, _ts: Date.now() },
  timeout: 60000,
  headers: {
    'Cache-Control': 'no-cache',
    Pragma: 'no-cache',
    Expires: '0'
  }
});

const catalogoService = {
  getMacroProcesos: async () => (await api.get('/macro-procesos', freshRequest())).data,
  getProcesos: async (macroProcesoId = null) => (await api.get('/procesos', freshRequest(macroProcesoId ? { macro_proceso_id: macroProcesoId } : {}))).data,
  getSubProcesos: async (procesoId = null) => (await api.get('/subprocesos', freshRequest(procesoId ? { proceso_id: procesoId } : {}))).data,
  getTiposDocumentacion: async (params = {}) => (await api.get('/tipos-documentacion', freshRequest(params))).data,
  getFilterOptions: async (filters = {}) => (await api.get('/filtro-opciones', freshRequest(filters))).data
};

export default catalogoService;
