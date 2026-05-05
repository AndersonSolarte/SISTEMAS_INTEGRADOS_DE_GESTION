import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  BugReport as BugReportIcon,
  CheckCircle as CheckCircleIcon,
  Download as DownloadIcon,
  Psychology as PsychologyIcon,
  Radar as RadarIcon,
  Security as SecurityIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip as RechartsTooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { useSnackbar } from 'notistack';
import securityService from '../services/securityService';

const severityColors = {
  Critico: '#dc2626',
  Alto: '#ea580c',
  Medio: '#d97706',
  Bajo: '#2563eb',
  Informativo: '#64748b'
};

const statusColors = {
  Detectado: '#dc2626',
  'En analisis': '#7c3aed',
  'En remediacion': '#ea580c',
  Corregido: '#16a34a',
  Validado: '#0f766e',
  Cerrado: '#475569'
};

const statuses = ['Detectado', 'En analisis', 'En remediacion', 'Corregido', 'Validado', 'Cerrado'];
const severities = ['Critico', 'Alto', 'Medio', 'Bajo', 'Informativo'];
const components = ['Frontend', 'Backend', 'Base de datos', 'Dependencias', 'Infraestructura', 'Configuracion'];

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('es-CO', { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
  } catch (_error) {
    return value;
  }
};

function MetricCard({ label, value, icon, color = '#1d4ed8' }) {
  return (
    <Paper component={motion.div} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', height: '100%' }}>
      <Stack direction="row" spacing={1.3} alignItems="center">
        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: `${color}18`, color, display: 'grid', placeItems: 'center' }}>{icon}</Box>
        <Box>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography>
          <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 950 }}>{Number(value || 0).toLocaleString('es-CO')}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function ToneChip({ label, map }) {
  const color = map[label] || '#64748b';
  return <Chip size="small" label={label || '-'} sx={{ bgcolor: `${color}18`, color, border: `1px solid ${color}33`, fontWeight: 900 }} />;
}

