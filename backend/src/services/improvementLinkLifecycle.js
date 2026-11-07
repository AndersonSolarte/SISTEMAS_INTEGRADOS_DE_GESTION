const belongsToActivity = (item, planId, uid) => String(item.custom_values?.pm_plan_id) === String(planId)
  && String(item.custom_values?.pm_actividad_uid || item.custom_values?.pm_activity_uid) === String(uid);
const reusableLink = (items, planId, uid, { itemId, name } = {}) => {
  const eligible = items.filter((item) => belongsToActivity(item, planId, uid) && (!item.deleted_at || item.custom_values?.pm_link_status === 'unlinked'));
  if (itemId) return eligible.find((item) => String(item.id) === String(itemId));
  const active = eligible.filter((item) => !item.deleted_at);
  const candidates = active.length ? active : eligible;
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  const matches = name ? candidates.filter((item) => normalize(item.activity) === normalize(name)) : [];
  return matches.length === 1 ? matches[0] : candidates.length === 1 ? candidates[0] : undefined;
};
const detachActivity = (activity, item, timestamp) => ({ ...activity,
  lastActionPlanLink: item ? { actionItemId: item.id, actionPlanId: item.action_plan_id, code: item.code, unlinkedAt: timestamp } : activity.lastActionPlanLink,
  actionPlanLinkState: 'unlinked', linkedActionPlanId: null, linkedActionPlanCode: null,
  linkedActionPlanTitle: null, linkedActionPlanName: null, linkedDirectorNombre: null,
  linkedActionItemId: null, linkedActionItemCode: null, linkedAt: null
});
module.exports = { belongsToActivity, reusableLink, detachActivity };
