const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const controller = require('../controllers/securityController');

router.get('/dashboard', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.VIEW), controller.getDashboard);
router.get('/scans', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.VIEW), controller.listScans);
router.post('/scans/run', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.SCAN), controller.runScan);
router.get('/findings', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.FINDINGS), controller.listFindings);
router.get('/findings/:id', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.FINDINGS), controller.getFinding);
router.patch('/findings/:id/status', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.MANAGE), controller.updateStatus);
router.patch('/findings/:id/assign', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.MANAGE), controller.assignFinding);
router.post('/findings/:id/remediation/analyze', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.REMEDIATE), controller.analyzeRemediation);
router.get('/reports/export', auth, controller.requireSecurityPermission(controller.SECURITY_PERMISSIONS.EXPORT), controller.exportReport);

module.exports = router;
