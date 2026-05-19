import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  Fade
} from '@mui/material';
import {
  ContentCopy as ContentCopyIcon,
  FilterAltOff as FilterAltOffIcon,
  Female as FemaleIcon,
  Groups as GroupsIcon,
  Male as MaleIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import {
  Cell,
  Bar,
  BarChart,
  CartesianGrid,
  Pie,
  PieChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import html2canvas from 'html2canvas';
import gestionInformacionService from '../../services/gestionInformacionService';

const BLUE = '#1f73e8';
const LIGHT_BLUE = '#b8cae9';
const BORDER_BLUE = '#6aa3ff';
const TEXT_BLUE = '#1764c9';

const dedicationPalette = [
  { base: '#1f73e8', light: '#b8cae9' },
  { base: '#078b95', light: '#9fd5d8' },
  { base: '#c91d22', light: '#f3b6b8' },
  { base: '#6d28d9', light: '#c4b5fd' },
  { base: '#0f766e', light: '#99f6e4' }
];

const educationPalette = [
  { base: '#1f73e8', light: '#b8cae9' },
  { base: '#2563eb', light: '#bfdbfe' },
  { base: '#0f766e', light: '#99f6e4' },
  { base: '#7c3aed', light: '#c4b5fd' },
  { base: '#dc2626', light: '#fecaca' }
];

const rankPalette = [
  { base: '#27ae60', light: '#94d3ad' },
  { base: '#1f9d55', light: '#a7e3bd' },
  { base: '#16a34a', light: '#bbf7d0' },
  { base: '#15803d', light: '#86efac' },
  { base: '#0f766e', light: '#99f6e4' }
];

const numberFmt = new Intl.NumberFormat('es-CO');

const emptyFilters = {
  anio: '',
  periodo: '',
  programa: '',
  escalafon: '',
  tipoVinculacion: ''
};

const normalizeText = (value) => String(value || '').trim();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const normalizeGender = (value) => {
  const raw = normalizeUpper(value);
  if (['M', 'MASCULINO', 'HOMBRE'].includes(raw)) return 'Masculino';
  if (['F', 'FEMENINO', 'MUJER'].includes(raw)) return 'Femenino';
  return raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : 'Sin información';
};

const normalizePeriod = (value) => {
  if (value === null || value === undefined || value === '') return '';
  const text = normalizeText(value);
  const upper = text.toUpperCase();
  const numeric = Number(text.replace(',', '.'));

  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 90000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + numeric * 86400000);
    return date.getUTCMonth() + 1 <= 6 ? 'IP' : 'IIP';
  }

  if (/\b(IIP|II|2)\b/.test(upper)) return 'IIP';
  if (/\b(IP|I|1)\b/.test(upper)) return 'IP';
  return '';
};

const getRowYear = (row) => {
  const explicitYear = Number(row?.anio || 0);
  if (Number.isFinite(explicitYear) && explicitYear >= 1900 && explicitYear <= 2200) return String(explicitYear);
  const match = normalizeText(row?.periodo || '').match(/\b(19|20)\d{2}\b/);
  return match ? match[0] : '';
};

const getRowPeriodToken = (row) => normalizePeriod(row?.periodo || row?.anio);
const getRowPeriodLabel = (row) => {
  const year = getRowYear(row);
  const period = getRowPeriodToken(row);
  return year && period ? `${year} ${period}` : '';
};

const isValidDocenteRow = (row) =>
  Boolean(getRowYear(row) && getRowPeriodToken(row) && normalizeText(row?.docente) && normalizeText(row?.genero || row?.genero_biologico));

const normalizeCargoGroup = (rowOrValue) => {
  const rawValue = typeof rowOrValue === 'object' && rowOrValue !== null ? rowOrValue.cargo : rowOrValue;
  const raw = normalizeUpper(rawValue);
  if (!raw && typeof rowOrValue === 'object' && normalizeText(rowOrValue.docente)) return 'PROFESORES';
  if (raw.includes('ADMIN')) return 'ADMINISTRATIVOS';
  if (raw.includes('PROF') || raw.includes('DOCENT')) return 'PROFESORES';
  return raw || 'SIN CARGO';
};

const normalizeEducationLevel = (value) => {
  const raw = normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!raw) return 'Sin información';
  if (raw.includes('DOCTOR')) return 'DOCTOR';
  if (raw.includes('MAEST') || raw.includes('MAGIST') || raw.includes('MASTER')) return 'MAGISTER';
  if (raw.includes('ESPECIAL')) return 'ESPECIALISTA';
  if (raw.includes('UNIVERSIT') || raw.includes('PROFESIONAL') || raw.includes('PREGRADO')) return 'PROFESIONAL';
  return normalizeText(value);
};

const normalizeEscalafon = (value) => {
  const raw = normalizeUpper(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  if (!raw) return 'Sin información';
  if (raw.includes('BASIC')) return 'BÁSICO';
  if (raw.includes('AUXILIAR')) return 'AUXILIAR';
  if (raw.includes('ASISTENTE')) return 'ASISTENTE';
  if (raw.includes('ASOCIADO')) return 'ASOCIADO';
  if (raw.includes('TITULAR')) return 'TITULAR';
  return normalizeText(value).toUpperCase();
};

const rowWeight = (row) => {
  // En Recurso Humano cada fila representa un registro/persona para el dashboard.
  // Algunos históricos traen total_docentes = 0; usar ese campo descuadra los totales.
  return row ? 1 : 0;
};

const uniqueSorted = (rows, getter) =>
  Array.from(new Set(rows.map((row) => normalizeText(getter(row))).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));

const sortPeriods = (periods) => {
  const order = { IP: 1, IIP: 2 };
  return [...periods].sort((a, b) => {
    const [yearA, periodA] = String(a).split(/\s+/);
    const [yearB, periodB] = String(b).split(/\s+/);
    return Number(yearB || 0) - Number(yearA || 0)
      || (order[periodA] || 99) - (order[periodB] || 99)
      || a.localeCompare(b, 'es');
  });
};

const latestValue = (values) => {
  const numeric = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (numeric.length) return String(Math.max(...numeric));
  return values[values.length - 1] || '';
};

const getPercent = (value, total) => {
  if (!total) return 0;
  return (Number(value || 0) / total) * 100;
};

const copyChartAsImage = async (cardEl, enqueueSnackbar) => {
  try {
    const canvas = await html2canvas(cardEl, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
      ignoreElements: (el) => el.hasAttribute('data-copy-btn')
    });
    canvas.toBlob(async (blob) => {
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        enqueueSnackbar('Gráfico copiado al portapapeles', { variant: 'success' });
      } catch {
        enqueueSnackbar('No se pudo copiar al portapapeles', { variant: 'warning' });
      }
    }, 'image/png');
  } catch {
    enqueueSnackbar('Error al copiar el gráfico', { variant: 'error' });
  }
};

