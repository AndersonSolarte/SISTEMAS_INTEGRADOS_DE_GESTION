// Existing grouping in plan_mejoramiento_2026.xlsx, Listas BP/BQ/BR.
// Only the legacy PED lacks parent_id. Names always come from Action Plan's DB.
const legacyGroups = {
  OE1: ['LE-001', 'LE-002', 'LE-003', 'LE-004'],
  OE2: ['LE-005', 'LE-006', 'LE-007', 'LE-008', 'LE-009', 'LE-010'],
  OE3: ['LE-011', 'LE-012', 'LE-013']
};
const label = (element) => `${element.code} ${element.name}`.trim();
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

const buildStrategicCatalog = (plan, levels, elements) => {
  const objectiveLevel = levels.find((level) => normalize(level.name).includes('objetivo')) || levels.find((level) => Number(level.position) === 1);
  const guidelineLevel = levels.find((level) => normalize(level.name).includes('lineamiento')) || levels.find((level) => Number(level.position) === 2);
  const allById = new Map(elements.map((element) => [String(element.id), element]));
  const activeByCode = new Map();
  elements.filter((element) => element.active !== false && !element.deleted_at).forEach((element) => {
    const key = element.code || String(element.id);
    const previous = activeByCode.get(key);
    if (!previous || Number(element.version || 1) > Number(previous.version || 1)) activeByCode.set(key, element);
  });
  const active = [...activeByCode.values()];
  const objectives = active.filter((element) => String(element.level_id) === String(objectiveLevel?.id));
  const guidelines = active.filter((element) => String(element.level_id) === String(guidelineLevel?.id));
  const objectiveProjects = {};
  const relations = objectives.map((objective) => {
    const children = guidelines.filter((guideline) => guideline.parent_id
      ? String(guideline.parent_id) === String(objective.id)
        || Boolean(allById.get(String(guideline.parent_id))?.code && allById.get(String(guideline.parent_id)).code === objective.code)
      : plan.code === 'PED-2022-2029' && (legacyGroups[objective.code] || []).includes(guideline.code));
    objectiveProjects[label(objective)] = children.map(label);
    return { id: objective.id, code: objective.code, name: objective.name, label: label(objective),
      guidelines: children.map((guideline) => ({ id: guideline.id, code: guideline.code, name: guideline.name, label: label(guideline) })) };
  });
  return { strategicObjectives: objectives.map(label), objectiveProjects, strategicRelations: relations,
    strategicSource: { id: plan.id, code: plan.code } };
};

const buildSnapshotStrategicCatalog = (plan, schema) => {
  if (!schema) return null;
  const structure = buildStrategicCatalog(plan, schema.levels || [], schema.elements || []);
  if (structure.strategicRelations.length) {
    const objectiveField = (schema.fields || []).find((field) => /objective|objetivo/.test(normalize(field.key)) || normalize(field.label).includes('objetivo'));
    const guidelineField = (schema.fields || []).find((field) => /guideline|lineamiento/.test(normalize(field.key)) || normalize(field.label).includes('lineamiento'));
    const permitted = (row, field) => !Array.isArray(field?.options) || !field.options.length || field.options.some((option) => {
      const values = typeof option === 'object' && option ? [option.value, option.id, option.label, option.name, option.code] : [option];
      return values.some((value) => value != null && [row.id, row.label, row.name, row.code].some((candidate) => candidate != null && normalize(candidate).trim() === normalize(value).trim()));
    });
    const relations = structure.strategicRelations.filter((row) => permitted(row, objectiveField)).map((row) => ({ ...row, guidelines: row.guidelines.filter((line) => permitted(line, guidelineField)) }));
    return { ...structure, strategicRelations: relations, strategicObjectives: relations.map((row) => row.label), objectiveProjects: Object.fromEntries(relations.map((row) => [row.label, row.guidelines.map((line) => line.label)])) };
  }
  const fields = buildFieldStrategicCatalog(plan, schema.fields || [], schema.elements || []);
  return fields.strategicRelations.length ? fields : null;
};

