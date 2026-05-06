import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
  ArrowBack as ArrowBackIcon,
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
  LabelList,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../services/gestionInformacionService';
import planAccionWorkflowService, { ESTADOS_WORKFLOW, ESTADO_LABEL, ESTADO_COLOR } from '../services/planAccionWorkflowService';
import { useAuth } from '../context/AuthContext';

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
                  <LabelList dataKey="total" position="top" style={{ fontSize: 13, fontWeight: 700, fill: '#1e293b' }} formatter={(v) => formatNumber(v)} />
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
                <Bar dataKey="avance" fill="#2563eb" radius={[10, 10, 0, 0]}>
                  <LabelList dataKey="avance" position="top" style={{ fontSize: 13, fontWeight: 700, fill: '#1e293b' }} formatter={(v) => formatPercent(v)} />
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

function GestionPlanesWorkspaceV2({ sourceRows = [], onWorkflowChanged }) {
  const { enqueueSnackbar } = useSnackbar();
  const { user: authUser } = useAuth();
  const userRole = authUser?.role || '';
  const userId = authUser?.id || null;
  const ROL_PYE = 'planeacion_efectividad';
  const ROL_ESTRATEGICA = 'planeacion_estrategica';
  const ROL_CONSULTA = 'consulta';
  const ROL_ADMIN = 'administrador';

  const WORKSPACE_KEY = 'plan_accion_workspace_v2';
  const SAVED_PLANS_KEY = 'plan_accion_saved_plans_v2';
  const ACTA_OVERRIDES_KEY = 'plan_accion_acta_overrides_v2';
  const actividadFormRef = useRef(null);
  const [workspaceTab, setWorkspaceTab] = useState('constructor');
  const [audioFile, setAudioFile] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [generatingIndicator, setGeneratingIndicator] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [showRawIndicador, setShowRawIndicador] = useState(false);
  const [showAiSources, setShowAiSources] = useState(false);
  const [savedPlans, setSavedPlans] = useState([]);
  const [editingActa, setEditingActa] = useState(false);
  const [actaOverrides, setActaOverrides] = useState({});

  // === Workflow del Plan de Acción (backend) ===
  const [currentPlanCodigo, setCurrentPlanCodigo] = useState('');
  const [currentPlanEstado, setCurrentPlanEstado] = useState('');
  const [currentPlanResponsableId, setCurrentPlanResponsableId] = useState(null);
  const [currentPuedeEditar, setCurrentPuedeEditar] = useState(true);
  const [pendientes, setPendientes] = useState([]);
  const [misPlanes, setMisPlanes] = useState([]);
  const [usuariosConsulta, setUsuariosConsulta] = useState([]);
  const [loadingWorkflow, setLoadingWorkflow] = useState(false);
  const [openAsignarResponsable, setOpenAsignarResponsable] = useState(false);
  const [responsableSeleccionadoId, setResponsableSeleccionadoId] = useState('');
  const [selectedYear, setSelectedYear] = useState(String(new Date().getFullYear()));
  const [activeSegment, setActiveSegment] = useState('creacion');
  const [confirmDelete, setConfirmDelete] = useState(null); // { plan_codigo, dependencia, estado_workflow } | null
  const [observacionesRevision, setObservacionesRevision] = useState({ estrategica: '', responsable: '' });
  const [busquedaSegmento, setBusquedaSegmento] = useState('');
  const [seguimientoPlan, setSeguimientoPlan] = useState(null); // plan abierto en modo seguimiento
  const [seguimientoActividades, setSeguimientoActividades] = useState([]); // copia editable de actividades
  const [savingSeguimiento, setSavingSeguimiento] = useState(false);

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

  const actividadSugeridas = useMemo(() => {
    const yaAgregadas = new Set(
      actividades.map((a) => String(a.actividad || '').trim().toLowerCase())
    );
    const mapa = new Map();
    for (const row of combinedRows) {
      const texto = String(row.actividad || '').trim();
      if (!texto) continue;
      const key = texto.toLowerCase();
      if (yaAgregadas.has(key)) continue;
      if (mapa.has(key)) continue;
      if (actividadForm.objetivo_estrategico && row.objetivo_estrategico !== actividadForm.objetivo_estrategico) continue;
      if (actividadForm.lineamiento_estrategico && row.lineamiento_estrategico !== actividadForm.lineamiento_estrategico) continue;
      if (actividadForm.macroactividad && row.macroactividad !== actividadForm.macroactividad) continue;
      mapa.set(key, {
        label: texto,
        actividad: texto,
        responsable: row.responsable || '',
        corresponsable: row.corresponsable || '',
        indicador: row.indicador || '',
        meta: row.meta || '',
        tipo_indicador: row.tipo_indicador || '',
        fecha_inicio: row.fecha_inicio || '',
        fecha_fin: row.fecha_fin || '',
        dependencia: row.dependencia || '',
        anio: row.anio || '',
      });
    }
    return Array.from(mapa.values());
  }, [combinedRows, actividades, actividadForm.objetivo_estrategico, actividadForm.lineamiento_estrategico, actividadForm.macroactividad]);

  useEffect(() => {
    try {
      const storedWorkspace = localStorage.getItem(WORKSPACE_KEY);
      const storedSavedPlans = localStorage.getItem(SAVED_PLANS_KEY);
      const storedActaOverrides = localStorage.getItem(ACTA_OVERRIDES_KEY);
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
      if (storedActaOverrides) {
        const parsedOverrides = JSON.parse(storedActaOverrides);
        if (parsedOverrides && typeof parsedOverrides === 'object') {
          setActaOverrides(parsedOverrides);
        }
      }
    } catch (error) {
      console.warn('No se pudo recuperar el workspace local de planes:', error);
    }
  }, [emptyActividad, emptyPlan]);

  useEffect(() => {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ planData, actividadForm, actividades }));
  }, [planData, actividadForm, actividades]);

  useEffect(() => {
    localStorage.setItem(ACTA_OVERRIDES_KEY, JSON.stringify(actaOverrides || {}));
  }, [actaOverrides]);

  // === Workflow: cargar bandejas al montar ===
  const refrescarBandejas = useCallback(async () => {
    if (!userRole) return;
    try {
      setLoadingWorkflow(true);
      const [pend, mios] = await Promise.all([
        planAccionWorkflowService.listarPendientes().catch(() => ({ data: [] })),
        planAccionWorkflowService.listarMisPlanes().catch(() => ({ data: [] }))
      ]);
      setPendientes(Array.isArray(pend?.data) ? pend.data : []);
      setMisPlanes(Array.isArray(mios?.data) ? mios.data : []);
      if (typeof onWorkflowChanged === 'function') {
        await onWorkflowChanged({ silent: true });
      }
    } catch (error) {
      // silencioso: si el backend no tiene el módulo aún, no bloqueamos UI
    } finally {
      setLoadingWorkflow(false);
    }
  }, [userRole, onWorkflowChanged]);

  useEffect(() => { refrescarBandejas(); }, [refrescarBandejas]);

  // Resetea panel de seguimiento y búsqueda solo al cambiar de año
  useEffect(() => {
    setSeguimientoPlan(null);
    setSeguimientoActividades([]);
    setBusquedaSegmento('');
  }, [selectedYear]);

  // Auto-navega al segmento con más prioridad cuando hay resultados de búsqueda.
  // No depende de activeSegment para evitar loops; el reset de búsqueda ya NO borra
  // al cambiar segmento, por eso este effect es seguro.
  useEffect(() => {
    const q = busquedaSegmento.trim().toLowerCase();
    if (!q) { setActiveSegment('creacion'); return; }
    if (!misPlanes.length) return;
    const dependenciasInst = catalogs?.dependencias || [];
    const ESTADOS_REVISION_SET = new Set([
      ESTADOS_WORKFLOW.EN_REVISION_ESTRATEGICA,
      ESTADOS_WORKFLOW.REVISADO_POR_ESTRATEGICA,
      ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE,
      ESTADOS_WORKFLOW.REVISADO_POR_RESPONSABLE,
    ]);
    const planesAnio = misPlanes.filter((p) => String(p.anio) === String(selectedYear));
    const planesPorDep = new Map(planesAnio.map((p) => [String(p.dependencia || '').trim().toLowerCase(), p]));
    const matchCreacion = dependenciasInst.filter((dep) => {
      const key = String(dep || '').trim().toLowerCase();
      if (!key.includes(q)) return false;
      const plan = planesPorDep.get(key);
      return !plan || plan.estado_workflow === ESTADOS_WORKFLOW.BORRADOR;
    }).length;
    const matchRevision = planesAnio.filter((p) =>
      ESTADOS_REVISION_SET.has(p.estado_workflow) &&
      ((p.dependencia || '').toLowerCase().includes(q) || (ESTADO_LABEL[p.estado_workflow] || '').toLowerCase().includes(q))
    ).length;
    const matchAprobacion = planesAnio.filter((p) =>
      p.estado_workflow === ESTADOS_WORKFLOW.APROBADO && (p.dependencia || '').toLowerCase().includes(q)
    ).length;
    // Prioridad: el estado más avanzado donde haya coincidencia
    const priority = [
      { key: 'aprobacion', count: matchAprobacion },
      { key: 'seguimiento', count: matchAprobacion },
      { key: 'revision', count: matchRevision },
      { key: 'creacion', count: matchCreacion },
    ];
    const best = priority.find((c) => c.count > 0);
    if (best) setActiveSegment(best.key);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busquedaSegmento, misPlanes, selectedYear]);

  // === Helpers de cumplimiento ===
  const estadoCumplimiento = (total) => {
    if (total === null || total === undefined || total === '') return { label: 'Sin datos', bg: '#f1f5f9', fg: '#64748b' };
    const v = Number(total);
    if (v >= 100) return { label: 'Cumplió', bg: '#dcfce7', fg: '#166534' };
    if (v >= 60)  return { label: 'Cumplió parcialmente', bg: '#fef9c3', fg: '#854d0e' };
    if (v >= 40)  return { label: 'Cumplió parcialmente', bg: '#ffedd5', fg: '#9a3412' };
    return { label: 'No cumplió', bg: '#fee2e2', fg: '#991b1b' };
  };

  const promedioSeguimiento = (acts) => {
    const validos = acts.filter((a) => a.total_ejecucion !== null && a.total_ejecucion !== undefined && a.total_ejecucion !== '');
    if (!validos.length) return null;
    return Math.round(validos.reduce((s, a) => s + Number(a.total_ejecucion), 0) / validos.length * 100) / 100;
  };

  // === Seguimiento: abrir / guardar ===
  const abrirSeguimiento = useCallback(async (planCodigo) => {
    try {
      setLoadingWorkflow(true);
      const res = await planAccionWorkflowService.obtenerPlan(planCodigo);
      if (res?.success) {
        setSeguimientoPlan(res.data);
        setSeguimientoActividades(
          (res.data.actividades || []).map((a) => ({ ...a }))
        );
      }
    } catch (_) {
      // error silencioso, no bloquea UI
    } finally {
      setLoadingWorkflow(false);
    }
  }, []);

  const guardarSeguimientoActual = useCallback(async () => {
    if (!seguimientoPlan) return;
    try {
      setSavingSeguimiento(true);
      await planAccionWorkflowService.guardarSeguimiento(seguimientoPlan.plan_codigo, {
        actividades: seguimientoActividades.map((a) => ({
          id: a.id,
          actividad: a.actividad,
          indicador: a.indicador,
          meta: a.meta,
          avance_ip: a.avance_ip,
          avance_iip: a.avance_iip,
          observaciones_ip: a.observaciones_ip || '',
          observaciones_iip: a.observaciones_iip || '',
        }))
      });
      if (typeof onWorkflowChanged === 'function') await onWorkflowChanged({ silent: true });
      await refrescarBandejas();
    } catch (_) {
      // error silencioso
    } finally {
      setSavingSeguimiento(false);
    }
  }, [seguimientoPlan, seguimientoActividades, onWorkflowChanged, refrescarBandejas]);

  // Cargar lista de Usuarios Consulta solo cuando PyE/Admin la necesita
  useEffect(() => {
    if (userRole !== ROL_PYE && userRole !== ROL_ADMIN) return;
    planAccionWorkflowService.listarUsuariosConsulta()
      .then((r) => setUsuariosConsulta(Array.isArray(r?.data) ? r.data : []))
      .catch(() => setUsuariosConsulta([]));
  }, [userRole]);

  // Aplica el contenido recibido del backend al workspace local
  const aplicarPlanRemoto = useCallback((data) => {
    if (!data) return;
    setCurrentPlanCodigo(data.plan_codigo || '');
    setCurrentPlanEstado(data.estado_workflow || '');
    setCurrentPlanResponsableId(data.responsable_id || null);
    setCurrentPuedeEditar(Boolean(data.puedeEditar));

    const cab = data.cabecera_plan || {};
    setPlanData((prev) => ({
      ...prev,
      anio: data.anio ? String(data.anio) : '',
      ped: data.ped || '',
      dependencia: data.dependencia || '',
      estado: cab.estado || '',
      fechaReunion: cab.fechaReunion || '',
      lugarReunion: cab.lugarReunion || '',
      objetivoSesion: cab.objetivoSesion || ''
    }));
    setObservacionesRevision({
      estrategica: cab.comentarios_estrategica || '',
      responsable: cab.comentarios_responsable || ''
    });

    if (cab.actaOverrides && typeof cab.actaOverrides === 'object') {
      setActaOverrides(cab.actaOverrides);
    } else {
      setActaOverrides({});
    }

    const acts = Array.isArray(data.actividades) ? data.actividades : [];
    setActividades(acts.map((a) => ({
      ...a,
      id: a.id || Date.now() + Math.random(),
      anio: a.anio ? String(a.anio) : (data.anio ? String(data.anio) : ''),
      ped: a.ped || data.ped || '',
      avance_ip: a.avance_ip == null ? '0' : String(a.avance_ip),
      avance_iip: a.avance_iip == null ? '0' : String(a.avance_iip),
      total_ejecucion: a.total_ejecucion == null ? '0' : String(a.total_ejecucion)
    })));
  }, []);

  const cargarPlan = useCallback(async (planCodigo) => {
    try {
      setLoadingWorkflow(true);
      const res = await planAccionWorkflowService.obtenerPlan(planCodigo);
      if (res?.success && res?.data) {
        aplicarPlanRemoto(res.data);
        setWorkspaceTab('constructor');
        enqueueSnackbar('Plan cargado.', { variant: 'success' });
      }
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible cargar el plan.', { variant: 'error' });
    } finally {
      setLoadingWorkflow(false);
    }
  }, [aplicarPlanRemoto, enqueueSnackbar]);

  const construirPayloadActual = useCallback(() => {
    const cabecera_plan = {
      estado: planData.estado,
      fechaReunion: planData.fechaReunion,
      lugarReunion: planData.lugarReunion,
      objetivoSesion: planData.objetivoSesion,
      actaOverrides: actaOverrides || {}
    };
    return {
      cabecera_plan,
      actividades: actividades.map((a) => ({
        objetivo_estrategico: a.objetivo_estrategico,
        lineamiento_estrategico: a.lineamiento_estrategico,
        macroactividad: a.macroactividad,
        actividad: a.actividad,
        tipo_indicador: a.tipo_indicador,
        fecha_inicio: a.fecha_inicio,
        fecha_fin: a.fecha_fin,
        indicador: a.indicador,
        meta: a.meta,
        responsable: a.responsable,
        corresponsable: a.corresponsable,
        avance_ip: a.avance_ip,
        observaciones_ip: a.observaciones_ip,
        avance_iip: a.avance_iip,
        observaciones_iip: a.observaciones_iip,
        total_ejecucion: a.total_ejecucion
      }))
    };
  }, [planData, actividades, actaOverrides]);

  const crearPlanEnServidor = useCallback(async () => {
    if (!planData.dependencia) {
      enqueueSnackbar('Selecciona la Dependencia / Unidad antes de crear el plan en el servidor.', { variant: 'warning' });
      return;
    }
    if (!planData.anio) {
      enqueueSnackbar('Selecciona el Año del plan.', { variant: 'warning' });
      return;
    }
    try {
      setLoadingWorkflow(true);
      const payload = {
        anio: Number(planData.anio),
        dependencia: planData.dependencia,
        ped: planData.ped,
        ...construirPayloadActual()
      };
      const res = await planAccionWorkflowService.crearPlan(payload);
      if (res?.success) {
        enqueueSnackbar('Plan creado en el servidor.', { variant: 'success' });
        await cargarPlan(res.data.plan_codigo);
        await refrescarBandejas();
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible crear el plan.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoadingWorkflow(false);
    }
  }, [planData, construirPayloadActual, cargarPlan, refrescarBandejas, enqueueSnackbar]);

  // Acción de la papelera:
  // - Si el plan está en BORRADOR (Creación): eliminación definitiva.
  // - Si el plan está en cualquier otro estado (Revisión / Aprobación): se devuelve a Borrador
  //   para que vuelva al segmento de Creación.
  const ejecutarAccionPapelera = useCallback(async (item) => {
    if (!item?.plan_codigo) return;
    const esBorrador = item.estado_workflow === ESTADOS_WORKFLOW.BORRADOR;
    try {
      setLoadingWorkflow(true);
      if (esBorrador) {
        await planAccionWorkflowService.eliminarPlan(item.plan_codigo);
        enqueueSnackbar(`Plan ${item.plan_codigo} eliminado definitivamente.`, { variant: 'success' });
      } else {
        await planAccionWorkflowService.resetearABorrador(item.plan_codigo);
        enqueueSnackbar(`Plan ${item.plan_codigo} devuelto a Creación (Borrador).`, { variant: 'success' });
      }
      // Si el plan procesado era el que estaba cargado en el constructor, descargarlo.
      if (currentPlanCodigo === item.plan_codigo) {
        setCurrentPlanCodigo('');
        setCurrentPlanEstado('');
        setCurrentPlanResponsableId(null);
      }
      await refrescarBandejas();
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible completar la acción.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoadingWorkflow(false);
      setConfirmDelete(null);
    }
  }, [currentPlanCodigo, refrescarBandejas, enqueueSnackbar]);

  // Crea un plan vacío para una dependencia específica y luego lo carga en el constructor.
  const crearPlanParaDependencia = useCallback(async (dependencia, anio) => {
    if (!dependencia) return;
    try {
      setLoadingWorkflow(true);
      const payload = {
        anio: Number(anio || selectedYear || new Date().getFullYear()),
        dependencia,
        ped: planData.ped || '',
        cabecera_plan: { dependencia, anio: String(anio || selectedYear), estado: 'Borrador' },
        actividades: [{}]
      };
      const res = await planAccionWorkflowService.crearPlan(payload);
      if (res?.success) {
        enqueueSnackbar(`Plan creado para ${dependencia}.`, { variant: 'success' });
        await cargarPlan(res.data.plan_codigo);
        await refrescarBandejas();
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible crear el plan.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoadingWorkflow(false);
    }
  }, [selectedYear, planData.ped, cargarPlan, refrescarBandejas, enqueueSnackbar]);

  const guardarPlanEnServidor = useCallback(async () => {
    if (!currentPlanCodigo) {
      enqueueSnackbar('Primero crea el plan en el servidor.', { variant: 'warning' });
      return;
    }
    try {
      setLoadingWorkflow(true);
      await planAccionWorkflowService.guardarPlan(currentPlanCodigo, construirPayloadActual());
      enqueueSnackbar('Plan guardado en el servidor.', { variant: 'success' });
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible guardar el plan.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoadingWorkflow(false);
    }
  }, [currentPlanCodigo, construirPayloadActual, enqueueSnackbar]);

  const ejecutarTransicion = useCallback(async (accion, extra = {}) => {
    if (!currentPlanCodigo) return;
    try {
      setLoadingWorkflow(true);
      // Guardar primero los cambios pendientes si el usuario puede editar
      if (currentPuedeEditar) {
        try {
          await planAccionWorkflowService.guardarPlan(currentPlanCodigo, construirPayloadActual());
        } catch (_) { /* tolerar fallo de guardado para no bloquear la transición si lo único que falla es validación de edición */ }
      }
      const res = await planAccionWorkflowService.transicionar(currentPlanCodigo, { accion, ...extra });
      if (res?.success) {
        enqueueSnackbar('Estado actualizado.', { variant: 'success' });
        await cargarPlan(currentPlanCodigo);
        await refrescarBandejas();
      }
    } catch (error) {
      const msg = error?.response?.data?.message || 'No fue posible cambiar el estado del plan.';
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setLoadingWorkflow(false);
    }
  }, [currentPlanCodigo, currentPuedeEditar, construirPayloadActual, cargarPlan, refrescarBandejas, enqueueSnackbar]);

  const limpiarPlanCargado = useCallback(() => {
    setCurrentPlanCodigo('');
    setCurrentPlanEstado('');
    setCurrentPlanResponsableId(null);
    setCurrentPuedeEditar(true);
    // Refrescar listas para reflejar cualquier cambio de estado al volver a la bandeja
    refrescarBandejas();
  }, [refrescarBandejas]);

  const responsableActualNombre = useMemo(() => {
    if (!currentPlanResponsableId) return null;
    const u = usuariosConsulta.find((x) => Number(x.id) === Number(currentPlanResponsableId));
    return u ? `${u.nombre} (${u.email})` : `Usuario #${currentPlanResponsableId}`;
  }, [currentPlanResponsableId, usuariosConsulta]);

  // Bloqueo de edición: cuando hay plan del servidor cargado pero el usuario no puede editar.
  // P&E y Admin siempre pueden editar en cualquier estado; Estratégica nunca edita en esta vista.
  const currentPuedeEditarEnVista = (userRole === ROL_PYE || userRole === ROL_ADMIN)
    ? Boolean(currentPlanCodigo)
    : currentPuedeEditar && userRole !== ROL_ESTRATEGICA;
  const planBloqueado = Boolean(currentPlanCodigo) && !currentPuedeEditarEnVista;

  // Descarga del .xlsx aprobado (Usuario Consulta tras Aprobado)
  const descargarPlanAprobado = useCallback(async () => {
    if (!currentPlanCodigo) return;
    try {
      setExporting(true);
      const planRes = await planAccionWorkflowService.obtenerPlan(currentPlanCodigo);
      if (!planRes?.success || !planRes?.data) {
        enqueueSnackbar('No se pudo obtener los datos del plan.', { variant: 'error' });
        return;
      }
      const fresh = planRes.data;
      const response = await gestionInformacionService.exportPlanAccionPlantilla({
        planData: {
          anio: fresh.anio,
          nombrePlan: fresh.dependencia,
          codigoPlan: fresh.plan_codigo,
          dependencia: fresh.dependencia,
          ped: fresh.ped
        },
        actividades: fresh.actividades || []
      });
      const blob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const fname = `plan_accion_${(fresh.dependencia || 'plan').replace(/\s+/g, '_')}_${fresh.anio || new Date().getFullYear()}.xlsx`;
      triggerDownload(blob, fname);
      enqueueSnackbar('Plan aprobado descargado.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No se pudo descargar el plan aprobado.', { variant: 'error' });
    } finally {
      setExporting(false);
    }
  }, [currentPlanCodigo, enqueueSnackbar]);

  // Apertura del cliente de correo predeterminado del usuario para enviar a rectoría
  const abrirCorreoRectoria = useCallback(() => {
    const dependencia = planData.dependencia || '';
    const anio = planData.anio || new Date().getFullYear();
    const asunto = `Plan de Acción ${anio} - ${dependencia}`;
    const cuerpo = [
      'Cordial saludo,',
      '',
      `Adjunto a la presente el Plan de Acción ${anio} de la ${dependencia}, aprobado por Planeación y Efectividad.`,
      '',
      'Por favor adjuntar el archivo descargado al enviar este correo.',
      '',
      'Atentamente,',
      authUser?.nombre || ''
    ].join('\n');
    const url = `mailto:rectoria@unicesmag.edu.co?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}`;
    window.location.href = url;
  }, [planData, authUser]);

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
    return String(Number((Math.min(left + right, 100)).toFixed(2)));
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
    setTimeout(() => actividadFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
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

  // Merge: cualquier campo en actaOverrides reemplaza el auto-generado.
  // Para arrays (objetivo/desarrollo/conclusiones/participantes), si existe
  // override (incluso vacío) se usa; null/undefined cae al auto.
  const actaFinalData = useMemo(() => {
    const ov = actaOverrides || {};
    const pickStr = (key) => (ov[key] !== undefined && ov[key] !== null ? ov[key] : actaPreviewData[key]);
    const pickArr = (key) => (Array.isArray(ov[key]) ? ov[key] : actaPreviewData[key]);
    return {
      responsables: pickStr('responsables') ?? '',
      dependencia: pickStr('dependencia') ?? '',
      lugar: pickStr('lugar') ?? '',
      fecha: pickStr('fecha') ?? '',
      horario: pickStr('horario') ?? '',
      participantes: pickArr('participantes') ?? [],
      objetivo: pickArr('objetivo') ?? [],
      desarrollo: pickArr('desarrollo') ?? [],
      conclusiones: pickArr('conclusiones') ?? []
    };
  }, [actaPreviewData, actaOverrides]);

  const totalObservaciones = actividades
    .flatMap((item) => [item.observaciones_ip, item.observaciones_iip])
    .filter((text) => String(text || '').trim()).length;

  const setActaField = (field, value) => {
    setActaOverrides((prev) => ({ ...prev, [field]: value }));
  };

  const setActaParticipante = (index, key, value) => {
    setActaOverrides((prev) => {
      const base = Array.isArray(prev?.participantes) ? prev.participantes : actaFinalData.participantes;
      const next = base.slice();
      next[index] = { ...(next[index] || { nombre: '', cargo: '' }), [key]: value };
      return { ...prev, participantes: next };
    });
  };

  const addActaParticipante = () => {
    setActaOverrides((prev) => {
      const base = Array.isArray(prev?.participantes) ? prev.participantes : actaFinalData.participantes;
      return { ...prev, participantes: [...base, { nombre: '', cargo: '' }] };
    });
  };

  const removeActaParticipante = (index) => {
    setActaOverrides((prev) => {
      const base = Array.isArray(prev?.participantes) ? prev.participantes : actaFinalData.participantes;
      return { ...prev, participantes: base.filter((_, i) => i !== index) };
    });
  };

  const startEditActa = () => setEditingActa(true);

  const saveActaEdits = () => {
    setEditingActa(false);
    enqueueSnackbar('Cambios del acta guardados.', { variant: 'success' });
  };

  const resetActaEdits = () => {
    setActaOverrides({});
    setEditingActa(false);
    enqueueSnackbar('Acta restaurada al contenido automático.', { variant: 'info' });
  };

  const arrayToText = (arr) => (Array.isArray(arr) ? arr.join('\n') : String(arr || ''));
  const textToArray = (txt) => String(txt || '').split('\n');

  const exportActaWord = async () => {
    try {
      const payload = {
        anio: planData.anio,
        codigoPlan: planData.codigoPlan || planData.dependencia,
        ...actaFinalData
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

  // KPIs eliminados a petición del usuario (2026-04-29).

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

      {/* Panel del workflow del plan (servidor) */}
      <Paper elevation={0} sx={{ p: 1.8, borderRadius: 3.5, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
        {/* Header del workflow: SOLO cuando hay un plan cargado */}
        {currentPlanCodigo && (
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
          <Stack direction="row" spacing={1.2} alignItems="center" flexWrap="wrap" sx={{ rowGap: 0.6 }}>
            <Button
              size="small"
              variant="text"
              startIcon={<ArrowBackIcon fontSize="small" />}
              onClick={limpiarPlanCargado}
              sx={{ textTransform: 'none', fontWeight: 900, color: '#1e3a8a', minWidth: 'auto' }}
            >
              Volver a la lista
            </Button>
            <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: .4 }}>
              Workflow del plan
            </Typography>
            <Chip size="small" label={currentPlanCodigo} sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 800 }} />
            <Chip
              size="small"
              label={ESTADO_LABEL[currentPlanEstado] || currentPlanEstado || 'Sin estado'}
              sx={{
                bgcolor: (ESTADO_COLOR[currentPlanEstado] || {}).bg || '#e2e8f0',
                color: (ESTADO_COLOR[currentPlanEstado] || {}).fg || '#0f172a',
                fontWeight: 900
              }}
            />
            {responsableActualNombre && (
              <Chip size="small" label={`Responsable: ${responsableActualNombre}`} sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
            )}
            {!currentPuedeEditarEnVista && (
              <Chip size="small" color="warning" label="Solo lectura en este estado" sx={{ fontWeight: 800 }} />
            )}
          </Stack>

          <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ rowGap: 0.6 }}>
            {/* Acciones según rol + estado */}
            {(userRole === ROL_PYE || userRole === ROL_ADMIN) && !currentPlanCodigo && (
              <Button size="small" variant="contained" startIcon={<SaveIcon fontSize="small" />} disabled={loadingWorkflow || !planData.dependencia} onClick={crearPlanEnServidor} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                Crear en servidor
              </Button>
            )}
            {currentPlanCodigo && currentPuedeEditarEnVista && (
              <Button size="small" variant="outlined" startIcon={<SaveIcon fontSize="small" />} disabled={loadingWorkflow} onClick={guardarPlanEnServidor} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                Guardar en servidor
              </Button>
            )}
            {currentPlanCodigo && (userRole === ROL_PYE || userRole === ROL_ADMIN) && currentPlanEstado === ESTADOS_WORKFLOW.BORRADOR && (
              <Button size="small" variant="contained" color="primary" disabled={loadingWorkflow} onClick={() => ejecutarTransicion('enviar_a_estrategica')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                Enviar a Dirección de Planeación
              </Button>
            )}
            {/* La revisión estratégica se atiende solo desde la bandeja propia de Planeación Estratégica. */}
            {currentPlanCodigo && (userRole === ROL_PYE || userRole === ROL_ADMIN) && currentPlanEstado === ESTADOS_WORKFLOW.REVISADO_POR_ESTRATEGICA && (
              <Button size="small" variant="contained" color="primary" disabled={loadingWorkflow} onClick={() => { setResponsableSeleccionadoId(''); setOpenAsignarResponsable(true); }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                Enviar al responsable
              </Button>
            )}
            {currentPlanCodigo && userRole === ROL_CONSULTA && currentPlanEstado === ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE && Number(currentPlanResponsableId) === Number(userId) && (
              <Button size="small" variant="contained" color="success" disabled={loadingWorkflow} onClick={() => ejecutarTransicion('marcar_revisado_responsable')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                Marcar como revisado
              </Button>
            )}
            {currentPlanCodigo && (userRole === ROL_PYE || userRole === ROL_ADMIN) && currentPlanEstado === ESTADOS_WORKFLOW.REVISADO_POR_RESPONSABLE && (
              <Button size="small" variant="contained" color="success" disabled={loadingWorkflow} onClick={() => ejecutarTransicion('aprobar')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                Aprobar plan
              </Button>
            )}
            {currentPlanCodigo && currentPlanEstado === ESTADOS_WORKFLOW.APROBADO && userRole === ROL_CONSULTA && Number(currentPlanResponsableId) === Number(userId) && (
              <>
                <Button size="small" variant="contained" color="success" startIcon={<DownloadIcon fontSize="small" />} disabled={exporting} onClick={descargarPlanAprobado} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                  {exporting ? 'Descargando...' : 'Descargar plan aprobado'}
                </Button>
                <Button size="small" variant="outlined" color="primary" startIcon={<DescriptionIcon fontSize="small" />} onClick={abrirCorreoRectoria} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
                  Enviar a rectoría
                </Button>
              </>
            )}
            {currentPlanCodigo && (userRole === ROL_PYE || userRole === ROL_ADMIN) && (() => {
              const esBorradorActual = currentPlanEstado === ESTADOS_WORKFLOW.BORRADOR;
              const labelBtn = esBorradorActual ? 'Eliminar' : 'Devolver a Creación';
              const colorBtn = esBorradorActual ? 'error' : 'warning';
              const tooltipBtn = esBorradorActual
                ? 'Eliminar borrador definitivamente'
                : 'Limpia el flujo y devuelve el plan al segmento de Creación como Borrador';
              const disabledBtn = loadingWorkflow || (userRole === ROL_PYE && !esBorradorActual && currentPlanEstado !== ESTADOS_WORKFLOW.BORRADOR && false);
              return (
                <Tooltip title={tooltipBtn} arrow>
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      color={colorBtn}
                      startIcon={<DeleteOutlineIcon fontSize="small" />}
                      disabled={disabledBtn}
                      onClick={() => setConfirmDelete({ plan_codigo: currentPlanCodigo, dependencia: planData.dependencia, estado_workflow: currentPlanEstado })}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
                    >
                      {labelBtn}
                    </Button>
                  </span>
                </Tooltip>
              );
            })()}
            {currentPlanCodigo && (
              <Tooltip title="Cerrar plan cargado y volver al borrador local" arrow>
                <Button size="small" variant="text" disabled={loadingWorkflow} onClick={limpiarPlanCargado} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, color: '#64748b' }}>
                  Cerrar plan
                </Button>
              </Tooltip>
            )}
          </Stack>
        </Stack>
        )}

        {/* === Filtro de año + 3 segmentos: solo cuando NO hay plan cargado === */}
        {(userRole === ROL_PYE || userRole === ROL_ADMIN) && !currentPlanCodigo && (() => {
          const dependenciasInst = catalogs.dependencias || [];
          const dependenciasKeys = new Set(
            dependenciasInst.map((dep) => String(dep || '').trim().toLowerCase()).filter(Boolean)
          );
          const ESTADOS_CICLO = new Set([
            ESTADOS_WORKFLOW.BORRADOR,
            ESTADOS_WORKFLOW.EN_REVISION_ESTRATEGICA,
            ESTADOS_WORKFLOW.REVISADO_POR_ESTRATEGICA,
            ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE,
            ESTADOS_WORKFLOW.REVISADO_POR_RESPONSABLE,
            ESTADOS_WORKFLOW.APROBADO
          ]);
          const planesDelAnio = misPlanes.filter((p) => {
            const depKey = String(p.dependencia || '').trim().toLowerCase();
            return String(p.anio) === String(selectedYear)
              && ESTADOS_CICLO.has(p.estado_workflow)
              && dependenciasKeys.has(depKey);
          });
          const planesPorDep = new Map(
            planesDelAnio.map((p) => [String(p.dependencia || '').trim().toLowerCase(), p])
          );
          // Creación: SOLO dependencias sin plan o con plan en Borrador.
          // Una vez el plan pasa a revisión, desaparece de aquí y aparece en Revisión.
          const filasCreacion = dependenciasInst
            .map((dep) => ({
              dependencia: dep,
              plan: planesPorDep.get(String(dep || '').trim().toLowerCase()) || null
            }))
            .filter((f) => !f.plan || f.plan.estado_workflow === ESTADOS_WORKFLOW.BORRADOR);
          const sinPlanCount = filasCreacion.filter((f) => !f.plan).length;
          const enBorradorCount = filasCreacion.filter((f) => f.plan?.estado_workflow === ESTADOS_WORKFLOW.BORRADOR).length;
          const ESTADOS_REVISION = new Set([
            ESTADOS_WORKFLOW.EN_REVISION_ESTRATEGICA,
            ESTADOS_WORKFLOW.REVISADO_POR_ESTRATEGICA,
            ESTADOS_WORKFLOW.EN_REVISION_RESPONSABLE,
            ESTADOS_WORKFLOW.REVISADO_POR_RESPONSABLE
          ]);
          const planesEnRevision = planesDelAnio.filter((p) => ESTADOS_REVISION.has(p.estado_workflow));
          const planesAprobados = planesDelAnio.filter((p) => p.estado_workflow === ESTADOS_WORKFLOW.APROBADO);

          const accionRequeridaPyE = (estado) => {
            switch (estado) {
              case ESTADOS_WORKFLOW.REVISADO_POR_ESTRATEGICA: return { label: 'Revisar y continuar', color: 'warning' };
              case ESTADOS_WORKFLOW.REVISADO_POR_RESPONSABLE: return { label: 'Revisar y aprobar', color: 'success' };
              default: return { label: 'Ver estado', color: 'primary', variant: 'outlined' };
            }
          };

          // Estadística agregada del año (trazabilidad)
          const totalDependencias = dependenciasInst.length;
          const completitud = totalDependencias > 0 ? Math.round((planesAprobados.length / totalDependencias) * 100) : 0;
          return (
            <Box sx={{ mt: 1.6, p: 1.6, borderRadius: 3, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
              {/* Encabezado: filtro de año + estadística del año */}
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" sx={{ mb: 1.6 }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: .4 }}>
                    Ciclo del año
                  </Typography>
                  <TextField
                    select
                    size="small"
                    value={selectedYear}
                    onChange={(e) => setSelectedYear(e.target.value)}
                    sx={{ minWidth: 130 }}
                  >
                    {FIXED_PLAN_YEARS.map((y) => (
                      <MenuItem key={y} value={y}>{y}</MenuItem>
                    ))}
                  </TextField>
                </Stack>
                <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: .4 }}>
                  Trazabilidad — Estadística del año {selectedYear}
                </Typography>
              </Stack>

              {/* Barra de completitud institucional */}
              <Box sx={{ mb: 1.6, p: 1.4, borderRadius: 2.5, border: '1px solid #d1fae5', bgcolor: '#ecfdf5' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 0.8 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#065f46', textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Completitud institucional del ciclo {selectedYear}
                  </Typography>
                  <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#047857' }}>
                    {planesAprobados.length} / {totalDependencias} dependencias · <span style={{ color: '#065f46' }}>{completitud}%</span>
                  </Typography>
                </Stack>
                <Box sx={{ position: 'relative', height: 10, borderRadius: 5, bgcolor: '#d1fae5', overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${completitud}%`, background: 'linear-gradient(90deg, #10b981 0%, #059669 100%)', borderRadius: 5, transition: 'width .3s' }} />
                </Box>
              </Box>

              {/* 4 Etapas — tarjetas-botón */}
              {(() => {
                const etapas = [
                  {
                    key: 'creacion',
                    paso: '01',
                    label: 'Creación',
                    desc: 'Construir y enviar',
                    count: sinPlanCount + enBorradorCount,
                    countLabel: 'pendientes',
                    icon: <EditIcon sx={{ fontSize: 22 }} />,
                    activeGrad: 'linear-gradient(135deg,#f59e0b 0%,#d97706 100%)',
                    activeBorder: '#f59e0b',
                    activeFg: '#fff',
                    inactiveBg: '#fffbeb',
                    inactiveFg: '#92400e',
                    inactiveBorder: '#fde68a',
                    countBg: 'rgba(255,255,255,.25)',
                    countFgActive: '#fff',
                    countBgInactive: '#fef3c7',
                    countFgInactive: '#92400e',
                  },
                  {
                    key: 'revision',
                    paso: '02',
                    label: 'Revisión',
                    desc: 'En curso de revisión',
                    count: planesEnRevision.length,
                    countLabel: 'en proceso',
                    icon: <HourglassBottomIcon sx={{ fontSize: 22 }} />,
                    activeGrad: 'linear-gradient(135deg,#3b82f6 0%,#1d4ed8 100%)',
                    activeBorder: '#3b82f6',
                    activeFg: '#fff',
                    inactiveBg: '#eff6ff',
                    inactiveFg: '#1e40af',
                    inactiveBorder: '#bfdbfe',
                    countBg: 'rgba(255,255,255,.25)',
                    countFgActive: '#fff',
                    countBgInactive: '#dbeafe',
                    countFgInactive: '#1e40af',
                  },
                  {
                    key: 'aprobacion',
                    paso: '03',
                    label: 'Aprobación',
                    desc: 'Planes vigentes',
                    count: planesAprobados.length,
                    countLabel: 'aprobados',
                    icon: <CheckCircleIcon sx={{ fontSize: 22 }} />,
                    activeGrad: 'linear-gradient(135deg,#10b981 0%,#059669 100%)',
                    activeBorder: '#10b981',
                    activeFg: '#fff',
                    inactiveBg: '#ecfdf5',
                    inactiveFg: '#166534',
                    inactiveBorder: '#a7f3d0',
                    countBg: 'rgba(255,255,255,.25)',
                    countFgActive: '#fff',
                    countBgInactive: '#dcfce7',
                    countFgInactive: '#166534',
                  },
                  {
                    key: 'seguimiento',
                    paso: '04',
                    label: 'Seguimiento',
                    desc: 'Avance y cumplimiento',
                    count: planesAprobados.length,
                    countLabel: 'a seguir',
                    icon: <TrendingUpIcon sx={{ fontSize: 22 }} />,
                    activeGrad: 'linear-gradient(135deg,#0ea5e9 0%,#0369a1 100%)',
                    activeBorder: '#0ea5e9',
                    activeFg: '#fff',
                    inactiveBg: '#f0f9ff',
                    inactiveFg: '#0369a1',
                    inactiveBorder: '#bae6fd',
                    countBg: 'rgba(255,255,255,.25)',
                    countFgActive: '#fff',
                    countBgInactive: '#e0f2fe',
                    countFgInactive: '#0369a1',
                  },
                ];
                // Conteo dinámico de coincidencias por segmento cuando hay búsqueda activa
                const qCards = busquedaSegmento.trim().toLowerCase();
                const matchCounts = qCards ? {
                  creacion: filasCreacion.filter((f) => f.dependencia.toLowerCase().includes(qCards)).length,
                  revision: planesEnRevision.filter((p) => (p.dependencia || '').toLowerCase().includes(qCards) || (ESTADO_LABEL[p.estado_workflow] || '').toLowerCase().includes(qCards)).length,
                  aprobacion: planesAprobados.filter((p) => (p.dependencia || '').toLowerCase().includes(qCards)).length,
                  seguimiento: planesAprobados.filter((p) => (p.dependencia || '').toLowerCase().includes(qCards)).length,
                } : null;
                return (
                  <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: 'repeat(4, 1fr)', mb: 1.6 }}>
                    {etapas.map((e) => {
                      const active = activeSegment === e.key;
                      const matchN = matchCounts ? matchCounts[e.key] : null;
                      const hasMatch = matchN !== null && matchN > 0;
                      const noMatch = matchN !== null && matchN === 0;
                      const displayCount = matchN !== null ? matchN : e.count;
                      return (
                        <Box
                          key={e.key}
                          onClick={() => { setActiveSegment(e.key); }}
                          sx={{
                            cursor: 'pointer',
                            borderRadius: 3,
                            p: '14px 16px',
                            border: active
                              ? `2px solid ${e.activeBorder}`
                              : hasMatch
                                ? '2px solid #16a34a'
                                : noMatch
                                  ? `2px solid ${e.inactiveBorder}`
                                  : `2px solid ${e.inactiveBorder}`,
                            background: active ? e.activeGrad : e.inactiveBg,
                            boxShadow: active
                              ? `0 6px 20px ${e.activeBorder}44`
                              : hasMatch
                                ? '0 0 0 3px rgba(22,163,74,.18), 0 2px 8px rgba(22,163,74,.15)'
                                : '0 1px 3px rgba(0,0,0,.06)',
                            opacity: noMatch ? 0.45 : 1,
                            filter: noMatch ? 'grayscale(0.5)' : 'none',
                            transition: 'all .18s ease',
                            userSelect: 'none',
                            '&:hover': {
                              boxShadow: noMatch ? '0 1px 3px rgba(0,0,0,.06)' : `0 8px 24px ${e.activeBorder}55`,
                              transform: noMatch ? 'none' : 'translateY(-1px)',
                              border: noMatch ? `2px solid ${e.inactiveBorder}` : `2px solid ${e.activeBorder}`,
                            },
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '10px',
                            position: 'relative',
                          }}
                        >
                          {/* Badge de resultado de búsqueda */}
                          {hasMatch && !active && (
                            <Box sx={{
                              position: 'absolute', top: 8, right: 8,
                              bgcolor: '#16a34a', color: '#fff',
                              fontSize: 9, fontWeight: 900, px: 0.7, py: 0.2,
                              borderRadius: 1, textTransform: 'uppercase', letterSpacing: 0.5,
                            }}>
                              {matchN} coincid.
                            </Box>
                          )}
                          {/* Fila superior: icono + número de paso */}
                          <Stack direction="row" alignItems="center" justifyContent="space-between">
                            <Box sx={{
                              width: 38, height: 38, borderRadius: 2,
                              bgcolor: active ? 'rgba(255,255,255,.22)' : hasMatch ? 'rgba(22,163,74,.12)' : `${e.activeBorder}22`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: active ? '#fff' : hasMatch ? '#15803d' : e.inactiveFg,
                              flexShrink: 0,
                            }}>
                              {e.icon}
                            </Box>
                            <Box sx={{
                              minWidth: 36, height: 36, borderRadius: '50%',
                              bgcolor: active ? e.countBg : hasMatch ? 'rgba(22,163,74,.15)' : e.countBgInactive,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0,
                            }}>
                              <Typography sx={{ fontSize: 15, fontWeight: 900, color: active ? e.countFgActive : hasMatch ? '#15803d' : e.countFgInactive, lineHeight: 1 }}>
                                {displayCount}
                              </Typography>
                            </Box>
                          </Stack>
                          {/* Fila inferior: paso + label + desc */}
                          <Box>
                            <Typography sx={{ fontSize: 10, fontWeight: 800, color: active ? 'rgba(255,255,255,.75)' : '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, lineHeight: 1, mb: 0.3 }}>
                              Paso {e.paso}
                            </Typography>
                            <Typography sx={{ fontSize: 14, fontWeight: 900, color: active ? '#fff' : hasMatch ? '#15803d' : e.inactiveFg, lineHeight: 1.2 }}>
                              {e.label}
                            </Typography>
                            <Typography sx={{ fontSize: 11, color: active ? 'rgba(255,255,255,.8)' : hasMatch ? '#16a34a' : '#64748b', mt: 0.3, lineHeight: 1.3 }}>
                              {matchN !== null
                                ? (matchN > 0 ? `${matchN} encontrado${matchN !== 1 ? 's' : ''}` : 'Sin coincidencias')
                                : `${e.count} ${e.countLabel}`}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                );
              })()}

              {/* === BARRA DE BÚSQUEDA INTELIGENTE === */}
              {(() => {
                const q = busquedaSegmento.trim().toLowerCase();
                const totalSegmento = activeSegment === 'creacion' ? filasCreacion.length
                  : activeSegment === 'revision' ? planesEnRevision.length
                  : activeSegment === 'aprobacion' ? planesAprobados.length
                  : planesAprobados.length;
                const filtradas = q ? (() => {
                  if (activeSegment === 'creacion') return filasCreacion.filter(f => f.dependencia.toLowerCase().includes(q));
                  const lista = activeSegment === 'revision' ? planesEnRevision : planesAprobados;
                  return lista.filter(p => (p.dependencia || '').toLowerCase().includes(q) || (ESTADO_LABEL[p.estado_workflow] || '').toLowerCase().includes(q));
                })().length : null;
                return (
                  <Box sx={{ mb: 1.4, position: 'relative' }}>
                    <Box sx={{
                      display: 'flex', alignItems: 'center', gap: 1.2,
                      p: '10px 16px',
                      borderRadius: 3,
                      border: busquedaSegmento ? '2px solid #3b82f6' : '2px solid #e2e8f0',
                      bgcolor: '#fff',
                      boxShadow: busquedaSegmento ? '0 0 0 3px rgba(59,130,246,.12)' : '0 1px 4px rgba(0,0,0,.06)',
                      transition: 'all .15s ease',
                    }}>
                      {/* Icono lupa */}
                      <Box sx={{ color: busquedaSegmento ? '#3b82f6' : '#94a3b8', display: 'flex', flexShrink: 0 }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                        </svg>
                      </Box>
                      {/* Input */}
                      <input
                        type="text"
                        value={busquedaSegmento}
                        onChange={(e) => setBusquedaSegmento(e.target.value)}
                        placeholder={`Buscar en ${activeSegment === 'creacion' ? 'Creación' : activeSegment === 'revision' ? 'Revisión' : activeSegment === 'aprobacion' ? 'Aprobación' : 'Seguimiento'} — dependencia, estado, responsable…`}
                        style={{
                          flex: 1, border: 'none', outline: 'none',
                          fontSize: 14, fontWeight: 500, color: '#0f172a',
                          background: 'transparent', fontFamily: 'inherit',
                        }}
                      />
                      {/* Contador de resultados */}
                      {q && filtradas !== null && (
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, flexShrink: 0 }}>
                          <Typography sx={{ fontSize: 12, fontWeight: 700, color: filtradas > 0 ? '#3b82f6' : '#ef4444', whiteSpace: 'nowrap' }}>
                            {filtradas} de {totalSegmento}
                          </Typography>
                          <Box sx={{ width: 1, height: 16, bgcolor: '#e2e8f0' }} />
                        </Box>
                      )}
                      {/* Botón limpiar */}
                      {busquedaSegmento && (
                        <Box
                          onClick={() => setBusquedaSegmento('')}
                          sx={{ cursor: 'pointer', color: '#94a3b8', display: 'flex', flexShrink: 0, borderRadius: '50%', p: 0.3, '&:hover': { color: '#ef4444', bgcolor: '#fee2e2' }, transition: 'all .12s' }}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </Box>
                      )}
                    </Box>
                    {/* Chips de ayuda (cuando está vacío) */}
                    {!busquedaSegmento && (
                      <Stack direction="row" spacing={0.8} sx={{ mt: 0.8, flexWrap: 'wrap', rowGap: 0.5 }}>
                        {['Sin crear', 'Borrador', 'Revisión', 'Aprobado', 'Dirección', 'Vicerrectoría', 'Departamento'].map((hint) => (
                          <Chip
                            key={hint}
                            label={hint}
                            size="small"
                            onClick={() => setBusquedaSegmento(hint)}
                            sx={{ fontSize: 11, height: 22, cursor: 'pointer', bgcolor: '#f1f5f9', color: '#475569', fontWeight: 600, '&:hover': { bgcolor: '#dbeafe', color: '#1d4ed8' } }}
                          />
                        ))}
                      </Stack>
                    )}
                  </Box>
                );
              })()}

              {/* === SEGMENTO 1: CREACIÓN === */}
              {activeSegment === 'creacion' && (() => {
                const q = busquedaSegmento.trim().toLowerCase();
                const filasFiltradas = q ? filasCreacion.filter(f => f.dependencia.toLowerCase().includes(q)) : filasCreacion;
                return (
                <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, maxHeight: 460 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 44 }}>#</TableCell>
                        <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3 }}>Dependencia</TableCell>
                        <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 200 }}>Estado</TableCell>
                        <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 220, textAlign: 'right' }}>Acción</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filasFiltradas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} sx={{ textAlign: 'center', color: '#94a3b8', py: 4 }}>
                            {busquedaSegmento ? `Sin resultados para "${busquedaSegmento}"` : 'No hay dependencias institucionales cargadas en el catálogo.'}
                          </TableCell>
                        </TableRow>
                      ) : filasFiltradas.map((f, idx) => {
                        const sinPlan = !f.plan;
                        const enBorrador = f.plan?.estado_workflow === ESTADOS_WORKFLOW.BORRADOR;
                        const esMatch = q && f.dependencia.toLowerCase().includes(q);
                        return (
                          <TableRow key={f.dependencia} hover sx={{ bgcolor: esMatch ? 'rgba(254,249,195,.8)' : 'inherit', outline: esMatch ? '2px solid #fbbf24' : 'none', outlineOffset: '-2px' }}>
                            <TableCell sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569' }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{f.dependencia}</TableCell>
                            <TableCell>
                              {sinPlan && <Chip size="small" sx={{ bgcolor: '#fef9c3', color: '#854d0e', fontWeight: 800 }} label="Sin crear" />}
                              {enBorrador && <Chip size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 800 }} label="Borrador en construcción" />}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>
                              <Stack direction="row" spacing={0.8} justifyContent="flex-end" alignItems="center">
                                {sinPlan && (
                                  <Button size="small" variant="contained" disabled={loadingWorkflow} onClick={() => crearPlanParaDependencia(f.dependencia, selectedYear)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                                    Crear plan
                                  </Button>
                                )}
                                {enBorrador && (
                                  <>
                                    <Button size="small" variant="contained" color="warning" disabled={loadingWorkflow} onClick={() => cargarPlan(f.plan.plan_codigo)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                                      Continuar editando
                                    </Button>
                                    <Tooltip title="Eliminar borrador" arrow>
                                      <IconButton
                                        size="small"
                                        color="error"
                                        disabled={loadingWorkflow}
                                        onClick={() => setConfirmDelete({ plan_codigo: f.plan.plan_codigo, dependencia: f.dependencia, estado_workflow: f.plan.estado_workflow })}
                                      >
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
                );
              })()}

              {/* === SEGMENTO 2: REVISIÓN === */}
              {activeSegment === 'revision' && (() => {
                const q = busquedaSegmento.trim().toLowerCase();
                const planesFiltrados = q ? planesEnRevision.filter(p => (p.dependencia || '').toLowerCase().includes(q) || (ESTADO_LABEL[p.estado_workflow] || '').toLowerCase().includes(q)) : planesEnRevision;
                return (
                planesFiltrados.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    {q ? `Sin resultados para "${busquedaSegmento}"` : `No hay planes en proceso de revisión para el año ${selectedYear}. Cuando envíes un borrador a Planeación Estratégica aparecerá aquí.`}
                  </Alert>
                ) : (
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, maxHeight: 460 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 44 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3 }}>Dependencia</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 220 }}>Estado actual</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 200 }}>Última actualización</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#0f172a', bgcolor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textTransform: 'uppercase', letterSpacing: 0.3, width: 220, textAlign: 'right' }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {planesFiltrados.map((p, idx) => {
                          const accion = accionRequeridaPyE(p.estado_workflow);
                          const fecha = p.fecha_envio_responsable || p.fecha_revisado_estrategica || p.fecha_envio_estrategica || p.updatedAt;
                          const esMatch = q && ((p.dependencia || '').toLowerCase().includes(q) || (ESTADO_LABEL[p.estado_workflow] || '').toLowerCase().includes(q));
                          return (
                            <TableRow key={p.plan_codigo} hover sx={{ bgcolor: esMatch ? 'rgba(254,249,195,.8)' : 'inherit', outline: esMatch ? '2px solid #fbbf24' : 'none', outlineOffset: '-2px' }}>
                              <TableCell sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569' }}>{idx + 1}</TableCell>
                              <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.dependencia || '—'}</TableCell>
                              <TableCell>
                                <Chip
                                  size="small"
                                  sx={{ bgcolor: (ESTADO_COLOR[p.estado_workflow] || {}).bg, color: (ESTADO_COLOR[p.estado_workflow] || {}).fg, fontWeight: 800 }}
                                  label={ESTADO_LABEL[p.estado_workflow] || p.estado_workflow}
                                />
                              </TableCell>
                              <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>
                                {fecha ? new Date(fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </TableCell>
                              <TableCell sx={{ textAlign: 'right' }}>
                                <Stack direction="row" spacing={0.8} justifyContent="flex-end" alignItems="center">
                                  <Button
                                    size="small"
                                    variant={accion.variant || 'contained'}
                                    color={accion.color}
                                    disabled={loadingWorkflow}
                                    onClick={() => cargarPlan(p.plan_codigo)}
                                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
                                  >
                                    {accion.label}
                                  </Button>
                                  {(userRole === ROL_PYE || userRole === ROL_ADMIN) && (
                                    <Tooltip title="Devolver a Creación (Planeación y Efectividad)" arrow>
                                      <IconButton size="small" color="warning" disabled={loadingWorkflow} onClick={() => setConfirmDelete({ plan_codigo: p.plan_codigo, dependencia: p.dependencia, estado_workflow: p.estado_workflow })}>
                                        <DeleteOutlineIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  )}
                                </Stack>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
                );
              })()}

              {/* === SEGMENTO 3: APROBACIÓN === */}
              {activeSegment === 'aprobacion' && (() => {
                const q = busquedaSegmento.trim().toLowerCase();
                const planesFiltrados = q ? planesAprobados.filter(p => (p.dependencia || '').toLowerCase().includes(q)) : planesAprobados;
                return (
                planesFiltrados.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    {q ? `Sin resultados para "${busquedaSegmento}"` : `No hay planes aprobados para el año ${selectedYear}.`}
                  </Alert>
                ) : (
                  <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #d1fae5', borderRadius: 2.5, maxHeight: 460 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#166534', bgcolor: '#ecfdf5', borderBottom: '2px solid #d1fae5', textTransform: 'uppercase', letterSpacing: 0.3, width: 44 }}>#</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#166534', bgcolor: '#ecfdf5', borderBottom: '2px solid #d1fae5', textTransform: 'uppercase', letterSpacing: 0.3 }}>Dependencia</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#166534', bgcolor: '#ecfdf5', borderBottom: '2px solid #d1fae5', textTransform: 'uppercase', letterSpacing: 0.3, width: 200 }}>Aprobado el</TableCell>
                          <TableCell sx={{ fontWeight: 900, fontSize: 12, color: '#166534', bgcolor: '#ecfdf5', borderBottom: '2px solid #d1fae5', textTransform: 'uppercase', letterSpacing: 0.3, width: 240, textAlign: 'right' }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {planesFiltrados.map((p, idx) => {
                          const esMatchAprobado = q && (p.dependencia || '').toLowerCase().includes(q);
                          return (
                          <TableRow key={p.plan_codigo} hover sx={{ bgcolor: esMatchAprobado ? 'rgba(254,249,195,.8)' : 'rgba(220,252,231,.25)', outline: esMatchAprobado ? '2px solid #fbbf24' : 'none', outlineOffset: '-2px' }}>
                            <TableCell sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569' }}>{idx + 1}</TableCell>
                            <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>{p.dependencia || '—'}</TableCell>
                            <TableCell sx={{ fontSize: 12.5, color: '#475569' }}>
                              {p.fecha_aprobado ? new Date(p.fecha_aprobado).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </TableCell>
                            <TableCell sx={{ textAlign: 'right' }}>
                              <Stack direction="row" spacing={0.8} justifyContent="flex-end" alignItems="center">
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                disabled={loadingWorkflow}
                                onClick={() => cargarPlan(p.plan_codigo)}
                                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}
                              >
                                Abrir aprobado
                              </Button>
                              {(userRole === ROL_PYE || userRole === ROL_ADMIN) && (
                                <Tooltip title="Devolver a Creación (Planeación y Efectividad)" arrow>
                                  <IconButton size="small" color="warning" disabled={loadingWorkflow} onClick={() => setConfirmDelete({ plan_codigo: p.plan_codigo, dependencia: p.dependencia, estado_workflow: p.estado_workflow })}>
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ); })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )
                );
              })()}

              {/* === SEGMENTO 4: SEGUIMIENTO === */}
              {activeSegment === 'seguimiento' && (() => {
                // Panel de seguimiento de un plan individual (inline)
                if (seguimientoPlan) {
                  const promedio = promedioSeguimiento(seguimientoActividades);
                  const estadoGeneral = estadoCumplimiento(promedio);
                  return (
                    <Box>
                      {/* Encabezado del plan en seguimiento */}
                      <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between" sx={{ mb: 2, p: 1.8, borderRadius: 2.5, bgcolor: '#f0f9ff', border: '1px solid #bae6fd' }}>
                        <Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#0369a1' }}>{seguimientoPlan.dependencia}</Typography>
                          <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>Plan {seguimientoPlan.anio} · {seguimientoPlan.plan_codigo}</Typography>
                        </Box>
                        <Stack direction="row" spacing={1} alignItems="center">
                          {promedio !== null && (
                            <Chip size="small" label={`${promedio}% promedio`} sx={{ bgcolor: estadoGeneral.bg, color: estadoGeneral.fg, fontWeight: 900 }} />
                          )}
                          <Button size="small" variant="outlined" onClick={() => setSeguimientoPlan(null)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                            Volver a la lista
                          </Button>
                        </Stack>
                      </Stack>

                      {/* Tabla de actividades con campos de avance editables */}
                      <Box sx={{ overflowX: 'auto', borderRadius: 2.5, border: '1px solid #e2e8f0' }}>
                        <Table size="small" sx={{ minWidth: 1160, borderCollapse: 'collapse', tableLayout: 'fixed' }}>
                          <colgroup>
                            <col style={{ width: 40 }} />
                            <col style={{ width: 180 }} />
                            <col style={{ width: 200 }} />
                            <col style={{ width: 80 }} />
                            <col style={{ width: 82 }} />
                            <col style={{ width: 154 }} />
                            <col style={{ width: 86 }} />
                            <col style={{ width: 154 }} />
                            <col style={{ width: 78 }} />
                            <col style={{ width: 90 }} />
                          </colgroup>
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#0c4a6e' }}>
                              {['#', 'Actividad', 'Indicador', 'Meta', 'Avance IP (%)', 'Observaciones IP', 'Avance IIP (%)', 'Observaciones IIP', 'Total (%)', 'Estado'].map((h) => (
                                <TableCell key={h} sx={{ color: '#fff', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, py: 1.2, px: 1.4, overflow: 'hidden', borderBottom: 'none' }}>{h}</TableCell>
                              ))}
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {seguimientoActividades.map((act, idx) => {
                              const avIP = act.avance_ip === null || act.avance_ip === undefined ? '' : String(act.avance_ip);
                              const avIIP = act.avance_iip === null || act.avance_iip === undefined ? '' : String(act.avance_iip);
                              const total = act.total_ejecucion;
                              const ec = estadoCumplimiento(total);
                              const bgRow = idx % 2 === 0 ? '#fff' : '#f8fafc';
                              const soloLectura = userRole === ROL_ESTRATEGICA;
                              const updateAct = (key, val) => {
                                setSeguimientoActividades((prev) => prev.map((a, i) => {
                                  if (i !== idx) return a;
                                  const next = { ...a, [key]: val };
                                  if (key === 'avance_ip' || key === 'avance_iip') {
                                    const ip = key === 'avance_ip' ? val : next.avance_ip;
                                    const iip = key === 'avance_iip' ? val : next.avance_iip;
                                    const ipN = ip === '' || ip === null || ip === undefined ? null : Number(ip);
                                    const iipN = iip === '' || iip === null || iip === undefined ? null : Number(iip);
                                    next.total_ejecucion = (ipN !== null && iipN !== null) ? Math.min(Math.round((ipN + iipN) * 100) / 100, 100) : (ipN !== null ? ipN : (iipN !== null ? iipN : null));
                                  }
                                  return next;
                                }));
                              };
                              return (
                                <TableRow key={act.id || idx} sx={{ bgcolor: bgRow, '&:hover': { bgcolor: '#f0f9ff' } }}>
                                  <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', px: 1.4, py: 1, verticalAlign: 'top' }}>{idx + 1}</TableCell>
                                  <TableCell sx={{ verticalAlign: 'top', overflow: 'hidden', px: soloLectura ? 1.4 : 0.6, py: soloLectura ? 1 : 0.6 }}>
                                    {soloLectura ? (
                                      <Tooltip title={act.actividad || ''} arrow placement="top-start">
                                        <Box sx={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'default' }}>{act.actividad}</Box>
                                      </Tooltip>
                                    ) : (
                                      <TextField size="small" multiline minRows={2} maxRows={5} value={act.actividad || ''} onChange={(e) => updateAct('actividad', e.target.value)} sx={{ width: '100%', '& .MuiInputBase-input': { fontSize: 12.5, lineHeight: 1.4 } }} />
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ verticalAlign: 'top', overflow: 'hidden', px: soloLectura ? 1.4 : 0.6, py: soloLectura ? 1 : 0.6 }}>
                                    {soloLectura ? (
                                      <Tooltip title={act.indicador || ''} arrow placement="top-start">
                                        <Box sx={{ fontSize: 11.5, color: '#334155', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'default' }}>{act.indicador}</Box>
                                      </Tooltip>
                                    ) : (
                                      <TextField size="small" multiline minRows={2} maxRows={5} value={act.indicador || ''} onChange={(e) => updateAct('indicador', e.target.value)} sx={{ width: '100%', '& .MuiInputBase-input': { fontSize: 11.5, lineHeight: 1.4 } }} />
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ verticalAlign: 'top', px: soloLectura ? 1.4 : 0.6, py: soloLectura ? 1 : 0.6 }}>
                                    {soloLectura ? (
                                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', textAlign: 'center' }}>{act.meta}</Typography>
                                    ) : (
                                      <TextField size="small" value={act.meta || ''} onChange={(e) => updateAct('meta', e.target.value)} inputProps={{ style: { textAlign: 'center', fontSize: 12.5 } }} sx={{ width: '100%' }} />
                                    )}
                                  </TableCell>
                                  <TableCell sx={{ px: 1, py: 0.8, verticalAlign: 'top' }}>
                                    <TextField size="small" type="number" value={avIP} onChange={(e) => !soloLectura && updateAct('avance_ip', e.target.value)} InputProps={{ readOnly: soloLectura }} inputProps={{ min: 0, max: 100, step: 1, style: { textAlign: 'center', padding: '4px 6px', fontSize: 13 } }} sx={{ width: '100%', '& .MuiInputBase-root': { bgcolor: soloLectura ? '#f8fafc' : undefined } }} />
                                  </TableCell>
                                  <TableCell sx={{ px: 1, py: 0.8, verticalAlign: 'top' }}>
                                    <TextField size="small" multiline minRows={1} maxRows={3} value={act.observaciones_ip || ''} onChange={(e) => !soloLectura && updateAct('observaciones_ip', e.target.value)} InputProps={{ readOnly: soloLectura }} inputProps={{ style: { fontSize: 12 } }} sx={{ width: '100%', '& .MuiInputBase-root': { bgcolor: soloLectura ? '#f8fafc' : undefined } }} />
                                  </TableCell>
                                  <TableCell sx={{ px: 1, py: 0.8, verticalAlign: 'top' }}>
                                    <TextField size="small" type="number" value={avIIP} onChange={(e) => !soloLectura && updateAct('avance_iip', e.target.value)} InputProps={{ readOnly: soloLectura }} inputProps={{ min: 0, max: 100, step: 1, style: { textAlign: 'center', padding: '4px 6px', fontSize: 13 } }} sx={{ width: '100%', '& .MuiInputBase-root': { bgcolor: soloLectura ? '#f8fafc' : undefined } }} />
                                  </TableCell>
                                  <TableCell sx={{ px: 1, py: 0.8, verticalAlign: 'top' }}>
                                    <TextField size="small" multiline minRows={1} maxRows={3} value={act.observaciones_iip || ''} onChange={(e) => !soloLectura && updateAct('observaciones_iip', e.target.value)} InputProps={{ readOnly: soloLectura }} inputProps={{ style: { fontSize: 12 } }} sx={{ width: '100%', '& .MuiInputBase-root': { bgcolor: soloLectura ? '#f8fafc' : undefined } }} />
                                  </TableCell>
                                  <TableCell sx={{ px: 1.4, py: 1, textAlign: 'center', verticalAlign: 'top' }}>
                                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: total !== null && total !== undefined ? ec.fg : '#94a3b8' }}>{total !== null && total !== undefined ? `${total}%` : '—'}</Typography>
                                  </TableCell>
                                  <TableCell sx={{ px: 1, py: 1, verticalAlign: 'top' }}>
                                    <Chip size="small" label={ec.label} sx={{ bgcolor: ec.bg, color: ec.fg, fontWeight: 800, fontSize: 10.5, height: 22 }} />
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {seguimientoActividades.length === 0 && (
                              <TableRow><TableCell colSpan={10} sx={{ textAlign: 'center', py: 4, color: '#94a3b8' }}>Este plan no tiene actividades registradas.</TableCell></TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </Box>

                      <Stack direction="row" spacing={1.2} sx={{ mt: 1.8 }}>
                        {(userRole === ROL_PYE || userRole === ROL_ADMIN) && (
                          <Button variant="contained" disabled={savingSeguimiento} onClick={guardarSeguimientoActual} startIcon={savingSeguimiento ? <CircularProgress size={14} sx={{ color: 'inherit' }} /> : <SaveIcon fontSize="small" />} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, bgcolor: '#0369a1', '&:hover': { bgcolor: '#075985' } }}>
                            {savingSeguimiento ? 'Guardando…' : 'Guardar seguimiento'}
                          </Button>
                        )}
                        <Button variant="outlined" onClick={() => setSeguimientoPlan(null)} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800 }}>
                          Volver a la lista
                        </Button>
                      </Stack>
                    </Box>
                  );
                }

                // Lista de planes aprobados para seleccionar seguimiento
                const todosConSeguimiento = misPlanes.filter(
                  (p) => p.estado_workflow === ESTADOS_WORKFLOW.APROBADO && String(p.anio) === String(selectedYear)
                );
                const qSeg = busquedaSegmento.trim().toLowerCase();
                const planesConSeguimiento = qSeg ? todosConSeguimiento.filter(p => (p.dependencia || '').toLowerCase().includes(qSeg)) : todosConSeguimiento;
                return planesConSeguimiento.length === 0 ? (
                  <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                    {qSeg ? `Sin resultados para "${busquedaSegmento}"` : `No hay planes aprobados para el año ${selectedYear}. El seguimiento se habilita una vez que los planes estén aprobados.`}
                  </Alert>
                ) : (
                  <Box sx={{ overflowX: 'auto', borderRadius: 2.5, border: '1px solid #bae6fd' }}>
                    <Table size="small" sx={{ minWidth: 700 }}>
                      <TableHead>
                        <TableRow sx={{ bgcolor: '#0c4a6e' }}>
                          {['#', 'Dependencia', 'Aprobado el', 'Avance promedio', 'Estado cumplimiento', 'Acción'].map((h) => (
                            <TableCell key={h} sx={{ color: '#fff', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.3, py: 1.2, px: 1.4, whiteSpace: 'nowrap', borderBottom: 'none' }}>{h}</TableCell>
                          ))}
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {planesConSeguimiento.map((p, idx) => {
                          const datosPlan = sourceRows.filter((r) => r.plan_codigo === p.plan_codigo);
                          const promActs = datosPlan.filter((r) => r.total_ejecucion !== null && r.total_ejecucion !== undefined);
                          const prom = promActs.length ? Math.round(promActs.reduce((s, r) => s + Number(r.total_ejecucion), 0) / promActs.length * 100) / 100 : null;
                          const ec = estadoCumplimiento(prom);
                          return (
                            <TableRow key={p.plan_codigo} hover sx={{ bgcolor: idx % 2 === 0 ? '#fff' : '#f0f9ff', '&:hover': { bgcolor: '#e0f2fe' } }}>
                              <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', px: 1.4 }}>{idx + 1}</TableCell>
                              <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#0f172a', px: 1.4 }}>{p.dependencia || '—'}</TableCell>
                              <TableCell sx={{ fontSize: 12.5, color: '#475569', px: 1.4 }}>
                                {p.fecha_aprobado ? new Date(p.fecha_aprobado).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                              </TableCell>
                              <TableCell sx={{ fontSize: 13, fontWeight: 900, color: prom !== null ? ec.fg : '#94a3b8', px: 1.4 }}>
                                {prom !== null ? `${prom}%` : 'Sin datos'}
                              </TableCell>
                              <TableCell sx={{ px: 1.4 }}>
                                <Chip size="small" label={ec.label} sx={{ bgcolor: ec.bg, color: ec.fg, fontWeight: 800, fontSize: 10.5, height: 22 }} />
                              </TableCell>
                              <TableCell sx={{ px: 1.4 }}>
                                {(userRole === ROL_PYE || userRole === ROL_ADMIN) && (
                                  <Button size="small" variant="contained" disabled={loadingWorkflow} onClick={() => abrirSeguimiento(p.plan_codigo)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#0369a1', '&:hover': { bgcolor: '#075985' } }}>
                                    Realizar seguimiento
                                  </Button>
                                )}
                                {(userRole === ROL_ESTRATEGICA) && (
                                  <Button size="small" variant="outlined" disabled={loadingWorkflow} onClick={() => abrirSeguimiento(p.plan_codigo)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                                    Ver seguimiento
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </Box>
                );
              })()}
            </Box>
          );
        })()}
      </Paper>

      {/* Tabs del constructor: SOLO cuando hay un plan cargado */}
      {currentPlanCodigo && (
      <Paper elevation={0} sx={{ p: 0.8, borderRadius: 3.5, border: '1px solid #dbeafe', background: 'linear-gradient(180deg,#ffffff 0%,#f8fbff 100%)' }}>
        <Tabs value={workspaceTab} onChange={(_, next) => setWorkspaceTab(next)} variant="fullWidth" sx={{ minHeight: 60, '& .MuiTabs-indicator': { height: 0 }, '& .MuiTabs-flexContainer': { gap: 1 }, '& .MuiTab-root': { textTransform: 'none', fontWeight: 900, minHeight: 52, borderRadius: 2.5, color: '#64748b' }, '& .MuiTab-root.Mui-selected': { color: '#1d4ed8', background: 'linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%)', boxShadow: 'inset 0 0 0 1px rgba(59,130,246,.22)' } }}>
          <Tab value="constructor" icon={<AssignmentTurnedInIcon fontSize="small" />} iconPosition="start" label="Paso 1 · Plan y Actividades" />
          <Tab value="acta" icon={<AutoAwesomeIcon fontSize="small" />} iconPosition="start" label="Paso 2 · Acta IA" />
          <Tab value="exportacion" icon={<DownloadIcon fontSize="small" />} iconPosition="start" label="Paso 3 · Exportación" />
        </Tabs>
      </Paper>
      )}

      {/* Diálogo: confirmación adaptativa (eliminar definitivo vs devolver a Creación) */}
      {(() => {
        const esBorrador = confirmDelete?.estado_workflow === ESTADOS_WORKFLOW.BORRADOR;
        const tituloDialog = esBorrador ? 'Eliminar borrador definitivamente' : 'Devolver plan a Creación';
        const colorPrincipal = esBorrador ? '#b91c1c' : '#92400e';
        const severityAlert = esBorrador ? 'error' : 'info';
        const mensajeAlert = esBorrador
          ? 'Esta acción es irreversible. El plan y todas sus actividades quedarán marcados como eliminados.'
          : 'El plan volverá al segmento de Creación como Borrador. Se limpiarán las fechas de revisión, el responsable asignado y el estado de aprobación. El contenido del plan (actividades, indicadores) se conserva.';
        const labelBoton = esBorrador ? 'Eliminar definitivamente' : 'Devolver a Creación';
        const colorBoton = esBorrador ? 'error' : 'warning';
        return (
          <Dialog open={Boolean(confirmDelete)} onClose={() => setConfirmDelete(null)} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontWeight: 900, color: colorPrincipal }}>{tituloDialog}</DialogTitle>
            <DialogContent dividers>
              <Typography sx={{ mb: 1, fontWeight: 800, color: '#0f172a' }}>
                ¿Confirmas la acción sobre este plan?
              </Typography>
              {confirmDelete && (
                <Stack spacing={0.6} sx={{ mb: 1 }}>
                  <Typography sx={{ fontSize: 13, color: '#475569' }}>
                    <strong>Código:</strong> {confirmDelete.plan_codigo}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#475569' }}>
                    <strong>Dependencia:</strong> {confirmDelete.dependencia || '—'}
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#475569' }}>
                    <strong>Estado actual:</strong> {ESTADO_LABEL[confirmDelete.estado_workflow] || confirmDelete.estado_workflow}
                  </Typography>
                </Stack>
              )}
              <Alert severity={severityAlert} sx={{ borderRadius: 2 }}>
                {mensajeAlert}
              </Alert>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setConfirmDelete(null)} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancelar</Button>
              <Button
                variant="contained"
                color={colorBoton}
                disabled={loadingWorkflow}
                onClick={() => ejecutarAccionPapelera(confirmDelete)}
                sx={{ textTransform: 'none', fontWeight: 900 }}
              >
                {labelBoton}
              </Button>
            </DialogActions>
          </Dialog>
        );
      })()}

      {/* Diálogo: asignar responsable al enviar a Usuario Consulta */}
      <Dialog open={openAsignarResponsable} onClose={() => setOpenAsignarResponsable(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900 }}>Asignar responsable del plan</DialogTitle>
        <DialogContent dividers>
          <Typography sx={{ mb: 1.5, color: '#475569' }}>
            Escoge el Usuario Consulta que será responsable de este plan. Solo él podrá revisar y editar el plan en su bandeja.
          </Typography>
          <Autocomplete
            size="small"
            options={usuariosConsulta}
            value={usuariosConsulta.find((u) => Number(u.id) === Number(responsableSeleccionadoId)) || null}
            onChange={(_, val) => setResponsableSeleccionadoId(val?.id || '')}
            getOptionLabel={(opt) => opt ? `${opt.nombre} — ${opt.email}` : ''}
            isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
            renderInput={(params) => <TextField {...params} label="Usuario Consulta" placeholder="Escribe para buscar..." />}
            noOptionsText="No hay Usuarios Consulta activos"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAsignarResponsable(false)} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancelar</Button>
          <Button
            variant="contained"
            disabled={!responsableSeleccionadoId || loadingWorkflow}
            onClick={async () => {
              await ejecutarTransicion('enviar_a_responsable', { responsable_id: responsableSeleccionadoId });
              setOpenAsignarResponsable(false);
            }}
            sx={{ textTransform: 'none', fontWeight: 900 }}
          >
            Enviar al responsable
          </Button>
        </DialogActions>
      </Dialog>

{currentPlanCodigo && workspaceTab === 'listado' && (
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

      {currentPlanCodigo && workspaceTab === 'constructor' && (
        <Stack spacing={2} sx={{ ...(planBloqueado ? { position: 'relative' } : {}) }}>
          {planBloqueado && (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              Este plan está en estado <strong>{ESTADO_LABEL[currentPlanEstado] || currentPlanEstado}</strong> y no es editable por tu rol en este momento. Puedes verlo en modo lectura.
            </Alert>
          )}
          {/* Observaciones de Dirección de Planeación (visibles para P&E cuando el plan regresa revisado) */}
          {(userRole === ROL_PYE || userRole === ROL_ADMIN) && observacionesRevision.estrategica && (
            <Alert severity="warning" icon={false} sx={{ borderRadius: 3, border: '1px solid #fbbf24', bgcolor: '#fffbeb' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
                Observaciones de Dirección de Planeación
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#78350f', lineHeight: 1.6 }}>
                {observacionesRevision.estrategica}
              </Typography>
            </Alert>
          )}
          {/* Observaciones del responsable de la dependencia */}
          {(userRole === ROL_PYE || userRole === ROL_ADMIN) && observacionesRevision.responsable && (
            <Alert severity="info" icon={false} sx={{ borderRadius: 3, border: '1px solid #93c5fd', bgcolor: '#eff6ff' }}>
              <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1e40af', textTransform: 'uppercase', letterSpacing: 0.4, mb: 0.5 }}>
                Observaciones del responsable de la dependencia
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#1e3a8a', lineHeight: 1.6 }}>
                {observacionesRevision.responsable}
              </Typography>
            </Alert>
          )}
          <Box sx={{ ...(planBloqueado ? { pointerEvents: 'none', opacity: 0.78 } : {}) }}>
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

          <Paper ref={actividadFormRef} elevation={0} sx={{ p: 2.4, borderRadius: 4, border: editingId ? '2px solid #3b82f6' : '1px solid #e2e8f0', transition: 'border .2s' }}>
            <SectionTitle title="Paso 2 · Registrar Actividad" subtitle="Selecciona primero la estructura estratégica y luego completa el indicador y la medición." />
            <Box sx={{ display: 'grid', gap: 1.4, gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, minmax(0, 1fr))' } }}>
              {renderSelectField('Objetivo estratégico', actividadForm.objetivo_estrategico, (value) => handleActividadField('objetivo_estrategico', value), catalogs.objetivos, '', { menuMaxWidth: 760 })}
              {renderSelectField('Lineamiento estratégico', actividadForm.lineamiento_estrategico, (value) => handleActividadField('lineamiento_estrategico', value), filteredLineamientos)}
              {renderSelectField('Macroactividad estratégica', actividadForm.macroactividad, (value) => handleActividadField('macroactividad', value), filteredMacroactividades)}
            </Box>
            <Box sx={{ mt: 1.4 }}>
              <Autocomplete
                freeSolo
                size="small"
                options={actividadSugeridas}
                getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label)}
                filterOptions={(options, { inputValue }) => {
                  const q = inputValue.trim().toLowerCase();
                  if (!q) return options.slice(0, 8);
                  return options.filter((o) => o.label.toLowerCase().includes(q)).slice(0, 14);
                }}
                inputValue={actividadForm.actividad}
                onInputChange={(_, value, reason) => {
                  if (reason !== 'reset') handleActividadField('actividad', value);
                }}
                onChange={(_, option) => {
                  if (!option || typeof option === 'string') return;
                  setActividadForm((prev) => ({
                    ...prev,
                    actividad: option.actividad,
                    indicador: '',
                    ...(option.responsable && !prev.responsable ? { responsable: option.responsable } : {}),
                    ...(option.corresponsable && !prev.corresponsable ? { corresponsable: option.corresponsable } : {}),
                    ...(option.tipo_indicador && !prev.tipo_indicador ? { tipo_indicador: option.tipo_indicador } : {}),
                    ...(option.meta && !prev.meta ? { meta: option.meta } : {}),
                    ...(option.fecha_inicio && !prev.fecha_inicio ? { fecha_inicio: option.fecha_inicio } : {}),
                    ...(option.fecha_fin && !prev.fecha_fin ? { fecha_fin: option.fecha_fin } : {}),
                  }));
                }}
                renderOption={(props, option) => {
                  const { key, ...rest } = props;
                  return (
                    <Box component="li" key={key} {...rest} sx={{ py: 1, px: 1.5, flexDirection: 'column', alignItems: 'flex-start !important' }}>
                      <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4, color: '#1e293b' }}>
                        {option.label}
                      </Typography>
                      <Typography sx={{ fontSize: 11, color: '#64748b', mt: 0.3 }}>
                        {[option.dependencia, option.anio].filter(Boolean).join(' · ')}
                        {option.responsable ? ` · ${option.responsable}` : ''}
                      </Typography>
                    </Box>
                  );
                }}
                noOptionsText="Sin coincidencias — escribe para registrar nueva actividad"
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Actividad"
                    placeholder="Escribe palabras clave para buscar o redacta una nueva actividad..."
                    fullWidth
                    multiline
                    minRows={2}
                  />
                )}
                slotProps={{ paper: { elevation: 4, sx: { borderRadius: 2, mt: 0.5 } } }}
              />
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
                helperText="Suma IP + IIP (máximo 100%)"
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
            <SectionTitle title="Paso 3 · Registrar actividad" subtitle="Agrega la actividad al plan o guarda el avance en el servidor." />
            <Stack direction="row" spacing={1.2} flexWrap="wrap" sx={{ rowGap: 1 }}>
              <Button startIcon={<SaveIcon />} variant="contained" onClick={addActividad} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, minWidth: 180 }}>
                {editingId ? 'Actualizar actividad' : 'Agregar al plan'}
              </Button>
              <Button startIcon={<FilterAltOffIcon />} variant="outlined" color="inherit" onClick={resetActividadForm} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800, minWidth: 180, color: '#475569', borderColor: '#cbd5e1' }}>
                Limpiar formulario
              </Button>
              <Button startIcon={<SaveIcon />} variant="outlined" color="success" onClick={saveCurrentPlan} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900, minWidth: 180 }}>
                Guardar en servidor
              </Button>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.8, borderRadius: 4, border: '1px solid #e2e8f0' }}>
            <SectionTitle title="Plan de acción editable" subtitle="Valida en tiempo real cómo va quedando el plan. Haz clic en el lápiz para editar una actividad." />
            <Box sx={{ overflowX: 'auto', borderRadius: 2, border: '1px solid #cbd5e1' }}>
              <Table size="small" sx={{ minWidth: 900, borderCollapse: 'collapse' }}>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#1e3a8a' }}>
                    {['#', 'Objetivo estratégico', 'Actividad', 'Indicador', 'Meta', 'Resp.', 'Fechas', 'IP%', 'IIP%', 'Total%', ''].map((h) => (
                      <TableCell key={h} sx={{ color: '#fff', fontWeight: 900, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.3, py: 1.2, px: 1.2, whiteSpace: 'nowrap', borderBottom: 'none', borderRight: '1px solid rgba(255,255,255,.15)' }}>{h}</TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {actividades.map((item, idx) => {
                    const ec = estadoCumplimiento(item.total_ejecucion);
                    const bgRow = idx % 2 === 0 ? '#fff' : '#f8fafc';
                    const isEditing = editingId === item.id;
                    return (
                      <TableRow key={item.id} hover sx={{ bgcolor: isEditing ? '#eff6ff' : bgRow, outline: isEditing ? '2px solid #3b82f6' : 'none', outlineOffset: '-2px', '&:hover': { bgcolor: '#eff6ff' } }}>
                        <TableCell sx={{ fontSize: 11.5, fontWeight: 800, color: '#64748b', px: 1.2, py: 1, textAlign: 'center', verticalAlign: 'top', borderRight: '1px solid #e2e8f0', whiteSpace: 'nowrap' }}>{idx + 1}</TableCell>
                        <TableCell sx={{ fontSize: 11.5, color: '#334155', px: 1.2, py: 1, maxWidth: 160, verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>{item.objetivo_estrategico || '—'}</TableCell>
                        <TableCell sx={{ fontSize: 12.5, fontWeight: 600, color: '#0f172a', px: 1.2, py: 1, maxWidth: 220, verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>{item.actividad}</TableCell>
                        <TableCell sx={{ fontSize: 11.5, color: '#334155', px: 1.2, py: 1, maxWidth: 200, verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>
                          <Tooltip title={item.indicador || ''} arrow placement="top-start">
                            <Box sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', cursor: 'default' }}>{item.indicador}</Box>
                          </Tooltip>
                        </TableCell>
                        <TableCell sx={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', px: 1.2, py: 1, textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>{item.meta}</TableCell>
                        <TableCell sx={{ fontSize: 11.5, color: '#334155', px: 1.2, py: 1, maxWidth: 120, verticalAlign: 'top', borderRight: '1px solid #e2e8f0' }}>{item.responsable || '—'}</TableCell>
                        <TableCell sx={{ fontSize: 11, color: '#64748b', px: 1.2, py: 1, verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>
                          {item.fecha_inicio && <Box>{item.fecha_inicio}</Box>}
                          {item.fecha_fin && <Box>{item.fecha_fin}</Box>}
                        </TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', px: 1.2, py: 1, textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>{item.avance_ip ?? '—'}%</TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', px: 1.2, py: 1, textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>{item.avance_iip ?? '—'}%</TableCell>
                        <TableCell sx={{ px: 1.2, py: 1, textAlign: 'center', verticalAlign: 'top', whiteSpace: 'nowrap', borderRight: '1px solid #e2e8f0' }}>
                          <Stack spacing={0.4} alignItems="center">
                            <Typography sx={{ fontSize: 13, fontWeight: 900, color: item.total_ejecucion !== null && item.total_ejecucion !== undefined ? ec.fg : '#94a3b8' }}>
                              {item.total_ejecucion !== null && item.total_ejecucion !== undefined ? `${item.total_ejecucion}%` : '—'}
                            </Typography>
                            <Chip size="small" label={ec.label} sx={{ bgcolor: ec.bg, color: ec.fg, fontWeight: 800, fontSize: 9.5, height: 18 }} />
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ px: 0.8, py: 0.6, verticalAlign: 'top' }}>
                          <Stack direction="row" spacing={0.4}>
                            <Tooltip title="Editar actividad" arrow>
                              <IconButton size="small" onClick={() => editActividad(item)} sx={{ color: '#3b82f6' }}><EditIcon sx={{ fontSize: 15 }} /></IconButton>
                            </Tooltip>
                            <Tooltip title="Eliminar actividad" arrow>
                              <IconButton size="small" color="error" onClick={() => removeActividad(item.id)}><DeleteOutlineIcon sx={{ fontSize: 15 }} /></IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {!actividades.length && (
                    <TableRow>
                      <TableCell colSpan={11} sx={{ textAlign: 'center', py: 6, color: '#94a3b8', fontStyle: 'italic' }}>
                        Aún no se han agregado actividades al plan.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Box>
          </Paper>
          </Box>
        </Stack>
      )}

      {currentPlanCodigo && workspaceTab === 'acta' && (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '.9fr 1.1fr' }, ...(planBloqueado ? { pointerEvents: 'none', opacity: 0.78 } : {}) }}>
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
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between" sx={{ mb: 1.5 }}>
              <Box sx={{ flex: 1 }}>
                <SectionTitle title="Vista previa del Acta" subtitle={editingActa ? 'Modo edición. Modifica los campos y guarda los cambios.' : 'Mismo formato institucional COM-IF-FR-002 que se exporta a Word.'} />
              </Box>
              <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
                {!editingActa ? (
                  <Tooltip title="Editar el contenido del acta" arrow>
                    <Button size="small" variant="outlined" startIcon={<EditIcon fontSize="small" />} onClick={startEditActa} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                      Editar acta
                    </Button>
                  </Tooltip>
                ) : (
                  <>
                    <Button size="small" variant="contained" color="success" startIcon={<SaveIcon fontSize="small" />} onClick={saveActaEdits} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                      Guardar cambios
                    </Button>
                    <Tooltip title="Descartar ediciones y volver al contenido auto-generado" arrow>
                      <Button size="small" variant="outlined" color="warning" startIcon={<FilterAltOffIcon fontSize="small" />} onClick={resetActaEdits} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                        Restaurar automático
                      </Button>
                    </Tooltip>
                  </>
                )}
              </Stack>
            </Stack>

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
              <Box sx={{ p: 0.7, borderBottom: '1px solid #000', minHeight: 28, display: 'flex', alignItems: 'center', gap: 1 }}>
                <strong>Responsable(s):</strong>
                {editingActa ? (
                  <TextField size="small" variant="standard" fullWidth value={actaFinalData.responsables || ''} onChange={(e) => setActaField('responsables', e.target.value)} />
                ) : (
                  <span>{actaFinalData.responsables || ''}</span>
                )}
              </Box>

              {/* Dependencia que cita */}
              <Box sx={{ p: 0.7, borderBottom: '1px solid #000', minHeight: 28, display: 'flex', alignItems: 'center', gap: 1 }}>
                <strong>Dependencia que cita:</strong>
                {editingActa ? (
                  <TextField size="small" variant="standard" fullWidth value={actaFinalData.dependencia || ''} onChange={(e) => setActaField('dependencia', e.target.value)} />
                ) : (
                  <span>{actaFinalData.dependencia || ''}</span>
                )}
              </Box>

              {/* Sección: Información de la Reunión */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Información de la Reunión
              </Box>
              <Box sx={{ p: 0.7, borderBottom: '1px solid #000', minHeight: 26, display: 'flex', alignItems: 'center', gap: 1 }}>
                <strong>Lugar:</strong>
                {editingActa ? (
                  <TextField size="small" variant="standard" fullWidth value={actaFinalData.lugar || ''} onChange={(e) => setActaField('lugar', e.target.value)} />
                ) : (
                  <span>{actaFinalData.lugar || ''}</span>
                )}
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: '70% 30%', borderBottom: '1px solid #000', minHeight: 26 }}>
                <Box sx={{ p: 0.7, borderRight: '1px solid #000', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <strong>Fecha:</strong>
                  {editingActa ? (
                    <TextField size="small" variant="standard" type="date" value={actaFinalData.fecha || ''} onChange={(e) => setActaField('fecha', e.target.value)} InputLabelProps={{ shrink: true }} />
                  ) : (
                    <span>{actaFinalData.fecha || ''}</span>
                  )}
                </Box>
                <Box sx={{ p: 0.7, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <strong>Horario:</strong>
                  {editingActa ? (
                    <TextField size="small" variant="standard" fullWidth value={actaFinalData.horario || ''} onChange={(e) => setActaField('horario', e.target.value)} placeholder="08:00 - 10:00" />
                  ) : (
                    <span>{actaFinalData.horario || ''}</span>
                  )}
                </Box>
              </Box>

              {/* Sección: Participantes */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Participantes
              </Box>
              <Box sx={{ display: 'grid', gridTemplateColumns: editingActa ? '7% 38% 25% 22% 8%' : '7% 43% 25% 25%', bgcolor: '#F2F2F2', fontWeight: 900, borderBottom: '1px solid #000', fontSize: 11 }}>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000' }}>&nbsp;</Box>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000' }}>Nombres y Apellidos</Box>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000' }}>Cargo</Box>
                <Box sx={{ p: 0.5, textAlign: 'center', borderRight: editingActa ? '1px solid #000' : 'none' }}>Firma</Box>
                {editingActa && <Box sx={{ p: 0.5, textAlign: 'center' }}>&nbsp;</Box>}
              </Box>
              {(() => {
                const list = actaFinalData.participantes || [];
                const visibles = editingActa ? list : Array.from({ length: Math.max(10, list.length) }).map((_, i) => list[i] || {});
                return visibles.map((p, i) => (
                  <Box key={i} sx={{ display: 'grid', gridTemplateColumns: editingActa ? '7% 38% 25% 22% 8%' : '7% 43% 25% 25%', borderBottom: '1px solid #000', minHeight: 24 }}>
                    <Box sx={{ p: 0.4, textAlign: 'center', borderRight: '1px solid #000', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</Box>
                    <Box sx={{ p: 0.4, borderRight: '1px solid #000', display: 'flex', alignItems: 'center' }}>
                      {editingActa ? (
                        <TextField size="small" variant="standard" fullWidth value={p?.nombre || ''} onChange={(e) => setActaParticipante(i, 'nombre', e.target.value)} />
                      ) : (
                        <span>{p?.nombre || ''}</span>
                      )}
                    </Box>
                    <Box sx={{ p: 0.4, borderRight: '1px solid #000', display: 'flex', alignItems: 'center' }}>
                      {editingActa ? (
                        <TextField size="small" variant="standard" fullWidth value={p?.cargo || ''} onChange={(e) => setActaParticipante(i, 'cargo', e.target.value)} />
                      ) : (
                        <span>{p?.cargo || ''}</span>
                      )}
                    </Box>
                    <Box sx={{ p: 0.4, borderRight: editingActa ? '1px solid #000' : 'none' }}>&nbsp;</Box>
                    {editingActa && (
                      <Box sx={{ p: 0.2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Tooltip title="Quitar fila" arrow>
                          <IconButton size="small" onClick={() => removeActaParticipante(i)} sx={{ p: 0.3, color: '#b91c1c' }}>
                            <DeleteOutlineIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                  </Box>
                ));
              })()}
              {editingActa && (
                <Box sx={{ p: 0.6, borderBottom: '1px solid #000', textAlign: 'center', bgcolor: '#fafafa' }}>
                  <Button size="small" startIcon={<AutoAwesomeIcon fontSize="small" />} onClick={addActaParticipante} sx={{ textTransform: 'none', fontWeight: 800 }}>
                    Agregar participante
                  </Button>
                </Box>
              )}

              {/* Sección: Objetivo */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Objetivo
              </Box>
              <Box sx={{ p: 0.9, borderBottom: '1px solid #000', minHeight: 60, textAlign: 'justify' }}>
                {editingActa ? (
                  <TextField size="small" variant="standard" fullWidth multiline minRows={2} value={arrayToText(actaFinalData.objetivo)} onChange={(e) => setActaField('objetivo', textToArray(e.target.value))} />
                ) : (
                  <Box sx={{ whiteSpace: 'pre-line' }}>{(actaFinalData.objetivo || []).join('\n')}</Box>
                )}
              </Box>

              {/* Sección: Desarrollo */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Desarrollo
              </Box>
              <Box sx={{ p: 0.9, borderBottom: '1px solid #000', minHeight: 90, textAlign: 'justify' }}>
                {editingActa ? (
                  <TextField size="small" variant="standard" fullWidth multiline minRows={4} value={arrayToText(actaFinalData.desarrollo)} onChange={(e) => setActaField('desarrollo', textToArray(e.target.value))} />
                ) : (
                  <Box sx={{ whiteSpace: 'pre-line' }}>{(actaFinalData.desarrollo || []).join('\n')}</Box>
                )}
              </Box>

              {/* Sección: Conclusiones / Compromisos */}
              <Box sx={{ bgcolor: '#D9D9D9', p: 0.7, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000' }}>
                Conclusiones / Compromisos
              </Box>
              <Box sx={{ p: 0.9, minHeight: 70, textAlign: 'justify' }}>
                {editingActa ? (
                  <TextField size="small" variant="standard" fullWidth multiline minRows={3} value={arrayToText(actaFinalData.conclusiones)} onChange={(e) => setActaField('conclusiones', textToArray(e.target.value))} />
                ) : (
                  <Box sx={{ whiteSpace: 'pre-line' }}>{(actaFinalData.conclusiones || []).join('\n')}</Box>
                )}
              </Box>
            </Box>

            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 2 }}>
              <Button startIcon={<DescriptionIcon />} variant="contained" onClick={exportActaWord} disabled={editingActa} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Exportar acta a Word</Button>
              <Button startIcon={<SaveIcon />} variant="outlined" onClick={saveCurrentPlan} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>Guardar borrador del acta</Button>
            </Stack>
          </Paper>
        </Box>
      )}

      {currentPlanCodigo && workspaceTab === 'exportacion' && (
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

  const cargarDashboardPlanAccion = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const response = await gestionInformacionService.getPlanAccionDashboard();
      setDashboard(response.data || { rows: [], filters: {}, meta: {} });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar PlaneaciÃ³n y Efectividad', { variant: 'error' });
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
    cargarDashboardPlanAccion({ silent: true });
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
            <GestionPlanesWorkspaceV2 sourceRows={dashboard.rows || []} onWorkflowChanged={cargarDashboardPlanAccion} />
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
