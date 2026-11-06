const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const { writeActivityIndicators, readActivityIndicators } = require('./activityIndicatorWorkbookService');

test('each indicator start and end date survive export and import', async () => {
  const activity = { indicadorLogro: 'Entregas', metaLogro: '12 productos', indicadorLogroActivo: true, fechaInicioLogro: '2026-11-01', fechaFinLogro: '2026-12-10' };
  const book = new ExcelJS.Workbook();
  writeActivityIndicators(book, [{ codigo: 'OPM_01', actividades: [activity] }]);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await book.xlsx.writeBuffer());
  const objectives = [{ codigo: 'OPM_01', actividades: [{}] }];
  readActivityIndicators(reopened, objectives);
  assert.equal(objectives[0].actividades[0].fechaInicioLogro, activity.fechaInicioLogro);
  assert.equal(objectives[0].actividades[0].fechaFinLogro, activity.fechaFinLogro);
});

test('blank template includes all indicator storage columns without sample activity data', () => {
  const book = new ExcelJS.Workbook();
  writeActivityIndicators(book, []);
  const sheet = book.getWorksheet('INDICADORES');
  assert.equal(sheet.columnCount, 18);
  assert.equal(sheet.rowCount, 1);
  assert.equal(sheet.getCell('J1').value, 'FIN RESULTADO');
  assert.equal(sheet.getCell('O1').value, 'IMPACTO ACTIVO');
});

test('manually scheduled Excel dates import as ISO dates and empty flags stay optional', () => {
  const book = new ExcelJS.Workbook();
  writeActivityIndicators(book, []);
  const sheet = book.getWorksheet('INDICADORES');
  sheet.addRow(['OPM_01', 1, 'Actividad', 'Reportes', '', '', '12 reportes', '', '', new Date('2026-11-20T00:00:00Z'), '25/11/2026']);
  const objectives = [{ codigo: 'OPM_01', actividades: [{}] }];
  readActivityIndicators(book, objectives);
  assert.equal(objectives[0].actividades[0].fechaEntregaResultado, '2026-11-20');
  assert.equal(objectives[0].actividades[0].fechaEntregaLogro, '2026-11-25');
  const resolved = require('./activityIndicators').resolveActivityIndicators(objectives[0].actividades[0]);
  assert.equal(resolved.indicadorImpactoActivo, false);
});

test('delivery dates and removed indicator flags survive Excel round trip', async () => {
  const activity = { indicadorResultado: 'Reportes', indicadorResultadoActivo: false, fechaEntregaResultado: '2026-12-10', fechaEntregaLogro: '2026-12-11' };
  const book = new ExcelJS.Workbook();
  writeActivityIndicators(book, [{ codigo: 'OPM_01', actividades: [activity] }]);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await book.xlsx.writeBuffer());
  const objectives = [{ codigo: 'OPM_01', actividades: [{}] }];
  readActivityIndicators(reopened, objectives);
  const imported = objectives[0].actividades[0];
  assert.equal(imported.indicadorResultadoActivo, false);
  assert.equal(imported.indicadorLogroActivo, true);
  assert.equal(imported.fechaEntregaResultado, '2026-12-10');
  assert.equal(imported.fechaEntregaLogro, '2026-12-11');
  assert.equal(imported.indicadorResultado, 'Reportes');
  const { formatActivityIndicators } = require('./activityIndicators');
  assert.equal(formatActivityIndicators(imported), '');
});

test('three alphanumeric targets round-trip independently through Excel', async () => {
  const activity = { nombre: 'Actividad', metaResultado: '12 reportes', metaLogro: '90% de cobertura', metaImpacto: 'Nivel A2' };
  const book = new ExcelJS.Workbook();
  writeActivityIndicators(book, [{ codigo: 'OPM_01', actividades: [activity] }]);
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(await book.xlsx.writeBuffer());
  const objectives = [{ codigo: 'OPM_01', actividades: [{ nombre: 'Actividad' }] }];
  readActivityIndicators(reopened, objectives);
  for (const field of ['metaResultado', 'metaLogro', 'metaImpacto']) assert.equal(objectives[0].actividades[0][field], activity[field]);
});

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
