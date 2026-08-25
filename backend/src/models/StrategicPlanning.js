const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const commonOptions = (tableName, indexes = []) => ({
  tableName,
  freezeTableName: true,
  underscored: true,
  // Nombres explícitos y cortos: PostgreSQL trunca identificadores a 63 bytes;
  // los nombres automáticos largos pueden colisionar en sincronizaciones repetidas.
  indexes: indexes.map((index, position) => ({
    ...index,
    name: index.name || `${tableName}_idx_${position + 1}`
  }))
});

const uuidPk = () => ({ type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true });
const userId = (allowNull = true) => ({ type: DataTypes.INTEGER, allowNull });

const StrategicPlan = sequelize.define('StrategicPlan', {
  id: uuidPk(),
  code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  name: { type: DataTypes.STRING(240), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  starts_on: { type: DataTypes.DATEONLY, allowNull: false },
  ends_on: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'draft' },
  approval_document: { type: DataTypes.STRING(500), allowNull: true },
  administrative_act: { type: DataTypes.STRING(240), allowNull: true },
  approved_on: { type: DataTypes.DATEONLY, allowNull: true },
  global_budget: { type: DataTypes.DECIMAL(20, 2), allowNull: true },
  responsible_user_id: userId(),
  configuration_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  drive_root_id: { type: DataTypes.STRING(160), allowNull: true },
  settings: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  created_by: userId(),
  updated_by: userId(),
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_strategic_plans', [{ fields: ['status'] }]));

const StrategicLevel = sequelize.define('StrategicLevel', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  name: { type: DataTypes.STRING(120), allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false },
  configuration_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, commonOptions('pei_structure_levels', [{ unique: true, fields: ['strategic_plan_id', 'configuration_version', 'position'] }]));

const StrategicElement = sequelize.define('StrategicElement', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  level_id: { type: DataTypes.UUID, allowNull: false },
  parent_id: { type: DataTypes.UUID, allowNull: true },
  code: { type: DataTypes.STRING(60), allowNull: false },
  name: { type: DataTypes.TEXT, allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_strategic_elements', [{ unique: true, fields: ['strategic_plan_id', 'code', 'version'] }, { fields: ['parent_id'] }]));

const StrategicTerm = sequelize.define('StrategicTerm', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  year: { type: DataTypes.INTEGER, allowNull: false },
  name: { type: DataTypes.STRING(120), allowNull: false },
  starts_on: { type: DataTypes.DATEONLY, allowNull: false },
  ends_on: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'planned' },
  closed_at: { type: DataTypes.DATE, allowNull: true },
  closed_by: userId()
}, commonOptions('pei_terms', [{ unique: true, fields: ['strategic_plan_id', 'year'] }, { fields: ['status'] }]));

const StrategicCatalogItem = sequelize.define('StrategicCatalogItem', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  catalog_type: { type: DataTypes.STRING(40), allowNull: false },
  code: { type: DataTypes.STRING(60), allowNull: false },
  name: { type: DataTypes.TEXT, allowNull: false },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  starts_on: { type: DataTypes.DATEONLY, allowNull: true },
  ends_on: { type: DataTypes.DATEONLY, allowNull: true },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, commonOptions('pei_catalog_items', [{ unique: true, fields: ['strategic_plan_id', 'catalog_type', 'code'] }]));

const StrategicResponsibility = sequelize.define('StrategicResponsibility', {
  id: uuidPk(),
  term_id: { type: DataTypes.UUID, allowNull: false },
  catalog_item_id: { type: DataTypes.UUID, allowNull: false },
  action_plan_id: { type: DataTypes.UUID, allowNull: true },
  position_catalog_item_id: { type: DataTypes.UUID, allowNull: true },
  user_id: userId(),
  responsibility_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'owner' },
  starts_on: { type: DataTypes.DATEONLY, allowNull: true },
  ends_on: { type: DataTypes.DATEONLY, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'active' },
  predecessor_id: { type: DataTypes.UUID, allowNull: true },
  transfer_reason: { type: DataTypes.TEXT, allowNull: true },
  transferred_at: { type: DataTypes.DATE, allowNull: true },
  created_by: userId(),
  ended_by: userId()
}, commonOptions('pei_responsibilities', [{ fields: ['term_id', 'status'] }, { fields: ['action_plan_id', 'status'] }]));

const StrategicFieldDefinition = sequelize.define('StrategicFieldDefinition', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  key: { type: DataTypes.STRING(80), allowNull: false },
  label: { type: DataTypes.STRING(180), allowNull: false },
  data_type: { type: DataTypes.STRING(30), allowNull: false },
  required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  position: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  validation_rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  formula: { type: DataTypes.STRING(500), allowNull: true },
  configuration_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true }
}, commonOptions('pei_field_definitions', [{ unique: true, fields: ['strategic_plan_id', 'key', 'configuration_version'] }]));

