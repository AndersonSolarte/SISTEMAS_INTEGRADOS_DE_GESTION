const { test } = require('node:test');
const assert = require('node:assert/strict');
const { driveMoveParameters } = require('./actionPlanEvidenceLocation');

test('an existing evidence file actually moves when its indicator folder changes', () => {
  assert.deepEqual(driveMoveParameters(['old-folder'], 'indicator-folder'), { addParents: 'indicator-folder', removeParents: 'old-folder' });
  assert.deepEqual(driveMoveParameters(['indicator-folder'], 'indicator-folder'), {});
  assert.throws(() => driveMoveParameters(undefined, 'indicator-folder'), /verificar/);
});
