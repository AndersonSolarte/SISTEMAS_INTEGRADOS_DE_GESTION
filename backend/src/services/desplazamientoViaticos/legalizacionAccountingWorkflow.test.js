const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const models = require('../../models');
const { sequelize } = require('../../config/database');
const queue = require('./legalizacionSubmissionQueue');
const email = require('../emailService');
const pdf = require('./legalizacionPdfService');
const { getDesplazamientoViaticosRecipients } = require('../../config/desplazamientoViaticosConfig');
const config = getDesplazamientoViaticosRecipients();
const tech = { id: 2, email: config.tecnicoContable, cargo: 'Técnico Contable' };
const accounting = { id: 3, email: config.contabilidad, dependencia: 'Oficina de Contabilidad' };
const file = { path: 'mock-upload', filename: 'seven.pdf', originalname: 'SEVEN.pdf', mimetype: 'application/pdf' };
const body = { detalles: [{ id: 'gasto', valorLegalizado: 90 }], observaciones: 'Revisión técnica' };

const setup = (t, mailOutcome = 'success') => {
  const jobs = [], mails = [], deleted = [];
  let records = [{ id: '1', contenido: Buffer.from('factura'), nombre_original: 'factura.pdf', mime_type: 'application/pdf', sha256: 'hash-factura' }];
  const solicitud = { id: 100, estado: 'pago_autorizado_pendiente_legalizacion', consecutivo: 'VIA-100', solicitante_snapshot: { nombre: 'Colaborador de prueba', email: 'colaborador@unicesmag.edu.co' }, datos_viaticos: {}, toJSON() { return { ...this }; }, async update(values) { Object.assign(this, values); } };
  const row = { id: 10, codigo_verificacion: 'codigo', estado: 'en_revision', solicitud, detalles: [{ id: 'gasto', detalle: 'Manutención', valorAnticipo: 100, valorLegalizado: 95 }], adjuntos: [{ id: '1', conceptoId: 'gasto', originalName: 'factura.pdf', persistidoEnBaseDatos: true }], trazabilidad: [{ event: 'correo_presentacion_enviado', detail: { messageId: '<presentada@siac>' } }], async update(values) { Object.assign(this, values); } };
  t.mock.method(models.ViaticosLegalizacion, 'findByPk', async () => row);
  t.mock.method(sequelize, 'transaction', async callback => callback({ LOCK: { UPDATE: 'UPDATE' } }));
  t.mock.method(fs.promises, 'readFile', async () => Buffer.from('%PDF-test'));
  t.mock.method(models.SystemSetting, 'create', async record => { jobs.push(record); return record; });
  t.mock.method(queue, 'kickSubmissionEmails', () => {});
  t.mock.method(models.ViaticosLegalizacionAdjunto, 'create', async record => { const stored = { id: String(records.length + 10), ...record }; records.push(stored); return stored; });
  t.mock.method(models.ViaticosLegalizacionAdjunto, 'findAll', async () => records);
  t.mock.method(models.ViaticosLegalizacionAdjunto, 'destroy', async options => { deleted.push(options); records = options.where.id ? records.filter(item => !options.where.id.map(String).includes(String(item.id))) : []; });
  t.mock.method(pdf, 'buildLegalizacionPdfBuffer', async () => Buffer.from('%PDF-format'));
  t.mock.method(email, 'sendInstitutionalEmail', async options => {
    mails.push(options);
    return { success: mailOutcome !== 'failed', suppressed: mailOutcome === 'suppressed', messageId: `<mail-${mails.length}@siac>` };
  });
  const servicePath = require.resolve('./legalizacionAccountingWorkflow');
  delete require.cache[servicePath];
  return { workflow: require(servicePath), row, jobs, mails, deleted };
};

test('Técnico -> Contabilidad -> información correcta: conserva soportes hasta enviar el cierre y mantiene el hilo', async t => {
  const { workflow, row, jobs, mails, deleted } = setup(t);
  assert.equal(await workflow.validateTechnician({ id: 10, user: tech, body, file }), 'en_revision_contabilidad');
  assert.equal(row.estado, 'en_revision_contabilidad');
  assert.equal(row.solicitud.estado, 'pago_autorizado_pendiente_legalizacion');
  assert.equal(jobs[0].value.kind, 'review');
  assert.equal(row.adjuntos.filter(item => item.clase === 'seven').length, 1);
  assert.equal(deleted.length, 0);
  await workflow.sendQueuedNotification(10, 'review', {}, 'review-10');
  assert.ok(mails[0].to.includes(config.contabilidad));
  assert.ok(mails[0].to.includes(config.tecnicoContable));
  assert.equal(mails[0].attachments.length, 3);
  assert.equal(mails[0].inReplyTo, '<presentada@siac>');
  assert.match(mails[0].html, /Saludo de Paz y Bien/);
  assert.match(mails[0].html, /Apreciado equipo de la Oficina de Contabilidad/);
  await workflow.reviewAccounting({ id: 10, user: accounting, body: { decision: 'correcta' } });
  assert.equal(row.estado, 'finalizada');
  assert.equal(jobs.at(-1).value.kind, 'final');
  assert.equal(deleted.length, 0);
  await workflow.sendQueuedNotification(10, 'final', {}, 'final-10');
  assert.equal(mails[1].subject, mails[0].subject);
  assert.equal(mails[1].inReplyTo, '<mail-1@siac>');
  assert.match(mails[1].html, /Apreciado\(a\) Colaborador de prueba/);
  assert.match(mails[1].text, /Fraternalmente/);
  assert.ok(mails[1].to.includes('colaborador@unicesmag.edu.co'));
  assert.equal(row.adjuntos[0].persistidoEnBaseDatos, false);
  assert.equal(row.adjuntos[0].sha256, 'hash-factura');
  assert.equal(deleted.length, 1);
});

