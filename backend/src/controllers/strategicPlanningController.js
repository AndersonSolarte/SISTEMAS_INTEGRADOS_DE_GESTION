const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  StrategicPlan, StrategicLevel, StrategicElement, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicFieldDefinition, StrategicMonitoringPeriod,
  StrategicActionPlan, StrategicActionItem, StrategicActionItemVersion, StrategicWorkflowEvent,
  StrategicMeeting, StrategicMeetingParticipant, StrategicMinuteVersion, StrategicMinuteProposal,
  StrategicMinuteSignature, StrategicUserSignature, StrategicMonitoringResult, StrategicEvidence,
  StrategicSyncJob, StrategicBudgetImport, StrategicBudgetMovement, StrategicHistoricalImport,
  StrategicAuditEvent, User
} = require('../models');
const { generateActaBuffer } = require('../services/actaExportService');
const { generateStrategicMinutePdf } = require('../services/strategicMinutePdfService');
const { generatePlanAccionBuffer } = require('../services/planAccionExportService');
const { sendInstitutionalEmail } = require('../services/emailService');
const { ensureStrategicPlanningDefaults, DEFAULT_WORKFLOW, DEFAULT_PLAN_CODE, DEFAULT_FIELDS } = require('../services/strategicPlanningBootstrap');
const { sha256, cleanCode, audit, transitionPlan, saveActionItem, upsertMonitoring, findActionPlans } = require('../services/strategicPlanningDomainService');
const { enqueueSync, reconcileTerm } = require('../services/strategicPlanningDriveService');
const { previewReferenceImport, confirmReferenceImport } = require('../services/strategicReferenceService');

// La carpeta .private vive dentro del volumen respaldado de uploads, pero Express
// no publica directorios con punto. Todo acceso se hace mediante endpoints con auth.
const PRIVATE_ROOT = path.resolve(process.env.SIAC_PEI_TEMP_DIR || path.join(__dirname, '../../uploads/.private/strategic-planning'));
const SIGNATURE_ROOT = path.join(PRIVATE_ROOT, '_signatures');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const ok = (res, data, message = '') => res.json({ success: true, message, data });
const fail = (res, error) => res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Error interno' });
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (error) { console.error('PEI:', error); fail(res, error); } };
const hashObject = (value) => sha256(Buffer.from(JSON.stringify(value)));
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const parseDataUrl = (value) => {
  const match = String(value || '').match(/^data:image\/(png|jpeg);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error('La firma debe enviarse como imagen PNG o JPEG.'), { statusCode: 422 });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('La firma no puede superar 2 MB.'), { statusCode: 413 });
  return { buffer, extension: match[1] === 'jpeg' ? 'jpg' : 'png' };
};

const planIncludes = [
  { model: StrategicLevel, as: 'levels', where: { active: true }, required: false, separate: true, order: [['position', 'ASC']] },
  { model: StrategicTerm, as: 'terms', separate: true, order: [['year', 'ASC']], include: [{ model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }] },
  { model: StrategicCatalogItem, as: 'catalogItems', separate: true, order: [['catalog_type', 'ASC'], ['name', 'ASC']] },
  { model: StrategicFieldDefinition, as: 'fieldDefinitions', where: { active: true }, required: false, separate: true, order: [['position', 'ASC']] }
];

const bootstrap = wrap(async (_req, res) => {
  const plan = await ensureStrategicPlanningDefaults();
  const full = await StrategicPlan.findByPk(plan.id, { include: planIncludes });
  ok(res, { plan: full, workflow: full.settings?.workflow || DEFAULT_WORKFLOW });
});

const listPlans = wrap(async (_req, res) => ok(res, await StrategicPlan.findAll({ where: { deleted_at: null }, include: planIncludes, order: [['starts_on', 'DESC']] })));

const createPlan = wrap(async (req, res) => {
  const payload = req.body || {};
  if (!String(payload.code || '').trim() || !String(payload.name || '').trim() || !payload.starts_on || !payload.ends_on) {
    throw Object.assign(new Error('Código, nombre y fechas del PED son obligatorios.'), { statusCode: 422 });
  }
  if (String(payload.ends_on) < String(payload.starts_on)) {
    throw Object.assign(new Error('La fecha final del PED no puede ser anterior a la fecha inicial.'), { statusCode: 422 });
  }
  const created = await StrategicPlan.create({
    code: cleanCode(payload.code), name: payload.name, description: payload.description || null,
    starts_on: payload.starts_on, ends_on: payload.ends_on, status: payload.status || 'draft',
    approval_document: payload.approval_document || null,
    administrative_act: payload.administrative_act || null,
    approved_on: payload.approved_on || null,
    global_budget: payload.global_budget || null,
    responsible_user_id: payload.responsible_user_id || null, settings: { workflow: payload.workflow || DEFAULT_WORKFLOW, ...(payload.settings || {}) },
    created_by: req.user.id, updated_by: req.user.id
  });
  await audit(req, 'strategic_plan.create', 'strategic_plan', created.id, null, created.toJSON());
  res.status(201); ok(res, created, 'PED creado.');
});

const updatePlan = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.id);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const previous = plan.toJSON();
  const allowed = ['code', 'name', 'description', 'starts_on', 'ends_on', 'status', 'approval_document', 'administrative_act', 'approved_on', 'global_budget', 'responsible_user_id', 'drive_root_id'];
  const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  if (changes.code) changes.code = cleanCode(changes.code);
  if (String(changes.ends_on || plan.ends_on) < String(changes.starts_on || plan.starts_on)) throw Object.assign(new Error('La fecha final no puede ser anterior a la inicial.'), { statusCode: 422 });
  if (req.body.settings) changes.settings = { ...(plan.settings || {}), ...req.body.settings };
  if (req.body.new_configuration_version) changes.configuration_version = Number(plan.configuration_version) + 1;
  changes.updated_by = req.user.id;
  await plan.update(changes);
  await audit(req, 'strategic_plan.update', 'strategic_plan', plan.id, previous, plan.toJSON(), req.body.justification);
  ok(res, plan, 'Configuración actualizada.');
});

const deletePlan = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.id);
  if (!plan || plan.deleted_at) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  if (plan.code === DEFAULT_PLAN_CODE) throw Object.assign(new Error('El PED institucional base no puede eliminarse; puede cerrarse y conservarse como histórico.'), { statusCode: 409 });
  if (plan.status === 'active') throw Object.assign(new Error('Primero cambie el PED activo a cerrado o histórico.'), { statusCode: 409 });
  const previous = plan.toJSON();
  await plan.update({ deleted_at: new Date(), status: 'deleted', updated_by: req.user.id });
  await audit(req, 'strategic_plan.delete', 'strategic_plan', plan.id, previous, plan.toJSON(), req.body?.justification || 'Eliminación lógica');
  ok(res, { id: plan.id }, 'PED eliminado de forma lógica; su historial permanece protegido.');
});

const createLevel = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const level = await StrategicLevel.create({ strategic_plan_id: plan.id, name: req.body.name, position: req.body.position, configuration_version: plan.configuration_version });
  await audit(req, 'structure_level.create', 'structure_level', level.id, null, level.toJSON());
  res.status(201); ok(res, level);
});

const updateLevel = wrap(async (req, res) => {
  const level = await StrategicLevel.findOne({ where: { id: req.params.levelId, strategic_plan_id: req.params.planId } });
  if (!level) throw Object.assign(new Error('Nivel no encontrado.'), { statusCode: 404 });
  const previous = level.toJSON();
  await level.update({ name: req.body.name ?? level.name, position: req.body.position ?? level.position, active: req.body.active ?? level.active });
  await audit(req, 'structure_level.update', 'structure_level', level.id, previous, level.toJSON(), req.body.justification);
  ok(res, level, 'Nivel actualizado.');
});

