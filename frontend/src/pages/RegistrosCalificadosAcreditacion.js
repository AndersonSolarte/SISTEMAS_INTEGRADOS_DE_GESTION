import React, { useCallback, useEffect, useState, useMemo } from 'react';
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  LinearProgress,
  Alert,
  Radio,
  FormControlLabel,
  Switch,
  Stepper,
  Step,
  StepLabel,
  Grid
} from '@mui/material';
import {
  Folder as FolderIcon,
  Download as DownloadIcon,
  Visibility as VisibilityIcon,
  Description as DescriptionIcon,
  OpenInNew as OpenInNewIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  School as SchoolIcon,
  EventNote as EventNoteIcon,
  WarningAmber as WarningIcon,
  BarChart as BarChartIcon,
  Assessment as AssessmentIcon,
  ExpandMore as ExpandMoreIcon,
  AutoGraph as AutoGraphIcon,
  MenuBook as MenuBookIcon,
  NotificationsActive as NotificationsActiveIcon,
  Email as EmailIcon,
  Send as SendIcon,
  TableChart as TableChartIcon,
  Speed as SpeedIcon,
  ViewModule as ViewModuleIcon,
  Timeline as TimelineIcon,
  AccountTree as AccountTreeIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  HourglassTop as HourglassTopIcon,
  FactCheck as FactCheckIcon,
  AccountBalance as AccountBalanceIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  EventAvailable as EventAvailableIcon,
  Schedule as ScheduleIcon,
  Policy as PolicyIcon,
  Assignment as AssignmentIcon,
  Verified as VerifiedIcon,
  ErrorOutline as ErrorOutlineIcon,
  HourglassEmpty as HourglassEmptyIcon,
  People as PeopleIcon,
  Info as InfoIcon,
  Notes as NotesIcon,
  DateRange as DateRangeIcon,
  HistoryEdu as HistoryEduIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../services/gestionInformacionService';

const normalizeDriveName = (value = '') =>
  String(value || '')
    .replace(/\.[A-Za-z0-9]{2,8}$/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();

const getDrivePreviewUrl = (file = {}) => {
  if (file.previewLink) return file.previewLink;
  if (!file.id) return file.webViewLink || '';
  return file.isFolder
    ? file.webViewLink || file.folderUrl || ''
    : `https://drive.google.com/file/d/${file.id}/preview`;
};

const getDriveDownloadUrl = (file = {}) => {
  if (file.webViewLink) return file.webViewLink;
  if (file.id) return `https://drive.google.com/file/d/${file.id}/view?usp=sharing`;
  if (file.webContentLink) return file.webContentLink;
  return '';
};

const formatNumber = (num) => {
  const n = Number(num);
  return Number.isFinite(n) ? n.toLocaleString('es-CO') : '0';
};

const formatDate = (value) => {
  if (!value) return '-';
  const numeric = Number(String(value).trim());
  if (Number.isFinite(numeric) && numeric > 20000 && numeric < 90000) {
    const date = new Date(Math.round((numeric - 25569) * 86400 * 1000));
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('es-CO', { timeZone: 'UTC' });
    }
  }
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
};

const parseDateSafe = (val) => {
  if (!val) return null;
  const num = Number(String(val).trim());
  if (Number.isFinite(num) && num > 20000 && num < 90000) {
    const d = new Date(Math.round((num - 25569) * 86400 * 1000));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const str = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [y, m, d] = str.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const slash = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slash) {
    const [, d, m, y] = slash.map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatShortDate = (d) => {
  if (!d) return '-';
  const dt = d instanceof Date ? d : parseDateSafe(d);
  if (!dt || Number.isNaN(dt.getTime())) return String(d);
  const day = String(dt.getDate()).padStart(2, '0');
  const mon = String(dt.getMonth() + 1).padStart(2, '0');
  const yr = dt.getFullYear();
  return `${day}/${mon}/${yr}`;
};

// Identificador de proceso: Condiciones Institucionales vs Condiciones de Programa (Decreto 1330)
const isInstitutionalRecord = (row) => {
  if (!row) return false;
  const id = Number(row.id);
  if (id === 3) return true;
  const nombre = String(row.nombrePrograma || '').toUpperCase();
  const snies = String(row.codigoSnies || '').trim();
  return nombre.includes('CONDICIONES INSTITUCIONALES') || snies === '2744';
};

// Iconografía institucional SVG formal según el estado del ciclo (sin emojis, estándar producción)
const renderStatusIcon = (estado, size = 16) => {
  const sx = { fontSize: size, verticalAlign: 'middle' };
  switch (estado) {
    case 'CRITICO':
      return <WarningIcon sx={{ ...sx, color: '#b91c1c' }} />;
    case 'ALERTA':
      return <ScheduleIcon sx={{ ...sx, color: '#b45309' }} />;
    case 'VIGENTE':
      return <CheckCircleOutlineIcon sx={{ ...sx, color: '#15803d' }} />;
    case 'RENOVADO_MEN':
      return <VerifiedIcon sx={{ ...sx, color: '#15803d' }} />;
    case 'NO_RENOVACION':
    case 'NEGADO_MEN':
      return <ErrorOutlineIcon sx={{ ...sx, color: '#dc2626' }} />;
    case 'CONTINGENCIA_EN_CURSO':
      return <PolicyIcon sx={{ ...sx, color: '#c2410c' }} />;
    case 'CONTINGENCIA_RADICADA':
      return <FactCheckIcon sx={{ ...sx, color: '#0284c7' }} />;
    case 'CULMINADO':
      return <CheckCircleIcon sx={{ ...sx, color: '#475569' }} />;
    case 'VENCIDO':
      return <HourglassEmptyIcon sx={{ ...sx, color: '#64748b' }} />;
    default:
      return <EventNoteIcon sx={{ ...sx, color: '#64748b' }} />;
  }
};

// Cálculo y lógica oficial de Semáforo según Decreto 1330 / MEN:
// - Vencido: Si la fecha límite de vigencia de RC ya expiró
// - Crítico (Radicación SACES): Menor o igual a 14 meses para el vencimiento de RC
// - Alerta (Elaborar Documento RRC): Entre 14 y 26 meses para el vencimiento de RC
// - Vigente: Más de 26 meses para el vencimiento de RC
const calculateSemaforoState = (row = {}) => {
  const vencimiento = parseDateSafe(row.fechaVencimientoRc);
  if (!vencimiento) {
    return {
      estado: 'INDEFINIDO',
      label: 'Sin fecha vencimiento',
      color: '#64748b',
      bg: '#f1f5f9',
      border: '#cbd5e1',
      badgeText: 'Sin Fecha',
      diffMonths: null,
      diffDays: null,
      sacesDiffDays: null,
      fechaDocRrcStr: formatDate(row.fechaMaximaDocumentoRrc),
      fechaSacesStr: formatDate(row.fechaSugeridaRadicarSaces || row.fechaMaximaRadicarSaces),
      tiempoRestanteStr: '-'
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diffTime = vencimiento.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const diffMonths = Math.round((diffDays / 365.25) * 12);

  // 26 meses hito: Inicio de elaboración Documento RRC
  let fechaDocRrc = parseDateSafe(row.fechaMaximaDocumentoRrc);
  if (!fechaDocRrc) {
    fechaDocRrc = new Date(vencimiento);
    fechaDocRrc.setMonth(fechaDocRrc.getMonth() - 26);
  }

  // 14 meses hito: Límite obligatorio radicación en SACES
  let fechaSaces = parseDateSafe(row.fechaSugeridaRadicarSaces);
  if (!fechaSaces) {
    fechaSaces = new Date(vencimiento);
    fechaSaces.setMonth(fechaSaces.getMonth() - 14);
  }

  const sacesDiffTime = fechaSaces.getTime() - today.getTime();
  const sacesDiffDays = Math.ceil(sacesDiffTime / (1000 * 60 * 60 * 24));

  let tiempoRestanteStr = '';
  if (diffDays < 0) {
    tiempoRestanteStr = `Vencido hace ${Math.abs(diffDays)} d`;
  } else if (diffDays < 30) {
    tiempoRestanteStr = `${diffDays} días`;
  } else {
    const m = Math.floor(diffDays / 30.43);
    const d = Math.round(diffDays % 30.43);
    tiempoRestanteStr = `${m} mes${m !== 1 ? 'es' : ''}${d > 0 ? ` ${d} d` : ''}`;
  }

  const duracionTotalDias = 7 * 365.25;
  const diasTranscurridos = Math.max(0, Math.min(duracionTotalDias, duracionTotalDias - diffDays));
  const progresoCicloPct = Math.min(100, Math.max(0, Math.round((diasTranscurridos / duracionTotalDias) * 100)));
  const aniosTranscurridos = (diasTranscurridos / 365.25).toFixed(1);
  const aniosRestantes = Math.max(0, 7 - Number(aniosTranscurridos)).toFixed(1);

  // Sobrescrituras por decisiones de flujo institucional / MEN y Plan de Contingencia (Decreto 1330):
  // 1. Renovación Aprobada por el MEN: ¡Reinicia el ciclo de 7 años! NUNCA requiere plan de contingencia.
  if (row.decisionTipo === 'RENOVADO_MEN' || row.estadoCiclo === 'RENOVADO') {
    return {
      estado: 'RENOVADO_MEN',
      label: 'Renovado por MEN (Nuevo Ciclo 7 Años)',
      color: '#15803d',
      bg: '#f0fdf4',
      border: '#86efac',
      badgeText: 'Renovado por MEN',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr: row.numeroResolucion ? `Res. ${row.numeroResolucion}` : 'Nuevo ciclo vigente',
      progresoCicloPct: progresoCicloPct || 8,
      aniosTranscurridos: aniosTranscurridos || '0.0',
      aniosRestantes: aniosRestantes || '7.0',
      isContingencia: false,
      contingenciaEstado: 'NO_APLICA',
      noRequiereContingencia: true
    };
  }

  // 2. Programa Culminado / Cerrado definitivamente
  if (row.estadoCiclo === 'CULMINADO' || row.estadoContingencia === 'FINALIZADO') {
    return {
      estado: 'CULMINADO',
      label: 'Programa Culminado / Cerrado',
      color: '#475569',
      bg: '#f1f5f9',
      border: '#cbd5e1',
      badgeText: 'Programa Culminado',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr: 'Cohortes culminadas',
      progresoCicloPct: 100,
      aniosTranscurridos: '7.0',
      aniosRestantes: '0.0',
      isContingencia: true,
      contingenciaEstado: 'FINALIZADO'
    };
  }

  // 3. Plan de Contingencia en Ejecución (Cohortes activas cursando asignaturas)
  if (row.estadoCiclo === 'CONTINGENCIA_EN_CURSO' || row.estadoContingencia === 'EN_EJECUCION') {
    return {
      estado: 'CONTINGENCIA_EN_CURSO',
      label: 'Plan de Contingencia en Ejecución',
      color: '#c2410c',
      bg: '#fff7ed',
      border: '#fed7aa',
      badgeText: 'Contingencia en Ejecución',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr: row.fechaFinContingencia ? `Cohortes hasta ${formatDate(row.fechaFinContingencia)}` : 'Cohortes garantizadas',
      progresoCicloPct,
      aniosTranscurridos,
      aniosRestantes,
      isContingencia: true,
      contingenciaEstado: 'EN_EJECUCION'
    };
  }

  // 4. Plan de Contingencia Radicado ante el MEN (en evaluación / aprobación ministerial)
  if (row.estadoContingencia === 'RADICADO') {
    return {
      estado: 'CONTINGENCIA_RADICADA',
      label: 'Plan Contingencia Radicado ante MEN',
      color: '#0284c7',
      bg: '#f0f9ff',
      border: '#7dd3fc',
      badgeText: 'Contingencia Radicada',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr: row.fechaRadicacionContingencia ? `Radicado el ${formatDate(row.fechaRadicacionContingencia)}` : 'Radicado ante MEN',
      progresoCicloPct,
      aniosTranscurridos,
      aniosRestantes,
      isContingencia: true,
      contingenciaEstado: 'RADICADO'
    };
  }

  // 5. Decisión de No Renovar o Registro Negado por MEN:
  // De acuerdo al Decreto 1330, plazo legal IMPRORROGABLE de 2 meses desde el acto administrativo para radicar Plan de Contingencia.
  if (
    row.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' ||
    row.decisionTipo === 'NEGADO_MEN' ||
    row.estadoCiclo === 'NO_RENOVACION' ||
    row.estadoCiclo === 'NEGADO_MEN' ||
    row.estadoContingencia === 'PENDIENTE_RADICAR'
  ) {
    const isNegado = row.decisionTipo === 'NEGADO_MEN' || row.estadoCiclo === 'NEGADO_MEN';

    // Cálculo del plazo de 2 meses
    let fechaLimiteDate = parseDateSafe(row.fechaLimiteRadicarContingencia);
    if (!fechaLimiteDate && row.fechaActoAdministrativo) {
      const d = parseDateSafe(row.fechaActoAdministrativo);
      if (d) {
        d.setMonth(d.getMonth() + 2);
        fechaLimiteDate = d;
      }
    }

    let diasRestantesContingencia = null;
    let contingenciaTiempoStr = 'Pendiente radicar plan ante MEN (2 meses)';
    if (fechaLimiteDate) {
      const diffC = fechaLimiteDate.getTime() - today.getTime();
      diasRestantesContingencia = Math.ceil(diffC / (1000 * 60 * 60 * 24));
      if (diasRestantesContingencia > 0) {
        contingenciaTiempoStr = `Quedan ${diasRestantesContingencia} días para radicar ante MEN (plazo 2m)`;
      } else if (diasRestantesContingencia === 0) {
        contingenciaTiempoStr = `Vence HOY plazo para radicar plan ante MEN (2m)`;
      } else {
        contingenciaTiempoStr = `Plazo 2m vencido hace ${Math.abs(diasRestantesContingencia)} días`;
      }
    }

    return {
      estado: isNegado ? 'NEGADO_MEN' : 'NO_RENOVACION',
      label: isNegado ? 'Registro Negado MEN (Radicar Plan en 2m)' : 'Decisión No Renovar (Radicar Plan en 2m)',
      color: '#dc2626',
      bg: '#fef2f2',
      border: '#fca5a5',
      badgeText: isNegado ? 'Negado por MEN' : 'Decisión No Renovar',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr: contingenciaTiempoStr,
      diasRestantesContingencia,
      progresoCicloPct,
      aniosTranscurridos,
      aniosRestantes,
      isContingencia: true,
      contingenciaEstado: 'PENDIENTE_RADICAR'
    };
  }

  // 6. Monitoreo regular del ciclo de 7 años:
  if (diffDays < 0) {
    return {
      estado: 'VENCIDO',
      label: 'RC Vencido',
      color: '#334155',
      bg: '#f1f5f9',
      border: '#cbd5e1',
      badgeText: 'RC Vencido',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr,
      progresoCicloPct: 100,
      aniosTranscurridos: '7.0',
      aniosRestantes: '0.0',
      isContingencia: false,
      contingenciaEstado: 'NO_APLICA'
    };
  }

  if (diffMonths <= 14) {
    return {
      estado: 'CRITICO',
      label: 'Radicación SACES (≤ 14m)',
      color: '#b91c1c',
      bg: '#fee2e2',
      border: '#fca5a5',
      badgeText: 'Radicación SACES (≤ 14m)',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr,
      progresoCicloPct,
      aniosTranscurridos,
      aniosRestantes,
      isContingencia: false,
      contingenciaEstado: 'NO_APLICA'
    };
  }

  if (diffMonths <= 26) {
    return {
      estado: 'ALERTA',
      label: 'Elaborar Doc. RRC (≤ 26m)',
      color: '#b45309',
      bg: '#fef3c7',
      border: '#fcd34d',
      badgeText: 'Elaborar Doc. RRC (≤ 26m)',
      diffMonths,
      diffDays,
      sacesDiffDays,
      fechaDocRrcStr: formatShortDate(fechaDocRrc),
      fechaSacesStr: formatShortDate(fechaSaces),
      tiempoRestanteStr,
      progresoCicloPct,
      aniosTranscurridos,
      aniosRestantes,
      isContingencia: false,
      contingenciaEstado: 'NO_APLICA'
    };
  }

  return {
    estado: 'VIGENTE',
    label: 'Vigente en Tiempo (> 26m)',
    color: '#15803d',
    bg: '#dcfce7',
    border: '#86efac',
    badgeText: 'Vigente (> 26m)',
    diffMonths,
    diffDays,
    sacesDiffDays,
    fechaDocRrcStr: formatShortDate(fechaDocRrc),
    fechaSacesStr: formatShortDate(fechaSaces),
    tiempoRestanteStr,
    progresoCicloPct,
    aniosTranscurridos,
    aniosRestantes,
    isContingencia: false,
    contingenciaEstado: 'NO_APLICA'
  };
};

// Clasificador de nivel de formación
const classifyLevelKey = (nivel = '', programa = '') => {
  const normNivel = String(nivel || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

  if (normNivel.includes('TECNOL') || normNivel.startsWith('TEC')) return 'TECNOLOGICO';
  if (normNivel.includes('PROFESION') || normNivel === 'UNIVERSITARIO' || normNivel === 'PREGRADO') return 'PROFESIONAL';
  if (normNivel.includes('ESPEC')) return 'ESPECIALIZACION';
  if (normNivel.includes('MAESTR') || normNivel.includes('MASTER')) return 'MAESTRIA';
  if (normNivel.includes('DOC') || normNivel.includes('DOCTOR')) return 'DOCTORADO';

  const normProg = String(programa || '')
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
  if (/\bTECNOL/.test(normProg) || /^TEC\b/.test(normProg)) return 'TECNOLOGICO';
  if (/\b(DOC|DOCTOR|DOCTORADO)\b/.test(normProg)) return 'DOCTORADO';
  if (/\b(MAE|MAESTR|MASTER)\b/.test(normProg) || normProg.startsWith('MAES')) return 'MAESTRIA';
  if (/\b(SP|ESPEC)\b/.test(normProg) || normProg.startsWith('ESPE')) return 'ESPECIALIZACION';

  return 'PROFESIONAL';
};

const NIVEL_META = {
  TECNOLOGICO: { label: 'Tecnológico', color: '#b45309', bg: '#fef3c7' },
  PROFESIONAL: { label: 'Profesional', color: '#1d4ed8', bg: '#eff6ff' },
  ESPECIALIZACION: { label: 'Especialización', color: '#0f766e', bg: '#f0fdf4' },
  MAESTRIA: { label: 'Maestría', color: '#7c3aed', bg: '#f5f3ff' },
  DOCTORADO: { label: 'Doctorado', color: '#9f1239', bg: '#fff1f2' }
};

const NIVEL_ORDER = ['TECNOLOGICO', 'PROFESIONAL', 'ESPECIALIZACION', 'MAESTRIA', 'DOCTORADO'];

const FACULTY_ORDER = [
  'Ciencias Administrativas y Contables',
  'Ciencias Sociales y Humanas',
  'Educación',
  'Ingeniería',
  'Ciencias de la Salud',
  'Arquitectura y Bellas Artes',
  'Otras'
];

const classifyProgramFaculty = (programa = '') => {
  const u = String(programa || '').toUpperCase();
  if (u.includes('INGENIER') || u.includes('BIG DATA') || u.includes('SEGURIDAD INFORM') ||
      u.includes('ELECTRONI') || u.includes('SISTEMAS') || u.includes('FINANCIER') ||
      u.includes('INDUSTRIAL') || u.includes('MECATRON') || u.includes('CIVIL'))
    return 'Ingeniería';
  if (u.includes('ARQUITECTURA') || u.includes('DISEÑO') || u.includes('DISENO') ||
      u.includes('GRAFICO') || u.includes('GRÁFICO') || u.includes('URBANISMO') ||
      u.includes('BELLAS ARTES') || u.includes('ARTES PLASTICAS') || u.includes('PLASTICAS'))
    return 'Arquitectura y Bellas Artes';
  if (u.includes('LICENCIATURA') || u.includes('PREESCOLAR') || u.includes('INFANCIA') ||
      u.includes('ENTRENAMIENTO') || u.includes('PEDAGOGIA') || u.includes('PEDAGOGÍA') ||
      u.includes('DEPORTIVO') || (u.includes('EDUCACI') && !u.includes('EDUCACION FISICA Y DEPORTE')))
    return 'Educación';
  if (u.includes('FISIOTERAPIA') || u.includes('FISIOTERAPEUTA') || u.includes('PSICOLOG') || u.includes('CIENCIAS DE LA SALUD') ||
      (u.includes('SALUD') && !u.includes('SEGURIDAD Y SALUD') && !u.includes('SALUD EN EL TRABAJO')) ||
      u.includes('ENFERMER') || u.includes('MEDICIN') || u.includes('NUTRICI') ||
      u.includes('ODONTOLOG') || u.includes('FONOAUDIOLOG') || u.includes('TERAPIA'))
    return 'Ciencias de la Salud';
  if (u.includes('DERECHO') || u.includes('COMUNICACI') ||
      u.includes('TRABAJO SOCIAL') || u.includes('SOCIOLOG') || u.includes('FILOSOF'))
    return 'Ciencias Sociales y Humanas';
  if (u.includes('ADMINISTRACION') || u.includes('ADMINISTRACIÓN') || u.includes('CONTADURIA') ||
      u.includes('CONTADURÍA') || u.includes('GERENCIA') || u.includes('MARKETING') ||
      u.includes('NEGOCIOS') || u.includes('EMPRESARIAL') || u.includes('ECONOMIA') ||
      u.includes('FINANZAS') || u.includes('SALUD EN EL TRABAJO') ||
      u.includes('SEGURIDAD Y SALUD') || u.includes('AUDITORIA'))
    return 'Ciencias Administrativas y Contables';
  return 'Otras';
};

function RegistrosCalificadosAcreditacion() {
  const { enqueueSnackbar } = useSnackbar();

  // 3 Componentes Principales
  // 1. estadisticas -> Estadística de Programas
  // 2. documentacion -> Documentación de Programas (Histórico RC y Evidencias Drive)
  // 3. monitoreo -> Monitoreo de Programas (Resoluciones y Vencimientos RC: 17 columnas, alertas SACES)
  const [activeTab, setActiveTab] = useState('estadisticas');

  // Estados para Resoluciones y Vencimientos (Monitoreo de Programas)
  const [resolucionesData, setResolucionesData] = useState(null);
  const [resolucionesLoading, setResolucionesLoading] = useState(false);
  const [resolFilters, setResolFilters] = useState({ programa: '', nivel: '', busqueda: '' });
  const [detailModal, setDetailModal] = useState({ open: false, title: '', content: '' });

  // Estados para Monitoreo Ejecutivo, Semáforo y Ciclo de Vida
  const [procesoTipo, setProcesoTipo] = useState('PROGRAMAS'); // 'PROGRAMAS' | 'INSTITUCIONAL'
  const [monitorViewMode, setMonitorViewMode] = useState('tarjetas'); // 'tarjetas' | 'semaforo' | 'matriz'
  const [semaforoFilter, setSemaforoFilter] = useState('TODOS'); // 'TODOS' | 'CRITICO' | 'ALERTA' | 'VIGENTE' | 'NO_RENOVACION' | 'CONTINGENCIA_EN_CURSO' | 'VENCIDO'
  const [notifyDialog, setNotifyDialog] = useState({
    open: false,
    loading: false,
    destinatarios: 'planeacion@unicesmag.edu.co',
    asunto: '[ALERTA SGC] Monitoreo de Registros Calificados - Ciclo de Renovación y Vencimientos',
    observaciones: '',
    selectedItems: []
  });

  // Expediente Integral y Gestión del Ciclo de Vida del Programa
  const [expedienteModal, setExpedienteModal] = useState({
    open: false,
    loading: false,
    item: null,
    decisionTipo: 'EN_CICLO', // 'EN_CICLO' | 'NO_RENOVAR_INSTITUCIONAL' | 'NEGADO_MEN' | 'RENOVADO_MEN'
    actoAdministrativoNoRenovacion: '',
    fechaActoAdministrativo: '',
    fechaLimiteRadicarContingencia: '',
    fechaRadicacionContingencia: '',
    estadoContingencia: 'NO_APLICA', // 'NO_APLICA' | 'PENDIENTE_RADICAR' | 'RADICADO' | 'EN_EJECUCION' | 'FINALIZADO'
    fechaInicioContingencia: '',
    fechaFinContingencia: '',
    contingenciaObservaciones: '',
    resolucionRenovacionNueva: '',
    fechaRenovacionNueva: '',
    reiniciarCicloSieteAnos: true,
    conservaDenominacion: true,
    nuevaDenominacion: ''
  });

  // Estado para el acordeón de distribución por nivel
  const [nivelExpandedKey, setNivelExpandedKey] = useState(null);

  // Estados para Documentación de Programas (Histórico RC y Evidencias Drive)
  const [historicoData, setHistoricoData] = useState(null);
  const [historicoLoading, setHistoricoLoading] = useState(false);
  const [historicoFilters, setHistoricoFilters] = useState({ programa: '', estado: 'activos' });
  const [evidence, setEvidence] = useState({ open: false, loading: false, row: null, expected: [], files: [] });
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [preview, setPreview] = useState({ open: false, file: null });

  // Carga de Resoluciones y Vencimientos
  const fetchResoluciones = useCallback(async () => {
    setResolucionesLoading(true);
    try {
      const response = await gestionInformacionService.getRegistrosCalificadosResolucionesDashboard({
        programa: resolFilters.programa || '',
        nivel: resolFilters.nivel || '',
        _ts: Date.now()
      });
      setResolucionesData(response.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar Resoluciones de Registros Calificados', { variant: 'error' });
    } finally {
      setResolucionesLoading(false);
    }
  }, [enqueueSnackbar, resolFilters.programa, resolFilters.nivel]);

  // Carga de Histórico RC (Documentación)
  const fetchHistorico = useCallback(async () => {
    setHistoricoLoading(true);
    try {
      const response = await gestionInformacionService.getRegistrosCalificadosDashboard({
        programa: historicoFilters.programa || '',
        estado: historicoFilters.estado || 'activos',
        _ts: Date.now()
      });
      setHistoricoData(response.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar Histórico de Registros Calificados', { variant: 'error' });
    } finally {
      setHistoricoLoading(false);
    }
  }, [enqueueSnackbar, historicoFilters]);

  useEffect(() => {
    fetchResoluciones();
  }, [fetchResoluciones]);

  useEffect(() => {
    if (activeTab === 'documentacion') {
      fetchHistorico();
    }
  }, [activeTab, fetchHistorico]);

  const openEvidence = async (row) => {
    setEvidenceSearch('');
    setEvidence({ open: true, loading: true, row, expected: [], files: [] });
    try {
      const response = await gestionInformacionService.getRegistrosCalificadosEvidencias(row.id);
      const expected = response?.data?.expected || [];
      const files = response?.data?.files || [];
      setEvidence({
        open: true,
        loading: false,
        row,
        expected,
        files
      });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se pudieron consultar las evidencias de Drive', { variant: 'error' });
      setEvidence((prev) => ({ ...prev, loading: false }));
    }
  };

  const historicoRegistros = historicoData?.registros || [];
  const historicoProgramas = historicoData?.programasDisponibles || [];
  const evidenceRows = (evidence.expected || []).map((name) => {
    const fileMatch = (evidence.files || []).find((item) => normalizeDriveName(item.name) === normalizeDriveName(name));
    return {
      expectedName: name,
      file: fileMatch,
      name: fileMatch?.name || name,
      type: fileMatch?.mimeType?.includes('pdf') ? 'PDF'
        : fileMatch?.mimeType?.includes('spreadsheet') || /\.xlsx?$/i.test(fileMatch?.name || '') ? 'Hoja de calculo'
          : fileMatch?.mimeType?.includes('document') || /\.docx?$/i.test(fileMatch?.name || '') ? 'Documento'
            : fileMatch?.isFolder ? 'Carpeta'
              : 'Archivo',
      modifiedTime: fileMatch?.modifiedTime || ''
    };
  }).filter((row) => {
    const q = evidenceSearch.trim().toLowerCase();
    if (!q) return true;
    return `${row.expectedName} ${row.name} ${row.type}`.toLowerCase().includes(q);
  });

  // Registros de Resoluciones filtrados por texto (Monitoreo)
  const resolucionesRegistros = useMemo(() => {
    const list = resolucionesData?.registros || [];
    const q = (resolFilters.busqueda || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) =>
      `${r.nombrePrograma || ''} ${r.codigoSnies || ''} ${r.numeroResolucion || ''} ${r.novedadesVigencia || ''} ${r.observaciones || ''}`
        .toLowerCase()
        .includes(q)
    );
  }, [resolucionesData, resolFilters.busqueda]);

  const resolucionesNiveles = resolucionesData?.nivelesDisponibles || [];

  // Enriquecer registros con estado semafórico calculado dinámicamente
  const monitoreoItems = useMemo(() => {
    return resolucionesRegistros.map((row) => {
      const semaforo = calculateSemaforoState(row);
      return {
        ...row,
        semaforo
      };
    });
  }, [resolucionesRegistros]);

  // Segmentación estricta según Decreto 1330 / MEN:
  // 1. academicProgramItems: 27 programas académicos individuales
  // 2. institutionalItems: Único proceso transversal de Condiciones Institucionales (SNIES 2744)
  const academicProgramItems = useMemo(() => {
    return monitoreoItems.filter((row) => !isInstitutionalRecord(row));
  }, [monitoreoItems]);

  const institutionalItems = useMemo(() => {
    return monitoreoItems.filter((row) => isInstitutionalRecord(row));
  }, [monitoreoItems]);

  const activeSegmentItems = useMemo(() => {
    return procesoTipo === 'INSTITUCIONAL' ? institutionalItems : academicProgramItems;
  }, [procesoTipo, institutionalItems, academicProgramItems]);

  const activeProgramasOptions = useMemo(() => {
    if (procesoTipo === 'INSTITUCIONAL') {
      return institutionalItems.map((r) => r.nombrePrograma);
    }
    return academicProgramItems.map((r) => r.nombrePrograma);
  }, [procesoTipo, institutionalItems, academicProgramItems]);

  // Contadores de Semáforo para KPIs y filtros adaptados al segmento activo
  const semaforoCounts = useMemo(() => {
    let critico = 0;
    let alerta = 0;
    let vigente = 0;
    let vencido = 0;
    let contingencia = 0;
    let contingenciaPendiente = 0;
    let renovadoMen = 0;
    let culminado = 0;

    activeSegmentItems.forEach((item) => {
      const st = item.semaforo.estado;
      if (item.semaforo.isContingencia) {
        if (st === 'CULMINADO') {
          culminado += 1;
        } else {
          contingencia += 1;
          if (st === 'NO_RENOVACION' || st === 'NEGADO_MEN' || item.semaforo.contingenciaEstado === 'PENDIENTE_RADICAR') {
            contingenciaPendiente += 1;
          }
        }
      } else if (st === 'CRITICO') {
        critico += 1;
      } else if (st === 'ALERTA') {
        alerta += 1;
      } else if (st === 'VIGENTE') {
        vigente += 1;
      } else if (st === 'RENOVADO_MEN') {
        renovadoMen += 1;
      } else if (st === 'VENCIDO') {
        vencido += 1;
      }
    });

    return {
      critico,
      alerta,
      vigente: vigente + renovadoMen,
      vencido,
      contingencia,
      contingenciaPendiente,
      renovadoMen,
      culminado,
      total: activeSegmentItems.length
    };
  }, [activeSegmentItems]);

  // Abrir expediente y gestión de ciclo de vida del programa
  const handleOpenExpediente = (item) => {
    let fechaLimite = item.fechaLimiteRadicarContingencia || '';
    if (!fechaLimite && item.fechaActoAdministrativo) {
      const d = parseDateSafe(item.fechaActoAdministrativo);
      if (d) {
        d.setMonth(d.getMonth() + 2);
        fechaLimite = d.toISOString().slice(0, 10);
      }
    }

    setExpedienteModal({
      open: true,
      loading: false,
      item,
      decisionTipo: item.decisionTipo || 'EN_CICLO',
      actoAdministrativoNoRenovacion: item.actoAdministrativoNoRenovacion || '',
      fechaActoAdministrativo: item.fechaActoAdministrativo || '',
      fechaLimiteRadicarContingencia: fechaLimite,
      fechaRadicacionContingencia: item.fechaRadicacionContingencia || '',
      estadoContingencia: item.estadoContingencia || (item.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' || item.decisionTipo === 'NEGADO_MEN' ? 'PENDIENTE_RADICAR' : 'NO_APLICA'),
      fechaInicioContingencia: item.fechaInicioContingencia || '',
      fechaFinContingencia: item.fechaFinContingencia || '',
      contingenciaObservaciones: item.contingenciaObservaciones || '',
      resolucionRenovacionNueva: item.resolucionRenovacionNueva || '',
      fechaRenovacionNueva: item.fechaRenovacionNueva || '',
      reiniciarCicloSieteAnos: true,
      conservaDenominacion: item.conservaDenominacion !== false,
      nuevaDenominacion: ''
    });
  };

  const handleFechaActoChange = (newDateStr) => {
    let lim = '';
    if (newDateStr) {
      const parts = newDateStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10) - 1;
        const d = parseInt(parts[2], 10);
        const dt = new Date(y, m + 2, d);
        lim = dt.toISOString().slice(0, 10);
      }
    }
    setExpedienteModal((prev) => ({
      ...prev,
      fechaActoAdministrativo: newDateStr,
      fechaLimiteRadicarContingencia: lim || prev.fechaLimiteRadicarContingencia
    }));
  };

  const handleSaveExpediente = async () => {
    if (!expedienteModal.item) return;

    if (
      expedienteModal.decisionTipo === 'RENOVADO_MEN' &&
      !expedienteModal.conservaDenominacion &&
      !expedienteModal.nuevaDenominacion?.trim()
    ) {
      enqueueSnackbar('Debe ingresar la nueva denominación académica oficial otorgada por el MEN.', { variant: 'warning' });
      return;
    }

    setExpedienteModal((prev) => ({ ...prev, loading: true }));
    try {
      const payload = {
        decisionTipo: expedienteModal.decisionTipo,
        actoAdministrativoNoRenovacion: expedienteModal.actoAdministrativoNoRenovacion,
        fechaActoAdministrativo: expedienteModal.fechaActoAdministrativo,
        fechaLimiteRadicarContingencia: expedienteModal.fechaLimiteRadicarContingencia,
        fechaRadicacionContingencia: expedienteModal.fechaRadicacionContingencia,
        estadoContingencia: expedienteModal.estadoContingencia,
        fechaInicioContingencia: expedienteModal.fechaInicioContingencia,
        fechaFinContingencia: expedienteModal.fechaFinContingencia,
        contingenciaObservaciones: expedienteModal.contingenciaObservaciones,
        resolucionRenovacionNueva: expedienteModal.resolucionRenovacionNueva,
        fechaRenovacionNueva: expedienteModal.fechaRenovacionNueva,
        reiniciarCicloSieteAnos: expedienteModal.reiniciarCicloSieteAnos,
        conservaDenominacion: expedienteModal.conservaDenominacion,
        nuevaDenominacion: expedienteModal.nuevaDenominacion
      };

      const response = await gestionInformacionService.updateCicloProgramaResolucion(expedienteModal.item.id, payload);
      enqueueSnackbar(response?.message || 'Ciclo de vida y expediente actualizados exitosamente', { variant: 'success' });
      setExpedienteModal((prev) => ({ ...prev, open: false, loading: false }));
      fetchResoluciones();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al actualizar el expediente del programa', { variant: 'error' });
      setExpedienteModal((prev) => ({ ...prev, loading: false }));
    }
  };

  // Registros filtrados por semáforo, contingencia y filtros de búsqueda dentro del segmento activo
  const filteredMonitoreoItems = useMemo(() => {
    return activeSegmentItems.filter((item) => {
      // 1. Filtro de estado semafórico / contingencia
      if (semaforoFilter !== 'TODOS') {
        if (semaforoFilter === 'EN_CONTINGENCIA') {
          if (!item.semaforo.isContingencia || item.semaforo.estado === 'CULMINADO') return false;
        } else if (semaforoFilter === 'VIGENTE') {
          if (item.semaforo.estado !== 'VIGENTE' && item.semaforo.estado !== 'RENOVADO_MEN') return false;
        } else if (item.semaforo.estado !== semaforoFilter) {
          return false;
        }
      }

      // 2. Filtro por programa
      if (resolFilters.programa) {
        if (String(item.nombrePrograma || '').trim().toUpperCase() !== String(resolFilters.programa).trim().toUpperCase()) {
          return false;
        }
      }

      // 3. Filtro por nivel
      if (resolFilters.nivel) {
        if (String(item.nivelFormacion || '').trim().toUpperCase() !== String(resolFilters.nivel).trim().toUpperCase()) {
          return false;
        }
      }

      // 4. Búsqueda por texto (programa, SNIES, resolución, acto administrativo)
      if (resolFilters.busqueda && resolFilters.busqueda.trim()) {
        const query = resolFilters.busqueda.trim().toLowerCase();
        const prog = String(item.nombrePrograma || '').toLowerCase();
        const snies = String(item.codigoSnies || '').toLowerCase();
        const res = String(item.numeroResolucion || '').toLowerCase();
        const acto = String(item.actoAdministrativoNoRenovacion || '').toLowerCase();
        if (!prog.includes(query) && !snies.includes(query) && !res.includes(query) && !acto.includes(query)) {
          return false;
        }
      }

      return true;
    });
  }, [activeSegmentItems, semaforoFilter, resolFilters]);

  // Abrir diálogo de notificación
  const handleOpenNotification = (specificItem = null) => {
    let targets = [];
    if (specificItem) {
      targets = [specificItem];
    } else {
      // Priorizar los que requieren acción inmediata: CRITICO (Radicación SACES) y ALERTA (Elaborar RRC)
      targets = activeSegmentItems.filter((i) => i.semaforo.estado === 'CRITICO' || i.semaforo.estado === 'ALERTA');
      if (targets.length === 0) targets = activeSegmentItems;
    }

    setNotifyDialog({
      open: true,
      loading: false,
      destinatarios: 'planeacion@unicesmag.edu.co',
      asunto: `[ALERTA SGC] Monitoreo Registros Calificados - ${targets.length} programas en ciclo de renovación`,
      observaciones: '',
      selectedItems: targets
    });
  };

  // Enviar correo de notificación institucional
  const handleSendNotification = async () => {
    if (!notifyDialog.destinatarios || !notifyDialog.destinatarios.trim()) {
      enqueueSnackbar('Por favor especifica al menos un correo de notificación.', { variant: 'warning' });
      return;
    }
    setNotifyDialog((prev) => ({ ...prev, loading: true }));
    try {
      const payload = {
        destinatarios: notifyDialog.destinatarios,
        asunto: notifyDialog.asunto,
        observaciones: notifyDialog.observaciones,
        directorNombre: 'Director de Planeación y Aseguramiento de la Calidad',
        programas: notifyDialog.selectedItems.map((item) => ({
          nombrePrograma: item.nombrePrograma,
          codigoSnies: item.codigoSnies,
          nivelFormacion: item.nivelFormacion,
          fechaVencimientoRc: item.fechaVencimientoRc,
          fechaMaximaRadicarSaces: item.semaforo.fechaSacesStr,
          estadoSemaforo: item.semaforo.estado,
          tiempoRestante: item.semaforo.tiempoRestanteStr
        }))
      };

      const response = await gestionInformacionService.notificarMonitoreoRegistrosCalificados(payload);
      enqueueSnackbar(response?.message || 'Notificación enviada exitosamente', { variant: 'success' });
      setNotifyDialog((prev) => ({ ...prev, open: false, loading: false }));
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al enviar la notificación institucional', { variant: 'error' });
      setNotifyDialog((prev) => ({ ...prev, loading: false }));
    }
  };

  // ==========================================
  // CÁLCULOS ESTADÍSTICOS CON DATA DE RESOLUCIONES
  // ==========================================
  const statistics = useMemo(() => {
    const rows = resolucionesData?.registros || [];

    // Mapeo por nivel
    const levelMap = {};
    rows.forEach((r) => {
      const levelKey = classifyLevelKey(r.nivelFormacion, r.nombrePrograma);
      if (!levelMap[levelKey]) levelMap[levelKey] = [];
      levelMap[levelKey].push(r);
    });

    // Niveles filas
    const nivelesRows = NIVEL_ORDER.map((key) => {
      const progs = levelMap[key] || [];
      return {
        nivel: key,
        total: progs.length,
        programas: progs,
        ...(NIVEL_META[key] || { label: key, color: '#64748b', bg: '#f8fafc' })
      };
    }).filter((item) => item.total > 0);

    const totalGeneral = rows.length;

    // Regla de Negocio solicitada:
    // "todos los programas tecnologicos y profesionales son considerados pregrado y los demas posgrados"
    const pregradoRows = rows.filter((r) => {
      const key = classifyLevelKey(r.nivelFormacion, r.nombrePrograma);
      return key === 'TECNOLOGICO' || key === 'PROFESIONAL';
    });

    const posgradoRows = rows.filter((r) => {
      const key = classifyLevelKey(r.nivelFormacion, r.nombrePrograma);
      return key !== 'TECNOLOGICO' && key !== 'PROFESIONAL';
    });

    const totalPregrado = pregradoRows.length;
    const totalPosgrado = posgradoRows.length;

    const pregradoPct = totalGeneral > 0 ? ((totalPregrado / totalGeneral) * 100).toFixed(1) : '0.0';
    const posgradoPct = totalGeneral > 0 ? ((totalPosgrado / totalGeneral) * 100).toFixed(1) : '0.0';

    // Subniveles de pregrado
    const tecnologicosCount = (levelMap['TECNOLOGICO'] || []).length;
    const profesionalesCount = (levelMap['PROFESIONAL'] || []).length;

    // Subniveles de posgrado
    const especializacionesCount = (levelMap['ESPECIALIZACION'] || []).length;
    const maestriasCount = (levelMap['MAESTRIA'] || []).length;
    const doctoradosCount = (levelMap['DOCTORADO'] || []).length;

    // Cupos de estudiantes
    const pregradoCupos = pregradoRows.reduce((acc, r) => acc + (Number(r.numeroEstudiantes) || 0), 0);
    const posgradoCupos = posgradoRows.reduce((acc, r) => acc + (Number(r.numeroEstudiantes) || 0), 0);
    const totalCupos = pregradoCupos + posgradoCupos;

    return {
      totalGeneral,
      nivelesRows,
      totalPregrado,
      totalPosgrado,
      pregradoPct,
      posgradoPct,
      tecnologicosCount,
      profesionalesCount,
      especializacionesCount,
      maestriasCount,
      doctoradosCount,
      pregradoCupos,
      posgradoCupos,
      totalCupos
    };
  }, [resolucionesData]);

  const renderSacesBadge = (val) => {
    if (val === null || val === undefined || val === '') return '-';
    const num = Number(String(val).trim());
    if (Number.isFinite(num)) {
      if (num < 0) {
        return <Chip label={`${num} días`} size="small" sx={{ bgcolor: '#fee2e2', color: '#b91c1c', fontWeight: 900, fontSize: 11 }} />;
      }
      if (num <= 180) {
        return <Chip label={`${num} días`} size="small" sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 900, fontSize: 11 }} />;
      }
      return <Chip label={`${num} días`} size="small" sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 900, fontSize: 11 }} />;
    }
    return formatDate(val);
  };

  return (
    <Stack spacing={2.5}>
      {/* 3 COMPONENTES PRINCIPALES (BARRA A TODA LA PANTALLA) */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid #dbe6f5',
          bgcolor: '#fff',
          p: 0.8,
          width: '100%',
          boxShadow: '0 2px 10px rgba(15, 23, 42, 0.04)'
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(_, val) => setActiveTab(val)}
          variant="fullWidth"
          TabIndicatorProps={{ style: { display: 'none' } }}
          sx={{
            minHeight: 52,
            width: '100%',
            '& .MuiTabs-flexContainer': {
              width: '100%',
              gap: 1
            },
            '& .MuiTab-root': {
              flex: 1,
              maxWidth: 'none',
              minHeight: 50,
              fontWeight: 850,
              fontSize: { xs: 12.5, sm: 13.5, md: 14.5 },
              textTransform: 'none',
              borderRadius: 2.2,
              px: { xs: 1, sm: 2.5 },
              color: '#475569',
              transition: 'all 0.25s ease',
              border: '1px solid transparent',
              '&:hover': {
                bgcolor: '#f1f5f9',
                color: '#1e293b'
              }
            },
            '& .Mui-selected': {
              bgcolor: '#1e3a8a !important',
              color: '#fff !important',
              fontWeight: 900,
              border: '1px solid #1e3a8a',
              boxShadow: '0 4px 14px rgba(30, 58, 138, 0.28)'
            }
          }}
        >
          <Tab
            value="estadisticas"
            icon={<BarChartIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Estadística de Programas"
          />
          <Tab
            value="documentacion"
            icon={<MenuBookIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Documentación de Programas"
          />
          <Tab
            value="monitoreo"
            icon={<AssessmentIcon sx={{ fontSize: 20 }} />}
            iconPosition="start"
            label="Monitoreo de Programas"
          />
        </Tabs>
      </Paper>

      {/* ========================================================================= */}
      {/* COMPONENTE 1: ESTADÍSTICA DE PROGRAMAS                                   */}
      {/* ========================================================================= */}
      {activeTab === 'estadisticas' && (
        <Stack spacing={2.5}>
          {/* 1. SECCIÓN DE TARJETAS AVANZADAS: PREGRADO VS POSGRADO */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
            {/* TARJETA PREGRADO */}
            <Card
              sx={{
                borderRadius: 3,
                border: '1.5px solid #bfdbfe',
                background: 'linear-gradient(135deg, #ffffff 0%, #eff6ff 100%)',
                boxShadow: '0 4px 20px rgba(29, 78, 216, 0.08)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: '#1d4ed8' }} />
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                      <Box sx={{ p: 1.1, borderRadius: 2, bgcolor: '#1d4ed8', color: '#fff', display: 'grid', placeItems: 'center' }}>
                        <SchoolIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          Pregrado
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
                          Tecnológicos + Profesionales
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      label={`${statistics.pregradoPct}%`}
                      sx={{ bgcolor: '#1d4ed8', color: '#fff', fontWeight: 900, fontSize: 13, height: 28, px: 0.8 }}
                    />
                  </Stack>

                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                    <Typography sx={{ fontSize: 38, fontWeight: 950, color: '#0f172a', lineHeight: 1 }}>
                      {statistics.totalPregrado}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
                      programas con resolución
                    </Typography>
                  </Box>

                  {/* Barra de progreso visual */}
                  <Box sx={{ width: '100%' }}>
                    <LinearProgress
                      variant="determinate"
                      value={Number(statistics.pregradoPct) || 0}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#dbeafe',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: '#1d4ed8'
                        }
                      }}
                    />
                  </Box>

                  <Divider sx={{ my: 0.5, borderColor: '#dbeafe' }} />

                  {/* Subtotales Tecnológico y Profesional */}
                  <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#b45309' }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        Tecnológicos: <strong>{statistics.tecnologicosCount}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#1d4ed8' }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        Profesionales: <strong>{statistics.profesionalesCount}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#dbeafe', px: 1, py: 0.3, borderRadius: 1.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#1e40af' }}>
                        {formatNumber(statistics.pregradoCupos)} cupos
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            {/* TARJETA POSGRADO */}
            <Card
              sx={{
                borderRadius: 3,
                border: '1.5px solid #e9d5ff',
                background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)',
                boxShadow: '0 4px 20px rgba(124, 58, 237, 0.08)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4, bgcolor: '#7c3aed' }} />
              <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
                <Stack spacing={1.5}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Stack direction="row" alignItems="center" spacing={1.2}>
                      <Box sx={{ p: 1.1, borderRadius: 2, bgcolor: '#7c3aed', color: '#fff', display: 'grid', placeItems: 'center' }}>
                        <AutoGraphIcon sx={{ fontSize: 22 }} />
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 13, fontWeight: 900, color: '#7c3aed', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                          Posgrado
                        </Typography>
                        <Typography sx={{ fontSize: 11.5, color: '#64748b' }}>
                          Especializaciones + Maestrías + Doctorados
                        </Typography>
                      </Box>
                    </Stack>
                    <Chip
                      label={`${statistics.posgradoPct}%`}
                      sx={{ bgcolor: '#7c3aed', color: '#fff', fontWeight: 900, fontSize: 13, height: 28, px: 0.8 }}
                    />
                  </Stack>

                  <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, mt: 0.5 }}>
                    <Typography sx={{ fontSize: 38, fontWeight: 950, color: '#0f172a', lineHeight: 1 }}>
                      {statistics.totalPosgrado}
                    </Typography>
                    <Typography sx={{ fontSize: 14, fontWeight: 700, color: '#64748b' }}>
                      programas con resolución
                    </Typography>
                  </Box>

                  {/* Barra de progreso visual */}
                  <Box sx={{ width: '100%' }}>
                    <LinearProgress
                      variant="determinate"
                      value={Number(statistics.posgradoPct) || 0}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: '#f3e8ff',
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          bgcolor: '#7c3aed'
                        }
                      }}
                    />
                  </Box>

                  <Divider sx={{ my: 0.5, borderColor: '#f3e8ff' }} />

                  {/* Subtotales Posgrado */}
                  <Stack direction="row" spacing={2} justifyContent="space-between" alignItems="center">
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#0f766e' }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        Especializaciones: <strong>{statistics.especializacionesCount}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#7c3aed' }} />
                      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#475569' }}>
                        Maestrías: <strong>{statistics.maestriasCount}</strong>
                      </Typography>
                    </Box>
                    <Box sx={{ bgcolor: '#f3e8ff', px: 1, py: 0.3, borderRadius: 1.5 }}>
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#6b21a8' }}>
                        {formatNumber(statistics.posgradoCupos)} cupos
                      </Typography>
                    </Box>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* 2. COMPONENTE IDÉNTICO AL ADJUNTO: DISTRIBUCIÓN POR NIVEL DE FORMACIÓN */}
          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
            {/* Header azul degradado institucional */}
            <Box sx={{ px: 2.5, py: 1.5, background: 'linear-gradient(135deg,#0f2f57 0%,#1d4f8c 100%)', display: 'flex', alignItems: 'center', gap: 1.2 }}>
              <SchoolIcon sx={{ fontSize: 20, color: '#fff' }} />
              <Box>
                <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14.5, letterSpacing: 0.2 }}>
                  Distribución por Nivel de Formación
                </Typography>
                <Typography sx={{ color: 'rgba(255,255,255,0.75)', fontSize: 11.5 }}>
                  {statistics.totalGeneral} programas registrados en Resoluciones · {statistics.nivelesRows.length} niveles
                </Typography>
              </Box>
            </Box>

            <Box sx={{ p: { xs: 1.5, sm: 2 } }}>
              {/* Tarjetas compactas por nivel (como en la imagen 2) */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: {
                    xs: '1fr',
                    sm: `repeat(${Math.min(statistics.nivelesRows.length || 1, 4)}, 1fr)`
                  },
                  gap: 1.4,
                  mb: statistics.nivelesRows.length > 0 ? 2 : 0
                }}
              >
                {statistics.nivelesRows.map((nivel) => {
                  const pct = statistics.totalGeneral > 0 ? ((nivel.total / statistics.totalGeneral) * 100).toFixed(1) : '0.0';
                  return (
                    <Box
                      key={nivel.nivel}
                      sx={{
                        p: { xs: 1.4, sm: 1.6 },
                        borderRadius: 2,
                        bgcolor: nivel.bg,
                        border: `1.5px solid ${nivel.color}35`,
                        textAlign: 'center',
                        position: 'relative',
                        overflow: 'hidden'
                      }}
                    >
                      <Box
                        sx={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          right: 0,
                          height: 3.5,
                          bgcolor: nivel.color,
                          borderRadius: '2px 2px 0 0'
                        }}
                      />
                      <Typography sx={{ fontSize: 10, fontWeight: 900, color: nivel.color, textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.3, mt: 0.4 }}>
                        {nivel.label}
                      </Typography>
                      <Typography sx={{ fontSize: { xs: 24, sm: 28 }, fontWeight: 950, color: nivel.color, lineHeight: 1.1 }}>
                        {nivel.total}
                      </Typography>
                      <Typography sx={{ fontSize: 10.5, color: '#64748b', mt: 0.3 }}>
                        {pct}% · {nivel.total} programa{nivel.total !== 1 ? 's' : ''}
                      </Typography>
                      <Box sx={{ height: 4, bgcolor: `${nivel.color}20`, borderRadius: 99, mt: 0.8 }}>
                        <Box
                          sx={{
                            width: `${Math.min(100, Number(pct))}%`,
                            height: '100%',
                            bgcolor: nivel.color,
                            borderRadius: 99,
                            transition: 'width 0.6s ease'
                          }}
                        />
                      </Box>
                    </Box>
                  );
                })}
              </Box>

              {/* Tabla expandible por nivel con programas y facultades */}
              {statistics.nivelesRows.length > 0 ? (
                <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                  {/* Encabezado de la tabla */}
                  <Box
                    sx={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      alignItems: 'center',
                      px: 2,
                      py: 1.1,
                      bgcolor: '#f8fafc',
                      borderBottom: '1px solid #e2e8f0'
                    }}
                  >
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      Nivel de formación
                    </Typography>
                    <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.6, mr: 3 }}>
                      Programas
                    </Typography>
                    <Box sx={{ width: 20 }} />
                  </Box>

                  {/* Filas con acordeón */}
                  {statistics.nivelesRows.map((nivel, idx) => {
                    const isExpanded = nivelExpandedKey === nivel.nivel;
                    const isLast = idx === statistics.nivelesRows.length - 1;

                    return (
                      <Box key={nivel.nivel} sx={{ borderBottom: isLast ? 'none' : '1px solid #f1f5f9' }}>
                        {/* Fila principal del nivel */}
                        <Box
                          onClick={() => setNivelExpandedKey(isExpanded ? null : nivel.nivel)}
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: '1fr auto auto',
                            alignItems: 'center',
                            px: 2,
                            py: 1.2,
                            cursor: 'pointer',
                            bgcolor: isExpanded ? `${nivel.color}08` : 'transparent',
                            transition: 'background 0.2s',
                            '&:hover': { bgcolor: `${nivel.color}12` }
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2 }}>
                            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: nivel.color, flexShrink: 0 }} />
                            <Typography sx={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>
                              {nivel.label}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              minWidth: 32,
                              height: 24,
                              borderRadius: 12,
                              bgcolor: `${nivel.color}18`,
                              border: `1px solid ${nivel.color}40`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              mr: 1.5,
                              px: 0.8
                            }}
                          >
                            <Typography sx={{ fontSize: 12, fontWeight: 900, color: nivel.color }}>
                              {nivel.total}
                            </Typography>
                          </Box>
                          <Box
                            sx={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              bgcolor: isExpanded ? nivel.color : '#f1f5f9',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.25s'
                            }}
                          >
                            <ExpandMoreIcon
                              sx={{
                                fontSize: 16,
                                color: isExpanded ? '#fff' : '#94a3b8',
                                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.25s'
                              }}
                            />
                          </Box>
                        </Box>

                        {/* Detalle expandido agrupado por facultad */}
                        <Collapse in={isExpanded} timeout={260} unmountOnExit>
                          <Box sx={{ px: 2, pb: 2, pt: 1.2, bgcolor: `${nivel.color}04`, borderTop: `1px solid ${nivel.color}20` }}>
                            {(() => {
                              const byFaculty = {};
                              nivel.programas.forEach((item) => {
                                const fac = classifyProgramFaculty(item.nombrePrograma);
                                if (!byFaculty[fac]) byFaculty[fac] = [];
                                byFaculty[fac].push(item);
                              });

                              const facKeys = FACULTY_ORDER.filter((f) => byFaculty[f]).concat(
                                Object.keys(byFaculty).filter((f) => !FACULTY_ORDER.includes(f))
                              );
                              const cols = facKeys.length === 1 ? 1 : 2;

                              return (
                                <Box
                                  sx={{
                                    display: 'grid',
                                    gridTemplateColumns: { xs: '1fr', md: `repeat(${cols}, 1fr)` },
                                    gap: '12px 20px',
                                    alignItems: 'start'
                                  }}
                                >
                                  {facKeys.map((fac) => (
                                    <Box key={fac} sx={{ minWidth: 0 }}>
                                      <Box
                                        sx={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 0.8,
                                          mb: 0.8,
                                          pb: 0.4,
                                          borderBottom: `1.5px solid ${nivel.color}35`
                                        }}
                                      >
                                        <Box sx={{ width: 7, height: 7, borderRadius: '2px', bgcolor: nivel.color, flexShrink: 0 }} />
                                        <Typography
                                          sx={{
                                            fontSize: 9.5,
                                            fontWeight: 900,
                                            color: nivel.color,
                                            textTransform: 'uppercase',
                                            letterSpacing: 0.5,
                                            lineHeight: 1.3
                                          }}
                                        >
                                          {fac}
                                        </Typography>
                                      </Box>

                                      <Stack spacing={0.6}>
                                        {byFaculty[fac].map((prog, pi) => (
                                          <Box
                                            key={pi}
                                            sx={{
                                              p: 0.8,
                                              borderRadius: 1.5,
                                              bgcolor: '#fff',
                                              border: '1px solid #e2e8f0',
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'space-between',
                                              gap: 1
                                            }}
                                          >
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, minWidth: 0 }}>
                                              <Box sx={{ width: 5, height: 5, borderRadius: '50%', bgcolor: nivel.color, flexShrink: 0 }} />
                                              <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#1e293b', whiteSpace: 'normal' }}>
                                                {prog.nombrePrograma}
                                              </Typography>
                                            </Box>
                                            <Stack direction="row" spacing={0.6} flexShrink={0}>
                                              {prog.codigoSnies && (
                                                <Chip
                                                  label={`SNIES ${prog.codigoSnies}`}
                                                  size="small"
                                                  sx={{ fontSize: 10, fontWeight: 800, height: 20, bgcolor: '#f1f5f9' }}
                                                />
                                              )}
                                              {prog.numeroResolucion && (
                                                <Chip
                                                  label={`Res. ${prog.numeroResolucion}`}
                                                  size="small"
                                                  sx={{ fontSize: 10, fontWeight: 800, height: 20, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                                                />
                                              )}
                                            </Stack>
                                          </Box>
                                        ))}
                                      </Stack>
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
              ) : (
                <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ py: 6 }}>
                  <SchoolIcon sx={{ fontSize: 46, color: '#cbd5e1' }} />
                  <Typography sx={{ color: '#64748b', fontWeight: 700, fontSize: 13 }}>
                    No hay registros de resoluciones cargados actualmente.
                  </Typography>
                  <Typography sx={{ color: '#94a3b8', fontSize: 12 }}>
                    Carga la plantilla de Resoluciones en el módulo de Gestión de Información para visualizar las estadísticas.
                  </Typography>
                </Stack>
              )}
            </Box>
          </Box>
        </Stack>
      )}

      {/* ========================================================================= */}
      {/* COMPONENTE 2: DOCUMENTACIÓN DE PROGRAMAS (HISTÓRICO RC Y EVIDENCIAS DRIVE)*/}
      {/* ========================================================================= */}
      {activeTab === 'documentacion' && (
        <Stack spacing={2}>
          <Paper elevation={0} sx={{ p: { xs: 1.5, md: 1.8 }, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
            <Box>
              <Autocomplete
                options={historicoProgramas}
                value={historicoFilters.programa || null}
                onChange={(_, value) => setHistoricoFilters((prev) => ({ ...prev, programa: value || '' }))}
                renderInput={(params) => <TextField {...params} label="Filtro de programa" placeholder="Todos los programas" size="small" />}
              />
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: 1.1, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
              <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#334155', px: 1 }}>
                Repositorio Histórico de Resoluciones y Evidencias Drive
              </Typography>
              <ToggleButtonGroup
                exclusive
                size="small"
                value={historicoFilters.estado}
                onChange={(_, next) => setHistoricoFilters((prev) => ({ ...prev, estado: next || 'activos' }))}
                sx={{
                  width: { xs: '100%', md: 360 },
                  height: 38,
                  '& .MuiToggleButton-root': { flex: 1, fontWeight: 800, color: '#1d4ed8', borderColor: '#bfdbfe', fontSize: 12 },
                  '& .Mui-selected': { color: '#fff !important', bgcolor: '#1d4ed8 !important' }
                }}
              >
                <ToggleButton value="activos">Activos</ToggleButton>
                <ToggleButton value="inactivos">Inactivos</ToggleButton>
                <ToggleButton value="todos">Todos</ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', overflow: 'hidden', bgcolor: '#fff' }}>
            <Box sx={{ px: 1.8, py: 1.3, bgcolor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                Histórico RC y Repositorio de Documentos ({historicoRegistros.length} registros)
              </Typography>
            </Box>
            <TableContainer sx={{ maxHeight: 580, overflowX: 'auto' }}>
              <Table
                size="small"
                stickyHeader
                sx={{
                  minWidth: 980,
                  tableLayout: 'fixed',
                  '& .MuiTableCell-root': { fontSize: 12.5, py: 0.9 }
                }}
              >
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 230, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Programa</TableCell>
                    <TableCell sx={{ width: 180, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Aprobación</TableCell>
                    <TableCell sx={{ width: 150, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Resolución</TableCell>
                    <TableCell sx={{ width: 300, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Documentos esperados</TableCell>
                    <TableCell sx={{ width: 90, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Estado</TableCell>
                    <TableCell sx={{ width: 125, fontWeight: 900, color: '#334155', bgcolor: '#f8fafc', fontSize: 12 }}>Drive</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {historicoLoading ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}><CircularProgress size={30} /></TableCell></TableRow>
                  ) : historicoRegistros.length === 0 ? (
                    <TableRow><TableCell colSpan={6} align="center" sx={{ py: 6 }}>No hay registros para el filtro seleccionado.</TableCell></TableRow>
                  ) : historicoRegistros.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 12.8, lineHeight: 1.2 }}>{row.programaAcademico}</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 11.5, mt: 0.25 }}>{row.nivel || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700, fontSize: 12.4, lineHeight: 1.25 }}>{row.tipoAprobacion || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ color: '#1d4ed8', fontWeight: 900, fontSize: 13 }}>{row.resolucionMen || '-'}</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 11.5 }}>{formatDate(row.fechaResolucion)}</Typography>
                      </TableCell>
                      <TableCell>
                        <Typography sx={{ fontWeight: 800, fontSize: 12.2, lineHeight: 1.2, color: '#0f172a' }}>{row.resolucionRc || '-'}</Typography>
                        <Typography sx={{ fontWeight: 700, fontSize: 12, lineHeight: 1.2, color: '#475569', mt: 0.45 }}>{row.planEstudios || '-'}</Typography>
                      </TableCell>
                      <TableCell>
                        <Chip size="small" label={row.estado} sx={{ fontWeight: 800, bgcolor: row.estado === 'Activo' ? '#dcfce7' : '#f1f5f9', color: row.estado === 'Activo' ? '#166534' : '#475569' }} />
                      </TableCell>
                      <TableCell>
                        <Button size="small" variant="outlined" startIcon={<FolderIcon />} onClick={() => openEvidence(row)} disabled={!row.enlace} sx={{ whiteSpace: 'nowrap', fontWeight: 800 }}>
                          Ver archivos
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Stack>
      )}

      {/* ========================================================================= */}
      {/* COMPONENTE 3: MONITOREO DE PROGRAMAS (RESOLUCIONES Y VENCIMIENTOS RC)     */}
      {/* ========================================================================= */}
      {activeTab === 'monitoreo' && (
        <Stack spacing={2.2}>
          {/* BARRA SUPERIOR: CABECERA + ACCIONES EJECUTIVAS */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              alignItems: { xs: 'stretch', md: 'center' },
              justifyContent: 'space-between',
              gap: 1.5,
              p: 1.5,
              borderRadius: 3,
              bgcolor: '#fff',
              border: '1px solid #dbe6f5'
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: { xs: 16, sm: 18 }, color: '#0f172a' }}>
                Tablero Ejecutivo de Monitoreo y Vencimientos RC
              </Typography>
              <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.2 }}>
                Seguimiento semafórico preventivo a los ciclos de Renovación de Registros Calificados (26 y 14 meses)
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems="center">
              {/* Botón de Notificación a Planeación */}
              <Button
                variant="contained"
                color="error"
                startIcon={<NotificationsActiveIcon />}
                onClick={() => handleOpenNotification()}
                sx={{
                  bgcolor: '#b91c1c',
                  color: '#fff',
                  fontWeight: 900,
                  fontSize: 12.5,
                  borderRadius: 2.2,
                  px: 2,
                  py: 0.9,
                  boxShadow: '0 4px 12px rgba(185, 28, 28, 0.25)',
                  '&:hover': { bgcolor: '#991b1b' }
                }}
              >
                Notificar Alertas a Planeación ({semaforoCounts.critico + semaforoCounts.alerta})
              </Button>

              {/* Selector de vista: Catálogo de Tarjetas vs Monitor Reducido vs Matriz 17 Columnas */}
              <ToggleButtonGroup
                exclusive
                size="small"
                value={monitorViewMode}
                onChange={(_, next) => next && setMonitorViewMode(next)}
                sx={{
                  height: 38,
                  bgcolor: '#f8fafc',
                  '& .MuiToggleButton-root': {
                    px: 1.6,
                    fontWeight: 850,
                    fontSize: 12,
                    color: '#475569',
                    borderColor: '#cbd5e1',
                    textTransform: 'none'
                  },
                  '& .Mui-selected': {
                    bgcolor: '#1e3a8a !important',
                    color: '#fff !important',
                    borderColor: '#1e3a8a !important'
                  }
                }}
              >
                <ToggleButton value="tarjetas">
                  <ViewModuleIcon sx={{ fontSize: 17, mr: 0.7 }} />
                  Tarjetas Ejecutivas
                </ToggleButton>
                <ToggleButton value="semaforo">
                  <SpeedIcon sx={{ fontSize: 17, mr: 0.7 }} />
                  Monitor Resumido
                </ToggleButton>
                <ToggleButton value="matriz">
                  <TableChartIcon sx={{ fontSize: 17, mr: 0.7 }} />
                  Matriz Completa (17 cols)
                </ToggleButton>
              </ToggleButtonGroup>
            </Stack>
          </Box>

          {/* SELECTOR INSTITUCIONAL DE PROCESO (DECRETO 1330): CONDICIONES DE PROGRAMA VS CONDICIONES INSTITUCIONALES */}
          <Paper
            elevation={0}
            sx={{
              p: 0.8,
              borderRadius: 3,
              border: '1.5px solid #cbd5e1',
              bgcolor: '#f8fafc',
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)'
            }}
          >
            <Tabs
              value={procesoTipo}
              onChange={(_, val) => {
                if (!val) return;
                setProcesoTipo(val);
                setResolFilters((prev) => ({ ...prev, programa: '', nivel: '' }));
                setSemaforoFilter('TODOS');
              }}
              variant="fullWidth"
              TabIndicatorProps={{ style: { display: 'none' } }}
              sx={{
                minHeight: 56,
                '& .MuiTabs-flexContainer': { gap: 1 },
                '& .MuiTab-root': {
                  flex: 1,
                  minHeight: 52,
                  borderRadius: 2.2,
                  textTransform: 'none',
                  p: 1.2,
                  transition: 'all 0.2s ease',
                  border: '1px solid transparent',
                  bgcolor: '#fff',
                  color: '#475569',
                  '&:hover': {
                    bgcolor: '#f1f5f9',
                    borderColor: '#cbd5e1'
                  },
                  '&.Mui-selected': {
                    bgcolor: '#1e3a8a',
                    color: '#ffffff',
                    boxShadow: '0 4px 14px rgba(30, 58, 138, 0.25)',
                    '& .MuiSvgIcon-root': { color: '#ffffff' },
                    '& .subtext': { color: '#bfdbfe' },
                    '& .badge-count': { bgcolor: 'rgba(255, 255, 255, 0.2)', color: '#ffffff' }
                  }
                }
              }}
            >
              <Tab
                value="PROGRAMAS"
                label={
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
                    <SchoolIcon sx={{ fontSize: 22, color: '#1e3a8a' }} />
                    <Box sx={{ textAlign: 'left' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 900, fontSize: 13.5, lineHeight: 1.2 }}>
                          Condiciones de Calidad de Programa
                        </Typography>
                        <Chip
                          className="badge-count"
                          size="small"
                          label={`${academicProgramItems.length} Programas`}
                          sx={{
                            fontWeight: 900,
                            fontSize: 11,
                            height: 22,
                            bgcolor: '#eff6ff',
                            color: '#1d4ed8'
                          }}
                        />
                      </Stack>
                      <Typography className="subtext" sx={{ fontSize: 11, color: '#64748b', mt: 0.2 }}>
                        Registros Calificados individuales de programas académicos de pregrado y posgrado (Decreto 1330)
                      </Typography>
                    </Box>
                  </Stack>
                }
              />
              <Tab
                value="INSTITUCIONAL"
                label={
                  <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="center">
                    <AccountBalanceIcon sx={{ fontSize: 22, color: '#0f766e' }} />
                    <Box sx={{ textAlign: 'left' }}>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography sx={{ fontWeight: 900, fontSize: 13.5, lineHeight: 1.2 }}>
                          Condiciones Institucionales de Calidad
                        </Typography>
                        <Chip
                          className="badge-count"
                          size="small"
                          label={`${institutionalItems.length} Proceso Institucional`}
                          sx={{
                            fontWeight: 900,
                            fontSize: 11,
                            height: 22,
                            bgcolor: '#f0fdf4',
                            color: '#0f766e'
                          }}
                        />
                      </Stack>
                      <Typography className="subtext" sx={{ fontSize: 11, color: '#64748b', mt: 0.2 }}>
                        Evaluación y renovación institucional transversal amparando la sede y oferta (Decreto 1330 / MEN)
                      </Typography>
                    </Box>
                  </Stack>
                }
              />
            </Tabs>
          </Paper>

          {/* TARJETAS KPI DE SEMÁFORO INTERACTIVAS (ADAPTADAS AL SEGMENTO ACTIVO) */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 1.5 }}>
            {/* 1. CRÍTICO / RADICACIÓN SACES */}
            <Card
              onClick={() => setSemaforoFilter(semaforoFilter === 'CRITICO' ? 'TODOS' : 'CRITICO')}
              sx={{
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: semaforoFilter === 'CRITICO' ? '#b91c1c' : '#fecaca',
                bgcolor: semaforoFilter === 'CRITICO' ? '#fef2f2' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: semaforoFilter === 'CRITICO' ? '0 4px 14px rgba(185, 28, 28, 0.15)' : 'none',
                '&:hover': { borderColor: '#b91c1c', transform: 'translateY(-2px)' }
              }}
            >
              <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      SACES (≤ 14m)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#991b1b', mt: 0.3 }}>
                      {semaforoCounts.critico}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#7f1d1d', fontWeight: 700 }}>
                      Radicación en MEN
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#fee2e2', color: '#dc2626' }}>
                    <WarningIcon fontSize="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* 2. ALERTA / ELABORAR RRC */}
            <Card
              onClick={() => setSemaforoFilter(semaforoFilter === 'ALERTA' ? 'TODOS' : 'ALERTA')}
              sx={{
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: semaforoFilter === 'ALERTA' ? '#d97706' : '#fde68a',
                bgcolor: semaforoFilter === 'ALERTA' ? '#fffbeb' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: semaforoFilter === 'ALERTA' ? '0 4px 14px rgba(217, 119, 6, 0.15)' : 'none',
                '&:hover': { borderColor: '#d97706', transform: 'translateY(-2px)' }
              }}
            >
              <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Doc. RRC (≤ 26m)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#92400e', mt: 0.3 }}>
                      {semaforoCounts.alerta}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#78350f', fontWeight: 700 }}>
                      Fase renovación
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#fef3c7', color: '#d97706' }}>
                    <EventNoteIcon fontSize="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* 3. VIGENTE */}
            <Card
              onClick={() => setSemaforoFilter(semaforoFilter === 'VIGENTE' ? 'TODOS' : 'VIGENTE')}
              sx={{
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: semaforoFilter === 'VIGENTE' ? '#16a34a' : '#bbf7d0',
                bgcolor: semaforoFilter === 'VIGENTE' ? '#f0fdf4' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: semaforoFilter === 'VIGENTE' ? '0 4px 14px rgba(22, 163, 74, 0.15)' : 'none',
                '&:hover': { borderColor: '#16a34a', transform: 'translateY(-2px)' }
              }}
            >
              <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Vigente (> 26m)
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#166534', mt: 0.3 }}>
                      {semaforoCounts.vigente}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#14532d', fontWeight: 700 }}>
                      Tiempo regular suficiente
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#dcfce7', color: '#16a34a' }}>
                    <CheckCircleOutlineIcon fontSize="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* 4. PLAN DE CONTINGENCIA (DECRETO 1330) */}
            <Card
              onClick={() => setSemaforoFilter(semaforoFilter === 'EN_CONTINGENCIA' ? 'TODOS' : 'EN_CONTINGENCIA')}
              sx={{
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: semaforoFilter === 'EN_CONTINGENCIA' ? '#c2410c' : '#fed7aa',
                bgcolor: semaforoFilter === 'EN_CONTINGENCIA' ? '#fff7ed' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: semaforoFilter === 'EN_CONTINGENCIA' ? '0 4px 14px rgba(194, 65, 12, 0.15)' : 'none',
                '&:hover': { borderColor: '#c2410c', transform: 'translateY(-2px)' }
              }}
            >
              <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ color: '#c2410c', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Plan Contingencia
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#9a3412', mt: 0.3 }}>
                      {semaforoCounts.contingencia}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#7c2d12', fontWeight: 700 }}>
                      {semaforoCounts.contingenciaPendiente > 0 ? `${semaforoCounts.contingenciaPendiente} por radicar en MEN` : 'Cohortes garantizadas'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#ffedd5', color: '#c2410c' }}>
                    <PolicyIcon fontSize="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* 5. TOTAL DEL SEGMENTO */}
            <Card
              onClick={() => setSemaforoFilter('TODOS')}
              sx={{
                borderRadius: 2.5,
                border: '1.5px solid',
                borderColor: semaforoFilter === 'TODOS' ? '#1e3a8a' : '#cbd5e1',
                bgcolor: semaforoFilter === 'TODOS' ? '#f8fafc' : '#fff',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                boxShadow: semaforoFilter === 'TODOS' ? '0 4px 14px rgba(30, 58, 138, 0.12)' : 'none',
                '&:hover': { borderColor: '#1e3a8a', transform: 'translateY(-2px)' }
              }}
            >
              <CardContent sx={{ p: 1.8, '&:last-child': { pb: 1.8 } }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Box>
                    <Typography variant="caption" sx={{ color: '#475569', fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                      Total Monitoreados
                    </Typography>
                    <Typography variant="h4" sx={{ fontWeight: 950, color: '#0f172a', mt: 0.3 }}>
                      {semaforoCounts.total}
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                      {semaforoCounts.vencido > 0 ? `${semaforoCounts.vencido} vencidos` : '100% en seguimiento'}
                    </Typography>
                  </Box>
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#eff6ff', color: '#1d4ed8' }}>
                    <DescriptionIcon fontSize="small" />
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Box>

          {/* FILTROS DE BÚSQUEDA Y PROGRAMAS */}
          <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems="center">
              <Box sx={{ flex: 1.4, width: '100%' }}>
                <Autocomplete
                  options={activeProgramasOptions}
                  value={resolFilters.programa || null}
                  onChange={(_, value) => setResolFilters((prev) => ({ ...prev, programa: value || '' }))}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={procesoTipo === 'INSTITUCIONAL' ? 'Proceso institucional' : 'Filtro de programa'}
                      placeholder={procesoTipo === 'INSTITUCIONAL' ? 'Condiciones Institucionales' : 'Todos los programas'}
                      size="small"
                    />
                  )}
                />
              </Box>
              <Box sx={{ flex: 1, width: '100%' }}>
                <Autocomplete
                  options={resolucionesNiveles}
                  value={resolFilters.nivel || null}
                  onChange={(_, value) => setResolFilters((prev) => ({ ...prev, nivel: value || '' }))}
                  disabled={procesoTipo === 'INSTITUCIONAL'}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Nivel de formación"
                      placeholder={procesoTipo === 'INSTITUCIONAL' ? 'No aplica (Institucional)' : 'Todos los niveles'}
                      size="small"
                    />
                  )}
                />
              </Box>
              <Box sx={{ flex: 1.2, width: '100%' }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Buscar en resoluciones"
                  placeholder="SNIES, resolución, palabra clave..."
                  value={resolFilters.busqueda}
                  onChange={(e) => setResolFilters((prev) => ({ ...prev, busqueda: e.target.value }))}
                  InputProps={{
                    startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" sx={{ color: '#94a3b8' }} /></InputAdornment>,
                    endAdornment: resolFilters.busqueda ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={() => setResolFilters((prev) => ({ ...prev, busqueda: '' }))}><ClearIcon fontSize="small" /></IconButton>
                      </InputAdornment>
                    ) : null
                  }}
                />
              </Box>
            </Stack>
          </Paper>

          {/* FILTROS RÁPIDOS POR ESTADO DE SEMÁFORO Y CICLO DE VIDA (FORMAL, SIN EMOJIS) */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: '#475569', mr: 0.5 }}>
              Filtrar por estado del ciclo:
            </Typography>
            {[
              { key: 'TODOS', label: `Todos (${semaforoCounts.total})`, color: '#334155', bg: '#f1f5f9' },
              { key: 'CRITICO', label: `Radicación SACES (${semaforoCounts.critico})`, color: '#b91c1c', bg: '#fee2e2' },
              { key: 'ALERTA', label: `Elaborar Doc. RRC (${semaforoCounts.alerta})`, color: '#b45309', bg: '#fef3c7' },
              { key: 'VIGENTE', label: `Vigente (${semaforoCounts.vigente})`, color: '#15803d', bg: '#dcfce7' },
              ...(semaforoCounts.contingencia > 0 ? [{ key: 'EN_CONTINGENCIA', label: `Planes de Contingencia (${semaforoCounts.contingencia})`, color: '#c2410c', bg: '#ffedd5' }] : []),
              ...(semaforoCounts.culminado > 0 ? [{ key: 'CULMINADO', label: `Culminados (${semaforoCounts.culminado})`, color: '#475569', bg: '#f1f5f9' }] : []),
              ...(semaforoCounts.vencido > 0 ? [{ key: 'VENCIDO', label: `Vencidos (${semaforoCounts.vencido})`, color: '#475569', bg: '#f1f5f9' }] : [])
            ].map((f) => (
              <Chip
                key={f.key}
                label={f.label}
                onClick={() => setSemaforoFilter(f.key)}
                variant={semaforoFilter === f.key ? 'filled' : 'outlined'}
                sx={{
                  fontWeight: 850,
                  fontSize: 12,
                  cursor: 'pointer',
                  bgcolor: semaforoFilter === f.key ? f.color : 'transparent',
                  color: semaforoFilter === f.key ? '#fff' : f.color,
                  borderColor: f.color,
                  '&:hover': { bgcolor: f.color, color: '#fff' }
                }}
              />
            ))}
          </Box>

          {/* ========================================================================= */}
          {/* VISTA 0: CATÁLOGO DE TARJETAS EJECUTIVAS (CICLO DE VIDA Y EXPEDIENTE)     */}
          {/* ========================================================================= */}
          {monitorViewMode === 'tarjetas' && (
            <Box>
              {filteredMonitoreoItems.length === 0 ? (
                <Paper
                  elevation={0}
                  sx={{
                    p: 6,
                    textAlign: 'center',
                    borderRadius: 3,
                    border: '1px solid #dbe6f5',
                    bgcolor: '#fff'
                  }}
                >
                  <SchoolIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
                  <Typography sx={{ fontWeight: 800, fontSize: 16, color: '#1e293b' }}>
                    No se encontraron programas con los filtros seleccionados
                  </Typography>
                  <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.5 }}>
                    Pruebe seleccionando "Todos" en los filtros superiores o ajustando el término de búsqueda.
                  </Typography>
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() => {
                      setSemaforoFilter('TODOS');
                      setResolFilters({ programa: '', nivel: '', busqueda: '' });
                    }}
                    sx={{ mt: 2, fontWeight: 800 }}
                  >
                    Restablecer filtros
                  </Button>
                </Paper>
              ) : (
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, 1fr)',
                      lg: 'repeat(3, 1fr)'
                    },
                    gap: 2
                  }}
                >
                  {filteredMonitoreoItems.map((row) => {
                    const isPosgrado = classifyLevelKey(row.nivelFormacion, row.nombrePrograma) !== 'TECNOLOGICO' && classifyLevelKey(row.nivelFormacion, row.nombrePrograma) !== 'PROFESIONAL';

                    return (
                      <Card
                        key={row.id}
                        elevation={0}
                        sx={{
                          borderRadius: 3.5,
                          border: '1.5px solid',
                          borderColor: row.semaforo.isContingencia ? (row.semaforo.border || '#cbd5e1') : (row.semaforo.border || '#e2e8f0'),
                          bgcolor: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          transition: 'all 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
                          overflow: 'hidden',
                          position: 'relative',
                          boxShadow: '0 4px 12px rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.02)',
                          '&:hover': {
                            boxShadow: '0 16px 36px -4px rgba(15, 23, 42, 0.12), 0 4px 10px -2px rgba(15, 23, 42, 0.06)',
                            borderColor: row.semaforo.color,
                            transform: 'translateY(-4px)'
                          }
                        }}
                      >
                        {/* Barra superior de acento con gradiente según estado */}
                        <Box sx={{ height: 4.5, background: `linear-gradient(90deg, ${row.semaforo.color} 0%, ${row.semaforo.color}99 100%)` }} />

                        <CardContent sx={{ p: 2.2, flex: 1, display: 'flex', flexDirection: 'column' }}>
                          {/* Chips de Metadatos: Facultad, Nivel y SNIES / Proceso Institucional */}
                          <Stack
                            direction="row"
                            alignItems="center"
                            justifyContent="space-between"
                            sx={{ mb: 1.2, flexWrap: 'wrap', gap: 0.6 }}
                          >
                            {isInstitutionalRecord(row) ? (
                              <Chip
                                icon={<AccountBalanceIcon sx={{ fontSize: '14px !important', color: '#0f766e !important' }} />}
                                label="Condiciones Institucionales (IES)"
                                size="small"
                                sx={{
                                  fontWeight: 900,
                                  fontSize: 10.5,
                                  bgcolor: '#f0fdf4',
                                  color: '#0f766e',
                                  height: 22,
                                  border: '1px solid #bbf7d0'
                                }}
                              />
                            ) : (
                              <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.6 }}>
                                <Chip
                                  label={classifyProgramFaculty(row.nombrePrograma)}
                                  size="small"
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: 10.5,
                                    bgcolor: '#f1f5f9',
                                    color: '#475569',
                                    height: 22,
                                    border: '1px solid #e2e8f0'
                                  }}
                                />
                                <Chip
                                  label={row.nivelFormacion || 'Pregrado'}
                                  size="small"
                                  sx={{
                                    fontWeight: 850,
                                    fontSize: 10.5,
                                    bgcolor: isPosgrado ? '#f5f3ff' : '#eff6ff',
                                    color: isPosgrado ? '#6d28d9' : '#1d4ed8',
                                    height: 22,
                                    border: `1px solid ${isPosgrado ? '#ddd6fe' : '#bfdbfe'}`
                                  }}
                                />
                              </Stack>
                            )}
                            {row.consecutivo && (
                              <Chip
                                label={`No. ${row.consecutivo}`}
                                size="small"
                                sx={{
                                  fontWeight: 900,
                                  fontSize: 10.5,
                                  bgcolor: '#e2e8f0',
                                  color: '#334155',
                                  height: 22
                                }}
                              />
                            )}
                            {row.codigoSnies && (
                              <Chip
                                label={`SNIES ${row.codigoSnies}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontWeight: 900,
                                  fontSize: 10.5,
                                  borderColor: '#cbd5e1',
                                  color: '#334155',
                                  height: 22,
                                  fontFamily: 'monospace',
                                  bgcolor: '#f8fafc'
                                }}
                              />
                            )}
                          </Stack>

                          {/* Nombre del Programa */}
                          <Typography
                            sx={{
                              fontWeight: 900,
                              fontSize: 15,
                              color: '#0f172a',
                              lineHeight: 1.32,
                              mb: 1.2,
                              minHeight: 42,
                              letterSpacing: '-0.01em'
                            }}
                          >
                            {row.nombrePrograma}
                          </Typography>

                          {/* Fila Métrica Académica: Cupos, Créditos, Semestres */}
                          <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap" sx={{ mb: 1.4, gap: 0.6 }}>
                            {row.numeroEstudiantes ? (
                              <Chip
                                icon={<PeopleIcon sx={{ fontSize: '14px !important', color: '#1e40af !important' }} />}
                                label={`${formatNumber(row.numeroEstudiantes)} cupos`}
                                size="small"
                                sx={{
                                  fontWeight: 850,
                                  fontSize: 11,
                                  bgcolor: '#eff6ff',
                                  color: '#1e40af',
                                  border: '1px solid #bfdbfe',
                                  height: 23
                                }}
                              />
                            ) : null}
                            {row.creditos ? (
                              <Chip
                                icon={<MenuBookIcon sx={{ fontSize: '13px !important', color: '#0f766e !important' }} />}
                                label={`${row.creditos} créd.`}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  bgcolor: '#f0fdf4',
                                  color: '#0f766e',
                                  border: '1px solid #bbf7d0',
                                  height: 23
                                }}
                              />
                            ) : null}
                            {row.semestres ? (
                              <Chip
                                icon={<DateRangeIcon sx={{ fontSize: '13px !important', color: '#6b21a8 !important' }} />}
                                label={`${row.semestres} sem.`}
                                size="small"
                                sx={{
                                  fontWeight: 800,
                                  fontSize: 11,
                                  bgcolor: '#faf5ff',
                                  color: '#6b21a8',
                                  border: '1px solid #e9d5ff',
                                  height: 23
                                }}
                              />
                            ) : null}
                          </Stack>

                          {/* Novedades de Vigencia (si existen) */}
                          {row.novedadesVigencia && (
                            <Box
                              sx={{
                                mb: 1.4,
                                p: 1,
                                borderRadius: 2,
                                bgcolor: '#fffbeb',
                                border: '1px solid #fef08a',
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: 0.8
                              }}
                            >
                              <InfoIcon sx={{ fontSize: 16, color: '#b45309', mt: 0.2, flexShrink: 0 }} />
                              <Typography sx={{ fontSize: 11, color: '#92400e', lineHeight: 1.35, fontWeight: 650 }}>
                                {row.novedadesVigencia.length > 115 ? `${row.novedadesVigencia.substring(0, 112)}...` : row.novedadesVigencia}
                              </Typography>
                            </Box>
                          )}

                          {/* Banner de Estado Semafórico Actual con Icono Formal SVG */}
                          <Box
                            sx={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              p: 1.1,
                              borderRadius: 2.2,
                              bgcolor: row.semaforo.bg,
                              border: `1.5px solid ${row.semaforo.border}`,
                              mb: 1.5
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              {renderStatusIcon(row.semaforo.estado, 18)}
                              <Box>
                                <Typography sx={{ fontWeight: 900, fontSize: 12, color: row.semaforo.color, lineHeight: 1.2 }}>
                                  {row.semaforo.badgeText}
                                </Typography>
                                <Typography sx={{ fontSize: 11, color: '#475569', fontWeight: 700 }}>
                                  {row.semaforo.tiempoRestanteStr}
                                </Typography>
                              </Box>
                            </Box>
                            {renderSacesBadge(row.semaforo.sacesDiffDays !== null ? row.semaforo.sacesDiffDays : row.fechaMaximaRadicarSaces)}
                          </Box>

                          {/* Barra de Progreso del Ciclo de 7 Años */}
                          <Box sx={{ mb: 1.5, bgcolor: '#f8fafc', p: 1.2, borderRadius: 2, border: '1px solid #e2e8f0' }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.6 }}>
                              <Typography sx={{ fontSize: 10.5, fontWeight: 850, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                                Ciclo 7 Años Vigencia
                              </Typography>
                              <Typography sx={{ fontSize: 11, fontWeight: 900, color: row.semaforo.color }}>
                                {row.semaforo.aniosTranscurridos}a / 7.0a ({row.semaforo.progresoCicloPct}%)
                              </Typography>
                            </Stack>
                            <LinearProgress
                              variant="determinate"
                              value={Math.min(100, Math.max(0, row.semaforo.progresoCicloPct))}
                              sx={{
                                height: 7,
                                borderRadius: 4,
                                bgcolor: '#e2e8f0',
                                '& .MuiLinearProgress-bar': {
                                  bgcolor: row.semaforo.color,
                                  borderRadius: 4
                                }
                              }}
                            />
                            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mt: 0.5 }}>
                              <Typography sx={{ fontSize: 10, color: '#64748b' }}>
                                Inicio ciclo
                              </Typography>
                              <Typography sx={{ fontSize: 10, color: '#64748b', fontWeight: 700 }}>
                                Vence {formatDate(row.fechaVencimientoRc)}
                              </Typography>
                            </Stack>
                          </Box>

                          {/* Cuadrícula 2x2 de Hitos Normativos */}
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: 'repeat(2, 1fr)',
                              gap: 0.9,
                              p: 1.1,
                              borderRadius: 2,
                              bgcolor: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              mb: 1
                            }}
                          >
                            <Box>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, fontSize: 10, display: 'flex', alignItems: 'center' }}>
                                <DescriptionIcon sx={{ fontSize: 12, mr: 0.4, color: '#64748b' }} /> Resolución MEN
                              </Typography>
                              <Typography sx={{ fontWeight: 850, fontSize: 11.5, color: '#0f172a' }}>
                                {row.numeroResolucion ? `Res. ${row.numeroResolucion}` : '-'}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, fontSize: 10, display: 'flex', alignItems: 'center' }}>
                                <EventAvailableIcon sx={{ fontSize: 12, mr: 0.4, color: '#64748b' }} /> Vencimiento RC
                              </Typography>
                              <Typography sx={{ fontWeight: 850, fontSize: 11.5, color: '#0f172a' }}>
                                {formatDate(row.fechaVencimientoRc)}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800, fontSize: 10, display: 'flex', alignItems: 'center' }}>
                                <AssignmentIcon sx={{ fontSize: 12, mr: 0.4, color: '#b45309' }} /> Doc. RRC (26m)
                              </Typography>
                              <Typography sx={{ fontWeight: 850, fontSize: 11.5, color: '#b45309' }}>
                                {row.semaforo.fechaDocRrcStr}
                              </Typography>
                            </Box>
                            <Box>
                              <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 800, fontSize: 10, display: 'flex', alignItems: 'center' }}>
                                <ScheduleIcon sx={{ fontSize: 12, mr: 0.4, color: '#b91c1c' }} /> Límite SACES (14m)
                              </Typography>
                              <Typography sx={{ fontWeight: 900, fontSize: 11.5, color: '#b91c1c' }}>
                                {row.semaforo.fechaSacesStr}
                              </Typography>
                            </Box>
                          </Box>

                          {/* BANNER DISTINTIVO: PLAN DE CONTINGENCIA O RENOVACIÓN MEN */}
                          {row.semaforo.isContingencia && (
                            <Box
                              sx={{
                                mt: 0.5,
                                p: 1.2,
                                borderRadius: 2,
                                bgcolor: row.semaforo.bg,
                                border: `1.5px solid ${row.semaforo.border}`
                              }}
                            >
                              <Stack direction="row" spacing={0.8} alignItems="center" sx={{ mb: 0.3 }}>
                                {row.semaforo.contingenciaEstado === 'PENDIENTE_RADICAR' ? (
                                  <HourglassTopIcon sx={{ fontSize: 16, color: '#dc2626' }} />
                                ) : row.semaforo.contingenciaEstado === 'RADICADO' ? (
                                  <FactCheckIcon sx={{ fontSize: 16, color: '#0284c7' }} />
                                ) : row.semaforo.contingenciaEstado === 'EN_EJECUCION' ? (
                                  <WarningIcon sx={{ fontSize: 16, color: '#c2410c' }} />
                                ) : (
                                  <CheckCircleIcon sx={{ fontSize: 16, color: '#475569' }} />
                                )}
                                <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: row.semaforo.color }}>
                                  {row.semaforo.contingenciaEstado === 'PENDIENTE_RADICAR'
                                    ? 'Plan de Contingencia por Radicar (≤ 2 meses)'
                                    : row.semaforo.contingenciaEstado === 'RADICADO'
                                    ? 'Plan Radicado ante el MEN'
                                    : row.semaforo.contingenciaEstado === 'EN_EJECUCION'
                                    ? 'En Plan de Contingencia Activo'
                                    : 'Programa Culminado y Cerrado'}
                                </Typography>
                              </Stack>
                              <Typography sx={{ fontSize: 11, color: '#334155', fontWeight: 700 }}>
                                {row.semaforo.contingenciaEstado === 'PENDIENTE_RADICAR' && (
                                  <>Acto: {row.actoAdministrativoNoRenovacion || 'Registrado'} · Vence radicación: {formatDate(row.fechaLimiteRadicarContingencia)}</>
                                )}
                                {row.semaforo.contingenciaEstado === 'RADICADO' && (
                                  <>Radicado el {formatDate(row.fechaRadicacionContingencia)} (En evaluación MEN)</>
                                )}
                                {row.semaforo.contingenciaEstado === 'EN_EJECUCION' && (
                                  <>Cohortes garantizadas: {formatDate(row.fechaInicioContingencia)} al {formatDate(row.fechaFinContingencia)}</>
                                )}
                                {row.semaforo.contingenciaEstado === 'FINALIZADO' && (
                                  <>Todas las cohortes académicas fueron culminadas</>
                                )}
                              </Typography>
                            </Box>
                          )}

                          {row.decisionTipo === 'RENOVADO_MEN' && (
                            <Box sx={{ mt: 0.5, p: 1.2, borderRadius: 2, bgcolor: '#f0fdf4', border: '1.5px solid #86efac' }}>
                              <Stack direction="row" spacing={0.8} alignItems="center">
                                <CheckCircleIcon sx={{ fontSize: 16, color: '#16a34a' }} />
                                <Typography sx={{ fontSize: 11.5, fontWeight: 900, color: '#166534' }}>
                                  Renovación Otorgada por el MEN
                                </Typography>
                              </Stack>
                              <Typography sx={{ fontSize: 10.5, color: '#14532d', mt: 0.2 }}>
                                Nuevo ciclo de 7 años activo · No aplica plan de contingencia
                              </Typography>
                            </Box>
                          )}
                        </CardContent>

                        {/* Botones de Acción de la Tarjeta */}
                        <Box
                          sx={{
                            p: 1.8,
                            pt: 0,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1
                          }}
                        >
                          <Button
                            variant="contained"
                            fullWidth
                            size="small"
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => handleOpenExpediente(row)}
                            sx={{
                              bgcolor: '#0f172a',
                              color: '#fff',
                              fontWeight: 850,
                              fontSize: 12,
                              borderRadius: 2.2,
                              py: 0.9,
                              textTransform: 'none',
                              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.25)',
                              '&:hover': { bgcolor: '#1e3a8a' }
                            }}
                          >
                            Ver Expediente y Ciclo
                          </Button>

                          <Tooltip title="Notificar alerta por correo a Planeación">
                            <IconButton
                              size="small"
                              onClick={() => handleOpenNotification(row)}
                              sx={{
                                border: '1px solid #fecaca',
                                bgcolor: '#fff5f5',
                                color: '#dc2626',
                                borderRadius: 2,
                                p: 0.85,
                                '&:hover': { bgcolor: '#fee2e2' }
                              }}
                            >
                              <EmailIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>

                          {row.enlaceResolucion && (
                            <Tooltip title="Abrir Resolución Original">
                              <IconButton
                                size="small"
                                onClick={() => window.open(row.enlaceResolucion, '_blank', 'noopener,noreferrer')}
                                sx={{
                                  border: '1px solid #dbeafe',
                                  bgcolor: '#eff6ff',
                                  color: '#1d4ed8',
                                  borderRadius: 2,
                                  p: 0.85,
                                  '&:hover': { bgcolor: '#dbeafe' }
                                }}
                              >
                                <OpenInNewIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                        </Box>
                      </Card>
                    );
                  })}
                </Box>
              )}
            </Box>
          )}

          {/* ======================================================= */}
          {/* VISTA 1: MONITOR EJECUTIVO SEMAFÓRICO (TABLA REDUCIDA)  */}
          {/* ======================================================= */}
          {monitorViewMode === 'semaforo' && (
            <Stack spacing={1.5}>

              {/* TABLA REDUCIDA DE MONITOREO EJECUTIVO */}
              <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', overflow: 'hidden', bgcolor: '#fff' }}>
                <Box sx={{ px: 2, py: 1.3, bgcolor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                    Monitor de Programas Académicos ({filteredMonitoreoItems.length} registros en vista)
                  </Typography>
                  <Typography sx={{ color: '#bfdbfe', fontSize: 12, fontWeight: 700 }}>
                    Norma: Elaborar RRC (26m) · Radicar SACES (14m)
                  </Typography>
                </Box>
                <TableContainer sx={{ maxHeight: 620, overflowX: 'auto' }}>
                  <Table size="small" stickyHeader sx={{ minWidth: 1050, '& .MuiTableCell-root': { fontSize: 12.5, py: 1, px: 1.4 } }}>
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ width: 45, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>No.</TableCell>
                        <TableCell sx={{ width: 175, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Semáforo</TableCell>
                        <TableCell sx={{ width: 280, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Programa Académico</TableCell>
                        <TableCell sx={{ width: 125, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Nivel</TableCell>
                        <TableCell sx={{ width: 115, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Vencimiento RC</TableCell>
                        <TableCell sx={{ width: 125, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Tiempo Restante</TableCell>
                        <TableCell sx={{ width: 125, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Inicio Doc. RRC (26m)</TableCell>
                        <TableCell sx={{ width: 125, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Límite SACES (14m)</TableCell>
                        <TableCell align="center" sx={{ width: 130, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Cuenta Regresiva</TableCell>
                        <TableCell align="center" sx={{ width: 95, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {resolucionesLoading ? (
                        <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6 }}><CircularProgress size={30} /></TableCell></TableRow>
                      ) : filteredMonitoreoItems.length === 0 ? (
                        <TableRow><TableCell colSpan={10} align="center" sx={{ py: 6 }}>No hay registros coincidentes con los filtros seleccionados.</TableCell></TableRow>
                      ) : (
                        filteredMonitoreoItems.map((row, idx) => (
                          <TableRow key={row.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                            <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>{row.consecutivo || idx + 1}</TableCell>
                            <TableCell>
                              <Chip
                                label={row.semaforo.badgeText}
                                size="small"
                                sx={{
                                  bgcolor: row.semaforo.bg,
                                  color: row.semaforo.color,
                                  border: `1px solid ${row.semaforo.border}`,
                                  fontWeight: 900,
                                  fontSize: 11.5,
                                  height: 24
                                }}
                              />
                            </TableCell>
                            <TableCell>
                              <Typography sx={{ fontWeight: 850, fontSize: 13, color: '#0f172a', lineHeight: 1.25 }}>
                                {row.nombrePrograma}
                              </Typography>
                              <Stack direction="row" spacing={0.6} alignItems="center" flexWrap="wrap" sx={{ mt: 0.4, gap: 0.5 }}>
                                {row.codigoSnies && (
                                  <Chip
                                    label={`SNIES ${row.codigoSnies}`}
                                    size="small"
                                    sx={{ fontSize: 10, fontWeight: 800, height: 20, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                                  />
                                )}
                                {row.numeroEstudiantes ? (
                                  <Chip
                                    icon={<PeopleIcon sx={{ fontSize: '13px !important', color: '#1e40af !important' }} />}
                                    label={`${formatNumber(row.numeroEstudiantes)} cupos`}
                                    size="small"
                                    sx={{ fontSize: 10, fontWeight: 800, height: 20, bgcolor: '#eff6ff', color: '#1e40af' }}
                                  />
                                ) : null}
                                {row.creditos ? (
                                  <Chip
                                    icon={<MenuBookIcon sx={{ fontSize: '12px !important', color: '#0f766e !important' }} />}
                                    label={`${row.creditos} cr.`}
                                    size="small"
                                    sx={{ fontSize: 10, fontWeight: 800, height: 20, bgcolor: '#f0fdf4', color: '#0f766e' }}
                                  />
                                ) : null}
                                {row.numeroResolucion && (
                                  <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                                    Res. {row.numeroResolucion}
                                  </Typography>
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 700, color: '#475569', fontSize: 12 }}>
                              {row.nivelFormacion || '-'}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 900, color: '#0f172a' }}>
                              {formatDate(row.fechaVencimientoRc)}
                            </TableCell>
                            <TableCell sx={{ fontWeight: 800, color: row.semaforo.color }}>
                              {row.semaforo.tiempoRestanteStr}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, color: '#475569' }}>
                              {row.semaforo.fechaDocRrcStr}
                            </TableCell>
                            <TableCell sx={{ fontSize: 12, fontWeight: 750, color: '#0f172a' }}>
                              {row.semaforo.fechaSacesStr}
                            </TableCell>
                            <TableCell align="center">
                              {renderSacesBadge(row.semaforo.sacesDiffDays !== null ? row.semaforo.sacesDiffDays : row.fechaMaximaRadicarSaces)}
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={0.4} justifyContent="center">
                                <Tooltip title="Ver Expediente y Ciclo">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    onClick={() => handleOpenExpediente(row)}
                                  >
                                    <TimelineIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                                {row.enlaceResolucion ? (
                                  <Tooltip title="Abrir Resolución">
                                    <IconButton
                                      size="small"
                                      color="primary"
                                      onClick={() => window.open(row.enlaceResolucion, '_blank', 'noopener,noreferrer')}
                                    >
                                      <OpenInNewIcon fontSize="inherit" />
                                    </IconButton>
                                  </Tooltip>
                                ) : null}
                                <Tooltip title="Notificar alerta por correo a Planeación">
                                  <IconButton
                                    size="small"
                                    sx={{ color: '#dc2626' }}
                                    onClick={() => handleOpenNotification(row)}
                                  >
                                    <EmailIcon fontSize="inherit" />
                                  </IconButton>
                                </Tooltip>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Paper>
            </Stack>
          )}

          {/* ======================================================= */}
          {/* VISTA 2: MATRIZ COMPLETA DE RESOLUCIONES (17 COLUMNAS) */}
          {/* ======================================================= */}
          {monitorViewMode === 'matriz' && (
            <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5', overflow: 'hidden', bgcolor: '#fff' }}>
              <Box sx={{ px: 2, py: 1.3, bgcolor: '#1e3a8a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography sx={{ color: '#fff', fontWeight: 900, fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.4 }}>
                  Matriz Completa de Resoluciones y Vencimientos RC ({filteredMonitoreoItems.length} registros)
                </Typography>
              </Box>
              <TableContainer sx={{ maxHeight: 620, overflowX: 'auto' }}>
                <Table size="small" stickyHeader sx={{ minWidth: 1680, '& .MuiTableCell-root': { fontSize: 12, py: 0.85, px: 1.2 } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ width: 45, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>No.</TableCell>
                      <TableCell sx={{ width: 130, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Nivel formación</TableCell>
                      <TableCell sx={{ width: 85, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>SNIES</TableCell>
                      <TableCell sx={{ width: 240, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Programa académico</TableCell>
                      <TableCell align="center" sx={{ width: 70, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Cupos</TableCell>
                      <TableCell align="center" sx={{ width: 60, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Cr.</TableCell>
                      <TableCell align="center" sx={{ width: 60, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Sem.</TableCell>
                      <TableCell sx={{ width: 135, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>No. Resolución</TableCell>
                      <TableCell align="center" sx={{ width: 80, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Enlace</TableCell>
                      <TableCell sx={{ width: 105, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Fecha RRC</TableCell>
                      <TableCell sx={{ width: 115, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Vencimiento RC</TableCell>
                      <TableCell sx={{ width: 120, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Límite doc. RRC</TableCell>
                      <TableCell sx={{ width: 125, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Sugerida SACES</TableCell>
                      <TableCell align="center" sx={{ width: 125, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Límite SACES</TableCell>
                      <TableCell align="center" sx={{ width: 110, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Vigencia RC</TableCell>
                      <TableCell sx={{ width: 220, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Novedades vigencia</TableCell>
                      <TableCell sx={{ width: 180, fontWeight: 900, bgcolor: '#f8fafc', color: '#334155' }}>Observaciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {resolucionesLoading ? (
                      <TableRow><TableCell colSpan={17} align="center" sx={{ py: 6 }}><CircularProgress size={30} /></TableCell></TableRow>
                    ) : filteredMonitoreoItems.length === 0 ? (
                      <TableRow><TableCell colSpan={17} align="center" sx={{ py: 6 }}>No hay resoluciones registradas o coincidentes con los filtros.</TableCell></TableRow>
                    ) : (
                      filteredMonitoreoItems.map((row) => (
                        <TableRow key={row.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>{row.consecutivo || '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 700, color: '#475569' }}>{row.nivelFormacion || '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#1d4ed8' }}>{row.codigoSnies || '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 850, color: '#0f172a' }}>{row.nombrePrograma}</TableCell>
                          <TableCell align="center">{row.numeroEstudiantes ?? '-'}</TableCell>
                          <TableCell align="center">{row.creditos ?? '-'}</TableCell>
                          <TableCell align="center">{row.semestres ?? '-'}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{row.numeroResolucion || '-'}</TableCell>
                          <TableCell align="center">
                            {row.enlaceResolucion ? (
                              <Tooltip title="Abrir enlace de resolución">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => window.open(row.enlaceResolucion, '_blank', 'noopener,noreferrer')}
                                >
                                  <OpenInNewIcon fontSize="inherit" />
                                </IconButton>
                              </Tooltip>
                            ) : '-'}
                          </TableCell>
                          <TableCell>{formatDate(row.fechaRrc)}</TableCell>
                          <TableCell sx={{ fontWeight: 800, color: '#0f172a' }}>{formatDate(row.fechaVencimientoRc)}</TableCell>
                          <TableCell>{formatDate(row.fechaMaximaDocumentoRrc)}</TableCell>
                          <TableCell>{formatDate(row.fechaSugeridaRadicarSaces)}</TableCell>
                          <TableCell align="center">{renderSacesBadge(row.fechaMaximaRadicarSaces)}</TableCell>
                          <TableCell align="center">{row.fechaRegistroCalificado || '-'}</TableCell>
                          <TableCell>
                            {row.novedadesVigencia ? (
                              <Box
                                sx={{
                                  maxWidth: 220,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  cursor: 'pointer',
                                  color: '#1d4ed8',
                                  '&:hover': { textDecoration: 'underline' }
                                }}
                                onClick={() => setDetailModal({ open: true, title: 'Novedades de Vigencia', content: row.novedadesVigencia })}
                              >
                                {row.novedadesVigencia}
                              </Box>
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            {row.observaciones ? (
                              <Box
                                sx={{
                                  maxWidth: 180,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  cursor: 'pointer',
                                  color: '#475569',
                                  '&:hover': { textDecoration: 'underline' }
                                }}
                                onClick={() => setDetailModal({ open: true, title: 'Observaciones', content: row.observaciones })}
                              >
                                {row.observaciones}
                              </Box>
                            ) : '-'}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          )}
        </Stack>
      )}

      {/* MODAL INTEGRAL DE EXPEDIENTE Y GESTIÓN DEL CICLO DE VIDA DEL PROGRAMA */}
      <Dialog
        open={expedienteModal.open}
        onClose={() => !expedienteModal.loading && setExpedienteModal((prev) => ({ ...prev, open: false }))}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle sx={{ p: 2.5, background: 'linear-gradient(135deg, #091e3a 0%, #1e3a8a 100%)', color: '#fff' }}>
          <Stack direction="row" spacing={1.5} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ p: 1.1, borderRadius: 2.2, bgcolor: 'rgba(255, 255, 255, 0.12)', display: 'flex', alignItems: 'center' }}>
                <TimelineIcon sx={{ fontSize: 28, color: '#93c5fd' }} />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography sx={{ fontWeight: 950, fontSize: 18, color: '#fff' }}>
                    Expediente y Ciclo de Vida del Programa
                  </Typography>
                  {expedienteModal.item?.consecutivo && (
                    <Chip
                      label={`Registro No. ${expedienteModal.item.consecutivo}`}
                      size="small"
                      sx={{
                        fontWeight: 900,
                        fontSize: 11,
                        bgcolor: 'rgba(255, 255, 255, 0.18)',
                        color: '#fff',
                        height: 22
                      }}
                    />
                  )}
                  {expedienteModal.item?.semaforo && (
                    <Chip
                      label={expedienteModal.item.semaforo.badgeText}
                      size="small"
                      sx={{
                        fontWeight: 900,
                        fontSize: 11,
                        bgcolor: expedienteModal.item.semaforo.color,
                        color: '#fff',
                        height: 22
                      }}
                    />
                  )}
                </Stack>
                <Typography sx={{ fontSize: 13, color: '#bfdbfe', mt: 0.3 }}>
                  {expedienteModal.item?.nombrePrograma || 'Programa Académico'} · SNIES {expedienteModal.item?.codigoSnies || '-'} · {expedienteModal.item?.nivelFormacion || 'Pregrado'}
                </Typography>
              </Box>
            </Stack>
            <IconButton
              size="small"
              onClick={() => !expedienteModal.loading && setExpedienteModal((prev) => ({ ...prev, open: false }))}
              sx={{ color: '#fff', '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.15)' } }}
            >
              <ClearIcon />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 2.5, bgcolor: '#f8fafc' }}>
          <Stack spacing={2.5}>
            {/* PANEL 1: FICHA ACADÉMICA Y CAPACIDAD AUTORIZADA */}
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e293b', mb: 1.2, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <SchoolIcon sx={{ color: '#1e3a8a', fontSize: 20 }} />
                Ficha Académica y Capacidad Autorizada por el MEN
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                {/* 1. CUPOS DE ESTUDIANTES */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #bfdbfe', bgcolor: '#f0f7ff' }}>
                  <Typography variant="caption" sx={{ color: '#1e40af', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <PeopleIcon sx={{ fontSize: 14, mr: 0.6, color: '#1e40af' }} /> Cupos Autorizados
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 17, color: '#1e3a8a', mt: 0.5 }}>
                    {expedienteModal.item?.numeroEstudiantes ? `${formatNumber(expedienteModal.item.numeroEstudiantes)} cupos` : 'No registra'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, mt: 0.3, display: 'block' }}>
                    Capacidad de matrícula por cohorte
                  </Typography>
                </Paper>

                {/* 2. CRÉDITOS ACADÉMICOS */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #bbf7d0', bgcolor: '#f0fdf4' }}>
                  <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <MenuBookIcon sx={{ fontSize: 14, mr: 0.6, color: '#15803d' }} /> Créditos Académicos
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 17, color: '#166534', mt: 0.5 }}>
                    {expedienteModal.item?.creditos ? `${expedienteModal.item.creditos} créditos` : 'No registra'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, mt: 0.3, display: 'block' }}>
                    Plan de estudios curricular oficial
                  </Typography>
                </Paper>

                {/* 3. DURACIÓN EN SEMESTRES */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #e9d5ff', bgcolor: '#faf5ff' }}>
                  <Typography variant="caption" sx={{ color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <DateRangeIcon sx={{ fontSize: 14, mr: 0.6, color: '#7e22ce' }} /> Duración Estimada
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 17, color: '#6b21a8', mt: 0.5 }}>
                    {expedienteModal.item?.semestres ? `${expedienteModal.item.semestres} semestres` : 'No registra'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, mt: 0.3, display: 'block' }}>
                    Periodicidad académica regular
                  </Typography>
                </Paper>

                {/* 4. NIVEL Y REGISTRO */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #e2e8f0', bgcolor: '#fff' }}>
                  <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <SchoolIcon sx={{ fontSize: 14, mr: 0.6, color: '#475569' }} /> Nivel y SNIES
                  </Typography>
                  <Typography sx={{ fontWeight: 900, fontSize: 15, color: '#0f172a', mt: 0.5 }}>
                    {expedienteModal.item?.nivelFormacion || 'Pregrado'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#1d4ed8', fontSize: 11, fontWeight: 750, mt: 0.3, display: 'block' }}>
                    SNIES {expedienteModal.item?.codigoSnies || '-'} · No. {expedienteModal.item?.consecutivo || '1'}
                  </Typography>
                </Paper>
              </Box>
            </Box>

            {/* PANEL 2: ACTO ADMINISTRATIVO E HITOS REGULATORIOS (DECRETO 1330) */}
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e293b', mb: 1.2, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <FactCheckIcon sx={{ color: '#1e3a8a', fontSize: 20 }} />
                Acto Administrativo y Cronograma Regulatorio MEN (Decreto 1330 de 2019)
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(4, 1fr)' }, gap: 1.5 }}>
                {/* 1. RESOLUCIÓN MEN ACTUAL */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #dbeafe', bgcolor: '#fff' }}>
                  <Typography variant="caption" sx={{ color: '#1d4ed8', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <DescriptionIcon sx={{ fontSize: 14, mr: 0.6, color: '#1d4ed8' }} /> Resolución MEN Actual
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 15, color: '#1d4ed8', mt: 0.5 }}>
                    {expedienteModal.item?.numeroResolucion ? `Res. ${expedienteModal.item.numeroResolucion}` : '-'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, mt: 0.3, display: 'block' }}>
                    Expedida: {formatDate(expedienteModal.item?.fechaRrc || expedienteModal.item?.fechaResolucion)}
                  </Typography>
                </Paper>

                {/* 2. VENCIMIENTO RC (7 AÑOS) */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #fecaca', bgcolor: '#fff' }}>
                  <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <ScheduleIcon sx={{ fontSize: 14, mr: 0.6, color: '#b91c1c' }} /> Vencimiento RC (7 años)
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 15, color: '#b91c1c', mt: 0.5 }}>
                    {formatDate(expedienteModal.item?.fechaVencimientoRc)}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#dc2626', fontSize: 11, fontWeight: 750, mt: 0.3, display: 'block' }}>
                    {expedienteModal.item?.semaforo?.tiempoRestanteStr || 'Seguimiento'}
                  </Typography>
                </Paper>

                {/* 3. LÍMITE DOC. RRC (26M) */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #fed7aa', bgcolor: '#fff' }}>
                  <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <AssignmentIcon sx={{ fontSize: 14, mr: 0.6, color: '#b45309' }} /> Límite Doc. RRC (26m)
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 15, color: '#b45309', mt: 0.5 }}>
                    {formatDate(expedienteModal.item?.fechaMaximaDocumentoRrc) || expedienteModal.item?.semaforo?.fechaDocRrcStr || 'No registra'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, mt: 0.3, display: 'block' }}>
                    Sugerida SACES: {formatDate(expedienteModal.item?.fechaSugeridaRadicarSaces) || '-'}
                  </Typography>
                </Paper>

                {/* 4. LÍMITE RADICAR SACES (14M) */}
                <Paper elevation={0} sx={{ p: 1.8, borderRadius: 2.2, border: '1.5px solid #fca5a5', bgcolor: '#fff' }}>
                  <Typography variant="caption" sx={{ color: '#b91c1c', fontWeight: 800, textTransform: 'uppercase', fontSize: 10.5, display: 'flex', alignItems: 'center' }}>
                    <HourglassTopIcon sx={{ fontSize: 14, mr: 0.6, color: '#b91c1c' }} /> Límite Radicar SACES (14m)
                  </Typography>
                  <Typography sx={{ fontWeight: 950, fontSize: 15, color: '#b91c1c', mt: 0.5 }}>
                    {formatDate(expedienteModal.item?.fechaMaximaRadicarSaces) || expedienteModal.item?.semaforo?.fechaSacesStr || 'No registra'}
                  </Typography>
                  <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, mt: 0.3, display: 'block' }}>
                    Vigencia: {expedienteModal.item?.fechaRegistroCalificado || '7 años reglamentarios'}
                  </Typography>
                </Paper>
              </Box>
            </Box>

            {/* EXPEDIENTE DIGITAL: ENLACE / ARCHIVO DE RESOLUCIÓN */}
            {expedienteModal.item?.enlaceResolucion && (
              <Paper
                elevation={0}
                sx={{
                  p: 1.8,
                  borderRadius: 2.2,
                  border: '1.5px solid #cbd5e1',
                  bgcolor: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 1.5
                }}
              >
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box sx={{ p: 1, borderRadius: 2, bgcolor: '#eff6ff', color: '#1e3a8a', display: 'flex', alignItems: 'center' }}>
                    <DescriptionIcon sx={{ fontSize: 24 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 850, fontSize: 12.5, color: '#64748b', textTransform: 'uppercase' }}>
                      Documento Oficial de la Resolución
                    </Typography>
                    <Typography sx={{ fontWeight: 900, fontSize: 14, color: '#0f172a', mt: 0.2 }}>
                      {expedienteModal.item.enlaceResolucion}
                    </Typography>
                  </Box>
                </Stack>
                {expedienteModal.item.enlaceResolucion.startsWith('http') ? (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => window.open(expedienteModal.item.enlaceResolucion, '_blank', 'noopener,noreferrer')}
                    sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                  >
                    Abrir Documento
                  </Button>
                ) : (
                  <Chip
                    icon={<CheckCircleIcon sx={{ fontSize: '15px !important', color: '#166534 !important' }} />}
                    label="Archivo Oficial Custodiado en SGC"
                    size="small"
                    sx={{ fontWeight: 850, fontSize: 11, bgcolor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0' }}
                  />
                )}
              </Paper>
            )}

            {/* NOVEDADES DE VIGENCIA (DECRETOS TRANSITORIOS / PRÓRROGAS) */}
            {expedienteModal.item?.novedadesVigencia && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1.5px solid #fde68a',
                  bgcolor: '#fffbeb'
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <InfoIcon sx={{ fontSize: 22, color: '#b45309', mt: 0.2, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#92400e', mb: 0.4 }}>
                      Novedades de Vigencia y Régimen Transitorio (Decreto 1174/2023 / Decreto 1330 / MEN)
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#78350f', lineHeight: 1.5, fontWeight: 550 }}>
                      {expedienteModal.item.novedadesVigencia}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* OBSERVACIONES INSTITUCIONALES */}
            {expedienteModal.item?.observaciones && (
              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 2.5,
                  border: '1.5px solid #cbd5e1',
                  bgcolor: '#f8fafc'
                }}
              >
                <Stack direction="row" spacing={1.2} alignItems="flex-start">
                  <NotesIcon sx={{ fontSize: 22, color: '#475569', mt: 0.2, flexShrink: 0 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e293b', mb: 0.4 }}>
                      Observaciones y Anotaciones Técnicas Institucionales
                    </Typography>
                    <Typography sx={{ fontSize: 12.5, color: '#334155', lineHeight: 1.5 }}>
                      {expedienteModal.item.observaciones}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            {/* PANEL DE TRAZABILIDAD HISTÓRICA DE DENOMINACIÓN Y EVOLUCIÓN DEL PROGRAMA */}
            <Paper
              elevation={0}
              sx={{
                p: 2.2,
                borderRadius: 2.5,
                border: '1.5px solid #dbe6f5',
                bgcolor: '#fff'
              }}
            >
              <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
                <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e293b', display: 'flex', alignItems: 'center', gap: 0.8 }}>
                  <HistoryEduIcon sx={{ color: '#1e3a8a', fontSize: 22 }} />
                  Trazabilidad Histórica de Denominación y Evolución Académica
                </Typography>
                {expedienteModal.item?.historialDenominaciones && expedienteModal.item.historialDenominaciones.length > 0 && (
                  <Chip
                    label={`${expedienteModal.item.historialDenominaciones.length} Cambio(s) de Denominación`}
                    size="small"
                    sx={{ fontWeight: 900, fontSize: 10.5, bgcolor: '#eff6ff', color: '#1d4ed8' }}
                  />
                )}
              </Stack>

              {expedienteModal.item?.historialDenominaciones && expedienteModal.item.historialDenominaciones.length > 0 ? (
                <Stack spacing={1.5}>
                  {expedienteModal.item.historialDenominaciones.map((hito, hIdx) => (
                    <Paper
                      key={hIdx}
                      variant="outlined"
                      sx={{
                        p: 1.8,
                        borderRadius: 2.2,
                        bgcolor: '#f8fafc',
                        border: '1.5px solid #cbd5e1'
                      }}
                    >
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ sm: 'center' }} sx={{ mb: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={`Hito Histórico #${hIdx + 1}`}
                            size="small"
                            sx={{ fontWeight: 900, fontSize: 11, bgcolor: '#1e3a8a', color: '#fff', height: 22 }}
                          />
                          <Typography sx={{ fontWeight: 900, fontSize: 13, color: '#0f172a' }}>
                            Periodo: {hito.periodo || `${hito.anioInicio} - ${hito.anioFin}`}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, fontWeight: 700 }}>
                          Fecha de Resolución: {formatDate(hito.fechaResolucion || hito.fechaRegistro)}
                        </Typography>
                      </Stack>

                      <Grid container spacing={1.5} alignItems="center">
                        <Grid item xs={12} sm={5}>
                          <Box sx={{ p: 1.4, borderRadius: 1.8, bgcolor: '#fff', border: '1px solid #e2e8f0' }}>
                            <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800, textTransform: 'uppercase', fontSize: 10 }}>
                              Denominación Anterior
                            </Typography>
                            <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#334155', mt: 0.3 }}>
                              {hito.denominacionAnterior}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11, mt: 0.3, display: 'block' }}>
                              {hito.resolucionAnterior || 'Bajo resolución previa'}
                            </Typography>
                          </Box>
                        </Grid>

                        <Grid item xs={12} sm={2} sx={{ textAlign: 'center' }}>
                          <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.6}>
                            <Typography sx={{ fontSize: 11, fontWeight: 900, color: '#1e3a8a', textTransform: 'uppercase' }}>Cambio</Typography>
                            <ArrowForwardIcon sx={{ fontSize: 17, color: '#1e3a8a' }} />
                          </Stack>
                        </Grid>

                        <Grid item xs={12} sm={5}>
                          <Box sx={{ p: 1.4, borderRadius: 1.8, bgcolor: '#f0fdf4', border: '1.5px solid #bbf7d0' }}>
                            <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800, textTransform: 'uppercase', fontSize: 10 }}>
                              Nueva Denominación Aprobada
                            </Typography>
                            <Typography sx={{ fontWeight: 950, fontSize: 13.5, color: '#166534', mt: 0.3 }}>
                              {hito.nuevaDenominacion}
                            </Typography>
                            <Typography variant="caption" sx={{ color: '#16a34a', fontSize: 11, fontWeight: 750, mt: 0.3, display: 'block' }}>
                              {hito.resolucionNueva || 'Resolución de Renovación MEN'}
                            </Typography>
                          </Box>
                        </Grid>
                      </Grid>

                      {hito.observacion && (
                        <Box sx={{ mt: 1.2, p: 1, borderRadius: 1.5, bgcolor: '#fff', border: '1px solid #f1f5f9' }}>
                          <Typography sx={{ fontSize: 11.5, color: '#475569', lineHeight: 1.4, fontStyle: 'italic' }}>
                            {hito.observacion}
                          </Typography>
                        </Box>
                      )}
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Box
                  sx={{
                    p: 1.6,
                    borderRadius: 2,
                    bgcolor: '#f8fafc',
                    border: '1px dashed #cbd5e1',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5
                  }}
                >
                  <Box sx={{ p: 0.8, borderRadius: 1.5, bgcolor: '#eff6ff', color: '#1e3a8a', display: 'flex', alignItems: 'center' }}>
                    <FactCheckIcon sx={{ fontSize: 22 }} />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 850, fontSize: 12.5, color: '#0f172a' }}>
                      Denominación Única e Histórica Vigente
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#64748b', mt: 0.2 }}>
                      El programa académico se ha ofertado bajo el nombre oficial <strong>«{expedienteModal.item?.nombrePrograma}»</strong> desde su otorgamiento inicial (SNIES {expedienteModal.item?.codigoSnies || '-'}), sin modificaciones de denominación ante el MEN.
                    </Typography>
                  </Box>
                </Box>
              )}
            </Paper>

            {/* TIMELINE / STEPPER DE 5 ETAPAS NORMATIVAS (DECRETO 1330) */}
            <Paper elevation={0} sx={{ p: 2.2, borderRadius: 2.5, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
              <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#1e293b', mb: 1.8, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                <AccountTreeIcon sx={{ color: '#1e3a8a', fontSize: 20 }} />
                Línea de Tiempo Regulatoria (Decreto 1330 de 2019 / MEN)
              </Typography>

              <Stepper
                activeStep={
                  expedienteModal.decisionTipo === 'RENOVADO_MEN' ? 4
                  : expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' || expedienteModal.decisionTipo === 'NEGADO_MEN' ? 4
                  : expedienteModal.item?.semaforo?.diffMonths <= 14 ? 2
                  : expedienteModal.item?.semaforo?.diffMonths <= 26 ? 1
                  : 0
                }
                alternativeLabel
                sx={{
                  '& .MuiStepLabel-label': { fontSize: 11.5, fontWeight: 750, color: '#475569' },
                  '& .Mui-active .MuiStepLabel-label': { color: '#1e3a8a', fontWeight: 900 },
                  '& .Mui-completed .MuiStepLabel-label': { color: '#166534', fontWeight: 850 }
                }}
              >
                <Step key="s1" completed={Boolean(expedienteModal.item?.fechaRrc)}>
                  <StepLabel>
                    Etapa 1: Otorgamiento RC
                    <Typography variant="caption" display="block" sx={{ color: '#64748b', fontSize: 10.5 }}>
                      Vigencia legal 7 años
                    </Typography>
                  </StepLabel>
                </Step>
                <Step key="s2" completed={Boolean(expedienteModal.item?.semaforo?.diffMonths <= 26)}>
                  <StepLabel>
                    Etapa 2: Alerta 26m
                    <Typography variant="caption" display="block" sx={{ color: '#b45309', fontSize: 10.5 }}>
                      Elaboración Doc. RRC
                    </Typography>
                  </StepLabel>
                </Step>
                <Step key="s3" completed={Boolean(expedienteModal.item?.semaforo?.diffMonths <= 14)}>
                  <StepLabel>
                    Etapa 3: Límite 14m SACES
                    <Typography variant="caption" display="block" sx={{ color: '#b91c1c', fontSize: 10.5, fontWeight: 800 }}>
                      Radicación en MEN
                    </Typography>
                  </StepLabel>
                </Step>
                <Step key="s4" completed={expedienteModal.decisionTipo !== 'EN_CICLO'}>
                  <StepLabel>
                    Etapa 4: Decisión / MEN
                    <Typography variant="caption" display="block" sx={{ color: '#64748b', fontSize: 10.5 }}>
                      Renovar / No Renovar
                    </Typography>
                  </StepLabel>
                </Step>
                <Step key="s5" completed={expedienteModal.estadoContingencia === 'FINALIZADO'}>
                  <StepLabel>
                    Etapa 5: Contingencia / Cierre
                    <Typography variant="caption" display="block" sx={{ color: '#991b1b', fontSize: 10, fontWeight: 800 }}>
                      (Sólo si No Renueva o es Negado)
                    </Typography>
                  </StepLabel>
                </Step>
              </Stepper>
            </Paper>

            {/* FORMULARIO DE PARAMETRIZACIÓN Y DECISIONES */}
            <Paper elevation={0} sx={{ p: 2.2, borderRadius: 2.5, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
              <Typography sx={{ fontWeight: 900, fontSize: 14, color: '#0f172a', mb: 1.5 }}>
                Parametrización del Estado y Decisiones del Programa
              </Typography>

              <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#475569', mb: 1 }}>
                Seleccione el estado o decisión institucional / MEN para este programa:
              </Typography>

              {/* SELECTOR DE DECISIÓN EN 4 TARJETAS INTERACTIVAS */}
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5, mb: 2.5 }}>
                {/* 1. EN CICLO ORDINARIO */}
                <Paper
                  elevation={0}
                  onClick={() => {
                    setExpedienteModal((prev) => ({
                      ...prev,
                      decisionTipo: 'EN_CICLO',
                      estadoContingencia: 'NO_APLICA'
                    }));
                  }}
                  sx={{
                    p: 1.8,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: expedienteModal.decisionTipo === 'EN_CICLO' ? '#1e3a8a' : '#e2e8f0',
                    bgcolor: expedienteModal.decisionTipo === 'EN_CICLO' ? '#eff6ff' : '#fff',
                    transition: 'all 0.2s ease',
                    boxShadow: expedienteModal.decisionTipo === 'EN_CICLO' ? '0 4px 12px rgba(30, 58, 138, 0.1)' : 'none',
                    '&:hover': { borderColor: '#1e3a8a', transform: 'translateY(-2px)' }
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Radio checked={expedienteModal.decisionTipo === 'EN_CICLO'} size="small" sx={{ p: 0, mt: 0.2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#0f172a', display: 'flex', alignItems: 'center' }}>
                        <TimelineIcon sx={{ fontSize: 16, mr: 0.6, color: '#1e3a8a' }} /> En Ciclo Ordinario (7 Años)
                      </Typography>
                      <Typography sx={{ fontSize: 11.5, color: '#475569', mt: 0.4, lineHeight: 1.35 }}>
                        Vigencia activa regular con monitoreo preventivo de hitos normativos a 26 y 14 meses.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* 2. RENOVACIÓN APROBADA POR EL MEN */}
                <Paper
                  elevation={0}
                  onClick={() => {
                    setExpedienteModal((prev) => ({
                      ...prev,
                      decisionTipo: 'RENOVADO_MEN',
                      estadoContingencia: 'NO_APLICA'
                    }));
                  }}
                  sx={{
                    p: 1.8,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: expedienteModal.decisionTipo === 'RENOVADO_MEN' ? '#16a34a' : '#e2e8f0',
                    bgcolor: expedienteModal.decisionTipo === 'RENOVADO_MEN' ? '#f0fdf4' : '#fff',
                    transition: 'all 0.2s ease',
                    boxShadow: expedienteModal.decisionTipo === 'RENOVADO_MEN' ? '0 4px 12px rgba(22, 163, 74, 0.12)' : 'none',
                    '&:hover': { borderColor: '#16a34a', transform: 'translateY(-2px)' }
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Radio checked={expedienteModal.decisionTipo === 'RENOVADO_MEN'} color="success" size="small" sx={{ p: 0, mt: 0.2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.4 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#166534', display: 'flex', alignItems: 'center' }}>
                          <VerifiedIcon sx={{ fontSize: 16, mr: 0.6, color: '#166534' }} /> Renovación Aprobada por MEN
                        </Typography>
                        <Chip label="No aplica contingencia" size="small" sx={{ height: 20, fontSize: 9.5, fontWeight: 900, bgcolor: '#dcfce7', color: '#15803d' }} />
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: '#14532d', mt: 0.4, lineHeight: 1.35 }}>
                        Nueva resolución ministerial expedida. Reinicia nuevo ciclo legal de 7 años.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* 3. DECISIÓN INSTITUCIONAL DE NO RENOVAR */}
                <Paper
                  elevation={0}
                  onClick={() => {
                    setExpedienteModal((prev) => ({
                      ...prev,
                      decisionTipo: 'NO_RENOVAR_INSTITUCIONAL',
                      estadoContingencia: prev.estadoContingencia === 'NO_APLICA' ? 'PENDIENTE_RADICAR' : prev.estadoContingencia
                    }));
                  }}
                  sx={{
                    p: 1.8,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' ? '#dc2626' : '#e2e8f0',
                    bgcolor: expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' ? '#fef2f2' : '#fff',
                    transition: 'all 0.2s ease',
                    boxShadow: expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' ? '0 4px 12px rgba(220, 38, 38, 0.12)' : 'none',
                    '&:hover': { borderColor: '#dc2626', transform: 'translateY(-2px)' }
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Radio checked={expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL'} color="error" size="small" sx={{ p: 0, mt: 0.2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.4 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#991b1b', display: 'flex', alignItems: 'center' }}>
                          <WarningIcon sx={{ fontSize: 16, mr: 0.6, color: '#991b1b' }} /> Decisión de No Renovar
                        </Typography>
                        <Chip label="Radicar en ≤ 2m" size="small" sx={{ height: 20, fontSize: 9.5, fontWeight: 900, bgcolor: '#fee2e2', color: '#b91c1c' }} />
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: '#7f1d1d', mt: 0.4, lineHeight: 1.35 }}>
                        Acto de la IES de no continuar oferta. Obligatorio radicar plan ante MEN en máx. 2 meses.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* 4. REGISTRO NEGADO POR EL MEN */}
                <Paper
                  elevation={0}
                  onClick={() => {
                    setExpedienteModal((prev) => ({
                      ...prev,
                      decisionTipo: 'NEGADO_MEN',
                      estadoContingencia: prev.estadoContingencia === 'NO_APLICA' ? 'PENDIENTE_RADICAR' : prev.estadoContingencia
                    }));
                  }}
                  sx={{
                    p: 1.8,
                    borderRadius: 2.5,
                    cursor: 'pointer',
                    border: '2px solid',
                    borderColor: expedienteModal.decisionTipo === 'NEGADO_MEN' ? '#dc2626' : '#e2e8f0',
                    bgcolor: expedienteModal.decisionTipo === 'NEGADO_MEN' ? '#fff1f2' : '#fff',
                    transition: 'all 0.2s ease',
                    boxShadow: expedienteModal.decisionTipo === 'NEGADO_MEN' ? '0 4px 12px rgba(220, 38, 38, 0.12)' : 'none',
                    '&:hover': { borderColor: '#dc2626', transform: 'translateY(-2px)' }
                  }}
                >
                  <Stack direction="row" spacing={1.2} alignItems="flex-start">
                    <Radio checked={expedienteModal.decisionTipo === 'NEGADO_MEN'} color="error" size="small" sx={{ p: 0, mt: 0.2 }} />
                    <Box sx={{ flex: 1 }}>
                      <Stack direction="row" spacing={0.6} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.4 }}>
                        <Typography sx={{ fontWeight: 900, fontSize: 13.5, color: '#991b1b', display: 'flex', alignItems: 'center' }}>
                          <ErrorOutlineIcon sx={{ fontSize: 16, mr: 0.6, color: '#991b1b' }} /> Registro Negado por MEN
                        </Typography>
                        <Chip label="Radicar en ≤ 2m" size="small" sx={{ height: 20, fontSize: 9.5, fontWeight: 900, bgcolor: '#fee2e2', color: '#b91c1c' }} />
                      </Stack>
                      <Typography sx={{ fontSize: 11.5, color: '#7f1d1d', mt: 0.4, lineHeight: 1.35 }}>
                        Resolución del MEN denegatoria. Obligatorio radicar plan ante MEN en máx. 2 meses.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Box>

              {/* RAMA 1: RENOVACIÓN APROBADA POR EL MEN (NUNCA REQUIERE CONTINGENCIA) */}
              {expedienteModal.decisionTipo === 'RENOVADO_MEN' && (
                <Stack spacing={2.2} sx={{ p: 2.2, borderRadius: 2.5, bgcolor: '#f0fdf4', border: '1.5px solid #86efac' }}>
                  <Alert severity="success" sx={{ fontSize: 12.5, bgcolor: '#dcfce7', border: '1px solid #bbf7d0' }}>
                    <strong>Renovación de Registro Calificado Concedida por el MEN:</strong>
                    <br />
                    De acuerdo con el Decreto 1330 de 2019, al renovarse favorablemente el Registro Calificado, el programa reinicia un nuevo ciclo legal de <strong>7 años de vigencia</strong>.
                    <strong> Bajo ninguna circunstancia se formula o radica Plan de Contingencia</strong>, ya que la oferta académica continúa formalmente activa.
                  </Alert>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label="Número de Nueva Resolución MEN"
                        placeholder="Ej: 014285"
                        value={expedienteModal.resolucionRenovacionNueva}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, resolucionRenovacionNueva: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha de la Nueva Resolución"
                        InputLabelProps={{ shrink: true }}
                        value={expedienteModal.fechaRenovacionNueva}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, fechaRenovacionNueva: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={expedienteModal.reiniciarCicloSieteAnos}
                            onChange={(e) => setExpedienteModal((prev) => ({ ...prev, reiniciarCicloSieteAnos: e.target.checked }))}
                            color="success"
                          />
                        }
                        label={<Typography sx={{ fontSize: 12.5, fontWeight: 750 }}>Reiniciar automáticamente el ciclo de 7 años de vigencia del programa</Typography>}
                      />
                    </Grid>
                  </Grid>

                  {/* SECCIÓN INTERACTIVA: ¿CONSERVA LA DENOMINACIÓN DEL PROGRAMA? */}
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2.2,
                      bgcolor: '#fff',
                      border: '1.5px solid #bbf7d0'
                    }}
                  >
                    <Typography sx={{ fontWeight: 900, fontSize: 13, color: '#166534', mb: 0.5, display: 'flex', alignItems: 'center', gap: 0.8 }}>
                      <SchoolIcon sx={{ fontSize: 18, color: '#16a34a' }} />
                      ¿Conserva la denominación del programa académico?
                    </Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#475569', mb: 1.5 }}>
                      Indique si la resolución de renovación del MEN mantiene el nombre actual o si autoriza una modificación en la denominación oficial del programa.
                    </Typography>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
                      {/* 1. SÍ CONSERVA */}
                      <Paper
                        elevation={0}
                        onClick={() => setExpedienteModal((prev) => ({ ...prev, conservaDenominacion: true }))}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: expedienteModal.conservaDenominacion ? '#16a34a' : '#e2e8f0',
                          bgcolor: expedienteModal.conservaDenominacion ? '#f0fdf4' : '#fff',
                          transition: 'all 0.2s ease',
                          '&:hover': { borderColor: '#16a34a' }
                        }}
                      >
                        <Stack direction="row" spacing={1.2} alignItems="flex-start">
                          <Radio checked={expedienteModal.conservaDenominacion} color="success" size="small" sx={{ p: 0, mt: 0.2 }} />
                          <Box>
                            <Typography sx={{ fontWeight: 850, fontSize: 13, color: '#166534' }}>
                              Sí, conserva denominación
                            </Typography>
                            <Typography sx={{ fontSize: 11.5, color: '#475569', mt: 0.3 }}>
                              El programa continúa denominándose: <strong>«{expedienteModal.item?.nombrePrograma}»</strong>
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>

                      {/* 2. NO CONSERVA (CAMBIO DE NOMBRE) */}
                      <Paper
                        elevation={0}
                        onClick={() => setExpedienteModal((prev) => ({ ...prev, conservaDenominacion: false }))}
                        sx={{
                          flex: 1,
                          p: 1.5,
                          borderRadius: 2,
                          cursor: 'pointer',
                          border: '2px solid',
                          borderColor: !expedienteModal.conservaDenominacion ? '#0284c7' : '#e2e8f0',
                          bgcolor: !expedienteModal.conservaDenominacion ? '#f0f9ff' : '#fff',
                          transition: 'all 0.2s ease',
                          '&:hover': { borderColor: '#0284c7' }
                        }}
                      >
                        <Stack direction="row" spacing={1.2} alignItems="flex-start">
                          <Radio checked={!expedienteModal.conservaDenominacion} color="primary" size="small" sx={{ p: 0, mt: 0.2 }} />
                          <Box>
                            <Typography sx={{ fontWeight: 850, fontSize: 13, color: '#0369a1' }}>
                              No, cambio de denominación autorizado
                            </Typography>
                            <Typography sx={{ fontSize: 11.5, color: '#475569', mt: 0.3 }}>
                              El MEN otorgó una nueva denominación académica en este acto administrativo.
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </Stack>

                    {/* ENTRADA DE TEXTO PARA NUEVA DENOMINACIÓN Y TRAZABILIDAD DEL HITO */}
                    {!expedienteModal.conservaDenominacion && (
                      <Stack spacing={1.5} sx={{ p: 1.8, borderRadius: 2, bgcolor: '#f0f9ff', border: '1.5px dashed #7dd3fc', mt: 1 }}>
                        <TextField
                          fullWidth
                          size="small"
                          label="Nueva Denominación Oficial del Programa Aprobada por el MEN"
                          placeholder="Ej: Licenciatura en Educación Infantil (o la denominación expedida en la resolución)"
                          value={expedienteModal.nuevaDenominacion}
                          onChange={(e) => setExpedienteModal((prev) => ({ ...prev, nuevaDenominacion: e.target.value }))}
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <HistoryEduIcon sx={{ color: '#0284c7', fontSize: 20 }} />
                              </InputAdornment>
                            )
                          }}
                          helperText="Esta nueva denominación actualizará el nombre vigente y guardará la trazabilidad histórica completa."
                          sx={{ bgcolor: '#fff', borderRadius: 1 }}
                        />

                        {/* VISTA PREVIA DE LA TRAZABILIDAD HISTÓRICA */}
                        <Box sx={{ p: 1.4, borderRadius: 1.8, bgcolor: '#fff', border: '1px solid #bae6fd' }}>
                          <Typography sx={{ fontWeight: 850, fontSize: 11.5, color: '#0369a1', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 0.6 }}>
                            <TimelineIcon sx={{ fontSize: 16 }} />
                            Trazabilidad histórica que quedará registrada en el expediente:
                          </Typography>
                          <Stack spacing={0.8} sx={{ mt: 1 }}>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <Chip label="Hito Previo" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 900, bgcolor: '#f1f5f9', color: '#475569', mt: 0.2 }} />
                              <Typography sx={{ fontSize: 12, color: '#334155', lineHeight: 1.4 }}>
                                De <strong>{expedienteModal.item?.fechaRrc ? new Date(expedienteModal.item.fechaRrc).getFullYear() : '2017'}</strong> a <strong>{expedienteModal.fechaRenovacionNueva ? new Date(expedienteModal.fechaRenovacionNueva).getFullYear() : new Date().getFullYear()}</strong> se denominó: <strong>«{expedienteModal.item?.nombrePrograma}»</strong> ({expedienteModal.item?.numeroResolucion ? `Res. ${expedienteModal.item.numeroResolucion}` : 'Resolución previa'}).
                              </Typography>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                              <Chip label="Nueva Denominación" size="small" sx={{ height: 20, fontSize: 10, fontWeight: 900, bgcolor: '#dcfce7', color: '#15803d', mt: 0.2 }} />
                              <Typography sx={{ fontSize: 12, color: '#166534', fontWeight: 700, lineHeight: 1.4 }}>
                                A partir de <strong>{expedienteModal.fechaRenovacionNueva ? new Date(expedienteModal.fechaRenovacionNueva).getFullYear() : new Date().getFullYear()}</strong> se denomina: <strong>«{expedienteModal.nuevaDenominacion.trim() || '[Pendiente escribir nueva denominación]'}»</strong> ({expedienteModal.resolucionRenovacionNueva ? `Res. ${expedienteModal.resolucionRenovacionNueva}` : 'Nueva Resolución MEN'}).
                              </Typography>
                            </Box>
                          </Stack>
                        </Box>
                      </Stack>
                    )}
                  </Paper>
                </Stack>
              )}

              {/* RAMA 2 Y 3: NO RENOVACIÓN INSTITUCIONAL O NEGACIÓN MEN (CONTINGENCIA OBLIGATORIA 2 MESES) */}
              {(expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' || expedienteModal.decisionTipo === 'NEGADO_MEN') && (
                <Stack spacing={2.2} sx={{ p: 2.2, borderRadius: 2.5, bgcolor: '#fef2f2', border: '1.5px solid #fca5a5' }}>
                  <Alert severity="warning" sx={{ fontSize: 12.5, bgcolor: '#fff', border: '1px solid #fecaca' }}>
                    {expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' ? (
                      <>
                        <strong>Decisión Institucional de No Renovación (Decreto 1330):</strong> Registre el acto administrativo institucional de la Universidad. La institución cuenta con un plazo legal improrrogable de <strong>2 meses</strong> desde la fecha del acto para formular y radicar el Plan de Contingencia ante el Ministerio de Educación Nacional.
                      </>
                    ) : (
                      <>
                        <strong>Registro Calificado Negado por el MEN (Decreto 1330):</strong> Registre la resolución del Ministerio de Educación Nacional. La institución dispone de <strong>2 meses</strong> perentorios para radicar el Plan de Contingencia respectivo ante el MEN.
                      </>
                    )}
                  </Alert>

                  {/* CUENTA REGRESIVA Y PLAZO DE 2 MESES */}
                  {(() => {
                    let diasRestantes = null;
                    if (expedienteModal.fechaLimiteRadicarContingencia) {
                      const lim = parseDateSafe(expedienteModal.fechaLimiteRadicarContingencia);
                      if (lim) {
                        const now = new Date();
                        now.setHours(0, 0, 0, 0);
                        diasRestantes = Math.ceil((lim.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                      }
                    }
                    return (
                      <Box sx={{ p: 1.3, bgcolor: '#fff', borderRadius: 2, border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
                        <Box>
                          <Typography sx={{ fontWeight: 900, fontSize: 12, color: '#991b1b', display: 'flex', alignItems: 'center' }}>
                            <PolicyIcon sx={{ fontSize: 15, mr: 0.5, color: '#991b1b' }} /> Plazo Legal Improrrogable: 2 Meses posteriores al Acto Administrativo
                          </Typography>
                          <Typography sx={{ fontSize: 11.5, color: '#7f1d1d' }}>
                            Fecha límite calculada: <strong>{formatDate(expedienteModal.fechaLimiteRadicarContingencia)}</strong>
                          </Typography>
                        </Box>
                        {diasRestantes !== null && (
                          <Chip
                            icon={<HourglassTopIcon sx={{ fontSize: '14px !important', color: `${diasRestantes > 15 ? '#b45309' : '#b91c1c'} !important` }} />}
                            label={diasRestantes > 0 ? `Quedan ${diasRestantes} días para radicar ante MEN (plazo 2m)` : diasRestantes === 0 ? 'Plazo vence HOY para radicar ante MEN' : `Plazo legal 2m vencido hace ${Math.abs(diasRestantes)} días`}
                            sx={{
                              fontWeight: 900,
                              fontSize: 11.5,
                              bgcolor: diasRestantes > 15 ? '#fef3c7' : '#fee2e2',
                              color: diasRestantes > 15 ? '#b45309' : '#b91c1c',
                              border: `1px solid ${diasRestantes > 15 ? '#fcd34d' : '#f87171'}`
                            }}
                          />
                        )}
                      </Box>
                    );
                  })()}

                  {/* SELECTOR DE FASE DEL PLAN DE CONTINGENCIA */}
                  <Box>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#334155', mb: 0.8 }}>
                      Fase Actual del Plan de Contingencia:
                    </Typography>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                      {[
                        { key: 'PENDIENTE_RADICAR', label: '1. Por Radicar (≤ 2 meses)', color: '#dc2626', bg: '#fee2e2' },
                        { key: 'RADICADO', label: '2. Radicado ante MEN', color: '#0284c7', bg: '#e0f2fe' },
                        { key: 'EN_EJECUCION', label: '3. En Ejecución (Cohortes)', color: '#c2410c', bg: '#ffedd5' },
                        { key: 'FINALIZADO', label: '4. Finalizado / Cerrado', color: '#475569', bg: '#f1f5f9' }
                      ].map((phase) => (
                        <Button
                          key={phase.key}
                          size="small"
                          variant={expedienteModal.estadoContingencia === phase.key ? 'contained' : 'outlined'}
                          onClick={() => setExpedienteModal((prev) => ({ ...prev, estadoContingencia: phase.key }))}
                          sx={{
                            flex: 1,
                            fontWeight: 850,
                            fontSize: 11.5,
                            textTransform: 'none',
                            py: 0.8,
                            bgcolor: expedienteModal.estadoContingencia === phase.key ? phase.color : 'transparent',
                            color: expedienteModal.estadoContingencia === phase.key ? '#fff' : phase.color,
                            borderColor: phase.color,
                            '&:hover': {
                              bgcolor: phase.color,
                              color: '#fff'
                            }
                          }}
                        >
                          {phase.label}
                        </Button>
                      ))}
                    </Stack>
                  </Box>

                  <Grid container spacing={2}>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        label={expedienteModal.decisionTipo === 'NO_RENOVAR_INSTITUCIONAL' ? 'Acto Administrativo Institucional (IES)' : 'Resolución de Negación MEN'}
                        placeholder="Ej: Acuerdo Consejo Superior No. 018-2025"
                        value={expedienteModal.actoAdministrativoNoRenovacion}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, actoAdministrativoNoRenovacion: e.target.value }))}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha del Acto Administrativo"
                        InputLabelProps={{ shrink: true }}
                        value={expedienteModal.fechaActoAdministrativo}
                        onChange={(e) => handleFechaActoChange(e.target.value)}
                        helperText="Al modificar esta fecha, el sistema recalcula los 2 meses legalmente fijados"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha Límite Radicación Contingencia MEN (2m)"
                        InputLabelProps={{ shrink: true }}
                        value={expedienteModal.fechaLimiteRadicarContingencia}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, fechaLimiteRadicarContingencia: e.target.value }))}
                        helperText="Plazo legal máximo improrrogable ante el Ministerio"
                        InputProps={{
                          sx: { fontWeight: 900, color: '#b91c1c' }
                        }}
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha Efectiva Radicación en MEN"
                        InputLabelProps={{ shrink: true }}
                        value={expedienteModal.fechaRadicacionContingencia}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, fechaRadicacionContingencia: e.target.value }))}
                        helperText="Fecha en que se radicó el plan ante el Ministerio"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha Inicio Plan Contingencia (Cohortes)"
                        InputLabelProps={{ shrink: true }}
                        value={expedienteModal.fechaInicioContingencia}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, fechaInicioContingencia: e.target.value }))}
                        helperText="Inicio del régimen de transición de cohortes activas"
                      />
                    </Grid>
                    <Grid item xs={12} sm={6}>
                      <TextField
                        fullWidth
                        size="small"
                        type="date"
                        label="Fecha Fin Plan Contingencia (Graduación)"
                        InputLabelProps={{ shrink: true }}
                        value={expedienteModal.fechaFinContingencia}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, fechaFinContingencia: e.target.value }))}
                        helperText="Culminación y graduación formal de la última cohorte"
                      />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        size="small"
                        multiline
                        rows={2.5}
                        label="Observaciones y Garantías Académicas del Plan de Contingencia"
                        placeholder="Describa el compromiso institucional con los estudiantes activos matriculados, número de semestres garantizados, cuerpo docente, laboratorios y titulación..."
                        value={expedienteModal.contingenciaObservaciones}
                        onChange={(e) => setExpedienteModal((prev) => ({ ...prev, contingenciaObservaciones: e.target.value }))}
                      />
                    </Grid>
                  </Grid>
                </Stack>
              )}

              {/* RAMA 4: EN CICLO ORDINARIO */}
              {expedienteModal.decisionTipo === 'EN_CICLO' && (
                <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <Typography sx={{ fontSize: 12.5, color: '#475569' }}>
                    El programa académico continúa en su ciclo regular de vigencia de 7 años. Se monitorean preventivamente los hitos de <strong>26 meses</strong> (inicio de elaboración del documento de renovación) y <strong>14 meses</strong> (límite de radicación en SACES).
                  </Typography>
                </Box>
              )}
            </Paper>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 2.5, py: 1.5, bgcolor: '#fff' }}>
          <Button
            onClick={() => setExpedienteModal((prev) => ({ ...prev, open: false }))}
            disabled={expedienteModal.loading}
            sx={{ fontWeight: 800 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={expedienteModal.loading ? <CircularProgress size={18} color="inherit" /> : <CheckCircleIcon />}
            onClick={handleSaveExpediente}
            disabled={expedienteModal.loading}
            sx={{ fontWeight: 900, bgcolor: '#1e3a8a', px: 2.5 }}
          >
            {expedienteModal.loading ? 'Guardando expediente...' : 'Guardar y Actualizar Ciclo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE NOTIFICACIÓN INSTITUCIONAL POR CORREO */}
      <Dialog open={notifyDialog.open} onClose={() => !notifyDialog.loading && setNotifyDialog((prev) => ({ ...prev, open: false }))} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 950, pb: 1, bgcolor: '#1e3a8a', color: '#fff' }}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <EmailIcon />
            <Box>
              <Typography sx={{ fontWeight: 950, fontSize: 17, color: '#fff' }}>
                Notificación Institucional - Monitoreo de Registros Calificados
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#bfdbfe' }}>
                Dirección de Planeación y Aseguramiento de la Calidad
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 2.5 }}>
          <Stack spacing={2}>
            <Alert severity="info" sx={{ fontSize: 13, '& .MuiAlert-message': { width: '100%' } }}>
              Se remitirá un informe oficial vía correo electrónico al Director de Planeación y Aseguramiento de la Calidad con la relación de los programas que se encuentran en ciclo preventivo o límite de renovación.
            </Alert>

            <TextField
              label="Destinatarios (Separar por coma para múltiples correos)"
              fullWidth
              size="small"
              value={notifyDialog.destinatarios}
              onChange={(e) => setNotifyDialog((prev) => ({ ...prev, destinatarios: e.target.value }))}
              placeholder="planeacion@unicesmag.edu.co, director.planeacion@unicesmag.edu.co"
              helperText="Correo institucional oficial de la Dirección de Planeación y Aseguramiento de la Calidad"
            />

            <TextField
              label="Asunto del Correo"
              fullWidth
              size="small"
              value={notifyDialog.asunto}
              onChange={(e) => setNotifyDialog((prev) => ({ ...prev, asunto: e.target.value }))}
            />

            <TextField
              label="Observaciones o Instrucciones Adicionales (Opcional)"
              fullWidth
              multiline
              rows={3}
              value={notifyDialog.observaciones}
              onChange={(e) => setNotifyDialog((prev) => ({ ...prev, observaciones: e.target.value }))}
              placeholder="Ej: Se solicita a los directores de programa iniciar la recopilación de condiciones de calidad para la radicación en SACES..."
            />

            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 13, color: '#1e293b', mb: 1 }}>
                Programas incluidos en el reporte ({notifyDialog.selectedItems.length}):
              </Typography>
              <Paper variant="outlined" sx={{ maxHeight: 220, overflowY: 'auto', p: 1, bgcolor: '#f8fafc' }}>
                <Stack spacing={0.8}>
                  {notifyDialog.selectedItems.map((prog, pidx) => (
                    <Box
                      key={pidx}
                      sx={{
                        p: 1,
                        borderRadius: 1.5,
                        bgcolor: '#fff',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1.5
                      }}
                    >
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>
                          {prog.nombrePrograma}
                        </Typography>
                        <Typography sx={{ fontSize: 11, color: '#64748b' }}>
                          SNIES: {prog.codigoSnies || '-'} · Vence RC: {formatDate(prog.fechaVencimientoRc)} · Límite SACES: {prog.semaforo?.fechaSacesStr || '-'}
                        </Typography>
                      </Box>
                      <Chip
                        label={prog.semaforo?.badgeText || 'En Monitoreo'}
                        size="small"
                        sx={{
                          fontWeight: 850,
                          fontSize: 11,
                          bgcolor: prog.semaforo?.bg || '#f1f5f9',
                          color: prog.semaforo?.color || '#334155'
                        }}
                      />
                    </Box>
                  ))}
                </Stack>
              </Paper>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 2.5, py: 1.5 }}>
          <Button
            onClick={() => setNotifyDialog((prev) => ({ ...prev, open: false }))}
            disabled={notifyDialog.loading}
            sx={{ fontWeight: 800 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="primary"
            startIcon={notifyDialog.loading ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            onClick={handleSendNotification}
            disabled={notifyDialog.loading}
            sx={{ fontWeight: 900, bgcolor: '#1e3a8a', px: 2.5 }}
          >
            {notifyDialog.loading ? 'Enviando notificación...' : 'Enviar Notificación por Correo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE DETALLE DE TEXTO */}
      <Dialog open={detailModal.open} onClose={() => setDetailModal({ open: false, title: '', content: '' })} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 900, pb: 1 }}>{detailModal.title}</DialogTitle>
        <DialogContent dividers sx={{ p: 2.5 }}>
          <Typography sx={{ color: '#334155', fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {detailModal.content}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.2 }}>
          <Button variant="contained" onClick={() => setDetailModal({ open: false, title: '', content: '' })} sx={{ fontWeight: 900 }}>
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE EVIDENCIAS DRIVE */}
      <Dialog open={evidence.open} onClose={() => setEvidence((prev) => ({ ...prev, open: false }))} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900, pb: 1.3 }}>
          <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1.2} alignItems="center">
              <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: '#eff6ff', color: '#1d4ed8', display: 'grid', placeItems: 'center' }}>
                <FolderIcon />
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 18 }}>Evidencias</Typography>
                <Typography sx={{ color: '#64748b', fontSize: 12.5 }}>Coincidencias de Resolucion RC y Plan de Estudios</Typography>
              </Box>
            </Stack>
            <Button onClick={() => setEvidence((prev) => ({ ...prev, open: false }))} sx={{ minWidth: 0, color: '#64748b', fontSize: 24, lineHeight: 1 }}>×</Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 1.6 }}>
          {evidence.loading ? (
            <Box sx={{ py: 7, textAlign: 'center' }}>
              <CircularProgress size={34} thickness={4} />
              <Typography sx={{ mt: 1.4, color: '#0f172a', fontWeight: 900 }}>
                Consultando evidencias en Drive...
              </Typography>
              <Typography sx={{ mt: 0.4, color: '#64748b', fontSize: 13 }}>
                La primera consulta puede tardar un poco; las siguientes quedan aceleradas con caché.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.4}>
              <TextField
                size="small"
                fullWidth
                placeholder="Buscar archivo"
                value={evidenceSearch}
                onChange={(event) => setEvidenceSearch(event.target.value)}
              />
              <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Nombre</TableCell>
                      <TableCell sx={{ width: 170, fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Tipo</TableCell>
                      <TableCell sx={{ width: 190, fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Modificación</TableCell>
                      <TableCell align="center" sx={{ width: 150, fontWeight: 900, color: '#64748b', bgcolor: '#f8fafc' }}>Acción</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {evidenceRows.length === 0 ? (
                      <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}>No hay archivos coincidentes para mostrar.</TableCell></TableRow>
                    ) : evidenceRows.map((row) => (
                      <TableRow key={row.expectedName} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Box sx={{ width: 38, height: 38, borderRadius: '50%', bgcolor: row.file ? '#dbeafe' : '#ffedd5', color: row.file ? '#1d4ed8' : '#9a3412', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                              <FolderIcon fontSize="small" />
                            </Box>
                            <Box>
                              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 13 }}>{row.expectedName}</Typography>
                              <Typography sx={{ color: row.file ? '#166534' : '#c2410c', fontWeight: 800, fontSize: 11.5 }}>
                                {row.file ? `Encontrado: ${row.name}` : 'No encontrado en la carpeta de Drive'}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell>{row.file ? row.type : '-'}</TableCell>
                        <TableCell>{row.file ? formatDateTime(row.modifiedTime) : '-'}</TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.8} justifyContent="center">
                            <Button size="small" variant="text" disabled={!row.file} onClick={() => setPreview({ open: true, file: row.file })} sx={{ minWidth: 0 }}>
                              <VisibilityIcon fontSize="small" />
                            </Button>
                            <Button size="small" variant="text" disabled={!row.file} onClick={() => window.open(getDriveDownloadUrl(row.file), '_blank', 'noopener,noreferrer')} sx={{ minWidth: 0 }}>
                              <DownloadIcon fontSize="small" />
                            </Button>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.4 }}>
          <Button variant="contained" onClick={() => setEvidence((prev) => ({ ...prev, open: false }))} sx={{ fontWeight: 900 }}>Cerrar</Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE PREVISUALIZACIÓN DE ARCHIVO */}
      <Dialog open={preview.open} onClose={() => setPreview({ open: false, file: null })} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 900 }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Typography sx={{ fontWeight: 900, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {preview.file?.name || 'Previsualizacion'}
            </Typography>
            <Button variant="contained" startIcon={<DownloadIcon />} disabled={!preview.file} onClick={() => window.open(getDriveDownloadUrl(preview.file), '_blank', 'noopener,noreferrer')} sx={{ fontWeight: 900 }}>
              Descargar
            </Button>
          </Stack>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0, height: { xs: '70vh', md: '78vh' } }}>
          {preview.file ? (
            <Box component="iframe" title={preview.file.name || 'Previsualizacion'} src={getDrivePreviewUrl(preview.file)} sx={{ width: '100%', height: '100%', border: 0, bgcolor: '#fff' }} />
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPreview({ open: false, file: null })}>Cerrar</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}

export default RegistrosCalificadosAcreditacion;
