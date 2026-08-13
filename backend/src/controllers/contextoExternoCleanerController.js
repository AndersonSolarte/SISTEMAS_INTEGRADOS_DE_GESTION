const fs = require('fs/promises');
const { openAsBlob } = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Op } = require('sequelize');
const { DiccionarioCorreccionTexto } = require('../models');

const PYTHON_SERVICE_URL = String(
  process.env.CONTEXTO_EXTERNO_PYTHON_URL
  || process.env.SABER_PRO_PYTHON_URL
  || 'http://127.0.0.1:8000'
).replace(/\/$/, '');

const FORWARDED_HEADERS = [
  'content-disposition',
  'content-type',
  'x-input-rows',
  'x-output-rows',
  'x-duplicates-removed',
  'x-empty-rows-removed',
  'x-matched-columns',
  'x-corrections-count',
  'x-saved-rules',
  'x-rules-warning',
  'x-review-id',
  'x-review-status',
  'x-source-sheet'
];

const REVIEW_ROOT = path.resolve(__dirname, '../../uploads/contexto-externo-reviews');
const JOB_ROOT = path.resolve(__dirname, '../../uploads/contexto-externo-cleaning-jobs');
const REVIEW_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const JOB_RETENTION_MS = Math.max(60 * 60 * 1000, Number(process.env.CONTEXTO_EXTERNO_JOB_RETENTION_MS || 24 * 60 * 60 * 1000));
const JOB_ID_PATTERN = /^[0-9a-f-]{36}$/i;
const cleaningQueue = [];
let cleaningWorkerRunning = false;
const SERVICE_STARTED_AT = Date.now();

const getReviewPaths = (reviewId) => {
  if (!REVIEW_ID_PATTERN.test(String(reviewId || ''))) return null;
  return {
    metadata: path.join(REVIEW_ROOT, `${reviewId}.review`),
    legacyMetadata: path.join(REVIEW_ROOT, `${reviewId}.json`),
    workbook: path.join(REVIEW_ROOT, `${reviewId}.xlsx`)
  };
};

const readReview = async (reviewId) => {
  const paths = getReviewPaths(reviewId);
  if (!paths) return null;
  try {
    let metadataPath = paths.metadata;
    let raw;
    try {
      raw = await fs.readFile(metadataPath, 'utf8');
    } catch (_) {
      metadataPath = paths.legacyMetadata;
      raw = await fs.readFile(metadataPath, 'utf8');
    }
    const metadata = JSON.parse(raw);
    return { metadata, paths: { ...paths, metadata: metadataPath } };
  } catch (_) {
    return null;
  }
};

const canAccessReview = (review, user) => (
  !review?.userId || String(review.userId) === String(user?.id || '')
);

const saveReview = async ({ cleanFile, cleanPath, corrections, filename, lista, userId, reviewId: customReviewId }) => {
  await fs.mkdir(REVIEW_ROOT, { recursive: true });
  const reviewId = customReviewId || crypto.randomUUID();
  const paths = getReviewPaths(reviewId);
  const metadata = {
    reviewId,
    filename,
    lista,
    userId: userId || null,
    status: 'pending',
    corrections: Array.isArray(corrections) ? corrections : [],
    createdAt: new Date().toISOString(),
    savedRules: 0
  };
  const promises = [
    fs.writeFile(paths.metadata, JSON.stringify(metadata), 'utf8')
  ];
  if (cleanFile) {
    promises.push(fs.writeFile(paths.workbook, cleanFile));
  } else if (cleanPath && cleanPath !== paths.workbook) {
    promises.push(fs.copyFile(cleanPath, paths.workbook));
  }
  await Promise.all(promises);
  return metadata;
};

const dictionaryKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '')
  .trim();