const deleteLevel = wrap(async (req, res) => {
  const level = await StrategicLevel.findOne({ where: { id: req.params.levelId, strategic_plan_id: req.params.planId } });
  if (!level) throw Object.assign(new Error('Nivel no encontrado.'), { statusCode: 404 });
  const elements = await StrategicElement.count({ where: { level_id: level.id, deleted_at: null } });
  if (elements) throw Object.assign(new Error('Elimine o traslade primero los elementos que pertenecen a este nivel.'), { statusCode: 409 });
  const previous = level.toJSON(); await level.update({ active: false });
  await audit(req, 'structure_level.delete', 'structure_level', level.id, previous, level.toJSON(), 'Eliminación lógica');
  ok(res, { id: level.id }, 'Nivel eliminado de forma lógica.');
});

const createElement = wrap(async (req, res) => {
  const element = await StrategicElement.create({
    strategic_plan_id: req.params.planId, level_id: req.body.level_id, parent_id: req.body.parent_id || null,
    code: cleanCode(req.body.code), name: req.body.name, description: req.body.description || null,
    position: Number(req.body.position || 0), created_by: req.user.id
  });
  await audit(req, 'strategic_element.create', 'strategic_element', element.id, null, element.toJSON());
  res.status(201); ok(res, element);
});

const updateElement = wrap(async (req, res) => {
  const element = await StrategicElement.findOne({ where: { id: req.params.elementId, strategic_plan_id: req.params.planId, deleted_at: null } });
  if (!element) throw Object.assign(new Error('Elemento no encontrado.'), { statusCode: 404 });
  const previous = element.toJSON();
  const allowed = ['level_id', 'parent_id', 'code', 'name', 'description', 'position', 'active'];
  const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  if (changes.code) changes.code = cleanCode(changes.code);
  await element.update(changes);
  await audit(req, 'strategic_element.update', 'strategic_element', element.id, previous, element.toJSON(), req.body.justification);
  ok(res, element, 'Elemento actualizado.');
});

const deleteElement = wrap(async (req, res) => {
  const element = await StrategicElement.findOne({ where: { id: req.params.elementId, strategic_plan_id: req.params.planId, deleted_at: null } });
  if (!element) throw Object.assign(new Error('Elemento no encontrado.'), { statusCode: 404 });
  const children = await StrategicElement.count({ where: { parent_id: element.id, deleted_at: null } });
  if (children) throw Object.assign(new Error('Elimine o traslade primero los elementos dependientes.'), { statusCode: 409 });
  const previous = element.toJSON(); await element.update({ deleted_at: new Date(), active: false });
  await audit(req, 'strategic_element.delete', 'strategic_element', element.id, previous, element.toJSON(), 'Eliminación lógica');
  ok(res, { id: element.id }, 'Elemento eliminado de forma lógica.');
});

const applyInstitutionalTemplate = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  await sequelize.transaction(async (transaction) => {
    for (const [position, name] of ['Objetivo Estratégico', 'Lineamiento Estratégico'].entries()) {
      await StrategicLevel.findOrCreate({ where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, position: position + 1 }, defaults: { strategic_plan_id: plan.id, name, position: position + 1, configuration_version: plan.configuration_version }, transaction });
    }
    for (const [position, [key, label, dataType, required]] of DEFAULT_FIELDS.entries()) {
      await StrategicFieldDefinition.findOrCreate({ where: { strategic_plan_id: plan.id, key, configuration_version: plan.configuration_version }, defaults: { strategic_plan_id: plan.id, key, label, data_type: dataType, required, position: position + 1, configuration_version: plan.configuration_version, validation_rules: dataType === 'percentage' ? { min: 0, max: 100 } : {}, formula: key === 'total_progress' ? 'progress_s1 + progress_s2' : null }, transaction });
    }
    await audit(req, 'instrument.template.apply', 'strategic_plan', plan.id, null, { template: 'DIR-PE-FR-003', version: 5 }, 'Aplicación de plantilla institucional', transaction);
  });
  const full = await StrategicPlan.findByPk(plan.id, { include: planIncludes });
  ok(res, full, 'Plantilla institucional DIR-PE-FR-003 versión 5 aplicada.');
});

const createFieldDefinition = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  if (!req.body.label || !req.body.key || !req.body.data_type) throw Object.assign(new Error('Nombre, código y tipo del campo son obligatorios.'), { statusCode: 422 });
  const field = await StrategicFieldDefinition.create({ strategic_plan_id: plan.id, key: cleanCode(req.body.key).toLowerCase().replace(/-/g, '_'), label: req.body.label, data_type: req.body.data_type, required: req.body.required === true, position: req.body.position || ((await StrategicFieldDefinition.max('position', { where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version } })) || 0) + 1, validation_rules: req.body.validation_rules || {}, options: req.body.options || [], formula: req.body.formula || null, configuration_version: plan.configuration_version, active: true });
  await audit(req, 'field.create', 'field_definition', field.id, null, field.toJSON());
  res.status(201); ok(res, field, 'Campo creado.');
});

const updateFieldDefinition = wrap(async (req, res) => {
  const field = await StrategicFieldDefinition.findOne({ where: { id: req.params.fieldId, strategic_plan_id: req.params.planId, active: true } });
  if (!field) throw Object.assign(new Error('Campo no encontrado.'), { statusCode: 404 });
  const previous = field.toJSON();
  const allowed = ['label', 'data_type', 'required', 'position', 'validation_rules', 'options', 'formula'];
  const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  await field.update(changes); await audit(req, 'field.update', 'field_definition', field.id, previous, field.toJSON(), req.body.justification);
  ok(res, field, 'Campo actualizado.');
});

const deleteFieldDefinition = wrap(async (req, res) => {
  const field = await StrategicFieldDefinition.findOne({ where: { id: req.params.fieldId, strategic_plan_id: req.params.planId, active: true } });
  if (!field) throw Object.assign(new Error('Campo no encontrado.'), { statusCode: 404 });
  const previous = field.toJSON(); await field.update({ active: false });
  await audit(req, 'field.delete', 'field_definition', field.id, previous, field.toJSON(), 'Eliminación lógica');
  ok(res, { id: field.id }, 'Campo eliminado de forma lógica.');
});

const listStructure = wrap(async (req, res) => ok(res, await StrategicElement.findAll({
  where: { strategic_plan_id: req.params.planId, deleted_at: null },
  include: [{ model: StrategicLevel, as: 'level' }, { model: StrategicElement, as: 'children', required: false }],
  order: [['position', 'ASC'], ['code', 'ASC']]
})));

const upsertCatalog = wrap(async (req, res) => {
  const values = {
    strategic_plan_id: req.params.planId, catalog_type: req.body.catalog_type,
    code: cleanCode(req.body.code), name: req.body.name, metadata: req.body.metadata || {},
    starts_on: req.body.starts_on || null, ends_on: req.body.ends_on || null, active: req.body.active !== false
  };
  const [item, created] = await StrategicCatalogItem.findOrCreate({ where: { strategic_plan_id: values.strategic_plan_id, catalog_type: values.catalog_type, code: values.code }, defaults: values });
  const previous = created ? null : item.toJSON();
  if (!created) await item.update(values);
  await audit(req, created ? 'catalog.create' : 'catalog.update', 'catalog_item', item.id, previous, item.toJSON());
  ok(res, item);
});

