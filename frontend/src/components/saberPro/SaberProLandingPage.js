import React, { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import {
  Box, Stack, Typography, Paper, Chip, Button, Divider,
  Select, MenuItem, FormControl, InputLabel, Avatar
} from '@mui/material';
import ArrowBackRoundedIcon      from '@mui/icons-material/ArrowBackRounded';
import KeyboardArrowDownIcon     from '@mui/icons-material/KeyboardArrowDown';
import ChevronRightIcon          from '@mui/icons-material/ChevronRight';
import TrendingUpRoundedIcon     from '@mui/icons-material/TrendingUpRounded';
import TrendingDownRoundedIcon   from '@mui/icons-material/TrendingDownRounded';
import SchoolRoundedIcon         from '@mui/icons-material/SchoolRounded';
import BarChartRoundedIcon       from '@mui/icons-material/BarChartRounded';
import AutoGraphRoundedIcon      from '@mui/icons-material/AutoGraphRounded';
import EmojiEventsRoundedIcon    from '@mui/icons-material/EmojiEventsRounded';
import AssessmentRoundedIcon     from '@mui/icons-material/AssessmentRounded';
import CompareArrowsRoundedIcon  from '@mui/icons-material/CompareArrowsRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import StarRoundedIcon           from '@mui/icons-material/StarRounded';
import GroupsRoundedIcon         from '@mui/icons-material/GroupsRounded';
import FilterListRoundedIcon     from '@mui/icons-material/FilterListRounded';
import ManageSearchRoundedIcon   from '@mui/icons-material/ManageSearchRounded';
import PersonSearchRoundedIcon   from '@mui/icons-material/PersonSearchRounded';
import UploadFileRoundedIcon     from '@mui/icons-material/UploadFileRounded';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine,
  Cell, LabelList
} from 'recharts';
import { useAuth } from '../../context/AuthContext';
import SaberProDashboard from './SaberProDashboard';
import SaberProAgregadosDashboard from './SaberProAgregadosDashboard';
import ConsultaValidacion from './ConsultaValidacion';

/* ═══════════════════════════════════════════════════════════════════
   NAV CONFIG
═══════════════════════════════════════════════════════════════════ */
const NAV_CONFIG = [
  {
    key: 'individuales', label: 'Resultados Individuales',
    color: '#2563eb', lightBg: '#eff6ff', icon: SchoolRoundedIcon,
    items: [
      { key: 'saber_pro',    label: 'Resultados Saber Pro',          desc: 'Puntajes y percentiles por estudiante.',                    icon: AssessmentRoundedIcon,       color: '#2563eb' },
      { key: 'tyt',          label: 'Resultados TyT',                desc: 'Análisis filtrado para prueba Saber TyT.',                  icon: BarChartRoundedIcon,          color: '#0ea5e9' },
      { key: 'destacados',   label: 'Resultados Destacados',         desc: 'Ranking de estudiantes con mejor desempeño.',               icon: EmojiEventsRoundedIcon,       color: '#f59e0b' },
      { key: 'competencias', label: 'Rendimiento por Competencia',   desc: 'Análisis por núcleo y competencia genérica.',               icon: TrendingUpRoundedIcon,        color: '#10b981' },
      { key: 'becas',        label: 'Becas por Rendimiento General', desc: 'Priorización para apoyos y reconocimientos.',               icon: WorkspacePremiumRoundedIcon,  color: '#8b5cf6' }
    ]
  },
  {
    key: 'agregados', label: 'Resultados Agregados',
    color: '#0891b2', lightBg: '#ecfeff', icon: BarChartRoundedIcon,
    items: [
      { key: 'general',                  label: 'Resultados Saber Pro Agregados',    desc: 'Promedios institucionales por año y programa.',  icon: BarChartRoundedIcon,      color: '#0891b2' },
      { key: 'competencias_especificas', label: 'Agregado Competencias Específicas', desc: 'Competencias específicas del programa.',         icon: AssessmentRoundedIcon,    color: '#059669' },
      { key: 'competencias_genericas',   label: 'Agregado Competencias Genéricas',   desc: 'Razonamiento, lectura crítica, inglés…',         icon: TrendingUpRoundedIcon,    color: '#0d9488' },
      { key: 'comparativo_general',      label: 'Comparativo Saber Pro',             desc: 'Institución vs grupo de referencia.',           icon: CompareArrowsRoundedIcon, color: '#0284c7' },
      { key: 'comparativo_especificas',  label: 'Comparativo Específicas',           desc: 'Específicas comparadas con referencia.',        icon: CompareArrowsRoundedIcon, color: '#14b8a6' }
    ]
  },
  {
    key: 'valor_agregado', label: 'Valor Agregado',
    color: '#7c3aed', lightBg: '#faf5ff', icon: AutoGraphRoundedIcon,
    items: [
      { key: 'va_individual',  label: 'Valor Agregado Individual',          desc: 'Trayectoria Saber 11 → Saber Pro por estudiante.', icon: SchoolRoundedIcon,     color: '#7c3aed' },
      { key: 'va_general',     label: 'Valor Agregado Resultado General',   desc: 'Estimación institucional agregada.',               icon: TrendingUpRoundedIcon, color: '#8b5cf6' },
      { key: 'va_estadistica', label: 'Valor Agregado Estadística General', desc: 'KPIs y distribución estadística.',                 icon: AutoGraphRoundedIcon,  color: '#a78bfa' },
      { key: 'va_nbc',         label: 'Valor Agregado NBC',                 desc: 'Por Núcleo Básico del Conocimiento.',             icon: AssessmentRoundedIcon, color: '#6d28d9' }
    ]
  },
  {
    key: 'consulta', label: 'Consulta y Validación',
    color: '#0891b2', lightBg: '#ecfeff', icon: ManageSearchRoundedIcon,
    items: [
      { key: 'individual', label: 'Consulta Individual',   desc: 'Busca resultados por número de documento.',           icon: PersonSearchRoundedIcon, color: '#0891b2' },
      { key: 'masiva',     label: 'Validación Masiva',     desc: 'Carga un Excel/CSV con documentos para validar masivamente.', icon: UploadFileRoundedIcon,   color: '#10b981' }
    ]
  }
];

/* ═══════════════════════════════════════════════════════════════════
   DATOS DE REFERENCIA  (basados en registros reales de BD)
═══════════════════════════════════════════════════════════════════ */
const ALL_YEARS    = ['2021', '2022', '2023', '2024'];
const ALL_PERIODS  = ['I', 'II'];
const ALL_TYPES    = ['Saber Pro', 'TyT'];

const SABER_PRO_PERMISSION_BY_GROUP = {
  individuales: {
    general: 'saber_pro_individuales_general',
    saber_pro: 'saber_pro_individuales_saber_pro',
    tyt: 'saber_pro_individuales_tyt',
    destacados: 'saber_pro_individuales_destacados',
    competencias: 'saber_pro_individuales_competencias',
    becas: 'saber_pro_individuales_becas'
  },
  agregados: {
    general: 'saber_pro_agregados_general',
    competencias_especificas: 'saber_pro_agregados_competencias_especificas',
    competencias_genericas: 'saber_pro_agregados_competencias_genericas',
    comparativo_general: 'saber_pro_agregados_comparativo_general',
    comparativo_especificas: 'saber_pro_agregados_comparativo_especificas'
  },
  valor_agregado: {
    va_individual: 'saber_pro_valor_agregado_individual',
    va_general: 'saber_pro_valor_agregado_resultado_general',
    va_estadistica: 'saber_pro_valor_agregado_estadistica_general',
    va_nbc: 'saber_pro_valor_agregado_nbc'
  },
  consulta: {
    individual: 'saber_pro_consulta_individual',
    masiva: 'saber_pro_validacion_masiva'
  }
};

