const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const SaberProDocumentImport = require('../models/SaberProDocumentImport');
const SaberProDocumentImportItem = require('../models/SaberProDocumentImportItem');
const { extractPdfBuffer } = require('./saberProTextExtractionService');
const { parseEvaluatedData, validateRegistrationDate } = require('./saberProDocumentParser');
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
    return { status: 'NOT_FOUND', message: 'La cédula no existe en la consulta institucional.' };
  }
  const document = selectPdf(institutionalRows);
  if (!document) {
    return { status: 'NO_PDF', message: 'La persona existe, pero no tiene una ruta PDF válida.' };
  }
  const documentPath = normalizeRemotePath(document.document_path);
  const hints = {
    identification: item.identification,
    registrationNumber: document.registration_number
  };
  try {
    const buffer = await fetchPdfBuffer(documentPath);
    const extraction = await extractPdfBuffer(buffer, hints);
    const parsed = parseEvaluatedData(extraction.text, hints);
    if (!parsed.complete) {
      const detail = parsed.identificationMismatch
        ? `La cédula leída en el PDF (${parsed.identification}) no coincide con la cédula consultada (${item.identification}).`
        : `Faltan datos: ${(parsed.missingFields || []).join(', ')}`;
      return {
        status: 'INCOMPLETE',
        registration_number: parsed.registrationNumber || document.registration_number || null,
        exam_date: parsed.examDate,
        document_path: documentPath,
        message: detail
      };
    }
    return {
      status: 'EXTRACTED',
      registration_number: parsed.registrationNumber,
      exam_date: parsed.examDate,
      document_path: documentPath,
      message: `Cédula, EK y fecha validados mediante ${extraction.method}.`
    };
  } catch (error) {
    return {
      status: 'ERROR',
      registration_number: document.registration_number || null,
      document_path: documentPath,
      message: String(error.message || 'No fue posible procesar el PDF.').slice(0, 700)
    };
  }
}

async function processImport(importId) {
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

function mapItem(item) {
  const row = item.toJSON ? item.toJSON() : item;
  return {
    id: String(row.id),
    rowNumber: row.row_number,
    identification: row.identification,
    status: row.status,
    registrationNumber: row.registration_number,
    examDate: row.exam_date,
    hasDocument: Boolean(row.document_path),
    message: row.message,
    correctedBy: row.corrected_by,
    correctedAt: row.corrected_at
  };
}

async function getImport(importId) {
  const record = await SaberProDocumentImport.findByPk(importId, {
    include: [{ model: SaberProDocumentImportItem, as: 'items' }],
    order: [[{ model: SaberProDocumentImportItem, as: 'items' }, 'row_number', 'ASC']]
  });
  if (!record) return null;
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
  const latest = await SaberProDocumentImport.findOne({ order: [['created_at', 'DESC']] });
  return latest ? getImport(latest.id) : null;
}

async function createImport(file, userId) {
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
  if (activeImportId) {
    throw apiError('Ya existe una consulta documental en procesamiento.', 409, 'IMPORT_IN_PROGRESS');
  }
  const record = await SaberProDocumentImport.findByPk(importId);
  if (!record) throw apiError('La consulta no existe.', 404, 'IMPORT_NOT_FOUND');
  const retryable = await SaberProDocumentImportItem.count({
    where: { import_id: importId, status: { [Op.in]: ['PENDING', 'INCOMPLETE', 'ERROR'] } }
  });
  if (!retryable) throw apiError('No existen filas pendientes, incompletas o con error.', 409, 'NOTHING_TO_RETRY');
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
  const item = await SaberProDocumentImportItem.findByPk(itemId);
  if (!item) throw apiError('La fila no existe.', 404, 'ITEM_NOT_FOUND');
  if (!['INCOMPLETE', 'ERROR'].includes(item.status)) {
    throw apiError('Solo se pueden corregir filas incompletas o con error.', 409, 'ITEM_NOT_REVIEWABLE');
  }
  if (String(item.message || '').includes('no coincide con la cédula consultada')) {
    throw apiError('No se puede corregir este registro: la cédula del PDF pertenece a otra persona.',
      409, 'IDENTIFICATION_MISMATCH');
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
  await item.update({
    registration_number: registrationNumber,
    exam_date: examDate,
    status: 'CORRECTED',
    message: 'Información revisada y corregida manualmente.',
    corrected_by: userId,
    corrected_at: new Date()
  });
  await refreshCounters(item.import_id);
  return mapItem(item);
}

async function getItemPdf(itemId) {
  const item = await SaberProDocumentImportItem.findByPk(itemId);
  if (!item) throw apiError('La fila no existe.', 404, 'ITEM_NOT_FOUND');
  if (!['INCOMPLETE', 'ERROR'].includes(item.status)) {
    throw apiError('El visor está disponible únicamente para filas incompletas o con error.', 409, 'ITEM_NOT_REVIEWABLE');
  }
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
  const record = await SaberProDocumentImport.findByPk(importId, {
    include: [{ model: SaberProDocumentImportItem, as: 'items' }],
    order: [[{ model: SaberProDocumentImportItem, as: 'items' }, 'row_number', 'ASC']]
  });
  if (!record) throw apiError('La consulta no existe.', 404, 'IMPORT_NOT_FOUND');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Resultados');
  sheet.columns = [
    { header: 'Fila original', key: 'row', width: 14 },
    { header: 'Identificación', key: 'identification', width: 22 },
    { header: 'Estado', key: 'status', width: 20 },
    { header: 'Número de registro', key: 'registration', width: 25 },
    { header: 'Fecha del examen (DD/MM/AAAA)', key: 'date', width: 31 },
    { header: 'Detalle', key: 'message', width: 60 }
  ];
  for (const item of record.items || []) {
    const row = sheet.addRow({
      row: item.row_number,
      identification: item.identification,
      status: item.status,
      registration: item.registration_number,
      date: item.exam_date ? new Date(`${item.exam_date}T00:00:00Z`) : null,
      message: item.message
    });
    if (item.exam_date) row.getCell('date').numFmt = 'dd/mm/yyyy';
  }
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return workbook.xlsx.writeBuffer();
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
      message: { [Op.notLike]: 'Cédula, EK y fecha validados%' }
    }
  });
  if (affected) {
    await latest.update({ status: 'PROCESSING', finished_at: null });
    await refreshCounters(latest.id);
  }
  return affected;
}

async function initialize() {
  await SaberProDocumentImport.sync();
  await SaberProDocumentImportItem.sync();
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
  parseWorkbook,
  invalidateStoredDateYearMismatches,
  queueLatestUnverifiedIdentifications,
  normalizeIdentification
};
