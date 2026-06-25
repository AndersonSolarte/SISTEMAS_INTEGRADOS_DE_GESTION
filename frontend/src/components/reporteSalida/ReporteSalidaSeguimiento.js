import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ManageHistoryIcon from '@mui/icons-material/ManageHistory';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import BarChartIcon from '@mui/icons-material/BarChart';
import reporteSalidaService from '../../services/reporteSalidaService';
import ReporteSalidaEstadisticas from './ReporteSalidaEstadisticas';

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
  finalizada: 'Aprobada',
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
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const getHorasPendientes = (row) => {
  if (!row) return '0 hrs';
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  return pendientes > 0 ? (pendientes / 60).toFixed(1) + ' hrs' : '0 hrs';
};

const getReposicionText = (row) => {
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  
  if (pendientes <= 0) return 'Completado';
  if (minutosPagados === 0) return `Debe ${formatElapsed(totalMinutos)}`;
  return `Abonó ${formatElapsed(minutosPagados)} - Debe ${formatElapsed(pendientes)}`;
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
    key: 'estadisticas',
    label: 'Indicadores de Ausentismo',
    description: 'Análisis detallado, frecuencia y métricas de control.',
    icon: BarChartIcon,
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
  const { user } = useAuth();
  const { enqueueSnackbar } = useSnackbar();
  const [activeModule, setActiveModule] = useState('reporte_salida');
  const [rows, setRows] = useState([]);
  const [access, setAccess] = useState(initialAccess);
  const [loading, setLoading] = useState(false);
  const [estado, setEstado] = useState('');
  const [viewTab, setViewTab] = useState('todas');
  const [updatingReposicionId, setUpdatingReposicionId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Estados para modales de administración GH
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [editData, setEditData] = useState({ estado: '', reposicion_aplica: false, tiempo_solicitado_minutos: '' });
  
  // Estados para modal de reposición parcial GH
  const [repDialogOpen, setRepDialogOpen] = useState(false);
  const [repTarget, setRepTarget] = useState(null);
  const [repHorasAbonadas, setRepHorasAbonadas] = useState('');
  const [repEstado, setRepEstado] = useState('programada');
  const [repObservacion, setRepObservacion] = useState('');

  const fetchSolicitudes = useCallback(async () => {
    setLoading(true);
    try {
      const response = await reporteSalidaService.getSeguimiento({ page: 1, limit: 50, estado });
      setAccess(response?.data?.access || null);
      setRows(response?.data?.solicitudes || []);
    } finally {
      setLoading(false);
    }
  }, [estado]);

  const load = useCallback(async () => {
    fetchSolicitudes();
  }, [fetchSolicitudes]);

  useEffect(() => {
    if (activeModule === 'reporte_salida' || activeModule === 'estadisticas') load();
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
  const canManageAll = Boolean(access?.canManageAll);
  const showEstadoFilter = Boolean(access?.canManageAll);

  const filteredRows = useMemo(() => {
    let result = rows;
    if (accessMode === 'jefe_y_colaborador') {
      if (viewTab === 'mis_reposiciones') result = rows.filter((r) => r.solicitante?.userId === user?.id);
      else if (viewTab === 'equipo') result = rows.filter((r) => r.solicitante?.userId !== user?.id);
    }
    if (tipoFiltro) {
      result = result.filter(r => {
        const tipo = r.datos_formulario?.salida?.tipo;
        if (tipoFiltro === 'salud') return ['cita_eps', 'cita_particular', 'terapias'].includes(tipo);
        if (tipoFiltro === 'personales') return ['diligencia_personal', 'calamidad'].includes(tipo);
        if (tipoFiltro === 'institucionales') return ['reunion_institucional', 'evento_institucional', 'ponencia'].includes(tipo);
        return tipo === tipoFiltro;
      });
    }
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(r => {
        const nameMatch = r.solicitante?.nombre?.toLowerCase().includes(lower) || false;
        const ccMatch = r.solicitante?.username?.toLowerCase().includes(lower) || r.datos_formulario?.laboral?.cedula?.toLowerCase().includes(lower) || false;
        const consecutivoMatch = r.consecutivo?.toLowerCase().includes(lower) || false;
        return nameMatch || ccMatch || consecutivoMatch;
      });
    }
    return result;
  }, [rows, viewTab, accessMode, user?.id, tipoFiltro, searchTerm]);

  const exportToCSV = () => {
    const headers = [
      'Consecutivo', 'Fecha Radicacion', 'Colaborador', 'Documento', 'Dependencia', 'Cargo', 
      'Jefe Inmediato', 'Tipo Permiso', 'Motivo', 'Estado', 
      'Requiere Reposicion', 'Estado Reposicion', 'Tiempo Solicitado (Min)'
    ];

    const escapeCsv = (str) => `"${String(str || '').replace(/"/g, '""')}"`;

    const csvData = filteredRows.map(row => {
      const f = row.datos_formulario || {};
      const tipo = f.salida?.tipo || 'N/A';
      return [
        row.consecutivo,
        new Date(row.created_at).toLocaleString('es-CO'),
        row.solicitante?.nombre,
        f.laboral?.cedula,
        f.laboral?.dependencia,
        f.laboral?.cargo,
        row.jefe?.nombre,
        tipo,
        f.salida?.motivo || f.salida?.otraDescripcion || '',
        STATUS_LABELS[row.estado] || row.estado,
        row.reposicion_aplica ? 'SI' : 'NO',
        row.reposicion_aplica ? row.reposicion_estado : 'N/A',
        row.tiempo_solicitado_minutos || 0
      ].map(escapeCsv).join(';');
    });

    const csvContent = [headers.join(';'), ...csvData].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Seguimiento_Reportes_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  const handleEditOpen = (row) => {
    setEditTarget(row);
    setEditData({
      estado: row.estado,
      reposicion_aplica: row.reposicion_aplica || false,
      tiempo_solicitado_minutos: row.tiempo_solicitado_minutos || 0
    });
    setEditDialogOpen(true);
  };

  const submitEdit = async () => {
    try {
      const res = await api.put(`/reporte-salida/solicitudes/${editTarget.id}/admin`, editData);
      if (res.data.success) {
        enqueueSnackbar('Solicitud editada correctamente', { variant: 'success' });
        setEditDialogOpen(false);
        fetchSolicitudes();
      }
    } catch (error) {
      enqueueSnackbar('Error al editar la solicitud', { variant: 'error' });
    }
  };

  const handleDeleteOpen = (id) => {
    setDeleteTargetId(id);
    setDeleteConfirmOpen(true);
  };

  const submitDelete = async () => {
    try {
      const res = await api.delete(`/reporte-salida/solicitudes/${deleteTargetId}`);
      if (res.data.success) {
        enqueueSnackbar('Solicitud eliminada', { variant: 'success' });
        setDeleteConfirmOpen(false);
        fetchSolicitudes();
      }
    } catch (error) {
      enqueueSnackbar('Error al eliminar', { variant: 'error' });
    }
  };

  const handleRepOpen = (row) => {
    setRepTarget(row);
    setRepEstado(row.reposicion_estado !== 'no_aplica' ? row.reposicion_estado : 'pendiente');
    setRepObservacion('');
    setRepHorasAbonadas('');
    setRepDialogOpen(true);
  };

  const submitRep = async () => {
    try {
      const res = await api.patch(`/reporte-salida/solicitudes/${repTarget.id}/reposicion`, {
        estado: repEstado,
        observacion: repObservacion,
        horasAbonadas: repHorasAbonadas
      });
      if (res.data.success) {
        enqueueSnackbar('Reposición actualizada', { variant: 'success' });
        setRepDialogOpen(false);
        fetchSolicitudes();
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al actualizar', { variant: 'error' });
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
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                  <TextField select size="small" label="Tipo" value={tipoFiltro} onChange={(e) => setTipoFiltro(e.target.value)} sx={{ minWidth: 150 }}>
                    <MenuItem value="">Todos los Tipos</MenuItem>
                    <MenuItem value="salud">Salud (EPS, Part, Terapias)</MenuItem>
                    <MenuItem value="personales">Personales / Calamidad</MenuItem>
                    <MenuItem value="institucionales">Institucional</MenuItem>
                  </TextField>
                  <TextField select size="small" label="Estado" value={estado} onChange={(e) => setEstado(e.target.value)} sx={{ minWidth: 150 }}>
                    <MenuItem value="">Todos</MenuItem>
                    {Object.entries(STATUS_LABELS).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}
                  </TextField>
                  <Button variant="contained" color="success" startIcon={<DownloadIcon />} onClick={exportToCSV} sx={{ fontWeight: 800, textTransform: 'none' }}>
                    Exportar Excel
                  </Button>
                </Stack>
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

        {activeModule === 'estadisticas' && canManageAll ? (
          <Box sx={{ mt: 2 }}>
            <ReporteSalidaEstadisticas rows={rows} />
          </Box>
        ) : activeModule !== 'reporte_salida' ? (
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
            {accessMode === 'jefe_y_colaborador' && (
              <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                <Tabs value={viewTab} onChange={(_, newValue) => setViewTab(newValue)} textColor="primary" indicatorColor="primary">
                  <Tab label="Todas" value="todas" sx={{ fontWeight: 800, textTransform: 'none' }} />
                  <Tab label="Mis reposiciones" value="mis_reposiciones" sx={{ fontWeight: 800, textTransform: 'none' }} />
                  <Tab label="Reposiciones de mi equipo" value="equipo" sx={{ fontWeight: 800, textTransform: 'none' }} />
                </Tabs>
              </Box>
            )}
            
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Buscar por Nombre, Cédula o Consecutivo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
              />
            </Box>

            <Paper elevation={0} sx={{ border: '1px solid #dbe6f5', borderRadius: 3, overflow: 'hidden', bgcolor: '#fff' }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {['Solicitud', 'Colaborador', 'Jefe inmediato', 'Motivo / Detalles', 'Estado', 'Tiempo Ausencia', 'Reposicion', canManageAll ? 'Acciones Adm' : (canValidateReposicion ? 'Validacion GH' : 'Seguimiento')].map((label) => (
                        <TableCell key={label} sx={{ bgcolor: '#f8fafc', fontWeight: 950, color: '#334155' }}>{label}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}><CircularProgress /></TableCell></TableRow>
                    ) : filteredRows.length === 0 ? (
                      <TableRow><TableCell colSpan={9} sx={{ py: 3 }}><Alert severity="info">No hay solicitudes para el filtro seleccionado.</Alert></TableCell></TableRow>
                    ) : filteredRows.map((row) => {
                      const statusSx = STATUS_COLORS[row.estado] || { bg: '#f1f5f9', color: '#475569' };
                      return (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ minWidth: 140 }}>
                            <Typography sx={{ fontWeight: 900, color: '#1d4ed8' }}>{row.consecutivo}</Typography>
                            {(() => {
                              const salida = row.datos_formulario?.salida;
                              if (salida?.tipo !== 'terapias' || !salida?.terapiasList?.length) return null;
                              const today = new Date();
                              today.setHours(0, 0, 0, 0);
                              return (
                                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mt: 1 }}>
                                  {salida.terapiasList.map((t, idx) => {
                                    const tParts = (t.fecha || '').split('-');
                                    if (tParts.length !== 3) return null;
                                    const tDate = new Date(tParts[0], tParts[1] - 1, tParts[2]);
                                    const isPast = tDate < today;
                                    const isToday = tDate.getTime() === today.getTime();
                                    const bg = isPast ? '#dcfce7' : isToday ? '#fef08a' : '#f1f5f9';
                                    const color = isPast ? '#166534' : isToday ? '#854d0e' : '#475569';
                                    return (
                                      <Tooltip key={idx} title={`Terapia #${idx + 1}: ${t.fecha} ${t.horaInicio}-${t.horaFin}`} arrow>
                                        <Chip size="small" label={`#${idx + 1}`} sx={{ bgcolor: bg, color, fontSize: 10, fontWeight: 700, height: 20, '& .MuiChip-label': { px: 1 } }} />
                                      </Tooltip>
                                    );
                                  })}
                                </Stack>
                              );
                            })()}
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{row.solicitante?.nombre}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{row.solicitante?.username}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 700, fontSize: 13 }}>{row.jefe?.nombre}</Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 12 }}>{row.jefe?.email}</Typography>
                          </TableCell>
                          <TableCell sx={{ maxWidth: 220 }}>
                            <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#334155', textTransform: 'capitalize' }}>
                              {(row.datos_formulario?.salida?.tipo || '').replace(/_/g, ' ')}
                            </Typography>
                            <Typography sx={{ color: '#64748b', fontSize: 11, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={row.datos_formulario?.salida?.motivo || row.datos_formulario?.salida?.otraDescripcion || 'Sin descripción'}>
                              {row.datos_formulario?.salida?.motivo || row.datos_formulario?.salida?.otraDescripcion || 'Sin descripción'}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Stack spacing={0.5} alignItems="flex-start">
                              <Chip size="small" label={STATUS_LABELS[row.estado] || row.estado} sx={{ bgcolor: statusSx.bg, color: statusSx.color, fontWeight: 900 }} />
                              {(() => {
                                const rejectionTrace = Array.isArray(row.trazabilidad)
                                  ? row.trazabilidad.find(t => ['rechazada_jefe', 'rechazada_gestion_humana'].includes(t.event))
                                  : null;
                                const justificacion = rejectionTrace?.detail?.justificacion;
                                if (!justificacion) return null;
                                return (
                                  <Tooltip title={justificacion} arrow>
                                    <Typography sx={{ color: '#ef4444', fontSize: 11, cursor: 'help', textDecoration: 'underline dotted', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      Motivo: {justificacion}
                                    </Typography>
                                  </Tooltip>
                                );
                              })()}
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontWeight: 800, color: '#b45309' }}>
                              {formatElapsed(row.tiempo_solicitado_minutos)}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {row.reposicion_aplica ? (
                              <Stack spacing={0.3}>
                                <Chip size="small" label={row.reposicion_estado} sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 800 }} />
                                <Typography sx={{ color: '#64748b', fontSize: 12 }}>{getReposicionText(row)}</Typography>
                              </Stack>
                            ) : 'No aplica'}
                          </TableCell>
                          <TableCell>
                            {canManageAll ? (
                              <Stack direction="row" spacing={0.5}>
                                {row.reposicion_aplica && (
                                  <Tooltip title="Gestionar Reposición" arrow>
                                    <IconButton size="small" color="primary" onClick={() => handleRepOpen(row)}>
                                      <ManageHistoryIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                                <Tooltip title="Editar" arrow>
                                  <IconButton size="small" onClick={() => handleEditOpen(row)}>
                                    <EditIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                <Tooltip title="Eliminar" arrow>
                                  <IconButton size="small" color="error" onClick={() => handleDeleteOpen(row.id)}>
                                    <DeleteIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            ) : (
                              row.reposicion_aplica ? (
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
                              ) : '-'
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
            )}
            {/* Modal de Eliminacion */}
            <Dialog open={deleteConfirmOpen} onClose={() => setDeleteConfirmOpen(false)}>
              <DialogTitle>Confirmar Eliminación</DialogTitle>
              <DialogContent>
                <Typography>¿Está seguro de que desea eliminar este reporte de salida permanentemente?</Typography>
                <Typography color="error" variant="caption">Esta acción no se puede deshacer.</Typography>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDeleteConfirmOpen(false)} color="inherit">Cancelar</Button>
                <Button onClick={submitDelete} color="error" variant="contained" disableElevation>Eliminar</Button>
              </DialogActions>
            </Dialog>

            {/* Modal de Edición Básica */}
            <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Editar Solicitud (Administrador)</DialogTitle>
              <DialogContent>
                <Box sx={{ mt: 2 }}>
                  <TextField
                    select
                    fullWidth
                    size="small"
                    margin="normal"
                    label="Estado General"
                    value={editData.estado}
                    onChange={(e) => setEditData({...editData, estado: e.target.value})}
                  >
                    <MenuItem value="pendiente_aprobacion_jefe">Pendiente jefe</MenuItem>
                    <MenuItem value="aprobada_jefe">Aprobada jefe</MenuItem>
                    <MenuItem value="pendiente_aprobacion_gestion_humana">Pendiente Gestion Humana</MenuItem>
                    <MenuItem value="aprobada_gestion_humana">Aprobada Gestion Humana</MenuItem>
                    <MenuItem value="finalizada">Finalizada (Aprobada)</MenuItem>
                    <MenuItem value="no_aprobada">No aprobada / Rechazada</MenuItem>
                  </TextField>
                  <Stack direction="row" alignItems="center" sx={{ mt: 2 }}>
                    <Checkbox
                      checked={editData.reposicion_aplica}
                      onChange={(e) => setEditData({...editData, reposicion_aplica: e.target.checked})}
                    />
                    <Typography>Requiere Reposición de Tiempo</Typography>
                  </Stack>
                  {editData.reposicion_aplica && (
                    <TextField
                      fullWidth
                      size="small"
                      margin="normal"
                      type="number"
                      label="Horas Totales Adeudadas"
                      inputProps={{ min: 0, step: 0.1 }}
                      value={editData.tiempo_solicitado_minutos / 60}
                      onChange={(e) => setEditData({...editData, tiempo_solicitado_minutos: parseFloat(e.target.value || 0) * 60})}
                    />
                  )}
                </Box>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setEditDialogOpen(false)} color="inherit">Cancelar</Button>
                <Button onClick={submitEdit} color="primary" variant="contained" disableElevation>Guardar Cambios</Button>
              </DialogActions>
            </Dialog>

            {/* Modal de Gestionar Reposición */}
            <Dialog open={repDialogOpen} onClose={() => setRepDialogOpen(false)} maxWidth="sm" fullWidth>
              <DialogTitle>Gestionar Reposición (Horas)</DialogTitle>
              <DialogContent>
                <Box sx={{ mb: 2, mt: 1 }}>
                  <Typography variant="subtitle2">Consecutivo: {repTarget?.consecutivo}</Typography>
                  <Typography variant="body2" sx={{ mt: 1 }}>Tiempo Total Solicitado: {formatElapsed(repTarget?.reposicion_minutos || repTarget?.tiempo_solicitado_minutos || 0)}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5 }}>Tiempo Abonado: {formatElapsed(repTarget?.reposicion_minutos_pagados || repTarget?.datos_formulario?.reposicion_minutos_pagados || 0)}</Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, fontWeight: 'bold', color: '#b45309' }}>Saldo pendiente: {getHorasPendientes(repTarget)}</Typography>
                </Box>

                <TextField
                  label="Horas a abonar (Repuestas hoy)"
                  type="number"
                  value={repHorasAbonadas}
                  onChange={(e) => setRepHorasAbonadas(e.target.value)}
                  fullWidth
                  margin="normal"
                  size="small"
                  inputProps={{ min: 0, step: 0.5 }}
                  helperText="Ingrese las horas repuestas, ej: 1.5. El saldo se descontará automáticamente."
                />

                <TextField
                  select
                  label="Estado de Reposición"
                  value={repEstado}
                  onChange={(e) => setRepEstado(e.target.value)}
                  fullWidth
                  margin="normal"
                  size="small"
                >
                  <MenuItem value="pendiente">Pendiente</MenuItem>
                  <MenuItem value="programada">Programada</MenuItem>
                  <MenuItem value="cumplida">Cumplida</MenuItem>
                  <MenuItem value="incumplida">Incumplida</MenuItem>
                </TextField>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setRepDialogOpen(false)} color="inherit">Cancelar</Button>
                <Button onClick={submitRep} color="primary" variant="contained" disableElevation>Actualizar Saldo</Button>
              </DialogActions>
            </Dialog>
          </>
        )}
      </Box>
    </Fade>
  );
}

export default ReporteSalidaSeguimiento;
