import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, CircularProgress, Dialog, DialogContent, DialogTitle, IconButton, Link, Paper, Stack, TextField, Tooltip, Typography
} from '@mui/material';
import { Add, CalendarMonth, Close, DeleteOutline, EventAvailable, ExpandMore, OpenInNew, PersonSearch, Refresh } from '@mui/icons-material';
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
      document: String(person?.document || person?.username || '').trim(),
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
const formatScheduleDate = (value) => value ? new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short'
}).format(new Date(value)) : '';
const formatScheduleSlot = (slot) => {
  const start = new Date(slot.start);
  const end = new Date(slot.end);
  const day = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium' }).format(start);
  const time = new Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time.format(start)} – ${time.format(end)}`;
};

const nextSessionTitle = (value) => {
  const current = String(value || 'Reunión de seguimiento').trim();
  const match = current.match(/\s*-?\s*sesión\s+(\d+)\s*$/i);
  const base = current.replace(/\s*-?\s*sesión\s+\d+\s*$/i, '').trim() || 'Reunión de seguimiento';
  return `${base} - Sesión ${match ? Number(match[1]) + 1 : 2}`;
};

export default function MeetingCalendarScheduler({
  minuteId, minuteTitle, defaultLocation, participants = [], responsibles = [],
  lookupParticipantByDocument, dialogMode = false
}) {
  const { enqueueSnackbar } = useSnackbar();
  const initialPeople = useMemo(() => normalizePeople([
    ...responsibles.map((person) => ({ ...person, source: 'responsible' })),
    ...participants.map((person) => ({ ...person, source: 'participant' }))
  ]), [participants, responsibles]);
  const defaultsRef = useRef(null);
  const importedPeopleRef = useRef('');
  const fieldRefs = useRef({});
  defaultsRef.current = { defaultLocation, enqueueSnackbar, initialPeople, minuteTitle };
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeMinuteId, setActiveMinuteId] = useState(minuteId);
  const [loadError, setLoadError] = useState('');
  const [working, setWorking] = useState(false);
  const [configuration, setConfiguration] = useState(null);
  const [organizer, setOrganizer] = useState(null);
  const [connection, setConnection] = useState({ connected: false });
  const [existing, setExisting] = useState(null);
  const [connectionRefresh, setConnectionRefresh] = useState(0);
  const [availability, setAvailability] = useState(null);
  const [extra, setExtra] = useState({ name: '', email: '' });
  const [document, setDocument] = useState('');
  const [lookupWorking, setLookupWorking] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [upcoming, setUpcoming] = useState([]);
  const [showUpcoming, setShowUpcoming] = useState(false);
  const [slotSuggestions, setSlotSuggestions] = useState([]);
  const [suggestionsWorking, setSuggestionsWorking] = useState(false);
  const [showInternalGuest, setShowInternalGuest] = useState(false);
  const [showExternalGuest, setShowExternalGuest] = useState(false);
  const [showCommonSchedule, setShowCommonSchedule] = useState(false);
  const [autoChecking, setAutoChecking] = useState(false);
  const [form, setForm] = useState({
    summary: '', date: '', start: '', end: '', location: '', attendees: []
  });

  useEffect(() => {
    setActiveMinuteId(minuteId);
  }, [minuteId]);

  useEffect(() => {
    if (!activeMinuteId || (dialogMode && !dialogOpen)) return undefined;
    let active = true;
    const defaults = defaultsRef.current;
    setLoading(true);
    setLoadError('');
    meetingMinuteService.getCalendarSchedule(activeMinuteId).then((response) => {
      if (!active) return;
      const data = response.data || {};
      const schedule = data.schedule;
      setConfiguration(data.configuration || null);
      setOrganizer(data.organizer || null);
      setConnection(data.connection || { connected: false });
      setExisting(schedule || null);
      setAvailability(null);
      setSlotSuggestions([]);
      setShowCommonSchedule(false);
      if (data.connection?.connected) {
        meetingMinuteService.listUpcomingCalendar()
          .then((result) => active && setUpcoming(Array.isArray(result.data) ? result.data : []))
          .catch(() => active && setUpcoming([]));
      } else {
        setUpcoming([]);
      }
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
          summary: defaults.minuteTitle
            ? nextSessionTitle(defaults.minuteTitle)
            : 'Siguiente reunión - Sesión 2',
          date: '', start: '', end: '', location: defaults.defaultLocation || '', attendees: defaults.initialPeople
        });
      }
    }).catch((error) => {
      if (!active) return;
      const message = error.response?.data?.message || 'No fue posible cargar la programación de Calendar.';
      setLoadError(message);
      if (error.response?.status !== 403) defaults.enqueueSnackbar(message, { variant: 'error' });
    }).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [activeMinuteId, connectionRefresh, dialogMode, dialogOpen]); // Los asistentes se fijan al abrir el acta; después el usuario puede ajustarlos aquí.

  useEffect(() => {
    if (loading || existing || !initialPeople.length) return;
    const signature = initialPeople.map((person) => person.email).sort().join('|');
    if (signature === importedPeopleRef.current) return;
    importedPeopleRef.current = signature;
    setForm((current) => ({
      ...current,
      attendees: normalizePeople([...current.attendees, ...initialPeople])
    }));
  }, [existing, initialPeople, loading]);

  useEffect(() => {
    const receiveOAuthResult = (event) => {
      if (event.data?.type === 'siac-calendar-oauth') setConnectionRefresh((value) => value + 1);
    };
    window.addEventListener('message', receiveOAuthResult);
    return () => window.removeEventListener('message', receiveOAuthResult);
  }, []);

  useEffect(() => {
    if (!connection.connected || !activeMinuteId || !form.date || !form.start || !form.end || form.end <= form.start) return undefined;
    let active = true;
    const timer = window.setTimeout(async () => {
      setAutoChecking(true);
      try {
        const response = await meetingMinuteService.checkCalendarAvailability(activeMinuteId, {
          summary: form.summary.trim(),
          location: form.location.trim(),
          start_at: calendarDateTime(form.date, form.start),
          end_at: calendarDateTime(form.date, form.end),
          attendees: form.attendees,
          force: false
        });
        if (active) setAvailability(response.data?.availability || []);
      } catch (error) {
        if (active) {
          setAvailability(null);
          if (error?.response?.data?.data?.connection_invalid) {
            setConnection({ connected: false });
            setSlotSuggestions([]);
            setShowCommonSchedule(false);
          }
        }
      } finally {
        if (active) setAutoChecking(false);
      }
    }, 650);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [activeMinuteId, connection.connected, form.date, form.end, form.location, form.start, form.summary, form.attendees]);

  useEffect(() => {
    if (form.date && form.start && form.end) return;
    setAvailability(null);
    setSlotSuggestions([]);
    setShowCommonSchedule(false);
  }, [form.date, form.start, form.end]);

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: '' } : current));
    setAvailability(null);
    setSlotSuggestions([]);
    if (['date', 'start', 'end', 'attendees'].includes(key)) setShowCommonSchedule(false);
  };

  const applyConnectionFailure = (error) => {
    if (!error?.response?.data?.data?.connection_invalid) return false;
    setConnection({ connected: false });
    setAvailability(null);
    setSlotSuggestions([]);
    setShowCommonSchedule(false);
    return true;
  };

  const addPerson = () => {
    const email = String(extra.email || '').trim().toLowerCase();
    if (!validEmail(email)) return enqueueSnackbar('Digite un correo válido para el nuevo invitado.', { variant: 'warning' });
    if (form.attendees.some((person) => person.email === email)) return enqueueSnackbar('Este correo ya está incluido.', { variant: 'info' });
    update('attendees', [...form.attendees, { name: formatPersonName(extra.name), email, source: 'additional' }]);
    setExtra({ name: '', email: '' });
    setShowExternalGuest(false);
  };

  const lookupInternalParticipant = async () => {
    const cleanDocument = document.trim();
    if (!cleanDocument) return enqueueSnackbar('Digite la cédula del invitado.', { variant: 'warning' });
    setLookupWorking(true);
    try {
      const response = await lookupParticipantByDocument(cleanDocument);
      const person = response?.data || response;
      if (!person?.email) return enqueueSnackbar('El usuario encontrado no tiene correo registrado.', { variant: 'warning' });
      const found = {
        document: person.document || cleanDocument,
        name: formatPersonName(person.name || person.nombre || ''),
        email: String(person.email).trim().toLowerCase(),
        source: 'internal'
      };
      if (form.attendees.some((attendee) => attendee.email === found.email)) {
        setDocument('');
        return enqueueSnackbar('Esta persona ya está incluida en la invitación.', { variant: 'info' });
      }
      update('attendees', [...form.attendees, found]);
      setDocument('');
      setShowInternalGuest(false);
      enqueueSnackbar(`${found.name || found.email} fue agregado a la invitación.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se encontró un usuario activo con esa cédula.', { variant: 'error' });
    } finally {
      setLookupWorking(false);
    }
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
    const errors = {};
    if (!form.summary.trim()) errors.summary = 'Digite el título de la siguiente reunión.';
    if (!form.date) errors.date = 'Seleccione la fecha.';
    if (!form.start) errors.start = 'Seleccione la hora de inicio.';
    if (!form.end) errors.end = 'Seleccione la hora de finalización.';
    if (form.start && form.start < '07:00') errors.start = 'La reunión no puede comenzar antes de las 7:00 a. m.';
    if (form.end && form.end > '18:00') errors.end = 'La reunión no puede finalizar después de las 6:00 p. m.';
    if (form.start && form.end && form.end <= form.start) errors.end = 'Debe ser posterior a la hora de inicio.';
    setFieldErrors(errors);
    const firstKey = ['summary', 'date', 'start', 'end'].find((key) => errors[key]);
    if (firstKey) {
      window.setTimeout(() => {
        const element = fieldRefs.current[firstKey];
        element?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        element?.focus?.();
      }, 80);
    }
    return firstKey ? errors[firstKey] : '';
  };

  const check = async () => {
    const issue = validate();
    if (issue) return enqueueSnackbar(issue, { variant: 'warning' });
    setWorking(true);
    try {
      const response = await meetingMinuteService.checkCalendarAvailability(activeMinuteId, payload());
      setAvailability(response.data?.availability || []);
    } catch (error) {
      applyConnectionFailure(error);
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
      const response = await meetingMinuteService.saveCalendarSchedule(activeMinuteId, payload(force));
      const saved = response.data?.schedule;
      setExisting(saved || null);
      setAvailability(response.data?.availability || availability);
      meetingMinuteService.listUpcomingCalendar()
        .then((result) => setUpcoming(Array.isArray(result.data) ? result.data : []))
        .catch(() => {});
      enqueueSnackbar(response.message || 'Reunión programada en Google Calendar.', { variant: 'success' });
    } catch (error) {
      applyConnectionFailure(error);
      const conflictAvailability = error.response?.data?.data?.availability;
      if (Array.isArray(conflictAvailability)) setAvailability(conflictAvailability);
      enqueueSnackbar(error.response?.data?.message || 'No fue posible programar la reunión.', { variant: error.response?.status === 409 ? 'warning' : 'error' });
    } finally {
      setWorking(false);
    }
  };

  const findSuggestions = async () => {
    const issue = validate();
    if (issue) return enqueueSnackbar(issue, { variant: 'warning' });
    setSuggestionsWorking(true);
    try {
      const response = await meetingMinuteService.suggestCalendarSlots(activeMinuteId, { ...payload(), days: 1 });
      const slots = Array.isArray(response.data?.slots) ? response.data.slots : [];
      setSlotSuggestions(slots);
      if (!slots.length) enqueueSnackbar('No se encontraron horarios comunes para la fecha seleccionada.', { variant: 'info' });
    } catch (error) {
      applyConnectionFailure(error);
      enqueueSnackbar(error.response?.data?.message || 'No fue posible buscar horarios disponibles.', { variant: 'error' });
    } finally {
      setSuggestionsWorking(false);
    }
  };

  const applySuggestion = (slot) => {
    const start = bogotaParts(slot.start);
    const end = bogotaParts(slot.end);
    setForm((current) => ({ ...current, date: start.date, start: start.time, end: end.time }));
    setFieldErrors({});
    setAvailability(null);
    setSlotSuggestions([]);
    setShowCommonSchedule(false);
    enqueueSnackbar('Horario sugerido aplicado. Consulte nuevamente la disponibilidad para confirmarlo.', { variant: 'success' });
  };

  const toggleCommonSchedule = (_, expanded) => {
    if (expanded && (!form.date || !form.start || !form.end)) {
      const missingKey = !form.date ? 'date' : !form.start ? 'start' : 'end';
      const message = missingKey === 'date'
        ? 'Seleccione primero la fecha que desea consultar.'
        : 'Seleccione la hora de inicio y finalización para calcular la duración.';
      setFieldErrors((current) => ({ ...current, [missingKey]: message }));
      enqueueSnackbar(message, { variant: 'warning' });
      window.setTimeout(() => {
        fieldRefs.current[missingKey]?.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        fieldRefs.current[missingKey]?.focus?.();
      }, 80);
      return;
    }
    setShowCommonSchedule(expanded);
    if (expanded && !slotSuggestions.length && !suggestionsWorking) findSuggestions();
  };

  const connectCalendar = async () => {
    const popup = window.open('', 'siac-google-calendar', 'width=560,height=720,resizable=yes,scrollbars=yes');
    if (!popup) return enqueueSnackbar('Permita las ventanas emergentes para conectar Google Calendar.', { variant: 'warning' });
    popup.document.write('<p style="font-family:Arial;padding:24px">Abriendo autorización segura de Google…</p>');
    try {
      const response = await meetingMinuteService.startCalendarConnection(activeMinuteId);
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
      const response = await meetingMinuteService.disconnectCalendar(activeMinuteId);
      setConnection({ connected: false });
      setAvailability(null);
      enqueueSnackbar(response.message || 'Google Calendar fue desconectado.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible desconectar Google Calendar.', { variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const cancelScheduledMeeting = async (item) => {
    if (!window.confirm(`¿Cancelar "${item.summary}"? Google notificará a todos los invitados y liberará el horario.`)) return;
    setWorking(true);
    try {
      const response = await meetingMinuteService.cancelCalendarSchedule(item.minute_id);
      setUpcoming((current) => current.filter((entry) => entry.id !== item.id));
      if (String(item.minute_id) === String(activeMinuteId)) {
        setExisting(null);
        setAvailability(null);
        if (String(activeMinuteId) !== String(minuteId)) setActiveMinuteId(minuteId);
      }
      enqueueSnackbar(response.message || 'Reunión cancelada en Google Calendar.', { variant: 'success' });
    } catch (error) {
      applyConnectionFailure(error);
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cancelar la reunión.', { variant: 'error' });
    } finally {
      setWorking(false);
    }
  };

  const busy = availability?.filter((person) => person.status === 'busy') || [];
  const unknown = availability?.filter((person) => person.status === 'unknown') || [];
  const visibleSlotSuggestions = form.date
    ? slotSuggestions.filter((slot) => bogotaParts(slot.start).date === form.date)
    : [];

  const dialogShell = (content) => (
    <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3.5, overflow: 'hidden' } }}>
      <DialogTitle sx={{ px: 2.5, py: 1.8, bgcolor: '#1746b3', color: '#fff' }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={1}>
          <Stack direction="row" alignItems="center" gap={1}>
            <CalendarMonth />
            <Typography fontWeight={950}>Programar siguiente sesión</Typography>
          </Stack>
          <IconButton aria-label="Cerrar" onClick={() => setDialogOpen(false)} sx={{ color: '#fff' }}><Close /></IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 1.5, sm: 2.5 }, bgcolor: '#f5f8fd' }}>{content}</DialogContent>
    </Dialog>
  );

  if (dialogMode && !dialogOpen) return (
    <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderColor: '#93c5fd', bgcolor: '#f8fbff' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1.5}>
        <Stack direction="row" alignItems="center" gap={1.25}>
          <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#dbeafe', color: '#1d4ed8' }}><CalendarMonth /></Box>
          <Box><Typography fontWeight={900}>Programar siguiente sesión</Typography><Typography variant="body2" color="text.secondary">Opcional · Revise disponibilidad y envíe la invitación desde Calendar.</Typography></Box>
        </Stack>
        <Button variant="contained" startIcon={<CalendarMonth />} onClick={() => { setActiveMinuteId(minuteId); setDialogOpen(true); }} sx={{ borderRadius: 2.5, px: 2.5, textTransform: 'none', fontWeight: 900 }}>
          {existing ? 'Ver programación' : 'Abrir Calendar'}
        </Button>
      </Stack>
    </Paper>
  );

  if (loading) {
    const loadingPanel = <Paper variant="outlined" sx={{ p: 3, borderRadius: 3 }}><Stack direction="row" gap={1} alignItems="center"><CircularProgress size={18} /><Typography>Cargando programación…</Typography></Stack></Paper>;
    return dialogMode ? dialogShell(loadingPanel) : loadingPanel;
  }
  if (loadError) {
    const errorPanel = <Alert severity="warning"><strong>No puede programar esta sesión.</strong><br />{loadError}<br />Ingrese con la cuenta institucional del líder autorizado del acta.</Alert>;
    return dialogMode ? dialogShell(errorPanel) : errorPanel;
  }

  const scheduler = (
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
          <strong>Paso 1 de 2 · Conectar Calendar.</strong><br />
          Autorice una sola vez la cuenta <strong>{organizer?.email}</strong>. La conexión quedará guardada para las siguientes reuniones.
        </Alert>
      )}
      {connection.connected && (
        <>
      <Box sx={{ mb: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={<CalendarMonth />}
          onClick={() => setShowUpcoming((value) => !value)}
          sx={{ textTransform: 'none', fontWeight: 850 }}
        >
          {showUpcoming ? 'Ocultar próximas reuniones' : `Mis próximas reuniones (${upcoming.length})`}
        </Button>
        {showUpcoming && (
          <Paper variant="outlined" sx={{ mt: 1, p: 1.25, borderRadius: 2.5, bgcolor: '#fff' }}>
            {!upcoming.length ? (
              <Typography variant="body2" color="text.secondary">No tiene reuniones futuras programadas desde SIAC.</Typography>
            ) : (
              <Stack gap={0.9}>
                {upcoming.map((item) => (
                  <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr auto' }, gap: 1, alignItems: 'center', p: 1, border: '1px solid #dbeafe', borderRadius: 2 }}>
                    <Box>
                      <Typography variant="body2" fontWeight={850}>{item.summary}</Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {formatScheduleDate(item.start_at)}{item.location ? ` · ${item.location}` : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">Acta {item.minute?.code || ''}</Typography>
                    </Box>
                    <Stack direction="row" gap={0.5} flexWrap="wrap">
                      {item.google_event_url && (
                        <Button component={Link} href={item.google_event_url} target="_blank" rel="noopener noreferrer" size="small" startIcon={<OpenInNew />} sx={{ textTransform: 'none', fontWeight: 800 }}>
                          Abrir o editar
                        </Button>
                      )}
                      <Button
                        size="small"
                        variant={String(item.minute_id) === String(activeMinuteId) ? 'contained' : 'outlined'}
                        disabled={String(item.minute_id) === String(activeMinuteId)}
                        onClick={() => { setActiveMinuteId(item.minute_id); setShowUpcoming(false); setAvailability(null); }}
                        sx={{ textTransform: 'none', fontWeight: 800 }}
                      >
                        {String(item.minute_id) === String(activeMinuteId) ? 'Editando' : 'Editar aquí'}
                      </Button>
                      <Button color="error" size="small" disabled={working} onClick={() => cancelScheduledMeeting(item)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                        Cancelar
                      </Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )}
          </Paper>
        )}
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={0.5} mb={1.25}>
        <Typography fontWeight={900} color="primary.main">Datos de la siguiente sesión</Typography>
        <Button size="small" color="inherit" onClick={disconnectCalendar} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, textTransform: 'none' }}>
          Desconectar Calendar
        </Button>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.2 }}>
        <TextField
          label="Título de la reunión"
          value={form.summary}
          onChange={(event) => update('summary', event.target.value.slice(0, 240))}
          inputRef={(element) => { fieldRefs.current.summary = element; }}
          error={Boolean(fieldErrors.summary)}
          helperText={fieldErrors.summary || 'Propuesto automáticamente desde el título del acta; puede modificarlo.'}
          sx={{ gridColumn: { sm: '1 / -1' } }}
        />
        <TextField
          type="date"
          label="Fecha"
          InputLabelProps={{ shrink: true }}
          value={form.date}
          onChange={(event) => update('date', event.target.value)}
          inputRef={(element) => { fieldRefs.current.date = element; }}
          error={Boolean(fieldErrors.date)}
          helperText={fieldErrors.date || ''}
        />
        <TextField label="Lugar o enlace" value={form.location} onChange={(event) => update('location', event.target.value)} />
        <TextField
          type="time"
          label="Hora de inicio"
          InputLabelProps={{ shrink: true }}
          value={form.start}
          onChange={(event) => update('start', event.target.value)}
          inputProps={{ min: '07:00', max: '18:00' }}
          inputRef={(element) => { fieldRefs.current.start = element; }}
          error={Boolean(fieldErrors.start)}
          helperText={fieldErrors.start || ''}
        />
        <TextField
          type="time"
          label="Hora de finalización"
          InputLabelProps={{ shrink: true }}
          value={form.end}
          onChange={(event) => update('end', event.target.value)}
          inputProps={{ min: '07:00', max: '18:00' }}
          inputRef={(element) => { fieldRefs.current.end = element; }}
          error={Boolean(fieldErrors.end)}
          helperText={fieldErrors.end || ''}
        />
      </Box>

      {autoChecking && <Alert severity="info" sx={{ mt: 1.25 }}>Consultando automáticamente la disponibilidad de los participantes…</Alert>}
      {!autoChecking && availability && !busy.length && !unknown.length && (
        <Alert severity="success" sx={{ mt: 1.25 }}><strong>Todos pueden asistir.</strong> No tienen otra reunión programada en este horario.</Alert>
      )}
      {!autoChecking && busy.length > 0 && (
        <Alert
          severity="warning"
          sx={{ mt: 1.25 }}
        >
          <strong>No todos pueden asistir:</strong> {busy.map((person) => person.name || person.email).join(', ')} {busy.length === 1 ? 'tiene' : 'tienen'} otra reunión programada.
        </Alert>
      )}
      {!autoChecking && !busy.length && unknown.length > 0 && (
        <Alert severity="info" sx={{ mt: 1.25 }}><strong>Horario disponible para los calendarios consultados.</strong> No fue posible verificar: {unknown.map((person) => person.name || person.email).join(', ')}.</Alert>
      )}

      <Accordion
        disableGutters
        expanded={showCommonSchedule}
        onChange={toggleCommonSchedule}
        sx={{ mt: 1.25, border: '1px solid #bfdbfe', borderRadius: '12px !important', boxShadow: 'none', '&:before': { display: 'none' }, overflow: 'hidden' }}
      >
        <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 50, bgcolor: '#f8fbff', '& .MuiAccordionSummary-content': { my: 1 } }}>
          <Stack direction="row" alignItems="center" gap={1}>
            <EventAvailable color="primary" />
            <Box>
              <Typography fontWeight={900}>Consultar franjas de disponibilidad</Typography>
              <Typography variant="caption" color="text.secondary">Horarios disponibles para todos en la fecha seleccionada</Typography>
            </Box>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0, bgcolor: '#fff' }}>
          {suggestionsWorking ? (
            <Stack direction="row" alignItems="center" gap={1} py={1}><CircularProgress size={18} /><Typography variant="body2">Buscando horarios disponibles…</Typography></Stack>
          ) : visibleSlotSuggestions.length ? (
            <>
              <Typography variant="caption" color="text.secondary" display="block" mb={1}>Seleccione una franja para aplicarla a la reunión.</Typography>
              <Stack direction="row" gap={0.75} flexWrap="wrap">
                {visibleSlotSuggestions.map((slot) => (
                  <Button key={slot.start} size="small" variant="outlined" onClick={() => applySuggestion(slot)} sx={{ textTransform: 'none', fontWeight: 800 }}>
                    {formatScheduleSlot(slot)}
                  </Button>
                ))}
              </Stack>
            </>
          ) : (
            <Typography variant="body2" color="text.secondary">No se encontraron horarios comunes para la fecha seleccionada.</Typography>
          )}
        </AccordionDetails>
      </Accordion>

      <Typography fontWeight={850} mt={2} mb={0.75}>Invitados de Calendar</Typography>
      <Typography variant="body2" color="text.secondary" mb={1}>
        Se precargan las personas del acta. Revise la lista: puede retirar invitados de Calendar sin modificar los participantes ni el PDF del acta.
      </Typography>
      <Stack gap={0.75}>
        {!form.attendees.length && <Alert severity="info">Todavía no hay invitados. Consulte una cédula o agregue un participante externo.</Alert>}
        {form.attendees.map((person) => {
          const result = availability?.find((item) => item.email === person.email);
          const isOrganizer = person.email === organizer?.email;
          const color = result?.status === 'available' ? 'success' : result?.status === 'busy' ? 'error' : result?.status === 'unknown' ? 'default' : 'primary';
          const label = result?.status === 'available' ? 'Disponible' : result?.status === 'busy' ? 'Ocupado' : result?.status === 'unknown' ? 'No verificable' : 'Sin consultar';
          const sourceLabel = ['responsible', 'participant', 'minute'].includes(person.source) ? 'Del acta' : person.source === 'internal' ? 'Interno' : 'Externo';
          return <Box key={person.email} sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', gap: 0.75, p: 0.9, bgcolor: '#fff', border: '1px solid #dbeafe', borderRadius: 2 }}><Box><Stack direction="row" alignItems="center" gap={0.6} flexWrap="wrap"><Typography variant="body2" fontWeight={800}>{person.name || person.email}</Typography>{isOrganizer && <Chip size="small" label="Organizador" color="primary" variant="outlined" sx={{ height: 19, fontSize: 10 }} />}<Chip size="small" label={sourceLabel} variant="outlined" sx={{ height: 19, fontSize: 10 }} /></Stack><Typography variant="caption" color="text.secondary">{person.document ? `CC ${person.document} · ` : ''}{person.email}</Typography></Box><Chip size="small" color={color} variant={result?.status === 'unknown' ? 'outlined' : 'filled'} label={label} /><Tooltip title={isOrganizer ? 'El Responsable Principal siempre organiza la reunión' : 'Quitar de esta invitación'}><span><IconButton disabled={isOrganizer} size="small" color="error" onClick={() => update('attendees', form.attendees.filter((item) => item.email !== person.email))}><DeleteOutline fontSize="small" /></IconButton></span></Tooltip></Box>;
        })}
      </Stack>

      <Stack gap={1} mt={1.5}>
        {lookupParticipantByDocument && (
          <Accordion
            disableGutters
            expanded={showInternalGuest}
            onChange={(_, expanded) => setShowInternalGuest(expanded)}
            sx={{ border: '1px solid #dbeafe', borderRadius: '12px !important', boxShadow: 'none', '&:before': { display: 'none' }, overflow: 'hidden' }}
          >
            <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 50, bgcolor: '#fff', '& .MuiAccordionSummary-content': { my: 1 } }}>
              <Stack direction="row" alignItems="center" gap={1}><PersonSearch color="primary" /><Typography fontWeight={850}>Agregar personal interno</Typography></Stack>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 0, bgcolor: '#fff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                <TextField
                  fullWidth
                  size="small"
                  label="Cédula"
                  value={document}
                  onChange={(event) => setDocument(event.target.value.replace(/\D/g, ''))}
                  onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); lookupInternalParticipant(); } }}
                />
                <Button variant="outlined" startIcon={lookupWorking ? <CircularProgress size={16} /> : <PersonSearch />} disabled={lookupWorking} onClick={lookupInternalParticipant} sx={{ minWidth: 130, textTransform: 'none', fontWeight: 800 }}>
                  Consultar
                </Button>
              </Stack>
            </AccordionDetails>
          </Accordion>
        )}

        <Accordion
          disableGutters
          expanded={showExternalGuest}
          onChange={(_, expanded) => setShowExternalGuest(expanded)}
          sx={{ border: '1px solid #dbeafe', borderRadius: '12px !important', boxShadow: 'none', '&:before': { display: 'none' }, overflow: 'hidden' }}
        >
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ minHeight: 50, bgcolor: '#fff', '& .MuiAccordionSummary-content': { my: 1 } }}>
            <Stack direction="row" alignItems="center" gap={1}><Add color="primary" /><Typography fontWeight={850}>Agregar invitado externo</Typography></Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0, bgcolor: '#fff' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1.3fr auto' }, gap: 1 }}>
              <TextField size="small" label="Nombre del nuevo invitado" value={extra.name} onChange={(event) => setExtra((current) => ({ ...current, name: event.target.value }))} />
              <TextField size="small" type="email" label="Correo institucional o externo" value={extra.email} onChange={(event) => setExtra((current) => ({ ...current, email: event.target.value }))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addPerson(); } }} />
              <Button variant="outlined" startIcon={<Add />} onClick={addPerson} sx={{ textTransform: 'none', fontWeight: 800 }}>Agregar</Button>
            </Box>
          </AccordionDetails>
        </Accordion>

      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" gap={1} mt={2}>
        <Button variant="outlined" startIcon={(working || autoChecking) ? <CircularProgress size={16} /> : <Refresh />} disabled={working || autoChecking || !configuration?.configured || !connection.connected} onClick={check} sx={{ textTransform: 'none', fontWeight: 850 }}>Volver a consultar disponibilidad</Button>
        {busy.length > 0 ? (
          <Button color="warning" variant="contained" disabled={working || !configuration?.configured || !connection.connected} onClick={() => schedule(true)} sx={{ textTransform: 'none', fontWeight: 900 }}>{existing ? 'Actualizar de todas formas' : 'Programar de todas formas'}</Button>
        ) : (
          <Button variant="contained" startIcon={<EventAvailable />} disabled={working || !configuration?.configured || !connection.connected || !availability} onClick={() => schedule(false)} sx={{ textTransform: 'none', fontWeight: 900 }}>{existing ? 'Actualizar en Calendar' : 'Programar en Calendar'}</Button>
        )}
      </Stack>
        </>
      )}
    </Paper>
  );
  return dialogMode ? dialogShell(scheduler) : scheduler;
}
