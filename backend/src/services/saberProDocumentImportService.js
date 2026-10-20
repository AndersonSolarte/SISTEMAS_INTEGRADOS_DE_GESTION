const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const SaberProDocumentImport = require('../models/SaberProDocumentImport');
const SaberProDocumentImportItem = require('../models/SaberProDocumentImportItem');
const { sequelize } = require('../config/database');
const { extractPdfBuffer } = require('./saberProTextExtractionService');
const {
  parseEvaluatedData, validateRegistrationDate, toIsoDate, toDisplayDate
} = require('./saberProDocumentParser');
const {
  queryDocumentsByIdentifications,
  fetchPdfBuffer,
  normalizeRemotePath
} = require('./saberProInstitutionalPdfService');

SaberProDocumentImport.hasMany(SaberProDocumentImportItem, {
  foreignKey: 'import_id',
  as: 'items',
  onDelete: 'CASCADE'
});
SaberProDocumentImportItem.belongsTo(SaberProDocumentImport, {
  foreignKey: 'import_id',
  as: 'import'
});

let activeImportId = null;
let schemaEnsured = false;

const STATUS_EXPORT_LABELS = {
  PENDING: 'Pendiente',
  EXTRACTED: 'Extraído',
  CORRECTED: 'Corregido manualmente',
  INCOMPLETE: 'Revisar',
  ERROR: 'Error',
  NOT_FOUND: 'No encontrado',
  NO_PDF: 'Sin PDF',
  INVALID: 'Inválido'
};

async function ensureImportSchema() {
  if (schemaEnsured) return;
  await SaberProDocumentImport.sync();
  await SaberProDocumentImportItem.sync();
  await sequelize.query(`
    ALTER TABLE saber_pro_document_import_items
      ADD COLUMN IF NOT EXISTS pdf_identification VARCHAR(30),
      ADD COLUMN IF NOT EXISTS db_identification VARCHAR(30),
      ADD COLUMN IF NOT EXISTS db_registration_number VARCHAR(40),
      ADD COLUMN IF NOT EXISTS db_exam_date DATE;
  `);
  schemaEnsured = true;
}

function apiError(message, status = 500, code = 'SABER_PRO_DOCUMENT_IMPORT_ERROR') {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  return error;
}

