import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Stack,
  Typography,
  Chip,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  CircularProgress,
  Tooltip,
  Skeleton,
  Divider,
  Button
} from '@mui/material';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import CompareArrowsRoundedIcon from '@mui/icons-material/CompareArrowsRounded';
import InfoRoundedIcon from '@mui/icons-material/InfoRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import FilterListRoundedIcon from '@mui/icons-material/FilterListRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TableChartRoundedIcon from '@mui/icons-material/TableChartRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import ImageRoundedIcon from '@mui/icons-material/ImageRounded';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  LabelList
} from 'recharts';
import { useSnackbar } from 'notistack';
import html2canvas from 'html2canvas';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

const GROUP_THEMES = {
  genericas: {
    label: 'Competencias Genéricas',
    desc: 'Núcleo común evaluado por el ICFES: razonamiento cuantitativo, lectura crítica, inglés, comunicación escrita y ciudadanas.',
    primary: '#1d4ed8',
    primarySoft: '#dbeafe',
    primaryDark: '#172554',
    accent: '#0f172a',
    icon: TrendingUpRoundedIcon
  },
  especificas: {
    label: 'Competencias Específicas',
    desc: 'Competencias propias del programa académico que complementan el núcleo común.',
    primary: '#1e40af',
    primarySoft: '#dbeafe',
    primaryDark: '#172554',
    accent: '#2563eb',
    icon: AutoGraphRoundedIcon
  }
};

const REFERENCE_DARK = '#475569';
const INSTITUCIONAL_COLOR = '#2563eb';
const INSTITUCIONAL_TABLE_BLUE = '#1f5bd8';
const INSTITUCIONAL_HEADER_BLUE = '#1e40af';

const fmt = (v, digits = 1) => (v == null || !Number.isFinite(Number(v))
  ? '—'
  : Number(v).toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

function FancyTooltip({ active, payload, label, theme }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <Paper elevation={8} sx={{
      p: 1.4, minWidth: 190, borderRadius: 2,
      border: `1px solid ${theme.primary}33`,
      boxShadow: '0 10px 30px rgba(15,23,42,0.14)'
    }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Año {label}
      </Typography>
      <Divider sx={{ my: 0.7 }} />
      {payload.map((p) => (
        <Stack direction="row" key={p.dataKey} alignItems="center" justifyContent="space-between" spacing={1.2} sx={{ py: 0.25 }}>
          <Stack direction="row" alignItems="center" spacing={0.7}>
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: p.color }} />
            <Typography sx={{ fontSize: 12, color: '#334155', fontWeight: 600 }}>{p.name}</Typography>
          </Stack>
          <Typography sx={{ fontSize: 13, color: '#0f172a', fontWeight: 800 }}>{fmt(p.value, 1)}</Typography>
        </Stack>
      ))}
    </Paper>
  );
}

const RenderLineLabelAbove = (props) => {
  const { x, y, value, index, chartData } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;

  // Default offset is above (-12)
  let offset = -12;

  if (index != null && Array.isArray(chartData) && chartData[index]) {
    const item = chartData[index];
    const valPrincipal = Number(item.principal);
    const valGrupoRef = Number(item.grupoRef);

    if (Number.isFinite(valPrincipal) && Number.isFinite(valGrupoRef)) {
      const diff = valPrincipal - valGrupoRef;
      if (Math.abs(diff) < 3.5) {
        // If close, higher goes above (-12), lower goes below (+20)
        // If equal (diff === 0), grupoRef goes below (+20)
        if (diff > 0) {
          offset = 20; // lower goes below
        } else {
          offset = -12; // higher or equal goes above
        }
      }
    }
  }

  return (
    <text
      x={x}
      y={y + offset}
      textAnchor="middle"
      fontSize="11.5"
      fontWeight="800"
      fill="#475569"
      style={{ pointerEvents: 'none' }}
    >
      {fmt(value, 1)}
    </text>
  );
};

