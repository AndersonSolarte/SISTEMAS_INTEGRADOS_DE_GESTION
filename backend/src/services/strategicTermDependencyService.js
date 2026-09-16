const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User, StrategicPlan, StrategicTerm, StrategicCatalogItem, StrategicResponsibility,
  StrategicActionPlan, StrategicReferenceImport
} = require('../models');
const { sha256, cleanCode } = require('./strategicPlanningDomainService');
const { ensureAnnualDependenciesForActionPlans } = require('./strategicLegacyActionPlanService');

const normalizeText = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
const normalizeDocument = (value) => String(value ?? '').trim().replace(/\.0$/, '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
const cellText = (cell) => String(cell?.text || cell?.value || '').replace(/\s+/g, ' ').trim();

const getTerm = async (termId, transaction) => {
  const term = await StrategicTerm.findByPk(termId, { transaction });
  if (!term) throw Object.assign(new Error('Vigencia no encontrada.'), { statusCode: 404 });
  return term;
};

const serializeAssignment = (row) => ({
  id: row.id,
  term_id: row.term_id,
  dependency: row.organizationalUnit ? {
    id: row.organizationalUnit.id, code: row.organizationalUnit.code, name: row.organizationalUnit.name
  } : null,
  responsible: row.responsibleUser ? {
    id: row.responsibleUser.id, document: row.responsibleUser.username, name: row.responsibleUser.nombre,
    email: row.responsibleUser.email, dependency: row.responsibleUser.dependencia, position: row.responsibleUser.cargo
  } : null
});

const listTermDependencies = async ({ planId, termId }) => {
  await ensureAnnualDependenciesForActionPlans({ planId });
  const where = { action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' };
  if (termId) {
    const term = await StrategicTerm.findOne({ where: { id: termId, ...(planId ? { strategic_plan_id: planId } : {}) }, attributes: ['id'], raw: true });
    if (!term) return [];
    where.term_id = term.id;
  }
  else {
    const terms = await StrategicTerm.findAll({ where: { strategic_plan_id: planId }, attributes: ['id'], raw: true });
    where.term_id = { [Op.in]: terms.map((term) => term.id) };
  }
  if (where.term_id?.[Op.in]?.length === 0) return [];
  const rows = await StrategicResponsibility.findAll({
    where,
    include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit', required: true },
      { model: User, as: 'responsibleUser', required: true, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'] }
    ],
    order: [[{ model: StrategicCatalogItem, as: 'organizationalUnit' }, 'name', 'ASC']]
  });
  return rows.map(serializeAssignment);
};

const parseTermDependencyWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets.find((item) => normalizeText(item.name) === 'dependencias del ano') || workbook.worksheets[0];
  if (!sheet) throw Object.assign(new Error('El archivo no contiene hojas.'), { statusCode: 422 });
  let headerRow = 0; let dependencyColumn = 0; let documentColumn = 0;
  for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 15); rowNumber += 1) {
    sheet.getRow(rowNumber).eachCell((cell, columnNumber) => {
      const header = normalizeText(cellText(cell));
      if (['dependencia', 'nombre dependencia', 'nombre de la dependencia'].includes(header)) dependencyColumn = columnNumber;
      if (['cedula', 'cedula responsable', 'cedula del responsable', 'documento responsable', 'documento del responsable'].includes(header)) documentColumn = columnNumber;
    });
    if (dependencyColumn && documentColumn) { headerRow = rowNumber; break; }
  }
  if (!headerRow) throw Object.assign(new Error('La plantilla debe conservar las columnas DEPENDENCIA y CEDULA DEL RESPONSABLE.'), { statusCode: 422 });
  const rows = [];
  for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const dependency = cellText(sheet.getCell(rowNumber, dependencyColumn));
    const document = normalizeDocument(cellText(sheet.getCell(rowNumber, documentColumn)));
    if (dependency || document) rows.push({ row_number: rowNumber, dependency, document });
  }
  return { sheet_name: sheet.name, header_row: headerRow, rows };
};

