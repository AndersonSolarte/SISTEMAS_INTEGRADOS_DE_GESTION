const test = require('node:test');
const assert = require('node:assert/strict');
const { sqlInjectionGuard } = require('./security');

const runGuard = (originalUrl, signatureLength) => {
  const req = {
    originalUrl,
    query: {},
    params: { token: 'token-seguro' },
    body: { participant_id: '1', otp: '123456', signature_data: `data:image/png;base64,${'A'.repeat(signatureLength)}` },
    ip: '127.0.0.1',
    method: 'POST'
  };
  let response = null;
  let continued = false;
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; return response; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  return { response, continued };
};

test('permite la imagen de firma del acta digital dentro del límite seguro', () => {
  const result = runGuard('/api/meeting-minutes/public/token-seguro/sign', 20000);
  assert.equal(result.continued, true);
  assert.equal(result.response, null);
});

test('mantiene el límite general para campos grandes en otras rutas', () => {
  const result = runGuard('/api/otra-ruta', 20000);
  assert.equal(result.continued, false);
  assert.equal(result.response.status, 413);
});

test('permite campos de texto enriquecido extensos en el borrador del acta de reunión', () => {
  const req = {
    originalUrl: '/api/meeting-minutes',
    query: {},
    params: {},
    body: {
      objetivo: '<p>' + 'A'.repeat(30000) + '</p>',
      desarrollo: '<p>' + 'B'.repeat(80000) + '</p>',
      conclusiones: '<p>' + 'C'.repeat(30000) + '</p>'
    },
    ip: '127.0.0.1',
    method: 'POST'
  };
  let response = null;
  let continued = false;
  const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; return response; } }) };
  sqlInjectionGuard(req, res, () => { continued = true; });
  assert.equal(continued, true);
  assert.equal(response, null);
});

