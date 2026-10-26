const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const QRCode = require('qrcode');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { ROLES } = require('../constants/roles');
const {
  StrategicPlan, StrategicLevel, StrategicElement, StrategicTerm, StrategicCatalogItem,
  StrategicResponsibility, StrategicFieldDefinition, StrategicMonitoringPeriod,
  StrategicActionPlan, StrategicActionItem, StrategicActionItemVersion, StrategicWorkflowEvent,
  StrategicMeeting, StrategicMeetingParticipant, StrategicMeetingSchedule, StrategicMinuteVersion, StrategicMinuteProposal,
  StrategicMinuteSignature, StrategicUserSignature, StrategicMonitoringResult, StrategicEvidence,
  StrategicSyncJob, StrategicBudgetImport, StrategicBudgetMovement, StrategicHistoricalImport,
  StrategicAuditEvent, StrategicNotification, GoogleCalendarConnection, User
} = require('../models');
const { formatPersonName } = require('../utils/formatPersonName');
const { getOAuthConfiguration, createAuthorizationUrl, createConnectedOAuthClient } = require('../services/meetingCalendarOAuthService');
const { getCalendarConfiguration, normalizeAttendees, checkAvailability, findAvailableSlots, saveCalendarEvent, cancelCalendarEvent } = require('../services/meetingCalendarService');
const { generateActaBuffer } = require('../services/actaExportService');
const { generateStrategicMinutePdf, ensureMinuteFinalPdfBuffer } = require('../services/strategicMinutePdfService');
const { generatePlanAccionBuffer } = require('../services/planAccionExportService');
const { renderInstitutionalTemplate, escapeHtml } = require('../services/emailService');
const { sendStrategicPlanningEmail } = require('../services/strategicPlanningEmailService');
const { ensureStrategicPlanningDefaults, DEFAULT_WORKFLOW, DEFAULT_FIELDS } = require('../services/strategicPlanningBootstrap');
const { sha256, cleanCode, requestMeta, audit, transitionPlan, saveActionItem, upsertMonitoring, findActionPlans } = require('../services/strategicPlanningDomainService');
const { enqueueSync, enqueueActionRepositorySync, reconcileTerm, syncMinute, syncEvidence, getActivityDriveFolder, getMinutesDriveFolder } = require('../services/strategicPlanningDriveService');
const { buildReferenceWorkbook, previewReferenceImport, confirmReferenceImport } = require('../services/strategicReferenceService');
const { buildPedSchedule, reconcilePlanTerms } = require('../services/strategicPlanSetupService');
const { buildDynamicActionItemWorkbook, previewDynamicActionItems, confirmDynamicActionItems } = require('../services/strategicDynamicWorkbookService');
const { previewFieldSchemaImport, confirmFieldSchemaImport } = require('../services/strategicFieldSchemaService');
const {
  listTermDependencies, buildTermDependencyWorkbook, previewTermDependencyImport,
  confirmTermDependencyImport, addTermDependency, removeTermDependency
} = require('../services/strategicTermDependencyService');
const { captureActionPlanSchema } = require('../services/strategicActionPlanSchemaService');
const { improveStrategicMinuteText, generateStrategicMinuteSummary } = require('../services/strategicMinuteWritingService');
const { validateAdministrativeActDate } = require('../services/strategicPlanDateValidationService');
const { syncActionPlanRepositoryTerm, syncSinglePlanOfficialWorkbook, buildOfficialWorkbook, findCoResponsibleActivitiesForPlan } = require('../services/actionPlanRepositoryDriveService');
const { getPlanStatistics } = require('../services/strategicPlanningStatsService');
const { PRIVACY_POLICY_NOTICE, PRIVACY_POLICY_URL, PRIVACY_POLICY_VERSION } = require('../constants/privacyPolicy');

const PLANNING_DEPARTMENT_NAME = 'Dirección de Planeación y Aseguramiento de la Calidad';

const refreshActionRepository = (termId, req, reason) => enqueueActionRepositorySync({
  termId, reason, createdBy: req.user?.id || null
});

const refreshPedRepository = async (planId, req, reason) => {
  const terms = await StrategicTerm.findAll({
    where: {
      strategic_plan_id: planId,
      status: { [Op.ne]: 'inactive' }
    },
    attributes: ['id']
  });
  await Promise.all(terms.map((term) => refreshActionRepository(term.id, req, reason)));
  return terms.length;
};

const ensureActionPlanSchemaSnapshot = async (actionPlan, transaction = null) => {
  if (actionPlan.metadata?.form_schema) return actionPlan.metadata.form_schema;
  const term = await StrategicTerm.findByPk(actionPlan.term_id, { transaction });
  if (!term) throw Object.assign(new Error('La vigencia del Plan de Acción no existe.'), { statusCode: 404 });
  const formSchema = await captureActionPlanSchema(term.strategic_plan_id, transaction);
  await actionPlan.update({
    metadata: { ...(actionPlan.metadata || {}), form_schema: formSchema },
    instrument_version: formSchema.configuration_version
  }, { transaction });
  return formSchema;
};

// La carpeta .private vive dentro del volumen respaldado de uploads, pero Express
// no publica directorios con punto. Todo acceso se hace mediante endpoints con auth.
const PRIVATE_ROOT = path.resolve(process.env.SIAC_PEI_TEMP_DIR || path.join(__dirname, '../../uploads/.private/strategic-planning'));
const SIGNATURE_ROOT = path.join(PRIVATE_ROOT, '_signatures');
const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });
const ok = (res, data, message = '') => res.json({ success: true, message, data });
const fail = (res, error) => res.status(error.statusCode || 500).json({
  success: false,
  message: error.message || 'Error interno',
  data: error.data || undefined
});
const wrap = (fn) => async (req, res) => { try { await fn(req, res); } catch (error) { console.error('PEI:', error); fail(res, error); } };
const hashObject = (value) => sha256(Buffer.from(JSON.stringify(value)));
const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
const safeWebOrigin = (value) => {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? url.origin : null;
  } catch (_) { return null; }
};
const signingFrontendOrigin = (req) => (
  safeWebOrigin(req.body?.public_base_url)
  || safeWebOrigin(process.env.PUBLIC_FRONTEND_URL)
  || safeWebOrigin(process.env.FRONTEND_URL)
  || safeWebOrigin(req.get('origin'))
  || `${req.protocol}://${req.get('host')}`
);
const parseDataUrl = (value) => {
  const match = String(value || '').match(/^data:image\/(png|jpeg);base64,([a-zA-Z0-9+/=]+)$/);
  if (!match) throw Object.assign(new Error('La firma debe enviarse como imagen PNG o JPEG.'), { statusCode: 422 });
  const buffer = Buffer.from(match[2], 'base64');
  if (!buffer.length || buffer.length > 2 * 1024 * 1024) throw Object.assign(new Error('La firma no puede superar 2 MB.'), { statusCode: 413 });
  return { buffer, extension: match[1] === 'jpeg' ? 'jpg' : 'png' };
};

const notifyPlanningUsers = async ({ actionPlanId, type, title, message, link, metadata, excludeUserId }) => {
  try {
    const whereClause = {
      role: ['planeacion_efectividad', 'planeacion_estrategica', 'administrador'],
      estado: 'activo'
    };
    if (excludeUserId) {
      whereClause.id = { [Op.ne]: excludeUserId };
    }
    const planningUsers = await User.findAll({ where: whereClause });
    await Promise.all(
      planningUsers.map((pu) =>
        StrategicNotification.create({
          user_id: pu.id,
          action_plan_id: actionPlanId,
          type,
          title,
          message,
          link,
          metadata
        }).catch((err) => console.warn(`notifyPlanningUsers warning for user ${pu.id}:`, err.message))
      )
    );
  } catch (err) {
    console.warn('notifyPlanningUsers error:', err.message);
  }
};

const planIncludes = [
  { model: StrategicLevel, as: 'levels', where: { active: true }, required: false, separate: true, order: [['position', 'ASC']] },
  {
    model: StrategicTerm,
    as: 'terms',
    where: { status: { [Op.ne]: 'inactive' } },
    required: false,
    separate: true,
    order: [['year', 'ASC']],
    include: [{ model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }]
  },
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
  const automaticSetup = payload.duration_years !== undefined && payload.duration_years !== null && payload.duration_years !== '';
  const setupMode = ['blank', 'institutional', 'copy'].includes(payload.setup_mode) ? payload.setup_mode : 'institutional';
  const schedule = automaticSetup ? buildPedSchedule({ startsOn: payload.starts_on, durationYears: payload.duration_years }) : null;
  const templatePlan = automaticSetup && payload.template_plan_id
    ? await StrategicPlan.findByPk(payload.template_plan_id)
    : null;
  if (setupMode === 'copy' && !templatePlan) throw Object.assign(new Error('Seleccione el PED que desea copiar.'), { statusCode: 422 });
  const code = schedule?.code || payload.code;
  const name = String(payload.name || '').trim() || schedule?.name;
  const endsOn = schedule?.endsOn || payload.ends_on;
  if (!String(code || '').trim() || !String(name || '').trim() || !payload.starts_on || !endsOn) {
    throw Object.assign(new Error('Código, nombre y fechas del PED son obligatorios.'), { statusCode: 422 });
  }
  if (String(endsOn) < String(payload.starts_on)) {
    throw Object.assign(new Error('La fecha final del PED no puede ser anterior a la fecha inicial.'), { statusCode: 422 });
  }
  validateAdministrativeActDate({ startsOn: payload.starts_on, approvedOn: payload.approved_on, endsOn });
  if (await StrategicPlan.count({ where: { code: cleanCode(code), deleted_at: null } })) {
    throw Object.assign(new Error(`Ya existe el ${cleanCode(code)}. Ábralo desde el selector para revisarlo o editarlo.`), { statusCode: 409 });
  }
  const created = await sequelize.transaction(async (transaction) => {
    const plan = await StrategicPlan.create({
      code: cleanCode(code), name, description: payload.description || null,
      starts_on: payload.starts_on, ends_on: endsOn, status: payload.status || (automaticSetup ? 'active' : 'draft'),
      approval_document: payload.approval_document || null,
      administrative_act: payload.administrative_act || null,
      approved_on: payload.approved_on || null,
      global_budget: payload.global_budget || null,
      responsible_user_id: payload.responsible_user_id || null,
      settings: {
        workflow: payload.workflow || templatePlan?.settings?.workflow || DEFAULT_WORKFLOW,
        referenceCatalogs: setupMode === 'blank' ? [] : (templatePlan?.settings?.referenceCatalogs || []),
        automatic_setup: automaticSetup,
        setup_mode: setupMode,
        ...(payload.settings || {})
      },
      created_by: req.user.id, updated_by: req.user.id
    }, { transaction });

    if (automaticSetup) {
      for (const termData of schedule.terms) {
        const { periods, ...termValues } = termData;
        const term = await StrategicTerm.create({ strategic_plan_id: plan.id, ...termValues }, { transaction });
        for (const period of periods) await StrategicMonitoringPeriod.create({ term_id: term.id, ...period }, { transaction });
      }
      if (setupMode === 'institutional') {
        for (const [position, levelName] of ['Objetivo Estratégico', 'Lineamiento Estratégico'].entries()) {
          await StrategicLevel.create({ strategic_plan_id: plan.id, name: levelName, position: position + 1, configuration_version: plan.configuration_version }, { transaction });
        }
        for (const [position, [key, label, dataType, required]] of DEFAULT_FIELDS.entries()) {
          await StrategicFieldDefinition.create({ strategic_plan_id: plan.id, key, label, data_type: dataType, required, position: position + 1, configuration_version: plan.configuration_version, validation_rules: dataType === 'percentage' ? { min: 0, max: 100 } : {}, formula: key === 'total_progress' ? 'progress_s1 + progress_s2' : null }, { transaction });
        }
      }
      if (setupMode === 'copy' && templatePlan) {
        const [sourceLevels, sourceElements, sourceFields] = await Promise.all([
          StrategicLevel.findAll({ where: { strategic_plan_id: templatePlan.id, configuration_version: templatePlan.configuration_version, active: true }, order: [['position', 'ASC']], transaction }),
          StrategicElement.findAll({ where: { strategic_plan_id: templatePlan.id, version: templatePlan.configuration_version, active: true, deleted_at: null }, order: [['position', 'ASC']], transaction }),
          StrategicFieldDefinition.findAll({ where: { strategic_plan_id: templatePlan.id, configuration_version: templatePlan.configuration_version, active: true }, order: [['position', 'ASC']], transaction })
        ]);
        const levelIds = new Map();
        for (const source of sourceLevels) {
          const cloned = await StrategicLevel.create({ strategic_plan_id: plan.id, name: source.name, position: source.position, configuration_version: plan.configuration_version, active: true }, { transaction });
          levelIds.set(String(source.id), cloned.id);
        }
        const elementIds = new Map();
        for (const source of sourceElements) {
          const cloned = await StrategicElement.create({ strategic_plan_id: plan.id, level_id: levelIds.get(String(source.level_id)), parent_id: null, code: source.code, name: source.name, description: source.description, position: source.position, version: plan.configuration_version, active: true }, { transaction });
          elementIds.set(String(source.id), cloned.id);
        }
        for (const source of sourceElements) {
          if (source.parent_id) await StrategicElement.update({ parent_id: elementIds.get(String(source.parent_id)) || null }, { where: { id: elementIds.get(String(source.id)) }, transaction });
        }
        if (sourceFields.length) await StrategicFieldDefinition.bulkCreate(sourceFields.map((field) => ({ strategic_plan_id: plan.id, key: field.key, label: field.label, data_type: field.data_type, required: field.required, position: field.position, validation_rules: field.validation_rules || {}, options: field.options || [], formula: field.formula || null, configuration_version: plan.configuration_version, active: true })), { transaction });
      }
      if (setupMode !== 'blank' && templatePlan) {
        const references = await StrategicCatalogItem.findAll({ where: { strategic_plan_id: templatePlan.id, active: true }, transaction });
        if (references.length) await StrategicCatalogItem.bulkCreate(references.map((item) => ({
          strategic_plan_id: plan.id,
          catalog_type: item.catalog_type,
          code: item.code,
          name: item.name,
          metadata: item.metadata || {},
          starts_on: item.starts_on || null,
          ends_on: item.ends_on || null,
          active: true
        })), { transaction });
      }
    }
    await audit(req, 'strategic_plan.create', 'strategic_plan', plan.id, null, plan.toJSON(), automaticSetup ? `Creación automática de PED en modo ${setupMode}, con vigencias y semestres` : null, transaction);
    return plan;
  });
  await refreshPedRepository(created.id, req, 'strategic_plan_created');
  res.status(201); ok(res, created, automaticSetup ? 'PED creado. Ahora puede diseñar su estructura y formulario desde la interfaz.' : 'PED creado.');
});

const updatePlan = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.id);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const previous = plan.toJSON();
  const allowed = ['code', 'name', 'description', 'starts_on', 'ends_on', 'status', 'approval_document', 'administrative_act', 'approved_on', 'global_budget', 'responsible_user_id', 'drive_root_id'];
  const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  for (const nullableKey of ['approval_document', 'administrative_act', 'approved_on', 'global_budget', 'responsible_user_id', 'drive_root_id']) {
    if (changes[nullableKey] === '') changes[nullableKey] = null;
  }
  if (changes.starts_on !== undefined || changes.ends_on !== undefined) {
    const nextStartYear = Number(String(changes.starts_on || plan.starts_on).slice(0, 4));
    const nextEndYear = Number(String(changes.ends_on || plan.ends_on).slice(0, 4));
    const automaticCode = `PED-${nextStartYear}-${nextEndYear}`;
    const automaticName = `Plan Estratégico de Desarrollo ${nextStartYear}–${nextEndYear}`;

    if (!changes.code) changes.code = automaticCode;
    if (!changes.name) changes.name = automaticName;
  }
  if (changes.code) {
    changes.code = cleanCode(changes.code);
    if (changes.code !== plan.code) {
      const duplicate = await StrategicPlan.count({ where: { id: { [Op.ne]: plan.id }, code: changes.code, deleted_at: null } });
      if (duplicate) throw Object.assign(new Error(`Ya existe el ${changes.code}. Selecciónelo desde la lista para consultarlo.`), { statusCode: 409 });
    }
  }

  if (String(changes.ends_on || plan.ends_on) < String(changes.starts_on || plan.starts_on)) throw Object.assign(new Error('La fecha final no puede ser anterior a la inicial.'), { statusCode: 422 });
  validateAdministrativeActDate({
    startsOn: changes.starts_on || plan.starts_on,
    approvedOn: changes.approved_on !== undefined ? changes.approved_on : plan.approved_on,
    endsOn: changes.ends_on || plan.ends_on
  });
  if (req.body.settings) changes.settings = { ...(plan.settings || {}), ...req.body.settings };
  if (req.body.new_configuration_version) changes.configuration_version = Number(plan.configuration_version) + 1;
  changes.updated_by = req.user.id;
  await sequelize.transaction(async (transaction) => {
    await plan.update(changes, { transaction });

    if (changes.starts_on !== undefined || changes.ends_on !== undefined) {
      await reconcilePlanTerms(plan, transaction);
    }

    await audit(req, 'strategic_plan.update', 'strategic_plan', plan.id, previous, plan.toJSON(), req.body.justification, transaction);
  });
  await refreshPedRepository(plan.id, req, 'strategic_plan_updated');
  const reloaded = await StrategicPlan.findByPk(plan.id, { include: planIncludes });
  ok(res, reloaded, 'Configuración actualizada.');

});

const deletePlan = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.id);
  if (!plan || plan.deleted_at) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  if (plan.status !== 'draft') {
    throw Object.assign(new Error('Solo se pueden eliminar PED en estado Borrador. Los PED activos, cerrados o históricos permanecen protegidos.'), { statusCode: 409 });
  }
  const previous = plan.toJSON();
  await sequelize.transaction(async (transaction) => {
    const deletedCode = `${String(plan.code).slice(0, 22)}-DEL-${Date.now().toString(36)}`;
    await plan.update({
      code: deletedCode,
      deleted_at: new Date(),
      updated_by: req.user.id,
      settings: { ...(plan.settings || {}), deleted_original_code: previous.code }
    }, { transaction });
    await audit(req, 'strategic_plan.delete_draft', 'strategic_plan', plan.id, previous, plan.toJSON(), 'Retiro de PED en borrador', transaction);
  });
  ok(res, { id: plan.id }, 'PED en borrador eliminado correctamente.');
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
      const [field, created] = await StrategicFieldDefinition.findOrCreate({ where: { strategic_plan_id: plan.id, key, configuration_version: plan.configuration_version }, defaults: { strategic_plan_id: plan.id, key, label, data_type: dataType, required, position: position + 1, configuration_version: plan.configuration_version, validation_rules: dataType === 'percentage' ? { min: 0, max: 100 } : {}, formula: key === 'total_progress' ? 'progress_s1 + progress_s2' : null }, transaction });
      if (!created && !field.active) await field.update({ active: true }, { transaction });
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
  const key = cleanCode(req.body.key).toLowerCase().replace(/-/g, '_');
  const values = { strategic_plan_id: plan.id, key, label: req.body.label, data_type: req.body.data_type, required: req.body.required === true, position: req.body.position || ((await StrategicFieldDefinition.max('position', { where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version } })) || 0) + 1, validation_rules: req.body.validation_rules || {}, options: req.body.options || [], formula: req.body.formula || null, configuration_version: plan.configuration_version, active: true };
  const existing = await StrategicFieldDefinition.findOne({ where: { strategic_plan_id: plan.id, key, configuration_version: plan.configuration_version } });
  const previous = existing?.toJSON() || null;
  const field = existing ? await existing.update(values) : await StrategicFieldDefinition.create(values);
  await audit(req, existing ? 'field.reactivate' : 'field.create', 'field_definition', field.id, previous, field.toJSON());
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

const reorderFieldDefinitions = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const { fieldIds } = req.body;
  if (!Array.isArray(fieldIds) || !fieldIds.length) {
    throw Object.assign(new Error('Se requiere la lista de IDs de campos en orden.'), { statusCode: 422 });
  }

  await sequelize.transaction(async (transaction) => {
    for (let i = 0; i < fieldIds.length; i++) {
      await StrategicFieldDefinition.update(
        { position: i + 1 },
        { where: { id: fieldIds[i], strategic_plan_id: plan.id, active: true }, transaction }
      );
    }
  });

  const updated = await StrategicFieldDefinition.findAll({
    where: { strategic_plan_id: plan.id, active: true },
    order: [['position', 'ASC']]
  });
  await audit(req, 'field.reorder', 'strategic_plan', plan.id, null, { fieldIds }, 'Reordenamiento de columnas del PED');
  ok(res, updated, 'Orden de columnas actualizado correctamente.');
});

const previewFieldSchema = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione el Excel del formato que desea convertir en campos.'), { statusCode: 422 });
  const batch = await previewFieldSchemaImport({ strategicPlanId: req.params.planId, file: req.file, userId: req.user.id });
  ok(res, batch, 'Encabezados detectados. Revise los campos antes de crear la tabla del PED.');
});

const confirmFieldSchema = wrap(async (req, res) => {
  const batch = await confirmFieldSchemaImport({
    importId: req.params.importId,
    userId: req.user.id,
    fields: req.body.fields,
    replaceExisting: req.body.replace_existing === true
  });
  await audit(req, 'field_schema_import.confirm', 'reference_import', batch.id, null, batch.summary);
  ok(res, batch, 'La tabla dinámica del PED fue creada con los campos seleccionados.');
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

const downloadReferenceTemplate = wrap(async (req, res) => {
  const buffer = await buildReferenceWorkbook(req.params.planId);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="LISTAS_INSTITUCIONALES_${req.params.planId}.xlsx"`);
  res.send(Buffer.from(buffer));
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

const termDependencies = wrap(async (req, res) => {
  const rows = await listTermDependencies({
    planId: req.params.planId,
    termId: req.query.termId || null,
    repair: req.query.repair === 'true'
  });
  ok(res, rows);
});

const lookupMeetingParticipant = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId, { attributes: ['id'] });
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const document = String(req.query.document || '').trim();
  if (!document) throw Object.assign(new Error('Digite la cédula del participante.'), { statusCode: 422 });
  const user = await User.findOne({
    where: { username: document, estado: 'activo' },
    attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'vicerrectoria', 'cargo']
  });
  if (!user) throw Object.assign(new Error('No se encontró un usuario activo con esta cédula en SIAC.'), { statusCode: 404 });
  ok(res, {
    id: user.id, document: user.username, name: user.nombre, email: user.email,
    dependency: user.dependencia, viceRectorate: user.vicerrectoria, position: user.cargo
  });
});

// Búsqueda exclusiva para las actas de Planes de Acción. No comparte ni
// modifica el flujo del formato digital general de actas.
const searchMeetingParticipants = wrap(async (req, res) => {
  const plan = await StrategicPlan.findByPk(req.params.planId, { attributes: ['id'] });
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const query = String(req.query.q || '').trim();
  if (query.length < 2) return ok(res, []);
  const pattern = `%${query.replace(/[%_]/g, '\\$&')}%`;
  const users = await User.findAll({
    where: {
      estado: 'activo',
      [Op.or]: [
        { username: { [Op.iLike]: pattern } },
        { nombre: { [Op.iLike]: pattern } },
        { email: { [Op.iLike]: pattern } },
        { dependencia: { [Op.iLike]: pattern } },
        { cargo: { [Op.iLike]: pattern } }
      ]
    },
    attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'vicerrectoria', 'cargo'],
    order: [['nombre', 'ASC']],
    limit: 12
  });
  ok(res, users.map((user) => ({
    id: user.id,
    document: user.username,
    name: user.nombre,
    email: user.email,
    dependency: user.dependencia,
    viceRectorate: user.vicerrectoria,
    position: user.cargo
  })));
});

const downloadTermDependencyTemplate = wrap(async (req, res) => {
  const buffer = await buildTermDependencyWorkbook(req.params.termId);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="DEPENDENCIAS_VIGENCIA_${req.params.termId}.xlsx"`);
  res.send(Buffer.from(buffer));
});

const termDependencyPreview = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione la plantilla Excel de la vigencia.'), { statusCode: 422 });
  const batch = await previewTermDependencyImport({ termId: req.params.termId, file: req.file, userId: req.user.id });
  ok(res, batch, 'Revise el cruce con SIAC. Todav\u00eda no se ha modificado la vigencia.');
});