test('Ajustes realizados solo cierra el estado, sin otro PDF, cambios de valores ni correo', async t => {
  const { workflow, row, jobs, mails, deleted } = setup(t);
  await workflow.validateTechnician({ id: 10, user: tech, body, file });
  await workflow.sendQueuedNotification(10, 'review', {}, 'review-10');
  await workflow.reviewAccounting({ id: 10, user: accounting, body: { decision: 'errores', observaciones: 'Corregir cuenta 5105.' } });
  assert.equal(row.estado, 'devuelta_tecnico');
  assert.equal(jobs.at(-1).value.kind, 'feedback');
  await workflow.sendQueuedNotification(10, 'feedback', { observaciones: 'Corregir cuenta 5105.' }, 'feedback-10');
  assert.deepEqual(mails[1].to, [config.tecnicoContable]);
  assert.match(mails[1].text, /5105/);
  const originalDetails = JSON.stringify(row.detalles);
  const originalSignature = row.revisado_at;
  await workflow.completeExternalAdjustments({ id: 10, user: tech });
  assert.equal(row.estado, 'finalizada');
  assert.equal(jobs.at(-1).value.kind, 'feedback');
  assert.equal(jobs.length, 2);
  assert.equal(mails.length, 2);
  assert.equal(JSON.stringify(row.detalles), originalDetails);
  assert.equal(row.revisado_at, originalSignature);
  assert.equal(jobs.filter(job => job.value.kind === 'review').length, 1);
  assert.equal(row.adjuntos.filter(item => item.clase === 'seven').length, 1);
  assert.equal(row.adjuntos.filter(item => item.clase === 'seven_historial').length, 0);
  assert.equal(deleted.length, 1);
  assert.equal(row.trazabilidad.at(-1).event, 'ajustes_realizados');
  assert.equal(row.trazabilidad.at(-1).detail.genera_correo, false);
  await assert.rejects(workflow.completeExternalAdjustments({ id: 10, user: tech }), { status: 409 });
});

test('exige PDF SEVEN, observaciones de error y separa permisos de Técnico y Contabilidad', async t => {
  const { workflow, row } = setup(t);
  await assert.rejects(workflow.validateTechnician({ id: 10, user: tech, body }), { status: 400 });
  await assert.rejects(workflow.validateTechnician({ id: 10, user: accounting, body, file }), { status: 403 });
  await assert.rejects(workflow.reviewAccounting({ id: 10, user: tech, body: { decision: 'correcta' } }), { status: 403 });
  await assert.rejects(workflow.completeExternalAdjustments({ id: 10, user: accounting }), { status: 403 });
  await assert.rejects(workflow.completeExternalAdjustments({ id: 10, user: tech }), { status: 409 });
  await workflow.validateTechnician({ id: 10, user: tech, body, file });
  await assert.rejects(workflow.reviewAccounting({ id: 10, user: accounting, body: { decision: 'errores' } }), { status: 400 });
  await assert.rejects(workflow.validateTechnician({ id: 10, user: tech, body, file }), { status: 409 });
  await workflow.reviewAccounting({ id: 10, user: accounting, body: { decision: 'correcta' } });
  await assert.rejects(workflow.reviewAccounting({ id: 10, user: accounting, body: { decision: 'correcta' } }), { status: 409 });
  assert.equal(row.estado, 'finalizada');
});

test('el cierre sin entrega anterior confirmada conserva soportes y no envía correos', async t => {
  const { workflow, row, mails, jobs, deleted } = setup(t);
  row.estado = 'devuelta_tecnico';
  await workflow.completeExternalAdjustments({ id: 10, user: tech });
  assert.equal(row.estado, 'finalizada');
  assert.equal(jobs.length, 0);
  assert.equal(mails.length, 0);
  assert.equal(deleted.length, 0);
  assert.equal(row.adjuntos[0].persistidoEnBaseDatos, true);
});

test('los cierres de ajustes pendientes de la versión anterior tampoco envían correo', async t => {
  const { workflow, mails } = setup(t);
  const result = await workflow.sendQueuedNotification(10, 'final', { correcting: true }, 'legacy-final');
  assert.equal(result.skipped, true);
  assert.equal(mails.length, 0);
});

for (const outcome of ['failed', 'suppressed']) test(`envío final ${outcome}: conserva los documentos y permite reintentar`, async t => {
  const { workflow, row, deleted } = setup(t, outcome);
  row.estado = 'finalizada';
  await assert.rejects(workflow.sendQueuedNotification(10, 'final', {}, 'final-failed'));
  assert.equal(deleted.length, 0);
  assert.equal(row.adjuntos[0].persistidoEnBaseDatos, true);
});
