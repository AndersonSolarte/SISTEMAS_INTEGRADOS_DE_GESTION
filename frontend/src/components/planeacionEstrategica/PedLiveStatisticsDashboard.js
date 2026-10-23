import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Fade,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import {
  AccountTree,
  ArrowBack,
  Assessment,
  CalendarMonth,
  CheckCircle,
  CorporateFare,
  Download,
  ExpandLess,
  ExpandMore,
  FiberManualRecord,
  Flag,
  HourglassBottom,
  Insights,
  ListAlt,
  Refresh,
  Search,
  ShowChart,
  Timeline,
  TrendingUp
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import XLSXStyle from 'xlsx-js-style';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../../services/strategicPlanningService';

export default function PedLiveStatisticsDashboard({ onBack }) {
  const { enqueueSnackbar } = useSnackbar();

  // Estados de carga y filtros
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const [availablePlans, setAvailablePlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [selectedYear, setSelectedYear] = useState('all');
  const [selectedDependencyId, setSelectedDependencyId] = useState('all');
  const [activeTab, setActiveTab] = useState('objectives');

  // Datos consolidados
  const [statsData, setStatsData] = useState(null);
  const [expandedObjectives, setExpandedObjectives] = useState({});
  const [dependencySearch, setDependencySearch] = useState('');

  // Carga de datos desde la API
  const loadStatistics = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const params = {};
      if (selectedPlanId) params.planId = selectedPlanId;
      if (selectedYear !== 'all') params.year = selectedYear;
      if (selectedDependencyId !== 'all') params.catalogItemId = selectedDependencyId;

      const response = await strategicPlanningService.getLiveStatistics(params);
      const data = response?.data || response;

      setStatsData(data);
      if (data?.availablePlans?.length && !availablePlans.length) {
        setAvailablePlans(data.availablePlans);
      }
      if (data?.plan?.id && !selectedPlanId) {
        setSelectedPlanId(data.plan.id);
      }
      setLastUpdated(new Date());

      // Expandir por defecto los primeros objetivos
      if (data?.objectives?.length) {
        const initExpanded = {};
        data.objectives.slice(0, 3).forEach((o, idx) => {
          initExpanded[o.name || idx] = true;
        });
        setExpandedObjectives((prev) => (Object.keys(prev).length ? prev : initExpanded));
      }

      if (isRefresh) {
        enqueueSnackbar('Datos estadísticos actualizados en tiempo real.', { variant: 'success' });
      }
    } catch (err) {
      console.error('Error loading PED live statistics:', err);
      enqueueSnackbar('No se pudieron cargar las estadísticas en vivo del PED.', { variant: 'error' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedPlanId, selectedYear, selectedDependencyId, availablePlans.length, enqueueSnackbar]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const toggleObjective = (name) => {
    setExpandedObjectives((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  // Filtrado de tabla de dependencias
  const filteredDependencies = useMemo(() => {
    if (!statsData?.dependenciesProgress) return [];
    if (!dependencySearch.trim()) return statsData.dependenciesProgress;
    const q = dependencySearch.toLowerCase().trim();
    return statsData.dependenciesProgress.filter(
      (dep) =>
        dep.name.toLowerCase().includes(q) ||
        (dep.responsible && dep.responsible.toLowerCase().includes(q)) ||
        (dep.code && dep.code.toLowerCase().includes(q))
    );
  }, [statsData?.dependenciesProgress, dependencySearch]);

  // Exportar consolidado a Excel
  const exportToExcel = () => {
    if (!statsData) return;
    try {
      const wb = XLSXStyle.utils.book_new();

      // Hoja 1: Resumen de Objetivos y Lineamientos
      const objRows = [];
      objRows.push(['PLAN ESTRATÉGICO DE DESARROLLO', statsData.plan?.name || 'PED']);
      objRows.push(['Vigencia seleccionada', selectedYear === 'all' ? 'Todas las vigencias' : selectedYear]);
      objRows.push(['Ejecución General', `${statsData.kpis?.ejecucionGeneral || 0}%`]);
      objRows.push([]);
      objRows.push(['TIPO', 'NOMBRE', 'ACTIVIDADES', 'AVANCE PROMEDIO (%)', 'SIN INICIAR', 'EN EJECUCIÓN', 'COMPLETADAS']);

      statsData.objectives.forEach((obj) => {
        objRows.push(['OBJETIVO', obj.name, obj.totalActivities, `${obj.avgProgress}%`, obj.sinIniciar, obj.enEjecucion, obj.completadas]);
        (obj.guidelines || []).forEach((g) => {
          objRows.push(['LINEAMIENTO', `  └ ${g.name}`, g.totalActivities, `${g.avgProgress}%`, g.sinIniciar, g.enEjecucion, g.completadas]);
        });
      });

      const wsObj = XLSXStyle.utils.aoa_to_sheet(objRows);
      XLSXStyle.utils.book_append_sheet(wb, wsObj, 'OBJETIVOS Y LINEAMIENTOS');

      // Hoja 2: Dependencias
      const depRows = [];
      depRows.push(['DEPENDENCIA', 'CÓDIGO PLAN', 'RESPONSABLE', 'ACTIVIDADES', 'AVANCE PROMEDIO (%)', 'ESTADO']);
      statsData.dependenciesProgress.forEach((dep) => {
        depRows.push([
          dep.name,
          dep.planCodes?.join(', ') || '—',
          dep.responsible || '—',
          dep.activitiesCount,
          `${dep.avgProgress}%`,
          dep.status || '—'
        ]);
      });
      const wsDep = XLSXStyle.utils.aoa_to_sheet(depRows);
      XLSXStyle.utils.book_append_sheet(wb, wsDep, 'PLANES POR DEPENDENCIA');

      const fileName = `ESTADISTICAS_${statsData.plan?.code || 'PED'}_${selectedYear === 'all' ? 'CONSOLIDADO' : selectedYear}.xlsx`;
      XLSXStyle.writeFile(wb, fileName);
      enqueueSnackbar(`Reporte estadístico descargado (${fileName}).`, { variant: 'success' });
    } catch (e) {
      console.error(e);
      enqueueSnackbar('No fue posible exportar el reporte a Excel.', { variant: 'error' });
    }
  };

  const kpis = statsData?.kpis || {
    totalObjetivos: 0,
    totalLineamientos: 0,
    totalActividades: 0,
    totalIndicadores: 0,
    ejecucionGeneral: 0,
    sinIniciar: 0,
    enEjecucion: 0,
    completadas: 0
  };

  // Datos para gráfico de Objetivos
  const objectivesChartData = useMemo(() => {
    if (!statsData?.objectives) return [];
    return statsData.objectives.map((o, idx) => ({
      shortName: o.name.length > 35 ? `${o.name.slice(0, 32)}…` : o.name,
      fullName: o.name,
      avance: o.avgProgress,
      actividades: o.totalActivities
    }));
  }, [statsData?.objectives]);

  // Datos para gráfico de Vigencias
  const termsChartData = useMemo(() => {
    if (!statsData?.termsProgress) return [];
    return statsData.termsProgress.map((t) => ({
      year: String(t.year),
      avance: t.avgProgress,
      actividades: t.activitiesCount,
      planes: t.plansCount
    }));
  }, [statsData?.termsProgress]);

  return (
    <Fade in timeout={300}>
      <Box sx={{ width: '100%', pb: 6 }}>
        {/* BANNER SUPERIOR CON NAVEGACIÓN Y ESTADO EN VIVO */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.25, md: 3 },
            mb: 3,
            borderRadius: 2.5,
            background: 'linear-gradient(135deg, #0f2942 0%, #1e3a8a 55%, #0284c7 100%)',
            color: '#ffffff',
            boxShadow: '0 12px 30px rgba(15, 41, 66, 0.18)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
            <Box>
              {onBack && (
                <Button
                  size="small"
                  startIcon={<ArrowBack />}
                  onClick={onBack}
                  sx={{
                    mb: 1.25,
                    color: 'rgba(255,255,255,0.85)',
                    bgcolor: 'rgba(255,255,255,0.12)',
                    textTransform: 'none',
                    fontWeight: 750,
                    borderRadius: 1.5,
                    px: 1.5,
                    '&:hover': { bgcolor: 'rgba(255,255,255,0.22)', color: '#fff' }
                  }}
                >
                  Volver a submódulos
                </Button>
              )}
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap">
                <Typography variant="h5" sx={{ fontWeight: 950, letterSpacing: '-0.5px' }}>
                  Tablero Estadístico PED en Tiempo Real
                </Typography>
                <Chip
                  icon={<FiberManualRecord sx={{ fontSize: '10px !important', color: '#86efac !important' }} />}
                  label="DATOS VIVOS"
                  size="small"
                  sx={{
                    bgcolor: 'rgba(34, 197, 94, 0.25)',
                    color: '#bbf7d0',
                    border: '1px solid rgba(134, 239, 172, 0.4)',
                    fontWeight: 900,
                    fontSize: 10.5,
                    height: 22
                  }}
                />
              </Stack>
              <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.82)', mt: 0.5, maxWidth: 760 }}>
                Monitoreo automático y directo de las tablas de formulación y seguimiento del Plan Estratégico de Desarrollo.
                Cualquier registro o avance se actualiza en este tablero de control.
              </Typography>
            </Box>

            {/* BOTONES DE ACCIÓN: ACTUALIZAR Y EXPORTAR */}
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ alignSelf: { xs: 'flex-start', md: 'center' } }}>
              <Tooltip title="Actualizar datos directamente desde las tablas en vivo">
                <span>
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={refreshing ? <CircularProgress size={16} color="inherit" /> : <Refresh />}
                    onClick={() => loadStatistics(true)}
                    disabled={refreshing || loading}
                    sx={{
                      bgcolor: 'rgba(255,255,255,0.18)',
                      color: '#ffffff',
                      textTransform: 'none',
                      fontWeight: 850,
                      borderRadius: 1.5,
                      px: 2,
                      height: 38,
                      backdropFilter: 'blur(6px)',
                      border: '1px solid rgba(255,255,255,0.25)',
                      '&:hover': { bgcolor: 'rgba(255,255,255,0.28)' }
                    }}
                  >
                    Actualizar
                  </Button>
                </span>
              </Tooltip>

              <Button
                variant="contained"
                size="small"
                startIcon={<Download />}
                onClick={exportToExcel}
                disabled={!statsData || loading}
                sx={{
                  bgcolor: '#16a34a',
                  color: '#ffffff',
                  textTransform: 'none',
                  fontWeight: 850,
                  borderRadius: 1.5,
                  px: 2,
                  height: 38,
                  boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                  '&:hover': { bgcolor: '#15803d' }
                }}
              >
                Exportar Excel
              </Button>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={1.5} alignItems="center" mt={2} pt={1.5} sx={{ borderTop: '1px solid rgba(255,255,255,0.12)' }}>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>
              Última sincronización en vivo: {lastUpdated.toLocaleTimeString()}
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.5)' }}>•</Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontWeight: 800, fontSize: 11 }}>
              {statsData?.plan?.name || 'Cargando PED...'}
            </Typography>
          </Stack>
        </Paper>

        {/* FILTROS SUPERIORES: PED, VIGENCIA Y DEPENDENCIA */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 3,
            borderRadius: 1.5,
            borderColor: '#cbd5e1',
            bgcolor: '#ffffff',
            boxShadow: '0 2px 8px rgba(15,23,42,0.03)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
            {/* SELECTOR DE PED */}
            <Box sx={{ flex: 1.2 }}>
              <Typography variant="caption" sx={{ fontWeight: 850, color: '#475569', display: 'block', mb: 0.5 }}>
                PLAN ESTRATÉGICO DE DESARROLLO (PED)
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={selectedPlanId || ''}
                onChange={(e) => setSelectedPlanId(e.target.value)}
                SelectProps={{ native: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.25,
                    fontSize: 13.5,
                    fontWeight: 700,
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                {availablePlans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.period}) {p.status === 'active' ? '— Activo' : ''}
                  </option>
                ))}
              </TextField>
            </Box>

            {/* SELECTOR DE VIGENCIA (AÑO) */}
            <Box sx={{ flex: 0.8 }}>
              <Typography variant="caption" sx={{ fontWeight: 850, color: '#475569', display: 'block', mb: 0.5 }}>
                VIGENCIA DE EJECUCIÓN
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                SelectProps={{ native: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.25,
                    fontSize: 13.5,
                    fontWeight: 700,
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                <option value="all">Todas las vigencias del PED</option>
                {(statsData?.terms || []).map((t) => (
                  <option key={t.id} value={t.year}>
                    Vigencia {t.year} ({t.status === 'active' ? 'Activa' : t.status === 'closed' ? 'Cerrada' : 'Programada'})
                  </option>
                ))}
              </TextField>
            </Box>

            {/* SELECTOR DE DEPENDENCIA */}
            <Box sx={{ flex: 1.2 }}>
              <Typography variant="caption" sx={{ fontWeight: 850, color: '#475569', display: 'block', mb: 0.5 }}>
                DEPENDENCIA PARTICIPANTE
              </Typography>
              <TextField
                select
                fullWidth
                size="small"
                value={selectedDependencyId}
                onChange={(e) => setSelectedDependencyId(e.target.value)}
                SelectProps={{ native: true }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 1.25,
                    fontSize: 13.5,
                    fontWeight: 700,
                    bgcolor: '#f8fafc'
                  }
                }}
              >
                <option value="all">Todas las dependencias ({statsData?.dependenciesProgress?.length || 0})</option>
                {(statsData?.dependenciesProgress || []).map((dep) => (
                  <option key={dep.id} value={dep.id}>
                    {dep.name}
                  </option>
                ))}
              </TextField>
            </Box>

            {/* BOTÓN RESTABLECER */}
            <Box sx={{ alignSelf: { xs: 'flex-start', md: 'flex-end' }, pt: { md: 2.2 } }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setSelectedYear('all');
                  setSelectedDependencyId('all');
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: 12,
                  borderRadius: 1.25,
                  height: 38,
                  borderColor: '#cbd5e1',
                  color: '#475569',
                  whiteSpace: 'nowrap'
                }}
              >
                Limpiar filtros
              </Button>
            </Box>
          </Stack>
        </Paper>

        {loading ? (
          <Paper elevation={0} sx={{ py: 10, textAlign: 'center', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <CircularProgress size={44} sx={{ color: '#2563eb', mb: 2 }} />
            <Typography variant="h6" fontWeight={850} color="#0f172a">
              Compilando estadísticas del PED en tiempo real...
            </Typography>
            <Typography variant="body2" color="#64748b" mt={0.5}>
              Consultando tablas de objetivos, planes de acción y actividades anuales.
            </Typography>
          </Paper>
        ) : (
          <>
            {/* TARJETAS KPI SUPERIORES */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'repeat(1, 1fr)',
                  sm: 'repeat(2, 1fr)',
                  lg: 'repeat(4, 1fr)'
                },
                gap: 2,
                mb: 3
              }}
            >
              {/* KPI 1: Objetivos */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 1.5,
                  borderColor: '#cbd5e1',
                  bgcolor: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, bgcolor: '#1e40af' }} />
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.4px' }}>
                      Objetivos Estratégicos
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#0f172a', mt: 0.5, lineHeight: 1.1 }}>
                      {kpis.totalObjetivos}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: 1.25, bgcolor: '#eff6ff', color: '#1e40af', display: 'grid', placeItems: 'center' }}>
                    <Flag sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1.2, fontWeight: 700 }}>
                  Estructura oficial del PED
                </Typography>
              </Paper>

              {/* KPI 2: Lineamientos */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 1.5,
                  borderColor: '#cbd5e1',
                  bgcolor: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, bgcolor: '#0891b2' }} />
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.4px' }}>
                      Lineamientos Estratégicos
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#0f172a', mt: 0.5, lineHeight: 1.1 }}>
                      {kpis.totalLineamientos}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: 1.25, bgcolor: '#ecfeff', color: '#0891b2', display: 'grid', placeItems: 'center' }}>
                    <AccountTree sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1.2, fontWeight: 700 }}>
                  Ejes de articulación institucional
                </Typography>
              </Paper>

              {/* KPI 3: Actividades e Indicadores en vivo */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 1.5,
                  borderColor: '#cbd5e1',
                  bgcolor: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, bgcolor: '#7c3aed' }} />
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.4px' }}>
                      Actividades Formuladas
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#0f172a', mt: 0.5, lineHeight: 1.1 }}>
                      {kpis.totalActividades.toLocaleString()}
                    </Typography>
                  </Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: 1.25, bgcolor: '#f5f3ff', color: '#7c3aed', display: 'grid', placeItems: 'center' }}>
                    <ListAlt sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mt: 1.2, fontWeight: 700 }}>
                  {kpis.totalIndicadores.toLocaleString()} indicadores en {kpis.totalPlanes} planes
                </Typography>
              </Paper>

              {/* KPI 4: Ejecución General PED */}
              <Paper
                variant="outlined"
                sx={{
                  p: 2.25,
                  borderRadius: 1.5,
                  borderColor: '#cbd5e1',
                  bgcolor: '#ffffff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3.5, bgcolor: '#16a34a' }} />
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                  <Box>
                    <Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b', textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.4px' }}>
                      Ejecución General PED
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#15803d', mt: 0.5, lineHeight: 1.1 }}>
                      {kpis.ejecucionGeneral.toFixed(1)}%
                    </Typography>
                  </Box>
                  <Box sx={{ width: 42, height: 42, borderRadius: 1.25, bgcolor: '#f0fdf4', color: '#16a34a', display: 'grid', placeItems: 'center' }}>
                    <TrendingUp sx={{ fontSize: 24 }} />
                  </Box>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, kpis.ejecucionGeneral)}
                  sx={{
                    mt: 1.4,
                    height: 6,
                    borderRadius: 1,
                    bgcolor: '#e2e8f0',
                    '& .MuiLinearProgress-bar': { bgcolor: '#16a34a', borderRadius: 1 }
                  }}
                />
              </Paper>
            </Box>

            {/* PESTAÑAS DE VISTA: OBJETIVOS, VIGENCIAS, PLANES */}
            <Paper variant="outlined" sx={{ borderRadius: 1.5, borderColor: '#cbd5e1', bgcolor: '#ffffff', mb: 3 }}>
              <Tabs
                value={activeTab}
                onChange={(_, next) => setActiveTab(next)}
                sx={{
                  px: 1,
                  borderBottom: '1px solid #e2e8f0',
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    fontWeight: 850,
                    fontSize: 13.5,
                    minHeight: 48,
                    color: '#64748b',
                    py: 1.25
                  },
                  '& .Mui-selected': {
                    color: '#1d4ed8 !important'
                  },
                  '& .MuiTabs-indicator': {
                    bgcolor: '#1d4ed8',
                    height: 3
                  }
                }}
              >
                <Tab icon={<Flag sx={{ fontSize: 18 }} />} iconPosition="start" label="Consolidado por Objetivos y Lineamientos" value="objectives" />
                <Tab icon={<Timeline sx={{ fontSize: 18 }} />} iconPosition="start" label="Evolución por Vigencias (Años)" value="terms" />
                <Tab icon={<CorporateFare sx={{ fontSize: 18 }} />} iconPosition="start" label="Planes de Acción por Dependencia" value="dependencies" />
              </Tabs>

              {/* VISTA 1: OBJETIVOS Y LINEAMIENTOS */}
              {activeTab === 'objectives' && (
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography variant="subtitle1" fontWeight={950} color="#0f172a" mb={1}>
                    Avance Ponderado por Objetivo Estratégico
                  </Typography>
                  <Typography variant="body2" color="#64748b" mb={3}>
                    Cálculo directo sobre las actividades e indicadores formulados y ejecutados en cada vigencia del PED.
                  </Typography>

                  {/* GRÁFICA DE BARRAS DE AVANCE POR OBJETIVO */}
                  {objectivesChartData.length > 0 && (
                    <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 1.5, borderColor: '#e2e8f0', bgcolor: '#f8fafc' }}>
                      <Box sx={{ width: '100%', height: 260 }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={objectivesChartData} margin={{ top: 15, right: 20, left: 10, bottom: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                            <XAxis
                              dataKey="shortName"
                              tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                              interval={0}
                              tickLine={false}
                            />
                            <YAxis
                              domain={[0, 100]}
                              tickFormatter={(val) => `${val}%`}
                              tick={{ fontSize: 11, fontWeight: 600, fill: '#64748b' }}
                              tickLine={false}
                            />
                            <RechartsTooltip
                              formatter={(value, name) => [`${value}%`, name === 'avance' ? 'Avance Acumulado' : name]}
                              labelFormatter={(label) => `Objetivo: ${label}`}
                              contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700 }}
                            />
                            <Bar dataKey="avance" name="avance" radius={[6, 6, 0, 0]}>
                              {objectivesChartData.map((entry, index) => (
                                <Cell
                                  key={`cell-${index}`}
                                  fill={
                                    entry.avance >= 90
                                      ? '#16a34a'
                                      : entry.avance >= 70
                                      ? '#2563eb'
                                      : entry.avance >= 40
                                      ? '#d97706'
                                      : '#dc2626'
                                  }
                                />
                              ))}
                              <LabelList dataKey="avance" position="top" formatter={(val) => `${val}%`} style={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }} />
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </Box>
                    </Paper>
                  )}

                  {/* LISTA DESPLEGABLE DE OBJETIVOS CON SUS LINEAMIENTOS */}
                  <Stack spacing={2}>
                    {(statsData?.objectives || []).map((obj, index) => {
                      const isExpanded = Boolean(expandedObjectives[obj.name]);
                      return (
                        <Paper
                          key={obj.name}
                          variant="outlined"
                          sx={{
                            borderRadius: 1.5,
                            borderColor: isExpanded ? '#93c5fd' : '#e2e8f0',
                            bgcolor: '#ffffff',
                            overflow: 'hidden',
                            boxShadow: isExpanded ? '0 4px 14px rgba(37,99,235,0.06)' : 'none',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          {/* ENCABEZADO DEL OBJETIVO */}
                          <Box
                            onClick={() => toggleObjective(obj.name)}
                            sx={{
                              p: 2,
                              cursor: 'pointer',
                              bgcolor: isExpanded ? '#f0f7ff' : '#ffffff',
                              borderBottom: isExpanded ? '1px solid #dbeafe' : 'none',
                              '&:hover': { bgcolor: '#f8fafc' }
                            }}
                          >
                            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
                              <Stack direction="row" alignItems="center" spacing={1.5} sx={{ flex: 1, minWidth: 0 }}>
                                <Box
                                  sx={{
                                    width: 34,
                                    height: 34,
                                    borderRadius: 1,
                                    bgcolor: '#2563eb',
                                    color: '#ffffff',
                                    display: 'grid',
                                    placeItems: 'center',
                                    fontWeight: 900,
                                    fontSize: 13,
                                    flexShrink: 0
                                  }}
                                >
                                  {index + 1}
                                </Box>
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography fontWeight={900} fontSize={14.5} color="#0f172a">
                                    {obj.name}
                                  </Typography>
                                  <Typography variant="caption" color="#64748b" fontWeight={700}>
                                    {obj.guidelines?.length || 0} lineamientos • {obj.totalActivities} actividades formuladas
                                  </Typography>
                                </Box>
                              </Stack>

                              <Stack direction="row" alignItems="center" spacing={2} sx={{ flexShrink: 0 }}>
                                <Box sx={{ width: 140, textAlign: 'right' }}>
                                  <Typography fontWeight={950} fontSize={16} color={obj.avgProgress >= 80 ? '#15803d' : '#1d4ed8'}>
                                    {obj.avgProgress.toFixed(1)}%
                                  </Typography>
                                  <LinearProgress
                                    variant="determinate"
                                    value={Math.min(100, obj.avgProgress)}
                                    sx={{
                                      mt: 0.5,
                                      height: 6,
                                      borderRadius: 1,
                                      bgcolor: '#e2e8f0',
                                      '& .MuiLinearProgress-bar': {
                                        bgcolor: obj.avgProgress >= 80 ? '#16a34a' : '#2563eb',
                                        borderRadius: 1
                                      }
                                    }}
                                  />
                                </Box>
                                <IconButton size="small" sx={{ color: '#64748b' }}>
                                  {isExpanded ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                              </Stack>
                            </Stack>
                          </Box>

                          {/* TABLA DE LINEAMIENTOS DEL OBJETIVO */}
                          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                            <TableContainer>
                              <Table size="small">
                                <TableHead>
                                  <TableRow sx={{ bgcolor: '#244f91' }}>
                                    <TableCell sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73' }}>
                                      Lineamiento Estratégico
                                    </TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73', width: 130 }}>
                                      Actividades
                                    </TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73', width: 220 }}>
                                      Avance Ponderado
                                    </TableCell>
                                    <TableCell align="center" sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73', width: 140 }}>
                                      Estado
                                    </TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {(obj.guidelines || []).map((g) => (
                                    <TableRow key={g.name} hover>
                                      <TableCell sx={{ py: 1.2 }}>
                                        <Typography fontWeight={800} fontSize={13} color="#1e293b">
                                          {g.name}
                                        </Typography>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          size="small"
                                          label={`${g.totalActivities} acts`}
                                          sx={{ height: 21, fontSize: 11, fontWeight: 800, bgcolor: '#f1f5f9' }}
                                        />
                                      </TableCell>
                                      <TableCell align="center">
                                        <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 190, mx: 'auto' }}>
                                          <Box sx={{ flex: 1 }}>
                                            <LinearProgress
                                              variant="determinate"
                                              value={Math.min(100, g.avgProgress)}
                                              sx={{
                                                height: 6,
                                                borderRadius: 1,
                                                bgcolor: '#e2e8f0',
                                                '& .MuiLinearProgress-bar': {
                                                  bgcolor: g.avgProgress >= 80 ? '#16a34a' : '#2563eb',
                                                  borderRadius: 1
                                                }
                                              }}
                                            />
                                          </Box>
                                          <Typography fontWeight={900} fontSize={12.5} sx={{ width: 44, textAlign: 'right' }}>
                                            {g.avgProgress.toFixed(1)}%
                                          </Typography>
                                        </Stack>
                                      </TableCell>
                                      <TableCell align="center">
                                        <Chip
                                          size="small"
                                          label={g.avgProgress >= 99.5 ? 'Completado' : g.avgProgress > 0 ? 'En ejecución' : 'Sin iniciar'}
                                          sx={{
                                            height: 22,
                                            fontSize: 11,
                                            fontWeight: 850,
                                            bgcolor: g.avgProgress >= 99.5 ? '#dcfce7' : g.avgProgress > 0 ? '#fef3c7' : '#f1f5f9',
                                            color: g.avgProgress >= 99.5 ? '#15803d' : g.avgProgress > 0 ? '#b45309' : '#64748b'
                                          }}
                                        />
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          </Collapse>
                        </Paper>
                      );
                    })}
                  </Stack>
                </Box>
              )}

              {/* VISTA 2: EVOLUCIÓN POR VIGENCIAS */}
              {activeTab === 'terms' && (
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <Typography variant="subtitle1" fontWeight={950} color="#0f172a" mb={1}>
                    Progreso Cronológico por Vigencia (Años del PED)
                  </Typography>
                  <Typography variant="body2" color="#64748b" mb={3}>
                    Comportamiento del avance físico y cantidad de planes de acción formulados por cada año institucional.
                  </Typography>

                  {/* GRÁFICA DE EVOLUCIÓN ANUAL */}
                  <Paper variant="outlined" sx={{ p: 2.5, mb: 3, borderRadius: 1.5, borderColor: '#e2e8f0', bgcolor: '#f8fafc' }}>
                    <Box sx={{ width: '100%', height: 260 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={termsChartData} margin={{ top: 15, right: 20, left: 10, bottom: 15 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="year" tick={{ fontSize: 12, fontWeight: 800, fill: '#0f172a' }} tickLine={false} />
                          <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} />
                          <RechartsTooltip
                            formatter={(value, name) => [`${value}%`, name === 'avance' ? 'Avance de la Vigencia' : name]}
                            contentStyle={{ borderRadius: 8, border: '1px solid #cbd5e1', fontSize: 12, fontWeight: 700 }}
                          />
                          <Bar dataKey="avance" name="avance" fill="#2563eb" radius={[6, 6, 0, 0]}>
                            {termsChartData.map((entry, index) => (
                              <Cell
                                key={`term-cell-${index}`}
                                fill={
                                  entry.avance >= 85
                                    ? '#16a34a'
                                    : entry.avance >= 70
                                    ? '#2563eb'
                                    : entry.avance > 0
                                    ? '#d97706'
                                    : '#cbd5e1'
                                }
                              />
                            ))}
                            <LabelList dataKey="avance" position="top" formatter={(val) => `${val}%`} style={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>

                  {/* CUADRÍCULA DE TARJETAS DE VIGENCIAS */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: {
                        xs: 'repeat(2, 1fr)',
                        sm: 'repeat(3, 1fr)',
                        md: 'repeat(4, 1fr)',
                        lg: 'repeat(8, 1fr)'
                      },
                      gap: 1.5
                    }}
                  >
                    {(statsData?.termsProgress || []).map((term) => (
                      <Paper
                        key={term.year}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 1,
                          borderColor: '#cbd5e1',
                          bgcolor: term.activitiesCount ? '#ffffff' : '#f8fafc',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.02)'
                        }}
                      >
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
                          <Typography variant="caption" sx={{ fontWeight: 900, fontSize: 10, color: '#64748b', textTransform: 'uppercase' }}>
                            Vigencia
                          </Typography>
                          <Chip
                            size="small"
                            label={term.status === 'active' ? 'Activa' : term.status === 'closed' ? 'Cerrada' : 'Prog.'}
                            sx={{
                              height: 18,
                              fontSize: 9.5,
                              fontWeight: 850,
                              bgcolor: term.status === 'active' ? '#dcfce7' : '#f1f5f9',
                              color: term.status === 'active' ? '#15803d' : '#64748b'
                            }}
                          />
                        </Stack>
                        <Typography fontWeight={950} fontSize={20} color="#0f172a">
                          {term.year}
                        </Typography>
                        <Typography variant="caption" color="#475569" fontWeight={750} display="block" mt={0.5}>
                          {term.plansCount} planes • {term.activitiesCount} acts
                        </Typography>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={0.75}>
                          <Typography fontWeight={900} fontSize={12} color={term.avgProgress >= 80 ? '#15803d' : '#2563eb'}>
                            {term.avgProgress.toFixed(1)}%
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(100, term.avgProgress)}
                          sx={{
                            mt: 0.5,
                            height: 4,
                            borderRadius: 1,
                            bgcolor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': { bgcolor: term.avgProgress >= 80 ? '#16a34a' : '#2563eb' }
                          }}
                        />
                      </Paper>
                    ))}
                  </Box>
                </Box>
              )}

              {/* VISTA 3: PLANES POR DEPENDENCIA */}
              {activeTab === 'dependencies' && (
                <Box sx={{ p: { xs: 2, md: 3 } }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2} mb={2.5}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={950} color="#0f172a">
                        Monitoreo por Dependencia Participante
                      </Typography>
                      <Typography variant="body2" color="#64748b">
                        Planes formulados, responsables y porcentaje acumulado por unidad organizacional.
                      </Typography>
                    </Box>

                    {/* BUSCADOR DE DEPENDENCIAS */}
                    <Box sx={{ width: { xs: '100%', sm: 380 } }}>
                      <TextField
                        fullWidth
                        size="small"
                        placeholder="Buscar por dependencia, responsable o código..."
                        value={dependencySearch}
                        onChange={(e) => setDependencySearch(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search sx={{ color: '#2563eb', fontSize: 20 }} />
                            </InputAdornment>
                          )
                        }}
                        sx={{
                          '& .MuiOutlinedInput-root': {
                            borderRadius: 1.25,
                            fontSize: 13,
                            bgcolor: '#f8fafc'
                          }
                        }}
                      />
                    </Box>
                  </Stack>

                  <TableContainer sx={{ maxHeight: 540 }}>
                    <Table size="small" stickyHeader>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#244f91' }}>
                          <TableCell sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73' }}>
                            Dependencia
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73' }}>
                            Código(s) de Plan
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73' }}>
                            Responsable de Ejecución
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73', width: 120 }}>
                            Actividades
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73', width: 220 }}>
                            Avance Acumulado
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.04em', textTransform: 'uppercase', py: 1.25, borderBottom: '2px solid #173b73', width: 130 }}>
                            Estado
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {!filteredDependencies.length ? (
                          <TableRow>
                            <TableCell colSpan={6} sx={{ py: 4, textAlign: 'center' }}>
                              <Typography variant="body2" color="#64748b" fontWeight={750}>
                                No se encontraron dependencias que coincidan con los criterios.
                              </Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredDependencies.map((dep) => (
                            <TableRow key={dep.id} hover>
                              <TableCell sx={{ py: 1.2 }}>
                                <Typography fontWeight={850} fontSize={13} color="#0f172a">
                                  {dep.name}
                                </Typography>
                                {dep.code && (
                                  <Typography variant="caption" color="#64748b">
                                    {dep.code}
                                  </Typography>
                                )}
                              </TableCell>
                              <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: '#334155' }}>
                                {dep.planCodes?.join(', ') || '—'}
                              </TableCell>
                              <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>
                                {dep.responsible || '—'}
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  size="small"
                                  label={`${dep.activitiesCount} acts`}
                                  sx={{ height: 21, fontSize: 11, fontWeight: 800, bgcolor: '#f1f5f9' }}
                                />
                              </TableCell>
                              <TableCell align="center">
                                <Stack direction="row" alignItems="center" spacing={1} sx={{ width: 190, mx: 'auto' }}>
                                  <Box sx={{ flex: 1 }}>
                                    <LinearProgress
                                      variant="determinate"
                                      value={Math.min(100, dep.avgProgress)}
                                      sx={{
                                        height: 6,
                                        borderRadius: 1,
                                        bgcolor: '#e2e8f0',
                                        '& .MuiLinearProgress-bar': {
                                          bgcolor: dep.avgProgress >= 80 ? '#16a34a' : '#2563eb',
                                          borderRadius: 1
                                        }
                                      }}
                                    />
                                  </Box>
                                  <Typography fontWeight={900} fontSize={12.5} sx={{ width: 44, textAlign: 'right' }}>
                                    {dep.avgProgress.toFixed(1)}%
                                  </Typography>
                                </Stack>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  size="small"
                                  label={dep.status || (dep.avgProgress >= 99.5 ? 'Completado' : dep.avgProgress > 0 ? 'En ejecución' : 'Formulado')}
                                  sx={{
                                    height: 22,
                                    fontSize: 10.5,
                                    fontWeight: 850,
                                    bgcolor: dep.avgProgress >= 99.5 ? '#dcfce7' : '#eff6ff',
                                    color: dep.avgProgress >= 99.5 ? '#15803d' : '#1d4ed8'
                                  }}
                                />
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Box>
              )}
            </Paper>
          </>
        )}
      </Box>
    </Fade>
  );
}
