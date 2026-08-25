const express = require('express');
const multer = require('multer');
const { auth } = require('../middlewares/auth');
const { requireStrategicPermission: permit } = require('../middlewares/strategicPlanningPermission');
const c = require('../controllers/strategicPlanningController');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: Number(process.env.SIAC_PEI_MAX_UPLOAD_BYTES || 25 * 1024 * 1024) } });

router.use(auth);
router.get('/bootstrap', permit(), c.bootstrap);
router.get('/plans', permit('pei_consulta_ejecutiva'), c.listPlans);
router.post('/plans', permit('pei_configurar'), c.createPlan);
router.patch('/plans/:id', permit('pei_configurar'), c.updatePlan);
router.delete('/plans/:id', permit('pei_configurar'), c.deletePlan);
router.post('/plans/:planId/levels', permit('pei_configurar'), c.createLevel);
router.patch('/plans/:planId/levels/:levelId', permit('pei_configurar'), c.updateLevel);
router.delete('/plans/:planId/levels/:levelId', permit('pei_configurar'), c.deleteLevel);
router.get('/plans/:planId/structure', permit(), c.listStructure);
router.post('/plans/:planId/elements', permit('pei_configurar'), c.createElement);
router.patch('/plans/:planId/elements/:elementId', permit('pei_configurar'), c.updateElement);
router.delete('/plans/:planId/elements/:elementId', permit('pei_configurar'), c.deleteElement);
router.post('/plans/:planId/apply-institutional-template', permit('pei_configurar'), c.applyInstitutionalTemplate);
router.post('/plans/:planId/fields', permit('pei_configurar'), c.createFieldDefinition);
router.patch('/plans/:planId/fields/:fieldId', permit('pei_configurar'), c.updateFieldDefinition);
router.delete('/plans/:planId/fields/:fieldId', permit('pei_configurar'), c.deleteFieldDefinition);
router.post('/plans/:planId/catalog-items', permit('pei_configurar'), c.upsertCatalog);
router.patch('/plans/:planId/catalog-items/:itemId', permit('pei_configurar'), c.updateCatalog);
router.delete('/plans/:planId/catalog-items/:itemId', permit('pei_configurar'), c.deleteCatalog);
router.post('/plans/:planId/reference-imports/preview', permit('pei_configurar'), upload.single('file'), c.referencePreview);
router.post('/reference-imports/:importId/confirm', permit('pei_configurar'), c.referenceConfirm);
router.get('/plans/:planId/leader-options', permit('pei_formular'), c.leaderOptions);
router.post('/plans/:planId/terms', permit('pei_configurar'), c.createTerm);
router.patch('/terms/:termId', permit('pei_configurar'), c.updateTerm);
router.delete('/terms/:termId', permit('pei_configurar'), c.deleteTerm);

router.get('/action-plans', permit(), c.listActionPlans);
router.post('/action-plans', permit('pei_formular'), c.createActionPlan);
router.get('/action-plans/:id', permit(), c.getActionPlan);
router.patch('/action-plans/:id', permit('pei_formular'), c.updateActionPlan);
router.post('/action-plans/:id/items', permit('pei_formular'), c.addActionItem);
router.patch('/action-plans/:id/items/:itemId', permit('pei_formular'), c.updateActionItem);
router.delete('/action-plans/:id/items/:itemId', permit('pei_formular'), c.deleteActionItem);
router.post('/action-plans/:id/transitions', permit('pei_formular', 'pei_revision_tecnica', 'pei_validar_responsable'), c.transitionActionPlan);
router.post('/action-plans/:id/transfer-leader', permit('pei_formular'), c.transferLeader);
router.get('/action-plans/:id/export', permit(), c.exportActionPlan);
router.put('/action-items/:itemId/monitoring/:periodId', permit('pei_seguimiento'), c.saveMonitoring);

router.post('/action-plans/:id/meetings', permit('pei_formular'), c.createMeeting);
router.post('/meetings/:meetingId/minutes', permit('pei_formular'), c.createMinuteVersion);
router.post('/minutes/:minuteId/proposals', permit(), c.addProposal);
router.patch('/minute-proposals/:proposalId', permit('pei_formular'), c.resolveProposal);
router.post('/minutes/:minuteId/publish', permit('pei_formular'), c.publishMinute);
router.post('/minutes/:minuteId/sign-internal', permit(), c.signInternal);
router.post('/minutes/:minuteId/finalize', permit('pei_formular'), c.finalizeMinute);
router.get('/minutes/:minuteId/word', permit(), c.downloadMinuteWord);
router.get('/minutes/:minuteId/pdf', permit(), c.downloadMinutePdf);
router.post('/my-signature', permit(), c.registerUserSignature);

router.post('/action-items/:itemId/evidence', permit('pei_seguimiento'), upload.single('file'), c.uploadEvidence);
router.get('/evidence/:evidenceId/download', permit(), c.downloadEvidence);
router.post('/evidence/:evidenceId/retry', permit('pei_drive'), c.retrySync);
router.post('/terms/:termId/reconcile', permit('pei_drive'), c.reconcile);
router.post('/terms/:termId/close', permit('pei_configurar', 'pei_drive'), c.closeTerm);
router.get('/sync-jobs', permit('pei_drive'), c.listSyncJobs);

router.post('/budget-imports/preview', permit('pei_presupuesto'), upload.single('file'), c.previewBudget);
router.post('/budget-imports/:importId/confirm', permit('pei_presupuesto'), c.confirmBudget);
router.post('/budget-imports/:importId/reverse', permit('pei_presupuesto'), c.reverseBudget);
router.post('/historical-imports/preview', permit('pei_configurar'), upload.single('file'), c.previewHistorical);
router.post('/historical-imports/:importId/confirm', permit('pei_configurar'), c.confirmHistorical);
router.get('/analytics', permit('pei_consulta_ejecutiva'), c.analytics);
router.get('/audit', permit('pei_auditoria'), c.listAudit);

module.exports = router;
