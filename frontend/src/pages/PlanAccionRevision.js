import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Box, Paper, Stack, Typography, Chip, Button, Alert,
  Table, TableHead, TableRow, TableCell, TableBody, TableContainer,
  TextField, CircularProgress, Divider, Tooltip, IconButton,
  Tabs, Tab
} from '@mui/material';
import {
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  Verified as VerifiedIcon,
  Refresh as RefreshIcon,
  ArrowBack as ArrowBackIcon,
  CalendarMonth as CalendarMonthIcon,
  Apartment as ApartmentIcon,
  PersonOutline as PersonIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  EditNote as EditNoteIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import planAccionWorkflowService, { ESTADO_LABEL, ESTADO_COLOR, ESTADOS_WORKFLOW } from '../services/planAccionWorkflowService';

const formatFecha = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return '—'; }
};

const COLS = [
  { key: 'idx', label: '#', width: 44, editable: false },
  { key: 'objetivo_estrategico', label: 'Objetivo Estratégico', minWidth: 220, editable: true, multiline: true },
  { key: 'lineamiento_estrategico', label: 'Lineamiento', minWidth: 200, editable: true, multiline: true },
  { key: 'macroactividad', label: 'Macroactividad', minWidth: 200, editable: true, multiline: true },
  { key: 'actividad', label: 'Actividad', minWidth: 240, editable: true, multiline: true },
  { key: 'indicador', label: 'Indicador', minWidth: 240, editable: true, multiline: true },
  { key: 'meta', label: 'Meta', width: 110, editable: true },
  { key: 'tipo_indicador', label: 'Tipo', width: 130, editable: true },
  { key: 'responsable', label: 'Responsable', minWidth: 180, editable: true },
  { key: 'corresponsable', label: 'Corresponsable', minWidth: 180, editable: true },
  { key: 'fecha_inicio', label: 'Inicio', width: 140, editable: true, kind: 'date' },
  { key: 'fecha_fin', label: 'Fin', width: 140, editable: true, kind: 'date' }
];