const persistCorrections = async (corrections = [], userId = null) => {
  const candidates = (Array.isArray(corrections) ? corrections : [])
    .filter((item) => item?.valor_detectado && item?.valor_estandar)
    .filter((item) => String(item.valor_detectado).trim() !== String(item.valor_estandar).trim())
    .slice(0, Number(process.env.CONTEXTO_EXTERNO_MAX_NEW_RULES || 10000));
  if (!candidates.length) return 0;

  const existingRows = await DiccionarioCorreccionTexto.findAll({
    where: { ambito: 'CONTEXTO_EXTERNO' },
    attributes: ['columna', 'valor_detectado', 'valor_estandar'],
    raw: true
  });
  const existing = new Set(existingRows.map((item) => [
    String(item.columna || '*').toUpperCase(),
    dictionaryKey(item.valor_detectado),
    dictionaryKey(item.valor_estandar)
  ].join('||')));

  const additions = [];
  candidates.forEach((item) => {
    const column = String(item.columna || '*').toUpperCase().slice(0, 120);
    const key = [column, dictionaryKey(item.valor_detectado), dictionaryKey(item.valor_estandar)].join('||');
    if (existing.has(key)) return;
    existing.add(key);
    additions.push({
      ambito: 'CONTEXTO_EXTERNO',
      columna: column,
      valor_detectado: String(item.valor_detectado).slice(0, 500),
      valor_estandar: String(item.valor_estandar).slice(0, 500),
      activo: true,
      prioridad: 120,
      observacion: [
        'AUTO_GENERADA_LIMPIADOR_PYTHON',
        item.motivo || '',
        item.codigo_referencia ? `CODIGO:${item.codigo_referencia}` : '',
        item.ocurrencias ? `OCURRENCIAS:${item.ocurrencias}` : ''
      ].filter(Boolean).join(' | ').slice(0, 500),
      creado_por: userId,
      actualizado_por: userId
    });
  });
  if (!additions.length) return 0;

  await DiccionarioCorreccionTexto.bulkCreate(additions, { ignoreDuplicates: true });
  return additions.length;
};

const getJobPaths = (jobId, extension = '') => {
  if (!JOB_ID_PATTERN.test(String(jobId || ''))) return null;
  const safeExtension = /^\.[a-z0-9]{1,8}$/i.test(extension) ? extension.toLowerCase() : '.xlsx';
  return {
    metadata: path.join(JOB_ROOT, `${jobId}.job`),
    legacyMetadata: path.join(JOB_ROOT, `${jobId}.json`),
    input: path.join(JOB_ROOT, `${jobId}-input${safeExtension}`)
  };
};

