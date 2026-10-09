const express = require('express');
const multer = require('multer');
const controller = require('../controllers/oficinaJuridicaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

const router = express.Router();
const access = hasAnyRoleOrModulePermission({
  roles: [ROLES.ADMINISTRADOR],
  moduleKeys: ['oficina_juridica']
});
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, ['application/pdf', 'image/png', 'image/jpeg', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'].includes(file.mimetype))
});

router.use(auth, access);
router.get('/perfil', controller.getProfile);
router.get('/casos', controller.listCases);
router.post('/casos', controller.createCase);
router.get('/casos/:id', controller.getCase);
router.patch('/casos/:id', controller.updateCase);
router.post('/casos/:id/asignar', controller.assignCase);
router.post('/casos/:id/visto-bueno', controller.vistoBuenoCase);
router.post('/casos/:id/transicion', controller.transitionCase);
router.post('/casos/:id/adjuntos', upload.single('archivo'), controller.uploadAttachment);
router.get('/adjuntos/:adjuntoId', controller.downloadAttachment);
router.get('/estadisticas', controller.stats);
router.get('/exportar', controller.exportExcel);
router.post('/importar', upload.single('archivo'), controller.importExcel);

module.exports = router;
