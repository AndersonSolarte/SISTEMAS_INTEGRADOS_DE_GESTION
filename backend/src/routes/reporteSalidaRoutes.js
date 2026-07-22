const express = require('express');
const router = express.Router();
const multer = require('multer');
const fs = require('fs');
const path = require('path');

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
  limits: { fileSize: 10 * 1024 * 1024 } 
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

const SEGUIMIENTO_REPORTE_MODULE_KEYS = ['recurso_humano_reporte_salida', 'seguimiento_reportes_rrhh'];

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
router.post('/upload-adjunto', auth, upload.single('adjunto'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'No se subió ningún archivo' });
  }
  res.json({ success: true, filename: req.file.filename });
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
