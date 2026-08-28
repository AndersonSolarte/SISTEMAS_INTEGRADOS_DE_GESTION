import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, LinearProgress, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AccountBalanceWalletRoundedIcon from '@mui/icons-material/AccountBalanceWalletRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import QueryStatsRoundedIcon from '@mui/icons-material/QueryStatsRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import PendingActionsRoundedIcon from '@mui/icons-material/PendingActionsRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import { useSnackbar } from 'notistack';
import { abrirAdjuntoLegalizacion, getEstadisticasViaticos, getSolicitudesViaticos, validarLegalizacion } from '../../services/legalizacionViaticosService';
import LegalizacionViaticosFormat from './LegalizacionViaticosFormat';

const currency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
const FILTER_OPTIONS = [
  { key: 'todas', label: 'Todas', icon: DashboardRoundedIcon, color: '#2563eb', soft: '#eff6ff' },
  { key: 'pendientes', label: 'Pendientes', icon: PendingActionsRoundedIcon, color: '#d97706', soft: '#fff7ed' },
  { key: 'aprobadas', label: 'Aprobadas', icon: TaskAltRoundedIcon, color: '#059669', soft: '#ecfdf5' },
  { key: 'legalizacion', label: 'Legalización', icon: FactCheckRoundedIcon, color: '#7c3aed', soft: '#f5f3ff' },
  { key: 'rechazadas', label: 'Rechazadas', icon: CancelRoundedIcon, color: '#dc2626', soft: '#fef2f2' }
];

const rowMatchesFilter = (row, filter) => filter === 'todas'
  || (filter === 'pendientes' && !['no_aprobada', 'legalizacion_finalizada'].includes(row.estado))
  || (filter === 'aprobadas' && ['pago_autorizado_pendiente_legalizacion', 'legalizacion_finalizada'].includes(row.estado))
  || (filter === 'legalizacion' && Boolean(row.legalizacion))
  || (filter === 'rechazadas' && row.estado === 'no_aprobada');

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
  : 'Sin registrar';

const legalizationStatus = (row) => {
  const status = row.legalizacion?.estado;
  if (status === 'en_revision' || status === 'presentada_demo') return { label: 'Por revisar', color: '#d97706', soft: '#fff7ed' };
  if (status === 'finalizada' || status === 'legalizacion_finalizada' || row.estado === 'legalizacion_finalizada') return { label: 'Gestionada', color: '#059669', soft: '#ecfdf5' };
  if (status === 'legalizacion_vencida') return { label: 'Legalización vencida', color: '#dc2626', soft: '#fef2f2' };
  if (status === 'pendiente_habilitacion') return { label: 'Pendiente de fecha de regreso', color: '#64748b', soft: '#f8fafc' };
  if (row.estado === 'pago_autorizado_pendiente_legalizacion') return { label: 'Esperando al colaborador', color: '#2563eb', soft: '#eff6ff' };
  if (row.estado === 'no_aprobada') return { label: 'Trámite rechazado', color: '#dc2626', soft: '#fef2f2' };
  return { label: 'En flujo de aprobación', color: '#475569', soft: '#f8fafc' };
};

const DEMO_ROWS = [
  { id: -1, _demo: true, consecutivo: 'DEMO-VIA-2026-001', estado: 'pendiente_aprobacion', paso_actual: 'jefe', plan_aprobacion: { jefe: { label: 'Jefe inmediato' } }, solicitante_snapshot: { nombre: 'ANA MARÍA DEMOSTRACIÓN' }, datos_laborales: { dependencia: 'Programa Académico de Ejemplo' }, liquidacion: { totalAnticipo: 0 } },
  { id: -2, _demo: true, consecutivo: 'DEMO-VIA-2026-002', estado: 'pago_autorizado_pendiente_legalizacion', solicitante_snapshot: { nombre: 'CARLOS ANDRÉS PRUEBA' }, datos_laborales: { dependencia: 'Vicerrectoría Académica' }, liquidacion: { totalAnticipo: 780000 } },
  { id: -3, _demo: true, consecutivo: 'DEMO-VIA-2026-003', estado: 'pago_autorizado_pendiente_legalizacion', solicitante_snapshot: { nombre: 'LUISA FERNANDA EJEMPLO', email: 'colaborador.prueba@unicesmag.edu.co' }, datos_laborales: { dependencia: 'Dirección de Investigación' }, datos_viaticos: { lugarVisitar: 'Bogotá D. C.', objetoComision: 'Participación en encuentro nacional de investigación.' }, liquidacion: { totalAnticipo: 1250000 }, legalizacion: { id: -3, estado: 'presentada_demo', fecha_habilitacion: '2026-08-10', fecha_limite: '2026-08-13', presentado_at: '2026-08-12T14:20:00-05:00', detalles: [{ id: 'manutencion', detalle: 'Manutención', valorAnticipo: 420000, valorLegalizado: 398500, diferencia: 21500 }, { id: 'alojamiento', detalle: 'Alojamiento', valorAnticipo: 600000, valorLegalizado: 600000, diferencia: 0 }, { id: 'transporte', detalle: 'Transporte terrestre intermunicipal', valorAnticipo: 230000, valorLegalizado: 218000, diferencia: 12000 }], adjuntos: [{ id: 'demo-soporte-1', conceptoId: 'manutencion', detalle: 'Manutención', originalName: 'facturas_manutencion.pdf', mimetype: 'application/pdf', size: 284000 }, { id: 'demo-soporte-2', conceptoId: 'alojamiento', detalle: 'Alojamiento', originalName: 'factura_hotel.pdf', mimetype: 'application/pdf', size: 196000 }, { id: 'demo-soporte-3', conceptoId: 'transporte', detalle: 'Transporte terrestre intermunicipal', originalName: 'tiquetes_transporte.pdf', mimetype: 'application/pdf', size: 143000 }], observaciones: 'Se adjuntan las facturas y tiquetes correspondientes a todos los conceptos autorizados.' } },
  { id: -4, _demo: true, consecutivo: 'DEMO-VIA-2026-004', estado: 'legalizacion_finalizada', solicitante_snapshot: { nombre: 'MATEO SEBASTIÁN MUESTRA', documento: '1085000123' }, datos_laborales: { dependencia: 'Gestión del Talento Humano', cargo: 'Profesional universitario' }, datos_salida: { fecha: '2026-08-05', fechaRegreso: '2026-08-07' }, datos_viaticos: { lugarVisitar: 'Cali, Valle del Cauca', numeroDiasSolicitados: 3, alojamiento: 'Hotel', transporte: 'Terrestre' }, liquidacion: { totalAnticipo: 465000 }, legalizacion: { id: -4, estado: 'finalizada', presentado_at: '2026-08-08T10:15:00-05:00', revisado_at: '2026-08-09T09:35:00-05:00', detalles: [{ id: 'manutencion-final', detalle: 'Manutención', valorAnticipo: 285000, valorLegalizado: 285000, diferencia: 0 }, { id: 'transporte-final', detalle: 'Transporte local', valorAnticipo: 180000, valorLegalizado: 174000, diferencia: 6000 }], adjuntos: [{ id: 'demo-final-1', conceptoId: 'manutencion-final', detalle: 'Manutención', originalName: 'soporte_manutencion.pdf', size: 225000 }, { id: 'demo-final-2', conceptoId: 'transporte-final', detalle: 'Transporte local', originalName: 'soporte_transporte.pdf', size: 118000 }], observaciones: 'Legalización revisada y validada. Saldo a favor de la Universidad: $6.000.' } },
  { id: -5, _demo: true, consecutivo: 'DEMO-VIA-2026-005', estado: 'no_aprobada', solicitante_snapshot: { nombre: 'SOFÍA ISABEL PRUEBA' }, datos_laborales: { dependencia: 'Dirección Administrativa' }, liquidacion: { totalAnticipo: 320000 } }
];

