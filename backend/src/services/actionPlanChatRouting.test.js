const test = require('node:test');
const assert = require('node:assert/strict');

test('chat controller persists the selected recipient and does not broadcast', async t => {
  const models = require('../models');
  const mail = require('./strategicPlanningEmailService');
  const originals = [models.StrategicActionPlan.findByPk, models.User.findOne, models.User.findAll, models.StrategicNotification.create, mail.sendStrategicPlanningEmail];
  const notices = [], emails = [];
  const plan = { id: 'plan', code: '2026-R74', responsible_user_id: 'leader', status: 'active', metadata: {},
    update: async function(values) { Object.assign(this, values); }, save: async () => {} };
  models.StrategicActionPlan.findByPk = async () => plan;
  models.User.findOne = async query => ({ id: query.where.id || 'planning', nombre: 'Recipient', email: (query.where.id || 'planning') + '@example.test' });
  models.User.findAll = async () => { throw new Error('Unexpected broadcast'); };
  models.StrategicNotification.create = async notice => notices.push(notice);
  mail.sendStrategicPlanningEmail = async email => emails.push(email);
  t.after(() => {
    [models.StrategicActionPlan.findByPk, models.User.findOne, models.User.findAll, models.StrategicNotification.create, mail.sendStrategicPlanningEmail] = originals;
  });
  const { sendActionPlanChatMessage } = require('../controllers/strategicPlanningController');
  for (const recipient of ['planning_effectiveness']) {
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    await sendActionPlanChatMessage({ params: { id: plan.id }, user: { id: 'admin', role: 'administrador', nombre: 'Admin' },
      body: { recipient, message: 'Directed message', public_base_url: 'http://localhost:3000' }, get: () => 'http://localhost:3000' }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    assert.equal(plan.metadata.chat_thread.at(-1).recipient_type, recipient);
    assert.equal(notices.at(-1).user_id, recipient === 'leader' ? 'leader' : 'planning');
    assert.equal(plan.metadata.last_adjustment_request, undefined);
    assert.equal(plan.metadata.last_planning_response, undefined);
    assert.equal(plan.status, 'active');
  }
  assert.equal(notices.length, 1);
  assert.equal(emails.length, 1);
  const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await sendActionPlanChatMessage({ params: { id: plan.id }, user: { id: 'planning', role: 'planeacion_efectividad', nombre: 'Planning' },
    body: { recipient: 'administrator:admin', message: 'Private response', public_base_url: 'http://localhost:3000' }, get: () => 'http://localhost:3000' }, res);
  assert.equal(res.statusCode, 201, JSON.stringify(res.body));
  assert.equal(notices.at(-1).user_id, 'admin');
  assert.equal(emails.at(-1).to, 'admin@example.test');
  assert.equal(notices.length, 2, 'reply must not notify leader');
  assert.equal(plan.metadata.chat_thread.at(-1).private_channel, true);

  assert.equal(plan.metadata.last_adjustment_request, undefined);
  const { clearActionPlanChat } = require('../controllers/strategicPlanningController');
  const unrelated = { id: 'other-message', sender_id: 'other-admin', recipient_id: 'other-planning', recipient_type: 'planning_effectiveness', message: 'Other private conversation' };
  plan.metadata.chat_thread.push(unrelated);
  const response = () => ({ status() { return this; }, json() {} });
  await clearActionPlanChat({ params: { id: plan.id }, user: { id: 'leader', role: 'consulta' }, body: { recipient: 'leader' } }, response());
  assert.equal(plan.metadata.chat_thread.length, 3, 'leader must not clear either private conversation');
  await clearActionPlanChat({ params: { id: plan.id }, user: { id: 'planning', role: 'planeacion_efectividad' }, body: { recipient: 'administrator:admin' } }, response());
  assert.deepEqual(plan.metadata.chat_thread, [unrelated], 'clearing a private conversation preserves other users messages');
  const defaultResponse = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
  await sendActionPlanChatMessage({ params: { id: plan.id }, user: { id: 'admin', role: 'administrador', nombre: 'Admin' },
    body: { message: 'Default private message', public_base_url: 'http://localhost:3000' }, get: () => 'http://localhost:3000' }, defaultResponse);
  assert.equal(defaultResponse.statusCode, 201);
  assert.equal(notices.at(-1).user_id, 'planning', 'server also defaults administrator to planning');
  assert.equal(plan.metadata.chat_thread.at(-1).private_channel, true);
  const before = notices.length;
  for (const [id, role, senderType, target] of [['leader', 'consulta', 'leader', 'planning'], ['planning', 'planeacion_efectividad', 'planning', 'leader']]) {
    const result = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    await sendActionPlanChatMessage({ params: { id: plan.id }, user: { id, role, nombre: id },
      body: { senderType, message: 'Leader-planning conversation', public_base_url: 'http://localhost:3000' }, get: () => 'http://localhost:3000' }, result);
    assert.equal(result.statusCode, 201, JSON.stringify(result.body));
    assert.equal(notices.at(-1).user_id, target);
    assert.equal(emails.at(-1).to, target === 'planning' ? 'planeacionestrategica@unicesmag.edu.co' : target + '@example.test');
    assert.equal(plan.metadata.chat_thread.at(-1).channel_kind, 'leader_planning');
    const filtered = require('./actionPlanChatPrivacy').filterChatPayload({ actionPlan: plan }, { id: 'admin', role: 'administrador' });
    assert.ok(!JSON.stringify(filtered).includes('Leader-planning conversation'));
  }
  assert.equal(notices.length, before + 2);
});
