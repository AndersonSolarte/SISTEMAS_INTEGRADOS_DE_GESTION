const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// Ejecutar el bloque real sin abrir conexiones a la base de datos.
const source = fs.readFileSync(path.join(__dirname, 'gestionInformacionController.js'), 'utf8');
const start = source.indexOf('    const buildFallbackRows = ');
const end = source.indexOf('\n    const fallbackRawRows = ', start);
assert.ok(start >= 0 && end > start);
const execute = new Function(
  'rows', 'selectedRawPeriods', 'selectedYears', 'selectedPrograms',
  'selectedSexos', 'selectedNiveles', 'normalizeGeoJoinKey',
  'normalizeSemesterToken', 'normalizeGenero', 'classifyMatriculadosProgramLevel',
  `${source.slice(start, end)}\nreturn buildFallbackRows(rows);`
);
const rows = [
  { anio: 2025, periodo: '1', programa: 'Programa', genero: 'F', total_count: 12 },
  { anio: 2025, periodo: '2', programa: 'Programa', genero: 'F', total_count: 8 },
  { anio: 2026, periodo: '1', programa: 'Programa', genero: 'F', total_count: 9 }
];
const run = (periods = [], years = [], programs = []) => execute(
  rows, new Set(periods), new Set(years), new Set(programs), new Set(), new Set(),
  (value) => String(value).toUpperCase(), (value) => String(value),
  (value) => value, () => 'PROFESIONAL'
);

test('complementar Matriculados sin filtro de período no lanza ReferenceError', () => {
  assert.equal(run().reduce((sum, row) => sum + row.total_count, 0), 29);
});
test('complementar respeta el año y semestre del período completo', () => {
  const result = run(['2025-1']);
  assert.equal(result.length, 1);
  assert.equal(result[0].total_count, 12);
  assert.equal(result[0].anio, 2025);
});
test('complementar acepta varios períodos y filtros de año y programa', () => {
  assert.equal(run(['2025-2', '2026-1']).length, 2);
  assert.equal(run(['1'], ['2026'])[0].total_count, 9);
  assert.equal(run([], [], ['OTRO PROGRAMA']).length, 0);
  assert.equal(run(['__NONE__']).length, 0);
});
