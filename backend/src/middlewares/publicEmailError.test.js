const test = require('node:test');
const assert = require('node:assert/strict');
const { publicEmailErrorReference, handlePublicEmailCorsError } = require('./publicEmailError');

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

test('un rechazo CORS de viáticos muestra una página legible sin tokens ni rutas internas', () => {
  const token = 'secreto.que.no_publicamos';
  const error = Object.assign(new Error('CORS C:\\servidor\\backend\\archivo.js token=' + token), { code: 'CORS_ORIGIN_DENIED' });
  const headers = {};
  let status, type, body;
  const res = {
    setHeader(name, value) { headers[name] = value; },
    status(value) { status = value; return this; }, type(value) { type = value; return this; }, send(value) { body = value; return this; }
  };
  const req = { method: 'POST', originalUrl: `/api/desplazamientos-viaticos/accion/${token}`,
    headers: { 'sec-fetch-mode': 'navigate', 'sec-fetch-dest': 'document' } };
  assert.equal(handlePublicEmailCorsError(error, req, res), true);
  assert.equal(status, 403); assert.equal(type, 'html'); assert.equal(headers['Cache-Control'], 'no-store');
  assert.match(body, /SIAC UNICESMAG/); assert.match(body, /No se registró ninguna decisión/);
  assert.ok(!body.includes(token)); assert.ok(!body.includes(error.message)); assert.ok(!body.includes('archivo.js'));
  assert.equal(handlePublicEmailCorsError(error, { ...req, originalUrl: '/api/users' }, res), false);
  assert.equal(handlePublicEmailCorsError(error, { ...req, headers: { 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' } }, res), false);
  assert.equal(handlePublicEmailCorsError(new Error('otro'), req, res), false);
});
