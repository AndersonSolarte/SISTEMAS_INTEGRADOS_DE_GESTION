const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { google } = require('googleapis');
const { activeKinds } = require('./improvementIndicatorTracking');
const { kinds, folderName, evidenceName } = require('./improvementEvidenceLabels');

const ROOT_ENV = 'SIAC_PLAN_IMPROVEMENT_DRIVE_ROOT_ID';
const DRIVE_FOLDER = 'application/vnd.google-apps.folder';
const PROPERTY_KEY = 'siacPlanMejoramientoKey';

const cleanName = (value, max = 120) => String(value || 'SIN NOMBRE')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, max) || 'SIN NOMBRE';

const escapeQuery = (value) => String(value || '').replace(/'/g, "\\'");
const folderUrl = (id) => id ? `https://drive.google.com/drive/folders/${id}` : '';

const readCredentials = () => {
  const source = String(
    process.env.PLAN_IMPROVEMENT_GOOGLE_SERVICE_ACCOUNT_JSON
    || process.env.PLAN_IMPROVEMENT_GOOGLE_SERVICE_ACCOUNT_FILE
    || ''
  ).trim();
  if (!source) return null;
  const resolved = path.isAbsolute(source) ? source : path.resolve(__dirname, '../../', source);
  const raw = source.startsWith('{') ? source : fs.readFileSync(resolved, 'utf8');
  return JSON.parse(raw);
};

const buildDriveClient = () => {
  const clientId = String(process.env.PLAN_IMPROVEMENT_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PLAN_IMPROVEMENT_GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.PLAN_IMPROVEMENT_GOOGLE_REFRESH_TOKEN || '').trim();
  if (clientId && clientSecret && /^1\/\//.test(refreshToken)) {
    const auth = new google.auth.OAuth2(clientId, clientSecret);
    auth.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: 'v3', auth });
  }

  const credentials = readCredentials();
  const email = String(process.env.PLAN_IMPROVEMENT_GOOGLE_SERVICE_ACCOUNT_EMAIL || credentials?.client_email || '').trim();
  const key = String(process.env.PLAN_IMPROVEMENT_GOOGLE_PRIVATE_KEY || credentials?.private_key || '').replace(/\\n/g, '\n').trim();
  if (email && key) {
    const auth = new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
    return google.drive({ version: 'v3', auth });
  }

  // Reuse the configured institutional connection without requiring a second OAuth.
  const hasIndependentConfiguration = Boolean(clientId || clientSecret || refreshToken || email || key);
  if (!hasIndependentConfiguration) {
    return require('./actionPlanRepositoryDriveService').buildActionRepositoryDriveClient();
  }

  const error = new Error('El Drive de Planes de Mejoramiento no está configurado. Defina sus credenciales independientes de Google Drive.');
  error.statusCode = 503;
  throw error;
};

const repositoryRootId = () => {
  const rootId = String(process.env[ROOT_ENV] || process.env.SIAC_ACTION_REPOSITORY_ROOT_ID || process.env.SIAC_PEI_DRIVE_ROOT_ID || '').trim();
  if (!rootId) {
    const error = new Error(`Configure ${ROOT_ENV} con el ID de la carpeta raíz del Drive de Planes de Mejoramiento.`);
    error.statusCode = 503;
    throw error;
  }
  return rootId;
};

const verifyRoot = async (drive, rootId) => {
  try {
    const response = await drive.files.get({ fileId: rootId, fields: 'id,name,mimeType', supportsAllDrives: true });
    if (response.data?.mimeType !== DRIVE_FOLDER) {
      const error = new Error(`${ROOT_ENV} debe corresponder a una carpeta de Google Drive.`);
      error.statusCode = 400;
      throw error;
    }
    return response.data;
  } catch (error) {
    if (error.statusCode) throw error;
    const status = Number(error?.response?.status || error?.code || 0);
    const wrapped = new Error(status === 404
      ? 'La carpeta raíz del Drive de Planes de Mejoramiento no existe o la cuenta configurada no tiene acceso.'
      : `No fue posible acceder al Drive de Planes de Mejoramiento: ${error.message}`);
    wrapped.statusCode = status === 404 ? 404 : 503;
    throw wrapped;
  }
};

