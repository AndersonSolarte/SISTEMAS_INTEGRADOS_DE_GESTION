const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

test('local controller/DB: users load, removal persists on fresh listing, and reassignment appears', { skip: process.env.RUN_PLAN_METADATA_DB_TESTS !== '1' }, async () => {
  const { sequelize } = require('../config/database');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host));
  const models = require('../models');
  const { StrategicActionPlan, StrategicCatalogItem, StrategicTerm, StrategicResponsibility, StrategicAuditEvent, User } = models;
  const users = await User.findAll({ where: { estado: 'activo' }, limit: 2 });
  const term = await StrategicTerm.findOne({ where: { year: 2026 } });
  const drive = require('./strategicPlanningDriveService');
  const originalQueue = drive.enqueueActionRepositorySync;
  drive.enqueueActionRepositorySync = async () => null; // This test must never enqueue external Drive writes.
  const controller = require('../controllers/strategicPlanningController');
  const request = async (handler, params, body = {}, query = {}) => {
    const response = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; return this; } };
    await handler({ user: users[0], params, body, query, headers: {}, ip: '127.0.0.1', get: () => '' }, response);
    assert.equal(response.statusCode, 200, JSON.stringify(response.body));
    return response.body.data;
  };
  let unit; let plan;
  try {
    const token = crypto.randomUUID().slice(0, 8).toUpperCase();
    unit = await StrategicCatalogItem.create({ strategic_plan_id: term.strategic_plan_id, catalog_type: 'organizational_unit', code: 'TEST-' + token, name: 'LOCAL TEST API leader' });
    plan = await StrategicActionPlan.create({ term_id: term.id, catalog_item_id: unit.id, code: '2026-TEST-' + token, title: 'Local leader API test', created_by: users[0].id });
    const options = await request(controller.leaderOptions, { planId: term.strategic_plan_id });
    assert.ok(options.some(option => option.id === users[1].id));
    await request(controller.updateActionPlan, { id: plan.id }, { responsible_user_id: users[1].id });
    const removed = await request(controller.updateActionPlan, { id: plan.id }, { responsible_user_id: null });
    assert.equal(removed.responsible_user_id, null); assert.equal(removed.responsibility_id, null);
    let fresh = await request(controller.listActionPlans, {}, {}, { catalogItemId: unit.id });
    assert.equal(fresh.length, 1); assert.equal(fresh[0].responsible_user_id, null);
    assert.equal(fresh[0].responsibleUser, null);
    const annual = await request(controller.termDependencies, { planId: term.strategic_plan_id }, {}, { termId: term.id });
    assert.ok(annual.some(row => row.dependency.id === unit.id && row.responsible === null));
    await request(controller.updateActionPlan, { id: plan.id }, { responsible_user_id: users[1].id });
    fresh = await request(controller.listActionPlans, {}, {}, { catalogItemId: unit.id });
    assert.equal(fresh[0].responsibleUser.id, users[1].id);
    assert.equal(fresh[0].responsibleUser.nombre, users[1].nombre);
    assert.equal(fresh[0].metadata.leader_assignment_paused, false);
  } finally {
    drive.enqueueActionRepositorySync = originalQueue;
    if (plan) {
      await StrategicAuditEvent.destroy({ where: { entity_type: 'action_plan', entity_id: plan.id } });
      await StrategicActionPlan.update({ responsibility_id: null }, { where: { id: plan.id } });
    }
    if (unit) {
      await StrategicResponsibility.update({ predecessor_id: null }, { where: { catalog_item_id: unit.id } });
      await StrategicResponsibility.destroy({ where: { catalog_item_id: unit.id } });
      await StrategicActionPlan.destroy({ where: { catalog_item_id: unit.id } });
      await unit.destroy();
    }
    await sequelize.close();
  }
});
