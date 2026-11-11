const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const runInvalidRestore = async (environment) => {
  const state = { status: null, payload: null, blocked: [], deleted: false, databaseProcessStarted: false };
  const user = { id: 1, email: 'fixture@example.invalid', estado: 'activo' };
  const dependencies = {
    fs: { existsSync: () => true, unlinkSync: () => { state.deleted = true; }, rmSync: () => {} },
    path, crypto: require('crypto'),
    child_process: { spawn: () => { state.databaseProcessStarted = true; throw new Error('Proceso no permitido en esta prueba.'); } },
    xlsx: {}, sequelize: { QueryTypes: {} },
    'google-auth-library': { OAuth2Client: class { async verifyIdToken() { return { getPayload: () => ({ email: user.email, email_verified: true, iat: Math.floor(Date.now() / 1000) }) }; } } },
    '../config/database': { sequelize: {} }, '../models': { User: { findByPk: async () => user } },
    '../utils/turnstile': { verifyTurnstileToken: async () => ({ success: true }) },
    '../services/databaseBackupScheduler': {
      isBackupRunning: () => false, setBackupBlocked: (value) => state.blocked.push(value)
    },
    '../services/integralBackupService': {
      UPLOADS_ROOT: '/fixture/uploads',
      extractIntegralBundle: async () => { throw new Error('Detalle privado de validacion /fixture/private/path'); }
    }
  };
  const module = { exports: {} };
  const context = vm.createContext({ module, exports: module.exports,
    process: { env: { NODE_ENV: environment, GOOGLE_CLIENT_ID: 'fixture-client' } }, console,
    require: (name) => { if (!(name in dependencies)) throw new Error(`Dependencia inesperada: ${name}`); return dependencies[name]; }
  });
  new vm.Script(fs.readFileSync(path.join(__dirname, 'databaseCenterController.js'), 'utf8')).runInContext(context);
  const response = { status(code) { state.status = code; return this; }, json(payload) { state.payload = payload; return this; } };
  await module.exports.restoreDatabaseDump({ user, ip: '127.0.0.1',
    body: { googleCredential: 'fixture-credential', turnstileToken: 'fixture-challenge' },
    file: { originalname: 'fixture.siacbackup', path: '/fixture/uploaded-file' }
  }, response);
  return state;
};

test('la restauracion invalida en produccion no expone errores internos ni toca PostgreSQL', async () => {
  const result = await runInvalidRestore('production');
  assert.equal(result.status, 500);
  assert.equal(result.payload.detail, undefined);
  assert.equal(result.databaseProcessStarted, false);
  assert.equal(result.deleted, true);
  assert.deepEqual(result.blocked, [true, false]);
});

test('desarrollo conserva el diagnostico sin iniciar restauracion de un paquete invalido', async () => {
  const result = await runInvalidRestore('development');
  assert.equal(result.status, 500);
  assert.match(result.payload.detail, /Detalle privado de validacion/);
  assert.equal(result.databaseProcessStarted, false);
  assert.deepEqual(result.blocked, [true, false]);
});
