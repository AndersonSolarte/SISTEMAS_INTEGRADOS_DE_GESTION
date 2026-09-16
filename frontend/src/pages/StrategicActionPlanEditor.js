import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { Add, AutoAwesome, CheckCircle, CheckCircleOutline, CloudUpload, ContentCopy, DeleteOutline, Description, Download, Edit, Event, InsertDriveFile, PersonSearch, PlayArrow, QrCode2, Refresh, Save } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../services/strategicPlanningService';
import logoFormatos from '../assets/logo_formatos.jpg';

const ACTION_LABELS = {
  schedule_meeting: 'Programar reunión', start_formulation: 'Iniciar formulación',
  submit_preliminary_minutes: 'Enviar acta preliminar', submit_technical_review: 'Enviar a revisión técnica',
  request_adjustments: 'Solicitar ajustes', resubmit_technical_review: 'Reenviar revisión',
  submit_owner_validation: 'Enviar al responsable', request_owner_adjustments: 'Devolver para ajustes',
  notify_rectorate: 'Informar a Rectoría', activate: 'Activar plan', start_monitoring: 'Iniciar seguimientos', close: 'Cerrar vigencia'
};
const STATUS_LABELS = {
  convocation: 'Convocatoria', meeting_scheduled: 'Reunión programada', formulation: 'Formulación',
  preliminary_minutes: 'Acta preliminar', technical_review: 'Revisión técnica', adjustments: 'Ajustes',
  owner_validation: 'Validación del responsable', rectorate_notification: 'Información a Rectoría',
  active: 'Plan activo', monitoring: 'Seguimientos', closed: 'Cerrado'
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
const emptyMeeting = { starts_at: '', ends_at: '', location: '', modality: 'Presencial', objective: '', development: '', conclusions: '', participants_text: '' };
const PLANNING_DEPARTMENT_NAME = 'Dirección de Planeación y Aseguramiento de la Calidad';

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
  const [meetingParticipants, setMeetingParticipants] = useState([]);
  const [participantDocument, setParticipantDocument] = useState('');
  const [participantCandidate, setParticipantCandidate] = useState(null);
  const [participantSearching, setParticipantSearching] = useState(false);
  const [improvingMeetingField, setImprovingMeetingField] = useState('');
  const [generatingMinuteSummary, setGeneratingMinuteSummary] = useState(false);
  const [monitoring, setMonitoring] = useState({ item_id: '', period_id: '', physical_progress: '', observations: '', file: null, description: '' });
  const [published, setPublished] = useState(null);
  const [dynamicImportPreview, setDynamicImportPreview] = useState(null);
  const [editingItemId, setEditingItemId] = useState(null);

  // Minute preview state (COM-IF-FR-002)
  const [editingActa, setEditingActa] = useState(false);
  const [actaData, setActaData] = useState({
    responsables: '', dependencia: '', lugar: '', fecha: '', horario: '', objetivo: '', desarrollo: '', conclusiones: '', participantes: []
  });

  const load = useCallback(async () => {
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

  useEffect(() => {
    if (detail) {
      const activeMeeting = detail.meetings?.[0] || {};
      const firstItem = detail.items?.[0] || {};
      const defaultStart = activeMeeting.starts_at || firstItem.starts_on;
      const defaultEnd = activeMeeting.ends_at || firstItem.ends_on;
      const savedConclusions = (activeMeeting.commitments || [])
        .map((entry) => typeof entry === 'string' ? entry : `${entry.description || ''}${entry.responsible ? ` — ${entry.responsible}` : ''}`)
        .filter(Boolean)
        .join('\n');

      setMeeting({
        starts_at: toDatetimeLocal(defaultStart, 8),
        ends_at: toDatetimeLocal(defaultEnd, 10),
        location: activeMeeting.location || locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
        modality: activeMeeting.modality || 'Presencial',
        objective: activeMeeting.objective || (firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.'),
        development: activeMeeting.development || 'Se consolidó el plan revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales.',
        conclusions: savedConclusions || 'Se aprueban los registros del Plan de Acción y se genera el acta formal para firmas.',
        participants_text: activeMeeting.participants_text || (
          (activeMeeting.participants && activeMeeting.participants.length > 0)
            ? activeMeeting.participants.map((p) => `${p.name || ''} | ${p.email || ''} | UNICESMAG | ${p.role_title || ''}`).join('\n')
            : `${detail.owner?.name || 'Líder del Proceso'} | ${detail.owner?.email || 'lider@unicesmag.edu.co'} | UNICESMAG | Responsable Institucional`
        )
      });
      setMeetingParticipants((activeMeeting.participants || []).map((p) => ({
        id: p.id, user_id: p.user_id, document: p.user?.username || p.document || '', name: p.name || '', email: p.email || '',
        organization: p.organization || '', role_title: p.role_title || '', signature_required: p.signature_required !== false,
        status: p.status || 'invited'
      })));

      const dateStr = activeMeeting.starts_at ? new Date(activeMeeting.starts_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
      const timeStr = activeMeeting.starts_at && activeMeeting.ends_at
        ? `${new Date(activeMeeting.starts_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })} - ${new Date(activeMeeting.ends_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`
        : '08:00 - 10:00';
      const latestMinute = [...(activeMeeting.minuteVersions || [])]
        .sort((a, b) => Number(b.version || 0) - Number(a.version || 0))[0];
      const signaturesByParticipant = new Map(
        (latestMinute?.signatures || []).map((signature) => [String(signature.participant_id), signature])
      );
      const parsedParts = (activeMeeting.participants || []).map((p) => ({
        nombre: p.name || '',
        cargo: p.role_title || p.organization || '',
        status: p.status || 'invited',
        signature_preview: signaturesByParticipant.get(String(p.id))?.signature_preview || ''
      }));

      setActaData({
        responsables: detail.organizationalUnit?.name || 'Área responsable del Plan de Acción',
        dependencia: PLANNING_DEPARTMENT_NAME,
        lugar: activeMeeting.location || locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
        fecha: dateStr,
        horario: timeStr,
        objetivo: activeMeeting.objective || (firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.'),
        desarrollo: activeMeeting.development || 'Se consolidó el plan revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales.',
        conclusiones: savedConclusions || 'Se aprueban los registros del Plan de Acción y se genera el acta formal para firmas.',
        participantes: parsedParts.length ? parsedParts : [
          { nombre: detail.owner?.name || 'Líder del Proceso', cargo: detail.owner?.cargo || 'Responsable' }
        ]
      });
    }
  }, [detail, locations]);

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
  const hasMeetingDate = Boolean(detail?.meetings?.[0]?.starts_at || meeting?.starts_at);
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
          SelectProps={multiple ? { multiple: true } : undefined}
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
            <MenuItem key={option.value} value={option.value}>
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
    const next = [...meetingParticipants, {
      user_id: participantCandidate.id, document: participantCandidate.document, name: participantCandidate.name,
      email: participantCandidate.email, organization: participantCandidate.dependency || participantCandidate.viceRectorate || 'UNICESMAG',
      role_title: participantCandidate.position || '', signature_required: true, status: 'invited'
    }];
    setMeetingParticipants(next);
    setActaData((previous) => ({ ...previous, participantes: next.map((p) => ({ nombre: p.name, cargo: p.role_title, status: p.status })) }));
    setParticipantCandidate(null); setParticipantDocument('');
  };
  const removeMeetingParticipant = (index) => {
    const participant = meetingParticipants[index];
    if (participant?.status === 'signed') return enqueueSnackbar('No puede retirar a una persona que ya firmó esta acta.', { variant: 'warning' });
    const next = meetingParticipants.filter((_, current) => current !== index);
    setMeetingParticipants(next);
    setActaData((previous) => ({ ...previous, participantes: next.map((p) => ({ nombre: p.name, cargo: p.role_title, status: p.status })) }));
  };
  const improveMeetingText = async (field) => {
    const currentText = String(meeting[field] || '').trim();
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
  const saveMeeting = async () => {
    if (!meeting.starts_at || !meeting.objective.trim()) return enqueueSnackbar('Fecha y objetivo son obligatorios.', { variant: 'warning' });
    if (!meetingParticipants.length) return enqueueSnackbar('Agregue al menos un participante a la agenda.', { variant: 'warning' });
    setSaving(true);
    try {
      await strategicPlanningService.createMeeting(planId, {
        ...meeting,
        type: 'formulation',
        participants: meetingParticipants,
        commitments: meeting.conclusions.trim() ? [meeting.conclusions.trim()] : []
      });
      setMeeting(emptyMeeting); await load(); enqueueSnackbar('Reunión y participantes registrados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible programar la reunión.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
  const generateMinute = async (meetingId) => {
    try { await strategicPlanningService.createMinute(meetingId); await load(); enqueueSnackbar('Borrador institucional COM-IF-FR-002 generado.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible generar el acta.', { variant: 'error' }); }
  };
  const publishMinute = async (minuteId) => {
    try {
      const current = detail?.meetings?.[0]?.minuteVersions?.find((version) => String(version.id) === String(minuteId));
      const response = await strategicPlanningService.publishMinute(minuteId, {
        regenerate: current?.status === 'signing',
        public_base_url: window.location.origin
      });
      setPublished(response.data); await load(); enqueueSnackbar('Acta congelada y QR habilitado.', { variant: 'success' });
    }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible publicar el acta.', { variant: 'error' }); }
  };
  const enableQrSigning = async () => {
    const activeMeeting = detail?.meetings?.[0];
    if (!activeMeeting) return enqueueSnackbar('Primero guarde la reunión y sus participantes.', { variant: 'warning' });
    try {
      const versions = [...(activeMeeting.minuteVersions || [])].sort((a, b) => Number(b.version) - Number(a.version));
      let minuteVersion = versions.find((version) => ['draft', 'review', 'signing'].includes(version.status));
      if (!minuteVersion) {
        const created = await strategicPlanningService.createMinute(activeMeeting.id);
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
              <Box sx={{ display: 'flex', flexDirection: { xs: 'column', lg: 'row' }, gap: 3, alignItems: 'flex-start' }}>
                <Box sx={{ width: { xs: '100%', lg: '42%' }, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
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

                    <Alert severity="info" icon={<AutoAwesome sx={{ color: '#0284c7' }} />} sx={{ mt: 2, borderRadius: 2.5, bgcolor: '#f0f9ff' }}>
                      Puedes usar el audio de la sesión como apoyo para IA. La recomendación es procesarlo temporalmente y no almacenarlo.
                    </Alert>

                    <Paper elevation={0} sx={{ p: 2, mt: 2, borderRadius: 2.5, bgcolor: '#fffbeb', border: '1px solid #fde68a' }}>
                      <Typography fontWeight={900} color="#b45309" sx={{ fontSize: 13, mb: 0.5 }}>Solución poderosa recomendada</Typography>
                      <Typography variant="body2" color="#92400e" sx={{ fontSize: 12, lineHeight: 1.5 }}>
                        Mientras el profesional crea actividades y escribe observaciones, el sistema consolida un borrador de acta institucional.
                      </Typography>
                    </Paper>
                  </Paper>

                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#e2e8f0' }}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5} mb={2}>
                      <Box>
                        <Typography fontWeight={900} color="#0f172a">Datos de la Reunión</Typography>
                        <Typography variant="caption" color="#64748b">Los cambios aparecen inmediatamente en el formato.</Typography>
                      </Box>
                      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1}>
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={generatingMinuteSummary ? <CircularProgress size={15} color="inherit" /> : <AutoAwesome fontSize="small" />}
                          disabled={generatingMinuteSummary || !detail?.items?.length}
                          onClick={generateMinuteSummary}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850, bgcolor: '#2458a6', '&:hover': { bgcolor: '#1d4b8f' } }}
                        >
                          {generatingMinuteSummary ? 'Analizando actividades…' : `Generar desde actividades (${detail?.items?.length || 0})`}
                        </Button>
                        <Button size="small" variant="text" startIcon={<Refresh fontSize="small" />} onClick={() => {
                        if (!detail) return;
                        const activeMeeting = detail.meetings?.[0] || {};
                        const firstItem = detail.items?.[0] || {};
                        setMeeting({
                          starts_at: toDatetimeLocal(activeMeeting.starts_at || firstItem.starts_on, 8),
                          ends_at: toDatetimeLocal(activeMeeting.ends_at || firstItem.ends_on, 10),
                          location: activeMeeting.location || locations[0]?.name || 'Presencial / Sala de Juntas UNICESMAG',
                          modality: activeMeeting.modality || 'Presencial',
                          objective: activeMeeting.objective || (firstItem.activity ? `Concertación y revisión de la actividad: ${firstItem.activity}` : 'Concertación e integración del Plan de Acción Institucional.'),
                          development: activeMeeting.development || 'Se consolidó el plan revisando los objetivos estratégicos, proyectos, metas e indicadores institucionales.',
                          conclusions: (activeMeeting.commitments || [])
                            .map((entry) => typeof entry === 'string' ? entry : `${entry.description || ''}${entry.responsible ? ` — ${entry.responsible}` : ''}`)
                            .filter(Boolean)
                            .join('\n') || 'Se aprueban los registros del Plan de Acción y se genera el acta formal para firmas.',
                          participants_text: activeMeeting.participants_text || (
                            (activeMeeting.participants && activeMeeting.participants.length > 0)
                              ? activeMeeting.participants.map((p) => `${p.name || ''} | ${p.email || ''} | UNICESMAG | ${p.role_title || ''}`).join('\n')
                              : `${detail.owner?.name || 'Líder del Proceso'} | ${detail.owner?.email || 'lider@unicesmag.edu.co'} | UNICESMAG | Responsable Institucional`
                          )
                        });
                        enqueueSnackbar('Datos de la reunión precargados desde el plan.', { variant: 'info' });
                        }} sx={{ textTransform: 'none', fontWeight: 800, fontSize: 12, color: '#5688c7' }}>
                          Restablecer desde el plan
                        </Button>
                      </Stack>
                    </Stack>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', sm: 'repeat(2,minmax(0,1fr))' }, gap: 2 }}>
                      <TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Inicio" value={meeting.starts_at} onChange={(e) => setMeeting({ ...meeting, starts_at: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                      <TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Fin" value={meeting.ends_at} onChange={(e) => setMeeting({ ...meeting, ends_at: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
                      <TextField fullWidth select label="Lugar" value={meeting.location} onChange={(e) => setMeeting({ ...meeting, location: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}>{locations.map((entry) => <MenuItem key={entry.id} value={entry.name}>{entry.name}</MenuItem>)}</TextField>
                      <TextField fullWidth select label="Modalidad" value={meeting.modality} onChange={(e) => setMeeting({ ...meeting, modality: e.target.value })} sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }}>{['Presencial','Virtual','Híbrida'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>
                      {[
                        { key: 'objective', label: 'Objetivo de la reunión', rows: 3, required: true },
                        { key: 'development', label: 'Desarrollo de la reunión', rows: 5 },
                        { key: 'conclusions', label: 'Conclusiones / Compromisos', rows: 3, helperText: 'Redacte los acuerdos, responsables o compromisos definidos en la reunión.' }
                      ].map((field) => (
                        <Box key={field.key} sx={{ gridColumn: '1 / -1' }}>
                          <Stack direction="row" justifyContent="flex-end" mb={0.75}>
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={improvingMeetingField === field.key ? <CircularProgress size={15} /> : <AutoAwesome fontSize="small" />}
                              disabled={Boolean(improvingMeetingField) || !String(meeting[field.key] || '').trim()}
                              onClick={() => improveMeetingText(field.key)}
                              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850, color: '#2458a6', borderColor: '#a9c9ee' }}
                            >
                              {improvingMeetingField === field.key ? 'Mejorando…' : 'Mejorar redacción con IA'}
                            </Button>
                          </Stack>
                          <TextField
                            fullWidth
                            required={field.required}
                            multiline
                            minRows={field.rows}
                            label={field.label}
                            value={meeting[field.key]}
                            onChange={(event) => setMeeting((previous) => ({ ...previous, [field.key]: event.target.value }))}
                            helperText={field.helperText}
                            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2.5, alignItems: 'flex-start' } }}
                          />
                        </Box>
                      ))}
                      <Box sx={{ gridColumn: '1 / -1' }}>
                        <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: '#f5f9ff', border: '1px solid #cfe0f4' }}>
                          <Typography fontWeight={900} color="#17345f">Agenda y participantes</Typography>
                          <Typography variant="body2" color="#64748b" mb={1.5}>Digite la cédula. SIAC completará el nombre, cargo, dependencia y correo para la firma por QR.</Typography>
                          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                            <TextField fullWidth size="small" label="Cédula del participante" value={participantDocument} onChange={(e) => { setParticipantDocument(e.target.value.replace(/[^0-9A-Za-z-]/g, '')); setParticipantCandidate(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); lookupParticipant(); } }} />
                            <Button variant="outlined" startIcon={participantSearching ? <CircularProgress size={16} /> : <PersonSearch />} disabled={participantSearching || !participantDocument.trim()} onClick={lookupParticipant} sx={{ minWidth: 132, borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Consultar</Button>
                          </Stack>
                          {participantCandidate && (
                            <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, border: '1px solid #a9c9ee', borderRadius: 2, bgcolor: '#ffffff' }}>
                              <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} gap={1.5}>
                                <Box><Typography fontWeight={900}>{participantCandidate.name}</Typography><Typography variant="body2" color="#64748b">{participantCandidate.position || 'Cargo no registrado'} · {participantCandidate.dependency || 'Dependencia no registrada'}</Typography><Typography variant="caption" color="#5680b2">{participantCandidate.email}</Typography></Box>
                                <Button variant="contained" startIcon={<Add />} onClick={addMeetingParticipant} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 850 }}>Agregar</Button>
                              </Stack>
                            </Paper>
                          )}
                          <Stack spacing={1} mt={meetingParticipants.length ? 1.5 : 0}>
                            {meetingParticipants.map((participant, index) => (
                              <Box key={participant.id || participant.user_id || index} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr auto', sm: 'minmax(180px,1.4fr) minmax(130px,1fr) auto' }, gap: 1.25, alignItems: 'center', p: 1.25, borderRadius: 2, bgcolor: '#ffffff', border: '1px solid #dbe7f4' }}>
                                <Box><Typography variant="body2" fontWeight={850}>{participant.name}</Typography><Typography variant="caption" color="#64748b">CC {participant.document || 'registrada en SIAC'} · {participant.email}</Typography></Box>
                                <Box sx={{ display: { xs: 'none', sm: 'block' } }}><Typography variant="body2" color="#475569">{participant.role_title || 'Sin cargo'}</Typography><Typography variant="caption" color="#64748b">{participant.organization || 'UNICESMAG'}</Typography></Box>
                                <Stack direction="row" alignItems="center" spacing={0.5}><Chip size="small" label={participant.status === 'signed' ? 'Firmado' : 'Firma pendiente'} color={participant.status === 'signed' ? 'success' : 'default'} /><Button aria-label={`Retirar a ${participant.name}`} color="error" size="small" disabled={participant.status === 'signed'} onClick={() => removeMeetingParticipant(index)}><DeleteOutline fontSize="small" /></Button></Stack>
                              </Box>
                            ))}
                          </Stack>
                        </Box>
                      </Box>
                    </Box>
                    <Button sx={{ mt: 2.5, borderRadius: 2.5, px: 3, fontWeight: 900 }} variant="contained" startIcon={<Event />} onClick={saveMeeting}>
                      Guardar reunión
                    </Button>
                  </Paper>
                </Box>

                <Box sx={{ width: { xs: '100%', lg: '58%' } }}>
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3.5, bgcolor: '#ffffff', borderColor: '#e2e8f0', boxShadow: '0 4px 20px rgba(0,0,0,0.03)' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                      <Box>
                        <Typography variant="h6" fontWeight={900} color="#0f172a" sx={{ fontSize: 16 }}>Vista Previa del Acta</Typography>
                        <Typography variant="body2" color="#64748b" sx={{ fontSize: 12 }}>
                          {editingActa ? 'Modo edición activo. Ajuste los valores del acta.' : 'Vista en tiempo real del formato institucional COM-IF-FR-002.'}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                        {!editingActa ? (
                          <Button size="small" variant="outlined" startIcon={<Edit fontSize="small" />} onClick={() => setEditingActa(true)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                            Editar acta
                          </Button>
                        ) : (
                          <Button size="small" variant="contained" color="success" startIcon={<Save fontSize="small" />} onClick={() => { setEditingActa(false); enqueueSnackbar('Borrador del acta actualizado.', { variant: 'success' }); }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                            Guardar acta
                          </Button>
                        )}
                        <Button size="small" variant="contained" startIcon={<Description />} onClick={() => generateMinute(detail?.meetings?.[0]?.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800 }}>
                          Generar borrador
                        </Button>
                        <Button size="small" variant="contained" startIcon={<QrCode2 />} disabled={!detail?.meetings?.[0]} onClick={enableQrSigning} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, bgcolor: '#244f91', '&:hover': { bgcolor: '#173b73' } }}>
                          {detail?.meetings?.[0]?.minuteVersions?.some((version) => version.status === 'signing') ? 'Regenerar QR' : 'Habilitar firmas QR'}
                        </Button>
                      </Stack>
                    </Stack>

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
                        <span>{detail?.organizationalUnit?.name || actaData.responsables}</span>
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
                          <TextField size="small" variant="standard" fullWidth multiline minRows={2} value={actaData.objetivo} onChange={(e) => setActaField('objetivo', e.target.value)} />
                        ) : (
                          <span>{actaData.objetivo}</span>
                        )}
                      </Box>

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Desarrollo
                      </Box>
                      <Box sx={{ p: 0.8, borderBottom: '1px solid #000000', minHeight: 70 }}>
                        {editingActa ? (
                          <TextField size="small" variant="standard" fullWidth multiline minRows={3} value={actaData.desarrollo} onChange={(e) => setActaField('desarrollo', e.target.value)} />
                        ) : (
                          <span>{actaData.desarrollo}</span>
                        )}
                      </Box>

                      <Box sx={{ bgcolor: '#d9d9d9', p: 0.6, textAlign: 'center', fontWeight: 900, borderBottom: '1px solid #000000' }}>
                        Conclusiones / Compromisos
                      </Box>
                      <Box sx={{ p: 0.8, minHeight: 50 }}>
                        {editingActa ? (
                          <TextField size="small" variant="standard" fullWidth multiline minRows={2} value={actaData.conclusiones} onChange={(e) => setActaField('conclusiones', e.target.value)} />
                        ) : (
                          <span>{actaData.conclusiones}</span>
                        )}
                      </Box>
                    </Box>
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
                        <Button variant="outlined" startIcon={<Description />} onClick={() => generateMinute(detail?.meetings?.[0]?.id)} sx={{ minWidth: 200, height: 44, borderRadius: 2.5, fontWeight: 900, textTransform: 'none' }}>
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
      <DialogActions sx={{ borderTop:'1px solid #e3e5ef', px: { xs: 2, md: 3 }, py: 1.5, bgcolor: 'rgba(255,255,255,.96)', flexWrap: 'wrap', gap: 1 }}>
        <Button startIcon={<Download />} onClick={exportPlan} sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 2 }}>
          Exportar DIR-PE-FR-003 (.xlsx)
        </Button>
        <Button onClick={onClose} variant="outlined" sx={{ fontWeight: 800, textTransform: 'none', borderRadius: 2 }}>
          Cerrar formulario
        </Button>
      </DialogActions>
    </Dialog>
  );
}
