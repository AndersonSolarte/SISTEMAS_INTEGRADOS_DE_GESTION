import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, Checkbox, CircularProgress, FormControlLabel, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircle, Draw, Email, PersonSearch } from '@mui/icons-material';
import meetingMinuteService from '../services/meetingMinuteService';
import logoFormatos from '../assets/logo_formatos.jpg';
import { sanitizeRichHtml } from '../components/meetingMinute/RichTextEditor';

const displayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};

function PublicActaPreview({ minute }) {
  if (!minute) return null;
  const content = minute.content || {};
  const participants = minute.preview_participants || [];
  const cell = { px: 1, py: 0.75, borderBottom: '1px solid #111', fontSize: 12 };
  return <Box sx={{ mb: 3 }}>
    <Typography fontWeight={900} mb={0.5}>Acta que va a firmar</Typography>
    <Typography variant="body2" color="text.secondary" mb={1.5}>Revise el contenido completo antes de confirmar su firma.</Typography>
    <Box sx={{ overflowX: 'auto', border: '1px solid #dbe5f0', borderRadius: 2 }}>
      <Box sx={{ border: '1px solid #111', bgcolor: '#fff', color: '#111', fontFamily: 'Arial, sans-serif', minWidth: 720 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '22% 56% 22%', minHeight: 82, borderBottom: '1px solid #111' }}>
          <Box sx={{ borderRight: '1px solid #111', p: 0.75, display: 'grid', placeItems: 'center' }}><Box component="img" src={logoFormatos} alt="Universidad CESMAG" sx={{ maxWidth: '95%', maxHeight: 65 }} /></Box>
          <Box sx={{ borderRight: '1px solid #111', display: 'grid', placeItems: 'center', textAlign: 'center', fontWeight: 900 }}>REGISTRO DE ASISTENCIA Y REUNIÓN</Box>
          <Box sx={{ p: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontWeight: 800, fontSize: 10 }}><span>CÓDIGO: {content.header?.codigo || 'COM-ID-FR-002'}</span><span>VERSIÓN: {content.header?.version || minute.version || '1'}</span><span>FECHA: {displayDate(content.fecha)}</span></Box>
        </Box>
        <Box sx={cell}><strong>Responsable(s):</strong> {content.responsables}</Box>
        <Box sx={cell}><strong>Dependencia que cita:</strong> {content.dependencia}</Box>
        <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Información de la Reunión</Box>
        <Box sx={cell}><strong>Lugar:</strong> {content.lugar}</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.8, borderRight: '1px solid #111' }}><strong>Fecha:</strong> {displayDate(content.fecha)}</Box><Box sx={{ p: 0.8 }}><strong>Horario:</strong> {content.horario}</Box></Box>
        <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Participantes</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', bgcolor: '#f2f2f2', borderBottom: '1px solid #111', fontWeight: 900, textAlign: 'center' }}><Box /><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Nombres y Apellidos</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Cargo</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Firma</Box></Box>
        {participants.map((participant, index) => {
          const roleLabel = participant.external && participant.organization ? [participant.organization, participant.role_title].filter(Boolean).join(' · ') : (participant.role_title || participant.organization || '');
          return <Box key={participant.id} sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.6, textAlign: 'center', fontWeight: 800 }}>{index + 1}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{participant.name}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{roleLabel}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111', textAlign: 'center', color: participant.status === 'signed' ? '#15803d' : '#64748b', fontWeight: 800 }}>{participant.status === 'signed' ? 'Firmado' : 'Pendiente'}</Box></Box>;
        })}
        {['Objetivo', 'Desarrollo', 'Conclusiones / Compromisos'].map((title) => {
          const key = title === 'Objetivo' ? 'objetivo' : title === 'Desarrollo' ? 'desarrollo' : 'conclusiones';
          return <React.Fragment key={title}><Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>{title}</Box><Box sx={{ p: 1, minHeight: key === 'objetivo' ? 62 : 90, fontSize: 12, '& table': { width: '100%', borderCollapse: 'collapse' }, '& th, & td': { border: '1px solid #555', p: 0.5 }, '& a': { color: '#1d5fd1' } }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content[key]?.[0] || '') }} /></React.Fragment>;
        })}
      </Box>
    </Box>
  </Box>;
}

