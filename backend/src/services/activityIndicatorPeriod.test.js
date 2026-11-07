const { test } = require('node:test');
const assert = require('node:assert/strict');
const { activityIndicatorPeriod } = require('./activityIndicators');

test('activity dates span only its active indicators', () => {
  const activity = {
    indicadorResultadoActivo: true, fechaInicioResultado: '2026-04-10', fechaFinResultado: '2026-06-20',
    indicadorLogroActivo: true, fechaInicioLogro: '2026-02-01', fechaFinLogro: '2026-10-31',
    indicadorImpactoActivo: false, fechaInicioImpacto: '2025-01-01', fechaFinImpacto: '2028-12-31'
  };
  assert.deepEqual(activityIndicatorPeriod(activity), { starts_on: '2026-02-01', ends_on: '2026-10-31' });
  assert.deepEqual(activityIndicatorPeriod({}), { starts_on: '', ends_on: '' });
  assert.deepEqual(activityIndicatorPeriod({ indicadorImpactoActivo: true, fechaInicioImpacto: '2027-01-01', fechaFinImpacto: '2027-02-01' }), { starts_on: '2027-01-01', ends_on: '2027-02-01' });
});
