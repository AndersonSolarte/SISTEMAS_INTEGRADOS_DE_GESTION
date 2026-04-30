import React, { useCallback, useEffect, useState } from 'react';
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
  Fade,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
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
  TextField,
  Tooltip as MuiTooltip,
  Typography
} from '@mui/material';
import {
  AutoGraph as AutoGraphIcon,
  AudioFile as AudioFileIcon,
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  CloudDownload as CloudDownloadIcon,
  Description as DescriptionIcon,
  DeleteOutline as DeleteOutlineIcon,
  Edit as EditIcon,
  FactCheck as FactCheckIcon,
  FolderOpen as FolderOpenIcon,
  Groups as GroupsIcon,
  Hub as HubIcon,
  Image as ImageIcon,
  Inventory2 as InventoryIcon,
  InsertDriveFile as InsertDriveFileIcon,
  OpenInNew as OpenInNewIcon,
  PersonAdd as PersonAddIcon,
  PictureAsPdf as PictureAsPdfIcon,
  Search as SearchIcon,
  TableChart as TableChartIcon,
  Timeline as TimelineIcon,
  UploadFile as UploadFileIcon,
  Slideshow as SlideshowIcon,
  VideoFile as VideoFileIcon,
  Save as SaveIcon,
  Visibility as VisibilityIcon,
  WarningAmber as WarningAmberIcon
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../services/gestionInformacionService';

const VIEWS = [
  { key: 'resumen', label: 'Resumen', icon: <AutoGraphIcon /> },
  { key: 'factores', label: 'Factores', icon: <HubIcon /> },
  { key: 'mejora', label: 'Mejoramiento', icon: <TimelineIcon /> }
];

const VIEW_TONES = {
  resumen: { color: '#1f4e95', soft: '#eff6ff' },
  factores: { color: '#2563eb', soft: '#eff6ff' },
  equipo: { color: '#0f766e', soft: '#ecfdf5' },
  mejora: { color: '#d97706', soft: '#fff7ed' }
};

const AUTOEVALUACION_BASES = [
  {
    key: 'autoevaluacion_base',
    title: 'Autoevaluacion',
    description: 'Factores, caracteristicas, aspectos, indicadores, calificaciones y evidencias.',
    color: '#1f4e95',
    icon: <TableChartIcon />
  },
  {
    key: 'Participantes',
    title: 'Participantes',
    description: 'Equipo asignado al proceso de autoevaluacion.',
    color: '#0f766e',
    icon: <GroupsIcon />
  },
  {
    key: 'informacion_programas',
    title: 'informacion_programas',
    description: 'Ficha basica del programa academico para el resumen inicial.',
    color: '#d97706',
    icon: <FactCheckIcon />
  }
];

const PROGRAMA_INFO_FIELDS = [
  ['programa', 'Nombre del Programa'],
  ['procesoAutoevaluacion', 'Proceso autoevaluacion'],
  ['facultad', 'Facultad a la que esta adscrito'],
  ['nivelFormacion', 'Nivel de Formacion'],
  ['renovacionRegistroCalificado', 'Renovacion Registro Calificado'],
  ['codigoSnies', 'Codigo SNIES'],
  ['tituloOtorga', 'Titulo que Otorga'],
  ['emailPrograma', 'E-mail del Programa'],
  ['duracionFormacion', 'Duracion de Formacion'],
  ['numeroCreditos', 'Numero de Creditos'],
  ['estudiantesPrimerCurso', 'Estudiantes a admitir a primer curso']
];

const PROGRAMA_INFO_FIELD_MAP = {
  programa: 'programa',
  procesoAutoevaluacion: 'proceso_autoevaluacion',
  facultad: 'facultad',
  nivelFormacion: 'nivel_formacion',
  renovacionRegistroCalificado: 'renovacion_registro_calificado',
  codigoSnies: 'codigo_snies',
  tituloOtorga: 'titulo_otorga',
  emailPrograma: 'email_programa',
  duracionFormacion: 'duracion_formacion',
  numeroCreditos: 'numero_creditos',
  estudiantesPrimerCurso: 'estudiantes_primer_curso'
};

const PROGRAM_CATALOG = [
  { programa: 'UNIVERSIDAD CESMAG - UNICESMAG', codigoSnies: '2744', facultad: 'Institucional', nivelFormacion: 'Institucional' },
  { programa: 'TECNOLOGIA EN MARKETING DIGITAL', codigoSnies: '117522', facultad: 'Ciencias Administrativas y Contables', nivelFormacion: 'Pregrado' },
  { programa: 'ADMINISTRACION DE EMPRESAS', codigoSnies: '19787', facultad: 'Ciencias Administrativas y Contables', nivelFormacion: 'Pregrado' },
  { programa: 'CONTADURIA PUBLICA', codigoSnies: '19788', facultad: 'Ciencias Administrativas y Contables', nivelFormacion: 'Pregrado' },
  { programa: 'ESPECIALIZACION EN GERENCIA DE PROYECTOS', codigoSnies: '104875', facultad: 'Ciencias Administrativas y Contables', nivelFormacion: 'Posgrado' },
  { programa: 'ESPECIALIZACION EN GERENCIA DE LA SEGURIDAD Y SALUD EN EL TRABAJO', codigoSnies: '118355', facultad: 'Ciencias Administrativas y Contables', nivelFormacion: 'Posgrado' },
  { programa: 'MAESTRIA EN GERENCIA DE PROYECTOS', codigoSnies: '118032', facultad: 'Ciencias Administrativas y Contables', nivelFormacion: 'Posgrado' },
  { programa: 'ARQUITECTURA', codigoSnies: '19979', facultad: 'Arquitectura y Bellas Artes', nivelFormacion: 'Pregrado' },
  { programa: 'DISENO GRAFICO', codigoSnies: '19062', facultad: 'Arquitectura y Bellas Artes', nivelFormacion: 'Pregrado' },
  { programa: 'ESPECIALIZACION EN ARQUITECTURA Y URBANISMO BIOCLIMATICO', codigoSnies: '108376', facultad: 'Arquitectura y Bellas Artes', nivelFormacion: 'Posgrado' },
  { programa: 'DERECHO', codigoSnies: '52939', facultad: 'Ciencias Sociales y Humanas', nivelFormacion: 'Pregrado' },
  { programa: 'PSICOLOGIA', codigoSnies: '53874', facultad: 'Ciencias Sociales y Humanas', nivelFormacion: 'Pregrado' },
  { programa: 'ESPECIALIZACION EN DERECHO EMPRESARIAL', codigoSnies: '108870', facultad: 'Ciencias Sociales y Humanas', nivelFormacion: 'Posgrado' },
  { programa: 'LICENCIATURA EN EDUCACION FISICA', codigoSnies: '16489', facultad: 'Educacion', nivelFormacion: 'Pregrado' },
  { programa: 'LICENCIATURA EN EDUCACION INFANTIL', codigoSnies: '106286', facultad: 'Educacion', nivelFormacion: 'Pregrado' },
  { programa: 'LICENCIATURA EN QUIMICA', codigoSnies: '106309', facultad: 'Educacion', nivelFormacion: 'Pregrado' },
  { programa: 'ESPECIALIZACION EN INFANCIA, CULTURA Y DESARROLLO', codigoSnies: '108325', facultad: 'Educacion', nivelFormacion: 'Posgrado' },
  { programa: 'ESPECIALIZACION EN PEDAGOGIA DEL ENTRENAMIENTO DEPORTIVO', codigoSnies: '108324', facultad: 'Educacion', nivelFormacion: 'Posgrado' },
  { programa: 'INGENIERIA DE SISTEMAS', codigoSnies: '20376', facultad: 'Ingenieria', nivelFormacion: 'Pregrado' },
  { programa: 'INGENIERIA ELECTRONICA', codigoSnies: '90715', facultad: 'Ingenieria', nivelFormacion: 'Pregrado' },
  { programa: 'INGENIERIA INDUSTRIAL', codigoSnies: '118273', facultad: 'Ingenieria', nivelFormacion: 'Pregrado' },
  { programa: 'INGENIERIA FINANCIERA', codigoSnies: '118327', facultad: 'Ingenieria', nivelFormacion: 'Pregrado' },
  { programa: 'ESPECIALIZACION EN BIG DATA', codigoSnies: '117642', facultad: 'Ingenieria', nivelFormacion: 'Posgrado' },
  { programa: 'ESPECIALIZACION EN SEGURIDAD INFORMATICA', codigoSnies: '117789', facultad: 'Ingenieria', nivelFormacion: 'Posgrado' }
];

const FACULTY_OPTIONS = Array.from(new Set((PROGRAM_CATALOG || []).map((item) => item?.facultad).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), 'es'));
const PROGRAM_BY_NAME = PROGRAM_CATALOG.reduce((acc, item) => {
  acc[item.programa] = item;
  return acc;
}, {});

const normalizeProgramName = (value = '') => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase();
const normalizeComponentCode = (value = '') => {
  const key = String(value || '').trim().toUpperCase().replace(/\s+/g, '');
  if (key.includes('P/I') || key.includes('I/P') || key === 'PI' || key.includes('PROGRAMA/INSTITUCION')) return 'P/I';
  if (key === 'P' || key.includes('PROGRAMA')) return 'P';
  if (key === 'I' || key.includes('INSTITUCION')) return 'I';
  return key || 'SIN COMPONENTE';
};
const componentDisplayLabel = (component, scope = 'general') => {
  const code = normalizeComponentCode(component);
  if (code === 'P') return 'Programa';
  if (code === 'I') return 'Institucional';
  if (code === 'P/I') {
    if (scope === 'programa') return 'Programa (I)';
    if (scope === 'institucional') return 'Institucional (P)';
    return 'Programa / Institucional';
  }
  return 'Pendiente por clasificar';
};
const resolveComponentSummary = (components = []) => {
  const normalized = Array.from(new Set(components.map((item) => normalizeComponentCode(item))));
  if (normalized.includes('P/I') || (normalized.includes('P') && normalized.includes('I'))) return 'P/I';
  if (normalized.includes('P')) return 'P';
  if (normalized.includes('I')) return 'I';
  return 'SIN COMPONENTE';
};
const shortFactorLabel = (value = '') => {
  const number = factorNumber(value);
  return number ? `F${number}` : String(value || 'SIN FACTOR').replace(/\s+/g, ' ').trim();
};
const componentScopeOptions = [
  { key: 'general', label: 'General', helper: 'P + I + P/I', color: '#1f4e95' },
  { key: 'programa', label: 'Programa', helper: 'P y P/I', color: '#0f766e' },
  { key: 'institucional', label: 'Institucional', helper: 'I y P/I', color: '#d97706' }
];

const EMPTY_PROGRAM_INFO_FORM = {
  programa: '',
  procesoAutoevaluacion: 'RENOVACION REGISTRO CALIFICADO',
  facultad: '',
  nivelFormacion: '',
  renovacionRegistroCalificado: '',
  codigoSnies: '',
  tituloOtorga: '',
  emailPrograma: '',
  duracionFormacion: '',
  numeroCreditos: '',
  estudiantesPrimerCurso: ''
};

const cumplimientoColor = (label = '') => {
  const key = String(label || '').toUpperCase();
  if (key.includes('PLENAMENTE')) return '#047857';
  if (key.includes('ALTO')) return '#2563eb';
  if (key.includes('ACEPTABLE')) return '#d97706';
  if (key.includes('INSATISFACTORIA')) return '#dc2626';
  if (key.includes('NO SE')) return '#991b1b';
  return '#64748b';
};

const getScoreLabel = (value) => {
  const score = Number(value);
  if (!Number.isFinite(score)) return 'SIN CALIFICAR';
  if (score >= 4.6) return 'SE CUMPLE PLENAMENTE';
  if (score >= 4.0) return 'SE CUMPLE EN ALTO GRADO';
  if (score >= 3.0) return 'SE CUMPLE ACEPTABLEMENTE';
  if (score >= 2.0) return 'SE CUMPLE INSATISFACTORIAMENTE';
  return 'NO SE CUMPLE';
};

const scoreTone = (score) => cumplimientoColor(score?.label || score);
const factorNumber = (value = '') => Number(String(value || '').match(/F\s*([0-9]+)/i)?.[1] || 0);
const characteristicCode = (value = '') => String(value || '').match(/C\s*([0-9]+)/i)?.[0]?.replace(/\s+/g, '') || '';
const formatScore = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '0.00';
};

function Metric({ label, value, helper, color = '#1d4ed8', icon }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 2, border: '1px solid #e2e8f0', bgcolor: 'white', height: '100%', width: '100%', boxSizing: 'border-box' }}>
      <Stack direction="row" spacing={1.4} alignItems="center">
        <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: `${color}17`, color, display: 'grid', placeItems: 'center' }}>
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900, textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography variant="h5" sx={{ color: '#0f172a', fontWeight: 950, lineHeight: 1.05 }}>
            {value}
          </Typography>
          {helper && (
            <Typography variant="caption" sx={{ color: '#64748b' }}>
              {helper}
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

function ScoreChip({ value, label }) {
  const color = cumplimientoColor(label);
  return (
    <Chip
      size="small"
      label={`${formatScore(value)} · ${label || 'SIN CALIFICAR'}`}
      sx={{ bgcolor: `${color}17`, color, fontWeight: 900, maxWidth: '100%' }}
    />
  );
}

function ComplianceMark({ label }) {
  const color = cumplimientoColor(label);
  const key = String(label || '').toUpperCase();
  const isCritical = key.includes('INSATISFACTORIA') || key.includes('NO SE');
  const isWarning = key.includes('ACEPTABLE');
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-grid',
        placeItems: 'center',
        width: 20,
        height: 20,
        color,
        fontSize: 16,
        fontWeight: 950
      }}
    >
      {isCritical ? '◆' : (isWarning ? '△' : '●')}
    </Box>
  );
}

