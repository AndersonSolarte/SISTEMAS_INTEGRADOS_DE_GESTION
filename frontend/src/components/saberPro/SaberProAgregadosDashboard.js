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
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
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

/* Solo se mantiene la vista general */
const AGGREGATED_NAV_OPTIONS = [
  { key: 'general', label: 'Resultados Saber Pro Agregados', description: 'Vista general institucional agregada por años y programas.' }
];

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value).trim();
  if (!text) return 0;

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

/* Colores institucionales — azul medio, no tan intenso */
const INST_BLUE       = '#2563eb';
const INST_BLUE_MED   = '#3b82f6';
const INST_BLUE_LIGHT = '#eff6ff';
const INST_BLUE_PALE  = '#dbeafe';

function SaberProAgregadosDashboard({ initialSection, allowedSections = [] } = {}) {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [competenciaScope, setCompetenciaScope] = useState('todas');
  const availableNavOptions = useMemo(() => {
    if (!Array.isArray(allowedSections) || allowedSections.length === 0) {
      return AGGREGATED_NAV_OPTIONS;
    }
    const allowedSet = new Set(allowedSections);
    return AGGREGATED_NAV_OPTIONS.filter((item) => allowedSet.has(item.key));
  }, [allowedSections]);
  const [activeSection] = useState(initialSection || 'general');
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
    color: selectedCompetencia ? '#7c3aed' : INST_BLUE_MED
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

  /* Serie fija del PUNTAJE GENERAL (PROMEDIO) — siempre muestra el total, no cambia con clicks */
  const comparativeTotalSeries = useMemo(
    () => (comparativeData.totalRow?.series || []).map((s) => ({
      anio: s.anio,
      programa: s.programa,
      grupo: s.grupo
    })),
    [comparativeData]
  );

  const comparativeTotalYBounds = useMemo(() => {
    const vals = comparativeTotalSeries
      .flatMap((r) => [Number(r.programa), Number(r.grupo)])
      .filter((v) => Number.isFinite(v));
    if (!vals.length) return { min: 0, max: 300 };
    const minVal = Math.min(...vals);
    const maxVal = Math.max(...vals);
    const span = Math.max(maxVal - minVal, 1);
    const pad = Math.max(span * 0.5, 2);
    return {
      min: Math.max(0, Math.floor((minVal - pad) / 5) * 5),
      max: Math.min(300, Math.ceil((maxVal + pad) / 5) * 5)
    };
  }, [comparativeTotalSeries]);

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

  const handleClearFilters = () => {
    setSelectedYears(availableYears.slice(-8));
    setSelectedPrograms(availablePrograms);
    setCompetenciaScope('todas');
    setSelectedCompetencia('');
    setSelectedComparativoCompetencia('');
  };

  /* ─── Estilos reutilizables ─────────────────────────────── */
  const sectionHeaderSx = {
    px: 3,
    py: 2,
    background: `linear-gradient(90deg, ${INST_BLUE} 0%, ${INST_BLUE_MED} 100%)`
  };

  const tableHeadCellSx = {
    fontWeight: 800,
    bgcolor: INST_BLUE,
    color: '#ffffff',
    borderBottom: 'none'
  };

  const tableHeadCellAccentSx = {
    fontWeight: 800,
    bgcolor: INST_BLUE_MED,
    color: '#ffffff',
    borderBottom: 'none'
  };

  return (
    <Stack spacing={2.5} sx={{ p: { xs: 1.5, md: 2 } }}>

      {/* ══════════════════════════════════════════════
          FILTROS — card profesional
      ══════════════════════════════════════════════ */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: '14px',
          boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff'
        }}
      >
        {/* Encabezado */}
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5} sx={{ mb: 2.5 }}>
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.4 }}>
              <FilterListRoundedIcon sx={{ fontSize: 18, color: INST_BLUE }} />
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 18, letterSpacing: '-0.02em' }}>
                Resultados Saber Pro Agregados
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: '#64748b', ml: 3.5 }}>
              Vista general institucional agregada por años y programas.
            </Typography>
          </Box>
          <Button
            variant="outlined"
            size="small"
            onClick={handleClearFilters}
            sx={{
              borderRadius: '8px',
              fontWeight: 700,
              fontSize: 12.5,
              borderColor: '#e2e8f0',
              color: '#64748b',
              px: 2,
              whiteSpace: 'nowrap',
              '&:hover': { borderColor: '#94a3b8', bgcolor: '#f8fafc', color: '#334155' }
            }}
          >
            Limpiar filtros
          </Button>
        </Stack>

        {/* Grid de filtros */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '1fr 2fr auto' },
            gap: 2,
            alignItems: 'end'
          }}
        >
          {/* Años */}
          <FormControl size="small" fullWidth>
            <InputLabel>Años</InputLabel>
            <Select
              multiple
              value={selectedYears}
              label="Años"
              renderValue={(selected) => selected.length ? `${selected.length} año(s) seleccionado(s)` : 'Sin selección'}
              sx={{ borderRadius: '10px', bgcolor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
            >
              <MenuItem onClick={() => handleToggleSelection(setSelectedYears, selectedYears, availableYears, '__all__')}>
                <Checkbox checked={availableYears.length > 0 && selectedYears.length === availableYears.length} size="small" />
                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }} />
              </MenuItem>
              {availableYears.map((anio) => (
                <MenuItem key={anio} value={anio} onClick={() => handleToggleSelection(setSelectedYears, selectedYears, availableYears, anio)}>
                  <Checkbox checked={selectedYears.includes(anio)} size="small" />
                  <ListItemText primary={String(anio)} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Programas */}
          <FormControl size="small" fullWidth>
            <InputLabel>Programa</InputLabel>
            <Select
              multiple
              value={selectedPrograms}
              label="Programa"
              renderValue={(selected) => selected.length ? `${selected.length} programa(s)` : 'Sin selección'}
              sx={{ borderRadius: '10px', bgcolor: '#f8fafc', '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' } }}
            >
              <MenuItem onClick={() => handleToggleSelection(setSelectedPrograms, selectedPrograms, availablePrograms, '__all__')}>
                <Checkbox checked={availablePrograms.length > 0 && selectedPrograms.length === availablePrograms.length} size="small" />
                <ListItemText primary="Seleccionar todos" primaryTypographyProps={{ fontWeight: 700, fontSize: 13 }} />
              </MenuItem>
              {availablePrograms.map((programa) => (
                <MenuItem key={programa} value={programa} onClick={() => handleToggleSelection(setSelectedPrograms, selectedPrograms, availablePrograms, programa)}>
                  <Checkbox checked={selectedPrograms.includes(programa)} size="small" />
                  <ListItemText primary={programa} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Tipo de competencia */}
          <Stack
            direction="row"
            spacing={0.8}
            sx={{
              bgcolor: '#f1f5f9',
              borderRadius: '10px',
              p: 0.6,
              '& .MuiButton-root': {
                borderRadius: '8px',
                fontWeight: 700,
                fontSize: 12.5,
                textTransform: 'none',
                minHeight: 34,
                px: 1.8,
                border: 'none'
              }
            }}
          >
            {[
              { key: 'genericas',   label: 'Genéricas' },
              { key: 'especificas', label: 'Específicas' },
              { key: 'todas',       label: 'Todas' }
            ].map(({ key, label }) => (
              <Button
                key={key}
                size="small"
                variant={competenciaScope === key ? 'contained' : 'text'}
                onClick={() => setCompetenciaScope(key)}
                sx={competenciaScope === key
                  ? { bgcolor: INST_BLUE, color: '#fff', boxShadow: '0 2px 8px rgba(30,58,138,0.22)', '&:hover': { bgcolor: '#1e40af' } }
                  : { color: '#475569', '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a' } }
                }
              >
                {label}
              </Button>
            ))}
          </Stack>
        </Box>

        {/* Chips resumen */}
        <Stack direction="row" spacing={1} sx={{ mt: 2 }} flexWrap="wrap" useFlexGap alignItems="center">
          <Chip
            size="small"
            label={`${formatNumber(summaryCards.totalRegs)} registros`}
            sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
          />
          <Chip
            size="small"
            label={`${summaryCards.programas} programas visibles`}
            sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600 }}
          />
          <Chip
            size="small"
            color="primary"
            variant="outlined"
            label={`Promedio general: ${summaryCards.promedioGeneral ? Number(summaryCards.promedioGeneral).toFixed(1) : 'N/A'}`}
            sx={{ fontWeight: 700 }}
          />
          {selectedCompetencia && (
            <Chip
              size="small"
              color="secondary"
              variant="outlined"
              label={`Fila activa: ${selectedCompetencia}`}
              onDelete={() => setSelectedCompetencia('')}
              sx={{ fontWeight: 700 }}
            />
          )}
        </Stack>
      </Paper>

      {/* ══════════════════════════════════════════════
          ESTADOS: cargando / sin datos
      ══════════════════════════════════════════════ */}
      {loading ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <Typography sx={{ color: '#64748b', fontWeight: 600 }}>Cargando resultados agregados...</Typography>
        </Paper>
      ) : filteredRows.length === 0 ? (
        <Paper elevation={0} sx={{ p: 5, borderRadius: '14px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
          <Typography sx={{ color: '#334155', fontWeight: 700 }}>
            No hay datos para la combinación de filtros seleccionada.
          </Typography>
        </Paper>
      ) : (
        <>

          {/* ══════════════════════════════════════════
              SECCIÓN 1 — Tabla interactiva + Gráficas
          ══════════════════════════════════════════ */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
              border: '1px solid #e2e8f0'
            }}
          >
            {/* Header institucional */}
            <Box sx={sectionHeaderSx}>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: 16 }}>
                Tabla interactiva por competencia
              </Typography>
              <Typography variant="caption" sx={{ color: '#bfdbfe' }}>
                Clic en fila para filtrar las gráficas. Sin selección muestra la fila PROMEDIO.
              </Typography>
            </Box>

            {/* Tabla */}
            <TableContainer sx={{ maxHeight: 460 }}>
              <Table stickyHeader size="small" sx={{ tableLayout: 'auto' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ ...tableHeadCellSx, minWidth: 220 }}>Competencia</TableCell>
                    {matrixYears.map((anio) => (
                      <TableCell key={anio} align="right" sx={tableHeadCellSx}>{anio}</TableCell>
                    ))}
                    <TableCell align="right" sx={tableHeadCellAccentSx}>Prom.</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...matrixRows.rows, matrixRows.promedioRow].map((row, rowIdx) => {
                    const isProm = row.competencia === 'PROMEDIO';
                    const selected = selectedCompetencia === row.competencia;
                    return (
                      <TableRow
                        key={row.competencia}
                        hover
                        onClick={() => !isProm && setSelectedCompetencia((prev) => (prev === row.competencia ? '' : row.competencia))}
                        sx={{
                          cursor: isProm ? 'default' : 'pointer',
                          bgcolor: isProm
                            ? INST_BLUE_LIGHT
                            : selected
                              ? '#f5f3ff'
                              : rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                          transition: 'background-color 0.12s',
                          '&:hover td': {
                            bgcolor: isProm ? INST_BLUE_PALE : selected ? '#ede9fe' : '#f0f9ff'
                          },
                          '& td': {
                            fontWeight: isProm ? 800 : 500,
                            borderBottom: '1px solid #f1f5f9',
                            fontSize: 13,
                            py: 1.1
                          }
                        }}
                      >
                        <TableCell
                          sx={{
                            color: isProm ? INST_BLUE : selected ? '#6d28d9' : '#1f2937',
                            fontWeight: isProm ? 900 : selected ? 700 : 500
                          }}
                        >
                          {row.competencia}
                        </TableCell>
                        {matrixYears.map((anio) => (
                          <TableCell
                            key={`${row.competencia}-${anio}`}
                            align="right"
                            sx={{ color: row.byYear?.[anio] == null ? '#cbd5e1' : '#334155' }}
                          >
                            {row.byYear?.[anio] == null ? '–' : Number(row.byYear[anio]).toFixed(2)}
                          </TableCell>
                        ))}
                        <TableCell
                          align="right"
                          sx={{ fontWeight: 800, color: isProm ? INST_BLUE : '#111827' }}
                        >
                          {row.promedio == null ? '–' : Number(row.promedio).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {/* Gráficas lado a lado */}
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
                borderTop: '1px solid #e2e8f0'
              }}
            >
              {/* Evolución del resultado */}
              <Box
                sx={{
                  p: 2.5,
                  borderRight: { xs: 'none', lg: '1px solid #e2e8f0' },
                  borderBottom: { xs: '1px solid #e2e8f0', lg: 'none' }
                }}
              >
                <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.3, fontSize: 14 }}>
                  Evolución del resultado{selectedCompetencia ? ` — ${selectedCompetencia}` : ' (fila PROMEDIO)'}
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                  Comportamiento anual con eje Y ajustado para resaltar la fluctuación.
                </Typography>
                <Box sx={{ height: 280 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={generalTrendData} margin={{ top: 30, right: 40, left: 12, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="anio" interval={0} padding={{ left: 18, right: 22 }} tick={false} axisLine={false} tickLine={false} />
                      <YAxis domain={[trendYMin, trendYMax]} width={48} tick={{ fontSize: 11, fill: '#94a3b8' }} />
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
              </Box>

              {/* Resultado por competencia */}
              <Box sx={{ p: 2.5 }}>
                <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 0.3, fontSize: 14 }}>
                  Resultado por competencia (promedio del programa)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', display: 'block', mb: 1.5 }}>
                  Ranking de competencias. Clic en barra para activar la vista en la tabla.
                </Typography>
                <Box sx={{ height: 280 }}>
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
                      <YAxis type="category" dataKey="competencia" width={190} tick={{ fontSize: 11, fill: '#475569' }} />
                      <RechartsTooltip formatter={(v) => Number(v).toFixed(2)} />
                      <Bar dataKey="promedio" radius={[0, 8, 8, 0]}>
                        {competenciaBarData.map((item, idx) => (
                          <Cell
                            key={item.competencia}
                            fill={item.competencia === selectedCompetencia
                              ? '#7c3aed'
                              : [INST_BLUE_MED, '#0ea5e9', '#f59e0b', '#ef4444', '#10b981'][idx % 5]
                            }
                          />
                        ))}
                        <LabelList
                          dataKey="promedio"
                          position="right"
                          formatter={(v) => Number(v).toFixed(1)}
                          style={{ fontSize: 13, fontWeight: 800, fill: '#334155' }}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Box>
            </Box>
          </Paper>

          {/* ══════════════════════════════════════════
              SECCIÓN 2 — Puntaje General (KPI)
          ══════════════════════════════════════════ */}
          <Paper
            elevation={0}
            sx={{
              p: { xs: 3, md: 4 },
              borderRadius: '14px',
              boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
              border: `1.5px solid ${INST_BLUE_PALE}`,
              background: `linear-gradient(135deg, #ffffff 0%, ${INST_BLUE_LIGHT} 100%)`,
              textAlign: 'center'
            }}
          >
            <Typography
              sx={{
                fontSize: 11,
                fontWeight: 800,
                color: INST_BLUE,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                mb: 1.5
              }}
            >
              Puntaje General
            </Typography>
            <Typography
              sx={{
                fontSize: { xs: 56, md: 80 },
                fontWeight: 900,
                color: INST_BLUE,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                mb: 1
              }}
            >
              {summaryCards.promedioGeneral ? Number(summaryCards.promedioGeneral).toFixed(1) : '—'}
            </Typography>
            <Typography sx={{ fontSize: 15, color: '#475569', fontWeight: 500, mb: 2.5 }}>
              Promedio general del programa
            </Typography>
            <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" useFlexGap>
              <Chip
                label={`${summaryCards.competenciasVisibles} competencias`}
                sx={{ bgcolor: INST_BLUE_PALE, color: INST_BLUE, fontWeight: 700, fontSize: 12.5 }}
              />
              <Chip
                label={`${summaryCards.aniosVisibles} años analizados`}
                sx={{ bgcolor: INST_BLUE_PALE, color: INST_BLUE, fontWeight: 700, fontSize: 12.5 }}
              />
              <Chip
                label={`${summaryCards.programas} programas`}
                sx={{ bgcolor: INST_BLUE_PALE, color: INST_BLUE, fontWeight: 700, fontSize: 12.5 }}
              />
              <Chip
                label={`Puntaje máx. competencia: ${Number(summaryCards.maxPuntaje).toFixed(1)}`}
                sx={{ bgcolor: INST_BLUE_PALE, color: INST_BLUE, fontWeight: 700, fontSize: 12.5 }}
              />
            </Stack>
          </Paper>

          {/* ══════════════════════════════════════════
              SECCIÓN 3 — PUNTAJE GENERAL (PROMEDIO)
              Gráfica fija del promedio general —
              siempre muestra el total, no cambia con clicks
          ══════════════════════════════════════════ */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
              border: '1px solid #e2e8f0'
            }}
          >
            <Box sx={sectionHeaderSx}>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: 16 }}>
                PUNTAJE GENERAL (PROMEDIO)
              </Typography>
              <Typography variant="caption" sx={{ color: '#bfdbfe' }}>
                Comparativo de líneas entre Programa y Grupo de Referencia
              </Typography>
            </Box>
            <Box sx={{ px: 3, pt: 2.5, pb: 3 }}>
              <Box sx={{ height: 340 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={comparativeTotalSeries} margin={{ top: 30, right: 44, left: 14, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="anio" interval={0} padding={{ left: 18, right: 22 }} tick={{ fontSize: 12, fill: '#64748b' }} />
                    <YAxis domain={[comparativeTotalYBounds.min, comparativeTotalYBounds.max]} width={48} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                    <RechartsTooltip formatter={(v) => (v == null ? '-' : Number(v).toFixed(2))} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Line
                      type="monotone"
                      dataKey="grupo"
                      name="Grupo de referencia"
                      connectNulls
                      stroke="#94a3b8"
                      strokeWidth={2.5}
                      dot={{ r: 4, fill: '#fff', stroke: '#94a3b8', strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList dataKey="grupo" content={renderAggregateLineLabelFactory({ color: '#64748b', evenDy: -16, oddDy: -28 })} />
                    </Line>
                    <Line
                      type="monotone"
                      dataKey="programa"
                      name="Programa académico"
                      connectNulls
                      stroke={INST_BLUE}
                      strokeWidth={3}
                      dot={{ r: 4, fill: '#fff', stroke: INST_BLUE, strokeWidth: 2 }}
                      activeDot={{ r: 6 }}
                    >
                      <LabelList dataKey="programa" content={renderAggregateLineLabelFactory({ color: INST_BLUE, evenDy: 20, oddDy: 32 })} />
                    </Line>
                  </LineChart>
                </ResponsiveContainer>
              </Box>
            </Box>
          </Paper>

          {/* ══════════════════════════════════════════
              SECCIÓN 4 — Comparativo: tablas simétricas
          ══════════════════════════════════════════ */}
          <Paper
            elevation={0}
            sx={{
              borderRadius: '14px',
              overflow: 'hidden',
              boxShadow: '0 4px 24px rgba(15,23,42,0.08)',
              border: '1px solid #e2e8f0'
            }}
          >
            <Box sx={sectionHeaderSx}>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: 16 }}>
                Comparativo
              </Typography>
              <Typography variant="caption" sx={{ color: '#bfdbfe' }}>
                Comparativo de líneas entre Programa y Grupo de Referencia
              </Typography>
            </Box>

            <Box sx={{ p: { xs: 2, md: 3 } }}>
              {/* Dos tablas de igual altura — grid con alignItems stretch */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' },
                  gap: 2.5,
                  alignItems: 'stretch'
                }}
              >
                {/* Tabla principal comparativa */}
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Box sx={{ px: 2, py: 1.4, bgcolor: INST_BLUE_LIGHT, borderBottom: `1px solid ${INST_BLUE_PALE}`, flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800, color: INST_BLUE, fontSize: 13 }}>
                      Resumen por competencia
                    </Typography>
                  </Box>
                  <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={tableHeadCellSx}>Competencia</TableCell>
                          <TableCell align="right" sx={tableHeadCellSx}>Programa</TableCell>
                          <TableCell align="right" sx={tableHeadCellSx}>Grupo ref.</TableCell>
                          <TableCell align="right" sx={tableHeadCellAccentSx}>Brecha</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {[comparativeData.totalRow, ...comparativeData.rows].map((row, rowIdx) => {
                          const isTotal = row.competencia === 'PUNTAJE GENERAL (PROMEDIO)';
                          const selected = selectedComparativoCompetencia === row.competencia;
                          return (
                            <TableRow
                              key={`cmp-${row.competencia}`}
                              hover
                              onClick={() => setSelectedComparativoCompetencia((prev) => (prev === row.competencia || isTotal ? '' : row.competencia))}
                              sx={{
                                cursor: 'pointer',
                                bgcolor: isTotal
                                  ? INST_BLUE_LIGHT
                                  : selected
                                    ? '#f5f3ff'
                                    : rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                transition: 'background-color 0.12s',
                                '&:hover td': { bgcolor: isTotal ? INST_BLUE_PALE : selected ? '#ede9fe' : '#f0f9ff' },
                                '& td': { fontWeight: isTotal ? 800 : 500, borderBottom: '1px solid #f1f5f9', fontSize: 12.5, py: 1.1 }
                              }}
                            >
                              <TableCell sx={{ color: isTotal ? INST_BLUE : selected ? '#6d28d9' : '#1f2937' }}>
                                {row.competencia}
                              </TableCell>
                              <TableCell align="right" sx={{ color: '#334155' }}>
                                {row.promPrograma == null ? '–' : Number(row.promPrograma).toFixed(2)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: '#334155' }}>
                                {row.promGrupo == null ? '–' : Number(row.promGrupo).toFixed(2)}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 800,
                                  color: row.brecha == null ? '#94a3b8' : row.brecha >= 0 ? '#166534' : '#b91c1c'
                                }}
                              >
                                {row.brecha == null ? '–' : `${row.brecha >= 0 ? '+' : ''}${Number(row.brecha).toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>

                {/* Tabla soporte por año */}
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: '10px',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    display: 'flex',
                    flexDirection: 'column'
                  }}
                >
                  <Box sx={{ px: 2, py: 1.4, bgcolor: INST_BLUE_LIGHT, borderBottom: `1px solid ${INST_BLUE_PALE}`, flexShrink: 0 }}>
                    <Typography sx={{ fontWeight: 800, color: INST_BLUE, fontSize: 13 }}>
                      Soporte de datos por año
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#475569' }}>
                      Valores para:{' '}
                      <strong>{selectedComparativoCompetencia || 'PUNTAJE GENERAL (PROMEDIO)'}</strong>
                    </Typography>
                  </Box>
                  <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={tableHeadCellSx}>Año</TableCell>
                          <TableCell align="right" sx={tableHeadCellSx}>Programa</TableCell>
                          <TableCell align="right" sx={tableHeadCellSx}>Grupo ref.</TableCell>
                          <TableCell align="right" sx={tableHeadCellAccentSx}>Brecha</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(comparativeActiveMeta?.series || []).map((row, rowIdx) => {
                          const brecha = Number.isFinite(row.programa) && Number.isFinite(row.grupo)
                            ? row.programa - row.grupo
                            : null;
                          return (
                            <TableRow
                              key={`cmp-year-${row.anio}`}
                              hover
                              sx={{
                                bgcolor: rowIdx % 2 === 0 ? '#ffffff' : '#f8fafc',
                                '& td': { borderBottom: '1px solid #f1f5f9', fontSize: 12.5, py: 1.1 }
                              }}
                            >
                              <TableCell sx={{ fontWeight: 700, color: INST_BLUE }}>{row.anio}</TableCell>
                              <TableCell align="right" sx={{ color: '#334155' }}>
                                {row.programa == null ? '–' : Number(row.programa).toFixed(2)}
                              </TableCell>
                              <TableCell align="right" sx={{ color: '#334155' }}>
                                {row.grupo == null ? '–' : Number(row.grupo).toFixed(2)}
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 800,
                                  color: brecha == null ? '#94a3b8' : brecha >= 0 ? '#166534' : '#b91c1c'
                                }}
                              >
                                {brecha == null ? '–' : `${brecha >= 0 ? '+' : ''}${Number(brecha).toFixed(2)}`}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              </Box>
            </Box>
          </Paper>

        </>
      )}
    </Stack>
  );
}

export default SaberProAgregadosDashboard;
