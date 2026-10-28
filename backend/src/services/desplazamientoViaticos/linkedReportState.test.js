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