const termDependencyConfirm = wrap(async (req, res) => {
  const batch = await confirmTermDependencyImport({ importId: req.params.importId, userId: req.user.id });
  await audit(req, 'term_dependencies.confirm', 'reference_import', batch.id, null, batch.summary);
  await refreshActionRepository(batch.parsed_data?.term_id, req, 'term_dependencies_imported');
  ok(res, batch, 'Dependencias de la vigencia actualizadas.');
});

const createTermDependency = wrap(async (req, res) => {
  const row = await addTermDependency({ termId: req.params.termId, dependencyName: req.body.dependency, document: req.body.document, userId: req.user.id });
  await refreshActionRepository(req.params.termId, req, 'term_dependency_added');
  res.status(201); ok(res, row, 'Dependencia vinculada a la vigencia.');
});

const deleteTermDependency = wrap(async (req, res) => {
  const row = await removeTermDependency({ termId: req.params.termId, assignmentId: req.params.assignmentId, userId: req.user.id });
  await refreshActionRepository(req.params.termId, req, 'term_dependency_removed');
  ok(res, row, 'Dependencia retirada de esta vigencia.');
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
    const year = Number(req.body.year);
    const formulationStartsOn = req.body.formulation_starts_on || `${year}-01-01`;
    const formulationEndsOn = req.body.formulation_ends_on || `${year}-03-31`;
    const metadata = {
      ...(req.body.metadata || {}),
      formulation_starts_on: formulationStartsOn,
      formulation_ends_on: formulationEndsOn
    };
    const row = await StrategicTerm.create({
      strategic_plan_id: req.params.planId,
      year,
      name: req.body.name || `Vigencia ${year}`,
      starts_on: req.body.starts_on,
      ends_on: req.body.ends_on,
      status: req.body.status || 'planned',
      metadata
    }, { transaction });
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
  const allowed = ['year', 'name', 'starts_on', 'ends_on', 'status', 'metadata'];
  const changes = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
  if (String(changes.ends_on || term.ends_on) < String(changes.starts_on || term.starts_on)) throw Object.assign(new Error('La fecha final no puede ser anterior a la inicial.'), { statusCode: 422 });

  if (req.body.formulation_starts_on !== undefined || req.body.formulation_ends_on !== undefined) {
    changes.metadata = {
      ...(term.metadata || {}),
      ...(changes.metadata || {}),
      ...(req.body.formulation_starts_on ? { formulation_starts_on: req.body.formulation_starts_on } : {}),
      ...(req.body.formulation_ends_on ? { formulation_ends_on: req.body.formulation_ends_on } : {})
    };
  }

  await term.update(changes);

  if (req.body.propagate_to_plans) {
    const formulationStartsOn = changes.metadata?.formulation_starts_on || term.metadata?.formulation_starts_on || `${term.year}-01-01`;
    const formulationEndsOn = changes.metadata?.formulation_ends_on || term.metadata?.formulation_ends_on;
    if (formulationEndsOn) {
      const plans = await StrategicActionPlan.findAll({ where: { term_id: term.id, deleted_at: null } });
      for (const p of plans) {
        const currentDeadline = p.metadata?.formulation_ends_on || null;
        // Regla institucional:
        // Solo actualizar si el plan no tenía fecha o si la nueva fecha general amplía el plazo.
        // Nunca recortar ni bajar el plazo si ya tenía una fecha individual mayor.
        const shouldUpdate = !currentDeadline || String(formulationEndsOn) >= String(currentDeadline);
        if (shouldUpdate) {
          await p.update({
            metadata: {
              ...(p.metadata || {}),
              formulation_starts_on: formulationStartsOn,
              formulation_ends_on: formulationEndsOn
            }
          });
        }
      }
    }
  }

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

const getMyActionPlans = wrap(async (req, res) => {
  const userId = req.user.id;
  const userEmail = String(req.user.email || '').trim().toLowerCase();

  const directPlans = await StrategicActionPlan.findAll({
    where: { deleted_at: null, responsible_user_id: userId },
    attributes: ['id']
  });

  const respAssignments = await StrategicResponsibility.findAll({
    where: { user_id: userId, status: 'active' },
    attributes: ['action_plan_id']
  });

  const meetingParts = await StrategicMeetingParticipant.findAll({
    where: {
      [Op.or]: [
        { user_id: userId },
        ...(userEmail ? [{ email: { [Op.iLike]: userEmail } }] : [])
      ]
    },
    include: [{ model: StrategicMeeting, as: 'meeting', attributes: ['action_plan_id'] }]
  });

  const planIds = Array.from(new Set([
    ...directPlans.map((p) => p.id),
    ...respAssignments.map((r) => r.action_plan_id).filter(Boolean),
    ...meetingParts.map((m) => m.meeting?.action_plan_id).filter(Boolean)
  ]));

  if (!planIds.length) {
    return ok(res, []);
  }

  const isPlanningStaff = ['administrador', 'planeacion_efectividad', 'planeacion_estrategica'].includes(req.user?.role);

  const whereClause = { id: { [Op.in]: planIds }, deleted_at: null };
  if (!isPlanningStaff) {
    whereClause[Op.or] = [
      { status: { [Op.in]: ['owner_validation', 'active', 'monitoring', 'closed'] } },
      sequelize.literal(`EXISTS (
        SELECT 1 FROM pei_meetings pm
        JOIN pei_minute_versions pmv ON pmv.meeting_id = pm.id
        WHERE pm.action_plan_id = "StrategicActionPlan"."id" AND pmv.status = 'signing'
      )`)
    ];
  }

  const plans = await StrategicActionPlan.findAll({
    where: whereClause,
    include: [
      {
        model: StrategicTerm, as: 'term',
        include: [
          { model: StrategicPlan, as: 'strategicPlan' },
          { model: StrategicMonitoringPeriod, as: 'monitoringPeriods', separate: true, order: [['position', 'ASC']] }
        ]
      },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      {
        model: StrategicActionItem, as: 'items',
        where: { deleted_at: null }, required: false, separate: true, order: [['code', 'ASC']],
        include: [
          { model: StrategicMonitoringResult, as: 'monitoringResults', required: false, separate: true },
          { model: StrategicEvidence, as: 'evidence', where: { deleted_at: null }, required: false, separate: true }
        ]
      },
      {
        model: StrategicMeeting, as: 'meetings', required: false, separate: true, order: [['starts_at', 'DESC']],
        include: [
          {
            model: StrategicMeetingParticipant, as: 'participants', required: false, separate: true,
            include: [{ model: User, as: 'user', attributes: ['id', 'username'] }]
          },
          {
            model: StrategicMinuteVersion, as: 'minuteVersions', required: false, separate: true,
            include: [{ model: StrategicMinuteSignature, as: 'signatures', required: false }]
          }
        ]
      }
    ],
    order: [['created_at', 'DESC']]
  });

  const result = plans.map((plan) => {
    const plain = plan.toJSON();
    const meetings = plain.meetings || [];
    const latestMeeting = meetings[0] || null;
    const latestMinute = (latestMeeting?.minuteVersions || []).sort((a, b) => Number(b.version) - Number(a.version))[0] || null;
    const isSigning = latestMinute?.status === 'signing';
    const isFinalized = latestMinute?.status === 'finalized' || latestMeeting?.status === 'formalized';
    const effectiveStatus = (plain.status === 'convocation' || plain.status === 'formulation' || plain.status === 'preliminary_minutes') && isSigning
      ? 'owner_validation'
      : plain.status;
    const isActive = effectiveStatus === 'active' || effectiveStatus === 'monitoring';
    const isOwnerValidation = effectiveStatus === 'owner_validation' || isSigning;

    const myParticipant = (latestMeeting?.participants || []).find((p) => (
      String(p.user_id) === String(userId) ||
      (userEmail && String(p.email || '').trim().toLowerCase() === userEmail)
    ));
    const mySignature = myParticipant
      ? (latestMinute?.signatures || []).find((s) => String(s.participant_id) === String(myParticipant.id))
      : null;

    return {
      ...plain,
      status: effectiveStatus,
      is_responsible: String(plain.responsible_user_id) === String(userId),
      can_execute: isActive,
      needs_review: isOwnerValidation && !mySignature,
      my_signed: Boolean(mySignature || myParticipant?.status === 'signed'),
      latest_minute_id: latestMinute?.id || null,
      latest_minute_status: latestMinute?.status || null,
      drive_file_id: latestMinute?.drive_file_id || null,
      drive_folder_url: latestMinute?.content?.drive_folder_url || null,
      drive_file_url: latestMinute?.content?.drive_file_url || null
    };
  });

  const finalResult = await Promise.all(result.map(async (p) => {
    try {
      const coItems = await findCoResponsibleActivitiesForPlan(p);
      return { ...p, co_responsible_items: coItems };
    } catch (_) {
      return { ...p, co_responsible_items: [] };
    }
  }));

  ok(res, finalResult);
});

const listActionPlans = wrap(async (req, res) => {
  const includeItems = req.query.includeItems === 'true';
  const reconcileLegacy = req.query.reconcileLegacy === 'true';
  const plans = await findActionPlans({ ...req.query, includeItems, reconcileLegacy });
  ok(res, plans);
});

const getActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      { model: StrategicTerm, as: 'term', include: [{ model: StrategicPlan, as: 'strategicPlan' }, { model: StrategicMonitoringPeriod, as: 'monitoringPeriods', separate: true, order: [['position', 'ASC']] }] },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: StrategicResponsibility, as: 'currentResponsibility', required: false, include: [{ model: StrategicCatalogItem, as: 'position', required: false }, { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'], required: false }] },
      { model: StrategicResponsibility, as: 'responsibilityHistory', required: false, separate: true, include: [{ model: StrategicCatalogItem, as: 'position', required: false }, { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'], required: false }] },
      { model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false, separate: true, order: [['code', 'ASC']], include: [{ model: StrategicMonitoringResult, as: 'monitoringResults', required: false, separate: true }, { model: StrategicEvidence, as: 'evidence', required: false, separate: true }] },
      { model: StrategicWorkflowEvent, as: 'workflowEvents', required: false, separate: true, order: [['created_at', 'ASC']] },
      { model: StrategicMeeting, as: 'meetings', required: false, separate: true, order: [['starts_at', 'DESC']], include: [{ model: StrategicMeetingParticipant, as: 'participants', required: false, separate: true, include: [{ model: User, as: 'user', attributes: ['id', 'username'], required: false }] }, { model: StrategicMinuteVersion, as: 'minuteVersions', required: false, separate: true, include: [{ model: StrategicMinuteSignature, as: 'signatures', required: false }] }] }
    ]
  });
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  if (actionPlan.deleted_at) {
    const replacement = await StrategicActionPlan.findOne({
      where: {
        term_id: actionPlan.term_id,
        catalog_item_id: actionPlan.catalog_item_id,
        deleted_at: null,
        id: { [Op.ne]: actionPlan.id }
      },
      order: [['updated_at', 'DESC']],
      attributes: ['id', 'code']
    });
    const error = Object.assign(new Error(replacement
      ? 'Este registro fue reemplazado por el Plan de Acción vigente.'
      : 'Plan de Acción no encontrado.'), { statusCode: replacement ? 409 : 404 });
    if (replacement) error.data = { replacement_plan_id: replacement.id, replacement_code: replacement.code };
    throw error;
  }
  const freshSchema = await captureActionPlanSchema(actionPlan.term.strategic_plan_id);
  const existingFields = Array.isArray(actionPlan.metadata?.form_schema?.fields)
    ? actionPlan.metadata.form_schema.fields
    : [];
  const freshKeys = new Set(freshSchema.fields.map((f) => f.key));
  const legacyFields = existingFields.filter((f) => !freshKeys.has(f.key));
  const mergedFields = [...freshSchema.fields, ...legacyFields].map((f) => {
    if (['responsible', 'responsable_de_ejecucion', 'co_responsibles'].includes(f.key) && !f.validation_rules?.catalog_type) {
      return { ...f, validation_rules: { ...(f.validation_rules || {}), catalog_type: 'organizational_unit' } };
    }
    return f;
  });

  const activeSchema = {
    strategic_plan_id: actionPlan.term.strategic_plan_id,
    configuration_version: freshSchema.configuration_version,
    captured_at: freshSchema.captured_at,
    fields: mergedFields,
    catalogs: freshSchema.catalogs,
    levels: freshSchema.levels,
    elements: freshSchema.elements
  };

  actionPlan.metadata = { ...(actionPlan.metadata || {}), form_schema: activeSchema };
  await actionPlan.update({ metadata: actionPlan.metadata });
  actionPlan.setDataValue('form_schema', activeSchema);
  actionPlan.setDataValue('schema_is_snapshot', true);
  for (const meeting of actionPlan.meetings || []) {
    for (const minute of meeting.minuteVersions || []) {
      for (const signature of minute.signatures || []) {
        const storageKey = signature.signature_storage_key;
        if (storageKey && fs.existsSync(storageKey)) {
          const stats = fs.statSync(storageKey);
          if (stats.isFile() && stats.size <= 2 * 1024 * 1024) {
            const mime = /\.jpe?g$/i.test(storageKey) ? 'image/jpeg' : 'image/png';
            signature.setDataValue('signature_preview', `data:${mime};base64,${fs.readFileSync(storageKey).toString('base64')}`);
          }
        }
        // La ruta privada del archivo nunca debe salir en la respuesta de la API.
        signature.setDataValue('signature_storage_key', null);
        signature.setDataValue('ip_address', null);
        signature.setDataValue('user_agent', null);
      }
    }
  }
  if (!actionPlan.metadata?.drive_sync?.official_file_id) {
    syncSinglePlanOfficialWorkbook(actionPlan.id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));
  }

  // Resolver líder del Plan de Acción para auto-asignación en actas
  let planResponsibleUser = actionPlan.currentResponsibility?.responsibleUser;
  if (!planResponsibleUser && actionPlan.catalog_item_id && actionPlan.term_id) {
    const annualAssignment = await StrategicResponsibility.findOne({
      where: {
        term_id: actionPlan.term_id,
        catalog_item_id: actionPlan.catalog_item_id,
        status: 'active'
      },
      include: [{ model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'] }],
      order: [['updated_at', 'DESC']]
    });
    if (annualAssignment?.responsibleUser) {
      planResponsibleUser = annualAssignment.responsibleUser;
    }
  }
  if (!planResponsibleUser && (actionPlan.responsible_user_id || actionPlan.user_id)) {
    planResponsibleUser = await User.findByPk(actionPlan.responsible_user_id || actionPlan.user_id, {
      attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username']
    });
  }
  if (planResponsibleUser) {
    actionPlan.setDataValue('planResponsibleUser', planResponsibleUser);
  }

  // Resolver usuario con rol de Planeación y Efectividad dinámicamente
  const peUser = await User.findOne({
    where: {
      role: ROLES.PLANEACION_EFECTIVIDAD,
      estado: 'activo'
    },
    attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username', 'role'],
    order: [['updated_at', 'DESC']]
  });
  if (peUser) {
    actionPlan.setDataValue('planningEfectividadUser', peUser);
  }

  const coItems = await findCoResponsibleActivitiesForPlan(actionPlan).catch(() => []);
  actionPlan.setDataValue('co_responsible_items', coItems);

  ok(res, actionPlan);
});

const createActionPlan = wrap(async (req, res) => {
  const term = await StrategicTerm.findByPk(req.body.term_id, { include: [{ model: StrategicPlan, as: 'strategicPlan' }] });
  const unit = await StrategicCatalogItem.findByPk(req.body.catalog_item_id);
  const responsible = req.body.responsible_user_id ? await User.findOne({ where: { id: req.body.responsible_user_id, estado: 'activo' } }) : null;
  if (!term || !unit || !responsible) throw Object.assign(new Error('El año, la dependencia y el líder activo son obligatorios.'), { statusCode: 422 });
  if (String(unit.strategic_plan_id) !== String(term.strategic_plan_id)) throw Object.assign(new Error('La dependencia seleccionada no pertenece al PED del año elegido.'), { statusCode: 422 });
  const annualAssignment = await StrategicResponsibility.findOne({ where: { term_id: term.id, catalog_item_id: unit.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' } });
  if (!annualAssignment) throw Object.assign(new Error(`Primero configure la dependencia ${unit.name} en la vigencia ${term.year}.`), { statusCode: 422 });
  if (String(annualAssignment.user_id) !== String(responsible.id)) throw Object.assign(new Error('El responsable no coincide con el configurado para esta dependencia y vigencia. Actualícelo primero en el paso 3.'), { statusCode: 422 });
  const existingForDependency = await StrategicActionPlan.findOne({ where: { term_id: term.id, catalog_item_id: unit.id, deleted_at: null } });
  if (existingForDependency) throw Object.assign(new Error(`La dependencia ${unit.name} ya tiene un Plan de Acción para ${term.year}. Ábralo desde la tarjeta correspondiente.`), { statusCode: 409 });
  const baseCode = cleanCode(req.body.code || `${term.year}-${unit.code}`);
  let code = baseCode;
  let sequence = 2;
  while (await StrategicActionPlan.count({ where: { code } })) {
    code = `${baseCode}-${String(sequence).padStart(2, '0')}`;
    sequence += 1;
  }
  const created = await sequelize.transaction(async (transaction) => {
    const formSchema = await captureActionPlanSchema(term.strategic_plan_id, transaction);
    const termMeta = term.metadata || {};
    const defaultStartsOn = termMeta.formulation_starts_on || `${term.year}-01-01`;
    const defaultEndsOn = termMeta.formulation_ends_on || `${term.year}-03-31`;
    const action = await StrategicActionPlan.create({
      term_id: term.id,
      catalog_item_id: unit.id,
      responsible_user_id: responsible.id,
      code,
      title: req.body.title || `Plan de Acción ${unit.name} ${term.year}`,
      status: 'convocation',
      workflow_version: term.strategicPlan.configuration_version,
      instrument_version: term.strategicPlan.configuration_version,
      metadata: {
        ...(req.body.metadata || {}),
        form_schema: formSchema,
        formulation_starts_on: req.body.formulation_starts_on || defaultStartsOn,
        formulation_ends_on: req.body.formulation_ends_on || defaultEndsOn,
        formulation_extensions: []
      },
      created_by: req.user.id,
      updated_by: req.user.id
    }, { transaction });
    if (responsible) {
      const responsibility = await StrategicResponsibility.create({ term_id: term.id, catalog_item_id: unit.id, action_plan_id: action.id, position_catalog_item_id: req.body.position_catalog_item_id || null, user_id: responsible.id, responsibility_type: 'action_plan_leader', starts_on: new Date().toISOString().slice(0, 10), status: 'active', created_by: req.user.id }, { transaction });
      await action.update({ responsibility_id: responsibility.id }, { transaction });
    }
    await StrategicWorkflowEvent.create({ action_plan_id: action.id, from_state: null, to_state: 'convocation', action: 'create', comment: req.body.comment || null, performed_by: req.user.id, ip_address: req.ip }, { transaction });
    return action;
  });
  await audit(req, 'action_plan.create', 'action_plan', created.id, null, created.toJSON());
  await refreshActionRepository(created.term_id, req, 'action_plan_created');
  res.status(201); ok(res, created, 'Plan de Acción creado.');
});

const updateActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const previous = actionPlan.toJSON();
  const protectedMetadata = req.body.metadata
    ? { ...actionPlan.metadata, ...req.body.metadata, form_schema: actionPlan.metadata?.form_schema }
    : actionPlan.metadata;
  await actionPlan.update({
    code: req.body.code ? req.body.code.trim().toUpperCase() : actionPlan.code,
    title: req.body.title ?? actionPlan.title,
    responsible_user_id: req.body.responsible_user_id ?? actionPlan.responsible_user_id,
    metadata: protectedMetadata,
    updated_by: req.user.id
  });
  await audit(req, 'action_plan.update', 'action_plan', actionPlan.id, previous, actionPlan.toJSON(), req.body.justification);
  await refreshActionRepository(actionPlan.term_id, req, 'action_plan_updated');
  ok(res, actionPlan);
});

const deleteActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  const previous = actionPlan.toJSON();
  await sequelize.transaction(async (transaction) => {
    const deletedCode = `DELETED-${String(actionPlan.id).slice(0, 8)}-${actionPlan.code}`.slice(0, 80);
    await StrategicActionItem.update({ deleted_at: new Date() }, { where: { action_plan_id: actionPlan.id, deleted_at: null }, transaction });
    await StrategicResponsibility.update({ status: 'ended', ends_on: new Date().toISOString().slice(0, 10) }, { where: { action_plan_id: actionPlan.id, status: 'active' }, transaction });
    // También retirar la dependencia de la vigencia (Paso 3)
    await StrategicResponsibility.update(
      { status: 'inactive', ends_on: new Date().toISOString().slice(0, 10), ended_by: req.user.id },
      { where: { term_id: actionPlan.term_id, catalog_item_id: actionPlan.catalog_item_id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' }, transaction }
    );
    await actionPlan.update({
      code: deletedCode,
      deleted_at: new Date(),
      updated_by: req.user.id,
      metadata: { ...(actionPlan.metadata || {}), deleted_original_code: actionPlan.code }
    }, { transaction });
    await audit(req, 'action_plan.delete', 'action_plan', actionPlan.id, previous, actionPlan.toJSON(), 'Eliminación de plan de acción y retiro de dependencia de la vigencia', transaction);
  });
  await refreshActionRepository(actionPlan.term_id, req, 'action_plan_deleted');
  ok(res, { id: actionPlan.id }, 'Plan de Acción y dependencia eliminados de la vigencia correctamente.');
});

const bulkDeleteActionPlans = wrap(async (req, res) => {
  const { termId } = req.params;
  const term = await StrategicTerm.findByPk(termId);
  if (!term) throw Object.assign(new Error('Vigencia no encontrada.'), { statusCode: 404 });
  const plans = await StrategicActionPlan.findAll({ where: { term_id: termId, deleted_at: null } });

  const planIds = plans.map((p) => p.id);
  await sequelize.transaction(async (transaction) => {
    if (planIds.length) {
      await StrategicActionItem.update({ deleted_at: new Date() }, { where: { action_plan_id: { [Op.in]: planIds }, deleted_at: null }, transaction });
      await StrategicResponsibility.update({ status: 'ended', ends_on: new Date().toISOString().slice(0, 10) }, { where: { action_plan_id: { [Op.in]: planIds }, status: 'active' }, transaction });
      for (const plan of plans) {
        const deletedCode = `DELETED-${String(plan.id).slice(0, 8)}-${plan.code}`.slice(0, 80);
        await plan.update({
          code: deletedCode,
          deleted_at: new Date(),
          updated_by: req.user.id,
          metadata: { ...(plan.metadata || {}), deleted_original_code: plan.code }
        }, { transaction });
      }
    }
    // Retirar también todas las dependencias configuradas en esta vigencia (Paso 3)
    await StrategicResponsibility.update(
      { status: 'inactive', ends_on: new Date().toISOString().slice(0, 10), ended_by: req.user.id },
      { where: { term_id: termId, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' }, transaction }
    );
    await audit(req, 'action_plan.bulk_delete', 'term', termId, null, { deleted_plans: planIds.length }, `Eliminación masiva de ${planIds.length} planes y dependencias en vigencia ${term.year}`, transaction);
  });
  await refreshActionRepository(termId, req, 'action_plans_bulk_deleted');
  ok(res, { count: plans.length }, `Se eliminaron los planes de acción y las dependencias de la vigencia ${term.year}.`);
});

const bulkCreateActionPlans = wrap(async (req, res) => {
  const { termId } = req.params;
  const term = await StrategicTerm.findByPk(termId, { include: [{ model: StrategicPlan, as: 'strategicPlan' }] });
  if (!term) throw Object.assign(new Error('Vigencia no encontrada.'), { statusCode: 404 });

  const assignments = await StrategicResponsibility.findAll({
    where: { term_id: term.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' },
    include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: User, as: 'responsibleUser', where: { estado: 'activo' } }
    ]
  });

  if (!assignments.length) {
    throw Object.assign(new Error(`No hay dependencias configuradas con responsable activo en la vigencia ${term.year}. Configure las dependencias en el paso 3 primero.`), { statusCode: 422 });
  }

  const existingPlans = await StrategicActionPlan.findAll({
    where: { term_id: term.id, deleted_at: null },
    attributes: ['catalog_item_id']
  });
  const existingUnitIds = new Set(existingPlans.map((p) => String(p.catalog_item_id)));

  const pendingAssignments = assignments.filter((a) => !existingUnitIds.has(String(a.catalog_item_id)));
  if (!pendingAssignments.length) {
    return ok(res, { created: 0 }, 'Todas las dependencias ya tienen su Plan de Acción creado.');
  }

  const formSchema = await captureActionPlanSchema(term.strategic_plan_id);
  const createdPlans = [];

  await sequelize.transaction(async (transaction) => {
    for (const assignment of pendingAssignments) {
      const unit = assignment.organizationalUnit;
      const responsible = assignment.responsibleUser;
      if (!unit || !responsible) continue;

      const baseCode = cleanCode(`${term.year}-${unit.code}`);
      let code = baseCode;
      let sequence = 2;
      while (await StrategicActionPlan.count({ where: { code }, transaction })) {
        code = `${baseCode}-${String(sequence).padStart(2, '0')}`;
        sequence += 1;
      }

      const termMeta = term.metadata || {};
      const defaultStartsOn = termMeta.formulation_starts_on || `${term.year}-01-01`;
      const defaultEndsOn = termMeta.formulation_ends_on || `${term.year}-03-31`;

      const plan = await StrategicActionPlan.create({
        term_id: term.id,
        catalog_item_id: unit.id,
        responsible_user_id: responsible.id,
        code,
        title: `Plan de Acción ${unit.name} ${term.year}`,
        status: 'convocation',
        workflow_version: term.strategicPlan.configuration_version,
        instrument_version: term.strategicPlan.configuration_version,
        metadata: {
          form_schema: formSchema,
          formulation_starts_on: defaultStartsOn,
          formulation_ends_on: defaultEndsOn,
          formulation_extensions: []
        },
        created_by: req.user.id,
        updated_by: req.user.id
      }, { transaction });

      const resp = await StrategicResponsibility.create({
        term_id: term.id,
        catalog_item_id: unit.id,
        action_plan_id: plan.id,
        user_id: responsible.id,
        responsibility_type: 'action_plan_leader',
        starts_on: new Date().toISOString().slice(0, 10),
        status: 'active',
        created_by: req.user.id
      }, { transaction });

      await plan.update({ responsibility_id: resp.id }, { transaction });
      createdPlans.push(plan);
    }
    await audit(req, 'action_plan.bulk_create', 'term', term.id, null, { count: createdPlans.length }, `Creación masiva de ${createdPlans.length} planes en vigencia ${term.year}`, transaction);
  });

  await refreshActionRepository(term.id, req, 'action_plans_bulk_created');
  ok(res, { created: createdPlans.length }, `Se crearon ${createdPlans.length} planes de acción exitosamente para ${term.year}.`);
});

const ensureCanModifyActionPlanItems = async (actionPlan, req) => {
  const isPlanningAdmin = ['administrador', 'planeacion_efectividad', 'planeacion_estrategica'].includes(req.user?.role);
  if (isPlanningAdmin) return true;
  if (['active', 'monitoring', 'closed'].includes(actionPlan?.status)) {
    throw Object.assign(new Error('El Plan de Acción se encuentra en ejecución. Para adicionar, modificar o eliminar actividades, comuníquese con la Dirección de Planeación y Aseguramiento de la Calidad.'), { statusCode: 403 });
  }

  // Verificación de vigencia y plazo de la Etapa 1 para usuarios no administradores
  const today = new Date().toISOString().slice(0, 10);
  let termMetadata = {};
  if (actionPlan?.term_id) {
    const term = actionPlan.term || await StrategicTerm.findByPk(actionPlan.term_id, { attributes: ['metadata', 'year'] });
    termMetadata = term?.metadata || {};
  }
  const startsOn = actionPlan?.metadata?.formulation_starts_on || termMetadata.formulation_starts_on;
  const endsOn = actionPlan?.metadata?.formulation_ends_on || termMetadata.formulation_ends_on;

  if (startsOn && today < startsOn) {
    throw Object.assign(new Error(`El plazo de formulación de la Etapa 1 aún no ha iniciado (Inicia el ${startsOn}).`), { statusCode: 403 });
  }
  if (endsOn && today > endsOn) {
    throw Object.assign(new Error(`El plazo de formulación de la Etapa 1 finalizó el ${endsOn}. Para solicitar una ampliación de tiempo o prórroga, comuníquese con la Dirección de Planeación y Aseguramiento de la Calidad (Planeación y Efectividad).`), { statusCode: 403 });
  }

  return true;
};

const updateStage1Timeline = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [{ model: StrategicTerm, as: 'term' }]
  });
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });

  const isPlanningAdmin = ['administrador', 'planeacion_efectividad', 'planeacion_estrategica'].includes(req.user?.role);
  if (!isPlanningAdmin) {
    throw Object.assign(new Error('Solo la Dirección de Planeación y Aseguramiento de la Calidad (Planeación y Efectividad) o el Administrador pueden gestionar el plazo de formulación o conceder prórrogas.'), { statusCode: 403 });
  }

  const { starts_on, ends_on, reason } = req.body;
  if (!ends_on) throw Object.assign(new Error('La fecha límite de formulación (cierre) es obligatoria.'), { statusCode: 422 });
  if (starts_on && ends_on && ends_on < starts_on) {
    throw Object.assign(new Error('La fecha de cierre no puede ser anterior a la fecha de inicio.'), { statusCode: 422 });
  }

  const previous = actionPlan.toJSON();
  const currentMetadata = actionPlan.metadata || {};
  const currentExtensions = Array.isArray(currentMetadata.formulation_extensions) ? [...currentMetadata.formulation_extensions] : [];
  const previousDeadline = currentMetadata.formulation_ends_on || actionPlan.term?.metadata?.formulation_ends_on || null;

  currentExtensions.push({
    previous_deadline: previousDeadline,
    new_deadline: ends_on,
    starts_on: starts_on || currentMetadata.formulation_starts_on || actionPlan.term?.metadata?.formulation_starts_on || `${actionPlan.term?.year}-01-01`,
    reason: reason || 'Ampliación / ajuste de plazo de formulación autorizado por Planeación y Efectividad',
    granted_by: req.user.id,
    granted_by_name: req.user.nombre || req.user.username || 'Planeación',
    granted_at: new Date().toISOString()
  });

  const updatedMetadata = {
    ...currentMetadata,
    formulation_starts_on: starts_on || currentMetadata.formulation_starts_on || actionPlan.term?.metadata?.formulation_starts_on || `${actionPlan.term?.year}-01-01`,
    formulation_ends_on: ends_on,
    formulation_extensions: currentExtensions,
    last_extension_at: new Date().toISOString(),
    last_extension_by: req.user.id
  };

  await actionPlan.update({
    metadata: updatedMetadata,
    updated_by: req.user.id
  });

  await audit(req, 'action_plan.stage1_timeline', 'action_plan', actionPlan.id, previous, actionPlan.toJSON(), reason || `Plazo de formulación ajustado hasta ${ends_on}`);
  await refreshActionRepository(actionPlan.term_id, req, 'action_plan_timeline_updated');

  ok(res, {
    actionPlanId: actionPlan.id,
    formulation_starts_on: updatedMetadata.formulation_starts_on,
    formulation_ends_on: updatedMetadata.formulation_ends_on,
    formulation_extensions: updatedMetadata.formulation_extensions,
    metadata: updatedMetadata
  }, `Plazo de formulación actualizado con éxito. Vence el ${ends_on}.`);
});

