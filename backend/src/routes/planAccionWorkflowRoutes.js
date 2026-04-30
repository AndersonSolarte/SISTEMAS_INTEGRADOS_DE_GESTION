const express = require('express');
const router = express.Router();

const { auth, hasAnyRole } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const {
  listarMisPlanes,
  listarPendientes,
  obtenerPlan,
  crearPlan,
  guardarPlan,
  transicionarPlan,
  eliminarPlan,
  listarUsuariosConsulta,
  obtenerBadgePendientes,
  guardarCumplimientoConsulta,
  resetearPlanABorrador,
  obtenerMisCorresponsabilidades
} = require('../controllers/planAccionWorkflowController');

// Roles que pueden tocar el workflow (todos los involucrados + admin).
// La autorización fina (qué puede hacer cada uno) la valida cada endpoint internamente.
const ROLES_WORKFLOW = [
  ROLES.ADMINISTRADOR,
  ROLES.PLANEACION_EFECTIVIDAD,
  ROLES.PLANEACION_ESTRATEGICA,
  ROLES.CONSULTA
];

// Listar usuarios con rol "consulta" (para el dropdown al asignar responsable).
// Solo PyE y Admin lo necesitan.
router.get(
  '/usuarios-consulta',
  auth,
  hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD),
  listarUsuariosConsulta
);

// Bandeja: planes pendientes de acción según el rol del usuario.
router.get('/pendientes', auth, hasAnyRole(...ROLES_WORKFLOW), listarPendientes);

// Conteo de pendientes (sirve al sidebar para mostrar/ocultar el módulo).
router.get('/badge', auth, hasAnyRole(...ROLES_WORKFLOW), obtenerBadgePendientes);

// Cumplimiento personal del Consulta sobre actividades de un plan aprobado.
router.put('/:planCodigo/cumplimiento', auth, hasAnyRole(...ROLES_WORKFLOW), guardarCumplimientoConsulta);

// Devolver un plan a estado Borrador (limpia el flujo de revisión/aprobación). Solo PyE/Admin.
router.post('/:planCodigo/reset', auth, hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD), resetearPlanABorrador);

// Actividades aprobadas donde el usuario actual es corresponsable (planes de otras dependencias).
router.get('/mis-corresponsabilidades', auth, hasAnyRole(...ROLES_WORKFLOW), obtenerMisCorresponsabilidades);

// Listar todos los planes que el usuario actual puede ver (filtrados por rol).
router.get('/', auth, hasAnyRole(...ROLES_WORKFLOW), listarMisPlanes);

// Obtener un plan específico (cabecera + actividades).
router.get('/:planCodigo', auth, hasAnyRole(...ROLES_WORKFLOW), obtenerPlan);

// Crear un plan nuevo (Borrador). Solo PyE/Admin (validado en el controller también).
router.post('/', auth, hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD), crearPlan);

// Guardar/editar el contenido (DELETE+INSERT atómico). La autorización fina
// según estado y rol del usuario se hace dentro del controller.
router.put('/:planCodigo', auth, hasAnyRole(...ROLES_WORKFLOW), guardarPlan);

// Cambiar de estado (transición). Validación de rol+estado en el controller.
router.post('/:planCodigo/transicion', auth, hasAnyRole(...ROLES_WORKFLOW), transicionarPlan);

// Soft-delete. Solo PyE/Admin y solo si está en Borrador.
router.delete('/:planCodigo', auth, hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD), eliminarPlan);

module.exports = router;
