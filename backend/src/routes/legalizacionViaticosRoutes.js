const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const { auth } = require('../middlewares/auth');
const controller = require('../controllers/legalizacionViaticosController');

const router = express.Router();
const uploadDir = path.join(__dirname, '../../uploads/legalizaciones_viaticos');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, done) => done(null, uploadDir),
    filename: (_req, file, done) => done(null, `${Date.now()}-${crypto.randomBytes(10).toString('hex')}${path.extname(file.originalname).toLowerCase()}`)
  }),
  limits: { fileSize: 10 * 1024 * 1024, files: 30 },
  fileFilter: (_req, file, done) => {
    const allowed = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/webp']);
    done(allowed.has(file.mimetype) ? null : new Error('Archivo no permitido'), allowed.has(file.mimetype));
  }
});

router.get('/verificar/:codigo', controller.verificar);
router.get('/estado-propio', auth, controller.estadoPropio);
router.get('/mis-legalizaciones', auth, controller.listarPropias);
router.post('/:id/presentar', auth, upload.any(), controller.presentar);
router.get('/:id/adjuntos/:fileId', auth, controller.verAdjunto);
router.get('/:id/pdf', auth, controller.descargarPdf);
router.get('/gestion/solicitudes', auth, controller.listarGestion);
router.get('/gestion/solicitudes/:solicitudId', auth, controller.obtenerGestion);
router.post('/gestion/:id/validar', auth, express.json(), controller.validar);
router.get('/estadisticas/resumen', auth, controller.estadisticas);

module.exports = router;
