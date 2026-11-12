const test = require('node:test');
const assert = require('node:assert/strict');
const { optionalPolicyField } = require('./optionalPolicyField');

test('policy fields are optional by name, key or shared catalog without relaxing other required fields', () => {
  for (const field of [
    { key: 'seguimiento_politicas' }, { label: 'Seguimiento Políticas' }, { key: 'institutional_policy' },
    { key: 'lineas_de_accion' }, { key: 'institutional_policy_lines' },
    { key: 'custom', validation_rules: { shared_catalog: 'institutional_policies' } },
    { key: 'custom_lines', validation_rules: { policy_key: 'policy' } }
  ]) assert.equal(optionalPolicyField({ ...field, required: true }).required, false);
  const activity = { key: 'activity', required: true };
  assert.equal(optionalPolicyField(activity).required, true);
  assert.equal(optionalPolicyField({ key: 'starts_on', required: true }).required, true);
  assert.equal(activity.required, true);
});