function normalizeHeader(value) {
  return String(value || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function isIdentificationHeader(value) {
  const header = normalizeHeader(value);
  return header.includes('cedula') || header === 'identificacion'
    || header.includes('numero identificacion') || header.includes('numero de identificacion')
    || header === 'documento' || header === 'numero documento' || header === 'numero de documento';
}

function normalizeIdentification(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  if (/^\d+(?:[.,]0+)?$/.test(text)) return text.replace(/[.,]0+$/, '');
  if (/^\d+(?:[.,]\d+)?e\+?\d+$/i.test(text)) {
    const numeric = Number(text.replace(',', '.'));
    if (Number.isSafeInteger(numeric)) return numeric.toFixed(0);
  }
  const digits = text.replace(/\D/g, '');
  return /^\d{5,20}$/.test(digits) ? digits : null;
}

function parseWorkbook(buffer) {
  let workbook;
  try {
    workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  } catch (_error) {
    throw apiError('El archivo Excel o CSV no es válido.', 400, 'INVALID_IMPORT_FILE');
  }
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) throw apiError('El archivo no contiene hojas.', 400, 'EMPTY_IMPORT_FILE');
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
  let headerRow = -1;
  let identificationColumn = -1;
  for (let rowIndex = 0; rowIndex < Math.min(rows.length, 10); rowIndex += 1) {
    const columnIndex = rows[rowIndex].findIndex(isIdentificationHeader);
    if (columnIndex >= 0) {
      headerRow = rowIndex;
      identificationColumn = columnIndex;
      break;
    }
  }
  if (identificationColumn < 0) {
    throw apiError('Debe existir una columna Cédula, Identificación o Documento.', 400, 'MISSING_IDENTIFICATION_COLUMN');
  }
  const items = [];
  for (let index = headerRow + 1; index < rows.length; index += 1) {
    const rawValue = String(rows[index][identificationColumn] ?? '').trim();
    if (!rawValue) continue;
    const identification = normalizeIdentification(rawValue);
    items.push({
      row_number: index + 1,
      identification: identification || rawValue.slice(0, 30),
      status: identification ? 'PENDING' : 'INVALID',
      message: identification ? null : 'La identificación no tiene un formato válido.'
    });
  }
  if (!items.length) throw apiError('El archivo no contiene identificaciones.', 400, 'EMPTY_IMPORT_FILE');
  const maxRows = Number(process.env.IMPORT_MAX_ROWS || 5000);
  if (items.length > maxRows) throw apiError(`El archivo supera el límite de ${maxRows} filas.`, 400, 'IMPORT_TOO_LARGE');
  return items;
}

function rowsByIdentification(rows) {
  const result = new Map();
  for (const row of rows) {
    const values = result.get(String(row.identification)) || [];
    values.push(row);
    result.set(String(row.identification), values);
  }
  return result;
}

function selectPdf(rows) {
  return rows.find((row) => {
    try {
      normalizeRemotePath(row.document_path);
      return true;
    } catch (_error) {
      return false;
    }
  });
}

function institutionalReference(document) {
  const dbIdentification = String(document?.identification || '').replace(/\D/g, '') || null;
  const registrationNumber = String(document?.registration_number || '').replace(/\s/g, '').toUpperCase() || null;
  const examDate = toIsoDate(document?.expected_exam_date);
  const label = `Referencia BD: doc ${dbIdentification || 'sin dato'} · EK ${registrationNumber || 'sin dato'} · fecha ${toDisplayDate(examDate) || 'sin dato'}`;
  return { dbIdentification, registrationNumber, examDate, label };
}

async function refreshCounters(importId) {
  const items = await SaberProDocumentImportItem.findAll({ where: { import_id: importId }, attributes: ['status'], raw: true });
  const count = (statuses) => items.filter((item) => statuses.includes(item.status)).length;
  const values = {
    processed_items: count(['EXTRACTED', 'CORRECTED', 'NOT_FOUND', 'NO_PDF', 'INCOMPLETE', 'ERROR', 'INVALID']),
    extracted_items: count(['EXTRACTED']),
    corrected_items: count(['CORRECTED']),
    not_found_items: count(['NOT_FOUND']),
    no_pdf_items: count(['NO_PDF']),
    error_items: count(['INCOMPLETE', 'ERROR', 'INVALID'])
  };
  await SaberProDocumentImport.update(values, { where: { id: importId } });
  return values;
}

async function extractItem(item, institutionalRows) {
  if (!institutionalRows?.length) {
    return {
      status: 'NOT_FOUND',
      db_identification: null,
      db_registration_number: null,
      db_exam_date: null,
      message: 'La cédula no existe en la base de datos institucional (personas).'
    };
  }
  const document = selectPdf(institutionalRows);
  const firstRow = document || institutionalRows[0];
  const reference = institutionalReference(firstRow);
  if (!document) {
    return {
      status: 'NO_PDF',
      db_identification: reference.dbIdentification,
      db_registration_number: reference.registrationNumber,
      db_exam_date: reference.examDate,
      message: `La persona existe en BD, pero no tiene una ruta PDF válida (url_ek). ${reference.label}.`
    };
  }
  const documentPath = normalizeRemotePath(document.document_path);
  const hints = {
    identification: reference.dbIdentification || item.identification,
    registrationNumber: reference.registrationNumber,
    examDate: reference.examDate
  };
  try {
    const buffer = await fetchPdfBuffer(documentPath);
    const extraction = await extractPdfBuffer(buffer, hints);
    const parsed = parseEvaluatedData(extraction.text, hints);
    if (!parsed.complete) {
      const detail = `${(parsed.missingFields || []).join('. ')}. ${reference.label}. Lectura ${extraction.method}.`;
      return {
        status: 'INCOMPLETE',
        pdf_identification: parsed.identification,
        db_identification: reference.dbIdentification,
        registration_number: parsed.registrationNumber,
        db_registration_number: reference.registrationNumber,
        exam_date: parsed.examDate,
        db_exam_date: reference.examDate,
        document_path: documentPath,
        message: detail.slice(0, 700)
      };
    }
    return {
      status: 'EXTRACTED',
      pdf_identification: parsed.identification,
      db_identification: reference.dbIdentification,
      registration_number: parsed.registrationNumber,
      db_registration_number: reference.registrationNumber,
      exam_date: parsed.examDate,
      db_exam_date: reference.examDate,
      document_path: documentPath,
      message: `Coincide numero_identificacion, codigo_ek y fecha_presentacion_ek. ${reference.label}. Lectura ${extraction.method}.`.slice(0, 700)
    };
  } catch (error) {
    return {
      status: 'ERROR',
      pdf_identification: null,
      db_identification: reference.dbIdentification,
      registration_number: null,
      db_registration_number: reference.registrationNumber,
      exam_date: null,
      db_exam_date: reference.examDate,
      document_path: documentPath,
      message: String(error.message || 'No fue posible procesar el PDF.').slice(0, 700)
    };
  }
}

async function processImport(importId) {
  await ensureImportSchema();
  activeImportId = String(importId);
  const importRecord = await SaberProDocumentImport.findByPk(importId);
  if (!importRecord) return;
  try {
    const pending = await SaberProDocumentImportItem.findAll({
      where: { import_id: importId, status: 'PENDING' },
      order: [['row_number', 'ASC']]
    });
    const identifications = [...new Set(pending.map((item) => item.identification))];
    const institutionalRows = await queryDocumentsByIdentifications(identifications);
    const institutionalMap = rowsByIdentification(institutionalRows);
    const concurrency = Math.max(1, Math.min(4, Number(process.env.IMPORT_PROCESS_CONCURRENCY || 2)));
    for (let index = 0; index < pending.length; index += concurrency) {
      const batch = pending.slice(index, index + concurrency);
      const outcomes = await Promise.all(batch.map((item) =>
        extractItem(item, institutionalMap.get(item.identification))));
      await Promise.all(batch.map((item, batchIndex) => item.update(outcomes[batchIndex])));
      await refreshCounters(importId);
    }
    await refreshCounters(importId);
    await importRecord.update({ status: 'COMPLETED', finished_at: new Date() });
  } catch (error) {
    await importRecord.update({ status: 'FAILED', finished_at: new Date() }).catch(() => {});
    console.error('[saberProDocumentImport]', error?.message || error);
  } finally {
    activeImportId = null;
  }
}

function startImport(importId) {
  activeImportId = String(importId);
  setImmediate(() => processImport(importId).catch((error) => {
    activeImportId = null;
    console.error('[saberProDocumentImport]', error?.message || error);
  }));
}

async function syncProcessedItemsWithInstitutionalDb(importId, items) {
  const needsSync = (items || []).filter((item) => {
    if (!['EXTRACTED', 'INCOMPLETE', 'CORRECTED', 'NO_PDF', 'ERROR'].includes(item.status)) return false;
    if (!item.db_identification) return true;
    if (item.status === 'EXTRACTED') {
      const missingOrMismatch = !item.db_identification || !item.pdf_identification
        || !item.db_registration_number || !item.registration_number
        || !item.db_exam_date || !item.exam_date
        || item.db_identification !== item.pdf_identification
        || item.db_registration_number !== item.registration_number
        || item.db_exam_date !== item.exam_date;
      if (missingOrMismatch) return true;
    }
    return false;
  });
  if (!needsSync.length) return false;
  try {
    const identifications = [...new Set(needsSync.map((item) => item.identification))];
    const institutionalRows = await queryDocumentsByIdentifications(identifications);
    const institutionalMap = rowsByIdentification(institutionalRows);
    let changed = false;

    for (const item of needsSync) {
      const rows = institutionalMap.get(item.identification) || [];
      if (!rows.length) continue;
      const doc = selectPdf(rows) || rows[0];
      const ref = institutionalReference(doc);
      const pdfId = item.pdf_identification
        || (['EXTRACTED', 'CORRECTED'].includes(item.status) ? item.identification : null)
        || (!String(item.message || '').includes('Cédula') && !String(item.message || '').includes('documento') && item.registration_number ? item.identification : null);

      const idMatch = Boolean(pdfId && ref.dbIdentification && pdfId === ref.dbIdentification);
      const ekMatch = Boolean(item.registration_number && ref.registrationNumber && item.registration_number === ref.registrationNumber);
      const dateVal = validateRegistrationDate(item.registration_number, item.exam_date);
      const dateMatch = Boolean(item.exam_date && ref.examDate && item.exam_date === ref.examDate && dateVal.valid);

      const updates = {
        db_identification: ref.dbIdentification,
        db_registration_number: ref.registrationNumber,
        db_exam_date: ref.examDate,
        pdf_identification: pdfId
      };

      if (item.status === 'EXTRACTED' && (!idMatch || !ekMatch || !dateMatch)) {
        const reasons = [];
        if (!idMatch) {
          reasons.push(`El documento leído en el PDF (${pdfId || 'sin dato'}) no coincide con numero_identificacion en BD (${ref.dbIdentification || 'sin dato'})`);
        }
        if (!ekMatch) {
          reasons.push(`El EK leído en el PDF (${item.registration_number || 'sin dato'}) no coincide con codigo_ek en BD (${ref.registrationNumber || 'sin dato'})`);
        }
        if (!dateMatch) {
          reasons.push(`La fecha leída en el PDF (${toDisplayDate(item.exam_date) || 'sin dato'}) no coincide con fecha_presentacion_ek en BD (${toDisplayDate(ref.examDate) || 'sin dato'})`);
        }
        updates.status = 'INCOMPLETE';
        updates.message = `${reasons.join('. ')}. ${ref.label}.`.slice(0, 700);
      }

      await item.update(updates);
      changed = true;
    }

    if (changed) {
      await refreshCounters(importId);
    }
    return changed;
  } catch (error) {
    console.error('[saberProDocumentImport:sync]', error?.message || error);
    return false;
  }
}

function mapItem(item) {
  const row = item.toJSON ? item.toJSON() : item;
  const dbIdentification = row.db_identification || row.identification || null;
  const pdfIdentification = row.pdf_identification || null;
  const dbRegistrationNumber = row.db_registration_number || null;
  const registrationNumber = row.registration_number || null;
  const dbExamDate = row.db_exam_date || null;
  const examDate = row.exam_date || null;

  const identificationMatch = Boolean(dbIdentification && pdfIdentification && dbIdentification === pdfIdentification);
  const registrationMatch = Boolean(dbRegistrationNumber && registrationNumber && dbRegistrationNumber === registrationNumber);
  const examDateMatch = Boolean(dbExamDate && examDate && dbExamDate === examDate);
  const hasMissingOrMismatch = !identificationMatch || !registrationMatch || !examDateMatch;
  const effectiveStatus = row.status === 'EXTRACTED' && hasMissingOrMismatch ? 'INCOMPLETE' : row.status;

  return {
    id: String(row.id),
    rowNumber: row.row_number,
    identification: row.identification,
    dbIdentification,
    pdfIdentification,
    identificationMatch,
    status: effectiveStatus,
    dbRegistrationNumber,
    registrationNumber,
    registrationMatch,
    dbExamDate,
    examDate,
    examDateMatch,
    hasDocument: Boolean(row.document_path),
    message: row.message,
    correctedBy: row.corrected_by,
    correctedAt: row.corrected_at
  };
}

async function getImport(importId) {
  await ensureImportSchema();
  let record = await SaberProDocumentImport.findByPk(importId, {
    include: [{ model: SaberProDocumentImportItem, as: 'items' }],
    order: [[{ model: SaberProDocumentImportItem, as: 'items' }, 'row_number', 'ASC']]
  });
  if (!record) return null;
  const synced = await syncProcessedItemsWithInstitutionalDb(record.id, record.items || []);
  if (synced) {
    record = await SaberProDocumentImport.findByPk(importId, {
      include: [{ model: SaberProDocumentImportItem, as: 'items' }],
      order: [[{ model: SaberProDocumentImportItem, as: 'items' }, 'row_number', 'ASC']]
    });
  }
  const row = record.toJSON();
  return {
    id: String(row.id),
    status: row.status,
    originalFileName: row.original_file_name,
    totalItems: row.total_items,
    processedItems: row.processed_items,
    extractedItems: row.extracted_items,
    correctedItems: row.corrected_items,
    notFoundItems: row.not_found_items,
    noPdfItems: row.no_pdf_items,
    errorItems: row.error_items,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
    items: (record.items || []).map(mapItem)
  };
}

async function getLatestImport() {
  await ensureImportSchema();
  const latest = await SaberProDocumentImport.findOne({ order: [['created_at', 'DESC']] });
  return latest ? getImport(latest.id) : null;
}

async function createImport(file, userId) {
  await ensureImportSchema();
  if (!file) throw apiError('Seleccione un archivo Excel o CSV.', 400, 'FILE_REQUIRED');
  if (activeImportId || await SaberProDocumentImport.count({ where: { status: 'PROCESSING' } })) {
    throw apiError('Ya existe una consulta documental en procesamiento.', 409, 'IMPORT_IN_PROGRESS');
  }
  const items = parseWorkbook(file.buffer);
  const record = await SaberProDocumentImport.create({
    original_file_name: String(file.originalname || 'consulta.xlsx').slice(0, 255),
    total_items: items.length,
    processed_items: items.filter((item) => item.status === 'INVALID').length,
    error_items: items.filter((item) => item.status === 'INVALID').length,
    created_by: userId
  });
  await SaberProDocumentImportItem.bulkCreate(items.map((item) => ({ ...item, import_id: record.id })));
  startImport(record.id);
  return getImport(record.id);
}

async function retryImport(importId) {
  await ensureImportSchema();
  if (activeImportId) {
    throw apiError('Ya existe una consulta documental en procesamiento.', 409, 'IMPORT_IN_PROGRESS');
  }
  const record = await SaberProDocumentImport.findByPk(importId);
  if (!record) throw apiError('La consulta no existe.', 404, 'IMPORT_NOT_FOUND');
  const retryable = await SaberProDocumentImportItem.count({
    where: { import_id: importId, status: { [Op.in]: ['PENDING', 'INCOMPLETE', 'ERROR'] } }
  });
  if (!retryable) throw apiError('No existen filas pendientes, por revisar o con error.', 409, 'NOTHING_TO_RETRY');
  await SaberProDocumentImportItem.update({
    status: 'PENDING', message: null, exam_date: null, corrected_by: null, corrected_at: null
  }, {
    where: { import_id: importId, status: { [Op.in]: ['INCOMPLETE', 'ERROR'] } }
  });
  await record.update({ status: 'PROCESSING', finished_at: null });
  await refreshCounters(importId);
  startImport(importId);
  return getImport(importId);
}

async function correctItem(itemId, values, userId) {
  await ensureImportSchema();
  const item = await SaberProDocumentImportItem.findByPk(itemId);
  if (!item) throw apiError('La fila no existe.', 404, 'ITEM_NOT_FOUND');
  if (!['INCOMPLETE', 'ERROR', 'CORRECTED', 'EXTRACTED'].includes(item.status)) {
    throw apiError('Solo se pueden revisar filas con PDF asociado.', 409, 'ITEM_NOT_REVIEWABLE');
  }

  const expectedId = normalizeIdentification(item.db_identification || item.identification);
  const rawPdfId = values.pdfIdentification !== undefined ? values.pdfIdentification : (item.pdf_identification || item.identification);
  const pdfIdentification = normalizeIdentification(rawPdfId);
  if (!pdfIdentification) {
    throw apiError('El número de documento del PDF no tiene un formato válido.', 400, 'INVALID_IDENTIFICATION');
  }
  if (expectedId && pdfIdentification !== expectedId) {
    throw apiError(
      `El documento del PDF (${pdfIdentification}) no coincide con numero_identificacion en BD (${expectedId}). No se puede validar un certificado de otra persona.`,
      400,
      'IDENTIFICATION_MISMATCH'
    );
  }

  const registrationNumber = String(values.registrationNumber || '').replace(/\s/g, '').toUpperCase();
  if (!/^EKA?\d{8,}$/.test(registrationNumber)) {
    throw apiError('El número de registro EK no tiene un formato válido.', 400, 'INVALID_REGISTRATION');
  }
  const dateValidation = validateRegistrationDate(registrationNumber, values.examDate);
  const examDate = dateValidation.examDate;
  if (!examDate) throw apiError('Seleccione una fecha válida.', 400, 'INVALID_DATE');
  if (!dateValidation.valid) {
    throw apiError(`La fecha debe pertenecer al año ${dateValidation.expectedYear}, según el número de registro EK.`,
      400, 'DATE_YEAR_MISMATCH');
  }

  const institutionalRows = await queryDocumentsByIdentifications([item.identification]);
  const institutionalDocument = selectPdf(institutionalRows) || institutionalRows[0];
  const reference = institutionalReference(institutionalDocument);

  const notes = [];
  if (!reference.registrationNumber) {
    notes.push(`codigo_ek en BD sin dato (verificado en PDF: ${registrationNumber})`);
  } else if (registrationNumber !== reference.registrationNumber) {
    notes.push(`codigo_ek en BD (${reference.registrationNumber}) difiere del verificado en PDF (${registrationNumber})`);
  }
  if (!reference.examDate) {
    notes.push(`fecha_presentacion_ek en BD sin dato (verificada en PDF: ${toDisplayDate(examDate)})`);
  } else if (examDate !== reference.examDate) {
    notes.push(`fecha_presentacion_ek en BD (${toDisplayDate(reference.examDate)}) difiere de la verificada en PDF (${toDisplayDate(examDate)})`);
  }

  const detailMessage = notes.length
    ? `Verificado manualmente en PDF: ${notes.join('; ')}. ${reference.label}.`
    : `Verificado manualmente: coincide documento, codigo_ek y fecha_presentacion_ek con BD. ${reference.label}.`;

  await item.update({
    pdf_identification: pdfIdentification,
    db_identification: reference.dbIdentification || expectedId,
    registration_number: registrationNumber,
    db_registration_number: reference.registrationNumber,
    exam_date: examDate,
    db_exam_date: reference.examDate,
    status: 'CORRECTED',
    message: detailMessage.slice(0, 700),
    corrected_by: userId,
    corrected_at: new Date()
  });
  await refreshCounters(item.import_id);
  return mapItem(item);
}

async function getItemPdf(itemId) {
  await ensureImportSchema();
  const item = await SaberProDocumentImportItem.findByPk(itemId);
  if (!item) throw apiError('La fila no existe.', 404, 'ITEM_NOT_FOUND');
  if (!item.document_path) throw apiError('La fila no tiene un PDF institucional asociado.', 404, 'PDF_NOT_FOUND');
  return fetchPdfBuffer(item.document_path);
}

async function createTemplateWorkbook() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Documentos');
  sheet.columns = [{ header: 'Documento', key: 'identification', width: 24 }];
  sheet.addRow({ identification: '1000000000' });
  sheet.getRow(1).font = { bold: true };
  return workbook.xlsx.writeBuffer();
}

