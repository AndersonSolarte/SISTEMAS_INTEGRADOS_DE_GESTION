const test = require('node:test');
const assert = require('node:assert/strict');
const { SystemSetting, ViaticosLegalizacion } = require('../../models');
const { sequelize } = require('../../config/database');
const queue = require('./legalizacionSubmissionQueue');
const pdf = require('./legalizacionPdfService');
const email = require('../emailService');
const { ViaticosLegalizacionAdjunto } = require('../../models');

test('la presentación confirma el registro y la cola durable sin esperar PDF ni SMTP', async (t) => {
  const saved = [];
  const row = { id: 20, estado: 'pendiente_legalizacion', fecha_habilitacion: '2000-01-01', fecha_limite: '2099-01-01', detalles: [{ id: 'gasto', detalle: 'Manutención', valorAnticipo: 100 }], trazabilidad: [], async update(value) { Object.assign(this, value); saved.push('registro'); } };
  t.mock.method(ViaticosLegalizacion, 'findOne', async () => row);
  t.mock.method(ViaticosLegalizacion, 'findByPk', async () => row);
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(sequelize, 'transaction', async (callback) => callback(transaction));
  t.mock.method(queue, 'enqueueSubmissionEmail', async (id, options) => { assert.equal(id, row.id); assert.equal(options.transaction, transaction); saved.push('cola'); });
  const kick = t.mock.method(queue, 'kickSubmissionEmails', () => saved.push('despertar-worker'));
  const build = t.mock.method(pdf, 'buildLegalizacionPdfBuffer', () => { throw new Error('El PDF no debe bloquear la respuesta.'); });
  const controllerPath = require.resolve('../../controllers/legalizacionViaticosController');
  delete require.cache[controllerPath];
  const controller = require(controllerPath);
  const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; saved.push('respuesta'); return this; } };
  await controller.presentar({ params: { id: row.id }, user: { id: 1 }, body: { detalles: JSON.stringify([{ id: 'gasto', valorLegalizado: 90 }]) }, files: [] }, res);
  assert.equal(res.code, 201);
  assert.equal(res.body.emailQueued, true);
  assert.equal(row.estado, 'en_revision');
  assert.deepEqual(saved, ['registro', 'cola', 'respuesta', 'despertar-worker']);
  assert.equal(build.mock.callCount(), 0);
  assert.equal(kick.mock.callCount(), 1);
});

test('cada envío se registra en la misma transacción y sin contenido documental', async (t) => {
  const transaction = {};
  const create = t.mock.method(SystemSetting, 'create', async (record, options) => { assert.equal(options.transaction, transaction); return record; });
  const record = await queue.enqueueSubmissionEmail(21, { transaction });
  assert.equal(record.key, 'viaticos_legalizacion_presentacion_21');
  assert.equal(record.value.status, 'queued');
  assert.equal(record.value.legalizacionId, 21);
  assert.equal(create.mock.callCount(), 1);
});

test('procesa varias solicitudes con concurrencia acotada y evita dos ejecuciones locales', async (t) => {
  const jobs = [1, 2, 3, 4, 5].map(id => ({ key: `job-${id}`, value: { legalizacionId: id, status: 'queued', attempts: 0 } }));
  t.mock.method(SystemSetting, 'findAll', async (options) => { assert.equal(options.limit, 20); return jobs; });
  t.mock.method(SystemSetting, 'update', async () => [1]);
  const removed = t.mock.method(SystemSetting, 'destroy', async () => 1);
  let active = 0, maximum = 0;
  const ids = [];
  const sendNotification = async id => {
    active++; maximum = Math.max(maximum, active); ids.push(id);
    await Promise.resolve(); active--; return { success: true };
  };
  const first = queue.runSubmissionEmails({ sendNotification });
  assert.equal(queue.runSubmissionEmails({ sendNotification }), first);
  assert.deepEqual(await first, ['sent', 'sent', 'sent', 'sent', 'sent']);
  assert.deepEqual(ids.sort(), [1, 2, 3, 4, 5]);
  assert.equal(maximum, 2);
  assert.equal(removed.mock.callCount(), 5);
});

