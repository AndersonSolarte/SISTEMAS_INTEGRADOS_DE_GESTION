const express = require('express');
const c = require('../controllers/strategicPlanningController');

const router = express.Router();
router.get('/minutes/:token', c.getPublicMinute);
router.post('/minutes/:token/request-code', c.requestExternalOtp);
router.post('/minutes/:token/sign', c.signExternal);
router.get('/validate/:minuteId', c.validateMinute);

module.exports = router;
