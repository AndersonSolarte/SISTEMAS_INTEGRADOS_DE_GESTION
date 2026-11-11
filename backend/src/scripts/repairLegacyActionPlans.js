const { sequelize } = require('../config/database');
const { StrategicActionPlan, StrategicActionItem, PlanAccion } = require('../models');
const { legacyPlanCode, reconcileLegacyActionPlans } = require('../services/strategicLegacyActionPlanService');
const { sameLegacyActivity, isLegacyItem } = require('../services/legacyActionIdentity');
const { historicalYear, sourceScope, scopeFromPlanCode } = require('../services/legacyActionScope');

const run = async () => {
  const args = process.argv.slice(2);
  const planArgs = args.filter((arg) => arg.startsWith('--plan='));
  if (planArgs.length > 1 || (planArgs.length && !planArgs[0].slice(7).trim())) {
    throw new Error('Indique un único código de plan no vacío.');
  }
  const planCode = planArgs[0]?.slice(7).trim() || null;
  if (args.some((arg) => arg !== '--apply' && !arg.startsWith('--plan='))) {
    throw new Error('Uso: npm run repair:legacy-action-plans -- [--plan=CODIGO] [--apply]');
  }
  const source = await PlanAccion.findAll({ where: { deleted_at: null } });
  const sourceGroups = new Map();
  for (const row of source) {
    if (!historicalYear(row.anio)) continue;
    const key = legacyPlanCode(row);
    if (!sourceGroups.has(key)) sourceGroups.set(key, []);
    sourceGroups.get(key).push(row);
  }
  const matchingSource = (code) => sourceGroups.get(code)
    || [...sourceGroups.values()].find((rows) => sourceScope(rows[0]) === scopeFromPlanCode(code));
  if (planCode && !matchingSource(planCode)) throw new Error(`No hay origen histórico para ${planCode}. Ejecute sin --plan para consultar los códigos.`);
  const report = async () => {
    const rows = [];
    for (const plan of await StrategicActionPlan.findAll({ where: { deleted_at: null } })) {
      if (planCode && plan.code !== planCode && scopeFromPlanCode(plan.code) !== scopeFromPlanCode(planCode)) continue;
      const items = await StrategicActionItem.findAll({ where: { action_plan_id: plan.id, deleted_at: null } });
      const originals = matchingSource(plan.code) || [];
      if (!originals.length) continue;
      rows.push({ code: plan.code, source_rows: originals.length, active_items: items.length,
        manual_items: items.filter((item) => !isLegacyItem(item)).length,
        possible_extra_copies: originals.reduce((n, row) => n + Math.max(0, items.filter((item) => sameLegacyActivity(item, row)).length - 1), 0) });
    }
    console.table(rows);
  };
  console.log('ANTES (solo lectura):');
  await report();
  if (!args.includes('--apply')) {
    console.log('Diagnóstico terminado. Agregue --apply para reconciliar y archivar copias; no se modificó información.');
    return;
  }
  console.log('Reconciliación:', planCode ? await reconcileLegacyActionPlans({ planCode })
    : await require('../services/repairLegacyActionPlanScope').repairLegacyActionPlanScope());
  console.log('DESPUÉS:');
  await report();
};

run().catch((error) => { console.error(error.message); process.exitCode = 1; }).finally(() => sequelize.close());
