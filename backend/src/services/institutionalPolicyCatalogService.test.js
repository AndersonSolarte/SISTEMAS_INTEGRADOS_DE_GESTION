const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { parsePolicyWorkbook, preparePolicy } = require('./institutionalPolicyCatalogService');

const workbook = (rows) => {
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(rows), 'Políticas');
  return XLSX.write(book, { type: 'buffer', bookType: 'xlsx' });
};

test('groups each action line under its own policy and removes duplicate rows', () => {
  const result = parsePolicyWorkbook(workbook([
    ['Políticas', 'Líneas de Acción'],
    ['Política de Calidad', 'Seguimiento'],
    ['Política de Calidad', 'Mejora continua'],
    [' politica de calidad ', ' Seguimiento '],
    ['Política de Bienestar', 'Atención integral']
  ]));
  assert.equal(result.length, 2);
  assert.deepEqual(result[0].actionLines, ['Seguimiento', 'Mejora continua']);
  assert.deepEqual(result[1].actionLines, ['Atención integral']);
});

test('preserves full action line text, including punctuation', () => {
  const result = parsePolicyWorkbook(workbook([
    ['POLITICAS', 'LINEAS DE ACCION'], ['Política', 'Investigar; evaluar | mejorar']
  ]));
  assert.deepEqual(result[0].actionLines, ['Investigar; evaluar | mejorar']);
});

test('rejects incomplete rows and missing headers before importing any data', () => {
  assert.throws(() => parsePolicyWorkbook(workbook([['Políticas', 'Líneas de Acción'], ['Política', '']])), { status: 422 });
  assert.throws(() => parsePolicyWorkbook(workbook([['Nombre', 'Valor'], ['Algo', 'Otro']])), { status: 422 });
});

test('a manually created policy may start without lines and acquire them later', () => {
  const policy = preparePolicy({ name: ' Política Curricular ' });
  assert.equal(policy.name, 'Política Curricular');
  assert.deepEqual(policy.actionLines, []);
  assert.equal(policy.normalized_key, preparePolicy({ name: 'POLITICA CURRICULAR' }).normalized_key);
  assert.deepEqual(preparePolicy({ name: policy.name, actionLines: ['Actualizar currículos', ' actualizar curriculos '] }).actionLines, ['actualizar curriculos']);
});

test('rejects empty policy names and malformed or blank action lines', () => {
  for (const value of [{ name: ' ' }, { name: 5 }, { name: 'Política', actionLines: 'Línea' }, { name: 'Política', actionLines: [' '] }]) {
    assert.throws(() => preparePolicy(value), { status: 422 });
  }
});

test('reports all processed rows separately from distinct lines and repeated rows', () => {
  const result = parsePolicyWorkbook(workbook([
    ['Políticas', 'Líneas de Acción'], ['Política A', 'Línea 1'],
    ['Política A', 'Línea 1'], ['Política A', 'Línea 2']
  ]), { withSummary: true });
  assert.equal(result.processedRows, 3);
  assert.equal(result.uniqueLines, 2);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.policies.length, 1);
});
