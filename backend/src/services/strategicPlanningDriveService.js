const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const { Op } = require('sequelize');
const {
  StrategicEvidence, StrategicSyncJob, StrategicActionItem, StrategicActionPlan,
  StrategicCatalogItem, StrategicTerm, StrategicPlan, StrategicMonitoringPeriod,
  StrategicMinuteVersion, StrategicMeeting
} = require('../models');
const {
  buildActionRepositoryDriveClient,
  buildPedFolderName,
  compactFolderName
} = require('./actionPlanRepositoryDriveService');

const buildWritableDriveClient = () => {
  return buildActionRepositoryDriveClient();
};

const safeName = (value, max = 80) => String(value || 'SIN-CODIGO').normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'SIN-CODIGO';

const findOrCreateFolder = async (drive, { parentId, name, key }) => {
  const cleanName = String(name || '').trim();
  const escapedName = cleanName.replace(/'/g, "\\'");
  const escapedSafeName = safeName(cleanName).replace(/'/g, "\\'");
  const escapedKey = String(key).replace(/'/g, "\\'");
  const response = await drive.files.list({
    q: `'${parentId}' in parents and trashed=false and mimeType='application/vnd.google-apps.folder' and (name='${escapedName}' or name='${escapedSafeName}' or appProperties has { key='siacPeiKey' and value='${escapedKey}' } or appProperties has { key='siacActionRepository' and value='${escapedKey}' })`,
    fields: 'files(id,name)', spaces: 'drive', supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 2
  });
  if (response.data.files?.[0]) return response.data.files[0].id;
  const created = await drive.files.create({
    requestBody: { name: cleanName || safeName(name), mimeType: 'application/vnd.google-apps.folder', parents: [parentId], appProperties: { siacPeiKey: String(key), siacActionRepository: String(key) } },
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
  const rootId = plan?.drive_root_id || process.env.SIAC_PEI_DRIVE_ROOT_ID || process.env.SIAC_ACTION_REPOSITORY_ROOT_ID;
  if (!rootId) throw Object.assign(new Error('Falta SIAC_PEI_DRIVE_ROOT_ID o SIAC_ACTION_REPOSITORY_ROOT_ID en la configuración de Drive.'), { statusCode: 503 });
  const pedFolder = await findOrCreateFolder(drive, { parentId: rootId, name: safeName(plan.code), key: `ped:${plan.id}` });
  const yearFolder = await findOrCreateFolder(drive, { parentId: pedFolder, name: `PLANES DE ACCIÓN ${item.actionPlan.term.year}`, key: `term:${item.actionPlan.term.id}` });
  const unitCode = item.actionPlan.organizationalUnit?.code || item.actionPlan.code;
  const unitName = item.actionPlan.organizationalUnit?.name || item.actionPlan.title;
  const planFolderName = compactFolderName(unitCode, unitName, 44);
  const actionFolder = await findOrCreateFolder(drive, { parentId: yearFolder, name: planFolderName, key: `action-plan:${item.actionPlan.id}` });
  return findOrCreateFolder(drive, {
    parentId: actionFolder,
    name: `EVID-${safeName(period?.code || 'PERIODO', 20)}`,
    key: `period:${evidence.monitoring_period_id}`
  });
};

const ensureActionPlanFolder = async (drive, actionPlan) => {
  const plan = actionPlan.term?.strategicPlan || await StrategicPlan.findByPk(actionPlan.term?.strategic_plan_id);
  const rootId = plan?.drive_root_id || process.env.SIAC_PEI_DRIVE_ROOT_ID || process.env.SIAC_ACTION_REPOSITORY_ROOT_ID;
  if (!rootId) throw Object.assign(new Error('Falta SIAC_PEI_DRIVE_ROOT_ID o SIAC_ACTION_REPOSITORY_ROOT_ID en la configuración de Drive.'), { statusCode: 503 });
  const pedFolderName = buildPedFolderName(plan);
  const pedFolder = await findOrCreateFolder(drive, { parentId: rootId, name: pedFolderName, key: `action-repository:ped:${plan?.id || 'default'}` });
  const yearFolder = await findOrCreateFolder(drive, { parentId: pedFolder, name: `PLANES DE ACCIÓN ${actionPlan.term?.year || 'VIGENCIA'}`, key: `action-repository:term:${actionPlan.term?.id || 'default'}` });
  const unitCode = actionPlan.organizationalUnit?.code || actionPlan.code;
  const unitName = actionPlan.organizationalUnit?.name || actionPlan.title;
  const planFolderName = compactFolderName(unitCode, unitName, 44);
  const unitScope = `${actionPlan.term_id}:${actionPlan.catalog_item_id || actionPlan.id}`;
  return findOrCreateFolder(drive, { parentId: yearFolder, name: planFolderName, key: `action-repository:unit:${unitScope}` });
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
  const minute = await StrategicMinuteVersion.findByPk(minuteId, {
    include: [{
      model: StrategicMeeting, as: 'meeting',
      include: [{
        model: StrategicActionPlan, as: 'actionPlan',
        include: [
          { model: StrategicCatalogItem, as: 'organizationalUnit' },
          { model: StrategicTerm, as: 'term', include: [{ model: StrategicPlan, as: 'strategicPlan' }] }
        ]
      }]
    }]
  });
  const { ensureMinuteFinalPdfBuffer } = require('./strategicMinutePdfService');
  const buffer = await ensureMinuteFinalPdfBuffer(minute);
  if (!buffer || !minute?.final_pdf_storage_key || !fs.existsSync(minute.final_pdf_storage_key)) {
    throw new Error('No fue posible preparar el PDF final del acta para sincronización.');
  }
  const drive = buildWritableDriveClient();
  const actionPlan = minute.meeting?.actionPlan;
  const meeting = minute.meeting || {};
  const actionFolder = await ensureActionPlanFolder(drive, actionPlan);
  const folderId = await findOrCreateFolder(drive, {
    parentId: actionFolder,
    name: 'ACTAS DE REUNIÓN',
    key: `action-repository:minutes:${actionPlan.term_id}:${actionPlan.catalog_item_id || actionPlan.id}`
  });

  const meetingDate = meeting.starts_at && !Number.isNaN(new Date(meeting.starts_at).getTime())
    ? new Date(meeting.starts_at).toISOString().slice(0, 10)
    : String(minute.finalized_at || minute.created_at || '').slice(0, 10);
  const titleClean = safeName(meeting.title || 'Concertacion', 60);
  const planCodeClean = safeName(actionPlan?.code || 'PA', 30);
  const minuteFileName = `ACTA_${meetingDate}_${planCodeClean}_${titleClean}.pdf`;

  const requestBody = {
    name: safeName(minuteFileName, 160),
    appProperties: {
      siacPeiMinuteId: String(minute.id),
      contentHash: minute.content_hash,
      version: String(minute.version),
      meetingDate: meetingDate,
      actionPlanCode: actionPlan?.code || ''
    }
  };
  const media = { mimeType: 'application/pdf', body: fs.createReadStream(minute.final_pdf_storage_key) };
  let response;
  if (minute.drive_file_id) {
    try {
      const existing = await drive.files.get({ fileId: minute.drive_file_id, fields: 'id,parents,trashed', supportsAllDrives: true });
      const currentParents = existing.data?.parents || [];
      const hasParent = currentParents.includes(folderId);
      response = await drive.files.update({
        fileId: minute.drive_file_id,
        ...(hasParent ? {} : { addParents: folderId }),
        requestBody: { ...requestBody, trashed: false },
        media,
        fields: 'id,webViewLink',
        supportsAllDrives: true
      });
    } catch (_) {
      response = await drive.files.create({
        requestBody: { ...requestBody, parents: [folderId] },
        media,
        fields: 'id,webViewLink',
        supportsAllDrives: true
      });
    }
  } else {
    response = await drive.files.create({
      requestBody: { ...requestBody, parents: [folderId] },
      media,
      fields: 'id,webViewLink',
      supportsAllDrives: true
    });
  }
  const folderWebViewLink = `https://drive.google.com/drive/folders/${folderId}`;
  const updatedContent = {
    ...(minute.content || {}),
    drive_folder_id: folderId,
    drive_folder_url: folderWebViewLink,
    drive_file_id: response.data.id,
    drive_file_url: response.data.webViewLink
  };
  await minute.update({ drive_file_id: response.data.id, content: updatedContent });
  return {
    id: response.data.id,
    folderId,
    fileName: minuteFileName,
    webViewLink: response.data.webViewLink,
    folderWebViewLink
  };
};

const enqueueSync = async ({ entityType = 'evidence', entityId, operation = 'upsert', payload = {}, createdBy = null }) => {
  const existing = await StrategicSyncJob.findOne({ where: { entity_type: entityType, entity_id: entityId, operation, status: { [Op.in]: ['queued', 'processing'] } } });
  return existing || StrategicSyncJob.create({ entity_type: entityType, entity_id: entityId, operation, payload, created_by: createdBy });
};

// Consolida varios cambios cercanos del mismo año en una sola sincronización.
// Si ya hay un trabajo procesándose, conserva además uno pendiente para no perder
// los cambios que hayan ocurrido mientras Drive estaba siendo actualizado.
const enqueueActionRepositorySync = async ({ termId, reason = 'data_changed', createdBy = null }) => {
  if (!termId) return null;
  const queued = await StrategicSyncJob.findOne({
    where: { entity_type: 'action_repository_term', entity_id: termId, operation: 'refresh', status: 'queued' },
    order: [['created_at', 'DESC']]
  });
  const nextAttemptAt = new Date(Date.now() + Number(process.env.SIAC_ACTION_REPOSITORY_DEBOUNCE_MS || 8000));
  if (queued) {
    const reasons = Array.from(new Set([...(queued.payload?.reasons || []), reason])).slice(-20);
    await queued.update({ payload: { ...(queued.payload || {}), reasons, last_change_at: new Date().toISOString() }, next_attempt_at: nextAttemptAt });
    return queued;
  }
  return StrategicSyncJob.create({
    entity_type: 'action_repository_term', entity_id: termId, operation: 'refresh', status: 'queued',
    next_attempt_at: nextAttemptAt,
    payload: { reasons: [reason], last_change_at: new Date().toISOString() }, created_by: createdBy
  });
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
    let result = null;
    if (job.entity_type === 'evidence') result = await syncEvidence(job.entity_id);
    else if (job.entity_type === 'minute') result = await syncMinute(job.entity_id);
    else if (job.entity_type === 'action_repository_term') {
      // Importación diferida para mantener independientes ambos servicios Drive.
      const { syncActionPlanRepositoryTerm } = require('./actionPlanRepositoryDriveService');
      result = await syncActionPlanRepositoryTerm(job.entity_id);
    }
    else throw new Error(`Tipo de sincronización no soportado: ${job.entity_type}`);
    await job.update({
      status: 'completed', progress: 100, completed_at: new Date(), leased_until: null, error_message: null,
      payload: { ...(job.payload || {}), result, synchronized_at: new Date().toISOString() }
    });
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

module.exports = { buildWritableDriveClient, enqueueSync, enqueueActionRepositorySync, syncEvidence, syncMinute, reconcileTerm, processOneSyncJob, startStrategicPlanningSyncWorker, safeName };
