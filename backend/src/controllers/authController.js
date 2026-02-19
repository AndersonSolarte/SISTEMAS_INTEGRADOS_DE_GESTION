const jwt = require('jsonwebtoken');
const { jwtSecret, signOptions } = require('../config/jwt');
const { User } = require('../models');
const { Op } = require('sequelize');

const validarDominioInstitucional = (email = '') => /^[a-zA-Z0-9._%+-]+@unicesmag\.edu\.co$/.test(String(email).toLowerCase());

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const identifier = (email || '').trim();

    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: 'Debe enviar usuario/correo y contraseña' });
    }

    const user = await User.findOne({
      where: {
        [Op.or]: [
          { email: identifier },
          { username: identifier }
        ]
      }
    });
    
    if (!user) {
      if (validarDominioInstitucional(identifier)) {
        return res.status(404).json({
          success: false,
          message: 'Tu correo institucional no está registrado. Solicita creación de usuario al administrador.'
        });
      }
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }

    if (user.estado !== 'activo') {
      return res.status(403).json({ success: false, message: 'Tu usuario está inactivo. Contacta al administrador.' });
    }
    
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Credenciales inválidas' });
    }
    
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, jwtSecret, signOptions);
    await user.update({ last_login: new Date() });
    
    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        requiresPasswordChange: Boolean(user.must_change_password),
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          role: user.role,
          must_change_password: Boolean(user.must_change_password)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al iniciar sesión' });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Debes enviar contraseña actual y nueva contraseña' });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ success: false, message: 'La contraseña actual no es correcta' });
    }

    await user.update({
      password: newPassword,
      must_change_password: false,
      reset_token: null,
      reset_token_expiry: null
    });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente',
      data: {
        user: {
          id: user.id,
          nombre: user.nombre,
          email: user.email,
          role: user.role,
          must_change_password: false
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error al actualizar contraseña' });
  }
};

const getProfile = async (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

module.exports = { login, getProfile, changePassword };
