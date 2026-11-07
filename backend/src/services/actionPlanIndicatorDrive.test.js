const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  getActiveIndicators,
  getIndicatorFolderName,
  resolveEvidenceIndicatorKind
} = require('./actionPlanIndicators');

test('Dynamic subfolder resolution by active indicators count', () => {
  // Caso 1: 1 indicador (solo Resultado)
  const item1 = {
    custom_values: {
      indicadorResultado: 'Documento aprobado',
      metaResultado: '100%',
      indicadorResultadoActivo: true,
      indicadorLogroActivo: false,
      indicadorImpactoActivo: false
    }
  };
  const inds1 = getActiveIndicators(item1);
  assert.equal(inds1.length, 1);
  const folders1 = inds1.map(getIndicatorFolderName);
  assert.deepEqual(folders1, ['Resultado']);

  // Caso 2: 2 indicadores (Resultado e Impacto)
  const item2 = {
    custom_values: {
      indicadorResultado: '50 matriculados',
      metaResultado: '50',
      indicadorResultadoActivo: true,
      indicadorLogroActivo: false,
      indicadorImpacto: '95% satisfacción de empleadores',
      metaImpacto: '95%',
      indicadorImpactoActivo: true
    }
  };
  const inds2 = getActiveIndicators(item2);
  assert.equal(inds2.length, 2);
  const folders2 = inds2.map(getIndicatorFolderName);
  assert.deepEqual(folders2, ['Resultado', 'Impacto']);

  // Caso 3: 3 indicadores (Resultado, Logro e Impacto)
  const item3 = {
    custom_values: {
      indicadorResultado: 'Capacitaciones realizadas',
      metaResultado: '10',
      indicadorResultadoActivo: true,
      indicadorLogro: 'Docentes certificados',
      metaLogro: '100%',
      indicadorLogroActivo: true,
      indicadorImpacto: 'Mejora en resultados Saber Pro',
      metaImpacto: '15%',
      indicadorImpactoActivo: true
    }
  };
  const inds3 = getActiveIndicators(item3);
  assert.equal(inds3.length, 3);
  const folders3 = inds3.map(getIndicatorFolderName);
  assert.deepEqual(folders3, ['Resultado', 'Logro', 'Impacto']);
});

test('Evidence routing targets the exact indicator folder', () => {
  const ev1 = { id: 1, original_name: 'soporte.pdf', description: '[resultado] Certificado' };
  const ev2 = { id: 2, original_name: 'encuesta.xlsx', description: '[logro] Respuestas' };
  const ev3 = { id: 3, original_name: 'informe_impacto.pdf', description: 'Medición anual' };
  const ev4 = { id: 4, original_name: 'asistencia.pdf', indicator_kind: 'impacto' };

  assert.equal(resolveEvidenceIndicatorKind(ev1), 'resultado');
  assert.equal(resolveEvidenceIndicatorKind(ev2), 'logro');
  assert.equal(resolveEvidenceIndicatorKind(ev3), 'impacto');
  assert.equal(resolveEvidenceIndicatorKind(ev4), 'impacto');

  // Mapeo a nombres de carpeta en Drive
  assert.equal(getIndicatorFolderName({ kind: resolveEvidenceIndicatorKind(ev1) }), 'Resultado');
  assert.equal(getIndicatorFolderName({ kind: resolveEvidenceIndicatorKind(ev2) }), 'Logro');
  assert.equal(getIndicatorFolderName({ kind: resolveEvidenceIndicatorKind(ev3) }), 'Impacto');
  assert.equal(getIndicatorFolderName({ kind: resolveEvidenceIndicatorKind(ev4) }), 'Impacto');
});
