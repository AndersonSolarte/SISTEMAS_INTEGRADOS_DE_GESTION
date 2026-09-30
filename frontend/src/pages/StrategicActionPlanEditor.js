// PEI StrategicActionPlanEditor Module
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, IconButton, Menu, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, ToggleButton, ToggleButtonGroup, Typography
} from '@mui/material';
import { Add, ArrowBack, AutoAwesome, CheckCircle, CheckCircleOutline, CloudUpload, ContentCopy, DeleteOutline, Description, Download, Edit, EditNote, Event, InsertDriveFile, KeyboardArrowDown, PersonSearch, PlayArrow, QrCode2, Refresh, Save, Send, ViewSidebar, Visibility } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../services/strategicPlanningService';
import logoFormatos from '../assets/logo_formatos.jpg';
import RichTextEditor, { sanitizeRichHtml } from '../components/meetingMinute/RichTextEditor';

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
const emptyItem = { macroactivity: '', activity: '', indicator_type: '', starts_on: '', ends_on: '', indicator: '', target: '', co_responsibles: '', budget: '', custom_values: {} };
const ACTIVITY_FORM_EXCLUDED_KEYS = new Set(['responsible','progress_s1','observations_s1','progress_s2','observations_s2','total_progress']);
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
const MEETING_ROLE_OPTIONS = [
  { value: 'principal', label: 'Responsable principal' },
  { value: 'co_responsible', label: 'Corresponsable' },
  { value: 'collaborator', label: 'Colaborador' },
  { value: 'participant', label: 'Participante' }
];
const MEETING_RESPONSIBILITY_ROLE_OPTIONS = MEETING_ROLE_OPTIONS.filter((option) => ['principal', 'co_responsible'].includes(option.value));
const MEETING_ATTENDEE_ROLE_OPTIONS = MEETING_ROLE_OPTIONS.filter((option) => ['collaborator', 'participant'].includes(option.value));
const meetingRoleLabel = (value) => MEETING_ROLE_OPTIONS.find((option) => option.value === value)?.label || 'Participante';
const richTextPlain = (value = '') => sanitizeRichHtml(String(value || ''))
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/p>|<\/div>|<\/li>|<\/tr>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim();

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

