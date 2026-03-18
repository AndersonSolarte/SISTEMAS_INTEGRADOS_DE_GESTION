import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Typography,
  Fade,
  Grow
} from '@mui/material';
import {
  Groups as GroupsIcon,
  School as SchoolIcon,
  BusinessCenter as BusinessCenterIcon,
  Handshake as HandshakeIcon,
  BubbleChart as BubbleChartIcon,
  Payments as PaymentsIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';

const TAB_DEFS = [
  { key: 'general', label: 'General', icon: <GroupsIcon fontSize="small" /> },
  { key: 'docentes', label: 'Docentes', icon: <SchoolIcon fontSize="small" /> },
  { key: 'administrativos', label: 'Administrativos', icon: <BusinessCenterIcon fontSize="small" /> },
  { key: 'outsourcing', label: 'Outsourcing', icon: <HandshakeIcon fontSize="small" /> },
  { key: 'ondas', label: 'Ondas', icon: <BubbleChartIcon fontSize="small" /> }
];

const COLORS = {
  primary: '#0f766e',
  accent: '#2563eb',
  soft: '#14b8a6',
  rose: '#e11d48',
  amber: '#f59e0b'
};

const numberFmt = new Intl.NumberFormat('es-CO');
const currencyFmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

const normalizeText = (v) => String(v || '').trim();
const normalizeGenero = (v) => {
  const raw = normalizeText(v).toUpperCase();
  if (!raw) return 'Sin información';
  if (['M', 'MASCULINO', 'HOMBRE'].includes(raw)) return 'Masculino';
  if (['F', 'FEMENINO', 'MUJER'].includes(raw)) return 'Femenino';
  return raw;
};

const sumBy = (rows, getter) => rows.reduce((acc, row) => acc + (Number(getter(row) || 0) || 0), 0);
const topN = (rows, n = 10) => rows.slice(0, n);

const groupTotals = (rows, labelGetter, valueGetter = () => 1) => {
  const map = new Map();
  rows.forEach((row) => {
    const label = normalizeText(labelGetter(row)) || 'Sin información';
    map.set(label, (map.get(label) || 0) + (Number(valueGetter(row) || 0) || 0));
  });
  return Array.from(map.entries())
    .map(([label, total]) => ({ label, total: Number(total || 0) }))
    .sort((a, b) => b.total - a.total);
};

const byYearTotals = (rows, valueGetter = () => 1) => {
  const map = new Map();
  rows.forEach((row) => {
    const anio = Number(row.anio || 0);
    if (!anio) return;
    map.set(anio, (map.get(anio) || 0) + (Number(valueGetter(row) || 0) || 0));
  });
  return Array.from(map.entries())
    .map(([anio, total]) => ({ anio: Number(anio), total: Number(total || 0) }))
    .sort((a, b) => a.anio - b.anio);
};

const KpiCard = ({ title, value, subtitle, icon, tone = 'primary' }) => (
  <Grow in timeout={350}>
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid #dbe7f5',
        background: tone === 'primary'
          ? 'linear-gradient(135deg, #0f172a 0%, #0f766e 100%)'
          : 'linear-gradient(135deg, #ffffff 0%, #f8fbff 100%)',
        color: tone === 'primary' ? '#fff' : '#0f172a',
        minHeight: 118,
        transition: 'transform .2s ease, box-shadow .2s ease',
        '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 12px 24px rgba(15,23,42,.08)' }
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography variant="caption" sx={{ opacity: tone === 'primary' ? 0.9 : 0.75, fontWeight: 700, letterSpacing: '.04em' }}>
            {title}
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 900, lineHeight: 1.1, mt: 0.5 }}>
            {value}
          </Typography>
          {subtitle && <Typography variant="body2" sx={{ mt: 0.8, opacity: tone === 'primary' ? 0.9 : 0.75 }}>{subtitle}</Typography>}
        </Box>
        <Box sx={{ opacity: tone === 'primary' ? 0.95 : 0.75 }}>{icon}</Box>
      </Stack>
    </Paper>
  </Grow>
);