const findOrCreateFolder = async (drive, { parentId, name, key }) => {
  const desiredName = cleanName(name);
  const response = await drive.files.list({
    q: `'${escapeQuery(parentId)}' in parents and trashed=false and mimeType='${DRIVE_FOLDER}' and (appProperties has { key='${PROPERTY_KEY}' and value='${escapeQuery(key)}' } or name='${escapeQuery(desiredName)}')`,
    fields: 'files(id,name,appProperties)', spaces: 'drive', supportsAllDrives: true,
    includeItemsFromAllDrives: true, pageSize: 2
  });
  const found = response.data.files?.[0];
  if (found) {
    if (found.name !== desiredName || found.appProperties?.[PROPERTY_KEY] !== key) {
      await drive.files.update({
        fileId: found.id,
        requestBody: { name: desiredName, appProperties: { ...(found.appProperties || {}), [PROPERTY_KEY]: key } },
        fields: 'id', supportsAllDrives: true
      });
    }
    return found.id;
  }
  const created = await drive.files.create({
    requestBody: {
      name: desiredName, mimeType: DRIVE_FOLDER, parents: [parentId],
      appProperties: { [PROPERTY_KEY]: key }
    },
    fields: 'id', supportsAllDrives: true
  });
  return created.data.id;
};

const cloneContent = (content) => JSON.parse(JSON.stringify(content || {}));

const ensurePlanRepository = async (plan) => {
  const drive = buildDriveClient();
  const rootId = repositoryRootId();
  await verifyRoot(drive, rootId);

  const content = cloneContent(plan.contenido);
  const repositoryId = await findOrCreateFolder(drive, {
    parentId: rootId, name: 'PLANES DE MEJORAMIENTO', key: 'plan-mejoramiento:repository'
  });
  const periodId = await findOrCreateFolder(drive, {
    parentId: repositoryId,
    name: `${plan.periodo_inicio}-${plan.periodo_fin}`,
    key: `plan-mejoramiento:period:${plan.periodo_inicio}-${plan.periodo_fin}`
  });
  const planFolderId = await findOrCreateFolder(drive, {
    parentId: periodId,
    name: `${String(plan.id).padStart(5, '0')} - ${plan.programa}`,
    key: `plan-mejoramiento:plan:${plan.id}`
  });

  const activityFolders = [];
  content.objetivos = (content.objetivos || []).map((objective, objectiveIndex) => {
    const objectiveCode = objective.codigo || `OPM_${String(objectiveIndex + 1).padStart(2, '0')}`;
    return { ...objective, actividades: (objective.actividades || []).map((activity, activityIndex) => ({ ...activity })) };
  });

  for (const [objectiveIndex, objective] of content.objetivos.entries()) {
    const objectiveCode = objective.codigo || `OPM_${String(objectiveIndex + 1).padStart(2, '0')}`;
    const objectiveFolderId = await findOrCreateFolder(drive, {
      parentId: planFolderId,
      name: `${objectiveCode} - ${objective.objetivo || `Objetivo ${objectiveIndex + 1}`}`,
      key: `plan-mejoramiento:plan:${plan.id}:objective:${objectiveCode}`
    });
    for (const [activityIndex, activity] of (objective.actividades || []).entries()) {
      const uid = String(activity.uid || `pm-${plan.id}-o${objectiveIndex + 1}-a${activityIndex + 1}`);
      const activityFolderId = await findOrCreateFolder(drive, {
        parentId: objectiveFolderId,
        name: `ACT_${String(activityIndex + 1).padStart(2, '0')} - ${activity.nombre || `Actividad ${activityIndex + 1}`}`,
        key: `plan-mejoramiento:plan:${plan.id}:activity:${uid}`
      });
      const evidenceFolderId = await findOrCreateFolder(drive, {
        parentId: activityFolderId, name: 'EVIDENCIAS',
        key: `plan-mejoramiento:plan:${plan.id}:activity:${uid}:evidence`
      });
      Object.assign(activity, {
        uid,
        evidenceFolderId,
        evidenceFolderUrl: folderUrl(evidenceFolderId),
        evidenceDriveStatus: 'synced',
        evidenceDriveSyncedAt: new Date().toISOString()
      });
      const indicatorFolders = { ...activity.indicatorEvidenceFolders };
      for (const kind of activeKinds(activity)) {
        const id = await findOrCreateFolder(drive, { parentId: evidenceFolderId, name: folderName(kind), key: `plan-mejoramiento:plan:${plan.id}:activity:${uid}:evidence:${kind.toLowerCase()}` });
        indicatorFolders[kind] = { folderId: id, folderUrl: folderUrl(id) };
        for (const evidence of activity.seguimientoIndicadores?.[kind]?.evidencias || []) {
          if (!evidence.driveFileId) continue;
          let metadata;
          try { metadata = (await drive.files.get({ fileId: evidence.driveFileId, fields: 'id,name,parents,trashed', supportsAllDrives: true })).data; }
          catch (error) { if (Number(error.code || error.response?.status) === 404) continue; throw error; }
          if (metadata.trashed || !metadata.parents?.some((parent) => parent === evidenceFolderId || parent === id)) continue;
          const name = evidenceName(metadata.name || evidence.nombre, kind);
          const move = metadata.parents.includes(evidenceFolderId) && id !== evidenceFolderId;
          if (move || metadata.name !== name) await drive.files.update({ fileId: evidence.driveFileId, requestBody: { name }, ...(move ? { addParents: id, removeParents: evidenceFolderId } : {}), supportsAllDrives: true });
          Object.assign(evidence, { nombre: name, indicatorKind: kind, indicatorFolderId: id, indicatorFolderUrl: folderUrl(id) });
        }
      }
      activity.indicatorEvidenceFolders = indicatorFolders;
      activityFolders.push({ uid, objectiveCode, folderId: evidenceFolderId, folderUrl: folderUrl(evidenceFolderId), indicatorFolders });
    }
  }

  content.driveRepository = {
    provider: 'google_drive', rootFolderId: planFolderId, rootFolderUrl: folderUrl(planFolderId),
    synchronizedAt: new Date().toISOString()
  };
  return { drive, content, repository: content.driveRepository, activities: activityFolders };
};

