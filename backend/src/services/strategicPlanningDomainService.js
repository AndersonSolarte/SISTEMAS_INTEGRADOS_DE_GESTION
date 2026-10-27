const crypto = require('crypto');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  StrategicPlan,
  StrategicTerm,
  StrategicCatalogItem,
  User,
  StrategicActionPlan,
  StrategicActionItem,
  StrategicActionItemVersion,
  StrategicWorkflowEvent,
  StrategicAuditEvent,
  StrategicMonitoringResult
} = require('../models');
const { DEFAULT_WORKFLOW } = require('./strategicPlanningBootstrap');
const { reconcileLegacyActionPlans } = require('./strategicLegacyActionPlanService');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const cleanCode = (value, fallback = 'SIN-CODIGO') => String(value || fallback)
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || fallback;

const requestMeta = (req) => ({
  actor_user_id: req.user?.id || null,
  ip_address: String(req.ip || req.socket?.remoteAddress || '').slice(0, 80),
  session_id: String(req.headers?.['x-session-id'] || '').slice(0, 160)
});

const audit = async (req, action, entityType, entityId, previousValue, newValue, justification, transaction) => (
  StrategicAuditEvent.create({
    ...requestMeta(req), action, entity_type: entityType, entity_id: String(entityId),
    previous_value: previousValue || null, new_value: newValue || null,
    justification: justification || null
  }, { transaction })
);

const getWorkflow = (plan) => {
  const configured = plan?.settings?.workflow;
  if (!configured?.states?.length || !configured?.transitions?.length) {
    return DEFAULT_WORKFLOW;
  }
  const configuredTransitions = Array.isArray(configured.transitions) ? [...configured.transitions] : [];
  for (const defT of DEFAULT_WORKFLOW.transitions) {
    if (!configuredTransitions.some((t) => t.action === defT.action && t.from === defT.from)) {
      configuredTransitions.push(defT);
    }
  }
  return {
    ...configured,
    states: Array.isArray(configured.states) && configured.states.length ? configured.states : DEFAULT_WORKFLOW.states,
    transitions: configuredTransitions
  };
};

const transitionPlan = async ({ req, actionPlan, action, comment = '', metadata = {} }) => {
  const term = await StrategicTerm.findByPk(actionPlan.term_id, { include: [{ model: StrategicPlan, as: 'strategicPlan' }] });
  const workflow = getWorkflow(term?.strategicPlan);
  const transition = workflow.transitions.find((item) => item.action === action && item.from === actionPlan.status);
  if (!transition) {
    const err = new Error(`La acción ${action} no está permitida desde ${actionPlan.status}.`);
    err.statusCode = 409;
    throw err;
  }

  await sequelize.transaction(async (transaction) => {
    const previous = actionPlan.toJSON();
    const currentMeta = { ...(actionPlan.metadata || {}), ...metadata };
    if (action === 'request_owner_adjustments') {
      const adjustmentEntry = {
        comment: String(comment || '').trim(),
        requested_by: req.user.id,
        requested_by_name: req.user.nombre || req.user.username || 'Líder de Dependencia',
        requested_by_email: req.user.email || null,
        requested_at: new Date().toISOString()
      };
      currentMeta.last_adjustment_request = adjustmentEntry;
      currentMeta.adjustments_history = [
        ...(Array.isArray(currentMeta.adjustments_history) ? currentMeta.adjustments_history : []),
        adjustmentEntry
      ];
    } else if (action === 'submit_owner_validation') {
      const responseEntry = {
        comment: String(comment || 'Se ajustó para su revisión.').trim(),
        responded_by: req.user.id,
        responded_by_name: req.user.nombre || req.user.username || 'Planeación y Efectividad',
        responded_at: new Date().toISOString()
      };
      currentMeta.last_planning_response = responseEntry;
      currentMeta.planning_responses_history = [
        ...(Array.isArray(currentMeta.planning_responses_history) ? currentMeta.planning_responses_history : []),
        responseEntry
      ];
    }

    await actionPlan.update({
      status: transition.to,
      metadata: currentMeta,
      updated_by: req.user.id,
      activated_at: transition.to === 'active' ? new Date() : actionPlan.activated_at,
      closed_at: transition.to === 'closed' ? new Date() : actionPlan.closed_at
    }, { transaction });
    await StrategicWorkflowEvent.create({
      action_plan_id: actionPlan.id, from_state: transition.from, to_state: transition.to,
      action, comment: comment || null, metadata: currentMeta, performed_by: req.user.id,
      ip_address: requestMeta(req).ip_address, session_id: requestMeta(req).session_id
    }, { transaction });
    await audit(req, 'workflow.transition', 'action_plan', actionPlan.id, previous, actionPlan.toJSON(), comment, transaction);
  });
  return actionPlan;
};

