import { isPlanWithinActiveSchedule } from './strategicPlanSchedule';

export const availableMyActionPlans = plans => (Array.isArray(plans) ? plans : []).filter(plan =>
  !plan.deleted_at && ['owner_validation', 'active', 'monitoring'].includes(plan.status)
  && (typeof plan.is_within_schedule === 'boolean' ? plan.is_within_schedule : isPlanWithinActiveSchedule(plan))
);

export const selectMyActionPlan = (plans, { requestedId, currentId, preferList = false } = {}) => {
  if (preferList) return null;
  if (requestedId) return plans.find(plan => String(plan.id) === String(requestedId)) || null;
  const current = plans.find(plan => String(plan.id) === String(currentId));
  if (current) return current;
  return plans.length === 1 ? plans[0] : null;
};