const isCriticalCompliance = (label = '', value = null) => {
  const key = String(label || '').toUpperCase();
  const score = Number(value);
  return key.includes('INSATISFACTORIA') || key.includes('NO SE') || (Number.isFinite(score) && score < 3);
};

function EmptyState() {
  return (
    <Alert severity="info" sx={{ borderRadius: 2 }}>
      Aún no hay datos cargados. Carga la subbase Autoevaluación con la hoja “Aspectos e ind” para activar la experiencia.
    </Alert>
  );
}

function EditableText({ editing, value, onChange, minWidth = 180, multiline = false, placeholder = '-' }) {
  if (!editing) {
    return (
      <Typography variant="body2" sx={{ color: '#0f172a', lineHeight: 1.3, whiteSpace: 'pre-wrap' }}>
        {value || placeholder}
      </Typography>
    );
  }

  return (
    <TextField
      fullWidth
      size="small"
      value={value || ''}
      onChange={(event) => onChange(event.target.value)}
      multiline={multiline}
      minRows={multiline ? 2 : 1}
      maxRows={multiline ? 5 : 1}
      sx={{
        minWidth,
        '& .MuiInputBase-input': {
          fontSize: 13,
          lineHeight: 1.3
        }
      }}
    />
  );
}

const getEvidenceUrl = (value) => String(value || '').trim();

const getFileTypeLabel = (mimeType = '', name = '') => {
  const mime = String(mimeType || '').toLowerCase();
  const filename = String(name || '').toLowerCase();
  if (mime.includes('pdf') || filename.endsWith('.pdf')) return 'PDF';
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filename)) return 'Imagen';
  if (mime.includes('spreadsheet') || /\.(xlsx?|csv)$/.test(filename)) return 'Hoja de cálculo';
  if (mime.includes('document') || /\.(docx?|odt)$/.test(filename)) return 'Documento';
  if (mime.includes('presentation') || /\.(pptx?|odp)$/.test(filename)) return 'Presentación';
  if (mime.startsWith('audio/') || /\.(mp3|wav|m4a|ogg|aac|wma)$/.test(filename)) return 'Audio';
  if (mime.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(filename)) return 'Video';
  if (mime.includes('folder')) return 'Carpeta';
  return 'Archivo';
};

const getFileTypeIcon = (file) => {
  const type = getFileTypeLabel(file?.mimeType, file?.name);
  const config = {
    PDF: { icon: <PictureAsPdfIcon fontSize="small" />, label: 'PDF', color: '#dc2626', bg: '#fee2e2' },
    Imagen: { icon: <ImageIcon fontSize="small" />, label: 'IMG', color: '#7c3aed', bg: '#ede9fe' },
    'Hoja de cálculo': { icon: <TableChartIcon fontSize="small" />, label: 'XLS', color: '#047857', bg: '#d1fae5' },
    Documento: { icon: <DescriptionIcon fontSize="small" />, label: 'DOC', color: '#1d4ed8', bg: '#dbeafe' },
    Presentación: { icon: <SlideshowIcon fontSize="small" />, label: 'PPT', color: '#c2410c', bg: '#ffedd5' },
    Audio: { icon: <AudioFileIcon fontSize="small" />, label: 'MP3', color: '#0f766e', bg: '#ccfbf1' },
    Video: { icon: <VideoFileIcon fontSize="small" />, label: 'VID', color: '#be123c', bg: '#ffe4e6' },
    Carpeta: { icon: <FolderOpenIcon fontSize="small" />, label: 'DIR', color: '#d97706', bg: '#fef3c7' },
    Archivo: { icon: <InsertDriveFileIcon fontSize="small" />, label: 'FILE', color: '#475569', bg: '#e2e8f0' }
  }[type] || {};

  return (
    <Box
      sx={{
        width: 42,
        height: 42,
        borderRadius: 2,
        bgcolor: config.bg,
        color: config.color,
        display: 'grid',
        placeItems: 'center',
        position: 'relative',
        border: `1px solid ${config.color}22`,
        flexShrink: 0
      }}
    >
      {config.icon}
      <Box
        component="span"
        sx={{
          position: 'absolute',
          right: -4,
          bottom: -4,
          px: 0.45,
          py: 0.05,
          borderRadius: 0.8,
          bgcolor: config.color,
          color: 'white',
          fontSize: 8,
          fontWeight: 950,
          lineHeight: 1.3,
          border: '1px solid white'
        }}
      >
        {config.label}
      </Box>
    </Box>
  );
};

