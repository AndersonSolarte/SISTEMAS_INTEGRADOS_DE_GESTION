const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User, PlanAccion, StrategicPlan, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicActionPlan, StrategicActionItem,
  StrategicMonitoringPeriod, StrategicMonitoringResult, StrategicEvidence, StrategicBudgetMovement
} = require('../models');
const { captureActionPlanSchema } = require('./strategicActionPlanSchemaService');
const { sameLegacyActivity, fillMissing, schemaLegacyValues, isLegacyItem } = require('./legacyActionIdentity');
const { historicalYear, chooseLegacyUnit, sourceScope, scopeFromPlanCode, dependencyCode, preferredLegacyUnitIds } = require('./legacyActionScope');

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
  const matching = candidates.filter((plan) => legacyPed && [normalize(plan.code), normalize(plan.name)]
    .some((value) => value.length > 5 && (value.includes(legacyPed) || legacyPed.includes(value))));
  if (matching.length !== 1) throw new Error(`No se puede identificar de forma única el PED histórico de ${legacy.anio}.`);
  return matching[0];
};

const findOrCreateUnit = async ({ plan, term, dependency, transaction }) => {
  const dependencyName = String(dependency || 'Dependencia histórica sin identificar').replace(/^([A-Z]\d+)\s*[_-]\s*/i, '').trim();
  const prefix = String(dependency || '').match(/^([A-Z]\d+)\s*[_-]/i)?.[1]?.toUpperCase();
  const units = await StrategicCatalogItem.findAll({
    where: { strategic_plan_id: plan.id, catalog_type: { [Op.in]: ['dependency', 'organizational_unit'] } }, transaction
  });
  const scopedPlans = await StrategicActionPlan.findAll({
    where: { term_id: term.id, deleted_at: null }, attributes: ['code', 'catalog_item_id', 'term_id', 'metadata'], transaction
  });
  const preferredIds = preferredLegacyUnitIds(scopedPlans, term, dependency);
  const existing = chooseLegacyUnit(units, dependency, preferredIds);
  if (existing) {
    if (!dependencyCode(existing.code) && !existing.metadata?.legacy_dependency_code) {
      await existing.update({ metadata: { ...(existing.metadata || {}), legacy_dependency_code: dependencyCode(dependency) } }, { transaction });
    }
    return existing;
  }
  let unitCode = `LEG-${code(prefix || dependencyName, 'DEPENDENCIA')}`.slice(0, 60);
  let sequence = 2;
  while (units.some((unit) => unit.code === unitCode)) {
    unitCode = `${`LEG-${code(prefix || dependencyName, 'DEPENDENCIA')}`.slice(0, 56)}-${sequence}`;
    sequence += 1;
  }
  return StrategicCatalogItem.create({
    strategic_plan_id: plan.id, catalog_type: 'organizational_unit', code: unitCode,
    name: dependencyName, metadata: { legacy_source: 'plan_accion', legacy_dependency_code: dependencyCode(dependency) }, active: true
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
      anio: { [Op.between]: [2022, 2026] },
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
    if (!historicalYear(row.anio)) return;
    const key = sourceScope(row);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  let migratedPlans = 0; let migratedItems = 0;

  for (const rows of groups.values()) {
    const first = rows[0];
    const legacyCode = legacyPlanCode(first);
    if (planCode && !rows.some((row) => legacyPlanCode(row) === planCode)
      && scopeFromPlanCode(planCode) !== sourceScope(first)) continue;
    const strategicPlan = choosePlan(plans, first);
    const term = strategicPlan?.terms.find((item) => Number(item.year) === Number(first.anio));
    if (!strategicPlan || !term) continue;
    const owner = first.responsable_id ? await User.findByPk(first.responsable_id) : null;
    const creator = first.creado_por ? await User.findByPk(first.creado_por) : null;

    await sequelize.transaction(async (transaction) => {
      // Serialize bridge runs across workers as well as within this Node process.
      await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', {
        replacements: { key: `legacy-action-plan:${sourceScope(first)}` }, transaction
      });
      const unit = await findOrCreateUnit({ plan: strategicPlan, term, dependency: first.responsable, transaction });

      // Priorizar el plan oficial existente para esta unidad y vigencia (evita duplicar planes con Paso 3)
      let actionPlan = await StrategicActionPlan.findOne({
        where: {
          term_id: term.id,
          catalog_item_id: unit.id,
          deleted_at: null
        },
        order: [[sequelize.literal("CASE WHEN code LIKE 'LEGACY-%' THEN 1 ELSE 0 END"), 'ASC'], ['created_at', 'ASC']],
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
      // A legacy code previously attached to the wrong catalog is not a valid target.
      if (actionPlan && (actionPlan.term_id !== term.id || actionPlan.catalog_item_id !== unit.id)) {
        await actionPlan.update({ catalog_item_id: unit.id, term_id: term.id, responsible_user_id: null, responsibility_id: null,
          title: `Plan de Acción ${unit.name} ${term.year}`,
          metadata: { ...(actionPlan.metadata || {}), legacy_scope_repaired_at: new Date().toISOString() }
        }, { transaction });
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

      if (actionPlan.metadata?.legacy_dependency_scope !== sourceScope(first)) {
        await actionPlan.update({ metadata: { ...(actionPlan.metadata || {}), legacy_dependency_scope: sourceScope(first) } }, { transaction });
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

      // Recover rows that an earlier fuzzy unit match placed in another plan.
      // Moving the activity ID retains its evidence, versions and monitoring links.
      const misplaced = await StrategicActionItem.findAll({
        where: { deleted_at: null, action_plan_id: { [Op.ne]: actionPlan.id } },
        include: [{ model: StrategicActionPlan, as: 'actionPlan', required: true,
          where: { term_id: term.id, deleted_at: null }, attributes: ['id', 'term_id'] }], transaction
      });
      for (const candidate of misplaced) {
        if (!candidate.actionPlan || candidate.action_plan_id === actionPlan.id
          || sourceScope({ anio: first.anio, responsable: candidate.custom_values?.responsible }) !== sourceScope(first)
          || !rows.some((row) => sameLegacyActivity(candidate, row))) continue;
        const collision = await StrategicActionItem.findOne({
          where: { action_plan_id: actionPlan.id, code: candidate.code }, transaction
        });
        await candidate.update({ action_plan_id: actionPlan.id,
          ...(collision ? { code: `LEGACY-MOVED-${candidate.id}` } : {}),
          custom_values: { ...(candidate.custom_values || {}), legacy_previous_plan_id: candidate.action_plan_id }
        }, { transaction });
      }

      const historicalItems = await StrategicActionItem.findAll({
        where: { action_plan_id: actionPlan.id },
        order: [['created_at', 'ASC'], ['id', 'ASC']], transaction
      });
      const existingItems = historicalItems.filter((item) => !item.deleted_at);
      const claimedItems = new Set();
      const schema = await captureActionPlanSchema(strategicPlan.id, transaction);

      for (const [rowIndex, row] of rows.entries()) {
        const itemCode = `LEGACY-${row.id}`;
        const matches = existingItems.filter((candidate) => !candidate.deleted_at && !claimedItems.has(candidate.id)
          && sameLegacyActivity(candidate, row));
        // Never combine two explicitly different schedules, even if a new Excel omitted dates.
        matches.sort((a, b) => Number(b.custom_values?.legacy_plan_accion_id === row.id) - Number(a.custom_values?.legacy_plan_accion_id === row.id));
        const canonical = matches[0];
        const compatibleMatches = [];
        for (const candidate of matches) {
          if (compatibleMatches.every((previous) => sameLegacyActivity(candidate, {
            anio: row.anio, responsable: row.responsable,
            actividad: previous.activity, indicador: previous.indicator,
            fecha_inicio: previous.starts_on, fecha_fin: previous.ends_on, meta: previous.target
          }))) compatibleMatches.push(candidate);
        }
        let item = canonical || existingItems.find((candidate) => (candidate.code === itemCode
          || (isLegacyItem(candidate) && Number(candidate.custom_values?.legacy_plan_accion_id) === Number(row.id))) && !claimedItems.has(candidate.id));
        item = item || historicalItems.find((candidate) => candidate.deleted_at && candidate.status === 'deleted' && sameLegacyActivity(candidate, row))
          || historicalItems.find((candidate) => candidate.deleted_at && isLegacyItem(candidate) && Number(candidate.custom_values?.legacy_plan_accion_id) === Number(row.id));
        if (item?.deleted_at && item.status === 'deleted') { claimedItems.add(item.id); continue; }
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
        // Repeated source rows may be individual deliverables. Reserve one slot
        // per remaining source row instead of treating them as reimport copies.
        const reserved = rows.slice(rowIndex + 1).filter((next) => sameLegacyActivity(item, next)).length;
        const surplus = compatibleMatches.filter((candidate) => candidate.id !== item.id);
        for (const duplicate of surplus.slice(0, Math.max(0, surplus.length - reserved))) {
          await consolidateLegacyItem(item, duplicate, transaction);
        }
        if (item.deleted_at && item.status !== 'deleted') {
          const restored = { ...(item.custom_values || {}) };
          delete restored.legacy_duplicate_of;
          delete restored.legacy_orphaned_at;
          await item.update({ deleted_at: null, custom_values: restored }, { transaction });
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
        const sourceText = {};
        const { ACTIVITY_CODE, codedValues } = require('./actionItemCodingService');
        const sourceIndicator = ACTIVITY_CODE.test(item.code || '')
          ? codedValues({ indicator: row.indicador, indicator_type: item.indicator_type }, item.code).indicator : row.indicador;
        if (sameLegacyActivity(item, row) && (item.activity !== row.actividad || item.indicator !== sourceIndicator)) {
          custom.legacy_text_before_normalization = custom.legacy_text_before_normalization || {
            activity: item.activity, indicator: item.indicator
          };
          sourceText.activity = row.actividad;
          sourceText.indicator = sourceIndicator;
          custom.activity = row.actividad;
          custom.indicator = sourceIndicator;
        }
        const repaired = fillMissing({ indicator_type: item.indicator_type, starts_on: item.starts_on,
          ends_on: item.ends_on, target: item.target }, {
          indicator_type: row.tipo_indicador, starts_on: row.fecha_inicio, ends_on: row.fecha_fin, target: row.meta
        });
        if (JSON.stringify(custom) !== JSON.stringify(item.custom_values)
          || Object.keys(repaired).some((key) => repaired[key] !== item[key])) {
          await item.update({ ...repaired, ...sourceText, custom_values: custom }, { transaction });
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
        if (!stale.deleted_at && !claimedItems.has(stale.id) && isLegacyItem(stale)
          && sourceScope({ anio: first.anio, responsable: stale.custom_values?.responsible }) === sourceScope(first)) {
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
  const plans = await StrategicActionPlan.findAll({ where: { deleted_at: null }, transaction });
  let synced = 0;
  for (const plan of plans) {
    const assignments = await StrategicResponsibility.findAll({
      where: { term_id: plan.term_id, catalog_item_id: plan.catalog_item_id, status: 'active',
        [Op.or]: [
          { action_plan_id: plan.id, responsibility_type: 'action_plan_leader' },
          { action_plan_id: null, responsibility_type: 'reference_leader' }
        ] },
      include: [{ model: User, as: 'responsibleUser', where: { estado: 'activo' }, required: true }],
      order: [['updated_at', 'DESC'], ['id', 'ASC']], transaction
    });
    const specific = assignments.filter((row) => row.action_plan_id === plan.id);
    const candidates = specific.length ? specific : assignments.filter((row) => !row.action_plan_id);
    if (!candidates.length || new Set(candidates.map((row) => row.user_id)).size !== 1) continue;
    let assignment = candidates[0];
    if (!assignment.action_plan_id) {
      [assignment] = await StrategicResponsibility.findOrCreate({
        where: { term_id: plan.term_id, catalog_item_id: plan.catalog_item_id, action_plan_id: plan.id,
          responsibility_type: 'action_plan_leader', status: 'active' },
        defaults: { user_id: assignment.user_id, starts_on: assignment.starts_on, ends_on: assignment.ends_on,
          created_by: plan.created_by || assignment.user_id }, transaction
      });
    }
    if (plan.responsible_user_id !== assignment.user_id || plan.responsibility_id !== assignment.id) {
      await plan.update({ responsible_user_id: assignment.user_id, responsibility_id: assignment.id }, { transaction });
      synced++;
    }
  }
  return synced;
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
