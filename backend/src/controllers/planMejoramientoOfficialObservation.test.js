const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const gate = require('../services/improvementActionPlanSyncGate');
const drive = require('../services/actionPlanRepositoryDriveService');

test('improvement follow-up cannot overwrite a corrected or deleted official concept', async () => {
  const restore = [];
  const stub = (object, key, value) => { restore.push([object, key, object[key]]); object[key] = value; };
  const result = { id: 'r', monitoring_period_id: 'p1', physical_progress: 20, async update(values) { Object.assign(this, values); } };
  const item = { id: 'a', action_plan_id: 'plan', actionPlan: { term_id: 'term', term: { year: 2026 } },
    custom_values: {}, async update(values) { Object.assign(this, values); } };
  stub(gate, 'canSynchronize', async () => ({ allowed: true }));
  stub(drive, 'syncSinglePlanOfficialWorkbook', async () => {});
  stub(models.StrategicActionItem, 'findByPk', async () => item);
  stub(models.StrategicMonitoringPeriod, 'findAll', async () => [{ id: 'p1', position: 1 }]);
  stub(models.StrategicMonitoringResult, 'findAll', async () => [result]);
  stub(models.StrategicMonitoringResult, 'findOrCreate', async () => [result, false]);
  const modulePath = require.resolve('./planMejoramientoController');
  const cached = require.cache[modulePath];
  delete require.cache[modulePath];
  try {
    const { syncLinkedActionPlansTracking } = require(modulePath);
    for (const concept of ['Concepto corregido por Planeación', '']) {
      item.custom_values = { official_observations: { p1: { text: concept } } };
      const plan = { contenido: { objetivos: [{ actividades: [{ uid: 'pm', linkedActionItemId: 'a',
        fechaSeguimiento: '2026-06-01', metaAlcanzada: 40, observaciones: 'Texto anterior del responsable'
      }] }] } };
      await syncLinkedActionPlansTracking(plan, { user: { id: 2, role: 'autoevaluacion' } });
      assert.equal(result.observations, concept || null);
      assert.equal(item.custom_values.observations_s1, concept);
      assert.equal(item.custom_values.official_observations.p1.text, concept);
    }
  } finally {
    for (const [object, key, value] of restore.reverse()) object[key] = value;
    if (cached) require.cache[modulePath] = cached;
    else delete require.cache[modulePath];
  }
});
