const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowAutoevaluacionUpload, allowAutoevaluacionDataset } = require('./autoevaluacionDatasetPermission');

const denied = (_req, res) => { res.denied = true; };
const check = (middleware, req) => {
  const res = {};
  middleware(req, res, () => { res.allowed = true; });
  return res;
};

test('Autoevaluacion can download templates and import its three subbases', () => {
  for (const subcategoria of ['autoevaluacion', 'participantes', 'informacion_programas']) {
    for (const source of ['query', 'body']) {
      assert.equal(check(allowAutoevaluacionDataset(denied), {
        user: { role: 'autoevaluacion' },
        [source]: { categoria: 'Autoevaluación', subcategoria }
      }).allowed, true);
    }
  }
});

test('other categories and missing categories still require database import permission', () => {
  for (const categoria of ['', 'Poblacional', 'Registros Calificados y Acreditacion']) {
    assert.equal(check(allowAutoevaluacionDataset(denied), {
      user: { role: 'autoevaluacion' }, body: { categoria }
    }).denied, true);
  }
});

test('multipart body takes precedence over query to prevent category spoofing', () => {
  assert.equal(check(allowAutoevaluacionDataset(denied), {
    user: { role: 'autoevaluacion' },
    query: { categoria: 'autoevaluacion' }, body: { categoria: 'Poblacional' }
  }).denied, true);
});

test('other roles retain the existing permission check', () => {
  const req = { user: { role: 'consulta' }, query: { categoria: 'autoevaluacion' } };
  assert.equal(check(allowAutoevaluacionUpload(denied), req).denied, true);
  assert.equal(check(allowAutoevaluacionDataset(denied), req).denied, true);
  assert.equal(check(allowAutoevaluacionDataset((_req, _res, next) => next()), req).allowed, true);
});

test('Autoevaluacion can reach multipart parsing before its category is checked', () => {
  assert.equal(check(allowAutoevaluacionUpload(denied), {
    user: { role: 'autoevaluacion' }
  }).allowed, true);
});
