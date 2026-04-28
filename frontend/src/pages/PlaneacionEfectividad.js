import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fade,
  FormControl,
  IconButton,
  InputLabel,
  Link as MuiLink,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tooltip,
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
  AutoAwesome as AutoAwesomeIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon,
  CalendarMonth as CalendarMonthIcon,
  Cancel as CancelIcon,
  CheckCircle as CheckCircleIcon,
  Dashboard as DashboardIcon,
  DeleteOutline as DeleteOutlineIcon,
  Description as DescriptionIcon,
  Download as DownloadIcon,
  Edit as EditIcon,
  FilterAltOff as FilterAltOffIcon,
  Flag as FlagIcon,
  HelpOutline as HelpOutlineIcon,
  HourglassBottom as HourglassBottomIcon,
  Insights as InsightsIcon,
  ListAlt as ListAltIcon,
  MenuBook as MenuBookIcon,
  OpenInNew as OpenInNewIcon,
  Save as SaveIcon,
  ShowChart as ShowChartIcon,
  Timeline as TimelineIcon,
  TrendingUp as TrendingUpIcon,
  UploadFile as UploadFileIcon
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../services/gestionInformacionService';

const PED_YEAR_WEIGHT = 14.28;

const DEPENDENCIA_QUE_CITA_FIJA = 'Dirección de Planeación y Aseguramiento de la Calidad - Planeación y Efectividad';

const LUGARES_REUNION = [
  'Sala Juntas Rectoría',
  'Sala de Juntas San Damián',
  'Sala Reunión H201F',
  'Sala Bellina',
  'I308'
];

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
const FIXED_PLAN_YEARS = ['2023', '2024', '2025', '2026', '2027', '2028', '2029'];

const normalizeCatalogKey = (value) => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/\s+/g, ' ')
  .trim();

const cleanCatalogLabel = (value) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return '';

  const withoutYearCode = text.replace(/^\d{4}-[A-Z0-9]+(?:-[A-Z0-9]+)*\s+/i, '').trim();
  const withoutGenericCode = withoutYearCode.replace(/^[A-Z]{2,}(?:-[A-Z0-9]+){1,}\s+/i, '').trim();
  return withoutGenericCode || withoutYearCode || text;
};

const normalizeSentence = (value) => String(value || '').replace(/\s+/g, ' ').trim();

const capitalizeSentence = (text = '') => {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
};

const inferIndicatorTypeFromActivity = (actividad = '') => {
  const text = String(actividad || '').toLowerCase();
  if (!text) return 'Resultado';
  if (/(capacit|taller|socializ|formaci|difund|sensibiliz|acompa[nñ])/.test(text)) return 'Gestión';
  if (/(evalu|diagn|an[aá]lisis|monitore|seguim|auditor)/.test(text)) return 'Gestión';
  if (/(innov|transform|mejor|fortalec|consolid)/.test(text)) return 'Impacto';
  return 'Resultado';
};

const generateIndicatorSuggestion = ({ actividad }) => {
  const clean = normalizeSentence(actividad);
  if (!clean) return null;

  const tipo = inferIndicatorTypeFromActivity(clean);
  const nucleo = capitalizeSentence(clean);

  const bullets = [
    `1. ${nucleo} — avance de ejecución. Medición: (avance ejecutado / meta programada) × 100.`,
    `2. ${nucleo} — cumplimiento en el plazo. Medición: (entregable realizado en fecha planeada / fecha planeada) × 100.`,
    `3. ${nucleo} — cobertura alcanzada. Medición: (alcance logrado / alcance programado) × 100.`
  ];

  return { tipo, bullets };
};

