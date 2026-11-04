const XLSX = require('xlsx');
const { sequelize } = require('../config/database');
const { GestionInformacionCarga } = require('../models');
const catalog = require('../services/institutionalPolicyCatalogService');

const headers = ['Políticas', 'Líneas de Acción'];
const buildWorkbook = (policies = []) => {
  const rows = [headers, ...policies.flatMap((policy) => policy.actionLines.map((line) => [policy.name, line]))];
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = [{ wch: 65 }, { wch: 100 }];
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, 'Políticas institucionales');
  return book;
};
const sendWorkbook = (res, policies, filename, format = 'xlsx') => {
  const book = buildWorkbook(policies);
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.${format}"`);
  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    return res.send(`\uFEFF${XLSX.utils.sheet_to_csv(book.Sheets[book.SheetNames[0]])}`);
  }
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(XLSX.write(book, { type: 'buffer', bookType: 'xlsx' }));
};

const list = async (_req, res) => {
  try { return res.json({ success: true, data: await catalog.listPolicies() }); }
  catch { return res.status(500).json({ success: false, message: 'No fue posible consultar las políticas institucionales.' }); }
};
const template = (_req, res) => sendWorkbook(res, [], 'plantilla_politicas_institucionales');
const exportData = async (req, res) => {
  const format = String(req.query.format || 'xlsx').toLowerCase();
  if (!['xlsx', 'csv', 'json'].includes(format)) return res.status(422).json({ success: false, message: 'Formato no permitido.' });
  try {
    const policies = await catalog.listPolicies();
    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="politicas_institucionales.json"');
      return res.send(JSON.stringify(policies, null, 2));
    }
    return sendWorkbook(res, policies, 'politicas_institucionales', format);
  } catch { return res.status(500).json({ success: false, message: 'No fue posible exportar las políticas.' }); }
};
const importData = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(422).json({ success: false, message: 'Adjunte un archivo Excel o CSV.' });
    const parsed = catalog.parsePolicyWorkbook(req.file.buffer, { withSummary: true });
    const { policies, processedRows, uniqueLines, duplicateRows } = parsed;
    const summary = await sequelize.transaction(async (transaction) => {
      const result = await catalog.importPolicies(policies, { source: req.file.originalname, userId: req.user.id, transaction });
      await GestionInformacionCarga.create({ categoria: 'Políticas institucionales', variable: 'Políticas y líneas de acción',
        archivo_nombre: req.file.originalname, total_plantilla: processedRows, total_cargados: processedRows,
        total_omitidos: 0, porcentaje_cargado: 100, estado: 'completo', creado_por: req.user.id,
        detalle: JSON.stringify({ ...result, processedRows, uniqueLines, duplicateRows }) }, { transaction });
      return result;
    });
    const outcome = summary.addedLines === 0 && summary.created === 0
      ? 'Ya estaban registradas; no se duplicaron.'
      : `${summary.created} políticas nuevas y ${summary.addedLines} líneas nuevas.`;
    return res.json({ success: true,
      message: `Archivo completo: ${summary.importedPolicies} políticas y ${uniqueLines} líneas verificadas. ${outcome}`,
      data: { ...summary, processedRows, uniqueLines, duplicateRows } });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.status ? error.message : 'No fue posible compilar las políticas institucionales.' });
  }
};

module.exports = { list, template, importData, exportData, buildWorkbook };
