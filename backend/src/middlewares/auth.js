const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/jwt');
const { Op } = require('sequelize');
const { User, UserModulePermission } = require('../models');
const trackActivity = require('./trackActivity');

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No se proporcionó token' });

    const decoded = jwt.verify(token, jwtSecret);
    const user = await User.findByPk(decoded.id);

    if (!user || user.estado !== 'activo') {
      return res.status(401).json({ success: false, message: 'Token inválido' });
    }

    req.user = user;
    trackActivity(req, res, next);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token inválido' });
  }
};

const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'administrador') {
    next();
  } else {
    return res.status(403).json({ success: false, message: 'Se requieren permisos de administrador' });
  }
};

const hasAnyRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autorizado' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para acceder a este recurso'
    });
  }

  next();
};

const hasAnyRoleOrModulePermission = ({ roles = [], moduleKeys = [] } = {}) => async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'No autorizado' });
  }

  if (roles.includes(req.user.role)) {
    return next();
  }

  const cleanModuleKeys = Array.from(new Set((Array.isArray(moduleKeys) ? moduleKeys : [])
    .map((x) => String(x || '').trim())
    .filter(Boolean)));

  if (cleanModuleKeys.length === 0 || !UserModulePermission) {
    return res.status(403).json({
      success: false,
      message: 'No tienes permisos para acceder a este recurso'
    });
  }

  try {
    const count = await UserModulePermission.count({
      where: {
        user_id: req.user.id,
        can_view: true,
        module_key: { [Op.in]: cleanModuleKeys }
      }
    });

    if (count > 0) {
      return next();
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Error validando permisos de acceso' });
  }

  return res.status(403).json({
    success: false,
    message: 'No tienes permisos para acceder a este recurso'
  });
};

module.exports = {
  auth,
  isAdmin,
  hasAnyRole,
  hasAnyRoleOrModulePermission,
  adminAuth: [auth, isAdmin]
};
