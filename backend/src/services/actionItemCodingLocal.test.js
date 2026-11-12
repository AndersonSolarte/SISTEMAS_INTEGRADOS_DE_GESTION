const test = require('node:test');
const assert = require('node:assert/strict');

test('real model allocates consecutive codes and retains identity and monitoring links on edit', { skip: process.env.SIAC_TEST_LOCAL_DB !== '1' }, async () => {
  const { sequelize } = require('../config/database');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host), 'Solo base local');
  const { StrategicActionPlan, StrategicActionItem, StrategicMonitoringPeriod, StrategicMonitoringResult, User } = require('../models');
  const { nextCode, planPrefix } = require('./actionItemCodingService');
  const { Op } = require('sequelize');
  const transaction = await sequelize.transaction();
  try {
    const plan = await StrategicActionPlan.findOne({ where: { code: { [Op.in]: ['2026-R76', 'LEGACY-2026-R76'] }, deleted_at: null }, transaction });
    assert.ok(plan, 'Se necesita el plan local R76');
    const prefix = await planPrefix(plan.id, transaction);
    const before = await StrategicActionItem.findAll({ where: { action_plan_id: plan.id }, transaction });
    const expected = nextCode(prefix, before);
    const user = await User.findOne({ transaction });
    const first = await StrategicActionItem.create({ action_plan_id: plan.id, code: 'ACT-999',
      activity: 'Prueba temporal con rollback', indicator: 'Política aprobada', indicator_type: 'Logro',
      custom_values: { indicadorResultado: 'Resultado', indicadorLogro: 'Logro', indicadorImpacto: 'Impacto' }, created_by: user.id
    }, { transaction });
    assert.equal(first.code, expected);
    assert.equal(first.indicator, `L-${expected} Política aprobada`);
    const period = await StrategicMonitoringPeriod.findOne({ where: { term_id: plan.term_id }, transaction });
    const result = await StrategicMonitoringResult.create({ action_item_id: first.id, monitoring_period_id: period.id,
      physical_progress: 80, observations: 'No perder', created_by: user.id }, { transaction });
    const id = first.id;
    await first.update({ code: 'ACT-123', indicator: '2025-R33-001 Descripción corregida' }, { transaction });
    await first.reload({ transaction });
    assert.equal(first.id, id);
    assert.equal(first.code, expected);
    assert.equal(first.indicator, `L-${expected} Descripción corregida`);
    await result.reload({ transaction });
    assert.equal(result.action_item_id, id);
    assert.equal(Number(result.physical_progress), 80);
    assert.equal(result.observations, 'No perder');
    await first.update({ deleted_at: new Date() }, { transaction });
    const second = await StrategicActionItem.create({ action_plan_id: plan.id, code: 'LEGACY-999999', activity: 'Segunda prueba temporal', created_by: user.id }, { transaction });
    assert.equal(second.code, nextCode(prefix, [...before, first]));
    const [imported, created] = await StrategicActionItem.findOrCreate({
      where: { action_plan_id: plan.id, code: 'LEGACY-99999999' },
      defaults: { activity: 'Fila histórica temporal', created_by: user.id,
        custom_values: { legacy_plan_accion_id: 99999999, responsible: 'R76_Salud' } }, transaction
    });
    assert.equal(created, true);
    assert.equal(imported.code, nextCode(prefix, [...before, first, second]));
    assert.notEqual(imported.custom_values.application_created, true);
    await transaction.rollback();
    const parallel = await Promise.allSettled([1, 2].map((index) => StrategicActionItem.create({
      action_plan_id: plan.id, code: 'ACT-999', activity: `Prueba concurrente temporal ${index}`, created_by: user.id
    })));
    const inserted = parallel.filter((entry) => entry.status === 'fulfilled').map((entry) => entry.value);
    try {
      assert.equal(inserted.length, 2, parallel.find((entry) => entry.status === 'rejected')?.reason?.message);
      assert.equal(new Set(inserted.map((entry) => entry.code)).size, 2);
      assert.deepEqual(inserted.map((entry) => entry.code).sort(), [expected,
        nextCode(prefix, [...before, { code: expected }])].sort());
      assert.ok(inserted.every((entry) => entry.custom_values.application_created === true));
    } finally {
      if (inserted.length) await StrategicActionItem.destroy({ where: { id: inserted.map((entry) => entry.id) } });
    }
  } finally { if (!transaction.finished) await transaction.rollback(); await sequelize.close(); }
});