const RenderLineLabelBelow = (props) => {
  const { x, y, value, index, chartData } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;

  // Default offset is below (+20)
  let offset = 20;

  if (index != null && Array.isArray(chartData) && chartData[index]) {
    const item = chartData[index];
    const valPrincipal = Number(item.principal);
    const valGrupoRef = Number(item.grupoRef);

    if (Number.isFinite(valPrincipal) && Number.isFinite(valGrupoRef)) {
      const diff = valPrincipal - valGrupoRef;
      if (Math.abs(diff) < 3.5) {
        // If close, higher goes above (-12), lower goes below (+20)
        // If equal (diff === 0), principal goes above (-12)
        if (diff >= 0) {
          offset = -12; // higher or equal goes above
        } else {
          offset = 20; // lower goes below
        }
      }
    }
  }

  return (
    <text
      x={x}
      y={y + offset}
      textAnchor="middle"
      fontSize="11.5"
      fontWeight="800"
      fill="#1d4ed8"
      style={{ pointerEvents: 'none' }}
    >
      {fmt(value, 1)}
    </text>
  );
};



async function copyChartSvgAsImage(containerId) {
  const container = document.getElementById(containerId);
  if (!container) throw new Error('chart-not-found');

  const canvas = await html2canvas(container, {
    backgroundColor: '#ffffff',
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    ignoreElements: (element) => element?.dataset?.copyIgnore === 'true',
    onclone: (doc) => {
      const cloned = doc.getElementById(containerId);
      if (!cloned) return;
      cloned.style.fontFamily = 'Arial, Helvetica, sans-serif';
      cloned.querySelectorAll('*').forEach((node) => {
        node.style.fontFamily = 'Arial, Helvetica, sans-serif';
      });
    }
  });

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('blob-failed');

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return;
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(pngBlob);
  a.download = 'grafico_rendimiento_competencias.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

async function copyTableAsImage(tableId) {
  const container = document.getElementById(tableId);
  if (!container) throw new Error('table-not-found');

  const canvas = await html2canvas(container, {
    backgroundColor: '#ffffff',
    scale: Math.min(window.devicePixelRatio || 1, 2),
    useCORS: true,
    onclone: (doc) => {
      const cloned = doc.getElementById(tableId);
      if (!cloned) return;
      cloned.style.fontFamily = 'Arial, Helvetica, sans-serif';
      cloned.style.backgroundColor = '#ffffff';
      cloned.style.width = 'max-content';
      cloned.style.overflow = 'hidden';

      // Force cell-specific rounded corners inside html2canvas to workaround container clipping bugs
      const table = cloned.querySelector('table');
      if (table) {
        table.style.borderCollapse = 'separate';
        table.style.borderSpacing = '0';
        
        // Top row (thead th)
        const theadRow = table.querySelector('thead tr');
        if (theadRow) {
          const cells = theadRow.querySelectorAll('th, td');
          if (cells.length > 0) {
            cells[0].style.borderTopLeftRadius = '8px';
            cells[cells.length - 1].style.borderTopRightRadius = '8px';
          }
        }
        
        // Bottom row (tbody tr:last-child)
        const tbodyRows = table.querySelectorAll('tbody tr');
        if (tbodyRows.length > 0) {
          const lastRow = tbodyRows[tbodyRows.length - 1];
          const cells = lastRow.querySelectorAll('td, th');
          if (cells.length > 0) {
            cells[0].style.borderBottomLeftRadius = '8px';
            cells[cells.length - 1].style.borderBottomRightRadius = '8px';
          }
        }
      }

      cloned.querySelectorAll('*').forEach((node) => {
        node.style.fontFamily = 'Arial, Helvetica, sans-serif';
      });
    }
  });

  const pngBlob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!pngBlob) throw new Error('blob-failed');

  if (navigator.clipboard?.write && window.ClipboardItem) {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': pngBlob })]);
    return 'clipboard';
  }

  const a = document.createElement('a');
  a.href = URL.createObjectURL(pngBlob);
  a.download = 'tabla_matriz_competencias.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return 'download';
}

