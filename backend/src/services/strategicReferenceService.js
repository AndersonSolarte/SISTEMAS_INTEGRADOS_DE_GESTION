const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const {
  User, StrategicPlan, StrategicLevel, StrategicElement, StrategicTerm,
  StrategicCatalogItem, StrategicResponsibility, StrategicReferenceImport
} = require('../models');
const { sha256, cleanCode } = require('./strategicPlanningDomainService');

const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, ' ').trim().toLowerCase();
const splitCode = (value, fallbackPrefix, index) => {
  const raw = String(value || '').replace(/\s+/g, ' ').trim();
  const match = raw.match(/^([A-Za-z]{1,5}[- ]?\d{1,4})\s+(.+)$/);
  return match ? { code: cleanCode(match[1]), name: match[2].trim() } : { code: `${fallbackPrefix}-${String(index + 1).padStart(3, '0')}`, name: raw };
};
const values = (sheet, start = 2) => {
  const rows = [];
  if (!sheet) return rows;
  for (let row = start; row <= sheet.rowCount; row += 1) {
    const value = String(sheet.getCell(row, 1).value || '').replace(/\s+/g, ' ').trim();
    if (value) rows.push(value);
  }
  return rows;
};

const parseReferenceWorkbook = async (buffer) => {
  const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const get = (wanted) => workbook.worksheets.find((sheet) => normalize(sheet.name) === normalize(wanted));
  const dependenciesSheet = get('DEPENDENCIAS'); const dependencies = [];
  if (dependenciesSheet) for (let row = 2; row <= dependenciesSheet.rowCount; row += 1) {
    const code = cleanCode(dependenciesSheet.getCell(row, 1).value, `DEP-${row}`);
    const name = String(dependenciesSheet.getCell(row, 2).value || '').replace(/\s+/g, ' ').trim();
    const leaderName = String(dependenciesSheet.getCell(row, 3).value || '').replace(/\s+/g, ' ').trim();
    if (name) dependencies.push({ code, name, leader_name: leaderName });
  }
  return {
    dependencies,
    macroactivities: values(get('MACROACTIVIDADES'), 3).map((v, i) => splitCode(v, 'A', i)),
    objectives: values(get('OBJETIVOSESTRATEGICOS'), 2).map((v, i) => splitCode(v, 'OE', i)),
    guidelines: values(get('LINEAMIENTOSESTRATEGICOS'), 2).map((v, i) => splitCode(v, 'LE', i)),
    years: values(get('AÑOS'), 2).map(Number).filter(Number.isFinite),
    statuses: values(get('ESTADOS'), 2).map((name, i) => ({ code: `EST-${i + 1}`, name })),
    meeting_locations: values(get('LUGARES'), 2).map((name, i) => ({ code: `LUG-${String(i + 1).padStart(2, '0')}`, name }))
  };
};

