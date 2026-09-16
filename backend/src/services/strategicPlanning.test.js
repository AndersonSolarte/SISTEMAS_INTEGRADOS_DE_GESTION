const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_WORKFLOW, DEFAULT_FIELDS } = require('./strategicPlanningBootstrap');
const { safeName } = require('./strategicPlanningDriveService');
const { normalize } = require('./strategicReferenceService');
const { buildPedSchedule } = require('./strategicPlanSetupService');
const ExcelJS = require('exceljs');
const { parseFieldSchemaWorkbook } = require('./strategicFieldSchemaService');
const { parseTermDependencyWorkbook, normalizeDocument } = require('./strategicTermDependencyService');
const { mapLegacyStatus } = require('./strategicLegacyActionPlanService');

test('workflow institucional contiene el recorrido completo y parametrizable', () => {
  assert.equal(DEFAULT_WORKFLOW.states[0].key, 'convocation');
  assert.equal(DEFAULT_WORKFLOW.states.at(-1).key, 'closed');
  assert.ok(DEFAULT_WORKFLOW.transitions.some((item) => item.from === 'technical_review' && item.to === 'adjustments'));
  assert.ok(DEFAULT_WORKFLOW.transitions.some((item) => item.from === 'owner_validation' && item.to === 'rectorate_notification'));
});

test('instrumento inicial conserva campos tipados del DIR-PE-FR-003', () => {
  assert.ok(DEFAULT_FIELDS.some((field) => field[0] === 'activity' && field[3]));
  assert.ok(DEFAULT_FIELDS.some((field) => field[0] === 'indicator'));
  assert.ok(DEFAULT_FIELDS.some((field) => field[0] === 'total_progress' && field[2] === 'formula'));
});

test('nombres Drive son cortos y compatibles con Windows', () => {
  const result = safeName('Dirección / Planeación: Evidencia * 2026?', 32);
  assert.ok(result.length <= 32);
  assert.doesNotMatch(result, /[<>:"/\\|?*]/);
  assert.match(result, /^Direccion-Planeacion/);
});

test('cruce de responsables tolera tildes, mayúsculas y espacios', () => {
  assert.equal(normalize('  MARÍA   DEL PILAR ÁGREDA  '), normalize('Maria del Pilar Agreda'));
});

test('configuración simple crea el rango y dos informes semestrales por vigencia', () => {
  const setup = buildPedSchedule({ startsOn: '2030-01-01', durationYears: 7 });
  assert.equal(setup.code, 'PED-2030-2037');
  assert.equal(setup.endsOn, '2037-12-31');
  assert.equal(setup.terms.length, 8);
  assert.deepEqual(setup.terms.map((term) => term.year), [2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037]);
  assert.ok(setup.terms.every((term) => term.periods.length === 2));
});

test('un formato Excel desconocido se convierte en campos dinámicos sin fijar objetivos', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('FORMATO LIBRE');
  sheet.addRow(['PLAN INSTITUCIONAL']);
  sheet.addRow([]);
  sheet.addRow(['No.', 'Proyecto especial', 'Fecha inicio', 'Avance %', 'Observaciones', 'Observaciones']);
  sheet.addRow([1, 'Laboratorios', new Date('2030-01-01T00:00:00Z'), 25, 'S1', 'S2']);
  const parsed = await parseFieldSchemaWorkbook(await workbook.xlsx.writeBuffer());
  assert.equal(parsed.header_row, 3);
  assert.equal(parsed.fields[0].include, false);
  assert.equal(parsed.fields.find((field) => field.label === 'Fecha inicio').data_type, 'date');
  assert.equal(parsed.fields.find((field) => field.label === 'Avance %').data_type, 'percentage');
  assert.ok(parsed.fields.some((field) => field.key === 'observaciones_2'));
  assert.ok(parsed.fields.some((field) => field.key === 'proyecto_especial'));
});

test('la plantilla anual conserva dependencia y cédula como texto', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('DEPENDENCIAS DEL AÑO');
  sheet.addRow(['DEPENDENCIA', 'CEDULA DEL RESPONSABLE']);
  sheet.addRow(['Rectoría', '0012345678']);
  const parsed = await parseTermDependencyWorkbook(await workbook.xlsx.writeBuffer());
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].dependency, 'Rectoría');
  assert.equal(parsed.rows[0].document, '0012345678');
  assert.equal(normalizeDocument('1.234.567.890'), '1234567890');
});

test('los estados de planes históricos se conservan al integrarlos al PED', () => {
  assert.equal(mapLegacyStatus('Aprobado'), 'active');
  assert.equal(mapLegacyStatus('Borrador'), 'convocation');
});