const DEMO_STATS = {
  totals: { solicitudes: 24, liquidado: 18450000, pagoAutorizado: 13980000, legalizado: 11240000, pendienteLegalizar: 5, rechazadas: 3 },
  rubros: [
    { name: 'Alojamiento', total: 5200000 }, { name: 'Manutención', total: 4380000 },
    { name: 'Transporte aéreo', total: 3150000 }, { name: 'Transporte terrestre', total: 2240000 },
    { name: 'Transporte local', total: 1220000 }, { name: 'Otros', total: 530000 }
  ],
  dependencias: [
    { name: 'Vicerrectoría Académica', total: 4680000 }, { name: 'Investigación y Extensión', total: 3920000 },
    { name: 'Rectoría', total: 3140000 }, { name: 'Evangelización de las Culturas', total: 2460000 },
    { name: 'Gestión Administrativa', total: 1510000 }
  ],
  destinos: [
    { name: 'Bogotá D. C.', total: 4250000 }, { name: 'Medellín', total: 3260000 },
    { name: 'Cali', total: 2680000 }, { name: 'Popayán', total: 1940000 }, { name: 'Ipiales', total: 1390000 }
  ],
  actividades: [
    { name: 'Ponencias y congresos', total: 5120000 }, { name: 'Visitas académicas', total: 3840000 },
    { name: 'Comisiones institucionales', total: 3170000 }, { name: 'Investigación', total: 2460000 },
    { name: 'Formación', total: 1390000 }
  ]
};
const stateLabel = (row) => row.legalizacion?.estado === 'legalizacion_vencida' ? 'Legalización vencida' : row.legalizacion?.estado === 'en_revision' ? 'Legalización en revisión' : row.estado === 'pago_autorizado_pendiente_legalizacion' ? 'Pago autorizado – pendiente de legalización' : row.estado === 'no_aprobada' ? 'No aprobada' : row.plan_aprobacion?.[row.paso_actual]?.label ? `Pendiente: ${row.plan_aprobacion[row.paso_actual].label}` : String(row.estado || '').replaceAll('_', ' ');

