const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../config/database');
const { StrategicPlan, StrategicFieldDefinition, StrategicAuditEvent } = require('../models');
const controller = require('./strategicPlanningController');
test('policy preset creates an idempotent pair under one locked PED transaction', async () => {
  const originals = [sequelize.transaction, StrategicPlan.findByPk, StrategicFieldDefinition.max, StrategicFieldDefinition.findOne, StrategicFieldDefinition.create, StrategicAuditEvent.create];
  const rows = [];
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  sequelize.transaction = async (fn) => fn(transaction);
  StrategicPlan.findByPk = async (_, options) => { assert.equal(options.lock, 'UPDATE'); return { id: 7, configuration_version: 2 }; };
  StrategicFieldDefinition.max = async () => 8;
  StrategicFieldDefinition.findOne = async ({ where }) => rows.find((row) => row.key === where.key);
  StrategicFieldDefinition.create = async (values, options) => {
    assert.equal(options.transaction, transaction);
    const row = { ...values, id: rows.length + 1, toJSON() { return { key: this.key }; }, async update(changes) { Object.assign(this, changes); return this; } };
    rows.push(row); return row;
  };
  StrategicAuditEvent.create = async () => ({});
  try {
    for (let i = 0; i < 2; i++) {
      let error;
      const res = { status() { return this; }, json(value) { this.body = value; } };
      await controller.createInstitutionalPolicyFields({ params: { planId: 7 }, body: {}, user: { id: 1 }, headers: {} }, res, (err) => { error = err; });
      if (error) throw error;
      assert.equal(res.body.data.length, 2);
    }
    assert.equal(rows.length, 2);
    assert.deepEqual(rows.map((row) => row.position), [9, 10]);
    assert.equal(rows[1].validation_rules.policy_key, rows[0].key);
  } finally {
    [sequelize.transaction, StrategicPlan.findByPk, StrategicFieldDefinition.max, StrategicFieldDefinition.findOne, StrategicFieldDefinition.create, StrategicAuditEvent.create] = originals;
  }
});
