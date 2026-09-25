const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { google } = require('googleapis');
const {
  StrategicPlan, StrategicTerm, StrategicActionPlan, StrategicActionItem,
  StrategicCatalogItem, StrategicMonitoringPeriod, StrategicMonitoringResult,
  StrategicEvidence, StrategicMeeting, StrategicMinuteVersion
} = require('../models');
const { generatePlanAccionBuffer } = require('./planAccionExportService');
const { listTermDependencies } = require('./strategicTermDependencyService');

// Este servicio es deliberadamente independiente de la sincronizacion PEI existente.
// Mientras se habilita el OAuth de Planes de Accion puede reutilizar, solo para Drive,
// la cuenta de servicio ya configurada. No modifica sus credenciales ni el cliente de
// Drive, correo o autenticacion de los demas modulos de SIAC.
const ROOT_ENV = 'SIAC_ACTION_REPOSITORY_ROOT_ID';
const DRIVE_FOLDER = 'application/vnd.google-apps.folder';
const REPOSITORY_PROPERTY = 'siacActionRepositoryKey';
const MAX_APP_PROPERTY_BYTES = 124;

const buildActionRepositoryDriveAuth = () => {
  const clientId = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.PLAN_ACTION_GOOGLE_REFRESH_TOKEN || '').trim();
  if (!clientId || !clientSecret || !refreshToken) {
    const error = new Error('El Drive de Planes de Acción requiere PLAN_ACTION_GOOGLE_CLIENT_ID, PLAN_ACTION_GOOGLE_CLIENT_SECRET y PLAN_ACTION_GOOGLE_REFRESH_TOKEN.');
    error.statusCode = 503;
    throw error;
  }
  if (refreshToken.startsWith('ya29.')) {
    const error = new Error('La configuración de Planes de Acción contiene un Access Token temporal. Copie en PLAN_ACTION_GOOGLE_REFRESH_TOKEN el Refresh Token que comienza por 1//.');
    error.statusCode = 503;
    throw error;
  }
  if (refreshToken.startsWith('4/')) {
    const error = new Error('La configuración de Planes de Acción contiene el código de autorización. Intercámbielo en OAuth Playground y copie el Refresh Token que comienza por 1//.');
    error.statusCode = 503;
    throw error;
  }
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
};