export default function StrategicActionPlanEditor({ open, planId, platformPlan, workflow, onClose, onChanged }) {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState('activities');
  const [detail, setDetail] = useState(null);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(emptyItem);
  const [meeting, setMeeting] = useState(emptyMeeting);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [participantDocument, setParticipantDocument] = useState('');
  const [participantCandidate, setParticipantCandidate] = useState(null);
  const [participantMeetingRole, setParticipantMeetingRole] = useState('principal');
  const [participantSearching, setParticipantSearching] = useState(false);
  const [attendeeDocument, setAttendeeDocument] = useState('');
  const [attendeeCandidate, setAttendeeCandidate] = useState(null);
  const [attendeeMeetingRole, setAttendeeMeetingRole] = useState('participant');
  const [attendeeSearching, setAttendeeSearching] = useState(false);
  const [externalAttendeeMode, setExternalAttendeeMode] = useState(false);
  const [externalAttendee, setExternalAttendee] = useState({ document: '', name: '', email: '', organization: '', role_title: '' });
  const [improvingMeetingField, setImprovingMeetingField] = useState('');
  const [generatingMinuteSummary, setGeneratingMinuteSummary] = useState(false);
  const [monitoring, setMonitoring] = useState({ item_id: '', period_id: '', physical_progress: '', observations: '', file: null, description: '' });
  const [published, setPublished] = useState(null);
  const [dynamicImportPreview, setDynamicImportPreview] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);
  const [syncingMinute, setSyncingMinute] = useState(false);
  const [lastDriveSync, setLastDriveSync] = useState(null);

  // Minute preview state (COM-IF-FR-002)
  const [editingActa, setEditingActa] = useState(false);
  const [meetingLayoutMode, setMeetingLayoutMode] = useState('split');
  const [pdfMenuAnchor, setPdfMenuAnchor] = useState(null);
  const [actaData, setActaData] = useState({
    responsables: '', dependencia: '', lugar: '', fecha: '', horario: '', objetivo: '', desarrollo: '', conclusiones: '', participantes: []
  });  const load = useCallback(async () => {
    if (!planId) return;
    setLoading(true);
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
      } else {
        setStructure([]);
      }
    } catch (error) {
      console.error('Error al cargar Plan de Acción:', error);
      const message = error.code === 'ECONNABORTED'
        ? 'El servidor tardó demasiado en responder. Intente cargar nuevamente el Plan de Acción.'
        : error.response?.data?.message || error.message || 'No fue posible cargar el formulario del plan.';
      setLoadError(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [planId, platformPlan?.id, enqueueSnackbar]);

  useEffect(() => { if (open) load(); }, [open, load]);

  const locations = useMemo(() => (platformPlan?.catalogItems || []).filter((entry) => entry.catalog_type === 'meeting_location' && entry.active), [platformPlan?.catalogItems]);

  const activeMeeting = useMemo(() => {
    const meetings = detail?.meetings || [];
    if (selectedMeetingId === '__new__') return null;
    return meetings.find((entry) => String(entry.id) === String(selectedMeetingId)) || meetings[0] || null;
  }, [detail?.meetings, selectedMeetingId]);

  const latestMinute = useMemo(() => {
    if (!activeMeeting?.minuteVersions?.length) return null;
    return [...activeMeeting.minuteVersions].sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
  }, [activeMeeting]);

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

  const handleFinalizeMinute = async () => {
    if (!latestMinute) return enqueueSnackbar('Primero genere o habilite una versión del acta.', { variant: 'warning' });
    setSyncingMinute(true);
    try {
      const response = await strategicPlanningService.finalizeMinute(latestMinute.id);
      if (response?.data?.driveSync) {
        setLastDriveSync(response.data.driveSync);
      }
      await load();
      enqueueSnackbar(response?.message || 'Acta formalizada y sincronizada en Google Drive.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible formalizar el acta.', { variant: 'error' });
    } finally {
      setSyncingMinute(false);
    }
  };

  useEffect(() => {
    if (detail) {
      const currentMeeting = activeMeeting || {};
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
      const storedParticipants = currentMeeting.participants || [];
      const hasStoredPrincipal = storedParticipants.some((participant) => participant.meeting_role === 'principal');
      setMeetingParticipants(storedParticipants.map((p, index) => ({
        id: p.id, user_id: p.user_id, document: p.user?.username || p.document || '', name: p.name || '', email: p.email || '',
        organization: p.organization || '', role_title: p.role_title || '', signature_required: p.signature_required !== false,
        meeting_role: p.meeting_role === 'principal' || hasStoredPrincipal ? (p.meeting_role || 'participant') : (index === 0 ? 'principal' : 'participant'),
        status: p.status || 'invited'
      })));

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
      const parsedParts = storedParticipants.map((p, index) => ({
        nombre: p.name || '',
        cargo: p.role_title || p.organization || '',
        rol_reunion: p.meeting_role === 'principal' || hasStoredPrincipal ? (p.meeting_role || 'participant') : (index === 0 ? 'principal' : 'participant'),
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
  const periods = detail?.term?.monitoringPeriods || [];
  const rawFields = [...(formSchema?.fields || activePed?.fieldDefinitions || platformPlan?.fieldDefinitions || [])].filter((field) => field.active !== false).sort((a, b) => a.position - b.position);
  const formElements = formSchema?.elements || structure;
  const formCatalogs = formSchema?.catalogs || activePed?.catalogItems || platformPlan?.catalogItems || [];

  const DEFAULT_ACTIVITY_FIELDS = [
    { id: 'def-activity', key: 'activity', label: 'Nombre o descripción de la Actividad', data_type: 'long_text', required: true, position: 1 },
    { id: 'def-indicator-type', key: 'indicator_type', label: 'Tipo de Indicador', data_type: 'list', required: false, position: 2, options: ['Gestión','Resultado','Producto','Impacto'] },
    { id: 'def-indicator', key: 'indicator', label: 'Indicador', data_type: 'text', required: false, position: 3 },
    { id: 'def-target', key: 'target', label: 'Meta', data_type: 'text', required: false, position: 4 },
    { id: 'def-starts-on', key: 'starts_on', label: 'Fecha de inicio', data_type: 'date', required: false, position: 5 },
    { id: 'def-ends-on', key: 'ends_on', label: 'Fecha de fin', data_type: 'date', required: false, position: 6 },
    { id: 'def-co-responsibles', key: 'co_responsibles', label: 'Corresponsable(s)', data_type: 'text', required: false, position: 7 }
  ];

  const activeFields = rawFields.length > 0 ? rawFields : DEFAULT_ACTIVITY_FIELDS;

  const hasDependencia = Boolean(detail?.dependency_id || detail?.dependency_name || activePed?.dependency_name || detail?.academic_unit || detail?.organizationalUnit?.name);
  const hasMeetingDate = Boolean(activeMeeting?.starts_at || meeting?.starts_at);
  const hasActivities = Boolean(detail?.items && detail.items.length > 0);
  const hasLeader = Boolean(detail?.responsible || detail?.leader_name || detail?.owner?.name);
  const activityFields = activeFields.filter((field) => field.data_type !== 'formula' && !ACTIVITY_FORM_EXCLUDED_KEYS.has(field.key));
  const recordColumns = activeFields;
  const recordValue = (row, field) => {
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

  const fieldValue = (field) => {
    const direct = { activity: item.activity, indicator_type: item.indicator_type, starts_on: item.starts_on, ends_on: item.ends_on, indicator: item.indicator, target: item.target, co_responsibles: item.co_responsibles };
    return Object.prototype.hasOwnProperty.call(direct, field.key) ? direct[field.key] : item.custom_values?.[field.key];
  };
  const setFieldValue = (field, value) => {
    if (['activity','indicator_type','starts_on','ends_on','indicator','target','co_responsibles'].includes(field.key)) setItem((current) => ({ ...current, [field.key]: value }));
    else setItem((current) => ({ ...current, custom_values: { ...(current.custom_values || {}), [field.key]: value } }));
  };
  const renderConfiguredField = (field) => {
    const catalogType = field.validation_rules?.catalog_type;
    const catalogEntries = catalogType ? formCatalogs.filter((entry) => entry.catalog_type === catalogType && entry.active) : [];
    let options = catalogEntries.length ? catalogEntries.map((entry) => ({ value: entry.id, label: `${entry.code} · ${entry.name}` })) : (field.options || []).map((option) => ({ value: option, label: option }));
    if (field.key === 'indicator_type' && !options.length) options = ['Gestión','Resultado','Producto','Impacto'].map((value) => ({ value, label: value }));
    const multiple = field.data_type === 'catalog_multi';
    const select = ['list', 'catalog', 'catalog_multi'].includes(field.data_type) || field.key === 'indicator_type';
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
        const matchedOpt = options.find((opt) => String(opt.value) === String(val));
        return matchedOpt ? matchedOpt.value : val;
      });
    } else {
      currentValue = rawValue ?? '';
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
          SelectProps={multiple ? { multiple: true, MenuProps: { PaperProps: { sx: { maxWidth: 480 } } } } : { MenuProps: { PaperProps: { sx: { maxWidth: 480 } } } }}
          inputProps={field.data_type === 'percentage' ? { min: 0, max: 100 } : undefined}
          label={field.label}
          value={currentValue}
          onChange={(e) => setFieldValue(field, e.target.value)}
          helperText={
            select && !options.length
              ? 'Esta lista no tiene opciones. Configúrelas en el paso 2 del PED.'
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

  const saveItem = async () => {
    const primaryActivity = (item.activity || '').trim() ||
      String(item.custom_values?.[activityFields[0]?.key] || '').trim() ||
      String(Object.values(item.custom_values || {}).find((v) => String(v || '').trim()) || '').trim();

    if (!primaryActivity) return enqueueSnackbar('Escriba el nombre o descripción principal del registro.', { variant: 'warning' });
    const missingField = activityFields.find((field) => field.required && (Array.isArray(fieldValue(field)) ? !fieldValue(field).length : !String(fieldValue(field) || '').trim()));
    if (missingField) return enqueueSnackbar(`Complete el campo “${missingField.label}”.`, { variant: 'warning' });
    setSaving(true);
    try {
      const payload = {
        code: editingItemId ? detail.items.find((row) => String(row.id) === String(editingItemId))?.code : `ACT-${String((detail.items?.length || 0) + 1).padStart(3, '0')}`,
        strategic_element_id: [...levels].reverse().map((level) => item.custom_values?.[structureKey(level.id)]).find(Boolean) || null,
        activity: primaryActivity, indicator_type: item.indicator_type, indicator: item.indicator,
        target: item.target, starts_on: item.starts_on || null, ends_on: item.ends_on || null,
        co_responsibles: Array.isArray(item.co_responsibles) ? item.co_responsibles : String(item.co_responsibles || '').split(',').map((value) => value.trim()).filter(Boolean),
        custom_values: { ...(item.custom_values || {}) },
        justification: editingItemId ? 'Actualización desde el formulario dinámico' : null
      };
      if (editingItemId) await strategicPlanningService.updateItem(planId, editingItemId, payload);
      else await strategicPlanningService.addItem(planId, payload);
      const wasEditing = Boolean(editingItemId);
      setItem(emptyItem); setEditingItemId(null);
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
    setItem({
      macroactivity: '', activity: row.activity || '', indicator_type: row.indicator_type || '',
      starts_on: row.starts_on || '', ends_on: row.ends_on || '', indicator: row.indicator || '',
      target: row.target || '', co_responsibles: row.co_responsibles || [], budget: '',
      custom_values: { ...(row.custom_values || {}) }
    });
    setTimeout(() => document.getElementById('activity-capture-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const lookupParticipant = async () => {
    const document = participantDocument.trim();
    if (!document) return enqueueSnackbar('Digite la cédula que desea consultar.', { variant: 'warning' });
    const pedId = detail?.term?.strategicPlan?.id || platformPlan?.id;
    if (!pedId) return enqueueSnackbar('No fue posible identificar el PED.', { variant: 'error' });
    setParticipantSearching(true);
    try {
      const response = await strategicPlanningService.lookupMeetingParticipant(pedId, document);
      setParticipantCandidate(response.data);
    } catch (error) {
      setParticipantCandidate(null);
      enqueueSnackbar(error.response?.data?.message || 'No se encontró la cédula en SIAC.', { variant: 'error' });
    } finally { setParticipantSearching(false); }
  };
  const addMeetingParticipant = () => {
    if (!participantCandidate) return;
    if (!participantCandidate.email) return enqueueSnackbar('El usuario no tiene correo y no puede recibir el código de firma.', { variant: 'warning' });
    if (meetingParticipants.some((p) => String(p.user_id) === String(participantCandidate.id))) return enqueueSnackbar('Esta persona ya está en la agenda.', { variant: 'info' });
    const hasPrincipal = meetingParticipants.some((participant) => participant.meeting_role === 'principal');
    const selectedRole = hasPrincipal ? participantMeetingRole : 'principal';
    const normalizedCurrent = selectedRole === 'principal'
      ? meetingParticipants.map((participant) => ({ ...participant, meeting_role: participant.meeting_role === 'principal' ? 'co_responsible' : participant.meeting_role }))
      : meetingParticipants;
    const next = [...normalizedCurrent, {
      user_id: participantCandidate.id, document: participantCandidate.document, name: participantCandidate.name,
      email: participantCandidate.email, organization: participantCandidate.dependency || participantCandidate.viceRectorate || 'UNICESMAG',
      role_title: participantCandidate.position || '', meeting_role: selectedRole, signature_required: true, status: 'invited'
    }];
    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      responsables: next.filter((p) => ['principal', 'co_responsible'].includes(p.meeting_role)).map((p) => p.name).join(', ') || previous.responsables,
      participantes: next.map((p) => ({ nombre: p.name, cargo: p.role_title, rol_reunion: p.meeting_role, status: p.status }))
    }));
    setParticipantMeetingRole('co_responsible');
    setParticipantCandidate(null); setParticipantDocument('');
  };
  const lookupAttendee = async () => {
    const document = attendeeDocument.trim();
    if (!document) return enqueueSnackbar('Digite la cédula que desea consultar.', { variant: 'warning' });
    const pedId = detail?.term?.strategicPlan?.id || platformPlan?.id;
    if (!pedId) return enqueueSnackbar('No fue posible identificar el PED.', { variant: 'error' });
    setAttendeeSearching(true);
    try {
      const response = await strategicPlanningService.lookupMeetingParticipant(pedId, document);
      setAttendeeCandidate(response.data);
      setExternalAttendeeMode(false);
    } catch (error) {
      setAttendeeCandidate(null);
      setExternalAttendee((previous) => ({ ...previous, document }));
      setExternalAttendeeMode(true);
      enqueueSnackbar('La persona no aparece en SIAC. Puede registrarla como participante externo para esta acta.', { variant: 'info' });
    } finally { setAttendeeSearching(false); }
  };
  const addMeetingAttendee = () => {
    if (!attendeeCandidate) return;
    if (!attendeeCandidate.email) return enqueueSnackbar('El usuario no tiene correo y no puede recibir el código de firma.', { variant: 'warning' });
    if (meetingParticipants.some((participant) => String(participant.user_id) === String(attendeeCandidate.id))) return enqueueSnackbar('Esta persona ya está en la agenda.', { variant: 'info' });
    const next = [...meetingParticipants, {
      user_id: attendeeCandidate.id, document: attendeeCandidate.document, name: attendeeCandidate.name,
      email: attendeeCandidate.email, organization: attendeeCandidate.dependency || attendeeCandidate.viceRectorate || 'UNICESMAG',
      role_title: attendeeCandidate.position || '', meeting_role: attendeeMeetingRole, signature_required: true, status: 'invited'
    }];
    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      responsables: next.filter((participant) => ['principal', 'co_responsible'].includes(participant.meeting_role)).map((participant) => participant.name).join(', ') || previous.responsables,
      participantes: next.map((participant) => ({ nombre: participant.name, cargo: participant.role_title, rol_reunion: participant.meeting_role, status: participant.status }))
    }));
    setAttendeeMeetingRole('participant');
    setAttendeeCandidate(null);
    setAttendeeDocument('');
  };
  const addExternalMeetingAttendee = () => {
    const document = externalAttendee.document.trim();
    const name = externalAttendee.name.trim();
    const email = externalAttendee.email.trim().toLowerCase();
    const organization = externalAttendee.organization.trim();
    const roleTitle = externalAttendee.role_title.trim();
    if (!document || !name || !email || !organization || !roleTitle) {
      return enqueueSnackbar('Complete identificación, nombre, correo, entidad y cargo del participante externo.', { variant: 'warning' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return enqueueSnackbar('Digite un correo válido para enviar la invitación de firma.', { variant: 'warning' });
    if (meetingParticipants.some((participant) => participant.document === document || String(participant.email || '').toLowerCase() === email)) {
      return enqueueSnackbar('Esta persona ya está agregada al acta.', { variant: 'info' });
    }
    const next = [...meetingParticipants, {
      user_id: null, participant_type: 'external', document, name, email, organization,
      role_title: roleTitle, meeting_role: attendeeMeetingRole || 'participant', signature_required: true, status: 'invited'
    }];
    setMeetingParticipants(next);
    setActaData((previous) => ({
      ...previous,
      participantes: next.map((participant) => ({ nombre: participant.name, cargo: participant.role_title, entidad: participant.organization, rol_reunion: participant.meeting_role, status: participant.status }))
    }));
    setExternalAttendeeMode(false);
    setExternalAttendee({ document: '', name: '', email: '', organization: '', role_title: '' });
    setAttendeeDocument('');
    enqueueSnackbar('Participante externo agregado. Recibirá la política de tratamiento de datos antes de firmar.', { variant: 'success' });
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
      const response = await strategicPlanningService.generateMinuteSummary(planId, { objective: meeting.objective });
      const development = String(response.data?.development || '').trim();
      const conclusions = String(response.data?.conclusions || '').trim();
      if (!development || !conclusions) throw new Error('No se recibió un resumen completo.');
      setMeeting((previous) => ({ ...previous, development, conclusions }));
      enqueueSnackbar(`Resumen generado desde ${response.data?.activities_analyzed || detail.items.length} actividades. Revíselo antes de guardar.`, { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || error.message || 'No fue posible generar el resumen del acta.', { variant: 'error' });
    } finally {
      setGeneratingMinuteSummary(false);
    }
  };
  const startNewMeeting = () => {
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
    setMeetingParticipants([]);
    setParticipantMeetingRole('principal');
    setParticipantCandidate(null);
    setParticipantDocument('');
    setAttendeeMeetingRole('participant');
    setAttendeeCandidate(null);
    setAttendeeDocument('');
    setExternalAttendeeMode(false);
    setExternalAttendee({ document: '', name: '', email: '', organization: '', role_title: '' });
    setPublished(null);
    enqueueSnackbar('Nueva acta preparada. Complete la información y guárdela.', { variant: 'info' });
  };
  const saveMeeting = async () => {
    if (!meeting.title?.trim() || !meeting.starts_at || !richTextPlain(meeting.objective)) return enqueueSnackbar('Título, fecha y objetivo son obligatorios.', { variant: 'warning' });
    if (!meetingParticipants.length) return enqueueSnackbar('Agregue al menos un participante a la agenda.', { variant: 'warning' });
    if (!meetingParticipants.some((participant) => participant.meeting_role === 'principal')) return enqueueSnackbar('Seleccione un Responsable principal para el acta.', { variant: 'warning' });
    setSaving(true);
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
      if (!activeMeetingId && savedMeeting?.data?.id) setSelectedMeetingId(String(savedMeeting.data.id));
      await load(); enqueueSnackbar(activeMeetingId ? 'Reunión y roles actualizados.' : 'Reunión y participantes registrados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible programar la reunión.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
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
  const publishMinute = async (minuteId) => {
    try {
      const current = activeMeeting?.minuteVersions?.find((version) => String(version.id) === String(minuteId));
      const response = await strategicPlanningService.publishMinute(minuteId, {
        regenerate: current?.status === 'signing',
        public_base_url: window.location.origin
      });
      setPublished(response.data);
      await load();
      const summary = response.data?.invitation_summary;
      if (summary?.failed) {
        enqueueSnackbar(`Acta habilitada. Se enviaron ${summary.sent} de ${summary.total} invitaciones; revise los correos pendientes.`, { variant: 'warning' });
      } else {
        enqueueSnackbar(summary
          ? `Acta habilitada y ${summary.sent} invitaci${summary.sent === 1 ? 'Ã³n enviada' : 'ones enviadas'} para firma.`
          : 'Acta congelada y firmas habilitadas.', { variant: 'success' });
      }
    }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible publicar el acta.', { variant: 'error' }); }
  };
  const enableQrSigning = async () => {
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
      await publishMinute(minuteVersion.id);
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible habilitar la firma por QR.', { variant: 'error' }); }
  };

  const saveFollowUp = async () => {
    if (!monitoring.item_id || !monitoring.period_id) return enqueueSnackbar('Seleccione actividad y periodo.', { variant: 'warning' });
    setSaving(true);
    try {
      await strategicPlanningService.saveMonitoring(monitoring.item_id, monitoring.period_id, { physical_progress: monitoring.physical_progress, observations: monitoring.observations, status: 'submitted' });
      if (monitoring.file) { const body = new FormData(); body.append('file', monitoring.file); body.append('monitoring_period_id', monitoring.period_id); body.append('description', monitoring.description); await strategicPlanningService.uploadEvidence(monitoring.item_id, body); }
      setMonitoring({ item_id: '', period_id: '', physical_progress: '', observations: '', file: null, description: '' }); await load(); onChanged?.(); enqueueSnackbar('Seguimiento y evidencia guardados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el seguimiento.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
  const transition = async (action) => {
    try { await strategicPlanningService.transition(planId, { action, comment: `Acción ejecutada desde el formulario: ${ACTION_LABELS[action] || action}` }); await load(); onChanged?.(); enqueueSnackbar('Estado actualizado.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'La transición no fue permitida.', { variant: 'error' }); }
  };
  const exportPlan = async () => {
    try { const blob = await strategicPlanningService.exportActionPlan(planId); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = `DIR-PE-FR-003_${detail.code}_${detail.term?.year}.xlsx`; anchor.click(); URL.revokeObjectURL(url); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible exportar el formato.', { variant: 'error' }); }
  };
  const downloadDynamicTemplate = async () => {
    try {
      const blob = await strategicPlanningService.downloadDynamicItemTemplate(planId); const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `PLANTILLA_DINAMICA_${detail.code}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
      enqueueSnackbar('Plantilla creada con los campos actuales de este PED.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible generar la plantilla dinámica.', { variant: 'error' }); }
  };
  const previewDynamicImport = async (file) => {
    if (!file) return; const body = new FormData(); body.append('file', file);
    try { const response = await strategicPlanningService.previewDynamicItems(planId, body); setDynamicImportPreview(response.data); enqueueSnackbar('Archivo revisado. Confirme la carga cuando no existan errores.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible revisar la plantilla.', { variant: 'error' }); }
  };
  const confirmDynamicImport = async () => {
    try { await strategicPlanningService.confirmDynamicItems(dynamicImportPreview.id); setDynamicImportPreview(null); await load(); onChanged?.(); enqueueSnackbar('Registros creados o actualizados desde Excel.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible confirmar la carga.', { variant: 'error' }); }
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
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
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
            <Stack direction="row" spacing={1.25} alignItems="center" sx={{ position: 'relative', zIndex: 1 }}>
              {detail && ['owner_validation', 'formulation', 'adjustments', 'technical_review'].includes(detail.status) && (
                <Button
                  variant="contained"
                  startIcon={<PlayArrow />}
                  onClick={() => transition('activate')}
                  sx={{
                    fontWeight: 900,
                    textTransform: 'none',
                    borderRadius: 2.5,
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
                  sx={{ bgcolor: '#059669', color: '#ffffff', fontWeight: 900, px: 1 }}
                />
              )}
              <Button
                variant="outlined"
                onClick={load}
                startIcon={<Refresh />}
                sx={{ '&&': { color: '#ffffff', borderColor: 'rgba(255,255,255,.72)', bgcolor: 'rgba(255,255,255,.10)' }, '&&:hover': { color: '#ffffff', borderColor: '#ffffff', bgcolor: 'rgba(255,255,255,.20)' }, textTransform: 'none', fontWeight: 800, borderRadius: 2.5 }}
              >
                Actualizar
              </Button>
              <Button
                variant="contained"
                onClick={onClose}
                sx={{ '&&': { color: '#ffffff', background: 'rgba(255,255,255,.18)', border: '1px solid rgba(255,255,255,.40)' }, '&&:hover': { color: '#ffffff', background: 'rgba(255,255,255,.28)' }, fontWeight: 900, textTransform: 'none', borderRadius: 2.5, boxShadow: '0 5px 14px rgba(24,43,116,.18)' }}
              >
                Cerrar
              </Button>
            </Stack>
          </Stack>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 1.5, sm: 2.5, md: 3.5 }, bgcolor: '#f7f8fc' }}>
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
                <Paper variant="outlined" sx={{ borderRadius: 4, p: { xs: 1.25, sm: 1.5 }, borderColor: '#d9e3ee', bgcolor: '#ffffff', boxShadow: '0 5px 18px rgba(80,105,135,.045)' }}>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ px: 0.25, pb: 1 }}><Typography fontWeight={950} color="#303a53">Información del Plan de Acción</Typography><Chip size="small" label={detail.schema_is_snapshot ? `Estructura guardada · V${formSchema?.configuration_version || detail.instrument_version}` : 'Estructura compatible'} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, fontWeight: 850, bgcolor: detail.schema_is_snapshot ? '#ddf6e9' : '#fff1d8', color: detail.schema_is_snapshot ? '#277659' : '#9a641b', border: `1px solid ${detail.schema_is_snapshot ? '#bce8d3' : '#f3deb7'}` }} /></Stack>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1.25 }}>
                    {[
                      ['PED', detailPed?.name || activePed?.name || '—'],
                      ['Vigencia', detail.term?.year || '—'],
                      ['Dependencia', detail.organizationalUnit?.name || '—'],
                      ['Responsable', detail.currentResponsibility?.responsibleUser?.nombre || '—']
                    ].map(([label, value]) => <Box key={label} sx={{ px: 1.75, py: 1.1, bgcolor: '#f8fbff', border: '1px solid #e0e8f1', borderRadius: 2.5, minWidth: 0 }}><Typography variant="caption" color="#708096" fontWeight={850}>{label.toUpperCase()}</Typography><Typography fontWeight={900} color="#303a53" noWrap title={String(value)} sx={{ fontSize: 14.5 }}>{value}</Typography></Box>)}
                  </Box>
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
                    gridAutoFlow: 'row dense',
                    alignItems: 'start',
                    gap: { xs: 1.35, md: 1.6 }
                  }}>
                    {activityFields.map(renderConfiguredField)}
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="flex-end" mt={2.25}>
                    <Button
                      variant="contained"
                      startIcon={<Add />}
                      disabled={saving}
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
                    {editingItemId && <Button variant="text" onClick={() => { setEditingItemId(null); setItem(emptyItem); }} sx={{ ml: { sm: 1 }, mt: { xs: 1, sm: 0 }, textTransform: 'none', fontWeight: 850 }}>Cancelar edición</Button>}
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
                          <TableCell align="right" sx={{ position: 'sticky', right: 0, bgcolor: '#f1f5f9', zIndex: 3, fontWeight: 900, color: '#1e293b', borderBottom: '2px solid #cbd5e1' }}>Acción</TableCell>
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
                          detail.items.map((row) => (
                            <TableRow key={row.id} hover sx={{ '&:nth-of-type(even)': { bgcolor: '#f8fafc' } }}>
                              <TableCell sx={{ position: 'sticky', left: 0, bgcolor: 'inherit', fontWeight: 900, color: '#5688c7', zIndex: 1 }}>
                                {row.code}
                              </TableCell>
                              {recordColumns.map((field) => (
                                <TableCell key={field.key} sx={{ maxWidth: 320, whiteSpace: 'normal', fontSize: 13, color: '#334155' }}>
                                  {recordValue(row, field)}
                                </TableCell>
                              ))}
                              <TableCell align="right" sx={{ position: 'sticky', right: 0, bgcolor: 'inherit' }}><Button size="small" variant="outlined" startIcon={<Edit />} onClick={() => editItem(row)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Editar</Button></TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </TableContainer>
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
                        Registro de Asistencia y Reunión
                      </Typography>
                      <Typography sx={{ mt: 0.35, fontSize: 12.5, color: 'rgba(255,255,255,.86)' }}>
                        COM-IF-FR-002 · Acta del Plan de Acción asistida por inteligencia artificial
                      </Typography>
                    </Box>
                    <ToggleButtonGroup
                      exclusive
                      size="small"
                      value={meetingLayoutMode}
                      onChange={(_, value) => value && setMeetingLayoutMode(value)}
                      aria-label="Modo de visualización del acta"
                      sx={{
                        alignSelf: { xs: 'stretch', md: 'center' }, bgcolor: 'rgba(255,255,255,.13)', borderRadius: 2,
                        '& .MuiToggleButton-root': { flex: { xs: 1, md: 'initial' }, color: '#ffffff', borderColor: 'rgba(255,255,255,.35)', px: 1.7, py: 0.75, textTransform: 'none', fontWeight: 800 },
                        '& .MuiToggleButton-root.Mui-selected': { color: '#17458c', bgcolor: '#ffffff', '&:hover': { bgcolor: '#ffffff' } }
                      }}
                    >
                      <ToggleButton value="form" aria-label="Ver formulario"><EditNote fontSize="small" sx={{ mr: 0.7 }} />Formulario</ToggleButton>
                      <ToggleButton value="split" aria-label="Ver formulario y vista previa"><ViewSidebar fontSize="small" sx={{ mr: 0.7 }} />Dividido</ToggleButton>
                      <ToggleButton value="preview" aria-label="Ver vista previa"><Visibility fontSize="small" sx={{ mr: 0.7 }} />Vista previa</ToggleButton>
                    </ToggleButtonGroup>
                  </Stack>
                </Paper>

                <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: meetingLayoutMode === 'split' ? 'row' : 'column' }, gap: 2.5, alignItems: 'stretch', width: '100%' }}>
                <Box sx={{
                  width: meetingLayoutMode === 'form' ? '100%' : meetingLayoutMode === 'split' ? { xs: '100%', lg: '47%' } : '100%',
                  display: meetingLayoutMode === 'preview' ? 'none' : 'flex',
                  flexDirection: 'column', gap: 2.5
                }}>
                  <Paper variant="outlined" sx={{ order: 1, p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#cbd9e9' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1.5} mb={1.5}>
                      <Box>
                        <Typography fontWeight={900} color="#0f172a">Actas de reunión</Typography>
                        <Typography variant="body2" color="#64748b">Cree una nueva acta o continúe trabajando en una guardada de este Plan de Acción.</Typography>
                      </Box>
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
                    <Typography variant="caption" color="#526176" sx={{ display: 'block', mt: 1 }}>
                      Esta acta pertenece únicamente al Plan de Acción {detail?.code}. No modifica el módulo general de actas.
                    </Typography>
                  </Paper>

                  <Paper variant="outlined" sx={{ order: 3, p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#d8e5f2' }}>
                    <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
                      <AutoAwesome sx={{ color: '#6f9fd7' }} />
                      <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 16 }}>Acta Asistida por IA</Typography>
                    </Stack>
                    <Typography variant="body2" color="#64748b" mb={2}>
                      El acta se alimenta automáticamente de observaciones, actividades y audio temporal de la sesión.
                    </Typography>

                    <Button fullWidth component="label" variant="outlined" startIcon={<CloudUpload />} sx={{ height: 44, borderRadius: 2.5, textTransform: 'none', fontWeight: 800, borderColor: '#cbd5e1', color: '#1e293b' }}>
                      Adjuntar audio temporal de la sesión
                      <input hidden type="file" accept="audio/*" onChange={() => enqueueSnackbar('Audio adjuntado temporalmente para transcripción.', { variant: 'info' })} />
                    </Button>

                  </Paper>

                  <Paper variant="outlined" sx={{ order: 2, p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#cbd9e9' }}>
                    <Box mb={2}>
                      <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 16 }}>1. Información de la reunión</Typography>
                      <Typography variant="body2" color="#64748b">Complete los datos y responsables. Los cambios aparecen inmediatamente en el formato.</Typography>
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
                      <TextField fullWidth required label="Título corto del acta" value={meeting.title || ''} onChange={(e) => setMeeting({ ...meeting, title: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                      <TextField fullWidth disabled label="Dependencia que cita" value={PLANNING_DEPARTMENT_NAME} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, bgcolor: '#f8fafc' } }} />
                      <TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Inicio" value={meeting.starts_at} onChange={(e) => setMeeting({ ...meeting, starts_at: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                      <TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Fin" value={meeting.ends_at} onChange={(e) => setMeeting({ ...meeting, ends_at: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                      <Box>
                        <TextField fullWidth label="Lugar" value={meeting.location} onChange={(e) => setMeeting({ ...meeting, location: e.target.value })} inputProps={{ list: 'strategic-meeting-locations' }} helperText="Seleccione una opción o escriba otro lugar." sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                        <datalist id="strategic-meeting-locations">{locations.map((entry) => <option key={entry.id} value={entry.name} />)}</datalist>
                      </Box>
                      <TextField fullWidth select label="Modalidad" value={meeting.modality} onChange={(e) => setMeeting({ ...meeting, modality: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}>{['Presencial','Virtual','Híbrida'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>

                      <Box sx={{ gridColumn: '1 / -1', my: 0.5 }}>
                        <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f0f7ff', border: '1px solid #bae0ff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <AutoAwesome sx={{ color: '#0284c7' }} />
                            <Box>
                              <Typography fontWeight={850} color="#0369a1" sx={{ fontSize: 13.5 }}>Consolidar borrador del acta con IA</Typography>
                              <Typography variant="body2" color="#0284c7" sx={{ fontSize: 12 }}>Redacta automáticamente el objetivo, desarrollo y compromisos a partir de las {detail?.items?.length || 0} actividades del plan.</Typography>
                            </Box>
                          </Box>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Button
                              size="small"
                              variant="contained"
                              startIcon={generatingMinuteSummary ? <CircularProgress size={15} color="inherit" /> : <AutoAwesome fontSize="small" />}
                              disabled={generatingMinuteSummary || !detail?.items?.length}
                              onClick={generateMinuteSummary}
                              sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 850, px: 2, py: 0.75, bgcolor: '#0284c7', '&:hover': { bgcolor: '#0369a1' } }}
                            >
                              {generatingMinuteSummary ? 'Analizando actividades…' : `Generar desde actividades (${detail?.items?.length || 0})`}
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
                              Restablecer datos
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
                            <Typography fontWeight={800} color="#1e293b" sx={{ fontSize: 13.5 }}>
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
                            onChange={(value) => setMeeting((previous) => ({ ...previous, [field.key]: value }))}
                            minHeight={field.rows >= 5 ? 190 : 135}
                            error={field.required && !richTextPlain(meeting[field.key])}
                          />
                          {field.helperText && <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.75, ml: 1 }}>{field.helperText}</Typography>}
                        </Box>
                      ))}
                      <Box sx={{ gridColumn: '1 / -1', gridRow: 1 }}>
                        <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f5f9ff', border: '1px solid #cfe0f4' }}>
                          <Typography fontWeight={900} color="#17345f">Responsables de la reunión ({meetingParticipants.filter((entry) => ['principal', 'co_responsible'].includes(entry.meeting_role)).length})</Typography>
                          <Typography variant="body2" color="#64748b" mb={1.5}>Consulte la cédula y asigne solamente Responsable principal o Corresponsable. El responsable principal aparecerá primero en el acta.</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <TextField fullWidth size="small" label="Cédula del responsable" value={participantDocument} onChange={(e) => { setParticipantDocument(e.target.value.replace(/[^0-9A-Za-z-]/g, '')); setParticipantCandidate(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupParticipant(); } }} />
                            <Button variant="outlined" startIcon={participantSearching ? <CircularProgress size={16} /> : <PersonSearch />} disabled={participantSearching || !participantDocument.trim()} onClick={lookupParticipant} sx={{ minWidth: 132, borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Consultar</Button>
                          </Stack>
                          {participantCandidate && (
                            <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, border: '1px solid #a9c9ee', borderRadius: 2, bgcolor: '#ffffff' }}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
                                <Box><Typography fontWeight={900}>{participantCandidate.name}</Typography><Typography variant="body2" color="#64748b">{participantCandidate.position || 'Cargo no registrado'} · {participantCandidate.dependency || 'Dependencia no registrada'}</Typography><Typography variant="caption" color="#5680b2">{participantCandidate.email}</Typography></Box>
                                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                  <TextField select size="small" label="Rol en el acta" value={meetingParticipants.some((participant) => participant.meeting_role === 'principal') ? participantMeetingRole : 'principal'} disabled={!meetingParticipants.some((participant) => participant.meeting_role === 'principal')} onChange={(event) => setParticipantMeetingRole(event.target.value)} sx={{ minWidth: 190 }}>
                                    {MEETING_RESPONSIBILITY_ROLE_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                                  </TextField>
                                  <Button variant="contained" startIcon={<Add />} onClick={addMeetingParticipant} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Agregar</Button>
                                </Stack>
                              </Stack>
                            </Paper>
                          )}
                          <Stack spacing={1} mt={meetingParticipants.some((entry) => ['principal', 'co_responsible'].includes(entry.meeting_role)) ? 1.5 : 0}>
                            {meetingParticipants.map((participant, index) => ({ participant, index })).filter(({ participant }) => ['principal', 'co_responsible'].includes(participant.meeting_role)).map(({ participant, index }) => (
                              <Paper key={participant.id || participant.user_id || index} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: '#ffffff', borderColor: '#dbe7f4', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 1.25 }}>
                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                  <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                    <Typography variant="body2" fontWeight={850} color="#0f172a">{participant.name}</Typography>
                                    <Chip size="small" label={meetingRoleLabel(participant.meeting_role)} color="primary" variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                                  </Stack>
                                  <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.25 }}>CC {participant.document || 'registrada'} · {participant.email}</Typography>
                                  <Typography variant="caption" color="#475569" sx={{ display: 'block', fontWeight: 600 }}>{participant.role_title || 'Sin cargo'} · {participant.organization || 'UNICESMAG'}</Typography>
                                </Box>
                                <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'space-between', md: 'flex-end' }}>
                                  <TextField select size="small" label="Rol" value={participant.meeting_role || (index === 0 ? 'principal' : 'participant')} disabled={participant.status === 'signed'} onChange={(event) => updateMeetingParticipantRole(index, event.target.value)} sx={{ minWidth: 150 }}>
                                    {MEETING_RESPONSIBILITY_ROLE_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                                  </TextField>
                                  <Chip size="small" label={participant.status === 'signed' ? 'Firmado' : 'Firma pendiente'} color={participant.status === 'signed' ? 'success' : 'default'} />
                                  <IconButton aria-label={`Retirar a ${participant.name}`} color="error" size="small" disabled={participant.status === 'signed'} onClick={() => removeMeetingParticipant(index)} sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}>
                                    <DeleteOutline fontSize="small" />
                                  </IconButton>
                                </Stack>
                              </Paper>
                            ))}
                          </Stack>
                        </Box>
                      </Box>
                    </Box>
                    <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 2.5, bgcolor: '#ffffff', border: '1px solid #dbe7f4' }}>
                      <Typography fontWeight={900} color="#17345f">2. Participantes y firmas ({meetingParticipants.filter((entry) => ['collaborator', 'participant'].includes(entry.meeting_role)).length})</Typography>
                      <Typography variant="body2" color="#64748b" mb={1.5}>Agregue aquí colaboradores y demás asistentes. Estos roles permanecen separados de los responsables de la reunión.</Typography>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                        <TextField fullWidth size="small" label="Cédula del participante" value={attendeeDocument} onChange={(event) => { setAttendeeDocument(event.target.value.replace(/[^0-9A-Za-z-]/g, '')); setAttendeeCandidate(null); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); lookupAttendee(); } }} />
                        <Button variant="outlined" startIcon={attendeeSearching ? <CircularProgress size={16} /> : <PersonSearch />} disabled={attendeeSearching || !attendeeDocument.trim()} onClick={lookupAttendee} sx={{ minWidth: 132, borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Consultar</Button>
                      </Stack>
                      {!externalAttendeeMode && (
                        <Button
                          size="small"
                          startIcon={<Add />}
                          onClick={() => {
                            setExternalAttendee((previous) => ({ ...previous, document: attendeeDocument.trim() }));
                            setExternalAttendeeMode(true);
                            setAttendeeCandidate(null);
                          }}
                          sx={{ mt: 1, textTransform: 'none', fontWeight: 850 }}
                        >
                          Agregar participante externo
                        </Button>
                      )}
                      {externalAttendeeMode && (
                        <Paper elevation={0} sx={{ mt: 1.5, p: 1.75, border: '1px solid #a9c9ee', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
                          <Typography fontWeight={900} color="#17345f">Participante externo para esta acta</Typography>
                          <Alert severity="info" sx={{ my: 1.25 }}>
                            Recibirá por correo la invitación, la política de tratamiento de datos de UNICESMAG y deberá aceptarla antes de firmar.
                          </Alert>
                          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))' }, gap: 1.25 }}>
                            <TextField size="small" label="Cédula o identificación" value={externalAttendee.document} onChange={(event) => setExternalAttendee((previous) => ({ ...previous, document: event.target.value }))} />
                            <TextField size="small" label="Nombre completo" value={externalAttendee.name} onChange={(event) => setExternalAttendee((previous) => ({ ...previous, name: event.target.value }))} />
                            <TextField size="small" type="email" label="Correo empresarial o personal" value={externalAttendee.email} onChange={(event) => setExternalAttendee((previous) => ({ ...previous, email: event.target.value }))} />
                            <TextField size="small" label="Cargo" value={externalAttendee.role_title} onChange={(event) => setExternalAttendee((previous) => ({ ...previous, role_title: event.target.value }))} />
                            <TextField size="small" label="Empresa o entidad" value={externalAttendee.organization} onChange={(event) => setExternalAttendee((previous) => ({ ...previous, organization: event.target.value }))} sx={{ gridColumn: { sm: '1 / -1' } }} />
                          </Box>
                          <Stack direction="row" justifyContent="flex-end" spacing={1} mt={1.5}>
                            <Button onClick={() => setExternalAttendeeMode(false)} sx={{ textTransform: 'none' }}>Cancelar</Button>
                            <Button variant="contained" startIcon={<Add />} onClick={addExternalMeetingAttendee} sx={{ textTransform: 'none', fontWeight: 850 }}>Agregar al acta</Button>
                          </Stack>
                        </Paper>
                      )}
                      {attendeeCandidate && (
                        <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, border: '1px solid #a9c9ee', borderRadius: 2, bgcolor: '#f8fbff' }}>
                          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
                            <Box><Typography fontWeight={900}>{attendeeCandidate.name}</Typography><Typography variant="body2" color="#64748b">{attendeeCandidate.position || 'Cargo no registrado'} · {attendeeCandidate.dependency || 'Dependencia no registrada'}</Typography><Typography variant="caption" color="#5680b2">{attendeeCandidate.email}</Typography></Box>
                            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                              <TextField select size="small" label="Rol en el acta" value={attendeeMeetingRole} onChange={(event) => setAttendeeMeetingRole(event.target.value)} sx={{ minWidth: 180 }}>
                                {MEETING_ATTENDEE_ROLE_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                              </TextField>
                              <Button variant="contained" startIcon={<Add />} onClick={addMeetingAttendee} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Agregar participante</Button>
                            </Stack>
                          </Stack>
                        </Paper>
                      )}
                      <Stack spacing={1} mt={meetingParticipants.some((entry) => ['collaborator', 'participant'].includes(entry.meeting_role)) ? 1.5 : 0}>
                        {meetingParticipants.map((participant, index) => ({ participant, index })).filter(({ participant }) => ['collaborator', 'participant'].includes(participant.meeting_role)).map(({ participant, index }) => (
                          <Paper key={participant.id || participant.user_id || index} variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: '#f8fbff', borderColor: '#dbe7f4', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, alignItems: { xs: 'stretch', md: 'center' }, justifyContent: 'space-between', gap: 1.25 }}>
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
                                <Typography variant="body2" fontWeight={850} color="#0f172a">{participant.name}</Typography>
                                <Chip size="small" label={meetingRoleLabel(participant.meeting_role)} color="default" variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 700 }} />
                              </Stack>
                              <Typography variant="caption" color="#64748b" sx={{ display: 'block', mt: 0.25 }}>CC {participant.document || 'registrada'} · {participant.email}</Typography>
                              <Typography variant="caption" color="#475569" sx={{ display: 'block', fontWeight: 600 }}>{participant.role_title || 'Sin cargo'} · {participant.organization || 'UNICESMAG'}</Typography>
                            </Box>
                            <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" justifyContent={{ xs: 'space-between', md: 'flex-end' }}>
                              <TextField select size="small" label="Rol" value={participant.meeting_role || 'participant'} disabled={participant.status === 'signed'} onChange={(event) => updateMeetingParticipantRole(index, event.target.value)} sx={{ minWidth: 150 }}>
                                {MEETING_ATTENDEE_ROLE_OPTIONS.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
                              </TextField>
                              <Chip size="small" label={participant.status === 'signed' ? 'Firmado' : 'Firma pendiente'} color={participant.status === 'signed' ? 'success' : 'default'} />
                              <IconButton aria-label={`Retirar a ${participant.name}`} color="error" size="small" disabled={participant.status === 'signed'} onClick={() => removeMeetingParticipant(index)} sx={{ bgcolor: '#fef2f2', '&:hover': { bgcolor: '#fee2e2' } }}>
                                <DeleteOutline fontSize="small" />
                              </IconButton>
                            </Stack>
                          </Paper>
                        ))}
                      </Stack>
                    </Paper>
                    <Button sx={{ mt: 2.5, borderRadius: 2.5, px: 3, fontWeight: 900 }} variant="contained" startIcon={<Event />} onClick={saveMeeting}>
                      Guardar reunión
                    </Button>
                  </Paper>
                </Box>

                <Box sx={{
                  width: meetingLayoutMode === 'preview' ? '100%' : meetingLayoutMode === 'split' ? { xs: '100%', lg: '53%' } : '100%',
                  display: meetingLayoutMode === 'form' ? 'none' : 'block'
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
                      <Stack direction="row" alignItems="center" gap={0.75} sx={{ color: '#15803d', fontSize: 11, fontWeight: 750, bgcolor: '#f0fdf4', px: 1.25, py: 0.35, borderRadius: 1.5, border: '1px solid #bbf7d0' }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#22c55e' }} />
                        <span>Todo guardado · Autoguardado activo</span>
                      </Stack>
                    </Stack>

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
                      {/* Fila 1: Edición, Descarga y Actualización */}
                      <Box
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: {
                            xs: '1fr',
                            sm: activeMeeting ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))'
                          },
                          gap: 1,
                          width: '100%'
                        }}
                      >
                        {!editingActa ? (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Edit fontSize="small" />}
                            onClick={() => setEditingActa(true)}
                          >
                            Editar acta
                          </Button>
                        ) : (
                          <Button
                            fullWidth
                            variant="contained"
                            color="success"
                            startIcon={<Save fontSize="small" />}
                            onClick={() => {
                              setEditingActa(false);
                              enqueueSnackbar('Borrador del acta actualizado.', { variant: 'success' });
                            }}
                          >
                            Guardar edición
                          </Button>
                        )}
                        <Button
                          fullWidth
                          variant="outlined"
                          endIcon={<KeyboardArrowDown fontSize="small" />}
                          startIcon={<Download fontSize="small" />}
                          onClick={(e) => setPdfMenuAnchor(e.currentTarget)}
                        >
                          Descargar PDF
                        </Button>
                        {activeMeeting && (
                          <Button
                            fullWidth
                            variant="outlined"
                            startIcon={<Refresh fontSize="small" />}
                            onClick={load}
                          >
                            Actualizar firmas
                          </Button>
                        )}
                      </Box>

                      {/* Fila 2: Gestión de firmas y envío final (ocupa ancho completo si está solo) */}
                      {activeMeeting && (() => {
                        const isFinalized = activeMeeting?.status === 'formalized' || latestMinute?.status === 'finalized';
                        const isSigning = activeMeeting?.minuteVersions?.some((v) => v.status === 'signing');
                        const allSigned = meetingParticipants.length > 0 && meetingParticipants.filter((p) => p.signature_required).every((p) => p.status === 'signed');
                        const showResend = isSigning && !allSigned && !isFinalized;
                        const showInvite = !isSigning && !isFinalized;
                        const canSendQr = showResend || showInvite;
                        const canFinalize = (allSigned || isSigning) && !isFinalized;

                        const row2Buttons = [];
                        if (canSendQr) {
                          row2Buttons.push(
                            <Button
                              key="qr-action"
                              fullWidth
                              variant="contained"
                              startIcon={<QrCode2 fontSize="small" />}
                              onClick={enableQrSigning}
                              sx={{ bgcolor: '#244f91', '&:hover': { bgcolor: '#173b73' } }}
                            >
                              {showResend ? 'Reenviar invitaciones' : 'Enviar para firmas'}
                            </Button>
                          );
                        }
                        if (canFinalize) {
                          row2Buttons.push(
                            <Button
                              key="finalize-action"
                              fullWidth
                              variant="contained"
                              color="success"
                              disabled={syncingMinute || !allSigned}
                              startIcon={syncingMinute ? <CircularProgress size={16} color="inherit" /> : <Send fontSize="small" />}
                              onClick={handleFinalizeMinute}
                            >
                              {allSigned ? 'Enviar y formalizar acta' : 'Firma pendiente de participantes'}
                            </Button>
                          );
                        }
                        if (isFinalized) {
                          row2Buttons.push(
                            <Button
                              key="sync-drive-action"
                              fullWidth
                              variant="contained"
                              color="success"
                              disabled={syncingMinute}
                              startIcon={syncingMinute ? <CircularProgress size={16} color="inherit" /> : <InsertDriveFile fontSize="small" />}
                              onClick={handleFinalizeMinute}
                              sx={{ bgcolor: '#15803d', '&:hover': { bgcolor: '#166534' } }}
                            >
                              {syncingMinute ? 'Sincronizando con Drive...' : 'Sincronizar con Google Drive'}
                            </Button>
                          );
                        }

                        if (!row2Buttons.length) return null;

                        return (
                          <Box
                            sx={{
                              display: 'grid',
                              gridTemplateColumns: {
                                xs: '1fr',
                                sm: `repeat(${row2Buttons.length}, minmax(0, 1fr))`
                              },
                              gap: 1,
                              width: '100%'
                            }}
                          >
                            {row2Buttons}
                          </Box>
                        );
                      })()}
                    </Stack>

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

                    <Box sx={{ border: '1px solid #000000', fontFamily: 'Arial, sans-serif', fontSize: 11.5, color: '#000000', bgcolor: '#ffffff', overflow: 'hidden' }}>
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
              </Stack>
            )}

            {/* TAB 3: EXPORTACIÓN INSTITUCIONAL */}
            {tab === 'export' && (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1.2fr' }, gap: 3 }}>
                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" mb={2.5}>
                    <CheckCircleOutline sx={{ color: '#6f9fd7', fontSize: 26 }} />
                    <Box>
                      <Typography variant="h6" fontWeight={900} color="#0f172a">Chequeo de Salida</Typography>
                      <Typography variant="body2" color="#64748b">Validaciones requeridas antes de formalizar el Plan y el Acta.</Typography>
                    </Box>
                  </Stack>

                  <Stack spacing={1.5}>
                    {[
                      { ok: hasDependencia, label: 'Dependencia / Unidad registrada en la vigencia' },
                      { ok: hasMeetingDate, label: 'Fecha de reunión de concertación definida' },
                      { ok: hasActivities, label: `Al menos una actividad cargada (${detail.items?.length || 0} registradas)` },
                      { ok: hasLeader, label: 'Líder / Responsable institucional asignado' }
                    ].map((check, i) => (
                      <Paper key={i} variant="outlined" sx={{ p: 2, borderRadius: 2.5, border: check.ok ? '1px solid #bbf7d0' : '1px solid #fed7aa', bgcolor: check.ok ? '#f0fdf4' : '#fff7ed', display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <CheckCircle sx={{ color: check.ok ? '#16a34a' : '#f97316', fontSize: 20 }} />
                        <Typography fontWeight={700} color={check.ok ? '#15803d' : '#c2410c'} sx={{ fontSize: 13.5 }}>
                          {check.label}
                        </Typography>
                      </Paper>
                    ))}
                  </Stack>
                </Paper>

                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                  <Typography variant="h6" fontWeight={900} color="#0f172a" mb={0.5}>Formatos Institucionales Oficiales</Typography>
                  <Typography variant="body2" color="#64748b" mb={3}>
                    Descargue las versiones finales ajustadas a la normativa institucional de la Universidad CESMAG.
                  </Typography>

                  <Stack spacing={2}>
                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
                        <Box>
                          <Typography fontWeight={900} color="#0f172a">Plan de Acción Oficial DIR-PE-FR-003</Typography>
                          <Typography variant="body2" color="#64748b">Matriz institucional en formato Excel (.xlsx) con todas las actividades e indicadores.</Typography>
                        </Box>
                        <Button variant="contained" startIcon={<Download />} onClick={exportPlan} sx={{ minWidth: 200, height: 44, borderRadius: 2.5, fontWeight: 900, textTransform: 'none' }}>
                          Exportar DIR-PE-FR-003
                        </Button>
                      </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
                        <Box>
                          <Typography fontWeight={900} color="#0f172a">Acta de Concertación COM-IF-FR-002</Typography>
                          <Typography variant="body2" color="#64748b">Formato oficial de Registro de Asistencia y Reunión institucional.</Typography>
                        </Box>
                        <Button variant="outlined" startIcon={<Description />} disabled={!activeMeeting} onClick={() => generateMinute(activeMeeting?.id)} sx={{ minWidth: 200, height: 44, borderRadius: 2.5, fontWeight: 900, textTransform: 'none' }}>
                          Generar Acta Word
                        </Button>
                      </Stack>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={2}>
                        <Box>
                          <Typography fontWeight={900} color="#0f172a">Plantilla Dinámica Excel por PED</Typography>
                          <Typography variant="body2" color="#64748b">Plantilla estructurada automáticamente según los campos activos de este PED.</Typography>
                        </Box>
                        <Button variant="outlined" startIcon={<InsertDriveFile />} onClick={downloadDynamicTemplate} sx={{ minWidth: 200, height: 44, borderRadius: 2.5, fontWeight: 900, textTransform: 'none' }}>
                          Plantilla Dinámica
                        </Button>
                      </Stack>
                    </Paper>
                  </Stack>
                </Paper>
              </Box>
            )}

            {/* TAB 4: FLUJO Y SEGUIMIENTOS S1/S2 */}
            {tab === 'workflow' && (
              <Stack gap={3}>
                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 3.5, bgcolor: '#ffffff' }}>
                  <Typography variant="h6" fontWeight={900} color="#0f172a" mb={2}>Transiciones de Estado de Aprobación</Typography>
                  <Alert severity="warning" sx={{ mb: 2.5, borderRadius: 2.5 }}>
                    Estado actual del Plan de Acción: <strong>{STATUS_LABELS[detail.status] || detail.status}</strong>. Cada cambio queda auditado.
                  </Alert>
                  {availableTransitions.length ? (
                    <Stack direction={{xs:'column',sm:'row'}} gap={2}>
                      {availableTransitions.map((entry) => (
                        <Button key={entry.action} size="large" variant="contained" startIcon={<PlayArrow />} onClick={() => transition(entry.action)} sx={{ borderRadius: 2.5, fontWeight: 900, px: 3 }}>
                          {ACTION_LABELS[entry.action] || entry.action}
                        </Button>
                      ))}
                    </Stack>
                  ) : (
                    <Alert severity="info">No hay transiciones disponibles desde este estado.</Alert>
                  )}
                </Paper>

                <Paper variant="outlined" sx={{ p: 3.5, borderRadius: 3.5, bgcolor: '#ffffff' }}>
                  <Typography variant="h6" fontWeight={900} color="#0f172a" mb={2.5}>Informe de Gestión Semestral (S1 / S2)</Typography>
                  <Grid container spacing={2.5}>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth select label="Actividad del Plan de Acción" value={monitoring.item_id} onChange={(e) => setMonitoring({ ...monitoring, item_id:e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}>
                        {(detail.items || []).map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.code} · {entry.activity}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField fullWidth select label="Semestre del informe" value={monitoring.period_id} onChange={(e) => setMonitoring({ ...monitoring, period_id:e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}>
                        {periods.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.code} · {entry.name}</MenuItem>)}
                      </TextField>
                    </Grid>
                    <Grid item xs={12} md={3}>
                      <TextField fullWidth type="number" inputProps={{min:0,max:100}} label="Avance alcanzado %" value={monitoring.physical_progress} onChange={(e) => setMonitoring({ ...monitoring, physical_progress:e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                    </Grid>
                    <Grid item xs={12}>
                      <TextField fullWidth multiline minRows={3} label="Resultado y observaciones del semestre" value={monitoring.observations} onChange={(e) => setMonitoring({ ...monitoring, observations:e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <Button component="label" fullWidth variant="outlined" startIcon={<CloudUpload />} sx={{ height: 56, borderRadius: 2.5, textTransform: 'none', fontWeight: 800, borderColor: '#cbd5e1', color: '#334155' }}>
                        {monitoring.file?.name || 'Adjuntar evidencia del informe'}
                        <input hidden type="file" onChange={(e) => setMonitoring({ ...monitoring, file:e.target.files?.[0] || null })} />
                      </Button>
                    </Grid>
                    <Grid item xs={12} md={6}>
                      <TextField fullWidth label="Descripción de la evidencia" value={monitoring.description} onChange={(e) => setMonitoring({ ...monitoring, description:e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                    </Grid>
                  </Grid>
                  <Button sx={{ mt: 3, height: 48, borderRadius: 2.5, px: 4, fontWeight: 900 }} variant="contained" disabled={saving} onClick={saveFollowUp}>
                    Guardar informe semestral
                  </Button>
                </Paper>
              </Stack>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions sx={{
        borderTop:'1px solid #d7e3f0', px: { xs: 1.5, md: 3 }, py: 1.25,
        bgcolor: 'rgba(255,255,255,.98)', flexWrap: 'wrap', gap: 1,
        justifyContent: 'space-between', boxShadow: '0 -8px 24px rgba(30,64,175,.06)'
      }}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ flex: 1 }}>
          {tab === 'meeting' ? (
            <Button variant="outlined" startIcon={<Save />} disabled={saving} onClick={saveMeeting} sx={{ fontWeight: 850, textTransform: 'none', borderRadius: 2, minWidth: { sm: 160 } }}>
              {saving ? 'Guardando...' : 'Guardar borrador'}
            </Button>
          ) : (
            <Button startIcon={<Download />} onClick={exportPlan} sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 2 }}>
              Exportar DIR-PE-FR-003 (.xlsx)
            </Button>
          )}
        </Stack>
        <Button onClick={onClose} variant="outlined" sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 2 }}>
          Cerrar formulario
        </Button>
      </DialogActions>
    </Dialog>
  );
}