const updateCatalog = wrap(async (req, res) => {
  const item = await StrategicCatalogItem.findOne({ where: { id: req.params.itemId, strategic_plan_id: req.params.planId } });
  if (!item) throw Object.assign(new Error('Referencia no encontrada.'), { statusCode: 404 });
  const previous = item.toJSON();
  await item.update({ name: req.body.name ?? item.name, metadata: req.body.metadata ? { ...(item.metadata || {}), ...req.body.metadata } : item.metadata, active: req.body.active ?? item.active, starts_on: req.body.starts_on ?? item.starts_on, ends_on: req.body.ends_on ?? item.ends_on });
  await audit(req, req.body.active === false ? 'catalog.deactivate' : 'catalog.update', 'catalog_item', item.id, previous, item.toJSON(), req.body.justification);
  ok(res, item, req.body.active === false ? 'Referencia desactivada; se conserva su histórico.' : 'Referencia actualizada.');
});

const deleteCatalog = wrap(async (req, res) => {
  const item = await StrategicCatalogItem.findOne({ where: { id: req.params.itemId, strategic_plan_id: req.params.planId } });
  if (!item) throw Object.assign(new Error('Referencia no encontrada.'), { statusCode: 404 });
  const previous = item.toJSON();
  await item.update({ active: false, ends_on: item.ends_on || new Date().toISOString().slice(0, 10) });
  await audit(req, 'catalog.delete', 'catalog_item', item.id, previous, item.toJSON(), 'Eliminación lógica');
  ok(res, { id: item.id }, 'Referencia eliminada de forma lógica; puede reactivarse.');
});

const referencePreview = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione el Excel de tablas de referencia.'), { statusCode: 422 });
  const plan = await StrategicPlan.findByPk(req.params.planId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const batch = await previewReferenceImport({ strategicPlanId: plan.id, file: req.file, userId: req.user.id });
  ok(res, batch, 'Vista previa generada. Las referencias todavía no se han aplicado.');
});

const referenceConfirm = wrap(async (req, res) => {
  const batch = await confirmReferenceImport({ importId: req.params.importId, userId: req.user.id });
  await audit(req, 'reference_import.confirm', 'reference_import', batch.id, null, batch.summary);
  ok(res, batch, 'Tablas de referencia incorporadas como catálogos dinámicos.');
});

const leaderOptions = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const [users, units, positions] = await Promise.all([
    User.findAll({ where: { estado: 'activo' }, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'], order: [['nombre', 'ASC']] }),
    StrategicCatalogItem.findAll({ where: { strategic_plan_id: plan.id, catalog_type: 'organizational_unit', active: true } }),
    StrategicCatalogItem.findAll({ where: { strategic_plan_id: plan.id, catalog_type: 'position', active: true } })
  ]);
  const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  ok(res, users.map((user) => ({
    id: user.id, document: user.username, name: user.nombre, email: user.email, dependency: user.dependencia, position: user.cargo,
    dependency_catalog_item_id: units.find((unit) => normalizeText(unit.name) === normalizeText(user.dependencia))?.id || null,
    position_catalog_item_id: positions.find((position) => normalizeText(position.name) === normalizeText(user.cargo))?.id || null
  })));
});

const transferLeader = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, { include: [{ model: StrategicTerm, as: 'term' }, { model: StrategicCatalogItem, as: 'organizationalUnit' }] });
  const nextUser = await User.findOne({ where: { id: req.body.user_id, estado: 'activo' } });
  if (!actionPlan || !nextUser) throw Object.assign(new Error('Plan o nuevo responsable no encontrado.'), { statusCode: 404 });
  if (!String(req.body.reason || '').trim()) throw Object.assign(new Error('Debe explicar el motivo de la transferencia.'), { statusCode: 422 });
  const previousAssignment = actionPlan.responsibility_id ? await StrategicResponsibility.findByPk(actionPlan.responsibility_id) : await StrategicResponsibility.findOne({ where: { action_plan_id: actionPlan.id, status: 'active' }, order: [['created_at', 'DESC']] });
  const assignment = await sequelize.transaction(async (transaction) => {
    if (previousAssignment) await previousAssignment.update({ status: 'transferred', ends_on: new Date().toISOString().slice(0, 10), transferred_at: new Date(), transfer_reason: req.body.reason, ended_by: req.user.id }, { transaction });
    const created = await StrategicResponsibility.create({ term_id: actionPlan.term_id, catalog_item_id: actionPlan.catalog_item_id, action_plan_id: actionPlan.id, position_catalog_item_id: req.body.position_catalog_item_id || null, user_id: nextUser.id, responsibility_type: 'action_plan_leader', starts_on: new Date().toISOString().slice(0, 10), status: 'active', predecessor_id: previousAssignment?.id || null, transfer_reason: req.body.reason, created_by: req.user.id }, { transaction });
    await actionPlan.update({ responsible_user_id: nextUser.id, responsibility_id: created.id, updated_by: req.user.id }, { transaction });
    await audit(req, 'action_plan.leader_transfer', 'action_plan', actionPlan.id, { user_id: previousAssignment?.user_id || actionPlan.responsible_user_id, responsibility_id: previousAssignment?.id || null }, { user_id: nextUser.id, responsibility_id: created.id, dependency_id: actionPlan.catalog_item_id, position_id: created.position_catalog_item_id }, req.body.reason, transaction);
    return created;
  });
  ok(res, assignment, 'Liderazgo transferido sin perder el histórico del responsable anterior.');
});

const createTerm = wrap(async (req, res) => {
  const term = await sequelize.transaction(async (transaction) => {
    const row = await StrategicTerm.create({ strategic_plan_id: req.params.planId, year: req.body.year, name: req.body.name || `Vigencia ${req.body.year}`, starts_on: req.body.starts_on, ends_on: req.body.ends_on, status: req.body.status || 'planned' }, { transaction });
    for (const [index, period] of (req.body.periods || []).entries()) await StrategicMonitoringPeriod.create({ term_id: row.id, code: cleanCode(period.code), name: period.name, starts_on: period.starts_on, ends_on: period.ends_on, position: period.position || index + 1, weight: period.weight || 1, status: period.status || 'planned' }, { transaction });
    await audit(req, 'term.create', 'term', row.id, null, row.toJSON(), null, transaction);
    return row;
  });
  res.status(201); ok(res, term);
});

const updateTerm = wrap(async (req, res) => {
  const term = await StrategicTerm.findByPk(req.params.termId);
  if (!term) throw Object.assign(new Error('Año no encontrado.'), { statusCode: 404 });
  const previous = term.toJSON();
  const allowed = ['year', 'name', 'starts_on', 'ends_on', 'status'];
  const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  if (String(changes.ends_on || term.ends_on) < String(changes.starts_on || term.starts_on)) throw Object.assign(new Error('La fecha final no puede ser anterior a la inicial.'), { statusCode: 422 });
  await term.update(changes);
  await audit(req, 'term.update', 'term', term.id, previous, term.toJSON(), req.body.justification);
  ok(res, term, 'Año actualizado.');
});

const deleteTerm = wrap(async (req, res) => {
  const term = await StrategicTerm.findByPk(req.params.termId);
  if (!term) throw Object.assign(new Error('Año no encontrado.'), { statusCode: 404 });
  const actionPlans = await StrategicActionPlan.count({ where: { term_id: term.id, deleted_at: null } });
  if (actionPlans) throw Object.assign(new Error('Este año tiene Planes de Acción y no puede eliminarse.'), { statusCode: 409 });
  const previous = term.toJSON(); await term.update({ status: 'inactive' });
  await audit(req, 'term.delete', 'term', term.id, previous, term.toJSON(), 'Eliminación lógica');
  ok(res, { id: term.id }, 'Año eliminado de forma lógica.');
});

