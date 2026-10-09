const express = require('express');
const multer = require('multer');
const { auth } = require('../middlewares/auth');
const controller = require('../controllers/planMejoramientoController');

const router = express.Router();
const tariffUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, /\.xlsx$/i.test(file.originalname || ''))
});
const evidenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => callback(null, /\.(pdf|docx?|xlsx?|png|jpe?g|webp|zip)$/i.test(file.originalname || ''))
});
router.use(auth, controller.ensureAccess);
router.get('/catalogs', controller.getCatalogs);
router.get('/ejecucion/badge', controller.executionBadge);
router.get('/tarifas/plantilla', controller.downloadTariffTemplate);
router.post('/tarifas/importar', controller.ensureManager, tariffUpload.single('file'), controller.importTariffs);
router.get('/responsables', controller.searchResponsables);
router.post('/sync-autoevaluacion', controller.ensureManager, controller.syncAutoevaluacion);
router.get('/linked-autoevaluacion', controller.linkedAutoevaluacion);
router.post('/unlink-autoevaluacion', controller.ensureManager, controller.unlinkAutoevaluacion);
router.get('/', controller.list);
router.post('/', controller.ensureManager, controller.create);
router.post('/:id/asignar', controller.ensureManager, controller.assignPlan);
router.post('/:id/flujo', controller.workflowAction);
router.post('/:id/evidencias', evidenceUpload.single('file'), controller.uploadEvidence);
router.get('/:id/export', controller.exportExcel);
router.get('/:id', controller.get);
router.put('/:id', controller.update);
router.delete('/:id', controller.ensureManager, controller.remove);

module.exports = router;
