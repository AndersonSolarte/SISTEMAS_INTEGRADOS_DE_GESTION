const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const { sequelize } = require('../config/database');
const bridge = require('./strategicLegacyActionPlanService');

async function runRepair({ officialLeader = false, conflictingLeader = false, pausedLeader = false } = {}) {
  const restores = [];
  const stub = (obj, key, fn) => { restores.push([obj, key, obj[key]]); obj[key] = fn; };
  const record = (data) => ({ ...data, async update(values) { Object.assign(this, values); return this; } });
  const term = { id: 'term', year: 2026, strategic_plan_id: 'ped' };
  const unit = { id: 'unit', code: 'R74', strategic_plan_id: 'ped' };
  const legacy = record({ ...(conflictingLeader ? { responsible_user_id: 11 } : {}), id: 'old', code: 'LEGACY-2026-R74', term_id: 'term', catalog_item_id: 'older-unit', term, organizationalUnit: unit, created_at: '2026-01-01' });
  const official = record({ ...(pausedLeader ? { responsible_user_id: null, responsibility_id: null, metadata: { leader_assignment_paused: true } } : {}), ...(officialLeader ? { responsible_user_id: 9 } : {}), id: 'official', code: '2026-R74', term_id: 'term', catalog_item_id: 'unit', term, organizationalUnit: unit, created_at: '2026-02-01' });
  const futurePlan = record({ id: 'future', code: '2027-R74', term_id: 'future-term', catalog_item_id: 'unit', term: { year: 2027 }, organizationalUnit: unit });
  const otherPlan = record({ id: 'other', code: '2026-R75', term_id: 'term', catalog_item_id: 'other-unit', term, organizationalUnit: { code: 'R75' } });
  const importedFuture = record({ id: 'future-import', code: 'LEGACY-10', custom_values: { legacy_plan_accion_id: 10 }, actionPlan: futurePlan });
  const nativeFuture = record({ id: 'future-native', code: 'ACT-001', custom_values: { legacy_plan_accion_id: 10 }, actionPlan: futurePlan });
  const manual = record({ id: 'manual', code: 'ACT-006', action_plan_id: 'old', custom_values: {} });
  const imported = record({ id: 'imported', code: 'LEGACY-11', action_plan_id: 'old', custom_values: { legacy_plan_accion_id: 11 } });
  const assignment = record({ user_id: 11, id: 'leader', action_plan_id: 'old', term_id: 'term', catalog_item_id: 'unit', responsibility_type: 'action_plan_leader', status: 'active' });
  const reviewer = record({ id: 'reviewer', action_plan_id: 'old', term_id: 'term', catalog_item_id: 'unit', responsibility_type: 'reviewer', status: 'active' });
  let reconciliations = 0;
  const movedRelations = [];
  stub(models.User, 'findOne', async () => ({ id: 9 }));
  stub(models.StrategicResponsibility, 'create', async values => record({ id: 'saved-interface-leader', ...values }));
  stub(bridge, 'reconcileLegacyActionPlans', async () => { reconciliations++; });
  stub(bridge, 'syncMissingPlanLeaders', async () => {});
  stub(sequelize, 'transaction', async (fn) => fn({}));
  stub(sequelize, 'query', async () => {});
  stub(models.PlanAccion, 'findAll', async () => [{ anio: 2026, responsable: 'R74_Acompañamiento' }]);
  // Two catalog rows resolve to the same historical code. The repair must use
  // the same annual plan evidence as reconciliation instead of throwing again.
  stub(models.StrategicCatalogItem, 'findAll', async () => [
    { id: 'older-unit', code: 'LEG-R74', strategic_plan_id: 'ped' },
    { ...unit, code: 'DEP-OFFICIAL-74' }
  ]);
  stub(models.StrategicActionPlan, 'findAll', async () => [legacy, official, futurePlan, otherPlan]);
  stub(models.StrategicActionItem, 'findAll', async ({ where }) => where.action_plan_id ? [manual, imported] : [importedFuture, nativeFuture]);
  stub(models.StrategicActionItem, 'findOne', async () => null);
  stub(models.StrategicResponsibility, 'findAll', async ({ where }) => where.action_plan_id === 'old' ? [assignment, reviewer] : []);
  for (const model of [models.StrategicMeeting, models.StrategicWorkflowEvent, models.StrategicNotification]) {
    stub(model, 'update', async (values, { where }) => movedRelations.push({ values, where }));
  }
  const modulePath = require.resolve('./repairLegacyActionPlanScope');
  delete require.cache[modulePath];
  try {
    const result = await require(modulePath).repairLegacyActionPlanScope();
    if (conflictingLeader) {
      assert.equal(result.merged, 0);
      assert.equal(legacy.deleted_at, undefined);
      assert.equal(legacy.responsible_user_id, 11);
      assert.equal(official.responsible_user_id, 9);
      assert.equal(manual.action_plan_id, 'old');
      return;
    }
    assert.deepEqual(result, { merged: 1, archivedOutsideHistory: 1 });
    assert.ok(importedFuture.deleted_at);
    assert.equal(nativeFuture.deleted_at, undefined);
    assert.equal(manual.action_plan_id, 'official');
    assert.equal(manual.deleted_at, undefined);
    assert.equal(imported.id, 'imported');
    assert.equal(imported.action_plan_id, 'official');
    assert.ok(legacy.deleted_at);
    assert.equal(futurePlan.deleted_at, undefined);
    assert.equal(otherPlan.deleted_at, undefined);
    assert.equal(assignment.action_plan_id, 'official');
    assert.equal(assignment.status, officialLeader || pausedLeader ? 'ended' : 'active');
    if (pausedLeader) {
      assert.equal(official.responsible_user_id, null);
      assert.equal(official.responsibility_id, null);
      assert.equal(official.metadata.leader_assignment_paused, true);
    }
    if (officialLeader) {
      assert.equal(official.responsible_user_id, 9);
      assert.equal(official.responsibility_id, 'saved-interface-leader');
    }
    assert.equal(reviewer.status, 'ended');
    assert.equal(movedRelations.length, 3);
    assert.equal(reconciliations, 2);
  } finally {
    for (const [obj, key, fn] of restores.reverse()) obj[key] = fn;
    delete require.cache[modulePath];
  }

}

test('repair merges only the same annual dependency and preserves native activities and leader history', () => runRepair());
test('repair keeps the interface-assigned leader and recreates its missing responsibility instead of reviving an old owner', () => runRepair({ officialLeader: true }));

test('conflicting interface-assigned leaders require review rather than automatic replacement', () => runRepair({ officialLeader: true, conflictingLeader: true }));

test('merging historical plans respects an explicitly unassigned leader', () => runRepair({ pausedLeader: true }));
