const { test } = require('node:test');
const assert = require('node:assert/strict');
const { syncAvailability, assertCanSynchronize } = require('./improvementActionPlanSyncGate');
const plan = () => ({ status: 'formulation', term: { status: 'active', metadata: { formulation_starts_on: '2000-01-01', formulation_ends_on: '2099-12-31' } }, metadata: {} });
test('open global period permits improvement synchronization', () => assert.equal(syncAvailability(plan()).allowed, true));
test('closed or inactive terms and individual plans cannot synchronize even with a future extension', () => {
  for (const status of ['closed', 'inactive', 'archived']) {
    const value = plan(); value.term.status = status;
    value.metadata.formulation_extensions = [{ new_deadline: '2100-12-31' }];
    assert.equal(syncAvailability(value).allowed, false);
    const individual = plan(); individual.status = status;
    assert.equal(syncAvailability(individual).allowed, false);
  }
});
test('expired global period blocks until a valid formal individual extension exists', () => {
  const value = plan(); value.term.metadata.formulation_ends_on = '2001-01-01';
  assert.equal(syncAvailability(value).allowed, false);
  value.metadata.formulation_ends_on = '2099-12-31';
  assert.equal(syncAvailability(value).allowed, false);
  value.metadata.formulation_extensions = [{ new_deadline: '2099-12-31' }];
  assert.equal(syncAvailability(value).allowed, true);
});
test('later global deadline remains valid after an individual extension expires', () => {
  const value = plan(); value.metadata.formulation_extensions = [{ new_deadline: '2001-01-01' }];
  assert.equal(syncAvailability(value).allowed, true);
});
test('future or missing schedules cannot synchronize', () => {
  const value = plan(); value.term.metadata.formulation_starts_on = '2090-01-01';
  assert.equal(syncAvailability(value).allowed, false);
  assert.equal(syncAvailability({ status: 'formulation' }).allowed, false);
});
test('direct synchronization rejects a closed destination without privileged bypass', async () => {
  const value = plan(); value.status = 'closed';
  await assert.rejects(() => assertCanSynchronize(value), { statusCode: 409 });
});
