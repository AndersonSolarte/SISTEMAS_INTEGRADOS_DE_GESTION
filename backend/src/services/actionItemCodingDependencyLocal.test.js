const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

test('local PostgreSQL: a 2027 DEP-R02 plan creates consecutive activities and indicator codes', { skip: process.env.SIAC_TEST_LOCAL_DB !== '1' }, async () => {
  const { sequelize } = require('../config/database');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host), 'Local database only');
  const { StrategicPlan, StrategicTerm, StrategicCatalogItem, StrategicActionPlan, StrategicActionItem, User } = require('../models');
  const { planPrefix } = require('./actionItemCodingService');
  const transaction = await sequelize.transaction();
  try {
    const actor = await User.findOne({ transaction });
    assert.ok(actor, 'A local user is required for the temporary plan');
    const tag = crypto.randomUUID().slice(0, 8).toUpperCase();
    const ped = await StrategicPlan.create({ code: 'TEST-DEP-CODING-' + tag, name: 'Temporary coding test',
      starts_on: '2027-01-01', ends_on: '2027-12-31' }, { transaction });
    const term = await StrategicTerm.create({ strategic_plan_id: ped.id, year: 2027, name: '2027',
      starts_on: '2027-01-01', ends_on: '2027-12-31' }, { transaction });
    const unit = await StrategicCatalogItem.create({ strategic_plan_id: ped.id, catalog_type: 'organizational_unit',
      code: 'DEP-R02-VICERRECTORIA-ACADEMICA', name: 'R02_Vicerrectoria Academica',
      metadata: { source: 'DEPENDENCIAS_POR_VIGENCIA' } }, { transaction });
    const plan = await StrategicActionPlan.create({ term_id: term.id, catalog_item_id: unit.id,
      code: '2027-DEP-R02-VICERRECTORIA-ACADEMICA-TEST-' + tag, title: 'Temporary 2027 plan', created_by: actor.id }, { transaction });
    assert.equal(await planPrefix(plan.id, transaction), '2027-R02');
    const first = await StrategicActionItem.create({ action_plan_id: plan.id, code: 'ACT-001', activity: 'Temporary activity',
      indicator_type: 'Logro', indicator: 'Fichas elaboradas', custom_values: { responsible: 'SANDRA LUCIA',
        indicadorResultado: 'Resultado', indicadorLogro: 'Logro', indicadorImpacto: 'Impacto' } }, { transaction });
    assert.equal(first.code, '2027-R02-001');
    assert.equal(first.indicator, 'L-2027-R02-001 Fichas elaboradas');
    assert.equal(first.custom_values.indicadorResultado, 'R-2027-R02-001 Resultado');
    assert.equal(first.custom_values.indicadorLogro, 'L-2027-R02-001 Logro');
    assert.equal(first.custom_values.indicadorImpacto, 'I-2027-R02-001 Impacto');
    const second = await StrategicActionItem.create({ action_plan_id: plan.id, code: 'ACT-001', activity: 'Second temporary activity' }, { transaction });
    assert.equal(second.code, '2027-R02-002');
    await second.update({ deleted_at: new Date() }, { transaction });
    const third = await StrategicActionItem.create({ action_plan_id: plan.id, code: 'ACT-001', activity: 'Third temporary activity' }, { transaction });
    assert.equal(third.code, '2027-R02-003');
    await plan.reload({ transaction }); await unit.reload({ transaction });
    assert.ok(plan.code.startsWith('2027-DEP-R02-VICERRECTORIA-ACADEMICA'));
    assert.equal(unit.code, 'DEP-R02-VICERRECTORIA-ACADEMICA');
    await unit.update({ code: 'DEP-GENERIC' }, { transaction });
    assert.equal(await planPrefix(plan.id, transaction), '2027-R02');
  } finally {
    await transaction.rollback();
    await sequelize.close();
  }
});
