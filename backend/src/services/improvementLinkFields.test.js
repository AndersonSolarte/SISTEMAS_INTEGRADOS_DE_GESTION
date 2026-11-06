const { test } = require('node:test');
const assert = require('node:assert/strict');
const { missingLinkFields, linkFieldValue } = require('./improvementLinkFields');
test('requires every required field, including custom policies and strategic fields', () => {
  const fields = ['strategic_objective', 'strategic_guideline', 'institutional_policy', 'custom_field'].map((key) => ({ key, required: true }));
  assert.deepEqual(missingLinkFields(fields, { strategic_objective: ' ', institutional_policy: [] }).map((f) => f.key), fields.map((f) => f.key));
});
test('allows optional empty fields, computed fields and monitoring-only fields', () => {
  assert.deepEqual(missingLinkFields([{ key: 'optional', required: false }, { key: 'total', required: true }, { key: 'progress_s1', required: true }, { key: 'calc', required: true, data_type: 'formula' }, { key: 'old', required: true, active: false }], {}), []);
});
test('resolves interface aliases while accepting zero and preserving array selections', () => {
  const values = { objetivoEstrategico: 'OE1', lineamientoEstrategico: 'LE1', meta: 0, co_responsibles: ['A', 'B'] };
  assert.equal(linkFieldValue('target', values), 0);
  assert.deepEqual(linkFieldValue('corresponsable', values), ['A', 'B']);
  assert.deepEqual(missingLinkFields(['strategic_objective', 'strategic_guideline', 'target', 'co_responsibles'].map((key) => ({ key, required: true })), values), []);
});
