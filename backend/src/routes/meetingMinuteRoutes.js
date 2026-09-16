const express = require('express');
const controller = require('../controllers/meetingMinuteController');
const { auth } = require('../middlewares/auth');
const { publicLimiter } = require('../middlewares/security');

const router = express.Router();

router.get('/public/:token', publicLimiter, controller.publicMinute);
router.post('/public/:token/request-code', publicLimiter, controller.requestCode);
router.post('/public/:token/sign', publicLimiter, controller.sign);

router.get('/config', auth, controller.getConfig);
router.patch('/config', auth, controller.updateConfig);
router.get('/participants/lookup', auth, controller.lookupParticipant);
router.get('/', auth, controller.listMinutes);
router.post('/', auth, controller.saveDraft);
router.get('/:id', auth, controller.getMinute);
router.post('/:id/publish', auth, controller.publish);
router.post('/:id/send-final', auth, controller.sendFinalMinute);
router.get('/:id/word', auth, controller.downloadWord);

module.exports = router;