function SecurityApplicationDashboard({ embedded = false }) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [findings, setFindings] = useState([]);
  const [scans, setScans] = useState([]);
  const [filters, setFilters] = useState({ severity: '', status: '', component: '', search: '' });
  const [selected, setSelected] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dash, rows, scanRows] = await Promise.all([
        securityService.getDashboard(),
        securityService.getFindings(filters),
        securityService.getScans()
      ]);
      setDashboard(dash.data);
      setFindings(rows.data || []);
      setScans(scanRows.data || []);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar seguridad aplicativa', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, filters]);

  useEffect(() => { loadData(); }, [loadData]);

  const bySeverity = useMemo(() => severities.map((severity) => ({
    name: severity,
    total: Number((dashboard?.bySeverity || []).find((item) => item.severity === severity)?.total || 0)
  })), [dashboard]);

  const byStatus = useMemo(() => statuses.map((status) => ({
    name: status,
    total: Number((dashboard?.byStatus || []).find((item) => item.status === status)?.total || 0)
  })), [dashboard]);

  const byComponent = useMemo(() => (dashboard?.byComponent || []).map((item) => ({ name: item.affected_component || 'Sin componente', total: Number(item.total || 0) })), [dashboard]);
  const history = useMemo(() => (dashboard?.history || []).map((item) => ({ date: String(item.date || '').slice(0, 10), total: Number(item.total || 0), critical: Number(item.critical || 0), high: Number(item.high || 0) })), [dashboard]);

  const runScan = async () => {
    setRunning(true);
    try {
      await securityService.runScan();
      enqueueSnackbar('Escaneo de vulnerabilidades finalizado', { variant: 'success' });
      await loadData();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible ejecutar el escaneo', { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const openDetail = async (finding) => {
    setProposal(null);
    try {
      const response = await securityService.getFinding(finding.id);
      setSelected(response.data);
      setDetailOpen(true);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible abrir el hallazgo', { variant: 'error' });
    }
  };

  const analyzeRemediation = async () => {
    if (!selected?.id) return;
    try {
      const response = await securityService.analyzeRemediation(selected.id);
      setProposal(response.data);
      enqueueSnackbar('Propuesta de remediacion generada', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible analizar la remediacion', { variant: 'error' });
    }
  };

  const updateStatus = async (status) => {
    if (!selected?.id) return;
    try {
      await securityService.updateStatus(selected.id, { status, comment: `Cambio de estado a ${status}` });
      enqueueSnackbar('Estado actualizado', { variant: 'success' });
      setDetailOpen(false);
      await loadData();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar estado', { variant: 'error' });
    }
  };

  return (
    <Box>
      {!embedded && (
        <Paper elevation={0} sx={{ p: 2.5, mb: 2, borderRadius: 3, color: 'white', background: 'linear-gradient(120deg, #0f172a 0%, #1d4ed8 55%, #0f766e 100%)' }}>
          <Typography variant="h5" sx={{ fontWeight: 950 }}>Gestión de Seguridad Aplicativa</Typography>
          <Typography sx={{ color: '#dbeafe' }}>Centro de control DevSecOps para monitoreo, hallazgos y remediación segura asistida.</Typography>
        </Paper>
      )}

      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 2, borderRadius: 3, color: 'white', background: 'linear-gradient(120deg, #0f172a 0%, #1d4ed8 55%, #0f766e 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <SecurityIcon />
              <Typography variant="h5" sx={{ fontWeight: 950 }}>Gestión de Seguridad Aplicativa</Typography>
            </Stack>
            <Typography sx={{ color: '#dbeafe', maxWidth: 860 }}>
              Monitoreo de vulnerabilidades y propuestas de remediación segura. El análisis no modifica archivos ni producción.
            </Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <Button variant="contained" startIcon={<RadarIcon />} disabled={running} onClick={runScan} sx={{ bgcolor: 'white', color: '#1d4ed8', fontWeight: 900, '&:hover': { bgcolor: '#eff6ff' } }}>
              {running ? 'Escaneando...' : 'Ejecutar escaneo'}
            </Button>
            <Button variant="outlined" startIcon={<DownloadIcon />} component="a" href={securityService.exportUrl()} target="_blank" sx={{ color: 'white', borderColor: 'rgba(255,255,255,.65)', fontWeight: 900 }}>
              Exportar informe
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {loading ? (
        <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
      ) : (
        <Stack spacing={2}>
          <Grid container spacing={1.5}>
            <Grid item xs={12} sm={6} md={2}><MetricCard label="Total" value={dashboard?.totalFindings} icon={<BugReportIcon />} /></Grid>
            <Grid item xs={12} sm={6} md={2}><MetricCard label="Criticas" value={dashboard?.critical} icon={<WarningAmberIcon />} color="#dc2626" /></Grid>
            <Grid item xs={12} sm={6} md={2}><MetricCard label="Altas" value={dashboard?.high} icon={<WarningAmberIcon />} color="#ea580c" /></Grid>
            <Grid item xs={12} sm={6} md={2}><MetricCard label="Corregidas" value={dashboard?.corrected} icon={<CheckCircleIcon />} color="#16a34a" /></Grid>
            <Grid item xs={12} sm={6} md={2}><MetricCard label="Pendientes" value={dashboard?.pending} icon={<AssessmentIcon />} color="#7c3aed" /></Grid>
            <Grid item xs={12} sm={6} md={2}><MetricCard label="Escaneos" value={scans.length} icon={<RadarIcon />} color="#0f766e" /></Grid>
          </Grid>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0', height: 300 }}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Hallazgos por criticidad</Typography>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={bySeverity}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {bySeverity.map((entry) => <Cell key={entry.name} fill={severityColors[entry.name]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0', height: 300 }}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Estado de hallazgos</Typography>
                <ResponsiveContainer width="100%" height={230}>
                  <PieChart>
                    <Pie data={byStatus.filter((item) => item.total > 0)} dataKey="total" nameKey="name" outerRadius={82} label>
                      {byStatus.map((entry) => <Cell key={entry.name} fill={statusColors[entry.name]} />)}
                    </Pie>
                    <RechartsTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
            <Grid item xs={12} md={4}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0', height: 300 }}>
                <Typography sx={{ fontWeight: 950, mb: 1 }}>Evolución histórica</Typography>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={history}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis allowDecimals={false} />
                    <RechartsTooltip />
                    <Line type="monotone" dataKey="total" stroke="#1d4ed8" strokeWidth={2} />
                    <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} />
                    <Line type="monotone" dataKey="high" stroke="#ea580c" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </Paper>
            </Grid>
          </Grid>

          <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mb: 1.5 }}>
              <TextField size="small" label="Buscar" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value })} fullWidth />
              <FormControl size="small" sx={{ minWidth: 160 }}>
                <InputLabel>Criticidad</InputLabel>
                <Select value={filters.severity} label="Criticidad" onChange={(event) => setFilters({ ...filters, severity: event.target.value })}>
                  <MenuItem value="">Todas</MenuItem>
                  {severities.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 180 }}>
                <InputLabel>Estado</InputLabel>
                <Select value={filters.status} label="Estado" onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
                  <MenuItem value="">Todos</MenuItem>
                  {statuses.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>
              <FormControl size="small" sx={{ minWidth: 190 }}>
                <InputLabel>Componente</InputLabel>
                <Select value={filters.component} label="Componente" onChange={(event) => setFilters({ ...filters, component: event.target.value })}>
                  <MenuItem value="">Todos</MenuItem>
                  {components.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 950 }}>ID</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Vulnerabilidad</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Criticidad</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Estado</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Componente</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Archivo</TableCell>
                    <TableCell sx={{ fontWeight: 950 }}>Detectado</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 950 }}>Acción</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {findings.map((finding) => (
                    <TableRow key={finding.id} hover>
                      <TableCell>{finding.finding_code}</TableCell>
                      <TableCell sx={{ maxWidth: 310 }}><Typography sx={{ fontWeight: 850 }}>{finding.title}</Typography></TableCell>
                      <TableCell><ToneChip label={finding.severity} map={severityColors} /></TableCell>
                      <TableCell><ToneChip label={finding.status} map={statusColors} /></TableCell>
                      <TableCell>{finding.affected_component}</TableCell>
                      <TableCell sx={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{finding.affected_file || '-'}</TableCell>
                      <TableCell>{formatDate(finding.detected_at)}</TableCell>
                      <TableCell align="center"><Button size="small" onClick={() => openDetail(finding)}>Ver detalle</Button></TableCell>
                    </TableRow>
                  ))}
                  {!findings.length && <TableRow><TableCell colSpan={8}><Alert severity="info">No hay hallazgos para los filtros seleccionados.</Alert></TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>

          {byComponent.length > 0 && (
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontWeight: 950, mb: 1 }}>Hallazgos por componente</Typography>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={byComponent}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis allowDecimals={false} />
                  <RechartsTooltip />
                  <Bar dataKey="total" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
          )}
        </Stack>
      )}

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 950 }}>Detalle del hallazgo</DialogTitle>
        <DialogContent dividers>
          {selected && (
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between">
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 950 }}>{selected.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>{selected.finding_code}</Typography>
                </Box>
                <Stack direction="row" spacing={1}><ToneChip label={selected.severity} map={severityColors} /><ToneChip label={selected.status} map={statusColors} /></Stack>
              </Stack>
              <Alert severity="info">{selected.description}</Alert>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}><Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}><Typography sx={{ fontWeight: 900 }}>Archivo afectado</Typography><Typography>{selected.affected_file || '-'} {selected.affected_line ? `:${selected.affected_line}` : ''}</Typography></Paper></Grid>
                <Grid item xs={12} md={6}><Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2 }}><Typography sx={{ fontWeight: 900 }}>Recomendación</Typography><Typography>{selected.recommendation || '-'}</Typography></Paper></Grid>
              </Grid>
              <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, bgcolor: '#0f172a', color: '#e2e8f0' }}>
                <Typography sx={{ fontWeight: 900, mb: 1, color: 'white' }}>Evidencia técnica</Typography>
                <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 12 }}>{selected.evidence || 'Sin evidencia registrada'}</Box>
              </Paper>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="contained" startIcon={<PsychologyIcon />} onClick={analyzeRemediation}>Analizar corrección segura</Button>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                  <InputLabel>Cambiar estado</InputLabel>
                  <Select value={selected.status || ''} label="Cambiar estado" onChange={(event) => updateStatus(event.target.value)}>
                    {statuses.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Stack>
              {(proposal || selected.remediationProposals?.[0]) && (
                <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #bfdbfe', borderRadius: 2, bgcolor: '#f8fbff' }}>
                  {(() => {
                    const item = proposal || selected.remediationProposals[0];
                    return (
                      <Stack spacing={1}>
                        <Typography sx={{ fontWeight: 950 }}>Propuesta de remediación segura</Typography>
                        <Typography>{item.explanation}</Typography>
                        <Grid container spacing={1.2}>
                          <Grid item xs={12} md={6}><Typography sx={{ fontWeight: 900 }}>Código actual</Typography><Box component="pre" sx={{ p: 1, bgcolor: '#0f172a', color: '#e2e8f0', borderRadius: 1.5, overflow: 'auto', fontSize: 12 }}>{item.current_code || '-'}</Box></Grid>
                          <Grid item xs={12} md={6}><Typography sx={{ fontWeight: 900 }}>Código propuesto</Typography><Box component="pre" sx={{ p: 1, bgcolor: '#0f172a', color: '#d1fae5', borderRadius: 1.5, overflow: 'auto', fontSize: 12 }}>{item.proposed_code || '-'}</Box></Grid>
                        </Grid>
                        <Typography><strong>Riesgo mitigado:</strong> {item.risk_mitigated}</Typography>
                        <Typography><strong>Impacto funcional:</strong> {item.functional_impact}</Typography>
                        <Typography><strong>Pruebas recomendadas:</strong> {(item.recommended_tests || []).join(' | ')}</Typography>
                      </Stack>
                    );
                  })()}
                </Paper>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailOpen(false)}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SecurityApplicationDashboard;
