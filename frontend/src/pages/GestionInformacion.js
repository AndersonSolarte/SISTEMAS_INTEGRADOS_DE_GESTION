import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Fade,
  Chip,
  Checkbox,
  ListItemText,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Divider,
  LinearProgress,
  CircularProgress,
  IconButton,
  Alert,
  ToggleButton,
  ToggleButtonGroup,
  Collapse
} from '@mui/material';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Tooltip from '@mui/material/Tooltip';
import {
  Insights as InsightsIcon,
  UploadFile as UploadFileIcon,
  Download as DownloadIcon,
  DeleteSweep as DeleteSweepIcon,
  Folder as FolderIcon,
  ArrowForwardRounded as ArrowForwardRoundedIcon,
  ArrowBackRounded as ArrowBackRoundedIcon,
  Security as SecurityIcon,
  Diversity3 as Diversity3Icon,
  Groups as GroupsIcon,
  HomeWork as HomeWorkIcon,
  People as PeopleIcon,
  Male as MaleIcon,
  Female as FemaleIcon,
  Transgender as TransgenderIcon,
  Place as PlaceIcon,
  School as SchoolIcon,
  Public as PublicIcon,
  LocationCity as LocationCityIcon,
  TrendingUp as TrendingUpIcon,
  TrendingDown as TrendingDownIcon,
  AutoGraph as AutoGraphIcon,
  Refresh as RefreshIcon,
  Engineering as EngineeringIcon,
  School as SchoolGradIcon,
  MenuBook as MenuBookIcon,
  Science as ScienceIcon,
  AccountBalance as AccountBalanceIcon,
  BarChart as BarChartIcon,
  MonitorHeart as MonitorHeartIcon
} from '@mui/icons-material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import CloseIcon from '@mui/icons-material/Close';
import DownloadIconSmall from '@mui/icons-material/Download';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  Brush,
  Cell,
  LabelList,
  PieChart,
  Pie,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import { useSnackbar } from 'notistack';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import gestionInformacionService from '../services/gestionInformacionService';
import SaberProDashboard from '../components/saberPro/SaberProDashboard';
import SaberProAgregadosDashboard from '../components/saberPro/SaberProAgregadosDashboard';
import SaberProLandingPage from '../components/saberPro/SaberProLandingPage';
import RecursoHumanoDashboard from '../components/recursoHumano/RecursoHumanoDashboard';
import { ROLES } from '../constants/roles';
import { EstadisticaDocumentalPanel } from './EstadisticaDocumentalImpact';
import ActivityDashboard from './ActivityDashboard';

const BASES = [
  { key: 'poblacional', label: 'Poblacional', description: 'Históricos de inscritos, admitidos, matriculados y graduados.' },
  { key: 'georreferencia', label: 'Georreferencia', description: 'Catálogo oficial DIVIPOLA para departamentos y municipios.' },
  { key: 'biblioteca', label: 'Biblioteca', description: 'Indicadores de uso, colecciones y servicios bibliográficos.' },
  { key: 'medios_educativos', label: 'Medios Educativos', description: 'Seguimiento de recursos y apoyos para docencia.' },
  { key: 'internacionalizacion', label: 'Internacionalización', description: 'Movilidad, convenios y actividades de cooperación.' },
  { key: 'investigacion', label: 'Investigación', description: 'Producción investigativa, grupos y semilleros.' },
  { key: 'proyectos_convenios', label: 'Proyectos y Convenios', description: 'Gestión de iniciativas y acuerdos institucionales.' },
  { key: 'recurso_humano', label: 'Recurso Humano', description: 'Históricos de personal y trazabilidad por dependencia.' },
  { key: 'saber_pro', label: 'Saber Pro', description: 'Resultados históricos de pruebas y desempeño académico.' },
  { key: 'gestion_procesos', label: 'Gestión por Procesos', description: 'Monitoreo estadístico documental para operación por procesos.' },
  { key: 'plan_accion', label: 'Plan de Acción', description: 'Seguimiento anual del Plan de Acción institucional: metas, avances IP/IIP y ejecución total.' },
  { key: 'autoevaluacion', label: 'Autoevaluación', description: 'Estructura base de factores, características, aspectos, indicadores y evidencias.' }
];

const SUBBASES_POBLACIONAL = ['Inscritos', 'Admitidos', 'Primer Curso', 'Matriculados', 'Graduados', 'Cantidad Total Egresados', 'Caracterizacion', 'Desercion', 'Empleabilidad', 'Contexto Externo'];
const GEOREFERENCIA_CANONICAL_SUBBASE = 'DIVIPOLA Departamento';
const SUBBASES_GEOREFERENCIA = [GEOREFERENCIA_CANONICAL_SUBBASE];
const CONTEXTO_EXTERNO_LISTAS = [
  'PROGRAMAS CONTEXTO EXTERNO',
  'INSCRITOS CONTEXTO EXTERNO',
  'ADMITIDOS CONTEXTO EXTERNO',
  'PRIMER CURSO CONTEXTO EXTERNO',
  'MATRICULADOS CONTEXTO EXTERNO',
  'GRADUADOS CONTEXTO EXTERNO'
];
const SUBBASES_SABER_PRO = ['Resultados individuales', 'Resultados agregados', 'Resultados Saber 11'];
const SUBBASES_RECURSO_HUMANO = ['Docentes', 'Administrativos', 'Outsourcing', 'Ondas'];
const SUBBASES_AUTOEVALUACION = ['Autoevaluación', 'Participantes', 'informacion_programas'];
const SUBBASE_ORDER = SUBBASES_POBLACIONAL.reduce((acc, item, index) => ({ ...acc, [item]: index + 1 }), {});

const BASE_LABEL = BASES.reduce((acc, item) => ({ ...acc, [item.key]: item.label }), {});

const normalizeModulePermissionList = (raw) => {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') {
          return item.module_key || item.moduleKey || item.key || item.base_key || item.baseKey || '';
        }
        return '';
      })
      .filter(Boolean);
  }

  if (typeof raw === 'string') return [raw];

  if (typeof raw === 'object') {
    return Object.entries(raw)
      .filter(([, value]) => {
        if (value === true) return true;
        if (value && typeof value === 'object') return value.can_view !== false && value.enabled !== false;
        return false;
      })
      .map(([key]) => key);
  }

  return [];
};

const getVisibleBaseKeysForUser = (user) => {
  const explicitPermissions = [
    user?.modulePermissions,
    user?.modules,
    user?.allowedModules,
    user?.permisosModulos,
    user?.permissions?.modules
  ]
    .flatMap((entry) => normalizeModulePermissionList(entry))
    .map((key) => String(key).trim());

  const validKeys = new Set(BASES.map((b) => b.key));
  const explicitValid = Array.from(new Set(explicitPermissions.filter((key) => validKeys.has(key))));
  if (explicitValid.length > 0) return explicitValid;

  if ([ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA].includes(user?.role)) {
    return BASES.map((b) => b.key);
  }

  const specializedBaseKeys = [];
  const explicitPoblacional = normalizeModulePermissionList(user?.allowedPoblacionalDashboards);
  const explicitGestionProcesos = normalizeModulePermissionList(user?.allowedGestionProcesosDashboards);
  const explicitSaberPro = normalizeModulePermissionList(user?.allowedSaberProDashboards);

  if (explicitPoblacional.length > 0) specializedBaseKeys.push('poblacional');
  if (explicitGestionProcesos.length > 0) specializedBaseKeys.push('gestion_procesos');
  if (explicitSaberPro.length > 0) specializedBaseKeys.push('saber_pro');
  if (specializedBaseKeys.length > 0) return Array.from(new Set(specializedBaseKeys));

  if (explicitPermissions.includes('estadistica_institucional')) {
    return BASES.map((b) => b.key);
  }

  if (user?.role === ROLES.AUTOEVALUACION) {
    return ['autoevaluacion'];
  }

  if ([ROLES.PLANEACION_EFECTIVIDAD, ROLES.GESTION_INFORMACION].includes(user?.role)) {
    return ['poblacional', 'saber_pro'];
  }

  if (user?.role === ROLES.GESTION_PROCESOS) {
    return ['gestion_procesos'];
  }

  if (user?.role === ROLES.CONSULTA) {
    return ['poblacional'];
  }

  return [];
};

const getVisiblePoblacionalDashboardKeysForUser = (user) => {
  // Para administradores mostramos todas las tarjetas siempre, incluso si
  // existen permisos guardados antes de agregar nuevas tarjetas (compatibilidad).
  if (user?.role === ROLES.ADMINISTRADOR) {
    return POBLACIONAL_DASHBOARD_CARDS.map((item) => `poblacional_${item.key}`);
  }

  const explicit = [
    user?.allowedPoblacionalDashboards,
    user?.permissions?.poblacionalDashboards,
    user?.permisosPoblacional
  ]
    .flatMap((entry) => normalizeModulePermissionList(entry))
    .map((key) => String(key).trim());

  const valid = new Set(POBLACIONAL_DASHBOARD_CARDS.map((item) => `poblacional_${item.key}`));
  const explicitValid = Array.from(new Set(explicit.filter((key) => valid.has(key))));
  if (explicitValid.length > 0) return explicitValid;

  return POBLACIONAL_DASHBOARD_CARDS.map((item) => `poblacional_${item.key}`);
};

const REPORT_SECTIONS = [
  {
    key: 'flujo',
    title: 'Inscritos, Admitidos y Primer Curso',
    description: 'Comportamiento historico del embudo poblacional por periodo.',
    subcategorias: ['Inscritos', 'Admitidos', 'Primer Curso']
  },
  {
    key: 'matriculados',
    title: 'Matriculados',
    description: 'Serie historica de matriculados por periodo.',
    subcategorias: ['Matriculados']
  },
  {
    key: 'graduados',
    title: 'Graduados',
    description: 'Serie historica de graduados por periodo y tablero complementario de cantidad total de egresados.',
    subcategorias: ['Graduados']
  },
  {
    key: 'caracterizacion',
    title: 'Caracterizacion',
    description: 'Serie historica de registros de caracterizacion por periodo.',
    subcategorias: ['Caracterizacion']
  }
];

const POBLACIONAL_DASHBOARD_CARDS = [
  { key: 'flujo', title: 'Inscritos / Admitidos / Primer Curso', description: 'Embudo poblacional histórico por periodo.', color: '#2563eb', type: 'analytics' },
  { key: 'matriculados', title: 'Matriculados', description: 'Serie histórica y análisis por filtros.', color: '#4338ca', type: 'analytics' },
  { key: 'graduados', title: 'Graduados + Egresados Totales', description: 'Graduados con tarjetas complementarias de egresados.', color: '#0f766e', type: 'analytics' },
  { key: 'caracterizacion', title: 'Caracterización', description: 'Dashboard poblacional de caracterización y distribución.', color: '#d97706', type: 'analytics' },
  { key: 'resumen_estadistico', title: 'Cuadros Maestros', description: 'Tablas consolidadas de estudiantes por año y periodo académico.', color: '#0f766e', type: 'summary' },
  { key: 'desercion', title: 'Deserción', description: 'Tablero de deserción por periodo y cohorte (estructura base).', color: '#dc2626', type: 'placeholder' },
  { key: 'empleabilidad', title: 'Empleabilidad', description: 'Tablero de empleabilidad comparativo (estructura base).', color: '#0891b2', type: 'placeholder' },
  { key: 'contexto_externo', title: 'Contexto Externo', description: 'Oferta nacional/regional y series históricas externas para análisis comparativo.', color: '#0ea5a4', type: 'placeholder' },
  { key: 'saber_pro', title: 'Saber Pro (integrado)', description: 'Acceso interno desde Poblacional al dashboard de Saber Pro.', color: '#7c3aed', type: 'embedded_saber_pro' }
];

const CUADROS_MAESTROS_MODULES = [
  {
    key: 'informacion_general',
    label: 'Información General',
    shortLabel: 'General',
    description: 'Portada ejecutiva de los cuadros maestros y mapa de módulos del libro base.',
    sheets: ['General'],
    tone: '#0f766e'
  },
  {
    key: 'estudiantes',
    label: 'Estudiantes',
    shortLabel: 'Estudiantes',
    description: 'Cuadro maestro institucional de estudiantes por año y período académico.',
    sheets: ['Estudiantes'],
    tone: '#2563eb'
  },
  {
    key: 'profesores',
    label: 'Profesores',
    shortLabel: 'Profesores',
    description: 'Estructura consolidada para información detallada y resumen contractual/formativo de profesores.',
    sheets: ['Profesores Listado_Detallad ', 'Profesores- Resume Contra Form'],
    tone: '#7c3aed'
  },
  {
    key: 'movilidad',
    label: 'Movilidad',
    shortLabel: 'Movilidad',
    description: 'Integración base para movilidad de profesores y estudiantes.',
    sheets: ['Profesores Movilidad', 'Estudiante Movilidad '],
    tone: '#0891b2'
  },
  {
    key: 'investigacion',
    label: 'Investigación',
    shortLabel: 'Investigación',
    description: 'Estructura de investigación con grupos y profesores.',
    sheets: ['Investigacion - grupos y profe'],
    tone: '#d97706'
  },
  {
    key: 'bienestar',
    label: 'Bienestar',
    shortLabel: 'Bienestar',
    description: 'Cuadro maestro base para estadísticas de bienestar.',
    sheets: ['Estadísticas Bienestar'],
    tone: '#16a34a'
  },
  {
    key: 'proyeccion_social',
    label: 'Proyección social y extensión',
    shortLabel: 'Proyección social',
    description: 'Módulo base para proyección social o extensión.',
    sheets: ['Proyección social o extensi '],
    tone: '#dc2626'
  },
  {
    key: 'convenios',
    label: 'Convenios',
    shortLabel: 'Convenios',
    description: 'Consolidado base de convenios institucionales.',
    sheets: ['Convenios '],
    tone: '#1d4ed8'
  }
];

const POBLACIONAL_SUBBASE_TO_SECTION = {
  Inscritos: 'flujo',
  Admitidos: 'flujo',
  'Primer Curso': 'flujo',
  Matriculados: 'matriculados',
  Graduados: 'graduados',
  'Cantidad Total Egresados': 'graduados',
  Caracterizacion: 'caracterizacion',
  Desercion: 'desercion',
  Empleabilidad: 'empleabilidad',
  'Contexto Externo': 'contexto_externo'
};

const SABER_PRO_REPORT_SECTIONS = [
  {
    key: 'individuales_anio',
    title: 'Resultados individuales',
    description: 'Carga institucional y analisis de resultados individuales con libro unico en hojas SABER PRO y TYT.'
  },
  {
    key: 'agregados',
    title: 'Resultados agregados',
    description: 'Resumenes agregados institucionales por periodo, programa y competencias.'
  },
  {
    key: 'valor_agregado',
    title: 'Resultados Saber 11',
    description: 'Base histórica de ingreso para cruces posteriores con Saber Pro y cálculo de valor agregado.'
  }
];

const PERIOD_LABEL_TO_SORT = { IP: 1, I: 1, '1': 1, IIP: 2, II: 2, '2': 2 };
const initialStatsFilters = { programas: [], anios: [], periodos: [] };
const SUMMARY_ESTADISTICO_YEAR_WINDOW = 6;
const getMaxClosedAcademicYear = () => new Date().getFullYear() - 1;
const isValidPoblacionalAnalysisYear = (value) => {
  const year = Number(value);
  return Number.isFinite(year) && year >= 1900 && year <= getMaxClosedAcademicYear();
};
const STATS_FILTER_SECTION_KEYS = REPORT_SECTIONS.map((section) => section.key);
const buildInitialStatsFiltersBySection = () =>
  STATS_FILTER_SECTION_KEYS.reduce((acc, key) => {
    acc[key] = { ...initialStatsFilters };
    return acc;
  }, {});

const escapeHtml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const escapeXml = (value = '') =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');

const parsePeriodo = (row) => {
  const sources = [row?.observaciones, row?.unidad, row?.dependencia, row?.indicador]
    .map((value) => String(value || '').toUpperCase());

  for (const source of sources) {
    const explicitMatch = source.match(/(?:PERIODO|PER[Ii]ODO|P)\s*[:= -]?\s*(IP|IIP|II|I|1|2)\b/);
    if (explicitMatch?.[1]) {
      const token = explicitMatch[1].toUpperCase();
      return { token, sort: PERIOD_LABEL_TO_SORT[token] || 9 };
    }
    const compactMatch = source.match(/\b(\d{4})\s*[-_ ]\s*(1|2|IP|IIP|II|I)\b/);
    if (compactMatch?.[2]) {
      const token = compactMatch[2].toUpperCase();
      return { token, sort: PERIOD_LABEL_TO_SORT[token] || 9 };
    }
  }

  return { token: '1', sort: 1 };
};

const getSemesterSlotFromValue = (value = '') => {
  const token = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .trim();
  if (!token) return '1';
  if (
    /\b(IIP|II|SEMESTRE 2|SEM 2|PERIODO 2|P2|S2|BIMESTRE 2)\b/.test(token)
    || /(^|[^0-9])2($|[^0-9])/.test(String(value || ''))
    || /-\s*2\b/.test(String(value || ''))
  ) return '2';
  if (/\b(IP|I|SEMESTRE 1|SEM 1|PERIODO 1|P1|S1)\b/.test(token)) return '1';
  const parsed = parsePeriodo({
    observaciones: token,
    unidad: token,
    dependencia: token,
    indicador: token
  });
  return parsed.sort === 2 ? '2' : '1';
};

const getSemesterSlotFromGeoRow = (row = {}) => {
  const rawPeriod = String(row?.periodo || '').trim();
  if (rawPeriod) return getSemesterSlotFromValue(rawPeriod);
  const parsed = parsePeriodo(row);
  return parsed.sort === 2 ? '2' : '1';
};

const normalizeNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  let text = String(value).trim().replace(/\s+/g, '');
  if (!text) return 0;

  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) {
    text = text.replace(/\./g, '').replace(',', '.');
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    text = text.replace(/,/g, '');
  } else if (text.includes(',') && !text.includes('.')) {
    text = text.replace(',', '.');
  }

  const next = Number(text);
  return Number.isFinite(next) ? next : 0;
};

const normalizeRawProgramKey = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();

const PROGRAM_ALIAS_RULES = [
  { pattern: /^ABOGADO \(A\)$/, canonical: 'DERECHO', label: 'DERECHO' },
  { pattern: /^ARQUITECTO \(A\)$/, canonical: 'ARQUITECTURA', label: 'ARQUITECTURA' },
  { pattern: /^ADMINISTRADOR \(A\) DE EMPRESAS$/, canonical: 'ADMINISTRACION DE EMPRESAS', label: 'ADMINISTRACIÁ“N DE EMPRESAS' },
  { pattern: /^CONTADOR \(A\) PUBLICO \(A\)$/, canonical: 'CONTADURIA PUBLICA', label: 'CONTADURÁA PÁšBLICA' },
  { pattern: /^DISENADOR \(A\) GRAFICO \(A\)$/, canonical: 'DISENO GRAFICO', label: 'DISEÁ‘O GRÁFICO' },
  { pattern: /^INGENIERO \(A\) DE SISTEMAS$/, canonical: 'INGENIERIA DE SISTEMAS', label: 'INGENIERÁA DE SISTEMAS' },
  { pattern: /^INGENIERO \(A\) ELECTRONICO \(A\)$/, canonical: 'INGENIERIA ELECTRONICA', label: 'INGENIERÁA ELECTRÁ“NICA' },
  { pattern: /^PSICOLOGO \(A\)$/, canonical: 'PSICOLOGIA', label: 'PSICOLOGÁA' },
  { pattern: /^TECNOLOGO \(A\) EN CONTABILIDAD Y FINANZAS$/, canonical: 'TECNOLOGIA EN CONTABILIDAD Y FINANZAS', label: 'TECNOLOGÁA EN CONTABILIDAD Y FINANZAS' },
  { pattern: /^TECNOLOGO \(A\) EN GESTION FINANCIERA$/, canonical: 'TECNOLOGIA EN GESTION FINANCIERA', label: 'TECNOLOGÁA EN GESTIÁ“N FINANCIERA' },
  { pattern: /^LIC\. EN EDUCACION FISICA$/, canonical: 'LICENCIATURA EN EDUCACION FISICA', label: 'LICENCIATURA EN EDUCACIÁ“N FÁSICA' },
  { pattern: /^LIC\. EN EDUCACION INFANTIL$/, canonical: 'LICENCIATURA EN EDUCACION INFANTIL', label: 'LICENCIATURA EN EDUCACIÁ“N INFANTIL' },
  { pattern: /^LIC\. EN QUIMICA$/, canonical: 'LICENCIATURA EN QUIMICA', label: 'LICENCIATURA EN QUÁMICA' },
  { pattern: /^ESP\.? EN ARQUITECTURA Y URBANISMO BIOCLIMATICO$/, canonical: 'ESPECIALIZACION EN ARQUITECTURA Y URBANISMO BIOCLIMATICO', label: 'ESPECIALIZACIÁ“N EN ARQUITECTURA Y URBANISMO BIOCLIMÁTICO' },
  { pattern: /^ESP\.? EN DERECHO EMPRESARIAL$/, canonical: 'ESPECIALIZACION EN DERECHO EMPRESARIAL', label: 'ESPECIALIZACIÁ“N EN DERECHO EMPRESARIAL' },
  { pattern: /^ESP\.? EN GERENCIA DE PROYECTOS$/, canonical: 'ESPECIALIZACION EN GERENCIA DE PROYECTOS', label: 'ESPECIALIZACIÁ“N EN GERENCIA DE PROYECTOS' },
  { pattern: /^ESP\.? EN INFANCIA, CULTURA Y DESARROLLO$/, canonical: 'ESPECIALIZACION EN INFANCIA, CULTURA Y DESARROLLO', label: 'ESPECIALIZACIÁ“N EN INFANCIA, CULTURA Y DESARROLLO' },
  { pattern: /^ESP\.? EN PEDAGOGIA DEL ENTRENAMIENTO DEPORTIVO$/, canonical: 'ESPECIALIZACION EN PEDAGOGIA DEL ENTRENAMIENTO DEPORTIVO', label: 'ESPECIALIZACIÁ“N EN PEDAGOGÁA DEL ENTRENAMIENTO DEPORTIVO' },
  { pattern: /^ESPECIALIZACION EN PEDAGOGIA DEL ENTRENAMIENTO$/, canonical: 'ESPECIALIZACION EN PEDAGOGIA DEL ENTRENAMIENTO DEPORTIVO', label: 'ESPECIALIZACIÁ“N EN PEDAGOGÁA DEL ENTRENAMIENTO DEPORTIVO' }
];

const getCanonicalProgramMeta = (value = '') => {
  let normalized = normalizeRawProgramKey(value)
    .replace(/\bLIC\.?\s+EN\b/g, 'LICENCIATURA EN')
    .replace(/\bESP\.?\s+EN\b/g, 'ESPECIALIZACION EN')
    .replace(/\bTECNOLOGO \(A\)\s+EN\b/g, 'TECNOLOGIA EN')
    .replace(/\bINGENIERO \(A\)\s+DE\b/g, 'INGENIERIA DE')
    .replace(/\bINGENIERO \(A\)\s+ELECTRONICO \(A\)\b/g, 'INGENIERIA ELECTRONICA')
    .replace(/\bPSICOLOGO \(A\)\b/g, 'PSICOLOGIA')
    .replace(/\bABOGADO \(A\)\b/g, 'DERECHO')
    .replace(/\bARQUITECTO \(A\)\b/g, 'ARQUITECTURA')
    .replace(/\bADMINISTRADOR \(A\) DE\b/g, 'ADMINISTRACION DE')
    .replace(/\bCONTADOR \(A\) PUBLICO \(A\)\b/g, 'CONTADURIA PUBLICA')
    .replace(/\bDISENADOR \(A\) GRAFICO \(A\)\b/g, 'DISENO GRAFICO')
    .replace(/\bTECNOLOGIA EN CONTADURIA Y FINANZAS\b/g, 'TECNOLOGIA EN CONTABILIDAD Y FINANZAS');
  if (!normalized) return { key: '', label: '' };
  const matchedRule = PROGRAM_ALIAS_RULES.find((rule) => rule.pattern.test(normalized));
  if (matchedRule) {
    return { key: matchedRule.canonical, label: matchedRule.label };
  }
  const prettyLabel = String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    || normalized;
  return { key: normalized, label: prettyLabel };
};

const normalizeProgramKey = (value = '') => getCanonicalProgramMeta(value).key;

const normalizeGeoNameKey = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizeUiUpper = (value = '') =>
  String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleUpperCase('es-CO');

const buildCanonicalLabelMap = (items = []) => {
  const map = new Map();
  items.forEach((value) => {
    const raw = String(value || '').replace(/\s+/g, ' ').trim();
    if (!raw) return;
    const key = normalizeRawProgramKey(raw);
    if (!key) return;
    const existing = map.get(key) || '';
    const candidate = normalizeUiUpper(raw);
    if (!existing || candidate.length >= existing.length) map.set(key, candidate);
  });
  return map;
};

const geometryToRings = (geometry) => {
  if (!geometry || !geometry.type || !Array.isArray(geometry.coordinates)) return [];
  if (geometry.type === 'Polygon') return geometry.coordinates.filter((ring) => Array.isArray(ring) && ring.length > 2);
  if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .flatMap((polygon) => (Array.isArray(polygon) ? polygon : []))
      .filter((ring) => Array.isArray(ring) && ring.length > 2);
  }
  return [];
};

const computeRingsBBox = (rings = []) => {
  const points = rings.flatMap((ring) => ring);
  if (!points.length) return { minLon: -81.8, maxLon: -66.8, minLat: -4.8, maxLat: 13.7 };
  const lons = points.map((pt) => Number(pt?.[0])).filter(Number.isFinite);
  const lats = points.map((pt) => Number(pt?.[1])).filter(Number.isFinite);
  if (!lons.length || !lats.length) return { minLon: -81.8, maxLon: -66.8, minLat: -4.8, maxLat: 13.7 };
  return {
    minLon: Math.min(...lons),
    maxLon: Math.max(...lons),
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats)
  };
};

const isPointInRing = (pointLon, pointLat, ring = []) => {
  if (!Array.isArray(ring) || ring.length < 3) return false;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = Number(ring[i]?.[0]);
    const yi = Number(ring[i]?.[1]);
    const xj = Number(ring[j]?.[0]);
    const yj = Number(ring[j]?.[1]);
    if (![xi, yi, xj, yj].every(Number.isFinite)) continue;
    const intersect = ((yi > pointLat) !== (yj > pointLat))
      && (pointLon < ((xj - xi) * (pointLat - yi)) / ((yj - yi) || 1e-12) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
};

const isPointInAnyRing = (pointLon, pointLat, rings = []) =>
  Array.isArray(rings) && rings.some((ring) => isPointInRing(pointLon, pointLat, ring));

const projectLonLatToSvg = ({ lon, lat, bbox, width = 1000, height = 700, padding = 18 }) => {
  const safe = {
    minLon: Number.isFinite(bbox?.minLon) ? bbox.minLon : (Number.isFinite(bbox?.lonMin) ? bbox.lonMin : -81.8),
    maxLon: Number.isFinite(bbox?.maxLon) ? bbox.maxLon : (Number.isFinite(bbox?.lonMax) ? bbox.lonMax : -66.8),
    minLat: Number.isFinite(bbox?.minLat) ? bbox.minLat : (Number.isFinite(bbox?.latMin) ? bbox.latMin : -4.8),
    maxLat: Number.isFinite(bbox?.maxLat) ? bbox.maxLat : (Number.isFinite(bbox?.latMax) ? bbox.latMax : 13.7)
  };
  const spanLon = Math.max(0.0001, safe.maxLon - safe.minLon);
  const spanLat = Math.max(0.0001, safe.maxLat - safe.minLat);
  const x = padding + (((lon - safe.minLon) / spanLon) * (width - (padding * 2)));
  const y = height - padding - (((lat - safe.minLat) / spanLat) * (height - (padding * 2)));
  return { x, y };
};

const buildSvgPathFromRings = (rings = [], bbox, width = 1000, height = 700, padding = 18) =>
  rings.map((ring) => {
    const commands = ring
      .map((pt, idx) => {
        const { x, y } = projectLonLatToSvg({
          lon: Number(pt?.[0]),
          lat: Number(pt?.[1]),
          bbox,
          width,
          height,
          padding
        });
        return `${idx === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(' ');
    return `${commands} Z`;
  }).join(' ');
const COLOMBIA_MAP_CANVAS_WIDTH = 980;
const COLOMBIA_MAP_CANVAS_HEIGHT = 980;
const COLOMBIA_MAP_CANVAS_PADDING = 18;
const DEPARTMENT_MAP_CANVAS_WIDTH = 980;
const DEPARTMENT_MAP_CANVAS_HEIGHT = 980;
const DEPARTMENT_MAP_CANVAS_PADDING = 20;

const arraysEqualStrict = (a = [], b = []) =>
  Array.isArray(a)
  && Array.isArray(b)
  && a.length === b.length
  && a.every((item, idx) => item === b[idx]);

const chunkArray = (items = [], size = 10) => {
  const safeSize = Math.max(1, Number(size) || 1);
  const chunks = [];
  for (let i = 0; i < items.length; i += safeSize) {
    chunks.push(items.slice(i, i + safeSize));
  }
  return chunks;
};

const hashString = (value = '') => {
  let h = 0;
  const text = String(value || '');
  for (let i = 0; i < text.length; i += 1) {
    h = ((h << 5) - h) + text.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

const rectsOverlap = (a, b, gap = 6) => !(
  (a.x + a.width + gap) <= b.x
  || (b.x + b.width + gap) <= a.x
  || (a.y + a.height + gap) <= b.y
  || (b.y + b.height + gap) <= a.y
);

const clampValue = (value, min, max) => Math.max(min, Math.min(max, value));

const buildGeoLabelLayout = ({
  items = [],
  width = 980,
  height = 980,
  padding = 12,
  labelGap = 8,
  maxLabels = 24,
  nameFormatter = (value) => String(value || '').trim(),
  valueFormatter = (value) => formatNumber(value),
  estimateWidth = null
} = {}) => {
  const placed = [];
  const visibleItems = [...items]
    .filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y) && normalizeNumber(item?.total || 0) > 0)
    .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0))
    .slice(0, maxLabels);

  visibleItems.forEach((item, index) => {
    const name = nameFormatter(item.name || '');
    const value = valueFormatter(item.total || 0);
    const boxWidth = clampValue(
      estimateWidth ? estimateWidth({ name, value, item }) : Math.max((name.length * 7.2) + 20, (value.length * 7) + 20, 88),
      88,
      180
    );
    const boxHeight = 40;
    const preferAbove = item.y > height * 0.24;
    let chosen = null;
    const candidateOffsets = [];
    const baseYOffset = preferAbove ? -58 : 18;
    for (let ring = 0; ring <= 10; ring += 1) {
      const ringRadius = ring * 18;
      const angles = ring === 0
        ? [preferAbove ? -90 : 90]
        : [-90, -60, -30, 0, 30, 60, 90, 120, 150, 180, -120, -150];
      angles.forEach((angleDeg) => {
        const angle = (angleDeg * Math.PI) / 180;
        candidateOffsets.push({
          xOffset: Math.cos(angle) * ringRadius,
          yOffset: baseYOffset + (Math.sin(angle) * ringRadius)
        });
      });
    }

    for (const offset of candidateOffsets) {
      const rawX = item.x - (boxWidth / 2) + offset.xOffset;
      const rawY = item.y + offset.yOffset;
      const candidate = {
        x: clampValue(rawX, padding, width - boxWidth - padding),
        y: clampValue(rawY, padding, height - boxHeight - padding),
        width: boxWidth,
        height: boxHeight,
        anchorX: item.x,
        anchorY: item.y,
        name,
        value,
        key: item.key || `${name}-${index}`,
        total: normalizeNumber(item.total || 0),
        percent: Number(item.percent || 0)
      };
      if (!placed.some((other) => rectsOverlap(candidate, other, labelGap))) {
        chosen = candidate;
        break;
      }
    }

    if (!chosen) {
      chosen = {
        x: clampValue(item.x - (boxWidth / 2), padding, width - boxWidth - padding),
        y: clampValue(item.y - 56, padding, height - boxHeight - padding),
        width: boxWidth,
        height: boxHeight,
        anchorX: item.x,
        anchorY: item.y,
        name,
        value,
        key: item.key || `${name}-${index}`,
        total: normalizeNumber(item.total || 0),
        percent: Number(item.percent || 0)
      };
    }

    placed.push(chosen);
  });

  return placed;
};

const buildGeoMarkerClusters = ({
  items = [],
  radius = 36,
  minItems = 2
} = {}) => {
  const safeItems = [...items]
    .filter((item) => Number.isFinite(item?.x) && Number.isFinite(item?.y) && normalizeNumber(item?.total || 0) > 0)
    .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0));

  const clusters = [];
  safeItems.forEach((item) => {
    const match = clusters.find((cluster) => {
      const dx = Number(item.x) - Number(cluster.x);
      const dy = Number(item.y) - Number(cluster.y);
      return Math.sqrt((dx * dx) + (dy * dy)) <= radius;
    });
    if (!match) {
      clusters.push({
        key: item.key || `${item.name}-${clusters.length}`,
        x: Number(item.x),
        y: Number(item.y),
        total: normalizeNumber(item.total || 0),
        percent: Number(item.percent || 0),
        items: [item]
      });
      return;
    }

    match.items.push(item);
    match.total += normalizeNumber(item.total || 0);
    match.percent += Number(item.percent || 0);
    const count = match.items.length;
    match.x = match.items.reduce((acc, entry) => acc + Number(entry.x || 0), 0) / count;
    match.y = match.items.reduce((acc, entry) => acc + Number(entry.y || 0), 0) / count;
  });

  return clusters.map((cluster, index) => {
    const lead = [...cluster.items].sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0))[0] || {};
    const isCluster = cluster.items.length >= minItems;
    const value = formatNumber(cluster.total);
    const width = clampValue(Math.max((String(lead.name || '').length * 7.1) + 28, (String(value).length * 8) + 26, isCluster ? 132 : 116), isCluster ? 132 : 116, isCluster ? 220 : 180);
    const height = isCluster ? 54 : 40;
    return {
      key: `cluster-${index}-${lead.key || lead.name || 'geo'}`,
      name: lead.name || `Cluster ${index + 1}`,
      x: cluster.x,
      y: cluster.y,
      total: cluster.total,
      percent: cluster.percent,
      value,
      width,
      height,
      muniKey: lead.muniKey || '',
      clusterCount: cluster.items.length,
      isCluster,
      items: cluster.items
    };
  });
};

const isPostgradoProgram = (programa = '') => {
  const normalized = getCanonicalProgramMeta(programa).key;
  return (
    normalized.startsWith('ESPECIALIZACION') ||
    normalized.startsWith('MAESTRIA')
  );
};

const hasAccents = (value = '') => /[ÁÉÁÁ“ÁšáéíóúÁ‘ñÁœÁ¼]/.test(String(value || ''));

const selectPreferredProgramLabel = (current = '', incoming = '') => {
  const currentCanonical = getCanonicalProgramMeta(current);
  const incomingCanonical = getCanonicalProgramMeta(incoming);
  const currentClean = String(currentCanonical.label || current || '').replace(/\s+/g, ' ').trim();
  const incomingClean = String(incomingCanonical.label || incoming || '').replace(/\s+/g, ' ').trim();
  if (!currentClean) return incomingClean;
  if (!incomingClean) return currentClean;
  if (hasAccents(incomingClean) && !hasAccents(currentClean)) return incomingClean;
  if (!hasAccents(incomingClean) && hasAccents(currentClean)) return currentClean;
  return incomingClean.length > currentClean.length ? incomingClean : currentClean;
};

const formatNumber = (value) => normalizeNumber(value).toLocaleString('es-CO');
const formatCompactNumber = (value) => {
  const normalized = normalizeNumber(value);
  if (Math.abs(normalized) >= 1000000) return `${(normalized / 1000000).toFixed(normalized % 1000000 === 0 ? 0 : 1)}M`;
  if (Math.abs(normalized) >= 1000) return `${(normalized / 1000).toFixed(normalized % 1000 === 0 ? 0 : 1)}K`;
  return `${normalized}`;
};
const shortenGeoLabel = (value = '') => String(value || '')
  .replace(/^DEPARTAMENTO\s+DE\s+/i, '')
  .replace(/^DISTRITO\s+DE\s+/i, '')
  .replace(/\s+/g, ' ')
  .trim();

const COUNTRY_FLAG_ALIASES = {
  COLOMBIA: 'CO',
  ECUADOR: 'EC',
  VENEZUELA: 'VE',
  VENEZUELA_REPUBLICA_BOLIVARIANA_DE: 'VE',
  'VENEZUELA (REPUBLICA BOLIVARIANA DE)': 'VE',
  'VENEZUELA (REPÚBLICA BOLIVARIANA DE)': 'VE',
  'VENEZUELA REPUBLICA BOLIVARIANA DE': 'VE',
  MÉXICO: 'MX',
  MEXICO: 'MX',
  MEXICO_ESTADOS_UNIDOS_MEXICANOS: 'MX',
  ESPANA: 'ES',
  ESPANA_REINO_DE: 'ES',
  ESPAÑA: 'ES',
  PERU: 'PE',
  PERÚ: 'PE',
  ARGENTINA: 'AR',
  BRASIL: 'BR',
  BRAZIL: 'BR',
  CHILE: 'CL',
  BOLIVIA: 'BO',
  PANAMA: 'PA',
  PANAMÁ: 'PA',
  PARAGUAY: 'PY',
  URUGUAY: 'UY',
  ESTADOS_UNIDOS: 'US',
  'ESTADOS UNIDOS': 'US',
  'ESTADOS UNIDOS DE AMERICA': 'US',
  'ESTADOS UNIDOS DE AMÉRICA': 'US',
  ESTADOS_UNIDOS_DE_AMERICA: 'US',
  ESTADOS_UNIDOS_DE_AMERICA_EUA: 'US',
  USA: 'US',
  NORUEGA: 'NO',
  SUECIA: 'SE',
  DINAMARCA: 'DK',
  FINLANDIA: 'FI',
  ISLANDIA: 'IS',
  IRLANDA: 'IE',
  AUSTRIA: 'AT',
  BELGICA: 'BE',
  BÉLGICA: 'BE',
  SUIZA: 'CH',
  HOLANDA: 'NL',
  'PAISES BAJOS': 'NL',
  'PAÍSES BAJOS': 'NL',
  PAISES_BAJOS: 'NL',
  'REINO UNIDO': 'GB',
  REINO_UNIDO: 'GB',
  GRECIA: 'GR',
  CANADA: 'CA',
  CANADÁ: 'CA',
  FRANCIA: 'FR',
  ITALIA: 'IT',
  ALEMANIA: 'DE',
  PORTUGAL: 'PT',
  CUBA: 'CU',
  'COSTA RICA': 'CR',
  COSTA_RICA: 'CR',
  GUATEMALA: 'GT',
  HONDURAS: 'HN',
  'EL SALVADOR': 'SV',
  EL_SALVADOR: 'SV',
  NICARAGUA: 'NI',
  'REPUBLICA DOMINICANA': 'DO',
  'REPÚBLICA DOMINICANA': 'DO',
  REPUBLICA_DOMINICANA: 'DO',
  HAITI: 'HT',
  HAITÍ: 'HT',
  JAMAICA: 'JM',
  GUYANA: 'GY',
  'TRINIDAD Y TOBAGO': 'TT',
  TRINIDAD_Y_TOBAGO: 'TT',
  JAPON: 'JP',
  JAPÓN: 'JP',
  CHINA: 'CN',
  'COREA DEL SUR': 'KR',
  COREA_DEL_SUR: 'KR',
  AUSTRALIA: 'AU',
  'NUEVA ZELANDA': 'NZ',
  NUEVA_ZELANDA: 'NZ',
  RUSIA: 'RU',
  TURQUIA: 'TR',
  TURQUÍA: 'TR',
  ISRAEL: 'IL',
  INDIA: 'IN',
};

const getCountryFlagEmoji = (countryName = '') => {
  const normalized = normalizeGeoNameKey(countryName).replace(/\s+/g, '_');
  const isoCode = COUNTRY_FLAG_ALIASES[normalized] || COUNTRY_FLAG_ALIASES[String(countryName || '').trim().toUpperCase()] || '';
  if (!/^[A-Z]{2}$/.test(isoCode)) return '🌐';
  return String.fromCodePoint(...isoCode.split('').map((char) => 127397 + char.charCodeAt(0)));
};
const COUNTRY_ISO_CANDIDATES = [
  'AR', 'AT', 'AU', 'BE', 'BO', 'BR', 'CA', 'CH', 'CL', 'CN', 'CO', 'CR', 'CU', 'DE', 'DK', 'DO',
  'EC', 'ES', 'FI', 'FR', 'GB', 'GR', 'GT', 'GY', 'HN', 'HT', 'IE', 'IL', 'IN', 'IS', 'IT',
  'JM', 'JP', 'KR', 'MX', 'NI', 'NL', 'NO', 'NZ', 'PA', 'PE', 'PT', 'PY', 'RU', 'SE', 'SV',
  'TR', 'TT', 'US', 'UY', 'VE'
];

const COUNTRY_DISPLAY_NAME_TO_ISO = (() => {
  const map = new Map();
  ['es', 'en'].forEach((locale) => {
    try {
      const displayNames = new Intl.DisplayNames([locale], { type: 'region' });
      COUNTRY_ISO_CANDIDATES.forEach((isoCode) => {
        const label = displayNames.of(isoCode);
        const key = normalizeGeoNameKey(label || '').replace(/\s+/g, '_');
        if (key && !map.has(key)) map.set(key, isoCode);
      });
    } catch (_) {
      // noop
    }
  });
  return map;
})();

const getCountryIsoCode = (countryName = '') => {
  const normalized = normalizeGeoNameKey(countryName).replace(/\s+/g, '_');
  return (
    COUNTRY_FLAG_ALIASES[normalized]
    || COUNTRY_FLAG_ALIASES[String(countryName || '').trim().toUpperCase()]
    || COUNTRY_DISPLAY_NAME_TO_ISO.get(normalized)
    || ''
  );
};

const CountryFlagIcon = ({ countryName = '', alt = '', sx = {} }) => {
  const [hasError, setHasError] = useState(false);
  const isoCode = getCountryIsoCode(countryName);
  const flagUrl = isoCode ? `https://flagcdn.com/${String(isoCode).toLowerCase()}.svg` : '';
  const legacyFlag = typeof getCountryFlagEmoji === 'function' ? getCountryFlagEmoji(countryName) : '';

  if (!flagUrl || hasError) {
    return (
      <Box
        component="span"
        title={legacyFlag ? `${countryName} ${legacyFlag}` : `Sin bandera para ${countryName}`}
        sx={{
          width: 18,
          height: 13,
          borderRadius: 0.6,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          bgcolor: '#e2e8f0',
          border: '1px solid #cbd5e1',
          color: '#64748b',
          fontSize: 9,
          fontWeight: 800,
          flexShrink: 0,
          overflow: 'hidden',
          ...sx
        }}
      >
        ?
      </Box>
    );
  }

  return (
    <Box
      component="img"
      src={flagUrl}
      alt={alt || `Bandera de ${countryName}`}
      loading="lazy"
      onError={() => setHasError(true)}
      sx={{
        width: 18,
        height: 13,
        objectFit: 'cover',
        borderRadius: 0.6,
        border: '1px solid rgba(148,163,184,0.45)',
        boxShadow: '0 1px 2px rgba(15,23,42,0.08)',
        flexShrink: 0,
        display: 'block',
        ...sx
      }}
    />
  );
};
const classifyProgramLevel = (programa = '') => {
  const upper = String(programa).toUpperCase().trim();
  if (/^(DOC|DOCTOR|DOCTORADO)\b/.test(upper) || upper.includes('DOCTOR')) return 'DOCTORADO';
  if (/^MAE\b/.test(upper) || upper.startsWith('MAE ') || upper.startsWith('MAES')) return 'MAESTRIA';
  if (/^SP\b/.test(upper) || upper.startsWith('SP ') || upper.startsWith('ESPE')) return 'ESPECIALIZACION';
  if (/^TEC\b/.test(upper) || upper.startsWith('TEC ') || upper.startsWith('TECNO')) return 'TECNOLOGICO';
  return 'PROFESIONAL';
};
const FACULTY_ORDER = [
  'Arquitectura y Bellas Artes',
  'Ciencias Administrativas y Contables',
  'Ciencias Sociales y Humanas',
  'Educación',
  'Ingeniería',
  'Otras'
];
const classifyProgramFaculty = (programa = '') => {
  const u = String(programa).toUpperCase();
  if (u.includes('INGENIER') || u.includes('BIG DATA') || u.includes('SEGURIDAD INFORM') ||
      u.includes('ELECTRONI') || u.includes('SISTEMAS') || u.includes('FINANCIER') ||
      u.includes('INDUSTRIAL') || u.includes('MECATRON') || u.includes('CIVIL'))
    return 'Ingeniería';
  if (u.includes('ARQUITECTURA') || u.includes('DISEÑO') || u.includes('URBANISMO') ||
      u.includes('BELLAS ARTES') || u.includes('ARTES PLASTICAS') || u.includes('PLASTICAS'))
    return 'Arquitectura y Bellas Artes';
  if (u.includes('LICENCIATURA') || u.includes('PREESCOLAR') || u.includes('INFANCIA') ||
      u.includes('ENTRENAMIENTO') || u.includes('PEDAGOGIA') || u.includes('PEDAGOGÍA') ||
      u.includes('DEPORTIVO') || (u.includes('EDUCACI') && !u.includes('EDUCACION FISICA Y DEPORTE')))
    return 'Educación';
  if (u.includes('DERECHO') || u.includes('PSICOLOG') || u.includes('COMUNICACI') ||
      u.includes('TRABAJO SOCIAL') || u.includes('SOCIOLOG') || u.includes('FILOSOF'))
    return 'Ciencias Sociales y Humanas';
  if (u.includes('ADMINISTRACION') || u.includes('ADMINISTRACIÓN') || u.includes('CONTADURIA') ||
      u.includes('CONTADURÍA') || u.includes('GERENCIA') || u.includes('MARKETING') ||
      u.includes('NEGOCIOS') || u.includes('EMPRESARIAL') || u.includes('ECONOMIA') ||
      u.includes('ECONOMIA') || u.includes('FINANZAS') || u.includes('SALUD EN EL TRABAJO') ||
      u.includes('SEGURIDAD Y SALUD') || u.includes('AUDITORIA'))
    return 'Ciencias Administrativas y Contables';
  return 'Otras';
};
const formatSummaryRate = (value) => `${(normalizeNumber(value) * 100).toFixed(2)}%`;
const buildAcademicYearRows = (years = []) => {
  const visible = years.length ? years : [getMaxClosedAcademicYear()];
  return visible.flatMap((year) => ([
    { anio: year, periodo: 'I' },
    { anio: year, periodo: 'II' }
  ]));
};
const buildAnnualRows = (years = []) => {
  const visible = years.length ? years : [getMaxClosedAcademicYear()];
  return visible.map((year) => ({ anio: year }));
};
const toRomanPeriod = (value) => {
  const n = Number(value);
  if (n === 1) return 'I';
  if (n === 2) return 'II';
  return String(value || '');
};
const splitPeriodLabel = (label = '') => {
  const [year, part] = String(label).split('-');
  return { year: year || '-', part: toRomanPeriod(part) };
};

const getYearGroups = (series = []) => {
  const groups = [];
  let start = 0;
  while (start < series.length) {
    const year = splitPeriodLabel(series[start].periodLabel).year;
    let end = start;
    while (end + 1 < series.length && splitPeriodLabel(series[end + 1].periodLabel).year === year) {
      end += 1;
    }
    groups.push({ year, start, end });
    start = end + 1;
  }
  return groups;
};

const buildYAxisTicks = (maxValue, steps = 4) => {
  const safeMax = Math.max(0, Number(maxValue) || 0);
  const baseMax = safeMax > 0 ? safeMax : 1;
  return Array.from({ length: steps + 1 }, (_, index) => {
    const ratio = index / steps;
    const value = Math.round(baseMax * (1 - ratio));
    return { value, top: `${ratio * 100}%` };
  });
};

const getDeltaPct = (from, to) => {
  if (!Number.isFinite(from) || from === 0) return null;
  if (!Number.isFinite(to)) return null;
  return ((to - from) / from) * 100;
};

const summarizeFilters = (statsFilters) => ({
  programas: statsFilters.programas.length || 'Todos',
  anios: statsFilters.anios.length || 'Todos',
  periodos: statsFilters.periodos.length || 'Todos'
});

const getAutoStatsFilters = ({ programasDisponibles = [], aniosDisponibles = [], periodosDisponibles = [] }) => {
  return {
    programas: [...programasDisponibles],
    anios: [...aniosDisponibles.map((x) => String(x))],
    periodos: [...periodosDisponibles.map((x) => x.label)]
  };
};

const applyStatsFiltersToRows = ({ rows = [], filters = initialStatsFilters, programasDisponibles = [], aniosDisponibles = [], periodosDisponibles = [] }) => {
  const allProgramasSelected = programasDisponibles.length > 0 && (filters?.programas || []).length === programasDisponibles.length;
  const allAniosSelected = aniosDisponibles.length > 0 && (filters?.anios || []).length === aniosDisponibles.length;
  const allPeriodosSelected = periodosDisponibles.length > 0 && (filters?.periodos || []).length === periodosDisponibles.length;
  const programasSet = new Set((filters?.programas || []).map((item) => normalizeProgramKey(item)));
  const aniosSet = new Set(filters?.anios || []);
  const periodosSet = new Set(filters?.periodos || []);

  return rows.filter((row) => {
    const { periodLabel } = getRowPeriodMeta(row);
    const programa = normalizeProgramKey(row.programa);
    const anio = String(Number(row.anio) || '');
    if (!allProgramasSelected && programasSet.size > 0 && !programasSet.has(programa)) return false;
    if (!allAniosSelected && aniosSet.size > 0 && !aniosSet.has(anio)) return false;
    if (!allPeriodosSelected && periodosSet.size > 0 && !periodosSet.has(periodLabel)) return false;
    return true;
  });
};

const formatObservationWindow = (series = []) => {
  if (!series.length) return 'sin datos';
  const first = series[0]?.periodLabel || '';
  const last = series[series.length - 1]?.periodLabel || '';
  const firstYear = String(first).split('-')[0] || '';
  const lastYear = String(last).split('-')[0] || '';
  if (firstYear && lastYear) return `${firstYear} a ${lastYear}`;
  return `${first} a ${last}`;
};

const formatAcademicPeriodLabel = (value = '') => {
  const text = String(value || '').trim();
  if (!text) return '-';
  const [year, slot] = text.split('-');
  if (!year) return text;
  if (slot === '1') return `${year}-I`;
  if (slot === '2') return `${year}-II`;
  return text;
};

const describeVariation = (values = []) => {
  if (values.length < 3) return 'comportamiento puntual con pocos periodos para inferencia';
  const max = Math.max(...values);
  const min = Math.min(...values);
  const avg = values.reduce((a, b) => a + b, 0) / values.length;
  if (avg <= 0) return 'sin volumen suficiente para evaluar variabilidad';
  const spread = ((max - min) / avg) * 100;
  if (spread >= 40) return 'variabilidad alta entre periodos';
  if (spread >= 20) return 'variabilidad moderada entre periodos';
  return 'comportamiento relativamente estable entre periodos';
};

const buildAutomaticChartAnalysis = ({ section, series, statsFilters }) => {
  if (!series?.length) {
    return 'No hay datos suficientes para generar analisis automatico con los filtros actuales.';
  }

  const latest = series[series.length - 1];
  const previous = series.length > 1 ? series[series.length - 2] : null;
  const filterSummary = summarizeFilters(statsFilters);
  const windowText = `${series.length} periodos analizados`;
  const latestPeriod = latest.periodLabel || '-';
  const observationWindow = formatObservationWindow(series);
  const selectedProgramLabel =
    statsFilters.programas.length === 1
      ? statsFilters.programas[0]
      : statsFilters.programas.length > 1
        ? `${statsFilters.programas.length} programas`
        : 'todos los programas';

  if (section.key === 'flujo') {
    const totals = series.map((row) => normalizeNumber(row.inscritos) + normalizeNumber(row.admitidos) + normalizeNumber(row.primerCurso));
    const variationText = describeVariation(totals);
    const periodStart = formatAcademicPeriodLabel(series[0]?.periodLabel || '-');
    const periodEnd = formatAcademicPeriodLabel(latestPeriod);

    const peakInscritosRow = series.reduce((best, row) => (normalizeNumber(row.inscritos) > normalizeNumber(best?.inscritos) ? row : best), series[0]);
    const peakAdmitidosRow = series.reduce((best, row) => (normalizeNumber(row.admitidos) > normalizeNumber(best?.admitidos) ? row : best), series[0]);
    const peakPrimerCursoRow = series.reduce((best, row) => (normalizeNumber(row.primerCurso) > normalizeNumber(best?.primerCurso) ? row : best), series[0]);

    const getVariableRange = (key) => {
      const maxRow = series.reduce((best, row) => (normalizeNumber(row[key]) > normalizeNumber(best?.[key]) ? row : best), series[0]);
      const minRow = series.reduce((best, row) => (normalizeNumber(row[key]) < normalizeNumber(best?.[key]) ? row : best), series[0]);
      return {
        min: normalizeNumber(minRow?.[key]),
        max: normalizeNumber(maxRow?.[key]),
        minPeriod: minRow?.periodLabel || '-',
        maxPeriod: maxRow?.periodLabel || '-'
      };
    };

    const inscritosRange = getVariableRange('inscritos');
    const admitidosRange = getVariableRange('admitidos');
    const primerCursoRange = getVariableRange('primerCurso');
    const peakUnifiedPeriod = peakInscritosRow?.periodLabel === peakAdmitidosRow?.periodLabel
      && peakAdmitidosRow?.periodLabel === peakPrimerCursoRow?.periodLabel
      ? formatAcademicPeriodLabel(peakInscritosRow?.periodLabel)
      : null;

    const p2Institutional = peakUnifiedPeriod
      ? `En terminos generales, el volumen de inscritos se ubica en un rango aproximado entre ${formatNumber(inscritosRange.min)} y ${formatNumber(inscritosRange.max)} aspirantes por periodo academico, mientras que los admitidos registran valores entre ${formatNumber(admitidosRange.min)} y ${formatNumber(admitidosRange.max)} estudiantes, y los matriculados a primer curso alcanzan cifras entre ${formatNumber(primerCursoRange.min)} y ${formatNumber(primerCursoRange.max)} estudiantes por periodo. Dentro de la serie analizada se destaca el periodo ${peakUnifiedPeriod} como el momento de mayor volumen poblacional, evidenciando un punto de mayor demanda institucional y posicionamiento de la oferta academica de la Universidad.`
      : `En terminos generales, el volumen de inscritos se ubica en un rango aproximado entre ${formatNumber(inscritosRange.min)} y ${formatNumber(inscritosRange.max)} aspirantes por periodo academico, mientras que los admitidos registran valores entre ${formatNumber(admitidosRange.min)} y ${formatNumber(admitidosRange.max)} estudiantes, y los matriculados a primer curso alcanzan cifras entre ${formatNumber(primerCursoRange.min)} y ${formatNumber(primerCursoRange.max)} estudiantes por periodo. En la serie se identifican hitos de mayor volumen en ${formatAcademicPeriodLabel(peakInscritosRow?.periodLabel)} para inscritos, ${formatAcademicPeriodLabel(peakAdmitidosRow?.periodLabel)} para admitidos y ${formatAcademicPeriodLabel(peakPrimerCursoRow?.periodLabel)} para primer curso, consolidando momentos de alta demanda institucional.`;

    const p2Program = peakUnifiedPeriod
      ? `Durante los periodos analizados se observa una dinamica ${variationText} en la demanda del programa, con rangos aproximados entre ${formatNumber(inscritosRange.min)} y ${formatNumber(inscritosRange.max)} inscritos, ${formatNumber(admitidosRange.min)} y ${formatNumber(admitidosRange.max)} admitidos, y ${formatNumber(primerCursoRange.min)} y ${formatNumber(primerCursoRange.max)} estudiantes en primer curso. En este comportamiento se destaca el periodo ${peakUnifiedPeriod} como uno de los momentos de mayor volumen poblacional, lo cual refleja el interes de los aspirantes por la formacion profesional del programa.`
      : `Durante los periodos analizados se observa una dinamica ${variationText} en la demanda del programa, con rangos aproximados entre ${formatNumber(inscritosRange.min)} y ${formatNumber(inscritosRange.max)} inscritos, ${formatNumber(admitidosRange.min)} y ${formatNumber(admitidosRange.max)} admitidos, y ${formatNumber(primerCursoRange.min)} y ${formatNumber(primerCursoRange.max)} estudiantes en primer curso. Como hitos de mayor volumen, se identifican ${formatAcademicPeriodLabel(peakInscritosRow?.periodLabel)} en inscritos, ${formatAcademicPeriodLabel(peakAdmitidosRow?.periodLabel)} en admitidos y ${formatAcademicPeriodLabel(peakPrimerCursoRow?.periodLabel)} en primer curso, evidenciando momentos relevantes de demanda para el programa.`;

    if (statsFilters.programas.length === 1) {
      const paragraph1 = `El programa academico de ${selectedProgramLabel} de la Universidad CESMAG, analizado en la ventana de observacion comprendida entre los periodos academicos ${periodStart} y ${periodEnd}, permite identificar el comportamiento del proceso de ingreso estudiantil a partir de las variables inscritos, admitidos y estudiantes matriculados a primer curso, indicadores que reflejan la dinamica de acceso al programa y su posicionamiento dentro de la oferta academica institucional.`;
      const paragraph2 = p2Program;
      const paragraph3 = `En conjunto, el comportamiento observado en las variables analizadas permite evidenciar la dinamica de acceso al programa y la capacidad institucional para consolidar procesos de admision que se traducen en el ingreso efectivo de estudiantes al primer curso. Estos resultados constituyen un referente para comprender el comportamiento historico del ingreso estudiantil al programa y aportan elementos para el fortalecimiento de las estrategias institucionales orientadas a promover el acceso y la consolidacion de la matricula en el programa academico.`;
      return `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;
    }

    const paragraph1 = `El comportamiento del proceso de ingreso estudiantil de la Universidad CESMAG, analizado en la ventana de observacion comprendida entre los periodos academicos ${periodStart} y ${periodEnd}, permite identificar la dinamica institucional en las etapas de inscripcion, admision y consolidacion de estudiantes matriculados a primer curso, las cuales representan momentos centrales del acceso a la educacion superior en la Institucion. Durante los periodos analizados se evidencia una dinamica variable en la demanda institucional, asociada a las fluctuaciones propias del comportamiento del ingreso estudiantil en el contexto regional.`;
    const paragraph2 = p2Institutional;
    const paragraph3 = `En conjunto, el comportamiento observado en las variables analizadas permite evidenciar la dinamica institucional del ingreso estudiantil y la capacidad de la Universidad CESMAG para consolidar procesos de admision que se traducen en el ingreso efectivo de estudiantes al primer curso. Estos resultados constituyen un referente para la planeacion academica, la autoevaluacion y el fortalecimiento de estrategias orientadas a promover el acceso y la consolidacion de la matricula, en coherencia con el compromiso institucional de formacion integral y desarrollo regional.`;
    return `${paragraph1}\n\n${paragraph2}\n\n${paragraph3}`;
  }

  const accessor = section.key === 'matriculados'
    ? 'matriculados'
    : section.key === 'graduados'
      ? 'graduados'
      : 'caracterizacion';
  const label = section.key === 'matriculados'
    ? 'Matriculados'
    : section.key === 'graduados'
      ? 'Graduados'
      : 'Caracterizacion';
  const latestValue = normalizeNumber(latest[accessor]);
  const previousValue = previous ? normalizeNumber(previous[accessor]) : null;
  const delta = getDeltaPct(previousValue, latestValue);

  const maxRow = series.reduce((best, row) => (normalizeNumber(row[accessor]) > normalizeNumber(best?.[accessor]) ? row : best), series[0]);
  const minRow = series.reduce((best, row) => (normalizeNumber(row[accessor]) < normalizeNumber(best?.[accessor]) ? row : best), series[0]);

  if (section.key === 'graduados') {
    return [
      `Analisis automatico de graduados para ${selectedProgramLabel} en la ventana de observacion ${observationWindow} (${windowText}).`,
      `La serie representa estudiantes que culminan el proceso formativo y obtienen grado, por lo que su comportamiento permite evaluar resultados de salida y consolidacion academica del programa.`,
      `Ultimo periodo (${latestPeriod}): ${formatNumber(latestValue)} graduados.`,
      delta === null ? 'No hay periodo anterior comparable para variacion porcentual.' : `Variacion frente al periodo anterior: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%.`,
      `Rango observado: minimo ${formatNumber(normalizeNumber(minRow?.[accessor]))} en ${minRow?.periodLabel || '-'} y maximo ${formatNumber(normalizeNumber(maxRow?.[accessor]))} en ${maxRow?.periodLabel || '-'}.`,
      `Filtros activos: Programas=${filterSummary.programas}, Años=${filterSummary.anios}, Periodos=${filterSummary.periodos}.`
    ].join(' ');
  }

  return [
    `Analisis automatico de ${label.toLowerCase()} para ${selectedProgramLabel} en la ventana de observacion ${observationWindow} (${windowText}).`,
    `Ultimo periodo (${latestPeriod}): ${formatNumber(latestValue)} ${label.toLowerCase()}.`,
    delta === null ? 'No hay periodo anterior comparable para variacion porcentual.' : `Variacion frente al periodo anterior: ${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%.`,
    `Rango observado: minimo ${formatNumber(normalizeNumber(minRow?.[accessor]))} en ${minRow?.periodLabel || '-'} y maximo ${formatNumber(normalizeNumber(maxRow?.[accessor]))} en ${maxRow?.periodLabel || '-'}.`,
    `Filtros activos: Programas=${filterSummary.programas}, Años=${filterSummary.anios}, Periodos=${filterSummary.periodos}.`
  ].join(' ');
};

const getRowPeriodMeta = (row) => {
  const periodo = parsePeriodo(row);
  const anio = Number(row.anio) || 0;
  const periodOrder = anio * 10 + periodo.sort;
  const periodLabel = `${anio}-${periodo.sort}`;
  return { anio, periodOrder, periodLabel };
};

const buildSectionSeries = (rows, section) => {
  const bucket = new Map();
  rows
    .filter((row) => section.subcategorias.includes(row.subcategoria))
    .forEach((row) => {
      const { anio, periodOrder, periodLabel } = getRowPeriodMeta(row);
      if (!bucket.has(periodLabel)) {
        bucket.set(periodLabel, {
          periodLabel,
          periodOrder,
          anio,
          inscritos: 0,
          admitidos: 0,
          primerCurso: 0,
          matriculados: 0,
          graduados: 0,
          caracterizacion: 0
        });
      }
      const target = bucket.get(periodLabel);
      const value = normalizeNumber(row.valor);
      if (row.subcategoria === 'Inscritos') target.inscritos += value;
      if (row.subcategoria === 'Admitidos') target.admitidos += value;
      if (row.subcategoria === 'Primer Curso') target.primerCurso += value;
      if (row.subcategoria === 'Matriculados') target.matriculados += value;
      if (row.subcategoria === 'Graduados') target.graduados += value;
      if (row.subcategoria === 'Caracterizacion') target.caracterizacion += value;
    });

  return Array.from(bucket.values()).sort((a, b) => a.periodOrder - b.periodOrder);
};

const buildCantidadTotalEgresadosDashboard = (rows = []) => {
  const byKey = (getter) => {
    const map = new Map();
    rows.forEach((row) => {
      const key = String(getter(row) || '').trim() || 'Sin informacion';
      map.set(key, (map.get(key) || 0) + normalizeNumber(row.valor));
    });
    return Array.from(map.entries())
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total);
  };

  const detalleFromRow = (row) => {
    const indicador = String(row?.indicador || '').trim();
    if (indicador && indicador !== 'Cantidad Total Egresados') return indicador;
    const match = String(row?.observaciones || '').match(/detalle:\s*([^|]+)/i);
    return String(match?.[1] || '').trim() || 'Sin detalle';
  };

  const total = rows.reduce((acc, row) => acc + normalizeNumber(row.valor), 0);
  const porDetalle = byKey(detalleFromRow);
  const porPrograma = byKey((row) => row.programa);
  const porAnio = byKey((row) => Number(row.anio) || 'Sin año')
    .map((item) => ({ ...item, anio: Number(item.label) || 0 }))
    .sort((a, b) => a.anio - b.anio);

  return {
    total,
    totalRegistros: rows.length,
    porDetalle,
    porPrograma,
    porAnio
  };
};

const parseObservacionesToMap = (text = '') =>
  String(text || '')
    .split('|')
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .reduce((acc, item) => {
      const idx = item.indexOf(':');
      if (idx <= 0) return acc;
      const key = item.slice(0, idx).trim().toLowerCase();
      const value = item.slice(idx + 1).trim();
      if (key) acc[key] = value;
      return acc;
    }, {});

const normalizeMetricKey = (value = '') => {
  const text = String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
  if (text.includes('programa')) return 'programa';
  if (text.includes('institucional')) return 'institucional';
  if (text.includes('nacional')) return 'nacional';
  if (text.includes('departamental')) return 'departamental';
  return text || 'otro';
};

const parseDesercionPeriodReference = (rawValue, fallbackAnio = null) => {
  const raw = String(rawValue ?? '').trim();
  const upper = raw.toUpperCase();
  const normalized = upper
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  const fallbackYear = Number(fallbackAnio) || 0;

  const withSlotFromMonth = (year, month, sourceType) => {
    const cleanYear = Number(year) || fallbackYear || 0;
    const cleanMonth = Number(month);
    if (!cleanYear || !Number.isFinite(cleanMonth) || cleanMonth < 1 || cleanMonth > 12) return null;
    return {
      year: cleanYear,
      month: cleanMonth,
      slot: cleanMonth >= 7 ? 2 : 1,
      sourceType
    };
  };

  const excelSerial = Number(raw);
  if (/^\d{5}(\.\d+)?$/.test(raw) && Number.isFinite(excelSerial)) {
    const base = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(base.getTime() + Math.round(excelSerial) * 86400000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    if (year >= 1900 && year <= 2100) {
      return {
        year,
        month,
        slot: month >= 7 ? 2 : 1,
        sourceType: 'excel_serial'
      };
    }
  }

  const compactDate = raw.match(/^((?:19|20)\d{2})(0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])?$/);
  if (compactDate) {
    const parsed = withSlotFromMonth(Number(compactDate[1]), Number(compactDate[2]), 'date_compact');
    if (parsed) return parsed;
  }

  const ddmmyyyy = raw.match(/^(\d{1,2})[/-](\d{1,2})[/-]((?:19|20)\d{2})$/);
  if (ddmmyyyy) {
    const parsed = withSlotFromMonth(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]), 'date_ddmmyyyy');
    if (parsed) return parsed;
  }

  const yyyymmdd = raw.match(/^((?:19|20)\d{2})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (yyyymmdd) {
    const parsed = withSlotFromMonth(Number(yyyymmdd[1]), Number(yyyymmdd[2]), 'date_yyyymmdd');
    if (parsed) return parsed;
  }

  const yyyymm = raw.match(/^((?:19|20)\d{2})[/-](\d{1,2})$/);
  if (yyyymm) {
    const parsed = withSlotFromMonth(Number(yyyymm[1]), Number(yyyymm[2]), 'date_yyyymm');
    if (parsed) return parsed;
  }

  const mmyyyy = raw.match(/^(\d{1,2})[/-]((?:19|20)\d{2})$/);
  if (mmyyyy) {
    const parsed = withSlotFromMonth(Number(mmyyyy[2]), Number(mmyyyy[1]), 'date_mmyyyy');
    if (parsed) return parsed;
  }

  const explicitYear = Number((normalized.match(/(19|20)\d{2}/) || [])[0]) || fallbackYear;
  const monthByNameMap = {
    ENE: 1, ENERO: 1,
    FEB: 2, FEBRERO: 2,
    MAR: 3, MARZO: 3,
    ABR: 4, ABRIL: 4,
    MAY: 5, MAYO: 5,
    JUN: 6, JUNIO: 6,
    JUL: 7, JULIO: 7,
    AGO: 8, AGOSTO: 8,
    SEP: 9, SEPT: 9, SEPTIEMBRE: 9,
    OCT: 10, OCTUBRE: 10,
    NOV: 11, NOVIEMBRE: 11,
    DIC: 12, DICIEMBRE: 12
  };
  const monthName = Object.keys(monthByNameMap).find((token) => new RegExp(`\\b${token}\\b`).test(normalized));
  if (monthName && explicitYear) {
    const parsed = withSlotFromMonth(explicitYear, monthByNameMap[monthName], 'month_name');
    if (parsed) return parsed;
  }

  const monthToken = normalized.match(/(?:^|[^\d])(1[0-2]|0?[1-9])(?:[^\d]|$)/);
  if (monthToken && explicitYear) {
    const parsed = withSlotFromMonth(explicitYear, Number(monthToken[1]), 'month_token');
    if (parsed) return parsed;
  }

  if (/\b(IIP|II)\b/.test(normalized) || /\bJULIO\b/.test(normalized) || /\/0?7\//.test(normalized) || /-0?7-/.test(normalized)) {
    return { year: explicitYear, month: 7, slot: 2, sourceType: 'explicit_sem2' };
  }
  if (/\b(IP|I)\b/.test(normalized) || /\bENERO\b/.test(normalized) || /\/0?1\//.test(normalized) || /-0?1-/.test(normalized)) {
    return { year: explicitYear, month: 1, slot: 1, sourceType: 'explicit_sem1' };
  }

  if (explicitYear) {
    return { year: explicitYear, month: null, slot: 1, sourceType: 'year_only' };
  }

  return { year: 0, month: null, slot: 1, sourceType: 'unknown' };
};

const formatDesercionPeriodDisplay = (rawValue, fallbackAnio = null) => {
  const meta = parseDesercionPeriodReference(rawValue, fallbackAnio);
  if (!meta.year) return String(rawValue || 'Sin periodo').trim() || 'Sin periodo';
  return `${meta.year}-${meta.slot === 2 ? 'II' : 'I'}`;
};

const parsePeriodoLabelToSort = (value = '') => {
  const text = String(value || '').trim().toUpperCase();
  const year = Number((text.match(/(19|20)\d{2}/) || [])[0]) || 0;
  const slot = /\b(II|2)\b/.test(text) ? 2 : 1;
  return year * 10 + slot;
};

function GestionInformacion() {
  const { enqueueSnackbar } = useSnackbar();
  const { user } = useAuth();
  const location = useLocation();
  const [menuView, setMenuView] = useState('estadistica');
  const [baseSeleccionada, setBaseSeleccionada] = useState('');
  const [subBaseSeleccionada, setSubBaseSeleccionada] = useState('');
  const [subSubBaseSeleccionada, setSubSubBaseSeleccionada] = useState('');
  const [estadisticas, setEstadisticas] = useState([]);
  const [resumen, setResumen] = useState({ topCategorias: [], totales: {} });
  const [loading, setLoading] = useState(false);
  const [exportingContextoRowId, setExportingContextoRowId] = useState(null);
  const [exportingErroresRowId, setExportingErroresRowId] = useState(null);
  const [exportingBaseRowId, setExportingBaseRowId] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [total, setTotal] = useState(0);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearCredentials, setClearCredentials] = useState({ identifier: '', password: '' });

  const [selectedCard, setSelectedCard] = useState(null);
  const [gestionProcesosPanel, setGestionProcesosPanel] = useState('hub');
  const [poblacionalPanel, setPoblacionalPanel] = useState('hub');
  const [statSection, setStatSection] = useState('flujo');
  const [saberProStatSection, setSaberProStatSection] = useState('hub');
  const [statsFiltersBySection, setStatsFiltersBySection] = useState(() => buildInitialStatsFiltersBySection());
  const [flujoTableLevelFilter, setFlujoTableLevelFilter] = useState('todos');
  const [flujoTableYearsFilter, setFlujoTableYearsFilter] = useState([]);
  const [flujoTableAcademicPeriodsFilter, setFlujoTableAcademicPeriodsFilter] = useState([]);
  const [flujoChartProgramsFilter, setFlujoChartProgramsFilter] = useState([]);
  const [flujoChartYearsFilter, setFlujoChartYearsFilter] = useState([]);
  const [seriesRows, setSeriesRows] = useState([]);
  const [seriesLoading, setSeriesLoading] = useState(false);
  const [, setLastSeriesSyncAt] = useState(null);
  const [caracterizacionPanel, setCaracterizacionPanel] = useState(null);
  const [caracterizacionPanelLoading, setCaracterizacionPanelLoading] = useState(false);
  const [caracterizacionUi, setCaracterizacionUi] = useState({ estrato: '', grupoEtnico: '' });
  const [egresadosDetalleActivo, setEgresadosDetalleActivo] = useState('');
  const [desercionUi, setDesercionUi] = useState({
    programa: '',
    tipo: 'Todos',
    periodos: [],
    corteCohorte: 'Todos',
    rankingLimit: 7
  });
  const [desercionZoom, setDesercionZoom] = useState({ open: false, chartKey: '' });
  const [contextoExternoUi, setContextoExternoUi] = useState({
    programaObjetivo: '',
    alcance: 'Todos',
    base: 'Todos',
    periodos: []
  });
  const [empleabilidadUi, setEmpleabilidadUi] = useState({ programa: '' });
  const [resumenEstadisticoUi, setResumenEstadisticoUi] = useState({ programa: '', module: 'informacion_general' });
  const [matriculadosPanelData, setMatriculadosPanelData] = useState(null);
  const [matriculadosPanelLoading, setMatriculadosPanelLoading] = useState(false);
  const [matriculadosRefreshToken, setMatriculadosRefreshToken] = useState(0);
  const [matriculadosGeoSelection, setMatriculadosGeoSelection] = useState('');
  const [matriculadosMunicipioSelection, setMatriculadosMunicipioSelection] = useState('');
  const [geoHoverCard, setGeoHoverCard] = useState(null);
  const [matChartHidden, setMatChartHidden] = useState({});
  const [intlExpandedCountry, setIntlExpandedCountry] = useState(null);
  const [intlExpandedProgram, setIntlExpandedProgram] = useState(null);
  const [matriculadosLocalFilters, setMatriculadosLocalFilters] = useState({ anios: [], programas: [], periodos: [] });
  const [matriculadosIncidencias, setMatriculadosIncidencias] = useState([]);
  const [matriculadosIncidenciasLoading, setMatriculadosIncidenciasLoading] = useState(false);
  const [matriculadosIncidenciasPage, setMatriculadosIncidenciasPage] = useState(0);
  const [matriculadosIncidenciasTotal, setMatriculadosIncidenciasTotal] = useState(0);
  const [matriculadosIncidenciasSearch, setMatriculadosIncidenciasSearch] = useState('');
  const [matriculadosIncidenciasEstado, setMatriculadosIncidenciasEstado] = useState('pendiente');
  const [geoFilters, setGeoFilters] = useState({ programas: [], anios: [], periodos: ['1', '2'] });
  const [geoAppliedFilters, setGeoAppliedFilters] = useState({ programas: [], anios: [], periodos: ['1', '2'] });
  const [nivelExpandedKey, setNivelExpandedKey] = useState(null);
  const [sexoExpandedKey, setSexoExpandedKey] = useState(null);
  const [geoTerritorialFilters, setGeoTerritorialFilters] = useState({ sexos: [], niveles: [] });
  const [geoTerritorialAppliedFilters, setGeoTerritorialAppliedFilters] = useState({ sexos: [], niveles: [] });
  const [deptCentroids, setDeptCentroids] = useState({});
  const [municipalityGeoIndex, setMunicipalityGeoIndex] = useState({});
  const [deptGeoFeatures, setDeptGeoFeatures] = useState([]);
  const [adm2GeoFeatures, setAdm2GeoFeatures] = useState([]);
  const [deptGeoFeaturesReady, setDeptGeoFeaturesReady] = useState(false);
  const [matriculadosBundleReady, setMatriculadosBundleReady] = useState(false);
  const geoFiltersInitializedRef = useRef(false);
  const geoTerritorialFiltersInitializedRef = useRef(false);
  const deptGeoLoadedRef = useRef(false);
  const adm2GeoLoadedRef = useRef(false);
  const matriculadosPanelReqRef = useRef(0);
  const municipalSectionRef = useRef(null);
  const GI_FILTER_LABEL_SX = { mb: 0.6, color: '#475569', fontWeight: 700, fontSize: 12.5 };
  const GI_FILTER_SELECT_SX = {
    width: '100%',
    height: 46,
    borderRadius: 1.6,
    bgcolor: '#ffffff',
    border: '1px solid #93c5fd',
    '& .MuiSelect-select': {
      minHeight: '46px !important',
      display: 'flex',
      alignItems: 'center',
      fontWeight: 700,
      fontSize: 13.5
    },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#93c5fd' },
    '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '#60a5fa' },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#2563eb' }
  };
  const GI_SEGMENTED_SX = {
    height: 46,
    width: '100%',
    '& .MuiToggleButton-root': {
      flex: 1,
      textTransform: 'uppercase',
      fontWeight: 800,
      fontSize: 13.5,
      borderColor: '#93c5fd',
      color: '#1d4ed8',
      bgcolor: '#eff6ff'
    },
    '& .Mui-selected': {
      color: '#fff !important',
      bgcolor: '#3b82f6 !important'
    }
  };
  const GI_PRIMARY_ACTION_BTN_SX = {
    height: 46,
    borderRadius: 1.6,
    px: 3,
    fontWeight: 800,
    textTransform: 'none',
    color: '#ffffff',
    background: 'linear-gradient(90deg,#3155dd 0%, #7c3aed 55%, #db2777 100%)',
    boxShadow: '0 12px 26px -18px rgba(49,85,221,.85)',
    '&:hover': {
      background: 'linear-gradient(90deg,#2643b8 0%, #6d28d9 55%, #be185d 100%)'
    }
  };
  const GI_OUTLINE_ACTION_BTN_SX = {
    height: 46,
    borderRadius: 1.6,
    fontWeight: 800,
    borderColor: '#93c5fd',
    bgcolor: '#eef4ff',
    color: '#1e3a8a',
    textTransform: 'none',
    letterSpacing: 0
  };
  const GI_DASHBOARD_AUTO_GRID_SX = {
    display: 'grid',
    gap: 1.6,
    width: '100%',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(350px, 100%), 1fr))'
  };
  const GI_MATRICULADOS_LAYOUT_GRID_SX = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(380px, 100%), 1fr))',
    gap: '20px',
    width: '100%'
  };
  const poblacionalChartRef = useRef(null);
  const autoFilterCatalogSignatureRef = useRef({});
  const statsFiltersModeRef = useRef({});
  const getSectionFilterMode = useCallback((sectionKey) => statsFiltersModeRef.current?.[sectionKey] || 'auto', []);
  const setSectionFilterMode = useCallback((sectionKey, mode) => {
    statsFiltersModeRef.current = {
      ...statsFiltersModeRef.current,
      [sectionKey]: mode
    };
  }, []);
  const activeStatsFilters = useMemo(
    () => statsFiltersBySection[statSection] || initialStatsFilters,
    [statsFiltersBySection, statSection]
  );
  const resetPoblacionalStatsFilters = useCallback(() => {
    setStatsFiltersBySection(buildInitialStatsFiltersBySection());
    statsFiltersModeRef.current = {};
    autoFilterCatalogSignatureRef.current = {};
  }, []);

  const handleMatriculadosFilterChange = useCallback((key, value, options = []) => {
    const list = typeof value === 'string' ? value.split(',') : value;
    setMatriculadosLocalFilters((prev) => {
      if (list.includes('__ALL__')) {
        const current = Array.isArray(prev[key]) ? prev[key] : [];
        const allSelected = options.length > 0 && current.length === options.length;
        const nextValue = allSelected ? [] : [...options];
        return { ...prev, [key]: nextValue };
      }
      const clean = list.filter((item) => item !== '__ALL__');
      return { ...prev, [key]: clean };
    });
  }, []);

  const handleMultiFilterChange = (key, value, options = []) => {
    const currentSection = statSection;
    setSectionFilterMode(currentSection, 'manual');
    const list = typeof value === 'string' ? value.split(',') : value;
    const allYearValues = aniosDisponibles.map((x) => String(x));
    const allPeriodLabels = periodosDisponibles.map((x) => x.label);
    const getYearFromPeriodLabel = (label) => String(label || '').split('-')[0];
    const getPeriodsForYears = (years = []) =>
      periodosDisponibles
        .filter((item) => years.includes(getYearFromPeriodLabel(item.label)))
        .map((item) => item.label);

    if (list.includes('__ALL__')) {
      setStatsFiltersBySection((prev) => {
        const currentFilters = prev[currentSection] || initialStatsFilters;
        const current = Array.isArray(currentFilters[key]) ? currentFilters[key] : [];
        const allSelected = options.length > 0 && current.length === options.length;
        const nextValue = allSelected ? [] : [...options];

        if (key === 'anios') {
          const nextPeriods = nextValue.length > 0 ? getPeriodsForYears(nextValue) : [];
          return {
            ...prev,
            [currentSection]: { ...currentFilters, anios: nextValue, periodos: nextPeriods }
          };
        }

        if (key === 'periodos') {
          const nextYears = nextValue.length > 0
            ? Array.from(new Set(nextValue.map(getYearFromPeriodLabel))).filter((y) => allYearValues.includes(y))
            : [];
          return {
            ...prev,
            [currentSection]: { ...currentFilters, periodos: nextValue, anios: nextYears }
          };
        }

        return {
          ...prev,
          [currentSection]: { ...currentFilters, [key]: nextValue }
        };
      });
      return;
    }
    const clean = list.filter((item) => item !== '__ALL__' && options.includes(item));
    setStatsFiltersBySection((prev) => {
      const currentFilters = prev[currentSection] || initialStatsFilters;
      if (key === 'anios') {
        const nextPeriods = clean.length > 0 ? getPeriodsForYears(clean) : allPeriodLabels;
        return {
          ...prev,
          [currentSection]: { ...currentFilters, anios: clean, periodos: nextPeriods }
        };
      }

      if (key === 'periodos') {
        const yearsFromPeriods = Array.from(new Set(clean.map(getYearFromPeriodLabel))).filter((y) => allYearValues.includes(y));
        const nextYears = clean.length > 0 ? yearsFromPeriods : allYearValues;
        return {
          ...prev,
          [currentSection]: { ...currentFilters, periodos: clean, anios: nextYears }
        };
      }

      return {
        ...prev,
        [currentSection]: { ...currentFilters, [key]: clean }
      };
    });
  };

  const handleFlujoTableYearsChange = useCallback((value, options = []) => {
    const list = typeof value === 'string' ? value.split(',') : value;
    if (list.includes('__ALL__')) {
      const allSelected = options.length > 0 && flujoTableYearsFilter.length === options.length;
      setFlujoTableYearsFilter(allSelected ? [] : [...options]);
      return;
    }
    const clean = list.filter((item) => item !== '__ALL__' && options.includes(item));
    setFlujoTableYearsFilter(clean);
  }, [flujoTableYearsFilter.length]);

  const handleFlujoTableAcademicPeriodsChange = useCallback((value, options = []) => {
    const list = typeof value === 'string' ? value.split(',') : value;
    if (list.includes('__ALL__')) {
      const allSelected = options.length > 0 && flujoTableAcademicPeriodsFilter.length === options.length;
      setFlujoTableAcademicPeriodsFilter(allSelected ? [] : [...options]);
      return;
    }
    const clean = list.filter((item) => item !== '__ALL__' && options.includes(item));
    setFlujoTableAcademicPeriodsFilter(clean);
  }, [flujoTableAcademicPeriodsFilter.length]);

  const explicitGiModules = useMemo(
    () => normalizeModulePermissionList(user?.allowedModules),
    [user?.allowedModules]
  );
  const isPlaneacionGpInfoContext = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return params.get('source') === 'planeacion_gpinfo';
  }, [location.search]);
  const isDirectDocumentalView = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return isPlaneacionGpInfoContext
      && params.get('tab') === 'estadistica'
      && params.get('module') === 'gestion_procesos'
      && params.get('panel') === 'estadistica_documental';
  }, [isPlaneacionGpInfoContext, location.search]);
  const isGestionProcesosStatsRoute = useMemo(() => {
    const params = new URLSearchParams(location.search || '');
    return params.get('tab') === 'estadistica' && params.get('module') === 'gestion_procesos';
  }, [location.search]);

  const canManageBases = useMemo(
    () => [ROLES.ADMINISTRADOR, ROLES.AUTOEVALUACION].includes(user?.role) || explicitGiModules.includes('gestion_bases_datos'),
    [user?.role, explicitGiModules]
  );
  const canManageBasesInView = canManageBases && !isPlaneacionGpInfoContext;
  const visibleBaseKeys = useMemo(() => {
    const keys = getVisibleBaseKeysForUser(user);
    if (user?.role === ROLES.PLANEACION_ESTRATEGICA && isPlaneacionGpInfoContext) {
      return keys.filter((key) => key !== 'gestion_procesos');
    }
    return keys;
  }, [isPlaneacionGpInfoContext, user]);
  const visiblePoblacionalDashboardKeys = useMemo(() => getVisiblePoblacionalDashboardKeysForUser(user), [user]);
  const visibleBases = useMemo(() => BASES.filter((base) => visibleBaseKeys.includes(base.key)), [visibleBaseKeys]);
  const visiblePoblacionalDashboardCards = useMemo(
    () => POBLACIONAL_DASHBOARD_CARDS.filter((card) => visiblePoblacionalDashboardKeys.includes(`poblacional_${card.key}`)),
    [visiblePoblacionalDashboardKeys]
  );
  const visibleGestionProcesosDashboards = useMemo(() => {
    if (user?.role === ROLES.ADMINISTRADOR) return ['estadistica_documental'];
    if (user?.role === ROLES.PLANEACION_ESTRATEGICA) return ['estadistica_documental'];
    const explicit = normalizeModulePermissionList(user?.allowedGestionProcesosDashboards);
    const legacy = normalizeModulePermissionList(user?.allowedModules).filter((x) => x === 'estadistica_documental');
    const merged = Array.from(new Set([...explicit, ...legacy]));
    if (merged.length > 0) return merged;
    if (user?.role === ROLES.GESTION_PROCESOS) return ['estadistica_documental'];
    return [];
  }, [user]);
  const visibleSaberProDashboards = useMemo(() => {
    if ([ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA].includes(user?.role)) {
      return [
        'saber_pro_consulta_individual',
        'saber_pro_validacion_masiva',
        'saber_pro_individuales_general',
        'saber_pro_individuales_saber_pro',
        'saber_pro_individuales_tyt',
        'saber_pro_individuales_destacados',
        'saber_pro_individuales_competencias',
        'saber_pro_individuales_becas',
        'saber_pro_agregados_general',
        'saber_pro_agregados_competencias_especificas',
        'saber_pro_agregados_competencias_genericas',
        'saber_pro_agregados_comparativo_general',
        'saber_pro_agregados_comparativo_especificas',
        'saber_pro_valor_agregado_individual',
        'saber_pro_valor_agregado_resultado_general',
        'saber_pro_valor_agregado_estadistica_general',
        'saber_pro_valor_agregado_nbc',
        'saber_pro_valor_agregado_programas',
        'saber_pro_valor_agregado_institucional'
      ];
    }
    return normalizeModulePermissionList(user?.allowedSaberProDashboards);
  }, [user]);

  const categoria = BASE_LABEL[baseSeleccionada];
  const subbasesByBase = {
    poblacional: SUBBASES_POBLACIONAL,
    georreferencia: SUBBASES_GEOREFERENCIA,
    saber_pro: SUBBASES_SABER_PRO,
    recurso_humano: SUBBASES_RECURSO_HUMANO,
    autoevaluacion: SUBBASES_AUTOEVALUACION
  };
  const availableSubbases = subbasesByBase[baseSeleccionada] || [];
  const aplicaSubbase = availableSubbases.length > 0;
  const subcategoria = aplicaSubbase ? subBaseSeleccionada : '';
  const backendCategoria = baseSeleccionada === 'georreferencia' ? 'Georreferencia' : baseSeleccionada;
  const requiresSubSubBase = baseSeleccionada === 'poblacional' && subcategoria === 'Contexto Externo';
  const isSelectionValid = Boolean(baseSeleccionada)
    && (!aplicaSubbase || Boolean(subBaseSeleccionada))
    && (!requiresSubSubBase || Boolean(subSubBaseSeleccionada));

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (canManageBases) {
        const [listRes, resumenRes] = await Promise.all([
          gestionInformacionService.getCargues({
            page: page + 1,
            limit: rowsPerPage
          }),
          gestionInformacionService.getResumen({})
        ]);
        setEstadisticas(listRes.data.cargues || []);
        setTotal(listRes.data.pagination.total || 0);
        setResumen(resumenRes.data || { topCategorias: [], totales: {} });
      } else {
        const resumenRes = await gestionInformacionService.getResumen({});
        setEstadisticas([]);
        setTotal(0);
        setResumen(resumenRes.data || { topCategorias: [], totales: {} });
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar datos', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [canManageBases, enqueueSnackbar, page, rowsPerPage]);

  const fetchSeriesRows = useCallback(async () => {
    setSeriesLoading(true);
    try {
      let requestedSubcategorias = ['Inscritos', 'Admitidos', 'Primer Curso'];
      if (poblacionalPanel === 'analytics') {
        const section = REPORT_SECTIONS.find((item) => item.key === statSection);
        requestedSubcategorias = section?.subcategorias?.length ? [...section.subcategorias] : requestedSubcategorias;
        if (statSection === 'graduados') {
          requestedSubcategorias.push('Cantidad Total Egresados');
        }
      } else if (poblacionalPanel === 'desercion') {
        requestedSubcategorias = ['Desercion'];
      } else if (poblacionalPanel === 'empleabilidad') {
        requestedSubcategorias = ['Empleabilidad'];
      } else if (poblacionalPanel === 'contexto_externo') {
        requestedSubcategorias = ['Contexto Externo'];
      } else if (poblacionalPanel === 'resumen_estadistico') {
        requestedSubcategorias = ['Inscritos', 'Admitidos', 'Primer Curso', 'Matriculados', 'Graduados', 'Desercion'];
      }

      const uniqueSubcategorias = Array.from(new Set(requestedSubcategorias));
      const response = await gestionInformacionService.getEstadisticas({
        categoria: 'Poblacional',
        aggregate: 'poblacional_series',
        subcategorias: uniqueSubcategorias.join(',')
      });
      setSeriesRows(response?.data?.estadisticas || []);
      setLastSeriesSyncAt(new Date());
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar estadisticas historicas', { variant: 'error' });
    } finally {
      setSeriesLoading(false);
    }
  }, [enqueueSnackbar, poblacionalPanel, statSection]);

  const fetchMatriculadosPanel = useCallback(async () => {
    if (menuView !== 'estadistica' || selectedCard !== 'poblacional' || poblacionalPanel !== 'analytics' || statSection !== 'matriculados') return;
    const requestId = Date.now() + Math.random();
    matriculadosPanelReqRef.current = requestId;
    setMatriculadosPanelLoading(true);
    try {
      const periodosSemestre = Array.from(new Set(
        (matriculadosLocalFilters.periodos || []).map((p) => String(p).split('-')[1]).filter(Boolean)
      ));
      const requestParams = {
        categoria: 'Poblacional',
        aggregate: 'matriculados_geo_dashboard',
        programas: matriculadosLocalFilters.programas || [],
        anios: matriculadosLocalFilters.anios || [],
        periodos: periodosSemestre.length > 0 ? periodosSemestre : ['1', '2'],
        sexos: [...(geoTerritorialAppliedFilters.sexos || [])],
        niveles: [...(geoTerritorialAppliedFilters.niveles || [])]
      };
      const response = await gestionInformacionService.getEstadisticas(requestParams);
      if (matriculadosPanelReqRef.current !== requestId) return;
      const payload = response?.data || null;
      setMatriculadosPanelData(payload);
      setMatriculadosGeoSelection((prev) => {
        if (!prev) return '';
        const exists = (payload?.geography?.departments || []).some((item) => item.name === prev);
        return exists ? prev : '';
      });
    } catch (error) {
      if (matriculadosPanelReqRef.current !== requestId) return;
      console.error('[MatriculadosPanel] Error al cargar:', error?.response?.status, error?.response?.data || error?.message);
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar panel de matriculados', { variant: 'error' });
    } finally {
      if (matriculadosPanelReqRef.current === requestId) {
        setMatriculadosPanelLoading(false);
      }
    }
  }, [
    enqueueSnackbar,
    matriculadosLocalFilters,
    geoTerritorialAppliedFilters.niveles,
    geoTerritorialAppliedFilters.sexos,
    menuView,
    poblacionalPanel,
    selectedCard,
    statSection
  ]);
  const requestMatriculadosRefresh = useCallback(() => {
    setMatriculadosRefreshToken((prev) => prev + 1);
  }, []);

  const fetchMatriculadosIncidencias = useCallback(async () => {
    if (menuView !== 'estadistica' || selectedCard !== 'poblacional' || poblacionalPanel !== 'analytics' || statSection !== 'matriculados') return;
    setMatriculadosIncidenciasLoading(true);
    try {
      const response = await gestionInformacionService.getMatriculadosIncidencias({
        page: matriculadosIncidenciasPage + 1,
        limit: 10,
        estado: matriculadosIncidenciasEstado,
        search: matriculadosIncidenciasSearch
      });
      const payload = response?.data || {};
      setMatriculadosIncidencias(payload.rows || []);
      setMatriculadosIncidenciasTotal(Number(payload?.pagination?.total || 0));
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al consultar incidencias de ubicacion', { variant: 'error' });
    } finally {
      setMatriculadosIncidenciasLoading(false);
    }
  }, [
    enqueueSnackbar,
    matriculadosIncidenciasEstado,
    matriculadosIncidenciasPage,
    matriculadosIncidenciasSearch,
    menuView,
    poblacionalPanel,
    selectedCard,
    statSection
  ]);

  const handleResolveMatriculadosIncidencia = useCallback(async (item, action) => {
    const accion = action === 'apply_suggested' ? 'aplicar la sugerencia' : 'marcar como ignorada';
    enqueueSnackbar(`La acción para ${accion} aún no está disponible en esta versión.`, { variant: 'info' });
    if (item?.id) {
      fetchMatriculadosIncidencias();
    }
  }, [enqueueSnackbar, fetchMatriculadosIncidencias]);

  useEffect(() => {
    const params = new URLSearchParams(location.search || '');
    const tab = params.get('tab');
    const module = params.get('module');
    const panel = params.get('panel');
    const base = params.get('base');
    const subbase = params.get('subbase');
    if (base && BASES.some((item) => item.key === base)) {
      setBaseSeleccionada(base);
      setSubBaseSeleccionada(subbase || '');
      setSubSubBaseSeleccionada('');
      setMenuView(canManageBasesInView ? 'gestion_bases' : 'estadistica');
      return;
    }
    if (tab === 'gestion_bases') {
      setMenuView(canManageBasesInView ? 'gestion_bases' : 'estadistica');
      return;
    }
    if (tab === 'estadistica') {
      setMenuView('estadistica');
      if (module === 'gestion_procesos') {
        setSelectedCard('gestion_procesos');
        setGestionProcesosPanel(panel === 'hub' ? 'hub' : 'estadistica_documental');
      } else {
        setSelectedCard(null);
      }
      return;
    }
    if (!canManageBasesInView) setMenuView('estadistica');
  }, [canManageBasesInView, location.search]);

  useEffect(() => {
    if (user?.role !== ROLES.GESTION_PROCESOS) return;
    if (menuView !== 'estadistica') return;
    if (selectedCard !== 'gestion_procesos') setSelectedCard('gestion_procesos');
    if (gestionProcesosPanel !== 'estadistica_documental') setGestionProcesosPanel('estadistica_documental');
  }, [user?.role, menuView, selectedCard, gestionProcesosPanel]);

  useEffect(() => {
    if (menuView !== 'estadistica') return;
    if (isGestionProcesosStatsRoute) return;
    if (!Array.isArray(visibleBaseKeys) || visibleBaseKeys.length === 0) {
      if (selectedCard) setSelectedCard(null);
      return;
    }
  }, [isGestionProcesosStatsRoute, menuView, visibleBaseKeys, selectedCard, resetPoblacionalStatsFilters]);

  useEffect(() => {
    if (isGestionProcesosStatsRoute) return;
    /* activity_monitor no pertenece a visibleBaseKeys pero es una tarjeta válida */
    if (selectedCard === 'activity_monitor') return;
    if (selectedCard && !visibleBaseKeys.includes(selectedCard)) {
      setSelectedCard(null);
    }
    if (baseSeleccionada && !visibleBaseKeys.includes(baseSeleccionada)) {
      setBaseSeleccionada('');
      setSubBaseSeleccionada('');
    }
  }, [isGestionProcesosStatsRoute, selectedCard, baseSeleccionada, visibleBaseKeys]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (menuView === 'estadistica' && selectedCard === 'poblacional') {
      fetchSeriesRows();
    }
  }, [fetchSeriesRows, menuView, selectedCard]);

  useEffect(() => {
    if (menuView !== 'estadistica' || selectedCard !== 'poblacional' || poblacionalPanel !== 'analytics' || statSection !== 'matriculados') return;
    let cancelled = false;
    const loadPanel = async () => {
      await Promise.allSettled([fetchMatriculadosPanel()]);
      if (cancelled) return;
    };
    const timer = setTimeout(loadPanel, 650);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [fetchMatriculadosPanel, matriculadosRefreshToken, menuView, selectedCard, poblacionalPanel, statSection]);

  useEffect(() => {
    if (menuView !== 'estadistica' || selectedCard !== 'poblacional' || poblacionalPanel !== 'analytics' || statSection !== 'matriculados') return;
    let cancelled = false;
    const loadIncidencias = async () => {
      await Promise.allSettled([fetchMatriculadosIncidencias()]);
      if (cancelled) return;
    };
    loadIncidencias();
    return () => { cancelled = true; };
  }, [
    fetchMatriculadosIncidencias,
    matriculadosRefreshToken,
    menuView,
    selectedCard,
    poblacionalPanel,
    statSection,
    matriculadosIncidenciasPage,
    matriculadosIncidenciasEstado,
    matriculadosIncidenciasSearch
  ]);

  useEffect(() => {
    if (statSection !== 'matriculados') setMatriculadosGeoSelection('');
  }, [statSection]);

  useEffect(() => {
    if (selectedCard !== 'poblacional') return;
    if (poblacionalPanel !== 'hub') return;
    if (visiblePoblacionalDashboardCards.length !== 1) return;
    const only = visiblePoblacionalDashboardCards[0];
    if (only.type === 'analytics') {
      setStatSection(only.key);
      setPoblacionalPanel('analytics');
      return;
    }
    setPoblacionalPanel(only.key);
  }, [selectedCard, poblacionalPanel, visiblePoblacionalDashboardCards]);

  useEffect(() => {
    if (menuView !== 'estadistica' || selectedCard !== 'poblacional' || statSection !== 'caracterizacion') return;
    let cancelled = false;
    const loadCaracterizacionPanel = async () => {
      setCaracterizacionPanelLoading(true);
      try {
        const caracterizacionCatalogRows = seriesRows.filter((row) =>
          row.subcategoria === 'Caracterizacion' && isValidPoblacionalAnalysisYear(row.anio)
        );
        const programasMap = new Map();
        caracterizacionCatalogRows.forEach((row) => {
          const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
          const key = normalizeProgramKey(rawProgram);
          if (!key) return;
          const existing = programasMap.get(key);
          programasMap.set(key, selectPreferredProgramLabel(existing, rawProgram));
        });
        const programasCatalog = Array.from(programasMap.values());
        const aniosCatalog = Array.from(new Set(caracterizacionCatalogRows.map((row) => Number(row.anio)).filter((year) => Number.isFinite(year) && year > 0)));
        const periodosCatalog = Array.from(new Set(
          caracterizacionCatalogRows.map((row) => getRowPeriodMeta(row).periodLabel).filter(Boolean)
        ));

        const allProgramasSelected = programasCatalog.length > 0 && activeStatsFilters.programas.length === programasCatalog.length;
        const allAniosSelected = aniosCatalog.length > 0 && activeStatsFilters.anios.length === aniosCatalog.length;
        const allPeriodosSelected = periodosCatalog.length > 0 && activeStatsFilters.periodos.length === periodosCatalog.length;
        const response = await gestionInformacionService.getEstadisticas({
          categoria: 'Poblacional',
          aggregate: 'caracterizacion_dashboard',
          programas: allProgramasSelected ? '' : activeStatsFilters.programas.join(','),
          anios: allAniosSelected ? '' : activeStatsFilters.anios.join(','),
          periodos: allPeriodosSelected ? '' : activeStatsFilters.periodos.join(',')
        });
        if (!cancelled) setCaracterizacionPanel(response?.data || null);
      } catch (error) {
        if (!cancelled) {
          setCaracterizacionPanel(null);
          enqueueSnackbar(error.response?.data?.message || 'Error al cargar dashboard de caracterizacion', { variant: 'error' });
        }
      } finally {
        if (!cancelled) setCaracterizacionPanelLoading(false);
      }
    };
    loadCaracterizacionPanel();
    return () => { cancelled = true; };
  }, [enqueueSnackbar, menuView, selectedCard, statSection, activeStatsFilters, seriesRows]);

  const countMap = useMemo(() => {
    const map = {};
    (resumen.topCategorias || []).forEach((x) => {
      map[x.categoria] = Number(x.total || 0);
    });
    return map;
  }, [resumen.topCategorias]);

  const activePoblacionalSection = useMemo(
    () => REPORT_SECTIONS.find((section) => section.key === statSection) || REPORT_SECTIONS[0],
    [statSection]
  );

  const sectionCatalogs = useMemo(() => {
    return REPORT_SECTIONS.reduce((acc, section) => {
      const sectionRows = seriesRows.filter((row) =>
        section.subcategorias.includes(row.subcategoria) && isValidPoblacionalAnalysisYear(row.anio)
      );
      const programLabelByKey = new Map();
      sectionRows.forEach((row) => {
        const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
        const key = normalizeProgramKey(rawProgram);
        if (!key) return;
        const existing = programLabelByKey.get(key);
        programLabelByKey.set(key, selectPreferredProgramLabel(existing, rawProgram));
      });
      const programas = Array.from(programLabelByKey.values()).sort((a, b) => a.localeCompare(b, 'es'));
      const anios = Array.from(new Set(sectionRows.map((row) => Number(row.anio)).filter((year) => Number.isFinite(year) && year > 0))).sort((a, b) => a - b);
      const periodMap = new Map();
      sectionRows.forEach((row) => {
        const { periodOrder, periodLabel } = getRowPeriodMeta(row);
        if (!periodMap.has(periodLabel)) periodMap.set(periodLabel, periodOrder);
      });
      const periodos = Array.from(periodMap.entries())
        .map(([label, order]) => ({ label, order }))
        .sort((a, b) => a.order - b.order);

      acc[section.key] = { rows: sectionRows, programas, anios, periodos };
      return acc;
    }, {});
  }, [seriesRows]);

  const activeSectionCatalog = sectionCatalogs[statSection] || { rows: [], programas: [], anios: [], periodos: [] };
  const programasDisponibles = activeSectionCatalog.programas;
  const aniosDisponibles = activeSectionCatalog.anios;
  const periodosDisponibles = activeSectionCatalog.periodos;

  const normalizeStatsFiltersWithCatalog = useCallback((filters, catalog) => {
    const safeCatalog = catalog || { programas: [], anios: [], periodos: [] };
    const programKeys = new Set(safeCatalog.programas.map((item) => normalizeProgramKey(item)));
    return {
      programas: (filters?.programas || []).filter((item) => programKeys.has(normalizeProgramKey(item))),
      anios: (filters?.anios || []).filter((item) => safeCatalog.anios.map((x) => String(x)).includes(item)),
      periodos: (filters?.periodos || []).filter((item) => safeCatalog.periodos.some((x) => x.label === item))
    };
  }, []);

  useEffect(() => {
    if (!seriesRows.length) return;
    const sectionKey = activePoblacionalSection?.key;
    const activeCatalog = sectionCatalogs[sectionKey] || { programas: [], anios: [], periodos: [] };
    const nextSignature = JSON.stringify({
      section: sectionKey,
      programas: activeCatalog.programas,
      anios: activeCatalog.anios,
      periodos: activeCatalog.periodos.map((x) => x.label)
    });
    if (autoFilterCatalogSignatureRef.current?.[sectionKey] === nextSignature) return;
    autoFilterCatalogSignatureRef.current = {
      ...autoFilterCatalogSignatureRef.current,
      [sectionKey]: nextSignature
    };
    setStatsFiltersBySection((prev) => {
      const currentSectionFilters = prev[sectionKey] || initialStatsFilters;
      if (getSectionFilterMode(sectionKey) === 'auto') {
        return {
          ...prev,
          [sectionKey]: getAutoStatsFilters({
            programasDisponibles: activeCatalog.programas,
            aniosDisponibles: activeCatalog.anios,
            periodosDisponibles: activeCatalog.periodos
          })
        };
      }
      return {
        ...prev,
        [sectionKey]: normalizeStatsFiltersWithCatalog(currentSectionFilters, activeCatalog)
      };
    });
  }, [seriesRows, sectionCatalogs, normalizeStatsFiltersWithCatalog, activePoblacionalSection, getSectionFilterMode]);

  const filteredSeriesRows = useMemo(() => {
    return applyStatsFiltersToRows({
      rows: activeSectionCatalog.rows,
      filters: activeStatsFilters,
      programasDisponibles,
      aniosDisponibles,
      periodosDisponibles
    });
  }, [activeSectionCatalog.rows, activeStatsFilters, programasDisponibles, aniosDisponibles, periodosDisponibles]);

  const sectionSeriesMap = useMemo(() => {
    return REPORT_SECTIONS.reduce((acc, section) => {
      const catalog = sectionCatalogs[section.key] || { programas: [], anios: [], periodos: [] };
      const sectionFilters = statsFiltersBySection[section.key] || initialStatsFilters;
      const sectionFilteredRows = applyStatsFiltersToRows({
        rows: catalog.rows || [],
        filters: sectionFilters,
        programasDisponibles: catalog.programas,
        aniosDisponibles: catalog.anios,
        periodosDisponibles: catalog.periodos
      });
      acc[section.key] = buildSectionSeries(sectionFilteredRows, section);
      return acc;
    }, {});
  }, [sectionCatalogs, statsFiltersBySection]);

  const activeSection = activePoblacionalSection;
  const activeSeries = useMemo(
    () => sectionSeriesMap[activeSection.key] || [],
    [sectionSeriesMap, activeSection.key]
  );
  const isSeriesInitialLoad = seriesLoading && seriesRows.length === 0;
  const isSeriesBackgroundRefresh = seriesLoading && seriesRows.length > 0;
  const cantidadTotalEgresadosRows = useMemo(
    () => filteredSeriesRows.filter((row) => row.subcategoria === 'Cantidad Total Egresados'),
    [filteredSeriesRows]
  );
  const cantidadTotalEgresadosDashboard = useMemo(
    () => buildCantidadTotalEgresadosDashboard(cantidadTotalEgresadosRows),
    [cantidadTotalEgresadosRows]
  );
  const desercionRows = useMemo(
    () => seriesRows.filter((row) => row.subcategoria === 'Desercion'),
    [seriesRows]
  );
  const empleabilidadRows = useMemo(
    () => seriesRows.filter((row) => row.subcategoria === 'Empleabilidad'),
    [seriesRows]
  );
  const contextoExternoRows = useMemo(
    () => seriesRows.filter((row) => row.subcategoria === 'Contexto Externo'),
    [seriesRows]
  );
  const automaticChartAnalysis = useMemo(
    () => buildAutomaticChartAnalysis({ section: activeSection, series: activeSeries, statsFilters: activeStatsFilters }),
    [activeSection, activeSeries, activeStatsFilters]
  );
  const matriculadosDepartments = useMemo(
    () => matriculadosPanelData?.geography?.departments || [],
    [matriculadosPanelData]
  );
  const matriculadosRowsBase = useMemo(
    () => seriesRows.filter((row) => String(row?.subcategoria || '').toLowerCase() === 'matriculados'),
    [seriesRows]
  );
  const geoProgramMapBase = useMemo(
    () => buildCanonicalLabelMap(matriculadosRowsBase.map((row) => row?.programa)),
    [matriculadosRowsBase]
  );
  const geoProgramOptions = useMemo(
    () => Array.from(geoProgramMapBase.values()).sort((a, b) => a.localeCompare(b, 'es')),
    [geoProgramMapBase]
  );
  const geoYearOptions = useMemo(
    () => Array.from(new Set(matriculadosRowsBase.map((row) => String(Number(row?.anio || 0))).filter((year) => Number(year) > 0)))
      .sort((a, b) => Number(a) - Number(b)),
    [matriculadosRowsBase]
  );
  const geoPeriodOptions = useMemo(
    () => [
      { value: '1', label: 'Semestre 1' },
      { value: '2', label: 'Semestre 2' }
    ],
    []
  );
  const geoRowsByYear = useMemo(() => {
    if (!geoFilters.anios?.length) return matriculadosRowsBase;
    const selectedYears = new Set(geoFilters.anios.map((item) => String(item)));
    return matriculadosRowsBase.filter((row) => selectedYears.has(String(Number(row?.anio || 0))));
  }, [geoFilters.anios, matriculadosRowsBase]);
  const geoPeriodOptionsFiltered = useMemo(() => {
    const slots = new Set(geoRowsByYear.map((row) => getSemesterSlotFromGeoRow(row)));
    return geoPeriodOptions.filter((item) => slots.has(item.value));
  }, [geoPeriodOptions, geoRowsByYear]);
  const geoRowsByYearAndPeriod = useMemo(() => {
    if (!geoFilters.periodos?.length) return geoRowsByYear;
    const selectedSlots = new Set(geoFilters.periodos);
    return geoRowsByYear.filter((row) => selectedSlots.has(getSemesterSlotFromGeoRow(row)));
  }, [geoFilters.periodos, geoRowsByYear]);
  const geoProgramMapFiltered = useMemo(
    () => buildCanonicalLabelMap(geoRowsByYearAndPeriod.map((row) => row?.programa)),
    [geoRowsByYearAndPeriod]
  );
  const geoProgramOptionsFiltered = useMemo(
    () => Array.from(geoProgramMapFiltered.values()).sort((a, b) => a.localeCompare(b, 'es')),
    [geoProgramMapFiltered]
  );
  const selectedMatriculadosDepartment = useMemo(
    () => matriculadosDepartments.find((item) => item.name === matriculadosGeoSelection) || null,
    [matriculadosDepartments, matriculadosGeoSelection]
  );
  const selectedMatriculadosMunicipality = useMemo(
    () => (selectedMatriculadosDepartment?.municipios || []).find(
      (item) => normalizeGeoNameKey(item?.municipio || '') === normalizeGeoNameKey(matriculadosMunicipioSelection || '')
    ) || null,
    [matriculadosMunicipioSelection, selectedMatriculadosDepartment]
  );
  const handleSelectMatriculadosDepartment = useCallback((departmentName = '') => {
    const nextName = String(departmentName || '').trim();
    setMatriculadosMunicipioSelection('');
    setMatriculadosGeoSelection((prev) => prev === nextName ? '' : nextName);
    if (nextName) {
      window.requestAnimationFrame(() => {
        municipalSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, []);
  const activeTerritorialScope = useMemo(() => {
    if (selectedMatriculadosMunicipality) {
      return {
        total: normalizeNumber(selectedMatriculadosMunicipality.total || 0),
        sexo: selectedMatriculadosMunicipality.sexo || [],
        historico: selectedMatriculadosMunicipality.historico || []
      };
    }
    if (selectedMatriculadosDepartment) {
      return {
        total: normalizeNumber(selectedMatriculadosDepartment.total || 0),
        sexo: selectedMatriculadosDepartment.sexo || [],
        historico: selectedMatriculadosDepartment.historico || []
      };
    }
    return {
      total: normalizeNumber(matriculadosPanelData?.totalRegistros || 0),
      sexo: matriculadosPanelData?.sexo || [],
      historico: matriculadosPanelData?.historico || []
    };
  }, [matriculadosPanelData, selectedMatriculadosDepartment, selectedMatriculadosMunicipality]);
  const matriculadosCountries = useMemo(
    () => (matriculadosPanelData?.geography?.countries || []).filter((item) => item.name !== 'COLOMBIA'),
    [matriculadosPanelData]
  );
  const geoSexoOptions = useMemo(
    () => (matriculadosPanelData?.sexosDisponibles || []).filter(Boolean),
    [matriculadosPanelData]
  );
  const geoNivelOptions = useMemo(
    () => (matriculadosPanelData?.nivelesDisponibles || []).filter(Boolean),
    [matriculadosPanelData]
  );
  const matriculadosAniosDisponibles = useMemo(
    () => Array.from(new Set((matriculadosPanelData?.aniosDisponibles || []).map((yr) => String(yr)).filter(Boolean))).sort(),
    [matriculadosPanelData]
  );
  const matriculadosProgramasDisponibles = useMemo(
    () => (matriculadosPanelData?.programasDisponibles || []).filter(Boolean),
    [matriculadosPanelData]
  );
  const matriculadosPeriodosDisponibles = useMemo(() => {
    const semestres = matriculadosPanelData?.semestres || [];
    const periodos = [];
    semestres.forEach((s) => {
      const yr = String(s.anio);
      if (s.semestre1 > 0) periodos.push({ label: `${yr}-1`, order: Number(yr) * 10 + 1 });
      if (s.semestre2 > 0) periodos.push({ label: `${yr}-2`, order: Number(yr) * 10 + 2 });
    });
    return periodos.sort((a, b) => a.order - b.order);
  }, [matriculadosPanelData]);
  const matriculadosDepartmentsMapData = useMemo(
    () => (matriculadosDepartments || []).map((item) => ({
      name: String(item?.name || ''),
      total: normalizeNumber(item?.total || 0)
    })).filter((item) => item.name),
    [matriculadosDepartments]
  );
  const matriculadosMunicipiosMapData = useMemo(
    () => ((selectedMatriculadosDepartment?.municipios || []).map((item) => ({
      municipio: String(item?.municipio || ''),
      total: normalizeNumber(item?.total || 0)
    })).filter((item) => item.municipio)),
    [selectedMatriculadosDepartment]
  );
  useEffect(() => {
    if (!matriculadosMunicipioSelection) return;
    const exists = matriculadosMunicipiosMapData.some(
      (item) => normalizeGeoNameKey(item.municipio) === normalizeGeoNameKey(matriculadosMunicipioSelection)
    );
    if (!exists) setMatriculadosMunicipioSelection('');
  }, [matriculadosMunicipioSelection, matriculadosMunicipiosMapData]);
  useEffect(() => {
    setGeoHoverCard(null);
  }, [matriculadosGeoSelection, matriculadosMunicipioSelection]);
  useEffect(() => {
    setMatriculadosMunicipioSelection('');
  }, [matriculadosGeoSelection]);
  const matriculadosMunicipiosGeoPoints = useMemo(() => {
    const selectedDeptKey = normalizeGeoNameKey(selectedMatriculadosDepartment?.name || '');
    if (!selectedDeptKey) return [];
    const deptCentroid = deptCentroids[selectedDeptKey] || null;
    const points = matriculadosMunicipiosMapData.map((item, index) => {
      const muniKey = normalizeGeoNameKey(item.municipio);
      const geo = municipalityGeoIndex[`${selectedDeptKey}|${muniKey}`] || null;
      if (geo && Number.isFinite(geo.lat) && Number.isFinite(geo.lon)) {
        return { ...item, lat: geo.lat, lon: geo.lon, source: 'geo' };
      }
      const fallbackHash = hashString(`${selectedDeptKey}|${item.municipio}|${index}`);
      const baseLon = Number.isFinite(deptCentroid?.lon) ? deptCentroid.lon : -74;
      const baseLat = Number.isFinite(deptCentroid?.lat) ? deptCentroid.lat : 4.5;
      return {
        ...item,
        lon: baseLon + (((fallbackHash % 1000) / 1000) - 0.5) * 1.6,
        lat: baseLat + ((((Math.floor(fallbackHash / 31) % 1000) / 1000) - 0.5) * 1.6),
        source: 'fallback'
      };
    }).filter((item) => Number.isFinite(item.lon) && Number.isFinite(item.lat));
    const maxTotal = Math.max(...points.map((p) => normalizeNumber(p.total || 0)), 1);
    return points.map((item) => ({
      ...item,
      radius: 35 + Math.round((normalizeNumber(item.total || 0) / maxTotal) * 180)
    }));
  }, [deptCentroids, matriculadosMunicipiosMapData, municipalityGeoIndex, selectedMatriculadosDepartment?.name]);
  const departmentTotalsByKey = useMemo(() => {
    const map = new Map();
    (matriculadosDepartmentsMapData || []).forEach((item) => {
      const key = normalizeGeoNameKey(item.name);
      if (!key) return;
      map.set(key, { total: normalizeNumber(item.total || 0), label: item.name });
    });
    return map;
  }, [matriculadosDepartmentsMapData]);
  const deptGeoPolygons = useMemo(() => {
    const features = Array.isArray(deptGeoFeatures) ? deptGeoFeatures : [];
    const rows = features.map((feature) => {
      const shapeName = String(feature?.properties?.shapeName || '').trim();
      const key = normalizeGeoNameKey(shapeName);
      const rings = geometryToRings(feature?.geometry);
      const info = departmentTotalsByKey.get(key) || { total: 0, label: shapeName };
      const rowBBox = computeRingsBBox(rings);
      const centroid = (deptCentroids[key] && Number.isFinite(deptCentroids[key].lat) && Number.isFinite(deptCentroids[key].lon))
        ? { lat: deptCentroids[key].lat, lon: deptCentroids[key].lon }
        : {
          lat: (rowBBox.minLat + rowBBox.maxLat) / 2,
          lon: (rowBBox.minLon + rowBBox.maxLon) / 2
        };
      return {
        key,
        name: info.label || shapeName,
        shapeName,
        total: normalizeNumber(info.total || 0),
        rings,
        centroid
      };
    }).filter((item) => item.rings.length > 0);
    const bbox = computeRingsBBox(rows.flatMap((r) => r.rings));
    const maxTotal = Math.max(...rows.map((r) => r.total), 1);
    return rows.map((row) => ({
      ...row,
      path: buildSvgPathFromRings(
        row.rings,
        bbox,
        COLOMBIA_MAP_CANVAS_WIDTH,
        COLOMBIA_MAP_CANVAS_HEIGHT,
        COLOMBIA_MAP_CANVAS_PADDING
      ),
      intensity: Math.max(0.12, row.total > 0 ? (row.total / maxTotal) : 0.06)
    }));
  }, [departmentTotalsByKey, deptCentroids, deptGeoFeatures]);
  const deptMapBbox = useMemo(
    () => computeRingsBBox(deptGeoPolygons.flatMap((r) => r.rings)),
    [deptGeoPolygons]
  );
  const selectedDeptGeoPolygon = useMemo(() => {
    const key = normalizeGeoNameKey(selectedMatriculadosDepartment?.name || matriculadosGeoSelection || '');
    return deptGeoPolygons.find((item) => item.key === key) || null;
  }, [deptGeoPolygons, matriculadosGeoSelection, selectedMatriculadosDepartment?.name]);
  const muniMapBounds = useMemo(() => {
    if (selectedDeptGeoPolygon?.rings?.length) {
      const b = computeRingsBBox(selectedDeptGeoPolygon.rings);
      return { lonMin: b.minLon, lonMax: b.maxLon, latMin: b.minLat, latMax: b.maxLat };
    }
    if (!matriculadosMunicipiosGeoPoints.length) {
      const selectedDeptKey = normalizeGeoNameKey(selectedMatriculadosDepartment?.name || '');
      const c = deptCentroids[selectedDeptKey];
      if (c && Number.isFinite(c.lat) && Number.isFinite(c.lon)) {
        return { lonMin: c.lon - 1.4, lonMax: c.lon + 1.4, latMin: c.lat - 1.4, latMax: c.lat + 1.4 };
      }
      return { lonMin: -78, lonMax: -71, latMin: 0.5, latMax: 8.5 };
    }
    const lons = matriculadosMunicipiosGeoPoints.map((p) => p.lon);
    const lats = matriculadosMunicipiosGeoPoints.map((p) => p.lat);
    return {
      lonMin: Math.min(...lons) - 0.45,
      lonMax: Math.max(...lons) + 0.45,
      latMin: Math.min(...lats) - 0.45,
      latMax: Math.max(...lats) + 0.45
    };
  }, [deptCentroids, matriculadosMunicipiosGeoPoints, selectedDeptGeoPolygon, selectedMatriculadosDepartment?.name]);
  const deptMunicipalityPolygons = useMemo(() => {
    if (!selectedDeptGeoPolygon?.rings?.length || !Array.isArray(adm2GeoFeatures) || adm2GeoFeatures.length === 0) return [];

    const deptBbox = computeRingsBBox(selectedDeptGeoPolygon.rings);
    const nameToTotal = new Map(
      (selectedMatriculadosDepartment?.municipios || []).map((item) => [
        normalizeGeoNameKey(item?.municipio || ''),
        normalizeNumber(item?.total || 0)
      ])
    );
    const rows = adm2GeoFeatures
      .map((feature) => {
        const shapeName = String(feature?.properties?.shapeName || '').trim();
        const muniKey = normalizeGeoNameKey(shapeName);
        if (!muniKey) return null;
        const rings = geometryToRings(feature?.geometry);
        if (!rings.length) return null;
        const rowBbox = computeRingsBBox(rings);
        const centroidLon = (rowBbox.minLon + rowBbox.maxLon) / 2;
        const centroidLat = (rowBbox.minLat + rowBbox.maxLat) / 2;

        const inDeptBbox = centroidLon >= deptBbox.minLon
          && centroidLon <= deptBbox.maxLon
          && centroidLat >= deptBbox.minLat
          && centroidLat <= deptBbox.maxLat;
        if (!inDeptBbox) return null;
        if (!isPointInAnyRing(centroidLon, centroidLat, selectedDeptGeoPolygon.rings)) return null;

        const total = nameToTotal.get(muniKey) || 0;
        return {
          key: `${selectedDeptGeoPolygon.key}|${muniKey}`,
          name: shapeName,
          muniKey,
          total,
          centroidLon,
          centroidLat,
          path: buildSvgPathFromRings(rings, {
            minLon: muniMapBounds.lonMin,
            maxLon: muniMapBounds.lonMax,
            minLat: muniMapBounds.latMin,
            maxLat: muniMapBounds.latMax
          }, DEPARTMENT_MAP_CANVAS_WIDTH, DEPARTMENT_MAP_CANVAS_HEIGHT, DEPARTMENT_MAP_CANVAS_PADDING)
        };
      })
      .filter(Boolean);

    const maxTotal = Math.max(...rows.map((item) => normalizeNumber(item.total || 0)), 1);
    return rows.map((item) => ({
      ...item,
      intensity: item.total > 0 ? Math.max(0.16, item.total / maxTotal) : 0
    }));
  }, [adm2GeoFeatures, muniMapBounds, selectedDeptGeoPolygon, selectedMatriculadosDepartment?.municipios]);
  const departmentMapPins = useMemo(() => (
    deptGeoPolygons
      .filter((shape) => normalizeNumber(shape.total || 0) > 0)
      .map((shape) => {
        const point = projectLonLatToSvg({
          lon: shape.centroid?.lon,
          lat: shape.centroid?.lat,
          bbox: deptMapBbox,
          width: COLOMBIA_MAP_CANVAS_WIDTH,
          height: COLOMBIA_MAP_CANVAS_HEIGHT,
          padding: Math.max(COLOMBIA_MAP_CANVAS_PADDING, 20)
        });
        return {
          key: shape.key,
          name: normalizeUiUpper(shape.name || ''),
          total: normalizeNumber(shape.total || 0),
          percent: total > 0 ? (normalizeNumber(shape.total || 0) / total) * 100 : 0,
          x: point.x,
          y: point.y
        };
      })
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
      .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0))
  ), [deptGeoPolygons, deptMapBbox, total]);
  const municipalityPins = useMemo(
    () => deptMunicipalityPolygons
      .filter((item) => normalizeNumber(item.total || 0) > 0)
      .map((item) => {
        const point = projectLonLatToSvg({
          lon: Number(item.centroidLon),
          lat: Number(item.centroidLat),
          bbox: {
            minLon: muniMapBounds.lonMin,
            maxLon: muniMapBounds.lonMax,
            minLat: muniMapBounds.latMin,
            maxLat: muniMapBounds.latMax
          },
          width: DEPARTMENT_MAP_CANVAS_WIDTH,
          height: DEPARTMENT_MAP_CANVAS_HEIGHT,
          padding: DEPARTMENT_MAP_CANVAS_PADDING
        });
        return {
          key: item.key,
          muniKey: item.muniKey,
          name: normalizeUiUpper(item.name || ''),
          total: normalizeNumber(item.total || 0),
          x: point.x,
          y: point.y
        };
      })
      .filter((item) => Number.isFinite(item.x) && Number.isFinite(item.y))
      .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0)),
    [deptMunicipalityPolygons, muniMapBounds]
  );
  const sexoPalette = useMemo(() => ({
    Femenino: '#EC4899',
    Masculino: '#3B82F6',
    'No binario': '#8b5cf6',
    'Sin informacion': '#94a3b8'
  }), []);
  const sexPieData = useMemo(() => {
    const total = normalizeNumber(activeTerritorialScope?.total || 0);
    return (activeTerritorialScope?.sexo || [])
      .map((item) => ({
        ...item,
        total: normalizeNumber(item.total || 0),
        color: sexoPalette[item.name] || '#64748b',
        percent: total > 0 ? (normalizeNumber(item.total || 0) / total) * 100 : 0
      }))
      .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0));
  }, [activeTerritorialScope, sexoPalette]);
  const matriculadosHistorico = useMemo(() => activeTerritorialScope?.historico || [], [activeTerritorialScope]);
  const matriculadosAnalysisText = useMemo(() => {
    const total = normalizeNumber(matriculadosPanelData?.totalRegistros || 0);
    const deptoTop = matriculadosDepartments[0];
    const countryTop = matriculadosCountries[0];
    const sexTop = sexPieData[0];
    const lastPoint = matriculadosHistorico[matriculadosHistorico.length - 1];
    const firstPoint = matriculadosHistorico[0];
    const growth = firstPoint && lastPoint && normalizeNumber(firstPoint.total || 0) > 0
      ? ((normalizeNumber(lastPoint.total || 0) - normalizeNumber(firstPoint.total || 0)) / normalizeNumber(firstPoint.total || 1)) * 100
      : null;

    return [
      `Con los filtros activos se registran ${formatNumber(total)} estudiantes matriculados.`,
      deptoTop ? `El mayor origen nacional es ${deptoTop.name} con ${formatNumber(deptoTop.total)} estudiantes.` : 'No hay departamentos reportados en la muestra actual.',
      sexTop ? `La mayor participacion por sexo biologico es ${sexTop.name.toLowerCase()} (${sexTop.percent.toFixed(1)}%).` : 'No hay informacion de sexo biologico en la muestra.',
      lastPoint ? `El ultimo semestre visible es ${lastPoint.periodLabel} con ${formatNumber(lastPoint.total)} matriculados.` : 'No hay serie historica disponible para los filtros.',
      growth === null ? 'No se pudo calcular variacion por falta de puntos comparables.' : `Variacion del primer al ultimo semestre visible: ${growth >= 0 ? '+' : ''}${growth.toFixed(1)}%.`,
      countryTop ? `En origen internacional predomina ${countryTop.name} con ${formatNumber(countryTop.total)} estudiantes.` : 'No se reportan estudiantes internacionales para los filtros aplicados.'
    ].join('\n');
  }, [matriculadosPanelData, matriculadosDepartments, matriculadosCountries, sexPieData, matriculadosHistorico]);

  useEffect(() => {
    const departments = matriculadosPanelData?.geography?.departments || [];
    const deptMap = {};
    const muniMap = {};
    departments.forEach((item) => {
      const deptKey = normalizeGeoNameKey(item?.name || '');
      const lat = normalizeNumber(item?.lat);
      const lon = normalizeNumber(item?.lon);
      if (deptKey && Number.isFinite(lat) && Number.isFinite(lon)) {
        deptMap[deptKey] = { lat, lon };
      }
      (item?.municipios || []).forEach((muni) => {
        const muniKey = normalizeGeoNameKey(muni?.municipio || '');
        const muniLat = normalizeNumber(muni?.lat);
        const muniLon = normalizeNumber(muni?.lon);
        if (deptKey && muniKey && Number.isFinite(muniLat) && Number.isFinite(muniLon)) {
          muniMap[`${deptKey}|${muniKey}`] = { lat: muniLat, lon: muniLon };
        }
      });
    });
    setDeptCentroids(deptMap);
    setMunicipalityGeoIndex(muniMap);
  }, [matriculadosPanelData]);

  useEffect(() => {
    if (deptGeoLoadedRef.current) return;
    deptGeoLoadedRef.current = true;
    setDeptGeoFeaturesReady(false);
    const loadGeoJson = async () => {
      const publicUrl = String(process.env.PUBLIC_URL || '').trim();
      const baseCandidates = [
        '/geodata/colombia_adm1.geojson',
        'geodata/colombia_adm1.geojson'
      ];
      if (publicUrl) {
        const normalized = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
        baseCandidates.unshift(`${normalized}/geodata/colombia_adm1.geojson`);
      }
      const candidates = Array.from(new Set(baseCandidates));

      for (const pathCandidate of candidates) {
        try {
          const url = new URL(pathCandidate, window.location.origin).toString();
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) continue;
          const geojson = await response.json();
          const features = (geojson?.features || []).map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              shapeName: f.properties?.NOMBRE_DPT || f.properties?.NAME_1 || f.properties?.shapeName || ''
            }
          }));
          if (features.length > 0) {
            setDeptGeoFeatures(features);
            setDeptGeoFeaturesReady(true);
            return;
          }
        } catch (_) {
          // continue with next candidate
        }
      }

      setDeptGeoFeatures([]);
      setDeptGeoFeaturesReady(true);
    };

    loadGeoJson();
  }, []);

  useEffect(() => {
    if (adm2GeoLoadedRef.current) return;
    adm2GeoLoadedRef.current = true;

    const loadAdm2GeoJson = async () => {
      const publicUrl = String(process.env.PUBLIC_URL || '').trim();
      const baseCandidates = [
        '/geodata/colombia_adm2.geojson',
        'geodata/colombia_adm2.geojson'
      ];
      if (publicUrl) {
        const normalized = publicUrl.endsWith('/') ? publicUrl.slice(0, -1) : publicUrl;
        baseCandidates.unshift(`${normalized}/geodata/colombia_adm2.geojson`);
      }
      const candidates = Array.from(new Set(baseCandidates));

      for (const pathCandidate of candidates) {
        try {
          const url = new URL(pathCandidate, window.location.origin).toString();
          const response = await fetch(url, { cache: 'no-store' });
          if (!response.ok) continue;
          const geojson = await response.json();
          const features = (geojson?.features || []).map((f) => ({
            ...f,
            properties: {
              ...f.properties,
              shapeName: f.properties?.shapeName || f.properties?.NOMBRE_MPI || f.properties?.name || ''
            }
          }));
          if (features.length > 0) {
            setAdm2GeoFeatures(features);
            return;
          }
        } catch (_) {
          // continue with next candidate
        }
      }

      setAdm2GeoFeatures([]);
    };

    loadAdm2GeoJson();
  }, []);

  useEffect(() => {
    if (menuView !== 'estadistica' || selectedCard !== 'poblacional' || poblacionalPanel !== 'analytics' || statSection !== 'matriculados') {
      setMatriculadosBundleReady(false);
      return;
    }
    if (!matriculadosPanelLoading && !matriculadosIncidenciasLoading && deptGeoFeaturesReady && matriculadosPanelData) {
      setMatriculadosBundleReady(true);
    }
  }, [
    deptGeoFeaturesReady,
    matriculadosIncidenciasLoading,
    matriculadosPanelData,
    matriculadosPanelLoading,
    menuView,
    poblacionalPanel,
    selectedCard,
    statSection
  ]);
  useEffect(() => {
    setGeoFilters((prev) => {
      if (!geoFiltersInitializedRef.current) {
        geoFiltersInitializedRef.current = true;
        const initial = {
          programas: [...geoProgramOptions],
          anios: [...geoYearOptions],
          periodos: ['1', '2']
        };
        setGeoAppliedFilters(initial);
        return initial;
      }
      const filteredProgramas = prev.programas.filter((item) => geoProgramOptionsFiltered.includes(item));
      const filteredAnios = prev.anios
        .map((item) => String(item))
        .filter((item) => geoYearOptions.includes(item));
      const filteredPeriodos = prev.periodos.filter((item) => geoPeriodOptionsFiltered.some((x) => x.value === item));
      const next = {
        // Permite deseleccionar todos; solo removemos valores inválidos.
        programas: filteredProgramas,
        anios: filteredAnios,
        periodos: filteredPeriodos
      };
      if (
        arraysEqualStrict(prev.programas, next.programas)
        && arraysEqualStrict(prev.anios, next.anios)
        && arraysEqualStrict(prev.periodos, next.periodos)
      ) {
        return prev;
      }
      return next;
    });
  }, [geoPeriodOptionsFiltered, geoProgramOptions, geoProgramOptionsFiltered, geoYearOptions]);
  useEffect(() => {
    setGeoTerritorialFilters((prev) => {
      if (!geoTerritorialFiltersInitializedRef.current) {
        geoTerritorialFiltersInitializedRef.current = true;
        const initial = {
          sexos: [...geoSexoOptions],
          niveles: [...geoNivelOptions]
        };
        setGeoTerritorialAppliedFilters(initial);
        return initial;
      }
      const next = {
        sexos: (prev.sexos || []).filter((item) => geoSexoOptions.includes(item)),
        niveles: (prev.niveles || []).filter((item) => geoNivelOptions.includes(item))
      };
      if (arraysEqualStrict(prev.sexos || [], next.sexos) && arraysEqualStrict(prev.niveles || [], next.niveles)) {
        return prev;
      }
      return next;
    });
  }, [geoNivelOptions, geoSexoOptions]);

  const resumenEstadisticoEstudiantesRows = useMemo(() => {
    const candidateYears = Array.from(
      new Set(
        seriesRows
          .filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso', 'Matriculados', 'Graduados'].includes(row.subcategoria))
          .map((row) => Number(row.anio) || 0)
          .filter((year) => year > 0)
      )
    ).sort((a, b) => b - a);
    const years = (candidateYears.length
      ? candidateYears.slice(0, SUMMARY_ESTADISTICO_YEAR_WINDOW)
      : [getMaxClosedAcademicYear()]
    );
    const periodSlots = ['1', '2'];
    const byPeriod = new Map();
    const selectedProgramKey = normalizeProgramKey(resumenEstadisticoUi.programa);
    const useProgramFilter = Boolean(selectedProgramKey);
    const desercionAnnualMap = new Map();

    desercionRows
      .map((row) => {
        const meta = parseObservacionesToMap(row.observaciones);
        return {
          anio: Number(row.anio) || 0,
          programaKey: normalizeProgramKey(row.programa),
          tipo: String(meta.tipo || '').trim().toUpperCase(),
          metric: normalizeMetricKey(row.indicador),
          valorNum: normalizeNumber(row.valor)
        };
      })
      .filter((row) => row.anio > 0 && row.tipo === 'ANUAL' && row.metric === 'programa')
      .forEach((row) => {
        if (useProgramFilter && row.programaKey !== selectedProgramKey) return;
        const current = desercionAnnualMap.get(row.anio) || { total: 0, count: 0 };
        current.total += row.valorNum;
        current.count += 1;
        desercionAnnualMap.set(row.anio, current);
      });

    seriesRows
      .filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso', 'Matriculados', 'Graduados'].includes(row.subcategoria))
      .forEach((row) => {
        const year = Number(row.anio) || 0;
        if (!years.includes(year)) return;
        const rowProgramKey = normalizeProgramKey(row.programa);
        if (useProgramFilter && rowProgramKey !== selectedProgramKey) return;
        const { periodLabel } = getRowPeriodMeta(row);
        const slot = String(periodLabel || '').endsWith('-2') ? '2' : '1';
        const key = `${year}-${slot}`;
        const current = byPeriod.get(key) || {
          anio: year,
          periodo: slot,
          inscritos: 0,
          admitidos: 0,
          matriculados: 0,
          primerCurso: 0,
          graduados: 0,
          desercionSpadies: 0,
          promedioSaberPro: 0,
          movilidadSalienteNacional: 0,
          movilidadSalienteInternacional: 0,
          movilidadEntranteNacional: 0,
          movilidadEntranteInternacional: 0
        };
        const value = normalizeNumber(row.valor);
        if (row.subcategoria === 'Inscritos') current.inscritos += value;
        if (row.subcategoria === 'Admitidos') current.admitidos += value;
        if (row.subcategoria === 'Matriculados') current.matriculados += value;
        if (row.subcategoria === 'Primer Curso') current.primerCurso += value;
        if (row.subcategoria === 'Graduados') current.graduados += value;
        byPeriod.set(key, current);
      });

    const rows = years.flatMap((year) => periodSlots.map((slot, slotIndex) => {
      const current = byPeriod.get(`${year}-${slot}`) || {
        anio: year,
        periodo: slot,
        inscritos: 0,
        admitidos: 0,
        matriculados: 0,
        primerCurso: 0,
        graduados: 0,
        desercionSpadies: 0,
        promedioSaberPro: 0,
        movilidadSalienteNacional: 0,
        movilidadSalienteInternacional: 0,
        movilidadEntranteNacional: 0,
        movilidadEntranteInternacional: 0
      };
      const annualDesercion = desercionAnnualMap.get(year);

      return {
        ...current,
        desercionSpadies: annualDesercion?.count ? (annualDesercion.total / annualDesercion.count) : 0,
        isYearGroupStart: slotIndex === 0,
        yearRowSpan: slotIndex === 0 ? periodSlots.length : 0,
        tasaSelectividad: current.inscritos > 0 ? (current.admitidos / current.inscritos) : 0,
        tasaAbsorcion: current.admitidos > 0 ? (current.primerCurso / current.admitidos) : 0
      };
    }));

    const avg = (getter) => rows.length ? rows.reduce((acc, row) => acc + getter(row), 0) / rows.length : 0;
    const averageRow = {
      label: 'Promedio',
      inscritos: avg((row) => row.inscritos),
      admitidos: avg((row) => row.admitidos),
      tasaSelectividad: avg((row) => row.tasaSelectividad),
      matriculados: avg((row) => row.matriculados),
      primerCurso: avg((row) => row.primerCurso),
      tasaAbsorcion: avg((row) => row.tasaAbsorcion),
      graduados: avg((row) => row.graduados),
      desercionSpadies: avg((row) => row.desercionSpadies),
      promedioSaberPro: avg((row) => row.promedioSaberPro),
      movilidadSalienteNacional: avg((row) => row.movilidadSalienteNacional),
      movilidadSalienteInternacional: avg((row) => row.movilidadSalienteInternacional),
      movilidadEntranteNacional: avg((row) => row.movilidadEntranteNacional),
      movilidadEntranteInternacional: avg((row) => row.movilidadEntranteInternacional)
    };

    return { rows, averageRow, visibleYears: years };
  }, [desercionRows, seriesRows, resumenEstadisticoUi.programa]);
  const resumenEstadisticoProgramOptions = useMemo(() => {
    const labelMap = new Map();
    seriesRows
      .filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso', 'Matriculados', 'Graduados'].includes(row.subcategoria))
      .forEach((row) => {
        const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
        if (!rawProgram) return;
        const key = normalizeProgramKey(rawProgram);
        labelMap.set(key, selectPreferredProgramLabel(labelMap.get(key), rawProgram));
    });
    return Array.from(labelMap.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [seriesRows]);
  useEffect(() => {
    if (!resumenEstadisticoUi.programa) return;
    if (resumenEstadisticoProgramOptions.some((item) => normalizeProgramKey(item) === normalizeProgramKey(resumenEstadisticoUi.programa))) return;
    setResumenEstadisticoUi((prev) => ({ ...prev, programa: '' }));
  }, [resumenEstadisticoProgramOptions, resumenEstadisticoUi.programa]);
  const resumenEstadisticoWorkbookSheets = useMemo(() => {
    const { rows, averageRow, visibleYears } = resumenEstadisticoEstudiantesRows;
    const academicRows = buildAcademicYearRows(visibleYears);
    const annualRows = buildAnnualRows(visibleYears);
    return [
      {
        key: 'informacion_general',
        title: 'Informacion General',
        columns: ['Módulo', 'Hojas base', 'Estado', 'Observación'],
        rows: CUADROS_MAESTROS_MODULES.filter((module) => module.key !== 'informacion_general').map((module) => ([
          module.label,
          module.sheets.map((sheet) => sheet.trim()).join(', '),
          module.key === 'estudiantes' ? 'Integrado' : 'Diseñado',
          module.key === 'estudiantes' ? 'Con datos visibles y exportación activa.' : 'Tabla estructurada y lista para llenado estadístico.'
        ]))
      },
      {
        key: 'estudiantes',
        title: 'Estudiantes',
        columns: ['Año', 'Período', 'Inscritos', 'Admitidos', 'Tasa de selectividad', 'Matriculados', 'Primer curso', 'Tasa de absorción', 'Graduados', 'Deserción SPADIES', 'Saber Pro', 'Saliente nacional', 'Saliente internacional', 'Entrante nacional', 'Entrante internacional'],
        rows: rows.map((row) => ([
          row.anio,
          row.periodo === '1' ? 'I' : 'II',
          normalizeNumber(row.inscritos),
          normalizeNumber(row.admitidos),
          formatSummaryRate(row.tasaSelectividad),
          normalizeNumber(row.matriculados),
          normalizeNumber(row.primerCurso),
          formatSummaryRate(row.tasaAbsorcion),
          normalizeNumber(row.graduados),
          formatSummaryRate(row.desercionSpadies),
          0,
          0,
          0,
          0,
          0
        ])),
        footer: ['Promedio', '', formatNumber(averageRow.inscritos), formatNumber(averageRow.admitidos), formatSummaryRate(averageRow.tasaSelectividad), formatNumber(averageRow.matriculados), formatNumber(averageRow.primerCurso), formatSummaryRate(averageRow.tasaAbsorcion), formatNumber(averageRow.graduados), formatSummaryRate(averageRow.desercionSpadies), 0, 0, 0, 0, 0]
      },
      {
        key: 'profesores_detallado',
        title: 'Profesores Listado Detallado',
        columns: ['Año', 'Período', 'Planta', 'Tiempo completo', 'Medio tiempo', 'Cátedra', 'Doctores', 'Magíster'],
        rows: academicRows.map((row) => ([row.anio, row.periodo, 0, 0, 0, 0, 0, 0]))
      },
      {
        key: 'profesores_resumen',
        title: 'Profesores Resumen',
        columns: ['Año', 'Tipo de vinculación', 'Cantidad', 'Participación %'],
        rows: annualRows.flatMap((row) => ([['Planta', 0, '0.00%'], ['Tiempo completo', 0, '0.00%'], ['Cátedra', 0, '0.00%']].map((item) => [row.anio, item[0], item[1], item[2]])))
      },
      {
        key: 'movilidad_profesores',
        title: 'Profesores Movilidad',
        columns: ['Año', 'Período', 'Saliente nacional', 'Saliente internacional', 'Entrante nacional', 'Entrante internacional'],
        rows: academicRows.map((row) => ([row.anio, row.periodo, 0, 0, 0, 0]))
      },
      {
        key: 'movilidad_estudiantes',
        title: 'Estudiante Movilidad',
        columns: ['Año', 'Período', 'Saliente nacional', 'Saliente internacional', 'Entrante nacional', 'Entrante internacional'],
        rows: academicRows.map((row) => ([row.anio, row.periodo, 0, 0, 0, 0]))
      },
      {
        key: 'investigacion',
        title: 'Investigación',
        columns: ['Año', 'Grupos', 'Profesores investigadores', 'Semilleros', 'Proyectos', 'Productos'],
        rows: annualRows.map((row) => ([row.anio, 0, 0, 0, 0, 0]))
      },
      {
        key: 'bienestar',
        title: 'Bienestar',
        columns: ['Año', 'Período', 'Estudiantes atendidos', 'Docentes atendidos', 'Administrativos atendidos', 'Actividades'],
        rows: academicRows.map((row) => ([row.anio, row.periodo, 0, 0, 0, 0]))
      },
      {
        key: 'proyeccion_social',
        title: 'Proyección Social',
        columns: ['Año', 'Proyectos', 'Beneficiarios internos', 'Beneficiarios externos', 'Eventos', 'Alianzas'],
        rows: annualRows.map((row) => ([row.anio, 0, 0, 0, 0, 0]))
      },
      {
        key: 'convenios',
        title: 'Convenios',
        columns: ['Año', 'Convenios activos', 'Nacionales', 'Internacionales', 'Nuevos', 'Finalizados'],
        rows: annualRows.map((row) => ([row.anio, 0, 0, 0, 0, 0]))
      }
    ];
  }, [resumenEstadisticoEstudiantesRows]);
  const flujoProgramMetrics = useMemo(() => {
    if (activeSection.key !== 'flujo') return [];
    const map = new Map();
    const yearSet = new Set(flujoTableYearsFilter);
    const useYearFilter = yearSet.size > 0;
    const periodSet = new Set(flujoTableAcademicPeriodsFilter);
    const usePeriodFilter = periodSet.size > 0;
    (activeSectionCatalog.rows || [])
      .filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso'].includes(row.subcategoria))
      .forEach((row) => {
        const rowYear = String(Number(row.anio) || '');
        if (useYearFilter && !yearSet.has(rowYear)) return;
        const { periodLabel } = getRowPeriodMeta(row);
        const periodSlot = String(periodLabel || '').endsWith('-2') ? '2' : '1';
        if (usePeriodFilter && !periodSet.has(periodSlot)) return;
        const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
        const isPostgrado = isPostgradoProgram(rawProgram);
        if (flujoTableLevelFilter === 'pregrado' && isPostgrado) return;
        if (flujoTableLevelFilter === 'postgrado' && !isPostgrado) return;
        const key = normalizeProgramKey(rawProgram) || 'SIN_PROGRAMA';
        const current = map.get(key) || {
          programa: rawProgram || 'Sin programa',
          inscritos: 0,
          admitidos: 0,
          primerCurso: 0
        };
        current.programa = selectPreferredProgramLabel(current.programa, rawProgram || 'Sin programa');
        const value = normalizeNumber(row.valor);
        if (row.subcategoria === 'Inscritos') current.inscritos += value;
        if (row.subcategoria === 'Admitidos') current.admitidos += value;
        if (row.subcategoria === 'Primer Curso') current.primerCurso += value;
        map.set(key, current);
      });

    return Array.from(map.values())
      .map((item) => ({
        ...item,
        tasaSelectividad: item.inscritos > 0 ? (item.admitidos / item.inscritos) : null,
        tasaAbsorcion: item.admitidos > 0 ? (item.primerCurso / item.admitidos) : null
      }))
      .sort((a, b) => (b.inscritos + b.admitidos + b.primerCurso) - (a.inscritos + a.admitidos + a.primerCurso));
  }, [activeSection.key, activeSectionCatalog.rows, flujoTableYearsFilter, flujoTableAcademicPeriodsFilter, flujoTableLevelFilter]);
  const flujoRowsForAnnualIndependentCharts = useMemo(() => {
    const rows = sectionCatalogs.flujo?.rows || [];
    return rows.filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso'].includes(row.subcategoria));
  }, [sectionCatalogs]);
  const flujoChartProgramOptions = useMemo(() => {
    const labelMap = new Map();
    flujoRowsForAnnualIndependentCharts.forEach((row) => {
      const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
      if (!rawProgram) return;
      const key = normalizeProgramKey(rawProgram);
      const existing = labelMap.get(key);
      labelMap.set(key, selectPreferredProgramLabel(existing, rawProgram));
    });
    return Array.from(labelMap.values()).sort((a, b) => a.localeCompare(b, 'es'));
  }, [flujoRowsForAnnualIndependentCharts]);
  const flujoChartYearOptions = useMemo(() => {
    return Array.from(new Set(
      flujoRowsForAnnualIndependentCharts
        .map((row) => String(Number(row.anio) || ''))
    ))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b));
  }, [flujoRowsForAnnualIndependentCharts]);
  const flujoRowsForChartsFiltered = useMemo(() => {
    const selectedPrograms = new Set((flujoChartProgramsFilter || []).map((item) => normalizeProgramKey(item)));
    const useProgramFilter = selectedPrograms.size > 0;
    const selectedYears = new Set(flujoChartYearsFilter || []);
    const useYearFilter = selectedYears.size > 0;
    return flujoRowsForAnnualIndependentCharts.filter((row) => {
      const rawProgram = String(row.programa || '').replace(/\s+/g, ' ').trim();
      const rowProgram = normalizeProgramKey(rawProgram);
      if (useProgramFilter && !selectedPrograms.has(rowProgram)) return false;
      const rowYear = String(Number(row.anio) || '');
      if (useYearFilter && !selectedYears.has(rowYear)) return false;
      return true;
    });
  }, [flujoRowsForAnnualIndependentCharts, flujoChartProgramsFilter, flujoChartYearsFilter]);
  const flujoTableYearOptions = useMemo(
    () => Array.from(new Set(
      (activeSectionCatalog.rows || [])
        .filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso'].includes(row.subcategoria))
        .map((row) => String(Number(row.anio) || ''))
    ))
      .filter(Boolean)
      .sort((a, b) => Number(a) - Number(b)),
    [activeSectionCatalog.rows]
  );
  const flujoTableAcademicPeriodOptions = useMemo(() => {
    const optionsSet = new Set();
    (activeSectionCatalog.rows || [])
      .filter((row) => ['Inscritos', 'Admitidos', 'Primer Curso'].includes(row.subcategoria))
      .forEach((row) => {
        const { periodLabel } = getRowPeriodMeta(row);
        const slot = String(periodLabel || '').endsWith('-2') ? '2' : '1';
        optionsSet.add(slot);
      });
    return Array.from(optionsSet).sort((a, b) => Number(a) - Number(b));
  }, [activeSectionCatalog.rows]);
  const flujoAnnualComparisonData = useMemo(() => {
    const map = new Map();
    flujoRowsForChartsFiltered.forEach((row) => {
      const year = String(Number(row.anio) || '');
      if (!year) return;
      const { periodLabel } = getRowPeriodMeta(row);
      const periodSlot = String(periodLabel || '').endsWith('-2') ? 2 : 1;
      const current = map.get(year) || {
        anio: year,
        inscritosP1: 0,
        inscritosP2: 0,
        admitidosP1: 0,
        admitidosP2: 0,
        primerCursoP1: 0,
        primerCursoP2: 0
      };
      const value = normalizeNumber(row.valor);
      if (row.subcategoria === 'Inscritos') {
        if (periodSlot === 1) current.inscritosP1 += value;
        else current.inscritosP2 += value;
      }
      if (row.subcategoria === 'Admitidos') {
        if (periodSlot === 1) current.admitidosP1 += value;
        else current.admitidosP2 += value;
      }
      if (row.subcategoria === 'Primer Curso') {
        if (periodSlot === 1) current.primerCursoP1 += value;
        else current.primerCursoP2 += value;
      }
      map.set(year, current);
    });
    return Array.from(map.values()).sort((a, b) => Number(a.anio) - Number(b.anio));
  }, [flujoRowsForChartsFiltered]);
  useEffect(() => {
    if (!flujoTableYearOptions.length) return;
    setFlujoTableYearsFilter((prev) => prev.filter((year) => flujoTableYearOptions.includes(year)));
  }, [flujoTableYearOptions]);
  useEffect(() => {
    if (!flujoTableAcademicPeriodOptions.length) return;
    setFlujoTableAcademicPeriodsFilter((prev) => prev.filter((period) => flujoTableAcademicPeriodOptions.includes(period)));
  }, [flujoTableAcademicPeriodOptions]);
  useEffect(() => {
    if (!flujoChartProgramOptions.length) return;
    setFlujoChartProgramsFilter((prev) => {
      if (!prev.length) return [...flujoChartProgramOptions];
      return prev.filter((program) => flujoChartProgramOptions.some((item) => normalizeProgramKey(item) === normalizeProgramKey(program)));
    });
  }, [flujoChartProgramOptions]);
  useEffect(() => {
    if (!flujoChartYearOptions.length) return;
    setFlujoChartYearsFilter((prev) => {
      if (!prev.length) return [...flujoChartYearOptions];
      return prev.filter((year) => flujoChartYearOptions.includes(year));
    });
  }, [flujoChartYearOptions]);

  useEffect(() => {
    if (egresadosDetalleActivo && !cantidadTotalEgresadosDashboard.porDetalle.some((item) => item.label === egresadosDetalleActivo)) {
      setEgresadosDetalleActivo('');
    }
  }, [cantidadTotalEgresadosDashboard, egresadosDetalleActivo]);

  useEffect(() => {
    const programas = Array.from(new Set(desercionRows.map((r) => String(r.programa || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    if (desercionUi.programa && !programas.includes(desercionUi.programa)) {
      setDesercionUi((prev) => ({ ...prev, programa: '' }));
    }
  }, [desercionRows, desercionUi.programa]);

  useEffect(() => {
    if (desercionUi.tipo !== 'COHORTE' && desercionUi.corteCohorte !== 'Todos') {
      setDesercionUi((prev) => ({ ...prev, corteCohorte: 'Todos' }));
    }
  }, [desercionUi.tipo, desercionUi.corteCohorte]);

  useEffect(() => {
    const programas = Array.from(new Set(empleabilidadRows.map((r) => String(r.programa || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    if (empleabilidadUi.programa && !programas.includes(empleabilidadUi.programa)) {
      setEmpleabilidadUi({ programa: '' });
    }
  }, [empleabilidadRows, empleabilidadUi.programa]);

  useEffect(() => {
    const parsed = contextoExternoRows.map((row) => parseObservacionesToMap(row.observaciones));
    const programasObjetivo = Array.from(new Set(parsed.map((m) => String(m.programa_objetivo || '').trim()).filter(Boolean)));
    if (contextoExternoUi.programaObjetivo && !programasObjetivo.includes(contextoExternoUi.programaObjetivo)) {
      setContextoExternoUi((prev) => ({ ...prev, programaObjetivo: '' }));
    }
  }, [contextoExternoRows, contextoExternoUi.programaObjetivo]);

  const handleDownloadTemplate = async () => {
    if (!isSelectionValid) {
      enqueueSnackbar('Selecciona base y subbase antes de descargar la plantilla', { variant: 'warning' });
      return;
    }
    try {
      const effectiveSubcategoria = baseSeleccionada === 'georreferencia'
        ? GEOREFERENCIA_CANONICAL_SUBBASE
        : subcategoria;
      const response = await gestionInformacionService.downloadTemplate(
        backendCategoria,
        effectiveSubcategoria,
        requiresSubSubBase ? subSubBaseSeleccionada : ''
      );
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers?.['content-disposition'] || response.headers?.['Content-Disposition'] || '';
      const serverFilenameMatch = contentDisposition.match(/filename="?([^"]+)"?/i);
      const serverFilename = serverFilenameMatch?.[1] ? String(serverFilenameMatch[1]).trim() : '';
      const suffix = baseSeleccionada === 'georreferencia'
        ? '_DIVIPOLA_Departamento'
        : `${effectiveSubcategoria ? `_${effectiveSubcategoria}` : ''}${requiresSubSubBase ? `_${subSubBaseSeleccionada}` : ''}`.replace(/\s+/g, '_');
      link.setAttribute('download', serverFilename || `plantilla_${baseSeleccionada}${suffix}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al descargar plantilla', { variant: 'error' });
    }
  };

  const handleImport = async () => {
    if (!isSelectionValid) {
      enqueueSnackbar('Selecciona base y subbase antes de importar', { variant: 'warning' });
      return;
    }
    if (!importFile) {
      enqueueSnackbar('Selecciona un archivo Excel o CSV', { variant: 'warning' });
      return;
    }
    setImporting(true);
    try {
      const effectiveSubcategoria = baseSeleccionada === 'georreferencia'
        ? GEOREFERENCIA_CANONICAL_SUBBASE
        : subcategoria;
      const response = await gestionInformacionService.importExcel(
        backendCategoria,
        importFile,
        effectiveSubcategoria,
        requiresSubSubBase ? subSubBaseSeleccionada : ''
      );
      enqueueSnackbar(response.message || 'Importacion completada', { variant: 'success' });
      const errores = response?.data?.errores || [];
      if (errores.length > 0) {
        const primerError = errores[0];
        enqueueSnackbar(`Se omitieron ${errores.length} filas. Ejemplo fila ${primerError.fila}: ${primerError.error}`, { variant: 'warning' });
      }
      setImportFile(null);
      await fetchData();
      if (baseSeleccionada === 'poblacional') {
        await fetchSeriesRows();
        const nextSection = POBLACIONAL_SUBBASE_TO_SECTION[subcategoria];
        if (nextSection) {
          setSelectedCard('poblacional');
          setMenuView('estadistica');
          if (REPORT_SECTIONS.some((s) => s.key === nextSection)) {
            setPoblacionalPanel('analytics');
            setStatSection(nextSection);
          } else {
            setPoblacionalPanel(nextSection);
          }
        }
      }
    } catch (error) {
      const backendMessage = error?.response?.data?.message;
      const status = error?.response?.status;
      const fallbackMessage = error?.code === 'ECONNABORTED'
        ? 'La importacion excedio el tiempo de espera. Intenta con un archivo mas pequeno o vuelve a intentar.'
        : (!error?.response
            ? 'No hubo respuesta del servidor durante la importacion. Verifica conexion/API e intenta de nuevo.'
            : `Error al importar (HTTP ${status || 'desconocido'}).`);
      enqueueSnackbar(backendMessage || fallbackMessage, { variant: 'error' });
    } finally {
      setImporting(false);
    }
  };

  const handleClearDataset = async () => {
    if (!isSelectionValid) {
      enqueueSnackbar('Selecciona base y subbase antes de eliminar datos', { variant: 'warning' });
      return;
    }
    setClearCredentials({
      identifier: user?.email || user?.username || '',
      password: ''
    });
    setClearDialogOpen(true);
  };

  const confirmClearDataset = async () => {
    const etiqueta = `${categoria}${subcategoria ? ` / ${subcategoria}` : ''}`;
    if (!clearCredentials.identifier || !clearCredentials.password) {
      enqueueSnackbar('Ingresa usuario/correo y contraseña de administrador', { variant: 'warning' });
      return;
    }
    setClearing(true);
    try {
      const response = await gestionInformacionService.clearCategoria(
        backendCategoria,
        subcategoria,
        requiresSubSubBase ? subSubBaseSeleccionada : '',
        clearCredentials
      );
      enqueueSnackbar(response.message || 'Datos eliminados', { variant: 'success' });
      setClearDialogOpen(false);
      setClearCredentials((prev) => ({ ...prev, password: '' }));
      await fetchData();
      if (baseSeleccionada === 'poblacional') await fetchSeriesRows();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || `Error al eliminar datos de ${etiqueta}`, { variant: 'error' });
    } finally {
      setClearing(false);
    }
  };

  const formatDateTime = (value) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return `${date.toLocaleDateString('es-CO')} ${date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getStatusChip = (row) => {
    const pct = Number(row.porcentaje_cargado || 0);
    if (pct >= 100) return { label: '100% Cargado', sx: { bgcolor: '#dcfce7', color: '#166534' } };
    if (pct > 0) return { label: `${pct.toFixed(2)}% Parcial`, sx: { bgcolor: '#fef3c7', color: '#92400e' } };
    return { label: '0% Fallido', sx: { bgcolor: '#fee2e2', color: '#991b1b' } };
  };

  const groupedCargues = useMemo(() => {
    const normalizeTreeLabel = (value = '') =>
      String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9]+/g, '')
        .toUpperCase();

    const sorted = [...estadisticas].sort((a, b) => {
      const ca = String(a.categoria || '');
      const cb = String(b.categoria || '');
      if (ca !== cb) return ca.localeCompare(cb);
      const sa = String(a.subcategoria || '');
      const sb = String(b.subcategoria || '');
      const oa = SUBBASE_ORDER[sa] || 999;
      const ob = SUBBASE_ORDER[sb] || 999;
      if (oa !== ob) return oa - ob;
      const da = new Date(a.createdAt || a.created_at || 0).getTime();
      const db = new Date(b.createdAt || b.created_at || 0).getTime();
      return db - da;
    });

    const rows = [];
    let lastGroup = '';
    let lastSubgroup = '';
    sorted.forEach((item) => {
      const groupKey = `${item.categoria || 'Sin categoria'}`;
      if (groupKey !== lastGroup) {
        rows.push({
          __group: true,
          id: `group-${groupKey}`,
          label: `${item.categoria || 'Sin categoria'}`
        });
        lastGroup = groupKey;
        lastSubgroup = '';
      }
      const subgroupLabel = String(item.subcategoria || 'General').trim();
      const subgroupKey = `${groupKey}::${subgroupLabel}`;
      const variableLabel = String(item.variable || '').trim();
      const shouldRenderSubgroup = normalizeTreeLabel(subgroupLabel) !== normalizeTreeLabel(variableLabel || subgroupLabel);
      if (shouldRenderSubgroup && subgroupKey !== lastSubgroup) {
        rows.push({
          __subgroup: true,
          id: `subgroup-${subgroupKey}`,
          label: subgroupLabel
        });
        lastSubgroup = subgroupKey;
      } else if (!shouldRenderSubgroup) {
        lastSubgroup = '';
      }
      rows.push({ ...item });
    });
    return rows;
  }, [estadisticas]);

  const normalizeKey = (value) =>
    String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .toUpperCase();

  const contextoListaKeys = new Set(CONTEXTO_EXTERNO_LISTAS.map((item) => normalizeKey(item)));

  const isContextoSublistaRow = (row) =>
    String(row?.categoria || '').toLowerCase() === 'poblacional'
    && String(row?.subcategoria || '').toLowerCase() === 'contexto externo'
    && contextoListaKeys.has(normalizeKey(row?.variable || ''));

  const canExportContextoRow = (row) => isContextoSublistaRow(row);

  const resolveBlobErrorMessage = async (error, fallbackMessage) => {
    try {
      if (error?.code === 'ECONNABORTED' || String(error?.message || '').toLowerCase().includes('timeout')) {
        return 'La exportacion demoro demasiado. Intenta de nuevo; la base es grande y puede tardar varios segundos.';
      }
      const blob = error?.response?.data;
      if (blob && typeof Blob !== 'undefined' && blob instanceof Blob) {
        const text = await blob.text();
        try {
          const parsed = JSON.parse(text);
          return parsed?.message || fallbackMessage;
        } catch (_) {
          return text || fallbackMessage;
        }
      }
      return error?.response?.data?.message || fallbackMessage;
    } catch (_) {
      return fallbackMessage;
    }
  };

  const handleExportContextoNormalizado = async (row) => {
    const variable = row?.variable || '';
    if (!variable) return;
    setExportingContextoRowId(row.id);
    try {
      const response = await gestionInformacionService.downloadContextoExternoNormalizado(variable);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `normalizados_${String(variable).replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar(`Exportacion normalizada lista: ${variable}`, { variant: 'success' });
    } catch (error) {
      const message = await resolveBlobErrorMessage(error, 'Error al exportar normalizados de Contexto Externo');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setExportingContextoRowId(null);
    }
  };

  const canExportErroresRow = (row) => Number(row?.total_omitidos || 0) > 0 && !String(row?.id || '').startsWith('fallback-');

  const handleExportCargueErrores = async (row) => {
    setExportingErroresRowId(row.id);
    try {
      const response = await gestionInformacionService.downloadCargueErrores({
        id: row.id,
        categoria: row.categoria,
        subcategoria: row.subcategoria,
        variable: row.variable
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `errores_${String(row.variable || 'cargue').replace(/\s+/g, '_')}_${row.id}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar('Exportacion de errores lista', { variant: 'success' });
    } catch (error) {
      const message = await resolveBlobErrorMessage(error, 'No se pudo exportar errores del cargue');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setExportingErroresRowId(null);
    }
  };

  const canExportBaseRow = (row) => Boolean(row?.categoria) && row?.categoria !== 'Sin categoria';

  const getCargaTrackingSummary = (row) => {
    try {
      const parsed = JSON.parse(String(row?.detalle || '{}'));
      const limpieza = parsed?.limpieza && typeof parsed.limpieza === 'object' ? parsed.limpieza : null;
      if (!limpieza) return '';
      const total = Number(limpieza.totalCorrecciones || 0);
      const tec = Number(limpieza.tecnicas || 0);
      const dic = Number(limpieza.diccionario || 0);
      const nov = Number(limpieza.novedadesGuardadas || 0);
      return `LIMPIEZA ${total} | TEC ${tec} | DIC ${dic} | NUEVAS ${nov}`;
    } catch (_) {
      return '';
    }
  };

  const handleExportBaseCargada = async (row) => {
    setExportingBaseRowId(row.id);
    try {
      const response = await gestionInformacionService.downloadCargueBase({
        id: String(row?.id || '').startsWith('fallback-') ? '' : row.id,
        categoria: row.categoria,
        subcategoria: row.subcategoria,
        variable: row.variable
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `base_${String(row.variable || row.subcategoria || row.categoria || 'cargada').replace(/\s+/g, '_')}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      enqueueSnackbar('Base cargada exportada', { variant: 'success' });
    } catch (error) {
      const message = await resolveBlobErrorMessage(error, 'No se pudo exportar la base cargada');
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setExportingBaseRowId(null);
    }
  };

  const enterCard = (key) => {
    if (!['poblacional', 'saber_pro', 'recurso_humano', 'gestion_procesos', 'activity_monitor'].includes(key)) {
      enqueueSnackbar('Modulo en construccion. La estructura ya quedo lista para activarlo.', { variant: 'info' });
      return;
    }
    if (key === 'poblacional') {
      resetPoblacionalStatsFilters();
      setStatSection('flujo');
      setPoblacionalPanel('hub');
    }
    if (key === 'saber_pro') {
      setSaberProStatSection('hub');
    }
    if (key === 'gestion_procesos') {
      setGestionProcesosPanel('hub');
    }
    setSelectedCard(key);
  };

  const cloneNodeWithComputedStyles = (node) => {
    const clone = node.cloneNode(true);
    const applyComputedStyles = (source, target) => {
      if (!(source instanceof Element) || !(target instanceof Element)) return;
      const computed = window.getComputedStyle(source);
      let styleText = '';
      if (computed.cssText) {
        styleText = computed.cssText;
      } else {
        styleText = Array.from(computed)
          .map((prop) => `${prop}:${computed.getPropertyValue(prop)};`)
          .join('');
      }
      target.setAttribute('style', styleText);
      const sourceChildren = source.children || [];
      const targetChildren = target.children || [];
      for (let i = 0; i < sourceChildren.length; i += 1) {
        applyComputedStyles(sourceChildren[i], targetChildren[i]);
      }
    };
    applyComputedStyles(node, clone);
    return clone;
  };

  const captureNodeAsPngBlob = async (node, scale = 2) => {
    if (!node) throw new Error('Nodo de grafico no encontrado');
    const rect = node.getBoundingClientRect();
    const width = Math.max(640, Math.round(rect.width));
    const height = Math.max(360, Math.round(rect.height));
    const clonedNode = cloneNodeWithComputedStyles(node);
    const serialized = new XMLSerializer().serializeToString(clonedNode);
    const svgText = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject x="0" y="0" width="100%" height="100%">
          <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:#ffffff;overflow:hidden;">
            ${serialized}
          </div>
        </foreignObject>
      </svg>
    `;
    const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = width * scale;
        canvas.height = height * scale;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(svgUrl);
          reject(new Error('No fue posible crear canvas'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(scale, scale);
        ctx.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(svgUrl);
        try {
          canvas.toBlob((blob) => {
            if (!blob) {
              reject(new Error('No fue posible exportar el grafico'));
              return;
            }
            resolve(blob);
          }, 'image/png');
        } catch (err) {
          reject(err);
        }
      };
      img.onerror = () => {
        URL.revokeObjectURL(svgUrl);
        reject(new Error('Error al renderizar la imagen del grafico'));
      };
      img.src = svgUrl;
    });
  };

  const capturePoblacionalSeriesAsPngBlob = async () => {
    if (!activeSection || !Array.isArray(activeSeries) || activeSeries.length === 0) {
      throw new Error('Sin datos para exportar');
    }
    const sectionKey = activeSection.key;
    if (!['flujo', 'matriculados', 'graduados'].includes(sectionKey)) {
      throw new Error('Tipo de grafico no soportado para exportacion directa');
    }

    const width = Math.max(980, 220 + activeSeries.length * 72);
    const height = sectionKey === 'flujo' ? 500 : 560;
    const margin = sectionKey === 'flujo'
      ? { top: 44, right: 34, bottom: 116, left: 12 }
      : { top: 76, right: 40, bottom: 96, left: 74 };
    const chartWidth = width - margin.left - margin.right;
    const chartHeight = height - margin.top - margin.bottom;

    const canvas = document.createElement('canvas');
    canvas.width = width * 2;
    canvas.height = height * 2;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No fue posible crear canvas');
    ctx.scale(2, 2);

    const toPeriod = (label = '') => {
      const [year = label, slot = ''] = String(label).split('-');
      if (slot === '1') return `${year}-I`;
      if (slot === '2') return `${year}-II`;
      return String(label);
    };

    const roundRect = (x, y, w, h, r = 8, fill = null, stroke = null) => {
      const radius = Math.min(r, w / 2, h / 2);
      ctx.beginPath();
      ctx.moveTo(x + radius, y);
      ctx.arcTo(x + w, y, x + w, y + h, radius);
      ctx.arcTo(x + w, y + h, x, y + h, radius);
      ctx.arcTo(x, y + h, x, y, radius);
      ctx.arcTo(x, y, x + w, y, radius);
      if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
      }
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.stroke();
      }
    };

    ctx.fillStyle = '#f5f7fb';
    ctx.fillRect(0, 0, width, height);

    if (sectionKey === 'flujo') {
      const chips = [
        { label: 'Inscritos', bg: '#e3e5ff', fg: '#3b3fbf' },
        { label: 'Admitidos', bg: '#fee2e2', fg: '#b91c1c' },
        { label: 'Primer Curso', bg: '#e5e7eb', fg: '#374151' }
      ];
      let chipX = margin.left + 8;
      chips.forEach((chip) => {
        const w = chip.label.length * 7.2 + 22;
        roundRect(chipX, 14, w, 24, 12, chip.bg);
        ctx.fillStyle = chip.fg;
        ctx.font = '700 13px Arial';
        ctx.fillText(chip.label, chipX + 11, 30);
        chipX += w + 10;
      });
    } else {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 22px Arial';
      ctx.fillText(activeSection.title || 'Grafico poblacional', margin.left, 38);
      ctx.fillStyle = '#475569';
      ctx.font = '400 13px Arial';
      ctx.fillText('Exportacion de grafico para analisis institucional', margin.left, 58);
    }

    const axisBottom = margin.top + chartHeight;
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(margin.left, margin.top);
    ctx.lineTo(margin.left, axisBottom);
    ctx.lineTo(margin.left + chartWidth, axisBottom);
    ctx.stroke();

    const values = activeSeries.map((row) => {
      if (sectionKey === 'flujo') {
        return normalizeNumber(row.inscritos) + normalizeNumber(row.admitidos) + normalizeNumber(row.primerCurso);
      }
      if (sectionKey === 'matriculados') return normalizeNumber(row.matriculados);
      return normalizeNumber(row.graduados);
    });
    const maxVal = Math.max(...values, 1);

    const ticks = 4;
    for (let i = 0; i <= ticks; i += 1) {
      const y = margin.top + (chartHeight / ticks) * i;
      ctx.strokeStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.moveTo(margin.left, y);
      ctx.lineTo(margin.left + chartWidth, y);
      ctx.stroke();
      if (sectionKey !== 'flujo') {
        const value = Math.round(maxVal * (1 - i / ticks));
        ctx.fillStyle = '#64748b';
        ctx.font = '11px Arial';
        ctx.fillText(String(value.toLocaleString('es-CO')), 8, y + 4);
      }
    }

    const step = chartWidth / Math.max(activeSeries.length, 1);
    const barW = sectionKey === 'flujo'
      ? Math.max(22, Math.min(52, step * 0.72))
      : Math.max(18, Math.min(40, step * 0.56));
    activeSeries.forEach((row, idx) => {
      const x = margin.left + step * idx + (step - barW) / 2;
      const period = toPeriod(row.periodLabel);
      if (sectionKey === 'flujo') {
        const parts = [
          { v: normalizeNumber(row.inscritos), c: '#3b3fbf' },
          { v: normalizeNumber(row.admitidos), c: '#b91c1c' },
          { v: normalizeNumber(row.primerCurso), c: '#6b7280' }
        ];
        let yCursor = axisBottom;
        parts.forEach((part) => {
          const h = Math.max(1, (part.v / maxVal) * chartHeight);
          yCursor -= h;
          if (part === parts[0]) {
            roundRect(x, yCursor, barW, h, 0, part.c);
          } else if (part === parts[2]) {
            roundRect(x, yCursor, barW, h, 8, part.c);
          } else {
            ctx.fillStyle = part.c;
            ctx.fillRect(x, yCursor, barW, h);
          }

          if (h > 20) {
            ctx.fillStyle = '#ffffff';
            ctx.font = '700 14px Arial';
            const txt = formatNumber(part.v);
            const tw = ctx.measureText(txt).width;
            ctx.fillText(txt, x + (barW - tw) / 2, yCursor + (h / 2) + 5);
          }
        });

        const [yearRaw = '', slotRaw = ''] = String(row.periodLabel || '').split('-');
        const slot = slotRaw === '2' ? 'II' : 'I';
        roundRect(x + (barW / 2) - 14, axisBottom + 8, 28, 18, 9, '#e2e8f0');
        ctx.fillStyle = '#334155';
        ctx.font = '700 11px Arial';
        const sw = ctx.measureText(slot).width;
        ctx.fillText(slot, x + (barW / 2) - (sw / 2), axisBottom + 21);
        roundRect(x - 12, axisBottom + 30, barW + 24, 28, 0, '#f1f5f9', '#94a3b8');
        ctx.fillStyle = '#0f172a';
        ctx.font = '700 12px Arial';
        const yw = ctx.measureText(yearRaw).width;
        ctx.fillText(yearRaw, x + (barW / 2) - (yw / 2), axisBottom + 48);
      } else {
        const v = sectionKey === 'matriculados' ? normalizeNumber(row.matriculados) : normalizeNumber(row.graduados);
        const h = Math.max(1, (v / maxVal) * chartHeight);
        ctx.fillStyle = sectionKey === 'matriculados' ? '#4338ca' : '#0f766e';
        ctx.fillRect(x, axisBottom - h, barW, h);
      }
      if (sectionKey !== 'flujo') {
        ctx.fillStyle = '#334155';
        ctx.font = '10px Arial';
        ctx.save();
        ctx.translate(x + barW / 2, axisBottom + 10);
        ctx.rotate(-Math.PI / 6);
        ctx.fillText(period, 0, 0);
        ctx.restore();
      }
    });

    if (sectionKey !== 'flujo') {
      const legend = [
        { l: 'Inscritos', c: '#3b3fbf' },
        { l: 'Admitidos', c: '#b91c1c' },
        { l: 'Primer Curso', c: '#6b7280' }
      ];
      legend.forEach((item, i) => {
        const lx = margin.left + i * 150;
        const ly = height - 28;
        ctx.fillStyle = item.c;
        ctx.fillRect(lx, ly - 10, 12, 12);
        ctx.fillStyle = '#334155';
        ctx.font = '12px Arial';
        ctx.fillText(item.l, lx + 18, ly);
      });
    }

    return new Promise((resolve, reject) => {
      try {
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('No fue posible exportar el grafico'));
            return;
          }
          resolve(blob);
        }, 'image/png');
      } catch (err) {
        reject(err);
      }
    });
  };

  const handleDownloadPoblacionalChart = async () => {
    try {
      const node = poblacionalChartRef.current;
      if (!node) {
        enqueueSnackbar('No se encontro el grafico para descargar', { variant: 'warning' });
        return;
      }
      let blob;
      try {
        blob = await captureNodeAsPngBlob(node, 2);
      } catch (_) {
        blob = await capturePoblacionalSeriesAsPngBlob();
      }
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `grafico_${activeSection?.key || 'poblacional'}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
      enqueueSnackbar('Grafico descargado', { variant: 'success' });
    } catch (_) {
      enqueueSnackbar('No fue posible descargar el grafico', { variant: 'error' });
    }
  };

  const handleCopyPoblacionalChart = async () => {
    try {
      const node = poblacionalChartRef.current;
      if (!node) {
        enqueueSnackbar('No se encontro el grafico para copiar', { variant: 'warning' });
        return;
      }
      let blob;
      try {
        blob = await captureNodeAsPngBlob(node, 2);
      } catch (_) {
        blob = await capturePoblacionalSeriesAsPngBlob();
      }
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        enqueueSnackbar('Grafico copiado al portapapeles', { variant: 'success' });
        return;
      }
      enqueueSnackbar('Tu navegador no permite copiar imagen. Usa Descargar.', { variant: 'info' });
    } catch (_) {
      enqueueSnackbar('No fue posible copiar el grafico', { variant: 'error' });
    }
  };

  const handleExpandPoblacionalChart = async () => {
    try {
      const node = poblacionalChartRef.current;
      if (!node) {
        enqueueSnackbar('No se encontro el grafico para ampliar', { variant: 'warning' });
        return;
      }
      if (document.fullscreenElement) {
        await document.exitFullscreen();
        return;
      }
      if (node.requestFullscreen) {
        await node.requestFullscreen();
        return;
      }
      enqueueSnackbar('Tu navegador no soporta modo pantalla completa', { variant: 'info' });
    } catch (_) {
      enqueueSnackbar('No fue posible ampliar el grafico', { variant: 'error' });
    }
  };

  const handleCopyAnalysisText = async () => {
    try {
      const text = String(activeSection.key === 'matriculados' ? matriculadosAnalysisText : automaticChartAnalysis || '').trim();
      if (!text) {
        enqueueSnackbar('No hay texto de analisis para copiar', { variant: 'warning' });
        return;
      }
      if (!navigator.clipboard?.writeText) {
        enqueueSnackbar('Tu navegador no permite copiar texto automaticamente', { variant: 'info' });
        return;
      }
      await navigator.clipboard.writeText(text);
      enqueueSnackbar('Analisis copiado al portapapeles', { variant: 'success' });
    } catch (_) {
      enqueueSnackbar('No fue posible copiar el analisis', { variant: 'error' });
    }
  };

  const handleDownloadFlujoRatesTable = () => {
    try {
      if (!flujoProgramMetrics.length) {
        enqueueSnackbar('No hay datos para descargar la tabla', { variant: 'warning' });
        return;
      }
      const rowsHtml = flujoProgramMetrics.map((item) => (
        `<tr>
          <td>${escapeHtml(item.programa)}</td>
          <td style="mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${normalizeNumber(item.inscritos)}</td>
          <td style="mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${normalizeNumber(item.admitidos)}</td>
          <td style="mso-number-format:'\\#\\,\\#\\#0'; text-align:right;">${normalizeNumber(item.primerCurso)}</td>
          <td style="mso-number-format:'0\\.00'; text-align:right;">${item.tasaSelectividad === null ? '' : (item.tasaSelectividad * 100).toFixed(2)}</td>
          <td style="mso-number-format:'0\\.00'; text-align:right;">${item.tasaAbsorcion === null ? '' : (item.tasaAbsorcion * 100).toFixed(2)}</td>
        </tr>`
      )).join('');
      const html = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta charset="UTF-8" />
          </head>
          <body>
            <table border="1">
              <thead>
                <tr>
                  <th>PROGRAMA</th>
                  <th>INSCRITOS</th>
                  <th>ADMITIDOS</th>
                  <th>PRIMER_CURSO</th>
                  <th>TASA_SELECTIVIDAD_PCT</th>
                  <th>TASA_ABSORCION_PCT</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </body>
        </html>
      `;
      const blob = new Blob([`\uFEFF${html}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `tabla_tasas_ingreso_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Tabla descargada en Excel', { variant: 'success' });
    } catch (_) {
      enqueueSnackbar('No fue posible descargar la tabla', { variant: 'error' });
    }
  };

  const handleDownloadResumenEstadisticoTable = () => {
    try {
      const studentSheet = resumenEstadisticoWorkbookSheets.find((sheet) => sheet.key === 'estudiantes');
      if (!studentSheet || !studentSheet.rows.length) {
        enqueueSnackbar('No hay datos para descargar el cuadro maestro', { variant: 'warning' });
        return;
      }
      const workbookXml = `<?xml version="1.0"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Default"><Alignment ss:Vertical="Center"/><Font ss:FontName="Calibri" ss:Size="11"/></Style>
    <Style ss:ID="title"><Font ss:Bold="1" ss:Size="14"/><Interior ss:Color="#EAF1FB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="header"><Font ss:Bold="1"/><Interior ss:Color="#EEF2F7" ss:Pattern="Solid"/></Style>
    <Style ss:ID="number"><NumberFormat ss:Format="Standard"/></Style>
  </Styles>
  ${resumenEstadisticoWorkbookSheets.map((sheet) => {
    const headerCells = sheet.columns.map((column) => `<Cell ss:StyleID="header"><Data ss:Type="String">${escapeXml(column)}</Data></Cell>`).join('');
    const dataRows = sheet.rows.map((row) => `
      <Row>
        ${row.map((cell) => {
          const asNumber = typeof cell === 'number' && Number.isFinite(cell);
          return `<Cell${asNumber ? ' ss:StyleID="number"' : ''}><Data ss:Type="${asNumber ? 'Number' : 'String'}">${escapeXml(asNumber ? String(cell) : String(cell ?? ''))}</Data></Cell>`;
        }).join('')}
      </Row>`).join('');
    const footerRow = Array.isArray(sheet.footer) ? `
      <Row>
        ${sheet.footer.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(String(cell ?? ''))}</Data></Cell>`).join('')}
      </Row>` : '';
    return `
    <Worksheet ss:Name="${escapeXml(sheet.title.slice(0, 30))}">
      <Table>
        <Row><Cell ss:StyleID="title"><Data ss:Type="String">${escapeXml(`Cuadros Maestros - ${sheet.title}`)}</Data></Cell></Row>
        <Row><Cell><Data ss:Type="String">${escapeXml(`Programa: ${resumenEstadisticoUi.programa || 'Todos los programas'}`)}</Data></Cell></Row>
        <Row>${headerCells}</Row>
        ${dataRows}
        ${footerRow}
      </Table>
    </Worksheet>`;
  }).join('')}
</Workbook>`;
      const blob = new Blob([`\uFEFF${workbookXml}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `cuadros_maestros_${(resumenEstadisticoUi.programa || 'todos').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      enqueueSnackbar('Cuadros Maestros descargados en Excel', { variant: 'success' });
    } catch (_) {
      enqueueSnackbar('No fue posible descargar los cuadros maestros', { variant: 'error' });
    }
  };

  const renderSimpleBars = (series, accessor, color, options = {}) => {
    const compact = Boolean(options.compact);
    const center = Boolean(options.center);
    const max = Math.max(...series.map((row) => normalizeNumber(row[accessor])), 0);
    const barWidth = compact
      ? (series.length > 18 ? 40 : 46)
      : (series.length > 18 ? 52 : 60);
    const colGap = compact
      ? (series.length > 18 ? 8 : 10)
      : (series.length > 18 ? 10 : 12);
    const chartHeight = compact ? 236 : 280;
    const drawableHeight = compact ? 200 : 240;
    const yearGroups = getYearGroups(series);
    const yTicks = buildYAxisTicks(max, 4);
    const computedMinWidth = center
      ? undefined
      : Math.max(compact ? 660 : 760, series.length * (barWidth + colGap) + (compact ? 120 : 140));
    return (
      <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
        <Box sx={{ minWidth: computedMinWidth, px: compact ? 0.8 : 1.2 }}>
          <Box sx={{ position: 'relative' }}>
            {yTicks.map((tick, index) => (
              <Box
                key={`grid-${accessor}-${index}`}
                sx={{
                  position: 'absolute',
                  top: tick.top,
                  left: 0,
                  right: 0,
                  borderTop: '1px dashed #dbeafe',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
            ))}
            <Box
              sx={{
                height: chartHeight,
                borderLeft: '1px solid #cbd5e1',
                borderBottom: '1px solid #cbd5e1',
                display: 'grid',
                gridTemplateColumns: `repeat(${series.length}, ${barWidth}px)`,
                columnGap: `${colGap}px`,
                alignItems: 'end',
                px: compact ? 1 : 1.6,
                position: 'relative',
                justifyContent: center ? 'center' : 'start'
              }}
            >
            {series.map((row) => {
              const value = normalizeNumber(row[accessor]);
              const height = max > 0 ? Math.max(2, (value / max) * drawableHeight) : 0;
              const canShowInsideLabel = height >= (compact ? 30 : 34);
              return (
                <Box key={row.periodLabel} sx={{ textAlign: 'center' }}>
                  <Box
                    title={`${row.periodLabel}: ${formatNumber(value)}`}
                    sx={{
                      position: 'relative',
                      overflow: 'visible',
                      height,
                      minHeight: height > 0 ? 8 : 0,
                      borderRadius: compact ? '10px 10px 0 0' : '12px 12px 0 0',
                      bgcolor: color,
                      boxShadow: compact ? `0 8px 14px -12px ${color}` : `0 10px 18px -14px ${color}`,
                      border: '1px solid rgba(255,255,255,0.14)',
                      borderBottom: 'none',
                      transition: 'all .25s ease',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      px: 0.4
                    }}
                  >
                    {canShowInsideLabel && (
                      <Typography
                        sx={{
                          color: '#ffffff',
                          fontWeight: 900,
                          fontSize: compact ? { xs: 11, md: 13 } : { xs: 12, md: 15 },
                          lineHeight: 1,
                          textShadow: '0 1px 2px rgba(0,0,0,.35)',
                          letterSpacing: '-0.02em'
                        }}
                      >
                        {formatNumber(value)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
            </Box>
          </Box>
          <Box sx={{ mt: compact ? 0.6 : 0.8, px: compact ? 1 : 1.6 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${series.length}, ${barWidth}px)`,
                columnGap: `${colGap}px`,
                justifyContent: center ? 'center' : 'start'
              }}
            >
              {series.map((row) => (
                <Box key={`p-${row.periodLabel}`} sx={{ display: 'grid', placeItems: 'center', justifySelf: 'center' }}>
                  <Box sx={{ minWidth: compact ? 24 : 28, px: compact ? 0.55 : 0.7, py: 0.15, borderRadius: 999, bgcolor: '#e2e8f0', color: '#334155' }}>
                    <Typography variant="caption" sx={{ textAlign: 'center', fontWeight: 800, display: 'block' }}>
                      {splitPeriodLabel(row.periodLabel).part}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${series.length}, ${barWidth}px)`,
                columnGap: `${colGap}px`,
                mt: 0.3,
                justifyContent: center ? 'center' : 'start'
              }}
            >
              {yearGroups.map((group) => (
                <Box
                  key={`y-${group.year}-${group.start}`}
                  sx={{
                    gridColumn: `${group.start + 1} / ${group.end + 2}`,
                    border: '1px solid #94a3b8',
                    py: compact ? 0.22 : 0.3,
                    textAlign: 'center',
                    bgcolor: '#f8fafc'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>{group.year}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderRecursoHumanoStatsModule = () => (
    <RecursoHumanoDashboard />
  );

  const renderStackedBars = (series) => {
    const max = Math.max(...series.map((row) => row.inscritos + row.admitidos + row.primerCurso), 0);
    const colors = { inscritos: '#3b3fbf', admitidos: '#b91c1c', primerCurso: '#6b7280' };
    const barWidth = series.length > 18 ? 46 : 54;
    const colGap = series.length > 18 ? 10 : 14;
    const estimateHeights = series.map((row) => {
      const total = row.inscritos + row.admitidos + row.primerCurso;
      const projectedTotalHeight = max > 0 ? Math.max(2, (total / max) * 300) : 0;
      return {
        hIns: total > 0 ? (row.inscritos / total) * projectedTotalHeight : 0,
        hAdm: total > 0 ? (row.admitidos / total) * projectedTotalHeight : 0,
        hPri: total > 0 ? (row.primerCurso / total) * projectedTotalHeight : 0
      };
    });
    const hiddenSegmentsCount = estimateHeights.reduce((acc, h) => {
      const hidden = [h.hIns, h.hAdm, h.hPri].filter((v) => v > 0 && v <= 20).length;
      return acc + hidden;
    }, 0);
    const extraHeight = Math.min(220, hiddenSegmentsCount * 8);
    const chartHeight = 340 + extraHeight;
    const drawableHeight = 300 + extraHeight;
    const yearGroups = getYearGroups(series);
    const yTicks = buildYAxisTicks(max, 4);
    return (
      <Box sx={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', pb: 1 }}>
        <Box sx={{ minWidth: Math.max(760, series.length * (barWidth + colGap) + 120), px: 1.2 }}>
          <Stack direction="row" spacing={1} sx={{ mb: 1.2 }}>
            <Chip size="small" label="Inscritos" sx={{ bgcolor: '#e3e5ff', color: '#3b3fbf' }} />
            <Chip size="small" label="Admitidos" sx={{ bgcolor: '#fee2e2', color: '#b91c1c' }} />
            <Chip size="small" label="Primer Curso" sx={{ bgcolor: '#e5e7eb', color: '#374151' }} />
          </Stack>
          <Box sx={{ position: 'relative' }}>
            {yTicks.map((tick, index) => (
              <Box
                key={`grid-flujo-${index}`}
                sx={{
                  position: 'absolute',
                  top: tick.top,
                  left: 0,
                  right: 0,
                  borderTop: '1px dashed #dbeafe',
                  transform: 'translateY(-50%)',
                  pointerEvents: 'none'
                }}
              />
            ))}
            <Box
              sx={{
                height: chartHeight,
                borderLeft: '1px solid #cbd5e1',
                borderBottom: '1px solid #cbd5e1',
                display: 'grid',
                gridTemplateColumns: `repeat(${series.length}, ${barWidth}px)`,
                columnGap: `${colGap}px`,
                alignItems: 'end',
                px: 1.6,
                position: 'relative',
                justifyContent: 'start'
              }}
            >
            {series.map((row) => {
              const total = row.inscritos + row.admitidos + row.primerCurso;
              const totalHeight = max > 0 ? Math.max(2, (total / max) * drawableHeight) : 0;
              const hIns = total > 0 ? (row.inscritos / total) * totalHeight : 0;
              const hAdm = total > 0 ? (row.admitidos / total) * totalHeight : 0;
              const hPri = total > 0 ? (row.primerCurso / total) * totalHeight : 0;
              return (
                <Box key={row.periodLabel} sx={{ textAlign: 'center' }}>
                  <Tooltip
                    arrow
                    placement="top"
                    title={
                      <Box sx={{ p: 0.2 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 12 }}>{row.periodLabel}</Typography>
                        <Typography sx={{ fontSize: 12 }}>Inscritos: {formatNumber(row.inscritos)}</Typography>
                        <Typography sx={{ fontSize: 12 }}>Admitidos: {formatNumber(row.admitidos)}</Typography>
                        <Typography sx={{ fontSize: 12 }}>Primer curso: {formatNumber(row.primerCurso)}</Typography>
                        <Typography sx={{ fontSize: 12, fontWeight: 900 }}>Total: {formatNumber(total)}</Typography>
                      </Box>
                    }
                  >
                    <Box sx={{ position: 'relative', display: 'flex', flexDirection: 'column-reverse', height: totalHeight, borderRadius: '8px 8px 0 0', overflow: 'hidden' }}>
                    <Box sx={{ position: 'relative', height: hIns, bgcolor: colors.inscritos, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {hIns > 20 && (
                        <Typography
                          sx={{
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: { xs: 12, md: 15 },
                            lineHeight: 1,
                            textShadow: '0 1px 2px rgba(0,0,0,.35)',
                            letterSpacing: '-0.02em'
                          }}
                        >
                          {formatNumber(row.inscritos)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ position: 'relative', height: hAdm, bgcolor: colors.admitidos, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {hAdm > 20 && (
                        <Typography
                          sx={{
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: { xs: 12, md: 15 },
                            lineHeight: 1,
                            textShadow: '0 1px 2px rgba(0,0,0,.35)',
                            letterSpacing: '-0.02em'
                          }}
                        >
                          {formatNumber(row.admitidos)}
                        </Typography>
                      )}
                    </Box>
                    <Box sx={{ position: 'relative', height: hPri, bgcolor: colors.primerCurso, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {hPri > 20 && (
                        <Typography
                          sx={{
                            color: '#fff',
                            fontWeight: 900,
                            fontSize: { xs: 12, md: 15 },
                            lineHeight: 1,
                            textShadow: '0 1px 2px rgba(0,0,0,.35)',
                            letterSpacing: '-0.02em'
                          }}
                        >
                          {formatNumber(row.primerCurso)}
                        </Typography>
                      )}
                    </Box>
                    {totalHeight > 0 && (
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: -18,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          color: '#0f172a',
                          fontWeight: 900,
                          fontSize: { xs: 10, md: 12 },
                          lineHeight: 1,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {formatNumber(total)}
                      </Typography>
                    )}
                    </Box>
                  </Tooltip>
                </Box>
              );
            })}
            </Box>
          </Box>
          <Box sx={{ mt: 0.8, px: 1.6 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${series.length}, ${barWidth}px)`,
                columnGap: `${colGap}px`,
                justifyContent: 'start'
              }}
            >
              {series.map((row) => (
                <Box key={`p-${row.periodLabel}`} sx={{ display: 'grid', placeItems: 'center', justifySelf: 'center' }}>
                  <Box sx={{ minWidth: 28, px: 0.7, py: 0.15, borderRadius: 999, bgcolor: '#e2e8f0', color: '#334155' }}>
                    <Typography variant="caption" sx={{ textAlign: 'center', fontWeight: 800, display: 'block' }}>
                      {splitPeriodLabel(row.periodLabel).part}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: `repeat(${series.length}, ${barWidth}px)`,
                columnGap: `${colGap}px`,
                mt: 0.3,
                justifyContent: 'start'
              }}
            >
              {yearGroups.map((group) => (
                <Box
                  key={`y-${group.year}-${group.start}`}
                  sx={{
                    gridColumn: `${group.start + 1} / ${group.end + 2}`,
                    border: '1px solid #94a3b8',
                    py: 0.3,
                    textAlign: 'center',
                    bgcolor: '#f8fafc'
                  }}
                >
                  <Typography variant="caption" sx={{ fontWeight: 700, color: '#0f172a' }}>{group.year}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderFlujoProgramTables = () => {
    if (activeSection.key !== 'flujo') return null;
    return (
      <Paper
        elevation={0}
        sx={{
          mt: 1.2,
          p: 0,
          borderRadius: 3,
          border: '1px solid #cfe0f9',
          bgcolor: '#fff',
          overflow: 'hidden'
        }}
      >
        <Box sx={{ px: 1.6, py: 1.2, background: 'linear-gradient(135deg, #0f2f57 0%, #1d4f8c 45%, #2d6bb6 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: 16.2, letterSpacing: 0.2 }}>Tasas de ingreso por programa</Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)' }}>
                Selectividad = Admitidos / Inscritos | Absorcion = Primer Curso / Admitidos
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => {
                  setFlujoTableYearsFilter([]);
                  setFlujoTableAcademicPeriodsFilter([]);
                  setFlujoTableLevelFilter('todos');
                }}
                sx={{
                  minWidth: { xs: '100%', md: 172 },
                  height: 40,
                  borderRadius: 1.4,
                  borderColor: 'rgba(191,219,254,.95)',
                  color: '#dbeafe',
                  bgcolor: 'rgba(15,23,42,.18)',
                  textTransform: 'none',
                  fontWeight: 800,
                  '&:hover': {
                    borderColor: '#dbeafe',
                    bgcolor: 'rgba(15,23,42,.3)'
                  }
                }}
              >
                Restablecer filtros
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<DownloadIconSmall />}
                onClick={handleDownloadFlujoRatesTable}
                sx={{
                  minWidth: { xs: '100%', md: 220 },
                  height: 40,
                  borderRadius: 1.4,
                  borderColor: 'rgba(191,219,254,.95)',
                  color: '#dbeafe',
                  bgcolor: 'rgba(15,23,42,.18)',
                  textTransform: 'none',
                  fontWeight: 800,
                  '&:hover': {
                    borderColor: '#dbeafe',
                    bgcolor: 'rgba(15,23,42,.3)'
                  }
                }}
              >
                Descargar tabla
              </Button>
            </Stack>
          </Stack>
        </Box>
        <Box sx={{ p: { xs: 1.2, sm: 1.5, md: 1.8 } }}>
          <Box
            sx={{
              mb: 1.2,
              px: { xs: 1, sm: 1.2 },
              py: 0.85,
              borderRadius: 1.6,
              bgcolor: '#f8fbff',
              border: '1px solid #dbeafe'
            }}
          >
            <Typography variant="body2" sx={{ color: '#475569', fontWeight: 600, fontSize: { xs: 12.5, sm: 13 } }}>
              Tabla general con segmentación por nivel académico.
            </Typography>
          </Box>
          <Box
            sx={{
              mb: 1.1,
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
              gap: 1.4
            }}
          >
            <Box>
              <FormControl size="small" fullWidth>
                <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>{'A\u00f1o'}</Typography>
                <Select
                multiple
                displayEmpty
                value={flujoTableYearsFilter}
                onChange={(e) => handleFlujoTableYearsChange(e.target.value, flujoTableYearOptions)}
                renderValue={(selected) => {
                  const allSelected = flujoTableYearOptions.length > 0 && selected.length === flujoTableYearOptions.length;
                  return !selected.length || allSelected ? 'A\u00f1o: Todos' : ('A\u00f1o: ' + selected.length + ' seleccionados');
                }}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
                sx={GI_FILTER_SELECT_SX}
              >
                <MenuItem value="__ALL__">
                  <Checkbox checked={flujoTableYearOptions.length > 0 && flujoTableYearsFilter.length === flujoTableYearOptions.length} size="small" />
                  <ListItemText primary="Seleccionar todos" />
                </MenuItem>
                {flujoTableYearOptions.map((anio) => (
                  <MenuItem value={anio} key={anio}>
                    <Checkbox checked={flujoTableYearsFilter.includes(anio)} size="small" />
                    <ListItemText primary={anio} />
                  </MenuItem>
                ))}
              </Select>
              </FormControl>
            </Box>
            <Box>
              <FormControl size="small" fullWidth>
                <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>Período académico</Typography>
                <Select
                multiple
                displayEmpty
                value={flujoTableAcademicPeriodsFilter}
                onChange={(e) => handleFlujoTableAcademicPeriodsChange(e.target.value, flujoTableAcademicPeriodOptions)}
                renderValue={(selected) => {
                  const allSelected = flujoTableAcademicPeriodOptions.length > 0 && selected.length === flujoTableAcademicPeriodOptions.length;
                  return !selected.length || allSelected
                    ? 'Período académico: Todos'
                    : `Período académico: ${selected.map((p) => (p === '1' ? 'I' : 'II')).join(', ')}`;
                }}
                MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
                sx={GI_FILTER_SELECT_SX}
              >
                <MenuItem value="__ALL__">
                  <Checkbox checked={flujoTableAcademicPeriodOptions.length > 0 && flujoTableAcademicPeriodsFilter.length === flujoTableAcademicPeriodOptions.length} size="small" />
                  <ListItemText primary="Seleccionar todos" />
                </MenuItem>
                {flujoTableAcademicPeriodOptions.map((period) => (
                  <MenuItem value={period} key={period}>
                    <Checkbox checked={flujoTableAcademicPeriodsFilter.includes(period)} size="small" />
                    <ListItemText primary={period === '1' ? 'Periodo I' : 'Periodo II'} />
                  </MenuItem>
                ))}
              </Select>
              </FormControl>
            </Box>
          </Box>
          <Box sx={{ mb: 1.3 }}>
            <Box>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={flujoTableLevelFilter === 'todos' ? null : flujoTableLevelFilter}
                onChange={(_, nextValue) => setFlujoTableLevelFilter(nextValue || 'todos')}
                sx={GI_SEGMENTED_SX}
              >
                <ToggleButton
                  value="pregrado"
                  sx={{
                    borderTopLeftRadius: 999,
                    borderBottomLeftRadius: 999
                  }}
                >
                  Pregrado
                </ToggleButton>
                <ToggleButton
                  value="postgrado"
                  sx={{
                    borderTopRightRadius: 999,
                    borderBottomRightRadius: 999
                  }}
                >
                  Posgrado
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>
        <Stack direction="row" spacing={0.8} useFlexGap flexWrap="wrap" sx={{ mb: 1.1 }}>
          <Chip
            size="small"
            label={flujoTableYearsFilter.length ? `Años: ${flujoTableYearsFilter.join(', ')}` : 'Años: Todos'}
            sx={{ bgcolor: '#eef2ff', color: '#3730a3', fontWeight: 700 }}
          />
          <Chip
            size="small"
            label={
              flujoTableAcademicPeriodsFilter.length
                ? `Periodos (tabla): ${flujoTableAcademicPeriodsFilter.map((p) => (p === '1' ? 'I' : 'II')).join(', ')}`
                : 'Periodos: Todos'
            }
            sx={{ bgcolor: '#fff7ed', color: '#9a3412', fontWeight: 700 }}
          />
          <Chip
            size="small"
            label={
              flujoTableLevelFilter === 'pregrado'
                ? 'Segmentación: Pregrado'
                : flujoTableLevelFilter === 'postgrado'
                  ? 'Segmentación: Posgrado'
                  : 'Segmentación: Todos'
            }
            sx={{ bgcolor: '#ecfeff', color: '#155e75', fontWeight: 700 }}
          />
        </Stack>

        <Grid container spacing={1.6}>
          <Grid item xs={12}>
            <TableContainer
              sx={{
                border: '1px solid #dbe6f5',
                borderRadius: 2.2,
                boxShadow: '0 10px 24px rgba(15,23,42,.05)',
                overflowX: 'auto',
                '&::-webkit-scrollbar': { height: 8 },
                '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: 8 }
              }}
            >
              <Table
                size="small"
                sx={{
                  minWidth: 840,
                  tableLayout: 'fixed',
                  '& .MuiTableCell-root': { py: 1, borderColor: '#e6edf8' }
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 900, fontSize: 12.5, width: '30%', bgcolor: '#eff6ff', color: '#1e3a8a', letterSpacing: 0.2, textTransform: 'uppercase' }}>PROGRAMA</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, fontSize: 12, width: '14%', bgcolor: '#eff6ff', color: '#1e3a8a', letterSpacing: 0.2, textTransform: 'uppercase' }}>INSCRITOS</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, fontSize: 12, width: '14%', bgcolor: '#eff6ff', color: '#1e3a8a', letterSpacing: 0.2, textTransform: 'uppercase' }}>ADMITIDOS</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, fontSize: 12, width: '14%', bgcolor: '#eff6ff', color: '#1e3a8a', letterSpacing: 0.2, textTransform: 'uppercase' }}>PRIMER CURSO</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, fontSize: 12, width: '14%', bgcolor: '#eff6ff', color: '#1e3a8a', letterSpacing: 0.2, textTransform: 'uppercase' }}>SELECTIVIDAD %</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, fontSize: 12, width: '14%', bgcolor: '#eff6ff', color: '#1e3a8a', letterSpacing: 0.2, textTransform: 'uppercase' }}>ABSORCIÁ“N %</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {flujoProgramMetrics.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} sx={{ color: '#64748b' }}>Sin datos para los filtros actuales.</TableCell>
                    </TableRow>
                  )}
                  {flujoProgramMetrics.map((item, index) => (
                    <TableRow
                      key={`tasas-${item.programa}`}
                      sx={{
                        bgcolor: index % 2 === 0 ? '#fbfdff' : '#ffffff',
                        '&:hover': { bgcolor: '#f1f5f9' }
                      }}
                    >
                      <TableCell sx={{ fontSize: 11.5, fontWeight: 700, textTransform: 'uppercase' }}>
                        {String(item.programa || '-').toLocaleUpperCase('es-CO')}
                      </TableCell>
                      <TableCell align="right" sx={{ fontSize: 11.5 }}>{formatNumber(item.inscritos)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 11.5 }}>{formatNumber(item.admitidos)}</TableCell>
                      <TableCell align="right" sx={{ fontSize: 11.5 }}>{formatNumber(item.primerCurso)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11.5 }}>
                        {item.tasaSelectividad === null ? '-' : `${(item.tasaSelectividad * 100).toFixed(2)}%`}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800, fontSize: 11.5 }}>
                        {item.tasaAbsorcion === null ? '-' : `${(item.tasaAbsorcion * 100).toFixed(2)}%`}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>

        </Grid>
        </Box>
      </Paper>
    );
  };

  const renderFlujoAnnualIndependentCharts = () => {
  if (activeSection.key !== 'flujo') return null;
  const chartCards = [
    { key: 'inscritos', title: 'Inscritos por año', p1: 'inscritosP1', p2: 'inscritosP2', color: '#2f5fe3' },
    { key: 'admitidos', title: 'Admitidos por año', p1: 'admitidosP1', p2: 'admitidosP2', color: '#c81e1e' },
    { key: 'primer-curso', title: 'Primer curso por año', p1: 'primerCursoP1', p2: 'primerCursoP2', color: '#6b7280' }
  ];

  return (
    <Paper elevation={0} sx={{ mt: 1.6, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', overflow: 'hidden' }}>
            <Box sx={{ px: 1.6, py: 1.2, background: 'linear-gradient(135deg, #0f2f57 0%, #1d4f8c 45%, #2d6bb6 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Box>
            <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: 16.2, letterSpacing: 0.2 }}>
              Histórico de admitidos, inscritos y primer curso
            </Typography>
            <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.88)' }}>
              Gráficas independientes con filtros de programa y año.
            </Typography>
          </Box>
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              setFlujoChartProgramsFilter([]);
              setFlujoChartYearsFilter([]);
            }}
            sx={{
              ...GI_OUTLINE_ACTION_BTN_SX,
              width: { xs: '100%', md: 170 },
              borderColor: 'rgba(191,219,254,.95)',
              color: '#dbeafe',
              bgcolor: 'rgba(15,23,42,.18)',
              '&:hover': {
                borderColor: '#dbeafe',
                bgcolor: 'rgba(15,23,42,.3)'
              }
            }}
          >
            Restablecer filtros
          </Button>
        </Stack>
      </Box>

      <Box sx={{ p: 1.6 }}>

      <Box
        sx={{
          mb: 1.1,
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' },
          gap: 1.4
        }}
      >
        <Box>
          <FormControl size="small" fullWidth>
            <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>{'Programa acad\u00e9mico'}</Typography>
              <Select
                multiple
                displayEmpty
                value={flujoChartProgramsFilter}
                onChange={(e) => {
                  const list = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                  if (list.includes('__ALL__')) {
                    const allSelected = flujoChartProgramOptions.length > 0 && flujoChartProgramsFilter.length === flujoChartProgramOptions.length;
                    setFlujoChartProgramsFilter(allSelected ? [] : [...flujoChartProgramOptions]);
                    return;
                  }
                  const normalizedOptions = new Set(flujoChartProgramOptions.map((item) => normalizeProgramKey(item)));
                  setFlujoChartProgramsFilter(
                    list
                      .filter((item) => item !== '__ALL__')
                      .filter((item) => normalizedOptions.has(normalizeProgramKey(item)))
                  );
                }}
                renderValue={(selected) => {
                  const allSelected = flujoChartProgramOptions.length > 0 && selected.length === flujoChartProgramOptions.length;
                  return !selected.length || allSelected
                    ? 'Programa: Todos'
                    : `Programa: ${selected.length} seleccionados`;
                }}
                MenuProps={{ PaperProps: { style: { maxHeight: 340 } } }}
                sx={GI_FILTER_SELECT_SX}
              >
                <MenuItem value="__ALL__">
                  <Checkbox checked={flujoChartProgramOptions.length > 0 && flujoChartProgramsFilter.length === flujoChartProgramOptions.length} size="small" />
                  <ListItemText primary="Seleccionar todos" />
                </MenuItem>
                {flujoChartProgramOptions.map((program) => (
                  <MenuItem value={program} key={program}>
                    <Checkbox checked={flujoChartProgramsFilter.some((item) => normalizeProgramKey(item) === normalizeProgramKey(program))} size="small" />
                    <ListItemText primary={program} />
                  </MenuItem>
                ))}
              </Select>
          </FormControl>
        </Box>
        <Box>
          <FormControl size="small" fullWidth>
            <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>{'A\u00f1o'}</Typography>
              <Select
                multiple
                displayEmpty
                value={flujoChartYearsFilter}
                onChange={(e) => {
                  const list = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                  if (list.includes('__ALL__')) {
                    const allSelected = flujoChartYearOptions.length > 0 && flujoChartYearsFilter.length === flujoChartYearOptions.length;
                    setFlujoChartYearsFilter(allSelected ? [] : [...flujoChartYearOptions]);
                    return;
                  }
                  setFlujoChartYearsFilter(list.map((item) => String(item)).filter((item) => item !== '__ALL__' && flujoChartYearOptions.includes(item)));
                }}
                renderValue={(selected) => {
                  const allSelected = flujoChartYearOptions.length > 0 && selected.length === flujoChartYearOptions.length;
                  return !selected.length || allSelected
                    ? 'A\u00f1o: Todos' : ('A\u00f1o: ' + selected.length + ' seleccionados');
                }}
                MenuProps={{ PaperProps: { style: { maxHeight: 340 } } }}
                sx={GI_FILTER_SELECT_SX}
              >
                <MenuItem value="__ALL__">
                  <Checkbox checked={flujoChartYearOptions.length > 0 && flujoChartYearsFilter.length === flujoChartYearOptions.length} size="small" />
                  <ListItemText primary="Seleccionar todos" />
                </MenuItem>
                {flujoChartYearOptions.map((year) => (
                  <MenuItem value={year} key={year}>
                    <Checkbox checked={flujoChartYearsFilter.includes(year)} size="small" />
                    <ListItemText primary={year} />
                  </MenuItem>
                ))}
              </Select>
          </FormControl>
        </Box>
      </Box>

      <Grid container spacing={1.6} sx={{ mt: 0.3 }}>
        {chartCards.map((chart) => {
          const chartSeries = flujoAnnualComparisonData.flatMap((row) => ([
            { periodLabel: `${row.anio}-1`, valor: normalizeNumber(row[chart.p1]) },
            { periodLabel: `${row.anio}-2`, valor: normalizeNumber(row[chart.p2]) }
          ]));
          const isYearFiltered = flujoChartYearOptions.length > 0
            && flujoChartYearsFilter.length > 0
            && flujoChartYearsFilter.length < flujoChartYearOptions.length;
          return (
            <Grid item xs={12} key={chart.key}>
              <Paper elevation={0} sx={{ p: 1.3, borderRadius: 2.2, border: '1px solid #edf2fb', bgcolor: '#fbfdff' }}>
                <Typography sx={{ fontWeight: 800, color: '#1f2937', fontSize: 13.2, mb: 0.7 }}>{chart.title}</Typography>
                {chartSeries.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#64748b', py: 2 }}>
                    Sin datos para los filtros gráficos actuales.
                  </Typography>
                ) : (
                  renderSimpleBars(chartSeries, 'valor', chart.color, { compact: true, center: isYearFiltered })
                )}
              </Paper>
            </Grid>
          );
        })}
      </Grid>
      </Box>
    </Paper>
  );
};
const renderCategoryBars = (items = [], options = {}) => {
    const {
      color = '#2563eb',
      titleMap = null,
      maxItems = 8,
      minBarWidth = 60,
      baseMinWidth = 420,
      height = 240,
      palette = [],
      labelSize = 11,
      valueSize = 13,
      smartOutsideLabels = false,
      outsideLabelColor = '#0f172a',
      insideLabelMinHeight = 26,
      forceInsideLabelColor = null
    } = options;
    const rows = (items || []).slice(0, maxItems);
    const max = Math.max(...rows.map((x) => normalizeNumber(x.total)), 0);
    const getBarLabelColor = (barHex) => {
      const hex = String(barHex || '').replace('#', '');
      if (hex.length !== 6) return '#ffffff';
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      const luminance = (0.299 * r) + (0.587 * g) + (0.114 * b);
      return luminance > 185 ? '#1d4ed8' : '#ffffff';
    };
    if (!rows.length) {
      return <Typography variant="body2" sx={{ color: '#64748b', py: 2 }}>Sin datos para esta seccion.</Typography>;
    }
    return (
      <Box sx={{ overflowX: 'auto' }}>
        <Box sx={{ minWidth: Math.max(baseMinWidth, rows.length * (minBarWidth + 14)), width: 'fit-content', mx: 'auto', px: 0.5 }}>
          <Box sx={{ height, display: 'grid', gridTemplateColumns: `repeat(${rows.length}, ${minBarWidth}px)`, columnGap: '14px', alignItems: 'end', borderLeft: '1px solid #cbd5e1', borderBottom: '1px solid #cbd5e1', px: 1, pt: smartOutsideLabels ? 2.5 : 0, overflow: 'visible' }}>
            {rows.map((item) => {
              const value = normalizeNumber(item.total);
              const barHeight = max > 0 ? Math.max(6, (value / max) * (height - (smartOutsideLabels ? 56 : 40))) : 0;
              const label = titleMap?.[item.label] || item.label;
              const barColor = palette.length ? palette[rows.indexOf(item) % palette.length] : color;
              const showInside = barHeight > insideLabelMinHeight;
              return (
                <Box key={`${label}-${value}`} sx={{ textAlign: 'center' }}>
                  <Box sx={{ position: 'relative', height: barHeight, borderRadius: '10px 10px 0 0', bgcolor: barColor, display: 'flex', alignItems: 'center', justifyContent: 'center', px: 0.5 }}>
                    {showInside && (
                      <Typography sx={{ color: forceInsideLabelColor || getBarLabelColor(barColor), fontWeight: 900, fontSize: { xs: valueSize - 1, md: valueSize }, lineHeight: 1 }}>
                        {formatNumber(value)}
                      </Typography>
                    )}
                    {!showInside && smartOutsideLabels && (
                      <Typography
                        sx={{
                          position: 'absolute',
                          top: -18,
                          left: '50%',
                          transform: 'translateX(-50%)',
                          color: outsideLabelColor,
                          fontWeight: 900,
                          fontSize: { xs: valueSize - 1, md: valueSize },
                          lineHeight: 1,
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {formatNumber(value)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
          <Box sx={{ mt: 0.7, display: 'grid', gridTemplateColumns: `repeat(${rows.length}, ${minBarWidth}px)`, columnGap: '14px', px: 1 }}>
            {rows.map((item) => {
              const label = titleMap?.[item.label] || item.label;
              return (
                <Typography
                  key={`lbl-${label}`}
                  variant="caption"
                  sx={{
                    textAlign: 'center',
                    fontWeight: 800,
                    color: '#334155',
                    lineHeight: 1.1,
                    fontSize: { xs: labelSize - 1, md: labelSize },
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={label}
                >
                  {label}
                </Typography>
              );
            })}
          </Box>
        </Box>
      </Box>
    );
  };

  const renderInsightRows = (items = [], options = {}) => {
    const {
      total = 0,
      colorPalette = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#0ea5e9', '#64748b'],
      selectedKey = '',
      onSelect = () => {},
      compactLabel = (label) => label,
      title = 'INFORMACION GENERAL'
    } = options;
    return (
      <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
        {title ? (
          <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2 }}>
            <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>{title}</Typography>
          </Box>
        ) : null}
        <Stack spacing={1}>
          {items.map((item, index) => {
            const color = colorPalette[index % colorPalette.length];
            const isSelected = selectedKey === item.label;
            const pct = total > 0 ? (normalizeNumber(item.total) / total) * 100 : 0;
            return (
              <Paper
                key={`row-${item.label}`}
                elevation={0}
                onClick={() => onSelect(isSelected ? '' : item.label)}
                sx={{
                  p: 1.15,
                  borderRadius: 2.5,
                  border: `1px solid ${isSelected ? color : '#e2e8f0'}`,
                  boxShadow: isSelected ? `0 10px 24px -16px ${color}` : '0 2px 10px rgba(15,23,42,0.03)',
                  cursor: 'pointer',
                  transition: 'all .2s ease',
                  background: isSelected ? `linear-gradient(180deg, ${color}10, #ffffff)` : 'linear-gradient(180deg,#ffffff,#fbfdff)',
                  '&:hover': { borderColor: color, transform: 'translateX(2px)', boxShadow: `0 12px 24px -18px ${color}` }
                }}
              >
                <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ minWidth: 24, height: 24, px: 0.8, borderRadius: 1.3, bgcolor: color, color: '#fff', display: 'grid', placeItems: 'center' }}>
                      <Typography sx={{ fontWeight: 900, fontSize: 11 }}>{index + 1}</Typography>
                    </Box>
                    <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={item.label}>
                      {compactLabel(item.label)}
                    </Typography>
                  </Stack>
                  <Stack direction="row" spacing={0.8} alignItems="center">
                    <Typography sx={{ fontWeight: 900, color: '#1d4ed8', fontSize: { xs: 18, md: 22 }, lineHeight: 1 }}>
                      {formatNumber(item.total)}
                    </Typography>
                    <Chip
                      size="small"
                      label={`${pct.toFixed(2)}%`}
                      sx={{
                        bgcolor: isSelected ? `${color}16` : '#eff6ff',
                        color: isSelected ? color : '#1d4ed8',
                        fontWeight: 900,
                        fontSize: 11,
                        border: `1px solid ${isSelected ? `${color}40` : '#dbeafe'}`
                      }}
                    />
                  </Stack>
                </Stack>
                <Box
                  sx={{
                    mt: 0.9,
                    height: 8,
                    borderRadius: 999,
                    bgcolor: '#eef2ff',
                    overflow: 'hidden',
                    border: '1px solid #e2e8f0',
                    position: 'relative'
                  }}
                >
                  <Box
                    sx={{
                      width: `${Math.max(4, pct)}%`,
                      height: '100%',
                      background: `linear-gradient(90deg, ${color}, ${color}CC)`,
                      boxShadow: `0 0 12px ${color}55`,
                      borderRadius: 999,
                      transition: 'width .35s ease'
                    }}
                  />
                  <Box
                    sx={{
                      position: 'absolute',
                      inset: 0,
                      background: 'linear-gradient(180deg, rgba(255,255,255,0.35), rgba(255,255,255,0))',
                      pointerEvents: 'none'
                    }}
                  />
                </Box>
              </Paper>
            );
          })}
        </Stack>
      </Paper>
    );
  };

  const renderCaracterizacionDashboard = (series) => {
    const data = caracterizacionPanel;
    if (caracterizacionPanelLoading) {
      return <Typography sx={{ py: 4, textAlign: 'center', color: '#334155' }}>Cargando dashboard de caracterizacion...</Typography>;
    }
    if (!data) {
      return <Typography sx={{ py: 4, textAlign: 'center', color: '#334155' }}>No fue posible cargar el dashboard de caracterizacion.</Typography>;
    }
    const victimasDistribucion = data.victimas?.distribucion || [];
    const victimasGenero = data.victimas?.genero || [];
    const afroGenero = data.afrodescendientes?.genero || [];
    const generoGeneral = data.generoGeneral?.distribucion || [];
    const estratosDistribucion = data.estratos?.distribucion || [];
    const gruposEtnicos = data.gruposEtnicos?.distribucion || [];
    const totalRegistros = normalizeNumber(data.totalRegistros);
    const victimasPct = totalRegistros > 0 ? ((normalizeNumber(data.victimas?.total) / totalRegistros) * 100) : 0;
    const afroPct = totalRegistros > 0 ? ((normalizeNumber(data.afrodescendientes?.total) / totalRegistros) * 100) : 0;
    const afroTotal = normalizeNumber(data.afrodescendientes?.total);
    const afroPoblacionGeneral = Math.max(0, totalRegistros - afroTotal);
    const afroComparativoGeneral = [
      { label: 'Poblacion general', total: afroPoblacionGeneral },
      { label: 'Afrodescendientes', total: afroTotal }
    ];
    const getPct = (value, total) => (total > 0 ? (normalizeNumber(value) / total) * 100 : 0);
    const estratoPalette = ['#ef4444', '#f59e0b', '#facc15', '#10b981', '#6366f1', '#1d4ed8', '#64748b', '#0ea5e9'];
    const etnicoPalette = ['#3b82f6', '#10b981', '#8b5cf6', '#f97316', '#ec4899', '#14b8a6', '#64748b', '#f43f5e', '#6366f1', '#84cc16'];
    const genderSeriesPalette = ['#2563eb', '#be185d', '#7c3aed'];
    const estratosChartData = caracterizacionUi.estrato ? estratosDistribucion.filter((x) => x.label === caracterizacionUi.estrato) : estratosDistribucion;
    const gruposEtnicosTotal = gruposEtnicos.reduce((acc, item) => acc + normalizeNumber(item.total), 0);
    const gruposSoloEtnicos = gruposEtnicos.filter((x) => !String(x.label || '').toUpperCase().includes('NO APLICA'));
    const gruposSoloEtnicosTotal = gruposSoloEtnicos.reduce((acc, item) => acc + normalizeNumber(item.total), 0);
    const gruposSoloEtnicosPct = totalRegistros > 0 ? (gruposSoloEtnicosTotal / totalRegistros) * 100 : 0;
    const genderIconFor = (label) => {
      const t = String(label || '').toUpperCase();
      if (t.includes('MASC')) return <MaleIcon sx={{ fontSize: 26 }} />;
      if (t.includes('FEM')) return <FemaleIcon sx={{ fontSize: 26 }} />;
      return <TransgenderIcon sx={{ fontSize: 26 }} />;
    };
    const sectionHeader = (icon, title, subtitle, colorA, colorB) => (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2.2, pb: 1.6, borderBottom: '2px solid #eef2ff' }}>
        <Box
          sx={{
            width: 56,
            height: 56,
            borderRadius: 3,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: `linear-gradient(135deg, ${colorA}, ${colorB})`,
            boxShadow: `0 12px 22px -14px ${colorA}`
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: { xs: 22, md: 28 }, lineHeight: 1.1 }}>{title}</Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>{subtitle}</Typography>
        </Box>
      </Box>
    );
    const victimasTotal = normalizeNumber(data.victimas?.total);
    const victimSiData = victimasDistribucion.find((x) => String(x.label || '').trim().toUpperCase() === 'SI');
    const victimasSi = normalizeNumber(victimSiData?.total);
    const victimasResto = Math.max(0, totalRegistros - victimasSi);
    const makeDonutGradient = (segments) => {
      const total = segments.reduce((acc, s) => acc + normalizeNumber(s.value), 0);
      if (!total) return 'conic-gradient(#e2e8f0 0 100%)';
      let start = 0;
      const parts = segments.map((seg) => {
        const pct = (normalizeNumber(seg.value) / total) * 100;
        const end = start + pct;
        const part = `${seg.color} ${start}% ${end}%`;
        start = end;
        return part;
      });
      return `conic-gradient(${parts.join(', ')})`;
    };
    const renderDonutPanel = ({ title, subtitle, total, segments, accent = '#ef4444', centerValue = null, headerValue = null }) => (
      <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%' }}>
        <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>{title}</Typography>
          <Chip size="small" label={formatNumber(headerValue ?? total)} sx={{ bgcolor: 'rgba(255,255,255,.16)', color: '#fff', fontWeight: 900 }} />
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '180px minmax(280px, 440px)' },
            gap: 1.4,
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 220
          }}
        >
          <Box sx={{ display: 'grid', placeItems: 'center', py: 0.6, alignSelf: 'center', justifySelf: 'center' }}>
            <Box sx={{ position: 'relative', width: 170, height: 170 }}>
              <Box
                sx={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '50%',
                  background: makeDonutGradient(segments)
                }}
              />
              <Box
                sx={{
                  position: 'absolute',
                  inset: 20,
                  borderRadius: '50%',
                  bgcolor: '#fff',
                  boxShadow: 'inset 0 0 0 1px #e2e8f0',
                  display: 'grid',
                  placeItems: 'center',
                  textAlign: 'center',
                  px: 1
                }}
              >
                <Box>
                  <Typography sx={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
                    {subtitle}
                  </Typography>
                  <Typography sx={{ color: accent, fontWeight: 900, fontSize: 24, lineHeight: 1.05 }}>
                    {formatNumber(centerValue ?? total)}
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Box>
          <Stack spacing={1} sx={{ alignSelf: 'center', width: '100%' }}>
            {segments.map((seg) => {
              const pct = getPct(seg.value, total);
              return (
                <Paper key={`${title}-${seg.label}`} elevation={0} sx={{ p: 1, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                    <Stack direction="row" spacing={0.8} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: 99, bgcolor: seg.color, flexShrink: 0 }} />
                      <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {seg.label}
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={0.8} alignItems="center">
                      <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17, lineHeight: 1 }}>
                        {formatNumber(seg.value)}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${pct.toFixed(2)}%`}
                        sx={{
                          bgcolor: `${seg.color}18`,
                          color: '#0f172a',
                          border: `1px solid ${seg.color}55`,
                          fontWeight: 900,
                          fontSize: 12,
                          height: 26,
                          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.6)'
                        }}
                      />
                    </Stack>
                  </Stack>
                  <Box sx={{ mt: 0.8, height: 6, borderRadius: 999, bgcolor: '#eef2ff', overflow: 'hidden' }}>
                    <Box sx={{ width: `${Math.max(2, pct)}%`, height: '100%', bgcolor: seg.color }} />
                  </Box>
                </Paper>
              );
            })}
          </Stack>
        </Box>
      </Paper>
    );
    return (
      <Stack spacing={2.2}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.6, md: 2.2 },
            borderRadius: 4,
            border: '1px solid #dbe6f5',
            background:
              'radial-gradient(circle at 10% 10%, rgba(59,130,246,.18), transparent 35%), radial-gradient(circle at 95% 15%, rgba(139,92,246,.18), transparent 40%), linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)'
          }}
        >
          <Box
            sx={{
              ...GI_DASHBOARD_AUTO_GRID_SX,
              gap: 1.8
            }}
          >
            {[
              { icon: <PeopleIcon />, label: 'Caracterizacion total', value: totalRegistros, caption: 'Registros filtrados', colors: ['#2563eb', '#4338ca'] },
              { icon: <SecurityIcon />, label: 'Victimas conflicto', value: data.victimas?.total || 0, caption: `${victimasPct.toFixed(2)}% del total`, colors: ['#ef4444', '#b91c1c'] },
              { icon: <Diversity3Icon />, label: 'Afrodescendientes', value: data.afrodescendientes?.total || 0, caption: `${afroPct.toFixed(2)}% del total`, colors: ['#0ea5e9', '#2563eb'] },
              { icon: <GroupsIcon />, label: 'Cobertura etnica', value: (data.gruposEtnicos?.distribucion || []).length, caption: 'Categorias activas', colors: ['#10b981', '#059669'] }
            ].map((item) => (
              <Box key={item.label}>
                <Card
                  sx={{
                    borderRadius: 3,
                    height: '100%',
                    color: '#fff',
                    background: `linear-gradient(135deg, ${item.colors[0]} 0%, ${item.colors[1]} 100%)`,
                    boxShadow: `0 14px 32px -20px ${item.colors[0]}`,
                    position: 'relative',
                    overflow: 'hidden'
                  }}
                >
                  <CardContent sx={{ p: 2.2, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <Box sx={{ position: 'absolute', width: 90, height: 90, borderRadius: '50%', bgcolor: 'rgba(255,255,255,.08)', top: -22, right: -18 }} />
                    <Stack direction="row" spacing={1.5} alignItems="center" sx={{ position: 'relative' }}>
                      <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: 'rgba(255,255,255,.16)' }}>
                        {item.icon}
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: 'rgba(255,255,255,.85)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.07em' }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 22, md: 27, xl: 29 }, fontWeight: 900, lineHeight: 1 }}>
                          {formatNumber(item.value)}
                        </Typography>
                      </Box>
                    </Stack>
                    <Typography variant="caption" sx={{ display: 'block', mt: 1.4, color: 'rgba(255,255,255,.95)', fontSize: 12.5, fontWeight: 700 }}>
                      {item.caption}
                    </Typography>
                  </CardContent>
                </Card>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.6, md: 2.2 }, borderRadius: 4, border: '1px solid #dbe6f5' }}>
          {sectionHeader(<PeopleIcon />, 'Distribucion general por genero', 'Se integra al bloque principal de caracterizacion para lectura ejecutiva inmediata', '#f59e0b', '#d97706')}
          <Box
            sx={{
              ...GI_DASHBOARD_AUTO_GRID_SX,
              gap: 1.8
            }}
          >
            {generoGeneral.slice(0, 6).map((item, index) => {
              const styles = [
                { border: '#3b82f6', bg: '#dbeafe', fg: '#1e40af', chip: '#2563eb' },
                { border: '#e879b9', bg: '#fdf2f8', fg: '#9d174d', chip: '#be185d' },
                { border: '#8b5cf6', bg: '#f3e8ff', fg: '#6d28d9', chip: '#7c3aed' }
              ];
              const s = styles[index % styles.length];
              const pct = getPct(item.total, totalRegistros);
              return (
                <Box key={`gen-top-${item.label}`}>
                  <Card sx={{ borderRadius: 3, border: `2px solid ${s.border}`, bgcolor: s.bg, boxShadow: 'none', height: '100%' }}>
                    <CardContent sx={{ p: 2.4, height: '100%', display: 'flex', flexDirection: 'column' }}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box sx={{ color: s.fg, display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 2, bgcolor: 'rgba(255,255,255,.7)' }}>
                          {genderIconFor(item.label)}
                        </Box>
                        <Typography variant="caption" sx={{ color: s.fg, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.06em', fontSize: 13 }}>
                          {item.label}
                        </Typography>
                      </Stack>
                      <Typography sx={{ mt: 1.2, fontWeight: 900, color: s.fg, fontSize: { xs: 24, md: 30, xl: 33 }, lineHeight: 1 }}>
                        {formatNumber(item.total)}
                      </Typography>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.2, flexWrap: 'wrap' }}>
                        <Chip size="small" label={`${pct.toFixed(2)}%`} sx={{ bgcolor: s.chip, color: '#fff', fontWeight: 900, fontSize: 14, height: 31, '& .MuiChip-label': { px: 1.25 } }} />
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: 13.5, fontWeight: 600 }}>participacion sobre caracterizacion total</Typography>
                      </Stack>
                      <LinearProgress variant="determinate" value={Math.max(0, Math.min(100, pct))} sx={{ mt: 'auto', pt: 1.4, height: 10, borderRadius: 999, bgcolor: 'rgba(255,255,255,.8)', '& .MuiLinearProgress-bar': { bgcolor: s.chip } }} />
                    </CardContent>
                  </Card>
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 4, border: '1px solid #dbe6f5' }}>
              {sectionHeader(<SecurityIcon />, 'Victimas del conflicto armado', 'Distribucion general y composicion por genero', '#ef4444', '#b91c1c')}
              <Card sx={{ mb: 1.6, borderRadius: 2.8, border: '1px solid #fecaca', bgcolor: '#fff7f7' }}>
                <CardContent sx={{ p: { xs: 1.4, md: 1.6 } }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                    <Box>
                      <Typography variant="caption" sx={{ color: '#991b1b', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' }}>Victimas identificadas</Typography>
                      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mt: 0.4, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 900, color: '#b91c1c', fontSize: { xs: 28, md: 34 }, lineHeight: 1 }}>
                          {formatNumber(victimasTotal)}
                        </Typography>
                        <Chip size="small" label={`${victimasPct.toFixed(2)}% del total filtrado`} sx={{ bgcolor: '#ef4444', color: '#fff', fontWeight: 900, fontSize: 12.5, height: 28 }} />
                      </Stack>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 560 }}>
                      Respuesta consolidada a la variable de victima del conflicto armado, con lectura general y composicion por genero.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 1.6
                }}
              >
                {renderDonutPanel({
                  title: 'PORCENTAJE SOBRE POBLACION TOTAL',
                  subtitle: 'Victimas',
                  total: totalRegistros,
                  accent: '#b91c1c',
                  segments: [
                    { label: 'Victimas (SI)', value: victimasSi, color: '#ef4444' },
                    { label: 'Resto de poblacion', value: victimasResto, color: '#cbd5e1' }
                  ]
                })}

                <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%' }}>
                  <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>INFORMACION GENERAL (SI / NO)</Typography>
                  </Box>
                  {renderCategoryBars(victimasDistribucion, {
                    color: '#3b82f6',
                    maxItems: 4,
                    minBarWidth: 104,
                    baseMinWidth: 320,
                    height: 280,
                    labelSize: 13,
                    valueSize: 16,
                    smartOutsideLabels: true,
                    outsideLabelColor: '#0f172a',
                    insideLabelMinHeight: 30
                  })}
                </Paper>

                {renderDonutPanel({
                  title: 'COMPOSICION POR GENERO (VICTIMAS)',
                  subtitle: 'Genero',
                  total: victimasTotal,
                  accent: '#ef4444',
                  segments: victimasGenero.map((item, index) => ({
                    label: item.label,
                    value: item.total,
                    color: genderSeriesPalette[index % genderSeriesPalette.length]
                  }))
                })}

                <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%' }}>
                  <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>DISTRIBUCION POR GENERO (VICTIMAS) - BARRAS</Typography>
                  </Box>
                  {renderCategoryBars(victimasGenero, {
                    color: genderSeriesPalette[0],
                    palette: genderSeriesPalette,
                    maxItems: 6,
                    minBarWidth: 104,
                    baseMinWidth: 320,
                    height: 280,
                    labelSize: 13,
                    valueSize: 16,
                    smartOutsideLabels: true,
                    outsideLabelColor: '#0f172a',
                    insideLabelMinHeight: 30
                  })}
                </Paper>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 4, border: '1px solid #dbe6f5', height: '100%' }}>
              {sectionHeader(<Diversity3Icon />, 'Afrodescendientes', 'Conteo y distribucion por genero', '#0ea5e9', '#2563eb')}
              <Card sx={{ mb: 1.6, borderRadius: 2.8, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                <CardContent sx={{ p: { xs: 1.4, md: 1.6 } }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between">
                    <Box>
                      <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' }}>Afrodescendientes</Typography>
                      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mt: 0.4, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 900, color: '#1e40af', fontSize: { xs: 28, md: 34 }, lineHeight: 1 }}>
                          {formatNumber(afroTotal)}
                        </Typography>
                        <Chip size="small" label={`${afroPct.toFixed(2)}% del total filtrado`} sx={{ bgcolor: '#2563eb', color: '#fff', fontWeight: 900, fontSize: 12.5, height: 28 }} />
                      </Stack>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#64748b', maxWidth: 560 }}>
                      Lectura consolidada de la poblacion afrodescendiente y su composicion por genero para la ventana de observacion filtrada.
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                  gap: 1.6
                }}
              >
                {renderDonutPanel({
                  title: 'PORCENTAJE SOBRE POBLACION TOTAL',
                  subtitle: 'Poblacion general',
                  total: totalRegistros,
                  headerValue: afroPoblacionGeneral,
                  centerValue: afroPoblacionGeneral,
                  accent: '#1d4ed8',
                  segments: [
                    { label: 'Poblacion general', value: afroPoblacionGeneral, color: '#cbd5e1' },
                    { label: 'Afrodescendientes', value: afroTotal, color: '#2563eb' }
                  ]
                })}

                <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%' }}>
                  <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>COMPARATIVO GENERAL (POBLACION VS AFRO)</Typography>
                  </Box>
                  {renderCategoryBars(afroComparativoGeneral, {
                    color: '#2563eb',
                    palette: ['#cbd5e1', '#2563eb'],
                    maxItems: 2,
                    minBarWidth: 132,
                    baseMinWidth: 340,
                    height: 280,
                    labelSize: 13,
                    valueSize: 16,
                    smartOutsideLabels: true,
                    outsideLabelColor: '#0f172a',
                    insideLabelMinHeight: 30
                  })}
                </Paper>

                {renderDonutPanel({
                  title: 'COMPOSICION POR GENERO (AFRO)',
                  subtitle: 'Genero',
                  total: normalizeNumber(data.afrodescendientes?.total),
                  accent: '#2563eb',
                  segments: afroGenero.map((item, index) => ({
                    label: item.label,
                    value: item.total,
                    color: genderSeriesPalette[index % genderSeriesPalette.length]
                  }))
                })}

                <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%' }}>
                  <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2 }}>
                    <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>DETALLE POR GENERO (AFRO) - BARRAS</Typography>
                  </Box>
                  {renderCategoryBars(afroGenero, {
                    color: genderSeriesPalette[0],
                    palette: genderSeriesPalette,
                    maxItems: 6,
                    minBarWidth: 104,
                    baseMinWidth: 300,
                    height: 280,
                    labelSize: 13,
                    valueSize: 16,
                    smartOutsideLabels: true,
                    outsideLabelColor: '#0f172a',
                    insideLabelMinHeight: 30
                  })}
                </Paper>
              </Box>
            </Paper>
          </Grid>
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 4, border: '1px solid #dbe6f5', height: '100%' }}>
              {sectionHeader(<HomeWorkIcon />, 'Estratos socioeconomicos', 'Distribucion general de registros por estrato', '#10b981', '#059669')}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 1.6 }}>
                {renderInsightRows(estratosDistribucion.slice(0, 8), {
                  total: totalRegistros,
                  colorPalette: estratoPalette,
                  selectedKey: caracterizacionUi.estrato,
                  onSelect: (label) => setCaracterizacionUi((prev) => ({ ...prev, estrato: label })),
                  compactLabel: (label) => String(label || '').replace(/ESTRATO\s*/i, 'ESTRATO '),
                  title: 'INFORMACION GENERAL'
                })}
                <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%' }}>
                  <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>DISTRIBUCION VISUAL</Typography>
                    {caracterizacionUi.estrato && (
                      <Chip size="small" label={caracterizacionUi.estrato} onDelete={() => setCaracterizacionUi((prev) => ({ ...prev, estrato: '' }))} sx={{ bgcolor: 'rgba(255,255,255,.15)', color: '#fff', '& .MuiChip-deleteIcon': { color: '#fff' } }} />
                    )}
                  </Box>
                  {renderCategoryBars(estratosChartData, { color: '#3b82f6', palette: estratoPalette, maxItems: 10, minBarWidth: 88, baseMinWidth: 320, height: 320, labelSize: 13, valueSize: 16, smartOutsideLabels: true, outsideLabelColor: '#0f172a', insideLabelMinHeight: 30, forceInsideLabelColor: '#ffffff' })}
                </Paper>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 4, border: '1px solid #dbe6f5' }}>
              {sectionHeader(<GroupsIcon />, 'Grupos etnicos', 'Categorias y participacion con estilos de tarjetas', '#2563eb', '#0ea5e9')}
              <Card sx={{ mb: 1.6, borderRadius: 2.8, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                <CardContent sx={{ p: { xs: 1.4, md: 1.6 } }}>
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: { xs: '1fr', md: 'minmax(240px, 340px) 1fr' },
                      gap: 1.2,
                      alignItems: 'center'
                    }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.07em' }}>Diversidad etnica</Typography>
                      <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mt: 0.4, flexWrap: 'wrap' }}>
                        <Typography sx={{ fontWeight: 900, color: '#1e40af', fontSize: { xs: 28, md: 34 }, lineHeight: 1 }}>
                          {formatNumber(gruposSoloEtnicosTotal)}
                        </Typography>
                        <Chip size="small" label={`${gruposSoloEtnicosPct.toFixed(2)}% del total filtrado`} sx={{ bgcolor: '#2563eb', color: '#fff', fontWeight: 900, fontSize: 12.5, height: 28 }} />
                      </Stack>
                    </Box>
                    <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.4 }}>
                      Lectura consolidada de diversidad etnica, separando poblacion total/no aplica y grupos etnicos reportados.
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 1.6, alignItems: 'start' }}>
                <Box sx={{ minWidth: 0 }}>
                  {renderInsightRows(gruposEtnicos.slice(0, 10), {
                    total: gruposEtnicosTotal,
                    colorPalette: etnicoPalette,
                    selectedKey: caracterizacionUi.grupoEtnico,
                    onSelect: (label) => setCaracterizacionUi((prev) => ({ ...prev, grupoEtnico: label })),
                    compactLabel: (label) => String(label || '').slice(0, 28),
                    title: 'POBLACION TOTAL'
                  })}
                </Box>
                <Paper elevation={0} sx={{ p: 1.4, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: '100%', minWidth: 0 }}>
                  <Box sx={{ px: 1.2, py: 0.9, borderRadius: 2, bgcolor: '#1d4ed8', mb: 1.2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 12, letterSpacing: '.06em' }}>GRUPOS ETNICOS</Typography>
                    {caracterizacionUi.grupoEtnico && (
                      <Chip size="small" label={caracterizacionUi.grupoEtnico} onDelete={() => setCaracterizacionUi((prev) => ({ ...prev, grupoEtnico: '' }))} sx={{ bgcolor: 'rgba(255,255,255,.15)', color: '#fff', '& .MuiChip-deleteIcon': { color: '#fff' } }} />
                    )}
                  </Box>
                  {renderInsightRows(gruposSoloEtnicos.slice(0, 10), {
                    total: gruposSoloEtnicosTotal,
                    colorPalette: etnicoPalette,
                    selectedKey: caracterizacionUi.grupoEtnico,
                    onSelect: (label) => setCaracterizacionUi((prev) => ({ ...prev, grupoEtnico: label })),
                    compactLabel: (label) => String(label || '').slice(0, 28),
                    title: ''
                  })}
                </Paper>
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </Stack>
    );
  };

  const renderStatsCards = () => (
    <Box
      sx={{
        display: 'grid',
        width: '100%',
        gap: 2.2,
        gridTemplateColumns: {
          xs: '1fr',
          md: 'repeat(2, minmax(0, 1fr))'
        },
        alignItems: 'stretch'
      }}
    >
      {visibleBases.length === 0 && (
        <Paper
          elevation={0}
          sx={{
            gridColumn: '1 / -1',
            p: 3,
            borderRadius: 3,
            border: '1px dashed #bfd4fb',
            bgcolor: '#f8fbff'
          }}
        >
          <Typography sx={{ fontWeight: 800, color: '#1e3a8a', mb: 0.5 }}>
            Sin módulos asignados
          </Typography>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            Este usuario aún no tiene módulos visibles de Gestión de la Información. Puedes habilitarlos por rol o por permiso granular.
          </Typography>
        </Paper>
      )}
      {visibleBases.map((base) => (
        <Paper
          key={base.key}
          elevation={0}
          sx={{
            borderRadius: 4,
            p: { xs: 2.2, md: 2.6 },
            border: '1px solid #dbe6f5',
            minHeight: { xs: 220, md: 250 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(180deg, #f8fbff 0%, #ffffff 100%)',
            boxShadow: '0 10px 28px rgba(15,23,42,0.04)',
            transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 14px 34px rgba(37,99,235,0.08)',
              borderColor: '#bfd4fb'
            }
          }}
        >
          <Stack spacing={1.8}>
            <Box
              sx={{
                width: 74,
                height: 74,
                borderRadius: 2.5,
                background: 'linear-gradient(145deg, #6366f1, #4f46e5 55%, #4338ca)',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 10px 22px rgba(79,70,229,0.22)'
              }}
            >
              <FolderIcon sx={{ color: '#fff', fontSize: 36 }} />
            </Box>

            <Box sx={{ minHeight: 92 }}>
              <Typography
                sx={{
                  fontSize: { xs: 22, md: 24 },
                  fontWeight: 900,
                  color: '#0f172a',
                  lineHeight: 1.08,
                  letterSpacing: '-0.02em'
                }}
              >
                {base.label}
              </Typography>
              <Typography
                sx={{
                  mt: 0.8,
                  color: '#475569',
                  lineHeight: 1.32,
                  fontSize: { xs: 14, md: 15 }
                }}
              >
                {base.description}
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ pt: 1 }}>
            <Button
              fullWidth
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => enterCard(base.key)}
              sx={{
                mt: 1,
                borderRadius: 999,
                py: 1.15,
                textTransform: 'none',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                background: 'linear-gradient(140deg, #2563eb, #1d4ed8)',
                boxShadow: '0 10px 22px rgba(37,99,235,.22)'
              }}
            >
              Ingresar al módulo
            </Button>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.9, color: '#64748b' }}>
              {base.key === 'poblacional' ? `${countMap.Poblacional || 0} registros disponibles` : 'Interfaz preparada para activacion'}
            </Typography>
          </Box>
        </Paper>
      ))}

      {/* ── Tarjeta Monitor de Actividad — solo administrador ── */}
      {user?.role === ROLES.ADMINISTRADOR && (
        <Paper
          elevation={0}
          sx={{
            borderRadius: 4,
            p: { xs: 2.2, md: 2.6 },
            border: '1.5px solid #bfdbfe',
            minHeight: { xs: 220, md: 250 },
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            background: 'linear-gradient(160deg, #eff6ff 0%, #ffffff 100%)',
            boxShadow: '0 10px 28px rgba(37,99,235,0.06)',
            transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: '0 14px 34px rgba(37,99,235,0.13)',
              borderColor: '#93c5fd'
            }
          }}
        >
          <Stack spacing={1.8}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <Box
                sx={{
                  width: 74,
                  height: 74,
                  borderRadius: 2.5,
                  background: 'linear-gradient(145deg, #1d4ed8, #2563eb 55%, #3b82f6)',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 10px 22px rgba(37,99,235,0.28)'
                }}
              >
                <MonitorHeartIcon sx={{ color: '#fff', fontSize: 36 }} />
              </Box>
              <Chip label="Solo Admin" size="small" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, fontSize: 10, border: '1px solid #bfdbfe' }} />
            </Box>

            <Box sx={{ minHeight: 92 }}>
              <Typography sx={{ fontSize: { xs: 22, md: 24 }, fontWeight: 900, color: '#0f172a', lineHeight: 1.08, letterSpacing: '-0.02em' }}>
                Monitor de Actividad
              </Typography>
              <Typography sx={{ mt: 0.8, color: '#475569', lineHeight: 1.32, fontSize: { xs: 14, md: 15 } }}>
                Seguimiento de interacción de usuarios con el sistema. Estadísticas de uso por módulo, rol y período.
              </Typography>
            </Box>
          </Stack>

          <Box sx={{ pt: 1 }}>
            <Button
              fullWidth
              variant="contained"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => enterCard('activity_monitor')}
              sx={{
                mt: 1,
                borderRadius: 999,
                py: 1.15,
                textTransform: 'none',
                fontWeight: 800,
                letterSpacing: '-0.01em',
                background: 'linear-gradient(140deg, #1d4ed8, #2563eb)',
                boxShadow: '0 10px 22px rgba(37,99,235,.28)'
              }}
            >
              Ver estadísticas
            </Button>
            <Typography variant="caption" sx={{ display: 'block', mt: 0.9, color: '#64748b' }}>
              Dashboard exclusivo del administrador
            </Typography>
          </Box>
        </Paper>
      )}
    </Box>
  );

  const renderGestionProcesosModule = () => {
    if (!visibleGestionProcesosDashboards.includes('estadistica_documental')) {
      return <Alert severity="info">Este usuario no tiene habilitado el submódulo Estadística Documental.</Alert>;
    }

    if (user?.role === ROLES.GESTION_PROCESOS || isDirectDocumentalView) {
      return <EstadisticaDocumentalPanel embedded />;
    }

    return gestionProcesosPanel === 'hub' ? (
      <Stack spacing={2.2}>
        <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #dbe6f5', borderRadius: 3, background: 'linear-gradient(120deg, #f8fbff 0%, #eef6ff 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setSelectedCard(null)}>Volver a tarjetas</Button>
              <Chip label="Modulo Gestión por Procesos" color="primary" variant="outlined" />
            </Stack>
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              Dashboard centralizado dentro de Estadística Institucional.
            </Typography>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 1.2, md: 1.8 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#f8fbff' }}>
          <Box sx={{ display: 'grid', gap: 1.6, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
            <Paper
              elevation={0}
              sx={{
                p: { xs: 1.5, md: 1.8 },
                borderRadius: 3,
                border: '1px solid #d7e4fb',
                background: 'linear-gradient(165deg, #ffffff 0%, #f7fbff 100%)',
                minHeight: 210,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between'
              }}
            >
              <Box>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: '#1d4ed816', color: '#1d4ed8', display: 'grid', placeItems: 'center', mb: 0.9, border: '1px solid #1d4ed822' }}>
                  <InsightsIcon />
                </Box>
                <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 19 }}>
                  Estadística Documental
                </Typography>
                <Typography sx={{ mt: 0.7, color: '#475569', fontSize: 14, lineHeight: 1.3 }}>
                  Cantidad de documentos por tipo, macroproceso y periodo académico institucional.
                </Typography>
                <Chip size="small" label="Disponible" sx={{ mt: 1, fontWeight: 700, bgcolor: '#dbeafe', color: '#1d4ed8' }} />
              </Box>
              <Button
                sx={{
                  mt: 1.2,
                  minHeight: 40,
                  borderRadius: 999,
                  textTransform: 'none',
                  fontWeight: 800,
                  background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                  boxShadow: '0 8px 18px rgba(37,99,235,.22)'
                }}
                variant="contained"
                onClick={() => setGestionProcesosPanel('estadistica_documental')}
              >
                Abrir dashboard
              </Button>
            </Paper>
          </Box>
        </Paper>
      </Stack>
    ) : (
      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setGestionProcesosPanel('hub')}>
            Volver a módulo Gestión por Procesos
          </Button>
        </Paper>
        <EstadisticaDocumentalPanel embedded />
      </Stack>
    );
  };

  const renderCantidadTotalEgresadosCards = () => {
    const data = cantidadTotalEgresadosDashboard;
    if (!data?.totalRegistros) {
      return (
        <Paper elevation={0} sx={{ mt: 2, p: 1.8, borderRadius: 2.5, border: '1px dashed #cbd5e1', bgcolor: '#f8fafc' }}>
          <Typography sx={{ fontWeight: 700, color: '#0f172a' }}>Cantidad Total Egresados</Typography>
          <Typography variant="body2" sx={{ color: '#64748b', mt: 0.6 }}>
            No hay datos cargados en la subbase "Cantidad Total Egresados" para los filtros actuales.
          </Typography>
        </Paper>
      );
    }

    const detalleActivo = egresadosDetalleActivo || data.porDetalle[0]?.label || '';
    const detallesTop = data.porDetalle.slice(0, 6);
    const totalDetalleActivo = data.porDetalle.find((x) => x.label === detalleActivo)?.total || 0;
    const rowsDetalleActivo = cantidadTotalEgresadosRows.filter((row) => {
      const indicador = String(row?.indicador || '').trim();
      return (indicador || 'Sin detalle') === detalleActivo;
    });
    const programasDetalle = Array.from(
      rowsDetalleActivo.reduce((map, row) => {
        const key = String(row.programa || 'Sin informacion').trim() || 'Sin informacion';
        map.set(key, (map.get(key) || 0) + normalizeNumber(row.valor));
        return map;
      }, new Map()).entries()
    ).map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total).slice(0, 8);

    return (
      <Paper elevation={0} sx={{ mt: 2, p: { xs: 1.4, md: 1.8 }, borderRadius: 2.5, border: '1px solid #d1fae5', bgcolor: '#f0fdf4' }}>
        <Stack spacing={1.4}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography sx={{ fontWeight: 800, color: '#065f46' }}>Tarjetas de Egresados (Subbase: Cantidad Total Egresados)</Typography>
              <Typography variant="body2" sx={{ color: '#166534' }}>
                Complementa la pestaña de Graduados con el total de egresados por detalle/programa. La gráfica de barras superior se mantiene con la subbase de Graduados.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Chip size="small" label={`Total egresados: ${formatNumber(data.total)}`} sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 }} />
              <Chip size="small" label={`Registros: ${formatNumber(data.totalRegistros)}`} variant="outlined" />
            </Stack>
          </Stack>

          <Grid container spacing={1.2}>
            {detallesTop.map((item) => {
              const active = item.label === detalleActivo;
              const pct = data.total > 0 ? Math.round((item.total / data.total) * 100) : 0;
              return (
                <Grid item xs={12} sm={6} md={4} key={item.label}>
                  <Card
                    onClick={() => setEgresadosDetalleActivo((prev) => (prev === item.label ? '' : item.label))}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2.4,
                      border: active ? '2px solid #10b981' : '1px solid #bbf7d0',
                      bgcolor: active ? '#ecfdf5' : '#ffffff',
                      boxShadow: active ? '0 8px 20px rgba(16,185,129,.12)' : 'none'
                    }}
                  >
                    <CardContent sx={{ p: 1.6 }}>
                      <Typography sx={{ fontWeight: 800, color: '#064e3b', fontSize: 14.5 }}>{item.label}</Typography>
                      <Typography sx={{ mt: 0.5, fontSize: 24, fontWeight: 900, color: '#065f46' }}>{formatNumber(item.total)}</Typography>
                      <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700 }}>{pct}% del total</Typography>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, pct)}
                        sx={{ mt: 1, height: 8, borderRadius: 10, bgcolor: '#dcfce7', '& .MuiLinearProgress-bar': { bgcolor: '#10b981' } }}
                      />
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>

          <Grid container spacing={1.4}>
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 1.4, borderRadius: 2, border: '1px solid #bbf7d0', bgcolor: '#fff' }}>
                <Typography sx={{ fontWeight: 700, color: '#065f46', mb: 1 }}>
                  {detalleActivo ? `Top programas - ${detalleActivo}` : 'Top programas'}
                </Typography>
                {programasDetalle.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#64748b' }}>Sin datos para el detalle seleccionado.</Typography>
                ) : (
                  <Stack spacing={0.9}>
                    {programasDetalle.map((item) => {
                      const pct = totalDetalleActivo > 0 ? Math.round((item.total / totalDetalleActivo) * 100) : 0;
                      return (
                        <Box key={item.label}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 600 }}>{item.label}</Typography>
                            <Typography variant="body2" sx={{ color: '#065f46', fontWeight: 800 }}>{formatNumber(item.total)}</Typography>
                          </Stack>
                          <LinearProgress
                            variant="determinate"
                            value={Math.min(100, pct)}
                            sx={{ mt: 0.5, height: 6, borderRadius: 10, bgcolor: '#ecfdf5', '& .MuiLinearProgress-bar': { bgcolor: '#22c55e' } }}
                          />
                        </Box>
                      );
                    })}
                  </Stack>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} md={6}>
              <Paper elevation={0} sx={{ p: 1.4, borderRadius: 2, border: '1px solid #bbf7d0', bgcolor: '#fff', height: '100%' }}>
                <Typography sx={{ fontWeight: 700, color: '#065f46', mb: 1 }}>Tendencia anual (Cantidad Total Egresados)</Typography>
                <Box sx={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.porAnio}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <RechartsTooltip formatter={(value) => [formatNumber(value), 'Egresados']} />
                      <Bar dataKey="total" radius={[8, 8, 0, 0]} fill="#10b981">
                        <LabelList dataKey="total" position="top" formatter={(value) => formatNumber(value)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Stack>
      </Paper>
    );
  };

  const renderPoblacionalHub = () => (
    <Stack spacing={2.2}>
      <Paper elevation={0} sx={{ p: 2.5, border: '1px solid #dbe6f5', borderRadius: 3, background: 'linear-gradient(120deg, #f8fbff 0%, #eef6ff 100%)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setSelectedCard(null)}>Volver a tarjetas</Button>
            <Chip label="Modulo Poblacional" color="primary" variant="outlined" />
          </Stack>
          <Typography variant="caption" sx={{ color: '#64748b' }}>
            Selecciona un dashboard interno. Los permisos controlan qué tarjetas ve cada usuario.
          </Typography>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.2, md: 1.8 },
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          bgcolor: '#f8fbff'
        }}
      >
        <Box
          sx={{
            display: 'grid',
            gap: { xs: 1.2, md: 1.6, xl: 1.8 },
            gridTemplateColumns: {
              xs: '1fr',
              md: 'repeat(2, minmax(0, 1fr))',
              xl: 'repeat(3, minmax(0, 1fr))'
            },
            alignItems: 'stretch'
          }}
        >
        {visiblePoblacionalDashboardCards.map((card, index) => {
          const totalCards = visiblePoblacionalDashboardCards.length;
          const remainingDesktop = totalCards % 3;
          const remainingTablet = totalCards % 2;
          const isLastSingleDesktop = remainingDesktop === 1 && index === totalCards - 1;
          const isLastSingleTablet = remainingTablet === 1 && index === totalCards - 1;
          return (
            <Paper
              key={`pob-hub-${card.key}`}
              elevation={0}
              sx={{
                p: { xs: 1.4, md: 1.55, xl: 1.7 },
                borderRadius: 3.2,
                border: '1px solid #d7e4fb',
                background: 'linear-gradient(165deg, #ffffff 0%, #f7fbff 100%)',
                minHeight: { xs: 204, md: 214, xl: 220 },
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                boxShadow: '0 6px 20px rgba(15, 23, 42, 0.04)',
                transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                gridColumn: {
                  md: isLastSingleTablet ? 'span 2' : 'auto',
                  xl: isLastSingleDesktop ? 'span 3' : (isLastSingleTablet ? 'auto' : 'auto')
                },
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 12px 28px rgba(37, 99, 235, 0.10)',
                  borderColor: '#bcd0f7'
                }
              }}
            >
              <Box sx={{ minHeight: { xs: 114, md: 120 }, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ width: 48, height: 48, borderRadius: 2, bgcolor: `${card.color}16`, color: card.color, display: 'grid', placeItems: 'center', mb: 0.9, border: `1px solid ${card.color}22` }}>
                  <InsightsIcon />
                </Box>
                <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: { xs: 17, md: 17.5, xl: 18 }, lineHeight: 1.08, letterSpacing: '-0.02em' }}>
                  {card.title}
                </Typography>
                <Typography
                  sx={{
                    mt: 0.55,
                    color: '#475569',
                    fontSize: { xs: 13.5, xl: 14 },
                    lineHeight: 1.28,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                >
                  {card.description}
                </Typography>
                <Box sx={{ mt: 0.8 }}>
                  <Chip
                    size="small"
                    label={
                      card.type === 'analytics'
                        ? 'Disponible'
                        : card.type === 'embedded_saber_pro'
                          ? 'Integrado'
                          : card.type === 'summary'
                            ? 'Consolidado'
                            : 'Estructura base'
                    }
                    sx={{
                      height: 24,
                      fontWeight: 700,
                      bgcolor: `${card.color}12`,
                      color: card.color,
                      border: `1px solid ${card.color}26`
                    }}
                  />
                </Box>
              </Box>
              <Button
                sx={{
                  mt: 1.1,
                  minHeight: 40,
                  borderRadius: 999,
                  textTransform: 'none',
                  fontWeight: 800,
                  fontSize: 14,
                  letterSpacing: '-0.01em',
                  background: 'linear-gradient(135deg,#3b82f6,#2563eb)',
                  boxShadow: '0 8px 18px rgba(37,99,235,.22)'
                }}
                variant="contained"
                onClick={() => {
                  if (card.type === 'analytics') {
                    setStatSection(card.key);
                    setPoblacionalPanel('analytics');
                    return;
                  }
                  setPoblacionalPanel(card.key);
                }}
              >
                Abrir dashboard
              </Button>
            </Paper>
          );
        })}
        </Box>
      </Paper>
    </Stack>
  );

  const renderPoblacionalPlaceholderPanel = ({ title, description, templateHint }) => (
    <Stack spacing={2}>
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.6, md: 2 },
          border: '1px solid #d7e3f7',
          borderRadius: 3,
          background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #f7fbff 100%)'
        }}
      >
        <Stack
          direction={{ xs: 'column', lg: 'row' }}
          spacing={1.2}
          justifyContent="space-between"
          alignItems={{ xs: 'flex-start', lg: 'center' }}
        >
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setPoblacionalPanel('hub')}>
              Volver a dashboards Poblacional
            </Button>
            <Chip label="Estructura base" color="warning" variant="outlined" />
            <Chip label="Pendiente de datos" sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700 }} />
          </Stack>
          <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
            Importa la plantilla para activar visualizaciones y KPIs
          </Typography>
        </Stack>
      </Paper>

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, md: 2.4 },
          borderRadius: 3,
          border: '1px solid #e2e8f0',
          background: 'linear-gradient(180deg, #ffffff 0%, #fbfdff 100%)',
          overflow: 'hidden'
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
            <Stack spacing={1.1}>
              <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, color: '#0f172a', lineHeight: 1.15 }}>
                {title}
              </Typography>
              <Typography sx={{ color: '#475569', maxWidth: 680 }}>
                {description}
              </Typography>

              <Grid container spacing={1.2} sx={{ mt: 0.2 }}>
                {[
                  { label: 'Estado del tablero', value: 'Esperando importacion', tone: '#f59e0b' },
                  { label: 'Plantilla', value: 'Disponible', tone: '#2563eb' },
                  { label: 'Visualizacion', value: 'Se activa con datos', tone: '#0f766e' }
                ].map((item) => (
                  <Grid item xs={12} sm={4} key={item.label}>
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        border: '1px solid #e5edf6',
                        bgcolor: '#fff'
                      }}
                    >
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                        {item.label}
                      </Typography>
                      <Typography sx={{ mt: 0.35, color: '#0f172a', fontWeight: 800, fontSize: 14 }}>
                        {item.value}
                      </Typography>
                      <Box sx={{ mt: 0.8, height: 4, borderRadius: 999, bgcolor: `${item.tone}20` }}>
                        <Box sx={{ width: '100%', height: '100%', borderRadius: 999, bgcolor: item.tone }} />
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </Stack>
          </Grid>

          <Grid item xs={12} lg={5}>
            <Paper
              elevation={0}
              sx={{
                p: 1.6,
                borderRadius: 2.4,
                border: '1px dashed #a7b8d0',
                bgcolor: '#f8fbff',
                height: '100%'
              }}
            >
              <Typography sx={{ fontWeight: 800, color: '#1e293b', mb: 0.8 }}>
                Plantilla base lista para importar
              </Typography>
              <Typography variant="body2" sx={{ color: '#5b6b80', mb: 1.1 }}>
                {templateHint}
              </Typography>
              <Divider sx={{ my: 1.1 }} />
              <Stack spacing={0.9}>
                {[
                  'Ve a "Gestion de bases de datos" > Poblacional.',
                  'Selecciona la subbase correspondiente y carga el archivo Excel.',
                  'Vuelve a este dashboard para ver KPIs, tendencias y comparativos.'
                ].map((step, idx) => (
                  <Stack key={step} direction="row" spacing={1} alignItems="flex-start">
                    <Chip
                      size="small"
                      label={idx + 1}
                      sx={{ height: 22, minWidth: 22, fontWeight: 800, bgcolor: '#dbeafe', color: '#1d4ed8' }}
                    />
                    <Typography variant="body2" sx={{ color: '#475569', pt: 0.15 }}>
                      {step}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </Paper>
    </Stack>
  );

  const renderDesercionDashboardPanel = () => {
    const parsed = desercionRows.map((row) => {
      const meta = parseObservacionesToMap(row.observaciones);
      return {
        ...row,
        tipo: String(meta.tipo || 'SIN TIPO').trim().toUpperCase(),
        periodoRef: meta.periodo_ref || '',
        corte: String(meta.corte || '').trim(),
        corteNorm: String(meta.corte || '').trim().toUpperCase(),
        metric: normalizeMetricKey(row.indicador),
        valorNum: normalizeNumber(row.valor)
      };
    });

    const programas = Array.from(new Set(parsed.map((r) => String(r.programa || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    const tipoOrder = { PERIODO: 1, COHORTE: 2, ANUAL: 3 };
    const tipos = ['Todos', ...Array.from(new Set(parsed.map((r) => r.tipo).filter(Boolean)))
      .sort((a, b) => (tipoOrder[a] || 99) - (tipoOrder[b] || 99) || a.localeCompare(b, 'es'))];
    const tipoActivo = String(desercionUi.tipo || 'Todos').trim().toUpperCase();
    const corteCohorteActivo = String(desercionUi.corteCohorte || 'Todos').trim().toUpperCase();
    const isAnnualView = tipoActivo === 'ANUAL';
    const getDesercionSeriesLabel = (row) => {
      if (isAnnualView) return String(Number(row.anio) || '').trim() || 'Sin año';
      return formatDesercionPeriodDisplay(row.periodoRef, row.anio);
    };
    const getDesercionSeriesOrder = (row) => {
      if (isAnnualView) return (Number(row.anio) || 0) * 10;
      const rawPeriod = String(row.periodoRef || '').trim() || `${row.anio || ''}`.trim() || 'Sin periodo';
      const parsedPeriod = parseDesercionPeriodReference(rawPeriod, row.anio);
      return (parsedPeriod.year || 0) * 10 + (parsedPeriod.slot || 1);
    };
    const filteredByMain = parsed.filter((r) =>
      (!desercionUi.programa || r.programa === desercionUi.programa) &&
      (tipoActivo === 'TODOS' || r.tipo === tipoActivo)
    );
    const cortesCohorte = Array.from(new Set(
      filteredByMain
        .filter((r) => r.tipo === 'COHORTE')
        .map((r) => String(r.corte || '').trim())
        .filter(Boolean)
    )).sort((a, b) => a.localeCompare(b, 'es'));

    const periodCatalogMap = new Map();
    filteredByMain
      .filter((r) => tipoActivo !== 'COHORTE' || corteCohorteActivo === 'TODOS' || r.corteNorm === corteCohorteActivo)
      .forEach((r) => {
        const normalizedLabel = getDesercionSeriesLabel(r);
        const order = getDesercionSeriesOrder(r);
        const existing = periodCatalogMap.get(normalizedLabel);
        if (!existing || order > existing.order) {
          periodCatalogMap.set(normalizedLabel, {
            label: normalizedLabel,
            rawLabel: normalizedLabel,
            order
          });
        }
      });
    const periodOptions = Array.from(periodCatalogMap.values()).sort((a, b) => a.order - b.order);
    const selectedPeriods = (desercionUi.periodos || []).filter((item) => periodOptions.some((opt) => opt.label === item));

    const filtered = filteredByMain.filter((r) => {
      if (tipoActivo === 'COHORTE' && corteCohorteActivo !== 'TODOS' && r.corteNorm !== corteCohorteActivo) return false;
      if (!selectedPeriods.length) return true;
      const normalizedLabel = getDesercionSeriesLabel(r);
      return selectedPeriods.includes(normalizedLabel);
    });

    const pct1 = (v) => `${(Number(v) * 100).toFixed(1)}%`;
    const pct2 = (v) => `${(Number(v) * 100).toFixed(2)}%`;
    const periodMap = new Map();
    filtered.forEach((r) => {
      const periodLabel = getDesercionSeriesLabel(r);
      if (!periodMap.has(periodLabel)) {
        periodMap.set(periodLabel, {
          periodLabel,
          periodDisplay: periodLabel,
          periodOrder: getDesercionSeriesOrder(r),
          programa: null,
          institucional: null,
          departamental: null,
          nacional: null
        });
      }
      const target = periodMap.get(periodLabel);
      if (['programa', 'institucional', 'departamental', 'nacional'].includes(r.metric)) {
        target[r.metric] = r.valorNum;
      }
    });
    const byPeriod = Array.from(periodMap.values()).sort((a, b) => a.periodOrder - b.periodOrder);
    const visibleByPeriod = byPeriod;

    const latestPeriod = visibleByPeriod[visibleByPeriod.length - 1] || null;

    const programRankingMap = new Map();
    filtered
      .filter((r) => r.metric === 'programa')
      .forEach((r) => {
        const key = String(r.programa || 'Sin programa').trim() || 'Sin programa';
        if (!programRankingMap.has(key)) programRankingMap.set(key, { label: key, total: 0, registros: 0 });
        const row = programRankingMap.get(key);
        row.total += r.valorNum;
        row.registros += 1;
      });
    const rankingProgramas = Array.from(programRankingMap.values())
      .map((r) => ({ ...r, promedio: r.registros ? Number((r.total / r.registros).toFixed(4)) : 0 }))
      .sort((a, b) => b.promedio - a.promedio)
      .slice(0, 10);

    const comparisonLatest = latestPeriod ? [
      { label: 'Programa', valor: latestPeriod.programa, color: '#dc2626' },
      { label: 'Institucional', valor: latestPeriod.institucional, color: '#2563eb' },
      { label: 'Departamental', valor: latestPeriod.departamental, color: '#7c3aed' },
      { label: 'Nacional', valor: latestPeriod.nacional, color: '#f59e0b' }
    ] : [];
    const getDesercionAxisBoundsForKeys = (keys = [], minCap = 0.08) => {
      const vals = visibleByPeriod
        .flatMap((r) => keys.map((k) => Number(r?.[k])))
        .filter((v) => Number.isFinite(v) && v >= 0);
      if (!vals.length) return { min: 0, max: 0.3 };
      const maxVal = Math.max(...vals);
      const paddedMax = maxVal + Math.max(maxVal * 0.2, 0.01);
      return {
        min: 0,
        max: Math.min(1, Math.max(minCap, Math.ceil(paddedMax * 100) / 100))
      };
    };
    const desercionMainAxisBounds = getDesercionAxisBoundsForKeys(['programa'], 0.08);
    const desercionAxisBounds = (() => {
      const vals = visibleByPeriod.flatMap((r) => [r.programa, r.institucional, r.departamental, r.nacional])
        .map((v) => Number(v))
        .filter((v) => Number.isFinite(v));
      if (!vals.length) return { min: 0, max: 0.3 };
      const minVal = Math.min(...vals);
      const maxVal = Math.max(...vals);
      const span = Math.max(maxVal - minVal, 0.01);
      const pad = Math.max(span * 0.15, 0.01);
      const min = Math.max(0, minVal - pad);
      const max = Math.min(1, maxVal + pad);
      return {
        min: Math.floor(min * 100) / 100,
        max: Math.ceil(max * 100) / 100
      };
    })();
    const pairCharts = [
      {
        key: 'nacional',
        title: 'Programa vs Nacional',
        subtitle: 'Comparacion directa de la desercion del programa frente al referente nacional.',
        leftKey: 'programa',
        rightKey: 'nacional',
        leftLabel: 'Programa',
        rightLabel: 'Nacional',
        leftColor: '#dc2626',
        rightColor: '#f59e0b'
      },
      {
        key: 'departamental',
        title: 'Programa vs Departamental',
        subtitle: 'Lectura del comportamiento del programa frente al contexto departamental.',
        leftKey: 'programa',
        rightKey: 'departamental',
        leftLabel: 'Programa',
        rightLabel: 'Departamental',
        leftColor: '#dc2626',
        rightColor: '#7c3aed'
      },
      {
        key: 'institucional',
        title: 'Programa vs Institucional',
        subtitle: 'Comparacion con la referencia institucional de la universidad.',
        leftKey: 'programa',
        rightKey: 'institucional',
        leftLabel: 'Programa',
        rightLabel: 'Institucional',
        leftColor: '#dc2626',
        rightColor: '#2563eb'
      }
    ];

    const dataAvailable = Boolean(desercionRows.length);
    const qualityItems = [
      { label: 'Registros analizados', value: filtered.length || parsed.length, caption: 'Filas utiles para visualizacion' },
      { label: 'Programas detectados', value: programas.length, caption: 'Oferta identificada en la base' },
      { label: isAnnualView ? 'Años / cortes' : 'Periodos / cortes', value: visibleByPeriod.length, caption: 'Serie disponible segun filtros' }
    ];

    const periodYearCounts = visibleByPeriod.reduce((acc, row) => {
      const [yearRaw = ''] = String(row?.periodDisplay || '').split('-');
      const yearKey = String(yearRaw || '').trim();
      if (!yearKey) return acc;
      acc.set(yearKey, (acc.get(yearKey) || 0) + 1);
      return acc;
    }, new Map());
    const firstPeriodXByYear = new Map();

    const periodTickRenderer = (props) => {
      const { x, y, payload } = props || {};
      const value = String(payload?.value || '');
      if (x == null || y == null || !value) return null;
      const [yearRaw = value, partRaw = ''] = value.split('-');
      const year = String(yearRaw || '').trim() || value;
      const normalizedPart = String(partRaw || '').trim().toUpperCase();
      const part = normalizedPart === '1' ? 'I' : normalizedPart === '2' ? 'II' : (normalizedPart || 'I');
      const yearCount = periodYearCounts.get(year) || 1;
      const showYearBox = isAnnualView || yearCount <= 1 || part === 'II';
      const pairWidth = 76;
      const yearWidth = yearCount > 1
        ? pairWidth
        : Math.max(44, Math.min(58, year.length * 7 + 12));
      const partWidth = 24;
      if (!isAnnualView && yearCount > 1 && part === 'I') {
        firstPeriodXByYear.set(year, Number(x));
      }
      const firstX = firstPeriodXByYear.get(year);
      const pairCenterOffset = !isAnnualView && yearCount > 1 && part === 'II' && Number.isFinite(firstX)
        ? ((firstX + Number(x)) / 2) - Number(x)
        : 0;
      return (
        <g transform={`translate(${x},${y})`}>
          {!isAnnualView && (
            <>
              <rect
                x={-partWidth / 2}
                y={8}
                width={partWidth}
                height={16}
                rx={8}
                fill="#e2e8f0"
                stroke="#d1dbe8"
              />
              <text
                x={0}
                y={20}
                textAnchor="middle"
                fontSize="10"
                fontWeight="800"
                fill="#334155"
              >
                {part}
              </text>
            </>
          )}
          {showYearBox && (
            <>
              <rect
                x={(-yearWidth / 2) + pairCenterOffset}
                y={isAnnualView ? 10 : 30}
                width={yearWidth}
                height={18}
                rx={0}
                fill="#f8fafc"
                stroke="#94a3b8"
              />
              <text
                x={pairCenterOffset}
                y={isAnnualView ? 23 : 43}
                textAnchor="middle"
                fontSize="10"
                fontWeight="700"
                fill="#0f172a"
              >
                {year}
              </text>
            </>
          )}
        </g>
      );
    };

    const downloadChartAsPng = async (chartDomId, fileBaseName) => {
      try {
        const root = document.getElementById(chartDomId);
        const svg = root?.querySelector('svg');
        if (!root || !svg) {
          enqueueSnackbar('No fue posible encontrar el gráfico para descargar', { variant: 'warning' });
          return;
        }

        const rect = root.getBoundingClientRect();
        const width = Math.max(640, Math.round(rect.width));
        const height = Math.max(360, Math.round(rect.height));
        const scale = 3;

        const clone = svg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', String(width));
        clone.setAttribute('height', String(height));

        const serializer = new XMLSerializer();
        const svgText = serializer.serializeToString(clone);
        const svgBlob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = width * scale;
          canvas.height = height * scale;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            URL.revokeObjectURL(url);
            enqueueSnackbar('No fue posible generar la imagen', { variant: 'error' });
            return;
          }

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.scale(scale, scale);
          ctx.drawImage(img, 0, 0, width, height);
          URL.revokeObjectURL(url);

          canvas.toBlob((blob) => {
            if (!blob) {
              enqueueSnackbar('No fue posible exportar el gráfico', { variant: 'error' });
              return;
            }
            const blobUrl = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = `${fileBaseName || 'grafico'}_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.png`;
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(blobUrl);
          }, 'image/png');
        };
        img.onerror = () => {
          URL.revokeObjectURL(url);
          enqueueSnackbar('Error al renderizar el gráfico para descarga', { variant: 'error' });
        };
        img.src = url;
      } catch (err) {
        enqueueSnackbar('Error al descargar el gráfico', { variant: 'error' });
      }
    };

    const chartHeaderActions = (chartKey, title, chartDomId, fileBaseName) => (
      <Stack direction="row" spacing={0.5}>
        <Tooltip title="Descargar PNG (HD)">
          <IconButton
            size="small"
            onClick={() => downloadChartAsPng(chartDomId, fileBaseName)}
            sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', '&:hover': { bgcolor: '#f8fafc' } }}
          >
            <DownloadIconSmall fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={`Ampliar ${title}`}>
          <IconButton
            size="small"
            onClick={() => setDesercionZoom({ open: true, chartKey })}
            sx={{ border: '1px solid #e2e8f0', bgcolor: '#fff', '&:hover': { bgcolor: '#f8fafc' } }}
          >
            <ZoomInIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Stack>
    );

    const renderMainPeriodChart = (height = { xs: 300, md: 340 }, chartDomId = '') => {
      return (
      <Box id={chartDomId || undefined} sx={{ height, maxWidth: 920, mx: 'auto', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={visibleByPeriod} margin={{ top: 20, right: 18, left: 8, bottom: 34 }} barGap={2} barCategoryGap="14%">
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe7f5" />
            <XAxis
              dataKey="periodDisplay"
              padding={{ left: 12, right: 12 }}
              tickMargin={10}
              interval={0}
              tick={periodTickRenderer}
              height={isAnnualView ? 48 : 72}
              minTickGap={6}
            />
            <YAxis
              domain={[desercionMainAxisBounds.min, desercionMainAxisBounds.max]}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              width={56}
              tickMargin={8}
              tick={{ fontSize: 11, fill: '#475569' }}
            />
            <RechartsTooltip
              formatter={(value, name) => [pct2(value), name]}
              labelFormatter={(label, payload) => payload?.[0]?.payload?.periodDisplay || label}
            />
            <Bar dataKey="programa" name="Programa" fill="#2563eb" radius={[0, 0, 0, 0]} maxBarSize={50}>
              <LabelList
                dataKey="programa"
                position="insideTop"
                offset={6}
                formatter={(v) => pct2(v)}
                style={{ fontSize: 10, fontWeight: 900, fill: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
      );
    };

    const renderLatestComparisonChart = (height = { xs: 220, sm: 200 }, chartDomId = '') => (
      <Box id={chartDomId || undefined} sx={{ height, maxWidth: 560, mx: 'auto', width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonLatest} margin={{ top: 20, right: 10, left: 0, bottom: 8 }} barCategoryGap="24%">
            <CartesianGrid strokeDasharray="3 3" stroke="#dbe7f5" />
            <XAxis dataKey="label" hide />
            <YAxis
              domain={[desercionAxisBounds.min, desercionAxisBounds.max]}
              tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
              width={50}
              tick={{ fontSize: 11, fill: '#475569' }}
            />
            <RechartsTooltip formatter={(v) => [pct2(v), 'Tasa']} />
            <Bar dataKey="valor" radius={[0, 0, 0, 0]} maxBarSize={48}>
              {comparisonLatest.map((entry) => <Cell key={entry.label} fill={entry.color} />)}
              <LabelList
                dataKey="valor"
                position="insideTop"
                offset={8}
                formatter={(v) => pct2(v)}
                style={{ fontSize: 11, fontWeight: 900, fill: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Box>
    );

    const renderPairChart = (panel, height = 235, chartDomId = '') => {
      const hasAnyData = visibleByPeriod.some((r) => Number.isFinite(Number(r[panel.leftKey])) || Number.isFinite(Number(r[panel.rightKey])));
      if (!hasAnyData) {
        return (
          <Stack alignItems="center" justifyContent="center" sx={{ height: '100%' }}>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Sin datos suficientes para este comparativo.
            </Typography>
          </Stack>
        );
      }
      const pairAxisBounds = getDesercionAxisBoundsForKeys([panel.leftKey, panel.rightKey], 0.1);
        return (
            <Box id={chartDomId || undefined} sx={{ height, maxWidth: 960, mx: 'auto', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
            <BarChart data={visibleByPeriod} margin={{ top: 20, right: 14, left: 8, bottom: 34 }} barGap={-2} barCategoryGap="0%">
              <CartesianGrid strokeDasharray="3 3" stroke="#dbe7f5" />
              <XAxis
                dataKey="periodDisplay"
                padding={{ left: 10, right: 10 }}
                tickMargin={10}
                interval={0}
                tick={periodTickRenderer}
                height={isAnnualView ? 48 : 72}
                minTickGap={6}
              />
              <YAxis
                domain={[pairAxisBounds.min, pairAxisBounds.max]}
                tickFormatter={(v) => `${(Number(v) * 100).toFixed(0)}%`}
                tick={{ fontSize: 11, fill: '#475569' }}
                width={46}
                tickMargin={8}
              />
              <RechartsTooltip
                formatter={(v, name) => [pct2(v), name]}
                labelFormatter={(label) => `Periodo: ${label}`}
              />
              <Bar dataKey={panel.leftKey} name={panel.leftLabel} fill={panel.leftColor} radius={[0, 0, 0, 0]} barSize={36}>
                <LabelList
                  dataKey={panel.leftKey}
                  position="insideTop"
                  offset={5}
                  formatter={(v) => pct1(v)}
                  style={{ fontSize: 9, fontWeight: 900, fill: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
                />
              </Bar>
              <Bar dataKey={panel.rightKey} name={panel.rightLabel} fill={panel.rightColor} radius={[0, 0, 0, 0]} barSize={36}>
                <LabelList
                  dataKey={panel.rightKey}
                  position="insideTop"
                  offset={5}
                  formatter={(v) => pct1(v)}
                  style={{ fontSize: 9, fontWeight: 900, fill: '#ffffff', textShadow: '0 1px 2px rgba(0,0,0,.35)' }}
                />
              </Bar>
          </BarChart>
          </ResponsiveContainer>
        </Box>
      );
    };

    const zoomConfigs = {
      trend: {
        title: isAnnualView ? 'Desercion anual del programa' : 'Desercion por periodo del programa',
        subtitle: isAnnualView ? 'Vista ampliada de la serie anual filtrada.' : 'Vista ampliada de la serie filtrada por periodos visibles.',
        content: renderMainPeriodChart({ xs: 420, md: 540 })
      },
      latest_compare: {
        title: isAnnualView ? 'Comparativo ultimo año' : 'Comparativo ultimo corte',
        subtitle: isAnnualView ? 'Comparativo ampliado de referencias para el ultimo año visible.' : 'Comparativo ampliado de referencias para el ultimo periodo visible.',
        content: renderLatestComparisonChart({ xs: 360, md: 460 })
      },
      pair_nacional: {
        title: 'Programa vs Nacional',
        subtitle: 'Comparativo ampliado.',
        content: renderPairChart(pairCharts[0], 460)
      },
      pair_departamental: {
        title: 'Programa vs Departamental',
        subtitle: 'Comparativo ampliado.',
        content: renderPairChart(pairCharts[1], 460)
      },
      pair_institucional: {
        title: 'Programa vs Institucional',
        subtitle: 'Comparativo ampliado.',
        content: renderPairChart(pairCharts[2], 460)
      }
    };

    return (
      <Stack spacing={2.2}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.6, md: 2 },
            border: '1px solid #dbe6f5',
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f8fbff 0%, #f3f7ff 46%, #eef4ff 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ position: 'absolute', right: -32, top: -42, width: 170, height: 170, borderRadius: '50%', bgcolor: 'rgba(37,99,235,0.08)' }} />
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setPoblacionalPanel('hub')}>
                  Volver a dashboards Poblacional
                </Button>
                <Chip label="Desercion" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800 }} />
                <Chip label={dataAvailable ? 'Dashboard activo' : 'Esperando datos'} sx={{ bgcolor: dataAvailable ? '#dcfce7' : '#fff7ed', color: dataAvailable ? '#166534' : '#c2410c', fontWeight: 700 }} />
              </Stack>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, color: '#0f172a', lineHeight: 1.15 }}>
                  Analitica de Desercion
                </Typography>
                <Typography sx={{ color: '#5b6578', mt: 0.35 }}>
                  {isAnnualView
                    ? 'Comparativo anual del programa frente a referentes institucional, departamental y nacional.'
                    : 'Comparativo del programa frente a referentes institucional, departamental y nacional por periodo/cohorte.'}
                </Typography>
              </Box>
            </Stack>
            <Grid container spacing={1} sx={{ width: { xs: '100%', lg: 760 }, maxWidth: '100%' }}>
              <Grid item xs={12} md={tipoActivo === 'COHORTE' ? 4 : 5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="desercion-programa-label">Programa</InputLabel>
                  <Select
                    labelId="desercion-programa-label"
                    displayEmpty
                    label="Programa"
                    value={desercionUi.programa}
                    onChange={(e) => setDesercionUi((prev) => ({ ...prev, programa: e.target.value }))}
                    renderValue={(v) => v || 'Todos los programas'}
                  >
                    <MenuItem value="">Todos los programas</MenuItem>
                    {programas.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="desercion-tipo-label">Vista</InputLabel>
                  <Select
                    labelId="desercion-tipo-label"
                    label="Vista"
                    value={desercionUi.tipo}
                    onChange={(e) => setDesercionUi((prev) => ({ ...prev, tipo: e.target.value }))}
                  >
                    {tipos.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              {tipoActivo === 'COHORTE' && (
                <Grid item xs={12} md={3}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="desercion-cohorte-corte-label">Cohorte</InputLabel>
                    <Select
                      labelId="desercion-cohorte-corte-label"
                      label="Cohorte"
                      value={desercionUi.corteCohorte}
                      onChange={(e) => setDesercionUi((prev) => ({ ...prev, corteCohorte: e.target.value }))}
                    >
                      <MenuItem value="Todos">Todos</MenuItem>
                      {cortesCohorte.map((c) => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
              )}
              <Grid item xs={12} md={tipoActivo === 'COHORTE' ? 12 : 4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="desercion-periodos-label">Periodos a mostrar</InputLabel>
                  <Select
                    labelId="desercion-periodos-label"
                    multiple
                    value={selectedPeriods}
                    label="Periodos a mostrar"
                    onChange={(e) => {
                      const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                      if (value.includes('__ALL__')) {
                        const allSelected = selectedPeriods.length === periodOptions.length && periodOptions.length > 0;
                        setDesercionUi((prev) => ({ ...prev, periodos: allSelected ? [] : periodOptions.map((p) => p.label) }));
                        return;
                      }
                      setDesercionUi((prev) => ({ ...prev, periodos: value.filter((v) => v !== '__ALL__') }));
                    }}
                    renderValue={(vals) => {
                      const arr = Array.isArray(vals) ? vals : [];
                      if (!arr.length) return 'Todos los periodos';
                      if (arr.length <= 3) return arr.join(', ');
                      return `${arr.length} periodos seleccionados`;
                    }}
                  >
                    <MenuItem value="__ALL__" onClick={() => {
                      const allSelected = selectedPeriods.length === periodOptions.length && periodOptions.length > 0;
                      setDesercionUi((prev) => ({ ...prev, periodos: allSelected ? [] : periodOptions.map((p) => p.label) }));
                    }}>
                      <Checkbox checked={periodOptions.length > 0 && selectedPeriods.length === periodOptions.length} />
                      <ListItemText primary="Todos los periodos" />
                    </MenuItem>
                    {periodOptions.map((p) => (
                      <MenuItem key={p.label} value={p.label}>
                        <Checkbox checked={selectedPeriods.includes(p.label)} />
                        <ListItemText primary={p.label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Stack>
        </Paper>

        {!desercionRows.length ? (
          renderPoblacionalPlaceholderPanel({
            title: 'Dashboard de Deserción',
            description: 'Aún no hay datos importados en la subbase Deserción.',
            templateHint: 'Importa el archivo con hojas DESERCION_POR_PERIODO y DESERCION_POR_COHORTE.'
          })
        ) : (
          <>
            <Grid container spacing={1.4}>
              {[
                { label: 'Tasa programa', value: latestPeriod?.programa, color: '#dc2626', sub: isAnnualView ? 'Ultimo año visible' : 'Ultimo periodo visible' },
                { label: 'Tasa institucional', value: latestPeriod?.institucional, color: '#2563eb', sub: 'Referencia interna' },
                { label: 'Tasa nacional', value: latestPeriod?.nacional, color: '#f59e0b', sub: 'Referencia externa' },
                { label: 'Brecha vs institucional', value: latestPeriod ? (latestPeriod.programa - latestPeriod.institucional) : null, color: '#7c3aed', sub: 'Diferencia en puntos porcentuales', pp: true }
              ].map((kpi) => (
                <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.6,
                      borderRadius: 2.6,
                      border: '1px solid #e5edf7',
                      bgcolor: '#fff',
                      height: '100%',
                      boxShadow: '0 8px 22px rgba(15,23,42,0.04)'
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                        {kpi.label}
                      </Typography>
                      <Chip size="small" label={latestPeriod?.periodDisplay || '-'} sx={{ height: 22, bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700, maxWidth: 120 }} />
                    </Stack>
                    <Typography sx={{ mt: 0.75, fontWeight: 900, fontSize: 26, color: '#0f172a', lineHeight: 1.05 }}>
                      {kpi.value === null || kpi.value === undefined ? '-' : (kpi.pp ? `${(Number(kpi.value) * 100).toFixed(2)} pp` : `${(Number(kpi.value) * 100).toFixed(2)}%`)}
                    </Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: '#64748b' }}>{kpi.sub}</Typography>
                    <Box sx={{ mt: 0.8, height: 4, borderRadius: 99, bgcolor: `${kpi.color}22` }}>
                      <Box sx={{ width: '100%', height: '100%', borderRadius: 99, bgcolor: kpi.color }} />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={1.6} alignItems="stretch">
              <Grid item xs={12} lg={8}>
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2.8, border: '1px solid #e2e8f0', bgcolor: '#fff', height: '100%' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.8} sx={{ mb: 1.2 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>{isAnnualView ? 'Desercion anual del programa' : 'Desercion por periodo del programa'}</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        {isAnnualView
                          ? 'Serie anual del programa según el filtro seleccionado.'
                          : 'Fechas entre enero y junio se normalizan a `AAAA-I`; fechas entre julio y diciembre se normalizan a `AAAA-II`.'}
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap alignItems="center">
                      {[{ label: 'Programa', color: '#dc2626' }].map((tag) => (
                        <Chip
                          key={tag.label}
                          size="small"
                          label={tag.label}
                          sx={{ bgcolor: `${tag.color}16`, color: tag.color, fontWeight: 700, border: `1px solid ${tag.color}30` }}
                        />
                      ))}
                      {chartHeaderActions('trend', 'serie de desercion', 'desercion-chart-trend', 'desercion_tendencia')}
                    </Stack>
                  </Stack>
                  {renderMainPeriodChart({ xs: 330, md: 410 }, 'desercion-chart-trend')}
                </Paper>
              </Grid>
              <Grid item xs={12} lg={4}>
                <Stack spacing={1.6} sx={{ height: '100%' }}>
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.2 }}>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>{isAnnualView ? 'Comparativo ultimo año' : 'Comparativo ultimo corte'}</Typography>
                    {chartHeaderActions('latest_compare', isAnnualView ? 'comparativo del ultimo año' : 'comparativo del ultimo corte', 'desercion-chart-latest', 'desercion_comparativo_ultimo')}
                  </Stack>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                    {isAnnualView ? 'Snapshot de referencias para el año seleccionado.' : 'Snapshot de referencias para el corte seleccionado.'}
                  </Typography>
                  {renderLatestComparisonChart({ xs: 220, sm: 200 }, 'desercion-chart-latest')}
                </Paper>
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff', flex: 1, minHeight: 250 }}>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 0.2 }}>Programas con mayor desercion</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>Promedio historico de la tasa de desercion por programa.</Typography>
                  <Stack spacing={0.9}>
                    {rankingProgramas.slice(0, Math.min(Math.max(Number(desercionUi.rankingLimit) || 7, 3), 12)).map((item) => (
                      <Box key={item.label}>
                        <Stack direction="row" justifyContent="space-between" spacing={1}>
                          <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 600 }}>{item.label}</Typography>
                          <Typography variant="body2" sx={{ color: '#b91c1c', fontWeight: 800 }}>{(item.promedio * 100).toFixed(2)}%</Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={Math.min(100, item.promedio * 100)} sx={{ mt: 0.4, height: 6, borderRadius: 10, bgcolor: '#fee2e2', '& .MuiLinearProgress-bar': { bgcolor: '#ef4444' } }} />
                      </Box>
                    ))}
                  </Stack>
                </Paper>
                </Stack>
              </Grid>
            </Grid>

            <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2.8, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.8} sx={{ mb: 1.4 }}>
                <Box>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>
                    Comparativos individuales por referente
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>
                    Se separa cada comparacion para facilitar lectura, seguimiento y analisis del comportamiento.
                  </Typography>
                </Box>
                <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                  <Chip size="small" label="Orden sugerido: Programa vs Nacional" sx={{ bgcolor: '#fff7ed', color: '#c2410c', fontWeight: 700 }} />
                  <Chip size="small" label="Luego Departamental" sx={{ bgcolor: '#f5f3ff', color: '#6d28d9', fontWeight: 700 }} />
                  <Chip size="small" label="Finalmente Institucional" sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 700 }} />
                </Stack>
              </Stack>

              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: '1fr',
                  gap: 1.6
                }}
              >
                {pairCharts.map((panel) => {
                  const latestGap = latestPeriod
                    ? ((Number(latestPeriod[panel.leftKey]) || 0) - (Number(latestPeriod[panel.rightKey]) || 0))
                    : null;
                  return (
                    <Paper
                      key={panel.key}
                      elevation={0}
                      sx={{
                        p: 1.35,
                        borderRadius: 2.5,
                        border: '1px solid #e7edf6',
                        bgcolor: '#fcfdff',
                        minHeight: 460,
                        height: '100%',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.7)',
                        display: 'flex',
                        flexDirection: 'column'
                      }}
                    >
                        <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.8 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 16 }}>
                              {panel.title}
                            </Typography>
                            <Typography variant="body2" sx={{ color: '#64748b', fontSize: 12.8, lineHeight: 1.35 }}>
                              {panel.subtitle}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={latestGap === null ? '-' : `${(latestGap * 100).toFixed(2)} pp`}
                            sx={{
                              bgcolor: latestGap !== null && latestGap >= 0 ? '#dcfce7' : '#fee2e2',
                              color: latestGap !== null && latestGap >= 0 ? '#166534' : '#b91c1c',
                              fontWeight: 800
                            }}
                          />
                          {chartHeaderActions(`pair_${panel.key}`, panel.title, `desercion-chart-pair-${panel.key}`, `desercion_${panel.key}`)}
                        </Stack>

                        <Stack direction="row" spacing={0.8} sx={{ mb: 1 }} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={panel.leftLabel} sx={{ bgcolor: `${panel.leftColor}18`, color: panel.leftColor, fontWeight: 700 }} />
                          <Chip size="small" label={panel.rightLabel} sx={{ bgcolor: `${panel.rightColor}18`, color: panel.rightColor, fontWeight: 700 }} />
                        </Stack>

                        {renderPairChart(panel, 360, `desercion-chart-pair-${panel.key}`)}

                        <Grid container spacing={0.8} sx={{ mt: 'auto', pt: 0.7 }}>
                          <Grid item xs={6}>
                            <Paper elevation={0} sx={{ p: 0.9, borderRadius: 1.8, border: '1px solid #eef2f7', bgcolor: '#fff' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                                {panel.leftLabel} (ultimo año)
                              </Typography>
                              <Typography sx={{ mt: 0.25, fontWeight: 900, color: panel.leftColor, fontSize: 18 }}>
                                {latestPeriod ? `${((Number(latestPeriod[panel.leftKey]) || 0) * 100).toFixed(2)}%` : '-'}
                              </Typography>
                            </Paper>
                          </Grid>
                          <Grid item xs={6}>
                            <Paper elevation={0} sx={{ p: 0.9, borderRadius: 1.8, border: '1px solid #eef2f7', bgcolor: '#fff' }}>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                                {panel.rightLabel} (ultimo año)
                              </Typography>
                              <Typography sx={{ mt: 0.25, fontWeight: 900, color: panel.rightColor, fontSize: 18 }}>
                                {latestPeriod ? `${((Number(latestPeriod[panel.rightKey]) || 0) * 100).toFixed(2)}%` : '-'}
                              </Typography>
                            </Paper>
                          </Grid>
                        </Grid>
                      </Paper>
                  );
                })}
              </Box>
            </Paper>

            <Grid container spacing={1.6}>
              {qualityItems.map((item, idx) => (
                <Grid item xs={12} md={4} key={item.label}>
                  <Paper
                    elevation={0}
                    sx={{
                      p: 1.5,
                      borderRadius: 2.6,
                      border: '1px solid #e2e8f0',
                      bgcolor: idx === 0 ? '#fffaf9' : '#fff',
                      height: '100%'
                    }}
                  >
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                      {item.label}
                    </Typography>
                    <Typography sx={{ mt: 0.35, fontWeight: 900, color: '#0f172a', fontSize: 24 }}>
                      {formatNumber(item.value)}
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b' }}>
                      {item.caption}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}

        <Dialog
          open={desercionZoom.open}
          onClose={() => setDesercionZoom({ open: false, chartKey: '' })}
          fullWidth
          maxWidth="lg"
          PaperProps={{
            sx: {
              borderRadius: 3,
              border: '1px solid #e2e8f0',
              overflow: 'hidden'
            }
          }}
        >
          <DialogTitle sx={{ pb: 1, pr: 7 }}>
            <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>
              {zoomConfigs[desercionZoom.chartKey]?.title || 'Grafico ampliado'}
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              {zoomConfigs[desercionZoom.chartKey]?.subtitle || 'Vista ampliada para facilitar lectura y analisis.'}
            </Typography>
            <IconButton
              onClick={() => setDesercionZoom({ open: false, chartKey: '' })}
              sx={{ position: 'absolute', right: 12, top: 12, border: '1px solid #e2e8f0' }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>
          </DialogTitle>
          <DialogContent dividers sx={{ bgcolor: '#f8fafc' }}>
            <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
              {zoomConfigs[desercionZoom.chartKey]?.content || (
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  No hay grafico disponible.
                </Typography>
              )}
            </Paper>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDesercionZoom({ open: false, chartKey: '' })}>Cerrar</Button>
          </DialogActions>
        </Dialog>
      </Stack>
    );
  };

  const renderEmpleabilidadDashboardPanel = () => {
    const parsed = empleabilidadRows.map((row) => ({
      ...row,
      metric: normalizeMetricKey(row.indicador),
      valorNum: normalizeNumber(row.valor),
      ies: parseObservacionesToMap(row.observaciones).ies || ''
    }));

    const programas = Array.from(new Set(parsed.map((r) => String(r.programa || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    const filtered = parsed.filter((r) => !empleabilidadUi.programa || r.programa === empleabilidadUi.programa);

    const byYearMap = new Map();
    filtered.forEach((r) => {
      const anio = Number(r.anio) || 0;
      if (!anio) return;
      if (!byYearMap.has(anio)) byYearMap.set(anio, { anio, programa: 0, nacional: 0 });
      const target = byYearMap.get(anio);
      if (r.metric === 'programa') target.programa += r.valorNum;
      if (r.metric === 'nacional') target.nacional += r.valorNum;
    });
    const byYear = Array.from(byYearMap.values()).sort((a, b) => a.anio - b.anio);
    const latest = byYear[byYear.length - 1] || null;

    const latestRows = parsed.filter((r) => Number(r.anio) === Number(latest?.anio || 0));
    const rankingMap = new Map();
    latestRows.forEach((r) => {
      const key = String(r.programa || 'Sin programa').trim() || 'Sin programa';
      if (!rankingMap.has(key)) rankingMap.set(key, { label: key, programa: 0, nacional: 0 });
      const item = rankingMap.get(key);
      if (r.metric === 'programa') item.programa = r.valorNum;
      if (r.metric === 'nacional') item.nacional = r.valorNum;
    });
    const ranking = Array.from(rankingMap.values())
      .map((r) => ({ ...r, brecha: r.programa - r.nacional }))
      .sort((a, b) => b.brecha - a.brecha)
      .slice(0, 10);

    const lineData = byYear.map((r) => ({ ...r, brecha: r.programa - r.nacional }));

    const dataAvailable = Boolean(empleabilidadRows.length);
    const headerStats = [
      { label: 'Registros analizados', value: filtered.length || parsed.length, tone: '#0891b2' },
      { label: 'Programas detectados', value: programas.length, tone: '#2563eb' },
      { label: 'Años disponibles', value: byYear.length, tone: '#0f766e' }
    ];

    return (
      <Stack spacing={2.2}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.6, md: 2 },
            border: '1px solid #cdeafe',
            borderRadius: 3,
            background: 'linear-gradient(135deg, #effbff 0%, #f2fbff 48%, #f7fdff 100%)',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ position: 'absolute', left: -40, bottom: -60, width: 190, height: 190, borderRadius: '50%', bgcolor: 'rgba(8,145,178,0.08)' }} />
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setPoblacionalPanel('hub')}>
                  Volver a dashboards Poblacional
                </Button>
                <Chip label="Empleabilidad" sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 800 }} />
                <Chip label={dataAvailable ? 'Dashboard activo' : 'Esperando datos'} sx={{ bgcolor: dataAvailable ? '#dcfce7' : '#fff7ed', color: dataAvailable ? '#166534' : '#c2410c', fontWeight: 700 }} />
              </Stack>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, color: '#0f172a', lineHeight: 1.15 }}>
                  Analitica de Empleabilidad
                </Typography>
                <Typography sx={{ color: '#5b6578', mt: 0.35 }}>
                  Seguimiento de empleabilidad del programa frente al referente nacional con foco en brechas y tendencia.
                </Typography>
              </Box>
            </Stack>
            <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 360 }, width: { xs: '100%', lg: 'auto' } }}>
              <InputLabel id="empleabilidad-programa-label">Programa</InputLabel>
              <Select
                labelId="empleabilidad-programa-label"
                label="Programa"
                displayEmpty
                value={empleabilidadUi.programa}
                onChange={(e) => setEmpleabilidadUi({ programa: e.target.value })}
                renderValue={(v) => v || 'Todos los programas'}
              >
                <MenuItem value="">Todos los programas</MenuItem>
                {programas.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
              </Select>
            </FormControl>
          </Stack>
        </Paper>

        {!empleabilidadRows.length ? (
          renderPoblacionalPlaceholderPanel({
            title: 'Dashboard de Empleabilidad',
            description: 'Aún no hay datos importados en la subbase Empleabilidad.',
            templateHint: 'Importa la hoja BD_EMPLEABILIDAD.'
          })
        ) : (
          <>
            <Grid container spacing={1.4}>
              {[
                { label: 'Empleabilidad programa', value: latest?.programa, color: '#0891b2', sub: 'Ultimo año disponible' },
                { label: 'Referencia nacional', value: latest?.nacional, color: '#f59e0b', sub: 'Ultimo año disponible' },
                { label: 'Brecha vs nacional', value: latest ? (latest.programa - latest.nacional) : null, color: '#0f766e', sub: 'Puntos porcentuales', pp: true },
                { label: 'Año de corte', value: latest?.anio ?? '-', color: '#2563eb', plain: true }
              ].map((kpi) => (
                <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
                  <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2.6, border: '1px solid #e5edf7', bgcolor: '#fff', height: '100%', boxShadow: '0 8px 22px rgba(15,23,42,0.04)' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>{kpi.label}</Typography>
                    <Typography sx={{ mt: 0.6, fontWeight: 900, fontSize: 26, color: '#0f172a', lineHeight: 1.05 }}>
                      {kpi.plain ? kpi.value : (kpi.value === null || kpi.value === undefined ? '-' : (kpi.pp ? `${Number(kpi.value).toFixed(2)} pp` : `${Number(kpi.value).toFixed(2)}%`))}
                    </Typography>
                    {!kpi.plain && (
                      <Typography variant="body2" sx={{ mt: 0.35, color: '#64748b' }}>
                        {kpi.sub}
                      </Typography>
                    )}
                    <Box sx={{ mt: 0.8, height: 4, borderRadius: 99, bgcolor: `${kpi.color}22` }}>
                      <Box sx={{ width: '100%', height: '100%', borderRadius: 99, bgcolor: kpi.color }} />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={1.6}>
              <Grid item xs={12} xl={8}>
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2.8, border: '1px solid #e2e8f0', bgcolor: '#fff', height: '100%' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={0.8} sx={{ mb: 1.2 }}>
                    <Box>
                      <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Evolucion de empleabilidad</Typography>
                      <Typography variant="body2" sx={{ color: '#64748b' }}>
                        Comparativo del programa frente al promedio nacional y seguimiento de brecha.
                      </Typography>
                    </Box>
                    <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
                      <Chip size="small" label="Programa" sx={{ bgcolor: '#cffafe', color: '#155e75', fontWeight: 700 }} />
                      <Chip size="small" label="Nacional" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 700 }} />
                      <Chip size="small" label="Brecha" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 700 }} />
                    </Stack>
                  </Stack>
                  <Box sx={{ height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={lineData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="anio" />
                        <YAxis />
                        <RechartsTooltip formatter={(v) => [`${Number(v).toFixed(2)}%`, '']} />
                        <Line type="monotone" dataKey="programa" name="Programa" stroke="#0891b2" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="nacional" name="Nacional" stroke="#f59e0b" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="brecha" name="Brecha" stroke="#0f766e" strokeWidth={2} strokeDasharray="6 4" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} xl={4}>
                <Stack spacing={1.6} sx={{ height: '100%' }}>
                <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 0.2 }}>Ranking de brecha vs nacional</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>Programas con mayor diferencia positiva en el ultimo año.</Typography>
                  <Box sx={{ height: 360 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ranking.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 12, top: 6, bottom: 6 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="label" width={120} tick={{ fontSize: 11 }} />
                        <RechartsTooltip formatter={(v) => [`${Number(v).toFixed(2)} pp`, 'Brecha']} />
                        <Bar dataKey="brecha" radius={[0, 8, 8, 0]} fill="#06b6d4" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
                <Grid container spacing={1.2}>
                  {headerStats.map((item) => (
                    <Grid item xs={12} sm={4} xl={12} key={item.label}>
                      <Paper elevation={0} sx={{ p: 1.35, borderRadius: 2.4, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>
                          {item.label}
                        </Typography>
                        <Typography sx={{ mt: 0.4, fontWeight: 900, fontSize: 22, color: '#0f172a' }}>
                          {item.value}
                        </Typography>
                        <Box sx={{ mt: 0.75, height: 4, borderRadius: 999, bgcolor: `${item.tone}1f` }}>
                          <Box sx={{ width: '100%', height: '100%', borderRadius: 999, bgcolor: item.tone }} />
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
                </Stack>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    );
  };

  const renderResumenEstadisticoPanel = () => {
    const { rows, averageRow, visibleYears } = resumenEstadisticoEstudiantesRows;
    const totalInscritos = rows.reduce((acc, row) => acc + row.inscritos, 0);
    const totalAdmitidos = rows.reduce((acc, row) => acc + row.admitidos, 0);
    const totalPrimerCurso = rows.reduce((acc, row) => acc + row.primerCurso, 0);
    const totalGraduados = rows.reduce((acc, row) => acc + row.graduados, 0);
    const visibleYearsLabel = visibleYears.length
      ? `${Math.max(...visibleYears)} a ${Math.min(...visibleYears)}`
      : 'Sin años disponibles';
    const academicRows = buildAcademicYearRows(visibleYears);
    const annualRows = buildAnnualRows(visibleYears);
    const activeMasterModule = CUADROS_MAESTROS_MODULES.find((item) => item.key === resumenEstadisticoUi.module) || CUADROS_MAESTROS_MODULES[1];
    const isStudentMasterModule = activeMasterModule.key === 'estudiantes';
    const masterTablesByModule = {
      informacion_general: [
        {
          key: 'portada_general',
          title: 'Información General',
          subtitle: 'Mapa maestro de módulos y hojas base detectadas.',
          columns: [
            { key: 'modulo', label: 'Módulo' },
            { key: 'hojas', label: 'Hojas base' },
            { key: 'estado', label: 'Estado' },
            { key: 'observacion', label: 'Observación' }
          ],
          rows: CUADROS_MAESTROS_MODULES.filter((module) => module.key !== 'informacion_general').map((module) => ({
            modulo: module.label,
            hojas: module.sheets.map((sheet) => sheet.trim()).join(', '),
            estado: module.key === 'estudiantes' ? 'Integrado' : 'Diseñado',
            observacion: module.key === 'estudiantes' ? 'Con datos visibles y exportación activa.' : 'Tabla estructurada y lista para llenado estadístico.'
          }))
        }
      ],
      estudiantes: [
        {
          key: 'estudiantes',
          title: 'Cuadros Maestros de Estudiantes',
          subtitle: `Filtro actual: ${resumenEstadisticoUi.programa || 'Todos los programas'}.`,
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'periodo', label: 'Período académico' },
            { key: 'inscritos', label: 'Inscritos', type: 'number' },
            { key: 'admitidos', label: 'Admitidos', type: 'number' },
            { key: 'tasaSelectividad', label: 'Tasa de selectividad', type: 'rate' },
            { key: 'matriculados', label: 'Matriculados', type: 'number' },
            { key: 'primerCurso', label: 'Primer curso', type: 'number' },
            { key: 'tasaAbsorcion', label: 'Tasa de absorción', type: 'rate' },
            { key: 'graduados', label: 'N° total de graduados', type: 'number' },
            { key: 'desercionSpadies', label: 'Tasa de deserción programa anual según SPADIES', type: 'rate' },
            { key: 'promedioSaberPro', label: 'Promedio del puntaje global del Programa en Saber Pro', type: 'number' },
            { key: 'movilidadSalienteNacional', label: 'Movilidad saliente nacional', type: 'number' },
            { key: 'movilidadSalienteInternacional', label: 'Movilidad saliente internacional', type: 'number' },
            { key: 'movilidadEntranteNacional', label: 'Movilidad entrante nacional', type: 'number' },
            { key: 'movilidadEntranteInternacional', label: 'Movilidad entrante internacional', type: 'number' }
          ],
          rows,
          averageRow
        }
      ],
      profesores: [
        {
          key: 'profesores_detallado',
          title: 'Profesores Listado Detallado',
          subtitle: 'Base estructurada para detalle de profesores por año y periodo.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'periodo', label: 'Período académico' },
            { key: 'planta', label: 'Planta', type: 'number' },
            { key: 'tiempoCompleto', label: 'Tiempo completo', type: 'number' },
            { key: 'medioTiempo', label: 'Medio tiempo', type: 'number' },
            { key: 'catedra', label: 'Cátedra', type: 'number' },
            { key: 'doctores', label: 'Doctores', type: 'number' },
            { key: 'magister', label: 'Magíster', type: 'number' }
          ],
          rows: academicRows.map((row) => ({ ...row, planta: 0, tiempoCompleto: 0, medioTiempo: 0, catedra: 0, doctores: 0, magister: 0 }))
        },
        {
          key: 'profesores_resumen',
          title: 'Profesores Resumen Contractual y Formativo',
          subtitle: 'Resumen base para composición contractual y nivel de formación.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'vinculacion', label: 'Tipo de vinculación' },
            { key: 'cantidad', label: 'Cantidad', type: 'number' },
            { key: 'participacion', label: 'Participación %', type: 'rate' }
          ],
          rows: annualRows.flatMap((row) => ([
            { anio: row.anio, vinculacion: 'Planta', cantidad: 0, participacion: 0 },
            { anio: row.anio, vinculacion: 'Tiempo completo', cantidad: 0, participacion: 0 },
            { anio: row.anio, vinculacion: 'Cátedra', cantidad: 0, participacion: 0 }
          ]))
        }
      ],
      movilidad: [
        {
          key: 'movilidad_profesores',
          title: 'Profesores Movilidad',
          subtitle: 'Estructura de movilidad docente.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'periodo', label: 'Período académico' },
            { key: 'salienteNacional', label: 'Saliente nacional', type: 'number' },
            { key: 'salienteInternacional', label: 'Saliente internacional', type: 'number' },
            { key: 'entranteNacional', label: 'Entrante nacional', type: 'number' },
            { key: 'entranteInternacional', label: 'Entrante internacional', type: 'number' }
          ],
          rows: academicRows.map((row) => ({ ...row, salienteNacional: 0, salienteInternacional: 0, entranteNacional: 0, entranteInternacional: 0 }))
        },
        {
          key: 'movilidad_estudiantes',
          title: 'Estudiantes Movilidad',
          subtitle: 'Estructura de movilidad estudiantil.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'periodo', label: 'Período académico' },
            { key: 'salienteNacional', label: 'Saliente nacional', type: 'number' },
            { key: 'salienteInternacional', label: 'Saliente internacional', type: 'number' },
            { key: 'entranteNacional', label: 'Entrante nacional', type: 'number' },
            { key: 'entranteInternacional', label: 'Entrante internacional', type: 'number' }
          ],
          rows: academicRows.map((row) => ({ ...row, salienteNacional: 0, salienteInternacional: 0, entranteNacional: 0, entranteInternacional: 0 }))
        }
      ],
      investigacion: [
        {
          key: 'investigacion_grupos',
          title: 'Investigación, grupos y profesores',
          subtitle: 'Tabla base para consolidado anual de investigación.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'grupos', label: 'Grupos de investigación', type: 'number' },
            { key: 'profesores', label: 'Profesores investigadores', type: 'number' },
            { key: 'semilleros', label: 'Semilleros', type: 'number' },
            { key: 'proyectos', label: 'Proyectos', type: 'number' },
            { key: 'productos', label: 'Productos', type: 'number' }
          ],
          rows: annualRows.map((row) => ({ ...row, grupos: 0, profesores: 0, semilleros: 0, proyectos: 0, productos: 0 }))
        }
      ],
      bienestar: [
        {
          key: 'bienestar_estadisticas',
          title: 'Estadísticas de Bienestar',
          subtitle: 'Tabla base de cobertura y atención.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'periodo', label: 'Período académico' },
            { key: 'estudiantesAtendidos', label: 'Estudiantes atendidos', type: 'number' },
            { key: 'docentesAtendidos', label: 'Docentes atendidos', type: 'number' },
            { key: 'administrativosAtendidos', label: 'Administrativos atendidos', type: 'number' },
            { key: 'actividades', label: 'Actividades / jornadas', type: 'number' }
          ],
          rows: academicRows.map((row) => ({ ...row, estudiantesAtendidos: 0, docentesAtendidos: 0, administrativosAtendidos: 0, actividades: 0 }))
        }
      ],
      proyeccion_social: [
        {
          key: 'proyeccion_social',
          title: 'Proyección social o extensión',
          subtitle: 'Tabla base para seguimiento institucional de extensión.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'proyectos', label: 'Proyectos / programas', type: 'number' },
            { key: 'beneficiariosInternos', label: 'Beneficiarios internos', type: 'number' },
            { key: 'beneficiariosExternos', label: 'Beneficiarios externos', type: 'number' },
            { key: 'eventos', label: 'Eventos / actividades', type: 'number' },
            { key: 'alianzas', label: 'Alianzas', type: 'number' }
          ],
          rows: annualRows.map((row) => ({ ...row, proyectos: 0, beneficiariosInternos: 0, beneficiariosExternos: 0, eventos: 0, alianzas: 0 }))
        }
      ],
      convenios: [
        {
          key: 'convenios',
          title: 'Convenios',
          subtitle: 'Tabla base para convenios institucionales.',
          columns: [
            { key: 'anio', label: 'Año' },
            { key: 'activos', label: 'Convenios activos', type: 'number' },
            { key: 'nacionales', label: 'Nacionales', type: 'number' },
            { key: 'internacionales', label: 'Internacionales', type: 'number' },
            { key: 'nuevos', label: 'Nuevos', type: 'number' },
            { key: 'finalizados', label: 'Finalizados', type: 'number' }
          ],
          rows: annualRows.map((row) => ({ ...row, activos: 0, nacionales: 0, internacionales: 0, nuevos: 0, finalizados: 0 }))
        }
      ]
    };
    const activeMasterTables = masterTablesByModule[activeMasterModule.key] || [];
    const renderTableCellValue = (value, type = 'text') => {
      if (type === 'number') return formatNumber(value);
      if (type === 'rate') return formatSummaryRate(value);
      return String(value ?? '0');
    };
    const renderMasterModuleTables = () => (
      <Stack spacing={1.6}>
        <Grid container spacing={1.4}>
          {[
            { label: 'Módulo activo', value: activeMasterModule.label, tone: activeMasterModule.tone, plain: true },
            { label: 'Hojas base', value: activeMasterModule.sheets.length, tone: '#334155' },
            { label: 'Estado', value: 'Estructura base lista', tone: '#16a34a', plain: true },
            { label: 'Integración de datos', value: 'Pendiente por conectar', tone: '#d97706', plain: true }
          ].map((item) => (
            <Grid item xs={12} sm={6} lg={3} key={item.label}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>{item.label}</Typography>
                <Typography sx={{ mt: 0.55, fontWeight: 900, fontSize: item.plain ? 18 : 24, color: '#0f172a' }}>
                  {item.value}
                </Typography>
                <Box sx={{ mt: 0.75, height: 4, borderRadius: 999, bgcolor: `${item.tone}1f` }}>
                  <Box sx={{ width: '100%', height: '100%', borderRadius: 999, bgcolor: item.tone }} />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        {activeMasterTables.map((table) => (
          <Paper key={table.key} elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%)' }}>
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17 }}>{table.title}</Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>{table.subtitle}</Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 560 }}>
              <Table stickyHeader size="small" sx={{ minWidth: Math.max(980, table.columns.length * 120) }}>
                <TableHead>
                  <TableRow>
                    {table.columns.map((column) => (
                      <TableCell key={column.key} align={column.type === 'number' || column.type === 'rate' ? 'right' : 'center'} sx={{ bgcolor: '#f8fafc', fontWeight: 800 }}>
                        {column.label}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {table.rows.map((row, rowIndex) => (
                    <TableRow key={`${table.key}-${rowIndex}`} hover>
                      {table.columns.map((column) => (
                        <TableCell key={column.key} align={column.type === 'number' || column.type === 'rate' ? 'right' : 'center'} sx={{ fontWeight: column.type === 'rate' ? 700 : 500 }}>
                          {renderTableCellValue(row[column.key], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                  {table.averageRow && (
                    <TableRow sx={{ '& td': { bgcolor: '#eef4ff', fontWeight: 900 } }}>
                      {table.columns.map((column, index) => (
                        <TableCell key={column.key} align={column.type === 'number' || column.type === 'rate' ? 'right' : 'center'}>
                          {index === 0 ? 'Promedio' : index === 1 ? '' : renderTableCellValue(table.averageRow[column.key], column.type)}
                        </TableCell>
                      ))}
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        ))}
      </Stack>
    );

    return (
      <Stack spacing={2.2}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.6, md: 2 },
            border: '1px solid #d7e3f7',
            borderRadius: 3,
            background: 'linear-gradient(135deg, #f8fbff 0%, #eef4ff 55%, #f7fbff 100%)'
          }}
        >
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
            <Stack spacing={0.8}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setPoblacionalPanel('hub')}>
                  Volver a dashboards Poblacional
                </Button>
                <Chip label="Cuadros Maestros" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 800 }} />
                <Chip label={activeMasterModule.label} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 800 }} />
              </Stack>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, color: '#0f172a', lineHeight: 1.12 }}>
                  Cuadros Maestros
                </Typography>
                <Typography sx={{ color: '#5b6578', mt: 0.35 }}>
                  Contenedor institucional de cuadros maestros. Estudiantes ya está operativo; los demás módulos quedan diseñados y listos para integración incremental.
                </Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.1} sx={{ width: { xs: '100%', lg: 'auto' } }}>
              {isStudentMasterModule && (
              <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 360 } }}>
                <InputLabel id="resumen-estadistico-programa-label">Programa</InputLabel>
                <Select
                  labelId="resumen-estadistico-programa-label"
                  label="Programa"
                  displayEmpty
                  value={resumenEstadisticoUi.programa}
                  onChange={(e) => setResumenEstadisticoUi((prev) => ({ ...prev, programa: e.target.value }))}
                  renderValue={(v) => v || 'Todos los programas'}
                >
                  <MenuItem value="">Todos los programas</MenuItem>
                  {resumenEstadisticoProgramOptions.map((programa) => (
                    <MenuItem key={programa} value={programa}>{programa}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              )}
              <Button
                variant="contained"
                startIcon={<DownloadIconSmall />}
                onClick={handleDownloadResumenEstadisticoTable}
                sx={{ ...GI_PRIMARY_ACTION_BTN_SX, minWidth: { xs: '100%', md: 240 } }}
              >
                Descargar Excel maestro
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: 1.3, borderRadius: 2.8, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
          <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>Módulos de Cuadros Maestros</Typography>
          <Box
            sx={{
              display: 'grid',
              gap: 1,
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(4, minmax(0, 1fr))'
              }
            }}
          >
            {CUADROS_MAESTROS_MODULES.map((module) => {
              const active = module.key === activeMasterModule.key;
              return (
                <Button
                  key={module.key}
                  onClick={() => setResumenEstadisticoUi((prev) => ({ ...prev, module: module.key }))}
                  disableElevation
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 1.8,
                    px: 1.6,
                    py: 1.2,
                    minHeight: 58,
                    whiteSpace: 'normal',
                    lineHeight: 1.15,
                    border: active ? '1px solid transparent' : '1px solid #c7d8f5',
                    color: active ? '#ffffff' : module.tone,
                    background: active ? `linear-gradient(135deg, ${module.tone} 0%, #1e3a8a 100%)` : '#f8fbff',
                    '&:hover': {
                      background: active ? `linear-gradient(135deg, ${module.tone} 0%, #1e3a8a 100%)` : '#f1f6ff',
                      borderColor: active ? 'transparent' : '#aac4f6'
                    }
                  }}
                >
                  {module.shortLabel}
                </Button>
              );
            })}
          </Box>
        </Paper>

        {isStudentMasterModule ? (
        <>
        <Grid container spacing={1.4}>
          {[
            { label: 'Inscritos acumulados', value: totalInscritos, tone: '#2563eb' },
            { label: 'Admitidos acumulados', value: totalAdmitidos, tone: '#dc2626' },
            { label: 'Primer curso acumulado', value: totalPrimerCurso, tone: '#475569' },
            { label: 'Graduados acumulados', value: totalGraduados, tone: '#0f766e' }
          ].map((item) => (
            <Grid item xs={12} sm={6} lg={3} key={item.label}>
              <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>{item.label}</Typography>
                <Typography sx={{ mt: 0.55, fontWeight: 900, fontSize: 24, color: '#0f172a' }}>{formatNumber(item.value)}</Typography>
                <Box sx={{ mt: 0.75, height: 4, borderRadius: 999, bgcolor: `${item.tone}1f` }}>
                  <Box sx={{ width: '100%', height: '100%', borderRadius: 999, bgcolor: item.tone }} />
                </Box>
              </Paper>
            </Grid>
          ))}
        </Grid>

        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', overflow: 'hidden' }}>
          <Box sx={{ px: 2, py: 1.4, borderBottom: '1px solid #e2e8f0', background: 'linear-gradient(90deg, #eff6ff 0%, #f8fafc 100%)' }}>
            <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 17 }}>Cuadros Maestros de Estudiantes</Typography>
            <Typography variant="body2" sx={{ color: '#64748b' }}>
              Vista consolidada para reporte institucional. Filtro actual: {resumenEstadisticoUi.programa || 'Todos los programas'}. Años visibles: {visibleYearsLabel}.
            </Typography>
          </Box>
          <TableContainer sx={{ maxHeight: 640 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1750 }}>
              <TableHead>
                <TableRow>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 88 }}>Año</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 120 }}>Período académico</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 96 }}>Inscritos</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 96 }}>Admitidos</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#eff6ff', fontWeight: 800, minWidth: 118 }}>Tasa de selectividad</TableCell>
                  <TableCell colSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 900 }}>Matriculados</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#eff6ff', fontWeight: 800, minWidth: 118 }}>Tasa de absorción</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 120 }}>N° total de graduados</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 140 }}>Tasa de deserción programa anual según SPADIES</TableCell>
                  <TableCell rowSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 140 }}>Promedio del puntaje global del Programa en Saber Pro</TableCell>
                  <TableCell colSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 900 }}>Total Estudiantes en movilidad saliente</TableCell>
                  <TableCell colSpan={2} align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 900 }}>Total Estudiantes en movilidad entrante</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 104 }}>Matriculados</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 104 }}>Primer curso</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 96 }}>Nacional</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 110 }}>Internacional</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 96 }}>Nacional</TableCell>
                  <TableCell align="center" sx={{ bgcolor: '#f8fafc', fontWeight: 800, minWidth: 110 }}>Internacional</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow
                    key={`${row.anio}-${row.periodo}`}
                    hover
                    sx={{
                      '& td': {
                        borderTop: row.isYearGroupStart ? '2px solid #cfe0fb' : undefined
                      }
                    }}
                  >
                    {row.yearRowSpan > 0 ? (
                      <TableCell rowSpan={row.yearRowSpan} align="center" sx={{ fontWeight: 800, verticalAlign: 'middle', bgcolor: '#fcfdff' }}>
                        {row.anio}
                      </TableCell>
                    ) : null}
                    <TableCell align="center" sx={{ fontWeight: 700 }}>{row.periodo === '1' ? 'I' : 'II'}</TableCell>
                    <TableCell align="right">{formatNumber(row.inscritos)}</TableCell>
                    <TableCell align="right">{formatNumber(row.admitidos)}</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#f8fbff', fontWeight: 700 }}>{formatSummaryRate(row.tasaSelectividad)}</TableCell>
                    <TableCell align="right">{formatNumber(row.matriculados)}</TableCell>
                    <TableCell align="right">{formatNumber(row.primerCurso)}</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#f8fbff', fontWeight: 700 }}>{formatSummaryRate(row.tasaAbsorcion)}</TableCell>
                    <TableCell align="right">{formatNumber(row.graduados)}</TableCell>
                    <TableCell align="right" sx={{ bgcolor: '#f8fbff', fontWeight: 700 }}>{formatSummaryRate(row.desercionSpadies)}</TableCell>
                    <TableCell align="right">0</TableCell>
                    <TableCell align="right">0</TableCell>
                    <TableCell align="right">0</TableCell>
                    <TableCell align="right">0</TableCell>
                    <TableCell align="right">0</TableCell>
                  </TableRow>
                ))}
                <TableRow sx={{ '& td': { bgcolor: '#eef4ff', fontWeight: 900 } }}>
                  <TableCell colSpan={2} align="center">Promedio</TableCell>
                  <TableCell align="right">{formatNumber(averageRow.inscritos)}</TableCell>
                  <TableCell align="right">{formatNumber(averageRow.admitidos)}</TableCell>
                  <TableCell align="right">{formatSummaryRate(averageRow.tasaSelectividad)}</TableCell>
                  <TableCell align="right">{formatNumber(averageRow.matriculados)}</TableCell>
                  <TableCell align="right">{formatNumber(averageRow.primerCurso)}</TableCell>
                  <TableCell align="right">{formatSummaryRate(averageRow.tasaAbsorcion)}</TableCell>
                  <TableCell align="right">{formatNumber(averageRow.graduados)}</TableCell>
                  <TableCell align="right">{formatSummaryRate(averageRow.desercionSpadies)}</TableCell>
                  <TableCell align="right">0</TableCell>
                  <TableCell align="right">0</TableCell>
                  <TableCell align="right">0</TableCell>
                  <TableCell align="right">0</TableCell>
                  <TableCell align="right">0</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
        </>
        ) : (
          renderMasterModuleTables()
        )}
      </Stack>
    );
  };

  const renderContextoExternoDashboardPanel = () => {
    const parsed = contextoExternoRows.map((row) => {
      const meta = parseObservacionesToMap(row.observaciones);
      return {
        ...row,
        meta,
        valorNum: normalizeNumber(row.valor),
        baseIndicador: String(meta.base || '').trim() || String(row.indicador || '').trim(),
        alcanceMeta: String(meta.alcance || '').trim() || null,
        periodoRef: String(meta.periodo_ref || '').trim(),
        programaObjetivo: String(meta.programa_objetivo || '').trim(),
        tipoRegistroCx: String(meta.tipo_registro || '').trim(),
        sectorMeta: String(meta.sector || '').trim()
      };
    });

    const programaObjetivoOptions = Array.from(new Set(parsed.map((r) => r.programaObjetivo).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'));
    const alcanceOptions = ['Todos', ...Array.from(new Set(parsed.map((r) => r.alcanceMeta).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))];
    const baseOptions = ['Todos', ...Array.from(new Set(parsed.map((r) => r.baseIndicador).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'es'))];

    const filteredMain = parsed.filter((r) =>
      (!contextoExternoUi.programaObjetivo || r.programaObjetivo === contextoExternoUi.programaObjetivo) &&
      (contextoExternoUi.alcance === 'Todos' || r.alcanceMeta === contextoExternoUi.alcance) &&
      (contextoExternoUi.base === 'Todos' || r.baseIndicador === contextoExternoUi.base)
    );

    const periodCatalog = Array.from(new Set(
      filteredMain
        .filter((r) => r.periodoRef)
        .map((r) => r.periodoRef)
    ))
      .map((label) => ({ label, order: parsePeriodoLabelToSort(label) || 0 }))
      .sort((a, b) => a.order - b.order || a.label.localeCompare(b.label, 'es'));

    const selectedPeriods = (contextoExternoUi.periodos || []).filter((p) => periodCatalog.some((x) => x.label === p));
    const filtered = filteredMain.filter((r) => !selectedPeriods.length || !r.periodoRef || selectedPeriods.includes(r.periodoRef));

    const ofertaRows = filtered.filter((r) => r.baseIndicador === 'Oferta');
    const seriesRowsCx = filtered.filter((r) => r.baseIndicador !== 'Oferta');
    const totalOferta = ofertaRows.length;
    const ofertaNacional = ofertaRows.filter((r) => (r.alcanceMeta || '').toLowerCase() === 'nacional').length;
    const ofertaRegional = ofertaRows.filter((r) => (r.alcanceMeta || '').toLowerCase() === 'regional').length;

    const seriesByPeriodoMap = new Map();
    seriesRowsCx.forEach((r) => {
      const period = r.periodoRef || `${Number(r.anio) || ''}`.trim();
      if (!period) return;
      const key = `${period}||${r.baseIndicador}`;
      if (!seriesByPeriodoMap.has(key)) {
        seriesByPeriodoMap.set(key, { periodLabel: period, periodOrder: parsePeriodoLabelToSort(period), base: r.baseIndicador, total: 0 });
      }
      seriesByPeriodoMap.get(key).total += r.valorNum;
    });

    const trendRows = Array.from(seriesByPeriodoMap.values())
      .sort((a, b) => a.periodOrder - b.periodOrder || a.base.localeCompare(b.base, 'es'));
    const trendPeriods = Array.from(new Set(trendRows.map((r) => r.periodLabel)))
      .map((label) => ({ label, order: parsePeriodoLabelToSort(label) }))
      .sort((a, b) => a.order - b.order);
    const trendBases = Array.from(new Set(trendRows.map((r) => r.base))).sort((a, b) => a.localeCompare(b, 'es'));
    const trendChartData = trendPeriods.map((p) => {
      const row = { periodLabel: p.label, periodOrder: p.order };
      trendBases.forEach((b) => {
        const item = trendRows.find((x) => x.periodLabel === p.label && x.base === b);
        row[b] = item ? item.total : 0;
      });
      return row;
    });

    const rankingProgramas = Array.from(
      seriesRowsCx.reduce((map, r) => {
        const key = String(r.programa || '').trim() || 'Sin programa';
        map.set(key, (map.get(key) || 0) + r.valorNum);
        return map;
      }, new Map()).entries()
    )
      .map(([label, total]) => ({ label, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const alcanceComposition = [
      { label: 'Nacional', total: ofertaNacional, color: '#2563eb' },
      { label: 'Regional', total: ofertaRegional, color: '#0ea5a4' }
    ];

    const hasData = Boolean(contextoExternoRows.length);

    return (
      <Stack spacing={2.2}>
        <Paper elevation={0} sx={{ p: { xs: 1.6, md: 2 }, border: '1px solid #c7f0ea', borderRadius: 3, background: 'linear-gradient(135deg, #f0fdfa 0%, #effcf8 52%, #f8fffd 100%)' }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.4} justifyContent="space-between" alignItems={{ xs: 'flex-start', lg: 'center' }}>
            <Stack spacing={0.8}>
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setPoblacionalPanel('hub')}>
                  Volver a dashboards Poblacional
                </Button>
                <Chip label="Contexto Externo" sx={{ bgcolor: '#ccfbf1', color: '#0f766e', fontWeight: 800 }} />
                <Chip label={hasData ? 'Dashboard activo' : 'Esperando datos'} sx={{ bgcolor: hasData ? '#dcfce7' : '#fff7ed', color: hasData ? '#166534' : '#c2410c', fontWeight: 700 }} />
              </Stack>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 22, md: 28 }, color: '#0f172a', lineHeight: 1.15 }}>
                  Analitica de Contexto Externo
                </Typography>
                <Typography sx={{ color: '#5b6578', mt: 0.35 }}>
                  Oferta nacional/regional y series historicas externas para benchmarking del programa.
                </Typography>
              </Box>
            </Stack>
            <Grid container spacing={1} sx={{ width: { xs: '100%', lg: 820 }, maxWidth: '100%' }}>
              <Grid item xs={12} md={4}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cx-programa-objetivo-label">Programa objetivo</InputLabel>
                  <Select
                    labelId="cx-programa-objetivo-label"
                    label="Programa objetivo"
                    value={contextoExternoUi.programaObjetivo}
                    onChange={(e) => setContextoExternoUi((prev) => ({ ...prev, programaObjetivo: e.target.value }))}
                    renderValue={(v) => v || 'Todos'}
                  >
                    <MenuItem value="">Todos</MenuItem>
                    {programaObjetivoOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cx-alcance-label">Cobertura</InputLabel>
                  <Select labelId="cx-alcance-label" label="Cobertura" value={contextoExternoUi.alcance} onChange={(e) => setContextoExternoUi((prev) => ({ ...prev, alcance: e.target.value }))}>
                    {alcanceOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={2.5}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cx-base-label">Base</InputLabel>
                  <Select labelId="cx-base-label" label="Base" value={contextoExternoUi.base} onChange={(e) => setContextoExternoUi((prev) => ({ ...prev, base: e.target.value }))}>
                    {baseOptions.map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel id="cx-periodos-label">Periodos</InputLabel>
                  <Select
                    labelId="cx-periodos-label"
                    label="Periodos"
                    multiple
                    value={selectedPeriods}
                    onChange={(e) => {
                      const value = typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value;
                      setContextoExternoUi((prev) => ({ ...prev, periodos: value }));
                    }}
                    renderValue={(vals) => {
                      const arr = Array.isArray(vals) ? vals : [];
                      if (!arr.length) return 'Todos';
                      if (arr.length <= 2) return arr.join(', ');
                      return `${arr.length} periodos`;
                    }}
                  >
                    {periodCatalog.map((p) => (
                      <MenuItem key={p.label} value={p.label}>
                        <Checkbox checked={selectedPeriods.includes(p.label)} />
                        <ListItemText primary={p.label} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>
          </Stack>
        </Paper>

        {!hasData ? (
          renderPoblacionalPlaceholderPanel({
            title: 'Dashboard de Contexto Externo',
            description: 'Aún no hay datos importados en la subbase Contexto Externo.',
            templateHint: 'Importa la plantilla consolidada con hojas OFERTA COLOMBIA/REGIONAL e historicos NACIONAL/REGIONAL.'
          })
        ) : (
          <>
            <Grid container spacing={1.4}>
              {[
                { label: 'Registros analizados', value: filtered.length, tone: '#0ea5a4', sub: 'Filas estadisticas segun filtros' },
                { label: 'Oferta total', value: totalOferta, tone: '#2563eb', sub: 'Programas comparables en oferta' },
                { label: 'Oferta regional', value: ofertaRegional, tone: '#0f766e', sub: 'Valle/Cauca/Nariño/Putumayo (según plantilla)' },
                { label: 'Series historicas', value: trendChartData.length, tone: '#d97706', sub: 'Periodos con datos disponibles' }
              ].map((kpi) => (
                <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
                  <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2.6, border: '1px solid #e5edf7', bgcolor: '#fff', height: '100%' }}>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>{kpi.label}</Typography>
                    <Typography sx={{ mt: 0.6, fontWeight: 900, fontSize: 26, color: '#0f172a', lineHeight: 1.05 }}>{formatNumber(kpi.value)}</Typography>
                    <Typography variant="body2" sx={{ mt: 0.35, color: '#64748b' }}>{kpi.sub}</Typography>
                    <Box sx={{ mt: 0.8, height: 4, borderRadius: 99, bgcolor: `${kpi.tone}22` }}>
                      <Box sx={{ width: '100%', height: '100%', borderRadius: 99, bgcolor: kpi.tone }} />
                    </Box>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={1.6}>
              <Grid item xs={12} xl={8}>
                <Paper elevation={0} sx={{ p: 1.6, borderRadius: 2.8, border: '1px solid #e2e8f0', bgcolor: '#fff', height: '100%' }}>
                  <Typography sx={{ fontWeight: 900, color: '#0f172a' }}>Tendencia historica consolidada</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1.1 }}>Suma por periodo para la base seleccionada (o todas), derivada de las hojas nacionales/regionales.</Typography>
                  <Box sx={{ height: 380 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={trendChartData} margin={{ top: 10, right: 16, left: 6, bottom: 10 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="periodLabel" tick={{ fontSize: 11 }} interval={0} angle={trendChartData.length > 10 ? -20 : 0} textAnchor={trendChartData.length > 10 ? 'end' : 'middle'} height={trendChartData.length > 10 ? 52 : 28} />
                        <YAxis />
                        <RechartsTooltip formatter={(v) => [formatNumber(v), 'Total']} />
                        <Legend />
                        {trendBases.slice(0, 6).map((baseKey, idx) => {
                          const colors = ['#0ea5a4', '#2563eb', '#f59e0b', '#7c3aed', '#ef4444', '#0891b2'];
                          return <Line key={baseKey} type="monotone" dataKey={baseKey} stroke={colors[idx % colors.length]} strokeWidth={2.6} dot={false} />;
                        })}
                      </LineChart>
                    </ResponsiveContainer>
                  </Box>
                </Paper>
              </Grid>
              <Grid item xs={12} xl={4}>
                <Stack spacing={1.6} sx={{ height: '100%' }}>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 0.2 }}>Composicion oferta</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>Distribucion de la oferta por cobertura en la muestra filtrada.</Typography>
                    <Box sx={{ height: 220 }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alcanceComposition}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                          <XAxis dataKey="label" />
                          <YAxis />
                          <RechartsTooltip formatter={(v) => [formatNumber(v), 'Programas']} />
                          <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                            {alcanceComposition.map((r) => <Cell key={r.label} fill={r.color} />)}
                            <LabelList dataKey="total" position="top" formatter={(v) => formatNumber(v)} />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </Box>
                  </Paper>
                  <Paper elevation={0} sx={{ p: 1.5, borderRadius: 2.6, border: '1px solid #e2e8f0', bgcolor: '#fff', flex: 1 }}>
                    <Typography sx={{ fontWeight: 900, color: '#0f172a', mb: 0.2 }}>Programas con mayor volumen</Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>Suma histórica de registros en la base filtrada (top 8).</Typography>
                    <Stack spacing={0.9}>
                      {rankingProgramas.slice(0, 8).map((item) => (
                        <Box key={item.label}>
                          <Stack direction="row" justifyContent="space-between" spacing={1}>
                            <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 600 }}>{item.label}</Typography>
                            <Typography variant="body2" sx={{ color: '#0f766e', fontWeight: 800 }}>{formatNumber(item.total)}</Typography>
                          </Stack>
                          <LinearProgress variant="determinate" value={rankingProgramas[0]?.total ? Math.min(100, (item.total / rankingProgramas[0].total) * 100) : 0} sx={{ mt: 0.4, height: 6, borderRadius: 10, bgcolor: '#ccfbf1', '& .MuiLinearProgress-bar': { bgcolor: '#14b8a6' } }} />
                        </Box>
                      ))}
                    </Stack>
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    );
  };

  const renderMatriculadosDashboardPanel = () => {
    const bundleLoading = !matriculadosBundleReady;
    const total = normalizeNumber(matriculadosPanelData?.totalRegistros || 0);
    const visibleTotal = normalizeNumber(activeTerritorialScope?.total || total);
    const topDepto = matriculadosDepartments[0] || null;
    const topMunicipio = selectedMatriculadosDepartment?.municipios?.[0] || null;
    const internationalTotal = matriculadosCountries.reduce((acc, item) => acc + normalizeNumber(item.total || 0), 0);
    const originPieData = [
      { name: 'Colombia', total: Math.max(0, total - internationalTotal), color: '#1d4ed8' },
      { name: 'Internacional', total: internationalTotal, color: '#f59e0b' }
    ].filter((item) => item.total > 0);
    const nivelesFormacionData = (matriculadosPanelData?.nivelesFormacion || []).map((item, index) => ({
      name: item?.name || `Nivel ${index + 1}`,
      total: normalizeNumber(item?.total || 0)
    }));
    const historicoByYear = Object.values(
      (matriculadosHistorico || []).reduce((acc, item) => {
        const year = String(Number(item?.anio || 0) || '');
        if (!year) return acc;
        if (!acc[year]) acc[year] = { anio: year, semestre1: 0, semestre2: 0, total: 0 };
        const semesterKey = String(item?.semestre || '1') === '2' ? 'semestre2' : 'semestre1';
        const totalItem = normalizeNumber(item?.total || 0);
        acc[year][semesterKey] += totalItem;
        acc[year].total += totalItem;
        return acc;
      }, {})
    ).sort((a, b) => Number(a.anio) - Number(b.anio));
    const geoCentroidMatches = matriculadosDepartmentsMapData.reduce((acc, item) => {
      const key = normalizeGeoNameKey(item.name);
      return deptCentroids[key] ? acc + 1 : acc;
    }, 0);
    const hasAnyData = Boolean(visibleTotal || matriculadosDepartments.length || matriculadosCountries.length || sexPieData.length || matriculadosHistorico.length);
    const hasGeoData = hasAnyData || activeSeries.length > 0 || matriculadosPanelData !== null;
    const deptSummaryRows = [...matriculadosDepartmentsMapData]
      .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0));
    const selectedDeptTotal = normalizeNumber(selectedMatriculadosDepartment?.total || 0);
    const muniSummaryRows = [...matriculadosMunicipiosMapData]
      .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0));
    const muniSummaryColumns = chunkArray(muniSummaryRows, 10);
    const deptTableTotal = Math.max(
      deptSummaryRows.reduce((acc, item) => acc + normalizeNumber(item.total || 0), 0),
      1
    );
    const muniTableTotal = Math.max(
      muniSummaryRows.reduce((acc, item) => acc + normalizeNumber(item.total || 0), 0),
      1
    );
    const requestedPeriodSlots = Array.from(new Set(
      (activeStatsFilters.periodos || []).map((item) => String(item).split('-')[1]).filter(Boolean)
    ));
    const appliedFilters = matriculadosPanelData?.filtrosAplicados || {};
    const mapFiltersAligned = (
      JSON.stringify([...(activeStatsFilters.programas || [])].sort()) === JSON.stringify([...(appliedFilters.programas || [])].sort())
      && JSON.stringify([...(activeStatsFilters.anios || [])].map(String).sort()) === JSON.stringify([...(appliedFilters.anios || [])].map(String).sort())
      && JSON.stringify([...(requestedPeriodSlots.length ? requestedPeriodSlots : ['1', '2'])].sort()) === JSON.stringify([...(appliedFilters.periodos || ['1', '2'])].map(String).sort())
      && JSON.stringify([...(geoTerritorialAppliedFilters.sexos || [])].sort()) === JSON.stringify([...(appliedFilters.sexos || [])].sort())
      && JSON.stringify([...(geoTerritorialAppliedFilters.niveles || [])].sort()) === JSON.stringify([...(appliedFilters.niveles || [])].sort())
    );
    const SEX_META = {
      Femenino:    { key: 'Femenino',    label: 'FEMENINO',    color: '#EC4899', bg: '#fdf2f8', iconGender: 'F' },
      Masculino:   { key: 'Masculino',   label: 'MASCULINO',   color: '#3B82F6', bg: '#eff6ff', iconGender: 'M' },
      'No binario':{ key: 'No binario',  label: 'NO BINARIO',  color: '#8b5cf6', bg: '#f5f3ff', iconGender: 'N' }
    };
    const SEX_ORDER = ['Femenino', 'Masculino', 'No binario'];
    const programasPorSexo = matriculadosPanelData?.programasPorSexo || {};
    // El backend puede devolver claves en mayúsculas (FEMENINO, MASCULINO) o título (Femenino).
    // Construimos un mapa normalizado para acceso case-insensitive.
    const programasPorSexoNorm = Object.fromEntries(
      Object.entries(programasPorSexo).map(([k, v]) => [k.toUpperCase(), v])
    );
    const sexoRows = SEX_ORDER
      .map((k) => {
        const progList = programasPorSexoNorm[k.toUpperCase()] || [];
        /* Primary: sum from programasPorSexo (always available with geo dashboard data) */
        const tFromPrograms = progList.reduce((s, p) => s + normalizeNumber(p.total || 0), 0);
        /* Fallback: from sexPieData if programasPorSexo not populated */
        const found = sexPieData.find((i) => String(i.name || '').toLowerCase() === k.toLowerCase());
        const t = tFromPrograms > 0 ? tFromPrograms : normalizeNumber(found?.total || 0);
        return {
          ...(SEX_META[k] || { key: k, label: k.toUpperCase(), color: '#64748b', bg: '#f8fafc', iconGender: 'N' }),
          total: t,
          pct: 0, /* calculated below after grand total */
          programas: progList
        };
      })
      .filter((r) => r.total > 0);
    const sexoGrandTotal = Math.max(sexoRows.reduce((s, r) => s + r.total, 0), 1);
    sexoRows.forEach((r) => { r.pct = (r.total / sexoGrandTotal) * 100; });
    // Usamos programasDisponibles del geo dashboard (viene de filteredRows del backend) para
    // que los niveles de formación sean dinámicos: aparecen/desaparecen con los filtros y
    // reflejan datos nuevos (ej. Maestría 2026) sin depender de la tabla de estadísticas.
    const uniqueProgramLabels = (matriculadosPanelData?.programasDisponibles || []).filter(Boolean);
    const historicoCompareExtremes = historicoByYear.reduce((acc, row) => {
      const values = [normalizeNumber(row.semestre1 || 0), normalizeNumber(row.semestre2 || 0)];
      const min = Math.min(...values);
      const max = Math.max(...values);
      return {
        min: Math.min(acc.min, min),
        max: Math.max(acc.max, max)
      };
    }, { min: Number.POSITIVE_INFINITY, max: 0 });
    const historicoCompareMin = Number.isFinite(historicoCompareExtremes.min) ? historicoCompareExtremes.min : 0;
    const historicoCompareMax = historicoCompareExtremes.max > 0 ? historicoCompareExtremes.max : 1;
    const historicoPadding = Math.max(2, Math.round((historicoCompareMax - historicoCompareMin) * 0.12));
    const historicoDomainMin = Math.max(0, historicoCompareMin - historicoPadding);
    const historicoDomainMax = historicoCompareMax + historicoPadding;

    /* ── Histórico semestral: usamos matriculadosPanelData?.semestres que viene del
       backend ya filtrado, para que incluya datos nuevos (2026+) automáticamente ── */
    const semCompareData = (matriculadosPanelData?.semestres || [])
      .map((s) => ({
        anio: String(s.anio),
        s1: normalizeNumber(s.semestre1 || 0),
        s2: normalizeNumber(s.semestre2 || 0),
        total: normalizeNumber(s.semestre1 || 0) + normalizeNumber(s.semestre2 || 0)
      }))
      .sort((a, b) => Number(a.anio) - Number(b.anio));

    /* ── Formation levels ── */
    const NIVEL_META = {
      TECNOLOGICO:    { label: 'Tecnológico',    color: '#b45309', bg: '#fffbeb' },
      PROFESIONAL:    { label: 'Profesional',    color: '#1d4ed8', bg: '#eff6ff' },
      ESPECIALIZACION:{ label: 'Especialización',color: '#0f766e', bg: '#f0fdf4' },
      MAESTRIA:       { label: 'Maestría',       color: '#7c3aed', bg: '#f5f3ff' },
      DOCTORADO:      { label: 'Doctorado',      color: '#9f1239', bg: '#fff1f2' }
    };
    const NIVEL_ORDER = ['TECNOLOGICO', 'PROFESIONAL', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'];
    const levelProgramsMap = uniqueProgramLabels.reduce((acc, programName) => {
      const level = classifyProgramLevel(programName);
      if (!acc[level]) acc[level] = [];
      acc[level].push(programName);
      return acc;
    }, {});
    const nivelesRows = NIVEL_ORDER
      .map((nivelKey) => ({
        nivel: nivelKey,
        total: (levelProgramsMap[nivelKey] || []).length,
        programas: (levelProgramsMap[nivelKey] || []).slice().sort(),
        ...(NIVEL_META[nivelKey] || { label: nivelKey, color: '#64748b', bg: '#f8fafc' })
      }))
      .filter((r) => r.total > 0);
    const nivelTotal = Math.max(nivelesRows.reduce((s, r) => s + r.total, 0), 1);

    /* ── Map markers (geo pins) ── */
    const maxDeptVal = Math.max(...deptGeoPolygons.map((s) => s.total || 0), 1);
    const deptPins = departmentMapPins.map((item) => ({
      ...item,
      isSelected: normalizeGeoNameKey(item.name || '') === normalizeGeoNameKey(matriculadosGeoSelection || ''),
      scale: Math.max(0.82, normalizeNumber(item.total || 0) / maxDeptVal)
    }));

    /* ── Municipality markers ── */
    const muniMaxVal = Math.max(...municipalityPins.map((p) => normalizeNumber(p.total || 0)), 1);
    const municipalityMarkerGroups = buildGeoMarkerClusters({
      items: municipalityPins.map((item) => ({
        ...item,
        percent: selectedDeptTotal > 0 ? (normalizeNumber(item.total || 0) / selectedDeptTotal) * 100 : 0
      })),
      radius: 20,
      minItems: 2
    })
      .sort((a, b) => normalizeNumber(b.total || 0) - normalizeNumber(a.total || 0));

    /* ── Number formatter (compact: 10k, 1.2M) ── */
    const fmtCompact = (n) => {
      const v = normalizeNumber(n || 0);
      if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
      return String(v);
    };

    return (
      <Box sx={{ width: '100%' }}>
      <Stack spacing={0}>

        {/* ── LOADING ── */}
        {matriculadosPanelLoading ? (
          <Box sx={{ py: 6, textAlign: 'center', px: { xs: 2, sm: 2.5 } }}>
            <CircularProgress size={42} sx={{ color: '#3b82f6' }} />
            <Typography sx={{ mt: 1.5, color: '#334155', fontWeight: 600, fontSize: 15 }}>Cargando datos de matriculados...</Typography>
          </Box>
        ) : (<>

        {/* ── NO-DATA CALLOUT ── */}
        {!hasAnyData && (
          <Box sx={{ px: { xs: 2, sm: 2.5 }, py: 1.8, background: '#eef2ff', borderBottom: '2px solid #bfdbfe' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', sm: 'center' }}>
              <Box sx={{ bgcolor: '#dbeafe', borderRadius: 2, p: 1.3, display: 'flex', flexShrink: 0 }}>
                <SchoolIcon sx={{ color: '#1d4ed8', fontSize: 26 }} />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13.5, color: '#1e3a8a' }}>
                  Panel en espera de datos · Sin registros en la base de Matriculados
                </Typography>
                <Typography sx={{ fontSize: 12, color: '#475569', mt: 0.3 }}>
                  Para activar todos los gráficos, importa la base <strong>Matriculados</strong> y la <strong>Georreferencia DIVIPOLA</strong> en el módulo de Gestión de Bases de Datos.
                </Typography>
              </Box>
            </Stack>
          </Box>
        )}

        {/* ── HERO BANNER ── */}
        <Box sx={{
          background: 'linear-gradient(135deg, #0c1445 0%, #1a2f7a 40%, #1d4ed8 100%)',
          px: { xs: 2, sm: 2.5 },
          pt: { xs: 2.5, sm: 3 },
          pb: { xs: 2, sm: 2.5 },
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Background decorations */}
          <Box sx={{ position: 'absolute', top: -70, right: -70, width: 220, height: 220, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.04)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', bottom: -50, left: '35%', width: 180, height: 180, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.03)', pointerEvents: 'none' }} />
          <Box sx={{ position: 'absolute', top: '20%', left: -40, width: 140, height: 140, borderRadius: '50%', bgcolor: 'rgba(59,130,246,0.12)', pointerEvents: 'none' }} />
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2, position: 'relative', zIndex: 1 }}>
            <Box>
              <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, mb: 0.3 }}>
                Panel de Análisis · Matriculados
              </Typography>
              <Stack direction="row" alignItems="baseline" spacing={1.2}>
                <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: { xs: 28, sm: 36 }, lineHeight: 1, letterSpacing: -1 }}>
                  {formatNumber(visibleTotal)}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.6)', fontSize: { xs: 12, sm: 14 }, fontWeight: 500 }}>
                  {selectedMatriculadosMunicipality ? 'matriculados del municipio' : selectedMatriculadosDepartment ? 'matriculados del departamento' : 'estudiantes matriculados'}
                </Typography>
              </Stack>
            </Box>
            <Tooltip title="Actualizar datos">
              <IconButton size="small" onClick={requestMatriculadosRefresh} disabled={matriculadosPanelLoading}
                sx={{ color: 'rgba(255,255,255,0.8)', border: '1px solid rgba(255,255,255,0.22)', '&:hover': { bgcolor: 'rgba(255,255,255,0.12)' }, '&:disabled': { opacity: 0.4 } }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Stack>
          <Grid container spacing={1.5} sx={{ position: 'relative', zIndex: 1 }}>
            {[
              { label: 'Total registros', value: formatNumber(total), sub: 'según filtros activos', icon: <SchoolIcon sx={{ fontSize: 20, color: '#93c5fd' }} />, accent: '#3b82f6' },
              { label: 'Depto. líder', value: topDepto ? formatNumber(topDepto.total) : '—', sub: topDepto ? normalizeUiUpper(topDepto.name) : 'Sin datos', icon: <PlaceIcon sx={{ fontSize: 20, color: '#6ee7b7' }} />, accent: '#10b981' },
              { label: 'Género mayoritario', value: sexPieData[0] ? (sexPieData[0].percent).toFixed(1) + '%' : '—', sub: sexPieData[0] ? sexPieData[0].name : '—', icon: <PeopleIcon sx={{ fontSize: 20, color: '#c4b5fd' }} />, accent: '#7c3aed' },
              { label: 'Origen internacional', value: formatNumber(internationalTotal), sub: matriculadosCountries.length + ' países', icon: <PublicIcon sx={{ fontSize: 20, color: '#fbbf24' }} />, accent: '#f59e0b' }
            ].map((card, idx) => (
              <Grid item xs={12} sm={6} lg={3} key={idx} sx={{ display: 'flex' }}>
                <Box sx={{
                  width: '100%',
                  minHeight: { xs: 122, sm: 132 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  bgcolor: 'rgba(255,255,255,0.08)',
                  borderRadius: 2,
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderLeft: `3px solid ${card.accent}`,
                  p: { xs: 1.6, sm: 1.9, lg: 2.1 },
                  backdropFilter: 'blur(4px)',
                  transition: 'background 0.2s',
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.13)' }
                }}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ mt: 0.2, flexShrink: 0 }}>{card.icon}</Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: 9.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.7, mb: 0.2, whiteSpace: 'nowrap' }}>{card.label}</Typography>
                      <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: { xs: 20, sm: 26 }, lineHeight: 1, letterSpacing: -0.5 }}>{card.value}</Typography>
                      <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: 10.5, mt: 0.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.sub}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* ── GEO MAP + DEPT TABLE ── */}
        <Paper elevation={0} sx={{ borderRadius: 0, borderTop: '1px solid #dbeafe', borderBottom: '1px solid #dbeafe', overflow: 'hidden', mt: 0 }}>
          <Box sx={{ px: 2.2, py: 1.3, background: 'linear-gradient(135deg,#0f2f57 0%,#1d4f8c 100%)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
            <Box sx={{ bgcolor: 'rgba(255,255,255,0.14)', borderRadius: 1.5, p: 0.6, display: 'flex', flexShrink: 0 }}>
              <PlaceIcon sx={{ fontSize: 17, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 13.5 }}>Distribución Geográfica — Colombia</Typography>
              <Typography sx={{ color: 'rgba(255,255,255,0.70)', fontSize: 11 }}>
                {deptGeoPolygons.filter((s) => s.total > 0).length} departamentos con registros · clic para ver municipios
              </Typography>
            </Box>
          </Box>
          <Box sx={{ p: { xs: 1.2, md: 2 } }}>
            <Box
              sx={{
                width: '100%',
                display: 'grid',
                gap: 2,
                gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.55fr) minmax(0, 0.95fr)' },
                alignItems: 'stretch'
              }}
            >
              {/* SVG Colombia map */}
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    width: '100%',
                    minHeight: { xs: 400, sm: 500, md: 620, lg: 720 },
                    height: { xs: 480, sm: 620, md: 780, lg: 900 },
                    maxHeight: { xs: 540, sm: 700, md: 860, lg: 980 },
                    position: 'relative',
                    bgcolor: '#f0f7ff',
                    border: '1px solid #dbeafe',
                    borderRadius: 2.5,
                    overflow: 'hidden',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <svg
                    viewBox={`0 0 ${COLOMBIA_MAP_CANVAS_WIDTH} ${COLOMBIA_MAP_CANVAS_HEIGHT}`}
                    style={{ width: 'auto', height: '100%', maxWidth: '100%', display: 'block' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {/* Polygon fills (choropleth) */}
                    {deptGeoPolygons.map((shape) => {
                      const isSelected = shape.key === normalizeGeoNameKey(matriculadosGeoSelection || '');
                      const baseBlue = shape.total > 0 ? shape.intensity : 0;
                      const fillColor = isSelected
                        ? '#1d4ed8'
                        : shape.total > 0
                          ? `rgba(29,78,216,${(0.10 + baseBlue * 0.75).toFixed(2)})`
                          : '#e8f0fe';
                      return (
                        <path
                          key={shape.key}
                          d={shape.path}
                          fill={fillColor}
                          stroke="#f8fbff"
                          strokeWidth="0.8"
                          style={{ cursor: shape.total > 0 ? 'pointer' : 'default', transition: 'fill 0.18s ease' }}
                          onClick={() => {
                            if (shape.total > 0) {
                              handleSelectMatriculadosDepartment(shape.name);
                            }
                          }}
                        >
                          <title>{shape.name}: {formatNumber(shape.total)} matriculados</title>
                        </path>
                      );
                    })}
                  </svg>
                  <svg
                    viewBox={`0 0 ${COLOMBIA_MAP_CANVAS_WIDTH} ${COLOMBIA_MAP_CANVAS_HEIGHT}`}
                    style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', inset: 0, overflow: 'visible', zIndex: 2, pointerEvents: 'none' }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    {deptPins.map((m) => {
                      const totalLabel = formatNumber(m.total);
                      const badgeWidth = clampValue(Math.max((totalLabel.length * 8.6) + 14, 40), 40, 78);
                      const badgeHeight = 22;
                      const spreadSeed = hashString(m.key || m.name || '');
                      const spreadX = ((spreadSeed % 9) - 4) * 8;
                      const spreadY = ((Math.floor(spreadSeed / 9) % 7) - 3) * 6;
                      const badgeX = clampValue((m.x - (badgeWidth / 2)) + spreadX, 10, COLOMBIA_MAP_CANVAS_WIDTH - badgeWidth - 10);
                      const badgeY = clampValue((m.y - 36) + spreadY, 10, COLOMBIA_MAP_CANVAS_HEIGHT - badgeHeight - 10);
                      const markerColor = m.isSelected ? '#dc2626' : '#1d4ed8';
                      const shadowColor = m.isSelected ? 'rgba(220,38,38,0.22)' : 'rgba(29,78,216,0.20)';
                      const deptLabel = m.name.length > 15 ? m.name.substring(0, 13) + '...' : m.name;
                      const nameY = badgeY - 7;
                      const textX = badgeX + (badgeWidth / 2);
                      return (
                        <g
                          key={m.key}
                          style={{ cursor: 'pointer', pointerEvents: 'all' }}
                          onClick={() => handleSelectMatriculadosDepartment(m.name)}
                        >
                          <ellipse cx={m.x} cy={m.y + 20} rx="18" ry="7" fill={shadowColor} />
                          {/* Department name label above badge */}
                          <text
                            x={textX}
                            y={nameY}
                            textAnchor="middle"
                            fontSize="9.8"
                            fill="#0f172a"
                            fontWeight="700"
                            fontFamily="system-ui,sans-serif"
                            stroke="white"
                            strokeWidth="3.5"
                            paintOrder="stroke"
                          >
                            {deptLabel}
                          </text>
                          {/* Count badge */}
                          <rect x={badgeX} y={badgeY} width={badgeWidth} height={badgeHeight} rx="12" fill="#ffffff" stroke={markerColor} strokeWidth="1.8" />
                          <text
                            x={textX}
                            y={badgeY + 15}
                            textAnchor="middle"
                            fontSize="10.6"
                            fill={markerColor}
                            fontWeight="900"
                            fontFamily="system-ui,sans-serif"
                          >
                            {totalLabel}
                          </text>
                          {/* Pin marker */}
                          <g transform={`translate(${m.x - 16}, ${m.y - 6})`}>
                            <path
                              d="M16 29C16 29 27 18.8 27 11.8C27 5.9 22.1 1 16 1C9.9 1 5 5.9 5 11.8C5 18.8 16 29 16 29Z"
                              fill="#ffffff"
                              stroke={markerColor}
                              strokeWidth="2.2"
                              strokeLinejoin="round"
                            />
                            <circle
                              cx="16"
                              cy="12"
                              r="5.5"
                              fill="none"
                              stroke={markerColor}
                              strokeWidth="2"
                            />
                          </g>
                          <title>{`${m.name}: ${formatNumber(m.total)} matriculados (${Number(m.percent || 0).toFixed(1)}%)`}</title>
                        </g>
                      );
                    })}
                  </svg>
                  {/* Color scale legend */}
                  {deptGeoPolygons.length > 0 && (
                    <Box sx={{ position: 'absolute', bottom: 8, left: 10, display: 'flex', flexDirection: 'column', gap: 0.3 }}>
                      <Typography sx={{ fontSize: 9, color: '#475569', fontWeight: 700 }}>Densidad</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                        <Box sx={{ width: 40, height: 8, borderRadius: 2, background: 'linear-gradient(to right, rgba(29,78,216,0.12), rgba(29,78,216,0.85))' }} />
                        <Typography sx={{ fontSize: 8, color: '#64748b' }}>min → max</Typography>
                      </Box>
                    </Box>
                  )}
                  {hasAnyData && deptGeoPolygons.length === 0 && (
                    <Stack
                      alignItems="center"
                      justifyContent="center"
                      spacing={1.2}
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 60%, #bfdbfe 100%)'
                      }}
                    >
                      <PlaceIcon sx={{ fontSize: 44, color: '#60a5fa' }} />
                      <Typography sx={{ color: '#1d4ed8', fontWeight: 800, fontSize: 13.5 }}>
                        Mapa base no disponible
                      </Typography>
                      <Typography sx={{ color: '#475569', fontSize: 11.5, maxWidth: 280, textAlign: 'center' }}>
                        No se pudo cargar el geojson de Colombia en este entorno. Los datos siguen disponibles en tablas y gráficos.
                      </Typography>
                    </Stack>
                  )}
                  {!hasAnyData && (
                    <Stack alignItems="center" justifyContent="center" spacing={2} sx={{
                      position: 'absolute', inset: 0,
                      background: 'linear-gradient(160deg, #eff6ff 0%, #dbeafe 60%, #bfdbfe 100%)'
                    }}>
                      {/* Colombia outline placeholder */}
                      <Box sx={{
                        width: 110, height: 130,
                        background: 'linear-gradient(160deg, #bfdbfe 0%, #93c5fd 100%)',
                        clipPath: 'polygon(35% 0%, 70% 5%, 100% 18%, 92% 42%, 78% 50%, 95% 68%, 85% 88%, 60% 100%, 30% 95%, 8% 80%, 0% 55%, 15% 35%, 5% 18%)',
                        opacity: 0.7,
                        flexShrink: 0
                      }} />
                      <Box sx={{ textAlign: 'center', px: 2 }}>
                        <Typography sx={{ color: '#1e40af', fontWeight: 900, fontSize: 15, mb: 0.5 }}>Mapa en espera de datos</Typography>
                        <Typography sx={{ color: '#3b82f6', fontSize: 12.5, fontWeight: 600, mb: 0.5 }}>Sin registros geolocalizados</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 11.5, maxWidth: 260, lineHeight: 1.5 }}>
                          Importa la base <strong style={{ color: '#1d4ed8' }}>Matriculados</strong> y <strong style={{ color: '#1d4ed8' }}>Georreferencia DIVIPOLA</strong> para activar el choropleth interactivo
                        </Typography>
                      </Box>
                    </Stack>
                  )}
                </Box>
              </Box>
              {/* Department table */}
              <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    p: { xs: 2, sm: 2 },
                    minHeight: { xs: 400, sm: 500, md: 620, lg: 720 },
                    maxHeight: { xs: 540, sm: 700, md: 860, lg: 980 },
                    border: '1px solid #dbeafe',
                    borderRadius: 2.5,
                    bgcolor: '#fff'
                  }}
                >
                  <Typography sx={{ fontWeight: 800, color: '#0f172a', fontSize: 13, mb: 0.8, flexShrink: 0 }}>Resumen por departamento</Typography>
                  {deptSummaryRows.length === 0 && (
                    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ flex: 1, py: 6 }}>
                      <PlaceIcon sx={{ fontSize: 44, color: '#bfdbfe' }} />
                      <Box sx={{ textAlign: 'center' }}>
                        <Typography sx={{ color: '#1d4ed8', fontWeight: 700, fontSize: 13 }}>Sin distribución departamental</Typography>
                        <Typography sx={{ color: '#94a3b8', fontSize: 11.5, mt: 0.4, maxWidth: 220 }}>Los datos aparecerán aquí una vez importes la base Matriculados</Typography>
                      </Box>
                    </Stack>
                  )}
                  <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0,
                      display: 'grid',
                      gridTemplateColumns: deptSummaryRows.length > 8 ? 'repeat(2, 1fr)' : '1fr',
                      gap: '3px 6px', alignContent: 'start'
                    }}>
                      {deptSummaryRows.map((item, idx) => {
                        const pct = (normalizeNumber(item.total || 0) / deptTableTotal) * 100;
                        const isSelected = normalizeGeoNameKey(item.name) === normalizeGeoNameKey(matriculadosGeoSelection || '');
                        return (
                          <Box
                            key={item.name}
                            onClick={() => handleSelectMatriculadosDepartment(item.name)}
                            sx={{
                              px: 1, py: 0.65, borderRadius: 1.5, cursor: 'pointer',
                              bgcolor: isSelected ? '#dbeafe' : 'transparent',
                              border: `1px solid ${isSelected ? '#93c5fd' : 'transparent'}`,
                              '&:hover': { bgcolor: isSelected ? '#dbeafe' : '#f8fafc' },
                              transition: 'all 0.15s'
                            }}
                          >
                            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
                              <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
                                <Typography sx={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, minWidth: 16, flexShrink: 0 }}>{idx + 1}</Typography>
                                <Typography sx={{ fontSize: 12, color: '#0f172a', fontWeight: isSelected ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {normalizeUiUpper(String(item.name || ''))}
                                </Typography>
                              </Stack>
                              <Stack direction="row" spacing={0.4} alignItems="center" sx={{ flexShrink: 0, ml: 0.5 }}>
                                <Typography sx={{ fontSize: 11.5, color: '#1d4ed8', fontWeight: 800 }}>{formatNumber(item.total)}</Typography>
                                <Typography sx={{ fontSize: 9.5, color: '#94a3b8' }}>({pct.toFixed(1)}%)</Typography>
                              </Stack>
                            </Stack>
                            <Box sx={{ height: 4, bgcolor: '#e2e8f0', borderRadius: 99 }}>
                              <Box sx={{ width: Math.min(100, pct) + '%', height: '100%', bgcolor: isSelected ? '#1d4ed8' : '#60a5fa', borderRadius: 99, transition: 'width 0.5s ease' }} />
                            </Box>
                          </Box>
                        );
                      })}
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ── ROW 2: MUNICIPIOS (SIEMPRE VISIBLE) ── */}
        <Paper ref={municipalSectionRef} elevation={0} sx={{ borderRadius: 0, borderTop: '1px solid #d1fae5', borderBottom: '1px solid #d1fae5', overflow: 'hidden' }}>
          <Box sx={{ px: 2.2, py: 1.3, background: 'linear-gradient(135deg,#065f46 0%,#0f766e 100%)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.14)', borderRadius: 1.5, p: 0.6, display: 'flex' }}>
                <LocationCityIcon sx={{ fontSize: 17, color: '#fff' }} />
              </Box>
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 13.5 }}>
                  {matriculadosGeoSelection ? `Municipios — ${normalizeUiUpper(matriculadosGeoSelection)}` : 'Distribución Municipal'}
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.70)', fontSize: 11 }}>
                  {matriculadosGeoSelection
                    ? `${formatNumber(selectedDeptTotal)} matriculados · ${(selectedMatriculadosDepartment?.municipios || []).length} municipios`
                    : 'Selecciona un departamento en el mapa superior para ver el detalle municipal'}
                </Typography>
              </Box>
            </Stack>
            {matriculadosGeoSelection && (
              <Button
                variant="outlined"
                size="small"
                startIcon={<ArrowBackRoundedIcon sx={{ fontSize: 16 }} />}
                onClick={() => {
                  setMatriculadosGeoSelection('');
                  setMatriculadosMunicipioSelection('');
                }}
                sx={{
                  color: '#fff',
                  borderColor: 'rgba(255,255,255,0.28)',
                  fontWeight: 800,
                  textTransform: 'none',
                  '&:hover': { borderColor: 'rgba(255,255,255,0.48)', bgcolor: 'rgba(255,255,255,0.08)' }
                }}
              >
                Volver a Colombia
              </Button>
            )}
          </Box>
          <Box sx={{ p: { xs: 1.2, md: 2 } }}>
            <Box
              sx={{
                display: 'grid',
                gap: 2,
                gridTemplateColumns: '1fr',
                alignItems: 'stretch'
              }}
            >
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    minHeight: { xs: 580, sm: 740, md: 900, lg: 1020 },
                    border: '1px solid #c9d9ef',
                    borderRadius: 2.5,
                    overflow: 'hidden',
                    bgcolor: '#eef4ff',
                    boxShadow: '0 10px 30px rgba(30,58,138,0.08)'
                  }}
                >
                <Box sx={{ px: 1.8, py: 1.1, borderBottom: '1px solid #dbeafe', background: 'linear-gradient(135deg, rgba(30,64,175,0.14) 0%, rgba(30,64,175,0.04) 100%)' }}>
                  <Typography sx={{ fontWeight: 900, color: '#1e3a8a', fontSize: 13.5 }}>
                    {matriculadosGeoSelection ? `Departamento seleccionado: ${normalizeUiUpper(matriculadosGeoSelection)}` : 'Mapa del departamento'}
                  </Typography>
                  <Typography sx={{ color: '#1e40af', fontSize: 11.2, mt: 0.2 }}>
                    {matriculadosGeoSelection
                      ? 'Silueta departamental y división municipal (clic sobre municipio para seleccionar)'
                      : 'La seccion inferior se activa al hacer clic en un departamento del mapa de Colombia'}
                  </Typography>
                </Box>
                <Box sx={{ width: '100%', flex: 1, minHeight: 0, bgcolor: '#edf3ff', overflow: 'hidden', position: 'relative' }}>
                {matriculadosGeoSelection && selectedDeptGeoPolygon ? (
                  <svg
                    viewBox={`0 0 ${DEPARTMENT_MAP_CANVAS_WIDTH} ${DEPARTMENT_MAP_CANVAS_HEIGHT}`}
                    style={{ width: '100%', height: '100%', display: 'block', position: 'absolute', top: 0, left: 0 }}
                    preserveAspectRatio="xMidYMid meet"
                  >
                    <path d={buildSvgPathFromRings(selectedDeptGeoPolygon.rings, { minLon: muniMapBounds.lonMin, maxLon: muniMapBounds.lonMax, minLat: muniMapBounds.latMin, maxLat: muniMapBounds.latMax }, DEPARTMENT_MAP_CANVAS_WIDTH, DEPARTMENT_MAP_CANVAS_HEIGHT, DEPARTMENT_MAP_CANVAS_PADDING)} fill="#eef4ff" stroke="#bfdbfe" strokeWidth="1.1" />
                    {deptMunicipalityPolygons.map((poly) => {
                      const isSelected = normalizeGeoNameKey(matriculadosMunicipioSelection || '') === poly.muniKey;
                      const pct = selectedDeptTotal > 0 ? (normalizeNumber(poly.total || 0) / selectedDeptTotal) * 100 : 0;
                      const fillColor = poly.total > 0
                        ? `rgba(59,130,246,${Math.min(0.58, 0.10 + (poly.intensity * 0.46)).toFixed(2)})`
                        : 'rgba(255,255,255,0.48)';
                      return (
                        <path
                          key={poly.key}
                          d={poly.path}
                          fill={isSelected ? '#3b82f6' : fillColor}
                          stroke={isSelected ? '#2563eb' : '#f8fbff'}
                          strokeWidth={isSelected ? 1.05 : 0.75}
                          style={{ cursor: 'pointer', transition: 'all .15s ease' }}
                          onClick={() => setMatriculadosMunicipioSelection((prev) => (prev === poly.name ? '' : poly.name))}
                          onMouseEnter={() => {
                            const point = projectLonLatToSvg({
                              lon: Number(poly.centroidLon),
                              lat: Number(poly.centroidLat),
                              bbox: { minLon: muniMapBounds.lonMin, maxLon: muniMapBounds.lonMax, minLat: muniMapBounds.latMin, maxLat: muniMapBounds.latMax },
                              width: DEPARTMENT_MAP_CANVAS_WIDTH,
                              height: DEPARTMENT_MAP_CANVAS_HEIGHT,
                              padding: DEPARTMENT_MAP_CANVAS_PADDING
                            });
                            setGeoHoverCard({ x: point.x, y: point.y, title: normalizeUiUpper(poly.name), total: normalizeNumber(poly.total || 0), percent: pct });
                          }}
                          onMouseLeave={() => setGeoHoverCard(null)}
                        >
                          <title>Municipio: {poly.name} | Total estudiantes: {formatNumber(poly.total)}</title>
                        </path>
                      );
                    })}
                    {municipalityMarkerGroups.map((group) => {
                      const isCluster = Boolean(group.isCluster && Number(group.clusterCount || 0) > 1);
                      const isSelected = !isCluster && normalizeGeoNameKey(matriculadosMunicipioSelection || '') === normalizeGeoNameKey(group.muniKey || '');
                      const markerColor = isSelected ? '#dc2626' : '#2563eb';
                      const normalizedTotal = normalizeNumber(group.total || 0);
                      const radius = isCluster
                        ? clampValue(6 + (Number(group.clusterCount || 0) * 0.35), 6, 10)
                        : clampValue(4.6 + ((normalizedTotal / muniMaxVal) * 2.1), 4.6, 7.8);
                      const labelText = fmtCompact(group.total || 0);
                      const seed = hashString(group.key || group.name || '');
                      const labelX = clampValue(group.x + (((seed % 7) - 3) * 4), 8, DEPARTMENT_MAP_CANVAS_WIDTH - 8);
                      const labelY = clampValue(group.y - 10 + (((Math.floor(seed / 7) % 5) - 2) * 3), 10, DEPARTMENT_MAP_CANVAS_HEIGHT - 10);
                      const title = isCluster
                        ? `Cluster: ${formatNumber(group.total)} matriculados en ${group.clusterCount} municipios`
                        : `${group.name}: ${formatNumber(group.total)} matriculados`;
                      return (
                        <g
                          key={`muni-group-${group.key}`}
                          style={{ cursor: isCluster ? 'default' : 'pointer' }}
                          onClick={() => {
                            if (!isCluster) {
                              setMatriculadosMunicipioSelection((prev) => (normalizeGeoNameKey(prev || '') === normalizeGeoNameKey(group.name || '') ? '' : group.name));
                            }
                          }}
                          onMouseEnter={() => {
                            const pct = selectedDeptTotal > 0 ? (normalizeNumber(group.total || 0) / selectedDeptTotal) * 100 : 0;
                            setGeoHoverCard({
                              x: group.x,
                              y: group.y,
                              title: isCluster ? `Cluster (${group.clusterCount} municipios)` : String(group.name || ''),
                              total: normalizeNumber(group.total || 0),
                              percent: pct
                            });
                          }}
                          onMouseLeave={() => setGeoHoverCard(null)}
                        >
                          {isCluster && (
                            <circle
                              cx={group.x}
                              cy={group.y}
                              r={radius + 2.2}
                              fill="none"
                              stroke={markerColor}
                              strokeOpacity="0.30"
                              strokeWidth="1.2"
                            />
                          )}
                          <circle
                            cx={group.x}
                            cy={group.y}
                            r={radius}
                            fill={markerColor}
                            fillOpacity={isCluster ? 0.90 : 0.84}
                            stroke="#eff6ff"
                            strokeWidth="1.15"
                          />
                          <text
                            x={labelX}
                            y={labelY}
                            textAnchor="middle"
                            fontSize={isCluster ? '8.4' : '8.1'}
                            fill={markerColor}
                            fontWeight="800"
                            fontFamily="system-ui,sans-serif"
                            stroke="#ffffff"
                            strokeWidth="2.2"
                            paintOrder="stroke"
                          >
                            {labelText}
                          </text>
                          <title>{title}</title>
                        </g>
                      );
                    })}
                    {deptMunicipalityPolygons.length === 0 && (
                      <text x={DEPARTMENT_MAP_CANVAS_WIDTH / 2} y={DEPARTMENT_MAP_CANVAS_HEIGHT - 40} textAnchor="middle" fontSize="13" fill="#6b7280" fontFamily="system-ui,sans-serif">Sin datos de municipio normalizado en los registros</text>
                    )}
                    {geoHoverCard && (
                      <g style={{ pointerEvents: 'none' }}>
                        <rect x={clampValue(geoHoverCard.x + 16, 16, DEPARTMENT_MAP_CANVAS_WIDTH - 206)} y={clampValue(geoHoverCard.y - 14, 16, DEPARTMENT_MAP_CANVAS_HEIGHT - 74)} width="190" height="58" rx="8" fill="#0f172a" opacity="0.94" />
                        <text x={clampValue(geoHoverCard.x + 28, 28, DEPARTMENT_MAP_CANVAS_WIDTH - 194)} y={clampValue(geoHoverCard.y + 4, 30, DEPARTMENT_MAP_CANVAS_HEIGHT - 48)} fontSize="9.8" fill="#fff" fontWeight="800" fontFamily="system-ui,sans-serif">{geoHoverCard.title}</text>
                        <text x={clampValue(geoHoverCard.x + 28, 28, DEPARTMENT_MAP_CANVAS_WIDTH - 194)} y={clampValue(geoHoverCard.y + 22, 46, DEPARTMENT_MAP_CANVAS_HEIGHT - 30)} fontSize="9.8" fill="#bfdbfe" fontWeight="700" fontFamily="system-ui,sans-serif">{`Total matriculados: ${formatNumber(geoHoverCard.total)}`}</text>
                        <text x={clampValue(geoHoverCard.x + 28, 28, DEPARTMENT_MAP_CANVAS_WIDTH - 194)} y={clampValue(geoHoverCard.y + 38, 62, DEPARTMENT_MAP_CANVAS_HEIGHT - 12)} fontSize="9.8" fill="#93c5fd" fontWeight="700" fontFamily="system-ui,sans-serif">{`Participación: ${Number(geoHoverCard.percent || 0).toFixed(1)}%`}</text>
                      </g>
                    )}
                  </svg>
                ) : (
                  <Stack alignItems="center" justifyContent="center" spacing={2} sx={{
                    height: '100%', minHeight: { xs: 580, md: 900, lg: 1020 },
                    background: 'linear-gradient(160deg, #f0fdf4 0%, #dcfce7 60%, #bbf7d0 100%)'
                  }}>
                    <LocationCityIcon sx={{ fontSize: 60, color: '#6ee7b7' }} />
                    <Typography sx={{ color: '#6b7280', fontSize: 13, fontWeight: 600, textAlign: 'center', maxWidth: 260, lineHeight: 1.6 }}>
                      Haz clic en un departamento del mapa superior para explorar sus municipios
                    </Typography>
                  </Stack>
                )}
              </Box>
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: { xs: 500, sm: 620, md: 760, lg: 860 },
                  border: '1px solid #b7e4d7',
                  borderRadius: 2.5,
                  overflow: 'hidden',
                  bgcolor: '#fff',
                  boxShadow: '0 10px 30px rgba(15,118,110,0.08)'
                }}
              >
                <Box sx={{ px: 1.8, py: 1.1, borderBottom: '1px solid #dcfce7', background: 'linear-gradient(135deg, rgba(15,118,110,0.08) 0%, rgba(15,118,110,0.02) 100%)' }}>
                  <Typography sx={{ fontWeight: 900, color: '#064e3b', fontSize: 13.5 }}>
                    Tablas de municipios
                  </Typography>
                  <Typography sx={{ color: '#0f766e', fontSize: 11.2, mt: 0.2 }}>
                    {matriculadosGeoSelection
                      ? 'Bloques de maximo 10 municipios ordenados de mayor a menor'
                      : 'La tabla se activa cuando selecciones un departamento'}
                  </Typography>
                </Box>
                <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: { xs: 1.5, sm: 1.8 }, minHeight: 0 }}>
                {muniSummaryRows.length > 0 ? (
                  <Box
                    sx={{
                      flex: 1,
                      minHeight: 0,
                      display: 'grid',
                      gap: 1.4,
                      alignContent: 'start',
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: 'repeat(auto-fit, minmax(280px, 1fr))'
                      }
                    }}
                  >
                    {muniSummaryColumns.map((columnRows, columnIndex) => (
                      <TableContainer
                        key={`muni-column-${columnIndex}`}
                        sx={{
                          border: '1px solid #dcfce7',
                          borderRadius: 2,
                          bgcolor: '#fcfffd',
                          boxShadow: '0 8px 18px rgba(15,118,110,0.05)',
                          '& .MuiTableCell-root': { borderColor: '#e5f7ef', py: 0.8 }
                        }}
                      >
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell align="center" sx={{ width: 44, bgcolor: '#ecfdf5', fontWeight: 900, fontSize: 11.5 }}>#</TableCell>
                              <TableCell sx={{ bgcolor: '#ecfdf5', fontWeight: 900, fontSize: 11.5 }}>Municipio</TableCell>
                              <TableCell align="right" sx={{ width: 84, bgcolor: '#ecfdf5', fontWeight: 900, fontSize: 11.5 }}>Total</TableCell>
                              <TableCell align="right" sx={{ width: 64, bgcolor: '#ecfdf5', fontWeight: 900, fontSize: 11.5 }}>%</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {columnRows.map((item, localIndex) => {
                              const absoluteIndex = (columnIndex * 10) + localIndex;
                              const pct = (normalizeNumber(item.total || 0) / muniTableTotal) * 100;
                              const muniName = String(item.municipio || item.name || '');
                              const isSelected = normalizeGeoNameKey(muniName) === normalizeGeoNameKey(matriculadosMunicipioSelection || '');
                              return (
                                <TableRow
                                  key={`${muniName || absoluteIndex}-${columnIndex}`}
                                  hover
                                  onClick={() => setMatriculadosMunicipioSelection((prev) => (prev === muniName ? '' : muniName))}
                                  sx={{ cursor: 'pointer', '& td': { bgcolor: isSelected ? '#d1fae5' : '#fff' } }}
                                >
                                  <TableCell align="center" sx={{ fontWeight: 800, color: '#64748b' }}>{absoluteIndex + 1}</TableCell>
                                  <TableCell sx={{ fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>{normalizeUiUpper(muniName)}</TableCell>
                                  <TableCell align="right" sx={{ fontWeight: 900, color: '#0f766e' }}>{formatNumber(item.total)}</TableCell>
                                  <TableCell align="right" sx={{ color: '#64748b', fontWeight: 700 }}>{pct.toFixed(1)}%</TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    ))}
                  </Box>
                ) : (
                  <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ flex: 1, py: 6 }}>
                    <LocationCityIcon sx={{ fontSize: 44, color: '#a7f3d0' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: '#0f766e', fontWeight: 700, fontSize: 13 }}>
                        {matriculadosGeoSelection ? 'Sin municipios disponibles' : 'Selecciona un departamento'}
                      </Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 11.5, mt: 0.4, maxWidth: 220 }}>
                        {matriculadosGeoSelection ? 'No hay datos de municipios para esta selección' : 'Haz clic en el mapa para ver la distribución municipal'}
                      </Typography>
                    </Box>
                  </Stack>
                )}
              </Box>
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ── ROW 3: SEXO BIOLÓGICO + NIVEL DE FORMACIÓN ── */}
        <Paper elevation={0} sx={{ borderRadius: 0, borderTop: '1px solid #cffafe', borderBottom: '1px solid #dbe6f5', overflow: 'hidden', p: 2 }}>
          <Box sx={GI_MATRICULADOS_LAYOUT_GRID_SX}>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
              {/* Header */}
              <Box sx={{ px: 2.5, py: 1.4, background: 'linear-gradient(135deg,#164e63 0%,#0891b2 100%)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <PeopleIcon sx={{ fontSize: 17, color: '#fff' }} />
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Sexo Biológico</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{formatNumber(total)} matriculados · {sexoRows.length} categoría{sexoRows.length !== 1 ? 's' : ''}</Typography>
                </Box>
              </Box>

              <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                {sexoRows.length > 0 ? (
                  <>
                    {/* ── Complementary donut charts ── */}
                    <Box sx={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${Math.min(sexoRows.length, 3)}, 1fr)`,
                      gap: 1.5, mb: 2
                    }}>
                      {sexoRows.map((s, si) => {
                        /* Direction: Femenino fills CCW (left), Masculino fills CW (right), No Binario CW */
                        const isCCW = s.iconGender === 'F';
                        const endAngle = isCCW ? 90 + 360 : 90 - 360;
                        const pieData = [
                          { name: s.label, value: s.pct },
                          { name: 'resto', value: 100 - s.pct }
                        ];
                        return (
                          <Box key={s.key} sx={{
                            borderRadius: 3, bgcolor: s.bg,
                            border: `1.5px solid ${s.color}22`,
                            p: '12px 8px 14px',
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            position: 'relative', overflow: 'hidden'
                          }}>
                            {/* Top accent */}
                            <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, bgcolor: s.color, borderRadius: '3px 3px 0 0' }} />

                            {/* Recharts donut — percentage + label inside, no icon */}
                            <Box sx={{ width: '100%', height: 148 }}>
                              <ResponsiveContainer width="100%" height="100%">
                                <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                                  <Pie
                                    data={pieData}
                                    cx="50%" cy="50%"
                                    innerRadius="58%" outerRadius="82%"
                                    startAngle={90}
                                    endAngle={endAngle}
                                    dataKey="value"
                                    strokeWidth={0}
                                    isAnimationActive
                                    animationDuration={900}
                                    animationEasing="ease-out"
                                  >
                                    <Cell fill={s.color} />
                                    <Cell fill={`${s.color}22`} />
                                  </Pie>
                                  {/* Center: percentage */}
                                  <text x="50%" y="44%" textAnchor="middle" dominantBaseline="middle"
                                    fill={s.color} fontSize="20" fontWeight="900" fontFamily="system-ui,sans-serif">
                                    {s.pct.toFixed(1)}%
                                  </text>
                                  {/* Center: label */}
                                  <text x="50%" y="60%" textAnchor="middle" dominantBaseline="middle"
                                    fill={s.color} fontSize="9.5" fontWeight="800" fontFamily="system-ui,sans-serif"
                                    letterSpacing="0.8">
                                    {s.label}
                                  </text>
                                </PieChart>
                              </ResponsiveContainer>
                            </Box>

                            {/* Icon badge + count — below the donut */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                              <Box sx={{
                                width: 30, height: 30, borderRadius: '50%',
                                bgcolor: '#fff', boxShadow: `0 2px 8px ${s.color}45`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                              }}>
                                <svg width="18" height="18" viewBox="0 0 24 24">
                                  {s.iconGender === 'F' ? (
                                    <g fill={s.color}>
                                      <circle cx="12" cy="5" r="2.8" />
                                      <path d="M12 9.5c-2.4 0-4.2 1.6-4.2 4v3h2.2v4h4v-4h2.2v-3c0-2.4-1.8-4-4.2-4z" />
                                    </g>
                                  ) : s.iconGender === 'M' ? (
                                    <g fill={s.color}>
                                      <circle cx="12" cy="5" r="2.8" />
                                      <path d="M12 9.5c-2.3 0-4 1.5-4 3.8V17h2.5v5h3v-5H16v-3.7c0-2.3-1.7-3.8-4-3.8z" />
                                    </g>
                                  ) : (
                                    <g fill={s.color}>
                                      <circle cx="12" cy="5" r="2.8" />
                                      <path d="M12 9.5c-2 0-3.5 1.3-3.5 3.2V16h1.8v5h3.4v-5h1.8v-3.3c0-1.9-1.5-3.2-3.5-3.2z" />
                                      <line x1="12" y1="1.5" x2="12" y2="3" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" />
                                      <line x1="10.2" y1="2.2" x2="12" y2="3" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" />
                                      <line x1="13.8" y1="2.2" x2="12" y2="3" stroke={s.color} strokeWidth="1.5" strokeLinecap="round" />
                                    </g>
                                  )}
                                </svg>
                              </Box>
                              <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#334155', letterSpacing: 0.2 }}>
                                {formatNumber(s.total)}{' '}
                                <Typography component="span" sx={{ fontSize: 10.5, fontWeight: 500, color: '#64748b' }}>personas</Typography>
                              </Typography>
                            </Box>
                          </Box>
                        );
                      })}
                    </Box>

                    {/* ── Expandable table by sex ── */}
                    <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                      {/* Table header */}
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', px: 2, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sexo biológico</Typography>
                        <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, mr: 3 }}>Total</Typography>
                        <Box sx={{ width: 20 }} />
                      </Box>

                      {sexoRows.map((s, idx) => {
                        const isExpanded = sexoExpandedKey === s.key;
                        const isLast = idx === sexoRows.length - 1;
                        return (
                          <Box key={s.key} sx={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                            {/* Row */}
                            <Box
                              onClick={() => setSexoExpandedKey(isExpanded ? null : s.key)}
                              sx={{
                                display: 'grid', gridTemplateColumns: '1fr auto auto',
                                alignItems: 'center', px: 2, py: 1.1, cursor: 'pointer',
                                bgcolor: isExpanded ? `${s.color}08` : 'transparent',
                                transition: 'background 0.2s',
                                '&:hover': { bgcolor: `${s.color}10` }
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: s.color, flexShrink: 0 }} />
                                <Typography sx={{ fontSize: 12.5, fontWeight: 700, color: '#1e293b', textTransform: 'uppercase', letterSpacing: 0.3 }}>{s.label}</Typography>
                              </Box>
                              <Box sx={{
                                minWidth: 40, height: 22, borderRadius: 11, px: 1,
                                bgcolor: `${s.color}18`, border: `1px solid ${s.color}40`,
                                display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5
                              }}>
                                <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: s.color }}>{formatNumber(s.total)}</Typography>
                              </Box>
                              <Box sx={{
                                width: 20, height: 20, borderRadius: '50%',
                                bgcolor: isExpanded ? s.color : '#f1f5f9',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                transition: 'all 0.25s'
                              }}>
                                <Typography sx={{
                                  fontSize: 11, fontWeight: 900, lineHeight: 1,
                                  color: isExpanded ? '#fff' : '#94a3b8',
                                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                  transition: 'transform 0.25s', userSelect: 'none'
                                }}>▾</Typography>
                              </Box>
                            </Box>

                            {/* Expanded: program breakdown */}
                            <Collapse in={isExpanded} timeout={260} unmountOnExit>
                              <Box sx={{ bgcolor: `${s.color}04`, borderTop: `1px solid ${s.color}20` }}>
                                {/* Sub-header */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto', px: 2, py: 0.8, bgcolor: `${s.color}10`, borderBottom: `1px solid ${s.color}15` }}>
                                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>Programa académico</Typography>
                                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: s.color, textTransform: 'uppercase', letterSpacing: 0.6 }}>Cantidad</Typography>
                                </Box>
                                {s.programas.length > 0 ? s.programas.map((p, pi) => (
                                  <Box key={pi} sx={{
                                    display: 'grid', gridTemplateColumns: '1fr auto',
                                    alignItems: 'center', px: 2, py: 0.55,
                                    borderBottom: pi < s.programas.length - 1 ? `1px solid ${s.color}10` : 'none',
                                    '&:hover': { bgcolor: `${s.color}08` }
                                  }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7 }}>
                                      <Box sx={{ width: 4, height: 4, borderRadius: '50%', bgcolor: s.color, flexShrink: 0, opacity: 0.65 }} />
                                      <Typography sx={{ fontSize: 11, color: '#334155', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.15, lineHeight: 1.3 }}>
                                        {p.programa}
                                      </Typography>
                                    </Box>
                                    <Box sx={{
                                      minWidth: 36, height: 20, borderRadius: 10, px: 0.8,
                                      bgcolor: `${s.color}15`,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: s.color }}>{formatNumber(p.total)}</Typography>
                                    </Box>
                                  </Box>
                                )) : (
                                  <Box sx={{ px: 2, py: 1.5 }}>
                                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>Sin detalle de programas disponible</Typography>
                                  </Box>
                                )}
                              </Box>
                            </Collapse>
                          </Box>
                        );
                      })}
                    </Box>
                  </>
                ) : (
                  <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 5 }}>
                    <PeopleIcon sx={{ fontSize: 52, color: '#a5f3fc' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: '#0891b2', fontWeight: 700, fontSize: 13 }}>Sin datos de sexo biológico</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 11.5, mt: 0.4 }}>Se muestra al importar la base Matriculados</Typography>
                    </Box>
                  </Stack>
                )}
              </Box>
            </Box>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
              {/* Header */}
              <Box sx={{ px: 2.5, py: 1.4, background: 'linear-gradient(135deg,#0f2f57 0%,#1d4f8c 100%)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <SchoolIcon sx={{ fontSize: 17, color: '#fff' }} />
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Distribución por Nivel de Formación</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{formatNumber(total)} matriculados · {nivelesRows.length} nivel{nivelesRows.length !== 1 ? 'es' : ''}</Typography>
                </Box>
              </Box>

              <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
                {/* ── Compact cards ── */}
                <Grid container spacing={1.2} sx={{ mb: nivelesRows.length > 0 ? 2 : 0 }}>
                  {nivelesRows.map((nivel) => {
                    const pct = ((nivel.total / nivelTotal) * 100).toFixed(1);
                    return (
                      <Grid item xs={6} sm={Math.max(2, Math.floor(12 / nivelesRows.length))} key={nivel.nivel}>
                        <Box sx={{
                          p: { xs: 1.2, sm: 1.5 },
                          borderRadius: 2,
                          bgcolor: nivel.bg,
                          border: `1.5px solid ${nivel.color}30`,
                          textAlign: 'center',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          <Box sx={{
                            position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                            bgcolor: nivel.color, borderRadius: '2px 2px 0 0'
                          }} />
                          <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: nivel.color, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.3, mt: 0.3 }}>
                            {nivel.label}
                          </Typography>
                          <Typography sx={{ fontSize: { xs: 22, sm: 26 }, fontWeight: 900, color: nivel.color, lineHeight: 1.1 }}>
                            {nivel.total}
                          </Typography>
                          <Typography sx={{ fontSize: 10, color: '#64748b', mt: 0.2 }}>
                            {pct}% · {nivel.total} programa{nivel.total !== 1 ? 's' : ''}
                          </Typography>
                          <Box sx={{ height: 3.5, bgcolor: `${nivel.color}20`, borderRadius: 99, mt: 0.7 }}>
                            <Box sx={{ width: `${Math.min(100, Number(pct))}%`, height: '100%', bgcolor: nivel.color, borderRadius: 99, transition: 'width 0.6s ease' }} />
                          </Box>
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>

                {/* ── Expandable table ── */}
                {nivelesRows.length > 0 && (
                  <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                    {/* Table header */}
                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr auto auto', alignItems: 'center', px: 2, py: 1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>Nivel de formación</Typography>
                      <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5, mr: 3 }}>Programas</Typography>
                      <Box sx={{ width: 20 }} />
                    </Box>

                    {/* Table rows with accordion */}
                    {nivelesRows.map((nivel, idx) => {
                      const isExpanded = nivelExpandedKey === nivel.nivel;
                      const isLast = idx === nivelesRows.length - 1;
                      return (
                        <Box key={nivel.nivel} sx={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                          {/* Row */}
                          <Box
                            onClick={() => setNivelExpandedKey(isExpanded ? null : nivel.nivel)}
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: '1fr auto auto',
                              alignItems: 'center',
                              px: 2,
                              py: 1.1,
                              cursor: 'pointer',
                              bgcolor: isExpanded ? `${nivel.color}08` : 'transparent',
                              transition: 'background 0.2s',
                              '&:hover': { bgcolor: `${nivel.color}10` }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: nivel.color, flexShrink: 0 }} />
                              <Typography sx={{ fontSize: 12.5, fontWeight: 600, color: '#1e293b' }}>{nivel.label}</Typography>
                            </Box>
                            <Box sx={{
                              minWidth: 30, height: 22, borderRadius: 11,
                              bgcolor: `${nivel.color}18`, border: `1px solid ${nivel.color}40`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', mr: 1.5
                            }}>
                              <Typography sx={{ fontSize: 11.5, fontWeight: 800, color: nivel.color }}>{nivel.total}</Typography>
                            </Box>
                            <Box sx={{
                              width: 20, height: 20, borderRadius: '50%',
                              bgcolor: isExpanded ? nivel.color : '#f1f5f9',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              transition: 'all 0.25s'
                            }}>
                              <Typography sx={{
                                fontSize: 11, fontWeight: 900,
                                color: isExpanded ? '#fff' : '#94a3b8',
                                lineHeight: 1,
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.25s',
                                userSelect: 'none'
                              }}>▾</Typography>
                            </Box>
                          </Box>

                          {/* Expanded programs list grouped by faculty */}
                          <Collapse in={isExpanded} timeout={260} unmountOnExit>
                            <Box sx={{ px: 2, pb: 2, pt: 1.2, bgcolor: `${nivel.color}04`, borderTop: `1px solid ${nivel.color}20` }}>
                              {(() => {
                                const byFaculty = {};
                                nivel.programas.forEach((prog) => {
                                  const fac = classifyProgramFaculty(prog);
                                  if (!byFaculty[fac]) byFaculty[fac] = [];
                                  byFaculty[fac].push(prog);
                                });
                                const facKeys = FACULTY_ORDER.filter((f) => byFaculty[f])
                                  .concat(Object.keys(byFaculty).filter((f) => !FACULTY_ORDER.includes(f)));
                                const cols = facKeys.length === 1 ? 1 : 2;
                                return (
                                  <Box sx={{
                                    display: 'grid',
                                    gridTemplateColumns: `repeat(${cols}, 1fr)`,
                                    gap: '12px 16px',
                                    alignItems: 'start'
                                  }}>
                                    {facKeys.map((fac) => (
                                      <Box key={fac} sx={{ minWidth: 0 }}>
                                        {/* Faculty header — fixed height, no wrap */}
                                        <Box sx={{
                                          display: 'flex', alignItems: 'center', gap: 0.6,
                                          mb: 0.8, pb: 0.4, borderBottom: `1.5px solid ${nivel.color}35`
                                        }}>
                                          <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: nivel.color, flexShrink: 0 }} />
                                          <Typography sx={{
                                            fontSize: 9, fontWeight: 900, color: nivel.color,
                                            textTransform: 'uppercase', letterSpacing: 0.5,
                                            lineHeight: 1.3, wordBreak: 'break-word'
                                          }}>
                                            {fac}
                                          </Typography>
                                        </Box>
                                        {/* Programs — all same font, wraps uniformly */}
                                        {byFaculty[fac].map((prog, pi) => (
                                          <Box key={pi} sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.7, py: '2px' }}>
                                            <Box sx={{
                                              width: 4, height: 4, borderRadius: '50%',
                                              bgcolor: nivel.color, flexShrink: 0, mt: '4px', opacity: 0.75
                                            }} />
                                            <Typography sx={{
                                              fontSize: 10.5, color: '#1e293b', fontWeight: 600,
                                              lineHeight: 1.4, textTransform: 'uppercase',
                                              letterSpacing: 0.15, wordBreak: 'break-word',
                                              overflowWrap: 'break-word'
                                            }}>
                                              {prog}
                                            </Typography>
                                          </Box>
                                        ))}
                                      </Box>
                                    ))}
                                  </Box>
                                );
                              })()}
                            </Box>
                          </Collapse>
                        </Box>
                      );
                    })}
                  </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ── ROW 4: MATRÍCULA INTERNACIONAL + HISTÓRICO INTERACTIVO ── */}
        <Paper elevation={0} sx={{ borderRadius: 0, borderTop: '1px solid #fef3c7', overflow: 'hidden', p: 2 }}>
          <Box sx={GI_MATRICULADOS_LAYOUT_GRID_SX}>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
              {/* Header */}
              <Box sx={{ px: 2.5, py: 1.4, background: 'linear-gradient(135deg,#78350f 0%,#92400e 45%,#b45309 80%,#d97706 100%)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PublicIcon sx={{ fontSize: 18, color: '#fff' }} />
                  <Box>
                    <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Matrícula Internacional</Typography>
                    <Typography sx={{ color: 'rgba(255,255,255,0.72)', fontSize: 11 }}>
                      {matriculadosCountries.length > 0 ? `${matriculadosCountries.length} países · ${formatNumber(internationalTotal)} total` : 'Sin registros internacionales'}
                    </Typography>
                  </Box>
                </Stack>
                {matriculadosCountries.length > 0 && (
                  <Box sx={{ bgcolor: 'rgba(255,255,255,0.22)', borderRadius: 99, px: 1.2, py: 0.3 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
                      {((internationalTotal / Math.max(normalizeNumber(matriculadosPanelData?.totalRegistros || 0), 1)) * 100).toFixed(1)}% del total
                    </Typography>
                  </Box>
                )}
              </Box>

              {/* Column labels */}
              {matriculadosCountries.length > 0 && (
                <Box sx={{ px: 2, py: 0.8, bgcolor: '#fffbeb', borderBottom: '1px solid #fef3c7', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 16 }}>#</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 24 }}>🏳</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', flex: 1 }}>País</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 60 }}>Proporción</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 24, textAlign: 'right' }}>N</Typography>
                  <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em', minWidth: 44 }}>(%)</Typography>
                  <Box sx={{ minWidth: 18 }} />
                </Box>
              )}

              {/* Rows */}
              {matriculadosCountries.length > 0 ? (
                <Box>
                  {matriculadosCountries.slice(0, 15).map((country, idx) => {
                    const pct = (normalizeNumber(country.total || 0) / Math.max(internationalTotal, 1)) * 100;
                    const maxC = normalizeNumber(matriculadosCountries[0]?.total || 1);
                    const isExpanded = intlExpandedCountry === country.name;
                    const hasPrograms = (country.programas || []).length > 0;
                    const barColor = idx === 0 ? '#d97706' : idx < 3 ? '#f59e0b' : '#fbbf24';
                    return (
                      <React.Fragment key={country.name}>
                        {/* Country row */}
                        <Box
                          onClick={() => hasPrograms && setIntlExpandedCountry(isExpanded ? null : country.name)}
                          sx={{
                            px: 2, py: 1,
                            display: 'flex', alignItems: 'center', gap: 1,
                            borderBottom: '1px solid #faf5ed',
                            cursor: hasPrograms ? 'pointer' : 'default',
                            bgcolor: isExpanded ? '#fffbeb' : idx % 2 === 0 ? '#fff' : '#fdfaf5',
                            transition: 'background 0.15s',
                            '&:hover': hasPrograms ? { bgcolor: isExpanded ? '#fef3c7' : '#fffbf0' } : {}
                          }}
                        >
                          <Typography sx={{ fontSize: 10, color: '#d1a75a', fontWeight: 800, minWidth: 16, textAlign: 'center' }}>{idx + 1}</Typography>
                          <Box sx={{ minWidth: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <CountryFlagIcon countryName={country.name} alt={country.name} sx={{ width: 22, height: 15 }} />
                          </Box>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {normalizeUiUpper(String(country.name || ''))}
                            </Typography>
                            {hasPrograms && (
                              <Typography sx={{ fontSize: 9.5, color: '#94a3b8' }}>
                                {country.programas.length} programa{country.programas.length !== 1 ? 's' : ''}
                              </Typography>
                            )}
                          </Box>
                          <Box sx={{ minWidth: 60, flexShrink: 0 }}>
                            <Box sx={{ bgcolor: '#fef3c7', borderRadius: 99, height: 6, overflow: 'hidden' }}>
                              <Box sx={{ width: `${(normalizeNumber(country.total) / maxC) * 100}%`, height: '100%', bgcolor: barColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                            </Box>
                          </Box>
                          <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#1e293b', minWidth: 24, textAlign: 'right' }}>{formatNumber(country.total)}</Typography>
                          <Typography sx={{ fontSize: 10, color: '#94a3b8', minWidth: 44 }}>({pct.toFixed(1)}%)</Typography>
                          <Box sx={{ minWidth: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {hasPrograms && (
                              <Box component="span" sx={{ fontSize: 13, color: '#d97706', transition: 'transform 0.22s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)', lineHeight: 1 }}>▾</Box>
                            )}
                          </Box>
                        </Box>

                        {/* Programs sub-list */}
                        {isExpanded && hasPrograms && (
                          <Box sx={{ bgcolor: '#fffbeb', borderBottom: '1px solid #f1f5f9' }}>
                            <Box sx={{ pl: 8, pr: 2, py: 0.7, bgcolor: '#fef3c7', borderBottom: '1px solid #fde68a' }}>
                              <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                                Programas · {normalizeUiUpper(String(country.name || ''))}
                              </Typography>
                            </Box>
                            {(country.programas || []).map((prog, pi) => {
                              const progKey = `${country.name}__${prog.programa}`;
                              const isProgramExpanded = intlExpandedProgram === progKey;
                              const hasSexo = (prog.sexo || []).length > 0;
                              return (
                                <React.Fragment key={progKey}>
                                  <Box
                                    onClick={() => hasSexo && setIntlExpandedProgram(isProgramExpanded ? null : progKey)}
                                    sx={{
                                      pl: 8, pr: 2, py: 0.9,
                                      display: 'flex', alignItems: 'center', gap: 1,
                                      borderBottom: pi < country.programas.length - 1 ? '1px solid #fef3c760' : 'none',
                                      cursor: hasSexo ? 'pointer' : 'default',
                                      bgcolor: isProgramExpanded ? '#fef9c3' : 'transparent',
                                      transition: 'background 0.12s',
                                      '&:hover': hasSexo ? { bgcolor: '#fef3c760' } : {}
                                    }}
                                  >
                                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#f59e0b', flexShrink: 0 }} />
                                    <Typography sx={{ fontSize: 11.5, fontWeight: 600, color: '#78350f', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {normalizeUiUpper(String(prog.programa || ''))}
                                    </Typography>
                                    {hasSexo && (
                                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0 }}>
                                        {(prog.sexo || []).map((s, si) => (
                                          <Box key={si} sx={{
                                            px: 0.8, py: 0.2, borderRadius: 99, fontSize: 10, fontWeight: 700,
                                            bgcolor: s.name === 'FEMENINO' ? '#fce7f3' : s.name === 'MASCULINO' ? '#eff6ff' : '#f3f4f6',
                                            color: s.name === 'FEMENINO' ? '#be185d' : s.name === 'MASCULINO' ? '#1d4ed8' : '#6b7280',
                                          }}>
                                            {s.name === 'FEMENINO' ? '♀' : s.name === 'MASCULINO' ? '♂' : '○'} {formatNumber(s.total)}
                                          </Box>
                                        ))}
                                      </Stack>
                                    )}
                                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#92400e', minWidth: 20, textAlign: 'right' }}>{formatNumber(prog.total)}</Typography>
                                    {hasSexo && (
                                      <Box component="span" sx={{ fontSize: 11, color: '#b45309', transition: 'transform 0.2s', display: 'inline-block', transform: isProgramExpanded ? 'rotate(180deg)' : 'rotate(0deg)', lineHeight: 1, minWidth: 14 }}>▾</Box>
                                    )}
                                  </Box>

                                  {/* Sex breakdown */}
                                  {isProgramExpanded && hasSexo && (
                                    <Box sx={{ pl: 11, pr: 3, py: 1.2, bgcolor: '#fefce8', borderBottom: '1px solid #fef3c7' }}>
                                      <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 0.8 }}>
                                        Distribución por sexo biológico
                                      </Typography>
                                      <Stack spacing={0.7}>
                                        {(prog.sexo || []).map((s, si) => {
                                          const sPct = prog.total ? (normalizeNumber(s.total) / normalizeNumber(prog.total)) * 100 : 0;
                                          const sColor = s.name === 'FEMENINO' ? '#be185d' : s.name === 'MASCULINO' ? '#1d4ed8' : '#6b7280';
                                          return (
                                            <Stack key={si} direction="row" alignItems="center" spacing={1}>
                                              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: sColor, flexShrink: 0 }} />
                                              <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#475569', minWidth: 80 }}>
                                                {s.name === 'FEMENINO' ? 'Femenino' : s.name === 'MASCULINO' ? 'Masculino' : s.name}
                                              </Typography>
                                              <Box sx={{ flex: 1, bgcolor: '#f1f5f9', borderRadius: 99, height: 7, overflow: 'hidden' }}>
                                                <Box sx={{ height: '100%', width: `${sPct}%`, bgcolor: sColor, borderRadius: 99, transition: 'width 0.4s ease' }} />
                                              </Box>
                                              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#1e293b', minWidth: 22, textAlign: 'right' }}>{formatNumber(s.total)}</Typography>
                                              <Typography sx={{ fontSize: 10, color: '#94a3b8', minWidth: 36 }}>{sPct.toFixed(1)}%</Typography>
                                            </Stack>
                                          );
                                        })}
                                      </Stack>
                                      {/* Summary cards */}
                                      <Stack direction="row" spacing={0.8} sx={{ mt: 1, pt: 0.8, borderTop: '1px solid #fde68a' }}>
                                        {(prog.sexo || []).map((s, si) => {
                                          const sPct = prog.total ? (normalizeNumber(s.total) / normalizeNumber(prog.total)) * 100 : 0;
                                          const sColor = s.name === 'FEMENINO' ? '#be185d' : s.name === 'MASCULINO' ? '#1d4ed8' : '#6b7280';
                                          return (
                                            <Box key={si} sx={{
                                              flex: 1, p: 0.8, borderRadius: 1.5, textAlign: 'center',
                                              bgcolor: s.name === 'FEMENINO' ? '#fce7f3' : s.name === 'MASCULINO' ? '#eff6ff' : '#f3f4f6',
                                              border: `1px solid ${sColor}22`
                                            }}>
                                              <Typography sx={{ fontSize: 17, fontWeight: 900, color: sColor, lineHeight: 1.1 }}>{formatNumber(s.total)}</Typography>
                                              <Typography sx={{ fontSize: 9.5, color: '#94a3b8', fontWeight: 600 }}>
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
                  {/* Footer */}
                  <Box sx={{ px: 2, py: 1, bgcolor: '#fef3c7', borderTop: '1px solid #fde68a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 700, color: '#92400e' }}>Total internacional</Typography>
                    <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#78350f' }}>
                      {formatNumber(internationalTotal)} · {((internationalTotal / Math.max(normalizeNumber(matriculadosPanelData?.totalRegistros || 0), 1)) * 100).toFixed(2)}%
                    </Typography>
                  </Box>
                </Box>
              ) : (
                <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ py: 5 }}>
                  <PublicIcon sx={{ fontSize: 48, color: '#fde68a' }} />
                  <Box sx={{ textAlign: 'center' }}>
                    <Typography sx={{ color: '#b45309', fontWeight: 700, fontSize: 12.5 }}>Sin matrícula internacional</Typography>
                    <Typography sx={{ color: '#94a3b8', fontSize: 11.5, mt: 0.4 }}>Aparecerá al importar la base Matriculados</Typography>
                  </Box>
                </Stack>
              )}
            </Box>
            <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
              <Box sx={{ px: 2.5, py: 1.4, background: 'linear-gradient(135deg,#0f2f57 0%,#1d4f8c 100%)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
                <AutoGraphIcon sx={{ fontSize: 17, color: '#fff' }} />
                <Box>
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>Histórico de Matrículas</Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 11 }}>{semCompareData.length} año(s) · clic en series para mostrar/ocultar</Typography>
                </Box>
              </Box>
              <Box sx={{ px: { xs: 2, sm: 2.5 }, pt: 1.5 }}>
                <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mb: 1 }}>
                  {[
                    { key: 'total', label: 'Total Matriculados', color: '#1d4ed8' },
                    { key: 's1', label: 'Semestre I', color: '#0891b2' },
                    { key: 's2', label: 'Semestre II', color: '#059669' }
                  ].map((s) => (
                    <Box
                      key={s.key}
                      onClick={() => setMatChartHidden((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 0.7, px: 1.2, py: 0.5, borderRadius: 99,
                        border: `1.5px solid ${matChartHidden[s.key] ? '#cbd5e1' : s.color}`,
                        bgcolor: matChartHidden[s.key] ? '#f8fafc' : `${s.color}14`,
                        cursor: 'pointer', transition: 'all 0.18s', userSelect: 'none'
                      }}
                    >
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: matChartHidden[s.key] ? '#cbd5e1' : s.color }} />
                      <Typography sx={{ fontSize: 11, color: matChartHidden[s.key] ? '#94a3b8' : s.color, fontWeight: 700 }}>{s.label}</Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>
              <Box sx={{ px: { xs: 2, sm: 2.5 }, pb: { xs: 2, sm: 2.5 } }}>
                {semCompareData.length === 0 ? (
                  <Stack alignItems="center" justifyContent="center" spacing={2} sx={{ height: { xs: 240, md: 300 }, bgcolor: '#f8fafc', borderRadius: 2, border: '1px dashed #cbd5e1' }}>
                    <AutoGraphIcon sx={{ fontSize: 56, color: '#bfdbfe' }} />
                    <Box sx={{ textAlign: 'center' }}>
                      <Typography sx={{ color: '#1d4ed8', fontWeight: 700, fontSize: 13.5 }}>Sin datos históricos de matrícula</Typography>
                      <Typography sx={{ color: '#94a3b8', fontSize: 12, mt: 0.4, maxWidth: 300 }}>El gráfico de tendencia aparecerá una vez estén disponibles los registros de Matriculados con años y semestres</Typography>
                    </Box>
                  </Stack>
                ) : (
                <Box sx={{ height: { xs: 280, md: 340 } }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={semCompareData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                      <defs>
                        <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.28}/>
                          <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="gradHS1" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0891b2" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#0891b2" stopOpacity={0.02}/>
                        </linearGradient>
                        <linearGradient id="gradHS2" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#059669" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#059669" stopOpacity={0.02}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 3" stroke="#b8ccde" strokeWidth={0.8} />
                      <XAxis dataKey="anio" tick={{ fontSize: 11, fill: '#475569', fontWeight: 700 }} axisLine={{ stroke: '#94a3b8' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={(v) => fmtCompact(v)} width={48} />
                      <RechartsTooltip
                        formatter={(v, n) => [formatNumber(v), n === 'total' ? 'Total Matriculados' : n === 's1' ? 'Semestre I' : 'Semestre II']}
                        contentStyle={{ borderRadius: 8, border: '1px solid #dbeafe', fontSize: 11, boxShadow: '0 4px 16px -4px rgba(0,0,0,0.15)' }}
                        labelStyle={{ fontWeight: 800, color: '#0f172a' }}
                      />
                      {!matChartHidden.total && <Area type="monotone" dataKey="total" name="total" stroke="#1d4ed8" strokeWidth={2.5} fill="url(#gradTotal)" dot={{ r: 4, fill: '#1d4ed8', strokeWidth: 0 }} activeDot={{ r: 6 }} />}
                      {!matChartHidden.s1 && <Area type="monotone" dataKey="s1" name="s1" stroke="#0891b2" strokeWidth={2} fill="url(#gradHS1)" dot={{ r: 3.5, fill: '#0891b2', strokeWidth: 0 }} activeDot={{ r: 5 }} />}
                      {!matChartHidden.s2 && <Area type="monotone" dataKey="s2" name="s2" stroke="#059669" strokeWidth={2} fill="url(#gradHS2)" dot={{ r: 3.5, fill: '#059669', strokeWidth: 0 }} activeDot={{ r: 5 }} />}
                    </AreaChart>
                  </ResponsiveContainer>
                </Box>
                )}
              </Box>
            </Box>
          </Box>
        </Paper>

        {/* ── ROW 5: PROGRAMAS ACADÉMICOS POR NIVEL DE FORMACIÓN ── */}
        {(() => {
          /* Aggregate matriculados by programa — usa programasPorSexo del geo-dashboard (dinámico) */
          const PROG_NIVEL_META = {
            TECNOLOGICO:    { label: 'Tecnológico',     color: '#b45309', bg: '#fffbeb', border: '#fde68a', icon: '🔧' },
            PROFESIONAL:    { label: 'Profesional',     color: '#1d4ed8', bg: '#eff6ff', border: '#bfdbfe', icon: '🎓' },
            ESPECIALIZACION:{ label: 'Especialización', color: '#0f766e', bg: '#f0fdf4', border: '#bbf7d0', icon: '📋' },
            MAESTRIA:       { label: 'Maestría',        color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe', icon: '🔬' },
            DOCTORADO:      { label: 'Doctorado',       color: '#9f1239', bg: '#fff1f2', border: '#fecdd3', icon: '🏛️' },
          };
          const PROG_NIVEL_ORDER = ['TECNOLOGICO', 'PROFESIONAL', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'];

          // Acumular totales por programa desde programasPorSexo del geo-dashboard.
          // Esta fuente viene de filteredRows del backend → responde a los filtros de
          // año, período, programa y nivel, e incluye datos nuevos (2026, maestría, etc.)
          const progMap = {};
          Object.values(matriculadosPanelData?.programasPorSexo || {}).forEach((progList) => {
            (progList || []).forEach((p) => {
              const label = String(p.programa || '').trim();
              if (!label) return;
              const key = normalizeProgramKey(label);
              if (!key) return;
              if (!progMap[key]) progMap[key] = { label, total: 0 };
              progMap[key].total += normalizeNumber(p.total || 0);
            });
          });

          /* Group by formation level */
          const byLevel = {};
          Object.values(progMap).forEach(({ label, total }) => {
            const rawLevel = classifyProgramLevel(label);
            /* Map classifyProgramLevel output to PROG_NIVEL_META keys */
            let levelKey = 'PROFESIONAL';
            const t = rawLevel.toUpperCase();
            if (t.includes('TECNO')) levelKey = 'TECNOLOGICO';
            else if (t.includes('TECNICA') || t.includes('TECNICO') || t.includes('FORM')) levelKey = 'TECNOLOGICO';
            else if (t.includes('DOCTOR')) levelKey = 'DOCTORADO';
            else if (t.includes('MAESTRIA') || t.includes('MAESTRÍA')) levelKey = 'MAESTRIA';
            else if (t.includes('ESPECIALIZACION') || t.includes('ESPECIALIZ')) levelKey = 'ESPECIALIZACION';
            if (!byLevel[levelKey]) byLevel[levelKey] = [];
            byLevel[levelKey].push({ programa: label, total });
          });

          /* Sort each level desc */
          PROG_NIVEL_ORDER.forEach((k) => { if (byLevel[k]) byLevel[k].sort((a, b) => b.total - a.total); });

          const activeNiveles = PROG_NIVEL_ORDER.filter((k) => byLevel[k]?.length > 0);
          if (activeNiveles.length === 0) return null;

          const grandTotal = Object.values(progMap).reduce((s, r) => s + r.total, 0);
          const grandMax = Math.max(...Object.values(progMap).map((r) => r.total), 1);
          const totalPrograms = Object.keys(progMap).length;

          return (
            <Paper elevation={0} sx={{ borderRadius: 0, borderTop: '1px solid #dbeafe', overflow: 'hidden' }}>
              {/* ── Module header ── */}
              <Box sx={{
                px: 2.5, py: 1.6,
                background: 'linear-gradient(135deg,#0f2f57 0%,#1d4f8c 100%)',
                display: 'flex', alignItems: 'center', gap: 1.5
              }}>
                <Box sx={{
                  width: 32, height: 32, borderRadius: 1.5, bgcolor: 'rgba(255,255,255,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <Typography sx={{ fontSize: 16, lineHeight: 1 }}>📊</Typography>
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography sx={{ color: '#fff', fontWeight: 800, fontSize: 14, lineHeight: 1.2 }}>
                    Programas Académicos por Número de Matriculados
                  </Typography>
                  <Typography sx={{ color: 'rgba(255,255,255,0.65)', fontSize: 11, mt: 0.2 }}>
                    {formatNumber(grandTotal)} matriculados · {totalPrograms} programas · {activeNiveles.length} nivel{activeNiveles.length !== 1 ? 'es' : ''}
                  </Typography>
                </Box>
                {/* Level pill summary */}
                <Stack direction="row" spacing={0.7} flexWrap="wrap" sx={{ display: { xs: 'none', md: 'flex' } }}>
                  {activeNiveles.map((k) => (
                    <Box key={k} sx={{
                      px: 1, py: 0.3, borderRadius: 99,
                      bgcolor: 'rgba(255,255,255,0.12)',
                      border: '1px solid rgba(255,255,255,0.2)'
                    }}>
                      <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#fff', letterSpacing: 0.3 }}>
                        {PROG_NIVEL_META[k].label} {byLevel[k].length}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </Box>

              {/* ── Level sections ── */}
              <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 2 }}>
                {activeNiveles.map((levelKey) => {
                  const meta = PROG_NIVEL_META[levelKey];
                  const programs = byLevel[levelKey];
                  const levelTotal = programs.reduce((s, r) => s + r.total, 0);
                  const levelMax = programs[0]?.total || 1;

                  return (
                    <Box key={levelKey} sx={{
                      border: `1px solid ${meta.border}`,
                      borderRadius: 2.5,
                      overflow: 'hidden',
                      bgcolor: '#fff'
                    }}>
                      {/* Section header */}
                      <Box sx={{
                        px: 2, py: 1.2,
                        bgcolor: meta.bg,
                        borderBottom: `1px solid ${meta.border}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                      }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                          <Typography sx={{ fontSize: 15, lineHeight: 1 }}>{meta.icon}</Typography>
                          <Box>
                            <Typography sx={{ fontSize: 12, fontWeight: 800, color: meta.color, textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.2 }}>
                              {meta.label}
                            </Typography>
                            <Typography sx={{ fontSize: 10, color: '#64748b' }}>
                              {programs.length} programa{programs.length !== 1 ? 's' : ''} · {formatNumber(levelTotal)} mat.
                            </Typography>
                          </Box>
                        </Box>
                        {/* Level share bar */}
                        <Box sx={{ textAlign: 'right' }}>
                          <Typography sx={{ fontSize: 13, fontWeight: 900, color: meta.color }}>
                            {grandTotal > 0 ? ((levelTotal / grandTotal) * 100).toFixed(1) : 0}%
                          </Typography>
                          <Typography sx={{ fontSize: 9.5, color: '#94a3b8' }}>del total</Typography>
                        </Box>
                      </Box>

                      {/* Programs list */}
                      <Box sx={{ px: 2, py: 1.2 }}>
                        <Stack spacing={0.9}>
                          {programs.map((prog, idx) => {
                            const barPct = (prog.total / grandMax) * 100;
                            const localPct = (prog.total / levelMax) * 100;
                            const isFirst = idx === 0;
                            return (
                              <Box key={idx}>
                                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.4 }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.7, minWidth: 0, pr: 1 }}>
                                    {/* Rank dot */}
                                    <Box sx={{
                                      width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                                      bgcolor: isFirst ? meta.color : idx < 3 ? `${meta.color}30` : '#f1f5f9',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                      <Typography sx={{ fontSize: 8.5, fontWeight: 900, color: isFirst ? '#fff' : meta.color, lineHeight: 1 }}>
                                        {idx + 1}
                                      </Typography>
                                    </Box>
                                    <Typography sx={{
                                      fontSize: { xs: 9.5, sm: 11 },
                                      fontWeight: isFirst ? 800 : 600,
                                      color: '#0f172a',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                      whiteSpace: 'nowrap',
                                      textTransform: 'uppercase',
                                      letterSpacing: 0.1
                                    }}>
                                      {prog.programa}
                                    </Typography>
                                  </Box>
                                  <Typography sx={{ fontSize: 12, fontWeight: 900, color: meta.color, flexShrink: 0 }}>
                                    {formatNumber(prog.total)}
                                  </Typography>
                                </Box>
                                {/* Dual bar: local fill + global proportion indicator */}
                                <Box sx={{ height: 6, bgcolor: `${meta.color}12`, borderRadius: 99, overflow: 'hidden' }}>
                                  <Box sx={{
                                    height: '100%',
                                    width: `${Math.max(0.8, localPct)}%`,
                                    background: isFirst
                                      ? `linear-gradient(90deg,${meta.color} 0%,${meta.color}aa 100%)`
                                      : `linear-gradient(90deg,${meta.color}99 0%,${meta.color}44 100%)`,
                                    borderRadius: 99,
                                    transition: 'width 0.7s cubic-bezier(.4,0,.2,1)',
                                    position: 'relative'
                                  }}>
                                    {/* Global proportion marker */}
                                    <Box sx={{
                                      position: 'absolute', top: 0, bottom: 0,
                                      left: `${Math.min(100, barPct)}%`,
                                      width: 2, bgcolor: '#fff', opacity: 0.6
                                    }} />
                                  </Box>
                                </Box>
                              </Box>
                            );
                          })}
                        </Stack>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Paper>
          );
        })()}

        {/* Bottom spacer */}
        <Box sx={{ pb: 1 }} />
        </>)}
      </Stack>
      </Box>
    );
  };

  const renderMatriculadosRechartsChart = (series) => {
    if (!series || series.length === 0) return null;
    const showLabels = series.length <= 22;
    const chartData = series.map((row) => ({ name: String(row.periodLabel || '').toUpperCase(), value: normalizeNumber(row.matriculados || 0) }));
    const fmtAxis = (v) => {
      if (v >= 1000000) return (v / 1000000).toFixed(1) + 'M';
      if (v >= 1000) return (v / 1000).toFixed(v >= 10000 ? 0 : 1) + 'k';
      return String(v);
    };
    const CustomTooltip = ({ active, payload, label }) => {
      if (!active || !payload || !payload.length) return null;
      return (
        <Box sx={{ bgcolor: '#fff', border: '1px solid #dbeafe', borderRadius: 2, p: 1.5, boxShadow: '0 8px 24px -6px rgba(29,78,216,0.22)', minWidth: 150 }}>
          <Typography sx={{ fontSize: 11, color: '#1d4ed8', fontWeight: 800, mb: 0.6 }}>{label}</Typography>
          <Stack direction="row" spacing={0.8} alignItems="center">
            <Box sx={{ width: 10, height: 10, borderRadius: 1, background: 'linear-gradient(135deg,#1d4ed8,#3b82f6)' }} />
            <Typography sx={{ fontSize: 14, color: '#0f172a', fontWeight: 900 }}>{formatNumber(payload[0].value)}</Typography>
          </Stack>
          <Typography sx={{ fontSize: 10, color: '#94a3b8', mt: 0.3 }}>matriculados</Typography>
        </Box>
      );
    };
    return (
      <Box sx={{ width: '100%', overflowX: 'auto', pb: 1 }}>
        <Box sx={{ width: '100%' }}>
          <Box sx={{ height: 360 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: showLabels ? 32 : 14, right: 16, left: 0, bottom: 4 }} barCategoryGap="12%">
                <defs>
                  <linearGradient id="matBarGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                    <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.92} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="4 3" stroke="#93b8d8" strokeWidth={0.9} />
                <XAxis dataKey="name" tick={{ fontSize: 10.5, fill: '#334155', fontWeight: 700 }} axisLine={{ stroke: '#94a3b8', strokeWidth: 1 }} tickLine={false} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: '#64748b' }} axisLine={false} tickLine={false} tickFormatter={fmtAxis} width={48} />
                <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(29,78,216,0.07)' }} />
                <Bar dataKey="value" fill="url(#matBarGrad2)" radius={[5, 5, 0, 0]}>
                  {showLabels && (
                    <LabelList dataKey="value" position="top" formatter={(v) => formatNumber(v)} style={{ fontSize: 12, fill: '#1d4ed8', fontWeight: 900 }} />
                  )}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderStatsModule = () => (
    poblacionalPanel === 'hub' ? renderPoblacionalHub() :
    poblacionalPanel === 'desercion' ? renderDesercionDashboardPanel() :
    poblacionalPanel === 'contexto_externo' ? renderContextoExternoDashboardPanel() :
    poblacionalPanel === 'empleabilidad' ? renderEmpleabilidadDashboardPanel() :
    poblacionalPanel === 'resumen_estadistico' ? renderResumenEstadisticoPanel() :
    poblacionalPanel === 'saber_pro' ? (
      <Stack spacing={2}>
        <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setPoblacionalPanel('hub')}>
            Volver a dashboards Poblacional
          </Button>
        </Paper>
        {renderSaberProStatsModule({ embedded: true })}
      </Stack>
    ) :
    (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ width: '100%' }}>
        <Stack spacing={2.2}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setSelectedCard(null)}>
          Volver a tarjetas
        </Button>
      </Box>

      <Box sx={{ mb: 1.4, overflowX: 'auto' }}>
          <Box
            sx={{
              display: 'grid',
              gap: 0.8,
              minWidth: '100%',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))'
            }}
          >
            {REPORT_SECTIONS.map((section) => {
              const active = statSection === section.key;
              return (
                <Button
                  key={section.key}
                  onClick={() => setStatSection(section.key)}
                  disableElevation
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 1.8,
                    px: { xs: 1.6, md: 2.2 },
                    py: 1.1,
                    minHeight: { xs: 48, md: 52 },
                    width: '100%',
                    whiteSpace: 'normal',
                    fontSize: { xs: 12.8, md: 13.6 },
                    lineHeight: 1.15,
                    textAlign: 'center',
                    border: active ? '1px solid transparent' : '1px solid #bcd0f7',
                    color: active ? '#ffffff' : '#2563eb',
                    background: active
                      ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%)'
                      : '#ffffff',
                    boxShadow: active ? '0 10px 18px -14px rgba(37,99,235,.9)' : 'none',
                    '&:hover': {
                      background: active
                        ? 'linear-gradient(135deg, #3b82f6 0%, #2563eb 55%, #1d4ed8 100%)'
                        : '#f3f7ff',
                      borderColor: active ? 'transparent' : '#93b4f5'
                    }
                  }}
                >
                  {section.key === 'flujo' ? (
                    <>
                      Inscritos, Admitidos
                      <br />
                      y Primer Curso
                    </>
                  ) : (
                    section.title
                  )}
                </Button>
              );
            })}
            <Button
              onClick={() => {
                setResumenEstadisticoUi((prev) => ({ ...prev, module: 'informacion_general' }));
                setPoblacionalPanel('resumen_estadistico');
              }}
              disableElevation
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                borderRadius: 1.8,
                px: { xs: 1.6, md: 2.2 },
                py: 1.1,
                minHeight: { xs: 48, md: 52 },
                width: '100%',
                whiteSpace: 'normal',
                fontSize: { xs: 12.8, md: 13.6 },
                lineHeight: 1.15,
                textAlign: 'center',
                border: '1px solid #bcd0f7',
                color: '#0f766e',
                background: '#ffffff',
                '&:hover': {
                  background: '#f3f7ff',
                  borderColor: '#93b4f5'
                }
              }}
            >
              Cuadros Maestros
            </Button>
          </Box>
      </Box>

                <Paper elevation={0} sx={{ p: 0, mb: 2, border: '1px solid #dbe6f5', borderRadius: 3, bgcolor: '#fff', overflow: 'hidden' }}>
                  {/* Filter panel header */}
                  <Box sx={{ px: 2, py: 1.4, background: 'linear-gradient(135deg, #0f2f57 0%, #1d4f8c 45%, #2d6bb6 100%)', position: 'relative', overflow: 'hidden' }}>
                    <Box sx={{ position: 'absolute', top: -28, right: -28, width: 110, height: 110, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.06)' }} />
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} spacing={1}>
                      <Stack direction="row" spacing={1.2} alignItems="center">
                        <Box sx={{ bgcolor: 'rgba(255,255,255,0.14)', borderRadius: 1.5, p: 0.7, display: 'flex' }}>
                          <AutoGraphIcon sx={{ fontSize: 19, color: '#fff' }} />
                        </Box>
                        <Box>
                          <Typography sx={{ fontWeight: 900, color: '#fff', fontSize: 15, letterSpacing: 0.1 }}>
                            Filtros de análisis
                          </Typography>
                          <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 11 }}>
                            {(() => {
                              const allP = matriculadosProgramasDisponibles.length > 0 && matriculadosLocalFilters.programas.length === matriculadosProgramasDisponibles.length;
                              const allA = matriculadosAniosDisponibles.length > 0 && matriculadosLocalFilters.anios.length === matriculadosAniosDisponibles.length;
                              const allPer = matriculadosPeriodosDisponibles.length > 0 && matriculadosLocalFilters.periodos.length === matriculadosPeriodosDisponibles.length;
                              const active = [
                                !allP && matriculadosLocalFilters.programas.length > 0 && `${matriculadosLocalFilters.programas.length} programa(s)`,
                                !allA && matriculadosLocalFilters.anios.length > 0 && `${matriculadosLocalFilters.anios.length} año(s)`,
                                !allPer && matriculadosLocalFilters.periodos.length > 0 && `${matriculadosLocalFilters.periodos.length} período(s)`
                              ].filter(Boolean);
                              return active.length ? `Activos: ${active.join(' · ')}` : 'Mostrando todos los datos disponibles';
                            })()}
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => setMatriculadosLocalFilters({ anios: [], programas: [], periodos: [] })}
                        sx={{ borderColor: 'rgba(191,219,254,.8)', color: '#dbeafe', bgcolor: 'rgba(255,255,255,0.08)', fontWeight: 700, fontSize: 12, textTransform: 'none', borderRadius: 1.5, px: 1.6, whiteSpace: 'nowrap', '&:hover': { borderColor: '#fff', bgcolor: 'rgba(255,255,255,0.16)' } }}
                      >
                        Restablecer
                      </Button>
                    </Stack>
                  </Box>
                  {/* Filter controls body - single row: Año → Período → Programa */}
                  <Box sx={{ p: { xs: 1.4, sm: 1.8 } }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="flex-end">
                      {/* Año */}
                      <Box sx={{ flex: '0 0 auto', minWidth: 130 }}>
                        <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>Año</Typography>
                        <Select
                          multiple
                          displayEmpty
                          size="small"
                          fullWidth
                          value={matriculadosLocalFilters.anios}
                          onChange={(e) => handleMatriculadosFilterChange('anios', e.target.value, matriculadosAniosDisponibles)}
                          renderValue={(selected) => {
                            const allSelected = !selected.length || (matriculadosAniosDisponibles.length > 0 && selected.length === matriculadosAniosDisponibles.length);
                            return allSelected
                              ? <Typography sx={{ color: '#64748b', fontSize: 13 }}>Todos</Typography>
                              : <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{[...selected].sort().join(', ')}</Typography>;
                          }}
                          MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                          sx={{ ...GI_FILTER_SELECT_SX, bgcolor: '#f8fafc' }}
                        >
                          <MenuItem value="__ALL__">
                            <Checkbox checked={matriculadosAniosDisponibles.length > 0 && matriculadosLocalFilters.anios.length === matriculadosAniosDisponibles.length} size="small" color="primary" />
                            <ListItemText primary={<Typography sx={{ fontWeight: 700, fontSize: 13 }}>Todos los años</Typography>} />
                          </MenuItem>
                          {matriculadosAniosDisponibles.map((anio) => {
                            const val = String(anio);
                            return (
                              <MenuItem value={val} key={val} dense>
                                <Checkbox checked={matriculadosLocalFilters.anios.includes(val)} size="small" color="primary" />
                                <ListItemText primary={<Typography sx={{ fontSize: 13 }}>{val}</Typography>} />
                              </MenuItem>
                            );
                          })}
                        </Select>
                      </Box>
                      {/* Período */}
                      <Box sx={{ flex: '0 0 auto', minWidth: 170 }}>
                        <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>Período</Typography>
                        <Select
                          multiple
                          displayEmpty
                          size="small"
                          fullWidth
                          value={matriculadosLocalFilters.periodos}
                          onChange={(e) => handleMatriculadosFilterChange('periodos', e.target.value, matriculadosPeriodosDisponibles.map((x) => x.label))}
                          renderValue={(selected) => {
                            const allSelected = !selected.length || (matriculadosPeriodosDisponibles.length > 0 && selected.length === matriculadosPeriodosDisponibles.length);
                            return allSelected
                              ? <Typography sx={{ color: '#64748b', fontSize: 13 }}>Todos</Typography>
                              : <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{selected.length} período(s)</Typography>;
                          }}
                          MenuProps={{ PaperProps: { style: { maxHeight: 280 } } }}
                          sx={{ ...GI_FILTER_SELECT_SX, bgcolor: '#f8fafc' }}
                        >
                          <MenuItem value="__ALL__">
                            <Checkbox checked={matriculadosPeriodosDisponibles.length > 0 && matriculadosLocalFilters.periodos.length === matriculadosPeriodosDisponibles.length} size="small" color="primary" />
                            <ListItemText primary={<Typography sx={{ fontWeight: 700, fontSize: 13 }}>Todos los períodos</Typography>} />
                          </MenuItem>
                          {matriculadosPeriodosDisponibles.map((item) => (
                            <MenuItem value={item.label} key={item.label} dense>
                              <Checkbox checked={matriculadosLocalFilters.periodos.includes(item.label)} size="small" color="primary" />
                              <ListItemText primary={<Typography sx={{ fontSize: 13 }}>{item.label}</Typography>} />
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                      {/* Programa */}
                      <Box sx={{ flex: 1, minWidth: 200 }}>
                        <Typography variant="caption" sx={GI_FILTER_LABEL_SX}>Programa académico</Typography>
                        <Select
                          multiple
                          displayEmpty
                          size="small"
                          fullWidth
                          value={matriculadosLocalFilters.programas}
                          onChange={(e) => handleMatriculadosFilterChange('programas', e.target.value, matriculadosProgramasDisponibles)}
                          renderValue={(selected) => {
                            const allSelected = !selected.length || (matriculadosProgramasDisponibles.length > 0 && selected.length === matriculadosProgramasDisponibles.length);
                            return allSelected
                              ? <Typography sx={{ color: '#64748b', fontSize: 13 }}>Todos los programas</Typography>
                              : <Typography sx={{ color: '#0f172a', fontSize: 13, fontWeight: 600 }}>{selected.length} programa(s)</Typography>;
                          }}
                          MenuProps={{ PaperProps: { style: { maxHeight: 320 } } }}
                          sx={{ ...GI_FILTER_SELECT_SX, bgcolor: '#f8fafc' }}
                        >
                          <MenuItem value="__ALL__">
                            <Checkbox checked={matriculadosProgramasDisponibles.length > 0 && matriculadosLocalFilters.programas.length === matriculadosProgramasDisponibles.length} size="small" color="primary" />
                            <ListItemText primary={<Typography sx={{ fontWeight: 700, fontSize: 13 }}>Seleccionar todos</Typography>} />
                          </MenuItem>
                          {matriculadosProgramasDisponibles.map((programa) => (
                            <MenuItem value={programa} key={programa} dense>
                              <Checkbox checked={matriculadosLocalFilters.programas.includes(programa)} size="small" color="primary" />
                              <ListItemText primary={<Typography sx={{ fontSize: 13 }}>{programa}</Typography>} />
                            </MenuItem>
                          ))}
                        </Select>
                      </Box>
                    </Stack>
                  </Box>
                </Paper>

        {(isSeriesInitialLoad || (activeSection.key === 'matriculados' && matriculadosPanelLoading && !matriculadosPanelData)) ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: '#334155' }}>Cargando series historicas...</Typography>
        ) : (activeSection.key === 'matriculados'
          ? !(matriculadosPanelData?.historico?.length > 0) && activeSeries.length === 0
          : activeSeries.length === 0
        ) ? (
          <Typography sx={{ py: 4, textAlign: 'center', color: '#334155' }}>No hay datos historicos para los filtros seleccionados.</Typography>
        ) : (
          <>
            <Box sx={{ mb: 0.7 }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="flex-end">
                <Tooltip title="Ampliar grafico">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ZoomInIcon />}
                      onClick={handleExpandPoblacionalChart}
                      disabled={isSeriesInitialLoad || activeSeries.length === 0}
                      sx={{ ...GI_OUTLINE_ACTION_BTN_SX, width: { xs: '100%', sm: 138 } }}
                    >
                      Ampliar
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Descargar grafico PNG">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<DownloadIconSmall />}
                      onClick={handleDownloadPoblacionalChart}
                      disabled={isSeriesInitialLoad || activeSeries.length === 0}
                      sx={{ ...GI_OUTLINE_ACTION_BTN_SX, width: { xs: '100%', sm: 152 } }}
                    >
                      Descargar
                    </Button>
                  </span>
                </Tooltip>
                <Tooltip title="Copiar grafico">
                  <span>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<ContentCopyIcon />}
                      onClick={handleCopyPoblacionalChart}
                      disabled={isSeriesInitialLoad || activeSeries.length === 0}
                      sx={{ ...GI_OUTLINE_ACTION_BTN_SX, width: { xs: '100%', sm: 124 } }}
                    >
                      Copiar
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>

            <Box ref={poblacionalChartRef} sx={{ borderRadius: 2, bgcolor: '#ffffff' }}>
              {activeSection.key === 'flujo' && (
                <>{renderStackedBars(activeSeries)}</>
              )}
              {activeSection.key === 'matriculados' && (
                <>{renderMatriculadosRechartsChart(
                  // Usar historico del geo-dashboard (datos vivos, reactivo a filtros y a
                  // nuevas importaciones como 2026). activeSeries viene de la tabla de
                  // estadísticas pre-agregadas que puede no tener datos recientes.
                  (matriculadosPanelData?.historico || []).length > 0
                    ? matriculadosPanelData.historico.map((h) => ({ periodLabel: h.periodLabel, matriculados: h.total }))
                    : activeSeries
                )}</>
              )}
              {activeSection.key === 'graduados' && (
                <>
                  {renderSimpleBars(activeSeries, 'graduados', '#0f766e')}
                  {renderCantidadTotalEgresadosCards()}
                </>
              )}
              {activeSection.key === 'caracterizacion' && renderCaracterizacionDashboard(activeSeries)}
            </Box>

            <Paper elevation={0} sx={{ mt: 2, p: 1.6, borderRadius: 2, border: '1px solid #dbe6f5', bgcolor: '#f8fbff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography sx={{ fontWeight: 800, color: '#1e3a8a' }}>Analisis automatico del grafico (IA)</Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Chip size="small" color="primary" variant="outlined" label="Dinamico por filtros" />
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<ContentCopyIcon />}
                    onClick={handleCopyAnalysisText}
                  >
                    Copiar texto
                  </Button>
                </Stack>
              </Stack>
              <Typography variant="body2" sx={{ mt: 1, color: '#334155', lineHeight: 1.65, whiteSpace: 'pre-line' }}>
                {automaticChartAnalysis}
              </Typography>
            </Paper>
            {activeSection.key === 'matriculados' && renderMatriculadosDashboardPanel()}
            {activeSection.key === 'flujo' && (
              <>
                {renderFlujoProgramTables()}
                {renderFlujoAnnualIndependentCharts()}
              </>
            )}
          </>
        )}
        </Stack>
      </Box>
    </Box>
  ));

  const renderSaberProStatsModule = (options = {}) => (
    <SaberProLandingPage
      onBack={() => (options.embedded ? setPoblacionalPanel('hub') : setSelectedCard(null))}
      allowedDashboards={visibleSaberProDashboards}
    />
  );

  return (
    <Fade in={true}>
      <Box>
        {!isDirectDocumentalView && (
          <Paper elevation={0} sx={{ p: 3, mb: 3, borderRadius: 3, border: '1px solid #dbe2f1', background: 'linear-gradient(135deg,#0f172a,#1d4ed8)' }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <InsightsIcon sx={{ color: 'white' }} />
              <Box>
                <Typography variant="h4" sx={{ color: 'white', fontWeight: 800 }}>Gestión de la Información</Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.86)' }}>
                  {isPlaneacionGpInfoContext
                    ? 'Visualización de módulos estadísticos institucionales.'
                    : 'Administración de bases de datos e indicadores institucionales.'}
                </Typography>
              </Box>
            </Stack>
          </Paper>
        )}


        {canManageBasesInView && menuView === 'gestion_bases' && (
          <>
            <Paper elevation={0} sx={{ p: 3, mb: 3, border: '1px solid #e2e8f0', borderRadius: 3 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <FormControl fullWidth sx={{ minWidth: 220 }}>
                    <InputLabel>Base principal</InputLabel>
                    <Select
                      value={baseSeleccionada}
                      label="Base principal"
                      onChange={(e) => {
                        const nextBase = e.target.value;
                        setBaseSeleccionada(nextBase);
                        if (nextBase === 'georreferencia') setSubBaseSeleccionada(GEOREFERENCIA_CANONICAL_SUBBASE);
                        else if (nextBase === 'autoevaluacion') setSubBaseSeleccionada('Autoevaluación');
                        else if (!['poblacional', 'georreferencia', 'saber_pro', 'recurso_humano', 'autoevaluacion'].includes(nextBase)) setSubBaseSeleccionada('');
                        setSubSubBaseSeleccionada('');
                        setPage(0);
                      }}
                    >
                      <MenuItem value=""><em>Sin seleccionar</em></MenuItem>
                      {visibleBases.map((base) => <MenuItem key={base.key} value={base.key}>{base.label}</MenuItem>)}
                    </Select>
                  </FormControl>
                </Grid>
                {aplicaSubbase && (
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth sx={{ minWidth: 220 }}>
                      <InputLabel>Subbase</InputLabel>
                      <Select value={subBaseSeleccionada} label="Subbase" onChange={(e) => {
                        setSubBaseSeleccionada(e.target.value);
                        setSubSubBaseSeleccionada('');
                      }}>
                        <MenuItem value=""><em>Sin seleccionar</em></MenuItem>
                        {availableSubbases.map((sub) => <MenuItem key={sub} value={sub}>{sub}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                {requiresSubSubBase && (
                  <Grid item xs={12} md={4}>
                    <FormControl fullWidth sx={{ minWidth: 220 }}>
                      <InputLabel>Lista Contexto Externo</InputLabel>
                      <Select value={subSubBaseSeleccionada} label="Lista Contexto Externo" onChange={(e) => setSubSubBaseSeleccionada(e.target.value)}>
                        <MenuItem value=""><em>Sin seleccionar</em></MenuItem>
                        {CONTEXTO_EXTERNO_LISTAS.map((sub) => <MenuItem key={sub} value={sub}>{sub}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                <Grid item xs={12} md={aplicaSubbase ? (requiresSubSubBase ? 4 : 4) : 8}>
                  <Button variant="outlined" fullWidth component="label" startIcon={<UploadFileIcon />} sx={{ py: 1.8 }}>
                    {importFile ? importFile.name : 'Adjuntar archivo Excel o CSV'}
                    <input type="file" hidden accept=".xlsx,.xls,.csv,text/csv" onChange={(e) => setImportFile(e.target.files[0])} />
                  </Button>
                </Grid>
              </Grid>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 2 }} alignItems={{ xs: 'stretch', md: 'center' }}>
                <Button variant="contained" onClick={handleImport} disabled={!isSelectionValid || !importFile || importing}>{importing ? 'Importando...' : 'Importar'}</Button>
                <Button variant="outlined" startIcon={<DownloadIcon />} onClick={handleDownloadTemplate} disabled={!isSelectionValid}>Descargar plantilla vacia</Button>
                <Button color="error" variant="outlined" startIcon={<DeleteSweepIcon />} onClick={handleClearDataset} disabled={!isSelectionValid || clearing}>
                  {clearing ? 'Eliminando...' : 'Eliminar datos de esta tabla'}
                </Button>
                <Button
                  variant="text"
                  onClick={() => {
                    setBaseSeleccionada('');
                    setSubBaseSeleccionada('');
                    setSubSubBaseSeleccionada('');
                    setImportFile(null);
                  }}
                >
                  Limpiar seleccion
                </Button>
              </Stack>
              {baseSeleccionada === 'poblacional' && subBaseSeleccionada === 'Matriculados' && (
                <Alert severity="info" sx={{ mt: 2.2, borderRadius: 2 }}>
                  La subbase <strong>Matriculados</strong> solo acepta la nueva plantilla institucional de 36 columnas. Puedes cargar Excel o CSV; si falta una columna o el orden no coincide, el archivo sera rechazado.
                </Alert>
              )}
              {baseSeleccionada === 'saber_pro' && subBaseSeleccionada === 'Resultados individuales' && (
                <Alert severity="info" sx={{ mt: 2.2, borderRadius: 2 }}>
                  La subbase <strong>Resultados individuales</strong> solo acepta un libro Excel con dos hojas obligatorias: <strong>SABER PRO</strong> y <strong>TYT</strong>. Ambas deben conservar exactamente las 23 columnas de la plantilla.
                </Alert>
              )}
              {baseSeleccionada === 'saber_pro' && subBaseSeleccionada === 'Resultados agregados' && (
                <Alert severity="info" sx={{ mt: 2.2, borderRadius: 2 }}>
                  La subbase <strong>Resultados agregados</strong> solo acepta la nueva plantilla de 7 columnas con una sola hoja. El nombre puede variar, pero los encabezados deben coincidir exactamente con la plantilla descargada.
                </Alert>
              )}
              {baseSeleccionada === 'saber_pro' && subBaseSeleccionada === 'Resultados Saber 11' && (
                <Alert severity="info" sx={{ mt: 2.2, borderRadius: 2 }}>
                  La subbase <strong>Resultados Saber 11</strong> acepta un libro Excel con siete hojas obligatorias: <strong>Tipo_1</strong> a <strong>Tipo_7</strong>. La plantilla descargada ahora replica exactamente las columnas reales de cada tipo para que suban el archivo con la misma estructura fuente.
                </Alert>
              )}
              {baseSeleccionada === 'autoevaluacion' && subBaseSeleccionada === 'Participantes' && (
                <Alert severity="info" sx={{ mt: 2.2, borderRadius: 2 }}>
                  La subbase <strong>Participantes</strong> registra el programa, alcance, enlaces de acta/cronograma y el equipo de trabajo asociado al proceso de autoevaluación.
                </Alert>
              )}
            </Paper>

            <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
              <Box sx={{ p: 2.2, borderBottom: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                <Typography sx={{ fontWeight: 900, color: '#0f172a', letterSpacing: 0.2 }}>
                  Centro De Trazabilidad De Cargues
                </Typography>
                <Typography variant="body2" sx={{ color: '#475569', mt: 0.4 }}>
                  Monitorea la calidad de cada carga con evidencia operativa: base registrada, versión normalizada y paquete de errores para cierre al 100%.
                </Typography>
                <Box
                  sx={{
                    mt: 1.1,
                    px: 1.2,
                    py: 0.8,
                    borderRadius: 1.5,
                    bgcolor: '#eaf3ff',
                    border: '1px solid #bfdbfe'
                  }}
                >
                  <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 700 }}>
                    Flujo recomendado: Descargar Base -> Validar Normalizados -> Corregir con Descargar Errores.
                  </Typography>
                </Box>
              </Box>
              <TableContainer
                sx={{
                  width: '100%',
                  overflowX: 'auto',
                  overflowY: 'hidden',
                  '&::-webkit-scrollbar': { height: 8 },
                  '&::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: 8 }
                }}
              >
                <Table
                  size="small"
                  sx={{
                    minWidth: 980,
                    width: '100%',
                    tableLayout: 'fixed',
                    '& .MuiTableCell-root': {
                      fontSize: 13,
                      py: 0.9
                    }
                  }}
                >
                  <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 800, width: 170, fontSize: 12.5, letterSpacing: 0.15 }}>Variable</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 130, fontSize: 12.5, letterSpacing: 0.15 }}>Fecha de cargue</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 260, fontSize: 12.5, letterSpacing: 0.15 }}>Archivo</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 90, fontSize: 12.5, letterSpacing: 0.15 }}>Datos plantilla</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 90, fontSize: 12.5, letterSpacing: 0.15 }}>Datos cargados</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 80, fontSize: 12.5, letterSpacing: 0.15 }}>Omitidos</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 90, fontSize: 12.5, letterSpacing: 0.15 }}>% Cargado</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 110, fontSize: 12.5, letterSpacing: 0.15 }}>Estado</TableCell>
                      <TableCell sx={{ fontWeight: 800, width: 240, fontSize: 12.5, letterSpacing: 0.15 }}>Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {loading ? (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}>Cargando...</TableCell></TableRow>
                    ) : estadisticas.length === 0 ? (
                      <TableRow><TableCell colSpan={9} align="center" sx={{ py: 6 }}>No hay cargues para esta seleccion.</TableCell></TableRow>
                    ) : (
                      groupedCargues.map((row) => {
                        if (row.__group) {
                          return (
                            <TableRow key={row.id}>
                              <TableCell colSpan={9} sx={{ bgcolor: '#dbeafe', fontWeight: 900, color: '#1e3a8a', py: 0.9, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                                {row.label}
                              </TableCell>
                            </TableRow>
                          );
                        }
                        if (row.__subgroup) {
                          return (
                            <TableRow key={row.id}>
                              <TableCell colSpan={9} sx={{ bgcolor: '#f1f5f9', color: '#334155', py: 0.7, fontSize: 12.5 }}>
                                <Box sx={{ pl: 2.2, fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                  {row.label}
                                </Box>
                              </TableCell>
                            </TableRow>
                          );
                        }
                        return (
                          <TableRow
                            key={row.id}
                            hover
                            sx={{
                              '&:hover': { bgcolor: '#f8fafc' },
                              '& td:first-of-type': { borderLeft: '4px solid #e2e8f0', pl: 1 }
                            }}
                          >
                            <TableCell>
                              <Stack spacing={0.45} sx={{ pl: 3 }}>
                                <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', fontSize: 12.5, textTransform: 'uppercase', letterSpacing: 0.15 }}>
                                  {row.variable || row.subcategoria || '-'}
                                </Typography>
                                {getCargaTrackingSummary(row) && (
                                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700, fontSize: 11.5, letterSpacing: 0.15 }}>
                                    {getCargaTrackingSummary(row)}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>{formatDateTime(row.createdAt || row.created_at)}</TableCell>
                            <TableCell
                              sx={{
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis'
                              }}
                              title={row.archivo_nombre || '-'}
                            >
                              {row.archivo_nombre || '-'}
                            </TableCell>
                            <TableCell>{formatNumber(row.total_plantilla || 0)}</TableCell>
                            <TableCell>{formatNumber(row.total_cargados || 0)}</TableCell>
                            <TableCell>{formatNumber(row.total_omitidos || 0)}</TableCell>
                            <TableCell>{Number(row.porcentaje_cargado || 0).toFixed(2)}%</TableCell>
                            <TableCell>
                              <Chip size="small" label={getStatusChip(row).label} sx={{ ...getStatusChip(row).sx, fontSize: 11.5, height: 23 }} />
                            </TableCell>
                            <TableCell sx={{ overflow: 'hidden' }}>
                              <Stack
                                direction={{ xs: 'column', md: 'row' }}
                                spacing={0.8}
                                sx={{ p: 0.2, borderRadius: 1, flexWrap: 'wrap' }}
                              >
                                {canExportBaseRow(row) && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<DownloadIconSmall />}
                                    onClick={() => handleExportBaseCargada(row)}
                                    disabled={exportingBaseRowId === row.id}
                                    sx={{
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      borderColor: '#cbd5e1',
                                      color: '#0f172a',
                                      bgcolor: 'transparent',
                                      boxShadow: 'none',
                                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
                                    }}
                                  >
                                    {exportingBaseRowId === row.id ? 'Exportando...' : 'Descargar base'}
                                  </Button>
                                )}
                                {canExportContextoRow(row) && (
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<DownloadIconSmall />}
                                    onClick={() => handleExportContextoNormalizado(row)}
                                    disabled={exportingContextoRowId === row.id}
                                    sx={{
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      borderColor: '#cbd5e1',
                                      color: '#0f172a',
                                      bgcolor: 'transparent',
                                      boxShadow: 'none',
                                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
                                    }}
                                  >
                                    {exportingContextoRowId === row.id ? 'Exportando...' : 'Descargar normalizados'}
                                  </Button>
                                )}
                                {canExportErroresRow(row) && (
                                  <Button
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                    onClick={() => handleExportCargueErrores(row)}
                                    disabled={exportingErroresRowId === row.id}
                                    sx={{
                                      fontSize: 11.5,
                                      fontWeight: 700,
                                      borderColor: '#cbd5e1',
                                      color: '#0f172a',
                                      bgcolor: 'transparent',
                                      boxShadow: 'none',
                                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
                                    }}
                                  >
                                    {exportingErroresRowId === row.id ? 'Exportando...' : 'Descargar errores'}
                                  </Button>
                                )}
                                {!canExportBaseRow(row) && !canExportContextoRow(row) && !canExportErroresRow(row) && '-'}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                rowsPerPageOptions={[5, 10, 25, 50]}
                count={total}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={(e, next) => setPage(next)}
                onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
                labelRowsPerPage="Filas:"
                sx={{
                  '& .MuiTablePagination-toolbar': { minHeight: 44 },
                  '& .MuiTablePagination-selectLabel, & .MuiTablePagination-displayedRows': { fontSize: 12.5 },
                  '& .MuiSelect-select': { fontSize: 12.5 }
                }}
              />
            </Paper>
          </>
        )}

        {menuView === 'estadistica' && (
          <>
            {user?.role === ROLES.GESTION_PROCESOS ? (
              renderGestionProcesosModule()
            ) : (
              <>
                {!selectedCard && renderStatsCards()}
                {selectedCard === 'poblacional' && renderStatsModule()}
                {selectedCard === 'saber_pro' && renderSaberProStatsModule()}
                {selectedCard === 'recurso_humano' && renderRecursoHumanoStatsModule()}
                {selectedCard === 'gestion_procesos' && renderGestionProcesosModule()}
                {selectedCard === 'activity_monitor' && (
                  <Box>
                    <Stack direction="row" spacing={1} sx={{ mb: 2.5 }} alignItems="center">
                      <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={() => setSelectedCard(null)}>
                        Volver a tarjetas
                      </Button>
                      <Chip label="Monitor de Actividad" color="primary" variant="outlined" />
                    </Stack>
                    <ActivityDashboard embedded />
                  </Box>
                )}
              </>
            )}
          </>
        )}

        <Dialog
          open={clearDialogOpen}
          onClose={() => !clearing && setClearDialogOpen(false)}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Validar eliminación de datos</DialogTitle>
          <DialogContent>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 2 }}>
              Confirma con credenciales del administrador autenticado para eliminar la tabla seleccionada y su historial de cargues.
            </Typography>
            <Stack spacing={1.5}>
              <TextField
                label="Usuario o correo administrador"
                value={clearCredentials.identifier}
                onChange={(e) => setClearCredentials((prev) => ({ ...prev, identifier: e.target.value }))}
                fullWidth
                autoFocus
                disabled={clearing}
              />
              <TextField
                label="Contraseña"
                type="password"
                value={clearCredentials.password}
                onChange={(e) => setClearCredentials((prev) => ({ ...prev, password: e.target.value }))}
                fullWidth
                disabled={clearing}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmClearDataset();
                }}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button onClick={() => setClearDialogOpen(false)} disabled={clearing}>Cancelar</Button>
            <Button color="error" variant="contained" onClick={confirmClearDataset} disabled={clearing}>
              {clearing ? 'Validando...' : 'Confirmar y eliminar'}
            </Button>
          </DialogActions>
        </Dialog>

      </Box>
    </Fade>
  );
}

export default GestionInformacion;
