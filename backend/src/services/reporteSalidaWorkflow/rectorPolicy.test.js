const test = require('node:test');
const assert = require('node:assert/strict');
const { isRectorUser, isRectorSolicitud, requiresRectorSst } = require('./rectorPolicy');
const workflow = require('./index');
const controller = require('../../controllers/reporteSalidaController');
const viaticos = require('../../controllers/desplazamientoViaticosController')._internals;

const rector = { id: 77, nombre: 'RECTOR DE PRUEBA', username: '192529251', email: 'rector.prueba@unicesmag.edu.co', cargo: 'RECTOR', dependencia: 'RECTORIA', vicerrectoria: 'RECTORIA', role: 'consulta' };
const salida = { tipo: 'capacitacion', categoria: 'propias_cargo', alcance: 'Local', municipio: 'Pasto', entidadDestino: 'Entidad de prueba', fecha: '2099-11-05', fechaRegreso: '2099-11-05', horaInicio: '08:00', horaFin: '10:00', duracionTipo: 'menos_media_jornada' };
const solicitud = (overrides = {}) => ({ solicitante_snapshot: rector, jefe_snapshot: {}, datos_formulario: { laboral: { cargo: 'Rector', vicerrectoria: 'Rectoria' }, salida: { ...salida, ...overrides } } });