const previewReferenceImport = async ({ strategicPlanId, file, userId }) => {
  const parsed = await parseReferenceWorkbook(file.buffer);
  const users = await User.findAll({ where: { estado: 'activo' }, attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo'], raw: true });
  const byName = new Map(users.map((user) => [normalize(user.nombre), user]));
  const warnings = [];
  const dependencies = parsed.dependencies.map((dependency) => {
    const match = byName.get(normalize(dependency.leader_name));
    if (!match && dependency.leader_name) warnings.push({ type: 'leader_without_user', code: dependency.code, dependency: dependency.name, leader_name: dependency.leader_name });
    return { ...dependency, matched_user: match || null };
  });
  const parsedData = { ...parsed, dependencies };
  return StrategicReferenceImport.create({
    strategic_plan_id: strategicPlanId, original_name: file.originalname, sha256: sha256(file.buffer),
    parsed_data: parsedData, warnings, created_by: userId,
    summary: { dependencies: dependencies.length, matched_leaders: dependencies.filter((d) => d.matched_user).length, unmatched_leaders: warnings.length, macroactivities: parsed.macroactivities.length, objectives: parsed.objectives.length, guidelines: parsed.guidelines.length, years: parsed.years.length, statuses: parsed.statuses.length, meeting_locations: parsed.meeting_locations.length }
  });
};

const upsertCatalog = (transaction, planId, type, item, metadata = {}) => StrategicCatalogItem.findOrCreate({
  where: { strategic_plan_id: planId, catalog_type: type, code: item.code },
  defaults: { strategic_plan_id: planId, catalog_type: type, code: item.code, name: item.name, metadata, active: true }, transaction
}).then(async ([record, created]) => {
  if (!created) await record.update({ name: item.name, metadata: { ...(record.metadata || {}), ...metadata }, active: true }, { transaction });
  return record;
});

const deactivateDuplicateUnits = async (planId, transaction = null) => {
  const units = await StrategicCatalogItem.findAll({ where: { strategic_plan_id: planId, catalog_type: 'organizational_unit', active: true }, transaction });
  const officialByName = new Map(units.filter((unit) => /^R\d+/i.test(unit.code)).map((unit) => [normalize(unit.name), unit]));
  let deactivated = 0;
  for (const unit of units) {
    const official = officialByName.get(normalize(unit.name));
    if (official && official.id !== unit.id && /^DEP-/i.test(unit.code)) {
      await unit.update({ active: false, metadata: { ...(unit.metadata || {}), superseded_by: official.id, superseded_reason: 'Código oficial importado desde tablas de referencia' } }, { transaction });
      deactivated += 1;
    }
  }
  return deactivated;
};

const confirmReferenceImport = async ({ importId, userId }) => sequelize.transaction(async (transaction) => {
  const batch = await StrategicReferenceImport.findByPk(importId, { transaction, lock: transaction.LOCK.UPDATE });
  if (!batch || batch.status !== 'preview') throw Object.assign(new Error('La importación ya no está disponible para confirmar.'), { statusCode: 409 });
  const plan = await StrategicPlan.findByPk(batch.strategic_plan_id, { transaction });
  const levels = await StrategicLevel.findAll({ where: { strategic_plan_id: plan.id, active: true }, order: [['position', 'ASC']], transaction });
  const objectiveLevel = levels[0]; const guidelineLevel = levels[1];
  if (!objectiveLevel || !guidelineLevel) throw Object.assign(new Error('El PED necesita al menos dos niveles para importar objetivos y lineamientos.'), { statusCode: 422 });
  const parsed = batch.parsed_data;
  for (const [position, item] of parsed.objectives.entries()) await StrategicElement.findOrCreate({ where: { strategic_plan_id: plan.id, code: item.code, version: plan.configuration_version }, defaults: { strategic_plan_id: plan.id, level_id: objectiveLevel.id, code: item.code, name: item.name, position: position + 1, version: plan.configuration_version }, transaction });
  for (const [position, item] of parsed.guidelines.entries()) await StrategicElement.findOrCreate({ where: { strategic_plan_id: plan.id, code: item.code, version: plan.configuration_version }, defaults: { strategic_plan_id: plan.id, level_id: guidelineLevel.id, code: item.code, name: item.name, position: position + 1, version: plan.configuration_version }, transaction });
  for (const item of parsed.macroactivities) await upsertCatalog(transaction, plan.id, 'macroactivity', item);
  for (const item of parsed.statuses) await upsertCatalog(transaction, plan.id, 'reference_status', item);
  for (const item of parsed.meeting_locations) await upsertCatalog(transaction, plan.id, 'meeting_location', item);
  for (const dependency of parsed.dependencies) {
    const user = dependency.matched_user;
    const unit = await upsertCatalog(transaction, plan.id, 'organizational_unit', dependency, { source: 'TABLAS DE REFERENCIA', reference_leader_name: dependency.leader_name, matched_user_id: user?.id || null, matched_email: user?.email || null });
    let position = null;
    if (user?.cargo) position = await upsertCatalog(transaction, plan.id, 'position', { code: `CAR-${cleanCode(user.cargo).slice(0, 45)}`, name: user.cargo });
    if (user) {
      for (const year of parsed.years) {
        const term = await StrategicTerm.findOne({ where: { strategic_plan_id: plan.id, year }, transaction });
        if (!term) continue;
        await StrategicResponsibility.findOrCreate({ where: { term_id: term.id, catalog_item_id: unit.id, action_plan_id: null, responsibility_type: 'reference_leader', status: 'active' }, defaults: { term_id: term.id, catalog_item_id: unit.id, position_catalog_item_id: position?.id || null, user_id: user.id, responsibility_type: 'reference_leader', starts_on: term.starts_on, ends_on: term.ends_on, status: 'active', created_by: userId }, transaction });
      }
    }
  }
  // Los cargos y actores permanecen dinámicos aunque no aparezcan como líderes en el archivo.
  const allUsers = await User.findAll({ where: { estado: 'activo' }, attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo'], transaction, raw: true });
  for (const user of allUsers) {
    if (user.cargo) await upsertCatalog(transaction, plan.id, 'position', { code: `CAR-${cleanCode(user.cargo).slice(0, 45)}`, name: user.cargo });
    await upsertCatalog(transaction, plan.id, 'actor', { code: `USR-${user.id}`, name: user.nombre }, { user_id: user.id, email: user.email, dependency: user.dependencia, position: user.cargo });
  }
  await deactivateDuplicateUnits(plan.id, transaction);
  await batch.update({ status: 'confirmed', confirmed_by: userId, confirmed_at: new Date() }, { transaction });
  return batch;
});

module.exports = { normalize, parseReferenceWorkbook, previewReferenceImport, confirmReferenceImport, deactivateDuplicateUnits };
