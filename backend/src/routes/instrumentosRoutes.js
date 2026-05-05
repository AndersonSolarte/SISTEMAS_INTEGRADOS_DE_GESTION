const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const controller = require('../controllers/instrumentosController');

router.get('/dashboard', auth, controller.ensureAccess, controller.getDashboard);
router.get('/history', auth, controller.ensureAccess, controller.listHistory);
router.get('/question-bank', auth, controller.ensureAccess, controller.listQuestionBank);
router.post('/question-bank', auth, controller.ensureAccess, controller.createQuestionBank);
router.put('/question-bank/:id', auth, controller.ensureAccess, controller.updateQuestionBank);
router.get('/permissions', auth, controller.listPermissions);
router.post('/permissions/assign', auth, controller.assignPermission);

router.get('/', auth, controller.ensureAccess, controller.listForms);
router.post('/', auth, controller.canCreateInstrument, controller.createForm);
router.get('/:id', auth, controller.ensureAccess, controller.getForm);
router.get('/:id/preview', auth, controller.ensureAccess, controller.getPreviewForm);
router.put('/:id', auth, controller.ensureAccess, controller.updateForm);
router.post('/:id/archive', auth, controller.ensureAccess, controller.archiveForm);
router.post('/:id/restore', auth, controller.ensureAccess, controller.restoreForm);
router.post('/:id/publish', auth, controller.ensureAccess, controller.publishForm);
router.post('/:id/close', auth, controller.ensureAccess, controller.closeForm);
router.post('/:id/duplicate', auth, controller.ensureAccess, controller.duplicateForm);
router.delete('/:id', auth, controller.ensureAccess, controller.deleteForm);
router.get('/:id/results', auth, controller.ensureAccess, controller.getResults);
router.get('/:id/statistics', auth, controller.ensureAccess, controller.getStatistics);
router.get('/:id/export/excel', auth, controller.ensureAccess, controller.exportExcel);
router.get('/:id/export/pdf', auth, controller.ensureAccess, controller.exportPdf);
router.get('/:id/backup', auth, controller.ensureAccess, controller.createBackup);
router.get('/:id/qr', auth, controller.ensureAccess, controller.getQr);

module.exports = router;
