import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Grid, LinearProgress, Paper, Stack,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography
} from '@mui/material';
import {
  AssignmentTurnedIn, DeleteOutline, Description, Drafts, Group, HowToReg,
  Refresh, Send, TaskAlt
} from '@mui/icons-material';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip as ChartTooltip, XAxis, YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';

const STATUS = {
  draft: { label: 'Borrador', color: '#64748b', soft: '#f1f5f9' },
  signing: { label: 'En firmas', color: '#d97706', soft: '#fffbeb' },
  signed: { label: 'Firmada', color: '#16a34a', soft: '#f0fdf4' },
  distributed: { label: 'Enviada', color: '#2563eb', soft: '#eff6ff' },
  deleted: { label: 'Eliminada', color: '#dc2626', soft: '#fef2f2' }
};

const emptyData = {
  retention_days: 30,
  summary: {
    total: 0, active: 0, deleted: 0, draft: 0, signing: 0, signed: 0,
    distributed: 0, completed: 0, participants: 0, signed_participants: 0,
    pending_participants: 0, signature_progress: 0
  },
  by_status: [],
  trend: [],
  by_dependency: [],
  recent: []
};

const displayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Sin fecha';
};

const MetricCard = ({ label, value, icon, color, soft, detail }) => (
  <Paper elevation={0} sx={{ p: 2.2, height: '100%', borderRadius: 3, border: `1px solid ${color}28`, bgcolor: soft }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <Box>
        <Typography variant="caption" sx={{ color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: .45 }}>{label}</Typography>
        <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 950, mt: .35 }}>{value}</Typography>
        {detail && <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>{detail}</Typography>}
      </Box>
      <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', color, bgcolor: '#fff', border: `1px solid ${color}28` }}>{icon}</Box>
    </Stack>
  </Paper>
);

export default function MeetingMinuteStatisticsDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await meetingMinuteService.getStatistics();
      setData(response.data || emptyData);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las estadísticas de actas.', { variant: 'error' });
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const statusData = useMemo(() => (data.by_status || []).map((item) => ({
    ...item,
    color: STATUS[item.status]?.color || '#64748b'
  })), [data.by_status]);
  const summary = data.summary || emptyData.summary;

  if (loading && !summary.total) {
    return <Paper elevation={0} sx={{ p: 7, border: '1px solid #dbeafe', borderRadius: 3, textAlign: 'center' }}><CircularProgress /><Typography sx={{ mt: 2, color: '#64748b' }}>Calculando estadísticas de actas…</Typography></Paper>;
  }

  return (
    <Stack spacing={2.5}>
      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg,#0f172a 0%,#1d4ed8 55%,#0f766e 100%)', position: 'relative', overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} sx={{ position: 'relative', zIndex: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 950 }}>Estadísticas de formatos</Typography>
            <Typography sx={{ mt: .6, color: 'rgba(255,255,255,.86)' }}>Consolidado general del formato Registro de Asistencia y Reunión.</Typography>
          </Box>
          <Button variant="outlined" startIcon={loading ? <CircularProgress size={17} color="inherit" /> : <Refresh />} onClick={load} disabled={loading} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.6)', fontWeight: 850, textTransform: 'none' }}>Actualizar</Button>
        </Stack>
      </Paper>

      <Alert severity="info">Las cifras corresponden a las actas existentes durante el periodo de conservación de {data.retention_days || 30} días.</Alert>

      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Total general" value={summary.total} icon={<Description />} color="#1d4ed8" soft="#eff6ff" detail={`${summary.active} activas`} /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Borradores" value={summary.draft} icon={<Drafts />} color="#64748b" soft="#f8fafc" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="En firmas" value={summary.signing} icon={<HowToReg />} color="#d97706" soft="#fffbeb" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Firmadas / aprobadas" value={summary.completed} icon={<TaskAlt />} color="#16a34a" soft="#f0fdf4" detail={`${summary.distributed} enviadas`} /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Firmadas" value={summary.signed} icon={<AssignmentTurnedIn />} color="#15803d" soft="#f0fdf4" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Enviadas" value={summary.distributed} icon={<Send />} color="#2563eb" soft="#eff6ff" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Eliminadas" value={summary.deleted} icon={<DeleteOutline />} color="#dc2626" soft="#fef2f2" /></Grid>
        <Grid item xs={12} sm={6} lg={3}><MetricCard label="Participantes" value={summary.participants} icon={<Group />} color="#7c3aed" soft="#f5f3ff" detail={`${summary.signed_participants} firmas registradas`} /></Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbeafe' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={1}>
          <Box><Typography fontWeight={950} color="#0f172a">Avance general de firmas</Typography><Typography variant="body2" color="text.secondary">{summary.signed_participants} firmadas · {summary.pending_participants} pendientes</Typography></Box>
          <Typography variant="h5" fontWeight={950} color="#1d4ed8">{summary.signature_progress}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={summary.signature_progress} sx={{ height: 12, borderRadius: 99 }} />
      </Paper>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={5}>
          <Paper elevation={0} sx={{ p: 2.5, height: 390, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography fontWeight={950} mb={2}>Actas por estado</Typography>
            <ResponsiveContainer width="100%" height="88%">
              <PieChart><Pie data={statusData} dataKey="total" nameKey="label" innerRadius={65} outerRadius={105} paddingAngle={3} label={({ name, value }) => `${name}: ${value}`}>{statusData.map((item) => <Cell key={item.status} fill={item.color} />)}</Pie><ChartTooltip /></PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12} lg={7}>
          <Paper elevation={0} sx={{ p: 2.5, height: 390, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography fontWeight={950} mb={2}>Actas creadas por día</Typography>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={data.trend || []}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="date" tickFormatter={(value) => value.slice(5)} fontSize={11} /><YAxis allowDecimals={false} fontSize={11} /><ChartTooltip labelFormatter={displayDate} /><Bar dataKey="total" name="Actas" fill="#2563eb" radius={[5, 5, 0, 0]} /></BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ p: 2.5, height: 390, borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Typography fontWeight={950} mb={2}>Dependencias con más actas</Typography>
            <ResponsiveContainer width="100%" height="88%">
              <BarChart data={data.by_dependency || []} layout="vertical" margin={{ left: 20, right: 30 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" allowDecimals={false} /><YAxis type="category" dataKey="name" width={220} tick={{ fontSize: 11 }} /><ChartTooltip /><Bar dataKey="total" name="Actas" fill="#0f766e" radius={[0, 6, 6, 0]} /></BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Typography fontWeight={950} mb={2}>Actas más recientes</Typography>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ fontWeight: 900 }}>Acta</TableCell><TableCell sx={{ fontWeight: 900 }}>Fecha</TableCell><TableCell sx={{ fontWeight: 900 }}>Estado</TableCell><TableCell sx={{ fontWeight: 900 }}>Creador</TableCell><TableCell sx={{ fontWeight: 900 }}>Firmas</TableCell></TableRow></TableHead>
            <TableBody>
              {(data.recent || []).map((row) => {
                const status = STATUS[row.status] || STATUS.draft;
                return <TableRow key={row.id} hover><TableCell><Typography fontSize={13} fontWeight={850}>{row.title}</Typography><Typography variant="caption" color="text.secondary">{row.code}</Typography></TableCell><TableCell>{displayDate(row.meeting_date || row.created_at)}</TableCell><TableCell><Chip size="small" label={status.label} sx={{ fontWeight: 800, color: status.color, bgcolor: status.soft }} /></TableCell><TableCell>{row.creator || 'Sin información'}</TableCell><TableCell>{row.signed_participants} de {row.participants}</TableCell></TableRow>;
              })}
              {!data.recent?.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay actas registradas en el periodo actual.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
