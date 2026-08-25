const { Op, DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User,
  StrategicPlan,
  StrategicLevel,
  StrategicTerm,
  StrategicCatalogItem,
  StrategicFieldDefinition,
  StrategicMonitoringPeriod,
  strategicPlanningModels
} = require('../models');

const DEFAULT_PLAN_CODE = 'PED-2022-2029';

const DEFAULT_FIELDS = [
  ['strategic_objective', 'Objetivo Estratégico', 'strategic_relation', true],
  ['strategic_guideline', 'Lineamiento Estratégico', 'strategic_relation', true],
  ['activity', 'Actividad', 'long_text', true],
  ['indicator_type', 'Tipo de indicador', 'list', false],
  ['starts_on', 'Fecha inicio', 'date', true],
  ['ends_on', 'Fecha fin', 'date', true],
  ['indicator', 'Indicador', 'long_text', true],
  ['target', 'Meta', 'text', true],
  ['responsible', 'Responsable de ejecución', 'catalog', true],
  ['co_responsibles', 'Corresponsables', 'catalog_multi', false],
  ['progress_s1', 'Avance primer periodo', 'percentage', false],
  ['observations_s1', 'Observaciones primer periodo', 'long_text', false],
  ['progress_s2', 'Avance segundo periodo', 'percentage', false],
  ['observations_s2', 'Observaciones segundo periodo', 'long_text', false],
  ['total_progress', 'Total', 'formula', false]
];

const DEFAULT_WORKFLOW = {
  initialState: 'convocation',
  states: [
    { key: 'convocation', label: 'Convocatoria' },
    { key: 'meeting_scheduled', label: 'Programación de reunión' },
    { key: 'formulation', label: 'Formulación' },
    { key: 'preliminary_minutes', label: 'Acta preliminar' },
    { key: 'technical_review', label: 'Revisión técnica' },
    { key: 'adjustments', label: 'Ajustes' },
    { key: 'owner_validation', label: 'Validación del responsable' },
    { key: 'rectorate_notification', label: 'Información a Rectoría' },
    { key: 'active', label: 'Plan activo' },
    { key: 'monitoring', label: 'Seguimientos' },
    { key: 'closed', label: 'Cierre de vigencia' }
  ],
  transitions: [
    { action: 'schedule_meeting', from: 'convocation', to: 'meeting_scheduled' },
    { action: 'start_formulation', from: 'meeting_scheduled', to: 'formulation' },
    { action: 'submit_preliminary_minutes', from: 'formulation', to: 'preliminary_minutes' },
    { action: 'submit_technical_review', from: 'preliminary_minutes', to: 'technical_review' },
    { action: 'request_adjustments', from: 'technical_review', to: 'adjustments' },
    { action: 'resubmit_technical_review', from: 'adjustments', to: 'technical_review' },
    { action: 'submit_owner_validation', from: 'technical_review', to: 'owner_validation' },
    { action: 'request_owner_adjustments', from: 'owner_validation', to: 'adjustments' },
    { action: 'notify_rectorate', from: 'owner_validation', to: 'rectorate_notification' },
    { action: 'activate', from: 'rectorate_notification', to: 'active' },
    { action: 'start_monitoring', from: 'active', to: 'monitoring' },
    { action: 'close', from: 'monitoring', to: 'closed' }
  ]
};

const ensureColumn = async (table, column, definition) => {
  const qi = sequelize.getQueryInterface();
  const description = await qi.describeTable(table).catch(() => null);
  if (description && !description[column]) await qi.addColumn(table, column, definition);
};

