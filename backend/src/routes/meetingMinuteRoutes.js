const express = require('express');
const controller = require('../controllers/meetingMinuteController');
const { auth } = require('../middlewares/auth');
const { publicLimiter } = require('../middlewares/security');

const router = express.Router();

router.get('/public/:token', publicLimiter, controller.publicMinute);
router.post('/public/:token/google-access', publicLimiter, controller.googleSigningAccess);
router.post('/public/:token/sign', publicLimiter, controller.sign);

router.get('/config', auth, controller.getConfig);
router.patch('/config', auth, controller.updateConfig);
router.get('/participants/lookup', auth, controller.lookupParticipant);
router.get('/locations', auth, controller.listMeetingLocations);
router.get('/', auth, controller.listMinutes);
router.post('/restore-all', auth, controller.restoreAllMinutes);
router.post('/', auth, controller.saveDraft);
router.get('/:id', auth, controller.getMinute);
router.post('/:id/restore', auth, controller.restoreMinute);
router.post('/:id/publish', auth, controller.publish);
router.post('/:id/signing-access', auth, controller.getSigningAccess);
router.post('/:id/resend-invitations', auth, controller.resendInvitations);
router.post('/:id/reopen', auth, controller.reopenForEditing);
router.post('/:id/send-final', auth, controller.sendFinalMinute);
router.post('/:id/comments', auth, controller.updateComments);
router.get('/:id/word', auth, controller.downloadWord);
router.get('/:id/pdf', auth, controller.downloadPdf);
router.delete('/:id', auth, controller.deleteMinute);

module.exports = router;
