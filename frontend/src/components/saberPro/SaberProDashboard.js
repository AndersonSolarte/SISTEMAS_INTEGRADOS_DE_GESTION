import React, { useEffect, useMemo, useState } from 'react';
import ResultadosDestacados from './ResultadosDestacados';
import {
  Box,
  Button,
  Checkbox,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  ListItemText,
  LinearProgress,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Typography
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

const COLORS = ['#2563eb', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981', '#8b5cf6', '#f97316', '#14b8a6', '#64748b'];
const BASE_FILTERS = { programas: [], anios: [], periodos: [], modulos: [], gruposReferencia: [], competencias: [] };
const INDIVIDUAL_NAV_OPTIONS = [
  { key: 'general', label: 'General resultados individuales', description: 'Vista ejecutiva institucional con filtros generales.' },
  { key: 'saber_pro', label: 'Resultados Saber Pro', description: 'Análisis institucional filtrado para Saber Pro.' },
  { key: 'tyt', label: 'Resultados TyT', description: 'Análisis institucional filtrado para TyT.' },
  { key: 'destacados', label: 'Resultados destacados', description: 'Ranking rápido de mejores resultados visibles.' },
  { key: 'competencias', label: 'Rendimiento por competencia', description: 'Lectura enfocada por núcleo y competencia genérica.' },
  { key: 'becas', label: 'Becas por rendimiento general', description: 'Priorización institucional para apoyos y reconocimientos.' }
];
const GENERIC_MODULES = new Set([
  'RAZONAMIENTO CUANTITATIVO',
  'LECTURA CRITICA',
  'LECTURA CRÍTICA',
  'COMUNICACION ESCRITA',
  'COMUNICACIÓN ESCRITA',
  'COMPETENCIAS CIUDADANAS',
  'INGLES',
  'INGLÉS'
]);

const formatValue = (value) => Number(value || 0).toLocaleString('es-CO', { maximumFractionDigits: 2 });
const SELECT_MENU_PROPS = { PaperProps: { style: { maxHeight: 360 } } };

const renderSmartPointLabel = (props) => {
  const { x, y, value, index } = props || {};
  if (x == null || y == null || value == null) return null;
  const dy = index % 2 === 0 ? -12 : -22;
  return (
    <text
      x={x}
      y={y + dy}
      textAnchor="middle"
      fontSize="11"
      fontWeight="700"
      fill="#334155"
      style={{ pointerEvents: 'none' }}
    >
      {Number(value).toFixed(1)}
    </text>
  );
};

const classifyCompetencia = (row) => {
  const c = String(row?.competencia_grupo || row?.competencias || '').toUpperCase();
  if (c.includes('GENERIC')) return 'GENERICAS';
  if (c.includes('ESPEC')) return 'ESPECIFICAS';
  const m = String(row?.modulo || '').toUpperCase();
  return GENERIC_MODULES.has(m) ? 'GENERICAS' : 'ESPECIFICAS';
};

const percentile = (values = [], p = 0.5) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + ((sorted[hi] - sorted[lo]) * (idx - lo));
};

const summarizeBoxplots = (items = []) =>
  items.map((item) => {
    const values = (item.values || []).map(Number).filter(Number.isFinite);
    if (!values.length) {
      return { modulo: item.modulo, min: 0, q1: 0, median: 0, q3: 0, max: 0 };
    }
    return {
      modulo: item.modulo,
      min: Math.min(...values),
      q1: percentile(values, 0.25),
      median: percentile(values, 0.5),
      q3: percentile(values, 0.75),
      max: Math.max(...values)
    };
  });

function BoxplotSummary({ items = [], title, height = 460 }) {
  const stats = useMemo(() => summarizeBoxplots(items), [items]);
  const globalMin = Math.min(...stats.map((x) => x.min), 0);
  const globalMax = Math.max(...stats.map((x) => x.max), 1);
  const span = Math.max(globalMax - globalMin, 1);

  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height, minWidth: 0 }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>{title}</Typography>
      <Stack spacing={1.1} sx={{ maxHeight: height - 70, overflowY: 'auto', pr: 0.5 }}>
        {stats.length === 0 && (
          <Typography variant="body2" sx={{ color: '#64748b' }}>No hay datos suficientes para boxplot.</Typography>
        )}
        {stats.map((row) => {
          const left = ((row.min - globalMin) / span) * 100;
          const q1 = ((row.q1 - globalMin) / span) * 100;
          const median = ((row.median - globalMin) / span) * 100;
          const q3 = ((row.q3 - globalMin) / span) * 100;
          const max = ((row.max - globalMin) / span) * 100;
          return (
            <Box key={row.modulo}>
              <Typography variant="caption" sx={{ color: '#334155', fontWeight: 700 }}>
                {row.modulo}
              </Typography>
              <Box sx={{ position: 'relative', mt: 0.4, height: 28, borderRadius: 2, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0' }}>
                <Box sx={{ position: 'absolute', left: `${left}%`, width: `${Math.max(max - left, 0.5)}%`, top: '50%', height: 2, bgcolor: '#64748b', transform: 'translateY(-50%)' }} />
                <Box sx={{ position: 'absolute', left: `${q1}%`, width: `${Math.max(q3 - q1, 1)}%`, top: 4, height: 20, bgcolor: '#bfdbfe', border: '1px solid #2563eb', borderRadius: 1 }} />
                <Box sx={{ position: 'absolute', left: `${median}%`, top: 3, bottom: 3, width: 2, bgcolor: '#1d4ed8' }} />
                <Box sx={{ position: 'absolute', left: `${left}%`, top: 6, width: 2, height: 16, bgcolor: '#334155' }} />
                <Box sx={{ position: 'absolute', left: `${max}%`, top: 6, width: 2, height: 16, bgcolor: '#334155' }} />
              </Box>
              <Typography variant="caption" sx={{ color: '#64748b' }}>
                Min {formatValue(row.min)} | Q1 {formatValue(row.q1)} | Med {formatValue(row.median)} | Q3 {formatValue(row.q3)} | Max {formatValue(row.max)}
              </Typography>
            </Box>
          );
        })}
      </Stack>
    </Paper>
  );
}

function CorrelationHeatmap({ matrix, labels, title, height = 460 }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height, minWidth: 0, overflow: 'auto' }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>{title}</Typography>
      <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>
        Valores cercanos a 1 indican mayor relación lineal.
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: `140px repeat(${labels.length}, 1fr)`, gap: 0.8 }}>
        <Box />
        {labels.map((label) => (
          <Box key={`h-${label}`} sx={{ p: 1, textAlign: 'center', fontSize: 11, fontWeight: 800, color: '#1e3a8a', bgcolor: '#eff6ff', borderRadius: 1 }}>
            {label}
          </Box>
        ))}
        {labels.map((rowLabel, i) => (
          <React.Fragment key={rowLabel}>
            <Box sx={{ p: 1, fontSize: 11, fontWeight: 800, color: '#1e293b', bgcolor: '#f8fafc', borderRadius: 1 }}>
              {rowLabel}
            </Box>
            {labels.map((_, j) => {
              const value = Number(matrix?.[i]?.[j] ?? 0);
              const intensity = Math.min(Math.abs(value), 1);
              const bg = `rgba(37, 99, 235, ${0.12 + (intensity * 0.68)})`;
              return (
                <Box
                  key={`${i}-${j}`}
                  sx={{
                    p: 1,
                    textAlign: 'center',
                    borderRadius: 1,
                    border: '1px solid #dbeafe',
                    bgcolor: bg,
                    color: intensity > 0.55 ? 'white' : '#1e3a8a',
                    fontWeight: 800
                  }}
                >
                  {value.toFixed(2)}
                </Box>
              );
            })}
          </React.Fragment>
        ))}
      </Box>
    </Paper>
  );
}