const listActionPlans = wrap(async (req, res) => ok(res, await findActionPlans(req.query)));

const getActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      { model: StrategicTerm, as: 'term', include: [{ model: StrategicPlan, as: 'strategicPlan' }, { model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }] },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: StrategicResponsibility, as: 'currentResponsibility', required: false, include: [{ model: StrategicCatalogItem, as: 'position', required: false }, { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo'], required: false }] },
      { model: StrategicResponsibility, as: 'responsibilityHistory', required: false, include: [{ model: StrategicCatalogItem, as: 'position', required: false }, { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo'], required: false }] },
      { model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false, include: [{ model: StrategicMonitoringResult, as: 'monitoringResults', required: false }, { model: StrategicEvidence, as: 'evidence', required: false }] },
      { model: StrategicWorkflowEvent, as: 'workflowEvents', required: false },
      { model: StrategicMeeting, as: 'meetings', required: false, include: [{ model: StrategicMeetingParticipant, as: 'participants', required: false }, { model: StrategicMinuteVersion, as: 'minuteVersions', required: false }] }
    ]
  });
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  ok(res, actionPlan);
});

const createActionPlan = wrap(async (req, res) => {
  const term = await StrategicTerm.findByPk(req.body.term_id, { include: [{ model: StrategicPlan, as: 'strategicPlan' }] });
  const unit = await StrategicCatalogItem.findByPk(req.body.catalog_item_id);
  const responsible = req.body.responsible_user_id ? await User.findOne({ where: { id: req.body.responsible_user_id, estado: 'activo' } }) : null;
  if (!term || !unit || !responsible) throw Object.assign(new Error('El año, la dependencia y el líder activo son obligatorios.'), { statusCode: 422 });
  if (String(unit.strategic_plan_id) !== String(term.strategic_plan_id)) throw Object.assign(new Error('La dependencia seleccionada no pertenece al PED del año elegido.'), { statusCode: 422 });
  const code = cleanCode(req.body.code || `${term.year}-${unit.code}`);
  const created = await sequelize.transaction(async (transaction) => {
    const action = await StrategicActionPlan.create({
    term_id: term.id, catalog_item_id: unit.id, responsible_user_id: responsible.id,
    code, title: req.body.title || `Plan de Acción ${unit.name} ${term.year}`, status: 'convocation',
    workflow_version: term.strategicPlan.configuration_version, instrument_version: term.strategicPlan.configuration_version,
    metadata: req.body.metadata || {}, created_by: req.user.id, updated_by: req.user.id
    }, { transaction });
    if (responsible) {
      const responsibility = await StrategicResponsibility.create({ term_id: term.id, catalog_item_id: unit.id, action_plan_id: action.id, position_catalog_item_id: req.body.position_catalog_item_id || null, user_id: responsible.id, responsibility_type: 'action_plan_leader', starts_on: new Date().toISOString().slice(0, 10), status: 'active', created_by: req.user.id }, { transaction });
      await action.update({ responsibility_id: responsibility.id }, { transaction });
    }
    await StrategicWorkflowEvent.create({ action_plan_id: action.id, from_state: null, to_state: 'convocation', action: 'create', comment: req.body.comment || null, performed_by: req.user.id, ip_address: req.ip }, { transaction });
    return action;
  });
  await audit(req, 'action_plan.create', 'action_plan', created.id, null, created.toJSON());
  res.status(201); ok(res, created, 'Plan de Acción creado.');
});

const updateActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const previous = actionPlan.toJSON();
  await actionPlan.update({ title: req.body.title ?? actionPlan.title, responsible_user_id: req.body.responsible_user_id ?? actionPlan.responsible_user_id, metadata: req.body.metadata ? { ...actionPlan.metadata, ...req.body.metadata } : actionPlan.metadata, updated_by: req.user.id });
  await audit(req, 'action_plan.update', 'action_plan', actionPlan.id, previous, actionPlan.toJSON(), req.body.justification);
  ok(res, actionPlan);
});

const addActionItem = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const item = await saveActionItem({ req, actionPlan, payload: req.body }); res.status(201); ok(res, item);
});

const updateActionItem = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  if (!item) throw Object.assign(new Error('Actividad no encontrada.'), { statusCode: 404 });
  const actionPlan = await StrategicActionPlan.findByPk(item.action_plan_id);
  ok(res, await saveActionItem({ req, actionPlan, payload: req.body, item }));
});

const deleteActionItem = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  if (!item) throw Object.assign(new Error('Actividad no encontrada.'), { statusCode: 404 });
  const previous = item.toJSON(); await item.update({ deleted_at: new Date(), status: 'deleted', updated_by: req.user.id });
  await audit(req, 'action_item.soft_delete', 'action_item', item.id, previous, item.toJSON(), req.body?.justification);
  ok(res, null, 'Actividad eliminada lógicamente.');
});

const transitionActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  ok(res, await transitionPlan({ req, actionPlan, action: req.body.action, comment: req.body.comment, metadata: req.body.metadata }), 'Transición registrada.');
});

const saveMonitoring = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  const period = await StrategicMonitoringPeriod.findByPk(req.params.periodId);
  if (!item || !period) throw Object.assign(new Error('Actividad o periodo no encontrado.'), { statusCode: 404 });
  ok(res, await upsertMonitoring({ req, actionItem: item, periodId: period.id, payload: req.body }), 'Seguimiento guardado.');
});

const createMeeting = wrap(async (req, res) => {
  const meeting = await sequelize.transaction(async (transaction) => {
    const row = await StrategicMeeting.create({ action_plan_id: req.params.id, monitoring_period_id: req.body.monitoring_period_id || null, type: req.body.type || 'formulation', starts_at: req.body.starts_at, ends_at: req.body.ends_at || null, location: req.body.location || null, modality: req.body.modality || null, objective: req.body.objective, development: req.body.development || null, commitments: req.body.commitments || [], created_by: req.user.id, updated_by: req.user.id }, { transaction });
    for (const p of (req.body.participants || [])) {
      const matchedUser = p.user_id ? await User.findByPk(p.user_id, { transaction }) : (p.email ? await User.findOne({ where: { email: { [Op.iLike]: String(p.email).trim() }, estado: 'activo' }, transaction }) : null);
      await StrategicMeetingParticipant.create({ meeting_id: row.id, user_id: matchedUser?.id || null, participant_type: matchedUser ? 'internal' : 'external', name: p.name || matchedUser?.nombre, email: p.email || matchedUser?.email || null, organization: p.organization || matchedUser?.dependencia || null, role_title: p.role_title || matchedUser?.cargo || null, signature_required: p.signature_required !== false }, { transaction });
    }
    await audit(req, 'meeting.create', 'meeting', row.id, null, row.toJSON(), null, transaction); return row;
  });
  res.status(201); ok(res, meeting, 'Reunión creada.');
});