const ensureStrategicPlanningColumns = async () => {
  const qi = sequelize.getQueryInterface();
  const catalogDescription = await qi.describeTable('pei_catalog_items').catch(() => null);
  if (catalogDescription?.name && String(catalogDescription.name.type || '').toUpperCase() !== 'TEXT') {
    await qi.changeColumn('pei_catalog_items', 'name', { type: DataTypes.TEXT, allowNull: false });
  }
  await ensureColumn('pei_responsibilities', 'action_plan_id', { type: DataTypes.UUID, allowNull: true });
  await ensureColumn('pei_responsibilities', 'position_catalog_item_id', { type: DataTypes.UUID, allowNull: true });
  await ensureColumn('pei_responsibilities', 'predecessor_id', { type: DataTypes.UUID, allowNull: true });
  await ensureColumn('pei_responsibilities', 'transfer_reason', { type: DataTypes.TEXT, allowNull: true });
  await ensureColumn('pei_responsibilities', 'transferred_at', { type: DataTypes.DATE, allowNull: true });
  await ensureColumn('pei_responsibilities', 'created_by', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('pei_responsibilities', 'ended_by', { type: DataTypes.INTEGER, allowNull: true });
  await ensureColumn('pei_action_plans', 'responsibility_id', { type: DataTypes.UUID, allowNull: true });
  await ensureColumn('pei_meeting_participants', 'external_token_hash', { type: DataTypes.STRING(64), allowNull: true });
  await ensureColumn('pei_meeting_participants', 'otp_hash', { type: DataTypes.STRING(64), allowNull: true });
  await ensureColumn('pei_meeting_participants', 'otp_expires_at', { type: DataTypes.DATE, allowNull: true });
  await ensureColumn('pei_meeting_participants', 'otp_attempts', { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 });
  await ensureColumn('pei_meeting_participants', 'email_verified_at', { type: DataTypes.DATE, allowNull: true });
  await ensureColumn('pei_minute_versions', 'final_pdf_storage_key', { type: DataTypes.STRING(500), allowNull: true });
  await ensureColumn('pei_minute_versions', 'final_pdf_hash', { type: DataTypes.STRING(64), allowNull: true });
};

const syncStrategicPlanningModels = async () => {
  await ensureStrategicPlanningColumns();
  for (const model of strategicPlanningModels) await model.sync();
};

const seedCatalogFromUsers = async (strategicPlanId) => {
  const users = await User.findAll({
    where: { dependencia: { [Op.ne]: null } },
    attributes: ['dependencia'],
    raw: true
  });
  const dependencies = Array.from(new Set(users.map((row) => String(row.dependencia || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));
  for (const [index, name] of dependencies.entries()) {
    const code = `DEP-${String(index + 1).padStart(3, '0')}`;
    await StrategicCatalogItem.findOrCreate({
      where: { strategic_plan_id: strategicPlanId, catalog_type: 'organizational_unit', code },
      defaults: { strategic_plan_id: strategicPlanId, catalog_type: 'organizational_unit', code, name }
    });
  }
};

const ensureStrategicPlanningDefaults = async () => {
  const [plan] = await StrategicPlan.findOrCreate({
    where: { code: DEFAULT_PLAN_CODE },
    defaults: {
      code: DEFAULT_PLAN_CODE,
      name: 'Plan Estratégico de Desarrollo 2022–2029',
      description: 'Plan estratégico institucional configurado como base inicial del nuevo módulo.',
      starts_on: '2022-01-01',
      ends_on: '2029-12-31',
      status: 'active',
      administrative_act: null,
      approved_on: null,
      configuration_version: 1,
      settings: {
        workflow: DEFAULT_WORKFLOW,
        trafficLights: [
          { key: 'red', min: 0, max: 69.99, color: '#dc2626' },
          { key: 'yellow', min: 70, max: 89.99, color: '#d97706' },
          { key: 'green', min: 90, max: 100, color: '#16a34a' }
        ],
        drive: { rootName: 'SIAC-PEI', maxRelativePathLength: 160, account: 'planeacionestrategica@unicesmag.edu.co' }
      }
    }
  });
  if (!Array.isArray(plan.settings?.workflow?.transitions)) {
    await plan.update({ settings: { ...(plan.settings || {}), workflow: DEFAULT_WORKFLOW } });
  }

  for (const [position, name] of ['Objetivo Estratégico', 'Lineamiento Estratégico'].entries()) {
    await StrategicLevel.findOrCreate({
      where: { strategic_plan_id: plan.id, configuration_version: 1, position: position + 1 },
      defaults: { strategic_plan_id: plan.id, name, position: position + 1, configuration_version: 1 }
    });
  }

  for (let year = 2022; year <= 2029; year += 1) {
    const [term] = await StrategicTerm.findOrCreate({
      where: { strategic_plan_id: plan.id, year },
      defaults: {
        strategic_plan_id: plan.id,
        year,
        name: `Vigencia ${year}`,
        starts_on: `${year}-01-01`,
        ends_on: `${year}-12-31`,
        status: year === 2026 ? 'active' : (year < 2026 ? 'closed' : 'planned')
      }
    });
    for (const period of [
      { code: 'S1', name: 'Seguimiento 1', starts_on: `${year}-01-01`, ends_on: `${year}-06-30`, position: 1, weight: 0.5 },
      { code: 'S2', name: 'Seguimiento 2 / Cierre', starts_on: `${year}-07-01`, ends_on: `${year}-12-31`, position: 2, weight: 0.5 }
    ]) {
      await StrategicMonitoringPeriod.findOrCreate({
        where: { term_id: term.id, code: period.code },
        defaults: { term_id: term.id, ...period, status: year === 2026 ? 'active' : 'planned' }
      });
    }
  }

  for (const [position, [key, label, dataType, required]] of DEFAULT_FIELDS.entries()) {
    await StrategicFieldDefinition.findOrCreate({
      where: { strategic_plan_id: plan.id, key, configuration_version: 1 },
      defaults: {
        strategic_plan_id: plan.id,
        key,
        label,
        data_type: dataType,
        required,
        position: position + 1,
        configuration_version: 1,
        validation_rules: dataType === 'percentage' ? { min: 0, max: 100 } : {},
        formula: key === 'total_progress' ? 'progress_s1 + progress_s2' : null
      }
    });
  }

  await seedCatalogFromUsers(plan.id);
  return plan;
};

module.exports = { DEFAULT_PLAN_CODE, DEFAULT_FIELDS, DEFAULT_WORKFLOW, ensureStrategicPlanningColumns, syncStrategicPlanningModels, ensureStrategicPlanningDefaults };
