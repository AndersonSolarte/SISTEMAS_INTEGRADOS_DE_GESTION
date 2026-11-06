const { test } = require('node:test');
const assert = require('node:assert/strict');
const { indicatorErrors, resolveActivityIndicators } = require('./activityIndicators');
test('active indicators require their own text, alphanumeric goal and both dates', () => {
  assert.deepEqual(Object.keys(indicatorErrors({ indicadorLogroActivo: true })), ['indicadorLogro', 'metaLogro', 'fechaInicioLogro', 'fechaFinLogro']);
});
test('complete indicator accepts text targets and rejects reversed or invalid dates', () => {
  const value = { indicadorResultadoActivo: true, indicadorResultado: 'Reportes', metaResultado: '12 reportes', fechaInicioResultado: '2026-11-01', fechaFinResultado: '2026-12-01' };
  assert.deepEqual(indicatorErrors(value), {});
  assert.ok(indicatorErrors({ ...value, fechaFinResultado: '2026-10-31' }).fechaFinResultado);
  assert.ok(indicatorErrors({ ...value, fechaFinResultado: '2026-02-30' }).fechaFinResultado);
});
test('removed indicators are exempt and old delivery dates become the end date', () => {
  assert.deepEqual(indicatorErrors({ indicadorLogroActivo: false, indicadorLogro: 'Historical' }), {});
  assert.equal(resolveActivityIndicators({ fechaEntregaLogro: '2026-12-01' }).fechaFinLogro, '2026-12-01');
});
