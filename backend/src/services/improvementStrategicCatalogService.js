// Existing grouping in plan_mejoramiento_2026.xlsx, Listas BP/BQ/BR.
// Only the legacy PED lacks parent_id. Names always come from Action Plan's DB.
const legacyGroups = {
  OE1: ['LE-001', 'LE-002', 'LE-003', 'LE-004'],
  OE2: ['LE-005', 'LE-006', 'LE-007', 'LE-008', 'LE-009', 'LE-010'],
  OE3: ['LE-011', 'LE-012', 'LE-013']
};
const label = (element) => `${element.code} ${element.name}`.trim();

const buildStrategicCatalog = (plan, levels, elements) => {
  const objectiveLevel = levels.find((level) => Number(level.position) === 1);
  const guidelineLevel = levels.find((level) => Number(level.position) === 2);
  const active = elements.filter((element) => element.active !== false && !element.deleted_at);
  const objectives = active.filter((element) => String(element.level_id) === String(objectiveLevel?.id));
  const guidelines = active.filter((element) => String(element.level_id) === String(guidelineLevel?.id));
  const objectiveProjects = {};
  const relations = objectives.map((objective) => {
    const children = guidelines.filter((guideline) => guideline.parent_id
      ? String(guideline.parent_id) === String(objective.id)
      : plan.code === 'PED-2022-2029' && (legacyGroups[objective.code] || []).includes(guideline.code));
    objectiveProjects[label(objective)] = children.map(label);
    return { id: objective.id, code: objective.code, name: objective.name, label: label(objective),
      guidelines: children.map((guideline) => ({ id: guideline.id, code: guideline.code, name: guideline.name, label: label(guideline) })) };
  });
  return { strategicObjectives: objectives.map(label), objectiveProjects, strategicRelations: relations,
    strategicSource: { id: plan.id, code: plan.code } };
};

const readActionPlanStrategicCatalog = async (planId = null) => {
  const { StrategicPlan, StrategicTerm, StrategicLevel, StrategicElement } = require('../models');
  let plan = planId
    ? await StrategicPlan.findOne({ where: { id: planId, deleted_at: null } })
    : await StrategicPlan.findOne({ where: { status: 'active', deleted_at: null }, order: [['starts_on', 'DESC']] });
  if (!plan && !planId) {
    // Older deployments can have a configured PED without status=active.
    // Resolve it through the action-plan term instead of inventing a catalog.
    const term = await StrategicTerm.findOne({ where: { status: 'active' }, order: [['year', 'DESC']] })
      || await StrategicTerm.findOne({ where: { status: 'planned' }, order: [['year', 'DESC']] });
    if (term) plan = await StrategicPlan.findOne({ where: { id: term.strategic_plan_id, deleted_at: null } });
  }
  if (!plan) return { strategicObjectives: [], objectiveProjects: {}, strategicRelations: [] };
  const [levels, elements] = await Promise.all([
    StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true }, order: [['position', 'ASC']] }),
    StrategicElement.findAll({ where: { strategic_plan_id: plan.id, active: true, deleted_at: null }, order: [['position', 'ASC'], ['code', 'ASC']] })
  ]);
  const catalog = buildStrategicCatalog(plan, levels, elements);
  if (catalog.strategicRelations.length) return catalog;
  // Imported legacy elements may still reference an earlier active level version.
  const storedLevels = await StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, active: true }, order: [['configuration_version', 'DESC'], ['position', 'ASC']] });
  const usedLevels = storedLevels.filter((level) => elements.some((element) => String(element.level_id) === String(level.id)));
  return buildStrategicCatalog(plan, usedLevels, elements);
};

module.exports = { buildStrategicCatalog, readActionPlanStrategicCatalog };