const uploadActivityEvidence = async (plan, activityUid, file, indicatorKind = '') => {
  const sourceActivity = (plan.contenido?.objetivos || []).flatMap((o) => o.actividades || [])
    .find((a) => String(a.uid) === String(activityUid));
  if (!sourceActivity) throw Object.assign(new Error('Actividad no encontrada'), { statusCode: 404 });
  if (indicatorKind && !activeKinds(sourceActivity).includes(indicatorKind)) throw Object.assign(new Error('Indicador no activo en esta actividad.'), { statusCode: 422 });
  const synchronized = await ensurePlanRepository(plan);
  const activity = synchronized.activities.find((item) => String(item.uid) === String(activityUid));
  if (!activity) {
    const error = new Error('La actividad indicada no pertenece al plan de mejoramiento.');
    error.statusCode = 404;
    throw error;
  }
  const originalName = evidenceName(cleanName(file.originalname || 'evidencia', 180), indicatorKind);
  const targetFolder = activity.indicatorFolders?.[indicatorKind]?.folderId || activity.folderId;
  const response = await synchronized.drive.files.create({
    requestBody: {
      name: originalName, parents: [targetFolder],
      appProperties: {
        [PROPERTY_KEY]: `plan-mejoramiento:evidence:${plan.id}:${activityUid}:${Date.now()}`,
        planId: String(plan.id), activityUid: String(activityUid), ...(indicatorKind ? { indicatorKind } : {})
      }
    },
    media: { mimeType: file.mimetype || 'application/octet-stream', body: Readable.from(file.buffer) },
    fields: 'id,name,mimeType,size,webViewLink,createdTime', supportsAllDrives: true
  });
  const uploaded = response.data;
  let linkedEvidence = null;
  if (sourceActivity.linkedActionItemId) {
    const strategic = require('./strategicPlanningDriveService');
    const { StrategicActionItem, StrategicActionPlan, StrategicMonitoringPeriod } = require('../models');
    const item = await StrategicActionItem.findByPk(sourceActivity.linkedActionItemId, { include: [{ model: StrategicActionPlan, as: 'actionPlan' }] });
    if ((await require('./improvementActionPlanSyncGate').canSynchronize(item?.actionPlan)).allowed) {
    const month = Number(String(sourceActivity.fechaSeguimiento || new Date().toISOString().slice(0, 10)).slice(5, 7));
    const period = await StrategicMonitoringPeriod.findOne({ where: { term_id: item?.actionPlan?.term_id, position: month <= 7 ? 1 : 2 } });
    if (!period) throw new Error('No existe periodo de seguimiento para sincronizar la evidencia vinculada.');
    const target = await strategic.getActivityDriveFolder(item.id, period.id, indicatorKind ? indicatorKind.toLowerCase() : null);
    const linkedDrive = strategic.buildWritableDriveClient();
    const result = await linkedDrive.files.create({
      requestBody: { name: originalName, parents: [target.folderId] },
      media: { mimeType: file.mimetype || 'application/octet-stream', body: Readable.from(file.buffer) },
      fields: 'id,webViewLink', supportsAllDrives: true
    });
    linkedEvidence = { driveFileId: result.data.id, folderId: target.folderId, periodId: period.id, url: result.data.webViewLink };
    }
  }
  return {
    content: synchronized.content,
    evidence: {
      nombre: uploaded.name || originalName,
      driveFileId: uploaded.id,
      indicatorKind: indicatorKind || null,
      indicatorFolderId: indicatorKind ? targetFolder : null,
      indicatorFolderUrl: indicatorKind ? folderUrl(targetFolder) : null,
      indicatorEvidenceFolders: activity.indicatorFolders,
      linkedEvidence,
      url: uploaded.webViewLink || `https://drive.google.com/file/d/${uploaded.id}/view`,
      carpetaId: activity.folderId,
      carpetaUrl: activity.folderUrl,
      tipo: uploaded.mimeType || file.mimetype,
      tamano: Number(uploaded.size || file.size || 0),
      cargadoAt: uploaded.createdTime || new Date().toISOString()
    }
  };
};