test('un fallo de correo conserva el trabajo con fecha de reintento', async (t) => {
  t.mock.method(SystemSetting, 'findAll', async () => [{ key: 'job-1', value: { legalizacionId: 1, status: 'queued', attempts: 0 } }]);
  const updates = [];
  t.mock.method(SystemSetting, 'update', async (values) => { updates.push(values.value); return [1]; });
  const removed = t.mock.method(SystemSetting, 'destroy', async () => 1);
  const outcome = await queue.runSubmissionEmails({ sendNotification: async () => ({ success: false, error: 'SMTP no disponible' }) });
  assert.deepEqual(outcome, ['retry']);
  assert.equal(removed.mock.callCount(), 0);
  assert.equal(updates.at(-1).status, 'retry');
  assert.equal(updates.at(-1).attempts, 1);
  assert.equal(updates.at(-1).lastError, 'SMTP no disponible');
  assert.ok(new Date(updates.at(-1).nextAttemptAt) > new Date());
});

test('si otra instancia reclamó el trabajo no vuelve a enviarlo', async (t) => {
  t.mock.method(SystemSetting, 'findAll', async () => [{ key: 'job-1', value: { legalizacionId: 1 } }]);
  t.mock.method(SystemSetting, 'update', async () => [0]);
  let sent = false;
  assert.deepEqual(await queue.runSubmissionEmails({ sendNotification: async () => { sent = true; return { success: true }; } }), ['skipped']);
  assert.equal(sent, false);
});

test('el envío en segundo plano reúne los soportes en una consulta y registra la entrega al colaborador', async (t) => {
  const row = { id: 30, estado: 'en_revision', detalles: [], adjuntos: [], solicitud: { id: 300, consecutivo: 'VIA-30', solicitante_snapshot: {}, datos_viaticos: {} }, trazabilidad: [{ event: 'legalizacion_presentada', actor: { email: 'colaborador@unicesmag.edu.co' } }], async update(values) { Object.assign(this, values); } };
  t.mock.method(ViaticosLegalizacion, 'findByPk', async () => row);
  const supports = t.mock.method(ViaticosLegalizacionAdjunto, 'findAll', async () => [{ nombre_original: 'factura.pdf', contenido: Buffer.from('soporte'), mime_type: 'application/pdf' }]);
  t.mock.method(pdf, 'buildLegalizacionPdfBuffer', async () => Buffer.from('%PDF'));
  t.mock.method(sequelize, 'transaction', async callback => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  const send = t.mock.method(email, 'sendInstitutionalEmail', async options => {
    assert.ok(options.to.includes('colaborador@unicesmag.edu.co'));
    assert.equal(options.attachments.length, 2);
    assert.equal(options.attachments[1].filename, 'factura.pdf');
    assert.match(options.html, /Revisar y validar legalización/);
    assert.match(options.html, /module=vicerrectoria_financiera&amp;panel=viaticos&amp;solicitud=300/);
    assert.match(options.text, /solicitud=300/);
    return { success: true, messageId: '<entrega@siac>' };
  });
  const controllerPath = require.resolve('../../controllers/legalizacionViaticosController');
  delete require.cache[controllerPath];
  const ctrl = require(controllerPath);
  await ctrl.enviarCorreoPresentacion(row.id);
  assert.equal(supports.mock.callCount(), 1);
  assert.equal(row.trazabilidad.at(-1).event, 'correo_presentacion_enviado');
  assert.equal(row.trazabilidad.at(-1).detail.messageId, '<entrega@siac>');
  await ctrl.enviarCorreoPresentacion(row.id);
  assert.equal(send.mock.callCount(), 1);
});