const minutePayload = async (meeting) => {
  const participants = await StrategicMeetingParticipant.findAll({ where: { meeting_id: meeting.id }, order: [['created_at', 'ASC']] });
  const actionPlan = await StrategicActionPlan.findByPk(meeting.action_plan_id, { include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }] });
  return {
    responsables: participants.filter((p) => p.signature_required).map((p) => p.name).join(', '),
    dependencia: actionPlan?.organizationalUnit?.name || '', lugar: meeting.location || '',
    fecha: new Date(meeting.starts_at).toLocaleDateString('es-CO'),
    horario: `${new Date(meeting.starts_at).toLocaleTimeString('es-CO')} - ${meeting.ends_at ? new Date(meeting.ends_at).toLocaleTimeString('es-CO') : ''}`,
    participantes: participants.map((p) => ({ nombre: p.name, dependencia: p.organization || '', cargo: p.role_title || '' })),
    objetivo: [meeting.objective], desarrollo: [meeting.development || ''],
    conclusiones: (meeting.commitments || []).map((c) => typeof c === 'string' ? c : `${c.description || ''}${c.responsible ? ` — ${c.responsible}` : ''}`),
    meeting: meeting.toJSON(), participants: participants.map((p) => p.toJSON())
  };
};

const createMinuteVersion = wrap(async (req, res) => {
  const meeting = await StrategicMeeting.findByPk(req.params.meetingId);
  if (!meeting) throw Object.assign(new Error('Reunión no encontrada.'), { statusCode: 404 });
  const last = await StrategicMinuteVersion.max('version', { where: { meeting_id: meeting.id } }) || 0;
  const content = req.body.content || await minutePayload(meeting);
  const minute = await StrategicMinuteVersion.create({ meeting_id: meeting.id, version: Number(last) + 1, content, content_hash: hashObject(content), created_by: req.user.id });
  await audit(req, 'minute.version.create', 'minute_version', minute.id, null, minute.toJSON(), req.body.justification);
  res.status(201); ok(res, minute, 'Versión de acta creada; las firmas se vincularán solo a esta versión.');
});

const publishMinute = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const pending = await StrategicMinuteProposal.count({ where: { minute_version_id: minute.id, status: 'pending' } });
  if (pending) throw Object.assign(new Error('Hay propuestas de cambio pendientes por resolver.'), { statusCode: 409 });
  const token = randomToken();
  await minute.update({ status: 'signing', public_token_hash: sha256(token), token_expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000), published_at: new Date() });
  const baseUrl = String(process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const signingUrl = `${baseUrl}/firmar-acta/${token}`;
  const qr_data_url = await QRCode.toDataURL(signingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
  ok(res, { minute, signing_url: signingUrl, qr_data_url }, 'Acta congelada y habilitada para firmas.');
});

const addProposal = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute || !['draft', 'review'].includes(minute.status)) throw Object.assign(new Error('Esta versión ya no acepta propuestas.'), { statusCode: 409 });
  const proposal = await StrategicMinuteProposal.create({ minute_version_id: minute.id, participant_id: req.body.participant_id || null, proposed_by: req.user.id, field_path: req.body.field_path, previous_value: req.body.previous_value, proposed_value: req.body.proposed_value, rationale: req.body.rationale || null });
  res.status(201); ok(res, proposal);
});

const resolveProposal = wrap(async (req, res) => {
  const proposal = await StrategicMinuteProposal.findByPk(req.params.proposalId);
  if (!proposal) throw Object.assign(new Error('Propuesta no encontrada.'), { statusCode: 404 });
  await proposal.update({ status: req.body.accept ? 'accepted' : 'rejected', resolved_by: req.user.id, resolved_at: new Date(), resolution_comment: req.body.comment || null });
  ok(res, proposal);
});

const getPublicMinute = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findOne({ where: { public_token_hash: sha256(req.params.token), status: { [Op.in]: ['signing', 'finalized'] }, token_expires_at: { [Op.gt]: new Date() } } });
  if (!minute) throw Object.assign(new Error('Enlace de firma inválido o vencido.'), { statusCode: 404 });
  const meeting = await StrategicMeeting.findByPk(minute.meeting_id, { include: [{ model: StrategicMeetingParticipant, as: 'participants' }] });
  ok(res, { id: minute.id, version: minute.version, status: minute.status, content: minute.content, content_hash: minute.content_hash, meeting: { id: meeting.id, starts_at: meeting.starts_at, objective: meeting.objective }, participants: meeting.participants.map((p) => ({ id: p.id, name: p.name, email_hint: p.email ? `${p.email.slice(0, 2)}***@${p.email.split('@')[1]}` : '', participant_type: p.participant_type, signed: p.status === 'signed' })) });
});

const requestExternalOtp = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findOne({ where: { public_token_hash: sha256(req.params.token), status: 'signing', token_expires_at: { [Op.gt]: new Date() } } });
  const participant = minute && await StrategicMeetingParticipant.findOne({ where: { id: req.body.participant_id, meeting_id: minute.meeting_id, participant_type: 'external' } });
  if (!participant || String(participant.email || '').toLowerCase() !== String(req.body.email || '').trim().toLowerCase()) throw Object.assign(new Error('Los datos no coinciden con la invitación.'), { statusCode: 422 });
  const otp = String(crypto.randomInt(100000, 999999));
  await participant.update({ otp_hash: sha256(otp), otp_expires_at: new Date(Date.now() + 10 * 60 * 1000), otp_attempts: 0 });
  const sent = await sendInstitutionalEmail({ to: participant.email, subject: 'Código para firmar acta SIAC', text: `Su código temporal es ${otp}. Vence en 10 minutos.` });
  if (!sent.success) throw Object.assign(new Error('No fue posible enviar el código al correo.'), { statusCode: 503 });
  ok(res, null, 'Código enviado.');
});

const storeSignature = ({ participant, minute, signatureData, signerUserId, method, verified, req }) => {
  ensureDir(SIGNATURE_ROOT);
  const parsed = parseDataUrl(signatureData);
  const hash = sha256(parsed.buffer);
  const filePath = path.join(SIGNATURE_ROOT, `${minute.id}-${participant.id}-${Date.now()}.${parsed.extension}`);
  fs.writeFileSync(filePath, parsed.buffer, { flag: 'wx' });
  return StrategicMinuteSignature.create({
    minute_version_id: minute.id, participant_id: participant.id, signer_user_id: signerUserId || null,
    signer_name: participant.name, signer_email: participant.email || null, signer_organization: participant.organization || null,
    signer_role: participant.role_title || null, signature_method: method, signature_storage_key: filePath,
    signature_hash: hash, content_hash: minute.content_hash, verified_email: verified,
    signed_at: new Date(), ip_address: req.ip, user_agent: String(req.headers['user-agent'] || '').slice(0, 500)
  });
};

const signInternal = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute || minute.status !== 'signing') throw Object.assign(new Error('El acta no está habilitada para firma.'), { statusCode: 409 });
  const participant = await StrategicMeetingParticipant.findOne({ where: { id: req.body.participant_id, meeting_id: minute.meeting_id, user_id: req.user.id } });
  if (!participant) throw Object.assign(new Error('No figura como participante interno de esta acta.'), { statusCode: 403 });
  let signatureData = req.body.signature_data;
  let method = 'drawn';
  if (req.body.use_stored_signature) {
    const stored = await StrategicUserSignature.findOne({ where: { user_id: req.user.id, active: true }, order: [['created_at', 'DESC']] });
    if (!stored || !fs.existsSync(stored.storage_key)) throw Object.assign(new Error('No tiene una firma registrada disponible.'), { statusCode: 422 });
    const storedMime = /\.jpe?g$/i.test(stored.storage_key) ? 'jpeg' : 'png';
    signatureData = `data:image/${storedMime};base64,${fs.readFileSync(stored.storage_key).toString('base64')}`; method = 'stored';
    await stored.update({ last_used_at: new Date() });
  }
  const signature = await storeSignature({ participant, minute, signatureData, signerUserId: req.user.id, method, verified: true, req });
  await participant.update({ status: 'signed' }); ok(res, signature, 'Firma registrada con trazabilidad SIAC.');
});

