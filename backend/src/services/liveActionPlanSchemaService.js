// Single source for both the official Action Plan and Improvement's link form.
const readLiveActionPlanSchema = async (actionPlan, transaction = null) => {
  const { StrategicTerm, StrategicFieldDefinition } = require('../models');
  const term = actionPlan.term || await StrategicTerm.findByPk(actionPlan.term_id, { transaction });
  if (!term?.strategic_plan_id) throw Object.assign(new Error('No se encontró el PED de la vigencia del Plan de Acción.'), { statusCode: 409 });
  const fresh = await require('./strategicActionPlanSchemaService').captureActionPlanSchema(term.strategic_plan_id, transaction);
  const inactive = await StrategicFieldDefinition.findAll({ where: { strategic_plan_id: term.strategic_plan_id, active: false }, attributes: ['key'], transaction });
  const inactiveKeys = new Set(inactive.map((field) => field.key));
  const freshKeys = new Set(fresh.fields.map((field) => field.key));
  const previous = actionPlan.metadata?.form_schema?.fields || [];
  const legacy = previous.filter((field) => field.active !== false && !freshKeys.has(field.key) && !inactiveKeys.has(field.key));
  const fields = [...fresh.fields, ...legacy].map((field) => {
    if (['responsible', 'responsable_de_ejecucion', 'co_responsibles'].includes(field.key) && !field.validation_rules?.catalog_type) {
      return { ...field, validation_rules: { ...(field.validation_rules || {}), catalog_type: 'organizational_unit' } };
    }
    return field;
  }).sort((a, b) => (a.position || 0) - (b.position || 0));
  return { ...fresh, fields };
};
module.exports = { readLiveActionPlanSchema };
