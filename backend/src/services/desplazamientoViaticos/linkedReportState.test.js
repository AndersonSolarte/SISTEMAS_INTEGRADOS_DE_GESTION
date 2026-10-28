const test = require('node:test');
const assert = require('node:assert/strict');
const { _internals } = require('../../controllers/desplazamientoViaticosController');

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
