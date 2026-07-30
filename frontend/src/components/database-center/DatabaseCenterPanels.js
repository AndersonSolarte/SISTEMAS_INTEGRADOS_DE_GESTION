import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, CircularProgress, IconButton, LinearProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, InputAdornment, Menu, MenuItem, Paper, Stack, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import CableRoundedIcon from '@mui/icons-material/CableRounded';
import BackupRoundedIcon from '@mui/icons-material/BackupRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import MoreVertRoundedIcon from '@mui/icons-material/MoreVertRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import VerifiedUserRoundedIcon from '@mui/icons-material/VerifiedUserRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RestoreRoundedIcon from '@mui/icons-material/RestoreRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PauseRoundedIcon from '@mui/icons-material/PauseRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import ErrorOutlineRoundedIcon from '@mui/icons-material/ErrorOutlineRounded';
import CloudDoneRoundedIcon from '@mui/icons-material/CloudDoneRounded';
import gestionInformacionService from '../../services/gestionInformacionService';
import TurnstileVerification from '../security/TurnstileVerification';
import GoogleIdentityVerification from '../security/GoogleIdentityVerification';

const saveResponseBlob = (response, fallbackName) => {
  const disposition = response?.headers?.['content-disposition'] || '';
  const match = disposition.match(/filename="?([^";]+)"?/i);
  const filename = match?.[1] || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