const StrategicMonitoringPeriod = sequelize.define('StrategicMonitoringPeriod', {
  id: uuidPk(),
  term_id: { type: DataTypes.UUID, allowNull: false },
  code: { type: DataTypes.STRING(30), allowNull: false },
  name: { type: DataTypes.STRING(120), allowNull: false },
  starts_on: { type: DataTypes.DATEONLY, allowNull: false },
  ends_on: { type: DataTypes.DATEONLY, allowNull: false },
  position: { type: DataTypes.INTEGER, allowNull: false },
  weight: { type: DataTypes.DECIMAL(6, 4), allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'planned' },
  closed_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_monitoring_periods', [{ unique: true, fields: ['term_id', 'code'] }]));

const StrategicActionPlan = sequelize.define('StrategicActionPlan', {
  id: uuidPk(),
  term_id: { type: DataTypes.UUID, allowNull: false },
  catalog_item_id: { type: DataTypes.UUID, allowNull: false },
  responsible_user_id: userId(),
  responsibility_id: { type: DataTypes.UUID, allowNull: true },
  code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  title: { type: DataTypes.STRING(300), allowNull: false },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'draft' },
  workflow_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  instrument_version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  created_by: userId(false),
  updated_by: userId(),
  activated_at: { type: DataTypes.DATE, allowNull: true },
  closed_at: { type: DataTypes.DATE, allowNull: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_action_plans', [{ fields: ['term_id', 'status'] }, { fields: ['catalog_item_id'] }]));

const StrategicActionItem = sequelize.define('StrategicActionItem', {
  id: uuidPk(),
  action_plan_id: { type: DataTypes.UUID, allowNull: false },
  strategic_element_id: { type: DataTypes.UUID, allowNull: true },
  code: { type: DataTypes.STRING(60), allowNull: false },
  activity: { type: DataTypes.TEXT, allowNull: false },
  indicator_type: { type: DataTypes.STRING(120), allowNull: true },
  indicator: { type: DataTypes.TEXT, allowNull: true },
  target: { type: DataTypes.STRING(300), allowNull: true },
  starts_on: { type: DataTypes.DATEONLY, allowNull: true },
  ends_on: { type: DataTypes.DATEONLY, allowNull: true },
  responsible_catalog_item_id: { type: DataTypes.UUID, allowNull: true },
  co_responsibles: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  custom_values: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  current_progress: { type: DataTypes.DECIMAL(7, 2), allowNull: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'active' },
  created_by: userId(),
  updated_by: userId(),
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_action_items', [{ unique: true, fields: ['action_plan_id', 'code'] }, { fields: ['strategic_element_id'] }]));

const StrategicActionItemVersion = sequelize.define('StrategicActionItemVersion', {
  id: uuidPk(),
  action_item_id: { type: DataTypes.UUID, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  snapshot: { type: DataTypes.JSONB, allowNull: false },
  justification: { type: DataTypes.TEXT, allowNull: true },
  meeting_id: { type: DataTypes.UUID, allowNull: true },
  created_by: userId(false)
}, commonOptions('pei_action_item_versions', [{ unique: true, fields: ['action_item_id', 'version'] }]));

const StrategicWorkflowEvent = sequelize.define('StrategicWorkflowEvent', {
  id: uuidPk(),
  action_plan_id: { type: DataTypes.UUID, allowNull: false },
  from_state: { type: DataTypes.STRING(40), allowNull: true },
  to_state: { type: DataTypes.STRING(40), allowNull: false },
  action: { type: DataTypes.STRING(60), allowNull: false },
  comment: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  performed_by: userId(false),
  ip_address: { type: DataTypes.STRING(80), allowNull: true },
  session_id: { type: DataTypes.STRING(160), allowNull: true }
}, commonOptions('pei_workflow_events', [{ fields: ['action_plan_id', 'created_at'] }]));

const StrategicMeeting = sequelize.define('StrategicMeeting', {
  id: uuidPk(),
  action_plan_id: { type: DataTypes.UUID, allowNull: false },
  monitoring_period_id: { type: DataTypes.UUID, allowNull: true },
  type: { type: DataTypes.STRING(40), allowNull: false },
  starts_at: { type: DataTypes.DATE, allowNull: false },
  ends_at: { type: DataTypes.DATE, allowNull: true },
  location: { type: DataTypes.STRING(300), allowNull: true },
  modality: { type: DataTypes.STRING(40), allowNull: true },
  objective: { type: DataTypes.TEXT, allowNull: false },
  development: { type: DataTypes.TEXT, allowNull: true },
  commitments: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft' },
  created_by: userId(false),
  updated_by: userId()
}, commonOptions('pei_meetings', [{ fields: ['action_plan_id', 'starts_at'] }]));

const StrategicMeetingParticipant = sequelize.define('StrategicMeetingParticipant', {
  id: uuidPk(),
  meeting_id: { type: DataTypes.UUID, allowNull: false },
  user_id: userId(),
  participant_type: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'internal' },
  name: { type: DataTypes.STRING(240), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: true },
  organization: { type: DataTypes.STRING(240), allowNull: true },
  role_title: { type: DataTypes.STRING(200), allowNull: true },
  signature_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  absence_justification: { type: DataTypes.TEXT, allowNull: true },
  external_token_hash: { type: DataTypes.STRING(64), allowNull: true },
  otp_hash: { type: DataTypes.STRING(64), allowNull: true },
  otp_expires_at: { type: DataTypes.DATE, allowNull: true },
  otp_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  email_verified_at: { type: DataTypes.DATE, allowNull: true },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'invited' }
}, commonOptions('pei_meeting_participants', [{ fields: ['meeting_id', 'email'] }]));

const StrategicMinuteVersion = sequelize.define('StrategicMinuteVersion', {
  id: uuidPk(),
  meeting_id: { type: DataTypes.UUID, allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'draft' },
  content: { type: DataTypes.JSONB, allowNull: false },
  content_hash: { type: DataTypes.STRING(64), allowNull: false },
  public_token_hash: { type: DataTypes.STRING(64), allowNull: true },
  token_expires_at: { type: DataTypes.DATE, allowNull: true },
  published_at: { type: DataTypes.DATE, allowNull: true },
  finalized_at: { type: DataTypes.DATE, allowNull: true },
  finalized_by: userId(),
  final_pdf_storage_key: { type: DataTypes.STRING(500), allowNull: true },
  final_pdf_hash: { type: DataTypes.STRING(64), allowNull: true },
  drive_file_id: { type: DataTypes.STRING(160), allowNull: true },
  created_by: userId(false)
}, commonOptions('pei_minute_versions', [{ unique: true, fields: ['meeting_id', 'version'] }, { unique: true, fields: ['public_token_hash'] }]));

const StrategicMinuteProposal = sequelize.define('StrategicMinuteProposal', {
  id: uuidPk(),
  minute_version_id: { type: DataTypes.UUID, allowNull: false },
  participant_id: { type: DataTypes.UUID, allowNull: true },
  proposed_by: userId(),
  field_path: { type: DataTypes.STRING(240), allowNull: false },
  previous_value: { type: DataTypes.JSONB, allowNull: true },
  proposed_value: { type: DataTypes.JSONB, allowNull: true },
  rationale: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pending' },
  resolved_by: userId(),
  resolved_at: { type: DataTypes.DATE, allowNull: true },
  resolution_comment: { type: DataTypes.TEXT, allowNull: true }
}, commonOptions('pei_minute_proposals', [{ fields: ['minute_version_id', 'status'] }]));

const StrategicMinuteSignature = sequelize.define('StrategicMinuteSignature', {
  id: uuidPk(),
  minute_version_id: { type: DataTypes.UUID, allowNull: false },
  participant_id: { type: DataTypes.UUID, allowNull: false },
  signer_user_id: userId(),
  signer_name: { type: DataTypes.STRING(240), allowNull: false },
  signer_email: { type: DataTypes.STRING(254), allowNull: true },
  signer_organization: { type: DataTypes.STRING(240), allowNull: true },
  signer_role: { type: DataTypes.STRING(200), allowNull: true },
  signature_method: { type: DataTypes.STRING(30), allowNull: false },
  signature_storage_key: { type: DataTypes.STRING(500), allowNull: true },
  signature_hash: { type: DataTypes.STRING(64), allowNull: false },
  content_hash: { type: DataTypes.STRING(64), allowNull: false },
  verified_email: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  signed_at: { type: DataTypes.DATE, allowNull: false },
  ip_address: { type: DataTypes.STRING(80), allowNull: true },
  user_agent: { type: DataTypes.STRING(500), allowNull: true }
}, commonOptions('pei_minute_signatures', [{ unique: true, fields: ['minute_version_id', 'participant_id'] }]));

const StrategicUserSignature = sequelize.define('StrategicUserSignature', {
  id: uuidPk(),
  user_id: userId(false),
  storage_key: { type: DataTypes.STRING(500), allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  consented_at: { type: DataTypes.DATE, allowNull: false },
  last_used_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_user_signatures', [{ fields: ['user_id', 'active'] }]));

const StrategicMonitoringResult = sequelize.define('StrategicMonitoringResult', {
  id: uuidPk(),
  action_item_id: { type: DataTypes.UUID, allowNull: false },
  monitoring_period_id: { type: DataTypes.UUID, allowNull: false },
  physical_progress: { type: DataTypes.DECIMAL(7, 2), allowNull: false, defaultValue: 0 },
  achieved_value: { type: DataTypes.STRING(300), allowNull: true },
  observations: { type: DataTypes.TEXT, allowNull: true },
  traffic_light: { type: DataTypes.STRING(20), allowNull: true },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'draft' },
  created_by: userId(false),
  updated_by: userId(),
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_monitoring_results', [{ unique: true, fields: ['action_item_id', 'monitoring_period_id'] }]));

const StrategicEvidence = sequelize.define('StrategicEvidence', {
  id: uuidPk(),
  action_item_id: { type: DataTypes.UUID, allowNull: false },
  monitoring_period_id: { type: DataTypes.UUID, allowNull: false },
  original_name: { type: DataTypes.STRING(300), allowNull: false },
  stored_name: { type: DataTypes.STRING(180), allowNull: false },
  storage_key: { type: DataTypes.STRING(500), allowNull: false },
  mime_type: { type: DataTypes.STRING(160), allowNull: false },
  size_bytes: { type: DataTypes.BIGINT, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  description: { type: DataTypes.TEXT, allowNull: true },
  sync_status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'pending' },
  drive_file_id: { type: DataTypes.STRING(160), allowNull: true },
  drive_folder_id: { type: DataTypes.STRING(160), allowNull: true },
  drive_md5: { type: DataTypes.STRING(64), allowNull: true },
  synced_at: { type: DataTypes.DATE, allowNull: true },
  uploaded_by: userId(false),
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_evidence', [{ fields: ['action_item_id', 'monitoring_period_id'] }, { fields: ['sync_status'] }]));

const StrategicSyncJob = sequelize.define('StrategicSyncJob', {
  id: uuidPk(),
  entity_type: { type: DataTypes.STRING(40), allowNull: false },
  entity_id: { type: DataTypes.UUID, allowNull: false },
  operation: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'upsert' },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'queued' },
  progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  next_attempt_at: { type: DataTypes.DATE, allowNull: true },
  leased_until: { type: DataTypes.DATE, allowNull: true },
  payload: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  completed_at: { type: DataTypes.DATE, allowNull: true },
  created_by: userId()
}, commonOptions('pei_sync_jobs', [{ fields: ['status', 'next_attempt_at'] }, { fields: ['entity_type', 'entity_id'] }]));

const StrategicBudgetImport = sequelize.define('StrategicBudgetImport', {
  id: uuidPk(),
  term_id: { type: DataTypes.UUID, allowNull: false },
  original_name: { type: DataTypes.STRING(300), allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'preview' },
  summary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  rows: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  error_report: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  created_by: userId(false),
  confirmed_by: userId(),
  confirmed_at: { type: DataTypes.DATE, allowNull: true },
  reversed_by: userId(),
  reversed_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_budget_imports', [{ fields: ['term_id', 'status'] }]));

const StrategicBudgetMovement = sequelize.define('StrategicBudgetMovement', {
  id: uuidPk(),
  term_id: { type: DataTypes.UUID, allowNull: false },
  action_item_id: { type: DataTypes.UUID, allowNull: true },
  budget_import_id: { type: DataTypes.UUID, allowNull: false },
  movement_type: { type: DataTypes.STRING(30), allowNull: false },
  amount: { type: DataTypes.DECIMAL(20, 2), allowNull: false },
  occurred_on: { type: DataTypes.DATEONLY, allowNull: false },
  reference: { type: DataTypes.STRING(180), allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, commonOptions('pei_budget_movements', [{ fields: ['term_id', 'movement_type'] }, { fields: ['action_item_id'] }]));

const StrategicHistoricalImport = sequelize.define('StrategicHistoricalImport', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  term_id: { type: DataTypes.UUID, allowNull: false },
  format_code: { type: DataTypes.STRING(60), allowNull: false },
  format_version: { type: DataTypes.INTEGER, allowNull: false },
  mapping: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  original_name: { type: DataTypes.STRING(300), allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'preview' },
  rows: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  errors: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  created_by: userId(false),
  confirmed_by: userId(),
  confirmed_at: { type: DataTypes.DATE, allowNull: true },
  reversed_by: userId(),
  reversed_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_historical_imports', [{ fields: ['term_id', 'status'] }, { fields: ['sha256'] }]));

const StrategicReferenceImport = sequelize.define('StrategicReferenceImport', {
  id: uuidPk(),
  strategic_plan_id: { type: DataTypes.UUID, allowNull: false },
  original_name: { type: DataTypes.STRING(300), allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'preview' },
  parsed_data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  summary: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  warnings: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  created_by: userId(),
  confirmed_by: userId(),
  confirmed_at: { type: DataTypes.DATE, allowNull: true }
}, commonOptions('pei_reference_imports', [{ fields: ['strategic_plan_id', 'status'] }, { fields: ['sha256'] }]));

const StrategicAuditEvent = sequelize.define('StrategicAuditEvent', {
  id: uuidPk(),
  actor_user_id: userId(),
  action: { type: DataTypes.STRING(80), allowNull: false },
  entity_type: { type: DataTypes.STRING(60), allowNull: false },
  entity_id: { type: DataTypes.STRING(80), allowNull: false },
  previous_value: { type: DataTypes.JSONB, allowNull: true },
  new_value: { type: DataTypes.JSONB, allowNull: true },
  justification: { type: DataTypes.TEXT, allowNull: true },
  ip_address: { type: DataTypes.STRING(80), allowNull: true },
  session_id: { type: DataTypes.STRING(160), allowNull: true }
}, commonOptions('pei_audit_events', [{ fields: ['entity_type', 'entity_id'] }, { fields: ['created_at'] }]));

const models = {
  StrategicPlan,
  StrategicLevel,
  StrategicElement,
  StrategicTerm,
  StrategicCatalogItem,
  StrategicResponsibility,
  StrategicFieldDefinition,
  StrategicMonitoringPeriod,
  StrategicActionPlan,
  StrategicActionItem,
  StrategicActionItemVersion,
  StrategicWorkflowEvent,
  StrategicMeeting,
  StrategicMeetingParticipant,
  StrategicMinuteVersion,
  StrategicMinuteProposal,
  StrategicMinuteSignature,
  StrategicUserSignature,
  StrategicMonitoringResult,
  StrategicEvidence,
  StrategicSyncJob,
  StrategicBudgetImport,
  StrategicBudgetMovement,
  StrategicHistoricalImport,
  StrategicReferenceImport,
  StrategicAuditEvent
};

const registerStrategicPlanningAssociations = ({ User }) => {
  StrategicPlan.hasMany(StrategicLevel, { foreignKey: 'strategic_plan_id', as: 'levels' });
  StrategicLevel.belongsTo(StrategicPlan, { foreignKey: 'strategic_plan_id', as: 'strategicPlan' });
  StrategicPlan.hasMany(StrategicElement, { foreignKey: 'strategic_plan_id', as: 'elements' });
  StrategicElement.belongsTo(StrategicLevel, { foreignKey: 'level_id', as: 'level' });
  StrategicElement.belongsTo(StrategicElement, { foreignKey: 'parent_id', as: 'parent' });
  StrategicElement.hasMany(StrategicElement, { foreignKey: 'parent_id', as: 'children' });
  StrategicPlan.hasMany(StrategicTerm, { foreignKey: 'strategic_plan_id', as: 'terms' });
  StrategicTerm.belongsTo(StrategicPlan, { foreignKey: 'strategic_plan_id', as: 'strategicPlan' });
  StrategicPlan.hasMany(StrategicCatalogItem, { foreignKey: 'strategic_plan_id', as: 'catalogItems' });
  StrategicPlan.hasMany(StrategicFieldDefinition, { foreignKey: 'strategic_plan_id', as: 'fieldDefinitions' });
  StrategicFieldDefinition.belongsTo(StrategicPlan, { foreignKey: 'strategic_plan_id', as: 'strategicPlan' });
  StrategicTerm.hasMany(StrategicMonitoringPeriod, { foreignKey: 'term_id', as: 'monitoringPeriods' });
  StrategicTerm.hasMany(StrategicActionPlan, { foreignKey: 'term_id', as: 'actionPlans' });
  StrategicActionPlan.belongsTo(StrategicTerm, { foreignKey: 'term_id', as: 'term' });
  StrategicActionPlan.belongsTo(StrategicCatalogItem, { foreignKey: 'catalog_item_id', as: 'organizationalUnit' });
  StrategicActionPlan.belongsTo(StrategicResponsibility, { foreignKey: 'responsibility_id', as: 'currentResponsibility', constraints: false });
  StrategicActionPlan.hasMany(StrategicResponsibility, { foreignKey: 'action_plan_id', as: 'responsibilityHistory', constraints: false });
  StrategicResponsibility.belongsTo(StrategicCatalogItem, { foreignKey: 'catalog_item_id', as: 'organizationalUnit' });
  StrategicResponsibility.belongsTo(StrategicCatalogItem, { foreignKey: 'position_catalog_item_id', as: 'position' });
  StrategicResponsibility.belongsTo(User, { foreignKey: 'user_id', as: 'responsibleUser' });
  StrategicActionPlan.hasMany(StrategicActionItem, { foreignKey: 'action_plan_id', as: 'items' });
  StrategicActionItem.belongsTo(StrategicActionPlan, { foreignKey: 'action_plan_id', as: 'actionPlan' });
  StrategicActionItem.belongsTo(StrategicElement, { foreignKey: 'strategic_element_id', as: 'strategicElement' });
  StrategicActionItem.hasMany(StrategicActionItemVersion, { foreignKey: 'action_item_id', as: 'versions' });
  StrategicActionItem.hasMany(StrategicMonitoringResult, { foreignKey: 'action_item_id', as: 'monitoringResults' });
  StrategicMonitoringResult.belongsTo(StrategicMonitoringPeriod, { foreignKey: 'monitoring_period_id', as: 'period' });
  StrategicActionPlan.hasMany(StrategicWorkflowEvent, { foreignKey: 'action_plan_id', as: 'workflowEvents' });
  StrategicActionPlan.hasMany(StrategicMeeting, { foreignKey: 'action_plan_id', as: 'meetings' });
  StrategicMeeting.belongsTo(StrategicActionPlan, { foreignKey: 'action_plan_id', as: 'actionPlan' });
  StrategicMeeting.hasMany(StrategicMeetingParticipant, { foreignKey: 'meeting_id', as: 'participants' });
  StrategicMeeting.hasMany(StrategicMinuteVersion, { foreignKey: 'meeting_id', as: 'minuteVersions' });
  StrategicMinuteVersion.belongsTo(StrategicMeeting, { foreignKey: 'meeting_id', as: 'meeting' });
  StrategicMinuteVersion.hasMany(StrategicMinuteProposal, { foreignKey: 'minute_version_id', as: 'proposals' });
  StrategicMinuteVersion.hasMany(StrategicMinuteSignature, { foreignKey: 'minute_version_id', as: 'signatures' });
  StrategicMeetingParticipant.hasMany(StrategicMinuteSignature, { foreignKey: 'participant_id', as: 'signatures' });
  StrategicActionItem.hasMany(StrategicEvidence, { foreignKey: 'action_item_id', as: 'evidence' });
  StrategicEvidence.belongsTo(StrategicMonitoringPeriod, { foreignKey: 'monitoring_period_id', as: 'period' });
  StrategicBudgetImport.hasMany(StrategicBudgetMovement, { foreignKey: 'budget_import_id', as: 'movements' });
  StrategicTerm.hasMany(StrategicBudgetMovement, { foreignKey: 'term_id', as: 'budgetMovements' });
  StrategicBudgetMovement.belongsTo(StrategicActionItem, { foreignKey: 'action_item_id', as: 'actionItem' });

  StrategicPlan.belongsTo(User, { foreignKey: 'responsible_user_id', as: 'responsibleUser' });
  StrategicActionPlan.belongsTo(User, { foreignKey: 'responsible_user_id', as: 'responsibleUser' });
  StrategicMeetingParticipant.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
  StrategicUserSignature.belongsTo(User, { foreignKey: 'user_id', as: 'user' });
};

module.exports = { ...models, strategicPlanningModels: Object.values(models), registerStrategicPlanningAssociations };
