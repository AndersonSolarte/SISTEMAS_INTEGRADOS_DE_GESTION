const { test } = require('node:test');
const assert = require('node:assert/strict');
const { uniqueAspects, validateAspectAssignments } = require('./improvementAspectIdentity');
const first = { id: 1, factor: 'F1', caracteristica: 'C1', aspecto: 'A2. Análisis de necesidades' };
const duplicate = { ...first, id: 2, aspecto: ' A2. ANALISIS  de necesidades ' };
test('same aspect with different database IDs appears only once', () => {
  assert.deepEqual(uniqueAspects([first, duplicate]), [first]);
});
test('different characteristics or aspect texts remain separate', () => {
  assert.equal(uniqueAspects([first, { ...first, id: 2, caracteristica: 'C2' }, { ...first, id: 3, aspecto: 'A3. Otro aspecto' }]).length, 3);
});
test('rejects assigning a repeated aspect to different objectives without deleting data', () => {
  const objectives = [{ aspectosAutoevaluacion: [first] }, { aspectosAutoevaluacion: [duplicate] }];
  assert.throws(() => validateAspectAssignments(objectives), { status: 422 });
  assert.equal(objectives[1].aspectosAutoevaluacion[0].id, 2);
});
test('same aspect is accepted only once inside one objective', () => {
  assert.doesNotThrow(() => validateAspectAssignments([{ aspectosAutoevaluacion: [first, duplicate] }]));
});
