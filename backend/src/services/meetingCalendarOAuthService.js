const crypto = require('crypto');
const { google } = require('googleapis');
const { encryptPayload, decryptPayload } = require('../utils/secureUrlToken');

const CALENDAR_SCOPES = [
  'openid',
  'email',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy'
];

const clean = (value, max = 1000) => String(value || '').trim().slice(0, max);
const normalizeEmail = (value) => clean(value, 254).toLowerCase();

const getOAuthConfiguration = () => {
  const clientId = clean(process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID, 500);
  const clientSecret = clean(process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET, 1000);
  const backendUrl = clean(process.env.BACKEND_PUBLIC_URL || process.env.PUBLIC_APP_URL || 'http://localhost:5000', 1000).replace(/\/$/, '');
  const redirectUri = clean(
    process.env.MEETING_CALENDAR_OAUTH_REDIRECT_URI
      || `${backendUrl}/api/meeting-minutes/calendar-connection/callback`,
    1500
  );
  const allowedDomain = clean(process.env.MEETING_CALENDAR_ALLOWED_DOMAIN || 'unicesmag.edu.co', 200).toLowerCase();
  return {
    clientId,
    clientSecret,
    redirectUri,
    allowedDomain,
    configured: Boolean(clientId && clientSecret && redirectUri),
    message: clientId && clientSecret && redirectUri
      ? 'La conexión individual con Google Calendar está configurada.'
      : 'Falta configurar el cliente OAuth de Google Calendar en el servidor.'
  };
};

const assertConfigured = () => {
  const config = getOAuthConfiguration();
  if (!config.configured) {
    const error = new Error(config.message);
    error.code = 'CALENDAR_OAUTH_NOT_CONFIGURED';
    throw error;
  }
  return config;
};

const createOAuthClient = () => {
  const config = assertConfigured();
  return new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);
};

const createAuthorizationUrl = ({ userId, expectedEmail }) => {
  const client = createOAuthClient();
  const state = encryptPayload({
    purpose: 'meeting_calendar_oauth',
    user_id: Number(userId),
    expected_email: normalizeEmail(expectedEmail),
    nonce: crypto.randomBytes(16).toString('hex')
  }, 10 * 60);
  return client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: true,
    scope: CALENDAR_SCOPES,
    state,
    login_hint: normalizeEmail(expectedEmail)
  });
};

const readAuthorizationState = (state) => {
  const payload = decryptPayload(state);
  if (payload?.purpose !== 'meeting_calendar_oauth' || !Number(payload.user_id)) {
    const error = new Error('La solicitud de conexión con Calendar no es válida o expiró.');
    error.code = 'INVALID_CALENDAR_OAUTH_STATE';
    throw error;
  }
  return payload;
};

const exchangeAuthorizationCode = async (code) => {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(clean(code, 5000));
  client.setCredentials(tokens);
  const oauth = google.oauth2({ version: 'v2', auth: client });
  const profile = await oauth.userinfo.get();
  return {
    client,
    tokens,
    email: normalizeEmail(profile.data?.email),
    verified: profile.data?.verified_email !== false
  };
};

const encryptRefreshToken = (refreshToken) => encryptPayload({
  purpose: 'meeting_calendar_refresh_token',
  refresh_token: clean(refreshToken, 5000)
}, null);

const decryptRefreshToken = (encryptedToken) => {
  const payload = decryptPayload(encryptedToken);
  if (payload?.purpose !== 'meeting_calendar_refresh_token' || !payload.refresh_token) {
    throw new Error('La autorización guardada de Google Calendar no es válida.');
  }
  return payload.refresh_token;
};

const createConnectedOAuthClient = (connection) => {
  if (!connection?.refresh_token_encrypted || connection.status !== 'connected') {
    const error = new Error('Conecte su cuenta de Google Calendar antes de continuar.');
    error.code = 'CALENDAR_NOT_CONNECTED';
    throw error;
  }
  const client = createOAuthClient();
  client.setCredentials({ refresh_token: decryptRefreshToken(connection.refresh_token_encrypted) });
  return client;
};

module.exports = {
  CALENDAR_SCOPES,
  getOAuthConfiguration,
  createAuthorizationUrl,
  readAuthorizationState,
  exchangeAuthorizationCode,
  encryptRefreshToken,
  createConnectedOAuthClient,
  _internals: { normalizeEmail, encryptRefreshToken, decryptRefreshToken }
};
