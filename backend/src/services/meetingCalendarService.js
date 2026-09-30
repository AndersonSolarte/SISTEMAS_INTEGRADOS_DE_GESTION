const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/calendar.freebusy'
];

const clean = (value, max = 500) => String(value || '').trim().slice(0, max);
const normalizeEmail = (value) => clean(value, 254).toLowerCase();
const isEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const readServiceAccount = () => {
  const source = clean(
    process.env.MEETING_CALENDAR_SERVICE_ACCOUNT_JSON
      || process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
    20000
  );
  if (!source) return null;
  try {
    if (source.startsWith('{')) return JSON.parse(source);
    const resolved = path.isAbsolute(source) ? source : path.resolve(process.cwd(), source);
    if (!fs.existsSync(resolved)) return null;
    return JSON.parse(fs.readFileSync(resolved, 'utf8'));
  } catch (_) {
    return null;
  }
};

const getCalendarConfiguration = () => {
  const credentials = readServiceAccount();
  const domain = clean(process.env.MEETING_CALENDAR_ALLOWED_DOMAIN || 'unicesmag.edu.co', 200).toLowerCase();
  const timezone = clean(process.env.MEETING_CALENDAR_TIMEZONE || 'America/Bogota', 80);
  const configured = Boolean(credentials?.client_email && credentials?.private_key && domain);
  return {
    configured,
    domain,
    timezone,
    message: configured
      ? 'Google Calendar está configurado.'
      : 'Falta configurar la cuenta de servicio de Google Calendar con delegación institucional.'
  };
};

const assertInstitutionalOrganizer = (organizerEmail) => {
  const config = getCalendarConfiguration();
  const email = normalizeEmail(organizerEmail);
  if (!config.configured) {
    const error = new Error(config.message);
    error.code = 'CALENDAR_NOT_CONFIGURED';
    throw error;
  }
  if (!isEmail(email) || !email.endsWith(`@${config.domain}`)) {
    const error = new Error(`El Responsable Principal debe tener un correo @${config.domain} para organizar la reunión.`);
    error.code = 'INVALID_CALENDAR_ORGANIZER';
    throw error;
  }
  return { ...config, email };
};

const createDelegatedCalendar = (organizerEmail) => {
  const config = assertInstitutionalOrganizer(organizerEmail);
  const credentials = readServiceAccount();
  const auth = new google.auth.JWT({
    email: credentials.client_email,
    key: String(credentials.private_key || '').replace(/\\n/g, '\n'),
    scopes: CALENDAR_SCOPES,
    subject: config.email
  });
  return google.calendar({ version: 'v3', auth });
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
  return { start, end };
};

const checkAvailability = async ({ organizerEmail, organizerName, attendees, startAt, endAt, calendarClient }) => {
  const config = assertInstitutionalOrganizer(organizerEmail);
  const range = parseRange(startAt, endAt);
  const people = normalizeAttendees([{ email: config.email, name: organizerName, source: 'organizer' }, ...attendees]);
  if (!people.length) return [];
  const calendar = calendarClient || createDelegatedCalendar(config.email);
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
    const busy = Array.isArray(calendarInfo?.busy) ? calendarInfo.busy : [];
    return {
      ...person,
      status: !calendarInfo || errors.length ? 'unknown' : busy.length ? 'busy' : 'available',
      busy: busy.map((rangeItem) => ({ start: rangeItem.start, end: rangeItem.end })),
      reason: errors[0]?.reason || (!calendarInfo ? 'notFound' : '')
    };
  });
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
  startAt, endAt, attendees, calendarClient
}) => {
  const config = assertInstitutionalOrganizer(organizerEmail);
  const range = parseRange(startAt, endAt);
  const people = normalizeAttendees(attendees).filter(({ email }) => email !== config.email);
  const calendar = calendarClient || createDelegatedCalendar(config.email);
  const existing = eventId
    ? { id: eventId }
    : await findExistingEvent(calendar, minuteId);
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

module.exports = {
  getCalendarConfiguration,
  normalizeAttendees,
  checkAvailability,
  saveCalendarEvent,
  _internals: { normalizeAttendees, parseRange, assertInstitutionalOrganizer }
};