const addActionItem = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  await ensureCanModifyActionPlanItems(actionPlan, req);
  await ensureActionPlanSchemaSnapshot(actionPlan);
  const item = await saveActionItem({ req, actionPlan, payload: req.body });
  await refreshActionRepository(actionPlan.term_id, req, 'activity_created');
  syncSinglePlanOfficialWorkbook(actionPlan.id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));

  // Si el plan ya está en ejecución (active o monitoring), notificar al responsable
  if (['active', 'monitoring'].includes(actionPlan.status)) {
    const currentCustom = item.custom_values && typeof item.custom_values === 'object' ? item.custom_values : {};
    await item.update({
      custom_values: {
        ...currentCustom,
        execution_addition: true,
        leader_review_status: 'pending',
        added_in_execution_at: new Date().toISOString()
      }
    });

    if (actionPlan.responsible_user_id) {
      const fullPlan = await StrategicActionPlan.findByPk(actionPlan.id, {
        include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }, { model: User, as: 'responsibleUser' }]
      });
      const orgUnit = fullPlan?.organizationalUnit?.name || 'Dependencia';
      await StrategicNotification.create({
        user_id: actionPlan.responsible_user_id,
        action_plan_id: actionPlan.id,
        type: 'action_plan_activity_added',
        title: `Nueva actividad agregada en ejecución: ${actionPlan.code}`,
        message: `Planeación y Efectividad incorporó la actividad ${item.code} ("${item.activity}"). Ingrese a verificar, dar retroalimentación o aceptar su ejecución.`,
        link: '/plan-accion-consulta',
        metadata: {
          action_plan_code: actionPlan.code,
          item_code: item.code,
          activity: item.activity,
          dependency: orgUnit
        }
      });

      if (fullPlan?.responsibleUser?.email) {
        const baseUrl = signingFrontendOrigin(req).replace(/\/$/, '');
        const consultationUrl = `${baseUrl}/plan-accion-consulta`;
        const emailSubject = `[NUEVA ACTIVIDAD EN EJECUCIÓN] ${actionPlan.code} - ${orgUnit}`;
        const introHtml = `
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#2563eb;">NUEVA ACTIVIDAD INCORPORADA EN EJECUCIÓN</p>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado(a) <strong>${escapeHtml(fullPlan.responsibleUser.nombre || 'Líder')}</strong>,</p>
          <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">La <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> (desde el componente de <strong>Planeación y Efectividad</strong>) le informa que se ha incorporado una nueva actividad al <strong>Plan de Acción ${escapeHtml(actionPlan.code)}</strong> (${escapeHtml(orgUnit)}) que se encuentra actualmente en ejecución.</p>
        `;
        const bodyHtml = `
          <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
              <tr><td style="padding:4px 0;width:140px;color:#64748b;"><strong>Código:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(item.code)}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Actividad:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(item.activity)}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Indicador:</strong></td><td style="padding:4px 0;">${escapeHtml(item.indicator || 'N/A')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Meta:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(String(item.target || '1'))}</td></tr>
            </table>
          </div>
          <p style="margin:16px 0;font-size:13px;color:#475569;">Puede ingresar a consultar el plan para dar retroalimentación sobre la actividad o aceptar formalmente su ejecución.</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(consultationUrl)}" style="display:inline-block;padding:13px 26px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">Ingresar a Revisar Actividad</a>
          </div>
        `;
        const html = renderInstitutionalTemplate({
          title: `Nueva Actividad · ${actionPlan.code}`,
          introHtml,
          bodyHtml
        });
        sendStrategicPlanningEmail({
          to: fullPlan.responsibleUser.email,
          subject: emailSubject,
          text: `Nueva actividad agregada en ejecución al plan ${actionPlan.code}: ${item.activity}. Ingrese a ${consultationUrl}`,
          html
        }).catch((err) => console.warn('Error enviando correo de nueva actividad en ejecución:', err.message));
      }
    }
  }

  res.status(201); ok(res, item);
});

const reviewExecutionActionItem = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  if (!item || String(item.action_plan_id) !== String(req.params.id)) {
    throw Object.assign(new Error('Actividad no encontrada.'), { statusCode: 404 });
  }
  const actionPlan = await StrategicActionPlan.findByPk(item.action_plan_id, {
    include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }]
  });
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });

  const isLeader = String(actionPlan.responsible_user_id) === String(req.user.id);
  const isPlanning = ['administrador', 'planeacion_efectividad', 'planeacion_estrategica'].includes(req.user.role);
  if (!isLeader && !isPlanning) {
    throw Object.assign(new Error('No tiene permisos para retroalimentar esta actividad.'), { statusCode: 403 });
  }

  const { decision, comment } = req.body;
  const currentCustom = item.custom_values && typeof item.custom_values === 'object' ? item.custom_values : {};
  const history = Array.isArray(currentCustom.leader_reviews_history) ? [...currentCustom.leader_reviews_history] : [];
  const reviewEntry = {
    decision: decision === 'accepted' ? 'accepted' : 'feedback',
    comment: String(comment || '').trim(),
    reviewed_by: req.user.id,
    reviewed_by_name: req.user.nombre || req.user.username || 'Líder',
    reviewed_at: new Date().toISOString()
  };
  history.push(reviewEntry);

  await item.update({
    custom_values: {
      ...currentCustom,
      leader_review_status: decision === 'accepted' ? 'accepted' : 'feedback',
      last_leader_review: reviewEntry,
      leader_reviews_history: history
    },
    updated_by: req.user.id
  });

  const orgUnit = actionPlan.organizationalUnit?.name || 'Dependencia';
  const reviewerName = req.user.nombre || req.user.username || 'Líder';

  if (decision === 'accepted') {
    await notifyPlanningUsers({
      actionPlanId: actionPlan.id,
      type: 'activity_accepted',
      title: `Actividad Aceptada en Ejecución: ${item.code}`,
      message: `${reviewerName} (${orgUnit}) ha aceptado la ejecución de la actividad ${item.code}: "${item.activity}".`,
      link: `/planeacion-estrategica/planes-accion/${actionPlan.id}`,
      metadata: {
        action_plan_code: actionPlan.code,
        item_code: item.code,
        dependency: orgUnit
      },
      excludeUserId: req.user.id
    });
  } else {
    await notifyPlanningUsers({
      actionPlanId: actionPlan.id,
      type: 'activity_feedback',
      title: `Retroalimentación a Actividad: ${item.code}`,
      message: `${reviewerName} (${orgUnit}) retroalimentó la actividad ${item.code}: "${String(comment || '').slice(0, 120)}"`,
      link: `/planeacion-estrategica/planes-accion/${actionPlan.id}`,
      metadata: {
        action_plan_code: actionPlan.code,
        item_code: item.code,
        comment: String(comment || '').trim(),
        dependency: orgUnit
      },
      excludeUserId: req.user.id
    });
  }

  ok(res, item, decision === 'accepted' ? 'Actividad aceptada para su ejecución.' : 'Retroalimentación enviada a Planeación y Efectividad.');
});

