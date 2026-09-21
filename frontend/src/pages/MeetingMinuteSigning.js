import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControlLabel, Link, MenuItem, Paper, Stack, TextField, Typography
} from '@mui/material';
import { CheckCircle, Draw, Email, PersonSearch, VerifiedUser } from '@mui/icons-material';
import meetingMinuteService from '../services/meetingMinuteService';
import logoFormatos from '../assets/logo_formatos.jpg';
import { sanitizeRichHtml } from '../components/meetingMinute/RichTextEditor';
import formatPersonName from '../utils/formatPersonName';

const displayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};

const formatIpAddress = (ip) => {
  if (!ip) return '';
  if (ip === '::1' || ip === '127.0.0.1' || ip === '::ffff:127.0.0.1') return '127.0.0.1 (Local)';
  return String(ip).replace(/^::ffff:/, '');
};

function PublicActaPreview({ minute }) {
  if (!minute) return null;
  const content = minute.content || {};
  const participants = minute.preview_participants || [];
  const cell = { px: 1, py: 0.75, borderBottom: '1px solid #111', fontSize: 12 };
  const responsablesArray = (Array.isArray(content.responsables_data) && content.responsables_data.length > 0)
    ? content.responsables_data
    : (typeof content.responsables === 'string' && content.responsables.trim()
      ? content.responsables.split('\n').map((l) => l.replace(/^[•\-*\s]+/, '').trim()).filter(Boolean).map((line, idx) => {
        const match = line.match(/^([^(]+)(?:\((.*)\))?$/);
        return { name: match ? match[1].trim() : line, role_title: match ? (match[2] || '').trim() : '', is_primary: idx === 0 };
      })
      : []);
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
        <Box sx={{ ...cell, py: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
            <strong>Responsable(s):</strong>
            {responsablesArray.length > 1 && (
              <Box component="span" sx={{ fontSize: 10, color: '#334155', fontWeight: 800, bgcolor: '#f1f5f9', px: 0.8, py: 0.2, borderRadius: 1 }}>
                {responsablesArray.length} asignados
              </Box>
            )}
          </Box>
          {responsablesArray.length === 0 ? (
            <Box sx={{ fontSize: 11, color: '#64748b', fontStyle: 'italic', pl: 0.5 }}>
              (Sin responsables asignados)
            </Box>
          ) : (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: responsablesArray.length > 1 ? 'repeat(auto-fit, minmax(280px, 1fr))' : '1fr',
                gap: 1
              }}
            >
              {responsablesArray.map((r, i) => {
                const isPrimary = Boolean(r.is_primary) || i === 0;
                const roleOrg = [r.role_title, r.organization].filter(Boolean).join(' · ');
                return (
                  <Box
                    key={i}
                    sx={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 1.5,
                      bgcolor: isPrimary ? '#f8fafc' : '#ffffff',
                      p: 0.85,
                      borderLeft: isPrimary ? '4px solid #1e3a8a' : '4px solid #64748b'
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.25 }}>
                      <Box
                        component="span"
                        sx={{
                          fontSize: 9.5,
                          fontWeight: 900,
                          textTransform: 'uppercase',
                          letterSpacing: 0.5,
                          color: isPrimary ? '#1e3a8a' : '#475569'
                        }}
                      >
                        {isPrimary ? 'Responsable Principal' : 'Co-responsable'}
                      </Box>
                    </Box>
                    <Box sx={{ fontSize: 12, fontWeight: 850, color: '#0f172a' }}>
                      {formatPersonName(r.name)}
                    </Box>
                    {roleOrg && (
                      <Box sx={{ fontSize: 10.5, color: '#475569', mt: 0.2 }}>
                        {roleOrg}
                      </Box>
                    )}
                  </Box>
                );
              })}
            </Box>
          )}
        </Box>
        <Box sx={cell}><strong>Dependencia que cita:</strong> {content.dependencia}</Box>
        <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Información de la Reunión</Box>
        <Box sx={cell}><strong>Lugar:</strong> {content.lugar}</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '2fr 1fr', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.8, borderRight: '1px solid #111' }}><strong>Fecha:</strong> {displayDate(content.fecha)}</Box><Box sx={{ p: 0.8 }}><strong>Horario:</strong> {content.horario}</Box></Box>
        <Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>Participantes</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', bgcolor: '#f2f2f2', borderBottom: '1px solid #111', fontWeight: 900, textAlign: 'center' }}><Box /><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Nombres y Apellidos</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Cargo</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>Firma</Box></Box>
        {participants.map((participant, index) => {
          const roleLabel = participant.external && participant.organization ? [participant.organization, participant.role_title].filter(Boolean).join(' · ') : (participant.role_title || participant.organization || '');
          return <Box key={participant.id} sx={{ display: 'grid', gridTemplateColumns: '45px 1.5fr 1fr 150px', borderBottom: '1px solid #111' }}><Box sx={{ p: 0.6, textAlign: 'center', fontWeight: 800 }}>{index + 1}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{formatPersonName(participant.name)}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111' }}>{roleLabel}</Box><Box sx={{ p: 0.6, borderLeft: '1px solid #111', textAlign: 'center', color: participant.status === 'signed' ? '#15803d' : '#64748b', fontWeight: 800 }}>{participant.status === 'signed' ? 'Firmado' : 'Pendiente'}</Box></Box>;
        })}
        {['Objetivo', 'Desarrollo', 'Conclusiones / Compromisos'].map((title) => {
          const key = title === 'Objetivo' ? 'objetivo' : title === 'Desarrollo' ? 'desarrollo' : 'conclusiones';
          return <React.Fragment key={title}><Box sx={{ ...cell, bgcolor: '#d9d9d9', textAlign: 'center', fontWeight: 900 }}>{title}</Box><Box sx={{ p: 1, minHeight: key === 'objetivo' ? 62 : 90, fontSize: 12, '& table': { width: '100%', maxWidth: '100%', tableLayout: 'fixed', borderCollapse: 'collapse', my: 0.5, boxSizing: 'border-box' }, '& th, & td': { border: '1px solid #555', p: 0.6, whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'anywhere', verticalAlign: 'top', boxSizing: 'border-box' }, '& a': { color: '#1d5fd1' } }} dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(content[key]?.[0] || content[key] || '') }} /></React.Fragment>;
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
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [sent, setSent] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [signed, setSigned] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState(null);
  const selectedParticipant = minute?.participants?.find((participant) => String(participant.id) === String(participantId));
  const invitedParticipant = minute?.participant;
  const requiresPrivacyConsent = Boolean(selectedParticipant?.external);
  const personalInvitation = Boolean(minute?.invitation_verified);
  const registeredEmail = (invitedParticipant?.email || selectedParticipant?.email || '').trim().toLowerCase();
  const isEmailValid = !personalInvitation || (Boolean(confirmedEmail.trim()) && confirmedEmail.trim().toLowerCase() === registeredEmail);
  const emailMismatch = personalInvitation && Boolean(confirmedEmail.trim()) && !isEmailValid;

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
    try {
      await meetingMinuteService.sign(token, {
        participant_id: participantId,
        signer_email: personalInvitation ? confirmedEmail.trim().toLowerCase() : undefined,
        otp: personalInvitation ? undefined : otp,
        privacy_accepted: privacyAccepted,
        signature_data: canvasRef.current.toDataURL('image/png')
      });
      setSigned(true);
      setMessage({ severity: 'success', text: 'Firma guardada y vinculada al acta.' });
    }
    catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible guardar la firma.' }); }
    finally { setWorking(false); }
  };

  if (loading) return <Stack minHeight="100vh" justifyContent="center" alignItems="center" gap={2}><CircularProgress /><Typography>Cargando acta…</Typography></Stack>;
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', p: { xs: 1.5, sm: 3, md: 5 } }}><Card sx={{ maxWidth: 1120, mx: 'auto', borderRadius: 4, boxShadow: '0 18px 50px rgba(23,59,115,.15)' }}><Box sx={{ p: { xs: 2.5, md: 4 }, background: 'linear-gradient(135deg,#214c9c,#315ee8)', color: '#fff' }}><Typography fontWeight={900} fontSize={13}>SIAC · UNIVERSIDAD CESMAG</Typography><Typography variant="h4" fontWeight={950}>Revisión y firma de documento</Typography><Typography sx={{ opacity: .9 }}>{minute?.code}</Typography></Box><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
    {minute?.already_signed ? (
      <Stack alignItems="center" py={2} gap={2.5}>
        <Box
          sx={{
            width: 76,
            height: 76,
            borderRadius: '50%',
            bgcolor: '#ecfdf5',
            border: '3px solid #86efac',
            display: 'grid',
            placeItems: 'center',
            boxShadow: '0 8px 24px rgba(16, 185, 129, 0.18)'
          }}
        >
          <VerifiedUser sx={{ fontSize: 44, color: '#16a34a' }} />
        </Box>

        <Box textAlign="center">
          <Chip
            size="small"
            color="success"
            label="DOCUMENTO FIRMADO"
            sx={{ fontWeight: 900, letterSpacing: 0.5, mb: 1, px: 1 }}
          />
          <Typography variant="h4" fontWeight={950} color="#0f172a">
            Documento firmado
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5, maxWidth: 650, mx: 'auto', lineHeight: 1.6 }}>
            Apreciado(a) <strong>{formatPersonName(minute.participant?.name) || 'participante'}</strong>, le confirmamos que su documento firmado ya fue registrado y vinculado exitosamente a esta acta.
          </Typography>
        </Box>

        <Paper
          variant="outlined"
          sx={{
            p: 2.5,
            borderRadius: 3,
            bgcolor: '#f8fafc',
            border: '1px solid #cbd5e1',
            maxWidth: 680,
            width: '100%'
          }}
        >
          <Stack gap={1.25}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1} borderBottom="1px solid #e2e8f0">
              <Typography variant="body2" color="text.secondary">Código del acta:</Typography>
              <Typography variant="body2" fontWeight={850}>{minute.code}</Typography>
            </Stack>
            <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1} borderBottom="1px solid #e2e8f0">
              <Typography variant="body2" color="text.secondary">Participante registrado:</Typography>
              <Typography variant="body2" fontWeight={850}>
                {formatPersonName(minute.participant?.name)} {minute.participant?.role_title ? `· ${minute.participant.role_title}` : ''}
              </Typography>
            </Stack>
            {minute.signature_info?.signed_at && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1} borderBottom="1px solid #e2e8f0">
                <Typography variant="body2" color="text.secondary">Fecha y hora de registro:</Typography>
                <Typography variant="body2" fontWeight={850}>
                  {new Date(minute.signature_info.signed_at).toLocaleString('es-CO', { dateStyle: 'long', timeStyle: 'short' })}
                </Typography>
              </Stack>
            )}
            <Stack direction="row" justifyContent="space-between" alignItems="center" pb={minute.signature_info?.ip_address ? 1 : 0} borderBottom={minute.signature_info?.ip_address ? "1px solid #e2e8f0" : "none"}>
              <Typography variant="body2" color="text.secondary">Estado del documento:</Typography>
              <Chip size="small" color="success" label="✓ Documento firmado" sx={{ fontWeight: 800 }} />
            </Stack>
            {minute.signature_info?.ip_address && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1} borderBottom="1px solid #e2e8f0">
                <Typography variant="body2" color="text.secondary">IP del dispositivo (Trazabilidad):</Typography>
                <Typography variant="body2" fontFamily="monospace" fontWeight={850} color="#1e293b">
                  {formatIpAddress(minute.signature_info.ip_address)}
                </Typography>
              </Stack>
            )}
            {minute.signature_info?.signature_hash && (
              <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1} borderBottom="1px solid #e2e8f0">
                <Typography variant="body2" color="text.secondary">Código de trazabilidad (Hash):</Typography>
                <Typography variant="caption" fontFamily="monospace" color="#64748b" sx={{ wordBreak: 'break-all', maxWidth: '60%', textAlign: 'right' }}>
                  {minute.signature_info.signature_hash}
                </Typography>
              </Stack>
            )}
            {minute.signature_info?.signature_preview && (
              <Box sx={{ mt: 1, pt: 1.5, borderTop: '1px dashed #cbd5e1', textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary" display="block" mb={0.75} fontWeight={700}>
                  Firma registrada:
                </Typography>
                <Box
                  component="img"
                  src={minute.signature_info.signature_preview}
                  alt="Firma registrada"
                  sx={{ maxHeight: 60, maxWidth: '100%', objectFit: 'contain', bgcolor: '#fff', p: 0.5, borderRadius: 1.5, border: '1px solid #e2e8f0' }}
                />
              </Box>
            )}
          </Stack>
        </Paper>

        <Alert severity="info" sx={{ maxWidth: 680, width: '100%', borderRadius: 2 }}>
          <strong>Constancia institucional:</strong> No es necesario que realice ninguna acción adicional. Una vez todos los participantes completen su firma, el sistema enviará automáticamente la copia final del acta en formato PDF a su correo electrónico.
        </Alert>

        <Box sx={{ width: '100%', mt: 2 }}>
          <PublicActaPreview minute={minute} />
        </Box>
      </Stack>
    ) : signed ? (
      <Stack alignItems="center" py={5} gap={1.5}>
        <CheckCircle color="success" sx={{ fontSize: 76 }} />
        <Typography variant="h5" fontWeight={950}>Documento firmado exitosamente</Typography>
        <Typography color="text.secondary" textAlign="center" maxWidth={500}>
          Su firma ha sido vinculada al acta institucional. Puede cerrar esta página con total tranquilidad.
        </Typography>
      </Stack>
    ) : minute && (
      <>
        <Alert severity="info" sx={{ mb: 2.5 }}>{personalInvitation ? 'Su correo ya fue verificado mediante este enlace personal. Revise sus datos, dibuje la firma y confirme.' : 'Puede firmar desde celular, tableta o computador. Seleccione su nombre y valide el correo para continuar.'}</Alert>
        {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
        <PublicActaPreview minute={minute} />
        <Stack gap={3}>
          <Box>
            <Stack direction="row" gap={1} alignItems="center">
              <PersonSearch color="primary" />
              <Typography fontWeight={900}>{personalInvitation ? '1. Confirme sus datos y correo registrado' : '1. Seleccione su nombre'}</Typography>
            </Stack>
            {personalInvitation ? (
              <Box>
                <PaperParticipant participant={invitedParticipant || selectedParticipant} />
                <Box sx={{ mt: 1.5, p: 2, bgcolor: '#f8fafc', borderRadius: 2.5, border: '1px solid #cbd5e1' }}>
                  <Typography variant="subtitle2" fontWeight={850} color="#1e293b" mb={0.5}>
                    Seguridad institucional contra reenvíos
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.25, lineHeight: 1.5 }}>
                    Para certificar que usted es el destinatario convocado y prevenir firmas no autorizadas por reenvío de correos, confirme su dirección de correo electrónico registrada:
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="email"
                    label="Correo electrónico registrado *"
                    placeholder="nombre.apellido@unicesmag.edu.co"
                    value={confirmedEmail}
                    onChange={(event) => setConfirmedEmail(event.target.value)}
                    error={emailMismatch}
                    helperText={
                      emailMismatch
                        ? `⚠️ El correo ingresado no coincide con el registrado en esta invitación (${registeredEmail}). Si este mensaje fue reenviado, solo el destinatario convocado tiene autorización para firmar.`
                        : isEmailValid && confirmedEmail.trim()
                        ? '✓ Correo validado correctamente.'
                        : 'Ingrese el correo registrado para habilitar la firma del documento.'
                    }
                  />
                </Box>
              </Box>
            ) : (
              <TextField fullWidth select label="Participante" value={participantId} onChange={(event) => { setParticipantId(event.target.value); setSent(false); setEmail(''); setOtp(''); setHasInk(false); setPrivacyAccepted(false); }} sx={{ mt: 1.25 }}>
                {minute.participants.map((participant) => <MenuItem key={participant.id} value={participant.id}>{formatPersonName(participant.name)} · {participant.role_title}{participant.external ? ' · Externo' : ''}</MenuItem>)}
              </TextField>
            )}
          </Box>
          {requiresPrivacyConsent && <Box sx={{ p: 2, border: '1px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}><Typography fontWeight={900} mb={1}>Autorización para el tratamiento de datos personales</Typography><Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65 }}>En la Universidad CESMAG, tratamos sus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015. El tratamiento de sus datos incluye la recolección, almacenamiento, uso, circulación y supresión de la información. La finalidad de este tratamiento comprende, pero no se limita a gestión de procesos académicos, financieros, administrativos, de investigación, proyección social y de recursos humanos, desarrollo de programas de bienestar y desarrollo estudiantil, seguridad y control de acceso, cumplimiento de obligaciones legales. En algunos casos, podríamos solicitar datos personales sensibles. Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada para su tratamiento en los términos de la normativa vigente. Para más información sobre nuestras políticas de tratamiento de datos personales y sus cambios sustanciales, visite el siguiente enlace: <Link href="https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf" target="_blank" rel="noopener noreferrer">Política de tratamiento de datos personales</Link>. Para ejercer estos derechos o si tiene alguna pregunta sobre este aviso de privacidad o sobre el tratamiento de sus datos personales, contáctenos a través del correo <Link href="mailto:correspondencia@unicesmag.edu.co">correspondencia@unicesmag.edu.co</Link>, o presencialmente en las instalaciones de la Universidad CESMAG, Campus Centro, ubicada en la <Link href="https://www.google.com/maps/search/Carrera+20+A+No.+14-54" target="_blank" rel="noopener noreferrer">Carrera 20 A No. 14-54 de la ciudad de Pasto</Link>.</Typography><FormControlLabel sx={{ mt: 1 }} control={<Checkbox checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />} label={<Typography variant="body2" fontWeight={800}>He leído y autorizo el tratamiento de mis datos personales para participar y firmar esta acta.</Typography>} /></Box>}
          {!personalInvitation && <Box><Stack direction="row" gap={1} alignItems="center"><Email color="primary" /><Typography fontWeight={900}>2. Verifique su correo</Typography></Stack><Stack direction={{ xs: 'column', sm: 'row' }} gap={1} mt={1.25}><TextField fullWidth type="email" label="Correo de la invitación" value={email} onChange={(event) => setEmail(event.target.value)} /><Button variant="outlined" disabled={!participantId || !email || working || (requiresPrivacyConsent && !privacyAccepted)} onClick={requestCode} sx={{ minWidth: 180, textTransform: 'none', fontWeight: 850 }}>{working ? 'Enviando…' : 'Enviar código'}</Button></Stack></Box>}
          <Box sx={{ opacity: sent ? 1 : .45, pointerEvents: sent ? 'auto' : 'none' }}><Stack direction="row" gap={1} alignItems="center"><Draw color="primary" /><Typography fontWeight={900}>{personalInvitation ? '2. Dibuje y confirme su firma' : '3. Dibuje y confirme su firma'}</Typography></Stack>{!personalInvitation && <TextField fullWidth label="Código de 6 dígitos" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} sx={{ my: 1.25 }} />}<canvas ref={canvasRef} width="680" height="220" style={{ display: 'block', width: '100%', height: 220, marginTop: 10, border: '2px dashed #7da4d2', borderRadius: 12, background: '#fff', touchAction: 'none' }} /><Stack direction="row" justifyContent="space-between" mt={1}><Button size="small" onClick={() => { canvasRef.current.getContext('2d').clearRect(0, 0, 680, 220); setHasInk(false); }}>Limpiar</Button><Button variant="contained" disabled={!hasInk || (!personalInvitation && otp.length !== 6) || (personalInvitation && (!confirmedEmail.trim() || !isEmailValid)) || working || (requiresPrivacyConsent && !privacyAccepted)} onClick={sign} sx={{ px: 3, textTransform: 'none', fontWeight: 900 }}>Confirmar y firmar</Button></Stack></Box>
        </Stack>
      </>
    )}
  </CardContent></Card></Box>;
}

function PaperParticipant({ participant }) {
  if (!participant) return null;
  return (
    <Box sx={{ mt: 1.25, p: 2, border: '1px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}>
      <Typography fontWeight={900}>{formatPersonName(participant.name)}</Typography>
      <Typography variant="body2" color="text.secondary">{participant.role_title || 'Participante'}{participant.organization ? ` · ${participant.organization}` : ''}</Typography>
      {participant.email && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#1e3a8a', fontWeight: 700 }}>
          Destinatario registrado: {participant.email}
        </Typography>
      )}
      <Typography variant="caption" color="primary.main">Invitación personal verificada</Typography>
    </Box>
  );
}
