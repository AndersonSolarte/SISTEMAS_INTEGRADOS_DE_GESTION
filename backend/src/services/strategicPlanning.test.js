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
const { validateAdministrativeActDate } = require('./strategicPlanDateValidationService');
const {
  repositoryName, compactFolderName, compactFileName, intersectsPeriod,
  buildRepositoryPeriods, buildOfficialWorkbook, buildActionRepositoryDriveAuth
} = require('./actionPlanRepositoryDriveService');

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

test('la fecha del acto administrativo parte desde el inicio del PED', () => {
  assert.doesNotThrow(() => validateAdministrativeActDate({ startsOn: '2022-01-01', approvedOn: '2022-01-01' }));
  assert.doesNotThrow(() => validateAdministrativeActDate({ startsOn: '2022-01-01', approvedOn: '2022-02-15' }));
  assert.doesNotThrow(() => validateAdministrativeActDate({ startsOn: '2022-01-01', approvedOn: null }));
  assert.throws(
    () => validateAdministrativeActDate({ startsOn: '2022-01-01', approvedOn: '2021-12-31' }),
    /no puede ser anterior a la fecha inicial del PED/
  );
});

test('el repositorio conserva nombres legibles y elimina caracteres no válidos', () => {
  assert.equal(repositoryName('ACT-01 / Gestión académica: 2027'), 'ACT-01 - Gestión académica- 2027');
});

test('cada actividad se ubica solamente en los periodos que intersecta', () => {
  const first = { starts_on: '2027-01-01', ends_on: '2027-07-31' };
  const second = { starts_on: '2027-08-01', ends_on: '2027-12-31' };
  assert.equal(intersectsPeriod({ starts_on: '2027-02-01', ends_on: '2027-04-30' }, first), true);
  assert.equal(intersectsPeriod({ starts_on: '2027-02-01', ends_on: '2027-04-30' }, second), false);
  assert.equal(intersectsPeriod({ starts_on: null, ends_on: null }, second), true);
});

test('el repositorio divide cada vigencia en enero-julio y agosto-diciembre', () => {
  const periods = buildRepositoryPeriods({
    year: 2027,
    monitoringPeriods: [
      { id: 's1', position: 1, starts_on: '2027-01-01', ends_on: '2027-06-30' },
      { id: 's2', position: 2, starts_on: '2027-07-01', ends_on: '2027-12-31' }
    ]
  });
  assert.equal(periods[0].ends_on, '2027-07-31');
  assert.equal(periods[1].starts_on, '2027-08-01');
});

test('las rutas del repositorio usan nombres compactos aptos para copiar a disco', () => {
  const folder = compactFolderName('ACT-001', 'Diseñar e implementar una estrategia institucional extremadamente extensa para todas las dependencias', 48);
  const file = compactFileName('Evidencia final consolidada con anexos y soportes documentales de toda la actividad institucional.xlsx', 'EV-12345678', 64);
  assert.ok(folder.length <= 48);
  assert.ok(folder.startsWith('ACT-001_'));
  assert.ok(file.length <= 64);
  assert.ok(file.endsWith('.xlsx'));
});

test('el repositorio genera el Excel oficial con las actividades del plan', async () => {
  const buffer = await buildOfficialWorkbook({
    code: '2026-R74',
    term: { year: 2026 },
    organizationalUnit: { name: 'Área de Acompañamiento Integral' },
    items: [{
      activity: 'Diseñar rúbricas de evaluación',
      indicator_type: 'Gestión',
      starts_on: '2026-01-15',
      ends_on: '2026-06-30',
      indicator: 'Rúbricas implementadas',
      target: '1',
      co_responsibles: [],
      custom_values: {},
      monitoringResults: []
    }]
  });
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
});

test('el repositorio usa exclusivamente el OAuth de Planes de Acción', () => {
  const keys = ['PLAN_ACTION_GOOGLE_CLIENT_ID', 'PLAN_ACTION_GOOGLE_CLIENT_SECRET', 'PLAN_ACTION_GOOGLE_REFRESH_TOKEN'];
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  process.env.PLAN_ACTION_GOOGLE_CLIENT_ID = 'plan-action-client';
  process.env.PLAN_ACTION_GOOGLE_CLIENT_SECRET = 'plan-action-secret';
  process.env.PLAN_ACTION_GOOGLE_REFRESH_TOKEN = 'plan-action-refresh';
  try {
    const auth = buildActionRepositoryDriveAuth();
    assert.equal(auth._clientId, 'plan-action-client');
    assert.equal(auth._clientSecret, 'plan-action-secret');
    assert.equal(auth.credentials.refresh_token, 'plan-action-refresh');
  } finally {
    keys.forEach((key) => {
      if (previous[key] === undefined) delete process.env[key];
      else process.env[key] = previous[key];
    });
  }
});