const downloadDynamicItemTemplate = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  await ensureActionPlanSchemaSnapshot(actionPlan);
  const { buffer, code } = await buildDynamicActionItemWorkbook(req.params.id);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="PLANTILLA_DINAMICA_${cleanCode(code)}.xlsx"`);
  res.send(Buffer.from(buffer));
});

const previewDynamicItems = wrap(async (req, res) => {
  if (!req.file) throw Object.assign(new Error('Seleccione la plantilla dinámica en formato .xlsx.'), { statusCode: 422 });
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  await ensureCanModifyActionPlanItems(actionPlan, req);
  await ensureActionPlanSchemaSnapshot(actionPlan);
  ok(res, await previewDynamicActionItems({ actionPlanId: req.params.id, file: req.file, userId: req.user.id }), 'Vista previa generada. Todavía no se modificaron registros.');
});

const confirmDynamicItems = wrap(async (req, res) => {
  const importRecord = await StrategicDynamicActionItemImport.findByPk(req.params.importId);
  if (importRecord) {
    const actionPlan = await StrategicActionPlan.findByPk(importRecord.action_plan_id);
    if (actionPlan) await ensureCanModifyActionPlanItems(actionPlan, req);
  }
  const batch = await confirmDynamicActionItems({ importId: req.params.importId, req });
  await refreshActionRepository(batch.term_id, req, 'activities_imported');
  if (importRecord?.action_plan_id) {
    syncSinglePlanOfficialWorkbook(importRecord.action_plan_id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));
  }
  ok(res, batch, 'Carga masiva confirmada correctamente.');
});

const updateActionItem = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  if (!item || String(item.action_plan_id) !== String(req.params.id)) throw Object.assign(new Error('Actividad no encontrada en este Plan de Acción.'), { statusCode: 404 });
  const actionPlan = await StrategicActionPlan.findByPk(item.action_plan_id);
  await ensureCanModifyActionPlanItems(actionPlan, req);
  await ensureActionPlanSchemaSnapshot(actionPlan);
  const updated = await saveActionItem({ req, actionPlan, payload: req.body, item });
  await refreshActionRepository(actionPlan.term_id, req, 'activity_updated');
  syncSinglePlanOfficialWorkbook(actionPlan.id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));
  ok(res, updated);
});

const deleteActionItem = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  if (!item || String(item.action_plan_id) !== String(req.params.id)) throw Object.assign(new Error('Actividad no encontrada en este Plan de Acción.'), { statusCode: 404 });
  const actionPlan = await StrategicActionPlan.findByPk(item.action_plan_id, { attributes: ['term_id', 'status'] });
  if (actionPlan) await ensureCanModifyActionPlanItems(actionPlan, req);
  const previous = item.toJSON(); await item.update({ deleted_at: new Date(), status: 'deleted', updated_by: req.user.id });
  await audit(req, 'action_item.soft_delete', 'action_item', item.id, previous, item.toJSON(), req.body?.justification);
  await refreshActionRepository(actionPlan?.term_id, req, 'activity_deleted');
  if (item.action_plan_id) {
    syncSinglePlanOfficialWorkbook(item.action_plan_id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));
  }
  ok(res, null, 'Actividad eliminada lógicamente.');
});

const transitionActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const isLeader = String(actionPlan.responsible_user_id) === String(req.user.id);
  const isPlanningAdmin = ['administrador', 'planeacion_efectividad', 'planeacion_estrategica'].includes(req.user.role);
  if (!isLeader && !isPlanningAdmin) {
    throw Object.assign(new Error('No tiene permisos para modificar el estado de este Plan de Acción.'), { statusCode: 403 });
  }
  const updated = await transitionPlan({ req, actionPlan, action: req.body.action, comment: req.body.comment, metadata: req.body.metadata });

  if (req.body.action === 'request_owner_adjustments') {
    try {
      const fullPlan = await StrategicActionPlan.findByPk(actionPlan.id, {
        include: [
          { model: StrategicTerm, as: 'term' },
          { model: StrategicCatalogItem, as: 'organizationalUnit' },
          { model: User, as: 'responsibleUser' }
        ]
      });
      const orgUnitName = fullPlan?.organizationalUnit?.name || 'Dependencia';
      const leaderName = req.user.nombre || req.user.username || 'Líder de Dependencia';
      const commentText = String(req.body.comment || '').trim();
      const nowBogota = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

      // 1. Trazabilidad automática en el Acta COM-IF-FR-002
      const latestMeeting = await StrategicMeeting.findOne({
        where: { action_plan_id: actionPlan.id },
        order: [['starts_at', 'DESC'], ['created_at', 'DESC']],
        include: [{ model: StrategicMinuteVersion, as: 'minuteVersions' }]
      });
      if (latestMeeting) {
        const note = `\n\n[OBSERVACIONES DEL LÍDER - ${leaderName} - ${nowBogota}]:\n${commentText}`;
        const newDevelopment = `${latestMeeting.development || ''}${note}`.trim();
        await latestMeeting.update({ development: newDevelopment, updated_by: req.user.id });

        const latestMinute = (latestMeeting.minuteVersions || []).sort((a, b) => Number(b.version) - Number(a.version))[0];
        if (latestMinute) {
          const currentDes = Array.isArray(latestMinute.content?.desarrollo)
            ? latestMinute.content.desarrollo.join('\n\n')
            : String(latestMinute.content?.desarrollo || '');
          const updatedContent = {
            ...latestMinute.content,
            desarrollo: [`${currentDes}${note}`.trim()]
          };
          await latestMinute.update({
            content: updatedContent,
            content_hash: hashObject(updatedContent)
          });
          syncMinute(latestMinute.id, true).catch((e) => console.warn('Auto-sync minute tras ajustes:', e.message));
        }
      }

      // 2. Notificación en campana para Planeación y Efectividad
      await notifyPlanningUsers({
        actionPlanId: actionPlan.id,
        type: 'action_plan_adjustments',
        title: `Ajustes solicitados: ${actionPlan.code}`,
        message: `${leaderName} (${orgUnitName}) devolvió el plan con observaciones: "${commentText.slice(0, 120)}${commentText.length > 120 ? '...' : ''}"`,
        link: `/planeacion-estrategica/planes-accion/${actionPlan.id}`,
        metadata: {
          comment: commentText,
          requested_by_name: leaderName,
          requested_by_email: req.user.email,
          action_plan_code: actionPlan.code,
          dependency: orgUnitName
        },
        excludeUserId: req.user.id
      });

      // 3. Envío de correo a planeacionestrategica@unicesmag.edu.co
      const planningEmailSubject = `[OBSERVACIONES AL PLAN DE ACCIÓN] ${actionPlan.code} - ${orgUnitName}`;
      const baseUrl = signingFrontendOrigin(req).replace(/\/$/, '');
      const planEditorUrl = `${baseUrl}/planeacion-estrategica/planes-accion/${actionPlan.id}`;

      const introHtml = `
        <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#d97706;">PLAN DE ACCIÓN DEVUELTO CON OBSERVACIONES</p>
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado equipo de <strong>Planeación y Efectividad</strong>,</p>
        <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">El líder <strong>${escapeHtml(leaderName)}</strong> ha devuelto el <strong>Plan de Acción ${escapeHtml(actionPlan.code)}</strong> correspondiente a <strong>${escapeHtml(orgUnitName)}</strong> con solicitud de ajustes y observaciones antes de continuar con la concertación.</p>
      `;
      const bodyHtml = `
        <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
            <tr><td style="padding:4px 0;width:140px;color:#64748b;"><strong>Plan de Acción:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(actionPlan.code)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;"><strong>Dependencia:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(orgUnitName)}</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;"><strong>Líder Responsable:</strong></td><td style="padding:4px 0;">${escapeHtml(leaderName)} (${escapeHtml(req.user.email || '')})</td></tr>
            <tr><td style="padding:4px 0;color:#64748b;"><strong>Fecha de Envío:</strong></td><td style="padding:4px 0;">${escapeHtml(nowBogota)}</td></tr>
          </table>
        </div>
        <div style="margin:18px 0;padding:16px;background:#fffbeb;border:2px solid #fde68a;border-radius:10px;">
          <p style="margin:0 0 8px;font-weight:800;color:#92400e;font-size:13.5px;">📝 Observaciones y ajustes solicitados por el líder:</p>
          <div style="padding:12px;background:#ffffff;border-radius:8px;border:1px solid #fde68a;font-size:13.5px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(commentText)}</div>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(planEditorUrl)}" style="display:inline-block;padding:13px 26px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">Abrir Plan de Acción para Realizar Ajustes</a>
        </div>
        <p style="margin:0;font-size:12px;color:#64748b;text-align:center;">Estas observaciones han sido anexadas automáticamente al desarrollo del Acta de Concertación COM-IF-FR-002.</p>
      `;
      const html = renderInstitutionalTemplate({
        title: `Observaciones al Plan de Acción ${actionPlan.code}`,
        introHtml,
        bodyHtml
      });
      await sendStrategicPlanningEmail({
        to: 'planeacionestrategica@unicesmag.edu.co',
        subject: planningEmailSubject,
        text: `Plan de Acción devuelto con observaciones: ${actionPlan.code} - ${orgUnitName}.\nLíder: ${leaderName}\nObservaciones: ${commentText}\nEnlace: ${planEditorUrl}`,
        html
      });
    } catch (errAdjustments) {
      console.error('transitionActionPlan: Error en procesamiento de request_owner_adjustments:', errAdjustments);
    }
  }

  if (req.body.action === 'submit_owner_validation') {
    try {
      const fullPlan = await StrategicActionPlan.findByPk(actionPlan.id, {
        include: [
          { model: StrategicTerm, as: 'term' },
          { model: StrategicCatalogItem, as: 'organizationalUnit' },
          { model: User, as: 'responsibleUser' }
        ]
      });
      const orgUnitName = fullPlan?.organizationalUnit?.name || 'Dependencia';
      const staffName = req.user.nombre || req.user.username || 'Planeación y Efectividad';
      const commentText = String(req.body.comment || '').trim();
      const nowBogota = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

      // 1. Registrar respuesta en el desarrollo del Acta
      const latestMeeting = await StrategicMeeting.findOne({
        where: { action_plan_id: actionPlan.id },
        order: [['starts_at', 'DESC'], ['created_at', 'DESC']],
        include: [{ model: StrategicMinuteVersion, as: 'minuteVersions' }]
      });
      if (latestMeeting) {
        const respText = commentText || 'Se realizaron los ajustes solicitados y se remite nuevamente a revisión y firmas del líder.';
        const note = `\n\n[AJUSTES REALIZADOS POR PLANEACIÓN - ${staffName} - ${nowBogota}]:\n${respText}`;
        const newDevelopment = `${latestMeeting.development || ''}${note}`.trim();
        await latestMeeting.update({ development: newDevelopment, updated_by: req.user.id });

        const latestMinute = (latestMeeting.minuteVersions || []).sort((a, b) => Number(b.version) - Number(a.version))[0];
        if (latestMinute) {
          const currentDes = Array.isArray(latestMinute.content?.desarrollo)
            ? latestMinute.content.desarrollo.join('\n\n')
            : String(latestMinute.content?.desarrollo || '');
          const updatedContent = {
            ...latestMinute.content,
            desarrollo: [`${currentDes}${note}`.trim()]
          };
          await latestMinute.update({
            content: updatedContent,
            content_hash: hashObject(updatedContent)
          });
          syncMinute(latestMinute.id, true).catch((e) => console.warn('Auto-sync minute tras respuesta de planeación:', e.message));
        }
      }

      // Sincronizar automáticamente el Excel oficial DIR-PE-FR-003 con Google Drive
      syncSinglePlanOfficialWorkbook(actionPlan.id).catch((err) => console.warn('[Drive Auto-sync DIR-PE-FR-003 warning]:', err.message));

      // 2. Notificación en campana para el líder responsable
      if (actionPlan.responsible_user_id) {
        await StrategicNotification.create({
          user_id: actionPlan.responsible_user_id,
          action_plan_id: actionPlan.id,
          type: 'action_plan_review_submitted',
          title: `Plan de Acción Ajustado: ${actionPlan.code}`,
          message: `Se ajustó para su revisión. Por favor ingrese a verificar el plan y concertar el acta.`,
          link: `/plan-accion-consulta`,
          metadata: {
            action_plan_code: actionPlan.code,
            dependency: orgUnitName,
            comment: commentText
          }
        });
      }

      // 3. Envío de correo electrónico al Líder
      if (fullPlan?.responsibleUser?.email) {
        const baseUrl = signingFrontendOrigin(req).replace(/\/$/, '');
        const consultationUrl = `${baseUrl}/plan-accion-consulta`;
        const respEmailSubject = `Plan de Acción Ajustado para su Revisión - ${actionPlan.code} (${orgUnitName})`;

        const staffName = req.user.nombre || req.user.username || 'Luisa Fernanda Ortega Muñoz';
        const staffCargo = req.user.cargo || 'Analista de Planeación';
        const staffDep = req.user.dependencia || 'Dirección de Planeación y Aseguramiento de la Calidad';

        const introHtml = `
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#2563eb;">PLAN DE ACCIÓN AJUSTADO PARA SU REVISIÓN</p>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado(a) <strong>${escapeHtml(fullPlan.responsibleUser.nombre || 'Líder')}</strong>,</p>
          <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">La <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> (desde el componente de <strong>Planeación y Efectividad</strong>) le informa que su <strong>Plan de Acción ${escapeHtml(actionPlan.code)}</strong> (${escapeHtml(orgUnitName)}) ha sido ajustado y se encuentra listo para su revisión y concertación.</p>
        `;
        const bodyHtml = `
          <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
              <tr><td style="padding:4px 0;width:140px;color:#64748b;"><strong>Plan de Acción:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(actionPlan.code)}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Dependencia:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(orgUnitName)}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Estado en el flujo:</strong></td><td style="padding:4px 0;font-weight:700;color:#2563eb;">En revisión del Líder / Firmas</td></tr>
            </table>
          </div>
          <div style="margin:18px 0;padding:16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;color:#1e40af;font-size:13.5px;">
            <p style="margin:0 0 6px;font-weight:800;">✓ Se ajustó para su revisión</p>
            <p style="margin:0;line-height:1.5;">${escapeHtml(commentText || 'Los cambios y precisiones solicitadas fueron aplicados en el Plan de Acción y en el Acta COM-IF-FR-002.')}</p>
          </div>
          <div style="text-align:center;margin:24px 0;">
            <a href="${escapeHtml(consultationUrl)}" style="display:inline-block;padding:13px 26px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">Ingresar a Revisar Plan de Acción</a>
          </div>
          <div style="margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12.5px;color:#475569;">
            <p style="margin:0;font-weight:800;color:#0f172a;">${escapeHtml(staffName)}</p>
            <p style="margin:2px 0 0;color:#64748b;">${escapeHtml(staffCargo)} · Componente de Planeación y Efectividad</p>
            <p style="margin:2px 0 0;color:#64748b;">${escapeHtml(staffDep)} - UNICESMAG</p>
          </div>
        `;
        const html = renderInstitutionalTemplate({
          title: `Plan de Acción Ajustado · ${actionPlan.code}`,
          introHtml,
          bodyHtml
        });
        await sendStrategicPlanningEmail({
          to: fullPlan.responsibleUser.email,
          subject: respEmailSubject,
          text: `Estimado(a) ${fullPlan.responsibleUser.nombre}, su Plan de Acción ${actionPlan.code} ha sido ajustado para su revisión. Ingrese a: ${consultationUrl}`,
          html
        });
      }
    } catch (errSubmitValidation) {
      console.error('transitionActionPlan: Error en submit_owner_validation:', errSubmitValidation);
    }
  }

  if (updated.status === 'active') {
    await refreshActionRepository(updated.term_id, req, 'plan_activated');
    try {
      // 1. Cargar el plan completo con actividades, seguimientos y vigencia
      const fullPlan = await StrategicActionPlan.findByPk(actionPlan.id, {
        include: [
          { model: StrategicTerm, as: 'term', include: [{ model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }] },
          { model: StrategicCatalogItem, as: 'organizationalUnit' },
          {
            model: StrategicActionItem, as: 'items',
            where: { deleted_at: null }, required: false,
            include: [{
              model: StrategicMonitoringResult, as: 'monitoringResults', required: false,
              include: [{ model: StrategicMonitoringPeriod, as: 'period' }]
            }]
          }
        ]
      });

      // 2. Obtener la última reunión y versión del acta
      const latestMeeting = await StrategicMeeting.findOne({
        where: { action_plan_id: actionPlan.id },
        order: [['starts_at', 'DESC'], ['created_at', 'DESC']],
        include: [{ model: StrategicMinuteVersion, as: 'minuteVersions' }]
      });
      const latestMinute = (latestMeeting?.minuteVersions || []).sort((a, b) => Number(b.version) - Number(a.version))[0] || null;

      // Si el acta estaba en firmas o revisión, formalizarla al activar la ejecución
      if (latestMinute && latestMinute.status !== 'finalized') {
        await latestMinute.update({
          status: 'finalized',
          finalized_at: new Date(),
          finalized_by: req.user.id
        });
        if (latestMeeting && latestMeeting.status !== 'formalized') {
          await latestMeeting.update({ status: 'formalized' });
        }
      }

      // 3. Generar el PDF del Acta COM-IF-FR-002
      let minutePdfBuffer = null;
      if (latestMinute) {
        try {
          minutePdfBuffer = await ensureMinuteFinalPdfBuffer(latestMinute);
        } catch (errMinute) {
          console.warn('transitionActionPlan: No se pudo generar PDF del acta:', errMinute.message);
        }
      }

      // 4. Generar el archivo de Excel oficial DIR-PE-FR-003
      let excelBuffer = null;
      try {
        const activities = (fullPlan?.items || []).map((item) => {
          const sorted = [...(item.monitoringResults || [])].sort((a, b) => (a.period?.position || 0) - (b.period?.position || 0));
          return {
            objetivo_estrategico: item.custom_values?.strategic_objective || '',
            lineamiento_estrategico: item.custom_values?.guideline || '',
            actividad: item.activity,
            tipo_indicador: item.indicator_type,
            fecha_inicio: item.starts_on,
            fecha_fin: item.ends_on,
            indicador: item.indicator,
            meta: item.target,
            responsable: fullPlan?.organizationalUnit?.name,
            corresponsable: (item.co_responsibles || []).join(', '),
            avance_ip: sorted[0]?.physical_progress,
            observaciones_ip: sorted[0]?.observations,
            avance_iip: sorted[1]?.physical_progress,
            observaciones_iip: sorted[1]?.observations
          };
        });
        excelBuffer = await generatePlanAccionBuffer({
          planData: { anio: fullPlan?.term?.year, codigoPlan: fullPlan?.code, responsable: fullPlan?.organizationalUnit?.name },
          actividades: activities,
          corresponsabilidades: []
        });
      } catch (errExcel) {
        console.warn('transitionActionPlan: No se pudo generar Excel del plan:', errExcel.message);
      }

      // 5. Preparar adjuntos para los correos institucionales
      const attachments = [];
      if (minutePdfBuffer) {
        attachments.push({
          filename: `Acta_COM-IF-FR-002_${actionPlan.code}.pdf`,
          content: minutePdfBuffer,
          contentType: 'application/pdf'
        });
      }
      if (excelBuffer) {
        attachments.push({
          filename: `DIR-PE-FR-003_${actionPlan.code}_${fullPlan?.term?.year || ''}.xlsx`,
          content: excelBuffer,
          contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
      }

      // 6. Obtener correo de Rectoría
      const rectorUser = await User.findOne({
        where: {
          [Op.or]: [
            { cargo: { [Op.iLike]: '%rector%' } },
            { email: { [Op.iLike]: '%rectoria%' } }
          ],
          estado: 'activo'
        }
      });
      const rectorEmail = process.env.RECTORIA_EMAIL || rectorUser?.email || 'rectoria@unicesmag.edu.co';

      // 7. Obtener usuario responsable
      const responsibleUser = actionPlan.responsible_user_id
        ? await User.findByPk(actionPlan.responsible_user_id)
        : null;

      // 8. Envío de correo a Rectoría con Acta y Excel
      if (rectorEmail) {
        const rectorIntro = `
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#1e3a8a;">NOTIFICACIÓN A RECTORÍA · PLAN DE ACCIÓN APROBADO</p>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado(a) Señor(a) Rector(a),</p>
          <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">La <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> (desde el componente de <strong>Planeación y Efectividad</strong>) se complace en informarle que se ha formalizado y aprobado el <strong>Plan de Acción Institucional</strong> para su inicio de ejecución oficial.</p>
        `;
        const rectorBody = `
          <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
              <tr><td style="padding:4px 0;width:140px;color:#64748b;"><strong>Plan de Acción:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(actionPlan.code)}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Dependencia:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(fullPlan?.organizationalUnit?.name || 'Dependencia')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Vigencia:</strong></td><td style="padding:4px 0;">${escapeHtml(String(fullPlan?.term?.year || ''))}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Responsable:</strong></td><td style="padding:4px 0;">${escapeHtml(responsibleUser?.nombre || 'No asignado')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Actividades:</strong></td><td style="padding:4px 0;">${fullPlan?.items?.length || 0} actividades concertadas</td></tr>
            </table>
          </div>
          <div style="margin:18px 0;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#166534;font-size:13px;">
            <p style="margin:0 0 4px;font-weight:800;">✓ Documentación institucional adjunta</p>
            <p style="margin:0;line-height:1.5;">Se adjuntan al presente correo el <strong>Acta de Concertación COM-IF-FR-002</strong> debidamente firmada y el formato oficial del <strong>Plan de Acción DIR-PE-FR-003 en Excel</strong> para su conocimiento y control institucional.</p>
          </div>
        `;
        const rectorHtml = renderInstitutionalTemplate({
          title: `Plan de Acción Aprobado e Inicio de Ejecución · ${actionPlan.code}`,
          introHtml: rectorIntro,
          bodyHtml: rectorBody
        });
        await sendStrategicPlanningEmail({
          to: rectorEmail,
          subject: `Plan de Acción Aprobado e Inicio de Ejecución - ${actionPlan.code} (${fullPlan?.organizationalUnit?.name || ''})`,
          text: `Estimado(a) Rector(a), se ha aprobado e iniciado la ejecución oficial del Plan de Acción ${actionPlan.code} para ${fullPlan?.organizationalUnit?.name}. Se adjuntan Acta COM-IF-FR-002 y formato Excel DIR-PE-FR-003.`,
          html: rectorHtml,
          attachments
        });
      }

      // 9. Envío de correo al Responsable / Líder de Proceso con Acta y Excel
      if (responsibleUser?.email) {
        const respIntro = `
          <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#15803d;">PLAN DE ACCIÓN APROBADO · INICIO DE EJECUCIÓN OFICIAL</p>
          <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado(a) <strong>${escapeHtml(responsibleUser.nombre || 'Líder')}</strong>,</p>
          <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">La <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> (desde el componente de <strong>Planeación y Efectividad</strong>) le informa que su <strong>Plan de Acción ${escapeHtml(actionPlan.code)}</strong> ha sido aprobado formalmente y ha pasado a la fase de <strong>Ejecución Oficial</strong>.</p>
        `;
        const respBody = `
          <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
            <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
              <tr><td style="padding:4px 0;width:140px;color:#64748b;"><strong>Plan de Acción:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(actionPlan.code)}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Dependencia:</strong></td><td style="padding:4px 0;font-weight:700;">${escapeHtml(fullPlan?.organizationalUnit?.name || 'Dependencia')}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Vigencia:</strong></td><td style="padding:4px 0;">${escapeHtml(String(fullPlan?.term?.year || ''))}</td></tr>
              <tr><td style="padding:4px 0;color:#64748b;"><strong>Actividades a cumplir:</strong></td><td style="padding:4px 0;">${fullPlan?.items?.length || 0} actividades</td></tr>
            </table>
          </div>
          <div style="margin:18px 0;padding:14px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;color:#1e40af;font-size:13px;">
            <p style="margin:0 0 6px;font-weight:800;">✓ Módulo Plan de Acción habilitado para la vigencia</p>
            <p style="margin:0;line-height:1.5;">El plan permanecerá activo en su plataforma durante todo el periodo de ejecución configurado para que reporte avances semestrales y cargue las evidencias correspondientes. Al finalizar la vigencia y concluir el cierre del plan, el ciclo finalizará formalmente.</p>
          </div>
          <div style="margin:14px 0;padding:14px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;color:#166534;font-size:13px;">
            <p style="margin:0;">Se adjuntan al presente correo el <strong>Acta de Concertación COM-IF-FR-002</strong> debidamente firmada y el formato oficial en <strong>Excel DIR-PE-FR-003</strong> como constancia institucional.</p>
          </div>
        `;
        const respHtml = renderInstitutionalTemplate({
          title: `Plan de Acción Aprobado · Inicio de Ejecución Oficial · ${actionPlan.code}`,
          introHtml: respIntro,
          bodyHtml: respBody
        });
        await sendStrategicPlanningEmail({
          to: responsibleUser.email,
          subject: `Plan de Acción Aprobado - Inicio de Ejecución Oficial (${actionPlan.code})`,
          text: `Estimado(a) ${responsibleUser.nombre}, su Plan de Acción ${actionPlan.code} ha sido aprobado e inicia su fase de Ejecución Oficial. Se adjuntan Acta COM-IF-FR-002 y formato Excel DIR-PE-FR-003.`,
          html: respHtml,
          attachments
        });
      }

      await audit(req, 'action_plan.activation_emails', 'action_plan', actionPlan.id, null, {
        rector_email: rectorEmail,
        responsible_email: responsibleUser?.email || null,
        attachments_count: attachments.length
      }, 'Correos de activación enviados a Rectoría y Responsable con Acta PDF y Excel');

      if (actionPlan.responsible_user_id) {
        await StrategicNotification.create({
          user_id: actionPlan.responsible_user_id,
          action_plan_id: actionPlan.id,
          type: 'action_plan_activated',
          title: `¡Plan de Acción en Ejecución Oficial!`,
          message: `El Plan de Acción ${actionPlan.code} (${fullPlan?.organizationalUnit?.name || ''}) se encuentra formalizado en ejecución oficial.`,
          link: `/plan-accion-consulta`,
          metadata: { action_plan_code: actionPlan.code }
        }).catch((e) => console.warn('No se pudo crear StrategicNotification de activación para líder:', e.message));
      }

      await notifyPlanningUsers({
        actionPlanId: actionPlan.id,
        type: 'action_plan_activated',
        title: `Plan en Ejecución Oficial: ${actionPlan.code}`,
        message: `El Plan de Acción ${actionPlan.code} (${fullPlan?.organizationalUnit?.name || ''}) fue aprobado e inicia su fase de Ejecución Oficial.`,
        link: `/planeacion-estrategica/planes-accion/${actionPlan.id}`,
        metadata: { action_plan_code: actionPlan.code },
        excludeUserId: req.user.id
      });
    } catch (errActivationNotify) {
      console.error('transitionActionPlan: Error en notificación de activación:', errActivationNotify);
    }
  }
  syncSinglePlanOfficialWorkbook(actionPlan.id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));
  ok(res, updated, 'Transición registrada.');
});

const sendActionPlanChatMessage = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      { model: StrategicTerm, as: 'term' },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: User, as: 'responsibleUser' }
    ]
  });
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });

  const messageText = String(req.body.message || '').trim();
  if (!messageText) {
    throw Object.assign(new Error('El mensaje no puede estar vacío.'), { statusCode: 422 });
  }

  const isPlanningAdmin = ['administrador', 'planeacion_estrategica', 'planeacion_efectividad'].includes(req.user.role);
  const isLeader = String(actionPlan.responsible_user_id) === String(req.user.id);
  if (!isLeader && !isPlanningAdmin) {
    throw Object.assign(new Error('No tiene permisos para participar en este canal de retroalimentación.'), { statusCode: 403 });
  }

  const senderType = isPlanningAdmin ? 'planning' : 'leader';
  const senderName = req.user.nombre || req.user.username || (isPlanningAdmin ? 'LUISA FERNANDA ORTEGA MUÑOZ' : 'Líder de Dependencia');
  const senderCargo = req.user.cargo || (isPlanningAdmin ? 'Analista de Planeación' : 'Líder Responsable');
  const senderDep = isPlanningAdmin
    ? 'Dirección de Planeación y Aseguramiento de la Calidad'
    : (req.user.dependencia || actionPlan.organizationalUnit?.name || 'Dependencia');
  const senderEmail = req.user.email || '';
  const nowIso = new Date().toISOString();
  const nowBogota = new Date().toLocaleString('es-CO', { timeZone: 'America/Bogota' });

  const newMessage = {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    sender_type: senderType,
    sender_id: req.user.id,
    sender_name: senderName,
    sender_cargo: senderCargo,
    sender_dependencia: senderDep,
    sender_email: senderEmail,
    message: messageText,
    created_at: nowIso
  };

  const currentMeta = { ...(actionPlan.metadata || {}) };
  const existingThread = Array.isArray(currentMeta.chat_thread) ? [...currentMeta.chat_thread] : [];

  if (existingThread.length === 0) {
    if (currentMeta.last_adjustment_request) {
      existingThread.push({
        id: 'adj-legacy',
        sender_type: 'leader',
        sender_id: currentMeta.last_adjustment_request.requested_by,
        sender_name: currentMeta.last_adjustment_request.requested_by_name || 'Líder de Dependencia',
        sender_cargo: 'Líder Responsable',
        sender_dependencia: actionPlan.organizationalUnit?.name || 'Dependencia',
        sender_email: currentMeta.last_adjustment_request.requested_by_email || '',
        message: currentMeta.last_adjustment_request.comment,
        created_at: currentMeta.last_adjustment_request.requested_at || nowIso
      });
    }
    if (Array.isArray(currentMeta.planning_responses_history)) {
      currentMeta.planning_responses_history.forEach((resp, idx) => {
        existingThread.push({
          id: `resp-legacy-${idx}`,
          sender_type: 'planning',
          sender_id: resp.responded_by,
          sender_name: resp.responded_by_name || 'LUISA FERNANDA ORTEGA MUÑOZ',
          sender_cargo: resp.responded_by_cargo || 'Analista de Planeación',
          sender_dependencia: resp.responded_by_dependencia || 'Dirección de Planeación y Aseguramiento de la Calidad',
          sender_email: 'lfortega@unicesmag.edu.co',
          message: resp.comment,
          created_at: resp.responded_at || nowIso
        });
      });
    }
  }

  existingThread.push(newMessage);
  currentMeta.chat_thread = existingThread;

  if (senderType === 'planning') {
    currentMeta.last_planning_response = {
      comment: messageText,
      responded_by: req.user.id,
      responded_by_name: senderName,
      responded_by_cargo: senderCargo,
      responded_by_dependencia: senderDep,
      responded_at: nowIso
    };
    currentMeta.planning_responses_history = [
      ...(Array.isArray(currentMeta.planning_responses_history) ? currentMeta.planning_responses_history : []),
      currentMeta.last_planning_response
    ];
  } else {
    currentMeta.last_adjustment_request = {
      comment: messageText,
      requested_by: req.user.id,
      requested_by_name: senderName,
      requested_by_email: senderEmail,
      requested_at: nowIso
    };
    currentMeta.adjustments_history = [
      ...(Array.isArray(currentMeta.adjustments_history) ? currentMeta.adjustments_history : []),
      currentMeta.last_adjustment_request
    ];
  }

  await actionPlan.update({ metadata: currentMeta, updated_by: req.user.id });

  if (req.body.submitValidation && actionPlan.status === 'adjustments') {
    try {
      await transitionPlan({ req, actionPlan, action: 'submit_owner_validation', comment: messageText });
    } catch (eTrans) {
      console.warn('sendActionPlanChatMessage: auto-transition submit_owner_validation:', eTrans.message);
    }
  }

  const latestMeeting = await StrategicMeeting.findOne({
    where: { action_plan_id: actionPlan.id },
    order: [['starts_at', 'DESC'], ['created_at', 'DESC']],
    include: [{ model: StrategicMinuteVersion, as: 'minuteVersions' }]
  });
  if (latestMeeting) {
    const prefix = senderType === 'planning'
      ? `[RETROALIMENTACIÓN DE PLANEACIÓN Y EFECTIVIDAD - ${senderName} - ${nowBogota}]:`
      : `[OBSERVACIÓN DEL LÍDER - ${senderName} - ${nowBogota}]:`;
    const note = `\n\n${prefix}\n${messageText}`;
    const newDevelopment = `${latestMeeting.development || ''}${note}`.trim();
    await latestMeeting.update({ development: newDevelopment, updated_by: req.user.id });

    const latestMinute = (latestMeeting.minuteVersions || []).sort((a, b) => Number(b.version) - Number(a.version))[0];
    if (latestMinute) {
      const currentDes = Array.isArray(latestMinute.content?.desarrollo)
        ? latestMinute.content.desarrollo.join('\n\n')
        : String(latestMinute.content?.desarrollo || '');
      const updatedContent = {
        ...latestMinute.content,
        desarrollo: [`${currentDes}${note}`.trim()]
      };
      await latestMinute.update({
        content: updatedContent,
        content_hash: hashObject(updatedContent)
      });
      syncMinute(latestMinute.id, true).catch((e) => console.warn('Auto-sync minute chat message:', e.message));
    }
  }

  const baseUrl = signingFrontendOrigin(req).replace(/\/$/, '');
  const orgUnitName = actionPlan.organizationalUnit?.name || 'Dependencia';

  if (senderType === 'planning') {
    if (actionPlan.responsible_user_id && String(actionPlan.responsible_user_id) !== String(req.user.id)) {
      await StrategicNotification.create({
        user_id: actionPlan.responsible_user_id,
        action_plan_id: actionPlan.id,
        type: 'action_plan_chat_message',
        title: 'Mensaje de Planeación y Aseguramiento de la Calidad',
        message: `${senderName}: ${messageText.slice(0, 95)}${messageText.length > 95 ? '...' : ''}`,
        link: '/plan-accion-consulta',
        metadata: {
          action_plan_code: actionPlan.code,
          dependency: orgUnitName,
          sender_name: senderName
        }
      }).catch((e) => console.warn('Error creando StrategicNotification para líder:', e.message));
    }

    if (actionPlan.responsibleUser?.email) {
      const consultationUrl = `${baseUrl}/plan-accion-consulta`;
      const emailSubject = `[MENSAJE DE PLANEACIÓN Y CALIDAD] Plan de Acción ${actionPlan.code} - ${orgUnitName}`;
      const introHtml = `
        <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#008069;">CANAL INSTITUCIONAL DE RETROALIMENTACIÓN Y AJUSTES</p>
        <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado(a) <strong>${escapeHtml(actionPlan.responsibleUser.nombre || 'Líder')}</strong>,</p>
        <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">La <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> (desde el componente de <strong>Planeación y Efectividad</strong>) le ha enviado un mensaje respecto a su <strong>Plan de Acción ${escapeHtml(actionPlan.code)}</strong> (${escapeHtml(orgUnitName)}):</p>
      `;
      const bodyHtml = `
        <div style="margin:16px 0;padding:16px;background:#dcfce7;border:2px solid #86efac;border-radius:12px;">
          <div style="margin-bottom:8px;">
            <strong style="color:#065f46;font-size:13.5px;">💬 Mensaje de ${escapeHtml(senderName)}:</strong>
            <span style="font-size:12px;color:#047857;margin-left:6px;">(${escapeHtml(senderCargo)})</span>
          </div>
          <div style="padding:14px;background:#ffffff;border-radius:8px;border:1px solid #bbf7d0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(messageText)}</div>
        </div>
        <div style="text-align:center;margin:24px 0;">
          <a href="${escapeHtml(consultationUrl)}" style="display:inline-block;padding:13px 26px;background:#008069;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">Ingresar al Plan de Acción y Responder</a>
        </div>
        <div style="margin-top:22px;padding-top:14px;border-top:1px solid #e2e8f0;font-size:12.5px;color:#475569;">
          <p style="margin:0;font-weight:800;color:#0f172a;">${escapeHtml(senderName)}</p>
          <p style="margin:2px 0 0;color:#64748b;">${escapeHtml(senderCargo)} · Componente de Planeación y Efectividad</p>
          <p style="margin:2px 0 0;color:#64748b;">${escapeHtml(senderDep)} - UNICESMAG</p>
        </div>
      `;
      const html = renderInstitutionalTemplate({
        title: `Mensaje de Planeación y Aseguramiento de la Calidad · ${actionPlan.code}`,
        introHtml,
        bodyHtml
      });
      sendStrategicPlanningEmail({
        to: actionPlan.responsibleUser.email,
        subject: emailSubject,
        text: `Nuevo mensaje de Planeación y Calidad (${senderName}):\n\n${messageText}\n\nIngresar a: ${consultationUrl}`,
        html
      }).catch((e) => console.warn('Error enviando correo de chat al líder:', e.message));
    }
  } else {
    await notifyPlanningUsers({
      actionPlanId: actionPlan.id,
      type: 'action_plan_chat_message',
      title: `Mensaje del Líder (${actionPlan.code})`,
      message: `${senderName}: ${messageText.slice(0, 95)}${messageText.length > 95 ? '...' : ''}`,
      link: `/planeacion-estrategica/planes-accion/${actionPlan.id}`,
      metadata: {
        action_plan_code: actionPlan.code,
        dependency: orgUnitName,
        sender_name: senderName
      },
      excludeUserId: req.user.id
    });

    const planEditorUrl = `${baseUrl}/planeacion-estrategica/planes-accion/${actionPlan.id}`;
    const emailSubject = `[CHAT PLAN DE ACCIÓN] Nuevo mensaje de ${senderName} (${orgUnitName}) - ${actionPlan.code}`;
    const introHtml = `
      <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#d97706;">MENSAJE RECIBIDO DEL LÍDER DE DEPENDENCIA</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">Estimado equipo de la <strong>Dirección de Planeación y Aseguramiento de la Calidad</strong> (Planeación y Efectividad),</p>
      <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">El líder <strong>${escapeHtml(senderName)}</strong> ha enviado un nuevo mensaje en el canal de retroalimentación de su <strong>Plan de Acción ${escapeHtml(actionPlan.code)}</strong> (${escapeHtml(orgUnitName)}):</p>
    `;
    const bodyHtml = `
      <div style="margin:16px 0;padding:16px;background:#fffbeb;border:2px solid #fde68a;border-radius:12px;">
        <div style="margin-bottom:8px;">
          <strong style="color:#92400e;font-size:13.5px;">💬 Mensaje de ${escapeHtml(senderName)}:</strong>
          <span style="font-size:12px;color:#b45309;margin-left:6px;">(${escapeHtml(senderCargo)})</span>
        </div>
        <div style="padding:14px;background:#ffffff;border-radius:8px;border:1px solid #fde68a;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(messageText)}</div>
      </div>
      <div style="text-align:center;margin:24px 0;">
        <a href="${escapeHtml(planEditorUrl)}" style="display:inline-block;padding:13px 26px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">Abrir Chat en el Plan de Acción</a>
      </div>
    `;
    const html = renderInstitutionalTemplate({
      title: `Mensaje del Líder · ${actionPlan.code}`,
      introHtml,
      bodyHtml
    });
    sendStrategicPlanningEmail({
      to: ['planeacionestrategica@unicesmag.edu.co', 'lfortega@unicesmag.edu.co'],
      subject: emailSubject,
      text: `Nuevo mensaje de ${senderName} (${orgUnitName}) en el plan ${actionPlan.code}:\n\n${messageText}\n\nIngresar a: ${planEditorUrl}`,
      html
    }).catch((e) => console.warn('Error enviando correo de chat a planeación:', e.message));
  }

  const updatedPlan = await StrategicActionPlan.findByPk(actionPlan.id, {
    include: [
      { model: StrategicTerm, as: 'term' },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: User, as: 'responsibleUser' }
    ]
  });

  res.status(201);
  ok(res, {
    message: newMessage,
    chat_thread: currentMeta.chat_thread,
    actionPlan: updatedPlan
  }, 'Mensaje enviado y notificado por correo institucional.');
});

const saveMonitoring = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId);
  const period = await StrategicMonitoringPeriod.findByPk(req.params.periodId);
  if (!item || !period) throw Object.assign(new Error('Actividad o periodo no encontrado.'), { statusCode: 404 });
  const result = await upsertMonitoring({ req, actionItem: item, periodId: period.id, payload: req.body });
  await refreshActionRepository(period.term_id, req, 'monitoring_updated');
  ok(res, result, 'Seguimiento guardado.');
});

const createMeeting = wrap(async (req, res) => {
  const meeting = await sequelize.transaction(async (transaction) => {
    const row = await StrategicMeeting.create({ action_plan_id: req.params.id, monitoring_period_id: req.body.monitoring_period_id || null, title: req.body.title || null, type: req.body.type || 'formulation', starts_at: req.body.starts_at, ends_at: req.body.ends_at || null, location: req.body.location || null, modality: req.body.modality || null, objective: req.body.objective, development: req.body.development || null, commitments: req.body.commitments || [], created_by: req.user.id, updated_by: req.user.id }, { transaction });
    const allowedMeetingRoles = new Set(['principal', 'co_responsible', 'collaborator', 'participant']);
    let requestedParticipants = req.body.participants || [];
    if (!requestedParticipants.length) {
      const plan = await StrategicActionPlan.findByPk(req.params.id, {
        include: [{ model: StrategicResponsibility, as: 'currentResponsibility', include: [{ model: User, as: 'responsibleUser' }] }]
      });
      let respUser = plan?.currentResponsibility?.responsibleUser;
      if (!respUser && plan?.catalog_item_id && plan?.term_id) {
        const annualAssignment = await StrategicResponsibility.findOne({
          where: { term_id: plan.term_id, catalog_item_id: plan.catalog_item_id, status: 'active' },
          include: [{ model: User, as: 'responsibleUser' }]
        });
        respUser = annualAssignment?.responsibleUser;
      }
      if (!respUser && (plan?.responsible_user_id || plan?.user_id)) {
        respUser = await User.findByPk(plan.responsible_user_id || plan.user_id);
      }
      const peUser = await User.findOne({
        where: {
          role: ROLES.PLANEACION_EFECTIVIDAD,
          estado: 'activo'
        }
      });
      if (peUser) {
        requestedParticipants.push({
          user_id: peUser.id,
          name: peUser.nombre,
          email: peUser.email,
          document: peUser.username,
          organization: peUser.dependencia || 'Dirección de Planeación y Aseguramiento de la Calidad',
          role_title: peUser.cargo || 'Planeación y Efectividad',
          meeting_role: 'principal',
          signature_required: true
        });
      }
      if (respUser && (!peUser || String(peUser.id) !== String(respUser.id))) {
        requestedParticipants.push({
          user_id: respUser.id,
          name: respUser.nombre,
          email: respUser.email,
          document: respUser.username,
          organization: respUser.dependencia || 'UNICESMAG',
          role_title: respUser.cargo || 'Responsable del Plan de Acción',
          meeting_role: 'co_responsible',
          signature_required: true
        });
      }
    }
    const requestedHasPrincipal = requestedParticipants.some((participant) => participant.meeting_role === 'principal');
    let principalAssigned = false;
    for (const [index, p] of requestedParticipants.entries()) {
      const matchedUser = p.user_id ? await User.findByPk(p.user_id, { transaction }) : (p.email ? await User.findOne({ where: { email: { [Op.iLike]: String(p.email).trim() }, estado: 'activo' }, transaction }) : null);
      let meetingRole = allowedMeetingRoles.has(p.meeting_role) ? p.meeting_role : (index === 0 ? 'principal' : 'participant');
      if (!requestedHasPrincipal && index === 0) meetingRole = 'principal';
      if (meetingRole === 'principal') {
        if (principalAssigned) meetingRole = 'co_responsible';
        principalAssigned = true;
      }
      await StrategicMeetingParticipant.create({ meeting_id: row.id, user_id: matchedUser?.id || null, participant_type: matchedUser ? 'internal' : 'external', meeting_role: meetingRole, document: p.document || matchedUser?.username || null, name: p.name || matchedUser?.nombre, email: p.email || matchedUser?.email || null, organization: p.organization || matchedUser?.dependencia || null, role_title: p.role_title || matchedUser?.cargo || null, signature_required: p.signature_required !== false }, { transaction });
    }
    await audit(req, 'meeting.create', 'meeting', row.id, null, row.toJSON(), null, transaction); return row;
  });

  // Inicializar automáticamente el borrador versión 1 y sincronizarlo en tiempo real con Google Drive
  try {
    const canonicalContent = await minutePayload(meeting);
    const initialMinute = await StrategicMinuteVersion.create({
      meeting_id: meeting.id,
      version: 1,
      content: canonicalContent,
      content_hash: hashObject(canonicalContent),
      status: 'draft',
      created_by: req.user.id
    });
    syncMinute(initialMinute.id, true).catch((e) => console.warn('Auto-sync Drive tras createMeeting:', e.message));
  } catch (syncErr) {
    console.warn('Error inicializando borrador o syncMinute en createMeeting:', syncErr.message);
  }

  res.status(201); ok(res, meeting, 'Reunión creada.');
});

const updateMeeting = wrap(async (req, res) => {
  let signaturesWereReset = false;
  let affectedMinuteId = null;

  const meeting = await sequelize.transaction(async (transaction) => {
    const row = await StrategicMeeting.findByPk(req.params.meetingId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!row) throw Object.assign(new Error('Reunión no encontrada.'), { statusCode: 404 });
    const before = row.toJSON();
    await row.update({
      title: req.body.title ?? row.title,
      starts_at: req.body.starts_at, ends_at: req.body.ends_at || null,
      location: req.body.location || null, modality: req.body.modality || null,
      objective: req.body.objective, development: req.body.development || null,
      commitments: req.body.commitments || [], updated_by: req.user.id
    }, { transaction });

    const allowedMeetingRoles = new Set(['principal', 'co_responsible', 'collaborator', 'participant']);
    const requestedParticipants = req.body.participants || [];
    const requestedHasPrincipal = requestedParticipants.some((participant) => participant.meeting_role === 'principal');
    const existingParticipants = await StrategicMeetingParticipant.findAll({ where: { meeting_id: row.id }, transaction, lock: transaction.LOCK.UPDATE });
    const existingById = new Map(existingParticipants.map((participant) => [String(participant.id), participant]));
    const retainedIds = [];
    let principalAssigned = false;
    let participantsModified = false;

    // Verificar si el acta ya estaba en firmas o formalizada
    const existingMinute = await StrategicMinuteVersion.findOne({
      where: { meeting_id: row.id },
      order: [['version', 'DESC']],
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    const isLockedState = Boolean(existingMinute && ['signing', 'finalized'].includes(existingMinute.status));

    for (const [index, participant] of requestedParticipants.entries()) {
      const stored = participant.id ? existingById.get(String(participant.id)) : null;
      const matchedUser = participant.user_id
        ? await User.findByPk(participant.user_id, { transaction })
        : (participant.email ? await User.findOne({ where: { email: { [Op.iLike]: String(participant.email).trim() }, estado: 'activo' }, transaction }) : null);
      let meetingRole = allowedMeetingRoles.has(participant.meeting_role) ? participant.meeting_role : (index === 0 ? 'principal' : 'participant');
      if (!requestedHasPrincipal && index === 0) meetingRole = 'principal';
      if (meetingRole === 'principal') {
        if (principalAssigned) meetingRole = 'co_responsible';
        principalAssigned = true;
      }
      const values = {
        user_id: matchedUser?.id || participant.user_id || null,
        participant_type: matchedUser ? 'internal' : (participant.participant_type || 'external'),
        meeting_role: meetingRole,
        document: participant.document || matchedUser?.username || stored?.document || null,
        name: participant.name || matchedUser?.nombre,
        email: participant.email || matchedUser?.email || null,
        organization: participant.organization || matchedUser?.dependencia || null,
        role_title: participant.role_title || matchedUser?.cargo || null,
        signature_required: participant.signature_required !== false
      };
      if (stored) {
        if (!isLockedState && stored.status === 'signed' && stored.meeting_role !== meetingRole) {
          throw Object.assign(new Error(`No puede cambiar el rol de ${stored.name} porque ya firmó el acta.`), { statusCode: 409 });
        }
        if (stored.meeting_role !== meetingRole || stored.name !== values.name || stored.email !== values.email || stored.document !== values.document) {
          participantsModified = true;
        }
        await stored.update(values, { transaction });
        retainedIds.push(stored.id);
      } else {
        participantsModified = true;
        const created = await StrategicMeetingParticipant.create({ meeting_id: row.id, ...values }, { transaction });
        retainedIds.push(created.id);
      }
    }
    const removableIds = existingParticipants
      .filter((participant) => !retainedIds.some((id) => String(id) === String(participant.id)))
      .map((participant) => participant.id);
    if (removableIds.length) {
      participantsModified = true;
      await StrategicMeetingParticipant.destroy({ where: { id: removableIds }, transaction });
    }

    const meetingContentChanged = Boolean(
      String(before.title || '').trim() !== String(row.title || '').trim() ||
      String(before.starts_at || '') !== String(row.starts_at || '') ||
      String(before.ends_at || '') !== String(row.ends_at || '') ||
      String(before.location || '').trim() !== String(row.location || '').trim() ||
      String(before.modality || '').trim() !== String(row.modality || '').trim() ||
      String(before.objective || '').trim() !== String(row.objective || '').trim() ||
      String(before.development || '').trim() !== String(row.development || '').trim() ||
      JSON.stringify(before.commitments || []) !== JSON.stringify(row.commitments || []) ||
      participantsModified
    );

    if (isLockedState && meetingContentChanged) {
      // Si se hace al menos un ajuste, un punto o cambio en el acta que ya estaba en firmas o formalizada:
      // se reactiva automáticamente el flujo de firmas para todos y se invalidan firmas del texto anterior.
      await StrategicMeetingParticipant.update(
        { status: 'invited', signed_at: null, absence_justification: null },
        { where: { meeting_id: row.id, signature_required: true }, transaction }
      );
      await StrategicMinuteSignature.destroy({
        where: { minute_version_id: existingMinute.id },
        transaction
      });
      if (row.status === 'formalized') {
        await row.update({ status: 'in_progress' }, { transaction });
      }
      const updatedContent = await minutePayload(row);
      await existingMinute.update({
        status: 'signing',
        content: {
          ...updatedContent,
          metadata: {
            ...(existingMinute.content?.metadata || {}),
            was_adjusted: true,
            adjusted_at: new Date().toISOString(),
            adjusted_by: req.user.id
          }
        },
        content_hash: hashObject(updatedContent),
        final_pdf_storage_key: null,
        final_pdf_hash: null
      }, { transaction });

      signaturesWereReset = true;
      affectedMinuteId = existingMinute.id;
      await audit(req, 'meeting.adjustment_signatures_reset', 'minute_version', existingMinute.id, before, row.toJSON(), 'Acta modificada tras habilitación; se reactivó el proceso de firmas para todos.', transaction);
    } else {
      await audit(req, 'meeting.update', 'meeting', row.id, before, row.toJSON(), null, transaction);
    }

    return row;
  });

  // Auto-sincronización en tiempo real a Google Drive ante cualquier cambio (borrador, firmas o formalizada)
  // Actualiza el MISMO archivo en Google Drive sin crear duplicados
  try {
    let existingMinute = await StrategicMinuteVersion.findOne({
      where: { meeting_id: meeting.id },
      order: [['version', 'DESC']]
    });
    if (!existingMinute) {
      const canonicalContent = await minutePayload(meeting);
      existingMinute = await StrategicMinuteVersion.create({
        meeting_id: meeting.id,
        version: 1,
        content: canonicalContent,
        content_hash: hashObject(canonicalContent),
        status: meeting.status === 'formalized' ? 'finalized' : 'draft',
        created_by: req.user.id
      });
    } else if (existingMinute.status !== 'finalized') {
      const updatedContent = await minutePayload(meeting);
      await existingMinute.update({
        content: {
          ...(existingMinute.content || {}),
          ...updatedContent,
          meeting: updatedContent.meeting,
          participants: updatedContent.participants,
          responsables: updatedContent.responsables
        },
        content_hash: hashObject(updatedContent)
      });
    }
    syncMinute(existingMinute.id, true).catch((e) => console.warn('Auto-sync Drive tras updateMeeting:', e.message));
  } catch (syncErr) {
    console.warn('Error verificando syncMinute en updateMeeting:', syncErr.message);
  }

  const responsePayload = {
    ...meeting.toJSON(),
    signatures_reset: signaturesWereReset,
    minute_id: affectedMinuteId
  };
  const responseMsg = signaturesWereReset
    ? 'Reunión y acta actualizadas. El documento sufrió ajustes y se reactivó el proceso de firmas para todos los participantes.'
    : 'Reunión y participantes actualizados.';
  ok(res, responsePayload, responseMsg);
});

const improveMinuteText = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [{ model: StrategicCatalogItem, as: 'organizationalUnit', required: false }]
  });
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });

  const result = await improveStrategicMinuteText({
    field: req.body.field,
    text: req.body.text,
    context: {
      action_plan: actionPlan.title || actionPlan.code || '',
      responsible_area: actionPlan.organizationalUnit?.name || '',
      objective: req.body.context?.objective,
      development: req.body.context?.development,
      conclusions: req.body.context?.conclusions
    }
  });
  await audit(req, 'minute_text.improve', 'action_plan', actionPlan.id, null, {
    field: req.body.field,
    model: result.model
  }, 'Asistencia de redacción institucional con IA');
  ok(res, result, 'Redacción institucional mejorada. Revísela antes de guardar.');
});

const generateMinuteSummary = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit', required: false },
      { model: StrategicTerm, as: 'term', required: false },
      { model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false, separate: true, order: [['code', 'ASC']] }
    ]
  });
  if (!actionPlan || actionPlan.deleted_at) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });

  const activities = (actionPlan.items || []).map((item) => ({
    codigo: item.code,
    actividad: item.activity,
    tipo_indicador: item.indicator_type || '',
    indicador: item.indicator || '',
    meta: item.target || '',
    fecha_inicio: item.starts_on || '',
    fecha_fin: item.ends_on || '',
    corresponsables: item.co_responsibles || [],
    campos_adicionales: item.custom_values || {}
  }));
  const result = await generateStrategicMinuteSummary({
    context: {
      action_plan: actionPlan.title || actionPlan.code || '',
      responsible_area: actionPlan.organizationalUnit?.name || '',
      term: actionPlan.term?.year || '',
      objective: req.body?.objective || ''
    },
    activities
  });
  await audit(req, 'minute_summary.generate', 'action_plan', actionPlan.id, null, {
    model: result.model,
    activities_analyzed: result.activities_analyzed
  }, 'Resumen analítico del acta generado con IA');
  ok(res, result, `Resumen generado a partir de ${result.activities_analyzed} actividades. Revíselo antes de guardar.`);
});

const minutePayload = async (meeting) => {
  const participants = await StrategicMeetingParticipant.findAll({ where: { meeting_id: meeting.id }, order: [['created_at', 'ASC']] });
  const hasPrincipal = participants.some((participant) => participant.meeting_role === 'principal');
  const normalizedParticipants = participants.map((participant, index) => ({
    participant,
    meetingRole: participant.meeting_role === 'principal' || hasPrincipal
      ? participant.meeting_role
      : (index === 0 ? 'principal' : 'participant')
  })).sort((a, b) => {
    const position = { principal: 0, co_responsible: 1, collaborator: 2, participant: 3 };
    return (position[a.meetingRole] ?? 3) - (position[b.meetingRole] ?? 3);
  });
  const actionPlan = await StrategicActionPlan.findByPk(meeting.action_plan_id, { include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }] });
  const responsibleNames = normalizedParticipants
    .filter(({ meetingRole }) => ['principal', 'co_responsible'].includes(meetingRole))
    .map(({ participant }) => participant.name)
    .filter(Boolean);
  return {
    responsables: responsibleNames.join(', ') || actionPlan?.organizationalUnit?.name || '',
    dependencia: PLANNING_DEPARTMENT_NAME, lugar: meeting.location || '',
    fecha: new Date(meeting.starts_at).toLocaleDateString('es-CO'),
    horario: `${new Date(meeting.starts_at).toLocaleTimeString('es-CO')} - ${meeting.ends_at ? new Date(meeting.ends_at).toLocaleTimeString('es-CO') : ''}`,
    participantes: normalizedParticipants.map(({ participant: p, meetingRole }) => ({ nombre: p.name, dependencia: p.organization || '', cargo: p.role_title || '', rol_reunion: meetingRole })),
    objetivo: [meeting.objective], desarrollo: [meeting.development || ''],
    conclusiones: (meeting.commitments || []).map((c) => typeof c === 'string' ? c : `${c.description || ''}${c.responsible ? ` — ${c.responsible}` : ''}`),
    meeting: meeting.toJSON(), participants: normalizedParticipants.map(({ participant, meetingRole }) => ({ ...participant.toJSON(), meeting_role: meetingRole }))
  };
};

const createMinuteVersion = wrap(async (req, res) => {
  const meeting = await StrategicMeeting.findByPk(req.params.meetingId);
  if (!meeting) throw Object.assign(new Error('Reunión no encontrada.'), { statusCode: 404 });
  const last = await StrategicMinuteVersion.max('version', { where: { meeting_id: meeting.id } }) || 0;
  const canonicalContent = await minutePayload(meeting);
  const content = req.body.content ? {
    ...canonicalContent,
    ...req.body.content,
    responsables: canonicalContent.responsables,
    participantes: canonicalContent.participantes,
    participants: canonicalContent.participants,
    meeting: canonicalContent.meeting
  } : canonicalContent;
  const minute = await StrategicMinuteVersion.create({ meeting_id: meeting.id, version: Number(last) + 1, content, content_hash: hashObject(content), created_by: req.user.id });
  await audit(req, 'minute.version.create', 'minute_version', minute.id, null, minute.toJSON(), req.body.justification);
  res.status(201); ok(res, minute, 'Versión de acta creada; las firmas se vincularán solo a esta versión.');
});

const resolveStrategicSigningAccess = async (token, allowedStatuses = ['signing', 'finalized']) => {
  const tokenHash = sha256(String(token || ''));
  const genericMinute = await StrategicMinuteVersion.findOne({
    where: {
      public_token_hash: tokenHash,
      status: { [Op.in]: allowedStatuses },
      token_expires_at: { [Op.gt]: new Date() }
    }
  });
  if (genericMinute) return { minute: genericMinute, participant: null, invitationVerified: false };

  const participant = await StrategicMeetingParticipant.findOne({
    where: { external_token_hash: tokenHash, signature_required: true }
  });
  if (!participant) return { minute: null, participant: null, invitationVerified: false };

  const minute = await StrategicMinuteVersion.findOne({
    where: {
      meeting_id: participant.meeting_id,
      status: { [Op.in]: allowedStatuses },
      token_expires_at: { [Op.gt]: new Date() }
    },
    order: [['version', 'DESC']]
  });
  return minute
    ? { minute, participant, invitationVerified: true }
    : { minute: null, participant: null, invitationVerified: false };
};

const publishMinute = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const isRevision = Boolean(req.body.is_revision || minute.content?.metadata?.was_adjusted);
  const canRegenerate = (minute.status === 'signing' || minute.status === 'finalized') && (req.body.regenerate === true || isRevision);
  if (!['draft', 'review'].includes(minute.status) && !canRegenerate) throw Object.assign(new Error('Esta versión del acta ya fue habilitada para firmas o finalizada.'), { statusCode: 409 });
  const pending = await StrategicMinuteProposal.count({ where: { minute_version_id: minute.id, status: 'pending' } });
  if (pending) throw Object.assign(new Error('Hay propuestas de cambio pendientes por resolver.'), { statusCode: 409 });

  if (isRevision || (req.body.regenerate && !req.body.only_pending)) {
    await StrategicMeetingParticipant.update(
      { status: 'invited', signed_at: null, absence_justification: null },
      { where: { meeting_id: minute.meeting_id, signature_required: true } }
    );
    await StrategicMinuteSignature.destroy({
      where: { minute_version_id: minute.id }
    });
  }

  const token = randomToken();
  await minute.update({
    status: 'signing',
    public_token_hash: sha256(token),
    token_expires_at: new Date(Date.now() + 45 * 24 * 60 * 60 * 1000),
    published_at: new Date()
  });
  // En producción PUBLIC_FRONTEND_URL debe ser el dominio público. El origen
  // enviado por la interfaz permite que el mismo flujo funcione en otros entornos.
  const baseUrl = signingFrontendOrigin(req).replace(/\/$/, '');
  const signingUrl = `${baseUrl}/firmar-acta/${token}`;
  const qr_data_url = await QRCode.toDataURL(signingUrl, { errorCorrectionLevel: 'M', margin: 1, width: 360 });
  const meeting = await StrategicMeeting.findByPk(minute.meeting_id, {
    include: [{ model: StrategicMeetingParticipant, as: 'participants' }]
  });
  if (meeting?.action_plan_id) {
    const actionPlan = await StrategicActionPlan.findByPk(meeting.action_plan_id);
    if (actionPlan && !['owner_validation', 'active', 'monitoring', 'closed'].includes(actionPlan.status)) {
      const prevStatus = actionPlan.status;
      await actionPlan.update({ status: 'owner_validation', updated_by: req.user.id });
      await StrategicWorkflowEvent.create({
        action_plan_id: actionPlan.id,
        from_state: prevStatus,
        to_state: 'owner_validation',
        action: 'submit_owner_validation',
        comment: isRevision
          ? 'Acta modificada tras ajustes y habilitada nuevamente para firmas.'
          : 'Acta habilitada para firmas. El Plan de Acción entra en etapa transitoria de revisión y retroalimentación del responsable.',
        performed_by: req.user.id,
        ip_address: requestMeta(req).ip_address,
        session_id: requestMeta(req).session_id
      });
      await audit(req, 'action_plan.submit_owner_validation', 'action_plan', actionPlan.id, { status: prevStatus }, { status: 'owner_validation' }, isRevision ? 'Reactivación de firmas por modificación del acta' : 'Envío automático a firmas y revisión del responsable');
      if (actionPlan.responsible_user_id) {
        await StrategicNotification.create({
          user_id: actionPlan.responsible_user_id,
          action_plan_id: actionPlan.id,
          type: 'action_plan_review_submitted',
          title: isRevision ? `Acta modificada: ${actionPlan.code}` : `Acta disponible para firma: ${actionPlan.code}`,
          message: isRevision
            ? 'El acta ha sido ajustada y se encuentra habilitada nuevamente para su revisión y firmas.'
            : 'El acta de concertación ha sido remitida para revisión y firmas.',
          link: '/plan-accion-consulta',
          metadata: { action_plan_code: actionPlan.code }
        }).catch((e) => console.warn('No se pudo crear StrategicNotification tras envío a firmas:', e.message));
      }
    }
  }
  const invitees = (meeting?.participants || []).filter((participant) => (
    participant.signature_required
    && (isRevision || !req.body.only_pending || participant.status !== 'signed')
    && String(participant.email || '').trim()
  ));
  const meetingDate = meeting?.starts_at
    ? new Date(meeting.starts_at).toLocaleDateString('es-CO')
    : '';
  const invitationResults = await Promise.all(invitees.map(async (participant) => {
    const invitationToken = randomToken();
    const participantSigningUrl = `${baseUrl}/firmar-acta/${invitationToken}`;
    const previousInvitationTokenHash = participant.external_token_hash;
    await participant.update({ external_token_hash: sha256(invitationToken) });
    const safeName = escapeHtml(participant.name || 'Participante');
    const privacyHtml = participant.participant_type === 'external' ? `
      <div style="margin:18px 0;padding:16px;background:#f8fafc;border:1px solid #dbe5f0;border-radius:10px;color:#475569;font-size:12px;line-height:1.55;">
        <strong style="display:block;margin-bottom:6px;color:#17345f;">Tratamiento de datos personales</strong>
        ${escapeHtml(PRIVACY_POLICY_NOTICE).replace(/\n\n/g, '<br><br>')}
        <br><a href="${escapeHtml(PRIVACY_POLICY_URL)}">Consultar política institucional</a>
      </div>` : '';
    const html = renderInstitutionalTemplate({
      title: isRevision ? 'Acta modificada · Nueva firma requerida' : 'Invitación para firmar acta',
      introHtml: isRevision ? `
        <div style="margin:0 0 16px;padding:14px 16px;background:#fef3c7;border:1px solid #f59e0b;border-radius:10px;color:#92400e;font-size:13.5px;line-height:1.55;">
          <strong style="display:block;margin-bottom:4px;font-size:14px;color:#b45309;">⚠️ Aviso de actualización de acta:</strong>
          El contenido del acta de la reunión${meetingDate ? ` del <strong>${escapeHtml(meetingDate)}</strong>` : ''} <strong>sufrió modificaciones y ajustes recientes</strong>. Conforme al procedimiento institucional, se reactivó el proceso de firmas para todos los participantes sobre esta versión actualizada.
        </div>
        <p style="margin:0 0 16px;font-size:14px;color:#334155;">Hola <strong>${safeName}</strong>. Por favor revise el texto actualizado del documento y registre su firma electrónica a continuación:</p>
      ` : `<p style="margin:0 0 18px;">Hola <strong>${safeName}</strong>. El acta de la reunión${meetingDate ? ` del <strong>${escapeHtml(meetingDate)}</strong>` : ''} está disponible para su revisión y firma.</p>`,
      bodyHtml: `
        <div style="text-align:center;margin:22px 0;">
          <a href="${escapeHtml(participantSigningUrl)}" style="display:inline-block;padding:13px 26px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">${isRevision ? 'Revisar cambios y firmar acta' : 'Revisar y firmar el acta'}</a>
        </div>
        <p style="margin:0;padding:13px 15px;background:#f8fafc;border-radius:9px;color:#475569;font-size:13px;line-height:1.5;">Este enlace es personal. Al abrirlo podrá revisar el acta completa y firmarla directamente, sin volver a escribir su nombre, correo ni códigos.</p>
        <div style="margin-top:16px;padding:12px 14px;background:#f1f5f9;border-radius:8px;font-size:12px;color:#475569;line-height:1.45;">
          <strong>Observaciones o dudas:</strong> Si requiere alguna corrección o ajuste en el acta, puede <strong>responder directamente a este correo</strong> o escribir a <a href="mailto:planeacionestrategica@unicesmag.edu.co" style="color:#2563eb;font-weight:600;">planeacionestrategica@unicesmag.edu.co</a>.
        </div>
        ${privacyHtml}
      `
    });
    const sent = await sendStrategicPlanningEmail({
      to: participant.email,
      replyTo: 'planeacionestrategica@unicesmag.edu.co',
      subject: isRevision ? 'Acta institucional actualizada para revisión y firma · COM-IF-FR-002' : 'Acta disponible para revisión y firma',
      text: isRevision
        ? `AVISO: El acta de reunión del ${meetingDate || ''} sufrió modificaciones y ajustes. Se reactivó el flujo de firmas. Por favor revise la versión actualizada y registre su firma en: ${participantSigningUrl}\n\nSi tiene alguna observación o requiere un ajuste adicional, responda directamente a este correo o escriba a planeacionestrategica@unicesmag.edu.co.`
        : `Hola ${participant.name || 'participante'}. Revise y firme el acta en: ${participantSigningUrl}\n\nSi tiene alguna observación o requiere un ajuste adicional, responda directamente a este correo o escriba a planeacionestrategica@unicesmag.edu.co.${participant.participant_type === 'external' ? `\n\nTratamiento de datos personales:\n${PRIVACY_POLICY_NOTICE}\n${PRIVACY_POLICY_URL}` : ''}`,
      html
    });
    // Si el correo falla, conserve el enlace personal anterior. Así, un simple
    // reenvío no invalida una invitación que el participante ya recibió.
    if (!sent.success) await participant.update({ external_token_hash: previousInvitationTokenHash || null });
    return { participant_id: participant.id, email: participant.email, success: sent.success, error: sent.error || null };
  }));
  const sentCount = invitationResults.filter((result) => result.success).length;
  const failedCount = invitationResults.length - sentCount;
  const message = isRevision
    ? `Acta modificada. Se reactivó el flujo de firmas y se enviaron ${sentCount} de ${invitationResults.length} invitaciones con el aviso de actualización.`
    : (failedCount
      ? `Acta habilitada para firmas. Se enviaron ${sentCount} de ${invitationResults.length} invitaciones.`
      : `Acta habilitada y ${sentCount} invitaci${sentCount === 1 ? 'ón enviada' : 'ones enviadas'}.`);
  ok(res, {
    minute,
    signing_url: signingUrl,
    qr_data_url,
    invitation_summary: { total: invitationResults.length, sent: sentCount, failed: failedCount },
    invitation_results: invitationResults
  }, message);
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
  const access = await resolveStrategicSigningAccess(req.params.token);
  const { minute } = access;
  if (!minute) throw Object.assign(new Error('Enlace de firma inválido o vencido.'), { statusCode: 404 });
  const meeting = await StrategicMeeting.findByPk(minute.meeting_id, { include: [{ model: StrategicMeetingParticipant, as: 'participants' }] });
  const requiredParticipants = meeting.participants.filter((participant) => participant.signature_required);
  const visibleParticipants = access.invitationVerified ? [access.participant] : requiredParticipants;
  ok(res, {
    id: minute.id,
    version: minute.version,
    status: minute.status,
    content: minute.content,
    content_hash: minute.content_hash,
    invitation_verified: access.invitationVerified,
    invited_participant_id: access.participant?.id || null,
    already_signed: access.participant?.status === 'signed',
    meeting: { id: meeting.id, starts_at: meeting.starts_at, objective: meeting.objective },
    privacy_policy: { notice: PRIVACY_POLICY_NOTICE, url: PRIVACY_POLICY_URL, version: PRIVACY_POLICY_VERSION },
    preview_participants: requiredParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      organization: p.organization || '',
      role_title: p.role_title || '',
      participant_type: p.participant_type,
      external: p.participant_type === 'external',
      status: p.status,
      signed: p.status === 'signed'
    })),
    participants: visibleParticipants.map((p) => ({
      id: p.id,
      name: p.name,
      organization: p.organization || '',
      role_title: p.role_title || '',
      email: access.invitationVerified ? (p.email || '') : undefined,
      email_hint: p.email ? `${p.email.slice(0, 2)}***@${p.email.split('@')[1]}` : '',
      participant_type: p.participant_type,
      signed: p.status === 'signed'
    }))
  });
});

const requestExternalOtp = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findOne({ where: { public_token_hash: sha256(req.params.token), status: 'signing', token_expires_at: { [Op.gt]: new Date() } } });
  const participant = minute && await StrategicMeetingParticipant.findOne({ where: { id: req.body.participant_id, meeting_id: minute.meeting_id, signature_required: true } });
  if (!participant || String(participant.email || '').toLowerCase() !== String(req.body.email || '').trim().toLowerCase()) throw Object.assign(new Error('Los datos no coinciden con la invitación.'), { statusCode: 422 });
  const otp = String(crypto.randomInt(100000, 999999));
  await participant.update({ otp_hash: sha256(otp), otp_expires_at: new Date(Date.now() + 10 * 60 * 1000), otp_attempts: 0 });
  const signingUrl = `${signingFrontendOrigin(req).replace(/\/$/, '')}/firmar-acta/${encodeURIComponent(req.params.token)}`;
  const safeName = escapeHtml(participant.name || 'Participante');
  const privacyHtml = participant.participant_type === 'external' ? `
      <div style="margin:18px 0;padding:16px;background:#f8fafc;border:1px solid #dbe5f0;border-radius:10px;color:#475569;font-size:12px;line-height:1.55;">
        <strong style="display:block;margin-bottom:6px;color:#17345f;">Tratamiento de datos personales</strong>
        ${escapeHtml(PRIVACY_POLICY_NOTICE).replace(/\n\n/g, '<br><br>')}
        <br><a href="${escapeHtml(PRIVACY_POLICY_URL)}">Consultar política institucional</a>
      </div>` : '';
  const html = renderInstitutionalTemplate({
    title: 'Código para firmar el acta',
    introHtml: `<p style="margin:0 0 18px;">Hola <strong>${safeName}</strong>. Use este código para confirmar su identidad y registrar su firma:</p>`,
    bodyHtml: `
      <div style="margin:0 auto 18px;max-width:360px;padding:20px;text-align:center;background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;">
        <div style="margin-bottom:7px;font-size:12px;font-weight:700;letter-spacing:.08em;color:#475569;text-transform:uppercase;">Código de verificación</div>
        <div style="font-family:Consolas,Monaco,monospace;font-size:34px;font-weight:800;letter-spacing:9px;color:#174ea6;user-select:all;">${otp}</div>
        <div style="margin-top:8px;font-size:12px;color:#64748b;">Seleccione o mantenga presionado el código para copiarlo.</div>
      </div>
      <div style="text-align:center;margin:20px 0;">
        <a href="${escapeHtml(signingUrl)}" style="display:inline-block;padding:12px 24px;background:#2563eb;color:#ffffff;text-decoration:none;border-radius:9px;font-weight:700;">Abrir y firmar el acta</a>
      </div>
      <p style="margin:0;padding:12px 14px;background:#f8fafc;border-radius:9px;color:#475569;font-size:13px;">El código vence en <strong>10 minutos</strong>. Si usted no solicitó esta firma, puede ignorar el mensaje.</p>
      ${privacyHtml}
    `
  });
  const sent = await sendStrategicPlanningEmail({
    to: participant.email,
    replyTo: 'planeacionestrategica@unicesmag.edu.co',
    subject: `${otp} · Código para firmar acta SIAC`,
    text: `Hola ${participant.name || 'participante'}. Su código para firmar el acta es ${otp}. Vence en 10 minutos. Abra el acta: ${signingUrl}${participant.participant_type === 'external' ? `\n\nTratamiento de datos personales:\n${PRIVACY_POLICY_NOTICE}` : ''}`,
    html
  });
  if (!sent.success) throw Object.assign(new Error('No fue posible enviar el código al correo.'), { statusCode: 503 });
  ok(res, null, 'Código enviado.');
});

const storeSignature = ({ participant, minute, signatureData, signerUserId, method, verified, privacyAccepted = false, req }) => {
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
    privacy_accepted_at: privacyAccepted ? new Date() : null,
    privacy_policy_version: privacyAccepted ? PRIVACY_POLICY_VERSION : null,
    signed_at: new Date(), ip_address: req.ip, user_agent: String(req.headers['user-agent'] || '').slice(0, 500)
  });
};

const finalizeAndSyncMinuteInternal = async (minuteId, { req = null, userId = null, justification = null } = {}) => {
  const minute = await StrategicMinuteVersion.findByPk(minuteId);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });

  // Si el acta ya estaba formalizada/finalizada, permitir re-sincronizarla con Google Drive
  if (minute.status === 'finalized') {
    const signatures = await StrategicMinuteSignature.findAll({ where: { minute_version_id: minute.id }, order: [['signed_at', 'ASC']] });
    const baseUrl = (req ? signingFrontendOrigin(req) : (process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'https://siac.unicesmag.edu.co')).replace(/\/$/, '');
    const validationUrl = `${baseUrl}/api/public/strategic-planning/validate/${minute.id}`;
    let qrDataUrl = '';
    try {
      qrDataUrl = await QRCode.toDataURL(validationUrl, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
    } catch (_) {}
    const originalBuffer = await generateStrategicMinutePdf({
      minute,
      signatures,
      validationUrl,
      qrDataUrl,
      hideGraphicSignatures: false
    });
    const reportsDir = path.join(PRIVATE_ROOT, '_minutes'); ensureDir(reportsDir);
    const hasValidKeyDir = minute.final_pdf_storage_key && fs.existsSync(path.dirname(minute.final_pdf_storage_key));
    const finalPdfPath = hasValidKeyDir ? minute.final_pdf_storage_key : path.join(reportsDir, `ACTA-${minute.meeting_id}-V${minute.version}.pdf`);
    fs.writeFileSync(finalPdfPath, originalBuffer);
    await minute.update({ final_pdf_storage_key: finalPdfPath, final_pdf_hash: sha256(originalBuffer) });

    let driveSync = null;
    let driveError = null;
    try {
      driveSync = await syncMinute(minute.id);
    } catch (driveErr) {
      driveError = driveErr.message || String(driveErr);
      console.warn('PEI: Sincronización con Drive no completada, encolando tarea:', driveError);
      await enqueueSync({ entityType: 'minute', entityId: minute.id, createdBy: userId });
    }
    const meeting = await StrategicMeeting.findByPk(minute.meeting_id, {
      include: [{ model: StrategicActionPlan, as: 'actionPlan', attributes: ['term_id'] }]
    });
    await refreshActionRepository(meeting?.actionPlan?.term_id, req, 'minute_resynced');
    return { minute, driveSync, driveError };
  }

  if (minute.status !== 'signing') throw Object.assign(new Error('El acta no está en firma ni finalizada.'), { statusCode: 409 });
  const required = await StrategicMeetingParticipant.findAll({ where: { meeting_id: minute.meeting_id, signature_required: true } });
  const missing = required.filter((p) => p.status !== 'signed' && !p.absence_justification);

  if (missing.length) throw Object.assign(new Error(`Faltan ${missing.length} firmas requeridas o su justificación de ausencia.`), { statusCode: 409 });
  const signatures = await StrategicMinuteSignature.findAll({ where: { minute_version_id: minute.id }, order: [['signed_at', 'ASC']] });
  const baseUrl = (req ? signingFrontendOrigin(req) : (process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'https://siac.unicesmag.edu.co')).replace(/\/$/, '');
  const validationUrl = `${baseUrl}/api/public/strategic-planning/validate/${minute.id}`;
  let qrDataUrl = '';
  try {
    qrDataUrl = await QRCode.toDataURL(validationUrl, { errorCorrectionLevel: 'M', margin: 1, width: 300 });
  } catch (_) {}

  // 1. Buffer Original con firmas gráficas para archivo institucional y responsable
  const originalBuffer = await generateStrategicMinutePdf({
    minute,
    signatures,
    validationUrl,
    qrDataUrl,
    hideGraphicSignatures: false
  });

  // 2. Buffer Copia Oficial con constancia ORIGINAL FIRMADO (sin firmas gráficas) para participantes
  const copyBuffer = await generateStrategicMinutePdf({
    minute,
    signatures,
    validationUrl,
    qrDataUrl,
    hideGraphicSignatures: true
  });

  const reportsDir = path.join(PRIVATE_ROOT, '_minutes'); ensureDir(reportsDir);
  const finalPdfPath = path.join(reportsDir, `ACTA-${minute.meeting_id}-V${minute.version}.pdf`);
  fs.writeFileSync(finalPdfPath, originalBuffer);
  await minute.update({ status: 'finalized', finalized_at: new Date(), finalized_by: userId, final_pdf_storage_key: finalPdfPath, final_pdf_hash: sha256(originalBuffer) });
  await StrategicMeeting.update({ status: 'formalized' }, { where: { id: minute.meeting_id } });

  // Identificar responsables y co-responsables del acta
  const meeting = await StrategicMeeting.findByPk(minute.meeting_id, {
    include: [{
      model: StrategicActionPlan,
      as: 'actionPlan',
      attributes: ['id', 'code', 'term_id', 'responsible_user_id']
    }]
  });

  // Activar automáticamente el Plan de Acción en Ejecución Oficial tras formalizarse el acta
  if (meeting?.actionPlan) {
    const fullPlan = await StrategicActionPlan.findByPk(meeting.actionPlan.id);
    if (fullPlan && ['owner_validation', 'formulation', 'preliminary_minutes', 'technical_review'].includes(fullPlan.status)) {
      const prevPlanStatus = fullPlan.status;
      await fullPlan.update({ status: 'active', updated_by: userId });
      await StrategicWorkflowEvent.create({
        action_plan_id: fullPlan.id,
        from_state: prevPlanStatus,
        to_state: 'active',
        action: 'activate',
        actor_user_id: userId,
        comment: 'Plan de Acción activado en Ejecución Oficial tras completarse la firma electrónica del Acta COM-IF-FR-002.'
      });
      syncSinglePlanOfficialWorkbook(fullPlan.id).catch((err) => console.warn('[Drive Auto-sync warning]:', err.message));
    }
  }
  const allMeetingParticipants = await StrategicMeetingParticipant.findAll({ where: { meeting_id: minute.meeting_id } });
  const responsibleEmails = new Set();

  allMeetingParticipants.forEach((p) => {
    if (['principal', 'co_responsible'].includes(p.meeting_role) && p.email) {
      responsibleEmails.add(String(p.email).trim().toLowerCase());
    }
  });

  if (meeting?.actionPlan?.responsible_user_id) {
    const respUser = await User.findByPk(meeting.actionPlan.responsible_user_id);
    if (respUser?.email) {
      responsibleEmails.add(String(respUser.email).trim().toLowerCase());
    }
  }

  if (responsibleEmails.size === 0 && allMeetingParticipants.length > 0) {
    const firstWithEmail = allMeetingParticipants.find((p) => p.email);
    if (firstWithEmail?.email) {
      responsibleEmails.add(String(firstWithEmail.email).trim().toLowerCase());
    }
  }

  const meetingDate = minute.content?.fecha || '';
  const minuteCode = `ACTA-${minute.meeting_id}-V${minute.version}`;
  const originalAttachment = { filename: `${minuteCode}-ORIGINAL.pdf`, content: originalBuffer, contentType: 'application/pdf' };
  const copyAttachment = { filename: `${minuteCode}.pdf`, content: copyBuffer, contentType: 'application/pdf' };

  for (const participant of required.filter((p) => p.email)) {
    const safeEmail = String(participant.email).trim().toLowerCase();
    const isResponsibleRecipient = responsibleEmails.has(safeEmail);
    const attachment = isResponsibleRecipient ? originalAttachment : copyAttachment;

    const introHtml = `
      <p style="margin:0 0 10px;font-size:16px;font-weight:800;color:#1e3a8a;">ACTA FORMALIZADA · ${escapeHtml(minuteCode)}</p>
      <p style="margin:0 0 12px;font-size:14px;color:#334155;">Cordial saludo de paz y bien,</p>
      <p style="margin:0 0 14px;font-size:13.5px;color:#334155;">El proceso de revisión y firma electrónica del acta de seguimiento al Plan de Acción ha finalizado satisfactoriamente.</p>
    `;

    const bodyHtml = `
      <div style="margin:16px 0;padding:16px;border:1px solid #cbd5e1;border-radius:10px;background:#f8fafc;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;color:#1e293b;">
          <tr>
            <td style="padding:4px 0;width:130px;color:#64748b;"><strong>Versión:</strong></td>
            <td style="padding:4px 0;font-weight:700;">Versión ${minute.version}</td>
          </tr>
          ${meetingDate ? `<tr><td style="padding:4px 0;color:#64748b;"><strong>Fecha reunión:</strong></td><td style="padding:4px 0;">${escapeHtml(meetingDate)}</td></tr>` : ''}
          <tr>
            <td style="padding:4px 0;color:#64748b;"><strong>Validación SIAC:</strong></td>
            <td style="padding:4px 0;font-family:Consolas,monospace;font-size:12px;">${escapeHtml(minute.id)}</td>
          </tr>
        </table>
      </div>
      <div style="margin:20px 0;padding:16px;border:1px solid #bbf7d0;border-radius:10px;background:#f0fdf4;">
        <p style="margin:0 0 6px;font-size:13.5px;color:#166534;font-weight:700;">✓ Documento formalmente firmado por todos los convocados</p>
        <p style="margin:0;font-size:13px;color:#15803d;line-height:1.5;">${
          isResponsibleRecipient
            ? 'Se adjunta a este mensaje el documento <strong>ORIGINAL</strong> en formato PDF con las firmas gráficas de los participantes para su custodia y archivo institucional.'
            : 'Se adjunta a este mensaje la <strong>copia oficial</strong> en formato PDF debidamente certificada con la constancia <strong>ORIGINAL FIRMADO</strong>.'
        }</p>
      </div>
    `;

    const html = renderInstitutionalTemplate({
      title: `Acta de Reunión Firmada · ${minuteCode}${isResponsibleRecipient ? ' (Original)' : ''}`,
      introHtml,
      bodyHtml
    });

    try {
      await sendStrategicPlanningEmail({
        to: participant.email,
        replyTo: 'planeacionestrategica@unicesmag.edu.co',
        subject: `Acta de Reunión Firmada · ${minuteCode}${isResponsibleRecipient ? ' (Original)' : ''}`,
        text: `El acta versión ${minute.version} fue formalizada por todos los participantes. Se adjunta ${isResponsibleRecipient ? 'el documento original con las firmas para su custodia' : 'la copia oficial con la constancia ORIGINAL FIRMADO'}. Código de validación: ${minute.id}.`,
        html,
        attachments: [attachment]
      });
    } catch (mailErr) {
      console.warn('Error enviando correo de formalización a', participant.email, mailErr.message);
    }
  }

  let driveSync = null;
  let driveError = null;
  try {
    driveSync = await syncMinute(minute.id);
  } catch (driveErr) {
    driveError = driveErr.message || String(driveErr);
    console.warn('PEI: Sincronización inmediata con Drive no completada, encolando tarea:', driveError);
    await enqueueSync({ entityType: 'minute', entityId: minute.id, createdBy: userId });
  }

  await refreshActionRepository(meeting?.actionPlan?.term_id, req, 'minute_finalized');
  if (req && userId) {
    await audit(req, 'minute.finalize', 'minute_version', minute.id, null, minute.toJSON(), justification);
  }
  return { minute, driveSync, driveError };
};

const checkAndAutoFinalizeMinute = async (minuteId, req, userId) => {
  try {
    const minute = await StrategicMinuteVersion.findByPk(minuteId);
    if (!minute || minute.status !== 'signing') return null;
    const required = await StrategicMeetingParticipant.findAll({ where: { meeting_id: minute.meeting_id, signature_required: true } });
    const missing = required.filter((p) => p.status !== 'signed' && !p.absence_justification);
    if (missing.length === 0) {
      return await finalizeAndSyncMinuteInternal(minute.id, { req, userId });
    }
  } catch (err) {
    console.warn('Auto-finalización y sincronización tras firma falló:', err.message);
  }
  return null;
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
  await participant.update({ status: 'signed' });
  const autoResult = await checkAndAutoFinalizeMinute(minute.id, req, req.user.id);
  const msg = autoResult?.driveSync
    ? `Firma registrada. ¡Todas las firmas se completaron! Acta formalizada y sincronizada en Drive como "${autoResult.driveSync.fileName}".`
    : (autoResult ? 'Firma registrada. ¡Todas las firmas se completaron! El acta fue formalizada exitosamente.' : 'Firma registrada con trazabilidad SIAC.');
  ok(res, { ...signature.toJSON(), auto_finalized: Boolean(autoResult) }, msg);
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
  const access = await resolveStrategicSigningAccess(req.params.token, ['signing']);
  const { minute } = access;
  const participant = minute && await StrategicMeetingParticipant.findOne({ where: { id: req.body.participant_id, meeting_id: minute.meeting_id, signature_required: true } });
  if (access.invitationVerified && participant?.id !== access.participant?.id) {
    throw Object.assign(new Error('Este enlace de firma pertenece a otro participante.'), { statusCode: 403 });
  }
  if (participant?.participant_type === 'external' && req.body.privacy_accepted !== true) {
    throw Object.assign(new Error('Debe aceptar la autorizacion de tratamiento de datos personales para firmar.'), { statusCode: 422 });
  }
  if (!participant) throw Object.assign(new Error('Participante no válido.'), { statusCode: 404 });
  if (participant.status === 'signed') throw Object.assign(new Error('Este participante ya firmó el acta.'), { statusCode: 409 });
  if (!access.invitationVerified && (participant.otp_attempts >= 5 || !participant.otp_expires_at || participant.otp_expires_at < new Date() || participant.otp_hash !== sha256(String(req.body.otp || '')))) {
    await participant.increment('otp_attempts'); throw Object.assign(new Error('Código inválido o vencido.'), { statusCode: 422 });
  }
  // La identidad procede de SIAC/invitación y no se modifica desde el enlace público.
  await participant.update({ email_verified_at: new Date(), otp_hash: null, otp_expires_at: null });
  const signature = await storeSignature({
    participant,
    minute,
    signatureData: req.body.signature_data,
    signerUserId: participant.user_id,
    method: participant.user_id ? 'qr_internal_drawn' : 'external_drawn',
    verified: true,
    privacyAccepted: participant.participant_type === 'external',
    req
  });
  await participant.update({ status: 'signed' });
  const autoResult = await checkAndAutoFinalizeMinute(minute.id, req, participant.user_id || null);
  const msg = autoResult?.driveSync
    ? `Firma electrónica registrada. ¡Todas las firmas se completaron! Acta formalizada y sincronizada en Drive como "${autoResult.driveSync.fileName}".`
    : (autoResult ? 'Firma electrónica registrada. ¡Todas las firmas se completaron! El acta fue formalizada exitosamente.' : 'Firma electrónica registrada.');
  ok(res, { id: signature.id, auto_finalized: Boolean(autoResult) }, msg);
});

const downloadMinuteWord = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });
  const buffer = await generateActaBuffer(minute.content);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="ACTA-${minute.meeting_id}-V${minute.version}.docx"`); res.send(buffer);
});

