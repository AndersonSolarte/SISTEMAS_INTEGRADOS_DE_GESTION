const express = require('express');
const router  = express.Router();
const { auth } = require('../middlewares/auth');
const { getStats } = require('../controllers/activityController');
const { getUserModulePermissions } = require('../utils/modulePermissions');

const checkAccess = async (req, res, next) => {
  try {
    if (req.user?.role === 'administrador' || req.user?.role === 'planeacion_estrategica') {
      return next();
    }
    
    // Fetch user permissions accurately
    const perms = await getUserModulePermissions(req.user.id, req.user.role);
    const allowedModules = perms.allowedModules || [];
    
    if (!allowedModules.includes('monitor_actividad')) {
      return res.status(403).json({ success: false, message: 'Acceso restringido al administrador.' });
    }
    
    next();
  } catch (err) {
    console.error('Error in checkAccess middleware:', err);
    return res.status(500).json({ success: false, message: 'Error interno validando permisos.' });
  }
};

router.get('/stats', auth, checkAccess, getStats);

module.exports = router;
