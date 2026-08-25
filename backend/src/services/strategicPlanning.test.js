const test = require('node:test');
const assert = require('node:assert/strict');
const { DEFAULT_WORKFLOW, DEFAULT_FIELDS } = require('./strategicPlanningBootstrap');
const { safeName } = require('./strategicPlanningDriveService');
const { normalize } = require('./strategicReferenceService');

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
