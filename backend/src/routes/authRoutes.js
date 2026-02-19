const express = require('express');
const router = express.Router();
const { login, getProfile, changePassword } = require('../controllers/authController');
const { auth } = require('../middlewares/auth');

router.post('/login', login);
router.get('/profile', auth, getProfile);
router.post('/change-password', auth, changePassword);

module.exports = router;
