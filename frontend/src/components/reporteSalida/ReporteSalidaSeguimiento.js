import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Fade,
  MenuItem,
  Paper,
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
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import RefreshIcon from '@mui/icons-material/Refresh';
import reporteSalidaService from '../../services/reporteSalidaService';

const ACCESS_COPY = {
  gestion_humana: {
    title: 'Reporte de salida',
    subtitle: 'Seguimiento de aprobaciones, notificaciones y reposicion de tiempo.',
    notice: 'Vista completa para Gestion Humana. Puedes validar reposiciones cuando el reporte este finalizado.'
  },
  jefe: {
    title: 'Reposiciones de mi equipo',
    subtitle: 'Colaboradores a cargo con horas pendientes por reponer.',
    notice: 'Puedes consultar el saldo pendiente de tus colaboradores. La validacion final la realiza Talento Humano.'
  },
  jefe_y_colaborador: {
    title: 'Reposiciones pendientes',
    subtitle: 'Tus pendientes y los pendientes de colaboradores a cargo.',
    notice: 'Consulta los saldos pendientes. Talento Humano descuenta horas unicamente cuando valida la reposicion.'
  },
  colaborador: {
    title: 'Mis reposiciones pendientes',
    subtitle: 'Consulta tus horas pendientes por reponer y el estado de validacion.',
    notice: 'Esta vista es solo informativa. No permite modificar, aprobar ni validar solicitudes.'
  },
  sin_pendientes: {
    title: 'Seguimiento a reportes',
    subtitle: 'No tienes reposiciones pendientes por gestionar.',
    notice: 'Cuando exista una reposicion pendiente, el modulo aparecera automaticamente.'
  }
};

const STATUS_LABELS = {
  pendiente_aprobacion_jefe: 'Pendiente jefe',
  aprobada_jefe: 'Aprobada jefe',
  pendiente_aprobacion_gestion_humana: 'Pendiente Gestion Humana',
  aprobada_gestion_humana: 'Aprobada Gestion Humana',
  finalizada: 'Finalizada',
  no_aprobada: 'No aprobada'
};

const STATUS_COLORS = {
  pendiente_aprobacion_jefe: { bg: '#fef3c7', color: '#92400e' },
  aprobada_jefe: { bg: '#dbeafe', color: '#1d4ed8' },
  pendiente_aprobacion_gestion_humana: { bg: '#ede9fe', color: '#6d28d9' },
  aprobada_gestion_humana: { bg: '#dcfce7', color: '#166534' },
  finalizada: { bg: '#dcfce7', color: '#166534' },
  no_aprobada: { bg: '#fee2e2', color: '#991b1b' }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' });
};

const minutesBetween = (start, end) => {
  if (!start || !end) return null;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime()) || b < a) return null;
  return Math.round((b.getTime() - a.getTime()) / 60000);
};

