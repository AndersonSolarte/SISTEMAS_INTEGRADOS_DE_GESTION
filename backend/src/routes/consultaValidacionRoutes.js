const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { consultaIndividual, consultaMasiva, downloadConsultaMasivaTemplate } = require('../controllers/consultaValidacionController');
const {
  createImport: createDocumentImport,
  latestImport: latestDocumentImport,
  getImport: getDocumentImport,
  retryImport: retryDocumentImport,
  clearImports: clearDocumentImports,
  correctItem: correctDocumentImportItem,
  viewPdf: viewDocumentImportPdf,
  downloadTemplate: downloadDocumentImportTemplate,
  exportImport: exportDocumentImport
} = require('../controllers/saberProDocumentImportController');

const SABER_PRO_PARENT_MODULE_KEYS = ['gestion_informacion', 'saber_pro'];
const SABER_PRO_ALLOWED_ROLES = [
  ROLES.ADMINISTRADOR,
  ROLES.PLANEACION_ESTRATEGICA,
  ROLES.PLANEACION_EFECTIVIDAD,
  ROLES.AUTOEVALUACION,
  ROLES.GESTION_INFORMACION
];

const permissionFor = (moduleKey) => hasAnyRoleOrModulePermission({
  roles: SABER_PRO_ALLOWED_ROLES,
  moduleKeys: [...SABER_PRO_PARENT_MODULE_KEYS, moduleKey]
});

const canConsultaIndividual = permissionFor('saber_pro_consulta_individual');
const canValidacionMasiva = permissionFor('saber_pro_validacion_masiva');
const canConsultaDocumentos = permissionFor('saber_pro_consulta_documentos_masiva');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV.'));
    }
  }
});

router.get('/individual', auth, canConsultaIndividual, consultaIndividual);
router.get('/template', auth, canValidacionMasiva, downloadConsultaMasivaTemplate);
router.post('/masiva', auth, canValidacionMasiva, upload.single('archivo'), consultaMasiva);
router.get('/documentos-masivos/template', auth, canConsultaDocumentos, downloadDocumentImportTemplate);
router.get('/documentos-masivos/latest', auth, canConsultaDocumentos, latestDocumentImport);
router.delete('/documentos-masivos', auth, canConsultaDocumentos, clearDocumentImports);
router.get('/documentos-masivos/items/:itemId/pdf', auth, canConsultaDocumentos, viewDocumentImportPdf);
router.patch('/documentos-masivos/items/:itemId', auth, canConsultaDocumentos, correctDocumentImportItem);
router.get('/documentos-masivos/:id/export', auth, canConsultaDocumentos, exportDocumentImport);
router.post('/documentos-masivos/:id/retry', auth, canConsultaDocumentos, retryDocumentImport);
router.get('/documentos-masivos/:id', auth, canConsultaDocumentos, getDocumentImport);
router.post('/documentos-masivos', auth, canConsultaDocumentos, upload.single('archivo'), createDocumentImport);

module.exports = router;
