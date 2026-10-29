const ExcelJS = require('exceljs');
const { sequelize } = require('../config/database');
const {
  StrategicPlan, StrategicLevel, StrategicElement, StrategicTerm, StrategicCatalogItem,
  StrategicFieldDefinition, StrategicActionPlan, StrategicActionItem, StrategicActionItemVersion,
  StrategicHistoricalImport
} = require('../models');
const { sha256, cleanCode, audit } = require('./strategicPlanningDomainService');
const { captureActionPlanSchema } = require('./strategicActionPlanSchemaService');
const { parsePeriodDate } = require('./actionPlanRepositoryDriveService');
const { ensureActivityFoldersInDrive } = require('./strategicPlanningDriveService');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const rawCell = (cell) => cell?.value?.result ?? cell?.value?.text ?? cell?.value ?? '';
const textCell = (cell) => String(rawCell(cell) ?? '').replace(/\s+/g, ' ').trim();

const numberValue = (value) => {
  if (typeof value === 'number') return value;
  let text = String(value ?? '').replace(/[$%\s]/g, '');
  if (text.includes('.') && text.includes(',')) text = text.lastIndexOf(',') > text.lastIndexOf('.') ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '');
  else if (text.includes(',')) text = text.replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(text)) text = text.replace(/\./g, '');
  return Number(text);
};

// Campos exclusivos de seguimiento/monitoreo o fórmulas que no forman parte de la formulación inicial de la actividad
const MONITORING_EXCLUDED_KEYS = new Set([
  'progress_s1', 'observations_s1', 'progress_s2', 'observations_s2',
  'total_progress', 'avance_a_ip_2026', 'avance_a_iip_2026',
  'observaciones', 'observaciones_2', 'total'
]);

const CORE_FIELDS = new Set(['indicator_type', 'starts_on', 'ends_on', 'indicator', 'target', 'co_responsibles']);

const loadConfiguration = async (actionPlanId) => {
  const actionPlan = await StrategicActionPlan.findByPk(actionPlanId);
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });
  const term = await StrategicTerm.findByPk(actionPlan.term_id);
  const plan = term && await StrategicPlan.findByPk(term.strategic_plan_id);
  if (!plan) throw Object.assign(new Error('PED no encontrado.'), { statusCode: 404 });

  // Obtener el esquema actualizado del PED (refleja columnas agregadas o quitadas en tiempo real)
  const currentSchema = await captureActionPlanSchema(plan.id);

  if (currentSchema && (!actionPlan.metadata?.form_schema || actionPlan.metadata.form_schema.configuration_version !== currentSchema.configuration_version)) {
    actionPlan.metadata = {
      ...(actionPlan.metadata || {}),
      form_schema: currentSchema
    };
    actionPlan.instrument_version = currentSchema.configuration_version;
    await actionPlan.update({ metadata: actionPlan.metadata, instrument_version: actionPlan.instrument_version });
  }

  return {
    actionPlan,
    term,
    plan,
    levels: currentSchema.levels || [],
    elements: currentSchema.elements || [],
    fields: currentSchema.fields || [],
    catalogs: currentSchema.catalogs || [],
    schemaVersion: currentSchema.configuration_version || actionPlan.instrument_version || 1
  };
};

const columnsFor = ({ fields }) => {
  const seenKeys = new Set(['code']);
  const cols = [
    { key: 'code', label: 'Código (vacío = nuevo)', type: 'text', required: false }
  ];

  for (const field of fields || []) {
    if (!field || field.active === false) continue;
    if (field.data_type === 'formula') continue;
    if (MONITORING_EXCLUDED_KEYS.has(field.key)) continue;
    if (seenKeys.has(field.key)) continue;
    seenKeys.add(field.key);

    const catalogType = field.validation_rules?.catalog_type ||
      (['responsible', 'responsable_de_ejecucion'].includes(field.key) ? 'organizational_unit' : null);

    cols.push({
      key: field.key,
      label: field.label || field.key,
      type: field.data_type,
      required: Boolean(field.required || field.key === 'activity'),
      catalogType,
      options: Array.isArray(field.options) ? field.options : (field.options ? [field.options] : [])
    });
  }

  // Asegurar que exista la columna de actividad si no venía en fields
  if (!seenKeys.has('activity')) {
    cols.splice(1, 0, {
      key: 'activity',
      label: 'Actividad',
      type: 'long_text',
      required: true,
      options: []
    });
  }

  return cols;
};

