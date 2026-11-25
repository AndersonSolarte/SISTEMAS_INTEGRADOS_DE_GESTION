const test = require('node:test');
const assert = require('node:assert/strict');
const { chatEmailPolicy, chatEmailThreadRoot, PLANNING_CHAT_MAILBOX } = require('./actionPlanChatEmailPolicy');
const plan = { id: 'plan-a', code: '2026-R74' };
const admin = { id: 'admin', role: 'administrador', email: 'admin@example.test' };
const planner = { id: 'planning', role: 'planeacion_efectividad', email: 'personal-planning@example.test' };
const delivery = { type: 'planning_effectiveness', user: planner };
const message = { id: 'message-1', sender_name: 'Admin', message: 'Private message', email_thread_root_id: 'message-1' };

test('administrator messages reach only the institutional planning mailbox', () => {
  const email = chatEmailPolicy({ actor: admin, plan, delivery, message });
  assert.equal(email.to, PLANNING_CHAT_MAILBOX);
  assert.equal(email.replyTo, admin.email);
  assert.equal(email.cc, undefined);
  assert.equal(email.bcc, undefined);
  assert.ok(!JSON.stringify(email).includes(planner.email));
});

test('all planning destinations use the official mailbox, including missing or personal profile emails', () => {
  for (const type of ['planning_effectiveness', 'planning_leader']) {
    for (const email of ['', 'personal-planning@example.test']) {
      assert.equal(chatEmailPolicy({ actor: admin, plan, delivery: { type, user: { id: 'planning', email } }, message }).to, PLANNING_CHAT_MAILBOX);
    }
  }
  assert.equal(chatEmailPolicy({ actor: admin, plan, delivery: { type: 'leader', user: planner }, message }).to, PLANNING_CHAT_MAILBOX);
});

test('planning replies reach only the administrator and use institutional Reply-To', () => {
  const email = chatEmailPolicy({ actor: planner, plan, delivery: { type: 'administrator', user: admin }, message });
  assert.equal(email.to, admin.email);
  assert.equal(email.replyTo, PLANNING_CHAT_MAILBOX);
  assert.ok(!JSON.stringify(email).includes(planner.email));
});

test('one conversation keeps its subject and root reference in both directions', () => {
  const first = chatEmailPolicy({ actor: admin, plan, delivery, message });
  const reply = chatEmailPolicy({ actor: planner, plan, delivery: { type: 'administrator', user: admin }, message: { ...message, id: 'message-2' } });
  const next = chatEmailPolicy({ actor: admin, plan, delivery, message: { ...message, id: 'message-3' } });
  assert.equal(first.subject, reply.subject);
  assert.equal(first.subject, next.subject);
  assert.equal(first.headers['In-Reply-To'], undefined);
  assert.equal(reply.headers['In-Reply-To'], first.headers['Message-ID']);
  assert.equal(next.headers.References, first.headers['Message-ID']);
  assert.notEqual(reply.headers['Message-ID'], first.headers['Message-ID']);
});

test('different plans and administrators never share the same email thread', () => {
  const first = chatEmailPolicy({ actor: admin, plan, delivery, message });
  for (const other of [
    chatEmailPolicy({ actor: admin, plan: { ...plan, id: 'plan-b' }, delivery, message }),
    chatEmailPolicy({ actor: { ...admin, id: 'admin-b' }, plan, delivery, message })
  ]) {
    assert.notEqual(other.subject, first.subject);
    assert.notEqual(other.headers['Message-ID'], first.headers['Message-ID']);
  }
});

test('new deliveries start their own root without pretending to reference old unthreaded emails', () => {
  const next = { id: 'new-delivery', conversation_id: 'pair-a' };
  assert.equal(chatEmailThreadRoot(next, { chat_thread: [{ id: 'old-delivery', conversation_id: 'pair-a' }] }), next.id);
  assert.equal(chatEmailThreadRoot(next, { chat_thread: [{ conversation_id: 'pair-b', email_thread_root_id: 'other-root' }] }), next.id);
});

test('archiving a conversation preserves its root for later replies', () => {
  const next = { id: 'new-delivery', conversation_id: 'pair-a' };
  assert.equal(chatEmailThreadRoot(next, { chat_archive: [{ conversation_id: 'pair-a', email_thread_root_id: 'first-new-delivery' }] }), 'first-new-delivery');
});

test('actual notification service keeps the account notification private while emailing the official mailbox', async () => {
  const templatePath = require.resolve('./emailService');
  const original = require.cache[templatePath];
  require.cache[templatePath] = { id: templatePath, filename: templatePath, loaded: true, exports: {
    renderInstitutionalTemplate: value => value.introHtml + value.bodyHtml,
    escapeHtml: value => String(value || '').replace(/</g, '&lt;')
  } };
  const notices = [], emails = [];
  try {
    await require('./actionPlanChatRecipientService').notifyAdminChatRecipient({ actor: admin, plan, delivery: { ...delivery, user: { ...planner, email: '' } }, message,
      baseUrl: 'http://localhost:3000', notifications: { create: async notice => notices.push(notice) }, sendEmail: async email => emails.push(email) });
  } finally {
    if (original) require.cache[templatePath] = original;
    else delete require.cache[templatePath];
  }
  assert.equal(notices.length, 1);
  assert.equal(notices[0].user_id, planner.id);
  assert.equal(notices[0].action_plan_id, plan.id);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, PLANNING_CHAT_MAILBOX);
  assert.ok(!emails[0].text.includes(planner.email));
});

test('the locally compiled MIME message contains the official recipient and conversation headers', async () => {
  const nodemailer = require('nodemailer');
  const email = chatEmailPolicy({ actor: admin, plan, delivery, message: { ...message, id: 'message-2' } });
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
  const compiled = await transport.sendMail({ from: PLANNING_CHAT_MAILBOX, ...email, text: 'Private fixture' });
  const raw = compiled.message.toString();
  assert.match(raw, /^To: planeacionestrategica@unicesmag\.edu\.co$/m);
  assert.match(raw, /^In-Reply-To:\s+<siac-chat-/m);
  assert.match(raw, /^References:\s+<siac-chat-/m);
  assert.ok(raw.includes(email.headers['Message-ID']));
  assert.ok(!raw.includes(planner.email));
  assert.doesNotMatch(raw, /^(Cc|Bcc):/m);
});
