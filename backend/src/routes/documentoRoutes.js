const express = require('express');
const router = express.Router();
const { getDocumentos, getEstadisticaDocumental, getDocumentoArchivoSeguro } = require('../controllers/documentoController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

router.get('/archivo/:token', getDocumentoArchivoSeguro);
router.get('/', auth, getDocumentos);
router.get(
  '/estadistica-documental',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: ['estadistica_documental']
  }),
  getEstadisticaDocumental
);

module.exports = router;