async function createResultWorkbook(importId) {
  await ensureImportSchema();
  let record = await SaberProDocumentImport.findByPk(importId, {
    include: [{ model: SaberProDocumentImportItem, as: 'items' }],
    order: [[{ model: SaberProDocumentImportItem, as: 'items' }, 'row_number', 'ASC']]
  });
  if (!record) throw apiError('La consulta no existe.', 404, 'IMPORT_NOT_FOUND');
  const synced = await syncProcessedItemsWithInstitutionalDb(record.id, record.items || []);
  if (synced) {
    record = await SaberProDocumentImport.findByPk(importId, {
      include: [{ model: SaberProDocumentImportItem, as: 'items' }],
      order: [[{ model: SaberProDocumentImportItem, as: 'items' }, 'row_number', 'ASC']]
    });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIAC - UNICESMAG';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Resultados', {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  sheet.columns = [
    { header: 'Fila', key: 'row', width: 10 },
    { header: 'Doc. BD', key: 'dbIdentification', width: 18 },
    { header: 'Doc. PDF', key: 'pdfIdentification', width: 18 },
    { header: 'Estado', key: 'status', width: 22 },
    { header: 'EK BD', key: 'dbRegistration', width: 22 },
    { header: 'EK PDF', key: 'registration', width: 22 },
    { header: 'Fecha BD', key: 'dbDate', width: 18 },
    { header: 'Fecha PDF', key: 'date', width: 18 },
    { header: 'Validación contra BD', key: 'message', width: 78 }
  ];

  const thinBorder = {
    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
  };

  const headerRow = sheet.getRow(1);
  headerRow.height = 26;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A8A' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E3A8A' } },
      left: { style: 'thin', color: { argb: 'FF3B82F6' } },
      bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
      right: { style: 'thin', color: { argb: 'FF3B82F6' } }
    };
  });

  const statusStyles = {
    EXTRACTED: { bg: 'FFDCFCE7', fg: 'FF166534' },
    CORRECTED: { bg: 'FFDBEAFE', fg: 'FF1E40AF' },
    INCOMPLETE: { bg: 'FFFEF3C7', fg: 'FF92400E' },
    NO_PDF: { bg: 'FFFFEDD5', fg: 'FF9A3412' },
    NOT_FOUND: { bg: 'FFFFEDD5', fg: 'FF9A3412' },
    ERROR: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
    INVALID: { bg: 'FFFEE2E2', fg: 'FF991B1B' },
    PENDING: { bg: 'FFF1F5F9', fg: 'FF475569' }
  };

  for (const rawItem of record.items || []) {
    const item = mapItem(rawItem);
    const row = sheet.addRow({
      row: item.rowNumber,
      dbIdentification: item.dbIdentification || 'Sin dato',
      pdfIdentification: item.pdfIdentification || (item.hasDocument ? 'No leído' : 'Sin PDF'),
      status: STATUS_EXPORT_LABELS[item.status] || item.status,
      dbRegistration: item.dbRegistrationNumber || 'Sin dato',
      registration: item.registrationNumber || (item.hasDocument ? 'No leído' : 'Sin PDF'),
      dbDate: item.dbExamDate ? toDisplayDate(item.dbExamDate) : 'Sin dato',
      date: item.examDate ? toDisplayDate(item.examDate) : (item.hasDocument ? 'No leída' : 'Sin PDF'),
      message: item.message || ''
    });

    row.height = 22;
    const isEven = row.number % 2 === 0;
    const baseBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 10.5, color: { argb: 'FF0F172A' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: baseBg } };
      cell.border = thinBorder;
      cell.alignment = {
        vertical: 'middle',
        horizontal: colNumber === 1 || colNumber === 4 || colNumber === 7 || colNumber === 8 ? 'center' : 'left',
        wrapText: colNumber === 9
      };
    });

    row.getCell('dbIdentification').font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF0F172A' } };

    const stStyle = statusStyles[item.status] || statusStyles.PENDING;
    const statusCell = row.getCell('status');
    statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: stStyle.bg } };
    statusCell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: stStyle.fg } };

    const styleDbCell = (cellKey, hasValue) => {
      if (!hasValue) {
        const cell = row.getCell(cellKey);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF991B1B' } };
      }
    };

    const stylePdfCell = (cellKey, hasValue, matches) => {
      if (!item.hasDocument) return;
      const cell = row.getCell(cellKey);
      if (!hasValue) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF2F2' } };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF991B1B' } };
      } else if (matches) {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0FDF4' } };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF166534' } };
      } else {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFBEB' } };
        cell.font = { name: 'Calibri', size: 10.5, bold: true, color: { argb: 'FF92400E' } };
      }
    };

    styleDbCell('dbIdentification', Boolean(item.dbIdentification));
    stylePdfCell('pdfIdentification', Boolean(item.pdfIdentification), item.identificationMatch);

    styleDbCell('dbRegistration', Boolean(item.dbRegistrationNumber));
    stylePdfCell('registration', Boolean(item.registrationNumber), item.registrationMatch);

    styleDbCell('dbDate', Boolean(item.dbExamDate));
    stylePdfCell('date', Boolean(item.examDate), item.examDateMatch);
  }

  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: Math.max(1, (record.items || []).length + 1), column: 9 }
  };

  return workbook.xlsx.writeBuffer();
}

