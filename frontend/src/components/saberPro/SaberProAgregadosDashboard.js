import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import { useSnackbar } from 'notistack';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Cell,
  LabelList
} from 'recharts';
import gestionInformacionService from '../../services/gestionInformacionService';

const AGGREGATED_NAV_OPTIONS = [
  { key: 'general', label: 'Resultados Saber Pro agregados', description: 'Vista general institucional agregada por años y programas.' },
  { key: 'competencias_especificas', label: 'Agregados competencias específicas', description: 'Lectura enfocada en competencias específicas.' },
  { key: 'competencias_genericas', label: 'Agregados competencias genéricas', description: 'Lectura enfocada en competencias genéricas.' },
  { key: 'comparativo_general', label: 'Comparativo Saber Pro', description: 'Comparativo de programa frente al grupo de referencia.' },
  { key: 'comparativo_especificas', label: 'Comparativo específicas', description: 'Comparativo centrado en competencias específicas.' }
];

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value).trim();
  if (!text) return 0;

  // Soporta:
  // - "139.45" (decimal con punto)
  // - "139,45" (decimal con coma)
  // - "1.234,56" (miles + decimal coma)
  // - "1,234.56" (miles + decimal punto)
  const hasDot = text.includes('.');
  const hasComma = text.includes(',');
  if (hasDot && hasComma) {
    if (text.lastIndexOf(',') > text.lastIndexOf('.')) {
      text = text.replace(/\./g, '').replace(',', '.');
    } else {
      text = text.replace(/,/g, '');
    }
  } else if (hasComma) {
    text = text.replace(',', '.');
  }

  const n = Number(text);
  return Number.isFinite(n) ? n : 0;
};

const formatNumber = (value) => normalizeNumber(value).toLocaleString('es-CO');

const SABER_GENERIC_COMPETENCIES = new Set([
  'RAZONAMIENTO CUANTITATIVO',
  'LECTURA CRITICA',
  'LECTURA CRÍTICA',
  'COMUNICACION ESCRITA',
  'COMUNICACIÓN ESCRITA',
  'COMPETENCIAS CIUDADADANAS',
  'COMPETENCIAS CIUDADANAS',
  'INGLES',
  'INGLÉS'
]);

const normalizeCompetenciaText = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase();

const classifyAggregateCompetencia = (competencia = '') =>
  SABER_GENERIC_COMPETENCIES.has(normalizeCompetenciaText(competencia)) ? 'genericas' : 'especificas';

