const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { sequelize } = require('../config/database');
const { PlanMejoramiento, StrategicActionItem, StrategicEvidence, StrategicMonitoringResult } = require('../models');

const run = async () => {
  const apply = process.argv.includes('--apply');
  const repairs = [];
  for (const plan of await PlanMejoramiento.findAll()) {
    for (const objective of plan.contenido?.objetivos || []) {
      for (const activity of objective.actividades || []) {
        if (!activity.linkedActionItemId || !activity.uid) continue;
        const canonical = await StrategicActionItem.findByPk(activity.linkedActionItemId);
        if (!canonical || canonical.deleted_at) continue;
        const siblings = await StrategicActionItem.findAll({ where: { action_plan_id: canonical.action_plan_id, deleted_at: null } });
        for (const duplicate of siblings.filter((item) => item.id !== canonical.id
          && String(item.custom_values?.pm_plan_id) === String(plan.id)
          && String(item.custom_values?.pm_actividad_uid) === String(activity.uid))) {
          const evidence = await StrategicEvidence.findAll({ where: { action_item_id: duplicate.id } });
          const results = await StrategicMonitoringResult.findAll({ where: { action_item_id: duplicate.id } });
          repairs.push({ canonical: canonical.toJSON(), duplicate: duplicate.toJSON(), evidence: evidence.map((r) => r.toJSON()), results: results.map((r) => r.toJSON()) });
        }
      }
    }
  }
  console.log(JSON.stringify({ apply, repairs: repairs.map((r) => ({ from: r.duplicate.code, to: r.canonical.code, evidence: r.evidence.length })) }));
  if (apply && repairs.length) {
    const directory = path.resolve(__dirname, '../../logs');
    fs.mkdirSync(directory, { recursive: true });
    const backup = path.join(directory, `improvement-links-${Date.now()}.json`);
    fs.writeFileSync(backup, JSON.stringify(repairs, null, 2), { flag: 'wx' });
    await sequelize.transaction(async (transaction) => {
      for (const repair of repairs) {
        const { duplicate, canonical } = repair;
        await StrategicEvidence.update({ action_item_id: canonical.id }, { where: { action_item_id: duplicate.id }, transaction });
        for (const result of repair.results.filter((r) => !r.deleted_at)) {
          const existing = await StrategicMonitoringResult.findOne({ where: { action_item_id: canonical.id, monitoring_period_id: result.monitoring_period_id, deleted_at: null }, transaction });
          if (!existing) await StrategicMonitoringResult.update({ action_item_id: canonical.id }, { where: { id: result.id }, transaction });
        }
        await StrategicActionItem.update({ deleted_at: new Date() }, { where: { id: duplicate.id, deleted_at: null }, transaction });
      }
    });
    console.log('Consolidación completada con respaldo local y sin eliminar archivos de Drive.');
  }
};
run().then(() => sequelize.close()).catch(async (error) => { console.error(error.message); await sequelize.close(); process.exitCode = 1; });
