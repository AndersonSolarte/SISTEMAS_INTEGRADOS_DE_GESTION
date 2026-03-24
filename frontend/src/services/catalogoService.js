import api from './api';

const catalogoService = {
  getMacroProcesos: async () => (await api.get('/macro-procesos')).data,
  getProcesos: async (macroProcesoId = null) => (await api.get('/procesos', { params: macroProcesoId ? { macro_proceso_id: macroProcesoId } : {} })).data,
  getSubProcesos: async (procesoId = null) => (await api.get('/subprocesos', { params: procesoId ? { proceso_id: procesoId } : {} })).data,
  getTiposDocumentacion: async (params = {}) => (await api.get('/tipos-documentacion', { params })).data,
  getFilterOptions: async (filters = {}) => (await api.get('/filtro-opciones', { params: filters })).data
};

export default catalogoService;
