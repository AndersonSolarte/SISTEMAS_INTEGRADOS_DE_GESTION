const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User, PlanAccion, StrategicPlan, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicActionPlan, StrategicActionItem,
  StrategicMonitoringPeriod, StrategicMonitoringResult, StrategicEvidence, StrategicBudgetMovement
} = require('../models');
const { captureActionPlanSchema } = require('./strategicActionPlanSchemaService');
const { sameLegacyActivity, fillMissing, schemaLegacyValues } = require('./legacyActionIdentity');

const consolidateLegacyItem = async (item, duplicate, transaction) => {
  const custom = fillMissing(item.custom_values || {}, duplicate.custom_values || {});
  custom.legacy_merged_item_ids = [...new Set([...(custom.legacy_merged_item_ids || []),
    ...(duplicate.custom_values?.legacy_merged_item_ids || []), duplicate.id])];
  await item.update({
    ...fillMissing({ starts_on: item.starts_on, ends_on: item.ends_on, target: item.target }, {
      starts_on: duplicate.starts_on, ends_on: duplicate.ends_on, target: duplicate.target
    }), custom_values: custom
  }, { transaction });
  // Preserve evidence and budget links on the surviving activity. Conflicting period
  // results and version history remain on the archived row for traceability.
  for (const model of [StrategicEvidence, StrategicBudgetMovement]) {
    await model.update({ action_item_id: item.id }, { where: { action_item_id: duplicate.id }, transaction });
  }
  const results = await StrategicMonitoringResult.findAll({ where: { action_item_id: duplicate.id }, transaction });
  for (const result of results) {
    const existing = await StrategicMonitoringResult.findOne({
      where: { action_item_id: item.id, monitoring_period_id: result.monitoring_period_id }, transaction
    });
    if (!existing) await result.update({ action_item_id: item.id }, { transaction });
    else if (!result.deleted_at && existing.status === 'imported' && result.status !== 'imported') {
      const snapshot = result.toJSON();
      delete snapshot.id; delete snapshot.action_item_id;
      delete snapshot.created_at; delete snapshot.updated_at;
      await existing.update(snapshot, { transaction });
    }
  }
  await duplicate.update({ deleted_at: new Date(), custom_values: {
    ...(duplicate.custom_values || {}), legacy_duplicate_of: item.id
  } }, { transaction });
};

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
  const existing = units.find((unit) => {
    const unitCode = String(unit.code || '').toUpperCase();
    if (prefix && (unitCode === prefix || unitCode.startsWith(`${prefix}_`) || unitCode.startsWith(`${prefix}-`))) {
      return true;
    }
    if (normalize(unit.name) === normalizedName) return true;
    return false;
  });
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
const performLegacyReconciliation = async ({ planCode = null } = {}) => {
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
    if (planCode && legacyCode !== planCode) continue;
    const first = rows[0];
    const strategicPlan = choosePlan(plans, first);
    const term = strategicPlan?.terms.find((item) => Number(item.year) === Number(first.anio));
    if (!strategicPlan || !term) continue;
    const owner = first.responsable_id ? await User.findByPk(first.responsable_id) : null;
    const creator = first.creado_por ? await User.findByPk(first.creado_por) : null;

    await sequelize.transaction(async (transaction) => {
      // Serialize bridge runs across workers as well as within this Node process.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
        replacements: { key: `legacy-action-plan:${legacyCode}` }, transaction
      });
      const unit = await findOrCreateUnit({ plan: strategicPlan, dependency: first.dependencia || first.responsable, transaction });

      // Priorizar el plan oficial existente para esta unidad y vigencia (evita duplicar planes con Paso 3)
      let actionPlan = await StrategicActionPlan.findOne({
        where: {
          term_id: term.id,
          catalog_item_id: unit.id,
          deleted_at: null
        },
        transaction
      });
      if (!actionPlan) {
        actionPlan = await StrategicActionPlan.findOne({
          where: {
            [Op.or]: [
              { code: legacyCode },
              { metadata: { [Op.contains]: { deleted_original_code: legacyCode } } }
            ]
          },
          transaction
        });
      }
      if (actionPlan?.deleted_at) {
        const restoredMetadata = { ...(actionPlan.metadata || {}) };
        delete restoredMetadata.deleted_original_code;
        restoredMetadata.restored_from_legacy_at = new Date().toISOString();
        await actionPlan.update({
          code: legacyCode,
          deleted_at: null,
          metadata: restoredMetadata
        }, { transaction });
        const archivedItems = await StrategicActionItem.findAll({ where: { action_plan_id: actionPlan.id }, transaction });
        for (const archived of archivedItems.filter((item) => !item.custom_values?.legacy_duplicate_of)) {
          await archived.update({ deleted_at: null }, { transaction });
        }
        if (actionPlan.responsibility_id) {
          await StrategicResponsibility.update(
            { status: 'active', ends_on: null },
            { where: { id: actionPlan.responsibility_id }, transaction }
          );
        }
      }
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

      const periods = await StrategicMonitoringPeriod.findAll({
        where: { term_id: term.id },
        order: [['position', 'ASC']],
        transaction
      });

      const existingItems = await StrategicActionItem.findAll({
        where: { action_plan_id: actionPlan.id, deleted_at: null },
        order: [['created_at', 'ASC'], ['id', 'ASC']], transaction
      });
      const claimedItems = new Set();
      const schema = await captureActionPlanSchema(strategicPlan.id, transaction);

      for (const row of rows) {
        const itemCode = `LEGACY-${row.id}`;
        const matches = existingItems.filter((candidate) => !candidate.deleted_at && !claimedItems.has(candidate.id)
          && sameLegacyActivity(candidate, row));
        // Never combine two explicitly different schedules, even if a new Excel omitted dates.
        const canonical = matches[0];
        const compatibleMatches = [];
        for (const candidate of matches) {
          if (compatibleMatches.every((previous) => sameLegacyActivity(candidate, {
            actividad: previous.activity, indicador: previous.indicator,
            fecha_inicio: previous.starts_on, fecha_fin: previous.ends_on, meta: previous.target
          }))) compatibleMatches.push(candidate);
        }
        let item = canonical || existingItems.find((candidate) => candidate.code === itemCode && !claimedItems.has(candidate.id));
        let created = false;
        if (!item) [item, created] = await StrategicActionItem.findOrCreate({
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
        for (const duplicate of compatibleMatches.filter((candidate) => candidate.id !== item.id)) {
          await consolidateLegacyItem(item, duplicate, transaction);
        }
        claimedItems.add(item.id);
        const sourceCustom = schemaLegacyValues([...(actionPlan.metadata?.form_schema?.fields || []), ...schema.fields], {
          strategic_objective: row.objetivo_estrategico, strategic_guideline: row.lineamiento_estrategico,
          macroactivity: row.macroactividad, responsible: row.responsable, co_responsible: row.corresponsable,
          activity: row.actividad, indicator: row.indicador, target: row.meta,
          indicator_type: row.tipo_indicador, starts_on: row.fecha_inicio, ends_on: row.fecha_fin,
          progress_s1: row.avance_ip, progress_s2: row.avance_iip,
          observations_s1: row.observaciones_ip, observations_s2: row.observaciones_iip,
          total_progress: row.total_ejecucion
        });
        const custom = fillMissing(item.custom_values || {}, sourceCustom);
        custom.legacy_plan_accion_id = row.id;
        const repaired = fillMissing({ indicator_type: item.indicator_type, starts_on: item.starts_on,
          ends_on: item.ends_on, target: item.target }, {
          indicator_type: row.tipo_indicador, starts_on: row.fecha_inicio, ends_on: row.fecha_fin, target: row.meta
        });
        if (JSON.stringify(custom) !== JSON.stringify(item.custom_values)
          || Object.keys(repaired).some((key) => repaired[key] !== item[key])) {
          await item.update({ ...repaired, custom_values: custom }, { transaction });
        }

        if (periods.length && item) {
          if (periods[0] && row.avance_ip !== null && row.avance_ip !== undefined && row.avance_ip !== '') {
            const p1 = Number(row.avance_ip);
            await StrategicMonitoringResult.findOrCreate({
              where: { action_item_id: item.id, monitoring_period_id: periods[0].id },
              defaults: {
                action_item_id: item.id,
                monitoring_period_id: periods[0].id,
                physical_progress: p1 > 0 && p1 <= 1 ? p1 * 100 : p1,
                observations: row.observaciones_ip ? String(row.observaciones_ip) : null,
                status: 'imported',
                created_by: creator?.id || owner?.id || fallbackUser.id
              },
              transaction
            });
          }
          if (periods[1] && row.avance_iip !== null && row.avance_iip !== undefined && row.avance_iip !== '') {
            const p2 = Number(row.avance_iip);
            await StrategicMonitoringResult.findOrCreate({
              where: { action_item_id: item.id, monitoring_period_id: periods[1].id },
              defaults: {
                action_item_id: item.id,
                monitoring_period_id: periods[1].id,
                physical_progress: p2 > 0 && p2 <= 1 ? p2 * 100 : p2,
                observations: row.observaciones_iip ? String(row.observaciones_iip) : null,
                status: 'imported',
                created_by: creator?.id || owner?.id || fallbackUser.id
              },
              transaction
            });
          }
        }
      }

      // Desactivar actividades legacy huérfanas que ya no existen en la nueva plantilla importada
      for (const stale of existingItems) {
        if (!claimedItems.has(stale.id) && /^LEGACY-\d+$/.test(stale.code || '')) {
          await stale.update({
            deleted_at: new Date(),
            custom_values: { ...(stale.custom_values || {}), legacy_orphaned_at: new Date().toISOString() }
          }, { transaction });
        }
      }
    });
  }
  try {
    await syncMissingPlanLeaders();
  } catch (errSync) {
    console.warn('[legacy-reconcile] Warning sincronizando líderes faltantes:', errSync.message);
  }
  return { plans: migratedPlans, items: migratedItems };
};

