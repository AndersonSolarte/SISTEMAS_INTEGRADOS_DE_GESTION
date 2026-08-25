import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Alert, Box, Button, Card, CardContent, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { CheckCircle, Draw, Email } from '@mui/icons-material';
import strategicPlanningService from '../services/strategicPlanningService';

export default function StrategicMinuteSigning() {
  const { token } = useParams();
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const [minute, setMinute] = useState(null);
  const [participantId, setParticipantId] = useState('');
  const [form, setForm] = useState({ email: '', otp: '', name: '', organization: '', role_title: '' });
  const [message, setMessage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sent, setSent] = useState(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    strategicPlanningService.publicMinute(token).then((response) => setMinute(response.data)).catch((error) => setMessage({ severity: 'error', text: error.response?.data?.message || 'Enlace inválido.' })).finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d'); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.strokeStyle = '#172554';
    const position = (event) => { const rect = canvas.getBoundingClientRect(); const point = event.touches?.[0] || event; return { x: (point.clientX - rect.left) * (canvas.width / rect.width), y: (point.clientY - rect.top) * (canvas.height / rect.height) }; };
    const start = (event) => { event.preventDefault(); drawing.current = true; const p = position(event); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const move = (event) => { if (!drawing.current) return; event.preventDefault(); const p = position(event); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const stop = () => { drawing.current = false; };
    canvas.addEventListener('mousedown', start); canvas.addEventListener('mousemove', move); window.addEventListener('mouseup', stop);
    canvas.addEventListener('touchstart', start, { passive: false }); canvas.addEventListener('touchmove', move, { passive: false }); window.addEventListener('touchend', stop);
    return () => { canvas.removeEventListener('mousedown', start); canvas.removeEventListener('mousemove', move); window.removeEventListener('mouseup', stop); canvas.removeEventListener('touchstart', start); canvas.removeEventListener('touchmove', move); window.removeEventListener('touchend', stop); };
  }, [participantId, sent]);

  const participant = minute?.participants?.find((item) => item.id === participantId);
  const requestCode = async () => {
    try { await strategicPlanningService.requestCode(token, { participant_id: participantId, email: form.email }); setSent(true); setMessage({ severity: 'success', text: 'Código enviado. Revise su correo; vence en 10 minutos.' }); }
    catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible enviar el código.' }); }
  };
  const sign = async () => {
    try {
      const signature_data = canvasRef.current.toDataURL('image/png');
      await strategicPlanningService.signExternal(token, { ...form, participant_id: participantId, signature_data });
      setSigned(true); setMessage({ severity: 'success', text: 'Firma electrónica registrada correctamente con trazabilidad SIAC.' });
    } catch (error) { setMessage({ severity: 'error', text: error.response?.data?.message || 'No fue posible registrar la firma.' }); }
  };

  if (loading) return <Stack minHeight="100vh" alignItems="center" justifyContent="center"><CircularProgress /></Stack>;
  return <Box sx={{ minHeight: '100vh', bgcolor: '#f1f5f9', p: { xs: 2, md: 5 } }}><Card sx={{ maxWidth: 760, mx: 'auto', borderRadius: 4 }}><CardContent sx={{ p: { xs: 2.5, md: 4 } }}>
    <Typography color="primary" fontWeight={900}>SIAC · UNICESMAG</Typography><Typography variant="h4" fontWeight={950} mt={1}>Firma de acta</Typography>
    <Typography color="text.secondary" mt={1}>Acta versión {minute?.version} · {minute?.meeting?.objective}</Typography>
    <Alert severity="info" sx={{ my: 2.5 }}>Esta es una firma electrónica con trazabilidad SIAC; no constituye una firma digital certificada. La firma queda vinculada a la huella de esta versión del acta.</Alert>
    {message && <Alert severity={message.severity} sx={{ mb: 2 }}>{message.text}</Alert>}
    {signed ? <Stack alignItems="center" py={5}><CheckCircle color="success" sx={{ fontSize: 70 }} /><Typography variant="h5" fontWeight={900}>Proceso completado</Typography></Stack> : <Stack gap={2}>
      <TextField select label="Seleccione su nombre" value={participantId} onChange={(e) => setParticipantId(e.target.value)}>{(minute?.participants || []).filter((p) => p.participant_type === 'external' && !p.signed).map((p) => <MenuItem key={p.id} value={p.id}>{p.name} · {p.email_hint}</MenuItem>)}</TextField>
      {participant && <><TextField label="Correo de la invitación" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /><Button variant="outlined" startIcon={<Email />} disabled={!form.email} onClick={requestCode}>Enviar código de verificación</Button></>}
      {sent && <><TextField label="Código de 6 dígitos" value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })} /><TextField label="Nombre completo" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /><TextField label="Entidad" value={form.organization} onChange={(e) => setForm({ ...form, organization: e.target.value })} /><TextField label="Cargo" value={form.role_title} onChange={(e) => setForm({ ...form, role_title: e.target.value })} />
        <Box><Typography fontWeight={800} mb={1}><Draw fontSize="small" /> Dibuje su firma</Typography><canvas ref={canvasRef} width="680" height="220" style={{ width: '100%', height: 220, border: '2px dashed #94a3b8', borderRadius: 12, background: 'white', touchAction: 'none' }} /><Button size="small" onClick={() => canvasRef.current.getContext('2d').clearRect(0, 0, 680, 220)}>Limpiar</Button></Box>
        <Button size="large" variant="contained" disabled={form.otp.length !== 6 || !form.name} onClick={sign}>Confirmar y firmar esta versión</Button></>}
    </Stack>}
  </CardContent></Card></Box>;
}
