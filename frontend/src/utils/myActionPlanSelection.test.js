import { availableMyActionPlans, selectMyActionPlan } from './myActionPlanSelection';
const a = { id: 'a', status: 'active', is_within_schedule: true };
const b = { id: 'b', status: 'monitoring', is_within_schedule: true };

test('multiple available plans require explicit selection', () => {
  expect(selectMyActionPlan([a, b])).toBeNull();
});
test('a single plan opens automatically and no plans keeps the closed-period view', () => {
  expect(selectMyActionPlan([a])).toBe(a);
  expect(selectMyActionPlan([])).toBeNull();
});
test('notifications open only an available assigned plan', () => {
  expect(selectMyActionPlan([a, b], { requestedId: 'b' })).toBe(b);
  expect(selectMyActionPlan([a, b], { requestedId: 'someone-elses-plan' })).toBeNull();
  expect(selectMyActionPlan([a], { requestedId: 'expired' })).toBeNull();
});
test('refresh preserves the chosen plan rather than opening the first one', () => {
  expect(selectMyActionPlan([a, b], { currentId: 'b' })).toBe(b);
  expect(selectMyActionPlan([a, b], { currentId: 'removed' })).toBeNull();
});
test('returning to the list remains explicit, including with a single plan', () => {
  expect(selectMyActionPlan([a, b], { currentId: 'b', preferList: true })).toBeNull();
  expect(selectMyActionPlan([a], { preferList: true })).toBeNull();
});
test('only available execution, monitoring and review plans appear', () => {
  const review = { id: 'review', status: 'owner_validation', is_within_schedule: true };
  expect(availableMyActionPlans([a, b, review,
    { ...a, id: 'expired', is_within_schedule: false },
    { ...a, id: 'closed', status: 'closed' },
    { ...a, id: 'draft', status: 'formulation' },
    { ...a, id: 'deleted', deleted_at: '2026-01-01' }
  ])).toEqual([a, b, review]);
});
test('old API responses without flags respect the term dates and closed state', () => {
  const term = { status: 'active', year: 2026, starts_on: '2000-01-01', ends_on: '2099-12-31' };
  expect(availableMyActionPlans([{ id: 'open', status: 'active', term }])).toHaveLength(1);
  expect(availableMyActionPlans([{ id: 'closed', status: 'active', term: { ...term, status: 'closed' } }])).toHaveLength(0);
  expect(availableMyActionPlans([{ id: 'expired', status: 'active', term: { ...term, ends_on: '2001-01-01' } }])).toHaveLength(0);
});
