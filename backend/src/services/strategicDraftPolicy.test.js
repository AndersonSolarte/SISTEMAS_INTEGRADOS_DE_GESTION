const test = require('node:test');
const assert = require('node:assert/strict');
const { canEditDraft, assertDraft, assertVersion, draftPatch } = require('./strategicDraftPolicy');
const meeting = { created_by: 1, status: 'draft', participants: [{ user_id: 2, meeting_role: 'co_responsible' }, { user_id: 3, meeting_role: 'participant' }] };
test('only creator, designated responsible/coauthor and privileged planners may edit', () => {
  assert.equal(canEditDraft({ id: 1 }, meeting), true);
  assert.equal(canEditDraft({ id: 2 }, meeting), true);
  assert.equal(canEditDraft({ id: 3 }, meeting), false);
  assert.equal(canEditDraft({ id: 4, role: 'consulta' }, meeting), false);
  assert.equal(canEditDraft({ id: 4, role: 'planeacion_efectividad' }, meeting), true);
  assert.equal(canEditDraft({ id: 4, role: 'administrador' }, meeting), true);
  assert.equal(canEditDraft({ id: 4, email: 'owner@test' }, { participants: [{ user_id: 99, email: 'owner@test', meeting_role: 'principal' }] }), false);
  assert.equal(canEditDraft({ id: 4, email: 'owner@test' }, { participants: [{ email: 'OWNER@test', meeting_role: 'principal' }] }), true);
});
test('signing or finalized versions close collaborative editing even if meeting status is draft', () => {
  assert.doesNotThrow(() => assertDraft(meeting));
  for (const status of ['signing', 'finalized']) assert.throws(() => assertDraft({ ...meeting, minuteVersions: [{ status }] }), { statusCode: 409 });
  assert.throws(() => assertDraft({ ...meeting, status: 'formalized' }), { statusCode: 409 });
});
test('optimistic concurrency rejects missing and stale versions', () => {
  const row = { updatedAt: '2026-01-01T10:00:00Z' };
  assert.doesNotThrow(() => assertVersion(row, '2026-01-01T10:00:00.000Z'));
  assert.throws(() => assertVersion(row, undefined), { statusCode: 409 });
  assert.throws(() => assertVersion(row, '2025-01-01'), { statusCode: 409 });
});
test('draft patch does not permit changing membership, ownership, signatures or status', () => {
  assert.deepEqual(draftPatch({ objective: 'Shared objective', commitments: ['Conclusion'] }), { objective: 'Shared objective', commitments: ['Conclusion'] });
  for (const field of ['participants', 'created_by', 'status', 'action_plan_id']) assert.throws(() => draftPatch({ [field]: 'x' }), { statusCode: 422 });
  for (const payload of [{ title: '' }, { objective: '' }, { starts_at: 'invalid' }, { commitments: 'text' }]) assert.throws(() => draftPatch(payload), { statusCode: 422 });
});

test('local PostgreSQL: shared rows, authorization, simultaneous writes and signing lock', { skip: process.env.RUN_DRAFT_DB_TESTS !== '1' }, async () => {
  const { sequelize } = require('../config/database');
  assert.ok(['localhost', '127.0.0.1', '::1'].includes(sequelize.config.host), 'Local database only');
  const { User, StrategicActionPlan, StrategicMeeting, StrategicMeetingParticipant, StrategicMinuteVersion, StrategicNotification, StrategicAuditEvent } = require('../models');
  const driveService = require('./strategicPlanningDriveService');
  const originalSync = driveService.syncMinute;
  driveService.syncMinute = async () => null;
  const controller = require('../controllers/strategicDraftController');
  const users = await User.findAll({ limit: 2 });
  const plan = await StrategicActionPlan.findOne({ where: { deleted_at: null } });
  assert.equal(users.length, 2); assert.ok(plan);
  let row;
  const request = async (handler, user, body) => {
    const res = { code: 200, status(code) { this.code = code; return this; }, json(body) { this.body = body; } };
    await handler({ user, body, params: { id: row.id, meetingId: row.id }, headers: {}, get: () => '', ip: '127.0.0.1' }, res); return res;
  };
  try {
    row = await StrategicMeeting.create({ action_plan_id: plan.id, title: 'LOCAL TEST shared draft', type: 'formulation', starts_at: new Date(), objective: 'Original', created_by: users[0].id });
    await StrategicMeetingParticipant.create({ meeting_id: row.id, name: users[1].nombre, user_id: users[1].id, meeting_role: 'co_responsible' });
    await StrategicMinuteVersion.create({ meeting_id: row.id, version: 1, content: {}, content_hash: 'test', status: 'draft', created_by: users[0].id });
    const author = { id: users[0].id, role: 'consulta' }; const coauthor = { id: users[1].id, role: 'consulta' };
    const first = await request(controller.get, coauthor); assert.equal(first.code, 200);
    const list = await request(controller.list, coauthor); assert.ok(list.body.data.some(r => r.id === row.id));
    const denied = await request(controller.get, { id: -999, role: 'consulta' }); assert.equal(denied.code, 403);
    const responses = await Promise.all([request(controller.update, author, { expected_updated_at: first.body.data.updated_at, changes: { objective: 'Author' } }), request(controller.update, coauthor, { expected_updated_at: first.body.data.updated_at, changes: { objective: 'Coauthor' } })]);
    assert.deepEqual(responses.map(r => r.code).sort(), [200, 409]);
    const stored = await row.reload();
    const minute = await StrategicMinuteVersion.findOne({ where: { meeting_id: row.id } });
    assert.equal(minute.content.objetivo[0], stored.objective);
    const mainController = require('../controllers/strategicPlanningController');
    const latest = await request(controller.get, author);
    const mainSave = await request(mainController.updateMeeting, author, { ...latest.body.data, expected_updated_at: latest.body.data.updated_at, objective: 'Institutional editor change', participants: latest.body.data.participants });
    assert.equal(mainSave.code, 200, JSON.stringify(mainSave.body));
    const staleAfterMain = await request(controller.update, coauthor, { expected_updated_at: latest.body.data.updated_at, changes: { objective: 'Stale coauthor edit' } });
    assert.equal(staleAfterMain.code, 409);
    await minute.reload(); await stored.reload();
    assert.equal(minute.content.objetivo[0], stored.objective);
    await controller.notifyDraft(row.id, users[0].id); await controller.notifyDraft(row.id, users[0].id);
    assert.equal(await StrategicNotification.count({ where: { user_id: users[1].id, type: 'action_plan_minute_draft', action_plan_id: plan.id, metadata: { [require('sequelize').Op.contains]: { meeting_id: row.id } } } }), 1);
    await minute.update({ status: 'signing' });
    const locked = await request(controller.update, coauthor, { expected_updated_at: stored.updatedAt, changes: { objective: 'Forbidden after signing' } }); assert.equal(locked.code, 409);
  } finally {
    if (row) {
      await StrategicAuditEvent.destroy({ where: { entity_type: 'meeting', entity_id: row.id } });
      await StrategicNotification.destroy({ where: { metadata: { [require('sequelize').Op.contains]: { meeting_id: row.id } } } });
      await StrategicMinuteVersion.destroy({ where: { meeting_id: row.id } });
      await StrategicMeetingParticipant.destroy({ where: { meeting_id: row.id } });
      await StrategicMeeting.destroy({ where: { id: row.id } });
    }
    driveService.syncMinute = originalSync;
    await sequelize.close();
  }
});
