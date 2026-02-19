const express = require('express');
const router = express.Router();
const {
  upload,
  createDocumento,
  getDocumentosManagement,
  getDocumento,
  updateDocumento,
  deleteDocumento,
  restoreDocumento,
  downloadDocumento
} = require('../controllers/documentoManagementController');
const { auth, isAdmin } = require('../middlewares/auth');

// Gestión de documentos (solo admin)
router.post('/', auth, isAdmin, upload.single('file'), createDocumento);
router.get('/', auth, isAdmin, getDocumentosManagement);
router.get('/:id', auth, isAdmin, getDocumento);
router.put('/:id', auth, isAdmin, upload.single('file'), updateDocumento);
router.delete('/:id', auth, isAdmin, deleteDocumento);
router.patch('/:id/restore', auth, isAdmin, restoreDocumento);
router.get('/:id/download', auth, isAdmin, downloadDocumento);

module.exports = router;