const groupWeighted = (rows, getter) => {
  const map = new Map();
  rows.forEach((row) => {
    const label = normalizeText(getter(row)) || 'Sin información';
    const value = rowWeight(row);
    map.set(label, (map.get(label) || 0) + value);
  });
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Number(value || 0) }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
};

const genderIcon = (name) => {
  const normalized = normalizeUpper(name);
  if (normalized.includes('FEM')) return <FemaleIcon sx={{ fontSize: 18 }} />;
  if (normalized.includes('MAS')) return <MaleIcon sx={{ fontSize: 18 }} />;
  return <GroupsIcon sx={{ fontSize: 18 }} />;
};

const genderColor = (name, colors = [BLUE, LIGHT_BLUE]) => {
  const normalized = normalizeUpper(name);
  if (normalized.includes('FEM')) return colors[1] || LIGHT_BLUE;
  if (normalized.includes('MAS')) return colors[0] || BLUE;
  return colors[2] || '#94a3b8';
};

const orderGenderLegend = (data) => {
  const rank = (name) => {
    const normalized = normalizeUpper(name);
    if (normalized.includes('FEM')) return 1;
    if (normalized.includes('MAS')) return 2;
    return 9;
  };
  return [...data].sort((a, b) => rank(a.name) - rank(b.name));
};

const CopyChartBtn = ({ chartRef }) => {
  const { enqueueSnackbar } = useSnackbar();
  return (
    <IconButton
      data-copy-btn="true"
      size="small"
      title="Copiar gráfico"
      onClick={() => { if (chartRef?.current) copyChartAsImage(chartRef.current, enqueueSnackbar); }}
      sx={{
        position: 'absolute',
        top: 4,
        right: 4,
        zIndex: 10,
        width: 26,
        height: 26,
        bgcolor: 'rgba(255,255,255,.88)',
        border: '1px solid #dbeafe',
        color: BLUE,
        '&:hover': { bgcolor: '#eff6ff', borderColor: BLUE }
      }}
    >
      <ContentCopyIcon sx={{ fontSize: 13 }} />
    </IconButton>
  );
};

const DonutOuterLabel = ({ cx, cy, midAngle, outerRadius, percent, value }) => {
  if (!value || percent < 0.04) return null;
  const RADIAN = Math.PI / 180;
  const r = Number(outerRadius || 0) * 1.46;
  const x = Number(cx || 0) + r * Math.cos(-midAngle * RADIAN);
  const y = Number(cy || 0) + r * Math.sin(-midAngle * RADIAN);
  const pct = `(${(percent * 100).toFixed(1).replace('.', ',')}%)`;
  return (
    <text x={x} y={y} textAnchor="middle" dominantBaseline="central">
      <tspan x={x} dy="-0.4em" style={{ fontSize: 14, fontWeight: 900, fill: '#1e293b' }}>
        {numberFmt.format(value)}
      </tspan>
      <tspan x={x} dy="1.25em" style={{ fontSize: 12, fontWeight: 700, fill: '#64748b' }}>
        {pct}
      </tspan>
    </text>
  );
};

const SegmentLegend = ({ data, total }) => {
  const colors = [BLUE, LIGHT_BLUE, '#7dd3fc', '#c4b5fd'];
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        gap: 1,
        mt: 1.6
      }}
    >
      {data.slice(0, 2).map((item, index) => (
        <Box
          key={item.name}
          sx={{
            border: '1px solid #dbeafe',
            borderRadius: 1.5,
            px: 1.2,
            py: 0.8,
            background: index === 0 ? '#f8fbff' : '#f5f8fc'
          }}
        >
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Box
              sx={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                color: '#ffffff',
                bgcolor: colors[index % colors.length]
              }}
            >
              {genderIcon(item.name)}
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1 }}>
                {item.name}
              </Typography>
              <Typography sx={{ fontSize: 15, color: '#0f172a', fontWeight: 900, lineHeight: 1.25 }}>
                {numberFmt.format(item.value)}
                <Box component="span" sx={{ ml: 0.5, fontSize: 11, color: '#64748b', fontWeight: 800 }}>
                  {getPercent(item.value, total).toFixed(1).replace('.', ',')}%
                </Box>
              </Typography>
            </Box>
          </Stack>
        </Box>
      ))}
    </Box>
  );
};

const GenderValueLegend = ({ data, colors = [BLUE, LIGHT_BLUE] }) => {
  const ordered = orderGenderLegend(data).filter((d) => Number(d.value || 0) > 0).slice(0, 2);
  return (
    <Stack direction="row" spacing={2} justifyContent="center" alignItems="center" sx={{ mt: 1.4 }}>
      {ordered.map((item) => {
        const dotColor = genderColor(item.name, colors);
        return (
          <Stack key={item.name} direction="row" spacing={0.7} alignItems="center">
            <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: dotColor, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {item.name}
            </Typography>
          </Stack>
        );
      })}
    </Stack>
  );
};

