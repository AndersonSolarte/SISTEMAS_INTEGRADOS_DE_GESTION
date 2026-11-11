const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('./strategicPlanningEmailService');

const PLAN_ENV_KEYS = [
  'PLAN_ACTION_SMTP_HOST', 'PLAN_ACTION_SMTP_PORT', 'PLAN_ACTION_SMTP_SECURE',
  'PLAN_ACTION_SMTP_AUTH', 'PLAN_ACTION_SMTP_REQUIRE_TLS',
  'PLAN_ACTION_SMTP_USER', 'PLAN_ACTION_SMTP_PASS', 'PLAN_ACTION_SMTP_FROM',
  'PLAN_ACTION_REPLY_TO', 'PLAN_ACTION_EMAIL_AUTH_METHOD',
  'PLAN_ACTION_GOOGLE_CLIENT_ID', 'PLAN_ACTION_GOOGLE_CLIENT_SECRET',
  'PLAN_ACTION_GOOGLE_REFRESH_TOKEN', 'SMTP_USER', 'SMTP_PASS', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_FROM'
];

const withPlanEnvironment = (values, callback) => {
  const original = Object.fromEntries(PLAN_ENV_KEYS.map((key) => [key, process.env[key]]));
  PLAN_ENV_KEYS.forEach((key) => { delete process.env[key]; });
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

test('la cuenta dedicada no consume la clave de la cuenta general', () => {
  withPlanEnvironment({
    PLAN_ACTION_SMTP_USER: 'planeacionestrategica@unicesmag.edu.co',
    SMTP_USER: 'general@example.invalid', SMTP_PASS: 'fixture-general-mail-secret'
  }, () => {
    assert.throws(() => _internals.resolveConfig(), /PLAN_ACTION_SMTP_PASS/);
  });
});

test('sin cuenta dedicada usa el grupo completo de la cuenta general', () => {
  withPlanEnvironment({
    SMTP_USER: 'general@example.invalid', SMTP_PASS: 'fixture-general-mail-secret',
    SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: '465', SMTP_SECURE: 'true', SMTP_FROM: 'general@example.invalid',
    PLAN_ACTION_SMTP_HOST: 'unused.example.invalid', PLAN_ACTION_EMAIL_AUTH_METHOD: 'oauth2'
  }, () => {
    const config = _internals.resolveConfig();
    assert.equal(config.user, 'general@example.invalid');
    assert.equal(config.pass, 'fixture-general-mail-secret');
    assert.equal(config.host, 'smtp.example.invalid');
    assert.equal(config.port, 465);
    assert.equal(config.secure, true);
    assert.equal(config.authMethod, 'password');
    assert.equal(config.from, 'general@example.invalid');
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

test('enruta siempre replyTo a planeacionestrategica@unicesmag.edu.co por defecto', () => {
  withPlanEnvironment({
    PLAN_ACTION_SMTP_USER: 'otro_usuario@unicesmag.edu.co',
    PLAN_ACTION_SMTP_PASS: 'clave12345678901'
  }, () => {
    const config = _internals.resolveConfig();
    assert.equal(config.replyTo, 'planeacionestrategica@unicesmag.edu.co');
    const mailOptions = _internals.buildMailOptions({
      config,
      recipients: ['participante@unicesmag.edu.co'],
      subject: 'Prueba',
      text: 'Contenido'
    });
    assert.equal(mailOptions.replyTo, 'planeacionestrategica@unicesmag.edu.co');
  });
});
