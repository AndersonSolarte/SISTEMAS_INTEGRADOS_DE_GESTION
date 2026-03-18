const express = require('express');
const router = express.Router();
const {
  createUser,
  getUsers,
  updateUser,
  downloadUsersTemplate,
  updateUserStatus,
  deleteUser,
  bulkUploadUsers,
  getUserModulePermissions,
  updateUserModulePermissions
} = require('../controllers/userController');
const { auth, hasAnyRole } = require('../middlewares/auth');
const { ROLES } = require('../constants/roles');
const { createExcelUpload } = require('../middlewares/excelUpload');

const upload = createExcelUpload('uploads/temp/');

const canManageUsers = hasAnyRole(ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.GESTION_PROCESOS);

// Rutas protegidas - admin general y planeación estratégica (con restricciones internas por rol objetivo)
router.post('/', auth, canManageUsers, createUser);
router.get('/', auth, canManageUsers, getUsers);
router.put('/:id', auth, canManageUsers, updateUser);
router.patch('/:id/status', auth, canManageUsers, updateUserStatus);
router.delete('/:id', auth, canManageUsers, deleteUser);
router.get('/template', auth, canManageUsers, downloadUsersTemplate);
router.get('/:id/module-permissions', auth, canManageUsers, getUserModulePermissions);
router.put('/:id/module-permissions', auth, canManageUsers, updateUserModulePermissions);
router.post('/bulk-upload', auth, canManageUsers, upload.single('file'), bulkUploadUsers);

module.exports = router;
