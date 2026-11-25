const test = require('node:test');
const assert = require('node:assert/strict');
const { resolveAdminChatRecipient, notifyAdminChatRecipient } = require('./actionPlanChatRecipientService');
const actor = { id: 'admin', role: 'administrador', nombre: 'Admin' };
const plan = { id: 'plan', code: '2026-R74', responsible_user_id: 'leader', metadata: {} };

test('administrator cannot select a leader, even when also assigned as leader', async () => {
  for (const responsible_user_id of ['leader', 'admin']) {
    await assert.rejects(resolveAdminChatRecipient({ actor, plan: { ...plan, responsible_user_id }, recipient: 'leader', users: { findOne: async () => { throw new Error('Must not look up or notify leader'); } } }), { statusCode: 422 });
  }
});

test('planning selection resolves only the active effectiveness role', async () => {
  const result = await resolveAdminChatRecipient({ actor, plan, recipient: 'planning_effectiveness', users: { findOne: async query => {
    assert.deepEqual(query.where, { role: 'planeacion_efectividad', estado: 'activo' });
    return { id: 'planning' };
  } } });
  assert.equal(result.user.id, 'planning');
});

test('other roles cannot select a recipient', async () => {
  for (const role of ['consulta', 'planeacion_efectividad', 'planeacion_estrategica']) {
    await assert.rejects(resolveAdminChatRecipient({ actor: { ...actor, role }, plan, recipient: 'leader', users: {} }), { statusCode: 403 });
  }
});

test('invalid, unassigned, inactive and own-account recipients are rejected', async () => {
  await assert.rejects(resolveAdminChatRecipient({ actor, plan, recipient: 'arbitrary-user', users: {} }), { statusCode: 422 });
  await assert.rejects(resolveAdminChatRecipient({ actor, plan: { ...plan, responsible_user_id: null }, recipient: 'leader', users: {} }), { statusCode: 422 });
  await assert.rejects(resolveAdminChatRecipient({ actor, plan: { ...plan, metadata: { leader_assignment_paused: true } }, recipient: 'leader', users: {} }), { statusCode: 422 });
  await assert.rejects(resolveAdminChatRecipient({ actor, plan, recipient: 'planning_effectiveness', users: { findOne: async () => null } }), { statusCode: 422 });
  await assert.rejects(resolveAdminChatRecipient({ actor, plan, recipient: 'leader', users: { findOne: async () => actor } }), { statusCode: 422 });
});

test('each selection sends exactly one notification and email to that recipient', async () => {
  for (const type of ['leader', 'planning_effectiveness']) {
    const notices = [], emails = [];
    await notifyAdminChatRecipient({ actor, plan, delivery: { type, user: { id: type, name: 'Recipient', email: type + '@example.test' } },
      message: { id: 'message', sender_name: 'Admin', message: '<script>unsafe</script>' }, baseUrl: 'http://localhost:3000',
      notifications: { create: async value => notices.push(value) }, sendEmail: async value => emails.push(value) });
    assert.equal(notices.length, 1);
    assert.equal(notices[0].user_id, type);
    assert.match(notices[0].link, type === 'leader' ? /plan-accion-mi-plan/ : /planeacion-efectividad/);
    assert.equal(emails.length, 1);
    assert.equal(emails[0].to, type === 'planning_effectiveness' ? 'planeacionestrategica@unicesmag.edu.co' : type + '@example.test');
    assert.equal(emails[0].cc, undefined);
    assert.ok(!emails[0].html.includes('<script>unsafe</script>'));
  }
});