const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { this.payload = payload; return this; }, type() { return this; }, send(html) { this.html = html; return this; }, setHeader() {} });
const approvalTokenFrom = (email) => decodeURIComponent(email.html.match(/\/api\/reporte-salida\/aprobar\/([^"\s]+)/)[1]);

const mockWorkflow = (t, users = []) => {
  const models = require('../../models');
  const email = require('../emailService');
  const pdf = require('../reporteSalidaPdfService');
  const rows = new Map();
  t.mock.method(models.SystemSetting, 'findByPk', async () => ({ value: { enabled: true } }));
  t.mock.method(models.Documento, 'findByPk', async () => ({ id: 2, codigo: 'THM-DP-FR-002', titulo: 'REPORTE DE SALIDA' }));
  t.mock.method(models.User, 'findAll', async () => users);
  t.mock.method(models.User, 'findOne', async (options) => users.find((user) => (options.where[require('sequelize').Op.or] || []).some((entry) => entry.username === user.username || entry.email === user.email)) || null);
  t.mock.method(models.RecursoHumanoAdministrativo, 'findOne', async () => null);
  t.mock.method(models.RecursoHumanoAdministrativo, 'findAll', async () => []);
  t.mock.method(models.DesplazamientoViaticosSolicitud, 'findOne', async () => null);
  t.mock.method(models.ReporteSalidaSolicitud, 'count', async () => rows.size);
  t.mock.method(models.ReporteSalidaSolicitud, 'findOne', async (options) => rows.get(options.where.consecutivo) || null);
  t.mock.method(models.ReporteSalidaSolicitud, 'create', async (values) => {
    const row = { ...values, id: rows.size + 1, async update(updates) { Object.assign(this, updates); return this; }, async reload() { return this; }, toJSON() { return Object.fromEntries(Object.entries(this).filter(([, value]) => typeof value !== 'function')); } };
    rows.set(row.consecutivo, row); return row;
  });
  t.mock.method(models.ReporteSalidaSolicitud, 'update', async (values, options) => {
    const row = [...rows.values()].find((candidate) => candidate.id === options.where.id);
    if (!row || Object.entries(options.where).some(([key, value]) => row[key] !== value)) return [0];
    Object.assign(row, values); return [1];
  });
  t.mock.method(pdf, 'ensureReporteSalidaPdf', async () => ({ filename: 'prueba.pdf', content: Buffer.from('pdf de prueba') }));
  const send = t.mock.method(email, 'sendInstitutionalEmail', async () => ({ success: true, messageId: 'test-message' }));
  const controllerPath = require.resolve('../../controllers/reporteSalidaController');
  const previous = require.cache[controllerPath];
  delete require.cache[controllerPath];
  const fresh = require(controllerPath);
  t.after(() => { require.cache[controllerPath] = previous; });
  return { rows, send, fresh };
};

test('solo el cargo institucional Rector omite el jefe, sin ampliar la excepción al personal de Rectoría', () => {
  assert.equal(isRectorUser(rector), true);
  for (const cargo of ['Vicerrector', 'Vicerrector Financiero', 'Secretaria de Rectoría', 'Asistente del Rector', 'Director', 'RECTORIA', '']) {
    const user = { ...rector, cargo };
    assert.equal(isRectorUser(user), false, cargo);
    assert.equal(isRectorSolicitud({ solicitante_snapshot: user, datos_formulario: { laboral: { cargo: 'Rector', vicerrectoria: 'Rectoria' } } }), false);
    assert.match(controller.validateRadicacionPayload({ documentoId: 2, laboral: { cargo: 'Rector' }, salida }, user), /jefe inmediato/);
  }
  assert.equal(controller.validateRadicacionPayload({ documentoId: 2, personal: { documento: rector.username }, laboral: { dependencia: 'Rectoria', cargo: 'RECTOR' }, salida }, rector), null);
  assert.equal(controller.getInitialApprovalRecipientEmail(solicitud()), '');
  assert.deepEqual(controller.getDependencyNotificationTargets(solicitud()), []);
});

test('las solicitudes del Rector no escalan a otra autoridad, incluso en Proyección Social', () => {
  for (const tipo of ['capacitacion', 'proyeccion_social', 'cita_eps', 'diligencia_personal']) {
    assert.equal(workflow.getAuthorityAfterBoss(solicitud({ tipo })), null);
    assert.equal(workflow.getWorkflowStrategy(solicitud({ tipo })).key, 'rectoria');
  }
});

test('SST revisa al Rector fuera de Pasto y no se aplica a desplazamientos dentro de Pasto', () => {
  for (const [alcance, municipio, expected] of [['Local', '', false], ['Local', 'Pasto', false], ['Regional', 'San Juan de Pasto', false], ['Regional', 'Ipiales', true], ['Nacional', 'Bogotá', true], ['Nacional', 'Pasto', false], ['Internacional', '', true]]) {
    const row = solicitud({ alcance, municipio });
    assert.equal(requiresRectorSst(row), expected, `${alcance} ${municipio}`);
    assert.equal(controller.requiresSstApproval(row), expected);
    assert.equal(controller.shouldAdvanceToSst(row), expected);
    assert.equal(controller.shouldAdvanceToSst({ ...row, trazabilidad: [{ event: 'aprobada_sst' }] }), false);
  }
  assert.equal(controller.requiresSstApproval({ ...solicitud({ alcance: 'Regional', municipio: 'Ipiales' }), solicitante_snapshot: { cargo: 'Profesional' } }), false);
  assert.equal(controller.requiresSstApproval({ ...solicitud({ alcance: 'Nacional', municipio: 'Bogotá' }), solicitante_snapshot: { cargo: 'Profesional' } }), true);
});

test('en viáticos el Rector inicia en Talento Humano sin jefe y conserva la gestión financiera', () => {
  for (const municipio of ['Ipiales', 'Pasto']) {
    const { steps } = viaticos.buildApprovalPlan({ user: rector, jefe: {}, personal: rector, laboral: { cargo: 'Rector', vicerrectoria: 'Rectoria' }, salida: { ...salida, alcance: 'Regional', municipio } });
    assert.deepEqual(steps.map((step) => step.key), ['gestion_humana', ...(municipio === 'Pasto' ? [] : ['sst']), 'financiera_previa', 'tecnico_contable', 'tesoreria']);
    assert.equal(steps.some((step) => ['jefe', 'rectoria', 'vicerrectoria_dependencia'].includes(step.key)), false);
    const report = viaticos.buildNormalReportData({ consecutivo: 'TEST-RECTOR-VIATICOS', userId: rector.id, documentoId: 2, jefeUserId: 88, jefe: { nombre: 'Jefa antigua' }, personal: { nombre: rector.nombre, documento: rector.username }, laboral: { cargo: 'Rector' }, salida, viaticos: {}, steps, rectorSinJefe: true });
    assert.equal(report.jefe_inmediato_user_id, null);
    assert.deepEqual(report.jefe_snapshot, {});
    assert.equal(report.estado, 'pendiente_aprobacion_gestion_humana');
  }
  const body = { salida, laboral: { cargo: 'Rector', vicerrectoria: 'Rectoria' } };
  assert.equal(viaticos.validatePayload(body, rector).some((issue) => issue.includes('jefe inmediato')), false);
  assert.equal(viaticos.validatePayload(body, { cargo: 'Secretaria' }).some((issue) => issue.includes('jefe inmediato')), true);
});

test('el PDF del Rector indica que no aplica jefe y muestra SST para salidas regionales fuera de Pasto', () => {
  const { buildOficioPdfDefinition } = require('../reporteSalidaPdfService');
  const row = { ...solicitud({ alcance: 'Regional', municipio: 'Ipiales', duracionTipo: '3_mas_dias', duracionDias: 3 }), consecutivo: 'RECTOR-TEST', created_at: new Date() };
  const text = JSON.stringify(buildOficioPdfDefinition(row));
  assert.ok(text.includes('No aplica. El Rector no tiene jefe inmediato.'));
  assert.ok(text.includes('Seguridad y Salud en el Trabajo'));
  assert.equal(text.includes('VISTO BUENO del jefe inmediato'), false);
});

test('Talento Humano sigue exigiendo aprobación previa para un colaborador que no sea el Rector', async (t) => {
  const { rows, fresh } = mockWorkflow(t);
  const token = require('../../utils/secureUrlToken').encryptPayload({ purpose: 'reporte_salida_approve', stage: 'gestion_humana', consecutivo: 'STAFF-TEST' }, null);
  const row = { ...solicitud(), id: 98, consecutivo: 'STAFF-TEST', solicitante_snapshot: { cargo: 'Profesional' }, estado: 'pendiente_aprobacion_gestion_humana', trazabilidad: [], aprobacion_gh_token_hash: require('crypto').createHash('sha256').update(token).digest('hex') };
  rows.set(row.consecutivo, row);
  const res = response();
  await fresh.aprobarDesdeCorreo({ method: 'POST', params: { token }, body: {}, query: {} }, res);
  assert.equal(res.statusCode, 409);
  assert.equal(row.estado, 'pendiente_aprobacion_gestion_humana');
});

test('radicación y aprobaciones reales: Rector → Talento Humano → SST fuera de Pasto → finalización', async (t) => {
  const { rows, send, fresh } = mockWorkflow(t);
  const recipients = require('../../config/reporteSalidaConfig').getReporteSalidaRecipients();
  for (const municipio of ['Pasto', 'Ipiales']) {
    const start = send.mock.callCount();
    const res = response();
    await fresh.radicarSolicitud({ user: rector, body: { documentoId: 2, personal: { documento: rector.username }, laboral: { dependencia: 'Rectoria', vicerrectoria: 'Rectoria', cargo: 'Rector' }, salida: { ...salida, alcance: 'Regional', municipio }, jefeInmediato: { nombre: 'Jefa antigua', email: 'jefa.antigua@unicesmag.edu.co' } } }, res);
    assert.equal(res.statusCode, 201);
    const row = rows.get(res.payload.data.consecutivo);
    for (let i = 0; i < 20 && !row.correo_gh_enviado_at; i++) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(row.estado, 'pendiente_aprobacion_gestion_humana');
    assert.deepEqual(row.jefe_snapshot, {});
    assert.equal(row.jefe_inmediato_user_id, null);
    assert.equal(row.aprobacion_jefe_token_hash, null);
    assert.ok(row.correo_gh_enviado_at);
    const initialMail = send.mock.calls.slice(start).map((call) => call.arguments[0]);
    assert.deepEqual(initialMail.map((mail) => mail.to), [rector.email, recipients.gestionHumana]);
    assert.equal(row.trazabilidad.some((trace) => trace.event === 'aprobada_jefe'), false);
    const ghToken = approvalTokenFrom(initialMail[1]);
    const approval = response();
    await fresh.aprobarDesdeCorreo({ method: 'POST', params: { token: ghToken }, body: {}, query: {} }, approval);
    assert.equal(approval.statusCode, 200, approval.html);
    assert.equal(row.estado, municipio === 'Pasto' ? 'finalizada' : 'pendiente_aprobacion_sst');
    assert.equal(row.trazabilidad.some((trace) => trace.event === 'aprobada_rectoria'), false);
    if (municipio === 'Ipiales') {
      const sstMail = send.mock.calls.slice(start).map((call) => call.arguments[0]).find((mail) => mail.to === recipients.sst && mail.html.includes('/api/reporte-salida/aprobar/'));
      assert.ok(sstMail);
      await fresh.aprobarDesdeCorreo({ method: 'POST', params: { token: approvalTokenFrom(sstMail) }, body: {}, query: {} }, response());
      assert.equal(row.estado, 'finalizada');
      assert.ok(row.trazabilidad.some((trace) => trace.event === 'aprobada_sst'));
    } else {
      assert.equal(send.mock.calls.slice(start).some((call) => [].concat(call.arguments[0].to).includes(recipients.sst)), false);
    }
  }
});

test('en un grupo solo el Rector queda sin jefe y los demás participantes conservan su aprobación', async (t) => {
  const boss = { id: 88, nombre: 'JEFE DE PRUEBA', email: 'jefe.prueba@unicesmag.edu.co', username: '888', cargo: 'Jefe', dependencia: 'Oficina de prueba', estado: 'activo' };
  const staff = { id: 89, nombre: 'COLABORADOR DE PRUEBA', email: 'colaborador.prueba@unicesmag.edu.co', username: '999', cargo: 'Profesional', dependencia: 'Oficina de prueba', jefe_inmediato: boss.nombre, estado: 'activo' };
  const { rows, send, fresh } = mockWorkflow(t, [rector, boss, staff]);
  const res = response();
  await fresh.radicarSolicitud({ user: rector, body: { documentoId: 2, isSalidaMultiple: true, salida, participantes: [rector, staff].map((user) => ({ nombre: user.nombre, documento: user.username, correo: user.email, dependencia: user.dependencia, cargo: user.cargo, vicerrectoria: user.vicerrectoria })) } }, res);
  assert.equal(res.statusCode, 201, res.payload?.message);
  const created = [...rows.values()];
  assert.equal(created.find((row) => row.user_id === rector.id).estado, 'pendiente_aprobacion_gestion_humana');
  const staffRow = created.find((row) => row.user_id === staff.id);
  assert.equal(staffRow.estado, 'pendiente_aprobacion_jefe');
  assert.equal(staffRow.jefe_snapshot.email, boss.email);
  assert.ok(send.mock.calls.some((call) => [].concat(call.arguments[0].to).includes(boss.email)));
});

test('un formulario grupal no puede crear otra cuenta Rector ni dejar solicitudes parciales', async (t) => {
  const { rows, send, fresh } = mockWorkflow(t);
  const res = response();
  await fresh.radicarSolicitud({ user: rector, body: { documentoId: 2, isSalidaMultiple: true, salida, participantes: [
    { nombre: 'PERSONA UNO', documento: '1001', correo: 'uno@unicesmag.edu.co', dependencia: 'Oficina', cargo: 'Profesional' },
    { nombre: 'RECTOR FALSO', documento: '1002', correo: 'dos@unicesmag.edu.co', dependencia: 'Rectoria', cargo: 'Rector' }
  ] } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(rows.size, 0);
  assert.equal(send.mock.callCount(), 0);
});
