const { test } = require('node:test');
const assert = require('node:assert/strict');
const { trackingProgress, scheduleStatus, validateTracking } = require('./improvementIndicatorTracking');
const activity = { indicadorResultadoActivo: true, indicadorLogroActivo: true, indicadorImpactoActivo: true,
  fechaInicioResultado: '2026-01-01', fechaFinResultado: '2026-06-30', seguimientoIndicadores: {
    Resultado: { porcentaje: 100, fecha: '2026-02-01', evidencias: [{ driveFileId: 'a' }] },
    Logro: { porcentaje: 50, fecha: '2026-02-01', evidencias: [{ driveFileId: 'b' }] },
    Impacto: { porcentaje: 100, fecha: '2026-02-01', evidencias: [] }
  } };
test('all active indicators share activity weight and no evidence gives zero progress', () => {
  assert.equal(trackingProgress(activity), 50);
  assert.equal(trackingProgress({ ...activity, indicadorImpactoActivo: false }), 75);
  assert.equal(trackingProgress({ ...activity, seguimientoIndicadores: {} }), 0);
});
test('dates never generate progress and reveal pending or overdue work', () => {
  const pending = { ...activity, seguimientoIndicadores: {} };
  assert.equal(scheduleStatus(pending, 'Resultado', '2025-12-31'), 'Por iniciar');
  assert.equal(scheduleStatus(pending, 'Resultado', '2026-03-01'), 'En plazo');
  assert.equal(scheduleStatus(pending, 'Resultado', '2026-07-01'), 'Vencido');
  assert.equal(trackingProgress(pending), 0);
});
test('positive progress requires own evidence and date from the programmed start', () => {
  assert.throws(() => validateTracking(activity), /Impacto/);
  assert.throws(() => validateTracking({ indicadorResultadoActivo: true, fechaInicioResultado: '2026-01-01', seguimientoIndicadores: { Resultado: { porcentaje: 30, fecha: '2025-12-31', evidencias: [{}] } } }), /inicio/);
  assert.doesNotThrow(() => validateTracking({ ...activity, indicadorImpactoActivo: false }));
});
