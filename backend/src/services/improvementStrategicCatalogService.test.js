const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildStrategicCatalog } = require('./improvementStrategicCatalogService');
const levels = [{ id: 'objectives', position: 1 }, { id: 'guidelines', position: 2 }];

test('uses exact Action Plan labels and each guideline belongs only to its parent', () => {
  const elements = [
    { id: 'o1', level_id: 'objectives', code: 'OE1', name: 'Objetivo uno' },
    { id: 'o2', level_id: 'objectives', code: 'OE2', name: 'Objetivo dos' },
    { id: 'g1', level_id: 'guidelines', parent_id: 'o1', code: 'LE-001', name: 'Lineamiento del primero' },
    { id: 'g2', level_id: 'guidelines', parent_id: 'o2', code: 'LE-002', name: 'Lineamiento del segundo' }
  ];
  const original = JSON.stringify(elements);
  const result = buildStrategicCatalog({ id: 'p', code: 'PED' }, levels, elements);
  assert.deepEqual(result.objectiveProjects['OE1 Objetivo uno'], ['LE-001 Lineamiento del primero']);
  assert.deepEqual(result.objectiveProjects['OE2 Objetivo dos'], ['LE-002 Lineamiento del segundo']);
  assert.equal(JSON.stringify(elements), original);
});

test('legacy PED uses the established 4/6/3 grouping, preserving database names', () => {
  const elements = [1, 2, 3].map((number) => ({ id: `o${number}`, level_id: 'objectives', code: `OE${number}`, name: `Objective ${number}` }));
  for (let number = 1; number <= 13; number += 1) elements.push({ id: `g${number}`, level_id: 'guidelines', code: `LE-${String(number).padStart(3, '0')}`, name: `Guideline ${number}` });
  const result = buildStrategicCatalog({ code: 'PED-2022-2029' }, levels, elements);
  assert.deepEqual(result.strategicRelations.map((r) => r.guidelines.length), [4, 6, 3]);
  assert.equal(result.strategicRelations[1].guidelines[0].code, 'LE-005');
  assert.equal(result.strategicRelations[2].guidelines[0].code, 'LE-011');
});

test('does not invent relationships for future plans or include inactive guidelines', () => {
  const result = buildStrategicCatalog({ code: 'PED-FUTURE' }, levels, [
    { id: 'o', level_id: 'objectives', code: 'OE1', name: 'Objective' },
    { id: 'g', level_id: 'guidelines', code: 'LE-001', name: 'No parent' },
    { id: 'deleted', level_id: 'guidelines', parent_id: 'o', code: 'LE-002', name: 'Deleted', deleted_at: '2026-01-01' }
  ]);
  assert.deepEqual(result.objectiveProjects['OE1 Objective'], []);
});
