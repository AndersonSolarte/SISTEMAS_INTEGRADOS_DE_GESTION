const test = require('node:test');
const assert = require('node:assert/strict');
const {
  CALENDAR_SCOPES, createAuthorizationUrl, readAuthorizationState, _internals
} = require('./meetingCalendarOAuthService');

const withEnvironment = (callback) => {
  const previous = {
    id: process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID,
    secret: process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET,
    jwt: process.env.JWT_SECRET
  };
  process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID = 'oauth-client.apps.googleusercontent.com';
  process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET = 'oauth-secret';
  process.env.JWT_SECRET = 'test-calendar-encryption-key';
  try { return callback(); } finally {
    if (previous.id === undefined) delete process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID; else process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID = previous.id;
    if (previous.secret === undefined) delete process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET; else process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET = previous.secret;
    if (previous.jwt === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous.jwt;
  }
};

test('genera autorizaciÃ³n individual con estado cifrado y permisos mÃ­nimos de Calendar', () => withEnvironment(() => {
  const url = new URL(createAuthorizationUrl({ userId: 17, expectedEmail: 'lider@unicesmag.edu.co' }));
  assert.equal(url.searchParams.get('access_type'), 'offline');
  assert.equal(url.searchParams.get('prompt'), 'consent');
  CALENDAR_SCOPES.forEach((scope) => assert.match(url.searchParams.get('scope'), new RegExp(scope.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))));
  const state = readAuthorizationState(url.searchParams.get('state'));
  assert.equal(state.user_id, 17);
  assert.equal(state.expected_email, 'lider@unicesmag.edu.co');
}));

test('cifra y recupera el refresh token sin almacenarlo en texto plano', () => withEnvironment(() => {
  const encrypted = _internals.encryptRefreshToken('1//refresh-secret');
  assert.doesNotMatch(encrypted, /refresh-secret/);
  assert.equal(_internals.decryptRefreshToken(encrypted), '1//refresh-secret');
}));
