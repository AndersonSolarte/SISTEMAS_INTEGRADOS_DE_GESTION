const express = require('express');
const router = express.Router();
const { importFromExcel, importFromSheet, downloadTemplate, clearDocumentos } = require('../controllers/importController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { createExcelUpload } = require('../middlewares/excelUpload');

const upload = createExcelUpload('uploads/');
const canManageAseguramiento = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_PROCESOS],
  moduleKeys: ['aseguramiento_calidad']
});

router.post('/excel', auth, canManageAseguramiento, upload.single('file'), importFromExcel);
router.post('/sheets', auth, canManageAseguramiento, importFromSheet);
router.get('/template', auth, canManageAseguramiento, downloadTemplate);
router.post('/clear', auth, canManageAseguramiento, clearDocumentos);

module.exports = router;
