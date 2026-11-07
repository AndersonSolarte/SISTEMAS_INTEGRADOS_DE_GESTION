const { test } = require('node:test');
const assert = require('node:assert/strict');
const { reusableLink, detachActivity, belongsToActivity } = require('./improvementLinkLifecycle');

test('legacy shared source identifiers select ACT-003 by name or explicit ID and never guess', () => {
  const items = ['Generar reportes', 'Generar conflictos', 'Generar reportes prueba'].map((activity, index) => ({ id: `item-${index}`, code: `ACT-00${index + 2}`, activity, custom_values: { pm_plan_id: 3, pm_actividad_uid: 'shared' } }));
  assert.equal(reusableLink(items, 3, 'shared', { name: 'Generar conflictos' }).code, 'ACT-003');
  assert.equal(reusableLink(items, 3, 'shared', { name: 'Nombre ajustado', itemId: 'item-1' }).code, 'ACT-003');
  assert.equal(reusableLink(items, 3, 'shared', { name: 'Nombre ajustado' }), undefined);
});

test('unlink, edit and relink reuses the same record without losing evidence or indicators', () => {
  const item = { id: 'item-1', action_plan_id: 'plan-action', code: 'ACT-004', custom_values: { pm_plan_id: 7, pm_actividad_uid: 'activity' } };
  const activity = { uid: 'activity', nombre: 'Original', linkedActionItemId: item.id, linkedActionPlanId: item.action_plan_id,
    indicadorLogro: 'Informe', evidenceFolderId: 'drive-folder', seguimientoIndicadores: { Logro: { porcentaje: 50, evidencias: [{ driveFileId: 'file' }] } } };
  const detached = detachActivity(activity, item, '2026-11-06T12:00:00Z');
  assert.equal(detached.linkedActionItemId, null);
  assert.equal(detached.actionPlanLinkState, 'unlinked');
  assert.deepEqual(detached.seguimientoIndicadores, activity.seguimientoIndicadores);
  assert.equal(detached.evidenceFolderId, 'drive-folder');
  detached.nombre = 'Actividad ajustada';
  Object.assign(item, { deleted_at: new Date(), custom_values: { ...item.custom_values, pm_link_status: 'unlinked' } });
  const reused = reusableLink([item], 7, detached.uid);
  assert.equal(reused.id, 'item-1');
  assert.equal(reused.code, 'ACT-004');
  assert.equal(detached.nombre, 'Actividad ajustada');
});

test('does not revive unrelated or administratively deleted records', () => {
  const removed = { id: 'removed', deleted_at: new Date(), custom_values: { pm_plan_id: 7, pm_actividad_uid: 'activity' } };
  assert.equal(reusableLink([removed], 7, 'activity'), undefined);
  assert.equal(belongsToActivity(removed, 8, 'activity'), false);
  assert.equal(reusableLink([{ ...removed, custom_values: { ...removed.custom_values, pm_link_status: 'unlinked' } }], 7, 'different'), undefined);
});

test('prefers an already active link over an older detached record', () => {
  const values = { pm_plan_id: 7, pm_actividad_uid: 'activity' };
  const active = { id: 'current', custom_values: values };
  const old = { id: 'old', deleted_at: new Date(), custom_values: { ...values, pm_link_status: 'unlinked' } };
  assert.equal(reusableLink([old, active], 7, 'activity'), active);
});
