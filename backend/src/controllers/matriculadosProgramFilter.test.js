const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Sequelize, Op, fn, col, where: sqlWhere } = require('sequelize');

// Generar el SQL del bloque real sin conectar a ningún servidor.
const source = fs.readFileSync(path.join(__dirname, 'gestionInformacionController.js'), 'utf8');
const start = source.indexOf('  if (selectedPrograms.size > 0) {');
const end = source.indexOf('\n  if (anios && anios.length > 0)', start);
assert.ok(start >= 0 && end > start);
const build = new Function('selectedPrograms', 'fn', 'col', 'sqlWhere', 'Op',
  `const dbWhere = {};\n${source.slice(start, end)}\nreturn dbWhere;`);
const db = new Sequelize('test', 'test', 'test', { dialect: 'postgres', logging: false });
const generator = db.getQueryInterface().queryGenerator;

test('el filtro SQL normaliza el nombre igual que el filtro en memoria', () => {
  const condition = build(new Set(['INGENIERIA FINANCIERA', 'INGENIERIA INDUSTRIAL']), fn, col, sqlWhere, Op);
  const sql = generator.selectQuery('poblacional_matriculados', { where: condition });
  assert.match(sql, /btrim\(regexp_replace\(translate\(upper\("programa"\)/);
  assert.match(sql, /IN \('INGENIERIA FINANCIERA', 'INGENIERIA INDUSTRIAL'\)/);
  assert.ok(!sql.includes('ILIKE'));
});
test('sin programa seleccionado la consulta no restringe programas', () => {
  const condition = build(new Set(), fn, col, sqlWhere, Op);
  assert.equal(Reflect.ownKeys(condition).length, 0);
});