const ChartCard = ({ title, subtitle, children, height = 290 }) => (
  <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', height: '100%' }}>
    <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{title}</Typography>
    {subtitle && <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>{subtitle}</Typography>}
    <Box sx={{ height }}>{children}</Box>
  </Paper>
);

const EmptyBlock = ({ text }) => (
  <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
    <Typography sx={{ color: '#475569' }}>{text}</Typography>
  </Paper>
);

const SectionTitle = ({ title, subtitle, action = null }) => (
  <Stack
    direction={{ xs: 'column', md: 'row' }}
    justifyContent="space-between"
    alignItems={{ xs: 'flex-start', md: 'center' }}
    spacing={1}
    sx={{ mb: 1.2 }}
  >
    <Box>
      <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 18 }}>{title}</Typography>
      {subtitle ? <Typography variant="body2" sx={{ color: '#64748b' }}>{subtitle}</Typography> : null}
    </Box>
    {action}
  </Stack>
);

function RecursoHumanoDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('general');
  const [filters, setFilters] = useState({
    anio: '',
    periodo: '',
    genero: '',
    dependencia: '',
    programa: '',
    tipoVinculacion: '',
    vicerectoria: '',
    claseContrato: '',
    estadoLaboral: '',
    cargo: ''
  });

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getEstadisticas({
        categoria: 'Recurso Humano',
        aggregate: 'recurso_humano_dashboard'
      });
      setData(response?.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar dashboard de Recurso Humano', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const allYears = useMemo(() => (data?.catalogs?.anios || []).map((x) => Number(x)).filter(Boolean), [data]);

  const moduleRows = useMemo(() => {
    if (!data) return [];
    if (tab === 'docentes') return data.docentes?.rows || [];
    if (tab === 'administrativos') return data.administrativos?.rows || [];
    if (tab === 'outsourcing') return data.outsourcing?.rows || [];
    if (tab === 'ondas') return data.ondas?.rows || [];
    return [];
  }, [data, tab]);

  const filterOptions = useMemo(() => {
    const unique = (rows, getter) =>
      Array.from(
        new Set(rows.map((row) => normalizeText(typeof getter === 'function' ? getter(row) : row[getter])).filter(Boolean))
      ).sort((a, b) => a.localeCompare(b, 'es'));

    return {
      periodos: unique(moduleRows, 'periodo'),
      generos: unique(moduleRows, (r) => normalizeGenero(r.genero || r.genero_biologico)),
      dependencias: unique(moduleRows, (r) => r.departamento_dependencia || r.dependencia),
      programas: unique(moduleRows, 'programa'),
      tiposVinculacion: unique(moduleRows, 'tipo_vinculacion'),
      vicerectorias: unique(moduleRows, 'vicerectoria'),
      clasesContrato: unique(moduleRows, 'clase_contrato'),
      estadosLaborales: unique(moduleRows, 'estado_laboral'),
      cargos: unique(moduleRows, 'cargo')
    };
  }, [moduleRows]);

  const filteredRows = useMemo(() => {
    if (tab === 'general') return [];
    return moduleRows.filter((row) => {
      if (filters.anio && Number(row.anio || 0) !== Number(filters.anio)) return false;
      if (filters.periodo && normalizeText(row.periodo) !== filters.periodo) return false;
      if (filters.genero && normalizeGenero(row.genero || row.genero_biologico) !== filters.genero) return false;
      if (filters.dependencia && normalizeText(row.departamento_dependencia || row.dependencia) !== filters.dependencia) return false;
      if (filters.programa && normalizeText(row.programa) !== filters.programa) return false;
      if (filters.tipoVinculacion && normalizeText(row.tipo_vinculacion) !== filters.tipoVinculacion) return false;
      if (filters.vicerectoria && normalizeText(row.vicerectoria) !== filters.vicerectoria) return false;
      if (filters.claseContrato && normalizeText(row.clase_contrato) !== filters.claseContrato) return false;
      if (filters.estadoLaboral && normalizeText(row.estado_laboral) !== filters.estadoLaboral) return false;
      if (filters.cargo && normalizeText(row.cargo) !== filters.cargo) return false;
      return true;
    });
  }, [moduleRows, filters, tab]);

  useEffect(() => {
    setFilters({
      anio: '',
      periodo: '',
      genero: '',
      dependencia: '',
      programa: '',
      tipoVinculacion: '',
      vicerectoria: '',
      claseContrato: '',
      estadoLaboral: '',
      cargo: ''
    });
  }, [tab]);

  const moduleMetrics = useMemo(() => {
    if (tab === 'docentes') {
      const peso = (row) => Number(row.peso || row.total_docentes || 1) || 1;
      return {
        total: sumBy(filteredRows, peso),
        registros: filteredRows.length,
        trend: byYearTotals(filteredRows, peso),
        genero: groupTotals(filteredRows, (r) => normalizeGenero(r.genero || r.genero_biologico), peso),
        topA: topN(groupTotals(filteredRows, (r) => r.departamento_dependencia, peso), 10),
        topB: topN(groupTotals(filteredRows, (r) => r.programa, peso), 10),
        extraA: groupTotals(filteredRows, (r) => r.tipo_vinculacion, peso).slice(0, 8),
        extraB: groupTotals(filteredRows, (r) => r.contrato, peso).slice(0, 8),
        avgEdad: (() => {
          const vals = filteredRows.map((r) => Number(r.edad || 0)).filter((x) => x > 0);
          return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        })(),
        avgHoras: (() => {
          const vals = filteredRows.map((r) => Number(r.total_horas || 0)).filter((x) => x > 0);
          return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        })()
      };
    }
    if (tab === 'administrativos') {
      return {
        total: filteredRows.length,
        registros: filteredRows.length,
        trend: byYearTotals(filteredRows),
        genero: groupTotals(filteredRows, (r) => normalizeGenero(r.genero || r.genero_biologico)),
        topA: topN(groupTotals(filteredRows, (r) => r.dependencia), 10),
        topB: topN(groupTotals(filteredRows, (r) => r.vicerectoria), 10),
        extraA: groupTotals(filteredRows, (r) => r.clase_contrato).slice(0, 8),
        extraB: groupTotals(filteredRows, (r) => r.estado_laboral).slice(0, 8),
        nominaMes: sumBy(filteredRows, (r) => r.sueldo_mes),
        nominaAnual: sumBy(filteredRows, (r) => r.sueldo_anual)
      };
    }
    if (tab === 'outsourcing') {
      const qty = (r) => Number(r.cantidad || 0) || 0;
      return {
        total: sumBy(filteredRows, qty),
        registros: filteredRows.length,
        trend: byYearTotals(filteredRows, qty),
        genero: groupTotals(filteredRows, (r) => normalizeGenero(r.genero || r.genero_biologico), qty),
        topA: topN(groupTotals(filteredRows, (r) => r.cargo, qty), 12),
        topB: [],
        extraA: [],
        extraB: []
      };
    }
    if (tab === 'ondas') {
      return {
        total: filteredRows.length,
        registros: filteredRows.length,
        trend: byYearTotals(filteredRows),
        genero: groupTotals(filteredRows, (r) => normalizeGenero(r.genero)),
        topA: topN(groupTotals(filteredRows, (r) => r.periodo), 12),
        topB: [],
        extraA: [],
        extraB: []
      };
    }
    return null;
  }, [filteredRows, tab]);

  const generalSeries = useMemo(() => {
    if (!data) return [];
    const years = new Set();
    [data.docentes?.porAnio, data.administrativos?.porAnio, data.outsourcing?.porAnio, data.ondas?.porAnio]
      .forEach((arr) => (arr || []).forEach((r) => years.add(Number(r.anio))));
    return Array.from(years)
      .filter(Boolean)
      .sort((a, b) => a - b)
      .map((anio) => ({
        anio,
        Docentes: Number((data.docentes?.porAnio || []).find((r) => Number(r.anio) === anio)?.total || 0),
        Administrativos: Number((data.administrativos?.porAnio || []).find((r) => Number(r.anio) === anio)?.total || 0),
        Outsourcing: Number((data.outsourcing?.porAnio || []).find((r) => Number(r.anio) === anio)?.total || 0),
        Ondas: Number((data.ondas?.porAnio || []).find((r) => Number(r.anio) === anio)?.total || 0)
      }));
  }, [data]);

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
        <Typography sx={{ fontWeight: 800, mb: 1 }}>Cargando dashboard de Recurso Humano...</Typography>
        <LinearProgress sx={{ borderRadius: 999 }} />
      </Paper>
    );
  }

  if (!data) {
    return <EmptyBlock text="No fue posible cargar el dashboard de Recurso Humano." />;
  }

  const overview = data.overview || {};
  const activeSubbases = (overview.porSubbase || []).filter((row) => Number(row.total || 0) > 0).length;

  return (
    <Fade in timeout={350}>
      <Box>
        <Paper
          elevation={0}
          sx={{
            p: 2.4,
            mb: 2,
            borderRadius: 3,
            border: '1px solid #dbe7f5',
            background: 'radial-gradient(circle at 10% 10%, #d1fae5 0%, #ecfeff 35%, #ffffff 100%)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5}>
            <Box>
              <Typography sx={{ fontSize: 24, fontWeight: 900, color: '#052e2b' }}>
                Dashboard de Recurso Humano
              </Typography>
              <Typography variant="body2" sx={{ color: '#0f766e' }}>
                Modular, interactivo y listo para crecer por subbases: Docentes, Administrativos, Outsourcing y Ondas.
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1.2, flexWrap: 'wrap' }}>
                {TAB_DEFS.filter((x) => x.key !== 'general').map((item) => (
                  <Chip key={item.key} size="small" label={item.label} sx={{ bgcolor: '#ecfeff', color: '#0f766e', fontWeight: 700 }} />
                ))}
              </Stack>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={fetchDashboard}>Actualizar</Button>
            </Stack>
          </Stack>
        </Paper>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard title="Personas consolidadas" value={numberFmt.format(Number(overview.totalPersonas || 0))} subtitle="Suma de las 4 subbases" icon={<GroupsIcon />} />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard title="Registros detalle" value={numberFmt.format(Number(overview.totalRegistros || 0))} subtitle="Filas cargadas en tablas RH" icon={<BubbleChartIcon />} tone="secondary" />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard title="Años con información" value={numberFmt.format((data.catalogs?.anios || []).length)} subtitle={(data.catalogs?.anios || []).join(', ') || 'Sin datos'} icon={<SchoolIcon />} tone="secondary" />
          </Grid>
          <Grid item xs={12} sm={6} lg={3}>
            <KpiCard title="Subbases activas" value={numberFmt.format(activeSubbases)} subtitle="Con datos cargados y disponibles" icon={<BubbleChartIcon />} tone="secondary" />
          </Grid>
        </Grid>

        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, mb: 2, overflow: 'hidden' }}>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
            {TAB_DEFS.map((item) => (
              <Tab
                key={item.key}
                value={item.key}
                icon={item.icon}
                iconPosition="start"
                label={item.label}
                sx={{ textTransform: 'none', fontWeight: 800, minHeight: 54 }}
              />
            ))}
          </Tabs>
        </Paper>

        {tab === 'general' ? (
          <>
            <SectionTitle
              title="Resumen Ejecutivo"
              subtitle="Vista institucional de alto nivel. Los datos de nómina se consultan dentro del módulo Administrativos."
            />
            <Grid container spacing={2}>
              <Grid item xs={12} lg={8}>
              <ChartCard title="Evolución anual por subbase" subtitle="Comparativo consolidado por año" height={340}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={generalSeries}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="anio" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="Docentes" stroke="#0f766e" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Administrativos" stroke="#2563eb" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Outsourcing" stroke="#e11d48" strokeWidth={3} dot={false} />
                    <Line type="monotone" dataKey="Ondas" stroke="#f59e0b" strokeWidth={3} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
              <Grid item xs={12} lg={4}>
              <ChartCard title="Distribución de personas por subbase" subtitle="Volumen actual cargado">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(overview.porSubbase || []).map((r) => ({ label: r.key, total: r.total }))} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" width={110} />
                    <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                    <Bar dataKey="total" fill={COLORS.primary} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
              <Grid item xs={12} md={6}>
              <ChartCard title="Top dependencias (Docentes)" subtitle="Peso de personal por dependencia">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data.docentes?.porDependencia || []).slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                    <Bar dataKey="total" fill={COLORS.accent} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
              <Grid item xs={12} md={6}>
              <ChartCard title="Top dependencias (Administrativos)" subtitle="Conteo de personal administrativo">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={(data.administrativos?.porDependencia || []).slice(0, 10)} layout="vertical" margin={{ left: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="label" width={170} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                    <Bar dataKey="total" fill={COLORS.rose} radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </Grid>
            </Grid>
            <Box sx={{ mt: 2 }}>
              <SectionTitle title="Panel por Subbase" subtitle="Resumen rápido de volumen y registros para navegar los módulos especializados." />
              <Grid container spacing={1.5}>
                {(overview.porSubbase || []).map((item, idx) => (
                  <Grid item xs={12} sm={6} lg={3} key={item.key}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 3,
                        border: '1px solid #e2e8f0',
                        background: idx % 2 === 0 ? 'linear-gradient(180deg,#ffffff,#f8fbff)' : 'linear-gradient(180deg,#ffffff,#f8fafc)'
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center">
                        <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>{item.key}</Typography>
                        <Chip size="small" label={`${numberFmt.format(item.registros || 0)} registros`} />
                      </Stack>
                      <Typography sx={{ mt: 1, fontWeight: 900, fontSize: 28, color: '#0f766e' }}>
                        {numberFmt.format(item.total || 0)}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Personas / participantes consolidados
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </>
        ) : (
          <>
            <SectionTitle
              title={
                tab === 'docentes' ? 'Módulo Docentes' :
                tab === 'administrativos' ? 'Módulo Administrativos' :
                tab === 'outsourcing' ? 'Módulo Outsourcing' : 'Módulo Ondas'
              }
              subtitle="Analítica operativa con filtros dinámicos y bloques organizados por tema."
            />
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', mb: 2, background: '#fbfdff' }}>
              <Grid container spacing={1.3}>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Año</InputLabel>
                    <Select value={filters.anio} label="Año" onChange={(e) => setFilters((p) => ({ ...p, anio: e.target.value }))}>
                      <MenuItem value="">Todos</MenuItem>
                      {allYears.map((anio) => <MenuItem key={anio} value={anio}>{anio}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Periodo</InputLabel>
                    <Select value={filters.periodo} label="Periodo" onChange={(e) => setFilters((p) => ({ ...p, periodo: e.target.value }))}>
                      <MenuItem value="">Todos</MenuItem>
                      {filterOptions.periodos.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth>
                    <InputLabel>Género</InputLabel>
                    <Select value={filters.genero} label="Género" onChange={(e) => setFilters((p) => ({ ...p, genero: e.target.value }))}>
                      <MenuItem value="">Todos</MenuItem>
                      {filterOptions.generos.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                {tab === 'docentes' && (
                  <>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Dependencia</InputLabel>
                        <Select value={filters.dependencia} label="Dependencia" onChange={(e) => setFilters((p) => ({ ...p, dependencia: e.target.value }))}>
                          <MenuItem value="">Todas</MenuItem>
                          {filterOptions.dependencias.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Programa</InputLabel>
                        <Select value={filters.programa} label="Programa" onChange={(e) => setFilters((p) => ({ ...p, programa: e.target.value }))}>
                          <MenuItem value="">Todos</MenuItem>
                          {filterOptions.programas.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={4}>
                      <FormControl fullWidth>
                        <InputLabel>Tipo Vinculación</InputLabel>
                        <Select value={filters.tipoVinculacion} label="Tipo Vinculación" onChange={(e) => setFilters((p) => ({ ...p, tipoVinculacion: e.target.value }))}>
                          <MenuItem value="">Todos</MenuItem>
                          {filterOptions.tiposVinculacion.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
                {tab === 'administrativos' && (
                  <>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Dependencia</InputLabel>
                        <Select value={filters.dependencia} label="Dependencia" onChange={(e) => setFilters((p) => ({ ...p, dependencia: e.target.value }))}>
                          <MenuItem value="">Todas</MenuItem>
                          {filterOptions.dependencias.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Vicerrectoría</InputLabel>
                        <Select value={filters.vicerectoria} label="Vicerrectoría" onChange={(e) => setFilters((p) => ({ ...p, vicerectoria: e.target.value }))}>
                          <MenuItem value="">Todas</MenuItem>
                          {filterOptions.vicerectorias.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Clase Contrato</InputLabel>
                        <Select value={filters.claseContrato} label="Clase Contrato" onChange={(e) => setFilters((p) => ({ ...p, claseContrato: e.target.value }))}>
                          <MenuItem value="">Todas</MenuItem>
                          {filterOptions.clasesContrato.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <FormControl fullWidth>
                        <InputLabel>Estado Laboral</InputLabel>
                        <Select value={filters.estadoLaboral} label="Estado Laboral" onChange={(e) => setFilters((p) => ({ ...p, estadoLaboral: e.target.value }))}>
                          <MenuItem value="">Todos</MenuItem>
                          {filterOptions.estadosLaborales.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                        </Select>
                      </FormControl>
                    </Grid>
                  </>
                )}
                {tab === 'outsourcing' && (
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel>Cargo</InputLabel>
                      <Select value={filters.cargo} label="Cargo" onChange={(e) => setFilters((p) => ({ ...p, cargo: e.target.value }))}>
                        <MenuItem value="">Todos</MenuItem>
                        {filterOptions.cargos.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
              </Grid>
              <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
                <Button size="small" onClick={() => setFilters({
                  anio: '',
                  periodo: '',
                  genero: '',
                  dependencia: '',
                  programa: '',
                  tipoVinculacion: '',
                  vicerectoria: '',
                  claseContrato: '',
                  estadoLaboral: '',
                  cargo: ''
                })}>Limpiar filtros</Button>
                <Chip size="small" label={`Registros filtrados: ${numberFmt.format(filteredRows.length)}`} />
                <Chip size="small" label={`Total calculado: ${numberFmt.format(Number(moduleMetrics?.total || 0))}`} color="primary" variant="outlined" />
              </Stack>
            </Paper>

            {filteredRows.length === 0 ? (
              <EmptyBlock text="No hay datos para los filtros seleccionados en esta subbase." />
            ) : (
              <>
                <Grid container spacing={1.5} sx={{ mb: 2 }}>
                  <Grid item xs={12} md={3}>
                    <KpiCard title="Total" value={numberFmt.format(Number(moduleMetrics?.total || 0))} subtitle="Resultado consolidado" icon={<GroupsIcon />} />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <KpiCard title="Registros" value={numberFmt.format(Number(moduleMetrics?.registros || 0))} subtitle="Filas en detalle" icon={<BubbleChartIcon />} tone="secondary" />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <KpiCard title={tab === 'docentes' ? 'Promedio horas' : 'Cobertura'} value={
                      tab === 'docentes'
                        ? `${Number(moduleMetrics?.avgHoras || 0).toFixed(1)} h`
                        : `${Math.min(100, Math.round(((moduleMetrics?.registros || 0) / Math.max(1, moduleRows.length)) * 100))}%`
                    } subtitle={tab === 'docentes' ? 'Carga horaria (docentes)' : 'Registros filtrados de la subbase'} icon={<PaymentsIcon />} tone="secondary" />
                  </Grid>
                  <Grid item xs={12} md={3}>
                    <KpiCard title={tab === 'docentes' ? 'Edad promedio' : 'Indicador derivado'} value={
                      tab === 'docentes'
                        ? `${Number(moduleMetrics?.avgEdad || 0).toFixed(1)} años`
                        : '-'
                    } subtitle={tab === 'docentes' ? 'Docentes filtrados' : 'Se completa por submódulo'} icon={<SchoolIcon />} tone="secondary" />
                  </Grid>
                </Grid>

                {tab === 'administrativos' && (
                  <Box sx={{ mb: 2 }}>
                    <SectionTitle title="Bloque de Nómina" subtitle="Sección separada del resumen ejecutivo para mantener jerarquía e interpretación correcta." />
                    <Grid container spacing={1.5}>
                      <Grid item xs={12} md={6}>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', background: 'linear-gradient(135deg,#ffffff,#f8fbff)' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Nómina mensual</Typography>
                            <PaymentsIcon sx={{ color: '#2563eb' }} />
                          </Stack>
                          <Typography sx={{ mt: 1, fontSize: 30, fontWeight: 900, color: '#1d4ed8' }}>
                            {currencyFmt.format(Number(moduleMetrics?.nominaMes || 0))}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Suma del campo `sueldo_mes` para el corte filtrado.
                          </Typography>
                        </Paper>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', background: 'linear-gradient(135deg,#ffffff,#fdf4ff)' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>Nómina anual</Typography>
                            <PaymentsIcon sx={{ color: '#a21caf' }} />
                          </Stack>
                          <Typography sx={{ mt: 1, fontSize: 30, fontWeight: 900, color: '#a21caf' }}>
                            {currencyFmt.format(Number(moduleMetrics?.nominaAnual || 0))}
                          </Typography>
                          <Typography variant="body2" sx={{ color: '#64748b' }}>
                            Suma del campo `sueldo_anual` para el corte filtrado.
                          </Typography>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>
                )}

                <Grid container spacing={2}>
                  <Grid item xs={12} lg={7}>
                    <ChartCard title="Evolución por año" subtitle="Volumen de personal según filtros" height={320}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={moduleMetrics?.trend || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="anio" />
                          <YAxis />
                          <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                          <Bar dataKey="total" fill={COLORS.primary} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </Grid>
                  <Grid item xs={12} lg={5}>
                    <ChartCard title="Distribución por género" subtitle="Conteo / cantidad según subbase" height={320}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={moduleMetrics?.genero || []}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                          <YAxis />
                          <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                          <Bar dataKey="total" fill={COLORS.accent} radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <ChartCard
                      title={
                        tab === 'docentes' ? 'Top dependencias' :
                        tab === 'administrativos' ? 'Top dependencias' :
                        tab === 'outsourcing' ? 'Cargos outsourcing' : 'Periodos (Ondas)'
                      }
                      subtitle="Ranking principal"
                    >
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={moduleMetrics?.topA || []} layout="vertical" margin={{ left: 25 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                          <XAxis type="number" />
                          <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                          <Bar dataKey="total" fill={COLORS.soft} radius={[0, 8, 8, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartCard>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <ChartCard
                      title={
                        tab === 'docentes' ? 'Top programas' :
                        tab === 'administrativos' ? 'Top vicerectorías' :
                        tab === 'outsourcing' ? 'Sin segundo ranking' : 'Sin segundo ranking'
                      }
                      subtitle={tab === 'docentes' || tab === 'administrativos' ? 'Ranking complementario' : 'Disponible para próximos indicadores'}
                    >
                      {(moduleMetrics?.topB || []).length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={moduleMetrics?.topB || []} layout="vertical" margin={{ left: 25 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef2f7" />
                            <XAxis type="number" />
                            <YAxis type="category" dataKey="label" width={180} tick={{ fontSize: 11 }} />
                            <Tooltip formatter={(v) => numberFmt.format(Number(v || 0))} />
                            <Bar dataKey="total" fill={COLORS.rose} radius={[0, 8, 8, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <Stack spacing={1}>
                          {(moduleMetrics?.extraA || []).slice(0, 6).map((row) => (
                            <Box key={row.label}>
                              <Stack direction="row" justifyContent="space-between">
                                <Typography variant="body2" sx={{ color: '#334155' }}>{row.label}</Typography>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>{numberFmt.format(row.total)}</Typography>
                              </Stack>
                              <LinearProgress variant="determinate" value={Math.min(100, ((row.total || 0) / Math.max(1, moduleMetrics.total || 1)) * 100)} sx={{ mt: 0.4, borderRadius: 999, height: 8 }} />
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </ChartCard>
                  </Grid>
                </Grid>
              </>
            )}
          </>
        )}
      </Box>
    </Fade>
  );
}

export default RecursoHumanoDashboard;