function PlanAccionRevision() {
  const { enqueueSnackbar } = useSnackbar();

  const [tab, setTab] = useState('pendientes');
  const [pendientes, setPendientes] = useState([]);
  const [aprobados, setAprobados] = useState([]);
  const [loadingList, setLoadingList] = useState(false);

  const [planSeleccionado, setPlanSeleccionado] = useState(null);
  const [actividadesEdit, setActividadesEdit] = useState([]);
  const [dirty, setDirty] = useState(false);
  const [loadingDetalle, setLoadingDetalle] = useState(false);
  const [comentarios, setComentarios] = useState('');
  const [marcando, setMarcando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarListas = useCallback(async () => {
    setLoadingList(true);
    try {
      const [respPend, respMios] = await Promise.all([
        planAccionWorkflowService.listarPendientes(),
        planAccionWorkflowService.listarMisPlanes()
      ]);
      const listaPend = Array.isArray(respPend?.data) ? respPend.data : [];
      const listaMios = Array.isArray(respMios?.data) ? respMios.data : [];
      setPendientes(listaPend.filter((p) => p.estado_workflow === ESTADOS_WORKFLOW.EN_REVISION_ESTRATEGICA));
      setAprobados(listaMios.filter((p) => p.estado_workflow === ESTADOS_WORKFLOW.APROBADO));
    } catch (err) {
      enqueueSnackbar('No se pudieron cargar los planes.', { variant: 'error' });
    } finally {
      setLoadingList(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { cargarListas(); }, [cargarListas]);

  const abrirPlan = useCallback(async (planCodigo) => {
    setLoadingDetalle(true);
    try {
      const resp = await planAccionWorkflowService.obtenerPlan(planCodigo);
      const data = resp?.data || null;
      setPlanSeleccionado(data);
      setActividadesEdit(Array.isArray(data?.actividades) ? data.actividades.map((a) => ({ ...a })) : []);
      setDirty(false);
      setComentarios('');
    } catch (err) {
      enqueueSnackbar('No se pudo abrir el plan.', { variant: 'error' });
    } finally {
      setLoadingDetalle(false);
    }
  }, [enqueueSnackbar]);

  const handleEditCell = useCallback((idx, key, value) => {
    setActividadesEdit((prev) => prev.map((a, i) => i === idx ? { ...a, [key]: value } : a));
    setDirty(true);
  }, []);

  const guardarCambios = useCallback(async () => {
    if (!planSeleccionado?.plan_codigo) return;
    setGuardando(true);
    try {
      await planAccionWorkflowService.guardarPlan(planSeleccionado.plan_codigo, {
        cabecera_plan: planSeleccionado.cabecera_plan || {},
        actividades: actividadesEdit
      });
      enqueueSnackbar('Cambios guardados.', { variant: 'success' });
      setDirty(false);
    } catch (err) {
      const msg = err?.response?.data?.message || 'No se pudieron guardar los cambios.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setGuardando(false);
    }
  }, [planSeleccionado, actividadesEdit, enqueueSnackbar]);

  const marcarRevisado = useCallback(async () => {
    if (!planSeleccionado?.plan_codigo) return;
    setMarcando(true);
    try {
      if (dirty) {
        await planAccionWorkflowService.guardarPlan(planSeleccionado.plan_codigo, {
          cabecera_plan: planSeleccionado.cabecera_plan || {},
          actividades: actividadesEdit
        });
      }
      await planAccionWorkflowService.transicionar(planSeleccionado.plan_codigo, {
        accion: 'marcar_revisado_estrategica',
        ...(comentarios.trim() ? { comentarios: comentarios.trim() } : {})
      });
      enqueueSnackbar('Plan marcado como revisado. Devuelto a Planeación y Efectividad.', { variant: 'success' });
      setPlanSeleccionado(null);
      setDirty(false);
      await cargarListas();
    } catch (err) {
      const msg = err?.response?.data?.message || 'No se pudo marcar como revisado.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setMarcando(false);
    }
  }, [planSeleccionado, actividadesEdit, dirty, cargarListas, enqueueSnackbar]);

  const cabeceraPlan = useMemo(() => planSeleccionado?.cabecera_plan || {}, [planSeleccionado]);
  const esPendiente = planSeleccionado?.estado_workflow === ESTADOS_WORKFLOW.EN_REVISION_ESTRATEGICA;

  // ============ LISTADO con tabs ============
  if (!planSeleccionado) {
    const lista = tab === 'pendientes' ? pendientes : aprobados;
    return (
      <Stack spacing={2.4}>
        <Paper elevation={0} sx={{ p: { xs: 2.4, md: 3 }, borderRadius: 4, color: 'white', overflow: 'hidden', position: 'relative', background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
            <Stack direction="row" spacing={1.6} alignItems="center">
              <Box sx={{ width: 56, height: 56, borderRadius: 3, bgcolor: 'rgba(255,255,255,.14)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <AssignmentTurnedInIcon sx={{ fontSize: 32 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: { xs: 22, md: 28 }, fontWeight: 900, letterSpacing: -0.4 }}>Planes de Acción</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,.85)', maxWidth: 720 }}>
                  Bandeja de Planeación Estratégica. Revisa y ajusta los planes pendientes; consulta los planes ya aprobados de toda la institución.
                </Typography>
              </Box>
            </Stack>
            <Tooltip title="Refrescar listas" arrow>
              <IconButton onClick={cargarListas} sx={{ color: 'white', bgcolor: 'rgba(255,255,255,.10)', '&:hover': { bgcolor: 'rgba(255,255,255,.18)' } }}>
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 0.6, borderRadius: 3, border: '1px solid #dbeafe', background: '#fff' }}>
          <Tabs
            value={tab}
            onChange={(_, next) => setTab(next)}
            variant="fullWidth"
            sx={{
              minHeight: 52,
              '& .MuiTabs-indicator': { height: 0 },
              '& .MuiTab-root': { textTransform: 'none', fontWeight: 900, minHeight: 48, borderRadius: 2.5, color: '#64748b', gap: 1 },
              '& .MuiTab-root.Mui-selected': { color: '#1d4ed8', background: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)', boxShadow: 'inset 0 0 0 1px rgba(59,130,246,.22)' }
            }}
          >
            <Tab
              value="pendientes"
              icon={<EditNoteIcon fontSize="small" />}
              iconPosition="start"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Pendientes de revisión</span>
                  {pendientes.length > 0 && <Chip size="small" color="warning" label={pendientes.length} sx={{ fontWeight: 900, height: 20 }} />}
                </Stack>
              }
            />
            <Tab
              value="aprobados"
              icon={<VisibilityIcon fontSize="small" />}
              iconPosition="start"
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <span>Planes aprobados</span>
                  {aprobados.length > 0 && <Chip size="small" sx={{ fontWeight: 900, height: 20, bgcolor: '#dcfce7', color: '#166534' }} label={aprobados.length} />}
                </Stack>
              }
            />
          </Tabs>
        </Paper>

        {loadingList ? (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Paper>
        ) : lista.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, borderRadius: 4, border: '1px solid #dbeafe', textAlign: 'center', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
            <VerifiedIcon sx={{ fontSize: 56, color: tab === 'pendientes' ? '#22c55e' : '#94a3b8', mb: 1 }} />
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#0f172a' }}>
              {tab === 'pendientes' ? 'Bandeja al día' : 'Aún no hay planes aprobados'}
            </Typography>
            <Typography sx={{ color: '#64748b', mt: 0.4 }}>
              {tab === 'pendientes'
                ? 'No tienes planes pendientes de revisión estratégica.'
                : 'Cuando Planeación y Efectividad apruebe planes, aparecerán aquí en modo lectura.'}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={1.4}>
            {lista.map((p) => (
              <Paper key={p.plan_codigo} elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: tab === 'pendientes' ? '1px solid #fde68a' : '1px solid #d1fae5', background: '#fff', boxShadow: '0 6px 18px rgba(15,23,42,.05)' }}>
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
                    </Stack>
                    <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 0.6 }}>
                      <ApartmentIcon sx={{ fontSize: 18, color: '#64748b' }} />
                      {p.dependencia || 'Dependencia sin especificar'}
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                      {tab === 'pendientes'
                        ? <>Enviado a revisión: <strong>{formatFecha(p.fecha_envio_estrategica)}</strong></>
                        : <>Aprobado el: <strong>{formatFecha(p.fecha_aprobado)}</strong></>}
                      {p.ped ? <> &nbsp;·&nbsp; PED: <strong>{p.ped}</strong></> : null}
                    </Typography>
                  </Stack>
                  <Button
                    variant="contained"
                    color={tab === 'pendientes' ? 'primary' : 'success'}
                    onClick={() => abrirPlan(p.plan_codigo)}
                    disabled={loadingDetalle}
                    startIcon={tab === 'pendientes' ? <EditNoteIcon /> : <VisibilityIcon />}
                    sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 2.6 }}
                  >
                    {tab === 'pendientes' ? 'Abrir y editar' : 'Ver plan'}
                  </Button>
                </Stack>
              </Paper>
            ))}
          </Stack>
        )}
      </Stack>
    );
  }

  // ============ DETALLE del plan ============
  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.6 }}>
            <Button startIcon={<ArrowBackIcon />} onClick={() => { setPlanSeleccionado(null); setDirty(false); }} sx={{ textTransform: 'none', fontWeight: 800, color: '#1e3a8a' }}>
              Volver
            </Button>
            <Divider orientation="vertical" flexItem sx={{ mx: 0.6 }} />
            <Chip size="small" label={planSeleccionado.plan_codigo} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 800 }} />
            <Chip
              size="small"
              label={ESTADO_LABEL[planSeleccionado.estado_workflow] || planSeleccionado.estado_workflow}
              sx={{ bgcolor: (ESTADO_COLOR[planSeleccionado.estado_workflow] || {}).bg, color: (ESTADO_COLOR[planSeleccionado.estado_workflow] || {}).fg, fontWeight: 800 }}
            />
            {esPendiente && dirty && (
              <Chip size="small" color="warning" label="Cambios sin guardar" sx={{ fontWeight: 800 }} />
            )}
          </Stack>
          {esPendiente && (
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 0.6 }}>
              <Button
                variant="outlined"
                startIcon={guardando ? <CircularProgress size={14} /> : <SaveIcon />}
                onClick={guardarCambios}
                disabled={guardando || marcando || !dirty}
                sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800 }}
              >
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </Button>
              <Button
                variant="contained"
                color="success"
                startIcon={marcando ? <CircularProgress size={14} sx={{ color: 'white' }} /> : <VerifiedIcon />}
                onClick={marcarRevisado}
                disabled={marcando || guardando}
                sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, px: 2.6 }}
              >
                {marcando ? 'Marcando...' : 'Marcar como revisado'}
              </Button>
            </Stack>
          )}
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
              {esPendiente ? 'Enviado a revisión' : 'Aprobado el'}
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>
              {formatFecha(esPendiente ? planSeleccionado.fecha_envio_estrategica : planSeleccionado.fecha_aprobado)}
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

      <Paper elevation={0} sx={{ p: 0, borderRadius: 3.5, border: '1px solid #e2e8f0', background: '#fff', overflow: 'hidden' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 2, pt: 1.6, pb: 1.2 }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Actividades del plan
          </Typography>
          <Chip size="small" label={`${actividadesEdit.length} ${actividadesEdit.length === 1 ? 'actividad' : 'actividades'}`} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 800 }} />
          {esPendiente
            ? <Chip size="small" color="primary" variant="outlined" label="Edición habilitada" sx={{ fontWeight: 800 }} />
            : <Chip size="small" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 800 }} label="Solo lectura" />}
        </Stack>
        <TableContainer sx={{ maxHeight: '65vh' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {COLS.map((col) => (
                  <TableCell
                    key={col.key}
                    sx={{
                      fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc',
                      borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3,
                      minWidth: col.minWidth, width: col.width
                    }}
                  >
                    {col.label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {actividadesEdit.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLS.length} sx={{ textAlign: 'center', color: '#94a3b8', py: 4 }}>
                    Este plan no tiene actividades registradas.
                  </TableCell>
                </TableRow>
              ) : actividadesEdit.map((a, idx) => (
                <TableRow key={a.id || idx} hover>
                  <TableCell sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569' }}>{idx + 1}</TableCell>
                  {COLS.filter((c) => c.key !== 'idx').map((col) => {
                    const value = a[col.key];
                    if (!esPendiente) {
                      const display = col.kind === 'date' ? formatFecha(value) : (value || '—');
                      return (
                        <TableCell key={col.key} sx={{ fontSize: 12.5, color: col.key === 'actividad' ? '#0f172a' : '#334155', fontWeight: col.key === 'meta' ? 700 : 400 }}>
                          {col.key === 'responsable' && value ? (
                            <Stack direction="row" spacing={0.5} alignItems="center">
                              <PersonIcon sx={{ fontSize: 14, color: '#64748b' }} />
                              <span>{value}</span>
                            </Stack>
                          ) : display}
                        </TableCell>
                      );
                    }
                    // Modo edición
                    if (col.kind === 'date') {
                      return (
                        <TableCell key={col.key}>
                          <TextField
                            type="date"
                            size="small"
                            value={value || ''}
                            onChange={(e) => handleEditCell(idx, col.key, e.target.value)}
                            InputLabelProps={{ shrink: true }}
                            sx={{ '& .MuiInputBase-input': { fontSize: 12, py: 0.6 } }}
                          />
                        </TableCell>
                      );
                    }
                    return (
                      <TableCell key={col.key}>
                        <TextField
                          value={value || ''}
                          onChange={(e) => handleEditCell(idx, col.key, e.target.value)}
                          size="small"
                          fullWidth
                          multiline={!!col.multiline}
                          minRows={col.multiline ? 1 : undefined}
                          maxRows={col.multiline ? 4 : undefined}
                          variant="standard"
                          sx={{ '& .MuiInputBase-input': { fontSize: 12.5, lineHeight: 1.4 } }}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {esPendiente && (
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3.5, border: '1px solid #e2e8f0', background: '#fff' }}>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.8 }}>
            Observaciones de revisión (opcional)
          </Typography>
          <TextField
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder="Anota observaciones para Planeación y Efectividad..."
            fullWidth
            multiline
            minRows={3}
            maxRows={8}
          />
          <Alert severity="info" sx={{ borderRadius: 2.5, mt: 1.4 }}>
            Los cambios en actividades se guardan en el plan. Al marcar como revisado, el plan vuelve a Planeación y Efectividad para continuar el flujo hacia el responsable de la dependencia.
          </Alert>
        </Paper>
      )}
    </Stack>
  );
}

export default PlanAccionRevision;