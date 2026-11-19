import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography
} from '@mui/material';
import { motion } from 'framer-motion';
import {
  FaArrowLeft,
  FaArrowTrendUp,
  FaArrowsRotate,
  FaBolt,
  FaCalendarCheck,
  FaCalendarDays,
  FaChartArea,
  FaCircleCheck,
  FaClipboardList,
  FaClockRotateLeft,
  FaEye,
  FaFilter,
  FaHourglassHalf,
  FaRotate,
  FaXmark
} from 'react-icons/fa6';
import {
  Area,
  AreaChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import reporteSalidaService from '../../services/reporteSalidaService';
import {
  buildContinuousDailyChart,
  computeReporteSalidaSummary,
  filterRowsByCardFilter,
  formatShortSpanishDate,
  getRadicacionDateKey,
  getRangeStartKey,
  getTodayBogotaKey,
  isDateInsideRange,
  isPendingRequest,
  matchesSegmentoFilter
} from './reporteSalidaStatsUtils';

const formatNumber = (value) => new Intl.NumberFormat('es-CO').format(Number(value || 0));

const KPI_CARDS = [
  {
    key: 'todas',
    label: 'Solicitudes',
    Icon: FaClipboardList,
    color: '#2563eb',
    soft: '#dbeafe',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)'
  },
  {
    key: 'pendientes',
    label: 'Pendientes',
    Icon: FaHourglassHalf,
    color: '#d97706',
    soft: '#fef3c7',
    gradient: 'linear-gradient(135deg, #f59e0b 0%, #b45309 100%)'
  },
  {
    key: 'personales',
    label: 'Con Reposición',
    Icon: FaArrowsRotate,
    color: '#7c3aed',
    soft: '#ede9fe',
    gradient: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)'
  },
  {
    key: 'reposicionesValidadas',
    label: 'Rep. Validadas',
    Icon: FaCircleCheck,
    color: '#059669',
    soft: '#dcfce7',
    gradient: 'linear-gradient(135deg, #10b981 0%, #047857 100%)'
  }
];

const RANGE_LABELS = {
  weekly: 'últimos 7 días',
  monthly: 'últimos 30 días',
  all: 'histórico completo'
};