export default function MeetingMinuteSigning() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [minute, setMinute] = useState(null);
  const [participantId, setParticipantId] = useState('');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [signed, setSigned] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState(null);
  const selectedParticipant = minute?.participants?.find((participant) => String(participant.id) === String(participantId));
  const requiresPrivacyConsent = Boolean(selectedParticipant?.external);
  const personalInvitation = Boolean(minute?.invitation_verified);

  useEffect(() => {
    meetingMinuteService.publicMinute(token).then((response) => {
      setMinute(response.data);
      if (response.data.invitation_verified && response.data.invited_participant_id) {
        setParticipantId(response.data.invited_participant_id);
        setSent(true);
      }
    }).catch((error) => setMessage({ severity: 'error', text: error.response?.data?.message || 'El enlace no es válido o venció.' })).finally(() => setLoading(false));
  }, [token]);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sent) return undefined;
    const context = canvas.getContext('2d'); context.lineWidth = 2.8; context.lineCap = 'round'; context.strokeStyle = '#173b73';
    const point = (event) => { const rect = canvas.getBoundingClientRect(); const source = event.touches?.[0] || event; return { x: (source.clientX - rect.left) * (canvas.width / rect.width), y: (source.clientY - rect.top) * (canvas.height / rect.height) }; };
    const start = (event) => { event.preventDefault(); drawing.current = true; setHasInk(true); const position = point(event); context.beginPath(); context.moveTo(position.x, position.y); };
    const move = (event) => { if (!drawing.current) return; event.preventDefault(); const position = point(event); context.lineTo(position.x, position.y); context.stroke(); };
    const stop = () => { drawing.current = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop); canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    return () => { canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop); };
  }, [sent, participantId]);

  const requestCode = async () => {
    setWorking(true); setMessage(null);
    try { await meetingMinuteService.requestCode(token, { participant_id: participantId, email, privacy_accepted: privacyAccepted, public_base_url: window.location.origin }); setSent(true); setMessage({ severity: 'success', text: 'Código enviado. Revise el correo indicado.' }); }
    catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible enviar el código.' }); }
    finally { setWorking(false); }
  };
  const sign = async () => {
    setWorking(true); setMessage(null);
    try { await meetingMinuteService.sign(token, { participant_id: participantId, otp: personalInvitation ? undefined : otp, privacy_accepted: privacyAccepted, signature_data: canvasRef.current.toDataURL('image/png') }); setSigned(true); setMessage({ severity: 'success', text: 'Firma guardada y vinculada al acta.' }); }
    catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible guardar la firma.' }); }
    finally { setWorking(false); }
  };

  if (loading) return <Stack minHeight="100vh" justifyContent="center" alignItems="center" gap={2}><CircularProgress /><Typography>Cargando acta…</Typography></Stack>;
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', p: { xs: 1.5, sm: 3, md: 5 } }}><Card sx={{ maxWidth: 1120, mx: 'auto', borderRadius: 4, boxShadow: '0 18px 50px rgba(23,59,115,.15)' }}><Box sx={{ p: { xs: 2.5, md: 4 }, background: 'linear-gradient(135deg,#214c9c,#315ee8)', color: '#fff' }}><Typography fontWeight={900} fontSize={13}>SIAC · UNIVERSIDAD CESMAG</Typography><Typography variant="h4" fontWeight={950}>Revisión y firma electrónica</Typography><Typography sx={{ opacity: .9 }}>{minute?.code}</Typography></Box><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
    <Alert severity="info" sx={{ mb: 2.5 }}>{personalInvitation ? 'Su correo ya fue verificado mediante este enlace personal. Revise sus datos, dibuje la firma y confirme.' : 'Puede firmar desde celular, tableta o computador. Seleccione su nombre y valide el correo para continuar.'}</Alert>{message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
    <PublicActaPreview minute={minute} />
    {signed ? <Stack alignItems="center" py={5} gap={1}><CheckCircle color="success" sx={{ fontSize: 76 }} /><Typography variant="h5" fontWeight={950}>Firma guardada</Typography><Typography color="text.secondary">Puede cerrar esta página.</Typography></Stack> : minute && <Stack gap={3}>
      <Box><Stack direction="row" gap={1} alignItems="center"><PersonSearch color="primary" /><Typography fontWeight={900}>{personalInvitation ? '1. Confirme sus datos' : '1. Seleccione su nombre'}</Typography></Stack>{personalInvitation ? <PaperParticipant participant={selectedParticipant} /> : <TextField fullWidth select label="Participante" value={participantId} onChange={(event) => { setParticipantId(event.target.value); setSent(false); setEmail(''); setOtp(''); setHasInk(false); setPrivacyAccepted(false); }} sx={{ mt: 1.25 }}>{minute.participants.map((participant) => <MenuItem key={participant.id} value={participant.id}>{participant.name} · {participant.role_title}{participant.external ? ' · Externo' : ''}</MenuItem>)}</TextField>}</Box>
      {requiresPrivacyConsent && <Box sx={{ p: 2, border: '1px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}><Typography fontWeight={900} mb={1}>Autorización para el tratamiento de datos personales</Typography><Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>En la Universidad CESMAG, tratamos sus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015. El tratamiento de sus datos incluye la recolección, almacenamiento, uso, circulación y supresión de la información. La finalidad de este tratamiento comprende, pero no se limita a gestión de procesos académicos, financieros, administrativos, de investigación, proyección social y de recursos humanos, desarrollo de programas de bienestar y desarrollo estudiantil, seguridad y control de acceso, cumplimiento de obligaciones legales. En algunos casos, podríamos solicitar datos personales sensibles. Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada para su tratamiento en los términos de la normativa vigente. Para más información sobre nuestras políticas de tratamiento de datos personales y sus cambios sustanciales, visite el siguiente enlace: <Link href="https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf" target="_blank" rel="noopener noreferrer">Política de tratamiento de datos personales</Link>. Para ejercer estos derechos o si tiene alguna pregunta sobre este aviso de privacidad o sobre el tratamiento de sus datos personales, contáctenos a través del correo <Link href="mailto:correspondencia@unicesmag.edu.co">correspondencia@unicesmag.edu.co</Link>, o presencialmente en las instalaciones de la Universidad CESMAG, Campus Centro, ubicada en la <Link href="https://www.google.com/maps/search/Carrera+20+A+No.+14-54" target="_blank" rel="noopener noreferrer">Carrera 20 A No. 14-54 de la ciudad de Pasto</Link>.</Typography><FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />} label={<Typography variant="body2" fontWeight={800}>He leído y autorizo el tratamiento de mis datos personales para participar y firmar esta acta.</Typography>} /></Box>}
      {!personalInvitation && <Box><Stack direction="row" gap={1} alignItems="center"><Email color="primary" /><Typography fontWeight={900}>2. Verifique su correo</Typography></Stack><Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mt={1.25}><TextField fullWidth type="email" label="Correo de la invitación" value={email} onChange={(event) => setEmail(event.target.value)} /><Button variant="outlined" disabled={!participantId || !email || working || (requiresPrivacyConsent && !privacyAccepted)} onClick={requestCode} sx={{ minWidth: 180, textTransform: 'none', fontWeight: 850 }}>{working ? 'Enviando…' : 'Enviar código'}</Button></Stack></Box>}
      <Box sx={{ opacity: sent ? 1 : .45, pointerEvents: sent ? 'auto' : 'none' }}><Stack direction="row" gap={1} alignItems="center"><Draw color="primary" /><Typography fontWeight={900}>{personalInvitation ? '2. Dibuje y confirme su firma' : '3. Dibuje y confirme su firma'}</Typography></Stack>{!personalInvitation && <TextField fullWidth label="Código de 6 dígitos" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} sx={{ my: 1.25 }} />}<canvas ref={canvasRef} width="680" height="220" style={{ display: 'block', width: '100%', height: 220, marginTop: 10, border: '2px dashed #7da4d2', borderRadius: 12, background: '#fff', touchAction: 'none' }} /><Stack direction="row" justifyContent="space-between" mt={1}><Button size="small" onClick={() => { canvasRef.current.getContext('2d').clearRect(0, 0, 680, 220); setHasInk(false); }}>Limpiar</Button><Button variant="contained" disabled={!hasInk || (!personalInvitation && otp.length !== 6) || working || (requiresPrivacyConsent && !privacyAccepted)} onClick={sign} sx={{ px: 3, textTransform: 'none', fontWeight: 900 }}>Confirmar y firmar</Button></Stack></Box>
    </Stack>}
  </CardContent></Card></Box>;
}

function PaperParticipant({ participant }) {
  if (!participant) return null;
  return <Box sx={{ mt: 1.25, p: 2, border: '1px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}><Typography fontWeight={900}>{participant.name}</Typography><Typography variant="body2" color="text.secondary">{participant.role_title || 'Participante'}{participant.organization ? ` · ${participant.organization}` : ''}</Typography><Typography variant="caption" color="primary.main">Invitación personal verificada</Typography></Box>;
}
