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
  const objectives = active.filter((element) => element.level_id === objectiveLevel?.id);
  const guidelines = active.filter((element) => element.level_id === guidelineLevel?.id);
  const objectiveProjects = {};
  const relations = objectives.map((objective) => {
    const children = guidelines.filter((guideline) => guideline.parent_id
      ? guideline.parent_id === objective.id
      : plan.code === 'PED-2022-2029' && (legacyGroups[objective.code] || []).includes(guideline.code));
    objectiveProjects[label(objective)] = children.map(label);
    return { id: objective.id, code: objective.code, name: objective.name, label: label(objective),
      guidelines: children.map((guideline) => ({ id: guideline.id, code: guideline.code, name: guideline.name, label: label(guideline) })) };
  });
  return { strategicObjectives: objectives.map(label), objectiveProjects, strategicRelations: relations,
    strategicSource: { id: plan.id, code: plan.code } };
};

const readActionPlanStrategicCatalog = async () => {
  const { StrategicPlan, StrategicLevel, StrategicElement } = require('../models');
  const plan = await StrategicPlan.findOne({ where: { status: 'active', deleted_at: null }, order: [['starts_on', 'DESC']] });
  if (!plan) return { strategicObjectives: [], objectiveProjects: {}, strategicRelations: [] };
  const [levels, elements] = await Promise.all([
    StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true }, order: [['position', 'ASC']] }),
    StrategicElement.findAll({ where: { strategic_plan_id: plan.id, active: true, deleted_at: null }, order: [['position', 'ASC'], ['code', 'ASC']] })
  ]);
  return buildStrategicCatalog(plan, levels, elements);
};

module.exports = { buildStrategicCatalog, readActionPlanStrategicCatalog };
