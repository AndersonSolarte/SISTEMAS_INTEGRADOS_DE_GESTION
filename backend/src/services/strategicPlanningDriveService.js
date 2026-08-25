const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Op } = require('sequelize');
const {
  StrategicEvidence, StrategicSyncJob, StrategicActionItem, StrategicActionPlan,
  StrategicCatalogItem, StrategicTerm, StrategicPlan, StrategicMonitoringPeriod,
  StrategicMinuteVersion, StrategicMeeting
} = require('../models');

const buildWritableDriveClient = () => {
  const clientEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const privateKey = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  let credentials = null;
  const source = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();
  if (source) {
    const raw = source.startsWith('{') ? source : fs.readFileSync(path.isAbsolute(source) ? source : path.resolve(__dirname, '../../', source), 'utf8');
    credentials = JSON.parse(raw);
  }
  const email = clientEmail || credentials?.client_email;
  const key = privateKey || String(credentials?.private_key || '').replace(/\\n/g, '\n');
  if (!email || !key) {
    const err = new Error('Drive de Planeación no está configurado con una cuenta de servicio/OAuth institucional.');
    err.statusCode = 503;
    throw err;
  }
  const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
  return google.drive({ version: 'v3', auth });
};

const safeName = (value, max = 80) => String(value || 'SIN-CODIGO').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'SIN-CODIGO';