const MetricCard = ({ icon, label, value, helper, color = '#1d4ed8' }) => (
  <Card elevation={0} sx={{
    height: '100%',
    border: `1px solid ${color}70`,
    borderRadius: 3,
    bgcolor: `${color}08`,
    boxShadow: `0 5px 14px -10px ${color}55`,
    transition: 'all .25s cubic-bezier(.4,0,.2,1)',
    '&:hover': {
      transform: 'translateY(-4px)',
      borderColor: color,
      bgcolor: `${color}13`,
      boxShadow: `0 16px 28px -9px ${color}50`,
      '& .database-metric-icon': { transform: 'scale(1.08)', boxShadow: `0 10px 22px ${color}42` },
      '& .database-metric-label': { color }
    }
  }}>
    <CardContent sx={{ p: 2.2, '&:last-child': { pb: 2.2 } }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box className="database-metric-icon" sx={{ width: 42, height: 42, display: 'grid', placeItems: 'center', borderRadius: 2.2, bgcolor: color, color: '#fff', boxShadow: `0 7px 16px ${color}30`, transition: 'all .25s ease' }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography className="database-metric-label" variant="caption" sx={{ color, fontWeight: 850, transition: 'color .2s ease' }}>{label}</Typography>
          <Typography sx={{ color: '#0f172a', fontSize: 21, lineHeight: 1.2, fontWeight: 900 }}>{value || '—'}</Typography>
          {helper && <Typography variant="caption" sx={{ color: '#94a3b8' }}>{helper}</Typography>}
        </Box>
      </Stack>
    </CardContent>
  </Card>
);

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date(value))
  : 'Sin registro';

const formatDuration = (milliseconds) => {
  const seconds = Math.max(0, Math.round(Number(milliseconds || 0) / 1000));
  if (!seconds) return '—';
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes} min ${remainder} s`;
};

const formatBytes = (bytes) => {
  const value = Number(bytes || 0);
  if (!value) return '—';
  if (value >= 1024 ** 3) return `${(value / (1024 ** 3)).toFixed(2)} GB`;
  if (value >= 1024 ** 2) return `${(value / (1024 ** 2)).toFixed(1)} MB`;
  return `${(value / 1024).toFixed(0)} kB`;
};

const backupPhaseLabels = {
  queued: 'En espera',
  preparing: 'Preparando almacenamiento',
  generating: 'Copiando estructura y datos',
  validating: 'Validando integridad',
  finalizing: 'Finalizando archivo',
  completed: 'Completada',
  failed: 'Fallida'
};

const BackupAutomationMonitor = ({ enqueueSnackbar, canManage = false }) => {
  const [monitor, setMonitor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState('');

  const loadMonitor = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) setLoading(true);
    try {
      const response = await gestionInformacionService.getBackupMonitor();
      setMonitor(response.data);
    } catch (error) {
      if (!quiet) enqueueSnackbar(error?.response?.data?.message || 'No se pudo consultar el monitor de copias', { variant: 'error' });
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { loadMonitor(); }, [loadMonitor]);
  useEffect(() => {
    const delay = monitor?.currentRun ? 3000 : 30000;
    const timer = setInterval(() => loadMonitor({ quiet: true }), delay);
    return () => clearInterval(timer);
  }, [loadMonitor, monitor?.currentRun]);

  const performAction = async (type) => {
    setAction(type);
    try {
      const response = type === 'run'
        ? await gestionInformacionService.runAutomaticBackupNow()
        : type === 'pause'
          ? await gestionInformacionService.pauseAutomaticBackups()
          : await gestionInformacionService.resumeAutomaticBackups();
      enqueueSnackbar(response.message, { variant: 'success' });
      if (type === 'run') await new Promise((resolve) => setTimeout(resolve, 500));
      await loadMonitor({ quiet: true });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible ejecutar la acción', { variant: 'error' });
    } finally { setAction(''); }
  };

  const current = monitor?.currentRun;
  const history = monitor?.history || [];
  const stateColor = !monitor?.configured ? '#dc2626' : monitor?.paused ? '#d97706' : '#059669';
  const stateLabel = !monitor?.configured ? 'No configurada' : monitor?.paused ? 'Pausada' : 'Activa';

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mb: 1.3 }}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a' }}>Monitoreo de copias automáticas</Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>Ejecución diaria, avance e historial de resultados.</Typography>
        </Box>
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
          <Tooltip title="Actualizar estado">
            <span><IconButton onClick={() => loadMonitor()} disabled={loading || Boolean(action)} sx={{ border: '1px solid #bfdbfe', bgcolor: '#fff' }}><RefreshRoundedIcon /></IconButton></span>
          </Tooltip>
          {canManage && monitor?.configured && (
            <Button
              variant="outlined"
              startIcon={monitor.paused ? <PlayArrowRoundedIcon /> : <PauseRoundedIcon />}
              disabled={Boolean(action)}
              onClick={() => performAction(monitor.paused ? 'resume' : 'pause')}
              sx={{ borderRadius: 2.2, fontWeight: 850, bgcolor: '#fff' }}
            >
              {monitor.paused ? 'Reanudar' : 'Pausar programación'}
            </Button>
          )}
          {canManage && (
            <Button
              variant="contained"
              startIcon={action === 'run' ? <CircularProgress size={17} color="inherit" /> : <PlayArrowRoundedIcon />}
              disabled={Boolean(action) || Boolean(current)}
              onClick={() => performAction('run')}
              sx={{ borderRadius: 2.2, fontWeight: 900, boxShadow: '0 8px 20px rgba(37,99,235,.2)' }}
            >
              Ejecutar ahora
            </Button>
          )}
        </Stack>
      </Stack>

      <Paper elevation={0} sx={{ border: '1px solid #dbe5f2', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
        <Box sx={{ p: { xs: 1.6, md: 2.2 }, bgcolor: '#f8fbff' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 1.2 }}>
            {[
              { icon: <CloudDoneRoundedIcon />, title: 'Programación', value: stateLabel, helper: monitor?.configured ? 'Todos los días a las 6:00 p. m.' : 'Requiere configuración del servidor', color: stateColor },
              { icon: <ScheduleRoundedIcon />, title: 'Próxima ejecución', value: monitor?.enabled ? formatDateTime(monitor?.schedule?.nextRunAt) : 'Sin programación', helper: 'Hora de Colombia', color: '#2563eb' },
              { icon: <HistoryRoundedIcon />, title: 'Última copia correcta', value: formatDateTime(monitor?.summary?.lastSuccessAt), helper: `${monitor?.summary?.successfulRuns || 0} correctas · ${monitor?.summary?.failedRuns || 0} fallidas`, color: '#7c3aed' }
            ].map((item) => (
              <Box key={item.title} sx={{ p: 1.45, border: '1px solid #e2e8f0', borderRadius: 2.3, bgcolor: '#fff' }}>
                <Stack direction="row" spacing={1.1} alignItems="center">
                  <Box sx={{ width: 38, height: 38, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: `${item.color}12`, color: item.color }}>{item.icon}</Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>{item.title}</Typography>
                    <Typography sx={{ color: item.color, fontWeight: 900, lineHeight: 1.25 }}>{loading && !monitor ? 'Consultando…' : item.value}</Typography>
                    <Typography variant="caption" sx={{ color: '#94a3b8' }}>{item.helper}</Typography>
                  </Box>
                </Stack>
              </Box>
            ))}
          </Box>
        </Box>

        {current && (
          <Box sx={{ px: { xs: 1.6, md: 2.2 }, py: 1.8, borderTop: '1px solid #e2e8f0', bgcolor: '#eff6ff' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" sx={{ mb: 1 }}>
              <Box>
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <CircularProgress size={17} thickness={5} />
                  <Typography sx={{ color: '#1e3a8a', fontWeight: 900 }}>Copia en ejecución</Typography>
                </Stack>
                <Typography variant="caption" sx={{ color: '#475569' }}>
                  {backupPhaseLabels[current.phase] || current.phase} · inició {formatDateTime(current.startedAt)}
                </Typography>
              </Box>
              <Chip label={`${current.progress}% estimado`} size="small" sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 900 }} />
            </Stack>
            <LinearProgress variant="determinate" value={current.progress} sx={{ height: 9, borderRadius: 9, bgcolor: '#dbeafe', '& .MuiLinearProgress-bar': { borderRadius: 9 } }} />
            <Typography variant="caption" sx={{ display: 'block', mt: 0.8, color: '#64748b' }}>
              El porcentaje es una estimación operativa; la integridad se confirma al finalizar con pg_restore.
            </Typography>
          </Box>
        )}

        <Box sx={{ px: { xs: 1.6, md: 2.2 }, pt: 1.8, pb: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <HistoryRoundedIcon sx={{ color: '#2563eb' }} />
            <Box>
              <Typography sx={{ color: '#0f172a', fontWeight: 900 }}>Historial de ejecuciones</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>Mostrando las últimas {history.length} ejecuciones; el historial permanece acumulado.</Typography>
            </Box>
          </Stack>
        </Box>
        <TableContainer sx={{ maxHeight: 360 }}>
          <Table stickyHeader size="small" aria-label="Historial de copias de seguridad">
            <TableHead>
              <TableRow>
                {['Estado', 'Inicio', 'Origen', 'Duración', 'Tamaño', 'Resultado'].map((label) => <TableCell key={label} sx={{ bgcolor: '#eff4fb', color: '#475569', fontWeight: 900, whiteSpace: 'nowrap' }}>{label}</TableCell>)}
              </TableRow>
            </TableHead>
            <TableBody>
              {!history.length && (
                <TableRow><TableCell colSpan={6} align="center" sx={{ py: 4, color: '#64748b' }}>{loading ? 'Consultando historial…' : 'Aún no hay ejecuciones registradas.'}</TableCell></TableRow>
              )}
              {history.map((run) => {
                const success = run.status === 'completed';
                const failed = run.status === 'failed';
                return (
                  <TableRow key={run.id} hover>
                    <TableCell><Chip size="small" icon={success ? <CheckCircleRoundedIcon /> : failed ? <ErrorOutlineRoundedIcon /> : <CircularProgress size={13} />} label={success ? 'Correcta' : failed ? 'Fallida' : 'En proceso'} color={success ? 'success' : failed ? 'error' : 'primary'} variant="outlined" sx={{ fontWeight: 850 }} /></TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>{formatDateTime(run.startedAt)}</TableCell>
                    <TableCell>{run.trigger === 'scheduled' ? 'Automática' : 'Manual'}</TableCell>
                    <TableCell>{formatDuration(run.durationMs)}</TableCell>
                    <TableCell>{formatBytes(run.sizeBytes)}</TableCell>
                    <TableCell sx={{ minWidth: 210 }}>
                      <Typography variant="body2" sx={{ color: failed ? '#be123c' : '#475569', fontWeight: failed ? 750 : 500 }}>
                        {failed ? run.errorMessage : success ? 'Copia validada y disponible.' : backupPhaseLabels[run.phase] || 'Procesando'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export function DatabaseBackupPanel({ enqueueSnackbar, canDownload = false, canRestore = false, canManageAutomation = false }) {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [credentials, setCredentials] = useState({ googleCredential: '', turnstileToken: '' });
  const [downloadGoogleError, setDownloadGoogleError] = useState('');
  const [downloadTurnstileAttempt, setDownloadTurnstileAttempt] = useState(0);
  const [downloadTurnstileError, setDownloadTurnstileError] = useState('');
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreCredentials, setRestoreCredentials] = useState({ googleCredential: '', turnstileToken: '' });
  const [restoreGoogleError, setRestoreGoogleError] = useState('');
  const [turnstileAttempt, setTurnstileAttempt] = useState(0);
  const [turnstileError, setTurnstileError] = useState('');

  const closeDownload = () => {
    if (downloading) return;
    setConfirmOpen(false);
    setCredentials({ googleCredential: '', turnstileToken: '' });
    setDownloadGoogleError('');
    setDownloadTurnstileError('');
    setDownloadTurnstileAttempt((current) => current + 1);
  };

  const closeRestore = () => {
    if (restoring) return;
    setRestoreOpen(false);
    setRestoreFile(null);
    setRestoreCredentials({ googleCredential: '', turnstileToken: '' });
    setRestoreGoogleError('');
    setTurnstileError('');
    setTurnstileAttempt((current) => current + 1);
  };

  const loadHealth = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getDatabaseHealth();
      setHealth(response.data);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No se pudo consultar PostgreSQL', { variant: 'error' });
    } finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const download = async () => {
    setDownloading(true);
    try {
      const response = await gestionInformacionService.downloadDatabaseDump(credentials);
      saveResponseBlob(response, `sgc_completo_${new Date().toISOString().slice(0, 10)}.dump`);
      enqueueSnackbar('Copia de PostgreSQL descargada correctamente', { variant: 'success' });
      setConfirmOpen(false);
      setCredentials({ googleCredential: '', turnstileToken: '' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible generar la copia', { variant: 'error' });
      setCredentials({ googleCredential: '', turnstileToken: '' });
      setDownloadTurnstileAttempt((current) => current + 1);
    } finally { setDownloading(false); }
  };

  const restore = async () => {
    setRestoring(true);
    try {
      const response = await gestionInformacionService.restoreDatabaseDump(restoreFile, restoreCredentials);
      enqueueSnackbar(response?.message || 'Base de datos restaurada correctamente', { variant: 'success', autoHideDuration: 8000 });
      setRestoreOpen(false);
      setRestoreFile(null);
      setRestoreCredentials({ googleCredential: '', turnstileToken: '' });
      setTimeout(() => window.location.reload(), 1800);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible restaurar la copia', { variant: 'error', autoHideDuration: 8000 });
      setRestoreCredentials({ googleCredential: '', turnstileToken: '' });
      setTurnstileAttempt((current) => current + 1);
    } finally { setRestoring(false); }
  };

  return (
    <Stack spacing={2.2}>
      <Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 1.4 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a' }}>Resumen del sistema</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>Estado actual de PostgreSQL.</Typography>
          </Box>
          <Chip icon={<CheckCircleRoundedIcon />} label="Servicio operativo" color="success" variant="outlined" sx={{ fontWeight: 800, alignSelf: { xs: 'flex-start', sm: 'center' } }} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, minmax(0, 1fr))' }, gap: 2 }}>
          <MetricCard icon={<StorageRoundedIcon />} label="Almacenamiento de datos" value={health?.size_pretty} helper="Información registrada" />
          <MetricCard icon={<TableChartRoundedIcon />} label="Tablas del sistema" value={health?.table_count} helper="Estructuras disponibles" color="#7c3aed" />
          <MetricCard icon={<CableRoundedIcon />} label="Conexiones activas" value={health?.active_connections} helper="Sesiones en operación" color="#0891b2" />
          <MetricCard icon={<BackupRoundedIcon />} label="Estado de la base" value={loading ? 'Verificando…' : health?.status === 'healthy' ? 'Saludable' : 'No disponible'} helper="Comprobación en tiempo real" color="#059669" />
        </Box>
      </Box>

      <Box>
        <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a', mb: 0.4 }}>Centro de respaldo</Typography>
        <Typography variant="body2" sx={{ color: '#64748b', mb: 1.4 }}>Copia segura de toda la base de datos.</Typography>
        <Paper elevation={0} sx={{ overflow: 'hidden', border: '1px solid #bfdbfe', borderRadius: 3, background: 'linear-gradient(135deg,#f8fbff 0%,#eef4ff 100%)' }}>
          <Box sx={{ p: { xs: 2.2, md: 3 } }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.5} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
              <Stack direction="row" spacing={1.6} alignItems="flex-start" sx={{ maxWidth: 760 }}>
                <Box sx={{ width: 48, height: 48, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 2.4, bgcolor: '#2563eb', color: 'white', boxShadow: '0 8px 22px rgba(37,99,235,.2)' }}><BackupRoundedIcon /></Box>
                <Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} sx={{ mb: 0.6 }}>
                    <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a' }}>Generar copia completa</Typography>
                    <Chip size="small" icon={<VerifiedUserRoundedIcon />} label="Acceso autorizado" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 800 }} />
                  </Stack>
                  <Typography sx={{ color: '#475569', fontSize: 14.5 }}>
                    Incluye estructura, relaciones y todos los registros.
                  </Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {canRestore && <Button variant="outlined" size="large" startIcon={<RestoreRoundedIcon />} disabled={restoring || loading} onClick={() => { setRestoreGoogleError(''); setTurnstileError(''); setRestoreOpen(true); }} sx={{ px: 2.4, py: 1.35, borderRadius: 2.2, fontWeight: 900, whiteSpace: 'nowrap', bgcolor: 'white' }}>
                  Restaurar copia
                </Button>}
                {canDownload && <Button variant="contained" size="large" startIcon={<DownloadRoundedIcon />} disabled={downloading || loading} onClick={() => { setDownloadGoogleError(''); setDownloadTurnstileError(''); setConfirmOpen(true); }} sx={{ px: 3, py: 1.45, borderRadius: 2.2, fontWeight: 900, whiteSpace: 'nowrap', boxShadow: '0 10px 24px rgba(37,99,235,.22)' }}>
                  Descargar copia completa
                </Button>}
              </Stack>
            </Stack>
          </Box>
          <Box sx={{ px: { xs: 2.2, md: 3 }, py: 1.2, borderTop: '1px solid #dbeafe', bgcolor: 'rgba(255,255,255,.58)' }}>
            <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>
              Disponible únicamente para usuarios con permisos asignados.
            </Typography>
          </Box>
        </Paper>
      </Box>

      <Alert icon={<VerifiedUserRoundedIcon />} severity="info" sx={{ borderRadius: 2.5, '& .MuiAlert-message': { width: '100%' } }}>
        <Typography sx={{ fontWeight: 900, fontSize: 13.5 }}>Restauración protegida</Typography>
        <Typography variant="body2">Requiere permiso específico, archivo válido, confirmación con Google y verificación de seguridad.</Typography>
      </Alert>

      {canDownload && <BackupAutomationMonitor enqueueSnackbar={enqueueSnackbar} canManage={canManageAutomation} />}

      <Dialog open={confirmOpen} onClose={closeDownload} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 900, color: '#0f172a' }}>Confirmar copia de seguridad</DialogTitle>
        <DialogContent dividers>
          <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
            Esta operación contiene toda la información institucional y exige un permiso asignado expresamente.
          </Alert>
          <Stack spacing={1.6}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: downloadGoogleError ? '#fda4af' : credentials.googleCredential ? '#86efac' : '#cbd5e1', bgcolor: credentials.googleCredential ? '#f0fdf4' : '#f8fafc' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <VerifiedUserRoundedIcon sx={{ color: credentials.googleCredential ? '#16a34a' : '#2563eb' }} />
                <Box>
                  <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: 14 }}>Confirmación de identidad</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Confirme nuevamente con su cuenta Google institucional.</Typography>
                </Box>
              </Stack>
              {credentials.googleCredential ? (
                <Stack direction="row" spacing={0.8} justifyContent="center" alignItems="center" sx={{ minHeight: 44, color: '#15803d' }}>
                  <CheckCircleRoundedIcon fontSize="small" />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 850 }}>Identidad Google confirmada</Typography>
                </Stack>
              ) : (
                <GoogleIdentityVerification
                  active={confirmOpen && !downloading}
                  onVerify={(credential) => { setDownloadGoogleError(''); setCredentials((current) => ({ ...current, googleCredential: credential })); }}
                  onError={setDownloadGoogleError}
                />
              )}
              {downloadGoogleError && <Typography variant="caption" sx={{ display: 'block', mt: 0.7, color: '#be123c', fontWeight: 700 }}>{downloadGoogleError}</Typography>}
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: downloadTurnstileError ? '#fda4af' : '#cbd5e1', bgcolor: '#f8fafc' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <VerifiedUserRoundedIcon sx={{ color: '#2563eb' }} />
                <Box>
                  <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: 14 }}>Verificación de seguridad</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Confirme que la descarga es realizada por una persona autorizada.</Typography>
                </Box>
              </Stack>
              <TurnstileVerification
                key={downloadTurnstileAttempt}
                active={confirmOpen && !downloading}
                action="database_backup"
                onVerify={(token) => { setDownloadTurnstileError(''); setCredentials((current) => ({ ...current, turnstileToken: token })); }}
                onExpire={() => setCredentials((current) => ({ ...current, turnstileToken: '' }))}
                onError={(message) => { setDownloadTurnstileError(message); setCredentials((current) => ({ ...current, turnstileToken: '' })); }}
              />
              {downloadTurnstileError && <Typography variant="caption" sx={{ display: 'block', mt: 0.7, color: '#be123c', fontWeight: 700 }}>{downloadTurnstileError}</Typography>}
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeDownload} disabled={downloading}>Cancelar</Button>
          <Button
            variant="contained"
            startIcon={downloading ? <CircularProgress size={18} color="inherit" /> : <DownloadRoundedIcon />}
            disabled={downloading || !credentials.googleCredential || !credentials.turnstileToken}
            onClick={download}
            sx={{ fontWeight: 900 }}
          >
            {downloading ? 'Validando y generando…' : 'Confirmar y descargar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={restoreOpen} onClose={closeRestore} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 900, color: '#0f172a' }}>Restaurar base de datos</DialogTitle>
        <DialogContent dividers>
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
            La copia reemplazará la información actual. El proceso se ejecutará en una sola transacción y no debe interrumpirse.
          </Alert>
          <Stack spacing={1.6}>
            <Button variant="outlined" component="label" startIcon={<UploadFileRoundedIcon />} disabled={restoring} sx={{ py: 1.4, fontWeight: 850 }}>
              {restoreFile ? restoreFile.name : 'Seleccionar copia .dump'}
              <input hidden type="file" accept=".dump,.backup,application/octet-stream" onChange={(event) => setRestoreFile(event.target.files?.[0] || null)} />
            </Button>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: restoreGoogleError ? '#fda4af' : restoreCredentials.googleCredential ? '#86efac' : '#cbd5e1', bgcolor: restoreCredentials.googleCredential ? '#f0fdf4' : '#f8fafc' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <VerifiedUserRoundedIcon sx={{ color: restoreCredentials.googleCredential ? '#16a34a' : '#2563eb' }} />
                <Box>
                  <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: 14 }}>Confirmación de identidad</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Confirme nuevamente con su cuenta Google institucional.</Typography>
                </Box>
              </Stack>
              {restoreCredentials.googleCredential ? (
                <Stack direction="row" spacing={0.8} justifyContent="center" alignItems="center" sx={{ minHeight: 44, color: '#15803d' }}>
                  <CheckCircleRoundedIcon fontSize="small" />
                  <Typography sx={{ fontSize: 13.5, fontWeight: 850 }}>Identidad Google confirmada</Typography>
                </Stack>
              ) : (
                <GoogleIdentityVerification
                  active={restoreOpen && !restoring}
                  onVerify={(credential) => { setRestoreGoogleError(''); setRestoreCredentials((current) => ({ ...current, googleCredential: credential })); }}
                  onError={setRestoreGoogleError}
                />
              )}
              {restoreGoogleError && <Typography variant="caption" sx={{ display: 'block', mt: 0.7, color: '#be123c', fontWeight: 700 }}>{restoreGoogleError}</Typography>}
            </Paper>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, borderColor: turnstileError ? '#fda4af' : '#cbd5e1', bgcolor: '#f8fafc' }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <VerifiedUserRoundedIcon sx={{ color: '#2563eb' }} />
                <Box>
                  <Typography sx={{ color: '#0f172a', fontWeight: 850, fontSize: 14 }}>Verificación de seguridad</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>Confirme que la operación es realizada por una persona autorizada.</Typography>
                </Box>
              </Stack>
              <TurnstileVerification
                key={turnstileAttempt}
                active={restoreOpen && !restoring}
                action="database_restore"
                onVerify={(token) => { setTurnstileError(''); setRestoreCredentials((current) => ({ ...current, turnstileToken: token })); }}
                onExpire={() => setRestoreCredentials((current) => ({ ...current, turnstileToken: '' }))}
                onError={(message) => { setTurnstileError(message); setRestoreCredentials((current) => ({ ...current, turnstileToken: '' })); }}
              />
              {turnstileError && <Typography variant="caption" sx={{ display: 'block', mt: 0.7, color: '#be123c', fontWeight: 700 }}>{turnstileError}</Typography>}
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={closeRestore} disabled={restoring}>Cancelar</Button>
          <Button
            color="error"
            variant="contained"
            startIcon={restoring ? <CircularProgress size={18} color="inherit" /> : <RestoreRoundedIcon />}
            disabled={restoring || !restoreFile || !restoreCredentials.googleCredential || !restoreCredentials.turnstileToken}
            onClick={restore}
            sx={{ fontWeight: 900 }}
          >
            {restoring ? 'Restaurando…' : 'Confirmar restauración'}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export function DatabaseCatalogPanel({ enqueueSnackbar }) {
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [anchor, setAnchor] = useState(null);
  const [selected, setSelected] = useState(null);
  const [exporting, setExporting] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getSystemTablesCatalog();
      setTables(response.data || []);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No se pudo cargar el catálogo', { variant: 'error' });
    } finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tables.filter((row) => (!moduleFilter || row.module === moduleFilter) && (!q || `${row.table_name} ${row.module}`.toLowerCase().includes(q)));
  }, [tables, search, moduleFilter]);
  const modules = useMemo(() => Array.from(new Set(tables.map((row) => row.module))).sort(), [tables]);
  const groupedRows = useMemo(() => {
    const result = [];
    modules.forEach((module) => {
      const moduleRows = filtered.filter((row) => row.module === module);
      if (moduleRows.length) {
        result.push({ __group: true, module, count: moduleRows.length });
        result.push(...moduleRows);
      }
    });
    return result;
  }, [filtered, modules]);

  const exportTable = async (format) => {
    setAnchor(null);
    setExporting(`${selected?.table_name}:${format}`);
    try {
      const response = await gestionInformacionService.exportTableData(selected.table_name, format);
      saveResponseBlob(response, `${selected.table_name}.${format}`);
      enqueueSnackbar(`Tabla exportada en ${format.toUpperCase()}`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible exportar la tabla', { variant: 'error' });
    } finally { setExporting(''); }
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ p: { xs: 2, md: 2.6 }, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 900, color: '#0f172a' }}>Tablas e historial de datos del sistema</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>{tables.length} tablas reales, incluyendo información importada, formularios, configuraciones y datos generados por los módulos.</Typography>
          </Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField select size="small" label="Módulo" value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)} sx={{ minWidth: { sm: 220 }, bgcolor: 'white' }}>
              <MenuItem value="">Todos los módulos</MenuItem>
              {modules.map((module) => <MenuItem key={module} value={module}>{module}</MenuItem>)}
            </TextField>
            <TextField size="small" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar tabla" sx={{ minWidth: { md: 280 }, bgcolor: 'white' }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" /></InputAdornment> }} />
            <Tooltip title="Actualizar catálogo"><IconButton onClick={load} sx={{ border: '1px solid #cbd5e1', borderRadius: 2 }}><RefreshRoundedIcon /></IconButton></Tooltip>
          </Stack>
        </Stack>
      </Box>
      <TableContainer sx={{ maxHeight: 620 }}>
        <Table stickyHeader size="small" sx={{ minWidth: 900, '& .MuiTableCell-root': { py: 1.25 } }}>
          <TableHead><TableRow>
            <TableCell sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }}>Tabla del sistema</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }}>Registros</TableCell><TableCell align="right" sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }}>Tamaño</TableCell>
            <TableCell align="right" sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }}>Columnas</TableCell><TableCell align="center" sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }}>Estado</TableCell><TableCell align="center" sx={{ fontWeight: 900, bgcolor: '#f1f5f9' }}>Acciones</TableCell>
          </TableRow></TableHead>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 7 }}><CircularProgress size={28} /></TableCell></TableRow> : filtered.length === 0 ? <TableRow><TableCell colSpan={6} align="center" sx={{ py: 7 }}>No hay tablas que coincidan con la búsqueda.</TableCell></TableRow> : groupedRows.map((row) => row.__group ? (
              <TableRow key={`group-${row.module}`}>
                <TableCell colSpan={6} sx={{ py: 1, bgcolor: '#dbeafe', color: '#1e3a8a', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.35 }}>
                  <Stack direction="row" spacing={1} alignItems="center"><span>{row.module}</span><Chip size="small" label={`${row.count} tablas`} sx={{ height: 21, bgcolor: 'white', color: '#1e3a8a', fontWeight: 800 }} /></Stack>
                </TableCell>
              </TableRow>
            ) : (
              <TableRow hover key={row.table_name}>
                <TableCell><Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ fontFamily: 'monospace', fontWeight: 800, fontSize: 13 }}>{row.table_name}</Typography>{row.sensitive && <Tooltip title="Información restringida"><LockRoundedIcon sx={{ fontSize: 15, color: '#b45309' }} /></Tooltip>}</Stack></TableCell>
                <TableCell align="right">{Number(row.estimated_rows || 0).toLocaleString('es-CO')}</TableCell>
                <TableCell align="right">{row.size_pretty}</TableCell><TableCell align="right">{row.column_count}</TableCell>
                <TableCell align="center"><Chip size="small" color="success" label="Disponible" sx={{ fontWeight: 800 }} /></TableCell>
                <TableCell align="center"><Button size="small" variant="outlined" endIcon={<MoreVertRoundedIcon />} disabled={Boolean(exporting)} onClick={(event) => { setSelected(row); setAnchor(event.currentTarget); }} sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}>Exportar tabla</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        <MenuItem onClick={() => exportTable('xlsx')}>Descargar Excel</MenuItem>
        <MenuItem onClick={() => exportTable('csv')}>Descargar CSV</MenuItem>
        <MenuItem onClick={() => exportTable('json')}>Descargar JSON</MenuItem>
      </Menu>
    </Paper>
  );
}
