const express = require('express');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { createExcelUpload } = require('../middlewares/excelUpload');
const controller = require('../controllers/pesvParqueaderoController');

const router = express.Router();
const upload = createExcelUpload('uploads/temp/');
const canView = hasAnyRoleOrModulePermission({ roles: [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA], moduleKeys: ['gestion_riesgo_ambiente.seguridad_vial'] });

router.use(auth, canView);
router.get('/', controller.list);
router.get('/template', controller.downloadExcelTemplate);
router.get('/export', controller.exportExcelData);
router.get('/lookup-persona', controller.lookupPersona);
router.post('/import', upload.single('file'), controller.importExcel);
router.get('/runt/sessions/:sessionId', controller.getRuntValidation);
router.post('/runt/sessions/:sessionId/capture-manual', controller.captureManualRuntResult);
router.post('/runt/sessions/:sessionId/confirm', controller.confirmRuntValidation);
router.post('/runt/sessions/:sessionId/notificar-actualizacion', controller.notifyRuntUpdate);
router.post('/:id/runt/session', controller.startRuntValidation);
router.get('/:id/runt/history', controller.getRuntHistory);
router.post('/:id/notificar', controller.notifyExpiry);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/reactivate', controller.reactivate);
router.delete('/:id', controller.remove);

module.exports = router;
