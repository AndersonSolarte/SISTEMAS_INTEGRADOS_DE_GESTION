const { test } = require('node:test');
const assert = require('node:assert/strict');
const { buildStrategicCatalog } = require('./improvementStrategicCatalogService');
const levels = [{ id: 'objectives', position: 1 }, { id: 'guidelines', position: 2 }];

test('a guideline referencing an older objective version follows that same objective code', () => {
  const result = buildStrategicCatalog({ code: 'PED' }, levels, [
    { id: 'old', code: 'OE1', level_id: 'objectives', active: false },
    { id: 'new', code: 'OE1', name: 'Updated', level_id: 'objectives', version: 2 },
    { id: 'other', code: 'OE2', name: 'Other', level_id: 'objectives' },
    { id: 'line', code: 'LE-001', name: 'Own guideline', level_id: 'guidelines', parent_id: 'old' }
  ]);
  assert.equal(result.strategicRelations[0].guidelines.length, 1);
  assert.equal(result.strategicRelations[1].guidelines.length, 0);
});

test('linked action plans use their own captured hierarchy and never mix guideline ownership', () => {
  const { buildSnapshotStrategicCatalog } = require('./improvementStrategicCatalogService');
  const result = buildSnapshotStrategicCatalog({ id: 'ped', code: 'PED' }, { levels, elements: [
    { id: 'o1', code: 'OE1', name: 'First', level_id: 'objectives' },
    { id: 'o2', code: 'OE2', name: 'Second', level_id: 'objectives' },
    { id: 'g1', code: 'LE-001', name: 'First guideline', level_id: 'guidelines', parent_id: 'o1' },
    { id: 'g2', code: 'LE-002', name: 'Second guideline', level_id: 'guidelines', parent_id: 'o2' }
  ] });
  assert.deepEqual(result.strategicRelations.map((row) => row.guidelines.map((line) => line.code)), [['LE-001'], ['LE-002']]);
  assert.equal(buildSnapshotStrategicCatalog({ id: 'ped' }, {}), null);
});

test('reads objectives and guidelines by level name when an axis level comes first', () => {
  const result = buildStrategicCatalog({ code: 'PED' }, [
    { id: 'axis', name: 'Eje estratégico', position: 1 },
    { id: 'o', name: 'Objetivo estratégico', position: 2 },
    { id: 'g', name: 'Lineamiento estratégico', position: 3 }
  ], [{ id: 'objective', level_id: 'o', code: 'OE1', name: 'Objective' }, { id: 'guideline', level_id: 'g', code: 'LE-001', name: 'Guideline', parent_id: 'objective' }]);
  assert.equal(result.strategicRelations[0].code, 'OE1');
  assert.equal(result.strategicRelations[0].guidelines[0].code, 'LE-001');
});

test('field-configured Action Plan dropdowns are available even without imported elements', () => {
  const { buildFieldStrategicCatalog } = require('./improvementStrategicCatalogService');
  const result = buildFieldStrategicCatalog({ id: 'p', code: 'PED-2022-2029' }, [
    { key: 'strategic_objective', options: ['OE1 Objetivo del campo', 'OE2 Segundo objetivo'] },
    { key: 'strategic_guideline', options: ['LE-001 Lineamiento del campo', 'LE-005 Otro lineamiento'] }
  ]);
  assert.equal(result.strategicRelations.length, 2);
  assert.equal(result.strategicRelations[0].label, 'OE1 Objetivo del campo');
  assert.equal(result.strategicRelations[0].guidelines[0].label, 'LE-001 Lineamiento del campo');
  assert.equal(result.strategicRelations[1].guidelines[0].code, 'LE-005');
});

test('resolves configured PED from an active term when the PED itself lacks active status', async () => {
  const { StrategicPlan, StrategicTerm, StrategicLevel, StrategicElement } = require('../models');
  const { readActionPlanStrategicCatalog } = require('./improvementStrategicCatalogService');
  const originals = [StrategicPlan.findOne, StrategicTerm.findOne, StrategicLevel.findAll, StrategicElement.findAll];
  StrategicPlan.findOne = async ({ where }) => where.status ? null : { id: 'term-ped', code: 'PED', configuration_version: 1 };
  StrategicTerm.findOne = async () => ({ strategic_plan_id: 'term-ped' });
  StrategicLevel.findAll = async () => levels;
  StrategicElement.findAll = async () => [{ id: 'o', level_id: 'objectives', code: 'OE1', name: 'Stored objective' }, { id: 'g', parent_id: 'o', level_id: 'guidelines', code: 'LE1', name: 'Stored guideline' }];
  try {
    const result = await readActionPlanStrategicCatalog();
    assert.equal(result.strategicSource.id, 'term-ped');
    assert.equal(result.strategicRelations[0].guidelines.length, 1);
  } finally { [StrategicPlan.findOne, StrategicTerm.findOne, StrategicLevel.findAll, StrategicElement.findAll] = originals; }
});

test('uses active legacy levels referenced by existing elements if configuration version changed', async () => {
  const { StrategicPlan, StrategicLevel, StrategicElement } = require('../models');
  const { readActionPlanStrategicCatalog } = require('./improvementStrategicCatalogService');
  const originals = [StrategicPlan.findOne, StrategicLevel.findAll, StrategicElement.findAll];
  StrategicPlan.findOne = async () => ({ id: 'p', code: 'PED', configuration_version: 2 });
  StrategicLevel.findAll = async ({ where }) => where.configuration_version ? [] : levels;
  StrategicElement.findAll = async () => [{ id: 'o', level_id: 'objectives', code: 'OE1', name: 'Existing objective' }];
  try { assert.equal((await readActionPlanStrategicCatalog('p')).strategicRelations.length, 1); }
  finally { [StrategicPlan.findOne, StrategicLevel.findAll, StrategicElement.findAll] = originals; }
});

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

test('an explicit PED is read even when another PED is active', async () => {
  const { StrategicPlan, StrategicLevel, StrategicElement } = require('../models');
  const { readActionPlanStrategicCatalog } = require('./improvementStrategicCatalogService');
  const original = [StrategicPlan.findOne, StrategicLevel.findAll, StrategicElement.findAll];
  StrategicPlan.findOne = async ({ where }) => {
    assert.equal(where.id, 'linked-ped');
    assert.equal(where.status, undefined);
    return { id: 'linked-ped', code: 'LINKED', configuration_version: 3 };
  };
  StrategicLevel.findAll = async ({ where }) => {
    assert.equal(where.strategic_plan_id, 'linked-ped');
    assert.equal(where.configuration_version, 3);
    return levels;
  };
  StrategicElement.findAll = async ({ where }) => {
    assert.equal(where.strategic_plan_id, 'linked-ped');
    return [{ id: 'o', level_id: 'objectives', code: 'OE9', name: 'Linked objective' }];
  };
  try {
    const catalog = await readActionPlanStrategicCatalog('linked-ped');
    assert.equal(catalog.strategicSource.id, 'linked-ped');
    assert.deepEqual(catalog.strategicObjectives, ['OE9 Linked objective']);
  } finally {
    [StrategicPlan.findOne, StrategicLevel.findAll, StrategicElement.findAll] = original;
  }
});
