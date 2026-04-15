const express = require('express');
const router = express.Router();
const { getMacroProcesos, getProcesos, getSubProcesos, getTiposDocumentacion, getFilterOptions } = require('../controllers/catalogoController');
const { auth } = require('../middlewares/auth');

router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

router.get('/macro-procesos', auth, getMacroProcesos);
router.get('/procesos', auth, getProcesos);
router.get('/subprocesos', auth, getSubProcesos);
router.get('/tipos-documentacion', auth, getTiposDocumentacion);
router.get('/filtro-opciones', auth, getFilterOptions);

module.exports = router;