const formatEvidenceDate = (value) => {
  if (!value) return 'Sin fecha';
  try {
    return new Intl.DateTimeFormat('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(value));
  } catch (error) {
    return value;
  }
};

function Autoevaluacion() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [programa, setPrograma] = useState('');
  const [componentScope, setComponentScope] = useState('general');
  const [view, setView] = useState('resumen');
  const [selectedFactor, setSelectedFactor] = useState('');
  const [dashboard, setDashboard] = useState(null);
  const [baseManagerOpen, setBaseManagerOpen] = useState(false);
  const [activeDataSegment, setActiveDataSegment] = useState('autoevaluacion_base');
  const [importingSubbase, setImportingSubbase] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [savingEdits, setSavingEdits] = useState(false);
  const [deletingParticipantId, setDeletingParticipantId] = useState(null);
  const [aspectDrafts, setAspectDrafts] = useState({});
  const [participantDrafts, setParticipantDrafts] = useState({});
  const [programDrafts, setProgramDrafts] = useState({});
  const [creatingParticipant, setCreatingParticipant] = useState(false);
  const [creatingProgramInfo, setCreatingProgramInfo] = useState(false);
  const [evidenceModal, setEvidenceModal] = useState({ open: false, title: '', folderUrl: '', files: [], loading: false, error: '' });
  const [evidenceBreadcrumbs, setEvidenceBreadcrumbs] = useState([]);
  const [evidenceSearch, setEvidenceSearch] = useState('');
  const [evidenceTypeFilter, setEvidenceTypeFilter] = useState('todos');
  const [evidenceSort, setEvidenceSort] = useState('fecha_desc');
  const [previewFile, setPreviewFile] = useState(null);
  const [newParticipant, setNewParticipant] = useState({
    nombres: '',
    documento: '',
    cargo: '',
    rol: '',
    programa: '',
    alcance: 'RENOVACIÓN REGISTRO CALIFICADO',
    actaInicio: '',
    cronograma: ''
  });
  const [newProgramInfo, setNewProgramInfo] = useState(EMPTY_PROGRAM_INFO_FORM);

  const loadDashboard = useCallback(async (programaSeleccionado = programa) => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getAutoevaluacionDashboard(
        programaSeleccionado ? { programa: programaSeleccionado } : {}
      );
      setDashboard(response.data);
      const firstFactor = response.data?.factores?.[0]?.factor || '';
      setSelectedFactor((current) => current || firstFactor);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar autoevaluación', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, programa]);

  useEffect(() => {
    loadDashboard('');
  }, [loadDashboard]);

  useEffect(() => {
    if (!VIEWS.some((item) => item.key === view)) setView('resumen');
  }, [view]);

  const loadEvidenceFolder = useCallback(async ({ title, folderUrl, breadcrumbs }) => {
    setEvidenceModal((current) => ({ ...current, open: true, title, folderUrl, files: [], loading: true, error: '' }));
    setEvidenceBreadcrumbs(breadcrumbs);

    try {
      const response = await gestionInformacionService.getEvidenciasDrive(folderUrl);
      const files = Array.isArray(response) ? response : response?.data || [];
      setEvidenceModal({ open: true, title, folderUrl, files, loading: false, error: '' });
    } catch (error) {
      setEvidenceModal({
        open: true,
        title,
        folderUrl,
        files: [],
        loading: false,
        error: error.response?.data?.message || 'No fue posible cargar los archivos de la carpeta'
      });
    }
  }, []);

  const openEvidenceModal = useCallback(async ({ title, folderUrl }) => {
    const cleanUrl = getEvidenceUrl(folderUrl);
    if (!cleanUrl) {
      enqueueSnackbar('Esta característica no tiene carpeta de evidencias registrada', { variant: 'warning' });
      return;
    }

    setEvidenceSearch('');
    setEvidenceTypeFilter('todos');
    setEvidenceSort('fecha_desc');
    await loadEvidenceFolder({
      title,
      folderUrl: cleanUrl,
      breadcrumbs: [{ title: 'Evidencias', folderUrl: cleanUrl }]
    });
  }, [enqueueSnackbar, loadEvidenceFolder]);

  const enterEvidenceFolder = useCallback(async (folder) => {
    const folderUrl = folder.folderUrl || folder.webViewLink || folder.id;
    if (!folderUrl) return;
    setEvidenceSearch('');
    await loadEvidenceFolder({
      title: folder.name || 'Carpeta',
      folderUrl,
      breadcrumbs: [...evidenceBreadcrumbs, { title: folder.name || 'Carpeta', folderUrl }]
    });
  }, [evidenceBreadcrumbs, loadEvidenceFolder]);

  const goToEvidenceBreadcrumb = useCallback(async (crumb, index) => {
    setEvidenceSearch('');
    await loadEvidenceFolder({
      title: crumb.title,
      folderUrl: crumb.folderUrl,
      breadcrumbs: evidenceBreadcrumbs.slice(0, index + 1)
    });
  }, [evidenceBreadcrumbs, loadEvidenceFolder]);

  const closeEvidenceModal = () => {
    setEvidenceModal((current) => ({ ...current, open: false }));
    setEvidenceBreadcrumbs([]);
    setPreviewFile(null);
  };

  const resumen = dashboard?.resumen || {};
  const programas = dashboard?.programasDisponibles || [];
  const factores = dashboard?.factores || [];
  const aspectos = dashboard?.aspectos || [];
  const participantes = dashboard?.participantes || [];
  const programasInfo = dashboard?.programasInfo || [];
  const cumplimiento = dashboard?.cumplimiento || [];
  const instrumentos = dashboard?.instrumentos || [];

  const getAspectValue = (item, field) => item ? (aspectDrafts[item.id]?.[field] ?? item[field] ?? '') : '';
  const getParticipantValue = (item, field) => item ? (participantDrafts[item.id]?.[field] ?? item[field] ?? '') : '';
  const getProgramValue = (item, field) => item ? (programDrafts[item.id]?.[field] ?? item[field] ?? '') : '';

  const updateAspectDraft = (item, field, value) => {
    if (!item?.id) return;
    setAspectDrafts((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] || {}),
        [field]: value
      }
    }));
  };

  const updateAspectGroupDraft = (items = [], field, value) => {
    setAspectDrafts((current) => {
      const next = { ...current };
      items.forEach((item) => {
        if (!item?.id) return;
        next[item.id] = {
          ...(next[item.id] || {}),
          [field]: value
        };
      });
      return next;
    });
  };

  const updateParticipantDraft = (item, field, value) => {
    if (!item?.id) return;
    setParticipantDrafts((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] || {}),
        [field]: value
      }
    }));
  };

  const updateProgramDraft = (item, field, value) => {
    if (!item?.id) return;
    setProgramDrafts((current) => ({
      ...current,
      [item.id]: {
        ...(current[item.id] || {}),
        [field]: value
      }
    }));
  };

  const cancelEdits = () => {
    setAspectDrafts({});
    setParticipantDrafts({});
    setProgramDrafts({});
    setEditMode(false);
  };

  const saveEdits = async () => {
    const aspectFieldMap = {
      acuerdoMen: 'acuerdo_men',
      programa: 'programa',
      factor: 'factor',
      caracteristica: 'caracteristica',
      aspecto: 'aspectos_por_evaluar',
      indicador: 'indicador',
      instrumento: 'instrumento',
      scrit: 'scrit',
      componente: 'componente',
      evidencia: 'evidencias',
      informacion: 'informacion_para_tener_en_cuenta'
    };
    const participantFieldMap = {
      programa: 'programa',
      alcance: 'alcance_autoevaluacion',
      actaInicio: 'acta_inicio_url',
      cronograma: 'cronograma_url',
      nombres: 'nombres_completos',
      documento: 'documento',
      cargo: 'cargo',
      rol: 'rol_en_proceso'
    };

    const aspectRequests = Object.entries(aspectDrafts).map(([id, values]) => {
      const source = aspectos.find((item) => Number(item.id) === Number(id));
      if (!source) return null;
      const payload = Object.entries(values).reduce((acc, [field, value]) => {
        const backendField = aspectFieldMap[field];
        if (backendField && String(value ?? '') !== String(source[field] ?? '')) acc[backendField] = value;
        return acc;
      }, {});
      return Object.keys(payload).length
        ? gestionInformacionService.updateAutoevaluacionAspecto(id, payload)
        : null;
    }).filter(Boolean);

    const participantRequests = Object.entries(participantDrafts).map(([id, values]) => {
      const source = participantes.find((item) => Number(item.id) === Number(id));
      if (!source) return null;
      const payload = Object.entries(values).reduce((acc, [field, value]) => {
        const backendField = participantFieldMap[field];
        if (backendField && String(value ?? '') !== String(source[field] ?? '')) acc[backendField] = value;
        return acc;
      }, {});
      return Object.keys(payload).length
        ? gestionInformacionService.updateAutoevaluacionParticipante(id, payload)
        : null;
    }).filter(Boolean);

    const programRequests = Object.entries(programDrafts).map(([id, values]) => {
      const source = programasInfo.find((item) => Number(item.id) === Number(id));
      if (!source) return null;
      const payload = Object.entries(values).reduce((acc, [field, value]) => {
        const backendField = PROGRAMA_INFO_FIELD_MAP[field];
        if (backendField && String(value ?? '') !== String(source[field] ?? '')) acc[backendField] = value;
        return acc;
      }, {});
      return Object.keys(payload).length
        ? gestionInformacionService.updateAutoevaluacionPrograma(id, payload)
        : null;
    }).filter(Boolean);

    if (!aspectRequests.length && !participantRequests.length && !programRequests.length) {
      setEditMode(false);
      return;
    }

    setSavingEdits(true);
    try {
      await Promise.all([...aspectRequests, ...participantRequests, ...programRequests]);
      enqueueSnackbar('Cambios de redacciÃ³n guardados', { variant: 'success' });
      setAspectDrafts({});
      setParticipantDrafts({});
      setProgramDrafts({});
      setEditMode(false);
      await loadDashboard(programa);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al guardar cambios de autoevaluaciÃ³n', { variant: 'error' });
    } finally {
      setSavingEdits(false);
    }
  };

  const createParticipant = async () => {
    const payload = {
      programa: newParticipant.programa || programa || resumen.programaActivo,
      alcance_autoevaluacion: newParticipant.alcance,
      acta_inicio_url: newParticipant.actaInicio,
      cronograma_url: newParticipant.cronograma,
      nombres_completos: newParticipant.nombres,
      documento: newParticipant.documento,
      cargo: newParticipant.cargo,
      rol_en_proceso: newParticipant.rol
    };

    if (!payload.programa || !payload.alcance_autoevaluacion || !payload.nombres_completos) {
      enqueueSnackbar('Completa programa, alcance y nombre del participante', { variant: 'warning' });
      return;
    }

    setCreatingParticipant(true);
    try {
      await gestionInformacionService.createAutoevaluacionParticipante(payload);
      enqueueSnackbar('Participante agregado al equipo', { variant: 'success' });
      setNewParticipant({
        nombres: '',
        documento: '',
        cargo: '',
        rol: '',
        programa: payload.programa,
        alcance: payload.alcance_autoevaluacion,
        actaInicio: payload.acta_inicio_url || '',
        cronograma: payload.cronograma_url || ''
      });
      await loadDashboard(programa);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al agregar participante', { variant: 'error' });
    } finally {
      setCreatingParticipant(false);
    }
  };

  const deleteParticipant = async (item) => {
    if (!item?.id) return;
    const name = item.nombres || item.nombres_completos || 'este participante';
    const confirmed = window.confirm(`¿Eliminar a ${name} del equipo de autoevaluación?`);
    if (!confirmed) return;

    setDeletingParticipantId(item.id);
    try {
      await gestionInformacionService.deleteAutoevaluacionParticipante(item.id);
      setParticipantDrafts((current) => {
        const next = { ...current };
        delete next[item.id];
        return next;
      });
      enqueueSnackbar('Participante eliminado del equipo', { variant: 'success' });
      await loadDashboard(programa);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al eliminar participante', { variant: 'error' });
    } finally {
      setDeletingParticipantId(null);
    }
  };

  const createProgramInfo = async () => {
    const payload = Object.entries(PROGRAMA_INFO_FIELD_MAP).reduce((acc, [field, backendField]) => {
      acc[backendField] = newProgramInfo[field] || '';
      return acc;
    }, {});
    payload.programa = payload.programa || programa || resumen.programaActivo || '';

    if (!payload.programa) {
      enqueueSnackbar('Completa el nombre del programa', { variant: 'warning' });
      return;
    }

    setCreatingProgramInfo(true);
    try {
      const existing = programasInfo.find((item) => String(item.programa || '').trim().toUpperCase() === String(payload.programa || '').trim().toUpperCase());
      if (existing?.id) {
        await gestionInformacionService.updateAutoevaluacionPrograma(existing.id, payload);
        enqueueSnackbar('Informacion oficial del programa actualizada', { variant: 'success' });
      } else {
        await gestionInformacionService.createAutoevaluacionPrograma(payload);
        enqueueSnackbar('Informacion del programa agregada', { variant: 'success' });
      }
      setNewProgramInfo({
        programa: payload.programa,
        procesoAutoevaluacion: payload.proceso_autoevaluacion || 'RENOVACION REGISTRO CALIFICADO',
        facultad: newProgramInfo.facultad,
        nivelFormacion: newProgramInfo.nivelFormacion,
        renovacionRegistroCalificado: '',
        codigoSnies: newProgramInfo.codigoSnies,
        tituloOtorga: newProgramInfo.tituloOtorga,
        emailPrograma: '',
        duracionFormacion: '',
        numeroCreditos: '',
        estudiantesPrimerCurso: ''
      });
      await loadDashboard(programa);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al agregar informacion del programa', { variant: 'error' });
    } finally {
      setCreatingProgramInfo(false);
    }
  };

  const downloadBlob = (blob, filename) => {
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const downloadAutoevaluacionTemplate = async (subbase) => {
    try {
      const response = await gestionInformacionService.downloadTemplate('autoevaluacion', subbase);
      downloadBlob(response.data, `plantilla_autoevaluacion_${subbase}.xlsx`);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No se pudo descargar la plantilla', { variant: 'error' });
    }
  };

  const importAutoevaluacionFile = async (subbase, file) => {
    if (!file) return;
    setImportingSubbase(subbase);
    try {
      await gestionInformacionService.importExcel('autoevaluacion', file, subbase);
      enqueueSnackbar(`Base ${subbase} cargada correctamente`, { variant: 'success' });
      await loadDashboard(programa);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || `No se pudo importar ${subbase}`, { variant: 'error' });
    } finally {
      setImportingSubbase('');
    }
  };

  const handleProgramInfoFieldChange = (field, value) => {
    setNewProgramInfo((prev) => {
      const next = { ...prev, [field]: value };
      if (field === 'facultad') {
        if (!value) return EMPTY_PROGRAM_INFO_FORM;
        next.programa = '';
        next.codigoSnies = '';
        next.nivelFormacion = '';
        next.renovacionRegistroCalificado = '';
        next.tituloOtorga = '';
        next.emailPrograma = '';
        next.duracionFormacion = '';
        next.numeroCreditos = '';
        next.estudiantesPrimerCurso = '';
      }
      if (field === 'programa') {
        if (!value) {
          return {
            ...EMPTY_PROGRAM_INFO_FORM,
            facultad: prev.facultad,
            procesoAutoevaluacion: prev.procesoAutoevaluacion || EMPTY_PROGRAM_INFO_FORM.procesoAutoevaluacion
          };
        }
        const selected = PROGRAM_BY_NAME[value];
        if (selected) {
          next.facultad = selected.facultad;
          next.codigoSnies = selected.codigoSnies;
          next.nivelFormacion = selected.nivelFormacion;
          next.tituloOtorga = selected.programa;
          next.renovacionRegistroCalificado = '';
          next.emailPrograma = '';
          next.duracionFormacion = '';
          next.numeroCreditos = '';
          next.estudiantesPrimerCurso = '';
        }
      }
      return next;
    });
  };

  const filteredProgramCatalog = PROGRAM_CATALOG.filter((item) => (
    !newProgramInfo.facultad || item.facultad === newProgramInfo.facultad
  ));

  const loadProgramInfoIntoForm = (selectedPrograma) => {
    const selectedCatalog = PROGRAM_BY_NAME[selectedPrograma];
    const existing = programasInfo.find((item) => normalizeProgramName(item.programa) === normalizeProgramName(selectedPrograma));
    const isComplete = existing && PROGRAMA_INFO_FIELDS.every(([field]) => String(existing[field] || '').trim() !== '');
    if (existing && isComplete) {
      setNewProgramInfo({
        programa: selectedCatalog?.programa || existing.programa || '',
        procesoAutoevaluacion: existing.procesoAutoevaluacion || 'RENOVACION REGISTRO CALIFICADO',
        facultad: selectedCatalog?.facultad || existing.facultad || '',
        nivelFormacion: existing.nivelFormacion || selectedCatalog?.nivelFormacion || '',
        renovacionRegistroCalificado: existing.renovacionRegistroCalificado || '',
        codigoSnies: existing.codigoSnies || selectedCatalog?.codigoSnies || '',
        tituloOtorga: existing.tituloOtorga || selectedPrograma || '',
        emailPrograma: existing.emailPrograma || '',
        duracionFormacion: existing.duracionFormacion || '',
        numeroCreditos: existing.numeroCreditos || '',
        estudiantesPrimerCurso: existing.estudiantesPrimerCurso || ''
      });
      setProgramDrafts({});
      enqueueSnackbar('Este programa ya tiene informacion registrada. Se cargo para revisar y editar.', { variant: 'info' });
      return;
    }
    if (existing && !isComplete) {
      enqueueSnackbar('El programa existe en base de datos, pero su informacion esta incompleta. Revisa y completa los campos antes de guardar.', { variant: 'warning' });
      return;
    }
    handleProgramInfoFieldChange('programa', selectedPrograma);
    enqueueSnackbar('No hay informacion registrada para este programa. Puedes diligenciarla y guardarla.', { variant: 'warning' });
  };

  const renderTableEditActions = (helper) => (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={1}
      justifyContent="space-between"
      alignItems={{ xs: 'stretch', sm: 'center' }}
      sx={{
        px: 2,
        py: 1.2,
        bgcolor: '#f8fafc',
        borderBottom: '1px solid #e2e8f0'
      }}
    >
      <Stack spacing={0.2}>
        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 900, textTransform: 'uppercase' }}>
          Edicion contextual
        </Typography>
        <Typography variant="caption" sx={{ color: '#475569' }}>
          {helper || 'Los textos se pueden corregir; los valores calculados permanecen bloqueados.'}
        </Typography>
      </Stack>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }}>
        {editMode ? (
          <>
            <Button
              size="small"
              variant="contained"
              startIcon={savingEdits ? <CircularProgress size={15} color="inherit" /> : <SaveIcon />}
              onClick={saveEdits}
              disabled={savingEdits}
              sx={{ textTransform: 'none', fontWeight: 900 }}
            >
              Guardar cambios
            </Button>
            <Button
              size="small"
              variant="outlined"
              startIcon={<CloseIcon />}
              onClick={cancelEdits}
              disabled={savingEdits}
              sx={{ textTransform: 'none', fontWeight: 900 }}
            >
              Cancelar
            </Button>
            <Chip
              size="small"
              label="Valores calculados bloqueados"
              sx={{ bgcolor: '#ecfeff', color: '#0e7490', fontWeight: 900 }}
            />
          </>
        ) : (
          <Button
            size="small"
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setEditMode(true)}
            disabled={!hasData}
            sx={{
              textTransform: 'none',
              fontWeight: 900,
              borderColor: '#93c5fd',
              color: '#1d4ed8',
              bgcolor: 'white',
              '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb' }
            }}
          >
            Editar tabla
          </Button>
        )}
      </Stack>
    </Stack>
  );

  const scopedAspectos = aspectos.filter((item) => {
    const component = normalizeComponentCode(item.componente);
    if (componentScope === 'programa') return component === 'P' || component === 'P/I';
    if (componentScope === 'institucional') return component === 'I' || component === 'P/I';
    return true;
  });

  const scopedFactores = Object.values(
    scopedAspectos.reduce((acc, item) => {
      const key = item.factor || 'SIN FACTOR';
      if (!acc[key]) {
        acc[key] = {
          factor: key,
          nombre: String(key).replace(/^F\s*0*[0-9]+\.?\s*/i, '').trim() || key,
          calificaciones: [],
          aspectos: 0,
          indicadores: new Set(),
          evidencias: 0
        };
      }
      acc[key].aspectos += 1;
      if (item.indicador) acc[key].indicadores.add(item.indicador);
      if (item.evidencia) acc[key].evidencias += 1;
      const score = Number(item.calificacion);
      if (Number.isFinite(score)) acc[key].calificaciones.push(score);
      return acc;
    }, {})
  ).map((item) => {
    const calificacion = item.calificaciones.length
      ? Number((item.calificaciones.reduce((acc, score) => acc + score, 0) / item.calificaciones.length).toFixed(2))
      : null;
    return {
      ...item,
      indicadores: item.indicadores.size,
      calificacion,
      cumplimiento: { label: getScoreLabel(calificacion), tone: cumplimientoColor(getScoreLabel(calificacion)) }
    };
  }).sort((a, b) => (factorNumber(a.factor) || 999) - (factorNumber(b.factor) || 999));

  const scopedScores = scopedAspectos.map((item) => Number(item.calificacion)).filter((value) => Number.isFinite(value));
  const scopedPromedio = scopedScores.length ? Number((scopedScores.reduce((acc, item) => acc + item, 0) / scopedScores.length).toFixed(2)) : null;
  const scopedCaracteristicasCount = new Set(scopedAspectos.map((item) => item.caracteristica).filter(Boolean)).size;
  const scopedIndicadoresCount = new Set(scopedAspectos.map((item) => item.indicador).filter(Boolean)).size;
  const scopedEvidenciasCount = scopedAspectos.filter((item) => item.evidencia).length;
  const scopedResumen = {
    ...resumen,
    promedioGeneral: scopedPromedio,
    cumplimientoGeneral: { label: getScoreLabel(scopedPromedio), tone: cumplimientoColor(getScoreLabel(scopedPromedio)) },
    factores: scopedFactores.length,
    caracteristicas: scopedCaracteristicasCount,
    aspectos: scopedAspectos.length,
    indicadores: scopedIndicadoresCount,
    evidencias: scopedEvidenciasCount,
    coberturaEvidencias: scopedAspectos.length ? Number(((scopedEvidenciasCount / scopedAspectos.length) * 100).toFixed(2)) : 0
  };

  const scopedCumplimiento = Object.values(
    scopedAspectos.reduce((acc, item) => {
      const name = item.cumplimiento?.label || getScoreLabel(item.calificacion);
      acc[name] = acc[name] || { name, total: 0 };
      acc[name].total += 1;
      return acc;
    }, {})
  );
  const scopedInstrumentos = Object.values(
    scopedAspectos.reduce((acc, item) => {
      const name = item.instrumento || 'Sin instrumento';
      acc[name] = acc[name] || { name, total: 0 };
      acc[name].total += 1;
      return acc;
    }, {})
  ).sort((a, b) => b.total - a.total);
  const scopedComponentes = Object.values(
    scopedAspectos.reduce((acc, item) => {
      const name = normalizeComponentCode(item.componente);
      acc[name] = acc[name] || { name, total: 0 };
      acc[name].total += 1;
      return acc;
    }, {})
  ).sort((a, b) => (b.total || 0) - (a.total || 0));
  
  // Eliminadas variables globales que causaban inestabilidad...

  const factores = [...(scopedFactores || [])];
  const instrumentos = [...(scopedInstrumentos || [])];
  const cumplimiento = [...(scopedCumplimiento || [])];

  const selectedFactorNumber = factorNumber(selectedFactor);
  const selectedFactorData = (scopedFactores || []).find((item) => factorNumber(item.factor) === selectedFactorNumber) || scopedFactores[0];
  const factorAspectos = (scopedAspectos || []).filter((item) => factorNumber(item.factor) === factorNumber(selectedFactorData?.factor));
  const factorCaracteristicas = Object.values(
    (factorAspectos || []).reduce((acc, item) => {
      if (!item) return acc;
      const key = item.caracteristica || 'Sin caracteristica';
      if (!acc[key]) {
        acc[key] = {
          caracteristica: key,
          codigo: characteristicCode(key),
          componentes: new Set(),
          aspectos: [],
          calificaciones: []
        };
      }
      acc[key].aspectos.push(item);
      if (item.componente) acc[key].componentes.add(normalizeComponentCode(item.componente));
      const score = Number(item.calificacion);
      if (Number.isFinite(score)) acc[key].calificaciones.push(score);
      return acc;
    }, {})
  ).map((item, index, all) => {
    const scores = item.calificaciones || [];
    const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    const aspectos = item.aspectos || [];
    const importancia = Math.max(1, aspectos.length);
    const totalImportancia = all.reduce((acc, current) => acc + Math.max(1, (current.aspectos || []).length), 0) || 1;
    const ponderacion = (importancia / totalImportancia) * 100;
    const firstAspect = aspectos[0] || {};
    const label = firstAspect.cumplimiento?.label || 'SIN CALIFICAR';
    const componenteResumen = resolveComponentSummary(Array.from(item.componentes || []));
    const evidencias = aspectos.map((a) => getEvidenceUrl(a?.evidencia)).filter(Boolean);
    
    return {
      ...item,
      componenteResumen,
      evidencia: evidencias[0] || '',
      evidencias,
      importancia,
      ponderacion,
      calificacion: Number(avg.toFixed(2)),
      cumplimiento: label,
      color: cumplimientoColor(label)
    };
  });

  const chartFactores = scopedFactores.map((item) => ({
    factor: shortFactorLabel(item.factor),
    nombre: item.nombre,
    calificacion: Number(item.calificacion || 0),
    cumplimiento: item.cumplimiento?.label || 'SIN CALIFICAR'
  }));
  const factorChartStats = {
    critical: (factorCaracteristicas || []).filter((item) => Number(item.calificacion || 0) < 3.5),
    best: (factorCaracteristicas || []).length ? [...factorCaracteristicas].sort((a, b) => Number(b.calificacion || 0) - Number(a.calificacion || 0))[0] : null,
    lowest: (factorCaracteristicas || []).length ? [...factorCaracteristicas].sort((a, b) => Number(a.calificacion || 0) - Number(b.calificacion || 0))[0] : null
  };

  const riesgos = scopedAspectos
    .filter((item) => Number(item.calificacion) < 3.5)
    .sort((a, b) => Number(a.calificacion || 0) - Number(b.calificacion || 0))
    .slice(0, 8);

  const evidenceCoverage = Number(scopedResumen.coberturaEvidencias || 0);
  const hasData = Number(scopedResumen.aspectos || 0) > 0 || programasInfo.length > 0 || participantes.length > 0;
  const evidenceFilesFiltered = evidenceModal.files
    .filter((file) => {
      const query = evidenceSearch.trim().toLowerCase();
      const fileType = getFileTypeLabel(file.mimeType, file.name);
      const matchesType = evidenceTypeFilter === 'todos' || fileType === evidenceTypeFilter;
      const matchesSearch = !query || String(file.name || '').toLowerCase().includes(query);
      return matchesType && matchesSearch;
    })
    .sort((a, b) => {
      if (evidenceSort === 'nombre_asc') return String(a.name || '').localeCompare(String(b.name || ''));
      if (evidenceSort === 'nombre_desc') return String(b.name || '').localeCompare(String(a.name || ''));
      const dateA = new Date(a.modifiedTime || 0).getTime();
      const dateB = new Date(b.modifiedTime || 0).getTime();
      return evidenceSort === 'fecha_asc' ? dateA - dateB : dateB - dateA;
    });
  const evidenceTypeOptions = Array.from(new Set(evidenceModal.files.map((file) => getFileTypeLabel(file.mimeType, file.name))));
  const activeProgramaInfo = programasInfo.find((item) => (
    programa
      ? String(item.programa || '').trim().toLowerCase() === String(programa || '').trim().toLowerCase()
      : true
  )) || programasInfo[0] || null;
  const resumenEquipo = participantes.slice(0, 6);
  const selectedProgramInfoRecord = programasInfo.find((item) => normalizeProgramName(item.programa) === normalizeProgramName(newProgramInfo.programa));
  const selectedProgramInfoComplete = Boolean(selectedProgramInfoRecord)
    && PROGRAMA_INFO_FIELDS.every(([field]) => String(selectedProgramInfoRecord[field] || '').trim() !== '');

  const renderProgramInfoTable = (compact = false) => (
    <Paper elevation={0} sx={{ border: '1px solid #dbeafe', borderRadius: 3, overflow: 'hidden', width: '100%' }}>
      <Box sx={{ px: 2, py: 1.3, bgcolor: '#1f4e95', color: 'white' }}>
        <Typography sx={{ fontWeight: 950, textTransform: 'uppercase' }}>Informacion del programa academico</Typography>
      </Box>
      {activeProgramaInfo && renderTableEditActions('Edita la ficha base del programa que alimenta el resumen de autoevaluacion.')}
      <TableContainer>
        <Table size="small">
          <TableBody>
            {PROGRAMA_INFO_FIELDS.map(([field, label]) => (
              <TableRow key={field}>
                <TableCell sx={{ width: { xs: 190, md: compact ? 260 : 340 }, bgcolor: '#f1f5f9', fontWeight: 950, color: '#0f172a' }}>
                  {label}
                </TableCell>
                <TableCell>
                  {activeProgramaInfo ? (
                    <EditableText
                      editing={editMode}
                      value={getProgramValue(activeProgramaInfo, field)}
                      onChange={(value) => updateProgramDraft(activeProgramaInfo, field, value)}
                      minWidth={compact ? 220 : 320}
                      multiline={['facultad', 'tituloOtorga', 'renovacionRegistroCalificado'].includes(field)}
                      placeholder="Diligenciar"
                    />
                  ) : (
                    <Typography variant="body2" sx={{ color: '#dc2626' }}>Diligenciar</Typography>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  const renderTeamSummaryTable = () => (
    <Paper elevation={0} sx={{ border: '1px solid #dbeafe', borderRadius: 3, overflow: 'hidden', width: '100%' }}>
      <Box sx={{ px: 2, py: 1.3, bgcolor: '#0f766e', color: 'white' }}>
        <Typography sx={{ fontWeight: 950, textTransform: 'uppercase' }}>Equipo asignado al proceso</Typography>
      </Box>
      {renderTableEditActions('Edita el equipo que trabaja el proceso de autoevaluacion.')}
      <TableContainer>
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 950 }}>Nombre</TableCell>
              <TableCell sx={{ fontWeight: 950 }}>Documento</TableCell>
              <TableCell sx={{ fontWeight: 950 }}>Cargo</TableCell>
              <TableCell sx={{ fontWeight: 950 }}>Rol</TableCell>
              <TableCell align="right" sx={{ fontWeight: 950, width: 130 }}>Acciones</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {resumenEquipo.map((item, index) => (
              <TableRow key={`${item.documento || item.nombres}-${index}`}>
                <TableCell sx={{ minWidth: 220 }}>
                  <EditableText editing={editMode} value={getParticipantValue(item, 'nombres')} onChange={(value) => updateParticipantDraft(item, 'nombres', value)} minWidth={220} />
                </TableCell>
                <TableCell sx={{ minWidth: 120 }}>
                  <EditableText editing={editMode} value={getParticipantValue(item, 'documento')} onChange={(value) => updateParticipantDraft(item, 'documento', value)} minWidth={120} placeholder="-" />
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <EditableText editing={editMode} value={getParticipantValue(item, 'cargo')} onChange={(value) => updateParticipantDraft(item, 'cargo', value)} minWidth={180} />
                </TableCell>
                <TableCell sx={{ minWidth: 180 }}>
                  <EditableText editing={editMode} value={getParticipantValue(item, 'rol')} onChange={(value) => updateParticipantDraft(item, 'rol', value)} minWidth={180} />
                </TableCell>
                <TableCell align="right">
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    startIcon={deletingParticipantId === item.id ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlineIcon fontSize="small" />}
                    onClick={() => deleteParticipant(item)}
                    disabled={deletingParticipantId === item.id || savingEdits}
                    sx={{ textTransform: 'none', fontWeight: 900, borderRadius: 2 }}
                  >
                    Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {!resumenEquipo.length && <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}>No hay equipo asignado.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  const renderBaseManager = () => (
    <Paper elevation={0} sx={{ p: 2, mb: 2.4, border: '1px solid #dbeafe', borderRadius: 3, bgcolor: '#fbfdff' }}>
      <Stack spacing={2.2}>
        <Box>
          <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Gestion de bases de Autoevaluacion</Typography>
          <Typography variant="body2" sx={{ color: '#64748b' }}>
            Selecciona un segmento para descargar plantilla, adjuntar archivo o diligenciar datos desde interfaz.
          </Typography>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1 }}>
          {(AUTOEVALUACION_BASES || []).map((item) => (
            <Button
              key={item.key}
              onClick={() => setActiveDataSegment(item.key)}
              startIcon={item.icon || null}
              sx={{
                minHeight: 58,
                borderRadius: 2,
                textTransform: 'none',
                fontWeight: 950,
                justifyContent: 'center',
                color: activeDataSegment === item.key ? 'white' : item.color,
                bgcolor: activeDataSegment === item.key ? item.color : 'white',
                border: `1px solid ${item.color}55`,
                boxShadow: activeDataSegment === item.key ? `0 14px 30px ${item.color}24` : 'none',
                '&:hover': { bgcolor: activeDataSegment === item.key ? item.color : `${item.color}12` }
              }}
            >
              {item.title}
            </Button>
          ))}
        </Box>
        {(AUTOEVALUACION_BASES || []).filter((item) => item.key === activeDataSegment).map((item) => (
          <Paper key={item.key} elevation={0} sx={{ p: 1.8, border: `1px solid ${item.color}44`, borderRadius: 3, bgcolor: 'white' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }}>
              <Stack direction="row" spacing={1.2} alignItems="center">
                <Box sx={{ width: 42, height: 42, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: `${item.color}16`, color: item.color }}>
                  {item.icon || null}
                </Box>
                <Box>
                  <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>{item.title}</Typography>
                  <Typography variant="body2" sx={{ color: '#64748b' }}>{item.description}</Typography>
                </Box>
              </Stack>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                <Button variant="outlined" startIcon={<CloudDownloadIcon />} onClick={() => downloadAutoevaluacionTemplate(item.key)} sx={{ textTransform: 'none', fontWeight: 900, borderColor: `${item.color}77`, color: item.color }}>
                  Descargar plantilla
                </Button>
                <Button component="label" variant="contained" startIcon={importingSubbase === item.key ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />} sx={{ textTransform: 'none', fontWeight: 900, bgcolor: item.color }}>
                  Adjuntar base
                  <input hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => importAutoevaluacionFile(item.key, event.target.files?.[0])} />
                </Button>
              </Stack>
            </Stack>
          </Paper>
        ))}

        {activeDataSegment === 'Participantes' && (
          <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #99d5ca', borderRadius: 3, bgcolor: 'white' }}>
            <Typography sx={{ fontWeight: 950, mb: 1 }}>Formulario Equipo de autoevaluacion</Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
              <TextField select size="small" label="Programa" value={newParticipant.programa || programa || resumen?.programaActivo || ''} onChange={(event) => setNewParticipant((prev) => ({ ...prev, programa: event.target.value }))}>
                {(PROGRAM_CATALOG || []).map((item) => <MenuItem key={item.programa} value={item.programa}>{item.programa}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Alcance" value={newParticipant.alcance} onChange={(event) => setNewParticipant((prev) => ({ ...prev, alcance: event.target.value }))}>
                <MenuItem value="RENOVACION REGISTRO CALIFICADO">RENOVACION REGISTRO CALIFICADO</MenuItem>
                <MenuItem value="ACREDITACION ALTA CALIDAD">ACREDITACION ALTA CALIDAD</MenuItem>
              </TextField>
              <TextField size="small" label="Nombres completos" value={newParticipant.nombres} onChange={(event) => setNewParticipant((prev) => ({ ...prev, nombres: event.target.value }))} />
              <TextField size="small" label="Documento" value={newParticipant.documento} onChange={(event) => setNewParticipant((prev) => ({ ...prev, documento: event.target.value }))} />
              <TextField size="small" label="Cargo" value={newParticipant.cargo} onChange={(event) => setNewParticipant((prev) => ({ ...prev, cargo: event.target.value }))} />
              <TextField size="small" label="Rol en el proceso" value={newParticipant.rol} onChange={(event) => setNewParticipant((prev) => ({ ...prev, rol: event.target.value }))} />
            </Box>
            <Button variant="contained" startIcon={<PersonAddIcon />} onClick={createParticipant} disabled={creatingParticipant} sx={{ mt: 1.2, textTransform: 'none', fontWeight: 900, bgcolor: '#0f766e' }}>
              {creatingParticipant ? 'Agregando...' : 'Agregar participante'}
            </Button>
          </Paper>
        )}

        {activeDataSegment === 'informacion_programas' && (
          <Paper elevation={0} sx={{ p: 1.8, border: '1px solid #fed7aa', borderRadius: 3, bgcolor: 'white' }}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" sx={{ mb: 1.2 }}>
              <Box>
                <Typography sx={{ fontWeight: 950 }}>Formulario informacion_programas</Typography>
                <Typography variant="caption" sx={{ color: '#64748b' }}>
                  Selecciona facultad y programa; el SNIES se completa desde el catalogo oficial.
                </Typography>
              </Box>
              {selectedProgramInfoComplete && (
                <Button
                  variant="contained"
                  onClick={() => loadProgramInfoIntoForm(newProgramInfo.programa)}
                  sx={{
                    minHeight: 40,
                    px: 2,
                    textTransform: 'none',
                    fontWeight: 950,
                    bgcolor: '#047857',
                    '&:hover': { bgcolor: '#065f46' }
                  }}
                >
                  Revisar informacion registrada
                </Button>
              )}
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1 }}>
              <TextField select size="small" label="Facultad" value={newProgramInfo.facultad} onChange={(event) => handleProgramInfoFieldChange('facultad', event.target.value)}>
                {FACULTY_OPTIONS.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Nombre del Programa" value={newProgramInfo.programa} onChange={(event) => handleProgramInfoFieldChange('programa', event.target.value)}>
                {filteredProgramCatalog.map((item) => <MenuItem key={item.programa} value={item.programa}>{item.programa}</MenuItem>)}
              </TextField>
              <TextField select size="small" label="Proceso autoevaluacion" value={newProgramInfo.procesoAutoevaluacion} onChange={(event) => handleProgramInfoFieldChange('procesoAutoevaluacion', event.target.value)}>
                <MenuItem value="RENOVACION REGISTRO CALIFICADO">RENOVACION REGISTRO CALIFICADO</MenuItem>
                <MenuItem value="ACREDITACION ALTA CALIDAD">ACREDITACION ALTA CALIDAD</MenuItem>
              </TextField>
              <TextField size="small" label="Codigo SNIES" value={newProgramInfo.codigoSnies} onChange={(event) => handleProgramInfoFieldChange('codigoSnies', event.target.value)} />
              <TextField size="small" label="Nivel de Formacion" value={newProgramInfo.nivelFormacion} onChange={(event) => handleProgramInfoFieldChange('nivelFormacion', event.target.value)} />
              <TextField size="small" label="Renovacion Registro Calificado" value={newProgramInfo.renovacionRegistroCalificado} onChange={(event) => handleProgramInfoFieldChange('renovacionRegistroCalificado', event.target.value)} />
              <TextField size="small" label="Titulo que Otorga" value={newProgramInfo.tituloOtorga} onChange={(event) => handleProgramInfoFieldChange('tituloOtorga', event.target.value)} />
              <TextField size="small" label="E-mail del Programa" value={newProgramInfo.emailPrograma} onChange={(event) => handleProgramInfoFieldChange('emailPrograma', event.target.value)} />
              <TextField size="small" label="Duracion de Formacion" value={newProgramInfo.duracionFormacion} onChange={(event) => handleProgramInfoFieldChange('duracionFormacion', event.target.value)} />
              <TextField size="small" label="Numero de Creditos" value={newProgramInfo.numeroCreditos} onChange={(event) => handleProgramInfoFieldChange('numeroCreditos', event.target.value)} />
              <TextField size="small" label="Estudiantes a admitir a primer curso" value={newProgramInfo.estudiantesPrimerCurso} onChange={(event) => handleProgramInfoFieldChange('estudiantesPrimerCurso', event.target.value)} />
            </Box>
            <Button variant="contained" startIcon={<SaveIcon />} onClick={createProgramInfo} disabled={creatingProgramInfo} sx={{ mt: 1.2, textTransform: 'none', fontWeight: 900, bgcolor: '#d97706' }}>
              {creatingProgramInfo ? 'Guardando...' : 'Guardar informacion del programa'}
            </Button>
          </Paper>
        )}
      </Stack>
    </Paper>
  );

  const renderResumen = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.2, width: '100%', maxWidth: 'none' }}>
      <Box sx={{ width: '100%' }}>
        <Box
          sx={{
            display: 'grid',
            width: '100%',
            boxSizing: 'border-box',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              lg: 'repeat(3, minmax(0, 1fr))'
            },
            gap: 2.2
          }}
        >
          <Metric label="Factores" value={resumen.factores || 0} helper={`${resumen.caracteristicas || 0} características`} icon={<HubIcon />} />
          <Metric label="Características" value={resumen.caracteristicas || 0} helper="Agrupadas por factor" color="#17366f" icon={<FactCheckIcon />} />
          <Metric label="Aspectos por evaluar" value={resumen.aspectos || 0} helper="Registros de la base Autoevaluación" color="#0f766e" icon={<InventoryIcon />} />
          <Metric label="Indicadores" value={resumen.indicadores || 0} helper="Indicadores únicos registrados" color="#1f4e95" icon={<AutoGraphIcon />} />
          <Metric label="Evidencias" value={`${formatScore(evidenceCoverage)}%`} helper={`${resumen.evidencias || 0} enlaces registrados`} color="#2563eb" icon={<CheckCircleIcon />} />
          <Metric label="Nota general" value={formatScore(resumen.promedioGeneral)} helper={resumen.cumplimientoGeneral?.label} color={scoreTone(resumen.cumplimientoGeneral)} icon={<FactCheckIcon />} />
        </Box>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.2, width: '100%' }}>
        {renderProgramInfoTable()}
        {renderTeamSummaryTable()}
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.2,
          width: '100%',
          maxWidth: 'none'
        }}
      >
      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Paper elevation={0} sx={{ p: 2.4, border: '1px solid #e2e8f0', borderRadius: 3, height: { xs: 460, lg: 520 }, width: '100%', boxSizing: 'border-box' }}>
          <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
            <Box>
              <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Mapa de desempeño por factor</Typography>
              <Typography variant="body2" sx={{ color: '#64748b' }}>El color representa el juicio de valor del libro de autoevaluación.</Typography>
            </Box>
          </Stack>
          <ResponsiveContainer width="100%" height={410}>
            <BarChart data={chartFactores} margin={{ top: 18, right: 28, left: 8, bottom: 38 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="factor" tick={{ fontSize: 12, fontWeight: 800 }} label={{ value: 'Factores', position: 'insideBottom', offset: -10 }} />
              <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} label={{ value: 'Calificación', angle: -90, position: 'insideLeft', offset: 0 }} />
              <Tooltip formatter={(value) => [formatScore(value), 'Calificación']} />
              <Bar dataKey="calificacion" radius={[8, 8, 0, 0]} maxBarSize={72}>
                <LabelList dataKey="calificacion" position="top" formatter={(value) => formatScore(value)} style={{ fontSize: 12, fontWeight: 900, fill: '#0f172a' }} />
                {chartFactores.map((entry) => (
                  <Cell key={entry.factor} fill={entry.cumplimiento.includes('ALTO') || entry.cumplimiento.includes('PLENAMENTE') ? '#1f4e95' : '#d97706'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Paper>
      </Box>

      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Paper elevation={0} sx={{ p: 2.4, border: '1px solid #e2e8f0', borderRadius: 3, height: { xs: 'auto', lg: 520 }, width: '100%', boxSizing: 'border-box' }}>
          <Typography sx={{ fontWeight: 950, color: '#0f172a', mb: 1 }}>Balance de cumplimiento</Typography>
          <ResponsiveContainer width="100%" height={330}>
            <PieChart>
              <Pie
                data={cumplimiento}
                dataKey="total"
                nameKey="name"
                innerRadius={56}
                outerRadius={92}
                paddingAngle={2}
                labelLine={false}
                label={({ percent, total }) => total ? `${total} (${(percent * 100).toFixed(0)}%)` : ''}
              >
                {cumplimiento.map((entry) => <Cell key={entry.name} fill={cumplimientoColor(entry.name)} />)}
              </Pie>
              <Tooltip formatter={(value) => [value, 'Aspectos']} />
            </PieChart>
          </ResponsiveContainer>
          <Stack spacing={0.7}>
            {cumplimiento.map((item) => (
              <Stack key={item.name} direction="row" justifyContent="space-between" alignItems="center">
                <Typography variant="caption" sx={{ color: '#475569', fontWeight: 800 }}>{item.name}</Typography>
                <Chip size="small" label={item.total} sx={{ fontWeight: 900 }} />
              </Stack>
            ))}
          </Stack>
        </Paper>
      </Box>
      </Box>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' },
          gap: 2.2,
          width: '100%',
          maxWidth: 'none'
        }}
      >
      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #e2e8f0', borderRadius: 3, width: '100%', boxSizing: 'border-box' }}>
          <Typography sx={{ fontWeight: 950, color: '#0f172a', mb: 1 }}>Alertas para mejoramiento</Typography>
          <Stack spacing={1}>
            {riesgos.map((item, index) => (
              <Box key={`${item.aspecto}-${index}`} sx={{ p: 1.3, border: '1px solid #fee2e2', borderRadius: 2, bgcolor: '#fff7f7' }}>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <WarningAmberIcon sx={{ color: '#dc2626', mt: 0.2 }} />
                  <Box>
                    <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 900 }}>{item.factor} · {item.caracteristica}</Typography>
                    <Typography variant="caption" sx={{ color: '#475569' }}>{item.aspecto}</Typography>
                    <Box sx={{ mt: 0.7 }}><ScoreChip value={item.calificacion} label={item.cumplimiento?.label} /></Box>
                  </Box>
                </Stack>
              </Box>
            ))}
            {!riesgos.length && <Alert severity="success">No se detectan aspectos por debajo de 3.5.</Alert>}
          </Stack>
        </Paper>
      </Box>

      <Box sx={{ minWidth: 0, width: '100%' }}>
        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #e2e8f0', borderRadius: 3, width: '100%', boxSizing: 'border-box' }}>
          <Typography sx={{ fontWeight: 950, color: '#0f172a', mb: 1 }}>Fuentes de evidencia</Typography>
          <Stack spacing={1}>
            {instrumentos.slice(0, 8).map((item) => (
              <Box key={item.name} sx={{ p: 1.2, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.7 }}>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>{item.name}</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 900 }}>{item.total}</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={Math.min(100, (item.total / Math.max(resumen.aspectos || 1, 1)) * 100)} sx={{ height: 7, borderRadius: 8 }} />
              </Box>
            ))}
          </Stack>
        </Paper>
      </Box>
      </Box>
    </Box>
  );

  const renderFactores = () => (
    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2.2, width: '100%', maxWidth: 'none' }}>
      <Box sx={{ width: '100%', minWidth: 0 }}>
        <Paper elevation={0} sx={{ p: 1, border: '1px solid #dbeafe', borderRadius: 3, width: '100%', boxSizing: 'border-box' }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(3, minmax(0, 1fr))',
                sm: 'repeat(4, minmax(0, 1fr))',
                md: 'repeat(7, minmax(0, 1fr))',
                xl: 'repeat(13, minmax(0, 1fr))'
              },
              gap: 0.9,
              width: '100%'
            }}
          >
            {factores.map((factor) => {
              const active = factorNumber(factor.factor) === factorNumber(selectedFactorData?.factor);
              const color = cumplimientoColor(factor.cumplimiento?.label);
              return (
                <MuiTooltip key={factor.factor} title={`${factor.factor}. ${factor.nombre || ''}`} arrow>
                  <Button
                    onClick={() => setSelectedFactor(factor.factor)}
                    sx={{
                      width: '100%',
                      minWidth: 0,
                      height: 58,
                      justifyContent: 'center',
                      textAlign: 'center',
                      borderRadius: 2,
                      px: 1,
                      py: 0.7,
                      bgcolor: active ? `${color}18` : 'white',
                      color: active ? color : '#334155',
                      border: `1px solid ${active ? `${color}66` : '#e2e8f0'}`,
                      textTransform: 'none',
                      '&:hover': {
                        bgcolor: `${color}12`,
                        borderColor: color
                      }
                    }}
                  >
                    <Box>
                      <Typography sx={{ fontWeight: 950, lineHeight: 1, whiteSpace: 'nowrap', fontSize: { xs: 12, sm: 14 } }}>{shortFactorLabel(factor.factor)}</Typography>
                      <Typography variant="caption" sx={{ display: 'block', color: active ? color : '#64748b', mt: 0.5 }}>{formatScore(factor.calificacion)}</Typography>
                    </Box>
                  </Button>
                </MuiTooltip>
              );
            })}
          </Box>
        </Paper>
      </Box>
      <Box sx={{ width: '100%', minWidth: 0 }}>
        <Paper
          elevation={0}
          sx={{
            p: 2.3,
            mb: 2,
            borderRadius: 3,
            color: 'white',
            background: 'linear-gradient(120deg, #17366f 0%, #1f4e95 58%, #2563eb 100%)'
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.4} alignItems={{ xs: 'flex-start', md: 'center' }}>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950 }}>{shortFactorLabel(selectedFactorData?.factor)}. {selectedFactorData?.nombre}</Typography>
              <Typography sx={{ color: '#dbeafe' }}>{selectedFactorData?.aspectos || 0} aspectos · {selectedFactorData?.indicadores || 0} indicadores · {selectedFactorData?.evidencias || 0} evidencias</Typography>
            </Box>
            <ScoreChip value={selectedFactorData?.calificacion} label={selectedFactorData?.cumplimiento?.label} />
          </Stack>
        </Paper>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2, width: '100%', maxWidth: 'none' }}>
          <Box sx={{ width: '100%', minWidth: 0 }}>
            <Paper elevation={0} sx={{ border: '1px solid #dbeafe', borderRadius: 3, overflow: 'hidden', mb: 2, width: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ px: 2, py: 1.2, bgcolor: '#1f4e95', color: 'white' }}>
                <Typography sx={{ fontWeight: 950, textTransform: 'uppercase' }}>Características</Typography>
              </Box>
              {renderTableEditActions('Puedes corregir la redaccion de las caracteristicas. Importancia, peso y calificacion siguen protegidos por el calculo.')}
              <TableContainer sx={{ width: '100%', overflowX: 'auto' }}>
                  <Table size="small" sx={{ minWidth: 1120, '& td, & th': { borderColor: '#cbd5e1' } }}>
                  <TableHead>
                    <TableRow sx={{ bgcolor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 950, width: 72 }}>Código</TableCell>
                      <TableCell sx={{ fontWeight: 950 }}>Características</TableCell>
                      <TableCell sx={{ fontWeight: 950, width: 130, textAlign: 'center' }}>Componente</TableCell>
                      <TableCell sx={{ fontWeight: 950, width: 92, textAlign: 'center' }}>Importancia</TableCell>
                      <TableCell sx={{ fontWeight: 950, width: 92, textAlign: 'center' }}>Peso</TableCell>
                      <TableCell sx={{ fontWeight: 950, width: 105, textAlign: 'center' }}>Calificación</TableCell>
                      <TableCell sx={{ fontWeight: 950, width: 44, textAlign: 'center' }} />
                      <TableCell sx={{ fontWeight: 950, width: 190 }}>Grado de cumplimiento</TableCell>
                      <TableCell sx={{ fontWeight: 950, width: 150, textAlign: 'center' }}>Evidencias</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {factorCaracteristicas.map((item) => (
                      <TableRow
                        key={item.caracteristica}
                        hover
                        sx={{
                          bgcolor: isCriticalCompliance(item.cumplimiento, item.calificacion) ? '#fff1f2' : 'inherit',
                          '&:hover': { bgcolor: isCriticalCompliance(item.cumplimiento, item.calificacion) ? '#ffe4e6' : '#f8fafc' }
                        }}
                      >
                        <TableCell sx={{ fontWeight: 950 }}>{item.codigo || 'C'}</TableCell>
                        <TableCell>
                          <EditableText
                            editing={editMode}
                            value={getAspectValue(item.aspectos[0], 'caracteristica') || item.caracteristica}
                            onChange={(value) => updateAspectGroupDraft(item.aspectos, 'caracteristica', value)}
                            minWidth={260}
                            multiline
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Stack direction="row" spacing={0.5} justifyContent="center" sx={{ flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              label={componentDisplayLabel(item.componenteResumen, componentScope)}
                              sx={{
                                height: 24,
                                fontWeight: 950,
                                bgcolor: item.componenteResumen === 'P' ? '#ecfdf5' : item.componenteResumen === 'I' ? '#eff6ff' : '#fff7ed',
                                color: item.componenteResumen === 'P' ? '#047857' : item.componenteResumen === 'I' ? '#1d4ed8' : '#d97706'
                              }}
                            />
                          </Stack>
                        </TableCell>
                        <TableCell align="center">{item.importancia}</TableCell>
                        <TableCell align="center">{item.ponderacion.toFixed(0)}%</TableCell>
                        <TableCell align="center" sx={{ fontWeight: 950, color: isCriticalCompliance(item.cumplimiento, item.calificacion) ? '#991b1b' : '#0f172a' }}>{formatScore(item.calificacion)}</TableCell>
                        <TableCell align="center"><ComplianceMark label={item.cumplimiento} /></TableCell>
                        <TableCell sx={{ fontSize: 12, fontWeight: 850, color: isCriticalCompliance(item.cumplimiento, item.calificacion) ? '#991b1b' : '#0f172a' }}>{item.cumplimiento}</TableCell>
                        <TableCell align="center">
                          {item.evidencia ? (
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<FolderOpenIcon />}
                              onClick={() => openEvidenceModal({
                                title: `${item.codigo || 'C'} · ${item.caracteristica}`,
                                folderUrl: item.evidencia
                              })}
                              sx={{
                                textTransform: 'none',
                                fontWeight: 900,
                                borderRadius: 2,
                                whiteSpace: 'nowrap',
                                color: '#1d4ed8',
                                borderColor: '#bfdbfe',
                                bgcolor: '#eff6ff',
                                '&:hover': { bgcolor: '#dbeafe', borderColor: '#2563eb' }
                              }}
                            >
                              Ver evidencias
                            </Button>
                          ) : (
                            <Chip size="small" label="Sin evidencias" sx={{ bgcolor: '#f1f5f9', color: '#64748b', fontWeight: 800 }} />
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow sx={{ bgcolor: '#eef2ff' }}>
                      <TableCell colSpan={3} sx={{ fontWeight: 950 }}>Ponderación calculada y nota del factor</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 950 }}>{factorCaracteristicas.reduce((acc, item) => acc + item.importancia, 0)}</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 950 }}>100%</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 950, bgcolor: '#315895', color: 'white' }}>{formatScore(selectedFactorData?.calificacion)}</TableCell>
                      <TableCell align="center"><ComplianceMark label={selectedFactorData?.cumplimiento?.label} /></TableCell>
                      <TableCell sx={{ fontSize: 12, fontWeight: 950 }}>{selectedFactorData?.cumplimiento?.label}</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>

          <Box sx={{ width: '100%', minWidth: 0 }}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr',
                gap: 2,
                width: '100%',
                maxWidth: 'none'
              }}
            >
              <Box sx={{ width: '100%', minWidth: 0 }}>
            <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbeafe', borderRadius: 3, width: '100%', boxSizing: 'border-box', bgcolor: 'white' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 1.2 }}>
                <Box>
                  <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Calificación por característica</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>{shortFactorLabel(selectedFactorData?.factor)}. {selectedFactorData?.nombre}</Typography>
                </Box>
                <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
                  <Chip size="small" label={`Promedio ${formatScore(selectedFactorData?.calificacion)}`} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 900 }} />
                  <Chip size="small" label={`${factorChartStats.critical.length} bajo meta`} sx={{ bgcolor: factorChartStats.critical.length ? '#ffedd5' : '#dcfce7', color: factorChartStats.critical.length ? '#c2410c' : '#15803d', fontWeight: 900 }} />
                </Stack>
              </Stack>
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={factorCaracteristicas} margin={{ top: 24, right: 28, left: 8, bottom: 34 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbeafe" />
                  <XAxis dataKey="codigo" tick={{ fontSize: 12, fontWeight: 800 }} label={{ value: 'Características', position: 'insideBottom', offset: -8 }} />
                  <YAxis domain={[0, 5]} tick={{ fontSize: 12 }} label={{ value: 'Calificación', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => [formatScore(value), 'Calificación']} labelFormatter={(label) => `Característica ${label}`} />
                  <ReferenceLine y={3.5} stroke="#ea580c" strokeDasharray="6 6" label={{ value: 'Meta 3.5', position: 'right', fill: '#ea580c', fontSize: 12, fontWeight: 900 }} />
                  <Bar dataKey="calificacion" radius={[10, 10, 0, 0]} maxBarSize={96}>
                    <LabelList dataKey="calificacion" position="top" formatter={(value) => formatScore(value)} style={{ fontSize: 12, fontWeight: 900, fill: '#0f172a' }} />
                    {factorCaracteristicas.map((item) => (
                      <Cell key={item.caracteristica} fill={Number(item.calificacion) < 3.5 ? '#d97706' : '#1f4e95'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <Alert severity={factorChartStats.critical.length ? 'warning' : 'success'} sx={{ mt: 1.5, borderRadius: 2 }}>
                {factorChartStats.critical.length
                  ? `Prioriza ${factorChartStats.critical.map((item) => item.codigo).join(', ')} porque se encuentran por debajo de la meta institucional.`
                  : `Todas las características del factor cumplen la meta institucional. La mejor valoración es ${factorChartStats.best?.codigo || 'N/A'} con ${formatScore(factorChartStats.best?.calificacion)}.`}
              </Alert>
            </Paper>
              </Box>

              {/* Mapa importancia / calificación removido temporalmente por estabilidad */}
            </Box>
          </Box>

          <Box sx={{ width: '100%', minWidth: 0 }}>
            <Paper elevation={0} sx={{ border: '1px solid #dbeafe', borderRadius: 3, overflow: 'hidden', width: '100%', boxSizing: 'border-box' }}>
              <Box sx={{ px: 2, py: 1.2, bgcolor: '#1f4e95', color: 'white' }}>
                <Typography sx={{ fontWeight: 950, textTransform: 'uppercase' }}>Análisis de la información</Typography>
              </Box>
              {renderTableEditActions('Edita aspectos e indicadores del factor seleccionado sin tocar la nota calculada.')}
              <TableContainer sx={{ maxHeight: 620 }}>
                <Table size="small" stickyHeader sx={{ '& td, & th': { borderColor: '#cbd5e1' } }}>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 950, bgcolor: '#f8fafc', width: 230 }}>Características</TableCell>
                      <TableCell sx={{ fontWeight: 950, bgcolor: '#f8fafc' }}>Aspecto</TableCell>
                      <TableCell sx={{ fontWeight: 950, bgcolor: '#f8fafc', width: 120, textAlign: 'center' }}>Componente</TableCell>
                      <TableCell sx={{ fontWeight: 950, bgcolor: '#f8fafc', width: 118, textAlign: 'center' }}>Calificación</TableCell>
                      <TableCell sx={{ fontWeight: 950, bgcolor: '#f8fafc', width: 44, textAlign: 'center' }} />
                      <TableCell sx={{ fontWeight: 950, bgcolor: '#f8fafc', width: 190 }}>Grado de cumplimiento</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {factorCaracteristicas.map((caracteristica) => (
                      <React.Fragment key={caracteristica.caracteristica}>
                        {caracteristica.aspectos.map((item, index) => (
                          <TableRow
                            key={`${item.aspecto}-${index}`}
                            hover
                            sx={{
                              bgcolor: isCriticalCompliance(item.cumplimiento?.label, item.calificacion) ? '#fff1f2' : 'inherit',
                              '&:hover': { bgcolor: isCriticalCompliance(item.cumplimiento?.label, item.calificacion) ? '#ffe4e6' : '#f8fafc' }
                            }}
                          >
                            {index === 0 && (
                              <TableCell rowSpan={caracteristica.aspectos.length + 1} sx={{ verticalAlign: 'top', bgcolor: '#fbfdff', borderRight: '1px solid #cbd5e1' }}>
                                <EditableText
                                  editing={editMode}
                                  value={getAspectValue(caracteristica.aspectos[0], 'caracteristica') || caracteristica.caracteristica}
                                  onChange={(value) => updateAspectGroupDraft(caracteristica.aspectos, 'caracteristica', value)}
                                  minWidth={230}
                                  multiline
                                />
                              </TableCell>
                            )}
                            <TableCell sx={{ minWidth: 460 }}>
                              <Stack spacing={0.7}>
                                <EditableText
                                  editing={editMode}
                                  value={getAspectValue(item, 'aspecto')}
                                  onChange={(value) => updateAspectDraft(item, 'aspecto', value)}
                                  minWidth={460}
                                  multiline
                                />
                                {(editMode || item.indicador) && (
                                  <EditableText
                                    editing={editMode}
                                    value={getAspectValue(item, 'indicador')}
                                    onChange={(value) => updateAspectDraft(item, 'indicador', value)}
                                    minWidth={460}
                                    multiline
                                    placeholder="Sin indicador"
                                  />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell align="center">
                              <Chip
                                size="small"
                                label={componentDisplayLabel(item.componente, componentScope)}
                                sx={{
                                  height: 24,
                                  fontWeight: 950,
                                  bgcolor: normalizeComponentCode(item.componente) === 'P' ? '#ecfdf5' : normalizeComponentCode(item.componente) === 'I' ? '#eff6ff' : '#fff7ed',
                                  color: normalizeComponentCode(item.componente) === 'P' ? '#047857' : normalizeComponentCode(item.componente) === 'I' ? '#1d4ed8' : '#d97706'
                                }}
                              />
                            </TableCell>
                            <TableCell
                              align="center"
                              sx={{
                                fontWeight: 950,
                                color: isCriticalCompliance(item.cumplimiento?.label, item.calificacion) ? '#991b1b' : '#0f172a'
                              }}
                            >
                              {formatScore(item.calificacion)}
                            </TableCell>
                            <TableCell align="center"><ComplianceMark label={item.cumplimiento?.label} /></TableCell>
                            <TableCell
                              sx={{
                                fontSize: 12,
                                fontWeight: 850,
                                color: isCriticalCompliance(item.cumplimiento?.label, item.calificacion) ? '#991b1b' : '#0f172a'
                              }}
                            >
                              {item.cumplimiento?.label}
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow sx={{ bgcolor: isCriticalCompliance(caracteristica.cumplimiento, caracteristica.calificacion) ? '#fee2e2' : '#e5e7eb' }}>
                          <TableCell colSpan={2} sx={{ fontWeight: 950, textTransform: 'uppercase' }}>Calificación y grado de cumplimiento característica</TableCell>
                          <TableCell align="center" sx={{ fontWeight: 950, color: isCriticalCompliance(caracteristica.cumplimiento, caracteristica.calificacion) ? '#991b1b' : '#0f172a' }}>{formatScore(caracteristica.calificacion)}</TableCell>
                          <TableCell align="center"><ComplianceMark label={caracteristica.cumplimiento} /></TableCell>
                          <TableCell sx={{ fontSize: 12, fontWeight: 950, color: isCriticalCompliance(caracteristica.cumplimiento, caracteristica.calificacion) ? '#991b1b' : '#0f172a' }}>{caracteristica.cumplimiento}</TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  const renderMatriz = () => (
    <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
      <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
        <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Matriz inteligente de aspectos e indicadores</Typography>
        <Typography variant="body2" sx={{ color: '#64748b' }}>La tabla conserva toda la trazabilidad del Excel, pero permite lectura, filtros y acciones desde el sistema.</Typography>
      </Box>
      <TableContainer sx={{ maxHeight: 620 }}>
        <Table size="small" stickyHeader>
          <TableHead>
            <TableRow>
              {['Factor', 'Característica', 'Aspecto', 'Indicador', 'Instrumento', 'Componente', 'Calificación', 'Evidencia', 'Información'].map((head) => (
                <TableCell key={head} sx={{ fontWeight: 950, bgcolor: '#f1f5f9' }}>{head}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {aspectos.map((item, index) => (
              <TableRow key={`${item.aspecto}-${index}`} hover>
                <TableCell sx={{ minWidth: 180 }}>
                  <EditableText editing={editMode} value={getAspectValue(item, 'factor')} onChange={(value) => updateAspectDraft(item, 'factor', value)} minWidth={180} multiline />
                </TableCell>
                <TableCell sx={{ minWidth: 260 }}>
                  <EditableText editing={editMode} value={getAspectValue(item, 'caracteristica')} onChange={(value) => updateAspectDraft(item, 'caracteristica', value)} minWidth={260} multiline />
                </TableCell>
                <TableCell sx={{ minWidth: 380 }}>
                  <EditableText editing={editMode} value={getAspectValue(item, 'aspecto')} onChange={(value) => updateAspectDraft(item, 'aspecto', value)} minWidth={380} multiline />
                </TableCell>
                <TableCell sx={{ minWidth: 320 }}>
                  <EditableText editing={editMode} value={getAspectValue(item, 'indicador')} onChange={(value) => updateAspectDraft(item, 'indicador', value)} minWidth={320} multiline placeholder="-" />
                </TableCell>
                <TableCell sx={{ minWidth: 190 }}>
                  <EditableText editing={editMode} value={getAspectValue(item, 'instrumento')} onChange={(value) => updateAspectDraft(item, 'instrumento', value)} minWidth={190} />
                </TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  {editMode ? (
                    <EditableText editing value={getAspectValue(item, 'componente')} onChange={(value) => updateAspectDraft(item, 'componente', value)} minWidth={220} />
                  ) : (
                    <Chip
                      size="small"
                      label={componentDisplayLabel(item.componente, componentScope)}
                      sx={{
                        height: 24,
                        fontWeight: 950,
                        bgcolor: normalizeComponentCode(item.componente) === 'P' ? '#ecfdf5' : normalizeComponentCode(item.componente) === 'I' ? '#eff6ff' : '#fff7ed',
                        color: normalizeComponentCode(item.componente) === 'P' ? '#047857' : normalizeComponentCode(item.componente) === 'I' ? '#1d4ed8' : '#d97706'
                      }}
                    />
                  )}
                </TableCell>
                <TableCell><ScoreChip value={item.calificacion} label={item.cumplimiento?.label} /></TableCell>
                <TableCell sx={{ minWidth: 220 }}>
                  {editMode ? (
                    <EditableText editing value={getAspectValue(item, 'evidencia')} onChange={(value) => updateAspectDraft(item, 'evidencia', value)} minWidth={220} multiline />
                  ) : (
                    item.evidencia ? <Button size="small" href={item.evidencia} target="_blank" rel="noreferrer">Abrir</Button> : '-'
                  )}
                </TableCell>
                <TableCell sx={{ minWidth: 300 }}>
                  <EditableText editing={editMode} value={getAspectValue(item, 'informacion')} onChange={(value) => updateAspectDraft(item, 'informacion', value)} minWidth={300} multiline placeholder="-" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );

  void renderMatriz;

  const renderEquipo = () => (
    <Grid container spacing={2.2}>
      <Grid item xs={12} lg={6}>
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Equipo del proceso</Typography>
          </Box>
          {renderTableEditActions('Edita nombres, documentos, cargos y roles del equipo de autoevaluacion.')}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 950 }}>Nombre</TableCell>
                  <TableCell sx={{ fontWeight: 950 }}>Documento</TableCell>
                  <TableCell sx={{ fontWeight: 950 }}>Cargo</TableCell>
                  <TableCell sx={{ fontWeight: 950 }}>Rol</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {participantes.map((item, index) => (
                  <TableRow key={`${item.documento || item.nombres}-${index}`}>
                    <TableCell sx={{ minWidth: 240 }}>
                      <EditableText editing={editMode} value={getParticipantValue(item, 'nombres')} onChange={(value) => updateParticipantDraft(item, 'nombres', value)} minWidth={240} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 140 }}>
                      <EditableText editing={editMode} value={getParticipantValue(item, 'documento')} onChange={(value) => updateParticipantDraft(item, 'documento', value)} minWidth={140} placeholder="-" />
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <EditableText editing={editMode} value={getParticipantValue(item, 'cargo')} onChange={(value) => updateParticipantDraft(item, 'cargo', value)} minWidth={220} />
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <EditableText editing={editMode} value={getParticipantValue(item, 'rol')} onChange={(value) => updateParticipantDraft(item, 'rol', value)} minWidth={220} />
                    </TableCell>
                  </TableRow>
                ))}
                {!participantes.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>No hay participantes cargados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>
      <Grid item xs={12} lg={6}>
        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #e2e8f0', borderRadius: 3 }}>
          <Typography sx={{ fontWeight: 950, color: '#0f172a', mb: 1 }}>Datos del proceso</Typography>
          <Stack spacing={1.1}>
            <Box sx={{ p: 1.4, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b' }}>Programa</Typography>
              {participantes[0] ? (
                <EditableText editing={editMode} value={getParticipantValue(participantes[0], 'programa')} onChange={(value) => updateParticipantDraft(participantes[0], 'programa', value)} minWidth={220} />
              ) : (
                <Typography sx={{ fontWeight: 900 }}>{programa || resumen.programaActivo || 'Sin seleccionar'}</Typography>
              )}
            </Box>
            <Box sx={{ p: 1.4, bgcolor: '#f8fafc', borderRadius: 2 }}>
              <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b' }}>Alcance</Typography>
              {participantes[0] ? (
                <EditableText editing={editMode} value={getParticipantValue(participantes[0], 'alcance')} onChange={(value) => updateParticipantDraft(participantes[0], 'alcance', value)} minWidth={220} />
              ) : (
                <Typography sx={{ fontWeight: 900 }}>Por definir</Typography>
              )}
            </Box>
            <Box sx={{ p: 1.5, border: '1px solid #dbeafe', borderRadius: 2, bgcolor: '#fbfdff' }}>
              <Typography sx={{ fontWeight: 950, color: '#0f172a', mb: 1 }}>Agregar integrante</Typography>
              <Stack spacing={1}>
                <TextField
                  size="small"
                  label="Programa"
                  value={newParticipant.programa || programa || resumen.programaActivo || ''}
                  onChange={(event) => setNewParticipant((prev) => ({ ...prev, programa: event.target.value }))}
                />
                <TextField
                  size="small"
                  label="Alcance"
                  value={newParticipant.alcance}
                  onChange={(event) => setNewParticipant((prev) => ({ ...prev, alcance: event.target.value }))}
                />
                <TextField
                  size="small"
                  label="Nombres completos"
                  value={newParticipant.nombres}
                  onChange={(event) => setNewParticipant((prev) => ({ ...prev, nombres: event.target.value }))}
                />
                <TextField
                  size="small"
                  label="Documento"
                  value={newParticipant.documento}
                  onChange={(event) => setNewParticipant((prev) => ({ ...prev, documento: event.target.value }))}
                />
                <TextField
                  size="small"
                  label="Cargo"
                  value={newParticipant.cargo}
                  onChange={(event) => setNewParticipant((prev) => ({ ...prev, cargo: event.target.value }))}
                />
                <TextField
                  size="small"
                  label="Rol en el proceso"
                  value={newParticipant.rol}
                  onChange={(event) => setNewParticipant((prev) => ({ ...prev, rol: event.target.value }))}
                />
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={createParticipant}
                  disabled={creatingParticipant}
                  sx={{ textTransform: 'none', fontWeight: 900 }}
                >
                  {creatingParticipant ? 'Agregando...' : 'Agregar al equipo'}
                </Button>
              </Stack>
            </Box>
            <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setBaseManagerOpen(true)} sx={{ textTransform: 'none', fontWeight: 900 }}>
              Cargar participantes
            </Button>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderMejora = () => (
    <Grid container spacing={2.2}>
      <Grid item xs={12}>
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Esta vista será el puente hacia Planes de Mejoramiento: se alimentará automáticamente con los aspectos críticos y permitirá crear acciones, responsables, fechas, avances y evidencias.
        </Alert>
      </Grid>
      <Grid item xs={12}>
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2, bgcolor: '#fff7ed', borderBottom: '1px solid #fed7aa' }}>
            <Typography sx={{ fontWeight: 950, color: '#9a3412' }}>Aspectos sugeridos para plan de mejoramiento</Typography>
          </Box>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 950 }}>Factor</TableCell>
                  <TableCell sx={{ fontWeight: 950 }}>Aspecto</TableCell>
                  <TableCell sx={{ fontWeight: 950 }}>Calificación</TableCell>
                  <TableCell sx={{ fontWeight: 950 }}>Acción sugerida</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {riesgos.map((item, index) => (
                  <TableRow key={`${item.aspecto}-${index}`}>
                    <TableCell>{item.factor}</TableCell>
                    <TableCell>{item.aspecto}</TableCell>
                    <TableCell><ScoreChip value={item.calificacion} label={item.cumplimiento?.label} /></TableCell>
                    <TableCell>Crear acción de mejora prioritaria</TableCell>
                  </TableRow>
                ))}
                {!riesgos.length && <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}>No hay aspectos críticos detectados.</TableCell></TableRow>}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Grid>
    </Grid>
  );

  const renderView = () => {
    if (!hasData) return <EmptyState />;
    if (view === 'factores') return renderFactores();
    if (view === 'equipo') return renderEquipo();
    if (view === 'mejora') return renderMejora();
    return renderResumen();
  };

  return (
    <Fade in>
      <Box sx={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.2, md: 3 },
            mb: 2.4,
            borderRadius: 3,
            color: 'white',
            background: 'linear-gradient(120deg, #0f1f3a 0%, #1d4ed8 56%, #0f766e 100%)',
            overflow: 'hidden',
            position: 'relative',
            width: '100%',
            boxSizing: 'border-box'
          }}
        >
          <Box sx={{ position: 'absolute', right: -70, top: -80, width: 250, height: 250, borderRadius: '50%', bgcolor: 'rgba(255,255,255,0.12)' }} />
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ position: 'relative' }}>
            <Box>
              <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.8 }}>
                <FactCheckIcon />
                <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0 }}>
                  Autoevaluación inteligente
                </Typography>
              </Stack>
              <Typography sx={{ color: '#dbeafe', maxWidth: 760 }}>
                La lógica del libro Excel convertida en una experiencia dinámica para analizar factores, evidencias, equipo y mejoramiento por programa.
              </Typography>
            </Box>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
              <Button variant="contained" startIcon={<UploadFileIcon />} onClick={() => setBaseManagerOpen((current) => !current)} sx={{ bgcolor: 'white', color: '#1d4ed8', fontWeight: 900, textTransform: 'none', '&:hover': { bgcolor: '#eff6ff' } }}>
                Gestion de datos
              </Button>
            </Stack>
          </Stack>
        </Paper>

        {baseManagerOpen ? (
          renderBaseManager()
        ) : (
          <>
            <Paper elevation={0} sx={{ p: 1.5, mb: 1.4, border: '1px solid #e2e8f0', borderRadius: 3, width: '100%', boxSizing: 'border-box' }}>
              <FormControl fullWidth>
                <InputLabel>Programa</InputLabel>
                <Select
                  value={programa}
                  label="Programa"
                  onChange={(event) => {
                    const next = event.target.value;
                    setPrograma(next);
                    loadDashboard(next);
                  }}
                >
                  <MenuItem value=""><em>Todos los programas</em></MenuItem>
                  {programas.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </Select>
              </FormControl>
            </Paper>

            <Paper elevation={0} sx={{ p: 1.2, mb: 1.4, border: '1px solid #e2e8f0', borderRadius: 3, width: '100%', boxSizing: 'border-box', bgcolor: 'white' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between">
                <Box>
                  <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Componente estadistico</Typography>
                  <Typography variant="caption" sx={{ color: '#64748b' }}>
                    P = Programa, I = Institucional, P/I = aplica para ambos.
                  </Typography>
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1, flex: 1, maxWidth: { md: 720 } }}>
                  {componentScopeOptions.map((item) => {
                    const active = componentScope === item.key;
                    return (
                      <Button
                        key={item.key}
                        onClick={() => setComponentScope(item.key)}
                        variant={active ? 'contained' : 'outlined'}
                        sx={{
                          minHeight: 44,
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 950,
                          bgcolor: active ? item.color : 'white',
                          color: active ? 'white' : item.color,
                          borderColor: `${item.color}77`,
                          '&:hover': { bgcolor: active ? item.color : `${item.color}12`, borderColor: item.color }
                        }}
                      >
                        <Box>
                          <Typography component="span" sx={{ display: 'block', fontWeight: 950, lineHeight: 1 }}>{item.label}</Typography>
                          <Typography component="span" sx={{ display: 'block', fontSize: 11, opacity: active ? 0.9 : 0.75 }}>{item.helper}</Typography>
                        </Box>
                      </Button>
                    );
                  })}
                </Box>
              </Stack>
            </Paper>

            <Paper elevation={0} sx={{ p: 1.2, mb: 2.4, border: '1px solid #dbeafe', borderRadius: 3, width: '100%', boxSizing: 'border-box', bgcolor: '#fbfdff' }}>
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                  gap: 1,
                  width: '100%'
                }}
              >
                {VIEWS.map((item) => {
                  const active = view === item.key;
                  const tone = VIEW_TONES[item.key] || VIEW_TONES.resumen;
                  return (
                    <Button
                      key={item.key}
                      onClick={() => setView(item.key)}
                      startIcon={React.cloneElement(item.icon, { fontSize: 'small' })}
                      variant={active ? 'contained' : 'outlined'}
                      sx={{
                        minHeight: 48,
                        borderRadius: 2,
                        justifyContent: 'center',
                        textTransform: 'none',
                        fontWeight: 950,
                        color: active ? 'white' : tone.color,
                        bgcolor: active ? tone.color : 'white',
                        borderColor: active ? tone.color : `${tone.color}55`,
                        boxShadow: active ? `0 12px 26px ${tone.color}26` : 'none',
                        '&:hover': {
                          bgcolor: active ? tone.color : tone.soft,
                          borderColor: tone.color,
                          boxShadow: `0 12px 24px ${tone.color}18`
                        }
                      }}
                    >
                      {item.label}
                    </Button>
                  );
                })}
              </Box>
            </Paper>

            {loading ? (
              <Box sx={{ py: 9, display: 'grid', placeItems: 'center' }}>
                <CircularProgress />
              </Box>
            ) : (
              renderView()
            )}

            {hasData && (
              <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                {scopedComponentes.slice(0, 8).map((item) => (
                  <MuiTooltip key={item.name} title="Componente identificado en la matriz">
                    <Chip label={`${componentDisplayLabel(item.name, componentScope)}: ${item.total}`} size="small" sx={{ fontWeight: 800 }} />
                  </MuiTooltip>
                ))}
              </Stack>
            )}

            <Dialog open={evidenceModal.open} onClose={closeEvidenceModal} fullWidth maxWidth="lg">
              <DialogTitle sx={{ pb: 1 }}>
                <Stack direction="row" spacing={1.2} alignItems="center" justifyContent="space-between">
                  <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0 }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#eff6ff', color: '#1d4ed8' }}>
                      <FolderOpenIcon />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Evidencias</Typography>
                      <Typography variant="caption" sx={{ color: '#64748b', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: { xs: 240, md: 760 } }}>
                        {evidenceBreadcrumbs.map((crumb, index) => (
                          <React.Fragment key={`${crumb.folderUrl}-${index}`}>
                            {index > 0 && ' / '}
                            <Box
                              component="button"
                              type="button"
                              onClick={() => goToEvidenceBreadcrumb(crumb, index)}
                              disabled={evidenceModal.loading || index === evidenceBreadcrumbs.length - 1}
                              sx={{
                                p: 0,
                                border: 0,
                                bgcolor: 'transparent',
                                color: index === evidenceBreadcrumbs.length - 1 ? '#64748b' : '#1d4ed8',
                                fontWeight: 800,
                                cursor: index === evidenceBreadcrumbs.length - 1 ? 'default' : 'pointer',
                                font: 'inherit'
                              }}
                            >
                              {crumb.title}
                            </Box>
                          </React.Fragment>
                        ))}
                      </Typography>
                    </Box>
                  </Stack>
                  <IconButton onClick={closeEvidenceModal}><CloseIcon /></IconButton>
                </Stack>
              </DialogTitle>
              <DialogContent dividers sx={{ p: 2.2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mb: 2 }}>
                  <TextField
                    size="small"
                    fullWidth
                    value={evidenceSearch}
                    onChange={(event) => setEvidenceSearch(event.target.value)}
                    placeholder="Buscar archivo"
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }}
                  />
                  <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 180 } }}>
                    <InputLabel>Tipo</InputLabel>
                    <Select value={evidenceTypeFilter} label="Tipo" onChange={(event) => setEvidenceTypeFilter(event.target.value)}>
                      <MenuItem value="todos">Todos</MenuItem>
                      {evidenceTypeOptions.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
                    </Select>
                  </FormControl>
                  <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 190 } }}>
                    <InputLabel>Orden</InputLabel>
                    <Select value={evidenceSort} label="Orden" onChange={(event) => setEvidenceSort(event.target.value)}>
                      <MenuItem value="fecha_desc">Más recientes</MenuItem>
                      <MenuItem value="fecha_asc">Más antiguos</MenuItem>
                      <MenuItem value="nombre_asc">Nombre A-Z</MenuItem>
                      <MenuItem value="nombre_desc">Nombre Z-A</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                {evidenceModal.loading && (
                  <Box sx={{ py: 7, display: 'grid', placeItems: 'center' }}>
                    <CircularProgress />
                  </Box>
                )}

                {!evidenceModal.loading && evidenceModal.error && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    {evidenceModal.error}
                  </Alert>
                )}

                {!evidenceModal.loading && !evidenceModal.error && (
                  <TableContainer sx={{ maxHeight: 520, border: '1px solid #e2e8f0', borderRadius: 2 }}>
                    <Table stickyHeader size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 950 }}>Nombre</TableCell>
                          <TableCell sx={{ fontWeight: 950, width: 150 }}>Tipo</TableCell>
                          <TableCell sx={{ fontWeight: 950, width: 190 }}>Modificación</TableCell>
                          <TableCell sx={{ fontWeight: 950, width: 140, textAlign: 'center' }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {evidenceFilesFiltered.map((file) => (
                          <TableRow key={file.id} hover>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                {getFileTypeIcon(file)}
                                <Box sx={{ minWidth: 0 }}>
                                  <Typography variant="body2" sx={{ fontWeight: 900, color: '#0f172a', lineHeight: 1.25 }}>{file.name}</Typography>
                                  {file.isFolder && (
                                    <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 800 }}>
                                      Carpeta con contenido interno
                                    </Typography>
                                  )}
                                </Box>
                              </Stack>
                            </TableCell>
                            <TableCell>{getFileTypeLabel(file.mimeType, file.name)}</TableCell>
                            <TableCell>{formatEvidenceDate(file.modifiedTime)}</TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={0.5} justifyContent="center">
                                {file.isFolder ? (
                                  <MuiTooltip title="Entrar a la carpeta">
                                    <IconButton size="small" onClick={() => enterEvidenceFolder(file)} sx={{ color: '#d97706' }}>
                                      <FolderOpenIcon fontSize="small" />
                                    </IconButton>
                                  </MuiTooltip>
                                ) : (
                                  <MuiTooltip title="Ver vista previa">
                                    <IconButton size="small" onClick={() => setPreviewFile(file)} sx={{ color: '#1d4ed8' }}>
                                      <VisibilityIcon fontSize="small" />
                                    </IconButton>
                                  </MuiTooltip>
                                )}
                                <MuiTooltip title="Abrir en Google Drive">
                                  <IconButton size="small" component="a" href={file.webViewLink} target="_blank" rel="noopener noreferrer" sx={{ color: '#475569' }}>
                                    <OpenInNewIcon fontSize="small" />
                                  </IconButton>
                                </MuiTooltip>
                                {!file.isFolder && (
                                  <MuiTooltip title="Descargar">
                                    <IconButton size="small" component="a" href={file.webContentLink || file.webViewLink} target="_blank" rel="noopener noreferrer" sx={{ color: '#0f766e' }}>
                                      <CloudDownloadIcon fontSize="small" />
                                    </IconButton>
                                  </MuiTooltip>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                        {evidenceFilesFiltered.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4}>
                              <Alert severity="info" sx={{ borderRadius: 2 }}>No hay archivos para los filtros seleccionados.</Alert>
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </DialogContent>
              <DialogActions sx={{ px: 2.2, py: 1.5 }}>
                <Button component="a" href={evidenceModal.folderUrl} target="_blank" rel="noopener noreferrer" startIcon={<OpenInNewIcon />} sx={{ textTransform: 'none', fontWeight: 900 }}>
                  Abrir carpeta
                </Button>
                <Button onClick={closeEvidenceModal} variant="contained" sx={{ textTransform: 'none', fontWeight: 900 }}>Cerrar</Button>
              </DialogActions>
            </Dialog>

            <Dialog open={Boolean(previewFile)} onClose={() => setPreviewFile(null)} fullWidth maxWidth="md">
              <DialogTitle sx={{ pb: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Typography sx={{ fontWeight: 950, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {previewFile?.name || 'Vista previa'}
                  </Typography>
                  <IconButton onClick={() => setPreviewFile(null)}><CloseIcon /></IconButton>
                </Stack>
              </DialogTitle>
              <DialogContent dividers sx={{ p: 0, height: { xs: 520, md: 680 } }}>
                {previewFile?.previewLink ? (
                  <Box component="iframe" title={previewFile.name} src={previewFile.previewLink} sx={{ width: '100%', height: '100%', border: 0 }} />
                ) : (
                  <Alert severity="info" sx={{ m: 2 }}>Este archivo no permite vista previa embebida.</Alert>
                )}
              </DialogContent>
            </Dialog>
          </>
        )}
      </Box>
    </Fade>
  );
}

export default Autoevaluacion;
