const jwt = require('jsonwebtoken');
const { jwtSecret, signOptions } = require('../config/jwt');
const { User } = require('../models');

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ where: { email } });
    
    if (!user || user.estado !== 'activo') {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, signOptions);
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: { token, user: { id: user.id, nombre: user.nombre, email: user.email, role: user.role } }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
};

const getProfile = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

module.exports = { login, getProfile };