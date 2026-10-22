import React, { useCallback, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fade,
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
import {
  AccountTree as AccountTreeIcon,
  ArrowBack as ArrowBackIcon,
  AutoAwesome as AutoAwesomeIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  CalendarMonth as CalendarMonthIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Dashboard as DashboardIcon,
  Download as DownloadIcon,
  FilterAltOff as FilterAltOffIcon,
  Flag as FlagIcon,
  HourglassBottom as HourglassBottomIcon,
  Insights as InsightsIcon,
  ListAlt as ListAltIcon,
  ShowChart as ShowChartIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  } from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import XLSXStyle from 'xlsx-js-style';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../services/gestionInformacionService';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import StrategicPlanningPlatform from './StrategicPlanningPlatform';

const PED_YEAR_WEIGHT = 14.28;



const STRUCTURE_CARDS = [
  { key: 'totalObjetivos', label: 'Objetivos Estratégicos', color: '#1e40af', gradient: 'linear-gradient(135deg,#1e40af,#3b82f6)', shadow: 'rgba(30,64,175,.24)', icon: <FlagIcon sx={{ color: 'white', fontSize: 28 }} /> },
  { key: 'totalLineamientos', label: 'Lineamientos Estratégicos', color: '#0891b2', gradient: 'linear-gradient(135deg,#0891b2,#06b6d4)', shadow: 'rgba(8,145,178,.24)', icon: <AccountTreeIcon sx={{ color: 'white', fontSize: 28 }} /> },
  { key: 'totalActividades', label: 'Actividades PED', color: '#ef4444', gradient: 'linear-gradient(135deg,#dc2626,#ef4444)', shadow: 'rgba(220,38,38,.24)', icon: <ListAltIcon sx={{ color: 'white', fontSize: 28 }} /> },
  { key: 'totalIndicadores', label: 'Indicadores de Gestión', color: '#7c3aed', gradient: 'linear-gradient(135deg,#7c3aed,#8b5cf6)', shadow: 'rgba(124,58,237,.24)', icon: <InsightsIcon sx={{ color: 'white', fontSize: 28 }} /> }
];

const STATUS_CARDS = [
  { key: 'pendientes', label: 'Sin Iniciar', color: '#ef4444', gradient: 'linear-gradient(135deg,#ef4444,#f87171)', shadow: 'rgba(239,68,68,.24)', icon: <CancelIcon sx={{ color: 'white', fontSize: 28 }} /> },
  { key: 'enProceso', label: 'En Ejecución', color: '#f59e0b', gradient: 'linear-gradient(135deg,#f59e0b,#fbbf24)', shadow: 'rgba(245,158,11,.24)', icon: <HourglassBottomIcon sx={{ color: 'white', fontSize: 28 }} /> },
  { key: 'cumplidos', label: 'Completados', color: '#10b981', gradient: 'linear-gradient(135deg,#10b981,#34d399)', shadow: 'rgba(16,185,129,.24)', icon: <CheckCircleIcon sx={{ color: 'white', fontSize: 28 }} /> },
  { key: 'ejecucionGeneral', label: 'Ejecución General PED', color: '#ec4899', gradient: 'linear-gradient(135deg,#ec4899,#f97316)', shadow: 'rgba(236,72,153,.24)', suffix: '%', icon: <TrendingUpIcon sx={{ color: 'white', fontSize: 28 }} /> }
];

const percent = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 0 && numeric <= 1 ? Number((numeric * 100).toFixed(2)) : Number(numeric.toFixed(2));
};

