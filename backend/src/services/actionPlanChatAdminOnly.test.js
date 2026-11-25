const test = require('node:test');
const assert = require('node:assert/strict');

test('administrators message only planning; only an administrator who is the actual leader receives the leader reply', async t => {
  const models = require('../models');
  const mail = require('./strategicPlanningEmailService');
  const originals = [models.StrategicActionPlan.findByPk, models.User.findOne, models.StrategicNotification.create, mail.sendStrategicPlanningEmail];
  const notices = [], emails = [];
  const users = { admin: { id: 'admin', role: 'administrador', nombre: 'Admin', email: 'admin@example.test' },
    planning: { id: 'planning', role: 'planeacion_efectividad', nombre: 'Planning', email: 'planning@example.test' },
    leader: { id: 'leader', role: 'consulta', nombre: 'Leader', email: 'leader@example.test' } };
  const plan = { id: 'plan', code: '2026-R74', responsible_user_id: 'leader', status: 'active', metadata: {},
    update: async function(values) { Object.assign(this, values); } };
  models.StrategicActionPlan.findByPk = async () => plan;
  models.User.findOne = async query => query.where.id ? users[query.where.id] : users.planning;
  models.StrategicNotification.create = async value => notices.push(value);
  mail.sendStrategicPlanningEmail = async value => emails.push(value);
  t.after(() => { [models.StrategicActionPlan.findByPk, models.User.findOne, models.StrategicNotification.create, mail.sendStrategicPlanningEmail] = originals; });
  const { sendActionPlanChatMessage } = require('../controllers/strategicPlanningController');
  const send = async (user, body) => {
    const res = { statusCode: 200, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; } };
    const originalError = console.error;
    console.error = () => {};
    try { await sendActionPlanChatMessage({ params: { id: plan.id }, user, body: { message: 'Private message', public_base_url: 'http://localhost:3000', ...body }, get: () => 'http://localhost:3000' }, res); }
    finally { console.error = originalError; }
    return res;
  };
  const rejected = await send(users.admin, { recipient: 'leader' });
  assert.equal(rejected.statusCode, 422);
  assert.equal(notices.length, 0);
  assert.equal(emails.length, 0);
  assert.deepEqual(plan.metadata, {});
  assert.equal((await send(users.admin, {})).statusCode, 201);
  assert.equal(notices.at(-1).user_id, 'planning');
  assert.equal(emails.at(-1).to, 'planeacionestrategica@unicesmag.edu.co');
  assert.equal((await send(users.planning, { recipient: 'administrator:admin' })).statusCode, 201);
  assert.equal(notices.at(-1).user_id, 'admin');
  assert.ok(notices.every(notice => notice.user_id !== 'leader'));
  assert.ok(emails.every(email => email.to !== 'leader@example.test'));

  plan.responsible_user_id = 'admin';
  assert.equal((await send(users.planning, {})).statusCode, 201);
  assert.equal(notices.at(-1).user_id, 'admin');
  assert.equal(emails.at(-1).to, 'admin@example.test');
  assert.equal(plan.metadata.chat_thread.at(-1).channel_kind, 'admin_planning');
  assert.equal((await send(users.admin, {})).statusCode, 201);
  assert.equal(notices.at(-1).user_id, 'planning');
  assert.equal(emails.at(-1).to, 'planeacionestrategica@unicesmag.edu.co');
  assert.equal((await send(users.admin, { recipient: 'leader' })).statusCode, 422);
});
