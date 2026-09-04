import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PictureAsPdfRoundedIcon from '@mui/icons-material/PictureAsPdfRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import DevicesRoundedIcon from '@mui/icons-material/DevicesRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import BubbleChartRoundedIcon from '@mui/icons-material/BubbleChartRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import gestionInformacionService from '../../services/gestionInformacionService';
import encabezadoCorreosImg from '../../assets/Encabezado_correos.png';

const ALL = 'TODOS';
const numberFormat = new Intl.NumberFormat('es-CO');

const normalize = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .trim();

const normalizeGeo = (value = '') => normalize(value).replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();

const formatGeoLabel = (value = '') => String(value || '').toLocaleLowerCase('es-CO').replace(/(^|\s)(\p{L})/gu, (_, space, letter) => `${space}${letter.toLocaleUpperCase('es-CO')}`);

const projectGeoPoint = ({ lon, lat, bbox, width = 800, height = 600, padding = 20 }) => {
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const lonRange = bbox.maxLon - bbox.minLon || 1;
  const latRange = bbox.maxLat - bbox.minLat || 1;
  const scale = Math.min(usableW / lonRange, usableH / latRange);
  const offsetX = padding + (usableW - lonRange * scale) / 2;
  const offsetY = padding + (usableH - latRange * scale) / 2;
  return {
    x: offsetX + (lon - bbox.minLon) * scale,
    y: offsetY + (bbox.maxLat - lat) * scale
  };
};

const buildGeoPath = (rings, bbox, width = 800, height = 600) => (rings || []).map((ring) => {
  const points = ring.map(([lon, lat]) => {
    const point = projectGeoPoint({ lon, lat, bbox, width, height });
    return `${point.x.toFixed(2)},${point.y.toFixed(2)}`;
  });
  return `M ${points.join(' L ')} Z`;
}).join(' ');

const featureCenter = (rings = []) => {
  const ring = rings.reduce((largest, current) => (current.length > largest.length ? current : largest), rings[0] || []);
  if (!ring.length) return null;
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 };
};

const unique = (rows, field) => [
  ALL,
  ...Array.from(new Set(rows.map((row) => String(row[field] || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'))
];

const periodSort = (a, b) => {
  const [ay, as] = String(a.periodo || '').split('-').map(Number);
  const [by, bs] = String(b.periodo || '').split('-').map(Number);
  return (ay - by) || (as - bs);
};

const periodDisplay = (value) => {
  const [year, semester] = String(value || '').split('-');
  return `${year}-${semester === '1' ? 'I' : semester === '2' ? 'II' : semester || ''}`;
};

const metricGroups = [
  {
    label: 'Inscritos, admitidos y primer curso',
    fields: [
      ['inscritos_nacional', 'Inscritos nacional', '#1d4ed8'],
      ['inscritos_regional', 'Inscritos regional', '#60a5fa'],
      ['admitidos_nacional', 'Admitidos nacional', '#be123c'],
      ['admitidos_regional', 'Admitidos regional', '#fb7185'],
      ['primer_curso_nacional', 'Primer curso nacional', '#047857'],
      ['primer_curso_regional', 'Primer curso regional', '#34d399']
    ]
  },
  {
    label: 'Matriculados',
    fields: [
      ['matriculados_nacional', 'Matriculados nacional', '#1d4ed8'],
      ['matriculados_regional', 'Matriculados regional', '#f59e0b']
    ]
  },
  {
    label: 'Graduados',
    fields: [
      ['graduados_nacional', 'Graduados Colombia', '#7c3aed'],
      ['graduados_regional', 'Graduados regional', '#ec4899']
    ]
  }
];

function FilterSelect({ label, value, onChange, options }) {
  const formatOption = (opt) => {
    if (opt === ALL) return 'Todos';
    const reg = REGIONS_DEFINITION.find((r) => r.key === opt);
    if (reg) return `Región ${reg.label}`;
    return opt;
  };
  return (
    <TextField select size="small" fullWidth label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <MenuItem key={option} value={option}>{formatOption(option)}</MenuItem>)}
    </TextField>
  );
}

const compactNumber = (value) => {
  const numeric = Number(value || 0);
  if (Math.abs(numeric) >= 1000000) return `${(numeric / 1000000).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M`;
  if (Math.abs(numeric) >= 1000) return `${(numeric / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}k`;
  return numberFormat.format(numeric);
};

function PeriodStackTick({ x, y, payload }) {
  const [year, semester] = String(payload?.value || '').split('-');
  const semesterLabel = semester === '1' ? 'I' : semester === '2' ? 'II' : semester || '—';
  return (
    <g transform={`translate(${x},${y})`}>
      <rect x="-12" y="7" width="24" height="18" rx="9" fill="#e7edf5" />
      <text x="0" y="20" textAnchor="middle" fill="#52657c" fontSize="9.5" fontWeight="900">{semesterLabel}</text>
      <text x="0" y="42" textAnchor="middle" fill="#102a4c" fontSize="10.5" fontWeight="900">{year}</text>
    </g>
  );
}

function PopulationStackedChart({ data, groupIndex, scope }) {
  const configurations = [
    {
      title: 'Flujo apilado por período',
      subtitle: 'Inscritos, admitidos y primer curso en una lectura consolidada.',
      series: [
        { field: `inscritos_${scope}`, label: 'Inscritos', color: '#2f6fed' },
        { field: `admitidos_${scope}`, label: 'Admitidos', color: '#df2426' },
        { field: `primer_curso_${scope}`, label: 'Primer curso', color: '#687b94' }
      ]
    },
    {
      title: 'Matriculados por período',
      subtitle: 'Evolución de estudiantes matriculados según el alcance seleccionado.',
      series: [{ field: `matriculados_${scope}`, label: 'Matriculados', color: '#2f6fed' }]
    },
    {
      title: 'Graduados por período',
      subtitle: 'Evolución de graduados según el alcance seleccionado.',
      series: [{ field: `graduados_${scope}`, label: 'Graduados', color: '#7c3aed' }]
    }
  ];
  const configuration = configurations[groupIndex] || configurations[0];
  const chartData = data
    .filter((row) => configuration.series.some((serie) => Number(row[serie.field] || 0) > 0))
    .map((row) => ({
      ...row,
      total_apilado: configuration.series.reduce((total, serie) => total + Number(row[serie.field] || 0), 0)
    }));
  const renderSegmentLabel = ({ x, y, width, height, value }) => {
    if (value === null || value === undefined || Number(value) === 0) return null;
    const formatted = numberFormat.format(value);
    if (height >= 10 && width >= 24) {
      return <text x={x + width / 2} y={y + height / 2 + (height < 18 ? 2.6 : 3.8)} textAnchor="middle" fill="#fff" fontSize={height < 18 ? 7 : 9} fontWeight="950">{formatted}</text>;
    }
    const labelWidth = Math.max(20, formatted.length * 5.2 + 8);
    const centerY = y + Math.max(4, height / 2);
    return (
      <g pointerEvents="none">
        <line x1={x + width} y1={centerY} x2={x + width + 4} y2={centerY} stroke="#64748b" strokeWidth=".8" />
        <rect x={x + width + 4} y={centerY - 7} width={labelWidth} height="14" rx="4" fill="#fff" stroke="#94a3b8" strokeWidth=".7" />
        <text x={x + width + 4 + labelWidth / 2} y={centerY + 2.5} textAnchor="middle" fill="#263b55" fontSize="7" fontWeight="950">{formatted}</text>
      </g>
    );
  };

  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2.2 }, border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'flex-start' }} spacing={1.5} sx={{ mb: 1 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>{configuration.title}</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>{configuration.subtitle}</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>

      {!chartData.length ? (
        <Alert severity="info" sx={{ mt: 2 }}>No existen datos para el período y programa seleccionados.</Alert>
      ) : (
        <Box sx={{ width: '100%', height: { xs: 430, md: 500 } }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 36, right: 18, left: 4, bottom: 42 }} barCategoryGap="24%">
              <CartesianGrid stroke="#e5eaf1" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="periodo" tick={<PeriodStackTick />} interval={0} height={58} axisLine={{ stroke: '#91a4bd' }} tickLine={false} />
              <YAxis domain={[0, (dataMax) => Math.ceil(Number(dataMax || 0) * 1.2)]} tickFormatter={compactNumber} tick={{ fill: '#52657c', fontSize: 10.5, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} />
              <RechartsTooltip labelFormatter={(label) => `Período ${label}`} formatter={(value, name) => [numberFormat.format(value), name]} contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 8px 22px rgba(15,23,42,.12)' }} />
              <Legend verticalAlign="top" align="center" iconType="circle" iconSize={9} wrapperStyle={{ top: 2, fontSize: 11, fontWeight: 800 }} />
              {configuration.series.map((serie, index) => (
                <Bar key={serie.field} dataKey={serie.field} name={serie.label} stackId="flujo" fill={serie.color} maxBarSize={48} radius={index === configuration.series.length - 1 ? [5, 5, 0, 0] : [0, 0, 0, 0]}>
                  <LabelList dataKey={serie.field} content={renderSegmentLabel} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}

function PopulationTrendChart({ data, groupIndex, scope }) {
  const configurations = [
    {
      subtitle: 'Comportamiento histórico de inscritos, admitidos y estudiantes de primer curso.',
      series: [
        { field: `inscritos_${scope}`, label: 'Inscritos', color: '#2f6fed' },
        { field: `admitidos_${scope}`, label: 'Admitidos', color: '#1494a8' },
        { field: `primer_curso_${scope}`, label: 'Primer curso', color: '#5b8f45' }
      ]
    },
    {
      subtitle: 'Comportamiento histórico de estudiantes matriculados.',
      series: [{ field: `matriculados_${scope}`, label: 'Matriculados', color: '#2f6fed' }]
    },
    {
      subtitle: 'Comportamiento histórico de estudiantes graduados.',
      series: [{ field: `graduados_${scope}`, label: 'Graduados', color: '#7c3aed' }]
    }
  ];
  const configuration = configurations[groupIndex] || configurations[0];
  const chartData = data.filter((row) => configuration.series.some((serie) => Number(row[serie.field] || 0) > 0));
  const renderPointLabel = ({ x, y, value }) => {
    if (value === null || value === undefined) return null;
    return <text x={x} y={y - 11} textAnchor="middle" fill="#334155" stroke="#fff" strokeWidth="3" paintOrder="stroke" fontSize="9.5" fontWeight="950">{numberFormat.format(value)}</text>;
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={1.2} sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.5 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Análisis histórico</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>{configuration.subtitle}</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: 2.2, py: 0.8, bgcolor: '#082b66', color: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 950, letterSpacing: 0.5 }}>LÍNEAS DE TENDENCIA</Box>

      {!chartData.length ? (
        <Alert severity="info" sx={{ m: 2 }}>No existen datos para el período y programa seleccionados.</Alert>
      ) : (
        <Box sx={{ width: '100%', height: { xs: 420, md: 470 }, p: { xs: 1, md: 1.5 } }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 42, right: 36, left: 8, bottom: 30 }}>
              <CartesianGrid stroke="#e5eaf1" strokeDasharray="3 4" vertical={false} />
              <XAxis dataKey="periodo" tickFormatter={(value) => String(value).replace('-', ' · ')} tick={{ fill: '#52657c', fontSize: 10, fontWeight: 800 }} axisLine={{ stroke: '#91a4bd' }} tickLine={false} />
              <YAxis domain={[0, (dataMax) => Math.ceil(Number(dataMax || 0) * 1.2)]} tickFormatter={compactNumber} tick={{ fill: '#52657c', fontSize: 10.5, fontWeight: 700 }} axisLine={false} tickLine={false} width={52} />
              <RechartsTooltip labelFormatter={(label) => `Período ${label}`} formatter={(value, name) => [numberFormat.format(value), name]} contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1', boxShadow: '0 8px 22px rgba(15,23,42,.12)' }} />
              <Legend verticalAlign="bottom" align="center" iconType="circle" iconSize={9} wrapperStyle={{ bottom: 0, fontSize: 11, fontWeight: 800 }} />
              {configuration.series.map((serie) => (
                <Line key={serie.field} type="linear" dataKey={serie.field} name={serie.label} stroke={serie.color} strokeWidth={3} strokeLinejoin="miter" strokeLinecap="square" dot={{ r: 4.2, fill: serie.color, stroke: '#fff', strokeWidth: 1.5 }} activeDot={{ r: 6 }} label={renderPointLabel} connectNulls />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Box>
      )}
    </Paper>
  );
}

function PopulationIndicatorTrendBoard({ data, scope }) {
  const definitions = [
    { field: `inscritos_${scope}`, label: 'Inscritos', color: '#123b7a', soft: '#eaf1fb', icon: <GroupsRoundedIcon sx={{ fontSize: 19 }} /> },
    { field: `admitidos_${scope}`, label: 'Admitidos', color: '#1f67bd', soft: '#eaf4ff', icon: <WorkspacePremiumRoundedIcon sx={{ fontSize: 19 }} /> },
    { field: `primer_curso_${scope}`, label: 'Matriculados a primer curso', color: '#239447', soft: '#ecf8ef', icon: <SchoolRoundedIcon sx={{ fontSize: 19 }} /> }
  ];
  const annualRows = data
    .filter((row) => definitions.some(({ field }) => Number(row[field] || 0) > 0))
    .sort(periodSort)
    .map((row) => ({ ...row, year: periodDisplay(row.periodo) }));
  const columnTemplate = `minmax(205px, 1.55fr) repeat(${Math.max(1, annualRows.length)}, minmax(54px, .72fr)) minmax(126px, 1fr)`;
  const sparkline = (values, color) => {
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const points = values.map((value, index) => `${8 + (index * 82) / Math.max(1, values.length - 1)},${31 - ((value - min) / range) * 22}`).join(' ');
    return (
      <Box component="svg" viewBox="0 0 98 38" sx={{ width: 76, height: 30, display: 'block' }} aria-hidden="true">
        <line x1="6" y1="32" x2="92" y2="32" stroke="#dbe4ef" strokeWidth="1" />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        {values.map((value, index) => {
          const x = 8 + (index * 82) / Math.max(1, values.length - 1);
          const y = 31 - ((value - min) / range) * 22;
          return <circle key={`${x}-${value}`} cx={x} cy={y} r="2.4" fill={color} stroke="#fff" strokeWidth="1" />;
        })}
      </Box>
    );
  };

  if (!annualRows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;
  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Tablero de indicadores con tendencias</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Valores por período y variación acumulada del primero al último período visible.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 1, md: 2 }, pb: 2, overflowX: 'auto' }}>
        <Box sx={{ minWidth: 850, border: '1px solid #d8e3f0', borderRadius: 2.5, overflow: 'hidden', boxShadow: '0 8px 24px rgba(15,43,86,.06)' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: columnTemplate, bgcolor: '#f4f7fb', borderBottom: '1px solid #d8e3f0' }}>
            <Box sx={{ px: 1.5, py: 1.2, color: '#52657c', fontSize: 10.5, fontWeight: 950, textTransform: 'uppercase', letterSpacing: 0.6 }}>Indicador</Box>
            {annualRows.map((row) => <Box key={row.year} sx={{ px: 0.6, py: 1.2, textAlign: 'center', color: '#334155', fontSize: 11, fontWeight: 950 }}>{row.year}</Box>)}
            <Box sx={{ px: 1, py: 0.8, textAlign: 'center', color: '#52657c', fontSize: 9.5, fontWeight: 950, lineHeight: 1.15 }}>TENDENCIA<br />{annualRows[0].year}–{annualRows[annualRows.length - 1].year}</Box>
          </Box>
          {definitions.map((definition, rowIndex) => {
            const values = annualRows.map((row) => Number(row[definition.field] || 0));
            const firstValue = values.find((value) => value > 0) || 0;
            const lastValue = [...values].reverse().find((value) => value > 0) || 0;
            const variation = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
            const trendColor = variation >= 0 ? '#15803d' : '#dc2626';
            return (
              <Box key={definition.field} sx={{ display: 'grid', gridTemplateColumns: columnTemplate, minHeight: 68, borderBottom: rowIndex < definitions.length - 1 ? '1px solid #e2e8f0' : 0, bgcolor: rowIndex % 2 ? '#fbfdff' : '#fff' }}>
                <Stack direction="row" alignItems="center" spacing={1.1} sx={{ px: 1.2, py: 1, bgcolor: definition.soft, borderLeft: `5px solid ${definition.color}` }}>
                  <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: definition.color, color: '#fff', boxShadow: `0 5px 12px ${definition.color}35` }}>{definition.icon}</Box>
                  <Typography sx={{ color: definition.color, fontSize: definition.label.length > 18 ? 9.3 : 11, fontWeight: 950, textTransform: 'uppercase', lineHeight: 1.18, maxWidth: 135 }}>{definition.label}</Typography>
                </Stack>
                {values.map((value, index) => <Box key={`${definition.field}-${annualRows[index].year}`} sx={{ display: 'grid', placeItems: 'center', px: 0.4, borderLeft: '1px solid #edf1f6', color: definition.color, fontSize: 11.5, fontWeight: 950 }}>{numberFormat.format(value)}</Box>)}
                <Stack direction="row" alignItems="center" justifyContent="center" sx={{ px: 0.6, borderLeft: '1px solid #d8e3f0', bgcolor: variation >= 0 ? '#f0fdf4' : '#fff5f5' }}>
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: trendColor, fontSize: 12, fontWeight: 950, lineHeight: 1 }}>{variation >= 0 ? '+' : ''}{variation.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</Typography>
                    {sparkline(values, trendColor)}
                  </Box>
                </Stack>
              </Box>
            );
          })}
          <Stack direction="row" justifyContent="center" spacing={2.5} sx={{ px: 2, py: 1.1, bgcolor: '#f7f9fc', borderTop: '1px solid #d8e3f0', flexWrap: 'wrap' }}>
            {definitions.map((definition) => <Stack key={`legend-${definition.field}`} direction="row" alignItems="center" spacing={0.65}><Box sx={{ width: 18, height: 3, borderRadius: 2, bgcolor: definition.color }} /><Typography sx={{ color: '#52657c', fontSize: 9.5, fontWeight: 850 }}>{definition.label}</Typography></Stack>)}
          </Stack>
        </Box>
      </Box>
    </Paper>
  );
}

function PopulationShadedTrendChart({ data, scope }) {
  const series = [
    { field: `inscritos_${scope}`, label: 'Inscritos', short: 'I', color: '#123b7a', gradient: `shade-inscritos-${scope}` },
    { field: `admitidos_${scope}`, label: 'Admitidos', short: 'A', color: '#2f6fed', gradient: `shade-admitidos-${scope}` },
    { field: `primer_curso_${scope}`, label: 'Primer curso', short: 'PC', color: '#239447', gradient: `shade-primer-${scope}` }
  ];
  const annualRows = data
    .filter((row) => series.some(({ field }) => Number(row[field] || 0) > 0))
    .sort(periodSort)
    .map((row) => ({ ...row, year: periodDisplay(row.periodo) }));
  if (!annualRows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;

  const width = 1200;
  const height = 390;
  const chartLeft = 185;
  const chartRight = 1020;
  const plotWidth = chartRight - chartLeft;
  const rowTop = 82;
  const rowHeight = 88;
  const pointX = (index) => chartLeft + (index * plotWidth) / Math.max(1, annualRows.length - 1);

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Líneas de tendencia con áreas sombreadas</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Evolución comparada por período y variación acumulada por indicador.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 0.5, md: 1.4 }, pb: 1.2, overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 420 }}>
          <defs>
            {series.map((item) => <linearGradient key={item.gradient} id={item.gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity=".27" /><stop offset="100%" stopColor={item.color} stopOpacity=".035" /></linearGradient>)}
            <filter id={`shade-dot-${scope}`} x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="2" stdDeviation="2" floodColor="#0f2f5e" floodOpacity=".2" /></filter>
          </defs>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          <text x={chartRight + 82} y="41" textAnchor="middle" fill="#52657c" fontSize="10" fontWeight="900">VARIACIÓN</text>
          <text x={chartRight + 82} y="55" textAnchor="middle" fill="#64748b" fontSize="8.5">{annualRows[0].year}–{annualRows[annualRows.length - 1].year}</text>
          {series.map((item, seriesIndex) => {
            const values = annualRows.map((row) => Number(row[item.field] || 0));
            const max = Math.max(1, ...values);
            const min = Math.min(...values);
            const range = max - min || 1;
            const top = rowTop + seriesIndex * rowHeight;
            const baseline = top + 55;
            const pointY = (value) => top + 7 + (1 - (value - min) / range) * 35;
            const points = values.map((value, index) => `${pointX(index)},${pointY(value)}`).join(' ');
            const areaPoints = `${chartLeft},${baseline} ${points} ${chartRight},${baseline}`;
            const first = values.find((value) => value > 0) || 0;
            const last = [...values].reverse().find((value) => value > 0) || 0;
            const variation = first > 0 ? ((last - first) / first) * 100 : 0;
            const trendColor = variation >= 0 ? '#15803d' : '#dc2626';
            return (
              <g key={item.field}>
                <line x1={chartLeft} y1={baseline} x2={chartRight} y2={baseline} stroke="#d9e3ef" strokeWidth="1" />
                <rect x="25" y={top + 6} width="135" height="50" rx="12" fill="#fff" stroke={item.color} strokeOpacity=".25" />
                <circle cx="50" cy={top + 31} r="16" fill={item.color} />
                <text x="50" y={top + 35} textAnchor="middle" fill="#fff" fontSize={item.short.length > 1 ? 8 : 11} fontWeight="950">{item.short}</text>
                <text x="73" y={top + 34} fill={item.color} fontSize="10.5" fontWeight="950">{item.label.toLocaleUpperCase('es-CO')}</text>
                <polygon points={areaPoints} fill={`url(#${item.gradient})`} />
                <polyline points={points} fill="none" stroke={item.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {values.map((value, index) => (
                  <g key={`${item.field}-${annualRows[index].year}`} filter={`url(#shade-dot-${scope})`}>
                    <circle cx={pointX(index)} cy={pointY(value)} r="5" fill={item.color} stroke="#fff" strokeWidth="2" />
                    <text x={pointX(index)} y={pointY(value) - 11} textAnchor="middle" fill={item.color} fontSize="9.5" fontWeight="950" stroke="#fff" strokeWidth="3" paintOrder="stroke">{numberFormat.format(value)}</text>
                  </g>
                ))}
                <line x1={chartRight + 10} y1={top + 31} x2={chartRight + 35} y2={top + 31} stroke={trendColor} strokeWidth="2" strokeDasharray="4 4" />
                <circle cx={chartRight + 82} cy={top + 31} r="27" fill={variation >= 0 ? '#f0fdf4' : '#fff5f5'} stroke={trendColor} strokeWidth="2" strokeDasharray="4 3" />
                <text x={chartRight + 82} y={top + 35} textAnchor="middle" fill={trendColor} fontSize="11" fontWeight="950">{variation >= 0 ? '+' : ''}{variation.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%</text>
              </g>
            );
          })}
          {annualRows.map((row, index) => <text key={row.year} x={pointX(index)} y="360" textAnchor="middle" fill="#334155" fontSize="10" fontWeight="900">{row.year}</text>)}
        </Box>
      </Box>
    </Paper>
  );
}

function PopulationBubbleMatrixChart({ data, scope }) {
  const series = [
    { field: `inscritos_${scope}`, label: 'Inscritos', short: 'I', color: '#123b7a', soft: '#edf3fb' },
    { field: `admitidos_${scope}`, label: 'Admitidos', short: 'A', color: '#2f6fed', soft: '#eff5ff' },
    { field: `primer_curso_${scope}`, label: 'Primer curso', short: 'PC', color: '#27a861', soft: '#edf9f1' }
  ];
  const annualRows = data
    .filter((row) => series.some(({ field }) => Number(row[field] || 0) > 0))
    .sort(periodSort)
    .map((row) => ({ ...row, year: periodDisplay(row.periodo) }));
  if (!annualRows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;

  const width = 1200;
  const height = 365;
  const chartLeft = 190;
  const chartRight = 1170;
  const plotWidth = chartRight - chartLeft;
  const cellWidth = plotWidth / annualRows.length;
  const globalMax = Math.max(1, ...annualRows.flatMap((row) => series.map(({ field }) => Number(row[field] || 0))));
  const maxBubbleRadius = Math.max(10, Math.min(22, cellWidth * 0.36));
  const radius = (value) => value > 0 ? 4 + Math.sqrt(value / globalMax) * maxBubbleRadius : 0;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Círculos proporcionales</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>El área de cada círculo representa la magnitud del indicador en cada período.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 0.5, md: 1.4 }, pb: 1.2, overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 390 }}>
          <defs>
            <filter id={`bubble-shadow-${scope}`} x="-70%" y="-70%" width="240%" height="240%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#123b7a" floodOpacity=".18" /></filter>
          </defs>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          <rect x="18" y="24" width={width - 36} height="42" rx="11" fill="#f3f7fc" />
          <text x="38" y="50" fill="#52657c" fontSize="10" fontWeight="950" letterSpacing=".5">INDICADOR</text>
          {annualRows.map((row, index) => <text key={row.year} x={chartLeft + index * cellWidth + cellWidth / 2} y="50" textAnchor="middle" fill="#263b56" fontSize="11" fontWeight="950">{row.year}</text>)}
          {series.map((item, rowIndex) => {
            const centerY = 115 + rowIndex * 94;
            return (
              <g key={item.field}>
                <rect x="18" y={centerY - 41} width={width - 36} height="84" rx="13" fill={rowIndex % 2 ? '#fff' : '#fbfdff'} stroke="#e4ebf4" />
                <rect x="28" y={centerY - 28} width="142" height="56" rx="12" fill={item.soft} />
                <circle cx="53" cy={centerY} r="17" fill={item.color} />
                <text x="53" y={centerY + 4} textAnchor="middle" fill="#fff" fontSize={item.short.length > 1 ? 8 : 11} fontWeight="950">{item.short}</text>
                <text x="78" y={centerY - (item.label === 'Primer curso' ? 3 : -4)} fill={item.color} fontSize="10.5" fontWeight="950">{item.label === 'Primer curso' ? 'MATRICULADOS A' : item.label.toLocaleUpperCase('es-CO')}</text>
                {item.label === 'Primer curso' && <text x="78" y={centerY + 11} fill={item.color} fontSize="8.8" fontWeight="900">PRIMER CURSO</text>}
                {annualRows.map((row, index) => {
                  const value = Number(row[item.field] || 0);
                  const cx = chartLeft + index * cellWidth + cellWidth / 2;
                  const r = radius(value);
                  return (
                    <g key={`${item.field}-${row.year}`}>
                      {value > 0 && <circle cx={cx} cy={centerY - 7} r={r} fill={item.color} fillOpacity=".94" stroke="#fff" strokeWidth="2" filter={`url(#bubble-shadow-${scope})`} />}
                      <text x={cx} y={centerY + 38} textAnchor="middle" fill={item.color} fontSize="10" fontWeight="950">{numberFormat.format(value)}</text>
                    </g>
                  );
                })}
              </g>
            );
          })}
        </Box>
      </Box>
    </Paper>
  );
}

