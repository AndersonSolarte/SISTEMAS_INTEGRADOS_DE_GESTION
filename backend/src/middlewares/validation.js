const { validationResult } = require('express-validator');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: 'Errores de validación', errors: errors.array() });
  }
  next();
};

const handleSequelizeError = (error, res) => {
  if (error.name === 'SequelizeValidationError' || error.name === 'SequelizeUniqueConstraintError') {
    return res.status(400).json({ success: false, message: error.message });
  }
  return res.status(500).json({ success: false, message: 'Error interno del servidor' });
};

module.exports = { validate, handleSequelizeError };