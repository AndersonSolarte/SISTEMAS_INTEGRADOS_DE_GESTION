const {
  StrategicPlan, StrategicLevel, StrategicElement, StrategicCatalogItem, StrategicFieldDefinition
} = require('../models');
const { Op } = require('sequelize');

const plain = (row) => (typeof row?.toJSON === 'function' ? row.toJSON() : row);

const captureActionPlanSchema = async (strategicPlanId, transaction = null) => {
  const plan = await StrategicPlan.findByPk(strategicPlanId, { transaction });
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const [fieldRows, levelRows, elementRows] = await Promise.all([
    StrategicFieldDefinition.findAll({
      where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true },
      order: [['position', 'ASC']], transaction
    }),
    StrategicLevel.findAll({
      where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true },
      order: [['position', 'ASC']], transaction
    }),
    StrategicElement.findAll({
      where: { strategic_plan_id: plan.id, active: true, deleted_at: null },
      order: [['position', 'ASC']], transaction
    })
  ]);
  const fields = fieldRows.map(plain);
  const catalogTypes = [...new Set(fields.map((field) => field.validation_rules?.catalog_type).filter(Boolean))];
  const catalogRows = catalogTypes.length ? await StrategicCatalogItem.findAll({
    where: { strategic_plan_id: plan.id, catalog_type: { [Op.in]: catalogTypes }, active: true },
    order: [['catalog_type', 'ASC'], ['name', 'ASC']], transaction
  }) : [];
  return {
    strategic_plan_id: plan.id,
    configuration_version: plan.configuration_version,
    captured_at: new Date().toISOString(),
    fields,
    levels: levelRows.map(plain),
    elements: elementRows.map(plain),
    catalogs: catalogRows.map(plain)
  };
};

module.exports = { captureActionPlanSchema };
