// Solo para el proceso temporal creado por validate-release.cjs. No se carga en produccion.
const path = require('path');
const fs = require('fs');
const net = require('net');
const http = require('http');
const root = path.resolve(__dirname, '../..');
if (process.env.SIAC_ISOLATED_VALIDATION !== 'true') throw new Error('Preload exclusivo de validacion aislada.');
const fixtureRoot = path.dirname(path.resolve(process.env.SIAC_UPLOADS_DIR || '.'));
const pidFile = path.join(fixtureRoot, 'database/postmaster.pid');
if (process.env.DB_HOST !== '127.0.0.1' || process.env.DB_NAME !== 'validation_db'
  || !fixtureRoot.startsWith(path.join(root, 'tmp/release-isolated-')) || !fs.existsSync(pidFile)
  || fs.readFileSync(pidFile, 'utf8').split(/\r?\n/)[3].trim() !== process.env.DB_PORT) {
  throw new Error('El preload requiere el cluster temporal generado por el validador.');
}

const allowedPorts = new Set([Number(process.env.DB_PORT)]);
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  const normalized = Array.isArray(args[0]) ? args[0] : args;
  const options = typeof normalized[0] === 'object' ? normalized[0] : { port: normalized[0], host: normalized[1] };
  const host = options.host || 'localhost';
  if (!['127.0.0.1', 'localhost', '::1'].includes(host) || !allowedPorts.has(Number(options.port))) {
    throw new Error('Salida de red bloqueada en validacion aislada.');
  }
  return connect.apply(this, args);
};
global.fetch = async () => { throw new Error('HTTP externo bloqueado en validacion aislada.'); };
const listen = http.Server.prototype.listen;
http.Server.prototype.listen = function (...args) {
  if (typeof args[0] === 'number') args.splice(1, 0, '127.0.0.1');
  return listen.apply(this, args);
};

// Solo se simulan las fronteras con proveedores; el resto usa controladores y DB reales.
const { OAuth2Client } = require(path.join(root, 'backend/node_modules/google-auth-library'));
OAuth2Client.prototype.verifyIdToken = async ({ idToken }) => {
  if (!['fixture-admin', 'fixture-reader', 'fixture-external'].includes(idToken)) throw new Error('Credencial de prueba rechazada.');
  return { getPayload: () => ({
    email: idToken === 'fixture-admin' ? process.env.VALIDATION_ADMIN_EMAIL
      : idToken === 'fixture-reader' ? process.env.VALIDATION_READER_EMAIL : 'outsider@external.invalid',
    email_verified: true, hd: idToken === 'fixture-external' ? 'external.invalid' : 'example.invalid',
    iat: Math.floor(Date.now() / 1000)
  }) };
};
require(path.join(root, 'backend/src/utils/turnstile')).verifyTurnstileToken = async ({ token }) => token === 'fixture-challenge'
  ? { success: true } : { success: false, status: 403, message: 'Desafio de prueba rechazado.' };
require(path.join(root, 'backend/src/services/desplazamientoViaticos/legalizacionSubmissionQueue')).startSubmissionEmailWorker = () => {};
require(path.join(root, 'backend/src/server'));
