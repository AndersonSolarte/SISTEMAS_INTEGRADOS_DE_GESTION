const express = require('express');
const router = express.Router();
const {
  aprobarDesdeCorreo,
  getFeatureConfig,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig
} = require('../controllers/reporteSalidaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

router.get('/aprobar/:token', aprobarDesdeCorreo);
router.get('/config', auth, getFeatureConfig);
router.patch('/config', auth, updateFeatureConfig);
router.get('/jefes', auth, searchJefes);
router.get('/dependencias', auth, listarDependencias);
router.post('/solicitudes', auth, radicarSolicitud);
router.get(
  '/solicitudes',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: ['seguimiento_reportes_rrhh']
  }),
  listarSolicitudes
);

module.exports = router;
