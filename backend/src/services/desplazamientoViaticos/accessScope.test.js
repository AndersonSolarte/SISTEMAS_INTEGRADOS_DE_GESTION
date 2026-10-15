const test = require('node:test');
const assert = require('node:assert/strict');

const { canAccessSolicitud, canActOnSolicitud, canValidateLegalizacion, filterSolicitudesForUser, userMatchesStep } = require('./accessScope');

const solicitud = (step, extra = {}) => ({
  plan_aprobacion: step ? [step] : [],
  paso_actual: 0,
  trazabilidad: [],
  ...extra
});

test('el administrador conserva la consulta global', () => {
  const rows = [solicitud({ key: 'sst' }), solicitud({ key: 'tesoreria' })];
  assert.equal(filterSolicitudesForUser({ role: 'administrador' }, rows).length, 2);
});

test('un usuario autorizado solo ve la etapa asignada a su correo', () => {
  const user = { role: 'consulta', email: 'director.derecho@unicesmag.edu.co', dependencia: 'Programa Académico - Derecho' };
  const own = solicitud({ key: 'jefe', label: 'Director de Programa', email: 'director.derecho@unicesmag.edu.co' });
  const other = solicitud({ key: 'jefe', label: 'Director de Programa', email: 'director.administracion@unicesmag.edu.co' });

  assert.equal(canAccessSolicitud(user, own), true);
  assert.equal(canAccessSolicitud(user, other), false);
  assert.deepEqual(filterSolicitudesForUser(user, [own, other]), [own]);
});

test('el área SST ve únicamente etapas correspondientes a SST', () => {
  const user = { role: 'consulta', email: 'consulta@unicesmag.edu.co', dependencia: 'Seguridad y Salud en el Trabajo' };
  assert.equal(userMatchesStep(user, { key: 'sst', label: 'Seguridad y Salud en el Trabajo' }), true);
  assert.equal(userMatchesStep(user, { key: 'tesoreria', label: 'Tesorería / Pagaduría' }), false);
});

test('un usuario conserva consulta sobre solicitudes que ya revisó', () => {
  const user = { role: 'consulta', email: 'aprobador@unicesmag.edu.co', dependencia: 'Vicerrectoría Académica' };
  const row = solicitud(null, { trazabilidad: [{ event: 'aprobado_jefe', actor: { email: 'aprobador@unicesmag.edu.co' } }] });
  assert.equal(canAccessSolicitud(user, row), true);
  assert.equal(canActOnSolicitud(user, row), false);
});

test('Técnico Contable puede consultar legalizaciones pendientes de validación', () => {
  const user = { role: 'consulta', email: 'tecnico@unicesmag.edu.co', cargo: 'Técnico Contable' };
  const row = solicitud(null, { legalizacion: { id: 15, estado: 'en_revision' } });
  assert.equal(canAccessSolicitud(user, row), true);
  assert.equal(canValidateLegalizacion(user), true);
});

test('un usuario sin coincidencia no puede consultar solicitudes de otras dependencias', () => {
  const user = { role: 'consulta', email: 'consulta@unicesmag.edu.co', dependencia: 'Biblioteca' };
  const row = solicitud({ key: 'gestion_humana', label: 'Oficina de Gestión del Talento Humano', email: 'talentohumano@unicesmag.edu.co' });
  assert.equal(canAccessSolicitud(user, row), false);
});
