require('dotenv').config();

const rawJwtSecret = String(process.env.JWT_SECRET || '').trim();
if (!rawJwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en produccion.');
  }
  console.warn('Aviso de seguridad: JWT_SECRET no definido. Usa una clave robusta en backend/.env.');
}

module.exports = {
  jwtSecret: rawJwtSecret || 'dev_only_replace_jwt_secret',
  jwtExpire: process.env.JWT_EXPIRE || '7d',
  signOptions: { expiresIn: process.env.JWT_EXPIRE || '7d' },
  verifyOptions: { algorithms: ['HS256'] }
};
