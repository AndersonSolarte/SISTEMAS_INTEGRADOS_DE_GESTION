import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControl,
  InputLabel,
  LinearProgress,
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
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CleaningServicesRoundedIcon from '@mui/icons-material/CleaningServicesRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ThumbDownAltRoundedIcon from '@mui/icons-material/ThumbDownAltRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import gestionInformacionService from '../../services/gestionInformacionService';

const ACTIVE_STATUSES = new Set(['queued', 'processing']);

const STATUS_CONFIG = {
  queued: { label: 'En cola', color: 'warning' },
  processing: { label: 'Procesando', color: 'info' },
  completed: { label: 'Completado', color: 'success' },
  failed: { label: 'Fallido', color: 'error' },
  interrupted: { label: 'Interrumpido', color: 'error' }
};

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(date);
};

const getErrorMessage = async (error, fallback) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const parsed = JSON.parse(await data.text());
      return parsed?.message || parsed?.detail || fallback;
    } catch (_) {
      return fallback;
    }
  }
  return data?.message || data?.detail || fallback;
};

function ContextoExternoGestionPanel({ listas = [], onBack, onOpenImporter, enqueueSnackbar }) {
  const [lista, setLista] = useState('');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(true);
  const [jobsError, setJobsError] = useState('');
  const [actionJobId, setActionJobId] = useState('');

  const hasActiveJobs = useMemo(() => jobs.some((job) => ACTIVE_STATUSES.has(job.status)), [jobs]);

  const loadJobs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setJobsLoading(true);
    try {
      const response = await gestionInformacionService.getContextoExternoCleaningJobs();
      setJobs(response?.data?.jobs || []);
      setJobsError('');
    } catch (error) {
      if (!silent) setJobsError(error?.response?.data?.message || 'No fue posible consultar los procesos de limpieza.');
    } finally {
      if (!silent) setJobsLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  useEffect(() => {
    if (!lista && listas && listas.length > 0) {
      setLista(listas[0]);
    }
  }, [listas, lista]);

  const handleFileChange = (selectedFile) => {
    setFile(selectedFile);
    if (selectedFile && listas.length > 0) {
      const lowerName = selectedFile.name.toLowerCase();
      let matched = '';
      if (lowerName.includes('inscrito')) matched = listas.find((l) => l.includes('INSCRITOS'));
      else if (lowerName.includes('admitid')) matched = listas.find((l) => l.includes('ADMITIDOS'));
      else if (lowerName.includes('primer')) matched = listas.find((l) => l.includes('PRIMER CURSO'));
      else if (lowerName.includes('matricul')) matched = listas.find((l) => l.includes('MATRICULADOS'));
      else if (lowerName.includes('graduad')) matched = listas.find((l) => l.includes('GRADUADOS'));
      else if (lowerName.includes('programa')) matched = listas.find((l) => l.includes('PROGRAMAS'));

      if (matched) {
        setLista(matched);
      } else if (!lista) {
        setLista(listas[0]);
      }
    }
  };

  const handleClean = async () => {
    if (!lista || !file) {
      enqueueSnackbar('Selecciona una lista y adjunta el archivo original.', { variant: 'warning' });
      return;
    }
    setUploading(true);
    try {
      const response = await gestionInformacionService.createContextoExternoCleaningJob(file, lista);
      if (response?.data) setJobs((current) => [response.data, ...current.filter((job) => job.jobId !== response.data.jobId)]);
      setFile(null);
      enqueueSnackbar('Archivo recibido. Puedes cerrar esta página; el proceso continuará en el servidor.', { variant: 'success' });
      await loadJobs({ silent: true });
    } catch (error) {
      enqueueSnackbar(await getErrorMessage(error, 'No fue posible registrar el proceso de limpieza.'), { variant: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (job) => {
    setActionJobId(job.jobId);
    try {
      const response = await gestionInformacionService.downloadContextoExternoCleaningJob(job.jobId);
      const disposition = response.headers?.['content-disposition'] || '';
      const filenameMatch = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^;"']+)/i);
      const filename = filenameMatch?.[1]
        ? decodeURIComponent(filenameMatch[1])
        : (job.filename || 'contexto_externo_limpio.xlsx');
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (error) {
      enqueueSnackbar(await getErrorMessage(error, 'No fue posible descargar el archivo limpio.'), { variant: 'error' });
    } finally {
      setActionJobId('');
    }
  };

  const handleRetry = async (job) => {
    setActionJobId(job.jobId);
    try {
      const response = await gestionInformacionService.retryContextoExternoCleaningJob(job.jobId);
      setJobs((current) => current.map((item) => item.jobId === job.jobId ? response.data : item));
      enqueueSnackbar(response?.message || 'Proceso enviado nuevamente a la cola.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible reintentar el proceso.', { variant: 'error' });
    } finally {
      setActionJobId('');
    }
  };

  const [confirmModal, setConfirmModal] = useState({
    open: false,
    title: '',
    description: '',
    confirmText: 'Eliminar',
    confirmColor: 'error',
    onConfirm: null
  });

  const askConfirmation = ({ title, description, confirmText = 'Eliminar', confirmColor = 'error', onConfirm }) => {
    setConfirmModal({
      open: true,
      title,
      description,
      confirmText,
      confirmColor,
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, open: false }));
        if (typeof onConfirm === 'function') onConfirm();
      }
    });
  };

  const handleReview = (job, approved) => {
    if (!job.reviewId) return;
    const executeReview = async () => {
      setActionJobId(job.jobId);
      try {
        const response = approved
          ? await gestionInformacionService.approveContextoExternoReview(job.reviewId)
          : await gestionInformacionService.rejectContextoExternoReview(job.reviewId);
        enqueueSnackbar(response?.message || (approved ? 'Correcciones aprobadas.' : 'Revisión no aprobada.'), { variant: approved ? 'success' : 'info' });
        await loadJobs({ silent: true });
      } catch (error) {
        enqueueSnackbar(error?.response?.data?.message || 'No fue posible actualizar la revisión.', { variant: 'error' });
      } finally {
        setActionJobId('');
      }
    };

    if (!approved) {
      askConfirmation({
        title: '¿Marcar revisión como no aprobada?',
        description: '¿Confirmas que las correcciones de este archivo no son correctas? El diccionario de correcciones no será modificado.',
        confirmText: 'No aprobar',
        confirmColor: 'error',
        onConfirm: executeReview
      });
    } else {
      executeReview();
    }
  };

  const handleDeleteJob = (job) => {
    askConfirmation({
      title: '¿Eliminar registro de limpieza?',
      description: `¿Estás seguro de que deseas eliminar el registro de "${job.originalName}"? Se borrará el historial y los archivos asociados del servidor.`,
      confirmText: 'Eliminar registro',
      confirmColor: 'error',
      onConfirm: async () => {
        setActionJobId(job.jobId);
        try {
          await gestionInformacionService.deleteContextoExternoCleaningJob(job.jobId);
          enqueueSnackbar('Registro de limpieza eliminado correctamente.', { variant: 'info' });
          setJobs((current) => current.filter((item) => item.jobId !== job.jobId));
        } catch (error) {
          enqueueSnackbar(error?.response?.data?.message || 'No fue posible eliminar el registro.', { variant: 'error' });
        } finally {
          setActionJobId('');
        }
      }
    });
  };

  return (
    <Stack spacing={2.3}>
      <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ fontWeight: 800 }}>
          Volver a Contexto Externo
        </Button>
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2.2, md: 3 }, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg,#164e63,#0891b2)' }}>
        <Stack direction="row" spacing={1.6} alignItems="center">
          <Box sx={{ width: 50, height: 50, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center' }}>
            <CleaningServicesRoundedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, md: 24 } }}>Gestión de base de datos de Contexto Externo</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.86)', mt: 0.3 }}>Limpia, normaliza y prepara los archivos antes de importarlos al sistema.</Typography>
          </Box>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ borderRadius: 2.5 }}>
        Cada archivo se procesa en el servidor. Puedes cerrar esta ventana y regresar después: el avance y el resultado permanecerán disponibles durante 24 horas.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.6 }}>
        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe6f5', borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="1" color="primary" sx={{ fontWeight: 900 }} />
            <Box><Typography sx={{ fontWeight: 900 }}>Seleccionar estructura</Typography><Typography variant="caption" sx={{ color: '#64748b' }}>Define cómo debe quedar el archivo final.</Typography></Box>
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Lista Contexto Externo</InputLabel>
            <Select value={lista} label="Lista Contexto Externo" onChange={(event) => setLista(event.target.value)}>
              <MenuItem value=""><em>Sin seleccionar</em></MenuItem>
              {listas.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </Select>
          </FormControl>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe6f5', borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="2" color="primary" sx={{ fontWeight: 900 }} />
            <Box><Typography sx={{ fontWeight: 900 }}>Adjuntar base original</Typography><Typography variant="caption" sx={{ color: '#64748b' }}>Preparado para archivos Excel o CSV de gran tamaño.</Typography></Box>
          </Stack>
          <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} sx={{ py: 1.45, fontWeight: 800 }}>
            {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
            <input hidden type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(event) => handleFileChange(event.target.files?.[0] || null)} />
          </Button>
          {file && <Box sx={{ mt: 1.4, p: 1.2, borderRadius: 2, bgcolor: '#f0fdfa', border: '1px solid #99f6e4' }}><Typography sx={{ color: '#115e59', fontWeight: 800, fontSize: 13, wordBreak: 'break-word' }}>{file.name}</Typography><Typography variant="caption" sx={{ color: '#0f766e' }}>{(file.size / 1048576).toFixed(2)} MB</Typography></Box>}
        </Paper>

        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe6f5', borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="3" color="primary" sx={{ fontWeight: 900 }} />
            <Box><Typography sx={{ fontWeight: 900 }}>Iniciar limpieza</Typography><Typography variant="caption" sx={{ color: '#64748b' }}>El servidor continuará el trabajo en segundo plano.</Typography></Box>
          </Stack>
          <Button variant="contained" startIcon={<CleaningServicesRoundedIcon />} disabled={!lista || !file || uploading} onClick={handleClean} sx={{ mt: 'auto', py: 1.45, fontWeight: 900, background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}>
            {uploading ? 'Cargando archivo...' : 'Limpiar y preparar archivo'}
          </Button>
        </Paper>
      </Box>

      <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 3, overflow: 'hidden' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ p: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fbff' }}>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 18 }}>Procesos de limpieza</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>Seguimiento y descargas disponibles por 24 horas.</Typography>
          </Box>
          <Button variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={() => loadJobs()} disabled={jobsLoading} sx={{ fontWeight: 800 }}>Actualizar</Button>
        </Stack>

        {jobsError && <Alert severity="error" sx={{ m: 2 }}>{jobsError}</Alert>}
        {jobsLoading && <LinearProgress />}
        {!jobsLoading && !jobs.length && !jobsError && <Box sx={{ py: 5, px: 2, textAlign: 'center' }}><Typography sx={{ fontWeight: 800, color: '#475569' }}>No hay procesos registrados en las últimas 24 horas.</Typography></Box>}

        {!!jobs.length && (
          <TableContainer>
            <Table sx={{ minWidth: 1040 }}>
              <TableHead><TableRow sx={{ bgcolor: '#f8fafc' }}>
                {['ARCHIVO / ESTRUCTURA', 'ESTADO', 'AVANCE POR ETAPAS', 'RESUMEN', 'CREADO / VENCE', 'ACCIONES'].map((title) => <TableCell key={title} sx={{ fontWeight: 900, color: '#334155', fontSize: 12 }}>{title}</TableCell>)}
              </TableRow></TableHead>
              <TableBody>
                {jobs.map((job) => {
                  const status = STATUS_CONFIG[job.status] || { label: job.status, color: 'default' };
                  const busy = actionJobId === job.jobId;
                  return (
                    <TableRow key={job.jobId} hover>
                      <TableCell sx={{ maxWidth: 240 }}><Typography sx={{ fontWeight: 800, fontSize: 13, wordBreak: 'break-word' }}>{job.originalName}</Typography><Typography variant="caption" sx={{ color: '#64748b' }}>{job.lista}</Typography></TableCell>
                      <TableCell><Chip size="small" label={status.label} color={status.color} sx={{ fontWeight: 800 }} /><Typography variant="caption" display="block" sx={{ color: job.errorMessage ? '#b91c1c' : '#64748b', mt: 0.7, maxWidth: 210 }}>{job.errorMessage || job.stage}</Typography></TableCell>
                      <TableCell sx={{ minWidth: 170 }}><Stack direction="row" spacing={1} alignItems="center"><LinearProgress variant="determinate" value={Math.min(100, Number(job.progress || 0))} color={job.status === 'failed' || job.status === 'interrupted' ? 'error' : 'primary'} sx={{ flex: 1, height: 8, borderRadius: 5 }} /><Typography variant="caption" sx={{ fontWeight: 900 }}>{job.progress || 0}%</Typography></Stack></TableCell>
                      <TableCell sx={{ minWidth: 175 }}>{job.summary ? <Stack spacing={0.2}><Typography variant="caption"><strong>{job.summary.inputRows}</strong> filas recibidas</Typography><Typography variant="caption"><strong>{job.summary.outputRows}</strong> registros normalizados</Typography><Typography variant="caption" sx={{ color: '#047857' }}>Se conservan todos los registros con datos</Typography></Stack> : <Typography variant="caption" sx={{ color: '#94a3b8' }}>Disponible al finalizar</Typography>}</TableCell>
                      <TableCell sx={{ minWidth: 175 }}><Typography variant="caption" display="block">Creado: {formatDate(job.createdAt)}</Typography><Typography variant="caption" display="block" sx={{ color: '#64748b' }}>Vence: {formatDate(job.expiresAt)}</Typography></TableCell>
                      <TableCell sx={{ minWidth: 235 }}>
                        <Stack spacing={0.7}>
                          {job.status === 'completed' && <Button size="small" variant="contained" startIcon={<DownloadRoundedIcon />} disabled={busy} onClick={() => handleDownload(job)} sx={{ fontWeight: 800 }}>Descargar base limpia</Button>}
                          {job.status === 'completed' && job.reviewStatus === 'pending' && <Stack direction="row" spacing={0.7}><Button fullWidth size="small" color="success" variant="outlined" startIcon={<VerifiedRoundedIcon />} disabled={busy} onClick={() => handleReview(job, true)}>Aprobar</Button><Button fullWidth size="small" color="error" variant="outlined" startIcon={<ThumbDownAltRoundedIcon />} disabled={busy} onClick={() => handleReview(job, false)}>No aprobar</Button></Stack>}
                          {job.status === 'completed' && job.reviewStatus === 'approved' && <Button size="small" variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => onOpenImporter?.(job.lista)} sx={{ fontWeight: 800 }}>Ir a importación</Button>}
                          {['failed', 'interrupted'].includes(job.status) && <Button size="small" variant="outlined" startIcon={<ReplayRoundedIcon />} disabled={busy} onClick={() => handleRetry(job)} sx={{ fontWeight: 800 }}>Reintentar</Button>}
                          {ACTIVE_STATUSES.has(job.status) && <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 700 }}>Puedes salir de esta página sin detenerlo.</Typography>}
                          {!ACTIVE_STATUSES.has(job.status) && (
                            <Button
                              size="small"
                              color="error"
                              variant="outlined"
                              startIcon={<DeleteOutlineRoundedIcon />}
                              disabled={busy}
                              onClick={() => handleDeleteJob(job)}
                              sx={{
                                fontWeight: 800,
                                fontSize: 12,
                                borderRadius: 2,
                                borderColor: '#fca5a5',
                                color: '#dc2626',
                                '&:hover': {
                                  borderColor: '#ef4444',
                                  bgcolor: '#fef2f2'
                                }
                              }}
                            >
                              Eliminar
                            </Button>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Dialog
        open={confirmModal.open}
        onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            p: 1.5,
            maxWidth: 480,
            width: '100%'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1, pt: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: 2.5,
                bgcolor: '#fef2f2',
                color: '#dc2626',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <WarningAmberRoundedIcon sx={{ fontSize: 26 }} />
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>
              {confirmModal.title}
            </Typography>
          </Stack>
        </DialogTitle>
        <DialogContent sx={{ pb: 2 }}>
          <DialogContentText sx={{ color: '#475569', fontSize: 14, lineHeight: 1.6 }}>
            {confirmModal.description}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 1.5, gap: 1 }}>
          <Button
            variant="outlined"
            onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
            sx={{ borderRadius: 2.5, fontWeight: 800, color: '#64748b', borderColor: '#cbd5e1' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color={confirmModal.confirmColor || 'error'}
            startIcon={<DeleteOutlineRoundedIcon />}
            onClick={confirmModal.onConfirm}
            sx={{ borderRadius: 2.5, fontWeight: 900, px: 2.5 }}
          >
            {confirmModal.confirmText}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default ContextoExternoGestionPanel;
