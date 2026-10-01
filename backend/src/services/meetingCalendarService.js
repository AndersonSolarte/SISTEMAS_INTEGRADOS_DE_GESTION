const { google } = require('googleapis');
const { getOAuthConfiguration } = require('./meetingCalendarOAuthService');

const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const normalizeEmail = (value) => clean(value, 254).toLowerCase();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const getCalendarConfiguration = () => {
  const oauth = getOAuthConfiguration();
  return {
    configured: oauth.configured,
    domain: clean(process.env.MEETING_CALENDAR_ALLOWED_DOMAIN || 'unicesmag.edu.co', 200).toLowerCase(),
    timezone: clean(process.env.MEETING_CALENDAR_TIMEZONE || 'America/Bogota', 80),
    message: oauth.message
  };
};

const assertInstitutionalOrganizer = (organizerEmail) => {
  const config = getCalendarConfiguration();
  const email = normalizeEmail(organizerEmail);
  if (!isEmail(email) || !email.endsWith(`@${config.domain}`)) {
    const error = new Error(`El Responsable Principal debe tener un correo @${config.domain} para organizar la reunión.`);
    error.code = 'INVALID_CALENDAR_ORGANIZER';
    throw error;
  }
  return { ...config, email };
};

const normalizeAttendees = (attendees = []) => {
  const unique = new Map();
  for (const attendee of Array.isArray(attendees) ? attendees : []) {
    const email = normalizeEmail(typeof attendee === 'string' ? attendee : attendee?.email);
    if (!isEmail(email) || unique.has(email)) continue;
    unique.set(email, {
      email,
      name: clean(typeof attendee === 'string' ? '' : attendee?.name, 240),
      source: clean(typeof attendee === 'string' ? 'additional' : attendee?.source, 40) || 'additional'
    });
  }
  return [...unique.values()];
};

const parseRange = (startAt, endAt) => {
  const start = new Date(startAt);
  const end = new Date(endAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    const error = new Error('Seleccione una fecha y horario válidos.');
    error.code = 'INVALID_CALENDAR_RANGE';
    throw error;
  }
  if (end <= start) {
    const error = new Error('La hora de finalización debe ser posterior a la hora de inicio.');
    error.code = 'INVALID_CALENDAR_RANGE';
    throw error;
  }
  const bogotaMinutes = (value) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Bogota', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
    }).formatToParts(value);
    const get = (type) => Number(parts.find((part) => part.type === type)?.value || 0);
    return get('hour') * 60 + get('minute');
  };
  if (bogotaMinutes(start) < 7 * 60 || bogotaMinutes(end) > 18 * 60) {
    const error = new Error('Las reuniones solo pueden programarse entre las 7:00 a. m. y las 6:00 p. m.');
    error.code = 'INVALID_CALENDAR_RANGE';
    throw error;
  }
  return { start, end };
};

const requireCalendar = (authClient, calendarClient) => {
  if (calendarClient) return calendarClient;
  if (!authClient) {
    const error = new Error('Conecte su cuenta de Google Calendar antes de continuar.');
    error.code = 'CALENDAR_NOT_CONNECTED';
    throw error;
  }
  return google.calendar({ version: 'v3', auth: authClient });
};

const normalizeIgnoredBusyRange = (ignoreBusyRange) => {
  if (!ignoreBusyRange) return null;
  const start = new Date(ignoreBusyRange.startAt || ignoreBusyRange.start_at || ignoreBusyRange.start);
  const end = new Date(ignoreBusyRange.endAt || ignoreBusyRange.end_at || ignoreBusyRange.end);
  return Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start
    ? null
    : { start, end };
};

// FreeBusy no devuelve identificadores de eventos. Al editar una reunión, se
// resta del resultado el intervalo que ya pertenece a esa misma programación,
// evitando que el evento se marque a sí mismo como conflicto.
const excludeBusyRange = (busyRanges, ignoreBusyRange) => {
  const ignored = normalizeIgnoredBusyRange(ignoreBusyRange);
  if (!ignored) return busyRanges;
  return busyRanges.flatMap((busyRange) => {
    const start = new Date(busyRange.start);
    const end = new Date(busyRange.end);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= ignored.start || start >= ignored.end) {
      return [busyRange];
    }
    const remaining = [];
    if (start < ignored.start) remaining.push({ start: start.toISOString(), end: ignored.start.toISOString() });
    if (end > ignored.end) remaining.push({ start: ignored.end.toISOString(), end: end.toISOString() });
    return remaining;
  });
};

const checkAvailability = async ({
  organizerEmail, organizerName, attendees, startAt, endAt, ignoreBusyRange, authClient, calendarClient
}) => {
  const config = assertInstitutionalOrganizer(organizerEmail);
  const range = parseRange(startAt, endAt);
  const people = normalizeAttendees([{ email: config.email, name: organizerName, source: 'organizer' }, ...attendees]);
  if (!people.length) return [];
  const calendar = requireCalendar(authClient, calendarClient);
  const calendars = {};
  for (let index = 0; index < people.length; index += 50) {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: range.start.toISOString(),
        timeMax: range.end.toISOString(),
        timeZone: config.timezone,
        items: people.slice(index, index + 50).map(({ email }) => ({ id: email }))
      }
    });
    Object.assign(calendars, response.data?.calendars || {});
  }
  return people.map((person) => {
    const calendarInfo = calendars[person.email];
    const errors = Array.isArray(calendarInfo?.errors) ? calendarInfo.errors : [];
    const busy = excludeBusyRange(Array.isArray(calendarInfo?.busy) ? calendarInfo.busy : [], ignoreBusyRange);
    return {
      ...person,
      status: !calendarInfo || errors.length ? 'unknown' : busy.length ? 'busy' : 'available',
      busy: busy.map((rangeItem) => ({ start: rangeItem.start, end: rangeItem.end })),
      reason: errors[0]?.reason || (!calendarInfo ? 'notFound' : '')
    };
  });
};