const hasUsableActionRepositoryOAuth = () => {
  const clientId = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = String(process.env.PLAN_ACTION_GOOGLE_CLIENT_SECRET || '').trim();
  const refreshToken = String(process.env.PLAN_ACTION_GOOGLE_REFRESH_TOKEN || '').trim();
  return Boolean(clientId && clientSecret && /^1\/\//.test(refreshToken));
};

const buildActionRepositoryServiceAccountAuth = () => {
  const directEmail = String(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || '').trim();
  const directKey = String(process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
  const source = String(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '').trim();
  let credentials = null;

  if (source) {
    const resolved = path.isAbsolute(source) ? source : path.resolve(__dirname, '../../', source);
    const raw = source.startsWith('{') ? source : fs.readFileSync(resolved, 'utf8');
    credentials = JSON.parse(raw);
  }

  const email = directEmail || String(credentials?.client_email || '').trim();
  const key = directKey || String(credentials?.private_key || '').replace(/\\n/g, '\n').trim();
  if (!email || !key) {
    const error = new Error('El OAuth de Planes de Acción aún no está disponible y tampoco se encontró la cuenta de servicio existente para sincronizar con Drive.');
    error.statusCode = 503;
    throw error;
  }
  return new google.auth.JWT({ email, key, scopes: ['https://www.googleapis.com/auth/drive'] });
};

const buildActionRepositoryDriveClient = () => {
  const auth = hasUsableActionRepositoryOAuth()
    ? buildActionRepositoryDriveAuth()
    : buildActionRepositoryServiceAccountAuth();
  return google.drive({ version: 'v3', auth });
};

const verifyRepositoryRoot = async (drive, rootId) => {
  try {
    const response = await drive.files.get({
      fileId: rootId,
      fields: 'id,name,mimeType',
      supportsAllDrives: true
    });
    if (response.data?.mimeType !== DRIVE_FOLDER) {
      const error = new Error('SIAC_ACTION_REPOSITORY_ROOT_ID debe corresponder a una carpeta de Google Drive.');
      error.statusCode = 400;
      throw error;
    }
  } catch (error) {
    if (error.statusCode) throw error;
    const status = Number(error?.response?.status || error?.code || 0);
    const reason = String(error?.response?.data?.error?.errors?.[0]?.reason || error?.message || '').toLowerCase();
    if (reason.includes('invalid_grant')) {
      const invalidGrant = new Error('El Refresh Token de Planes de Acción venció, fue revocado o no corresponde al Client ID configurado. Genere uno nuevo en OAuth Playground con los permisos gmail.send y drive.');
      invalidGrant.statusCode = 503;
      throw invalidGrant;
    }
    if (status === 404) {
      const notFound = new Error('La carpeta raíz no existe o planeacionestrategica@unicesmag.edu.co no tiene acceso a ella.');
      notFound.statusCode = 404;
      throw notFound;
    }
    if (status === 403 && (reason.includes('scope') || reason.includes('permission'))) {
      const forbidden = new Error('El token OAuth de Planes de Acción no incluye permiso de Google Drive. Genere un nuevo Refresh Token con gmail.send y drive.');
      forbidden.statusCode = 403;
      throw forbidden;
    }
    throw error;
  }
};

const repositoryName = (value, max = 140) => String(value || 'SIN NOMBRE')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, max).replace(/[. ]+$/g, '') || 'SIN NOMBRE';

const compactFolderName = (code, label, max = 60) => {
  const safeCode = repositoryName(code || 'SIN-CODIGO', 18).replace(/\s+/g, '-');
  const available = Math.max(12, max - safeCode.length - 1);
  return `${safeCode}_${repositoryName(label, available)}`;
};

const compactFileName = (name, prefix, max = 78) => {
  const original = repositoryName(name, 220);
  const extension = path.extname(original).slice(0, 12);
  const base = extension ? original.slice(0, -extension.length) : original;
  const safePrefix = repositoryName(prefix, 22).replace(/\s+/g, '-');
  const available = Math.max(12, max - safePrefix.length - extension.length - 1);
  return `${safePrefix}_${repositoryName(base, available)}${extension}`;
};

const buildPedFolderName = (plan) => {
  const codeMatch = String(plan?.code || '').match(/PED-(\d{4})-(\d{4})/i);
  if (codeMatch) return `PED ${codeMatch[1]}-${codeMatch[2]}`;
  const nameMatch = String(plan?.name || '').match(/(\d{4})[–-](\d{4})/);
  if (nameMatch) return `PED ${nameMatch[1]}-${nameMatch[2]}`;
  const startYear = String(plan?.starts_on || '').slice(0, 4);
  const endYear = String(plan?.ends_on || '').slice(0, 4);
  if (/^\d{4}$/.test(startYear) && /^\d{4}$/.test(endYear)) return `PED ${startYear}-${endYear}`;
  return repositoryName(plan?.code || plan?.name || 'PED');
};

const driveEscape = (value) => String(value).replace(/'/g, "\\'");
const contentHash = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex');
const repositoryPropertyValue = (key) => {
  const value = String(key);
  if (Buffer.byteLength(REPOSITORY_PROPERTY, 'utf8') + Buffer.byteLength(value, 'utf8') <= MAX_APP_PROPERTY_BYTES) {
    return value;
  }
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
};

const findByRepositoryKey = async (drive, parentId, key, mimeType, expectedName = '') => {
  const propertyValue = repositoryPropertyValue(key);
  const mimeQuery = mimeType ? ` and mimeType='${driveEscape(mimeType)}'` : '';
  const response = await drive.files.list({
    q: `'${driveEscape(parentId)}' in parents and trashed=false${mimeQuery} and appProperties has { key='${REPOSITORY_PROPERTY}' and value='${driveEscape(propertyValue)}' }`,
    fields: 'files(id,name,mimeType,parents,appProperties,webViewLink)', spaces: 'drive',
    supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 2
  });
  if (response.data.files?.[0]) return response.data.files[0];

  // Compatibilidad de transición: la primera sincronización pudo ejecutarse con
  // otra identidad de Google. appProperties son privadas para la aplicación que
  // las creó, por lo que también reconocemos el elemento por nombre y carpeta.
  const safeName = repositoryName(expectedName, 180);
  if (!safeName) return null;
  const byName = await drive.files.list({
    q: `'${driveEscape(parentId)}' in parents and trashed=false${mimeQuery} and name='${driveEscape(safeName)}'`,
    fields: 'files(id,name,mimeType,parents,appProperties,webViewLink)', spaces: 'drive',
    supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 2
  });
  return byName.data.files?.[0] || null;
};

const ensureFolder = async (drive, { parentId, name, key, legacyParentIds = [] }, counters) => {
  const desiredName = repositoryName(name);
  const propertyValue = repositoryPropertyValue(key);
  let found = await findByRepositoryKey(drive, parentId, key, DRIVE_FOLDER, desiredName);
  let previousParents = [];
  if (!found) {
    for (const legacyParentId of legacyParentIds.filter(Boolean)) {
      found = await findByRepositoryKey(drive, legacyParentId, key, DRIVE_FOLDER, desiredName);
      if (found) {
        previousParents = (found.parents || []).filter((id) => id !== parentId);
        break;
      }
    }
  }
  if (found) {
    if (previousParents.length || found.name !== desiredName || found.appProperties?.[REPOSITORY_PROPERTY] !== propertyValue) {
      await drive.files.update({
        fileId: found.id,
        ...(previousParents.length ? { addParents: parentId, removeParents: previousParents.join(',') } : {}),
        requestBody: {
          name: desiredName,
          appProperties: { ...(found.appProperties || {}), [REPOSITORY_PROPERTY]: propertyValue }
        },
        fields: 'id', supportsAllDrives: true
      });
      counters.folders_updated += 1;
    } else counters.folders_existing += 1;
    return found.id;
  }
  const created = await drive.files.create({
    requestBody: {
      name: desiredName, mimeType: DRIVE_FOLDER, parents: [parentId],
      appProperties: { [REPOSITORY_PROPERTY]: propertyValue }
    },
    fields: 'id', supportsAllDrives: true
  });
  counters.folders_created += 1;
  return created.data.id;
};

const upsertFile = async (drive, { parentId, name, key, mimeType, buffer, hash }, counters) => {
  const found = await findByRepositoryKey(drive, parentId, key, null, name);
  if (found?.appProperties?.contentHash === hash) {
    counters.files_unchanged += 1;
    return found.id;
  }
  const requestBody = {
    name: repositoryName(name, 180),
    appProperties: { [REPOSITORY_PROPERTY]: repositoryPropertyValue(key), contentHash: String(hash) }
  };
  const media = { mimeType, body: Readable.from(buffer) };
  const response = found
    ? await drive.files.update({ fileId: found.id, requestBody, media, fields: 'id', supportsAllDrives: true })
    : await drive.files.create({ requestBody: { ...requestBody, parents: [parentId] }, media, fields: 'id', supportsAllDrives: true });
  counters[found ? 'files_updated' : 'files_created'] += 1;
  return response.data.id;
};

const intersectsPeriod = (item, period) => {
  if (!item.starts_on && !item.ends_on) return true;
  const starts = item.starts_on || item.ends_on;
  const ends = item.ends_on || item.starts_on;
  return starts <= period.ends_on && ends >= period.starts_on;
};

const buildRepositoryPeriods = (term) => {
  const configured = [...(term.monitoringPeriods || [])].sort((a, b) => Number(a.position) - Number(b.position));
  if (configured.length !== 2) return configured;
  return configured.map((period, index) => ({
    ...period.toJSON?.() || period,
    starts_on: index === 0 ? `${term.year}-01-01` : `${term.year}-08-01`,
    ends_on: index === 0 ? `${term.year}-07-31` : `${term.year}-12-31`
  }));
};

const buildOfficialWorkbook = async (actionPlan) => {
  const activities = (actionPlan.items || []).map((item) => {
    const sorted = [...(item.monitoringResults || [])].sort((a, b) => (a.period?.position || 0) - (b.period?.position || 0));
    return {
      objetivo_estrategico: item.custom_values?.strategic_objective || '',
      lineamiento_estrategico: item.custom_values?.guideline || '', actividad: item.activity,
      tipo_indicador: item.indicator_type, fecha_inicio: item.starts_on, fecha_fin: item.ends_on,
      indicador: item.indicator, meta: item.target, responsable: actionPlan.organizationalUnit?.name,
      corresponsable: (item.co_responsibles || []).join(', '), avance_ip: sorted[0]?.physical_progress,
      observaciones_ip: sorted[0]?.observations, avance_iip: sorted[1]?.physical_progress,
      observaciones_iip: sorted[1]?.observations
    };
  });
  return generatePlanAccionBuffer({
    planData: { anio: actionPlan.term.year, codigoPlan: actionPlan.code, responsable: actionPlan.organizationalUnit?.name },
    actividades: activities, corresponsabilidades: []
  });
};

const buildRepositoryEntries = (assignments = [], actionPlans = []) => {
  const plansByUnit = new Map(actionPlans
    .filter((plan) => plan.catalog_item_id || plan.organizationalUnit?.id)
    .map((plan) => [String(plan.catalog_item_id || plan.organizationalUnit.id), plan]));
  const entries = assignments
    .filter((assignment) => assignment.dependency?.id)
    .map((assignment) => {
      const unitId = String(assignment.dependency.id);
      return { unit: assignment.dependency, assignment, actionPlan: plansByUnit.get(unitId) || null };
    });
  const includedUnitIds = new Set(entries.map((entry) => String(entry.unit.id)));
  actionPlans.forEach((actionPlan) => {
    const unit = actionPlan.organizationalUnit;
    if (!unit?.id || includedUnitIds.has(String(unit.id))) return;
    entries.push({ unit, assignment: null, actionPlan });
  });
  return entries.sort((a, b) => String(a.unit.name || '').localeCompare(String(b.unit.name || ''), 'es'));
};

const mapWithConcurrency = async (items, concurrency, worker) => {
  const results = new Array(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await worker(items[index], index);
    }
  });
  await Promise.all(runners);
  return results;
};

