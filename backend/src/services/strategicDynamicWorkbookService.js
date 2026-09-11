const ExcelJS = require('exceljs');
const { sequelize } = require('../config/database');
const {
  StrategicPlan, StrategicLevel, StrategicElement, StrategicTerm, StrategicCatalogItem,
  StrategicFieldDefinition, StrategicActionPlan, StrategicActionItem, StrategicActionItemVersion,
  StrategicHistoricalImport
} = require('../models');
const { sha256, cleanCode, audit } = require('./strategicPlanningDomainService');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const rawCell = (cell) => cell?.value?.result ?? cell?.value?.text ?? cell?.value ?? '';
const textCell = (cell) => String(rawCell(cell) ?? '').replace(/\s+/g, ' ').trim();
const dateValue = (value) => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}` : null;
};
const numberValue = (value) => {
  if (typeof value === 'number') return value;
  let text = String(value ?? '').replace(/[$%\s]/g, '');
  if (text.includes('.') && text.includes(',')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  return Number(text);
};

const SKIP_FIELDS = new Set(['strategic_objective', 'strategic_guideline', 'activity', 'responsible', 'progress_s1', 'observations_s1', 'progress_s2', 'observations_s2', 'total_progress']);
const CORE_FIELDS = new Set(['indicator_type', 'starts_on', 'ends_on', 'indicator', 'target', 'co_responsibles']);

const loadConfiguration = async (actionPlanId) => {
  const actionPlan = await StrategicActionPlan.findByPk(actionPlanId);
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  const term = await StrategicTerm.findByPk(actionPlan.term_id);
  const plan = term && await StrategicPlan.findByPk(term.strategic_plan_id);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });
  const [levels, elements, fields, catalogs] = await Promise.all([
    StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true }, order: [['position', 'ASC']] }),
    StrategicElement.findAll({ where: { strategic_plan_id: plan.id, active: true, deleted_at: null }, order: [['position', 'ASC']] }),
    StrategicFieldDefinition.findAll({ where: { strategic_plan_id: plan.id, configuration_version: plan.configuration_version, active: true }, order: [['position', 'ASC']] }),
    StrategicCatalogItem.findAll({ where: { strategic_plan_id: plan.id, active: true }, order: [['name', 'ASC']] })
  ]);
  return { actionPlan, term, plan, levels, elements, fields, catalogs };
};

const columnsFor = ({ levels, fields }) => [
  { key: 'code', label: 'Código (vacío = nuevo)', type: 'text', required: false },
  ...levels.map((level) => ({ key: `structure_level_${level.id}`, label: level.name, type: 'structure', levelId: level.id, required: false })),
  { key: 'activity', label: 'Nombre o descripción principal', type: 'long_text', required: true },
  ...fields.filter((field) => !SKIP_FIELDS.has(field.key) && field.data_type !== 'formula' && field.data_type !== 'strategic_relation').map((field) => ({
    key: field.key, label: field.label, type: field.data_type, required: field.required, catalogType: field.validation_rules?.catalog_type || null, options: field.options || []
  }))
];

const itemValue = (item, column, elements, catalogs) => {
  if (column.key === 'code') return item.code;
  if (column.key === 'activity') return item.activity;
  if (column.type === 'structure') {
    const id = item.custom_values?.[column.key];
    const element = elements.find((entry) => String(entry.id) === String(id));
    return element ? element.code : '';
  }
  let value = CORE_FIELDS.has(column.key) ? item[column.key] : item.custom_values?.[column.key];
  if (column.catalogType && value) {
    const ids = Array.isArray(value) ? value : [value];
    value = ids.map((id) => catalogs.find((entry) => String(entry.id) === String(id))?.code || id).join(', ');
  }
  if (Array.isArray(value)) return value.join(', ');
  return value ?? '';
};

const buildDynamicActionItemWorkbook = async (actionPlanId) => {
  const config = await loadConfiguration(actionPlanId);
  const items = await StrategicActionItem.findAll({ where: { action_plan_id: actionPlanId, deleted_at: null }, order: [['code', 'ASC']] });
  const columns = columnsFor(config);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIAC UNICESMAG';
  const metadata = workbook.addWorksheet('_CONFIG');
  metadata.addRows([
    ['strategic_plan_id', config.plan.id],
    ['action_plan_id', config.actionPlan.id],
    ['configuration_version', config.plan.configuration_version]
  ]);
  metadata.state = 'veryHidden';
  const instructions = workbook.addWorksheet('INSTRUCCIONES');
  instructions.addRows([
    ['PLANTILLA DINÁMICA', `${config.actionPlan.code} · ${config.plan.name}`],
    ['1', 'Cada columna fue creada con la estructura y los campos configurados para este PED.'],
    ['2', 'Mantenga la fila de nombres y la fila técnica. No cambie ni elimine las dos primeras filas.'],
    ['3', 'Deje el código vacío para agregar; conserve un código existente para actualizar esa fila.'],
    ['4', 'En niveles y catálogos escriba el código de una opción existente.'],
    ['5', 'Suba el archivo, revise la vista previa y confirme la carga.']
  ]);
  instructions.getColumn(1).width = 22; instructions.getColumn(2).width = 105;
  const sheet = workbook.addWorksheet('REGISTROS');
  sheet.addRow(columns.map((column) => column.label));
  sheet.addRow(columns.map((column) => column.key));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
  sheet.getRow(2).font = { color: { argb: 'FF64748B' }, italic: true };
  sheet.getRow(2).hidden = true;
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
  columns.forEach((column, index) => { sheet.getColumn(index + 1).width = ['activity', 'indicator'].includes(column.key) ? 48 : 26; });
  items.forEach((item) => sheet.addRow(columns.map((column) => itemValue(item, column, config.elements, config.catalogs))));
  if (!items.length) sheet.addRow(columns.map(() => ''));
  return { buffer: await workbook.xlsx.writeBuffer(), code: config.actionPlan.code };
};

const previewDynamicActionItems = async ({ actionPlanId, file, userId }) => {
  const config = await loadConfiguration(actionPlanId);
  const expectedColumns = columnsFor(config);
  const expectedByKey = new Map(expectedColumns.map((column) => [column.key, column]));
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(file.buffer);
  const metadata = workbook.getWorksheet('_CONFIG');
  const metadataValues = new Map();
  if (metadata) for (let row = 1; row <= metadata.rowCount; row += 1) metadataValues.set(textCell(metadata.getCell(row, 1)), textCell(metadata.getCell(row, 2)));
  if (!metadata || metadataValues.get('action_plan_id') !== String(actionPlanId) || metadataValues.get('strategic_plan_id') !== String(config.plan.id)) {
    throw Object.assign(new Error('Esta plantilla pertenece a otro PED o Plan de Acción. Descargue una plantilla nueva desde este formulario.'), { statusCode: 422 });
  }
  if (Number(metadataValues.get('configuration_version')) !== Number(config.plan.configuration_version)) {
    throw Object.assign(new Error('La estructura del PED cambió después de descargar esta plantilla. Descargue la versión actual.'), { statusCode: 409 });
  }
  const sheet = workbook.getWorksheet('REGISTROS');
  if (!sheet) throw Object.assign(new Error('El archivo no contiene la hoja REGISTROS.'), { statusCode: 422 });
  const keys = []; for (let column = 1; column <= sheet.columnCount; column += 1) keys.push(textCell(sheet.getCell(2, column)));
  if (!keys.includes('activity')) throw Object.assign(new Error('La plantilla no corresponde al formulario dinámico de este PED.'), { statusCode: 422 });
  const errors = []; const rows = [];
  const existing = await StrategicActionItem.findAll({ where: { action_plan_id: actionPlanId, deleted_at: null }, attributes: ['code'], raw: true });
  const usedCodes = new Set(existing.map((item) => cleanCode(item.code)));
  const uploadedCodes = new Set();
  let sequence = existing.length + 1;
  for (let rowNumber = 3; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const source = {}; keys.forEach((key, index) => { if (key) source[key] = rawCell(sheet.getCell(rowNumber, index + 1)); });
    if (!Object.values(source).some((value) => String(value ?? '').trim())) continue;
    let code = cleanCode(source.code || '');
    if (!code) { do { code = `ACT-${String(sequence).padStart(3, '0')}`; sequence += 1; } while (usedCodes.has(code)); }
    if (uploadedCodes.has(code)) errors.push({ row: rowNumber, field: 'Código', message: `El código ${code} está repetido dentro del archivo.` });
    uploadedCodes.add(code);
    usedCodes.add(code);
    const payload = { code, activity: String(source.activity || '').trim(), indicator_type: null, indicator: null, target: null, starts_on: null, ends_on: null, co_responsibles: [], custom_values: { source_row: rowNumber }, strategic_element_id: null };
    if (!payload.activity) errors.push({ row: rowNumber, field: 'activity', message: 'Falta el nombre o descripción principal.' });
    for (const column of expectedColumns) {
      if (['code', 'activity'].includes(column.key)) continue;
      const raw = source[column.key]; const empty = raw === null || raw === undefined || String(raw).trim() === '';
      if (column.required && empty) errors.push({ row: rowNumber, field: column.label, message: 'Campo obligatorio vacío.' });
      if (empty) continue;
      if (column.type === 'structure') {
        const element = config.elements.find((entry) => String(entry.level_id) === String(column.levelId) && [normalize(entry.code), normalize(entry.name), normalize(`${entry.code} ${entry.name}`)].includes(normalize(raw)));
        if (!element) errors.push({ row: rowNumber, field: column.label, message: `No existe el elemento “${raw}”.` });
        else { payload.custom_values[column.key] = element.id; payload.strategic_element_id = element.id; }
        continue;
      }
      let value = raw;
      if (column.type === 'date') {
        value = dateValue(raw); if (!value) errors.push({ row: rowNumber, field: column.label, message: 'Fecha inválida. Use AAAA-MM-DD o DD/MM/AAAA.' });
      } else if (['number', 'percentage', 'currency'].includes(column.type)) {
        value = numberValue(raw);
        if (!Number.isFinite(value)) errors.push({ row: rowNumber, field: column.label, message: 'Debe ser un número.' });
      } else if (column.type === 'list' && (column.options || []).length) {
        const option = column.options.find((entry) => normalize(entry) === normalize(raw));
        if (!option) errors.push({ row: rowNumber, field: column.label, message: 'La opción no pertenece a la lista configurada.' });
        else value = option;
      } else if (column.catalogType) {
        const requested = column.type === 'catalog_multi' ? String(raw).split(',').map((part) => part.trim()).filter(Boolean) : [String(raw).trim()];
        const matched = requested.map((part) => config.catalogs.find((entry) => entry.catalog_type === column.catalogType && [normalize(entry.code), normalize(entry.name), normalize(`${entry.code} ${entry.name}`)].includes(normalize(part))));
        if (matched.some((entry) => !entry)) errors.push({ row: rowNumber, field: column.label, message: 'Una opción no existe en la tabla configurada.' });
        else value = column.type === 'catalog_multi' ? matched.map((entry) => entry.id) : matched[0].id;
      } else if (column.type === 'catalog_multi') value = String(raw).split(',').map((part) => part.trim()).filter(Boolean);
      if (CORE_FIELDS.has(column.key)) payload[column.key] = column.key === 'co_responsibles' && !Array.isArray(value) ? String(value).split(',').map((part) => part.trim()).filter(Boolean) : value;
      else payload.custom_values[column.key] = value;
    }
    rows.push({ source_row: rowNumber, payload });
  }
  const record = await StrategicHistoricalImport.create({
    strategic_plan_id: config.plan.id, term_id: config.term.id, format_code: 'PED-DYNAMIC', format_version: config.plan.configuration_version,
    mapping: { action_plan_id: actionPlanId, columns: expectedColumns.map(({ key, label }) => ({ key, label })) }, original_name: file.originalname,
    sha256: sha256(file.buffer), rows, errors, created_by: userId
  });
  return record;
};

const confirmDynamicActionItems = async ({ importId, req }) => {
  const batch = await StrategicHistoricalImport.findByPk(importId);
  if (!batch || batch.format_code !== 'PED-DYNAMIC' || batch.status !== 'preview') throw Object.assign(new Error('La carga dinámica ya no está disponible.'), { statusCode: 409 });
  if ((batch.errors || []).length) throw Object.assign(new Error('Corrija los errores de la plantilla antes de confirmar.'), { statusCode: 422 });
  const actionPlan = await StrategicActionPlan.findByPk(batch.mapping?.action_plan_id);
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  await sequelize.transaction(async (transaction) => {
    for (const row of batch.rows || []) {
      const payload = row.payload; const existing = await StrategicActionItem.findOne({ where: { action_plan_id: actionPlan.id, code: cleanCode(payload.code), deleted_at: null }, transaction });
      const values = { ...payload, action_plan_id: actionPlan.id, code: cleanCode(payload.code), updated_by: req.user.id };
      if (existing) {
        await StrategicActionItemVersion.create({ action_item_id: existing.id, version: existing.version, snapshot: existing.toJSON(), justification: `Carga masiva ${batch.original_name}`, created_by: req.user.id }, { transaction });
        await existing.update({ ...values, version: Number(existing.version || 1) + 1 }, { transaction });
      } else await StrategicActionItem.create({ ...values, created_by: req.user.id }, { transaction });
    }
    await batch.update({ status: 'confirmed', confirmed_by: req.user.id, confirmed_at: new Date() }, { transaction });
    await audit(req, 'dynamic_items_import.confirm', 'historical_import', batch.id, null, { action_plan_id: actionPlan.id, rows: batch.rows.length }, null, transaction);
  });
  return batch;
};

module.exports = { buildDynamicActionItemWorkbook, previewDynamicActionItems, confirmDynamicActionItems };
