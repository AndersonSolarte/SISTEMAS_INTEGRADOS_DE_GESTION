const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../config/database');
const { StrategicMonitoringResult, StrategicAuditEvent } = require('../models');
const { upsertMonitoring } = require('./strategicPlanningDomainService');
test('saving indicator progress initializes custom values before use and retains them', async () => {
  const originals = [sequelize.transaction, StrategicMonitoringResult.findOrCreate, StrategicMonitoringResult.findAll, StrategicAuditEvent.create];
  const result = { id: 'result', physical_progress: 0, status: 'draft', toJSON() { return { id: this.id }; }, async update(values) { Object.assign(this, values); } };
  sequelize.transaction = async (callback) => callback({});
  StrategicMonitoringResult.findOrCreate = async () => [result, true];
  StrategicMonitoringResult.findAll = async () => [result];
  StrategicAuditEvent.create = async () => ({});
  const actionItem = { id: 'item', custom_values: { existing: 'preserved' }, async update(values) { Object.assign(this, values); } };
  const scores = { Resultado: { progress: 40 }, Logro: { progress: 80 } };
  try {
    await upsertMonitoring({ req: { user: { id: 1, role: 'administrador' }, headers: {} }, actionItem, periodId: 'period', payload: { indicators_progress: scores } });
    assert.equal(result.physical_progress, 60);
    assert.equal(actionItem.current_progress, 60);
    assert.deepEqual(actionItem.custom_values.monitoring_indicators.period, scores);
    assert.equal(actionItem.custom_values.existing, 'preserved');
  } finally { [sequelize.transaction, StrategicMonitoringResult.findOrCreate, StrategicMonitoringResult.findAll, StrategicAuditEvent.create] = originals; }
});
