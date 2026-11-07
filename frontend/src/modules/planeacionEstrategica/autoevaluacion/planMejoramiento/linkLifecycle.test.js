import { readLinkResult, unlinkLocalActivity, resolveLinkOperation } from './linkLifecycle';

test('selects ACT-003 among old rows sharing one source and permits explicit selection after renaming', () => {
  const rows = ['Generar reportes', 'Generar conflictos', 'Generar reportes prueba'].map((activity, index) => ({ id: `item-${index}`, code: `ACT-00${index + 2}`, activity, pm_plan_id: 3, pm_actividad_uid: 'shared' }));
  const candidate = { id: 'destination', existing_activities: rows };
  expect(resolveLinkOperation(candidate, { uid: 'shared' }, 3, 'Generar conflictos').updateItem.code).toBe('ACT-003');
  expect(resolveLinkOperation(candidate, { uid: 'shared' }, 3, 'Ajustada').needsSelection).toBe(true);
  expect(resolveLinkOperation(candidate, { uid: 'shared' }, 3, 'Ajustada', 'item-1').updateItem.code).toBe('ACT-003');
});

test('existing ACT-003 is updated by stable ownership even when the local link ID is missing or its name changes', () => {
  const item = { id: 'existing', code: 'ACT-003', activity: 'Generar conflictos', pm_plan_id: 3, pm_actividad_uid: 'source-uid' };
  const candidate = { id: 'destination', existing_activities: [item] };
  const activity = { uid: 'source-uid' };
  expect(resolveLinkOperation(candidate, activity, 3, 'Generar conflictos')).toMatchObject({ updateItem: item, duplicateItem: null });
  expect(resolveLinkOperation(candidate, activity, 3, 'Actividad corregida')).toMatchObject({ updateItem: item, duplicateItem: null });
});

test('same names belonging to another source remain protected from accidental overwrite', () => {
  const item = { id: 'other', activity: 'Generar conflictos', pm_plan_id: 9, pm_actividad_uid: 'different' };
  expect(resolveLinkOperation({ existing_activities: [item] }, { uid: 'source-uid' }, 3, 'Generar conflictos')).toMatchObject({ updateItem: null, duplicateItem: item });
});

test('accepts the explicit update target returned by the server', () => {
  const item = { id: 'existing', activity: 'Anterior' };
  expect(resolveLinkOperation({ linked_action_item_id: 'existing', existing_activities: [item] }, {}, 3, 'Ajustada').updateItem).toBe(item);
});

test('reads the actual nested API response so the Unlink action stays available', () => {
  expect(readLinkResult({ actionItem: { id: 'item', code: 'ACT-004' }, actionPlan: { id: 'plan', code: '2026-DEP', title: 'Plan 2026', leader: 'Responsable' } }))
    .toMatchObject({ linkedActionItemId: 'item', linkedActionPlanId: 'plan', linkedActionPlanCode: '2026-DEP', actionPlanLinkState: 'linked' });
});

test('unlinks locally while preserving edits, indicator dates and evidence', () => {
  const activity = { nombre: 'Ajustada', linkedActionItemId: 'old', fechaInicioLogro: '2026-11-06', seguimientoIndicadores: { Logro: { evidencias: [{ driveFileId: 'document' }] } }, evidenceFolderId: 'folder' };
  const unlinked = unlinkLocalActivity(activity, { lastActionPlanLink: { actionItemId: 'old' } });
  expect(unlinked).toMatchObject({ nombre: 'Ajustada', linkedActionItemId: null, actionPlanLinkState: 'unlinked', evidenceFolderId: 'folder', fechaInicioLogro: '2026-11-06' });
  expect(unlinked.seguimientoIndicadores).toEqual(activity.seguimientoIndicadores);
  expect(unlinked.lastActionPlanLink.actionItemId).toBe('old');
});
