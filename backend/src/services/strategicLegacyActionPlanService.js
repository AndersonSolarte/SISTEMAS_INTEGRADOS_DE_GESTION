const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User, PlanAccion, StrategicPlan, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicActionPlan, StrategicActionItem
} = require('../models');
const { captureActionPlanSchema } = require('./strategicActionPlanSchemaService');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const code = (value, fallback = 'LEGACY') => String(value || fallback).normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '').slice(0, 60) || fallback;

const mapLegacyStatus = (value) => normalize(value) === 'aprobado' ? 'active' : 'convocation';
const legacyPlanCode = (row) => {
  if (String(row.plan_codigo || '').trim()) return String(row.plan_codigo).trim();
  const unitPrefix = String(row.responsable || '').match(/^([A-Z]\d+)\s*[_-]?/i)?.[1]?.toUpperCase();
  return `LEGACY-${row.anio}-${code(unitPrefix || row.responsable, 'SIN-DEPENDENCIA')}`.slice(0, 80);
};

const choosePlan = (plans, legacy) => {
  const candidates = plans.filter((plan) => plan.terms.some((term) => Number(term.year) === Number(legacy.anio)));
  if (candidates.length < 2) return candidates[0] || null;
  const legacyPed = normalize(legacy.ped);
  return candidates.find((plan) => legacyPed && [normalize(plan.code), normalize(plan.name)].some((value) => value.includes(legacyPed) || legacyPed.includes(value))) || candidates[0];
};

const findOrCreateUnit = async ({ plan, dependency, transaction }) => {
  const dependencyName = String(dependency || 'Dependencia histórica sin identificar').replace(/^([A-Z]\d+)\s*[_-]\s*/i, '').trim();
  const prefix = String(dependency || '').match(/^([A-Z]\d+)\s*[_-]/i)?.[1]?.toUpperCase();
  const units = await StrategicCatalogItem.findAll({
    where: { strategic_plan_id: plan.id, catalog_type: { [Op.in]: ['dependency', 'organizational_unit'] } }, transaction
  });
  const normalizedName = normalize(dependencyName);
  const existing = units.find((unit) => (prefix && String(unit.code).toUpperCase() === prefix)
    || normalize(unit.name) === normalizedName
    || (normalizedName.length > 5 && (normalize(unit.name).includes(normalizedName) || normalizedName.includes(normalize(unit.name)))));
  if (existing) return existing;
  let unitCode = `LEG-${code(prefix || dependencyName, 'DEPENDENCIA')}`.slice(0, 60);
  let sequence = 2;
  while (units.some((unit) => unit.code === unitCode)) {
    unitCode = `${`LEG-${code(prefix || dependencyName, 'DEPENDENCIA')}`.slice(0, 56)}-${sequence}`;
    sequence += 1;
  }
  return StrategicCatalogItem.create({
    strategic_plan_id: plan.id, catalog_type: 'organizational_unit', code: unitCode,
    name: dependencyName, metadata: { legacy_source: 'plan_accion' }, active: true
  }, { transaction });
};

/**
 * Puente idempotente entre el módulo histórico plan_accion y el espacio PED.
 * El origen nunca se modifica: se materializan solamente los planes identificables
 * por plan_codigo o por la combinación vigencia/responsable del formato anterior.
 * En ese formato, "responsable" almacena el código y nombre de la unidad ejecutora.
 */
