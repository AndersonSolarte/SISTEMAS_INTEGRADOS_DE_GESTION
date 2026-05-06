import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Paper, Stack, Typography, Chip, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, CircularProgress, Divider, Tooltip, IconButton,
  Checkbox, LinearProgress
} from '@mui/material';
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Verified as VerifiedIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarMonthIcon,
  Apartment as ApartmentIcon,
  PersonOutline as PersonIcon,
  Download as DownloadIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../context/AuthContext';
import planAccionWorkflowService, { ESTADO_LABEL, ESTADO_COLOR, ESTADOS_WORKFLOW } from '../services/planAccionWorkflowService';
import gestionInformacionService from '../services/gestionInformacionService';

const formatFecha = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return '—'; }
};

const triggerDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

function PlanAccionConsulta() {
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuth();
  const userId = authUser?.id;

  const [pendientes, setPendientes] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [marcando, setMarcando] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Cumplimiento personal local — sincronizado con backend cuando estado=Aprobado
  const [cumplimientoLocal, setCumplimientoLocal] = useState({});
  const [guardandoCumplimiento, setGuardandoCumplimiento] = useState(false);

  // Actividades de corresponsabilidad (planes ajenos donde el usuario figura como corresponsable)
  const [corresponsabilidades, setCorresponsabilidades] = useState([]);

  const cargarPendientes = useCallback(async () => {
    if (!userId) {
      setPendientes([]);
      return;
    }
    setLoadingList(true);
    try {
      const resp = await planAccionWorkflowService.listarPendientes();
      const lista = Array.isArray(resp?.data) ? resp.data : [];
      // Defensa: solo planes donde este usuario es el responsable asignado.
      // Y dejar pasar SOLO los estados visibles para Consulta (revisión o aprobado).
      const ESTADOS_VISIBLES = new Set([ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE, ESTADOS_WORKFLOW.APROBADO]);
      const filtrada = lista.filter((p) =>
        Number(p.responsable_id) === Number(userId) && ESTADOS_VISIBLES.has(p.estado_workflow)
      );
      // Priorizar el plan vigente (Aprobado) sobre el que está pendiente de revisión.
      filtrada.sort((a, b) => {
        if (a.estado_workflow === b.estado_workflow) return 0;
        return a.estado_workflow === ESTADOS_WORKFLOW.APROBADO ? -1 : 1;
      });
      setPendientes(filtrada);
    } catch (err) {
      enqueueSnackbar('No se pudo cargar tu plan de acción.', { variant: 'error' });
    } finally {
      setLoadingList(false);
    }
  }, [enqueueSnackbar, userId]);

  useEffect(() => { cargarPendientes(); }, [cargarPendientes]);

  const abrirPlan = useCallback(async (planCodigo) => {
    setLoadingDetalle(true);
    try {
      const resp = await planAccionWorkflowService.obtenerPlan(planCodigo);
      const data = resp?.data || null;
      setPlanSeleccionado(data);
      setComentarios('');
      // Reconstruir cumplimiento local desde cabecera_plan.cumplimiento_consulta[userId]
      const cabecera = data?.cabecera_plan || {};
      const todoCumplimiento = cabecera.cumplimiento_consulta || {};
      const miCumplimiento = todoCumplimiento[String(userId)] || {};
      setCumplimientoLocal(miCumplimiento);
      // Si el plan está aprobado, traer también las actividades de corresponsabilidad
      if (data?.estado_workflow === ESTADOS_WORKFLOW.APROBADO) {
        try {
          const respCorr = await planAccionWorkflowService.obtenerMisCorresponsabilidades();
          setCorresponsabilidades(Array.isArray(respCorr?.data) ? respCorr.data : []);
        } catch {
          setCorresponsabilidades([]);
        }
      } else {
        setCorresponsabilidades([]);
      }
    } catch (err) {
      enqueueSnackbar('No se pudo abrir el plan.', { variant: 'error' });
    } finally {
      setLoadingDetalle(false);
    }
  }, [enqueueSnackbar, userId]);

  const marcarRevisado = useCallback(async () => {
    if (!planSeleccionado?.plan_codigo) return;
    setMarcando(true);
    try {
      await planAccionWorkflowService.transicionar(planSeleccionado.plan_codigo, {
        accion: 'marcar_revisado_responsable'
      });
      enqueueSnackbar('Plan marcado como revisado. Volverá a Planeación y Efectividad para su aprobación final.', { variant: 'success' });
      setPlanSeleccionado(null);
      await cargarPendientes();
    } catch (err) {
      const msg = err?.response?.data?.message || 'No se pudo marcar como revisado.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setMarcando(false);
    }
  }, [planSeleccionado, cargarPendientes, enqueueSnackbar]);

  const descargarPlanAprobado = useCallback(async () => {
    if (!planSeleccionado?.plan_codigo) return;
    try {
      setExporting(true);
      const response = await gestionInformacionService.exportPlanAccionPlantilla({
        planData: {
          anio: planSeleccionado.anio,
          nombrePlan: planSeleccionado.dependencia,
          codigoPlan: planSeleccionado.plan_codigo,
          dependencia: planSeleccionado.dependencia,
          ped: planSeleccionado.ped
        },
        actividades: planSeleccionado.actividades || [],
        corresponsabilidades: corresponsabilidades || []
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const safeName = String(planSeleccionado.dependencia || 'plan').replace(/\s+/g, '_');
      triggerDownload(blob, `plan_accion_${safeName}_${planSeleccionado.anio || new Date().getFullYear()}.xlsx`);
      enqueueSnackbar('Plan descargado correctamente.', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || 'No se pudo descargar el plan.', { variant: 'error' });
    } finally {
      setExporting(false);
    }
  }, [planSeleccionado, corresponsabilidades, enqueueSnackbar]);

  const toggleCumplido = useCallback(async (actividadId, current) => {
    if (!planSeleccionado?.plan_codigo || !actividadId) return;
    const cumplido = !current?.cumplido;
    const next = {
      ...cumplimientoLocal,
      [actividadId]: {
        cumplido,
        fecha: cumplido ? new Date().toISOString() : null,
        observaciones: current?.observaciones || ''
      }
    };
    setCumplimientoLocal(next);
    setGuardandoCumplimiento(true);
    try {
      await planAccionWorkflowService.guardarCumplimiento(planSeleccionado.plan_codigo, {
        items: { [actividadId]: next[actividadId] }
      });
    } catch (err) {
      enqueueSnackbar('No se pudo guardar el cumplimiento. Reintenta.', { variant: 'error' });
      setCumplimientoLocal(cumplimientoLocal);
    } finally {
      setGuardandoCumplimiento(false);
    }
  }, [planSeleccionado, cumplimientoLocal, enqueueSnackbar]);

  const cabeceraPlan = useMemo(() => planSeleccionado?.cabecera_plan || {}, [planSeleccionado]);
  const actividades = useMemo(() => Array.isArray(planSeleccionado?.actividades) ? planSeleccionado.actividades : [], [planSeleccionado]);

  const totalCumplidas = useMemo(() => {
    return actividades.filter((a) => cumplimientoLocal[a.id]?.cumplido).length;
  }, [actividades, cumplimientoLocal]);

  const porcentaje = actividades.length > 0 ? Math.round((totalCumplidas / actividades.length) * 100) : 0;

  const esRevision = planSeleccionado?.estado_workflow === ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE;
  const esAprobado = planSeleccionado?.estado_workflow === ESTADOS_WORKFLOW.APROBADO;

  // === LISTADO ===
  if (!planSeleccionado) {
    return (
      <Stack spacing={2.4}>
        <Paper elevation={0} sx={{ p: { xs: 2.4, md: 3 }, borderRadius: 4, color: 'white', overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #064e3b 0%, #047857 50%, #10b981 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={1.6} alignItems="center">
              <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'rgba(255,255,255,.16)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AssignmentTurnedInIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 900, letterSpacing: -0.4 }}>Plan de Acción</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,.88)', maxWidth: 720 }}>
                  Bandeja del responsable de dependencia. Aquí puedes revisar, dar conformidad y hacer seguimiento al cumplimiento durante el año.
                </Typography>
              </Box>
            </Stack>
            <Tooltip title="Refrescar bandeja" arrow>
              <IconButton onClick={cargarPendientes} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,.12)', '&:hover': { bgcolor: 'rgba(255,255,255,.20)' } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        {loadingList ? (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Paper>
        ) : pendientes.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #dbeafe', textAlign: 'center', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
            <CheckCircleIcon sx={{ fontSize: 56, color: '#10b981', mb: 1 }} />
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>Sin actividad pendiente</Typography>
            <Typography sx={{ color: '#64748b', mt: 0.4 }}>
              Cuando Planeación y Efectividad envíe un plan a tu revisión, lo verás aquí.
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={1.4}>
            {pendientes.map((p) => {
              const enRevision = p.estado_workflow === ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE;
              const aprobado = p.estado_workflow === ESTADOS_WORKFLOW.APROBADO;
              return (
                <Paper key={p.plan_codigo} elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: enRevision ? '2px solid #fbbf24' : '1px solid #d1fae5', background: '#fff', boxShadow: '0 6px 18px rgba(15,23,42,.05)' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                    <Stack spacing={0.6} sx={{ flex: 1, minWidth: 0 }}>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.6 }}>
                        <Chip size="small" label={p.plan_codigo} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 800 }} />
                        <Chip
                          size="small"
                          label={ESTADO_LABEL[p.estado_workflow] || p.estado_workflow}
                          sx={{ bgcolor: (ESTADO_COLOR[p.estado_workflow] || {}).bg, color: (ESTADO_COLOR[p.estado_workflow] || {}).fg, fontWeight: 800 }}
                        />
                        <Chip size="small" icon={<CalendarMonthIcon sx={{ fontSize: 14 }} />} label={p.anio} sx={{ bgcolor: '#f1f5f9', color: '#0f172a', fontWeight: 700 }} />
                        {enRevision && <Chip size="small" color="warning" label="Acción requerida" sx={{ fontWeight: 800 }} />}
                        {aprobado && <Chip size="small" color="success" label="Plan vigente" sx={{ fontWeight: 800 }} />}
                      </Stack>
                      <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <ApartmentIcon sx={{ fontSize: 18, color: '#64748b' }} />
                        {p.dependencia || 'Dependencia sin especificar'}
                      </Typography>
                      <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                        {enRevision
                          ? <>Recibido para revisión: <strong>{formatFecha(p.fecha_envio_responsable)}</strong></>
                          : <>Plan aprobado para gestión durante el año {p.anio}</>}
                      </Typography>
                    </Stack>
                    <Button
                      variant="contained"
                      color={enRevision ? 'warning' : 'success'}
                      onClick={() => abrirPlan(p.plan_codigo)}
                      disabled={loadingDetalle}
                      sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 2.6, color: enRevision ? '#0f172a' : 'white' }}
                    >
                      {enRevision ? 'Abrir y revisar' : 'Abrir plan vigente'}
                    </Button>
                  </Stack>
                </Paper>
              );
            })}
          </Stack>
        )}
      </Stack>
    );
  }

  // === DETALLE ===
  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.6 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => setPlanSeleccionado(null)} sx={{ textTransform: 'none', fontWeight: 800, color: '#1e3a8a' }}>
              Volver a la bandeja
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.6 }} />
            <Chip size="small" label={planSeleccionado.plan_codigo} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 800 }} />
            <Chip
              size="small"
              label={ESTADO_LABEL[planSeleccionado.estado_workflow] || planSeleccionado.estado_workflow}
              sx={{ bgcolor: (ESTADO_COLOR[planSeleccionado.estado_workflow] || {}).bg, color: (ESTADO_COLOR[planSeleccionado.estado_workflow] || {}).fg, fontWeight: 800 }}
            />
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 0.6 }}>
            {esRevision && (
              <Button
                variant="contained"
                color="success"
                startIcon={marcando ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <VerifiedIcon />}
                onClick={marcarRevisado}
                disabled={marcando}
                sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 2.6 }}
              >
                {marcando ? 'Marcando...' : 'Marcar como revisado'}
              </Button>
            )}
            {esAprobado && (
              <Button
                variant="contained"
                color="success"
                startIcon={exporting ? <CircularProgress size={16} sx={{ color: 'white' }} /> : <DownloadIcon />}
                onClick={descargarPlanAprobado}
                disabled={exporting}
                sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 2.6 }}
              >
                {exporting ? 'Descargando...' : 'Descargar plan'}
              </Button>
            )}
          </Stack>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: '1px solid #e2e8f0', background: '#fff' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
          Información del plan
        </Typography>
        <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
          <Box>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Dependencia</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{planSeleccionado.dependencia || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Año</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{planSeleccionado.anio || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>PED</Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{planSeleccionado.ped || '—'}</Typography>
          </Box>
          <Box>
            <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
              {esRevision ? 'Recibido para revisión' : 'Aprobado el'}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              {formatFecha(esRevision ? planSeleccionado.fecha_envio_responsable : planSeleccionado.fecha_aprobado)}
            </Typography>
          </Box>
          {cabeceraPlan.objetivoSesion && (
            <Box sx={{ gridColumn: { xs: 'auto', md: 'span 4' } }}>
              <Typography sx={{ fontSize: 11, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Objetivo del plan</Typography>
              <Typography sx={{ fontSize: 13.5, color: '#334155', mt: 0.3 }}>{cabeceraPlan.objetivoSesion}</Typography>
            </Box>
          )}
        </Box>
      </Paper>

      {esAprobado && (
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: '1px solid #d1fae5', background: 'linear-gradient(135deg,#ecfdf5 0%,#ffffff 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#047857', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                Avance de cumplimiento
              </Typography>
              <Stack direction="row" spacing={1} alignItems="baseline" sx={{ mt: 0.4 }}>
                <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#047857' }}>{porcentaje}%</Typography>
                <Typography sx={{ fontSize: 13, color: '#475569' }}>
                  · {totalCumplidas} de {actividades.length} actividades cumplidas
                </Typography>
              </Stack>
              <LinearProgress variant="determinate" value={porcentaje} sx={{ mt: 1, height: 8, borderRadius: 4, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }} />
            </Box>
            {guardandoCumplimiento && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={16} />
                <Typography sx={{ fontSize: 12, color: '#475569' }}>Guardando…</Typography>
              </Stack>
            )}
          </Stack>
        </Paper>
      )}

      <Paper elevation={0} sx={{ p: 0, borderRadius: 3.5, border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pt: 1.6, pb: 1.2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Actividades del plan
          </Typography>
          <Chip size="small" label={`${actividades.length} ${actividades.length === 1 ? 'actividad' : 'actividades'}`} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 800 }} />
          {esAprobado && <Chip size="small" color="success" variant="outlined" label="Marca cada actividad cumplida durante el año" sx={{ fontWeight: 700 }} />}
        </Stack>
        <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {esAprobado && (
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 70, textAlign: 'center' }}>
                    ✓ Cumplido
                  </TableCell>
                )}
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', width: 44 }}>#</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 200 }}>Objetivo Estratégico</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 180 }}>Lineamiento</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 180 }}>Macroactividad</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 220 }}>Actividad</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 220 }}>Indicador</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', width: 110 }}>Meta</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', minWidth: 180 }}>Responsable</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', width: 110 }}>Inicio</TableCell>
                <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', width: 110 }}>Fin</TableCell>
                {esAprobado && <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0369a1', bgcolor: '#f0f9ff', borderBottom: '2px solid #bae6fd', textTransform: 'uppercase', letterSpacing: 0.3, width: 88, textAlign: 'center' }}>Avance IP %</TableCell>}
                {esAprobado && <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0369a1', bgcolor: '#f0f9ff', borderBottom: '2px solid #bae6fd', textTransform: 'uppercase', letterSpacing: 0.3, width: 94, textAlign: 'center' }}>Avance IIP %</TableCell>}
                {esAprobado && <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0369a1', bgcolor: '#f0f9ff', borderBottom: '2px solid #bae6fd', textTransform: 'uppercase', letterSpacing: 0.3, width: 78, textAlign: 'center' }}>Total %</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {actividades.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={esAprobado ? 14 : 10} sx={{ textAlign: 'center', color: '#94a3b8', py: 4 }}>
                    Este plan no tiene actividades registradas.
                  </TableCell>
                </TableRow>
              ) : actividades.map((a, idx) => {
                const cumpl = cumplimientoLocal[a.id] || {};
                const isDone = !!cumpl.cumplido;
                return (
                  <TableRow
                    key={a.id || idx}
                    hover
                    sx={{
                      bgcolor: esAprobado && isDone ? 'rgba(16,185,129,.08)' : 'inherit',
                      '& td': { borderColor: esAprobado && isDone ? 'rgba(16,185,129,.20)' : undefined }
                    }}
                  >
                    {esAprobado && (
                      <TableCell sx={{ textAlign: 'center', borderLeft: isDone ? '4px solid #10b981' : '4px solid transparent' }}>
                        <Checkbox
                          checked={isDone}
                          onChange={() => toggleCumplido(a.id, cumpl)}
                          sx={{ color: '#94a3b8', '&.Mui-checked': { color: '#10b981' } }}
                        />
                      </TableCell>
                    )}
                    <TableCell sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a' }}>{a.objetivo_estrategico || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#334155' }}>{a.lineamiento_estrategico || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#334155' }}>{a.macroactividad || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a', fontWeight: 600, textDecoration: isDone ? 'line-through' : 'none' }}>{a.actividad || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#334155' }}>{a.indicador || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>{a.meta || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a' }}>
                      {a.responsable ? (
                        <Stack direction="row" spacing={0.5} alignItems="center">
                          <PersonIcon sx={{ fontSize: 14, color: '#64748b' }} />
                          <span>{a.responsable}</span>
                        </Stack>
                      ) : '—'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>{formatFecha(a.fecha_inicio)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>{formatFecha(a.fecha_fin)}</TableCell>
                    {esAprobado && (() => {
                      const fmtPct = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) ? `${Number(v).toFixed(1)}%` : '—';
                      return (<>
                        <TableCell sx={{ fontSize: 12.5, color: '#0369a1', fontWeight: 600, textAlign: 'center' }}>{fmtPct(a.avance_ip)}</TableCell>
                        <TableCell sx={{ fontSize: 12.5, color: '#0369a1', fontWeight: 600, textAlign: 'center' }}>{fmtPct(a.avance_iip)}</TableCell>
                        <TableCell sx={{ fontSize: 13, color: a.total_ejecucion != null ? '#047857' : '#94a3b8', fontWeight: 900, textAlign: 'center' }}>{fmtPct(a.total_ejecucion)}</TableCell>
                      </>);
                    })()}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {esAprobado && corresponsabilidades.length > 0 && (
        <Paper elevation={0} sx={{ p: 0, borderRadius: 3.5, border: '1px solid #fde68a', background: 'linear-gradient(180deg,#fffbeb 0%,#ffffff 100%)', overflow: 'hidden' }}>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pt: 1.6, pb: 1.2 }}>
            <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.6 }}>
              Actividades en corresponsabilidad
            </Typography>
            <Chip size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800 }} label={`${corresponsabilidades.length} ${corresponsabilidades.length === 1 ? 'actividad' : 'actividades'}`} />
            <Chip size="small" variant="outlined" color="warning" sx={{ fontWeight: 700 }} label="Apoyas a otras dependencias" />
          </Stack>
          <TableContainer sx={{ maxHeight: '50vh' }}>
            <Table stickyHeader size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, width: 44 }}>#</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, minWidth: 200 }}>Dependencia</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, minWidth: 220 }}>Actividad</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, minWidth: 220 }}>Indicador</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, width: 100 }}>Meta</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, minWidth: 180 }}>Responsable principal</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, width: 110 }}>Inicio</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#92400e', bgcolor: '#fef9c3', borderBottom: '2px solid #fde68a', textTransform: 'uppercase', letterSpacing: 0.3, width: 110 }}>Fin</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0369a1', bgcolor: '#f0f9ff', borderBottom: '2px solid #bae6fd', textTransform: 'uppercase', letterSpacing: 0.3, width: 88, textAlign: 'center' }}>Avance IP %</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0369a1', bgcolor: '#f0f9ff', borderBottom: '2px solid #bae6fd', textTransform: 'uppercase', letterSpacing: 0.3, width: 94, textAlign: 'center' }}>Avance IIP %</TableCell>
                  <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0369a1', bgcolor: '#f0f9ff', borderBottom: '2px solid #bae6fd', textTransform: 'uppercase', letterSpacing: 0.3, width: 78, textAlign: 'center' }}>Total %</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {corresponsabilidades.map((a, idx) => {
                  const fmtPct = (v) => (v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))) ? `${Number(v).toFixed(1)}%` : '—';
                  return (
                  <TableRow key={`${a.plan_codigo}-${a.id || idx}`} hover>
                    <TableCell sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569' }}>{idx + 1}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>{a.dependencia || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a' }}>{a.actividad || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#334155' }}>{a.indicador || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0f172a', fontWeight: 700 }}>{a.meta || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>{a.responsable || '—'}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>{formatFecha(a.fecha_inicio)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>{formatFecha(a.fecha_fin)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0369a1', fontWeight: 600, textAlign: 'center' }}>{fmtPct(a.avance_ip)}</TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#0369a1', fontWeight: 600, textAlign: 'center' }}>{fmtPct(a.avance_iip)}</TableCell>
                    <TableCell sx={{ fontSize: 13, color: a.total_ejecucion != null ? '#047857' : '#94a3b8', fontWeight: 900, textAlign: 'center' }}>{fmtPct(a.total_ejecucion)}</TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {esRevision && (
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: '1px solid #fde68a', background: 'linear-gradient(135deg,#fffbeb 0%,#ffffff 100%)' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
            Observaciones para Planeación y Efectividad (opcional)
          </Typography>
          <TextField
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Si hay ajustes que solicitar antes de aprobar el plan, déjalos aquí..."
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
          />
          <Alert severity="warning" sx={{ borderRadius: 2.5, mt: 1.4 }}>
            Al marcar como revisado, el plan vuelve a Planeación y Efectividad para su aprobación final. Una vez aprobado, podrás descargarlo y hacer seguimiento mensual al cumplimiento.
          </Alert>
        </Paper>
      )}
    </Stack>
  );
}

export default PlanAccionConsulta;