const SummaryMetricCard = React.memo(({
  index,
  label,
  value,
  detail,
  progress,
  Icon,
  color,
  soft,
  gradient,
  active,
  onSelect
}) => {
  const clampedProgress = Math.max(0, Math.min(100, Math.round(Number(progress || 0))));

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.28, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
      style={{ height: '100%' }}
    >
      <Paper
        elevation={0}
        role="button"
        tabIndex={0}
        aria-label={label}
        aria-pressed={active}
        onClick={onSelect}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        sx={{
          p: 2.3,
          height: '100%',
          minHeight: 168,
          borderRadius: '22px',
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          border: active ? `1.5px solid ${color}` : '1px solid #e2e8f0',
          background: active ? gradient : '#ffffff',
          color: active ? '#ffffff' : '#0f172a',
          boxShadow: active
            ? `0 16px 32px -8px ${color}55, 0 4px 12px -4px ${color}33`
            : '0 10px 28px rgba(15, 23, 42, 0.05)',
          transition: 'box-shadow 0.25s ease, border-color 0.25s ease, transform 0.25s ease',
          '&:hover': {
            borderColor: color,
            boxShadow: active
              ? `0 20px 38px -8px ${color}66`
              : `0 18px 34px -10px ${color}30`,
            '& .summary-metric-icon': {
              transform: 'scale(1.08) rotate(-4deg)'
            },
            '& .summary-metric-watermark': {
              transform: 'rotate(-2deg) scale(1.06)',
              opacity: active ? 0.18 : 0.13
            }
          }
        }}
      >
        {!active && (
          <Box
            aria-hidden="true"
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 4,
              background: gradient
            }}
          />
        )}

        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1.2} sx={{ position: 'relative', zIndex: 1 }}>
          <Stack spacing={0.5} sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                color: active ? 'rgba(255,255,255,0.9)' : '#64748b',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                lineHeight: 1.3,
                fontSize: 11.5
              }}
            >
              {label}
            </Typography>
            {active && (
              <Chip
                size="small"
                label="Activo"
                sx={{
                  alignSelf: 'flex-start',
                  height: 20,
                  fontSize: 10.5,
                  fontWeight: 800,
                  bgcolor: 'rgba(255,255,255,0.22)',
                  color: '#ffffff',
                  border: '1px solid rgba(255,255,255,0.32)'
                }}
              />
            )}
          </Stack>

          <Box
            className="summary-metric-icon"
            sx={{
              width: 46,
              height: 46,
              flexShrink: 0,
              borderRadius: '14px',
              display: 'grid',
              placeItems: 'center',
              color: active ? '#ffffff' : color,
              bgcolor: active ? 'rgba(255,255,255,0.2)' : soft,
              border: active ? '1px solid rgba(255,255,255,0.28)' : `1px solid ${color}24`,
              transition: 'transform 0.25s ease'
            }}
          >
            <Icon size={20} aria-hidden="true" />
          </Box>
        </Stack>

        <Box sx={{ mt: 1.3, position: 'relative', zIndex: 1 }}>
          <Typography
            sx={{
              color: active ? '#ffffff' : '#1e3a8a',
              fontWeight: 900,
              fontSize: 32,
              lineHeight: 1.05,
              letterSpacing: '-0.02em',
              fontVariantNumeric: 'tabular-nums'
            }}
          >
            {formatNumber(value)}
          </Typography>
          <Typography
            variant="body2"
            sx={{
              mt: 0.75,
              color: active ? 'rgba(255,255,255,0.88)' : '#64748b',
              fontWeight: 600,
              fontSize: 12.2,
              lineHeight: 1.35
            }}
          >
            {detail}
          </Typography>
        </Box>

        <LinearProgress
          variant="determinate"
          value={clampedProgress}
          sx={{
            mt: 1.6,
            height: 5,
            borderRadius: 999,
            position: 'relative',
            zIndex: 1,
            bgcolor: active ? 'rgba(255,255,255,0.24)' : `${color}18`,
            '& .MuiLinearProgress-bar': {
              borderRadius: 999,
              bgcolor: active ? '#ffffff' : color
            }
          }}
        />

        <Box
          className="summary-metric-watermark"
          aria-hidden="true"
          sx={{
            position: 'absolute',
            right: -12,
            bottom: -14,
            color: active ? '#ffffff' : color,
            opacity: active ? 0.15 : 0.08,
            pointerEvents: 'none',
            lineHeight: 0,
            transform: 'rotate(-8deg)',
            transition: 'transform 0.25s ease, opacity 0.25s ease'
          }}
        >
          <Icon size={96} />
        </Box>
      </Paper>
    </motion.div>
  );
});

const renderPeaksTooltip = ({ active, payload, label, accentColor }) => {
  if (!active || !payload || !payload.length) return null;
  const count = Number(payload[0]?.value || 0);
  return (
    <Paper
      elevation={0}
      sx={{
        px: 1.6,
        py: 1.1,
        borderRadius: '14px',
        border: `1px solid ${accentColor}33`,
        bgcolor: 'rgba(255,255,255,0.97)',
        boxShadow: '0 12px 26px rgba(15, 23, 42, 0.14)'
      }}
    >
      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#475569' }}>
        {formatShortSpanishDate(label)}
      </Typography>
      <Typography sx={{ fontSize: 15, fontWeight: 900, color: accentColor, mt: 0.2 }}>
        {formatNumber(count)} solicitud{count === 1 ? '' : 'es'}
      </Typography>
    </Paper>
  );
};

