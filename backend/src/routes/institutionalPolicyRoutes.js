const router = require('express').Router();
const multer = require('multer');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const controller = require('../controllers/institutionalPolicyController');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, done) => done(null, /\.(xlsx|csv)$/i.test(file.originalname || '')) });
const canImport = hasAnyRoleOrModulePermission({ roles: ['administrador'], moduleKeys: ['gestion_bases_datos.importar'] });
const canExport = hasAnyRoleOrModulePermission({ roles: ['administrador'], moduleKeys: ['gestion_bases_datos.datos_exportar'] });

router.use(auth);
router.get('/', controller.list);
router.get('/plantilla', canImport, controller.template);
router.get('/exportar', canExport, controller.exportData);
router.post('/importar', canImport, upload.single('file'), controller.importData);
module.exports = router;
