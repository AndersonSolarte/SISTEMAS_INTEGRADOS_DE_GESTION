const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getActiveIndicators,
  getIndicatorProgress,
  calculateOverallFulfillment,
  filterEvidencesByIndicator,
  getIndicatorFolderName,
  resolveEvidenceIndicatorKind
} = require('./actionPlanIndicators');

test('getActiveIndicators parses single indicator activity', () => {
  const item = {
    indicator: '10 convenios firmados',
    target: '10',
    indicator_type: 'Resultado',
    custom_values: {}
  };
  const list = getActiveIndicators(item);
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, 'principal');
  assert.equal(list[0].indicator, '10 convenios firmados');
  assert.equal(list[0].target, '10');
});

test('getActiveIndicators parses multiple structured indicators', () => {
  const item = {
    custom_values: {
      indicadorResultado: '50 estudiantes matriculados',
      metaResultado: '50',
      indicadorResultadoActivo: true,
      indicadorLogro: '80% de aprobación',
      metaLogro: '80%',
      indicadorLogroActivo: true,
      indicadorImpactoActivo: false
    }
  };
  const list = getActiveIndicators(item);
  assert.equal(list.length, 2);
  assert.equal(list[0].kind, 'resultado');
  assert.equal(list[0].indicator, '50 estudiantes matriculados');
  assert.equal(list[1].kind, 'logro');
  assert.equal(list[1].indicator, '80% de aprobación');
});

test('getActiveIndicators ignores ghost indicators with empty text even if flag is true', () => {
  const item = {
    indicator: 'I1. Existencia de ejercicios...',
    target: '100%',
    custom_values: {
      indicadorResultado: 'I1. Existencia de ejercicios...',
      metaResultado: '100%',
      indicadorResultadoActivo: true,
      indicadorLogro: '',
      metaLogro: '100%',
      indicadorLogroActivo: true,
      indicadorImpacto: '   ',
      indicadorImpactoActivo: true
    }
  };
  const list = getActiveIndicators(item);
  assert.equal(list.length, 1);
  assert.equal(list[0].kind, 'resultado');
  assert.equal(list[0].indicator, 'I1. Existencia de ejercicios...');
});

test('calculateOverallFulfillment averages progress across active indicators', () => {
  const item = {
    custom_values: {
      indicadorResultadoActivo: true,
      indicadorResultado: 'Ind 1',
      indicadorLogroActivo: true,
      indicadorLogro: 'Ind 2',
      monitoring_indicators: {
        p1: {
          resultado: 100,
          logro: 50
        }
      }
    }
  };
  const periods = [{ id: 'p1' }];
  const fulfillment = calculateOverallFulfillment(item, periods);
  // (100 + 50) / 2 = 75
  assert.equal(fulfillment, 75);
});

test('filterEvidencesByIndicator filters evidences tagged by kind', () => {
  const evidences = [
    { id: 1, original_name: 'soporte1.pdf', description: '[resultado] Certificado' },
    { id: 2, original_name: 'soporte2.pdf', description: '[logro] Encuesta' },
    { id: 3, original_name: 'soporte3_resultado.pdf', description: 'Documento' }
  ];
  const resultadoEvs = filterEvidencesByIndicator(evidences, 'resultado');
  const logroEvs = filterEvidencesByIndicator(evidences, 'logro');

  assert.equal(resultadoEvs.length, 2);
  assert.equal(logroEvs.length, 1);
});

test('getIndicatorFolderName and resolveEvidenceIndicatorKind correctly identify dynamic drive subfolders', () => {
  assert.equal(getIndicatorFolderName({ kind: 'resultado' }), 'Resultado');
  assert.equal(getIndicatorFolderName({ kind: 'principal' }), 'Resultado');
  assert.equal(getIndicatorFolderName({ kind: 'logro' }), 'Logro');
  assert.equal(getIndicatorFolderName({ kind: 'impacto' }), 'Impacto');

  assert.equal(resolveEvidenceIndicatorKind({ indicator_kind: 'logro' }), 'logro');
  assert.equal(resolveEvidenceIndicatorKind({ description: '[impacto] Encuesta egresados' }), 'impacto');
  assert.equal(resolveEvidenceIndicatorKind({ original_name: 'informe_logro.pdf' }), 'logro');
  assert.equal(resolveEvidenceIndicatorKind({ description: 'General doc' }), 'resultado');
});