const registerUserSignature = wrap(async (req, res) => {
  const parsed = parseDataUrl(req.body.signature_data); ensureDir(SIGNATURE_ROOT);
  const filePath = path.join(SIGNATURE_ROOT, `user-${req.user.id}-${Date.now()}.${parsed.extension}`);
  fs.writeFileSync(filePath, parsed.buffer, { flag: 'wx' });
  await StrategicUserSignature.update({ active: false }, { where: { user_id: req.user.id, active: true } });
  const signature = await StrategicUserSignature.create({ user_id: req.user.id, storage_key: filePath, sha256: sha256(parsed.buffer), consented_at: new Date() });
  ok(res, { id: signature.id }, 'Firma privada registrada.');
});

const signExternal = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findOne({ where: { public_token_hash: sha256(req.params.token), status: 'signing', token_expires_at: { [Op.gt]: new Date() } } });
  const participant = minute && await StrategicMeetingParticipant.findOne({ where: { id: req.body.participant_id, meeting_id: minute.meeting_id, participant_type: 'external' } });
  if (!participant) throw Object.assign(new Error('Participante no válido.'), { statusCode: 404 });
  if (participant.otp_attempts >= 5 || !participant.otp_expires_at || participant.otp_expires_at < new Date() || participant.otp_hash !== sha256(String(req.body.otp || ''))) {
    await participant.increment('otp_attempts'); throw Object.assign(new Error('Código inválido o vencido.'), { statusCode: 422 });
  }
  await participant.update({ name: req.body.name || participant.name, organization: req.body.organization || participant.organization, role_title: req.body.role_title || participant.role_title, email_verified_at: new Date(), otp_hash: null, otp_expires_at: null });
  const signature = await storeSignature({ participant, minute, signatureData: req.body.signature_data, method: 'external_drawn', verified: true, req });
  await participant.update({ status: 'signed' }); ok(res, { id: signature.id }, 'Firma electrónica registrada.');
});

const downloadMinuteWord = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const buffer = await generateActaBuffer(minute.content);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="ACTA-${minute.meeting_id}-V${minute.version}.docx"`); res.send(buffer);
});

const finalizeMinute = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute || minute.status !== 'signing') throw Object.assign(new Error('El acta no está en firma.'), { statusCode: 409 });
  const required = await StrategicMeetingParticipant.findAll({ where: { meeting_id: minute.meeting_id, signature_required: true } });
  const missing = required.filter((p) => p.status !== 'signed' && !p.absence_justification);
  if (missing.length) throw Object.assign(new Error(`Faltan ${missing.length} firmas requeridas o su justificación de ausencia.`), { statusCode: 409 });
  const signatures = await StrategicMinuteSignature.findAll({ where: { minute_version_id: minute.id }, order: [['signed_at', 'ASC']] });
  const baseUrl = String(process.env.FRONTEND_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const validationUrl = `${req.protocol}://${req.get('host')}/api/public/strategic-planning/validate/${minute.id}`;
  const qrDataUrl = await QRCode.toDataURL(validationUrl, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
  const pdfBuffer = await generateStrategicMinutePdf({ minute, signatures, validationUrl, qrDataUrl });
  const reportsDir = path.join(PRIVATE_ROOT, '_minutes'); ensureDir(reportsDir);
  const finalPdfPath = path.join(reportsDir, `ACTA-${minute.meeting_id}-V${minute.version}.pdf`);
  fs.writeFileSync(finalPdfPath, pdfBuffer);
  await minute.update({ status: 'finalized', finalized_at: new Date(), finalized_by: req.user.id, final_pdf_storage_key: finalPdfPath, final_pdf_hash: sha256(pdfBuffer) });
  await StrategicMeeting.update({ status: 'formalized' }, { where: { id: minute.meeting_id } });
  for (const participant of required.filter((p) => p.email)) {
    await sendInstitutionalEmail({ to: participant.email, subject: 'Acta formalizada en SIAC', text: `El acta versión ${minute.version} fue formalizada. Código de validación: ${minute.id}.`, attachments: [{ filename: path.basename(finalPdfPath), content: pdfBuffer }] });
  }
  await enqueueSync({ entityType: 'minute', entityId: minute.id, createdBy: req.user.id });
  await audit(req, 'minute.finalize', 'minute_version', minute.id, null, minute.toJSON(), req.body.justification);
  ok(res, minute, 'Acta formalizada y notificada.');
});

const downloadMinutePdf = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute?.final_pdf_storage_key || !fs.existsSync(minute.final_pdf_storage_key)) throw Object.assign(new Error('El PDF final aún no está disponible.'), { statusCode: 404 });
  res.download(minute.final_pdf_storage_key, `ACTA-${minute.meeting_id}-V${minute.version}.pdf`);
});

const validateMinute = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId, { attributes: ['id', 'meeting_id', 'version', 'status', 'content_hash', 'final_pdf_hash', 'finalized_at'] });
  if (!minute || minute.status !== 'finalized') throw Object.assign(new Error('Acta no formalizada o código inválido.'), { statusCode: 404 });
  ok(res, minute, 'Acta válida y formalizada en SIAC.');
});

const uploadEvidence = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione un archivo.'), { statusCode: 422 });
  const item = await StrategicActionItem.findByPk(req.params.itemId, { include: [{ model: StrategicActionPlan, as: 'actionPlan', include: [{ model: StrategicTerm, as: 'term' }] }] });
  const period = await StrategicMonitoringPeriod.findByPk(req.body.monitoring_period_id);
  if (!item || !period || period.term_id !== item.actionPlan.term_id) throw Object.assign(new Error('Actividad o periodo inválido.'), { statusCode: 422 });
  const digest = sha256(req.file.buffer);
  const duplicate = await StrategicEvidence.findOne({ where: { action_item_id: item.id, monitoring_period_id: period.id, sha256: digest, deleted_at: null } });
  if (duplicate) return ok(res, duplicate, 'La evidencia ya existía; no se duplicó.');
  const yearDir = path.join(PRIVATE_ROOT, String(item.actionPlan.term.year), item.actionPlan.id, period.code);
  ensureDir(yearDir);
  const ext = path.extname(req.file.originalname).slice(0, 12).toLowerCase();
  const nextVersion = (await StrategicEvidence.max('version', { where: { action_item_id: item.id, monitoring_period_id: period.id } }) || 0) + 1;
  const storedName = `${cleanCode(item.code)}-EV-${String(nextVersion).padStart(3, '0')}${ext}`;
  const storageKey = path.join(yearDir, storedName); fs.writeFileSync(storageKey, req.file.buffer, { flag: 'wx' });
  const evidence = await StrategicEvidence.create({ action_item_id: item.id, monitoring_period_id: period.id, original_name: req.file.originalname, stored_name: storedName, storage_key: storageKey, mime_type: req.file.mimetype || 'application/octet-stream', size_bytes: req.file.size, sha256: digest, version: nextVersion, description: req.body.description || null, uploaded_by: req.user.id });
  await enqueueSync({ entityId: evidence.id, createdBy: req.user.id });
  await audit(req, 'evidence.upload', 'evidence', evidence.id, null, { ...evidence.toJSON(), storage_key: '[PRIVATE]' });
  res.status(201); ok(res, evidence, 'Evidencia almacenada temporalmente y puesta en cola para Drive.');
});

