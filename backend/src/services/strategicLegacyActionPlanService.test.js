const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../config/database');
const models = require('../models');
const schemaService = require('./strategicActionPlanSchemaService');

test('three imports with changing IDs retain five activities, manual work, evidence and period results', async () => {
  const originals = [];
  const stub = (object, key, fn) => { originals.push([object, key, object[key]]); object[key] = fn; };
  const transaction = {};
  const instance = (data) => ({ ...data, async update(values, options) {
    assert.equal(options.transaction, transaction); Object.assign(this, values); return this;
  }, toJSON() { return Object.fromEntries(Object.entries(this).filter(([, value]) => typeof value !== 'function')); } });
  const source = Array.from({ length: 5 }, (_, i) => ({
    id: 300 + i, anio: 2026, responsable: 'R74_Acompañamiento', actividad: `Actividad ${i}`,
    indicador: `Informe ${i}`, meta: '100%', objetivo_estrategico: 'OE1', lineamiento_estrategico: 'LE4'
  }));
  const items = source.flatMap((row, i) => [100, 200, 300].map((base) => instance({
    id: `${base + i}`, action_plan_id: 'plan', code: `LEGACY-${base + i}`,
    activity: base === 100 ? `A-003 ${row.actividad}` : row.actividad,
    indicator: base === 100 ? `2026-R74-${i} ${row.indicador}` : row.indicador, target: row.meta,
    starts_on: base === 100 ? '2026-02-16' : null, ends_on: null, deleted_at: null,
    custom_values: { legacy_plan_accion_id: base + i, progress_s1: 0, note: 'Conservar' }
  })));
  items.push(instance({ id: 'manual', code: 'ACT-006', action_plan_id: 'plan', activity: source[0].actividad,
    indicator: source[0].indicador, deleted_at: null, custom_values: {} }));
  const evidence = [{ action_item_id: '200' }];
  const budgets = [{ action_item_id: '300' }];
  const results = [instance({ id: 'result', action_item_id: '200', monitoring_period_id: 's1', status: 'draft', physical_progress: 50 })];
  const plan = instance({ id: 'plan', code: 'LEGACY-2026-R74', metadata: {}, deleted_at: null });
  let locks = 0;
  stub(sequelize, 'transaction', async (fn) => fn(transaction));
  stub(sequelize, 'query', async (_, options) => { assert.equal(options.transaction, transaction); locks++; });
  stub(models.PlanAccion, 'findAll', async () => source);
  stub(models.StrategicPlan, 'findAll', async () => [{ id: 'ped', terms: [{ id: 'term', year: 2026 }] }]);
  stub(models.User, 'findOne', async () => ({ id: 1 }));
  stub(models.StrategicActionPlan, 'findOne', async () => plan);
  stub(models.StrategicActionPlan, 'findAll', async () => []);
  stub(models.StrategicTerm, 'findAll', async () => []);
  stub(models.StrategicCatalogItem, 'findAll', async () => [{ id: 'unit', code: 'R74' }]);
  stub(models.StrategicMonitoringPeriod, 'findAll', async () => []);
  stub(models.StrategicActionItem, 'findAll', async () => items.filter((item) => !item.deleted_at));
  stub(models.StrategicActionItem, 'findOrCreate', async ({ where }) => {
    const archived = items.find((item) => item.code === where.code);
    if (archived) return [archived, false];
    throw new Error('Reimport must not create another copy');
  });
  stub(models.StrategicMonitoringResult, 'findAll', async ({ where }) => results.filter((r) => r.action_item_id === where.action_item_id));
  stub(models.StrategicMonitoringResult, 'findOne', async ({ where }) => results.find((r) => r.action_item_id === where.action_item_id && r.monitoring_period_id === where.monitoring_period_id));
  for (const [model, rows] of [[models.StrategicEvidence, evidence], [models.StrategicBudgetMovement, budgets]]) {
    stub(model, 'update', async (changes, { where, transaction: tx }) => {
      assert.equal(tx, transaction);
      rows.filter((row) => row.action_item_id === where.action_item_id).forEach((row) => Object.assign(row, changes));
    });
  }
  stub(schemaService, 'captureActionPlanSchema', async () => ({ fields: [
    { key: 'objetivos_estrategicos', label: 'Objetivos estratégicos' },
    { key: 'lineamientos_estrategicos', label: 'Lineamientos estratégicos' }
  ] }));
  const modulePath = require.resolve('./strategicLegacyActionPlanService');
  delete require.cache[modulePath];
  try {
    const { reconcileLegacyActionPlans } = require(modulePath);
    source.push({ id: 900, anio: 2027, responsable: 'R74_Acompañamiento', actividad: 'No importar desde Excel', indicador: 'Futura' });
    for (let batch = 0; batch < 3; batch++) {
      source.forEach((row, i) => { row.id = 400 + batch * 100 + i; });
      await Promise.all([reconcileLegacyActionPlans({ planCode: plan.code }), reconcileLegacyActionPlans({ planCode: plan.code, force: true })]);
      assert.equal(items.filter((item) => !item.deleted_at).length, 6);
      assert.equal(items.filter((item) => item.custom_values.legacy_duplicate_of).length, 10);
      assert.equal(items[0].custom_values.objetivos_estrategicos, 'OE1');
      assert.equal(items[0].custom_values.lineamientos_estrategicos, 'LE4');
      assert.equal(items[0].custom_values.progress_s1, 0);
      assert.equal(items[0].starts_on, '2026-02-16');
      assert.equal(items[0].activity, source[0].actividad);
      assert.equal(items[0].indicator, source[0].indicador);
      assert.equal(items[0].custom_values.legacy_text_before_normalization.activity, 'A-003 Actividad 0');
      assert.equal(items.at(-1).deleted_at, null);
    }
    assert.equal(locks, 3);
    assert.equal(evidence[0].action_item_id, '100');
    assert.equal(budgets[0].action_item_id, '100');
    assert.equal(results[0].action_item_id, '100');
    // An individual row repeated in the original workbook gets its own slot.
    source.push({ ...source[0], id: 999 });
    items.push(instance({ ...items[0].toJSON(), id: 'source-copy', code: 'LEGACY-999', deleted_at: new Date(),
      custom_values: { legacy_plan_accion_id: 999, legacy_duplicate_of: '100', responsible: 'R74_Acompañamiento' } }));
    await reconcileLegacyActionPlans({ planCode: plan.code });
    assert.equal(items.filter((item) => !item.deleted_at).length, 7);
    assert.equal(items.at(-1).custom_values.legacy_duplicate_of, undefined);
    source.at(-1).id = 1000;
    await reconcileLegacyActionPlans({ planCode: plan.code });
    assert.equal(items.filter((item) => !item.deleted_at).length, 7);
  } finally {
    for (const [object, key, fn] of originals.reverse()) object[key] = fn;
    delete require.cache[modulePath];
  }
});