const buildTermDependencyWorkbook = async (termId) => {
  const term = await getTerm(termId);
  const plan = await StrategicPlan.findByPk(term.strategic_plan_id);
  const assignments = await listTermDependencies({ termId });
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIAC UNICESMAG';
  const instructions = workbook.addWorksheet('INSTRUCCIONES');
  instructions.addRows([
    [`DEPENDENCIAS DE LA VIGENCIA ${term.year}`, plan?.name || 'Plan Estrat\u00e9gico de Desarrollo'],
    ['1', 'Escriba una fila por cada dependencia que participar\u00e1 en esta vigencia.'],
    ['2', 'Digite la c\u00e9dula del responsable tal como est\u00e1 registrada en SIAC.'],
    ['3', 'Al subir el archivo, SIAC mostrar\u00e1 nombre, cargo y correo antes de guardar.'],
    ['Importante', 'La carga reemplaza la lista de esta vigencia. Las otras vigencias no cambian.']
  ]);
  instructions.getColumn(1).width = 20; instructions.getColumn(2).width = 95;
  const sheet = workbook.addWorksheet('DEPENDENCIAS DEL A\u00d1O');
  sheet.addRow(['DEPENDENCIA', 'CEDULA DEL RESPONSABLE']);
  assignments.forEach((assignment) => sheet.addRow([assignment.dependency?.name || '', assignment.responsible?.document || '']));
  if (!assignments.length) {
    sheet.addRow(['', '']);
    sheet.getCell('A2').note = 'Ejemplo: Rector\u00eda';
    sheet.getCell('B2').note = 'Digite la c\u00e9dula registrada en SIAC.';
  }
  sheet.columns = [{ width: 52 }, { width: 28 }];
  sheet.getColumn(2).numFmt = '@';
  [instructions.getRow(1), sheet.getRow(1)].forEach((row) => {
    row.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2563EB' } };
    row.height = 24;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = 'A1:B1';
  return workbook.xlsx.writeBuffer();
};

const hydrateRows = async (parsed) => {
  const users = await User.findAll({ where: { estado: 'activo' }, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'], raw: true });
  const usersByDocument = new Map(users.map((user) => [normalizeDocument(user.username), user]));
  const seenDependencies = new Set();
  return parsed.rows.map((row) => {
    const errors = [];
    const dependencyKey = normalizeText(row.dependency);
    const responsible = usersByDocument.get(row.document) || null;
    if (!row.dependency) errors.push('Escriba la dependencia.');
    if (!row.document) errors.push('Escriba la c\u00e9dula del responsable.');
    else if (!responsible) errors.push('La c\u00e9dula no corresponde a un usuario activo de SIAC.');
    if (dependencyKey && seenDependencies.has(dependencyKey)) errors.push('La dependencia est\u00e1 repetida en el archivo.');
    seenDependencies.add(dependencyKey);
    return { ...row, responsible, errors };
  });
};

const previewTermDependencyImport = async ({ termId, file, userId }) => {
  const term = await getTerm(termId);
  const parsed = await parseTermDependencyWorkbook(file.buffer);
  const rows = await hydrateRows(parsed);
  const errors = rows.flatMap((row) => row.errors.map((message) => ({ row: row.row_number, message })));
  return StrategicReferenceImport.create({
    strategic_plan_id: term.strategic_plan_id, original_name: file.originalname, sha256: sha256(file.buffer),
    parsed_data: { kind: 'term_dependencies', term_id: term.id, year: term.year, sheet_name: parsed.sheet_name, rows },
    warnings: errors, created_by: userId,
    summary: { year: term.year, rows: rows.length, matched: rows.filter((row) => row.responsible && !row.errors.length).length, errors: errors.length }
  });
};

const ensureUnit = async ({ planId, dependencyName, transaction }) => {
  const units = await StrategicCatalogItem.findAll({ where: { strategic_plan_id: planId, catalog_type: 'organizational_unit' }, transaction });
  const existing = units.find((unit) => normalizeText(unit.name) === normalizeText(dependencyName));
  if (existing) { if (!existing.active) await existing.update({ active: true }, { transaction }); return existing; }
  const base = cleanCode(dependencyName).slice(0, 44) || 'DEPENDENCIA';
  let code = `DEP-${base}`; let suffix = 1;
  while (await StrategicCatalogItem.count({ where: { strategic_plan_id: planId, catalog_type: 'organizational_unit', code }, transaction })) code = `DEP-${base.slice(0, 40)}-${suffix++}`;
  return StrategicCatalogItem.create({ strategic_plan_id: planId, catalog_type: 'organizational_unit', code, name: dependencyName, metadata: { source: 'DEPENDENCIAS_POR_VIGENCIA' }, active: true }, { transaction });
};

const ensurePosition = async ({ planId, positionName, transaction }) => {
  if (!positionName) return null;
  const code = `CAR-${cleanCode(positionName).slice(0, 45)}`;
  const [position] = await StrategicCatalogItem.findOrCreate({ where: { strategic_plan_id: planId, catalog_type: 'position', code }, defaults: { strategic_plan_id: planId, catalog_type: 'position', code, name: positionName, active: true }, transaction });
  return position;
};

const saveAssignment = async ({ term, dependencyName, user, userId, transaction }) => {
  const unit = await ensureUnit({ planId: term.strategic_plan_id, dependencyName, transaction });
  const position = await ensurePosition({ planId: term.strategic_plan_id, positionName: user.cargo, transaction });
  let assignment = await StrategicResponsibility.findOne({ where: { term_id: term.id, catalog_item_id: unit.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' }, transaction });
  const values = { position_catalog_item_id: position?.id || null, user_id: user.id, starts_on: term.starts_on, ends_on: term.ends_on };
  if (assignment) await assignment.update(values, { transaction });
  else assignment = await StrategicResponsibility.create({ term_id: term.id, catalog_item_id: unit.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active', created_by: userId, ...values }, { transaction });
  return { assignment, unit };
};

const confirmTermDependencyImport = async ({ importId, userId }) => sequelize.transaction(async (transaction) => {
  const batch = await StrategicReferenceImport.findByPk(importId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!batch || batch.status !== 'preview' || batch.parsed_data?.kind !== 'term_dependencies') throw Object.assign(new Error('Esta importaci\u00f3n ya no est\u00e1 disponible.'), { statusCode: 409 });
  if (batch.summary?.errors) throw Object.assign(new Error('Corrija las filas indicadas antes de confirmar.'), { statusCode: 422 });
  const term = await getTerm(batch.parsed_data.term_id, transaction);
  const retainedUnitIds = [];
  for (const row of batch.parsed_data.rows) {
    const user = await User.findOne({ where: { id: row.responsible.id, estado: 'activo' }, transaction });
    const saved = await saveAssignment({ term, dependencyName: row.dependency, user, userId, transaction });
    retainedUnitIds.push(saved.unit.id);
  }
  const previous = await StrategicResponsibility.findAll({ where: { term_id: term.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active', ...(retainedUnitIds.length ? { catalog_item_id: { [Op.notIn]: retainedUnitIds } } : {}) }, transaction });
  let protectedCount = 0;
  for (const assignment of previous) {
    const hasPlan = await StrategicActionPlan.count({ where: { term_id: term.id, catalog_item_id: assignment.catalog_item_id, deleted_at: null }, transaction });
    if (hasPlan) protectedCount += 1;
    else await assignment.update({ status: 'inactive', ends_on: new Date().toISOString().slice(0, 10), ended_by: userId }, { transaction });
  }
  await batch.update({ status: 'confirmed', confirmed_by: userId, confirmed_at: new Date(), summary: { ...batch.summary, protected: protectedCount } }, { transaction });
  return batch;
});

const addTermDependency = async ({ termId, dependencyName, document, userId }) => sequelize.transaction(async (transaction) => {
  const term = await getTerm(termId, transaction);
  const normalizedDocument = normalizeDocument(document);
  const users = await User.findAll({ where: { estado: 'activo' }, transaction });
  const user = users.find((item) => normalizeDocument(item.username) === normalizedDocument);
  if (!String(dependencyName || '').trim()) throw Object.assign(new Error('Escriba el nombre de la dependencia.'), { statusCode: 422 });
  if (!user) throw Object.assign(new Error('La c\u00e9dula no corresponde a un usuario activo de SIAC.'), { statusCode: 422 });
  const saved = await saveAssignment({ term, dependencyName: String(dependencyName).trim(), user, userId, transaction });
  const hydrated = await StrategicResponsibility.findByPk(saved.assignment.id, { include: [{ model: StrategicCatalogItem, as: 'organizationalUnit' }, { model: User, as: 'responsibleUser' }], transaction });
  return serializeAssignment(hydrated);
});

const removeTermDependency = async ({ termId, assignmentId, userId }) => sequelize.transaction(async (transaction) => {
  const assignment = await StrategicResponsibility.findOne({ where: { id: assignmentId, term_id: termId, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' }, transaction });
  if (!assignment) throw Object.assign(new Error('Asignaci\u00f3n no encontrada.'), { statusCode: 404 });
  const hasPlan = await StrategicActionPlan.count({ where: { term_id: termId, catalog_item_id: assignment.catalog_item_id, deleted_at: null }, transaction });
  if (hasPlan) throw Object.assign(new Error('No puede retirar esta dependencia porque ya tiene un Plan de Acci\u00f3n en la vigencia.'), { statusCode: 409 });
  await assignment.update({ status: 'inactive', ends_on: new Date().toISOString().slice(0, 10), ended_by: userId }, { transaction });
  return { id: assignment.id };
});

module.exports = {
  normalizeDocument, parseTermDependencyWorkbook, listTermDependencies, buildTermDependencyWorkbook,
  previewTermDependencyImport, confirmTermDependencyImport, addTermDependency, removeTermDependency
};
