export const readLinkResult = (data = {}) => ({
  linkedActionItemId: data.actionItem?.id || data.activity?.linkedActionItemId || data.action_item_id,
  linkedActionItemCode: data.actionItem?.code || data.activity?.linkedActionItemCode || '',
  linkedActionPlanId: data.actionPlan?.id || data.activity?.linkedActionPlanId || data.action_plan_id,
  linkedActionPlanCode: data.actionPlan?.code || data.activity?.linkedActionPlanCode || data.action_plan_code || '',
  linkedActionPlanName: data.actionPlan?.title || data.activity?.linkedActionPlanTitle || data.action_plan_name || '',
  linkedDirectorNombre: data.actionPlan?.leader || data.director_nombre || '',
  actionPlanLinkState: 'linked'
});

export const unlinkLocalActivity = (activity, response = {}) => ({ ...activity,
  linkedActionPlanId: null, linkedActionItemId: null, linkedActionPlanCode: '', linkedActionPlanName: '',
  linkedActionPlanTitle: '', linkedActionItemCode: '', linkedAt: null, linkedDirectorNombre: '',
  actionPlanLinkState: 'unlinked', lastActionPlanLink: response.lastActionPlanLink || activity.lastActionPlanLink
});

export const resolveLinkOperation = (candidate, activity, planId, name, requestedId) => {
  const items = candidate?.existing_activities || [];
  const same = (item) => {
    const previous = activity?.lastActionPlanLink;
    const knownIds = [activity?.linkedActionItemId, candidate?.linked_action_item_id,
      String(previous?.actionPlanId) === String(candidate?.id) ? previous?.actionItemId : null].filter(Boolean);
    if (knownIds.some((id) => String(id) === String(item.id))) return true;
    if (item.is_same_linked_activity) return true;
    const uid = item.pm_actividad_uid || item.pm_activity_uid || item.custom_values?.pm_actividad_uid || item.custom_values?.pm_activity_uid;
    const ownerPlan = item.pm_plan_id ?? item.custom_values?.pm_plan_id;
    return Boolean(uid && String(uid) === String(activity?.uid) && (ownerPlan == null || String(ownerPlan) === String(planId)));
  };
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const updateCandidates = items.filter(same);
  const previous = activity?.lastActionPlanLink;
  const targetId = requestedId || candidate?.linked_action_item_id || activity?.linkedActionItemId || (String(previous?.actionPlanId) === String(candidate?.id) ? previous?.actionItemId : null);
  const named = updateCandidates.filter((item) => normalize(item.activity) === normalize(name));
  const updateItem = (targetId ? updateCandidates.find((item) => String(item.id) === String(targetId)) : named.length === 1 ? named[0] : updateCandidates.length === 1 ? updateCandidates[0] : null) || null;
  const duplicateItem = name?.trim() ? items.find((item) => !same(item) && normalize(item.activity) === normalize(name)) || null : null;
  return { updateItem, duplicateItem, updateCandidates, needsSelection: updateCandidates.length > 0 && !updateItem };
};
