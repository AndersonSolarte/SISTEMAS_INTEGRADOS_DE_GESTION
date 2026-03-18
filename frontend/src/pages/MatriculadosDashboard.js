import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Stack, Typography, Paper, Grid, Chip, CircularProgress,
  IconButton, Tooltip, ToggleButtonGroup, ToggleButton, Divider,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TableSortLabel, Skeleton, Alert
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon from '@mui/icons-material/TrendingDownRounded';
import AutoGraphRoundedIcon from '@mui/icons-material/AutoGraphRounded';
import FilterAltRoundedIcon from '@mui/icons-material/FilterAltRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import FlightTakeoffRoundedIcon from '@mui/icons-material/FlightTakeoffRounded';
import MapRoundedIcon from '@mui/icons-material/MapRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import WcRoundedIcon from '@mui/icons-material/WcRounded';
import FlagRoundedIcon from '@mui/icons-material/FlagRounded';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as ReTooltip,
  BarChart, Bar, PieChart, Pie, Cell, LabelList, Legend
} from 'recharts';
import gestionInformacionService from '../services/gestionInformacionService';

// ── helpers ────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('es-CO');
const fmtPct = (n) => `${Number(n || 0).toFixed(1)}%`;

const BRAND_COLORS = ['#1d4ed8', '#7c3aed', '#0f766e', '#d97706', '#be123c', '#0e7490', '#4338ca', '#065f46'];

const NIVEL_LABEL = {
  PROFESIONAL: 'Profesional',
  TECNOLOGICO: 'Tecnológico',
  ESPECIALIZACION: 'Especialización',
  MAESTRIA: 'Maestría'
};

const NIVEL_COLOR = {
  PROFESIONAL: '#1d4ed8',
  TECNOLOGICO: '#0f766e',
  ESPECIALIZACION: '#7c3aed',
  MAESTRIA: '#d97706'
};

const SEXO_COLOR = { 'FEMENINO': '#be185d', 'MASCULINO': '#1d4ed8', 'OTRO': '#6b7280' };

// ── Country flag helper ─────────────────────────────────────────────────────
const COUNTRY_ISO2 = {
  'COLOMBIA': 'CO', 'ECUADOR': 'EC', 'VENEZUELA': 'VE',
  'VENEZUELA (REPUBLICA BOLIVARIANA DE)': 'VE', 'VENEZUELA (REPÚBLICA BOLIVARIANA DE)': 'VE',
  'ESPANA': 'ES', 'ESPAÑA': 'ES', 'MEXICO': 'MX', 'MÉXICO': 'MX',
  'PANAMA': 'PA', 'PANAMÁ': 'PA', 'ESTADOS UNIDOS': 'US',
  'ESTADOS UNIDOS DE AMERICA': 'US', 'ESTADOS UNIDOS DE AMÉRICA': 'US', 'USA': 'US',
  'NORUEGA': 'NO', 'ARGENTINA': 'AR', 'BRASIL': 'BR', 'BRAZIL': 'BR',
  'CHILE': 'CL', 'PERU': 'PE', 'PERÚ': 'PE', 'BOLIVIA': 'BO',
  'PARAGUAY': 'PY', 'URUGUAY': 'UY', 'CUBA': 'CU', 'COSTA RICA': 'CR',
  'GUATEMALA': 'GT', 'HONDURAS': 'HN', 'EL SALVADOR': 'SV', 'NICARAGUA': 'NI',
  'REPUBLICA DOMINICANA': 'DO', 'REPÚBLICA DOMINICANA': 'DO',
  'HAITI': 'HT', 'HAITÍ': 'HT', 'JAMAICA': 'JM', 'TRINIDAD Y TOBAGO': 'TT',
  'CANADA': 'CA', 'CANADÁ': 'CA', 'ALEMANIA': 'DE', 'FRANCIA': 'FR',
  'ITALIA': 'IT', 'REINO UNIDO': 'GB', 'PORTUGAL': 'PT', 'SUIZA': 'CH',
  'SUECIA': 'SE', 'HOLANDA': 'NL', 'PAISES BAJOS': 'NL', 'PAÍSES BAJOS': 'NL',
  'BELGICA': 'BE', 'BÉLGICA': 'BE', 'AUSTRIA': 'AT', 'FINLANDIA': 'FI',
  'DINAMARCA': 'DK', 'ISLANDIA': 'IS', 'IRLANDA': 'IE', 'GRECIA': 'GR',
  'JAPON': 'JP', 'JAPÓN': 'JP', 'CHINA': 'CN', 'COREA DEL SUR': 'KR',
  'AUSTRALIA': 'AU', 'NUEVA ZELANDA': 'NZ', 'RUSIA': 'RU', 'TURQUIA': 'TR',
  'TURQUÍA': 'TR', 'ISRAEL': 'IL', 'INDIA': 'IN', 'PAKISTAN': 'PK',
  'PUERTO RICO': 'PR', 'BELICE': 'BZ', 'GUYANA': 'GY', 'SURINAM': 'SR',
  'HAITI': 'HT', 'ANTILLAS HOLANDESAS': 'AN',
};

