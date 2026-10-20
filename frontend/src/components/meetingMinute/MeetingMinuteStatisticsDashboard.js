import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, Grid, InputLabel,
  LinearProgress, MenuItem, Paper, Select, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Typography
} from '@mui/material';
import {
  Archive, ArrowBack, Assessment, Description, Drafts, HowToReg, Refresh,
  TaskAlt, Visibility
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import meetingMinuteService from '../../services/meetingMinuteService';

const MEETING_MINUTES_FORMAT = 'meeting_minutes';

const STATUS = {
  draft: { label: 'Borrador', color: '#64748b', soft: '#f1f5f9' },
  signing: { label: 'En firmas', color: '#d97706', soft: '#fffbeb' },
  signed: { label: 'Firmada', color: '#16a34a', soft: '#f0fdf4' },
  distributed: { label: 'Enviada', color: '#2563eb', soft: '#eff6ff' },
  deleted: { label: 'Eliminada', color: '#dc2626', soft: '#fef2f2' }
};

const emptyData = {
  retention_days: 30,
  available_years: [],
  selected_year: null,
  summary: {
    total: 0, active: 0, archived: 0, deleted: 0, draft: 0, signing: 0, signed: 0,
    distributed: 0, completed: 0, participants: 0, signed_participants: 0,
    pending_participants: 0, signature_progress: 0
  },
  by_status: [],
  trend: [],
  archive: [],
  recent: []
};

const displayDate = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : 'Sin fecha';
};

const MetricCard = ({ label, value, icon, color, soft, detail }) => (
  <Paper elevation={0} sx={{ p: 1.8, height: '100%', borderRadius: 3, border: `1px solid ${color}28`, bgcolor: soft }}>
    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
      <Box>
        <Typography variant="caption" sx={{ color, fontWeight: 900, textTransform: 'uppercase', letterSpacing: .4 }}>{label}</Typography>
        <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 950, mt: .25 }}>{value}</Typography>
        {detail && <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>{detail}</Typography>}
      </Box>
      <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', color, bgcolor: '#fff', border: `1px solid ${color}28` }}>{icon}</Box>
    </Stack>
  </Paper>
);

export default function MeetingMinuteStatisticsDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [selectedFormat, setSelectedFormat] = useState(null);
  const [selectedYear, setSelectedYear] = useState('');
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(false);
  const [consultingId, setConsultingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await meetingMinuteService.getStatistics(selectedYear);
      setData(response.data || emptyData);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las estadísticas de actas.', { variant: 'error' });
      setData(emptyData);
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, selectedYear]);

  useEffect(() => {
    if (selectedFormat === MEETING_MINUTES_FORMAT) load();
  }, [load, selectedFormat]);

  const summary = data.summary || emptyData.summary;

  const consultArchivedMinute = async (row) => {
    setConsultingId(row.id);
    try {
      const blob = await meetingMinuteService.downloadArchivedPdf(row.id);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.click();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible consultar el acta archivada.', { variant: 'error' });
    } finally {
      setConsultingId(null);
    }
  };

  if (!selectedFormat) {
    return (
      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg,#0f172a 0%,#1d4ed8 62%,#0f766e 100%)' }}>
          <Typography variant="h4" sx={{ fontWeight: 950 }}>Estadísticas de formatos</Typography>
          <Typography sx={{ mt: .5, color: 'rgba(255,255,255,.86)' }}>Selecciona un formato para consultar su información.</Typography>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12} md={7} lg={5}>
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #bfdbfe', bgcolor: '#fff', height: '100%' }}>
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <Box sx={{ width: 52, height: 52, flexShrink: 0, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: '#1d4ed8', bgcolor: '#eff6ff' }}>
                  <Assessment />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Chip size="small" label="COM-ID-FR-002 · ACTAS" sx={{ mb: 1, color: '#1d4ed8', bgcolor: '#eff6ff', fontWeight: 850 }} />
                  <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 950 }}>Registro de Asistencia y Reunión</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>Resumen de actas, estados, firmas y actividad reciente.</Typography>
                  <Button variant="contained" onClick={() => setSelectedFormat(MEETING_MINUTES_FORMAT)} sx={{ textTransform: 'none', fontWeight: 850, borderRadius: 2 }}>Ver estadísticas</Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    );
  }

  if (loading && !summary.total) {
    return <Paper elevation={0} sx={{ p: 7, border: '1px solid #dbeafe', borderRadius: 3, textAlign: 'center' }}><CircularProgress /><Typography sx={{ mt: 2, color: '#64748b' }}>Calculando estadísticas de actas…</Typography></Paper>;
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: { xs: 2.2, md: 2.7 }, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg,#0f172a 0%,#1d4ed8 62%,#0f766e 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button variant="outlined" aria-label="Volver a formatos" onClick={() => setSelectedFormat(null)} sx={{ minWidth: 42, width: 42, height: 42, p: 0, color: '#fff', borderColor: 'rgba(255,255,255,.55)' }}><ArrowBack /></Button>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>Registro de Asistencia y Reunión</Typography>
              <Typography variant="body2" sx={{ mt: .2, color: 'rgba(255,255,255,.82)' }}>COM-ID-FR-002 · Estadísticas de actas</Typography>
            </Box>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2}>
            <FormControl size="small" sx={{ minWidth: 170, bgcolor: '#fff', borderRadius: 2 }}>
              <InputLabel id="meeting-minute-year-label">Año</InputLabel>
              <Select labelId="meeting-minute-year-label" value={selectedYear} label="Año" onChange={(event) => setSelectedYear(event.target.value)}>
                <MenuItem value="">Todos los años</MenuItem>
                {(data.available_years || []).map((year) => <MenuItem key={year} value={year}>{year}</MenuItem>)}
              </Select>
            </FormControl>
            <Button variant="outlined" startIcon={loading ? <CircularProgress size={17} color="inherit" /> : <Refresh />} onClick={load} disabled={loading} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.6)', fontWeight: 850, textTransform: 'none' }}>Actualizar</Button>
          </Stack>
        </Stack>
      </Paper>

      <Alert severity="info">Las actas se retiran de “Mis actas” después de {data.retention_days || 30} días, pero permanecen en este archivo histórico y sus estadísticas siguen acumulándose.</Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(5, minmax(0, 1fr))' }, gap: 1.5, width: '100%' }}>
        <MetricCard label="Total general" value={summary.total} icon={<Description />} color="#1d4ed8" soft="#eff6ff" detail={`${summary.active} activas`} />
        <MetricCard label="Borradores" value={summary.draft} icon={<Drafts />} color="#64748b" soft="#f8fafc" />
        <MetricCard label="En firmas" value={summary.signing} icon={<HowToReg />} color="#d97706" soft="#fffbeb" />
        <MetricCard label="Firmadas / aprobadas" value={summary.completed} icon={<TaskAlt />} color="#16a34a" soft="#f0fdf4" detail={`${summary.distributed} enviadas`} />
        <MetricCard label="Archivadas" value={summary.archived} icon={<Archive />} color="#7c3aed" soft="#f5f3ff" detail="Fuera de la vista operativa" />
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbeafe' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" gap={2} mb={1}>
          <Box><Typography fontWeight={950} color="#0f172a">Avance de firmas</Typography><Typography variant="body2" color="text.secondary">{summary.signed_participants} firmadas · {summary.pending_participants} pendientes · {summary.participants} participantes</Typography></Box>
          <Typography variant="h5" fontWeight={950} color="#1d4ed8">{summary.signature_progress}%</Typography>
        </Stack>
        <LinearProgress variant="determinate" value={summary.signature_progress} sx={{ height: 10, borderRadius: 99 }} />
      </Paper>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1} mb={1.5}>
          <Box>
            <Typography fontWeight={950}>Control de archivo de actas</Typography>
            <Typography variant="body2" color="text.secondary">Inventario histórico de datos. El acta se genera desde la plantilla únicamente cuando se consulta.</Typography>
          </Box>
          <Chip label={`${(data.archive || []).length} documento(s)`} sx={{ alignSelf: { xs: 'flex-start', md: 'center' }, fontWeight: 850 }} />
        </Stack>
        <TableContainer>
          <Table size="small">
            <TableHead><TableRow><TableCell sx={{ fontWeight: 900 }}>Documento</TableCell><TableCell sx={{ fontWeight: 900 }}>Fecha</TableCell><TableCell sx={{ fontWeight: 900 }}>Estado</TableCell><TableCell sx={{ fontWeight: 900 }}>Responsable / dependencia</TableCell><TableCell sx={{ fontWeight: 900 }}>Firmas</TableCell><TableCell sx={{ fontWeight: 900 }}>Registro</TableCell><TableCell align="right" sx={{ fontWeight: 900 }}>Consulta</TableCell></TableRow></TableHead>
            <TableBody>
              {(data.archive || []).map((row) => {
                const status = STATUS[row.status] || STATUS.draft;
                const lifecycle = row.lifecycle === 'archived'
                  ? { label: 'Archivada', color: '#7c3aed', soft: '#f5f3ff' }
                  : row.lifecycle === 'deleted'
                    ? { label: 'Retirada', color: '#dc2626', soft: '#fef2f2' }
                    : { label: 'Operativa', color: '#0284c7', soft: '#f0f9ff' };
                return <TableRow key={row.id} hover><TableCell><Typography fontSize={13} fontWeight={850}>{row.title}</Typography><Typography variant="caption" color="text.secondary">{row.code}</Typography></TableCell><TableCell>{displayDate(row.meeting_date || row.created_at)}</TableCell><TableCell><Stack spacing={.5} alignItems="flex-start"><Chip size="small" label={status.label} sx={{ fontWeight: 800, color: status.color, bgcolor: status.soft }} /><Chip size="small" label={lifecycle.label} sx={{ fontWeight: 800, color: lifecycle.color, bgcolor: lifecycle.soft }} /></Stack></TableCell><TableCell><Typography variant="body2">{row.creator || 'Sin información'}</Typography><Typography variant="caption" color="text.secondary">{row.dependency}</Typography></TableCell><TableCell>{row.signed_participants} de {row.participants}</TableCell><TableCell><Typography variant="caption" sx={{ color: '#475569' }}>{row.archive_location}</Typography></TableCell><TableCell align="right"><Button size="small" startIcon={consultingId === row.id ? <CircularProgress size={15} /> : <Visibility />} onClick={() => consultArchivedMinute(row)} disabled={Boolean(consultingId)} sx={{ textTransform: 'none', fontWeight: 850, whiteSpace: 'nowrap' }}>Ver acta</Button></TableCell></TableRow>;
              })}
              {!data.archive?.length && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>No hay actas registradas para el periodo seleccionado.</TableCell></TableRow>}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Stack>
  );
}
