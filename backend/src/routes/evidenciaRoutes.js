const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/auth');
const { listarEvidencias } = require('../controllers/evidenciaController');

router.get('/', auth, listarEvidencias);

module.exports = router;
