const express = require('express');
const router = express.Router();
const { googleLogin, googleRedirectLogin, getProfile } = require('../controllers/authController');
const { auth } = require('../middlewares/auth');

/* Solo autenticación Google institucional */
router.post('/google', googleLogin);
router.post('/google/redirect', googleRedirectLogin);
router.get('/profile', auth, getProfile);

module.exports = router;
