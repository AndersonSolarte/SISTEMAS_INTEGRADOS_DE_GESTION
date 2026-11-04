const { test } = require('node:test');
const assert = require('node:assert/strict');
const { policyDimensions } = require('./activityPolicyStatisticsService');
const catalog = [{ id: 1, name: 'Política A', actionLines: ['Línea A'] }, { id: 2, name: 'Política B', actionLines: ['Línea B'] }];
test('both modules produce identical policy dimensions with deduplicated selections', () => {
  const pa = policyDimensions('POLITICA A', ['Línea A', 'Línea A'], catalog);
  const pm = policyDimensions(['POLITICA A'], ['Línea A'], catalog);
  assert.deepEqual(pa, pm);
  assert.equal(pa.policies[0].policyId, 1);
  assert.equal(pa.policies[0].lines.length, 1);
  assert.equal(pa.policies[0].lines[0].matched, true);
});
test('manual or missing catalog selections are retained and marked for reconciliation', () => {
  const data = policyDimensions('Manual', ['Manual line'], catalog);
  assert.equal(data.policies[0].policyId, null);
  assert.equal(data.policies[0].matched, false);
  assert.deepEqual(data.unassignedLines, ['Manual line']);
});
test('preserves policy identity after catalog renaming', () => {
  const previous = policyDimensions('Política A', ['Línea A'], catalog);
  const next = policyDimensions('Política A', ['Línea A'], [{ ...catalog[0], name: 'Renamed' }], previous);
  assert.equal(next.policies[0].policyId, 1);
  assert.equal(next.policies[0].catalogName, 'Renamed');
  assert.equal(next.policies[0].selectedName, 'Política A');
});
test('assigns lines only to their corresponding policy when several are selected', () => {
  const data = policyDimensions(['Política A', 'Política B'], ['Línea A', 'Línea B'], catalog);
  assert.deepEqual(data.policies.map((policy) => policy.lines.map((line) => line.name)), [['Línea A'], ['Línea B']]);
});
