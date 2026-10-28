const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../../controllers/desplazamientoViaticosController');
const ReporteSalidaSolicitud = require('../../models/ReporteSalidaSolicitud');

test('el Reporte de Salida no finaliza durante las aprobaciones previas de viáticos', () => {
  const previousStages = ['jefe', 'financiera_previa', 'vicerrectoria_dependencia', 'sst', 'rectoria', 'gestion_humana', 'tecnico_contable'];
  previousStages.forEach((stage) => {
    assert.notEqual(_internals.getLinkedReportStateForStage(stage), 'finalizada');
  });
});

test('solo Tesorería con pago autorizado finaliza el Reporte de Salida vinculado', () => {
  assert.equal(_internals.getLinkedReportStateForStage('tesoreria'), null);
  assert.equal(_internals.getLinkedReportStateForStage('tesoreria', { paymentAuthorized: true }), 'finalizada');
});

test('todas las etapas del flujo usan estados válidos del ENUM de Reporte de Salida', () => {
  const allowedStates = new Set(ReporteSalidaSolicitud.rawAttributes.estado.values);
  const stages = ['jefe', 'financiera_previa', 'vicerrectoria_dependencia', 'sst', 'rectoria', 'gestion_humana', 'tecnico_contable', 'tesoreria'];
  stages.forEach((stage) => {
    const state = _internals.getPendingLinkedReportStateForStage(stage);
    assert.ok(state, `Falta mapear la etapa ${stage}`);
    assert.ok(allowedStates.has(state), `${state} no pertenece al ENUM de Reporte de Salida`);
  });
  assert.equal(_internals.getPendingLinkedReportStateForStage('vicerrectoria_dependencia'), 'pendiente_aprobacion_vicerrectoria_academica');
});

test('la distribución final incluye todas las instancias que participaron sin duplicar correos', () => {
  const recipients = _internals.collectFinalRecipientEmails({
    plan_aprobacion: [
      { email: 'jefe@unicesmag.edu.co' },
      { email: 'tesoreria@unicesmag.edu.co', infoEmails: ['financiera@unicesmag.edu.co'] },
      { email: 'jefe@unicesmag.edu.co', alternateApprovalEmail: 'programa@unicesmag.edu.co' }
    ]
  }, {
    tecnicoContable: 'tecnico@unicesmag.edu.co',
    tesoreria: 'tesoreria@unicesmag.edu.co',
    sst: 'sst@unicesmag.edu.co',
    gestionHumana: 'talentohumano@unicesmag.edu.co'
  }, {
    dependenciaEmail: 'dependencia@unicesmag.edu.co',
    authorityEmail: 'vicerrectoria@unicesmag.edu.co'
  });

  ['jefe@unicesmag.edu.co', 'tesoreria@unicesmag.edu.co', 'financiera@unicesmag.edu.co', 'programa@unicesmag.edu.co', 'tecnico@unicesmag.edu.co', 'sst@unicesmag.edu.co', 'talentohumano@unicesmag.edu.co', 'dependencia@unicesmag.edu.co', 'vicerrectoria@unicesmag.edu.co']
    .forEach((email) => assert.ok(recipients.includes(email), `Falta destinatario final: ${email}`));
  assert.equal(recipients.filter((email) => email === 'jefe@unicesmag.edu.co').length, 1);
});

test('el correo final responde al mensaje real de la etapa para conservar el hilo', () => {
  const headers = _internals.getThreadHeaders({
    consecutivo: 'ADF-PP-FR-004-2026-0015',
    trazabilidad: [{
      event: 'correo_aprobacion_enviado',
      detail: { entregas: [{ recipient: 'tesoreria@unicesmag.edu.co', success: true, messageId: '<tesoreria-0015@unicesmag.edu.co>' }] }
    }]
  }, 'tesoreria@unicesmag.edu.co');

  assert.equal(headers.inReplyTo, '<tesoreria-0015@unicesmag.edu.co>');
  assert.match(headers.references, /DEV-ADF-PP-FR-004-2026-0015/);
  assert.match(headers.references, /tesoreria-0015/);
});
