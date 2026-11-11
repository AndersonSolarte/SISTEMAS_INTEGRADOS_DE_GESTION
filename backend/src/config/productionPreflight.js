const fs = require('fs');

const validateProductionConfig = (env = process.env, { checkStorage = false } = {}) => {
  const errors = [];
  const warnings = [];
  for (const name of ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'JWT_SECRET', 'FRONTEND_URL', 'GOOGLE_CLIENT_ID', 'TURNSTILE_SECRET_KEY']) {
    if (!String(env[name] || '').trim()) errors.push(`${name}: falta configurar.`);
  }
  if (env.NODE_ENV !== 'production') errors.push('NODE_ENV: debe ser production.');
  const secret = String(env.JWT_SECRET || '');
  if (secret && (secret.length < 32 || /^(dev_only|fixture|example|replace|reemplaz|cambiar|changeme)/i.test(secret))) errors.push('JWT_SECRET: use una clave privada robusta de al menos 32 caracteres.');
  if (env.DB_PORT && (!/^\d+$/.test(String(env.DB_PORT)) || Number(env.DB_PORT) < 1 || Number(env.DB_PORT) > 65535)) errors.push('DB_PORT: puerto no valido.');
  if (env.FRONTEND_URL) {
    try {
      const url = new URL(env.FRONTEND_URL);
      if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) errors.push('FRONTEND_URL: debe ser el origen HTTPS publico, sin credenciales ni ruta.');
    } catch (_) { errors.push('FRONTEND_URL: URL no valida.'); }
  }
  if (/^[123]x0+AA$/.test(String(env.TURNSTILE_SECRET_KEY || ''))) errors.push('TURNSTILE_SECRET_KEY: no use una clave publica de prueba en produccion.');
  if (String(env.SIAC_AUTOMATIC_BACKUP_ENABLED || 'true').toLowerCase() === 'false') warnings.push('Copias automaticas deshabilitadas por configuracion.');
  if (checkStorage) {
    for (const [name, directory] of [['uploads', env.SIAC_UPLOADS_DIR || '/app/uploads'], ['respaldos', env.SIAC_BACKUP_STORAGE_DIR || '/app/automatic-backups'], ['temporales', env.TMPDIR || '/tmp']]) {
      try { fs.accessSync(directory, fs.constants.R_OK | fs.constants.W_OK); }
      catch (_) { errors.push(`Almacenamiento de ${name}: no es legible y escribible para el usuario del contenedor.`); }
    }
  }
  return { errors, warnings };
};

const main = async () => {
  const result = validateProductionConfig(process.env, { checkStorage: true });
  for (const warning of result.warnings) console.warn(`Aviso: ${warning}`);
  if (result.errors.length) {
    for (const error of result.errors) console.error(error);
    process.exitCode = 1;
    return;
  }
  if (process.argv.includes('--database')) {
    const { Client } = require('pg');
    const client = new Client({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 5432), database: process.env.DB_NAME,
      user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionTimeoutMillis: 10000,
      statement_timeout: 10000, application_name: 'siac_release_preflight', options: '-c default_transaction_read_only=on' });
    try { await client.connect(); await client.query('SELECT 1'); }
    catch (_) { console.error('PostgreSQL: no se pudo validar la conexion. No se iniciaron migraciones.'); process.exitCode = 1; return; }
    finally { await client.end().catch(() => {}); }
  }
  console.log('Preflight de produccion aprobado; no se imprimieron secretos ni se modificaron datos.');
};

module.exports = { validateProductionConfig };
if (require.main === module) main().catch(() => { console.error('No se pudo completar el preflight de produccion.'); process.exitCode = 1; });
