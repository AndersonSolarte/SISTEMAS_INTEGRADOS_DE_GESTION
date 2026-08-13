const test = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('./emailService');

test('conserva intactos los textos UTF-8 válidos en español', () => {
  const message = 'Liquidación de viáticos · Técnico Contable · Tesorería · ningún trámite';
  assert.equal(_internals.sanitizeEmailText(message), message);
});

test('repara texto UTF-8 interpretado por error como Latin-1', () => {
  const original = 'Liquidación de viáticos para revisión del Técnico Contable';
  const mojibake = Buffer.from(original, 'utf8').toString('latin1');
  assert.equal(_internals.sanitizeEmailText(mojibake), original);
});

test('conserva valores monetarios COP y su distribución HTML', () => {
  const html = '<table><tr><th>Valor total (COP)</th><td>$ 1.250.000</td></tr></table>';
  assert.equal(_internals.sanitizeEmailText(html), html);
});