const syncActionPlanRepositoryTerm = async (termId) => {
  const term = await StrategicTerm.findByPk(termId, {
    include: [
      { model: StrategicPlan, as: 'strategicPlan' },
      { model: StrategicMonitoringPeriod, as: 'monitoringPeriods' }
    ]
  });
  if (!term) throw Object.assign(new Error('La vigencia seleccionada no existe.'), { statusCode: 404 });
  const rootId = process.env[ROOT_ENV] || term.strategicPlan?.drive_root_id || process.env.SIAC_PEI_DRIVE_ROOT_ID;
  if (!rootId) throw Object.assign(new Error(`Configure ${ROOT_ENV} con el ID de la carpeta REPOSITORIO de Google Drive.`), { statusCode: 503 });

  const actionPlans = await StrategicActionPlan.findAll({
    where: { term_id: term.id, deleted_at: null },
    include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: StrategicTerm, as: 'term' },
      {
        model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false,
        include: [
          { model: StrategicMonitoringResult, as: 'monitoringResults', required: false, include: [{ model: StrategicMonitoringPeriod, as: 'period' }] },
          { model: StrategicEvidence, as: 'evidence', where: { deleted_at: null }, required: false }
        ]
      },
      {
        model: StrategicMeeting, as: 'meetings', required: false,
        include: [{ model: StrategicMinuteVersion, as: 'minuteVersions', where: { status: 'finalized' }, required: false }]
      }
    ],
    order: [[{ model: StrategicCatalogItem, as: 'organizationalUnit' }, 'name', 'ASC']]
  });
  const assignments = await listTermDependencies({ planId: term.strategic_plan_id, termId: term.id });
  const repositoryEntries = buildRepositoryEntries(assignments, actionPlans);

  const usingOAuth = hasUsableActionRepositoryOAuth();
  const drive = buildActionRepositoryDriveClient();
  await verifyRepositoryRoot(drive, rootId);
  const counters = { folders_created: 0, folders_updated: 0, folders_existing: 0, files_created: 0, files_updated: 0, files_unchanged: 0, dependencies: repositoryEntries.length, plans: actionPlans.length, pending_plans: repositoryEntries.filter((entry) => !entry.actionPlan).length, activities: 0, evidence: 0, minutes: 0 };
  const pedFolderName = buildPedFolderName(term.strategicPlan);
  const pedFolder = await ensureFolder(drive, {
    parentId: rootId,
    name: pedFolderName,
    key: `action-repository:ped:${term.strategic_plan_id}`
  }, counters);
  const yearFolder = await ensureFolder(drive, {
    parentId: pedFolder, name: `PLANES DE ACCIÓN ${term.year}`,
    key: `action-repository:term:${term.id}`,
    legacyParentIds: [rootId]
  }, counters);
  const periods = buildRepositoryPeriods(term);
  const planContexts = [];

  const contexts = await mapWithConcurrency(repositoryEntries, 6, async (entry) => {
    const { actionPlan, unit } = entry;
    const unitCode = unit?.code || actionPlan?.code;
    const unitName = unit?.name || actionPlan?.title;
    const unitScope = `${term.id}:${unit?.id || actionPlan.id}`;
    const planFolder = await ensureFolder(drive, {
      parentId: yearFolder, name: compactFolderName(unitCode, unitName, 44), key: `action-repository:unit:${unitScope}`
    }, counters);
    const minutesFolder = await ensureFolder(drive, { parentId: planFolder, name: 'ACTAS DE REUNIÓN', key: `action-repository:minutes:${unitScope}` }, counters);
    const officialFolder = await ensureFolder(drive, { parentId: planFolder, name: 'PLAN DE ACCIÓN OFICIAL DIR-PE-FR-003', key: `action-repository:official:${unitScope}` }, counters);
    const periodFolders = new Map();
    for (const [index, period] of periods.entries()) {
      const folderId = await ensureFolder(drive, {
        parentId: planFolder, name: `${term.year}-${index + 1}`,
        key: `action-repository:period:${unitScope}:${period.id}`
      }, counters);
      periodFolders.set(String(period.id), folderId);
    }

    // Una dependencia pendiente recibe la estructura base del repositorio,
    // pero no crea registros ni archivos de Plan de Accion dentro de SIAC.
    if (!actionPlan) return null;

    const activityFolders = new Map();
    for (const item of actionPlan.items || []) {
      counters.activities += 1;
      const evidencePeriodIds = new Set((item.evidence || []).map((file) => String(file.monitoring_period_id)));
      const applicablePeriods = periods.filter((period) => evidencePeriodIds.has(String(period.id)) || intersectsPeriod(item, period));
      for (const period of (applicablePeriods.length ? applicablePeriods : periods)) {
        const activityFolder = await ensureFolder(drive, {
          parentId: periodFolders.get(String(period.id)),
          name: compactFolderName(item.code, item.activity, 48),
          key: `action-repository:activity:${item.id}:period:${period.id}`
        }, counters);
        activityFolders.set(`${item.id}:${period.id}`, activityFolder);
      }
    }
    return { actionPlan, minutesFolder, officialFolder, activityFolders };
  });
  planContexts.push(...contexts.filter(Boolean));

  // Las cuentas de servicio pueden organizar carpetas compartidas en "Mi unidad",
  // pero Google no les concede cuota para crear archivos. En este modo temporal se
  // prepara toda la estructura; los documentos se incorporan al instalar el OAuth.
  if (!usingOAuth) {
    return {
      ...counters, year: term.year, ped_folder_id: pedFolder, ped_folder_name: pedFolderName, folder_id: yearFolder,
      folder_url: `https://drive.google.com/drive/folders/${yearFolder}`,
      drive_mode: 'service_account_folders_only', files_deferred: true
    };
  }

  for (const context of planContexts) {
    const { actionPlan, minutesFolder, officialFolder, activityFolders } = context;
    const workbook = await buildOfficialWorkbook(actionPlan);
    await upsertFile(drive, {
      parentId: officialFolder, name: `DIR-PE-FR-003_${actionPlan.code}_${term.year}.xlsx`,
      key: `action-repository:official-file:${actionPlan.id}`,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbook, hash: contentHash(workbook)
    }, counters);

    for (const meeting of actionPlan.meetings || []) {
      for (const minute of meeting.minuteVersions || []) {
        if (!minute.final_pdf_storage_key || !fs.existsSync(minute.final_pdf_storage_key)) continue;
        const buffer = fs.readFileSync(minute.final_pdf_storage_key);
        await upsertFile(drive, {
          parentId: minutesFolder, name: `ACTA_${actionPlan.code}_V${minute.version}.pdf`,
          key: `action-repository:minute:${minute.id}`, mimeType: 'application/pdf', buffer,
          hash: minute.final_pdf_hash || contentHash(buffer)
        }, counters);
        counters.minutes += 1;
      }
    }

    for (const item of actionPlan.items || []) {
      const evidencePeriodIds = new Set((item.evidence || []).map((file) => String(file.monitoring_period_id)));
      const applicablePeriods = periods.filter((period) => evidencePeriodIds.has(String(period.id)) || intersectsPeriod(item, period));
      for (const period of (applicablePeriods.length ? applicablePeriods : periods)) {
        const activityFolder = activityFolders.get(`${item.id}:${period.id}`);
        for (const evidence of (item.evidence || []).filter((file) => String(file.monitoring_period_id) === String(period.id))) {
          if (!evidence.storage_key || !fs.existsSync(evidence.storage_key)) continue;
          const buffer = fs.readFileSync(evidence.storage_key);
          await upsertFile(drive, {
            parentId: activityFolder,
            name: compactFileName(evidence.original_name || evidence.stored_name, `EV-${String(evidence.id).slice(0, 8)}`, 64),
            key: `action-repository:evidence:${evidence.id}`, mimeType: evidence.mime_type,
            buffer, hash: evidence.sha256 || contentHash(buffer)
          }, counters);
          counters.evidence += 1;
        }
      }
    }
  }

  return {
    ...counters, year: term.year, ped_folder_id: pedFolder, ped_folder_name: pedFolderName, folder_id: yearFolder,
    folder_url: `https://drive.google.com/drive/folders/${yearFolder}`
  };
};

module.exports = {
  syncActionPlanRepositoryTerm,
  repositoryName,
  compactFolderName,
  compactFileName,
  buildPedFolderName,
  intersectsPeriod,
  buildRepositoryPeriods,
  buildOfficialWorkbook,
  buildRepositoryEntries,
  buildActionRepositoryDriveAuth,
  buildActionRepositoryServiceAccountAuth,
  hasUsableActionRepositoryOAuth,
  repositoryPropertyValue,
  REPOSITORY_PROPERTY,
  MAX_APP_PROPERTY_BYTES
};
