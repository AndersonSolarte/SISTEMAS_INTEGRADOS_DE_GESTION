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
  Divider
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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ReferenceLine,
  LabelList
} from 'recharts';
import { useSnackbar } from 'notistack';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

const GROUP_THEMES = {
  genericas: {
    label: 'Competencias Genéricas',
    desc: 'Núcleo común evaluado por el ICFES: razonamiento cuantitativo, lectura crítica, inglés, comunicación escrita y ciudadanas.',
    primary: '#10b981',
    primarySoft: '#d1fae5',
    primaryDark: '#047857',
    accent: '#2563eb',
    icon: TrendingUpRoundedIcon
  },
  especificas: {
    label: 'Competencias Específicas',
    desc: 'Competencias propias del programa académico que complementan el núcleo común.',
    primary: '#7c3aed',
    primarySoft: '#ede9fe',
    primaryDark: '#5b21b6',
    accent: '#2563eb',
    icon: AutoGraphRoundedIcon
  }
};

const REFERENCE_DARK = '#475569';
const INSTITUCIONAL_COLOR = '#2563eb';

const fmt = (v, digits = 1) => (v == null || !Number.isFinite(Number(v))
  ? '—'
  : Number(v).toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits }));

const heatColor = (value, min, max, primary) => {
  if (value == null || !Number.isFinite(Number(value))) return 'transparent';
  if (max === min) return `${primary}22`;
  const t = Math.max(0, Math.min(1, (Number(value) - min) / (max - min)));
  const alpha = Math.round(12 + t * 55);
  return `${primary}${alpha.toString(16).padStart(2, '0')}`;
};

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

