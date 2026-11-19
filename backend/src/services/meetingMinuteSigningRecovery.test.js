const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const { OAuth2Client } = require('google-auth-library');
const { DigitalMeetingMinute, DigitalMeetingParticipant, DigitalMeetingSignature } = require('../models');
const controller = require('../controllers/meetingMinuteController');
const { verifySigningToken } = require('./meetingMinuteSigningToken');

const setup = (t, { verified = true, email = 'estudiante@example.com', candidates = [] } = {}) => {
  const previous = process.env.GOOGLE_CLIENT_ID;
  process.env.GOOGLE_CLIENT_ID = 'test-client';
  t.after(() => { if (previous === undefined) delete process.env.GOOGLE_CLIENT_ID; else process.env.GOOGLE_CLIENT_ID = previous; });
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => ({ getPayload: () => ({ email, email_verified: verified }) }));
  t.mock.method(DigitalMeetingMinute, 'findOne', async () => null);
  t.mock.method(DigitalMeetingParticipant, 'findOne', async () => null);
  t.mock.method(DigitalMeetingMinute, 'findAll', async (query) => {
    if (!query.include[0].where) return [];
    assert.equal(query.where.status, 'signing');
    assert.equal(query.where.deleted_at, null);
    return candidates;
  });
  const req = { params: { token: 'old-replaced-token' }, body: { credential: 'google-credential' }, protocol: 'https', get: () => 'example.com' };
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(data) { this.body = data; } };
  return { req, res };
};

const candidate = (email = 'estudiante@example.com') => {
  const minuteId = crypto.randomUUID();
  const person = {
    id: crypto.randomUUID(), minute_id: minuteId, email, user_id: null, status: 'invited',
    signing_token_hash: crypto.randomBytes(32).toString('hex'),
    async update(values) { Object.assign(this, values); }
  };
  return { id: minuteId, code: 'ACTA-TEST', status: 'signing', content: {}, participants: [person] };
};

test('el enlace anterior ofrece recuperacion sin exponer el documento', async (t) => {
  const { req, res } = setup(t);
  await controller.publicMinute(req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.data.recovery_available, true);
  assert.equal(res.body.data.content, undefined);
});

test('recupera desde un token reemplazado solo al estudiante verificado y conserva su clave', async (t) => {
  const minute = candidate();
  const person = minute.participants[0];
  const key = person.signing_token_hash;
  const { req, res } = setup(t, { candidates: [minute] });
  await controller.googleSigningAccess(req, res);
  assert.equal(res.statusCode, 200);
  const token = new URL(res.body.data.signing_url).pathname.split('/').pop();
  assert.equal(verifySigningToken(person, token), true);
  assert.equal(person.signing_token_hash, key);
});

test('despues de recuperar el estudiante puede registrar la firma con su consentimiento', async (t) => {
  const minute = candidate();
  const person = minute.participants[0];
  const { req, res } = setup(t, { candidates: [minute] });
  await controller.googleSigningAccess(req, res);
  req.params.token = new URL(res.body.data.signing_url).pathname.split('/').pop();
  req.body = { privacy_accepted: true, signature_data: 'data:image/png;base64,c2lnbmF0dXJl' };
  req.headers = {};
  t.mock.method(DigitalMeetingParticipant, 'findByPk', async () => person);
  t.mock.method(DigitalMeetingMinute, 'findOne', async () => minute);
  t.mock.method(DigitalMeetingParticipant, 'findAll', async () => [person, { status: 'invited' }]);
  t.mock.method(fs, 'mkdirSync', () => {});
  t.mock.method(fs, 'writeFileSync', () => {});
  let recorded;
  t.mock.method(DigitalMeetingSignature, 'create', async (values) => { recorded = values; });
  await controller.sign(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(person.status, 'signed');
  assert.equal(recorded.participant_id, person.id);
  assert.equal(recorded.minute_id, minute.id);
  assert.ok(recorded.privacy_accepted_at);
});

test('varias actas se muestran solo tras verificar el correo y elegir una no modifica las otras', async (t) => {
  const minutes = [candidate(), candidate()];
  const { req, res } = setup(t, { candidates: minutes });
  await controller.googleSigningAccess(req, res);
  assert.equal(res.body.data.recovery_choices.length, 2);
  assert.equal(res.body.data.signing_url, undefined);
  assert.equal(minutes[0].participants[0].email_verified_at, undefined);
  req.body.minute_id = minutes[1].id;
  await controller.googleSigningAccess(req, res);
  assert.ok(res.body.data.signing_url);
  assert.ok(minutes[1].participants[0].email_verified_at);
  assert.equal(minutes[0].participants[0].email_verified_at, undefined);
});

test('rechaza cuenta sin correo verificado aunque existan actas pendientes', async (t) => {
  const { req, res } = setup(t, { verified: false, candidates: [candidate()] });
  await controller.googleSigningAccess(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.data, undefined);
});

test('no permite recuperar sin credencial ni con una credencial Google falsificada', async (t) => {
  const { req, res } = setup(t, { candidates: [candidate()] });
  delete req.body.credential;
  await controller.googleSigningAccess(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.data, undefined);
  req.body.credential = 'forged-credential';
  t.mock.method(OAuth2Client.prototype, 'verifyIdToken', async () => { throw new Error('invalid signature'); });
  await controller.googleSigningAccess(req, res);
  assert.equal(res.statusCode, 401);
  assert.equal(res.body.data, undefined);
});

test('rechaza correo diferente, firma ya registrada e identificador de acta ajeno', async (t) => {
  const candidates = [];
  const { req, res } = setup(t, { candidates });
  for (const mode of ['other_email', 'signed', 'other_minute']) {
    const minute = candidate(mode === 'other_email' ? 'otro@example.com' : undefined);
    candidates.splice(0, candidates.length, minute);
    if (mode === 'signed') minute.participants[0].status = 'signed';
    if (mode === 'other_minute') req.body.minute_id = crypto.randomUUID();
    await controller.googleSigningAccess(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(minute.participants[0].email_verified_at, undefined);
  }
});

test('no recupera actas en borrador, retiradas ni asistentes excluidos de firma', async (t) => {
  const minutes = [candidate(), candidate(), candidate()];
  minutes[0].status = 'draft';
  minutes[1].deleted_at = new Date();
  minutes[2].content = { format_code: 'COM-GD-FR-012', participantes_meta: [{
    email: minutes[2].participants[0].email, requires_signature: false
  }] };
  const { req, res } = setup(t, { candidates: minutes });
  await controller.googleSigningAccess(req, res);
  assert.equal(res.statusCode, 403);
  assert.equal(res.body.data, undefined);
});
