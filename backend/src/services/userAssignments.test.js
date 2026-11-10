const test = require('node:test');
const assert = require('node:assert/strict');
const { getUserAssignments, validateAssignments, applySelectedAssignment } = require('./userAssignments');
const { DEPENDENCY_EMAILS_RAW } = require('../config/dependencyEmails');
const [first, second] = Object.keys(DEPENDENCY_EMAILS_RAW);
const primary = { dependencia: first, vicerrectoria: 'Académica', jefe_inmediato: 'Jefe A' };
const extra = { dependencia: second, vicerrectoria: 'Investigación', jefe_inmediato: 'Jefe B' };
const user = { ...primary, cargo: 'Docente', dependencias_asignadas: [extra] };

test('conserva perfiles anteriores y elimina dependencias duplicadas', () => {
  assert.deepEqual(getUserAssignments(primary), [primary]);
  assert.deepEqual(getUserAssignments({ ...primary, dependencias_asignadas: [primary, extra] }), [primary, extra]);
  assert.deepEqual(getUserAssignments({}), []);
});
test('valida catálogo, duplicados, estructura y jefe por dependencia', () => {
  assert.deepEqual(validateAssignments([extra]), [extra]);
  for (const value of [{}, [extra, extra], [{ ...extra, dependencia: 'NO EXISTE' }], [{ ...extra, jefe_inmediato: '' }], [{ ...extra, vicerrectoria: '' }]]) {
    assert.throws(() => validateAssignments(value));
  }
});
test('seleccionar otra dependencia usa su jefe institucional y descarta un jefe falsificado', () => {
  const payload = { laboral: { dependencia: second, cargo: 'Rector' }, jefeInmediatoUserId: 999, jefeInmediato: { nombre: 'Atacante', email: 'otro@unicesmag.edu.co' } };
  applySelectedAssignment(payload, user);
  assert.deepEqual(payload.laboral, { ...extra, cargo: 'Docente' });
  assert.equal(payload.jefeInmediatoUserId, null);
  assert.deepEqual(payload.jefeInmediato, { nombre: 'Jefe B' });
});

test('cada asignación conserva su cargo y lo aplica al seleccionar la dependencia', () => {
  const assignment = { ...extra, cargo: 'Coordinador' };
  assert.equal(validateAssignments([assignment])[0].cargo, 'Coordinador');
  const payload = { laboral: { dependencia: second } };
  applySelectedAssignment(payload, { ...user, dependencias_asignadas: [assignment] });
  assert.equal(payload.laboral.cargo, 'Coordinador');
});
test('rechaza dependencias ajenas o sin seleccionar y preserva el flujo de perfiles de una dependencia', () => {
  assert.throws(() => applySelectedAssignment({ laboral: { dependencia: 'Ajena' } }, user));
  assert.throws(() => applySelectedAssignment({}, user));
  const old = { laboral: { dependencia: first }, jefeInmediatoUserId: 3 };
  applySelectedAssignment(old, primary);
  assert.equal(old.jefeInmediatoUserId, 3);
});

test('las API de creación y edición guardan, conservan y eliminan las asignaciones adicionales', async (t) => {
  const { User } = require('../models');
  t.mock.method(require('./emailService'), 'sendWelcomeEmail', async () => ({ success: true }));
  t.mock.method(User, 'findOne', async () => null);
  let stored;
  t.mock.method(User, 'create', async (values) => {
    stored = { ...values, id: 999, async update(next) { Object.assign(this, next); return this; } };
    return stored;
  });
  t.mock.method(User, 'findByPk', async () => stored);
  const path = require.resolve('../controllers/userController');
  const previous = require.cache[path];
  delete require.cache[path];
  const controller = require(path);
  t.after(() => { if (previous) require.cache[path] = previous; else delete require.cache[path]; });
  const response = () => ({ code: 200, status(code) { this.code = code; return this; }, json(value) { this.payload = value; return this; } });
  const operator = { role: 'administrador' };
  const created = response();
  await controller.createUser({ user: operator, body: { ...primary, nombre: 'USUARIO MULTI PRUEBA', email: 'multi.prueba@unicesmag.edu.co', username: '1000000999', role: 'consulta', dependencias_asignadas: [extra] } }, created);
  assert.equal(created.code, 201, created.payload?.message);
  assert.deepEqual(stored.dependencias_asignadas, [extra]);
  const updated = response();
  await controller.updateUser({ user: operator, params: { id: 999 }, body: { cargo: 'Docente' } }, updated);
  assert.equal(updated.code, 200);
  assert.deepEqual(stored.dependencias_asignadas, [extra]);
  const invalid = response();
  await controller.updateUser({ user: operator, params: { id: 999 }, body: { dependencias_asignadas: [{ ...extra, dependencia: 'No existe' }] } }, invalid);
  assert.equal(invalid.code, 400);
  assert.deepEqual(stored.dependencias_asignadas, [extra]);
  await controller.updateUser({ user: operator, params: { id: 999 }, body: { dependencias_asignadas: [] } }, response());
  assert.deepEqual(stored.dependencias_asignadas, []);
});
