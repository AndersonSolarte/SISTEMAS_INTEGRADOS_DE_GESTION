const { resolvePlanEffectiveSchedule } = require('./actionPlanEffectiveSchedule');

const syncAvailability = (plan) => {
  if (!plan || plan.deleted_at || !plan.term || ['closed', 'inactive', 'archived'].includes(plan.status)) {
    return { allowed: false, message: 'El Plan de Acción o su vigencia no están habilitados para sincronizar.' };
  }
  const schedule = resolvePlanEffectiveSchedule(plan);
  if (!schedule.isWithinSchedule || !schedule.effectiveEndsOn || !schedule.effectiveStartsOn) {
    return { allowed: false, message: `La sincronización está cerrada. El plazo de formulación del Plan de Acción es ${schedule.effectiveStartsOn || 'sin inicio'} a ${schedule.effectiveEndsOn || 'sin cierre'}. Solicite habilitación a Planeación y Efectividad.` };
  }
  return { allowed: true, message: '', schedule };
};
const canSynchronize = async (plan) => {
  if (plan && !plan.term && plan.term_id) {
    const { StrategicTerm } = require('../models');
    const term = await StrategicTerm.findByPk(plan.term_id);
    return syncAvailability({ ...(plan.toJSON ? plan.toJSON() : plan), term });
  }
  return syncAvailability(plan);
};
const assertCanSynchronize = async (plan) => {
  const result = await canSynchronize(plan);
  if (!result.allowed) throw Object.assign(new Error(result.message), { status: 409, statusCode: 409 });
  return result;
};
module.exports = { syncAvailability, canSynchronize, assertCanSynchronize };