const findOrCreateFolder = async (drive, { parentId, name, key }) => {
  const escapedKey = String(key).replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and appProperties has { key='siacPeiKey' and value='${escapedKey}' }`,
    fields: 'files(id,name)', spaces: 'drive', supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 2
  });
  if (response.data.files?.[0]) return response.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: safeName(name), mimeType: 'application/vnd.google-apps.folder', parents: [parentId], appProperties: { siacPeiKey: String(key) } },
    fields: 'id', supportsAllDrives: true
  });
  return created.data.id;
};

const ensureEvidenceFolder = async (drive, evidence) => {
  const item = await StrategicActionItem.findByPk(evidence.action_item_id, { include: [{
    model: StrategicActionPlan, as: 'actionPlan', include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: StrategicTerm, as: 'term', include: [{ model: StrategicPlan, as: 'strategicPlan' }] }
    ]
  }] });
  const period = await StrategicMonitoringPeriod.findByPk(evidence.monitoring_period_id);
  const plan = item?.actionPlan?.term?.strategicPlan;
  const rootId = plan?.drive_root_id || process.env.SIAC_PEI_DRIVE_ROOT_ID;
  if (!rootId) throw Object.assign(new Error('Falta SIAC_PEI_DRIVE_ROOT_ID o el ID raíz de Drive en el PED.'), { statusCode: 503 });
  const pedFolder = await findOrCreateFolder(drive, { parentId: rootId, name: safeName(plan.code), key: `ped:${plan.id}` });
  const yearFolder = await findOrCreateFolder(drive, { parentId: pedFolder, name: item.actionPlan.term.year, key: `term:${item.actionPlan.term.id}` });
  const unitCode = safeName(item.actionPlan.organizationalUnit?.code || item.actionPlan.code, 45);
  const actionFolder = await findOrCreateFolder(drive, { parentId: yearFolder, name: `PA-${unitCode}`, key: `action-plan:${item.actionPlan.id}` });
  return findOrCreateFolder(drive, {
    parentId: actionFolder,
    name: `EVID-${safeName(period?.code || 'PERIODO', 20)}`,
    key: `period:${evidence.monitoring_period_id}`
  });
};

const ensureActionPlanFolder = async (drive, actionPlan) => {
  const plan = actionPlan.term?.strategicPlan;
  const rootId = plan?.drive_root_id || process.env.SIAC_PEI_DRIVE_ROOT_ID;
  if (!rootId) throw Object.assign(new Error('Falta SIAC_PEI_DRIVE_ROOT_ID o el ID raíz de Drive en el PED.'), { statusCode: 503 });
  const pedFolder = await findOrCreateFolder(drive, { parentId: rootId, name: safeName(plan.code), key: `ped:${plan.id}` });
  const yearFolder = await findOrCreateFolder(drive, { parentId: pedFolder, name: actionPlan.term.year, key: `term:${actionPlan.term.id}` });
  const unitCode = safeName(actionPlan.organizationalUnit?.code || actionPlan.code, 45);
  return findOrCreateFolder(drive, { parentId: yearFolder, name: `PA-${unitCode}`, key: `action-plan:${actionPlan.id}` });
};

const syncEvidence = async (evidenceId) => {
  const evidence = await StrategicEvidence.findByPk(evidenceId);
  if (!evidence || evidence.deleted_at) return { skipped: true };
  if (!fs.existsSync(evidence.storage_key)) throw new Error(`No existe la copia temporal ${evidence.storage_key}`);
  const drive = buildWritableDriveClient();
  const folderId = evidence.drive_folder_id || await ensureEvidenceFolder(drive, evidence);
  const requestBody = {
    name: safeName(evidence.stored_name, 160),
    appProperties: { siacPeiEvidenceId: String(evidence.id), sha256: evidence.sha256, version: String(evidence.version) }
  };
  const media = { mimeType: evidence.mime_type, body: fs.createReadStream(evidence.storage_key) };
  let file;
  if (evidence.drive_file_id) {
    file = await drive.files.update({ fileId: evidence.drive_file_id, requestBody, media, fields: 'id,md5Checksum', supportsAllDrives: true });
  } else {
    file = await drive.files.create({ requestBody: { ...requestBody, parents: [folderId] }, media, fields: 'id,md5Checksum', supportsAllDrives: true });
  }
  await evidence.update({ drive_folder_id: folderId, drive_file_id: file.data.id, drive_md5: file.data.md5Checksum || null, sync_status: 'synced', synced_at: new Date() });
  return { id: file.data.id, folderId };
};

const syncMinute = async (minuteId) => {
  const minute = await StrategicMinuteVersion.findByPk(minuteId, { include: [{ model: StrategicMeeting, as: 'meeting', include: [{ model: StrategicActionPlan, as: 'actionPlan', include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }, { model: StrategicTerm, as: 'term', include: [{ model: StrategicPlan, as: 'strategicPlan' }] }] }] }] });
  if (!minute?.final_pdf_storage_key || !fs.existsSync(minute.final_pdf_storage_key)) throw new Error('El PDF final del acta no existe en almacenamiento temporal.');
  const drive = buildWritableDriveClient();
  const actionFolder = await ensureActionPlanFolder(drive, minute.meeting.actionPlan);
  const folderId = await findOrCreateFolder(drive, { parentId: actionFolder, name: 'ACTAS', key: `actas:${minute.meeting.actionPlan.id}` });
  const requestBody = { name: safeName(path.basename(minute.final_pdf_storage_key), 160), appProperties: { siacPeiMinuteId: String(minute.id), contentHash: minute.content_hash, version: String(minute.version) } };
  const media = { mimeType: 'application/pdf', body: fs.createReadStream(minute.final_pdf_storage_key) };
  const response = minute.drive_file_id
    ? await drive.files.update({ fileId: minute.drive_file_id, requestBody, media, fields: 'id', supportsAllDrives: true })
    : await drive.files.create({ requestBody: { ...requestBody, parents: [folderId] }, media, fields: 'id', supportsAllDrives: true });
  await minute.update({ drive_file_id: response.data.id });
  return { id: response.data.id, folderId };
};

const enqueueSync = async ({ entityType = 'evidence', entityId, operation = 'upsert', payload = {}, createdBy = null }) => {
  const existing = await StrategicSyncJob.findOne({ where: { entity_type: entityType, entity_id: entityId, operation, status: { [Op.in]: ['queued', 'processing'] } } });
  return existing || StrategicSyncJob.create({ entity_type: entityType, entity_id: entityId, operation, payload, created_by: createdBy });
};

const processOneSyncJob = async () => {
  const now = new Date();
  const job = await StrategicSyncJob.findOne({
    where: { status: 'queued', [Op.or]: [{ next_attempt_at: null }, { next_attempt_at: { [Op.lte]: now } }] },
    order: [['created_at', 'ASC']]
  });
  if (!job) return false;
  await job.update({ status: 'processing', leased_until: new Date(Date.now() + 5 * 60 * 1000), attempts: Number(job.attempts) + 1, progress: 10 });
  try {
    if (job.entity_type === 'evidence') await syncEvidence(job.entity_id);
    else if (job.entity_type === 'minute') await syncMinute(job.entity_id);
    else throw new Error(`Tipo de sincronización no soportado: ${job.entity_type}`);
    await job.update({ status: 'completed', progress: 100, completed_at: new Date(), leased_until: null, error_message: null });
  } catch (error) {
    const attempts = Number(job.attempts || 1);
    await job.update({
      status: attempts >= 8 ? 'failed' : 'queued', progress: 0, leased_until: null,
      next_attempt_at: new Date(Date.now() + Math.min(60, 2 ** attempts) * 60 * 1000),
      error_message: String(error.message || error).slice(0, 4000)
    });
    const evidence = job.entity_type === 'evidence' ? await StrategicEvidence.findByPk(job.entity_id) : null;
    if (evidence) await evidence.update({ sync_status: attempts >= 8 ? 'failed' : 'pending' });
  }
  return true;
};

let workerTimer = null;
const startStrategicPlanningSyncWorker = () => {
  if (workerTimer || String(process.env.SIAC_PEI_SYNC_WORKER_ENABLED || 'true').toLowerCase() === 'false') return;
  const tick = async () => {
    try {
      let count = 0;
      while (count < 5 && await processOneSyncJob()) count += 1;
    } catch (error) {
      console.error('Error en trabajador PEI/Drive:', error.message);
    }
  };
  workerTimer = setInterval(tick, Number(process.env.SIAC_PEI_SYNC_INTERVAL_MS || 30000));
  workerTimer.unref?.();
  setTimeout(tick, 1500).unref?.();
};

const reconcileTerm = async (termId, createdBy) => {
  const plans = await StrategicActionPlan.findAll({ where: { term_id: termId, deleted_at: null }, attributes: ['id'] });
  const items = await StrategicActionItem.findAll({ where: { action_plan_id: { [Op.in]: plans.map((p) => p.id) }, deleted_at: null }, attributes: ['id'] });
  const evidence = items.length ? await StrategicEvidence.findAll({ where: { action_item_id: { [Op.in]: items.map((i) => i.id) }, deleted_at: null } }) : [];
  const pending = evidence.filter((file) => file.sync_status !== 'synced');
  for (const file of pending) await enqueueSync({ entityId: file.id, createdBy, payload: { reconciliation: true } });
  return { total: evidence.length, pending: pending.length };
};

module.exports = { buildWritableDriveClient, enqueueSync, syncEvidence, syncMinute, reconcileTerm, processOneSyncJob, startStrategicPlanningSyncWorker, safeName };
