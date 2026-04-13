const crypto = require('crypto');

const getKey = () => {
  const secret = String(process.env.URL_TOKEN_SECRET || process.env.JWT_SECRET || '').trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('URL_TOKEN_SECRET o JWT_SECRET es obligatorio para URLs seguras.');
    }
    return crypto.createHash('sha256').update('dev_only_replace_url_token_secret').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
};

const encode = (buffer) => buffer.toString('base64url');
const decode = (value) => Buffer.from(String(value || ''), 'base64url');

const encryptPayload = (payload, ttlSeconds = 600) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const body = Buffer.from(JSON.stringify({
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds
  }));
  const encrypted = Buffer.concat([cipher.update(body), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [encode(iv), encode(tag), encode(encrypted)].join('.');
};

const decryptPayload = (token) => {
  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('Token invalido');

  const [ivRaw, tagRaw, encryptedRaw] = parts;
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), decode(ivRaw));
  decipher.setAuthTag(decode(tagRaw));
  const decrypted = Buffer.concat([decipher.update(decode(encryptedRaw)), decipher.final()]);
  const payload = JSON.parse(decrypted.toString('utf8'));

  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expirado');
  }

  return payload;
};

module.exports = {
  encryptPayload,
  decryptPayload
};