const formatElapsed = (minutes) => {
  const total = Number(minutes);
  if (!Number.isFinite(total)) return '-';
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const REPORT_MODULES = [
  {
    key: 'reporte_salida',
    label: 'Reporte de salida',
    description: 'Radicaciones FR-002, aprobaciones y reposicion de tiempo.',
    icon: AssignmentTurnedInIcon,
    available: true
  },
  {
    key: 'permisos',
    label: 'Permisos',
    description: 'Control de permisos administrativos y trazabilidad.',
    icon: PendingActionsIcon,
    available: false
  },
  {
    key: 'incapacidades',
    label: 'Incapacidades',
    description: 'Soportes, novedades y seguimiento por colaborador.',
    icon: EventRepeatIcon,
    available: false
  },
  {
    key: 'aprobaciones',
    label: 'Aprobaciones generales',
    description: 'Consolidado de flujos pendientes y finalizados.',
    icon: FactCheckIcon,
    available: false
  }
];

function ReporteSalidaSeguimiento({ initialAccess = null, onBack }) {
  const [activeModule, setActiveModule] = useState('reporte_salida');
  const [rows, setRows] = useState([]);
  const [access, setAccess] = useState(initialAccess);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState('');
  const [updatingReposicionId, setUpdatingReposicionId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reporteSalidaService.getSeguimiento({ page: 1, limit: 50, estado });
      setAccess(response?.data?.access || null);
      setRows(response?.data?.solicitudes || []);
    } finally {
      setLoading(false);
    }
  }, [estado]);

  useEffect(() => {
    if (activeModule === 'reporte_salida') load();
  }, [activeModule, load]);

  const summary = useMemo(() => {
    const total = rows.length;
    const pendientes = rows.filter((r) => ['pendiente_aprobacion_jefe', 'pendiente_aprobacion_gestion_humana'].includes(r.estado)).length;
    const personales = rows.filter((r) => r.reposicion_aplica).length;
    const reposicionesValidadas = rows.filter((r) => r.reposicion_estado === 'cumplida').length;
    const finalizadas = rows.filter((r) => r.estado === 'finalizada').length;
    return { total, pendientes, personales, reposicionesValidadas, finalizadas };
  }, [rows]);

  const accessMode = access?.mode || 'sin_pendientes';
  const copy = ACCESS_COPY[accessMode] || ACCESS_COPY.sin_pendientes;
  const canValidateReposicion = Boolean(access?.canValidateReposicion);
  const showEstadoFilter = Boolean(access?.canManageAll);

  const updateReposicion = async (row, nextEstado) => {
    if (!canValidateReposicion) return;
    setUpdatingReposicionId(row.id);
    setActionMessage('');
    try {
      const response = await reporteSalidaService.actualizarReposicion(row.id, {
        estado: nextEstado,
        observacion: nextEstado === 'cumplida'
          ? 'Tiempo repuesto validado desde seguimiento de reportes.'
          : nextEstado === 'incumplida'
            ? 'Reposicion marcada como incumplida desde seguimiento de reportes.'
            : 'Reposicion marcada como pendiente/programada desde seguimiento de reportes.'
      });
      const updated = response?.data;
      if (updated) {
        setRows((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      setActionMessage(response?.message || 'Seguimiento actualizado.');
    } catch (error) {
      setActionMessage(error?.response?.data?.message || 'No se pudo actualizar la reposicion.');
    } finally {
      setUpdatingReposicionId(null);
    }
  };

  return (
    <Fade in timeout={250}>
      <Box>
        <Paper elevation={0} sx={{ p: 1.4, mb: 2.5, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between">
            <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onBack}>Volver a Recurso Humano</Button>
            {activeModule === 'reporte_salida' && (
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={load} disabled={loading}>Actualizar</Button>
            )}
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 4, bgcolor: '#fff', mb: 2.2, overflow: 'hidden' }}>
          <Box sx={{ p: { xs: 2, md: 2.6 }, borderBottom: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: { xs: 24, md: 28 } }}>Seguimiento a reportes</Typography>
            <Typography sx={{ color: '#475569', mt: 0.5 }}>Centro de control para solicitudes, aprobaciones y horas pendientes por reponer.</Typography>
          </Box>

          <Box sx={{ px: { xs: 1.2, md: 1.6 }, py: 1.2, bgcolor: '#f8fbff', borderBottom: '1px solid #e2e8f0', overflowX: 'auto' }}>
            <Stack direction="row" spacing={1.1} sx={{ minWidth: 'max-content' }}>
              {REPORT_MODULES.map((module) => {
                const Icon = module.icon;
                const active = activeModule === module.key;
                return (
                  <Button
                    key={module.key}
                    onClick={() => module.available && setActiveModule(module.key)}
                    disabled={!module.available}
                    startIcon={<Icon />}
                    sx={{
                      minWidth: 220,
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      textAlign: 'left',
                      borderRadius: 2,
                      px: 1.5,
                      py: 1.2,
                      border: `1px solid ${active ? '#2563eb' : '#dbe6f5'}`,
                      bgcolor: active ? '#eff6ff' : '#fff',
                      color: active ? '#1d4ed8' : '#334155',
                      opacity: module.available ? 1 : 0.72,
                      textTransform: 'none',
                      '&:hover': { bgcolor: module.available ? '#eef4ff' : '#fff' },
                      '& .MuiButton-startIcon': { color: active ? '#2563eb' : '#64748b' }
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 950, fontSize: 13, lineHeight: 1.1 }}>{module.label}</Typography>
                      <Typography sx={{ color: active ? '#1d4ed8' : '#64748b', fontSize: 11, mt: 0.4, lineHeight: 1.2 }}>
                        {module.available ? 'Disponible' : 'Proximamente'}
                      </Typography>
                    </Box>
                  </Button>
                );
              })}
            </Stack>
          </Box>

          <Box sx={{ p: { xs: 2, md: 2.4 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }}>
              <Box>
                <Typography sx={{ fontWeight: 950, fontSize: 24, color: '#0f172a' }}>{copy.title}</Typography>
                <Typography sx={{ color: '#64748b' }}>{copy.subtitle}</Typography>
              </Box>
              {showEstadoFilter && (
                <TextField select size="small" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} sx={{ minWidth: { xs: '100%', md: 260 } }}>
                  <MenuItem value="">Todos</MenuItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
                </TextField>
              )}
            </Stack>
            <Alert sx={{ mt: 1.5 }} severity={access?.canView ? 'info' : 'success'}>{copy.notice}</Alert>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 1.8 }}>
              {[
                ['Solicitudes', summary.total],
                ['Pendientes', summary.pendientes],
                ['Diligencia personal', summary.personales],
                ['Reposiciones validadas', summary.reposicionesValidadas],
                ['Finalizadas', summary.finalizadas]
              ].map(([label, value]) => (
                <Box key={label} sx={{ px: 1.4, py: 1, border: '1px solid #e2e8f0', borderRadius: 2, minWidth: 150, bgcolor: '#fff' }}>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography>
                  <Typography sx={{ color: '#1d4ed8', fontSize: 24, fontWeight: 950 }}>{value}</Typography>
                </Box>
              ))}
            </Stack>
            {actionMessage && <Alert sx={{ mt: 1.5 }} severity={actionMessage.includes('No se pudo') ? 'error' : 'success'}>{actionMessage}</Alert>}
          </Box>
        </Paper>

        {activeModule !== 'reporte_salida' ? (
          <Paper elevation={0} sx={{ p: 3, border: '1px dashed #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}>
            <Chip size="small" label="Proximamente" sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 900, mb: 1.2 }} />
            <Typography sx={{ fontWeight: 950, fontSize: 22, color: '#0f172a' }}>
              {REPORT_MODULES.find((item) => item.key === activeModule)?.label}
            </Typography>
            <Typography sx={{ color: '#64748b', mt: 0.5 }}>
              Este espacio queda preparado para agregar nuevos reportes sin cambiar la arquitectura de la pantalla.
            </Typography>
          </Paper>
        ) : (
          <>
            <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Solicitud', 'Colaborador', 'Jefe inmediato', 'Radicacion', 'Estado', 'Tiempo jefe', 'Tiempo GH', 'Reposicion', canValidateReposicion ? 'Validacion GH' : 'Seguimiento'].map((label) => (
                        <TableCell key={label} sx={{ bgcolor: '#f8fafc', fontWeight: 950, color: '#334155' }}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
                    ) : rows.length === 0 ? (
                      <TableRow><TableCell colSpan={9} sx={{ py: 3 }}><Alert severity="info">No hay solicitudes para el filtro seleccionado.</Alert></TableCell></TableRow>
                    ) : rows.map((row) => {
                      const statusSx = STATUS_COLORS[row.estado] || { bg: '#f1f5f9', color: '#475569' };
                      const jefeMinutes = minutesBetween(row.created_at, row.jefe_aprobado_at || new Date());
                      const ghMinutes = row.jefe_aprobado_at ? minutesBetween(row.jefe_aprobado_at, row.gestion_humana_aprobado_at || new Date()) : null;
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 900, color: '#1d4ed8' }}>{row.consecutivo}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{row.solicitante?.nombre}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{row.solicitante?.username}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.jefe?.nombre}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{row.jefe?.email}</Typography>
                          </TableCell>
                          <TableCell>{formatDateTime(row.created_at)}</TableCell>
                          <TableCell><Chip size="small" label={STATUS_LABELS[row.estado] || row.estado} sx={{ bgcolor: statusSx.bg, color: statusSx.color, fontWeight: 900 }} /></TableCell>
                          <TableCell>{formatElapsed(jefeMinutes)}</TableCell>
                          <TableCell>{formatElapsed(ghMinutes)}</TableCell>
                          <TableCell>
                            {row.reposicion_aplica ? (
                              <Stack spacing={0.3}>
                                <Chip size="small" label={row.reposicion_estado} sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 800 }} />
                                <Typography sx={{ color: '#64748b', fontSize: 12 }}>{row.reposicionLabel}</Typography>
                              </Stack>
                            ) : 'No aplica'}
                          </TableCell>
                          <TableCell>
                            {row.reposicion_aplica ? (
                              canValidateReposicion ? (
                                <Stack direction="row" spacing={0.7} alignItems="center">
                                  <Checkbox
                                    size="small"
                                    checked={row.reposicion_estado === 'cumplida'}
                                    disabled={row.estado !== 'finalizada' || updatingReposicionId === row.id}
                                    onChange={(event) => updateReposicion(row, event.target.checked ? 'cumplida' : 'programada')}
                                    sx={{ color: '#0f766e', '&.Mui-checked': { color: '#0f766e' } }}
                                  />
                                  <Box sx={{ minWidth: 96 }}>
                                    <Typography sx={{ fontSize: 12, fontWeight: 900, color: row.reposicion_estado === 'cumplida' ? '#0f766e' : '#64748b' }}>
                                      {row.reposicion_estado === 'cumplida' ? 'Validado' : 'Por validar'}
                                    </Typography>
                                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                                      {row.estado === 'finalizada' ? 'Gestion Humana' : 'Esperar cierre'}
                                    </Typography>
                                  </Box>
                                  {row.reposicion_estado !== 'incumplida' && (
                                    <Button
                                      size="small"
                                      variant="outlined"
                                      color="warning"
                                      disabled={row.estado !== 'finalizada' || updatingReposicionId === row.id}
                                      onClick={() => updateReposicion(row, 'incumplida')}
                                      sx={{ borderRadius: 2, fontSize: 11, fontWeight: 900 }}
                                    >
                                      Incumplida
                                    </Button>
                                  )}
                                </Stack>
                              ) : (
                                <Stack spacing={0.3}>
                                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: row.reposicion_estado === 'cumplida' ? '#0f766e' : '#475569' }}>
                                    {row.reposicion_estado === 'cumplida' ? 'Validada por Talento Humano' : 'Pendiente de validacion'}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                                    Vista solo de consulta
                                  </Typography>
                                </Stack>
                              )
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </Box>
    </Fade>
  );
}

export default ReporteSalidaSeguimiento;
