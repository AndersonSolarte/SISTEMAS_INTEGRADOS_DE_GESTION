import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  FormControl,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip as MuiTooltip,
  Typography
} from '@mui/material';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  BarChart as BarChartIcon,
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  FilterAltOff as FilterAltOffIcon,
  GridOn as GridOnIcon,
  School as SchoolIcon,
  ShowChart as ShowChartIcon,
  StackedBarChart as StackedBarChartIcon,
  TableChart as TableChartIcon,
  TrendingDown as TrendingDownIcon,
  TrendingFlat as TrendingFlatIcon,
  TrendingUp as TrendingUpIcon,
  ViewAgenda as ViewAgendaIcon,
  ViewKanban as ViewKanbanIcon,
  ViewStream as ViewStreamIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// ── PALETA INSTITUCIONAL UNICESMAG ──
const BRAND_NAVY = '#1e3d6b';
const BRAND_BLUE = '#1f73e8';
const BRAND_BURGUNDY = '#8b1e24';
const BRAND_SLATE = '#475569';
const BRAND_CYAN = '#0284c7';
const BRAND_EMERALD = '#059669';
const BRAND_AMBER = '#d97706';
const BRAND_PURPLE = '#7c3aed';

const numberFmt = new Intl.NumberFormat('es-CO');
const percentFmt = (val) => `${Number(val || 0).toFixed(1).replace('.', ',')}%`;

// ── UTILIDADES DE NORMALIZACIÓN ──
const normalizeText = (v) => String(v ?? '').trim();
const normalizeUpper = (v) =>
  normalizeText(v)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizePeriodToken = (val) => {
  if (!val) return '';
  // Eliminar el año si viene incrustado en el valor del período (ej. '2024 IP' -> 'IP', '2025-2' -> '-2')
  const cleaned = normalizeUpper(val).replace(/\b(19|20)\d{2}\b/g, '').trim();
  if (cleaned.includes('IIP') || cleaned.includes('II') || cleaned.includes('-2') || cleaned.includes('/2') || cleaned.endsWith(' 2') || cleaned === '2' || cleaned.includes('SEGUNDO')) {
    return 'IIP';
  }
  if (cleaned.includes('IP') || cleaned.includes('I') || cleaned.includes('-1') || cleaned.includes('/1') || cleaned.endsWith(' 1') || cleaned === '1' || cleaned.includes('PRIMERO')) {
    return 'IP';
  }
  return '';
};

const getRowYear = (row) => {
  const explicitYear = Number(row?.anio || 0);
  if (Number.isFinite(explicitYear) && explicitYear >= 1900 && explicitYear <= 2200) return String(explicitYear);
  const match = normalizeText(row?.periodo || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
};

const getRowPeriodLabel = (row) => {
  const year = getRowYear(row);
  const period = normalizePeriodToken(row?.periodo || row?.anio);
  return year && period ? `${year} ${period}` : '';
};

const parsePeriodOrder = (periodLabel) => {
  const parts = String(periodLabel || '').trim().split(' ');
  const year = parseInt(parts[0], 10) || 0;
  const sem = parts[1] === 'IIP' || parts[1] === '2' ? 2 : 1;
  return year * 10 + sem;
};

// ── COPIA DE GRÁFICO COMO IMAGEN (ALTA DEFINICIÓN / INFORMES Y WORD) ──
const copyChartImage = async (cardEl, enqueueSnackbar) => {
  if (!cardEl) return;
  try {
    const canvas = await html2canvas(cardEl, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      windowWidth: 1280, // Asegura que la captura se calcule con ancho de escritorio completo y tipografía equilibrada
      ignoreElements: (el) => el.hasAttribute('data-no-export')
    });
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        enqueueSnackbar('Gráfico copiado en alta resolución (listo para Word / Informe)', { variant: 'success' });
      } catch {
        enqueueSnackbar('No se pudo copiar directamente la imagen', { variant: 'warning' });
      }
    }, 'image/png');
  } catch {
    enqueueSnackbar('Error al capturar la imagen', { variant: 'error' });
  }
};

// ── COPIA DE TABLA COMO TEXTO TABULAR (EXCEL READY) ──
const copyTableData = (headers, rows, enqueueSnackbar) => {
  try {
    const tsvContent = [
      headers.join('\t'),
      ...rows.map((row) => headers.map((h) => row[h] ?? '').join('\t'))
    ].join('\n');
    navigator.clipboard.writeText(tsvContent);
    enqueueSnackbar('Tabla estadística copiada (lista para pegar en Excel)', { variant: 'success' });
  } catch {
    enqueueSnackbar('Error al copiar datos de la tabla', { variant: 'error' });
  }
};