/* Programas académicos reales de la institución */
const ALL_PROGRAMS = [
  'Todos',
  'Derecho',
  'Psicología',
  'Arquitectura',
  'Contaduría Pública',
  'Admón. de Empresas',
  'Ing. de Sistemas',
  'Ing. Electrónica',
  'Lic. Ed. Física',
  'Lic. Ed. Infantil',
  'Diseño Gráfico'
];

/*
  Promedios institucionales reales por año/período (fuente: BD)
  saber_pro puntaje_global  |  tyt puntaje_global  |  estudiantes únicos  |  percentil_nacional_global
*/
const MOCK_BY_PERIOD = {
  '2021': {
    I:  { saberPro: null,  tyt: 38.0,  estudiantes: 7,    percentil: 18  },
    II: { saberPro: 130.3, tyt: 84.0,  estudiantes: 1028, percentil: 38  }
  },
  '2022': {
    I:  { saberPro: 113.8, tyt: 86.9,  estudiantes: 124,  percentil: 31  },
    II: { saberPro: 127.2, tyt: 84.5,  estudiantes: 840,  percentil: 35  }
  },
  '2023': {
    I:  { saberPro: 120.0, tyt: 92.7,  estudiantes: 18,   percentil: 16  },
    II: { saberPro: 130.0, tyt: null,   estudiantes: 430,  percentil: 39  }
  },
  '2024': {
    I:  { saberPro: 124.8, tyt: 92.9,  estudiantes: 276,  percentil: 35  },
    II: { saberPro: 130.1, tyt: 64.3,  estudiantes: 810,  percentil: 36  }
  }
};

/* Promedio anual acumulado I+II (pondera por estudiantes) */
const annualAvg = (year, key) => {
  const p = MOCK_BY_PERIOD[year];
  if (!p) return null;
  const vI  = p.I[key];
  const vII = p.II[key];
  const nI  = p.I.estudiantes  || 0;
  const nII = p.II.estudiantes || 0;
  if (vI != null && vII != null && nI + nII > 0) return parseFloat(((vI * nI + vII * nII) / (nI + nII)).toFixed(1));
  if (vII != null) return vII;
  return vI;
};

/*
  Tendencia histórica institucional (ponderada real donde aplica)
  referencia = promedio nacional ICFES (estimado)
*/
const MOCK_TREND_BASE = [
  { year: '2021', saberPro: 130.3, tyt: 84.0,  referencia: 150.1 },
  { year: '2022', saberPro: 124.1, tyt: 85.3,  referencia: 150.8 },
  { year: '2023', saberPro: 130.0, tyt: 92.7,  referencia: 151.5 },
  { year: '2024', saberPro: 128.9, tyt: 91.2,  referencia: 152.0 }
];

/* ── Generadores dinámicos (deterministas por semilla) ────────────── */
const _hash = (s) => [...s].reduce((h, c) => (Math.imul(31, h) + c.charCodeAt(0)) | 0, 0);
const _rnd  = (seed) => { const x = Math.sin(Math.abs(seed) + 1) * 10000; return x - Math.floor(x); };

/*
  Promedios reales por programa — Saber Pro 2024-II (fuente: BD)
  Usados como base; el generador aplica variación pequeña por año/periodo
*/
const PROG_BASE = {
  'Derecho':           { saberPro: 136.4, tyt: 90.0,  percentil: 42, n: 248 },
  'Psicología':        { saberPro: 127.3, tyt: 86.0,  percentil: 32, n: 166 },
  'Arquitectura':      { saberPro: 132.4, tyt: 88.0,  percentil: 35, n: 80  },
  'Contaduría Pública':{ saberPro: 126.6, tyt: 84.5,  percentil: 32, n: 75  },
  'Admón. de Empresas':{ saberPro: 136.8, tyt: 91.0,  percentil: 39, n: 36  },
  'Ing. de Sistemas':  { saberPro: 136.1, tyt: 93.0,  percentil: 43, n: 36  },
  'Ing. Electrónica':  { saberPro: 141.2, tyt: 95.0,  percentil: 46, n: 21  },
  'Lic. Ed. Física':   { saberPro: 107.1, tyt: 75.0,  percentil: 18, n: 94  },
  'Lic. Ed. Infantil': { saberPro: 134.4, tyt: 88.5,  percentil: 39, n: 39  },
  'Diseño Gráfico':    { saberPro: 142.4, tyt: 94.0,  percentil: 47, n: 15  }
};

/*
  Competencias genéricas — escala modular ICFES (10-300 global compuesto)
  Valores representativos para Saber Pro y TyT
*/
const COMP_BASE_SP = [
  { name: 'Comp. Ciudadanas',   base: 130, refBase: 150 },
  { name: 'Com. Escrita',       base: 128, refBase: 148 },
  { name: 'Lectura Crítica',    base: 126, refBase: 152 },
  { name: 'Raz. Cuantitativo',  base: 122, refBase: 147 },
  { name: 'Inglés',             base: 116, refBase: 140 }
];
const COMP_BASE_TYT = [
  { name: 'Comp. Ciudadanas',   base: 92,  refBase: 105 },
  { name: 'Com. Escrita',       base: 88,  refBase: 102 },
  { name: 'Lectura Crítica',    base: 85,  refBase: 106 },
  { name: 'Raz. Cuantitativo',  base: 82,  refBase: 100 },
  { name: 'Inglés',             base: 75,  refBase:  98 }
];

function buildProgramas(year, periodo, tipo) {
  const typeKey = tipo === 'TyT' ? 'tyt' : 'saberPro';
  return Object.entries(PROG_BASE).map(([prog, bases]) => {
    const seed     = _hash(`${prog}${year}${periodo}${tipo}`);
    const seedPrev = _hash(`${prog}${parseInt(year) - 1}${periodo}${tipo}`);
    /* variación pequeña ±5 pts para simular cambio interanual */
    const score     = parseFloat((bases[typeKey] + (_rnd(seed)     - 0.5) * 10).toFixed(1));
    const scorePrev = parseFloat((bases[typeKey] + (_rnd(seedPrev) - 0.5) * 10).toFixed(1));
    const delta     = parseFloat((score - scorePrev).toFixed(1));
    const nStudents = Math.max(5, Math.round(bases.n * (0.80 + _rnd(seed + 7) * 0.40)));
    return { programa: prog, promedio: score, n: nStudents, delta, tendencia: `${delta >= 0 ? '+' : ''}${delta} pts` };
  }).sort((a, b) => b.promedio - a.promedio);
}

function buildCompetencias(year, periodo, tipo, programa) {
  const bases = tipo === 'TyT' ? COMP_BASE_TYT : COMP_BASE_SP;
  return bases.map(({ name, base, refBase }) => {
    const progAdj = programa !== 'Todos'
      ? (PROG_BASE[programa] ? (PROG_BASE[programa].saberPro - 130) * 0.4 : 0)
        + (_rnd(_hash(`${programa}${name}`)) - 0.5) * 8
      : 0;
    const seed = _hash(`${name}${year}${periodo}${tipo}${programa}`);
    const inst  = parseFloat((base + progAdj + (_rnd(seed)    - 0.5) * 8).toFixed(1));
    const ref   = parseFloat((refBase        + (_rnd(seed + 3) - 0.5) * 5).toFixed(1));
    return { name, inst, reference: ref, diff: parseFloat((inst - ref).toFixed(1)) };
  });
}

