const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('./strategicPlanningEmailService');

const PLAN_ENV_KEYS = [
  'PLAN_ACTION_SMTP_HOST', 'PLAN_ACTION_SMTP_PORT', 'PLAN_ACTION_SMTP_SECURE',
  'PLAN_ACTION_SMTP_AUTH', 'PLAN_ACTION_SMTP_REQUIRE_TLS',
  'PLAN_ACTION_SMTP_USER', 'PLAN_ACTION_SMTP_PASS', 'PLAN_ACTION_SMTP_FROM',
  'PLAN_ACTION_REPLY_TO', 'PLAN_ACTION_EMAIL_AUTH_METHOD',
  'PLAN_ACTION_GOOGLE_CLIENT_ID', 'PLAN_ACTION_GOOGLE_CLIENT_SECRET',
  'PLAN_ACTION_GOOGLE_REFRESH_TOKEN', 'SMTP_USER'
];

const withPlanEnvironment = (values, callback) => {
  const original = Object.fromEntries(PLAN_ENV_KEYS.map((key) => [key, process.env[key]]));
  Object.entries(values).forEach(([key, value]) => { process.env[key] = value; });
  try {
    return callback();
  } finally {
    PLAN_ENV_KEYS.forEach((key) => {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    });
  }
};

test('usa exclusivamente las credenciales del correo de Planes de Acción', () => {
  withPlanEnvironment({
    PLAN_ACTION_SMTP_HOST: 'smtp.gmail.com',
    PLAN_ACTION_SMTP_PORT: '587',
    PLAN_ACTION_SMTP_SECURE: 'false',
    PLAN_ACTION_SMTP_USER: 'planeacionestrategica@unicesmag.edu.co',
    PLAN_ACTION_SMTP_PASS: '1234567890123456'
  }, () => {
    process.env.SMTP_USER = 'otro-modulo@unicesmag.edu.co';
    const config = _internals.resolveConfig();
    assert.equal(config.user, 'planeacionestrategica@unicesmag.edu.co');
    assert.doesNotMatch(config.from, /otro-modulo/);
  });
});

test('rechaza iniciar el transporte sin la clave exclusiva', () => {
  withPlanEnvironment({
    PLAN_ACTION_SMTP_USER: 'planeacionestrategica@unicesmag.edu.co',
    PLAN_ACTION_SMTP_PASS: ''
  }, () => {
    assert.throws(() => _internals.resolveConfig(), /PLAN_ACTION_SMTP_PASS/);
  });
});

test('permite SMTP Relay por IP sin contraseña', () => {
  withPlanEnvironment({
    PLAN_ACTION_SMTP_HOST: 'smtp-relay.gmail.com',
    PLAN_ACTION_SMTP_AUTH: 'false',
    PLAN_ACTION_SMTP_REQUIRE_TLS: 'true',
    PLAN_ACTION_SMTP_USER: 'planeacionestrategica@unicesmag.edu.co',
    PLAN_ACTION_SMTP_PASS: ''
  }, () => {
    const config = _internals.resolveConfig();
    assert.equal(config.authRequired, false);
    assert.equal(config.requireTLS, true);
    assert.equal(config.pass, '');
  });
});

test('permite Gmail API con OAuth 2.0 sin contraseña SMTP', () => {
  withPlanEnvironment({
    PLAN_ACTION_EMAIL_AUTH_METHOD: 'oauth2',
    PLAN_ACTION_SMTP_USER: 'planeacionestrategica@unicesmag.edu.co',
    PLAN_ACTION_SMTP_PASS: '',
    PLAN_ACTION_GOOGLE_CLIENT_ID: 'oauth-client-id',
    PLAN_ACTION_GOOGLE_CLIENT_SECRET: 'oauth-client-secret',
    PLAN_ACTION_GOOGLE_REFRESH_TOKEN: 'oauth-refresh-token'
  }, () => {
    const config = _internals.resolveConfig();
    assert.equal(config.authMethod, 'oauth2');
    assert.equal(config.authRequired, false);
    assert.equal(config.oauthRefreshToken, 'oauth-refresh-token');
  });
});

test('permite destinatarios externos válidos para las firmas', () => {
  assert.equal(_internals.normalizeRecipient(' Persona@Ejemplo.com '), 'persona@ejemplo.com');
  assert.throws(() => _internals.normalizeRecipient('correo-invalido'));
});