const performLegacyReconciliation = async () => {
  const legacyRows = await PlanAccion.findAll({
    where: {
      deleted_at: null,
      [Op.or]: [
        { plan_codigo: { [Op.ne]: null } },
        { responsable: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: '' }] } }
      ]
    },
    order: [['anio', 'ASC'], ['id', 'ASC']]
  });
  if (!legacyRows.length) return { plans: 0, items: 0 };

  const plans = await StrategicPlan.findAll({
    where: { deleted_at: null }, include: [{ model: StrategicTerm, as: 'terms', required: true }]
  });
  const fallbackUser = await User.findOne({ where: { estado: 'activo' }, order: [['id', 'ASC']] });
  if (!fallbackUser) return { plans: 0, items: 0 };

  const groups = new Map();
  legacyRows.forEach((row) => {
    const key = legacyPlanCode(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  let migratedPlans = 0; let migratedItems = 0;

  for (const [legacyCode, rows] of groups) {
    const first = rows[0];
    const strategicPlan = choosePlan(plans, first);
    const term = strategicPlan?.terms.find((item) => Number(item.year) === Number(first.anio));
    if (!strategicPlan || !term) continue;
    const owner = first.responsable_id ? await User.findByPk(first.responsable_id) : null;
    const creator = first.creado_por ? await User.findByPk(first.creado_por) : null;

    await sequelize.transaction(async (transaction) => {
      const unit = await findOrCreateUnit({ plan: strategicPlan, dependency: first.dependencia || first.responsable, transaction });
      let actionPlan = await StrategicActionPlan.findOne({ where: { code: legacyCode, deleted_at: null }, transaction });
      if (!actionPlan) {
        const formSchema = await captureActionPlanSchema(strategicPlan.id, transaction);
        actionPlan = await StrategicActionPlan.create({
          term_id: term.id, catalog_item_id: unit.id, responsible_user_id: owner?.id || null,
          code: legacyCode, title: `Plan de Acción ${unit.name} ${term.year}`,
          status: mapLegacyStatus(first.estado_workflow),
          workflow_version: strategicPlan.configuration_version,
          instrument_version: strategicPlan.configuration_version,
          metadata: { legacy_source: 'plan_accion', legacy_plan_codigo: legacyCode, form_schema: formSchema },
          created_by: creator?.id || owner?.id || fallbackUser.id,
          updated_by: first.actualizado_por || creator?.id || owner?.id || fallbackUser.id
        }, { transaction });
        migratedPlans += 1;
      }

      if (owner) {
        await StrategicResponsibility.findOrCreate({
          where: { term_id: term.id, catalog_item_id: unit.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' },
          defaults: { user_id: owner.id, starts_on: term.starts_on, ends_on: term.ends_on, created_by: creator?.id || fallbackUser.id },
          transaction
        });
      }

      for (const row of rows) {
        const itemCode = `LEGACY-${row.id}`;
        const [, created] = await StrategicActionItem.findOrCreate({
          where: { action_plan_id: actionPlan.id, code: itemCode },
          defaults: {
            action_plan_id: actionPlan.id, code: itemCode,
            activity: row.actividad || row.macroactividad || row.objetivo_estrategico || 'Actividad histórica',
            indicator_type: row.tipo_indicador || null, indicator: row.indicador || null,
            target: row.meta || null, starts_on: row.fecha_inicio || null, ends_on: row.fecha_fin || null,
            co_responsibles: row.corresponsable ? [row.corresponsable] : [],
            current_progress: row.total_ejecucion || null,
            custom_values: {
              strategic_objective: row.objetivo_estrategico, strategic_guideline: row.lineamiento_estrategico,
              macroactivity: row.macroactividad, activity: row.actividad, indicator_type: row.tipo_indicador,
              starts_on: row.fecha_inicio, ends_on: row.fecha_fin, indicator: row.indicador, target: row.meta,
              responsible: row.responsable, co_responsible: row.corresponsable,
              progress_s1: row.avance_ip, observations_s1: row.observaciones_ip,
              progress_s2: row.avance_iip, observations_s2: row.observaciones_iip,
              total_progress: row.total_ejecucion, legacy_plan_accion_id: row.id
            },
            created_by: creator?.id || owner?.id || fallbackUser.id,
            updated_by: first.actualizado_por || creator?.id || owner?.id || fallbackUser.id
          },
          transaction
        });
        if (created) migratedItems += 1;
      }
    });
  }
  return { plans: migratedPlans, items: migratedItems };
};

let legacyReconciliationPromise = null;
const reconcileLegacyActionPlans = async () => {
  if (!legacyReconciliationPromise) {
    legacyReconciliationPromise = performLegacyReconciliation().catch((error) => {
      legacyReconciliationPromise = null;
      throw error;
    });
  }
  return legacyReconciliationPromise;
};

const annualRepairPromises = new Map();
const performAnnualDependencyRepair = async ({ planId = null } = {}) => {
  const termInclude = { model: StrategicTerm, as: 'term', required: true };
  if (planId) termInclude.where = { strategic_plan_id: planId };
  const actionPlans = await StrategicActionPlan.findAll({
    where: { deleted_at: null, responsible_user_id: { [Op.ne]: null } }, include: [termInclude]
  });
  let created = 0;
  for (const actionPlan of actionPlans) {
    const [, wasCreated] = await StrategicResponsibility.findOrCreate({
      where: {
        term_id: actionPlan.term_id, catalog_item_id: actionPlan.catalog_item_id,
        action_plan_id: null, responsibility_type: 'reference_leader', status: 'active'
      },
      defaults: {
        user_id: actionPlan.responsible_user_id, starts_on: actionPlan.term.starts_on,
        ends_on: actionPlan.term.ends_on, created_by: actionPlan.created_by
      }
    });
    if (wasCreated) created += 1;
  }
  return created;
};

const ensureAnnualDependenciesForActionPlans = async ({ planId = null } = {}) => {
  const key = planId || 'all';
  if (!annualRepairPromises.has(key)) {
    annualRepairPromises.set(key, performAnnualDependencyRepair({ planId }).catch((error) => {
      annualRepairPromises.delete(key);
      throw error;
    }));
  }
  return annualRepairPromises.get(key);
};

module.exports = { mapLegacyStatus, reconcileLegacyActionPlans, ensureAnnualDependenciesForActionPlans };