const finalizeMinute = wrap(async (req, res) => {
  const { minute, driveSync, driveError } = await finalizeAndSyncMinuteInternal(req.params.minuteId, {
    req,
    userId: req.user.id,
    justification: req.body.justification
  });
  const successMsg = driveSync?.webViewLink
    ? `Acta formalizada, notificada y sincronizada en Google Drive como "${driveSync.fileName}".`
    : driveSync?.folderWebViewLink
    ? `Acta formalizada y guardada en SIAC. Carpeta institucional preparada en Google Drive.`
    : driveError
    ? `Acta formalizada y notificada en SIAC. Sincronización con Drive pendiente (${driveError}).`
    : 'Acta formalizada y notificada en SIAC. Sincronización con Google Drive programada.';
  ok(res, { ...minute.toJSON(), driveSync, driveError: driveError || null }, successMsg);
});

const downloadMinutePdf = wrap(async (req, res) => {
  const minute = await StrategicMinuteVersion.findByPk(req.params.minuteId);
  if (!minute) throw Object.assign(new Error('Acta no encontrada.'), { statusCode: 404 });

  const type = req.query.type || 'original';
  const hideGraphicSignatures = type === 'official_copy';

  const signatures = await StrategicMinuteSignature.findAll({
    where: { minute_version_id: minute.id },
    order: [['signed_at', 'ASC']]
  });

  const baseUrl = signingFrontendOrigin(req).replace(/\/$/, '');
  const validationUrl = `${baseUrl}/api/public/strategic-planning/validate/${minute.id}`;
  const qrDataUrl = await QRCode.toDataURL(validationUrl, { errorCorrectionLevel: 'M', margin: 1, width: 300 });

  const pdfBuffer = await generateStrategicMinutePdf({
    minute,
    signatures,
    validationUrl,
    qrDataUrl,
    hideGraphicSignatures
  });

  if (!hideGraphicSignatures && minute.status === 'finalized' && minute.final_pdf_storage_key) {
    try {
      fs.writeFileSync(minute.final_pdf_storage_key, pdfBuffer);
    } catch (_) {}
  }

  const filename = type === 'official_copy'
    ? `ACTA-${minute.meeting_id}-V${minute.version}_COPIA_OFICIAL.pdf`
    : `ACTA-${minute.meeting_id}-V${minute.version}_ORIGINAL.pdf`;

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(pdfBuffer);
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
  const storedName = `${cleanCode(item.code)}-${cleanCode(period.code || 'PER')}-EV-${String(nextVersion).padStart(3, '0')}${ext}`;
  const storageKey = path.join(yearDir, storedName); fs.writeFileSync(storageKey, req.file.buffer, { flag: 'wx' });
  const evidence = await StrategicEvidence.create({
    action_item_id: item.id,
    monitoring_period_id: period.id,
    original_name: req.file.originalname,
    stored_name: storedName,
    storage_key: storageKey,
    mime_type: req.file.mimetype || 'application/octet-stream',
    size_bytes: req.file.size,
    sha256: digest,
    version: nextVersion,
    description: req.body.description || null,
    uploaded_by: req.user.id
  });

  // Sincronización automática e inmediata en Google Drive en la carpeta a nombre de la actividad
  let driveSyncSuccess = false;
  try {
    const driveResult = await syncEvidence(evidence.id);
    if (driveResult && !driveResult.skipped) {
      driveSyncSuccess = true;
      await evidence.reload();
    }
  } catch (driveErr) {
    console.warn('[StrategicDrive] No se pudo sincronizar de inmediato a Drive; se encola en segundo plano:', driveErr.message);
    await enqueueSync({ entityId: evidence.id, createdBy: req.user.id });
  }

  await refreshActionRepository(item.actionPlan.term_id, req, 'evidence_uploaded');
  await audit(req, 'evidence.upload', 'evidence', evidence.id, null, { ...evidence.toJSON(), storage_key: '[PRIVATE]' });
  res.status(201);
  ok(res, evidence, driveSyncSuccess
    ? 'Evidencia cargada y respaldada de inmediato en la carpeta de la actividad en Google Drive.'
    : 'Evidencia almacenada temporalmente y programada para sincronización con Drive.'
  );
});

