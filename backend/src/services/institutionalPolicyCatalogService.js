const XLSX = require('xlsx');

const clean = (value) => String(value ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const key = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');
const uniqueLines = (lines) => Array.from(new Map(lines.map((line) => [key(line), clean(line)])).values());

const parsePolicyWorkbook = (input, { withSummary = false } = {}) => {
  const workbook = XLSX.read(input, { type: 'buffer' });
  const policies = new Map();
  let recognizedSheets = 0;
  let processedRows = 0;
  for (const name of workbook.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' });
    const headerIndex = rows.findIndex((row) => row.some((cell) => ['politica', 'politicas', 'politicas institucionales'].includes(key(cell)))
      && row.some((cell) => ['lineas de accion', 'linea de accion'].includes(key(cell))));
    if (headerIndex < 0) continue;
    recognizedSheets += 1;
    const header = rows[headerIndex];
    const policyColumn = header.findIndex((cell) => ['politica', 'politicas', 'politicas institucionales'].includes(key(cell)));
    const lineColumn = header.findIndex((cell) => ['lineas de accion', 'linea de accion'].includes(key(cell)));
    for (let index = headerIndex + 1; index < rows.length; index += 1) {
      const policyName = clean(rows[index][policyColumn]);
      const line = clean(rows[index][lineColumn]);
      if (!policyName && !line) continue;
      if (!policyName || !line) throw Object.assign(new Error(`Complete política y línea de acción en ${name}, fila ${index + 1}.`), { status: 422 });
      processedRows += 1;
      const normalized = key(policyName);
      const policy = policies.get(normalized) || { name: policyName, normalized_key: normalized, actionLines: [] };
      policy.actionLines.push(line);
      policies.set(normalized, policy);
    }
  }
  if (!recognizedSheets || !policies.size) throw Object.assign(new Error('El Excel debe contener las columnas Políticas y Líneas de Acción y al menos una fila completa.'), { status: 422 });
  const result = Array.from(policies.values()).map((policy) => ({ ...policy, actionLines: uniqueLines(policy.actionLines) }));
  if (!withSummary) return result;
  const uniqueCount = result.reduce((sum, policy) => sum + policy.actionLines.length, 0);
  return { policies: result, processedRows, uniqueLines: uniqueCount, duplicateRows: processedRows - uniqueCount };
};

const importPolicies = async (policies, { source, userId = null, transaction: existingTransaction } = {}) => {
  const InstitutionalPolicy = require('../models/InstitutionalPolicy');
  const { sequelize } = require('../config/database');
  const apply = async (transaction) => {
    let created = 0;
    let addedLines = 0;
    for (const policy of policies) {
      const [row, isNew] = await InstitutionalPolicy.findOrCreate({
        where: { normalized_key: policy.normalized_key },
        defaults: { name: policy.name, action_lines: [], source, updated_by: userId }, transaction
      });
      await row.reload({ transaction, lock: transaction.LOCK.UPDATE });
      const merged = uniqueLines([...(row.action_lines || []), ...policy.actionLines]);
      created += isNew ? 1 : 0;
      addedLines += merged.length - (row.action_lines || []).length;
      await row.update({ action_lines: merged, source, updated_by: userId }, { transaction });
    }
    return { importedPolicies: policies.length, created, addedLines };
  };
  return existingTransaction ? apply(existingTransaction) : sequelize.transaction(apply);
};

const listPolicies = async () => {
  const InstitutionalPolicy = require('../models/InstitutionalPolicy');
  const rows = await InstitutionalPolicy.findAll({ order: [['name', 'ASC']] });
  return rows.map((row) => ({ id: row.id, name: row.name, actionLines: row.action_lines || [] }));
};

const preparePolicy = ({ name, actionLines = [] } = {}) => {
  if (typeof name !== 'string' || !clean(name) || clean(name).length > 1000
    || !Array.isArray(actionLines) || actionLines.some((line) => typeof line !== 'string' || !clean(line) || clean(line).length > 10000)) {
    throw Object.assign(new Error('Ingrese el nombre de la política y líneas de acción válidas.'), { status: 422 });
  }
  return { name: clean(name), normalized_key: key(name), actionLines: uniqueLines(actionLines) };
};

const seedInstitutionalPolicies = async () => {
  const InstitutionalPolicy = require('../models/InstitutionalPolicy');
  if (await InstitutionalPolicy.count()) return { skipped: true };
  const seed = require('../data/institutionalPolicies.json');
  return importPolicies(seed.map(preparePolicy), { source: 'POliticas_BD.xlsx - carga inicial' });
};

module.exports = { parsePolicyWorkbook, importPolicies, listPolicies, preparePolicy, seedInstitutionalPolicies };