const bogotaDateKey = (value) => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(value);
  const get = (type) => parts.find((part) => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
};

const findAvailableSlots = async ({
  organizerEmail, organizerName, attendees, startAt, endAt, days = 14, ignoreBusyRange, authClient, calendarClient
}) => {
  const config = assertInstitutionalOrganizer(organizerEmail);
  const range = parseRange(startAt, endAt);
  const durationMs = range.end.getTime() - range.start.getTime();
  const people = normalizeAttendees([{ email: config.email, name: organizerName, source: 'organizer' }, ...attendees]);
  const firstDate = bogotaDateKey(range.start);
  const firstDay = new Date(`${firstDate}T00:00:00-05:00`);
  const horizonDays = Math.min(30, Math.max(1, Number(days) || 14));
  const lastDay = new Date(firstDay.getTime() + horizonDays * 24 * 60 * 60 * 1000);
  const calendar = requireCalendar(authClient, calendarClient);
  const calendars = {};
  for (let index = 0; index < people.length; index += 50) {
    const response = await calendar.freebusy.query({
      requestBody: {
        timeMin: firstDay.toISOString(),
        timeMax: lastDay.toISOString(),
        timeZone: config.timezone,
        items: people.slice(index, index + 50).map(({ email }) => ({ id: email }))
      }
    });
    Object.assign(calendars, response.data?.calendars || {});
  }

  const verifiable = people.filter((person) => calendars[person.email] && !(calendars[person.email].errors || []).length);
  const unknown = people.filter((person) => !calendars[person.email] || (calendars[person.email].errors || []).length);
  const slots = [];
  const now = new Date();
  for (let dayOffset = 0; dayOffset < horizonDays && slots.length < 16; dayOffset += 1) {
    const day = new Date(firstDay.getTime() + dayOffset * 24 * 60 * 60 * 1000);
    const dateKey = bogotaDateKey(day);
    const weekDay = new Date(`${dateKey}T12:00:00-05:00`).getUTCDay();
    if (weekDay === 0 || weekDay === 6) continue;
    for (let minutes = 7 * 60; minutes + durationMs / 60000 <= 18 * 60 && slots.length < 16; minutes += 30) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
      const minute = String(minutes % 60).padStart(2, '0');
      const candidateStart = new Date(`${dateKey}T${hour}:${minute}:00-05:00`);
      const candidateEnd = new Date(candidateStart.getTime() + durationMs);
      if (candidateStart <= now || candidateStart < range.start) continue;
      const freeForAll = verifiable.every((person) => {
        const busy = excludeBusyRange(
          Array.isArray(calendars[person.email]?.busy) ? calendars[person.email].busy : [],
          ignoreBusyRange
        );
        return busy.every((busyRange) => candidateEnd <= new Date(busyRange.start) || candidateStart >= new Date(busyRange.end));
      });
      if (freeForAll) slots.push({ start: candidateStart.toISOString(), end: candidateEnd.toISOString() });
    }
  }
  return {
    slots,
    unknown: unknown.map(({ email, name }) => ({ email, name }))
  };
};

const findExistingEvent = async (calendar, minuteId) => {
  const response = await calendar.events.list({
    calendarId: 'primary',
    privateExtendedProperty: [`siacMinuteId=${minuteId}`],
    maxResults: 1,
    singleEvents: true,
    showDeleted: false
  });
  return response.data?.items?.[0] || null;
};

const saveCalendarEvent = async ({
  organizerEmail, minuteId, minuteCode, eventId, summary, description, location,
  startAt, endAt, attendees, authClient, calendarClient
}) => {
  const config = assertInstitutionalOrganizer(organizerEmail);
  const range = parseRange(startAt, endAt);
  const people = normalizeAttendees(attendees).filter(({ email }) => email !== config.email);
  const calendar = requireCalendar(authClient, calendarClient);
  const existing = eventId ? { id: eventId } : await findExistingEvent(calendar, minuteId);
  const requestBody = {
    summary: clean(summary, 240),
    description: clean(description || `Reunión programada desde el acta ${minuteCode || ''}.`, 4000),
    location: clean(location, 500),
    start: { dateTime: range.start.toISOString(), timeZone: config.timezone },
    end: { dateTime: range.end.toISOString(), timeZone: config.timezone },
    attendees: people.map(({ email, name }) => ({ email, displayName: name || undefined })),
    transparency: 'opaque',
    visibility: 'default',
    extendedProperties: { private: { siacMinuteId: String(minuteId), siacMinuteCode: clean(minuteCode, 80) } }
  };
  const response = existing?.id
    ? await calendar.events.update({ calendarId: 'primary', eventId: existing.id, sendUpdates: 'all', requestBody })
    : await calendar.events.insert({ calendarId: 'primary', sendUpdates: 'all', requestBody });
  return response.data;
};

const cancelCalendarEvent = async ({ eventId, authClient, calendarClient }) => {
  const id = clean(eventId, 255);
  if (!id) return;
  const calendar = requireCalendar(authClient, calendarClient);
  try {
    await calendar.events.delete({ calendarId: 'primary', eventId: id, sendUpdates: 'all' });
  } catch (error) {
    const status = Number(error?.response?.status || error?.code || 0);
    if (status !== 404 && status !== 410) throw error;
  }
};

module.exports = {
  getCalendarConfiguration,
  normalizeAttendees,
  checkAvailability,
  findAvailableSlots,
  saveCalendarEvent,
  cancelCalendarEvent,
  _internals: { normalizeAttendees, parseRange, assertInstitutionalOrganizer, excludeBusyRange }
};
