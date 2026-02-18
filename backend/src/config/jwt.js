require('dotenv').config();

module.exports = {
  jwtSecret: process.env.JWT_SECRET || 'clave_por_defecto',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  signOptions: { expiresIn: process.env.JWT_EXPIRE || '7d' },
  verifyOptions: { algorithms: ['HS256'] }
};