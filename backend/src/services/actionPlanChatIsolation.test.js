const test = require('node:test');
const assert = require('node:assert/strict');
const { conversationId, filterChatPayload, protectChatMetadata } = require('./actionPlanChatPrivacy');
const { resolveAdminChatRecipient, resolveLeaderPlanningRecipient, notifyAdminChatRecipient } = require('./actionPlanChatRecipientService');
const message = { sender_id: 'leader-a', recipient_id: 'planning-a', private_channel: true, channel_kind: 'leader_planning', message: 'Only pair A' };

test('each conversation identity is unique to the plan and both participants', () => {
  assert.equal(conversationId('plan-a', 'leader-a', 'planning-a'), conversationId('plan-a', 'planning-a', 'leader-a'));
  assert.notEqual(conversationId('plan-a', 'leader-a', 'planning-a'), conversationId('plan-b', 'leader-a', 'planning-a'));
  assert.notEqual(conversationId('plan-a', 'leader-a', 'planning-a'), conversationId('plan-a', 'leader-b', 'planning-a'));
});

test('other leaders, planners and administrators cannot read messages, archives or summary copies', () => {
  const payload = { responsible_user_id: 'new-leader', metadata: { chat_thread: [message], chat_archive: [message],
    last_planning_response: { ...message, comment: 'Only pair A' }, planning_responses_history: [message], adjustments_history: [message] } };
  for (const user of [{ id: 'leader-b', role: 'consulta' }, { id: 'new-leader', role: 'consulta' }, { id: 'planning-b', role: 'planeacion_efectividad' }, { id: 'admin', role: 'administrador' }]) {
    assert.ok(!JSON.stringify(filterChatPayload(payload, user)).includes('Only pair A'));
  }
  assert.equal(filterChatPayload(payload, { id: 'leader-a', role: 'consulta' }).metadata.chat_thread.length, 1);
  assert.equal(filterChatPayload(payload, { id: 'planning-a', role: 'planeacion_efectividad' }).metadata.chat_thread.length, 1);
});

test('messages without a proven recipient stay hidden and stored history is preserved', () => {
  const payload = { metadata: { chat_thread: [{ sender_id: 'leader-a', message: 'Unknown recipient' }] } };
  assert.deepEqual(filterChatPayload(payload, { id: 'planning-a', role: 'planeacion_efectividad' }).metadata.chat_thread, []);
  assert.equal(payload.metadata.chat_thread.length, 1);
});

test('leader conversation stays with its original planner and rejects another planner', async () => {
  const plan = { responsible_user_id: 'leader-a', metadata: { chat_thread: [message] } };
  const users = { findOne: async query => {
    assert.equal(query.where.id, 'planning-a');
    return { id: 'planning-a', email: 'planning-a@example.test' };
  } };
  const result = await resolveLeaderPlanningRecipient({ actor: { id: 'leader-a' }, plan, users });
  assert.equal(result.user.id, 'planning-a');
  await assert.rejects(resolveLeaderPlanningRecipient({ actor: { id: 'planning-b' }, plan, users }), { statusCode: 403 });
  await assert.rejects(resolveLeaderPlanningRecipient({ actor: { id: 'leader-a' }, plan, users: { findOne: async () => null } }), { statusCode: 422 });
});

test('administrator conversation does not switch to another planner', async () => {
  const plan = { metadata: { chat_archive: [{ sender_id: 'admin', recipient_id: 'planning-a', channel_kind: 'admin_planning', recipient_type: 'planning_effectiveness' }] } };
  const result = await resolveAdminChatRecipient({ actor: { id: 'admin', role: 'administrador' }, plan, recipient: 'planning_effectiveness', users: { findOne: async query => {
    assert.equal(query.where.id, 'planning-a');
    return { id: 'planning-a' };
  } } });
  assert.equal(result.user.id, 'planning-a');
});

test('ordinary leader cannot route messages to an administrator', async () => {
  const plan = { metadata: { chat_thread: [{ sender_id: 'admin', recipient_id: 'leader-a', channel_kind: 'admin_leader', recipient_type: 'leader' }] } };
  await assert.rejects(resolveAdminChatRecipient({ actor: { id: 'leader-a', role: 'consulta' }, plan, recipient: 'administrator:admin', users: {} }), { statusCode: 403 });
});

test('client metadata cannot overwrite or forge chat histories', () => {
  const body = { metadata: { chat_thread: [message], chat_archive: [message], adjustments_history: [message], custom: 'preserved' } };
  protectChatMetadata(body);
  assert.deepEqual(body.metadata, { custom: 'preserved' });
});

test('the authenticated API middleware filters nested plan responses before returning JSON', () => {
  const router = require('../routes/strategicPlanningRoutes');
  const middleware = router.stack[1].handle;
  const req = { user: { id: 'planning-b', role: 'planeacion_efectividad' }, body: { metadata: { chat_thread: [message], custom: 'kept' } } };
  let returned, nextCalled = false;
  const res = { json: payload => { returned = payload; } };
  middleware(req, res, () => { nextCalled = true; });
  assert.equal(nextCalled, true);
  assert.deepEqual(req.body.metadata, { custom: 'kept' });
  res.json({ data: { actionPlan: { metadata: { chat_thread: [message], chat_archive: [message] } } } });
  assert.deepEqual(returned.data.actionPlan.metadata.chat_thread, []);
  assert.deepEqual(returned.data.actionPlan.metadata.chat_archive, []);
});

test('notification email and email replies target only the other participant', async () => {
  const emails = [], notifications = [];
  await notifyAdminChatRecipient({ actor: { id: 'leader-a', email: 'leader-a@example.test' }, plan: { id: 'plan-a', code: '2026-R74' },
    delivery: { type: 'planning_leader', user: { id: 'planning-a', email: 'planning-a@example.test' } }, message: { ...message, sender_name: 'Leader A', id: 'msg' }, baseUrl: 'http://localhost:3000',
    sendEmail: async mail => emails.push(mail), notifications: { create: async notice => notifications.push(notice) } });
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'planning-a@example.test');
  assert.equal(emails[0].replyTo, 'leader-a@example.test');
  assert.equal(emails[0].cc, undefined);
  assert.equal(emails[0].bcc, undefined);
  assert.equal(notifications.length, 1);
  assert.equal(notifications[0].user_id, 'planning-a');
});
