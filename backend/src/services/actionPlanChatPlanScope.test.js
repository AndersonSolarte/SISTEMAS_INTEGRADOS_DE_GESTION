const test = require('node:test');
const assert = require('node:assert/strict');

test('administrator chats and planning replies stay in their originating plan', async t => {
  const models = require('../models');
  const mail = require('./strategicPlanningEmailService');
  const saved = [models.StrategicActionPlan.findByPk, models.User.findOne, models.StrategicNotification.create, mail.sendStrategicPlanningEmail];
  const plans = new Map(['A', 'B'].map(id => [id, { id, code: '2026-' + id, responsible_user_id: 'leader-' + id, status: 'active', metadata: {},
    update: async function(values) { Object.assign(this, values); } }]));
  const notices = [], emails = [];
  models.StrategicActionPlan.findByPk = async id => plans.get(id);
  models.User.findOne = async query => ({ id: query.where.id || 'planning', nombre: 'Recipient', email: (query.where.id || 'planning') + '@example.test' });
  models.StrategicNotification.create = async value => notices.push(value);
  mail.sendStrategicPlanningEmail = async value => emails.push(value);
  t.after(() => { [models.StrategicActionPlan.findByPk, models.User.findOne, models.StrategicNotification.create, mail.sendStrategicPlanningEmail] = saved; });
  const { sendActionPlanChatMessage } = require('../controllers/strategicPlanningController');
  const send = async (id, user, body) => {
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    await sendActionPlanChatMessage({ params: { id }, user, body: { ...body, action_plan_id: 'wrong-client-plan', public_base_url: 'http://localhost:3000' }, get: () => 'http://localhost:3000' }, res);
    assert.equal(res.statusCode, 201, JSON.stringify(res.body));
    return res.body;
  };
  for (const id of ['A', 'B']) {
    await send(id, { id: 'admin', role: 'administrador', nombre: 'Admin' }, { message: 'Message for ' + id });
    const message = plans.get(id).metadata.chat_thread[0];
    assert.equal(message.action_plan_id, id);
    assert.equal(message.action_plan_code, '2026-' + id);
    assert.equal(message.recipient_id, 'planning');
    assert.equal(notices.at(-1).action_plan_id, id);
    assert.equal(notices.at(-1).user_id, 'planning');
    assert.ok(notices.at(-1).link.includes('planId=' + id));
    assert.ok(emails.at(-1).text.includes('planId=' + id));
  }
  await send('B', { id: 'planning', role: 'planeacion_efectividad', nombre: 'Planning' }, { recipient: 'administrator:admin', message: 'Reply in B' });
  assert.equal(plans.get('A').metadata.chat_thread.length, 1);
  assert.equal(plans.get('B').metadata.chat_thread.length, 2);
  assert.equal(notices.at(-1).action_plan_id, 'B');
  assert.equal(notices.at(-1).user_id, 'admin');
  assert.equal(notices.length, 3);
  assert.ok(notices.every(notice => !notice.user_id.startsWith('leader-')));
});
