const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const { StrategicActionItem } = require('../models');
const { syncLinkedActionPlansTracking, reconcileLinkedActivities } = require('./planMejoramientoController');

test('follow-up saving and reconciliation can search for a missing action link without a ReferenceError', async () => {
  const original = StrategicActionItem.findOne;
  let calls = 0;
  StrategicActionItem.findOne = async ({ where }) => {
    calls += 1;
    assert.equal(where.deleted_at, null);
    assert.equal(where[Op.or].length, 2);
    assert.equal(where[Op.or][0].logic, 'activity-without-link');
    assert.equal(where[Op.or][1].logic, 'activity-without-link');
    return null;
  };
  const activity = { uid: 'activity-without-link', metaAlcanzada: 73, fechaSeguimiento: '2026-11-04', observaciones: 'ok' };
  const plan = { id: 10, contenido: { objetivos: [{ actividades: [activity] }] } };
  try {
    await syncLinkedActionPlansTracking(plan, { user: { id: 1 } });
    assert.equal(calls, 1);
    await reconcileLinkedActivities(plan, { persist: false, force: true });
    assert.equal(calls, 2);
    assert.equal(activity.metaAlcanzada, 73);
    assert.equal(activity.observaciones, 'ok');
  } finally {
    StrategicActionItem.findOne = original;
  }
});
