const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { writeActivityIndicators, readActivityIndicators } = require('./activityIndicatorWorkbookService');

test('Resultado, Logro and Impacto survive Excel export and reimport per activity', async () => {
  const objectives = [
    { codigo: 'OPM_01', actividades: [
      { nombre: 'Actividad', tipoIndicador: 'Resultado', indicador: 'Número de informes' },
      { nombre: 'Actividad', tipoIndicador: 'Logro', indicador: 'Porcentaje de cumplimiento' }
    ] },
    { codigo: 'OPM_02', actividades: [{ nombre: 'Actividad', tipoIndicador: 'Impacto', indicador: 'Cambio observado' }] }
  ];
  const exported = new ExcelJS.Workbook();
  writeActivityIndicators(exported, objectives);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await exported.xlsx.writeBuffer());
  const imported = objectives.map((objective) => ({ codigo: objective.codigo, actividades: objective.actividades.map((activity) => ({ nombre: activity.nombre })) }));
  readActivityIndicators(reopened, imported);
  assert.equal(imported[0].actividades[0].indicadorResultado, 'Número de informes');
  assert.equal(imported[0].actividades[1].indicadorLogro, 'Porcentaje de cumplimiento');
  assert.equal(imported[1].actividades[0].indicadorImpacto, 'Cambio observado');
  assert.equal(reopened.getWorksheet('INDICADORES').getCell('F4').value, 'Cambio observado');
});

test('old activities export as Resultado and old workbooks remain importable', () => {
  const book = new ExcelJS.Workbook();
  const objectives = [{ codigo: 'OPM_01', actividades: [{ nombre: 'Actividad anterior', indicador: 'Indicador existente' }] }];
  readActivityIndicators(book, objectives);
  assert.equal(objectives[0].actividades[0].indicador, 'Indicador existente');
  writeActivityIndicators(book, objectives);
  assert.equal(book.getWorksheet('INDICADORES').getCell('D2').value, 'Indicador existente');
});

test('one activity retains three independently authored indicators after an Excel round trip', async () => {
  const activity = { nombre: 'Reportes', indicadorResultado: 'Reportes entregados', indicadorLogro: 'Cumplimiento de la meta', indicadorImpacto: 'Mejora en la toma de decisiones' };
  const book = new ExcelJS.Workbook();
  writeActivityIndicators(book, [{ codigo: 'OPM_01', actividades: [activity] }]);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await book.xlsx.writeBuffer());
  const imported = [{ codigo: 'OPM_01', actividades: [{ nombre: 'Reportes' }] }];
  readActivityIndicators(reopened, imported);
  for (const field of ['indicadorResultado', 'indicadorLogro', 'indicadorImpacto']) assert.equal(imported[0].actividades[0][field], activity[field]);
});

test('old single type Excel files are migrated into the matching text field', () => {
  const book = new ExcelJS.Workbook();
  const sheet = book.addWorksheet('INDICADORES');
  sheet.addRow(['OBJETIVO', 'NÚMERO ACTIVIDAD', 'ACTIVIDAD', 'TIPO DE INDICADOR', 'INDICADOR']);
  sheet.addRow(['OPM_01', 1, 'Actividad', 'Logro', 'Texto anterior de logro']);
  const objectives = [{ codigo: 'OPM_01', actividades: [{ nombre: 'Actividad' }] }];
  readActivityIndicators(book, objectives);
  assert.equal(objectives[0].actividades[0].indicadorLogro, 'Texto anterior de logro');
  assert.equal(objectives[0].actividades[0].indicadorResultado, '');
});
