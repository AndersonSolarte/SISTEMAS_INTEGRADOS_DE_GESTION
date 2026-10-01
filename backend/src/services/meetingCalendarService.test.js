const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeAttendees, checkAvailability, findAvailableSlots, saveCalendarEvent, cancelCalendarEvent, _internals
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

test('rechaza reuniones antes de las 7 a. m. o después de las 6 p. m.', async () => {
  await withCalendarEnvironment(async () => {
    await assert.rejects(
      () => checkAvailability({
        organizerEmail: 'lider@unicesmag.edu.co',
        attendees: [],
        startAt: '2026-10-01T06:30:00-05:00',
        endAt: '2026-10-01T07:30:00-05:00',
        calendarClient: { freebusy: { query: async () => ({ data: { calendars: {} } }) } }
      }),
      /7:00 a\. m\. y las 6:00 p\. m\./
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

test('al editar excluye la reunión actual de la disponibilidad', async () => {
  await withCalendarEnvironment(async () => {
    const currentMeeting = { start: '2026-10-02T15:00:00.000Z', end: '2026-10-02T16:00:00.000Z' };
    const result = await checkAvailability({
      organizerEmail: 'lider@unicesmag.edu.co',
      attendees: [{ email: 'invitado@unicesmag.edu.co' }],
      startAt: '2026-10-02T10:00:00-05:00',
      endAt: '2026-10-02T11:00:00-05:00',
      ignoreBusyRange: currentMeeting,
      calendarClient: {
        freebusy: {
          query: async () => ({ data: { calendars: {
            'lider@unicesmag.edu.co': { busy: [currentMeeting] },
            'invitado@unicesmag.edu.co': { busy: [currentMeeting] }
          } } })
        }
      }
    });
    assert.deepEqual(result.map(({ email, status, busy }) => ({ email, status, busy })), [
      { email: 'lider@unicesmag.edu.co', status: 'available', busy: [] },
      { email: 'invitado@unicesmag.edu.co', status: 'available', busy: [] }
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

test('al editar actualiza el mismo evento y no crea uno nuevo', async () => {
  await withCalendarEnvironment(async () => {
    let updated;
    let insertions = 0;
    const event = await saveCalendarEvent({
      organizerEmail: 'lider@unicesmag.edu.co',
      minuteId: 'minute-1',
      minuteCode: 'ACTA-1',
      eventId: 'event-existing',
      summary: 'Seguimiento actualizado',
      location: 'Sala de Rectoría',
      startAt: '2026-10-02T10:00:00-05:00',
      endAt: '2026-10-02T11:00:00-05:00',
      attendees: [{ email: 'invitado@unicesmag.edu.co' }],
      calendarClient: {
        events: {
          update: async (request) => {
            updated = request;
            return { data: { id: 'event-existing' } };
          },
          insert: async () => {
            insertions += 1;
            return { data: { id: 'event-new' } };
          }
        }
      }
    });
    assert.equal(event.id, 'event-existing');
    assert.equal(updated.eventId, 'event-existing');
    assert.equal(updated.sendUpdates, 'all');
    assert.equal(insertions, 0);
  });
});

test('cancela el evento y solicita notificar a todos los invitados', async () => {
  let deleted;
  await cancelCalendarEvent({
    eventId: 'event-1',
    calendarClient: {
      events: {
        delete: async (request) => { deleted = request; }
      }
    }
  });
  assert.deepEqual(deleted, {
    calendarId: 'primary',
    eventId: 'event-1',
    sendUpdates: 'all'
  });
});

test('sugiere el siguiente horario laboral común conservando la duración', async () => {
  await withCalendarEnvironment(async () => {
    const result = await findAvailableSlots({
      organizerEmail: 'lider@unicesmag.edu.co',
      attendees: [{ email: 'ocupado@unicesmag.edu.co' }],
      startAt: '2027-10-01T09:00:00-05:00',
      endAt: '2027-10-01T10:00:00-05:00',
      days: 2,
      calendarClient: {
        freebusy: {
          query: async () => ({ data: { calendars: {
            'lider@unicesmag.edu.co': { busy: [] },
            'ocupado@unicesmag.edu.co': { busy: [{ start: '2027-10-01T14:00:00Z', end: '2027-10-01T15:00:00Z' }] }
          } } })
        }
      }
    });
    assert.equal(result.slots[0].start, '2027-10-01T15:00:00.000Z');
    assert.equal(result.slots[0].end, '2027-10-01T16:00:00.000Z');
  });
});
