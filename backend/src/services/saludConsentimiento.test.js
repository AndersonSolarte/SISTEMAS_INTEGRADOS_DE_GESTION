const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { getSaludConsentimientoPolicy, validateSaludConsentimiento, buildSaludConsentimiento, buildSaludConsentimientoTrace } = require('./saludConsentimiento');
const { buildSaludConsentimientoPdfSection } = require('./saludConsentimientoPdf');

const policy = getSaludConsentimientoPolicy();
const consent = { accepted: true, version: policy.version, policyHash: policy.hash, clientAcceptedAt: '2099-01-01T00:00:00Z' };
const buildEvidence = () => buildSaludConsentimiento({
  user: { id: 7, nombre: 'PERSONA DE PRUEBA', username: '123456', email: 'prueba@unicesmag.edu.co' },
  consent, request: { ip: '127.0.0.1', get: () => 'test-agent' }, now: new Date('2026-11-04T15:23:45Z')
});

test('todas las modalidades de salud exigen aceptación expresa y la versión vigente', () => {
  for (const tipo of ['cita_eps', 'cita_particular', 'cita_medica_laboral', 'urgencia_medica', 'terapias']) {
    for (const duracionTipo of ['menos_media_jornada', '1_2_dias', '3_mas_dias']) {
      const salida = { tipo, duracionTipo };
      assert.ok(validateSaludConsentimiento(salida, null));
      assert.ok(validateSaludConsentimiento(salida, { ...consent, accepted: 'true' }));
      assert.ok(validateSaludConsentimiento(salida, { ...consent, version: 'anterior' }));
      assert.ok(validateSaludConsentimiento(salida, { ...consent, policyHash: 'falso' }));
      assert.equal(validateSaludConsentimiento(salida, consent), null);
    }
  }
  assert.ok(validateSaludConsentimiento({ categoria: 'salud', tipo: 'otra' }, null));
  assert.equal(validateSaludConsentimiento({ categoria: 'propias_cargo', tipo: 'proyeccion_social' }, null), null);
  assert.ok(validateSaludConsentimiento({ tipo: 'cita_eps' }, consent, true));
});

test('evidencia conserva el texto y la identidad autenticada con hora del servidor y hash verificable', () => {
  const record = buildEvidence();
  assert.equal(record.acceptedAt, '2026-11-04T15:23:45.000Z');
  assert.equal(record.actor.documento, '123456');
  assert.deepEqual(record.policy, policy);
  const { evidenceHash, ...payload } = record;
  assert.match(evidenceHash, /^[a-f0-9]{64}$/);
  assert.equal(evidenceHash, crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'));
  const trace = buildSaludConsentimientoTrace(record);
  assert.equal(trace.at, record.acceptedAt);
  assert.equal(trace.actor.userId, 7);
  assert.ok(trace.detail.observacion.includes(evidenceHash));
});

test('anexo PDF conserva todo el oficio y completa la aceptación en hora de Colombia', () => {
  const record = buildEvidence();
  const section = buildSaludConsentimientoPdfSection({ consecutivo: 'RS-PRUEBA', datos_formulario: { tx_id: 'reporte-123', consentimiento_salud: record } });
  const text = JSON.stringify(section);
  for (const paragraph of policy.paragraphs) assert.ok(text.includes(paragraph));
  for (const value of [policy.declaration, 'PERSONA DE PRUEBA', '123456', '10:23:45', record.evidenceHash, record.transactionId, 'reporte-123']) assert.ok(text.includes(value), value);
  assert.equal(section[0].pageBreak, 'before');
  assert.deepEqual(buildSaludConsentimientoPdfSection({ datos_formulario: {} }), []);
});

test('el endpoint rechaza la radicación sin autorización para docentes, administrativos y directivos', async (t) => {
  const models = require('../models');
  t.mock.method(models.SystemSetting, 'findByPk', async () => ({ value: { enabled: true } }));
  t.mock.method(models.Documento, 'findByPk', async () => ({ id: 2, codigo: 'THM-DP-FR-002', titulo: 'REPORTE DE SALIDA' }));
  const create = t.mock.method(models.ReporteSalidaSolicitud, 'create', async () => { throw new Error('No debe crear solicitudes sin consentimiento'); });
  const { radicarSolicitud } = require('../controllers/reporteSalidaController');
  for (const cargo of ['Docente', 'Administrativo', 'Director']) {
    let response;
    const res = { status: (status) => ({ json: (payload) => { response = { status, payload }; } }) };
    await radicarSolicitud({ user: { id: 7, cargo }, body: { documentoId: 2, salida: { tipo: 'cita_eps', categoria: 'salud' } } }, res);
    assert.equal(response.status, 400);
    assert.match(response.payload.message, /Debe aceptar/);
  }
  assert.equal(create.mock.callCount(), 0);
});

test('los PDF reales corto y oficio incluyen el texto y la evidencia de aceptación', async (t) => {
  const fs = require('node:fs/promises');
  const models = require('../models');
  t.mock.method(models.User, 'findOne', async () => null);
  const { ensureReporteSalidaPdf } = require('./reporteSalidaPdfService');
  const pdfParse = require('pdf-parse');
  for (const duracionTipo of ['menos_media_jornada', '3_mas_dias']) {
    const record = buildEvidence();
    const solicitud = {
      id: 123, consecutivo: `TEST-SALUD-${crypto.randomUUID()}`, created_at: record.acceptedAt,
      solicitante_snapshot: { nombre: record.actor.nombre, username: record.actor.documento },
      jefe_snapshot: {}, trazabilidad: [buildSaludConsentimientoTrace(record)],
      datos_formulario: {
        tx_id: crypto.randomUUID(), consentimiento_salud: record,
        personal: { nombre: record.actor.nombre, documento: record.actor.documento },
        laboral: { cargo: 'Docente', dependencia: 'Programa de prueba', vicerrectoria: 'Vicerrectoria Academica' },
        salida: { tipo: 'cita_eps', categoria: 'salud', duracionTipo, duracionDias: duracionTipo === '3_mas_dias' ? 3 : 0, fecha: '2026-11-05', fechaRegreso: duracionTipo === '3_mas_dias' ? '2026-11-07' : '2026-11-05', horaInicio: '08:00', horaFin: '10:00', motivo: 'Cita médica' }
      }
    };
    const attachment = await ensureReporteSalidaPdf(solicitud);
    try {
      const pdf = await pdfParse(await fs.readFile(attachment.path));
      const text = pdf.text.replace(/\s+/g, ' ');
      for (const paragraph of policy.paragraphs) assert.ok(text.includes(paragraph), `Falta texto del oficio en ${duracionTipo}`);
      for (const value of [policy.declaration, record.evidenceHash, record.transactionId, '10:23:45', record.actor.documento]) assert.ok(text.includes(value), value);
      assert.ok(pdf.numpages >= 2);
    } finally {
      await fs.unlink(attachment.path);
    }
  }
});
