const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ReporteSalidaAdjunto } = require('../models');

const uploadDir = path.join(__dirname, '../../uploads/adjuntos_reporte');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: Number(process.env.REPORTE_SALIDA_ADJUNTO_MAX_MB || 15) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = new Set(['application/pdf', 'image/png', 'image/jpeg']);
    const allowedExtensions = new Set(['.pdf', '.png', '.jpg', '.jpeg']);
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowed = allowedMimeTypes.has(String(file.mimetype || '').toLowerCase()) && allowedExtensions.has(extension);
    cb(allowed ? null : new Error('Solo se permiten archivos PDF, PNG, JPG o JPEG.'), allowed);
  }
});
const {
  aprobarDesdeCorreo,
  mostrarFormularioRechazo,
  procesarRechazo,
  aprobarGrupoDesdeCorreo,
  mostrarFormularioRechazoGrupo,
  procesarRechazoGrupo,
  actualizarReposicion,
  getCatalogoLaboral,
  getFeatureConfig,
  getSeguimientoBadge,
  getSeguimientoPersonal,
  listarDependencias,
  listarSolicitudes,
  radicarSolicitud,
  searchJefes,
  updateFeatureConfig,
  getReposicionesPropias,
  getReposicionesEquipo,
  eliminarSolicitud,
  limpiarMocks,
  editarSolicitudAdmin,
  verificarReportePublico
} = require('../controllers/reporteSalidaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { publicLimiter } = require('../middlewares/security');
const { ROLES } = require('../constants/roles');

const SEGUIMIENTO_REPORTE_MODULE_KEYS = ['recurso_humano_reporte_salida', 'seguimiento_reportes_rrhh', 'recurso_humano_seguimiento'];

router.get('/aprobar/:token', publicLimiter, aprobarDesdeCorreo);
router.post('/aprobar/:token', publicLimiter, aprobarDesdeCorreo);
router.get('/rechazar/:token', publicLimiter, mostrarFormularioRechazo);
router.post('/rechazar/:token', publicLimiter, procesarRechazo);
router.get('/aprobar-grupo/:token', publicLimiter, aprobarGrupoDesdeCorreo);
router.post('/aprobar-grupo/:token', publicLimiter, aprobarGrupoDesdeCorreo);
router.get('/rechazar-grupo/:token', publicLimiter, mostrarFormularioRechazoGrupo);
router.post('/rechazar-grupo/:token', publicLimiter, procesarRechazoGrupo);
router.get('/public/verificar/:id', verificarReportePublico);
router.get('/config', auth, getFeatureConfig);
router.patch('/config', auth, updateFeatureConfig);
router.get('/catalogo-laboral', auth, getCatalogoLaboral);
router.get('/jefes', auth, searchJefes);
router.get('/dependencias', auth, listarDependencias);
router.post('/upload-adjunto', auth, upload.single('adjunto'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
  }
  try {
    const contenido = await fs.promises.readFile(req.file.path);
    const sha256 = crypto.createHash('sha256').update(contenido).digest('hex');
    const adjunto = await ReporteSalidaAdjunto.create({
      uploaded_by_user_id: req.user?.id || null,
      storage_key: req.file.filename,
      nombre_original: String(req.file.originalname || req.file.filename).slice(0, 500),
      mime_type: String(req.file.mimetype || 'application/octet-stream').slice(0, 120),
      extension: path.extname(req.file.originalname || req.file.filename).toLowerCase().slice(0, 20),
      tamano_bytes: contenido.length,
      sha256,
      contenido,
      origen: 'formulario',
      metadata: { persistido_en_base_datos: true }
    });
    return res.json({
      success: true,
      filename: req.file.filename,
      originalName: req.file.originalname,
      attachmentId: String(adjunto.id),
      persisted: true
    });
  } catch (error) {
    try { await fs.promises.unlink(req.file.path); } catch (_) { /* archivo temporal ya inexistente */ }
    console.error('[reporte-salida] No fue posible persistir el adjunto:', error);
    return res.status(500).json({ success: false, message: 'No fue posible guardar el archivo en la base de datos.' });
  }
});
router.post('/solicitudes', auth, radicarSolicitud);
router.get('/seguimiento/badge', auth, getSeguimientoBadge);
router.get('/seguimiento', auth, getSeguimientoPersonal);
router.get(
  '/solicitudes',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: SEGUIMIENTO_REPORTE_MODULE_KEYS
  }),
  listarSolicitudes
);

router.delete(
  '/solicitudes/:id',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: SEGUIMIENTO_REPORTE_MODULE_KEYS
  }),
  eliminarSolicitud
);

router.delete(
  '/limpiar-mocks',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: SEGUIMIENTO_REPORTE_MODULE_KEYS
  }),
  limpiarMocks
);

router.put(
  '/solicitudes/:id/admin',
  auth,
  hasAnyRoleOrModulePermission({
    roles: [ROLES.ADMINISTRADOR, ROLES.GESTION_INFORMACION, ROLES.PLANEACION_ESTRATEGICA],
    moduleKeys: SEGUIMIENTO_REPORTE_MODULE_KEYS
  }),
  editarSolicitudAdmin
);

router.patch(
  '/solicitudes/:id/reposicion',
  auth,
  actualizarReposicion
);

router.get('/reposiciones/mis-reposiciones', auth, getReposicionesPropias);
router.get('/reposiciones/equipo', auth, getReposicionesEquipo);

module.exports = router;