export default function ReporteSalidaFormatStatisticsDashboard({ onBack = null }) {
  const { enqueueSnackbar } = useSnackbar();
  const [rows, setRows] = useState([]);
  const [availableYears, setAvailableYears] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [cardFilter, setCardFilter] = useState('todas');
  const [segmentoFiltro, setSegmentoFiltro] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('');
  const [chartTimeFilter, setChartTimeFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const response = await reporteSalidaService.getEstadisticasFormatos(selectedYear);
      const payload = response?.data || {};
      setRows(Array.isArray(payload.solicitudes) ? payload.solicitudes : []);
      setAvailableYears(Array.isArray(payload.available_years) ? payload.available_years : []);
    } catch (error) {
      const message = error?.response?.data?.message || 'No fue posible cargar las estadísticas de reportes de salida.';
      setLoadError(message);
      setRows([]);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, selectedYear]);

  useEffect(() => {
    load();
  }, [load]);

  const handleYearChange = (event) => {
    setSelectedYear(event.target.value);
    setCardFilter('todas');
    setSelectedDate('');
  };

  const filteredRowsBase = useMemo(() => {
    let result = rows;
    if (estadoFiltro) {
      result = estadoFiltro === 'pendientes'
        ? result.filter(isPendingRequest)
        : result.filter((row) => row.estado === estadoFiltro);
    }
    if (segmentoFiltro) {
      result = result.filter((row) => matchesSegmentoFilter(row, segmentoFiltro));
    }
    return result;
  }, [rows, estadoFiltro, segmentoFiltro]);

  const rangeRowsBase = useMemo(() => (
    filteredRowsBase.filter((row) => isDateInsideRange(getRadicacionDateKey(row), chartTimeFilter))
  ), [filteredRowsBase, chartTimeFilter]);

  const analysisRowsBase = useMemo(() => {
    if (!selectedDate) return rangeRowsBase;
    return rangeRowsBase.filter((row) => getRadicacionDateKey(row) === selectedDate);
  }, [rangeRowsBase, selectedDate]);

  const filteredRows = useMemo(
    () => filterRowsByCardFilter(filteredRowsBase, cardFilter),
    [filteredRowsBase, cardFilter]
  );

  const rangeRows = useMemo(() => (
    filteredRows.filter((row) => isDateInsideRange(getRadicacionDateKey(row), chartTimeFilter))
  ), [filteredRows, chartTimeFilter]);

  const analysisRows = useMemo(() => {
    if (!selectedDate) return rangeRows;
    return rangeRows.filter((row) => getRadicacionDateKey(row) === selectedDate);
  }, [rangeRows, selectedDate]);

  const dailyChart = useMemo(() => {
    const dailyMap = {};
    const todayKey = getTodayBogotaKey();
    filteredRows.forEach((row) => {
      const fecha = getRadicacionDateKey(row);
      if (fecha && (!todayKey || fecha <= todayKey)) {
        if (!dailyMap[fecha]) dailyMap[fecha] = { date: fecha, solicitudes: 0 };
        dailyMap[fecha].solicitudes += 1;
      }
    });
    const dailyDates = Object.keys(dailyMap).sort();
    if (dailyDates.length === 0) return [];
    const currentYear = Number(String(todayKey || '').slice(0, 4));
    const numericSelectedYear = Number(selectedYear);
    const chartEndKey = (
      selectedYear
      && Number.isFinite(numericSelectedYear)
      && Number.isFinite(currentYear)
      && numericSelectedYear < currentYear
    )
      ? dailyDates[dailyDates.length - 1]
      : todayKey;
    return buildContinuousDailyChart(dailyMap, dailyDates[0], chartEndKey);
  }, [filteredRows, selectedYear]);

  const filteredDailyChart = useMemo(() => {
    if (chartTimeFilter === 'all' || dailyChart.length === 0) return dailyChart;
    const todayKey = getTodayBogotaKey();
    const cutoffKey = getRangeStartKey(chartTimeFilter);
    return dailyChart.filter((item) => item.date >= cutoffKey && item.date <= todayKey);
  }, [dailyChart, chartTimeFilter]);

  useEffect(() => {
    if (!selectedDate) return;
    const stillVisible = filteredDailyChart.some((item) => item.date === selectedDate);
    if (!stillVisible) setSelectedDate('');
  }, [filteredDailyChart, selectedDate]);

  const summary = useMemo(
    () => computeReporteSalidaSummary(analysisRowsBase),
    [analysisRowsBase]
  );

  const kpiCardsData = useMemo(() => {
    const total = summary.total;
    const approvedPct = total > 0 ? Math.round((summary.finalizadas / total) * 100) : 0;
    const pendingPct = total > 0 ? Math.round((summary.pendientes / total) * 100) : 0;
    const totalReposiciones = summary.personales + summary.reposicionesValidadas;
    const pendingReposicionPct = totalReposiciones > 0 ? Math.round((summary.personales / totalReposiciones) * 100) : 0;
    const validatedReposicionPct = totalReposiciones > 0 ? Math.round((summary.reposicionesValidadas / totalReposiciones) * 100) : 0;

    return [
      {
        ...KPI_CARDS[0],
        value: summary.total,
        detail: `${formatNumber(summary.finalizadas)} aprobadas · ${formatNumber(summary.rechazadas)} rechazadas`,
        progress: approvedPct
      },
      {
        ...KPI_CARDS[1],
        value: summary.pendientes,
        detail: `${pendingPct}% en trámite de aprobación`,
        progress: pendingPct
      },
      {
        ...KPI_CARDS[2],
        value: summary.personales,
        detail: 'Pendientes por reponer tiempo',
        progress: pendingReposicionPct
      },
      {
        ...KPI_CARDS[3],
        value: summary.reposicionesValidadas,
        detail: `${validatedReposicionPct}% de cumplimiento en reposiciones`,
        progress: validatedReposicionPct
      }
    ];
  }, [summary]);

  const activeCardMeta = useMemo(
    () => KPI_CARDS.find((card) => card.key === cardFilter) || KPI_CARDS[0],
    [cardFilter]
  );

  const peakPoint = useMemo(() => {
    if (!filteredDailyChart.length) return null;
    return filteredDailyChart.reduce((best, item) => (
      Number(item.solicitudes || 0) > Number(best?.solicitudes || -1) ? item : best
    ), filteredDailyChart[0]);
  }, [filteredDailyChart]);

  const dailyAverage = useMemo(() => {
    if (!filteredDailyChart.length) return '0';
    const totalSolicitudes = filteredDailyChart.reduce((acc, item) => acc + Number(item.solicitudes || 0), 0);
    const avg = totalSolicitudes / filteredDailyChart.length;
    return Number.isInteger(avg) ? String(avg) : avg.toFixed(1);
  }, [filteredDailyChart]);

  const selectedDateCount = useMemo(() => (
    filteredDailyChart.find((item) => item.date === selectedDate)?.solicitudes ?? analysisRows.length
  ), [filteredDailyChart, selectedDate, analysisRows.length]);

  const activeRangeLabel = RANGE_LABELS[chartTimeFilter] || RANGE_LABELS.all;
  const activeCount = analysisRows.length;

  const handleChartClick = (event) => {
    const date = event?.activeLabel || event?.activePayload?.[0]?.payload?.date;
    if (!date) return;
    setSelectedDate((current) => (current === date ? '' : date));
  };

  if (loading && rows.length === 0) {
    return (
      <Paper elevation={0} sx={{ p: 7, border: '1px solid #e2e8f0', borderRadius: '22px', textAlign: 'center', bgcolor: '#fff' }}>
        <CircularProgress sx={{ color: '#0d9488' }} />
        <Typography sx={{ mt: 2, color: '#64748b', fontWeight: 700 }}>
          Calculando resumen estadístico de reportes de salida…
        </Typography>
      </Paper>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 1.5, md: 2.5 },
        borderRadius: '24px',
        bgcolor: '#f4f8ff',
        border: '1px solid #e2ecfb'
      }}
    >
      <Stack spacing={2.5}>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: 'easeOut' }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.2, md: 2.6 },
              borderRadius: '22px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)'
            }}
          >
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
              <Stack direction="row" spacing={1.6} alignItems="center">
                {typeof onBack === 'function' && (
                  <Button
                    variant="outlined"
                    aria-label="Volver a formatos"
                    onClick={onBack}
                    sx={{
                      minWidth: 42,
                      width: 42,
                      height: 42,
                      p: 0,
                      borderRadius: '13px',
                      color: '#1e3a8a',
                      borderColor: '#cbd5e1',
                      bgcolor: '#f8fafc',
                      '&:hover': { borderColor: '#0d9488', bgcolor: '#f0fdfa' }
                    }}
                  >
                    <FaArrowLeft size={15} />
                  </Button>
                )}
                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                  <Typography sx={{ color: '#1e3a8a', fontWeight: 850, fontSize: { xs: 20, md: 24 }, lineHeight: 1.2 }}>
                    Reportes de Salida
                  </Typography>
                  <Chip
                    size="small"
                    label="THM-DP-FR-002"
                    sx={{ bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 800, height: 24 }}
                  />
                  <Chip
                    size="small"
                    icon={<FaEye size={12} />}
                    label="Resumen general · Solo consulta"
                    sx={{
                      bgcolor: '#f1f5f9',
                      color: '#475569',
                      fontWeight: 700,
                      height: 24,
                      '& .MuiChip-icon': { color: '#0f766e', ml: 0.8 }
                    }}
                  />
                </Stack>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="stretch">
                <FormControl size="small" sx={{ minWidth: 185 }}>
                  <InputLabel id="reporte-salida-year-label" sx={{ fontWeight: 700, color: '#475569' }}>
                    Año
                  </InputLabel>
                  <Select
                    labelId="reporte-salida-year-label"
                    value={selectedYear}
                    label="Año"
                    onChange={handleYearChange}
                    sx={{
                      height: 42,
                      bgcolor: '#f8fafc',
                      borderRadius: '12px',
                      fontWeight: 700,
                      color: '#1e3a8a'
                    }}
                  >
                    <MenuItem value="">Todos los años</MenuItem>
                    {availableYears.map((year) => <MenuItem key={year} value={String(year)}>{year}</MenuItem>)}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <FaRotate size={14} />}
                  onClick={load}
                  disabled={loading}
                  sx={{
                    height: 42,
                    px: 2.2,
                    borderRadius: '12px',
                    fontWeight: 800,
                    textTransform: 'none',
                    background: 'linear-gradient(135deg, #0d9488 0%, #0f766e 100%)',
                    boxShadow: '0 6px 16px rgba(15, 118, 110, 0.22)'
                  }}
                >
                  Actualizar
                </Button>
              </Stack>
            </Stack>
          </Paper>
        </motion.div>

        {loadError && (
          <Alert severity="warning" sx={{ borderRadius: '16px' }}>
            {loadError}
          </Alert>
        )}

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(4, minmax(0, 1fr))'
            },
            gap: 2,
            width: '100%'
          }}
        >
          {kpiCardsData.map((card, index) => (
            <SummaryMetricCard
              key={card.key}
              index={index}
              label={card.label}
              value={card.value}
              detail={card.detail}
              progress={card.progress}
              Icon={card.Icon}
              color={card.color}
              soft={card.soft}
              gradient={card.gradient}
              active={cardFilter === card.key}
              onSelect={() => setCardFilter(cardFilter === card.key ? 'todas' : card.key)}
            />
          ))}
        </Box>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.14, ease: 'easeOut' }}
        >
          <Paper
            elevation={0}
            sx={{
              p: { xs: 2.2, md: 3 },
              borderRadius: '22px',
              border: '1px solid #e2e8f0',
              bgcolor: '#ffffff',
              boxShadow: '0 10px 30px rgba(15, 23, 42, 0.05)'
            }}
          >
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              alignItems={{ xs: 'flex-start', md: 'center' }}
              justifyContent="space-between"
              spacing={2}
              sx={{ mb: 2.4 }}
            >
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '13px',
                    bgcolor: activeCardMeta.soft,
                    color: activeCardMeta.color,
                    border: `1px solid ${activeCardMeta.color}28`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    transition: 'background-color 0.2s ease, color 0.2s ease'
                  }}
                >
                  <FaChartArea size={18} aria-hidden="true" />
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 850, color: '#1e3a8a', fontSize: { xs: 17, md: 19 }, lineHeight: 1.2 }}>
                    Flujo Diario de Ausentismo
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 12.5, fontWeight: 600, mt: 0.3 }}>
                    Tendencia diaria de solicitudes radicadas. Haz clic en un pico para resumir ese día en las tarjetas superiores.
                  </Typography>
                </Box>
              </Stack>

              <ToggleButtonGroup
                size="small"
                value={chartTimeFilter}
                exclusive
                onChange={(event, val) => val && setChartTimeFilter(val)}
                sx={{
                  bgcolor: '#f8fafc',
                  borderRadius: '12px',
                  '& .MuiToggleButton-root': {
                    textTransform: 'none',
                    fontWeight: 750,
                    fontSize: 12.5,
                    color: '#64748b',
                    border: '1px solid #e2e8f0',
                    px: 1.8,
                    gap: 0.8,
                    '&.Mui-selected': {
                      bgcolor: activeCardMeta.soft,
                      color: activeCardMeta.color,
                      borderColor: `${activeCardMeta.color}55`
                    }
                  }
                }}
              >
                <ToggleButton value="weekly">
                  <FaCalendarDays size={13} aria-hidden="true" />
                  Últimos 7 Días
                </ToggleButton>
                <ToggleButton value="monthly">
                  <FaCalendarCheck size={13} aria-hidden="true" />
                  Últimos 30 Días
                </ToggleButton>
                <ToggleButton value="all">
                  <FaClockRotateLeft size={13} aria-hidden="true" />
                  Histórico
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2.2 }}>
              <TextField
                select
                size="small"
                label="Segmento (Motivo)"
                value={segmentoFiltro}
                onChange={(event) => setSegmentoFiltro(event.target.value)}
                sx={{ minWidth: { xs: '100%', md: 290 }, bgcolor: '#f8fafc' }}
              >
                <MenuItem value="">Todos los Segmentos</MenuItem>
                <MenuItem value="institucionales">Actividades propias del cargo (Misionales)</MenuItem>
                <MenuItem value="salud">Salud y Bienestar</MenuItem>
                <MenuItem value="personales">Trámites y Permisos Personales</MenuItem>
              </TextField>

              <TextField
                select
                size="small"
                label="Estado de Solicitud"
                value={estadoFiltro}
                onChange={(event) => setEstadoFiltro(event.target.value)}
                sx={{ minWidth: { xs: '100%', md: 260 }, bgcolor: '#f8fafc' }}
              >
                <MenuItem value="">Todos los Estados</MenuItem>
                <MenuItem value="pendientes">Solo Pendientes</MenuItem>
                <MenuItem value="finalizada">Solo Aprobadas / Finalizadas</MenuItem>
                <MenuItem value="no_aprobada">Solo Rechazadas</MenuItem>
              </TextField>
            </Stack>

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              sx={{
                mb: 2.2,
                p: 1.4,
                borderRadius: '14px',
                bgcolor: selectedDate ? '#ecfeff' : '#f8fafc',
                border: selectedDate ? '1px solid #bae6fd' : '1px solid #e2e8f0'
              }}
            >
              <Typography sx={{ color: selectedDate ? '#075985' : '#475569', fontWeight: 750, fontSize: 13 }}>
                {selectedDate
                  ? `Resumen del día ${formatShortSpanishDate(selectedDate)}: ${formatNumber(selectedDateCount)} solicitud${selectedDateCount === 1 ? '' : 'es'}.`
                  : `Mostrando indicadores del ${activeRangeLabel}: ${formatNumber(activeCount)} solicitud${activeCount === 1 ? '' : 'es'}.`}
              </Typography>

              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
                {peakPoint && peakPoint.solicitudes > 0 && (
                  <Chip
                    size="small"
                    icon={<FaBolt size={11} />}
                    label={`Pico máximo: ${formatNumber(peakPoint.solicitudes)} (${formatShortSpanishDate(peakPoint.date)})`}
                    sx={{
                      bgcolor: '#fffbeb',
                      color: '#b45309',
                      border: '1px solid #fde68a',
                      fontWeight: 800,
                      '& .MuiChip-icon': { color: '#d97706', ml: 0.7 }
                    }}
                  />
                )}
                {filteredDailyChart.length > 0 && (
                  <Chip
                    size="small"
                    icon={<FaArrowTrendUp size={11} />}
                    label={`Promedio diario: ${dailyAverage} / día`}
                    sx={{
                      bgcolor: '#eff6ff',
                      color: '#1d4ed8',
                      border: '1px solid #bfdbfe',
                      fontWeight: 800,
                      '& .MuiChip-icon': { color: '#2563eb', ml: 0.7 }
                    }}
                  />
                )}
                {cardFilter !== 'todas' && (
                  <>
                    <Chip
                      size="small"
                      icon={<FaFilter size={11} />}
                      label={`Tarjeta: ${activeCardMeta.label}`}
                      sx={{
                        bgcolor: activeCardMeta.soft,
                        color: activeCardMeta.color,
                        fontWeight: 800,
                        '& .MuiChip-icon': { color: activeCardMeta.color, ml: 0.7 }
                      }}
                    />
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<FaXmark size={12} />}
                      onClick={() => setCardFilter('todas')}
                      sx={{ textTransform: 'none', fontWeight: 800, minHeight: 28, px: 1 }}
                    >
                      Ver todas
                    </Button>
                  </>
                )}
                {selectedDate && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<FaXmark size={12} />}
                    onClick={() => setSelectedDate('')}
                    sx={{ textTransform: 'none', fontWeight: 800, borderRadius: '10px' }}
                  >
                    Quitar filtro
                  </Button>
                )}
              </Stack>
            </Stack>

            <Box sx={{ width: '100%', height: 370 }}>
              {filteredDailyChart.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={filteredDailyChart}
                    margin={{ top: 36, right: 24, left: 0, bottom: 8 }}
                    onClick={handleChartClick}
                    style={{ cursor: 'pointer' }}
                  >
                    <defs>
                      <linearGradient id="reporteSalidaPeaksGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={activeCardMeta.color} stopOpacity={0.36} />
                        <stop offset="95%" stopColor={activeCardMeta.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                      minTickGap={22}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <RechartsTooltip
                      content={(tooltipProps) => renderPeaksTooltip({
                        ...tooltipProps,
                        accentColor: activeCardMeta.color
                      })}
                    />
                    <Area
                      type="linear"
                      dataKey="solicitudes"
                      name="Solicitudes"
                      stroke={activeCardMeta.color}
                      strokeWidth={3.2}
                      fillOpacity={1}
                      fill="url(#reporteSalidaPeaksGradient)"
                      activeDot={(props) => (
                        <circle
                          cx={props.cx}
                          cy={props.cy}
                          r={7}
                          stroke="#ffffff"
                          strokeWidth={2.5}
                          fill={activeCardMeta.color}
                          style={{ pointerEvents: 'none' }}
                        />
                      )}
                      dot={(props) => {
                        const pointDate = props.payload?.date;
                        const isSelected = Boolean(selectedDate && selectedDate === pointDate);
                        const isPeak = Boolean(peakPoint && peakPoint.solicitudes > 0 && peakPoint.date === pointDate);
                        const hasValue = Number(props.payload?.solicitudes || 0) > 0;
                        if (filteredDailyChart.length > 45 && !isSelected && !isPeak && !hasValue) return null;
                        return (
                          <circle
                            cx={props.cx}
                            cy={props.cy}
                            r={isSelected ? 7 : (isPeak ? 5.5 : 3.8)}
                            stroke={isSelected ? '#0f172a' : '#ffffff'}
                            strokeWidth={isSelected ? 2.8 : 2}
                            fill={activeCardMeta.color}
                            style={{ pointerEvents: 'none' }}
                          />
                        );
                      }}
                    >
                      <LabelList
                        dataKey="solicitudes"
                        position="top"
                        offset={10}
                        formatter={(value) => Number(value) > 0 ? formatNumber(value) : ''}
                        style={{ fontSize: 12, fill: activeCardMeta.color, pointerEvents: 'none' }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Stack alignItems="center" justifyContent="center" height="100%" spacing={1.2}>
                  <Box
                    sx={{
                      width: 54,
                      height: 54,
                      borderRadius: '16px',
                      bgcolor: '#f1f5f9',
                      color: '#94a3b8',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                  >
                    <FaChartArea size={24} aria-hidden="true" />
                  </Box>
                  <Typography sx={{ color: '#64748b', fontWeight: 700, fontSize: 14 }}>
                    No hay datos suficientes para graficar con los filtros seleccionados.
                  </Typography>
                </Stack>
              )}
            </Box>
          </Paper>
        </motion.div>
      </Stack>
    </Box>
  );
}