// ── TOOLTIP PERSONALIZADO PARA RECHARTS ──
const CustomChartTooltip = ({ active, payload, label, showTotal = true }) => {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((acc, p) => acc + (Number(p.value) || 0), 0);

  return (
    <Paper
      elevation={4}
      sx={{
        p: 1.4,
        borderRadius: 2,
        bgcolor: 'rgba(15, 23, 42, 0.94)',
        backdropFilter: 'blur(8px)',
        color: '#ffffff',
        border: '1px solid rgba(255, 255, 255, 0.15)',
        minWidth: 160
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#93c5fd', textTransform: 'uppercase', mb: 0.8 }}>
        Período: {label}
      </Typography>
      <Stack spacing={0.5}>
        {payload.map((entry, index) => (
          <Stack key={`item-${index}`} direction="row" justifyContent="space-between" spacing={2} alignItems="center">
            <Stack direction="row" spacing={0.8} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: entry.color || entry.fill }} />
              <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#e2e8f0' }}>{entry.name}:</Typography>
            </Stack>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#ffffff' }}>
              {numberFmt.format(entry.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
      {showTotal && payload.length > 1 && (
        <>
          <Divider sx={{ my: 0.8, borderColor: 'rgba(255, 255, 255, 0.2)' }} />
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#38bdf8' }}>TOTAL:</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#38bdf8' }}>
              {numberFmt.format(total)}
            </Typography>
          </Stack>
        </>
      )}
    </Paper>
  );
};

// ── ETIQUETA INTELIGENTE ANTI-SUPERPOSICIÓN CON CONTORNO DE ALTO CONTRASTE ──
const renderSmartLabel = (seriesKey, allKeys, dataList, color) => (props) => {
  const { x, y, value, index } = props;
  const numVal = Number(value);
  // Si el valor es cero o no válido, no renderizar etiqueta para no saturar la base del eje
  if (value === undefined || value === null || !dataList || !dataList[index] || numVal === 0 || isNaN(numVal)) {
    return null;
  }
  const row = dataList[index];

  // Extraer series activas (> 0) ordenadas descendentemente
  const activePoints = allKeys
    .map((k) => ({ key: k, val: Number(row[k] || 0) }))
    .filter((p) => p.val > 0)
    .sort((a, b) => b.val - a.val);

  const rank = activePoints.findIndex((p) => p.key === seriesKey);
  if (rank === -1) return null;
  const total = activePoints.length;

  let dy = -11;
  let dx = 0;

  if (total === 1) {
    dy = -11;
    dx = 0;
  } else {
    const currentVal = activePoints[rank].val;
    const isHighest = rank === 0;
    const isLowest = rank === total - 1;
    // Si el valor es bajo (cerca del eje X inferior <= 16), NUNCA poner dy hacia abajo
    const isNearBottomAxis = currentVal <= 16;

    const valAbove = !isHighest ? activePoints[rank - 1].val : null;
    const valBelow = !isLowest ? activePoints[rank + 1].val : null;
    const gapAbove = valAbove !== null ? valAbove - currentVal : Infinity;
    const gapBelow = valBelow !== null ? currentVal - valBelow : Infinity;

    if (isHighest) {
      dy = -11;
      dx = gapBelow < 12 ? -13 : 0;
    } else if (isLowest) {
      if (isNearBottomAxis) {
        dy = -11;
        dx = gapAbove < 16 ? (rank % 2 === 0 ? -13 : 13) : 0;
      } else {
        dy = 16;
        dx = 0;
      }
    } else {
      // Puntos intermedios
      if (isNearBottomAxis) {
        dy = -11;
        dx = rank % 2 === 0 ? -13 : 13;
      } else {
        if (gapAbove >= 26) {
          dy = -11;
          dx = 0;
        } else if (gapBelow >= 26) {
          dy = 16;
          dx = 0;
        } else {
          dy = -11;
          dx = rank % 2 === 0 ? -13 : 13;
        }
      }
    }
  }

  return (
    <text
      x={x + dx}
      y={y}
      dy={dy}
      textAnchor="middle"
      fill={color}
      fontSize={13}
      fontWeight={950}
      stroke="#ffffff"
      strokeWidth={3.8}
      paintOrder="stroke fill"
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      {value}
    </text>
  );
};

// ── CUSTOM X-AXIS TICK: SEMESTRE EN BURBUJA (I / II) + AÑO EN NEGRITA (ESTILO OFICIAL) ──
const CustomPeriodAxisTick = ({ x, y, payload }) => {
  if (!payload || !payload.value) return null;
  const rawValue = String(payload.value).trim();
  const parts = rawValue.split(' ');
  const year = parts[0] || rawValue;
  const rawSem = (parts[1] || '').toUpperCase();
  const romanSem = rawSem.includes('II') || rawSem.includes('2') ? 'II' : 'I';

  return (
    <g transform={`translate(${x},${y})`}>
      {/* Burbuja circular celeste para el semestre (I / II) */}
      <circle
        cx={0}
        cy={12}
        r={9.5}
        fill="#f0f7ff"
        stroke="#93c5fd"
        strokeWidth={1.4}
      />
      <text
        x={0}
        y={15.5}
        textAnchor="middle"
        fill="#1d4ed8"
        fontSize={10.5}
        fontWeight={950}
        fontFamily="inherit"
        style={{ userSelect: 'none' }}
      >
        {romanSem}
      </text>

      {/* Año en negrita horizontal oscuro directamente debajo */}
      <text
        x={0}
        y={35}
        textAnchor="middle"
        fill="#0a1e36"
        fontSize={12}
        fontWeight={950}
        fontFamily="inherit"
        style={{ userSelect: 'none' }}
      >
        {year}
      </text>
    </g>
  );
};

// ── CONFIGURACIÓN DE SERIES INSTITUCIONALES ──
const SERIES_TOTAL = [
  { key: 'total', label: 'Total Docentes', short: 'TOT', color: BRAND_NAVY, bg: '#f1f5f9' }
];

const SERIES_VINCULACION = [
  { key: 'tc', label: 'Tiempo Completo', short: 'TC', color: BRAND_BURGUNDY, bg: '#fff1f2' },
  { key: 'mt', label: 'Medio Tiempo', short: 'MT', color: BRAND_SLATE, bg: '#f1f5f9' },
  { key: 'hc', label: 'Hora Cátedra', short: 'HC', color: BRAND_CYAN, bg: '#f0f9ff' }
];

const SERIES_CONTRATACION = [
  { key: 'semestral', label: 'Semestral', short: 'SEM', color: BRAND_BURGUNDY, bg: '#fff1f2' },
  { key: 'anual', label: 'Anual', short: 'ANU', color: BRAND_SLATE, bg: '#f1f5f9' }
];

const SERIES_FORMACION = [
  { key: 'doctorado', label: 'Doctorado', short: 'DOC', color: BRAND_EMERALD, bg: '#ecfdf5' },
  { key: 'magister', label: 'Magíster', short: 'MAG', color: BRAND_BURGUNDY, bg: '#fff1f2' },
  { key: 'especialista', label: 'Especialista', short: 'ESP', color: BRAND_NAVY, bg: '#eff6ff' },
  { key: 'profesional', label: 'Profesional', short: 'PRE', color: BRAND_SLATE, bg: '#f1f5f9' }
];

const SERIES_ESCALAFON = [
  { key: 'titular', label: 'Titular', short: 'TIT', color: BRAND_PURPLE, bg: '#f5f3ff' },
  { key: 'asociado', label: 'Asociado', short: 'ASO', color: BRAND_BURGUNDY, bg: '#fff1f2' },
  { key: 'asistente', label: 'Asistente', short: 'ASI', color: BRAND_NAVY, bg: '#eff6ff' },
  { key: 'auxiliar', label: 'Auxiliar', short: 'AUX', color: BRAND_CYAN, bg: '#f0f9ff' },
  { key: 'basico', label: 'Básico / Instructor', short: 'BAS', color: BRAND_AMBER, bg: '#fffbeb' }
];

// ── SELECTOR SEGMENTADO DE TIPOS DE GRÁFICO ──
const ChartTypeSelector = ({ currentType, onSelect, availableTypes = ['lines', 'tracks', 'stacked', 'infographic', 'kanban'] }) => {
  const typeLabels = {
    lines: { label: 'Líneas', icon: <ShowChartIcon sx={{ fontSize: 16 }} /> },
    bars: { label: 'Barras', icon: <BarChartIcon sx={{ fontSize: 16 }} /> },
    area: { label: 'Área', icon: <ShowChartIcon sx={{ fontSize: 16 }} /> },
    tracks: { label: 'Carriles', icon: <ViewStreamIcon sx={{ fontSize: 16 }} /> },
    stacked: { label: 'Apiladas', icon: <StackedBarChartIcon sx={{ fontSize: 16 }} /> },
    infographic: { label: 'Infografía', icon: <GridOnIcon sx={{ fontSize: 16 }} /> },
    kanban: { label: 'Kanban / KPIs', icon: <ViewKanbanIcon sx={{ fontSize: 16 }} /> }
  };

  return (
    <Box
      sx={{
        mb: 2,
        p: 0.6,
        borderRadius: 2.2,
        bgcolor: '#f8fafc',
        border: '1px solid #e2e8f0',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.6,
        flexWrap: 'wrap',
        boxShadow: '0 2px 6px rgba(15,23,42,0.02)'
      }}
    >
      <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#64748b', px: 0.8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
        Visualización:
      </Typography>
      {availableTypes.map((t) => {
        const item = typeLabels[t];
        if (!item) return null;
        const isActive = currentType === t;
        return (
          <Button
            key={t}
            size="small"
            variant={isActive ? 'contained' : 'text'}
            startIcon={item.icon}
            onClick={() => onSelect(t)}
            sx={{
              borderRadius: 1.8,
              px: 1.4,
              py: 0.5,
              fontSize: 11.5,
              fontWeight: 800,
              textTransform: 'none',
              bgcolor: isActive ? BRAND_NAVY : 'transparent',
              color: isActive ? '#ffffff' : '#475569',
              boxShadow: isActive ? '0 2px 8px rgba(30,61,107,0.22)' : 'none',
              '&:hover': {
                bgcolor: isActive ? '#142c4f' : '#f1f5f9'
              }
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </Box>
  );
};

// ── COMPONENTE: CARRILES INDEPENDIENTES POR CATEGORÍA (ESTILO IMAGEN 3) ──
const CategoryTracksChart = ({ data, seriesConfig }) => {
  if (!data || !data.length || !seriesConfig || !seriesConfig.length) return null;

  // Filtrar categorías que no tengan datos (> 0) en los períodos seleccionados
  const seriesToRender = seriesConfig.filter((s) => data.some((d) => Number(d[s.key] || 0) > 0));
  if (seriesToRender.length === 0) return null;

  const groupSyncId = `track-sync-${seriesToRender[0]?.key || 'default'}`;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 0.5 }}>
      <Box sx={{ minWidth: { xs: 720, md: '100%' }, display: 'flex', flexDirection: 'column', gap: 1.2 }}>
        {seriesToRender.map((s, idx) => {
          const isLast = idx === seriesToRender.length - 1;
          const gradientId = `grad-track-${s.key}`;

          return (
            <Paper
              key={`track-${s.key}`}
              elevation={0}
              sx={{
                p: { xs: 1, md: 1.2 },
                borderRadius: 2.2,
                border: '1.5px solid #e2e8f0',
                bgcolor: '#ffffff',
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.03)',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'stretch', md: isLast ? 'flex-start' : 'center' },
                gap: 1.8,
                transition: 'all 0.2s ease',
                '&:hover': {
                  borderColor: s.color,
                  boxShadow: `0 6px 16px ${s.color}20`
                }
              }}
            >
              {/* Pill institucional en la izquierda (armonioso en pantalla y nítido en Word) */}
              <Box
                sx={{
                  minWidth: { xs: '100%', md: 210 },
                  maxWidth: { xs: '100%', md: 225 },
                  p: 1.2,
                  mt: isLast ? { xs: 0, md: 0.8 } : 0,
                  borderRadius: 2,
                  bgcolor: s.bg || '#f8fafc',
                  border: `1.5px solid ${s.color}35`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.2
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    bgcolor: s.color,
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 950,
                    fontSize: s.short?.length > 2 ? 11 : 12.5,
                    boxShadow: `0 2px 8px ${s.color}35`,
                    flexShrink: 0
                  }}
                >
                  {s.short || s.label.slice(0, 2).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography
                    sx={{
                      fontSize: 13,
                      fontWeight: 950,
                      color: s.color,
                      lineHeight: 1.2,
                      textTransform: 'uppercase',
                      letterSpacing: '0.02em',
                      wordBreak: 'break-word'
                    }}
                  >
                    {s.label}
                  </Typography>
                </Box>
              </Box>

              {/* Curva individual equilibrada: compacta en pantalla y nítida en Word */}
              <Box sx={{ flex: 1, height: isLast ? 132 : 82, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    syncId={groupSyncId}
                    data={data}
                    margin={{ top: 22, right: 30, left: 30, bottom: isLast ? 22 : 6 }}
                  >
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={s.color} stopOpacity={0.32} />
                        <stop offset="95%" stopColor={s.color} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeWidth={1} />
                    <XAxis
                      dataKey="periodo"
                      hide={!isLast}
                      tick={<CustomPeriodAxisTick />}
                      axisLine={{ stroke: '#64748b', strokeWidth: 1.8 }}
                      tickLine={{ stroke: '#64748b', strokeWidth: 1.5 }}
                      interval={0}
                      height={46}
                    />
                    <YAxis
                      domain={[0, (dataMax) => Math.max(Math.ceil(dataMax * 1.35), 5)]}
                      hide
                    />
                    <RechartsTooltip
                      formatter={(val) => [numberFmt.format(val), s.label]}
                      labelFormatter={(p) => `Período: ${p}`}
                    />
                    <Area
                      type="linear"
                      dataKey={s.key}
                      name={s.label}
                      stroke={s.color}
                      strokeWidth={3.4}
                      fill={`url(#${gradientId})`}
                      dot={{ fill: s.color, r: 4.8, stroke: '#ffffff', strokeWidth: 2.2 }}
                      activeDot={{ r: 7, fill: s.color }}
                    >
                      <LabelList
                        dataKey={s.key}
                        position="top"
                        formatter={(v) => (Number(v) > 0 ? v : '')}
                        style={{ fill: s.color, fontSize: 13.5, fontWeight: 950, stroke: '#ffffff', strokeWidth: 3.5, paintOrder: 'stroke fill' }}
                      />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </Paper>
          );
        })}
      </Box>
    </Box>
  );
};

// ── COMPONENTE: MATRIZ INFOGRÁFICA DE INDICADORES (ESTILO IMAGEN 1) ──
const InfographicMatrixTable = ({ data, seriesConfig }) => {
  if (!data || !data.length || !seriesConfig || !seriesConfig.length) return null;
  const seriesToRender = seriesConfig.filter((s) => data.some((d) => Number(d[s.key] || 0) > 0));
  if (seriesToRender.length === 0) return null;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 0.5 }}>
      <TableContainer
        component={Paper}
        elevation={0}
        sx={{
          minWidth: { xs: 800, md: '100%' },
          borderRadius: 2.8,
          border: '1px solid #dbeafe',
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.03)',
          overflow: 'hidden'
        }}
      >
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0' }}>
              <TableCell sx={{ fontWeight: 950, color: '#1e3d6b', fontSize: 11.5, minWidth: 210, py: 1.5 }}>
                INDICADOR
              </TableCell>
              {data.map((d) => (
                <TableCell key={`hdr-${d.periodo}`} align="center" sx={{ fontWeight: 900, color: '#0f2942', fontSize: 11, minWidth: 68, py: 1.5 }}>
                  {d.periodo}
                </TableCell>
              ))}
              <TableCell align="right" sx={{ fontWeight: 950, color: '#1e3d6b', fontSize: 11.5, minWidth: 95 }}>
                ACTUAL
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 950, color: '#1e3d6b', fontSize: 11.5, minWidth: 125 }}>
                VARIACIÓN ACUM.
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {seriesToRender.map((s, idx) => {
              const firstVal = Number(data[0]?.[s.key] || 0);
              const latestVal = Number(data[data.length - 1]?.[s.key] || 0);
              const diffAccum = latestVal - firstVal;
              const pctAccum = firstVal > 0 ? (diffAccum / firstVal) * 100 : 0;

              return (
                <TableRow
                  key={`info-row-${s.key}`}
                  hover
                  sx={{
                    bgcolor: idx % 2 === 0 ? '#ffffff' : '#fcfdfe',
                    borderLeft: `4px solid ${s.color}`
                  }}
                >
                  <TableCell sx={{ py: 1.3 }}>
                    <Stack direction="row" spacing={1.2} alignItems="center">
                      <Box
                        sx={{
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          bgcolor: s.color,
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          fontWeight: 950,
                          fontSize: 10.5,
                          boxShadow: `0 3px 6px ${s.color}35`,
                          flexShrink: 0
                        }}
                      >
                        {s.short || s.label.slice(0, 2).toUpperCase()}
                      </Box>
                      <Typography sx={{ fontWeight: 900, color: s.color, fontSize: 12, textTransform: 'uppercase' }}>
                        {s.label}
                      </Typography>
                    </Stack>
                  </TableCell>

                  {data.map((d) => {
                    const val = Number(d[s.key] || 0);
                    return (
                      <TableCell
                        key={`cell-${s.key}-${d.periodo}`}
                        align="center"
                        sx={{
                          fontWeight: val > 0 ? 900 : 500,
                          color: val > 0 ? s.color : '#cbd5e1',
                          fontSize: 13,
                          py: 1.3
                        }}
                      >
                        {val > 0 ? numberFmt.format(val) : '—'}
                      </TableCell>
                    );
                  })}

                  <TableCell align="right" sx={{ fontWeight: 950, color: '#0f172a', fontSize: 13.5 }}>
                    {numberFmt.format(latestVal)}
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      size="small"
                      label={
                        diffAccum > 0
                          ? `+${diffAccum} (+${pctAccum.toFixed(1)}%)`
                          : diffAccum < 0
                          ? `${diffAccum} (${pctAccum.toFixed(1)}%)`
                          : '0.0%'
                      }
                      sx={{
                        fontWeight: 900,
                        fontSize: 10,
                        bgcolor: diffAccum > 0 ? '#dcfce7' : diffAccum < 0 ? '#fee2e2' : '#f1f5f9',
                        color: diffAccum > 0 ? '#15803d' : diffAccum < 0 ? '#b91c1c' : '#64748b'
                      }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

// ── COMPONENTE: BARRAS APILADAS DE COMPOSICIÓN TEMPORAL ──
const StackedCategoryBarsChart = ({ data, seriesConfig }) => {
  if (!data || !data.length || !seriesConfig || !seriesConfig.length) return null;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto', py: 0.5 }}>
      <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 450 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 32, right: 20, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="periodo" tick={<CustomPeriodAxisTick />} interval={0} height={52} />
            <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
            <RechartsTooltip content={<CustomChartTooltip showTotal={true} />} />
            <Legend
              verticalAlign="top"
              height={44}
              iconType="circle"
              iconSize={8}
              wrapperStyle={{ paddingBottom: 16, paddingTop: 2, fontSize: '11.5px', fontWeight: 800 }}
            />
            {seriesConfig.map((s) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color}>
                <LabelList
                  dataKey={s.key}
                  position="inside"
                  formatter={(val) => (Number(val) >= 15 ? val : '')}
                  style={{ fill: '#ffffff', fontSize: 10, fontWeight: 900 }}
                />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
};

// ── COMPONENTE: TARJETAS KANBAN DE PROYECCIÓN Y KPIs EJECUTIVOS ──
const CategoryKanbanCards = ({ data, seriesConfig }) => {
  if (!data || !data.length || !seriesConfig || !seriesConfig.length) return null;
  const seriesToRender = seriesConfig.filter((s) => data.some((d) => Number(d[s.key] || 0) > 0));
  if (seriesToRender.length === 0) return null;

  const latestRow = data[data.length - 1];
  const previousRow = data.length > 1 ? data[data.length - 2] : null;

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: 'repeat(2, 1fr)',
          md: `repeat(${Math.min(seriesToRender.length, 4)}, 1fr)`
        },
        gap: 2,
        py: 1
      }}
    >
      {seriesToRender.map((s) => {
        const values = data.map((d) => Number(d[s.key] || 0));
        const current = Number(latestRow?.[s.key] || 0);
        const prev = Number(previousRow?.[s.key] || 0);
        const diff = current - prev;
        const pct = prev > 0 ? (diff / prev) * 100 : 0;
        const maxVal = Math.max(...values, 0);
        const minVal = Math.min(...values.filter((v) => v > 0), current);
        const avgVal = Math.round(values.reduce((a, b) => a + b, 0) / Math.max(values.length, 1));

        return (
          <Paper
            key={`kanban-${s.key}`}
            elevation={0}
            sx={{
              p: 2.2,
              borderRadius: 3,
              bgcolor: '#ffffff',
              border: `1px solid ${s.color}35`,
              borderTop: `5px solid ${s.color}`,
              boxShadow: '0 6px 18px rgba(15, 23, 42, 0.04)',
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-3px)',
                boxShadow: `0 12px 28px ${s.color}22`
              }
            }}
          >
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.5 }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  bgcolor: s.color,
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center',
                  fontWeight: 950,
                  fontSize: 11
                }}
              >
                {s.short || s.label.slice(0, 2).toUpperCase()}
              </Box>
              <Typography
                sx={{
                  fontWeight: 900,
                  color: '#0f2942',
                  fontSize: 13,
                  lineHeight: 1.2,
                  textTransform: 'uppercase'
                }}
              >
                {s.label}
              </Typography>
            </Stack>

            <Typography sx={{ fontSize: 28, fontWeight: 950, color: s.color, lineHeight: 1 }}>
              {numberFmt.format(current)}
            </Typography>
            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
              Docentes en {latestRow?.periodo || 'período actual'}
            </Typography>

            <Box sx={{ mt: 1.5, pt: 1.2, borderTop: '1px solid #f1f5f9' }}>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
                <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Variación previa:</Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    fontWeight: 900,
                    color: diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#64748b'
                  }}
                >
                  {diff > 0 ? `+${diff} (+${pct.toFixed(1)}%)` : diff < 0 ? `${diff} (${pct.toFixed(1)}%)` : '0%'}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
                <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Pico Histórico (Máx):</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#0f2942' }}>
                  {numberFmt.format(maxVal)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.6 }}>
                <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Mínimo Registrado:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#0f2942' }}>
                  {numberFmt.format(minVal)}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>Promedio Multianual:</Typography>
                <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#0f2942' }}>
                  {numberFmt.format(avgVal)}
                </Typography>
              </Stack>
            </Box>
          </Paper>
        );
      })}
    </Box>
  );
};

