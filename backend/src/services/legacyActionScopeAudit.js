const { PlanAccion, StrategicActionPlan, StrategicActionItem, StrategicTerm, StrategicCatalogItem } = require('../models');
const { historicalYear, sourceScope, chooseLegacyUnit, normalize, preferredLegacyUnitIds } = require('./legacyActionScope');
const { isLegacyItem, indicatorText } = require('./legacyActionIdentity');
const identity = (row) => JSON.stringify([sourceScope(row), normalize(row.actividad), indicatorText(row.indicador, row, true), normalize(row.meta)]);
const counts = (rows) => {
  const result = new Map();
  for (const row of rows) { const key = identity(row); result.set(key, (result.get(key) || 0) + 1); }
  return result;
};

const auditLegacyActionScope = async ({ workbookPath = null } = {}) => {
  const source = (await PlanAccion.findAll({ where: { deleted_at: null }, raw: true })).filter((row) => historicalYear(row.anio));
  const plans = await StrategicActionPlan.findAll({ where: { deleted_at: null }, include: [
    { model: StrategicTerm, as: 'term', required: true },
    { model: StrategicCatalogItem, as: 'organizationalUnit', required: true },
    { model: StrategicActionItem, as: 'items', where: { deleted_at: null }, required: false }
  ] });
  const units = await StrategicCatalogItem.findAll({ where: { catalog_type: ['dependency', 'organizational_unit'] } });
  const expected = counts(source);
  const actual = [];
  const misplaced = [];
  let manual = 0;
  let futureImported = 0;
  for (const plan of plans) {
    for (const item of plan.items || []) {
      if (!isLegacyItem(item)) { manual++; continue; }
      if (!historicalYear(plan.term.year)) { futureImported++; continue; }
      const row = { anio: plan.term.year, responsable: item.custom_values?.responsible,
        actividad: item.activity, indicador: item.indicator, meta: item.target };
      actual.push(row);
      const unit = chooseLegacyUnit(units.filter((u) => u.strategic_plan_id === plan.term.strategic_plan_id), row.responsable,
        preferredLegacyUnitIds(plans, plan.term, row.responsable),
        preferredLegacyUnitIds(plans, plan.term, row.responsable, { officialOnly: true }));
      if (!unit || unit.id !== plan.catalog_item_id) misplaced.push({ plan: plan.code, item: item.code, owner: row.responsable });
    }
  }
  const observed = counts(actual);
  const differences = [...new Set([...expected.keys(), ...observed.keys()])].flatMap((key) => {
    const want = expected.get(key) || 0; const got = observed.get(key) || 0;
    return want === got ? [] : [{ identity: JSON.parse(key), expected: want, actual: got }];
  });
  let workbook = null;
  if (workbookPath) {
    const XLSX = require('xlsx');
    const book = XLSX.readFile(workbookPath);
    const sheet = book.SheetNames.find((name) => normalize(name).replace(/_/g, ' ') === 'plan de accion');
    if (!sheet) throw new Error('No se encontró la hoja PLAN DE ACCION.');
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheet], { header: 1, defval: null }).slice(1)
      .filter((row) => row.some((cell) => cell !== null))
      .map((row) => ({ anio: row[0], actividad: row[5], indicador: row[9], meta: row[10], responsable: row[11] }));
    const fileCounts = counts(rows);
    const mismatches = [...new Set([...fileCounts.keys(), ...expected.keys()])].filter((key) => (fileCounts.get(key) || 0) !== (expected.get(key) || 0)).length;
    workbook = { rows: rows.length, mismatchedIdentities: mismatches, invalidYears: rows.filter((row) => !historicalYear(row.anio)).length };
  }
  return { sourceRows: source.length, importedItems: actual.length, manualItems: manual, futureImported,
    misplaced, differences, workbook };
};
module.exports = { auditLegacyActionScope };
