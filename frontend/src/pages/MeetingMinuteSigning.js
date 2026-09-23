import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Card, CardContent, Checkbox, Chip, CircularProgress,
  FormControlLabel, Link, Paper, Stack, TextField, Typography, useMediaQuery
} from '@mui/material';
import { Article, CheckCircle, Draw, ErrorOutline, ExpandMore, Lock, PersonSearch, Refresh, VerifiedUser } from '@mui/icons-material';
import meetingMinuteService from '../services/meetingMinuteService';
import logoFormatos from '../assets/logo_formatos.jpg';
import { sanitizeRichHtml } from '../components/meetingMinute/RichTextEditor';
import GoogleIdentityVerification from '../components/security/GoogleIdentityVerification';
import formatPersonName from '../utils/formatPersonName';

const displayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value || '';
};

const formatIpAddress = (ip) => {
  if (!ip) return '';
  const cleanIp = String(ip).replace(/^::ffff:/, '').trim();
  if (cleanIp.includes('***') || cleanIp.includes('Cifrada') || cleanIp.includes('Protegida')) return cleanIp;
  if (cleanIp === '::1' || cleanIp === '127.0.0.1') return '127.***.***.1 (Protegida · Cifrada)';
  const parts = cleanIp.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.***.*** (Protegida · Cifrada)`;
  }
  if (cleanIp.includes(':')) {
    const v6 = cleanIp.split(':');
    return `${v6.slice(0, 2).join(':')}:****:**** (Protegida · Cifrada)`;
  }
  return '***.***.***.*** (Protegida · Cifrada)';
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
  const [hasInk, setHasInk] = useState(false);
  const isMobile = useMediaQuery('(max-width:768px)');
  const [expandedPreview, setExpandedPreview] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [signed, setSigned] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [message, setMessage] = useState(null);
  const [identityEmail, setIdentityEmail] = useState('');
  const [linkSent, setLinkSent] = useState(false);
  const selectedParticipant = minute?.participants?.find((participant) => String(participant.id) === String(participantId));
  const invitedParticipant = minute?.participant;
  const requiresPrivacyConsent = Boolean(selectedParticipant?.external || (invitedParticipant?.external && String(invitedParticipant?.id) === String(participantId)));
  const personalInvitation = Boolean(minute?.invitation_verified);
  const identityVerified = personalInvitation;

  useEffect(() => {
    const cleanToken = String(token || '').trim();
    if (!cleanToken) {
      setMessage({ severity: 'error', text: 'No se especificó un enlace de firma válido.' });
      setLoading(false);
      return;
    }
    meetingMinuteService.publicMinute(cleanToken).then((response) => {
      const data = response.data;
      setMinute(data);
      if (data.invitation_verified && data.invited_participant_id) {
        setParticipantId(data.invited_participant_id);
      }
      setExpandedPreview(!isMobile);
    }).catch((error) => {
      setMessage({ severity: 'error', text: error.response?.data?.message || 'El enlace no es válido o venció.' });
    }).finally(() => setLoading(false));
  }, [token, isMobile]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !participantId) return undefined;
    const context = canvas.getContext('2d');
    context.lineWidth = 2.8;
    context.lineCap = 'round';
    context.strokeStyle = '#173b73';
    const point = (event) => {
      const rect = canvas.getBoundingClientRect();
      const source = event.touches?.[0] || event;
      return {
        x: (source.clientX - rect.left) * (canvas.width / rect.width),
        y: (source.clientY - rect.top) * (canvas.height / rect.height)
      };
    };
    const start = (event) => {
      event.preventDefault();
      drawing.current = true;
      setHasInk(true);
      const position = point(event);
      context.beginPath();
      context.moveTo(position.x, position.y);
    };
    const move = (event) => {
      if (!drawing.current) return;
      event.preventDefault();
      const position = point(event);
      context.lineTo(position.x, position.y);
      context.stroke();
    };
    const stop = () => { drawing.current = false; };
    canvas.addEventListener('mousedown', start);
    canvas.addEventListener('mousemove', move);
    window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false });
    canvas.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', stop);
    return () => {
      canvas.removeEventListener('mousedown', start);
      canvas.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', stop);
      canvas.removeEventListener('touchstart', start);
      canvas.removeEventListener('touchmove', move);
      window.removeEventListener('touchend', stop);
    };
  }, [participantId]);

  const useInstitutionalGoogleAccount = async (credential) => {
    setWorking(true);
    setMessage(null);
    try {
      const response = await meetingMinuteService.googleSigningAccess(token, {
        credential,
        public_base_url: window.location.origin
      });
      const signingUrl = response.data?.signing_url;
      if (!signingUrl) throw new Error('Google validó la cuenta, pero no se generó el acceso personal.');
      window.location.replace(signingUrl);
    } catch (error) {
      setMessage({ severity: 'error', text: error.response?.data?.message || error.message || 'No fue posible validar la cuenta institucional.' });
      setWorking(false);
    }
  };

  const requestPersonalLink = async () => {
    const email = identityEmail.trim().toLowerCase();
    if (!email) {
      setMessage({ severity: 'warning', text: 'Digite el correo con el que fue registrado en el acta.' });
      return;
    }
    setWorking(true);
    setMessage(null);
    try {
      const response = await meetingMinuteService.requestSigningLink(token, { email });
      setLinkSent(true);
      setMessage({ severity: 'success', text: response.message || 'Enlace personal enviado. Revise su correo.' });
    } catch (error) {
      setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible enviar el enlace personal.' });
    } finally {
      setWorking(false);
    }
  };

  const sign = async () => {
    if (!canvasRef.current || !participantId) return;
    setWorking(true);
    setMessage(null);
    try {
      await meetingMinuteService.sign(token, {
        participant_id: participantId,
        privacy_accepted: privacyAccepted,
        signature_data: canvasRef.current.toDataURL('image/png')
      });
      setSigned(true);
      setMessage({ severity: 'success', text: 'Firma registrada y vinculada al acta.' });
    }
    catch (error) {
      setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible guardar la firma.' });
    }
    finally {
      setWorking(false);
    }
  };

  if (loading) {
    return (
      <Stack minHeight="100vh" justifyContent="center" alignItems="center" gap={2} bgcolor="#f4f7fb">
        <CircularProgress />
        <Typography fontWeight={700} color="text.secondary">Cargando acta institucional…</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', p: { xs: 1.5, sm: 3, md: 5 } }}>
      <Card sx={{ maxWidth: 1120, mx: 'auto', borderRadius: 4, boxShadow: '0 18px 50px rgba(23,59,115,.15)', overflow: 'hidden' }}>
        <Box sx={{ p: { xs: 2.5, sm: 3, md: 4 }, background: 'linear-gradient(135deg,#214c9c,#315ee8)', color: '#fff' }}>
          <Typography fontWeight={900} fontSize={13}>SIAC · UNIVERSIDAD CESMAG</Typography>
          <Typography variant="h5" fontWeight={950} sx={{ fontSize: { xs: '1.25rem', sm: '1.65rem', md: '2rem' }, mt: 0.25 }}>
            Revisión y firma de documento
          </Typography>
          {minute?.code && (
            <Typography sx={{ opacity: 0.9, fontWeight: 800, mt: 0.5, fontSize: { xs: 12, sm: 14 } }}>
              {minute.code}
            </Typography>
          )}
        </Box>
        <CardContent sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          {!minute ? (
            <Stack alignItems="center" py={{ xs: 3, md: 5 }} px={{ xs: 1, sm: 3 }} gap={2.5} textAlign="center">
              <Box
                sx={{
                  width: 76,
                  height: 76,
                  borderRadius: '50%',
                  bgcolor: '#fef2f2',
                  border: '3px solid #fca5a5',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 8px 24px rgba(239, 68, 68, 0.16)'
                }}
              >
                <ErrorOutline sx={{ fontSize: 44, color: '#dc2626' }} />
              </Box>

              <Box maxWidth={540}>
                <Chip
                  size="small"
                  color="error"
                  label="ACCESO NO DISPONIBLE"
                  sx={{ fontWeight: 900, letterSpacing: 0.5, mb: 1.25, px: 1 }}
                />
                <Typography variant="h5" fontWeight={950} color="#0f172a" sx={{ fontSize: { xs: '1.25rem', sm: '1.5rem' } }}>
                  No fue posible abrir el documento para firmar
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 1, lineHeight: 1.6 }}>
                  {message?.text || 'El enlace o código QR de firma no es válido, ya fue utilizado o ha vencido.'}
                </Typography>
              </Box>

              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 2, sm: 2.5 },
                  borderRadius: 3,
                  bgcolor: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  maxWidth: 580,
                  width: '100%',
                  textAlign: 'left'
                }}
              >
                <Typography variant="subtitle2" fontWeight={850} color="#1e293b" mb={1}>
                  ¿Qué puede haber ocurrido?
                </Typography>
                <Stack gap={1} sx={{ fontSize: 13, color: '#475569', lineHeight: 1.5 }}>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <span>•</span>
                    <span><strong>Si escaneó un código QR:</strong> Solicite al responsable que mantenga visible el código QR en pantalla e intente escanearlo nuevamente.</span>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <span>•</span>
                    <span><strong>Si el acta está en ajuste:</strong> El responsable pudo haber devuelto el acta a borrador para corregir observaciones. Los enlaces anteriores quedan desactivados por seguridad.</span>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <span>•</span>
                    <span><strong>Si recibió la invitación por correo:</strong> Verifique si recibió un correo institucional más reciente con un enlace actualizado.</span>
                  </Box>
                </Stack>
              </Paper>

              <Button
                variant="contained"
                startIcon={<Refresh />}
                onClick={() => window.location.reload()}
                sx={{ textTransform: 'none', fontWeight: 900, py: 1.2, px: 3, borderRadius: 2 }}
              >
                Reintentar carga
              </Button>
            </Stack>
          ) : minute?.already_signed ? (
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
              <Stack direction="row" justifyContent="space-between" alignItems="center" pb={1} borderBottom="1px solid #e2e8f0" flexWrap="wrap" gap={1}>
                <Box>
                  <Typography variant="body2" color="text.secondary">IP del dispositivo:</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: 10.5, display: 'block' }}>
                    Protegida por confidencialidad
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  icon={<Lock sx={{ fontSize: '13px !important' }} />}
                  label={formatIpAddress(minute.signature_info.ip_address)}
                  variant="outlined"
                  sx={{
                    fontFamily: 'monospace',
                    fontWeight: 800,
                    color: '#1e3a8a',
                    borderColor: '#cbd5e1',
                    bgcolor: '#f8fafc'
                  }}
                />
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
            <Box sx={{ mt: 1, p: 1.25, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.4, fontSize: 11 }}>
                🔒 <strong>Privacidad del dispositivo:</strong> La dirección IP real y los datos de red de su equipo permanecen cifrados bajo estricta reserva institucional en los servidores de SIAC. Nadie que acceda o reenvíe este enlace podrá visualizar la dirección IP de su dispositivo.
              </Typography>
            </Box>
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
    ) : (
      <>
        <Alert severity="info" sx={{ mb: 2.5, borderRadius: 2 }}>
          {personalInvitation
            ? 'Su identidad fue validada mediante este enlace personal. Revise los datos, dibuje su firma y confirme.'
            : 'Personal interno: continúe con su cuenta Google institucional y accederá directamente a su registro. Participantes externos: soliciten el enlace personal por correo.'}
        </Alert>
        {message && <Alert severity={message.severity} sx={{ mb: 2.5, borderRadius: 2 }}>{message.text}</Alert>}
        {identityVerified && <Accordion
          expanded={expandedPreview}
          onChange={(_, isExp) => setExpandedPreview(isExp)}
          sx={{
            border: '1px solid #cbd5e1',
            borderRadius: '12px !important',
            '&:before': { display: 'none' },
            mb: 2.5,
            boxShadow: 'none',
            overflow: 'hidden'
          }}
        >
          <AccordionSummary expandIcon={<ExpandMore />} sx={{ bgcolor: '#f8fafc', px: 2 }}>
            <Stack direction="row" alignItems="center" gap={1.25}>
              <Article color="primary" />
              <Box>
                <Typography fontWeight={900} fontSize={14} color="#0f172a">
                  {expandedPreview ? 'Ocultar contenido completo del acta' : 'Ver contenido completo del acta'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {minute.code} · {displayDate(minute.content?.fecha)} {minute.content?.dependencia ? `· ${minute.content.dependencia}` : ''}
                </Typography>
              </Box>
            </Stack>
          </AccordionSummary>
          <AccordionDetails sx={{ p: { xs: 1, sm: 2 } }}>
            <PublicActaPreview minute={minute} />
          </AccordionDetails>
        </Accordion>}
        <Stack gap={2.5}>
          <Box>
            <Stack direction="row" gap={1} alignItems="center" mb={1}>
              <PersonSearch color="primary" />
              <Typography fontWeight={900} fontSize={15}>
                {identityVerified ? '1. Datos del participante verificado' : '1. Verifique su identidad'}
              </Typography>
            </Stack>
            {identityVerified ? (
              <PaperParticipant participant={invitedParticipant || selectedParticipant} />
            ) : (
              <Stack gap={2}>
                <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3, bgcolor: '#f0fdf4', borderColor: '#86efac', textAlign: 'center' }}>
                  <Typography fontWeight={900} color="#166534">Personal interno</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ my: 1, lineHeight: 1.6 }}>
                    Si el celular ya reconoce su cuenta institucional autorizada, abriremos automáticamente su registro. De lo contrario, confirme la cuenta con Google.
                  </Typography>
                  <GoogleIdentityVerification
                    active={!working}
                    autoSelect
                    onVerify={useInstitutionalGoogleAccount}
                    onError={(text) => setMessage({ severity: 'error', text })}
                  />
                  {working && <CircularProgress size={22} sx={{ mt: 1 }} />}
                </Paper>

                <Typography textAlign="center" color="text.secondary" fontWeight={800} fontSize={12}>O USE EL CORREO REGISTRADO</Typography>

                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#f8fbff', borderColor: '#bfdbfe' }}>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.6 }}>
                    Alternativa para participantes externos: enviaremos un botón seguro a su correo; al abrirlo verá únicamente su nombre y su espacio de firma.
                  </Typography>
                  <Stack gap={1.5}>
                    <TextField
                      fullWidth
                      type="email"
                      label="Correo registrado *"
                      value={identityEmail}
                      disabled={working}
                      onChange={(event) => {
                        setIdentityEmail(event.target.value);
                        setLinkSent(false);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          requestPersonalLink();
                        }
                      }}
                    />
                    <Button variant="contained" disabled={working || !identityEmail.trim()} onClick={requestPersonalLink} sx={{ textTransform: 'none', fontWeight: 900 }}>
                      {working ? 'Enviando enlace…' : linkSent ? 'Reenviar enlace personal' : 'Enviar enlace para firmar'}
                    </Button>
                    {linkSent && (
                      <Alert severity="success" sx={{ borderRadius: 2 }}>
                        Revise el correo y pulse <strong>“Abrir y firmar mi registro”</strong>. Este enlace vence en 30 minutos.
                      </Alert>
                    )}
                  </Stack>
                </Paper>
              </Stack>
            )}
          </Box>
          {requiresPrivacyConsent && (
            <Box sx={{ p: 2, border: '1px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}>
              <Typography fontWeight={900} mb={1}>Autorización para el tratamiento de datos personales</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.65, fontSize: 12 }}>
                En la Universidad CESMAG, tratamos sus datos personales conforme a la Ley 1581 de 2012 y el Decreto 1074 de 2015. El tratamiento de sus datos incluye la recolección, almacenamiento, uso, circulación y supresión de la información. La finalidad de este tratamiento comprende, pero no se limita a gestión de procesos académicos, financieros, administrativos, de investigación, proyección social y de recursos humanos, desarrollo de programas de bienestar y desarrollo estudiantil, seguridad y control de acceso, cumplimiento de obligaciones legales. En algunos casos, podríamos solicitar datos personales sensibles. Usted tiene derecho a conocer, actualizar, rectificar y suprimir sus datos personales, así como a revocar la autorización otorgada para su tratamiento en los términos de la normativa vigente. Para más información sobre nuestras políticas de tratamiento de datos personales y sus cambios sustanciales, visite el siguiente enlace: <Link href="https://www.unicesmag.edu.co/documentos/DATOS-UNICESMAG.pdf" target="_blank" rel="noopener noreferrer">Política de tratamiento de datos personales</Link>. Para ejercer estos derechos o si tiene alguna pregunta sobre este aviso de privacidad o sobre el tratamiento de sus datos personales, contáctenos a través del correo <Link href="mailto:correspondencia@unicesmag.edu.co">correspondencia@unicesmag.edu.co</Link>, o presencialmente en las instalaciones de la Universidad CESMAG, Campus Centro, ubicada en la <Link href="https://www.google.com/maps/search/Carrera+20+A+No.+14-54" target="_blank" rel="noopener noreferrer">Carrera 20 A No. 14-54 de la ciudad de Pasto</Link>.
              </Typography>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={<Checkbox checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />}
                label={<Typography variant="body2" fontWeight={800}>He leído y autorizo el tratamiento de mis datos personales para participar y firmar esta acta.</Typography>}
              />
            </Box>
          )}
          {identityVerified && <Box sx={{ opacity: participantId ? 1 : 0.45, pointerEvents: participantId ? 'auto' : 'none' }}>
            <Stack direction="row" gap={1} alignItems="center">
              <Draw color="primary" />
              <Typography fontWeight={900}>
                2. Dibuje y confirme su firma
              </Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1 }}>
              Dibuje su firma con el dedo (en celular o tableta) o con el ratón (en computador) dentro del recuadro:
            </Typography>
            <canvas
              ref={canvasRef}
              width="680"
              height="220"
              style={{
                display: 'block',
                width: '100%',
                height: 220,
                marginTop: 8,
                border: '2px dashed #7da4d2',
                borderRadius: 12,
                background: '#fff',
                touchAction: 'none'
              }}
            />
            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5} flexWrap="wrap" gap={1}>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                disabled={!hasInk || working}
                onClick={() => {
                  if (canvasRef.current) {
                    canvasRef.current.getContext('2d').clearRect(0, 0, 680, 220);
                  }
                  setHasInk(false);
                }}
                sx={{ textTransform: 'none', fontWeight: 800 }}
              >
                Limpiar firma
              </Button>
              <Button
                variant="contained"
                disabled={
                  !hasInk ||
                  !participantId ||
                  working ||
                  (requiresPrivacyConsent && !privacyAccepted)
                }
                onClick={sign}
                sx={{
                  px: 3.5,
                  py: 1,
                  textTransform: 'none',
                  fontWeight: 900,
                  borderRadius: 2,
                  boxShadow: '0 4px 14px rgba(33, 76, 156, 0.35)'
                }}
              >
                {working ? 'Guardando firma…' : 'Confirmar y firmar'}
              </Button>
            </Stack>
          </Box>}
        </Stack>
      </>
    )}
  </CardContent>
    </Card>
  </Box>
  );
}

function PaperParticipant({ participant }) {
  if (!participant) return null;
  return (
    <Box sx={{ mt: 0.5, p: 2, border: '1px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}>
      <Typography fontWeight={900} fontSize={16} color="#0f172a">{formatPersonName(participant.name)}</Typography>
      <Typography variant="body2" color="text.secondary">
        {participant.role_title || 'Participante'}
        {participant.organization ? ` · ${participant.organization}` : ''}
      </Typography>
      {participant.email && (
        <Typography variant="caption" sx={{ display: 'block', mt: 0.5, color: '#1e3a8a', fontWeight: 700 }}>
          Destinatario registrado: {participant.email}
        </Typography>
      )}
      <Chip size="small" color="primary" label="✓ Identidad verificada · Listo para firmar" sx={{ mt: 1, fontWeight: 800 }} />
    </Box>
  );
}