export default function ViaticosGestionDashboard({ user, onBack }) {
  const permissions = useMemo(() => new Set([...(user?.allowedModules || []), ...(user?.modulePermissions || [])].map((item) => typeof item === 'string' ? item : item.module_key)), [user]);
  const isAdmin = user?.role === 'administrador';
  const canManage = isAdmin || permissions.has('vicerrectoria_financiera.viaticos.gestion');
  const canStats = isAdmin || permissions.has('vicerrectoria_financiera.viaticos.estadistica');
  const [tab, setTab] = useState(canManage ? 'gestion' : 'estadistica');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState(null);
  const [filter, setFilter] = useState('todas');
  const [selected, setSelected] = useState(null);
  const [detailRow, setDetailRow] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmValidationOpen, setConfirmValidationOpen] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const load = async () => {
    setLoading(true);
    try {
      if (canManage) setRows((await getSolicitudesViaticos()).data || []);
      if (canStats) setStats((await getEstadisticasViaticos()).data);
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar la gestión de viáticos.', { variant: 'error' }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const showingDemo = !loading && rows.length === 0;
  const displayRows = showingDemo ? DEMO_ROWS : rows;
  const displayStats = showingDemo && !Number(stats?.totals?.solicitudes || 0) ? DEMO_STATS : stats;
  const filtered = displayRows.filter((row) => rowMatchesFilter(row, filter));
  const filterCounts = useMemo(() => Object.fromEntries(
    FILTER_OPTIONS.map(({ key }) => [key, displayRows.filter((row) => rowMatchesFilter(row, key)).length])
  ), [displayRows]);
  const openReview = (row) => {
    setSelected(row);
    setNotes(row.legalizacion?.observaciones || '');
    setEditValues(Object.fromEntries((row.legalizacion?.detalles || []).map((item) => [item.id, item.valorLegalizado])));
  };
  const openSupport = async (support) => {
    if (!support) return;
    if (selected?._demo) {
      enqueueSnackbar(`Vista de prueba: ${support.originalName}`, { variant: 'info' });
      return;
    }
    try {
      await abrirAdjuntoLegalizacion(selected.legalizacion.id, support.id);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'El soporte temporal ya no está disponible.', { variant: 'error' });
    }
  };
  const selectedDetails = selected?.legalizacion?.detalles || [];
  const selectedAdvance = selectedDetails.reduce((sum, item) => sum + Number(item.valorAnticipo || 0), 0);
  const selectedLegalized = selectedDetails.reduce((sum, item) => sum + Number(editValues[item.id] ?? item.valorLegalizado ?? 0), 0);
  const selectedDifference = selectedAdvance - selectedLegalized;
  const validate = async () => {
    setConfirmValidationOpen(false);
    setSaving(true);
    try {
      await validarLegalizacion(selected.legalizacion.id, { observaciones: notes, detalles: selected.legalizacion.detalles.map((item) => ({ id: item.id, valorLegalizado: Number(editValues[item.id]) })) });
      enqueueSnackbar('Legalización validada y enviada.', { variant: 'success' }); setSelected(null); await load();
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible validar.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const getLastSignatureDate = (row) => {
    if (!row) return null;
    const traces = Array.isArray(row.trazabilidad) ? row.trazabilidad : [];
    if (traces.length > 0) {
      const lastTrace = traces[traces.length - 1];
      if (lastTrace?.at) return lastTrace.at;
    }
    return row.updatedAt || row.updated_at || row.createdAt || row.created_at || null;
  };

  const getBackendApiUrl = () => {
    if (process.env.REACT_APP_API_URL) {
      return process.env.REACT_APP_API_URL.replace(/\/$/, '');
    }
    const port = window.location.port === '3000' ? ':5000' : (window.location.port ? `:${window.location.port}` : '');
    return `${window.location.protocol}//${window.location.hostname}${port}/api`;
  };

  const openStageAction = (row) => {
    if (!row || !row.id) return;
    const baseUrl = getBackendApiUrl();
    window.open(`${baseUrl}/desplazamientos-viaticos/solicitudes/${row.id}/accion-admin`, '_blank');
  };

  const segments = [
    canManage && { key: 'gestion', title: 'Gestión de Viáticos', description: 'Seguimiento integral, liquidaciones y legalizaciones.', icon: ReceiptLongRoundedIcon, color: '#2563eb', soft: '#eff6ff' },
    canStats && { key: 'estadistica', title: 'Estadística de Viáticos', description: 'Indicadores financieros y análisis institucional.', icon: QueryStatsRoundedIcon, color: '#7c3aed', soft: '#f5f3ff' }
  ].filter(Boolean);

  return <Box sx={{ maxWidth: 1500, mx: 'auto' }}>
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        mb: 2.2,
        p: { xs: 2, sm: 2.6, md: 3.2 },
        borderRadius: { xs: 3, md: 4 },
        color: '#fff',
        background: 'linear-gradient(125deg, #082f5f 0%, #0b4f91 58%, #2563eb 100%)',
        boxShadow: '0 20px 45px rgba(11,58,111,.20)',
        '&:after': { content: '""', position: 'absolute', width: 260, height: 260, borderRadius: '50%', right: -80, top: -145, bgcolor: 'rgba(255,255,255,.10)' }
      }}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={2} sx={{ position: 'relative', zIndex: 1 }}>
        <Stack direction="row" spacing={1.7} alignItems="center">
          <Box sx={{ width: { xs: 48, md: 58 }, height: { xs: 48, md: 58 }, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.15)', border: '1px solid rgba(255,255,255,.25)' }}>
            <AccountBalanceWalletRoundedIcon sx={{ fontSize: { xs: 27, md: 32 } }} />
          </Box>
          <Box>
            <Typography variant="overline" sx={{ color: '#bfdbfe', fontWeight: 900, letterSpacing: 1.15 }}>Vicerrectoría Financiera y de Desarrollo Institucional</Typography>
            <Typography variant="h4" sx={{ fontWeight: 950, lineHeight: 1.1, fontSize: { xs: 25, md: 34 } }}>Viáticos</Typography>
            <Typography sx={{ mt: 0.5, color: '#dbeafe', fontSize: { xs: 13, md: 14.5 } }}>Gestión financiera, legalización y análisis institucional en un solo espacio.</Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button onClick={onBack} startIcon={<ArrowBackRoundedIcon />} sx={{ color: '#fff', borderColor: 'rgba(255,255,255,.4)', bgcolor: 'rgba(255,255,255,.08)', '&:hover': { bgcolor: 'rgba(255,255,255,.16)', borderColor: '#fff' } }} variant="outlined">Volver</Button>
          <Tooltip title="Actualizar información"><IconButton onClick={load} sx={{ color: '#fff', border: '1px solid rgba(255,255,255,.4)', bgcolor: 'rgba(255,255,255,.08)', '&:hover': { bgcolor: 'rgba(255,255,255,.16)' } }}><RefreshRoundedIcon /></IconButton></Tooltip>
        </Stack>
      </Stack>
    </Paper>

    {segments.length > 0 ? (
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: segments.length > 1 ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)' }, gap: 1.5, mb: 2.2 }}>
        {segments.map((segment) => {
          const SegmentIcon = segment.icon;
          const active = tab === segment.key;
          return <Paper key={segment.key} component="button" type="button" onClick={() => setTab(segment.key)} elevation={0} sx={{ width: '100%', p: { xs: 1.7, sm: 2 }, borderRadius: 3, border: `2px solid ${active ? segment.color : '#e2e8f0'}`, bgcolor: active ? segment.soft : '#fff', textAlign: 'left', cursor: 'pointer', font: 'inherit', transition: 'transform .2s ease, box-shadow .2s ease, border-color .2s ease', boxShadow: active ? `0 13px 30px ${segment.color}22` : '0 7px 20px rgba(15,23,42,.05)', '&:hover': { transform: 'translateY(-2px)', borderColor: segment.color, boxShadow: `0 15px 32px ${segment.color}20` } }}>
            <Stack direction="row" alignItems="center" spacing={1.5}>
              <Box sx={{ width: 46, height: 46, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 2.2, color: '#fff', bgcolor: segment.color, boxShadow: `0 9px 20px ${segment.color}40` }}><SegmentIcon /></Box>
              <Box sx={{ minWidth: 0, flex: 1 }}><Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: { xs: 16, sm: 17 } }}>{segment.title}</Typography><Typography sx={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.4 }}>{segment.description}</Typography></Box>
              <ArrowForwardRoundedIcon sx={{ color: segment.color, transform: active ? 'translateX(3px)' : 'none', transition: 'transform .2s ease' }} />
            </Stack>
          </Paper>;
        })}
      </Box>
    ) : <Alert severity="warning" sx={{ mb: 2 }}>El usuario tiene acceso al módulo de Viáticos, pero no tiene habilitado Gestión ni Estadística.</Alert>}

    {loading && <LinearProgress sx={{ mb: 2, borderRadius: 99 }} />}
    {showingDemo && <Alert severity="info" icon={<QueryStatsRoundedIcon />} sx={{ mb: 2, borderRadius: 2.5, border: '1px solid #93c5fd', bgcolor: '#eff6ff', color: '#0f3b73', '& .MuiAlert-message': { width: '100%' } }}>
      <Typography fontWeight={900}>Vista demostrativa · Datos de prueba</Typography>
      <Typography variant="body2">Estos registros y valores son ficticios, no están guardados en la base de datos y no generan correos ni actuaciones del flujo.</Typography>
    </Alert>}
    {!loading && segments.length > 0 && ((tab === 'gestion' && canManage) ? <>
      <Box
        role="group"
        aria-label="Filtros de solicitudes de viáticos"
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(5, minmax(0, 1fr))' },
          gap: 1.25,
          mb: 2.2
        }}
      >
        {FILTER_OPTIONS.map((option) => {
          const FilterIcon = option.icon;
          const active = filter === option.key;
          return (
            <Paper
              key={option.key}
              component="button"
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.key)}
              elevation={0}
              sx={{
                minWidth: 0,
                minHeight: { xs: 70, md: 78 },
                px: { xs: 1.5, md: 1.7 },
                py: 1.35,
                borderRadius: 3,
                border: `1px solid ${active ? option.color : '#dbe5f1'}`,
                color: active ? '#fff' : '#0f172a',
                background: active ? `linear-gradient(135deg, ${option.color}, ${option.color}dd)` : '#fff',
                boxShadow: active ? `0 12px 25px ${option.color}35` : '0 5px 16px rgba(15,23,42,.05)',
                cursor: 'pointer',
                font: 'inherit',
                textAlign: 'left',
                transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                '&:hover': { transform: 'translateY(-2px)', borderColor: option.color, boxShadow: `0 12px 26px ${option.color}26` },
                '&:focus-visible': { outline: `3px solid ${option.color}40`, outlineOffset: 2 }
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <Box sx={{ width: 40, height: 40, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 2, color: active ? '#fff' : option.color, bgcolor: active ? 'rgba(255,255,255,.17)' : option.soft }}>
                  <FilterIcon sx={{ fontSize: 22 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: 11, lineHeight: 1.1, fontWeight: 900, letterSpacing: .45, textTransform: 'uppercase', color: active ? 'rgba(255,255,255,.88)' : '#64748b' }}>
                    {option.label}
                  </Typography>
                  <Typography sx={{ mt: .35, fontSize: 21, lineHeight: 1, fontWeight: 950, color: 'inherit' }}>
                    {filterCounts[option.key] || 0}
                  </Typography>
                </Box>
                {active && <CheckCircleRoundedIcon sx={{ fontSize: 19, color: 'rgba(255,255,255,.9)' }} />}
              </Stack>
            </Paper>
          );
        })}
      </Box>
      <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, maxWidth: '100%', overflowX: 'auto', boxShadow: '0 10px 28px rgba(15,23,42,.05)' }}>
        <Table sx={{ minWidth: 880, tableLayout: 'auto' }}>
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ py: 1, px: 1.2, fontSize: 10.5, fontWeight: 900, color: '#334155', whiteSpace: 'nowrap' }}>Consecutivo / Colaborador</TableCell>
              <TableCell sx={{ py: 1, px: 1, fontSize: 10.5, fontWeight: 900, color: '#334155' }}>Estado del trámite</TableCell>
              <TableCell sx={{ py: 1, px: 1, fontSize: 10.5, fontWeight: 900, color: '#334155', whiteSpace: 'nowrap' }}>F. Última Firma</TableCell>
              <TableCell sx={{ py: 1, px: 1, fontSize: 10.5, fontWeight: 900, color: '#334155' }}>Legalización</TableCell>
              <TableCell align="center" sx={{ py: 1, px: 1, fontSize: 10.5, fontWeight: 900, color: '#334155' }}>Soportes / Presentación</TableCell>
              <TableCell align="right" sx={{ py: 1, px: 1, fontSize: 10.5, fontWeight: 900, color: '#334155' }}>Anticipo</TableCell>
              <TableCell align="center" sx={{ py: 1, px: 1, fontSize: 10.5, fontWeight: 900, color: '#334155' }}>Gestión / Revisión</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((row) => {
              const legalStatus = legalizationStatus(row);
              const supportCount = row.legalizacion?.adjuntos?.length || 0;
              const canReview = Boolean(row.legalizacion);
              const isTecnicoContableStep = row.estado === 'pendiente_tecnico_contable' || row.token_etapa === 'tecnico_contable';
              const isTesoreriaStep = row.estado === 'pendiente_tesoreria' || row.token_etapa === 'tesoreria';

              return <TableRow key={row.id} hover sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell sx={{ py: 0.8, px: 1.2 }}>
                  <Stack spacing={0.2}>
                    <Stack direction="row" alignItems="center" spacing={0.6}>
                      <Typography fontWeight={900} color="#0b3a6f" sx={{ fontSize: 11, lineHeight: 1.1 }}>{row.consecutivo}</Typography>
                      {row._demo && <Chip label="PRUEBA" size="small" sx={{ height: 16, bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 900, fontSize: 8.5, px: 0.3 }} />}
                    </Stack>
                    <Typography fontWeight={750} sx={{ fontSize: 10.5, color: '#0f172a', lineHeight: 1.1 }}>{row.solicitante_snapshot?.nombre}</Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: 9.5, lineHeight: 1.15 }}>{row.datos_laborales?.dependencia}</Typography>
                  </Stack>
                </TableCell>
                <TableCell sx={{ py: 0.8, px: 1 }}>
                  <Chip size="small" color={row.estado === 'no_aprobada' ? 'error' : 'primary'} variant="outlined" label={stateLabel(row)} sx={{ maxWidth: 210, fontSize: 9.5, height: 22, '& .MuiChip-label': { px: 0.8, py: 0 } }} />
                </TableCell>
                <TableCell sx={{ py: 0.8, px: 1, whiteSpace: 'nowrap' }}>
                  {(() => {
                    const rawDate = getLastSignatureDate(row);
                    if (!rawDate) return <Typography sx={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>Pendiente</Typography>;
                    const dateObj = new Date(rawDate);
                    if (Number.isNaN(dateObj.getTime())) return <Typography sx={{ fontSize: 10, color: '#94a3b8' }}>-</Typography>;
                    return (
                      <Stack spacing={0.1}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#334155', lineHeight: 1.15 }}>
                          {dateObj.toLocaleDateString('es-CO')}
                        </Typography>
                        <Typography sx={{ fontSize: 9, fontWeight: 600, color: '#64748b', lineHeight: 1.15 }}>
                          {dateObj.toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit' })}
                        </Typography>
                      </Stack>
                    );
                  })()}
                </TableCell>
                <TableCell sx={{ py: 0.8, px: 1 }}>
                  <Chip size="small" icon={legalStatus.label === 'Gestionada' ? <VerifiedRoundedIcon /> : legalStatus.label === 'Por revisar' ? <ScheduleRoundedIcon /> : undefined} label={legalStatus.label} sx={{ color: legalStatus.color, bgcolor: legalStatus.soft, border: `1px solid ${legalStatus.color}35`, fontWeight: 850, fontSize: 9.5, height: 22, '& .MuiChip-icon': { color: legalStatus.color, fontSize: 14 } }} />
                </TableCell>
                <TableCell align="center" sx={{ py: 0.8, px: 1 }}>
                  <Stack spacing={0.3} alignItems="center">
                    <Chip size="small" icon={<AttachFileRoundedIcon />} label={`${supportCount} soportes`} variant={supportCount ? 'filled' : 'outlined'} sx={{ bgcolor: supportCount ? '#eef2ff' : 'transparent', color: supportCount ? '#4f46e5' : '#94a3b8', fontWeight: 900, fontSize: 9, height: 19, '& .MuiChip-icon': { color: 'inherit', fontSize: 12 } }} />
                    <Typography variant="caption" sx={{ fontSize: 9, color: row.legalizacion?.presentado_at ? '#334155' : '#94a3b8' }}>
                      {row.legalizacion?.presentado_at ? formatDateTime(row.legalizacion.presentado_at) : 'Sin presentar'}
                    </Typography>
                  </Stack>
                </TableCell>
                <TableCell align="right" sx={{ py: 0.8, px: 1, whiteSpace: 'nowrap' }}>
                  <Typography fontWeight={900} sx={{ fontSize: 11, color: '#0b3a6f' }}>{currency(row.liquidacion?.totalAnticipo)}</Typography>
                </TableCell>
                <TableCell align="center" sx={{ py: 0.8, px: 1 }}>
                  {isTecnicoContableStep ? (
                    <Button size="small" variant="contained" color="primary" onClick={() => openStageAction(row)} sx={{ textTransform: 'none', fontWeight: 850, fontSize: 10, py: 0.4, px: 1.2, borderRadius: 1.5, minWidth: 'auto', whiteSpace: 'nowrap' }}>
                      Liquidar
                    </Button>
                  ) : isTesoreriaStep ? (
                    <Button size="small" variant="contained" color="info" onClick={() => openStageAction(row)} sx={{ textTransform: 'none', fontWeight: 850, fontSize: 10, py: 0.4, px: 1.2, borderRadius: 1.5, minWidth: 'auto', whiteSpace: 'nowrap' }}>
                      Autorizar Pago
                    </Button>
                  ) : canReview ? (
                    <Tooltip title={legalStatus.label === 'Gestionada' ? 'Consultar legalización gestionada' : 'Abrir revisión de legalización'}>
                      <IconButton size="small" onClick={() => openReview(row)} sx={{ p: 0.5, color: legalStatus.color, bgcolor: legalStatus.soft, border: `1px solid ${legalStatus.color}35`, '&:hover': { bgcolor: `${legalStatus.color}18` } }}>
                        <VisibilityRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  ) : (
                    <Tooltip title="Abrir y gestionar formulario de la etapa o consultar documento">
                      <IconButton size="small" onClick={() => openStageAction(row)} sx={{ p: 0.5, color: '#0b3a6f', bgcolor: '#eff6ff', border: '1px solid #bfdbfe', '&:hover': { bgcolor: '#dbeafe' } }}>
                        <VisibilityRoundedIcon sx={{ fontSize: 17 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </TableCell>
              </TableRow>;
            })}
            {filtered.length === 0 && <TableRow><TableCell colSpan={7} align="center" sx={{ py: 5 }}><Typography fontWeight={800} color="text.secondary">No hay solicitudes en este estado.</Typography></TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </> : canStats ? <StatsPanel stats={displayStats} /> : null)}
    <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 3.5, overflow: 'hidden' } }}>
      <DialogTitle sx={{ px: { xs: 2, md: 3 }, py: 2, color: '#fff', background: 'linear-gradient(120deg,#082f5f,#2563eb)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1}>
          <Box><Typography variant="overline" sx={{ color: '#bfdbfe', fontWeight: 900 }}>Revisión del Técnico Contable</Typography><Typography variant="h6" fontWeight={950}>Legalización · {selected?.consecutivo}</Typography></Box>
          {selected && <Chip label={legalizationStatus(selected).label} icon={<FactCheckRoundedIcon />} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.16)', fontWeight: 850, '& .MuiChip-icon': { color: '#fff' } }} />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: { xs: 2, md: 3 }, bgcolor: '#f8fafc' }}>
        <LegalizacionViaticosFormat
          solicitud={selected}
          legalizacion={selected?.legalizacion}
          mode="technician"
          editable={selected?.legalizacion?.estado === 'en_revision' || (selected?._demo && selected?.legalizacion?.estado === 'presentada_demo')}
          values={editValues}
          onValueChange={(id, value) => setEditValues((current) => ({ ...current, [id]: value }))}
          observations={notes}
          onObservationsChange={setNotes}
          onOpenSupport={openSupport}
          demo={Boolean(selected?._demo)}
        />
        {false && <Stack spacing={2.2}>
          {selected?._demo && <Alert severity="info" sx={{ borderRadius: 2 }}>Esta es una simulación completa. Los botones de soporte no abren archivos reales y la validación está deshabilitada.</Alert>}

          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, bgcolor: '#fff' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', md: 'repeat(4,1fr)' }, gap: 1.5 }}>
              <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>COLABORADOR</Typography><Typography fontWeight={850}>{selected?.solicitante_snapshot?.nombre || 'Sin registrar'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>DEPENDENCIA</Typography><Typography fontWeight={750}>{selected?.datos_laborales?.dependencia || 'Sin registrar'}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>PRESENTADA</Typography><Typography fontWeight={750}>{formatDateTime(selected?.legalizacion?.presentado_at)}</Typography></Box>
              <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>SOPORTES RECIBIDOS</Typography><Typography fontWeight={900} color="#4f46e5">{selected?.legalizacion?.adjuntos?.length || 0} archivo(s)</Typography></Box>
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,1fr)' }, gap: 1.2 }}>
            {[{ label: 'Anticipo autorizado', value: selectedAdvance, color: '#2563eb', soft: '#eff6ff' }, { label: 'Valor legalizado', value: selectedLegalized, color: '#059669', soft: '#ecfdf5' }, { label: selectedDifference >= 0 ? 'Saldo a favor Universidad' : 'Saldo a favor colaborador', value: Math.abs(selectedDifference), color: selectedDifference === 0 ? '#059669' : '#d97706', soft: selectedDifference === 0 ? '#ecfdf5' : '#fff7ed' }].map((card) => <Paper key={card.label} elevation={0} sx={{ p: 1.7, borderRadius: 2.5, bgcolor: card.soft, border: `1px solid ${card.color}30` }}><Typography variant="caption" sx={{ color: card.color, fontWeight: 900 }}>{card.label.toUpperCase()}</Typography><Typography variant="h6" sx={{ mt: .3, color: card.color, fontWeight: 950 }}>{currency(card.value)}</Typography></Paper>)}
          </Box>

          <Box><Typography sx={{ mb: 1, color: '#0f172a', fontWeight: 950, fontSize: 17 }}>Conceptos y soportes para revisión</Typography>
            <Stack spacing={1.2}>
              {selectedDetails.map((item) => {
                const support = selected?.legalizacion?.adjuntos?.find((file) => file.conceptoId === item.id);
                const currentLegalized = Number(editValues[item.id] ?? item.valorLegalizado ?? 0);
                const difference = Number(item.valorAnticipo || 0) - currentLegalized;
                return <Paper key={item.id} variant="outlined" sx={{ p: 1.7, borderRadius: 2.5, bgcolor: '#fff', display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.35fr .7fr .75fr 1fr' }, gap: 1.4, alignItems: 'center' }}>
                  <Box><Typography fontWeight={900}>{item.detalle}</Typography><Typography variant="caption" color="text.secondary">Anticipo: {currency(item.valorAnticipo)}</Typography></Box>
                  <TextField size="small" type="number" label="Valor legalizado" value={editValues[item.id] ?? ''} disabled={selected?._demo || selected?.legalizacion?.estado !== 'en_revision'} onChange={(event) => setEditValues((current) => ({ ...current, [item.id]: event.target.value }))} InputProps={{ startAdornment: <Typography sx={{ mr: .6, color: '#64748b' }}>$</Typography> }} />
                  <Box><Typography variant="caption" color="text.secondary" fontWeight={800}>DIFERENCIA</Typography><Typography fontWeight={900} color={difference === 0 ? '#059669' : '#d97706'}>{currency(difference)}</Typography></Box>
                  <Button variant={support ? 'outlined' : 'text'} disabled={!support} onClick={() => openSupport(support)} startIcon={<AttachFileRoundedIcon />} sx={{ justifyContent: 'flex-start', textTransform: 'none', fontWeight: 800, overflow: 'hidden' }}>{support?.originalName || 'Soporte no recibido'}</Button>
                </Paper>;
              })}
              {selectedDetails.length === 0 && <Alert severity="warning">Esta legalización todavía no contiene conceptos presentados por el colaborador.</Alert>}
            </Stack>
          </Box>

          <TextField multiline minRows={3} label="Observaciones de la revisión" value={notes} disabled={selected?._demo || selected?.legalizacion?.estado !== 'en_revision'} onChange={(event) => setNotes(event.target.value)} helperText={selected?.legalizacion?.estado === 'en_revision' ? 'El Técnico Contable puede ajustar los valores y dejar constancia antes de validar.' : 'Consulta de una legalización que ya no admite cambios.'} />
        </Stack>}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 1.7 }}><Button onClick={() => setSelected(null)}>Cerrar</Button>{selected?._demo && <Chip label="Validación deshabilitada en datos de prueba" color="info" variant="outlined" />}{!selected?._demo && selected?.legalizacion?.estado === 'en_revision' && <Button variant="contained" color="success" startIcon={saving ? <CircularProgress size={18} /> : <CheckCircleRoundedIcon />} disabled={saving} onClick={() => setConfirmValidationOpen(true)}>Validar y finalizar legalización</Button>}</DialogActions>
    </Dialog>
    <Dialog open={confirmValidationOpen} onClose={() => !saving && setConfirmValidationOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ fontWeight: 950, color: '#0b3a6f' }}>Confirmar validación final</DialogTitle>
      <DialogContent dividers><Alert severity="warning" sx={{ mb: 1.5 }}>Esta actuación finaliza la legalización y no podrá editarse nuevamente.</Alert><Typography>Al confirmar, se generará el PDF firmado, se enviará junto con los soportes al colaborador y al Técnico Contable, y después se eliminarán los anexos temporales del servidor.</Typography></DialogContent>
      <DialogActions sx={{ p: 2 }}><Button disabled={saving} onClick={() => setConfirmValidationOpen(false)}>Cancelar</Button><Button disabled={saving} variant="contained" color="success" startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <CheckCircleRoundedIcon />} onClick={validate}>Confirmar y finalizar</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(detailRow)} onClose={() => setDetailRow(null)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3 } }}>
      <DialogTitle sx={{ background: 'linear-gradient(120deg, #082f5f, #2563eb)', color: '#fff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="overline" sx={{ color: '#bfdbfe', fontWeight: 900 }}>Detalle de la Solicitud</Typography>
            <Typography variant="h6" fontWeight={950}>{detailRow?.consecutivo}</Typography>
          </Box>
          {detailRow && <Chip label={stateLabel(detailRow)} sx={{ bgcolor: 'rgba(255,255,255,.2)', color: '#fff', fontWeight: 850 }} />}
        </Stack>
      </DialogTitle>
      <DialogContent dividers sx={{ p: 3, bgcolor: '#f8fafc' }}>
        {detailRow && (
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#fff' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 2 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>COLABORADOR</Typography>
                  <Typography fontWeight={850}>{detailRow.solicitante_snapshot?.nombre || 'Sin registrar'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>DEPENDENCIA</Typography>
                  <Typography fontWeight={750}>{detailRow.datos_laborales?.dependencia || 'Sin registrar'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>ANTICIPO CALCULADO</Typography>
                  <Typography fontWeight={900} color="#059669">{currency(detailRow.liquidacion?.totalAnticipo)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" fontWeight={800}>ÚLTIMA FIRMA / GESTIÓN</Typography>
                  <Typography fontWeight={750}>{formatDateTime(getLastSignatureDate(detailRow))}</Typography>
                </Box>
              </Box>
            </Paper>

            <Typography variant="subtitle2" fontWeight={900} color="#0b3a6f">Historial y Trazabilidad de Aprobaciones</Typography>
            <Stack spacing={1}>
              {Array.isArray(detailRow.trazabilidad) && detailRow.trazabilidad.map((t, idx) => (
                <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#fff' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center">
                    <Box>
                      <Typography variant="body2" fontWeight={800}>{t.evento || t.event || 'Firma / Actuación'}</Typography>
                      <Typography variant="caption" color="text.secondary">{t.actor?.nombre || t.actor?.role || 'Sistema / Instancia'}</Typography>
                    </Box>
                    <Typography variant="caption" fontWeight={700} color="#475569">
                      {t.at ? new Date(t.at).toLocaleString('es-CO') : '-'}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
              {(!detailRow.trazabilidad || detailRow.trazabilidad.length === 0) && (
                <Alert severity="info" sx={{ borderRadius: 2 }}>Sin trazabilidad registrada aún.</Alert>
              )}
            </Stack>
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button onClick={() => setDetailRow(null)}>Cerrar</Button>
        {detailRow && (detailRow.token_accion_hash || detailRow.token) && (
          <Button variant="contained" color="primary" onClick={() => openStageAction(detailRow)}>
            Ir a la gestión del paso
          </Button>
        )}
      </DialogActions>
    </Dialog>
  </Box>;
}

function StatsPanel({ stats }) {
  if (!stats) return <Alert severity="info">No hay información estadística disponible.</Alert>;
  const cards = [
    { label: 'Solicitudes', value: stats.totals.solicitudes, helper: 'Trámites registrados', icon: ReceiptLongRoundedIcon, color: '#1d4ed8', soft: '#eff6ff', gradient: 'linear-gradient(135deg,#2563eb,#1d4ed8)' },
    { label: 'Valor liquidado', value: currency(stats.totals.liquidado), helper: 'Recursos calculados', icon: AccountBalanceWalletRoundedIcon, color: '#0f766e', soft: '#ecfdf5', gradient: 'linear-gradient(135deg,#0d9488,#0f766e)' },
    { label: 'Pago autorizado', value: currency(stats.totals.pagoAutorizado), helper: 'Aprobado por Tesorería', icon: VerifiedRoundedIcon, color: '#047857', soft: '#ecfdf5', gradient: 'linear-gradient(135deg,#10b981,#047857)' },
    { label: 'Valor legalizado', value: currency(stats.totals.legalizado), helper: 'Recursos soportados', icon: FactCheckRoundedIcon, color: '#6d28d9', soft: '#f5f3ff', gradient: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
    { label: 'Pendientes de legalización', value: stats.totals.pendienteLegalizar, helper: 'Requieren seguimiento', icon: ScheduleRoundedIcon, color: '#b45309', soft: '#fff7ed', gradient: 'linear-gradient(135deg,#f59e0b,#d97706)' },
    { label: 'Rechazadas', value: stats.totals.rechazadas, helper: 'Trámites no aprobados', icon: CancelRoundedIcon, color: '#b91c1c', soft: '#fef2f2', gradient: 'linear-gradient(135deg,#ef4444,#b91c1c)' }
  ];
  const distribution = (title, data) => { const maximum = Math.max(1, ...(data || []).map((item) => item.total)); return <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography variant="h6" fontWeight={900} sx={{ mb: 2 }}>{title}</Typography><Stack spacing={1.5}>{(data || []).slice(0, 10).map((item) => <Box key={item.name}><Stack direction="row" justifyContent="space-between" gap={2}><Typography noWrap>{item.name}</Typography><Typography fontWeight={800}>{currency(item.total)}</Typography></Stack><Box sx={{ mt: .5, height: 10, bgcolor: '#e2e8f0', borderRadius: 99, overflow: 'hidden' }}><Box sx={{ height: '100%', width: `${Math.max(2, item.total / maximum * 100)}%`, background: 'linear-gradient(90deg,#2563eb,#4f46e5)' }} /></Box></Box>)}</Stack></Paper>; };
  return <Stack spacing={2.5}>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: { xs: 1.25, md: 1.7 } }}>
      {cards.map((card) => {
        const Icon = card.icon;
        return <Paper key={card.label} elevation={0} sx={{ position: 'relative', minWidth: 0, minHeight: 132, p: { xs: 2, md: 2.25 }, borderRadius: 3.5, overflow: 'hidden', border: `1px solid ${card.color}24`, bgcolor: '#fff', boxShadow: '0 12px 32px rgba(15,23,42,.07)', transition: 'transform .2s ease, box-shadow .2s ease', '&:hover': { transform: 'translateY(-3px)', boxShadow: `0 18px 38px ${card.color}20` }, '&::after': { content: '""', position: 'absolute', width: 110, height: 110, borderRadius: '50%', top: -58, right: -35, bgcolor: card.soft } }}>
          <Stack direction="row" alignItems="flex-start" justifyContent="space-between" gap={1.5} sx={{ position: 'relative', zIndex: 1 }}>
            <Box minWidth={0}>
              <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 950, letterSpacing: .75, textTransform: 'uppercase' }}>{card.label}</Typography>
              <Typography sx={{ mt: .55, color: '#0f2747', fontSize: { xs: 24, md: 27 }, lineHeight: 1.1, fontWeight: 950, letterSpacing: -.65, overflowWrap: 'anywhere' }}>{card.value}</Typography>
              <Typography sx={{ mt: 1, color: '#64748b', fontSize: 12.5, fontWeight: 650 }}>{card.helper}</Typography>
            </Box>
            <Box sx={{ width: 46, height: 46, flex: '0 0 auto', display: 'grid', placeItems: 'center', borderRadius: 2.5, color: '#fff', background: card.gradient, boxShadow: `0 9px 20px ${card.color}38` }}><Icon sx={{ fontSize: 24 }} /></Box>
          </Stack>
          <Box sx={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 4, background: card.gradient }} />
        </Paper>;
      })}
    </Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2,1fr)' }, gap: 2 }}>{distribution('Distribución por rubro', stats.rubros)}{distribution('Distribución por dependencia', stats.dependencias)}{distribution('Distribución por destino', stats.destinos)}{distribution('Distribución por actividad', stats.actividades)}</Box>
  </Stack>;
}
