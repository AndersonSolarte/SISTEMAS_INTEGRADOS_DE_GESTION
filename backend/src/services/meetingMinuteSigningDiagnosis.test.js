const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('crypto');
const { diagnoseSigningLink, extractSigningToken } = require('./meetingMinuteSigningDiagnosis');
const { createSigningToken } = require('./meetingMinuteSigningToken');

const now = Date.now();
const minute = { code: 'ACTA-TEST', status: 'signing', deleted_at: null, token_expires_at: new Date(now + 60000) };
const diagnose = (overrides = {}) => diagnoseSigningLink({
  input: 'legacy-token', now,
  findParticipant: async () => null, findLegacyParticipant: async () => null,
  findMinute: async () => minute, findLegacyMinute: async () => minute,
  ...overrides
});

test('distingue enlace general valido, vencido, retirado, en borrador y desconocido', async () => {
  assert.equal((await diagnose()).reason, 'valid');
  for (const [changes, reason] of [
    [{ token_expires_at: new Date(now - 1) }, 'token_expired'],
    [{ deleted_at: new Date() }, 'minute_deleted'],
    [{ status: 'draft' }, 'minute_not_open_for_signing']
  ]) assert.equal((await diagnose({ findLegacyMinute: async () => ({ ...minute, ...changes }) })).reason, reason);
  assert.equal((await diagnose({ findLegacyMinute: async () => null })).reason, 'token_not_found_or_replaced');
});

test('distingue invitacion personal antigua vencida de un QR general vigente', async () => {
  const result = await diagnose({ findLegacyParticipant: async () => ({ minute_id: 'm1', signing_token_expires_at: new Date(now - 1) }) });
  assert.equal(result.reason, 'token_expired');
});

test('diagnostica nuevos enlaces personales sin exponer el token ni datos personales', async () => {
  const person = { id: randomUUID(), minute_id: randomUUID(), email: 'privado@example.com', signing_token_hash: randomBytes(32).toString('hex') };
  const input = createSigningToken(person, now + 60000);
  const result = await diagnose({ input, findParticipant: async () => person });
  assert.equal(result.reason, 'valid');
  assert.equal(result.access, 'personal');
  assert.equal(JSON.stringify(result).includes(person.email), false);
  assert.equal(JSON.stringify(result).includes(input), false);
  assert.equal((await diagnose({ input, findParticipant: async () => ({ ...person, signing_token_hash: null }) })).reason, 'personal_token_revoked_or_altered');
  assert.equal((await diagnose({ input })).reason, 'participant_not_found');
});

test('extrae token del enlace y rechaza URLs de otras rutas', () => {
  assert.equal(extractSigningToken('https://example.com/firmar-acta-reunion/token?x=1'), 'token');
  assert.throws(() => extractSigningToken('https://example.com/otra-ruta'));
});
