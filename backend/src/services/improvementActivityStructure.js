const stripActivityDates = (activity = {}) => {
  const { fechaInicio, fechaFin, ...current } = activity;
  return current;
};
const stripContentActivityDates = (content = {}) => ({ ...content,
  ...(Array.isArray(content.objetivos) ? { objetivos: content.objetivos.map((objective) => ({ ...objective,
    ...(Array.isArray(objective.actividades) ? { actividades: objective.actividades.map(stripActivityDates) } : {})
  })) } : {})
});

// Idempotent cleanup of existing JSONB records, executed by npm run migrate.
const migrateLegacyActivityDates = async () => {
  const { sequelize } = require('../config/database');
  const { PlanMejoramiento } = require('../models');
  const { Op } = require('sequelize');
  let updated = 0;
  await sequelize.transaction(async (transaction) => {
    let afterId = 0;
    while (true) {
      const plans = await PlanMejoramiento.findAll({ where: { id: { [Op.gt]: afterId } }, attributes: ['id', 'contenido'], order: [['id', 'ASC']], limit: 200, transaction, lock: transaction.LOCK.UPDATE });
      if (!plans.length) break;
      for (const plan of plans) {
        const content = stripContentActivityDates(plan.contenido);
        if (JSON.stringify(content) !== JSON.stringify(plan.contenido)) {
          await plan.update({ contenido: content }, { transaction });
          updated += 1;
        }
        afterId = plan.id;
      }
    }
  });
  return updated;
};
module.exports = { stripActivityDates, stripContentActivityDates, migrateLegacyActivityDates };