const itemValue = (item, column, elements = [], catalogs = []) => {
  if (column.key === 'code') return item.code || '';
  if (column.key === 'activity') return item.activity || '';
  let value = CORE_FIELDS.has(column.key) ? item[column.key] : item.custom_values?.[column.key];
  if (value === undefined || value === null) {
    value = item.custom_values?.[column.key] ?? item[column.key] ?? '';
  }
  if (column.type === 'date' && value) {
    const parsed = parsePeriodDate(value);
    if (parsed) return parsed;
  }
  if (column.type === 'strategic_relation' && value) {
    const element = elements.find((el) => String(el.id) === String(value));
    if (element) return element.code ? `${element.code} ${element.name}` : element.name;
  }
  if (column.catalogType && value) {
    const ids = Array.isArray(value) ? value : [value];
    value = ids.map((id) => {
      const match = catalogs.find((c) => String(c.id) === String(id));
      return match?.name || match?.code || id;
    }).join(', ');
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
    ['configuration_version', config.schemaVersion]
  ]);
  metadata.state = 'veryHidden';
  const instructions = workbook.addWorksheet('INSTRUCCIONES');
  instructions.addRows([
    ['PLANTILLA DINÁMICA DE CARGA MASIVA', `${config.actionPlan.code} · ${config.plan.name}`],
    ['1', 'Esta plantilla refleja exactamente los campos configurados actualmente en el formulario de este PED.'],
    ['2', 'Conserve los encabezados de la fila 1. Si no tiene código, déjelo vacío y el sistema le asignará uno automáticamente (ACT-001, ACT-002, etc.).'],
    ['3', 'Para actualizar una actividad existente, conserve su código en la primera columna.'],
    ['4', 'Fechas: Puede escribirlas en formato AAAA-MM-DD o DD/MM/AAAA (ej. 20/10/2026).'],
    ['5', 'Guarde el archivo y súbalo en el botón “Subir plantilla diligenciada” para procesar la carga de inmediato.']
  ]);
  instructions.getColumn(1).width = 24; instructions.getColumn(2).width = 110;
  const sheet = workbook.addWorksheet('REGISTROS');
  sheet.addRow(columns.map((column) => column.label));
  sheet.addRow(columns.map((column) => column.key));
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
  sheet.getRow(2).font = { color: { argb: 'FF64748B' }, italic: true };
  sheet.getRow(2).hidden = true;
  // Sin columnas ni filas inmovilizadas para evitar problemas de visualización en Excel
  sheet.views = [];
  columns.forEach((column, index) => {
    sheet.getColumn(index + 1).width = ['activity', 'indicator', 'strategic_objective', 'strategic_guideline'].includes(column.key) ? 46 : 24;
  });
  items.forEach((item) => sheet.addRow(columns.map((column) => itemValue(item, column, config.elements, config.catalogs))));
  if (!items.length) sheet.addRow(columns.map(() => ''));
  return { buffer: await workbook.xlsx.writeBuffer(), code: config.actionPlan.code };
};