function PopulationPeriodCards({ data, scope }) {
  const fields = {
    inscritos: `inscritos_${scope}`,
    admitidos: `admitidos_${scope}`,
    primerCurso: `primer_curso_${scope}`
  };
  const rows = data
    .filter((row) => [fields.inscritos, fields.admitidos, fields.primerCurso].some((field) => Number(row[field] || 0) > 0))
    .sort(periodSort);
  if (!rows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Tarjetas por periodo académico</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Lectura individual del flujo de ingreso y su tasa de absorción.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 1.2, md: 2 }, pb: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(238px, 100%), 1fr))', gap: 1.45 }}>
        {rows.map((row) => {
          const inscritos = Number(row[fields.inscritos] || 0);
          const admitidos = Number(row[fields.admitidos] || 0);
          const primerCurso = Number(row[fields.primerCurso] || 0);
          const absorption = admitidos > 0 ? (primerCurso / admitidos) * 100 : 0;
          const gaugeValue = Math.max(0, Math.min(100, absorption));
          const [year, semester] = String(row.periodo || '').split('-');
          const periodLabel = `${year}-${semester === '1' ? 'I' : semester === '2' ? 'II' : semester}`;
          const metrics = [
            ['Inscritos', inscritos, '#123b7a', 'I'],
            ['Admitidos', admitidos, '#1593a5', 'A'],
            ['Primer curso', primerCurso, '#239447', 'PC']
          ];
          return (
            <Paper key={row.periodo} elevation={0} sx={{ border: '1px solid #cfdaea', borderRadius: 2.2, overflow: 'hidden', bgcolor: '#fff', boxShadow: '0 5px 16px rgba(15,43,86,.065)', transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease', '&:hover': { transform: 'translateY(-2px)', borderColor: '#9bb8df', boxShadow: '0 10px 24px rgba(15,43,86,.12)' } }}>
              <Box sx={{ py: 0.8, px: 1.2, textAlign: 'center', background: 'linear-gradient(90deg,#0b326f 0%,#1b54a5 100%)', color: '#fff', borderBottom: '1px solid rgba(255,255,255,.18)' }}>
                <Typography sx={{ fontSize: 11.5, fontWeight: 950, letterSpacing: 0.4 }}>{periodLabel}</Typography>
              </Box>
              <Stack spacing={0.55} sx={{ p: 1.15, pb: 0.7 }}>
                {metrics.map(([label, value, color, short]) => (
                  <Stack key={label} direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={0.7}>
                      <Box sx={{ width: 22, height: 22, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', bgcolor: color, fontSize: short.length > 1 ? 7 : 9, fontWeight: 950 }}>{short}</Box>
                      <Typography sx={{ color: '#52657c', fontSize: 9.5, fontWeight: 800 }}>{label}</Typography>
                    </Stack>
                    <Typography sx={{ color, fontSize: 12, fontWeight: 950 }}>{numberFormat.format(value)}</Typography>
                  </Stack>
                ))}
              </Stack>
              <Box sx={{ px: 1.15, pb: 1.05 }}>
                <Box component="svg" viewBox="0 0 120 47" sx={{ width: '100%', height: 48, display: 'block' }}>
                  <path d="M 18 39 A 42 42 0 0 1 102 39" fill="none" stroke="#e4ebf4" strokeWidth="8" strokeLinecap="round" pathLength="100" />
                  <path d="M 18 39 A 42 42 0 0 1 102 39" fill="none" stroke="#1593a5" strokeWidth="8" strokeLinecap="round" pathLength="100" strokeDasharray={`${gaugeValue} 100`} />
                  <text x="60" y="34" textAnchor="middle" fill="#082b66" fontSize="14" fontWeight="950">{Math.round(absorption)}%</text>
                  <text x="60" y="46" textAnchor="middle" fill="#64748b" fontSize="6.8" fontWeight="800">TASA DE ABSORCIÓN</text>
                </Box>
              </Box>
            </Paper>
          );
        })}
      </Box>
      <Stack direction="row" justifyContent="center" spacing={2.2} sx={{ px: 2, py: 1, bgcolor: '#f6f9fc', borderTop: '1px solid #e2e8f0', flexWrap: 'wrap' }}>
        {[['Inscritos', '#123b7a'], ['Admitidos', '#1593a5'], ['Primer curso', '#239447'], ['Tasa de absorción', '#1593a5']].map(([label, color]) => <Stack key={label} direction="row" alignItems="center" spacing={0.6}><Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: color }} /><Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#52657c' }}>{label}</Typography></Stack>)}
      </Stack>
    </Paper>
  );
}

function PopulationStudentJourneyChart({ data, scope }) {
  const series = [
    { field: `inscritos_${scope}`, label: 'Inscritos', color: '#123b7a', symbol: 'journey-people' },
    { field: `admitidos_${scope}`, label: 'Admitidos', color: '#2f6fed', symbol: 'journey-check' },
    { field: `primer_curso_${scope}`, label: 'Matriculados a primer curso', color: '#239447', symbol: 'journey-cap' }
  ];
  const annualRows = data
    .filter((row) => series.some(({ field }) => Number(row[field] || 0) > 0))
    .sort(periodSort)
    .map((row) => ({ ...row, year: periodDisplay(row.periodo) }));
  if (!annualRows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;

  const width = 1200;
  const height = 365;
  const chartLeft = 180;
  const chartRight = 1160;
  const plotWidth = chartRight - chartLeft;
  const x = (index) => chartLeft + index * plotWidth / Math.max(1, annualRows.length - 1);

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Camino del estudiante</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Trayectoria por período desde la inscripción hasta el ingreso a primer curso.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 0.5, md: 1.4 }, pb: 1.1, overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 390 }}>
          <defs>
            <filter id={`journey-shadow-${scope}`} x="-70%" y="-70%" width="240%" height="240%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#0f2f5e" floodOpacity=".2" /></filter>
            <g id="journey-people"><circle cx="-4" cy="-3" r="3" fill="#fff" /><circle cx="4" cy="-3" r="3" fill="#fff" /><circle cx="0" cy="-7" r="3.4" fill="#fff" /><path d="M-9 7c0-5 2-7 5-7s5 2 5 7M-1 7c0-5 2-7 5-7s5 2 5 7M-6 7c0-6 2.5-9 6-9s6 3 6 9" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" /></g>
            <g id="journey-check"><path d="M-8 0l5 5L8-7" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></g>
            <g id="journey-cap"><path d="M-10-3L0-8 10-3 0 2z" fill="#fff" /><path d="M-6 0v6c4 3 8 3 12 0V0" fill="none" stroke="#fff" strokeWidth="2" /><path d="M10-3v8" stroke="#fff" strokeWidth="1.8" /></g>
          </defs>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          <rect x="20" y="20" width={width - 40} height="40" rx="11" fill="#f3f7fc" />
          <text x="38" y="45" fill="#52657c" fontSize="10" fontWeight="950" letterSpacing=".5">ETAPA</text>
          {annualRows.map((row, index) => <text key={row.year} x={x(index)} y="45" textAnchor="middle" fill="#263b56" fontSize="11" fontWeight="950">{row.year}</text>)}
          {series.map((item, seriesIndex) => {
            const values = annualRows.map((row) => Number(row[item.field] || 0));
            const min = Math.min(...values);
            const max = Math.max(1, ...values);
            const range = max - min || 1;
            const baseY = 102 + seriesIndex * 86;
            const y = (value) => baseY + 7 - ((value - min) / range) * 14;
            const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
            return (
              <g key={item.field}>
                <rect x="20" y={baseY - 34} width={width - 40} height="70" rx="14" fill={seriesIndex % 2 ? '#fff' : '#fbfdff'} stroke="#e5edf6" />
                <rect x="30" y={baseY - 24} width="128" height="48" rx="12" fill={item.color} fillOpacity=".08" stroke={item.color} strokeOpacity=".22" />
                <circle cx="52" cy={baseY} r="16" fill={item.color} />
                <use href={`#${item.symbol}`} transform={`translate(52 ${baseY})`} />
                <text x="76" y={baseY + (item.label.length > 18 ? -2 : 4)} fill={item.color} fontSize={item.label.length > 18 ? 8.2 : 10.5} fontWeight="950">{item.label.length > 18 ? 'MATRICULADOS A' : item.label.toLocaleUpperCase('es-CO')}</text>
                {item.label.length > 18 && <text x="76" y={baseY + 11} fill={item.color} fontSize="8.2" fontWeight="900">PRIMER CURSO</text>}
                <polyline points={points} fill="none" stroke={item.color} strokeOpacity=".28" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
                <polyline points={points} fill="none" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                {values.map((value, index) => (
                  <g key={`${item.field}-${annualRows[index].year}`} filter={`url(#journey-shadow-${scope})`}>
                    <circle cx={x(index)} cy={y(value)} r="17" fill={item.color} stroke="#fff" strokeWidth="2.5" />
                    <use href={`#${item.symbol}`} transform={`translate(${x(index)} ${y(value)}) scale(.72)`} />
                    <text x={x(index)} y={y(value) + 31} textAnchor="middle" fill={item.color} fontSize="9.5" fontWeight="950" stroke="#fff" strokeWidth="3" paintOrder="stroke">{numberFormat.format(value)}</text>
                  </g>
                ))}
              </g>
            );
          })}
          {series.map((item, index) => {
            const legendX = 330 + index * 235;
            return <g key={`journey-legend-${item.field}`}><line x1={legendX} y1="341" x2={legendX + 22} y2="341" stroke={item.color} strokeWidth="3" /><circle cx={legendX + 11} cy="341" r="4" fill={item.color} /><text x={legendX + 30} y="345" fill="#52657c" fontSize="9" fontWeight="850">{item.label}</text></g>;
          })}
        </Box>
      </Box>
    </Paper>
  );
}

function PopulationAnnualTimelineChart({ data, scope }) {
  const series = [
    { field: `inscritos_${scope}`, label: 'Inscritos', short: 'I', color: '#123b7a' },
    { field: `admitidos_${scope}`, label: 'Admitidos', short: 'A', color: '#2f6fed' },
    { field: `primer_curso_${scope}`, label: 'Primer curso', short: 'PC', color: '#239447' }
  ];
  const annualRows = data
    .filter((row) => series.some(({ field }) => Number(row[field] || 0) > 0))
    .sort(periodSort)
    .map((row) => ({ ...row, year: periodDisplay(row.periodo) }));
  if (!annualRows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;

  const width = 1200;
  const height = 365;
  const left = 48;
  const right = 1152;
  const slot = (right - left) / annualRows.length;
  const cardWidth = Math.max(42, Math.min(136, slot - 8));
  const centerX = (index) => left + index * slot + slot / 2;
  const cardTop = 72;
  const cardHeight = 214;
  const timelineY = 319;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Historia por período en tarjetas</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Secuencia cronológica del recorrido de ingreso por período académico.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 0.5, md: 1.4 }, pb: 1.1, overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 390 }}>
          <defs>
            <filter id={`timeline-shadow-${scope}`} x="-30%" y="-20%" width="160%" height="160%"><feDropShadow dx="0" dy="5" stdDeviation="5" floodColor="#123b7a" floodOpacity=".12" /></filter>
            <linearGradient id={`timeline-head-${scope}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#082b66" /><stop offset="100%" stopColor="#1d55a6" /></linearGradient>
          </defs>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          <line x1={centerX(0)} y1={timelineY} x2={centerX(annualRows.length - 1) + 18} y2={timelineY} stroke="#9fb2ca" strokeWidth="2" strokeDasharray="5 4" />
          <path d={`M ${centerX(annualRows.length - 1) + 18} ${timelineY - 5} L ${centerX(annualRows.length - 1) + 28} ${timelineY} L ${centerX(annualRows.length - 1) + 18} ${timelineY + 5} Z`} fill="#123b7a" />
          {annualRows.map((row, index) => {
            const cx = centerX(index);
            const cardX = cx - cardWidth / 2;
            const compact = cardWidth < 92;
            return (
              <g key={row.year} filter={`url(#timeline-shadow-${scope})`}>
                <rect x={cardX} y={cardTop} width={cardWidth} height={cardHeight} rx="14" fill="#fff" stroke="#ced9e7" strokeWidth="1.3" />
                <rect x={cardX} y={cardTop} width={cardWidth} height="42" rx="14" fill={`url(#timeline-head-${scope})`} />
                <path d={`M ${cardX} ${cardTop + 29} H ${cardX + cardWidth} V ${cardTop + 42} H ${cardX} Z`} fill={`url(#timeline-head-${scope})`} />
                <text x={cx} y={cardTop + 27} textAnchor="middle" fill="#fff" fontSize={compact ? 10 : 12} fontWeight="950">{row.year}</text>
                {series.map((item, metricIndex) => {
                  const cy = cardTop + 76 + metricIndex * 47;
                  const value = Number(row[item.field] || 0);
                  return (
                    <g key={`${row.year}-${item.field}`}>
                      <circle cx={cardX + (compact ? 14 : 20)} cy={cy - 5} r={compact ? 9 : 11} fill={item.color} />
                      <text x={cardX + (compact ? 14 : 20)} y={cy - 2} textAnchor="middle" fill="#fff" fontSize={item.short.length > 1 ? 6 : 8} fontWeight="950">{item.short}</text>
                      {!compact && <text x={cardX + 37} y={cy - 11} fill="#64748b" fontSize="7.5" fontWeight="800">{item.label}</text>}
                      <text x={compact ? cx : cardX + 37} y={cy + (compact ? 19 : 4)} textAnchor={compact ? 'middle' : 'start'} fill={item.color} fontSize={compact ? 8.5 : 10.5} fontWeight="950">{numberFormat.format(value)}</text>
                    </g>
                  );
                })}
                <line x1={cx} y1={cardTop + cardHeight} x2={cx} y2={timelineY - 8} stroke="#9fb2ca" strokeWidth="1.5" />
                <circle cx={cx} cy={timelineY} r="7" fill="#fff" stroke="#123b7a" strokeWidth="3" />
                <circle cx={cx} cy={timelineY} r="2.4" fill="#2f6fed" />
              </g>
            );
          })}
          {series.map((item, index) => {
            const legendX = 320 + index * 235;
            return <g key={`timeline-legend-${item.field}`}><circle cx={legendX} cy="345" r="4.5" fill={item.color} /><text x={legendX + 11} y="349" fill="#52657c" fontSize="9" fontWeight="850">{index === 2 ? 'Matriculados a primer curso' : item.label}</text></g>;
          })}
        </Box>
      </Box>
    </Paper>
  );
}