async function clearImports() {
  const processing = await SaberProDocumentImport.count({ where: { status: 'PROCESSING' } });
  if (activeImportId || processing) {
    throw apiError('Espere a que termine el procesamiento antes de limpiar la consulta.',
      409, 'IMPORT_IN_PROGRESS');
  }
  return sequelize.transaction(async (transaction) => {
    const deletedItems = await SaberProDocumentImportItem.destroy({ where: {}, transaction });
    const deletedImports = await SaberProDocumentImport.destroy({ where: {}, transaction });
    return { deletedImports, deletedItems };
  });
}

async function invalidateStoredDateYearMismatches() {
  const items = await SaberProDocumentImportItem.findAll({
    where: {
      registration_number: { [Op.ne]: null },
      exam_date: { [Op.ne]: null },
      status: { [Op.in]: ['EXTRACTED', 'CORRECTED'] }
    }
  });
  const affectedImports = new Set();
  for (const item of items) {
    const validation = validateRegistrationDate(item.registration_number, item.exam_date);
    if (validation.valid) continue;
    await item.update({
      status: 'INCOMPLETE',
      message: validation.expectedYear
        ? `La fecha debe pertenecer al año ${validation.expectedYear}, según el número de registro EK.`
        : 'El número de registro EK no permite validar el año de la fecha.'
    });
    affectedImports.add(String(item.import_id));
  }
  for (const importId of affectedImports) await refreshCounters(importId);
  return items.filter((item) => item.status === 'INCOMPLETE').length;
}