const RenderLineLabel = (props) => {
  const { x, y, value, index } = props || {};
  if (x == null || y == null || value == null || !Number.isFinite(Number(value))) return null;
  const dy = index % 2 === 0 ? -12 : -22;
  return (
    <text
      x={x}
      y={y + dy}
      textAnchor="middle"
      fontSize="11.5"
      fontWeight="800"
      fill="#0f172a"
      style={{ pointerEvents: 'none' }}
    >
      {fmt(value, 1)}
    </text>
  );
};

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
    return aniosVisibles.map((anio) => {
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
  }, [aniosVisibles, activeRow, promedioRow]);

  const heatStats = useMemo(() => {
    const vals = [];
    for (const row of matrizOrdenada) {
      for (const anio of aniosVisibles) {
        const v = row.byYear?.[anio]?.programa;
        if (Number.isFinite(Number(v))) vals.push(Number(v));
      }
    }
    if (!vals.length) return { min: 0, max: 0 };
    return { min: Math.min(...vals), max: Math.max(...vals) };
  }, [matrizOrdenada, aniosVisibles]);

  const chartYDomain = useMemo(() => {
    const vals = chartData
      .flatMap((r) => [r.principal, r.grupoRef])
      .filter((v) => Number.isFinite(Number(v)));
    if (!vals.length) return [0, 300];
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const span = Math.max(max - min, 4);
    const pad = Math.max(span * 0.25, 3);
    return [Math.max(0, Math.floor((min - pad) / 5) * 5), Math.min(300, Math.ceil((max + pad) / 5) * 5)];
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

  const chartEmpty = !chartData.some((d) => Number.isFinite(Number(d.principal)) || Number.isFinite(Number(d.grupoRef)));
  const matrizEmpty = !matrizOrdenada.length;

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
              background: `linear-gradient(135deg, ${theme.primary} 0%, ${theme.primaryDark} 100%)`,
              display: 'grid', placeItems: 'center',
              boxShadow: `0 10px 24px ${theme.primary}4d`
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
                bgcolor: theme.primary,
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
          <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" useFlexGap>
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
                    bgcolor: on ? theme.primary : '#f1f5f9',
                    color: on ? '#fff' : '#475569',
                    border: on ? `1px solid ${theme.primary}` : '1px solid #e2e8f0',
                    transition: 'all 0.15s',
                    '&:hover': {
                      bgcolor: on ? theme.primaryDark : `${theme.primary}1a`,
                      color: on ? '#fff' : theme.primaryDark
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
          <Box sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid #e2e8f0' }}>
            <Box component="table" sx={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: 12.5
            }}>
              <Box component="thead">
                <Box component="tr" sx={{ bgcolor: '#0f172a' }}>
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
                        bgcolor: selected ? `${theme.primary}12` : '#fff',
                        '&:hover': { bgcolor: selected ? `${theme.primary}1a` : '#f8fafc' }
                      }}
                    >
                      <Box component="td" sx={{
                        px: 1.6, py: 1,
                        fontWeight: 700,
                        color: selected ? theme.primaryDark : '#0f172a',
                        fontSize: 12.8,
                        borderBottom: '1px solid #f1f5f9',
                        borderLeft: selected ? `3px solid ${theme.primary}` : '3px solid transparent'
                      }}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          {selected && <CheckCircleRoundedIcon sx={{ fontSize: 15, color: theme.primary }} />}
                          <span>{row.competencia}</span>
                        </Stack>
                      </Box>
                      {aniosVisibles.map((anio) => {
                        const cell = row.byYear?.[anio] || {};
                        const v = cell.programa;
                        const g = cell.grupo;
                        const bg = heatColor(v, heatStats.min, heatStats.max, theme.primary);
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
                              bgcolor: bg
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
                        color: theme.primaryDark,
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
                <Box component="tr" sx={{ bgcolor: '#f1f5f9' }}>
                  <Box component="td" sx={{
                    px: 1.6, py: 1.1,
                    fontWeight: 900,
                    color: '#0f172a',
                    fontSize: 12,
                    letterSpacing: '0.05em',
                    textTransform: 'uppercase',
                    borderTop: '2px solid #0f172a'
                  }}>
                    Promedio
                  </Box>
                  {aniosVisibles.map((anio) => (
                    <Box component="td" key={anio} sx={{
                      px: 1.2, py: 1.1,
                      textAlign: 'center',
                      fontWeight: 900,
                      color: '#0f172a',
                      borderTop: '2px solid #0f172a'
                    }}>
                      {fmt(promedioRow.byYear?.[anio]?.programa, 1)}
                    </Box>
                  ))}
                  <Box component="td" sx={{
                    px: 1.2, py: 1.1,
                    textAlign: 'center',
                    fontWeight: 900,
                    color: theme.primaryDark,
                    borderTop: '2px solid #0f172a',
                    borderLeft: '1px solid #cbd5e1',
                    bgcolor: theme.primarySoft
                  }}>
                    {fmt(Object.values(promedioRow.byYear || {}).map((c) => c?.programa).filter((v) => Number.isFinite(Number(v))).reduce((acc, v, _, arr) => acc + Number(v) / arr.length, 0) || null, 1)}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        )}
      </Paper>

      {/* ═══════════ GRÁFICO DE LÍNEAS ═══════════ */}
      <Paper elevation={0} sx={{
        p: { xs: 1.5, md: 2.2 },
        borderRadius: 2.5,
        border: '1px solid #e2e8f0',
        bgcolor: '#ffffff',
        mb: 2
      }}>
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
              <Typography sx={{ fontSize: 11.5, color: '#64748b', fontWeight: 500 }}>
                {activeRow ? 'Competencia seleccionada en la tabla' : `Comportamiento general · ${scopeLabel}`}
              </Typography>
            </Box>
          </Stack>

          {brecha && (
            <Stack direction="row" spacing={0.8} alignItems="center">
              <CompareArrowsRoundedIcon sx={{ fontSize: 16, color: '#64748b' }} />
              <Chip
                label={`Brecha promedio: ${brecha.promedio >= 0 ? '+' : ''}${fmt(brecha.promedio, 1)}`}
                size="small"
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  bgcolor: brecha.promedio >= 0 ? '#dcfce7' : '#fee2e2',
                  color: brecha.promedio >= 0 ? '#166534' : '#991b1b',
                  border: brecha.promedio >= 0 ? '1px solid #86efac' : '1px solid #fecaca'
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
            </Stack>
          )}
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
            border: '1px solid #f1f5f9',
            p: { xs: 1, md: 1.4 }
          }}>
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={chartData} margin={{ top: 28, right: 34, left: 6, bottom: 8 }}>
                <defs>
                  <linearGradient id={`gradPrincipal-${grupo}`} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={INSTITUCIONAL_COLOR} stopOpacity={0.85} />
                    <stop offset="100%" stopColor={theme.primary} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 4" vertical={false} />
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
                <RechartsTooltip content={<FancyTooltip theme={theme} />} cursor={{ stroke: theme.primary, strokeOpacity: 0.18, strokeWidth: 28 }} />
                <Legend
                  verticalAlign="bottom"
                  height={32}
                  iconType="circle"
                  wrapperStyle={{ fontSize: 12, fontWeight: 700, color: '#334155' }}
                />
                <Line
                  type="monotone"
                  dataKey="grupoRef"
                  name="Grupo de Referencia"
                  stroke={REFERENCE_DARK}
                  strokeWidth={2.4}
                  strokeDasharray="5 5"
                  dot={{ r: 4, fill: '#fff', stroke: REFERENCE_DARK, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: REFERENCE_DARK }}
                  connectNulls
                >
                  <LabelList dataKey="grupoRef" content={RenderLineLabel} />
                </Line>
                <Line
                  type="monotone"
                  dataKey="principal"
                  name={principalName}
                  stroke={`url(#gradPrincipal-${grupo})`}
                  strokeWidth={3.2}
                  dot={{ r: 5, fill: '#fff', stroke: theme.primary, strokeWidth: 2.6 }}
                  activeDot={{ r: 7.5, fill: theme.primary }}
                  connectNulls
                >
                  <LabelList dataKey="principal" content={RenderLineLabel} />
                </Line>
                {activeRow && Number.isFinite(Number(activeRow.promedio)) && (
                  <ReferenceLine
                    y={Number(activeRow.promedio)}
                    stroke={theme.primary}
                    strokeDasharray="2 6"
                    strokeOpacity={0.45}
                    label={{ value: `Prom. ${fmt(activeRow.promedio, 1)}`, position: 'right', fill: theme.primaryDark, fontSize: 10, fontWeight: 700 }}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </Box>
        )}

        {/* Nota explicativa */}
        <Stack direction="row" spacing={1} alignItems="flex-start" sx={{ mt: 1.5, p: 1.2, borderRadius: 1.8, bgcolor: '#f8fafc', border: '1px dashed #cbd5e1' }}>
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