function RendimientoCompetenciasPanel({ grupo = 'genericas' }) {
  const theme = GROUP_THEMES[grupo] || GROUP_THEMES.genericas;
  const HeaderIcon = theme.icon;
  const { enqueueSnackbar } = useSnackbar();

  const [programa, setPrograma] = useState('');
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedCompetencia, setSelectedCompetencia] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await saberProAnalyticsService.getAgregadosCompetencias({
        grupo,
        programas: programa ? [programa] : [],
        anios: []
      });
      const payload = response?.data || {};
      setData(payload);
      const years = Array.isArray(payload.aniosPresentes) ? payload.aniosPresentes : [];
      setSelectedYears((prev) => {
        if (!prev || prev.length === 0) return years;
        const filtered = prev.filter((y) => years.includes(y));
        return filtered.length ? filtered : years;
      });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'Error al cargar competencias agregadas', { variant: 'error' });
      setData(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enqueueSnackbar, grupo, programa]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    setSelectedCompetencia('');
  }, [grupo, programa]);

  const programasCatalogo = data?.programas || [];
  const aniosDisponibles = useMemo(() => (Array.isArray(data?.aniosPresentes) ? data.aniosPresentes : []), [data]);
  const matriz = useMemo(() => (Array.isArray(data?.matriz) ? data.matriz : []), [data]);
  const promedioRow = useMemo(() => (data?.promedio || { byYear: {} }), [data]);

  const matrizOrdenada = useMemo(() => {
    if (!matriz.length) return [];
    return [...matriz].sort((a, b) => (b.promedio || 0) - (a.promedio || 0));
  }, [matriz]);

  const aniosVisibles = useMemo(
    () => (selectedYears.length ? [...selectedYears].sort((a, b) => a - b) : aniosDisponibles),
    [selectedYears, aniosDisponibles]
  );

  const activeRow = useMemo(() => {
    if (!selectedCompetencia) return null;
    return matrizOrdenada.find((r) => r.competencia === selectedCompetencia) || null;
  }, [selectedCompetencia, matrizOrdenada]);

  const chartData = useMemo(() => {
    const raw = aniosVisibles.map((anio) => {
      let principal = null;
      let grupoRef = null;
      if (activeRow) {
        principal = activeRow.byYear?.[anio]?.programa ?? activeRow.byYear?.[anio]?.institucion ?? null;
        grupoRef = activeRow.byYear?.[anio]?.grupo ?? null;
      } else {
        principal = promedioRow.byYear?.[anio]?.programa ?? null;
        grupoRef = promedioRow.byYear?.[anio]?.grupo ?? null;
      }
      return { anio, principal, grupoRef };
    });
    // Filter out years that have no data at all for both lines
    return raw.filter((d) => 
      (d.principal != null && Number.isFinite(Number(d.principal))) || 
      (d.grupoRef != null && Number.isFinite(Number(d.grupoRef)))
    );
  }, [aniosVisibles, activeRow, promedioRow]);

  const chartYDomain = useMemo(() => {
    const vals = chartData
      .flatMap((r) => [r.principal, r.grupoRef])
      .filter((v) => Number.isFinite(Number(v)));
    if (!vals.length) return [0, 300];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 4);
    const pad = Math.max(span * 0.08, 1.5);
    return [Math.max(0, Math.floor((min - pad) / 2) * 2), Math.min(300, Math.ceil((max + pad) / 2) * 2)];
  }, [chartData]);

  const scopeLabel = programa ? programa : 'Institucional';
  const scopeIcon = programa ? <SchoolRoundedIcon sx={{ fontSize: 14 }} /> : <GroupsRoundedIcon sx={{ fontSize: 14 }} />;

  const principalName = programa ? `Programa: ${programa}` : 'Institucional';
  const chartTitle = activeRow ? activeRow.competencia : 'COMPORTAMIENTO GENERAL (PROMEDIO)';

  const brecha = useMemo(() => {
    const pairs = chartData.filter((d) => Number.isFinite(Number(d.principal)) && Number.isFinite(Number(d.grupoRef)));
    if (!pairs.length) return null;
    const diffs = pairs.map((p) => Number(p.principal) - Number(p.grupoRef));
    return {
      promedio: diffs.reduce((a, b) => a + b, 0) / diffs.length,
      ultimo: diffs[diffs.length - 1]
    };
  }, [chartData]);

  const toggleYear = (year) => {
    setSelectedYears((prev) => {
      if (prev.includes(year)) {
        if (prev.length === 1) return prev;
        return prev.filter((y) => y !== year);
      }
      return [...prev, year];
    });
  };

  const handleCopyTable = useCallback(async () => {
    try {
      const result = await copyTableAsImage('saberpro-matriz-table');
      enqueueSnackbar(result === 'clipboard' ? 'Tabla copiada al portapapeles como imagen' : 'Tabla descargada como imagen', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('No se pudo copiar la tabla', { variant: 'warning' });
    }
  }, [enqueueSnackbar]);

  const handleCopyChart = useCallback(async () => {
    try {
      await copyChartSvgAsImage('rendimiento-competencias-chart');
      enqueueSnackbar('Gráfico copiado como imagen limpia', { variant: 'success' });
    } catch (_error) {
      enqueueSnackbar('No se pudo copiar el gráfico', { variant: 'warning' });
    }
  }, [enqueueSnackbar]);

  const chartEmpty = !chartData.some((d) => Number.isFinite(Number(d.principal)) || Number.isFinite(Number(d.grupoRef)));
  const matrizEmpty = !matrizOrdenada.length;

  const RenderAbove = useMemo(() => {
    return (props) => <RenderLineLabelAbove {...props} chartData={chartData} />;
  }, [chartData]);

  const RenderBelow = useMemo(() => {
    return (props) => <RenderLineLabelBelow {...props} chartData={chartData} />;
  }, [chartData]);

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: '#f8fafc', minHeight: 'calc(100vh - 120px)' }}>
      {/* ═══════════ HEADER ═══════════ */}
      <Paper elevation={0} sx={{
        p: { xs: 2, md: 2.8 },
        borderRadius: 3,
        mb: 2,
        background: `linear-gradient(135deg, ${theme.primary}12 0%, ${theme.accent}0a 50%, transparent 100%)`,
        border: `1px solid ${theme.primary}26`,
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{
          position: 'absolute', top: -30, right: -30, width: 170, height: 170,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${theme.primary}1a 0%, transparent 70%)`
        }} />
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" spacing={2}>
          <Stack direction="row" spacing={1.8} alignItems="center">
            <Box sx={{
              width: 52, height: 52, borderRadius: 2.2,
              background: `linear-gradient(135deg, ${INSTITUCIONAL_HEADER_BLUE} 0%, ${INSTITUCIONAL_COLOR} 100%)`,
              display: 'grid', placeItems: 'center',
              boxShadow: '0 10px 24px rgba(15,23,42,0.18)'
            }}>
              <HeaderIcon sx={{ color: '#fff', fontSize: 28 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 20, color: '#0f172a', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                {theme.label}
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#475569', fontWeight: 500, mt: 0.3, maxWidth: 620 }}>
                {theme.desc}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={scopeIcon}
              label={scopeLabel}
              sx={{
                bgcolor: '#ffffff',
                border: `1.5px solid ${theme.primary}40`,
                color: theme.primaryDark,
                fontWeight: 700,
                fontSize: 12,
                height: 30
              }}
            />
            <Chip
              label={`${matrizOrdenada.length} competencias`}
              sx={{
                bgcolor: INSTITUCIONAL_TABLE_BLUE,
                color: '#fff',
                fontWeight: 800,
                fontSize: 11.5,
                height: 30,
                letterSpacing: '0.04em'
              }}
            />
          </Stack>
        </Stack>
      </Paper>

      {/* ═══════════ FILTROS PRIMARIOS (Tipo prueba + Programa) ═══════════ */}
      <Paper elevation={0} sx={{
        p: 1.8,
        borderRadius: 2.5,
        mb: 2,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff'
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <FilterListRoundedIcon sx={{ color: theme.primary, fontSize: 18 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#0f172a', letterSpacing: '-0.01em' }}>
              Filtros
            </Typography>
          </Stack>

          <FormControl size="small" sx={{ minWidth: 280, flex: 1, maxWidth: 520 }}>
            <InputLabel>Programa académico</InputLabel>
            <Select
              label="Programa académico"
              value={programa}
              onChange={(e) => setPrograma(e.target.value)}
              sx={{ fontSize: 13, fontWeight: 600, bgcolor: '#f8fafc' }}
            >
              <MenuItem value=""><em>Todos (Institucional)</em></MenuItem>
              {programasCatalogo.map((p) => (
                <MenuItem key={p} value={p} sx={{ fontSize: 13 }}>{p}</MenuItem>
              ))}
            </Select>
          </FormControl>

          <Tooltip title="Haga clic en una fila de la tabla para ver su línea de tendencia. Sin selección se muestra el promedio del alcance actual." arrow>
            <Stack direction="row" alignItems="center" spacing={0.6} sx={{ cursor: 'help' }}>
              <InfoRoundedIcon sx={{ color: '#94a3b8', fontSize: 18 }} />
              <Typography sx={{ fontSize: 11.5, color: '#64748b', fontWeight: 600 }}>Ayuda</Typography>
            </Stack>
          </Tooltip>
        </Stack>
      </Paper>

      {/* ═══════════ TABLA DE COMPETENCIAS ═══════════ */}
      <Paper elevation={0} sx={{
        p: { xs: 1.5, md: 2.2 },
        borderRadius: 2.5,
        mb: 2,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff'
      }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.6 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 32, height: 32, borderRadius: 1.8,
              bgcolor: theme.primarySoft,
              display: 'grid', placeItems: 'center'
            }}>
              <TableChartRoundedIcon sx={{ color: theme.primaryDark, fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
                Matriz Competencia × Año
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
                Clic en una fila para graficar. Clic nuevamente para deseleccionar.
              </Typography>
            </Box>
          </Stack>

          {/* Selector de años local */}
          <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              size="small"
              variant="outlined"
              startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={handleCopyTable}
              disabled={matrizEmpty}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, fontSize: 11, py: 0.35 }}
            >
              Copiar tabla
            </Button>
            <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', mr: 0.5 }}>AÑOS</Typography>
            {aniosDisponibles.map((anio) => {
              const on = selectedYears.includes(anio);
              return (
                <Chip
                  key={anio}
                  label={anio}
                  size="small"
                  clickable
                  onClick={() => toggleYear(anio)}
                  sx={{
                    height: 26,
                    fontSize: 11.5,
                    fontWeight: 700,
                    bgcolor: on ? INSTITUCIONAL_TABLE_BLUE : '#f8fafc',
                    color: on ? '#fff' : '#334155',
                    border: on ? `1px solid ${INSTITUCIONAL_TABLE_BLUE}` : '1px solid #dbe3ef',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: on ? INSTITUCIONAL_HEADER_BLUE : '#eaf1fb',
                      color: on ? '#fff' : '#1e3a8a'
                    }
                  }}
                />
              );
            })}
          </Stack>
        </Stack>

        {loading ? (
          <Stack spacing={0.8}>
            {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} variant="rectangular" height={36} sx={{ borderRadius: 1 }} />)}
          </Stack>
        ) : matrizEmpty ? (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>
              No hay datos para el alcance actual.
            </Typography>
          </Box>
        ) : (
          <Box id="saberpro-matriz-table" sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid #cbd5e1', bgcolor: '#ffffff' }}>
            <Box component="table" sx={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5
            }}>
              <Box component="thead">
                <Box component="tr" sx={{ bgcolor: INSTITUCIONAL_TABLE_BLUE }}>
                  <Box component="th" sx={{ textAlign: 'left', px: 1.6, py: 1.1, color: '#fff', fontWeight: 800, fontSize: 11.5, letterSpacing: '0.06em', textTransform: 'uppercase', minWidth: 260 }}>
                    Competencia
                  </Box>
                  {aniosVisibles.map((anio) => (
                    <Box component="th" key={anio} sx={{ textAlign: 'center', px: 1.2, py: 1.1, color: '#fff', fontWeight: 800, fontSize: 12, minWidth: 68 }}>
                      {anio}
                    </Box>
                  ))}
                  <Box component="th" sx={{ textAlign: 'center', px: 1.2, py: 1.1, color: '#fff', fontWeight: 800, fontSize: 11, letterSpacing: '0.05em', textTransform: 'uppercase', borderLeft: '1px solid #1f2937', minWidth: 90 }}>
                    Promedio
                  </Box>
                </Box>
              </Box>
              <Box component="tbody">
                {matrizOrdenada.map((row) => {
                  const selected = selectedCompetencia === row.competencia;
                  return (
                    <Box
                      component="tr"
                      key={row.competencia}
                      onClick={() => setSelectedCompetencia(selected ? '' : row.competencia)}
                      sx={{
                        cursor: 'pointer',
                        transition: 'background-color 0.12s',
                        bgcolor: selected ? '#eef4ff' : '#fff',
                        '&:hover': { bgcolor: selected ? '#e0ebff' : '#f8fafc' }
                      }}
                    >
                      <Box component="td" sx={{
                        px: 1.6, py: 1,
                        fontWeight: 700,
                        color: selected ? '#172554' : '#0f172a',
                        fontSize: 12.8,
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: selected ? '3px solid #1d4ed8' : '3px solid transparent'
                      }}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          {selected && <CheckCircleRoundedIcon sx={{ fontSize: 15, color: '#1d4ed8' }} />}
                          <span>{row.competencia}</span>
                        </Stack>
                      </Box>
                      {aniosVisibles.map((anio) => {
                        const cell = row.byYear?.[anio] || {};
                        const v = cell.programa;
                        const g = cell.grupo;
                        return (
                          <Tooltip
                            key={anio}
                            arrow
                            placement="top"
                            title={
                              <Box>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{row.competencia} · {anio}</Typography>
                                <Typography sx={{ fontSize: 11 }}>{principalName}: <b>{fmt(v, 1)}</b></Typography>
                                <Typography sx={{ fontSize: 11 }}>Grupo referencia: <b>{fmt(g, 1)}</b></Typography>
                              </Box>
                            }
                          >
                            <Box component="td" sx={{
                              px: 1.2, py: 1,
                              textAlign: 'center',
                              fontWeight: 700,
                              color: '#0f172a',
                              borderBottom: '1px solid #f1f5f9',
                              bgcolor: '#fff'
                            }}>
                              {fmt(v, 1)}
                            </Box>
                          </Tooltip>
                        );
                      })}
                      <Box component="td" sx={{
                        px: 1.2, py: 1,
                        textAlign: 'center',
                        fontWeight: 900,
                        color: '#1e3a8a',
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: '1px solid #e2e8f0',
                        bgcolor: '#f8fafc'
                      }}>
                        {fmt(row.promedio, 1)}
                      </Box>
                    </Box>
                  );
                })}
                {/* Fila PROMEDIO general */}
                {grupo !== 'especificas' && (
                  <Box component="tr" sx={{ bgcolor: '#f1f5f9' }}>
                    <Box component="td" sx={{
                      px: 1.6, py: 1.1,
                      fontWeight: 900,
                      color: '#0f172a',
                      fontSize: 12,
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase',
                      borderTop: `2px solid ${INSTITUCIONAL_TABLE_BLUE}`
                    }}>
                      Promedio
                    </Box>
                    {aniosVisibles.map((anio) => (
                      <Box component="td" key={anio} sx={{
                        px: 1.2, py: 1.1,
                        textAlign: 'center',
                        fontWeight: 900,
                        color: '#0f172a',
                        borderTop: `2px solid ${INSTITUCIONAL_TABLE_BLUE}`
                      }}>
                        {fmt(promedioRow.byYear?.[anio]?.programa, 1)}
                      </Box>
                    ))}
                    <Box component="td" sx={{
                      px: 1.2, py: 1.1,
                      textAlign: 'center',
                      fontWeight: 900,
                      color: '#1e3a8a',
                      borderTop: `2px solid ${INSTITUCIONAL_TABLE_BLUE}`,
                      borderLeft: '1px solid #cbd5e1',
                      bgcolor: '#fff'
                    }}>
                      {fmt(Object.values(promedioRow.byYear || {}).map((c) => c?.programa).filter((v) => Number.isFinite(Number(v))).reduce((acc, v, _, arr) => acc + Number(v) / arr.length, 0) || null, 1)}
                    </Box>
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* ═══════════ GRÁFICO DE LÍNEAS ═══════════ */}
      <Paper
        id="rendimiento-competencias-chart"
        elevation={0}
        sx={{
          p: { xs: 1.5, md: 2.2 },
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          mb: 2
        }}
      >
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={1.5} sx={{ mb: 1.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{
              width: 32, height: 32, borderRadius: 1.8,
              bgcolor: '#eff6ff',
              display: 'grid', placeItems: 'center'
            }}>
              <TimelineRoundedIcon sx={{ color: INSTITUCIONAL_COLOR, fontSize: 18 }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: '#0f172a', letterSpacing: '-0.01em' }}>
                {chartTitle}
              </Typography>
              <Typography data-copy-ignore="true" sx={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
                {activeRow ? 'Competencia seleccionada en la tabla' : `Comportamiento general · ${scopeLabel}`}
              </Typography>
            </Box>
          </Stack>

          <Stack data-copy-ignore="true" direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button
              data-copy-ignore="true"
              size="small"
              variant="outlined"
              startIcon={<ImageRoundedIcon sx={{ fontSize: 15 }} />}
              onClick={handleCopyChart}
              disabled={chartEmpty}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, fontSize: 11, py: 0.35 }}
            >
              Copiar gráfico
            </Button>
            {brecha && (
              <>
              <CompareArrowsRoundedIcon sx={{ fontSize: 16, color: '#64748b' }} />
              <Chip
                label={`Brecha promedio: ${brecha.promedio >= 0 ? '+' : ''}${fmt(brecha.promedio, 1)}`}
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  bgcolor: brecha.promedio >= 0 ? '#dbeafe' : '#fee2e2',
                  color: brecha.promedio >= 0 ? '#1e3a8a' : '#991b1b',
                  border: brecha.promedio >= 0 ? '1px solid #93c5fd' : '1px solid #fecaca'
                }}
              />
              <Chip
                label={`Último año: ${brecha.ultimo >= 0 ? '+' : ''}${fmt(brecha.ultimo, 1)}`}
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  bgcolor: '#f1f5f9',
                  color: '#334155',
                  border: '1px solid #e2e8f0'
                }}
              />
              </>
            )}
          </Stack>
        </Stack>

        {loading ? (
          <Skeleton variant="rectangular" height={340} sx={{ borderRadius: 2 }} />
        ) : chartEmpty ? (
          <Box sx={{ py: 6, textAlign: 'center' }}>
            <Typography sx={{ color: '#94a3b8', fontWeight: 600, fontSize: 13 }}>
              Sin datos para graficar en los años seleccionados.
            </Typography>
          </Box>
        ) : (
          <Box sx={{
            bgcolor: '#ffffff',
            borderRadius: 2,
            border: '1px solid #dbe3ef',
            p: { xs: 1, md: 1.4 }
          }}>
            <Box sx={{ bgcolor: '#fff', fontFamily: 'Arial, Helvetica, sans-serif' }}>
              <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 28, right: 34, left: 6, bottom: 8 }}>
                <CartesianGrid
                  stroke="#cbd5e1"
                  strokeDasharray="4 4"
                  strokeOpacity={0.75}
                  horizontal
                  vertical
                />
                <XAxis
                  dataKey="anio"
                  tick={{ fill: '#475569', fontSize: 12, fontWeight: 700 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  padding={{ left: 20, right: 20 }}
                />
                <YAxis
                  domain={chartYDomain}
                  tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                  axisLine={{ stroke: '#cbd5e1' }}
                  tickLine={false}
                  width={46}
                  label={{ value: 'Puntaje (0 - 300)', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10, fontWeight: 700 }}
                />
                <RechartsTooltip content={<FancyTooltip theme={theme} />} cursor={{ stroke: '#94a3b8', strokeOpacity: 0.22, strokeWidth: 2 }} />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, fontWeight: 700, color: '#334155' }}
                />
                <Line
                  type="linear"
                  dataKey="grupoRef"
                  name="Grupo de Referencia"
                  stroke={REFERENCE_DARK}
                  strokeWidth={3}
                  strokeDasharray="7 4"
                  dot={{ r: 5, fill: '#fff', stroke: REFERENCE_DARK, strokeWidth: 2.5 }}
                  activeDot={{ r: 7, fill: REFERENCE_DARK, stroke: '#fff', strokeWidth: 2.4 }}
                  connectNulls
                >
                  <LabelList dataKey="grupoRef" content={RenderAbove} />
                </Line>
                <Line
                  type="linear"
                  dataKey="principal"
                  name={principalName}
                  stroke="#1d4ed8"
                  strokeWidth={4}
                  dot={{ r: 6, fill: '#fff', stroke: '#1d4ed8', strokeWidth: 3 }}
                  activeDot={{ r: 8, fill: '#1d4ed8', stroke: '#fff', strokeWidth: 2.6 }}
                  connectNulls
                >
                  <LabelList dataKey="principal" content={RenderBelow} />
                </Line>
              </LineChart>
              </ResponsiveContainer>
            </Box>
          </Box>
        )}

        {/* Nota explicativa */}
        <Stack data-copy-ignore="true" direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5, p: 1.2, borderRadius: 1.8, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
          <InfoRoundedIcon sx={{ color: '#64748b', fontSize: 16, mt: 0.1 }} />
          <Typography sx={{ fontSize: 11.5, color: '#475569', lineHeight: 1.5, fontWeight: 500 }}>
            La línea <b style={{ color: theme.primary }}>{principalName}</b> representa el puntaje promedio {programa ? 'del programa seleccionado' : 'institucional'}.
            La línea <b style={{ color: REFERENCE_DARK }}>Grupo de Referencia</b> corresponde al puntaje promedio nacional del grupo comparable reportado por el ICFES.
            Valores positivos en la brecha indican desempeño por encima del grupo de referencia.
          </Typography>
        </Stack>
      </Paper>

      {loading && (
        <Box sx={{ position: 'fixed', top: 120, right: 24, zIndex: 1400 }}>
          <Paper elevation={4} sx={{ p: 1.2, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
            <CircularProgress size={16} sx={{ color: theme.primary }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Cargando…</Typography>
          </Paper>
        </Box>
      )}
    </Box>
  );
}

export default RendimientoCompetenciasPanel;