const downloadEvidence = wrap(async (req, res) => {
  const evidence = await StrategicEvidence.findByPk(req.params.evidenceId);
  if (!evidence || evidence.deleted_at) throw Object.assign(new Error('Evidencia no encontrada.'), { statusCode: 404 });
  
  const driveUrl = evidence.drive_file_id ? `https://drive.google.com/file/d/${evidence.drive_file_id}/view` : null;
  if (req.query.drive === 'true' && driveUrl) {
    return res.redirect(driveUrl);
  }

  const fullPath = path.resolve(evidence.storage_key);
  if (!fs.existsSync(fullPath)) {
    if (driveUrl) {
      return res.redirect(driveUrl);
    }
    throw Object.assign(new Error('El archivo físico de la evidencia no se encuentra en el servidor ni en Google Drive.'), { statusCode: 404 });
  }

  const ext = path.extname(evidence.original_name || '').toLowerCase();
  const mimeMap = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.txt': 'text/plain',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.doc': 'application/msword'
  };
  const mimeType = evidence.mime_type || mimeMap[ext] || 'application/octet-stream';

  if (req.query.preview === 'true') {
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(evidence.original_name)}"`);
    return res.sendFile(fullPath);
  }
  res.download(fullPath, evidence.original_name);
});

const retrySync = wrap(async (req, res) => {
  const evidence = await StrategicEvidence.findByPk(req.params.evidenceId);
  if (!evidence) throw Object.assign(new Error('Evidencia no encontrada.'), { statusCode: 404 });
  await evidence.update({ sync_status: 'pending' });
  ok(res, await enqueueSync({ entityId: evidence.id, createdBy: req.user.id, payload: { manual_retry: true } }), 'Reintento programado.');
});

