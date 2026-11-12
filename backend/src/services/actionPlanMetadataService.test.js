const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

test('local PostgreSQL: assign leader to historical 2026 plan, keep annual reference, reject code collisions and retain history', { skip: process.env.RUN_PLAN_METADATA_DB_TESTS !== '1' }, async () => {
  const { sequelize } = require('../config/database');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host), 'Local database only');
  const { User, StrategicTerm, StrategicCatalogItem, StrategicActionPlan, StrategicResponsibility } = require('../models');
  const { updateActionPlanMetadata } = require('./actionPlanMetadataService');
  const { Op } = require('sequelize');
  const users = await User.findAll({ where: { estado: 'activo' }, limit: 2 });
  const term = await StrategicTerm.findOne({ where: { year: 2026 } });
  assert.ok(term); assert.equal(users.length, 2);
  const token = crypto.randomUUID().slice(0, 8).toUpperCase();
  let unit;
  try {
    unit = await StrategicCatalogItem.create({ strategic_plan_id: term.strategic_plan_id, catalog_type: 'organizational_unit', code: `TEST-${token}`, name: 'LOCAL TEST metadata assignment' });
    const plan = await StrategicActionPlan.create({ term_id: term.id, catalog_item_id: unit.id, code: `LEGACY-2026-TEST-${token}`, title: 'Local test plan', created_by: users[0].id, metadata: { form_schema: { marker: 'preserve' } } });
    const other = await StrategicActionPlan.create({ term_id: term.id, catalog_item_id: unit.id, code: `2026-TEST-${token}`, title: 'Local duplicate-code fixture', created_by: users[0].id });
    // The old update returned only Sequelize's generic message for this exact situation.
    await assert.rejects(sequelize.transaction(async transaction => plan.update({ code: other.code, responsible_user_id: users[1].id }, { transaction })), error => error.name === 'SequelizeUniqueConstraintError');
    await assert.rejects(updateActionPlanMetadata({ id: plan.id, body: { code: other.code, responsible_user_id: users[1].id }, actorId: users[0].id }), error => error.statusCode === 409 && error.message.includes(plan.code));
    await plan.reload(); assert.equal(plan.responsible_user_id, null);
    const first = await updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: users[1].id }, actorId: users[0].id });
    assert.equal(first.code, plan.code); assert.equal(first.responsible_user_id, users[1].id); assert.ok(first.responsibility_id);
    const active = () => StrategicResponsibility.findAll({ where: { term_id: term.id, catalog_item_id: unit.id, status: 'active' } });
    let assignments = await active(); assert.equal(assignments.length, 2); assert.ok(assignments.every(a => a.user_id === users[1].id));
    assert.ok(assignments.some(a => a.id === first.responsibility_id && a.action_plan_id === plan.id));
    await updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: users[1].id }, actorId: users[0].id });
    assert.equal((await active()).length, 2);
    const next = await updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: users[0].id, metadata: { form_schema: { marker: 'forged' } } }, actorId: users[0].id });
    assert.notEqual(next.responsibility_id, first.responsibility_id); assert.equal(next.metadata.form_schema.marker, 'preserve');
    assignments = await active(); assert.equal(assignments.length, 2); assert.ok(assignments.every(a => a.user_id === users[0].id));
    assert.equal(await StrategicResponsibility.count({ where: { catalog_item_id: unit.id, status: 'transferred' } }), 2);
    const originalList = StrategicActionPlan.findAll;
    StrategicActionPlan.findAll = async () => [next];
    try {
      const { syncMissingPlanLeaders } = require('./strategicLegacyActionPlanService');
      await syncMissingPlanLeaders();
    } finally { StrategicActionPlan.findAll = originalList; }
    await plan.reload(); assert.equal(plan.responsible_user_id, users[0].id);
    assert.equal(plan.responsibility_id, next.responsibility_id);

    const cleared = await updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: '' }, actorId: users[0].id });
    assert.equal(cleared.responsible_user_id, null); assert.equal(cleared.responsibility_id, null);
    assert.equal(cleared.metadata.leader_assignment_paused, true);
    let afterClear = await active();
    assert.equal(afterClear.length, 1); assert.equal(afterClear[0].user_id, null); assert.equal(afterClear[0].responsibility_type, 'reference_leader');
    const { listTermDependencies } = require('./strategicTermDependencyService');
    const dependencies = await listTermDependencies({ termId: term.id });
    assert.ok(dependencies.some(d => d.dependency?.id === unit.id && d.responsible === null));
    const clearedAgain = await updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: null }, actorId: users[0].id });
    assert.equal((await active()).length, 1);
    assert.equal(clearedAgain.responsible_user_id, null);
    await updateActionPlanMetadata({ id: plan.id, body: { title: 'Still unassigned' }, actorId: users[0].id });
    await plan.reload(); assert.equal(plan.responsible_user_id, null); assert.equal(plan.metadata.leader_assignment_paused, true);
    // Even a stale active annual assignment cannot override the explicit unassignment.
    await StrategicResponsibility.create({ term_id: term.id, catalog_item_id: unit.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active', user_id: users[0].id, created_by: users[0].id });
    const savedList = StrategicActionPlan.findAll;
    StrategicActionPlan.findAll = async () => [plan];
    try { await require('./strategicLegacyActionPlanService').syncMissingPlanLeaders(); }
    finally { StrategicActionPlan.findAll = savedList; }
    await plan.reload(); assert.equal(plan.responsible_user_id, null);
    const reassigned = await updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: users[0].id }, actorId: users[0].id });
    assert.equal(reassigned.metadata.leader_assignment_paused, false);
    assert.ok(reassigned.responsibility_id);
    assert.equal(reassigned.responsible_user_id, users[0].id);
    assert.equal((await active()).length, 2);
    assert.ok((await active()).every(a => a.user_id === users[0].id));
    await assert.rejects(updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: null }, actorId: users[0].id, onAudit: async () => { throw new Error('clear rollback'); } }), /clear rollback/);
    await plan.reload(); assert.equal(plan.responsible_user_id, users[0].id);
    assert.equal((await active()).length, 2);

    await assert.rejects(updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: 2147483646 }, actorId: users[0].id }), { statusCode: 422 });
    await assert.rejects(updateActionPlanMetadata({ id: plan.id, body: { responsible_user_id: users[1].id }, actorId: users[0].id, onAudit: async () => { throw new Error('rollback check'); } }), /rollback check/);
    await plan.reload(); assert.equal(plan.responsible_user_id, users[0].id);
    assert.ok((await active()).every(a => a.user_id === users[0].id));
    await other.update({ deleted_at: new Date() });
    await assert.rejects(updateActionPlanMetadata({ id: plan.id, body: { code: other.code }, actorId: users[0].id }), { statusCode: 409 });
  } finally {
    if (unit) {
      const assignments = await StrategicResponsibility.findAll({ where: { catalog_item_id: unit.id } });
      await StrategicActionPlan.update({ responsibility_id: null }, { where: { catalog_item_id: unit.id } });
      await StrategicResponsibility.update({ predecessor_id: null }, { where: { catalog_item_id: unit.id } });
      await StrategicResponsibility.destroy({ where: { id: { [Op.in]: assignments.map(a => a.id) } } });
      await StrategicActionPlan.destroy({ where: { catalog_item_id: unit.id } });
      await unit.destroy();
    }
    await sequelize.close();
  }
});