// ── COMPONENTE PRINCIPAL DEL SEGMENTO HISTÓRICO ──
export default function RecursoHumanoHistoricoTab({ docenteRows = [] }) {
  const { enqueueSnackbar } = useSnackbar();

  // Refs para capturas de imagen
  const chartRef1 = useRef(null);
  const chartRef2 = useRef(null);
  const chartRef3 = useRef(null);
  const chartRef4 = useRef(null);
  const chartRef5 = useRef(null);

  // Catálogo ordenado de programas
  const programasDisponibles = useMemo(() => {
    const list = Array.from(
      new Set(docenteRows.map((r) => normalizeText(r.programa)).filter(Boolean))
    ).sort((a, b) => a.localeCompare(b, 'es'));
    return list;
  }, [docenteRows]);

  // Lista de todos los periodos cronológicos disponibles en la base de datos (100% dinámico)
  const todosLosPeriodos = useMemo(() => {
    const set = new Set();
    docenteRows.forEach((r) => {
      const p = getRowPeriodLabel(r);
      if (p) set.add(p);
    });
    return Array.from(set).sort((a, b) => parsePeriodOrder(a) - parsePeriodOrder(b));
  }, [docenteRows]);

  const primerPeriodo = todosLosPeriodos[0] || '';
  const ultimoPeriodo = todosLosPeriodos[todosLosPeriodos.length - 1] || '';

  // Periodo por defecto de inicio: desde 2016 IP si existe, o el primer registro disponible
  const periodoDefaultInicio = useMemo(() => {
    return todosLosPeriodos.find((p) => parsePeriodOrder(p) >= 20161) || primerPeriodo;
  }, [todosLosPeriodos, primerPeriodo]);

  // Estados de filtros
  const [selectedPrograma, setSelectedPrograma] = useState('');
  const [periodoDesde, setPeriodoDesde] = useState('');
  const [periodoHasta, setPeriodoHasta] = useState('');
  const [viewModes, setViewModes] = useState({
    total: 'chart',
    vinculacion: 'chart',
    contrato: 'chart',
    formacion: 'chart',
    escalafon: 'chart'
  });

  // Estados de visualización por bloque (Líneas, Carriles, Barras Apiladas, Infografía, Kanban)
  const [chartTypes, setChartTypes] = useState({
    total: 'bars',
    vinculacion: 'lines',
    contrato: 'lines',
    formacion: 'lines',
    escalafon: 'lines'
  });

  const toggleViewMode = (key, mode) => {
    setViewModes((prev) => ({ ...prev, [key]: mode }));
  };

  const setChartType = (key, type) => {
    setChartTypes((prev) => ({ ...prev, [key]: type }));
  };

  // Sincronización automática cuando carguen o se agreguen nuevos períodos/años a la base
  useEffect(() => {
    if (todosLosPeriodos.length > 0) {
      if (!periodoHasta || !todosLosPeriodos.includes(periodoHasta)) {
        setPeriodoHasta(ultimoPeriodo);
      }
      if (!periodoDesde || !todosLosPeriodos.includes(periodoDesde)) {
        setPeriodoDesde(periodoDefaultInicio);
      }
    }
  }, [todosLosPeriodos, ultimoPeriodo, periodoDefaultInicio, periodoDesde, periodoHasta]);

  // Filtrado de filas según el programa seleccionado
  const filteredDocentes = useMemo(() => {
    if (!selectedPrograma) return docenteRows;
    return docenteRows.filter((r) => normalizeText(r.programa) === selectedPrograma);
  }, [docenteRows, selectedPrograma]);

  // Agrupación y cálculo histórico de métricas (Réplica exacta de las medidas DAX)
  const metricasHistoricas = useMemo(() => {
    const periodMap = new Map();

    filteredDocentes.forEach((r) => {
      const pLabel = getRowPeriodLabel(r);
      if (!pLabel) return;

      if (!periodMap.has(pLabel)) {
        periodMap.set(pLabel, {
          periodo: pLabel,
          orden: parsePeriodOrder(pLabel),
          total: 0,
          // Tipo Vinculación (Dedicación)
          tc: 0,
          mt: 0,
          hc: 0,
          // Contratación
          semestral: 0,
          anual: 0,
          // Nivel de Formación
          doctorado: 0,
          magister: 0,
          especialista: 0,
          profesional: 0,
          // Escalafón
          titular: 0,
          asociado: 0,
          asistente: 0,
          auxiliar: 0,
          basico: 0,
          sinEscalafon: 0
        });
      }

      const item = periodMap.get(pLabel);
      const peso = Number(r.total_docentes || 0) > 0 ? Number(r.total_docentes) : 1;
      item.total += peso;

      // 1. Tipo Vinculación
      const vinc = normalizeUpper(r.tipo_vinculacion);
      if (vinc.includes('TIEMPO COMPLETO')) item.tc += peso;
      else if (vinc.includes('MEDIO TIEMPO')) item.mt += peso;
      else if (vinc.includes('HORA CATEDRA') || vinc.includes('CATEDRA')) item.hc += peso;

      // 2. Contrato
      const cont = normalizeUpper(r.contrato);
      if (cont.includes('SEMESTRAL')) item.semestral += peso;
      else if (cont.includes('ANUAL')) item.anual += peso;

      // 3. Nivel Máximo de Estudio
      const rawNivel = r.nivel_maximo_estudio || r.raw_data?.['NIVEL MAXIMO ESTUDIO'] || r.raw_data?.NIVEL_MAXIMO_ESTUDIO;
      const niv = normalizeUpper(rawNivel);
      if (niv.includes('DOCTOR')) item.doctorado += peso;
      else if (niv.includes('MAEST') || niv.includes('MAGIST') || niv.includes('MASTER')) item.magister += peso;
      else if (niv.includes('ESPECIAL')) item.especialista += peso;
      else if (niv.includes('UNIVERSIT') || niv.includes('PROFESIONAL') || niv.includes('PREGRADO')) item.profesional += peso;

      // 4. Escalafón
      const esc = normalizeUpper(r.escalafon);
      if (esc.includes('TITULAR')) item.titular += peso;
      else if (esc.includes('ASOCIADO')) item.asociado += peso;
      else if (esc.includes('ASISTENTE')) item.asistente += peso;
      else if (esc.includes('AUXILIAR')) item.auxiliar += peso;
      else if (esc.includes('BASIC') || esc.includes('INSTRUCTOR')) item.basico += peso;
      else item.sinEscalafon += peso;
    });

    // Ordenar y recortar por rango de periodos seleccionado
    const ordenDesde = periodoDesde ? parsePeriodOrder(periodoDesde) : 0;
    const ordenHasta = periodoHasta ? parsePeriodOrder(periodoHasta) : 999999;

    const list = Array.from(periodMap.values())
      .filter((p) => p.orden >= ordenDesde && p.orden <= ordenHasta)
      .sort((a, b) => a.orden - b.orden);

    // Calcular variaciones respecto al periodo previo
    list.forEach((item, idx) => {
      if (idx === 0) {
        item.diffTotal = 0;
        item.pctGrowth = 0;
      } else {
        const prev = list[idx - 1];
        item.diffTotal = item.total - prev.total;
        item.pctGrowth = prev.total > 0 ? ((item.total - prev.total) / prev.total) * 100 : 0;
      }
      // Porcentajes de Vinculación
      item.pctTc = item.total > 0 ? (item.tc / item.total) * 100 : 0;
      item.pctMt = item.total > 0 ? (item.mt / item.total) * 100 : 0;
      item.pctHc = item.total > 0 ? (item.hc / item.total) * 100 : 0;

      // Porcentajes de Contrato
      const totalContratos = item.semestral + item.anual;
      item.pctSemestral = totalContratos > 0 ? (item.semestral / totalContratos) * 100 : 0;
      item.pctAnual = totalContratos > 0 ? (item.anual / totalContratos) * 100 : 0;

      // Posgrado
      const posgrados = item.doctorado + item.magister + item.especialista;
      item.pctPosgrado = item.total > 0 ? (posgrados / item.total) * 100 : 0;
    });

    return list;
  }, [filteredDocentes, periodoDesde, periodoHasta]);

  // Exportar consolidado a Excel con múltiples hojas
  const exportAllToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Hoja 1: Total Docentes
      const wsTotal = XLSX.utils.json_to_sheet(
        metricasHistoricas.map((r) => ({
          'Período Académico': r.periodo,
          'Total Docentes': r.total,
          'Variación Neta': r.diffTotal,
          'Crecimiento %': `${r.pctGrowth.toFixed(1)}%`
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsTotal, 'Total Docentes');

      // Hoja 2: Vinculación
      const wsVinc = XLSX.utils.json_to_sheet(
        metricasHistoricas.map((r) => ({
          'Período Académico': r.periodo,
          'Tiempo Completo': r.tc,
          '% TC': `${r.pctTc.toFixed(1)}%`,
          'Medio Tiempo': r.mt,
          '% MT': `${r.pctMt.toFixed(1)}%`,
          'Hora Cátedra': r.hc,
          '% HC': `${r.pctHc.toFixed(1)}%`,
          'Total': r.total
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsVinc, 'Tipo Vinculación');

      // Hoja 3: Contratación
      const wsCont = XLSX.utils.json_to_sheet(
        metricasHistoricas.map((r) => ({
          'Período Académico': r.periodo,
          'Semestral': r.semestral,
          '% Semestral': `${r.pctSemestral.toFixed(1)}%`,
          'Anual': r.anual,
          '% Anual': `${r.pctAnual.toFixed(1)}%`,
          'Total': r.semestral + r.anual
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsCont, 'Contratación');

      // Hoja 4: Nivel de Formación
      const wsForm = XLSX.utils.json_to_sheet(
        metricasHistoricas.map((r) => ({
          'Período Académico': r.periodo,
          'Doctorado': r.doctorado,
          'Magíster': r.magister,
          'Especialista': r.especialista,
          'Profesional': r.profesional,
          'Total': r.total,
          '% Posgrado': `${r.pctPosgrado.toFixed(1)}%`
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsForm, 'Nivel Formación');

      // Hoja 5: Escalafón
      const wsEsc = XLSX.utils.json_to_sheet(
        metricasHistoricas.map((r) => ({
          'Período Académico': r.periodo,
          'Titular': r.titular,
          'Asociado': r.asociado,
          'Asistente': r.asistente,
          'Auxiliar': r.auxiliar,
          'Básico / Instructor': r.basico,
          'Total': r.total
        }))
      );
      XLSX.utils.book_append_sheet(wb, wsEsc, 'Escalafón');

      const fileName = `Historico_Docentes_UNICESMAG_${selectedPrograma ? selectedPrograma.replace(/\s+/g, '_') : 'Institucional'}.xlsx`;
      XLSX.writeFile(wb, fileName);
      enqueueSnackbar('Archivo Excel generado con éxito', { variant: 'success' });
    } catch {
      enqueueSnackbar('Error al exportar a Excel', { variant: 'error' });
    }
  };

  // Resumen ejecutivo del periodo más reciente disponible
  const latestMetric = metricasHistoricas[metricasHistoricas.length - 1] || null;

  return (
    <Box sx={{ mt: 2 }}>
      {/* ── PANEL DE FILTROS HISTÓRICOS ── */}
      <Paper
        elevation={0}
        sx={{
          mb: 3,
          p: { xs: 2, md: 2.5 },
          borderRadius: 2.8,
          border: '1px solid #c5d9f7',
          background: 'linear-gradient(180deg, #ffffff 0%, #f6faff 100%)',
          boxShadow: '0 4px 18px rgba(31, 115, 232, 0.06)'
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2}
          sx={{ mb: 2, pb: 1.5, borderBottom: '1px solid #e0edff' }}
        >
          <Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: BRAND_BLUE }} />
              <Typography sx={{ fontSize: 13, fontWeight: 900, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                Filtros del Histórico Profesores
              </Typography>
            </Stack>
            <Typography variant="body2" sx={{ color: '#64748b', fontSize: 12.5, mt: 0.3 }}>
              Selecciona el programa académico o rango de períodos para recalcular automáticamente las series y matrices estadísticas.
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Button
              variant="outlined"
              size="small"
              startIcon={<DownloadIcon />}
              onClick={exportAllToExcel}
              sx={{
                borderRadius: 1.8,
                fontWeight: 800,
                color: BRAND_BLUE,
                borderColor: '#bfdbfe',
                bgcolor: '#ffffff',
                '&:hover': { bgcolor: '#eff6ff', borderColor: BRAND_BLUE }
              }}
            >
              Exportar Todo a Excel
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', lg: '2fr 1.2fr 1.2fr auto' },
            gap: 1.5,
            alignItems: 'center'
          }}
        >
          {/* Selector de Programa */}
          <FormControl size="small" fullWidth>
            <InputLabel>Programa Académico</InputLabel>
            <Select
              value={selectedPrograma}
              label="Programa Académico"
              onChange={(e) => setSelectedPrograma(e.target.value)}
              sx={{ bgcolor: '#ffffff', borderRadius: 1.8, fontWeight: 700 }}
            >
              <MenuItem value="">
                <em>Todos los programas (Consolidado Institucional)</em>
              </MenuItem>
              {programasDisponibles.map((prog) => (
                <MenuItem key={prog} value={prog}>
                  {prog}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Selector Período Desde */}
          <FormControl size="small" fullWidth>
            <InputLabel>Desde Período</InputLabel>
            <Select
              value={periodoDesde}
              label="Desde Período"
              onChange={(e) => setPeriodoDesde(e.target.value)}
              sx={{ bgcolor: '#ffffff', borderRadius: 1.8, fontWeight: 700 }}
            >
              {todosLosPeriodos.map((p) => (
                <MenuItem key={`desde-${p}`} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Selector Período Hasta */}
          <FormControl size="small" fullWidth>
            <InputLabel>Hasta Período</InputLabel>
            <Select
              value={periodoHasta}
              label="Hasta Período"
              onChange={(e) => setPeriodoHasta(e.target.value)}
              sx={{ bgcolor: '#ffffff', borderRadius: 1.8, fontWeight: 700 }}
            >
              {todosLosPeriodos.map((p) => (
                <MenuItem key={`hasta-${p}`} value={p}>
                  {p}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Limpiar Filtros */}
          <Button
            variant="outlined"
            onClick={() => {
              setSelectedPrograma('');
              setPeriodoDesde(periodoDefaultInicio);
              setPeriodoHasta(ultimoPeriodo);
            }}
            title="Restablecer filtros"
            sx={{
              minWidth: 44,
              height: 40,
              bgcolor: '#ffffff',
              borderRadius: 1.8,
              borderColor: '#c5d9f7',
              color: BRAND_BLUE
            }}
          >
            <FilterAltOffIcon fontSize="small" />
          </Button>
        </Box>

        {/* Chips de Resumen Rápido */}
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 1.8, flexWrap: 'wrap' }}>
          <Chip
            size="small"
            label={`Períodos analizados: ${metricasHistoricas.length}`}
            sx={{ bgcolor: '#e0edff', color: BRAND_NAVY, fontWeight: 800, fontSize: 11 }}
          />
          <Chip
            size="small"
            label={`Programa: ${selectedPrograma || 'Institucional (Todos)'}`}
            sx={{ bgcolor: '#eff6ff', color: BRAND_BLUE, fontWeight: 800, border: '1px solid #bfdbfe', fontSize: 11 }}
          />
          {latestMetric && (
            <Chip
              size="small"
              label={`Último corte (${latestMetric.periodo}): ${numberFmt.format(latestMetric.total)} docentes`}
              sx={{ bgcolor: '#f0fdf4', color: '#166534', fontWeight: 800, border: '1px solid #bbf7d0', fontSize: 11 }}
            />
          )}
        </Stack>
      </Paper>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOQUE 1: TOTAL DOCENTES (Lámina 2 - Barras Institucionales)
      ════════════════════════════════════════════════════════════════════════ */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2.8,
          border: '1px solid #dbeafe',
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
          overflow: 'hidden'
        }}
      >
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  bgcolor: BRAND_NAVY,
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <SchoolIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 950, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Total Docentes (Evolución de Planta)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Consolidado multianual de profesores por período académico
                </Typography>
              </Box>
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1} alignItems="center" data-no-export>
              <ButtonGroup size="small" variant="outlined" sx={{ bgcolor: '#ffffff' }}>
                <Button
                  onClick={() => toggleViewMode('total', 'chart')}
                  variant={viewModes.total === 'chart' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <BarChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Gráfico
                </Button>
                <Button
                  onClick={() => toggleViewMode('total', 'table')}
                  variant={viewModes.total === 'table' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Tabla
                </Button>
                <Button
                  onClick={() => toggleViewMode('total', 'both')}
                  variant={viewModes.total === 'both' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ViewAgendaIcon sx={{ fontSize: 16, mr: 0.5 }} /> Ambos
                </Button>
              </ButtonGroup>

              <MuiTooltip title="Copiar gráfico como imagen">
                <IconButton size="small" onClick={() => copyChartImage(chartRef1.current, enqueueSnackbar)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </Stack>
          }
          sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', py: 1.5, px: 2.2 }}
        />

        <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
          {/* Gráficos y Visualizaciones de Total Docentes */}
          {(viewModes.total === 'chart' || viewModes.total === 'both') && (
            <Box sx={{ mb: viewModes.total === 'both' ? 3 : 0 }}>
              <ChartTypeSelector
                currentType={chartTypes.total}
                onSelect={(t) => setChartType('total', t)}
                availableTypes={['bars', 'area', 'kanban']}
              />

              <Box ref={chartRef1} sx={{ bgcolor: '#ffffff', p: 0.5, borderRadius: 2 }}>
                {chartTypes.total === 'bars' && (
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 430 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metricasHistoricas} margin={{ top: 28, right: 15, left: 0, bottom: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="periodo"
                            tick={<CustomPeriodAxisTick />}
                            interval={0}
                            height={52}
                          />
                          <YAxis
                            domain={[0, (dataMax) => Math.ceil(dataMax * 1.18)]}
                            tick={{ fill: '#64748b', fontSize: 11 }}
                          />
                          <RechartsTooltip content={<CustomChartTooltip showTotal={false} />} />
                          <Bar dataKey="total" name="Total Docentes" fill={BRAND_NAVY} radius={[5, 5, 0, 0]}>
                            <LabelList
                              dataKey="total"
                              position="top"
                              style={{ fill: BRAND_NAVY, fontSize: 11.5, fontWeight: 900 }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {chartTypes.total === 'area' && (
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 430 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={metricasHistoricas} margin={{ top: 28, right: 15, left: 0, bottom: 10 }}>
                          <defs>
                            <linearGradient id="grad-total-area" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={BRAND_NAVY} stopOpacity={0.28} />
                              <stop offset="95%" stopColor={BRAND_NAVY} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis dataKey="periodo" tick={<CustomPeriodAxisTick />} interval={0} height={52} />
                          <YAxis domain={[0, (dataMax) => Math.ceil(dataMax * 1.18)]} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <RechartsTooltip content={<CustomChartTooltip showTotal={false} />} />
                          <Area
                            type="linear"
                            dataKey="total"
                            name="Total Docentes"
                            stroke={BRAND_NAVY}
                            strokeWidth={2.8}
                            fill="url(#grad-total-area)"
                            dot={{ fill: BRAND_NAVY, r: 4.5, stroke: '#ffffff', strokeWidth: 2 }}
                            activeDot={{ r: 6.5 }}
                          >
                            <LabelList dataKey="total" position="top" style={{ fill: BRAND_NAVY, fontSize: 11.5, fontWeight: 900 }} />
                          </Area>
                        </AreaChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {chartTypes.total === 'kanban' && (
                  <CategoryKanbanCards data={metricasHistoricas} seriesConfig={SERIES_TOTAL} />
                )}
              </Box>
            </Box>
          )}

          {/* Tabla Estadística */}
          {(viewModes.total === 'table' || viewModes.total === 'both') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} data-no-export>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>
                  Matriz Estadística: Total de Docentes
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() =>
                    copyTableData(
                      ['Período', 'Total Docentes', 'Diferencia (±)', 'Variación %'],
                      metricasHistoricas.map((r) => ({
                        'Período': r.periodo,
                        'Total Docentes': r.total,
                        'Diferencia (±)': r.diffTotal,
                        'Variación %': `${r.pctGrowth.toFixed(1)}%`
                      })),
                      enqueueSnackbar
                    )
                  }
                  sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700 }}
                >
                  Copiar tabla
                </Button>
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: BRAND_NAVY }}>Período Académico</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Total Docentes</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Diferencia (±)</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Variación %</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Tendencia</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metricasHistoricas.map((row) => (
                      <TableRow key={`row-total-${row.periodo}`} hover>
                        <TableCell sx={{ fontWeight: 750, color: '#1e293b' }}>{row.periodo}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 850, color: BRAND_NAVY, fontSize: 13 }}>
                          {numberFmt.format(row.total)}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 750,
                            color: row.diffTotal > 0 ? '#16a34a' : row.diffTotal < 0 ? '#dc2626' : '#64748b'
                          }}
                        >
                          {row.diffTotal > 0 ? `+${row.diffTotal}` : row.diffTotal}
                        </TableCell>
                        <TableCell
                          align="right"
                          sx={{
                            fontWeight: 750,
                            color: row.pctGrowth > 0 ? '#16a34a' : row.pctGrowth < 0 ? '#dc2626' : '#64748b'
                          }}
                        >
                          {row.pctGrowth > 0 ? `+${row.pctGrowth.toFixed(1)}%` : `${row.pctGrowth.toFixed(1)}%`}
                        </TableCell>
                        <TableCell align="center">
                          {row.pctGrowth > 0 ? (
                            <TrendingUpIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                          ) : row.pctGrowth < 0 ? (
                            <TrendingDownIcon sx={{ color: '#dc2626', fontSize: 18 }} />
                          ) : (
                            <TrendingFlatIcon sx={{ color: '#64748b', fontSize: 18 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOQUE 2: TIPO DE VINCULACIÓN (Lámina 3 - Dedicación)
      ════════════════════════════════════════════════════════════════════════ */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2.8,
          border: '1px solid #dbeafe',
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
          overflow: 'hidden'
        }}
      >
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  bgcolor: BRAND_BURGUNDY,
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <WorkIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 950, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Tipo de Vinculación (Dedicación Docente)
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Tiempo Completo, Medio Tiempo y Hora Cátedra
                </Typography>
              </Box>
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1} alignItems="center" data-no-export>
              <ButtonGroup size="small" variant="outlined" sx={{ bgcolor: '#ffffff' }}>
                <Button
                  onClick={() => toggleViewMode('vinculacion', 'chart')}
                  variant={viewModes.vinculacion === 'chart' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ShowChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Gráfico
                </Button>
                <Button
                  onClick={() => toggleViewMode('vinculacion', 'table')}
                  variant={viewModes.vinculacion === 'table' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Tabla
                </Button>
                <Button
                  onClick={() => toggleViewMode('vinculacion', 'both')}
                  variant={viewModes.vinculacion === 'both' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ViewAgendaIcon sx={{ fontSize: 16, mr: 0.5 }} /> Ambos
                </Button>
              </ButtonGroup>

              <MuiTooltip title="Copiar gráfico como imagen">
                <IconButton size="small" onClick={() => copyChartImage(chartRef2.current, enqueueSnackbar)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </Stack>
          }
          sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', py: 1.5, px: 2.2 }}
        />

        <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
          {(viewModes.vinculacion === 'chart' || viewModes.vinculacion === 'both') && (
            <Box sx={{ mb: viewModes.vinculacion === 'both' ? 3 : 0 }}>
              <ChartTypeSelector
                currentType={chartTypes.vinculacion}
                onSelect={(t) => setChartType('vinculacion', t)}
                availableTypes={['lines', 'tracks', 'stacked', 'infographic', 'kanban']}
              />

              <Box ref={chartRef2} sx={{ bgcolor: '#ffffff', p: 0.5, borderRadius: 2 }}>
                {chartTypes.vinculacion === 'lines' && (
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 460 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricasHistoricas} margin={{ top: 32, right: 20, left: 0, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="periodo"
                            tick={<CustomPeriodAxisTick />}
                            interval={0}
                            height={52}
                          />
                          <YAxis domain={[0, (dataMax) => Math.max(Math.ceil(dataMax * 1.25), 20)]} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <RechartsTooltip content={<CustomChartTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={44}
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ paddingBottom: 16, paddingTop: 2, fontSize: '11.5px', fontWeight: 800 }}
                          />
                        
                        {/* TIEMPO COMPLETO (Vinotinto) */}
                        <Line
                          type="linear"
                          dataKey="tc"
                          name="TIEMPO COMPLETO"
                          stroke={BRAND_BURGUNDY}
                          strokeWidth={2.5}
                          dot={{ fill: BRAND_BURGUNDY, r: 4 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList content={renderSmartLabel('tc', ['tc', 'mt', 'hc'], metricasHistoricas, BRAND_BURGUNDY)} />
                        </Line>

                        {/* MEDIO TIEMPO (Gris oscuro) */}
                        <Line
                          type="linear"
                          dataKey="mt"
                          name="MEDIO TIEMPO"
                          stroke={BRAND_SLATE}
                          strokeWidth={2.2}
                          dot={{ fill: BRAND_SLATE, r: 4 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList content={renderSmartLabel('mt', ['tc', 'mt', 'hc'], metricasHistoricas, BRAND_SLATE)} />
                        </Line>

                        {/* HORA CÁTEDRA (Azul cian) */}
                        <Line
                          type="linear"
                          dataKey="hc"
                          name="HORA CATEDRA"
                          stroke={BRAND_CYAN}
                          strokeWidth={2.2}
                          dot={{ fill: BRAND_CYAN, r: 4 }}
                          activeDot={{ r: 6 }}
                        >
                          <LabelList content={renderSmartLabel('hc', ['tc', 'mt', 'hc'], metricasHistoricas, BRAND_CYAN)} />
                        </Line>
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Box>
              )}

              {chartTypes.vinculacion === 'tracks' && (
                <CategoryTracksChart data={metricasHistoricas} seriesConfig={SERIES_VINCULACION} />
              )}

              {chartTypes.vinculacion === 'stacked' && (
                <StackedCategoryBarsChart data={metricasHistoricas} seriesConfig={SERIES_VINCULACION} />
              )}

              {chartTypes.vinculacion === 'infographic' && (
                <InfographicMatrixTable data={metricasHistoricas} seriesConfig={SERIES_VINCULACION} />
              )}

              {chartTypes.vinculacion === 'kanban' && (
                <CategoryKanbanCards data={metricasHistoricas} seriesConfig={SERIES_VINCULACION} />
              )}
            </Box>
          </Box>
        )}

          {(viewModes.vinculacion === 'table' || viewModes.vinculacion === 'both') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} data-no-export>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>
                  Matriz Estadística: Dedicación / Tipo de Vinculación
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() =>
                    copyTableData(
                      ['Período', 'Tiempo Completo', '% TC', 'Medio Tiempo', '% MT', 'Hora Cátedra', '% HC', 'Total'],
                      metricasHistoricas.map((r) => ({
                        'Período': r.periodo,
                        'Tiempo Completo': r.tc,
                        '% TC': `${r.pctTc.toFixed(1)}%`,
                        'Medio Tiempo': r.mt,
                        '% MT': `${r.pctMt.toFixed(1)}%`,
                        'Hora Cátedra': r.hc,
                        '% HC': `${r.pctHc.toFixed(1)}%`,
                        'Total': r.total
                      })),
                      enqueueSnackbar
                    )
                  }
                  sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700 }}
                >
                  Copiar tabla
                </Button>
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: BRAND_NAVY }}>Período</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_BURGUNDY }}>Tiempo Completo</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_BURGUNDY }}>% TC</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_SLATE }}>Medio Tiempo</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_SLATE }}>% MT</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_CYAN }}>Hora Cátedra</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_CYAN }}>% HC</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metricasHistoricas.map((row) => (
                      <TableRow key={`row-vinc-${row.periodo}`} hover>
                        <TableCell sx={{ fontWeight: 750, color: '#1e293b' }}>{row.periodo}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_BURGUNDY }}>{numberFmt.format(row.tc)}</TableCell>
                        <TableCell align="right" sx={{ color: '#64748b', fontSize: 11.5 }}>{percentFmt(row.pctTc)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_SLATE }}>{numberFmt.format(row.mt)}</TableCell>
                        <TableCell align="right" sx={{ color: '#64748b', fontSize: 11.5 }}>{percentFmt(row.pctMt)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_CYAN }}>{numberFmt.format(row.hc)}</TableCell>
                        <TableCell align="right" sx={{ color: '#64748b', fontSize: 11.5 }}>{percentFmt(row.pctHc)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>{numberFmt.format(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOQUE 3: CONTRATACIÓN (Lámina 4 - Semestral vs Anual)
      ════════════════════════════════════════════════════════════════════════ */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2.8,
          border: '1px solid #dbeafe',
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
          overflow: 'hidden'
        }}
      >
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  bgcolor: '#b91c1c',
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <WorkIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 950, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Modalidad de Contratación
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Contratación Anual vs Semestral
                </Typography>
              </Box>
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1} alignItems="center" data-no-export>
              <ButtonGroup size="small" variant="outlined" sx={{ bgcolor: '#ffffff' }}>
                <Button
                  onClick={() => toggleViewMode('contrato', 'chart')}
                  variant={viewModes.contrato === 'chart' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ShowChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Gráfico
                </Button>
                <Button
                  onClick={() => toggleViewMode('contrato', 'table')}
                  variant={viewModes.contrato === 'table' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Tabla
                </Button>
                <Button
                  onClick={() => toggleViewMode('contrato', 'both')}
                  variant={viewModes.contrato === 'both' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ViewAgendaIcon sx={{ fontSize: 16, mr: 0.5 }} /> Ambos
                </Button>
              </ButtonGroup>

              <MuiTooltip title="Copiar gráfico como imagen">
                <IconButton size="small" onClick={() => copyChartImage(chartRef3.current, enqueueSnackbar)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </Stack>
          }
          sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', py: 1.5, px: 2.2 }}
        />

        <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
          {(viewModes.contrato === 'chart' || viewModes.contrato === 'both') && (
            <Box sx={{ mb: viewModes.contrato === 'both' ? 3 : 0 }}>
              <ChartTypeSelector
                currentType={chartTypes.contrato}
                onSelect={(t) => setChartType('contrato', t)}
                availableTypes={['lines', 'tracks', 'stacked', 'infographic', 'kanban']}
              />

              <Box ref={chartRef3} sx={{ bgcolor: '#ffffff', p: 0.5, borderRadius: 2 }}>
                {chartTypes.contrato === 'lines' && (
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 460 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricasHistoricas} margin={{ top: 32, right: 20, left: 0, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="periodo"
                            tick={<CustomPeriodAxisTick />}
                            interval={0}
                            height={52}
                          />
                          <YAxis domain={[0, (dataMax) => Math.max(Math.ceil(dataMax * 1.25), 20)]} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <RechartsTooltip content={<CustomChartTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={44}
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ paddingBottom: 16, paddingTop: 2, fontSize: '11.5px', fontWeight: 800 }}
                          />

                          {/* SEMESTRAL (Vinotinto) */}
                          <Line
                            type="linear"
                            dataKey="semestral"
                            name="SEMESTRAL"
                            stroke={BRAND_BURGUNDY}
                            strokeWidth={2.6}
                            dot={{ fill: BRAND_BURGUNDY, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList content={renderSmartLabel('semestral', ['semestral', 'anual'], metricasHistoricas, BRAND_BURGUNDY)} />
                          </Line>

                          {/* ANUAL (Gris grafito) */}
                          <Line
                            type="linear"
                            dataKey="anual"
                            name="ANUAL"
                            stroke={BRAND_SLATE}
                            strokeWidth={2.4}
                            dot={{ fill: BRAND_SLATE, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList content={renderSmartLabel('anual', ['semestral', 'anual'], metricasHistoricas, BRAND_SLATE)} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {chartTypes.contrato === 'tracks' && (
                  <CategoryTracksChart data={metricasHistoricas} seriesConfig={SERIES_CONTRATACION} />
                )}

                {chartTypes.contrato === 'stacked' && (
                  <StackedCategoryBarsChart data={metricasHistoricas} seriesConfig={SERIES_CONTRATACION} />
                )}

                {chartTypes.contrato === 'infographic' && (
                  <InfographicMatrixTable data={metricasHistoricas} seriesConfig={SERIES_CONTRATACION} />
                )}

                {chartTypes.contrato === 'kanban' && (
                  <CategoryKanbanCards data={metricasHistoricas} seriesConfig={SERIES_CONTRATACION} />
                )}
              </Box>
            </Box>
          )}

          {(viewModes.contrato === 'table' || viewModes.contrato === 'both') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} data-no-export>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>
                  Matriz Estadística: Modalidad de Contratación
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() =>
                    copyTableData(
                      ['Período', 'Semestral', '% Semestral', 'Anual', '% Anual', 'Total'],
                      metricasHistoricas.map((r) => ({
                        'Período': r.periodo,
                        'Semestral': r.semestral,
                        '% Semestral': `${r.pctSemestral.toFixed(1)}%`,
                        'Anual': r.anual,
                        '% Anual': `${r.pctAnual.toFixed(1)}%`,
                        'Total': r.semestral + r.anual
                      })),
                      enqueueSnackbar
                    )
                  }
                  sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700 }}
                >
                  Copiar tabla
                </Button>
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: BRAND_NAVY }}>Período</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_BURGUNDY }}>Semestral</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_BURGUNDY }}>% Semestral</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_SLATE }}>Anual</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_SLATE }}>% Anual</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metricasHistoricas.map((row) => (
                      <TableRow key={`row-cont-${row.periodo}`} hover>
                        <TableCell sx={{ fontWeight: 750, color: '#1e293b' }}>{row.periodo}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_BURGUNDY }}>{numberFmt.format(row.semestral)}</TableCell>
                        <TableCell align="right" sx={{ color: '#64748b', fontSize: 11.5 }}>{percentFmt(row.pctSemestral)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_SLATE }}>{numberFmt.format(row.anual)}</TableCell>
                        <TableCell align="right" sx={{ color: '#64748b', fontSize: 11.5 }}>{percentFmt(row.pctAnual)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>{numberFmt.format(row.semestral + row.anual)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOQUE 4: NIVEL DE FORMACIÓN (Lámina 5 - Posgrados y Pregrado)
      ════════════════════════════════════════════════════════════════════════ */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2.8,
          border: '1px solid #dbeafe',
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
          overflow: 'hidden'
        }}
      >
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  bgcolor: BRAND_EMERALD,
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <SchoolIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 950, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Nivel de Formación Académica
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Doctorado, Maestría, Especialización y Pregrado / Profesional
                </Typography>
              </Box>
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1} alignItems="center" data-no-export>
              <ButtonGroup size="small" variant="outlined" sx={{ bgcolor: '#ffffff' }}>
                <Button
                  onClick={() => toggleViewMode('formacion', 'chart')}
                  variant={viewModes.formacion === 'chart' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ShowChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Gráfico
                </Button>
                <Button
                  onClick={() => toggleViewMode('formacion', 'table')}
                  variant={viewModes.formacion === 'table' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Tabla
                </Button>
                <Button
                  onClick={() => toggleViewMode('formacion', 'both')}
                  variant={viewModes.formacion === 'both' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ViewAgendaIcon sx={{ fontSize: 16, mr: 0.5 }} /> Ambos
                </Button>
              </ButtonGroup>

              <MuiTooltip title="Copiar gráfico como imagen">
                <IconButton size="small" onClick={() => copyChartImage(chartRef4.current, enqueueSnackbar)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </Stack>
          }
          sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', py: 1.5, px: 2.2 }}
        />

        <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
          {(viewModes.formacion === 'chart' || viewModes.formacion === 'both') && (
            <Box sx={{ mb: viewModes.formacion === 'both' ? 3 : 0 }}>
              <ChartTypeSelector
                currentType={chartTypes.formacion}
                onSelect={(t) => setChartType('formacion', t)}
                availableTypes={['lines', 'tracks', 'stacked', 'infographic', 'kanban']}
              />

              <Box ref={chartRef4} sx={{ bgcolor: '#ffffff', p: 0.5, borderRadius: 2 }}>
                {chartTypes.formacion === 'lines' && (
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 460 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricasHistoricas} margin={{ top: 32, right: 20, left: 0, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="periodo"
                            tick={<CustomPeriodAxisTick />}
                            interval={0}
                            height={52}
                          />
                          <YAxis domain={[0, (dataMax) => Math.max(Math.ceil(dataMax * 1.25), 20)]} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <RechartsTooltip content={<CustomChartTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={44}
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ paddingBottom: 16, paddingTop: 2, fontSize: '11.5px', fontWeight: 800 }}
                          />

                          {/* MAGISTER (Vinotinto) */}
                          <Line
                            type="linear"
                            dataKey="magister"
                            name="NIVEL FORMACIÓN MAGISTER"
                            stroke={BRAND_BURGUNDY}
                            strokeWidth={2.6}
                            dot={{ fill: BRAND_BURGUNDY, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList content={renderSmartLabel('magister', ['magister', 'especialista', 'profesional', 'doctorado'], metricasHistoricas, BRAND_BURGUNDY)} />
                          </Line>

                          {/* ESPECIALISTA (Azul marino) */}
                          <Line
                            type="linear"
                            dataKey="especialista"
                            name="NIVEL FORMACIÓN ESPECIALISTA"
                            stroke={BRAND_NAVY}
                            strokeWidth={2.4}
                            dot={{ fill: BRAND_NAVY, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList content={renderSmartLabel('especialista', ['magister', 'especialista', 'profesional', 'doctorado'], metricasHistoricas, BRAND_NAVY)} />
                          </Line>

                          {/* PROFESIONAL (Gris pizarra) */}
                          <Line
                            type="linear"
                            dataKey="profesional"
                            name="NIVEL FORMACIÓN PROFESIONAL"
                            stroke={BRAND_SLATE}
                            strokeWidth={2.2}
                            dot={{ fill: BRAND_SLATE, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList content={renderSmartLabel('profesional', ['magister', 'especialista', 'profesional', 'doctorado'], metricasHistoricas, BRAND_SLATE)} />
                          </Line>

                          {/* DOCTORADO (Verde menta / esmeralda) */}
                          <Line
                            type="linear"
                            dataKey="doctorado"
                            name="NIVEL FORMACIÓN DOCTORADO"
                            stroke={BRAND_EMERALD}
                            strokeWidth={2.2}
                            dot={{ fill: BRAND_EMERALD, r: 4 }}
                            activeDot={{ r: 6 }}
                          >
                            <LabelList content={renderSmartLabel('doctorado', ['magister', 'especialista', 'profesional', 'doctorado'], metricasHistoricas, BRAND_EMERALD)} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {chartTypes.formacion === 'tracks' && (
                  <CategoryTracksChart data={metricasHistoricas} seriesConfig={SERIES_FORMACION} />
                )}

                {chartTypes.formacion === 'stacked' && (
                  <StackedCategoryBarsChart data={metricasHistoricas} seriesConfig={SERIES_FORMACION} />
                )}

                {chartTypes.formacion === 'infographic' && (
                  <InfographicMatrixTable data={metricasHistoricas} seriesConfig={SERIES_FORMACION} />
                )}

                {chartTypes.formacion === 'kanban' && (
                  <CategoryKanbanCards data={metricasHistoricas} seriesConfig={SERIES_FORMACION} />
                )}
              </Box>
            </Box>
          )}

          {(viewModes.formacion === 'table' || viewModes.formacion === 'both') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} data-no-export>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>
                  Matriz Estadística: Nivel de Formación
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() =>
                    copyTableData(
                      ['Período', 'Doctorado', 'Magíster', 'Especialista', 'Profesional', 'Total', '% Posgrado'],
                      metricasHistoricas.map((r) => ({
                        'Período': r.periodo,
                        'Doctorado': r.doctorado,
                        'Magíster': r.magister,
                        'Especialista': r.especialista,
                        'Profesional': r.profesional,
                        'Total': r.total,
                        '% Posgrado': `${r.pctPosgrado.toFixed(1)}%`
                      })),
                      enqueueSnackbar
                    )
                  }
                  sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700 }}
                >
                  Copiar tabla
                </Button>
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: BRAND_NAVY }}>Período</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_EMERALD }}>Doctorado</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_BURGUNDY }}>Magíster</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Especialista</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_SLATE }}>Profesional</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Total</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: '#15803d' }}>% Con Posgrado</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metricasHistoricas.map((row) => (
                      <TableRow key={`row-form-${row.periodo}`} hover>
                        <TableCell sx={{ fontWeight: 750, color: '#1e293b' }}>{row.periodo}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_EMERALD }}>{numberFmt.format(row.doctorado)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_BURGUNDY }}>{numberFmt.format(row.magister)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_NAVY }}>{numberFmt.format(row.especialista)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_SLATE }}>{numberFmt.format(row.profesional)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>{numberFmt.format(row.total)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 850, color: '#15803d' }}>{percentFmt(row.pctPosgrado)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ════════════════════════════════════════════════════════════════════════
          BLOQUE 5: ESCALAFÓN DOCENTE (Asociado, Asistente, Auxiliar, Básico)
      ════════════════════════════════════════════════════════════════════════ */}
      <Card
        elevation={0}
        sx={{
          mb: 3,
          borderRadius: 2.8,
          border: '1px solid #dbeafe',
          boxShadow: '0 8px 24px rgba(15,23,42,0.04)',
          overflow: 'hidden'
        }}
      >
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={1.2}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: 1.5,
                  bgcolor: BRAND_PURPLE,
                  color: '#ffffff',
                  display: 'grid',
                  placeItems: 'center'
                }}
              >
                <SchoolIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 15, fontWeight: 950, color: BRAND_NAVY, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Escalafón Docente
                </Typography>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  Titular, Asociado, Asistente, Auxiliar y Básico
                </Typography>
              </Box>
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1} alignItems="center" data-no-export>
              <ButtonGroup size="small" variant="outlined" sx={{ bgcolor: '#ffffff' }}>
                <Button
                  onClick={() => toggleViewMode('escalafon', 'chart')}
                  variant={viewModes.escalafon === 'chart' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ShowChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Gráfico
                </Button>
                <Button
                  onClick={() => toggleViewMode('escalafon', 'table')}
                  variant={viewModes.escalafon === 'table' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <TableChartIcon sx={{ fontSize: 16, mr: 0.5 }} /> Tabla
                </Button>
                <Button
                  onClick={() => toggleViewMode('escalafon', 'both')}
                  variant={viewModes.escalafon === 'both' ? 'contained' : 'outlined'}
                  sx={{ textTransform: 'none', fontWeight: 750, fontSize: 11.5 }}
                >
                  <ViewAgendaIcon sx={{ fontSize: 16, mr: 0.5 }} /> Ambos
                </Button>
              </ButtonGroup>

              <MuiTooltip title="Copiar gráfico como imagen">
                <IconButton size="small" onClick={() => copyChartImage(chartRef5.current, enqueueSnackbar)}>
                  <ContentCopyIcon fontSize="small" />
                </IconButton>
              </MuiTooltip>
            </Stack>
          }
          sx={{ bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', py: 1.5, px: 2.2 }}
        />

        <CardContent sx={{ p: { xs: 2, md: 2.8 } }}>
          {(viewModes.escalafon === 'chart' || viewModes.escalafon === 'both') && (
            <Box sx={{ mb: viewModes.escalafon === 'both' ? 3 : 0 }}>
              <ChartTypeSelector
                currentType={chartTypes.escalafon}
                onSelect={(t) => setChartType('escalafon', t)}
                availableTypes={['lines', 'tracks', 'stacked', 'infographic', 'kanban']}
              />

              <Box ref={chartRef5} sx={{ bgcolor: '#ffffff', p: 0.5, borderRadius: 2 }}>
                {chartTypes.escalafon === 'lines' && (
                  <Box sx={{ width: '100%', overflowX: 'auto' }}>
                    <Box sx={{ width: '100%', minWidth: { xs: 580, md: '100%' }, height: 460 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={metricasHistoricas} margin={{ top: 32, right: 20, left: 0, bottom: 12 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <XAxis
                            dataKey="periodo"
                            tick={<CustomPeriodAxisTick />}
                            interval={0}
                            height={52}
                          />
                          <YAxis domain={[0, (dataMax) => Math.max(Math.ceil(dataMax * 1.25), 20)]} tick={{ fill: '#64748b', fontSize: 11 }} />
                          <RechartsTooltip content={<CustomChartTooltip />} />
                          <Legend
                            verticalAlign="top"
                            height={44}
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{ paddingBottom: 16, paddingTop: 2, fontSize: '11.5px', fontWeight: 800 }}
                          />

                          {/* ASOCIADO */}
                          <Line
                            type="linear"
                            dataKey="asociado"
                            name="ESCALAFÓN ASOCIADO"
                            stroke={BRAND_BURGUNDY}
                            strokeWidth={2.4}
                            dot={{ fill: BRAND_BURGUNDY, r: 4 }}
                          >
                            <LabelList content={renderSmartLabel('asociado', ['asociado', 'asistente', 'auxiliar', 'basico'], metricasHistoricas, BRAND_BURGUNDY)} />
                          </Line>

                          {/* ASISTENTE */}
                          <Line
                            type="linear"
                            dataKey="asistente"
                            name="ESCALAFÓN ASISTENTE"
                            stroke={BRAND_NAVY}
                            strokeWidth={2.4}
                            dot={{ fill: BRAND_NAVY, r: 4 }}
                          >
                            <LabelList content={renderSmartLabel('asistente', ['asociado', 'asistente', 'auxiliar', 'basico'], metricasHistoricas, BRAND_NAVY)} />
                          </Line>

                          {/* AUXILIAR */}
                          <Line
                            type="linear"
                            dataKey="auxiliar"
                            name="ESCALAFÓN AUXILIAR"
                            stroke={BRAND_CYAN}
                            strokeWidth={2.2}
                            dot={{ fill: BRAND_CYAN, r: 4 }}
                          >
                            <LabelList content={renderSmartLabel('auxiliar', ['asociado', 'asistente', 'auxiliar', 'basico'], metricasHistoricas, BRAND_CYAN)} />
                          </Line>

                          {/* BÁSICO / INSTRUCTOR */}
                          <Line
                            type="linear"
                            dataKey="basico"
                            name="ESCALAFÓN BÁSICO"
                            stroke={BRAND_AMBER}
                            strokeWidth={2.2}
                            dot={{ fill: BRAND_AMBER, r: 4 }}
                          >
                            <LabelList content={renderSmartLabel('basico', ['asociado', 'asistente', 'auxiliar', 'basico'], metricasHistoricas, BRAND_AMBER)} />
                          </Line>
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </Box>
                )}

                {chartTypes.escalafon === 'tracks' && (
                  <CategoryTracksChart data={metricasHistoricas} seriesConfig={SERIES_ESCALAFON} />
                )}

                {chartTypes.escalafon === 'stacked' && (
                  <StackedCategoryBarsChart data={metricasHistoricas} seriesConfig={SERIES_ESCALAFON} />
                )}

                {chartTypes.escalafon === 'infographic' && (
                  <InfographicMatrixTable data={metricasHistoricas} seriesConfig={SERIES_ESCALAFON} />
                )}

                {chartTypes.escalafon === 'kanban' && (
                  <CategoryKanbanCards data={metricasHistoricas} seriesConfig={SERIES_ESCALAFON} />
                )}
              </Box>
            </Box>
          )}

          {(viewModes.escalafon === 'table' || viewModes.escalafon === 'both') && (
            <Box>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }} data-no-export>
                <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#475569', textTransform: 'uppercase' }}>
                  Matriz Estadística: Escalafón Docente
                </Typography>
                <Button
                  size="small"
                  startIcon={<ContentCopyIcon sx={{ fontSize: 14 }} />}
                  onClick={() =>
                    copyTableData(
                      ['Período', 'Titular', 'Asociado', 'Asistente', 'Auxiliar', 'Básico', 'Total'],
                      metricasHistoricas.map((r) => ({
                        'Período': r.periodo,
                        'Titular': r.titular,
                        'Asociado': r.asociado,
                        'Asistente': r.asistente,
                        'Auxiliar': r.auxiliar,
                        'Básico': r.basico,
                        'Total': r.total
                      })),
                      enqueueSnackbar
                    )
                  }
                  sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 700 }}
                >
                  Copiar tabla
                </Button>
              </Stack>
              <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
                <Table size="small">
                  <TableHead sx={{ bgcolor: '#f1f5f9' }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: BRAND_NAVY }}>Período</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_BURGUNDY }}>Asociado</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Asistente</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_CYAN }}>Auxiliar</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_AMBER }}>Básico</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_SLATE }}>Sin Escalafón</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {metricasHistoricas.map((row) => (
                      <TableRow key={`row-esc-${row.periodo}`} hover>
                        <TableCell sx={{ fontWeight: 750, color: '#1e293b' }}>{row.periodo}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_BURGUNDY }}>{numberFmt.format(row.asociado)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_NAVY }}>{numberFmt.format(row.asistente)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_CYAN }}>{numberFmt.format(row.auxiliar)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 800, color: BRAND_AMBER }}>{numberFmt.format(row.basico)}</TableCell>
                        <TableCell align="right" sx={{ color: '#64748b' }}>{numberFmt.format(row.sinEscalafon)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 900, color: BRAND_NAVY }}>{numberFmt.format(row.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
