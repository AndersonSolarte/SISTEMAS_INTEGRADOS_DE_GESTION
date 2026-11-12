// Read-only preview. Does not assign users, merge plans or change activities.
const { sequelize } = require('../config/database');
const { StrategicActionPlan, StrategicTerm, StrategicCatalogItem, User } = require('../models');
const { scopeFromPlanCode, chooseLegacyUnit, preferredLegacyUnitIds } = require('../services/legacyActionScope');
const historicalScope = plan => {
  const code = String(plan.metadata?.deleted_original_code || plan.code).replace(/^DELETED-[^-]+-/i, '').replace(/^PA-/i, '').replace(/^(20[0-9]{2})-DEP-/i, '$1-');
  const match = code.match(/^(20[0-9]{2})-(R[0-9]+)(?=$|[-_])/i);
  return scopeFromPlanCode(plan.code) || (match ? scopeFromPlanCode(`${match[1]}-${match[2]}`) : null);
};
async function preview() {
  const plans = await StrategicActionPlan.findAll({ include: [
    { model: StrategicTerm, as: 'term', where: { year: 2026 } },
    { model: StrategicCatalogItem, as: 'organizationalUnit' },
    { model: User, as: 'responsibleUser', attributes: ['id', 'nombre'] }
  ] });
  const units = await StrategicCatalogItem.findAll({ where: { catalog_type: ['dependency', 'organizational_unit'] } });
  const report = [];
  for (const legacy of plans.filter(p => !p.deleted_at && /^LEGACY-2026-R[0-9]+$/i.test(p.code))) {
    const scope = scopeFromPlanCode(legacy.code);
    const official = plans.filter(p => !p.deleted_at && p.term_id === legacy.term_id && !/^LEGACY-/i.test(p.code) && scopeFromPlanCode(p.code) === scope);
    const target = official.length === 1 ? official[0] : null;
    let selectedUnit = null; let reason = null;
    if (target) {
      const owner = legacy.code.replace(/^LEGACY-2026-/i, '');
      try { selectedUnit = chooseLegacyUnit(units.filter(u => u.strategic_plan_id === legacy.term.strategic_plan_id), owner,
        preferredLegacyUnitIds(plans, legacy.term, owner), preferredLegacyUnitIds(plans, legacy.term, owner, { officialOnly: true })); }
      catch (e) { reason = e.message; }
    }
    const ready = Boolean(target && target.responsible_user_id && selectedUnit?.id === target.catalog_item_id
      && (!legacy.responsible_user_id || legacy.responsible_user_id === target.responsible_user_id));
    report.push({ legacy_plan: legacy.code, legacy_id: legacy.id, official_plan: target?.code || null, official_id: target?.id || null,
      responsible: target?.responsibleUser?.nombre || null, responsible_user_id: target?.responsible_user_id || null,
      proposed_action: ready ? 'unify_into_official_preserving_leader' : 'manual_review_required', reason,
      archived_candidates: plans.filter(p => p.deleted_at && p.term_id === legacy.term_id && historicalScope(p) === scope && p.responsible_user_id)
        .map(p => ({ plan: p.code, user_id: p.responsible_user_id, name: p.responsibleUser?.nombre || null })) });
  }
  console.log(JSON.stringify({ read_only: true, year: 2026, proposals: report }, null, 2));
}
preview().catch(e => { console.error(e.message); process.exitCode = 1; }).finally(() => sequelize.close());
