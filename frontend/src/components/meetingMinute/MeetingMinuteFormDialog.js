import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, MenuItem, Paper, Stack, TextField, Typography
} from '@mui/material';
import {
  Add, Close, ContentCopy, DeleteOutline, Download, Edit, Email, PersonSearch,
  QrCode2, Refresh, Save, Send
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';
import logoFormatos from '../../assets/logo_formatos.jpg';
import RichTextEditor, { sanitizeRichHtml } from './RichTextEditor';

const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};
const MEETING_PLACES = [
  'Sala de Rectoría',
  'Salón H201F',
  'Sala Bellina',
  'Sala de Juntas San Damián',
  'Sala de Juntas Campus San Damián'
];
const emptyForm = (user = {}) => ({
  id: '', status: 'draft', created_by: user.id || '', responsables: '', dependencia: '',
  responsable_document: '', responsable_role: '',
  lugar: '', fecha: today(), hora_inicio: '08:00', hora_fin: '10:00',
  objetivo: '', desarrollo: '', conclusiones: '', participants: []
});

const MeetingPreview = ({ document, form, signatures = [] }) => {
  const signed = new Set(signatures.map((signature) => String(signature.participant_id)));
  const signatureByParticipant = new Map(signatures.map((signature) => [String(signature.participant_id), signature]));
  const cell = { px: 0.8, py: 0.65, borderBottom: '1px solid #111', fontSize: 11.5 };
  return (
    <Box sx={{ border: '1px solid #111', bgcolor: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', minWidth: 650 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: '22% 56% 22%', minHeight: 82, borderBottom: '1px solid #111' }}>
        <Box sx={{ borderRight: '1px solid #111', p: 0.75, display: 'grid', placeItems: 'center' }}><Box component="img" src={logoFormatos} alt="Universidad CESMAG" sx={{ maxWidth: '95%', maxHeight: 65 }} /></Box>
        <Box sx={{ borderRight: '1px solid #111', display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900 }}>REGISTRO DE ASISTENCIA Y REUNIÓN</Box>
        <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontWeight: 800, fontSize: 10 }}>
          <span>CÓDIGO: {document?.codigo || 'COM-ID-FR-002'}</span><span>VERSIÓN: {document?.version || '1'}</span><span>FECHA: {formatDate(form.fecha)}</span>
        </Box>
      </Box>
      <Box sx={cell}><strong>Responsable(s):</strong> {form.responsables}</Box>
      <Box sx={cell}><strong>Dependencia que cita:</strong> {form.dependencia}</Box>
      <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Información de la Reunión</Box>
      <Box sx={cell}><strong>Lugar:</strong> {form.lugar}</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.8, borderRight: '1px solid #111' }}><strong>Fecha:</strong> {formatDate(form.fecha)}</Box><Box sx={{ p: 0.8 }}><strong>Horario:</strong> {form.hora_inicio} - {form.hora_fin}</Box></Box>
      <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Participantes</Box>
      <Box sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', bgcolor: '#f2f2f2', borderBottom: '1px solid #111', fontWeight: 900, textAlign: 'center' }}><Box /><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Nombres y Apellidos</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Cargo</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Firma</Box></Box>
      {form.participants.map((participant, index) => {
        const signature = signatureByParticipant.get(String(participant.id));
        const isSigned = signed.has(String(participant.id)) || participant.status === 'signed';
        const roleLabel = !participant.user_id && participant.organization ? [participant.organization, participant.role_title].filter(Boolean).join(' · ') : (participant.role_title || participant.organization || '');
        return <Box key={participant.id || participant.user_id || index} sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.6, textAlign: 'center', fontWeight: 800 }}>{index + 1}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{participant.name}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{roleLabel}</Box><Box sx={{ minHeight: 42, p: 0.45, borderLeft: '1px solid #111', display: 'grid', placeItems: 'center', textAlign: 'center', color: isSigned ? '#15803d' : '#64748b', fontWeight: 800 }}>{signature?.signature_preview ? <Box component="img" src={signature.signature_preview} alt={`Firma de ${participant.name}`} sx={{ width: '100%', height: 38, objectFit: 'contain' }} /> : isSigned ? '✓ Firmado' : 'Pendiente · QR'}</Box></Box>;
      })}
      {['Objetivo', 'Desarrollo', 'Conclusiones / Compromisos'].map((title) => {
        const key = title === 'Objetivo' ? 'objetivo' : title === 'Desarrollo' ? 'desarrollo' : 'conclusiones';
        return <React.Fragment key={title}><Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>{title}</Box><Box sx={{ p: 1, minHeight: key === 'objetivo' ? 62 : 90, fontSize: 11.5, '& p': { my: 0.3 }, '& h2, & h3': { my: 0.4 }, '& a': { color: '#1d5fd1', textDecoration: 'underline' }, '& blockquote': { my: 0.5, mx: 0, pl: 1, borderLeft: '3px solid #94a3b8' }, '& hr': { border: 0, borderTop: '1px solid #777' }, '& ul, & ol': { my: 0.4, pl: 2.5 }, '& table': { width: '100%', borderCollapse: 'collapse', my: 0.5 }, '& th, & td': { border: '1px solid #555', p: 0.45 }, '& th': { bgcolor: '#f2f2f2' } }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(form[key]) }} /></React.Fragment>;
      })}
    </Box>
  );
};