function PopulationConversionChart({ data, scope }) {
  const fields = {
    inscritos: `inscritos_${scope}`,
    admitidos: `admitidos_${scope}`,
    primerCurso: `primer_curso_${scope}`
  };
  const annualRows = data
    .filter((row) => [fields.inscritos, fields.admitidos, fields.primerCurso].some((field) => Number(row[field] || 0) > 0))
    .sort(periodSort)
    .map((row) => ({
      year: periodDisplay(row.periodo),
      inscritos: Number(row[fields.inscritos] || 0),
      admitidos: Number(row[fields.admitidos] || 0),
      primerCurso: Number(row[fields.primerCurso] || 0)
    }))
    .filter((row) => row.inscritos > 0 || row.admitidos > 0 || row.primerCurso > 0)
    .map((row) => ({
      ...row,
      selectividad: row.inscritos > 0 ? (row.admitidos / row.inscritos) * 100 : 0,
      absorcion: row.admitidos > 0 ? (row.primerCurso / row.admitidos) * 100 : 0,
      conversion: row.inscritos > 0 ? (row.primerCurso / row.inscritos) * 100 : 0
    }));
  if (!annualRows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;

  const width = 1200;
  const height = 310;
  const left = 240;
  const right = 1170;
  const slot = (right - left) / annualRows.length;
  const gaugeRadius = Math.max(22, Math.min(32, slot * 0.28));
  const circumference = 2 * Math.PI * gaugeRadius;
  const latest = annualRows[annualRows.length - 1];
  const pct = (value) => value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const rows = [
    { field: 'selectividad', title: 'Selectividad', formula: 'Admitidos ÷ Inscritos', color: '#245fc7', y: 125 },
    { field: 'absorcion', title: 'Absorción', formula: 'Primer curso ÷ Admitidos', color: '#239447', y: 225 }
  ];

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Indicadores de conversión por período</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Inscritos representa la base del 100% para analizar el avance del proceso.</Typography>
        </Box>
        <Stack direction="row" spacing={0.8} alignItems="center">
          <Chip label="Inscritos = 100%" size="small" sx={{ bgcolor: '#eaf1fb', color: '#123b7a', fontWeight: 950 }} />
          <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
        </Stack>
      </Stack>
      <Box sx={{ px: { xs: 0.5, md: 1.4 }, overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 335 }}>
          <defs>
            <filter id={`conversion-shadow-${scope}`} x="-60%" y="-60%" width="220%" height="220%"><feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#123b7a" floodOpacity=".15" /></filter>
          </defs>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          <rect x="20" y="22" width={width - 40} height="42" rx="11" fill="#f3f7fc" />
          <text x="40" y="48" fill="#52657c" fontSize="10" fontWeight="950">INDICADOR</text>
          {annualRows.map((row, index) => <text key={row.year} x={left + index * slot + slot / 2} y="48" textAnchor="middle" fill="#263b56" fontSize="11" fontWeight="950">{row.year}</text>)}
          {rows.map((definition) => (
            <g key={definition.field}>
              <rect x="20" y={definition.y - 44} width={width - 40} height="88" rx="14" fill="#fff" stroke="#e1e9f3" />
              <rect x="30" y={definition.y - 32} width="185" height="64" rx="12" fill={definition.color} fillOpacity=".08" stroke={definition.color} strokeOpacity=".22" />
              <circle cx="55" cy={definition.y} r="17" fill={definition.color} />
              <text x="55" y={definition.y + 5} textAnchor="middle" fill="#fff" fontSize="12" fontWeight="950">%</text>
              <text x="81" y={definition.y - 3} fill={definition.color} fontSize="11" fontWeight="950">{definition.title.toLocaleUpperCase('es-CO')}</text>
              <text x="81" y={definition.y + 13} fill="#64748b" fontSize="8.5" fontWeight="750">{definition.formula}</text>
              {annualRows.map((row, index) => {
                const value = Number(row[definition.field] || 0);
                const progress = Math.max(0, Math.min(100, value));
                const cx = left + index * slot + slot / 2;
                return (
                  <g key={`${definition.field}-${row.year}`} filter={`url(#conversion-shadow-${scope})`}>
                    <circle cx={cx} cy={definition.y} r={gaugeRadius} fill="#f1f5f9" stroke="#e1e8f1" strokeWidth="1" />
                    <circle cx={cx} cy={definition.y} r={gaugeRadius} fill="none" stroke={definition.color} strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(progress / 100) * circumference} ${circumference}`} transform={`rotate(-90 ${cx} ${definition.y})`} />
                    <text x={cx} y={definition.y + 4} textAnchor="middle" fill={definition.color} fontSize={slot < 80 ? 8 : 10} fontWeight="950">{pct(value)}%</text>
                  </g>
                );
              })}
            </g>
          ))}
        </Box>
      </Box>
      <Box sx={{ px: { xs: 1.2, md: 2 }, pb: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1 }}>
        {[
          { title: `Selectividad ${latest.year}`, value: `${pct(latest.selectividad)}%`, text: `De cada 100 inscritos, ${Math.round(latest.selectividad)} fueron admitidos.`, color: '#245fc7' },
          { title: `Absorción ${latest.year}`, value: `${pct(latest.absorcion)}%`, text: `De cada 100 admitidos, ${Math.round(latest.absorcion)} ingresaron a primer curso.`, color: '#239447' },
          { title: `Conversión total ${latest.year}`, value: `${pct(latest.conversion)}%`, text: `De cada 100 inscritos, ${Math.round(latest.conversion)} llegaron a primer curso.`, color: '#0f766e' }
        ].map((comment) => (
          <Paper key={comment.title} elevation={0} sx={{ p: 1.25, border: `1px solid ${comment.color}35`, borderLeft: `4px solid ${comment.color}`, borderRadius: 2, bgcolor: `${comment.color}08` }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
              <Typography sx={{ color: comment.color, fontSize: 10, fontWeight: 950 }}>{comment.title}</Typography>
              <Chip label={comment.value} size="small" sx={{ height: 22, bgcolor: '#fff', color: comment.color, fontSize: 10, fontWeight: 950 }} />
            </Stack>
            <Typography sx={{ mt: 0.65, color: '#52657c', fontSize: 10.5, lineHeight: 1.35 }}>{comment.text}</Typography>
          </Paper>
        ))}
      </Box>
    </Paper>
  );
}

function PopulationStackedAreaChart({ data, scope }) {
  const series = [
    { field: `primer_curso_${scope}`, label: 'Primer curso', color: '#69a83a', gradient: `area-primer-${scope}` },
    { field: `admitidos_${scope}`, label: 'Admitidos', color: '#1695a6', gradient: `area-admitidos-${scope}` },
    { field: `inscritos_${scope}`, label: 'Inscritos', color: '#2f6fed', gradient: `area-inscritos-${scope}` }
  ];
  const visibleData = data.filter((row) => series.some((item) => Number(row[item.field] || 0) > 0));
  if (!visibleData.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;
  const width = 1200;
  const height = 445;
  const margin = { left: 70, right: 24, top: 78, bottom: 68 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const maxStack = Math.max(1, ...visibleData.map((row) => series.reduce((total, item) => total + Number(row[item.field] || 0), 0)));
  const maxValue = maxStack * 1.08;
  const x = (index) => margin.left + index * chartWidth / Math.max(1, visibleData.length - 1);
  const y = (value) => margin.top + chartHeight - (value / maxValue) * chartHeight;
  const accumulated = visibleData.map(() => 0);
  const areaLayers = series.map((item) => {
    const bottoms = [...accumulated];
    const tops = visibleData.map((row, index) => {
      accumulated[index] += Number(row[item.field] || 0);
      return accumulated[index];
    });
    return { ...item, bottoms, tops };
  });
  const legend = [...series].reverse();

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Área apilada por periodo</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Composición semestral del flujo de ingreso en una sola superficie comparativa.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: { xs: 0.4, md: 1.2 }, pb: 1.2, overflow: 'hidden' }}>
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="xMidYMid meet" sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 470 }}>
          <defs>
            {series.map((item) => <linearGradient key={item.gradient} id={item.gradient} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={item.color} stopOpacity=".98" /><stop offset="100%" stopColor={item.color} stopOpacity=".78" /></linearGradient>)}
          </defs>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          {Array.from({ length: 6 }, (_, index) => {
            const gridValue = maxValue * (1 - index / 5);
            const gridY = margin.top + index * chartHeight / 5;
            return <g key={`area-grid-${index}`}><line x1={margin.left} y1={gridY} x2={width - margin.right} y2={gridY} stroke="#dfe7f1" strokeDasharray="4 5" /><text x={margin.left - 12} y={gridY + 4} textAnchor="end" fill="#52657c" fontSize="9" fontWeight="800">{numberFormat.format(Math.round(gridValue))}</text></g>;
          })}
          {legend.map((item, index) => {
            const lx = width / 2 - 190 + index * 190;
            return <g key={`area-legend-${item.field}`}><rect x={lx} y="34" width="13" height="13" rx="3" fill={item.color} /><text x={lx + 20} y="45" fill="#334155" fontSize="10" fontWeight="900">{item.label}</text></g>;
          })}
          {areaLayers.map((item) => {
            const topPoints = item.tops.map((value, index) => `${x(index)},${y(value)}`).join(' ');
            const bottomPoints = item.bottoms.map((value, index) => `${x(index)},${y(value)}`).reverse().join(' ');
            return <polygon key={`area-layer-${item.field}`} points={`${topPoints} ${bottomPoints}`} fill={`url(#${item.gradient})`} stroke={item.color} strokeWidth="1.5" strokeLinejoin="miter" />;
          })}
          {areaLayers.map((item) => visibleData.map((row, index) => {
            const value = Number(row[item.field] || 0);
            if (!value) return null;
            const centerY = (y(item.tops[index]) + y(item.bottoms[index])) / 2;
            return <text key={`area-value-${item.field}-${row.periodo}`} x={x(index)} y={centerY + 3.5} textAnchor="middle" fill="#fff" fontSize={visibleData.length > 16 ? 7.2 : 8.8} fontWeight="950" stroke={item.color} strokeWidth="2.2" paintOrder="stroke">{numberFormat.format(value)}</text>;
          }))}
          <line x1={margin.left} y1={margin.top + chartHeight} x2={width - margin.right} y2={margin.top + chartHeight} stroke="#8ea2bc" strokeWidth="1.3" />
          {visibleData.map((row, index) => {
            const [year, semester] = String(row.periodo || '').split('-');
            return <g key={`area-period-${row.periodo}`}><line x1={x(index)} y1={margin.top + chartHeight} x2={x(index)} y2={margin.top + chartHeight + 7} stroke="#8ea2bc" /><text x={x(index)} y={height - 42} textAnchor="middle" fill="#315275" fontSize="8.5" fontWeight="900">{semester === '1' ? 'I' : semester === '2' ? 'II' : semester}</text><text x={x(index)} y={height - 23} textAnchor="middle" fill="#0f2f5e" fontSize="9" fontWeight="950">{year}</text></g>;
          })}
        </Box>
      </Box>
    </Paper>
  );
}

function PopulationFunnelChart({ data, scope }) {
  const series = [
    { field: `inscritos_${scope}`, label: 'Inscritos', color: '#082b66' },
    { field: `admitidos_${scope}`, label: 'Admitidos', color: '#1f67bd' },
    { field: `primer_curso_${scope}`, label: 'Primer curso', color: '#27a861' }
  ];
  const chartData = data.filter((row) => series.some((serie) => Number(row[serie.field] || 0) > 0));
  const maxValue = Math.max(1, ...chartData.flatMap((row) => series.map((serie) => Number(row[serie.field] || 0))));
  const canvasWidth = 1200;
  const canvasHeight = 326;
  const legendWidth = 142;
  const chartRight = 18;
  const slotWidth = (canvasWidth - legendWidth - chartRight) / Math.max(1, chartData.length);
  const stageTop = 75;
  const stageHeight = 61;
  const stageGap = 5;

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.5 }}>
        <Box>
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>Trayectoria de acceso por período</Typography>
          <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Comparación visual de inscritos, admitidos y estudiantes que ingresan a primer curso.</Typography>
        </Box>
        <Chip label={scope === 'nacional' ? 'Nacional' : 'Regional'} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
      </Stack>
      <Box sx={{ px: 2.2, py: 0.72, bgcolor: '#082b66', color: '#fff', textAlign: 'center', fontSize: 11.5, fontWeight: 950, letterSpacing: 0.7 }}>EMBUDO COMPARATIVO</Box>

      {!chartData.length ? (
        <Alert severity="info" sx={{ m: 2 }}>No existen datos para el período y programa seleccionados.</Alert>
      ) : (
        <Box sx={{ width: '100%', overflow: 'hidden', bgcolor: '#fbfdff', px: { xs: 0.5, md: 1.2 }, py: 0.5 }}>
          <Box component="svg" viewBox={`0 0 ${canvasWidth} ${canvasHeight}`} preserveAspectRatio="xMidYMid meet" sx={{ display: 'block', width: '100%', height: 'auto', maxHeight: { xs: 360, md: 350 } }}>
            <defs>
              <filter id={`funnel-shadow-${scope}`} x="-20%" y="-20%" width="140%" height="150%"><feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#17324d" floodOpacity=".2" /></filter>
            </defs>
            <rect width={canvasWidth} height={canvasHeight} fill="#fbfdff" />
            <rect x="8" y="14" width={legendWidth - 18} height={canvasHeight - 28} rx="15" fill="#f3f7fc" stroke="#d8e3f0" />
            {series.map((serie, index) => {
              const centerY = stageTop + index * (stageHeight + stageGap) + stageHeight / 2;
              return (
                <g key={`funnel-legend-${serie.field}`} transform={`translate(17 ${centerY})`}>
                  <rect x="0" y="-18" width="105" height="36" rx="10" fill="#fff" stroke={serie.color} strokeOpacity=".3" />
                  <circle cx="14" cy="0" r="7" fill={serie.color} />
                  <text x="27" y="-2" fill={serie.color} fontSize="9.2" fontWeight="950">{serie.label.toLocaleUpperCase('es-CO')}</text>
                  <text x="27" y="10" fill="#64748b" fontSize="7.5">Etapa {index + 1}</text>
                </g>
              );
            })}
            {chartData.map((row, rowIndex) => {
              const centerX = legendWidth + rowIndex * slotWidth + slotWidth / 2;
              const [year, semester] = String(row.periodo || '').split('-');
              return (
                <g key={`funnel-period-${row.periodo}`}>
                  {rowIndex > 0 && <line x1={legendWidth + rowIndex * slotWidth} y1="18" x2={legendWidth + rowIndex * slotWidth} y2={canvasHeight - 18} stroke="#e5edf6" strokeDasharray="3 5" />}
                  <text x={centerX} y="30" textAnchor="middle" fill="#102a4c" fontSize="9.5" fontWeight="950">{year}</text>
                  <rect x={centerX - 11} y="37" width="22" height="15" rx="7.5" fill="#e7edf5" />
                  <text x={centerX} y="48" textAnchor="middle" fill="#52657c" fontSize="7.5" fontWeight="900">{semester === '1' ? 'I' : semester === '2' ? 'II' : semester}</text>
                  {series.map((serie, stageIndex) => {
                    const value = Number(row[serie.field] || 0);
                    const maxSegmentWidth = Math.max(30, Math.min(58, slotWidth * 0.76));
                    const width = Math.max(24, Math.sqrt(value / maxValue) * maxSegmentWidth);
                    const nextValue = stageIndex < series.length - 1 ? Number(row[series[stageIndex + 1].field] || 0) : value * 0.72;
                    const bottomWidth = Math.max(19, Math.min(width - 3, Math.sqrt(nextValue / maxValue) * (maxSegmentWidth - 4)));
                    const topY = stageTop + stageIndex * (stageHeight + stageGap);
                    const points = `${centerX - width / 2},${topY} ${centerX + width / 2},${topY} ${centerX + bottomWidth / 2},${topY + stageHeight} ${centerX - bottomWidth / 2},${topY + stageHeight}`;
                    return (
                      <g key={`${row.periodo}-${serie.field}`} filter={`url(#funnel-shadow-${scope})`}>
                        <polygon points={points} fill={serie.color} stroke="#fff" strokeWidth="1.8" />
                        <text x={centerX} y={topY + stageHeight / 2 + 3} textAnchor="middle" fill="#fff" fontSize={value >= 100000 ? 6.8 : value >= 10000 ? 7.4 : 8.2} fontWeight="950" stroke={serie.color} strokeWidth="1.4" paintOrder="stroke">{numberFormat.format(value)}</text>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </Box>
        </Box>
      )}
    </Paper>
  );
}

function PopulationSingleMetricAlternative({ data, groupIndex, scope, type }) {
  const isEnrolled = groupIndex === 1;
  const field = `${isEnrolled ? 'matriculados' : 'graduados'}_${scope}`;
  const label = isEnrolled ? 'Matriculados' : 'Graduados';
  const color = isEnrolled ? '#2f6fed' : '#7c3aed';
  const soft = isEnrolled ? '#edf4ff' : '#f4efff';
  const rows = data.filter((row) => Number(row[field] || 0) > 0).sort(periodSort);
  if (!rows.length) return <Alert severity="info">No existen datos para el programa y alcance seleccionados.</Alert>;
  const annualRows = rows.map((row) => ({ year: periodDisplay(row.periodo), value: Number(row[field] || 0) }));
  const scopeLabel = scope === 'nacional' ? 'Nacional' : 'Regional';
  const header = (title, subtitle) => (
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: { xs: 1.5, md: 2.2 }, py: 1.45 }}>
      <Box><Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 15 }}>{title}</Typography><Typography sx={{ color: '#64748b', fontSize: 11.5 }}>{subtitle}</Typography></Box>
      <Chip label={scopeLabel} color="primary" size="small" sx={{ fontWeight: 900, px: 0.8 }} />
    </Stack>
  );

  if (type === 'periodCards') {
    return (
      <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
        {header(`${label} · tarjetas por periodo`, `Detalle individual y variación frente al periodo inmediatamente anterior.`)}
        <Box sx={{ px: { xs: 1.2, md: 2 }, pb: 2, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(205px, 100%), 1fr))', gap: 1.3 }}>
          {rows.map((row, index) => {
            const value = Number(row[field] || 0);
            const previous = index > 0 ? Number(rows[index - 1][field] || 0) : null;
            const change = previous > 0 ? ((value - previous) / previous) * 100 : null;
            const positive = change === null || change >= 0;
            const [year, semester] = String(row.periodo || '').split('-');
            return (
              <Paper key={row.periodo} elevation={0} sx={{ p: 1.5, border: '1px solid #d3deeb', borderTop: `5px solid ${color}`, borderRadius: 2.2, bgcolor: '#fff', boxShadow: '0 6px 18px rgba(15,43,86,.065)' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Chip label={`${year}-${semester === '1' ? 'I' : semester === '2' ? 'II' : semester}`} size="small" sx={{ bgcolor: soft, color, fontWeight: 950 }} />
                  <Typography sx={{ color: change === null ? '#64748b' : positive ? '#15803d' : '#dc2626', fontSize: 10, fontWeight: 950 }}>{change === null ? 'Periodo base' : `${positive ? '▲' : '▼'} ${Math.abs(change).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`}</Typography>
                </Stack>
                <Typography sx={{ mt: 1.4, color, fontSize: 24, fontWeight: 950, letterSpacing: -0.7 }}>{numberFormat.format(value)}</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 10.5, fontWeight: 800 }}>{label}</Typography>
                <Box sx={{ mt: 1.2, height: 5, borderRadius: 4, bgcolor: '#e7edf5', overflow: 'hidden' }}><Box sx={{ width: `${Math.max(5, value / Math.max(...rows.map((item) => Number(item[field] || 0))) * 100)}%`, height: '100%', bgcolor: color, borderRadius: 4 }} /></Box>
              </Paper>
            );
          })}
        </Box>
      </Paper>
    );
  }

  if (type === 'indicators') {
    const values = rows.map((row) => Number(row[field] || 0));
    const latest = values[values.length - 1];
    const previous = values[values.length - 2] || 0;
    const variation = previous > 0 ? ((latest - previous) / previous) * 100 : 0;
    const indicators = [
      ['Último período', latest, color],
      ['Total acumulado', values.reduce((sum, value) => sum + value, 0), '#123b7a'],
      ['Promedio por período', Math.round(values.reduce((sum, value) => sum + value, 0) / values.length), '#0f766e'],
      ['Valor máximo', Math.max(...values), '#15803d'],
      ['Valor mínimo', Math.min(...values), '#b45309'],
      ['Variación reciente', `${variation >= 0 ? '+' : ''}${variation.toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`, variation >= 0 ? '#15803d' : '#dc2626']
    ];
    return (
      <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
        {header(`${label} · tablero de indicadores`, 'Resumen ejecutivo calculado con los períodos visibles.')}
        <Box sx={{ px: { xs: 1.5, md: 2.2 }, pb: 2.2, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' }, gap: 1.3 }}>
          {indicators.map(([title, value, indicatorColor]) => <Paper key={title} elevation={0} sx={{ p: 1.8, border: '1px solid #d7e1ed', borderLeft: `6px solid ${indicatorColor}`, borderRadius: 2.2, bgcolor: '#fbfdff' }}><Typography sx={{ color: '#64748b', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase' }}>{title}</Typography><Typography sx={{ mt: 0.6, color: indicatorColor, fontSize: 24, fontWeight: 950 }}>{typeof value === 'number' ? numberFormat.format(value) : value}</Typography></Paper>)}
        </Box>
      </Paper>
    );
  }

  const chartRows = ['timeline', 'journey', 'conversion'].includes(type) ? annualRows.map((row) => ({ periodo: row.year, [field]: row.value })) : rows;
  const width = 1200;
  const height = type === 'timeline' ? 330 : 390;
  const left = 72;
  const right = 1160;
  const top = 70;
  const bottom = type === 'timeline' ? 255 : 315;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const maxValue = Math.max(1, ...chartRows.map((row) => Number(row[field] || 0))) * 1.12;
  const x = (index) => left + index * plotWidth / Math.max(1, chartRows.length - 1);
  const y = (value) => bottom - Number(value || 0) / maxValue * plotHeight;

  if (type === 'funnel') {
    const slot = plotWidth / chartRows.length;
    const values = chartRows.map((row) => Number(row[field] || 0));
    const maximum = Math.max(...values);
    return (
      <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
        {header(`${label} · embudo comparativo`, 'Comparación proporcional entre períodos; cada embudo conserva su valor completo.')}
        <Box component="svg" viewBox={`0 0 ${width} 390`} sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 420 }}>
          <rect x="8" y="8" width={width - 16} height="374" rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          {chartRows.map((row, index) => {
            const value = values[index]; const cx = left + index * slot + slot / 2; const factor = value / maximum; const halfTop = Math.max(11, slot * 0.39 * factor); const halfBottom = Math.max(7, halfTop * 0.72); const [year, semester] = String(row.periodo).split('-');
            return <g key={`single-funnel-${row.periodo}`}><polygon points={`${cx - halfTop},95 ${cx + halfTop},95 ${cx + halfBottom},260 ${cx - halfBottom},260`} fill={color} opacity={0.9} stroke="#fff" strokeWidth="2" /><text x={cx} y="181" textAnchor="middle" fill="#fff" fontSize={chartRows.length > 16 ? 7 : 9} fontWeight="950">{numberFormat.format(value)}</text><text x={cx} y="292" textAnchor="middle" fill="#315275" fontSize="8" fontWeight="900">{semester === '1' ? 'I' : semester === '2' ? 'II' : ''}</text><text x={cx} y="311" textAnchor="middle" fill="#0f2f5e" fontSize="9" fontWeight="950">{year}</text></g>;
          })}
        </Box>
      </Paper>
    );
  }

  if (type === 'conversion') {
    const base = Number(chartRows[0]?.[field] || 1);
    return (
      <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
        {header(`${label} · índices de evolución`, 'El primer período visible equivale a 100; cada anillo muestra su evolución frente a esa base.')}
        <Box sx={{ px: { xs: 1.4, md: 2.2 }, pb: 2.2, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 1.2 }}>
          {chartRows.map((row, index) => { const value = Number(row[field] || 0); const indexValue = base > 0 ? value / base * 100 : 0; const ring = Math.min(100, indexValue); return <Paper key={`single-index-${row.periodo}`} elevation={0} sx={{ p: 1.4, textAlign: 'center', border: '1px solid #d7e1ed', borderRadius: 2.2 }}><Typography sx={{ color: '#315275', fontSize: 11, fontWeight: 950 }}>{row.periodo}</Typography><Box sx={{ mx: 'auto', my: 1.1, width: 76, height: 76, borderRadius: '50%', display: 'grid', placeItems: 'center', background: `conic-gradient(${color} ${ring}%, #e8eef6 0)` }}><Box sx={{ width: 58, height: 58, borderRadius: '50%', bgcolor: '#fff', display: 'grid', placeItems: 'center' }}><Typography sx={{ color, fontSize: 13, fontWeight: 950 }}>{Math.round(indexValue)}</Typography></Box></Box><Typography sx={{ color: '#64748b', fontSize: 9, fontWeight: 800 }}>{index === 0 ? 'BASE 100' : numberFormat.format(value)}</Typography></Paper>; })}
        </Box>
      </Paper>
    );
  }

  if (type === 'journey') {
    const journeyPoints = chartRows.map((row, index) => `${x(index)},${y(row[field])}`).join(' ');
    return (
      <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
        {header(`${label} · recorrido histórico`, 'Camino por período del indicador con valores y cambios de dirección claramente identificados.')}
        <Box component="svg" viewBox={`0 0 ${width} 350`} sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 390 }}>
          <rect x="8" y="8" width={width - 16} height="334" rx="18" fill="#fbfdff" stroke="#d8e3f0" /><polyline points={journeyPoints} fill="none" stroke={color} strokeOpacity=".16" strokeWidth="16" strokeLinecap="round" strokeLinejoin="miter" /><polyline points={journeyPoints} fill="none" stroke={color} strokeWidth="3" strokeLinejoin="miter" />
          {chartRows.map((row, index) => { const value = Number(row[field] || 0); const cx = x(index); const cy = y(value); return <g key={`single-journey-${row.periodo}`}><circle cx={cx} cy={cy} r="17" fill={color} stroke="#fff" strokeWidth="3" /><text x={cx} y={cy + 4} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="950">{isEnrolled ? 'M' : 'G'}</text><text x={cx} y={cy - 27} textAnchor="middle" fill={color} fontSize="9" fontWeight="950">{numberFormat.format(value)}</text><text x={cx} y="326" textAnchor="middle" fill="#0f2f5e" fontSize="9" fontWeight="950">{row.periodo}</text></g>; })}
        </Box>
      </Paper>
    );
  }

  if (type === 'timeline') {
    const slot = (right - left) / chartRows.length;
    const cardWidth = Math.max(42, Math.min(130, slot - 8));
    return (
      <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
        {header(`${label} · historia por período`, 'Secuencia cronológica de los valores de cada período académico.')}
        <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 350 }}>
          <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
          <line x1={left + slot / 2} y1="270" x2={right - slot / 2 + 18} y2="270" stroke="#a8b8cc" strokeWidth="2" strokeDasharray="5 4" />
          {chartRows.map((row, index) => {
            const cx = left + index * slot + slot / 2;
            const cardX = cx - cardWidth / 2;
            const value = Number(row[field] || 0);
            const previous = index > 0 ? Number(chartRows[index - 1][field] || 0) : null;
            const change = previous > 0 ? ((value - previous) / previous) * 100 : null;
            return <g key={row.periodo}><rect x={cardX} y="55" width={cardWidth} height="174" rx="15" fill="#fff" stroke="#d2ddeb" /><rect x={cardX} y="55" width={cardWidth} height="42" rx="15" fill={color} /><path d={`M${cardX} 82H${cardX + cardWidth}V97H${cardX}Z`} fill={color} /><text x={cx} y="82" textAnchor="middle" fill="#fff" fontSize="12" fontWeight="950">{row.periodo}</text><circle cx={cx} cy="133" r="23" fill={soft} stroke={color} strokeWidth="2" /><text x={cx} y="138" textAnchor="middle" fill={color} fontSize="15" fontWeight="950">{isEnrolled ? 'M' : 'G'}</text><text x={cx} y="181" textAnchor="middle" fill={color} fontSize={cardWidth < 90 ? 9 : 12} fontWeight="950">{numberFormat.format(value)}</text><text x={cx} y="202" textAnchor="middle" fill={change === null ? '#64748b' : change >= 0 ? '#15803d' : '#dc2626'} fontSize="9" fontWeight="900">{change === null ? 'Período base' : `${change >= 0 ? '▲' : '▼'} ${Math.abs(change).toLocaleString('es-CO', { maximumFractionDigits: 1 })}%`}</text><line x1={cx} y1="229" x2={cx} y2="263" stroke="#a8b8cc" /><circle cx={cx} cy="270" r="7" fill="#fff" stroke={color} strokeWidth="3" /></g>;
          })}
        </Box>
      </Paper>
    );
  }

  const points = chartRows.map((row, index) => `${x(index)},${y(row[field])}`).join(' ');
  const chartTitle = type === 'shaded' ? `${label} · área sombreada` : type === 'stackedArea' ? `${label} · área acumulada` : `${label} · círculos proporcionales`;
  const chartSubtitle = type === 'shaded' ? 'Evolución por periodo con superficie de tendencia.' : type === 'stackedArea' ? 'Magnitud total de cada período representada como una superficie continua.' : 'El área de cada círculo representa la magnitud del periodo.';
  const maxRadius = 34;
  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd9ea', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      {header(chartTitle, chartSubtitle)}
      <Box component="svg" viewBox={`0 0 ${width} ${height}`} sx={{ width: '100%', height: 'auto', display: 'block', maxHeight: 420 }}>
        <defs><linearGradient id={`single-area-${groupIndex}-${scope}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity=".42" /><stop offset="100%" stopColor={color} stopOpacity=".04" /></linearGradient></defs>
        <rect x="8" y="8" width={width - 16} height={height - 16} rx="18" fill="#fbfdff" stroke="#d8e3f0" />
        {Array.from({ length: 5 }, (_, index) => { const gy = top + index * plotHeight / 4; const value = maxValue * (1 - index / 4); return <g key={`single-grid-${index}`}><line x1={left} y1={gy} x2={right} y2={gy} stroke="#dfe7f1" strokeDasharray="4 5" /><text x={left - 12} y={gy + 4} textAnchor="end" fill="#52657c" fontSize="9" fontWeight="800">{numberFormat.format(Math.round(value))}</text></g>; })}
        {['shaded', 'stackedArea'].includes(type) && <><polygon points={`${left},${bottom} ${points} ${right},${bottom}`} fill={type === 'shaded' ? `url(#single-area-${groupIndex}-${scope})` : color} fillOpacity={type === 'stackedArea' ? '.76' : '1'} /><polyline points={points} fill="none" stroke={color} strokeWidth="3.2" strokeLinejoin="miter" /></>}
        {chartRows.map((row, index) => {
          const value = Number(row[field] || 0);
          const cx = x(index);
          const cy = type === 'bubbles' ? 185 : y(value);
          const radius = type === 'bubbles' ? 10 + Math.sqrt(value / maxValue) * maxRadius : 5;
          const [year, semester] = String(row.periodo || '').split('-');
          return <g key={`${type}-${row.periodo}`}><circle cx={cx} cy={cy} r={radius} fill={color} fillOpacity={type === 'bubbles' ? '.9' : '1'} stroke="#fff" strokeWidth="2" /><text x={cx} y={type === 'bubbles' ? cy + 4 : cy - 11} textAnchor="middle" fill={type === 'bubbles' ? '#fff' : color} fontSize={chartRows.length > 16 ? 7 : 9} fontWeight="950" stroke={type === 'bubbles' ? color : '#fff'} strokeWidth="2.2" paintOrder="stroke">{numberFormat.format(value)}</text><text x={cx} y="345" textAnchor="middle" fill="#315275" fontSize="8" fontWeight="900">{semester ? (semester === '1' ? 'I' : 'II') : ''}</text><text x={cx} y="362" textAnchor="middle" fill="#0f2f5e" fontSize="9" fontWeight="950">{year}</text></g>;
        })}
      </Box>
    </Paper>
  );
}

function PopulationChartSwitcher({ data, groupIndex, selection, onSelectionChange }) {
  const chartType = selection?.chartType || 'stacked';
  const scope = selection?.scope || 'nacional';
  const setChartType = (nextChartType) => onSelectionChange?.({ chartType: nextChartType, scope });
  const setScope = (nextScope) => onSelectionChange?.({ chartType, scope: nextScope });
  const chartOptions = groupIndex === 0
    ? [
      ['stacked', 'Columnas apiladas'],
      ['trend', 'Líneas de tendencia'],
      ['funnel', 'Embudo comparativo'],
      ['indicators', 'Tablero de indicadores'],
      ['shaded', 'Áreas sombreadas'],
      ['bubbles', 'Círculos proporcionales'],
      ['periodCards', 'Tarjetas por periodo'],
      ['journey', 'Camino del estudiante'],
      ['timeline', 'Historia por período'],
      ['conversion', 'Conversión por período'],
      ['stackedArea', 'Área apilada']
    ]
    : [
      ['stacked', 'Columnas'],
      ['trend', 'Líneas de tendencia'],
      ['funnel', 'Embudo comparativo'],
      ['indicators', 'Tablero de indicadores'],
      ['shaded', 'Área sombreada'],
      ['bubbles', 'Círculos proporcionales'],
      ['periodCards', 'Tarjetas por periodo'],
      ['journey', 'Camino histórico'],
      ['timeline', 'Historia por período'],
      ['conversion', 'Índices de evolución'],
      ['stackedArea', 'Área acumulada']
    ];
  return (
    <Stack spacing={1.5}>
      <Paper elevation={0} sx={{ p: 0.9, border: '1px solid #cbd9ea', borderRadius: 3, bgcolor: '#fff', boxShadow: '0 5px 18px rgba(15,43,86,.05)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} spacing={1}>
          <Stack direction="row" sx={{ flex: 1, minWidth: 0, p: 0.4, gap: 0.45, overflowX: 'auto', flexWrap: 'nowrap', bgcolor: '#eef3f9', borderRadius: 2.2, scrollbarWidth: 'thin', '&::-webkit-scrollbar': { height: 4 }, '&::-webkit-scrollbar-thumb': { bgcolor: '#bfd0e5', borderRadius: 4 } }}>
            {chartOptions.map(([value, label]) => (
              <Button
                key={value}
                size="small"
                onClick={() => setChartType(value)}
                variant={chartType === value ? 'contained' : 'text'}
                disableElevation
                sx={{ flex: '0 0 auto', minWidth: 'auto', px: 1.45, py: 0.72, borderRadius: 1.7, whiteSpace: 'nowrap', textTransform: 'none', fontSize: 10.5, fontWeight: 900, color: chartType === value ? '#fff' : '#315275', '&:hover': { bgcolor: chartType === value ? '#245ed3' : '#dde8f5' } }}
              >
                {label}
              </Button>
            ))}
          </Stack>
          <Stack direction="row" spacing={0.35} sx={{ flex: '0 0 auto', p: 0.4, bgcolor: '#eef3f9', borderRadius: 2.2 }}>
            {['nacional', 'regional'].map((option) => (
              <Button key={option} size="small" onClick={() => setScope(option)} variant={scope === option ? 'contained' : 'text'} disableElevation sx={{ flex: 1, minWidth: { xs: 105, md: 92 }, px: 1.5, py: 0.72, borderRadius: 1.7, textTransform: 'capitalize', fontSize: 10.5, fontWeight: 900 }}>{option}</Button>
            ))}
          </Stack>
        </Stack>
      </Paper>
      {chartType === 'stacked' && <PopulationStackedChart data={data} groupIndex={groupIndex} scope={scope} />}
      {chartType === 'trend' && <PopulationTrendChart data={data} groupIndex={groupIndex} scope={scope} />}
      {chartType === 'funnel' && groupIndex === 0 && <PopulationFunnelChart data={data} scope={scope} />}
      {chartType === 'indicators' && groupIndex === 0 && <PopulationIndicatorTrendBoard data={data} scope={scope} />}
      {chartType === 'shaded' && groupIndex === 0 && <PopulationShadedTrendChart data={data} scope={scope} />}
      {chartType === 'bubbles' && groupIndex === 0 && <PopulationBubbleMatrixChart data={data} scope={scope} />}
      {chartType === 'periodCards' && groupIndex === 0 && <PopulationPeriodCards data={data} scope={scope} />}
      {chartType === 'journey' && groupIndex === 0 && <PopulationStudentJourneyChart data={data} scope={scope} />}
      {chartType === 'timeline' && groupIndex === 0 && <PopulationAnnualTimelineChart data={data} scope={scope} />}
      {chartType === 'conversion' && groupIndex === 0 && <PopulationConversionChart data={data} scope={scope} />}
      {chartType === 'stackedArea' && groupIndex === 0 && <PopulationStackedAreaChart data={data} scope={scope} />}
      {groupIndex !== 0 && ['funnel', 'indicators', 'shaded', 'bubbles', 'periodCards', 'journey', 'timeline', 'conversion', 'stackedArea'].includes(chartType) && <PopulationSingleMetricAlternative data={data} groupIndex={groupIndex} scope={scope} type={chartType} />}
    </Stack>
  );
}

function ProgramSummaryTable({ title, rows, color }) {
  const total = rows.reduce((acc, row) => acc + row.total, 0);
  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.2, bgcolor: color, color: '#fff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography sx={{ fontWeight: 900, fontSize: 13 }}>{title}</Typography>
          <Chip size="small" label={`${numberFormat.format(total)} registros`} sx={{ bgcolor: 'rgba(255,255,255,.18)', color: '#fff', fontWeight: 800 }} />
        </Stack>
      </Box>
      <TableContainer sx={{ maxHeight: 480 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 900, color: '#082b66' }}>PROGRAMAS ACADÉMICOS ANALIZADOS</TableCell>
              <TableCell align="right" sx={{ width: 110, fontWeight: 900, color: '#082b66' }}>TOTAL</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${row.key}-${index}`} hover>
                <TableCell sx={{ fontSize: 12.5 }}>{row.label}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900 }}>{numberFormat.format(row.total)}</TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: '#f1f5f9' }}>
              <TableCell sx={{ fontWeight: 900 }}>Total</TableCell>
              <TableCell align="right" sx={{ fontWeight: 900 }}>{numberFormat.format(total)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

const VIBRANT_PALETTE = ['#2563eb', '#d97706', '#10b981', '#ec4899', '#8b5cf6', '#0284c7', '#ca8a04', '#e11d48', '#059669', '#7c3aed', '#9f1239'];

function MunicipalityGoogleMapsModal({ open, municipalityName, filteredOffer, onClose }) {
  const [activeInstName, setActiveInstName] = useState(null);
  const [mapType, setMapType] = useState('m');

  const instSummary = useMemo(() => {
    if (!open || !municipalityName) return [];
    const map = new Map();
    filteredOffer.forEach((row) => {
      const muni = String(row.municipio || '').trim();
      if (normalizeGeo(muni) === normalizeGeo(municipalityName)) {
        const inst = String(row.institucion || row.institucion_educativa || 'Institución de Educación Superior').trim();
        const sector = String(row.sector || '').trim();
        const norm = normalize(inst);
        if (!map.has(norm)) {
          map.set(norm, { name: formatGeoLabel(inst), rawName: inst, count: 0, sector });
        }
        map.get(norm).count += 1;
      }
    });

    return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'));
  }, [open, filteredOffer, municipalityName]);

  useEffect(() => {
    if (instSummary.length > 0) {
      setActiveInstName(instSummary[0].rawName);
    } else {
      setActiveInstName(null);
    }
  }, [open, municipalityName, instSummary]);

  if (!open || !municipalityName) return null;

  const currentInst = instSummary.find((i) => i.rawName === activeInstName) || instSummary[0];
  const targetQuery = currentInst
    ? `${currentInst.rawName}, ${municipalityName}, Colombia`
    : `universidades en ${municipalityName}, Colombia`;

  const embedUrl = `https://maps.google.com/maps?q=${encodeURIComponent(targetQuery)}&t=${mapType}&z=16&ie=UTF8&iwloc=&output=embed`;
  const externalUrl = `https://www.google.com/maps/search/${encodeURIComponent(targetQuery)}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth PaperProps={{ sx: { borderRadius: 3, overflow: 'hidden' } }}>
      <DialogTitle sx={{ m: 0, p: 2, bgcolor: '#1d4ed8', color: '#ffffff' }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Stack direction="row" spacing={1} alignItems="center">
            <PlaceRoundedIcon />
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: 16 }}>
                {`Ubicación y Vista Satelital de Universidades en ${municipalityName}`}
              </Typography>
              <Typography sx={{ fontSize: 11.5, opacity: 0.9 }}>
                Imágenes satelitales reales del campus, ubicación interactiva y sedes registradas
              </Typography>
            </Box>
          </Stack>
          <IconButton onClick={onClose} sx={{ color: '#fff' }}>
            <CloseRoundedIcon />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
        <Stack spacing={2}>
          {/* Featured University Real Satellite Map Banner */}
          {currentInst && (
            <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #cbd5e1', borderRadius: 2.5, bgcolor: '#ffffff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                <Paper
                  elevation={0}
                  sx={{
                    width: { xs: '100%', sm: 220 },
                    height: 120,
                    borderRadius: 2,
                    overflow: 'hidden',
                    border: '1.5px solid #0284c7',
                    flexShrink: 0,
                    position: 'relative'
                  }}
                >
                  <Box sx={{ position: 'absolute', top: 4, left: 4, zIndex: 5, bgcolor: 'rgba(15,23,42,0.88)', color: '#38bdf8', px: 0.8, py: 0.2, borderRadius: 1, fontSize: 9, fontWeight: 900 }}>
                    🛰️ VISTA SATELITAL REAL
                  </Box>
                  <iframe
                    key={`mini-sat-${currentInst.rawName}`}
                    title={`Vista Satelital ${currentInst.name}`}
                    width="100%"
                    height="100%"
                    style={{ border: 0, pointerEvents: 'none' }}
                    src={`https://maps.google.com/maps?q=${encodeURIComponent(`${currentInst.rawName}, ${municipalityName}, Colombia`)}&t=k&z=17&ie=UTF8&iwloc=&output=embed`}
                  />
                </Paper>

                <Box sx={{ flexGrow: 1, width: '100%' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                    <Chip label="SEDE ENFOCADA" size="small" sx={{ bgcolor: '#1e40af', color: '#fff', fontWeight: 900, fontSize: 9.5 }} />
                    {currentInst.sector && <Chip label={currentInst.sector} size="small" variant="outlined" sx={{ fontWeight: 800, fontSize: 9.5 }} />}
                  </Stack>
                  <Typography sx={{ fontWeight: 950, fontSize: 16, color: '#0f172a', mb: 0.5 }}>
                    {currentInst.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: '#475569', fontWeight: 700 }}>
                    📍 {`${municipalityName}, Colombia`} · 🎓 {`${currentInst.count} programa(s) ofertado(s)`}
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          )}

          {instSummary.length > 0 && (
            <Paper elevation={0} sx={{ p: 1.2, border: '1px solid #cbd5e1', borderRadius: 2.5, bgcolor: '#fff' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#475569', mb: 1, textTransform: 'uppercase' }}>
                Selecciona una universidad para enfocar en el mapa:
              </Typography>
              <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5 }}>
                {instSummary.map((inst) => {
                  const isSelected = currentInst?.rawName === inst.rawName;
                  return (
                    <Chip
                      key={inst.rawName}
                      label={`${inst.name} (${inst.count})`}
                      clickable
                      color={isSelected ? 'primary' : 'default'}
                      variant={isSelected ? 'filled' : 'outlined'}
                      onClick={() => setActiveInstName(inst.rawName)}
                      icon={<SchoolRoundedIcon sx={{ fontSize: 15 }} />}
                      sx={{ fontWeight: 850, fontSize: 11, py: 1.8, borderRadius: 2 }}
                    />
                  );
                })}
              </Stack>
            </Paper>
          )}

          <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 2.5, overflow: 'hidden', height: 380, bgcolor: '#e2e8f0', position: 'relative' }}>
            {/* Satellite / Roadmap Toggle Buttons */}
            <Box sx={{ position: 'absolute', top: 12, right: 12, zIndex: 14, bgcolor: '#ffffff', p: 0.4, borderRadius: 2, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
              <Stack direction="row" spacing={0.5}>
                <Button
                  size="small"
                  variant={mapType === 'm' ? 'contained' : 'text'}
                  onClick={() => setMapType('m')}
                  sx={{ fontSize: 10.5, fontWeight: 900, py: 0.3, px: 1, minWidth: 64 }}
                >
                  🗺️ Callejero
                </Button>
                <Button
                  size="small"
                  variant={mapType === 'k' ? 'contained' : 'text'}
                  onClick={() => setMapType('k')}
                  sx={{ fontSize: 10.5, fontWeight: 900, py: 0.3, px: 1, minWidth: 64 }}
                >
                  🛰️ Satélite
                </Button>
              </Stack>
            </Box>

            {/* Target Pin Marker overlay pointing directly to map center */}
            <Box
              sx={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -100%)',
                zIndex: 12,
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center'
              }}
            >
              <Paper
                elevation={8}
                sx={{
                  px: 1.6,
                  py: 0.8,
                  bgcolor: '#0f172a',
                  color: '#ffffff',
                  borderRadius: 2.5,
                  border: '1.5px solid #38bdf8',
                  textAlign: 'center',
                  boxShadow: '0 10px 24px rgba(0,0,0,0.4)',
                  mb: 0.6,
                  whiteSpace: 'nowrap'
                }}
              >
                <Typography sx={{ fontSize: 12, fontWeight: 950, color: '#38bdf8' }}>
                  📍 {currentInst?.name || municipalityName}
                </Typography>
                <Typography sx={{ fontSize: 10, opacity: 0.9, fontWeight: 700 }}>
                  {`${municipalityName}, Colombia (${currentInst?.count || 1} programa/s)`}
                </Typography>
              </Paper>

              <Box
                sx={{
                  width: 0,
                  height: 0,
                  borderLeft: '7px solid transparent',
                  borderRight: '7px solid transparent',
                  borderTop: '8px solid #0f172a',
                  mt: -0.6
                }}
              />

              <Box sx={{ position: 'relative', mt: 0.5, display: 'grid', placeItems: 'center' }}>
                <Box
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    bgcolor: 'rgba(239, 68, 68, 0.35)',
                    position: 'absolute',
                    animation: 'pulsePin 1.8s infinite ease-in-out',
                    '@keyframes pulsePin': {
                      '0%': { transform: 'scale(0.8)', opacity: 0.9 },
                      '100%': { transform: 'scale(2.2)', opacity: 0 }
                    }
                  }}
                />
                <PlaceRoundedIcon sx={{ fontSize: 38, color: '#ef4444', filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.5))' }} />
              </Box>
            </Box>

            <iframe
              key={`${targetQuery}-${mapType}`}
              title={`Google Maps ${targetQuery}`}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              src={embedUrl}
            />
          </Paper>

          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 14 }}>
                {`Instituciones de Educación Superior en ${municipalityName} (${instSummary.length})`}
              </Typography>
              <Button
                variant="outlined"
                size="small"
                startIcon={<LaunchRoundedIcon />}
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
              >
                Abrir búsqueda en Google Maps
              </Button>
            </Stack>

            {instSummary.length === 0 ? (
              <Alert severity="info">No se registran instituciones con oferta detallada para este municipio en los filtros actuales.</Alert>
            ) : (
              <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' } }}>
                {instSummary.map((inst) => {
                  const isSelected = currentInst?.rawName === inst.rawName;
                  const instMapsUrl = `https://www.google.com/maps/search/${encodeURIComponent(`${inst.rawName} ${municipalityName} Colombia`)}`;
                  return (
                    <Paper
                      key={inst.name}
                      elevation={0}
                      onClick={() => setActiveInstName(inst.rawName)}
                      sx={{
                        p: 1.5,
                        cursor: 'pointer',
                        border: isSelected ? '2px solid #2563eb' : '1px solid #e2e8f0',
                        borderRadius: 2.5,
                        bgcolor: isSelected ? '#eff6ff' : '#fff',
                        transition: 'all .15s ease',
                        boxShadow: isSelected ? '0 6px 16px rgba(37,99,235,0.14)' : 'none',
                        '&:hover': { borderColor: '#3b82f6', transform: 'translateY(-1px)' }
                      }}
                    >
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Paper
                          elevation={0}
                          sx={{
                            width: 76,
                            height: 76,
                            borderRadius: 2,
                            overflow: 'hidden',
                            border: isSelected ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                            flexShrink: 0,
                            position: 'relative',
                            bgcolor: '#0f172a'
                          }}
                        >
                          <iframe
                            key={`tile-${inst.rawName}`}
                            title={`Tile ${inst.name}`}
                            width="100%"
                            height="100%"
                            style={{ border: 0, pointerEvents: 'none' }}
                            src={`https://maps.google.com/maps?q=${encodeURIComponent(`${inst.rawName}, ${municipalityName}, Colombia`)}&t=k&z=16&ie=UTF8&iwloc=&output=embed`}
                          />
                        </Paper>
                        <Stack spacing={0.8} sx={{ flexGrow: 1, minWidth: 0 }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                            <Typography sx={{ fontWeight: 900, fontSize: 12, color: isSelected ? '#1e40af' : '#1e293b', lineHeight: 1.3 }}>
                              {inst.name}
                            </Typography>
                            <Chip size="small" label={`${inst.count} prog`} sx={{ height: 20, bgcolor: isSelected ? '#2563eb' : '#eff6ff', color: isSelected ? '#fff' : '#1d4ed8', fontWeight: 900, fontSize: 10 }} />
                          </Stack>

                          <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                            {inst.sector && <Chip size="small" label={inst.sector} variant="outlined" sx={{ height: 18, fontSize: 9.5, fontWeight: 700 }} />}
                            <Stack direction="row" spacing={0.8} sx={{ ml: 'auto' }}>
                              <Button
                                size="small"
                                variant={isSelected ? 'contained' : 'outlined'}
                                startIcon={<PlaceRoundedIcon sx={{ fontSize: 13 }} />}
                                onClick={(e) => { e.stopPropagation(); setActiveInstName(inst.rawName); }}
                                sx={{ fontSize: 10, fontWeight: 850, textTransform: 'none', py: 0.2 }}
                              >
                                Ver PIN
                              </Button>
                              <IconButton
                                size="small"
                                color="primary"
                                component="a"
                                href={instMapsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir ubicación en nueva pestaña"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <LaunchRoundedIcon sx={{ fontSize: 14 }} />
                              </IconButton>
                            </Stack>
                          </Stack>
                        </Stack>
                      </Stack>
                    </Paper>
                  );
                })}
              </Box>
            )}
          </Box>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#ffffff' }}>
        <Button onClick={onClose} variant="outlined" sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}>
          Cerrar
        </Button>
        <Button
          variant="contained"
          startIcon={<LaunchRoundedIcon />}
          href={externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          sx={{ textTransform: 'none', fontWeight: 900, borderRadius: 2, bgcolor: '#1d4ed8', '&:hover': { bgcolor: '#1e40af' } }}
        >
          {`Navegar ${currentInst?.name || municipalityName} en Google Maps`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const DEPT_OFFSET_MAP = {
  'BOGOTA D C': { dx: 22, dy: -4 },
  'BOGOTA': { dx: 22, dy: -4 },
  'CUNDINAMARCA': { dx: -38, dy: 12 },
  'BOYACA': { dx: 28, dy: -14 },
  'SANTANDER': { dx: -28, dy: -10 },
  'NORTE DE SANTANDER': { dx: 32, dy: -6 },
  'CALDAS': { dx: -34, dy: -10 },
  'RISARALDA': { dx: -34, dy: 6 },
  'QUINDIO': { dx: -34, dy: 18 },
  'TOLIMA': { dx: -24, dy: 24 },
  'HUILA': { dx: -18, dy: 24 }
};

function MacroRegionSubMap({ rows, features, bbox, isRegional }) {
  const departmentTotals = useMemo(() => {
    const totals = new Map();
    rows.forEach((row) => {
      const department = normalizeGeo(row.department_name || row.departamento || row.depto || '');
      if (!department) return;
      totals.set(department, (totals.get(department) || 0) + Number(row.total || 0));
    });
    return totals;
  }, [rows]);

  const regionStats = useMemo(() => {
    const counts = {}; const munis = {};
    REGIONS_DEFINITION.forEach((r) => { counts[r.key] = 0; munis[r.key] = new Set(); });

    rows.forEach((row) => {
      const reg = getRegionForDepartment(row.department_name || row.departamento || row.label);
      if (reg) {
        counts[reg.key] += (row.total || 1);
        if (row.label || row.municipio) munis[reg.key].add(normalizeGeo(row.label || row.municipio));
      }
    });

    return REGIONS_DEFINITION.map((reg) => ({
      ...reg,
      total: counts[reg.key] || 0,
      muniCount: munis[reg.key]?.size || 0,
      connectionIndex: `${((counts[reg.key] || 0) * 1.4 + 10).toFixed(1)} pts`
    })).filter((reg) => !isRegional || reg.key === 'PACIFICA')
      .sort((a, b) => b.total - a.total);
  }, [rows, isRegional]);

  const nodes = useMemo(() => {
    if (!bbox) return [];
    return rows.map((row) => {
      if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) return null;
      const pt = projectGeoPoint({ lon: row.longitude, lat: row.latitude, bbox });
      return { ...row, x: pt.x, y: pt.y };
    }).filter(Boolean);
  }, [rows, bbox]);

  const municipalitiesByDepartment = useMemo(() => {
    const grouped = new Map();
    rows.forEach((row) => {
      const department = normalizeGeo(row.department_name || row.departamento || row.depto || '');
      if (!department) return;
      if (!grouped.has(department)) grouped.set(department, []);
      grouped.get(department).push({
        key: row.key,
        label: row.label || row.municipio,
        total: Number(row.total || 0)
      });
    });
    grouped.forEach((municipalities) => municipalities.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es')));
    return grouped;
  }, [rows]);

  const departmentLabels = useMemo(() => {
    if (!bbox) return [];
    return features.map((feature) => {
      const total = departmentTotals.get(feature.name) || 0;
      if (!total) return null;
      const center = featureCenter(feature.rings);
      if (!center) return null;
      const rawPoint = projectGeoPoint({ ...center, bbox });
      const offset = DEPT_OFFSET_MAP[feature.name] || { dx: 0, dy: 0 };
      const label = String(feature.label || '').toLocaleUpperCase('es-CO');
      const municipalities = municipalitiesByDepartment.get(feature.name) || [];
      const labelWidth = Math.max(78, Math.min(152, label.length * 5.7 + 38));
      const cardWidth = Math.max(126, Math.min(178, Math.max(label.length * 6 + 42, ...municipalities.map((municipality) => String(municipality.label || '').length * 5.2 + 39))));
      const cardHeight = 29 + municipalities.length * 17;
      const proposedPoint = { x: rawPoint.x + offset.dx, y: rawPoint.y + offset.dy };
      return {
        key: feature.name,
        label,
        total,
        rawPoint,
        point: isRegional ? {
          x: Math.max(cardWidth / 2 + 5, Math.min(795 - cardWidth / 2, proposedPoint.x)),
          y: Math.max(cardHeight / 2 + 74, Math.min(595 - cardHeight / 2, proposedPoint.y))
        } : proposedPoint,
        offset,
        labelWidth,
        labelHeight: 20,
        cardWidth,
        cardHeight,
        municipalities
      };
    }).filter(Boolean);
  }, [bbox, departmentTotals, features, isRegional, municipalitiesByDepartment]);

  const legendList = isRegional
    ? REGIONS_DEFINITION.filter((r) => r.key === 'PACIFICA')
    : REGIONS_DEFINITION;

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 360px' }, minHeight: 720, bgcolor: '#eef4f8' }}>
      <Box component="svg" viewBox="0 0 800 600" sx={{ width: '100%', height: { xs: 540, md: 720 }, display: 'block' }}>
        <defs>
          <filter id="macro-sub-shadow" x="-20%" y="-20%" width="140%" height="150%">
            <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#1e293b" floodOpacity=".22" />
          </filter>
        </defs>

        <rect width="800" height="600" fill="#dce6f0" rx="8" />

        <g filter="url(#macro-sub-shadow)">
          {features.map((feature) => {
            const reg = getRegionForDepartment(feature.name);
            return (
              <path
                key={`macro-sub-${feature.name}`}
                d={buildGeoPath(feature.rings, bbox)}
                fill={reg.fill}
                fillOpacity="0.85"
                stroke="#ffffff"
                strokeWidth="1.1"
              >
                <title>{`${feature.label} (${reg.label})`}</title>
              </path>
            );
          })}
        </g>

        {isRegional ? (
          <g transform="translate(228, 24)" pointerEvents="none">
            <rect width="344" height="45" rx="8" fill="#0f172a" fillOpacity=".86" stroke="#fff" strokeWidth="1" />
            <text x="172" y="19" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="950">
              REGIÓN PACÍFICA / SUR-OCCIDENTE
            </text>
            <text x="172" y="35" textAnchor="middle" fill="#dbeafe" fontSize="9.5" fontWeight="800">
              Valle del Cauca · Cauca · Nariño · Putumayo
            </text>
          </g>
        ) : (
          <g pointerEvents="none">
            <text x="410" y="150" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="950" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">CARIBE</text>
            <text x="310" y="290" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="950" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">ANDINA</text>
            <text x="230" y="370" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="950" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">PACÍFICA</text>
            <text x="550" y="320" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="950" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">ORINOQUÍA</text>
            <text x="470" y="500" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="950" stroke="#0f172a" strokeWidth="2.5" paintOrder="stroke">AMAZONÍA</text>
          </g>
        )}

        {departmentLabels.map(({ key, label, total, rawPoint, point, offset, labelWidth, cardWidth, cardHeight, municipalities }) => {
          return (
            <g key={`macro-department-label-${key}`} transform={`translate(${point.x} ${point.y})`} pointerEvents="none">
              {isRegional ? (
                <>
                  <line x1={rawPoint.x - point.x} y1={rawPoint.y - point.y} x2="0" y2="0" stroke="#0f172a" strokeWidth=".8" opacity=".32" />
                  <rect x={-cardWidth / 2} y={-cardHeight / 2} width={cardWidth} height={cardHeight} rx="7" fill="#ffffff" fillOpacity=".97" stroke="#1e3a8a" strokeWidth="1.2" />
                  <rect x={-cardWidth / 2} y={-cardHeight / 2} width={cardWidth} height="27" rx="7" fill="#1e3a8a" />
                  <text x={-cardWidth / 2 + 8} y={-cardHeight / 2 + 18} fill="#fff" fontSize="8.6" fontWeight="950">{label}</text>
                  <rect x={cardWidth / 2 - 31} y={-cardHeight / 2 + 4} width="25" height="19" rx="5" fill="#ffffff" fillOpacity=".18" />
                  <text x={cardWidth / 2 - 18.5} y={-cardHeight / 2 + 17.5} textAnchor="middle" fill="#fff" fontSize="9" fontWeight="950">{total}</text>
                  {municipalities.map((municipality, index) => {
                    const rowY = -cardHeight / 2 + 38 + index * 17;
                    return (
                      <g key={`department-municipality-${key}-${municipality.key}`}>
                        <circle cx={-cardWidth / 2 + 9} cy={rowY - 2.5} r="2" fill="#60a5fa" />
                        <text x={-cardWidth / 2 + 15} y={rowY} fill="#263b55" fontSize="7.7" fontWeight="800">{municipality.label}</text>
                        <rect x={cardWidth / 2 - 27} y={rowY - 11} width="21" height="14" rx="3.5" fill="#eaf2ff" stroke="#93b4e8" strokeWidth=".5" />
                        <text x={cardWidth / 2 - 16.5} y={rowY - 1} textAnchor="middle" fill="#1e3a8a" fontSize="7.5" fontWeight="950">{municipality.total}</text>
                      </g>
                    );
                  })}
                </>
              ) : (
                <>
                  {(offset.dx !== 0 || offset.dy !== 0) && <line x1={-offset.dx} y1={-offset.dy} x2="0" y2="0" stroke="#0f172a" strokeWidth=".8" opacity=".35" />}
                  <rect x={-labelWidth / 2} y="-10" width={labelWidth} height="20" rx="5" fill="#ffffff" fillOpacity=".96" stroke="#1e3a8a" strokeWidth="1" />
                  <text x={-labelWidth / 2 + 6} y="3.2" fill="#102a4c" fontSize="8.3" fontWeight="900">{label}</text>
                  <rect x={labelWidth / 2 - 27} y="-10" width="27" height="20" rx="5" fill="#1e3a8a" />
                  <text x={labelWidth / 2 - 13.5} y="3.4" textAnchor="middle" fill="#fff" fontSize="8.8" fontWeight="950">{total}</text>
                </>
              )}
            </g>
          );
        })}

        {!isRegional && nodes.map((node) => {
          const radius = Math.max(7, Math.min(15, Math.sqrt(node.total) * 1.8 + 4));
          return (
            <g key={`macro-node-${node.key}`} pointerEvents="none">
              <circle cx={node.x} cy={node.y} r={radius} fill="#0f172a" fillOpacity="0.9" stroke="#ffffff" strokeWidth="1.4">
                <title>{`${node.label}: ${node.total} programas`}</title>
              </circle>
              <text x={node.x} y={node.y + 3} textAnchor="middle" fill="#fff" fontSize={node.total > 99 ? 6.5 : 8} fontWeight="950">{node.total}</text>
            </g>
          );
        })}

        <g transform="translate(24, 280)" pointerEvents="none">
          <rect x="0" y="0" width="168" height={isRegional ? 64 : 152} rx="8" fill="#ffffff" fillOpacity="0.92" stroke="#cbd5e1" strokeWidth="1" />
          <text x="14" y="24" fill="#0f172a" fontSize="11" fontWeight="950" textTransform="uppercase">
            {isRegional ? 'REGIÓN COBERTURA' : 'LEYENDA'}
          </text>
          {legendList.map((reg, idx) => (
            <g key={`leg-${reg.key}`} transform={`translate(14, ${44 + idx * 22})`}>
              <rect x="0" y="-10" width="14" height="14" rx="3" fill={reg.fill} />
              <text x="22" y="1" fill="#1e293b" fontSize="11" fontWeight="800">
                {isRegional ? 'Pacífica / Sur-Occidente' : reg.label}
              </text>
            </g>
          ))}
        </g>
      </Box>

      <Box sx={{ p: 2, bgcolor: '#fff', borderLeft: { lg: '1px solid #dbe4f0' } }}>
        <Typography sx={{ mb: 0.4, color: '#1e3a8a', fontSize: 13, fontWeight: 950 }}>
          {isRegional ? 'COBERTURA REGIONAL SUR-OCCIDENTE' : 'DESGLOSE Y DENSIDAD POR REGIÓN'}
        </Typography>
        <Typography sx={{ mb: 2, color: '#64748b', fontSize: 11 }}>
          {isRegional ? 'Oferta académica en Valle del Cauca, Cauca, Nariño y Putumayo' : 'Concentración de nodos y oferta por macro-región natural'}
        </Typography>

        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2 }}>
          <Table size="small">
            <TableHead sx={{ bgcolor: '#f8fafc' }}>
              <TableRow>
                <TableCell sx={{ fontWeight: 900, fontSize: 11 }}>Región</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, fontSize: 11 }}>Municipios</TableCell>
                <TableCell align="right" sx={{ fontWeight: 900, fontSize: 11 }}>Programas</TableCell>
                <TableCell align="center" sx={{ fontWeight: 900, fontSize: 11 }}>Ranking</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {regionStats.map((reg, index) => (
                <TableRow key={reg.key} hover>
                  <TableCell sx={{ py: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box sx={{ width: 10, height: 10, borderRadius: 0.6, bgcolor: reg.fill, flexShrink: 0 }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1e293b' }}>
                        {isRegional && reg.key === 'PACIFICA' ? 'Pacífica (Sur-Occidente)' : reg.label}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11.5 }}>{reg.muniCount}</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 950, fontSize: 11.5, color: '#1e3a8a' }}>{reg.total}</TableCell>
                  <TableCell align="center" sx={{ fontWeight: 900, fontSize: 11 }}>
                    <Chip label={index + 1} size="small" sx={{ height: 18, minWidth: 18, fontSize: 9.5, fontWeight: 900, bgcolor: `${reg.fill}20`, color: reg.color }} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
}

function ExecutiveBubblesSubMap({ rows, features, bbox }) {
  const nodeBubbles = useMemo(() => {
    if (!bbox) return [];
    const maxVal = Math.max(1, ...rows.map((m) => m.total));
    const majorCityNames = new Set([
      'BOGOTA D.C.', 'BOGOTA', 'MEDELLIN', 'SANTIAGO DE CALI', 'CALI', 'BARRANQUILLA',
      'BUCARAMANGA', 'CARTAGENA DE INDIAS', 'CARTAGENA', 'SAN JOSE DE CUCUTA', 'CUCUTA',
      'PASTO', 'VILLAVICENCIO', 'NEIVA', 'POPAYAN', 'FLORENCIA', 'MONTERIA', 'SANTA MARTA', 'IBAGUE'
    ]);

    return rows.map((muni) => {
      if (!Number.isFinite(muni.longitude) || !Number.isFinite(muni.latitude)) return null;
      const point = projectGeoPoint({ lon: muni.longitude, lat: muni.latitude, bbox });
      const radius = Math.max(3.5, Math.min(24, Math.sqrt(muni.total / maxVal) * 22 + 3));
      const norm = normalizeGeo(muni.label);
      const isMajor = majorCityNames.has(norm);
      return { ...muni, x: point.x, y: point.y, radius, isMajor };
    }).filter(Boolean);
  }, [bbox, rows]);

  const bubbleLabels = useMemo(() => {
    const showAll = nodeBubbles.length <= 20;
    const topKeys = new Set([...nodeBubbles].sort((a, b) => b.total - a.total).slice(0, 12).map((node) => node.key));
    const candidates = nodeBubbles.filter((node) => showAll || node.isMajor || topKeys.has(node.key));
    const placed = [];

    candidates.forEach((node) => {
      const labelWidth = Math.max(76, Math.min(170, String(node.label || '').length * 5.8 + 38));
      const labelHeight = 20;
      const clamp = ({ x, y }) => ({
        x: Math.max(labelWidth / 2 + 5, Math.min(795 - labelWidth / 2, x)),
        y: Math.max(labelHeight / 2 + 5, Math.min(595 - labelHeight / 2, y))
      });
      const offsets = [
        [node.radius + labelWidth / 2 + 6, 0],
        [-(node.radius + labelWidth / 2 + 6), 0],
        [0, -(node.radius + labelHeight / 2 + 7)],
        [0, node.radius + labelHeight / 2 + 7],
        [node.radius + labelWidth / 2 + 5, -(node.radius + 8)],
        [-(node.radius + labelWidth / 2 + 5), -(node.radius + 8)],
        [node.radius + labelWidth / 2 + 5, node.radius + 8],
        [-(node.radius + labelWidth / 2 + 5), node.radius + 8]
      ];
      let bestPoint = clamp({ x: node.x + offsets[0][0], y: node.y });
      let bestScore = Number.POSITIVE_INFINITY;

      for (let attempt = 0; attempt < 110; attempt += 1) {
        const offset = offsets[attempt] || [
          Math.cos(attempt * 2.399963) * (22 + Math.sqrt(attempt) * 9),
          Math.sin(attempt * 2.399963) * (22 + Math.sqrt(attempt) * 9)
        ];
        const point = clamp({ x: node.x + offset[0], y: node.y + offset[1] });
        const labelCollisions = placed.reduce((count, label) => count + (
          Math.abs(point.x - label.point.x) < (labelWidth + label.labelWidth) / 2 + 3
          && Math.abs(point.y - label.point.y) < (labelHeight + label.labelHeight) / 2 + 3 ? 1 : 0
        ), 0);
        const bubbleCollisions = nodeBubbles.reduce((count, bubble) => {
          if (bubble.key === node.key) return count;
          const nearestX = Math.max(point.x - labelWidth / 2, Math.min(bubble.x, point.x + labelWidth / 2));
          const nearestY = Math.max(point.y - labelHeight / 2, Math.min(bubble.y, point.y + labelHeight / 2));
          return count + (Math.hypot(bubble.x - nearestX, bubble.y - nearestY) < bubble.radius + 2 ? 1 : 0);
        }, 0);
        const score = (labelCollisions + bubbleCollisions) * 10000 + Math.hypot(point.x - node.x, point.y - node.y);
        if (score < bestScore) {
          bestScore = score;
          bestPoint = point;
        }
        if (labelCollisions === 0 && bubbleCollisions === 0) break;
      }

      placed.push({ node, point: bestPoint, labelWidth, labelHeight });
    });

    return placed;
  }, [nodeBubbles]);

  const topClusters = useMemo(() => {
    const sorted = [...rows].sort((a, b) => b.total - a.total);
    const top4 = sorted.slice(0, 4);
    return top4.map((mainHub) => {
      const children = sorted
        .filter((m) => m.key !== mainHub.key)
        .slice(0, 5);
      return { hub: mainHub, children };
    });
  }, [rows]);

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '300px minmax(0, 1fr)' }, bgcolor: '#f8fafc', minHeight: 720 }}>
      <Box sx={{ p: 2, borderRight: { lg: '1px solid #e2e8f0' }, overflowY: 'auto', maxHeight: 720, bgcolor: '#ffffff' }}>
        <Typography sx={{ fontSize: 11, fontWeight: 950, color: '#0f172a', mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>NODOS PRINCIPALES Y COBERTURA</Typography>
        <Stack spacing={1.5}>
          {topClusters.map((cluster) => (
            <Paper key={cluster.hub.key} elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 2, overflow: 'hidden', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}>
              <Box sx={{ px: 1.4, py: 0.8, bgcolor: '#1e3a8a', color: '#fff' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 900 }}>{`${cluster.hub.label} (${cluster.hub.total})`}</Typography>
              </Box>
              <Stack spacing={0.5} sx={{ p: 1.2, bgcolor: '#fff' }}>
                {cluster.children.map((child) => (
                  <Stack key={child.key} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography sx={{ fontSize: 11, color: '#334155' }}>{child.label}</Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1e3a8a' }}>{child.total}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          ))}
        </Stack>
      </Box>

      <Box sx={{ position: 'relative', p: 1 }}>
        <Box component="svg" viewBox="0 0 800 600" sx={{ width: '100%', height: { xs: 540, md: 720 }, display: 'block' }}>
          <rect width="800" height="600" fill="#f1f5f9" rx="8" />

          {features.map((feature) => (
            <path
              key={`exec-sub-dept-${feature.name}`}
              d={buildGeoPath(feature.rings, bbox)}
              fill="#cbd5e1"
              fillOpacity="0.5"
              stroke="#ffffff"
              strokeWidth="0.9"
            />
          ))}

          {nodeBubbles.map((b) => (
            <g key={`exec-sub-b-${b.key}`}>
              <circle
                cx={b.x}
                cy={b.y}
                r={b.radius}
                fill="#1e3a8a"
                fillOpacity="0.85"
                stroke="#ffffff"
                strokeWidth="1.5"
              >
                <title>{`${b.label}: ${b.total} programas`}</title>
              </circle>
            </g>
          ))}

          {bubbleLabels.map(({ node, point, labelWidth, labelHeight }) => (
            <g key={`exec-sub-label-${node.key}`} pointerEvents="none">
              <line x1={node.x} y1={node.y} x2={point.x} y2={point.y} stroke="#64748b" strokeWidth=".8" opacity=".45" />
              <g transform={`translate(${point.x} ${point.y})`}>
                <rect x={-labelWidth / 2} y={-labelHeight / 2} width={labelWidth} height={labelHeight} rx="5" fill="#ffffff" fillOpacity=".97" stroke="#94a3b8" strokeWidth=".8" />
                <text x={-labelWidth / 2 + 6} y="3.2" fill="#172554" fontSize="8.8" fontWeight="900">{node.label}</text>
                <rect x={labelWidth / 2 - 28} y={-labelHeight / 2} width="28" height={labelHeight} rx="5" fill="#1e3a8a" />
                <text x={labelWidth / 2 - 14} y="3.3" textAnchor="middle" fill="#fff" fontSize="9" fontWeight="950">{node.total}</text>
              </g>
            </g>
          ))}
        </Box>
      </Box>
    </Box>
  );
}

function ColombiaOfferMap({ title, subtitle, type, rows, features, bbox: nationalBbox, color, onSelectMunicipality }) {
  const [mapStyle, setMapStyle] = useState('vibrant');
  const mapId = `${type}-${color.replace('#', '')}-${title.replace(/[^a-zA-Z0-9]/g, '')}`;
  const dataMap = useMemo(() => new Map(rows.map((row) => [row.key, row])), [rows]);
  const maxTotal = Math.max(1, ...rows.map((row) => row.total));
  const topKeys = useMemo(() => new Set(rows.slice(0, type === 'municipality' ? 14 : 10).map((row) => row.key)), [rows, type]);

  const effectiveBbox = useMemo(() => {
    if (!title.includes('REGIONAL') || !rows.length || !nationalBbox) return nationalBbox;
    let minLon = Infinity; let maxLon = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
    rows.forEach((r) => {
      if (Number.isFinite(r.longitude) && Number.isFinite(r.latitude)) {
        minLon = Math.min(minLon, r.longitude);
        maxLon = Math.max(maxLon, r.longitude);
        minLat = Math.min(minLat, r.latitude);
        maxLat = Math.max(maxLat, r.latitude);
      }
    });
    if (!Number.isFinite(minLon)) return nationalBbox;
    return {
      minLon: minLon - 1.2,
      maxLon: maxLon + 1.2,
      minLat: minLat - 1.2,
      maxLat: maxLat + 1.2
    };
  }, [title, rows, nationalBbox]);

  const deptGroups = useMemo(() => {
    if (type !== 'municipality') return [];
    const map = new Map();
    rows.forEach((row) => {
      const deptName = row.department_name || row.departamento || row.depto || 'OTRO DEPARTAMENTO';
      const normDept = normalizeGeo(deptName);
      if (!map.has(normDept)) {
        map.set(normDept, {
          key: normDept,
          name: formatGeoLabel(deptName),
          total: 0,
          municipalities: []
        });
      }
      const deptObj = map.get(normDept);
      deptObj.total += row.total;
      deptObj.municipalities.push({
        key: row.key,
        name: row.label || row.municipio,
        total: row.total
      });
    });

    return Array.from(map.values())
      .map((d) => ({
        ...d,
        municipalities: d.municipalities.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'))
      }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'es'));
  }, [rows, type]);

  const municipalityMarkers = useMemo(() => {
    if (type !== 'municipality' || !effectiveBbox) return [];
    const placed = [];
    rows
      .filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude))
      .forEach((row) => {
        const origin = projectGeoPoint({ lon: row.longitude, lat: row.latitude, bbox: effectiveBbox });
        const labelWidth = Math.max(54, Math.min(164, row.label.length * 4.05 + 27));
        const labelHeight = 17;
        const clamp = (candidate) => ({
          x: Math.max(labelWidth / 2 + 4, Math.min(796 - labelWidth / 2, candidate.x)),
          y: Math.max(labelHeight / 2 + 4, Math.min(596 - labelHeight / 2, candidate.y)),
        });
        const overlaps = (candidate, marker) => (
          Math.abs(candidate.x - marker.point.x) < (labelWidth + marker.labelWidth) / 2 + 2
          && Math.abs(candidate.y - marker.point.y) < (labelHeight + marker.labelHeight) / 2 + 2
        );
        const initial = clamp({ x: origin.x + labelWidth / 2 + 7, y: origin.y - 10 });
        let point = initial;
        let bestScore = Number.POSITIVE_INFINITY;
        for (let attempt = 0; attempt <= 220; attempt += 1) {
          const distance = attempt === 0 ? 0 : 7 + Math.sqrt(attempt) * 8.2;
          const angle = attempt * 2.399963;
          const candidate = attempt === 0 ? initial : clamp({
            x: origin.x + Math.cos(angle) * distance,
            y: origin.y + Math.sin(angle) * distance,
          });
          const collisions = placed.reduce((total, marker) => total + (overlaps(candidate, marker) ? 1 : 0), 0);
          const score = collisions * 10000 + Math.hypot(candidate.x - origin.x, candidate.y - origin.y);
          if (score < bestScore) {
            bestScore = score;
            point = candidate;
          }
          if (collisions === 0) break;
        }
        placed.push({ row, origin, point, labelWidth, labelHeight, displaced: Math.hypot(origin.x - point.x, origin.y - point.y) > labelWidth / 2 + 12 });
      });
    return placed;
  }, [effectiveBbox, rows, type]);

  const shades = type === 'department'
    ? (color === '#b5123f' ? ['#fde8ee', '#f8bfd0', '#ec86a4', '#d74670', color] : ['#e0ecff', '#b7d3ff', '#79aaf5', '#3478d4', color])
    : [];

  const fillFor = (value) => {
    if (!value) return '#edf2f7';
    const ratio = value / maxTotal;
    return shades[Math.min(shades.length - 1, Math.floor(ratio * shades.length))];
  };

  return (
    <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#fff' }}>
      <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid #dbe4f0', bgcolor: '#f8fafc' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box sx={{ width: 38, height: 38, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${color}14`, color }}>
              {type === 'municipality' ? <PlaceRoundedIcon /> : <MapRoundedIcon />}
            </Box>
            <Box>
              <Typography sx={{ color: '#102a4c', fontWeight: 950, fontSize: 14 }}>{title}</Typography>
              <Typography sx={{ color: '#64748b', fontSize: 11 }}>{subtitle}</Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1.2} alignItems="center">
            {type === 'municipality' && (
              <Tabs
                value={mapStyle}
                onChange={(_, val) => setMapStyle(val)}
                sx={{
                  bgcolor: '#e2e8f0',
                  borderRadius: 2.5,
                  p: 0.4,
                  minHeight: 34,
                  '& .MuiTab-root': {
                    minHeight: 28,
                    py: 0.3,
                    px: 1.3,
                    fontSize: 11,
                    fontWeight: 850,
                    textTransform: 'none',
                    borderRadius: 1.8,
                    color: '#475569',
                    gap: 0.6,
                    '&:hover': { color: '#0f172a' }
                  },
                  '& .Mui-selected': {
                    bgcolor: '#ffffff',
                    color: '#1d4ed8 !important',
                    fontWeight: 950,
                    boxShadow: '0 2px 6px rgba(15,23,42,0.1)'
                  },
                  '& .MuiTabs-indicator': { display: 'none' }
                }}
              >
                <Tab icon={<PlaceRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Viñetas y Nodos" value="vibrant" />
                <Tab icon={<PublicRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Macro-Regiones" value="macro" />
                <Tab icon={<BubbleChartRoundedIcon sx={{ fontSize: 16 }} />} iconPosition="start" label="Burbujas Limpias" value="executive" />
              </Tabs>
            )}

            <Chip size="small" label={`${numberFormat.format(rows.reduce((acc, row) => acc + row.total, 0))} programas`} sx={{ bgcolor: `${color}14`, color, fontWeight: 900 }} />
          </Stack>
        </Stack>
      </Box>

      {type === 'municipality' && mapStyle === 'macro' ? (
        <MacroRegionSubMap rows={rows} features={features} bbox={effectiveBbox} isRegional={title.includes('REGIONAL')} />
      ) : type === 'municipality' && mapStyle === 'executive' ? (
        <ExecutiveBubblesSubMap rows={rows} features={features} bbox={effectiveBbox} />
      ) : (
        <Box sx={{ position: 'relative', minHeight: 720, bgcolor: '#f4f8fd' }}>
          {!effectiveBbox || !features.length ? (
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ height: 720 }}>
              <CircularProgress size={28} />
              <Typography sx={{ color: '#64748b', fontSize: 12 }}>Cargando cartografía…</Typography>
            </Stack>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 350px' }, minHeight: 720 }}>
              <Box component="svg" viewBox="0 0 800 600" sx={{ width: '100%', height: { xs: 540, md: 720 }, display: 'block' }}>
                <defs>
                  <linearGradient id={`land-${mapId}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#d9e8c8" />
                    <stop offset="38%" stopColor="#eef0d2" />
                    <stop offset="70%" stopColor="#d5dfbd" />
                    <stop offset="100%" stopColor="#c4d8bd" />
                  </linearGradient>
                  <pattern id={`terrain-${mapId}`} width="62" height="54" patternUnits="userSpaceOnUse">
                    <path d="M-6 42 Q10 22 27 38 T68 31" fill="none" stroke="#617e54" strokeWidth="1" opacity=".16" />
                    <path d="M-8 48 Q13 29 31 44 T70 38" fill="none" stroke="#fff" strokeWidth="1" opacity=".22" />
                  </pattern>
                  <filter id={`map-shadow-${mapId}`} x="-20%" y="-20%" width="140%" height="150%">
                    <feDropShadow dx="0" dy="8" stdDeviation="7" floodColor="#29475a" floodOpacity=".26" />
                  </filter>
                  <filter id={`shadow-${mapId}`} x="-40%" y="-40%" width="180%" height="190%">
                    <feDropShadow dx="0" dy="3" stdDeviation="2.5" floodColor="#18324d" floodOpacity=".3" />
                  </filter>
                </defs>

                <rect width="800" height="600" fill="#eef5f8" />

                <g filter={`url(#map-shadow-${mapId})`}>
                  {features.map((feature) => <path key={`base-${feature.name}`} d={buildGeoPath(feature.rings, effectiveBbox)} fill="#b7c9b2" stroke="none" />)}
                </g>

                {features.map((feature) => {
                  const datum = dataMap.get(feature.name);
                  return (
                    <g key={feature.name}>
                      <path
                        d={buildGeoPath(feature.rings, effectiveBbox)}
                        fill={type === 'department' ? fillFor(datum?.total) : `url(#land-${mapId})`}
                        stroke={datum ? color : '#93aa9b'}
                        strokeWidth={datum ? 1.35 : 0.7}
                      >
                        <title>{datum ? `${datum.label}: ${numberFormat.format(datum.total)} programas` : feature.label}</title>
                      </path>
                      <path d={buildGeoPath(feature.rings, effectiveBbox)} fill={`url(#terrain-${mapId})`} stroke="none" pointerEvents="none" />
                    </g>
                  );
                })}

                {type === 'department' && (
                  <g>
                    {features.map((feature) => {
                      const datum = dataMap.get(feature.name);
                      if (!datum || datum.total <= 0) return null;
                      const center = featureCenter(feature.rings);
                      if (!center) return null;
                      const rawPt = projectGeoPoint({ ...center, bbox: effectiveBbox });

                      const normName = normalizeGeo(feature.name);
                      const offset = DEPT_OFFSET_MAP[normName] || { dx: 0, dy: 0 };
                      const pt = { x: rawPt.x + offset.dx, y: rawPt.y + offset.dy };
                      const circleR = Math.max(10, Math.min(16, Math.sqrt(datum.total / maxTotal) * 11 + 7));

                      return (
                        <g key={`dept-badge-${feature.name}`} transform={`translate(${pt.x} ${pt.y})`}>
                          <title>{`${datum.label}: ${datum.total} programas`}</title>

                          {(offset.dx !== 0 || offset.dy !== 0) && (
                            <line x1={-offset.dx} y1={-offset.dy} x2="0" y2="0" stroke="#0f172a" strokeWidth="1" strokeDasharray="2 2" opacity="0.4" />
                          )}

                          <circle cx="0" cy="0" r={circleR} fill={color} stroke="#ffffff" strokeWidth="1.8" />
                          <text x="0" y="3.5" textAnchor="middle" fill="#ffffff" fontSize={circleR > 12 ? '10.5' : '9'} fontWeight="950">{datum.total}</text>

                          <g transform={`translate(${circleR + 4} -7)`} pointerEvents="none">
                            <rect x="-2" y="-1" width={datum.label.length * 5.6 + 8} height="15" rx="3.5" fill="#ffffff" fillOpacity="0.95" stroke="#cbd5e1" strokeWidth="0.8" />
                            <text x="2" y="10" fill="#0f172a" fontSize="8.5" fontWeight="900">{datum.label}</text>
                          </g>
                        </g>
                      );
                    })}

                    <g transform="translate(20, 520)" pointerEvents="none">
                      <rect x="0" y="0" width="160" height="60" rx="6" fill="#ffffff" fillOpacity="0.94" stroke="#cbd5e1" strokeWidth="0.8" />
                      <text x="12" y="16" fill="#0f172a" fontSize="9.5" fontWeight="950" textTransform="uppercase">INTENSIDAD DE OFERTA</text>
                      <defs>
                        <linearGradient id={`deptLegendRamp-${mapId}`} x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#e0ecff" />
                          <stop offset="50%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor={color} />
                        </linearGradient>
                      </defs>
                      <rect x="12" y="24" width="136" height="10" rx="3" fill={`url(#deptLegendRamp-${mapId})`} />
                      <text x="12" y="46" fill="#475569" fontSize="8.5" fontWeight="800">1 prog</text>
                      <text x="148" y="46" textAnchor="end" fill="#0f172a" fontSize="8.5" fontWeight="950">{`${maxTotal} prog`}</text>
                    </g>
                  </g>
                )}

                {type === 'municipality' && (
                  <g>
                    {rows.map((row, idx) => {
                      if (!Number.isFinite(row.longitude) || !Number.isFinite(row.latitude)) return null;
                      const pt = projectGeoPoint({ lon: row.longitude, lat: row.latitude, bbox: effectiveBbox });
                      const pinColor = VIBRANT_PALETTE[idx % VIBRANT_PALETTE.length];
                      const radius = Math.max(5, Math.min(18, Math.sqrt(row.total / maxTotal) * 16 + 4));
                      return (
                        <g key={`vibrant-pin-${row.key}`} style={{ cursor: 'pointer' }} onClick={() => onSelectMunicipality?.(row.label || row.municipio)}>
                          <circle
                            cx={pt.x}
                            cy={pt.y}
                            r={radius}
                            fill={pinColor}
                            fillOpacity="0.75"
                            stroke="#ffffff"
                            strokeWidth="1.4"
                          >
                            <title>{`${row.label}: ${numberFormat.format(row.total)} programas (Clic para ver en Google Maps)`}</title>
                          </circle>
                        </g>
                      );
                    })}

                    {municipalityMarkers
                      .filter(({ row }) => topKeys.has(row.key) || row.total >= 3)
                      .map(({ row, origin, point, labelWidth, labelHeight, displaced }) => (
                        <g key={`badge-top-${row.key}`} style={{ cursor: 'pointer' }} onClick={() => onSelectMunicipality?.(row.label || row.municipio)}>
                          {displaced && <line x1={origin.x} y1={origin.y} x2={point.x} y2={point.y} stroke={color} strokeWidth=".8" opacity=".3" />}
                          <g transform={`translate(${point.x} ${point.y})`}>
                            <title>{`${row.label}: ${numberFormat.format(row.total)} programas (Clic para ver en Google Maps)`}</title>
                            <rect x={-labelWidth / 2} y={-labelHeight / 2} width={labelWidth} height={labelHeight} rx="3.5" fill="#0f172a" fillOpacity=".92" stroke="#fff" strokeWidth=".8" />
                            <rect x={labelWidth / 2 - 21} y={-labelHeight / 2} width="21" height={labelHeight} rx="3.5" fill={color} />
                            <text x={-labelWidth / 2 + 5} y="2.5" fill="#ffffff" fontSize="7.2" fontWeight="900">{row.label}</text>
                            <text x={labelWidth / 2 - 10.5} y="2.8" textAnchor="middle" fill="#fff" fontSize="7.5" fontWeight="950">{row.total}</text>
                          </g>
                        </g>
                      ))}
                  </g>
                )}
              </Box>

              <Box sx={{ p: 2, bgcolor: '#fff', borderLeft: { lg: '1px solid #dbe4f0' }, borderTop: { xs: '1px solid #dbe4f0', lg: 'none' }, maxHeight: { lg: 720 }, overflowY: 'auto' }}>
                <Typography sx={{ mb: 0.4, color, fontSize: 13, fontWeight: 950 }}>
                  {type === 'municipality' ? 'DEPARTAMENTOS Y MUNICIPIOS' : 'DEPARTAMENTOS'}
                </Typography>
                <Typography sx={{ mb: 1.5, color: '#64748b', fontSize: 11 }}>
                  {type === 'municipality' ? 'Haz clic en un municipio para ver sus universidades en Google Maps' : 'Ranking de oferta por departamento'}
                </Typography>

                {type === 'municipality' ? (
                  <Stack spacing={1.2}>
                    {deptGroups.map((dept) => (
                      <Paper key={dept.key} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                        <Box sx={{ px: 1.4, py: 0.8, bgcolor: `${color}10`, borderBottom: '1px solid #edf2f7' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center">
                            <Typography sx={{ fontSize: 12, fontWeight: 950, color: '#0f172a' }}>{dept.name}</Typography>
                            <Chip size="small" label={`${dept.total} prog`} sx={{ height: 20, bgcolor: color, color: '#fff', fontWeight: 900, fontSize: 10 }} />
                          </Stack>
                        </Box>
                        <Stack spacing={0.4} sx={{ p: 1, bgcolor: '#fff' }}>
                          {dept.municipalities.map((muni) => (
                            <Stack
                              key={muni.key}
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                              onClick={() => onSelectMunicipality?.(muni.name)}
                              sx={{
                                px: 0.8,
                                py: 0.5,
                                borderRadius: 1.5,
                                cursor: 'pointer',
                                transition: 'all .15s ease',
                                '&:hover': { bgcolor: `${color}14`, transform: 'translateX(2px)' }
                              }}
                            >
                              <Stack direction="row" spacing={0.8} alignItems="center">
                                <PlaceRoundedIcon sx={{ fontSize: 13, color }} />
                                <Typography sx={{ fontSize: 11, color: '#1e293b', fontWeight: 800 }}>{muni.name}</Typography>
                              </Stack>
                              <Typography sx={{ fontSize: 11, fontWeight: 950, color }}>{muni.total}</Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Stack spacing={1.15}>
                    {rows.map((row, index) => (
                      <Box key={`rank-${row.key}`}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <Box sx={{ width: 24, height: 24, borderRadius: 1.2, display: 'grid', placeItems: 'center', bgcolor: `${color}13`, color, fontSize: 10.5, fontWeight: 950 }}>{index + 1}</Box>
                          <Typography sx={{ flex: 1, color: '#263b55', fontSize: 11, fontWeight: 800 }}>{row.label}</Typography>
                          <Typography sx={{ color, fontSize: 12, fontWeight: 950 }}>{numberFormat.format(row.total)}</Typography>
                        </Stack>
                        <Box sx={{ mt: 0.45, ml: 4, height: 4, borderRadius: 3, bgcolor: '#e8edf4', overflow: 'hidden' }}>
                          <Box sx={{ height: '100%', width: `${Math.max(5, (row.total / maxTotal) * 100)}%`, borderRadius: 3, bgcolor: color }} />
                        </Box>
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
            </Box>
          )}
        </Box>
      )}

      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center" sx={{ px: 1.5, py: 1, borderTop: '1px solid #e2e8f0' }}>
        <Typography sx={{ color: '#64748b', fontSize: 10.5 }}>
          {type === 'municipality' ? 'Usa las pestañas superiores para alternar entre Viñetas Vivas, Macro-Regiones o Burbujas Limpias' : 'Mayor intensidad representa mayor oferta académica'}
        </Typography>
      </Stack>
    </Paper>
  );
}

const REGIONS_DEFINITION = [
  { key: 'ANDINA', label: 'Andina', color: '#1e3a8a', fill: '#1e40af', lightBg: '#eff6ff', departments: ['ANTIOQUIA', 'BOYACA', 'CALDAS', 'CUNDINAMARCA', 'BOGOTA D C', 'BOGOTA D C ', 'BOGOTA', 'HUILA', 'NORTE DE SANTANDER', 'QUINDIO', 'QUIN DIO', 'RISARALDA', 'SANTANDER', 'TOLIMA'], variation: '0.0%' },
  { key: 'CARIBE', label: 'Caribe', color: '#0284c7', fill: '#06b6d4', lightBg: '#ecfeff', departments: ['ATLANTICO', 'BOLIVAR', 'CESAR', 'CORDOBA', 'LA GUAJIRA', 'MAGDALENA', 'SUCRE', 'SAN ANDRES Y PROVIDENCIA', 'SAN ANDRES'], variation: '+2.7%' },
  { key: 'PACIFICA', label: 'Pacífica / Sur-Occidente', color: '#3b82f6', fill: '#60a5fa', lightBg: '#f0f9ff', departments: ['CHOCO', 'VALLE DEL CAUCA', 'VALLE', 'CAUCA', 'NARINO', 'PUTUMAYO'], variation: '-0.1%' },
  { key: 'ORINOQUIA', label: 'Orinoquía', color: '#15803d', fill: '#10b981', lightBg: '#f0fdf4', departments: ['ARAUCA', 'CASANARE', 'META', 'VICHADA'], variation: '-0.1%' },
  { key: 'AMAZONIA', label: 'Amazonía', color: '#047857', fill: '#34d399', lightBg: '#ecfdf5', departments: ['AMAZONAS', 'CAQUETA', 'GUAINIA', 'GUAVIARE', 'PUTUMAYO', 'VAUPES'], variation: '-0.7%' }
];

const getRegionForDepartment = (deptName = '') => {
  const norm = normalizeGeo(deptName);
  for (const region of REGIONS_DEFINITION) {
    if (region.departments.some((d) => normalizeGeo(d) === norm)) {
      return region;
    }
  }
  return REGIONS_DEFINITION[0];
};

function SummaryGroup({ title, icon: Icon, color, items }) {
  return (
    <Paper elevation={0} sx={{ position: 'relative', border: '1px solid #d8e1ee', borderRadius: 2.5, overflow: 'hidden', height: '100%', bgcolor: '#fff', boxShadow: '0 5px 16px rgba(15, 23, 42, .045)' }}>
      <Box sx={{ height: 4, bgcolor: color }} />
      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ px: 1.5, py: 1.3, borderBottom: '1px solid #edf1f7' }}>
        <Box sx={{ width: 34, height: 34, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${color}12`, color }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Typography sx={{ color: '#183153', fontWeight: 900, fontSize: 12.5, lineHeight: 1.2 }}>{title}</Typography>
      </Stack>
      <Stack spacing={0} sx={{ px: 1.5, py: 0.7 }}>
        {items.map((item, index) => (
          <Stack key={item.label} direction="row" justifyContent="space-between" alignItems="center" spacing={1} sx={{ minHeight: 39, py: 0.65, borderBottom: index < items.length - 1 ? '1px solid #edf1f7' : 'none' }}>
            <Typography sx={{ color: '#52657c', fontSize: 11.5, lineHeight: 1.25 }}>{item.label}</Typography>
            <Box sx={{ flexShrink: 0, minWidth: 48, px: 1, py: 0.38, textAlign: 'center', bgcolor: `${color}0d`, borderRadius: 1.2, color, fontWeight: 950, fontSize: 12.5 }}>
              {item.value}
            </Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function RadialGroup({ title, icon: Icon, color, items, position }) {
  return (
    <Paper elevation={0} sx={{ ...position, zIndex: 2, border: `1.5px solid ${color}80`, borderRadius: 2.2, bgcolor: '#fff', boxShadow: '0 8px 24px rgba(15,23,42,.07)' }}>
      <Box sx={{ position: 'absolute', top: -27, left: '50%', transform: 'translateX(-50%)', width: 48, height: 48, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#fff', color, border: `1.5px solid ${color}`, boxShadow: '0 4px 12px rgba(15,23,42,.08)' }}>
        <Icon sx={{ fontSize: 25 }} />
      </Box>
      <Box sx={{ mt: 2.5, px: 1.2, py: 0.8, bgcolor: color, color: '#fff', textAlign: 'center', fontWeight: 900, fontSize: 12.5 }}>{title}</Box>
      <Stack spacing={0.65} sx={{ p: 1, maxHeight: 190, overflowY: 'auto' }}>
        {items.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" spacing={0.8} sx={{ minHeight: 34, px: 0.8, py: 0.45, border: `1px solid ${color}60`, borderRadius: 1.3 }}>
            <Box sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', bgcolor: color }} />
            <Typography sx={{ flex: 1, color: '#334155', fontSize: 10.8, lineHeight: 1.15 }}>{item.label}</Typography>
            <Box sx={{ minWidth: 46, px: 0.8, py: 0.25, border: `1px solid ${color}90`, color: '#102a4c', bgcolor: '#fff', textAlign: 'center', fontSize: 12, fontWeight: 950 }}>{item.value}</Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function OrbitGroup({ title, icon: Icon, color, items, position }) {
  return (
    <Paper elevation={0} sx={{ ...position, zIndex: 2, minHeight: 102, pl: { xs: 1.2, md: 5.3 }, pr: 1.2, py: 1, border: `1.5px solid ${color}75`, borderRadius: 2.6, bgcolor: '#fff', boxShadow: '0 7px 20px rgba(15,23,42,.06)' }}>
      <Box sx={{ position: { xs: 'relative', md: 'absolute' }, left: { md: -34 }, top: { md: '50%' }, transform: { md: 'translateY(-50%)' }, width: 62, height: 62, mb: { xs: 0.7, md: 0 }, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: color, color: '#fff', border: '6px solid #fff', outline: `1.5px solid ${color}`, boxShadow: '0 5px 14px rgba(15,23,42,.12)' }}>
        <Icon sx={{ fontSize: 29 }} />
      </Box>
      <Typography sx={{ mb: 0.45, color, fontSize: 12.5, fontWeight: 950 }}>{title}</Typography>
      <Box sx={{ maxHeight: 70, overflowY: 'auto', pr: 0.3 }}>
        {items.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" spacing={0.8} sx={{ minHeight: 25 }}>
            <Box sx={{ width: 5, height: 5, flexShrink: 0, borderRadius: '50%', bgcolor: color }} />
            <Typography sx={{ flex: 1, color: '#334155', fontSize: 10.5, lineHeight: 1.15 }}>{item.label}</Typography>
            <Box sx={{ minWidth: 64, px: 0.8, py: 0.15, color: '#102a4c', border: '1px solid #b8c5d6', bgcolor: '#fdfefe', textAlign: 'center', fontSize: 11.5, fontWeight: 950 }}>{item.value}</Box>
          </Stack>
        ))}
      </Box>
    </Paper>
  );
}

function PanelGroup({ title, icon: Icon, color, items }) {
  return (
    <Paper elevation={0} sx={{ p: { xs: 1.5, lg: 2.2 }, minHeight: { lg: 178 }, height: '100%', border: `1.5px solid ${color}55`, borderRadius: 2.6, bgcolor: '#fff', boxShadow: '0 6px 18px rgba(15,23,42,.05)' }}>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
        <Box sx={{ width: { xs: 38, lg: 46 }, height: { xs: 38, lg: 46 }, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: color, color: '#fff', boxShadow: `0 4px 10px ${color}35` }}><Icon sx={{ fontSize: { xs: 21, lg: 25 } }} /></Box>
        <Typography sx={{ color, fontWeight: 950, fontSize: { xs: 13, lg: 15 }, lineHeight: 1.15 }}>{title}</Typography>
      </Stack>
      <Stack spacing={0.65}>
        {items.map((item) => (
          <Stack key={item.label} direction="row" alignItems="center" spacing={0.9} sx={{ minHeight: { xs: 31, lg: 36 } }}>
            <Box sx={{ width: 6, height: 6, flexShrink: 0, borderRadius: '50%', bgcolor: color }} />
            <Typography sx={{ flex: 1, color: '#334155', fontSize: { xs: 10.8, lg: 12 }, lineHeight: 1.2 }}>{item.label}</Typography>
            <Box sx={{ minWidth: { xs: 62, lg: 76 }, px: 1, py: 0.42, border: '1px solid #b8c5d6', bgcolor: '#fbfdff', color: '#102a4c', textAlign: 'center', fontSize: { xs: 12, lg: 14 }, fontWeight: 950 }}>{item.value}</Box>
          </Stack>
        ))}
      </Stack>
    </Paper>
  );
}

function SequenceGroup({ title, icon: Icon, color, items }) {
  return (
    <Box sx={{ position: 'relative', minWidth: 0, pt: { xs: 13, lg: 15 } }}>
      <Box sx={{ position: 'absolute', zIndex: 3, top: 0, left: '50%', transform: 'translateX(-50%)', width: { xs: 72, lg: 86 }, height: { xs: 82, lg: 98 }, display: 'grid', placeItems: 'center', bgcolor: color, color: '#fff', clipPath: 'polygon(25% 5%,75% 5%,100% 50%,75% 95%,25% 95%,0 50%)', filter: 'drop-shadow(0 7px 8px rgba(15,23,42,.18))' }}>
        <Icon sx={{ fontSize: { xs: 31, lg: 39 } }} />
      </Box>
      <Box sx={{ position: 'absolute', zIndex: 2, top: { xs: 72, lg: 88 }, left: '50%', width: 2, height: { xs: 28, lg: 33 }, bgcolor: color, transform: 'translateX(-50%)' }} />
      <Box sx={{ position: 'absolute', zIndex: 4, top: { xs: 94, lg: 112 }, left: '50%', width: 17, height: 17, borderRadius: '50%', bgcolor: color, border: '3px solid #fff', boxShadow: `0 0 0 1px ${color}`, transform: 'translateX(-50%)' }} />
      <Paper elevation={0} sx={{ minHeight: { xs: 220, lg: 305 }, p: { xs: 1.35, lg: 1.7 }, pt: { xs: 2.5, lg: 2.8 }, border: `1.5px solid ${color}70`, borderRadius: 2.3, bgcolor: '#fff', boxShadow: '0 7px 20px rgba(15,23,42,.055)' }}>
        <Typography sx={{ minHeight: { lg: 42 }, mb: 1.1, color, textAlign: 'center', fontWeight: 950, fontSize: { xs: 12.5, lg: 14 }, lineHeight: 1.15 }}>{title}</Typography>
        <Stack spacing={0.8}>
          {items.map((item) => (
            <Stack key={item.label} direction="row" alignItems="center" spacing={0.65} sx={{ minHeight: { xs: 34, lg: 39 } }}>
              <Box sx={{ width: 5, height: 5, flexShrink: 0, borderRadius: '50%', bgcolor: color }} />
              <Typography sx={{ flex: 1, minWidth: 0, color: '#334155', fontSize: { xs: 10.5, lg: 11.2 }, lineHeight: 1.2 }}>{item.label}</Typography>
              <Box sx={{ minWidth: { xs: 48, lg: 58 }, px: 0.6, py: 0.35, border: '1px solid #bdc8d6', bgcolor: '#fcfdff', color: '#102a4c', textAlign: 'center', fontSize: { xs: 11, lg: 12.5 }, fontWeight: 950 }}>{item.value}</Box>
            </Stack>
          ))}
        </Stack>
      </Paper>
    </Box>
  );
}

function OfferSummary({ summary, view, onViewChange, program }) {
  const groups = [
    { slot: 0, title: 'Reconocimiento MEN', icon: AccountBalanceRoundedIcon, color: '#173f96', items: summary.recognition },
    { slot: 1, title: 'Sector', icon: BusinessRoundedIcon, color: '#3a9626', items: summary.sectors },
    { slot: 2, title: 'Modalidades', icon: DevicesRoundedIcon, color: '#92278f', items: summary.modalities },
    { slot: 4, title: 'Número de semestres', icon: CalendarMonthRoundedIcon, color: '#0891a5', items: summary.semesters },
    { slot: 3, title: 'Rango de créditos académicos', icon: WorkspacePremiumRoundedIcon, color: '#ea6a0a', items: summary.credits }
  ].filter((group) => group.items.length);
  const radialConnectors = [
    { slot: 0, points: '285,145 350,145 408,235', dot: ['408', '235'], color: '#173f96' },
    { slot: 1, points: '715,145 650,145 592,235', dot: ['592', '235'], color: '#3a9626' },
    { slot: 2, points: '285,350 345,350 395,335', dot: ['395', '335'], color: '#92278f' },
    { slot: 3, points: '715,350 655,350 605,335', dot: ['605', '335'], color: '#ea6a0a' },
    { slot: 4, points: '500,450 500,510', dot: ['500', '450'], color: '#0891a5' }
  ].filter((connector) => groups.some((group) => group.slot === connector.slot));
  const orbitConnectors = [
    { slot: 0, points: '270,245 335,82 390,82', dot: ['270', '245'], color: '#173f96' },
    { slot: 1, points: '300,292 345,205 390,205', dot: ['300', '292'], color: '#3a9626' },
    { slot: 2, points: '310,345 350,328 390,328', dot: ['310', '345'], color: '#92278f' },
    { slot: 4, points: '300,402 345,451 390,451', dot: ['300', '402'], color: '#0891a5' },
    { slot: 3, points: '270,452 335,574 390,574', dot: ['270', '452'], color: '#ea6a0a' }
  ].filter((connector) => groups.some((group) => group.slot === connector.slot));
  const groupAt = (slot) => groups.find((group) => group.slot === slot);
  const analysisTitle = program && program !== ALL
    ? `ANÁLISIS DE CONTEXTO EXTERNO — ${program}`
    : 'ANÁLISIS DE CONTEXTO EXTERNO';

  if (!summary.total) {
    return <Alert severity="info">No hay registros de oferta para los filtros seleccionados.</Alert>;
  }

  return (
    <Stack spacing={1.2}>
      <Paper elevation={0} sx={{ px: 1.2, py: 1, border: '1px solid #dbe4f0', borderRadius: 2.5, bgcolor: '#fff' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1}>
          <Box>
            <Typography sx={{ color: '#183153', fontWeight: 900, fontSize: 13 }}>Presentación del resumen</Typography>
            <Typography sx={{ color: '#64748b', fontSize: 10.8 }}>Cambia la composición sin alterar los datos filtrados.</Typography>
          </Box>
          <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap">
            <Button size="small" variant={view === 'sequence' ? 'contained' : 'outlined'} onClick={() => onViewChange('sequence')} sx={{ minWidth: 120, fontWeight: 900, textTransform: 'none' }}>Vista secuencia</Button>
            <Button size="small" variant={view === 'panel' ? 'contained' : 'outlined'} onClick={() => onViewChange('panel')} sx={{ minWidth: 120, fontWeight: 900, textTransform: 'none' }}>Vista panel</Button>
            <Button size="small" variant={view === 'orbit' ? 'contained' : 'outlined'} onClick={() => onViewChange('orbit')} sx={{ minWidth: 120, fontWeight: 900, textTransform: 'none' }}>Vista órbita</Button>
            <Button size="small" variant={view === 'radial' ? 'contained' : 'outlined'} onClick={() => onViewChange('radial')} sx={{ minWidth: 120, fontWeight: 900, textTransform: 'none' }}>Vista radial</Button>
            <Button size="small" variant={view === 'executive' ? 'contained' : 'outlined'} onClick={() => onViewChange('executive')} sx={{ minWidth: 120, fontWeight: 900, textTransform: 'none' }}>Vista ejecutiva</Button>
          </Stack>
        </Stack>
      </Paper>

      {view === 'sequence' ? (
        <Paper elevation={0} sx={{ width: '100%', p: { xs: 1.5, md: 2.4, lg: 3 }, border: '1px solid #d5dde8', borderRadius: 3.5, bgcolor: '#fbfcfe', boxShadow: '0 12px 32px rgba(15,23,42,.07)', overflow: 'hidden' }}>
          <Box sx={{ mb: 1.5, textAlign: 'center' }}>
            <Typography sx={{ color: '#082b66', fontSize: { xs: 15, lg: 18 }, fontWeight: 950 }}>{analysisTitle}</Typography>
            <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Indicadores de la oferta académica calculados según los filtros aplicados</Typography>
            <Chip label={`${numberFormat.format(summary.total)} programas analizados`} sx={{ mt: 1, bgcolor: '#082b66', color: '#fff', fontWeight: 900 }} />
          </Box>
          <Box sx={{ position: 'relative' }}>
            <Box sx={{ display: { xs: 'none', lg: 'block' }, position: 'absolute', zIndex: 0, top: 116, left: '8%', right: '8%', height: 2, bgcolor: '#aeb9c8' }} />
            <Box sx={{ position: 'relative', zIndex: 1, display: 'grid', gap: { xs: 1.5, lg: 0.8 }, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: `repeat(${Math.max(groups.length, 1)}, minmax(0, 1fr))` } }}>
              {groups.map((group) => <SequenceGroup key={group.title} {...group} />)}
            </Box>
          </Box>
        </Paper>
      ) : view === 'panel' ? (
        <Paper elevation={0} sx={{ width: '100%', p: { xs: 1.5, md: 2.4, lg: 3 }, border: '1px solid #d5dde8', borderRadius: 3.5, bgcolor: '#f8fafc', boxShadow: '0 12px 32px rgba(15,23,42,.08)' }}>
          <Box sx={{ position: 'relative', minHeight: { xs: 88, lg: 108 }, mb: { xs: 1.7, lg: 2.2 }, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ position: 'absolute', left: { xs: 6, md: 12, lg: 18 }, zIndex: 2, width: { xs: 72, md: 88, lg: 104 }, height: { xs: 72, md: 88, lg: 104 }, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#082b66', color: '#fff', boxShadow: '0 8px 20px rgba(8,43,102,.24)' }}>
              <SchoolRoundedIcon sx={{ fontSize: { xs: 38, md: 48, lg: 57 } }} />
            </Box>
            <Box sx={{ ml: { xs: 6, md: 8, lg: 10 }, width: 'calc(100% - 35px)', height: { xs: 58, lg: 72 }, pl: { xs: 6, md: 8, lg: 10 }, pr: { xs: 2, md: 7 }, display: 'flex', alignItems: 'center', gap: { xs: 1.4, lg: 2.2 }, bgcolor: '#082b66', color: '#fff', clipPath: 'polygon(0 0, 95% 0, 100% 50%, 95% 100%, 0 100%)', boxShadow: '0 7px 18px rgba(8,43,102,.18)' }}>
              <Typography sx={{ fontSize: { xs: 11.5, md: 15, lg: 18 }, fontWeight: 950 }}>TOTAL PROGRAMAS</Typography>
              <Box sx={{ minWidth: { xs: 66, md: 100, lg: 125 }, ml: { xs: 'auto', md: 2 }, mr: { md: 'auto' }, px: 1.4, py: { xs: 0.55, lg: 0.8 }, bgcolor: '#fff', color: '#082b66', border: '1px solid #afbdd0', textAlign: 'center', fontSize: { xs: 19, md: 25, lg: 30 }, lineHeight: 1, fontWeight: 950 }}>{numberFormat.format(summary.total)}</Box>
            </Box>
          </Box>

          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, mb: 1.2 }}>
            {[groupAt(0), groupAt(1)].filter(Boolean).map((group) => <PanelGroup key={group.title} {...group} />)}
          </Box>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
            {[groupAt(2), groupAt(4), groupAt(3)].filter(Boolean).map((group) => <PanelGroup key={group.title} {...group} />)}
          </Box>
        </Paper>
      ) : view === 'orbit' ? (
        <Paper elevation={0} sx={{ p: { xs: 1.3, md: 2 }, border: '1px solid #cbd5e1', borderRadius: 3.5, bgcolor: '#fff', overflow: 'hidden' }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 2.5, md: 0 } }}>
            <Typography sx={{ color: '#082b66', fontSize: 16, fontWeight: 950 }}>OFERTA DE PROGRAMAS ACADÉMICOS</Typography>
            <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>{analysisTitle}</Typography>
          </Box>
          <Box sx={{ position: 'relative', maxWidth: 980, height: { xs: 'auto', md: 660 }, mx: 'auto' }}>
            <Box component="svg" viewBox="0 0 950 660" preserveAspectRatio="none" sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}>
              {orbitConnectors.map((connector) => <polyline key={`orbit-line-${connector.slot}`} points={connector.points} fill="none" stroke={connector.color} strokeWidth="2.2" />)}
              {orbitConnectors.map((connector) => <circle key={`orbit-dot-${connector.slot}`} cx={connector.dot[0]} cy={connector.dot[1]} r="7" fill={connector.color} stroke="#fff" strokeWidth="3" />)}
            </Box>

            <Box sx={{ position: { xs: 'relative', md: 'absolute' }, zIndex: 1, left: { md: 48 }, top: { md: 220 }, width: { xs: 220, md: 250 }, height: { xs: 220, md: 250 }, mx: { xs: 'auto', md: 0 }, mb: { xs: 4.5, md: 0 }, borderRadius: '50%', p: 1.1, border: '2px dashed #aeb9c7', bgcolor: '#fff', boxShadow: '0 15px 34px rgba(15,23,42,.1)' }}>
              <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', display: 'grid', placeItems: 'center', textAlign: 'center', border: '1px solid #d7e0eb', background: 'radial-gradient(circle at 40% 35%,#ffffff 0%,#f8fafc 68%,#eef2f7 100%)' }}>
                <Box>
                  <SchoolRoundedIcon sx={{ color: '#082b66', fontSize: 57 }} />
                  <Typography sx={{ mt: 0.6, color: '#082b66', fontSize: 18, lineHeight: 1.08, fontWeight: 950 }}>OFERTA DE<br />PROGRAMAS<br />ACADÉMICOS</Typography>
                  <Box sx={{ mt: 1, display: 'inline-flex', minWidth: 70, justifyContent: 'center', px: 1.4, py: 0.45, borderRadius: 1.5, bgcolor: '#082b66', color: '#fff', fontSize: 22, lineHeight: 1, fontWeight: 950 }}>{numberFormat.format(summary.total)}</Box>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: { xs: 'grid', md: 'block' }, gap: 4 }}>
              {groups.map((group) => {
                const positions = {
                  0: { position: { md: 'absolute' }, top: { md: 30 }, left: { md: 390 }, right: { md: 12 } },
                  1: { position: { md: 'absolute' }, top: { md: 153 }, left: { md: 390 }, right: { md: 12 } },
                  2: { position: { md: 'absolute' }, top: { md: 276 }, left: { md: 390 }, right: { md: 12 } },
                  4: { position: { md: 'absolute' }, top: { md: 399 }, left: { md: 390 }, right: { md: 12 } },
                  3: { position: { md: 'absolute' }, top: { md: 522 }, left: { md: 390 }, right: { md: 12 } }
                };
                return <OrbitGroup key={group.title} {...group} position={positions[group.slot]} />;
              })}
            </Box>
          </Box>
        </Paper>
      ) : view === 'radial' ? (
        <Paper elevation={0} sx={{ p: { xs: 1.3, md: 2 }, border: '1px solid #cbd5e1', borderRadius: 3.5, bgcolor: '#fff', overflow: 'hidden' }}>
          <Box sx={{ textAlign: 'center', mb: { xs: 2, md: 0 } }}>
            <Typography sx={{ color: '#082b66', fontSize: 16, fontWeight: 950 }}>{analysisTitle}</Typography>
            <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Información consolidada de la tabla OFERTA según los filtros aplicados</Typography>
          </Box>
          <Box sx={{ position: 'relative', maxWidth: 1080, height: { xs: 'auto', md: 700 }, mx: 'auto', mt: { md: 1 } }}>
            <Box component="svg" viewBox="0 0 1000 700" preserveAspectRatio="none" sx={{ display: { xs: 'none', md: 'block' }, position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 }}>
              {radialConnectors.map((connector) => <polyline key={`line-${connector.slot}`} points={connector.points} fill="none" stroke={connector.color} strokeWidth="2" />)}
              {radialConnectors.map((connector) => <circle key={`dot-${connector.slot}`} cx={connector.dot[0]} cy={connector.dot[1]} r="7" fill={connector.color} stroke="#fff" strokeWidth="3" />)}
            </Box>

            <Box sx={{ position: { xs: 'relative', md: 'absolute' }, zIndex: 1, left: { md: '50%' }, top: { md: 190 }, transform: { md: 'translateX(-50%)' }, width: { xs: 210, md: 250 }, height: { xs: 210, md: 250 }, mx: { xs: 'auto', md: 0 }, mb: { xs: 4, md: 0 }, borderRadius: '50%', p: 1.2, background: 'conic-gradient(#173f96 0 16%,#edf2f7 16% 20%,#3a9626 20% 36%,#edf2f7 36% 40%,#ea6a0a 40% 56%,#edf2f7 56% 60%,#0891a5 60% 76%,#edf2f7 76% 80%,#92278f 80% 96%,#edf2f7 96% 100%)', boxShadow: '0 16px 36px rgba(15,23,42,.14)' }}>
              <Box sx={{ width: '100%', height: '100%', borderRadius: '50%', bgcolor: '#fff', border: '1px solid #d7e0eb', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <Box>
                  <Typography sx={{ color: '#52657c', fontSize: 12, fontWeight: 800 }}>TOTAL</Typography>
                  <Typography sx={{ color: '#082b66', fontSize: 23, lineHeight: 1.05, fontWeight: 950 }}>PROGRAMAS</Typography>
                  <Typography sx={{ mt: 1.1, color: '#082b66', fontSize: 42, lineHeight: 1, fontWeight: 950 }}>{numberFormat.format(summary.total)}</Typography>
                </Box>
              </Box>
            </Box>

            <Box sx={{ display: { xs: 'grid', md: 'block' }, gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 4 }}>
              {groups.map((group) => {
                const positions = [
                  { position: { md: 'absolute' }, top: { md: 45 }, left: { md: 10 }, width: { md: 290 } },
                  { position: { md: 'absolute' }, top: { md: 45 }, right: { md: 10 }, width: { md: 290 } },
                  { position: { md: 'absolute' }, top: { md: 285 }, left: { md: 10 }, width: { md: 290 } },
                  { position: { md: 'absolute' }, top: { md: 285 }, right: { md: 10 }, width: { md: 290 } },
                  { position: { md: 'absolute' }, top: { md: 530 }, left: { md: '50%' }, transform: { md: 'translateX(-50%)' }, width: { md: 310 } }
                ];
                return <RadialGroup key={group.title} {...group} position={positions[group.slot]} />;
              })}
            </Box>
          </Box>
        </Paper>
      ) : (
        <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3.5, overflow: 'hidden', bgcolor: '#f6f8fc' }}>
          <Box sx={{ px: { xs: 2, md: 2.6 }, py: 1.6, bgcolor: '#082b66', color: '#fff' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1.5}>
              <Stack direction="row" spacing={1.3} alignItems="center"><Box sx={{ width: 42, height: 42, borderRadius: 2.2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.12)' }}><SchoolRoundedIcon /></Box><Box><Typography sx={{ fontWeight: 950, fontSize: 15 }}>{analysisTitle}</Typography><Typography sx={{ color: '#c9d8ef', fontSize: 11.5 }}>Resumen ejecutivo según los filtros aplicados</Typography></Box></Stack>
              <Stack direction="row" spacing={1.2} alignItems="center"><Typography sx={{ color: '#c9d8ef', fontSize: 11.5, fontWeight: 800 }}>TOTAL DE PROGRAMAS</Typography><Box sx={{ minWidth: 82, px: 2, py: 0.7, borderRadius: 2, bgcolor: '#fff', color: '#082b66', textAlign: 'center', fontSize: 25, lineHeight: 1, fontWeight: 950 }}>{numberFormat.format(summary.total)}</Box></Stack>
            </Stack>
          </Box>
          <Box sx={{ p: { xs: 1.5, md: 2 }, display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', xl: 'repeat(5, minmax(0, 1fr))' }, alignItems: 'stretch' }}>{groups.map((group) => <SummaryGroup key={group.title} {...group} />)}</Box>
        </Paper>
      )}
    </Stack>
  );
}

export default function ContextoExternoDashboardPanel({ onBack }) {
  const [mainTab, setMainTab] = useState(0);
  const [populationTab, setPopulationTab] = useState(0);
  const [populationViews, setPopulationViews] = useState([
    { chartType: 'stacked', scope: 'nacional' },
    { chartType: 'stacked', scope: 'nacional' },
    { chartType: 'stacked', scope: 'nacional' }
  ]);
  const [payload, setPayload] = useState({ oferta: [], poblacional: [], metadata: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [exportingPdf, setExportingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [selectedProgram, setSelectedProgram] = useState(ALL);
  const [summaryView, setSummaryView] = useState(() => window.localStorage.getItem('contextoExternoSummaryViewV4') || 'sequence');
  const [geoDepartments, setGeoDepartments] = useState([]);
  const [geoBbox, setGeoBbox] = useState(null);
  const [municipalityCatalog, setMunicipalityCatalog] = useState([]);
  const [selectedMunicipalityForMap, setSelectedMunicipalityForMap] = useState(null);

  const [offerSearch, setOfferSearch] = useState('');
  const [sector, setSector] = useState(ALL);
  const [modality, setModality] = useState(ALL);
  const [regionFilter, setRegionFilter] = useState(ALL);
  const [municipality, setMunicipality] = useState(ALL);

  const [period, setPeriod] = useState(ALL);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await gestionInformacionService.getContextoExternoGeneralDashboard();
      setPayload(response?.data || { oferta: [], poblacional: [], metadata: {} });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No fue posible cargar Contexto Externo General.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { window.localStorage.setItem('contextoExternoSummaryViewV4', summaryView); }, [summaryView]);
  useEffect(() => {
    let active = true;
    Promise.all([
      fetch('/geodata/colombia_adm1.geojson').then((response) => response.json()),
      fetch('/geodata/divipola_municipios.json').then((response) => response.json())
    ]).then(([geojson, municipalities]) => {
      if (!active) return;
      let minLon = Infinity; let maxLon = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
      const features = (geojson.features || []).map((feature) => {
        const geometry = feature.geometry || {};
        const rings = geometry.type === 'Polygon'
          ? [geometry.coordinates[0]]
          : (geometry.coordinates || []).map((polygon) => polygon[0]);
        rings.forEach((ring) => ring.forEach(([lon, lat]) => {
          minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
          minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
        }));
        const label = String(feature.properties?.shapeName || feature.properties?.NOMBRE_DPT || '').trim();
        return { name: normalizeGeo(label), label, rings };
      }).filter((feature) => feature.name && feature.rings.length);
      setGeoDepartments(features);
      setGeoBbox({ minLon, maxLon, minLat, maxLat });
      setMunicipalityCatalog(Array.isArray(municipalities) ? municipalities : []);
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  const oferta = useMemo(() => payload.oferta || [], [payload.oferta]);
  const poblacional = useMemo(() => payload.poblacional || [], [payload.poblacional]);

  const offerOptions = useMemo(() => ({
    sectors: unique(oferta, 'sector'),
    modalities: unique(oferta, 'modalidad'),
    regions: [ALL, ...REGIONS_DEFINITION.map((r) => r.key)],
    municipalities: unique(oferta, 'municipio')
  }), [oferta]);

  const filteredOffer = useMemo(() => {
    const search = normalize(offerSearch);
    return oferta.filter((row) => {
      if (selectedProgram !== ALL && normalize(row.area_conocimiento) !== normalize(selectedProgram)) return false;
      if (sector !== ALL && row.sector !== sector) return false;
      if (modality !== ALL && row.modalidad !== modality) return false;
      if (regionFilter !== ALL && getRegionForDepartment(row.departamento).key !== regionFilter) return false;
      if (municipality !== ALL && row.municipio !== municipality) return false;
      if (!search) return true;
      return [row.nombre_programa, row.institucion, row.area_conocimiento, row.municipio, row.departamento]
        .some((value) => normalize(value).includes(search));
    });
  }, [oferta, selectedProgram, sector, modality, regionFilter, municipality, offerSearch]);

  const programSummaries = useMemo(() => {
    const summarize = (scope) => {
      const grouped = new Map();
      const rows = scope === 'NACIONAL'
        ? filteredOffer
        : filteredOffer.filter((row) => normalize(row.georeferencia) === scope);
      rows
        .forEach((row) => {
          const label = String(row.nombre_programa || 'SIN INFORMACIÓN').trim();
          const key = normalize(label);
          if (!grouped.has(key)) grouped.set(key, { key, label, total: 0 });
          grouped.get(key).total += 1;
        });
      return Array.from(grouped.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'));
    };
    return { national: summarize('NACIONAL'), regional: summarize('REGIONAL') };
  }, [filteredOffer]);

  const geoOfferSummary = useMemo(() => {
    const index = new Map();
    const addIndex = (key, item) => {
      if (!key) return;
      if (!index.has(key)) index.set(key, []);
      if (!index.get(key).some((candidate) => candidate.code === item.code)) index.get(key).push(item);
    };
    municipalityCatalog.forEach((item) => {
      const key = normalizeGeo(item.name_normalized || item.name);
      addIndex(key, item);
      if (key.startsWith('SANTIAGO DE ')) addIndex(key.replace(/^SANTIAGO DE /, ''), item);
      if (key.startsWith('EL ')) addIndex(key.replace(/^EL /, ''), item);
      if (key === 'SAN JOSE DE CUCUTA') addIndex('CUCUTA', item);
      if (key === 'CARTAGENA DE INDIAS') addIndex('CARTAGENA', item);
    });

    const departmentHints = new Map();
    filteredOffer.forEach((row) => {
      const municipalityKey = normalizeGeo(row.municipio);
      const departmentKey = normalizeGeo(row.departamento);
      if (municipalityKey && departmentKey) departmentHints.set(municipalityKey, departmentKey);
    });

    const resolveMunicipality = (row) => {
      const municipalityKey = normalizeGeo(row.municipio);
      if (!municipalityKey) return null;
      let candidates = index.get(municipalityKey) || [];
      if (!candidates.length) {
        const words = municipalityKey.split(' ');
        for (let length = words.length - 1; length > 0 && !candidates.length; length -= 1) {
          candidates = index.get(words.slice(0, length).join(' ')) || [];
        }
      }
      if (candidates.length <= 1) return candidates[0] || null;
      const departmentKey = normalizeGeo(row.departamento) || departmentHints.get(municipalityKey);
      return candidates.find((candidate) => normalizeGeo(candidate.department_name_normalized || candidate.department_name) === departmentKey) || null;
    };

    const aggregate = (rows) => {
      const municipalities = new Map();
      const departments = new Map();
      rows.forEach((row) => {
        const sourceMunicipality = String(row.municipio || '').trim();
        if (!sourceMunicipality) return;
        const resolved = resolveMunicipality(row);
        const municipalityKey = resolved?.code || normalizeGeo(sourceMunicipality);
        const departmentLabel = resolved?.department_name || String(row.departamento || row.department_name || row.depto || '').trim();
        const departmentKey = normalizeGeo(departmentLabel);

        if (!municipalities.has(municipalityKey)) {
          municipalities.set(municipalityKey, {
            key: municipalityKey,
            label: resolved?.name ? formatGeoLabel(resolved.name) : sourceMunicipality,
            total: 0,
            latitude: Number(resolved?.latitude),
            longitude: Number(resolved?.longitude),
            department_name: departmentLabel ? formatGeoLabel(departmentLabel) : 'OTRO DEPARTAMENTO'
          });
        }
        municipalities.get(municipalityKey).total += 1;
        if (departmentKey) {
          if (!departments.has(departmentKey)) departments.set(departmentKey, { key: departmentKey, label: formatGeoLabel(departmentLabel), total: 0 });
          departments.get(departmentKey).total += 1;
        }
      });
      return {
        municipalities: Array.from(municipalities.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es')),
        departments: Array.from(departments.values()).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'es'))
      };
    };

    return {
      national: aggregate(filteredOffer),
      regional: aggregate(filteredOffer.filter((row) => normalize(row.georeferencia) === 'REGIONAL'))
    };
  }, [filteredOffer, municipalityCatalog]);

  const offerSummary = useMemo(() => {
    const countField = (field) => {
      const counts = new Map();
      filteredOffer.forEach((row) => {
        const label = String(row[field] || '').trim();
        if (!label) return;
        const key = normalize(label);
        if (!counts.has(key)) counts.set(key, { label, value: 0 });
        counts.get(key).value += 1;
      });
      return counts;
    };
    const fieldItems = (field) => Array.from(countField(field).values())
      .filter((item) => item.value > 0)
      .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
    const credits = filteredOffer.map((row) => Number(row.numero_creditos)).filter((value) => Number.isFinite(value) && value > 0);
    const semesterItems = fieldItems('numero_semestres')
      .map((item) => ({ ...item, label: `${item.label} semestres` }))
      .sort((a, b) => Number(a.label.split(' ')[0]) - Number(b.label.split(' ')[0]));
    const average = credits.length ? credits.reduce((total, value) => total + value, 0) / credits.length : 0;
    return {
      total: filteredOffer.length,
      recognition: fieldItems('reconocimiento_men'),
      sectors: fieldItems('sector'),
      modalities: fieldItems('modalidad'),
      semesters: semesterItems,
      credits: credits.length ? [
        { label: 'Mínimo de créditos', value: credits.length ? Math.min(...credits) : 0 },
        { label: 'Máximo de créditos', value: credits.length ? Math.max(...credits) : 0 },
        { label: 'Promedio de créditos', value: average.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
      ] : []
    };
  }, [filteredOffer]);

  const programOptions = useMemo(() => [
    ALL,
    ...Array.from(new Set([
      ...poblacional.map((row) => String(row.programa || '').trim()),
      ...oferta.map((row) => String(row.area_conocimiento || '').trim())
    ].filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))
  ], [poblacional, oferta]);
  const periodOptions = useMemo(() => [ALL, ...Array.from(new Set(poblacional.map((row) => row.periodo_referencia).filter(Boolean))).sort()], [poblacional]);
  const activeGroup = metricGroups[populationTab];

  const populationRows = useMemo(() => poblacional.filter((row) => {
    if (selectedProgram !== ALL && normalize(row.programa) !== normalize(selectedProgram)) return false;
    if (period !== ALL && row.periodo_referencia !== period) return false;
    return activeGroup.fields.some(([field]) => row[field] !== null && row[field] !== undefined);
  }), [poblacional, selectedProgram, period, activeGroup]);

  const populationChart = useMemo(() => {
    const byPeriod = new Map();
    populationRows.forEach((row) => {
      const key = row.periodo_referencia;
      if (!key) return;
      if (!byPeriod.has(key)) byPeriod.set(key, { periodo: key });
      const target = byPeriod.get(key);
      activeGroup.fields.forEach(([field]) => { target[field] = Number(target[field] || 0) + Number(row[field] || 0); });
    });
    return Array.from(byPeriod.values()).sort(periodSort);
  }, [populationRows, activeGroup]);

  const lastUploadLabel = payload.metadata?.lastUpload
    ? new Date(payload.metadata.lastUpload).toLocaleString('es-CO')
    : 'Sin cargues registrados';

  const handleExportPdf = async () => {
    if (selectedProgram === ALL) {
      setPdfError('Selecciona un programa específico para generar el informe PDF.');
      return;
    }
    setExportingPdf(true);
    setPdfError('');
    try {
      const response = await gestionInformacionService.downloadContextoExternoGeneralPdf(selectedProgram, {
        seccion: 'completo',
        grafico_ingreso: populationViews[0].chartType,
        alcance_ingreso: populationViews[0].scope,
        grafico_matriculados: populationViews[1].chartType,
        alcance_matriculados: populationViews[1].scope,
        grafico_graduados: populationViews[2].chartType,
        alcance_graduados: populationViews[2].scope
      });
      const url = window.URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = `contexto_externo_${normalize(selectedProgram).toLowerCase().replace(/[^a-z0-9]+/g, '_')}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    } catch (requestError) {
      let message = 'No fue posible generar el informe PDF.';
      const blob = requestError?.response?.data;
      if (blob instanceof Blob) {
        try { message = JSON.parse(await blob.text())?.message || message; } catch (_) {}
      }
      setPdfError(message);
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return <Box sx={{ minHeight: 460, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" spacing={2}><CircularProgress /><Typography>Cargando Contexto Externo General…</Typography></Stack></Box>;
  }

  return (
    <Stack spacing={2.5} sx={{ width: '100%', pb: 6 }}>
      <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3.5, overflow: 'hidden' }}>
        <Box component="img" src={encabezadoCorreosImg} alt="UNICESMAG" sx={{ width: '100%', height: { xs: 62, md: 78 }, objectFit: 'contain', bgcolor: '#fff' }} />
        <Box sx={{ px: { xs: 2, md: 3 }, py: 2, color: '#fff', background: 'linear-gradient(135deg, #173f96 0%, #2563eb 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button onClick={onBack} sx={{ minWidth: 42, color: '#fff', borderColor: 'rgba(255,255,255,.5)' }} variant="outlined"><ArrowBackRoundedIcon /></Button>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 17, md: 21 } }}>CONTEXTO EXTERNO GENERAL</Typography>
                <Typography sx={{ opacity: 0.86, fontSize: 12.5 }}>Oferta académica y series históricas nacional/regional</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={`Actualización: ${lastUploadLabel}`} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.16)', fontWeight: 700 }} />
              <Button onClick={loadData} startIcon={<RefreshRoundedIcon />} variant="contained" sx={{ bgcolor: '#fff', color: '#1d4ed8', fontWeight: 800, '&:hover': { bgcolor: '#eff6ff' } }}>Actualizar</Button>
            </Stack>
          </Stack>
        </Box>
        <Tabs value={mainTab} onChange={(_, value) => setMainTab(value)} variant="fullWidth" sx={{ p: 1, '& .MuiTab-root': { fontWeight: 900, textTransform: 'none' } }}>
          <Tab icon={<SchoolRoundedIcon />} iconPosition="start" label="Oferta académica" />
          <Tab icon={<GroupsRoundedIcon />} iconPosition="start" label="Información poblacional" />
        </Tabs>
      </Paper>

      {error && <Alert severity="error" action={<Button onClick={loadData}>Reintentar</Button>}>{error}</Alert>}
      {!error && !oferta.length && !poblacional.length && (
        <Alert severity="info">Aún no hay datos. Descarga la plantilla “Contexto Externo General” desde Gestión de Bases de Datos y carga el libro diligenciado.</Alert>
      )}
      {pdfError && <Alert severity="warning" onClose={() => setPdfError('')}>{pdfError}</Alert>}

      <Paper elevation={0} sx={{ p: 2.2, border: '2px solid #bfdbfe', borderRadius: 3, bgcolor: '#f8fbff' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <FilterSelect label="Programa para todo el análisis" value={selectedProgram} onChange={(value) => { setSelectedProgram(value); setPeriod(ALL); }} options={programOptions} />
          </Box>
          <Chip
            label={selectedProgram === ALL ? 'Vista consolidada' : selectedProgram}
            color={selectedProgram === ALL ? 'default' : 'primary'}
            sx={{ maxWidth: { md: 330 }, fontWeight: 800 }}
          />
          <Button
            variant="contained"
            color="error"
            startIcon={<PictureAsPdfRoundedIcon />}
            onClick={handleExportPdf}
            disabled={selectedProgram === ALL || exportingPdf}
            sx={{ minWidth: 210, py: 1.05, fontWeight: 900 }}
          >
            {exportingPdf ? 'Generando informe completo…' : 'Exportar informe PDF completo'}
          </Button>
        </Stack>
        <Typography sx={{ mt: 1, color: '#64748b', fontSize: 12 }}>
          El programa seleccionado controla la oferta nacional, la oferta regional y todas las series poblacionales del dashboard y del PDF.
        </Typography>
      </Paper>

      {mainTab === 0 && (
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900, mb: 2 }}>Filtros de oferta académica</Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '2fr repeat(4, minmax(130px, 1fr))' } }}>
              <TextField size="small" label="Programa, institución o palabra clave" value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} />
              <FilterSelect label="Sector" value={sector} onChange={setSector} options={offerOptions.sectors} />
              <FilterSelect label="Modalidad" value={modality} onChange={setModality} options={offerOptions.modalities} />
              <FilterSelect label="Región" value={regionFilter} onChange={setRegionFilter} options={offerOptions.regions} />
              <FilterSelect label="Municipio" value={municipality} onChange={setMunicipality} options={offerOptions.municipalities} />
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
            <ProgramSummaryTable title="OFERTA NACIONAL" rows={programSummaries.national} color="#082b66" />
            <ProgramSummaryTable title="OFERTA REGIONAL" rows={programSummaries.regional} color="#b5123f" />
          </Box>

          <OfferSummary summary={offerSummary} view={summaryView} onViewChange={setSummaryView} program={selectedProgram} />

          <Paper elevation={0} sx={{ px: { xs: 1.7, md: 2.3 }, py: 1.5, border: '1px solid #cbd5e1', borderRadius: 3, bgcolor: '#f8fafc' }}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#e0ecff', color: '#173f96' }}>
                <MapRoundedIcon />
              </Box>
              <Box>
                <Typography sx={{ color: '#102a4c', fontWeight: 950, fontSize: 16 }}>DISTRIBUCIÓN TERRITORIAL DE LA OFERTA</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>Análisis cartográfico nacional y regional desplegado por municipios y departamentos</Typography>
              </Box>
            </Stack>
          </Paper>

          <Stack spacing={3}>
            <ColombiaOfferMap
              title="MAPA DE MUNICIPIOS · NACIONAL"
              subtitle="Concentración municipal de la oferta en Colombia (bolas de colores por nodo con etiquetas de top puntajes)"
              type="municipality"
              rows={geoOfferSummary.national.municipalities}
              features={geoDepartments}
              bbox={geoBbox}
              color="#173f96"
              onSelectMunicipality={(muni) => setSelectedMunicipalityForMap(muni)}
            />

            <ColombiaOfferMap
              title="MAPA DE MUNICIPIOS · REGIONAL"
              subtitle="Concentración municipal de la oferta regional (zoom enfocado en territorio regional)"
              type="municipality"
              rows={geoOfferSummary.regional.municipalities}
              features={geoDepartments}
              bbox={geoBbox}
              color="#b5123f"
              onSelectMunicipality={(muni) => setSelectedMunicipalityForMap(muni)}
            />

            <ColombiaOfferMap
              title="MAPA DE DEPARTAMENTOS · NACIONAL"
              subtitle="Intensidad de oferta por departamento a nivel nacional"
              type="department"
              rows={geoOfferSummary.national.departments}
              features={geoDepartments}
              bbox={geoBbox}
              color="#173f96"
              onSelectMunicipality={(muni) => setSelectedMunicipalityForMap(muni)}
            />

            <ColombiaOfferMap
              title="MAPA DE DEPARTAMENTOS · REGIONAL"
              subtitle="Intensidad de oferta por departamento a nivel regional"
              type="department"
              rows={geoOfferSummary.regional.departments}
              features={geoDepartments}
              bbox={geoBbox}
              color="#b5123f"
              onSelectMunicipality={(muni) => setSelectedMunicipalityForMap(muni)}
            />
          </Stack>
        </Stack>
      )}

      {mainTab === 1 && (
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 1, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Tabs value={populationTab} onChange={(_, value) => setPopulationTab(value)} variant="fullWidth" sx={{ '& .MuiTab-root': { fontWeight: 800, textTransform: 'none' } }}>
              {metricGroups.map((group) => <Tab key={group.label} label={group.label} />)}
            </Tabs>
          </Paper>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '1fr' } }}>
              <FilterSelect label="Periodo" value={period} onChange={setPeriod} options={periodOptions} />
            </Box>
          </Paper>

          <PopulationChartSwitcher
            data={populationChart}
            groupIndex={populationTab}
            selection={populationViews[populationTab]}
            onSelectionChange={(nextSelection) => setPopulationViews((current) => current.map((item, index) => (index === populationTab ? nextSelection : item)))}
          />
        </Stack>
      )}

      <MunicipalityGoogleMapsModal
        open={Boolean(selectedMunicipalityForMap)}
        municipalityName={selectedMunicipalityForMap}
        filteredOffer={filteredOffer}
        onClose={() => setSelectedMunicipalityForMap(null)}
      />
    </Stack>
  );
}
