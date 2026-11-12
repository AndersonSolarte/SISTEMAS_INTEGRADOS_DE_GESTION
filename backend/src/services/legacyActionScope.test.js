const test = require('node:test');
const assert = require('node:assert/strict');
const { dependencyCode, historicalYear, chooseLegacyUnit, sourceScope, scopeFromPlanCode, preferredLegacyUnitIds } = require('./legacyActionScope');
const { sameLegacyActivity, isLegacyItem, stripLegacyProvenance } = require('./legacyActionIdentity');

test('normalizes leading zeros without confusing R2, R21 or R200', () => {
  assert.equal(dependencyCode('R02_Vicerrectoría'), 'R2');
  assert.equal(dependencyCode('LEG-R2'), 'R2');
  assert.equal(dependencyCode('R21 Planeación'), 'R21');
  assert.equal(dependencyCode('DEP-002'), null);
  assert.equal(sourceScope({ anio: 2026, responsable: 'R02 Académica' }), sourceScope({ anio: 2026, responsable: 'R2_Otro nombre' }));
});
test('official code wins over generic name, old catalog and disabled historical unit', () => {
  const units = [
    { id: 'wrong', code: 'R21', name: 'Académica' },
    { id: 'old', code: 'DEP-042', name: 'Académica', metadata: { superseded_by: 'official' } },
    { id: 'official', code: 'R02', name: 'Vicerrectoría Académica', active: false }
  ];
  assert.equal(chooseLegacyUnit(units, 'R2_Académica').id, 'official');
  assert.equal(chooseLegacyUnit([units[0]], 'R2_Académica'), null);
  assert.equal(chooseLegacyUnit([{ code: 'DEP-A', name: 'Académica' }, { code: 'DEP-B', name: 'Académica' }], 'R2_Académica'), null);
  assert.throws(() => chooseLegacyUnit([{ code: 'DEP-A', name: 'Académica' }, { code: 'DEP-B', name: 'Académica' }], 'Académica'), /ambigua/);
});
test('historical workbook cannot seed 2027 or subsequent years', () => {
  for (const year of [2022, 2023, 2024, 2025, 2026]) assert.equal(historicalYear(year), true);
  for (const year of [null, '', 2021, 2027, 2030, '2026.5']) assert.equal(historicalYear(year), false);
});
test('identical activity text never combines different responsible dependencies', () => {
  const row = { anio: 2026, responsable: 'R74_Acompañamiento', actividad: 'Compartida', indicador: 'Informe' };
  const item = { code: 'LEGACY-1', activity: row.actividad, indicator: row.indicador, custom_values: { responsible: 'R75_Otra' } };
  assert.equal(sameLegacyActivity(item, row), false);
  item.custom_values.responsible = 'R074_Acompañamiento';
  assert.equal(sameLegacyActivity(item, row), true);
});
test('a native activity copied from the application is protected from historical reconciliation', () => {
  const custom = { legacy_plan_accion_id: 123, legacy_duplicate_of: 'old', strategic_objective: 'OE1', indicator: 'Informe',
    official_observations: { s1: { text: 'No copiar a otra actividad' } } };
  assert.equal(isLegacyItem({ code: 'ACT-006', custom_values: custom }), false);
  assert.equal(isLegacyItem({ code: '2026-R74-006', custom_values: { ...custom, application_created: true } }), false);
  assert.deepEqual(stripLegacyProvenance(custom), { strategic_objective: 'OE1', indicator: 'Informe' });
  assert.equal(custom.legacy_plan_accion_id, 123);
});

test('R86 repeated names use explicit annual plan evidence or a new isolated coded identity', () => {
  const units = [
    { id: 'a', code: 'DEP-001', name: 'Coordinación de Semilleros de Investigación.' },
    { id: 'b', code: 'DEP-002', name: 'Coordinación de Semilleros de Investigación.' }
  ];
  const source = 'R86_Coordinación de Semilleros de Investigación.';
  assert.equal(chooseLegacyUnit(units, source), null);
  assert.equal(chooseLegacyUnit(units, source, ['b']).id, 'b');
  units[1].metadata = { legacy_dependency_code: 'R86' };
  assert.equal(chooseLegacyUnit(units, source).id, 'b');
  assert.equal(chooseLegacyUnit([...units, { id: 'canonical', code: 'LEG-R86', name: 'Semilleros' }], source, ['canonical']).id, 'canonical');
});

test('annual plan evidence cannot select another official responsible code', () => {
  const units = [{ id: 'wrong', code: 'R87', name: 'Semilleros' }, { id: 'official', code: 'R86', name: 'Semilleros' }];
  assert.equal(chooseLegacyUnit(units, 'R86_Semilleros', ['wrong']).id, 'official');
  assert.equal(chooseLegacyUnit([units[0]], 'R86_Semilleros', ['wrong']), null);
});

test('all reconciliation stages use the same exact annual plan evidence for R86', () => {
  const term = { id: 'term-2026', year: 2026 };
  const plans = [
    { code: '2026-R86', term_id: term.id, catalog_item_id: 'correct' },
    { code: '2026-DEP-001', term_id: term.id, catalog_item_id: 'correct', metadata: { legacy_dependency_scope: '2026:R86' } },
    { code: '2026-LEG-R86', term_id: term.id, catalog_item_id: 'correct' },
    { code: 'LEGACY-2026-R86', term_id: term.id, catalog_item_id: 'older' },
    { code: '2025-R86', term_id: 'term-2025', catalog_item_id: 'past' },
    { code: '2026-R86', term_id: 'another-ped-term', catalog_item_id: 'other-ped' },
    { code: '2026-R86', term_id: term.id, catalog_item_id: 'deleted', deleted_at: new Date() },
    { code: '2026-R87', term_id: term.id, catalog_item_id: 'other-responsible', metadata: { legacy_dependency_scope: '2026:R86' } }
  ];
  const source = 'R86_Semilleros';
  const units = [
    { id: 'older', code: 'DEP-086', metadata: { legacy_dependency_code: 'R86' } },
    { id: 'correct', code: 'LEG-R86' }
  ];
  assert.deepEqual(preferredLegacyUnitIds(plans, term, source), ['correct']);
  assert.equal(scopeFromPlanCode('2026-LEG-R86'), '2026:R86');
  assert.equal(chooseLegacyUnit(units, source, preferredLegacyUnitIds(plans, term, source)).id, 'correct');
});
