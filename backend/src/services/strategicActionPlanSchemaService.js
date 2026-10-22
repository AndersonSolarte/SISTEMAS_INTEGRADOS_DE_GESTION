const {
  StrategicPlan, StrategicLevel, StrategicElement, StrategicCatalogItem, StrategicFieldDefinition
} = require('../models');
const { Op } = require('sequelize');

const plain = (row) => (typeof row?.toJSON === 'function' ? row.toJSON() : row);

const captureActionPlanSchema = async (strategicPlanId, transaction = null) => {
  const plan = await StrategicPlan.findByPk(strategicPlanId, { transaction });
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const [fieldRows, levelRows, elementRows, catalogRows] = await Promise.all([
    StrategicFieldDefinition.findAll({
      where: { strategic_plan_id: plan.id, active: true },
      order: [['position', 'ASC'], ['configuration_version', 'DESC'], ['updated_at', 'DESC']],
      transaction
    }),
    StrategicLevel.findAll({
      where: { strategic_plan_id: plan.id, active: true },
      order: [['position', 'ASC'], ['configuration_version', 'DESC']],
      transaction
    }),
    StrategicElement.findAll({
      where: { strategic_plan_id: plan.id, active: true, deleted_at: null },
      order: [['position', 'ASC']],
      transaction
    }),
    StrategicCatalogItem.findAll({
      where: { strategic_plan_id: plan.id, active: true },
      order: [['catalog_type', 'ASC'], ['name', 'ASC']],
      transaction
    })
  ]);

  // Desduplicar campos por key dando prioridad a la versión activa del PED
  const seenKeys = new Map();
  for (const row of fieldRows) {
    const item = plain(row);
    if (!seenKeys.has(item.key)) {
      seenKeys.set(item.key, item);
    } else if (Number(item.configuration_version) === Number(plan.configuration_version)) {
      seenKeys.set(item.key, item);
    }
  }
  const uniqueFields = Array.from(seenKeys.values()).sort((a, b) => (a.position || 0) - (b.position || 0));

  // Desduplicar niveles por posición
  const seenLevels = new Map();
  for (const row of levelRows) {
    const item = plain(row);
    if (!seenLevels.has(item.position)) {
      seenLevels.set(item.position, item);
    } else if (Number(item.configuration_version) === Number(plan.configuration_version)) {
      seenLevels.set(item.position, item);
    }
  }
  const uniqueLevels = Array.from(seenLevels.values()).sort((a, b) => (a.position || 0) - (b.position || 0));
  const elements = elementRows.map(plain);

  const fields = uniqueFields.map((field) => {
    const updated = { ...field };
    if (['responsible', 'responsable_de_ejecucion', 'co_responsibles'].includes(updated.key) && !updated.validation_rules?.catalog_type) {
      updated.validation_rules = { ...(updated.validation_rules || {}), catalog_type: 'organizational_unit' };
    }

    // Si el campo es de tipo relación estratégica o lista pero no tiene opciones configuradas manualmente,
    // intentar auto-poblar las opciones con los elementos de la estructura del PED (Objetivos o Lineamientos)
    const currentOptions = Array.isArray(updated.options) ? updated.options : (updated.options ? [updated.options] : []);
    if (!currentOptions.length && (updated.data_type === 'strategic_relation' || updated.data_type === 'list')) {
      const normKey = (updated.key || '').toLowerCase();
      const normLabel = (updated.label || '').toLowerCase();
      const matchedLevel = uniqueLevels.find((lvl) => {
        if (updated.validation_rules?.selected_level_id && String(lvl.id) === String(updated.validation_rules.selected_level_id)) return true;
        const normLvlName = (lvl.name || '').toLowerCase();
        if (normKey.includes('objective') || normLabel.includes('objetivo')) return normLvlName.includes('objetivo') || lvl.position === 1;
        if (normKey.includes('guideline') || normKey.includes('lineamiento') || normLabel.includes('lineamiento')) return normLvlName.includes('lineamiento') || lvl.position === 2;
        return normLvlName === normLabel;
      });
      if (matchedLevel) {
        const matchingElements = elements.filter((el) => String(el.level_id) === String(matchedLevel.id));
        if (matchingElements.length > 0) {
          updated.options = matchingElements.map((el) => (el.code ? `${el.code} ${el.name}` : el.name));
        }
      }
    }

    return updated;
  });

  return {
    strategic_plan_id: plan.id,
    configuration_version: plan.configuration_version,
    captured_at: new Date().toISOString(),
    fields,
    levels: uniqueLevels,
    elements,
    catalogs: catalogRows.map(plain)
  };
};

module.exports = { captureActionPlanSchema };
