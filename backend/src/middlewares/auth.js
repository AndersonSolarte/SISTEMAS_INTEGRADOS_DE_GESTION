const jwt = require('jsonwebtoken');
const { jwtSecret, verifyOptions } = require('../config/jwt');
const { Op } = require('sequelize');
const { User, UserModulePermission } = require('../models');
const trackActivity = require('./trackActivity');

const enforceTokenVersion = String(process.env.ENFORCE_TOKEN_VERSION || 'true').toLowerCase() !== 'false';
const getUserSessionVersion = (user) => {
  const updatedAt = user?.updated_at || user?.updatedAt;
  const timestamp = updatedAt ? new Date(updatedAt).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
};

const auth = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ success: false, message: 'No se proporciono token' });

    const decoded = jwt.verify(token, jwtSecret, verifyOptions);
    const user = await User.findByPk(decoded.id);

    if (!user || user.estado !== 'activo' || user.email !== decoded.email || user.role !== decoded.role) {
      return res.status(401).json({ success: false, message: 'Token invalido' });
    }

    if (enforceTokenVersion && Number(decoded.sv || 0) !== getUserSessionVersion(user)) {
      return res.status(401).json({ success: false, message: 'Sesion expirada. Inicia sesion nuevamente.' });
    }

    req.user = user;
    trackActivity(req, res, next);
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token invalido' });
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
