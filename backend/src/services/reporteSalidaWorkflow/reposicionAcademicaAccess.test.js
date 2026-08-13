const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');

const {
  bossScopeWhere,
  isAssignedBoss,
  isAcademicAuthorityAssignment,
  resolveReposicionValues,
  resolveReposicionAbono
} = require('../../controllers/reporteSalidaController');

const solicitudAcademica = {
  jefe_inmediato_user_id: 44,
  jefe_snapshot: {
    nombre: 'SANDRA LUCIA BOLAÑOS DELGADO',
    email: 'sbolanos@unicesmag.edu.co'
  }
};

test('la cuenta institucional de Académica administra la reposición asignada a la Vicerrectora', () => {
  assert.equal(isAcademicAuthorityAssignment(solicitudAcademica), true);
  assert.equal(isAssignedBoss(solicitudAcademica, { id: 99, email: 'viceacad@unicesmag.edu.co' }), true);
});

test('la cuenta personal de Sandra no administra la bandeja institucional de reposiciones', () => {
  assert.equal(isAssignedBoss(solicitudAcademica, { id: 44, email: 'sbolanos@unicesmag.edu.co' }), false);
  assert.deepEqual(bossScopeWhere({ id: 44, email: 'sbolanos@unicesmag.edu.co' }), { id: -1 });
});

test('la consulta institucional contempla solicitudes históricas enviadas a ambos correos', () => {
  const scope = bossScopeWhere({ id: 99, email: 'viceacad@unicesmag.edu.co' }, [44]);
  const alternatives = scope[Op.or];
  assert.equal(alternatives.length, 3);
  assert.equal(alternatives[0].jefe_snapshot[Op.contains].email, 'viceacad@unicesmag.edu.co');
  assert.equal(alternatives[1].jefe_snapshot[Op.contains].email, 'sbolanos@unicesmag.edu.co');
  assert.deepEqual(alternatives[2].jefe_inmediato_user_id[Op.in], [44]);
});

test('una solicitud histórica sin correo se reconoce por el id de la jefa inmediata', () => {
  const historical = { jefe_inmediato_user_id: 44, jefe_snapshot: {} };
  assert.equal(isAssignedBoss(historical, { id: 99, email: 'viceacad@unicesmag.edu.co' }, [44]), true);
  assert.equal(isAssignedBoss(historical, { id: 100, email: 'otro@unicesmag.edu.co' }, [44]), false);
});

test('las salidas entre uno y dos dias generan reposicion con el tiempo calculado', () => {
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    requestedMinutes: 960,
    bodyMinutes: 0,
    durationDays: 2
  }), { minutes: 1040, applies: true });
});

test('las salidas de tres o mas dias generan reposicion con el tiempo calculado', () => {
  assert.deepEqual(resolveReposicionValues({
    isOficio: true,
    requestedMinutes: 1440,
    bodyMinutes: 0,
    durationDays: 3
  }), { minutes: 1560, applies: true });
});

test('un dia de reposicion equivale a ocho horas y cuarenta minutos', () => {
  assert.equal(resolveReposicionAbono({ unidadReposicion: 'dias', diasAbonados: 1 }).minutes, 520);
});

test('el abono por tiempo combina horas y minutos', () => {
  assert.equal(resolveReposicionAbono({
    unidadReposicion: 'tiempo',
    horasAbonadas: 2,
    minutosAbonados: 35
  }).minutes, 155);
});

test('rechaza minutos adicionales mayores que cincuenta y nueve', () => {
  assert.equal(resolveReposicionAbono({
    unidadReposicion: 'tiempo',
    horasAbonadas: 1,
    minutosAbonados: 60
  }).valid, false);
});
