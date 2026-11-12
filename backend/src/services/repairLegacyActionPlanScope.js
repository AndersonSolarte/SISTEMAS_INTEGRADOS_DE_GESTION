const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { StrategicActionPlan, StrategicActionItem, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicMeeting, StrategicWorkflowEvent, StrategicNotification, PlanAccion } = require('../models');
const { dependencyCode, historicalYear, chooseLegacyUnit, preferredLegacyUnitIds } = require('./legacyActionScope');
const { reconcileLegacyActionPlans, syncMissingPlanLeaders } = require('./strategicLegacyActionPlanService');
const { isLegacyItem } = require('./legacyActionIdentity');

const repairLegacyActionPlanScope = async () => {
  const outsideHistory = await StrategicActionItem.findAll({ where: { deleted_at: null }, include: [
    { model: StrategicActionPlan, as: 'actionPlan', required: true, include: [
      { model: StrategicTerm, as: 'term', required: true, where: { year: { [Op.or]: [{ [Op.lt]: 2022 }, { [Op.gt]: 2026 }] } } }
    ] }
  ] });
  let archivedOutsideHistory = 0;
  for (const item of outsideHistory.filter(isLegacyItem)) {
    await item.update({ deleted_at: new Date(), custom_values: { ...(item.custom_values || {}),
      legacy_out_of_scope_year: item.actionPlan.term.year
    } });
    archivedOutsideHistory++;
  }
  await reconcileLegacyActionPlans();
  const source = await PlanAccion.findAll({ where: { deleted_at: null } });
  const units = await StrategicCatalogItem.findAll({ where: { catalog_type: ['dependency', 'organizational_unit'] } });
  const plans = await StrategicActionPlan.findAll({ where: { deleted_at: null }, include: [
    { model: StrategicTerm, as: 'term', required: true },
    { model: StrategicCatalogItem, as: 'organizationalUnit', required: true }
  ], order: [['created_at', 'ASC']] });
  let merged = 0;
  for (const legacy of plans.filter((plan) => /^LEGACY-\d{4}-R\d+$/i.test(plan.code) && historicalYear(plan.term.year))) {
    const ownerCode = dependencyCode(legacy.code.replace(/^LEGACY-\d{4}-/i, ''));
    const row = source.find((row) => Number(row.anio) === Number(legacy.term.year) && dependencyCode(row.responsable) === ownerCode);
    if (!row) continue;
    const unit = chooseLegacyUnit(units.filter((unit) => unit.strategic_plan_id === legacy.term.strategic_plan_id), row.responsable,
      preferredLegacyUnitIds(plans, legacy.term, row.responsable));
    if (!unit) continue;
    if (legacy.catalog_item_id !== unit.id) await legacy.update({ catalog_item_id: unit.id,
      responsible_user_id: null, responsibility_id: null,
      metadata: { ...(legacy.metadata || {}), legacy_scope_repaired_at: new Date().toISOString() }
    });
    const target = plans.filter((plan) => !plan.deleted_at
      && plan.term_id === legacy.term_id && plan.catalog_item_id === legacy.catalog_item_id
      && (!/^LEGACY-/i.test(plan.code) || dependencyCode(plan.code.replace(/^LEGACY-\d{4}-/i, '')) === ownerCode))
      .sort((a, b) => Number(/^LEGACY-/i.test(a.code)) - Number(/^LEGACY-/i.test(b.code))
        || new Date(a.created_at) - new Date(b.created_at))[0];
    if (!target || target.id === legacy.id) continue;
    await sequelize.transaction(async (transaction) => {
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
        replacements: { key: `legacy-action-plan:${legacy.term.year}:${ownerCode}` }, transaction
      });
      const items = await StrategicActionItem.findAll({ where: { action_plan_id: legacy.id }, transaction });
      for (const item of items) {
        const collision = await StrategicActionItem.findOne({ where: { action_plan_id: target.id, code: item.code }, transaction });
        await item.update({ action_plan_id: target.id,
          ...(collision ? { code: `MERGED-${item.id}` } : {}),
          custom_values: { ...(item.custom_values || {}), legacy_previous_plan_id: legacy.id }
        }, { transaction });
      }
      for (const model of [StrategicMeeting, StrategicWorkflowEvent, StrategicNotification]) {
        await model.update({ action_plan_id: target.id }, { where: { action_plan_id: legacy.id }, transaction });
      }
      const targetLeaders = await StrategicResponsibility.findAll({ where: { action_plan_id: target.id,
        term_id: target.term_id, catalog_item_id: target.catalog_item_id,
        responsibility_type: 'action_plan_leader', status: 'active' }, transaction });
      let hasLeader = targetLeaders.length > 0;
      const history = await StrategicResponsibility.findAll({ where: { action_plan_id: legacy.id }, transaction });
      for (const assignment of history) {
        const validLeader = assignment.responsibility_type === 'action_plan_leader'
          && assignment.term_id === target.term_id && assignment.catalog_item_id === target.catalog_item_id;
        const keepActive = assignment.status === 'active' && validLeader && !hasLeader;
        await assignment.update({ action_plan_id: target.id,
          ...(assignment.status === 'active' && !keepActive ? { status: 'ended' } : {})
        }, { transaction });
        if (keepActive) hasLeader = true;
      }
      await legacy.update({ deleted_at: new Date(), metadata: { ...(legacy.metadata || {}),
        legacy_merged_into_plan_id: target.id, legacy_merged_at: new Date().toISOString()
      } }, { transaction });
    });
    merged++;
  }
  // Consolidate any copies brought from the legacy plan, using the same scoped rules.
  if (merged) await reconcileLegacyActionPlans();
  await syncMissingPlanLeaders();
  return { merged, archivedOutsideHistory };
};

module.exports = { repairLegacyActionPlanScope };
