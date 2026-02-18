const express = require('express');
const router = express.Router();
const { login, getProfile } = require('../controllers/authController');
const { auth } = require('../middlewares/auth');

router.post('/login', login);
router.get('/profile', auth, getProfile);

module.exports = router;