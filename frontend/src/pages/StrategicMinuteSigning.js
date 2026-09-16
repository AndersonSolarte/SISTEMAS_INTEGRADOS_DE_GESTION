import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircle, Draw, Email, PersonSearch, VerifiedUser } from '@mui/icons-material';
import strategicPlanningService from '../services/strategicPlanningService';

const StepTitle = ({ number, icon, title, description, active = true }) => (
  <Stack direction="row" spacing={1.4} alignItems="flex-start" sx={{ opacity: active ? 1 : 0.55 }}>
    <Box sx={{ width: 34, height: 34, borderRadius: 2, flex: '0 0 34px', display: 'grid', placeItems: 'center', bgcolor: active ? '#dbeafe' : '#eef2f7', color: active ? '#1d4ed8' : '#64748b', fontWeight: 950 }}>{number}</Box>
    <Box sx={{ minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} alignItems="center">{icon}<Typography fontWeight={900}>{title}</Typography></Stack>
      <Typography variant="body2" color="text.secondary">{description}</Typography>
    </Box>
  </Stack>
);

export default function StrategicMinuteSigning() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [minute, setMinute] = useState(null);
  const [participantId, setParticipantId] = useState('');
  const [form, setForm] = useState({ email: '', otp: '' });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [requestingCode, setRequestingCode] = useState(false);
  const [signing, setSigning] = useState(false);
  const [sent, setSent] = useState(false);
  const [signed, setSigned] = useState(false);
  const [hasInk, setHasInk] = useState(false);
  const [signaturePreview, setSignaturePreview] = useState('');

  useEffect(() => {
    strategicPlanningService.publicMinute(token)
      .then((response) => setMinute(response.data))
      .catch((error) => setMessage({ severity: 'error', text: error.response?.data?.message || 'El enlace de firma no es válido o ya venció.' }))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = 2.8; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#173b73';
    const position = (event) => {
      const rect = canvas.getBoundingClientRect(); const point = event.touches?.[0] || event;
      return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) };
    };
    const start = (event) => { event.preventDefault(); drawing.current = true; setHasInk(true); const p = position(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (event) => { if (!drawing.current) return; event.preventDefault(); const p = position(event); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => { drawing.current = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    return () => { canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop); };
  }, [participantId, sent]);

  const participant = minute?.participants?.find((item) => item.id === participantId);
  const requestCode = async () => {
    setRequestingCode(true); setMessage(null);
    try {
      await strategicPlanningService.requestCode(token, { participant_id: participantId, email: form.email.trim() });
      setSent(true); setMessage({ severity: 'success', text: 'Código enviado. Revise su correo; vence en 10 minutos.' });
    } catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible enviar el código.' }); }
    finally { setRequestingCode(false); }
  };
  const sign = async () => {
    setSigning(true); setMessage(null);
    try {
      const signature_data = canvasRef.current.toDataURL('image/png');
      await strategicPlanningService.signExternal(token, { email: form.email.trim(), otp: form.otp, participant_id: participantId, signature_data });
      setSignaturePreview(signature_data);
      setSigned(true); setMessage({ severity: 'success', text: 'Firma guardada correctamente. Ya quedó vinculada a esta versión del acta.' });
    } catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible guardar la firma.' }); }
    finally { setSigning(false); }
  };

  if (loading) return <Stack minHeight="100vh" alignItems="center" justifyContent="center" spacing={2}><CircularProgress /><Typography>Cargando acta…</Typography></Stack>;
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f4f7fb', p: { xs: 1.25, sm: 2.5, md: 5 } }}>
    <Card sx={{ maxWidth: 760, mx: 'auto', borderRadius: { xs: 2.5, md: 4 }, border: '1px solid #dbe5f0', boxShadow: '0 18px 48px rgba(23,59,115,.12)' }}>
      <Box sx={{ px: { xs: 2.25, md: 4 }, py: 2.5, background: 'linear-gradient(135deg,#204698,#2563eb)', color: '#fff' }}>
        <Typography fontWeight={850} fontSize={13}>SIAC · UNIVERSIDAD CESMAG</Typography>
        <Typography variant="h4" fontWeight={950} mt={0.5} sx={{ fontSize: { xs: 25, md: 32 } }}>Firma electrónica del acta</Typography>
        <Typography sx={{ opacity: 0.9, mt: 0.5 }}>Acta versión {minute?.version} · {minute?.meeting?.objective}</Typography>
      </Box>
      <CardContent sx={{ p: { xs: 2.25, md: 4 } }}>
        <Alert severity="info" sx={{ mb: 3 }}>Puede firmar desde celular, tableta o computador. Su firma queda protegida y vinculada a la huella digital de esta versión del acta.</Alert>
        {message && <Alert severity={message.severity} sx={{ mb: 2.5 }}>{message.text}</Alert>}
        {signed ? <Stack alignItems="center" textAlign="center" py={5} spacing={1.2}>
          <CheckCircle color="success" sx={{ fontSize: 76 }} />
          <Typography variant="h5" fontWeight={950}>Firma guardada</Typography>
          {signaturePreview && <Box sx={{ width: 'min(100%, 430px)', bgcolor: '#fff', border: '1px solid #bbf7d0', borderRadius: 2.5, px: 2, py: 1.5 }}>
            <Box component="img" src={signaturePreview} alt="Firma registrada" sx={{ display: 'block', width: '100%', height: 120, objectFit: 'contain' }} />
          </Box>}
          <Typography color="text.secondary" maxWidth={480}>El proceso terminó correctamente. Puede cerrar esta página; el responsable del acta verá su firma al actualizar.</Typography>
        </Stack> : minute ? <Stack gap={3}>
          <Box><StepTitle number="1" icon={<PersonSearch fontSize="small" color="primary" />} title="Seleccione su nombre" description="Solo aparecen las personas invitadas que todavía no han firmado." />
            <TextField fullWidth select label="Participante invitado" value={participantId} sx={{ mt: 1.5 }} onChange={(event) => {
              const selectedId = event.target.value;
              setParticipantId(selectedId); setSent(false); setHasInk(false); setMessage(null);
              setForm({ email: '', otp: '' });
            }}>{(minute?.participants || []).filter((item) => !item.signed).map((item) => <MenuItem key={item.id} value={item.id}>{item.name} · {item.email_hint}</MenuItem>)}</TextField>
          </Box>

          <Box><StepTitle number="2" active={Boolean(participant)} icon={<VerifiedUser fontSize="small" color="primary" />} title="Verifique su correo" description="Escriba el mismo correo de la invitación y solicite el código de seis dígitos." />
            {participant && <Stack gap={1.25} mt={1.5}>
              <TextField fullWidth label="Correo de la invitación" type="email" autoComplete="email" value={form.email} onChange={(event) => { setForm({ ...form, email: event.target.value }); setSent(false); }} />
              <Button size="large" variant="outlined" startIcon={requestingCode ? <CircularProgress size={18} /> : <Email />} disabled={!form.email.trim() || requestingCode} onClick={requestCode} sx={{ alignSelf: { sm: 'flex-start' }, minWidth: 250 }}>{requestingCode ? 'Enviando código…' : 'Enviar código al correo'}</Button>
            </Stack>}
          </Box>

          <Box><StepTitle number="3" active={sent} icon={<Draw fontSize="small" color="primary" />} title="Dibuje y guarde su firma" description="Digite el código recibido, dibuje dentro del recuadro y confirme." />
            {sent && <Stack gap={1.5} mt={1.5}>
              <TextField fullWidth label="Código de 6 dígitos" inputMode="numeric" autoComplete="one-time-code" value={form.otp} onChange={(event) => setForm({ ...form, otp: event.target.value.replace(/\D/g, '').slice(0, 6) })} />
              <Alert severity="success" icon={<VerifiedUser />}>Firmará como <strong>{participant?.name}</strong>. El nombre, cargo y dependencia se toman de SIAC.</Alert>
              <Box>
                <Typography fontWeight={850} mb={1}>Firma dentro del recuadro</Typography>
                <canvas ref={canvasRef} width="680" height="220" style={{ display: 'block', width: '100%', height: 220, border: '2px dashed #7da4d2', borderRadius: 12, background: '#fff', touchAction: 'none' }} />
                <Button size="small" disabled={!hasInk || signing} onClick={() => { canvasRef.current.getContext('2d').clearRect(0, 0, 680, 220); setHasInk(false); }}>Limpiar firma</Button>
              </Box>
              <Button size="large" variant="contained" disabled={form.otp.length !== 6 || !hasInk || signing} onClick={sign} sx={{ minHeight: 50, fontWeight: 900 }}>
                {signing ? <><CircularProgress size={20} color="inherit" sx={{ mr: 1 }} />Guardando firma…</> : 'Confirmar y guardar mi firma'}
              </Button>
            </Stack>}
          </Box>
        </Stack> : <Alert severity="error">No fue posible cargar el acta. Solicite un enlace nuevo al responsable.</Alert>}
      </CardContent>
    </Card>
  </Box>;
}
