const test = require('node:test');
const assert = require('node:assert/strict');
const { publicEmailErrorReference } = require('./publicEmailError');

test('un error previo al controlador devuelve referencia sin registrar el token', (t) => {
  const log = t.mock.method(console, 'error', () => {});
  const token = 'token-secreto-de-prueba';
  const error = new Error(`falló ${token}`);
  const reference = publicEmailErrorReference({ originalUrl: `/api/reporte-salida/aprobar/${token}`, method: 'GET' }, error, 500);
  assert.match(reference, /^[0-9a-f-]{36}$/);
  const logged = JSON.stringify(log.mock.calls.map((call) => call.arguments));
  assert.ok(!logged.includes(token));
  assert.ok(logged.includes(reference));
  assert.equal(publicEmailErrorReference({ originalUrl: '/api/users' }, error, 500), undefined);
  assert.equal(publicEmailErrorReference({ originalUrl: `/api/reporte-salida/aprobar/${token}` }, error, 403), undefined);
  assert.equal(log.mock.calls.length, 1);
});