const getActionItemDriveFolder = wrap(async (req, res) => {
  const item = await StrategicActionItem.findByPk(req.params.itemId, {
    include: [{ model: StrategicEvidence, as: 'evidence', where: { deleted_at: null }, required: false }]
  });
  if (!item) throw Object.assign(new Error('Actividad no encontrada.'), { statusCode: 404 });
  const periodId = req.query.periodId || null;
  const syncedEvidence = (item.evidence || []).find((e) => periodId ? (String(e.monitoring_period_id) === String(periodId) && e.drive_folder_id) : e.drive_folder_id);
  if (syncedEvidence) {
    return ok(res, {
      folderId: syncedEvidence.drive_folder_id,
      folderUrl: `https://drive.google.com/drive/folders/${syncedEvidence.drive_folder_id}`
    });
  }
  try {
    const folderInfo = await getActivityDriveFolder(item.id, periodId);
    return ok(res, folderInfo);
  } catch (e) {
    return ok(res, { folderId: null, folderUrl: null, message: e.message });
  }
});

const getActionPlanMinutesDriveFolder = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      { model: StrategicMeeting, as: 'meetings', required: false, include: [{ model: StrategicMinuteVersion, as: 'minuteVersions', required: false }] }
    ]
  });
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });

  for (const meeting of actionPlan.meetings || []) {
    for (const v of meeting.minuteVersions || []) {
      const folderId = v.content?.drive_folder_id;
      if (folderId) {
        return ok(res, {
          folderId,
          folderUrl: `https://drive.google.com/drive/folders/${folderId}`
        });
      }
    }
  }

  try {
    const folderInfo = await getMinutesDriveFolder(actionPlan.id);
    return ok(res, folderInfo);
  } catch (e) {
    return ok(res, { folderId: null, folderUrl: null, message: e.message });
  }
});

const reconcile = wrap(async (req, res) => ok(res, await reconcileTerm(req.params.termId, req.user.id), 'Conciliación programada.'));
const syncActionRepository = wrap(async (req, res) => {
  const result = await syncActionPlanRepositoryTerm(req.params.termId);
  await audit(req, 'action_repository.sync', 'term', req.params.termId, null, result);
  ok(res, result, `Repositorio ${result.year} sincronizado correctamente.`);
});

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
    const formSchema = await captureActionPlanSchema(term.strategic_plan_id, transaction);
    const [plan] = await StrategicActionPlan.findOrCreate({
      where: { code: cleanCode(req.body.action_plan_code || `${term.year}-${unit.code}`) },
      defaults: { term_id: term.id, catalog_item_id: unit.id, responsible_user_id: req.body.responsible_user_id || null, title: req.body.title || `Plan de Acción ${unit.name} ${term.year}`, status: 'formulation', instrument_version: formSchema.configuration_version, metadata: { historical_import_id: batch.id, form_schema: formSchema }, created_by: req.user.id, updated_by: req.user.id }, transaction
    });
    await ensureActionPlanSchemaSnapshot(plan, transaction);
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
  await refreshActionRepository(term.id, req, 'historical_activities_imported');
  ok(res, actionPlan, 'Importación histórica confirmada transaccionalmente.');
});

