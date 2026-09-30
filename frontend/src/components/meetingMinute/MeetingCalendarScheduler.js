import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, IconButton, Link, Paper, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import { Add, CalendarMonth, DeleteOutline, EventAvailable, OpenInNew, Refresh } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';
import formatPersonName from '../../utils/formatPersonName';

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());
const normalizePeople = (people = []) => {
  const unique = new Map();
  people.forEach((person) => {
    const email = String(person?.email || '').trim().toLowerCase();
    if (!validEmail(email) || unique.has(email)) return;
    unique.set(email, {
      email,
      name: formatPersonName(person?.name || person?.nombre || ''),
      source: person?.source || 'minute'
    });
  });
  return [...unique.values()];
};

const bogotaParts = (value) => {
  if (!value) return { date: '', time: '' };
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(value));
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
};

const calendarDateTime = (date, time) => (date && time ? `${date}T${time}:00-05:00` : '');

export default function MeetingCalendarScheduler({
  minuteId, minuteTitle, defaultLocation, participants = [], responsibles = []
}) {
  const { enqueueSnackbar } = useSnackbar();
  const initialPeople = useMemo(() => normalizePeople([
    ...responsibles.map((person) => ({ ...person, source: 'responsible' })),
    ...participants.map((person) => ({ ...person, source: 'participant' }))
  ]), [participants, responsibles]);
  const defaultsRef = useRef(null);
  defaultsRef.current = { defaultLocation, enqueueSnackbar, initialPeople, minuteTitle };
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [organizer, setOrganizer] = useState(null);
  const [connection, setConnection] = useState({ connected: false });
  const [existing, setExisting] = useState(null);
  const [connectionRefresh, setConnectionRefresh] = useState(0);
  const [availability, setAvailability] = useState(null);
  const [extra, setExtra] = useState({ name: '', email: '' });
  const [form, setForm] = useState({
    summary: '', date: '', start: '', end: '', location: '', attendees: []
  });

  useEffect(() => {
    if (!minuteId) return undefined;
    let active = true;
    const defaults = defaultsRef.current;
    setLoading(true);
    meetingMinuteService.getCalendarSchedule(minuteId).then((response) => {
      if (!active) return;
      const data = response.data || {};
      const schedule = data.schedule;
      setConfiguration(data.configuration || null);
      setOrganizer(data.organizer || null);
      setConnection(data.connection || { connected: false });
      setExisting(schedule || null);
      if (schedule) {
        const start = bogotaParts(schedule.start_at);
        const end = bogotaParts(schedule.end_at);
        setForm({
          summary: schedule.summary || '',
          date: start.date,
          start: start.time,
          end: end.time,
          location: schedule.location || '',
          attendees: normalizePeople(schedule.attendees || [])
        });
      } else {
        setForm({
          summary: defaults.minuteTitle ? `Seguimiento · ${defaults.minuteTitle}` : 'Siguiente reunión',
          date: '', start: '', end: '', location: defaults.defaultLocation || '', attendees: defaults.initialPeople
        });
      }
    }).catch((error) => {
      if (active) defaults.enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar la programación de Calendar.', { variant: 'error' });
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [minuteId, connectionRefresh]); // Los asistentes se fijan al abrir el acta; después el usuario puede ajustarlos aquí.

  useEffect(() => {
    const receiveOAuthResult = (event) => {
      if (event.data?.type === 'siac-calendar-oauth') setConnectionRefresh((value) => value + 1);
    };
    window.addEventListener('message', receiveOAuthResult);
    return () => window.removeEventListener('message', receiveOAuthResult);
  }, []);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setAvailability(null);
  };

  const addPerson = () => {
    const email = String(extra.email || '').trim().toLowerCase();
    if (!validEmail(email)) return enqueueSnackbar('Digite un correo válido para el nuevo invitado.', { variant: 'warning' });
    if (form.attendees.some((person) => person.email === email)) return enqueueSnackbar('Este correo ya está incluido.', { variant: 'info' });
    update('attendees', [...form.attendees, { name: formatPersonName(extra.name), email, source: 'additional' }]);
    setExtra({ name: '', email: '' });
  };

  const payload = (force = false) => ({
    summary: form.summary.trim(),
    location: form.location.trim(),
    start_at: calendarDateTime(form.date, form.start),
    end_at: calendarDateTime(form.date, form.end),
    attendees: form.attendees,
    force
  });

  const validate = () => {
    if (!form.summary.trim()) return 'Digite el título de la siguiente reunión.';
    if (!form.date || !form.start || !form.end) return 'Seleccione la fecha, hora de inicio y hora de finalización.';
    if (form.end <= form.start) return 'La hora de finalización debe ser posterior a la hora de inicio.';
    return '';
  };

  const check = async () => {
    const issue = validate();
    if (issue) return enqueueSnackbar(issue, { variant: 'warning' });
    setWorking(true);
    try {
      const response = await meetingMinuteService.checkCalendarAvailability(minuteId, payload());
      setAvailability(response.data?.availability || []);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible consultar la disponibilidad.', { variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const schedule = async (force = false) => {
    const issue = validate();
    if (issue) return enqueueSnackbar(issue, { variant: 'warning' });
    setWorking(true);
    try {
      const response = await meetingMinuteService.saveCalendarSchedule(minuteId, payload(force));
      const saved = response.data?.schedule;
      setExisting(saved || null);
      setAvailability(response.data?.availability || availability);
      enqueueSnackbar(response.message || 'Reunión programada en Google Calendar.', { variant: 'success' });
    } catch (error) {
      const conflictAvailability = error.response?.data?.data?.availability;
      if (Array.isArray(conflictAvailability)) setAvailability(conflictAvailability);
      enqueueSnackbar(error.response?.data?.message || 'No fue posible programar la reunión.', { variant: error.response?.status === 409 ? 'warning' : 'error' });
    } finally {
      setWorking(false);
    }
  };

  const connectCalendar = async () => {
    const popup = window.open('', 'siac-google-calendar', 'width=560,height=720,resizable=yes,scrollbars=yes');
    if (!popup) return enqueueSnackbar('Permita las ventanas emergentes para conectar Google Calendar.', { variant: 'warning' });
    popup.document.write('<p style="font-family:Arial;padding:24px">Abriendo autorización segura de Google…</p>');
    try {
      const response = await meetingMinuteService.startCalendarConnection(minuteId);
      popup.location.href = response.data?.url;
      const poll = window.setInterval(() => {
        if (popup.closed) {
          window.clearInterval(poll);
          setConnectionRefresh((value) => value + 1);
        }
      }, 800);
    } catch (error) {
      popup.close();
      enqueueSnackbar(error.response?.data?.message || 'No fue posible iniciar la conexión con Google Calendar.', { variant: 'error' });
    }
  };

  const disconnectCalendar = async () => {
    if (!window.confirm('¿Desea desconectar su cuenta de Google Calendar de SIAC?')) return;
    setWorking(true);
    try {
      const response = await meetingMinuteService.disconnectCalendar(minuteId);
      setConnection({ connected: false });
      setAvailability(null);
      enqueueSnackbar(response.message || 'Google Calendar fue desconectado.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible desconectar Google Calendar.', { variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const busy = availability?.filter((person) => person.status === 'busy') || [];
  const unknown = availability?.filter((person) => person.status === 'unknown') || [];

  if (loading) return <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction="row" gap={1} alignItems="center"><CircularProgress size={18} /><Typography>Cargando programación…</Typography></Stack></Paper>;

  return (
    <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, borderColor: '#93c5fd', bgcolor: '#f8fbff' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={1.5}>
        <Box>
          <Stack direction="row" gap={1} alignItems="center"><CalendarMonth color="primary" /><Typography fontWeight={900}>3. Programar siguiente reunión</Typography></Stack>
          <Typography variant="body2" color="text.secondary" mt={0.4}>Opcional · Esta información no forma parte del acta ni del PDF.</Typography>
        </Box>
        {existing?.google_event_url && <Button component={Link} href={existing.google_event_url} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNew />} size="small" sx={{ textTransform: 'none', fontWeight: 800 }}>Abrir en Calendar</Button>}
      </Stack>

      {!configuration?.configured && <Alert severity="warning" sx={{ mb: 1.5 }}>{configuration?.message || 'Google Calendar aún no está configurado en el servidor.'}</Alert>}
      {configuration?.configured && !connection.connected && (
        <Alert severity="warning" sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={connectCalendar} sx={{ fontWeight: 900, whiteSpace: 'nowrap' }}>Conectar mi Calendar</Button>}>
          Conecte la cuenta <strong>{organizer?.email}</strong>. Google solicitará permiso solamente para consultar disponibilidad y administrar reuniones.
        </Alert>
      )}
      {connection.connected && (
        <Alert severity="success" icon={<EventAvailable />} sx={{ mb: 1.5 }} action={<Button color="inherit" size="small" onClick={disconnectCalendar}>Desconectar</Button>}>
          Calendar conectado como <strong>{connection.email}</strong>. Organiza {formatPersonName(organizer?.name)}.
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.2 }}>
        <TextField label="Título de la reunión" value={form.summary} onChange={(event) => update('summary', event.target.value.slice(0, 240))} sx={{ gridColumn: { sm: '1 / -1' } }} />
        <TextField type="date" label="Fecha" InputLabelProps={{ shrink: true }} value={form.date} onChange={(event) => update('date', event.target.value)} />
        <TextField label="Lugar o enlace" value={form.location} onChange={(event) => update('location', event.target.value)} />
        <TextField type="time" label="Hora de inicio" InputLabelProps={{ shrink: true }} value={form.start} onChange={(event) => update('start', event.target.value)} />
        <TextField type="time" label="Hora de finalización" InputLabelProps={{ shrink: true }} value={form.end} onChange={(event) => update('end', event.target.value)} />
      </Box>

      <Typography fontWeight={850} mt={2} mb={0.75}>Invitados de Calendar</Typography>
      <Stack gap={0.75}>
        {form.attendees.map((person) => {
          const result = availability?.find((item) => item.email === person.email);
          const isOrganizer = person.email === organizer?.email;
          const color = result?.status === 'available' ? 'success' : result?.status === 'busy' ? 'error' : result?.status === 'unknown' ? 'default' : 'primary';
          const label = result?.status === 'available' ? 'Disponible' : result?.status === 'busy' ? 'Ocupado' : result?.status === 'unknown' ? 'No verificable' : 'Sin consultar';
          return <Box key={person.email} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 0.75, p: 0.9, bgcolor: '#fff', border: '1px solid #dbeafe', borderRadius: 2 }}><Box><Stack direction="row" alignItems="center" gap={0.6}><Typography variant="body2" fontWeight={800}>{person.name || person.email}</Typography>{isOrganizer && <Chip size="small" label="Organizador" color="primary" variant="outlined" sx={{ height: 19, fontSize: 10 }} />}</Stack><Typography variant="caption" color="text.secondary">{person.email}</Typography></Box><Chip size="small" color={color} variant={result?.status === 'unknown' ? 'outlined' : 'filled'} label={label} /><Tooltip title={isOrganizer ? 'El Responsable Principal siempre organiza la reunión' : 'Quitar de esta invitación'}><span><IconButton disabled={isOrganizer} size="small" color="error" onClick={() => update('attendees', form.attendees.filter((item) => item.email !== person.email))}><DeleteOutline fontSize="small" /></IconButton></span></Tooltip></Box>;
        })}
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.3fr auto' }, gap: 1, mt: 1.25 }}>
        <TextField size="small" label="Nombre del nuevo invitado" value={extra.name} onChange={(event) => setExtra((current) => ({ ...current, name: event.target.value }))} />
        <TextField size="small" type="email" label="Correo institucional o externo" value={extra.email} onChange={(event) => setExtra((current) => ({ ...current, email: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addPerson(); } }} />
        <Button variant="outlined" startIcon={<Add />} onClick={addPerson} sx={{ textTransform: 'none', fontWeight: 800 }}>Agregar</Button>
      </Box>

      {busy.length > 0 && <Alert severity="warning" sx={{ mt: 1.5 }}><strong>No pueden en este horario:</strong> {busy.map((person) => person.name || person.email).join(', ')}.</Alert>}
      {unknown.length > 0 && <Alert severity="info" sx={{ mt: 1 }}><strong>No fue posible verificar:</strong> {unknown.map((person) => person.name || person.email).join(', ')}. Aun así recibirán la invitación.</Alert>}
      {availability && !busy.length && !unknown.length && <Alert severity="success" sx={{ mt: 1.5 }}>Todos los calendarios consultados están disponibles.</Alert>}

      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" gap={1} mt={2}>
        <Button variant="outlined" startIcon={working ? <CircularProgress size={16} /> : <Refresh />} disabled={working || !configuration?.configured || !connection.connected} onClick={check} sx={{ textTransform: 'none', fontWeight: 850 }}>Consultar disponibilidad</Button>
        {busy.length > 0 ? (
          <Button color="warning" variant="contained" disabled={working || !configuration?.configured || !connection.connected} onClick={() => schedule(true)} sx={{ textTransform: 'none', fontWeight: 900 }}>{existing ? 'Actualizar de todas formas' : 'Programar de todas formas'}</Button>
        ) : (
          <Button variant="contained" startIcon={<EventAvailable />} disabled={working || !configuration?.configured || !connection.connected || !availability} onClick={() => schedule(false)} sx={{ textTransform: 'none', fontWeight: 900 }}>{existing ? 'Actualizar en Calendar' : 'Programar en Calendar'}</Button>
        )}
      </Stack>
    </Paper>
  );
}
