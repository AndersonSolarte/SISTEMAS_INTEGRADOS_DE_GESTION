const express = require('express');
const router = express.Router();
const multer = require('multer');
const {
  createUser,
  getUsers,
  updateUser,
  resetTemporaryPasswordByAdmin,
  updateUserStatus,
  deleteUser,
  bulkUploadUsers,
  requestPasswordReset,
  resetPassword
} = require('../controllers/userController');
const { auth, isAdmin } = require('../middlewares/auth');

const upload = multer({ dest: 'uploads/temp/' });

// Rutas protegidas - solo admin
router.post('/', auth, isAdmin, createUser);
router.get('/', auth, isAdmin, getUsers);
router.put('/:id', auth, isAdmin, updateUser);
router.post('/:id/reset-temp-password', auth, isAdmin, resetTemporaryPasswordByAdmin);
router.patch('/:id/status', auth, isAdmin, updateUserStatus);
router.delete('/:id', auth, isAdmin, deleteUser);
router.post('/bulk-upload', auth, isAdmin, upload.single('file'), bulkUploadUsers);

// Rutas públicas de recuperación
router.post('/request-password-reset', requestPasswordReset);
router.post('/reset-password', resetPassword);

module.exports = router;
