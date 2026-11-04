const { test } = require('node:test');
const assert = require('node:assert/strict');
const { periodCuts, fulfillment, periodContribution, trackCurrentFollowup } = require('./improvementMonitoringRules');

test('50 in July remains in monitoring 1, 80 in August goes to monitoring 2', () => {
  const cuts = periodCuts({ seguimientos: [
    { fecha: '2026-07-31', porcentaje: 50 },
    { fecha: '2026-08-01', porcentaje: 80 },
    { fecha: '2026-06-01', porcentaje: 20 }
  ] }, 2026);
  assert.equal(cuts.get(1).porcentaje, 50);
  assert.equal(cuts.get(2).porcentaje, 80);
});

test('fulfillment is the sum of both contributions per activity', () => {
  assert.equal(fulfillment([{ physical_progress: 40 }, { physical_progress: 60 }]), 100);
  assert.equal(fulfillment([{ physical_progress: 20 }]), 20);
  assert.equal(fulfillment([{ physical_progress: 40 }]), 40);
  assert.equal(fulfillment([{ physical_progress: 40 }, { physical_progress: 60, deleted_at: 'deleted' }]), 40);
});

test('improvement total is split into the period contribution without counting S1 twice', () => {
  assert.equal(periodContribution(40, []), 40);
  assert.equal(periodContribution(100, [{ physical_progress: 40 }]), 60);
  assert.equal(periodContribution(80, [{ physical_progress: 40 }]), 40);
  assert.equal(periodContribution(40, [{ physical_progress: 40 }]), 0);
  assert.throws(() => periodContribution(30, [{ physical_progress: 40 }]), /no puede ser menor/);
});

test('skip other years, evidence-only history and reverse synchronization records', () => {
  const cuts = periodCuts({ seguimientos: [
    { fecha: '2025-07-31', porcentaje: 50 },
    { id: 'seg-pa-file', fecha: '2026-07-31', porcentaje: 100 },
    { origen: 'plan_accion', fecha: '2026-08-01', porcentaje: 80 }
  ] }, 2026);
  assert.equal(cuts.size, 0);
});

test('reverse records never become a new forward cut', () => {
  assert.equal(periodCuts({ fechaSeguimiento: '2026-08-01', metaAlcanzada: 80,
    seguimientos: [{ origen: 'plan_accion', fecha: '2026-08-01', porcentaje: 80 }]
  }, 2026).size, 0);
});

test('one percent is one percent and zero is a valid reported value', () => {
  assert.equal(periodCuts({ seguimientos: [{ fecha: '2026-07-31', porcentaje: 1 }] }, 2026).get(1).porcentaje, 1);
  assert.equal(periodCuts({ seguimientos: [{ fecha: '2026-08-01', porcentaje: 0 }] }, 2026).get(2).porcentaje, 0);
});

test('autosaving 100 replaces the old 70 in synchronization without registering a cut', () => {
  const activity = { uid: 'a', metaAlcanzada: 70, fechaSeguimiento: '2026-12-31', observaciones: 'ok',
    seguimientos: [{ id: 'old-cut', fecha: '2026-12-31', porcentaje: 70 }] };
  const stored = { objetivos: [{ actividades: [activity] }] };
  const edited = { objetivos: [{ actividades: [{ ...activity, metaAlcanzada: 100 }] }] };
  const saved = trackCurrentFollowup(stored, edited, '2026-11-04T20:00:00Z');
  const current = saved.objetivos[0].actividades[0];
  assert.equal(periodCuts(current, 2026).get(2).porcentaje, 100);
  assert.equal(current.seguimientos[0].porcentaje, 70);
  assert.equal(periodContribution(periodCuts(current, 2026).get(2).porcentaje, []), 100);
  const repeated = trackCurrentFollowup(saved, edited);
  assert.deepEqual(repeated.objetivos[0].actividades[0].seguimientoActual, current.seguimientoActual);
});

test('editing a reverse synchronized value also propagates immediately', () => {
  const activity = { uid: 'a', metaAlcanzada: 70, fechaSeguimiento: '2026-12-31',
    seguimientos: [{ id: 'mon-pa-a', origen: 'plan_accion', fecha: '2026-12-31', porcentaje: 70 }] };
  const content = { objetivos: [{ actividades: [activity] }] };
  const edited = trackCurrentFollowup(content, { objetivos: [{ actividades: [{ ...activity, metaAlcanzada: 100 }] }] });
  assert.equal(periodCuts(edited.objetivos[0].actividades[0], 2026).get(2).porcentaje, 100);
  assert.equal(periodCuts(activity, 2026).size, 0);
});

test('a new S2 cumulative edit preserves S1 contribution and each activity stays independent', () => {
  const first = { uid: 'a', metaAlcanzada: 70, fechaSeguimiento: '2026-12-31', seguimientos: [{ fecha: '2026-07-31', porcentaje: 40 }] };
  const second = { uid: 'b', metaAlcanzada: 20, fechaSeguimiento: '2026-12-31' };
  const stored = { objetivos: [{ actividades: [first, second] }] };
  const saved = trackCurrentFollowup(stored, { objetivos: [{ actividades: [{ ...first, metaAlcanzada: 100 }, second] }] });
  const cuts = periodCuts(saved.objetivos[0].actividades[0], 2026);
  assert.equal(cuts.get(1).porcentaje, 40);
  assert.equal(periodContribution(cuts.get(2).porcentaje, [{ physical_progress: 40 }]), 60);
  assert.equal(saved.objetivos[0].actividades[1].seguimientoActual, undefined);
});
