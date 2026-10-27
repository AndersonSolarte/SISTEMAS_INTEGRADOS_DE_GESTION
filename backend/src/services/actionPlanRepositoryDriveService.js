const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Readable } = require('stream');
const { google } = require('googleapis');
const {
  StrategicPlan, StrategicTerm, StrategicActionPlan, StrategicActionItem,
  StrategicCatalogItem, StrategicMonitoringPeriod, StrategicMonitoringResult,
  StrategicEvidence, StrategicMeeting, StrategicMinuteVersion, StrategicElement,
  User, StrategicResponsibility
} = require('../models');
const { Op } = require('sequelize');
const { generatePlanAccionBuffer } = require('./planAccionExportService');
const { listTermDependencies } = require('./strategicTermDependencyService');
const { ensureMinuteFinalPdfBuffer } = require('./strategicMinutePdfService');

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
  const subject = String(
    process.env.GOOGLE_SERVICE_ACCOUNT_SUBJECT ||
    process.env.GOOGLE_IMPERSONATE_EMAIL ||
    process.env.GOOGLE_WORKSPACE_ADMIN_EMAIL ||
    ''
  ).trim();
  return new google.auth.JWT({
    email,
    key,
    scopes: ['https://www.googleapis.com/auth/drive'],
    ...(subject ? { subject } : {})
  });
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

const repositoryName = (value, max = 240) => String(value || 'SIN NOMBRE')
  .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
  .replace(/\s+/g, ' ').trim().replace(/[. ]+$/g, '').slice(0, max).replace(/[. ]+$/g, '') || 'SIN NOMBRE';

const compactFolderName = (code, label, max = 240) => {
  return repositoryName(label || code || 'SIN NOMBRE', max);
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
  if (byName.data.files?.[0]) return byName.data.files[0];

  // Si el nombre anterior fue truncado a 48 caracteres o modificado, buscar por prefijo
  if (safeName.length > 40) {
    const prefix = safeName.slice(0, 42);
    const byPrefix = await drive.files.list({
      q: `'${driveEscape(parentId)}' in parents and trashed=false${mimeQuery} and name contains '${driveEscape(prefix)}'`,
      fields: 'files(id,name,mimeType,parents,appProperties,webViewLink)', spaces: 'drive',
      supportsAllDrives: true, includeItemsFromAllDrives: true, pageSize: 2
    });
    if (byPrefix.data.files?.[0]) return byPrefix.data.files[0];
  }
  return null;
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
  try {
    const response = found
      ? await drive.files.update({ fileId: found.id, requestBody, media, fields: 'id', supportsAllDrives: true })
      : await drive.files.create({ requestBody: { ...requestBody, parents: [parentId] }, media, fields: 'id', supportsAllDrives: true });
    counters[found ? 'files_updated' : 'files_created'] += 1;
    return response.data.id;
  } catch (error) {
    const errorMsg = String(error?.response?.data?.error?.message || error?.message || '');
    if (errorMsg.includes('Service Accounts do not have storage quota') || errorMsg.includes('storage quota')) {
      console.warn(`[Drive Quota Notice]: La cuenta de servicio no tiene cuota directa para alojar "${name}". La estructura de carpetas en Google Drive permanece creada y lista.`);
      counters.files_storage_quota_limited = (counters.files_storage_quota_limited || 0) + 1;
      return null;
    }
    throw error;
  }
};

const parsePeriodDate = (val) => {
  if (!val) return null;
  if (typeof val === 'string') return val.slice(0, 10);
  if (val instanceof Date) return val.toISOString().slice(0, 10);
  return null;
};