const downloadEvidence = wrap(async (req, res) => {
  const evidence = await StrategicEvidence.findByPk(req.params.evidenceId);
  if (!evidence || evidence.deleted_at || !fs.existsSync(evidence.storage_key)) throw Object.assign(new Error('Evidencia no encontrada.'), { statusCode: 404 });
  res.download(evidence.storage_key, evidence.original_name);
});

const retrySync = wrap(async (req, res) => {
  const evidence = await StrategicEvidence.findByPk(req.params.evidenceId);
  if (!evidence) throw Object.assign(new Error('Evidencia no encontrada.'), { statusCode: 404 });
  await evidence.update({ sync_status: 'pending' });
  ok(res, await enqueueSync({ entityId: evidence.id, createdBy: req.user.id, payload: { manual_retry: true } }), 'Reintento programado.');
});

const reconcile = wrap(async (req, res) => ok(res, await reconcileTerm(req.params.termId, req.user.id), 'Conciliación programada.'));

const closeTerm = wrap(async (req, res) => {
  const term = await StrategicTerm.findByPk(req.params.termId);
  if (!term) throw Object.assign(new Error('Vigencia no encontrada.'), { statusCode: 404 });
  const reconciliation = await reconcileTerm(term.id, req.user.id);
  if (reconciliation.pending) throw Object.assign(new Error(`No se puede cerrar: hay ${reconciliation.pending} evidencias pendientes o con error. Se conservarán en el servidor.`), { statusCode: 409 });
  await term.update({ status: 'closed', closed_at: new Date(), closed_by: req.user.id });
  await audit(req, 'term.close', 'term', term.id, null, term.toJSON());
  ok(res, { term, cleanup_authorized: true }, 'Vigencia cerrada. La eliminación física requiere una tarea administrativa posterior y manifiesto completo.');
});

const previewBudget = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione un Excel.'), { statusCode: 422 });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(req.file.buffer); const sheet = workbook.worksheets[0];
  const headers = {}; sheet.getRow(1).eachCell((cell, col) => { headers[String(cell.value || '').trim().toLowerCase()] = col; });
  const aliases = { codigo: ['codigo', 'código', 'actividad'], inicial: ['presupuesto inicial', 'inicial'], adicion: ['adiciones', 'adición'], reduccion: ['reducciones', 'reducción'], traslado: ['traslados', 'traslado'], comprometido: ['comprometido'], ejecutado: ['ejecutado'] };
  const col = (name) => aliases[name].map((a) => headers[a]).find(Boolean);
  const rows = []; const errors = [];
  for (let r = 2; r <= sheet.rowCount; r += 1) {
    const code = String(sheet.getCell(r, col('codigo') || 1).value || '').trim(); if (!code) continue;
    const values = Object.fromEntries(['inicial', 'adicion', 'reduccion', 'traslado', 'comprometido', 'ejecutado'].map((key) => [key, Number(sheet.getCell(r, col(key) || 0).value || 0)]));
    if (Object.values(values).some((v) => !Number.isFinite(v))) errors.push({ row: r, message: 'Hay valores presupuestales no numéricos.' });
    rows.push({ row: r, code, ...values, vigente: values.inicial + values.adicion - values.reduccion + values.traslado, saldo: values.inicial + values.adicion - values.reduccion + values.traslado - values.ejecutado });
  }
  const record = await StrategicBudgetImport.create({ term_id: req.body.term_id, original_name: req.file.originalname, sha256: sha256(req.file.buffer), rows, error_report: errors, summary: { total_rows: rows.length, errors: errors.length }, created_by: req.user.id });
  ok(res, record, 'Vista previa generada.');
});

const confirmBudget = wrap(async (req, res) => {
  const batch = await StrategicBudgetImport.findByPk(req.params.importId);
  if (!batch || batch.status !== 'preview') throw Object.assign(new Error('Lote no disponible.'), { statusCode: 409 });
  if ((batch.error_report || []).length) throw Object.assign(new Error('Corrija los errores antes de confirmar.'), { statusCode: 422 });
  await sequelize.transaction(async (transaction) => {
    for (const row of batch.rows || []) {
      const item = await StrategicActionItem.findOne({ where: { code: cleanCode(row.code), deleted_at: null }, include: [{ model: StrategicActionPlan, as: 'actionPlan', where: { term_id: batch.term_id } }], transaction });
      if (!item) continue;
      for (const type of ['inicial', 'adicion', 'reduccion', 'traslado', 'comprometido', 'ejecutado']) if (Number(row[type])) await StrategicBudgetMovement.create({ term_id: batch.term_id, action_item_id: item.id, budget_import_id: batch.id, movement_type: type, amount: row[type], occurred_on: new Date().toISOString().slice(0, 10), metadata: { source_row: row.row } }, { transaction });
    }
    await batch.update({ status: 'confirmed', confirmed_by: req.user.id, confirmed_at: new Date() }, { transaction });
    await audit(req, 'budget_import.confirm', 'budget_import', batch.id, null, batch.toJSON(), null, transaction);
  }); ok(res, batch, 'Lote presupuestal confirmado.');
});

const reverseBudget = wrap(async (req, res) => {
  const batch = await StrategicBudgetImport.findByPk(req.params.importId);
  if (!batch || batch.status !== 'confirmed') throw Object.assign(new Error('Solo se puede reversar un lote confirmado.'), { statusCode: 409 });
  await sequelize.transaction(async (transaction) => { await StrategicBudgetMovement.destroy({ where: { budget_import_id: batch.id }, transaction }); await batch.update({ status: 'reversed', reversed_by: req.user.id, reversed_at: new Date() }, { transaction }); await audit(req, 'budget_import.reverse', 'budget_import', batch.id, null, batch.toJSON(), req.body.justification, transaction); });
  ok(res, batch, 'Lote reversado sin alterar otros movimientos.');
});

const previewHistorical = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione el formato institucional.'), { statusCode: 422 });
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(req.file.buffer); const sheet = workbook.worksheets[0];
  const startRow = Number(req.body.start_row || 10); const mapping = req.body.mapping ? JSON.parse(req.body.mapping) : { strategic_objective: 2, guideline: 3, code: 4, activity: 5, indicator_type: 6, indicator: 7, formula: 8, target: 9, responsible: 10, co_responsibles: 11, budget: 12, first_progress: 13, first_observation: 14, second_progress: 16, second_observation: 17, total_progress: 18 };
  const rows = []; const errors = [];
  for (let r = startRow; r <= sheet.rowCount; r += 1) {
    const activity = String(sheet.getCell(r, mapping.activity).value || '').trim(); if (!activity) continue;
    const row = { source_row: r }; Object.entries(mapping).forEach(([key, column]) => { const cell = sheet.getCell(r, Number(column)); row[key] = cell.value?.result ?? cell.value ?? null; });
    row.code = cleanCode(row.code || `ACT-${r}`); if (!row.indicator) errors.push({ row: r, field: 'indicator', message: 'Indicador vacío.' }); rows.push(row);
  }
  const record = await StrategicHistoricalImport.create({ strategic_plan_id: req.body.strategic_plan_id, term_id: req.body.term_id, format_code: req.body.format_code || 'DIR-PE-FR-003', format_version: Number(req.body.format_version || 5), mapping, original_name: req.file.originalname, sha256: sha256(req.file.buffer), rows, errors, created_by: req.user.id });
  ok(res, record, 'Vista previa histórica generada; no se ha modificado el plan.');
});

