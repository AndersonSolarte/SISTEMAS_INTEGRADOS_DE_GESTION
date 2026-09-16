const ExcelJS = require('exceljs');
const { sequelize } = require('../config/database');
const {
  StrategicPlan, StrategicFieldDefinition, StrategicReferenceImport
} = require('../models');
const { sha256 } = require('./strategicPlanningDomainService');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const cellText = (cell) => {
  if (!cell) return '';
  const value = cell.value;
  try {
    if (cell.text) return String(cell.text).replace(/\s+/g, ' ').trim();
  } catch (_error) {
    // Algunas celdas combinadas vacías de ExcelJS no permiten consultar .text.
  }
  if (value && typeof value === 'object') {
    if (Array.isArray(value.richText)) return value.richText.map((part) => part.text).join('').replace(/\s+/g, ' ').trim();
    if (value.result !== undefined && value.result !== null) return String(value.result).replace(/\s+/g, ' ').trim();
  }
  return value === null || value === undefined ? '' : String(value).replace(/\s+/g, ' ').trim();
};

const fieldKey = (label, index) => {
  const normalized = normalize(label);
  const canonical = {
    actividades: 'activity', actividad: 'activity',
    'tipo de indicador': 'indicator_type', 'tipo indicador': 'indicator_type',
    'fecha inicio': 'starts_on', 'fecha inicial': 'starts_on',
    'fecha fin': 'ends_on', 'fecha final': 'ends_on',
    indicador: 'indicator', meta: 'target', corresponsable: 'co_responsibles', corresponsables: 'co_responsibles'
  }[normalized];
  const cleaned = canonical || normalized.replace(/\s+/g, '_').slice(0, 55);
  return cleaned || `campo_${index + 1}`;
};

const inferField = ({ label, samples, column }) => {
  const name = normalize(label);
  const values = samples.filter((value) => value !== '' && value !== null && value !== undefined);
  const textOptions = [...new Set(values.filter((value) => ['string', 'number'].includes(typeof value)).map((value) => String(value).trim()).filter(Boolean))];
  const systemSequence = /^(no|numero|n)$/.test(name);
  let dataType = 'text';
  let validationRules = {};
  if (/fecha/.test(name) || values.some((value) => value instanceof Date)) dataType = 'date';
  else if (/(avance|porcentaje|cumplimiento|progreso|%)\b/.test(name)) {
    dataType = 'percentage'; validationRules = { min: 0, max: 100 };
  } else if (/(presupuesto|valor|costo|monto|recurso)/.test(name)) dataType = 'currency';
  else if (/(corresponsable)/.test(name)) {
    dataType = 'catalog_multi'; validationRules = { catalog_type: 'actor' };
  } else if (/(responsable|dependencia)/.test(name)) {
    dataType = 'catalog'; validationRules = { catalog_type: 'organizational_unit' };
  } else if (/^tipo\b/.test(name) && textOptions.length <= 25) {
    dataType = 'list';
  } else if (/(observacion|descripcion|actividad|objetivo|lineamiento|indicador|meta)/.test(name)) dataType = 'long_text';
  else if (values.length && values.every((value) => typeof value === 'number')) dataType = 'number';

  return {
    source_column: column,
    include: !systemSequence,
    system: systemSequence,
    label,
    key: fieldKey(label, column - 1),
    data_type: dataType,
    required: false,
    validation_rules: validationRules,
    options: dataType === 'list' ? textOptions : [],
    sample_values: values.slice(0, 3).map((value) => value instanceof Date ? value.toISOString().slice(0, 10) : String(value))
  };
};

const deduplicateKeys = (fields) => {
  const used = new Map();
  return fields.map((field) => {
    const count = (used.get(field.key) || 0) + 1;
    used.set(field.key, count);
    return count === 1 ? field : { ...field, key: `${field.key}_${count}`.slice(0, 60) };
  });
};

const detectHeaderRow = (sheet) => {
  const lastRow = Math.min(sheet.rowCount, 40);
  const lastColumn = Math.min(sheet.columnCount, 100);
  let best = { row: 1, score: -1, count: 0 };
  for (let row = 1; row <= lastRow; row += 1) {
    const labels = [];
    for (let column = 1; column <= lastColumn; column += 1) {
      const text = cellText(sheet.getCell(row, column));
      if (text) labels.push(text);
    }
    if (labels.length < 2) continue;
    const unique = new Set(labels.map(normalize)).size;
    const nextRowsWithData = [1, 2, 3].reduce((total, offset) => {
      let populated = 0;
      for (let column = 1; column <= lastColumn; column += 1) if (cellText(sheet.getCell(row + offset, column))) populated += 1;
      return total + populated;
    }, 0);
    const score = (labels.length * 10) + unique + Math.min(nextRowsWithData, labels.length * 3);
    if (score > best.score) best = { row, score, count: labels.length };
  }
  return best;
};

const parseFieldSchemaWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  if (!workbook.worksheets.length) throw Object.assign(new Error('El Excel no contiene hojas.'), { statusCode: 422 });

  const candidates = workbook.worksheets.map((sheet) => ({ sheet, header: detectHeaderRow(sheet) }))
    .sort((a, b) => b.header.score - a.header.score);
  const selected = candidates[0];
  if (!selected || selected.header.count < 2) throw Object.assign(new Error('No fue posible encontrar una fila de encabezados en el Excel.'), { statusCode: 422 });

  const { sheet } = selected;
  const fields = [];
  for (let column = 1; column <= Math.min(sheet.columnCount, 100); column += 1) {
    const label = cellText(sheet.getCell(selected.header.row, column));
    if (!label) continue;
    const samples = [];
    for (let row = selected.header.row + 1; row <= Math.min(sheet.rowCount, selected.header.row + 250); row += 1) {
      const cell = sheet.getCell(row, column);
      samples.push(cell.value && typeof cell.value === 'object' && cell.value.result !== undefined ? cell.value.result : cell.value);
    }
    fields.push(inferField({ label, samples, column }));
  }
  return {
    sheet_name: sheet.name,
    header_row: selected.header.row,
    fields: deduplicateKeys(fields),
    sheets: workbook.worksheets.map((item) => item.name)
  };
};

const previewFieldSchemaImport = async ({ strategicPlanId, file, userId }) => {
  const plan = await StrategicPlan.findByPk(strategicPlanId);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const parsed = await parseFieldSchemaWorkbook(file.buffer);
  return StrategicReferenceImport.create({
    strategic_plan_id: plan.id,
    original_name: file.originalname,
    sha256: sha256(file.buffer),
    status: 'field_schema_preview',
    parsed_data: { kind: 'field_schema', ...parsed },
    summary: { sheet_name: parsed.sheet_name, header_row: parsed.header_row, detected: parsed.fields.length, selected: parsed.fields.filter((field) => field.include).length },
    warnings: parsed.fields.filter((field) => field.system).map((field) => ({ type: 'system_sequence', column: field.source_column, label: field.label })),
    created_by: userId
  });
};

const confirmFieldSchemaImport = async ({ importId, userId, fields, replaceExisting = false }) => sequelize.transaction(async (transaction) => {
  const batch = await StrategicReferenceImport.findByPk(importId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!batch || batch.status !== 'field_schema_preview' || batch.parsed_data?.kind !== 'field_schema') {
    throw Object.assign(new Error('Esta vista previa ya no está disponible para confirmar.'), { statusCode: 409 });
  }
  const plan = await StrategicPlan.findByPk(batch.strategic_plan_id, { transaction });
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const selected = (Array.isArray(fields) ? fields : batch.parsed_data.fields).filter((field) => field.include !== false && !field.system);
  if (!selected.length) throw Object.assign(new Error('Seleccione por lo menos un campo para crear la tabla.'), { statusCode: 422 });

  const allowedTypes = new Set(['text', 'long_text', 'number', 'percentage', 'date', 'currency', 'list', 'catalog', 'catalog_multi', 'file', 'formula']);
  const usedKeys = new Set();
  const prepared = selected.map((field, index) => {
    const key = fieldKey(field.key || field.label, index);
    if (usedKeys.has(key)) throw Object.assign(new Error(`El código ${key} está repetido.`), { statusCode: 422 });
    usedKeys.add(key);
    return {
      key,
      label: String(field.label || '').trim(),
      data_type: allowedTypes.has(field.data_type) ? field.data_type : 'text',
      required: field.required === true,
      position: index + 1,
      validation_rules: field.validation_rules || {},
      options: Array.isArray(field.options) ? field.options : [],
      formula: field.formula || null
    };
  });
  if (prepared.some((field) => !field.label)) throw Object.assign(new Error('Todos los campos seleccionados deben tener nombre.'), { statusCode: 422 });

  const existing = await StrategicFieldDefinition.findAll({
    where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version }, transaction
  });
  if (replaceExisting) {
    const incoming = new Set(prepared.map((field) => field.key));
    for (const field of existing.filter((item) => item.active && !incoming.has(item.key))) await field.update({ active: false }, { transaction });
  }
  for (const values of prepared) {
    const current = existing.find((field) => field.key === values.key);
    if (current) await current.update({ ...values, active: true }, { transaction });
    else await StrategicFieldDefinition.create({ strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true, ...values }, { transaction });
  }
  await batch.update({
    status: 'confirmed', confirmed_by: userId, confirmed_at: new Date(),
    summary: { ...(batch.summary || {}), created_or_updated: prepared.length, replace_existing: replaceExisting }
  }, { transaction });
  return batch;
});

module.exports = { parseFieldSchemaWorkbook, previewFieldSchemaImport, confirmFieldSchemaImport };
