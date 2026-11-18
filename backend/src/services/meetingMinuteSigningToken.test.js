const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { createSigningToken, signingTokenParticipantId, verifySigningToken } = require('./meetingMinuteSigningToken');

const participant = () => ({
  id: crypto.randomUUID(), minute_id: crypto.randomUUID(), email: 'externo@example.com',
  signing_token_hash: crypto.randomBytes(32).toString('hex'), user_id: null
});

test('reenviar y entrar con Google conservan vigentes los enlaces anteriores', () => {
  const person = participant();
  const emailLink = createSigningToken(person, Date.now() + 86400000);
  const googleLink = createSigningToken(person, Date.now() + 1800000);
  const resendLink = createSigningToken(person, Date.now() + 172800000);
  for (const token of [emailLink, googleLink, resendLink]) assert.equal(verifySigningToken(person, token), true);
  assert.equal(verifySigningToken(person, googleLink, Date.now() + 3600000), false);
  assert.equal(verifySigningToken(person, emailLink, Date.now() + 3600000), true);
});

test('rechaza enlaces alterados, vencidos, de otra persona y revocados por ajustes', () => {
  const person = participant();
  const token = createSigningToken(person, Date.now() + 1800000);
  assert.equal(signingTokenParticipantId(token), person.id);
  assert.equal(verifySigningToken(person, token.replace(/.$/, token.endsWith('0') ? '1' : '0')), false);
  assert.equal(verifySigningToken(person, token, Date.now() + 1800001), false);
  assert.equal(verifySigningToken(participant(), token), false);
  assert.equal(verifySigningToken({ ...person, signing_token_hash: null }, token), false);
  assert.equal(verifySigningToken({ ...person, signing_token_hash: crypto.randomBytes(32).toString('hex') }, token), false);
  assert.equal(verifySigningToken({ ...person, email: 'otro@example.com' }, token), false);
  assert.equal(verifySigningToken(person, 'ms1.invalid'), false);
});

test('el acceso Google conserva la clave y el vencimiento de invitaciones anteriores', () => {
  const legacyToken = crypto.randomBytes(32).toString('base64url');
  const person = {
    ...participant(),
    signing_token_hash: crypto.createHash('sha256').update(legacyToken).digest('hex'),
    signing_token_expires_at: new Date(Date.now() + 86400000)
  };
  const previousExpiry = person.signing_token_expires_at;
  const googleToken = createSigningToken(person, Date.now() + 1800000);
  assert.equal(verifySigningToken(person, googleToken), true);
  assert.equal(person.signing_token_hash, crypto.createHash('sha256').update(legacyToken).digest('hex'));
  assert.equal(person.signing_token_expires_at, previousExpiry);
});

test('resuelve acceso de externos, estudiantes, egresados y funcionarios y bloquea borradores', async (t) => {
  const { DigitalMeetingParticipant, DigitalMeetingMinute } = require('../models');
  const { _internals } = require('../controllers/meetingMinuteController');
  for (const [email, user_id] of [
    ['externo@example.com', null], ['estudiante@unicesmag.edu.co', null],
    ['egresado@example.com', null], ['funcionario@unicesmag.edu.co', 7]
  ]) {
    const person = { ...participant(), email, user_id };
    const minute = { id: person.minute_id, status: 'signing', deleted_at: null, participants: [person] };
    const token = createSigningToken(person, Date.now() + 1800000);
    t.mock.method(DigitalMeetingParticipant, 'findByPk', async () => person);
    t.mock.method(DigitalMeetingMinute, 'findOne', async ({ where }) => {
      assert.equal(where.id, person.minute_id);
      assert.equal(where.deleted_at, null);
      return minute.status === 'signing' ? minute : null;
    });
    t.mock.method(DigitalMeetingMinute, 'findAll', async () => []);
    const access = await _internals.resolveSigningAccess(token);
    assert.equal(access.invitedParticipant, person);
    assert.equal(access.invitationVerified, true);
    minute.status = 'draft';
    assert.equal(await _internals.resolveSigningAccess(token), null);
    t.mock.restoreAll();
  }
});
