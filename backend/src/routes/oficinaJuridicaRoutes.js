const express = require('express');
const multer = require('multer');
const controller = require('../controllers/oficinaJuridicaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

const { UserModulePermission } = require('../models');

const router = express.Router();

// Candado estricto: Acceso exclusivo a sgc@unicesmag.edu.co y personal adscrito a Oficina Jurídica con permiso activo
const juridicaAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }

  const email = String(req.user.email || '').trim().toLowerCase();

  // 1. SuperAdmin institucional exclusivo
  if (email === 'sgc@unicesmag.edu.co') {
    return next();
  }

  // 2. Ningún otro administrador tiene acceso
  if (req.user.role === 'administrador') {
    return res.status(403).json({
      success: false,
      message: 'Acceso restringido. Solo el administrador institucional sgc@unicesmag.edu.co y el personal adscrito a la Oficina Jurídica tienen acceso a este módulo.'
    });
  }

  // 3. Debe pertenecer a la Oficina Jurídica
  const dep = String(req.user.dependencia || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const cargo = String(req.user.cargo || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const isJuridica = dep.includes('jurid') || cargo.includes('jurid');

  if (!isJuridica) {
    return res.status(403).json({
      success: false,
      message: 'Acceso restringido exclusivamente al personal de la Oficina Jurídica.'
    });
  }

  // 4. Debe tener permiso explícito en el tablero de permisos
  try {
    const hasPerm = await UserModulePermission.count({
      where: {
        user_id: req.user.id,
        can_view: true,
        module_key: 'oficina_juridica'
      }
    });

    if (hasPerm === 0) {
      return res.status(403).json({
        success: false,
        message: 'No cuentas con permisos activos en el sistema para ingresar al módulo de Oficina Jurídica.'
      });
    }

    return next();
  } catch (err) {
    console.error('Error verificando permisos de Oficina Jurídica:', err);
    return res.status(500).json({ success: false, message: 'Error validando permisos de acceso.' });
  }
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword',
    'application/vnd.ms-excel'
  ].includes(file.mimetype))
});

router.use(auth, juridicaAccess);
router.get('/perfil', controller.getProfile);
router.get('/casos', controller.listCases);
router.post('/casos', upload.array('archivos', 10), controller.createCase);
router.get('/casos/:id', controller.getCase);
router.patch('/casos/:id', controller.updateCase);
router.post('/casos/:id/asignar', controller.assignCase);
router.post('/casos/:id/visto-bueno', controller.vistoBuenoCase);
router.post('/casos/:id/transicion', controller.transitionCase);
router.post('/casos/:id/adjuntos', upload.single('archivo'), controller.uploadAttachment);
router.get('/adjuntos/:adjuntoId', controller.downloadAttachment);
router.get('/estadisticas', controller.stats);
router.get('/exportar', controller.exportExcel);
router.post('/importar', upload.single('archivo'), controller.importExcel);

module.exports = router;