const GenderDonut = ({ data, total }) => {
  const chartData = data.filter((item) => Number(item.value || 0) > 0);
  const colors = [BLUE, LIGHT_BLUE, '#7dd3fc', '#c4b5fd'];

  if (!chartData.length) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: 128 }}>
        <Typography variant="body2" sx={{ color: '#64748b' }}>Sin distribución</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: 240, overflow: 'visible' }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius="40%"
            outerRadius="60%"
            paddingAngle={2}
            startAngle={90}
            endAngle={-270}
            label={DonutOuterLabel}
            labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
            isAnimationActive
            animationDuration={900}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [numberFmt.format(Number(value || 0)), name]} />
        </PieChart>
      </ResponsiveContainer>
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <Typography
          sx={{
            color: BLUE,
            fontSize: total >= 10000 ? 26 : 34,
            fontWeight: 700,
            lineHeight: 1,
            maxWidth: 120,
            textAlign: 'center'
          }}
        >
          {numberFmt.format(total)}
        </Typography>
      </Stack>
    </Box>
  );
};

const AnalyticCard = ({ title, subtitle, children, icon, height = 300, chartRef }) => (
  <Paper
    ref={chartRef}
    elevation={0}
    sx={{
      height: '100%',
      position: 'relative',
      border: `1px solid ${BORDER_BLUE}`,
      borderRadius: 1.5,
      overflow: 'hidden',
      background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
      boxShadow: '0 10px 24px rgba(31,115,232,.11)'
    }}
  >
    <Stack
      direction="row"
      spacing={1}
      alignItems="center"
      justifyContent="space-between"
      sx={{ px: 2, py: 1.2, borderBottom: '1px solid #dbeafe', bgcolor: '#ffffff' }}
    >
      <Box>
        <Typography sx={{ fontSize: 15, fontWeight: 950, color: '#0f172a', textTransform: 'uppercase' }}>
          {title}
        </Typography>
        {subtitle ? (
          <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#64748b' }}>{subtitle}</Typography>
        ) : null}
      </Box>
      <Box
        sx={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          display: 'grid',
          placeItems: 'center',
          color: BLUE,
          bgcolor: '#eff6ff'
        }}
      >
        {icon}
      </Box>
    </Stack>
    <Box sx={{ height, px: 1.5, py: 1.5, position: 'relative' }}>
      {chartRef ? <CopyChartBtn chartRef={chartRef} /> : null}
      {children}
    </Box>
  </Paper>
);