const getCountryFlag = (name) => {
  const n = String(name || '').toUpperCase().trim();
  let iso2 = COUNTRY_ISO2[n];
  if (!iso2) {
    for (const [key, code] of Object.entries(COUNTRY_ISO2)) {
      const base = n.split('(')[0].trim();
      if (n.startsWith(key) || key === base || base.startsWith(key)) {
        iso2 = code; break;
      }
    }
  }
  if (!iso2) return null;
  return iso2.toUpperCase().split('').map((c) => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
};

// ── SVG Colombia map helpers
const projectLonLatToSvg = ({ lon, lat, bbox, width = 800, height = 600, padding = 16 }) => {
  const usableW = width - padding * 2;
  const usableH = height - padding * 2;
  const lonRange = bbox.maxLon - bbox.minLon || 1;
  const latRange = bbox.maxLat - bbox.minLat || 1;
  const scale = Math.min(usableW / lonRange, usableH / latRange);
  const offX = padding + (usableW - lonRange * scale) / 2;
  const offY = padding + (usableH - latRange * scale) / 2;
  const x = offX + (lon - bbox.minLon) * scale;
  const y = offY + (bbox.maxLat - lat) * scale;
  return { x, y };
};

const buildSvgPath = (rings = [], bbox, w = 800, h = 600) => {
  if (!rings.length) return '';
  return rings.map((ring) => {
    const pts = ring.map((coord) => {
      const { x, y } = projectLonLatToSvg({ lon: coord[0], lat: coord[1], bbox, width: w, height: h, padding: 16 });
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    });
    return `M ${pts.join(' L ')} Z`;
  }).join(' ');
};

const getPrimaryRing = (rings = []) => rings.reduce((a, b) => (b.length > a.length ? b : a), rings[0] || []);

const computeRingCentroid = (ring = []) => {
  if (ring.length < 3) return null;
  let areaAccumulator = 0;
  let lonAccumulator = 0;
  let latAccumulator = 0;

  for (let i = 0; i < ring.length; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[(i + 1) % ring.length];
    const cross = (x1 * y2) - (x2 * y1);
    areaAccumulator += cross;
    lonAccumulator += (x1 + x2) * cross;
    latAccumulator += (y1 + y2) * cross;
  }

  const area = areaAccumulator / 2;
  if (!area) return null;

  return {
    lon: lonAccumulator / (6 * area),
    lat: latAccumulator / (6 * area)
  };
};

const isPointInsideRing = (point, ring = []) => {
  if (!point || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects = ((yi > point.lat) !== (yj > point.lat))
      && (point.lon < (((xj - xi) * (point.lat - yi)) / ((yj - yi) || 1e-9)) + xi);
    if (intersects) inside = !inside;
  }
  return inside;
};

const computeCentroid = (rings) => {
  const ring = getPrimaryRing(rings);
  if (!ring.length) return null;
  const polygonCentroid = computeRingCentroid(ring);
  if (polygonCentroid && isPointInsideRing(polygonCentroid, ring)) return polygonCentroid;

  let sumLon = 0;
  let sumLat = 0;
  ring.forEach(([lon, lat]) => {
    sumLon += lon;
    sumLat += lat;
  });
  return { lon: sumLon / ring.length, lat: sumLat / ring.length };
};

// Estimate the minimum bounding dimension of a polygon in SVG space (for label visibility)
const computeSvgBboxSize = (rings, bbox, w = 800, h = 600) => {
  if (!rings.length || !rings[0].length || !bbox) return 0;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  rings.forEach((ring) => ring.forEach(([lon, lat]) => {
    const { x, y } = projectLonLatToSvg({ lon, lat, bbox, width: w, height: h, padding: 16 });
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  }));
  if (!isFinite(minX)) return 0;
  return Math.min(maxX - minX, maxY - minY);
};

const estimateLabelBox = (name = '', value = 0, variant = 'department') => {
  const safeName = String(name || '');
  const safeValue = String(value || 0);
  const labelText = `${safeName} (${safeValue})`;
  const baseWidth = variant === 'department' ? 86 : 68;
  const charWidth = variant === 'department' ? 6.7 : 5.8;
  const width = Math.min(
    variant === 'department' ? 220 : 180,
    Math.max(baseWidth, Math.round((labelText.length * charWidth) + 22))
  );
  const height = variant === 'department' ? 26 : 24;
  return { width, height };
};

const intersectsRect = (a, b) => !(
  a.x + a.width <= b.x
  || b.x + b.width <= a.x
  || a.y + a.height <= b.y
  || b.y + b.height <= a.y
);

const clampRectToBounds = (rect, bounds) => ({
  ...rect,
  x: Math.min(Math.max(rect.x, bounds.minX), bounds.maxX - rect.width),
  y: Math.min(Math.max(rect.y, bounds.minY), bounds.maxY - rect.height)
});

const buildLabelLayout = ({
  features = [],
  bbox,
  width = 800,
  height = 600,
  variant = 'department',
  getData,
  minFeatureSize = 0
}) => {
  if (!bbox || !features.length || typeof getData !== 'function') return [];

  const bounds = { minX: 8, minY: 8, maxX: width - 8, maxY: height - 8 };
  const offsetCandidates = [
    { x: 0, y: 0 },
    { x: 0, y: -28 },
    { x: 0, y: 28 },
    { x: -44, y: 0 },
    { x: 44, y: 0 },
    { x: -34, y: -24 },
    { x: 34, y: -24 },
    { x: -34, y: 24 },
    { x: 34, y: 24 },
    { x: 0, y: -44 },
    { x: 0, y: 44 }
  ];

  const ranked = features.map((feature, index) => {
    const data = getData(feature);
    if (!data || !Number(data.total || 0)) return null;
    const featureSize = computeSvgBboxSize(feature.rings, bbox, width, height);
    if (featureSize < minFeatureSize) return null;
    const centroid = computeCentroid(feature.rings);
    if (!centroid) return null;
    const point = projectLonLatToSvg({ lon: centroid.lon, lat: centroid.lat, bbox, width, height, padding: 16 });
    return {
      feature,
      data,
      point,
      featureSize,
      priority: Number(data.total || 0),
      index
    };
  }).filter(Boolean).sort((a, b) => b.priority - a.priority || b.featureSize - a.featureSize || a.index - b.index);

  const placed = [];

  ranked.forEach((item) => {
    const box = estimateLabelBox(item.data.label, item.data.total, variant);
    let chosenRect = null;
    let chosenOffset = offsetCandidates[0];

    for (let i = 0; i < offsetCandidates.length; i += 1) {
      const offset = offsetCandidates[i];
      const candidate = clampRectToBounds({
        x: item.point.x - (box.width / 2) + offset.x,
        y: item.point.y - box.height - 10 + offset.y,
        width: box.width,
        height: box.height
      }, bounds);

      if (!placed.some((existing) => intersectsRect(candidate, existing.rect))) {
        chosenRect = candidate;
        chosenOffset = offset;
        break;
      }
    }

    if (!chosenRect) {
      if (variant === 'municipality' && item.priority < ranked[0]?.priority * 0.12) return;
      chosenRect = clampRectToBounds({
        x: item.point.x - (box.width / 2),
        y: item.point.y - box.height - 10,
        width: box.width,
        height: box.height
      }, bounds);
      if (placed.some((existing) => intersectsRect(chosenRect, existing.rect))) return;
    }

    placed.push({
      key: `${variant}-${item.data.label}-${item.index}`,
      label: item.data.label,
      value: item.data.total,
      rect: chosenRect,
      anchorX: item.point.x,
      anchorY: item.point.y,
      offsetX: chosenOffset.x,
      offsetY: chosenOffset.y
    });
  });

  return placed;
};

function MapDataLabel({ label, value, rect, anchorX, anchorY, variant = 'department', accent = '#1e3a8a' }) {
  const compact = variant === 'municipality';
  const labelText = `${label} (${fmt(value)})`;
  const textX = rect.x + (rect.width / 2);
  const textY = rect.y + (compact ? 14 : 16);
  const cardRadius = compact ? 9 : 11;
  return (
    <g pointerEvents="none">
      <line
        x1={textX}
        y1={rect.y + rect.height}
        x2={anchorX}
        y2={anchorY - 4}
        stroke="rgba(220, 38, 38, 0.65)"
        strokeWidth={compact ? 1.2 : 1.35}
      />
      <rect
        x={rect.x}
        y={rect.y}
        width={rect.width}
        height={rect.height}
        rx={cardRadius}
        fill={compact ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.96)'}
        stroke={accent}
        strokeWidth={compact ? 1.2 : 1.4}
      />
      <text
        x={textX}
        y={textY}
        textAnchor="middle"
        fontSize={compact ? 10 : 11.5}
        fontWeight="800"
        fill={accent}
        style={{ paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.95)', strokeWidth: 2 }}
      >
        {labelText}
      </text>
      <circle cx={anchorX} cy={anchorY} r={compact ? 3.2 : 3.8} fill="#ef4444" stroke="#ffffff" strokeWidth="1.6" />
      <path d={`M ${anchorX - 2.6} ${anchorY + 2.4} L ${anchorX + 2.6} ${anchorY + 2.4} L ${anchorX} ${anchorY + 8.5} Z`} fill="#ef4444" />
    </g>
  );
}

// ── KPI Card component ──────────────────────────────────────────────────────
function KpiCard({ label, value, sub, icon: Icon, color = '#1d4ed8', delta, loading }) {
  return (
    <Paper elevation={0} sx={{
      p: { xs: 1.8, md: 2.2 },
      border: '1px solid',
      borderColor: `${color}22`,
      borderRadius: 3,
      background: `linear-gradient(135deg, #fff 60%, ${color}09 100%)`,
      boxShadow: `0 4px 20px -8px ${color}33`,
      position: 'relative',
      overflow: 'hidden',
      minHeight: 110,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'space-between'
    }}>
      <Box sx={{
        position: 'absolute', top: 12, right: 12,
        width: 40, height: 40, borderRadius: '50%',
        bgcolor: `${color}14`,
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        <Icon sx={{ fontSize: 21, color }} />
      </Box>
      <Box>
        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          {label}
        </Typography>
        {loading ? (
          <Skeleton width={80} height={36} sx={{ mt: 0.5 }} />
        ) : (
          <Typography sx={{ fontSize: { xs: 24, md: 28 }, fontWeight: 900, color: '#1e293b', lineHeight: 1.1, mt: 0.3 }}>
            {value}
          </Typography>
        )}
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
        {delta !== undefined && !loading && (
          <Chip
            size="small"
            icon={delta >= 0 ? <TrendingUpRoundedIcon sx={{ fontSize: '13px !important' }} /> : <TrendingDownRoundedIcon sx={{ fontSize: '13px !important' }} />}
            label={`${delta >= 0 ? '+' : ''}${fmtPct(delta)}`}
            sx={{
              height: 20, fontSize: 11, fontWeight: 700,
              bgcolor: delta >= 0 ? '#dcfce7' : '#fee2e2',
              color: delta >= 0 ? '#15803d' : '#dc2626',
              '& .MuiChip-icon': { color: 'inherit' }
            }}
          />
        )}
        {sub && !loading && (
          <Typography sx={{ fontSize: 11.5, color: '#94a3b8', fontWeight: 500 }}>{sub}</Typography>
        )}
      </Stack>
    </Paper>
  );
}

// ── Chart card wrapper ──────────────────────────────────────────────────────
function ChartCard({ title, subtitle, children, loading, action, minH = 260 }) {
  return (
    <Paper elevation={0} sx={{
      border: '1px solid #e2e8f0',
      borderRadius: 3,
      overflow: 'hidden',
      boxShadow: '0 2px 12px -4px rgba(0,0,0,0.08)'
    }}>
      <Box sx={{ px: 2.5, pt: 2, pb: 1.2, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{title}</Typography>
          {subtitle && <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.1 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <Box sx={{ p: 2, minHeight: minH, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {loading ? (
          <Stack spacing={1}>
            <Skeleton variant="rectangular" height={minH - 32} sx={{ borderRadius: 2 }} />
          </Stack>
        ) : children}
      </Box>
    </Paper>
  );
}

// ── Custom recharts tooltip ─────────────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={4} sx={{ p: 1.4, borderRadius: 2, border: '1px solid #e2e8f0', minWidth: 130 }}>
      <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#1e293b', mb: 0.6 }}>{label}</Typography>
      {payload.map((item, i) => (
        <Stack key={i} direction="row" spacing={0.8} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: item.color }} />
          <Typography sx={{ fontSize: 12, color: '#475569' }}>{item.name}: <strong>{fmt(item.value)}</strong></Typography>
        </Stack>
      ))}
    </Paper>
  );
};

// ── International Students Panel ────────────────────────────────────────────
function InternationalStudentsPanel({ countries, total, loading }) {
  const [expandedCountry, setExpandedCountry] = useState(null);
  const [expandedProgram, setExpandedProgram] = useState(null);

  const intlCountries = useMemo(
    () => (countries || []).filter((c) => c.name !== 'COLOMBIA').sort((a, b) => b.total - a.total),
    [countries]
  );
  const intlTotal = intlCountries.reduce((s, c) => s + c.total, 0);
  const maxCount = intlCountries[0]?.total || 1;

  if (!loading && intlCountries.length === 0) return null;

  const toggleCountry = (name) => {
    setExpandedCountry((prev) => (prev === name ? null : name));
    setExpandedProgram(null);
  };
  const toggleProgram = (key) => setExpandedProgram((prev) => (prev === key ? null : key));

  return (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', boxShadow: '0 4px 24px -8px rgba(146,64,14,0.18)', mb: 2 }}>
      {/* Header */}
      <Box sx={{
        background: 'linear-gradient(135deg, #78350f 0%, #92400e 45%, #b45309 80%, #d97706 100%)',
        px: 2.5, py: 1.8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Stack direction="row" spacing={1.4} alignItems="center">
          <Box sx={{ bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 2, p: 0.7, display: 'flex', alignItems: 'center' }}>
            <PublicRoundedIcon sx={{ fontSize: 22, color: '#fff' }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: 15, color: '#fff', letterSpacing: '-0.01em' }}>
              Matrícula Internacional
            </Typography>
            <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.72)' }}>
              {intlCountries.length} {intlCountries.length === 1 ? 'país' : 'países'} · {fmt(intlTotal)} estudiantes
            </Typography>
          </Box>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={`${total ? ((intlTotal / total) * 100).toFixed(1) : 0}% del total`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: '#fff', fontWeight: 700, fontSize: 11.5, height: 24 }}
          />
          <Chip
            label={`${fmt(intlTotal)} matric.`}
            size="small"
            sx={{ bgcolor: 'rgba(0,0,0,0.18)', color: 'rgba(255,255,255,0.9)', fontWeight: 700, fontSize: 11.5, height: 24 }}
          />
        </Stack>
      </Box>

      {/* Column headers */}
      <Box sx={{ px: 2.5, py: 1, bgcolor: '#fffbeb', borderBottom: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: 1.5 }}>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 18 }}>#</Typography>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 32 }}>Bandera</Typography>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>País</Typography>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 100 }}>Proporción</Typography>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 28, textAlign: 'right' }}>Total</Typography>
        <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 50 }}>(%)</Typography>
        <Box sx={{ width: 28 }} />
      </Box>

      {/* Country rows */}
      {loading ? (
        <Box sx={{ p: 2 }}>
          {[...Array(5)].map((_, i) => <Skeleton key={i} height={52} sx={{ mb: 0.5, borderRadius: 1 }} />)}
        </Box>
      ) : (
        <Box>
          {intlCountries.map((country, idx) => {
            const flag = getCountryFlag(country.name);
            const pct = intlTotal ? (country.total / intlTotal) * 100 : 0;
            const isExpanded = expandedCountry === country.name;
            const barColor = idx === 0 ? '#d97706' : idx < 3 ? '#f59e0b' : '#fbbf24';

            return (
              <React.Fragment key={country.name}>
                {/* Country row */}
                <Box
                  onClick={() => (country.programas?.length > 0) && toggleCountry(country.name)}
                  sx={{
                    px: 2.5, py: 1.2,
                    display: 'flex', alignItems: 'center', gap: 1.5,
                    borderBottom: '1px solid #f8f4ec',
                    cursor: country.programas?.length > 0 ? 'pointer' : 'default',
                    bgcolor: isExpanded ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#fafaf8',
                    transition: 'background 0.15s',
                    '&:hover': country.programas?.length > 0 ? { bgcolor: isExpanded ? '#fef3c7' : '#fffbf0' } : {}
                  }}
                >
                  {/* Rank */}
                  <Typography sx={{ fontSize: 11, color: '#d1a75a', fontWeight: 800, minWidth: 18, textAlign: 'center' }}>
                    {idx + 1}
                  </Typography>

                  {/* Flag */}
                  <Box sx={{
                    minWidth: 32, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: flag ? 22 : 13, borderRadius: 1,
                    bgcolor: flag ? 'transparent' : '#f1f5f9',
                    color: '#94a3b8', fontWeight: 700, flexShrink: 0, lineHeight: 1
                  }}>
                    {flag || <FlagRoundedIcon sx={{ fontSize: 16, color: '#cbd5e1' }} />}
                  </Box>

                  {/* Country name */}
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{
                      fontSize: 13, fontWeight: 700, color: '#1e293b',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                    }}>
                      {country.name}
                    </Typography>
                    {country.programas?.length > 0 && (
                      <Typography sx={{ fontSize: 10.5, color: '#94a3b8' }}>
                        {country.programas.length} programa{country.programas.length !== 1 ? 's' : ''}
                      </Typography>
                    )}
                  </Box>

                  {/* Progress bar */}
                  <Box sx={{ minWidth: 100, flexShrink: 0 }}>
                    <Box sx={{ bgcolor: '#f1f5f9', borderRadius: 2, height: 7, overflow: 'hidden' }}>
                      <Box sx={{
                        height: '100%',
                        width: `${(country.total / maxCount) * 100}%`,
                        bgcolor: barColor,
                        borderRadius: 2,
                        transition: 'width 0.5s ease'
                      }} />
                    </Box>
                  </Box>

                  {/* Count */}
                  <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#1e293b', minWidth: 28, textAlign: 'right' }}>
                    {fmt(country.total)}
                  </Typography>

                  {/* Pct */}
                  <Typography sx={{ fontSize: 11.5, color: '#94a3b8', minWidth: 50 }}>
                    ({pct.toFixed(1)}%)
                  </Typography>

                  {/* Expand icon */}
                  <Box sx={{ width: 28, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {country.programas?.length > 0 && (
                      <ExpandMoreRoundedIcon sx={{
                        fontSize: 20, color: '#d97706',
                        transition: 'transform 0.25s ease',
                        transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                      }} />
                    )}
                  </Box>
                </Box>

                {/* Programs sub-list */}
                {isExpanded && country.programas?.length > 0 && (
                  <Box sx={{ bgcolor: '#fffbeb', borderBottom: '1px solid #f1f5f9' }}>
                    {/* Programs header */}
                    <Box sx={{ pl: 9, pr: 3, py: 0.8, bgcolor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Programas académicos · {country.name}
                      </Typography>
                    </Box>

                    {country.programas.map((prog, pi) => {
                      const progKey = `${country.name}__${prog.programa}`;
                      const isProgramExpanded = expandedProgram === progKey;
                      const hasSexo = prog.sexo?.length > 0;

                      return (
                        <React.Fragment key={progKey}>
                          <Box
                            onClick={() => hasSexo && toggleProgram(progKey)}
                            sx={{
                              pl: 9, pr: 3, py: 1,
                              display: 'flex', alignItems: 'center', gap: 1.2,
                              borderBottom: pi < country.programas.length - 1 ? '1px solid #fef3c7' : 'none',
                              cursor: hasSexo ? 'pointer' : 'default',
                              bgcolor: isProgramExpanded ? '#fef9c3' : 'transparent',
                              transition: 'background 0.12s',
                              '&:hover': hasSexo ? { bgcolor: isProgramExpanded ? '#fef08a55' : '#fef3c760' } : {}
                            }}
                          >
                            <MenuBookRoundedIcon sx={{ fontSize: 14, color: '#d97706', flexShrink: 0 }} />

                            <Typography sx={{
                              fontSize: 12.5, fontWeight: 600, color: '#78350f',
                              flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                            }}>
                              {prog.programa}
                            </Typography>

                            {hasSexo && (
                              <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexShrink: 0 }}>
                                {prog.sexo.map((s, si) => (
                                  <Chip
                                    key={si}
                                    size="small"
                                    label={`${s.name === 'FEMENINO' ? '♀' : s.name === 'MASCULINO' ? '♂' : '○'} ${fmt(s.total)}`}
                                    sx={{
                                      height: 18, fontSize: 10.5, fontWeight: 700,
                                      bgcolor: s.name === 'FEMENINO' ? '#fce7f3' : s.name === 'MASCULINO' ? '#eff6ff' : '#f3f4f6',
                                      color: s.name === 'FEMENINO' ? '#be185d' : s.name === 'MASCULINO' ? '#1d4ed8' : '#6b7280',
                                    }}
                                  />
                                ))}
                              </Stack>
                            )}

                            <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#92400e', minWidth: 28, textAlign: 'right' }}>
                              {fmt(prog.total)}
                            </Typography>

                            {hasSexo && (
                              <ExpandMoreRoundedIcon sx={{
                                fontSize: 17, color: '#b45309',
                                transition: 'transform 0.2s',
                                transform: isProgramExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
                              }} />
                            )}
                          </Box>

                          {/* Sex breakdown */}
                          {isProgramExpanded && hasSexo && (
                            <Box sx={{ pl: 12, pr: 3, py: 1.4, bgcolor: '#fefce8', borderBottom: '1px solid #fef3c7' }}>
                              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                                <WcRoundedIcon sx={{ fontSize: 14, color: '#b45309' }} />
                                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Distribución por sexo biológico
                                </Typography>
                              </Stack>
                              <Stack spacing={1}>
                                {prog.sexo.map((s, si) => {
                                  const sPct = prog.total ? (s.total / prog.total) * 100 : 0;
                                  const sColor = SEXO_COLOR[s.name] || '#6b7280';
                                  return (
                                    <Stack key={si} direction="row" alignItems="center" spacing={1.2}>
                                      <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: sColor, flexShrink: 0 }} />
                                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569', minWidth: 90 }}>
                                        {s.name === 'FEMENINO' ? 'Femenino' : s.name === 'MASCULINO' ? 'Masculino' : s.name}
                                      </Typography>
                                      <Box sx={{ flex: 1, bgcolor: '#f1f5f9', borderRadius: 2, height: 8, overflow: 'hidden' }}>
                                        <Box sx={{
                                          height: '100%', width: `${sPct}%`,
                                          bgcolor: sColor, borderRadius: 2,
                                          transition: 'width 0.4s ease'
                                        }} />
                                      </Box>
                                      <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e293b', minWidth: 24, textAlign: 'right' }}>
                                        {fmt(s.total)}
                                      </Typography>
                                      <Typography sx={{ fontSize: 11, color: '#94a3b8', minWidth: 38 }}>
                                        {sPct.toFixed(1)}%
                                      </Typography>
                                    </Stack>
                                  );
                                })}
                              </Stack>
                              {/* Visual donut-style summary */}
                              <Stack direction="row" spacing={1} sx={{ mt: 1.2, pt: 1, borderTop: '1px solid #fde68a' }}>
                                {prog.sexo.map((s, si) => {
                                  const sPct = prog.total ? (s.total / prog.total) * 100 : 0;
                                  return (
                                    <Box key={si} sx={{
                                      flex: 1, p: 1, borderRadius: 2, textAlign: 'center',
                                      bgcolor: s.name === 'FEMENINO' ? '#fce7f3' : s.name === 'MASCULINO' ? '#eff6ff' : '#f3f4f6',
                                      border: `1px solid ${SEXO_COLOR[s.name] || '#e2e8f0'}33`
                                    }}>
                                      <Typography sx={{ fontSize: 18, fontWeight: 900, color: SEXO_COLOR[s.name] || '#6b7280' }}>
                                        {fmt(s.total)}
                                      </Typography>
                                      <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>
                                        {s.name === 'FEMENINO' ? '♀ Femenino' : s.name === 'MASCULINO' ? '♂ Masculino' : s.name} · {sPct.toFixed(0)}%
                                      </Typography>
                                    </Box>
                                  );
                                })}
                              </Stack>
                            </Box>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </Box>
                )}
              </React.Fragment>
            );
          })}

          {/* Footer summary */}
          <Box sx={{ px: 2.5, py: 1.2, bgcolor: '#fef3c7', borderTop: '1px solid #fde68a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#92400e' }}>
              Total estudiantes internacionales
            </Typography>
            <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#78350f' }}>
              {fmt(intlTotal)} · {total ? ((intlTotal / total) * 100).toFixed(2) : 0}%
            </Typography>
          </Box>
        </Box>
      )}
    </Paper>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MatriculadosDashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Filters
  const [selectedYears, setSelectedYears] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState('ambos');
  const [selectedPrograms, setSelectedPrograms] = useState([]);
  const [selectedNiveles, setSelectedNiveles] = useState([]);

  // Map state
  const [geoFeatures, setGeoFeatures] = useState([]);
  const [geoBbox, setGeoBbox] = useState(null);
  const [hoveredDept, setHoveredDept] = useState(null);

  // Municipality drill-down state
  const [selectedDept, setSelectedDept] = useState(null);
  const [muniGeoAll, setMuniGeoAll] = useState([]);
  const [muniGeoLoaded, setMuniGeoLoaded] = useState(false);
  const [muniLoading, setMuniLoading] = useState(false);
  const [hoveredMuni, setHoveredMuni] = useState(null);

  // Table sort
  const [sortField, setSortField] = useState('total');
  const [sortDir, setSortDir] = useState('desc');

  const reqRef = useRef(0);

  // Load GeoJSON for Colombia map
  useEffect(() => {
    fetch('/geodata/colombia_adm1.geojson')
      .then((r) => r.json())
      .then((geo) => {
        let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
        const features = (geo.features || []).map((f) => {
          const geom = f.geometry;
          let rings = [];
          if (geom.type === 'Polygon') rings = [geom.coordinates[0]];
          else if (geom.type === 'MultiPolygon') rings = geom.coordinates.map((p) => p[0]);
          rings.forEach((ring) => ring.forEach(([lon, lat]) => {
            if (lon < minLon) minLon = lon;
            if (lon > maxLon) maxLon = lon;
            if (lat < minLat) minLat = lat;
            if (lat > maxLat) maxLat = lat;
          }));
          return {
            name: String(f.properties?.NOMBRE_DPT || f.properties?.NAME_1 || '').toUpperCase().trim(),
            rings
          };
        });
        setGeoFeatures(features);
        setGeoBbox({ minLon, maxLon, minLat, maxLat });
      })
      .catch(() => {});
  }, []);

  // Lazy-load municipality GeoJSON on first department selection
  useEffect(() => {
    if (!selectedDept || muniGeoLoaded) return;
    setMuniLoading(true);
    fetch('/geodata/colombia_adm2.geojson')
      .then((r) => r.json())
      .then((geo) => {
        const features = (geo.features || []).map((f) => {
          const geom = f.geometry;
          let rings = [];
          if (geom.type === 'Polygon') rings = [geom.coordinates[0]];
          else if (geom.type === 'MultiPolygon') rings = geom.coordinates.map((p) => p[0]);
          const deptName = String(
            f.properties?.NOMBRE_DPT || f.properties?.NAME_1 || f.properties?.DPTO_CNMBR || ''
          ).toUpperCase().trim();
          const muniName = String(
            f.properties?.NOMBRE_MUN || f.properties?.NAME_2 || f.properties?.NOMMPIO || f.properties?.shapeName || ''
          ).toUpperCase().trim();
          return { deptName, muniName, rings };
        });
        setMuniGeoAll(features);
        setMuniGeoLoaded(true);
        setMuniLoading(false);
      })
      .catch(() => setMuniLoading(false));
  }, [selectedDept, muniGeoLoaded]);

  // Fetch dashboard data
  const fetchData = useCallback(async () => {
    const id = ++reqRef.current;
    setLoading(true);
    setError(null);
    try {
      const periodos = selectedSemester === 'ambos' ? ['1', '2'] : [selectedSemester];
      const response = await gestionInformacionService.getMatriculadosGeoDashboard({
        anios: selectedYears,
        periodos,
        programas: selectedPrograms,
        niveles: selectedNiveles
      });
      if (reqRef.current !== id) return;
      setData(response?.data || null);
    } catch (err) {
      if (reqRef.current !== id) return;
      setError(err?.response?.data?.message || 'Error al cargar los datos del dashboard.');
    } finally {
      if (reqRef.current === id) setLoading(false);
    }
  }, [selectedYears, selectedSemester, selectedPrograms, selectedNiveles, refreshToken]); // eslint-disable-line

  useEffect(() => { fetchData(); }, [fetchData]);

  // Derived values
  const total = data?.totalRegistros || 0;
  const departments = data?.geography?.departments || [];
  const countries = data?.geography?.countries || [];
  const sexoData = data?.sexo || [];
  const historico = data?.historico || [];
  const nivelesData = data?.nivelesFormacion || [];
  const semestresData = data?.semestres || [];
  const calidadCruce = data?.calidadCruce || {};

  // Usar aniosDisponibles (calculado sobre allRows en backend) para que los chips
  // de año nunca desaparezcan al aplicar otros filtros.
  const availableYears = (data?.aniosDisponibles?.length
    ? data.aniosDisponibles
    : [...new Set(semestresData.map((s) => s.anio))]
  ).sort();

  // YoY delta
  const yoyDelta = (() => {
    if (semestresData.length < 2) return undefined;
    const sorted = [...semestresData].sort((a, b) => String(a.anio).localeCompare(String(b.anio)));
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const lastTotal = (last.semestre1 || 0) + (last.semestre2 || 0);
    const prevTotal = (prev.semestre1 || 0) + (prev.semestre2 || 0);
    if (!prevTotal) return undefined;
    return ((lastTotal - prevTotal) / prevTotal) * 100;
  })();

  // Top programs — build from dept.municipios aggregation is unavailable, use nivelesFormacion programas count
  const programasActivos = nivelesData.reduce((acc, n) => acc + (n.programas || 0), 0);

  // Compute dept map intensity
  const maxDeptTotal = departments.reduce((m, d) => Math.max(m, d.total), 0) || 1;
  const deptByName = new Map(departments.map((d) => [d.name, d]));

  // Colombia map color scale
  const deptFill = (featName) => {
    const d = deptByName.get(featName);
    if (!d || !d.total) return '#e8f0fe';
    const intensity = d.total / maxDeptTotal;
    if (intensity > 0.75) return '#1d4ed8';
    if (intensity > 0.5) return '#3b82f6';
    if (intensity > 0.25) return '#93c5fd';
    if (intensity > 0.05) return '#bfdbfe';
    return '#dbeafe';
  };

  // Municipality derived values
  const deptMuniFeatures = useMemo(() => {
    if (!selectedDept || !muniGeoAll.length) return [];
    return muniGeoAll.filter((f) => f.deptName === selectedDept);
  }, [selectedDept, muniGeoAll]);

  const deptMuniBbox = useMemo(() => {
    if (!deptMuniFeatures.length) return null;
    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    deptMuniFeatures.forEach((f) => {
      f.rings.forEach((ring) => ring.forEach(([lon, lat]) => {
        if (lon < minLon) minLon = lon; if (lon > maxLon) maxLon = lon;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }));
    });
    return { minLon, maxLon, minLat, maxLat };
  }, [deptMuniFeatures]);

  const selectedDeptObj = selectedDept ? deptByName.get(selectedDept) : null;
  const selectedMunis = selectedDeptObj?.municipios || [];
  const muniByName = new Map(selectedMunis.map((m) => [String(m.name || '').toUpperCase().trim(), m]));
  const maxMuniTotal = selectedMunis.reduce((acc, m) => Math.max(acc, m.total || 0), 0) || 1;
  const muniFill = (total) => {
    const intensity = (total || 0) / maxMuniTotal;
    if (intensity > 0.75) return '#1d4ed8';
    if (intensity > 0.5) return '#3b82f6';
    if (intensity > 0.25) return '#93c5fd';
    if (intensity > 0.05) return '#bfdbfe';
    return '#dbeafe';
  };

  const departmentLabels = useMemo(() => buildLabelLayout({
    features: geoFeatures,
    bbox: geoBbox,
    width: 800,
    height: 600,
    variant: 'department',
    minFeatureSize: 10,
    getData: (feature) => {
      const dept = deptByName.get(feature.name);
      if (!dept || !dept.total) return null;
      return {
        label: feature.name,
        total: dept.total
      };
    }
  }), [geoBbox, geoFeatures, deptByName]);

  const municipalityLabels = useMemo(() => buildLabelLayout({
    features: deptMuniFeatures,
    bbox: deptMuniBbox,
    width: 800,
    height: 600,
    variant: 'municipality',
    minFeatureSize: 12,
    getData: (feature) => {
      const municipality = muniByName.get(feature.muniName);
      if (!municipality || !municipality.total) return null;
      return {
        label: feature.muniName,
        total: municipality.total
      };
    }
  }), [deptMuniBbox, deptMuniFeatures, muniByName]);

  // Table data sorted
  const deptTableRows = [...departments].sort((a, b) => {
    const aVal = a[sortField] ?? 0;
    const bVal = b[sortField] ?? 0;
    if (typeof aVal === 'string') return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  const handleSort = (field) => {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortField(field); setSortDir('desc'); }
  };

  // Toggle year filter
  const toggleYear = (yr) => {
    setSelectedYears((prev) =>
      prev.includes(yr) ? prev.filter((y) => y !== yr) : [...prev, yr]
    );
  };

  // Toggle program filter
  const toggleProgram = (prog) => {
    setSelectedPrograms((prev) =>
      prev.includes(prog) ? prev.filter((p) => p !== prog) : [...prev, prog]
    );
  };

  // Toggle nivel de formación filter
  const toggleNivel = (nivel) => {
    setSelectedNiveles((prev) =>
      prev.includes(nivel) ? prev.filter((n) => n !== nivel) : [...prev, nivel]
    );
  };

  const availablePrograms = data?.programasDisponibles || [];
  const availableNiveles = data?.nivelesDisponibles || [];

  const intlStudents = countries.filter((c) => c.name !== 'COLOMBIA').reduce((acc, c) => acc + c.total, 0);

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc' }}>
      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <Box sx={{
        background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 55%, #3b82f6 100%)',
        px: { xs: 2, md: 3 },
        pt: 2.2,
        pb: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
        boxShadow: '0 4px 24px -8px rgba(29,78,216,0.4)'
      }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 1.5 }}>
          <Tooltip title="Volver a Gestión de Información">
            <IconButton
              onClick={() => navigate('/dashboard/gestion-informacion')}
              sx={{
                color: 'rgba(255,255,255,0.85)', bgcolor: 'rgba(255,255,255,0.12)',
                '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' }, borderRadius: 2, p: 0.8
              }}
            >
              <ArrowBackRoundedIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ flex: 1 }}>
            <Box sx={{
              bgcolor: 'rgba(255,255,255,0.18)', borderRadius: 2, p: 0.7,
              display: 'flex', alignItems: 'center'
            }}>
              <SchoolRoundedIcon sx={{ fontSize: 22, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 15, md: 18 }, color: '#fff', lineHeight: 1.1, letterSpacing: '-0.01em' }}>
                Dashboard Matriculados
              </Typography>
              <Typography sx={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)', mt: 0.1 }}>
                Universidad CESMAG · Análisis poblacional interactivo
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {total > 0 && (
              <Chip
                label={`${fmt(total)} registros`}
                size="small"
                sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff', fontWeight: 700, fontSize: 12, height: 26 }}
              />
            )}
            <Tooltip title="Actualizar datos">
              <IconButton
                onClick={() => setRefreshToken((t) => t + 1)}
                disabled={loading}
                sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,0.12)', '&:hover': { bgcolor: 'rgba(255,255,255,0.22)' }, borderRadius: 2, p: 0.8 }}
              >
                <RefreshRoundedIcon fontSize="small" sx={{ animation: loading ? 'spin 1s linear infinite' : 'none', '@keyframes spin': { from: { transform: 'rotate(0deg)' }, to: { transform: 'rotate(360deg)' } } }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Stack>

        {/* Filter bar */}
        <Box sx={{
          bgcolor: 'rgba(255,255,255,0.1)',
          borderRadius: '10px 10px 0 0',
          px: 2, py: 1.2,
          display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center'
        }}>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <FilterAltRoundedIcon sx={{ fontSize: 15, color: 'rgba(255,255,255,0.7)' }} />
            <Typography sx={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.7)' }}>FILTROS</Typography>
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

          {/* Year chips */}
          <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5 }}>
            {(loading && availableYears.length === 0 ? ['...'] : availableYears).map((yr) => (
              <Chip
                key={yr}
                label={yr}
                size="small"
                onClick={() => yr !== '...' && toggleYear(String(yr))}
                sx={{
                  height: 26, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                  bgcolor: selectedYears.includes(String(yr)) ? '#fff' : 'rgba(255,255,255,0.15)',
                  color: selectedYears.includes(String(yr)) ? '#1d4ed8' : 'rgba(255,255,255,0.85)',
                  '&:hover': { bgcolor: selectedYears.includes(String(yr)) ? '#f0f7ff' : 'rgba(255,255,255,0.25)' }
                }}
              />
            ))}
            {selectedYears.length > 0 && (
              <Chip
                label="Todos"
                size="small"
                onClick={() => setSelectedYears([])}
                sx={{ height: 26, fontSize: 11, fontWeight: 700, bgcolor: 'rgba(255,100,100,0.3)', color: '#fff', cursor: 'pointer' }}
              />
            )}
          </Stack>
          <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />

          {/* Semester toggle */}
          <ToggleButtonGroup
            value={selectedSemester}
            exclusive
            size="small"
            onChange={(_, v) => v && setSelectedSemester(v)}
            sx={{
              bgcolor: 'rgba(255,255,255,0.12)',
              '& .MuiToggleButton-root': {
                color: 'rgba(255,255,255,0.7)', border: 'none', fontWeight: 700, fontSize: 11.5,
                px: 1.5, py: 0.4, borderRadius: '6px !important', mx: 0.2,
                '&.Mui-selected': { bgcolor: '#fff', color: '#1d4ed8' },
                '&:hover': { bgcolor: 'rgba(255,255,255,0.2)' }
              }
            }}
          >
            <ToggleButton value="ambos">Ambos semestres</ToggleButton>
            <ToggleButton value="1">Semestre 1</ToggleButton>
            <ToggleButton value="2">Semestre 2</ToggleButton>
          </ToggleButtonGroup>

          {/* Nivel de formación filter */}
          {availableNiveles.length > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
              <Stack direction="row" spacing={0.5} flexWrap="wrap" alignItems="center" sx={{ gap: 0.5 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', mr: 0.3 }}>NIVEL</Typography>
                {availableNiveles.map((nivel) => {
                  const active = selectedNiveles.includes(nivel);
                  const color = NIVEL_COLOR[nivel] || '#6b7280';
                  return (
                    <Chip
                      key={nivel}
                      label={NIVEL_LABEL[nivel] || nivel}
                      size="small"
                      onClick={() => toggleNivel(nivel)}
                      sx={{
                        height: 24, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                        bgcolor: active ? '#fff' : 'rgba(255,255,255,0.12)',
                        color: active ? color : 'rgba(255,255,255,0.82)',
                        border: active ? `1.5px solid ${color}` : '1.5px solid transparent',
                        '&:hover': { bgcolor: active ? '#f8fafc' : 'rgba(255,255,255,0.22)' }
                      }}
                    />
                  );
                })}
                {selectedNiveles.length > 0 && (
                  <Chip
                    label="Todos"
                    size="small"
                    onClick={() => setSelectedNiveles([])}
                    sx={{ height: 24, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(255,100,100,0.3)', color: '#fff', cursor: 'pointer' }}
                  />
                )}
              </Stack>
            </>
          )}

          {/* Program filter — only shown once data is available */}
          {availablePrograms.length > 0 && (
            <>
              <Divider orientation="vertical" flexItem sx={{ borderColor: 'rgba(255,255,255,0.2)' }} />
              <Stack direction="row" spacing={0.5} flexWrap="wrap" sx={{ gap: 0.5, maxWidth: { xs: '100%', md: 560 } }}>
                <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', mr: 0.3 }}>PROGRAMA</Typography>
                {availablePrograms.map((prog) => (
                  <Chip
                    key={prog}
                    label={prog}
                    size="small"
                    onClick={() => toggleProgram(prog)}
                    sx={{
                      height: 22, fontSize: 10.5, fontWeight: 600, cursor: 'pointer',
                      bgcolor: selectedPrograms.includes(prog) ? '#fff' : 'rgba(255,255,255,0.12)',
                      color: selectedPrograms.includes(prog) ? '#1d4ed8' : 'rgba(255,255,255,0.78)',
                      '&:hover': { bgcolor: selectedPrograms.includes(prog) ? '#f0f7ff' : 'rgba(255,255,255,0.22)' }
                    }}
                  />
                ))}
                {selectedPrograms.length > 0 && (
                  <Chip
                    label="Todos"
                    size="small"
                    onClick={() => setSelectedPrograms([])}
                    sx={{ height: 22, fontSize: 10.5, fontWeight: 700, bgcolor: 'rgba(255,100,100,0.3)', color: '#fff', cursor: 'pointer' }}
                  />
                )}
              </Stack>
            </>
          )}
        </Box>
      </Box>

      {/* ── CONTENT ─────────────────────────────────────────────────────── */}
      <Box sx={{ px: { xs: 2, md: 3 }, py: 2.5 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* KPI row */}
        <Grid container spacing={2} sx={{ mb: 2.5 }}>
          {[
            { label: 'Total matriculados', value: fmt(total), icon: MenuBookRoundedIcon, color: '#1d4ed8', delta: yoyDelta, sub: 'período seleccionado' },
            { label: 'Estudiantes internacionales', value: fmt(intlStudents), icon: FlightTakeoffRoundedIcon, color: '#b45309', sub: `de ${countries.filter((c) => c.name !== 'COLOMBIA').length} países` },
            { label: 'Cobertura geográfica', value: fmtPct(calidadCruce.coberturaDepartamento), icon: MapRoundedIcon, color: '#0f766e', sub: 'depts. identificados' },
            { label: 'Programas activos', value: fmt(programasActivos), icon: AccountBalanceRoundedIcon, color: '#7c3aed', sub: 'en la institución' }
          ].map((kpi, i) => (
            <Grid item xs={6} md={3} key={i}>
              <KpiCard {...kpi} loading={loading} />
            </Grid>
          ))}
        </Grid>

        {/* Row 1: Trend + Sex distribution */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={7}>
            <ChartCard
              title="Tendencia histórica de matrículas"
              subtitle="Total registros por período académico"
              loading={loading}
              minH={280}
            >
              {historico.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 240 }} spacing={1.5}>
                  <AutoGraphRoundedIcon sx={{ fontSize: 52, color: '#bfdbfe' }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin datos históricos disponibles</Typography>
                </Stack>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={historico} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <defs>
                      <linearGradient id="gradHist" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="periodLabel" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} width={44} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="total" name="Matriculados" stroke="#1d4ed8" strokeWidth={2.5} fill="url(#gradHist)" dot={{ r: 3, fill: '#1d4ed8', strokeWidth: 0 }} activeDot={{ r: 5 }} />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </Grid>
          <Grid item xs={12} md={5}>
            <ChartCard title="Distribución por sexo biológico" loading={loading} minH={280}>
              {sexoData.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 240 }} spacing={1.5}>
                  <PeopleRoundedIcon sx={{ fontSize: 52, color: '#a5f3fc' }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de sexo biológico</Typography>
                </Stack>
              ) : (
                <Stack spacing={1.5}>
                  <ResponsiveContainer width="100%" height={190}>
                    <PieChart>
                      <Pie
                        data={sexoData}
                        cx="50%"
                        cy="50%"
                        innerRadius={54}
                        outerRadius={80}
                        dataKey="total"
                        nameKey="name"
                        paddingAngle={3}
                      >
                        {sexoData.map((entry, i) => (
                          <Cell key={i} fill={SEXO_COLOR[entry.name] || BRAND_COLORS[i % BRAND_COLORS.length]} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(v, n) => [fmt(v), n]} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Stack direction="row" spacing={1} justifyContent="center" flexWrap="wrap" sx={{ gap: 0.8 }}>
                    {sexoData.map((entry, i) => (
                      <Stack key={i} direction="row" spacing={0.6} alignItems="center">
                        <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: SEXO_COLOR[entry.name] || BRAND_COLORS[i % BRAND_COLORS.length] }} />
                        <Typography sx={{ fontSize: 12, color: '#475569', fontWeight: 600 }}>
                          {entry.name}: <strong>{fmt(entry.total)}</strong> ({total ? ((entry.total / total) * 100).toFixed(1) : 0}%)
                        </Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              )}
            </ChartCard>
          </Grid>
        </Grid>

        {/* Row 2: Colombia map + Niveles formación */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} md={6}>
            <ChartCard
              title="Distribución geográfica — Colombia"
              subtitle="Origen de los estudiantes por departamento"
              loading={loading}
              minH={380}
            >
              {departments.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" spacing={2} sx={{
                  height: 360,
                  background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 60%, #bfdbfe 100%)',
                  borderRadius: 2
                }}>
                  <PlaceRoundedIcon sx={{ fontSize: 56, color: '#93c5fd' }} />
                  <Typography sx={{ color: '#1e40af', fontWeight: 700, fontSize: 14 }}>Sin datos geográficos</Typography>
                </Stack>
              ) : !selectedDept ? (
                /* ── Colombia overview map ── */
                <Box>
                  <Typography sx={{ fontSize: 11, color: '#94a3b8', mb: 0.5, textAlign: 'center' }}>
                    Haz clic en un departamento para ver sus municipios
                  </Typography>
                  {geoBbox && geoFeatures.length > 0 && (
                    /* SVG fills container; labels are siblings positioned over it */
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '800/600', borderRadius: 6, overflow: 'hidden' }}>
                      {/* Polygon map */}
                      <svg
                        viewBox="0 0 800 600"
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
                      >
                        <rect width="800" height="600" fill="#f0f7ff" />
                        {geoFeatures.map((feat, fi) => {
                          const d = deptByName.get(feat.name);
                          const fill = deptFill(feat.name);
                          const isHov = hoveredDept === feat.name;
                          return (
                            <path
                              key={fi}
                              d={buildSvgPath(feat.rings, geoBbox, 800, 600)}
                              fill={fill}
                              stroke={isHov ? '#1d4ed8' : '#93c5fd'}
                              strokeWidth={isHov ? 2 : 0.6}
                              style={{ cursor: d ? 'pointer' : 'default', transition: 'fill 0.15s' }}
                              onMouseEnter={() => d && setHoveredDept(feat.name)}
                              onMouseLeave={() => setHoveredDept(null)}
                              onClick={() => { if (d) { setSelectedDept(feat.name); setHoveredDept(null); } }}
                            />
                          );
                        })}
                        {departmentLabels.map((item) => (
                          <MapDataLabel
                            key={item.key}
                            label={item.label}
                            value={item.value}
                            rect={item.rect}
                            anchorX={item.anchorX}
                            anchorY={item.anchorY}
                            variant="department"
                          />
                        ))}
                      </svg>

                      {/* Pin labels — positioned by % of SVG viewBox */}
                      {false && geoFeatures.map((feat, fi) => {
                        const d = deptByName.get(feat.name);
                        if (!d || !d.total) return null;
                        if (computeSvgBboxSize(feat.rings, geoBbox, 800, 600) < 10) return null;
                        const cen = computeCentroid(feat.rings);
                        if (!cen) return null;
                        const { x, y } = projectLonLatToSvg({ lon: cen.lon, lat: cen.lat, bbox: geoBbox, width: 800, height: 600, padding: 16 });
                        const nm = feat.name.length > 14 ? feat.name.substring(0, 12) + '…' : feat.name;
                        return (
                          <div
                            key={`dl-${fi}`}
                            style={{
                              position: 'absolute',
                              left: `${(x / 800) * 100}%`,
                              top: `${(y / 600) * 100}%`,
                              transform: 'translate(-50%, -50%)',
                              textAlign: 'center',
                              pointerEvents: 'none',
                              lineHeight: 1.2,
                              zIndex: 2,
                            }}
                          >
                            <div style={{ fontSize: 10, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textShadow: '0 0 3px #fff,0 0 3px #fff,0 0 3px #fff' }}>
                              {nm}
                            </div>
                            <div style={{ fontSize: 12, fontWeight: 900, color: '#1d4ed8', textShadow: '0 0 3px #fff,0 0 3px #fff' }}>
                              {fmt(d.total)}
                            </div>
                            <svg width="10" height="12" viewBox="0 0 10 12" style={{ display: 'block', margin: '1px auto 0' }}>
                              <circle cx="5" cy="4" r="3.5" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                              <polygon points="2,7 8,7 5,12" fill="#ef4444" />
                            </svg>
                          </div>
                        );
                      })}

                      {/* Hover tooltip */}
                      {hoveredDept && deptByName.get(hoveredDept) && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(15,23,42,0.88)', color: '#fff', borderRadius: 6, padding: '6px 12px', pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{hoveredDept}</div>
                          <div style={{ fontSize: 11, color: '#93c5fd' }}>{fmt(deptByName.get(hoveredDept)?.total)} matriculados</div>
                        </div>
                      )}
                    </div>
                  )}
                  <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.8, justifyContent: 'center' }}>
                    {['Bajo', 'Medio-bajo', 'Medio', 'Alto', 'Muy alto'].map((lbl, i) => (
                      <Stack key={i} direction="row" spacing={0.4} alignItems="center">
                        <Box sx={{ width: 14, height: 10, borderRadius: 0.5, bgcolor: ['#dbeafe', '#bfdbfe', '#93c5fd', '#3b82f6', '#1d4ed8'][i] }} />
                        <Typography sx={{ fontSize: 10, color: '#64748b' }}>{lbl}</Typography>
                      </Stack>
                    ))}
                  </Stack>
                </Box>
              ) : (
                /* ── Municipality drill-down map ── */
                <Box>
                  <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.8 }}>
                    <Tooltip title="Volver al mapa de Colombia">
                      <IconButton size="small" onClick={() => { setSelectedDept(null); setHoveredMuni(null); }}
                        sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', '&:hover': { bgcolor: '#dbeafe' }, borderRadius: 1.5 }}>
                        <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                    <Box>
                      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1e293b', lineHeight: 1.1 }}>{selectedDept}</Typography>
                      <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>
                        {selectedDeptObj ? `${fmt(selectedDeptObj.total)} matriculados` : 'Municipios'}
                      </Typography>
                    </Box>
                  </Stack>

                  {muniLoading ? (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: 300, bgcolor: '#f0f7ff', borderRadius: 2 }} spacing={1.5}>
                      <CircularProgress size={32} thickness={3} sx={{ color: '#3b82f6' }} />
                      <Typography sx={{ fontSize: 12, color: '#64748b' }}>Cargando municipios…</Typography>
                    </Stack>
                  ) : deptMuniFeatures.length > 0 && deptMuniBbox ? (
                    <div style={{ position: 'relative', width: '100%', aspectRatio: '800/600', borderRadius: 6, overflow: 'hidden' }}>
                      {/* Polygon map */}
                      <svg
                        viewBox="0 0 800 600"
                        preserveAspectRatio="none"
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }}
                      >
                        <rect width="800" height="600" fill="#f0f7ff" />
                        {deptMuniFeatures.map((feat, fi) => {
                          const m = muniByName.get(feat.muniName);
                          const fill = m && m.total ? muniFill(m.total) : '#dbeafe';
                          const isHov = hoveredMuni === feat.muniName;
                          return (
                            <path
                              key={fi}
                              d={buildSvgPath(feat.rings, deptMuniBbox, 800, 600)}
                              fill={fill}
                              stroke={isHov ? '#1d4ed8' : '#93c5fd'}
                              strokeWidth={isHov ? 2.5 : 0.8}
                              style={{ cursor: 'default', transition: 'fill 0.12s' }}
                              onMouseEnter={() => setHoveredMuni(feat.muniName)}
                              onMouseLeave={() => setHoveredMuni(null)}
                            />
                          );
                        })}
                        {municipalityLabels.map((item) => (
                          <MapDataLabel
                            key={item.key}
                            label={item.label}
                            value={item.value}
                            rect={item.rect}
                            anchorX={item.anchorX}
                            anchorY={item.anchorY}
                            variant="municipality"
                          />
                        ))}
                      </svg>

                      {/* Municipality pin labels */}
                      {false && deptMuniFeatures.map((feat, fi) => {
                        if (computeSvgBboxSize(feat.rings, deptMuniBbox, 800, 600) < 15) return null;
                        const cen = computeCentroid(feat.rings);
                        if (!cen) return null;
                        const { x, y } = projectLonLatToSvg({ lon: cen.lon, lat: cen.lat, bbox: deptMuniBbox, width: 800, height: 600, padding: 16 });
                        const m = muniByName.get(feat.muniName);
                        const hasCount = m && m.total > 0;
                        const nm = feat.muniName.length > 14 ? feat.muniName.substring(0, 12) + '…' : feat.muniName;
                        return (
                          <div
                            key={`ml-${fi}`}
                            style={{
                              position: 'absolute',
                              left: `${(x / 800) * 100}%`,
                              top: `${(y / 600) * 100}%`,
                              transform: 'translate(-50%, -50%)',
                              textAlign: 'center',
                              pointerEvents: 'none',
                              lineHeight: 1.2,
                              zIndex: 2,
                            }}
                          >
                            <div style={{ fontSize: 9, fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap', textShadow: '0 0 3px #fff,0 0 3px #fff,0 0 3px #fff' }}>
                              {nm}
                            </div>
                            {hasCount && (
                              <div style={{ fontSize: 11, fontWeight: 900, color: '#1d4ed8', textShadow: '0 0 3px #fff,0 0 3px #fff' }}>
                                {fmt(m.total)}
                              </div>
                            )}
                            <svg width="8" height="10" viewBox="0 0 10 12" style={{ display: 'block', margin: '1px auto 0' }}>
                              <circle cx="5" cy="4" r="3.5" fill="#ef4444" stroke="white" strokeWidth="1.5" />
                              <polygon points="2,7 8,7 5,12" fill="#ef4444" />
                            </svg>
                          </div>
                        );
                      })}

                      {/* Hover tooltip */}
                      {hoveredMuni && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8, background: 'rgba(15,23,42,0.88)', color: '#fff', borderRadius: 6, padding: '6px 12px', pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
                          <div style={{ fontSize: 12, fontWeight: 800 }}>{hoveredMuni}</div>
                          {muniByName.get(hoveredMuni) && (
                            <div style={{ fontSize: 11, color: '#93c5fd' }}>{fmt(muniByName.get(hoveredMuni)?.total)} matriculados</div>
                          )}
                        </div>
                      )}
                    </div>
                  ) : (
                    <Stack alignItems="center" justifyContent="center" sx={{ height: 280, bgcolor: '#f0f7ff', borderRadius: 2 }} spacing={1.5}>
                      <PlaceRoundedIcon sx={{ fontSize: 44, color: '#93c5fd' }} />
                      <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>No se encontraron municipios para este departamento</Typography>
                    </Stack>
                  )}

                  {selectedMunis.length > 0 && (
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.5, justifyContent: 'center' }}>
                      {['Bajo', 'Medio-bajo', 'Medio', 'Alto', 'Muy alto'].map((lbl, i) => (
                        <Stack key={i} direction="row" spacing={0.4} alignItems="center">
                          <Box sx={{ width: 14, height: 10, borderRadius: 0.5, bgcolor: ['#dbeafe', '#bfdbfe', '#93c5fd', '#3b82f6', '#1d4ed8'][i] }} />
                          <Typography sx={{ fontSize: 10, color: '#64748b' }}>{lbl}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                </Box>
              )}
            </ChartCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <ChartCard
              title="Nivel de formación"
              subtitle="Distribución de matriculados por tipo de programa"
              loading={loading}
              minH={380}
            >
              {nivelesData.every((n) => n.total === 0) ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 340 }} spacing={1.5}>
                  <AutoGraphRoundedIcon sx={{ fontSize: 52, color: '#bfdbfe' }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin datos de nivel de formación</Typography>
                </Stack>
              ) : (
                <Stack spacing={2}>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={nivelesData.map((n) => ({ ...n, label: NIVEL_LABEL[n.nivel] || n.nivel }))}
                      layout="vertical"
                      margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
                      <YAxis type="category" dataKey="label" tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }} tickLine={false} axisLine={false} width={100} />
                      <ReTooltip content={<CustomTooltip />} />
                      <Bar dataKey="total" name="Matriculados" radius={[0, 5, 5, 0]} barSize={22}>
                        {nivelesData.map((entry, i) => (
                          <Cell key={i} fill={NIVEL_COLOR[entry.nivel] || BRAND_COLORS[i]} />
                        ))}
                        <LabelList dataKey="total" position="right" style={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} formatter={fmt} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {/* Nivel cards */}
                  <Grid container spacing={1} sx={{ px: 0.5 }}>
                    {nivelesData.filter((n) => n.total > 0).map((n, i) => (
                      <Grid item xs={6} key={i}>
                        <Box sx={{
                          p: 1.4, borderRadius: 2,
                          bgcolor: `${NIVEL_COLOR[n.nivel]}0d`,
                          border: `1px solid ${NIVEL_COLOR[n.nivel]}25`
                        }}>
                          <Typography sx={{ fontSize: 11, fontWeight: 700, color: NIVEL_COLOR[n.nivel], textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                            {NIVEL_LABEL[n.nivel] || n.nivel}
                          </Typography>
                          <Typography sx={{ fontSize: 20, fontWeight: 900, color: '#1e293b' }}>{fmt(n.total)}</Typography>
                          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>{n.programas} programa{n.programas !== 1 ? 's' : ''}</Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              )}
            </ChartCard>
          </Grid>
        </Grid>

        {/* Row 3: Semestral comparison */}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12}>
            <ChartCard
              title="Comparativa por semestre"
              subtitle="Estudiantes matriculados · Semestre 1 vs Semestre 2 por año"
              loading={loading}
              minH={240}
            >
              {semestresData.length === 0 ? (
                <Stack alignItems="center" justifyContent="center" sx={{ height: 200 }} spacing={1.5}>
                  <AutoGraphRoundedIcon sx={{ fontSize: 52, color: '#bfdbfe' }} />
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin datos por semestre</Typography>
                </Stack>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={semestresData} margin={{ top: 8, right: 16, left: 0, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="anio" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} width={44} />
                    <ReTooltip content={<CustomTooltip />} />
                    <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                    <Bar dataKey="semestre1" name="Semestre 1" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
                    <Bar dataKey="semestre2" name="Semestre 2" fill="#7c3aed" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ChartCard>
          </Grid>
        </Grid>

        {/* Row 4: Department table */}
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', boxShadow: '0 2px 12px -4px rgba(0,0,0,0.08)', mb: 2 }}>
          <Box sx={{ px: 2.5, py: 1.8, borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>Detalle por departamento</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.1 }}>
                {departments.length} departamentos identificados · Cobertura departamental: {fmtPct(calidadCruce.coberturaDepartamento)}
              </Typography>
            </Box>
            {calidadCruce.incidenciasPendientes > 0 && (
              <Tooltip title={`${calidadCruce.incidenciasPendientes} registros sin coincidencia DIVIPOLA`}>
                <Chip
                  size="small"
                  icon={<InfoOutlinedIcon sx={{ fontSize: '13px !important' }} />}
                  label={`${calidadCruce.incidenciasPendientes} incidencias`}
                  sx={{ bgcolor: '#fef3c7', color: '#d97706', fontWeight: 700, fontSize: 11.5 }}
                />
              </Tooltip>
            )}
          </Box>
          {loading ? (
            <Box sx={{ p: 2 }}>
              {[...Array(5)].map((_, i) => <Skeleton key={i} height={40} sx={{ mb: 0.5, borderRadius: 1 }} />)}
            </Box>
          ) : departments.length === 0 ? (
            <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 6 }}>
              <PlaceRoundedIcon sx={{ fontSize: 48, color: '#bfdbfe' }} />
              <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>No hay datos de distribución departamental</Typography>
            </Stack>
          ) : (
            <TableContainer sx={{ maxHeight: 400 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', fontSize: 12, color: '#475569', py: 1.2 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', fontSize: 12, color: '#475569' }}>
                      <TableSortLabel
                        active={sortField === 'name'}
                        direction={sortField === 'name' ? sortDir : 'asc'}
                        onClick={() => handleSort('name')}
                        sx={{ '& .MuiTableSortLabel-icon': { fontSize: 14 } }}
                      >
                        Departamento
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc', fontSize: 12, color: '#475569' }}>
                      <TableSortLabel
                        active={sortField === 'total'}
                        direction={sortField === 'total' ? sortDir : 'desc'}
                        onClick={() => handleSort('total')}
                        sx={{ '& .MuiTableSortLabel-icon': { fontSize: 14 } }}
                      >
                        Matriculados
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800, bgcolor: '#f8fafc', fontSize: 12, color: '#475569' }}>Participación</TableCell>
                    <TableCell sx={{ fontWeight: 800, bgcolor: '#f8fafc', fontSize: 12, color: '#475569' }}>Distribución</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {deptTableRows.map((dept, idx) => {
                    const pct = total ? (dept.total / total) * 100 : 0;
                    return (
                      <TableRow key={dept.code} hover sx={{ '&:hover td': { bgcolor: '#f0f7ff' } }}>
                        <TableCell sx={{ fontSize: 12, color: '#94a3b8', py: 1 }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#1e293b', py: 1 }}>{dept.name}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 13, fontWeight: 800, color: '#1d4ed8', py: 1 }}>{fmt(dept.total)}</TableCell>
                        <TableCell align="right" sx={{ fontSize: 12, color: '#64748b', py: 1 }}>{fmtPct(pct)}</TableCell>
                        <TableCell sx={{ py: 1, minWidth: 120 }}>
                          <Box sx={{ bgcolor: '#f1f5f9', borderRadius: 1, height: 8, overflow: 'hidden' }}>
                            <Box sx={{
                              height: '100%',
                              width: `${Math.min(pct / (departments[0]?.total / total * 100 || 1) * 100, 100)}%`,
                              bgcolor: '#3b82f6',
                              borderRadius: 1,
                              transition: 'width 0.4s ease'
                            }} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {/* International students — professional panel */}
        <InternationalStudentsPanel countries={countries} total={total} loading={loading} />

        {/* Footer */}
        <Box sx={{ py: 1.5, textAlign: 'center' }}>
          <Typography sx={{ fontSize: 11, color: '#cbd5e1' }}>
            Dashboard Matriculados · SISTEMAS INTEGRADOS DE GESTIÓN — Universidad CESMAG
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}


