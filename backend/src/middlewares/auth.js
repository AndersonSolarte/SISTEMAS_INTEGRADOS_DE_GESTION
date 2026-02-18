const jwt = require('jsonwebtoken');
const { jwtSecret } = require('../config/jwt');
const { User } = require('../models');

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
    next();
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

module.exports = { auth, isAdmin, adminAuth: [auth, isAdmin] };