const crypto = require('crypto');

// La clave permanece en el participante y se elimina al reabrir el acta.
// Cada enlace lleva su propio vencimiento: Google y los reenvios no revocan
// las invitaciones previamente entregadas.
const digest = (participant, payload) => crypto.createHmac('sha256', participant.signing_token_hash)
  .update(`${participant.minute_id}:${String(participant.email || '').trim().toLowerCase()}:${payload}`)
  .digest('hex');

const createSigningToken = (participant, expiresAt) => {
  if (!participant.signing_token_hash) throw new Error('Falta la clave de acceso del participante.');
  const payload = `ms1.${participant.id}.${new Date(expiresAt).getTime()}`;
  return `${payload}.${digest(participant, payload)}`;
};

const signingTokenParticipantId = (token) => {
  const parts = String(token || '').split('.');
  return parts.length === 4 && parts[0] === 'ms1'
    && /^[0-9a-f-]{36}$/i.test(parts[1])
    && /^\d{13}$/.test(parts[2]) && /^[0-9a-f]{64}$/.test(parts[3]) ? parts[1] : null;
};

const verifySigningToken = (participant, token, now = Date.now()) => {
  if (!participant?.signing_token_hash || signingTokenParticipantId(token) !== participant.id) return false;
  const parts = token.split('.');
  if (Number(parts[2]) <= Number(now)) return false;
  return crypto.timingSafeEqual(Buffer.from(parts[3], 'hex'), Buffer.from(digest(participant, parts.slice(0, 3).join('.')), 'hex'));
};

module.exports = { createSigningToken, signingTokenParticipantId, verifySigningToken };
