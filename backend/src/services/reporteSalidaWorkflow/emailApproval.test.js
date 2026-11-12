const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { encryptPayload } = require('../../utils/secureUrlToken');

const response = () => ({ code: 200, headers: {}, status(code) { this.code = code; return this; }, type() { return this; }, setHeader(name, value) { this.headers[name] = value; }, send(html) { this.html = html; return this; } });
const solicitud = (id, email) => ({
  id, consecutivo: `RS-12112026-00${id}`, estado: 'pendiente_aprobacion_jefe',
  solicitante_snapshot: { nombre: `Persona ${id}`, email: `persona${id}@unicesmag.edu.co`, cargo: 'Docente' },
  jefe_snapshot: { nombre: 'Jefe de prueba', email },
  datos_formulario: { grupo_id: 'grupo-test', is_leader: id === 1, personal: { nombre: `Persona ${id}` }, laboral: { dependencia: 'Programa de prueba', vicerrectoria: 'Vicerrectoria Academica', cargo: 'Docente' }, salida: { tipo: 'capacitacion', duracionTipo: 'menos_media_jornada', fecha: '2026-11-12', fechaRegreso: '2026-11-12', horaInicio: '08:00', horaFin: '10:00', alcance: 'Local' } },
  trazabilidad: [], async reload() { return this; }, async update(values) { Object.assign(this, values); return this; }
});
const setup = (t, rows) => {
  const models = require('../../models');
  t.mock.method(models.SystemSetting, 'findByPk', async () => ({ value: { enabled: true } }));
  t.mock.method(models.User, 'count', async () => 0);
  t.mock.method(models.DesplazamientoViaticosSolicitud, 'findOne', async () => null);
  t.mock.method(models.ReporteSalidaSolicitud, 'findAll', async ({ where }) => rows.filter((row) => !where.estado || row.estado === where.estado));
  t.mock.method(models.ReporteSalidaSolicitud, 'findOne', async ({ where }) => rows.find((row) => row.consecutivo === where.consecutivo));
  const updates = t.mock.method(models.ReporteSalidaSolicitud, 'update', async (values, { where }) => {
    const row = rows.find((item) => item.id === where.id && Object.entries(where).every(([key, value]) => item[key] === value));
    if (!row) return [0];
    Object.assign(row, values); return [1];
  });
  t.mock.method(require('../reporteSalidaPdfService'), 'ensureReporteSalidaPdf', async () => ({ filename: 'test.pdf', content: Buffer.from('test') }));
  const send = t.mock.method(require('../emailService'), 'sendInstitutionalEmail', async () => ({ success: true, messageId: 'test' }));
  const path = require.resolve('../../controllers/reporteSalidaController');
  const previous = require.cache[path];
  delete require.cache[path];
  const controller = require(path);
  t.after(() => { if (previous) require.cache[path] = previous; else delete require.cache[path]; });
  return { controller, updates, send };
};

test('el enlace institucional de Sandra abre y aprueba su solicitud grupal con snapshot personal', async (t) => {
  const own = solicitud(1, 'sbolanos@unicesmag.edu.co');
  const other = solicitud(2, 'otro.jefe@unicesmag.edu.co');
  const { controller, updates } = setup(t, [own, other]);
  const token = encryptPayload({ purpose: 'reporte_salida_approve_jefe_grupo', grupo_id: 'grupo-test', jefe_email: 'viceacad@unicesmag.edu.co' }, null);
  const req = { params: { token }, query: {}, body: {}, method: 'GET' };
  const page = response();
  await controller.aprobarGrupoDesdeCorreo(req, page);
  assert.match(page.html, /<form method="POST"/);
  assert.equal(updates.mock.calls.length, 0, 'abrir un correo no registra una aprobación');
  const rejection = response();
  await controller.mostrarFormularioRechazoGrupo(req, rejection);
  assert.match(rejection.html, /<form/);
  await controller.aprobarGrupoDesdeCorreo({ ...req, method: 'POST', body: { accion: 'aprobar' } }, response());
  assert.equal(own.estado, 'pendiente_aprobacion_gestion_humana');
  assert.equal(other.estado, 'pendiente_aprobacion_jefe');
});

