const { test } = require('node:test');
const assert = require('node:assert/strict');

test('statistical calculations for structured and legacy indicators', () => {
  // Simulate item with legacy indicator
  const legacyItem = {
    indicator: '10 convenios firmados',
    target: '10',
    indicator_type: 'Resultado',
    custom_values: {}
  };

  // Simulate item with predesigned structured block (Resultado + Logro)
  const structuredItem = {
    indicator: '50 estudiantes vinculados',
    target: '50',
    indicator_type: 'Resultado',
    custom_values: {
      indicadorResultado: '50 estudiantes vinculados',
      metaResultado: '50',
      indicadorResultadoActivo: true,
      indicadorLogro: '80% de satisfacción en encuestas',
      metaLogro: '80%',
      indicadorLogroActivo: true,
      indicadorImpactoActivo: false
    }
  };

  const countIndicators = (item) => {
    const custom = item.custom_values || {};
    let count = 0;
    if (custom.indicadorResultadoActivo && (custom.indicadorResultado || custom.metaResultado)) count++;
    if (custom.indicadorLogroActivo && (custom.indicadorLogro || custom.metaLogro)) count++;
    if (custom.indicadorImpactoActivo && (custom.indicadorImpacto || custom.metaImpacto)) count++;
    if (count === 0 && (item.indicator || custom.indicator || '').trim()) count = 1;
    return count;
  };

  assert.equal(countIndicators(legacyItem), 1);
  assert.equal(countIndicators(structuredItem), 2);

  const formatRowIndicator = (item) => {
    const custom = item.custom_values || {};
    const parts = [];
    if (custom.indicadorResultado) parts.push(`Resultado: ${custom.indicadorResultado}`);
    if (custom.indicadorLogro) parts.push(`Logro: ${custom.indicadorLogro}`);
    if (custom.indicadorImpacto) parts.push(`Impacto: ${custom.indicadorImpacto}`);
    return parts.length ? parts.join(' | ') : (item.indicator || custom.indicator || '—');
  };

  assert.equal(formatRowIndicator(legacyItem), '10 convenios firmados');
  assert.equal(formatRowIndicator(structuredItem), 'Resultado: 50 estudiantes vinculados | Logro: 80% de satisfacción en encuestas');
});
