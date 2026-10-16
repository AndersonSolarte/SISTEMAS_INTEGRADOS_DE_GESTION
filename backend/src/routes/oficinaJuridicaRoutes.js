const express = require('express');
const multer = require('multer');
const controller = require('../controllers/oficinaJuridicaController');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');

const { Op } = require('sequelize');
const { UserModulePermission } = require('../models');

const router = express.Router();

// Candado estricto: Acceso exclusivo a sgc@unicesmag.edu.co y personal adscrito a Oficina Jurídica con permiso activo
const juridicaAccess = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autenticado.' });
  }

  const email = String(req.user.email || '').trim().toLowerCase();

  // 1. SuperAdmin institucional exclusivo (con soporte para simulación de perspectivas de pruebas)
  if (email === 'sgc@unicesmag.edu.co') {
    const simId = req.headers['x-simulated-user-id'] || req.query.simulate_user_id;
    if (simId) {
      try {
        const { User } = require('../models');
        const simUser = await User.findByPk(simId);
        if (simUser && simUser.estado === 'activo') {
          const simPerms = await UserModulePermission.findAll({
            where: {
              user_id: simUser.id,
              can_view: true,
              module_key: {
                [Op.in]: ['oficina_juridica', 'oficina_juridica.jefatura', 'oficina_juridica.secretaria', 'oficina_juridica.asesor']
              }
            },
            attributes: ['module_key']
          });
          simUser.juridicaPermissions = simPerms.map((p) => p.module_key);
          req.simulatedUser = simUser;
        }
      } catch (simErr) {
        console.warn('Error resolviendo usuario simulado:', simErr);
      }
    }
    return next();
  }

  // 2. Control por permisos: Cualquier otro usuario DEBE tener permiso explícito en Oficina Jurídica otorgado por el administrador
  try {
    const userPerms = await UserModulePermission.findAll({
      where: {
        user_id: req.user.id,
        can_view: true,
        module_key: {
          [Op.in]: ['oficina_juridica', 'oficina_juridica.jefatura', 'oficina_juridica.secretaria', 'oficina_juridica.asesor']
        }
      },
      attributes: ['module_key']
    });

    if (!userPerms || userPerms.length === 0) {
      return res.status(403).json({
        success: false,
        message: 'Acceso restringido. No cuentas con permisos activos en el sistema para ingresar al módulo de Oficina Jurídica.'
      });
    }

    req.user.juridicaPermissions = userPerms.map((p) => p.module_key);
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
router.get('/usuarios-internos', controller.getInternalUsers);
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
