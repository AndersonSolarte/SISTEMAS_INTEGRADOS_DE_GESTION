import api from './api';

const catalogoService = {
  getMacroProcesos: async () => (await api.get('/macro-procesos')).data,
  getProcesos: async (macroProcesoId = null) => (await api.get('/procesos', { params: macroProcesoId ? { macro_proceso_id: macroProcesoId } : {} })).data,
  getSubProcesos: async (procesoId = null) => (await api.get('/subprocesos', { params: procesoId ? { proceso_id: procesoId } : {} })).data,
  getTiposDocumentacion: async () => (await api.get('/tipos-documentacion')).data
};

export default catalogoService;