const ProfessionalDonut = ({ data, total }) => {
  const colors = [BLUE, LIGHT_BLUE, '#0ea5e9', '#94a3b8'];
  return (
    <Stack sx={{ height: '100%' }}>
      <Box sx={{ flex: 1, minHeight: 210, position: 'relative', overflow: 'visible' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="60%"
              paddingAngle={2}
              startAngle={90}
              endAngle={-270}
              label={DonutOuterLabel}
              labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
              isAnimationActive
              animationDuration={900}
            >
              {data.map((entry, index) => (
                <Cell key={entry.name} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [
                `${numberFmt.format(Number(value || 0))} (${getPercent(value, total).toFixed(1).replace('.', ',')}%)`,
                name
              ]}
            />
          </PieChart>
        </ResponsiveContainer>
        <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <Typography sx={{ fontSize: 34, fontWeight: 800, color: BLUE, lineHeight: 1 }}>
            {numberFmt.format(total)}
          </Typography>
          <Typography sx={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase' }}>
            Total
          </Typography>
        </Stack>
      </Box>
      <GenderValueLegend data={data} colors={colors} />
    </Stack>
  );
};

const ProfessionalBarChart = ({ data, color = BLUE, xLabel = '' }) => {
  const maxValue = Math.max(...data.map((item) => Number(item.value || 0)), 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 16, right: 16, left: 6, bottom: 22 }}>
        <CartesianGrid stroke="#d9e4f5" strokeDasharray="2 4" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fontWeight: 800, fill: '#0f172a' }}
          interval={0}
          height={42}
          label={xLabel ? { value: xLabel, position: 'insideBottom', offset: -12, fill: '#64748b', fontSize: 10, fontWeight: 800 } : undefined}
        />
        <YAxis
          tick={{ fontSize: 11, fill: '#475569' }}
          width={38}
          domain={[0, Math.ceil(maxValue * 1.18)]}
        />
        <Tooltip formatter={(value, name, props) => [numberFmt.format(Number(value || 0)), props?.payload?.name || name]} />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} fill={color} isAnimationActive animationDuration={850}>
          <LabelList
            dataKey="value"
            position="top"
            formatter={(value) => numberFmt.format(Number(value || 0))}
            style={{ fill: '#0f172a', fontSize: 12, fontWeight: 900 }}
          />
          {data.map((entry, index) => (
            <Cell key={entry.name} fill={index === 0 ? color : (index === 1 ? LIGHT_BLUE : '#0ea5e9')} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

const DedicationCard = ({ title, total, data, palette }) => {
  const cardRef = useRef(null);
  const colors = [palette.base, palette.light, '#dbeafe', '#94a3b8'];

  return (
    <Paper
      ref={cardRef}
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 330,
        position: 'relative',
        border: `1px solid ${palette.base}`,
        borderRadius: 1,
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: `0 12px 26px ${palette.base}24`
      }}
    >
      <Box sx={{ bgcolor: palette.base, px: 2.2, py: 1.15 }}>
        <Box
          sx={{
            mx: 'auto',
            maxWidth: 250,
            minHeight: 34,
            px: 2,
            border: '1px solid rgba(255,255,255,.9)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 17,
            fontWeight: 950,
            textTransform: 'uppercase',
            lineHeight: 1.1,
            textAlign: 'center',
            background: 'rgba(255,255,255,.08)'
          }}
        >
          {title}
        </Box>
      </Box>

      <Box sx={{ px: 2, pt: 1.4, pb: 1.8 }}>
        <Box sx={{ position: 'relative', height: 230, overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="60%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                label={DonutOuterLabel}
                labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                isAnimationActive
                animationDuration={900}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${numberFmt.format(Number(value || 0))} (${getPercent(value, total).toFixed(1).replace('.', ',')}%)`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Typography sx={{ color: palette.base, fontSize: 36, fontWeight: 700, lineHeight: 1 }}>
              {numberFmt.format(total)}
            </Typography>
          </Stack>
          <CopyChartBtn chartRef={cardRef} />
        </Box>
        <GenderValueLegend data={data} colors={colors} />
      </Box>
    </Paper>
  );
};

const EducationCard = ({ title, total, data, palette }) => {
  const cardRef = useRef(null);
  const colors = [palette.base, palette.light, '#dbeafe', '#94a3b8'];

  return (
    <Paper
      ref={cardRef}
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 310,
        position: 'relative',
        border: `1px solid ${palette.base}`,
        borderRadius: 1,
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: `0 12px 26px ${palette.base}22`
      }}
    >
      <Box sx={{ bgcolor: palette.base, px: 1.6, py: 1.2 }}>
        <Box
          sx={{
            mx: 'auto',
            minHeight: 34,
            maxWidth: 240,
            px: 1.6,
            border: '1px solid rgba(255,255,255,.9)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 950,
            textTransform: 'uppercase',
            textAlign: 'center',
            background: 'rgba(255,255,255,.08)'
          }}
        >
          {title}
        </Box>
      </Box>

      <Box sx={{ px: 1.4, pt: 1.2, pb: 1.6 }}>
        <Box sx={{ position: 'relative', height: 224, overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="60%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                label={DonutOuterLabel}
                labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                isAnimationActive
                animationDuration={900}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${numberFmt.format(Number(value || 0))} (${getPercent(value, total).toFixed(1).replace('.', ',')}%)`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Typography sx={{ color: palette.base, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
              {numberFmt.format(total)}
            </Typography>
          </Stack>
          <CopyChartBtn chartRef={cardRef} />
        </Box>
        <GenderValueLegend data={data} colors={colors} />
      </Box>
    </Paper>
  );
};

const EscalafonCard = ({ title, total, data, palette }) => {
  const cardRef = useRef(null);
  const colors = [palette.base, palette.light, '#dcfce7', '#94a3b8'];

  return (
    <Paper
      ref={cardRef}
      elevation={0}
      sx={{
        height: '100%',
        minHeight: 305,
        width: '100%',
        minWidth: 0,
        position: 'relative',
        border: `1px solid ${palette.base}`,
        borderRadius: 1,
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: `0 12px 26px ${palette.base}22`
      }}
    >
      <Box sx={{ bgcolor: palette.base, px: 1.6, py: 1.2 }}>
        <Box
          sx={{
            mx: 'auto',
            minHeight: 34,
            maxWidth: 220,
            px: 1.6,
            border: '1px solid rgba(255,255,255,.9)',
            borderRadius: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ffffff',
            fontSize: 16,
            fontWeight: 950,
            textTransform: 'uppercase',
            textAlign: 'center',
            background: 'rgba(255,255,255,.08)'
          }}
        >
          {title}
        </Box>
      </Box>

      <Box sx={{ px: 2, pt: 1.4, pb: 1.7 }}>
        <Box sx={{ position: 'relative', height: 224, overflow: 'visible' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius="40%"
                outerRadius="60%"
                paddingAngle={2}
                startAngle={90}
                endAngle={-270}
                label={DonutOuterLabel}
                labelLine={{ stroke: '#cbd5e1', strokeWidth: 1 }}
                isAnimationActive
                animationDuration={900}
              >
                {data.map((entry, index) => (
                  <Cell key={entry.name} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => [
                  `${numberFmt.format(Number(value || 0))} (${getPercent(value, total).toFixed(1).replace('.', ',')}%)`,
                  name
                ]}
              />
            </PieChart>
          </ResponsiveContainer>
          <Stack alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
            <Typography sx={{ color: palette.base, fontSize: 34, fontWeight: 700, lineHeight: 1 }}>
              {numberFmt.format(total)}
            </Typography>
          </Stack>
          <CopyChartBtn chartRef={cardRef} />
        </Box>
        <GenderValueLegend data={data} colors={colors} />
      </Box>
    </Paper>
  );
};

const CargoCard = ({ title, total, genderData, icon }) => {
  const cardRef = useRef(null);
  return (
    <Paper
      ref={cardRef}
      elevation={0}
      sx={{
        width: '100%',
        maxWidth: 'none',
        minHeight: 360,
        position: 'relative',
        border: `1px solid ${BORDER_BLUE}`,
        borderRadius: 1,
        overflow: 'visible',
        background: '#ffffff',
        boxShadow: '0 10px 22px rgba(31,115,232,.18)'
      }}
    >
      <Box
        sx={{
          bgcolor: BLUE,
          px: 2.2,
          py: 1.15,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px 4px 0 0'
        }}
      >
        <Stack
          direction="row"
          spacing={0.9}
          alignItems="center"
          justifyContent="center"
          sx={{
            border: '1px solid rgba(255,255,255,.9)',
            borderRadius: 999,
            minHeight: 28,
            px: 2.1,
            minWidth: 230,
            color: '#ffffff',
            background: 'rgba(255,255,255,.08)'
          }}
        >
          <Box sx={{ display: 'grid', placeItems: 'center', opacity: 0.95 }}>{icon}</Box>
          <Typography sx={{ fontSize: 14, fontWeight: 950, textTransform: 'uppercase', lineHeight: 1 }}>
            {title}
          </Typography>
        </Stack>
      </Box>
      <Box sx={{ px: 2.2, pt: 1.4, pb: 1.8, position: 'relative' }}>
        <GenderDonut data={genderData} total={total} />
        <GenderValueLegend data={genderData.filter((item) => Number(item.value || 0) > 0)} total={total} />
        <CopyChartBtn chartRef={cardRef} />
      </Box>
    </Paper>
  );
};

function RecursoHumanoDashboard({ onBack }) {
  const { enqueueSnackbar } = useSnackbar();
  const genderDonutRef = useRef(null);
  const genderBarRef = useRef(null);
  const contractBarRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getEstadisticas({
        categoria: 'Recurso Humano',
        aggregate: 'recurso_humano_dashboard'
      });
      setData(response?.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar Recurso Humano', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const docenteRows = useMemo(() => (data?.docentes?.rows || []).filter(isValidDocenteRow), [data]);

  const filterOptions = useMemo(() => {
    const rowsForPeriod = filters.anio
      ? docenteRows.filter((row) => getRowYear(row) === String(filters.anio))
      : docenteRows;

    return {
      anios: uniqueSorted(docenteRows, (row) => getRowYear(row)),
      periodos: sortPeriods(uniqueSorted(rowsForPeriod, (row) => getRowPeriodLabel(row))),
      programas: uniqueSorted(docenteRows, (row) => row.programa),
      escalafones: uniqueSorted(docenteRows, (row) => row.escalafon),
      vinculaciones: uniqueSorted(docenteRows, (row) => row.tipo_vinculacion)
    };
  }, [docenteRows, filters.anio]);

  const filteredRows = useMemo(() => docenteRows.filter((row) => {
    if (filters.anio && getRowYear(row) !== String(filters.anio)) return false;
    if (filters.periodo && getRowPeriodLabel(row) !== filters.periodo) return false;
    if (filters.programa && normalizeText(row.programa) !== filters.programa) return false;
    if (filters.escalafon && normalizeText(row.escalafon) !== filters.escalafon) return false;
    if (filters.tipoVinculacion && normalizeText(row.tipo_vinculacion) !== filters.tipoVinculacion) return false;
    return true;
  }), [docenteRows, filters]);

  const dashboardMetrics = useMemo(() => {
    const groups = new Map();

    filteredRows.forEach((row) => {
      const groupKey = normalizeCargoGroup(row);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          total: 0,
          genders: new Map()
        });
      }

      const group = groups.get(groupKey);
      const amount = rowWeight(row);
      const gender = normalizeGender(row.genero || row.genero_biologico);
      group.total += amount;
      group.genders.set(gender, (group.genders.get(gender) || 0) + amount);
    });

    const cards = Array.from(groups.values())
      .filter((group) => ['ADMINISTRATIVOS', 'PROFESORES'].includes(group.key) && group.total > 0)
      .map((group) => ({
        ...group,
        genders: ['Masculino', 'Femenino']
          .map((name) => ({ name, value: Number(group.genders.get(name) || 0) }))
          .concat(
            Array.from(group.genders.entries())
              .filter(([name]) => !['Masculino', 'Femenino'].includes(name))
              .map(([name, value]) => ({ name, value: Number(value || 0) }))
          )
      }))
      .sort((a, b) => {
        const order = { ADMINISTRATIVOS: 1, PROFESORES: 2 };
        return (order[a.key] || 9) - (order[b.key] || 9);
      });

    const withoutCargo = filteredRows.filter((row) => !normalizeText(row.cargo) && !normalizeText(row.docente)).length;

    return {
      total: filteredRows.length,
      totalWithCargo: cards.reduce((acc, item) => acc + Number(item.total || 0), 0),
      withoutCargo,
      cards
    };
  }, [filteredRows]);

  const secondaryMetrics = useMemo(() => {
    const gender = groupWeighted(filteredRows, (row) => normalizeGender(row.genero || row.genero_biologico));
    const contract = groupWeighted(filteredRows, (row) => row.contrato);
    const dedicationMap = new Map();
    const educationMap = new Map();
    const escalafonMap = new Map();

    filteredRows.forEach((row) => {
      const dedication = normalizeText(row.tipo_vinculacion) || 'Sin información';
      const education = normalizeEducationLevel(row.nivel_maximo_estudio || row.raw_data?.['NIVEL MAXIMO ESTUDIO']);
      const escalafon = normalizeEscalafon(row.escalafon);
      const genderName = normalizeGender(row.genero || row.genero_biologico);
      const amount = rowWeight(row);

      if (!dedicationMap.has(dedication)) {
        dedicationMap.set(dedication, { name: dedication, total: 0, genders: new Map() });
      }

      const group = dedicationMap.get(dedication);
      group.total += amount;
      group.genders.set(genderName, (group.genders.get(genderName) || 0) + amount);

      if (!educationMap.has(education)) {
        educationMap.set(education, { name: education, total: 0, genders: new Map() });
      }

      const educationGroup = educationMap.get(education);
      educationGroup.total += amount;
      educationGroup.genders.set(genderName, (educationGroup.genders.get(genderName) || 0) + amount);

      if (!escalafonMap.has(escalafon)) {
        escalafonMap.set(escalafon, { name: escalafon, total: 0, genders: new Map() });
      }

      const escalafonGroup = escalafonMap.get(escalafon);
      escalafonGroup.total += amount;
      escalafonGroup.genders.set(genderName, (escalafonGroup.genders.get(genderName) || 0) + amount);
    });

    const dedication = Array.from(dedicationMap.values())
      .map((group) => ({
        ...group,
        data: ['Masculino', 'Femenino']
          .map((name) => ({ name, value: Number(group.genders.get(name) || 0) }))
          .filter((item) => item.value > 0)
      }))
      .filter((group) => group.total > 0 && group.data.length > 0)
      .sort((a, b) => b.total - a.total);

    const educationOrder = { PROFESIONAL: 1, ESPECIALISTA: 2, MAGISTER: 3, DOCTOR: 4 };
    const education = Array.from(educationMap.values())
      .map((group) => ({
        ...group,
        data: ['Masculino', 'Femenino']
          .map((name) => ({ name, value: Number(group.genders.get(name) || 0) }))
          .filter((item) => item.value > 0)
      }))
      .filter((group) => group.total > 0 && group.data.length > 0 && group.name !== 'Sin información')
      .sort((a, b) => (educationOrder[a.name] || 99) - (educationOrder[b.name] || 99) || b.total - a.total);

    const escalafonOrder = { 'BÁSICO': 1, AUXILIAR: 2, ASISTENTE: 3, ASOCIADO: 4, TITULAR: 5 };
    const escalafon = Array.from(escalafonMap.values())
      .map((group) => ({
        ...group,
        data: ['Masculino', 'Femenino']
          .map((name) => ({ name, value: Number(group.genders.get(name) || 0) }))
          .filter((item) => item.value > 0)
      }))
      .filter((group) => group.total > 0 && group.data.length > 0 && group.name !== 'Sin información')
      .sort((a, b) => (escalafonOrder[a.name] || 99) - (escalafonOrder[b.name] || 99) || b.total - a.total);

    return {
      gender,
      contract,
      dedication,
      education,
      escalafon,
      genderTotal: gender.reduce((acc, item) => acc + Number(item.value || 0), 0)
    };
  }, [filteredRows]);

  const titleLabel = filters.periodo || filters.anio || filterOptions.periodos[0] || latestValue(filterOptions.anios);

  const hasFilters = Object.values(filters).some(Boolean);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      ...(key === 'anio' ? { periodo: '' } : {})
    }));
  };

  const renderSelectFilter = (key, label, values) => (
    <FormControl size="small" fullWidth sx={{ minWidth: 190 }}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={filters[key]}
        label={label}
        onChange={(event) => handleFilterChange(key, event.target.value)}
        sx={{
          bgcolor: '#ffffff',
          borderRadius: 1.4,
          '& .MuiSelect-select': {
            fontWeight: 700,
            color: '#334155'
          }
        }}
      >
        <MenuItem value="">Todos</MenuItem>
        {values.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
      </Select>
    </FormControl>
  );

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #dbeafe', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1, color: TEXT_BLUE }}>Cargando dashboard de Recurso Humano...</Typography>
        <LinearProgress sx={{ borderRadius: 999 }} />
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px dashed #bfdbfe', borderRadius: 2 }}>
        <Typography sx={{ color: '#475569' }}>No fue posible cargar el dashboard de Recurso Humano.</Typography>
      </Paper>
    );
  }

  return (
    <Fade in timeout={350}>
      <Box sx={{ background: '#f0f6ff', minHeight: 'calc(100vh - 210px)', pb: 4 }}>

        {/* ── COVER ENCABEZADO ── */}
        <Box
          sx={{
            mb: 2,
            borderRadius: { xs: 2.5, md: 3.5 },
            overflow: 'hidden',
            position: 'relative',
            background: 'linear-gradient(130deg, #0d47a1 0%, #1565c0 22%, #1976d2 48%, #1e88e5 72%, #42a5f5 100%)',
            boxShadow: '0 18px 52px rgba(13,71,161,.32)'
          }}
        >
          {/* Orbes decorativos */}
          <Box sx={{ position: 'absolute', top: -60, right: -60, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,.07)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -40, left: 100, width: 180, height: 180, borderRadius: '50%', background: 'rgba(255,255,255,.05)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', top: '25%', right: '20%', width: 90, height: 90, borderRadius: '50%', background: 'rgba(255,255,255,.04)', pointerEvents: 'none' }} />

          <Box sx={{ px: { xs: 2.5, md: 4.5 }, py: { xs: 2.2, md: 2.8 }, position: 'relative', zIndex: 1 }}>
            {onBack && (
              <Box
                component="button"
                onClick={onBack}
                sx={{
                  mb: 1.8,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 0.7,
                  px: 1.4,
                  py: 0.55,
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,.32)',
                  background: 'rgba(255,255,255,.12)',
                  color: 'rgba(255,255,255,.88)',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.01em',
                  cursor: 'pointer',
                  transition: 'background .15s',
                  '&:hover': { background: 'rgba(255,255,255,.22)' }
                }}
              >
                ← Recurso Humano
              </Box>
            )}
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={{ xs: 2, sm: 3 }}
              alignItems={{ xs: 'flex-start', sm: 'center' }}
              justifyContent="space-between"
            >
              {/* Branding izquierdo */}
              <Stack direction="row" spacing={2.4} alignItems="center">
                <Box
                  sx={{
                    width: { xs: 58, md: 72 },
                    height: { xs: 58, md: 72 },
                    borderRadius: 2.5,
                    background: 'rgba(255,255,255,.17)',
                    border: '1.5px solid rgba(255,255,255,.36)',
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                    boxShadow: '0 8px 24px rgba(0,0,0,.16)'
                  }}
                >
                  <SchoolIcon sx={{ color: '#fff', fontSize: { xs: 30, md: 38 } }} />
                </Box>

                <Box>
                  <Typography
                    sx={{
                      fontSize: 10.5,
                      fontWeight: 900,
                      color: 'rgba(255,255,255,.7)',
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      mb: 0.2
                    }}
                  >
                    Gestión de la Información
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: 22, md: 30 },
                      fontWeight: 900,
                      color: '#ffffff',
                      lineHeight: 1.05,
                      letterSpacing: '-0.025em'
                    }}
                  >
                    Estadística de Profesores
                  </Typography>
                  <Typography
                    sx={{
                      fontSize: { xs: 13, md: 15.5 },
                      fontWeight: 800,
                      color: 'rgba(255,255,255,.8)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                      mt: 0.3
                    }}
                  >
                    UNICESMAG
                  </Typography>
                </Box>
              </Stack>

              {/* Badge período activo */}
              <Box
                sx={{
                  px: { xs: 2.5, md: 3.4 },
                  py: { xs: 1.2, md: 1.8 },
                  borderRadius: 3,
                  background: 'rgba(255,255,255,.14)',
                  border: '1.5px solid rgba(255,255,255,.28)',
                  backdropFilter: 'blur(14px)',
                  textAlign: 'center',
                  minWidth: { xs: 120, md: 148 },
                  alignSelf: { xs: 'flex-start', sm: 'center' },
                  flexShrink: 0
                }}
              >
                <Typography
                  sx={{
                    fontSize: 10,
                    fontWeight: 900,
                    color: 'rgba(255,255,255,.64)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.14em',
                    mb: 0.2
                  }}
                >
                  Período activo
                </Typography>
                <Typography
                  sx={{
                    fontSize: { xs: 30, md: 38 },
                    fontWeight: 900,
                    color: '#ffffff',
                    lineHeight: 1.08,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {titleLabel || '—'}
                </Typography>
              </Box>
            </Stack>
          </Box>
        </Box>

        {/* ── PANEL DE FILTROS ── */}
        <Paper
          elevation={0}
          sx={{
            mb: 2.5,
            border: '1px solid #c5d9f7',
            borderRadius: 2.5,
            background: 'linear-gradient(180deg, #ffffff 0%, #f5f9ff 100%)',
            overflow: 'hidden',
            boxShadow: '0 4px 16px rgba(21,101,216,.07)'
          }}
        >
          <Box
            sx={{
              px: { xs: 1.8, md: 2.4 },
              py: 1,
              borderBottom: '1px solid #dbeafe',
              background: 'linear-gradient(90deg, #e8f0fe 0%, #f0f6ff 100%)',
              display: 'flex',
              alignItems: 'center',
              gap: 1
            }}
          >
            <Box
              sx={{
                width: 6, height: 6, borderRadius: '50%', bgcolor: BLUE, flexShrink: 0
              }}
            />
            <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: TEXT_BLUE, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Filtros de consulta
            </Typography>
            <Box sx={{ flex: 1 }} />
            <Chip
              size="small"
              label={`${numberFmt.format(filteredRows.length)} registros`}
              sx={{ bgcolor: '#dbeafe', color: TEXT_BLUE, fontWeight: 800, fontSize: 11, height: 22 }}
            />
          </Box>

          <Box sx={{ px: { xs: 1.6, md: 2.2 }, pt: 1.6, pb: 1.4 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: '1.1fr 1fr 1.7fr 1.25fr 1.45fr 48px'
                },
                gap: 1.2,
                alignItems: 'center'
              }}
            >
              {renderSelectFilter('anio', 'Año', filterOptions.anios)}
              {renderSelectFilter('periodo', 'Periodo', filterOptions.periodos)}
              {renderSelectFilter('programa', 'Programa', filterOptions.programas)}
              {renderSelectFilter('escalafon', 'Escalafón', filterOptions.escalafones)}
              {renderSelectFilter('tipoVinculacion', 'Tipo de vinculación', filterOptions.vinculaciones)}
              <Button
                variant="outlined"
                title="Limpiar filtros"
                onClick={() => setFilters(emptyFilters)}
                disabled={!hasFilters}
                sx={{ minWidth: 44, height: 40, px: 0, bgcolor: '#ffffff', borderRadius: 1.4, borderColor: '#c5d9f7', color: TEXT_BLUE }}
              >
                <FilterAltOffIcon fontSize="small" />
              </Button>
            </Box>

            <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.4, flexWrap: 'wrap' }}>
              <Chip size="small" label={`Filtrados: ${numberFmt.format(filteredRows.length)}`} sx={{ bgcolor: '#eff6ff', color: TEXT_BLUE, fontWeight: 800, border: '1px solid #bfdbfe' }} />
              <Chip size="small" variant="outlined" label={`Total BD: ${numberFmt.format(dashboardMetrics.total)}`} sx={{ fontWeight: 800, borderColor: BLUE, color: BLUE }} />
              {dashboardMetrics.withoutCargo > 0 ? (
                <Chip
                  size="small"
                  variant="outlined"
                  sx={{ borderColor: '#f59e0b', color: '#92400e', bgcolor: '#fffbeb', fontWeight: 800 }}
                  label={`Sin cargo: ${numberFmt.format(dashboardMetrics.withoutCargo)}`}
                />
              ) : null}
              <Button size="small" startIcon={<RefreshIcon />} onClick={fetchDashboard} sx={{ ml: 'auto', color: TEXT_BLUE }}>Actualizar</Button>
            </Stack>
          </Box>
        </Paper>

        {dashboardMetrics.cards.length === 0 ? (
          <Paper elevation={0} sx={{ p: 3, border: '1px dashed #bfdbfe', borderRadius: 2, textAlign: 'center' }}>
            <Typography sx={{ color: '#475569', fontWeight: 700 }}>
              No hay registros con cargo Administrativo o Docente para los filtros seleccionados.
            </Typography>
          </Paper>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(320px, 1fr) minmax(260px, .72fr) minmax(320px, 1fr)' },
              gap: { xs: 2, lg: 3.2 },
              alignItems: 'stretch',
              minHeight: { xs: 480, lg: 'calc(100vh - 440px)' },
              pt: { xs: 1, lg: 1 },
              px: { xs: 0, lg: 2.5 }
            }}
          >
            <Box>
              {dashboardMetrics.cards.find((item) => item.key === 'ADMINISTRATIVOS') ? (
                <Stack alignItems="stretch" sx={{ height: '100%' }}>
                  <CargoCard
                    title="Administrativos"
                    total={dashboardMetrics.cards.find((item) => item.key === 'ADMINISTRATIVOS').total}
                    genderData={dashboardMetrics.cards.find((item) => item.key === 'ADMINISTRATIVOS').genders}
                    icon={<WorkIcon fontSize="small" />}
                  />
                </Stack>
              ) : null}
            </Box>

            <Box>
              <Paper
                elevation={0}
                sx={{
                  height: '100%',
                  minHeight: 360,
                  border: `1px solid ${BORDER_BLUE}`,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, #ffffff 0%, #ffffff 48%, #f3f7ff 100%)',
                  boxShadow: '0 0 34px rgba(31,115,232,.18)'
                }}
              >
                <Stack alignItems="center" spacing={0.5}>
                  <Box
                    sx={{
                      width: 54,
                      height: 54,
                      borderRadius: '50%',
                      display: 'grid',
                      placeItems: 'center',
                      color: '#ffffff',
                      background: `linear-gradient(135deg, ${BLUE}, #1557c7)`,
                      boxShadow: '0 10px 22px rgba(31,115,232,.2)'
                    }}
                  >
                    <GroupsIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 900, textTransform: 'uppercase', mt: 1 }}>
                    Total consolidado
                  </Typography>
                  <Typography sx={{ color: BLUE, fontSize: { xs: 62, md: 82 }, fontWeight: 500, lineHeight: 1 }}>
                    {numberFmt.format(dashboardMetrics.total)}
                  </Typography>

                  {dashboardMetrics.withoutCargo > 0 ? (
                    <Chip
                      size="small"
                      sx={{ mt: 1.1, borderColor: '#f59e0b', color: '#92400e', bgcolor: '#fffbeb', fontWeight: 900 }}
                      variant="outlined"
                      label={`Sin cargo: ${numberFmt.format(dashboardMetrics.withoutCargo)}`}
                    />
                  ) : null}
                </Stack>
              </Paper>
            </Box>

            <Box>
              {dashboardMetrics.cards.find((item) => item.key === 'PROFESORES') ? (
                <Stack alignItems="stretch" sx={{ height: '100%' }}>
                  <CargoCard
                    title="Profesores"
                    total={dashboardMetrics.cards.find((item) => item.key === 'PROFESORES').total}
                    genderData={dashboardMetrics.cards.find((item) => item.key === 'PROFESORES').genders}
                    icon={<SchoolIcon fontSize="small" />}
                  />
                </Stack>
              ) : null}
            </Box>
          </Box>
        )}

        {filteredRows.length > 0 ? (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.8 }}>
              <Box sx={{ width: 4, height: 26, borderRadius: 999, bgcolor: BLUE, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Género biológico y tipo contrato
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: '#dbeafe', borderRadius: 999 }} />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr 1fr' },
                gap: { xs: 2, lg: 2.2 },
                alignItems: 'stretch'
              }}
            >
              <AnalyticCard
                title="Género biológico"
                icon={<GroupsIcon sx={{ fontSize: 19 }} />}
                height={350}
                chartRef={genderDonutRef}
              >
                <ProfessionalDonut data={secondaryMetrics.gender} total={secondaryMetrics.genderTotal} />
              </AnalyticCard>

              <AnalyticCard
                title="Género biológico"
                icon={<FemaleIcon sx={{ fontSize: 19 }} />}
                height={350}
                chartRef={genderBarRef}
              >
                <ProfessionalBarChart data={secondaryMetrics.gender} color={BLUE} xLabel="Género biológico" />
              </AnalyticCard>

              <AnalyticCard
                title="Tipo contrato"
                icon={<WorkIcon sx={{ fontSize: 19 }} />}
                height={350}
                chartRef={contractBarRef}
              >
                <ProfessionalBarChart data={secondaryMetrics.contract} color={BLUE} xLabel="Contrato" />
              </AnalyticCard>
            </Box>
          </Box>
        ) : null}

        {secondaryMetrics.dedication.length > 0 ? (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.8 }}>
              <Box sx={{ width: 4, height: 26, borderRadius: 999, bgcolor: BLUE, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Dedicación
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: '#dbeafe', borderRadius: 999 }} />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  md: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(3, minmax(0, 1fr))'
                },
                gap: { xs: 2, lg: 2.4 },
                alignItems: 'stretch'
              }}
            >
              {secondaryMetrics.dedication.map((item, index) => (
                <DedicationCard
                  key={item.name}
                  title={item.name}
                  total={item.total}
                  data={item.data}
                  palette={dedicationPalette[index % dedicationPalette.length]}
                />
              ))}
            </Box>
          </Box>
        ) : null}

        {secondaryMetrics.education.length > 0 ? (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.8 }}>
              <Box sx={{ width: 4, height: 26, borderRadius: 999, bgcolor: BLUE, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Nivel de formación profesores UNICESMAG
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: '#dbeafe', borderRadius: 999 }} />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(285px, 1fr))',
                  xl: 'repeat(4, minmax(285px, 1fr))'
                },
                gap: { xs: 2, lg: 2.2 },
                alignItems: 'stretch',
                overflowX: 'auto',
                pb: 1.2,
                px: { xs: 0.5, md: 1 }
              }}
            >
              {secondaryMetrics.education.map((item, index) => (
                <EducationCard
                  key={item.name}
                  title={item.name}
                  total={item.total}
                  data={item.data}
                  palette={educationPalette[index % educationPalette.length]}
                />
              ))}
            </Box>
          </Box>
        ) : null}

        {secondaryMetrics.escalafon.length > 0 ? (
          <Box sx={{ mt: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1.4} sx={{ mb: 1.8 }}>
              <Box sx={{ width: 4, height: 26, borderRadius: 999, bgcolor: '#27ae60', flexShrink: 0 }} />
              <Typography sx={{ fontSize: 14.5, fontWeight: 900, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Escalafón
              </Typography>
              <Box sx={{ flex: 1, height: 1, bgcolor: '#bbf7d0', borderRadius: 999 }} />
            </Stack>

            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: '1fr',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  xl: 'repeat(4, minmax(0, 1fr))'
                },
                gap: { xs: 2, lg: 2.4 },
                alignItems: 'stretch',
                width: '100%',
                px: { xs: 0.5, md: 1.5 },
                pb: 1.2
              }}
            >
              {secondaryMetrics.escalafon.map((item, index) => (
                <EscalafonCard
                  key={item.name}
                  title={item.name}
                  total={item.total}
                  data={item.data}
                  palette={rankPalette[index % rankPalette.length]}
                />
              ))}
            </Box>
          </Box>
        ) : null}
      </Box>
    </Fade>
  );
}

export default RecursoHumanoDashboard;