const formatNumber = (value) => Number(value || 0).toLocaleString('es-CO');
const formatPercent = (value) => `${Number(value || 0).toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;

const macroactivityCodeNumber = (value) => {
  const match = String(value || '').match(/\bA\s*-?\s*0*(\d+)\b/i);
  return match ? Number(match[1]) : null;
};

const compareMacroactivities = (left, right) => {
  const leftNumber = macroactivityCodeNumber(left);
  const rightNumber = macroactivityCodeNumber(right);

  if (leftNumber !== null && rightNumber !== null && leftNumber !== rightNumber) {
    return leftNumber - rightNumber;
  }

  if (leftNumber !== null && rightNumber === null) return -1;
  if (leftNumber === null && rightNumber !== null) return 1;
  return String(left).localeCompare(String(right), 'es', { numeric: true, sensitivity: 'base' });
};

const normalizeCatalogKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const resolveEstado = (value) => {
  const amount = percent(value);
  if (amount === null) return 'Sin dato';
  if (amount <= 0) return 'Sin iniciar';
  if (amount >= 99.5) return 'Completado';
  return 'En ejecución';
};

const buildMetrics = (rows = []) => {
  const objetivos = new Set();
  const lineamientos = new Set();
  const actividadesPorAnio = new Map();
  let pendientes = 0;
  let enProceso = 0;
  let cumplidos = 0;

  rows.forEach((row) => {
    if (row.objetivo_estrategico) objetivos.add(row.objetivo_estrategico);
    if (row.lineamiento_estrategico) lineamientos.add(row.lineamiento_estrategico);
    if (row.anio && row.actividad) {
      const bucket = actividadesPorAnio.get(row.anio) || new Set();
      bucket.add(row.actividad);
      actividadesPorAnio.set(row.anio, bucket);
    }

    const estado = resolveEstado(row.avance_total);
    if (estado === 'Sin iniciar') pendientes += 1;
    if (estado === 'En ejecución') enProceso += 1;
    if (estado === 'Completado') cumplidos += 1;
  });

  const years = Array.from(new Set(rows.map((row) => row.anio).filter(Boolean)));
  const lineamientosList = Array.from(lineamientos);

  let totalGeneral = 0;
  lineamientosList.forEach((lineamiento) => {
    years.forEach((anio) => {
      const subset = rows.filter((row) => row.lineamiento_estrategico === lineamiento && row.anio === anio);
      if (!subset.length) return;
      const avgFraction = subset.reduce((acc, row) => acc + ((percent(row.avance_total) || 0) / 100), 0) / subset.length;
      totalGeneral += avgFraction * PED_YEAR_WEIGHT;
    });
  });

  const ejecucionGeneral = lineamientosList.length ? Number((totalGeneral / lineamientosList.length).toFixed(2)) : 0;

  return {
    totalObjetivos: objetivos.size,
    totalLineamientos: lineamientos.size,
    totalActividades: Array.from(actividadesPorAnio.values()).reduce((acc, set) => acc + set.size, 0),
    totalIndicadores: rows.length,
    pendientes,
    enProceso,
    cumplidos,
    ejecucionGeneral
  };
};

const buildLineamientosStats = (rows = []) => {
  const weightPerYear = PED_YEAR_WEIGHT;
  const years = Array.from(new Set(rows.map((row) => Number(row.anio)).filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
  const lineamientos = Array.from(new Set(rows.map((row) => row.lineamiento_estrategico).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'es'));

  const avgByLineamientoYear = new Map();
  lineamientos.forEach((lineamiento) => {
    years.forEach((anio) => {
      const subset = rows.filter((row) => row.lineamiento_estrategico === lineamiento && Number(row.anio) === anio);
      if (!subset.length) return;
      const avgPercent = subset.reduce((acc, row) => acc + (percent(row.avance_total) || 0), 0) / subset.length;
      avgByLineamientoYear.set(`${lineamiento}||${anio}`, Number(avgPercent.toFixed(2)));
    });
  });

  const totalActividades = years.reduce((acc, anio) => {
    const set = new Set(rows.filter((row) => Number(row.anio) === anio).map((row) => row.actividad).filter(Boolean));
    return acc + set.size;
  }, 0);

  const comboValues = Array.from(avgByLineamientoYear.values());
  const promLineamientos = comboValues.length
    ? Number((comboValues.reduce((acc, value) => acc + value, 0) / comboValues.length).toFixed(2))
    : 0;

  let totalGeneral = 0;
  lineamientos.forEach((lineamiento) => {
    years.forEach((anio) => {
      const value = avgByLineamientoYear.get(`${lineamiento}||${anio}`);
      if (value === undefined) return;
      totalGeneral += (value / 100) * weightPerYear;
    });
  });

  const ejecucionGeneral = lineamientos.length ? Number((totalGeneral / lineamientos.length).toFixed(2)) : 0;

  const cumplimientoRows = lineamientos.map((lineamiento) => {
    const byYear = {};
    years.forEach((anio) => {
      const value = avgByLineamientoYear.get(`${lineamiento}||${anio}`);
      byYear[anio] = value ?? null;
    });
    const values = Object.values(byYear).filter((value) => value !== null);
    const total = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2)) : null;
    return { lineamiento, byYear, total };
  });

  const cumplimientoTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const values = cumplimientoRows.map((row) => row.byYear[anio]).filter((value) => value !== null);
      const avg = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2)) : null;
      return [anio, avg];
    })
  );
  const cumplimientoGeneral = comboValues.length
    ? Number((comboValues.reduce((acc, value) => acc + value, 0) / comboValues.length).toFixed(2))
    : 0;

  const ejecucionRows = lineamientos.map((lineamiento) => {
    const byYear = {};
    years.forEach((anio) => {
      const avg = avgByLineamientoYear.get(`${lineamiento}||${anio}`);
      byYear[anio] = avg === undefined ? null : Number((((avg / 100) * weightPerYear)).toFixed(2));
    });
    const values = Object.values(byYear).filter((value) => value !== null);
    const total = values.length ? Number(values.reduce((acc, value) => acc + value, 0).toFixed(2)) : null;
    return { lineamiento, byYear, total };
  });

  const ejecucionTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const values = ejecucionRows.map((row) => row.byYear[anio]).filter((value) => value !== null);
      const total = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / Math.max(lineamientos.length, 1)).toFixed(2)) : null;
      return [anio, total];
    })
  );
  const ejecucionGeneralProm = lineamientos.length ? Number((totalGeneral / lineamientos.length).toFixed(2)) : 0;

  return {
    years,
    lineamientos,
    totalActividades,
    totalLineamientos: lineamientos.length,
    promLineamientos,
    ejecucionGeneral,
    cumplimientoRows,
    cumplimientoTotalsByYear,
    cumplimientoGeneral,
    ejecucionRows,
    ejecucionTotalsByYear,
    ejecucionGeneralProm,
    weightPerYear
  };
};

const buildActividadesStats = (rows = []) => {
  const weightPerYear = PED_YEAR_WEIGHT;
  const yearsSet = new Set();
  const macroactividadesSet = new Set();
  const lineamientosSet = new Set();
  const macroactividadYearAgg = new Map();
  const lineamientoYearAgg = new Map();
  const yearAgg = new Map();

  rows.forEach((row) => {
    const anio = Number(row.anio);
    if (!Number.isFinite(anio)) return;

    yearsSet.add(anio);

    const macroactividad = row.macroactividad || '';
    const lineamiento = row.lineamiento_estrategico || '';
    const avance = percent(row.avance_total) || 0;

    if (macroactividad) {
      macroactividadesSet.add(macroactividad);
      const macroactividadYearKey = `${macroactividad}||${anio}`;
      const macroactividadYearCurrent = macroactividadYearAgg.get(macroactividadYearKey) || { total: 0, count: 0 };
      macroactividadYearCurrent.total += avance;
      macroactividadYearCurrent.count += 1;
      macroactividadYearAgg.set(macroactividadYearKey, macroactividadYearCurrent);
    }

    if (lineamiento) {
      lineamientosSet.add(lineamiento);
      const lineamientoYearKey = `${lineamiento}||${anio}`;
      const lineamientoYearCurrent = lineamientoYearAgg.get(lineamientoYearKey) || { totalFraction: 0, count: 0 };
      lineamientoYearCurrent.totalFraction += (avance / 100);
      lineamientoYearCurrent.count += 1;
      lineamientoYearAgg.set(lineamientoYearKey, lineamientoYearCurrent);
    }

    const yearCurrent = yearAgg.get(anio) || { total: 0, count: 0 };
    yearCurrent.total += avance;
    yearCurrent.count += 1;
    yearAgg.set(anio, yearCurrent);
  });

  const years = Array.from(yearsSet).sort((a, b) => a - b);
  const macroactividades = Array.from(macroactividadesSet).sort(compareMacroactivities);
  const lineamientos = Array.from(lineamientosSet);

  const avgByMacroactividadYear = new Map();
  macroactividadYearAgg.forEach((agg, key) => {
    if (!agg.count) return;
    avgByMacroactividadYear.set(key, Number((agg.total / agg.count).toFixed(2)));
  });

  const totalMacroactividades = macroactividades.length;
  const macroactivityNumbers = macroactividades
    .map(macroactivityCodeNumber)
    .filter((value) => Number.isFinite(value));
  const maxMacroactivityNumber = macroactivityNumbers.length ? Math.max(...macroactivityNumbers) : 0;
  const macroactivityNumberSet = new Set(macroactivityNumbers);
  const missingMacroactivityCodes = Array.from(
    { length: maxMacroactivityNumber },
    (_, index) => index + 1
  )
    .filter((value) => !macroactivityNumberSet.has(value))
    .map((value) => `A-${String(value).padStart(3, '0')}`);

  const yearlyAvgs = years
    .map((anio) => {
      const agg = yearAgg.get(anio);
      if (!agg?.count) return null;
      return Number((agg.total / agg.count).toFixed(2));
    })
    .filter((value) => value !== null && value > 0);
  const promActividadesPed = yearlyAvgs.length
    ? Number((yearlyAvgs.reduce((acc, value) => acc + value, 0) / yearlyAvgs.length).toFixed(2))
    : 0;

  let totalGeneral = 0;
  lineamientos.forEach((lineamiento) => {
    years.forEach((anio) => {
      const agg = lineamientoYearAgg.get(`${lineamiento}||${anio}`);
      if (!agg?.count) return;
      const avgFraction = agg.totalFraction / agg.count;
      totalGeneral += avgFraction * weightPerYear;
    });
  });
  const ejecucionGeneral = lineamientos.length ? Number((totalGeneral / lineamientos.length).toFixed(2)) : 0;

  const cumplimientoRows = macroactividades.map((macroactividad) => {
    const byYear = {};
    years.forEach((anio) => {
      byYear[anio] = avgByMacroactividadYear.get(`${macroactividad}||${anio}`) ?? null;
    });
    const values = Object.values(byYear).filter((value) => value !== null && value > 0);
    const total = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2)) : 0;
    return { macroactividad, byYear, total };
  });

  const cumplimientoTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const agg = yearAgg.get(anio);
      if (!agg?.count) return [anio, null];
      const avg = agg.total / agg.count;
      return [anio, Number(avg.toFixed(2))];
    })
  );

  const ejecucionRows = macroactividades.map((macroactividad) => {
    const byYear = {};
    years.forEach((anio) => {
      const avg = avgByMacroactividadYear.get(`${macroactividad}||${anio}`);
      byYear[anio] = avg === undefined ? null : Number((((avg / 100) * weightPerYear)).toFixed(2));
    });
    const values = Object.values(byYear).filter((value) => value !== null);
    const total = values.length ? Number(values.reduce((acc, value) => acc + value, 0).toFixed(2)) : 0;
    return { macroactividad, byYear, total };
  });

  const ejecucionTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const divisor = (Array.from(lineamientosSet).filter((lineamiento) => {
        const agg = lineamientoYearAgg.get(`${lineamiento}||${anio}`);
        return Boolean(agg?.count);
      }).length) || Math.max(lineamientos.length, 1);
      const totalAnio = lineamientos.reduce((acc, lineamiento) => {
        const agg = lineamientoYearAgg.get(`${lineamiento}||${anio}`);
        if (!agg?.count) return acc;
        const avgFraction = agg.totalFraction / agg.count;
        return acc + (avgFraction * weightPerYear);
      }, 0);
      return [anio, Number((totalAnio / divisor).toFixed(2))];
    })
  );

  return {
    years,
    macroactividades,
    totalMacroactividades,
    missingMacroactivityCodes,
    promActividadesPed,
    ejecucionGeneral,
    cumplimientoRows,
    cumplimientoTotalsByYear,
    cumplimientoGeneral: promActividadesPed,
    ejecucionRows,
    ejecucionTotalsByYear,
    ejecucionGeneralProm: ejecucionGeneral,
    weightPerYear,
    numLineamientos: lineamientos.length || 1
  };
};

const buildObjetivosStats = (rows = []) => {
  const weightPerYear = PED_YEAR_WEIGHT;
  const years = Array.from(new Set(rows.map((row) => Number(row.anio)).filter((value) => Number.isFinite(value)))).sort((a, b) => a - b);
  const objetivos = Array.from(new Set(rows.map((row) => row.objetivo_estrategico).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  const lineamientos = Array.from(new Set(rows.map((row) => row.lineamiento_estrategico).filter(Boolean)));

  const avgByObjetivoYear = new Map();
  objetivos.forEach((objetivo) => {
    years.forEach((anio) => {
      const subset = rows.filter((row) => row.objetivo_estrategico === objetivo && Number(row.anio) === anio);
      if (!subset.length) return;
      const avgPercent = subset.reduce((acc, row) => acc + (percent(row.avance_total) || 0), 0) / subset.length;
      avgByObjetivoYear.set(`${objetivo}||${anio}`, Number(avgPercent.toFixed(2)));
    });
  });

  const totalActividades = years.reduce((acc, anio) => {
    const set = new Set(rows.filter((row) => Number(row.anio) === anio).map((row) => row.actividad).filter(Boolean));
    return acc + set.size;
  }, 0);

  const promObjetivos = objetivos.length
    ? Number((
      objetivos.reduce((acc, objetivo) => {
        const subset = rows.filter((row) => row.objetivo_estrategico === objetivo);
        if (!subset.length) return acc;
        const avgFraction = subset.reduce((sum, row) => sum + ((percent(row.avance_total) || 0) / 100), 0) / subset.length;
        return acc + (avgFraction * 100);
      }, 0) / objetivos.length
    ).toFixed(2))
    : 0;

  let totalGeneralLineamientos = 0;
  lineamientos.forEach((lineamiento) => {
    years.forEach((anio) => {
      const subset = rows.filter((row) => row.lineamiento_estrategico === lineamiento && Number(row.anio) === anio);
      if (!subset.length) return;
      const avgFraction = subset.reduce((acc, row) => acc + ((percent(row.avance_total) || 0) / 100), 0) / subset.length;
      totalGeneralLineamientos += avgFraction * weightPerYear;
    });
  });
  const ejecucionGeneral = lineamientos.length ? Number((totalGeneralLineamientos / lineamientos.length).toFixed(2)) : 0;

  const cumplimientoRows = objetivos.map((objetivo) => {
    const byYear = {};
    years.forEach((anio) => {
      byYear[anio] = avgByObjetivoYear.get(`${objetivo}||${anio}`) ?? null;
    });
    const values = Object.values(byYear).filter((value) => value !== null);
    const total = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2)) : 0;
    return { objetivo, byYear, total };
  });

  const cumplimientoTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const values = cumplimientoRows.map((row) => row.byYear[anio]).filter((value) => value !== null);
      const avg = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2)) : 0;
      return [anio, avg];
    })
  );

  const ejecucionRows = objetivos.map((objetivo) => {
    const byYear = {};
    years.forEach((anio) => {
      const avg = avgByObjetivoYear.get(`${objetivo}||${anio}`);
      byYear[anio] = avg === undefined ? null : Number((((avg / 100) * weightPerYear)).toFixed(2));
    });
    const values = Object.values(byYear).filter((value) => value !== null);
    const total = values.length ? Number(values.reduce((acc, value) => acc + value, 0).toFixed(2)) : 0;
    return { objetivo, byYear, total };
  });

  const ejecucionTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const totalAnio = lineamientos.reduce((acc, lineamiento) => {
        const subset = rows.filter((row) => row.lineamiento_estrategico === lineamiento && Number(row.anio) === anio);
        if (!subset.length) return acc;
        const avgFraction = subset.reduce((sum, row) => sum + ((percent(row.avance_total) || 0) / 100), 0) / subset.length;
        return acc + (avgFraction * weightPerYear);
      }, 0);
      const promedioAnio = lineamientos.length ? Number((totalAnio / lineamientos.length).toFixed(2)) : 0;
      return [anio, promedioAnio];
    })
  );

  const promedioGeneralEjecucion = lineamientos.length ? Number((totalGeneralLineamientos / lineamientos.length).toFixed(2)) : 0;

  return {
    years,
    objetivos,
    totalObjetivos: 3,
    totalActividades,
    promObjetivos,
    ejecucionGeneral,
    cumplimientoRows,
    cumplimientoTotalsByYear,
    cumplimientoGeneral: promObjetivos,
    ejecucionRows,
    ejecucionTotalsByYear,
    ejecucionGeneralProm: promedioGeneralEjecucion,
    weightPerYear,
    numLineamientos: lineamientos.length || 1
  };
};

function SectionTitle({ title, subtitle }) {
  return (
    <Box sx={{ mb: 1.8 }}>
      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 0.7 }}>
        <Box sx={{ width: 5, height: 22, borderRadius: 99, bgcolor: '#3b82f6' }} />
        <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#0f172a', letterSpacing: 0.4, textTransform: 'uppercase' }}>
          {title}
        </Typography>
      </Stack>
      {subtitle && (
        <Typography variant="body2" sx={{ color: '#64748b', ml: 2.1 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

function MetricCard({ label, value, icon, color, gradient, shadow, suffix = '' }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.8,
        borderRadius: 3,
        border: `1px solid ${color}22`,
        background: '#fff',
        boxShadow: '0 12px 30px rgba(15,23,42,.06)',
        transition: 'transform .25s ease, box-shadow .25s ease',
        '&:hover': { transform: 'translateY(-5px)', boxShadow: `0 18px 40px ${shadow}` }
      }}
    >
      <Box sx={{ width: 58, height: 58, borderRadius: 2.5, display: 'grid', placeItems: 'center', background: gradient, boxShadow: `0 12px 25px ${shadow}`, mb: 1.8 }}>
        {icon}
      </Box>
      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, mb: 1 }}>
        {label}
      </Typography>
      <Typography sx={{ fontSize: 40, lineHeight: 1, fontWeight: 900, color, letterSpacing: -1.5 }}>
        {suffix ? formatPercent(value) : formatNumber(value)}
      </Typography>
    </Paper>
  );
}

function HeroBanner({ compact, onBack }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? { xs: 1.8, md: 2.2 } : { xs: 2.6, md: 3.2 },
        borderRadius: 4,
        background: 'linear-gradient(90deg,#1d4ed8 0%,#4f7df0 52%,#f05261 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(191,219,254,.55)',
        boxShadow: '0 18px 42px rgba(37,99,235,.18)'
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          right: { xs: -80, md: -40 },
          top: { xs: -60, md: -90 },
          width: { xs: 220, md: 320 },
          height: { xs: 220, md: 320 },
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.18) 0%, rgba(255,255,255,.06) 48%, rgba(255,255,255,0) 72%)'
        }}
      />
      <Box
        sx={{
          position: 'absolute',
          left: '24%',
          bottom: -80,
          width: 220,
          height: 220,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,.12) 0%, rgba(255,255,255,0) 68%)'
        }}
      />

      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        spacing={compact ? 1.6 : 2.4}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'center' }}
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <Box sx={{ maxWidth: 840 }}>
          {compact && onBack ? (
            <Button
              size="small"
              variant="outlined"
              startIcon={<ArrowBackIcon sx={{ fontSize: 14 }} />}
              onClick={onBack}
              sx={{
                color: 'white',
                borderColor: 'rgba(255,255,255,.3)',
                background: 'rgba(255,255,255,.08)',
                textTransform: 'none',
                fontWeight: 700,
                fontSize: 11.5,
                borderRadius: 2,
                mb: 1.2,
                px: 1.5,
                py: 0.4,
                backdropFilter: 'blur(4px)',
                '&:hover': {
                  background: 'rgba(255,255,255,.2)',
                  borderColor: 'rgba(255,255,255,.5)'
                }
              }}
            >
              Volver a Submódulos
            </Button>
          ) : (
            <Box
              sx={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: compact ? 0.6 : 0.9,
                px: compact ? 0.9 : 1.2,
                py: compact ? 0.4 : 0.65,
                borderRadius: 999,
                mb: compact ? 0.8 : 1.5,
                bgcolor: 'rgba(15,23,42,.18)',
                border: '1px solid rgba(255,255,255,.18)'
              }}
            >
              <ShowChartIcon sx={{ fontSize: compact ? 12 : 16 }} />
              <Typography sx={{ fontSize: compact ? 10 : 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {'Planeaci\u00f3n y Efectividad'}
              </Typography>
            </Box>
          )}

          <Typography sx={{ fontSize: compact ? { xs: 18, md: 24 } : { xs: 24, md: 36 }, lineHeight: 1.02, fontWeight: 800, letterSpacing: -0.5 }}>
            {'PLAN ESTRAT\u00c9GICO DE DESARROLLO'}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.92)', mt: compact ? 0.5 : 1, fontSize: compact ? { xs: 12, md: 13.5 } : { xs: 14, md: 16 }, maxWidth: 760 }}>
            {'Monitoreo estrat\u00e9gico, control y resultados basados en evidencia, bajo un marco metodol\u00f3gico de mejora continua.'}
          </Typography>
        </Box>

        <Paper
          elevation={0}
          sx={{
            px: compact ? 2 : 2.8,
            py: compact ? 1 : 1.5,
            borderRadius: 999,
            bgcolor: 'rgba(255,255,255,.97)',
            minWidth: compact ? { xs: '100%', sm: 160 } : { xs: '100%', sm: 220 }
          }}
        >
          <Typography sx={{ fontSize: compact ? 9 : 11, color: '#64748b', fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            La meta es
          </Typography>
          <Typography sx={{ fontSize: compact ? 18 : 24, color: '#ef4444', fontWeight: 900, letterSpacing: 1 }}>
            INNOVAR
          </Typography>
        </Paper>
      </Stack>
    </Paper>
  );
}

function FilterBar({ filters, options, onChange, onReset }) {
  const smartFilterOptions = useCallback((availableOptions, state) => {
    const query = normalizeCatalogKey(state.inputValue);
    if (!query) return availableOptions;

    const terms = query.split(' ').filter(Boolean);
    return availableOptions
      .filter((option) => {
        const normalizedOption = normalizeCatalogKey(option);
        return terms.every((term) => normalizedOption.includes(term));
      })
      .sort((left, right) => {
        const normalizedLeft = normalizeCatalogKey(left);
        const normalizedRight = normalizeCatalogKey(right);
        const leftStarts = normalizedLeft.startsWith(query) ? 0 : 1;
        const rightStarts = normalizedRight.startsWith(query) ? 0 : 1;
        return leftStarts - rightStarts || normalizedLeft.localeCompare(normalizedRight, 'es', { numeric: true });
      });
  }, []);

  const responsableOptions = options.responsables || [];
  const yearOptions = (options.anios || []).map(String);

  return (
    <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <Autocomplete
          fullWidth
          autoHighlight
          clearOnEscape
          options={responsableOptions}
          value={filters.responsable || null}
          onChange={(_, value) => onChange('responsable', value || '')}
          filterOptions={smartFilterOptions}
          noOptionsText="No se encontraron responsables"
          isOptionEqualToValue={(option, value) => option === value}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Responsable de Ejecución"
              placeholder="Escribe un nombre o dependencia"
              helperText={filters.responsable ? 'Filtro aplicado' : 'Todos los responsables'}
            />
          )}
        />

        <Autocomplete
          fullWidth
          autoHighlight
          clearOnEscape
          options={yearOptions}
          value={filters.anio ? String(filters.anio) : null}
          onChange={(_, value) => onChange('anio', value || '')}
          filterOptions={smartFilterOptions}
          noOptionsText="No se encontró el año"
          isOptionEqualToValue={(option, value) => option === value}
          renderInput={(params) => (
            <TextField
              {...params}
              label="Año"
              placeholder="Escribe el año"
              helperText={filters.anio ? 'Filtro aplicado' : 'Todos los años'}
            />
          )}
        />

      </Box>

      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mt: 1.5, flexWrap: 'wrap' }}>
        <Chip icon={<CalendarMonthIcon />} label={`Años: ${(options.anios || []).length}`} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 800 }} />
        <Button startIcon={<FilterAltOffIcon />} onClick={onReset} sx={{ textTransform: 'none', fontWeight: 800 }}>
          Limpiar filtros
        </Button>
      </Stack>
    </Paper>
  );
}

function EstadisticaTab({ rows, metrics }) {
  const estadoChart = useMemo(() => ([
    { label: 'Sin iniciar', total: metrics.pendientes, color: '#ef4444' },
    { label: 'En ejecución', total: metrics.enProceso, color: '#f59e0b' },
    { label: 'Completados', total: metrics.cumplidos, color: '#10b981' }
  ]), [metrics]);

  const anioChart = useMemo(() => {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.anio || 'Sin año';
      const current = map.get(key) || { anio: String(key), avance: 0, total: 0 };
      current.avance += percent(row.avance_total) || 0;
      current.total += 1;
      map.set(key, current);
    });
    return Array.from(map.values())
      .map((item) => ({ anio: item.anio, avance: Number((item.avance / Math.max(item.total, 1)).toFixed(2)) }))
      .sort((a, b) => Number(a.anio) - Number(b.anio));
  }, [rows]);

  return (
    <Stack spacing={3}>
      <Box>
        <SectionTitle title="Estadística Planes de Acción" subtitle="Resumen ejecutivo de estructura, avance y ejecución general del PED." />
        <Box sx={{ display: 'grid', gap: 2.2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: 'repeat(4,1fr)' } }}>
          {STRUCTURE_CARDS.map((card) => <MetricCard key={card.key} {...card} value={metrics[card.key]} />)}
        </Box>
      </Box>

      <Box>
        <SectionTitle title="Estado de Avance" subtitle="Semáforo general de actividades e indicadores del Plan de Acción." />
        <Box sx={{ display: 'grid', gap: 2.2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', xl: 'repeat(4,1fr)' } }}>
          {STATUS_CARDS.map((card) => <MetricCard key={card.key} {...card} value={metrics[card.key]} />)}
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.2, gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
        <Paper elevation={0} sx={{ p: { xs: 1.5, md: 1.8 }, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <SectionTitle title="Distribución por Estado" subtitle="Cantidad de registros según el avance total reportado." />
          <Box sx={{ width: '100%', height: { xs: 250, md: 280 } }}>
            <ResponsiveContainer>
              <BarChart data={estadoChart} margin={{ top: 24, right: 8, left: -8, bottom: 0 }} barCategoryGap="24%">
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis allowDecimals={false} width={44} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} domain={[0, (dataMax) => Math.ceil(Math.max(dataMax * 1.15, 1))]} />
                <RechartsTooltip formatter={(value) => [formatNumber(value), 'Registros']} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]} maxBarSize={140}>
                  {estadoChart.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                  <LabelList dataKey="total" position="top" offset={8} style={{ fontSize: 12, fontWeight: 800, fill: '#1e293b' }} formatter={(v) => formatNumber(v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.5, md: 1.8 }, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <SectionTitle title="Avance Promedio por Año" subtitle="Promedio del avance total según el año de planeación." />
          <Box sx={{ width: '100%', height: { xs: 250, md: 280 } }}>
            <ResponsiveContainer>
              <BarChart data={anioChart} margin={{ top: 24, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="anio" tick={{ fontSize: 11, fill: '#64748b' }} axisLine={{ stroke: '#cbd5e1' }} tickLine={false} />
                <YAxis domain={[0, 100]} width={48} tick={{ fontSize: 11, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${value}%`} />
                <RechartsTooltip formatter={(value) => [formatPercent(value), 'Avance promedio']} />
                <Bar dataKey="avance" fill="#2563eb" radius={[8, 8, 0, 0]} maxBarSize={140}>
                  <LabelList dataKey="avance" position="top" offset={8} style={{ fontSize: 12, fontWeight: 800, fill: '#1e293b' }} formatter={(v) => formatPercent(v)} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>
      </Box>
    </Stack>
  );
}