const formatIndicatorSuggestion = (suggestion) => {
  if (!suggestion) return '';
  return suggestion.bullets.join('\n');
};

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
  const weightPerYear = 14.28;
  const yearsSet = new Set();
  const actividadesSet = new Set();
  const lineamientosSet = new Set();
  const actividadYearAgg = new Map();
  const lineamientoYearAgg = new Map();
  const yearAgg = new Map();
  const actividadesByYear = new Map();

  rows.forEach((row) => {
    const anio = Number(row.anio);
    if (!Number.isFinite(anio)) return;

    yearsSet.add(anio);

    const actividad = row.actividad || '';
    const lineamiento = row.lineamiento_estrategico || '';
    const avance = percent(row.avance_total) || 0;

    if (actividad) {
      actividadesSet.add(actividad);
      const actividadYearKey = `${actividad}||${anio}`;
      const actividadYearCurrent = actividadYearAgg.get(actividadYearKey) || { total: 0, count: 0 };
      actividadYearCurrent.total += avance;
      actividadYearCurrent.count += 1;
      actividadYearAgg.set(actividadYearKey, actividadYearCurrent);

      const yearActivities = actividadesByYear.get(anio) || new Set();
      yearActivities.add(actividad);
      actividadesByYear.set(anio, yearActivities);
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
  const actividades = Array.from(actividadesSet).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  const lineamientos = Array.from(lineamientosSet);

  const avgByActividadYear = new Map();
  actividadYearAgg.forEach((agg, key) => {
    if (!agg.count) return;
    avgByActividadYear.set(key, Number((agg.total / agg.count).toFixed(2)));
  });

  const totalActividades = years.reduce((acc, anio) => acc + ((actividadesByYear.get(anio) || new Set()).size), 0);

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

  const cumplimientoRows = actividades.map((actividad) => {
    const byYear = {};
    years.forEach((anio) => {
      byYear[anio] = avgByActividadYear.get(`${actividad}||${anio}`) ?? null;
    });
    const values = Object.values(byYear).filter((value) => value !== null && value > 0);
    const total = values.length ? Number((values.reduce((acc, value) => acc + value, 0) / values.length).toFixed(2)) : 0;
    return { actividad, byYear, total };
  });

  const cumplimientoTotalsByYear = Object.fromEntries(
    years.map((anio) => {
      const agg = yearAgg.get(anio);
      if (!agg?.count) return [anio, null];
      const avg = agg.total / agg.count;
      return [anio, Number(avg.toFixed(2))];
    })
  );

  const ejecucionRows = actividades.map((actividad) => {
    const byYear = {};
    years.forEach((anio) => {
      const avg = avgByActividadYear.get(`${actividad}||${anio}`);
      byYear[anio] = avg === undefined ? null : Number((((avg / 100) * weightPerYear)).toFixed(2));
    });
    const values = Object.values(byYear).filter((value) => value !== null);
    const total = values.length ? Number(values.reduce((acc, value) => acc + value, 0).toFixed(2)) : 0;
    return { actividad, byYear, total };
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
    actividades,
    totalActividades,
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
  const weightPerYear = 14.28;
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

function HeroBanner() {
  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2.6, md: 3.2 },
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
        spacing={2.4}
        justifyContent="space-between"
        alignItems={{ xs: 'flex-start', lg: 'center' }}
        sx={{ position: 'relative', zIndex: 1 }}
      >
        <Box sx={{ maxWidth: 840 }}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.9,
              px: 1.2,
              py: 0.65,
              borderRadius: 999,
              mb: 1.5,
              bgcolor: 'rgba(15,23,42,.18)',
              border: '1px solid rgba(255,255,255,.18)'
            }}
          >
            <ShowChartIcon sx={{ fontSize: 16 }} />
            <Typography sx={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              {'Planeaci\u00f3n y Efectividad'}
            </Typography>
          </Box>

          <Typography sx={{ fontSize: { xs: 28, md: 44 }, lineHeight: 1.02, fontWeight: 900, letterSpacing: -0.8 }}>
            {'PLAN ESTRAT\u00c9GICO DE DESARROLLO'}
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.92)', mt: 1, fontSize: { xs: 14, md: 17 }, maxWidth: 760 }}>
            {'Seguimiento, control y resultados del m\u00f3dulo Planeaci\u00f3n y Efectividad en una vista ejecutiva m\u00e1s clara y ordenada.'}
          </Typography>
        </Box>

        <Paper elevation={0} sx={{ px: 2.8, py: 1.5, borderRadius: 999, bgcolor: 'rgba(255,255,255,.97)', minWidth: { xs: '100%', sm: 220 } }}>
          <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>
            La meta es
          </Typography>
          <Typography sx={{ fontSize: 24, color: '#ef4444', fontWeight: 900, letterSpacing: 1 }}>
            INNOVAR
          </Typography>
        </Paper>
      </Stack>
    </Paper>
  );
}

function FilterBar({ filters, options, onChange, onReset }) {
  return (
    <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
        <FormControl fullWidth>
          <InputLabel>Responsable de Ejecución</InputLabel>
          <Select value={filters.responsable} label="Responsable de Ejecución" onChange={(e) => onChange('responsable', e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {(options.responsables || []).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl fullWidth>
          <InputLabel>Año</InputLabel>
          <Select value={filters.anio} label="Año" onChange={(e) => onChange('anio', e.target.value)}>
            <MenuItem value="">Todos</MenuItem>
            {(options.anios || []).map((item) => <MenuItem key={item} value={String(item)}>{item}</MenuItem>)}
          </Select>
        </FormControl>

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
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <SectionTitle title="Distribución por Estado" subtitle="Cantidad de registros según el avance total reportado." />
          <Box sx={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={estadoChart}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} />
                <RechartsTooltip formatter={(value) => [formatNumber(value), 'Registros']} />
                <Bar dataKey="total" radius={[10, 10, 0, 0]}>
                  {estadoChart.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
          <SectionTitle title="Avance Promedio por Año" subtitle="Promedio del avance total según el año de planeación." />
          <Box sx={{ width: '100%', height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={anioChart}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="anio" tick={{ fontSize: 12 }} />
                <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                <RechartsTooltip formatter={(value) => [formatPercent(value), 'Avance promedio']} />
                <Bar dataKey="avance" fill="#2563eb" radius={[10, 10, 0, 0]} />
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

  const monitoreoIP = totalIndicadores
    ? Number((rows.reduce((acc, row) => acc + (percent(row.avance_ip) || 0), 0) / totalIndicadores).toFixed(2))
    : 0;
  const monitoreoIIP = totalIndicadores
    ? Number((rows.reduce((acc, row) => acc + (percent(row.avance_iip) || 0), 0) / totalIndicadores).toFixed(2))
    : 0;
  const avanceGeneral = totalIndicadores
    ? Number((rows.reduce((acc, row) => acc + (percent(row.avance_total) || 0), 0) / totalIndicadores).toFixed(2))
    : 0;

  const pctCumplidos = totalIndicadores ? Number(((cumplidos * 100) / totalIndicadores).toFixed(1)) : 0;
  const pctEnProceso = totalIndicadores ? Number(((enProceso * 100) / totalIndicadores).toFixed(1)) : 0;
  const pctPendientes = totalIndicadores ? Number(((pendientes * 100) / totalIndicadores).toFixed(1)) : 0;

  const getProgressTone = (value) => {
    if (value >= 80) return { color: '#059669', bg: '#d1fae5', status: 'ÓPTIMO' };
    if (value >= 50) return { color: '#d97706', bg: '#fef3c7', status: 'AVANZANDO' };
    if (value > 0) return { color: '#dc2626', bg: '#fee2e2', status: 'INICIANDO' };
    return { color: '#94a3b8', bg: '#f1f5f9', status: 'SIN DATOS' };
  };

  const ipTone = getProgressTone(monitoreoIP);
  const iipTone = getProgressTone(monitoreoIIP);

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
        <Box sx={{ position: 'relative', p: { xs: 2.4, md: 3 }, background: 'linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #2563eb 100%)', color: 'white' }}>
          <Box sx={{ position: 'absolute', right: 20, top: 16, px: 1.6, py: 0.9, borderRadius: 2, bgcolor: 'rgba(255,255,255,.15)' }}>
            <Typography sx={{ fontSize: 10, color: 'rgba(255,255,255,.72)', textTransform: 'uppercase', letterSpacing: 1 }}>Actualizado</Typography>
            <Typography sx={{ fontSize: 13, fontWeight: 800 }}>{new Date().toLocaleDateString('es-CO')}</Typography>
          </Box>
          <Typography sx={{ display: 'inline-flex', px: 1.5, py: 0.6, borderRadius: 999, bgcolor: 'rgba(255,255,255,.14)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1.5, mb: 1.1 }}>
            Dashboard Interactivo
          </Typography>
          <Typography sx={{ fontSize: { xs: 28, md: 34 }, fontWeight: 900, lineHeight: 1 }}>
            Plan de Acción {textoAnio}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.2 }}>
            <AssignmentTurnedInIcon sx={{ color: '#fbbf24' }} />
            <Typography sx={{ fontSize: 18, fontWeight: 800, color: '#fde68a' }}>
              {textoResponsable}
            </Typography>
          </Stack>
        </Box>

        <Box sx={{ p: 2.2, display: 'grid', gap: 1.6, gridTemplateColumns: { xs: '1fr', lg: '1.3fr 1fr 1fr 1fr 1.2fr' }, bgcolor: '#fff' }}>
          <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '2px solid #e2e8f0' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.4 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' }}>
                <InsightsIcon sx={{ color: 'white' }} />
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Total Indicadores
              </Typography>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2.2}>
              <Typography sx={{ fontSize: 42, lineHeight: 1, fontWeight: 900, color: '#1e3a8a' }}>{totalIndicadores}</Typography>
              <Stack spacing={0.8} sx={{ flex: 1 }}>
                {[
                  ['Cumplidos', pctCumplidos, cumplidos, '#10b981'],
                  ['En Proceso', pctEnProceso, enProceso, '#f59e0b'],
                  ['Pendientes', pctPendientes, pendientes, '#ef4444']
                ].map(([label, pct, total, color]) => (
                  <Stack key={label} direction="row" spacing={1} alignItems="center">
                    <Typography sx={{ width: 78, fontSize: 11, color: '#64748b', fontWeight: 700 }}>{label}</Typography>
                    <Box sx={{ flex: 1, height: 8, borderRadius: 99, bgcolor: 'rgba(148,163,184,.18)', overflow: 'hidden' }}>
                      <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: color, borderRadius: 99 }} />
                    </Box>
                    <Typography sx={{ width: 24, textAlign: 'right', color, fontWeight: 900, fontSize: 12 }}>{total}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </Paper>

          {[
            ['Planes de Acción', totalPlanesAccion, null, '#7c3aed', <AssignmentTurnedInIcon sx={{ color: 'white' }} />, 'Responsables'],
            ['Total Indicadores', totalIndicadores, null, '#1e40af', <InsightsIcon sx={{ color: 'white' }} />, 'En seguimiento']
          ].map(([label, total, pct, color, icon]) => (
            <Paper key={label} elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '2px solid #e2e8f0' }}>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
                <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: color }}>
                  {icon}
                </Box>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {label}
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 40, lineHeight: 1, fontWeight: 900, color }}>{total}</Typography>
              <Typography sx={{ mt: 0.8, fontSize: 12, color: '#94a3b8' }}>{arguments[0]?.[5] || ''}</Typography>
            </Paper>
          ))}

          {[
            ['Monitoreo IP', monitoreoIP, ipTone, 'Primer Período'],
            ['Monitoreo IIP', monitoreoIIP, iipTone, 'Segundo Período']
          ].map(([label, value, tone, subtitle]) => (
            <Paper key={label} elevation={0} sx={{ p: 2.2, borderRadius: 3, border: `2px solid ${tone.color}33`, borderLeft: `5px solid ${tone.color}` }}>
              <Stack direction="row" justifyContent="space-between" spacing={1.2} alignItems="flex-start" sx={{ mb: 1.2 }}>
                <Box
                  sx={{
                    width: 42,
                    height: 42,
                    borderRadius: 2,
                    display: 'grid',
                    placeItems: 'center',
                    background: `linear-gradient(135deg, ${tone.color}, ${tone.color}bb)`
                  }}
                >
                  <CheckCircleIcon sx={{ color: 'white' }} />
                </Box>
                <Chip label={tone.status} sx={{ bgcolor: tone.bg, color: tone.color, fontSize: 10, fontWeight: 900 }} />
              </Stack>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                {label}
              </Typography>
              <Typography sx={{ fontSize: 40, lineHeight: 1, fontWeight: 900, color: tone.color, mt: 0.5 }}>{formatPercent(value)}</Typography>
              <Typography sx={{ mt: 0.5, fontSize: 12, color: '#94a3b8' }}>{subtitle}</Typography>
              <Box sx={{ mt: 1, height: 8, borderRadius: 99, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                <Box sx={{ width: `${value > 0 ? value : 100}%`, height: '100%', bgcolor: value > 0 ? tone.color : '#e2e8f0', borderRadius: 99 }} />
              </Box>
            </Paper>
          ))}

          <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, color: 'white', background: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 60%, #3b82f6 100%)' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.2 }}>
              <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.25)' }}>
                <TrendingUpIcon sx={{ color: 'white' }} />
              </Box>
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: 'rgba(255,255,255,.78)', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                Avance General
              </Typography>
            </Stack>
            <Typography sx={{ fontSize: 42, lineHeight: 1, fontWeight: 900 }}>{formatPercent(avanceGeneral)}</Typography>
            <Box sx={{ mt: 1.2, height: 9, borderRadius: 99, bgcolor: 'rgba(255,255,255,.18)', overflow: 'hidden' }}>
              <Box sx={{ width: `${Math.min(avanceGeneral, 100)}%`, height: '100%', bgcolor: 'rgba(255,255,255,.92)', borderRadius: 99 }} />
            </Box>
            <Typography sx={{ mt: 0.8, fontSize: 12, color: 'rgba(255,255,255,.72)' }}>Promedio Total</Typography>
          </Paper>
        </Box>

        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 2.2, py: 1.5, bgcolor: '#fff', borderTop: '1px solid #e2e8f0', borderBottom: '1px solid #e2e8f0' }}>
          <Box sx={{ width: 5, height: 24, borderRadius: 99, background: 'linear-gradient(180deg, #fbbf24, #f59e0b)' }} />
          <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#1e293b' }}>Detalle de Indicadores</Typography>
        </Stack>

        <Box sx={{ p: 2.2, bgcolor: '#f8fafc', maxHeight: 720, overflowY: 'auto' }}>
          <Stack spacing={1.5}>
            {visibleRows.map((row) => {
              const ip = percent(row.avance_ip) || 0;
              const iipReal = percent(row.avance_iip) || 0;
              const esAutoIip = ip >= 100;
              const iip = esAutoIip ? 100 : iipReal;
              const total = percent(row.avance_total) || 0;
              const totalTone = getProgressTone(total);
              const ipTone = getProgressTone(ip);
              const iipTone = esAutoIip ? { color: '#059669', bg: '#d1fae5' } : getProgressTone(iip);
              const circleSize = Math.min(total, 100) * 2.07;
              return (
                <Paper key={row.id} elevation={0} sx={{ p: 2.2, borderRadius: 3, borderLeft: `5px solid ${totalTone.color}`, boxShadow: '0 2px 12px rgba(0,0,0,.04)' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 1.4 }}>
                    <Stack spacing={1}>
                      {!selectedResponsable && (
                        <Chip label={row.responsable || 'Sin responsable'} sx={{ width: 'fit-content', bgcolor: '#f1f5f9', color: totalTone.color, fontWeight: 800 }} />
                      )}
                      <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#1e3a8a' }}>
                        {row.indicador || row.actividad || '-'}
                      </Typography>
                      <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: 12, color: '#1e40af', fontWeight: 800 }}>Lineamiento</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#475569' }}>{row.lineamiento_estrategico || '-'}</Typography>
                        <Typography sx={{ fontSize: 12, color: '#1e40af', fontWeight: 800, mt: 1 }}>Objetivo</Typography>
                        <Typography sx={{ fontSize: 12.5, color: '#475569' }}>{row.objetivo_estrategico || '-'}</Typography>
                        {(row.observaciones_ip || row.observaciones_iip) && (
                          <>
                            <Typography sx={{ fontSize: 12, color: '#a16207', fontWeight: 800, mt: 1 }}>Observaciones</Typography>
                            <Typography sx={{ fontSize: 12.5, color: '#713f12' }}>{row.observaciones_ip || row.observaciones_iip}</Typography>
                          </>
                        )}
                      </Box>
                    </Stack>

                    <Chip label={total >= 100 ? 'Cumplido' : total > 0 ? 'En Proceso' : 'Pendiente'} sx={{ alignSelf: 'flex-start', bgcolor: totalTone.bg, color: totalTone.color, fontWeight: 900 }} />
                  </Stack>

                  <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} alignItems={{ xs: 'stretch', lg: 'center' }}>
                    <Box sx={{ flex: 1, display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
                      <Paper elevation={0} sx={{ p: 1.4, borderRadius: 2, textAlign: 'center', bgcolor: '#eff6ff', border: '1px solid #93c5fd' }}>
                        <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Meta</Typography>
                        <Typography sx={{ fontSize: 22, color: '#1e40af', fontWeight: 900 }}>{row.meta || '-'}</Typography>
                      </Paper>
                      {[
                        ['Período I', ip, ipTone, false],
                        ['Período II', iip, iipTone, esAutoIip]
                      ].map(([label, value, tone, auto]) => (
                        <Paper key={label} elevation={0} sx={{ p: 1.4, borderRadius: 2, textAlign: 'center', bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                          <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>
                            {label} {auto ? <Box component="span" sx={{ px: 0.5, py: 0.1, borderRadius: 1, bgcolor: '#3b82f6', color: 'white', fontSize: 9 }}>AUTO</Box> : null}
                          </Typography>
                          <Typography sx={{ fontSize: 22, color: tone.color, fontWeight: 900 }}>{formatPercent(value)}</Typography>
                          <Box sx={{ mt: 0.8, height: 4, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                            <Box sx={{ width: `${Math.min(value, 100)}%`, height: '100%', bgcolor: value > 0 ? tone.color : '#e2e8f0' }} />
                          </Box>
                        </Paper>
                      ))}
                      <Paper elevation={0} sx={{ p: 1.4, borderRadius: 2, textAlign: 'center', bgcolor: '#f0fdf4', border: '1px solid #86efac' }}>
                        <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 800, textTransform: 'uppercase' }}>Avance Total</Typography>
                        <Typography sx={{ fontSize: 24, color: totalTone.color, fontWeight: 900 }}>{formatPercent(total)}</Typography>
                      </Paper>
                    </Box>

                    <Box sx={{ width: 92, height: 92, position: 'relative', alignSelf: 'center' }}>
                      <Box
                        component="svg"
                        viewBox="0 0 80 80"
                        sx={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
                      >
                        <circle cx="40" cy="40" r="33" fill="none" stroke="#e2e8f0" strokeWidth="6" />
                        <circle
                          cx="40"
                          cy="40"
                          r="33"
                          fill="none"
                          stroke={total > 0 ? totalTone.color : '#e2e8f0'}
                          strokeWidth="6"
                          strokeLinecap="round"
                          strokeDasharray={`${circleSize} 207`}
                        />
                      </Box>
                      <Stack spacing={0} alignItems="center" justifyContent="center" sx={{ position: 'absolute', inset: 0 }}>
                        <Typography sx={{ fontSize: 26, lineHeight: 1, fontWeight: 900, color: totalTone.color }}>{Math.round(total)}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#64748b' }}>%</Typography>
                      </Stack>
                    </Box>
                  </Stack>

                  <Box sx={{ mt: 1.4, height: 4, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                    <Box sx={{ width: `${Math.min(total, 100)}%`, height: '100%', background: total > 0 ? `linear-gradient(90deg, ${totalTone.color}, ${totalTone.color}99)` : '#e2e8f0' }} />
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

function MatrixTable({ title, subtitle, rows, years, rowKey, totalsByYear, generalTotal, totalLabel = 'TOTAL', footerNote = '', initialVisibleRows = null, loadMoreStep = 30 }) {
  const [visibleCount, setVisibleCount] = useState(initialVisibleRows || rows.length);

  useEffect(() => {
    setVisibleCount(initialVisibleRows || rows.length);
  }, [rows, initialVisibleRows]);

  const visibleRows = initialVisibleRows ? rows.slice(0, visibleCount) : rows;

  return (
    <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbeafe', overflow: 'hidden', boxShadow: '0 4px 20px rgba(59,130,246,.12)' }}>
      <Box sx={{ p: 2.3, color: 'white', background: 'linear-gradient(135deg,#2563eb 0%,#3b82f6 50%,#60a5fa 100%)' }}>
        <Typography sx={{ fontSize: 23, fontWeight: 900 }}>{title}</Typography>
        <Typography sx={{ fontSize: 13, opacity: 0.95 }}>{subtitle}</Typography>
      </Box>
      <Box sx={{ p: 2, bgcolor: 'linear-gradient(180deg,#fff 0%,#f0f9ff 100%)' }}>
        <Stack direction="row" spacing={2.5} sx={{ flexWrap: 'wrap', color: '#64748b', fontSize: 12, fontWeight: 700 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#10b981', borderRadius: 1 }} />
            <Typography sx={{ fontSize: 12, color: '#047857', fontWeight: 700 }}>≥80%</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#f59e0b', borderRadius: 1 }} />
            <Typography sx={{ fontSize: 12, color: '#b45309', fontWeight: 700 }}>60-79%</Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 16, height: 16, bgcolor: '#ef4444', borderRadius: 1 }} />
            <Typography sx={{ fontSize: 12, color: '#b91c1c', fontWeight: 700 }}>&lt;60%</Typography>
          </Stack>
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
                  const value = row.byYear[year];
                  if (value === null || value === undefined || value === 0) {
                    return <TableCell key={`${row[rowKey]}-${year}`} align="center" sx={{ bgcolor: '#f1f5f9', color: '#94a3b8' }}>Sin datos</TableCell>;
                  }
                  const tone = value >= 80 ? { color: '#10b981', bg: '#d1fae5' } : value >= 60 ? { color: '#f59e0b', bg: '#fef3c7' } : { color: '#ef4444', bg: '#fee2e2' };
                  return (
                    <TableCell key={`${row[rowKey]}-${year}`} align="center" sx={{ bgcolor: tone.bg }}>
                      <Typography sx={{ fontSize: 22, fontWeight: 900, color: tone.color }}>{formatPercent(value)}</Typography>
                      <Box sx={{ mt: 0.8, height: 6, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                        <Box sx={{ width: `${Math.min(value, 100)}%`, height: '100%', bgcolor: tone.color }} />
                      </Box>
                    </TableCell>
                  );
                })}
                <TableCell align="center" sx={{ bgcolor: row.total >= 80 ? '#d1fae5' : row.total >= 60 ? '#fef3c7' : '#fee2e2' }}>
                  <Typography sx={{ fontSize: 24, fontWeight: 900, color: row.total >= 80 ? '#10b981' : row.total >= 60 ? '#f59e0b' : '#ef4444' }}>
                    {formatPercent(row.total)}
                  </Typography>
                  <Box sx={{ mt: 0.8, height: 8, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                    <Box sx={{ width: `${Math.min(row.total, 100)}%`, height: '100%', bgcolor: row.total >= 80 ? '#10b981' : row.total >= 60 ? '#f59e0b' : '#ef4444' }} />
                  </Box>
                </TableCell>
              </TableRow>
            ))}
            <TableRow sx={{ bgcolor: 'linear-gradient(135deg,#dbeafe 0%,#bfdbfe 50%,#93c5fd 100%)' }}>
              <TableCell sx={{ fontWeight: 900, color: '#1e40af' }}>PROMEDIO GENERAL</TableCell>
              {years.map((year) => {
                const value = totalsByYear[year];
                const tone = value >= 80 ? { color: '#10b981', bg: '#d1fae5' } : value >= 60 ? { color: '#f59e0b', bg: '#fef3c7' } : { color: '#ef4444', bg: '#fee2e2' };
                return (
                  <TableCell key={`total-${year}`} align="center" sx={{ bgcolor: tone.bg }}>
                    <Typography sx={{ fontSize: 24, fontWeight: 900, color: tone.color }}>{formatPercent(value)}</Typography>
                    <Box sx={{ mt: 0.8, height: 7, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.min(value, 100)}%`, height: '100%', bgcolor: tone.color }} />
                    </Box>
                  </TableCell>
                );
              })}
              <TableCell align="center" sx={{ bgcolor: generalTotal >= 80 ? '#d1fae5' : generalTotal >= 60 ? '#fef3c7' : '#fee2e2' }}>
                <Typography sx={{ fontSize: 28, fontWeight: 900, color: generalTotal >= 80 ? '#10b981' : generalTotal >= 60 ? '#f59e0b' : '#ef4444' }}>
                  {formatPercent(generalTotal)}
                </Typography>
                <Box sx={{ mt: 0.8, height: 10, bgcolor: '#e0f2fe', borderRadius: 99, overflow: 'hidden' }}>
                  <Box sx={{ width: `${Math.min(generalTotal, 100)}%`, height: '100%', bgcolor: generalTotal >= 80 ? '#10b981' : generalTotal >= 60 ? '#f59e0b' : '#ef4444' }} />
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
        subtitle="Ejecución Cualitativa de Lineamientos Estratégicos"
        rows={stats.ejecucionRows.map((row) => ({ ...row, 'LINEAMIENTOS ESTRATÉGICOS': row.lineamiento }))}
        years={stats.years}
        rowKey="LINEAMIENTOS ESTRATÉGICOS"
        totalsByYear={stats.ejecucionTotalsByYear}
        generalTotal={stats.ejecucionGeneralProm}
        footerNote={`NOTA: La ejecución representa el avance ponderado por el peso de cada año (${stats.weightPerYear.toFixed(2)}%).`}
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
        rows={stats.ejecucionRows.map((row) => ({ ...row, objetivoLabel: row.objetivo }))}
        years={stats.years}
        rowKey="objetivoLabel"
        totalsByYear={stats.ejecucionTotalsByYear}
        generalTotal={stats.ejecucionGeneralProm}
        footerNote={`NOTA: La ejecución representa el avance ponderado por el peso de cada año (${stats.weightPerYear.toFixed(2)}%). El promedio se calcula dividiendo entre el número de lineamientos estratégicos del plan.`}
      />
    </Stack>
  );
}

function ActividadesDashboard({ rows }) {
  const stats = useMemo(() => buildActividadesStats(rows), [rows]);
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
      value: formatPercent(stats.promActividadesPed),
      progress: stats.promActividadesPed,
      footer: 'Del Plan Estratégico',
      color: '#2563eb',
      gradient: 'linear-gradient(135deg, #2563eb, #1e40af)',
      shadow: 'rgba(37, 99, 235, 0.25)',
      badge: 'ACTIVIDADES PED',
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
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle="Cumplimiento de Actividades PED por Año"
        rows={stats.cumplimientoRows.map((row) => ({ ...row, 'ACTIVIDADES PED': row.actividad }))}
        years={stats.years}
        rowKey="ACTIVIDADES PED"
        totalsByYear={stats.cumplimientoTotalsByYear}
        generalTotal={stats.cumplimientoGeneral}
        initialVisibleRows={40}
        loadMoreStep={40}
      />
      <MatrixTable
        title="Estadística del Plan Estratégico de Desarrollo"
        subtitle="Ejecución Cualitativa de Actividades PED"
        rows={stats.ejecucionRows.map((row) => ({ ...row, 'ACTIVIDADES PED': row.actividad }))}
        years={stats.years}
        rowKey="ACTIVIDADES PED"
        totalsByYear={stats.ejecucionTotalsByYear}
        generalTotal={stats.ejecucionGeneralProm}
        initialVisibleRows={40}
        loadMoreStep={40}
        footerNote={`NOTA: La ejecución representa el avance ponderado por el peso de cada año (${stats.weightPerYear.toFixed(2)}%). El promedio se calcula dividiendo entre el número de lineamientos estratégicos del plan.`}
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
              : 'Monitoreo estratégico del PED por actividades.'
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
          <Tab value="actividades" icon={<TimelineIcon fontSize="small" />} iconPosition="start" label="PED por Actividades" />
        </Tabs>
      </Paper>

      {filtersNode}

      {subTab === 'objetivos' && <ObjetivosDashboard rows={rows} />}
      {subTab === 'lineamientos' && <LineamientosDashboard rows={rows} />}
      {subTab === 'actividades' && <ActividadesDashboard rows={rows} />}
    </Stack>
  );
}

function GestionPlanesWorkspaceV2({ sourceRows = [] }) {
  const { enqueueSnackbar } = useSnackbar();
  const WORKSPACE_KEY = 'plan_accion_workspace_v2';
  const SAVED_PLANS_KEY = 'plan_accion_saved_plans_v2';
  const [workspaceTab, setWorkspaceTab] = useState('constructor');
  const [audioFile, setAudioFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [generatingIndicator, setGeneratingIndicator] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [showRawIndicador, setShowRawIndicador] = useState(false);
  const [showAiSources, setShowAiSources] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);

  const emptyPlan = useMemo(() => ({
    anio: String(new Date().getFullYear()),
    ped: 'PED 2022-2029',
    estado: 'Borrador',
    dependencia: '',
    objetivoSesion: '',
    fechaReunion: new Date().toISOString().slice(0, 10),
    lugarReunion: ''
  }), []);

  const emptyActividad = useMemo(() => ({
    anio: String(new Date().getFullYear()),
    ped: 'PED 2022-2029',
    objetivo_estrategico: '',
    lineamiento_estrategico: '',
    macroactividad: '',
    actividad: '',
    tipo_indicador: '',
    fecha_inicio: '',
    fecha_fin: '',
    indicador: '',
    meta: '',
    responsable: '',
    corresponsable: '',
    avance_ip: '0',
    observaciones_ip: '',
    avance_iip: '0',
    observaciones_iip: '',
    total_ejecucion: '0'
  }), []);

  const [planData, setPlanData] = useState(emptyPlan);
  const lastAutoObjetivoRef = useRef('');
  const [actividadForm, setActividadForm] = useState(emptyActividad);
  const [actividades, setActividades] = useState([]);

  const combinedRows = useMemo(() => {
    const remote = Array.isArray(sourceRows) ? sourceRows : [];
    return [...remote, ...actividades];
  }, [sourceRows, actividades]);

  const catalogs = useMemo(() => {
    const buildList = (values, { clean = false } = {}) => {
      const map = new Map();
      values.forEach((item) => {
        const raw = String(item || '').replace(/\s+/g, ' ').trim();
        if (!raw) return;
        const label = clean ? cleanCatalogLabel(raw) : raw;
        if (!label) return;
        const key = normalizeCatalogKey(label);
        if (!key || map.has(key)) return;
        map.set(key, label);
      });
      return Array.from(map.values()).sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));
    };

    const peds = buildList(combinedRows.map((row) => row.ped));
    return {
      anios: FIXED_PLAN_YEARS,
      peds: peds.length ? peds : ['PED 2022-2029'],
      estados: ['Borrador', 'En revisión', 'Listo para acta', 'Listo para exportación'],
      responsables: buildList(combinedRows.flatMap((row) => [row.responsable, row.corresponsable]), { clean: true }),
      dependencias: buildList(combinedRows.map((row) => row.dependencia || row.responsable), { clean: true }),
      objetivos: buildList(combinedRows.map((row) => row.objetivo_estrategico)),
      lineamientos: buildList(combinedRows.map((row) => row.lineamiento_estrategico)),
      macroactividades: buildList(combinedRows.map((row) => row.macroactividad)),
      actividades: buildList(combinedRows.map((row) => row.actividad)),
      tiposIndicador: buildList(combinedRows.map((row) => row.tipo_indicador)),
      indicadores: buildList(combinedRows.map((row) => row.indicador))
    };
  }, [combinedRows]);

  const filteredLineamientos = useMemo(() => {
    if (!actividadForm.objetivo_estrategico) return catalogs.lineamientos;
    return Array.from(new Set(
      combinedRows
        .filter((row) => row.objetivo_estrategico === actividadForm.objetivo_estrategico)
        .map((row) => row.lineamiento_estrategico)
        .filter(Boolean)
    )).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [actividadForm.objetivo_estrategico, catalogs.lineamientos, combinedRows]);

  const filteredMacroactividades = useMemo(() => {
    return Array.from(new Set(
      combinedRows
        .filter((row) => !actividadForm.objetivo_estrategico || row.objetivo_estrategico === actividadForm.objetivo_estrategico)
        .filter((row) => !actividadForm.lineamiento_estrategico || row.lineamiento_estrategico === actividadForm.lineamiento_estrategico)
        .map((row) => row.macroactividad)
        .filter(Boolean)
    )).sort((a, b) => String(a).localeCompare(String(b), 'es'));
  }, [actividadForm.objetivo_estrategico, actividadForm.lineamiento_estrategico, combinedRows]);

  useEffect(() => {
    try {
      const storedWorkspace = localStorage.getItem(WORKSPACE_KEY);
      const storedSavedPlans = localStorage.getItem(SAVED_PLANS_KEY);
      if (storedWorkspace) {
        const parsed = JSON.parse(storedWorkspace);
        setPlanData({ ...emptyPlan, ...(parsed.planData || {}) });
        setActividadForm({ ...emptyActividad, ...(parsed.actividadForm || {}) });
        setActividades(Array.isArray(parsed.actividades) ? parsed.actividades : []);
      }
      if (storedSavedPlans) {
        const parsedPlans = JSON.parse(storedSavedPlans);
        setSavedPlans(Array.isArray(parsedPlans) ? parsedPlans : []);
      }
    } catch (error) {
      console.warn('No se pudo recuperar el workspace local de planes:', error);
    }
  }, [emptyActividad, emptyPlan]);

  useEffect(() => {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ planData, actividadForm, actividades }));
  }, [planData, actividadForm, actividades]);

  const buildObjetivoSesion = (data = {}) => {
    const estado = String(data.estado || '').trim();
    const dependencia = String(data.dependencia || '').trim();
    const anio = String(data.anio || '').trim();

    if (!estado || !dependencia) return '';

    const espacioAnio = anio ? `${anio} ` : '';
    const planFraseBase = `Plan de Acción ${espacioAnio}de la ${dependencia}`;

    switch (estado) {
      case 'Borrador':
        return `Formular el ${planFraseBase}, mediante un proceso colaborativo para definir acciones, indicadores, metas y compromisos institucionales.`;
      case 'En revisión':
        return `Validar la versión preliminar del ${planFraseBase}, identificando ajustes y oportunidades de mejora previas a su formalización institucional.`;
      case 'Listo para acta':
        return `Consolidar el ${planFraseBase}, dejando los insumos institucionales necesarios para su formalización mediante acta de reunión, con la participación de los responsables y corresponsables del plan.`;
      case 'Listo para exportación':
        return `Formalizar el ${planFraseBase}, para su exportación oficial al formato institucional vigente y posterior socialización con las instancias competentes.`;
      default:
        return `Definir el ${planFraseBase}.`;
    }
  };

  useEffect(() => {
    const generated = buildObjetivoSesion(planData);
    if (!generated) return;
    const current = String(planData.objetivoSesion || '').trim();
    if (current === '' || current === lastAutoObjetivoRef.current) {
      if (generated !== current) {
        lastAutoObjetivoRef.current = generated;
        setPlanData((prev) => ({ ...prev, objetivoSesion: generated }));
      } else {
        lastAutoObjetivoRef.current = generated;
      }
    }
  }, [planData.estado, planData.dependencia, planData.anio]);

  const calculateTotal = (ip, iip) => {
    const left = Number(ip || 0);
    const right = Number(iip || 0);
    if (left <= 0 && right <= 0) return '0';
    return String(Number((((left + right) / 2)).toFixed(2)));
  };

  const handlePlanField = (key, value) => {
    setPlanData((prev) => ({ ...prev, [key]: value }));
  };

  const handleActividadField = (key, value) => {
    setActividadForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'objetivo_estrategico') {
        next.lineamiento_estrategico = '';
        next.macroactividad = '';
        next.actividad = '';
        next.indicador = '';
      }
      if (key === 'lineamiento_estrategico') {
        next.macroactividad = '';
        next.actividad = '';
        next.indicador = '';
      }
      if (key === 'macroactividad') {
        next.actividad = '';
        next.indicador = '';
      }
      if (key === 'actividad') {
        next.indicador = '';
      }
      if (key === 'avance_ip' || key === 'avance_iip') {
        next.total_ejecucion = calculateTotal(key === 'avance_ip' ? value : next.avance_ip, key === 'avance_iip' ? value : next.avance_iip);
      }
      return next;
    });
  };

  const autogenerateIndicator = async () => {
    if (generatingIndicator) return;
    const actividadTexto = normalizeSentence(actividadForm.actividad);
    if (!actividadTexto) {
      enqueueSnackbar('Primero redacta la actividad para poder sugerir el indicador.', { variant: 'warning' });
      return;
    }

    setGeneratingIndicator(true);
    try {
      const response = await gestionInformacionService.sugerirIndicadorPlanAccion(actividadForm.actividad);
      const data = response?.data;
      if (!data?.bullets) {
        enqueueSnackbar('No se pudieron generar los indicadores. Inténtalo nuevamente.', { variant: 'error' });
        return;
      }
      setActividadForm((prev) => ({
        ...prev,
        tipo_indicador: data.tipo || prev.tipo_indicador,
        indicador: data.bullets
      }));
      setAiSuggestion({
        tituloGeneral: data.tituloGeneral || data.titulo_general || '',
        resumen: data.resumen ?? '',
        indicadores: Array.isArray(data.indicadores) ? data.indicadores : [],
        fuentes: Array.isArray(data.fuentes) ? data.fuentes : []
      });
      setShowRawIndicador(false);
      setShowAiSources(false);
      enqueueSnackbar('Indicadores generados.', { variant: 'success' });
    } catch (error) {
      const code = error?.response?.data?.code;
      if (code === 'GEMINI_NOT_CONFIGURED') {
        enqueueSnackbar('El generador automático no está disponible en el servidor.', { variant: 'error' });
      } else if (error?.code === 'ECONNABORTED' || /timeout/i.test(error?.message || '')) {
        enqueueSnackbar('La generación tardó más de lo esperado. Intenta de nuevo.', { variant: 'warning' });
      } else {
        enqueueSnackbar('No se pudieron generar los indicadores. Inténtalo nuevamente.', { variant: 'error' });
      }
    } finally {
      setGeneratingIndicator(false);
    }
  };

  const resetActividadForm = () => {
    setActividadForm({
      ...emptyActividad,
      anio: planData.anio || emptyActividad.anio,
      ped: planData.ped || emptyActividad.ped
    });
    setEditingId(null);
  };

  const addActividad = () => {
    if (!actividadForm.actividad.trim() || !actividadForm.indicador.trim()) {
      enqueueSnackbar('Completa al menos Actividad e Indicador para agregar la fila.', { variant: 'warning' });
      return;
    }

    const payload = {
      ...actividadForm,
      id: editingId || Date.now(),
      anio: actividadForm.anio || planData.anio,
      ped: actividadForm.ped || planData.ped,
      responsable: actividadForm.responsable || '',
      corresponsable: actividadForm.corresponsable || '',
      total_ejecucion: calculateTotal(actividadForm.avance_ip, actividadForm.avance_iip)
    };

    setActividades((prev) => editingId ? prev.map((item) => (item.id === editingId ? payload : item)) : [...prev, payload]);
    enqueueSnackbar(editingId ? 'Actividad actualizada en el borrador.' : 'Actividad agregada al plan.', { variant: 'success' });
    resetActividadForm();
  };

  const editActividad = (item) => {
    setActividadForm({ ...item });
    setEditingId(item.id);
    setWorkspaceTab('constructor');
  };

  const removeActividad = (id) => {
    setActividades((prev) => prev.filter((item) => item.id !== id));
    if (editingId === id) resetActividadForm();
  };

  const saveCurrentPlan = () => {
    const record = {
      id: Date.now(),
      savedAt: new Date().toISOString(),
      planData,
      actividades
    };
    const next = [record, ...savedPlans].slice(0, 12);
    setSavedPlans(next);
    localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(next));
    enqueueSnackbar('Borrador guardado localmente.', { variant: 'success' });
  };

  const removeSavedPlan = (id) => {
    const next = savedPlans.filter((record) => record.id !== id);
    setSavedPlans(next);
    localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify(next));
    enqueueSnackbar('Borrador eliminado de este navegador.', { variant: 'info' });
  };

  const clearSavedPlans = () => {
    setSavedPlans([]);
    localStorage.setItem(SAVED_PLANS_KEY, JSON.stringify([]));
    enqueueSnackbar('Se limpiaron los borradores locales de este navegador.', { variant: 'info' });
  };

  const loadSavedPlan = (record) => {
    setPlanData({ ...emptyPlan, ...(record.planData || {}) });
    setActividades(Array.isArray(record.actividades) ? record.actividades : []);
    resetActividadForm();
    setWorkspaceTab('constructor');
    enqueueSnackbar('Borrador cargado en el workspace.', { variant: 'info' });
  };

  const triggerDownload = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const exportInstitutionalTemplate = async () => {
    if (!actividades.length) {
      enqueueSnackbar('Agrega al menos una actividad antes de exportar.', { variant: 'warning' });
      return;
    }
    setExporting(true);
    try {
      const response = await gestionInformacionService.exportPlanAccionPlantilla({
        planData: {
          anio: planData.anio,
          nombrePlan: planData.dependencia,
          codigoPlan: planData.codigoPlan || planData.dependencia,
          dependencia: planData.dependencia,
          ped: planData.ped
        },
        actividades
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fname = `plan_accion_${(planData.dependencia || 'plan').replace(/\s+/g, '_')}_${planData.anio || new Date().getFullYear()}.xlsx`;
      triggerDownload(blob, fname);
      enqueueSnackbar('Plantilla institucional generada con formato oficial.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || error?.message || 'No se pudo exportar la plantilla institucional.', { variant: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const actaPreviewData = useMemo(() => {
    // Participantes únicos derivados de las actividades.
    // Cada nombre aparece UNA sola vez. Si una persona figura como responsable en
    // alguna actividad, queda con ese cargo aunque sea corresponsable en otra.
    const participantesMap = new Map();
    actividades.forEach((act) => {
      const nombre = String(act?.responsable || '').trim();
      if (nombre && !participantesMap.has(nombre)) {
        participantesMap.set(nombre, { nombre, cargo: 'Responsable de Ejecución' });
      }
    });
    actividades.forEach((act) => {
      const nombre = String(act?.corresponsable || '').trim();
      if (nombre && !participantesMap.has(nombre)) {
        participantesMap.set(nombre, { nombre, cargo: 'Corresponsable' });
      }
    });
    const participantes = Array.from(participantesMap.values());

    // Lista de responsables únicos (texto legible para el campo "Responsable(s)" del acta).
    const responsablesUnicos = Array.from(new Set(
      actividades.map((act) => String(act?.responsable || '').trim()).filter(Boolean)
    ));

    const actividadesActa = actividades.slice(0, 12).map((item, index) => {
      const indicador = item.indicador ? ` — Indicador: ${item.indicador}` : '';
      const meta = item.meta ? ` | Meta: ${item.meta}` : '';
      return `${index + 1}. ${item.actividad || 'Actividad sin nombre'}${indicador}${meta}`;
    });

    const observacionesActa = actividades
      .flatMap((item) => [item.observaciones_ip, item.observaciones_iip])
      .map((text) => (text ? String(text).trim() : ''))
      .filter(Boolean);

    const desarrollo = [
      `En la sesión del ${planData.fechaReunion || 'fecha por definir'}, el componente de Planeación y Efectividad lideró la construcción del Plan de Acción ${planData.anio || ''} de la ${planData.dependencia || 'dependencia responsable'}.`,
      '',
      'Actividades consolidadas:',
      ...(actividadesActa.length ? actividadesActa : ['- No se han agregado actividades todavía.']),
      '',
      observacionesActa.length ? 'Observaciones relevantes de la sesión:' : '',
      ...observacionesActa.map((obs, index) => `${index + 1}. ${obs}`),
      '',
      audioFile
        ? `Audio de apoyo: se adjuntó "${audioFile.name}" para transcripción temporal.`
        : 'No se adjuntó audio temporal en esta sesión.'
    ].filter((line) => line !== '');

    const conclusiones = observacionesActa.length
      ? observacionesActa.map((obs, index) => `${index + 1}. ${obs}`)
      : ['1. Pendiente registrar compromisos y próximas acciones derivadas de la sesión.'];

    const objetivoTexto = planData.objetivoSesion ||
      buildObjetivoSesion(planData) ||
      `Formular el Plan de Acción ${planData.anio || ''} de la ${planData.dependencia || 'dependencia responsable'}.`;

    return {
      responsables: responsablesUnicos.join(', '),
      dependencia: DEPENDENCIA_QUE_CITA_FIJA,
      lugar: planData.lugarReunion || '',
      fecha: planData.fechaReunion || '',
      horario: planData.horarioReunion || '',
      participantes,
      objetivo: [objetivoTexto],
      desarrollo,
      conclusiones
    };
  }, [actividades, audioFile, planData]);

  const exportActaWord = async () => {
    try {
      const payload = {
        anio: planData.anio,
        codigoPlan: planData.codigoPlan || planData.dependencia,
        ...actaPreviewData
      };

      const response = await gestionInformacionService.exportPlanAccionActa(payload);
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
      const fname = `acta_asistencia_reunion_${(planData.dependencia || 'plan').replace(/\s+/g, '_')}_${planData.anio || new Date().getFullYear()}.docx`;
      triggerDownload(blob, fname);
      enqueueSnackbar('Acta institucional generada con formato oficial.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || error?.message || 'No se pudo exportar el acta institucional.', { variant: 'error' });
    }
  };

  const totalObservaciones = actividades.reduce((acc, item) => acc + (item.observaciones_ip ? 1 : 0) + (item.observaciones_iip ? 1 : 0), 0);
  const cards = [
    { label: 'Actividades cargadas', value: actividades.length, tone: '#2563eb' },
    { label: 'Observaciones para acta', value: totalObservaciones, tone: '#f97316' },
    { label: 'Audio temporal', value: audioFile ? 1 : 0, tone: '#10b981' }
  ];

  const steps = [
    { title: 'Paso 1', subtitle: 'Configura el plan', detail: 'Define año, PED, responsables y dependencia.' },
    { title: 'Paso 2', subtitle: 'Carga actividades', detail: 'Selecciona estructura estratégica y completa el indicador.' },
    { title: 'Paso 3', subtitle: 'Revisa el plan vivo', detail: 'Valida la tabla antes de guardar el borrador.' },
    { title: 'Paso 4', subtitle: 'Acta y exportación', detail: 'Genera el acta preliminar y la plantilla institucional.' }
  ];

  const renderSelectField = (label, value, onChange, options, helperText = '', config = {}) => {
    const safeOptions = Array.isArray(options) ? options.filter((opt) => opt !== null && opt !== undefined && String(opt).trim() !== '') : [];
    const isFreeSolo = Boolean(config.freeSolo);
    const currentValue = value === null || value === undefined || value === ''
      ? (isFreeSolo ? '' : null)
      : String(value);
    return (
      <Box sx={{ width: '100%' }}>
        <Autocomplete
          size="small"
          fullWidth
          freeSolo={isFreeSolo}
          value={currentValue}
          onChange={(_, newValue) => onChange(newValue || '')}
          onInputChange={isFreeSolo ? (_, newInput) => onChange(newInput || '') : undefined}
          options={safeOptions}
          isOptionEqualToValue={(option, val) => String(option || '') === String(val || '')}
          autoHighlight
          clearOnEscape
          blurOnSelect={!isFreeSolo}
          handleHomeEndKeys
          noOptionsText="Sin coincidencias"
          slotProps={{
            paper: { sx: { maxWidth: config.menuMaxWidth || 560 } },
            listbox: {
              sx: {
                '& .MuiAutocomplete-option': {
                  whiteSpace: 'normal',
                  lineHeight: 1.35,
                  alignItems: 'flex-start'
                }
              }
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              label={label}
              size="small"
              placeholder={config.placeholder || 'Escribe para buscar...'}
            />
          )}
        />
        {helperText ? <Typography sx={{ mt: 0.6, fontSize: 11, color: '#94a3b8' }}>{helperText}</Typography> : null}
      </Box>
    );
  };

  return (
    <Stack spacing={2.4}>
      <Paper elevation={0} sx={{ p: { xs: 2.4, md: 3 }, borderRadius: 4, color: 'white', overflow: 'hidden', position: 'relative', background: 'radial-gradient(circle at top left, rgba(255,255,255,.16) 0%, rgba(255,255,255,0) 32%), linear-gradient(135deg, #0f172a 0%, #153e75 45%, #2563eb 100%)' }}>
        <Box sx={{ position: 'absolute', right: -30, top: -40, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.08)' }} />
        <Stack spacing={1.2} sx={{ position: 'relative', zIndex: 1 }}>
          <Chip label="Operación + acta automática" sx={{ alignSelf: 'flex-start', bgcolor: 'rgba(255,255,255,.14)', color: 'white', fontWeight: 900 }} />
          <Typography sx={{ fontSize: { xs: 28, md: 38 }, fontWeight: 900, letterSpacing: -0.8, lineHeight: 1 }}>Gestión de Planes de Acción</Typography>
          <Typography sx={{ maxWidth: 980, color: 'rgba(255,255,255,.88)' }}>
            El profesional construye el plan, alimenta observaciones y el sistema le prepara el acta preliminar y la plantilla institucional desde el mismo flujo.
          </Typography>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        {cards.map((card) => (
          <Paper key={card.label} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 10px 24px rgba(15,23,42,.05)' }}>
            <Typography sx={{ fontSize: 11, textTransform: 'uppercase', fontWeight: 800, color: '#64748b' }}>{card.label}</Typography>
            <Typography sx={{ fontSize: 34, lineHeight: 1, fontWeight: 900, color: card.tone, mt: 1 }}>{formatNumber(card.value)}</Typography>
          </Paper>
        ))}
      </Box>

      <Paper elevation={0} sx={{ p: 0.8, borderRadius: 3.5, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
        <Tabs value={workspaceTab} onChange={(_, next) => setWorkspaceTab(next)} variant="fullWidth" sx={{ minHeight: 60, '& .MuiTabs-indicator': { height: 0 }, '& .MuiTabs-flexContainer': { gap: 1 }, '& .MuiTab-root': { textTransform: 'none', fontWeight: 900, minHeight: 52, borderRadius: 2.5, color: '#64748b' }, '& .MuiTab-root.Mui-selected': { color: '#1d4ed8', background: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)', boxShadow: 'inset 0 0 0 1px rgba(59,130,246,.22)' } }}>
          <Tab value="constructor" icon={<AssignmentTurnedInIcon fontSize="small" />} iconPosition="start" label={'Paso 1 · Plan y Actividades'} />
          <Tab value="acta" icon={<AutoAwesomeIcon fontSize="small" />} iconPosition="start" label={'Paso 2 · Acta IA'} />
          <Tab value="exportacion" icon={<DownloadIcon fontSize="small" />} iconPosition="start" label={'Paso 3 · Exportación'} />
          <Tab value="listado" icon={<DescriptionIcon fontSize="small" />} iconPosition="start" label="Borradores" />
        </Tabs>
      </Paper>

{workspaceTab === 'listado' && (
        <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
          <SectionTitle title="Borradores Disponibles" subtitle="Sesiones guardadas localmente en este navegador para continuar sin perder avance." />
          {!!savedPlans.length && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 1.6 }}>
              <Alert severity="info" sx={{ borderRadius: 3, flex: 1 }}>
                Estos borradores son locales del navegador actual. Puedes cargarlos o eliminarlos cuando quieras.
              </Alert>
              <Button startIcon={<DeleteOutlineIcon />} color="error" variant="outlined" onClick={clearSavedPlans} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>
                Borrar todos
              </Button>
            </Stack>
          )}
          <Stack spacing={1.4}>
            {savedPlans.length ? savedPlans.map((record) => (
              <Paper key={record.id} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbeafe', boxShadow: '0 10px 24px rgba(15,23,42,.04)' }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>{record.planData?.dependencia || 'Plan sin dependencia'}</Typography>
                    <Typography sx={{ color: '#64748b', mt: 0.4 }}>
                      Año {record.planData?.anio || '-'} — {record.planData?.responsable || 'Sin responsable'} — {formatNumber((record.actividades || []).length)} actividades
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    <Button variant="contained" onClick={() => loadSavedPlan(record)} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Cargar borrador</Button>
                    <Button startIcon={<DeleteOutlineIcon />} color="error" variant="outlined" onClick={() => removeSavedPlan(record.id)} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>
                      Eliminar
                    </Button>
                  </Stack>
                </Stack>
              </Paper>
            )) : (
              <Alert severity="info" sx={{ borderRadius: 3 }}>
                Aún no hay borradores guardados en este navegador. Empieza por <strong>Paso 1 · Plan y Actividades</strong> y guarda la sesión si quieres retomarla después.
              </Alert>
            )}
          </Stack>
        </Paper>
      )}

      {workspaceTab === 'constructor' && (
        <Stack spacing={2}>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' } }}>
            {steps.map((step) => (
              <Paper key={step.title} elevation={0} sx={{ p: 1.6, borderRadius: 3, border: '1px solid #dbeafe', background: '#fff', minHeight: 120 }}>
                <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#2563eb', textTransform: 'uppercase' }}>{step.title}</Typography>
                <Typography sx={{ mt: 0.6, fontSize: 16, fontWeight: 900, color: '#0f172a' }}>{step.subtitle}</Typography>
                <Typography sx={{ mt: 0.6, fontSize: 12.5, color: '#64748b', lineHeight: 1.6 }}>{step.detail}</Typography>
              </Paper>
            ))}
          </Box>

          <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
            <SectionTitle title="Paso 1 · Datos Base del Plan" subtitle="Empieza por la cabecera general y reutiliza listas institucionales donde ya exista información." />
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', xl: 'repeat(4, minmax(0, 1fr))' } }}>
              <Box sx={{ gridColumn: { xs: 'auto', xl: 'span 2' } }}>
                {renderSelectField('Dependencia / Unidad', planData.dependencia, (value) => handlePlanField('dependencia', value), catalogs.dependencias, '', { menuMaxWidth: 760 })}
              </Box>
              {renderSelectField('Año', planData.anio, (value) => handlePlanField('anio', value), catalogs.anios.length ? catalogs.anios : [String(new Date().getFullYear())])}
              {renderSelectField('PED', planData.ped, (value) => handlePlanField('ped', value), catalogs.peds)}
              {renderSelectField('Estado', planData.estado, (value) => handlePlanField('estado', value), catalogs.estados)}
              <TextField label="Fecha de reunión" type="date" value={planData.fechaReunion} onChange={(e) => handlePlanField('fechaReunion', e.target.value)} fullWidth InputLabelProps={{ shrink: true }} />
              <Box sx={{ gridColumn: { xs: 'auto', xl: 'span 2' } }}>
                {renderSelectField('Lugar / medio', planData.lugarReunion, (value) => handlePlanField('lugarReunion', value), LUGARES_REUNION, '', { freeSolo: true, placeholder: 'Selecciona o escribe el lugar / medio' })}
              </Box>
            </Box>
            <Box sx={{ position: 'relative', mt: 1.4 }}>
              <TextField
                label="Objetivo de la sesión"
                value={planData.objetivoSesion}
                onChange={(e) => handlePlanField('objetivoSesion', e.target.value)}
                fullWidth
                multiline
                minRows={2}
                maxRows={6}
              />
              <Tooltip
                arrow
                placement="top"
                title="Se construye automáticamente a partir del Estado, nombre del plan y dependencia. Puedes editarlo manualmente."
              >
                <IconButton
                  size="small"
                  sx={{ position: 'absolute', top: 4, right: 6, p: 0.4, color: '#94a3b8' }}
                  aria-label="Ayuda sobre el objetivo de la sesión"
                >
                  <HelpOutlineIcon sx={{ fontSize: 16 }} />
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <SectionTitle title="Paso 2 · Registrar Actividad" subtitle="Selecciona primero la estructura estratégica y luego completa el indicador y la medición." />
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' } }}>
              {renderSelectField('Objetivo estratégico', actividadForm.objetivo_estrategico, (value) => handleActividadField('objetivo_estrategico', value), catalogs.objetivos, '', { menuMaxWidth: 760 })}
              {renderSelectField('Lineamiento estratégico', actividadForm.lineamiento_estrategico, (value) => handleActividadField('lineamiento_estrategico', value), filteredLineamientos)}
              {renderSelectField('Macroactividad estratégica', actividadForm.macroactividad, (value) => handleActividadField('macroactividad', value), filteredMacroactividades)}
            </Box>
            <Box sx={{ mt: 1.4 }}>
              <TextField label="Actividad" size="small" value={actividadForm.actividad} onChange={(e) => handleActividadField('actividad', e.target.value)} placeholder="Redacta aquí la actividad concreta." fullWidth />
            </Box>
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, mt: 1.4 }}>
              {renderSelectField('Responsable de la actividad', actividadForm.responsable, (value) => handleActividadField('responsable', value), catalogs.responsables)}
              {renderSelectField('Corresponsable de la actividad', actividadForm.corresponsable, (value) => handleActividadField('corresponsable', value), catalogs.responsables)}
            </Box>
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' }, mt: 1.4 }}>
              {renderSelectField('Tipo de indicador', actividadForm.tipo_indicador, (value) => handleActividadField('tipo_indicador', value), catalogs.tiposIndicador)}
              <TextField label="Meta" size="small" value={actividadForm.meta} onChange={(e) => handleActividadField('meta', e.target.value)} />
              <TextField label="Fecha inicio" size="small" type="date" value={actividadForm.fecha_inicio} onChange={(e) => handleActividadField('fecha_inicio', e.target.value)} InputLabelProps={{ shrink: true }} />
              <TextField label="Fecha fin" size="small" type="date" value={actividadForm.fecha_fin} onChange={(e) => handleActividadField('fecha_fin', e.target.value)} InputLabelProps={{ shrink: true }} />
            </Box>
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, mt: 1.4 }}>
              <TextField label="Avance IP (%)" size="small" type="number" inputProps={{ min: 0, max: 100, step: 1 }} value={actividadForm.avance_ip} onChange={(e) => handleActividadField('avance_ip', e.target.value)} />
              <TextField label="Avance IIP (%)" size="small" type="number" inputProps={{ min: 0, max: 100, step: 1 }} value={actividadForm.avance_iip} onChange={(e) => handleActividadField('avance_iip', e.target.value)} />
              <TextField
                label="Total ejecución (%)"
                size="small"
                value={actividadForm.total_ejecucion}
                InputProps={{ readOnly: true }}
                disabled
                helperText="Promedio automático de Avance IP e IIP"
              />
            </Box>
            <Box sx={{ mt: 1.6 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 0.8 }}>
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: .3 }}>
                    Indicador
                  </Typography>
                  <Tooltip title="Genera una sugerencia a partir del objetivo, lineamiento, macroactividad y actividad redactada.">
                    <IconButton size="small" sx={{ color: '#94a3b8', p: 0.2 }}>
                      <HelpOutlineIcon sx={{ fontSize: 16 }} />
                    </IconButton>
                  </Tooltip>
                </Stack>
                <Button
                  size="small"
                  startIcon={generatingIndicator ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <AutoAwesomeIcon fontSize="small" />}
                  variant={generatingIndicator ? 'contained' : 'outlined'}
                  onClick={autogenerateIndicator}
                  disabled={generatingIndicator}
                  sx={{
                    alignSelf: { xs: 'flex-start', sm: 'auto' },
                    borderRadius: 999,
                    textTransform: 'none',
                    fontWeight: 800,
                    px: 1.4,
                    minWidth: 0,
                    minHeight: 32,
                    ...(generatingIndicator ? { bgcolor: '#1d4ed8', color: '#fff', '&:hover': { bgcolor: '#1e40af' } } : {})
                  }}
                >
                  {generatingIndicator ? 'Generando…' : 'Generar desde la actividad'}
                </Button>
              </Stack>
              {aiSuggestion && (Array.isArray(aiSuggestion.indicadores) && aiSuggestion.indicadores.length > 0) ? (
                <Stack spacing={1.4}>
                  {aiSuggestion.tituloGeneral && (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Chip
                        size="small"
                        icon={<AutoAwesomeIcon sx={{ fontSize: 14 }} />}
                        label={aiSuggestion.tituloGeneral}
                        sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 800, border: '1px solid #bfdbfe' }}
                      />
                    </Stack>
                  )}

                  {aiSuggestion.resumen && (Array.isArray(aiSuggestion.resumen) ? aiSuggestion.resumen.length > 0 : true) && (
                    <Paper elevation={0} sx={{ p: 1.8, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                      <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 1.1 }}>
                        <MenuBookIcon sx={{ fontSize: 16, color: '#475569' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#475569', textTransform: 'uppercase', letterSpacing: .4 }}>
                          Hallazgos del contexto
                        </Typography>
                      </Stack>
                      {Array.isArray(aiSuggestion.resumen) ? (
                        <Stack spacing={1}>
                          {aiSuggestion.resumen.map((item, index) => (
                            <Box key={index} sx={{ p: 1.1, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                              <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#0f172a', mb: 0.3, lineHeight: 1.4 }}>
                                {item.title || `Hallazgo ${index + 1}`}
                              </Typography>
                              {item.summary && (
                                <Typography sx={{ fontSize: 13, color: '#475569', lineHeight: 1.55 }}>
                                  {item.summary}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      ) : (
                        <Typography sx={{ fontSize: 13.5, color: '#334155', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                          {aiSuggestion.resumen}
                        </Typography>
                      )}
                    </Paper>
                  )}

                  <Paper elevation={0} sx={{ p: 1.8, borderRadius: 3, border: '1px solid #c7d2fe', background: 'linear-gradient(180deg,#ffffff 0%,#eef2ff 100%)' }}>
                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 1.2 }}>
                      <InsightsIcon sx={{ fontSize: 18, color: '#4338ca' }} />
                      <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#4338ca', textTransform: 'uppercase', letterSpacing: .4 }}>
                        Indicadores sugeridos
                      </Typography>
                    </Stack>
                    <Stack spacing={1}>
                      {aiSuggestion.indicadores.map((item, index) => (
                        <Stack key={index} direction="row" spacing={1.2} alignItems="flex-start">
                          <Box sx={{
                            flexShrink: 0,
                            width: 26,
                            height: 26,
                            borderRadius: '50%',
                            bgcolor: '#4338ca',
                            color: '#fff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 12,
                            fontWeight: 900,
                            mt: 0.2
                          }}>
                            {index + 1}
                          </Box>
                          <Typography sx={{ fontSize: 14, color: '#1e1b4b', lineHeight: 1.55, flex: 1 }}>
                            {String(item).trim()}
                          </Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Paper>

                  {Array.isArray(aiSuggestion.fuentes) && aiSuggestion.fuentes.length > 0 && (
                    <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                      <Stack
                        direction="row"
                        spacing={0.8}
                        alignItems="center"
                        onClick={() => setShowAiSources((v) => !v)}
                        sx={{ cursor: 'pointer', userSelect: 'none' }}
                      >
                        <OpenInNewIcon sx={{ fontSize: 16, color: '#0f766e' }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#0f766e', textTransform: 'uppercase', letterSpacing: .4 }}>
                          Fuentes consultadas ({aiSuggestion.fuentes.length})
                        </Typography>
                        <Box sx={{ flex: 1 }} />
                        <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#0f766e' }}>
                          {showAiSources ? 'Ocultar' : 'Ver'}
                        </Typography>
                      </Stack>
                      {showAiSources && (
                        <Stack spacing={0.7} sx={{ mt: 1 }}>
                          {aiSuggestion.fuentes.map((src, index) => (
                            <Box key={index} sx={{ p: 1, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                              <MuiLink
                                href={src.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                underline="hover"
                                sx={{ fontWeight: 800, fontSize: 13, color: '#0f172a', display: 'inline-flex', alignItems: 'center', gap: 0.6 }}
                              >
                                {index + 1}. {src.title || src.url}
                                <OpenInNewIcon sx={{ fontSize: 13, color: '#64748b' }} />
                              </MuiLink>
                              {src.snippet && (
                                <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.3, lineHeight: 1.5 }}>
                                  {src.snippet}
                                </Typography>
                              )}
                            </Box>
                          ))}
                        </Stack>
                      )}
                    </Paper>
                  )}

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ pt: 0.4 }}>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<EditIcon fontSize="small" />}
                      onClick={() => setShowRawIndicador((v) => !v)}
                      sx={{ textTransform: 'none', fontWeight: 800, color: '#475569' }}
                    >
                      {showRawIndicador ? 'Ocultar texto editable' : 'Editar texto'}
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      onClick={() => { setAiSuggestion(null); setShowRawIndicador(false); handleActividadField('indicador', ''); }}
                      sx={{ textTransform: 'none', fontWeight: 800, color: '#b91c1c' }}
                    >
                      Limpiar sugerencia
                    </Button>
                  </Stack>

                  {showRawIndicador && (
                    <TextField
                      value={actividadForm.indicador}
                      onChange={(e) => handleActividadField('indicador', e.target.value)}
                      multiline
                      minRows={6}
                      fullWidth
                      helperText="Este es el texto que se guarda en la actividad y se exporta. Puedes editarlo manualmente."
                    />
                  )}
                </Stack>
              ) : (
                <TextField value={actividadForm.indicador} onChange={(e) => handleActividadField('indicador', e.target.value)} multiline minRows={6} fullWidth placeholder="Redacta la actividad y presiona 'Generar desde la actividad' para que la IA proponga los pasos e indicadores clave." />
              )}
            </Box>
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, mt: 1.6 }}>
              <TextField label="Observaciones IP" size="small" value={actividadForm.observaciones_ip} onChange={(e) => handleActividadField('observaciones_ip', e.target.value)} multiline minRows={4} />
              <TextField label="Observaciones IIP" size="small" value={actividadForm.observaciones_iip} onChange={(e) => handleActividadField('observaciones_iip', e.target.value)} multiline minRows={4} />
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.2, borderRadius: 4, border: '1px solid #dbeafe', background: '#f8fbff' }}>
            <SectionTitle title="Paso 3 · Revisar y Guardar" subtitle="Antes de continuar, guarda el borrador o agrega la actividad al plan vivo." />
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2}>
              <Button startIcon={<SaveIcon />} variant="contained" onClick={addActividad} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>
                {editingId ? 'Actualizar actividad' : 'Agregar actividad'}
              </Button>
              <Button startIcon={<FilterAltOffIcon />} variant="outlined" onClick={resetActividadForm} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Limpiar formulario</Button>
              <Button startIcon={<SaveIcon />} variant="outlined" onClick={saveCurrentPlan} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Guardar borrador</Button>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.8, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <SectionTitle title="Plan Vivo" subtitle="Valida en tiempo real cómo va quedando el plan antes de pasar al acta y la exportación." />
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {['Actividad', 'Indicador', 'Meta', 'IP', 'IIP', 'Total', 'Observaciones', 'Acciones'].map((header) => <TableCell key={header} sx={{ fontWeight: 900, bgcolor: '#f8fafc' }}>{header}</TableCell>)}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {actividades.map((item) => (
                    <TableRow key={item.id} hover>
                      <TableCell sx={{ minWidth: 220 }}>{item.actividad}</TableCell>
                      <TableCell sx={{ minWidth: 240 }}>{item.indicador}</TableCell>
                      <TableCell>{item.meta}</TableCell>
                      <TableCell>{item.avance_ip}%</TableCell>
                      <TableCell>{item.avance_iip}%</TableCell>
                      <TableCell>{item.total_ejecucion}%</TableCell>
                      <TableCell sx={{ minWidth: 260 }}>{item.observaciones_ip || item.observaciones_iip || '—'}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          <IconButton size="small" onClick={() => editActividad(item)}><EditIcon fontSize="small" /></IconButton>
                          <IconButton size="small" color="error" onClick={() => removeActividad(item.id)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!actividades.length && (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 6, color: '#64748b' }}>Aún no se han agregado actividades al plan.</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}

      {workspaceTab === 'acta' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '.9fr 1.1fr' } }}>
          <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
            <SectionTitle title="Acta Asistida por IA" subtitle="El acta se alimenta de observaciones, actividades y audio temporal." />
            <Stack spacing={1.4}>
              <Button component="label" startIcon={<UploadFileIcon />} variant="outlined" sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>
                Adjuntar audio temporal
                <input type="file" hidden accept="audio/*" onChange={(e) => setAudioFile(e.target.files?.[0] || null)} />
              </Button>
              {audioFile ? (
                <Alert severity="success" sx={{ borderRadius: 3 }}>
                  Audio cargado: <strong>{audioFile.name}</strong>. Debe procesarse de forma volátil para transcripción IA.
                </Alert>
              ) : (
                <Alert severity="info" sx={{ borderRadius: 3 }}>
                  Puedes usar el audio de la sesión como apoyo para IA. La recomendación es procesarlo temporalmente y no almacenarlo.
                </Alert>
              )}
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #fde68a', bgcolor: '#fffbeb' }}>
                <Typography sx={{ fontWeight: 900, color: '#92400e', mb: 0.8 }}>Solución poderosa recomendada</Typography>
                <Typography sx={{ color: '#78350f' }}>
                  Mientras el profesional crea actividades y escribe observaciones, el sistema consolida un borrador de acta. Si se adjunta audio, la siguiente fase del backend puede transcribir y enriquecer el acta automáticamente.
                </Typography>
              </Paper>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
                <Typography sx={{ fontWeight: 900, color: '#1d4ed8', mb: 0.8 }}>Plantilla institucional del acta</Typography>
                <Typography sx={{ color: '#334155', lineHeight: 1.7 }}>
                  Ya se identifico la estructura real del formato: encabezado con logo institucional, codigo <strong>COM-IF-FR-002</strong>, version <strong>1</strong> y secciones de Responsable(s), Dependencia que cita, Informacion de la Reunion, Participantes, Objetivo, Desarrollo y Conclusiones / Compromisos.
                </Typography>
              </Paper>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 10px 24px rgba(15,23,42,.05)' }}>
            <SectionTitle title="Vista previa del Acta" subtitle="Mismo formato institucional COM-IF-FR-002 que se exporta a Word." />

            <Box sx={{
              border: '1px solid #000',
              fontFamily: 'Arial, Helvetica, sans-serif',
              fontSize: 11.5,
              color: '#000',
              bgcolor: '#fff',
              overflow: 'hidden'
            }}>
              {/* Header: Logo | Título | Código/Versión/Fecha */}
              <Box sx={{ display: 'grid', gridTemplateColumns: '20% 60% 20%', borderBottom: '1px solid #000', minHeight: 90 }}>
                <Box sx={{ borderRight: '1px solid #000', p: 0.6, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Box component="img" src="/Logo Universidad CESMAG.png" alt="CESMAG" sx={{ maxHeight: 70, maxWidth: '100%', objectFit: 'contain' }} />
                </Box>
                <Box sx={{ borderRight: '1px solid #000', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 900, fontSize: 14 }}>
                  REGISTRO DE ASISTENCIA Y REUNIÓN
                </Box>
                <Box sx={{ p: 0.8, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 10.5, fontWeight: 800, lineHeight: 1.5 }}>
                  <Box>CÓDIGO: COM-IF-FR-002</Box>
                  <Box>VERSIÓN: 1</Box>
                  <Box>FECHA: 6/MAR/2020</Box>
                </Box>
              </Box>

              {/* Responsable(s) */}
              <Box sx={{ p: 0.7, borderBottom: '1px solid #000', minHeight: 28 }}>
                <strong>Responsable(s):</strong> {actaPreviewData.responsables || ''}
              </Box>

              {/* Dependencia que cita */}
              <Box sx={{ p: 0.7, borderBottom: '1px solid #000', minHeight: 28 }}>
                <strong>Dependencia que cita:</strong> {actaPreviewData.dependencia || ''}
              </Box>

              {/* Sección: Información de la Reunión */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Información de la Reunión
              </Box>
              <Box sx={{ p: 0.7, borderBottom: '1px solid #000', minHeight: 26 }}>
                <strong>Lugar:</strong> {actaPreviewData.lugar || ''}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '70% 30%', borderBottom: '1px solid #000', minHeight: 26 }}>
                <Box sx={{ p: 0.7, borderRight: '1px solid #000' }}>
                  <strong>Fecha:</strong> {actaPreviewData.fecha || ''}
                </Box>
                <Box sx={{ p: 0.7 }}>
                  <strong>Horario:</strong> {actaPreviewData.horario || ''}
                </Box>
              </Box>

              {/* Sección: Participantes */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Participantes
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '7% 43% 25% 25%', bgcolor: '#F2F2F2', fontWeight: 900, borderBottom: '1px solid #000', fontSize: 11 }}>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000' }}>&nbsp;</Box>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000' }}>Nombres y Apellidos</Box>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000' }}>Cargo</Box>
                <Box sx={{ p: 0.5, textAlign: 'center' }}>Firma</Box>
              </Box>
              {Array.from({ length: 10 }).map((_, i) => {
                const p = actaPreviewData.participantes[i] || {};
                return (
                  <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '7% 43% 25% 25%', borderBottom: '1px solid #000', minHeight: 24 }}>
                    <Box sx={{ p: 0.4, textAlign: 'center', borderRight: '1px solid #000', fontWeight: 800 }}>{i + 1}</Box>
                    <Box sx={{ p: 0.4, borderRight: '1px solid #000' }}>{p.nombre || ''}</Box>
                    <Box sx={{ p: 0.4, borderRight: '1px solid #000' }}>{p.cargo || ''}</Box>
                    <Box sx={{ p: 0.4 }}>&nbsp;</Box>
                  </Box>
                );
              })}

              {/* Sección: Objetivo */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Objetivo
              </Box>
              <Box sx={{ p: 0.9, borderBottom: '1px solid #000', minHeight: 60, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                {(actaPreviewData.objetivo || []).join('\n')}
              </Box>

              {/* Sección: Desarrollo */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Desarrollo
              </Box>
              <Box sx={{ p: 0.9, borderBottom: '1px solid #000', minHeight: 90, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                {(actaPreviewData.desarrollo || []).join('\n')}
              </Box>

              {/* Sección: Conclusiones / Compromisos */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Conclusiones / Compromisos
              </Box>
              <Box sx={{ p: 0.9, minHeight: 70, whiteSpace: 'pre-line', textAlign: 'justify' }}>
                {(actaPreviewData.conclusiones || []).join('\n')}
              </Box>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 2 }}>
              <Button startIcon={<DescriptionIcon />} variant="contained" onClick={exportActaWord} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Exportar acta a Word</Button>
              <Button startIcon={<SaveIcon />} variant="outlined" onClick={saveCurrentPlan} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Guardar borrador del acta</Button>
            </Stack>
          </Paper>
        </Box>
      )}

      {workspaceTab === 'exportacion' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
          <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
            <SectionTitle title="Chequeo de Salida" subtitle="Validaciones previas a compartir el plan y el acta." />
            <Stack spacing={1.1}>
              {[
                { ok: Boolean(planData.dependencia), label: 'Dependencia / Unidad registrada' },
                { ok: Boolean(planData.fechaReunion), label: 'Fecha de reunión definida' },
                { ok: actividades.some((act) => Boolean(String(act?.responsable || '').trim())), label: 'Al menos una actividad con responsable' },
                { ok: actividades.length > 0, label: 'Al menos una actividad cargada' },
                { ok: totalObservaciones > 0, label: 'Existen observaciones útiles para el acta' }
              ].map((item) => (
                <Stack key={item.label} direction="row" spacing={1.1} alignItems="center" sx={{ p: 1.1, borderRadius: 2, bgcolor: item.ok ? '#ecfdf5' : '#fff7ed', border: `1px solid ${item.ok ? '#bbf7d0' : '#fed7aa'}` }}>
                  {item.ok ? <CheckCircleIcon sx={{ color: '#059669' }} /> : <HourglassBottomIcon sx={{ color: '#ea580c' }} />}
                  <Typography sx={{ fontWeight: 800, color: item.ok ? '#065f46' : '#9a3412' }}>{item.label}</Typography>
                </Stack>
              ))}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 2.4, borderRadius: 4, border: '1px solid #e2e8f0', background: '#fff', boxShadow: '0 10px 24px rgba(15,23,42,.05)' }}>
            <SectionTitle title="Exportación Institucional" subtitle="Salidas listas para compartir o continuar el proceso." />
            <Stack spacing={1.2}>
              <Button startIcon={<DownloadIcon />} variant="contained" onClick={exportInstitutionalTemplate} disabled={exporting} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>
                {exporting ? 'Generando plantilla...' : 'Descargar plantilla con datos'}
              </Button>
              <Button startIcon={<DescriptionIcon />} variant="outlined" onClick={exportActaWord} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Descargar acta preliminar</Button>
              <Button startIcon={<SaveIcon />} variant="outlined" onClick={saveCurrentPlan} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Guardar borrador completo</Button>
            </Stack>
            <Alert severity="success" sx={{ mt: 1.4, borderRadius: 3 }}>
              Las dos salidas se generan desde el backend con el formato institucional oficial: Excel <strong>DIR-PE-FR-003</strong> para el Plan de Acción y Word <strong>COM-IF-FR-002</strong> para el Registro de Asistencia y Reunión.
            </Alert>
          </Paper>
        </Box>
      )}
    </Stack>
  );
}

function PlaneacionEfectividad() {
  const { enqueueSnackbar } = useSnackbar();
  const createDefaultFilters = () => ({
    mode: 'estadistica',
    anio: '',
    responsable: ''
  });
  const [section, setSection] = useState('estadistica');
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

  return (
    <Fade in={true}>
      <Box>
        <Stack spacing={2.4}>
          <HeroBanner />

          <Paper elevation={0} sx={{ p: 1.2, borderRadius: 4, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
            <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' } }}>
              <Button
                onClick={() => setSection('estadistica')}
                startIcon={<DashboardIcon />}
                sx={{
                  py: 1.8,
                  px: 2,
                  borderRadius: 3,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  fontWeight: 900,
                  color: section === 'estadistica' ? 'white' : '#1e3a8a',
                  background: section === 'estadistica' ? 'linear-gradient(135deg,#1d4ed8 0%,#2563eb 100%)' : '#eff6ff',
                  border: section === 'estadistica' ? '1px solid transparent' : '1px solid #dbeafe',
                  boxShadow: section === 'estadistica' ? '0 12px 24px rgba(37,99,235,.22)' : 'none'
                }}
              >
                Estadística Planes de Acción
              </Button>
              <Button
                onClick={() => setSection('gestion')}
                startIcon={<AssignmentTurnedInIcon />}
                sx={{
                  py: 1.8,
                  px: 2,
                  borderRadius: 3,
                  textTransform: 'none',
                  justifyContent: 'flex-start',
                  fontWeight: 900,
                  color: section === 'gestion' ? 'white' : '#9a3412',
                  background: section === 'gestion' ? 'linear-gradient(135deg,#ea580c 0%,#f97316 100%)' : '#fff7ed',
                  border: section === 'gestion' ? '1px solid transparent' : '1px solid #fed7aa',
                  boxShadow: section === 'gestion' ? '0 12px 24px rgba(249,115,22,.22)' : 'none'
                }}
              >
                Gestión de Planes de Acción
              </Button>
            </Box>
          </Paper>

          {section === 'gestion' ? (
            <GestionPlanesWorkspaceV2 sourceRows={dashboard.rows || []} />
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
        </Stack>
      </Box>
    </Fade>
  );
}

export default PlaneacionEfectividad;
