const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../src/pages/GestionInformacion.js'), 'utf8');
const block = (start, end) => {
  const first = source.indexOf(start);
  const last = source.indexOf(end, first);
  assert.ok(first >= 0 && last > first);
  return source.slice(first, last);
};
const context = vm.createContext({});
vm.runInContext([
  block('const normalizeRawProgramKey =', 'const normalizeGeoNameKey ='),
  block('const CANONICAL_DISPLAY_LABELS =', 'const hasAccents ='),
  block('const uniqueMatriculadosPrograms =', 'const formatCompactNumber ='),
  'this.api = { uniqueMatriculadosPrograms, expandMatriculadosPrograms, normalizeProgramKey };'
].join('\n'), context);
const { uniqueMatriculadosPrograms, expandMatriculadosPrograms, normalizeProgramKey } = context.api;
const catalog = [
  'INGENIERÍA FINANCIERA', 'INGENIERIA FINANCIERA', ' Ingeniería Financiera ',
  'INGENIERÍA INDUSTRIAL', 'INGENIERIA INDUSTRIAL',
  'PSICOLOGÍA', 'PSICOLOGO (A)',
  'ESPECIALIZACIÓN EN GERENCIA DE PROYECTOS', 'MAESTRÍA EN GERENCIA DE PROYECTOS'
];
const options = uniqueMatriculadosPrograms(catalog);
assert.equal(options.length, 5);
assert.equal(options.filter((option) => option.label === 'INGENIERÍA FINANCIERA').length, 1);
assert.equal(options.filter((option) => option.label === 'INGENIERÍA INDUSTRIAL').length, 1);

// Una opción envía todas las variantes, sin agregar programas diferentes.
for (const option of options) {
  const expanded = expandMatriculadosPrograms([option.value], catalog);
  const expected = catalog.filter((name) => normalizeProgramKey(name) === option.value);
  for (const name of expected) assert.ok(expanded.includes(name));
  for (const name of expanded) assert.equal(normalizeProgramKey(name), option.value);
}
assert.equal(expandMatriculadosPrograms([], catalog).length, 0);
assert.equal(expandMatriculadosPrograms(['__NONE__'], catalog).join(), '__NONE__');
console.log('OK: opciones únicas, variantes completas, programas distintos, todos y ninguno.');

vm.runInContext([
  block('const getProgramFacultyOverride =', 'const formatSummaryRate ='),
  'this.classify = classifyProgramFaculty;'
].join('\n'), context);
const financialTechnologies = [
  'TECNOLOGÍA EN GESTIÓN FINANCIERA', 'TECNOLOGIA EN GESTION FINANCIERA',
  'TECNOLOGÍA EN ADMINISTRACIÓN FINANCIERA', 'TECNOLOGIA EN ADMINISTRACION FINANCIERA'
];
const faculty = 'Ciencias Administrativas y Contables';
for (const name of financialTechnologies) assert.equal(context.classify(name), faculty);
assert.equal(context.classify('INGENIERIA FINANCIERA'), 'Ingeniería');
assert.equal(context.classify('INGENIERIA INDUSTRIAL'), 'Ingeniería');
const resolvers = [...source.matchAll(/const resolveFacForProg = \(progName\) => \{([\s\S]*?)\n              \};/g)];
assert.equal(resolvers.length, 2);
for (const resolver of resolvers) {
  // La corrección debe prevalecer incluso ante una facultad errónea en la fuente.
  context.dbProgToFacMap = new Map(financialTechnologies.map((name) => [normalizeProgramKey(name), 'Ingeniería']));
  vm.runInContext(`this.resolveFaculty = (progName) => {${resolver[1]}\n};`, context);
  for (const name of financialTechnologies) assert.equal(context.resolveFaculty(name), faculty);
}
console.log('OK: ambas tecnologías quedan en Administrativas en tabla y tarjetas, incluso con fuente incorrecta.');
