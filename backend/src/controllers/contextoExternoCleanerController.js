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
const REVIEW_ID_PATTERN = /^[0-9a-f-]{36}$/i;

const getReviewPaths = (reviewId) => {
  if (!REVIEW_ID_PATTERN.test(String(reviewId || ''))) return null;
  return {
    metadata: path.join(REVIEW_ROOT, `${reviewId}.json`),
    workbook: path.join(REVIEW_ROOT, `${reviewId}.xlsx`)
  };
};

const readReview = async (reviewId) => {
  const paths = getReviewPaths(reviewId);
  if (!paths) return null;
  try {
    const metadata = JSON.parse(await fs.readFile(paths.metadata, 'utf8'));
    return { metadata, paths };
  } catch (_) {
    return null;
  }
};

const canAccessReview = (review, user) => (
  !review?.userId || String(review.userId) === String(user?.id || '')
);

const saveReview = async ({ cleanFile, corrections, filename, lista, userId }) => {
  await fs.mkdir(REVIEW_ROOT, { recursive: true });
  const reviewId = crypto.randomUUID();
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
  await Promise.all([
    fs.writeFile(paths.workbook, cleanFile),
    fs.writeFile(paths.metadata, JSON.stringify(metadata), 'utf8')
  ]);
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
  const batchSize = Math.max(50, Math.min(500, Number(process.env.CONTEXTO_EXTERNO_RULE_BATCH_SIZE || 300)));
  let inserted = 0;
  for (let offset = 0; offset < additions.length; offset += batchSize) {
    const batch = additions.slice(offset, offset + batchSize);
    await DiccionarioCorreccionTexto.bulkCreate(batch, { validate: true });
    inserted += batch.length;
  }
  return inserted;
};

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

module.exports = {
  cleanContextoExternoFile,
  approveContextoExternoReview,
  rejectContextoExternoReview
};
