const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { validateProductionConfig } = require('./productionPreflight');
const fixture = () => ({ NODE_ENV: 'production', DB_HOST: '127.0.0.1', DB_NAME: 'fixture_db', DB_USER: 'fixture_user',
  DB_PASSWORD: crypto.randomBytes(24).toString('hex'), JWT_SECRET: crypto.randomBytes(48).toString('hex'),
  FRONTEND_URL: 'https://validation.invalid', GOOGLE_CLIENT_ID: 'fixture.apps.googleusercontent.com',
  TURNSTILE_SECRET_KEY: crypto.randomBytes(24).toString('hex') });

test('acepta configuracion completa sin emitir ni devolver secretos', () => {
  const env = fixture();
  const result = validateProductionConfig(env);
  assert.deepEqual(result.errors, []);
  assert.equal(JSON.stringify(result).includes(env.DB_PASSWORD), false);
  assert.equal(JSON.stringify(result).includes(env.JWT_SECRET), false);
});
test('rechaza configuracion incompleta y credenciales de prueba sin divulgar valores', () => {
  const env = fixture();
  delete env.DB_PASSWORD;
  env.JWT_SECRET = 'fixture-do-not-use-in-production';
  env.TURNSTILE_SECRET_KEY = `1x${'0'.repeat(29)}AA`;
  const result = validateProductionConfig(env);
  for (const name of ['DB_PASSWORD', 'JWT_SECRET', 'TURNSTILE_SECRET_KEY']) assert.ok(result.errors.some((error) => error.startsWith(`${name}:`)));
  assert.equal(JSON.stringify(result).includes(env.JWT_SECRET), false);
});
test('rechaza origen inseguro o con ruta y puertos invalidos', () => {
  for (const url of ['http://validation.invalid', 'https://validation.invalid/api', 'https://user:fixture@validation.invalid', 'not-a-url']) {
    assert.ok(validateProductionConfig({ ...fixture(), FRONTEND_URL: url }).errors.some((error) => error.startsWith('FRONTEND_URL:')));
  }
  for (const value of ['abc', '0', '65536']) assert.ok(validateProductionConfig({ ...fixture(), DB_PORT: value }).errors.some((error) => error.startsWith('DB_PORT:')));
});