function buildDistribucion(year, periodo, tipo, programa) {
  const seed   = _hash(`dist${year}${periodo}${tipo}${programa}`);
  /* Centro real de la distribución basado en datos BD */
  const instRow = MOCK_BY_PERIOD[year]?.[periodo];
  const baseCenter = tipo === 'TyT'
    ? (instRow?.tyt ?? 88)
    : (instRow?.saberPro ?? 128);
  const center = programa !== 'Todos' && PROG_BASE[programa]
    ? (tipo === 'TyT' ? PROG_BASE[programa].tyt : PROG_BASE[programa].saberPro)
    : baseCenter;
  const spread = programa !== 'Todos' ? 0.55 : 1;
  const rangos  = tipo === 'TyT'
    ? ['50-60','61-70','71-80','81-90','91-100','101-110','111-120','121+']
    : ['90-100','101-110','111-120','121-130','131-140','141-150','151-160','161+'];
  const centerValues = tipo === 'TyT'
    ? [55, 65.5, 75.5, 85.5, 95.5, 105.5, 115.5, 125]
    : [95, 105.5, 115.5, 125.5, 135.5, 145.5, 155.5, 165];
  return rangos.map((rango, i) => {
    const dist  = Math.abs(centerValues[i] - center);
    const base  = Math.max(3, Math.round(600 * spread * Math.exp(-0.005 * dist * dist)));
    const noise = Math.round((_rnd(seed + i) - 0.5) * base * 0.35);
    return { rango, count: Math.max(2, base + noise) };
  });
}

/* ═══════════════════════════════════════════════════════════════════
   TOOLTIP CUSTOM
═══════════════════════════════════════════════════════════════════ */
const CustomTooltip = ({ active, payload, label, unit = '' }) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={0} sx={{ p: 1.5, border: '1px solid #e2e8f0', borderRadius: 2, minWidth: 140, boxShadow: '0 8px 24px rgba(15,23,42,0.12)' }}>
      <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#475569', mb: 0.8 }}>{label}</Typography>
      {payload.map((p) => (
        <Stack key={p.dataKey} direction="row" justifyContent="space-between" spacing={2}>
          <Typography sx={{ fontSize: 11.5, color: p.color, fontWeight: 700 }}>{p.name}</Typography>
          <Typography sx={{ fontSize: 11.5, color: '#0f172a', fontWeight: 800 }}>{p.value}{unit}</Typography>
        </Stack>
      ))}
    </Paper>
  );
};

/* ═══════════════════════════════════════════════════════════════════
   KPI CARD
═══════════════════════════════════════════════════════════════════ */
function KpiCard({ label, value, sub, delta, deltaPositive, deltaLabel, color, icon: Icon, onClick }) {
  const up = deltaPositive !== false && (typeof deltaPositive === 'boolean' ? deltaPositive : parseFloat(delta) >= 0);
  return (
    <Paper
      onClick={onClick}
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: `1.5px solid ${color}18`,
        background: `linear-gradient(145deg, #ffffff 0%, ${color}06 100%)`,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        flex: 1,
        minWidth: 0,
        '&:hover': onClick ? {
          transform: 'translateY(-2px)',
          boxShadow: `0 12px 28px ${color}18`,
          borderColor: `${color}40`
        } : {}
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
        <Box>
          <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', mb: 0.6 }}>
            {label}
          </Typography>
          <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1, letterSpacing: '-0.03em' }}>
            {value}
          </Typography>
          {sub && (
            <Typography sx={{ fontSize: 11.5, color: '#94a3b8', mt: 0.4, fontWeight: 500 }}>
              {sub}
            </Typography>
          )}
        </Box>
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2,
            bgcolor: `${color}12`,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0
          }}
        >
          <Icon sx={{ fontSize: 20, color }} />
        </Box>
      </Stack>

      {delta && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 1.2 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.3,
              px: 0.8,
              py: 0.2,
              borderRadius: 1,
              bgcolor: up ? '#dcfce7' : '#fee2e2'
            }}
          >
            {up
              ? <TrendingUpRoundedIcon sx={{ fontSize: 13, color: '#16a34a' }} />
              : <TrendingDownRoundedIcon sx={{ fontSize: 13, color: '#dc2626' }} />
            }
            <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: up ? '#16a34a' : '#dc2626' }}>
              {delta}
            </Typography>
          </Box>
          <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>{deltaLabel || 'vs año anterior'}</Typography>
        </Stack>
      )}
    </Paper>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   DASHBOARD OVERVIEW (vista por defecto)