const parseTipoPruebaFromObservaciones = (text = '') => {
  const match = String(text || '').match(/tipo_prueba:\s*([^|]+)/i);
  return match ? String(match[1]).trim() : '';
};
const parseNumericFromObservaciones = (text = '', field = '') => {
  const escaped = String(field || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = String(text || '').match(new RegExp(`${escaped}:\\s*([^|]+)`, 'i'));
  if (!match) return null;
  const n = Number(String(match[1]).replace(',', '.').trim());
  return Number.isFinite(n) ? n : null;
};

const renderAggregateLineLabel = (props) => {
  const { x, y, value, index } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;
  const dy = index % 2 === 0 ? -14 : -26;
  return (
    <text
      x={x}
      y={y + dy}
      textAnchor="middle"
      fontSize="13"
      fontWeight="700"
      fill="#334155"
      style={{ pointerEvents: 'none' }}
    >
      {Number(value).toFixed(1)}
    </text>
  );
};

const renderAggregateLineLabelFactory = ({ color = '#334155', evenDy = -14, oddDy = -26 }) => (props) => {
  const { x, y, value, index } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;
  const dy = index % 2 === 0 ? evenDy : oddDy;
  return (
    <text
      x={x}
      y={y + dy}
      textAnchor="middle"
      fontSize="12"
      fontWeight="800"
      fill={color}
      style={{ pointerEvents: 'none' }}
    >
      {Number(value).toFixed(1)}
    </text>
  );
};

function SaberProAgregadosDashboard({ initialSection, allowedSections = [] } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [competenciaScope, setCompetenciaScope] = useState('genericas');
  const availableNavOptions = useMemo(() => {
    if (!Array.isArray(allowedSections) || allowedSections.length === 0) {
      return AGGREGATED_NAV_OPTIONS;
    }
    const allowedSet = new Set(allowedSections);
    return AGGREGATED_NAV_OPTIONS.filter((item) => allowedSet.has(item.key));
  }, [allowedSections]);
  const [activeSection, setActiveSection] = useState(initialSection || availableNavOptions[0]?.key || 'general');
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [selectedComparativoCompetencia, setSelectedComparativoCompetencia] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await gestionInformacionService.getEstadisticas({
          categoria: 'Saber Pro',
          subcategoria: 'Resultados agregados',
          page: 1,
          limit: 50000
        });
        if (!active) return;
        const mapped = (response?.data?.estadisticas || []).map((row) => ({
          ...row,
          anio: Number(row.anio),
          valor: normalizeNumber(row.valor),
          programa: String(row.programa || '').trim(),
          competencia: String(row.indicador || '').trim(),
          tipoPrueba: parseTipoPruebaFromObservaciones(row.observaciones),
          puntajeGrupoReferencia: parseNumericFromObservaciones(row.observaciones, 'puntaje_grupo_referencia'),
          puntajeInstitucion: parseNumericFromObservaciones(row.observaciones, 'puntaje_institucion'),
          competenciaGrupo: classifyAggregateCompetencia(row.indicador)
        }));
        setRows(mapped);
        const years = Array.from(new Set(mapped.map((r) => r.anio).filter((x) => Number.isFinite(x)))).sort((a, b) => a - b);
        const programs = Array.from(new Set(mapped.map((r) => r.programa).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
        setSelectedYears(years.slice(-8));
        setSelectedPrograms(programs);
      } catch (error) {
        enqueueSnackbar(error?.response?.data?.message || 'Error al cargar resultados agregados', { variant: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [enqueueSnackbar]);

  useEffect(() => {
    if (!availableNavOptions.some((item) => item.key === activeSection)) {
      setActiveSection(availableNavOptions[0]?.key || 'general');
    }
  }, [activeSection, availableNavOptions]);

  useEffect(() => {
    if (activeSection === 'competencias_especificas' || activeSection === 'comparativo_especificas') {
      setCompetenciaScope('especificas');
      return;
    }
    if (activeSection === 'competencias_genericas') {
      setCompetenciaScope('genericas');
      return;
    }
    setCompetenciaScope('todas');
  }, [activeSection]);

  const availableYears = useMemo(
    () => Array.from(new Set(rows.map((r) => r.anio).filter((x) => Number.isFinite(x)))).sort((a, b) => a - b),
    [rows]
  );
  const availablePrograms = useMemo(
    () => Array.from(new Set(rows.map((r) => r.programa).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [rows]
  );

  const filteredRows = useMemo(() => rows.filter((row) => {
    const yearOk = selectedYears.length ? selectedYears.includes(row.anio) : false;
    const programOk = selectedPrograms.length ? selectedPrograms.includes(row.programa) : false;
    const groupOk = competenciaScope === 'todas' ? true : row.competenciaGrupo === competenciaScope;
    return yearOk && programOk && groupOk;
  }), [rows, selectedYears, selectedPrograms, competenciaScope]);

  const competencias = useMemo(
    () => Array.from(new Set(filteredRows.map((r) => r.competencia).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es')),
    [filteredRows]
  );

  useEffect(() => {
    if (selectedCompetencia && !competencias.includes(selectedCompetencia)) {
      setSelectedCompetencia('');
    }
  }, [selectedCompetencia, competencias]);
  useEffect(() => {
    if (selectedComparativoCompetencia && !competencias.includes(selectedComparativoCompetencia)) {
      setSelectedComparativoCompetencia('');
    }
  }, [selectedComparativoCompetencia, competencias]);

  const matrixYears = useMemo(() => [...selectedYears].sort((a, b) => a - b), [selectedYears]);

  const matrixRows = useMemo(() => {
    const grouped = new Map();
    filteredRows.forEach((row) => {
      if (!grouped.has(row.competencia)) grouped.set(row.competencia, new Map());
      const yearMap = grouped.get(row.competencia);
      const list = yearMap.get(row.anio) || [];
      list.push(row.valor);
      yearMap.set(row.anio, list);
    });

    const rowsBuilt = Array.from(grouped.entries()).map(([competencia, yearMap]) => {
      const byYear = {};
      matrixYears.forEach((anio) => {
        const values = yearMap.get(anio) || [];
        byYear[anio] = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      });
      const valid = Object.values(byYear).filter((v) => Number.isFinite(v));
      const promedio = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
      return { competencia, byYear, promedio };
    }).sort((a, b) => (b.promedio || 0) - (a.promedio || 0));

    const promedioGeneralByYear = {};
    matrixYears.forEach((anio) => {
      const yearValues = filteredRows.filter((r) => r.anio === anio).map((r) => r.valor).filter(Number.isFinite);
      promedioGeneralByYear[anio] = yearValues.length ? yearValues.reduce((a, b) => a + b, 0) / yearValues.length : null;
    });
    const generalVals = Object.values(promedioGeneralByYear).filter((v) => Number.isFinite(v));
    const promedioGeneral = generalVals.length ? generalVals.reduce((a, b) => a + b, 0) / generalVals.length : null;

    return {
      rows: rowsBuilt,
      promedioRow: { competencia: 'PROMEDIO', byYear: promedioGeneralByYear, promedio: promedioGeneral }
    };
  }, [filteredRows, matrixYears]);

  const activeTrendMeta = useMemo(() => ({
    key: selectedCompetencia ? 'competenciaSeleccionada' : 'promedioGeneral',
    name: selectedCompetencia || 'PROMEDIO',
    color: selectedCompetencia ? '#7c3aed' : '#2563eb'
  }), [selectedCompetencia]);

  const generalTrendData = useMemo(() => {
    const selectedRow = selectedCompetencia
      ? matrixRows.rows.find((r) => r.competencia === selectedCompetencia)
      : null;
    return matrixYears.map((anio) => ({
      anio,
      promedioGeneral: matrixRows.promedioRow.byYear?.[anio] ?? null,
      competenciaSeleccionada: selectedRow?.byYear?.[anio] ?? null
    }));
  }, [matrixRows, matrixYears, selectedCompetencia]);

  const trendYMax = useMemo(() => {
    const values = generalTrendData
      .map((row) => Number(row[activeTrendMeta.key]))
      .filter((v) => Number.isFinite(v));
    const maxVal = values.length ? Math.max(...values) : 0;
    return Math.min(300, Math.max(50, Math.ceil((maxVal * 1.15) / 5) * 5));
  }, [generalTrendData, activeTrendMeta]);

  const trendYMin = useMemo(() => {
    const values = generalTrendData
      .map((row) => Number(row[activeTrendMeta.key]))
      .filter((v) => Number.isFinite(v));
    if (!values.length) return 0;
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const span = Math.max(maxVal - minVal, 1);
    const pad = Math.max(span * 0.5, 2);
    return Math.max(0, Math.floor((minVal - pad) / 5) * 5);
  }, [generalTrendData, activeTrendMeta]);

  const competenciaBarData = useMemo(
    () => matrixRows.rows.slice(0, 12).map((r) => ({ competencia: r.competencia, promedio: r.promedio || 0 })),
    [matrixRows]
  );

  const comparativeData = useMemo(() => {
    const grouped = new Map();
    filteredRows.forEach((row) => {
      if (!grouped.has(row.competencia)) grouped.set(row.competencia, new Map());
      const byYear = grouped.get(row.competencia);
      const bucket = byYear.get(row.anio) || { programa: [], grupo: [] };
      if (Number.isFinite(Number(row.valor))) bucket.programa.push(Number(row.valor));
      if (Number.isFinite(Number(row.puntajeGrupoReferencia))) bucket.grupo.push(Number(row.puntajeGrupoReferencia));
      byYear.set(row.anio, bucket);
    });

    const rowsSummary = Array.from(grouped.entries()).map(([competencia, byYear]) => {
      const series = matrixYears.map((anio) => {
        const cell = byYear.get(anio) || { programa: [], grupo: [] };
        const p = cell.programa.length ? cell.programa.reduce((a, b) => a + b, 0) / cell.programa.length : null;
        const g = cell.grupo.length ? cell.grupo.reduce((a, b) => a + b, 0) / cell.grupo.length : null;
        return { anio, programa: p, grupo: g };
      });
      const pVals = series.map((s) => s.programa).filter((v) => Number.isFinite(v));
      const gVals = series.map((s) => s.grupo).filter((v) => Number.isFinite(v));
      const promPrograma = pVals.length ? pVals.reduce((a, b) => a + b, 0) / pVals.length : null;
      const promGrupo = gVals.length ? gVals.reduce((a, b) => a + b, 0) / gVals.length : null;
      return {
        competencia,
        series,
        promPrograma,
        promGrupo,
        brecha: Number.isFinite(promPrograma) && Number.isFinite(promGrupo) ? promPrograma - promGrupo : null
      };
    }).sort((a, b) => Math.abs(b.brecha || 0) - Math.abs(a.brecha || 0));

    const avgSeries = matrixYears.map((anio) => {
      const yearRows = filteredRows.filter((r) => r.anio === anio);
      const pVals = yearRows.map((r) => Number(r.valor)).filter((v) => Number.isFinite(v));
      const gVals = yearRows.map((r) => Number(r.puntajeGrupoReferencia)).filter((v) => Number.isFinite(v));
      return {
        anio,
        programa: pVals.length ? pVals.reduce((a, b) => a + b, 0) / pVals.length : null,
        grupo: gVals.length ? gVals.reduce((a, b) => a + b, 0) / gVals.length : null
      };
    });
    const pAll = avgSeries.map((x) => x.programa).filter((v) => Number.isFinite(v));
    const gAll = avgSeries.map((x) => x.grupo).filter((v) => Number.isFinite(v));
    const totalRow = {
      competencia: 'PUNTAJE GENERAL (PROMEDIO)',
      series: avgSeries,
      promPrograma: pAll.length ? pAll.reduce((a, b) => a + b, 0) / pAll.length : null,
      promGrupo: gAll.length ? gAll.reduce((a, b) => a + b, 0) / gAll.length : null
    };
    totalRow.brecha = Number.isFinite(totalRow.promPrograma) && Number.isFinite(totalRow.promGrupo)
      ? totalRow.promPrograma - totalRow.promGrupo
      : null;

    return { rows: rowsSummary, totalRow };
  }, [filteredRows, matrixYears]);

  const comparativeActiveMeta = useMemo(() => {
    const selected = comparativeData.rows.find((r) => r.competencia === selectedComparativoCompetencia);
    return selected || comparativeData.totalRow;
  }, [comparativeData, selectedComparativoCompetencia]);

  const comparativeTrendData = useMemo(
    () => (comparativeActiveMeta?.series || []).map((s) => ({
      anio: s.anio,
      programa: s.programa,
      grupo: s.grupo
    })),
    [comparativeActiveMeta]
  );

  const comparativeYBounds = useMemo(() => {
    const vals = comparativeTrendData.flatMap((r) => [Number(r.programa), Number(r.grupo)]).filter((v) => Number.isFinite(v));
    if (!vals.length) return { min: 0, max: 300 };
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = Math.max(maxVal - minVal, 1);
    const pad = Math.max(span * 0.5, 2);
    return {
      min: Math.max(0, Math.floor((minVal - pad) / 5) * 5),
      max: Math.min(300, Math.ceil((maxVal + pad) / 5) * 5)
    };
  }, [comparativeTrendData]);

  const barDataMax = useMemo(
    () => Math.max(...competenciaBarData.map((r) => Number(r.promedio) || 0), 0),
    [competenciaBarData]
  );
  const barXAxisMax = Math.min(300, Math.max(50, Math.ceil((barDataMax * 1.5) / 5) * 5));

  const summaryCards = useMemo(() => {
    const totalRegs = filteredRows.length;
    const programas = new Set(filteredRows.map((r) => r.programa).filter(Boolean)).size;
    const promedioGeneral = matrixRows.promedioRow.promedio;
    const competenciasVisibles = matrixRows.rows.length;
    const aniosVisibles = matrixYears.length;
    const maxPuntaje = Math.max(...matrixRows.rows.map((r) => Number(r.promedio) || 0), 0);
    return { totalRegs, programas, promedioGeneral, competenciasVisibles, aniosVisibles, maxPuntaje };
  }, [filteredRows, matrixRows, matrixYears]);

  const handleToggleSelection = (setter, currentValues, allValues, value) => {
    if (value === '__all__') {
      setter(currentValues.length === allValues.length ? [] : [...allValues]);
      return;
    }
    setter(currentValues.includes(value) ? currentValues.filter((v) => v !== value) : [...currentValues, value]);
  };
  const activeSectionMeta = availableNavOptions.find((item) => item.key === activeSection) || availableNavOptions[0] || AGGREGATED_NAV_OPTIONS[0];

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe6f5', borderRadius: 2, bgcolor: '#f8fbff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 2 }}>
          <Box>
            <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 20 }}>
              Resultados agregados
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Menú ejecutivo para navegar por agregados, competencias y comparativos.
            </Typography>
          </Box>
          <FormControl size="small" sx={{ minWidth: 320 }}>
            <InputLabel>Navegación</InputLabel>
            <Select
              label="Navegación"
              value={activeSection}
              onChange={(event) => setActiveSection(event.target.value)}
              sx={{ bgcolor: '#ffffff', borderRadius: 999, fontWeight: 800 }}
            >
              {availableNavOptions.map((item) => (
                <MenuItem key={item.key} value={item.key}>
                  {item.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
        <Chip size="small" color="primary" variant="outlined" label={activeSectionMeta.description} sx={{ mb: 2 }} />
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'center' }}>
          <FormControl size="small" sx={{ minWidth: 260 }}>
            <InputLabel>Años</InputLabel>
            <Select
              multiple
              value={selectedYears}
              label="Años"
              renderValue={(selected) => selected.length ? `${selected.length} año(s)` : 'Sin selección'}
            >
              <MenuItem onClick={() => handleToggleSelection(setSelectedYears, selectedYears, availableYears, '__all__')}>
                <Checkbox checked={availableYears.length > 0 && selectedYears.length === availableYears.length} />
                <ListItemText primary="Seleccionar todos" />
              </MenuItem>
              {availableYears.map((anio) => (
                <MenuItem key={anio} value={anio} onClick={() => handleToggleSelection(setSelectedYears, selectedYears, availableYears, anio)}>
                  <Checkbox checked={selectedYears.includes(anio)} />
                  <ListItemText primary={String(anio)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 320, flex: 1 }}>
            <InputLabel>Programas</InputLabel>
            <Select
              multiple
              value={selectedPrograms}
              label="Programas"
              renderValue={(selected) => selected.length ? `${selected.length} programa(s)` : 'Sin selección'}
            >
              <MenuItem onClick={() => handleToggleSelection(setSelectedPrograms, selectedPrograms, availablePrograms, '__all__')}>
                <Checkbox checked={availablePrograms.length > 0 && selectedPrograms.length === availablePrograms.length} />
                <ListItemText primary="Seleccionar todos" />
              </MenuItem>
              {availablePrograms.map((programa) => (
                <MenuItem key={programa} value={programa} onClick={() => handleToggleSelection(setSelectedPrograms, selectedPrograms, availablePrograms, programa)}>
                  <Checkbox checked={selectedPrograms.includes(programa)} />
                  <ListItemText primary={programa} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Stack
            direction="row"
            spacing={1}
            flexWrap="wrap"
            useFlexGap
            justifyContent="center"
            sx={{ width: { xs: '100%', lg: 'auto' }, '& .MuiButton-root': { minHeight: 40, px: 2.1, fontWeight: 800, borderRadius: 2 } }}
          >
            <Button
              size="medium"
              variant={competenciaScope === 'genericas' ? 'contained' : 'outlined'}
              onClick={() => setCompetenciaScope('genericas')}
            >
              Genéricas
            </Button>
            <Button
              size="medium"
              variant={competenciaScope === 'especificas' ? 'contained' : 'outlined'}
              onClick={() => setCompetenciaScope('especificas')}
            >
              Específicas
            </Button>
            <Button
              size="medium"
              variant={competenciaScope === 'todas' ? 'contained' : 'outlined'}
              onClick={() => setCompetenciaScope('todas')}
            >
              Todas
            </Button>
            <Button size="medium" variant="text" onClick={() => setSelectedCompetencia('')}>
              Limpiar fila
            </Button>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} sx={{ mt: 1.2 }} flexWrap="wrap" useFlexGap>
          <Chip size="small" label={`Registros: ${formatNumber(summaryCards.totalRegs)}`} />
          <Chip size="small" label={`Programas visibles: ${summaryCards.programas}`} />
          <Chip size="small" color="primary" variant="outlined" label={`Promedio general: ${summaryCards.promedioGeneral ? Number(summaryCards.promedioGeneral).toFixed(1) : 'N/A'}`} />
          <Chip size="small" color={selectedCompetencia ? 'secondary' : 'default'} variant="outlined" label={`Fila activa: ${selectedCompetencia || 'General'}`} />
        </Stack>
      </Paper>

      {loading ? (
        <Paper elevation={0} sx={{ p: 4, border: '1px solid #dbe6f5', borderRadius: 2 }}>
          <Typography align="center">Cargando resultados agregados...</Typography>
        </Paper>
      ) : filteredRows.length === 0 ? (
        <Paper elevation={0} sx={{ p: 4, border: '1px solid #dbe6f5', borderRadius: 2 }}>
          <Typography align="center" sx={{ color: '#334155', fontWeight: 700 }}>
            No hay datos para la combinación de filtros seleccionada.
          </Typography>
        </Paper>
      ) : (
        <>
          <Stack spacing={2} sx={{ width: '100%' }}>
            <Paper elevation={0} sx={{ width: '100%', border: '1px solid #dbe6f5', borderRadius: 3, overflow: 'hidden', boxShadow: '0 6px 22px rgba(15,23,42,0.04)' }}>
                <Box sx={{ p: 1.5, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a' }}>
                    Tabla interactiva por competencia (clic en fila para filtrar gráfico)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Al seleccionar una fila, la gráfica muestra solo esa competencia. Sin selección, muestra la fila PROMEDIO.
                  </Typography>
                </Box>
                <TableContainer sx={{ width: '100%', maxHeight: 460 }}>
                  <Table stickyHeader size="small" sx={{ width: '100%', tableLayout: 'auto' }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 800, minWidth: 220, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Competencia</TableCell>
                        {matrixYears.map((anio) => (
                          <TableCell key={anio} align="right" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>{anio}</TableCell>
                        ))}
                        <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#dbeafe', color: '#1e3a8a' }}>Prom.</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...matrixRows.rows, matrixRows.promedioRow].map((row) => {
                        const isProm = row.competencia === 'PROMEDIO';
                        const selected = selectedCompetencia === row.competencia;
                        return (
                          <TableRow
                            key={row.competencia}
                            hover
                            onClick={() => !isProm && setSelectedCompetencia((prev) => (prev === row.competencia ? '' : row.competencia))}
                            sx={{
                              cursor: isProm ? 'default' : 'pointer',
                              bgcolor: isProm ? '#eff6ff' : (selected ? '#f5f3ff' : 'inherit'),
                              '&:nth-of-type(even)': isProm ? {} : { bgcolor: selected ? '#f5f3ff' : '#fbfdff' },
                              '& td': {
                                fontWeight: isProm ? 800 : 500,
                                borderBottom: '1px solid #edf2f7'
                              }
                            }}
                          >
                            <TableCell sx={{ color: isProm ? '#1e3a8a' : (selected ? '#6d28d9' : '#1f2937') }}>
                              {row.competencia}
                            </TableCell>
                            {matrixYears.map((anio) => (
                              <TableCell key={`${row.competencia}-${anio}`} align="right" sx={{ color: row.byYear?.[anio] == null ? '#94a3b8' : '#334155' }}>
                                {row.byYear?.[anio] == null ? '-' : Number(row.byYear[anio]).toFixed(2)}
                              </TableCell>
                            ))}
                            <TableCell align="right" sx={{ fontWeight: 800, color: isProm ? '#1e3a8a' : '#111827' }}>
                              {row.promedio == null ? '-' : Number(row.promedio).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            <Box
              sx={{
                width: '100%',
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                gap: 2,
                alignItems: 'stretch'
              }}
            >
                <Paper elevation={0} sx={{ p: 1.6, border: '1px solid #dbe6f5', borderRadius: 3, height: 360, boxShadow: '0 6px 22px rgba(15,23,42,0.04)', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                    Evolución del resultado {selectedCompetencia ? `- ${selectedCompetencia}` : '(fila PROMEDIO)'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Línea única de comportamiento con eje Y ajustado para resaltar mejor la fluctuación anual.
                  </Typography>
                  <Box sx={{ height: 300, mt: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={generalTrendData} margin={{ top: 30, right: 40, left: 12, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="anio" interval={0} padding={{ left: 18, right: 22 }} tick={false} axisLine={false} tickLine={false} />
                        <YAxis domain={[trendYMin, trendYMax]} width={48} />
                        <RechartsTooltip formatter={(v, name) => (v == null ? ['-', name] : [Number(v).toFixed(2), name])} />
                        <Line
                          type="monotone"
                          dataKey={activeTrendMeta.key}
                          name={activeTrendMeta.name}
                          connectNulls
                          stroke={activeTrendMeta.color}
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#fff', stroke: activeTrendMeta.color, strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList dataKey={activeTrendMeta.key} content={renderAggregateLineLabel} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>

                <Paper elevation={0} sx={{ p: 1.6, border: '1px solid #dbe6f5', borderRadius: 3, height: 360, boxShadow: '0 6px 22px rgba(15,23,42,0.04)', minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.5 }}>
                    Resultado por competencia (promedio del programa)
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Ranking de competencias con los filtros actuales. Clic en barra para activar la misma vista que en la tabla.
                  </Typography>
                  <Box sx={{ height: 300, mt: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={competenciaBarData}
                        layout="vertical"
                        margin={{ top: 8, right: 46, left: 8, bottom: 8 }}
                        onClick={(e) => {
                          const comp = e?.activePayload?.[0]?.payload?.competencia;
                          if (comp) setSelectedCompetencia((prev) => (prev === comp ? '' : comp));
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis type="number" domain={[0, barXAxisMax]} tick={false} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="competencia" width={190} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v) => Number(v).toFixed(2)} />
                        <Bar dataKey="promedio" radius={[0, 8, 8, 0]}>
                          {competenciaBarData.map((item, idx) => (
                            <Cell key={item.competencia} fill={item.competencia === selectedCompetencia ? '#7c3aed' : ['#2563eb', '#0ea5e9', '#f59e0b', '#ef4444', '#10b981'][idx % 5]} />
                          ))}
                          <LabelList dataKey="promedio" position="right" formatter={(v) => Number(v).toFixed(1)} style={{ fontSize: 13, fontWeight: 800, fill: '#334155' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Box>
            <Paper elevation={0} sx={{ width: '100%', p: 1.6, border: '1px solid #dbe6f5', borderRadius: 3, boxShadow: '0 6px 22px rgba(15,23,42,0.04)' }}>
              <Box sx={{ mb: 1.5 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>
                  Comparativo
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Comparativo de líneas entre Programa y Grupo de Referencia. La tabla filtra la gráfica al hacer clic en la fila.
                </Typography>
              </Box>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
                  gap: 2,
                  alignItems: 'stretch'
                }}
              >
                <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
                  <TableContainer sx={{ maxHeight: 360 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Competencia</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Programa</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Grupo ref.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#dbeafe', color: '#1e3a8a' }}>Brecha</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[comparativeData.totalRow, ...comparativeData.rows].map((row) => {
                          const isTotal = row.competencia === 'PUNTAJE GENERAL (PROMEDIO)';
                          const selected = selectedComparativoCompetencia === row.competencia;
                          return (
                            <TableRow
                              key={`cmp-${row.competencia}`}
                              hover
                              onClick={() => setSelectedComparativoCompetencia((prev) => (prev === row.competencia || isTotal ? '' : row.competencia))}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: isTotal ? '#eff6ff' : (selected ? '#f5f3ff' : 'inherit'),
                                '&:nth-of-type(even)': isTotal ? {} : { bgcolor: selected ? '#f5f3ff' : '#fbfdff' },
                                '& td': { borderBottom: '1px solid #edf2f7', fontWeight: isTotal ? 800 : 500 }
                              }}
                            >
                              <TableCell sx={{ color: isTotal ? '#1e3a8a' : (selected ? '#6d28d9' : '#1f2937') }}>
                                {row.competencia}
                              </TableCell>
                              <TableCell align="right">{row.promPrograma == null ? '-' : Number(row.promPrograma).toFixed(2)}</TableCell>
                              <TableCell align="right">{row.promGrupo == null ? '-' : Number(row.promGrupo).toFixed(2)}</TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 800,
                                  color: row.brecha == null ? '#64748b' : row.brecha >= 0 ? '#166534' : '#b91c1c'
                                }}
                              >
                                {row.brecha == null ? '-' : `${row.brecha >= 0 ? '+' : ''}${Number(row.brecha).toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
                  <Box sx={{ p: 1.2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                    <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 14 }}>
                      Soporte de datos (Grupo de referencia)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      Valores anuales usados para trazar las dos líneas comparativas.
                    </Typography>
                  </Box>
                  <TableContainer sx={{ maxHeight: 360 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Año</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Programa</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#eff6ff', color: '#1e3a8a' }}>Grupo ref.</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#dbeafe', color: '#1e3a8a' }}>Brecha</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(comparativeActiveMeta?.series || []).map((row) => {
                          const brecha = Number.isFinite(row.programa) && Number.isFinite(row.grupo) ? row.programa - row.grupo : null;
                          return (
                            <TableRow key={`cmp-year-${row.anio}`} hover>
                              <TableCell sx={{ fontWeight: 700 }}>{row.anio}</TableCell>
                              <TableCell align="right">{row.programa == null ? '-' : Number(row.programa).toFixed(2)}</TableCell>
                              <TableCell align="right">{row.grupo == null ? '-' : Number(row.grupo).toFixed(2)}</TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontWeight: 800, color: brecha == null ? '#64748b' : brecha >= 0 ? '#166534' : '#b91c1c' }}
                              >
                                {brecha == null ? '-' : `${brecha >= 0 ? '+' : ''}${Number(brecha).toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.4,
                    border: '1px solid #e2e8f0',
                    borderRadius: 2,
                    minWidth: 0,
                    gridColumn: { xs: 'auto', lg: '1 / -1' }
                  }}
                >
                  <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.4 }}>
                    {selectedComparativoCompetencia || 'PUNTAJE GENERAL (PROMEDIO)'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    Línea azul: Programa académico. Línea gris: Grupo de referencia. Clic en una fila para cambiar la comparación.
                  </Typography>
                  <Box sx={{ height: 340, mt: 1 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={comparativeTrendData} margin={{ top: 30, right: 44, left: 14, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="anio" interval={0} padding={{ left: 18, right: 22 }} />
                        <YAxis domain={[comparativeYBounds.min, comparativeYBounds.max]} width={48} />
                        <RechartsTooltip formatter={(v) => (v == null ? '-' : Number(v).toFixed(2))} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="grupo"
                          name="Grupo de referencia"
                          connectNulls
                          stroke="#64748b"
                          strokeWidth={2.5}
                          dot={{ r: 4, fill: '#fff', stroke: '#64748b', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList dataKey="grupo" content={renderAggregateLineLabelFactory({ color: '#475569', evenDy: -16, oddDy: -28 })} />
                        </Line>
                        <Line
                          type="monotone"
                          dataKey="programa"
                          name="Programa académico"
                          connectNulls
                          stroke="#2563eb"
                          strokeWidth={3}
                          dot={{ r: 4, fill: '#fff', stroke: '#2563eb', strokeWidth: 2 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList dataKey="programa" content={renderAggregateLineLabelFactory({ color: '#1d4ed8', evenDy: 20, oddDy: 32 })} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Box>
            </Paper>
          </Stack>
        </>
      )}
    </Stack>
  );
}



export default SaberProAgregadosDashboard;
