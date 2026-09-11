const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_WORKFLOW, DEFAULT_FIELDS } = require('./strategicPlanningBootstrap');
const { safeName } = require('./strategicPlanningDriveService');
const { normalize } = require('./strategicReferenceService');
const { buildPedSchedule } = require('./strategicPlanSetupService');

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