// Some PEDs configure their dropdown options directly in field definitions,
// rather than importing strategic elements. This is also a valid Action Plan source.
const buildFieldStrategicCatalog = (plan, fields, storedElements = []) => {
  const objectiveField = fields.find((field) => /objective|objetivo/.test(normalize(field.key)))
    || fields.find((field) => normalize(field.label).includes('objetivo'));
  const guidelineField = fields.find((field) => /guideline|lineamiento/.test(normalize(field.key)))
    || fields.find((field) => normalize(field.label).includes('lineamiento'));
  const optionElement = (option, index, level) => {
    if (option === null || option === undefined) return null;
    const raw = typeof option === 'string' ? option : option.label || option.name || option.value;
    if (!raw || typeof raw !== 'string') return null;
    const code = raw.match(/^(OE\d+|LE-?\d+)\b/i)?.[0] || (typeof option === 'object' ? option.code || '' : '');
    return { id: typeof option === 'object' && option.id ? option.id : `${level}-${index}`, level_id: level,
      code, name: code && raw.startsWith(code) ? raw.slice(code.length).trim() : raw,
      parent_id: typeof option === 'object' ? option.parent_id || null : null };
  };
  const objectives = (Array.isArray(objectiveField?.options) ? objectiveField.options : []).map((option, i) => optionElement(option, i, 'objective-options')).filter(Boolean);
  const guidelines = (Array.isArray(guidelineField?.options) ? guidelineField.options : []).map((option, i) => optionElement(option, i, 'guideline-options')).filter(Boolean);
  for (const element of storedElements) {
    if (/^LE-?\d+$/i.test(element.code || '') && element.active !== false && !element.deleted_at && !guidelines.some((line) => line.code === element.code)) {
      const parent = objectives.find((objective) => storedElements.some((source) => String(source.id) === String(element.parent_id) && source.code === objective.code));
      guidelines.push({ ...element, level_id: 'guideline-options', parent_id: parent?.id || null });
    }
  }
  return buildStrategicCatalog(plan, [{ id: 'objective-options', position: 1 }, { id: 'guideline-options', position: 2 }], [...objectives, ...guidelines]);
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
    if (!plan) plan = await StrategicPlan.findOne({ where: { deleted_at: null }, order: [['starts_on', 'DESC']] });
  }
  if (!plan) return { strategicObjectives: [], objectiveProjects: {}, strategicRelations: [] };
  const [levels, elements] = await Promise.all([
    StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true }, order: [['position', 'ASC']] }),
    StrategicElement.findAll({ where: { strategic_plan_id: plan.id, active: true, deleted_at: null }, order: [['position', 'ASC'], ['code', 'ASC']] })
  ]);
  const activeIds = new Set(elements.map((element) => String(element.id)));
  const missingParents = [...new Set(elements.map((element) => element.parent_id).filter((id) => id && !activeIds.has(String(id))))];
  if (missingParents.length) {
    const { Op } = require('sequelize');
    const historicalParents = await StrategicElement.findAll({ where: { strategic_plan_id: plan.id, id: { [Op.in]: missingParents } }, attributes: ['id', 'code'] });
    elements.push(...historicalParents.map((element) => ({ id: element.id, code: element.code, active: false })));
  }
  const catalog = buildStrategicCatalog(plan, levels, elements);
  if (catalog.strategicRelations.length) return catalog;
  // Imported legacy elements may still reference an earlier active level version.
  const storedLevels = await StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, active: true }, order: [['configuration_version', 'DESC'], ['position', 'ASC']] });
  const usedLevels = storedLevels.filter((level) => elements.some((element) => String(element.level_id) === String(level.id)));
  const legacyCatalog = buildStrategicCatalog(plan, usedLevels, elements);
  if (legacyCatalog.strategicRelations.length) return legacyCatalog;
  const { StrategicFieldDefinition } = require('../models');
  const fields = await StrategicFieldDefinition.findAll({ where: { strategic_plan_id: plan.id, active: true, configuration_version: plan.configuration_version }, order: [['position', 'ASC']] });
  const fieldCatalog = buildFieldStrategicCatalog(plan, fields, elements);
  if (fieldCatalog.strategicRelations.length || planId) return fieldCatalog;
  // Do not let an empty future PED hide the configured institutional PED for
  // unlinked activities. Explicitly linked activities always keep their own PED.
  const candidates = await StrategicPlan.findAll({ where: { deleted_at: null }, order: [['starts_on', 'DESC']] });
  for (const candidate of candidates) {
    if (String(candidate.id) === String(plan.id)) continue;
    const result = await readActionPlanStrategicCatalog(candidate.id);
    if (result.strategicRelations.length) return result;
  }
  return fieldCatalog;
};

module.exports = { buildStrategicCatalog, buildFieldStrategicCatalog, buildSnapshotStrategicCatalog, readActionPlanStrategicCatalog };