const saveActionItem = async ({ req, actionPlan, payload, item = null }) => sequelize.transaction(async (transaction) => {
  const previous = item?.toJSON() || null;
  const code = cleanCode(payload.code || item?.code || `ACT-${Date.now()}`);
  const incomingCustomValues = payload.custom_values
    && typeof payload.custom_values === 'object'
    && !Array.isArray(payload.custom_values)
    ? payload.custom_values
    : {};
  // Los campos configurables viven en JSONB. En una edición se combinan con los
  // valores persistidos para que una solicitud parcial nunca elimine claves
  // históricas que no venían incluidas en el formulario o integración.
  const preservedCustomValues = item?.custom_values
    && typeof item.custom_values === 'object'
    && !Array.isArray(item.custom_values)
    ? item.custom_values
    : {};
  const values = {
    action_plan_id: actionPlan.id,
    strategic_element_id: payload.strategic_element_id || null,
    code,
    activity: String(payload.activity || '').trim(),
    indicator_type: payload.indicator_type || null,
    indicator: payload.indicator || null,
    target: payload.target || null,
    starts_on: payload.starts_on || null,
    ends_on: payload.ends_on || null,
    responsible_catalog_item_id: payload.responsible_catalog_item_id || null,
    co_responsibles: Array.isArray(payload.co_responsibles) ? payload.co_responsibles : [],
    custom_values: { ...preservedCustomValues, ...incomingCustomValues },
    updated_by: req.user.id
  };
  if (!values.activity) {
    const firstCustomVal = Object.values(values.custom_values || {}).find((val) => String(val || '').trim().length > 0);
    if (firstCustomVal) {
      values.activity = String(firstCustomVal).trim();
    } else {
      const err = new Error('La actividad es obligatoria.'); err.statusCode = 422; throw err;
    }
  }
  if (item) {
    await StrategicActionItemVersion.create({
      action_item_id: item.id, version: item.version, snapshot: previous,
      justification: payload.justification || null, meeting_id: payload.meeting_id || null, created_by: req.user.id
    }, { transaction });
    values.version = Number(item.version || 1) + 1;
    await item.update(values, { transaction });
  } else {
    item = await StrategicActionItem.create({ ...values, created_by: req.user.id }, { transaction });
  }
  await audit(req, item.version > 1 ? 'action_item.update' : 'action_item.create', 'action_item', item.id, previous, item.toJSON(), payload.justification, transaction);
  return item;
});

const upsertMonitoring = async ({ req, actionItem, periodId, payload }) => sequelize.transaction(async (transaction) => {
  const [result, created] = await StrategicMonitoringResult.findOrCreate({
    where: { action_item_id: actionItem.id, monitoring_period_id: periodId },
    defaults: { action_item_id: actionItem.id, monitoring_period_id: periodId, created_by: req.user.id },
    transaction
  });
  const previous = created ? null : result.toJSON();
  const isPlanningStaff = ['administrador', 'planeacion_estrategica', 'planeacion_efectividad'].includes(req.user?.role);
  const progress = isPlanningStaff && payload.physical_progress !== undefined && payload.physical_progress !== ''
    ? Math.max(0, Math.min(999, Number(payload.physical_progress || 0)))
    : Number(result.physical_progress || 0);
  await result.update({
    physical_progress: progress,
    achieved_value: payload.achieved_value || null,
    observations: payload.observations || null,
    traffic_light: isPlanningStaff ? (payload.traffic_light || result.traffic_light) : result.traffic_light,
    status: isPlanningStaff && payload.status ? payload.status : (result.status === 'approved' ? 'approved' : 'submitted'),
    version: created ? 1 : Number(result.version || 1) + 1,
    updated_by: req.user.id
  }, { transaction });
  const rows = await StrategicMonitoringResult.findAll({ where: { action_item_id: actionItem.id, deleted_at: null }, transaction });
  const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.physical_progress || 0), 0) / rows.length : 0;
  await actionItem.update({ current_progress: average, updated_by: req.user.id }, { transaction });
  await audit(req, 'monitoring.upsert', 'monitoring_result', result.id, previous, result.toJSON(), payload.justification, transaction);
  return result;
});

const findActionPlans = async ({ year, termId, status, catalogItemId, includeItems = false, reconcileLegacy = false } = {}) => {
  if (reconcileLegacy) {
    await reconcileLegacyActionPlans();
  }
  const termWhere = {};
  if (year) termWhere.year = Number(year);
  const where = { deleted_at: null };
  if (termId) where.term_id = termId;
  if (status) where.status = status;
  if (catalogItemId) where.catalog_item_id = catalogItemId;

  const includes = [
    { model: StrategicTerm, as: 'term', where: termWhere, include: [{ model: StrategicPlan, as: 'strategicPlan' }] },
    { model: StrategicCatalogItem, as: 'organizationalUnit' },
    { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo'], required: false }
  ];

  if (includeItems) {
    includes.push({ model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false });
  }

  return StrategicActionPlan.findAll({
    where,
    include: includes,
    order: [['created_at', 'DESC']]
  });
};

module.exports = { sha256, cleanCode, requestMeta, audit, getWorkflow, transitionPlan, saveActionItem, upsertMonitoring, findActionPlans };
