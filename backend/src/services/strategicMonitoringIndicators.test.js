const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sequelize } = require('../config/database');
const { StrategicMonitoringResult, StrategicAuditEvent } = require('../models');
const { upsertMonitoring } = require('./strategicPlanningDomainService');

test('a missing active indicator contributes zero and a blank ghost indicator does not change the denominator', async () => {
  const originals = [sequelize.transaction, StrategicMonitoringResult.findOrCreate, StrategicMonitoringResult.findAll, StrategicAuditEvent.create];
  const result = { id: 'result', physical_progress: 0, status: 'draft', toJSON() { return { id: this.id }; }, async update(values) { Object.assign(this, values); } };
  sequelize.transaction = async (callback) => callback({});
  StrategicMonitoringResult.findOrCreate = async () => [result, true];
  StrategicMonitoringResult.findAll = async () => [result];
  StrategicAuditEvent.create = async () => ({});
  const actionItem = { id: 'item', custom_values: { indicadorResultado: 'Informes', indicadorResultadoActivo: true, indicadorLogro: 'Cobertura', indicadorLogroActivo: true, indicadorImpacto: '', indicadorImpactoActivo: true }, async update(values) { Object.assign(this, values); } };
  try {
    await upsertMonitoring({ req: { user: { id: 1, role: 'administrador' }, headers: {} }, actionItem, periodId: 'period', payload: { indicators_progress: { Resultado: { progress: 50 } } } });
    assert.equal(result.physical_progress, 25);
    assert.equal(actionItem.current_progress, 25);
  } finally { [sequelize.transaction, StrategicMonitoringResult.findOrCreate, StrategicMonitoringResult.findAll, StrategicAuditEvent.create] = originals; }
});
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

test('official concepts stay in their activity and cut and survive subsequent evidence submissions', async () => {
  const originals = [sequelize.transaction, StrategicMonitoringResult.findOrCreate, StrategicMonitoringResult.findAll, StrategicAuditEvent.create];
  const makeResult = (id, item, period, concept, progress) => ({ id, action_item_id: item, monitoring_period_id: period,
    observations: concept, physical_progress: progress, achieved_value: 'Soportes revisados', status: 'approved', version: 1,
    toJSON() { return { id: this.id, observations: this.observations }; }, async update(values) { Object.assign(this, values); } });
  const s1 = makeResult('r1', 'a', 's1', 'Revisar soportes S1', 100);
  const s2 = makeResult('r2', 'a', 's2', 'Pendientes de S2', 0);
  const other = makeResult('r3', 'b', 's1', 'Otra actividad', 80);
  const records = [s1, s2, other];
  sequelize.transaction = async (fn) => fn({});
  StrategicMonitoringResult.findOrCreate = async ({ where }) => [records.find((r) => r.action_item_id === where.action_item_id && r.monitoring_period_id === where.monitoring_period_id), false];
  StrategicMonitoringResult.findAll = async ({ where }) => records.filter((r) => r.action_item_id === where.action_item_id);
  StrategicAuditEvent.create = async () => ({});
  const actionItem = { id: 'a', custom_values: {}, async update(values) { Object.assign(this, values); } };
  const planning = { user: { id: 1, role: 'planeacion_efectividad' }, headers: {} };
  try {
    await upsertMonitoring({ req: planning, actionItem, periodId: 's1', payload: { observations: 'Concepto oficial S1' } });
    assert.equal(s1.observations, 'Concepto oficial S1');
    assert.equal(s2.observations, 'Pendientes de S2');
    assert.equal(other.observations, 'Otra actividad');
    await upsertMonitoring({ req: { user: { id: 2, role: 'usuario' }, headers: {} }, actionItem, periodId: 's1',
      payload: { status: 'submitted', observations: 'Intento de sustituir concepto', physical_progress: 0,
        indicators_progress: { principal: { progress: 0, observations: 'Otro texto' } } } });
    assert.equal(s1.observations, 'Concepto oficial S1');
    assert.equal(s1.physical_progress, 100);
    assert.equal(s1.achieved_value, 'Soportes revisados');
    assert.equal(actionItem.custom_values.monitoring_indicators, undefined);
    await upsertMonitoring({ req: planning, actionItem, periodId: 's1', payload: { status: 'submitted' } });
    assert.equal(s1.observations, 'Concepto oficial S1');
    await upsertMonitoring({ req: planning, actionItem, periodId: 's2', payload: { observations: '' } });
    assert.equal(s2.observations, null);
    assert.equal(s1.observations, 'Concepto oficial S1');
  } finally {
    [sequelize.transaction, StrategicMonitoringResult.findOrCreate, StrategicMonitoringResult.findAll, StrategicAuditEvent.create] = originals;
  }
});
