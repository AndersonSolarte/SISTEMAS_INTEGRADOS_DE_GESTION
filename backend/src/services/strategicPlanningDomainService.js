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
  return configured?.states?.length && configured?.transitions?.length ? configured : DEFAULT_WORKFLOW;
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
    await actionPlan.update({
      status: transition.to,
      updated_by: req.user.id,
      activated_at: transition.to === 'active' ? new Date() : actionPlan.activated_at,
      closed_at: transition.to === 'closed' ? new Date() : actionPlan.closed_at
    }, { transaction });
    await StrategicWorkflowEvent.create({
      action_plan_id: actionPlan.id, from_state: transition.from, to_state: transition.to,
      action, comment: comment || null, metadata, performed_by: req.user.id,
      ip_address: requestMeta(req).ip_address, session_id: requestMeta(req).session_id
    }, { transaction });
    await audit(req, 'workflow.transition', 'action_plan', actionPlan.id, previous, actionPlan.toJSON(), comment, transaction);
  });
  return actionPlan;
};

const saveActionItem = async ({ req, actionPlan, payload, item = null }) => sequelize.transaction(async (transaction) => {
  const previous = item?.toJSON() || null;
  const code = cleanCode(payload.code || item?.code || `ACT-${Date.now()}`);
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
    custom_values: payload.custom_values && typeof payload.custom_values === 'object' ? payload.custom_values : {},
    updated_by: req.user.id
  };
  if (!values.activity) {
    const err = new Error('La actividad es obligatoria.'); err.statusCode = 422; throw err;
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
  const progress = Math.max(0, Math.min(100, Number(payload.physical_progress || 0)));
  await result.update({
    physical_progress: progress,
    achieved_value: payload.achieved_value || null,
    observations: payload.observations || null,
    traffic_light: payload.traffic_light || null,
    status: payload.status || 'submitted',
    version: created ? 1 : Number(result.version || 1) + 1,
    updated_by: req.user.id
  }, { transaction });
  const rows = await StrategicMonitoringResult.findAll({ where: { action_item_id: actionItem.id, deleted_at: null }, transaction });
  const average = rows.length ? rows.reduce((sum, row) => sum + Number(row.physical_progress || 0), 0) / rows.length : 0;
  await actionItem.update({ current_progress: average, updated_by: req.user.id }, { transaction });
  await audit(req, 'monitoring.upsert', 'monitoring_result', result.id, previous, result.toJSON(), payload.justification, transaction);
  return result;
});

const findActionPlans = async ({ year, termId, status, catalogItemId } = {}) => {
  const termWhere = {};
  if (year) termWhere.year = Number(year);
  const where = { deleted_at: null };
  if (termId) where.term_id = termId;
  if (status) where.status = status;
  if (catalogItemId) where.catalog_item_id = catalogItemId;
  return StrategicActionPlan.findAll({
    where,
    include: [
      { model: StrategicTerm, as: 'term', where: termWhere, include: [{ model: StrategicPlan, as: 'strategicPlan' }] },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo'], required: false },
      { model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false }
    ],
    order: [['created_at', 'DESC']]
  });
};

module.exports = { sha256, cleanCode, requestMeta, audit, getWorkflow, transitionPlan, saveActionItem, upsertMonitoring, findActionPlans };
