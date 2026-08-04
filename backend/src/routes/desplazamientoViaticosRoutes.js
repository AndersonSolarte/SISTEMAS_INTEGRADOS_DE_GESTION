const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const multer = require('multer');
const path = require('path');
const { auth } = require('../middlewares/auth');
const { publicLimiter } = require('../middlewares/security');
const {
  descargarFormato,
  descargarPdf,
  mostrarAccion,
  mostrarDemoFinanciera,
  mostrarDemoLiquidacion,
  mostrarDemoTesoreria,
  procesarAccion,
  procesarDemoFinanciera,
  procesarDemoLiquidacion,
  procesarDemoTesoreria,
  radicarSolicitud
} = require('../controllers/desplazamientoViaticosController');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/desplazamientos_viaticos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, callback) => callback(null, uploadDir),
    filename: (_req, file, callback) => callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${path.extname(file.originalname)}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
    callback(allowed.has(file.mimetype) ? null : new Error('Tipo de archivo no permitido'), allowed.has(file.mimetype));
  }
});

router.get('/assets/escudo.png', (_req, res) => res.sendFile(path.join(__dirname, '../assets/logo-cesmag.png')));
router.get('/assets/encabezado-correos.png', (_req, res) => res.sendFile(path.join(__dirname, '../assets/Encabezado_correos.png')));
router.get('/accion/:token', publicLimiter, mostrarAccion);
router.post('/accion/:token', publicLimiter, procesarAccion);
router.get('/prueba/liquidacion/:token', publicLimiter, mostrarDemoLiquidacion);
router.post('/prueba/liquidacion/:token', publicLimiter, procesarDemoLiquidacion);
router.get('/prueba/tesoreria/:token', publicLimiter, mostrarDemoTesoreria);
router.post('/prueba/tesoreria/:token', publicLimiter, procesarDemoTesoreria);
router.get('/prueba/financiera/:token', publicLimiter, mostrarDemoFinanciera);
router.post('/prueba/financiera/:token', publicLimiter, procesarDemoFinanciera);
router.post('/solicitudes', auth, radicarSolicitud);
router.post('/adjuntos', auth, upload.single('adjunto'), (req, res) => {
  if (!req.file) return res.status(400).json({ success: false, message: 'No se recibió ningún archivo.' });
  return res.json({ success: true, filename: req.file.filename, originalName: req.file.originalname });
});
router.get('/solicitudes/:id/formato', auth, descargarFormato);
router.get('/solicitudes/:id/formato.pdf', auth, descargarPdf);

module.exports = router;
