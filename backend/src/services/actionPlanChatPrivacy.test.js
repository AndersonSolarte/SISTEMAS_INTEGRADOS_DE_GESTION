const test = require('node:test');
const assert = require('node:assert/strict');
const { filterChatPayload } = require('./actionPlanChatPrivacy');
const { resolveAdminChatRecipient } = require('./actionPlanChatRecipientService');
const shared = { id: 'shared', sender_id: 'leader', recipient_id: 'planning', channel_kind: 'leader_planning', private_channel: true, message: 'Shared' };
const privateMessage = { id: 'private', sender_id: 'admin', recipient_id: 'planning', recipient_type: 'planning_effectiveness', message: 'Secret' };
const reply = { id: 'reply', sender_id: 'planning', recipient_id: 'admin', recipient_type: 'administrator', private_channel: true, message: 'Private reply' };

test('administrator cannot read leader-planning messages or their summary fields', () => {
  const message = { sender_id: 'leader', recipient_id: 'planning', private_channel: true, channel_kind: 'leader_planning', message: 'Leader secret' };
  const payload = { metadata: { chat_thread: [message, shared], chat_archive: [message], last_planning_response: { comment: 'Leader secret' }, adjustments_history: [{ comment: 'Leader secret' }] } };
  const result = filterChatPayload(payload, { id: 'admin', role: 'administrador' });
  assert.deepEqual(result.metadata.chat_thread, []);
  assert.ok(!JSON.stringify(result).includes('Leader secret'));
  for (const user of [{ id: 'leader', role: 'consulta' }, { id: 'planning', role: 'planeacion_efectividad' }]) {
    assert.equal(filterChatPayload(payload, user).metadata.chat_thread.length, 2);
  }
});

test('leader and unrelated accounts never receive private messages, including archives and nested plans', () => {
  const payload = { data: { chat_thread: [shared, privateMessage, reply], actionPlan: { metadata: { chat_thread: [privateMessage], chat_archive: [reply] } } } };
  for (const user of [{ id: 'leader', role: 'consulta' }, { id: 'other', role: 'administrador' }, { id: 'other', role: 'planeacion_efectividad' }]) {
    const result = filterChatPayload(payload, user);
    assert.deepEqual(result.data.chat_thread, user.id === 'leader' ? [shared] : []);
    assert.deepEqual(result.data.actionPlan.metadata.chat_thread, []);
    assert.deepEqual(result.data.actionPlan.metadata.chat_archive, []);
    assert.ok(!JSON.stringify(result).includes('Secret'));
  }
  assert.equal(payload.data.chat_thread.length, 3, 'serialization must not mutate stored history');
});

test('only both participants receive their private conversation', () => {
  for (const user of [{ id: 'admin', role: 'administrador' }, { id: 'planning', role: 'planeacion_efectividad' }]) {
    assert.equal(filterChatPayload({ chat_thread: [privateMessage, reply] }, user).chat_thread.length, 2);
  }
});

test('planning can reply only to the administrator who wrote to that account', async () => {
  const plan = { metadata: { chat_thread: [privateMessage] } };
  const users = { findOne: async query => {
    assert.deepEqual(query.where, { id: 'admin', role: 'administrador', estado: 'activo' });
    return { id: 'admin', nombre: 'Admin', email: 'admin@example.test' };
  } };
  const delivery = await resolveAdminChatRecipient({ actor: { id: 'planning', role: 'planeacion_efectividad' }, plan, recipient: 'administrator:admin', users });
  assert.equal(delivery.user.id, 'admin');
  await assert.rejects(resolveAdminChatRecipient({ actor: { id: 'other', role: 'planeacion_efectividad' }, plan, recipient: 'administrator:admin', users }), { statusCode: 403 });
  await assert.rejects(resolveAdminChatRecipient({ actor: { id: 'leader', role: 'consulta' }, plan, recipient: 'administrator:admin', users }), { statusCode: 403 });
});