const writeJob = async (job) => {
  await fs.mkdir(JOB_ROOT, { recursive: true });
  const paths = getJobPaths(job?.jobId, path.extname(job?.inputPath || ''));
  if (!paths) throw new Error('Identificador de trabajo invÃ¡lido.');
  const tempPath = `${paths.metadata}.${process.pid}.${Date.now()}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(job), 'utf8');
  await fs.rename(tempPath, paths.metadata);
  await fs.unlink(paths.legacyMetadata).catch(() => {});
  return job;
};

const readJob = async (jobId) => {
  const paths = getJobPaths(jobId);
  if (!paths) return null;
  try {
    try {
      return JSON.parse(await fs.readFile(paths.metadata, 'utf8'));
    } catch (_) {
      return JSON.parse(await fs.readFile(paths.legacyMetadata, 'utf8'));
    }
  } catch (_) {
    return null;
  }
};

const listStoredJobIds = async () => {
  const names = await fs.readdir(JOB_ROOT).catch(() => []);
  return Array.from(new Set(names
    .filter((name) => name.endsWith('.job') || name.endsWith('.json'))
    .map((name) => name.replace(/\.(?:job|json)$/i, ''))
    .filter((jobId) => JOB_ID_PATTERN.test(jobId))));
};

const canAccessJob = (job, user) => !job?.userId || String(job.userId) === String(user?.id || '');

const axios = require('axios');
const http = require('http');

const httpAgent = new http.Agent({ keepAlive: true, timeout: 1800000 });

const runPythonCleanerPath = async ({ inputPath, outputPath, lista }) => {
  const activeRules = await DiccionarioCorreccionTexto.findAll({
    where: { activo: true, ambito: { [Op.in]: ['GENERAL', 'CONTEXTO_EXTERNO'] } },
    attributes: ['ambito', 'columna', 'valor_detectado', 'valor_estandar', 'prioridad'],
    order: [['prioridad', 'ASC'], ['id', 'ASC']],
    raw: true
  });

  const timeoutMs = Number(process.env.CONTEXTO_EXTERNO_PYTHON_TIMEOUT_MS || 1800000);

  const response = await axios.post(`${PYTHON_SERVICE_URL}/contexto-externo/limpiar-path`, {
    input_path: inputPath,
    output_path: outputPath,
    lista,
    reglas: activeRules
  }, {
    timeout: timeoutMs
  });

  const data = response.data || {};
  return {
    cleanPath: outputPath,
    filename: `contexto_externo_limpio_${lista.toLowerCase().replace(/[^a-z0-9_]+/g, '_')}.xlsx`,
    summary: {
      inputRows: Number(data.inputRows || 0),
      outputRows: Number(data.outputRows || 0),
      duplicates: Number(data.duplicatesRemoved || 0),
      emptyRows: Number(data.emptyRowsRemoved || 0),
      matchedColumns: Number(data.matchedColumns || 0),
      corrections: Number(data.correctionsCount || 0),
      sourceSheet: data.sourceSheet || 'Archivo cargado'
    },
    correcciones: data.correcciones || []
  };
};

const runPythonCleaner = async ({ inputPath, originalName, mimetype, lista }) => {
  const [fileBlob, activeRules] = await Promise.all([
    openAsBlob(inputPath, { type: mimetype || 'application/octet-stream' }),
    DiccionarioCorreccionTexto.findAll({
      where: { activo: true, ambito: { [Op.in]: ['GENERAL', 'CONTEXTO_EXTERNO'] } },
      attributes: ['ambito', 'columna', 'valor_detectado', 'valor_estandar', 'prioridad'],
      order: [['prioridad', 'ASC'], ['id', 'ASC']],
      raw: true
    })
  ]);
  const form = new FormData();
  form.append('lista', lista);
  form.append('reglas', JSON.stringify(activeRules));
  form.append('archivo', fileBlob, originalName || 'archivo.xlsx');

  const timeoutMs = Number(process.env.CONTEXTO_EXTERNO_PYTHON_TIMEOUT_MS || 1800000);

  let response;
  try {
    response = await axios.post(`${PYTHON_SERVICE_URL}/contexto-externo/limpiar`, form, {
      responseType: 'arraybuffer',
      timeout: timeoutMs,
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      httpAgent
    });
  } catch (axiosError) {
    if (axiosError.response) {
      const status = axiosError.response.status;
      let message = 'No fue posible limpiar el archivo.';
      try {
        const rawText = Buffer.from(axiosError.response.data).toString('utf8');
        const parsed = JSON.parse(rawText);
        message = parsed.detail || parsed.message || message;
      } catch (_) {
        message = Buffer.from(axiosError.response.data).toString('utf8') || message;
      }
      const err = new Error(message);
      err.status = status;
      throw err;
    }
    throw axiosError;
  }

  const envelope = Buffer.from(response.data);
  if (envelope.length < 10 || envelope.subarray(0, 6).toString('ascii') !== 'CXCLN1') {
    throw new Error('Respuesta inválida del servicio de limpieza.');
  }
  const metadataLength = envelope.readUInt32BE(6);
  const metadataEnd = 10 + metadataLength;
  if (metadataEnd > envelope.length) throw new Error('Metadatos incompletos del servicio de limpieza.');
  const metadata = JSON.parse(envelope.subarray(10, metadataEnd).toString('utf8'));

  const headers = response.headers || {};
  const disposition = String(headers['content-disposition'] || '');
  const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
    || `contexto_externo_revision_${Date.now()}.xlsx`;
  const headerNumber = (name) => Number(headers[name] || 0);

  return {
    cleanFile: envelope.subarray(metadataEnd),
    corrections: metadata?.correcciones || [],
    filename,
    summary: {
      inputRows: headerNumber('x-input-rows'),
      outputRows: headerNumber('x-output-rows'),
      duplicates: headerNumber('x-duplicates-removed'),
      emptyRows: headerNumber('x-empty-rows-removed'),
      matchedColumns: headerNumber('x-matched-columns'),
      corrections: headerNumber('x-corrections-count'),
      sourceSheet: headers['x-source-sheet'] || 'Archivo cargado'
    }
  };
};

const updateJob = async (jobId, changes) => {
  const current = await readJob(jobId);
  if (!current) return null;
  const updated = { ...current, ...changes, updatedAt: new Date().toISOString() };
  await writeJob(updated);
  return updated;
};

const cleanupExpiredJobs = async () => {
  await fs.mkdir(JOB_ROOT, { recursive: true });
  const jobIds = await listStoredJobIds();
  const now = Date.now();
  await Promise.all(jobIds.map(async (jobId) => {
    const job = await readJob(jobId);
    if (!job) return;
    if (['queued', 'processing'].includes(job.status)) return;
    if ((Date.parse(job.expiresAt || '') || 0) > now) return;
    const jobPaths = getJobPaths(jobId);
    const reviewPaths = job.reviewId ? getReviewPaths(job.reviewId) : null;
    await Promise.all([
      fs.unlink(jobPaths.metadata).catch(() => {}),
      fs.unlink(jobPaths.legacyMetadata).catch(() => {}),
      job.inputPath ? fs.unlink(job.inputPath).catch(() => {}) : Promise.resolve(),
      reviewPaths ? fs.unlink(reviewPaths.metadata).catch(() => {}) : Promise.resolve(),
      reviewPaths ? fs.unlink(reviewPaths.legacyMetadata).catch(() => {}) : Promise.resolve(),
      reviewPaths ? fs.unlink(reviewPaths.workbook).catch(() => {}) : Promise.resolve()
    ]);
  }));
};

const processCleaningJob = async (jobId) => {
  let job = await updateJob(jobId, {
    status: 'processing',
    progress: 20,
    stage: 'Preparando reglas y enviando el archivo al servicio de limpieza',
    startedAt: new Date().toISOString(),
    errorMessage: null
  });
  if (!job) return;
  try {
    job = await updateJob(jobId, { progress: 35, stage: 'Corrigiendo escritura y normalizando los valores' });
    const reviewId = crypto.randomUUID();
    const reviewPaths = getReviewPaths(reviewId);
    let result;
    if (job.inputPath && (await fs.stat(job.inputPath).catch(() => null))) {
      result = await runPythonCleanerPath({
        inputPath: job.inputPath,
        outputPath: reviewPaths.workbook,
        lista: job.lista
      });
    } else {
      result = await runPythonCleaner({
        inputPath: job.inputPath,
        originalName: job.originalName,
        mimetype: job.mimetype,
        lista: job.lista
      });
    }
    await updateJob(jobId, { progress: 90, stage: 'Guardando el archivo limpio y el reporte' });
    const review = await saveReview({
      cleanFile: result.cleanFile || null,
      cleanPath: result.cleanPath || null,
      corrections: result.corrections || result.correcciones || [],
      filename: result.filename,
      lista: job.lista,
      userId: job.userId,
      reviewId
    });
    await updateJob(jobId, {
      status: 'completed',
      progress: 100,
      stage: 'Archivo listo para descargar',
      completedAt: new Date().toISOString(),
      filename: result.filename,
      reviewId: review.reviewId,
      reviewStatus: review.status,
      summary: result.summary,
      expiresAt: new Date(Date.now() + JOB_RETENTION_MS).toISOString()
    });
    await fs.unlink(job.inputPath).catch(() => {});
  } catch (error) {
    console.error(`Error en trabajo de limpieza ${jobId}:`, error);
    const unavailable = error?.name === 'TimeoutError' || error?.cause?.code === 'ECONNREFUSED' || error?.cause?.code === 'ECONNRESET' || String(error?.message || '').includes('ECONNRESET') || String(error?.message || '').includes('timeout');
    await updateJob(jobId, {
      status: unavailable ? 'interrupted' : 'failed',
      progress: 100,
      stage: unavailable ? 'Servicio de limpieza interrumpido' : 'El procesamiento terminÃ³ con error',
      failedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + JOB_RETENTION_MS).toISOString(),
      errorMessage: unavailable
        ? 'El servicio de limpieza no respondiÃ³ o agotÃ³ el tiempo disponible.'
        : String(error?.message || 'No fue posible procesar el archivo.').slice(0, 1000)
    });
  }
};

const drainCleaningQueue = async () => {
  if (cleaningWorkerRunning) return;
  cleaningWorkerRunning = true;
  try {
    while (cleaningQueue.length > 0) {
      const jobId = cleaningQueue.shift();
      const job = await readJob(jobId);
      if (!job || job.status !== 'queued') continue;
      await processCleaningJob(jobId);
    }
  } finally {
    cleaningWorkerRunning = false;
  }
};

const enqueueCleaningJob = (jobId) => {
  if (!cleaningQueue.includes(jobId)) cleaningQueue.push(jobId);
  setImmediate(() => { drainCleaningQueue().catch((error) => console.error('Error en cola de limpieza:', error)); });
};

const serializeJob = async (job) => {
  let reviewStatus = job.reviewStatus || null;
  if (job.reviewId) {
    const review = await readReview(job.reviewId);
    if (review?.metadata?.status) reviewStatus = review.metadata.status;
  }
  return {
    jobId: job.jobId,
    originalName: job.originalName,
    filename: job.filename || null,
    lista: job.lista,
    status: job.status,
    progress: Number(job.progress || 0),
    stage: job.stage || '',
    errorMessage: job.errorMessage || null,
    summary: job.summary || null,
    reviewId: job.reviewId || null,
    reviewStatus,
    createdAt: job.createdAt,
    startedAt: job.startedAt || null,
    completedAt: job.completedAt || null,
    expiresAt: job.expiresAt
  };
};

const createContextoExternoCleaningJob = async (req, res) => {
  const uploadedPath = req.file?.path;
  let jobInputPath = null;
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'Debes adjuntar un archivo Excel o CSV.' });
    const lista = String(req.body?.lista || '').trim();
    if (!lista) {
      await fs.unlink(uploadedPath).catch(() => {});
      return res.status(400).json({ success: false, message: 'Debes seleccionar una lista de Contexto Externo.' });
    }
    await cleanupExpiredJobs();
    await fs.mkdir(JOB_ROOT, { recursive: true });
    const jobId = crypto.randomUUID();
    const extension = path.extname(req.file.originalname || '').toLowerCase();
    const paths = getJobPaths(jobId, extension);
    await fs.rename(uploadedPath, paths.input);
    jobInputPath = paths.input;
    const createdAt = new Date();
    const job = {
      jobId,
      userId: req.user?.id || null,
      lista,
      originalName: req.file.originalname,
      mimetype: req.file.mimetype,
      inputPath: paths.input,
      status: 'queued',
      progress: 5,
      stage: 'En cola para iniciar la limpieza',
      createdAt: createdAt.toISOString(),
      updatedAt: createdAt.toISOString(),
      expiresAt: new Date(createdAt.getTime() + JOB_RETENTION_MS).toISOString()
    };
    await writeJob(job);
    enqueueCleaningJob(jobId);
    return res.status(202).json({ success: true, message: 'Archivo recibido. La limpieza continuarÃ¡ en segundo plano.', data: await serializeJob(job) });
  } catch (error) {
    console.error('Error creando trabajo de limpieza:', error);
    await Promise.all([
      uploadedPath ? fs.unlink(uploadedPath).catch(() => {}) : Promise.resolve(),
      jobInputPath ? fs.unlink(jobInputPath).catch(() => {}) : Promise.resolve()
    ]);
    return res.status(500).json({ success: false, message: 'No fue posible crear el trabajo de limpieza.' });
  }
};

const listContextoExternoCleaningJobs = async (req, res) => {
  try {
    await cleanupExpiredJobs();
    await fs.mkdir(JOB_ROOT, { recursive: true });
    const jobs = [];
    for (const jobId of await listStoredJobIds()) {
      const job = await readJob(jobId);
      if (job && canAccessJob(job, req.user)) jobs.push(job);
    }
    jobs.sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')));
    return res.json({ success: true, data: { jobs: await Promise.all(jobs.map(serializeJob)), retentionHours: Math.round(JOB_RETENTION_MS / 3600000) } });
  } catch (error) {
    console.error('Error listando trabajos de limpieza:', error);
    return res.status(500).json({ success: false, message: 'No fue posible consultar los trabajos de limpieza.' });
  }
};

const downloadContextoExternoCleaningJob = async (req, res) => {
  const job = await readJob(req.params?.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'El trabajo no existe o ya venciÃ³.' });
  if (!canAccessJob(job, req.user)) return res.status(403).json({ success: false, message: 'No tienes acceso a este trabajo.' });
  if (job.status !== 'completed' || !job.reviewId) return res.status(409).json({ success: false, message: 'El archivo todavÃ­a no estÃ¡ disponible.' });
  const review = await readReview(job.reviewId);
  if (!review) return res.status(404).json({ success: false, message: 'El archivo limpio ya no estÃ¡ disponible.' });
  return res.download(review.paths.workbook, job.filename || review.metadata.filename || 'contexto_externo_limpio.xlsx');
};

const retryContextoExternoCleaningJob = async (req, res) => {
  const job = await readJob(req.params?.jobId);
  if (!job) return res.status(404).json({ success: false, message: 'El trabajo no existe o ya venciÃ³.' });
  if (!canAccessJob(job, req.user)) return res.status(403).json({ success: false, message: 'No tienes acceso a este trabajo.' });
  if (!['failed', 'interrupted'].includes(job.status)) return res.status(409).json({ success: false, message: 'Este trabajo no se puede reintentar en su estado actual.' });
  try {
    await fs.access(job.inputPath);
  } catch (_) {
    return res.status(410).json({ success: false, message: 'El archivo original ya no estÃ¡ disponible; debes cargarlo nuevamente.' });
  }
  const updated = await updateJob(job.jobId, { status: 'queued', progress: 5, stage: 'En cola para reintentar la limpieza', errorMessage: null, failedAt: null });
  enqueueCleaningJob(job.jobId);
  return res.status(202).json({ success: true, message: 'El trabajo fue enviado nuevamente a la cola.', data: await serializeJob(updated) });
};

const recoverCleaningJobs = async () => {
  await cleanupExpiredJobs();
  for (const jobId of await listStoredJobIds()) {
    const job = await readJob(jobId);
    if (!job) continue;
    const jobStartedAt = Date.parse(job.startedAt || job.updatedAt || job.createdAt || '') || 0;
    if (job.status === 'processing' && jobStartedAt < SERVICE_STARTED_AT) {
      await updateJob(job.jobId, {
        status: 'interrupted',
        progress: 100,
        stage: 'Proceso interrumpido por reinicio del servicio',
        errorMessage: 'El servidor se reiniciÃ³ durante la limpieza. Puedes reintentar el trabajo mientras el archivo original siga disponible.',
        expiresAt: new Date(Date.now() + JOB_RETENTION_MS).toISOString()
      });
    } else if (job.status === 'queued') {
      enqueueCleaningJob(job.jobId);
    }
  }
};

setTimeout(() => { recoverCleaningJobs().catch((error) => console.error('Error recuperando trabajos de limpieza:', error)); }, 3000).unref?.();
setInterval(() => { cleanupExpiredJobs().catch((error) => console.error('Error depurando trabajos de limpieza:', error)); }, 15 * 60 * 1000).unref?.();

const cleanContextoExternoFile = async (req, res) => {
  const uploadedPath = req.file?.path;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Debes adjuntar un archivo Excel o CSV.' });
    }

    const lista = String(req.body?.lista || '').trim();
    if (!lista) {
      return res.status(400).json({ success: false, message: 'Debes seleccionar una lista de Contexto Externo.' });
    }

    const [fileBlob, activeRules] = await Promise.all([
      openAsBlob(uploadedPath, { type: req.file.mimetype || 'application/octet-stream' }),
      DiccionarioCorreccionTexto.findAll({
        where: { activo: true, ambito: { [Op.in]: ['GENERAL', 'CONTEXTO_EXTERNO'] } },
        attributes: ['ambito', 'columna', 'valor_detectado', 'valor_estandar', 'prioridad'],
        order: [['prioridad', 'ASC'], ['id', 'ASC']],
        raw: true
      })
    ]);
    const form = new FormData();
    form.append('lista', lista);
    form.append('reglas', JSON.stringify(activeRules));
    form.append('archivo', fileBlob, req.file.originalname);

    const pythonResponse = await fetch(`${PYTHON_SERVICE_URL}/contexto-externo/limpiar`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(Number(process.env.CONTEXTO_EXTERNO_PYTHON_TIMEOUT_MS || 1800000))
    });

    if (!pythonResponse.ok) {
      const contentType = String(pythonResponse.headers.get('content-type') || '');
      let message = 'No fue posible limpiar el archivo.';
      if (contentType.includes('application/json')) {
        const payload = await pythonResponse.json().catch(() => ({}));
        message = payload?.detail || payload?.message || message;
      } else {
        message = (await pythonResponse.text().catch(() => '')) || message;
      }
      return res.status(pythonResponse.status >= 400 && pythonResponse.status < 500 ? pythonResponse.status : 502).json({
        success: false,
        message
      });
    }

    FORWARDED_HEADERS.forEach((header) => {
      const value = pythonResponse.headers.get(header);
      if (value) res.setHeader(header, value);
    });
    res.setHeader('Access-Control-Expose-Headers', FORWARDED_HEADERS.join(', '));
    const envelope = Buffer.from(await pythonResponse.arrayBuffer());
    if (envelope.length < 10 || envelope.subarray(0, 6).toString('ascii') !== 'CXCLN1') {
      throw new Error('Respuesta inválida del servicio de limpieza.');
    }
    const metadataLength = envelope.readUInt32BE(6);
    const metadataEnd = 10 + metadataLength;
    if (metadataEnd > envelope.length) throw new Error('Metadatos incompletos del servicio de limpieza.');
    const metadata = JSON.parse(envelope.subarray(10, metadataEnd).toString('utf8'));
    const cleanFile = envelope.subarray(metadataEnd);
    const disposition = String(pythonResponse.headers.get('content-disposition') || '');
    const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
      || `contexto_externo_revision_${Date.now()}.xlsx`;
    const review = await saveReview({
      cleanFile,
      corrections: metadata?.correcciones,
      filename,
      lista,
      userId: req.user?.id || null
    });
    res.setHeader('X-Saved-Rules', '0');
    res.setHeader('X-Review-Id', review.reviewId);
    res.setHeader('X-Review-Status', review.status);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.status(200).send(cleanFile);
  } catch (error) {
    console.error('Error limpiando Contexto Externo:', error);
    const unavailable = error?.name === 'TimeoutError' || error?.cause?.code === 'ECONNREFUSED';
    return res.status(503).json({
      success: false,
      message: unavailable
        ? 'El servicio de limpieza de datos no está disponible en este momento.'
        : 'Ocurrió un error al procesar el archivo de Contexto Externo.'
    });
  } finally {
    if (uploadedPath) {
      await fs.unlink(uploadedPath).catch(() => {});
    }
  }
};

const approveContextoExternoReview = async (req, res) => {
  try {
    const review = await readReview(req.params?.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'La revisión no existe o ya venció.' });
    if (!canAccessReview(review.metadata, req.user)) return res.status(403).json({ success: false, message: 'No tienes acceso a esta revisión.' });

    if (review.metadata.status === 'approved') {
      return res.json({ success: true, message: 'Las correcciones ya estaban aprobadas.', data: review.metadata });
    }
    if (review.metadata.status === 'rejected') {
      return res.status(409).json({ success: false, message: 'La revisión fue marcada como no aprobada.' });
    }

    const savedRules = await persistCorrections(review.metadata.corrections, req.user?.id || null);
    const updated = {
      ...review.metadata,
      status: 'approved',
      savedRules,
      approvedAt: new Date().toISOString(),
      approvedBy: req.user?.id || null
    };
    await fs.writeFile(review.paths.metadata, JSON.stringify(updated), 'utf8');
    return res.json({
      success: true,
      message: `Revisión aprobada. Se guardaron ${savedRules} reglas nuevas en el diccionario.`,
      data: updated
    });
  } catch (error) {
    console.error('Error aprobando revisión de Contexto Externo:', error);
    return res.status(500).json({ success: false, message: 'No fue posible aprobar las correcciones.' });
  }
};

const rejectContextoExternoReview = async (req, res) => {
  try {
    const review = await readReview(req.params?.reviewId);
    if (!review) return res.status(404).json({ success: false, message: 'La revisión no existe o ya venció.' });
    if (!canAccessReview(review.metadata, req.user)) return res.status(403).json({ success: false, message: 'No tienes acceso a esta revisión.' });

    const updated = {
      ...review.metadata,
      status: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectedBy: req.user?.id || null
    };
    await fs.writeFile(review.paths.metadata, JSON.stringify(updated), 'utf8');
    return res.json({ success: true, message: 'Revisión no aprobada. El diccionario no fue modificado.', data: updated });
  } catch (error) {
    console.error('Error rechazando revisión de Contexto Externo:', error);
    return res.status(500).json({ success: false, message: 'No fue posible marcar la revisión como no aprobada.' });
  }
};

const deleteContextoExternoCleaningJob = async (req, res) => {
  try {
    const { jobId } = req.params;
    const job = await readJob(jobId);
    if (!job) return res.status(404).json({ success: false, message: 'El trabajo no existe.' });
    if (!canAccessJob(job, req.user)) return res.status(403).json({ success: false, message: 'No tienes acceso a este trabajo.' });

    const jobPaths = getJobPaths(jobId, path.extname(job.inputPath || ''));
    const reviewPaths = job.reviewId ? getReviewPaths(job.reviewId) : null;

    await Promise.all([
      jobPaths ? fs.unlink(jobPaths.metadata).catch(() => {}) : Promise.resolve(),
      jobPaths ? fs.unlink(jobPaths.legacyMetadata).catch(() => {}) : Promise.resolve(),
      job.inputPath ? fs.unlink(job.inputPath).catch(() => {}) : Promise.resolve(),
      reviewPaths ? fs.unlink(reviewPaths.metadata).catch(() => {}) : Promise.resolve(),
      reviewPaths ? fs.unlink(reviewPaths.legacyMetadata).catch(() => {}) : Promise.resolve(),
      reviewPaths ? fs.unlink(reviewPaths.workbook).catch(() => {}) : Promise.resolve()
    ]);

    return res.json({ success: true, message: 'Registro de limpieza eliminado correctamente.' });
  } catch (error) {
    console.error('Error eliminando trabajo de limpieza:', error);
    return res.status(500).json({ success: false, message: 'No fue posible eliminar el registro.' });
  }
};

module.exports = {
  cleanContextoExternoFile,
  createContextoExternoCleaningJob,
  listContextoExternoCleaningJobs,
  downloadContextoExternoCleaningJob,
  retryContextoExternoCleaningJob,
  deleteContextoExternoCleaningJob,
  approveContextoExternoReview,
  rejectContextoExternoReview,
  processCleaningJob,
  recoverCleaningJobs
};