const exportActionPlan = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      {
        model: StrategicTerm, as: 'term',
        include: [
          { model: StrategicPlan, as: 'strategicPlan' },
          { model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }
        ]
      },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      {
        model: StrategicActionItem, as: 'items',
        where: { deleted_at: null },
        required: false,
        include: [
          {
            model: StrategicMonitoringResult, as: 'monitoringResults',
            required: false,
            include: [{ model: StrategicMonitoringPeriod, as: 'period' }]
          }
        ]
      }
    ]
  });
  if (!actionPlan) throw Object.assign(new Error('Plan no encontrado.'), { statusCode: 404 });
  const buffer = await buildOfficialWorkbook(actionPlan);
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="DIR-PE-FR-003_${actionPlan.code}_${actionPlan.term?.year || ''}.xlsx"`);
  res.send(buffer);
});

const syncPlanDriveExcel = wrap(async (req, res) => {
  const actionPlan = await StrategicActionPlan.findByPk(req.params.id);
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  const result = await syncSinglePlanOfficialWorkbook(actionPlan.id);
  await audit(req, 'action_plan.sync_drive_excel', 'action_plan', actionPlan.id, null, result, 'Sincronización manual de Plan de Acción Oficial DIR-PE-FR-003 en Drive');
  ok(res, result, 'Plan de acción sincronizado exitosamente con Google Drive.');
});

const analytics = wrap(async (req, res) => {
  const plans = await findActionPlans({ ...req.query, includeItems: true }); const planIds = plans.map((p) => p.id); const items = plans.flatMap((p) => p.items || []);
  const budget = planIds.length ? await StrategicBudgetMovement.findAll({ include: [{ model: StrategicActionItem, as: 'actionItem', required: false }], where: req.query.termId ? { term_id: req.query.termId } : {} }).catch(() => []) : [];
  const evidences = items.length ? await StrategicEvidence.findAll({ where: { action_item_id: { [Op.in]: items.map((i) => i.id) }, deleted_at: null } }) : [];
  ok(res, { plans: plans.length, activities: items.length, physical_progress: items.length ? items.reduce((s, i) => s + Number(i.current_progress || 0), 0) / items.length : 0, evidence: { total: evidences.length, pending: evidences.filter((e) => e.sync_status !== 'synced').length }, budget: budget.reduce((acc, row) => ({ ...acc, [row.movement_type]: Number(acc[row.movement_type] || 0) + Number(row.amount || 0) }), {}) });
});

const getPedLiveStatistics = wrap(async (req, res) => {
  const data = await getPlanStatistics({
    planId: req.query.planId || null,
    termId: req.query.termId || null,
    year: req.query.year || null,
    catalogItemId: req.query.catalogItemId || null
  });
  ok(res, data);
});

const listAudit = wrap(async (req, res) => ok(res, await StrategicAuditEvent.findAll({ where: req.query.entity_type ? { entity_type: req.query.entity_type } : {}, limit: Math.min(500, Number(req.query.limit || 100)), order: [['created_at', 'DESC']] })));
const listSyncJobs = wrap(async (_req, res) => ok(res, await StrategicSyncJob.findAll({ limit: 200, order: [['created_at', 'DESC']] })));

const clean = (val, max = 500) => String(val || '').trim().slice(0, max);

const loadPlanForCalendar = async (req) => {
  const plan = await StrategicActionPlan.findByPk(req.params.id, {
    include: [
      { model: StrategicTerm, as: 'term' },
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      {
        model: StrategicResponsibility,
        as: 'currentResponsibility',
        required: false,
        include: [{ model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'cargo', 'dependencia'] }]
      },
      { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'cargo', 'dependencia'] }
    ]
  });
  if (!plan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });

  const organizer = {
    name: formatPersonName(req.user.nombre || 'Organizador de la reunión'),
    email: clean(req.user.email, 254).toLowerCase()
  };
  if (!organizer?.email) {
    throw Object.assign(new Error('Su usuario no tiene un correo institucional registrado para organizar la reunión.'), { statusCode: 422 });
  }
  return { plan, organizer };
};

const loadPlanCalendarConnection = async (userId, organizerEmail) => {
  const connection = await GoogleCalendarConnection.findOne({ where: { user_id: userId } });
  const expectedEmail = clean(organizerEmail, 254).toLowerCase();
  const connected = Boolean(
    connection
    && connection.status === 'connected'
    && clean(connection.google_email, 254).toLowerCase() === expectedEmail
  );
  return { connection, connected };
};

const publicPlanCalendarConnection = (connection, connected) => ({
  connected,
  email: connected ? connection.google_email : null,
  connected_at: connected ? connection.connected_at : null,
  last_used_at: connected ? connection.last_used_at : null
});

const isPlanCalendarAuthError = (error) => {
  const code = error?.code;
  const status = Number(error?.response?.status || error?.status || 0);
  const detail = [
    error?.message,
    error?.response?.data?.error,
    error?.response?.data?.error_description
  ].filter(Boolean).join(' ');
  return Number(code) === 401
    || status === 401
    || ['unauthorized_client', 'access_denied', 'invalid_grant'].includes(code)
    || /unauthorized|forbidden|invalid_grant|token has been expired or revoked/i.test(detail);
};

const preparePlanCalendarError = (error) => {
  if (isPlanCalendarAuthError(error)) {
    error.statusCode = 409;
    error.code = 'CALENDAR_AUTH_REVOKED';
    error.message = 'Google Calendar rechazó o revocó la autorización. Vuelva a conectar la cuenta institucional y luego programe la reunión.';
    error.data = { ...(error.data || {}), connection_invalid: true };
    return error;
  }
  if (error.statusCode) return error;
  if (['CALENDAR_NOT_CONFIGURED', 'CALENDAR_OAUTH_NOT_CONFIGURED'].includes(error.code)) error.statusCode = 503;
  else if (error.code === 'CALENDAR_NOT_CONNECTED') error.statusCode = 409;
  else if (['INVALID_CALENDAR_RANGE', 'INVALID_CALENDAR_ORGANIZER'].includes(error.code)) error.statusCode = 422;
  else {
    error.statusCode = 502;
  }
  return error;
};

const persistPlanCalendarConnectionError = async (connection, error) => {
  const prepared = preparePlanCalendarError(error);
  if (prepared.data?.connection_invalid && connection) {
    await connection.update({
      status: 'revoked',
      last_error: clean(prepared.message, 2000),
      last_used_at: new Date()
    }).catch(() => {});
  }
  return prepared;
};

const getPlanCalendarSchedule = wrap(async (req, res) => {
  const { plan, organizer } = await loadPlanForCalendar(req);
  const schedule = await StrategicMeetingSchedule.findOne({
    include: [{
      model: StrategicMeeting,
      as: 'meeting',
      required: true,
      where: { action_plan_id: plan.id }
    }],
    where: { status: 'scheduled' },
    order: [['start_at', 'ASC']]
  });
  const { connection, connected } = await loadPlanCalendarConnection(req.user.id, organizer.email);
  ok(res, {
    configuration: getCalendarConfiguration(),
    organizer,
    connection: publicPlanCalendarConnection(connection, connected),
    schedule: schedule ? schedule.toJSON() : null
  });
});

const listPlanUpcomingCalendar = wrap(async (req, res) => {
  const { plan } = await loadPlanForCalendar(req);
  const schedules = await StrategicMeetingSchedule.findAll({
    include: [{
      model: StrategicMeeting,
      as: 'meeting',
      required: true,
      where: { action_plan_id: plan.id }
    }],
    where: {
      status: 'scheduled',
      end_at: { [Op.gte]: new Date() }
    },
    order: [['start_at', 'ASC']],
    limit: 50
  });
  ok(res, schedules.map((s) => ({
    ...s.toJSON(),
    plan: {
      id: plan.id,
      code: plan.code,
      title: s.summary
    }
  })));
});

const startPlanCalendarConnect = wrap(async (req, res) => {
  const { organizer } = await loadPlanForCalendar(req);
  const configuration = getOAuthConfiguration();
  if (!configuration.configured) {
    throw Object.assign(new Error(configuration.message), { statusCode: 503 });
  }
  const url = createAuthorizationUrl({ userId: req.user.id, expectedEmail: organizer.email });
  ok(res, { url, expected_email: organizer.email });
});

const disconnectPlanCalendar = wrap(async (req, res) => {
  const { organizer } = await loadPlanForCalendar(req);
  const { connection } = await loadPlanCalendarConnection(req.user.id, organizer.email);
  if (connection) await connection.destroy();
  ok(res, null, 'La cuenta de Google Calendar fue desconectada.');
});

const checkPlanCalendarAvailability = wrap(async (req, res) => {
  const { plan, organizer } = await loadPlanForCalendar(req);
  const attendees = normalizeAttendees(req.body.attendees);
  let connection = null;
  try {
    const existing = await StrategicMeetingSchedule.findOne({
      include: [{
        model: StrategicMeeting,
        as: 'meeting',
        required: true,
        where: { action_plan_id: plan.id }
      }],
      where: { status: 'scheduled' }
    });
    const loadedConnection = await loadPlanCalendarConnection(req.user.id, organizer.email);
    connection = loadedConnection.connection;
    const { connected } = loadedConnection;
    if (!connected) throw Object.assign(new Error('Conecte su cuenta institucional de Google Calendar antes de consultar disponibilidad.'), { code: 'CALENDAR_NOT_CONNECTED' });
    const authClient = createConnectedOAuthClient(connection);
    const availability = await checkAvailability({
      organizerEmail: organizer.email,
      organizerName: organizer.name,
      attendees,
      startAt: req.body.start_at,
      endAt: req.body.end_at,
      ignoreBusyRange: existing?.google_event_id && existing.status !== 'cancelled'
        ? { startAt: existing.start_at, endAt: existing.end_at }
        : null,
      authClient
    });
    await connection.update({ last_used_at: new Date(), last_error: null });
    ok(res, { organizer, availability });
  } catch (error) {
    throw await persistPlanCalendarConnectionError(connection, error);
  }
});

const suggestPlanCalendarSlots = wrap(async (req, res) => {
  const { plan, organizer } = await loadPlanForCalendar(req);
  const { connection, connected } = await loadPlanCalendarConnection(req.user.id, organizer.email);
  if (!connected) throw Object.assign(new Error('Conecte su cuenta institucional de Google Calendar antes de buscar horarios.'), { statusCode: 409 });
  try {
    const existing = await StrategicMeetingSchedule.findOne({
      include: [{
        model: StrategicMeeting,
        as: 'meeting',
        required: true,
        where: { action_plan_id: plan.id }
      }],
      where: { status: 'scheduled' }
    });
    const suggestions = await findAvailableSlots({
      organizerEmail: organizer.email,
      organizerName: organizer.name,
      attendees: normalizeAttendees(req.body.attendees),
      startAt: req.body.start_at,
      endAt: req.body.end_at,
      days: req.body.days,
      ignoreBusyRange: existing?.google_event_id && existing.status !== 'cancelled'
        ? { startAt: existing.start_at, endAt: existing.end_at }
        : null,
      authClient: createConnectedOAuthClient(connection)
    });
    await connection.update({ last_used_at: new Date(), last_error: null });
    ok(res, suggestions);
  } catch (error) {
    throw await persistPlanCalendarConnectionError(connection, error);
  }
});

const savePlanCalendarSchedule = wrap(async (req, res) => {
  const { plan, organizer } = await loadPlanForCalendar(req);
  const summary = clean(req.body.summary, 240);
  const attendees = normalizeAttendees(req.body.attendees);
  if (!summary) throw Object.assign(new Error('Digite el título de la reunión de seguimiento.'), { statusCode: 422 });
  const requestedStart = new Date(req.body.start_at);
  if (Number.isNaN(requestedStart.getTime()) || requestedStart <= new Date()) {
    throw Object.assign(new Error('La reunión de seguimiento debe programarse en una fecha y hora futuras.'), { statusCode: 422 });
  }

  let existing = null;
  if (req.body.scheduleId) {
    existing = await StrategicMeetingSchedule.findByPk(req.body.scheduleId, {
      include: [{ model: StrategicMeeting, as: 'meeting', where: { action_plan_id: plan.id } }]
    });
  }
  if (!existing) {
    existing = await StrategicMeetingSchedule.findOne({
      include: [{
        model: StrategicMeeting,
        as: 'meeting',
        required: true,
        where: { action_plan_id: plan.id }
      }],
      where: { status: 'scheduled' }
    });
  }

  const isUpdatingExistingEvent = Boolean(existing?.google_event_id && existing.status !== 'cancelled');
  const { connection, connected } = await loadPlanCalendarConnection(req.user.id, organizer.email);
  if (!connected) throw Object.assign(new Error('Conecte su cuenta institucional de Google Calendar antes de programar la reunión.'), { statusCode: 409 });
  const authClient = createConnectedOAuthClient(connection);

  let availability;
  try {
    availability = await checkAvailability({
      organizerEmail: organizer.email,
      organizerName: organizer.name,
      attendees,
      startAt: req.body.start_at,
      endAt: req.body.end_at,
      ignoreBusyRange: isUpdatingExistingEvent
        ? { startAt: existing.start_at, endAt: existing.end_at }
        : null,
      authClient
    });
  } catch (error) {
    throw await persistPlanCalendarConnectionError(connection, error);
  }

  const busyPeople = availability.filter((person) => person.status === 'busy');
  if (busyPeople.length && req.body.force !== true) {
    const error = Object.assign(new Error('Algunos participantes están ocupados en este horario.'), {
      statusCode: 409,
      data: { availability }
    });
    throw error;
  }

  try {
    const event = await saveCalendarEvent({
      organizerEmail: organizer.email,
      minuteId: plan.id,
      minuteCode: plan.code,
      eventId: isUpdatingExistingEvent ? existing.google_event_id : null,
      summary,
      description: clean(req.body.description || `Reunión de seguimiento del Plan de Acción ${plan.code} (${plan.organizationalUnit?.name || ''} - Vigencia ${plan.term?.year || ''}).`, 4000),
      location: clean(req.body.location, 500),
      startAt: req.body.start_at,
      endAt: req.body.end_at,
      attendees,
      authClient
    });
    await connection.update({ last_used_at: new Date(), last_error: null });

    const values = {
      organizer_email: organizer.email,
      summary,
      description: clean(req.body.description || `Reunión de seguimiento del Plan de Acción ${plan.code}.`, 4000),
      location: clean(req.body.location, 500),
      start_at: new Date(req.body.start_at),
      end_at: new Date(req.body.end_at),
      timezone: getCalendarConfiguration().timezone,
      attendees,
      google_event_id: event.id,
      google_event_url: event.htmlLink || null,
      status: 'scheduled',
      last_error: null,
      updated_by: req.user.id
    };

    let meetingRecord;
    if (existing?.meeting_id) {
      meetingRecord = await StrategicMeeting.findByPk(existing.meeting_id);
      if (meetingRecord) {
        await meetingRecord.update({
          title: summary,
          starts_at: new Date(req.body.start_at),
          ends_at: new Date(req.body.end_at),
          location: clean(req.body.location, 500) || null,
          updated_by: req.user.id
        });
      }
    }
    if (!meetingRecord) {
      meetingRecord = await StrategicMeeting.create({
        action_plan_id: plan.id,
        title: summary,
        type: 'monitoring',
        starts_at: new Date(req.body.start_at),
        ends_at: new Date(req.body.end_at),
        location: clean(req.body.location, 500) || null,
        modality: 'Virtual / Presencial',
        objective: `Reunión de seguimiento para el Plan de Acción ${plan.code}`,
        development: 'Sesión de seguimiento a las actividades y metas del plan.',
        commitments: [],
        status: 'scheduled',
        created_by: req.user.id,
        updated_by: req.user.id
      });
    }

    for (const att of attendees) {
      if (!att.email) continue;
      const matchedUser = await User.findOne({ where: { email: { [Op.iLike]: att.email } } });
      await StrategicMeetingParticipant.findOrCreate({
        where: { meeting_id: meetingRecord.id, email: att.email.toLowerCase() },
        defaults: {
          meeting_id: meetingRecord.id,
          user_id: matchedUser?.id || null,
          participant_type: matchedUser ? 'internal' : 'external',
          meeting_role: att.source === 'responsible' ? 'principal' : 'participant',
          document: att.document || matchedUser?.username || null,
          name: att.name || matchedUser?.nombre || att.email,
          email: att.email.toLowerCase(),
          organization: matchedUser?.dependencia || 'UNICESMAG',
          role_title: matchedUser?.cargo || null,
          status: 'invited'
        }
      });
    }

    const schedule = existing
      ? await existing.update(values)
      : await StrategicMeetingSchedule.create({ ...values, meeting_id: meetingRecord.id, created_by: req.user.id });

    ok(res, { schedule: schedule.toJSON(), availability }, isUpdatingExistingEvent ? 'La reunión de seguimiento fue actualizada en Google Calendar.' : 'La reunión de seguimiento fue programada en Google Calendar.');
  } catch (error) {
    const prepared = await persistPlanCalendarConnectionError(connection, error);
    if (existing) await existing.update({
      status: existing.google_event_id && existing.status !== 'cancelled' ? 'scheduled' : 'error',
      last_error: clean(prepared.message, 2000),
      updated_by: req.user.id
    }).catch(() => {});
    if (prepared.statusCode === 502) prepared.message = `Google Calendar no pudo programar la reunión: ${prepared.message}`;
    throw prepared;
  }
});

const cancelPlanCalendarSchedule = wrap(async (req, res) => {
  const { plan, organizer } = await loadPlanForCalendar(req);
  const scheduleId = req.query.scheduleId || req.body?.scheduleId;
  let schedule = null;
  if (scheduleId) {
    schedule = await StrategicMeetingSchedule.findByPk(scheduleId, {
      include: [{ model: StrategicMeeting, as: 'meeting', where: { action_plan_id: plan.id } }]
    });
  }
  if (!schedule) {
    schedule = await StrategicMeetingSchedule.findOne({
      include: [{
        model: StrategicMeeting,
        as: 'meeting',
        required: true,
        where: { action_plan_id: plan.id }
      }],
      where: { status: 'scheduled' },
      order: [['start_at', 'DESC']]
    });
  }

  if (!schedule || schedule.status === 'cancelled') {
    throw Object.assign(new Error('Esta reunión ya no está programada.'), { statusCode: 404 });
  }

  const { connection, connected } = await loadPlanCalendarConnection(req.user.id, organizer.email);
  if (!connected) {
    throw Object.assign(new Error('Conecte su cuenta de Google Calendar antes de cancelar la reunión.'), { statusCode: 409 });
  }

  try {
    await cancelCalendarEvent({
      eventId: schedule.google_event_id,
      authClient: createConnectedOAuthClient(connection)
    });
    await schedule.update({ status: 'cancelled', last_error: null, updated_by: req.user.id });
    if (schedule.meeting_id) {
      await StrategicMeeting.update(
        { status: 'cancelled', updated_by: req.user.id },
        { where: { id: schedule.meeting_id } }
      ).catch(() => {});
    }
    await connection.update({ last_used_at: new Date(), last_error: null });
    ok(res, { id: schedule.id, status: 'cancelled' }, 'La reunión fue cancelada en Google Calendar y se notificó a los invitados.');
  } catch (error) {
    await schedule.update({ last_error: clean(error.message, 2000), updated_by: req.user.id }).catch(() => {});
    throw await persistPlanCalendarConnectionError(connection, error);
  }
});

const listStrategicNotifications = wrap(async (req, res) => {
  const userId = req.user.id;

  const notifications = await StrategicNotification.findAll({
    where: { user_id: userId },
    order: [['created_at', 'DESC']],
    limit: 50
  });

  const unreadCount = await StrategicNotification.count({
    where: {
      user_id: userId,
      read: false
    }
  });

  ok(res, { notifications, unreadCount });
});

const markStrategicNotificationRead = wrap(async (req, res) => {
  const notification = await StrategicNotification.findByPk(req.params.id);
  if (!notification) throw Object.assign(new Error('Notificación no encontrada.'), { statusCode: 404 });
  await notification.update({ read: true, read_at: new Date() });
  ok(res, notification, 'Notificación marcada como leída.');
});

const markAllStrategicNotificationsRead = wrap(async (req, res) => {
  const userId = req.user.id;

  await StrategicNotification.update(
    { read: true, read_at: new Date() },
    { where: { user_id: userId, read: false } }
  );

  ok(res, null, 'Todas las notificaciones han sido marcadas como leídas.');
});

module.exports = {
  bootstrap, listPlans, createPlan, updatePlan, deletePlan, createLevel, updateLevel, deleteLevel,
  createElement, updateElement, deleteElement, listStructure, upsertCatalog, updateCatalog, deleteCatalog,
  applyInstitutionalTemplate, createFieldDefinition, updateFieldDefinition, deleteFieldDefinition, reorderFieldDefinitions, previewFieldSchema, confirmFieldSchema,
  downloadReferenceTemplate, referencePreview, referenceConfirm, leaderOptions, lookupMeetingParticipant, searchMeetingParticipants, termDependencies, downloadTermDependencyTemplate,
  termDependencyPreview, termDependencyConfirm, createTermDependency, deleteTermDependency, transferLeader, createTerm, updateTerm, deleteTerm,
  listActionPlans, getMyActionPlans, getActionPlan, createActionPlan, updateActionPlan, updateStage1Timeline, deleteActionPlan, bulkDeleteActionPlans, bulkCreateActionPlans, addActionItem, reviewExecutionActionItem, downloadDynamicItemTemplate, previewDynamicItems, confirmDynamicItems, updateActionItem, deleteActionItem,
  transitionActionPlan, sendActionPlanChatMessage, saveMonitoring, createMeeting, updateMeeting,
  improveMinuteText, generateMinuteSummary, createMinuteVersion, publishMinute, addProposal, resolveProposal,
  getPublicMinute, requestExternalOtp, signInternal, signExternal, registerUserSignature, downloadMinuteWord, downloadMinutePdf, validateMinute, finalizeMinute,
  uploadEvidence, downloadEvidence, retrySync, getActionItemDriveFolder, getActionPlanMinutesDriveFolder, reconcile, syncActionRepository, closeTerm, previewBudget, confirmBudget, reverseBudget,
  previewHistorical, confirmHistorical, exportActionPlan, syncPlanDriveExcel, analytics, getPedLiveStatistics, listAudit, listSyncJobs,
  getPlanCalendarSchedule, listPlanUpcomingCalendar, startPlanCalendarConnect, disconnectPlanCalendar,
  checkPlanCalendarAvailability, suggestPlanCalendarSlots, savePlanCalendarSchedule, cancelPlanCalendarSchedule,
  listStrategicNotifications, markStrategicNotificationRead, markAllStrategicNotificationsRead
};
