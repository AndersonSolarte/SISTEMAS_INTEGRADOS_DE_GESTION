const test = require('node:test');
const assert = require('node:assert/strict');

const { _internals } = require('./emailService');

test('production sandbox requires explicit authorization', () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    recipient: process.env.EMAIL_SANDBOX_RECIPIENT,
    allow: process.env.ALLOW_PRODUCTION_SANDBOX
  };

  try {
    process.env.NODE_ENV = 'production';
    process.env.EMAIL_SANDBOX_RECIPIENT = 'adsolarte@unicesmag.edu.co';
    delete process.env.ALLOW_PRODUCTION_SANDBOX;
    assert.equal(_internals.getSandboxRecipient(), null);

    process.env.ALLOW_PRODUCTION_SANDBOX = 'true';
    assert.equal(_internals.getSandboxRecipient(), 'adsolarte@unicesmag.edu.co');
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.recipient === undefined) delete process.env.EMAIL_SANDBOX_RECIPIENT; else process.env.EMAIL_SANDBOX_RECIPIENT = previous.recipient;
    if (previous.allow === undefined) delete process.env.ALLOW_PRODUCTION_SANDBOX; else process.env.ALLOW_PRODUCTION_SANDBOX = previous.allow;
  }
});

test('local delivery follows EMAIL_DELIVERY_ENABLED', () => {
  const previous = {
    nodeEnv: process.env.NODE_ENV,
    delivery: process.env.EMAIL_DELIVERY_ENABLED
  };

  try {
    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_DELIVERY_ENABLED;
    assert.equal(_internals.isEmailDeliveryEnabled(), false);

    process.env.EMAIL_DELIVERY_ENABLED = 'true';
    assert.equal(_internals.isEmailDeliveryEnabled(), true);
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.delivery === undefined) delete process.env.EMAIL_DELIVERY_ENABLED; else process.env.EMAIL_DELIVERY_ENABLED = previous.delivery;
  }
});

test('conserva intactos los textos UTF-8 válidos en español', () => {
  const message = 'Liquidación de viáticos · Técnico Contable · Tesorería · ningún trámite';
  assert.equal(_internals.sanitizeEmailText(message), message);
});

test('repara texto UTF-8 interpretado por error como Latin-1', () => {
  const original = 'Liquidación de viáticos para revisión del Técnico Contable';
  const mojibake = Buffer.from(original, 'utf8').toString('latin1');
  assert.equal(_internals.sanitizeEmailText(mojibake), original);
});

test('conserva valores monetarios COP y su distribución HTML', () => {
  const html = '<table><tr><th>Valor total (COP)</th><td>$ 1.250.000</td></tr></table>';
  assert.equal(_internals.sanitizeEmailText(html), html);
});