const readActivityEvidence = async (activity, fileId) => {
  const folderId = activity.evidenceFolderId
    || String(activity.evidenceFolderUrl || '').match(/\/folders\/([\w-]+)/)?.[1];
  if (!folderId || !/^[\w-]+$/.test(folderId)) {
    const error = new Error('La actividad aún no tiene carpeta de evidencias sincronizada.');
    error.statusCode = 404;
    throw error;
  }
  const clients = activity.linkedActionItemId
    ? [() => require('./strategicPlanningDriveService').buildWritableDriveClient(), buildDriveClient]
    : [buildDriveClient];
  let lastError;
  for (const createClient of clients) {
    try {
      const drive = createClient();
      const scopes = [{ folderId, kind: null }];
      for (const kind of kinds) {
        const childId = activity.indicatorEvidenceFolders?.[kind]?.folderId;
        if (!childId || childId === folderId || !/^[\w-]+$/.test(childId)) continue;
        let child;
        try { child = (await drive.files.get({ fileId: childId, fields: 'id,mimeType,parents,trashed', supportsAllDrives: true })).data; }
        catch (error) { if (Number(error.code || error.response?.status) === 404) continue; throw error; }
        if (!child.trashed && child.mimeType === DRIVE_FOLDER && child.parents?.includes(folderId)) scopes.push({ folderId: childId, kind });
      }
      if (!fileId) {
        const files = [];
        for (const scope of scopes) {
        let pageToken;
        do {
          const result = await drive.files.list({
            q: `'${escapeQuery(scope.folderId)}' in parents and trashed=false and mimeType!='${DRIVE_FOLDER}'`,
            fields: 'nextPageToken,files(id,name,mimeType,size,createdTime,appProperties)', pageSize: 100,
            orderBy: 'createdTime desc,name',
            pageToken, supportsAllDrives: true, includeItemsFromAllDrives: true
          });
          files.push(...(result.data.files || []).map((file) => {
            const associated = kinds.find((kind) => (activity.seguimientoIndicadores?.[kind]?.evidencias || []).some((record) => String(record.driveFileId) === String(file.id)));
            const kind = scope.kind || file.appProperties?.indicatorKind || associated;
            return { ...file, ...(kinds.includes(kind) ? { indicatorKind: kind, displayName: evidenceName(file.name, kind) } : {}) };
          }));
          pageToken = result.data.nextPageToken;
        } while (pageToken);
        }
        return files.sort((a, b) => (kinds.includes(a.indicatorKind) ? kinds.indexOf(a.indicatorKind) : 3) - (kinds.includes(b.indicatorKind) ? kinds.indexOf(b.indicatorKind) : 3) || String(b.createdTime || '').localeCompare(String(a.createdTime || '')));
      }
      const { data: metadata } = await drive.files.get({ fileId, fields: 'id,name,mimeType,parents,trashed', supportsAllDrives: true });
      if (metadata.trashed || !scopes.some((scope) => metadata.parents?.includes(scope.folderId))) {
        const error = new Error('La evidencia no pertenece a esta actividad.');
        error.statusCode = 404;
        throw error;
      }
      const native = metadata.mimeType.startsWith('application/vnd.google-apps.');
      const response = native
        ? await drive.files.export({ fileId, mimeType: 'application/pdf' }, { responseType: 'stream' })
        : await drive.files.get({ fileId, alt: 'media', supportsAllDrives: true }, { responseType: 'stream' });
      return { stream: response.data, mimeType: native ? 'application/pdf' : metadata.mimeType };
    } catch (error) { lastError = error; }
  }
  throw lastError;
};

module.exports = {
  readActivityEvidence,
  ROOT_ENV,
  cleanName,
  buildDriveClient,
  verifyRoot,
  findOrCreateFolder,
  ensurePlanRepository,
  uploadActivityEvidence
};