export default function MeetingMinuteFormDialog({ open, document, user, onClose }) {
  const { enqueueSnackbar } = useSnackbar();
  const [form, setForm] = useState(() => emptyForm(user));
  const [minutes, setMinutes] = useState([]);
  const [signatures, setSignatures] = useState([]);
  const [documentNumber, setDocumentNumber] = useState('');
  const [candidate, setCandidate] = useState(null);
  const [responsibleDocument, setResponsibleDocument] = useState('');
  const [responsibleCandidate, setResponsibleCandidate] = useState(null);
  const [searchingResponsible, setSearchingResponsible] = useState(false);
  const [externalMode, setExternalMode] = useState(false);
  const [externalDraft, setExternalDraft] = useState({ document: '', name: '', email: '', organization: '', role_title: '' });
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [qr, setQr] = useState(null);
  const [confirmAdjust, setConfirmAdjust] = useState(false);
  const locked = form.status !== 'draft';
  const hasSignatures = signatures.length > 0;
  const allSigned = Boolean(form.participants.length) && form.participants.every((participant) => participant.status === 'signed');
  const canSendFinal = allSigned && Number(form.created_by) === Number(user?.id);
  const horario = useMemo(() => `${form.hora_inicio || ''} - ${form.hora_fin || ''}`, [form.hora_inicio, form.hora_fin]);

  const loadMinutes = async () => {
    try { const response = await meetingMinuteService.list(); setMinutes(response.data || []); } catch (_) { setMinutes([]); }
  };
  useEffect(() => {
    if (!open) return;
    setForm(emptyForm(user)); setSignatures([]); setQr(null); setCandidate(null); setDocumentNumber('');
    setResponsibleDocument(''); setResponsibleCandidate(null); setExternalMode(false); loadMinutes();
  }, [open, user]);

  const setField = (key, value) => setForm((previous) => ({ ...previous, [key]: value }));
  const openMinute = async (id) => {
    if (!id) return setForm(emptyForm(user));
    setLoading(true);
    try {
      const response = await meetingMinuteService.get(id);
      const row = response.data;
      const content = row.content || {};
      const [start = '', end = ''] = String(content.horario || '').split('-').map((part) => part.trim());
      setForm({ id: row.id, status: row.status, created_by: row.created_by, responsables: content.responsables || '', responsable_document: content.responsable_document || '', responsable_role: content.responsable_role || '', dependencia: content.dependencia || '', lugar: content.lugar || '', fecha: content.fecha || today(), hora_inicio: start || '08:00', hora_fin: end || '10:00', objetivo: content.objetivo?.[0] || '', desarrollo: content.desarrollo?.[0] || '', conclusiones: content.conclusiones?.[0] || '', participants: row.participants || [] });
      setResponsibleDocument(content.responsable_document || ''); setResponsibleCandidate(null);
      setSignatures(row.signatures || []); setQr(null);
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible abrir el acta.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const lookup = async () => {
    if (!documentNumber.trim()) return;
    setSearching(true); setCandidate(null);
    try { const response = await meetingMinuteService.lookupParticipant(documentNumber.trim()); setCandidate(response.data); }
    catch (error) {
      if (error.response?.status === 404) {
        setExternalDraft({ document: documentNumber.trim(), name: '', email: '', organization: '', role_title: '' });
        setExternalMode(true);
        enqueueSnackbar('La persona no está registrada. Puede agregarla únicamente a esta acta.', { variant: 'info' });
      } else enqueueSnackbar(error.response?.data?.message || 'No se encontró la cédula.', { variant: 'error' });
    }
    finally { setSearching(false); }
  };
  const addParticipant = () => {
    if (!candidate) return;
    if (!candidate.email) return enqueueSnackbar('El usuario no tiene correo institucional para la firma.', { variant: 'warning' });
    if (form.participants.some((participant) => String(participant.user_id) === String(candidate.id))) return enqueueSnackbar('La persona ya está agregada.', { variant: 'info' });
    setField('participants', [...form.participants, { user_id: candidate.id, document: candidate.document, name: candidate.name, email: candidate.email, organization: candidate.organization, role_title: candidate.role_title, status: 'invited' }]);
    setCandidate(null); setDocumentNumber('');
  };
  const lookupResponsible = async () => {
    if (!responsibleDocument.trim()) return;
    setSearchingResponsible(true); setResponsibleCandidate(null);
    try { const response = await meetingMinuteService.lookupParticipant(responsibleDocument.trim()); setResponsibleCandidate(response.data); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No se encontró el responsable.', { variant: 'error' }); }
    finally { setSearchingResponsible(false); }
  };
  const applyResponsible = () => {
    if (!responsibleCandidate) return;
    setForm((previous) => {
      const oldResponsibleDocument = String(previous.responsable_document || '').toLowerCase();
      const candidateDocument = String(responsibleCandidate.document || '').toLowerCase();
      const candidateEmail = String(responsibleCandidate.email || '').toLowerCase();
      const remainingParticipants = previous.participants.filter((participant) => {
        const participantDocument = String(participant.document || '').toLowerCase();
        const participantEmail = String(participant.email || '').toLowerCase();
        return participantDocument !== oldResponsibleDocument
          && participantDocument !== candidateDocument
          && participantEmail !== candidateEmail;
      });
      const responsibleParticipant = { user_id: responsibleCandidate.id, document: responsibleCandidate.document, name: responsibleCandidate.name, email: responsibleCandidate.email, organization: responsibleCandidate.organization, role_title: responsibleCandidate.role_title, status: 'invited' };
      return { ...previous, responsables: responsibleCandidate.name, responsable_document: responsibleCandidate.document, responsable_role: responsibleCandidate.role_title || '', dependencia: responsibleCandidate.organization || '', participants: [responsibleParticipant, ...remainingParticipants] };
    });
    setResponsibleDocument(responsibleCandidate.document || responsibleDocument); setResponsibleCandidate(null);
    enqueueSnackbar('Responsable agregado como primer participante.', { variant: 'success' });
  };
  const addExternalParticipant = () => {
    const external = Object.fromEntries(Object.entries(externalDraft).map(([key, value]) => [key, String(value || '').trim()]));
    if (!external.document || !external.name || !external.email || !external.role_title) return enqueueSnackbar('Complete cédula, nombre, correo y cargo.', { variant: 'warning' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(external.email)) return enqueueSnackbar('Digite un correo válido.', { variant: 'warning' });
    if (form.participants.some((participant) => String(participant.document || '').toLowerCase() === external.document.toLowerCase() || String(participant.email || '').toLowerCase() === external.email.toLowerCase())) return enqueueSnackbar('La persona ya está agregada.', { variant: 'info' });
    setField('participants', [...form.participants, { ...external, user_id: null, status: 'invited', external: true }]);
    setExternalMode(false); setExternalDraft({ document: '', name: '', email: '', organization: '', role_title: '' }); setDocumentNumber('');
  };
  const payload = () => ({ id: form.id || undefined, documento_id: document.id, responsables: form.responsables, responsable_document: form.responsable_document, responsable_role: form.responsable_role, dependencia: form.dependencia, lugar: form.lugar, fecha: form.fecha, horario, objetivo: form.objetivo, desarrollo: form.desarrollo, conclusiones: form.conclusiones, participants: form.participants });
  const save = async ({ quiet = false } = {}) => {
    setLoading(true);
    try {
      const response = await meetingMinuteService.save(payload());
      const row = response.data;
      setForm((previous) => ({ ...previous, id: row.id, status: row.status, created_by: row.created_by || previous.created_by, participants: row.participants || previous.participants }));
      await loadMinutes();
      if (!quiet) enqueueSnackbar('Borrador del acta guardado.', { variant: 'success' });
      return row;
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el acta.', { variant: 'error' }); return null; }
    finally { setLoading(false); }
  };
  const publish = async () => {
      // Guarde siempre la versión visible antes de abrir la etapa de firmas.
      // Así, los cambios hechos después del último borrador también llegan al
      // enlace público y al documento institucional.
      const row = await save({ quiet: true });
    if (!row) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.publish(row.id, { public_base_url: window.location.origin });
      setQr(response.data); setForm((previous) => ({ ...previous, id: row.id, status: 'signing' })); await loadMinutes();
      enqueueSnackbar(response.message || 'Firmas habilitadas e invitaciones enviadas.', { variant: response.data?.invitations?.failed ? 'warning' : 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar las firmas.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const resendInvitations = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.resendInvitations(form.id, { public_base_url: window.location.origin });
      enqueueSnackbar(response.message || 'Invitaciones reenviadas.', { variant: response.data?.failed ? 'warning' : 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible reenviar las invitaciones.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const showSigningAccess = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.getSigningAccess(form.id, { public_base_url: window.location.origin });
      setQr(response.data);
      enqueueSnackbar(response.message || 'Acceso QR actualizado.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible recuperar el acceso de firma.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const reopenForEditing = async () => {
    if (!form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.reopen(form.id);
      setConfirmAdjust(false); setQr(null); setSignatures([]);
      await openMinute(form.id); await loadMinutes();
      enqueueSnackbar(response.message || 'El acta regresó a borrador.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar los ajustes.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  const download = async () => {
    if (!form.id) return enqueueSnackbar('Guarde primero el borrador.', { variant: 'warning' });
    try {
      const blob = await meetingMinuteService.downloadPdf(form.id); const url = URL.createObjectURL(blob); const anchor = window.document.createElement('a'); anchor.href = url; anchor.download = `ACTA-${form.fecha || 'REUNION'}.pdf`; anchor.click(); URL.revokeObjectURL(url);
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible descargar el acta.', { variant: 'error' }); }
  };
  const sendFinal = async () => {
    if (!canSendFinal || !form.id) return;
    setLoading(true);
    try {
      const response = await meetingMinuteService.sendFinal(form.id);
      enqueueSnackbar(response.message || 'Acta firmada enviada a todos los participantes.', { variant: 'success' });
      await openMinute(form.id); await loadMinutes();
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible enviar el acta firmada.', { variant: 'error' }); }
    finally { setLoading(false); }
  };

  return <>
    <Dialog open={open} onClose={onClose} fullScreen PaperProps={{ sx: { bgcolor: '#f4f7fb', height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}>
      <DialogTitle sx={{ px: { xs: 2, md: 4 }, py: 1.75, background: 'linear-gradient(135deg,#214c9c,#315ee8)', color: '#fff', flexShrink: 0 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2}><Box><Typography variant="h5" fontWeight={950}>Registro de Asistencia y Reunión</Typography><Typography sx={{ opacity: .9, fontSize: 13 }}>{document?.codigo} · Formato digital institucional independiente</Typography></Box><IconButton onClick={onClose} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.5)', borderRadius: 2 }}><Close /></IconButton></Stack>
      </DialogTitle>
      <DialogContent sx={{ p: { xs: 1.5, md: 2.5 }, flex: 1, overflow: { xs: 'auto', lg: 'hidden' }, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 2.5, width: '100%', height: { lg: '100%' }, minHeight: 0, flex: 1 }}>
          <Stack
            gap={2}
            sx={{
              width: { xs: '100%', lg: '47%' },
              height: { lg: '100%' },
              overflowY: { lg: 'auto' },
              pr: { lg: 1.5 },
              // Barra de scroll ubicada al medio, ampliada y de fácil agarre
              '&::-webkit-scrollbar': {
                width: '14px'
              },
              '&::-webkit-scrollbar-track': {
                bgcolor: '#e2e8f0',
                borderRadius: '8px',
                border: '1px solid #cbd5e1'
              },
              '&::-webkit-scrollbar-thumb': {
                bgcolor: '#475569',
                borderRadius: '8px',
                border: '2.5px solid #e2e8f0',
                '&:hover': {
                  bgcolor: '#1e293b'
                }
              },
              scrollbarWidth: 'auto',
              scrollbarColor: '#475569 #e2e8f0'
            }}
          >
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1.5} mb={2}><Box><Typography fontWeight={900}>Actas de reunión</Typography><Typography variant="body2" color="text.secondary">Cree una nueva o continúe un borrador anterior. Este flujo no modifica los Planes de Acción.</Typography></Box><Button variant="outlined" onClick={() => { setForm(emptyForm(user)); setSignatures([]); setQr(null); setResponsibleDocument(''); setResponsibleCandidate(null); setExternalMode(false); }} sx={{ textTransform: 'none', fontWeight: 800 }}>Nueva acta</Button></Stack>
              <TextField fullWidth select size="small" label="Abrir un acta guardada" value={form.id} onChange={(event) => openMinute(event.target.value)}><MenuItem value="">Nueva acta</MenuItem>{minutes.map((minute) => <MenuItem key={minute.id} value={minute.id}>{minute.code} · {minute.content?.fecha || 'Sin fecha'} · {{ draft: 'Borrador', signing: 'En firmas', signed: 'Firmada', distributed: 'Enviada' }[minute.status] || minute.status}</MenuItem>)}</TextField>
            </Paper>
            {form.status === 'signing' && !allSigned && <Alert severity="info">Las invitaciones personales ya fueron enviadas por correo. Puede volver a mostrar el QR, reenviar invitaciones o regresar a borrador mientras nadie haya firmado.</Alert>}
            {form.status === 'signing' && hasSignatures && !allSigned && <Alert severity="warning">El acta ya tiene {signatures.length} firma(s). Su contenido queda protegido y ya no puede regresar a borrador.</Alert>}
            {allSigned && <Alert severity="success">Todas las personas firmaron el acta. Ya puede enviar la versión final a sus correos.</Alert>}
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
              <Typography fontWeight={900} mb={2}>1. Información de la reunión</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.5 }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ gridColumn: '1 / -1' }}>
                  <TextField disabled={locked} fullWidth label="Cédula del responsable" value={responsibleDocument} onChange={(e) => { setResponsibleDocument(e.target.value.replace(/[^0-9A-Za-z-]/g, '')); setResponsibleCandidate(null); setForm((previous) => ({ ...previous, responsables: '', responsable_document: '', responsable_role: '', dependencia: '' })); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupResponsible(); } }} />
                  <Button disabled={locked || searchingResponsible || !responsibleDocument} variant="outlined" startIcon={searchingResponsible ? <CircularProgress size={16} /> : <PersonSearch />} onClick={lookupResponsible} sx={{ minWidth: 135, textTransform: 'none', fontWeight: 800 }}>Consultar</Button>
                </Stack>
                {responsibleCandidate && <Paper variant="outlined" sx={{ gridColumn: '1 / -1', p: 1.5, borderRadius: 2, bgcolor: '#f8fbff' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1}><Box><Typography fontWeight={850}>{responsibleCandidate.name}</Typography><Typography variant="body2" color="text.secondary">{responsibleCandidate.role_title} · {responsibleCandidate.organization}</Typography></Box><Button variant="contained" onClick={applyResponsible}>Usar como responsable</Button></Stack></Paper>}
                <TextField disabled={locked} fullWidth label="Responsable" value={form.responsables} InputProps={{ readOnly: true }} helperText={form.responsable_role || 'Se completa al consultar la cédula.'} />
                <TextField disabled={locked} fullWidth label="Dependencia que cita" value={form.dependencia} onChange={(e) => setField('dependencia', e.target.value)} />
                <Autocomplete freeSolo disabled={locked} options={MEETING_PLACES} value={form.lugar || ''} onChange={(_, value) => setField('lugar', value || '')} onInputChange={(_, value) => setField('lugar', value)} renderInput={(params) => <TextField {...params} fullWidth label="Lugar" helperText="Seleccione una opción o escriba otro lugar." />} />
                <TextField disabled={locked} fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha" value={form.fecha} onChange={(e) => setField('fecha', e.target.value)} />
                <TextField disabled={locked} fullWidth type="time" InputLabelProps={{ shrink: true }} label="Hora de inicio" value={form.hora_inicio} onChange={(e) => setField('hora_inicio', e.target.value)} />
                <TextField disabled={locked} fullWidth type="time" InputLabelProps={{ shrink: true }} label="Hora de finalización" value={form.hora_fin} onChange={(e) => setField('hora_fin', e.target.value)} />
                <RichTextEditor disabled={locked} label="Objetivo *" value={form.objetivo} onChange={(value) => setField('objetivo', value)} minHeight={90} />
                <RichTextEditor disabled={locked} label="Desarrollo de la reunión" value={form.desarrollo} onChange={(value) => setField('desarrollo', value)} minHeight={150} />
                <RichTextEditor disabled={locked} label="Conclusiones / Compromisos" value={form.conclusiones} onChange={(value) => setField('conclusiones', value)} minHeight={120} />
              </Box>
            </Paper>
            <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3 }}>
              <Typography fontWeight={900}>2. Participantes y firmas</Typography><Typography variant="body2" color="text.secondary" mb={2}>Digite la cédula. Si la persona no existe en SIAC, puede agregarla solamente a esta acta.</Typography>
              {!locked && <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><TextField fullWidth size="small" label="Cédula" value={documentNumber} onChange={(e) => { setDocumentNumber(e.target.value.replace(/[^0-9A-Za-z-]/g, '')); setCandidate(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } }} /><Button variant="outlined" startIcon={searching ? <CircularProgress size={16} /> : <PersonSearch />} disabled={searching || !documentNumber} onClick={lookup} sx={{ minWidth: 125, textTransform: 'none', fontWeight: 800 }}>Consultar</Button></Stack>}
              {candidate && <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2, bgcolor: '#f8fbff' }}><Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}><Box><Typography fontWeight={850}>{candidate.name}</Typography><Typography variant="body2" color="text.secondary">{candidate.role_title} · {candidate.organization}</Typography><Typography variant="caption">{candidate.email}</Typography></Box><Button variant="contained" startIcon={<Add />} onClick={addParticipant}>Agregar</Button></Stack></Paper>}
              {!locked && !externalMode && <Button startIcon={<Add />} onClick={() => { setExternalDraft({ document: documentNumber, name: '', email: '', organization: '', role_title: '' }); setExternalMode(true); }} sx={{ mt: 1, textTransform: 'none', fontWeight: 800 }}>Agregar participante externo</Button>}
              {externalMode && !locked && <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2.5, bgcolor: '#f8fbff' }}><Typography fontWeight={850} mb={1}>Participante externo para esta acta</Typography><Alert severity="info" sx={{ mb: 1.5 }}>Al recibir el código, esta persona también recibirá la política institucional y deberá aceptar el tratamiento de datos antes de firmar.</Alert><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}><TextField size="small" label="Cédula o identificación" value={externalDraft.document} onChange={(e) => setExternalDraft((old) => ({ ...old, document: e.target.value }))} /><TextField size="small" label="Nombre completo" value={externalDraft.name} onChange={(e) => setExternalDraft((old) => ({ ...old, name: e.target.value }))} /><TextField size="small" type="email" label="Correo empresarial o personal" value={externalDraft.email} onChange={(e) => setExternalDraft((old) => ({ ...old, email: e.target.value }))} /><TextField size="small" label="Cargo" value={externalDraft.role_title} onChange={(e) => setExternalDraft((old) => ({ ...old, role_title: e.target.value }))} /><TextField size="small" label="Empresa o entidad (opcional)" value={externalDraft.organization} onChange={(e) => setExternalDraft((old) => ({ ...old, organization: e.target.value }))} sx={{ gridColumn: { sm: '1 / -1' } }} /></Box><Stack direction="row" justifyContent="flex-end" gap={1} mt={1.25}><Button onClick={() => setExternalMode(false)}>Cancelar</Button><Button variant="contained" startIcon={<Add />} onClick={addExternalParticipant}>Agregar al acta</Button></Stack></Paper>}
              <Stack gap={1} mt={2}>{form.participants.map((participant, index) => <Box key={participant.id || participant.user_id || `${participant.document}-${index}`} sx={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 1, alignItems: 'center', p: 1.25, border: '1px solid #dbe5f0', borderRadius: 2 }}><Box><Stack direction="row" alignItems="center" gap={1}><Typography variant="body2" fontWeight={850}>{participant.name}</Typography>{!participant.user_id && <Chip size="small" label="Externo" variant="outlined" color="primary" />}</Stack><Typography variant="caption" color="text.secondary">{participant.role_title} · {participant.email}</Typography></Box><Stack direction="row" alignItems="center"><Chip size="small" label={participant.status === 'signed' ? 'Firmado' : 'Pendiente'} color={participant.status === 'signed' ? 'success' : 'default'} />{!locked && <IconButton color="error" size="small" onClick={() => setField('participants', form.participants.filter((_, current) => current !== index))}><DeleteOutline /></IconButton>}</Stack></Box>)}</Stack>
            </Paper>
          </Stack>
          <Paper
            variant="outlined"
            sx={{
              width: { xs: '100%', lg: '53%' },
              height: { lg: '100%' },
              display: 'flex',
              flexDirection: 'column',
              p: 2,
              borderRadius: 3,
              minHeight: 0,
              bgcolor: '#fff'
            }}
          >
            <Box sx={{ mb: 2, pb: 2, borderBottom: '1px solid #e2e8f0', flexShrink: 0 }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography fontWeight={900}>Vista previa del acta</Typography>
              </Box>
              <Box sx={{ display: { xs: 'grid', lg: 'flex' }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1, '& .MuiButton-root': { flex: { lg: '1 1 0' }, minWidth: 0, minHeight: 42, px: { xs: 1.5, lg: 1 }, textTransform: 'none', fontWeight: 800, fontSize: { lg: 13 }, whiteSpace: 'nowrap' } }}>
                <Button fullWidth startIcon={<Download />} disabled={!form.id} onClick={download} variant="outlined">Descargar PDF</Button>
                {form.status === 'signing' && <Button fullWidth startIcon={<QrCode2 />} disabled={loading} onClick={showSigningAccess} variant="outlined">Ver enlace y QR</Button>}
                {form.status === 'signing' && !allSigned && <Button fullWidth startIcon={<Email />} disabled={loading} onClick={resendInvitations} variant="outlined">Reenviar invitaciones</Button>}
                {form.status === 'signing' && !hasSignatures && <Button fullWidth startIcon={<Edit />} disabled={loading} onClick={() => setConfirmAdjust(true)} color="warning" variant="outlined">Hacer ajustes</Button>}
                {locked && <Button fullWidth startIcon={<Refresh />} disabled={loading} onClick={() => openMinute(form.id)} variant="outlined">Actualizar firmas</Button>}
                {canSendFinal && <Button fullWidth startIcon={<Send />} disabled={loading} onClick={sendFinal} color="success" variant="contained" sx={{ fontWeight: 850 }}>{form.status === 'distributed' ? 'Reenviar acta firmada' : 'Enviar acta firmada'}</Button>}
                {!locked && <Button fullWidth startIcon={<Email />} onClick={publish} disabled={loading || !form.participants.length} variant="contained" sx={{ fontWeight: 850 }}>Habilitar y enviar invitaciones</Button>}
              </Box>
            </Box>
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                overflowX: 'auto',
                minHeight: 0,
                pr: 1,
                // Barra de scroll de la vista previa ampliada y de fácil agarre
                '&::-webkit-scrollbar': {
                  width: '14px',
                  height: '14px'
                },
                '&::-webkit-scrollbar-track': {
                  bgcolor: '#e2e8f0',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1'
                },
                '&::-webkit-scrollbar-thumb': {
                  bgcolor: '#475569',
                  borderRadius: '8px',
                  border: '2.5px solid #e2e8f0',
                  '&:hover': {
                    bgcolor: '#1e293b'
                  }
                },
                scrollbarWidth: 'auto',
                scrollbarColor: '#475569 #e2e8f0'
              }}
            >
              <MeetingPreview document={document} form={form} signatures={signatures} />
            </Box>
          </Paper>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, md: 4 }, py: 1.5, bgcolor: '#fff', borderTop: '1px solid #dbe5f0', flexShrink: 0 }}><Button onClick={onClose}>Cerrar</Button>{!locked && <Button variant="contained" startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <Save />} disabled={loading} onClick={() => save()} sx={{ px: 3, textTransform: 'none', fontWeight: 900 }}>Guardar borrador</Button>}</DialogActions>
    </Dialog>
    <Dialog open={Boolean(qr)} onClose={() => setQr(null)} maxWidth="xs" fullWidth><DialogTitle fontWeight={900}>Acceso para firmar</DialogTitle><DialogContent><Stack alignItems="center" gap={1.5}><Alert severity="info">Este QR y enlace sirven como alternativa presencial. Los enlaces personales enviados por correo continúan funcionando de manera independiente.</Alert>{qr?.qr_data_url && <Box component="img" src={qr.qr_data_url} alt="QR alternativo para firmar" sx={{ width: 260, height: 260 }} />}<TextField fullWidth size="small" value={qr?.signing_url || ''} InputProps={{ readOnly: true }} /><Button startIcon={<ContentCopy />} onClick={() => { navigator.clipboard.writeText(qr?.signing_url || ''); enqueueSnackbar('Enlace copiado.', { variant: 'success' }); }}>Copiar enlace alternativo</Button></Stack></DialogContent><DialogActions><Button onClick={() => setQr(null)}>Cerrar</Button></DialogActions></Dialog>
    <Dialog open={confirmAdjust} onClose={() => !loading && setConfirmAdjust(false)} maxWidth="sm" fullWidth><DialogTitle fontWeight={900}>Regresar el acta a borrador</DialogTitle><DialogContent><Alert severity="warning" sx={{ mt: 1 }}>Los enlaces de firma y el QR actuales dejarán de funcionar. Después de ajustar el acta deberá habilitar y enviar nuevamente las invitaciones.</Alert></DialogContent><DialogActions><Button disabled={loading} onClick={() => setConfirmAdjust(false)}>Cancelar</Button><Button disabled={loading} onClick={reopenForEditing} color="warning" variant="contained">Regresar y editar</Button></DialogActions></Dialog>
  </>;
}