const previewDynamicActionItems = async ({ actionPlanId, file, userId }) => {
  const config = await loadConfiguration(actionPlanId);
  const expectedColumns = columnsFor(config);
  const expectedByKey = new Map(expectedColumns.map((column) => [column.key, column]));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);

  const sheet = workbook.getWorksheet('REGISTROS') || workbook.worksheets[0];
  if (!sheet) throw Object.assign(new Error('El archivo Excel no contiene la hoja REGISTROS ni datos legibles.'), { statusCode: 422 });

  // Mapear columnas dinámicamente tanto por clave técnica (fila 2) como por etiqueta (fila 1)
  const colCount = Math.max(sheet.columnCount || 0, expectedColumns.length);
  const columnKeyByIndex = new Map();
  for (let c = 1; c <= colCount; c += 1) {
    const keyCandidate = textCell(sheet.getCell(2, c));
    const labelCandidate = textCell(sheet.getCell(1, c));
    if (keyCandidate && expectedByKey.has(keyCandidate)) {
      columnKeyByIndex.set(c, keyCandidate);
    } else if (labelCandidate) {
      const normLabel = normalize(labelCandidate);
      const match = expectedColumns.find((col) => normalize(col.label) === normLabel || normalize(col.key) === normLabel);
      if (match) {
        columnKeyByIndex.set(c, match.key);
      }
    }
  }

  // Asegurar que activity esté mapeada; si no, buscar cualquier columna con nombre de actividad
  const mappedKeys = Array.from(columnKeyByIndex.values());
  if (!mappedKeys.includes('activity')) {
    for (let c = 1; c <= colCount; c += 1) {
      const header = normalize(textCell(sheet.getCell(1, c)));
      if (header.includes('actividad') || header.includes('nombre') || header.includes('descripcion')) {
        columnKeyByIndex.set(c, 'activity');
        break;
      }
    }
  }

  const errors = [];
  const rows = [];
  const existing = await StrategicActionItem.findAll({ where: { action_plan_id: actionPlanId, deleted_at: null }, attributes: ['code'], raw: true });
  const usedCodes = new Set(existing.map((item) => cleanCode(item.code)));
  const uploadedCodes = new Set();
  let sequence = existing.length + 1;

  // Determinar si la fila 2 es técnica o ya contiene datos
  const row2Col1 = textCell(sheet.getCell(2, 1));
  const isRow2Technical = row2Col1 === 'code' || expectedByKey.has(row2Col1);
  const startRow = isRow2Technical ? 3 : 2;

  for (let rowNumber = startRow; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const source = {};
    for (let c = 1; c <= colCount; c += 1) {
      const key = columnKeyByIndex.get(c);
      if (key) {
        source[key] = rawCell(sheet.getCell(rowNumber, c));
      }
    }

    if (!Object.values(source).some((value) => String(value ?? '').trim())) continue;

    let code = cleanCode(source.code || '');
    if (!code) {
      do {
        code = `ACT-${String(sequence).padStart(3, '0')}`;
        sequence += 1;
      } while (usedCodes.has(code));
    }

    if (uploadedCodes.has(code)) {
      errors.push({ row: rowNumber, field: 'Código', message: `El código ${code} está repetido dentro del archivo.` });
    }
    uploadedCodes.add(code);
    usedCodes.add(code);

    const rawActivity = source.activity || source.actividad || source.nombre_actividad || source.descripcion_actividad || '';
    const payload = {
      code,
      activity: String(rawActivity || '').trim(),
      indicator_type: null,
      indicator: null,
      target: null,
      starts_on: null,
      ends_on: null,
      co_responsibles: [],
      custom_values: { source_row: rowNumber },
      strategic_element_id: null
    };

    if (!payload.activity) {
      errors.push({ row: rowNumber, field: 'activity', message: 'Falta el nombre o descripción principal de la actividad.' });
    }

    for (const column of expectedColumns) {
      if (['code', 'activity'].includes(column.key)) continue;
      const raw = source[column.key];
      const empty = raw === null || raw === undefined || String(raw).trim() === '';
      if (column.required && empty) {
        errors.push({ row: rowNumber, field: column.label, message: `El campo obligatorio “${column.label}” está vacío.` });
      }
      if (empty) continue;

      let value = raw;
      if (column.type === 'date') {
        const parsed = parsePeriodDate(raw);
        if (parsed) {
          value = parsed;
        } else {
          errors.push({ row: rowNumber, field: column.label, message: `Fecha no válida en “${column.label}”. Use formato AAAA-MM-DD o DD/MM/AAAA.` });
        }
      } else if (['number', 'percentage', 'currency'].includes(column.type)) {
        value = numberValue(raw);
        if (!Number.isFinite(value)) {
          errors.push({ row: rowNumber, field: column.label, message: `El campo “${column.label}” debe ser numérico.` });
        }
      } else if (column.type === 'strategic_relation') {
        const normVal = normalize(raw);
        const element = config.elements.find((entry) => [normalize(entry.code), normalize(entry.name), normalize(`${entry.code} ${entry.name}`)].includes(normVal));
        if (element) {
          value = element.code ? `${element.code} ${element.name}` : element.name;
          if (!payload.strategic_element_id) {
            payload.strategic_element_id = element.id;
          }
        } else {
          value = String(raw).trim();
        }
      } else if (column.catalogType) {
        value = String(raw).trim();
      }

      if (CORE_FIELDS.has(column.key)) {
        if (column.key === 'co_responsibles') {
          payload.co_responsibles = Array.isArray(value) ? value : String(value).split(',').map((p) => p.trim()).filter(Boolean);
        } else {
          payload[column.key] = value;
        }
      } else {
        payload.custom_values[column.key] = value;
      }
    }

    rows.push({ source_row: rowNumber, payload });
  }

  const record = await StrategicHistoricalImport.create({
    strategic_plan_id: config.plan.id,
    term_id: config.term.id,
    format_code: 'PED-DYNAMIC',
    format_version: config.schemaVersion,
    mapping: {
      action_plan_id: actionPlanId,
      columns: expectedColumns.map(({ key, label }) => ({ key, label }))
    },
    original_name: file.originalname,
    sha256: sha256(file.buffer),
    rows,
    errors,
    created_by: userId
  });

  return record;
};