const syncMissingPlanLeaders = async ({ transaction = null } = {}) => {
  const plansWithoutLeader = await StrategicActionPlan.findAll({
    where: { deleted_at: null, responsible_user_id: null },
    include: [
      { model: StrategicTerm, as: 'term', required: true },
      { model: StrategicCatalogItem, as: 'organizationalUnit', required: true }
    ],
    transaction
  });

  if (!plansWithoutLeader.length) return 0;

  const allTerms = await StrategicTerm.findAll({
    order: [['year', 'DESC']],
    raw: true,
    transaction
  });

  let syncedCount = 0;
  for (const plan of plansWithoutLeader) {
    const unit = plan.organizationalUnit;
    const currentYear = Number(plan.term?.year || 0);
    const priorTermIds = allTerms.filter((t) => Number(t.year) < currentYear).map((t) => t.id);

    let leaderUser = null;

    // 1. Buscar en vigencias anteriores para la misma unidad
    if (priorTermIds.length > 0) {
      const priorResp = await StrategicResponsibility.findOne({
        where: {
          term_id: { [Op.in]: priorTermIds },
          catalog_item_id: plan.catalog_item_id,
          status: 'active'
        },
        include: [{ model: User, as: 'responsibleUser', where: { estado: 'activo' } }],
        order: [['created_at', 'DESC']],
        transaction
      });
      if (priorResp?.responsibleUser) {
        leaderUser = priorResp.responsibleUser;
      }
    }

    // 2. Si no se encontró, buscar por coincidencia de código o nombre de unidad en vigencias anteriores
    if (!leaderUser && unit && priorTermIds.length > 0) {
      const similarUnits = await StrategicCatalogItem.findAll({
        where: {
          [Op.or]: [
            { code: unit.code },
            { name: unit.name }
          ]
        },
        attributes: ['id'],
        raw: true,
        transaction
      });
      const similarUnitIds = similarUnits.map((u) => u.id);
      if (similarUnitIds.length > 0) {
        const priorRespByName = await StrategicResponsibility.findOne({
          where: {
            term_id: { [Op.in]: priorTermIds },
            catalog_item_id: { [Op.in]: similarUnitIds },
            status: 'active'
          },
          include: [{ model: User, as: 'responsibleUser', where: { estado: 'activo' } }],
          order: [['created_at', 'DESC']],
          transaction
        });
        if (priorRespByName?.responsibleUser) {
          leaderUser = priorRespByName.responsibleUser;
        }
      }
    }

    // 3. Buscar en User por dependencia
    if (!leaderUser && unit?.name) {
      const cleanName = unit.name.replace(/^(Area|Oficina|Departamento|Direccion|Facultad)\s+de\s+/i, '').trim();
      leaderUser = await User.findOne({
        where: {
          [Op.or]: [
            { dependencia: { [Op.iLike]: `%${unit.name}%` } },
            { dependencia: { [Op.iLike]: `%${cleanName}%` } }
          ],
          estado: 'activo'
        },
        order: [['updated_at', 'DESC']],
        transaction
      });
    }

    if (leaderUser) {
      await plan.update({ responsible_user_id: leaderUser.id }, { transaction });

      const [actionResp] = await StrategicResponsibility.findOrCreate({
        where: {
          term_id: plan.term_id,
          catalog_item_id: plan.catalog_item_id,
          action_plan_id: plan.id,
          responsibility_type: 'action_plan_leader',
          status: 'active'
        },
        defaults: {
          user_id: leaderUser.id,
          starts_on: plan.term?.starts_on,
          ends_on: plan.term?.ends_on,
          created_by: plan.created_by || leaderUser.id
        },
        transaction
      });
      if (actionResp && !plan.responsibility_id) {
        await plan.update({ responsibility_id: actionResp.id }, { transaction });
      }

      await StrategicResponsibility.findOrCreate({
        where: {
          term_id: plan.term_id,
          catalog_item_id: plan.catalog_item_id,
          action_plan_id: null,
          responsibility_type: 'reference_leader',
          status: 'active'
        },
        defaults: {
          user_id: leaderUser.id,
          starts_on: plan.term?.starts_on,
          ends_on: plan.term?.ends_on,
          created_by: plan.created_by || leaderUser.id
        },
        transaction
      });

      syncedCount += 1;
    }
  }

  return syncedCount;
};

const legacyReconciliationPromises = new Map();
const reconcileLegacyActionPlans = async ({ planCode = null } = {}) => {
  const key = planCode || 'all';
  if (!legacyReconciliationPromises.has(key)) {
    legacyReconciliationPromises.set(key, performLegacyReconciliation({ planCode }).finally(() => {
      legacyReconciliationPromises.delete(key);
    }));
  }
  return legacyReconciliationPromises.get(key);
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

module.exports = { mapLegacyStatus, legacyPlanCode, reconcileLegacyActionPlans, ensureAnnualDependenciesForActionPlans, syncMissingPlanLeaders };