function PlanesAccionTab({ rows }) {
  const [detailLimit, setDetailLimit] = useState(24);
  const rowsSorted = useMemo(
    () => [...rows].sort((a, b) => String(a.responsable || '').localeCompare(String(b.responsable || ''), 'es') || String(a.indicador || a.actividad || '').localeCompare(String(b.indicador || b.actividad || ''), 'es')),
    [rows]
  );
  const visibleRows = useMemo(() => rowsSorted.slice(0, detailLimit), [rowsSorted, detailLimit]);
  useEffect(() => {
    setDetailLimit(24);
  }, [rows]);
  const selectedResponsable = rows.length === 1 || (rows.length > 1 && rows.every((row) => (row.responsable || '') === (rows[0]?.responsable || '')))
    ? (rows[0]?.responsable || '')
    : '';
  const selectedAnio = rows.length === 1 || (rows.length > 1 && rows.every((row) => String(row.anio || '') === String(rows[0]?.anio || '')))
    ? (rows[0]?.anio || '')
    : '';

  const textoResponsable = selectedResponsable || 'Todos los Responsables';
  const textoAnio = selectedAnio || 'Todos los Años';

  const totalPlanesAccion = new Set(rows.map((row) => row.responsable).filter(Boolean)).size;
  const totalIndicadores = rows.length;
  const cumplidos = rows.filter((row) => resolveEstado(row.avance_total) === 'Completado').length;
  const enProceso = rows.filter((row) => resolveEstado(row.avance_total) === 'En ejecución').length;
  const pendientes = rows.filter((row) => resolveEstado(row.avance_total) === 'Sin iniciar').length;

  const valoresIP = rows.map((row) => percent(row.avance_ip)).filter((value) => value !== null);
  const valoresIIP = rows.map((row) => percent(row.avance_iip)).filter((value) => value !== null);
  const valoresTotales = rows.map((row) => percent(row.avance_total)).filter((value) => value !== null);
  const monitoreoIP = valoresIP.length
    ? Number((valoresIP.reduce((acc, value) => acc + value, 0) / valoresIP.length).toFixed(2))
    : 0;
  const monitoreoIIP = valoresIIP.length
    ? Number((valoresIIP.reduce((acc, value) => acc + value, 0) / valoresIIP.length).toFixed(2))
    : 0;
  const avanceGeneral = valoresTotales.length
    ? Number((valoresTotales.reduce((acc, value) => acc + value, 0) / valoresTotales.length).toFixed(2))
    : 0;

  const pctCumplidos = totalIndicadores ? Number(((cumplidos * 100) / totalIndicadores).toFixed(1)) : 0;
  const pctEnProceso = totalIndicadores ? Number(((enProceso * 100) / totalIndicadores).toFixed(1)) : 0;
  const pctPendientes = totalIndicadores ? Number(((pendientes * 100) / totalIndicadores).toFixed(1)) : 0;

  const getProgressTone = (value, hasData = true) => {
    if (!hasData) return { color: '#94a3b8', bg: '#f1f5f9', status: 'SIN DATOS' };
    if (value >= 80) return { color: '#059669', bg: '#d1fae5', status: 'ÓPTIMO' };
    if (value >= 50) return { color: '#d97706', bg: '#fef3c7', status: 'AVANZANDO' };
    if (value > 0) return { color: '#dc2626', bg: '#fee2e2', status: 'INICIANDO' };
    return { color: '#64748b', bg: '#f1f5f9', status: 'SIN INICIAR' };
  };

  const ipTone = getProgressTone(monitoreoIP, valoresIP.length > 0);
  const iipTone = getProgressTone(monitoreoIIP, valoresIIP.length > 0);

  if (!totalIndicadores) {
    return (
      <Paper elevation={0} sx={{ p: 5, borderRadius: 4, border: '1px solid #e2e8f0', textAlign: 'center' }}>
        <Typography sx={{ fontSize: 22, fontWeight: 900, color: '#1e3a8a', mb: 1 }}>Sin indicadores</Typography>
        <Typography sx={{ color: '#64748b' }}>
          No hay datos para los filtros seleccionados en el dashboard de plan de acción.
        </Typography>
      </Paper>
    );
  }

  return (
    <Stack spacing={2}>
      <Paper elevation={0} sx={{ borderRadius: 4, overflow: 'hidden', border: '1px solid #dbeafe', boxShadow: '0 18px 40px rgba(15,23,42,.08)' }}>
        <Box sx={{ position: 'relative', p: { xs: 2, md: 2.2 }, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)', color: 'white' }}>
          <Box sx={{ position: 'absolute', right: 18, top: 14, px: 1.4, py: 0.7, borderRadius: 2, bgcolor: 'rgba(255,255,255,.15)' }}>
            <Typography sx={{ fontSize: 9, color: 'rgba(255,255,255,.72)', textTransform: 'uppercase', letterSpacing: 1 }}>Actualizado</Typography>
            <Typography sx={{ fontSize: 11.5, fontWeight: 800 }}>{new Date().toLocaleDateString('es-CO')}</Typography>
          </Box>
          <Typography sx={{ display: 'inline-flex', px: 1.3, py: 0.45, borderRadius: 999, bgcolor: 'rgba(255,255,255,.14)', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.3, mb: 0.9 }}>
            Dashboard Interactivo
          </Typography>
          <Typography sx={{ fontSize: { xs: 25, md: 29 }, fontWeight: 900, lineHeight: 1.05 }}>
            Plan de Acción {textoAnio}
          </Typography>
          <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mt: 0.9 }}>
            <AssignmentTurnedInIcon sx={{ color: '#fbbf24', fontSize: 20 }} />
            <Typography sx={{ fontSize: 15, fontWeight: 800, color: '#fde68a' }}>
              {textoResponsable}
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 2.2 }, display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(5, minmax(0, 1fr))' }, alignItems: 'stretch', bgcolor: '#f8fafc' }}>
          <Paper elevation={0} sx={{ p: 1.6, minHeight: 168, borderRadius: 3, border: '1px solid #dbe3ef', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
                <InsightsIcon sx={{ color: 'white', fontSize: 21 }} />
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                Total Indicadores
              </Typography>
            </Stack>
            <Stack spacing={0.9}>
              <Typography sx={{ fontSize: 32, lineHeight: 1, fontWeight: 900, color: '#1e3a8a' }}>{formatNumber(totalIndicadores)}</Typography>
              <Stack spacing={0.55}>
                {[
                  ['Cumplidos', pctCumplidos, cumplidos, '#10b981'],
                  ['En Proceso', pctEnProceso, enProceso, '#f59e0b'],
                  ['Pendientes', pctPendientes, pendientes, '#ef4444']
                ].map(([label, pct, total, color]) => (
                  <Stack key={label} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ width: 68, fontSize: 9.5, color: '#64748b', fontWeight: 800 }}>{label}</Typography>
                    <Box sx={{ flex: 1, height: 6, borderRadius: 99, bgcolor: 'rgba(148,163,184,.18)', overflow: 'hidden' }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 99 }} />
                    </Box>
                    <Typography sx={{ minWidth: 26, textAlign: 'right', color, fontWeight: 900, fontSize: 10.5 }}>{total}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.6, minHeight: 168, borderRadius: 3, border: '1px solid #ddd6fe', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#7c3aed' }}>
                <AssignmentTurnedInIcon sx={{ color: 'white', fontSize: 21 }} />
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                Planes de Acción
              </Typography>
            </Stack>
            <Box>
              <Typography sx={{ fontSize: 34, lineHeight: 1, fontWeight: 900, color: '#7c3aed' }}>{formatNumber(totalPlanesAccion)}</Typography>
              <Typography sx={{ mt: 0.6, fontSize: 10.5, color: '#64748b' }}>Responsables con plan</Typography>
            </Box>
          </Paper>

          {[
            ['Monitoreo IP', monitoreoIP, ipTone, 'Primer Período'],
            ['Monitoreo IIP', monitoreoIIP, iipTone, 'Segundo Período']
          ].map(([label, value, tone, subtitle]) => (
            <Paper key={label} elevation={0} sx={{ p: 1.6, minHeight: 168, borderRadius: 3, border: `1px solid ${tone.color}40`, borderTop: `4px solid ${tone.color}`, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="flex-start" sx={{ mb: 0.8 }}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    background: `linear-gradient(135deg, ${tone.color}, ${tone.color}bb)`
                  }}
                >
                  <CheckCircleIcon sx={{ color: 'white', fontSize: 21 }} />
                </Box>
                <Chip label={tone.status} size="small" sx={{ bgcolor: tone.bg, color: tone.color, fontSize: 9, fontWeight: 900, height: 25 }} />
              </Stack>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: 31, lineHeight: 1, fontWeight: 900, color: tone.color, mt: 0.35 }}>{formatPercent(value)}</Typography>
              <Typography sx={{ mt: 0.35, fontSize: 10.5, color: '#94a3b8' }}>{subtitle}</Typography>
              <Box sx={{ mt: 0.7, height: 6, borderRadius: 99, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                <Box sx={{ width: `${Math.min(Math.max(value, 0), 100)}%`, height: '100%', bgcolor: tone.color, borderRadius: 99 }} />
              </Box>
            </Paper>
          ))}

          <Paper elevation={0} sx={{ p: 1.6, minHeight: 168, borderRadius: 3, color: 'white', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.8 }}>
              <Box sx={{ width: 36, height: 36, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.25)' }}>
                <TrendingUpIcon sx={{ color: 'white', fontSize: 21 }} />
              </Box>
              <Typography sx={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,.78)', textTransform: 'uppercase', letterSpacing: 0.7 }}>
                Avance General
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 33, lineHeight: 1, fontWeight: 900 }}>{formatPercent(avanceGeneral)}</Typography>
            <Box sx={{ mt: 0.8, height: 7, borderRadius: 99, bgcolor: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
              <Box sx={{ width: `${Math.min(avanceGeneral, 100)}%`, height: '100%', bgcolor: 'rgba(255,255,255,.92)', borderRadius: 99 }} />
            </Box>
            <Typography sx={{ mt: 0.6, fontSize: 10.5, color: 'rgba(255,255,255,.72)' }}>Promedio Total</Typography>
          </Paper>
        </Box>

        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 2.2, py: 1.5, bgcolor: '#fff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ width: 5, height: 24, borderRadius: 99, background: 'linear-gradient(180deg, #fbbf24, #f59e0b)' }} />
          <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>Detalle de Indicadores</Typography>
        </Stack>

        <Box sx={{ p: { xs: 1, md: 1.4 }, bgcolor: '#f8fafc', maxHeight: 720, overflowY: 'auto' }}>
          <Stack spacing={1}>
            {visibleRows.map((row) => {
              const ip = percent(row.avance_ip) || 0;
              const iipReal = percent(row.avance_iip) || 0;
              const esAutoIip = ip >= 100;
              const iip = esAutoIip ? 100 : iipReal;
              const total = percent(row.avance_total) || 0;
              const totalTone = getProgressTone(total);
              const ipTone = getProgressTone(ip);
              const iipTone = esAutoIip ? { color: '#059669', bg: '#d1fae5' } : getProgressTone(iip);
              return (
                <Paper
                  key={row.id}
                  elevation={0}
                  sx={{
                    p: { xs: 1.25, md: 1.5 },
                    borderRadius: 2.5,
                    border: '1px solid #e2e8f0',
                    borderLeft: `4px solid ${totalTone.color}`,
                    boxShadow: '0 2px 8px rgba(15,23,42,.035)'
                  }}
                >
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'flex-start' }} sx={{ mb: 1 }}>
                    <Stack spacing={0.55} sx={{ minWidth: 0, flex: 1 }}>
                      {!selectedResponsable && (
                        <Chip
                          label={row.responsable || 'Sin responsable'}
                          size="small"
                          sx={{ width: 'fit-content', height: 24, bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 800, fontSize: 10.5 }}
                        />
                      )}
                      <Typography sx={{ fontSize: { xs: 12.5, md: 13.5 }, lineHeight: 1.35, fontWeight: 900, color: '#1e3a8a', overflowWrap: 'anywhere' }}>
                        {row.indicador || row.actividad || '-'}
                      </Typography>
                    </Stack>

                    <Chip
                      label={total >= 100 ? 'Cumplido' : total > 0 ? 'En Proceso' : 'Pendiente'}
                      size="small"
                      sx={{ alignSelf: 'flex-start', height: 26, bgcolor: totalTone.bg, color: totalTone.color, fontWeight: 900, fontSize: 10.5 }}
                    />
                  </Stack>

                  <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, .9fr) minmax(560px, 1.7fr)' }, alignItems: 'stretch' }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', display: 'grid', gap: 0.65 }}>
                      <Box>
                        <Typography sx={{ fontSize: 9.5, lineHeight: 1.2, color: '#1e40af', fontWeight: 900, textTransform: 'uppercase' }}>Lineamiento</Typography>
                        <Typography sx={{ mt: 0.2, fontSize: 11, lineHeight: 1.35, color: '#475569' }}>{row.lineamiento_estrategico || '-'}</Typography>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 9.5, lineHeight: 1.2, color: '#1e40af', fontWeight: 900, textTransform: 'uppercase' }}>Objetivo</Typography>
                        <Typography sx={{ mt: 0.2, fontSize: 11, lineHeight: 1.35, color: '#475569' }}>{row.objetivo_estrategico || '-'}</Typography>
                      </Box>
                      {(row.observaciones_ip || row.observaciones_iip) && (
                        <Box sx={{ pt: 0.55, borderTop: '1px dashed #fde68a' }}>
                          <Typography sx={{ fontSize: 9.5, color: '#a16207', fontWeight: 900, textTransform: 'uppercase' }}>Observaciones</Typography>
                          <Typography sx={{ mt: 0.2, fontSize: 10.5, lineHeight: 1.35, color: '#713f12' }}>{row.observaciones_ip || row.observaciones_iip}</Typography>
                        </Box>
                      )}
                    </Box>

                    <Box sx={{ display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(4, minmax(0, 1fr))' } }}>
                      <Paper elevation={0} sx={{ p: 1, minHeight: 82, borderRadius: 2, textAlign: 'left', bgcolor: '#eff6ff', border: '1px solid #bfdbfe', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: 9, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.35 }}>Meta</Typography>
                        <Typography sx={{ mt: 0.35, fontSize: { xs: 13, md: 14 }, lineHeight: 1.3, color: '#1e40af', fontWeight: 900, overflowWrap: 'anywhere' }}>{row.meta || '-'}</Typography>
                      </Paper>
                      {[
                        ['Período I', ip, ipTone, false],
                        ['Período II', iip, iipTone, esAutoIip]
                      ].map(([label, value, tone, auto]) => (
                        <Paper key={label} elevation={0} sx={{ p: 1, minHeight: 82, borderRadius: 2, textAlign: 'left', bgcolor: '#fff', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                          <Typography sx={{ fontSize: 9, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.35 }}>
                            {label} {auto ? <Box component="span" sx={{ px: 0.5, py: 0.1, borderRadius: 1, bgcolor: '#3b82f6', color: 'white', fontSize: 9 }}>AUTO</Box> : null}
                          </Typography>
                          <Typography sx={{ mt: 0.3, fontSize: 19, lineHeight: 1.1, color: tone.color, fontWeight: 900 }}>{formatPercent(value)}</Typography>
                          <Box sx={{ mt: 0.65, height: 4, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(value, 100)}%`, height: '100%', bgcolor: value > 0 ? tone.color : '#e2e8f0' }} />
                          </Box>
                        </Paper>
                      ))}
                      <Paper elevation={0} sx={{ p: 1, minHeight: 82, borderRadius: 2, textAlign: 'left', bgcolor: totalTone.bg, border: `1px solid ${totalTone.color}40`, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                        <Typography sx={{ fontSize: 9, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.35 }}>Avance Total</Typography>
                        <Typography sx={{ mt: 0.3, fontSize: 20, lineHeight: 1.1, color: totalTone.color, fontWeight: 900 }}>{formatPercent(total)}</Typography>
                        <Box sx={{ mt: 0.65, height: 4, borderRadius: 99, bgcolor: 'rgba(148,163,184,.22)', overflow: 'hidden' }}>
                          <Box sx={{ width: `${Math.min(total, 100)}%`, height: '100%', bgcolor: total > 0 ? totalTone.color : '#cbd5e1' }} />
                        </Box>
                      </Paper>
                    </Box>
                  </Box>
                </Paper>
              );
            })}
          </Stack>
          {rowsSorted.length > detailLimit && (
            <Stack alignItems="center" sx={{ mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setDetailLimit((prev) => prev + 24)}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 999 }}
              >
                {'Mostrar 24 indicadores m\u00e1s'}
              </Button>
            </Stack>
          )}
        </Box>

        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ px: 2.2, py: 1.2, bgcolor: '#0f172a' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#10b981', boxShadow: '0 0 10px #10b981' }} />
            <Typography sx={{ fontSize: 12, color: 'rgba(255,255,255,.74)' }}>
              UNICESMAG — Sistema de Seguimiento Plan de Acción
            </Typography>
          </Stack>
          <Typography sx={{ fontSize: 11, color: 'rgba(255,255,255,.55)' }}>
            Generado: {new Date().toLocaleString('es-CO')}
          </Typography>
          <Alert severity="info" sx={{ mt: 1, borderRadius: 3, bgcolor: 'rgba(255,255,255,.14)', color: 'white', border: '1px solid rgba(255,255,255,.18)', '& .MuiAlert-icon': { color: 'white' } }}>
            Estado actual del dato: este frente guarda borradores en el navegador del equipo. La siguiente fase debe llevarlo a base de datos institucional para operacion multiusuario y trazabilidad.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
}

function MatrixTable({
  title,
  subtitle,
  rows,
  years,
  rowKey,
  totalsByYear,
  generalTotal,
  totalLabel = 'TOTAL',
  footerNote = '',
  initialVisibleRows = null,
  loadMoreStep = 30,
  annualScaleMax = 100,
  totalScaleMax = 100
}) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleRows || rows.length);

  useEffect(() => {
    setVisibleCount(initialVisibleRows || rows.length);
  }, [rows, initialVisibleRows]);

  const visibleRows = initialVisibleRows ? rows.slice(0, visibleCount) : rows;
  const normalizeToScale = useCallback((value, scaleMax = 100) => {
    const numericValue = Number(value || 0);
    const numericMax = Number(scaleMax || 100);
    if (!Number.isFinite(numericValue) || !Number.isFinite(numericMax) || numericMax <= 0) return 0;
    return Math.min(Math.max((numericValue / numericMax) * 100, 0), 100);
  }, []);
  const getMatrixTone = useCallback((value, scaleMax = 100) => {
    const normalized = normalizeToScale(value, scaleMax);
    if (normalized >= 80) return { color: '#10b981', bg: '#d1fae5', normalized };
    if (normalized >= 60) return { color: '#f59e0b', bg: '#fef3c7', normalized };
    return { color: '#ef4444', bg: '#fee2e2', normalized };
  }, [normalizeToScale]);
  const usesWeightedScale = annualScaleMax !== 100;
  const annualGreenThreshold = annualScaleMax * 0.8;
  const annualYellowThreshold = annualScaleMax * 0.6;

  const handleExport = useCallback(() => {
    if (!rows.length) return;

    const generatedAt = new Date();
    const headers = [rowKey, ...years.map(String), totalLabel];
    const exportRows = rows.map((row) => [
      row[rowKey] || '',
      ...years.map((year) => {
        const value = row.byYear?.[year];
        return value === null || value === undefined ? 0 : Number(value) / 100;
      }),
      row.total === null || row.total === undefined ? 0 : Number(row.total) / 100
    ]);
    const totalRow = [
      'PROMEDIO GENERAL',
      ...years.map((year) => {
        const value = totalsByYear?.[year];
        return value === null || value === undefined ? 0 : Number(value) / 100;
      }),
      Number(generalTotal || 0) / 100
    ];
    const aoa = [
      [title],
      [subtitle],
      [`Generado: ${generatedAt.toLocaleString('es-CO')}`],
      [],
      headers,
      ...exportRows,
      totalRow
    ];
    const worksheet = XLSXStyle.utils.aoa_to_sheet(aoa);
    const lastColumn = Math.max(0, headers.length - 1);
    const lastColumnLetter = XLSXStyle.utils.encode_col(lastColumn);
    const totalRowIndex = aoa.length - 1;
    worksheet['!merges'] = [0, 1, 2].map((rowIndex) => ({
      s: { r: rowIndex, c: 0 },
      e: { r: rowIndex, c: lastColumn }
    }));
    worksheet['!autofilter'] = { ref: `A5:${lastColumnLetter}${aoa.length}` };
    worksheet['!freeze'] = { xSplit: 1, ySplit: 5 };
    worksheet['!cols'] = headers.map((header, index) => ({
      wch: index === 0 ? 72 : Math.max(14, String(header).length + 5)
    }));
    worksheet['!rows'] = aoa.map((_, index) => ({ hpt: index === 0 ? 28 : index === 1 ? 22 : index >= 5 ? 34 : 18 }));

    const border = {
      top: { style: 'thin', color: { rgb: 'DBEAFE' } },
      bottom: { style: 'thin', color: { rgb: 'DBEAFE' } },
      left: { style: 'thin', color: { rgb: 'DBEAFE' } },
      right: { style: 'thin', color: { rgb: 'DBEAFE' } }
    };
    const titleStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 16 },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    const subtitleStyle = {
      font: { bold: true, color: { rgb: '1E40AF' }, sz: 11 },
      fill: { fgColor: { rgb: 'DBEAFE' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    const generatedStyle = {
      font: { italic: true, color: { rgb: '64748B' }, sz: 9 },
      fill: { fgColor: { rgb: 'F8FAFC' } },
      alignment: { horizontal: 'left', vertical: 'center' }
    };
    const headerStyle = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
      border
    };
    const labelStyle = (isTotal = false) => ({
      font: { bold: true, color: { rgb: '1E40AF' }, sz: 10 },
      fill: { fgColor: { rgb: isTotal ? 'DBEAFE' : 'FFFFFF' } },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border
    });
    const metricStyle = (rawValue, isTotal = false, scaleMax = 100) => {
      const numeric = typeof rawValue === 'number' ? rawValue * 100 : null;
      const normalized = numeric === null ? null : normalizeToScale(numeric, scaleMax);
      const color = normalized === null ? '94A3B8' : normalized >= 80 ? '059669' : normalized >= 60 ? 'D97706' : 'DC2626';
      const fill = normalized === null ? 'F1F5F9' : normalized >= 80 ? 'D1FAE5' : normalized >= 60 ? 'FEF3C7' : 'FEE2E2';
      return {
        font: { bold: true, color: { rgb: color }, sz: isTotal ? 12 : 11 },
        fill: { fgColor: { rgb: fill } },
        alignment: { horizontal: 'center', vertical: 'center' },
        border,
        ...(numeric === null ? {} : { numFmt: '0.00%' })
      };
    };

    const range = XLSXStyle.utils.decode_range(worksheet['!ref']);
    for (let r = range.s.r; r <= range.e.r; r += 1) {
      for (let c = range.s.c; c <= range.e.c; c += 1) {
        const address = XLSXStyle.utils.encode_cell({ r, c });
        const cell = worksheet[address];
        if (!cell) continue;
        if (r === 0) cell.s = titleStyle;
        else if (r === 1) cell.s = subtitleStyle;
        else if (r === 2) cell.s = generatedStyle;
        else if (r === 4) cell.s = headerStyle;
        else if (r >= 5) cell.s = c === 0
          ? labelStyle(r === totalRowIndex)
          : metricStyle(cell.v, r === totalRowIndex, c === lastColumn ? totalScaleMax : annualScaleMax);
      }
    }

    const workbook = XLSXStyle.utils.book_new();
    const sheetName = String(rowKey || 'Datos').replace(/[\\/?*:[\]]/g, ' ').slice(0, 31) || 'Datos';
    XLSXStyle.utils.book_append_sheet(workbook, worksheet, sheetName);
    const safeName = `${title}_${subtitle}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toLowerCase();
    XLSXStyle.writeFile(workbook, `${safeName || 'plan_estrategico'}_${generatedAt.toISOString().slice(0, 10)}.xlsx`);
  }, [annualScaleMax, generalTotal, normalizeToScale, rowKey, rows, subtitle, title, totalLabel, totalScaleMax, totalsByYear, years]);

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe', overflow: 'hidden', boxShadow: '0 4px 20px rgba(59,130,246,.12)' }}>
      <Box sx={{ p: 2.3, color: 'white', background: 'linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#60a5fa 100%)' }}>
        <Typography sx={{ fontSize: 23, fontWeight: 900 }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, opacity: 0.95 }}>{subtitle}</Typography>
      </Box>
      <Box sx={{ p: 2, bgcolor: 'linear-gradient(180deg,#fff 0%,#f0f9ff 100%)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
          <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: '#10b981', borderRadius: 1 }} />
              <Typography sx={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>
                {usesWeightedScale ? `Óptimo ≥ ${formatPercent(annualGreenThreshold)}` : '≥80%'}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: '#f59e0b', borderRadius: 1 }} />
              <Typography sx={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>
                {usesWeightedScale ? `Avance ${formatPercent(annualYellowThreshold)}–${formatPercent(annualGreenThreshold)}` : '60-79%'}
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Box sx={{ width: 16, height: 16, bgcolor: '#ef4444', borderRadius: 1 }} />
              <Typography sx={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>
                {usesWeightedScale ? `Bajo < ${formatPercent(annualYellowThreshold)}` : '<60%'}
              </Typography>
            </Stack>
          </Stack>
          <Button
            variant="outlined"
            size="small"
            startIcon={<DownloadIcon />}
            onClick={handleExport}
            disabled={!rows.length}
            sx={{ alignSelf: { xs: 'stretch', sm: 'center' }, borderRadius: 2, px: 1.8, py: 0.75, textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap', bgcolor: 'white' }}
          >
            Exportar datos
          </Button>
        </Stack>
      </Box>
      <TableContainer sx={{ maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ minWidth: 280, fontWeight: 900, bgcolor: '#2563eb', color: 'white' }}>{rowKey}</TableCell>
              {years.map((year) => (
                <TableCell key={year} align="center" sx={{ fontWeight: 900, bgcolor: '#2563eb', color: 'white' }}>
                  <Typography sx={{ fontSize: 15, fontWeight: 900 }}>{year}</Typography>
                  <Typography sx={{ fontSize: 10, opacity: 0.85 }}>Año</Typography>
                </TableCell>
              ))}
              <TableCell align="center" sx={{ fontWeight: 900, bgcolor: '#2563eb', color: 'white' }}>{totalLabel}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={row[rowKey]} hover>
                <TableCell sx={{ fontWeight: 700, color: '#1e40af' }}>{row[rowKey]}</TableCell>
                {years.map((year) => {
                  const value = row.byYear[year] ?? 0;
                  const tone = getMatrixTone(value, annualScaleMax);
                  return (
                    <TableCell key={`${row[rowKey]}-${year}`} align="center" sx={{ bgcolor: tone.bg }}>
                      <Typography sx={{ fontSize: 22, fontWeight: 900, color: tone.color }}>{formatPercent(value)}</Typography>
                      <Box sx={{ mt: 0.8, height: 6, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                        <Box sx={{ width: `${tone.normalized}%`, height: '100%', bgcolor: tone.color }} />
                      </Box>
                    </TableCell>
                  );
                })}
                <TableCell align="center" sx={{ bgcolor: getMatrixTone(row.total, totalScaleMax).bg }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, color: getMatrixTone(row.total, totalScaleMax).color }}>
                    {formatPercent(row.total)}
                  </Typography>
                  <Box sx={{ mt: 0.8, height: 8, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                    <Box sx={{ width: `${getMatrixTone(row.total, totalScaleMax).normalized}%`, height: '100%', bgcolor: getMatrixTone(row.total, totalScaleMax).color }} />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: 'linear-gradient(135deg,#dbeafe 0%,#bfdbfe 50%,#93c5fd 100%)' }}>
              <TableCell sx={{ fontWeight: 900, color: '#1e40af' }}>PROMEDIO GENERAL</TableCell>
              {years.map((year) => {
                const value = totalsByYear[year];
                const tone = getMatrixTone(value, annualScaleMax);
                return (
                  <TableCell key={`total-${year}`} align="center" sx={{ bgcolor: tone.bg }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 900, color: tone.color }}>{formatPercent(value)}</Typography>
                    <Box sx={{ mt: 0.8, height: 7, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                      <Box sx={{ width: `${tone.normalized}%`, height: '100%', bgcolor: tone.color }} />
                    </Box>
                  </TableCell>
                );
              })}
              <TableCell align="center" sx={{ bgcolor: getMatrixTone(generalTotal, totalScaleMax).bg }}>
                <Typography sx={{ fontSize: 28, fontWeight: 900, color: getMatrixTone(generalTotal, totalScaleMax).color }}>
                  {formatPercent(generalTotal)}
                </Typography>
                <Box sx={{ mt: 0.8, height: 10, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                  <Box sx={{ width: `${getMatrixTone(generalTotal, totalScaleMax).normalized}%`, height: '100%', bgcolor: getMatrixTone(generalTotal, totalScaleMax).color }} />
                </Box>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TableContainer>
      {initialVisibleRows && rows.length > visibleCount && (
        <Box sx={{ px: 2, py: 1.4, borderTop: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
            <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>
              Mostrando {visibleRows.length} de {rows.length} filas
            </Typography>
            <Button
              variant="outlined"
              onClick={() => setVisibleCount((prev) => Math.min(prev + loadMoreStep, rows.length))}
              sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 999 }}
            >
              {`Mostrar ${Math.min(loadMoreStep, rows.length - visibleCount)} filas m\u00e1s`}
            </Button>
          </Stack>
        </Box>
      )}
      {footerNote && (
        <Box sx={{ p: 1.5, bgcolor: '#f0f9ff', borderTop: '1px solid #bfdbfe' }}>
          <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 700 }}>{footerNote}</Typography>
        </Box>
      )}
    </Paper>
  );
}

function KpiStrip({ cards }) {
  return (
    <Box sx={{ display: 'grid', gap: 1.6, gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, 1fr)' } }}>
      {cards.map((card) => (
        <Paper key={card.label} elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '2px solid #f1f5f9', boxShadow: '0 10px 20px rgba(0,0,0,.05)' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.3 }}>
            <Box sx={{ width: 56, height: 56, borderRadius: 2, display: 'grid', placeItems: 'center', background: card.gradient, boxShadow: `0 8px 20px ${card.shadow}` }}>
              {card.icon}
            </Box>
            <Chip label={card.badge} sx={{ bgcolor: card.badgeBg, color: card.badgeColor, fontWeight: 900, fontSize: 10 }} />
          </Stack>
          <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.6 }}>{card.label}</Typography>
          <Typography sx={{ fontSize: 40, fontWeight: 900, color: card.color, lineHeight: 1, mt: 0.7 }}>{card.value}</Typography>
          <Box sx={{ mt: 1.1, height: 9, borderRadius: 99, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
            <Box sx={{ width: `${Math.min(card.progress, 100)}%`, height: '100%', background: card.gradient }} />
          </Box>
          <Typography sx={{ mt: 1, fontSize: 11, color: '#94a3b8', fontWeight: 700 }}>{card.footer}</Typography>
        </Paper>
      ))}
    </Box>
  );
}

function LineamientosDashboard({ rows }) {
  const stats = useMemo(() => buildLineamientosStats(rows), [rows]);
  const cards = [
    {
      label: 'Total Actividades',
      value: formatNumber(stats.totalActividades),
      progress: 100,
      footer: 'Registradas en el plan',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      shadow: 'rgba(245, 158, 11, 0.25)',
      badge: 'ACTIVIDADES',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      icon: <ListAltIcon sx={{ color: 'white' }} />
    },
    {
      label: 'Cumplimiento',
      value: formatPercent(stats.promLineamientos),
      progress: stats.promLineamientos,
      footer: `Total: ${stats.totalLineamientos} lineamientos`,
      color: '#8b5cf6',
      gradient: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
      shadow: 'rgba(139, 92, 246, 0.25)',
      badge: 'LINEAMIENTOS',
      badgeBg: '#ede9fe',
      badgeColor: '#6d28d9',
      icon: <AccountTreeIcon sx={{ color: 'white' }} />
    },
    {
      label: 'Ejecución PED',
      value: formatPercent(stats.ejecucionGeneral),
      progress: stats.ejecucionGeneral,
      footer: `÷ ${stats.lineamientos.length || 0} lineamientos`,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      shadow: 'rgba(16, 185, 129, 0.25)',
      badge: 'GENERAL',
      badgeBg: '#d1fae5',
      badgeColor: '#047857',
      icon: <TrendingUpIcon sx={{ color: 'white' }} />
    }
  ];

  return (
    <Stack spacing={2.2}>
      <KpiStrip cards={cards} />
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle="Cumplimiento de Lineamientos Estratégicos por Año"
        rows={stats.cumplimientoRows.map((row) => ({ ...row, 'LINEAMIENTOS ESTRATÉGICOS': row.lineamiento }))}
        years={stats.years}
        rowKey="LINEAMIENTOS ESTRATÉGICOS"
        totalsByYear={stats.cumplimientoTotalsByYear}
        generalTotal={stats.cumplimientoGeneral}
      />
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle={`Ejecución Cualitativa de Lineamientos Estratégicos | Cada Año = ${stats.weightPerYear.toFixed(2)}% del total`}
        rows={stats.ejecucionRows.map((row) => ({ ...row, 'LINEAMIENTOS ESTRATÉGICOS': row.lineamiento }))}
        years={stats.years}
        rowKey="LINEAMIENTOS ESTRATÉGICOS"
        totalsByYear={stats.ejecucionTotalsByYear}
        generalTotal={stats.ejecucionGeneralProm}
        annualScaleMax={stats.weightPerYear}
        totalScaleMax={stats.weightPerYear * stats.years.length}
        footerNote={`NOTA: Cada año tiene un máximo ponderado de ${stats.weightPerYear.toFixed(2)}%. Los colores y las barras se calculan tomando ese valor como el 100% anual. El total se evalúa sobre ${(stats.weightPerYear * stats.years.length).toFixed(2)}% para los ${stats.years.length} años visibles.`}
      />
    </Stack>
  );
}

function ObjetivosDashboard({ rows }) {
  const stats = useMemo(() => buildObjetivosStats(rows), [rows]);
  const cards = [
    {
      label: 'Total Actividades',
      value: formatNumber(stats.totalActividades),
      progress: 100,
      footer: 'Registradas en el plan',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      shadow: 'rgba(245, 158, 11, 0.25)',
      badge: 'ACTIVIDADES',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      icon: <ListAltIcon sx={{ color: 'white' }} />
    },
    {
      label: 'Cumplimiento',
      value: formatPercent(stats.promObjetivos),
      progress: stats.promObjetivos,
      footer: `Total: ${stats.totalObjetivos} objetivos`,
      color: '#2563eb',
      gradient: 'linear-gradient(135deg, #2563eb, #1e40af)',
      shadow: 'rgba(37, 99, 235, 0.25)',
      badge: 'OBJETIVOS',
      badgeBg: '#dbeafe',
      badgeColor: '#1e40af',
      icon: <FlagIcon sx={{ color: 'white' }} />
    },
    {
      label: 'Ejecución PED',
      value: formatPercent(stats.ejecucionGeneral),
      progress: stats.ejecucionGeneral,
      footer: `÷ ${stats.numLineamientos} lineamientos`,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      shadow: 'rgba(16, 185, 129, 0.25)',
      badge: 'GENERAL',
      badgeBg: '#d1fae5',
      badgeColor: '#047857',
      icon: <TrendingUpIcon sx={{ color: 'white' }} />
    }
  ];

  return (
    <Stack spacing={2.2}>
      <KpiStrip cards={cards} />
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle="Cumplimiento de Objetivos Estratégicos por Año"
        rows={stats.cumplimientoRows.map((row) => ({ ...row, objetivoLabel: row.objetivo }))}
        years={stats.years}
        rowKey="objetivoLabel"
        totalsByYear={stats.cumplimientoTotalsByYear}
        generalTotal={stats.cumplimientoGeneral}
      />
      <MatrixTable
        title="Ejecución Cualitativa del Plan Estratégico de Desarrollo"
        subtitle={`Evaluación de Objetivos Estratégicos por Año | Cada Año = ${stats.weightPerYear.toFixed(2)}% del total`}
        rows={stats.ejecucionRows.map((row) => ({ ...row, 'OBJETIVOS ESTRATÉGICOS': row.objetivo }))}
        years={stats.years}
        rowKey="OBJETIVOS ESTRATÉGICOS"
        totalsByYear={stats.ejecucionTotalsByYear}
        generalTotal={stats.ejecucionGeneralProm}
        annualScaleMax={stats.weightPerYear}
        totalScaleMax={stats.weightPerYear * stats.years.length}
        footerNote={`NOTA: Cada año tiene un máximo ponderado de ${stats.weightPerYear.toFixed(2)}%. Los colores y las barras se calculan tomando ese valor como el 100% anual. El total se evalúa sobre ${(stats.weightPerYear * stats.years.length).toFixed(2)}% para los ${stats.years.length} años visibles.`}
      />
    </Stack>
  );
}

function ActividadesDashboard({ rows }) {
  const stats = useMemo(() => buildActividadesStats(rows), [rows]);
  const cards = [
    {
      label: 'Total Macroactividades',
      value: formatNumber(stats.totalMacroactividades),
      progress: 100,
      footer: 'Registradas en el PED',
      color: '#f59e0b',
      gradient: 'linear-gradient(135deg, #f59e0b, #d97706)',
      shadow: 'rgba(245, 158, 11, 0.25)',
      badge: 'MACROACTIVIDADES',
      badgeBg: '#fef3c7',
      badgeColor: '#92400e',
      icon: <ListAltIcon sx={{ color: 'white' }} />
    },
    {
      label: 'Cumplimiento',
      value: formatPercent(stats.promActividadesPed),
      progress: stats.promActividadesPed,
      footer: 'Del Plan Estratégico',
      color: '#2563eb',
      gradient: 'linear-gradient(135deg, #2563eb, #1e40af)',
      shadow: 'rgba(37, 99, 235, 0.25)',
      badge: 'MACROACTIVIDADES PED',
      badgeBg: '#dbeafe',
      badgeColor: '#1e40af',
      icon: <CheckCircleIcon sx={{ color: 'white' }} />
    },
    {
      label: 'Ejecución PED',
      value: formatPercent(stats.ejecucionGeneral),
      progress: stats.ejecucionGeneral,
      footer: `÷ ${stats.numLineamientos} lineamientos`,
      color: '#10b981',
      gradient: 'linear-gradient(135deg, #10b981, #059669)',
      shadow: 'rgba(16, 185, 129, 0.25)',
      badge: 'GENERAL',
      badgeBg: '#d1fae5',
      badgeColor: '#047857',
      icon: <TrendingUpIcon sx={{ color: 'white' }} />
    }
  ];

  return (
    <Stack spacing={2.2}>
      <KpiStrip cards={cards} />
      {stats.missingMacroactivityCodes.length > 0 && (
        <Alert severity="warning" sx={{ borderRadius: 3 }}>
          La carga no contiene {stats.missingMacroactivityCodes.join(', ')}. Se muestran y calculan únicamente las macroactividades presentes en los datos.
        </Alert>
      )}
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle="Cumplimiento de Macroactividades Estratégicas por Año"
        rows={stats.cumplimientoRows.map((row) => ({ ...row, 'MACROACTIVIDADES ESTRATÉGICAS': row.macroactividad }))}
        years={stats.years}
        rowKey="MACROACTIVIDADES ESTRATÉGICAS"
        totalsByYear={stats.cumplimientoTotalsByYear}
        generalTotal={stats.cumplimientoGeneral}
        initialVisibleRows={40}
        loadMoreStep={40}
      />
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle={`Ejecución Cualitativa de Macroactividades Estratégicas | Cada Año = ${stats.weightPerYear.toFixed(2)}% del total`}
        rows={stats.ejecucionRows.map((row) => ({ ...row, 'MACROACTIVIDADES ESTRATÉGICAS': row.macroactividad }))}
        years={stats.years}
        rowKey="MACROACTIVIDADES ESTRATÉGICAS"
        totalsByYear={stats.ejecucionTotalsByYear}
        generalTotal={stats.ejecucionGeneralProm}
        initialVisibleRows={40}
        loadMoreStep={40}
        annualScaleMax={stats.weightPerYear}
        totalScaleMax={stats.weightPerYear * stats.years.length}
        footerNote={`NOTA: Cada año tiene un máximo ponderado de ${stats.weightPerYear.toFixed(2)}%. Los colores y las barras se calculan tomando ese valor como el 100% anual. El total se evalúa sobre ${(stats.weightPerYear * stats.years.length).toFixed(2)}% para los ${stats.years.length} años visibles.`}
      />
    </Stack>
  );
}

function SeguimientoTabV2({ rows, filtersNode }) {
  const [subTab, setSubTab] = useState('objetivos');

  return (
    <Stack spacing={2}>
      <SectionTitle
        title="Seguimiento Planes de Acción"
        subtitle={
          subTab === 'objetivos'
            ? 'Monitoreo estratégico del PED por objetivos.'
            : subTab === 'lineamientos'
              ? 'Monitoreo estratégico del PED por lineamientos.'
              : 'Monitoreo estratégico del PED por macroactividades.'
        }
      />

      <Paper
        elevation={0}
        sx={{
          p: 0.55,
          borderRadius: 3.5,
          border: '1px solid #e2e8f0',
          background: '#f8fafc',
          boxShadow: 'none'
        }}
      >
        <Tabs
          value={subTab}
          onChange={(_, next) => setSubTab(next)}
          variant="fullWidth"
          sx={{
            minHeight: 54,
            '& .MuiTabs-indicator': {
              height: 0
            },
            '& .MuiTabs-flexContainer': {
              gap: 0.8,
              width: '100%'
            },
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 800,
              minHeight: 46,
              minWidth: 0,
              flex: 1,
              px: 1.8,
              py: 1.1,
              borderRadius: 999,
              color: '#64748b',
              transition: 'all .2s ease',
              border: '1px solid transparent'
            },
            '& .MuiTab-root.Mui-selected': {
              color: '#1d4ed8',
              background: '#ffffff',
              borderColor: '#bfdbfe',
              boxShadow: '0 6px 16px rgba(37,99,235,.08)'
            },
            '& .MuiTab-root:hover': {
              backgroundColor: '#ffffff'
            },
            '& .MuiTab-iconWrapper': {
              mr: 1
            }
          }}
        >
          <Tab value="objetivos" icon={<FlagIcon fontSize="small" />} iconPosition="start" label="PED por Objetivos" />
          <Tab value="lineamientos" icon={<AccountTreeIcon fontSize="small" />} iconPosition="start" label="PED por Lineamientos" />
          <Tab value="actividades" icon={<TimelineIcon fontSize="small" />} iconPosition="start" label="PED por Macroactividades" />
        </Tabs>
      </Paper>

      {filtersNode}

      {subTab === 'objetivos' && <ObjetivosDashboard rows={rows} />}
      {subTab === 'lineamientos' && <LineamientosDashboard rows={rows} />}
      {subTab === 'actividades' && <ActividadesDashboard rows={rows} />}
    </Stack>
  );
}

function PlaneacionEfectividad() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();

  const isAdmin = user && [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA, ROLES.PLANEACION_EFECTIVIDAD].includes(user.role);
  const dashboards = (user && user.allowedPlanAccionDashboards) || [];
  const canEstadistica = isAdmin || dashboards.includes('plan_accion_estadistica');
  const canAccion = isAdmin || dashboards.includes('plan_accion_gestion') || dashboards.includes('plan_accion_nuevo');

  const createDefaultFilters = () => ({
    mode: 'estadistica',
    anio: '',
    responsable: ''
  });
  const [section, setSection] = useState(null);

  useEffect(() => {
    if (section === null) {
      if (canEstadistica && !canAccion) {
        setSection('estadistica');
      } else if (!canEstadistica && canAccion) {
        setSection('accion');
      }
    }
  }, [canEstadistica, canAccion, section]);

  const [tab, setTab] = useState('estadistica');
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState({ rows: [], filters: { anios: [], peds: [], responsables: [], tiposIndicador: [], estados: [] }, meta: {} });
  const [filtersByTab, setFiltersByTab] = useState({
    estadistica: { ...createDefaultFilters(), mode: 'estadistica' },
    planes: { ...createDefaultFilters(), mode: 'planes' },
    seguimiento: { ...createDefaultFilters(), mode: 'seguimiento' }
  });

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const response = await gestionInformacionService.getPlanAccionDashboard();
        if (!active) return;
        setDashboard(response.data || { rows: [], filters: {}, meta: {} });
      } catch (error) {
        if (!active) return;
        enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar Planeación y Efectividad', { variant: 'error' });
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [enqueueSnackbar]);

  const cargarDashboardPlanAccion = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await gestionInformacionService.getPlanAccionDashboard();
      setDashboard(response.data || { rows: [], filters: {}, meta: {} });
    } catch (error) {
      if (!silent) { enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar Planeación y Efectividad', { variant: 'error' }); }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    const refreshOnVisible = () => {
      if (document.visibilityState === 'visible') {
        cargarDashboardPlanAccion({ silent: true });
      }
    };
    document.addEventListener('visibilitychange', refreshOnVisible);
    window.addEventListener('focus', refreshOnVisible);
    return () => {
      document.removeEventListener('visibilitychange', refreshOnVisible);
      window.removeEventListener('focus', refreshOnVisible);
    };
  }, [cargarDashboardPlanAccion]);

  useEffect(() => {
    if (section === 'estadistica') {
      cargarDashboardPlanAccion({ silent: true });
    }
  }, [section, cargarDashboardPlanAccion]);

  const activeFilters = filtersByTab[tab] || filtersByTab.estadistica;

  const filteredRows = useMemo(() => {
    const rows = Array.isArray(dashboard.rows) ? dashboard.rows : [];

    return rows.filter((row) => {
      if (activeFilters.anio && String(row.anio || '') !== String(activeFilters.anio)) return false;
      if (activeFilters.responsable && row.responsable !== activeFilters.responsable) return false;
      return true;
    });
  }, [dashboard.rows, activeFilters]);

  const deferredRows = useDeferredValue(filteredRows);
  const metrics = useMemo(() => buildMetrics(deferredRows), [deferredRows]);

  const handleFilterChange = (key, value) => {
    setFiltersByTab((prev) => ({
      ...prev,
      [tab]: {
        ...(prev[tab] || createDefaultFilters()),
        mode: tab,
        [key]: value
      }
    }));
  };

  const handleResetFilters = () => {
    setFiltersByTab((prev) => ({
      ...prev,
      [tab]: {
        ...createDefaultFilters(),
        mode: tab
      }
    }));
  };

  const isPlatformSection = section === 'accion' || section === 'nuevo' || section === 'gestion';

  return (
    <Fade in={true}>
      <Box>
        <Stack spacing={3.2}>
          {!isPlatformSection && (
            <HeroBanner
              compact={section !== null}
              onBack={[canEstadistica, canAccion].filter(Boolean).length > 1 ? () => setSection(null) : null}
            />
          )}

          {section === null ? (
            <Box>
              {!canEstadistica && !canAccion ? (
                <Alert severity="warning" sx={{ borderRadius: 3.5, border: '1px solid #fed7aa', bgcolor: '#fff7ed', color: '#9a3412', fontWeight: 600 }}>
                  No tienes permisos asignados para ingresar a los submódulos de Plan de Acción. Por favor, solicita acceso al administrador.
                </Alert>
              ) : (
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', mb: 3.5, textAlign: 'center', letterSpacing: -0.5 }}>
                    Seleccione un submódulo para ingresar
                  </Typography>

                  <Box
                    sx={{
                      display: 'grid',
                      gap: 3.5,
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: [canEstadistica, canAccion].filter(Boolean).length > 1 ? 'repeat(2, 1fr)' : '1fr'
                      },
                      maxWidth: [canEstadistica, canAccion].filter(Boolean).length > 1 ? 980 : 500,
                      margin: '0 auto',
                      px: 1,
                      width: '100%'
                    }}
                  >
                    {canEstadistica && (
                      <Paper
                        elevation={0}
                        onClick={() => setSection('estadistica')}
                        sx={{
                          p: 4.5,
                          borderRadius: 5,
                          border: '1px solid #e2e8f0',
                          background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                          boxShadow: '0 10px 25px rgba(15,23,42,0.03)',
                          cursor: 'pointer',
                          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          position: 'relative',
                          overflow: 'hidden',
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            boxShadow: '0 25px 50px rgba(37,99,235,0.12)',
                            borderColor: '#3b82f6',
                            '& .icon-container': {
                              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                              color: '#ffffff',
                              transform: 'scale(1.1) rotate(5deg)'
                            },
                            '& .action-btn': {
                              background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                              boxShadow: '0 8px 22px rgba(37,99,235,0.25)'
                            }
                          }
                        }}
                      >
                        <Box
                          className="icon-container"
                          sx={{
                            width: 84,
                            height: 84,
                            borderRadius: 4.5,
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3.5,
                            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                            boxShadow: '0 8px 16px rgba(37,99,235,0.05)'
                          }}
                        >
                          <DashboardIcon sx={{ fontSize: 44 }} />
                        </Box>
                        <Typography variant="h6" sx={{ fontWeight: 900, color: '#1e3a8a', mb: 1.8, fontSize: 20 }}>
                          Estadística Planes de Acción
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 14.5, mb: 4, flexGrow: 1, lineHeight: 1.6, px: 2 }}>
                          Resumen ejecutivo de la estructura, avance físico y financiero, y la ejecución general del Plan Estratégico de Desarrollo (PED).
                        </Typography>
                        <Button
                          variant="contained"
                          className="action-btn"
                          sx={{
                            textTransform: 'none',
                            borderRadius: 3,
                            px: 3.5,
                            py: 1.2,
                            fontWeight: 800,
                            background: '#2563eb',
                            boxShadow: '0 4px 12px rgba(37,99,235,0.15)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          Ingresar a Estadísticas
                        </Button>
                      </Paper>
                    )}

                    {canAccion && (
                      <Paper
                        elevation={0}
                        onClick={() => setSection('accion')}
                        sx={{
                          p: 4.5,
                          borderRadius: 5,
                          border: '1px solid #c4b5fd',
                          background: 'linear-gradient(145deg, #ffffff 0%, #f5f3ff 100%)',
                          boxShadow: '0 10px 25px rgba(91,33,182,0.06)',
                          cursor: 'pointer',
                          transition: 'all .3s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          textAlign: 'center',
                          '&:hover': {
                            transform: 'translateY(-6px)',
                            borderColor: '#7c3aed',
                            boxShadow: '0 25px 50px rgba(124,58,237,0.16)'
                          }
                        }}
                      >
                        <Box
                          sx={{
                            width: 84,
                            height: 84,
                            borderRadius: 4.5,
                            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
                            color: 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            mb: 3.5,
                            boxShadow: '0 12px 24px rgba(124,58,237,0.2)'
                          }}
                        >
                          <AutoAwesomeIcon sx={{ fontSize: 44 }} />
                        </Box>
                        <Chip
                          label="PLATAFORMA PED"
                          color="secondary"
                          size="small"
                          sx={{ mb: 1.2, fontWeight: 900 }}
                        />
                        <Typography variant="h6" sx={{ fontWeight: 900, color: '#4c1d95', mb: 1.8, fontSize: 20 }}>
                          Gestión de Planes de Acción
                        </Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 14.5, mb: 4, flexGrow: 1, lineHeight: 1.6, px: 2 }}>
                          Gestión integral del PED: concertación con dependencias, formulación, actas, firma electrónica, evidencias y seguimiento.
                        </Typography>
                        <Button
                          variant="contained"
                          sx={{
                            textTransform: 'none',
                            borderRadius: 3,
                            px: 3.5,
                            py: 1.2,
                            fontWeight: 800,
                            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)'
                          }}
                        >
                          Ingresar a Planes de Acción
                        </Button>
                      </Paper>
                    )}
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <>
              {isPlatformSection ? (
                <StrategicPlanningPlatform onBack={() => setSection(null)} />
              ) : (
                <>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 0.8,
                      borderRadius: 3.5,
                      border: '1px solid #dbeafe',
                      background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)',
                      boxShadow: '0 10px 24px rgba(15,23,42,.04)'
                    }}
                  >
                    <Tabs
                      value={tab}
                      onChange={(_, next) => setTab(next)}
                      variant="fullWidth"
                      sx={{
                        minHeight: 60,
                        '& .MuiTabs-indicator': {
                          height: 0
                        },
                        '& .MuiTabs-flexContainer': { gap: { xs: 0.5, md: 1 } },
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 800,
                          minHeight: 54,
                          minWidth: 0,
                          py: 1.4,
                          px: { xs: 1, md: 2 },
                          borderRadius: 2.5,
                          color: '#64748b',
                          transition: 'all .2s ease'
                        },
                        '& .MuiTab-root.Mui-selected': {
                          color: '#1d4ed8',
                          background: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)',
                          boxShadow: 'inset 0 0 0 1px rgba(59,130,246,.22), 0 8px 18px rgba(37,99,235,.08)'
                        },
                        '& .MuiTab-root:hover': {
                          backgroundColor: '#f8fafc'
                        },
                        '& .MuiTab-iconWrapper': {
                          mr: 1
                        }
                      }}
                    >
                      <Tab value="estadistica" icon={<DashboardIcon fontSize="small" />} iconPosition="start" label="Estadística Planes de Acción" />
                      <Tab value="planes" icon={<AssignmentTurnedInIcon fontSize="small" />} iconPosition="start" label="Planes de Acción" />
                      <Tab value="seguimiento" icon={<ShowChartIcon fontSize="small" />} iconPosition="start" label="Seguimiento Planes de Acción" />
                    </Tabs>
                  </Paper>

                  {tab !== 'seguimiento' && (
                    <FilterBar filters={activeFilters} options={dashboard.filters || {}} onChange={handleFilterChange} onReset={handleResetFilters} />
                  )}

                  {loading ? (
                    <Paper elevation={0} sx={{ py: 10, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                      <Stack spacing={1.5} alignItems="center">
                        <CircularProgress />
                        <Typography sx={{ color: '#64748b' }}>Cargando módulo Planeación y Efectividad...</Typography>
                      </Stack>
                    </Paper>
                  ) : !dashboard.rows?.length ? (
                    <Alert severity="info" sx={{ borderRadius: 3 }}>
                      Aún no hay datos del <strong>Plan de Acción</strong>. Carga la base desde Gestión de la Información y este módulo se poblará automáticamente.
                    </Alert>
                  ) : (
                    <>
                      {tab === 'estadistica' && <EstadisticaTab rows={deferredRows} metrics={metrics} />}
                      {tab === 'planes' && <PlanesAccionTab rows={deferredRows} />}
                      {tab === 'seguimiento' && (
                        <SeguimientoTabV2
                          rows={deferredRows}
                          filtersNode={<FilterBar filters={activeFilters} options={dashboard.filters || {}} onChange={handleFilterChange} onReset={handleResetFilters} />}
                        />
                      )}
                    </>
                  )}
                </>
              )}
            </>
          )}
        </Stack>
      </Box>
    </Fade>
  );
}

export default PlaneacionEfectividad;
