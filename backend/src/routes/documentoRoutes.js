const express = require('express');
const router = express.Router();
const { getDocumentos } = require('../controllers/documentoController');
const { auth } = require('../middlewares/auth');

router.get('/', auth, getDocumentos);

module.exports = router;