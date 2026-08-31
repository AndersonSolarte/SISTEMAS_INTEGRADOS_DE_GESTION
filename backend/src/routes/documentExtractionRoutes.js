const express = require('express');
const multer = require('multer');
const { auth, hasAnyRoleOrModulePermission } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { extractDocument } = require('../controllers/documentExtractionController');

const router = express.Router();
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp'
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, callback) => {
    const validExtension = /\.(pdf|png|jpe?g|webp)$/i.test(String(file.originalname || ''));
    if (ALLOWED_MIME_TYPES.has(file.mimetype) && validExtension) return callback(null, true);
    return callback(new Error('Solo se permiten archivos PDF, PNG, JPG, JPEG o WEBP.'));
  }
});

const canExtractDocuments = hasAnyRoleOrModulePermission({
  roles: [
    ROLES.ADMINISTRADOR,
    ROLES.PLANEACION_ESTRATEGICA,
    ROLES.PLANEACION_EFECTIVIDAD,
    ROLES.AUTOEVALUACION,
    ROLES.GESTION_INFORMACION
  ],
  moduleKeys: [
    'gestion_informacion',
    'saber_pro',
    'saber_pro_consulta_individual',
    'saber_pro_validacion_masiva'
  ]
});

const uploadDocumentBatch = (req, res, next) => {
  upload.array('archivos', 20)(req, res, (error) => {
    if (!error) {
      const totalSize = (req.files || []).reduce((sum, file) => sum + Number(file.size || 0), 0);
      if (totalSize > 60 * 1024 * 1024) {
        return res.status(413).json({ success: false, code: 'DOCUMENT_BATCH_TOO_LARGE', message: 'El lote completo supera el limite de 60 MB.' });
      }
      return next();
    }
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ success: false, code: 'DOCUMENT_TOO_LARGE', message: 'El archivo supera el limite de 12 MB.' });
    }
    return res.status(415).json({ success: false, code: 'DOCUMENT_TYPE_NOT_ALLOWED', message: error.message });
  });
};

router.post('/', auth, canExtractDocuments, uploadDocumentBatch, extractDocument);

module.exports = router;
