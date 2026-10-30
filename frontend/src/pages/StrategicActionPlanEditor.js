// PEI StrategicActionPlanEditor Module
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Avatar, Badge, Box, Button, Checkbox, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Fab, FormControlLabel, Grid, IconButton, InputAdornment, ListItemIcon, ListItemText, Menu, MenuItem, Paper, Radio, RadioGroup, Stack, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, Tabs, TextField, ToggleButton, ToggleButtonGroup, Tooltip, Typography
} from '@mui/material';
import {
  AccessTime, Add, ArrowBack, AssignmentTurnedIn, AttachFile, AutoAwesome, CalendarMonth, ChatBubbleOutline, CheckBox as CheckBoxIcon, CheckBoxOutlineBlank as CheckBoxOutlineBlankIcon, CheckCircle, CheckCircleOutline, Close, CloudDone as CloudDoneIcon, CloudUpload, ContentCopy, DeleteOutline, DeleteSweep, Description, Download, DriveFileMove, Edit, EditNote, Email, Folder, FolderShared as FolderSharedIcon, HelpOutline, History, HourglassBottom, Image as ImageIcon, InsertDriveFile, KeyboardArrowDown, LockOutlined, MoreTime, MoreVert, OpenInNew, PersonSearch, PictureAsPdf as PdfIcon, PlayArrow, PriorityHigh, QrCode2, Refresh, Save, Search, Send, Sync, TableChart as ExcelIcon, TrendingUp, ViewSidebar, Visibility
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import { useAuth } from '../context/AuthContext';
import strategicPlanningService from '../services/strategicPlanningService';
import logoFormatos from '../assets/logo_formatos.jpg';
import RichTextEditor, { sanitizeRichHtml } from '../components/meetingMinute/RichTextEditor';
import MeetingCalendarScheduler from '../components/meetingMinute/MeetingCalendarScheduler';
import PlanAccionConsulta from './PlanAccionConsulta';
import { getPlanEffectiveSchedule } from '../utils/strategicPlanSchedule';

const ACTION_LABELS = {
  schedule_meeting: 'Programar reunión', start_formulation: 'Iniciar formulación',
  submit_preliminary_minutes: 'Enviar acta preliminar', submit_technical_review: 'Enviar a revisión técnica',
  request_adjustments: 'Solicitar ajustes', resubmit_technical_review: 'Reenviar revisión',
  submit_owner_validation: 'Enviar a revisión y firmas del líder', request_owner_adjustments: 'Devolver para ajustes a Planeación',
  notify_rectorate: 'Informar a Rectoría', activate: 'Ejecutar Plan de Acción', start_monitoring: 'Iniciar seguimientos', close: 'Cerrar vigencia'
};
const STATUS_LABELS = {
  convocation: 'Convocatoria', meeting_scheduled: 'Reunión programada', formulation: 'Formulación',
  preliminary_minutes: 'Acta preliminar', technical_review: 'Revisión técnica', adjustments: 'En ajustes (devuelto por líder)',
  owner_validation: 'En validación y firmas de acta', rectorate_notification: 'Información a Rectoría',
  active: 'En Ejecución Oficial', monitoring: 'En Seguimiento Semestral', closed: 'Cerrado'
};
const emptyItem = { macroactivity: '', activity: '', indicator_type: '', starts_on: '', ends_on: '', indicator: '', target: '', co_responsibles: [], budget: '', custom_values: {} };
const DEFAULT_ACTIVITY_FIELDS = [
  { id: 'def-activity', key: 'activity', label: 'Nombre o descripción de la Actividad', data_type: 'long_text', required: true, position: 1 },
  { id: 'def-indicator-type', key: 'indicator_type', label: 'Tipo de Indicador', data_type: 'list', required: false, position: 2, options: ['Gestión','Resultado','Producto','Impacto'] },
  { id: 'def-indicator', key: 'indicator', label: 'Indicador', data_type: 'text', required: false, position: 3 },
  { id: 'def-target', key: 'target', label: 'Meta', data_type: 'text', required: false, position: 4 },
  { id: 'def-starts-on', key: 'starts_on', label: 'Fecha de inicio', data_type: 'date', required: false, position: 5 },
  { id: 'def-ends-on', key: 'ends_on', label: 'Fecha de fin', data_type: 'date', required: false, position: 6 },
  { id: 'def-co-responsibles', key: 'co_responsibles', label: 'Corresponsable(s)', data_type: 'text', required: false, position: 7 }
];
const ACTIVITY_FORM_EXCLUDED_KEYS = new Set(['progress_s1','observations_s1','progress_s2','observations_s2','total_progress','avance_a_ip_2026','avance_a_iip_2026','observaciones','observaciones_2','total']);
const normalizeFieldText = (str) =>
  String(str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

const LeaderFeedbackSnippet = ({ info, isCurrentStatus = false, chatCount = 0, leaderNameFallback = 'Líder de Dependencia', onOpenChat }) => {
  const hasComment = Boolean(info && info.comment);
  if (!hasComment && chatCount === 0) return null;
  const leaderName = info?.requested_by_name || leaderNameFallback;
  const initials = leaderName.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase() || 'LD';
  const subtitle = hasComment
    ? `"${info.comment}"`
    : `Canal de retroalimentación activo (${chatCount} mensaje${chatCount > 1 ? 's' : ''}). Clic para ver o responder.`;

  return (
    <Paper
      elevation={0}
      onClick={onOpenChat}
      sx={{
        cursor: 'pointer',
        px: { xs: 1.5, sm: 2 },
        py: 0.85,
        borderRadius: 2.5,
        bgcolor: isCurrentStatus ? '#fffdf5' : '#f0fdf4',
        border: '1.5px solid',
        borderColor: isCurrentStatus ? '#fcd34d' : '#86efac',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 1.5,
        mb: 2,
        boxShadow: isCurrentStatus ? '0 2px 8px rgba(245, 158, 11, 0.08)' : '0 2px 8px rgba(16, 185, 129, 0.08)',
        transition: 'all 0.18s ease-in-out',
        '&:hover': {
          borderColor: isCurrentStatus ? '#f59e0b' : '#10b981',
          bgcolor: isCurrentStatus ? '#fffbeb' : '#dcfce7',
          boxShadow: isCurrentStatus ? '0 4px 14px rgba(245, 158, 11, 0.14)' : '0 4px 14px rgba(16, 185, 129, 0.16)',
          transform: 'translateY(-1px)'
        }
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
        <Badge
          color={isCurrentStatus ? 'warning' : 'success'}
          variant="dot"
          invisible={!isCurrentStatus && chatCount === 0}
          overlap="circular"
        >
          <Avatar
            sx={{
              width: 32,
              height: 32,
              bgcolor: isCurrentStatus ? '#fef3c7' : '#dcfce7',
              color: isCurrentStatus ? '#b45309' : '#15803d',
              fontSize: 11.5,
              fontWeight: 900,
              border: '1px solid',
              borderColor: isCurrentStatus ? '#fde68a' : '#86efac'
            }}
          >
            {initials}
          </Avatar>
        </Badge>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="nowrap">
            <Typography sx={{ fontWeight: 850, fontSize: 13, color: isCurrentStatus ? '#92400e' : '#14532d', whiteSpace: 'nowrap' }}>
              💬 {isCurrentStatus ? 'Observación del Líder' : 'Canal de Retroalimentación Directa'}
            </Typography>
            {isCurrentStatus && (
              <Chip
                label="Pendiente de Ajuste"
                size="small"
                color="warning"
                sx={{ height: 19, fontSize: 10, fontWeight: 850, px: 0.5 }}
              />
            )}
            {chatCount > 0 && !isCurrentStatus && (
              <Chip
                label={`${chatCount} msg`}
                size="small"
                sx={{ height: 19, fontSize: 10, fontWeight: 850, px: 0.5, bgcolor: '#dcfce7', color: '#15803d', border: '1px solid #86efac' }}
              />
            )}
            <Typography variant="caption" sx={{ color: '#64748b', whiteSpace: 'nowrap', display: { xs: 'none', sm: 'inline' } }}>
              · {leaderName}
            </Typography>
          </Stack>
          <Typography
            noWrap
            sx={{
              fontSize: 12,
              color: '#334155',
              fontStyle: hasComment ? 'italic' : 'normal',
              lineHeight: 1.25,
              mt: 0.2
            }}
          >
            {subtitle}
          </Typography>
        </Box>
      </Stack>

      <Button
        size="small"
        variant="contained"
        startIcon={<ChatBubbleOutline sx={{ fontSize: 14 }} />}
        sx={{
          textTransform: 'none',
          fontWeight: 850,
          fontSize: 11.5,
          borderRadius: 2,
          bgcolor: '#008069',
          color: '#ffffff',
          flexShrink: 0,
          px: 1.6,
          py: 0.4,
          boxShadow: '0 2px 6px rgba(0, 128, 105, 0.25)',
          '&:hover': { bgcolor: '#006a57' }
        }}
      >
        Abrir chat {chatCount > 0 ? `(${chatCount})` : ''}
      </Button>
    </Paper>
  );
};

const isCoResponsibleField = (field) => {
  if (!field) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  const combined = `${k} ${l}`;
  return (
    combined.includes('corresponsable') ||
    combined.includes('coresponsable') ||
    combined.includes('co_responsable') ||
    k === 'co_responsibles' ||
    k === 'co_responsible'
  );
};

const isResponsibleField = (field) => {
  if (!field || isCoResponsibleField(field)) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  const combined = `${k} ${l}`;
  return (
    combined.includes('responsable') ||
    k === 'responsible'
  );
};

const isStartDateField = (field) => {
  if (!field) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  const combined = `${k} ${l}`;
  return (
    k === 'starts_on' ||
    k === 'fecha_inicio' ||
    k === 'fecha_de_inicio' ||
    (combined.includes('fecha') && (combined.includes('inicio') || combined.includes('desde') || combined.includes('empiez')))
  );
};

const isEndDateField = (field) => {
  if (!field) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  const combined = `${k} ${l}`;
  return (
    k === 'ends_on' ||
    k === 'fecha_fin' ||
    k === 'fecha_de_fin' ||
    k === 'fecha_final' ||
    (combined.includes('fecha') && (combined.includes('fin') || combined.includes('hasta') || combined.includes('termin') || combined.includes('limite')))
  );
};

const isMacroactivityField = (field) => {
  if (!field) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  return k.includes('macro') || l.includes('macro');
};

const isActivityField = (field) => {
  if (!field) return false;
  if (isResponsibleField(field) || isCoResponsibleField(field) || isStartDateField(field) || isEndDateField(field)) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  // Excluir estrictamente cualquier campo de Macroactividad
  if (k.includes('macro') || l.includes('macro')) return false;

  return (
    k === 'activity' ||
    k === 'actividad' ||
    k === 'actividades' ||
    k === 'nombre_actividad' ||
    k === 'descripcion_actividad' ||
    l === 'actividad' ||
    l === 'actividades' ||
    l === 'nombre de la actividad' ||
    l === 'descripcion de la actividad' ||
    l === 'nombre o descripcion de la actividad'
  );
};

const isIndicatorField = (field) => {
  if (!field) return false;
  const k = normalizeFieldText(field.key);
  const l = normalizeFieldText(field.label);
  return (
    k === 'indicator' ||
    k === 'indicador' ||
    (l.includes('indicador') && !l.includes('tipo'))
  );
};

const parseCoResponsibles = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.filter(Boolean);
  if (typeof val === 'string' && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch (_) {}
    if (val.includes(',')) {
      return val.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [val.trim()];
  }
  return [];
};
const toDatetimeLocal = (val, defaultHour = 8) => {
  if (!val) {
    const d = new Date();
    d.setHours(defaultHour, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
  try {
    const d = new Date(val);
    if (isNaN(d.getTime())) {
      const now = new Date();
      now.setHours(defaultHour, 0, 0, 0);
      const pad = (n) => String(n).padStart(2, '0');
      return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
    }
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch (_) {
    const d = new Date();
    d.setHours(defaultHour, 0, 0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }
};
const emptyMeeting = { title: '', starts_at: '', ends_at: '', location: '', modality: 'Presencial', objective: '', development: '', conclusions: '', participants_text: '' };
const PLANNING_DEPARTMENT_NAME = 'Dirección de Planeación y Aseguramiento de la Calidad';
const richTextPlain = (value = '') => sanitizeRichHtml(String(value || ''))
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

const formatFecha = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('es-CO', { year: 'numeric', month: 'short', day: '2-digit' });
  } catch { return '—'; }
};

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const getFileIcon = (fileName) => {
  const ext = (fileName || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return <PdfIcon sx={{ color: '#dc2626', fontSize: 22 }} />;
  if (['xls', 'xlsx', 'csv'].includes(ext)) return <ExcelIcon sx={{ color: '#16a34a', fontSize: 22 }} />;
  if (['doc', 'docx'].includes(ext)) return <Description sx={{ color: '#2563eb', fontSize: 22 }} />;
  if (['png', 'jpg', 'jpeg', 'webp', 'gif'].includes(ext)) return <ImageIcon sx={{ color: '#9333ea', fontSize: 22 }} />;
  return <InsertDriveFile sx={{ color: '#64748b', fontSize: 22 }} />;
};

const WorkflowStepLabel = ({ number, title, count }) => (
  <Stack direction="row" alignItems="center" spacing={1.25} sx={{ width: '100%', minWidth: 0, textAlign: 'left' }}>
    <Box className="step-number" sx={{ width: 31, height: 31, borderRadius: 2, display: 'grid', placeItems: 'center', flexShrink: 0, bgcolor: '#e3ebf4', color: '#65758a', fontWeight: 950, fontSize: 13 }}>
      {number}
    </Box>
    <Box sx={{ minWidth: 0, flex: 1 }}>
      <Typography className="step-caption" variant="caption" sx={{ display: 'block', color: '#8793a5', fontWeight: 900, fontSize: 10, lineHeight: 1.1, letterSpacing: '.08em' }}>
        ETAPA {number}
      </Typography>
      <Typography className="step-title" sx={{ color: '#526176', fontWeight: 900, fontSize: 13.5, lineHeight: 1.25, whiteSpace: 'nowrap' }}>
        {title}
      </Typography>
    </Box>
    {count !== undefined && (
      <Box className="step-count" sx={{ minWidth: 25, height: 24, px: 0.75, borderRadius: 1.5, display: 'grid', placeItems: 'center', bgcolor: '#edf1f6', color: '#6d7b8d', fontWeight: 900, fontSize: 11 }}>
        {count}
      </Box>
    )}
  </Stack>
);

export default function StrategicActionPlanEditor({ open, planId, platformPlan, workflow, onClose, onChanged, onPlanReplaced, initialOpenChat = false }) {
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const { user } = useAuth();
  const isPlanningAdmin = ['administrador', 'planeacion_efectividad', 'planeacion_estrategica'].includes(user?.role);

  // Estados para vigencia y prórrogas de Etapa 1
  const [timelineModalOpen, setTimelineModalOpen] = useState(false);
  const [timelineForm, setTimelineForm] = useState({ starts_on: '', ends_on: '', reason: '' });
  const [savingTimeline, setSavingTimeline] = useState(false);
  const [tab, setTab] = useState('activities');
  const [detail, setDetail] = useState(null);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(emptyItem);
  const [institutionalUsers, setInstitutionalUsers] = useState([]);
  const [meeting, setMeeting] = useState(emptyMeeting);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [responsibleDocument, setResponsibleDocument] = useState('');
  const [responsibleOptions, setResponsibleOptions] = useState([]);
  const [responsibleCandidate, setResponsibleCandidate] = useState(null);
  const [searchingResponsible, setSearchingResponsible] = useState(false);
  const [attendeeOptions, setAttendeeOptions] = useState([]);
  const [attendeeSearching, setAttendeeSearching] = useState(false);
  const [unifiedDraft, setUnifiedDraft] = useState({
    document: '', name: '', email: '', organization: '', role_title: '', meeting_role: 'participant', user_id: null
  });
  const [improvingMeetingField, setImprovingMeetingField] = useState('');
  const [generatingMinuteSummary, setGeneratingMinuteSummary] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [activitySearch, setActivitySearch] = useState('');
  const [minuteSearch, setMinuteSearch] = useState('');
  // Paginación de tablas (5 por defecto, con opciones 5, 10, 20, 50)
  const [itemsPage, setItemsPage] = useState(0);
  const [itemsRowsPerPage, setItemsRowsPerPage] = useState(5);
  const [actasPage, setActasPage] = useState(0);
  const [actasRowsPerPage, setActasRowsPerPage] = useState(5);
  const [tab4Page, setTab4Page] = useState(0);
  const [tab4RowsPerPage, setTab4RowsPerPage] = useState(5);

  useEffect(() => { setActasPage(0); }, [minuteSearch]);
  useEffect(() => { setTab4Page(0); }, [activitySearch]);
  const [evidenceModalOpen, setEvidenceModalOpen] = useState(false);
  const [evidenceItem, setEvidenceItem] = useState(null);
  const [evalModalOpen, setEvalModalOpen] = useState(false);
  const [evaluatingItem, setEvaluatingItem] = useState(null);
  const [evalForm, setEvalForm] = useState({
    period_id: '',
    physical_progress: '',
    observations: ''
  });
  const [previewModal, setPreviewModal] = useState({
    open: false,
    url: '',
    fileName: '',
    isPdf: false,
    isImage: false,
    isOffice: false,
    loading: false
  });
  const [published, setPublished] = useState(null);
  const [dynamicImportPreview, setDynamicImportPreview] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [syncingMinute, setSyncingMinute] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [lastDriveSync, setLastDriveSync] = useState(null);
  const [previewPlanModalOpen, setPreviewPlanModalOpen] = useState(false);
  const [previewPlanSearch, setPreviewPlanSearch] = useState('');
  const [previewSheetTab, setPreviewSheetTab] = useState(0); // 0: 'PLAN DE ACCIÓN', 1: 'EN CORRESPONSABILIDAD'
  const [syncingDriveExcel, setSyncingDriveExcel] = useState(false);
  const autoSyncedTabRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'pending' | 'error'
  const hasUnsavedChangesRef = useRef(false);
  const isApplyingLoadRef = useRef(false);
  const lastLoadedMeetingKeyRef = useRef(null);

  // Minute preview state (COM-IF-FR-002)
  const [editingActa, setEditingActa] = useState(false);
  const [meetingLayoutMode, setMeetingLayoutMode] = useState('split');
  const [pdfMenuAnchor, setPdfMenuAnchor] = useState(null);
  const [meetingFieldErrors, setMeetingFieldErrors] = useState({});
  const guideAnimationRef = useRef(null);
  const guideSnackbarKeyRef = useRef(null);
  const [actaData, setActaData] = useState({
    responsables: '', dependencia: '', lugar: '', fecha: '', horario: '', objetivo: '', desarrollo: '', conclusiones: '', participantes: []
  });
  const [calendarSchedulerOpen, setCalendarSchedulerOpen] = useState(false);

  // Sugerencias de actividades existentes por palabras clave
  const [activitySuggestions, setActivitySuggestions] = useState([]);
  const [loadingActivitySuggestions, setLoadingActivitySuggestions] = useState(false);
  const activitySearchTimeoutRef = useRef(null);

  // Menú contextual de 3 puntos por fila de actividad (Editar / Trasladar / Eliminar)
  const [rowMenuAnchor, setRowMenuAnchor] = useState(null);
  const [activeMenuRow, setActiveMenuRow] = useState(null);

  // Modal para Trasladar / Replicar actividad a otros planes
  const [replicateModalOpen, setReplicateModalOpen] = useState(false);
  const [replicateTargetItem, setReplicateTargetItem] = useState(null);
  const [availablePlans, setAvailablePlans] = useState([]);
  const [loadingAvailablePlans, setLoadingAvailablePlans] = useState(false);
  const [selectedTargetPlanIds, setSelectedTargetPlanIds] = useState([]);
  const [replicateSearch, setReplicateSearch] = useState('');
  const [replicateAsMove, setReplicateAsMove] = useState(false);
  const [replicating, setReplicating] = useState(false);

  // Modal de confirmación para eliminar actividad
  const [deleteItemCandidate, setDeleteItemCandidate] = useState(null);
  const [deletingItem, setDeletingItem] = useState(false);

  useEffect(() => {
    return () => {
      guideAnimationRef.current?.cancel?.();
      guideAnimationRef.current = null;
    };
  }, []);
  const load = useCallback(async (showLoading = true) => {
    if (!planId) return;
    if (showLoading) setLoading(true);
    setLoadError('');
    try {
      const planResponse = await strategicPlanningService.getActionPlan(planId);
      const loadedDetail = planResponse.data;
      setDetail(loadedDetail);

      const targetPedId = loadedDetail?.term?.strategicPlan?.id || platformPlan?.id;
      if (targetPedId) {
        try {
          const structureResponse = await strategicPlanningService.listStructure(targetPedId);
          setStructure(structureResponse.data || []);
        } catch (_) {
          setStructure([]);
        }
        try {
          const leadersRes = await strategicPlanningService.leaderOptions(targetPedId);
          setInstitutionalUsers(leadersRes.data || []);
        } catch (_) {
          setInstitutionalUsers([]);
        }
      } else {
        setStructure([]);
        setInstitutionalUsers([]);
      }
    } catch (error) {
      const replacementPlanId = error.response?.data?.data?.replacement_plan_id;
      if (replacementPlanId && String(replacementPlanId) !== String(planId)) {
        onPlanReplaced?.(replacementPlanId);
        enqueueSnackbar('Abriendo automáticamente el Plan de Acción vigente.', { variant: 'info' });
        return;
      }
      console.error('Error al cargar Plan de Acción:', error);
      const message = error.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado en responder. Intente cargar nuevamente el Plan de Acción.'
        : error.response?.data?.message || error.message || 'No fue posible cargar el formulario del plan.';
      setLoadError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [planId, platformPlan?.id, enqueueSnackbar, onPlanReplaced]);

  useEffect(() => {
    if (open) {
      load();
    } else {
      lastLoadedMeetingKeyRef.current = null;
    }
  }, [open, load]);

  useEffect(() => {
    if (tab === 'export' && planId && !autoSyncedTabRef.current) {
      autoSyncedTabRef.current = true;
      setSyncingDriveExcel(true);
      strategicPlanningService.syncDriveExcel(planId)
        .then(() => load(false))
        .catch((err) => console.warn('[Auto-sync Drive]:', err?.message))
        .finally(() => setSyncingDriveExcel(false));
    }
  }, [tab, planId, load]);

  useEffect(() => {
    autoSyncedTabRef.current = false;
  }, [detail?.items?.length]);

  const locations = useMemo(() => (platformPlan?.catalogItems || []).filter((entry) => entry.catalog_type === 'meeting_location' && entry.active), [platformPlan?.catalogItems]);

  const calendarResponsibles = useMemo(() => {
    const list = [];
    const leaderUser = detail?.currentResponsibility?.responsibleUser;
    if (leaderUser && leaderUser.email) {
      list.push({
        id: leaderUser.id,
        name: leaderUser.nombre,
        email: leaderUser.email,
        document: leaderUser.username || '',
        position: leaderUser.cargo || '',
        source: 'leader'
      });
    }
    if (detail?.owner?.email && !list.some((l) => l.email.toLowerCase() === detail.owner.email.toLowerCase())) {
      list.push({
        id: detail.owner.id,
        name: detail.owner.name || detail.owner.nombre,
        email: detail.owner.email,
        document: detail.owner.document || detail.owner.username || '',
        position: detail.owner.cargo || '',
        source: 'leader'
      });
    }
    (meetingParticipants || []).forEach((p) => {
      if (['principal', 'co_responsible'].includes(p.meeting_role) && p.email) {
        if (!list.some((l) => l.email.toLowerCase() === p.email.toLowerCase())) {
          list.push({
            id: p.user_id,
            name: p.name,
            email: p.email,
            document: p.document || '',
            position: p.role_title || '',
            source: 'participant'
          });
        }
      }
    });
    return list;
  }, [detail?.currentResponsibility?.responsibleUser, detail?.owner, meetingParticipants]);

  const calendarParticipants = useMemo(() => {
    const list = [];
    (meetingParticipants || []).forEach((p) => {
      if (p.email) {
        list.push({
          id: p.user_id,
          name: p.name,
          email: p.email,
          document: p.document || '',
          position: p.role_title || '',
          source: 'participant'
        });
      }
    });
    return list;
  }, [meetingParticipants]);

  const activeMeeting = useMemo(() => {
    const meetings = detail?.meetings || [];
    if (selectedMeetingId === '__new__') return null;
    return meetings.find((entry) => String(entry.id) === String(selectedMeetingId)) || meetings[0] || null;
  }, [detail?.meetings, selectedMeetingId]);

  const latestMinute = useMemo(() => {
    if (!activeMeeting?.minuteVersions?.length) return null;
    return [...activeMeeting.minuteVersions].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
  }, [activeMeeting]);

  const isFinalized = Boolean(activeMeeting?.status === 'formalized' || latestMinute?.status === 'finalized');

  useEffect(() => {
    if (!open || editingActa || latestMinute?.status !== 'signing') return undefined;
    const signatureRefresh = setInterval(() => load(false), 15000);
    return () => clearInterval(signatureRefresh);
  }, [open, editingActa, latestMinute?.id, latestMinute?.status, load]);

  const handleDownloadPdf = async (type = 'original') => {
    setPdfMenuAnchor(null);
    let targetMinute = latestMinute;
    if (!targetMinute && activeMeeting) {
      try {
        const created = await strategicPlanningService.createMinute(activeMeeting.id, { content: {
          ...actaData,
          objetivo: Array.isArray(actaData.objetivo) ? actaData.objetivo : [actaData.objetivo || ''],
          desarrollo: Array.isArray(actaData.desarrollo) ? actaData.desarrollo : [actaData.desarrollo || ''],
          conclusiones: Array.isArray(actaData.conclusiones) ? actaData.conclusiones : [actaData.conclusiones || ''],
          participants: meetingParticipants
        } });
        targetMinute = created.data;
      } catch (_) {
        enqueueSnackbar('Guarde la reunión antes de descargar el documento.', { variant: 'warning' });
        return;
      }
    }
    if (!targetMinute) {
      return enqueueSnackbar('Guarde la reunión antes de descargar el documento.', { variant: 'warning' });
    }
    try {
      if (type === 'word') {
        const blob = await strategicPlanningService.downloadMinuteWord(targetMinute.id);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ACTA-${detail?.code || 'PEI'}-V${targetMinute.version}.docx`;
        anchor.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await strategicPlanningService.downloadMinutePdf(targetMinute.id, type);
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `ACTA-${detail?.code || 'PEI'}-V${targetMinute.version}_${type === 'official_copy' ? 'COPIA_OFICIAL' : 'ORIGINAL'}.pdf`;
        anchor.click();
        URL.revokeObjectURL(url);
      }
      enqueueSnackbar('Documento descargado con éxito.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible descargar el documento.', { variant: 'error' });
    }
  };

  const autoSyncedMinuteRef = useRef(new Set());

  const handleFinalizeMinute = async (silent = false) => {
    if (!latestMinute) {
      if (!silent) enqueueSnackbar('Primero genere o habilite una versión del acta.', { variant: 'warning' });
      return;
    }
    setSyncingMinute(true);
    try {
      const response = await strategicPlanningService.finalizeMinute(latestMinute.id);
      if (response?.data?.driveSync) {
        setLastDriveSync(response.data.driveSync);
      }
      await load(false);
      const hasDriveError = Boolean(response?.data?.driveError);
      if (!silent) {
        enqueueSnackbar(response?.message || 'Acta formalizada y sincronizada en Google Drive.', {
          variant: hasDriveError ? 'warning' : 'success'
        });
      }
    } catch (error) {
      if (!silent) {
        enqueueSnackbar(error.response?.data?.message || 'No fue posible sincronizar el acta.', { variant: 'error' });
      }
    } finally {
      setSyncingMinute(false);
    }
  };

  useEffect(() => {
    const isFinalized = activeMeeting?.status === 'formalized' || latestMinute?.status === 'finalized';
    if (isFinalized && latestMinute?.id && !latestMinute?.drive_file_id && !syncingMinute) {
      if (!autoSyncedMinuteRef.current.has(latestMinute.id)) {
        autoSyncedMinuteRef.current.add(latestMinute.id);
        handleFinalizeMinute(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeMeeting?.status, latestMinute?.id, latestMinute?.status, latestMinute?.drive_file_id, syncingMinute]);

  useEffect(() => {
    if (detail) {
      const currentMeeting = activeMeeting || {};
      const currentMeetingId = currentMeeting.id ? String(currentMeeting.id) : (selectedMeetingId || '__new__');
      const meetingKey = `${detail.id}-${currentMeetingId}`;

      // Si ya está cargada esta misma reunión en los inputs y el usuario ya está interactuando,
      // no sobreescribir los campos locales para no interrumpir la escritura ni resetear el foco.
      if (lastLoadedMeetingKeyRef.current === meetingKey) {
        return;
      }
      lastLoadedMeetingKeyRef.current = meetingKey;

      isApplyingLoadRef.current = true;
      if (!selectedMeetingId && currentMeeting.id) setSelectedMeetingId(String(currentMeeting.id));
      const firstItem = detail.items?.[0] || {};
      const defaultStart = currentMeeting.starts_at || firstItem.starts_on;
      const defaultEnd = currentMeeting.ends_at || firstItem.ends_on;
      const savedConclusions = (currentMeeting.commitments || [])
        .map((entry) => typeof entry === 'string' ? entry : `${entry.description || ''}${entry.responsible ? ` — ${entry.responsible}` : ''}`)
        .filter(Boolean)
        .join('\n');

      setMeeting({
        title: currentMeeting.title || `Concertación del Plan de Acción ${detail.term?.year || ''}`.trim(),
        starts_at: toDatetimeLocal(defaultStart, 8),
        ends_at: toDatetimeLocal(defaultEnd, 10),
        location: currentMeeting.location || locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
        modality: currentMeeting.modality || 'Presencial',
        objective: currentMeeting.objective || (firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.'),
        development: currentMeeting.development || 'Se consolidó el plan revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales.',
        conclusions: savedConclusions || 'Se aprueban los registros del Plan de Acción y se genera el acta formal para firmas.',
        participants_text: currentMeeting.participants_text || (
          (currentMeeting.participants && currentMeeting.participants.length > 0)
            ? currentMeeting.participants.map((p) => `${p.name || ''} | ${p.email || ''} | UNICESMAG | ${p.role_title || ''}`).join('\n')
            : `${detail.owner?.name || 'Líder del Proceso'} | ${detail.owner?.email || 'lider@unicesmag.edu.co'} | UNICESMAG | Responsable Institucional`
        )
      });
      const storedParticipants = (currentMeeting.participants || []).map((p, index) => ({
        id: p.id, user_id: p.user_id, document: p.user?.username || p.document || '', name: p.name || '', email: p.email || '',
        organization: p.organization || '', role_title: p.role_title || '', signature_required: p.signature_required !== false,
        meeting_role: p.meeting_role || (index === 0 ? 'principal' : 'participant'),
        status: p.status || 'invited'
      }));

      // Cargar automáticamente Planeación y Efectividad como Responsable Principal
      // y el Responsable del Plan de Acción como Co-responsable
      const peUser = detail.planningEfectividadUser;
      const planResp = detail.planResponsibleUser || detail.currentResponsibility?.responsibleUser || detail.owner;
      const baseList = [...storedParticipants];

      if (peUser) {
        const peIndex = baseList.findIndex((p) =>
          (p.user_id && peUser.id && String(p.user_id) === String(peUser.id)) ||
          (p.email && peUser.email && String(p.email).toLowerCase() === String(peUser.email).toLowerCase())
        );
        if (peIndex === -1) {
          baseList.unshift({
            user_id: peUser.id || null,
            document: peUser.username || peUser.document || '',
            name: peUser.nombre || peUser.name || '',
            email: peUser.email || '',
            organization: peUser.dependencia || 'Dirección de Planeación y Aseguramiento de la Calidad',
            role_title: peUser.cargo || 'Planeación y Efectividad',
            meeting_role: 'principal',
            signature_required: true,
            status: 'invited'
          });
        } else {
          baseList[peIndex] = {
            ...baseList[peIndex],
            meeting_role: 'principal',
            role_title: baseList[peIndex].role_title || peUser.cargo || 'Planeación y Efectividad'
          };
        }
      }

      if (planResp && (!peUser || String(planResp.id) !== String(peUser.id))) {
        const respIndex = baseList.findIndex((p) =>
          (p.user_id && planResp.id && String(p.user_id) === String(planResp.id)) ||
          (p.email && planResp.email && String(p.email).toLowerCase() === String(planResp.email).toLowerCase())
        );
        if (respIndex === -1) {
          baseList.push({
            user_id: planResp.id || null,
            document: planResp.document || planResp.username || '',
            name: planResp.nombre || planResp.name || '',
            email: planResp.email || '',
            organization: planResp.dependencia || detail.organizationalUnit?.name || 'UNICESMAG',
            role_title: planResp.cargo || 'Responsable del Plan de Acción',
            meeting_role: 'co_responsible',
            signature_required: true,
            status: 'invited'
          });
        } else if (peUser && baseList[respIndex].meeting_role === 'principal') {
          baseList[respIndex] = {
            ...baseList[respIndex],
            meeting_role: 'co_responsible'
          };
        }
      }

      const hasPrincipal = baseList.some((p) => p.meeting_role === 'principal');
      const finalParticipants = baseList.map((p, index) => ({
        ...p,
        meeting_role: p.meeting_role === 'principal' || hasPrincipal ? (p.meeting_role || 'participant') : (index === 0 ? 'principal' : 'participant')
      }));

      setMeetingParticipants(finalParticipants);

      const dateStr = currentMeeting.starts_at ? new Date(currentMeeting.starts_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const timeStr = currentMeeting.starts_at && currentMeeting.ends_at
        ? `${new Date(currentMeeting.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - ${new Date(currentMeeting.ends_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        : '08:00 - 10:00';
      const latestMinute = [...(currentMeeting.minuteVersions || [])]
        .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
      const signaturesByParticipant = new Map(
        (latestMinute?.signatures || []).map((signature) => [String(signature.participant_id), signature])
      );
      const rolePosition = { principal: 0, co_responsible: 1, collaborator: 2, participant: 3 };
      const parsedParts = finalParticipants.map((p) => ({
        nombre: p.name || '',
        cargo: p.role_title || p.organization || '',
        rol_reunion: p.meeting_role || 'participant',
        status: p.status || 'invited',
        signature_preview: signaturesByParticipant.get(String(p.id))?.signature_preview || ''
      })).sort((a, b) => (rolePosition[a.rol_reunion] ?? 3) - (rolePosition[b.rol_reunion] ?? 3));
      const responsibleNames = parsedParts
        .filter((participant) => ['principal', 'co_responsible'].includes(participant.rol_reunion))
        .map((participant) => participant.nombre)
        .filter(Boolean);

      setActaData({
        responsables: responsibleNames.join(', ') || detail.organizationalUnit?.name || 'Área responsable del Plan de Acción',
        dependencia: PLANNING_DEPARTMENT_NAME,
        lugar: currentMeeting.location || locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
        fecha: dateStr,
        horario: timeStr,
        objetivo: currentMeeting.objective || (firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.'),
        desarrollo: currentMeeting.development || 'Se consolidó el plan revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales.',
        conclusiones: savedConclusions || 'Se aprueban los registros del Plan de Acción y se genera el acta formal para firmas.',
        participantes: parsedParts.length ? parsedParts : [
          { nombre: detail.owner?.name || 'Líder del Proceso', cargo: detail.owner?.cargo || 'Responsable' }
        ]
      });
      hasUnsavedChangesRef.current = false;
      setSaveStatus('saved');
      window.setTimeout(() => {
        isApplyingLoadRef.current = false;
      }, 400);
    }
  }, [detail, locations, activeMeeting, selectedMeetingId]);

  // Mantiene el formato institucional sincronizado mientras se diligencia la
  // reunión. El guardado en base de datos continúa ocurriendo al confirmar.
  useEffect(() => {
    const date = meeting.starts_at ? String(meeting.starts_at).slice(0, 10) : '';
    const startTime = String(meeting.starts_at || '').split('T')[1]?.slice(0, 5) || '';
    const endTime = String(meeting.ends_at || '').split('T')[1]?.slice(0, 5) || '';
    setActaData((previous) => ({
      ...previous,
      dependencia: PLANNING_DEPARTMENT_NAME,
      lugar: meeting.location || '',
      fecha: date,
      horario: startTime || endTime ? `${startTime || '—'} - ${endTime || '—'}` : '',
      objetivo: meeting.objective || '',
      desarrollo: meeting.development || '',
      conclusiones: meeting.conclusions || ''
    }));
  }, [meeting.starts_at, meeting.ends_at, meeting.location, meeting.objective, meeting.development, meeting.conclusions]);

  const setActaField = (key, val) => setActaData((prev) => ({ ...prev, [key]: val }));
  const detailPed = detail?.term?.strategicPlan;
  const formSchema = detail?.form_schema || detail?.metadata?.form_schema || null;
  const platformFields = (platformPlan?.fieldDefinitions || []).filter((field) => field.active !== false);
  const detailFieldsList = (detailPed?.fieldDefinitions || []).filter((field) => field.active !== false);
  const activePed = (detailFieldsList.length > 0) ? detailPed : (platformFields.length > 0 ? platformPlan : (detailPed || platformPlan));

  const levels = [...(formSchema?.levels || activePed?.levels || platformPlan?.levels || [])].filter((level) => level.active !== false).sort((a, b) => a.position - b.position);
  const periods = useMemo(() => {
    const raw = detail?.term?.monitoringPeriods || [];
    return [...raw].sort((a, b) => (a.position || 0) - (b.position || 0));
  }, [detail?.term?.monitoringPeriods]);

  // Determina si un período de seguimiento aplica a una actividad según sus fechas de ejecución
  const isPeriodApplicableToItem = (item, period) => {
    if (!item) return true;
    const startRaw = item.starts_on || item.fecha_inicio || item.custom_values?.starts_on || item.custom_values?.fecha_inicio;
    const endRaw = item.ends_on || item.fecha_fin || item.custom_values?.ends_on || item.custom_values?.fecha_fin;
    if (!startRaw && !endRaw) return true;
    const start = String(startRaw || endRaw).slice(0, 10);
    const end = String(endRaw || startRaw).slice(0, 10);

    let pStart = period.starts_on ? String(period.starts_on).slice(0, 10) : null;
    let pEnd = period.ends_on ? String(period.ends_on).slice(0, 10) : null;
    const year = (start || end).slice(0, 4) || new Date().getFullYear();
    const isS1 = (period.code || '').toUpperCase() === 'S1' || /1|prim/i.test(period.name || '') || period.position === 1;
    const isS2 = (period.code || '').toUpperCase() === 'S2' || /2|seg/i.test(period.name || '') || period.position === 2;

    if (!pStart || !pEnd) {
      if (isS1) {
        pStart = `${year}-01-01`;
        pEnd = `${year}-07-31`;
      } else if (isS2) {
        pStart = `${year}-08-01`;
        pEnd = `${year}-12-31`;
      }
    } else {
      if (isS1 && pEnd.endsWith('-06-30')) pEnd = `${pEnd.slice(0, 4)}-07-31`;
      if (isS2 && pStart.endsWith('-07-01')) pStart = `${pStart.slice(0, 4)}-08-01`;
    }

    if (!pStart || !pEnd) return true;
    return start <= pEnd && end >= pStart;
  };

  const defaultPeriodId = useMemo(() => {
    if (!periods || periods.length === 0) return '';
    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const targetCode = currentMonth <= 7 ? 'S1' : 'S2';
    const found = periods.find((p) => (p.code || '').toUpperCase() === targetCode);
    return found ? found.id : periods[0].id;
  }, [periods]);

  const evalAvailablePeriods = useMemo(() => {
    if (!evaluatingItem || !periods || periods.length === 0) return periods;
    const filtered = periods.filter((p) => isPeriodApplicableToItem(evaluatingItem, p));
    return filtered.length > 0 ? filtered : periods;
  }, [evaluatingItem, periods]);

  const tab4FilteredItems = useMemo(() => {
    const items = detail?.items || [];
    if (!activitySearch.trim()) return items;
    const q = activitySearch.toLowerCase().trim();
    return items.filter((it) =>
      (it.code || '').toLowerCase().includes(q) ||
      (it.activity || '').toLowerCase().includes(q) ||
      (it.indicator || '').toLowerCase().includes(q) ||
      (it.macroactivity || '').toLowerCase().includes(q)
    );
  }, [detail?.items, activitySearch]);

  const kpiStats = useMemo(() => {
    const items = detail?.items || [];
    const totalActivities = items.length;
    let totalProgressSum = 0;
    let totalEvidences = 0;
    let completedActivities = 0;

    items.forEach((it) => {
      const results = it.monitoringResults || [];
      const evidences = it.evidence || [];
      totalEvidences += evidences.length;

      const validResults = results.filter((r) => r.physical_progress !== null && r.physical_progress !== undefined);
      let itProgress = 0;
      if (validResults.length > 0) {
        itProgress = validResults.reduce((acc, r) => acc + Number(r.physical_progress || 0), 0);
      } else if (it.current_progress !== undefined && it.current_progress !== null) {
        itProgress = Number(it.current_progress || 0);
      }
      totalProgressSum += itProgress;
      if (itProgress >= 100) {
        completedActivities += 1;
      }
    });

    const avgProgress = totalActivities > 0 ? (totalProgressSum / totalActivities).toFixed(1) : '0.0';
    const pendingActivities = Math.max(0, totalActivities - completedActivities);

    return {
      totalActivities,
      avgProgress,
      totalEvidences,
      completedActivities,
      pendingActivities
    };
  }, [detail?.items]);

  const schemaFields = useMemo(() => (Array.isArray(formSchema?.fields) ? formSchema.fields : []).filter((f) => f && f.active !== false), [formSchema?.fields]);
  const pedFields = useMemo(() => (activePed?.fieldDefinitions || platformPlan?.fieldDefinitions || []).filter((f) => f && f.active !== false), [activePed?.fieldDefinitions, platformPlan?.fieldDefinitions]);

  const activityFields = useMemo(() => {
    const mergedFieldsMap = new Map();
    // 1. Agregar campos del esquema guardado
    schemaFields.forEach((f) => mergedFieldsMap.set(f.key, { ...f }));
    // 2. Complementar o actualizar con los campos configurados en el PED
    pedFields.forEach((f) => {
      const existing = mergedFieldsMap.get(f.key);
      if (!existing) {
        mergedFieldsMap.set(f.key, { ...f });
      } else {
        const pedOptions = Array.isArray(f.options) && f.options.length > 0 ? f.options : null;
        mergedFieldsMap.set(f.key, {
          ...existing,
          ...f,
          options: pedOptions || existing.options || [],
          validation_rules: { ...(existing.validation_rules || {}), ...(f.validation_rules || {}) }
        });
      }
    });

    const rawFields = (mergedFieldsMap.size > 0 ? Array.from(mergedFieldsMap.values()) : (schemaFields.length > 0 ? schemaFields : pedFields))
      .sort((a, b) => (a.position || 0) - (b.position || 0));

    const active = rawFields.length > 0 ? rawFields : DEFAULT_ACTIVITY_FIELDS;
    return active.filter((field) => field.data_type !== 'formula' && !ACTIVITY_FORM_EXCLUDED_KEYS.has(field.key));
  }, [schemaFields, pedFields]);

  const recordColumns = activityFields;

  const formElements = formSchema?.elements || structure;
  const formCatalogs = (formSchema?.catalogs && formSchema.catalogs.length > 0)
    ? formSchema.catalogs
    : ((activePed?.catalogItems && activePed.catalogItems.length > 0)
      ? activePed.catalogItems
      : (platformPlan?.catalogItems || []));

  const planResponsiblePerson =
    detail?.currentResponsibility?.responsibleUser ||
    detail?.responsibleUser ||
    detail?.planResponsibleUser ||
    detail?.owner;

  const defaultResponsibleText = useMemo(() => {
    if (planResponsiblePerson?.nombre) {
      return planResponsiblePerson.nombre;
    }
    if (detail?.organizationalUnit?.name) {
      return detail.organizationalUnit.name;
    }
    return '';
  }, [planResponsiblePerson, detail?.organizationalUnit]);

  const defaultStartDate = useMemo(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }, []);

  const defaultEndDate = useMemo(() => {
    const fromMeta = detail?.metadata?.formulation_ends_on || detail?.term?.metadata?.formulation_ends_on;
    if (fromMeta) return fromMeta;
    if (detail?.term?.year) return `${detail.term.year}-12-31`;
    return '';
  }, [detail]);

  const getInitialItem = useCallback(() => {
    const respField = activityFields.find(isResponsibleField);
    const startField = activityFields.find(isStartDateField);
    const endField = activityFields.find(isEndDateField);

    const customVals = {};
    if (respField && defaultResponsibleText) {
      customVals[respField.key] = defaultResponsibleText;
    }
    if (startField && defaultStartDate) {
      customVals[startField.key] = defaultStartDate;
    }
    if (endField && defaultEndDate) {
      customVals[endField.key] = defaultEndDate;
    }

    return {
      ...emptyItem,
      starts_on: defaultStartDate,
      ends_on: defaultEndDate,
      co_responsibles: [],
      custom_values: customVals
    };
  }, [activityFields, defaultResponsibleText, defaultStartDate, defaultEndDate]);

  const initializedPlanRef = useRef(null);

  useEffect(() => {
    if (!open) {
      initializedPlanRef.current = null;
      setEditingItemId(null);
    }
  }, [open]);

  useEffect(() => {
    if (detail?.id && initializedPlanRef.current !== detail.id) {
      initializedPlanRef.current = detail.id;
      setItem(getInitialItem());
    }
  }, [detail?.id, getInitialItem]);

  const searchActivities = useCallback(async (queryText = '') => {
    if (!detail?.id) return;
    setLoadingActivitySuggestions(true);
    try {
      const resp = await strategicPlanningService.searchActivitySuggestions(detail.id, queryText);
      const list = Array.isArray(resp?.data) ? resp.data : (Array.isArray(resp) ? resp : []);
      setActivitySuggestions(list);
    } catch (err) {
      console.warn('Error buscando sugerencias de actividades:', err);
    } finally {
      setLoadingActivitySuggestions(false);
    }
  }, [detail?.id]);

  const handleActivityInputChange = useCallback((queryText) => {
    if (activitySearchTimeoutRef.current) {
      clearTimeout(activitySearchTimeoutRef.current);
    }
    activitySearchTimeoutRef.current = setTimeout(() => {
      searchActivities(queryText);
    }, 280);
  }, [searchActivities]);

  useEffect(() => {
    if (detail?.id && open) {
      searchActivities('');
    }
  }, [detail?.id, open, searchActivities]);

  const combinedActivitySuggestions = useMemo(() => {
    const list = [...activitySuggestions];
    const seen = new Set(list.map((s) => normalizeFieldText(s.activity)));

    // Incorporar actividades del plan actual si no están en la lista
    if (Array.isArray(detail?.items)) {
      detail.items.forEach((it) => {
        const text = String(it.activity || '').trim();
        if (text) {
          const norm = normalizeFieldText(text);
          if (!seen.has(norm)) {
            seen.add(norm);
            list.unshift({
              id: it.id,
              code: it.code,
              activity: text,
              indicator_type: it.indicator_type || '',
              indicator: it.indicator || '',
              target: it.target || '',
              starts_on: it.starts_on || '',
              ends_on: it.ends_on || '',
              custom_values: it.custom_values || {},
              co_responsibles: it.co_responsibles || [],
              dependency_name: detail.organizationalUnit?.name || '',
              term_year: detail.term?.year || '',
              is_same_plan: true,
              is_same_dependency: true
            });
          }
        }
      });
    }

    return list;
  }, [activitySuggestions, detail?.items, detail?.organizationalUnit?.name, detail?.term?.year]);

  const handleSelectActivitySuggestion = useCallback((selectedSuggestion, field) => {
    if (!selectedSuggestion) return;
    const activityText = typeof selectedSuggestion === 'string'
      ? selectedSuggestion
      : (selectedSuggestion.activity || selectedSuggestion.label || '');

    setFieldValue(field, activityText);

    if (typeof selectedSuggestion === 'object' && selectedSuggestion.activity) {
      setItem((curr) => {
        const nextCustom = { ...(curr.custom_values || {}) };
        nextCustom[field.key] = activityText;

        const nextItem = {
          ...curr,
          activity: activityText,
          custom_values: nextCustom
        };

        // 1. Indicador
        const indField = activityFields.find(isIndicatorField);
        if (selectedSuggestion.indicator) {
          if (!curr.indicator) nextItem.indicator = selectedSuggestion.indicator;
          if (indField && !nextCustom[indField.key]) nextCustom[indField.key] = selectedSuggestion.indicator;
        }

        // 2. Tipo de indicador
        const typeField = activityFields.find((f) => f.key === 'indicator_type' || normalizeFieldText(f.label).includes('tipo de indicador'));
        if (selectedSuggestion.indicator_type) {
          if (!curr.indicator_type) nextItem.indicator_type = selectedSuggestion.indicator_type;
          if (typeField && !nextCustom[typeField.key]) nextCustom[typeField.key] = selectedSuggestion.indicator_type;
        }

        // 3. Meta
        const targetField = activityFields.find((f) => f.key === 'target' || normalizeFieldText(f.label).includes('meta'));
        if (selectedSuggestion.target) {
          if (!curr.target) nextItem.target = selectedSuggestion.target;
          if (targetField && !nextCustom[targetField.key]) nextCustom[targetField.key] = selectedSuggestion.target;
        }

        // 4. Macroactividad y otros campos dinámicos del PED si existen en la sugerencia
        const macroField = activityFields.find(isMacroactivityField);
        const suggestionMacro = selectedSuggestion.macroactivity || selectedSuggestion.custom_values?.macroactivity || (macroField && selectedSuggestion.custom_values?.[macroField.key]);
        if (suggestionMacro) {
          nextItem.macroactivity = suggestionMacro;
          if (macroField) nextCustom[macroField.key] = suggestionMacro;
        }
        if (selectedSuggestion.custom_values && typeof selectedSuggestion.custom_values === 'object') {
          Object.entries(selectedSuggestion.custom_values).forEach(([k, v]) => {
            if (v && !nextCustom[k] && !['starts_on', 'ends_on', 'fecha_inicio', 'fecha_fin', 'responsible', 'co_responsibles'].includes(k)) {
              nextCustom[k] = v;
            }
          });
        }

        return nextItem;
      });

      enqueueSnackbar('Actividad seleccionada del banco. Indicador y meta asociados automáticamente.', { variant: 'info', autoHideDuration: 3000 });
    }
  }, [activityFields, enqueueSnackbar]);

  const recordValue = (row, field) => {
    if (isCoResponsibleField(field)) {
      const val = row[field.key] || row.co_responsibles || row.custom_values?.[field.key];
      const parsed = parseCoResponsibles(val);
      return parsed.length ? parsed.join(', ') : '—';
    }
    if (isResponsibleField(field)) {
      const val = row[field.key] || row.custom_values?.[field.key];
      if (val && String(val).trim()) return String(val);
      return defaultResponsibleText || '—';
    }
    const directKeys = new Set(['indicator_type', 'starts_on', 'ends_on', 'indicator', 'target', 'co_responsibles']);
    let value = field.key === 'activity' ? row.activity : directKeys.has(field.key) ? row[field.key] : row.custom_values?.[field.key];
    const catalogType = field.validation_rules?.catalog_type;
    if (catalogType && value) {
      let ids = [];
      if (Array.isArray(value)) {
        ids = value;
      } else if (typeof value === 'string' && value.trim()) {
        try {
          const parsed = JSON.parse(value);
          ids = Array.isArray(parsed) ? parsed : [value];
        } catch (_) {
          ids = value.includes(',') ? value.split(',').map((s) => s.trim()).filter(Boolean) : [value];
        }
      } else {
        ids = [value];
      }
      value = ids.map((id) => formCatalogs.find((entry) => String(entry.id) === String(id))?.name || id);
    }
    if (Array.isArray(value)) return value.join(', ');
    return value === null || value === undefined || value === '' ? '—' : String(value);
  };
  const structureKey = (levelId) => `structure_level_${levelId}`;
  // eslint-disable-next-line no-unused-vars
  const structureOptions = (level, index) => {
    const candidates = formElements.filter((element) => element.level_id === level.id && element.active);
    if (index === 0) return candidates;
    const parentId = item.custom_values?.[structureKey(levels[index - 1].id)];
    return parentId ? candidates.filter((element) => !element.parent_id || String(element.parent_id) === String(parentId)) : candidates;
  };
  // eslint-disable-next-line no-unused-vars
  const selectStructureElement = (level, index, value) => {
    const customValues = { ...(item.custom_values || {}), [structureKey(level.id)]: value };
    levels.slice(index + 1).forEach((nextLevel) => { delete customValues[structureKey(nextLevel.id)]; });
    setItem({ ...item, custom_values: customValues });
  };
  const availableTransitions = useMemo(() => (workflow?.transitions || []).filter((entry) => entry.from === detail?.status), [workflow, detail?.status]);

  const filteredPreviewItems = useMemo(() => {
    const items = detail?.items || [];
    if (!previewPlanSearch.trim()) return items;
    const q = previewPlanSearch.toLowerCase();
    return items.filter((row) => {
      if (row.code?.toLowerCase().includes(q)) return true;
      if (row.activity?.toLowerCase().includes(q)) return true;
      if (row.indicator?.toLowerCase().includes(q)) return true;
      if (row.target?.toLowerCase().includes(q)) return true;
      return recordColumns.some((col) => {
        const val = recordValue(row, col);
        return String(val || '').toLowerCase().includes(q);
      });
    });
  }, [detail?.items, previewPlanSearch, recordColumns]);

  const coResponsiblePreviewItems = useMemo(() => {
    return detail?.co_responsible_items || [];
  }, [detail?.co_responsible_items]);

  const filteredCoPreviewItems = useMemo(() => {
    const items = coResponsiblePreviewItems;
    if (!previewPlanSearch.trim()) return items;
    const q = previewPlanSearch.toLowerCase();
    return items.filter((row) => {
      if (row.code?.toLowerCase().includes(q)) return true;
      if ((row.activity || row.actividad)?.toLowerCase().includes(q)) return true;
      if ((row.indicator || row.indicador)?.toLowerCase().includes(q)) return true;
      if ((row.target || row.meta)?.toLowerCase().includes(q)) return true;
      if ((row.parent_plan?.dependency_name || row.parent_plan_name || row.responsable)?.toLowerCase().includes(q)) return true;
      if ((row.parent_plan?.leader_name || row.leader_name)?.toLowerCase().includes(q)) return true;
      return recordColumns.some((col) => {
        const val = recordValue(row, col);
        return String(val || '').toLowerCase().includes(q);
      });
    });
  }, [coResponsiblePreviewItems, previewPlanSearch, recordColumns]);

  const fieldValue = (field) => {
    if (!field) return '';
    if (isActivityField(field)) {
      return item[field.key] || item.custom_values?.[field.key] || item.activity || '';
    }
    if (isResponsibleField(field)) {
      const direct = item[field.key];
      const custom = item.custom_values?.[field.key];
      return direct || custom || defaultResponsibleText;
    }
    if (isStartDateField(field)) {
      const direct = item.starts_on || item[field.key];
      const custom = item.custom_values?.[field.key];
      if (direct || custom) return direct || custom;
      if (!editingItemId) return defaultStartDate;
      return '';
    }
    if (isEndDateField(field)) {
      const direct = item.ends_on || item[field.key];
      const custom = item.custom_values?.[field.key];
      if (direct || custom) return direct || custom;
      if (!editingItemId) return defaultEndDate;
      return '';
    }
    if (isCoResponsibleField(field)) {
      const custom = item.custom_values?.[field.key];
      if (custom && (!Array.isArray(item.co_responsibles) || !item.co_responsibles.length)) {
        return parseCoResponsibles(custom);
      }
      return parseCoResponsibles(item.co_responsibles);
    }
    if (item.custom_values && item.custom_values[field.key] !== undefined && item.custom_values[field.key] !== null) {
      return item.custom_values[field.key];
    }
    if (item[field.key] !== undefined && item[field.key] !== null) {
      return item[field.key];
    }
    return '';
  };
  const setFieldValue = (field, value) => {
    if (isActivityField(field)) {
      setItem((current) => ({
        ...current,
        activity: value,
        [field.key]: value,
        custom_values: { ...(current.custom_values || {}), [field.key]: value }
      }));
      return;
    }
    if (isStartDateField(field)) {
      setItem((current) => ({
        ...current,
        starts_on: value,
        custom_values: { ...(current.custom_values || {}), [field.key]: value }
      }));
      return;
    }
    if (isEndDateField(field)) {
      setItem((current) => ({
        ...current,
        ends_on: value,
        custom_values: { ...(current.custom_values || {}), [field.key]: value }
      }));
      return;
    }
    if (isCoResponsibleField(field)) {
      const parsed = Array.isArray(value) ? value : parseCoResponsibles(value);
      setItem((current) => ({
        ...current,
        co_responsibles: parsed,
        custom_values: { ...(current.custom_values || {}), [field.key]: parsed }
      }));
      return;
    }
    if (isResponsibleField(field)) {
      setItem((current) => ({
        ...current,
        [field.key]: value,
        custom_values: { ...(current.custom_values || {}), [field.key]: value }
      }));
      return;
    }
    if (['activity','indicator_type','starts_on','ends_on','indicator','target','co_responsibles'].includes(field.key)) {
      setItem((current) => ({
        ...current,
        [field.key]: value,
        custom_values: { ...(current.custom_values || {}), [field.key]: value }
      }));
    } else {
      setItem((current) => ({
        ...current,
        custom_values: { ...(current.custom_values || {}), [field.key]: value }
      }));
    }
  };
  const renderConfiguredField = (field) => {
    // 1. Campo de Responsable: precargado automáticamente con el líder del Plan de Acción
    if (isResponsibleField(field)) {
      const currentRespVal = fieldValue(field) || defaultResponsibleText;
      const isLeader = Boolean(defaultResponsibleText && currentRespVal === defaultResponsibleText);
      return (
        <Box
          key={field.id || field.key}
          sx={{
            gridColumn: { xs: '1 / -1', md: 'span 1' },
            position: 'relative'
          }}
        >
          {isLeader && (
            <Chip
              size="small"
              label="Líder del Plan"
              color="primary"
              variant="outlined"
              sx={{
                position: 'absolute',
                top: -10,
                right: 12,
                zIndex: 2,
                height: 20,
                fontSize: 10.5,
                fontWeight: 850,
                bgcolor: '#eff6ff',
                color: '#1d4ed8',
                borderColor: '#bfdbfe',
                boxShadow: '0 1px 3px rgba(37,99,235,0.08)'
              }}
            />
          )}
          <Autocomplete
            freeSolo
            options={institutionalUsers.map((u) => u.name || u.nombre).filter(Boolean)}
            value={currentRespVal}
            onInputChange={(_, newInputValue) => {
              setFieldValue(field, newInputValue);
            }}
            onChange={(_, newValue) => {
              setFieldValue(field, typeof newValue === 'string' ? newValue : (newValue?.name || newValue?.nombre || ''));
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                required={field.required}
                label={field.label || 'Responsable'}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    bgcolor: '#f8fafc',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { borderColor: '#86add9' },
                    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(104, 157, 214, 0.14)', bgcolor: '#ffffff' }
                  }
                }}
              />
            )}
          />
        </Box>
      );
    }

    // 2. Campo de Corresponsable(s): selector interactivo múltiple con casillas de verificación (checkboxes) y búsqueda por cédula, nombre, cargo o dependencia
    if (isCoResponsibleField(field)) {
      const rawValues = parseCoResponsibles(fieldValue(field) || item.co_responsibles);
      const selectedValues = rawValues.map((val) => {
        if (!val) return null;
        if (typeof val === 'object' && (val.name || val.nombre)) return val;
        const normVal = normalizeFieldText(val);
        const match = institutionalUsers.find((u) =>
          String(u.id) === String(val) ||
          String(u.document) === String(val) ||
          normalizeFieldText(u.name || u.nombre) === normVal
        );
        return match || val;
      }).filter(Boolean);

      return (
        <Box
          key={field.id || field.key}
          sx={{ gridColumn: { xs: '1 / -1', md: 'span 2' } }}
        >
          <Autocomplete
            multiple
            disableCloseOnSelect
            options={institutionalUsers}
            value={selectedValues}
            isOptionEqualToValue={(option, val) => {
              if (!val) return false;
              if (typeof val === 'string') {
                return (
                  option.name === val ||
                  option.document === val ||
                  normalizeFieldText(option.name) === normalizeFieldText(val)
                );
              }
              return option.id === val.id || (option.document && option.document === val.document);
            }}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return `${option.name || option.nombre || ''} ${option.document ? `(CC: ${option.document})` : ''} - ${option.dependency || option.cargo || ''}`;
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue || !inputValue.trim()) return options.slice(0, 50);
              const q = normalizeFieldText(inputValue);
              return options.filter((opt) => {
                const doc = String(opt.document || '').toLowerCase();
                const name = normalizeFieldText(opt.name || opt.nombre || '');
                const email = String(opt.email || '').toLowerCase();
                const dep = normalizeFieldText(opt.dependency || opt.dependencia || '');
                const pos = normalizeFieldText(opt.position || opt.cargo || '');
                return doc.includes(q) || name.includes(q) || email.includes(q) || dep.includes(q) || pos.includes(q);
              }).slice(0, 50);
            }}
            onChange={(_, newValues) => {
              const names = newValues.map((v) => (typeof v === 'string' ? v : (v.name || v.nombre || ''))).filter(Boolean);
              setItem((curr) => ({
                ...curr,
                co_responsibles: names,
                custom_values: {
                  ...(curr.custom_values || {}),
                  [field.key]: names
                }
              }));
            }}
            renderOption={(props, option, { selected }) => (
              <li {...props} key={option.id || option.document || (typeof option === 'string' ? option : option.name)}>
                <Checkbox
                  icon={<CheckBoxOutlineBlankIcon fontSize="small" />}
                  checkedIcon={<CheckBoxIcon fontSize="small" />}
                  style={{ marginRight: 8 }}
                  checked={selected}
                />
                <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, py: 0.5 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: '#1e293b' }}>
                    {typeof option === 'string' ? option : (option.name || option.nombre)}
                  </Typography>
                  {typeof option === 'object' && (
                    <Typography variant="caption" sx={{ color: '#64748b' }}>
                      {option.document ? `C.C. ${option.document} · ` : ''}
                      {option.dependency || option.dependencia || ''}
                      {option.position || option.cargo ? ` (${option.position || option.cargo})` : ''}
                    </Typography>
                  )}
                </Box>
              </li>
            )}
            renderTags={(tagValue, getTagProps) =>
              tagValue.map((opt, index) => {
                const label = typeof opt === 'string' ? opt : (opt.name || opt.nombre);
                return (
                  <Chip
                    {...getTagProps({ index })}
                    key={typeof opt === 'string' ? opt : (opt.id || opt.document || index)}
                    label={label}
                    size="small"
                    sx={{
                      bgcolor: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      border: '1px solid #bfdbfe',
                      borderRadius: 1.5
                    }}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                size="small"
                required={field.required}
                label={field.label || 'Corresponsable(s)'}
                placeholder={selectedValues.length ? '' : 'Buscar por cédula, nombre, cargo o dependencia...'}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { borderColor: '#86add9' },
                    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(104, 157, 214, 0.14)' }
                  }
                }}
              />
            )}
          />
        </Box>
      );
    }

    // 3. Campo de Actividad: Autocompletado inteligente con sugerencias de actividades existentes por palabras clave
    if (isActivityField(field)) {
      const currentActivityVal = fieldValue(field) || item.activity || '';
      return (
        <Box
          key={field.id || field.key}
          sx={{
            gridColumn: { xs: '1 / -1', md: 'span 2' },
            position: 'relative'
          }}
        >
          <Autocomplete
            freeSolo
            autoSelect={false}
            clearOnBlur={false}
            handleHomeEndKeys={false}
            options={combinedActivitySuggestions}
            getOptionLabel={(option) => {
              if (typeof option === 'string') return option;
              return option.activity || option.label || '';
            }}
            filterOptions={(options, { inputValue }) => {
              if (!inputValue || !inputValue.trim()) return options.slice(0, 30);
              const q = normalizeFieldText(inputValue);
              const words = q.split(/\s+/).filter(Boolean);
              return options.filter((opt) => {
                const text = normalizeFieldText(typeof opt === 'string' ? opt : (opt.activity || opt.label || ''));
                const code = normalizeFieldText(opt.code || '');
                const dep = normalizeFieldText(opt.dependency_name || '');
                return words.every((w) => text.includes(w) || code.includes(w) || dep.includes(w));
              }).slice(0, 30);
            }}
            value={currentActivityVal}
            inputValue={currentActivityVal}
            onInputChange={(_, newInputValue, reason) => {
              setFieldValue(field, newInputValue);
              if (reason === 'input' || reason === 'clear') {
                handleActivityInputChange(newInputValue);
              }
            }}
            onChange={(_, newValue) => {
              if (typeof newValue === 'string') {
                setFieldValue(field, newValue);
              } else if (newValue && typeof newValue === 'object') {
                handleSelectActivitySuggestion(newValue, field);
              }
            }}
            renderOption={(props, option) => {
              const optActivity = typeof option === 'string' ? option : option.activity;
              const optCode = typeof option === 'object' ? option.code : null;
              const optDep = typeof option === 'object' ? option.dependency_name : null;
              const optYear = typeof option === 'object' ? option.term_year : null;
              const optInd = typeof option === 'object' ? option.indicator : null;
              const optTarget = typeof option === 'object' ? option.target : null;
              const isSameDep = typeof option === 'object' ? option.is_same_dependency : false;

              return (
                <li {...props} key={option.id || (typeof option === 'string' ? option : option.code) || optActivity}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', py: 0.75, gap: 0.35 }}>
                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
                      <Stack direction="row" spacing={0.75} alignItems="center">
                        {optCode && (
                          <Chip
                            size="small"
                            label={optCode}
                            sx={{
                              height: 20,
                              fontSize: 10,
                              fontWeight: 850,
                              bgcolor: isSameDep ? '#dbeafe' : '#f1f5f9',
                              color: isSameDep ? '#1e40af' : '#475569'
                            }}
                          />
                        )}
                        {(optDep || optYear) && (
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: 11 }}>
                            {optDep ? optDep : ''}{optYear ? ` · ${optYear}` : ''}
                          </Typography>
                        )}
                      </Stack>
                      {isSameDep && (
                        <Chip
                          size="small"
                          label="Esta dependencia"
                          sx={{ height: 18, fontSize: 9.5, fontWeight: 800, bgcolor: '#f0fdf4', color: '#15803d' }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" sx={{ fontWeight: 800, color: '#0f172a', lineHeight: 1.35, mt: 0.25 }}>
                      {optActivity}
                    </Typography>
                    {(optInd || optTarget) && (
                      <Typography variant="caption" sx={{ color: '#64748b', fontSize: 11, display: 'block' }}>
                        {optInd ? `Indicador: ${optInd.slice(0, 70)}${optInd.length > 70 ? '...' : ''}` : ''}
                        {optTarget ? ` · Meta: ${optTarget}` : ''}
                      </Typography>
                    )}
                  </Box>
                </li>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                fullWidth
                size="small"
                required={field.required || field.key === 'activity'}
                multiline
                minRows={2}
                maxRows={5}
                label={field.label || 'Actividades'}
                placeholder="Escriba el nombre de la actividad..."
                
                InputProps={{
                  ...params.InputProps,
                  endAdornment: (
                    <>
                      {loadingActivitySuggestions ? <CircularProgress color="primary" size={16} sx={{ mr: 1 }} /> : null}
                      {params.InputProps.endAdornment}
                    </>
                  )
                }}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': { borderColor: '#86add9' },
                    '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(104, 157, 214, 0.14)' }
                  }
                }}
              />
            )}
          />
        </Box>
      );
    }

    const catalogType = field.validation_rules?.catalog_type
      || (['responsible', 'responsable_de_ejecucion', 'co_responsibles'].includes(field.key) ? 'organizational_unit' : undefined);
    const catalogEntries = catalogType
      ? formCatalogs.filter((entry) => (entry.catalog_type === catalogType || (catalogType === 'organizational_unit' && entry.catalog_type === 'dependency')) && entry.active !== false)
      : [];
    const storedOptions = Array.isArray(field.options) ? field.options : (field.options ? [field.options] : []);
    let options = catalogEntries.length
      ? catalogEntries.map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` }))
      : storedOptions
        .flatMap((option) => String(option).split(/\r?\n/))
        .map((option) => option.trim())
        .filter(Boolean)
        .map((option) => ({ value: option, label: option }));

    // Si es tipo relación con la estructura del PED (o si es un campo de Objetivo / Lineamiento sin opciones manuales),
    // obtener automáticamente los elementos de la estructura del PED
    if ((field.data_type === 'strategic_relation' || !options.length) && Array.isArray(formElements) && formElements.length > 0) {
      const normKey = (field.key || '').toLowerCase();
      const normLabel = (field.label || '').toLowerCase();
      const matchedLevel = levels.find((lvl) => {
        if (field.validation_rules?.selected_level_id && String(lvl.id) === String(field.validation_rules.selected_level_id)) return true;
        const normLvlName = (lvl.name || '').toLowerCase();
        if (normKey.includes('objective') || normLabel.includes('objetivo')) return normLvlName.includes('objetivo') || lvl.position === 1;
        if (normKey.includes('guideline') || normKey.includes('lineamiento') || normLabel.includes('lineamiento')) return normLvlName.includes('lineamiento') || lvl.position === 2;
        return normLvlName === normLabel;
      });
      if (matchedLevel) {
        const matchingElements = formElements.filter((el) => String(el.level_id) === String(matchedLevel.id) && el.active !== false);
        if (matchingElements.length > 0) {
          options = matchingElements.map((el) => {
            const text = el.code ? `${el.code} ${el.name}` : el.name;
            return { value: text, label: text };
          });
        }
      }
    }

    if (field.key === 'indicator_type' && !options.length) options = ['Gestión','Resultado','Producto','Impacto'].map((value) => ({ value, label: value }));
    
    // Si aún no hay opciones y es corresponsables o responsables, buscar en cualquier lista de dependencias disponible
    if (['responsible', 'responsable_de_ejecucion', 'co_responsibles'].includes(field.key) && !options.length) {
      const fallbackList = formCatalogs.filter((entry) => ['organizational_unit', 'dependency'].includes(entry.catalog_type) && entry.active !== false);
      if (fallbackList.length) {
        options = fallbackList.map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` }));
      }
    }

    const multiple = field.data_type === 'catalog_multi';
    const select = ['list', 'catalog', 'catalog_multi', 'strategic_relation'].includes(field.data_type) || field.key === 'indicator_type' || (options.length > 0 && !['long_text', 'file', 'date', 'number', 'percentage', 'currency'].includes(field.data_type));
    const rawValue = fieldValue(field);
    let currentValue;
    if (multiple) {
      let arr = [];
      if (Array.isArray(rawValue)) {
        arr = rawValue;
      } else if (typeof rawValue === 'string' && rawValue.trim()) {
        try {
          const parsed = JSON.parse(rawValue);
          arr = Array.isArray(parsed) ? parsed : [rawValue];
        } catch (_) {
          arr = rawValue.includes(',') ? rawValue.split(',').map((s) => s.trim()).filter(Boolean) : [rawValue];
        }
      } else if (rawValue !== null && rawValue !== undefined && rawValue !== '') {
        arr = [rawValue];
      }
      currentValue = arr.map((val) => {
        const matchedOpt = options.find((opt) => String(opt.value) === String(val) || String(opt.label).toLowerCase().includes(String(val).toLowerCase()));
        return matchedOpt ? matchedOpt.value : val;
      });
    } else {
      currentValue = rawValue ?? '';
      if (select && options.length > 0 && currentValue !== '') {
        const matched = options.find((opt) => String(opt.value) === String(currentValue));
        if (matched) {
          currentValue = matched.value;
        }
      }
    }
    const wide = field.data_type === 'long_text' || field.key === 'activity' || field.data_type === 'file';
    const isCompact = ['date','number','percentage','currency'].includes(field.data_type);

    return (
      <Box
        key={field.id}
        sx={{
          gridColumn: wide
            ? { xs: '1 / -1', md: 'span 2' }
            : isCompact
            ? { xs: '1 / -1', sm: 'span 1' }
            : { xs: '1 / -1', md: 'span 1' }
        }}
      >
        <TextField
          fullWidth
          size="small"
          required={field.required || field.key === 'activity'}
          select={select}
          disabled={select && !options.length}
          multiline={field.data_type === 'long_text' || field.key === 'activity'}
          minRows={field.data_type === 'long_text' || field.key === 'activity' ? 2 : undefined}
          type={!select && field.data_type === 'date' ? 'date' : !select && ['number','percentage','currency'].includes(field.data_type) ? 'number' : 'text'}
          InputLabelProps={field.data_type === 'date' ? { shrink: true } : undefined}
          SelectProps={multiple ? {
            multiple: true,
            renderValue: (selected) => {
              if (!Array.isArray(selected) || !selected.length) return '';
              return selected.map((val) => {
                const opt = options.find((o) => String(o.value) === String(val));
                return opt ? opt.label : val;
              }).join(', ');
            },
            MenuProps: { PaperProps: { sx: { maxWidth: 540, maxHeight: 380 } } }
          } : {
            MenuProps: { PaperProps: { sx: { maxWidth: 540, maxHeight: 380 } } }
          }}
          inputProps={field.data_type === 'percentage' ? { min: 0, max: 100 } : undefined}
          label={field.label}
          value={currentValue}
          onChange={(e) => setFieldValue(field, e.target.value)}
          helperText={
            select && !options.length
              ? 'Esta lista no tiene opciones disponibles.'
              : undefined
          }
          sx={{
            '& .MuiOutlinedInput-root': {
              borderRadius: 2.5,
              bgcolor: '#ffffff',
              transition: 'all 0.2s ease-in-out',
              '&:hover': { borderColor: '#86add9' },
              '&.Mui-focused': { boxShadow: '0 0 0 3px rgba(104, 157, 214, 0.14)' }
            }
          }}
        >
          {select && options.map((option) => (
            <MenuItem key={option.value} value={option.value} sx={{ whiteSpace: 'normal', lineHeight: 1.45, py: 1 }}>
              {option.label}
            </MenuItem>
          ))}
        </TextField>
      </Box>
    );
  };

  // Cálculos de vigencia y plazos de la Etapa 1 (Regla: mayor plazo entre individual y global)
  const stage1Schedule = useMemo(() => getPlanEffectiveSchedule(detail), [detail]);
  const stage1StartsOn = stage1Schedule.effectiveStartsOn || (detail?.term?.year ? `${detail.term.year}-01-01` : '');
  const stage1EndsOn = stage1Schedule.effectiveEndsOn || (detail?.term?.year ? `${detail.term.year}-03-31` : '');
  const stage1Extensions = Array.isArray(detail?.metadata?.formulation_extensions) ? detail.metadata.formulation_extensions : [];
  const isStage1Expired = stage1Schedule.isScheduleExpired;
  const isStage1NotStarted = stage1Schedule.isScheduleNotStarted;
  const isStage1Extended = stage1Schedule.hasActiveIndividualExtension;
  const isStage1Open = stage1Schedule.isWithinSchedule;
  const daysRemainingStage1 = stage1Schedule.daysRemaining;

  const adjustmentInfo = useMemo(() => {
    if (detail?.metadata?.last_adjustment_request?.comment) {
      return detail.metadata.last_adjustment_request;
    }
    const events = detail?.workflowEvents || [];
    const adjEvent = [...events].reverse().find((e) => e.action === 'request_owner_adjustments' || e.to_state === 'adjustments');
    if (adjEvent && adjEvent.comment) {
      return {
        comment: adjEvent.comment,
        requested_by_name: detail.currentResponsibility?.responsibleUser?.nombre || 'Líder de Dependencia',
        requested_by_email: detail.currentResponsibility?.responsibleUser?.email || null,
        requested_at: adjEvent.created_at
      };
    }
    return null;
  }, [detail]);

  const [feedbackChatModalOpen, setFeedbackChatModalOpen] = useState(false);
  const [submitValidationModalOpen, setSubmitValidationModalOpen] = useState(false);
  const [planningResponseComment, setPlanningResponseComment] = useState('');
  const [submittingValidation, setSubmittingValidation] = useState(false);
  const [sendingChatMessage, setSendingChatMessage] = useState(false);

  useEffect(() => {
    if (open && initialOpenChat) {
      setFeedbackChatModalOpen(true);
    }
  }, [open, initialOpenChat]);

  const chatThread = useMemo(() => {
    const meta = detail?.metadata || {};
    if (Array.isArray(meta.chat_thread)) {
      return meta.chat_thread;
    }
    return [];
  }, [detail?.metadata]);

  const handleSendChatMessage = async (isSubmittingValidation = false) => {
    const comment = planningResponseComment.trim();
    if (!comment) {
      enqueueSnackbar('Por favor escribe un mensaje para el líder.', { variant: 'warning' });
      return;
    }
    setSendingChatMessage(true);
    try {
      const resp = await strategicPlanningService.sendChatMessage(detail.id, {
        message: comment,
        submitValidation: isSubmittingValidation,
        senderType: 'planning'
      });
      setPlanningResponseComment('');
      enqueueSnackbar(
        isSubmittingValidation
          ? 'Ajustes remitidos al Líder para firmas y notificados a su correo institucional.'
          : 'Mensaje enviado y notificado por correo institucional al Líder.',
        { variant: 'success' }
      );
      if (resp?.data?.actionPlan) {
        setDetail((prev) => ({ ...prev, ...resp.data.actionPlan }));
      } else {
        await load();
      }
      if (onChanged) onChanged();
      if (isSubmittingValidation) {
        setFeedbackChatModalOpen(false);
      }
    } catch (err) {
      enqueueSnackbar(err.response?.data?.message || err.message || 'Error al enviar mensaje.', { variant: 'error' });
    } finally {
      setSendingChatMessage(false);
    }
  };

  const handleClearFeedbackChat = async () => {
    if (!detail?.id) return;
    try {
      await strategicPlanningService.clearChatThread(detail.id);
      setDetail((prev) => {
        if (!prev) return prev;
        const meta = { ...(prev.metadata || {}) };
        meta.chat_thread = [];
        return { ...prev, metadata: meta };
      });
      enqueueSnackbar('Chat limpiado. Los mensajes han sido archivados en la trazabilidad.', { variant: 'info' });
      if (onChanged) onChanged();
    } catch (e) {
      console.warn('Error al limpiar chat:', e);
      enqueueSnackbar('No se pudo limpiar el chat.', { variant: 'error' });
    }
  };

  const handleCloseFeedbackChat = () => {
    setFeedbackChatModalOpen(false);
    if (typeof window !== 'undefined' && window.location.search.includes('openChat')) {
      try {
        const url = new URL(window.location.href);
        url.searchParams.delete('openChat');
        window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
      } catch (_) {}
    }
  };

  const handleOpenTimelineModal = () => {
    setTimelineForm({
      starts_on: stage1StartsOn,
      ends_on: stage1EndsOn,
      reason: ''
    });
    setTimelineModalOpen(true);
  };

  const handleAddDaysToTimeline = (days) => {
    const base = timelineForm.ends_on ? new Date(timelineForm.ends_on + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + days);
    setTimelineForm((prev) => ({ ...prev, ends_on: base.toISOString().slice(0, 10) }));
  };

  const handleSetEndOfMonth = () => {
    const now = timelineForm.ends_on ? new Date(timelineForm.ends_on + 'T00:00:00') : new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setTimelineForm((prev) => ({ ...prev, ends_on: endOfMonth.toISOString().slice(0, 10) }));
  };

  const handleSaveTimeline = async () => {
    if (!timelineForm.ends_on) return enqueueSnackbar('Indique la fecha límite de cierre.', { variant: 'warning' });
    setSavingTimeline(true);
    try {
      await strategicPlanningService.updateStage1Timeline(detail.id, timelineForm);
      enqueueSnackbar(`Plazo de formulación actualizado con éxito hasta el ${timelineForm.ends_on}.`, { variant: 'success' });
      setTimelineModalOpen(false);
      await load();
      if (onChanged) onChanged();
      window.dispatchEvent(new CustomEvent('plan_accion:updated'));
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || 'No fue posible actualizar el plazo.', { variant: 'error' });
    } finally {
      setSavingTimeline(false);
    }
  };

  const saveItem = async () => {
    if (!isPlanningAdmin && isStage1Expired) {
      return enqueueSnackbar(`El plazo de formulación de la Etapa 1 finalizó el ${stage1EndsOn}. Solicite una prórroga a Planeación y Efectividad.`, { variant: 'error' });
    }
    const primaryActivity = (item.activity || '').trim() ||
      String(item.custom_values?.[activityFields[0]?.key] || '').trim() ||
      String(Object.values(item.custom_values || {}).find((v) => String(v || '').trim()) || '').trim();

    if (!primaryActivity) return enqueueSnackbar('Escriba el nombre o descripción principal del registro.', { variant: 'warning' });
    const missingField = activityFields.find((field) => field.required && (Array.isArray(fieldValue(field)) ? !fieldValue(field).length : !String(fieldValue(field) || '').trim()));
    if (missingField) return enqueueSnackbar(`Complete el campo “${missingField.label}”.`, { variant: 'warning' });
    setSaving(true);
    try {
      const payloadCustomValues = { ...(item.custom_values || {}) };
      let coRespPayload = Array.isArray(item.co_responsibles) ? item.co_responsibles : parseCoResponsibles(item.co_responsibles);

      // Sincronizar automáticamente cualquier campo dinámico de responsable o corresponsable en cualquier PED
      activityFields.forEach((f) => {
        if (isResponsibleField(f)) {
          const val = fieldValue(f) || defaultResponsibleText;
          if (val) {
            payloadCustomValues[f.key] = val;
            if (['activity','indicator_type','starts_on','ends_on','indicator','target','responsible','responsable_de_ejecucion'].includes(f.key)) {
              payloadCustomValues[f.key] = val;
            }
          }
        }
        if (isStartDateField(f)) {
          const val = fieldValue(f) || defaultStartDate;
          if (val) {
            payloadCustomValues[f.key] = val;
          }
        }
        if (isEndDateField(f)) {
          const val = fieldValue(f) || defaultEndDate;
          if (val) {
            payloadCustomValues[f.key] = val;
          }
        }
        if (isCoResponsibleField(f)) {
          const val = (Array.isArray(item.co_responsibles) && item.co_responsibles.length)
            ? item.co_responsibles
            : parseCoResponsibles(item.custom_values?.[f.key]);
          if (val && val.length) {
            coRespPayload = val;
            payloadCustomValues[f.key] = val;
          }
        }
      });

      const payload = {
        code: editingItemId ? detail.items.find((row) => String(row.id) === String(editingItemId))?.code : `ACT-${String((detail.items?.length || 0) + 1).padStart(3, '0')}`,
        strategic_element_id: [...levels].reverse().map((level) => item.custom_values?.[structureKey(level.id)]).find(Boolean) || null,
        activity: primaryActivity, indicator_type: item.indicator_type, indicator: item.indicator,
        target: item.target,
        starts_on: item.starts_on || payloadCustomValues.starts_on || payloadCustomValues.fecha_inicio || defaultStartDate || null,
        ends_on: item.ends_on || payloadCustomValues.ends_on || payloadCustomValues.fecha_fin || defaultEndDate || null,
        co_responsibles: coRespPayload,
        custom_values: payloadCustomValues,
        justification: editingItemId ? 'Actualización desde el formulario dinámico' : null
      };

      // Si el campo directo de responsable existe en el schema, asignarlo en payload raíz
      activityFields.forEach((f) => {
        if (isResponsibleField(f) && (f.key === 'responsible' || f.key === 'responsable_de_ejecucion')) {
          payload[f.key] = payloadCustomValues[f.key] || defaultResponsibleText;
        }
      });

      if (editingItemId) await strategicPlanningService.updateItem(planId, editingItemId, payload);
      else await strategicPlanningService.addItem(planId, payload);
      const wasEditing = Boolean(editingItemId);
      setItem(getInitialItem()); setEditingItemId(null);
      enqueueSnackbar(wasEditing ? 'Actividad actualizada; la versión anterior quedó en el historial.' : 'Actividad agregada al plan.', { variant: 'success' });
      try {
        await load();
        onChanged?.();
      } catch (_) {
        enqueueSnackbar('La actividad quedó guardada. Pulse “Actualizar” para verla en la lista.', { variant: 'info' });
      }
    } catch (error) {
      const message = error.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado. Revise su conexión y pulse “Actualizar” antes de intentarlo nuevamente.'
        : error.response?.data?.message || error.message || 'No fue posible guardar la actividad.';
      enqueueSnackbar(message, { variant: 'error' });
    }
    finally { setSaving(false); }
  };

  const editItem = (row) => {
    setEditingItemId(row.id);
    const actField = activityFields.find(isActivityField);
    const initialActivity = row.activity || (actField && row.custom_values?.[actField.key]) || '';

    const coRespField = activityFields.find(isCoResponsibleField);
    const initialCoResp = (row.co_responsibles && row.co_responsibles.length > 0)
      ? row.co_responsibles
      : (coRespField && row.custom_values?.[coRespField.key]) || [];

    const respField = activityFields.find(isResponsibleField);
    const initialResp = (respField && row.custom_values?.[respField.key]) || row.responsible || row.responsable_de_ejecucion || defaultResponsibleText;

    const startField = activityFields.find(isStartDateField);
    const endField = activityFields.find(isEndDateField);
    const initialStartsOn = row.starts_on || (startField && row.custom_values?.[startField.key]) || '';
    const initialEndsOn = row.ends_on || (endField && row.custom_values?.[endField.key]) || '';

    setItem({
      macroactivity: '', activity: initialActivity, indicator_type: row.indicator_type || '',
      starts_on: initialStartsOn, ends_on: initialEndsOn, indicator: row.indicator || '',
      target: row.target || '', co_responsibles: parseCoResponsibles(initialCoResp), budget: '',
      custom_values: {
        ...(row.custom_values || {}),
        ...(actField ? { [actField.key]: initialActivity } : {}),
        ...(respField ? { [respField.key]: initialResp } : {}),
        ...(coRespField ? { [coRespField.key]: parseCoResponsibles(initialCoResp) } : {}),
        ...(startField ? { [startField.key]: initialStartsOn } : {}),
        ...(endField ? { [endField.key]: initialEndsOn } : {})
      }
    });
    setTimeout(() => document.getElementById('activity-capture-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleOpenRowMenu = (event, row) => {
    event.stopPropagation();
    setRowMenuAnchor(event.currentTarget);
    setActiveMenuRow(row);
  };

  const handleCloseRowMenu = () => {
    setRowMenuAnchor(null);
  };

  const handleOpenReplicateDialog = async (row) => {
    handleCloseRowMenu();
    setReplicateTargetItem(row);
    setSelectedTargetPlanIds([]);
    setReplicateSearch('');
    setReplicateAsMove(false);
    setReplicateModalOpen(true);
    setLoadingAvailablePlans(true);
    try {
      const termId = detail?.term_id || detail?.term?.id;
      const res = await strategicPlanningService.listActionPlans({ termId, year: detail?.term?.year });
      const rawList = res?.data || [];
      const filtered = rawList.filter((p) => String(p.id) !== String(detail?.id));
      setAvailablePlans(filtered);
    } catch (err) {
      console.error('Error fetching plans for replication:', err);
      enqueueSnackbar('No se pudieron cargar los demás planes de acción de la vigencia.', { variant: 'error' });
    } finally {
      setLoadingAvailablePlans(false);
    }
  };

  const handleToggleTargetPlan = (planId) => {
    setSelectedTargetPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  const handleSelectAllFilteredPlans = (plansToToggle) => {
    const idsToToggle = plansToToggle.map((p) => p.id);
    const allSelected = idsToToggle.every((id) => selectedTargetPlanIds.includes(id));
    if (allSelected) {
      setSelectedTargetPlanIds((prev) => prev.filter((id) => !idsToToggle.includes(id)));
    } else {
      setSelectedTargetPlanIds((prev) => Array.from(new Set([...prev, ...idsToToggle])));
    }
  };

  const handleExecuteReplicate = async () => {
    if (!replicateTargetItem || selectedTargetPlanIds.length === 0) {
      return enqueueSnackbar('Seleccione al menos un plan de acción destino.', { variant: 'warning' });
    }
    setReplicating(true);
    try {
      const res = await strategicPlanningService.replicateItem(detail.id, replicateTargetItem.id, {
        target_plan_ids: selectedTargetPlanIds,
        move: replicateAsMove,
        justification: replicateAsMove ? 'Traslado de actividad entre planes' : 'Replicación masiva de actividad institucional'
      });
      const data = res?.data || {};
      const count = data.replications?.length || selectedTargetPlanIds.length;
      enqueueSnackbar(
        replicateAsMove
          ? `Actividad trasladada exitosamente a ${count} plan(es) de acción y retirada del plan actual.`
          : `Actividad replicada exitosamente en ${count} plan(es) de acción con sus carpetas en Drive preparadas.`,
        { variant: 'success' }
      );
      setReplicateModalOpen(false);
      setReplicateTargetItem(null);
      setSelectedTargetPlanIds([]);
      await load();
      onChanged?.();
    } catch (err) {
      console.error('Error al replicar/trasladar actividad:', err);
      enqueueSnackbar(err.response?.data?.error || err.response?.data?.message || 'No fue posible completar la replicación de la actividad.', { variant: 'error' });
    } finally {
      setReplicating(false);
    }
  };

  const handlePromptDeleteItem = (row) => {
    handleCloseRowMenu();
    setDeleteItemCandidate(row);
  };

  const handleExecuteDeleteItem = async () => {
    if (!deleteItemCandidate) return;
    setDeletingItem(true);
    try {
      await strategicPlanningService.deleteItem(detail.id, deleteItemCandidate.id);
      enqueueSnackbar('Actividad eliminada correctamente.', { variant: 'success' });
      setDeleteItemCandidate(null);
      await load();
      onChanged?.();
    } catch (err) {
      console.error('Error al eliminar actividad:', err);
      enqueueSnackbar(err.response?.data?.error || err.response?.data?.message || 'No fue posible eliminar la actividad.', { variant: 'error' });
    } finally {
      setDeletingItem(false);
    }
  };

  const searchMeetingPeople = async (query, setOptions, setSearching) => {
    const value = String(query || '').trim();
    if (value.length < 2) {
      setOptions([]);
      return;
    }
    const pedId = detail?.term?.strategicPlan?.id || platformPlan?.id;
    if (!pedId) return;
    setSearching(true);
    try {
      const response = await strategicPlanningService.searchMeetingParticipants(pedId, value);
      setOptions(response?.data || []);
    } catch (_) {
      setOptions([]);
    } finally {
      setSearching(false);
    }
  };

  const lookupResponsible = async () => {
    const doc = responsibleDocument.trim();
    if (!doc) return enqueueSnackbar('Digite el nombre o la cédula que desea consultar.', { variant: 'warning' });
    const pedId = detail?.term?.strategicPlan?.id || platformPlan?.id;
    if (!pedId) return enqueueSnackbar('No fue posible identificar el PED.', { variant: 'error' });
    setSearchingResponsible(true);
    try {
      const response = await strategicPlanningService.lookupMeetingParticipant(pedId, doc);
      if (response?.data) {
        setResponsibleCandidate(response.data);
        return;
      }
    } catch (_) {
      try {
        const searchRes = await strategicPlanningService.searchMeetingParticipants(pedId, doc);
        const results = searchRes?.data || [];
        if (results.length === 1) {
          setResponsibleCandidate(results[0]);
          return;
        } else if (results.length > 1) {
          setResponsibleOptions(results);
          enqueueSnackbar(`Se encontraron ${results.length} coincidencias. Seleccione una persona de la lista.`, { variant: 'info' });
          return;
        }
      } catch (__) {}
      enqueueSnackbar('No se encontró el usuario en SIAC.', { variant: 'error' });
    } finally {
      setSearchingResponsible(false);
    }
  };

  const assignResponsibleCandidate = (isPrimary = true) => {
    if (!responsibleCandidate) return;
    if (!responsibleCandidate.email) {
      return enqueueSnackbar('El usuario no tiene correo institucional registrado.', { variant: 'warning' });
    }
    const role = isPrimary ? 'principal' : 'co_responsible';
    const nextList = meetingParticipants.filter((p) => {
      const pDoc = String(p.document || '').toLowerCase();
      const pEmail = String(p.email || '').toLowerCase();
      const candDoc = String(responsibleCandidate.document || '').toLowerCase();
      const candEmail = String(responsibleCandidate.email || '').toLowerCase();
      return !(pDoc && pDoc === candDoc) && !(pEmail && pEmail === candEmail);
    });

    const normalizedCurrent = isPrimary
      ? nextList.map((p) => ({ ...p, meeting_role: p.meeting_role === 'principal' ? 'co_responsible' : p.meeting_role }))
      : nextList;

    const next = [{
      id: undefined,
      user_id: responsibleCandidate.id || null,
      participant_type: 'internal',
      document: responsibleCandidate.document || '',
      name: responsibleCandidate.name || '',
      email: responsibleCandidate.email || '',
      organization: responsibleCandidate.dependency || responsibleCandidate.viceRectorate || responsibleCandidate.organization || 'UNICESMAG',
      role_title: responsibleCandidate.position || responsibleCandidate.role_title || '',
      meeting_role: role,
      signature_required: true,
      status: 'invited'
    }, ...normalizedCurrent];

    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      responsables: next.filter((p) => ['principal', 'co_responsible'].includes(p.meeting_role)).map((p) => p.name).join(', ') || previous.responsables,
      participantes: next.map((p) => ({ nombre: p.name, cargo: p.role_title, entidad: p.organization, rol_reunion: p.meeting_role, status: p.status }))
    }));
    setResponsibleCandidate(null);
    setResponsibleDocument('');
    setResponsibleOptions([]);
    enqueueSnackbar(isPrimary ? 'Responsable Principal asignado con éxito.' : 'Co-responsable agregado con éxito.', { variant: 'success' });
  };

  const lookupUnifiedParticipant = async (docOverride) => {
    const document = String(docOverride || unifiedDraft.document || '').trim();
    if (!document) return enqueueSnackbar('Digite el nombre o la cédula que desea consultar.', { variant: 'warning' });
    const pedId = detail?.term?.strategicPlan?.id || platformPlan?.id;
    if (!pedId) return enqueueSnackbar('No fue posible identificar el PED.', { variant: 'error' });
    setAttendeeSearching(true);
    try {
      const response = await strategicPlanningService.lookupMeetingParticipant(pedId, document);
      const data = response?.data;
      if (data) {
        setUnifiedDraft((old) => ({
          ...old,
          document: data.document || document,
          name: data.name || '',
          email: data.email || '',
          organization: data.dependency || data.viceRectorate || data.organization || 'UNICESMAG',
          role_title: data.position || data.role_title || '',
          user_id: data.id || null
        }));
        enqueueSnackbar('Usuario institucional encontrado en SIAC.', { variant: 'success' });
        return;
      }
    } catch (_) {
      // Fallback: Si no coincide exactamente por cédula, buscar por coincidencia de nombre/texto
      try {
        const searchRes = await strategicPlanningService.searchMeetingParticipants(pedId, document);
        const results = searchRes?.data || [];
        if (results.length === 1) {
          const item = results[0];
          setUnifiedDraft((old) => ({
            ...old,
            document: item.document || document,
            name: item.name || '',
            email: item.email || '',
            organization: item.dependency || item.viceRectorate || item.organization || 'UNICESMAG',
            role_title: item.position || item.role_title || '',
            user_id: item.id || null
          }));
          enqueueSnackbar('Usuario institucional encontrado en SIAC.', { variant: 'success' });
          return;
        } else if (results.length > 1) {
          setAttendeeOptions(results);
          enqueueSnackbar(`Se encontraron ${results.length} coincidencias. Seleccione una opción de la lista.`, { variant: 'info' });
          return;
        }
      } catch (__) {
        // Ignorar error de búsqueda amplia
      }
      setUnifiedDraft((old) => ({ ...old, document, user_id: null }));
      enqueueSnackbar('No se encontró en usuarios internos de SIAC. Puede completar los datos para agregarlo como participante externo.', { variant: 'info' });
    } finally {
      setAttendeeSearching(false);
    }
  };

  const addUnifiedParticipant = () => {
    const document = String(unifiedDraft.document || '').trim();
    const name = String(unifiedDraft.name || '').trim();
    const email = String(unifiedDraft.email || '').trim().toLowerCase();
    const organization = String(unifiedDraft.organization || '').trim() || 'UNICESMAG';
    const roleTitle = String(unifiedDraft.role_title || '').trim() || 'Participante';
    const role = unifiedDraft.meeting_role || 'participant';

    if (!name || !email) {
      return enqueueSnackbar('Complete al menos el nombre y correo para agregar al participante.', { variant: 'warning' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return enqueueSnackbar('Digite un correo válido para enviar la invitación de firma.', { variant: 'warning' });
    }
    if (meetingParticipants.some((p) => (email && String(p.email || '').toLowerCase() === email) || (document && p.document && String(p.document) === document))) {
      return enqueueSnackbar('Esta persona ya está agregada al acta.', { variant: 'info' });
    }

    const normalizedCurrent = role === 'principal'
      ? meetingParticipants.map((p) => ({ ...p, meeting_role: p.meeting_role === 'principal' ? 'co_responsible' : p.meeting_role }))
      : meetingParticipants;

    const next = [...normalizedCurrent, {
      id: undefined,
      user_id: unifiedDraft.user_id || null,
      participant_type: unifiedDraft.user_id ? 'internal' : 'external',
      document,
      name,
      email,
      organization,
      role_title: roleTitle,
      meeting_role: role,
      signature_required: true,
      status: 'invited'
    }];
    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      responsables: next.filter((p) => ['principal', 'co_responsible'].includes(p.meeting_role)).map((p) => p.name).join(', ') || previous.responsables,
      participantes: next.map((p) => ({ nombre: p.name, cargo: p.role_title, entidad: p.organization, rol_reunion: p.meeting_role, status: p.status }))
    }));
    setUnifiedDraft({ document: '', name: '', email: '', organization: '', role_title: '', meeting_role: 'participant', user_id: null });
    setAttendeeOptions([]);
    enqueueSnackbar('Participante agregado al acta.', { variant: 'success' });
  };

  const handleWhatIsNext = async () => {
    if (guideSnackbarKeyRef.current) closeSnackbar(guideSnackbarKeyRef.current);
    guideSnackbarKeyRef.current = null;

    const latestMin = latestMinute || [...(activeMeeting?.minuteVersions || [])].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
    const isFinalized = Boolean(activeMeeting?.status === 'formalized' || latestMin?.status === 'finalized');
    const isSigning = Boolean(latestMin?.status === 'signing');
    const requiredParticipants = meetingParticipants.filter((p) => p.signature_required !== false);
    const signedParticipants = requiredParticipants.filter((p) => p.status === 'signed');
    const pendingCount = Math.max(0, requiredParticipants.length - signedParticipants.length);
    const allSigned = requiredParticipants.length > 0 && pendingCount === 0;

    // 1. Si el acta del plan de acción ya fue formalizada:
    if (isFinalized) {
      if (meetingLayoutMode === 'form') setMeetingLayoutMode('split');
      window.setTimeout(() => {
        const target = window.document.getElementById('meeting-download-button');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          guideAnimationRef.current?.cancel?.();
          guideAnimationRef.current = target.animate?.([
            { boxShadow: '0 0 0 0 rgba(37,99,235,0)', transform: 'scale(1)' },
            { boxShadow: '0 0 0 10px rgba(37,99,235,0.45)', transform: 'scale(1.035)' },
            { boxShadow: '0 0 0 0 rgba(37,99,235,0)', transform: 'scale(1)' }
          ], { duration: 1800, iterations: 6, easing: 'ease-in-out' });
          target.focus?.();
        }
        guideSnackbarKeyRef.current = enqueueSnackbar('¡Acta formalizada con éxito! Puede descargar el PDF oficial con firmas. Siguiente paso: continúe con las pestañas "Actividades y metas" o "Exportación institucional".', {
          variant: 'success',
          autoHideDuration: 9000
        });
      }, 150);
      return;
    }

    // 2. Si todos los participantes ya firmaron:
    if (allSigned) {
      if (meetingLayoutMode === 'form') setMeetingLayoutMode('split');
      window.setTimeout(() => {
        const target = window.document.getElementById('meeting-send-final-button');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          guideAnimationRef.current?.cancel?.();
          guideAnimationRef.current = target.animate?.([
            { boxShadow: '0 0 0 0 rgba(22,163,74,0)', transform: 'scale(1)' },
            { boxShadow: '0 0 0 12px rgba(22,163,74,0.48)', transform: 'scale(1.04)' },
            { boxShadow: '0 0 0 0 rgba(22,163,74,0)', transform: 'scale(1)' }
          ], { duration: 1800, iterations: 6, easing: 'ease-in-out' });
          target.focus?.();
        }
        guideSnackbarKeyRef.current = enqueueSnackbar('Siguiente paso: Todos los participantes han firmado. En la parte superior de la vista previa, haga clic en "Enviar acta firmada" para formalizar y sincronizar con Google Drive.', {
          variant: 'success',
          autoHideDuration: 9000
        });
      }, 150);
      return;
    }

    // 3. Si el acta está en proceso de firmas (pendiente de firmas):
    if (isSigning) {
      if (meetingLayoutMode === 'form') setMeetingLayoutMode('split');
      window.setTimeout(() => {
        const target = window.document.getElementById('meeting-refresh-signatures-button') || window.document.getElementById('meeting-resend-pending-button');
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          guideAnimationRef.current?.cancel?.();
          guideAnimationRef.current = target.animate?.([
            { boxShadow: '0 0 0 0 rgba(245,158,11,0)', transform: 'scale(1)' },
            { boxShadow: '0 0 0 10px rgba(245,158,11,0.45)', transform: 'scale(1.035)' },
            { boxShadow: '0 0 0 0 rgba(245,158,11,0)', transform: 'scale(1)' }
          ], { duration: 1800, iterations: 6, easing: 'ease-in-out' });
          target.focus?.();
        }
        guideSnackbarKeyRef.current = enqueueSnackbar(`Siguiente paso: Firmas en proceso (${pendingCount} pendiente${pendingCount === 1 ? '' : 's'}). Puede hacer clic en "Actualizar firmas" o usar "Reenviar solo a pendientes".`, {
          variant: 'info',
          autoHideDuration: 8500
        });
      }, 150);
      return;
    }

    // 4. Si el acta está en borrador:
    // Autocompletar datos deducibles faltantes
    let updates = {};
    let autocompletedAny = false;

    if (!meeting.title?.trim()) {
      updates.title = `Concertación del Plan de Acción ${detail?.term?.year || new Date().getFullYear()}`.trim();
      autocompletedAny = true;
    }
    if (!meeting.starts_at) {
      updates.starts_at = toDatetimeLocal(new Date(), 8);
      autocompletedAny = true;
    }
    if (!meeting.ends_at) {
      updates.ends_at = toDatetimeLocal(new Date(), 10);
      autocompletedAny = true;
    }
    if (!meeting.location?.trim()) {
      updates.location = locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG';
      autocompletedAny = true;
    }
    if (!meeting.modality) {
      updates.modality = 'Presencial';
      autocompletedAny = true;
    }
    if (!richTextPlain(meeting.development)) {
      updates.development = 'Se consolidó el Plan de Acción revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales de la vigencia.';
      autocompletedAny = true;
    }
    if (!richTextPlain(meeting.conclusions)) {
      updates.conclusions = 'Se aprueban las metas concertadas del Plan de Acción y se habilita el acta institucional para firmas electrónicas.';
      autocompletedAny = true;
    }

    const currentMerged = { ...meeting, ...updates };
    if (autocompletedAny) {
      setMeeting(currentMerged);
    }

    const hasPrincipal = meetingParticipants.some((p) => p.meeting_role === 'principal');
    const hasEnoughParticipants = meetingParticipants.length >= 2;

    const errors = {
      responsables: !hasPrincipal,
      title: !currentMerged.title?.trim(),
      starts_at: !currentMerged.starts_at,
      objective: !richTextPlain(currentMerged.objective),
      participants: !hasEnoughParticipants
    };

    setMeetingFieldErrors(errors);

    const missingOrder = [
      { key: 'responsables', target: 'strategic-responsible-search-field', label: 'Responsable Principal de la reunión' },
      { key: 'title', target: 'strategic-meeting-title-field', label: 'Título corto del acta' },
      { key: 'starts_at', target: 'strategic-meeting-starts-field', label: 'Fecha y hora de inicio' },
      { key: 'objective', target: 'strategic-plan-minute-objective', label: 'Objetivo de la reunión' },
      { key: 'participants', target: 'strategic-meeting-participants-section', label: 'Participantes convocados (mínimo 2 personas)' }
    ];

    const firstMissing = missingOrder.find(({ key }) => errors[key]);

    if (firstMissing) {
      if (meetingLayoutMode === 'preview') setMeetingLayoutMode('split');
      window.setTimeout(() => {
        const target = window.document.getElementById(firstMissing.target);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
          guideAnimationRef.current?.cancel?.();
          guideAnimationRef.current = target.animate?.([
            { boxShadow: '0 0 0 0 rgba(220,38,38,0)', transform: 'scale(1)' },
            { boxShadow: '0 0 0 10px rgba(220,38,38,0.4)', transform: 'scale(1.025)' },
            { boxShadow: '0 0 0 0 rgba(220,38,38,0)', transform: 'scale(1)' }
          ], { duration: 1800, iterations: 5, easing: 'ease-in-out' });

          const focusable = target.matches?.('input,textarea,[contenteditable="true"]')
            ? target
            : target.querySelector?.('input,textarea,[contenteditable="true"],button');
          focusable?.focus?.();
        }
        guideSnackbarKeyRef.current = enqueueSnackbar(
          autocompletedAny
            ? `Se autocompletaron datos sugeridos. Por favor complete en rojo: ${firstMissing.label}.`
            : `Siguiente paso: Por favor complete el campo señalado en rojo: ${firstMissing.label}.`,
          { variant: 'warning', autoHideDuration: 8500 }
        );
      }, 180);
      return;
    }

    // 5. Todos los campos obligatorios están completos:
    setMeetingFieldErrors({});

    // Si aún no se ha guardado en el servidor, guardarlo automáticamente
    if (!activeMeeting?.id) {
      await saveMeeting(true);
    }

    if (meetingLayoutMode === 'form') setMeetingLayoutMode('split');
    window.setTimeout(() => {
      const target = window.document.getElementById('meeting-publish-button');
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        guideAnimationRef.current?.cancel?.();
        guideAnimationRef.current = target.animate?.([
          { boxShadow: '0 0 0 0 rgba(37,99,235,0)', transform: 'scale(1)' },
          { boxShadow: '0 0 0 12px rgba(37,99,235,0.48)', transform: 'scale(1.04)' },
          { boxShadow: '0 0 0 0 rgba(37,99,235,0)', transform: 'scale(1)' }
        ], { duration: 1800, iterations: 6, easing: 'ease-in-out' });
        target.focus?.();
      }
      guideSnackbarKeyRef.current = enqueueSnackbar(
        'Siguiente paso: El acta está completa. En la parte superior de la vista previa, haga clic en "Habilitar y enviar invitaciones" para iniciar la firma electrónica.',
        { variant: 'success', autoHideDuration: 9000 }
      );
    }, 180);
  };
  const updateMeetingParticipantRole = (index, meetingRole) => {
    const participant = meetingParticipants[index];
    if (participant?.status === 'signed') return enqueueSnackbar('No puede cambiar el rol de una persona que ya firmó.', { variant: 'warning' });
    const next = meetingParticipants.map((entry, current) => ({
      ...entry,
      meeting_role: current === index
        ? meetingRole
        : (meetingRole === 'principal' && entry.meeting_role === 'principal' ? 'co_responsible' : entry.meeting_role)
    }));
    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      responsables: next.filter((entry) => ['principal', 'co_responsible'].includes(entry.meeting_role)).map((entry) => entry.name).join(', ') || previous.responsables,
      participantes: next.map((entry) => ({ nombre: entry.name, cargo: entry.role_title, rol_reunion: entry.meeting_role, status: entry.status }))
    }));
  };
  const removeMeetingParticipant = (index) => {
    const participant = meetingParticipants[index];
    if (participant?.status === 'signed') return enqueueSnackbar('No puede retirar a una persona que ya firmó esta acta.', { variant: 'warning' });
    const next = meetingParticipants.filter((_, current) => current !== index);
    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      responsables: next.filter((p) => ['principal', 'co_responsible'].includes(p.meeting_role)).map((p) => p.name).join(', ') || previous.responsables,
      participantes: next.map((p) => ({ nombre: p.name, cargo: p.role_title, rol_reunion: p.meeting_role, status: p.status }))
    }));
  };
  const improveMeetingText = async (field) => {
    const currentText = richTextPlain(meeting[field]);
    if (!currentText) return enqueueSnackbar('Escriba primero el texto que desea mejorar.', { variant: 'warning' });
    setImprovingMeetingField(field);
    try {
      const response = await strategicPlanningService.improveMinuteText(planId, {
        field,
        text: currentText,
        context: {
          objective: meeting.objective,
          development: meeting.development,
          conclusions: meeting.conclusions
        }
      });
      const improvedText = String(response.data?.improved_text || '').trim();
      if (!improvedText) throw new Error('OpenAI no devolvió un texto válido.');
      setMeeting((previous) => ({ ...previous, [field]: improvedText }));
      enqueueSnackbar('Redacción mejorada. Revísela antes de guardar.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || error.message || 'No fue posible mejorar la redacción.', { variant: 'error' });
    } finally {
      setImprovingMeetingField('');
    }
  };
  const generateMinuteSummary = async () => {
    if (!detail?.items?.length) return enqueueSnackbar('Primero registre al menos una actividad en el Plan de Acción.', { variant: 'warning' });
    setGeneratingMinuteSummary(true);
    try {
      const firstItem = detail.items[0] || {};
      const targetObjective = detail.items.length === 1
        ? `Concertación y revisión de la actividad: ${firstItem.activity || ''}`.trim()
        : `Concertación y concertación del Plan de Acción Institucional (${detail.items.length} actividades) para la vigencia ${detail.term?.year || ''}.`.trim();

      const response = await strategicPlanningService.generateMinuteSummary(planId, {
        objective: targetObjective,
        audio_file_name: audioFile?.name || null
      });
      const objective = String(response.data?.objective || targetObjective).trim();
      const development = String(response.data?.development || '').trim();
      const conclusions = String(response.data?.conclusions || '').trim();
      if (!development || !conclusions) throw new Error('No se recibió un resumen completo.');
      setMeeting((previous) => ({ ...previous, objective, development, conclusions }));
      enqueueSnackbar(`Acta actualizada desde ${response.data?.activities_analyzed || detail.items.length} actividades${audioFile ? ` y soporte de audio (${audioFile.name})` : ''}. Revísela antes de guardar.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || error.message || 'No fue posible generar el resumen del acta.', { variant: 'error' });
    } finally {
      setGeneratingMinuteSummary(false);
    }
  };
  const startNewMeeting = () => {
    isApplyingLoadRef.current = true;
    lastLoadedMeetingKeyRef.current = `${detail?.id || planId}-__new__`;
    const firstItem = detail?.items?.[0] || {};
    setSelectedMeetingId('__new__');
    setMeeting({
      ...emptyMeeting,
      title: `Concertación del Plan de Acción ${detail?.term?.year || ''}`.trim(),
      starts_at: toDatetimeLocal(firstItem.starts_on, 8),
      ends_at: toDatetimeLocal(firstItem.ends_on, 10),
      location: locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
      objective: firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.',
      development: '', conclusions: ''
    });

    const initialParticipants = [];
    const peUser = detail?.planningEfectividadUser;
    const planResp = detail?.planResponsibleUser || detail?.currentResponsibility?.responsibleUser || detail?.owner;

    if (peUser) {
      initialParticipants.push({
        user_id: peUser.id || null,
        document: peUser.username || peUser.document || '',
        name: peUser.nombre || peUser.name || '',
        email: peUser.email || '',
        organization: peUser.dependencia || 'Dirección de Planeación y Aseguramiento de la Calidad',
        role_title: peUser.cargo || 'Planeación y Efectividad',
        meeting_role: 'principal',
        signature_required: true,
        status: 'invited'
      });
    }

    if (planResp && (!peUser || String(planResp.id) !== String(peUser.id))) {
      initialParticipants.push({
        user_id: planResp.id || null,
        document: planResp.document || planResp.username || '',
        name: planResp.nombre || planResp.name || '',
        email: planResp.email || '',
        organization: planResp.dependencia || detail?.organizationalUnit?.name || 'UNICESMAG',
        role_title: planResp.cargo || 'Responsable del Plan de Acción',
        meeting_role: 'co_responsible',
        signature_required: true,
        status: 'invited'
      });
    }
    setMeetingParticipants(initialParticipants);
    setResponsibleCandidate(null);
    setResponsibleDocument('');
    setResponsibleOptions([]);
    setUnifiedDraft({ document: '', name: '', email: '', organization: '', role_title: '', meeting_role: 'participant', user_id: null });
    setAttendeeOptions([]);
    setPublished(null);
    hasUnsavedChangesRef.current = false;
    setSaveStatus('saved');
    window.setTimeout(() => {
      isApplyingLoadRef.current = false;
    }, 400);
    enqueueSnackbar('Nueva acta preparada con el Responsable del Plan y Planeación y Efectividad cargados.', { variant: 'info' });
  };
  const saveMeeting = async (silent = false) => {
    if (!meeting.title?.trim() || !meeting.starts_at || !richTextPlain(meeting.objective)) {
      if (!silent) enqueueSnackbar('Título, fecha y objetivo son obligatorios.', { variant: 'warning' });
      return false;
    }
    if (!meetingParticipants.length) {
      if (!silent) enqueueSnackbar('Agregue al menos un participante a la agenda.', { variant: 'warning' });
      return false;
    }
    if (!meetingParticipants.some((participant) => participant.meeting_role === 'principal')) {
      if (!silent) enqueueSnackbar('Seleccione un Responsable principal para el acta.', { variant: 'warning' });
      return false;
    }
    if (!silent) setSaving(true);
    setSaveStatus('saving');
    try {
      const payload = {
        ...meeting,
        type: 'formulation',
        participants: meetingParticipants,
        commitments: richTextPlain(meeting.conclusions) ? [meeting.conclusions] : []
      };
      const activeMeetingId = selectedMeetingId !== '__new__' ? activeMeeting?.id : null;
      const savedMeeting = activeMeetingId
        ? await strategicPlanningService.updateMeeting(activeMeetingId, payload)
        : await strategicPlanningService.createMeeting(planId, payload);
      
      const newlyCreatedId = !activeMeetingId && savedMeeting?.data?.id ? String(savedMeeting.data.id) : null;
      if (newlyCreatedId) {
        lastLoadedMeetingKeyRef.current = `${detail?.id || planId}-${newlyCreatedId}`;
        setSelectedMeetingId(newlyCreatedId);
      }
      hasUnsavedChangesRef.current = false;
      setSaveStatus('saved');

      // Actualizar silenciosamente en segundo plano: NUNCA activa spinner a pantalla completa
      await load(false);

      const signaturesReset = Boolean(savedMeeting?.data?.signatures_reset);
      if (!silent) {
        if (signaturesReset) {
          enqueueSnackbar('Acta modificada. El documento sufrió ajustes y se reactivó el proceso de firmas para todos los participantes.', { variant: 'info' });
        } else {
          enqueueSnackbar(activeMeetingId ? 'Reunión y roles actualizados.' : 'Reunión y participantes registrados.', { variant: 'success' });
        }
      }
      if (latestMinute?.id && (activeMeeting?.status === 'formalized' || latestMinute?.status === 'finalized' || latestMinute?.drive_file_id)) {
        handleFinalizeMinute(true);
      }
      return { success: true, signatures_reset: signaturesReset, minute_id: savedMeeting?.data?.minute_id || latestMinute?.id };
    } catch (error) {
      setSaveStatus('error');
      if (!silent) {
        enqueueSnackbar(error.response?.data?.message || 'No fue posible programar la reunión.', { variant: 'error' });
      }
      return false;
    }
    finally {
      if (!silent) setSaving(false);
    }
  };

  // Seguimiento de cambios y autoguardado de reunión / acta
  useEffect(() => {
    if (isApplyingLoadRef.current) return;
    hasUnsavedChangesRef.current = true;
    setSaveStatus((prev) => (prev === 'saving' ? prev : 'pending'));
  }, [meeting, meetingParticipants]);

  useEffect(() => {
    if (!open || tab !== 'meeting' || !hasUnsavedChangesRef.current || isApplyingLoadRef.current) return undefined;
    if (!meeting.title?.trim() || !meeting.starts_at || !richTextPlain(meeting.objective)) return undefined;
    if (!meetingParticipants.length || !meetingParticipants.some((p) => p.meeting_role === 'principal')) return undefined;

    const timer = window.setTimeout(() => {
      saveMeeting(true);
    }, 1200);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meeting, meetingParticipants, open, tab]);
  // eslint-disable-next-line no-unused-vars
  const generateMinute = async (meetingId) => {
    try {
      await strategicPlanningService.createMinute(meetingId, { content: {
        ...actaData,
        objetivo: Array.isArray(actaData.objetivo) ? actaData.objetivo : [actaData.objetivo || ''],
        desarrollo: Array.isArray(actaData.desarrollo) ? actaData.desarrollo : [actaData.desarrollo || ''],
        conclusiones: Array.isArray(actaData.conclusiones) ? actaData.conclusiones : [actaData.conclusiones || ''],
        participants: meetingParticipants
      } });
      await load(); enqueueSnackbar('Borrador institucional COM-IF-FR-002 generado.', { variant: 'success' });
    }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible generar el acta.', { variant: 'error' }); }
  };
  const publishMinute = async (minuteId, options = {}) => {
    try {
      const current = activeMeeting?.minuteVersions?.find((version) => String(version.id) === String(minuteId));
      const isRevision = Boolean(options.is_revision || current?.content?.metadata?.was_adjusted);
      const response = await strategicPlanningService.publishMinute(minuteId, {
        regenerate: options.regenerate ?? (current?.status === 'signing' || isRevision),
        is_revision: isRevision,
        only_pending: options.only_pending ?? false,
        public_base_url: window.location.origin
      });
      setPublished(response.data);
      await load();
      const summary = response.data?.invitation_summary;
      if (summary?.failed) {
        enqueueSnackbar(`Acta ${isRevision ? 'actualizada' : 'habilitada'}. Se enviaron ${summary.sent} de ${summary.total} invitaciones; revise los correos pendientes.`, { variant: 'warning' });
      } else {
        enqueueSnackbar(isRevision
          ? `Acta modificada. Se reactivó el proceso de firmas y se enviaron ${summary?.sent || 0} invitaciones informando de los cambios.`
          : (summary
            ? `Acta habilitada y ${summary.sent} invitación(es) enviada(s) para firma.`
            : 'Acta congelada y firmas habilitadas.'), { variant: 'success' });
      }
    }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible publicar el acta.', { variant: 'error' }); }
  };
  const enableQrSigning = async (onlyPending = false) => {
    if (!activeMeeting) return enqueueSnackbar('Primero guarde la reunión y sus participantes.', { variant: 'warning' });
    try {
      const versions = [...(activeMeeting.minuteVersions || [])].sort((a, b) => Number(b.version) - Number(a.version));
      let minuteVersion = versions.find((version) => ['draft', 'review', 'signing'].includes(version.status));
      if (!minuteVersion) {
        const created = await strategicPlanningService.createMinute(activeMeeting.id, { content: {
          ...actaData,
          objetivo: Array.isArray(actaData.objetivo) ? actaData.objetivo : [actaData.objetivo || ''],
          desarrollo: Array.isArray(actaData.desarrollo) ? actaData.desarrollo : [actaData.desarrollo || ''],
          conclusiones: Array.isArray(actaData.conclusiones) ? actaData.conclusiones : [actaData.conclusiones || ''],
          participants: meetingParticipants
        } });
        minuteVersion = created.data;
      }
      await publishMinute(minuteVersion.id, { only_pending: onlyPending });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar la firma por QR.', { variant: 'error' }); }
  };

  const handlePreviewEvidence = async (ev) => {
    if (!ev || !ev.id) return;
    const name = ev.original_name || 'documento';
    const ext = name.split('.').pop().toLowerCase();
    const isPdf = ext === 'pdf';
    const isImage = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext);
    const isOffice = ['xls', 'xlsx', 'csv', 'doc', 'docx', 'ppt', 'pptx'].includes(ext);

    setPreviewModal({
      open: true,
      url: '',
      fileName: name,
      isPdf,
      isImage,
      isOffice,
      loading: true
    });

    try {
      const blob = await strategicPlanningService.downloadEvidence(ev.id, true);
      const mimeType = isPdf ? 'application/pdf' : (isImage ? `image/${ext}` : 'application/octet-stream');
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      setPreviewModal((prev) => ({ ...prev, url: blobUrl, loading: false }));
    } catch (err) {
      console.error('Error previsualizando evidencia:', err);
      enqueueSnackbar('No fue posible cargar la vista previa del documento.', { variant: 'error' });
      setPreviewModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const handleClosePreview = () => {
    if (previewModal.url) {
      URL.revokeObjectURL(previewModal.url);
    }
    setPreviewModal({ open: false, url: '', fileName: '', isPdf: false, isImage: false, isOffice: false, loading: false });
  };

  const handleDownloadDirectEvidence = async (ev) => {
    try {
      enqueueSnackbar('Descargando archivo...', { variant: 'info' });
      const blob = await strategicPlanningService.downloadEvidence(ev.id, false);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ev.original_name || 'evidencia';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error al descargar evidencia:', err);
      enqueueSnackbar('No fue posible descargar el archivo.', { variant: 'error' });
    }
  };

  const handleOpenDriveUrl = (url) => {
    if (!url) return;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenActivityFolder = async (item) => {
    if (!item) return;
    const directUrl = (item.evidence || []).find((e) => e.drive_folder_url)?.drive_folder_url
      || ((item.evidence || []).find((e) => e.drive_folder_id) ? `https://drive.google.com/drive/folders/${item.evidence.find((e) => e.drive_folder_id).drive_folder_id}` : null);
    
    if (directUrl) {
      window.open(directUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      enqueueSnackbar('Localizando carpeta en Google Drive...', { variant: 'info' });
      const res = await strategicPlanningService.getActionItemDriveFolder(item.id);
      if (res?.folderUrl) {
        window.open(res.folderUrl, '_blank', 'noopener,noreferrer');
      } else {
        enqueueSnackbar('La carpeta de la actividad en Drive se habilitará al sincronizar el primer soporte.', { variant: 'warning' });
      }
    } catch (e) {
      console.error('Error al obtener carpeta de Drive:', e);
      enqueueSnackbar('No fue posible abrir la carpeta en Google Drive.', { variant: 'error' });
    }
  };

  const handleOpenMinutesFolder = async () => {
    if (!detail?.id) return;
    const directFolderUrl = detail.metadata?.drive_minutes_folder_url
      || detail.metadata?.minutes_drive_folder_url
      || (detail.meetings || []).find((m) => (m.minuteVersions || []).some((v) => v.content?.drive_folder_url))?.minuteVersions?.find((v) => v.content?.drive_folder_url)?.content?.drive_folder_url;
    if (directFolderUrl) {
      window.open(directFolderUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      enqueueSnackbar('Localizando carpeta ACTAS DE REUNIÓN en Google Drive...', { variant: 'info' });
      const res = await strategicPlanningService.getActionPlanMinutesDriveFolder(detail.id);
      const url = res?.folderUrl || res?.data?.folderUrl;
      if (url) {
        window.open(url, '_blank', 'noopener,noreferrer');
      } else {
        enqueueSnackbar('La carpeta de Actas en Drive se habilitará al formalizar la primera acta.', { variant: 'warning' });
      }
    } catch (e) {
      console.error('Error al obtener carpeta de actas en Drive:', e);
      enqueueSnackbar('No fue posible abrir la carpeta de actas en Google Drive.', { variant: 'error' });
    }
  };

  const handlePreviewMinute = async (minuteId, title = 'Acta Oficial COM-IF-FR-002') => {
    if (!minuteId) return;
    const cleanTitle = (title || 'Acta').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `${cleanTitle}_${detail?.code || 'Plan'}.pdf`;

    setPreviewModal({
      open: true,
      url: '',
      fileName,
      isPdf: true,
      isImage: false,
      isOffice: false,
      loading: true
    });

    try {
      const blob = await strategicPlanningService.downloadMinutePdf(minuteId, 'original');
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
      setPreviewModal((prev) => ({ ...prev, url: blobUrl, loading: false }));
    } catch (err) {
      console.error('Error al previsualizar acta:', err);
      enqueueSnackbar('No se pudo cargar la vista previa del acta.', { variant: 'error' });
      setPreviewModal((prev) => ({ ...prev, open: false, loading: false }));
    }
  };

  const planActas = useMemo(() => {
    if (!detail) return [];
    const list = [];
    const meetings = detail.meetings || [];

    meetings.forEach((m) => {
      const versions = m.minuteVersions || [];
      if (versions.length > 0) {
        const sortedVersions = [...versions].sort((a, b) => Number(b.version || 0) - Number(a.version || 0));
        const v = sortedVersions[0];
        const driveFileId = v.drive_file_id || v.content?.drive_file_id || null;
        const driveUrl = v.drive_url || v.content?.drive_file_url || (driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null);
        const driveFolderId = v.content?.drive_folder_id || null;
        const driveFolderUrl = v.content?.drive_folder_url || (driveFolderId ? `https://drive.google.com/drive/folders/${driveFolderId}` : null);

        list.push({
          id: v.id,
          minuteId: v.id,
          meetingId: m.id,
          meetingTitle: m.title || 'Reunión de Concertación / Seguimiento',
          meetingType: m.meeting_type || 'concertation',
          meetingDate: m.starts_at || m.meeting_date || m.created_at,
          version: v.version || 1,
          status: v.status || 'draft',
          finalizedAt: v.finalized_at || v.created_at,
          driveFileId,
          driveUrl,
          driveFolderUrl,
          signaturesCount: (v.signatures || []).length
        });
      } else if (m.status || m.title) {
        list.push({
          id: `m_${m.id}`,
          minuteId: null,
          meetingId: m.id,
          meetingTitle: m.title || 'Reunión de Concertación',
          meetingType: m.meeting_type || 'concertation',
          meetingDate: m.starts_at || m.created_at,
          version: 1,
          status: m.status || 'draft',
          finalizedAt: m.created_at,
          driveFileId: null,
          driveUrl: null,
          driveFolderUrl: null,
          signaturesCount: 0
        });
      }
    });

    if (list.length === 0 && detail.latest_minute_id) {
      const driveFileId = detail.drive_file_id || null;
      list.push({
        id: detail.latest_minute_id,
        minuteId: detail.latest_minute_id,
        meetingId: null,
        meetingTitle: 'Acta Oficial COM-IF-FR-002',
        meetingType: 'concertation',
        meetingDate: detail.created_at,
        version: 1,
        status: detail.latest_minute_status || 'finalized',
        finalizedAt: detail.updated_at,
        driveFileId,
        driveUrl: driveFileId ? `https://drive.google.com/file/d/${driveFileId}/view` : null,
        driveFolderUrl: null,
        signaturesCount: 1
      });
    }

    return list.sort((a, b) => new Date(b.finalizedAt || b.meetingDate || 0) - new Date(a.finalizedAt || a.meetingDate || 0));
  }, [detail]);

  const filteredActas = useMemo(() => {
    if (!minuteSearch.trim()) return planActas;
    const term = minuteSearch.toLowerCase().trim();
    return planActas.filter((a) =>
      (a.meetingTitle || '').toLowerCase().includes(term) ||
      (a.meetingType || '').toLowerCase().includes(term) ||
      (a.status || '').toLowerCase().includes(term) ||
      (a.version?.toString() || '').includes(term)
    );
  }, [planActas, minuteSearch]);

  const handleOpenEvidenceModal = (it) => {
    setEvidenceItem(it);
    setEvidenceModalOpen(true);
  };

  const handleOpenEvalModal = (it) => {
    setEvaluatingItem(it);
    const applicablePeriods = periods.filter((p) => isPeriodApplicableToItem(it, p));
    const targetPeriod = (applicablePeriods.length > 0 ? applicablePeriods[0] : null) || periods[0];
    const targetPeriodId = targetPeriod ? targetPeriod.id : (defaultPeriodId || '');
    const existingResult = (it.monitoringResults || []).find((r) => r.monitoring_period_id === targetPeriodId);
    setEvalForm({
      period_id: targetPeriodId,
      physical_progress: existingResult ? (existingResult.physical_progress ?? '') : '',
      observations: existingResult ? (existingResult.observations ?? '') : ''
    });
    setEvalModalOpen(true);
  };

  const handleChangeEvalPeriod = (newPeriodId) => {
    const existingResult = (evaluatingItem?.monitoringResults || []).find((r) => r.monitoring_period_id === newPeriodId);
    setEvalForm((prev) => ({
      ...prev,
      period_id: newPeriodId,
      physical_progress: existingResult ? (existingResult.physical_progress ?? '') : '',
      observations: existingResult ? (existingResult.observations ?? '') : ''
    }));
  };

  const handleSaveEvaluation = async () => {
    if (!evaluatingItem || !evalForm.period_id) {
      return enqueueSnackbar('Seleccione el periodo de seguimiento.', { variant: 'warning' });
    }
    if (evalForm.physical_progress === '' || evalForm.physical_progress === null || isNaN(Number(evalForm.physical_progress)) || Number(evalForm.physical_progress) < 0) {
      return enqueueSnackbar('Ingrese un porcentaje de avance válido (mínimo 0%).', { variant: 'warning' });
    }
    const prog = Math.max(0, Number(evalForm.physical_progress));
    setSaving(true);
    try {
      await strategicPlanningService.saveMonitoring(evaluatingItem.id, evalForm.period_id, {
        physical_progress: prog,
        observations: evalForm.observations || '',
        status: 'submitted'
      });
      // Cierra la ventana emergente de valoración y actualiza silenciosamente sin cerrar el plan
      setEvalModalOpen(false);
      await load(false);
      setTab('workflow');
      if (prog > 100) {
        enqueueSnackbar(`Valoración guardada: Sobrecumplimiento del ${prog}%. Queda marcado para revisión de meta.`, { variant: 'info' });
      } else {
        enqueueSnackbar('Valoración de seguimiento guardada con éxito.', { variant: 'success' });
      }
    } catch (error) {
      console.error('Error guardando valoración:', error);
      enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar la valoración.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const transition = async (action, customComment = null) => {
    if (action === 'submit_owner_validation' && customComment === null) {
      setPlanningResponseComment('Se realizaron los ajustes solicitados en las actividades y acta conforme a sus observaciones.');
      setSubmitValidationModalOpen(true);
      return;
    }
    try {
      await strategicPlanningService.transition(planId, {
        action,
        comment: customComment !== null ? customComment : `Acción ejecutada desde el formulario: ${ACTION_LABELS[action] || action}`
      });
      await load();
      onChanged?.();
      enqueueSnackbar('Estado actualizado.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'La transición no fue permitida.', { variant: 'error' });
    }
  };

  const handleConfirmSubmitValidation = async () => {
    const comment = planningResponseComment.trim();
    if (!comment) {
      enqueueSnackbar('Por favor ingrese el detalle o resumen de los ajustes realizados en el plan y acta.', { variant: 'warning' });
      return;
    }
    setSubmittingValidation(true);
    try {
      await transition('submit_owner_validation', comment);
      setSubmitValidationModalOpen(false);
      setPlanningResponseComment('');
    } finally {
      setSubmittingValidation(false);
    }
  };
  const exportPlan = async () => {
    try { const blob = await strategicPlanningService.exportActionPlan(planId); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `DIR-PE-FR-003_${detail.code}_${detail.term?.year}.xlsx`; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible exportar el formato.', { variant: 'error' }); }
  };
  const handleSyncDriveExcel = async () => {
    if (!planId) return;
    setSyncingDriveExcel(true);
    try {
      const resp = await strategicPlanningService.syncDriveExcel(planId);
      enqueueSnackbar(resp?.message || 'Plan de Acción Oficial DIR-PE-FR-003 sincronizado con Drive.', { variant: 'success' });
      await load(false);
    } catch (err) {
      console.error('Error sincronizando con Drive:', err);
      enqueueSnackbar(err.response?.data?.message || err.message || 'No fue posible sincronizar con Google Drive.', { variant: 'error' });
    } finally {
      setSyncingDriveExcel(false);
    }
  };
  const downloadDynamicTemplate = async () => {
    try {
      const blob = await strategicPlanningService.downloadDynamicItemTemplate(planId); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `PLANTILLA_DINAMICA_${detail.code}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
      enqueueSnackbar('Plantilla creada con los campos actuales de este PED.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible generar la plantilla dinámica.', { variant: 'error' }); }
  };
  const previewDynamicImport = async (file) => {
    if (!file) return;
    const body = new FormData();
    body.append('file', file);
    try {
      enqueueSnackbar('Procesando plantilla de actividades...', { variant: 'info' });
      const response = await strategicPlanningService.previewDynamicItems(planId, body);
      const preview = response.data;
      if (preview && (!preview.errors || preview.errors.length === 0)) {
        await strategicPlanningService.confirmDynamicItems(preview.id);
        setDynamicImportPreview(null);
        await load();
        onChanged?.();
        enqueueSnackbar(`¡Carga masiva exitosa! Se guardaron ${preview.rows?.length || 0} actividades en el Plan de Acción.`, { variant: 'success' });
      } else {
        setDynamicImportPreview(preview);
        enqueueSnackbar(`La plantilla contiene ${preview.errors?.length || 0} observaciones. Revíselas en pantalla.`, { variant: 'warning' });
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible procesar la plantilla.', { variant: 'error' });
    }
  };
  const confirmDynamicImport = async () => {
    try {
      await strategicPlanningService.confirmDynamicItems(dynamicImportPreview.id);
      setDynamicImportPreview(null);
      await load();
      onChanged?.();
      enqueueSnackbar('Registros creados o actualizados desde Excel.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible confirmar la carga.', { variant: 'error' });
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      sx={{
        '& .MuiButton-containedPrimary': {
          background: 'linear-gradient(135deg,#2563eb,#5546e8)', boxShadow: '0 6px 16px rgba(55,84,210,.20)',
          '&:hover': { background: 'linear-gradient(135deg,#1f56d2,#4939d3)', boxShadow: '0 8px 19px rgba(55,84,210,.25)' }
        },
        '& .MuiButton-outlinedPrimary': {
          color: '#315fc1', borderColor: '#b7c8ee', bgcolor: 'rgba(255,255,255,.82)',
          '&:hover': { borderColor: '#7898df', bgcolor: '#f1f5ff' }
        },
        '& .MuiInputLabel-root.Mui-focused': { color: '#5e8fc9' },
        '& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#86add9' }
      }}
    >
      <DialogTitle sx={{ p: 0, borderBottom: '1px solid #e5e7f2' }}>
        <Box sx={{
          position: 'relative', overflow: 'hidden', px: { xs: 2.25, sm: 3, md: 4 }, py: { xs: 2, md: 2.5 },
          background: 'linear-gradient(115deg, #204698 0%, #2563eb 58%, #593cf0 100%)', color: '#ffffff'
        }}>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            justifyContent="space-between"
            alignItems={{ md: 'center' }}
            gap={2}
            sx={{ pr: { xs: 10, sm: 13 } }}
          >
            <Box>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5} flexWrap="wrap" useFlexGap>
                <Box sx={{ width: 9, height: 34, borderRadius: 4, bgcolor: '#cddcff', boxShadow: '0 3px 9px rgba(15,40,100,.24)', flexShrink: 0 }} />
                <Typography variant="h5" fontWeight={950} sx={{ color: '#ffffff', letterSpacing: '-0.02em', fontSize: { xs: 19, sm: 22 } }}>
                  {detail?.title || 'Formulario del Plan de Acción'}
                </Typography>
                <Chip
                  size="small"
                  label={STATUS_LABELS[detail?.status] || detail?.status || 'Cargando'}
                  sx={{ bgcolor: 'rgba(255,255,255,.16)', color: '#ffffff', border: '1px solid rgba(255,255,255,.38)', fontWeight: 850 }}
                />
              </Stack>
              {detail && (
                <Typography variant="body2" sx={{ color: '#dbeafe', fontWeight: 500, pl: { xs: 0, sm: 3 } }}>
                  Código: <strong style={{ color: '#ffffff' }}>{detail.code}</strong> · Dependencia: <strong style={{ color: '#ffffff' }}>{detail.organizationalUnit?.name}</strong> · Vigencia: <strong style={{ color: '#ffffff' }}>{detail.term?.year}</strong>
                </Typography>
              )}
            </Box>
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ position: 'relative', zIndex: 1 }} flexWrap="wrap">
              {detail && ['owner_validation', 'formulation', 'technical_review'].includes(detail.status) && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => transition('activate')}
                  sx={{
                    fontWeight: 800,
                    fontSize: 12.5,
                    textTransform: 'none',
                    borderRadius: 2,
                    bgcolor: '#10b981',
                    color: '#ffffff',
                    boxShadow: '0 4px 12px rgba(16,185,129,.35)',
                    '&:hover': { bgcolor: '#059669' }
                  }}
                >
                  Ejecutar Plan de Acción
                </Button>
              )}
              {detail && detail.status === 'active' && (
                <Chip
                  icon={<CheckCircle sx={{ color: '#ffffff !important' }} />}
                  label="Plan en Ejecución Oficial"
                  sx={{ bgcolor: '#059669', color: '#ffffff', fontWeight: 800, fontSize: 12, px: 1 }}
                />
              )}
            </Stack>
          </Stack>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            sx={{
              position: 'absolute',
              top: { xs: 12, sm: 16 },
              right: { xs: 12, sm: 18 },
              zIndex: 10
            }}
          >
            <Tooltip title="Actualizar">
              <IconButton
                aria-label="actualizar"
                onClick={load}
                sx={{
                  color: '#ffffff',
                  bgcolor: 'rgba(255,255,255,.16)',
                  border: '1px solid rgba(255,255,255,.38)',
                  borderRadius: 2,
                  p: 0.85,
                  boxShadow: '0 4px 12px rgba(15,23,42,.18)',
                  '&:hover': {
                    color: '#ffffff',
                    bgcolor: 'rgba(255,255,255,.28)',
                    borderColor: '#ffffff',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.15s ease'
                }}
              >
                <Refresh sx={{ fontSize: 21 }} />
              </IconButton>
            </Tooltip>
            <Tooltip title="Cerrar">
              <IconButton
                aria-label="cerrar"
                onClick={onClose}
                sx={{
                  color: '#ffffff',
                  bgcolor: 'rgba(255,255,255,.18)',
                  border: '1px solid rgba(255,255,255,.40)',
                  borderRadius: 2,
                  p: 0.85,
                  boxShadow: '0 4px 12px rgba(15,23,42,.18)',
                  '&:hover': {
                    color: '#ffffff',
                    bgcolor: 'rgba(255,255,255,.28)',
                    borderColor: '#ffffff',
                    transform: 'scale(1.05)'
                  },
                  transition: 'all 0.15s ease'
                }}
              >
                <Close sx={{ fontSize: 22 }} />
              </IconButton>
            </Tooltip>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5, md: 3.5 }, pb: { xs: 2.5, sm: 3 }, bgcolor: '#f7f8fc' }}>
        {loading ? (
          <Stack alignItems="center" py={10}><CircularProgress /></Stack>
        ) : !detail ? (
          <Paper variant="outlined" sx={{ maxWidth: 760, mx: 'auto', mt: 6, p: { xs: 2.5, md: 4 }, borderRadius: 3.5, borderColor: '#fecaca', bgcolor: '#ffffff' }}>
            <Alert
              severity="error"
              action={<Button color="inherit" onClick={load} sx={{ fontWeight: 850, textTransform: 'none' }}>Reintentar</Button>}
              sx={{ borderRadius: 2.5 }}
            >
              <Typography fontWeight={900}>No fue posible abrir el Plan de Acción</Typography>
              <Typography variant="body2">{loadError || 'Revise la conexión con el servidor e intente nuevamente.'}</Typography>
            </Alert>
          </Paper>
        ) : (
          <Stack gap={2.5} sx={{ width: '100%', maxWidth: 1800, mx: 'auto' }}>
            <Paper variant="outlined" sx={{ borderRadius: 3, p: 1, bgcolor: '#eef3f8', borderColor: '#d9e3ed', boxShadow: '0 5px 20px rgba(90,97,135,.05)' }}>
              <Tabs
                value={tab}
                onChange={(_, value) => setTab(value)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  minHeight: 66,
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTabs-flexContainer': { alignItems: 'stretch', gap: 1 },
                  '& .MuiTabs-scrollButtons': { width: 34, color: '#6d8db2' },
                  '& .MuiTab-root': {
                    textTransform: 'none',
                    minHeight: 64,
                    minWidth: { xs: 245, md: 250 },
                    flex: { md: '1 1 0' },
                    maxWidth: 'none',
                    borderRadius: 2,
                    border: '1px solid #d3deea',
                    bgcolor: '#ffffff',
                    px: 1.5,
                    py: 1,
                    position: 'relative',
                    overflow: 'hidden',
                    transition: 'transform .18s ease, border-color .18s ease, box-shadow .18s ease',
                    '&:hover': { bgcolor: '#ffffff', borderColor: '#8faede', boxShadow: '0 4px 11px rgba(64,91,128,.10)', transform: 'translateY(-1px)' },
                    '&.Mui-selected': {
                      background: 'linear-gradient(135deg,#2b66d9,#5144df)',
                      borderColor: '#315bd1',
                      boxShadow: '0 6px 15px rgba(50,72,190,.22)',
                      '&:hover': { background: 'linear-gradient(135deg,#245ac7,#4739cd)' },
                      '& .step-number': { bgcolor: 'rgba(255,255,255,.20)', color: '#ffffff', border: '1px solid rgba(255,255,255,.32)' },
                      '& .step-caption': { color: '#dbeafe' },
                      '& .step-title': { color: '#ffffff' },
                      '& .step-count': { bgcolor: 'rgba(255,255,255,.18)', color: '#ffffff' }
                    }
                  }
                }}
              >
                <Tab value="activities" label={<WorkflowStepLabel number="1" title="Plan y actividades" count={detail.items?.length || 0} />} />
                <Tab value="meeting" label={<WorkflowStepLabel number="2" title="Concertación y acta" count={detail.meetings?.length || 0} />} />
                <Tab value="export" label={<WorkflowStepLabel number="3" title="Exportación institucional" />} />
                <Tab value="workflow" label={<WorkflowStepLabel number="4" title="Flujo y seguimientos S1/S2" />} />
              </Tabs>
            </Paper>

            {/* TAB 1: PLAN Y ACTIVIDADES */}
            {tab === 'activities' && (
              <>
                {/* TARJETA DE VIGENCIA Y PLAZO DE FORMULACIÓN (ETAPA 1) */}
                <Paper
                  variant="outlined"
                  sx={{
                    borderRadius: 3.5,
                    p: { xs: 1.5, sm: 2 },
                    borderColor: isStage1Extended ? '#93c5fd' : isStage1Expired ? '#fed7aa' : '#bbf7d0',
                    bgcolor: isStage1Extended ? '#f0f9ff' : isStage1Expired ? '#fffbeb' : '#f0fdf4',
                    boxShadow: '0 4px 15px rgba(0,0,0,.03)'
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={1.5}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <Box
                        sx={{
                          width: 42,
                          height: 42,
                          borderRadius: 2.5,
                          bgcolor: isStage1Extended ? '#e0f2fe' : isStage1Expired ? '#fef3c7' : '#dcfce7',
                          color: isStage1Extended ? '#0284c7' : isStage1Expired ? '#d97706' : '#16a34a',
                          display: 'grid',
                          placeItems: 'center',
                          flexShrink: 0
                        }}
                      >
                        {isStage1Extended ? <AccessTime /> : isStage1Expired ? <LockOutlined /> : <CalendarMonth />}
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 14.5 }}>
                            Plazo de Formulación (Etapa 1: Plan y actividades)
                          </Typography>
                          {isStage1Extended && (
                            <Chip size="small" icon={<AccessTime sx={{ fontSize: '13px !important', color: '#0369a1 !important' }} />} label={`Prórroga Activa hasta ${stage1EndsOn}`} sx={{ bgcolor: '#e0f2fe', color: '#0369a1', fontWeight: 800, fontSize: 11, pl: 0.5 }} />
                          )}
                          {!isStage1Extended && isStage1Open && (
                            <Chip size="small" icon={<CheckCircleOutline sx={{ fontSize: '13px !important', color: '#15803d !important' }} />} label={`Formulación Abierta · Vence ${stage1EndsOn}${daysRemainingStage1 !== null ? ` (${daysRemainingStage1} días restantes)` : ''}`} sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11, pl: 0.5 }} />
                          )}
                          {isStage1Expired && (
                            <Chip size="small" icon={<LockOutlined sx={{ fontSize: '13px !important', color: '#b45309 !important' }} />} label={`Plazo Vencido (${stage1EndsOn})`} sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11, pl: 0.5 }} />
                          )}
                          {isStage1NotStarted && (
                            <Chip size="small" icon={<AccessTime sx={{ fontSize: '13px !important', color: '#475569 !important' }} />} label={`Inicia el ${stage1StartsOn}`} sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 800, fontSize: 11, pl: 0.5 }} />
                          )}
                        </Stack>
                        <Typography variant="caption" color="#475569" sx={{ display: 'block', mt: 0.25, fontSize: 12 }}>
                          Ventana de tiempo para registrar actividades: <strong>{stage1StartsOn || '01/01'}</strong> hasta <strong>{stage1EndsOn || 'Por definir'}</strong>.
                          {stage1Extensions.length > 0 && ` (${stage1Extensions.length} ${stage1Extensions.length === 1 ? 'prórroga concedida' : 'prórrogas concedidas'})`}
                        </Typography>
                      </Box>
                    </Stack>

                    {isPlanningAdmin && (
                      <Button
                        variant="contained"
                        size="small"
                        startIcon={<MoreTime sx={{ fontSize: 18 }} />}
                        onClick={handleOpenTimelineModal}
                        sx={{
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: 13,
                          borderRadius: 2.5,
                          px: 2,
                          py: 0.7,
                          bgcolor: '#1e40af',
                          '&:hover': { bgcolor: '#1d4ed8' },
                          flexShrink: 0
                        }}
                      >
                        Gestionar tiempo
                      </Button>
                    )}
                  </Stack>

                  {!isPlanningAdmin && isStage1Expired && (
                    <Alert severity="warning" icon={<LockOutlined />} sx={{ mt: 1.5, borderRadius: 2, fontWeight: 700, fontSize: 12.5 }}>
                      El plazo de formulación de actividades de la Etapa 1 finalizó el {stage1EndsOn}. Si requiere registrar actividades adicionales o solicitar ajustes, comuníquese con la Dirección de Planeación y Aseguramiento de la Calidad para habilitar una prórroga.
                    </Alert>
                  )}
                </Paper>

                <Paper id="activity-capture-form" variant="outlined" sx={{ borderRadius: 4, p: { xs: 1.75, sm: 2.25, md: 2.5 }, bgcolor: '#ffffff', borderColor: editingItemId ? '#8eb5dc' : '#e2e4ee', boxShadow: '0 10px 30px rgba(75,83,125,.065)', scrollMarginTop: 20 }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" mb={2}>
                    <Box sx={{ width: 34, height: 34, borderRadius: 2.5, bgcolor: '#e6f1ff', color: '#5688c7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: 14 }}>
                      1
                    </Box>
                    <Typography variant="h6" fontWeight={900} color="#303a53" sx={{ fontSize: 17, lineHeight: 1.2 }}>{editingItemId ? 'Editar actividad' : 'Registrar una actividad'}</Typography>
                  </Stack>
                  <Box sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(3, minmax(0, 1fr))', xl: 'repeat(4, minmax(0, 1fr))' },
                    alignItems: 'start',
                    gap: { xs: 1.35, md: 1.6 }
                  }}>
                    {activityFields.map(renderConfiguredField)}
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" mt={2.25}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      disabled={saving || (!isPlanningAdmin && isStage1Expired)}
                      onClick={saveItem}
                      sx={{
                        minWidth: 240,
                        height: 42,
                        borderRadius: 2.5,
                        textTransform: 'none',
                        fontWeight: 950,
                        fontSize: 15,
                        background: 'linear-gradient(135deg,#2563eb,#5546e8)',
                        boxShadow: '0 6px 16px rgba(55,84,210,.22)',
                        '&:hover': { background: 'linear-gradient(135deg,#1f56d2,#4939d3)' }
                      }}
                    >
                      {saving ? 'Guardando registro…' : editingItemId ? 'Guardar cambios' : 'Crear actividad'}
                    </Button>
                    {editingItemId && <Button variant="text" onClick={() => { setEditingItemId(null); setItem(getInitialItem()); }} sx={{ ml: { sm: 1 }, mt: { xs: 1, sm: 0 }, textTransform: 'none', fontWeight: 850 }}>Cancelar edición</Button>}
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 4, background: 'linear-gradient(135deg,#f7fbf9,#f7f6ff)', borderColor: '#e0e7e5', boxShadow: '0 4px 16px rgba(75,83,125,.035)' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                    <Box>
                      <Typography fontWeight={900} color="#303a53" sx={{ fontSize: 15 }}>Carga masiva mediante Excel</Typography>
                      <Typography variant="body2" color="#64748b">Descargue la plantilla configurada con los campos de este PED, diligencie los datos y vuelva a subirla.</Typography>
                    </Box>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button variant="outlined" startIcon={<Download />} onClick={downloadDynamicTemplate} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800, borderColor: '#cbd5e1', color: '#334155' }}>
                        Descargar plantilla dinámica
                      </Button>
                      <Button component="label" variant="contained" startIcon={<CloudUpload />} sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800, bgcolor: '#7386a8', '&:hover': { bgcolor: '#657897' }, boxShadow: 'none' }}>
                        Subir plantilla diligenciada
                        <input hidden type="file" accept=".xlsx" onChange={(e) => { previewDynamicImport(e.target.files?.[0]); e.target.value = ''; }} />
                      </Button>
                    </Stack>
                  </Stack>
                </Paper>

                {dynamicImportPreview && (
                  <Alert severity={(dynamicImportPreview.errors || []).length ? 'warning' : 'success'} action={!(dynamicImportPreview.errors || []).length ? <Button color="inherit" size="small" onClick={confirmDynamicImport}>Confirmar carga</Button> : undefined}>
                    <strong>{(dynamicImportPreview.rows || []).length} filas detectadas.</strong> {(dynamicImportPreview.errors || []).length ? `${dynamicImportPreview.errors.length} errores: ${(dynamicImportPreview.errors || []).slice(0, 3).map((error) => `Fila ${error.row}, ${error.field}: ${error.message}`).join(' · ')}` : 'La validación terminó correctamente. Los datos todavía no han sido modificados.'}
                  </Alert>
                )}

                <Paper variant="outlined" sx={{ borderRadius: 3.5, overflow: 'hidden', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <Box sx={{ px: 3, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center">
                      <Typography variant="h6" fontWeight={900} color="#0f172a" sx={{ fontSize: 16 }}>
                        Actividades Registradas ({detail.items?.length || 0})
                      </Typography>
                      <Chip label={`DIR-PE-FR-003 · Vigencia ${detail.term?.year}`} size="small" sx={{ fontWeight: 800, bgcolor: '#e2e8f0', color: '#334155' }} />
                    </Stack>
                  </Box>
                  <TableContainer sx={{ maxWidth: '100%', overflowX: 'auto', maxHeight: '55vh' }}>
                    <Table stickyHeader size="small" sx={{ minWidth: Math.max(850, (recordColumns.length + 2) * 180) }}>
                      <TableHead>
                        <TableRow>
                          <TableCell sx={{ position: 'sticky', left: 0, bgcolor: '#f1f5f9', zIndex: 3, fontWeight: 900, color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}>
                            Código
                          </TableCell>
                          {recordColumns.map((field) => (
                            <TableCell key={field.key} sx={{ bgcolor: '#f1f5f9', fontWeight: 900, color: '#1e293b', borderBottom: '2px solid #cbd5e1', whiteSpace: 'nowrap' }}>
                              {field.label}
                            </TableCell>
                          ))}
                          <TableCell align="center" sx={{ position: 'sticky', right: 0, bgcolor: '#f1f5f9', zIndex: 3, fontWeight: 900, color: '#1e293b', borderBottom: '2px solid #cbd5e1', width: 72 }}>Acción</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {(!detail.items || detail.items.length === 0) ? (
                          <TableRow>
                            <TableCell colSpan={recordColumns.length + 2} align="center" sx={{ py: 6 }}>
                              <Typography color="#94a3b8" fontWeight={600}>No se han registrado actividades para este Plan de Acción todavía.</Typography>
                            </TableCell>
                          </TableRow>
                        ) : (
                          detail.items.slice(itemsPage * itemsRowsPerPage, itemsPage * itemsRowsPerPage + itemsRowsPerPage).map((row) => (
                            <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'inherit', fontWeight: 900, color: '#5688c7', zIndex: 1 }}>
                                {row.code}
                              </TableCell>
                              {recordColumns.map((field) => (
                                <TableCell key={field.key} sx={{ maxWidth: 320, whiteSpace: 'normal', fontSize: 13, color: '#334155' }}>
                                  {recordValue(row, field)}
                                </TableCell>
                              ))}
                              <TableCell align="center" sx={{ position: 'sticky', right: 0, bgcolor: 'inherit', width: 72 }}>
                                <Tooltip title="Opciones de la actividad (Editar, Trasladar, Replicar, Eliminar)">
                                  <IconButton
                                    size="small"
                                    onClick={(e) => handleOpenRowMenu(e, row)}
                                    sx={{
                                      bgcolor: '#f1f5f9',
                                      color: '#1e293b',
                                      border: '1px solid #cbd5e1',
                                      borderRadius: 2,
                                      p: 0.75,
                                      transition: 'all 0.15s ease',
                                      '&:hover': { bgcolor: '#e2e8f0', color: '#0f172a', borderColor: '#94a3b8' }
                                    }}
                                  >
                                    <MoreVert fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={detail.items?.length || 0}
                    page={itemsPage}
                    onPageChange={(_, newPage) => setItemsPage(newPage)}
                    rowsPerPage={itemsRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setItemsRowsPerPage(parseInt(e.target.value, 10));
                      setItemsPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    labelRowsPerPage="Filas por página:"
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`}
                    sx={{
                      borderTop: '1px solid #e2e8f0',
                      bgcolor: '#ffffff',
                      '.MuiTablePagination-toolbar': { minHeight: 48, px: 2 },
                      '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: 12.5, fontWeight: 700, color: '#475569' }
                    }}
                  />
                </Paper>
              </>
            )}

            {/* TAB 2: CONCERTACIÓN Y ACTA IA (COM-IF-FR-002 PREVIEW) */}
            {tab === 'meeting' && (
              <Stack spacing={2}>
                <Paper
                  elevation={0}
                  sx={{
                    px: { xs: 2, md: 2.5 }, py: 1.5, borderRadius: 3,
                    color: '#ffffff',
                    background: 'linear-gradient(105deg, #214c96 0%, #2e6be6 58%, #5840ee 100%)'
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'stretch', md: 'center' }} justifyContent="space-between" gap={1.5}>
                    <Box>
                      <Typography fontWeight={900} sx={{ fontSize: { xs: 18, md: 20 }, lineHeight: 1.2 }}>
                        Acta del Plan de Acción
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontSize: 12.5, color: 'rgba(255,255,255,.86)' }}>
                        Concertación institucional y firmas · {detail?.code || ''}
                      </Typography>
                    </Box>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={meetingLayoutMode}
                      onChange={(_, value) => value && setMeetingLayoutMode(value)}
                      aria-label="Modo de visualización del acta"
                      sx={{
                        alignSelf: { xs: 'stretch', md: 'center' },
                        bgcolor: 'rgba(255,255,255,.13)',
                        borderRadius: 2,
                        width: { xs: '100%', sm: 'auto' },
                        '& .MuiToggleButton-root': {
                          flex: { xs: 1, md: 'initial' },
                          color: '#ffffff',
                          borderColor: 'rgba(255,255,255,.35)',
                          px: { xs: 1, sm: 1.7 },
                          py: 0.75,
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: { xs: 12, sm: 13 }
                        },
                        '& .MuiToggleButton-root.Mui-selected': { color: '#17458c', bgcolor: '#ffffff', '&:hover': { bgcolor: '#ffffff' } }
                      }}
                    >
                      <ToggleButton value="form" aria-label="Ver formulario"><EditNote fontSize="small" sx={{ mr: 0.7 }} />Formulario</ToggleButton>
                      <ToggleButton value="split" aria-label="Ver formulario y vista previa"><ViewSidebar fontSize="small" sx={{ mr: 0.7 }} />Dividido</ToggleButton>
                      <ToggleButton value="preview" aria-label="Ver vista previa"><Visibility fontSize="small" sx={{ mr: 0.7 }} />Vista previa</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                </Paper>

                <Box sx={{
                  display: 'flex',
                  flexDirection: { xs: 'column', lg: meetingLayoutMode === 'split' ? 'row' : 'column' },
                  gap: 2.5,
                  alignItems: 'stretch',
                  width: '100%',
                  height: { lg: 'calc(100vh - 195px)' },
                  maxHeight: { lg: 'calc(100vh - 190px)' }
                }}>
                <Box sx={{
                  width: meetingLayoutMode === 'form' ? '100%' : meetingLayoutMode === 'split' ? { xs: '100%', lg: '47%' } : '100%',
                  display: meetingLayoutMode === 'preview' ? 'none' : 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  height: { lg: '100%' },
                  overflowY: { lg: 'auto' },
                  pr: { lg: 1.5 },
                  pb: { xs: 4, lg: 6 }
                }}>
                  <Paper variant="outlined" sx={{ p: 2.25, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#cbd9e9' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1.5} mb={1.5}>
                      <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 15.5 }}>Actas de reunión</Typography>
                      <Button variant="outlined" startIcon={<Add />} onClick={startNewMeeting} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>
                        Nueva acta
                      </Button>
                    </Stack>
                    <TextField
                      select fullWidth size="small" label="Abrir un acta guardada"
                      value={selectedMeetingId === '__new__' ? '__new__' : (activeMeeting?.id || '')}
                      onChange={(event) => { setSelectedMeetingId(event.target.value); setPublished(null); }}
                    >
                      {selectedMeetingId === '__new__' && <MenuItem value="__new__">Nueva acta sin guardar</MenuItem>}
                      {(detail?.meetings || []).map((entry, index) => (
                        <MenuItem key={entry.id} value={String(entry.id)}>
                          {entry.title || `Acta de concertación ${index + 1}`} · {entry.starts_at ? new Date(entry.starts_at).toLocaleDateString('es-CO') : 'Sin fecha'} · {entry.status === 'draft' ? 'Borrador' : entry.status}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#cbd9e9' }}>
                    <Box mb={2}>
                      <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 16 }}>1. Información de la reunión</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
                      {/* BÚSQUEDA DEL RESPONSABLE PRINCIPAL AL INICIO */}
                      <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} sx={{ gridColumn: '1 / -1' }}>
                        <Autocomplete
                          freeSolo
                          fullWidth
                          size="small"
                          options={responsibleOptions}
                          loading={searchingResponsible}
                          filterOptions={(options) => options}
                          getOptionLabel={(option) => typeof option === 'string'
                            ? option
                            : `${option.name || ''} · CC ${option.document || ''}`}
                          inputValue={responsibleDocument}
                          onInputChange={(_, value, reason) => {
                            if (!['input', 'clear'].includes(reason)) return;
                            setResponsibleDocument(value);
                            setResponsibleCandidate(null);
                            if (reason === 'clear') {
                              setResponsibleOptions([]);
                            } else if (value.trim().length >= 2) {
                              searchMeetingPeople(value, setResponsibleOptions, setSearchingResponsible);
                            }
                          }}
                          onChange={(_, option) => {
                            if (option && typeof option !== 'string') {
                              setResponsibleCandidate(option);
                              setResponsibleDocument(`${option.name || ''} · CC ${option.document || ''}`);
                              setResponsibleOptions([]);
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              id="strategic-responsible-search-field"
                              error={Boolean(meetingFieldErrors.responsables)}
                              label={!meetingParticipants.some((p) => p.meeting_role === 'principal')
                                ? 'Nombre o cédula del Responsable Principal *'
                                : 'Nombre o cédula del responsable'}
                              placeholder="Escriba al menos 2 caracteres"
                              helperText={meetingFieldErrors.responsables
                                ? 'Es obligatorio asignar un Responsable Principal para el acta.'
                                : 'Busque por nombre, apellido o cédula y seleccione una persona de la lista.'}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  lookupResponsible();
                                }
                              }}
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {searchingResponsible ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                )
                              }}
                            />
                          )}
                        />
                        <Button
                          variant="outlined"
                          startIcon={searchingResponsible ? <CircularProgress size={16} /> : <PersonSearch />}
                          disabled={searchingResponsible || responsibleDocument.trim().length < 2 || Boolean(responsibleCandidate)}
                          onClick={lookupResponsible}
                          sx={{ minWidth: 140, height: 40, textTransform: 'none', fontWeight: 800, whiteSpace: 'nowrap' }}
                        >
                          Buscar persona
                        </Button>
                      </Stack>

                      {responsibleCandidate && (
                        <Paper
                          variant="outlined"
                          sx={{
                            gridColumn: '1 / -1',
                            p: 1.5,
                            borderRadius: 2.5,
                            bgcolor: '#f8fbff',
                            border: '1.5px solid #93c5fd',
                            boxShadow: '0 2px 8px rgba(37, 99, 235, 0.08)'
                          }}
                        >
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
                            <Box>
                              <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                                <Typography fontWeight={900} fontSize={15}>{responsibleCandidate.name}</Typography>
                                <Chip size="small" label={`CC: ${responsibleCandidate.document}`} variant="outlined" sx={{ fontWeight: 700 }} />
                              </Stack>
                              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                {[responsibleCandidate.position || responsibleCandidate.role_title, responsibleCandidate.dependency || responsibleCandidate.organization].filter(Boolean).join(' · ')}
                              </Typography>
                              {responsibleCandidate.email && (
                                <Typography variant="caption" color="text.secondary">{responsibleCandidate.email}</Typography>
                              )}
                            </Box>
                            <Stack direction="row" gap={1} flexWrap="wrap">
                              {!meetingParticipants.some((p) => p.meeting_role === 'principal') ? (
                                <Button
                                  variant="contained"
                                  color="primary"
                                  onClick={() => assignResponsibleCandidate(true)}
                                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                                >
                                  Asignar como Responsable Principal
                                </Button>
                              ) : (
                                <>
                                  <Button
                                    variant="contained"
                                    color="primary"
                                    onClick={() => assignResponsibleCandidate(false)}
                                    sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                                  >
                                    + Agregar Co-responsable
                                  </Button>
                                  <Button
                                    variant="outlined"
                                    color="primary"
                                    onClick={() => assignResponsibleCandidate(true)}
                                    sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
                                  >
                                    Cambiar Principal
                                  </Button>
                                </>
                              )}
                            </Stack>
                          </Stack>
                        </Paper>
                      )}

                      {/* RESPONSABLES DE LA REUNIÓN (SOLO ESTE VA AL INICIO) */}
                      <Box id="strategic-responsible-section" sx={{
                        gridColumn: '1 / -1',
                        mb: 1,
                        p: meetingFieldErrors.responsables ? 1.5 : 0,
                        borderRadius: 3,
                        border: meetingFieldErrors.responsables ? '2px solid #dc2626' : 'none',
                        bgcolor: meetingFieldErrors.responsables ? '#fef2f2' : 'transparent',
                        boxShadow: meetingFieldErrors.responsables ? '0 0 0 4px rgba(220,38,38,0.15)' : 'none'
                      }}>
                        <Typography variant="subtitle2" fontWeight={900} color={meetingFieldErrors.responsables ? '#dc2626' : '#1e293b'} mb={0.75} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          Responsables de la reunión ({meetingParticipants.filter((p) => ['principal', 'co_responsible'].includes(p.meeting_role)).length}):
                        </Typography>
                        {!meetingParticipants.some((p) => ['principal', 'co_responsible'].includes(p.meeting_role)) ? (
                          <Alert severity="info" sx={{ borderRadius: 2 }}>
                            Busque por nombre o cédula para asignar al <strong>Responsable Principal</strong> de la reunión.
                          </Alert>
                        ) : (
                          <Stack gap={1.75}>
                            {meetingParticipants
                              .map((participant, index) => ({ participant, index }))
                              .filter(({ participant }) => ['principal', 'co_responsible'].includes(participant.meeting_role))
                              .map(({ participant, index }) => {
                                const isPrimary = participant.meeting_role === 'principal';
                                return (
                                  <Paper
                                    key={participant.id || participant.user_id || `${participant.document || participant.email}-${index}`}
                                    variant="outlined"
                                    sx={{
                                      p: 2.25,
                                      borderRadius: 3,
                                      bgcolor: isPrimary ? '#f0fdf4' : '#ffffff',
                                      borderColor: isPrimary ? '#86efac' : '#cbd5e1',
                                      boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                                      display: 'flex',
                                      flexDirection: { xs: 'column', md: 'row' },
                                      alignItems: { xs: 'stretch', md: 'center' },
                                      justifyContent: 'space-between',
                                      gap: 1.5
                                    }}
                                  >
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                      <Typography variant="body2" fontWeight={900} color="#0f172a" sx={{ fontSize: 14 }}>
                                        {participant.name}
                                      </Typography>
                                      <Box sx={{ mt: 0.5, mb: 0.5 }}>
                                        <Chip
                                          size="small"
                                          label={isPrimary ? 'Responsable principal' : 'Co-responsable'}
                                          color={isPrimary ? 'success' : 'primary'}
                                          sx={{ fontWeight: 850, height: 22, fontSize: 11 }}
                                        />
                                      </Box>
                                      <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.25 }}>
                                        CC {participant.document || 'registrada'} · {participant.email}
                                      </Typography>
                                      <Typography variant="caption" color="#475569" sx={{ display: 'block', fontWeight: 600 }}>
                                        {participant.role_title || 'Sin cargo'} · {participant.organization || 'UNICESMAG'}
                                      </Typography>
                                    </Box>

                                    <Stack
                                      direction={{ xs: 'column', sm: 'row' }}
                                      alignItems={{ xs: 'stretch', sm: 'center' }}
                                      spacing={1.25}
                                      flexWrap="wrap"
                                      justifyContent={{ xs: 'stretch', md: 'flex-end' }}
                                      sx={{ width: { xs: '100%', md: 'auto' } }}
                                    >
                                      <TextField
                                        select
                                        size="small"
                                        label="Rol"
                                        value={participant.meeting_role || 'principal'}
                                        disabled={participant.status === 'signed'}
                                        onChange={(event) => updateMeetingParticipantRole(index, event.target.value)}
                                        sx={{ minWidth: { xs: '100%', sm: 160 } }}
                                      >
                                        <MenuItem value="principal">Responsable principal</MenuItem>
                                        <MenuItem value="co_responsible">Corresponsable</MenuItem>
                                      </TextField>
                                      <Stack direction="row" alignItems="center" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
                                        <Chip
                                          size="small"
                                          label={participant.status === 'signed' ? 'Firmado' : 'Firma pendiente'}
                                          color={participant.status === 'signed' ? 'success' : 'default'}
                                        />
                                        <IconButton
                                          aria-label={`Retirar a ${participant.name}`}
                                          color="error"
                                          size="small"
                                          disabled={participant.status === 'signed'}
                                          onClick={() => removeMeetingParticipant(index)}
                                          sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}
                                        >
                                          <DeleteOutline fontSize="small" />
                                        </IconButton>
                                      </Stack>
                                    </Stack>
                                  </Paper>
                                );
                              })}
                          </Stack>
                        )}
                      </Box>

                      <TextField
                        id="strategic-meeting-title-field"
                        fullWidth
                        required
                        label="Título corto del acta *"
                        error={Boolean(meetingFieldErrors.title)}
                        helperText={meetingFieldErrors.title ? 'El título corto del acta es obligatorio.' : undefined}
                        value={meeting.title || ''}
                        onChange={(e) => {
                          setMeeting({ ...meeting, title: e.target.value });
                          if (meetingFieldErrors.title) setMeetingFieldErrors((prev) => ({ ...prev, title: false }));
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                      />
                      <TextField
                        id="strategic-meeting-dependency-field"
                        fullWidth
                        disabled
                        label="Dependencia que cita"
                        value={PLANNING_DEPARTMENT_NAME}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#f8fafc' } }}
                      />
                      <TextField
                        id="strategic-meeting-starts-field"
                        fullWidth
                        required
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        label="Inicio *"
                        error={Boolean(meetingFieldErrors.starts_at)}
                        helperText={meetingFieldErrors.starts_at ? 'La fecha y hora de inicio son obligatorias.' : undefined}
                        value={meeting.starts_at}
                        onChange={(e) => {
                          setMeeting({ ...meeting, starts_at: e.target.value });
                          if (meetingFieldErrors.starts_at) setMeetingFieldErrors((prev) => ({ ...prev, starts_at: false }));
                        }}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                      />
                      <TextField
                        id="strategic-meeting-ends-field"
                        fullWidth
                        type="datetime-local"
                        InputLabelProps={{ shrink: true }}
                        label="Fin"
                        value={meeting.ends_at}
                        onChange={(e) => setMeeting({ ...meeting, ends_at: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                      />
                      <Box>
                        <TextField
                          id="strategic-meeting-location-field"
                          fullWidth
                          label="Lugar"
                          value={meeting.location}
                          onChange={(e) => setMeeting({ ...meeting, location: e.target.value })}
                          inputProps={{ list: 'strategic-meeting-locations' }}
                          helperText="Seleccione una opción o escriba otro lugar."
                          sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                        />
                        <datalist id="strategic-meeting-locations">{locations.map((entry) => <option key={entry.id} value={entry.name} />)}</datalist>
                      </Box>
                      <TextField
                        id="strategic-meeting-modality-field"
                        fullWidth
                        select
                        label="Modalidad"
                        value={meeting.modality}
                        onChange={(e) => setMeeting({ ...meeting, modality: e.target.value })}
                        sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}
                      >
                        {['Presencial','Virtual','Híbrida'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                      </TextField>

                      <Box sx={{ gridColumn: '1 / -1', my: 0.5 }}>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f0f7ff', border: '1px solid #bae0ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <AutoAwesome sx={{ color: '#0284c7' }} />
                            <Box>
                              <Typography fontWeight={850} color="#0369a1" sx={{ fontSize: 13.5 }}>Consolidar acta con IA</Typography>
                              <Typography variant="body2" color="#0284c7" sx={{ fontSize: 12 }}>Redacta automáticamente objetivo, desarrollo y compromisos desde actividades o audio de la sesión.</Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            {audioFile && (
                              <Chip
                                size="small"
                                label={`Audio: ${audioFile.name}`}
                                onDelete={() => setAudioFile(null)}
                                color="primary"
                                variant="outlined"
                                sx={{ fontWeight: 750, maxWidth: 220, bgcolor: '#ffffff' }}
                              />
                            )}
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={generatingMinuteSummary ? <CircularProgress size={15} color="inherit" /> : <AutoAwesome fontSize="small" />}
                              disabled={generatingMinuteSummary || !detail?.items?.length}
                              onClick={generateMinuteSummary}
                              sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 850, px: 2, py: 0.75, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
                            >
                              {generatingMinuteSummary ? 'Analizando…' : `Generar desde actividades (${detail?.items?.length || 0})`}
                            </Button>
                            <Button
                              size="small"
                              component="label"
                              variant="outlined"
                              startIcon={<CloudUpload fontSize="small" />}
                              sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800, fontSize: 12, color: '#0369a1', borderColor: '#bae0ff', bgcolor: '#ffffff' }}
                            >
                              {audioFile ? 'Cambiar audio' : 'Adjuntar audio de sesión'}
                              <input
                                hidden
                                type="file"
                                accept="audio/*"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) {
                                    setAudioFile(f);
                                    enqueueSnackbar(`Audio "${f.name}" adjuntado para apoyo en el acta.`, { variant: 'info' });
                                  }
                                }}
                              />
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<Refresh fontSize="small" />}
                              onClick={() => {
                                if (!detail) return;
                                const currentMeeting = activeMeeting || {};
                                const firstItem = detail.items?.[0] || {};
                                setMeeting({
                                  title: currentMeeting.title || `Concertación del Plan de Acción ${detail.term?.year || ''}`.trim(),
                                  starts_at: toDatetimeLocal(currentMeeting.starts_at || firstItem.starts_on, 8),
                                  ends_at: toDatetimeLocal(currentMeeting.ends_at || firstItem.ends_on, 10),
                                  location: currentMeeting.location || locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
                                  modality: currentMeeting.modality || 'Presencial',
                                  objective: currentMeeting.objective || (firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.'),
                                  development: currentMeeting.development || 'Se consolidó el plan revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales.',
                                  conclusions: (currentMeeting.commitments || [])
                                    .map((entry) => typeof entry === 'string' ? entry : `${entry.description || ''}${entry.responsible ? ` — ${entry.responsible}` : ''}`)
                                    .filter(Boolean)
                                    .join('\n') || 'Se aprueban los registros del Plan de Acción y se genera el acta formal para firmas.',
                                  participants_text: currentMeeting.participants_text || (
                                    (currentMeeting.participants && currentMeeting.participants.length > 0)
                                      ? currentMeeting.participants.map((p) => `${p.name || ''} | ${p.email || ''} | UNICESMAG | ${p.role_title || ''}`).join('\n')
                                      : `${detail.owner?.name || 'Líder del Proceso'} | ${detail.owner?.email || 'lider@unicesmag.edu.co'} | UNICESMAG | Responsable Institucional`
                                  )
                                });
                                enqueueSnackbar('Datos de la reunión precargados desde el plan.', { variant: 'info' });
                              }}
                              sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 800, fontSize: 12, color: '#0369a1', borderColor: '#bae0ff', bgcolor: '#ffffff' }}
                            >
                              Restablecer
                            </Button>
                          </Stack>
                        </Paper>
                      </Box>

                      {[
                        { key: 'objective', label: 'Objetivo de la reunión', rows: 3, required: true },
                        { key: 'development', label: 'Desarrollo de la reunión', rows: 5 },
                        { key: 'conclusions', label: 'Conclusiones / Compromisos', rows: 3, helperText: 'Redacte los acuerdos, responsables o compromisos definidos en la reunión.' }
                      ].map((field) => (
                        <Box key={field.key} sx={{ gridColumn: '1 / -1' }}>
                          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                            <Typography fontWeight={800} color={meetingFieldErrors[field.key] ? 'error.main' : '#1e293b'} sx={{ fontSize: 13.5 }}>
                              {field.label}{field.required ? ' *' : ''}
                            </Typography>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={improvingMeetingField === field.key ? <CircularProgress size={15} /> : <AutoAwesome fontSize="small" />}
                              disabled={Boolean(improvingMeetingField) || !richTextPlain(meeting[field.key])}
                              onClick={() => improveMeetingText(field.key)}
                              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, fontSize: 12, py: 0.4, px: 1.5, color: '#0284c7', borderColor: '#bae0ff', bgcolor: '#f0f7ff' }}
                            >
                              {improvingMeetingField === field.key ? 'Mejorando…' : 'Mejorar redacción con IA'}
                            </Button>
                          </Stack>
                          <RichTextEditor
                            id={`strategic-plan-minute-${field.key}`}
                            label=""
                            value={meeting[field.key]}
                            onChange={(value) => {
                              setMeeting((previous) => ({ ...previous, [field.key]: value }));
                              if (meetingFieldErrors[field.key]) setMeetingFieldErrors((prev) => ({ ...prev, [field.key]: false }));
                            }}
                            minHeight={field.rows >= 5 ? 220 : 155}
                            error={Boolean(meetingFieldErrors[field.key]) || (field.required && !richTextPlain(meeting[field.key]))}
                          />
                          {meetingFieldErrors[field.key] && (
                            <Typography variant="caption" color="error.main" sx={{ display: 'block', mt: 0.5, ml: 1, fontWeight: 700 }}>
                              {field.label} es obligatorio.
                            </Typography>
                          )}
                          {field.helperText && !meetingFieldErrors[field.key] && (
                            <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.75, ml: 1 }}>{field.helperText}</Typography>
                          )}
                        </Box>
                      ))}
                    </Box>
                  </Paper>

                  <Paper
                    id="strategic-meeting-participants-section"
                    variant="outlined"
                    sx={{
                      p: 2.25,
                      borderRadius: 3.5,
                      bgcolor: meetingFieldErrors.participants ? '#fef2f2' : '#ffffff',
                      borderColor: meetingFieldErrors.participants ? '#dc2626' : '#d8e5f2',
                      borderWidth: meetingFieldErrors.participants ? '2px' : '1px',
                      boxShadow: meetingFieldErrors.participants ? '0 0 0 4px rgba(220,38,38,0.15)' : 'none'
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.25} flexWrap="wrap" gap={1}>
                      <Typography fontWeight={900} color={meetingFieldErrors.participants ? '#dc2626' : '#0f172a'} sx={{ fontSize: 16 }}>
                        2. Participantes y firmas
                      </Typography>
                      {meetingParticipants.length >= 2 ? (
                        <Chip size="small" color="default" label={`${meetingParticipants.length} personas en la reunión`} sx={{ fontWeight: 850 }} />
                      ) : (
                        <Chip size="small" color="error" label="Al menos 2 participantes requeridos" sx={{ fontWeight: 850 }} />
                      )}
                    </Stack>

                    <Paper variant="outlined" sx={{ p: 1.5, mt: 1.5, borderRadius: 2.5, bgcolor: '#f8fbff', borderColor: '#dbe7f4' }}>
                      <Stack direction="row" alignItems="center" gap={1} mb={1}>
                        <PersonSearch color="primary" />
                        <Box>
                          <Typography fontWeight={850}>Buscar participante</Typography>
                        </Box>
                      </Stack>

                      <Stack direction={{ xs: 'column', sm: 'row' }} alignItems="stretch" gap={1} mb={1.25}>
                        <Autocomplete
                          freeSolo
                          fullWidth
                          size="small"
                          options={attendeeOptions}
                          loading={attendeeSearching}
                          filterOptions={(options) => options}
                          getOptionLabel={(option) => typeof option === 'string'
                            ? option
                            : `${option.name || ''} · CC ${option.document || ''}`}
                          inputValue={unifiedDraft.document}
                          onInputChange={(_, value, reason) => {
                            if (!['input', 'clear'].includes(reason)) return;
                            setUnifiedDraft((old) => ({ ...old, document: value }));
                            if (reason === 'clear') {
                              setAttendeeOptions([]);
                            } else {
                              searchMeetingPeople(value, setAttendeeOptions, setAttendeeSearching);
                            }
                          }}
                          onChange={(_, option) => {
                            if (option && typeof option !== 'string') {
                              setUnifiedDraft((old) => ({
                                ...old,
                                document: option.document || old.document,
                                name: option.name || '',
                                email: option.email || '',
                                organization: option.dependency || option.viceRectorate || option.organization || 'UNICESMAG',
                                role_title: option.position || option.role_title || '',
                                user_id: option.id || null
                              }));
                              setAttendeeOptions([]);
                            }
                          }}
                          renderInput={(params) => (
                            <TextField
                              {...params}
                              label="Nombre o cédula/identificación"
                              placeholder="Nombre interno o cédula"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  lookupUnifiedParticipant();
                                }
                              }}
                              InputProps={{
                                ...params.InputProps,
                                endAdornment: (
                                  <>
                                    {attendeeSearching ? <CircularProgress color="inherit" size={16} /> : null}
                                    {params.InputProps.endAdornment}
                                  </>
                                )
                              }}
                            />
                          )}
                        />
                        <Button
                          variant="outlined"
                          startIcon={attendeeSearching ? <CircularProgress size={16} /> : <PersonSearch />}
                          disabled={attendeeSearching || !String(unifiedDraft.document || '').trim()}
                          onClick={() => lookupUnifiedParticipant()}
                          sx={{
                            minWidth: { xs: '100%', sm: 140 },
                            height: 40,
                            flexShrink: 0,
                            whiteSpace: 'nowrap',
                            textTransform: 'none',
                            fontWeight: 800
                          }}
                        >
                          Buscar
                        </Button>
                      </Stack>

                      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
                        <TextField
                          size="small"
                          label="Nombre completo"
                          value={unifiedDraft.name}
                          onChange={(e) => setUnifiedDraft((old) => ({ ...old, name: e.target.value }))}
                        />
                        <TextField
                          size="small"
                          type="email"
                          label="Correo empresarial o personal"
                          value={unifiedDraft.email}
                          onChange={(e) => setUnifiedDraft((old) => ({ ...old, email: e.target.value }))}
                        />
                        <TextField
                          size="small"
                          label="Cargo"
                          value={unifiedDraft.role_title}
                          onChange={(e) => setUnifiedDraft((old) => ({ ...old, role_title: e.target.value }))}
                        />
                        <TextField
                          size="small"
                          label="Empresa, entidad o programa (opcional)"
                          value={unifiedDraft.organization}
                          onChange={(e) => setUnifiedDraft((old) => ({ ...old, organization: e.target.value }))}
                        />
                      </Box>

                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems="center" gap={1} mt={1.5}>
                        <TextField
                          select
                          size="small"
                          label="Rol en el acta"
                          value={unifiedDraft.meeting_role || 'participant'}
                          onChange={(e) => setUnifiedDraft((old) => ({ ...old, meeting_role: e.target.value }))}
                          sx={{ minWidth: 180, width: { xs: '100%', sm: 'auto' } }}
                        >
                          <MenuItem value="participant">Participante</MenuItem>
                          <MenuItem value="collaborator">Colaborador</MenuItem>
                        </TextField>
                        <Stack direction="row" gap={1} sx={{ width: { xs: '100%', sm: 'auto' }, justifyContent: 'flex-end' }}>
                          <Button
                            onClick={() => {
                              setUnifiedDraft({ document: '', name: '', email: '', organization: '', role_title: '', meeting_role: 'participant', user_id: null });
                              setAttendeeOptions([]);
                            }}
                            sx={{ textTransform: 'none', color: '#64748b' }}
                          >
                            Limpiar
                          </Button>
                          <Button
                            variant="contained"
                            startIcon={<Add />}
                            onClick={addUnifiedParticipant}
                            sx={{ textTransform: 'none', fontWeight: 850, borderRadius: 2 }}
                          >
                            + Agregar al acta
                          </Button>
                        </Stack>
                      </Stack>
                    </Paper>

                    <Stack spacing={2} mt={meetingParticipants.length ? 2.5 : 0}>
                      {meetingParticipants
                        .map((participant, index) => ({ participant, index }))
                        .map(({ participant, index }) => {
                          const isPrimary = participant.meeting_role === 'principal';
                          const isCoResp = participant.meeting_role === 'co_responsible';
                          return (
                            <Paper
                              key={participant.id || participant.user_id || `${participant.document || participant.email}-${index}`}
                              variant="outlined"
                              sx={{
                                p: 2.25,
                                borderRadius: 3,
                                bgcolor: isPrimary ? '#f0fdf4' : isCoResp ? '#eff6ff' : '#ffffff',
                                borderColor: isPrimary ? '#86efac' : isCoResp ? '#bfdbfe' : '#cbd5e1',
                                boxShadow: '0 2px 6px rgba(15,23,42,0.04)',
                                display: 'flex',
                                flexDirection: { xs: 'column', md: 'row' },
                                alignItems: { xs: 'stretch', md: 'center' },
                                justifyContent: 'space-between',
                                gap: 1.5
                              }}
                            >
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap">
                                  <Typography variant="body2" fontWeight={850} color="#0f172a" sx={{ fontSize: 14.5 }}>{participant.name}</Typography>
                                  {isPrimary && (
                                    <Chip
                                      size="small"
                                      label={participant.role_title?.toLowerCase().includes('planeaci') || participant.organization?.toLowerCase().includes('planeaci')
                                        ? 'Responsable Principal · Planeación y Efectividad'
                                        : 'Responsable Principal'}
                                      color="success"
                                      sx={{ height: 22, fontSize: 11, fontWeight: 800 }}
                                    />
                                  )}
                                  {isCoResp && (
                                    <Chip
                                      size="small"
                                      label={participant.role_title?.toLowerCase().includes('planeaci') || participant.organization?.toLowerCase().includes('planeaci')
                                        ? 'Co-responsable · Planeación y Efectividad'
                                        : 'Co-responsable · Plan de Acción'}
                                      color="primary"
                                      variant="outlined"
                                      sx={{ height: 22, fontSize: 11, fontWeight: 750 }}
                                    />
                                  )}
                                  {!participant.user_id && !isPrimary && !isCoResp && (
                                    <Chip size="small" label="Externo" variant="outlined" color="primary" sx={{ height: 22, fontSize: 11 }} />
                                  )}
                                  {!isPrimary && !isCoResp && participant.meeting_role === 'collaborator' && (
                                    <Chip size="small" label="Colaborador" variant="outlined" sx={{ height: 22, fontSize: 11 }} />
                                  )}
                                  {!isPrimary && !isCoResp && participant.meeting_role === 'participant' && (
                                    <Chip size="small" label="Participante" variant="outlined" color="default" sx={{ height: 22, fontSize: 11 }} />
                                  )}
                                </Stack>
                                <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.5 }}>
                                  CC {participant.document || 'registrada'} · {participant.email}
                                </Typography>
                                <Typography variant="caption" color="#475569" sx={{ display: 'block', fontWeight: 600, mt: 0.25 }}>
                                  {participant.role_title || 'Sin cargo'} · {participant.organization || 'UNICESMAG'}
                                </Typography>
                              </Box>
                              <Stack
                                direction={{ xs: 'column', sm: 'row' }}
                                alignItems={{ xs: 'stretch', sm: 'center' }}
                                spacing={1.25}
                                flexWrap="wrap"
                                justifyContent={{ xs: 'stretch', md: 'flex-end' }}
                                sx={{ width: { xs: '100%', md: 'auto' } }}
                              >
                                <TextField
                                  select
                                  size="small"
                                  label="Rol"
                                  value={participant.meeting_role || 'participant'}
                                  disabled={participant.status === 'signed'}
                                  onChange={(event) => updateMeetingParticipantRole(index, event.target.value)}
                                  sx={{ minWidth: { xs: '100%', sm: 160 } }}
                                >
                                  <MenuItem value="principal">Responsable principal</MenuItem>
                                  <MenuItem value="co_responsible">Co-responsable</MenuItem>
                                  <MenuItem value="collaborator">Colaborador</MenuItem>
                                  <MenuItem value="participant">Participante</MenuItem>
                                </TextField>
                                <Stack direction="row" alignItems="center" spacing={1} justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
                                  <Chip
                                    size="small"
                                    label={participant.status === 'signed' ? 'Firmado' : 'Firma pendiente'}
                                    color={participant.status === 'signed' ? 'success' : 'default'}
                                    variant={participant.status === 'signed' ? 'filled' : 'outlined'}
                                    sx={{ fontWeight: 800, fontSize: 11 }}
                                  />
                                  <IconButton
                                    aria-label={`Retirar a ${participant.name}`}
                                    color="error"
                                    size="small"
                                    disabled={participant.status === 'signed'}
                                    onClick={() => removeMeetingParticipant(index)}
                                    sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}
                                  >
                                    <DeleteOutline fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </Stack>
                            </Paper>
                          );
                        })}
                    </Stack>
                  </Paper>

                  {/* CARD: PROGRAMAR SIGUIENTE SESIÓN */}
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, borderColor: '#93c5fd', bgcolor: '#f8fbff', boxShadow: '0 2px 10px rgba(37,99,235,0.06)', mt: 1, mb: 1.5 }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between" gap={1.5}>
                      <Stack direction="row" alignItems="center" gap={1.25}>
                        <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#dbeafe', color: '#1d4ed8', flexShrink: 0 }}>
                          <CalendarMonth />
                        </Box>
                        <Box>
                          <Typography fontWeight={900} color="#17345f">Programar siguiente sesión</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {!meetingParticipants.some((p) => p.meeting_role === 'principal')
                              ? 'Opcional · Asigne al Responsable Principal para habilitar Calendar.'
                              : 'Opcional · Sincronice fecha, hora y participantes con Google Calendar.'}
                          </Typography>
                        </Box>
                      </Stack>
                      <Button
                        variant="contained"
                        startIcon={<CalendarMonth />}
                        onClick={() => setCalendarSchedulerOpen(true)}
                        sx={{ borderRadius: 2.5, px: 2.5, textTransform: 'none', fontWeight: 900 }}
                      >
                        Abrir Calendar
                      </Button>
                    </Stack>
                  </Paper>
                </Box>

                <Box sx={{
                  width: meetingLayoutMode === 'preview' ? '100%' : meetingLayoutMode === 'split' ? { xs: '100%', lg: '53%' } : '100%',
                  display: meetingLayoutMode === 'form' ? 'none' : 'block',
                  height: { lg: '100%' },
                  overflowY: { lg: 'auto' },
                  pr: { lg: 1.5 },
                  pb: { xs: 4, lg: 6 }
                }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5} flexWrap="wrap" gap={1}>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <IconButton
                          size="small"
                          onClick={() => setMeetingLayoutMode(meetingLayoutMode === 'preview' ? 'split' : 'preview')}
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: '#f1f5f9',
                            color: '#1e293b',
                            '&:hover': { bgcolor: '#e2e8f0' }
                          }}
                          title="Cambiar vista"
                        >
                          <ArrowBack fontSize="small" />
                        </IconButton>
                        <Typography fontWeight={900} sx={{ fontSize: { xs: 14, sm: 15 }, color: '#0f172a' }}>
                          Vista previa del acta
                        </Typography>
                      </Stack>
                      <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
                        {latestMinute?.drive_file_id && !latestMinute?.content?.storage_quota_limited ? (
                          <Chip
                            size="small"
                            icon={<CheckCircle sx={{ color: '#16a34a !important', fontSize: 16 }} />}
                            label={isFinalized ? "Sincronizada con Google Drive" : "Borrador sincronizado con Drive"}
                            clickable={Boolean(latestMinute?.content?.drive_file_url || latestMinute?.content?.drive_folder_url)}
                            component={latestMinute?.content?.drive_file_url ? 'a' : 'div'}
                            href={latestMinute?.content?.drive_file_url || latestMinute?.content?.drive_folder_url || undefined}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              fontWeight: 750,
                              fontSize: 11,
                              bgcolor: '#f0fdf4',
                              color: '#166534',
                              border: '1px solid #bbf7d0',
                              height: 24,
                              '& .MuiChip-icon': { ml: 0.5 }
                            }}
                          />
                        ) : (latestMinute?.content?.storage_quota_limited || (latestMinute?.content?.drive_folder_id && !latestMinute?.drive_file_id)) ? (
                          <Tooltip title="La carpeta institucional está lista en Google Drive. Para subir directamente el archivo PDF, configure el Refresh Token OAuth (PLAN_ACTION_GOOGLE_REFRESH_TOKEN) en el servidor.">
                            <Chip
                              size="small"
                              icon={<InsertDriveFile sx={{ color: '#d97706 !important', fontSize: 16 }} />}
                              label="Carpeta lista en Drive"
                              clickable={Boolean(latestMinute?.content?.drive_folder_url)}
                              component={latestMinute?.content?.drive_folder_url ? 'a' : 'div'}
                              href={latestMinute?.content?.drive_folder_url || undefined}
                              target="_blank"
                              rel="noopener noreferrer"
                              sx={{
                                fontWeight: 750,
                                fontSize: 11,
                                bgcolor: '#fffbeb',
                                color: '#b45309',
                                border: '1px solid #fde68a',
                                height: 24,
                                '& .MuiChip-icon': { ml: 0.5 }
                              }}
                            />
                          </Tooltip>
                        ) : syncingMinute ? (
                          <Chip
                            size="small"
                            icon={<CircularProgress size={12} color="inherit" />}
                            label="Sincronizando con Drive..."
                            sx={{
                              fontWeight: 750,
                              fontSize: 11,
                              bgcolor: '#eff6ff',
                              color: '#1d4ed8',
                              border: '1px solid #bfdbfe',
                              height: 24
                            }}
                          />
                        ) : null}

                        {latestMinute?.content?.drive_file_url && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<OpenInNew sx={{ fontSize: 13 }} />}
                            href={latestMinute.content.drive_file_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              fontSize: 11,
                              fontWeight: 750,
                              color: '#15803d',
                              py: 0.2,
                              px: 0.8,
                              minWidth: 'auto',
                              textTransform: 'none',
                              bgcolor: '#f0fdf4',
                              borderRadius: 1.5,
                              border: '1px solid #bbf7d0',
                              '&:hover': { bgcolor: '#dcfce7' }
                            }}
                          >
                            Ver PDF en Drive
                          </Button>
                        )}
                        {latestMinute?.content?.drive_folder_url && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<Folder sx={{ fontSize: 13, color: '#0284c7' }} />}
                            href={latestMinute.content.drive_folder_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            sx={{
                              fontSize: 11,
                              fontWeight: 750,
                              color: '#0369a1',
                              py: 0.2,
                              px: 0.8,
                              minWidth: 'auto',
                              textTransform: 'none',
                              bgcolor: '#f0f9ff',
                              borderRadius: 1.5,
                              border: '1px solid #bae6fd',
                              '&:hover': { bgcolor: '#e0f2fe' }
                            }}
                          >
                            Abrir carpeta
                          </Button>
                        )}

                        <Stack
                          direction="row"
                          alignItems="center"
                          gap={0.75}
                          sx={{
                            color: saveStatus === 'error' ? '#b91c1c' : saveStatus === 'saved' ? '#15803d' : '#a16207',
                            fontSize: 11,
                            fontWeight: 750,
                            bgcolor: saveStatus === 'error' ? '#fef2f2' : saveStatus === 'saved' ? '#f0fdf4' : '#fffbeb',
                            px: 1,
                            py: 0.35,
                            borderRadius: 1.5,
                            border: `1px solid ${saveStatus === 'error' ? '#fecaca' : saveStatus === 'saved' ? '#bbf7d0' : '#fde68a'}`
                          }}
                        >
                          {saveStatus === 'saving' ? (
                            <CircularProgress size={10} color="inherit" />
                          ) : (
                            <Box
                              sx={{
                                width: 7,
                                height: 7,
                                borderRadius: '50%',
                                bgcolor: saveStatus === 'error' ? '#ef4444' : saveStatus === 'saved' ? '#22c55e' : '#eab308'
                              }}
                            />
                          )}
                          <span>
                            {saveStatus === 'saving'
                              ? 'Guardando automáticamente…'
                              : saveStatus === 'pending'
                              ? 'Cambios pendientes…'
                              : saveStatus === 'error'
                              ? 'Error al guardar'
                              : 'Todo guardado · Autoguardado activo'}
                          </span>
                        </Stack>
                      </Stack>
                    </Stack>

                    {(() => {
                      const isFinalized = Boolean(activeMeeting?.status === 'formalized' || latestMinute?.status === 'finalized');
                      const isSigning = Boolean(latestMinute?.status === 'signing');
                      const isLocked = Boolean(activeMeeting?.id && (isSigning || isFinalized));
                      const requiredParticipants = meetingParticipants.filter((p) => p.signature_required !== false);
                      const signedParticipants = requiredParticipants.filter((p) => p.status === 'signed');
                      const pendingCount = Math.max(0, requiredParticipants.length - signedParticipants.length);
                      const allSigned = requiredParticipants.length > 0 && pendingCount === 0;
                      const canRevise = Boolean(isSigning || isFinalized);
                      const canSendFinal = Boolean(allSigned || isFinalized);
                      const needsManualDriveSync = Boolean(isFinalized && !latestMinute?.drive_file_id);

                      if (isLocked) {
                        return (
                          <Stack spacing={1} sx={{
                            width: '100%', mb: 2,
                            '& .MuiButton-root': {
                              width: '100%',
                              minHeight: 38,
                              py: 0.6,
                              px: 1.5,
                              textTransform: 'none',
                              fontWeight: 800,
                              fontSize: { xs: 11.5, sm: 12.5 },
                              borderRadius: 2,
                              boxShadow: 'none',
                              '& .MuiButton-startIcon': { mr: 0.75, ml: 0 }
                            }
                          }}>
                            {/* Fila 1: Documento y Control del Acta */}
                            <Box
                              sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', sm: canRevise ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))' },
                                gap: 1,
                                width: '100%'
                              }}
                            >
                              <Button
                                id="meeting-download-button"
                                fullWidth
                                variant="outlined"
                                endIcon={<KeyboardArrowDown fontSize="small" />}
                                startIcon={<Download fontSize="small" />}
                                disabled={!activeMeeting?.id}
                                onClick={(e) => setPdfMenuAnchor(e.currentTarget)}
                              >
                                Descargar PDF
                              </Button>
                              {canRevise && (
                                <Button
                                  fullWidth
                                  variant={editingActa ? "contained" : "outlined"}
                                  color={editingActa ? "success" : "warning"}
                                  startIcon={editingActa ? <Save fontSize="small" /> : <EditNote fontSize="small" />}
                                  disabled={saving}
                                  onClick={async () => {
                                    if (editingActa) {
                                      const savedResult = await saveMeeting();
                                      if (savedResult) {
                                        setEditingActa(false);
                                        const targetMinuteId = latestMinute?.id || savedResult?.minute_id;
                                        if (targetMinuteId && (isSigning || isFinalized || savedResult?.signatures_reset)) {
                                          await publishMinute(targetMinuteId, { is_revision: true, regenerate: true });
                                        }
                                      }
                                    } else {
                                      setEditingActa(true);
                                    }
                                  }}
                                  sx={{ fontWeight: 850 }}
                                >
                                  {editingActa ? 'Guardar ajuste y reactivar firmas' : 'Ajustar y volver a firmar'}
                                </Button>
                              )}
                              <Button
                                id="meeting-refresh-signatures-button"
                                fullWidth
                                variant="outlined"
                                startIcon={<Refresh fontSize="small" />}
                                disabled={saving}
                                onClick={() => load(false)}
                              >
                                Actualizar firmas
                              </Button>
                            </Box>

                            {/* Fila 2: Gestión de Firmas y Envío */}
                            {(() => {
                              const row2Items = [];
                              if (isSigning) {
                                row2Items.push(
                                  <Button
                                    key="ver-qr"
                                    fullWidth
                                    variant="outlined"
                                    startIcon={<QrCode2 fontSize="small" />}
                                    disabled={saving}
                                    onClick={() => enableQrSigning(false)}
                                  >
                                    Ver enlace y QR
                                  </Button>
                                );
                              }
                              if (isSigning && !allSigned) {
                                row2Items.push(
                                  <Tooltip key="reenviar-pendientes" title={`Enviar nuevamente el correo solo a ${pendingCount} participante${pendingCount === 1 ? '' : 's'} pendiente${pendingCount === 1 ? '' : 's'}`}>
                                    <Button
                                      id="meeting-resend-pending-button"
                                      fullWidth
                                      variant="outlined"
                                      startIcon={<Email fontSize="small" />}
                                      disabled={saving}
                                      onClick={() => enableQrSigning(true)}
                                    >
                                      Reenviar solo a pendientes
                                    </Button>
                                  </Tooltip>
                                );
                              }
                              if (canSendFinal) {
                                row2Items.push(
                                  <Tooltip key="enviar-final" title={!allSigned ? `Se habilitará cuando todos los participantes hayan firmado (${pendingCount} pendiente${pendingCount === 1 ? '' : 's'})` : 'Enviar versión final del acta con firmas a todos los participantes'}>
                                    <Box component="span" sx={{ display: 'flex', width: '100%' }}>
                                      <Button
                                        id="meeting-send-final-button"
                                        fullWidth
                                        startIcon={syncingMinute ? <CircularProgress size={16} color="inherit" /> : <Send fontSize="small" />}
                                        disabled={saving || syncingMinute || !allSigned}
                                        onClick={() => handleFinalizeMinute(false)}
                                        color="success"
                                        variant={allSigned ? "contained" : "outlined"}
                                        sx={{ fontWeight: 850 }}
                                      >
                                        {isFinalized ? "Reenviar acta firmada" : "Enviar acta firmada"}
                                      </Button>
                                    </Box>
                                  </Tooltip>
                                );
                              }
                              if (needsManualDriveSync) {
                                row2Items.push(
                                  <Tooltip key="manual-drive-sync" title="El acta aún no se ha sincronizado con Google Drive. Haga clic para sincronizarla.">
                                    <Button
                                      fullWidth
                                      variant="outlined"
                                      color="success"
                                      startIcon={syncingMinute ? <CircularProgress size={16} color="inherit" /> : <InsertDriveFile fontSize="small" />}
                                      disabled={syncingMinute}
                                      onClick={() => handleFinalizeMinute(false)}
                                      sx={{ fontWeight: 850 }}
                                    >
                                      {syncingMinute ? 'Sincronizando con Drive...' : 'Sincronizar con Google Drive'}
                                    </Button>
                                  </Tooltip>
                                );
                              }

                              if (!row2Items.length) return null;

                              return (
                                <Box
                                  sx={{
                                    display: 'grid',
                                    gridTemplateColumns: {
                                      xs: '1fr',
                                      sm: `repeat(${row2Items.length}, minmax(0, 1fr))`
                                    },
                                    gap: 1,
                                    width: '100%'
                                  }}
                                >
                                  {row2Items}
                                </Box>
                              );
                            })()}
                          </Stack>
                        );
                      }

                      /* Estado borrador (draft) - Idéntico a Registro de Asistencia y Reunión */
                      return (
                        <Box
                          sx={{
                            display: 'grid',
                            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' },
                            gap: 1,
                            width: '100%',
                            mb: 2,
                            '& .MuiButton-root': {
                              width: '100%',
                              minHeight: 38,
                              py: 0.6,
                              px: 1.5,
                              textTransform: 'none',
                              fontWeight: 800,
                              fontSize: { xs: 11.5, sm: 12.5 },
                              borderRadius: 2,
                              boxShadow: 'none',
                              '& .MuiButton-startIcon': { mr: 0.75, ml: 0 }
                            }
                          }}
                        >
                          <Button
                            id="meeting-download-button"
                            fullWidth
                            variant="outlined"
                            endIcon={<KeyboardArrowDown fontSize="small" />}
                            startIcon={<Download fontSize="small" />}
                            disabled={!activeMeeting?.id}
                            onClick={(e) => setPdfMenuAnchor(e.currentTarget)}
                          >
                            Descargar PDF
                          </Button>
                          {!editingActa ? (
                            <Button
                              fullWidth
                              variant="outlined"
                              color="primary"
                              startIcon={<EditNote fontSize="small" />}
                              onClick={() => setEditingActa(true)}
                              sx={{ fontWeight: 850 }}
                            >
                              Editar acta
                            </Button>
                          ) : (
                            <Button
                              fullWidth
                              variant="contained"
                              color="success"
                              startIcon={<Save fontSize="small" />}
                              disabled={saving}
                              onClick={async () => {
                                const saved = await saveMeeting();
                                if (saved) setEditingActa(false);
                              }}
                              sx={{ fontWeight: 850 }}
                            >
                              Guardar edición
                            </Button>
                          )}
                          <Tooltip title="Validar el acta completa, habilitar firmas y enviar las invitaciones">
                            <Box component="span" sx={{ display: 'flex', width: '100%' }}>
                              <Button
                                id="meeting-publish-button"
                                fullWidth
                                startIcon={<Email fontSize="small" />}
                                onClick={() => enableQrSigning(false)}
                                disabled={saving || !activeMeeting?.id}
                                variant="contained"
                                sx={{ fontWeight: 850 }}
                              >
                                Habilitar y enviar invitaciones
                              </Button>
                            </Box>
                          </Tooltip>
                        </Box>
                      );
                    })()}

                    <Menu
                      anchorEl={pdfMenuAnchor}
                      open={Boolean(pdfMenuAnchor)}
                      onClose={() => setPdfMenuAnchor(null)}
                      PaperProps={{ sx: { borderRadius: 2.5, mt: 0.5, minWidth: 260, boxShadow: '0 10px 30px rgba(0,0,0,0.15)' } }}
                    >
                      <MenuItem onClick={() => handleDownloadPdf('original')} sx={{ py: 1 }}>
                        <Box>
                          <Typography variant="body2" fontWeight={850} color="primary.main">Original (con firmas gráficas)</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">Documento máster custodiado por el responsable</Typography>
                        </Box>
                      </MenuItem>
                      <MenuItem onClick={() => handleDownloadPdf('official_copy')} sx={{ py: 1 }}>
                        <Box>
                          <Typography variant="body2" fontWeight={850} color="text.primary">Copia oficial (sin firmas visibles)</Typography>
                          <Typography variant="caption" color="text.secondary" display="block">Versión oficial para participantes con constancia 'ORIGINAL FIRMADO'</Typography>
                        </Box>
                      </MenuItem>
                    </Menu>

                    <Box sx={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch', pb: 0.5 }}>
                      <Box sx={{ minWidth: { xs: 580, sm: '100%' }, border: '1px solid #000000', fontFamily: 'Arial, sans-serif', fontSize: 11.5, color: '#000000', bgcolor: '#ffffff', overflow: 'hidden' }}>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '22% 56% 22%', borderBottom: '1px solid #000000', minHeight: 80 }}>
                        <Box sx={{ borderRight: '1px solid #000000', p: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Box component="img" src={logoFormatos} alt="Universidad CESMAG" sx={{ width: '94%', maxHeight: 64, objectFit: 'contain' }} />
                        </Box>
                        <Box sx={{ borderRight: '1px solid #000000', p: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontWeight: 900, fontSize: 13 }}>
                          REGISTRO DE ASISTENCIA Y REUNIÓN
                        </Box>
                        <Box sx={{ p: 0.8, display: 'flex', flexDirection: 'column', justifyContent: 'center', fontSize: 10, fontWeight: 800, lineHeight: 1.4 }}>
                          <Box>CÓDIGO: COM-IF-FR-002</Box>
                          <Box>VERSIÓN: 1</Box>
                          <Box>FECHA: 6/MAR/2020</Box>
                        </Box>
                      </Box>

                      <Box sx={{ p: 0.8, borderBottom: '1px solid #000000', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <strong>Responsable(s):</strong>
                        <span>{actaData.responsables || detail?.organizationalUnit?.name}</span>
                      </Box>

                      <Box sx={{ p: 0.8, borderBottom: '1px solid #000000', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <strong>Dependencia que cita:</strong>
                        <span>{PLANNING_DEPARTMENT_NAME}</span>
                      </Box>

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Información de la Reunión
                      </Box>
                      <Box sx={{ p: 0.8, borderBottom: '1px solid #000000', display: 'flex', alignItems: 'center', gap: 1 }}>
                        <strong>Lugar:</strong>
                        {editingActa ? (
                          <TextField size="small" variant="standard" fullWidth value={actaData.lugar} onChange={(e) => setActaField('lugar', e.target.value)} />
                        ) : (
                          <span>{actaData.lugar}</span>
                        )}
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '65% 35%', borderBottom: '1px solid #000000' }}>
                        <Box sx={{ p: 0.8, borderRight: '1px solid #000000', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <strong>Fecha:</strong>
                          {editingActa ? (
                            <TextField size="small" variant="standard" type="date" value={actaData.fecha} onChange={(e) => setActaField('fecha', e.target.value)} />
                          ) : (
                            <span>{actaData.fecha}</span>
                          )}
                        </Box>
                        <Box sx={{ p: 0.8, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <strong>Horario:</strong>
                          {editingActa ? (
                            <TextField size="small" variant="standard" fullWidth value={actaData.horario} onChange={(e) => setActaField('horario', e.target.value)} />
                          ) : (
                            <span>{actaData.horario}</span>
                          )}
                        </Box>
                      </Box>

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Participantes
                      </Box>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '8% 44% 28% 20%', bgcolor: '#f2f2f2', fontWeight: 900, borderBottom: '1px solid #000000', textAlign: 'center', fontSize: 11 }}>
                        <Box sx={{ p: 0.5, borderRight: '1px solid #000000' }}>&nbsp;</Box>
                        <Box sx={{ p: 0.5, borderRight: '1px solid #000000' }}>Nombres y Apellidos</Box>
                        <Box sx={{ p: 0.5, borderRight: '1px solid #000000' }}>Cargo</Box>
                        <Box sx={{ p: 0.5 }}>Firma</Box>
                      </Box>
                      {(actaData.participantes || []).map((p, i) => (
                        <Box key={i} sx={{ display: 'grid', gridTemplateColumns: '8% 44% 28% 20%', borderBottom: '1px solid #000000', minHeight: p.status === 'signed' ? 54 : 32, alignItems: 'center' }}>
                          <Box sx={{ p: 0.5, textAlign: 'center', borderRight: '1px solid #000000', fontWeight: 800 }}>{i + 1}</Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #000000' }}>
                            <span>{p.nombre || '—'}</span>
                          </Box>
                          <Box sx={{ p: 0.5, borderRight: '1px solid #000000' }}>
                            <span>{p.cargo || '—'}</span>
                          </Box>
                          <Box sx={{ p: 0.5, textAlign: 'center', color: p.status === 'signed' ? '#15803d' : '#64748b', fontSize: 10, fontWeight: 800 }}>
                            {p.status === 'signed' ? <Stack alignItems="center" justifyContent="center" spacing={0.15}>
                              {p.signature_preview && <Box component="img" src={p.signature_preview} alt={`Firma de ${p.nombre}`} sx={{ display: 'block', width: '100%', maxWidth: 105, height: 34, objectFit: 'contain' }} />}
                              <Stack direction="row" spacing={0.35} alignItems="center"><CheckCircle sx={{ fontSize: 12 }} /><span>Firmado</span></Stack>
                            </Stack> : 'Pendiente · QR'}
                          </Box>
                        </Box>
                      ))}

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Objetivo
                      </Box>
                      <Box sx={{ p: 0.8, borderBottom: '1px solid #000000', minHeight: 50 }}>
                        {editingActa ? (
                          <RichTextEditor id="strategic-preview-objective" label="Objetivo" value={actaData.objetivo} onChange={(value) => setActaField('objetivo', value)} minHeight={110} />
                        ) : (
                          <Box className="minute-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(actaData.objetivo || '') }} />
                        )}
                      </Box>

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Desarrollo
                      </Box>
                      <Box sx={{ p: 0.8, borderBottom: '1px solid #000000', minHeight: 70 }}>
                        {editingActa ? (
                          <RichTextEditor id="strategic-preview-development" label="Desarrollo" value={actaData.desarrollo} onChange={(value) => setActaField('desarrollo', value)} minHeight={145} />
                        ) : (
                          <Box className="minute-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(actaData.desarrollo || '') }} />
                        )}
                      </Box>

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Conclusiones / Compromisos
                      </Box>
                      <Box sx={{ p: 0.8, minHeight: 50 }}>
                        {editingActa ? (
                          <RichTextEditor id="strategic-preview-conclusions" label="Conclusiones / Compromisos" value={actaData.conclusiones} onChange={(value) => setActaField('conclusiones', value)} minHeight={110} />
                        ) : (
                          <Box className="minute-rich-content" dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(actaData.conclusiones || '') }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                    {latestMinute?.status === 'signing' && !published && (
                      <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 2.5, border: '1px solid #bfdbfe', bgcolor: '#eff6ff' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
                          <Box>
                            <Typography fontWeight={900} color="#1e40af">Proceso de firmas en curso</Typography>
                            <Typography variant="body2" color="#475569">
                              Las firmas para esta versión del acta están habilitadas. Puede abrir la página de firmas o consultar el código QR.
                            </Typography>
                          </Box>
                          <Button
                            variant="contained"
                            size="small"
                            startIcon={<QrCode2 />}
                            onClick={enableQrSigning}
                            sx={{ bgcolor: '#2563eb', textTransform: 'none', fontWeight: 850, borderRadius: 2, whiteSpace: 'nowrap' }}
                          >
                            Ver QR y enlace para firmar
                          </Button>
                        </Stack>
                      </Paper>
                    )}
                    {published && (
                      <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 2.5, border: '1px solid #b8d2ef', bgcolor: '#f4f9ff' }}>
                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
                          <Box component="img" src={published.qr_data_url} alt="QR para firmar el acta" sx={{ width: 142, height: 142, p: 0.75, bgcolor: '#fff', border: '1px solid #d7e3f0', borderRadius: 2 }} />
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography fontWeight={900} color="#17345f">Firmas habilitadas</Typography>
                            <Typography variant="body2" color="#64748b" sx={{ mt: 0.5, mb: 1.5 }}>Los participantes escanean este QR, seleccionan su nombre, validan el correo y firman esta versión del acta.</Typography>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <Button component="a" href={published.signing_url} target="_blank" rel="noreferrer" variant="contained" size="small" sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Abrir página de firma</Button>
                              <Button variant="outlined" size="small" startIcon={<ContentCopy />} onClick={async () => {
                                if (!navigator.clipboard) return enqueueSnackbar('Abra la página de firma para copiar el enlace desde el navegador.', { variant: 'info' });
                                await navigator.clipboard.writeText(published.signing_url); enqueueSnackbar('Enlace de firma copiado.', { variant: 'success' });
                              }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Copiar enlace</Button>
                            </Stack>
                          </Box>
                        </Stack>
                      </Paper>
                    )}
                  </Paper>
                </Box>
              </Box>

              {/* BARRA INFERIOR DE NAVEGACIÓN Y ACCIONES DEL ACTA */}
              <Paper
                elevation={0}
                sx={{
                  p: 1.5,
                  px: { xs: 2, md: 3 },
                  borderRadius: 2.5,
                  bgcolor: '#ffffff',
                  border: '1px solid #dbe5f0',
                  display: 'flex',
                  flexDirection: { xs: 'column-reverse', sm: 'row' },
                  gap: { xs: 1.5, sm: 0 },
                  justifyContent: 'space-between',
                  alignItems: { xs: 'stretch', sm: 'center' },
                  boxShadow: '0 -4px 16px rgba(15,23,42,0.04)'
                }}
              >
                <Button
                  onClick={onClose}
                  variant="text"
                  sx={{ textTransform: 'none', fontWeight: 800, color: '#64748b' }}
                >
                  Cerrar
                </Button>
                <Stack direction="row" spacing={1} alignItems="center" justifyContent={{ xs: 'space-between', sm: 'flex-end' }}>
                  {['pending', 'error'].includes(saveStatus) && (
                    <Button
                      variant="outlined"
                      startIcon={saveStatus === 'error' ? <Refresh /> : <Save />}
                      disabled={saving}
                      onClick={() => saveMeeting(false)}
                      color={saveStatus === 'error' ? 'error' : 'primary'}
                      sx={{ textTransform: 'none', fontWeight: 850, borderRadius: 2 }}
                    >
                      {saveStatus === 'error' ? 'Reintentar guardado' : 'Guardar borrador'}
                    </Button>
                  )}
                  <Button
                    variant="outlined"
                    color="success"
                    startIcon={<HelpOutline />}
                    onClick={handleWhatIsNext}
                    sx={{
                      textTransform: 'none',
                      fontWeight: 850,
                      borderRadius: 2,
                      animation: 'guidePulse 3s ease-in-out infinite',
                      '@keyframes guidePulse': {
                        '0%, 100%': { boxShadow: '0 0 0 0 rgba(22,163,74,0)' },
                        '50%': { boxShadow: '0 0 0 8px rgba(22,163,74,0.2)' }
                      }
                    }}
                  >
                    ¿Qué sigue?
                  </Button>
                </Stack>
              </Paper>
              </Stack>
            )}

            {/* TAB 3: EXPORTACIÓN INSTITUCIONAL */}
            {tab === 'export' && (
              <Stack spacing={3}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 3, md: 4 },
                    borderRadius: 3.5,
                    bgcolor: '#ffffff',
                    borderColor: '#cbd5e1',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                  }}
                >
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'flex-start' }} gap={2.5} mb={3}>
                    <Stack direction="row" spacing={2} alignItems="flex-start">
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 2.5,
                          bgcolor: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          display: 'grid',
                          placeItems: 'center',
                          color: '#059669',
                          flexShrink: 0
                        }}
                      >
                        <ExcelIcon sx={{ fontSize: 30 }} />
                      </Box>
                      <Box>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap mb={0.5}>
                          <Typography variant="h6" fontWeight={900} color="#0f172a" sx={{ fontSize: { xs: 18, md: 20 } }}>
                            Plan de Acción Oficial DIR-PE-FR-003
                          </Typography>
                          <Chip
                            label="Formato Normativo Institucional"
                            size="small"
                            sx={{ fontWeight: 800, bgcolor: '#e0f2fe', color: '#0369a1', fontSize: 11.5 }}
                          />
                        </Stack>
                        <Typography variant="body2" color="#64748b">
                          Matriz institucional oficial en formato Excel (.xlsx).
                        </Typography>
                      </Box>
                    </Stack>

                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems="stretch">
                      <Button
                        variant="outlined"
                        color="primary"
                        startIcon={<Visibility />}
                        onClick={() => setPreviewPlanModalOpen(true)}
                        sx={{
                          height: 44,
                          px: 2.5,
                          borderRadius: 2.5,
                          fontWeight: 850,
                          textTransform: 'none',
                          borderColor: '#3b82f6',
                          color: '#1d4ed8',
                          '&:hover': { borderColor: '#1d4ed8', bgcolor: '#eff6ff' }
                        }}
                      >
                        Previsualizar Plan de Acción
                      </Button>
                      <Button
                        variant="contained"
                        startIcon={<Download />}
                        onClick={exportPlan}
                        sx={{
                          height: 44,
                          px: 2.5,
                          borderRadius: 2.5,
                          fontWeight: 900,
                          textTransform: 'none',
                          bgcolor: '#16a34a',
                          '&:hover': { bgcolor: '#15803d' }
                        }}
                      >
                        Exportar DIR-PE-FR-003 (.xlsx)
                      </Button>
                    </Stack>
                  </Stack>

                  {/* SECCIÓN SINCRONIZACIÓN AUTOMÁTICA EN GOOGLE DRIVE */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      bgcolor: '#f0fdf4',
                      borderColor: '#bbf7d0'
                    }}
                  >
                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
                      <Stack direction="row" spacing={2} alignItems="center">
                        <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #86efac', display: 'grid', placeItems: 'center', color: '#16a34a', flexShrink: 0 }}>
                          <Folder sx={{ fontSize: 26 }} />
                        </Box>
                        <Box>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                            <Typography fontWeight={900} color="#14532d" sx={{ fontSize: 15 }}>
                              Carpeta Drive: PLAN DE ACCIÓN OFICIAL DIR-PE-FR-003
                            </Typography>
                            <Chip
                              label="100% Automático"
                              size="small"
                              sx={{
                                fontWeight: 800,
                                bgcolor: '#dcfce7',
                                color: '#15803d',
                                fontSize: 11
                              }}
                            />
                          </Stack>
                          <Typography variant="body2" color="#166534" sx={{ mt: 0.25, fontSize: 13 }}>
                            <strong>DIR-PE-FR-003_{detail?.code}_{detail?.term?.year}.xlsx</strong>
                            {detail?.metadata?.drive_sync?.synced_at && (
                              <span> · Actualizado: {new Date(detail.metadata.drive_sync.synced_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            )}
                          </Typography>
                        </Box>
                      </Stack>

                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                        {syncingDriveExcel ? (
                          <Chip
                            icon={<CircularProgress size={16} color="inherit" />}
                            label="Sincronizando con Drive..."
                            size="medium"
                            sx={{
                              fontWeight: 800,
                              bgcolor: '#e0f2fe',
                              color: '#0369a1',
                              height: 38,
                              borderRadius: 2.5
                            }}
                          />
                        ) : detail?.metadata?.drive_sync?.storage_quota_limited ? (
                          <Tooltip title="La carpeta está creada en Google Drive. Para alojar directamente el archivo Excel, configure el Refresh Token OAuth (PLAN_ACTION_GOOGLE_REFRESH_TOKEN) en el servidor.">
                            <Chip
                              icon={<Folder sx={{ color: '#d97706 !important', fontSize: 20 }} />}
                              label="Carpeta oficial lista en Drive"
                              size="medium"
                              sx={{
                                fontWeight: 800,
                                bgcolor: '#fef3c7',
                                color: '#b45309',
                                height: 38,
                                borderRadius: 2.5,
                                px: 0.5
                              }}
                            />
                          </Tooltip>
                        ) : (
                          <Chip
                            icon={<CheckCircle sx={{ color: '#16a34a !important', fontSize: 20 }} />}
                            label="Sincronizado automáticamente"
                            size="medium"
                            sx={{
                              fontWeight: 800,
                              bgcolor: '#dcfce7',
                              color: '#15803d',
                              height: 38,
                              borderRadius: 2.5,
                              px: 0.5
                            }}
                          />
                        )}
                        {detail?.metadata?.drive_sync?.folder_id && (
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<OpenInNew />}
                            href={`https://drive.google.com/drive/folders/${detail.metadata.drive_sync.folder_id}`}
                            target="_blank"
                            rel="noreferrer"
                            sx={{
                              height: 38,
                              borderRadius: 2.5,
                              textTransform: 'none',
                              fontWeight: 800,
                              borderColor: '#86efac',
                              color: '#15803d',
                              bgcolor: '#fff',
                              '&:hover': { bgcolor: '#f0fdf4', borderColor: '#16a34a' }
                            }}
                          >
                            Abrir en Drive
                          </Button>
                        )}
                        <Tooltip title="Actualizar en Google Drive">
                          <IconButton
                            size="small"
                            disabled={syncingDriveExcel}
                            onClick={handleSyncDriveExcel}
                            sx={{
                              width: 38,
                              height: 38,
                              bgcolor: '#ffffff',
                              border: '1px solid #86efac',
                              color: '#15803d',
                              '&:hover': { bgcolor: '#ecfdf5' }
                            }}
                          >
                            <Sync sx={{ fontSize: 20 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </Stack>
                  </Paper>
                </Paper>

                {/* TABLA DE ACTAS DE REUNIÓN VINCULADAS AL PLAN (CONSULTA DRIVE) */}
                <Paper
                  elevation={0}
                  sx={{
                    borderRadius: 3.5,
                    bgcolor: '#ffffff',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
                    overflow: 'hidden'
                  }}
                >
                  {/* BUSCADOR Y RESUMEN */}
                  <Box sx={{ p: { xs: 1.5, sm: 2 }, borderBottom: '1px solid #f1f5f9' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <Typography sx={{ fontWeight: 800, fontSize: 13, color: '#334155' }}>
                        Mostrando <b>{filteredActas.length}</b> actas oficiales COM-IF-FR-002 registradas
                      </Typography>
                      <TextField
                        size="small"
                        placeholder="Buscar acta por reunión, fecha..."
                        value={minuteSearch}
                        onChange={(e) => setMinuteSearch(e.target.value)}
                        InputProps={{
                          startAdornment: (
                            <InputAdornment position="start">
                              <Search sx={{ color: '#94a3b8', fontSize: 18 }} />
                            </InputAdornment>
                          )
                        }}
                        sx={{
                          width: { xs: '100%', sm: 320 },
                          '& .MuiOutlinedInput-root': { borderRadius: 2.2, bgcolor: '#ffffff', fontSize: 12.5, height: 36 }
                        }}
                      />
                    </Stack>
                  </Box>

                  {/* TIRA INSTITUCIONAL (FILA 5 EXCEL) */}
                  <Box
                    sx={{
                      p: 1.25,
                      px: 2.5,
                      bgcolor: '#f5f3ff',
                      borderBottom: '2px solid #7e22ce',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: 1
                    }}
                  >
                    <Typography sx={{ fontWeight: 900, fontSize: 13, color: '#581c87', letterSpacing: 0.5 }}>
                      {`ACTAS DE REUNIÓN · ${(detail?.organizationalUnit?.name || detail?.title || 'PLAN DE ACCIÓN').toUpperCase()}`}
                    </Typography>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      {isPlanningAdmin && (
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<FolderSharedIcon sx={{ fontSize: 14 }} />}
                          onClick={handleOpenMinutesFolder}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 850,
                            fontSize: 11,
                            borderRadius: 2,
                            py: 0.3,
                            px: 1.4,
                            bgcolor: '#7e22ce',
                            color: '#ffffff',
                            boxShadow: 'none',
                            '&:hover': { bgcolor: '#6b21a8' }
                          }}
                        >
                          Carpeta en Google Drive
                        </Button>
                      )}
                      <Typography sx={{ fontSize: 11, fontWeight: 800, color: '#7e22ce' }}>
                        FORMATO OFICIAL DIR-PE-FR-003 · ACTAS DE REUNIÓN
                      </Typography>
                    </Stack>
                  </Box>

                  <TableContainer sx={{ maxHeight: '65vh', overflowX: 'auto' }}>
                    <Table stickyHeader size="small" sx={{ minWidth: 980 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell align="center" sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, textAlign: 'center', width: 55, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            NO.
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, width: 140, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            DOCUMENTO
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, minWidth: 260, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            REUNIÓN / ASUNTO
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, width: 130, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            TIPO
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, width: 130, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            FECHA
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, width: 90, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            VERSIÓN
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, width: 180, py: 1.2, borderRight: '1px solid rgba(255,255,255,0.2)' }}>
                            ESTADO
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#4c1d95', color: '#ffffff', fontWeight: 900, fontSize: 11, width: 220, py: 1.2 }}>
                            CONSULTA EN REPOSITORIO
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredActas.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={8} sx={{ textAlign: 'center', py: 6, color: '#64748b' }}>
                              <Stack spacing={1.5} alignItems="center" justifyContent="center">
                                <Description sx={{ fontSize: 48, color: '#cbd5e1' }} />
                                <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#334155' }}>
                                  No hay actas registradas para este plan de acción
                                </Typography>
                                <Typography sx={{ fontSize: 12, color: '#64748b', maxWidth: 480 }}>
                                  Las actas generadas en la Etapa 2 (Concertación) o en las reuniones de seguimiento se sincronizan en Google Drive y aparecerán listadas aquí para su consulta directa.
                                </Typography>
                                <Button
                                  size="small"
                                  variant="outlined"
                                  startIcon={<FolderSharedIcon sx={{ fontSize: 15 }} />}
                                  onClick={handleOpenMinutesFolder}
                                  sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, mt: 1, borderColor: '#c084fc', color: '#7e22ce' }}
                                >
                                  Ver Carpeta de Actas en Google Drive
                                </Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ) : (
                          filteredActas.slice(actasPage * actasRowsPerPage, actasPage * actasRowsPerPage + actasRowsPerPage).map((acta, idx) => (
                            <TableRow key={acta.id || idx} hover sx={{ '&:hover': { bgcolor: '#faf5ff' } }}>
                              <TableCell align="center" sx={{ fontWeight: 800, color: '#475569', fontSize: 11.5, verticalAlign: 'middle', py: 1.2 }}>
                                {actasPage * actasRowsPerPage + idx + 1}
                              </TableCell>
                              <TableCell sx={{ verticalAlign: 'middle', py: 1.2 }}>
                                <Chip
                                  size="small"
                                  label="COM-IF-FR-002"
                                  sx={{ fontWeight: 850, fontSize: 10.5, bgcolor: '#f3e8ff', color: '#6b21a8', height: 22 }}
                                />
                              </TableCell>
                              <TableCell sx={{ verticalAlign: 'middle', py: 1.2 }}>
                                <Typography sx={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a' }}>
                                  {acta.meetingTitle}
                                </Typography>
                              </TableCell>
                              <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2 }}>
                                <Chip
                                  size="small"
                                  label={acta.meetingType === 'concertation' ? 'Concertación' : 'Seguimiento'}
                                  sx={{
                                    fontWeight: 750,
                                    fontSize: 10,
                                    height: 20,
                                    bgcolor: acta.meetingType === 'concertation' ? '#eff6ff' : '#f0fdf4',
                                    color: acta.meetingType === 'concertation' ? '#1d4ed8' : '#15803d'
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ fontSize: 11.5, color: '#475569', verticalAlign: 'middle', py: 1.2 }}>
                                {formatFecha(acta.finalizedAt || acta.meetingDate)}
                              </TableCell>
                              <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2 }}>
                                <Chip
                                  size="small"
                                  label={`v${acta.version}.0`}
                                  sx={{ fontWeight: 800, fontSize: 10.5, height: 20, bgcolor: '#f1f5f9', color: '#334155' }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2 }}>
                                <Chip
                                  size="small"
                                  icon={<CheckCircle sx={{ fontSize: '13px !important', color: (acta.status === 'finalized' ? '#15803d' : '#92400e') + ' !important' }} />}
                                  label={acta.status === 'finalized' ? 'Formalizada en Repositorio' : (acta.status === 'signing' ? 'En Firma por Correo' : 'Borrador')}
                                  sx={{
                                    fontWeight: 800,
                                    fontSize: 10.5,
                                    height: 22,
                                    bgcolor: acta.status === 'finalized' ? '#dcfce7' : '#fef3c7',
                                    color: acta.status === 'finalized' ? '#15803d' : '#92400e'
                                  }}
                                />
                              </TableCell>
                              <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2 }}>
                                <Stack direction="row" spacing={1} justifyContent="center" alignItems="center">
                                  {isPlanningAdmin && (acta.driveUrl || acta.driveFileId) && (
                                    <Button
                                      size="small"
                                      variant="contained"
                                      startIcon={<InsertDriveFile sx={{ fontSize: 14 }} />}
                                      onClick={() => window.open(acta.driveUrl || `https://drive.google.com/file/d/${acta.driveFileId}/view`, '_blank', 'noopener,noreferrer')}
                                      sx={{
                                        textTransform: 'none',
                                        fontWeight: 850,
                                        fontSize: 11,
                                        py: 0.4,
                                        px: 1.2,
                                        borderRadius: 2,
                                        bgcolor: '#15803d',
                                        boxShadow: 'none',
                                        '&:hover': { bgcolor: '#166534' }
                                      }}
                                    >
                                      Ver en Drive
                                    </Button>
                                  )}
                                  <Button
                                    size="small"
                                    variant="outlined"
                                    startIcon={<Visibility sx={{ fontSize: 14 }} />}
                                    onClick={() => {
                                      if (acta.minuteId) {
                                        handlePreviewMinute(acta.minuteId, acta.meetingTitle);
                                      } else if (acta.meetingId) {
                                        setSelectedMeetingId(String(acta.meetingId));
                                        setTab('meeting');
                                        enqueueSnackbar('Abriendo borrador del acta en la Etapa 2.', { variant: 'info' });
                                      }
                                    }}
                                    sx={{
                                      textTransform: 'none',
                                      fontWeight: 850,
                                      fontSize: 11,
                                      py: 0.4,
                                      px: 1,
                                      borderRadius: 2,
                                      borderColor: '#cbd5e1',
                                      color: '#334155',
                                      '&:hover': { bgcolor: '#f8fafc', borderColor: '#94a3b8' }
                                    }}
                                  >
                                    Visor
                                  </Button>
                                </Stack>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <TablePagination
                    component="div"
                    count={filteredActas.length}
                    page={actasPage}
                    onPageChange={(_, newPage) => setActasPage(newPage)}
                    rowsPerPage={actasRowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setActasRowsPerPage(parseInt(e.target.value, 10));
                      setActasPage(0);
                    }}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    labelRowsPerPage="Filas por página:"
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`}
                    sx={{
                      borderTop: '1px solid #e2e8f0',
                      bgcolor: '#ffffff',
                      '.MuiTablePagination-toolbar': { minHeight: 48, px: 2 },
                      '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: 12.5, fontWeight: 700, color: '#475569' }
                    }}
                  />
                </Paper>
              </Stack>
            )}

            {/* TAB 4: FLUJO Y SEGUIMIENTOS S1/S2 */}
            {tab === 'workflow' && (
              <Stack gap={2.5}>
                {/* BARRA COMPACTA INSTITUCIONAL DE ESTADO Y TRANSICIONES */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 2.25 },
                    borderRadius: 3,
                    bgcolor: '#ffffff',
                    borderColor: '#e2e8f0',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', md: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    gap={2}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" spacing={1.25} flexWrap="wrap" useFlexGap mb={0.5}>
                        <Typography sx={{ fontSize: 14, fontWeight: 900, color: '#1e293b' }}>
                          Estado del Plan de Acción:
                        </Typography>
                        <Chip
                          size="small"
                          label={STATUS_LABELS[detail.status] || detail.status}
                          sx={{
                            fontWeight: 900,
                            fontSize: 11.5,
                            bgcolor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe'
                          }}
                        />
                      </Stack>
                      <Typography variant="body2" sx={{ color: '#64748b', fontSize: 12.5 }}>
                        Seguimiento semestral activo. Las transiciones de ciclo y cierres de vigencia quedan registradas con trazabilidad institucional.
                      </Typography>
                    </Box>

                    <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25} sx={{ width: { xs: '100%', sm: 'auto' }, flexShrink: 0 }} alignItems="center">
                      <Button
                        variant="outlined"
                        startIcon={<CalendarMonth />}
                        onClick={() => setCalendarSchedulerOpen(true)}
                        sx={{
                          borderRadius: 2,
                          fontWeight: 850,
                          px: 2,
                          py: 0.8,
                          textTransform: 'none',
                          fontSize: 13,
                          borderColor: '#93c5fd',
                          color: '#1d4ed8',
                          bgcolor: '#f0f9ff',
                          boxShadow: '0 1px 3px rgba(37,99,235,0.08)',
                          '&:hover': { bgcolor: '#e0effe', borderColor: '#60a5fa' }
                        }}
                      >
                        Programar reunión de seguimiento
                      </Button>
                      {availableTransitions.map((entry) => (
                        <Button
                          key={entry.action}
                          variant="contained"
                          startIcon={<PlayArrow />}
                          onClick={() => transition(entry.action)}
                          sx={{
                            borderRadius: 2,
                            fontWeight: 850,
                            px: 2.5,
                            py: 0.8,
                            textTransform: 'none',
                            fontSize: 13,
                            bgcolor: '#2563eb',
                            boxShadow: '0 2px 6px rgba(37,99,235,0.25)',
                            '&:hover': { bgcolor: '#1d4ed8' }
                          }}
                        >
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Button>
                      ))}
                    </Stack>
                  </Stack>
                </Paper>

                {/* TABLERO ESTADÍSTICO DE MONITOREO Y CUMPLIMIENTO (Colores pastel institucionales, 100% responsive) */}
                <Box
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: {
                      xs: '1fr',
                      sm: 'repeat(2, minmax(0, 1fr))',
                      md: 'repeat(4, minmax(0, 1fr))'
                    },
                    gap: 2,
                    width: '100%'
                  }}
                >
                  {/* Card 1: Total Actividades (Cielo Pastel) */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 2, sm: 2.25, md: 2.5 },
                      minHeight: 104,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      borderRadius: 3,
                      bgcolor: '#f0f9ff',
                      border: '1px solid #bae6fd',
                      boxShadow: '0 2px 8px rgba(14,165,233,0.06)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(14,165,233,0.12)' }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: '#0369a1', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Total Actividades
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 24, sm: 26, md: 30 }, fontWeight: 900, color: '#0c4a6e', mt: 0.2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {kpiStats.totalActivities}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#0284c7', fontWeight: 600, fontSize: 11.5, mt: 0.3, display: 'block' }}>
                          Plan de trabajo activo
                        </Typography>
                      </Box>
                      <Box sx={{ width: 50, height: 50, borderRadius: 2.5, bgcolor: '#e0f2fe', color: '#0284c7', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <AssignmentTurnedIn sx={{ fontSize: 26 }} />
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Card 2: Cumplimiento Global (Menta Pastel) */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 2, sm: 2.25, md: 2.5 },
                      minHeight: 104,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      borderRadius: 3,
                      bgcolor: '#f0fdf4',
                      border: '1px solid #bbf7d0',
                      boxShadow: '0 2px 8px rgba(16,185,129,0.06)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(16,185,129,0.12)' }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: '#15803d', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Cumplimiento Global
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 24, sm: 26, md: 30 }, fontWeight: 900, color: '#064e3b', mt: 0.2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {kpiStats.avgProgress}%
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#16a34a', fontWeight: 600, fontSize: 11.5, mt: 0.3, display: 'block' }}>
                          {kpiStats.completedActivities} de {kpiStats.totalActivities} completadas
                        </Typography>
                      </Box>
                      <Box sx={{ width: 50, height: 50, borderRadius: 2.5, bgcolor: '#dcfce7', color: '#16a34a', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <TrendingUp sx={{ fontSize: 26 }} />
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Card 3: Evidencias Radicadas (Lavanda Pastel) */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 2, sm: 2.25, md: 2.5 },
                      minHeight: 104,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      borderRadius: 3,
                      bgcolor: '#faf5ff',
                      border: '1px solid #e9d5ff',
                      boxShadow: '0 2px 8px rgba(168,85,247,0.06)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(168,85,247,0.12)' }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: '#7e22ce', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Evidencias Radicadas
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 24, sm: 26, md: 30 }, fontWeight: 900, color: '#581c87', mt: 0.2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {kpiStats.totalEvidences}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#9333ea', fontWeight: 600, fontSize: 11.5, mt: 0.3, display: 'block' }}>
                          Soportes cargados
                        </Typography>
                      </Box>
                      <Box sx={{ width: 50, height: 50, borderRadius: 2.5, bgcolor: '#ede9fe', color: '#9333ea', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <AttachFile sx={{ fontSize: 26 }} />
                      </Box>
                    </Stack>
                  </Paper>

                  {/* Card 4: Actividades en Curso (Ámbar Pastel) */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 2, sm: 2.25, md: 2.5 },
                      minHeight: 104,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      borderRadius: 3,
                      bgcolor: '#fffbeb',
                      border: '1px solid #fde68a',
                      boxShadow: '0 2px 8px rgba(245,158,11,0.06)',
                      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 16px rgba(245,158,11,0.12)' }
                    }}
                  >
                    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1.5}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: 11 }}>
                          Actividades en Curso
                        </Typography>
                        <Typography sx={{ fontSize: { xs: 24, sm: 26, md: 30 }, fontWeight: 900, color: '#78350f', mt: 0.2, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                          {kpiStats.pendingActivities}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#d97706', fontWeight: 600, fontSize: 11.5, mt: 0.3, display: 'block' }}>
                          Pendientes por culminar
                        </Typography>
                      </Box>
                      <Box sx={{ width: 50, height: 50, borderRadius: 2.5, bgcolor: '#fef3c7', color: '#d97706', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <HourglassBottom sx={{ fontSize: 26 }} />
                      </Box>
                    </Stack>
                  </Paper>
                </Box>

                {/* TABLA DEL PLAN DE TRABAJO Y SEGUIMIENTOS DINÁMICOS */}
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 3.5,
                    bgcolor: '#ffffff',
                    borderColor: '#e2e8f0',
                    boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
                  }}
                >
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    justifyContent="space-between"
                    alignItems={{ xs: 'flex-start', sm: 'center' }}
                    gap={2}
                    mb={2}
                  >
                    <Box>
                      <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
                        <Typography variant="h6" fontWeight={900} color="#0f172a" sx={{ fontSize: { xs: 15, sm: 16 } }}>
                          Plan de Trabajo y Cumplimiento de Actividades
                        </Typography>
                        <Chip
                          size="small"
                          label={`${tab4FilteredItems.length} actividades`}
                          sx={{ bgcolor: '#e2e8f0', color: '#334155', fontWeight: 800, fontSize: 11, height: 22 }}
                        />
                      </Stack>
                      <Typography variant="body2" color="#64748b" sx={{ fontSize: 12.5, mt: 0.3 }}>
                        Seguimiento dinámico por periodos, consulta de evidencias cargadas y valoración oficial de Planeación.
                      </Typography>
                    </Box>
                    <TextField
                      size="small"
                      placeholder="Buscar por código o actividad..."
                      value={activitySearch}
                      onChange={(e) => setActivitySearch(e.target.value)}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <Search sx={{ color: '#94a3b8', fontSize: 18 }} />
                          </InputAdornment>
                        ),
                        sx: { borderRadius: 2, fontSize: 13, minWidth: { xs: '100%', sm: 260 }, bgcolor: '#f8fafc' }
                      }}
                      sx={{ width: { xs: '100%', sm: 'auto' } }}
                    />
                  </Stack>

                  <TableContainer sx={{ maxHeight: 500, border: '1px solid #e2e8f0', borderRadius: 2, overflowX: 'auto' }}>
                    <Table stickyHeader size="small" sx={{ minWidth: 1020 }}>
                      <TableHead>
                        <TableRow>
                          <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 95, py: 1.2, px: 1, fontSize: 11.5 }}>
                            Código
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', minWidth: 200, maxWidth: { xs: 230, sm: 280, md: 320 }, py: 1.2, px: 1.5, fontSize: 11.5 }}>
                            Actividad
                          </TableCell>
                          <TableCell sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 170, py: 1.2, px: 1.5, fontSize: 11.5 }}>
                            Indicador y Meta
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 115, py: 1.2, px: 1, fontSize: 11.5 }}>
                            Plazo
                          </TableCell>
                          {periods.map((p, pIdx) => {
                            const isS1 = (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || '') || pIdx === 0;
                            const isS2 = (p.code || '').toUpperCase() === 'S2' || /2|seg/i.test(p.name || '') || pIdx === 1;
                            const title = isS1 ? 'AVANCE S1' : (isS2 ? 'AVANCE S2' : `AVANCE ${p.code || p.name}`);
                            const subtitle = isS1 ? '(1 ENE - 31 JUL)' : (isS2 ? '(1 AGO - 31 DIC)' : '');
                            return (
                              <TableCell
                                key={p.id}
                                align="center"
                                sx={{
                                  bgcolor: '#f1f5f9',
                                  color: '#1e293b',
                                  width: 125,
                                  minWidth: 115,
                                  py: 0.8,
                                  px: 0.5,
                                  borderRight: '1px solid #cbd5e1'
                                }}
                              >
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                  <Typography sx={{ fontWeight: 800, fontSize: 11, lineHeight: 1.2, color: '#1e293b' }}>
                                    {title}
                                  </Typography>
                                  {subtitle && (
                                    <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#64748b', lineHeight: 1.15, mt: 0.25, whiteSpace: 'nowrap' }}>
                                      {subtitle}
                                    </Typography>
                                  )}
                                </Box>
                              </TableCell>
                            );
                          })}
                          <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 125, minWidth: 115, py: 1.2, px: 1, fontSize: 11.5 }}>
                            Cumplimiento
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 105, py: 1.2, px: 0.5, fontSize: 11.5 }}>
                            Evidencias
                          </TableCell>
                          <TableCell align="center" sx={{ bgcolor: '#f1f5f9', fontWeight: 800, color: '#1e293b', width: 100, py: 1.2, px: 1, fontSize: 11.5 }}>
                            Acción
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {tab4FilteredItems.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={6 + periods.length} align="center" sx={{ py: 4, color: '#64748b', fontSize: 12 }}>
                              {activitySearch ? 'No se encontraron actividades con ese criterio de búsqueda.' : 'No hay actividades registradas en este plan.'}
                            </TableCell>
                          </TableRow>
                        ) : (
                          tab4FilteredItems.slice(tab4Page * tab4RowsPerPage, tab4Page * tab4RowsPerPage + tab4RowsPerPage).map((it) => {
                            const evidences = it.evidence || [];
                            // Cálculo de cumplimiento de la actividad
                            const validResults = (it.monitoringResults || []).filter((r) => r.physical_progress !== null && r.physical_progress !== undefined && !isNaN(Number(r.physical_progress)));
                            let compProg = null;
                            if (validResults.length > 0) {
                              compProg = validResults.reduce((acc, r) => acc + Number(r.physical_progress || 0), 0);
                            } else if (it.current_progress !== undefined && it.current_progress !== null && !isNaN(Number(it.current_progress))) {
                              compProg = Number(it.current_progress);
                            }

                            return (
                              <TableRow key={it.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' }, borderBottom: '1px solid #f1f5f9' }}>
                                {/* Código centrado */}
                                <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2, px: 1 }}>
                                  <Chip
                                    size="small"
                                    label={it.code || '—'}
                                    sx={{ fontWeight: 800, bgcolor: '#e2e8f0', color: '#1e293b', fontSize: 11, height: 24, borderRadius: 1 }}
                                  />
                                </TableCell>
                                {/* Actividad centrada verticalmente con límite de ancho y 2 líneas */}
                                <TableCell sx={{ verticalAlign: 'middle', py: 1.2, px: 1.5, minWidth: 200, maxWidth: { xs: 230, sm: 280, md: 320 } }}>
                                  <Tooltip title={it.activity} arrow placement="top-start">
                                    <Typography
                                      sx={{
                                        fontSize: 12.5,
                                        fontWeight: 700,
                                        color: '#0f172a',
                                        lineHeight: 1.35,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        cursor: 'pointer'
                                      }}
                                    >
                                      {it.activity}
                                    </Typography>
                                  </Tooltip>
                                  {it.macroactivity && (
                                    <Typography
                                      sx={{
                                        fontSize: 11,
                                        color: '#64748b',
                                        mt: 0.3,
                                        display: '-webkit-box',
                                        WebkitLineClamp: 1,
                                        WebkitBoxOrient: 'vertical',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis'
                                      }}
                                    >
                                      PED: {it.macroactivity}
                                    </Typography>
                                  )}
                                </TableCell>
                                {/* Indicador y Meta centrado verticalmente */}
                                <TableCell sx={{ verticalAlign: 'middle', py: 1.2, px: 1.5 }}>
                                  <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#334155', lineHeight: 1.3 }}>
                                    {it.indicator || 'Sin indicador'}
                                  </Typography>
                                  <Typography sx={{ fontSize: 11.5, color: '#059669', fontWeight: 700, mt: 0.3 }}>
                                    Meta: {it.target || '100%'}
                                  </Typography>
                                </TableCell>
                                {/* Plazo centrado */}
                                <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2, px: 1 }}>
                                  <Typography sx={{ fontSize: 11, color: '#475569', lineHeight: 1.35 }}>
                                    {formatFecha(it.starts_on)}
                                    <br />
                                    al {formatFecha(it.ends_on)}
                                  </Typography>
                                </TableCell>
                                {/* Columnas dinámicas de periodos centradas */}
                                {periods.map((p) => {
                                  const res = (it.monitoringResults || []).find((r) => r.monitoring_period_id === p.id);
                                  const prog = res ? Number(res.physical_progress || 0) : null;
                                  const applies = isPeriodApplicableToItem(it, p);
                                  return (
                                    <TableCell key={p.id} align="center" sx={{ verticalAlign: 'middle', py: 1.2, px: 0.5 }}>
                                      {res && prog !== null ? (
                                        <Tooltip title={res.observations ? `Obs: ${res.observations}` : `Avance ${p.code}: ${prog}%`} arrow>
                                          <Chip
                                            size="small"
                                            label={`${prog}%`}
                                            sx={{
                                              fontWeight: 800,
                                              fontSize: 11.5,
                                              height: 24,
                                              borderRadius: 1,
                                              bgcolor: prog >= 100 ? '#dcfce7' : (prog > 0 ? '#fef3c7' : '#f1f5f9'),
                                              color: prog >= 100 ? '#15803d' : (prog > 0 ? '#b45309' : '#64748b')
                                            }}
                                          />
                                        </Tooltip>
                                      ) : applies ? (
                                        <Typography sx={{ fontSize: 12, color: '#94a3b8' }}>—</Typography>
                                      ) : (
                                        <Tooltip title="Actividad no programada para este período según sus fechas de ejecución" arrow>
                                          <Chip
                                            size="small"
                                            label="N/A"
                                            sx={{
                                              fontSize: 10,
                                              fontWeight: 700,
                                              height: 20,
                                              borderRadius: 1,
                                              bgcolor: '#f1f5f9',
                                              color: '#94a3b8',
                                              border: '1px dashed #cbd5e1',
                                              cursor: 'help'
                                            }}
                                          />
                                        </Tooltip>
                                      )}
                                    </TableCell>
                                  );
                                })}

                                {/* COLUMNA DE CUMPLIMIENTO (100% verde, <100% cuánto falta, >100% verde fuerte con borde de revisión) */}
                                <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2, px: 1 }}>
                                  {compProg !== null && compProg > 100 ? (
                                    <Tooltip title={`Sobrecumplimiento (${compProg}%). Superó el 100% de la meta. Requiere revisión para evaluar aumento de meta o formalizar cierre con excedente.`} arrow>
                                      <Stack alignItems="center" spacing={0.3}>
                                        <Chip
                                          size="small"
                                          icon={<PriorityHigh sx={{ fontSize: '13px !important', color: '#f59e0b !important', fontWeight: 900 }} />}
                                          label={`${compProg}%`}
                                          sx={{
                                            fontWeight: 900,
                                            fontSize: 11.5,
                                            height: 25,
                                            borderRadius: 1.5,
                                            bgcolor: '#064e3b', // Verde más fuerte
                                            color: '#ecfdf5',
                                            border: '1.5px dashed #f59e0b', // Borde de revisión
                                            boxShadow: '0 1px 4px rgba(6,78,59,0.25)',
                                            cursor: 'help'
                                          }}
                                        />
                                        <Typography sx={{ fontSize: 9.5, fontWeight: 800, color: '#b45309', lineHeight: 1.1 }}>
                                          Revisar meta
                                        </Typography>
                                      </Stack>
                                    </Tooltip>
                                  ) : compProg !== null && compProg === 100 ? (
                                    <Tooltip title="¡Meta cumplida al 100%!" arrow>
                                      <Stack alignItems="center" spacing={0.3}>
                                        <Chip
                                          size="small"
                                          icon={<CheckCircle sx={{ fontSize: '14px !important', color: '#16a34a !important' }} />}
                                          label="100%"
                                          sx={{
                                            fontWeight: 850,
                                            fontSize: 11.5,
                                            height: 24,
                                            borderRadius: 1.2,
                                            bgcolor: '#dcfce7', // Verde institucional
                                            color: '#15803d',
                                            border: '1px solid #86efac'
                                          }}
                                        />
                                        <Typography sx={{ fontSize: 9.5, fontWeight: 750, color: '#15803d', lineHeight: 1.1 }}>
                                          Completada
                                        </Typography>
                                      </Stack>
                                    </Tooltip>
                                  ) : compProg !== null && compProg > 0 ? (
                                    <Tooltip title={`Avance actual: ${compProg}%. Falta ${Number((100 - compProg).toFixed(1))}% para culminar la meta del 100%.`} arrow>
                                      <Stack alignItems="center" spacing={0.3}>
                                        <Chip
                                          size="small"
                                          label={`${compProg}%`}
                                          sx={{
                                            fontWeight: 800,
                                            fontSize: 11.5,
                                            height: 24,
                                            borderRadius: 1.2,
                                            bgcolor: '#fffbeb',
                                            color: '#b45309',
                                            border: '1px solid #fde68a'
                                          }}
                                        />
                                        <Typography sx={{ fontSize: 9.5, fontWeight: 750, color: '#b45309', lineHeight: 1.1 }}>
                                          Falta {Number((100 - compProg).toFixed(0))}%
                                        </Typography>
                                      </Stack>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip title="Sin avances registrados aún. Falta el 100% de la meta." arrow>
                                      <Stack alignItems="center" spacing={0.3}>
                                        <Chip
                                          size="small"
                                          label="0%"
                                          sx={{
                                            fontWeight: 750,
                                            fontSize: 11,
                                            height: 22,
                                            borderRadius: 1.2,
                                            bgcolor: '#f1f5f9',
                                            color: '#64748b',
                                            border: '1px solid #cbd5e1'
                                          }}
                                        />
                                        <Typography sx={{ fontSize: 9.5, fontWeight: 700, color: '#94a3b8', lineHeight: 1.1 }}>
                                          Falta 100%
                                        </Typography>
                                      </Stack>
                                    </Tooltip>
                                  )}
                                </TableCell>

                                {/* Evidencias cargadas centradas */}
                                <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2, px: 0.5 }}>
                                  {evidences.length > 0 ? (
                                    <Tooltip title="Clic para ver y descargar las evidencias cargadas" arrow>
                                      <Chip
                                        size="small"
                                        icon={<AttachFile sx={{ fontSize: 14 }} />}
                                        label={`${evidences.length} arch.`}
                                        onClick={() => handleOpenEvidenceModal(it)}
                                        sx={{
                                          cursor: 'pointer',
                                          fontWeight: 800,
                                          fontSize: 11.5,
                                          height: 24,
                                          borderRadius: 1,
                                          bgcolor: '#e0e7ff',
                                          color: '#4338ca',
                                          transition: 'all 0.15s ease',
                                          '&:hover': { bgcolor: '#c7d2fe' }
                                        }}
                                      />
                                    </Tooltip>
                                  ) : (
                                    <Typography sx={{ fontSize: 11, color: '#94a3b8' }}>Sin soportes</Typography>
                                  )}
                                </TableCell>
                                {/* Acción Valorar centrada */}
                                <TableCell align="center" sx={{ verticalAlign: 'middle', py: 1.2, px: 1 }}>
                                  <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<EditNote sx={{ fontSize: 16 }} />}
                                    onClick={() => handleOpenEvalModal(it)}
                                    sx={{
                                      borderRadius: 2,
                                      textTransform: 'none',
                                      fontWeight: 850,
                                      fontSize: 12,
                                      py: 0.5,
                                      px: 1.5,
                                      bgcolor: '#2563eb',
                                      boxShadow: '0 2px 6px rgba(37,99,235,0.22)',
                                      '&:hover': { bgcolor: '#1d4ed8', boxShadow: '0 4px 10px rgba(37,99,235,0.3)' }
                                    }}
                                  >
                                    Valorar
                                  </Button>
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
                    count={tab4FilteredItems.length}
                    page={tab4Page}
                    onPageChange={(_, newPage) => setTab4Page(newPage)}
                    rowsPerPage={tab4RowsPerPage}
                    onRowsPerPageChange={(e) => {
                      setTab4RowsPerPage(parseInt(e.target.value, 10));
                      setTab4Page(0);
                    }}
                    rowsPerPageOptions={[5, 10, 20, 50]}
                    labelRowsPerPage="Filas por página:"
                    labelDisplayedRows={({ from, to, count }) => `${from}–${to} de ${count !== -1 ? count : `más de ${to}`}`}
                    sx={{
                      borderTop: '1px solid #e2e8f0',
                      bgcolor: '#ffffff',
                      '.MuiTablePagination-toolbar': { minHeight: 48, px: 2 },
                      '.MuiTablePagination-selectLabel, .MuiTablePagination-displayedRows': { fontSize: 12.5, fontWeight: 700, color: '#475569' }
                    }}
                  />
                </Paper>
              </Stack>
            )}

            {/* BOTÓN ÚNICO: ENVIAR AJUSTES AL LÍDER (Visible en cualquiera de las 4 etapas, ubicado inmediatamente debajo del contenido a 4-8px) */}
            {detail?.status === 'adjustments' && (
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  mt: -1.2,
                  mb: 0.5
                }}
              >
                <Tooltip title="Remitir el Plan de Acción al líder para su revisión y firmas" arrow placement="top">
                  <Button
                    variant="contained"
                    startIcon={<Send sx={{ fontSize: 16 }} />}
                    onClick={() => transition('submit_owner_validation')}
                    sx={{
                      bgcolor: '#2563eb',
                      color: '#ffffff',
                      fontWeight: 800,
                      fontSize: 13,
                      textTransform: 'none',
                      borderRadius: 50,
                      px: 2.8,
                      py: 0.95,
                      boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
                      transition: 'all 0.15s ease',
                      '&:hover': {
                        bgcolor: '#1d4ed8',
                        boxShadow: '0 6px 18px rgba(37,99,235,0.45)',
                        transform: 'translateY(-1px)'
                      }
                    }}
                  >
                    Enviar ajustes al Líder
                  </Button>
                </Tooltip>
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>

      {/* MODAL: VISUALIZAR EVIDENCIAS RADICADAS EN VENTANA EMERGENTE */}
      <Dialog
        open={evidenceModalOpen}
        onClose={() => setEvidenceModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            overflow: 'hidden',
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.2)'
          }
        }}
      >
        <DialogTitle
          sx={{
            m: 0,
            px: 3,
            py: 2,
            borderBottom: '1px solid #e2e8f0',
            bgcolor: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#ede9fe', color: '#6d28d9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <AttachFile sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip size="small" label={evidenceItem?.code || 'Actividad'} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 900, fontSize: 11 }} />
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a' }} noWrap>
                  Evidencias Radicadas
                </Typography>
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: '#64748b', mt: 0.2 }} noWrap>
                {evidenceItem?.activity}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {isPlanningAdmin && (
              <Button
                size="small"
                variant="outlined"
                color="primary"
                startIcon={<FolderSharedIcon sx={{ fontSize: 16 }} />}
                onClick={() => handleOpenActivityFolder(evidenceItem)}
                sx={{ textTransform: 'none', fontWeight: 800, fontSize: 11.5, borderRadius: 2 }}
              >
                Carpeta en Google Drive
              </Button>
            )}
            <IconButton
              aria-label="cerrar"
              onClick={() => setEvidenceModalOpen(false)}
              size="small"
              sx={{ color: '#64748b' }}
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2.5, bgcolor: '#f8fafc' }}>
          {(!evidenceItem?.evidence || evidenceItem.evidence.length === 0) ? (
            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderRadius: 3, bgcolor: '#ffffff' }}>
              <InsertDriveFile sx={{ fontSize: 48, color: '#cbd5e1', mb: 1 }} />
              <Typography sx={{ fontSize: 14.5, fontWeight: 700, color: '#475569' }}>
                No hay evidencias radicadas para esta actividad
              </Typography>
              <Typography sx={{ fontSize: 12, color: '#94a3b8', mt: 0.5 }}>
                El responsable de la dependencia aún no ha cargado documentos de soporte para este plan.
              </Typography>
            </Paper>
          ) : (
            <Stack spacing={1.5}>
              <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {evidenceItem.evidence.length} {evidenceItem.evidence.length === 1 ? 'documento radicado' : 'documentos radicados'}
              </Typography>
              {evidenceItem.evidence.map((ev) => (
                <Paper
                  key={ev.id}
                  variant="outlined"
                  sx={{
                    p: 2,
                    borderRadius: 2.5,
                    bgcolor: '#ffffff',
                    borderColor: '#e2e8f0',
                    display: 'flex',
                    flexDirection: { xs: 'column', sm: 'row' },
                    justifyContent: 'space-between',
                    alignItems: { xs: 'flex-start', sm: 'center' },
                    gap: 1.5,
                    transition: 'all 0.15s ease',
                    '&:hover': { borderColor: '#93c5fd', boxShadow: '0 4px 14px rgba(37,99,235,0.06)' }
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      {getFileIcon(ev.original_name)}
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a' }} noWrap>
                        {ev.original_name}
                      </Typography>
                      <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" sx={{ mt: 0.3 }}>
                        <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 700 }}>
                          {formatBytes(ev.size_bytes)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94a3b8' }}>•</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>
                          Radicado: {formatFecha(ev.created_at)}
                        </Typography>
                        {(ev.drive_file_id || ev.drive_url) && (
                          <>
                            <Typography variant="caption" sx={{ color: '#94a3b8' }}>•</Typography>
                            <Chip
                              size="small"
                              icon={<CloudDoneIcon sx={{ fontSize: '13px !important', color: '#16a34a !important' }} />}
                              label="En Google Drive"
                              sx={{ bgcolor: '#f0fdf4', color: '#166534', fontWeight: 750, fontSize: 10.5, height: 20 }}
                            />
                          </>
                        )}
                      </Stack>
                    </Box>
                  </Stack>

                  <Stack direction="row" spacing={1} sx={{ flexShrink: 0, alignSelf: { xs: 'flex-end', sm: 'center' } }}>
                    {isPlanningAdmin && (ev.drive_url || ev.drive_file_id) && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="success"
                        startIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                        onClick={() => handleOpenDriveUrl(ev.drive_url || `https://drive.google.com/file/d/${ev.drive_file_id}/view`)}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 800,
                          fontSize: 12,
                          bgcolor: '#f0fdf4',
                          borderColor: '#86efac',
                          color: '#15803d',
                          '&:hover': { bgcolor: '#dcfce7', borderColor: '#4ade80' }
                        }}
                      >
                        Ver en Drive
                      </Button>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      color="primary"
                      startIcon={<Visibility sx={{ fontSize: 15 }} />}
                      onClick={() => handlePreviewEvidence(ev)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, fontSize: 12 }}
                    >
                      Visualizar
                    </Button>
                    <Button
                      size="small"
                      variant="contained"
                      color="inherit"
                      startIcon={<Download sx={{ fontSize: 15 }} />}
                      onClick={() => handleDownloadDirectEvidence(ev)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, fontSize: 12, bgcolor: '#f1f5f9', color: '#1e293b', '&:hover': { bgcolor: '#e2e8f0' } }}
                    >
                      Descargar
                    </Button>
                  </Stack>
                </Paper>
              ))}
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5, borderTop: '1px solid #e2e8f0' }}>
          <Button
            onClick={() => setEvidenceModalOpen(false)}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
          >
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: VALORACIÓN PARA PLANEACIÓN Y EFECTIVIDAD */}
      <Dialog
        open={evalModalOpen}
        onClose={() => !saving && setEvalModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3, maxWidth: 660, width: '100%', overflow: 'hidden', boxShadow: '0 20px 45px rgba(15, 23, 42, 0.16)' }
        }}
      >
        <DialogTitle
          sx={{
            m: 0, px: 3, py: 2, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Chip size="small" label={evaluatingItem?.code || 'Actividad'} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 800, fontSize: 12, flexShrink: 0 }} />
            <Typography sx={{ fontSize: 16, fontWeight: 800, color: '#0f172a' }} noWrap>
              Valoración de Seguimiento
            </Typography>
          </Stack>
          <IconButton aria-label="cerrar" onClick={() => !saving && setEvalModalOpen(false)} size="small" sx={{ color: '#64748b' }}>
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: 3, py: 2.5, bgcolor: '#ffffff' }}>
          <Stack spacing={2.5}>
            {/* Resumen puntual de la Actividad */}
            <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <Stack direction="row" spacing={1.2} alignItems="flex-start" mb={evaluatingItem?.target || evaluatingItem?.indicator ? 1.2 : 0}>
                <Chip size="small" label={evaluatingItem?.code || 'Actividad'} sx={{ bgcolor: '#eff6ff', color: '#1d4ed8', fontWeight: 900, fontSize: 11.5, mt: 0.2, flexShrink: 0 }} />
                <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: '#0f172a', lineHeight: 1.45 }}>
                  {evaluatingItem?.activity}
                </Typography>
              </Stack>
              {(evaluatingItem?.target || evaluatingItem?.indicator) && (
                <Stack direction="row" spacing={2} flexWrap="wrap" sx={{ pt: 1, borderTop: '1px dashed #e2e8f0' }}>
                  {evaluatingItem?.target && (
                    <Typography sx={{ fontSize: 12, color: '#475569' }}>
                      <strong style={{ color: '#0f172a' }}>Meta:</strong> {evaluatingItem.target}
                    </Typography>
                  )}
                  {evaluatingItem?.indicator && (
                    <Typography sx={{ fontSize: 12, color: '#475569' }}>
                      <strong style={{ color: '#0f172a' }}>Indicador:</strong> {evaluatingItem.indicator}
                    </Typography>
                  )}
                </Stack>
              )}
            </Box>

            {/* Evidencias cargadas por la dependencia con previsualización */}
            {evaluatingItem?.evidence && evaluatingItem.evidence.length > 0 && (
              <Box sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.75}>
                  <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#166534' }}>
                    Evidencias cargadas por la dependencia ({evaluatingItem.evidence.length})
                  </Typography>
                  <Button
                    size="small"
                    onClick={() => handleOpenEvidenceModal(evaluatingItem)}
                    sx={{ textTransform: 'none', fontSize: 11, fontWeight: 750, color: '#15803d', p: 0 }}
                  >
                    Ver todas
                  </Button>
                </Stack>
                <Stack spacing={0.75}>
                  {evaluatingItem.evidence.map((ev) => (
                    <Stack key={ev.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ bgcolor: '#ffffff', p: 0.75, borderRadius: 1.5, border: '1px solid #dcfce7' }}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
                        <Box sx={{ flexShrink: 0 }}>{getFileIcon(ev.original_name)}</Box>
                        <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#14532d' }} noWrap>
                          {ev.original_name}
                        </Typography>
                      </Stack>
                      <Stack direction="row" spacing={0.5} sx={{ flexShrink: 0, ml: 1 }}>
                        <Button
                          size="small"
                          startIcon={<Visibility sx={{ fontSize: 14 }} />}
                          onClick={() => handlePreviewEvidence(ev)}
                          sx={{ textTransform: 'none', fontSize: 11.5, fontWeight: 800, color: '#0284c7', bgcolor: '#f0f9ff', px: 1, py: 0.2, borderRadius: 1.5, minWidth: 0 }}
                        >
                          Previsualizar
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => handleDownloadDirectEvidence(ev)}
                          sx={{ color: '#166534', p: 0.4 }}
                          title="Descargar archivo"
                        >
                          <Download sx={{ fontSize: 16 }} />
                        </IconButton>
                      </Stack>
                    </Stack>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Selección de Periodo y Porcentaje */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={7}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Periodo de Seguimiento"
                  InputLabelProps={{ shrink: true }}
                  value={evalForm.period_id}
                  onChange={(e) => handleChangeEvalPeriod(e.target.value)}
                  disabled={evalAvailablePeriods.length <= 1}
                  helperText={evalAvailablePeriods.length <= 1 ? "Periodo determinado automáticamente por las fechas de ejecución" : ""}
                  SelectProps={{
                    sx: { fontSize: 13.5, fontWeight: 700, color: '#0f172a' }
                  }}
                  sx={{
                    '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#ffffff' },
                    '& .MuiInputLabel-root': { fontWeight: 700, color: '#475569' }
                  }}
                >
                  {evalAvailablePeriods.map((p) => {
                    const isS1 = (p.code || '').toUpperCase() === 'S1' || /1|prim/i.test(p.name || '') || (p.position === 1);
                    const labelPeriod = isS1
                      ? 'Primer Semestre · 1 de enero al 31 de julio'
                      : 'Segundo Semestre · 1 de agosto al 31 de diciembre';
                    return (
                      <MenuItem key={p.id} value={p.id} sx={{ fontSize: 13, fontWeight: 600 }}>
                        {p.code} · {p.name || labelPeriod}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  size="small"
                  type="number"
                  inputProps={{ min: 0, max: 999, step: 'any' }}
                  label="Avance Físico"
                  placeholder="0"
                  InputLabelProps={{ shrink: true }}
                  value={evalForm.physical_progress}
                  onChange={(e) => setEvalForm({ ...evalForm, physical_progress: e.target.value })}
                  helperText={Number(evalForm.physical_progress) > 100 ? 'Sobrecumplimiento (>100%)' : ''}
                  FormHelperTextProps={{ sx: { color: '#b45309', fontWeight: 750, fontSize: 11, mt: 0.5 } }}
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <Typography sx={{ fontWeight: 800, color: '#2563eb', fontSize: 14 }}>%</Typography>
                      </InputAdornment>
                    ),
                    sx: { borderRadius: 2, bgcolor: '#ffffff', fontWeight: 700, fontSize: 14 }
                  }}
                  sx={{
                    '& .MuiInputLabel-root': { fontWeight: 700, color: '#475569' }
                  }}
                />
              </Grid>
            </Grid>

            {/* Observaciones y Concepto de Planeación */}
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Observaciones y Concepto de Planeación y Efectividad"
              InputLabelProps={{ shrink: true }}
              placeholder="Ingrese el concepto oficial, retroalimentación o justificación del avance..."
              value={evalForm.observations}
              onChange={(e) => setEvalForm({ ...evalForm, observations: e.target.value })}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2, bgcolor: '#ffffff' },
                '& .MuiInputLabel-root': { fontWeight: 700, color: '#475569' }
              }}
            />
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button onClick={() => setEvalModalOpen(false)} disabled={saving} sx={{ textTransform: 'none', fontWeight: 750, borderRadius: 2 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEvaluation}
            disabled={saving}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, px: 3, bgcolor: '#2563eb', '&:hover': { bgcolor: '#1d4ed8' } }}
          >
            {saving ? 'Guardando...' : 'Guardar Valoración'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL: GESTIÓN DE PLAZO Y PRÓRROGA DE ETAPA 1 */}
      <Dialog
        open={timelineModalOpen}
        onClose={() => !savingTimeline && setTimelineModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            boxShadow: '0 20px 45px -10px rgba(15,23,42,0.18)',
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle
          sx={{
            px: { xs: 2.5, sm: 3 },
            pt: 2.5,
            pb: 2,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid #f1f5f9',
            bgcolor: '#ffffff'
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 2,
                bgcolor: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #dbeafe',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0
              }}
            >
              <AccessTime sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 17, lineHeight: 1.25 }}>
                Vigencia y Prórroga de Formulación
              </Typography>
              <Typography variant="caption" color="#64748b" sx={{ fontSize: 12.5, display: 'block', mt: 0.2 }}>
                Etapa 1: Plan y actividades · {detail?.code} ({detail?.organizationalUnit?.name})
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            onClick={() => !savingTimeline && setTimelineModalOpen(false)}
            sx={{
              color: '#94a3b8',
              borderRadius: 1.75,
              '&:hover': { bgcolor: '#f1f5f9', color: '#334155' }
            }}
          >
            <Close fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ px: { xs: 2.5, sm: 3 }, py: 2.5, bgcolor: '#ffffff' }}>
          <Stack spacing={2.5}>
            {/* Aviso institucional informativo */}
            <Box
              sx={{
                p: 1.75,
                borderRadius: 2.25,
                bgcolor: '#f8fafc',
                border: '1px solid #e2e8f0',
                display: 'flex',
                gap: 1.5,
                alignItems: 'flex-start'
              }}
            >
              <CheckCircleOutline sx={{ color: '#2563eb', fontSize: 19, mt: 0.2, flexShrink: 0 }} />
              <Typography sx={{ fontSize: 12.5, color: '#475569', lineHeight: 1.55 }}>
                Defina o amplíe la fecha límite para que el líder de dependencia pueda registrar o ajustar actividades en la <strong>Etapa 1</strong>. Al cumplirse el plazo, el acceso de edición se cerrará automáticamente.
              </Typography>
            </Box>

            {/* Atajos de ampliación rápida */}
            <Box sx={{ p: 1.75, borderRadius: 2.25, bgcolor: '#f8fafc', border: '1px solid #f1f5f9' }}>
              <Typography
                variant="caption"
                sx={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 800,
                  color: '#64748b',
                  textTransform: 'uppercase',
                  letterSpacing: '0.6px',
                  mb: 1
                }}
              >
                Extensión rápida del plazo de cierre:
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap gap={1}>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleAddDaysToTimeline(7)}
                  sx={{
                    borderRadius: 1.75,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.6,
                    py: 0.5,
                    bgcolor: '#ffffff',
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb', color: '#1d4ed8' }
                  }}
                >
                  +7 Días
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleAddDaysToTimeline(15)}
                  sx={{
                    borderRadius: 1.75,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.6,
                    py: 0.5,
                    bgcolor: '#ffffff',
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb', color: '#1d4ed8' }
                  }}
                >
                  +15 Días
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => handleAddDaysToTimeline(30)}
                  sx={{
                    borderRadius: 1.75,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.6,
                    py: 0.5,
                    bgcolor: '#ffffff',
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb', color: '#1d4ed8' }
                  }}
                >
                  +30 Días
                </Button>
                <Button
                  size="small"
                  variant="outlined"
                  onClick={handleSetEndOfMonth}
                  sx={{
                    borderRadius: 1.75,
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 12,
                    px: 1.6,
                    py: 0.5,
                    bgcolor: '#ffffff',
                    borderColor: '#cbd5e1',
                    color: '#334155',
                    '&:hover': { bgcolor: '#eff6ff', borderColor: '#2563eb', color: '#1d4ed8' }
                  }}
                >
                  Hasta fin de mes
                </Button>
              </Stack>
            </Box>

            {/* Inputs de fechas */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: '#334155', mb: 0.75 }}>
                    Fecha de inicio
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={timelineForm.starts_on}
                    onChange={(e) => setTimelineForm({ ...timelineForm, starts_on: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        fontSize: 13.5
                      }
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11.5, display: 'block', mt: 0.5 }}>
                    Inicio habilitado de formulación
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: '#334155', mb: 0.75 }}>
                    Fecha límite / Cierre
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={timelineForm.ends_on}
                    onChange={(e) => setTimelineForm({ ...timelineForm, ends_on: e.target.value })}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        fontWeight: 800,
                        fontSize: 13.5
                      }
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11.5, display: 'block', mt: 0.5 }}>
                    Límite para registrar o ajustar actividades
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Justificación */}
            <Box>
              <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: '#334155', mb: 0.75 }}>
                Motivo de la prórroga o justificación
              </Typography>
              <TextField
                fullWidth
                multiline
                minRows={2}
                size="small"
                placeholder="Ej: Solicitud formal de la dependencia para completar concertación de metas e indicadores..."
                value={timelineForm.reason}
                onChange={(e) => setTimelineForm({ ...timelineForm, reason: e.target.value })}
                sx={{
                  '& .MuiOutlinedInput-root': {
                    borderRadius: 2,
                    bgcolor: '#ffffff',
                    fontSize: 13
                  }
                }}
              />
            </Box>

            {/* Historial de prórrogas */}
            {stage1Extensions.length > 0 && (
              <Box sx={{ p: 1.75, borderRadius: 2.25, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <Typography variant="caption" fontWeight={900} color="#334155" mb={1.25} sx={{ display: 'flex', alignItems: 'center', gap: 0.75, fontSize: 12 }}>
                  <History fontSize="small" sx={{ color: '#64748b' }} /> Historial de prórrogas ({stage1Extensions.length})
                </Typography>
                <Stack spacing={1} sx={{ maxHeight: 160, overflowY: 'auto', pr: 0.5 }}>
                  {stage1Extensions.map((ext, idx) => {
                    const isLatest = idx === stage1Extensions.length - 1;
                    return (
                      <Box key={idx} sx={{ p: 1.25, borderRadius: 1.75, bgcolor: isLatest ? '#eff6ff' : '#ffffff', border: '1px solid', borderColor: isLatest ? '#93c5fd' : '#e2e8f0', fontSize: 12 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center">
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Typography fontWeight={800} color="#0f172a" sx={{ fontSize: 12.5 }}>
                              Nueva fecha: {ext.new_deadline}
                            </Typography>
                            {isLatest && (
                              <Chip size="small" label="Activa / Vigente" color="primary" sx={{ height: 20, fontSize: 10, fontWeight: 800 }} />
                            )}
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {ext.granted_at ? new Date(ext.granted_at).toLocaleDateString('es-CO') : ''}
                          </Typography>
                        </Stack>
                        <Typography color="#475569" sx={{ mt: 0.5, fontSize: 12 }}>{ext.reason || 'Sin motivo registrado'}</Typography>
                        <Typography variant="caption" color="#64748b" display="block" sx={{ mt: 0.25, fontSize: 11 }}>
                          Autorizado por: {ext.granted_by_name || 'Planeación'}
                        </Typography>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2,
            borderTop: '1px solid #f1f5f9',
            bgcolor: '#f8fafc',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Button
            onClick={() => setTimelineModalOpen(false)}
            disabled={savingTimeline}
            sx={{
              textTransform: 'none',
              fontWeight: 700,
              fontSize: 13,
              color: '#64748b',
              borderRadius: 1.75,
              px: 2,
              '&:hover': { bgcolor: '#f1f5f9', color: '#1e293b' }
            }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveTimeline}
            disabled={savingTimeline || !timelineForm.ends_on}
            startIcon={savingTimeline ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutline sx={{ fontSize: 18 }} />}
            sx={{
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: 13,
              px: 2.75,
              py: 0.9,
              bgcolor: '#1e40af',
              boxShadow: '0 2px 8px rgba(30,64,175,0.22)',
              '&:hover': { bgcolor: '#1d4ed8', boxShadow: '0 4px 12px rgba(30,64,175,0.30)' }
            }}
          >
            {savingTimeline ? 'Guardando...' : 'Guardar y Habilitar Plazo'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* VENTANA EMERGENTE COMPLETA DE VISTA PREVIA DE EVIDENCIA */}
      <Dialog
        open={previewModal.open}
        onClose={handleClosePreview}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3.5, overflow: 'hidden', height: '88vh', display: 'flex', flexDirection: 'column' }
        }}
      >
        <DialogTitle
          sx={{
            m: 0, px: 3, py: 1.75, borderBottom: '1px solid #e2e8f0', bgcolor: '#ffffff',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              {getFileIcon(previewModal.fileName)}
            </Box>
            <Typography sx={{ fontSize: 15, fontWeight: 900, color: '#0f172a' }} noWrap>
              {previewModal.fileName}
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            {previewModal.url && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<Download sx={{ fontSize: 15 }} />}
                onClick={() => {
                  const a = document.createElement('a');
                  a.href = previewModal.url;
                  a.download = previewModal.fileName;
                  a.click();
                }}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
              >
                Descargar
              </Button>
            )}
            {previewModal.url && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<OpenInNew sx={{ fontSize: 15 }} />}
                onClick={() => window.open(previewModal.url, '_blank')}
                sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}
              >
                Pestaña Nueva
              </Button>
            )}
            <IconButton aria-label="cerrar" onClick={handleClosePreview} size="small" sx={{ color: '#64748b' }}>
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 0, bgcolor: '#f8fafc', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {previewModal.loading ? (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, py: 8 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2, color: '#64748b', fontSize: 13, fontWeight: 700 }}>
                Cargando vista previa del documento...
              </Typography>
            </Stack>
          ) : previewModal.isPdf ? (
            <Box sx={{ flex: 1, width: '100%', height: '100%' }}>
              <iframe
                src={previewModal.url}
                title={previewModal.fileName}
                style={{ width: '100%', height: '100%', border: 'none' }}
              />
            </Box>
          ) : previewModal.isImage ? (
            <Box sx={{ flex: 1, display: 'grid', placeItems: 'center', p: 3, bgcolor: '#0f172a' }}>
              <img
                src={previewModal.url}
                alt={previewModal.fileName}
                style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: 8 }}
              />
            </Box>
          ) : (
            <Stack alignItems="center" justifyContent="center" sx={{ flex: 1, p: 4, textAlign: 'center' }}>
              <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, bgcolor: '#ffffff', maxWidth: 500, width: '100%', boxShadow: '0 4px 20px rgba(0,0,0,0.04)' }}>
                <Box sx={{ width: 64, height: 64, borderRadius: 3, bgcolor: '#f1f5f9', display: 'grid', placeItems: 'center', mx: 'auto', mb: 2 }}>
                  {getFileIcon(previewModal.fileName)}
                </Box>
                <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#0f172a', mb: 0.5 }}>
                  {previewModal.fileName}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                  Documento cargado como soporte institucional. Puede descargarlo y visualizarlo de forma nativa en su equipo.
                </Typography>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  startIcon={<Download />}
                  onClick={() => {
                    const a = document.createElement('a');
                    a.href = previewModal.url;
                    a.download = previewModal.fileName;
                    a.click();
                  }}
                  sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 850, px: 4 }}
                >
                  Descargar Documento
                </Button>
              </Paper>
            </Stack>
          )}
        </DialogContent>
      </Dialog>

      {/* DIÁLOGO: PREVISUALIZACIÓN OFICIAL EN TIEMPO REAL DEL PLAN DE ACCIÓN (VISTA DEL LÍDER EN MODO LECTURA) */}
      <Dialog
        open={previewPlanModalOpen}
        onClose={() => setPreviewPlanModalOpen(false)}
        maxWidth="xl"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            height: '92vh',
            bgcolor: '#f8fafc',
            p: { xs: 1.5, md: 2.5 },
            overflow: 'auto'
          }
        }}
      >
        <PlanAccionConsulta
          initialPlanId={detail?.id}
          initialPlanData={detail}
          readOnly={true}
          onClose={() => setPreviewPlanModalOpen(false)}
        />
      </Dialog>

      {/* DIÁLOGO ENVIAR PLAN AJUSTADO A REVISIÓN DEL LÍDER */}
      <Dialog
        open={submitValidationModalOpen}
        onClose={() => !submittingValidation && setSubmitValidationModalOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3.5, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 900, color: '#0f172a', pb: 1 }}>
          Enviar Plan Ajustado a Revisión del Líder
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#475569', mb: 2, lineHeight: 1.5 }}>
            El Plan de Acción y el Acta COM-IF-FR-002 serán remitidos al líder responsable{' '}
            <strong style={{ color: '#0f172a' }}>{detail?.currentResponsibility?.responsibleUser?.nombre || 'Líder de Dependencia'}</strong>{' '}
            para su revisión y concertación. Se enviará una notificación a su campana de avisos y por correo institucional con el mensaje: <em>"Se ajustó para su revisión"</em>.
          </Typography>

          {/* RECORDATORIO DE CORRECCIÓN DEL ACTA */}
          <Paper
            variant="outlined"
            sx={{
              p: 1.8,
              mb: 2.5,
              borderRadius: 2.5,
              bgcolor: '#f0fdf4',
              borderColor: '#bbf7d0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 1.5
            }}
          >
            <Box sx={{ flex: 1, minWidth: 230 }}>
              <Typography sx={{ fontWeight: 850, color: '#166534', fontSize: 13 }}>
                📝 Verificación del Acta COM-IF-FR-002
              </Typography>
              <Typography variant="caption" sx={{ color: '#374151', display: 'block', mt: 0.3, lineHeight: 1.35 }}>
                Si modificó actividades o lineamientos, verifique que los compromisos del acta concuerden antes de remitir.
              </Typography>
            </Box>
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSubmitValidationModalOpen(false);
                setTab('meeting');
              }}
              sx={{
                textTransform: 'none',
                fontWeight: 800,
                fontSize: 12,
                borderRadius: 2,
                color: '#15803d',
                borderColor: '#86efac',
                bgcolor: '#ffffff',
                '&:hover': { bgcolor: '#dcfce7' }
              }}
            >
              Revisar / Corregir Acta
            </Button>
          </Paper>

          <TextField
            fullWidth
            multiline
            rows={3}
            required
            label="Detalle de los ajustes realizados en el Plan y Acta *"
            placeholder="Describa los cambios aplicados en las actividades y en el acta de concertación..."
            value={planningResponseComment}
            onChange={(e) => setPlanningResponseComment(e.target.value)}
            disabled={submittingValidation}
            variant="outlined"
            helperText="Este comentario se registra automáticamente en el Acta de Concertación COM-IF-FR-002, en la campana y en el correo al líder."
          />

          <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: '#047857', fontWeight: 700 }}>
            ✓ Sincronización automática: Al enviar, se actualizan y sincronizan automáticamente el Acta COM-IF-FR-002 y el Plan Oficial DIR-PE-FR-003 en Google Drive.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 1, gap: 1 }}>
          <Button
            onClick={() => setSubmitValidationModalOpen(false)}
            disabled={submittingValidation}
            sx={{ textTransform: 'none', fontWeight: 750, color: '#64748b' }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            onClick={handleConfirmSubmitValidation}
            disabled={submittingValidation}
            startIcon={submittingValidation ? <CircularProgress size={18} color="inherit" /> : <Send />}
            sx={{
              borderRadius: 2.5,
              fontWeight: 850,
              textTransform: 'none',
              bgcolor: '#2563eb',
              px: 2.5,
              '&:hover': { bgcolor: '#1d4ed8' }
            }}
          >
            {submittingValidation ? 'Enviando...' : 'Enviar a Revisión del Líder'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ========================================================
          CHAT DE RETROALIMENTACIÓN ESTILO WHATSAPP (FONDO VERDE/BEIGE)
          CADA MENSAJE SE ENVÍA AUTOMÁTICAMENTE AL CORREO
         ======================================================== */}
      <Dialog
        open={feedbackChatModalOpen}
        onClose={handleCloseFeedbackChat}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3.5,
            overflow: 'hidden',
            height: '84vh',
            maxHeight: 740,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 25px 60px rgba(15, 23, 42, 0.35)'
          }
        }}
      >
        {/* Cabecera Oficial WhatsApp Green */}
        <Box
          sx={{
            p: 1.5,
            px: 2,
            bgcolor: '#075e54',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
            zIndex: 2
          }}
        >
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Badge
              overlap="circular"
              anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
              variant="dot"
              sx={{
                '& .MuiBadge-badge': {
                  bgcolor: '#25d366',
                  color: '#25d366',
                  boxShadow: '0 0 0 2px #075e54',
                  width: 10,
                  height: 10,
                  borderRadius: '50%'
                }
              }}
            >
              <Avatar
                sx={{
                  bgcolor: '#128c7e',
                  color: '#ffffff',
                  width: 42,
                  height: 42,
                  fontWeight: 900,
                  fontSize: 15,
                  border: '1.5px solid rgba(255,255,255,0.35)'
                }}
              >
                {((adjustmentInfo?.requested_by_name || detail?.responsibleUser?.nombre || 'Líder')
                  .split(' ')
                  .filter(Boolean)
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join('') || 'LD').toUpperCase()}
              </Avatar>
            </Badge>
            <Box>
              <Typography sx={{ fontWeight: 850, fontSize: 15, lineHeight: 1.2, color: '#ffffff' }}>
                {adjustmentInfo?.requested_by_name || detail?.responsibleUser?.nombre || 'Líder Responsable'}
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                {detail?.organizationalUnit?.name || 'Dependencia'}
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <IconButton
              size="small"
              onClick={handleCloseFeedbackChat}
              sx={{ color: '#ffffff', '&:hover': { bgcolor: 'rgba(255,255,255,0.15)' } }}
            >
              <Close sx={{ fontSize: 22 }} />
            </IconButton>
          </Stack>
        </Box>

        {/* Cuerpo del Chat con Fondo WhatsApp (Doodle Beige / Pattern) */}
        <DialogContent
          sx={{
            flex: 1,
            p: { xs: 1.5, sm: 2.2 },
            bgcolor: '#efeae2',
            backgroundImage: `radial-gradient(#d1d7db 0.85px, transparent 0.85px), radial-gradient(#d1d7db 0.85px, #efeae2 0.85px)`,
            backgroundSize: '24px 24px',
            backgroundPosition: '0 0, 12px 12px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Banner de Cifrado y Notificación a Correo Institucional */}
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Paper
              elevation={0}
              sx={{
                bgcolor: '#fff3c4',
                color: '#54656f',
                px: 2,
                py: 0.9,
                borderRadius: 2.5,
                maxWidth: 520,
                textAlign: 'center',
                fontSize: 11.5,
                lineHeight: 1.35,
                boxShadow: '0 1px 1.5px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.04)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 0.7
              }}
            >
              <LockOutlined sx={{ fontSize: 14, color: '#713f12', flexShrink: 0 }} />
              <span>
                <strong>Canal de Comunicación Directa:</strong> Este espacio es exclusivamente informativo para concertación y seguimiento mutuo, sin alterar actas ni documentos oficiales.
              </span>
            </Paper>
          </Box>

          {/* Listado de Mensajes en orden cronológico (Una persona a la izquierda, la otra a la derecha) */}
          {chatThread.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4, color: '#64748b' }}>
              <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                No hay mensajes previos en este canal.
              </Typography>
              <Typography sx={{ fontSize: 12, mt: 0.5 }}>
                Escriba a continuación para comunicarse directamente sobre el plan de acción a su cargo.
              </Typography>
            </Box>
          ) : (
            (() => {
              const threadHasMe = chatThread.some((m) =>
              user && (
                (m.sender_id && String(m.sender_id) === String(user.id)) ||
                (m.sender_email && user.email && m.sender_email.toLowerCase() === user.email.toLowerCase()) ||
                (m.sender_name && user.nombre && m.sender_name.trim().toLowerCase() === user.nombre.trim().toLowerCase())
              )
            );

            return chatThread.map((msg, idx) => {
              const isMe = Boolean(
                user && (
                  (msg.sender_id && String(msg.sender_id) === String(user.id)) ||
                  (msg.sender_email && user.email && msg.sender_email.toLowerCase() === user.email.toLowerCase()) ||
                  (msg.sender_name && user.nombre && msg.sender_name.trim().toLowerCase() === user.nombre.trim().toLowerCase())
                )
              );

              // Si el usuario actual está en la conversación, sus mensajes van a la derecha (verde) y los de la otra persona a la izquierda (blanco).
              // Si es un tercero, se ubica por rol: Planeación a la derecha y Líder a la izquierda.
              const isRightSide = threadHasMe ? isMe : (msg.sender_type === 'planning');
              const timeStr = msg.created_at
                ? new Date(msg.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <Box
                  key={msg.id || idx}
                  sx={{
                    display: 'flex',
                    justifyContent: isRightSide ? 'flex-end' : 'flex-start',
                    mb: 1.6
                  }}
                >
                  <Paper
                    elevation={0}
                    sx={{
                      maxWidth: { xs: '88%', sm: '80%' },
                      p: 1.3,
                      px: 1.7,
                      borderRadius: isRightSide ? '10px 0px 10px 10px' : '0px 10px 10px 10px',
                      bgcolor: isRightSide ? '#d9fdd3' : '#ffffff',
                      border: isRightSide ? 'none' : '1px solid #e2e8f0',
                      boxShadow: '0 1px 1px rgba(11,20,26,.14)',
                      position: 'relative'
                    }}
                  >
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: isRightSide ? '#008069' : '#0369a1', mb: 0.4 }}>
                      {msg.sender_name || (isRightSide ? 'Tú' : (msg.sender_type === 'planning' ? 'LUISA FERNANDA ORTEGA MUÑOZ' : 'Líder'))}
                      <span style={{ fontSize: 11, fontWeight: 500, color: '#667781', marginLeft: 6 }}>
                        ({msg.sender_cargo || (msg.sender_type === 'planning' ? 'Analista de Planeación · Planeación y Efectividad' : 'Líder Responsable')})
                      </span>
                    </Typography>

                    <Typography sx={{ fontSize: 13.5, color: '#111b21', lineHeight: 1.52, whiteSpace: 'pre-wrap' }}>
                      {msg.message}
                    </Typography>

                    <Stack direction="row" spacing={0.6} alignItems="center" justifyContent="flex-end" sx={{ mt: 0.5 }}>
                      <Typography variant="caption" sx={{ fontSize: 10.5, color: '#667781' }}>
                        {timeStr}
                      </Typography>
                      {isRightSide ? (
                        <span style={{ color: '#53bdeb', fontSize: 13, fontWeight: 900, lineHeight: 1 }}>✓✓</span>
                      ) : (
                        <Typography variant="caption" sx={{ fontSize: 10, color: '#008069', fontWeight: 700 }}>
                          ✓ Recibido
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                </Box>
              );
            });
          })()
        )}
        </DialogContent>

        {/* Barra de Entrada de Mensaje estilo WhatsApp con Enlace a Correo */}
        <Box sx={{ p: 1.5, px: 2, bgcolor: '#f0f2f5', borderTop: '1px solid #d1d7db' }}>
          {/* Accesos rápidos a actividades y botón para retornar plan si está en ajustes */}
          <Stack direction="row" spacing={1} sx={{ mb: 1.2 }} alignItems="center" justifyContent="space-between" flexWrap="wrap">
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<AssignmentTurnedIn sx={{ fontSize: 16 }} />}
                onClick={() => {
                  setFeedbackChatModalOpen(false);
                  setTab('activities');
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 11.5,
                  borderRadius: 2,
                  color: '#008069',
                  borderColor: '#86efac',
                  bgcolor: '#ffffff',
                  py: 0.35,
                  px: 1.3,
                  '&:hover': { bgcolor: '#f0fdf4' }
                }}
              >
                Ir a Actividades
              </Button>
              <Button
                size="small"
                variant="outlined"
                startIcon={<EditNote sx={{ fontSize: 18 }} />}
                onClick={() => {
                  setFeedbackChatModalOpen(false);
                  setTab('meeting');
                }}
                sx={{
                  textTransform: 'none',
                  fontWeight: 700,
                  fontSize: 11.5,
                  borderRadius: 2,
                  color: '#15803d',
                  borderColor: '#86efac',
                  bgcolor: '#ffffff',
                  py: 0.35,
                  px: 1.3,
                  '&:hover': { bgcolor: '#f0fdf4' }
                }}
              >
                Ir a Corregir Acta
              </Button>
              {chatThread.length > 0 && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<DeleteSweep sx={{ fontSize: 17 }} />}
                  onClick={handleClearFeedbackChat}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 700,
                    fontSize: 11.5,
                    borderRadius: 2,
                    color: '#dc2626',
                    borderColor: '#fca5a5',
                    bgcolor: '#ffffff',
                    py: 0.35,
                    px: 1.3,
                    '&:hover': { bgcolor: '#fef2f2', borderColor: '#ef4444' }
                  }}
                >
                  Limpiar Chat
                </Button>
              )}
            </Stack>

            {detail?.status === 'adjustments' && (
              <Button
                size="small"
                variant="contained"
                disabled={sendingChatMessage || submittingValidation}
                onClick={() => handleSendChatMessage(true)}
                startIcon={submittingValidation ? <CircularProgress size={14} color="inherit" /> : <CheckCircle sx={{ fontSize: 15 }} />}
                sx={{
                  textTransform: 'none',
                  fontWeight: 900,
                  fontSize: 11.5,
                  borderRadius: 2,
                  bgcolor: '#008069',
                  color: '#ffffff',
                  boxShadow: 'none',
                  '&:hover': { bgcolor: '#006a57' }
                }}
              >
                ✓ Enviar ajustes y retornar plan al Líder
              </Button>
            )}
          </Stack>

          {/* Input de Mensaje WhatsApp con soporte Multilínea (Enter salta de línea, Ctrl+Enter o Botón envía) */}
          <Stack direction="row" spacing={1.2} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              minRows={1}
              maxRows={5}
              size="small"
              placeholder="Escribe un mensaje para el líder (Enter para nueva línea, clic en enviar o Ctrl+Enter)..."
              value={planningResponseComment}
              onChange={(e) => setPlanningResponseComment(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  handleSendChatMessage(false);
                }
              }}
              disabled={sendingChatMessage}
              sx={{
                bgcolor: '#ffffff',
                borderRadius: 4,
                '& .MuiOutlinedInput-root': {
                  borderRadius: 4,
                  fontSize: 13,
                  lineHeight: 1.45,
                  bgcolor: '#ffffff',
                  p: 1.2
                }
              }}
            />
            <Tooltip title="Enviar mensaje (Ctrl+Enter o clic) y notificar al correo institucional del líder" arrow>
              <span>
                <IconButton
                  disabled={sendingChatMessage || !planningResponseComment.trim()}
                  onClick={() => handleSendChatMessage(false)}
                  sx={{
                    bgcolor: '#00a884',
                    color: '#ffffff',
                    width: 42,
                    height: 42,
                    boxShadow: '0 2px 5px rgba(0,0,0,0.18)',
                    '&:hover': { bgcolor: '#008f6f' },
                    '&.Mui-disabled': { bgcolor: '#cbd5e1', color: '#94a3b8' }
                  }}
                >
                  {sendingChatMessage ? <CircularProgress size={18} color="inherit" /> : <Send sx={{ fontSize: 18 }} />}
                </IconButton>
              </span>
            </Tooltip>
          </Stack>
        </Box>
      </Dialog>

      {/* DIÁLOGO GOOGLE CALENDAR PARA SEGUIMIENTO DEL PLAN DE ACCIÓN */}
      {detail?.id && (
        <MeetingCalendarScheduler
          dialogMode
          open={calendarSchedulerOpen}
          onClose={() => setCalendarSchedulerOpen(false)}
          service={strategicPlanningService}
          contextType="action_plan"
          planId={detail.id}
          title={`Programar reunión de seguimiento · ${detail.code || 'Plan de Acción'}`}
          minuteTitle={`Seguimiento Plan de Acción: ${detail.code || ''} - ${detail.organizationalUnit?.name || detail.title || ''}`}
          defaultLocation="Presencial / Sala de Juntas UNICESMAG"
          responsibles={calendarResponsibles}
          participants={calendarParticipants}
          lookupParticipantByDocument={async (doc) => {
            const pedId = detail?.term?.strategicPlan?.id || platformPlan?.id;
            if (!pedId) throw new Error('No se identificó el PED');
            const res = await strategicPlanningService.lookupMeetingParticipant(pedId, doc);
            return res.data;
          }}
        />
      )}

            {/* MENÚ DE ACCIONES DE LA ACTIVIDAD (3 PUNTOS) */}
      <Menu
        anchorEl={rowMenuAnchor}
        open={Boolean(rowMenuAnchor)}
        onClose={handleCloseRowMenu}
        PaperProps={{
          sx: {
            borderRadius: 2.5,
            boxShadow: '0 8px 24px rgba(15,23,42,0.14)',
            minWidth: 260,
            py: 0.5
          }
        }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem
          onClick={() => {
            const r = activeMenuRow;
            handleCloseRowMenu();
            if (r) editItem(r);
          }}
          sx={{ py: 1, fontSize: 13.5, fontWeight: 700, color: '#1e293b' }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: '#2563eb' }}>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Editar actividad" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }} />
        </MenuItem>

        <MenuItem
          onClick={() => {
            const r = activeMenuRow;
            if (r) handleOpenReplicateDialog(r);
          }}
          sx={{ py: 1, fontSize: 13.5, fontWeight: 700, color: '#0f766e' }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: '#0f766e' }}>
            <DriveFileMove fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Trasladar / Replicar actividad"
            secondary="Asociar o replicar en otros planes"
            primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700 }}
            secondaryTypographyProps={{ fontSize: 11, color: '#64748b' }}
          />
        </MenuItem>

        <Divider sx={{ my: 0.5 }} />

        <MenuItem
          onClick={() => {
            const r = activeMenuRow;
            if (r) handlePromptDeleteItem(r);
          }}
          sx={{ py: 1, fontSize: 13.5, fontWeight: 700, color: '#dc2626' }}
        >
          <ListItemIcon sx={{ minWidth: 32, color: '#dc2626' }}>
            <DeleteOutline fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="Eliminar actividad" primaryTypographyProps={{ fontSize: 13.5, fontWeight: 700, color: '#dc2626' }} />
        </MenuItem>
      </Menu>

      {/* MODAL DE TRASLADAR / REPLICAR ACTIVIDAD A OTROS PLANES */}
      <Dialog
        open={replicateModalOpen}
        onClose={() => !replicating && setReplicateModalOpen(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3.5, overflow: 'hidden' }
        }}
      >
        <DialogTitle sx={{ bgcolor: '#0f766e', color: '#ffffff', py: 2, px: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1.5}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#ffffff', width: 40, height: 40 }}>
              <DriveFileMove />
            </Avatar>
            <Box>
              <Typography variant="h6" fontWeight={900} sx={{ fontSize: 17, lineHeight: 1.2 }}>
                Trasladar / Replicar Actividad a otros Planes de Acción
              </Typography>
              <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.85)', fontSize: 12 }}>
                Cree esta actividad en múltiples planes de acción para que cada dependencia gestione y cargue sus soportes de forma autónoma.
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 3, bgcolor: '#f8fafc' }}>
          {/* Tarjeta resumen de la actividad origen */}
          {replicateTargetItem && (
            <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2.5, bgcolor: '#ffffff', borderColor: '#ccfbf1' }}>
              <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                <Chip
                  label={replicateTargetItem.code || 'ACTIVIDAD'}
                  size="small"
                  sx={{ bgcolor: '#0f766e', color: '#ffffff', fontWeight: 900, fontSize: 11 }}
                />
                <Box sx={{ flex: 1 }}>
                  <Typography fontWeight={800} color="#0f172a" sx={{ fontSize: 13.5 }}>
                    {replicateTargetItem.activity || replicateTargetItem.custom_values?.activity || 'Actividad seleccionada'}
                  </Typography>
                  <Stack direction="row" spacing={2} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 1 }}>
                    {replicateTargetItem.indicator_type && (
                      <Typography variant="caption" color="#475569">
                        <strong>Tipo:</strong> {replicateTargetItem.indicator_type}
                      </Typography>
                    )}
                    {replicateTargetItem.indicator && (
                      <Typography variant="caption" color="#475569">
                        <strong>Indicador:</strong> {replicateTargetItem.indicator}
                      </Typography>
                    )}
                    {replicateTargetItem.target && (
                      <Typography variant="caption" color="#475569">
                        <strong>Meta:</strong> {replicateTargetItem.target}
                      </Typography>
                    )}
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          )}

          {/* Selector de Modo: Replicar (Copiar) vs Mover (Trasladar) */}
          <Paper variant="outlined" sx={{ p: 2, mb: 2.5, borderRadius: 2.5, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
            <Typography fontWeight={800} color="#1e293b" sx={{ fontSize: 13, mb: 1 }}>
              Modalidad de operación:
            </Typography>
            <RadioGroup
              row
              value={replicateAsMove ? 'move' : 'copy'}
              onChange={(e) => setReplicateAsMove(e.target.value === 'move')}
            >
              <FormControlLabel
                value="copy"
                control={<Radio size="small" sx={{ color: '#0f766e', '&.Mui-checked': { color: '#0f766e' } }} />}
                label={
                  <Box>
                    <Typography fontWeight={800} sx={{ fontSize: 13, color: '#0f172a' }}>
                      Replicar (Copiar)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      Mantiene la actividad en este plan y crea una copia independiente en los planes seleccionados.
                    </Typography>
                  </Box>
                }
                sx={{ mr: 3, alignItems: 'flex-start' }}
              />
              <FormControlLabel
                value="move"
                control={<Radio size="small" sx={{ color: '#d97706', '&.Mui-checked': { color: '#d97706' } }} />}
                label={
                  <Box>
                    <Typography fontWeight={800} sx={{ fontSize: 13, color: '#0f172a' }}>
                      Mover (Trasladar)
                    </Typography>
                    <Typography variant="caption" sx={{ color: '#64748b', display: 'block' }}>
                      Transfiere la actividad a los planes destino y la retira de este plan de acción.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: 'flex-start' }}
              />
            </RadioGroup>
          </Paper>

          {/* Selección de Planes de Acción Destino */}
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 2.5, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1.5} mb={2}>
              <Box>
                <Typography fontWeight={800} color="#1e293b" sx={{ fontSize: 13.5 }}>
                  Planes de acción destino ({availablePlans.length} disponibles)
                </Typography>
                <Typography variant="caption" color="#64748b">
                  {selectedTargetPlanIds.length} plan(es) seleccionado(s)
                </Typography>
              </Box>
              <TextField
                size="small"
                placeholder="Buscar por dependencia, código o líder..."
                value={replicateSearch}
                onChange={(e) => setReplicateSearch(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" sx={{ color: '#94a3b8' }} />
                    </InputAdornment>
                  )
                }}
                sx={{ width: { xs: '100%', sm: 300 } }}
              />
            </Stack>

            {loadingAvailablePlans ? (
              <Box sx={{ py: 6, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <CircularProgress size={32} sx={{ color: '#0f766e' }} />
              </Box>
            ) : (() => {
              const termLower = (replicateSearch || '').toLowerCase().trim();
              const filteredPlans = availablePlans.filter((p) => {
                if (!termLower) return true;
                const name = (p.organizationalUnit?.name || p.title || '').toLowerCase();
                const code = (p.code || '').toLowerCase();
                const owner = (p.responsibleUser?.nombre || p.responsibleUser?.name || '').toLowerCase();
                return name.includes(termLower) || code.includes(termLower) || owner.includes(termLower);
              });

              const allFilteredSelected = filteredPlans.length > 0 && filteredPlans.every((p) => selectedTargetPlanIds.includes(p.id));

              return (
                <>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 1, py: 0.5, bgcolor: '#f1f5f9', borderRadius: 1.5, mb: 1 }}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          size="small"
                          checked={allFilteredSelected}
                          indeterminate={filteredPlans.some((p) => selectedTargetPlanIds.includes(p.id)) && !allFilteredSelected}
                          onChange={() => handleSelectAllFilteredPlans(filteredPlans)}
                          sx={{ color: '#0f766e', '&.Mui-checked': { color: '#0f766e' } }}
                        />
                      }
                      label={
                        <Typography fontWeight={700} sx={{ fontSize: 12.5, color: '#334155' }}>
                          Seleccionar todos los visibles ({filteredPlans.length})
                        </Typography>
                      }
                    />
                    {selectedTargetPlanIds.length > 0 && (
                      <Button
                        size="small"
                        onClick={() => setSelectedTargetPlanIds([])}
                        sx={{ fontSize: 11.5, textTransform: 'none', color: '#64748b' }}
                      >
                        Limpiar selección
                      </Button>
                    )}
                  </Stack>

                  <Box sx={{ maxHeight: 320, overflowY: 'auto', pr: 0.5 }}>
                    {filteredPlans.length === 0 ? (
                      <Typography align="center" color="#94a3b8" sx={{ py: 4, fontSize: 13 }}>
                        No se encontraron planes de acción coincidentes.
                      </Typography>
                    ) : (
                      filteredPlans.map((p) => {
                        const isSelected = selectedTargetPlanIds.includes(p.id);
                        const depName = p.organizationalUnit?.name || p.title || 'Dependencia';
                        const leaderName = p.responsibleUser?.nombre || p.responsibleUser?.name || 'Líder asignado';
                        return (
                          <Paper
                            key={p.id}
                            variant="outlined"
                            onClick={() => handleToggleTargetPlan(p.id)}
                            sx={{
                              p: 1.25,
                              mb: 1,
                              borderRadius: 2,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              bgcolor: isSelected ? '#f0fdfa' : '#ffffff',
                              borderColor: isSelected ? '#14b8a6' : '#e2e8f0',
                              transition: 'all 0.15s ease-in-out',
                              '&:hover': { bgcolor: isSelected ? '#ccfbf1' : '#f8fafc' }
                            }}
                          >
                            <Checkbox
                              size="small"
                              checked={isSelected}
                              onChange={() => handleToggleTargetPlan(p.id)}
                              sx={{ color: '#0f766e', '&.Mui-checked': { color: '#0f766e' }, mr: 1 }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography fontWeight={800} color="#0f172a" sx={{ fontSize: 13, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {depName}
                              </Typography>
                              <Stack direction="row" spacing={1.5} alignItems="center">
                                <Typography variant="caption" sx={{ color: '#0f766e', fontWeight: 700 }}>
                                  {p.code}
                                </Typography>
                                <Typography variant="caption" color="#64748b">
                                  • Líder: {leaderName}
                                </Typography>
                              </Stack>
                            </Box>
                          </Paper>
                        );
                      })
                    )}
                  </Box>
                </>
              );
            })()}
          </Paper>
        </DialogContent>

        <DialogActions sx={{ p: 2.5, bgcolor: '#f8fafc', borderTop: '1px solid #e2e8f0', justifyContent: 'space-between' }}>
          <Button
            onClick={() => setReplicateModalOpen(false)}
            disabled={replicating}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#64748b' }}
          >
            Cancelar
          </Button>

          <Button
            variant="contained"
            onClick={handleExecuteReplicate}
            disabled={replicating || selectedTargetPlanIds.length === 0}
            startIcon={replicating ? <CircularProgress size={16} sx={{ color: '#ffffff' }} /> : <DriveFileMove />}
            sx={{
              textTransform: 'none',
              fontWeight: 850,
              bgcolor: replicateAsMove ? '#d97706' : '#0f766e',
              '&:hover': { bgcolor: replicateAsMove ? '#b45309' : '#0d5e56' },
              borderRadius: 2,
              px: 3
            }}
          >
            {replicating
              ? 'Procesando en Drive y Base de Datos...'
              : replicateAsMove
                ? `Mover a ${selectedTargetPlanIds.length} plan(es)`
                : `Replicar a ${selectedTargetPlanIds.length} plan(es)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN DE ACTIVIDAD */}
      <Dialog
        open={Boolean(deleteItemCandidate)}
        onClose={() => !deletingItem && setDeleteItemCandidate(null)}
        maxWidth="xs"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ textAlign: 'center', pt: 3 }}>
          <Avatar sx={{ bgcolor: '#fee2e2', color: '#dc2626', width: 56, height: 56, mx: 'auto', mb: 1.5 }}>
            <DeleteOutline sx={{ fontSize: 32 }} />
          </Avatar>
          <Typography variant="h6" fontWeight={900} color="#1e293b" sx={{ fontSize: 17 }}>
            ¿Eliminar actividad?
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ textAlign: 'center', pb: 2 }}>
          <Typography color="#64748b" sx={{ fontSize: 13.5, mb: 1.5 }}>
            Esta acción retirará la actividad{' '}
            <strong style={{ color: '#0f172a' }}>{deleteItemCandidate?.code}</strong> de este plan de acción.
          </Typography>
          <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0', textAlign: 'left' }}>
            <Typography fontWeight={700} color="#334155" sx={{ fontSize: 12.5 }}>
              {deleteItemCandidate?.activity || deleteItemCandidate?.custom_values?.activity || 'Actividad seleccionada'}
            </Typography>
          </Paper>
        </DialogContent>
        <DialogActions sx={{ p: 2, bgcolor: '#f8fafc', justifyContent: 'center', gap: 1 }}>
          <Button
            onClick={() => setDeleteItemCandidate(null)}
            disabled={deletingItem}
            sx={{ textTransform: 'none', fontWeight: 700, color: '#64748b', px: 2.5 }}
          >
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={handleExecuteDeleteItem}
            disabled={deletingItem}
            startIcon={deletingItem ? <CircularProgress size={16} sx={{ color: '#ffffff' }} /> : <DeleteOutline />}
            sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2, px: 2.5 }}
          >
            {deletingItem ? 'Eliminando...' : 'Sí, eliminar'}
          </Button>
        </DialogActions>
      </Dialog>

{/* BOTÓN FLOTANTE PARA ACCESO DIRECTO AL CANAL DE COMUNICACIÓN CON PLANEACIÓN Y EFECTIVIDAD */}
      {detail?.id && (
        <Tooltip
          title="Aquí podrá comunicarse directamente con el componente de Planeación y Efectividad para sugerencias, reclamos o consultas sobre el plan de acción a su cargo."
          arrow
          placement="left"
        >
          <Fab
            onClick={() => setFeedbackChatModalOpen(true)}
            sx={{
              position: 'fixed',
              bottom: 28,
              right: 32,
              bgcolor: '#008069',
              color: '#ffffff',
              boxShadow: '0 8px 24px rgba(0,128,105,.45)',
              '&:hover': { bgcolor: '#006a57' },
              zIndex: 1300
            }}
          >
            <Badge badgeContent={chatThread.length} color="error" max={99} invisible={chatThread.length === 0}>
              <ChatBubbleOutline sx={{ fontSize: 28 }} />
            </Badge>
          </Fab>
        </Tooltip>
      )}

    </Dialog>
  );
}
