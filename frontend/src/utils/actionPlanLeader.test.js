import { actionPlanLeader, applySavedPlanLeader } from './actionPlanLeader';
const old = { id: 1, nombre: 'Old user', email: 'old@example.com' };
const next = { id: 2, name: 'New user', email: 'new@example.com' };
test('an explicitly empty plan never displays the stale annual or associated user', () => {
  expect(actionPlanLeader({ responsible_user_id: null, responsibleUser: old }, { responsible: { id: 1, name: 'Old annual' } })).toBeNull();
  expect(actionPlanLeader({ responsible_user_id: 1, responsibleUser: old, metadata: { leader_assignment_paused: true } })).toBeNull();
});
test('a changed leader does not fall back to another user when references are stale', () => {
  expect(actionPlanLeader({ responsible_user_id: 2, responsibleUser: old }, { responsible: old }, [next]).name).toBe('New user');
  expect(actionPlanLeader({ responsible_user_id: 2, responsibleUser: old }, { responsible: old }).id).toBe(2);
});
test('the saved response clears or replaces the card association immediately', () => {
  const before = { id: 'plan', responsible_user_id: 1, responsibleUser: old };
  expect(applySavedPlanLeader(before, { id: 'plan', responsible_user_id: null }, []).responsibleUser).toBeNull();
  expect(applySavedPlanLeader(before, { id: 'plan', responsible_user_id: 2 }, [next]).responsibleUser.nombre).toBe('New user');
  expect(before.responsibleUser.nombre).toBe('Old user');
});
test('annual fallback remains available when a dependency has no plan yet', () => {
  expect(actionPlanLeader(null, { responsible: next }).name).toBe('New user');
});