const confirmHistorical = wrap(async (req, res) => {
  const batch = await StrategicHistoricalImport.findByPk(req.params.importId);
  if (!batch || batch.status !== 'preview') throw Object.assign(new Error('Importación no disponible.'), { statusCode: 409 });
  if ((batch.errors || []).length && req.body.confirm_with_warnings !== true) throw Object.assign(new Error('La importación tiene advertencias. Revise y confirme expresamente.'), { statusCode: 422 });
  const unit = await StrategicCatalogItem.findOne({ where: { id: req.body.catalog_item_id, strategic_plan_id: batch.strategic_plan_id, active: true } });
  const term = await StrategicTerm.findByPk(batch.term_id);
  if (!unit || !term) throw Object.assign(new Error('Seleccione una dependencia válida para asociar las filas.'), { statusCode: 422 });
  const actionPlan = await sequelize.transaction(async (transaction) => {
    const [plan] = await StrategicActionPlan.findOrCreate({
      where: { code: cleanCode(req.body.action_plan_code || `${term.year}-${unit.code}`) },
      defaults: { term_id: term.id, catalog_item_id: unit.id, responsible_user_id: req.body.responsible_user_id || null, title: req.body.title || `Plan de Acción ${unit.name} ${term.year}`, status: 'formulation', metadata: { historical_import_id: batch.id }, created_by: req.user.id, updated_by: req.user.id }, transaction
    });
    for (const row of batch.rows || []) {
      const [item] = await StrategicActionItem.findOrCreate({
        where: { action_plan_id: plan.id, code: cleanCode(row.code) },
        defaults: { action_plan_id: plan.id, code: cleanCode(row.code), activity: String(row.activity), indicator_type: row.indicator_type || null, indicator: row.indicator || null, target: row.target ? String(row.target) : null, co_responsibles: row.co_responsibles ? [String(row.co_responsibles)] : [], custom_values: { strategic_objective: row.strategic_objective, guideline: row.guideline, formula: row.formula, budget: row.budget, source_row: row.source_row }, current_progress: Number(row.total_progress?.result ?? row.total_progress ?? 0) * (Number(row.total_progress?.result ?? row.total_progress ?? 0) <= 1 ? 100 : 1), created_by: req.user.id, updated_by: req.user.id }, transaction
      });
      const periods = await StrategicMonitoringPeriod.findAll({ where: { term_id: term.id }, order: [['position', 'ASC']], transaction });
      for (const [index, period] of periods.slice(0, 2).entries()) {
        const raw = index === 0 ? row.first_progress : row.second_progress; const progress = Number(raw?.result ?? raw ?? 0);
        const observation = index === 0 ? row.first_observation : row.second_observation;
        if (raw !== null && raw !== undefined && raw !== '') await StrategicMonitoringResult.findOrCreate({ where: { action_item_id: item.id, monitoring_period_id: period.id }, defaults: { action_item_id: item.id, monitoring_period_id: period.id, physical_progress: progress * (progress <= 1 ? 100 : 1), observations: observation ? String(observation) : null, status: 'imported', created_by: req.user.id }, transaction });
      }
    }
    await batch.update({ status: 'confirmed', confirmed_by: req.user.id, confirmed_at: new Date() }, { transaction });
    await audit(req, 'historical_import.confirm', 'historical_import', batch.id, null, { action_plan_id: plan.id, rows: batch.rows.length }, null, transaction);
    return plan;
  });
  ok(res, actionPlan, 'Importación histórica confirmada transaccionalmente.');
});

const exportActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, { include: [
    { model: StrategicTerm, as: 'term', include: [{ model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }] },
    { model: StrategicCatalogItem, as: 'organizationalUnit' },
    { model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false, include: [{ model: StrategicMonitoringResult, as: 'monitoringResults', required: false, include: [{ model: StrategicMonitoringPeriod, as: 'period' }] }] }
  ] });
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const activities = (actionPlan.items || []).map((item) => {
    const sorted = [...(item.monitoringResults || [])].sort((a, b) => (a.period?.position || 0) - (b.period?.position || 0));
    return { objetivo_estrategico: item.custom_values?.strategic_objective || '', lineamiento_estrategico: item.custom_values?.guideline || '', actividad: item.activity, tipo_indicador: item.indicator_type, fecha_inicio: item.starts_on, fecha_fin: item.ends_on, indicador: item.indicator, meta: item.target, responsable: actionPlan.organizationalUnit?.name, corresponsable: (item.co_responsibles || []).join(', '), avance_ip: sorted[0]?.physical_progress, observaciones_ip: sorted[0]?.observations, avance_iip: sorted[1]?.physical_progress, observaciones_iip: sorted[1]?.observations };
  });
  const buffer = await generatePlanAccionBuffer({ planData: { anio: actionPlan.term.year, codigoPlan: actionPlan.code, responsable: actionPlan.organizationalUnit?.name }, actividades: activities, corresponsabilidades: [] });
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="DIR-PE-FR-003_${actionPlan.code}_${actionPlan.term.year}.xlsx"`); res.send(buffer);
});

const analytics = wrap(async (req, res) => {
  const plans = await findActionPlans(req.query); const planIds = plans.map((p) => p.id); const items = plans.flatMap((p) => p.items || []);
  const budget = planIds.length ? await StrategicBudgetMovement.findAll({ include: [{ model: StrategicActionItem, as: 'actionItem', required: false }], where: req.query.termId ? { term_id: req.query.termId } : {} }).catch(() => []) : [];
  const evidences = items.length ? await StrategicEvidence.findAll({ where: { action_item_id: { [Op.in]: items.map((i) => i.id) }, deleted_at: null } }) : [];
  ok(res, { plans: plans.length, activities: items.length, physical_progress: items.length ? items.reduce((s, i) => s + Number(i.current_progress || 0), 0) / items.length : 0, evidence: { total: evidences.length, pending: evidences.filter((e) => e.sync_status !== 'synced').length }, budget: budget.reduce((acc, row) => ({ ...acc, [row.movement_type]: Number(acc[row.movement_type] || 0) + Number(row.amount || 0) }), {}) });
});

const listAudit = wrap(async (req, res) => ok(res, await StrategicAuditEvent.findAll({ where: req.query.entity_type ? { entity_type: req.query.entity_type } : {}, limit: Math.min(500, Number(req.query.limit || 100)), order: [['created_at', 'DESC']] })));
const listSyncJobs = wrap(async (_req, res) => ok(res, await StrategicSyncJob.findAll({ limit: 200, order: [['created_at', 'DESC']] })));

module.exports = {
  bootstrap, listPlans, createPlan, updatePlan, deletePlan, createLevel, updateLevel, deleteLevel,
  createElement, updateElement, deleteElement, listStructure, upsertCatalog, updateCatalog, deleteCatalog,
  applyInstitutionalTemplate, createFieldDefinition, updateFieldDefinition, deleteFieldDefinition,
  referencePreview, referenceConfirm, leaderOptions, transferLeader, createTerm, updateTerm, deleteTerm,
  listActionPlans, getActionPlan, createActionPlan, updateActionPlan, addActionItem, updateActionItem, deleteActionItem,
  transitionActionPlan, saveMonitoring, createMeeting, createMinuteVersion, publishMinute, addProposal, resolveProposal,
  getPublicMinute, requestExternalOtp, signInternal, signExternal, registerUserSignature, downloadMinuteWord, downloadMinutePdf, validateMinute, finalizeMinute,
  uploadEvidence, downloadEvidence, retrySync, reconcile, closeTerm, previewBudget, confirmBudget, reverseBudget,
  previewHistorical, confirmHistorical, exportActionPlan, analytics, listAudit, listSyncJobs
};
