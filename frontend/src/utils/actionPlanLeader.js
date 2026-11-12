export const leaderProfile = user => user ? ({
  id: user.id, name: user.name || user.nombre || '',
  document: user.document || user.username || '', email: user.email || '',
  position: user.position || user.cargo || '', dependency: user.dependency || user.dependencia || ''
}) : null;

export const actionPlanLeader = (plan, annualAssignment, options = []) => {
  if (!plan) return leaderProfile(annualAssignment?.responsible);
  if (plan.metadata?.leader_assignment_paused || !plan.responsible_user_id) return null;
  const id = String(plan.responsible_user_id);
  const found = [plan.responsibleUser, ...options, annualAssignment?.responsible]
    .find(user => user && String(user.id) === id);
  return leaderProfile(found) || { id: plan.responsible_user_id, name: 'Usuario asignado (ID ' + id + ')' };
};

export const applySavedPlanLeader = (previous, saved, options) => {
  const updated = { ...previous, ...saved };
  const profile = actionPlanLeader(updated, null, options);
  return { ...updated, responsibleUser: profile ? { id: profile.id, nombre: profile.name, username: profile.document,
    email: profile.email, cargo: profile.position, dependencia: profile.dependency } : null };
};
