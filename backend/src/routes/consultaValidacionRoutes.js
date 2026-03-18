const express = require('express');
const router = express.Router();
const multer = require('multer');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { consultaIndividual, consultaMasiva } = require('../controllers/consultaValidacionController');

const SABER_PRO_CONSULTA_MODULE_KEYS = [
  'gestion_informacion',
  'saber_pro',
  'saber_pro_consulta_individual',
  'saber_pro_validacion_masiva'
];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
  fileFilter: (req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      'application/csv'
    ];
    if (allowed.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|csv)$/i)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls) o CSV.'));
    }
  }
});

const canConsultar = hasAnyRoleOrModulePermission({
  roles: [
    ROLES.ADMINISTRADOR,
    ROLES.PLANEACION_ESTRATEGICA,
    ROLES.PLANEACION_EFECTIVIDAD,
    ROLES.AUTOEVALUACION,
    ROLES.GESTION_INFORMACION
  ],
  moduleKeys: SABER_PRO_CONSULTA_MODULE_KEYS
});

router.get('/individual', auth, canConsultar, consultaIndividual);
router.post('/masiva', auth, canConsultar, upload.single('archivo'), consultaMasiva);

module.exports = router;
