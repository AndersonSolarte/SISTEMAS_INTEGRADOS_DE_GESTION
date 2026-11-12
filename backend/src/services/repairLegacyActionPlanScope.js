const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { StrategicActionPlan, StrategicActionItem, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicMeeting, StrategicWorkflowEvent, StrategicNotification, PlanAccion, User } = require('../models');
const { dependencyCode, historicalYear, chooseLegacyUnit, preferredLegacyUnitIds, scopeFromPlanCode } = require('./legacyActionScope');
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
    const officialOwners = plans.filter(p => !p.deleted_at && !/^LEGACY-/i.test(p.code)
      && p.term_id === legacy.term_id && scopeFromPlanCode(p.code) === scopeFromPlanCode(legacy.code));
    if (legacy.responsible_user_id && officialOwners.some(p => p.responsible_user_id
      && String(p.responsible_user_id) !== String(legacy.responsible_user_id))) continue;
    const unit = chooseLegacyUnit(units.filter((unit) => unit.strategic_plan_id === legacy.term.strategic_plan_id), row.responsable,
      preferredLegacyUnitIds(plans, legacy.term, row.responsable),
      preferredLegacyUnitIds(plans, legacy.term, row.responsable, { officialOnly: true }));
    if (!unit) continue;
    if (legacy.catalog_item_id !== unit.id) await legacy.update({ catalog_item_id: unit.id,
      responsible_user_id: null, responsibility_id: null,
      metadata: { ...(legacy.metadata || {}), legacy_previous_responsible_user_id: legacy.responsible_user_id ?? legacy.metadata?.legacy_previous_responsible_user_id, legacy_previous_responsibility_id: legacy.responsibility_id ?? legacy.metadata?.legacy_previous_responsibility_id, legacy_scope_repaired_at: new Date().toISOString() }
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
      // A leader explicitly saved on the official plan must survive the merge,
      // even when the older UI never created its responsibility record.
      if (target.responsible_user_id) {
        const user = await User.findOne({ where: { id: target.responsible_user_id, estado: 'activo' }, transaction });
        if (user) {
          let selected = targetLeaders.find(r => String(r.user_id) === String(user.id));
          if (!selected) selected = await StrategicResponsibility.create({ term_id: target.term_id, catalog_item_id: target.catalog_item_id,
            action_plan_id: target.id, responsibility_type: 'action_plan_leader', user_id: user.id,
            starts_on: new Date().toISOString().slice(0, 10), status: 'active', created_by: target.created_by || user.id }, { transaction });
          for (const previous of targetLeaders) if (previous.id !== selected.id) await previous.update({ status: 'ended', ends_on: new Date().toISOString().slice(0, 10) }, { transaction });
          await target.update({ responsibility_id: selected.id }, { transaction });
          targetLeaders.splice(0, targetLeaders.length, selected);
        }
      }
      let hasLeader = targetLeaders.length > 0 || Boolean(target.responsible_user_id) || Boolean(target.metadata?.leader_assignment_paused);
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