test('un enlace grupal de un jefe ajeno no puede aprobar a todos como alternativa', async (t) => {
  const row = solicitud(1, 'jefe.real@unicesmag.edu.co');
  const { controller, updates } = setup(t, [row]);
  const token = encryptPayload({ purpose: 'reporte_salida_approve_jefe_grupo', grupo_id: 'grupo-test', jefe_email: 'jefe.ajeno@unicesmag.edu.co' }, null);
  const res = response();
  await controller.aprobarGrupoDesdeCorreo({ params: { token }, query: {}, method: 'POST', body: { accion: 'aprobar' } }, res);
  assert.equal(res.code, 403);
  assert.equal(updates.mock.calls.length, 0);
  assert.equal(row.estado, 'pendiente_aprobacion_jefe');
});

test('un enlace individual válido permite revisar y aprobar una sola vez; un token diferente no autoriza', async (t) => {
  const row = solicitud(1, 'jefe.real@unicesmag.edu.co');
  delete row.datos_formulario.grupo_id;
  const { controller, updates, send } = setup(t, [row]);
  const payload = { purpose: 'reporte_salida_approve', stage: 'jefe', consecutivo: row.consecutivo };
  const token = encryptPayload(payload, null);
  row.aprobacion_jefe_token_hash = crypto.createHash('sha256').update(token).digest('hex');
  const req = { params: { token }, query: {}, body: {}, method: 'GET' };
  const page = response();
  await controller.aprobarDesdeCorreo(req, page);
  assert.match(page.html, /<form method="POST"/);
  assert.equal(updates.mock.calls.length, 0);
  const invalid = response();
  await controller.aprobarDesdeCorreo({ ...req, method: 'POST', params: { token: encryptPayload(payload, null) } }, invalid);
  assert.equal(invalid.code, 403);
  await controller.aprobarDesdeCorreo({ ...req, method: 'POST' }, response());
  assert.equal(row.estado, 'pendiente_aprobacion_gestion_humana');
  assert.ok(send.mock.calls.length);
  const count = updates.mock.calls.length;
  await controller.aprobarDesdeCorreo({ ...req, method: 'POST' }, response());
  assert.equal(updates.mock.calls.length, count, 'el mismo botón no registra aprobaciones duplicadas');
});

test('el formulario recibido por HTTP acepta POST con las protecciones reales del servidor', async (t) => {
  const express = require('express');
  const helmet = require('helmet');
  const cors = require('cors');
  const security = require('../../middlewares/security');
  const own = solicitud(1, 'sbolanos@unicesmag.edu.co');
  const other = solicitud(2, 'otro.jefe@unicesmag.edu.co');
  const { controller } = setup(t, [own, other]);
  const app = express();
  app.use(helmet());
  app.use(cors(security.corsOptions));
  app.use(express.urlencoded({ extended: false }));
  app.use('/api', security.methodGuard, security.sensitivePathGuard, security.noStore, security.payloadShapeGuard, security.sqlInjectionGuard);
  app.get('/api/reporte-salida/aprobar-grupo/:token', controller.aprobarGrupoDesdeCorreo);
  app.post('/api/reporte-salida/aprobar-grupo/:token', controller.aprobarGrupoDesdeCorreo);
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const token = encryptPayload({ purpose: 'reporte_salida_approve_jefe_grupo', grupo_id: 'grupo-test', jefe_email: 'viceacad@unicesmag.edu.co' }, null);
  const page = await fetch(`${base}/api/reporte-salida/aprobar-grupo/${token}`);
  assert.equal(page.status, 200);
  const html = await page.text();
  const action = html.match(/<form method="POST" action="([^"]+)"/)[1];
  assert.match(page.headers.get('content-security-policy'), /form-action 'self'/);
  assert.equal(own.estado, 'pendiente_aprobacion_jefe');
  const submitted = await fetch(`${base}${action}`, { method: 'POST', headers: { Origin: base }, body: new URLSearchParams({ accion: 'aprobar', justificacion: 'Autorizado' }) });
  assert.equal(submitted.status, 200);
  assert.match(await submitted.text(), /Visto Bueno/);
  assert.equal(own.estado, 'pendiente_aprobacion_gestion_humana');
  assert.equal(other.estado, 'pendiente_aprobacion_jefe');
});