const intersectsPeriod = (item, period) => {
  const itemStart = parsePeriodDate(item.starts_on || item.custom_values?.starts_on || item.custom_values?.fecha_inicio || item.fecha_inicio);
  const itemEnd = parsePeriodDate(item.ends_on || item.custom_values?.ends_on || item.custom_values?.fecha_fin || item.fecha_fin || itemStart);
  if (!itemStart && !itemEnd) return true;
  const starts = itemStart || itemEnd;
  const ends = itemEnd || itemStart;
  const pStarts = parsePeriodDate(period.starts_on);
  const pEnds = parsePeriodDate(period.ends_on);
  if (!pStarts || !pEnds) return true;
  return starts <= pEnds && ends >= pStarts;
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

const normalizeMatchText = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

const findCoResponsibleActivitiesForPlan = async (actionPlan, catalogMap = new Map(), elementMap = new Map(), options = {}) => {
  const termId = actionPlan.term_id || actionPlan.term?.id;
  if (!termId) return [];

  const unitName = actionPlan.organizationalUnit?.name;
  const unitCode = actionPlan.organizationalUnit?.code;
  const planCode = actionPlan.code;
  const unitId = actionPlan.catalog_item_id || actionPlan.organizationalUnit?.id;
  const user = actionPlan.currentResponsibility?.responsibleUser || actionPlan.responsibleUser || actionPlan.owner;
  let userNombre = user?.nombre;
  let userUsername = user?.username;

  if (!userNombre && actionPlan.responsible_user_id) {
    try {
      const u = await User.findByPk(actionPlan.responsible_user_id, { attributes: ['nombre', 'username'] });
      if (u) {
        userNombre = u.nombre;
        userUsername = u.username;
      }
    } catch (_) {}
  }

  const rawTokens = [unitName, unitCode, planCode, userNombre, userUsername].filter(Boolean);
  const normTokens = rawTokens.map(normalizeMatchText).filter((t) => t.length >= 3);

  rawTokens.forEach((t) => {
    const rMatch = String(t).match(/\bR\d+\b/i);
    if (rMatch) normTokens.push(rMatch[0].toLowerCase());
  });

  if (!normTokens.length && !unitId) return [];

  // Resolver catalogMap y elementMap si no están cargados
  let planId = actionPlan.term?.strategic_plan_id || actionPlan.term?.strategicPlan?.id;
  if (!planId && termId) {
    try {
      const termRow = await StrategicTerm.findByPk(termId, { attributes: ['strategic_plan_id'] });
      planId = termRow?.strategic_plan_id;
    } catch (_) {}
  }

  if (planId && (catalogMap.size === 0 || elementMap.size === 0)) {
    try {
      const [catRows, elemRows] = await Promise.all([
        StrategicCatalogItem.findAll({ where: { strategic_plan_id: planId }, attributes: ['id', 'code', 'name'], raw: true }),
        StrategicElement.findAll({ where: { strategic_plan_id: planId }, attributes: ['id', 'code', 'name'], raw: true })
      ]);
      catRows.forEach((c) => catalogMap.set(String(c.id), c.name));
      elemRows.forEach((e) => elementMap.set(String(e.id), `${e.code ? e.code + ' ' : ''}${e.name}`));
    } catch (_) {}
  }

  const whereClause = {
    term_id: termId,
    id: { [Op.ne]: actionPlan.id },
    deleted_at: null
  };

  // Solo planes aprobados/formalizados para ejecución (active, monitoring, closed)
  if (options.onlyApproved !== false) {
    whereClause.status = { [Op.in]: ['active', 'monitoring', 'closed'] };
  }

  const otherPlans = await StrategicActionPlan.findAll({
    where: whereClause,
    include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit' },
      { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'], required: false },
      {
        model: StrategicResponsibility, as: 'currentResponsibility', required: false,
        include: [{ model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'], required: false }]
      },
      {
        model: StrategicActionItem, as: 'items',
        where: { deleted_at: null },
        required: false,
        include: [
          {
            model: StrategicMonitoringResult, as: 'monitoringResults',
            required: false,
            include: [{ model: StrategicMonitoringPeriod, as: 'period' }]
          },
          {
            model: StrategicEvidence, as: 'evidence',
            where: { deleted_at: null },
            required: false
          }
        ]
      }
    ]
  });

  const coActivities = [];

  for (const otherPlan of otherPlans) {
    let leaderUser = otherPlan.currentResponsibility?.responsibleUser || otherPlan.responsibleUser;
    if (!leaderUser && otherPlan.responsible_user_id) {
      leaderUser = await User.findByPk(otherPlan.responsible_user_id, {
        attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username']
      }).catch(() => null);
    }
    if (!leaderUser && otherPlan.catalog_item_id && otherPlan.term_id) {
      const annual = await StrategicResponsibility.findOne({
        where: { term_id: otherPlan.term_id, catalog_item_id: otherPlan.catalog_item_id, status: 'active' },
        include: [{ model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'] }],
        order: [['updated_at', 'DESC']]
      }).catch(() => null);
      if (annual?.responsibleUser) leaderUser = annual.responsibleUser;
    }
    const leaderName = leaderUser?.nombre || leaderUser?.username || '';
    const depName = otherPlan.organizationalUnit?.name || otherPlan.title || 'Dependencia';

    for (const item of (otherPlan.items || [])) {
      const coList = Array.isArray(item.co_responsibles)
        ? item.co_responsibles
        : (typeof item.co_responsibles === 'string' && item.co_responsibles.trim() ? [item.co_responsibles] : []);

      const customCo = item.custom_values?.co_responsibles || item.custom_values?.co_responsible || '';
      const customList = Array.isArray(customCo)
        ? customCo
        : (typeof customCo === 'string' && customCo.trim() ? [customCo] : []);

      const allCoEntries = [...coList, ...customList];

      const isMatch = allCoEntries.some((entry) => {
        const strEntry = String(entry || '').trim();
        if (!strEntry) return false;
        if (unitId && String(strEntry) === String(unitId)) return true;
        const normEntry = normalizeMatchText(strEntry);
        const resolvedName = catalogMap.get(strEntry) || '';
        const normResolved = normalizeMatchText(resolvedName);
        return normTokens.some((tok) =>
          (normEntry && (normEntry.includes(tok) || (tok.length > 5 && tok.includes(normEntry)))) ||
          (normResolved && (normResolved.includes(tok) || (tok.length > 5 && tok.includes(normResolved))))
        );
      });

      if (isMatch) {
        const sorted = [...(item.monitoringResults || [])].sort((a, b) => (a.period?.position || 0) - (b.period?.position || 0));

        const { objText, guideText } = resolveItemStrategicObjectiveAndGuideline(item, elementMap);

        const resolvedCo = coList.map((val) => catalogMap.get(String(val)) || val).filter(Boolean).join(', ');

        const macroactivityText = item.macroactivity || item.custom_values?.macroactivity || item.custom_values?.macroactividad || (item.strategic_element_id ? elementMap.get(String(item.strategic_element_id)) : '') || '';

        coActivities.push({
          id: item.id,
          code: item.code,
          activity: item.activity,
          actividad: item.activity,
          macroactivity: macroactivityText,
          indicator_type: item.indicator_type,
          tipo_indicador: item.indicator_type,
          indicator: item.indicator,
          indicador: item.indicator,
          target: item.target,
          meta: item.target,
          starts_on: item.starts_on,
          ends_on: item.ends_on,
          fecha_inicio: item.starts_on,
          fecha_fin: item.ends_on,
          parent_plan: {
            id: otherPlan.id,
            code: otherPlan.code,
            dependency_name: depName,
            leader_name: leaderName,
            status: otherPlan.status
          },
          parent_plan_id: otherPlan.id,
          parent_plan_code: otherPlan.code,
          parent_plan_name: depName,
          responsable: depName,
          leader_name: leaderName,
          corresponsable: resolvedCo || unitName,
          co_responsibles: coList,
          objetivo_estrategico: objText,
          lineamiento_estrategico: guideText,
          custom_values: item.custom_values || {},
          current_progress: item.current_progress,
          avance_ip: sorted[0]?.physical_progress,
          observaciones_ip: sorted[0]?.observations,
          avance_iip: sorted[1]?.physical_progress,
          observaciones_iip: sorted[1]?.observations,
          monitoringResults: item.monitoringResults || [],
          evidence: item.evidence || []
        });
      }
    }
  }

  return coActivities;
};

const resolveItemStrategicObjectiveAndGuideline = (item, elementMap, elements = []) => {
  const custom = item?.custom_values && typeof item.custom_values === 'object' ? item.custom_values : {};

  let rawObj = custom.strategic_objective
    || custom.objetivo_estrategico
    || custom.objetivos
    || custom.objetivo
    || custom.objetivo_general
    || '';

  let rawGuide = custom.strategic_guideline
    || custom.guideline
    || custom.lineamiento_estrategico
    || custom.lineas_de_accion
    || custom.linea_de_accion
    || custom.lineamiento
    || custom.lineamientos
    || '';

  if (!rawObj) {
    const objKey = Object.keys(custom).find((k) => /objetiv/i.test(k));
    if (objKey) rawObj = custom[objKey];
  }
  if (!rawGuide) {
    const guideKey = Object.keys(custom).find((k) => /linea|guide/i.test(k));
    if (guideKey) rawGuide = custom[guideKey];
  }

  if (!rawObj || !rawGuide) {
    for (const [k, v] of Object.entries(custom)) {
      if (k.startsWith('structure_level_') && v) {
        const matchedEl = elements.find((e) => String(e.id) === String(v));
        if (matchedEl) {
          if (matchedEl.parent_id && !rawGuide) {
            rawGuide = v;
          } else if (!matchedEl.parent_id && !rawObj) {
            rawObj = v;
          }
        }
      }
    }
  }

  if ((!rawObj || !rawGuide) && item?.strategic_element_id) {
    const matchedEl = elements.find((e) => String(e.id) === String(item.strategic_element_id));
    if (matchedEl) {
      if (matchedEl.parent_id) {
        if (!rawGuide) rawGuide = matchedEl.id;
        if (!rawObj) rawObj = matchedEl.parent_id;
      } else {
        if (!rawObj) rawObj = matchedEl.id;
      }
    }
  }

  const resolveText = (val) => {
    if (!val) return '';
    const strVal = String(val).trim();
    if (elementMap && elementMap.has(strVal)) return elementMap.get(strVal);
    const byCode = (elements || []).find((e) => e.code && e.code.toLowerCase() === strVal.toLowerCase());
    if (byCode) return `${byCode.code ? byCode.code + ' ' : ''}${byCode.name}`;
    return strVal;
  };

  return {
    objText: resolveText(rawObj),
    guideText: resolveText(rawGuide)
  };
};

const buildOfficialWorkbook = async (actionPlan) => {
  let planId = actionPlan.term?.strategic_plan_id || actionPlan.term?.strategicPlan?.id;
  if (!planId && actionPlan.term_id) {
    try {
      const termRow = await StrategicTerm.findByPk(actionPlan.term_id, { attributes: ['strategic_plan_id'] });
      planId = termRow?.strategic_plan_id;
    } catch (_) {}
  }
  if (!planId) {
    try {
      const activePed = await StrategicPlan.findOne({ where: { status: 'active' }, attributes: ['id'] });
      planId = activePed?.id;
    } catch (_) {}
  }

  const [catalogItems, elements] = await Promise.all([
    planId ? StrategicCatalogItem.findAll({ where: { strategic_plan_id: planId }, attributes: ['id', 'code', 'name'], raw: true }).catch(() => []) : [],
    planId ? StrategicElement.findAll({ where: { strategic_plan_id: planId }, attributes: ['id', 'code', 'name', 'level_id', 'parent_id'], raw: true }).catch(() => []) : []
  ]);
  const catalogMap = new Map(catalogItems.map((c) => [String(c.id), c.name]));
  const elementMap = new Map(elements.map((e) => [String(e.id), `${e.code ? e.code + ' ' : ''}${e.name}`]));

  const activities = (actionPlan.items || []).map((item) => {
    const sorted = [...(item.monitoringResults || [])].sort((a, b) => (a.period?.position || 0) - (b.period?.position || 0));

    const { objText, guideText } = resolveItemStrategicObjectiveAndGuideline(item, elementMap, elements);

    const rawCo = item.co_responsibles || [];
    const coList = Array.isArray(rawCo) ? rawCo : (typeof rawCo === 'string' && rawCo.trim() ? [rawCo] : []);
    const resolvedCo = coList.map((val) => catalogMap.get(String(val)) || val).filter(Boolean).join(', ');

    return {
      objetivo_estrategico: objText,
      lineamiento_estrategico: guideText,
      actividad: item.activity,
      tipo_indicador: item.indicator_type,
      fecha_inicio: item.starts_on,
      fecha_fin: item.ends_on,
      indicador: item.indicator,
      meta: item.target,
      responsable: actionPlan.organizationalUnit?.name,
      corresponsable: resolvedCo,
      avance_ip: sorted[0]?.physical_progress,
      observaciones_ip: sorted[0]?.observations,
      avance_iip: sorted[1]?.physical_progress,
      observaciones_iip: sorted[1]?.observations
    };
  });

  const coActivities = await findCoResponsibleActivitiesForPlan(actionPlan, catalogMap, elementMap, elements);

  return generatePlanAccionBuffer({
    planData: { anio: actionPlan.term?.year || new Date().getFullYear(), codigoPlan: actionPlan.code, responsable: actionPlan.organizationalUnit?.name },
    actividades: activities,
    corresponsabilidades: coActivities
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
      parentId: yearFolder, name: compactFolderName(unitCode, unitName, 240), key: `action-repository:unit:${unitScope}`
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
          name: compactFolderName(item.code, item.activity, 240),
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
  // prepara toda la estructura; los documentos se incorporan al instalar el OAuth o Shared Drive.
  if (!usingOAuth) {
    const serviceAccountResult = {
      ...counters, year: term.year, ped_folder_id: pedFolder, ped_folder_name: pedFolderName, folder_id: yearFolder,
      folder_url: `https://drive.google.com/drive/folders/${yearFolder}`,
      drive_mode: 'service_account_folders_only', files_deferred: true,
      synced_at: new Date().toISOString()
    };
    try {
      await term.update({
        metadata: {
          ...(term.metadata || {}),
          drive_sync: {
            synced_at: serviceAccountResult.synced_at,
            folder_id: yearFolder,
            folder_url: serviceAccountResult.folder_url,
            ped_folder_id: pedFolder,
            ped_folder_name: pedFolderName,
            drive_mode: serviceAccountResult.drive_mode,
            files_deferred: true,
            dependencies: repositoryEntries.length
          }
        }
      });
    } catch (e) {
      console.warn('[syncActionPlanRepositoryTerm]: No se pudo guardar metadata en term:', e.message);
    }
    return serviceAccountResult;
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

    const usedMinuteNames = new Set();
    for (const meeting of actionPlan.meetings || []) {
      for (const minute of meeting.minuteVersions || []) {
        const buffer = await ensureMinuteFinalPdfBuffer(minute);
        if (!buffer) continue;
        const meetingDate = meeting.starts_at && !Number.isNaN(new Date(meeting.starts_at).getTime())
          ? new Date(meeting.starts_at).toISOString().slice(0, 10)
          : String(minute.finalized_at || minute.created_at || '').slice(0, 10);
        const minuteTitle = String(meeting.title || minute.content?.title || minute.content?.header?.title || minute.content?.meeting?.title || '').trim();
        const baseMinuteLabel = minuteTitle
          ? `${repositoryName(minuteTitle, 160)}.pdf`
          : `ACTA_${meetingDate || term.year}.pdf`;
        let minuteLabel = baseMinuteLabel;
        let dup = 2;
        while (usedMinuteNames.has(minuteLabel.toLowerCase())) {
          const ext = path.extname(baseMinuteLabel);
          const baseNoExt = baseMinuteLabel.slice(0, -ext.length);
          minuteLabel = `${baseNoExt} (${dup})${ext}`;
          dup += 1;
        }
        usedMinuteNames.add(minuteLabel.toLowerCase());
        const driveFileId = await upsertFile(drive, {
          parentId: minutesFolder, name: minuteLabel,
          key: `action-repository:minute:${minute.id}`, mimeType: 'application/pdf', buffer,
          hash: minute.final_pdf_hash || contentHash(buffer)
        }, counters);
        if (driveFileId && minute.drive_file_id !== driveFileId) {
          await minute.update({ drive_file_id: driveFileId });
        }
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

  const fullOAuthResult = {
    ...counters, year: term.year, ped_folder_id: pedFolder, ped_folder_name: pedFolderName, folder_id: yearFolder,
    folder_url: `https://drive.google.com/drive/folders/${yearFolder}`,
    drive_mode: 'oauth_full', files_deferred: false,
    synced_at: new Date().toISOString()
  };
  try {
    await term.update({
      metadata: {
        ...(term.metadata || {}),
        drive_sync: {
          synced_at: fullOAuthResult.synced_at,
          folder_id: yearFolder,
          folder_url: fullOAuthResult.folder_url,
          ped_folder_id: pedFolder,
          ped_folder_name: pedFolderName,
          drive_mode: 'oauth_full',
          files_deferred: false,
          folders_created: counters.folders_created,
          dependencies: repositoryEntries.length
        }
      }
    });
  } catch (e) {
    console.warn('[syncActionPlanRepositoryTerm]: No se pudo guardar metadata en term:', e.message);
  }
  return fullOAuthResult;
};

const syncSinglePlanOfficialWorkbook = async (actionPlanId) => {
  const actionPlan = await StrategicActionPlan.findByPk(actionPlanId, {
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

  if (!actionPlan || !actionPlan.term) {
    throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  }

  const term = actionPlan.term;
  const plan = term.strategicPlan;
  const rootId = process.env[ROOT_ENV] || plan?.drive_root_id || process.env.SIAC_PEI_DRIVE_ROOT_ID;
  if (!rootId) {
    return {
      synchronized: false,
      skipped: true,
      reason: 'No hay carpeta raíz de Google Drive configurada.'
    };
  }

  let drive;
  try {
    drive = buildActionRepositoryDriveClient();
    await verifyRepositoryRoot(drive, rootId);
  } catch (err) {
    console.warn('[Drive Auto-sync warning]:', err.message);
    return {
      synchronized: false,
      error: err.message
    };
  }

  const counters = {
    folders_created: 0, folders_updated: 0, folders_existing: 0,
    files_created: 0, files_updated: 0, files_unchanged: 0
  };

  const pedFolderName = buildPedFolderName(plan);
  const pedFolder = await ensureFolder(drive, {
    parentId: rootId,
    name: pedFolderName,
    key: `action-repository:ped:${term.strategic_plan_id}`
  }, counters);

  const yearFolder = await ensureFolder(drive, {
    parentId: pedFolder,
    name: `PLANES DE ACCIÓN ${term.year}`,
    key: `action-repository:term:${term.id}`,
    legacyParentIds: [rootId]
  }, counters);

  const unitCode = actionPlan.organizationalUnit?.code || actionPlan.code;
  const unitName = actionPlan.organizationalUnit?.name || actionPlan.title;
  const unitScope = `${term.id}:${actionPlan.catalog_item_id || actionPlan.id}`;

  const planFolder = await ensureFolder(drive, {
    parentId: yearFolder,
    name: compactFolderName(unitCode, unitName, 240),
    key: `action-repository:unit:${unitScope}`
  }, counters);

  const officialFolder = await ensureFolder(drive, {
    parentId: planFolder,
    name: 'PLAN DE ACCIÓN OFICIAL DIR-PE-FR-003',
    key: `action-repository:official:${unitScope}`
  }, counters);

  const workbook = await buildOfficialWorkbook(actionPlan);
  const fileName = `DIR-PE-FR-003_${actionPlan.code}_${term.year}.xlsx`;
  const fileHash = contentHash(workbook);

  const driveFileId = await upsertFile(drive, {
    parentId: officialFolder,
    name: fileName,
    key: `action-repository:official-file:${actionPlan.id}`,
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: workbook,
    hash: fileHash
  }, counters);

  const driveSync = {
    official_file_id: driveFileId,
    official_file_name: fileName,
    folder_id: officialFolder,
    folder_name: 'PLAN DE ACCIÓN OFICIAL DIR-PE-FR-003',
    synced_at: new Date().toISOString(),
    hash: fileHash,
    storage_quota_limited: !driveFileId
  };

  actionPlan.metadata = {
    ...(actionPlan.metadata || {}),
    drive_sync: driveSync
  };
  await actionPlan.update({ metadata: actionPlan.metadata });

  return {
    synchronized: true,
    storageQuotaLimited: !driveFileId,
    fileId: driveFileId,
    fileName,
    folderId: officialFolder,
    folderUrl: `https://drive.google.com/drive/folders/${officialFolder}`,
    syncedAt: driveSync.synced_at,
    message: !driveFileId
      ? 'Carpeta oficial preparada en Google Drive. Para alojar el archivo Excel directamente en la nube, Google requiere que la carpeta esté en una Unidad Compartida (Shared Drive) o vincular la cuenta institucional con OAuth.'
      : 'Plan de Acción Oficial DIR-PE-FR-003 sincronizado con Drive.'
  };
};

module.exports = {
  syncActionPlanRepositoryTerm,
  syncSinglePlanOfficialWorkbook,
  repositoryName,
  compactFolderName,
  compactFileName,
  buildPedFolderName,
  intersectsPeriod,
  buildRepositoryPeriods,
  buildOfficialWorkbook,
  findCoResponsibleActivitiesForPlan,
  buildRepositoryEntries,
  buildActionRepositoryDriveClient,
  buildActionRepositoryDriveAuth,
  buildActionRepositoryServiceAccountAuth,
  hasUsableActionRepositoryOAuth,
  repositoryPropertyValue,
  REPOSITORY_PROPERTY,
  MAX_APP_PROPERTY_BYTES
};
