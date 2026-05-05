import api from './api';

const BASE = '/planeacion/plan-accion-workflow';

const planAccionWorkflowService = {
  // Listado de planes visibles para el usuario actual (filtrado por rol).
  listarMisPlanes: () =>
    api.get(BASE, { params: { _ts: Date.now() }, timeout: 60000 }).then((r) => r.data),

  // Bandeja: planes pendientes de acción del usuario actual.
  listarPendientes: () =>
    api.get(`${BASE}/pendientes`, { params: { _ts: Date.now() }, timeout: 60000 }).then((r) => r.data),

  // Lista de Usuarios Consulta para el dropdown al asignar responsable.
  listarUsuariosConsulta: () =>
    api.get(`${BASE}/usuarios-consulta`, { timeout: 60000 }).then((r) => r.data),

  // Obtener un plan completo (cabecera + actividades).
  obtenerPlan: (planCodigo) =>
    api.get(`${BASE}/${encodeURIComponent(planCodigo)}`, { timeout: 60000 }).then((r) => r.data),

  // Crear nuevo plan en estado Borrador.
  // payload: { anio, dependencia, ped?, cabecera_plan?, actividades? }
  crearPlan: (payload) =>
    api.post(BASE, payload, { timeout: 60000 }).then((r) => r.data),

  // Guardar/editar contenido del plan (DELETE+INSERT atómico en backend).
  // payload: { cabecera_plan, actividades }
  guardarPlan: (planCodigo, payload) =>
    api.put(`${BASE}/${encodeURIComponent(planCodigo)}`, payload, { timeout: 60000 }).then((r) => r.data),

  // Cambiar de estado.
  // accion ∈ { enviar_a_estrategica, marcar_revisado_estrategica, enviar_a_responsable, marcar_revisado_responsable, aprobar }
  // body: { accion, responsable_id? }
  transicionar: (planCodigo, body) =>
    api.post(`${BASE}/${encodeURIComponent(planCodigo)}/transicion`, body, { timeout: 60000 }).then((r) => r.data),

  // Soft-delete (solo PyE/Admin, solo en Borrador).
  eliminarPlan: (planCodigo) =>
    api.delete(`${BASE}/${encodeURIComponent(planCodigo)}`, { timeout: 60000 }).then((r) => r.data),

  // Conteo de pendientes según rol (para el sidebar dinámico).
  obtenerBadge: () =>
    api.get(`${BASE}/badge`, { timeout: 30000 }).then((r) => r.data),

  // Guardar cumplimiento personal del Consulta sobre actividades de un plan aprobado.
  // payload: { items: { [actividadId]: { cumplido, fecha?, observaciones? } } }
  guardarCumplimiento: (planCodigo, payload) =>
    api.put(`${BASE}/${encodeURIComponent(planCodigo)}/cumplimiento`, payload, { timeout: 60000 }).then((r) => r.data),

  // Registrar seguimiento de avance en plan aprobado (UPDATE por id de fila, no reemplaza datos estructurales).
  // payload: { actividades: [{ id, avance_ip, avance_iip, observaciones_ip, observaciones_iip }] }
  guardarSeguimiento: (planCodigo, payload) =>
    api.put(`${BASE}/${encodeURIComponent(planCodigo)}/seguimiento`, payload, { timeout: 60000 }).then((r) => r.data),

  // Devolver un plan a estado Borrador (de Revisión/Aprobación → Creación). Solo PyE/Admin.
  resetearABorrador: (planCodigo) =>
    api.post(`${BASE}/${encodeURIComponent(planCodigo)}/reset`, {}, { timeout: 60000 }).then((r) => r.data),

  // Actividades aprobadas donde el usuario actual figura como corresponsable (planes ajenos).
  obtenerMisCorresponsabilidades: () =>
    api.get(`${BASE}/mis-corresponsabilidades`, { timeout: 60000 }).then((r) => r.data)
};

export const ESTADOS_WORKFLOW = {
  BORRADOR: 'Borrador',
  EN_REVISION_ESTRATEGICA: 'EnRevisionEstrategica',
  REVISADO_POR_ESTRATEGICA: 'RevisadoPorEstrategica',
  EN_REVISION_RESPONSABLE: 'EnRevisionResponsable',
  REVISADO_POR_RESPONSABLE: 'RevisadoPorResponsable',
  APROBADO: 'Aprobado'
};

export const ESTADO_LABEL = {
  Borrador: 'Borrador',
  EnRevisionEstrategica: 'En revisión — Dirección de Planeación',
  RevisadoPorEstrategica: 'Revisado por Dirección de Planeación',
  EnRevisionResponsable: 'En revisión del responsable',
  RevisadoPorResponsable: 'Revisado por responsable',
  Aprobado: 'Aprobado'
};

export const ESTADO_COLOR = {
  Borrador: { bg: '#fef3c7', fg: '#92400e' },
  EnRevisionEstrategica: { bg: '#dbeafe', fg: '#1e40af' },
  RevisadoPorEstrategica: { bg: '#e0e7ff', fg: '#3730a3' },
  EnRevisionResponsable: { bg: '#fce7f3', fg: '#9d174d' },
  RevisadoPorResponsable: { bg: '#fef9c3', fg: '#854d0e' },
  Aprobado: { bg: '#dcfce7', fg: '#166534' }
};

export default planAccionWorkflowService;