function ChartCard({ title, subtitle, children, height = 440 }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.4, lineHeight: 1.2 }}>{title}</Typography>
      {subtitle ? (
        <Typography variant="caption" sx={{ color: '#64748b', mb: 1.2, display: 'block' }}>
          {subtitle}
        </Typography>
      ) : (
        <Box sx={{ height: 8 }} />
      )}
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Paper>
  );
}

function SaberProDashboard({ initialSection, allowedSections = [] } = {}) {
  const [catalogs, setCatalogs] = useState({ programas: [], anios: [], periodos: [], modulos: [], gruposReferencia: [], competencias: [] });
  const [cascadeCatalogs, setCascadeCatalogs] = useState({ programas: [], anios: [], periodos: [], gruposReferencia: [] });
  const [filters, setFilters] = useState(BASE_FILTERS);
  const [destacadosTopPerProgram, setDestacadosTopPerProgram] = useState(false);
  const [subDashboard, setSubDashboard] = useState('programas');
  const [institutionalTestType, setInstitutionalTestType] = useState('saber_pro');
  const availableNavOptions = useMemo(() => {
    if (!Array.isArray(allowedSections) || allowedSections.length === 0) {
      return INDIVIDUAL_NAV_OPTIONS;
    }
    const allowedSet = new Set(allowedSections);
    return INDIVIDUAL_NAV_OPTIONS.filter((item) => allowedSet.has(item.key));
  }, [allowedSections]);
  const [activeSection, setActiveSection] = useState(initialSection || availableNavOptions[0]?.key || 'general');
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [loadingData, setLoadingData] = useState(false);
  const [error, setError] = useState('');
  const [overview, setOverview] = useState(null);
  const [charts, setCharts] = useState(null);
  const [controlChart, setControlChart] = useState(null);
  const [tableData, setTableData] = useState({ rows: [], pagination: { total: 0 } });
  const [competenciaVista] = useState('GENERICAS');

  useEffect(() => {
    let active = true;
    const loadCatalogs = async () => {
      setLoadingCatalogs(true);
      setError('');
      try {
        const response = await saberProAnalyticsService.getFiltros();
        if (!active) return;
        const data = response?.data || {};
        setCatalogs(data);
        setFilters((prev) => ({
          ...prev,
          anios: prev.anios.length ? prev.anios : (data.anios || []).slice(-5)
        }));
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'No se pudieron cargar filtros de Saber Pro');
      } finally {
        if (active) setLoadingCatalogs(false);
      }
    };
    loadCatalogs();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!availableNavOptions.some((item) => item.key === activeSection)) {
      setActiveSection(availableNavOptions[0]?.key || 'general');
    }
  }, [activeSection, availableNavOptions]);

  useEffect(() => {
    if (activeSection === 'competencias') {
      setSubDashboard('nbc');
    } else {
      setSubDashboard('institucional');
    }

    if (activeSection === 'tyt') {
      setInstitutionalTestType('tyt');
    } else if (activeSection !== 'general') {
      setInstitutionalTestType('saber_pro');
    }
  }, [activeSection]);

  const genericCompetenciasFromCatalog = useMemo(
    () => (catalogs.competencias || []).filter((x) => String(x || '').toUpperCase().includes('GENERIC')),
    [catalogs.competencias]
  );

  const effectiveFilters = useMemo(() => {
    const base = { ...BASE_FILTERS };
    if (activeSection === 'destacados') {
      return {
        ...base,
        programas: filters.programas,
        anios: filters.anios,
        periodos: filters.periodos,
        tipoPrueba: [institutionalTestType]
      };
    }
    if (subDashboard === 'programas') {
      return {
        ...base,
        anios: filters.anios,
        periodos: filters.periodos,
        programas: filters.programas.slice(0, 1),
        competencias: genericCompetenciasFromCatalog,
        tipoPrueba: [institutionalTestType]
      };
    }
    if (subDashboard === 'nbc') {
      return {
        ...base,
        anios: filters.anios,
        periodos: filters.periodos,
        gruposReferencia: filters.gruposReferencia.slice(0, 1),
        competencias: genericCompetenciasFromCatalog,
        tipoPrueba: [institutionalTestType]
      };
    }
    return {
      ...base,
      anios: filters.anios,
      periodos: filters.periodos,
      competencias: genericCompetenciasFromCatalog,
      tipoPrueba: [institutionalTestType]
    };
  }, [activeSection, filters, subDashboard, genericCompetenciasFromCatalog, institutionalTestType]);

  const invalidProgramSelection = subDashboard === 'programas' && filters.programas.length !== 1;
  const invalidNbcSelection = subDashboard === 'nbc' && filters.gruposReferencia.length !== 1;
  const invalidYearSelection = filters.anios.length === 0;
  const selectionInvalidForCurrentDashboard = activeSection === 'destacados'
    ? invalidYearSelection
    : (invalidProgramSelection || invalidNbcSelection || invalidYearSelection);

  useEffect(() => {
    if (activeSection !== 'destacados') return undefined;
    let active = true;
    const loadCascadeCatalogs = async () => {
      try {
        const response = await saberProAnalyticsService.getFiltrosCascade({
          programas: filters.programas,
          anios: filters.anios,
          periodos: filters.periodos
        });
        if (!active) return;
        setCascadeCatalogs(response?.data || { programas: [], anios: [], periodos: [], gruposReferencia: [] });
      } catch (_error) {
        if (!active) return;
        setCascadeCatalogs({ programas: [], anios: [], periodos: [], gruposReferencia: [] });
      }
    };
    loadCascadeCatalogs();
    return () => { active = false; };
  }, [activeSection, filters.programas, filters.anios, filters.periodos]);

  const destacadosCatalogs = useMemo(() => {
    const rowPrograms = Array.from(new Set((tableData?.rows || []).map((row) => String(row.programa || '').trim()).filter(Boolean)));
    return {
      programas: (cascadeCatalogs.programas && cascadeCatalogs.programas.length ? cascadeCatalogs.programas : catalogs.programas) || rowPrograms,
      anios: (cascadeCatalogs.anios && cascadeCatalogs.anios.length ? cascadeCatalogs.anios : catalogs.anios) || [],
      periodos: (cascadeCatalogs.periodos && cascadeCatalogs.periodos.length ? cascadeCatalogs.periodos : catalogs.periodos) || []
    };
  }, [cascadeCatalogs, catalogs, tableData]);

    useEffect(() => {
      let active = true;
      const loadData = async () => {
        if (selectionInvalidForCurrentDashboard) {
          setError('');
          setOverview(null);
          setCharts(null);
          setControlChart(null);
          setTableData({ rows: [], pagination: { total: 0 } });
          return;
        }
        setLoadingData(true);
        setError('');
        try {
          if (activeSection === 'destacados') {
            const t = await saberProAnalyticsService.getResultadosDestacados({
              filters: effectiveFilters,
              pagination: { page: 1, pageSize: destacadosTopPerProgram ? 200 : 50 },
              options: { topPerProgram: destacadosTopPerProgram }
            });
            if (!active) return;
            setOverview(null);
            setCharts(null);
            setControlChart(null);
            setTableData(t?.data || { rows: [], pagination: { total: 0 } });
            return;
          }
          const [o, c, t, ctrl] = await Promise.all([
            saberProAnalyticsService.getOverview(effectiveFilters),
            saberProAnalyticsService.getCharts(effectiveFilters),
            saberProAnalyticsService.getTable({ filters: effectiveFilters, pagination: { page: 1, pageSize: 20 }, sort: [{ field: 'puntaje_global', direction: 'desc' }] }),
            saberProAnalyticsService.getControlChart(effectiveFilters)
        ]);
        if (!active) return;
        setOverview(o?.data || null);
        setCharts(c?.data || null);
        setTableData(t?.data || { rows: [], pagination: { total: 0 } });
        setControlChart(ctrl?.data || null);
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'No se pudo cargar el dashboard de Saber Pro');
      } finally {
        if (active) setLoadingData(false);
      }
      };
      loadData();
      return () => { active = false; };
    }, [activeSection, destacadosTopPerProgram, effectiveFilters, selectionInvalidForCurrentDashboard]);

  const handleFilterChange = (key) => (event) => {
    const value = event.target.value;
    const next = (Array.isArray(value) ? value : [value]).filter((v) => !['__all__', '__clear__', undefined].includes(v));
    setFilters((prev) => ({ ...prev, [key]: next }));
  };

  const toggleListValue = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: prev[key].includes(value) ? prev[key].filter((x) => x !== value) : [...prev[key], value]
    }));
  };

  const allBars = useMemo(() => {
    const fromApi = charts?.competencyBars || [];
    return fromApi.map((row) => ({
      ...row,
      competencia_grupo: classifyCompetencia(row)
    }));
  }, [charts]);

  const splitBars = useMemo(() => ({
    GENERICAS: allBars.filter((x) => x.competencia_grupo === 'GENERICAS'),
    ESPECIFICAS: allBars.filter((x) => x.competencia_grupo === 'ESPECIFICAS')
  }), [allBars]);

  const activeBars = useMemo(() => splitBars[competenciaVista] || [], [splitBars, competenciaVista]);
  const activeModuleSet = useMemo(() => new Set(activeBars.map((x) => x.modulo)), [activeBars]);

  const activeScatter = useMemo(
    () => (charts?.scatterGlobalVsModulo || []).filter((x) => classifyCompetencia(x) === competenciaVista),
    [charts, competenciaVista]
  );

  const activeHistogram = useMemo(() => {
    const bins = new Map();
    activeScatter.forEach((row) => {
      const x = Number(row.x);
      if (!Number.isFinite(x)) return;
      const start = Math.floor(x / 5) * 5;
      bins.set(start, (bins.get(start) || 0) + 1);
    });
    return [...bins.entries()].map(([binStart, count]) => ({ binStart, binEnd: binStart + 5, count })).sort((a, b) => a.binStart - b.binStart);
  }, [activeScatter]);

  const histogramWithTrend = useMemo(() => {
    const rows = activeHistogram || [];
    return rows.map((row, index) => {
      const prev = rows[index - 1]?.count ?? row.count;
      const next = rows[index + 1]?.count ?? row.count;
      const trend = (prev + row.count + next) / 3;
      return { ...row, trend: Number(trend.toFixed(2)) };
    });
  }, [activeHistogram]);

  const activeBoxplot = useMemo(() => {
    const rows = (charts?.boxplotByModulo || []).filter((x) => activeModuleSet.has(x.modulo));
    return rows.slice(0, 8);
  }, [charts, activeModuleSet]);

  const quintilDistribution = useMemo(() => {
    const counts = { Q1: 0, Q2: 0, Q3: 0, Q4: 0, Q5: 0 };
    activeBars.forEach((row) => {
      if (counts[row.quintil] !== undefined) counts[row.quintil] += 1;
    });
    return Object.entries(counts).map(([quintil, total]) => ({ quintil, total }));
  }, [activeBars]);

  const chips = useMemo(() => ([
    `Dashboard: ${subDashboard === 'programas' ? 'Programas' : subDashboard === 'nbc' ? 'NBC' : 'Institucional'}`,
    `Anios: ${filters.anios.length || 'Todos'}`,
    `Periodos: ${filters.periodos.length || 'Todos'}`,
    ...(subDashboard === 'programas' ? [`Programa: ${filters.programas[0] || 'Sin seleccionar'}`] : []),
    ...(subDashboard === 'nbc' ? [`Grupo ref.: ${filters.gruposReferencia[0] || 'Sin seleccionar'}`] : []),
    `Tipo prueba: ${institutionalTestType === 'saber_pro' ? 'Saber Pro' : 'TyT'}`,
    'Competencias: Genéricas (fijo)'
  ]), [filters, subDashboard, institutionalTestType]);

  const kpis = overview?.kpis || {};
  const describeStats = overview?.describePuntajeGlobal || null;
  const noDataForCurrentFilters = !loadingData && !selectionInvalidForCurrentDashboard && ((tableData?.pagination?.total || 0) === 0);
  const canRenderAnalyticsPanels = !selectionInvalidForCurrentDashboard && !noDataForCurrentFilters;
  const selectedYearsSorted = useMemo(
    () => [...(filters.anios || [])].map(Number).filter(Number.isFinite).sort((a, b) => a - b),
    [filters.anios]
  );
  const trendSeriesComplete = useMemo(() => {
    const source = charts?.trendByYear || [];
    if (!selectedYearsSorted.length) return source;
    const byYear = new Map(source.map((row) => [Number(row.anio), row]));
    return selectedYearsSorted.map((anio) => byYear.get(anio) || { anio, promedio: null, n: 0, sinDato: true });
  }, [charts, selectedYearsSorted]);
  const controlSeriesComplete = useMemo(() => {
    const source = controlChart?.series || [];
    if (!selectedYearsSorted.length) return source;
    const byYear = new Map(source.map((row) => [Number(row.anio), row]));
    return selectedYearsSorted.map((anio) => byYear.get(anio) || { anio, value: null, sinDato: true });
  }, [controlChart, selectedYearsSorted]);
  const controlValues = (controlChart?.series || []).map((d) => Number(d.value)).filter(Number.isFinite);
  const controlMin = controlValues.length ? Math.min(...controlValues, Number(controlChart?.limits?.lcl ?? Infinity)) : 0;
  const controlMax = controlValues.length ? Math.max(...controlValues, Number(controlChart?.limits?.ucl ?? 0)) : 10;
  const controlPad = Math.max((controlMax - controlMin) * 0.15, 5);
  const splitCount = {
    GENERICAS: splitBars.GENERICAS.length,
    ESPECIFICAS: splitBars.ESPECIFICAS.length
  };
  const activeSectionMeta = availableNavOptions.find((item) => item.key === activeSection) || availableNavOptions[0] || INDIVIDUAL_NAV_OPTIONS[0];
  const highlightedRows = (tableData?.rows || []).slice(0, 8);
  const scholarshipRows = (tableData?.rows || []).slice(0, 12);

  /* ── Vista selector: qué sub-dashboard mostrar ── */
  const VISTA_OPTIONS = [
    { key: 'institucional', label: 'Institucional' },
    { key: 'programas',     label: 'Por Programa'  },
    { key: 'nbc',           label: 'Por NBC'        }
  ];

  const filterSelectSx = {
    fontSize: 13,
    fontWeight: 600,
    height: 36,
    bgcolor: '#fff',
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563eb', borderWidth: 1.5 }
  };

  if (activeSection === 'destacados') {
    return (
      <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100%', p: { xs: 1.5, md: 2 } }}>
          <ResultadosDestacados
            tipoPrueba={institutionalTestType}
            setTipoPrueba={setInstitutionalTestType}
            programas={filters.programas}
            setProgramas={(next) => setFilters((prev) => ({ ...prev, programas: next }))}
            anios={filters.anios}
            setAnios={(next) => setFilters((prev) => ({ ...prev, anios: next }))}
            periodos={filters.periodos}
            setPeriodos={(next) => setFilters((prev) => ({ ...prev, periodos: next }))}
            onlyTopPerProgram={destacadosTopPerProgram}
            setOnlyTopPerProgram={setDestacadosTopPerProgram}
            rows={tableData?.rows || []}
            catalogs={{
              programas: destacadosCatalogs.programas || [],
              anios: (destacadosCatalogs.anios || []).map(String),
              periodos: destacadosCatalogs.periodos || []
            }}
            loading={loadingData}
            error={error}
          />
      </Box>
    );
  }

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100%', p: { xs: 1.5, md: 2 } }}>

      {/* ── BARRA DE FILTROS ── */}
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          px: { xs: 1.5, md: 2 },
          py: 1.2,
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1.2,
          flexWrap: 'wrap'
        }}
      >
        {/* Sección activa */}
        <Chip
          label={activeSectionMeta.label}
          size="small"
          sx={{
            height: 28,
            fontWeight: 800,
            fontSize: 12,
            bgcolor: '#eff6ff',
            color: '#2563eb',
            border: '1.5px solid #bfdbfe',
            borderRadius: 1.5,
            mr: 0.5
          }}
        />

        <Box sx={{ width: 1, height: 24, bgcolor: '#e2e8f0', display: { xs: 'none', sm: 'block' } }} />

        {/* Vista toggle */}
        <Stack direction="row" spacing={0.4}>
          {VISTA_OPTIONS.map((v) => (
            <Button
              key={v.key}
              size="small"
              onClick={() => setSubDashboard(v.key)}
              sx={{
                height: 28,
                px: 1.2,
                fontSize: 11.5,
                fontWeight: 700,
                textTransform: 'none',
                borderRadius: 1.5,
                bgcolor: subDashboard === v.key ? '#2563eb' : 'transparent',
                color: subDashboard === v.key ? '#fff' : '#64748b',
                '&:hover': {
                  bgcolor: subDashboard === v.key ? '#1d4ed8' : '#f1f5f9',
                  color: subDashboard === v.key ? '#fff' : '#1e293b'
                }
              }}
            >
              {v.label}
            </Button>
          ))}
        </Stack>

        <Box sx={{ width: 1, height: 24, bgcolor: '#e2e8f0', display: { xs: 'none', sm: 'block' } }} />

        {/* Tipo de prueba */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 12 }}>Prueba</InputLabel>
          <Select
            label="Prueba"
            value={institutionalTestType}
            onChange={(e) => setInstitutionalTestType(e.target.value)}
            sx={filterSelectSx}
          >
            <MenuItem value="saber_pro" sx={{ fontSize: 13 }}>Saber Pro</MenuItem>
            <MenuItem value="tyt" sx={{ fontSize: 13 }}>TyT</MenuItem>
          </Select>
        </FormControl>

        {/* Años */}
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 12 }}>Años</InputLabel>
          <Select
            multiple
            label="Años"
            value={filters.anios}
            onChange={handleFilterChange('anios')}
            input={<OutlinedInput label="Años" />}
            MenuProps={SELECT_MENU_PROPS}
            renderValue={(sel) => sel.length ? `${sel.length} año(s)` : 'Sin selección'}
            sx={filterSelectSx}
          >
            <MenuItem onClick={() => setFilters((p) => ({ ...p, anios: [...(catalogs.anios || [])] }))}>
              <Checkbox checked={(catalogs.anios || []).length > 0 && filters.anios.length === (catalogs.anios || []).length} size="small" />
              <ListItemText primary="Todos los años" />
            </MenuItem>
            <MenuItem onClick={() => setFilters((p) => ({ ...p, anios: [] }))}>
              <Checkbox checked={filters.anios.length === 0} size="small" />
              <ListItemText primary="Ninguno" />
            </MenuItem>
            {(catalogs.anios || []).map((y) => (
              <MenuItem key={y} value={y}>
                <Checkbox checked={filters.anios.includes(y)} size="small" />
                <ListItemText primary={String(y)} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Periodo */}
        <FormControl size="small" sx={{ minWidth: 120 }}>
          <InputLabel sx={{ fontSize: 12 }}>Periodo</InputLabel>
          <Select
            multiple
            label="Periodo"
            value={filters.periodos}
            onChange={handleFilterChange('periodos')}
            input={<OutlinedInput label="Periodo" />}
            MenuProps={SELECT_MENU_PROPS}
            renderValue={(sel) => sel.length ? `${sel.length} periodo(s)` : 'Todos'}
            sx={filterSelectSx}
          >
            <MenuItem onClick={() => setFilters((p) => ({ ...p, periodos: [...(catalogs.periodos || [])] }))}>
              <Checkbox checked={(catalogs.periodos || []).length > 0 && filters.periodos.length === (catalogs.periodos || []).length} size="small" />
              <ListItemText primary="Todos" />
            </MenuItem>
            <MenuItem onClick={() => setFilters((p) => ({ ...p, periodos: [] }))}>
              <Checkbox checked={filters.periodos.length === 0} size="small" />
              <ListItemText primary="Ninguno" />
            </MenuItem>
            {(catalogs.periodos || []).map((p) => (
              <MenuItem key={p} value={p}>
                <Checkbox checked={filters.periodos.includes(p)} size="small" />
                <ListItemText primary={String(p)} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Programa (solo si vista = programas) */}
        {subDashboard === 'programas' && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ fontSize: 12 }}>Programa</InputLabel>
            <Select
              multiple
              label="Programa"
              value={filters.programas}
              onChange={handleFilterChange('programas')}
              input={<OutlinedInput label="Programa" />}
              MenuProps={SELECT_MENU_PROPS}
              renderValue={(sel) => sel.length ? sel[0] : 'Seleccionar uno'}
              sx={filterSelectSx}
            >
              <MenuItem onClick={() => setFilters((p) => ({ ...p, programas: [] }))}>
                <Checkbox checked={filters.programas.length === 0} size="small" />
                <ListItemText primary="Limpiar selección" />
              </MenuItem>
              {(catalogs.programas || []).map((item) => (
                <MenuItem key={item} value={item}>
                  <Checkbox checked={filters.programas.includes(item)} size="small" />
                  <ListItemText primary={item} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Grupo referencia (solo si vista = nbc) */}
        {subDashboard === 'nbc' && (
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel sx={{ fontSize: 12 }}>Grupo referencia</InputLabel>
            <Select
              multiple
              label="Grupo referencia"
              value={filters.gruposReferencia}
              onChange={handleFilterChange('gruposReferencia')}
              input={<OutlinedInput label="Grupo referencia" />}
              MenuProps={SELECT_MENU_PROPS}
              renderValue={(sel) => sel.length ? sel[0] : 'Seleccionar uno'}
              sx={filterSelectSx}
            >
              <MenuItem onClick={() => setFilters((p) => ({ ...p, gruposReferencia: [] }))}>
                <Checkbox checked={filters.gruposReferencia.length === 0} size="small" />
                <ListItemText primary="Limpiar selección" />
              </MenuItem>
              {(catalogs.gruposReferencia || []).map((item) => (
                <MenuItem key={item} value={item}>
                  <Checkbox checked={filters.gruposReferencia.includes(item)} size="small" />
                  <ListItemText primary={item} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        {/* Limpiar */}
        <Button
          size="small"
          onClick={() => setFilters({ ...BASE_FILTERS, anios: (catalogs.anios || []).slice(-5) })}
          sx={{
            ml: 'auto',
            height: 32,
            px: 1.5,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'none',
            color: '#64748b',
            borderRadius: 1.5,
            '&:hover': { bgcolor: '#f1f5f9', color: '#dc2626' }
          }}
        >
          ✕ Limpiar
        </Button>
      </Paper>

      {/* Alertas de validación (compactas, inline) */}
      {(invalidProgramSelection || invalidNbcSelection || invalidYearSelection || noDataForCurrentFilters) && (
        <Paper elevation={0} sx={{ mb: 1.5, px: 1.8, py: 1, borderRadius: 2, border: '1px solid #fde68a', bgcolor: '#fffbeb', display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#f59e0b', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 12.5, color: '#92400e', fontWeight: 600 }}>
            {invalidYearSelection ? 'Selecciona al menos un año para mostrar datos.'
              : invalidProgramSelection ? 'Vista "Por Programa": selecciona exactamente un programa académico.'
              : invalidNbcSelection ? 'Vista "Por NBC": selecciona exactamente un grupo de referencia.'
              : 'No hay datos para los filtros seleccionados. Ajusta los filtros.'}
          </Typography>
        </Paper>
      )}

      <Stack spacing={2} sx={{ width: '100%' }}>

      {(loadingCatalogs || loadingData) && <LinearProgress />}
      {error && activeSection !== 'destacados' && (
        <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2, border: '1px solid #fecaca', bgcolor: '#fff1f2' }}>
          <Typography variant="body2" sx={{ color: '#991b1b', fontWeight: 700 }}>{error}</Typography>
        </Paper>
      )}

      {activeSection === 'destacados' && (
        <ResultadosDestacados
          tipoPrueba={institutionalTestType}
          setTipoPrueba={setInstitutionalTestType}
          programas={filters.programas}
          setProgramas={(value) => setFilters((prev) => ({ ...prev, programas: value }))}
          anios={filters.anios}
          setAnios={(value) => setFilters((prev) => ({ ...prev, anios: value }))}
          periodos={filters.periodos}
          setPeriodos={(value) => setFilters((prev) => ({ ...prev, periodos: value }))}
          onlyTopPerProgram={destacadosTopPerProgram}
          setOnlyTopPerProgram={setDestacadosTopPerProgram}
          rows={tableData?.rows || []}
          catalogs={{
            programas: catalogs?.programas || [],
            anios: (catalogs?.anios || []).map(String),
            periodos: catalogs?.periodos || []
          }}
          loading={loadingData}
          error={error}
        />
      )}

      {activeSection === 'becas' && canRenderAnalyticsPanels && (
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fcfdff' }}>
          <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 0.5 }}>
            Becas por rendimiento general
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>
            Prioriza estudiantes con mejor puntaje global y percentil para procesos institucionales de reconocimiento.
          </Typography>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 800 }}>Candidato</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Programa</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Puntaje global</TableCell>
                  <TableCell sx={{ fontWeight: 800 }} align="right">Percentil</TableCell>
                  <TableCell sx={{ fontWeight: 800 }}>Lectura rápida</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {scholarshipRows.map((row, index) => (
                  <TableRow key={`${row.id || row.documento || row.nombre_estudiante || 'beca'}-${index}`}>
                    <TableCell>{row.nombre_estudiante || row.estudiante || row.documento || 'Registro institucional'}</TableCell>
                    <TableCell>{row.programa || row.programa_academico || '-'}</TableCell>
                    <TableCell align="right">{formatValue(row.puntaje_global)}</TableCell>
                    <TableCell align="right">{row.percentil_global == null ? '-' : formatValue(row.percentil_global)}</TableCell>
                    <TableCell>{Number(row.puntaje_global || 0) >= 180 ? 'Alta prioridad' : 'Seguimiento académico'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      )}

      {canRenderAnalyticsPanels ? (
        <>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, minmax(0, 1fr))' },
          gap: 1.5
        }}
      >
        {[
          { label: 'Evaluados',       value: formatValue(kpis.evaluados),       color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Promedio global', value: formatValue(kpis.promedioGlobal),  color: '#0891b2', bg: '#ecfeff', border: '#a5f3fc' },
          { label: 'Percentil prom.', value: formatValue(kpis.percentilPromedio), color: '#10b981', bg: '#f0fdf4', border: '#bbf7d0' },
          {
            label: 'Quintil',
            value: kpis.quintil || 'N/A',
            sub: kpis.variacionInteranual == null ? 'Sin base' : `${formatValue(kpis.variacionInteranual)}% var. interanual`,
            color: '#7c3aed', bg: '#faf5ff', border: '#ddd6fe'
          }
        ].map(({ label, value, sub, color, bg, border }) => (
          <Paper key={label} elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: `1.5px solid ${border}`, background: `linear-gradient(145deg, #fff 0%, ${bg} 100%)` }}>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.5 }}>
              {label}
            </Typography>
            <Typography sx={{ fontSize: 26, fontWeight: 900, color, lineHeight: 1, letterSpacing: '-0.03em' }}>
              {value}
            </Typography>
            {sub && <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.4, fontWeight: 500 }}>{sub}</Typography>}
          </Paper>
        ))}
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>Estadística descriptiva · Puntaje global</Typography>
          <Chip size="small" label="Puntaje global" sx={{ fontSize: 11, fontWeight: 700, bgcolor: '#f0f7ff', color: '#2563eb', border: '1px solid #bfdbfe' }} />
        </Stack>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, 1fr)', sm: 'repeat(5, 1fr)', md: 'repeat(9, 1fr)' }, gap: 1 }}>
          {[
            { key: 'N',      val: describeStats?.count,  color: '#2563eb' },
            { key: 'Media',  val: describeStats?.mean,   color: '#0891b2' },
            { key: 'DE',     val: describeStats?.std,    color: '#64748b' },
            { key: 'Mín',    val: describeStats?.min,    color: '#ef4444' },
            { key: 'Q1',     val: describeStats?.q1,     color: '#f59e0b' },
            { key: 'Med',    val: describeStats?.median, color: '#10b981' },
            { key: 'Q3',     val: describeStats?.q3,     color: '#8b5cf6' },
            { key: 'Máx',    val: describeStats?.max,    color: '#2563eb' },
            { key: 'Moda',   val: describeStats?.mode,   color: '#0891b2' }
          ].map(({ key, val, color }) => (
            <Box key={key} sx={{ p: 1, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #f1f5f9', textAlign: 'center' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{key}</Typography>
              <Typography sx={{ fontSize: 14, fontWeight: 900, color, mt: 0.2, lineHeight: 1 }}>
                {val == null ? '—' : formatValue(val)}
              </Typography>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* módulos genéricos detectados - badge compacto */}
      <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Chip size="small" label={`Competencias genéricas: ${splitCount.GENERICAS} módulos`} variant="outlined" sx={{ fontSize: 11, fontWeight: 700, color: '#2563eb', borderColor: '#bfdbfe', bgcolor: '#f0f7ff' }} />
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'stretch'
        }}
      >
        <ChartCard title="1. Tendencia anual de puntaje global" subtitle="Clic en un punto para filtrar por año. Eje X = año, eje Y = promedio de puntaje global." height={420}>
          <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendSeriesComplete}
                margin={{ top: 18, right: 20, left: 12, bottom: 8 }}
                onClick={(e) => {
                const year = e?.activePayload?.[0]?.payload?.anio;
                if (year) toggleListValue('anios', year);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="anio"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  allowDuplicatedCategory={false}
                  padding={{ left: 18, right: 18 }}
                  label={{ value: 'Año', position: 'insideBottom', offset: -5 }}
                />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Promedio', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Line type="monotone" dataKey="promedio" connectNulls stroke="#1d4ed8" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="promedio" position="top" offset={10} formatter={(v) => (v == null ? '' : Number(v).toFixed(1))} style={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={`2. Módulos (${competenciaVista.toLowerCase()}) por promedio`} subtitle="Clic en una barra para filtrar por módulo. Barras más largas = mayor promedio." height={420}>
          <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeBars.slice(0, 10)}
                layout="vertical"
                barCategoryGap={18}
                margin={{ left: 12, right: 44, top: 8, bottom: 8 }}
                onClick={(e) => {
                const modulo = e?.activePayload?.[0]?.payload?.modulo;
                if (modulo) toggleListValue('modulos', modulo);
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis type="number" tick={{ fontSize: 12 }} label={{ value: 'Promedio', position: 'insideBottom', offset: -4 }} />
                <YAxis
                  type="category"
                  dataKey="modulo"
                  width={150}
                  tick={{ fontSize: 11 }}
                  interval={0}
                />
                <Tooltip />
                <Bar dataKey="promedio" radius={[0, 8, 8, 0]} barSize={36}>
                  {activeBars.slice(0, 10).map((entry, idx) => <Cell key={`${entry.modulo}-${idx}`} fill={COLORS[idx % COLORS.length]} />)}
                  <LabelList dataKey="promedio" position="right" formatter={(v) => Number(v).toFixed(1)} style={{ fontSize: 11, fontWeight: 700, fill: '#334155' }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={`3. Histograma de puntaje global (${competenciaVista.toLowerCase()})`} subtitle="Distribución de frecuencias por rangos de puntaje (bins de 5 puntos)." height={420}>
          <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={histogramWithTrend} margin={{ top: 18, right: 20, left: 10, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="binStart" tick={{ fontSize: 12 }} label={{ value: 'Rango de puntaje', position: 'insideBottom', offset: -4 }} />
                <YAxis tick={{ fontSize: 12 }} label={{ value: 'Frecuencia', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(v) => [v, 'Frecuencia']} labelFormatter={(l) => `${l}-${Number(l) + 5}`} />
                <Bar dataKey="count" fill={competenciaVista === 'GENERICAS' ? '#2563eb' : '#f97316'} radius={[6, 6, 0, 0]}>
                  <LabelList dataKey="count" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
                </Bar>
                <Line
                  type="monotone"
                  dataKey="trend"
                  stroke="#0f172a"
                  strokeWidth={2}
                  dot={{ r: 2, fill: '#0f172a' }}
                  activeDot={{ r: 4 }}
                  name="Tendencia"
                />
              </ComposedChart>
            </ResponsiveContainer>
        </ChartCard>
        <ChartCard title={`4. Dispersión global vs módulo (${competenciaVista.toLowerCase()})`} subtitle="Cada punto es un registro. X = puntaje global, Y = puntaje del módulo." height={420}>
          <ResponsiveContainer width="100%" height="100%">
              <ScatterChart>
                <CartesianGrid stroke="#e2e8f0" />
                <XAxis type="number" dataKey="x" name="Global" tick={{ fontSize: 12 }} label={{ value: 'Puntaje global', position: 'insideBottom', offset: -4 }} />
                <YAxis type="number" dataKey="y" name="Modulo" tick={{ fontSize: 12 }} label={{ value: 'Puntaje módulo', angle: -90, position: 'insideLeft' }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter data={activeScatter.slice(0, 300)} fill={competenciaVista === 'GENERICAS' ? '#2563eb' : '#f97316'} />
              </ScatterChart>
            </ResponsiveContainer>
        </ChartCard>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 2,
          alignItems: 'stretch'
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <BoxplotSummary
            items={activeBoxplot}
            title={`5. Diagrama de bigotes (resumen) por módulo - ${competenciaVista.toLowerCase()}`}
            height={420}
          />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <CorrelationHeatmap
            title={`6. Matriz de correlación (${competenciaVista.toLowerCase()})`}
            labels={charts?.correlationMatrix?.labels || []}
            matrix={charts?.correlationMatrix?.matrix || []}
            height={420}
          />
        </Box>
        <ChartCard title="7. Gráfico de control (promedio anual)" subtitle="Seguimiento de estabilidad del promedio anual de puntaje global." height={420}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={controlSeriesComplete} margin={{ top: 24, right: 24, left: 12, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis
                  dataKey="anio"
                  tick={{ fontSize: 12 }}
                  interval={0}
                  allowDuplicatedCategory={false}
                  padding={{ left: 16, right: 16 }}
                  label={{ value: 'Año', position: 'insideBottom', offset: -4 }}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  domain={[Math.max(0, controlMin - controlPad), controlMax + controlPad]}
                  label={{ value: 'Promedio', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip />
                {Number.isFinite(Number(controlChart?.limits?.centerLine)) && (
                  <ReferenceLine y={controlChart?.limits?.centerLine} stroke="#475569" strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: 'CL', position: 'insideTopRight', fill: '#475569', fontSize: 11 }} />
                )}
                {Number.isFinite(Number(controlChart?.limits?.ucl)) && (
                  <ReferenceLine y={controlChart?.limits?.ucl} stroke="#ef4444" strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: 'UCL', position: 'insideTopLeft', fill: '#ef4444', fontSize: 11 }} />
                )}
                {Number.isFinite(Number(controlChart?.limits?.lcl)) && (
                  <ReferenceLine y={controlChart?.limits?.lcl} stroke="#f59e0b" strokeDasharray="6 4" ifOverflow="extendDomain" label={{ value: 'LCL', position: 'insideBottomLeft', fill: '#b45309', fontSize: 11 }} />
                )}
                <Line type="monotone" dataKey="value" connectNulls stroke="#10b981" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="value" content={renderSmartPointLabel} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
            <Stack direction="row" spacing={1} mt={0.6} flexWrap="wrap" useFlexGap>
              <Chip size="small" label={`CL: ${formatValue(controlChart?.limits?.centerLine)}`} />
              <Chip size="small" label={`UCL: ${formatValue(controlChart?.limits?.ucl)}`} />
              <Chip size="small" label={`LCL: ${formatValue(controlChart?.limits?.lcl)}`} />
            </Stack>
        </ChartCard>
        <ChartCard title={`8. Distribución por quintil (${competenciaVista.toLowerCase()})`} subtitle="Cantidad de módulos visibles por categoría de quintil." height={420}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={quintilDistribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="quintil" tick={{ fontSize: 12 }} label={{ value: 'Quintil', position: 'insideBottom', offset: -4 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} label={{ value: 'Conteo', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {quintilDistribution.map((row, idx) => <Cell key={row.quintil} fill={COLORS[idx % COLORS.length]} />)}
                  <LabelList dataKey="total" position="top" style={{ fontSize: 11, fontWeight: 700 }} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Conteo de módulos mostrados en la vista actual por categoría de quintil.
            </Typography>
        </ChartCard>
      </Box>

      <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
          <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 13.5 }}>
            Tabla analítica · Muestra actual
          </Typography>
          <Chip size="small" label={`${tableData?.pagination?.total || 0} registros`} sx={{ fontSize: 11, fontWeight: 700, bgcolor: '#f0f7ff', color: '#2563eb', border: '1px solid #bfdbfe' }} />
        </Stack>
        <TableContainer sx={{ maxHeight: 420 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell>Año</TableCell>
                <TableCell>Programa</TableCell>
                <TableCell>Periodo</TableCell>
                <TableCell>Competencias</TableCell>
                <TableCell>Módulo</TableCell>
                <TableCell align="right">Punt. módulo</TableCell>
                <TableCell align="right">Punt. global</TableCell>
                <TableCell align="right">% módulo</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(tableData?.rows || []).map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{row.anio || '-'}</TableCell>
                  <TableCell>{row.programa || '-'}</TableCell>
                  <TableCell>{row.periodo || '-'}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={row.competencias || classifyCompetencia(row)}
                      color={classifyCompetencia(row) === 'GENERICAS' ? 'primary' : 'warning'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>{row.modulo || '-'}</TableCell>
                  <TableCell align="right">{formatValue(row.puntaje_modulo)}</TableCell>
                  <TableCell align="right">{formatValue(row.puntaje_global)}</TableCell>
                  <TableCell align="right">{formatValue(row.percentil_nacional_modulo)}</TableCell>
                </TableRow>
              ))}
              {(tableData?.rows || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      No hay datos para los filtros seleccionados.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
        </>
      ) : (
        <Paper elevation={0} sx={{ p: 2.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff', display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3b82f6', flexShrink: 0 }} />
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1e40af' }}>
            Ajusta los filtros para visualizar el análisis — selecciona año y completa el filtro de la vista activa.
          </Typography>
        </Paper>
      )}
    </Stack>
    </Box>
  );
}

export default SaberProDashboard;