═══════════════════════════════════════════════════════════════════ */
function DashboardOverview({ onNavigate }) {
  const [filterYear,    setFilterYear]    = useState('2024');
  const [filterProgram, setFilterProgram] = useState('Todos');
  const [filterType,    setFilterType]    = useState('Saber Pro');
  const [filterPeriodo, setFilterPeriodo] = useState('II');

  const typeKey = filterType === 'TyT' ? 'tyt' : 'saberPro';
  const prevYear = ALL_YEARS[ALL_YEARS.indexOf(filterYear) - 1] || null;

  /* ── Datos dinámicos reactivos a todos los filtros ── */
  const allProgramas = useMemo(
    () => buildProgramas(filterYear, filterPeriodo, filterType),
    [filterYear, filterPeriodo, filterType]
  );
  const allProgramasPrev = useMemo(
    () => prevYear ? buildProgramas(prevYear, filterPeriodo, filterType) : [],
    [prevYear, filterPeriodo, filterType]
  );

  /* ── Puntaje principal (institución o programa seleccionado) ── */
  const instRow    = MOCK_BY_PERIOD[filterYear]?.[filterPeriodo];
  const instPrevRow = prevYear ? MOCK_BY_PERIOD[prevYear]?.[filterPeriodo] : null;

  const mainScore = useMemo(() => {
    if (filterProgram !== 'Todos') {
      return allProgramas.find((p) => p.programa === filterProgram)?.promedio ?? null;
    }
    return instRow ? instRow[typeKey] : null;
  }, [filterProgram, allProgramas, instRow, typeKey]);

  const prevPeriodScore = useMemo(() => {
    if (filterProgram !== 'Todos') {
      return allProgramasPrev.find((p) => p.programa === filterProgram)?.promedio ?? null;
    }
    return instPrevRow ? instPrevRow[typeKey] : null;
  }, [filterProgram, allProgramasPrev, instPrevRow, typeKey]);

  /* Delta vs mismo periodo año anterior (puntos absolutos) */
  const periodDeltaPts = (mainScore != null && prevPeriodScore != null)
    ? parseFloat((mainScore - prevPeriodScore).toFixed(1)) : null;

  /* Acumulado anual: promedio I+II */
  const annualCurrent = useMemo(() => {
    if (filterProgram !== 'Todos') {
      const curI  = buildProgramas(filterYear, 'I', filterType).find((p) => p.programa === filterProgram)?.promedio ?? null;
      const curII = buildProgramas(filterYear, 'II', filterType).find((p) => p.programa === filterProgram)?.promedio ?? null;
      return (curI != null && curII != null) ? parseFloat(((curI + curII) / 2).toFixed(1)) : null;
    }
    return annualAvg(filterYear, typeKey);
  }, [filterProgram, filterYear, filterType, typeKey]);

  const annualPrev = useMemo(() => {
    if (!prevYear) return null;
    if (filterProgram !== 'Todos') {
      const pI  = buildProgramas(prevYear, 'I', filterType).find((p) => p.programa === filterProgram)?.promedio ?? null;
      const pII = buildProgramas(prevYear, 'II', filterType).find((p) => p.programa === filterProgram)?.promedio ?? null;
      return (pI != null && pII != null) ? parseFloat(((pI + pII) / 2).toFixed(1)) : null;
    }
    return annualAvg(prevYear, typeKey);
  }, [filterProgram, prevYear, filterType, typeKey]);

  const annualDeltaPts = (annualCurrent != null && annualPrev != null)
    ? parseFloat((annualCurrent - annualPrev).toFixed(1)) : null;

  /* Estudiantes (dinámico) */
  const estudiantesCurrent = useMemo(() => {
    if (filterProgram !== 'Todos') return allProgramas.find((p) => p.programa === filterProgram)?.n ?? null;
    return instRow?.estudiantes ?? null;
  }, [filterProgram, allProgramas, instRow]);

  const estudiantesPrev = useMemo(() => {
    if (filterProgram !== 'Todos') return allProgramasPrev.find((p) => p.programa === filterProgram)?.n ?? null;
    return instPrevRow?.estudiantes ?? null;
  }, [filterProgram, allProgramasPrev, instPrevRow]);

  const estudiantesDelta = (estudiantesCurrent != null && estudiantesPrev != null)
    ? estudiantesCurrent - estudiantesPrev : null;

  /* Percentil (sólo institucional — no por programa en mock) */
  const percentilCurrent = instRow?.percentil ?? null;
  const percentilPrev    = instPrevRow?.percentil ?? null;
  const percentilDelta   = (percentilCurrent != null && percentilPrev != null)
    ? percentilCurrent - percentilPrev : null;

  const programData = useMemo(
    () => filterProgram === 'Todos' ? allProgramas : allProgramas.filter((p) => p.programa === filterProgram),
    [allProgramas, filterProgram]
  );

  const competenciasData = useMemo(
    () => buildCompetencias(filterYear, filterPeriodo, filterType, filterProgram),
    [filterYear, filterPeriodo, filterType, filterProgram]
  );

  const distribucionData = useMemo(
    () => buildDistribucion(filterYear, filterPeriodo, filterType, filterProgram),
    [filterYear, filterPeriodo, filterType, filterProgram]
  );

  /* Tendencia histórica: cuando hay un programa seleccionado, ajusta la serie */
  const trendData = useMemo(() => {
    const yearIdx = ALL_YEARS.indexOf(filterYear);
    return ALL_YEARS.slice(0, yearIdx + 1).map((y) => {
      const progAdj = filterProgram !== 'Todos'
        ? (_rnd(_hash(`${filterProgram}${y}${filterPeriodo}`)) - 0.5) * 8 : 0;
      const base = MOCK_TREND_BASE.find((r) => r.year === y);
      return {
        year: y,
        saberPro: parseFloat((base.saberPro + progAdj).toFixed(1)),
        tyt:      parseFloat((base.tyt      + progAdj * 0.85).toFixed(1)),
        referencia: base.referencia
      };
    });
  }, [filterYear, filterProgram, filterPeriodo]);

  const lineColor = filterType === 'TyT' ? '#0891b2' : '#2563eb';

  const selectSx = {
    fontSize: 12.5,
    fontWeight: 700,
    height: 36,
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#e2e8f0' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#94a3b8' },
    bgcolor: '#fff'
  };

  return (
    <Box sx={{ p: { xs: 1.5, md: 2.5 }, bgcolor: '#f1f5f9', minHeight: 'calc(100vh - 54px)' }}>

      {/* ── Filtros ── */}
      <Paper
        elevation={0}
        sx={{
          mb: 2,
          p: 1.5,
          borderRadius: 2.5,
          border: '1px solid #e2e8f0',
          bgcolor: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          flexWrap: 'wrap'
        }}
      >
        <Stack direction="row" spacing={0.6} alignItems="center" sx={{ color: '#64748b' }}>
          <FilterListRoundedIcon sx={{ fontSize: 16 }} />
          <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', whiteSpace: 'nowrap' }}>Filtros:</Typography>
        </Stack>

        <FormControl size="small" sx={{ minWidth: 110 }}>
          <InputLabel sx={{ fontSize: 12 }}>Año</InputLabel>
          <Select value={filterYear} onChange={(e) => setFilterYear(e.target.value)} label="Año" sx={selectSx}>
            {ALL_YEARS.map((y) => <MenuItem key={y} value={y} sx={{ fontSize: 12.5 }}>{y}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 100 }}>
          <InputLabel sx={{ fontSize: 12 }}>Periodo</InputLabel>
          <Select value={filterPeriodo} onChange={(e) => setFilterPeriodo(e.target.value)} label="Periodo" sx={selectSx}>
            {ALL_PERIODS.map((p) => (
              <MenuItem key={p} value={p} sx={{ fontSize: 12.5 }}>
                <Stack direction="row" spacing={0.8} alignItems="center">
                  <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: p === 'I' ? '#2563eb' : '#7c3aed' }} />
                  <span>{p === 'I' ? 'I (Ene–Jun)' : 'II (Jul–Dic)'}</span>
                </Stack>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 165 }}>
          <InputLabel sx={{ fontSize: 12 }}>Programa</InputLabel>
          <Select value={filterProgram} onChange={(e) => setFilterProgram(e.target.value)} label="Programa" sx={selectSx}>
            {ALL_PROGRAMS.map((p) => <MenuItem key={p} value={p} sx={{ fontSize: 12.5 }}>{p}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel sx={{ fontSize: 12 }}>Tipo de prueba</InputLabel>
          <Select value={filterType} onChange={(e) => setFilterType(e.target.value)} label="Tipo de prueba" sx={selectSx}>
            {ALL_TYPES.map((t) => <MenuItem key={t} value={t} sx={{ fontSize: 12.5 }}>{t}</MenuItem>)}
          </Select>
        </FormControl>

        <Box sx={{ ml: 'auto' }}>
          <Chip
            size="small"
            label="Datos de referencia — activa un módulo para datos reales"
            sx={{ fontSize: 10.5, fontWeight: 600, bgcolor: '#fffbeb', color: '#92400e', border: '1px solid #fde68a' }}
          />
        </Box>
      </Paper>

      {/* ── KPIs ── */}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }} flexWrap="wrap" useFlexGap>
        <KpiCard
          label="Promedio Global"
          value={mainScore != null ? mainScore.toFixed(1) : '—'}
          sub={`${filterType} · ${filterYear}-${filterPeriodo}`}
          delta={periodDeltaPts != null ? `${periodDeltaPts > 0 ? '+' : ''}${periodDeltaPts} pts` : null}
          deltaPositive={periodDeltaPts != null ? periodDeltaPts >= 0 : undefined}
          color="#2563eb"
          icon={AssessmentRoundedIcon}
          onClick={() => onNavigate('individuales', 'saber_pro')}
          deltaLabel={prevYear ? `vs ${prevYear}-${filterPeriodo}` : undefined}
        />
        <KpiCard
          label="Percentil Institucional"
          value={percentilCurrent != null ? `P${percentilCurrent}` : '—'}
          sub={`Nacional · ${filterYear}-${filterPeriodo}`}
          delta={percentilDelta != null ? `${percentilDelta > 0 ? '+' : ''}${percentilDelta} pts` : null}
          deltaPositive={percentilDelta != null ? percentilDelta >= 0 : undefined}
          color="#0891b2"
          icon={TrendingUpRoundedIcon}
          onClick={() => onNavigate('agregados', 'general')}
          deltaLabel={prevYear ? `vs ${prevYear}-${filterPeriodo}` : undefined}
        />
        <KpiCard
          label="Estudiantes Evaluados"
          value={estudiantesCurrent != null ? estudiantesCurrent.toLocaleString() : '—'}
          sub={`Cohorte ${filterYear}-${filterPeriodo}`}
          delta={estudiantesDelta != null ? `${estudiantesDelta > 0 ? '+' : ''}${estudiantesDelta}` : null}
          deltaPositive={estudiantesDelta != null ? estudiantesDelta >= 0 : undefined}
          color="#10b981"
          icon={GroupsRoundedIcon}
          deltaLabel={prevYear ? `vs ${prevYear}-${filterPeriodo}` : undefined}
        />
        <KpiCard
          label="Acumulado Anual"
          value={annualCurrent != null ? annualCurrent.toFixed(1) : '—'}
          sub={`Prom. I+II · ${filterYear}`}
          delta={annualDeltaPts != null ? `${annualDeltaPts > 0 ? '+' : ''}${annualDeltaPts} pts` : null}
          deltaPositive={annualDeltaPts != null ? annualDeltaPts >= 0 : undefined}
          color="#7c3aed"
          icon={EmojiEventsRoundedIcon}
          onClick={() => onNavigate('agregados', 'comparativo_general')}
          deltaLabel={prevYear ? `vs ${prevYear} acumulado` : undefined}
        />
      </Stack>

      {/* ── Panel comparativo profesional ── */}
      {prevYear && (() => {
        /* Datos acumulados anuales (ponderados por nº estudiantes) */
        const annualEstCurr = MOCK_BY_PERIOD[filterYear]
          ? (MOCK_BY_PERIOD[filterYear].I.estudiantes ?? 0) + (MOCK_BY_PERIOD[filterYear].II.estudiantes ?? 0)
          : null;
        const annualEstPrev = MOCK_BY_PERIOD[prevYear]
          ? (MOCK_BY_PERIOD[prevYear].I.estudiantes ?? 0) + (MOCK_BY_PERIOD[prevYear].II.estudiantes ?? 0)
          : null;
        const annualPctCurr = MOCK_BY_PERIOD[filterYear]
          ? parseFloat(((MOCK_BY_PERIOD[filterYear].I.percentil + MOCK_BY_PERIOD[filterYear].II.percentil) / 2).toFixed(1))
          : null;
        const annualPctPrev = MOCK_BY_PERIOD[prevYear]
          ? parseFloat(((MOCK_BY_PERIOD[prevYear].I.percentil + MOCK_BY_PERIOD[prevYear].II.percentil) / 2).toFixed(1))
          : null;

        const DeltaBadge = ({ current, prev, decimals = 1, prefix = '', suffix = '' }) => {
          if (current == null || prev == null) return <Typography sx={{ fontSize: 11.5, color: '#cbd5e1' }}>—</Typography>;
          const delta = parseFloat((current - prev).toFixed(decimals));
          const up = delta >= 0;
          return (
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.3, px: 0.9, py: 0.25, borderRadius: 1.5,
              bgcolor: up ? '#dcfce7' : '#fee2e2', border: `1px solid ${up ? '#bbf7d0' : '#fecaca'}` }}>
              {up
                ? <TrendingUpRoundedIcon sx={{ fontSize: 11, color: '#16a34a' }} />
                : <TrendingDownRoundedIcon sx={{ fontSize: 11, color: '#dc2626' }} />
              }
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: up ? '#16a34a' : '#dc2626' }}>
                {delta > 0 ? '+' : ''}{prefix}{decimals > 0 ? delta.toFixed(decimals) : delta}{suffix}
              </Typography>
            </Box>
          );
        };

        const Col = ({ label, value, soft }) => (
          <Box sx={{ textAlign: 'center', minWidth: 70 }}>
            <Typography sx={{ fontSize: 10, fontWeight: 600, color: '#94a3b8', mb: 0.3 }}>{label}</Typography>
            <Typography sx={{ fontSize: soft ? 13 : 14, fontWeight: soft ? 700 : 900, color: soft ? '#64748b' : '#0f172a', letterSpacing: '-0.02em' }}>
              {value ?? '—'}
            </Typography>
          </Box>
        );

        const rows = [
          {
            metric: 'Puntaje global promedio',
            prevVal: prevPeriodScore != null ? prevPeriodScore.toFixed(1) : null,
            currVal: mainScore != null ? mainScore.toFixed(1) : null,
            deltaEl: <DeltaBadge current={mainScore} prev={prevPeriodScore} suffix=" pts" />,
            annualPrev: annualPrev != null ? annualPrev.toFixed(1) : null,
            annualCurr: annualCurrent != null ? annualCurrent.toFixed(1) : null,
            annualDelta: <DeltaBadge current={annualCurrent} prev={annualPrev} suffix=" pts" />
          },
          {
            metric: 'Percentil nacional',
            prevVal: percentilPrev != null ? `P${percentilPrev}` : null,
            currVal: percentilCurrent != null ? `P${percentilCurrent}` : null,
            deltaEl: <DeltaBadge current={percentilCurrent} prev={percentilPrev} decimals={0} suffix=" pts" />,
            annualPrev: annualPctPrev != null ? `P${annualPctPrev}` : null,
            annualCurr: annualPctCurr != null ? `P${annualPctCurr}` : null,
            annualDelta: <DeltaBadge current={annualPctCurr} prev={annualPctPrev} suffix=" pts" />
          },
          {
            metric: 'Estudiantes evaluados',
            prevVal: estudiantesPrev?.toLocaleString() ?? null,
            currVal: estudiantesCurrent?.toLocaleString() ?? null,
            deltaEl: <DeltaBadge current={estudiantesCurrent} prev={estudiantesPrev} decimals={0} suffix="" />,
            annualPrev: annualEstPrev?.toLocaleString() ?? null,
            annualCurr: annualEstCurr?.toLocaleString() ?? null,
            annualDelta: <DeltaBadge current={annualEstCurr} prev={annualEstPrev} decimals={0} suffix="" />
          }
        ];

        return (
          <Paper elevation={0} sx={{ mb: 2, p: 0, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff', overflow: 'hidden' }}>
            {/* Header strip */}
            <Box sx={{ px: 2.5, py: 1.2, display: 'flex', alignItems: 'center', gap: 1,
              background: 'linear-gradient(90deg, #f8fafc 0%, #eff6ff 100%)', borderBottom: '1px solid #e2e8f0' }}>
              <CompareArrowsRoundedIcon sx={{ fontSize: 15, color: '#2563eb' }} />
              <Typography sx={{ fontWeight: 800, fontSize: 12, color: '#1e293b', letterSpacing: '0.01em' }}>
                Análisis Comparativo · {filterType}{filterProgram !== 'Todos' ? ` · ${filterProgram}` : ''}
              </Typography>
              <Box sx={{ ml: 'auto', display: 'flex', gap: 0.6 }}>
                <Chip size="small" icon={<CompareArrowsRoundedIcon sx={{ fontSize: '11px !important' }} />}
                  label={`Periodo ${filterPeriodo}: ${prevYear} → ${filterYear}`}
                  sx={{ fontSize: 10.5, fontWeight: 700, bgcolor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe', height: 22 }} />
                <Chip size="small" icon={<AutoGraphRoundedIcon sx={{ fontSize: '11px !important' }} />}
                  label={`Anual: ${prevYear} → ${filterYear}`}
                  sx={{ fontSize: 10.5, fontWeight: 700, bgcolor: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe', height: 22 }} />
              </Box>
            </Box>

            {/* Column headers */}
            <Box sx={{ display: 'grid', gridTemplateColumns: '1.8fr repeat(3,1fr) 0.5fr repeat(3,1fr)', gap: 0,
              px: 2.5, py: 0.8, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Typography sx={{ fontSize: 10, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Indicador
              </Typography>
              {[`${prevYear}-${filterPeriodo}`, `${filterYear}-${filterPeriodo}`, 'Δ Periodo', ''].map((h) => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>{h}</Typography>
              ))}
              {[prevYear, filterYear, 'Δ Anual'].map((h) => (
                <Typography key={h} sx={{ fontSize: 10, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center' }}>{h}</Typography>
              ))}
            </Box>

            {/* Data rows */}
            {rows.map((row, i) => (
              <Box key={row.metric} sx={{
                display: 'grid', gridTemplateColumns: '1.8fr repeat(3,1fr) 0.5fr repeat(3,1fr)',
                px: 2.5, py: 1, alignItems: 'center',
                bgcolor: i % 2 === 0 ? '#ffffff' : '#fafbfc',
                borderBottom: i < rows.length - 1 ? '1px solid #f1f5f9' : 'none'
              }}>
                <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>{row.metric}</Typography>
                <Col value={row.prevVal} soft />
                <Col value={row.currVal} />
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>{row.deltaEl}</Box>
                {/* Spacer divider */}
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                  <Box sx={{ width: 1, height: 32, bgcolor: '#e2e8f0' }} />
                </Box>
                <Col value={row.annualPrev} soft />
                <Col value={row.annualCurr} />
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>{row.annualDelta}</Box>
              </Box>
            ))}
          </Paper>
        );
      })()}

      {/* ── Fila 2: Tendencia + Competencias ── */}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' },
          mb: 1.5
        }}
      >
        {/* Tendencia histórica */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Tendencia Histórica</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>
                {filterProgram !== 'Todos' ? filterProgram : 'Institucional'} · {filterType} vs Referencia ICFES
              </Typography>
            </Box>
            <Chip
              size="small"
              label="Ver detalle →"
              onClick={() => onNavigate('individuales', 'saber_pro')}
              sx={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', bgcolor: '#eff6ff', color: '#2563eb', border: '1px solid #bfdbfe' }}
            />
          </Stack>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="year" tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis domain={['auto', 'auto']} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
              <ReferenceLine y={150} stroke="#e2e8f0" strokeDasharray="4 4" />
              <Line
                type="monotone"
                dataKey={typeKey}
                name={filterType}
                stroke={lineColor}
                strokeWidth={2.5}
                dot={{ r: 4, fill: lineColor, strokeWidth: 0 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="referencia"
                name="Referencia"
                stroke="#e2e8f0"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Paper>

        {/* Competencias genéricas */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Competencias Genéricas</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>Institución vs Referencia</Typography>
            </Box>
            <Chip
              size="small"
              label="Ver detalle →"
              onClick={() => onNavigate('agregados', 'competencias_genericas')}
              sx={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', bgcolor: '#ecfeff', color: '#0891b2', border: '1px solid #a5f3fc' }}
            />
          </Stack>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={competenciasData} layout="vertical" margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" domain={filterType === 'TyT' ? [60, 130] : [90, 165]} tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10.5, fill: '#475569', fontWeight: 600 }} axisLine={false} tickLine={false} width={105} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="inst" name="Institución" fill="#2563eb" radius={[0, 3, 3, 0]} barSize={9}>
                {competenciasData.map((entry) => (
                  <Cell key={entry.name} fill={entry.diff >= 0 ? '#2563eb' : '#ef4444'} />
                ))}
              </Bar>
              <Bar dataKey="reference" name="Referencia" fill="#e2e8f0" radius={[0, 3, 3, 0]} barSize={9} />
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      {/* ── Fila 3: Ranking programas + Distribución ── */}
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }
        }}
      >
        {/* Ranking programas */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.8 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Ranking por Programa</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>
                {filterType} · {filterYear}-{filterPeriodo} · ordenado por puntaje
              </Typography>
            </Box>
            <Chip
              size="small"
              label="Ver detalle →"
              onClick={() => onNavigate('agregados', 'comparativo_general')}
              sx={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', bgcolor: '#f0fdf4', color: '#059669', border: '1px solid #bbf7d0' }}
            />
          </Stack>

          <Stack spacing={0.8}>
            {programData.slice(0, 6).map((row, idx) => {
              const isPositive = row.tendencia.startsWith('+');
              const [rMin, rMax] = filterType === 'TyT' ? [60, 110] : [100, 150];
              const pct = Math.min(100, Math.max(5, ((row.promedio - rMin) / (rMax - rMin)) * 100));
              return (
                <Box key={row.programa}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.4 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar
                        sx={{
                          width: 22,
                          height: 22,
                          fontSize: 10,
                          fontWeight: 900,
                          bgcolor: idx < 3 ? '#2563eb' : '#e2e8f0',
                          color: idx < 3 ? '#fff' : '#64748b'
                        }}
                      >
                        {idx + 1}
                      </Avatar>
                      <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b' }}>{row.programa}</Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontSize: 12, color: isPositive ? '#16a34a' : '#dc2626', fontWeight: 700 }}>
                        {row.tendencia}
                      </Typography>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 900, color: '#0f172a', minWidth: 36, textAlign: 'right' }}>
                        {row.promedio}
                      </Typography>
                    </Stack>
                  </Stack>
                  <Box sx={{ height: 5, borderRadius: 99, bgcolor: '#f1f5f9', overflow: 'hidden' }}>
                    <Box
                      sx={{
                        height: '100%',
                        width: `${pct}%`,
                        borderRadius: 99,
                        bgcolor: idx < 3 ? '#2563eb' : '#94a3b8',
                        transition: 'width 0.6s ease'
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Stack>
        </Paper>

        {/* Distribución de puntajes */}
        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
            <Box>
              <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#0f172a' }}>Distribución de Puntajes</Typography>
              <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>Frecuencia por rango · {filterType}</Typography>
            </Box>
            <Chip
              size="small"
              label="Ver detalle →"
              onClick={() => onNavigate('individuales', 'saber_pro')}
              sx={{ fontSize: 11, fontWeight: 700, cursor: 'pointer', bgcolor: '#faf5ff', color: '#7c3aed', border: '1px solid #ddd6fe' }}
            />
          </Stack>
          <ResponsiveContainer width="100%" height={215}>
            <BarChart data={distribucionData} margin={{ top: 4, right: 8, left: -14, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="rango" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <Tooltip content={<CustomTooltip unit=" est." />} />
              <Bar dataKey="count" name="Estudiantes" radius={[4, 4, 0, 0]} maxBarSize={38}>
                {distribucionData.map((entry) => {
                  const typeCenter = filterType === 'TyT' ? ['81-90','91-100'] : ['121-130','131-140'];
                  return (
                    <Cell
                      key={entry.rango}
                      fill={typeCenter.includes(entry.rango) ? '#2563eb' : '#bfdbfe'}
                    />
                  );
                })}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   PLACEHOLDER VALOR AGREGADO
═══════════════════════════════════════════════════════════════════ */
function ValorAgregadoPlaceholder({ section }) {
  const LABELS = {
    va_individual:  { title: 'Valor Agregado Individual',          desc: 'Trayectoria individual Saber 11 → Saber Pro. Cruza variables de ingreso y salida para estimar el impacto formativo por estudiante.', color: '#7c3aed' },
    va_general:     { title: 'Valor Agregado Resultado General',   desc: 'Resumen consolidado de mejora institucional para la cohorte analizada. Indicadores de progreso agregado frente al punto de partida.', color: '#8b5cf6' },
    va_estadistica: { title: 'Valor Agregado Estadística General', desc: 'KPIs, tendencias, dispersión y resumen estadístico agregado.', color: '#a78bfa' },
    va_nbc:         { title: 'Valor Agregado por NBC',             desc: 'Análisis comparado por programa y Núcleo Básico del Conocimiento.', color: '#6d28d9' }
  };
  const cfg = LABELS[section] || {};
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Paper elevation={0} sx={{ borderRadius: 4, border: `1.5px solid ${cfg.color}22`, background: `linear-gradient(135deg, #ffffff 0%, ${cfg.color}06 100%)`, p: { xs: 2.5, md: 4 }, maxWidth: 860, mx: 'auto' }}>
        <Stack spacing={3}>
          <Box>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, px: 1.5, py: 0.5, borderRadius: 99, bgcolor: `${cfg.color}10`, border: `1px solid ${cfg.color}22`, mb: 2 }}>
              <AutoGraphRoundedIcon sx={{ fontSize: 14, color: cfg.color }} />
              <Typography sx={{ fontSize: 11, fontWeight: 800, color: cfg.color, letterSpacing: '0.07em', textTransform: 'uppercase' }}>Módulo en preparación</Typography>
            </Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 27 }, color: '#1e293b', letterSpacing: '-0.02em', lineHeight: 1.15 }}>{cfg.title}</Typography>
            <Typography sx={{ mt: 1.2, color: '#64748b', fontSize: 15.5, lineHeight: 1.65, maxWidth: 620 }}>{cfg.desc}</Typography>
          </Box>
          <Divider sx={{ borderColor: `${cfg.color}18` }} />
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' } }}>
            {[
              ['Carga de datos', 'Importación de archivos Saber 11 y Saber Pro del mismo cohorte.'],
              ['Cruce de variables', 'Vinculación de registros por identificación del estudiante.'],
              ['Cálculo de indicadores', 'Estimación estadística del aporte institucional al desempeño.'],
              ['Visualización y reportes', 'Gráficas comparativas y tabla de resultados por programa y NBC.']
            ].map(([t, d]) => (
              <Paper key={t} elevation={0} sx={{ p: 1.8, borderRadius: 2.5, border: `1px solid ${cfg.color}18`, bgcolor: `${cfg.color}05` }}>
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <StarRoundedIcon sx={{ fontSize: 17, color: cfg.color, mt: 0.15, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#1e293b' }}>{t}</Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.25, lineHeight: 1.4 }}>{d}</Typography>
                  </Box>
                </Stack>
              </Paper>
            ))}
          </Box>
          <Box sx={{ p: 1.8, borderRadius: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde68a', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#f59e0b', flexShrink: 0 }} />
            <Typography sx={{ fontSize: 12.5, color: '#92400e', fontWeight: 600, lineHeight: 1.5 }}>
              Interfaz preparada para activación una vez se carguen los datos de Saber 11 vinculados.
            </Typography>
          </Box>
        </Stack>
      </Paper>
    </Box>
  );
}

/* ═══════════════════════════════════════════════════════════════════
   LANDING PAGE PRINCIPAL
═══════════════════════════════════════════════════════════════════ */
function SaberProLandingPage({ onBack, allowedDashboards = [] }) {
  const { user } = useAuth();
  const [activeGroup,   setActiveGroup]   = useState(null);
  const [activeSection, setActiveSection] = useState(null);
  const [openMenu,      setOpenMenu]      = useState(null);
  const closeTimeout = useRef(null);
  const explicitSaberProPermissions = useMemo(
    () => {
      if (Array.isArray(allowedDashboards) && allowedDashboards.length > 0) return allowedDashboards;
      return Array.isArray(user?.allowedSaberProDashboards) ? user.allowedSaberProDashboards : [];
    },
    [allowedDashboards, user?.allowedSaberProDashboards]
  );
  const visibleNavConfig = useMemo(() => {
    if (explicitSaberProPermissions.length === 0) {
      return NAV_CONFIG;
    }
    const allowedSet = new Set(explicitSaberProPermissions);
    return NAV_CONFIG
      .map((group) => {
        const permissionMap = SABER_PRO_PERMISSION_BY_GROUP[group.key] || {};
        const items = group.items.filter((item) => allowedSet.has(permissionMap[item.key]));
        return items.length > 0 ? { ...group, items } : null;
      })
      .filter(Boolean);
  }, [explicitSaberProPermissions]);
  const visibleTargets = useMemo(
    () => visibleNavConfig.flatMap((group) => group.items.map((item) => ({ groupKey: group.key, itemKey: item.key }))),
    [visibleNavConfig]
  );
  const singleVisibleGroup = visibleNavConfig.length === 1 ? visibleNavConfig[0] : null;
  const singleVisibleTarget = visibleTargets.length === 1 ? visibleTargets[0] : null;

  const handleMenuEnter     = useCallback((key) => { if (closeTimeout.current) clearTimeout(closeTimeout.current); setOpenMenu(key); }, []);
  const handleMenuLeave     = useCallback(() => { closeTimeout.current = setTimeout(() => setOpenMenu(null), 180); }, []);
  const handleDropdownEnter = useCallback(() => { if (closeTimeout.current) clearTimeout(closeTimeout.current); }, []);
  const handleDropdownLeave = useCallback(() => { closeTimeout.current = setTimeout(() => setOpenMenu(null), 180); }, []);

  const handleItemClick = useCallback((groupKey, itemKey) => {
    const group = visibleNavConfig.find((item) => item.key === groupKey);
    if (!group || !group.items.some((item) => item.key === itemKey)) {
      return;
    }
    setActiveGroup(groupKey);
    setActiveSection(itemKey);
    setOpenMenu(null);
  }, [visibleNavConfig]);

  const handleBackToHub = useCallback(() => {
    if (singleVisibleTarget || singleVisibleGroup) return;
    setActiveSection(null);
    setActiveGroup(null);
  }, [singleVisibleGroup, singleVisibleTarget]);

  const activeVisibleGroupConfig = visibleNavConfig.find((n) => n.key === activeGroup);
  const activeItemConfig  = activeVisibleGroupConfig?.items.find((i) => i.key === activeSection);

  useEffect(() => {
    if (singleVisibleGroup && !singleVisibleTarget) {
      if (activeGroup !== singleVisibleGroup.key) setActiveGroup(singleVisibleGroup.key);
      if (!activeSection || !singleVisibleGroup.items.some((item) => item.key === activeSection)) {
        setActiveSection(singleVisibleGroup.items[0]?.key || null);
      }
      return;
    }
  }, [activeGroup, activeSection, singleVisibleGroup, singleVisibleTarget]);

  useEffect(() => {
    if (!singleVisibleTarget) return;
    if (activeGroup !== singleVisibleTarget.groupKey) setActiveGroup(singleVisibleTarget.groupKey);
    if (activeSection !== singleVisibleTarget.itemKey) setActiveSection(singleVisibleTarget.itemKey);
  }, [activeGroup, activeSection, singleVisibleTarget]);

  useEffect(() => {
    if (!activeSection) return;
    if (!activeVisibleGroupConfig) {
      setActiveGroup(null);
      setActiveSection(null);
      return;
    }
    if (!activeVisibleGroupConfig.items.some((item) => item.key === activeSection)) {
      setActiveSection(activeVisibleGroupConfig.items[0]?.key || null);
    }
  }, [activeSection, activeVisibleGroupConfig]);

  const renderContent = () => {
    if (!activeSection && !singleVisibleTarget && !singleVisibleGroup) {
      return <DashboardOverview onNavigate={handleItemClick} />;
    }
    if ((singleVisibleTarget || singleVisibleGroup) && !activeSection) {
      return null;
    }
    if (activeGroup === 'individuales')   return <SaberProDashboard initialSection={activeSection} allowedSections={(activeVisibleGroupConfig?.items || []).map((item) => item.key)} />;
    if (activeGroup === 'agregados')      return <SaberProAgregadosDashboard initialSection={activeSection} allowedSections={(activeVisibleGroupConfig?.items || []).map((item) => item.key)} />;
    if (activeGroup === 'valor_agregado') return <ValorAgregadoPlaceholder section={activeSection} />;
    if (activeGroup === 'consulta')       return <ConsultaValidacion initialSection={activeSection} allowedSections={(activeVisibleGroupConfig?.items || []).map((item) => item.key)} />;
    return null;
  };

  return (
    <Box sx={{ bgcolor: '#f1f5f9', minHeight: '100vh' }}>

      {/* ══════ NAVBAR CLARO ══════ */}
      {!singleVisibleTarget && !singleVisibleGroup && (
      <Box
        sx={{
          position: 'sticky', top: 0, zIndex: 100,
          bgcolor: '#ffffff',
          borderBottom: '1.5px solid #e2e8f0',
          boxShadow: '0 2px 10px rgba(15,23,42,0.06)'
        }}
      >
        {/* Brand strip */}
        <Stack direction="row" alignItems="center" sx={{ px: 2, height: 40, borderBottom: '1px solid #f1f5f9' }}>
          <Stack
            direction="row" spacing={1} alignItems="center"
            sx={{ cursor: 'pointer', '&:hover .brand-text': { color: '#2563eb' } }}
            onClick={handleBackToHub}
          >
            <Box sx={{ width: 24, height: 24, borderRadius: 1, background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', display: 'grid', placeItems: 'center', boxShadow: '0 2px 6px rgba(37,99,235,0.28)' }}>
              <AssessmentRoundedIcon sx={{ color: '#fff', fontSize: 13 }} />
            </Box>
            <Box>
              <Typography className="brand-text" sx={{ fontWeight: 900, fontSize: 12.5, color: '#1e293b', lineHeight: 1, transition: 'color 0.15s' }}>
                Saber Pro & TyT
              </Typography>
              <Typography sx={{ fontSize: 9, color: '#94a3b8', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', lineHeight: 1 }}>
                Analytics
              </Typography>
            </Box>
          </Stack>
          {activeSection && (
            <Button
              startIcon={<ArrowBackRoundedIcon sx={{ fontSize: '13px !important' }} />}
              onClick={handleBackToHub}
              size="small"
              sx={{ ml: 2, color: '#64748b', fontWeight: 700, fontSize: 11, textTransform: 'none', px: 1.2, borderRadius: 1.5, '&:hover': { bgcolor: '#f1f5f9', color: '#2563eb' } }}
            >
              Resumen
            </Button>
          )}
        </Stack>

        {/* Menús hover — full width, equal columns */}
        <Box sx={{ display: 'flex', overflow: 'visible', height: 44 }}>
          {visibleNavConfig.map((group, gi) => {
            const isOpen    = openMenu === group.key;
            const isActive  = activeGroup === group.key;
            const GroupIcon = group.icon;
            return (
              <Box
                key={group.key}
                sx={{ flex: 1, position: 'relative', borderLeft: gi > 0 ? '1px solid #e2e8f0' : 'none' }}
                onMouseEnter={() => handleMenuEnter(group.key)}
                onMouseLeave={handleMenuLeave}
              >
                <Stack
                  direction="row" spacing={0.7} alignItems="center" justifyContent="center"
                  sx={{
                    height: 44,
                    cursor: 'pointer',
                    color: isActive ? group.color : isOpen ? '#1e293b' : '#475569',
                    bgcolor: isOpen ? `${group.color}05` : isActive ? `${group.color}04` : 'transparent',
                    borderBottom: isActive ? `2.5px solid ${group.color}` : isOpen ? `2.5px solid ${group.color}66` : '2.5px solid transparent',
                    transition: 'color 0.15s, border-color 0.15s, background-color 0.15s',
                    userSelect: 'none',
                    '&:hover': { color: '#1e293b', bgcolor: '#f8fafc' }
                  }}
                >
                  <GroupIcon sx={{ fontSize: 14 }} />
                  <Typography sx={{ fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{group.label}</Typography>
                  <KeyboardArrowDownIcon sx={{ fontSize: 14, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.7 }} />
                </Stack>

                  {/* Dropdown */}
                  {isOpen && (
                    <Box
                      onMouseEnter={handleDropdownEnter}
                      onMouseLeave={handleDropdownLeave}
                      sx={{
                        position: 'absolute', top: '100%', left: 0, zIndex: 300,
                        minWidth: 310, bgcolor: '#ffffff',
                        borderRadius: '0 0 14px 14px',
                        boxShadow: '0 24px 56px rgba(15,23,42,0.14), 0 4px 16px rgba(15,23,42,0.07)',
                        border: `1.5px solid ${group.color}20`,
                        borderTop: `3px solid ${group.color}`,
                        overflow: 'hidden',
                        animation: 'spFadeDown 0.13s ease',
                        '@keyframes spFadeDown': {
                          from: { opacity: 0, transform: 'translateY(-5px)' },
                          to:   { opacity: 1, transform: 'translateY(0)' }
                        }
                      }}
                    >
                      <Box sx={{ px: 2, py: 1.1, background: `linear-gradient(90deg, ${group.color}0c 0%, transparent 100%)`, borderBottom: `1px solid ${group.color}14` }}>
                        <Stack direction="row" spacing={0.8} alignItems="center">
                          <GroupIcon sx={{ fontSize: 13, color: group.color }} />
                          <Typography sx={{ fontWeight: 800, fontSize: 10.5, color: group.color, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                            {group.label}
                          </Typography>
                        </Stack>
                      </Box>
                      {group.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isSel = activeSection === item.key && activeGroup === group.key;
                        return (
                          <Box
                            key={item.key}
                            onClick={() => handleItemClick(group.key, item.key)}
                            sx={{
                              px: 2, py: 1, cursor: 'pointer',
                              display: 'flex', alignItems: 'flex-start', gap: 1.4,
                              bgcolor: isSel ? `${group.color}08` : 'transparent',
                              borderLeft: isSel ? `3px solid ${group.color}` : '3px solid transparent',
                              transition: 'background 0.1s, border-color 0.1s',
                              '&:hover': { bgcolor: `${group.color}07`, borderLeft: `3px solid ${group.color}45` }
                            }}
                          >
                            <Box sx={{ width: 30, height: 30, borderRadius: 1.5, bgcolor: `${item.color}12`, display: 'grid', placeItems: 'center', flexShrink: 0, mt: 0.1 }}>
                              <ItemIcon sx={{ fontSize: 15, color: item.color }} />
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 700, fontSize: 12.5, color: isSel ? group.color : '#1e293b', lineHeight: 1.2 }}>{item.label}</Typography>
                              <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.2, lineHeight: 1.35 }}>{item.desc}</Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              );
            })}
          </Box>
      </Box>
      )}

      {/* ══════ BREADCRUMB ══════ */}
      {!singleVisibleTarget && !singleVisibleGroup && activeSection && activeItemConfig && (
        <Box sx={{ px: { xs: 2, md: 3 }, py: 0.9, bgcolor: '#ffffff', borderBottom: '1px solid #e8eef6', display: 'flex', alignItems: 'center', gap: 0.8 }}>
          <Typography onClick={handleBackToHub} sx={{ fontSize: 12, color: '#94a3b8', cursor: 'pointer', fontWeight: 600, '&:hover': { color: '#475569' } }}>
            Saber Pro & TyT
          </Typography>
          <ChevronRightIcon sx={{ fontSize: 13, color: '#cbd5e1' }} />
          <Typography sx={{ fontSize: 12, color: activeVisibleGroupConfig.color, fontWeight: 700 }}>{activeVisibleGroupConfig.label}</Typography>
          <ChevronRightIcon sx={{ fontSize: 13, color: '#cbd5e1' }} />
          <Typography sx={{ fontSize: 12, color: '#1e293b', fontWeight: 700 }}>{activeItemConfig.label}</Typography>
        </Box>
      )}

      {/* ══════ CONTENIDO ══════ */}
      {renderContent()}

    </Box>
  );
}

export default SaberProLandingPage;
