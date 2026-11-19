const crypto = require('crypto');
const { signingTokenParticipantId, verifySigningToken } = require('./meetingMinuteSigningToken');

const extractSigningToken = (input) => {
  const value = String(input || '').trim();
  if (!value) throw new Error('Indique el enlace de firma o su token.');
  if (!/^https?:\/\//i.test(value)) return value;
  const url = new URL(value);
  const match = url.pathname.match(/^\/firmar-acta-reunion\/([^/]+)\/?$/);
  if (!match) throw new Error('La URL no corresponde a un enlace de firma de acta.');
  return decodeURIComponent(match[1]);
};

const diagnoseSigningLink = async ({ input, findParticipant, findLegacyParticipant, findMinute, findLegacyMinute, now = Date.now() }) => {
  const token = extractSigningToken(input);
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const personalId = signingTokenParticipantId(token);
  const result = { fingerprint: tokenHash.slice(0, 12), format: personalId ? 'personal_ms1' : 'legacy_or_general' };
  const person = personalId ? await findParticipant(personalId) : await findLegacyParticipant(tokenHash);
  if (personalId && !person) return { ...result, reason: 'participant_not_found' };
  if (personalId && !verifySigningToken(person, token, 0)) return { ...result, reason: 'personal_token_revoked_or_altered' };
  const minute = person ? await findMinute(person.minute_id) : await findLegacyMinute(token, tokenHash);
  if (!minute) return { ...result, reason: person ? 'minute_not_found' : 'token_not_found_or_replaced' };
  result.minute_code = minute.code;
  result.minute_status = minute.status;
  if (minute.deleted_at) return { ...result, reason: 'minute_deleted' };
  if (!['signing', 'signed', 'distributed'].includes(minute.status)) return { ...result, reason: 'minute_not_open_for_signing' };
  const expiration = personalId ? Number(token.split('.')[2])
    : (person ? person.signing_token_expires_at : minute.token_expires_at);
  result.expires_at = expiration ? new Date(expiration).toISOString() : null;
  if (expiration && new Date(expiration).getTime() <= now) return { ...result, reason: 'token_expired' };
  return { ...result, reason: 'valid', access: person ? 'personal' : 'google_verification_required' };
};

module.exports = { extractSigningToken, diagnoseSigningLink };
