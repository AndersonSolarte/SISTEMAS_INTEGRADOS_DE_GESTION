import React, { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Paper, Stack, Typography } from '@mui/material';
import { CheckCircle, EventAvailable } from '@mui/icons-material';
import { useParams } from 'react-router-dom';
import meetingMinuteService from '../services/meetingMinuteService';

export default function MeetingAttendanceConfirmation() {
  const { token } = useParams();
  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    const registerPresence = async () => {
      try {
        const response = await meetingMinuteService.attendanceInvitation(token);
        if (!active) return;
        const invitationData = response.data;
        setInvitation(invitationData);
        if (invitationData?.status === 'present') {
          setConfirmed(true);
          return;
        }
        if (invitationData?.expired) return;
        await meetingMinuteService.confirmAttendance(token);
        if (active) setConfirmed(true);
      } catch (requestError) {
        if (active) setError(requestError.response?.data?.message || 'No fue posible registrar la asistencia.');
      } finally {
        if (active) setLoading(false);
      }
    };
    registerPresence();
    return () => { active = false; };
  }, [token]);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#eef4ff', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper elevation={8} sx={{ width: '100%', maxWidth: 620, borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ p: 3, color: '#fff', background: 'linear-gradient(120deg,#173b84,#2563eb)' }}>
          <Stack direction="row" gap={1.5} alignItems="center">
            <EventAvailable sx={{ fontSize: 38 }} />
            <Box>
              <Typography variant="h5" fontWeight={950}>Confirmación de asistencia</Typography>
              <Typography sx={{ opacity: 0.9 }}>Acta de Consejo o Comité</Typography>
            </Box>
          </Stack>
        </Box>
        <Box sx={{ p: 3 }}>
          {loading ? (
            <Stack alignItems="center" py={5}><CircularProgress /></Stack>
          ) : error && !invitation ? (
            <Alert severity="error">{error}</Alert>
          ) : (
            <Stack gap={2}>
              <Typography>Estimado(a) <strong>{invitation?.name}</strong>:</Typography>
              <Typography color="text.secondary">El enlace personal registró su respuesta directamente. Esta acción no significa que deba firmar el acta.</Typography>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f8fafc' }}>
                <Typography fontWeight={900}>{invitation?.council || 'Consejo o Comité'}</Typography>
                <Typography variant="body2" color="text.secondary">{invitation?.date} · {invitation?.time}</Typography>
                <Typography variant="body2" color="text.secondary">{invitation?.place}</Typography>
              </Paper>
              {error ? (
                <Alert severity="error">{error}</Alert>
              ) : confirmed ? (
                <Alert icon={<CheckCircle />} severity="success" sx={{ fontWeight: 800 }}>Su asistencia quedó registrada como PRESENTE.</Alert>
              ) : invitation?.expired ? (
                <Alert severity="warning">Esta invitación ya venció. Comuníquese con el responsable del acta.</Alert>
              ) : (
                <Alert severity="info">Registrando asistencia…</Alert>
              )}
            </Stack>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
