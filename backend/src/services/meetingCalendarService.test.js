const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAttendees, checkAvailability, saveCalendarEvent, _internals
} = require('./meetingCalendarService');

const withCalendarEnvironment = async (callback) => {
  const previous = {
    clientId: process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID,
    clientSecret: process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET,
    domain: process.env.MEETING_CALENDAR_ALLOWED_DOMAIN,
    timezone: process.env.MEETING_CALENDAR_TIMEZONE
  };
  process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID = 'calendar-oauth-client';
  process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET = 'calendar-oauth-secret';
  process.env.MEETING_CALENDAR_ALLOWED_DOMAIN = 'unicesmag.edu.co';
  process.env.MEETING_CALENDAR_TIMEZONE = 'America/Bogota';
  try {
    await callback();
  } finally {
    if (previous.clientId === undefined) delete process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID;
    else process.env.MEETING_CALENDAR_OAUTH_CLIENT_ID = previous.clientId;
    if (previous.clientSecret === undefined) delete process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET;
    else process.env.MEETING_CALENDAR_OAUTH_CLIENT_SECRET = previous.clientSecret;
    if (previous.domain === undefined) delete process.env.MEETING_CALENDAR_ALLOWED_DOMAIN;
    else process.env.MEETING_CALENDAR_ALLOWED_DOMAIN = previous.domain;
    if (previous.timezone === undefined) delete process.env.MEETING_CALENDAR_TIMEZONE;
    else process.env.MEETING_CALENDAR_TIMEZONE = previous.timezone;
  }
};

test('normaliza correos de asistentes y elimina duplicados', () => {
  assert.deepEqual(normalizeAttendees([
    { name: 'Ana', email: ' ANA@UNICESMAG.EDU.CO ', source: 'minute' },
    { name: 'Duplicada', email: 'ana@unicesmag.edu.co' },
    { name: 'Inválida', email: 'sin-correo' }
  ]), [{ name: 'Ana', email: 'ana@unicesmag.edu.co', source: 'minute' }]);
});

test('rechaza organizadores que no pertenecen al dominio institucional', async () => {
  await withCalendarEnvironment(async () => {
    assert.throws(
      () => _internals.assertInstitutionalOrganizer('lider@gmail.com'),
      /Responsable Principal debe tener un correo @unicesmag\.edu\.co/
    );
  });
});

test('clasifica participantes disponibles, ocupados y no verificables', async () => {
  await withCalendarEnvironment(async () => {
    const calendarClient = {
      freebusy: {
        query: async () => ({ data: { calendars: {
          'lider@unicesmag.edu.co': { busy: [] },
          'ocupado@unicesmag.edu.co': { busy: [{ start: '2026-10-01T14:00:00Z', end: '2026-10-01T15:00:00Z' }] },
          'externo@example.com': { errors: [{ reason: 'notFound' }], busy: [] }
        } } })
      }
    };
    const result = await checkAvailability({
      organizerEmail: 'lider@unicesmag.edu.co',
      attendees: [
        { name: 'Ocupado', email: 'ocupado@unicesmag.edu.co' },
        { name: 'Externo', email: 'externo@example.com' }
      ],
      startAt: '2026-10-01T09:00:00-05:00',
      endAt: '2026-10-01T10:00:00-05:00',
      calendarClient
    });
    assert.deepEqual(result.map(({ email, status }) => ({ email, status })), [
      { email: 'lider@unicesmag.edu.co', status: 'available' },
      { email: 'ocupado@unicesmag.edu.co', status: 'busy' },
      { email: 'externo@example.com', status: 'unknown' }
    ]);
  });
});

test('crea el evento con el responsable como organizador e invitados adicionales', async () => {
  await withCalendarEnvironment(async () => {
    let inserted;
    const calendarClient = {
      events: {
        list: async () => ({ data: { items: [] } }),
        insert: async (request) => {
          inserted = request;
          return { data: { id: 'event-1', htmlLink: 'https://calendar.google.com/event?eid=1' } };
        }
      }
    };
    const event = await saveCalendarEvent({
      organizerEmail: 'lider@unicesmag.edu.co',
      minuteId: 'minute-1',
      minuteCode: 'ACTA-1',
      summary: 'Seguimiento institucional',
      location: 'Sala de Juntas',
      startAt: '2026-10-01T09:00:00-05:00',
      endAt: '2026-10-01T10:00:00-05:00',
      attendees: [
        { email: 'lider@unicesmag.edu.co' },
        { name: 'Invitado adicional', email: 'invitado@unicesmag.edu.co' }
      ],
      calendarClient
    });
    assert.equal(event.id, 'event-1');
    assert.equal(inserted.sendUpdates, 'all');
    assert.deepEqual(inserted.requestBody.attendees, [
      { email: 'invitado@unicesmag.edu.co', displayName: 'Invitado adicional' }
    ]);
    assert.equal(inserted.requestBody.extendedProperties.private.siacMinuteId, 'minute-1');
  });
});