const confirmDynamicActionItems = async ({ importId, req }) => {
  const batch = await StrategicHistoricalImport.findByPk(importId);
  if (!batch || batch.format_code !== 'PED-DYNAMIC' || batch.status !== 'preview') {
    throw Object.assign(new Error('La carga dinámica ya no está disponible o ya fue confirmada.'), { statusCode: 409 });
  }
  if ((batch.errors || []).length) {
    throw Object.assign(new Error('Corrija los errores de la plantilla antes de confirmar.'), { statusCode: 422 });
  }
  const actionPlan = await StrategicActionPlan.findByPk(batch.mapping?.action_plan_id);
  if (!actionPlan) throw Object.assign(new Error('Plan de Acción no encontrado.'), { statusCode: 404 });

  const savedItemIds = [];
  await sequelize.transaction(async (transaction) => {
    const existingList = await StrategicActionItem.findAll({
      where: { action_plan_id: actionPlan.id, deleted_at: null },
      attributes: ['id', 'code'],
      transaction
    });
    let maxSeq = 0;
    for (const it of existingList) {
      const match = String(it.code || '').match(/ACT-(\d+)/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxSeq) maxSeq = num;
      }
    }

    for (const row of batch.rows || []) {
      const payload = row.payload;
      let cleanItemCode = cleanCode(payload.code);
      if (!cleanItemCode) {
        maxSeq += 1;
        cleanItemCode = `ACT-${String(maxSeq).padStart(3, '0')}`;
      }
      const existing = await StrategicActionItem.findOne({
        where: { action_plan_id: actionPlan.id, code: cleanItemCode, deleted_at: null },
        transaction
      });
      const values = {
        ...payload,
        action_plan_id: actionPlan.id,
        code: cleanItemCode,
        updated_by: req.user.id
      };
      if (existing) {
        await StrategicActionItemVersion.create({
          action_item_id: existing.id,
          version: existing.version,
          snapshot: existing.toJSON(),
          justification: `Carga masiva Excel: ${batch.original_name}`,
          created_by: req.user.id
        }, { transaction });
        await existing.update({ ...values, version: Number(existing.version || 1) + 1 }, { transaction });
        savedItemIds.push(existing.id);
      } else {
        const created = await StrategicActionItem.create({ ...values, created_by: req.user.id }, { transaction });
        savedItemIds.push(created.id);
      }
    }
    await batch.update({ status: 'confirmed', confirmed_by: req.user.id, confirmed_at: new Date() }, { transaction });
    await audit(req, 'dynamic_items_import.confirm', 'historical_import', batch.id, null, { action_plan_id: actionPlan.id, rows: batch.rows.length }, null, transaction);
  });

  // Preparar de inmediato las carpetas en Drive para las actividades cargadas
  for (const itemId of savedItemIds) {
    ensureActivityFoldersInDrive(itemId).catch((err) => {
      console.warn('[Drive Dynamic Import Folder Warning]:', err.message);
    });
  }

  batch.setDataValue('term_id', actionPlan.term_id);
  batch.setDataValue('action_plan_id', actionPlan.id);
  batch.setDataValue('saved_count', savedItemIds.length);
  return batch;
};

module.exports = { buildDynamicActionItemWorkbook, previewDynamicActionItems, confirmDynamicActionItems };
