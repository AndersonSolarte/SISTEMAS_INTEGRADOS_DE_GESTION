const express = require('express');
const router = express.Router();
const {
  aprobarDesdeCorreo,
  actualizarReposicion,
  getCatalogoLaboral,
  getFeatureConfig,
  getSeguimientoPersonal,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig
} = require('../controllers/reporteSalidaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { publicLimiter } = require('../middlewares/security');
const { ROLES } = require('../constants/roles');

router.get('/aprobar/:token', publicLimiter, aprobarDesdeCorreo);
router.get('/config', auth, getFeatureConfig);
router.patch('/config', auth, updateFeatureConfig);
router.get('/catalogo-laboral', auth, getCatalogoLaboral);
router.get('/jefes', auth, searchJefes);
router.get('/dependencias', auth, listarDependencias);
router.post('/solicitudes', auth, radicarSolicitud);
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
router.patch(
  '/solicitudes/:id/reposicion',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: ['seguimiento_reportes_rrhh']
  }),
  actualizarReposicion
);

module.exports = router;
