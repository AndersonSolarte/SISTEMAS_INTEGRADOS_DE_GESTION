const express = require('express');
const router = express.Router();
const {
  upload,
  createDocumento,
  getDocumentosManagement,
  getDocumento,
  updateDocumento,
  deleteDocumento,
  restoreDocumento,
  downloadDocumento
} = require('../controllers/documentoManagementController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

const canManageDocumentos = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS],
  moduleKeys: ['gestion_documentos']
});

router.post('/', auth, canManageDocumentos, upload.single('file'), createDocumento);
router.get('/', auth, canManageDocumentos, getDocumentosManagement);
router.get('/:id', auth, canManageDocumentos, getDocumento);
router.put('/:id', auth, canManageDocumentos, upload.single('file'), updateDocumento);
router.delete('/:id', auth, canManageDocumentos, deleteDocumento);
router.patch('/:id/restore', auth, canManageDocumentos, restoreDocumento);
router.get('/:id/download', auth, canManageDocumentos, downloadDocumento);

module.exports = router;
