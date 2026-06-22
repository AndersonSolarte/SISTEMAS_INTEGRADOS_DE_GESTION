require('dotenv').config();

const rawJwtSecret = String(process.env.JWT_SECRET || '').trim();
if (!rawJwtSecret) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET es obligatorio en produccion.');
  }
  console.warn('Aviso de seguridad: JWT_SECRET no definido. Usa una clave robusta en backend/.env.');
}

if (
  process.env.NODE_ENV === 'production' &&
  (rawJwtSecret.length < 32 || rawJwtSecret === 'dev_only_replace_jwt_secret')
) {
  throw new Error('JWT_SECRET debe tener al menos 32 caracteres y no puede ser el valor de desarrollo.');
}

module.exports = {
  jwtSecret: rawJwtSecret || 'dev_only_replace_jwt_secret',
  jwtExpire: process.env.JWT_EXPIRE || '8h',
  signOptions: { expiresIn: process.env.JWT_EXPIRE || '8h' },
  verifyOptions: { algorithms: ['HS256'] }
};
