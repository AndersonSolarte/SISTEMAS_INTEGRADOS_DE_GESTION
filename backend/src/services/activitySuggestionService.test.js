const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { searchActivityTemplates, wordsOf, templateCustom } = require('./activitySuggestionService');

test('keywords ignore case, accents and punctuation without SQL wildcards', () => {
  assert.deepEqual(wordsOf('EVALUACIÓN sis% Ñandú'), ['evaluacion', 'sis', 'nandu']);
  assert.deepEqual(wordsOf('___%'), []);
});
test('templates exclude identity, responsibility, progress and observations', () => {
  const custom = templateCustom({ indicadorResultado: 'R-2024-R75-003 Indicador', metaResultado: '10', macroactividad: 'Macro',
    official_observations: { s1: 'Private' }, indicador_observaciones: 'Private', responsible: 'Other unit', responsible_user_id: 42,
    legacy_plan_accion_id: 18, current_progress: 100, indicator_codes: {}, codigo: 'old', fecha_inicio: '2024-01-01' });
  assert.deepEqual(custom, { indicadorResultado: 'Indicador', metaResultado: '10', macroactividad: 'Macro' });
});

test('local PostgreSQL: global native and historical search, accent matching and creation in the destination year', { skip: process.env.RUN_ACTIVITY_BANK_DB_TESTS !== '1' }, async () => {
  const { sequelize } = require('../config/database');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host), 'Local database only');
  const { StrategicActionPlan, StrategicActionItem, StrategicCatalogItem, StrategicTerm, User, PlanAccion } = require('../models');
  const { Op } = require('sequelize');
  const sourceTerm = await StrategicTerm.findOne({ where: { year: 2026 } });
  const targetTerm = await StrategicTerm.findOne({ where: { year: 2027, strategic_plan_id: sourceTerm.strategic_plan_id } });
  const actor = await User.findOne({ where: { estado: 'activo' } });
  assert.ok(targetTerm && actor);
  const token = 'bank' + crypto.randomBytes(5).toString('hex');
  const base = 7000000 + crypto.randomInt(100000);
  const unitIds = []; const planIds = []; let historical;
  try {
    for (let index = 0; index < 2; index++) {
      const unit = await StrategicCatalogItem.create({ strategic_plan_id: sourceTerm.strategic_plan_id, catalog_type: 'organizational_unit', code: 'R' + (base + index), name: token + '-unit-' + index });
      unitIds.push(unit.id);
      const term = index ? sourceTerm : targetTerm;
      const plan = await StrategicActionPlan.create({ term_id: term.id, catalog_item_id: unit.id, code: term.year + '-' + unit.code, title: token + '-plan', created_by: actor.id });
      planIds.push(plan.id);
    }
    const source = await StrategicActionItem.create({ action_plan_id: planIds[1], code: 'ACT-001', activity: 'Evaluación del SISTEMA ' + token,
      indicator_type: 'Resultado', indicator: 'Coverage', target: '20', starts_on: '2026-02-01', ends_on: '2026-08-01', current_progress: 80,
      custom_values: { official_observations: { s1: 'Do not copy' }, responsible: 'Other owner', metaResultado: '20' }, created_by: actor.id });
    const variant = await StrategicActionItem.create({ action_plan_id: planIds[1], code: 'ACT-002', activity: source.activity,
      indicator_type: 'Impacto', indicator: 'Impact', target: '30', created_by: actor.id });
    historical = await PlanAccion.create({ anio: 2024, actividad: 'Análisis histórico ' + token, indicador: '2024-R75-005 Historical indicator',
      meta: '15', responsable: 'R75_Deporte', tipo_indicador: 'Logro', observaciones_ip: 'Do not copy historical observations' });
    const global = await searchActivityTemplates({ planId: planIds[0], query: token + ' EVALUACION sis' });
    assert.equal(global.length, 2, JSON.stringify(global));
    assert.ok(global.some(option => option.id === source.id));
    assert.ok(global.some(option => option.id === variant.id));
    assert.ok(global.every(option => !option.is_same_dependency && option.term_year === 2026));
    assert.equal(global[0].custom_values.official_observations, undefined);
    assert.equal(global[0].custom_values.responsible, undefined);
    assert.equal(global[0].starts_on, undefined);
    const accentInput = await searchActivityTemplates({ planId: planIds[0], query: token + ' evaluación' });
    assert.equal(accentInput.length, 2);
    const old = await searchActivityTemplates({ planId: planIds[0], query: token + ' ANALISIS' });
    assert.equal(old.length, 1);
    assert.equal(old[0].source, 'historical');
    assert.equal(old[0].indicator, 'Historical indicator');
    assert.equal(old[0].term_year, 2024);
    const defaults = await searchActivityTemplates({ planId: planIds[0] });
    assert.ok(!defaults.some(option => [source.id, variant.id].includes(option.id)));
    const option = global.find(o => o.id === source.id);
    const copied = await StrategicActionItem.create({ action_plan_id: planIds[0], activity: option.activity, indicator_type: option.indicator_type,
      indicator: option.indicator, target: option.target, custom_values: option.custom_values, created_by: actor.id });
    assert.ok(copied.code.startsWith('2027-R' + base + '-'));
    assert.notEqual(copied.id, source.id);
    assert.equal(copied.starts_on, null);
    assert.equal(copied.current_progress, null);
    await source.reload(); assert.equal(Number(source.current_progress), 80);
    await StrategicActionPlan.update({ deleted_at: new Date() }, { where: { id: planIds[1] } });
    const afterArchive = await searchActivityTemplates({ planId: planIds[0], query: token + ' EVALUACION' });
    assert.deepEqual(afterArchive.map(option => option.id), [copied.id]);
  } finally {
    if (historical) await historical.destroy();
    if (planIds.length) {
      await StrategicActionItem.destroy({ where: { action_plan_id: { [Op.in]: planIds } } });
      await StrategicActionPlan.destroy({ where: { id: { [Op.in]: planIds } } });
    }
    if (unitIds.length) await StrategicCatalogItem.destroy({ where: { id: { [Op.in]: unitIds } } });
    await sequelize.close();
  }
});
