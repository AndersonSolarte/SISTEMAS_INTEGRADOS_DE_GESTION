const { test } = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const { sequelize } = require('../config/database');
const workbook = require('./actionPlanRepositoryDriveService');
const originalSync = workbook.syncSinglePlanOfficialWorkbook;
workbook.syncSinglePlanOfficialWorkbook = async () => {};
const { unlinkActivityFromActionPlan } = require('../controllers/planMejoramientoController');
workbook.syncSinglePlanOfficialWorkbook = originalSync;

for (const closed of [false, true]) test(`unlink controller ${closed ? 'rejects closed plans without mutation' : 'updates both sides in the same transaction and preserves evidence'}`, async () => {
  const originals = [models.PlanMejoramiento.findByPk, models.StrategicActionItem.findByPk, models.StrategicActionPlan.findByPk, sequelize.transaction];
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const changes = [];
  const activity = { uid: 'activity', nombre: 'Informar', linkedActionItemId: 'item', linkedActionPlanId: 'action-plan', seguimientoIndicadores: { Logro: { evidencias: [{ driveFileId: 'evidence' }] } } };
  const plan = { id: 7, contenido: { objetivos: [{ actividades: [activity] }] }, update: async (values, options) => { assert.equal(options.transaction, transaction); changes.push(['plan', values]); } };
  const item = { id: 'item', action_plan_id: 'action-plan', code: 'ACT-004', custom_values: { pm_plan_id: 7, pm_actividad_uid: 'activity' }, update: async (values, options) => { assert.equal(options.transaction, transaction); changes.push(['item', values]); } };
  models.PlanMejoramiento.findByPk = async (_id, options) => { assert.equal(options.lock, transaction.LOCK.UPDATE); return plan; };
  models.StrategicActionItem.findByPk = async () => item;
  models.StrategicActionPlan.findByPk = async () => ({ status: closed ? 'closed' : 'formulation', metadata: {}, term: { status: 'active', metadata: { formulation_starts_on: '2000-01-01', formulation_ends_on: '2099-12-31' } } });
  sequelize.transaction = async (callback) => callback(transaction);
  let status = 200;
  let body;
  const response = { status(value) { status = value; return this; }, json(value) { body = value; return this; } };
  try {
    await unlinkActivityFromActionPlan({ params: { id: 7, uid: 'activity' }, user: { id: 3 } }, response);
    if (closed) {
      assert.equal(status, 409);
      assert.deepEqual(changes, []);
    } else {
      assert.equal(status, 200);
      assert.equal(body.data.linkedActionItemId, null);
      assert.equal(body.data.actionPlanLinkState, 'unlinked');
      assert.deepEqual(body.data.seguimientoIndicadores, activity.seguimientoIndicadores);
      assert.equal(changes[0][1].custom_values.pm_link_status, 'unlinked');
      assert.equal(changes[1][1].contenido.objetivos[0].actividades[0].lastActionPlanLink.actionItemId, 'item');
    }
  } finally {
    [models.PlanMejoramiento.findByPk, models.StrategicActionItem.findByPk, models.StrategicActionPlan.findByPk, sequelize.transaction] = originals;
  }
});
