const express = require('express');
const router = express.Router();
const {
  aprobarDesdeCorreo,
  mostrarFormularioRechazo,
  procesarRechazo,
  aprobarGrupoDesdeCorreo,
  mostrarFormularioRechazoGrupo,
  procesarRechazoGrupo,
  actualizarReposicion,
  getCatalogoLaboral,
  getFeatureConfig,
  getSeguimientoBadge,
  getSeguimientoPersonal,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig,
  getReposicionesPropias,
  getReposicionesEquipo,
  eliminarSolicitud,
  editarSolicitudAdmin
} = require('../controllers/reporteSalidaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { publicLimiter } = require('../middlewares/security');
const { ROLES } = require('../constants/roles');

router.get('/aprobar/:token', publicLimiter, aprobarDesdeCorreo);
router.get('/rechazar/:token', publicLimiter, mostrarFormularioRechazo);
router.post('/rechazar/:token', publicLimiter, procesarRechazo);
router.get('/aprobar-grupo/:token', publicLimiter, aprobarGrupoDesdeCorreo);
router.get('/rechazar-grupo/:token', publicLimiter, mostrarFormularioRechazoGrupo);
router.post('/rechazar-grupo/:token', publicLimiter, procesarRechazoGrupo);
router.get('/config', auth, getFeatureConfig);
router.patch('/config', auth, updateFeatureConfig);
router.get('/catalogo-laboral', auth, getCatalogoLaboral);
router.get('/jefes', auth, searchJefes);
router.get('/dependencias', auth, listarDependencias);
router.post('/solicitudes', auth, radicarSolicitud);
router.get('/seguimiento/badge', auth, getSeguimientoBadge);
router.get('/seguimiento', auth, getSeguimientoPersonal);
router.get(
  '/solicitudes',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: ['seguimiento_reportes_rrhh']
  }),
  listarSolicitudes
);

router.delete(
  '/solicitudes/:id',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: ['seguimiento_reportes_rrhh']
  }),
  eliminarSolicitud
);

router.put(
  '/solicitudes/:id/admin',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: ['seguimiento_reportes_rrhh']
  }),
  editarSolicitudAdmin
);

router.patch(
  '/solicitudes/:id/reposicion',
  auth,
  actualizarReposicion
);

router.get('/reposiciones/mis-reposiciones', auth, getReposicionesPropias);
router.get('/reposiciones/equipo', auth, getReposicionesEquipo);

module.exports = router;