async function queueLatestUnverifiedIdentifications() {
  const latest = await SaberProDocumentImport.findOne({ order: [['created_at', 'DESC']] });
  if (!latest) return 0;
  const [affected] = await SaberProDocumentImportItem.update({
    status: 'PENDING',
    registration_number: null,
    exam_date: null,
    message: 'Pendiente de validar la cédula leída en el PDF.'
  }, {
    where: {
      import_id: latest.id,
      status: 'EXTRACTED',
      message: {
        [Op.and]: [
          { [Op.notLike]: 'Cédula, EK y fecha validados%' },
          { [Op.notLike]: 'Coincide%' }
        ]
      }
    }
  });
  if (affected) {
    await latest.update({ status: 'PROCESSING', finished_at: null });
    await refreshCounters(latest.id);
  }
  return affected;
}

async function initialize() {
  await ensureImportSchema();
  await invalidateStoredDateYearMismatches();
  await queueLatestUnverifiedIdentifications();
  const interrupted = await SaberProDocumentImport.findOne({
    where: { status: 'PROCESSING' },
    order: [['created_at', 'ASC']]
  });
  if (interrupted) startImport(interrupted.id);
}

module.exports = {
  initialize,
  createImport,
  getImport,
  getLatestImport,
  retryImport,
  correctItem,
  getItemPdf,
  createTemplateWorkbook,
  createResultWorkbook,
  clearImports,
  parseWorkbook,
  invalidateStoredDateYearMismatches,
  queueLatestUnverifiedIdentifications,
  normalizeIdentification
};