test('los enlaces individuales abren y procesan por HTTP las seis etapas de aprobación', async (t) => {
  const stages = [
    ['jefe', 'aprobacion_jefe_token_hash'],
    ['vicerrectoria_academica', 'aprobacion_vicerrectoria_token_hash'],
    ['rectoria', 'aprobacion_rectoria_token_hash'],
    ['proyeccion_social', 'aprobacion_proyeccion_social_token_hash'],
    ['gestion_humana', 'aprobacion_gh_token_hash'],
    ['sst', 'aprobacion_sst_token_hash']
  ];
  const rows = stages.map(([stage, column], i) => {
    const row = solicitud(i + 1, 'jefe.prueba@unicesmag.edu.co');
    delete row.datos_formulario.grupo_id;
    row.estado = `pendiente_aprobacion_${stage}`;
    row.trazabilidad = [{ event: 'aprobada_jefe', at: new Date().toISOString() }];
    row.datos_formulario.salida.categoria = 'propias_cargo';
    if (stage === 'proyeccion_social') row.datos_formulario.salida.tipo = 'proyeccion_social';
    const token = encryptPayload({ purpose: 'reporte_salida_approve', stage, consecutivo: row.consecutivo }, null);
    row[column] = crypto.createHash('sha256').update(token).digest('hex');
    return Object.assign(row, { testToken: token });
  });
  const { controller } = setup(t, rows);
  const express = require('express');
  const security = require('../../middlewares/security');
  const app = express();
  app.use(require('helmet')());
  app.use(require('cors')(security.corsOptions));
  app.use(express.urlencoded({ extended: false }));
  app.use('/api', security.methodGuard, security.sensitivePathGuard, security.noStore, security.payloadShapeGuard, security.sqlInjectionGuard);
  app.get('/api/reporte-salida/aprobar/:token', controller.aprobarDesdeCorreo);
  app.post('/api/reporte-salida/aprobar/:token', controller.aprobarDesdeCorreo);
  const server = await new Promise((resolve) => { const instance = app.listen(0, '127.0.0.1', () => resolve(instance)); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  for (const [i, [stage]] of stages.entries()) {
    const row = rows[i];
    const initialState = row.estado;
    const page = await fetch(`${base}/api/reporte-salida/aprobar/${row.testToken}`);
    assert.equal(page.status, 200, stage);
    const html = await page.text();
    const action = html.match(/<form method="POST" action="([^"]+)"/);
    assert.ok(action, stage);
    assert.equal(row.estado, initialState);
    const result = await fetch(`${base}${action[1]}`, { method: 'POST', headers: { Origin: base }, body: new URLSearchParams({ accion: 'aprobar', observacion: 'Aprobación de prueba' }) });
    assert.equal(result.status, 200, `${stage}: ${await result.text()}`);
    assert.notEqual(row.estado, initialState, stage);
  }
});

test('un fallo interno al abrir el enlace no se presenta como un token vencido', async (t) => {
  const { controller } = setup(t, []);
  const log = t.mock.method(console, 'error', () => {});
  t.mock.method(require('../../models').ReporteSalidaSolicitud, 'findOne', async () => {
    const error = new Error('Conexión de prueba no disponible'); error.code = 'ECONNREFUSED'; throw error;
  });
  const token = encryptPayload({ purpose: 'reporte_salida_approve', stage: 'jefe', consecutivo: 'RS-TEST' }, null);
  const res = response();
  await controller.aprobarDesdeCorreo({ params: { token }, method: 'GET', query: {}, body: {} }, res);
  assert.equal(res.code, 500);
  assert.match(res.html, /error interno/);
  assert.match(res.html, /referencia:/);
  assert.doesNotMatch(res.html, /Conexión de prueba no disponible/);
  assert.equal(log.mock.calls[0].arguments[1].code, 'ECONNREFUSED');
  assert.ok(!JSON.stringify(log.mock.calls).includes(token), 'el diagnóstico no guarda el enlace de aprobación');
});

test('un token ilegible permanece bloqueado y no consulta la base de datos', async (t) => {
  const { controller } = setup(t, []);
  const query = t.mock.method(require('../../models').ReporteSalidaSolicitud, 'findOne', async () => { throw new Error('No debería ejecutarse'); });
  const res = response();
  await controller.aprobarDesdeCorreo({ params: { token: 'enlace-alterado' }, method: 'GET', query: {}, body: {} }, res);
  assert.equal(res.code, 403);
  assert.match(res.html, /Enlace vencido o invalido/);
  assert.equal(query.mock.calls.length, 0);
});
