const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readCatalogSources } = require('./improvementCatalogSources');
test('template failure does not hide objectives, guidelines or central policies', async () => {
  const strategic = { strategicRelations: [{ label: 'OE1', guidelines: [{ label: 'LE1' }] }] };
  const result = await readCatalogSources({ base: Promise.reject(new Error('Template unavailable')), policies: Promise.resolve([{ name: 'Policy' }]), strategic: Promise.resolve(strategic) });
  assert.deepEqual(result.strategicRelations, strategic.strategicRelations);
  assert.equal(result.institutionalPolicies.length, 1);
  assert.equal(result.catalogWarnings.length, 1);
});
test('policy failure does not block PED and no template objectives masquerade as PED data', async () => {
  const result = await readCatalogSources({ base: Promise.resolve({ strategicObjectives: ['Wrong Excel value'], processes: ['Process'] }), policies: Promise.reject(new Error('Table unavailable')), strategic: Promise.resolve({ strategicObjectives: ['Database objective'] }) });
  assert.deepEqual(result.strategicObjectives, ['Database objective']);
  assert.deepEqual(result.processes, ['Process']);
  assert.equal(result.institutionalPolicies, undefined);
});
test('temporary strategic lookup failure does not send empty lists that erase cached options', async () => {
  const result = await readCatalogSources({ base: Promise.resolve({ strategicObjectives: ['Excel value'] }), policies: Promise.resolve([]), strategic: Promise.reject(new Error('Timeout')) });
  assert.equal(Object.hasOwn(result, 'strategicObjectives'), false);
  assert.equal(Object.hasOwn(result, 'strategicRelations'), false);
});
