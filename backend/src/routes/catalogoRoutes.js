const express = require('express');
const router = express.Router();
const { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion, getFilterOptions } = require('../controllers/catalogoController');
const { auth } = require('../middlewares/auth');

router.get('/macro-procesos', auth, getMacroProcesos);
router.get('/procesos', auth, getProcesos);
router.get('/subprocesos', auth, getSubProcesos);
router.get('/tipos-documentacion', auth, getTiposDocumentacion);
router.get('/filtro-opciones', auth, getFilterOptions);

module.exports = router;
