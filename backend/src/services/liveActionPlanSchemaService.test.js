const { test } = require('node:test');
const assert = require('node:assert/strict');
const schemaService = require('./strategicActionPlanSchemaService');
const { StrategicFieldDefinition } = require('../models');
const { readLiveActionPlanSchema } = require('./liveActionPlanSchemaService');

test('official and linking forms resolve current fields and do not restore deactivated snapshot fields', async () => {
  const originals = [schemaService.captureActionPlanSchema, StrategicFieldDefinition.findAll];
  let configuration = 2;
  schemaService.captureActionPlanSchema = async (pedId) => {
    assert.equal(pedId, 'ped');
    return { configuration_version: configuration, fields: [
      { key: 'activity', label: `Actividad versión ${configuration}`, required: true, position: 1 },
      { key: 'new_field', label: 'Nuevo campo vigente', required: configuration === 3, position: 2 }
    ], levels: [], elements: [], catalogs: [{ name: 'Current catalog' }] };
  };
  StrategicFieldDefinition.findAll = async () => [{ key: 'removed' }];
  const actionPlan = { term: { strategic_plan_id: 'ped' }, metadata: { form_schema: { fields: [
    { key: 'activity', label: 'Old activity', required: false }, { key: 'removed', label: 'Removed field' }
  ] } } };
  try {
    const official = await readLiveActionPlanSchema(actionPlan);
    const linking = await readLiveActionPlanSchema(actionPlan);
    assert.deepEqual(linking, official);
    assert.deepEqual(linking.fields.map((field) => field.key), ['activity', 'new_field']);
    configuration = 3;
    const refreshed = await readLiveActionPlanSchema(actionPlan);
    assert.equal(refreshed.fields[0].label, 'Actividad versión 3');
    assert.equal(refreshed.fields[1].required, true);
    assert.equal(actionPlan.metadata.form_schema.fields[0].label, 'Old activity');
  } finally { [schemaService.captureActionPlanSchema, StrategicFieldDefinition.findAll] = originals; }
});

test('does not silently use an obsolete schema when the current configuration cannot be read', async () => {
  const original = schemaService.captureActionPlanSchema;
  schemaService.captureActionPlanSchema = async () => { throw new Error('Current schema unavailable'); };
  try {
    await assert.rejects(() => readLiveActionPlanSchema({ term: { strategic_plan_id: 'ped' }, metadata: { form_schema: { fields: [{ key: 'old' }] } } }), /Current schema unavailable/);
  } finally { schemaService.captureActionPlanSchema = original; }
});
