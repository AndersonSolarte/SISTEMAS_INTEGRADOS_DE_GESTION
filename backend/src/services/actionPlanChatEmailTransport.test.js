const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

test('SMTP options and the fallback transport preserve conversation headers and official recipient', async () => {
  const target = require.resolve('./strategicPlanningEmailService');
  const originalCache = require.cache[target];
  const originalLoad = Module._load;
  const sent = [];
  delete require.cache[target];
  Module._load = function(request, parent, isMain) {
    if (parent?.filename === target && request === 'googleapis') return { google: {} };
    if (parent?.filename === target && request === './emailService') return { sendInstitutionalEmail: async mail => { sent.push(mail); return { success: true }; } };
    return originalLoad.call(this, request, parent, isMain);
  };
  let service;
  try { service = require('./strategicPlanningEmailService'); }
  finally { Module._load = originalLoad; }
  const keys = ['EMAIL_DELIVERY_ENABLED', 'PLAN_ACTION_SMTP_USER', 'SMTP_USER'];
  const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
  try {
    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    delete process.env.PLAN_ACTION_SMTP_USER;
    delete process.env.SMTP_USER;
    const headers = { 'Message-ID': '<message@unicesmag.edu.co>', 'In-Reply-To': '<root@unicesmag.edu.co>', References: '<root@unicesmag.edu.co>' };
    const mail = { to: 'planeacionestrategica@unicesmag.edu.co', replyTo: 'admin@example.test', subject: 'Fixture', text: 'Private fixture', headers };
    const options = service._internals.buildMailOptions({ config: { from: mail.to }, recipients: [mail.to], ...mail });
    assert.equal(options.messageId, headers['Message-ID']);
    assert.equal(options.inReplyTo, headers['In-Reply-To']);
    assert.equal(options.references, headers.References);
    const transport = require('nodemailer').createTransport({ streamTransport: true, buffer: true, newline: 'unix' });
    const raw = (await transport.sendMail(options)).message.toString();
    assert.equal((raw.match(/^Message-ID:/gm) || []).length, 1);
    assert.match(raw, /^In-Reply-To: <root@unicesmag\.edu\.co>$/m);
    await service.sendStrategicPlanningEmail(mail);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, mail.to);
    assert.equal(sent[0].replyTo, mail.replyTo);
    assert.deepEqual(sent[0].headers, headers);
    assert.equal(sent[0].messageId, headers['Message-ID']);
    assert.equal(sent[0].inReplyTo, headers['In-Reply-To']);
    assert.equal(sent[0].references, headers.References);
    assert.equal(sent[0].cc, undefined);
    assert.equal(sent[0].bcc, undefined);
  } finally {
    for (const key of keys) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
    if (originalCache) require.cache[target] = originalCache;
    else delete require.cache[target];
  }
});
