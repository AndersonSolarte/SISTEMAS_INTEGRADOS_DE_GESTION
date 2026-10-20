import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Checkbox, Chip, CircularProgress, Collapse, Dialog, Divider, IconButton, LinearProgress, MenuItem, Paper, Stack,
  Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Tooltip, Typography
} from '@mui/material';
import {
  AddRounded as AddIcon,
  AttachFileRounded as AttachIcon,
  ArrowBack as ArrowBackIcon,
  DeleteOutlineRounded as DeleteIcon,
  DownloadRounded as DownloadIcon,
  EditRounded as EditIcon,
  ExpandMoreRounded as ExpandMoreIcon,
  FactCheckRounded as CheckIcon,
  FolderOpenRounded as FolderOpenIcon,
  CloudSyncRounded as CloudSyncIcon,
  CalendarMonthRounded as CalendarIcon,
  FlagRounded as ObjectiveIcon,
  MonetizationOnRounded as BudgetIcon,
  PlaylistAddCheckRounded as PlanIcon,
  PersonAddAlt1Rounded as PersonAddIcon,
  PersonRounded as PersonIcon,
  SchoolRounded as ProgramIcon,
  SaveRounded as SaveIcon,
  TrendingUpRounded as ProgressIcon
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import planMejoramientoService from '../../../../services/planMejoramientoService';
import gestionInformacionService from '../../../../services/gestionInformacionService';

const actionTypeForScore = (score) => Number(String(score ?? '').replace(',', '.')) >= 4 ? 'Fortalecimiento' : 'Mejoramiento';
const PROCESSES = ['DIRECCIONAMIENTO ESTRATÉGICO', 'DOCENCIA', 'INVESTIGACIÓN', 'EXTENSIÓN', 'BIENESTAR', 'GESTIÓN ADMINISTRATIVA', 'ASEGURAMIENTO DE LA CALIDAD'];
const BUDGET_TYPES = [
  ['personal', 'Personal'], ['activos', 'Adquisición de activos'], ['publicidad', 'Publicidad'],
  ['papeleria', 'Útiles y papelería'], ['espacios', 'Espacios físicos y equipos'], ['diversos', 'Diversos']
];
const BUDGET_SUBCATEGORIES = {
  personal: [['docente_tc', 'Docente tiempo completo'], ['docente_mt', 'Docente medio tiempo'], ['otro_personal', 'Otros costos de personal'], ['honorarios', 'Honorarios']],
  espacios: [['auditorios', 'Auditorios'], ['aulas', 'Aulas'], ['otros_institucionales', 'Otros espacios institucionales'], ['deportivos', 'Espacios deportivos'], ['equipos', 'Equipos y plataformas'], ['otros', 'Otros']],
  activos: [['activos', 'Activos']], publicidad: [['publicidad', 'Publicidad']], papeleria: [['papeleria', 'Papelería']], diversos: [['diversos', 'Diversos']]
};

const currentYear = new Date().getFullYear();
const makeLocalId = () => window.crypto?.randomUUID?.() || `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
const emptyActivity = () => ({
  uid: makeLocalId(),
  nombre: '', descripcion: '', indicador: '', meta: '', fechaInicio: '', fechaFin: '', recursos: '',
  procesoResponsable: '', responsableId: null, responsableNombre: '', responsableDocumento: '', responsableEmail: '',
  responsableDependencia: '', responsableVicerrectoria: '', cargoResponsable: '', alcance: 'PROGRAMA', ejeEstrategico: '', objetivoEstrategico: '',
  proyectoPdi: '', politicasInstitucionales: [], lineasAccionPolitica: [],
  metaAlcanzada: '', fechaSeguimiento: '', evidencia: '', evidenceFolderId: '', evidenceFolderUrl: '', evidenceDriveStatus: '',
  observaciones: '', verificacionSeguimiento: 'pendiente', seguimientos: []
});
const emptyObjective = (number) => ({
  codigo: `OPM_${String(number).padStart(2, '0')}`, factor: '', caracteristica: '', aspecto: '', calificacion: '',
  tipoAccion: '', objetivo: '', aspectosAutoevaluacion: [], actividades: [emptyActivity()]
});
const objectiveFromOpportunity = (item, number) => ({
  codigo: `OPM_${String(number).padStart(2, '0')}`,
  factor: item.factor || '',
  caracteristica: item.caracteristica || '',
  aspecto: item.aspecto || '',
  calificacion: Number.isFinite(Number(item.calificacion)) ? Number(item.calificacion) : '',
  tipoAccion: actionTypeForScore(item.calificacion),
  objetivo: '',
  origenAutoevaluacion: {
    id: item.id,
    programa: item.programa,
    indicador: item.indicador,
    evidencia: item.evidencia,
    componente: item.componente,
    informacion: item.informacion
  },
  actividades: [{ ...emptyActivity(), indicador: item.indicador || '' }]
});
const emptyPlan = () => ({
  id: null, programa: '', periodoInicio: currentYear, periodoFin: currentYear + 2, estado: 'borrador',
  objetivos: [], oportunidadesAutoevaluacion: [], presupuesto: [], asignacion: null
});

const buildPlanPayload = (plan) => ({
  programa: plan.programa,
  periodo_inicio: Number(plan.periodoInicio),
  periodo_fin: Number(plan.periodoFin),
  estado: plan.estado,
  contenido: {
    programa: plan.programa,
    periodoInicio: Number(plan.periodoInicio),
    periodoFin: Number(plan.periodoFin),
    objetivos: plan.objetivos || [],
    oportunidadesAutoevaluacion: plan.oportunidadesAutoevaluacion || [],
    presupuesto: plan.presupuesto || []
  }
});
const planSnapshot = (plan) => JSON.stringify(buildPlanPayload(plan));
const driveRepositorySignature = (plan) => JSON.stringify((plan?.objetivos || []).map((objective) => ({
  codigo: objective.codigo || '',
  objetivo: objective.objetivo || '',
  actividades: (objective.actividades || []).map((activity) => ({ uid: activity.uid || '', nombre: activity.nombre || '' }))
})));

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });
const withCurrent = (options = [], current = '') => current && !options.includes(current) ? [current, ...options] : options;
const asStringArray = (value) => Array.isArray(value) ? value.filter(Boolean) : value ? [value] : [];
const withCurrentMany = (options = [], current = []) => Array.from(new Set([...(options || []), ...asStringArray(current)]));
const percent = (activity) => {
  const goal = Number(activity.meta || 0);
  return goal > 0 ? Math.min(100, Math.max(0, (Number(activity.metaAlcanzada || 0) / goal) * 100)) : 0;
};
const objectiveProgress = (objective) => {
  const activities = objective?.actividades || [];
  return activities.length ? activities.reduce((sum, activity) => sum + percent(activity), 0) / activities.length : 0;
};
const activityWeight = (objective) => objective?.actividades?.length ? 100 / objective.actividades.length : 0;
const activityContribution = (objective, activity) => percent(activity) * activityWeight(objective) / 100;
const spaceDiscount = (quantity) => {
  const value = Number(quantity || 0);
  if (value <= 10) return 0;
  if (value <= 40) return 0.1;
  if (value <= 80) return 0.2;
  if (value <= 130) return 0.4;
  if (value <= 180) return 0.5;
  return 0.6;
};
const budgetItemTotal = (item) => {
  const base = Number(item.cantidad || 0) * Number(item.valorUnitario || 0);
  if (item.categoria === 'personal' && ['docente_tc', 'docente_mt'].includes(item.subcategoria)) return base * 1.51852;
  if (item.categoria === 'espacios') return base * (1 - spaceDiscount(item.cantidad));
  return base;
};
const planStats = (plan) => {
  const objectives = plan.objetivos || [];
  const activities = (plan.objetivos || []).flatMap((objective) => objective.actividades || []);
  const progress = objectives.length ? objectives.reduce((sum, objective) => sum + objectiveProgress(objective), 0) / objectives.length : 0;
  const budget = (plan.presupuesto || []).reduce((sum, item) => sum + budgetItemTotal(item), 0);
  return { objectives: objectives.length, activities: activities.length, progress, budget };
};
const statusTone = (status) => ({
  borrador: { label: 'Borrador', color: '#2563eb', soft: '#eff6ff', border: '#bfdbfe' },
  en_ejecucion: { label: 'En ejecución', color: '#047857', soft: '#ecfdf5', border: '#a7f3d0' },
  cerrado: { label: 'Cerrado', color: '#475569', soft: '#f1f5f9', border: '#cbd5e1' }
}[status] || { label: status || 'Sin estado', color: '#475569', soft: '#f1f5f9', border: '#cbd5e1' });
const visiblePlanState = (plan) => !plan?.asignacion?.usuario && plan?.estado === 'en_ejecucion' ? 'borrador' : plan?.estado;
const saveTone = (status) => ({
  pending: { label: 'Cambios pendientes', color: '#b45309', soft: '#fff7ed', border: '#fed7aa' },
  saving: { label: 'Guardando…', color: '#1d4ed8', soft: '#eff6ff', border: '#bfdbfe' },
  saved: { label: 'Todos los cambios guardados', color: '#047857', soft: '#ecfdf5', border: '#a7f3d0' },
  error: { label: 'Error al guardar · Reintentar', color: '#b91c1c', soft: '#fef2f2', border: '#fecaca' }
}[status] || { label: 'Todos los cambios guardados', color: '#047857', soft: '#ecfdf5', border: '#a7f3d0' });
const workflowTone = (status) => ({
  asignado: { label: 'Asignado', color: 'info' },
  en_ejecucion: { label: 'En ejecución', color: 'primary' },
  en_revision: { label: 'En revisión', color: 'warning' },
  devuelto: { label: 'Devuelto para corrección', color: 'error' },
  en_firme: { label: 'En firme', color: 'success' }
}[status] || { label: 'Sin asignar', color: 'default' });

function Metric({ icon, label, value, color }) {
  return (
    <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #e2e8f0', display: 'flex', gap: 1.7, alignItems: 'center' }}>
      <Box sx={{ width: 46, height: 46, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: `${color}15`, color }}>{icon}</Box>
      <Box><Typography variant="caption" sx={{ color: '#64748b', fontWeight: 850, textTransform: 'uppercase' }}>{label}</Typography><Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 950 }}>{value}</Typography></Box>
    </Paper>
  );
}

function ResponsibleAutocomplete({ activity, onChange, label = 'Responsable (nombre o cédula)', helperText = '', size = 'medium' }) {
  const [inputValue, setInputValue] = useState(activity.responsableNombre || activity.responsableDocumento || '');
  const [options, setOptions] = useState([]);
  const [searching, setSearching] = useState(false);
  const [replacementMode, setReplacementMode] = useState(false);

  useEffect(() => {
    setReplacementMode(false);
    setInputValue(activity.responsableNombre || activity.responsableDocumento || '');
  }, [activity.responsableId, activity.responsableNombre, activity.responsableDocumento]);

  useEffect(() => {
    const query = inputValue.trim();
    if (query.length < 2) {
      setOptions([]);
      setSearching(false);
      return undefined;
    }

    let active = true;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const rows = await planMejoramientoService.searchResponsables(query);
        if (active) setOptions(Array.isArray(rows) ? rows : []);
      } catch (_) {
        if (active) setOptions([]);
      } finally {
        if (active) setSearching(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [inputValue]);

  const selected = activity.responsableId && !replacementMode ? {
    id: activity.responsableId,
    nombre: activity.responsableNombre,
    documento: activity.responsableDocumento,
    email: activity.responsableEmail,
    cargo: activity.cargoResponsable,
    dependencia: activity.responsableDependencia,
    vicerrectoria: activity.responsableVicerrectoria
  } : null;

  return (
    <Autocomplete
      value={selected}
      inputValue={inputValue}
      options={options}
      loading={searching}
      filterOptions={(items) => items}
      isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
      getOptionLabel={(option) => [option.nombre, option.documento && `CC ${option.documento}`].filter(Boolean).join(' · ')}
      onInputChange={(_, value, reason) => {
        setInputValue(value);
        if (reason === 'clear') {
          setReplacementMode(true);
          onChange(null);
        }
      }}
      onChange={(_, value) => {
        onChange(value);
        if (!value) setReplacementMode(true);
        setInputValue(value ? [value.nombre, value.documento && `CC ${value.documento}`].filter(Boolean).join(' · ') : '');
      }}
      noOptionsText={inputValue.trim().length < 2 ? 'Escriba al menos 2 caracteres' : 'No se encontraron usuarios activos'}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id} sx={{ display: 'block !important', py: 1.2 }}>
          <Typography sx={{ fontWeight: 850, color: '#0f172a' }}>{option.nombre}</Typography>
          <Typography variant="body2" sx={{ color: '#475569' }}>
            {[option.documento && `CC ${option.documento}`, option.cargo, option.dependencia].filter(Boolean).join(' · ')}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <TextField
          {...params}
          size={size}
          label={label}
          placeholder="Digite nombre o número de documento"
          helperText={helperText}
          InputProps={{
            ...params.InputProps,
            endAdornment: <>{activity.responsableId && !replacementMode && <Button size="small" onMouseDown={(event) => event.preventDefault()} onClick={(event) => { event.stopPropagation(); setReplacementMode(true); setInputValue(''); setOptions([]); }} sx={{ minWidth: 0, mr: 0.5, px: 1, textTransform: 'none', fontWeight: 850 }}>Reasignar</Button>}{searching ? <CircularProgress color="inherit" size={18} /> : null}{params.InputProps.endAdornment}</>
          }}
        />
      )}
    />
  );
}

function PlanMejoramiento({ onBack, executionMode = false }) {
  const { enqueueSnackbar } = useSnackbar();
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [catalogs, setCatalogs] = useState({});
  const [opportunities, setOpportunities] = useState([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPlanId, setExportingPlanId] = useState(null);
  const [saveStatus, setSaveStatus] = useState('saved');
  const [autoSaveNonce, setAutoSaveNonce] = useState(0);
  const [tariffYear, setTariffYear] = useState(currentYear);
  const [importingTariffs, setImportingTariffs] = useState(false);
  const [evidenceFiles, setEvidenceFiles] = useState({});
  const [recordingFollowUp, setRecordingFollowUp] = useState('');
  const [driveSyncStatus, setDriveSyncStatus] = useState('idle');
  const [driveSyncMessage, setDriveSyncMessage] = useState('');
  const [workflowObservation, setWorkflowObservation] = useState('');
  const [activityWorkflowObservations, setActivityWorkflowObservations] = useState({});
  const [correctionResponses, setCorrectionResponses] = useState({});
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [improvementSearch, setImprovementSearch] = useState('');
  const [improvementScoreFilter, setImprovementScoreFilter] = useState('all');
  const [associationOpportunity, setAssociationOpportunity] = useState(null);
  const [associationObjectiveIndex, setAssociationObjectiveIndex] = useState('new');
  const [associationNewObjectiveText, setAssociationNewObjectiveText] = useState('');
  const [evidenceOpportunity, setEvidenceOpportunity] = useState(null);
  const [editor, setEditor] = useState(null);
  const [assignmentPlan, setAssignmentPlan] = useState(null);
  const [tab, setTab] = useState(0);
  const [expandedObjective, setExpandedObjective] = useState(null);
  const [expandedTraceability, setExpandedTraceability] = useState(false);
  const [expandedFollowUpObjective, setExpandedFollowUpObjective] = useState(0);
  const [expandedFollowUpActivity, setExpandedFollowUpActivity] = useState(null);
  const editorRef = useRef(null);
  const lastSavedSnapshotRef = useRef('');
  const saveInFlightRef = useRef(false);
  const queuedSaveRef = useRef(false);
  const tariffInputRef = useRef(null);
  const driveSyncedPlanRef = useRef(null);
  const driveSyncInFlightRef = useRef(false);

  const loadPlans = useCallback(async (synchronize = false) => {
    setLoading(true);
    try {
      if (synchronize) {
        try {
          await planMejoramientoService.syncAutoevaluacion();
        } catch (syncError) {
          enqueueSnackbar(
            syncError.response?.data?.message || 'No fue posible sincronizar la autoevaluación. Se mostrarán los planes guardados.',
            { variant: 'warning' },
          );
        }
      }

      const storedPlans = await planMejoramientoService.list();
      setPlans(Array.isArray(storedPlans) ? storedPlans : []);
    }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar los planes', { variant: 'error' }); }
    finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { loadPlans(!executionMode); }, [loadPlans, executionMode]);
  const loadCatalogs = useCallback(async () => {
    try {
      const data = await planMejoramientoService.catalogs();
      setCatalogs(data || {});
      if (data?.tariffVersion?.vigencia) setTariffYear(Number(data.tariffVersion.vigencia));
      return data;
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las listas automáticas de la plantilla', { variant: 'warning' });
      return null;
    }
  }, [enqueueSnackbar]);
  useEffect(() => { loadCatalogs(); }, [loadCatalogs]);

  useEffect(() => {
    const program = editor?.programa;
    if (!program) { setOpportunities([]); return undefined; }
    let active = true;
    setLoadingOpportunities(true);
    gestionInformacionService.getAutoevaluacionDashboard({ programa: program })
      .then((response) => {
        if (!active) return;
        const evaluated = (response?.data?.aspectos || [])
          .filter((item) => Number.isFinite(Number(item.calificacion)))
          .sort((a, b) => Number(a.calificacion) - Number(b.calificacion));
        setOpportunities(evaluated);
      })
      .catch(() => { if (active) setOpportunities([]); })
      .finally(() => { if (active) setLoadingOpportunities(false); });
    return () => { active = false; };
  }, [editor?.programa]);

  const openPlan = async (id) => {
    try {
      const row = await planMejoramientoService.get(id);
      const content = row.contenido || {};
      const storedOpportunities = content.oportunidadesAutoevaluacion || [];
      const nextEditor = {
        id: row.id, programa: row.programa, periodoInicio: row.periodo_inicio, periodoFin: row.periodo_fin,
        estado: row.estado,
        asignacion: row.asignacion || null,
        objetivos: (content.objetivos || []).map((objective) => {
          const selected = objective.aspectosAutoevaluacion?.length
            ? objective.aspectosAutoevaluacion
            : objective?.origenAutoevaluacion?.id
              ? storedOpportunities.filter((item) => String(item.id) === String(objective.origenAutoevaluacion.id))
              : [];
          const scores = selected.map((item) => Number(item.calificacion)).filter(Number.isFinite);
          return {
            ...objective,
            aspectosAutoevaluacion: selected,
            tipoAccion: scores.length ? (scores.some((score) => score < 4) ? 'Mejoramiento' : 'Fortalecimiento') : objective.tipoAccion,
            actividades: (objective.actividades?.length ? objective.actividades : [emptyActivity()]).map((activity) => ({
              ...activity,
              uid: activity.uid || makeLocalId(),
              politicasInstitucionales: asStringArray(activity.politicasInstitucionales),
              lineasAccionPolitica: asStringArray(activity.lineasAccionPolitica),
              verificacionSeguimiento: activity.verificacionSeguimiento || 'pendiente',
              seguimientos: activity.seguimientos || []
            }))
          };
        }),
        oportunidadesAutoevaluacion: storedOpportunities,
        presupuesto: (content.presupuesto || []).map((item) => ({ ...item, subcategoria: item.subcategoria || BUDGET_SUBCATEGORIES[item.categoria]?.[0]?.[0] || item.categoria }))
      };
      editorRef.current = nextEditor;
      lastSavedSnapshotRef.current = planSnapshot(nextEditor);
      setSaveStatus('saved');
      setEditor(nextEditor);
      driveSyncedPlanRef.current = null;
      setDriveSyncStatus(nextEditor.objetivos.flatMap((item) => item.actividades || []).every((item) => item.evidenceFolderUrl) ? 'synced' : 'idle');
      setDriveSyncMessage('');
      setExpandedObjective(null);
      setExpandedTraceability(false);
      setExpandedFollowUpObjective(0);
      setExpandedFollowUpActivity(nextEditor.objetivos?.[0]?.actividades?.[0]?.uid || null);
      setTab(executionMode ? (row.asignacion?.esColaborador ? 4 : 2) : 0);
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible abrir el plan', { variant: 'error' }); }
  };

  const persistPlan = useCallback(async (plan, { notify = false, refresh = false } = {}) => {
    if (!plan?.programa?.trim()) return null;
    if (saveInFlightRef.current) {
      queuedSaveRef.current = true;
      setSaveStatus('pending');
      return null;
    }

    const requestSnapshot = planSnapshot(plan);
    saveInFlightRef.current = true;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const payload = buildPlanPayload(plan);
      const saved = plan.id
        ? await planMejoramientoService.update(plan.id, payload)
        : await planMejoramientoService.create(payload);
      lastSavedSnapshotRef.current = requestSnapshot;

      let currentPlan = editorRef.current;
      if (currentPlan && !currentPlan.id && saved?.id) {
        currentPlan = { ...currentPlan, id: saved.id };
        editorRef.current = currentPlan;
        setEditor(currentPlan);
      }

      const hasNewChanges = currentPlan && planSnapshot(currentPlan) !== requestSnapshot;
      setSaveStatus(hasNewChanges ? 'pending' : 'saved');
      if (hasNewChanges) queuedSaveRef.current = true;
      if (notify) enqueueSnackbar('Plan de mejoramiento guardado', { variant: 'success' });
      if (refresh) await loadPlans();
      return saved;
    } catch (error) {
      setSaveStatus('error');
      enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el plan. Se conservaron los cambios para volver a intentarlo.', { variant: 'error' });
      return null;
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
      if (queuedSaveRef.current) {
        queuedSaveRef.current = false;
        setAutoSaveNonce((value) => value + 1);
      }
    }
  }, [enqueueSnackbar, loadPlans]);

  const save = () => {
    if (!editor.programa.trim()) return enqueueSnackbar('Ingrese el programa o dependencia', { variant: 'warning' });
    return persistPlan(editor, { notify: true, refresh: true });
  };

  useEffect(() => {
    editorRef.current = editor;
    if (!editor?.programa?.trim()) return undefined;
    const snapshot = planSnapshot(editor);
    if (snapshot === lastSavedSnapshotRef.current) {
      if (!saveInFlightRef.current) setSaveStatus('saved');
      return undefined;
    }

    setSaveStatus('pending');
    const timer = setTimeout(() => persistPlan(editor), 1200);
    return () => clearTimeout(timer);
  }, [editor, persistPlan, autoSaveNonce]);

  const startNewPlan = () => {
    const plan = emptyPlan();
    editorRef.current = plan;
    lastSavedSnapshotRef.current = planSnapshot(plan);
    setSaveStatus('saved');
    setEditor(plan);
    setExpandedTraceability(false);
  };

  const remove = async (id) => {
    if (!window.confirm('¿Desea eliminar este plan de mejoramiento?')) return;
    try { await planMejoramientoService.remove(id); enqueueSnackbar('Plan eliminado', { variant: 'success' }); await loadPlans(); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el plan', { variant: 'error' }); }
  };

  const waitForSaveIdle = useCallback(() => new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const check = () => {
      if (!saveInFlightRef.current) return resolve();
      if (Date.now() - startedAt > 30000) return reject(new Error('El autoguardado está tardando demasiado. Inténtelo nuevamente.'));
      return window.setTimeout(check, 80);
    };
    check();
  }), []);

  const flushCurrentPlanForExport = useCallback(async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await waitForSaveIdle();
      const current = editorRef.current;
      if (!current?.programa?.trim()) throw new Error('Ingrese el programa o dependencia antes de exportar.');
      const currentSnapshot = planSnapshot(current);
      if (current.id && currentSnapshot === lastSavedSnapshotRef.current) return current.id;
      const saved = await persistPlan(current);
      await waitForSaveIdle();
      const latest = editorRef.current;
      if (latest?.id && planSnapshot(latest) === lastSavedSnapshotRef.current) return latest.id;
      if (!saved && saveStatus === 'error') break;
    }
    throw new Error('No fue posible guardar todos los cambios antes de generar el Excel.');
  }, [persistPlan, saveStatus, waitForSaveIdle]);

  const exportExcel = async (id, name = 'plan_mejoramiento', syncCurrentPlan = false) => {
    if (exportingPlanId !== null) return;
    setExportingPlanId(id || 'current');
    try {
      const exportId = syncCurrentPlan ? await flushCurrentPlanForExport() : id;
      if (!exportId) throw new Error('Guarde el plan antes de exportarlo.');
      const response = await planMejoramientoService.exportExcel(exportId);
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url; link.download = `Plan_mejoramiento_${name.replace(/\s+/g, '_')}.xlsx`; document.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
      enqueueSnackbar('Excel institucional actualizado y generado correctamente', { variant: 'success' });
    } catch (error) {
      let message = error.response?.data?.message || error.message;
      if (error.response?.data instanceof Blob) {
        try { message = JSON.parse(await error.response.data.text())?.message || message; } catch (_) {}
      }
      enqueueSnackbar(message || 'No fue posible exportar el Excel', { variant: 'error' });
    } finally {
      setExportingPlanId(null);
    }
  };

  const updateObjective = (index, key, value) => setEditor((previous) => ({ ...previous, objetivos: previous.objetivos.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const updateActivity = (objectiveIndex, activityIndex, key, value) => setEditor((previous) => ({
    ...previous,
    objetivos: previous.objetivos.map((objective, oi) => oi !== objectiveIndex ? objective : {
      ...objective, actividades: objective.actividades.map((activity, ai) => ai === activityIndex ? { ...activity, [key]: value } : activity)
    })
  }));
  const policyActionLines = (selectedPolicies = []) => {
    const selected = new Set(asStringArray(selectedPolicies));
    return Array.from(new Set((catalogs.institutionalPolicies || [])
      .filter((policy) => selected.has(policy.name))
      .flatMap((policy) => policy.actionLines || [])));
  };
  const updateActivityPolicies = (objectiveIndex, activityIndex, selectedPolicies) => setEditor((previous) => ({
    ...previous,
    objetivos: previous.objetivos.map((objective, oi) => oi !== objectiveIndex ? objective : {
      ...objective,
      actividades: objective.actividades.map((activity, ai) => {
        if (ai !== activityIndex) return activity;
        const policies = asStringArray(selectedPolicies);
        const availableLines = new Set(policyActionLines(policies));
        return {
          ...activity,
          politicasInstitucionales: policies,
          lineasAccionPolitica: asStringArray(activity.lineasAccionPolitica).filter((line) => availableLines.has(line))
        };
      })
    })
  }));
  const updateActivityResponsible = (objectiveIndex, activityIndex, user) => setEditor((previous) => ({
    ...previous,
    objetivos: previous.objetivos.map((objective, oi) => oi !== objectiveIndex ? objective : {
      ...objective,
      actividades: objective.actividades.map((activity, ai) => ai !== activityIndex ? activity : {
        ...activity,
        responsableId: user?.id || null,
        responsableNombre: user?.nombre || '',
        responsableDocumento: user?.documento || '',
        responsableEmail: user?.email || '',
        responsableDependencia: user?.dependencia || '',
        responsableVicerrectoria: user?.vicerrectoria || '',
        cargoResponsable: user?.cargo || ''
      })
    })
  }));
  const addObjective = () => {
    setExpandedObjective(editor?.objetivos.length || 0);
    setEditor((previous) => {
      const nextNumber = Math.max(0, ...previous.objetivos.map((item) => Number(String(item.codigo || '').match(/([0-9]+)$/)?.[1] || 0))) + 1;
      return { ...previous, objetivos: [...previous.objetivos, emptyObjective(nextNumber)] };
    });
  };
  const addActivity = (objectiveIndex) => setEditor((previous) => ({ ...previous, objetivos: previous.objetivos.map((objective, index) => index === objectiveIndex ? { ...objective, actividades: [...objective.actividades, emptyActivity()] } : objective) }));
  const removeObjective = (objectiveIndex) => setEditor((previous) => ({ ...previous, objetivos: previous.objetivos.filter((_, index) => index !== objectiveIndex) }));
  const removeActivity = (objectiveIndex, activityIndex) => setEditor((previous) => ({ ...previous, objetivos: previous.objetivos.map((objective, index) => index === objectiveIndex ? { ...objective, actividades: objective.actividades.filter((_, i) => i !== activityIndex) } : objective) }));
  const addBudget = () => setEditor((previous) => ({ ...previous, presupuesto: [...previous.presupuesto, { categoria: 'personal', subcategoria: 'docente_tc', codigoObjetivo: previous.objetivos[0]?.codigo || '', concepto: '', descripcion: '', cantidad: 1, valorUnitario: 0, tarifaVersionId: null, tarifaVigencia: null, tarifaNombre: '' }] }));
  const updateBudget = (index, key, value) => setEditor((previous) => ({ ...previous, presupuesto: previous.presupuesto.map((item, i) => i === index ? { ...item, [key]: value } : item) }));
  const changeBudgetCategory = (index, category) => setEditor((previous) => ({ ...previous, presupuesto: previous.presupuesto.map((item, i) => i === index ? { ...item, categoria: category, subcategoria: BUDGET_SUBCATEGORIES[category]?.[0]?.[0] || category, concepto: '', valorUnitario: 0 } : item) }));
  const changeBudgetSubcategory = (index, subcategory) => setEditor((previous) => ({ ...previous, presupuesto: previous.presupuesto.map((item, i) => i === index ? { ...item, subcategoria: subcategory, concepto: '', valorUnitario: 0 } : item) }));
  const selectBudgetConcept = (index, label) => setEditor((previous) => ({ ...previous, presupuesto: previous.presupuesto.map((item, i) => {
    if (i !== index) return item;
    const option = (catalogs.budgetCatalogs?.[item.categoria] || []).find((entry) => entry.label === label && (!entry.group || entry.group === item.subcategoria));
    return {
      ...item,
      concepto: label,
      valorUnitario: option?.value ?? item.valorUnitario,
      tarifaVersionId: catalogs.tariffVersion?.id || null,
      tarifaVigencia: catalogs.tariffVersion?.vigencia || null,
      tarifaNombre: catalogs.tariffVersion?.nombre || '',
      tarifaAplicadaAt: new Date().toISOString()
    };
  }) }));
  const removeBudget = (index) => setEditor((previous) => ({ ...previous, presupuesto: previous.presupuesto.filter((_, i) => i !== index) }));

  const downloadTariffTemplate = async () => {
    try {
      const response = await planMejoramientoService.downloadTariffTemplate();
      const url = URL.createObjectURL(response.data);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'Plantilla_actualizacion_tarifas.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible descargar la plantilla de tarifas', { variant: 'error' });
    }
  };

  const importTariffFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setImportingTariffs(true);
    try {
      const response = await planMejoramientoService.importTariffs(file, tariffYear);
      await loadCatalogs();
      enqueueSnackbar(response.message || 'Tarifas actualizadas correctamente', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible importar las tarifas', { variant: 'error' });
    } finally {
      setImportingTariffs(false);
    }
  };

  const registerFollowUp = async (objectiveIndex, activityIndex) => {
    const objective = editor.objetivos[objectiveIndex];
    const activity = objective?.actividades?.[activityIndex];
    if (!activity?.fechaSeguimiento) return enqueueSnackbar('Ingrese la fecha del seguimiento', { variant: 'warning' });
    const activityKey = activity.uid || `${objectiveIndex}_${activityIndex}`;
    const evidenceFile = evidenceFiles[activityKey];
    if (!evidenceFile && !String(activity.evidenceFolderUrl || '').trim()) {
      return enqueueSnackbar('Adjunte una evidencia o sincronice primero la carpeta de Google Drive', { variant: 'warning' });
    }

    const key = activityKey;
    setRecordingFollowUp(key);
    try {
      let planId = editor.id;
      if (!planId) {
        const saved = await persistPlan(editor);
        planId = saved?.id;
      }
      if (!planId) throw new Error('Espere a que termine el autoguardado del plan e inténtelo nuevamente');
      await waitForSaveIdle();
      if (planSnapshot(editorRef.current) !== lastSavedSnapshotRef.current) {
        await persistPlan(editorRef.current);
        await waitForSaveIdle();
      }
      planId = editorRef.current?.id || planId;

      const uploadedEvidence = evidenceFile ? await planMejoramientoService.uploadActivityEvidence(planId, activityKey, evidenceFile) : null;
      let localUser = {};
      try { localUser = JSON.parse(localStorage.getItem('user') || '{}'); } catch (_) { localUser = {}; }
      const progress = percent(activity);
      const record = {
        id: makeLocalId(),
        fecha: activity.fechaSeguimiento,
        valorAlcanzado: Number(activity.metaAlcanzada || 0),
        metaPlaneada: Number(activity.meta || 0),
        porcentaje: progress,
        ponderacionActividad: activityWeight(objective),
        aporteObjetivo: activityContribution(objective, activity),
        avanceObjetivo: objectiveProgress(objective),
        estadoCumplimiento: progress >= 100 ? 'Cumplido' : progress > 0 ? 'En avance' : 'Sin iniciar',
        verificacion: activity.verificacionSeguimiento || 'pendiente',
        observaciones: activity.observaciones || '',
        evidenciaUrl: uploadedEvidence?.url || String(activity.evidenceFolderUrl || '').trim(),
        evidenciaCarpetaUrl: uploadedEvidence?.carpetaUrl || String(activity.evidenceFolderUrl || '').trim(),
        evidenciaArchivo: uploadedEvidence || null,
        registradoAt: new Date().toISOString(),
        registradoPor: uploadedEvidence?.cargadoPor || localUser.nombre || localUser.email || 'Usuario del sistema',
        registradoPorId: uploadedEvidence?.cargadoPorId || localUser.id || null,
        objetivoCodigo: objective.codigo,
        actividadNombre: activity.nombre,
        indicadorPlaneado: activity.indicador
      };
      setEditor((previous) => ({
        ...previous,
        objetivos: previous.objetivos.map((item, oi) => oi !== objectiveIndex ? item : {
          ...item,
          actividades: item.actividades.map((current, ai) => ai !== activityIndex ? current : {
            ...current,
            evidencia: record.evidenciaCarpetaUrl,
            evidenceFolderId: uploadedEvidence?.carpetaId || current.evidenceFolderId || '',
            evidenceFolderUrl: record.evidenciaCarpetaUrl,
            evidenceDriveStatus: 'synced',
            seguimientos: [...(current.seguimientos || []), record]
          })
        })
      }));
      setEvidenceFiles((previous) => { const next = { ...previous }; delete next[key]; return next; });
      enqueueSnackbar('Seguimiento registrado con trazabilidad', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || error.message || 'No fue posible registrar el seguimiento', { variant: 'error' });
    } finally {
      setRecordingFollowUp('');
    }
  };

  const syncEvidenceRepository = useCallback(async ({ notify = false, force = false } = {}) => {
    let plan = editorRef.current;
    if (!plan?.id || (driveSyncInFlightRef.current && !force)) return;
    driveSyncInFlightRef.current = true;
    setDriveSyncStatus('syncing');
    setDriveSyncMessage('');
    try {
      await waitForSaveIdle();
      if (planSnapshot(editorRef.current) !== lastSavedSnapshotRef.current) {
        await persistPlan(editorRef.current);
        await waitForSaveIdle();
      }
      plan = editorRef.current;
      const result = await planMejoramientoService.syncDriveRepository(plan.id);
      const folders = new Map((result?.activities || []).map((item) => [String(item.uid), item]));
      setEditor((previous) => ({
        ...previous,
        objetivos: (previous.objetivos || []).map((objective) => ({
          ...objective,
          actividades: (objective.actividades || []).map((activity) => {
            const folder = folders.get(String(activity.uid));
            return folder ? {
              ...activity,
              evidenceFolderId: folder.folderId,
              evidenceFolderUrl: folder.folderUrl,
              evidenceDriveStatus: 'synced'
            } : activity;
          })
        }))
      }));
      driveSyncedPlanRef.current = `${plan.id}:${driveRepositorySignature(plan)}`;
      setDriveSyncStatus('synced');
      setDriveSyncMessage('Las carpetas de evidencias están sincronizadas con Google Drive.');
      if (notify) enqueueSnackbar('Repositorio de evidencias sincronizado con Google Drive', { variant: 'success' });
    } catch (error) {
      driveSyncedPlanRef.current = `${plan.id}:${driveRepositorySignature(plan)}`;
      setDriveSyncStatus('error');
      setDriveSyncMessage(error.response?.data?.message || 'No fue posible sincronizar el Drive de Planes de Mejoramiento');
      if (notify) enqueueSnackbar(error.response?.data?.message || 'No fue posible sincronizar Google Drive', { variant: 'error' });
    } finally {
      driveSyncInFlightRef.current = false;
    }
  }, [enqueueSnackbar, persistPlan, waitForSaveIdle]);

  const currentDriveRepositoryKey = editor?.id ? `${editor.id}:${driveRepositorySignature(editor)}` : '';
  const currentDriveActivities = (editor?.objetivos || []).flatMap((objective) => objective.actividades || []);
  const currentDriveActivitiesReady = currentDriveActivities.length > 0 && currentDriveActivities.every((activity) => activity.evidenceFolderUrl);

  useEffect(() => {
    if (tab !== 4 || !editor?.id) return undefined;
    if (driveSyncedPlanRef.current === currentDriveRepositoryKey) return undefined;
    if (driveSyncedPlanRef.current === null && currentDriveActivitiesReady) {
      driveSyncedPlanRef.current = currentDriveRepositoryKey;
      setDriveSyncStatus('synced');
      return undefined;
    }
    const timer = window.setTimeout(() => {
      driveSyncedPlanRef.current = currentDriveRepositoryKey;
      syncEvidenceRepository();
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [editor?.id, currentDriveActivitiesReady, currentDriveRepositoryKey, tab, syncEvidenceRepository]);

  const assignExecutionResponsible = async (user) => {
    if (!user || !editor?.id) return;
    setWorkflowBusy(true);
    try {
      const response = await planMejoramientoService.assignPlan(editor.id, { userId: user.id, documento: user.documento });
      setEditor((previous) => ({ ...previous, estado: response.data?.planEstado || previous.estado, asignacion: response.data }));
      enqueueSnackbar(response.message || 'Responsable de ejecución asignado', { variant: 'success' });
      await loadPlans();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible asignar el responsable', { variant: 'error' });
    } finally { setWorkflowBusy(false); }
  };

  const assignResponsibleFromCard = async (user) => {
    if (!user || !assignmentPlan?.id) return;
    setWorkflowBusy(true);
    try {
      const response = await planMejoramientoService.assignPlan(assignmentPlan.id, { userId: user.id, documento: user.documento });
      enqueueSnackbar(response.message || 'Responsable de ejecución asignado', { variant: 'success' });
      setAssignmentPlan(null);
      await loadPlans();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible asignar el responsable', { variant: 'error' });
    } finally { setWorkflowBusy(false); }
  };

  const executeWorkflowAction = async (action) => {
    if (!editor?.id) return;
    if (['devolver', 'reabrir'].includes(action) && !workflowObservation.trim()) {
      return enqueueSnackbar('Ingrese la observación para continuar', { variant: 'warning' });
    }
    setWorkflowBusy(true);
    try {
      const response = await planMejoramientoService.workflowAction(editor.id, { accion: action, observacion: workflowObservation });
      setEditor((previous) => ({ ...previous, estado: response.data?.planEstado || previous.estado, asignacion: response.data }));
      setWorkflowObservation('');
      enqueueSnackbar(response.message || 'Flujo actualizado', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar el flujo', { variant: 'error' });
    } finally { setWorkflowBusy(false); }
  };

  const assignActivityResponsible = async (activity, user) => {
    if (!user || !editor?.id || !activity?.uid) return;
    setWorkflowBusy(true);
    try {
      const response = await planMejoramientoService.assignActivity(editor.id, activity.uid, { userId: user.id, documento: user.documento });
      setEditor((previous) => ({ ...previous, asignacion: response.data }));
      enqueueSnackbar(response.message || 'Actividad delegada correctamente', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible delegar la actividad', { variant: 'error' });
    } finally { setWorkflowBusy(false); }
  };

  const executeActivityWorkflowAction = async (activity, action) => {
    if (!editor?.id || !activity?.uid) return;
    const observation = String(activityWorkflowObservations[activity.uid] || '').trim();
    if (action === 'devolver' && !observation) return enqueueSnackbar('Ingrese la retroalimentación para devolver la actividad', { variant: 'warning' });
    setWorkflowBusy(true);
    try {
      const collaboratorMode = Boolean(editor.asignacion?.esColaborador);
      const response = await planMejoramientoService.activityWorkflowAction(editor.id, activity.uid, { accion: action, observacion: observation });
      setEditor((previous) => ({ ...previous, asignacion: { ...response.data, esColaborador: collaboratorMode } }));
      setActivityWorkflowObservations((previous) => ({ ...previous, [activity.uid]: '' }));
      enqueueSnackbar(response.message || 'Actividad actualizada', { variant: 'success' });
      if (collaboratorMode && action === 'entregar') {
        try {
          const badge = await planMejoramientoService.executionBadge();
          if (badge?.pending > 0) {
            setEditor(null);
            await loadPlans();
          } else {
            window.location.assign('/dashboard');
          }
        } catch (_) {
          window.location.assign('/dashboard');
        }
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar la actividad', { variant: 'error' });
    } finally { setWorkflowBusy(false); }
  };

  const executeCorrectionAction = async (activity, correction, action) => {
    if (!editor?.id || !activity?.uid || !correction?.id) return;
    const responseText = String(correctionResponses[correction.id] || '').trim();
    if (action === 'reabrir' && !responseText) return enqueueSnackbar('Ingrese el motivo para reabrir la corrección', { variant: 'warning' });
    setWorkflowBusy(true);
    try {
      const isCollaborator = Boolean(editor.asignacion?.esColaborador);
      const response = await planMejoramientoService.activityCorrectionAction(editor.id, activity.uid, correction.id, { accion: action, respuesta: responseText });
      setEditor((previous) => ({ ...previous, asignacion: { ...response.data, esColaborador: isCollaborator } }));
      setCorrectionResponses((previous) => ({ ...previous, [correction.id]: '' }));
      enqueueSnackbar(response.message || 'Bitácora de correcciones actualizada', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar la corrección', { variant: 'error' });
    } finally { setWorkflowBusy(false); }
  };

  const stats = useMemo(() => editor ? planStats(editor) : null, [editor]);
  const workflowState = editor?.asignacion?.estado_flujo || '';
  const collaboratorMode = Boolean(editor?.asignacion?.esColaborador);
  const executionLocked = executionMode && ['en_revision', 'en_firme'].includes(workflowState);
  const assignedUser = editor?.asignacion?.usuario;
  const assignmentResponsible = assignedUser ? {
    responsableId: assignedUser.id,
    responsableNombre: assignedUser.nombre,
    responsableDocumento: assignedUser.documento,
    responsableEmail: assignedUser.email,
    cargoResponsable: assignedUser.cargo,
    responsableDependencia: assignedUser.dependencia,
    responsableVicerrectoria: assignedUser.vicerrectoria
  } : {};
  const activityAssignment = (activity) => (editor?.asignacion?.actividades || []).find((item) => String(item.actividad_uid) === String(activity?.uid));
  const collaboratorActivityIsEditable = (activity) => collaboratorMode && ['asignada', 'en_ejecucion', 'devuelta'].includes(activityAssignment(activity)?.estado_flujo);
  const followUpActivityIsExpanded = (activity, objectiveIndex, activityIndex) => collaboratorActivityIsEditable(activity)
    || expandedFollowUpActivity === (activity.uid || `${objectiveIndex}-${activityIndex}`);
  const planOpportunities = useMemo(() => {
    const map = new Map();
    [...(editor?.oportunidadesAutoevaluacion || []), ...opportunities].forEach((item) => {
      if (item?.id && !map.has(String(item.id))) map.set(String(item.id), item);
    });
    return Array.from(map.values());
  }, [editor?.oportunidadesAutoevaluacion, opportunities]);

  const assignedOpportunityIds = () => new Set((editor?.objetivos || [])
    .flatMap((item) => item.aspectosAutoevaluacion?.length
      ? item.aspectosAutoevaluacion.map((aspect) => String(aspect.id))
      : [String(item.origenAutoevaluacion?.id || '')])
    .filter(Boolean));

  const pendingOpportunities = () => {
    const assignedIds = assignedOpportunityIds();
    return planOpportunities.filter((item) => !assignedIds.has(String(item.id)));
  };

  const aspectOptionsForObjective = (objective) => pendingOpportunities()
    .filter((item) => item.factor === objective.factor && item.caracteristica === objective.caracteristica);

  const changeObjectiveFactor = (objectiveIndex, factor) => setEditor((previous) => ({
    ...previous,
    objetivos: previous.objetivos.map((item, index) => index === objectiveIndex
      ? { ...item, factor, caracteristica: '', aspecto: '', calificacion: '', tipoAccion: '', origenAutoevaluacion: undefined, aspectosAutoevaluacion: [] }
      : item)
  }));

  const changeObjectiveCharacteristic = (objectiveIndex, caracteristica) => setEditor((previous) => ({
    ...previous,
    objetivos: previous.objetivos.map((item, index) => index === objectiveIndex
      ? { ...item, caracteristica, aspecto: '', calificacion: '', tipoAccion: '', origenAutoevaluacion: undefined, aspectosAutoevaluacion: [] }
      : item)
  }));

  const addObjectiveAspects = (objectiveIndex, selectedIds) => setEditor((previous) => ({
    ...previous,
    objetivos: previous.objetivos.map((objective, index) => {
      if (index !== objectiveIndex) return objective;
      const current = objective.aspectosAutoevaluacion || [];
      const currentIds = new Set(current.map((item) => String(item.id)));
      const additions = planOpportunities.filter((item) => selectedIds.includes(String(item.id)) && !currentIds.has(String(item.id)));
      const selected = [...current, ...additions];
      if (!selected.length) return objective;
      const source = objectiveFromOpportunity(selected[0], objectiveIndex + 1);
      const scores = selected.map((item) => Number(item.calificacion)).filter(Number.isFinite);
      const activities = objective.actividades?.length ? [...objective.actividades] : [emptyActivity()];
      activities[0] = { ...activities[0], indicador: selected.map((item) => item.indicador).filter(Boolean).join(' | ') || activities[0].indicador || '' };
      return {
        ...objective,
        factor: source.factor,
        caracteristica: source.caracteristica,
        aspecto: selected.map((item) => item.aspecto).join('\n'),
        calificacion: scores.length ? Math.min(...scores) : '',
        tipoAccion: scores.some((score) => score < 4) ? 'Mejoramiento' : 'Fortalecimiento',
        origenAutoevaluacion: source.origenAutoevaluacion,
        aspectosAutoevaluacion: selected,
        actividades: activities
      };
    })
  }));

  const removeObjectiveAspect = (objectiveIndex, aspectId) => {
    setEditor((previous) => ({
      ...previous,
      objetivos: previous.objetivos.map((objective, index) => {
        if (index !== objectiveIndex) return objective;
        const selected = (objective.aspectosAutoevaluacion || []).filter((item) => String(item.id) !== String(aspectId));
        if (!selected.length) {
          return { ...objective, aspecto: '', calificacion: '', tipoAccion: '', origenAutoevaluacion: undefined, aspectosAutoevaluacion: [] };
        }
        const source = objectiveFromOpportunity(selected[0], objectiveIndex + 1);
        const scores = selected.map((item) => Number(item.calificacion)).filter(Number.isFinite);
        return {
          ...objective,
          factor: source.factor,
          caracteristica: source.caracteristica,
          aspecto: selected.map((item) => item.aspecto).join('\n'),
          calificacion: scores.length ? Math.min(...scores) : '',
          tipoAccion: scores.some((score) => score < 4) ? 'Mejoramiento' : 'Fortalecimiento',
          origenAutoevaluacion: source.origenAutoevaluacion,
          aspectosAutoevaluacion: selected
        };
      })
    }));
    enqueueSnackbar('Aspecto retirado del objetivo y devuelto a la lista de pendientes.', { variant: 'info' });
  };

  const availableObjectives = associationOpportunity
    ? (editor?.objetivos || []).map((objective, index) => ({ objective, index }))
    : [];
  const nextAssociationObjectiveNumber = Math.max(0, ...(editor?.objetivos || []).map((item) => Number(String(item.codigo || '').match(/([0-9]+)$/)?.[1] || 0))) + 1;
  const nextAssociationObjectiveCode = `OPM_${String(nextAssociationObjectiveNumber).padStart(2, '0')}`;

  const openObjectiveAssociation = (opportunity) => {
    setAssociationOpportunity(opportunity);
    setAssociationObjectiveIndex('new');
    setAssociationNewObjectiveText('');
  };

  const associateOpportunityToObjective = () => {
    if (!associationOpportunity) return;
    setEditor((previous) => {
      const objectives = [...(previous.objetivos || [])];
      const creatingObjective = associationObjectiveIndex === 'new';
      const selectedIndex = creatingObjective ? objectives.length : Number(associationObjectiveIndex);
      const nextNumber = Math.max(0, ...objectives.map((item) => Number(String(item.codigo || '').match(/([0-9]+)$/)?.[1] || 0))) + 1;
      const currentObjective = objectives[selectedIndex] || { ...emptyObjective(nextNumber), objetivo: associationNewObjectiveText.trim() };
      const currentAspects = currentObjective.aspectosAutoevaluacion || [];
      if (currentAspects.some((item) => String(item.id) === String(associationOpportunity.id))) return previous;
      const selected = [...currentAspects, associationOpportunity];
      const source = objectiveFromOpportunity(selected[0], selectedIndex + 1);
      const scores = selected.map((item) => Number(item.calificacion)).filter(Number.isFinite);
      const activities = currentObjective.actividades?.length ? [...currentObjective.actividades] : [emptyActivity()];
      activities[0] = {
        ...activities[0],
        indicador: selected.map((item) => item.indicador).filter(Boolean).join(' | ') || activities[0].indicador || ''
      };
      objectives[selectedIndex] = {
        ...currentObjective,
        factor: source.factor,
        caracteristica: source.caracteristica,
        aspecto: selected.map((item) => item.aspecto).join('\n'),
        calificacion: scores.length ? Math.min(...scores) : '',
        tipoAccion: scores.some((score) => score < 4) ? 'Mejoramiento' : 'Fortalecimiento',
        origenAutoevaluacion: source.origenAutoevaluacion,
        aspectosAutoevaluacion: selected,
        actividades: activities
      };
      return { ...previous, objetivos: objectives };
    });
    enqueueSnackbar('Aspecto asociado al objetivo. Ya no aparece en la lista de pendientes.', { variant: 'success' });
    setAssociationOpportunity(null);
    setAssociationObjectiveIndex('new');
    setAssociationNewObjectiveText('');
  };

  const filteredImprovementOpportunities = pendingOpportunities().filter((item) => {
    const score = Number(item.calificacion);
    if (improvementScoreFilter === 'improvement' && !(score < 4)) return false;
    if (improvementScoreFilter === 'strengthening' && !(score >= 4)) return false;
    const query = improvementSearch.trim().toLocaleLowerCase('es');
    if (!query) return true;
    return [item.factor, item.caracteristica, item.aspecto, item.indicador]
      .some((value) => String(value || '').toLocaleLowerCase('es').includes(query));
  });

  if (!editor) {
    return (
      <Box>
        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3.5 }, borderRadius: 4, color: 'white', background: 'linear-gradient(120deg, #0f1f3a 0%, #1d4ed8 55%, #d97706 130%)', mb: 3 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
            <Box><Typography variant="h4" sx={{ fontWeight: 950 }}>{executionMode ? 'Ejecución de Autoevaluación' : 'Plan de mejoramiento'}</Typography><Typography sx={{ opacity: .92, mt: .5 }}>{executionMode ? 'Gestione las actividades, evidencias y seguimientos de los planes asignados.' : 'Formulación, presupuesto, seguimiento y exportación de la matriz institucional.'}</Typography></Box>
            <Stack direction="row" spacing={1}><Button startIcon={<ArrowBackIcon />} onClick={onBack} sx={{ color: 'white', fontWeight: 850, textTransform: 'none' }}>Volver</Button>{!executionMode && <Button variant="contained" startIcon={<AddIcon />} onClick={startNewPlan} sx={{ bgcolor: 'white', color: '#1d4ed8', fontWeight: 900, textTransform: 'none', '&:hover': { bgcolor: '#eff6ff' } }}>Nuevo plan</Button>}</Stack>
          </Stack>
        </Paper>
        {loading ? <Box sx={{ py: 10, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box> : plans.length === 0 ? (
          <Alert severity="info" sx={{ borderRadius: 3 }}>{executionMode ? 'Aún no tiene planes de mejoramiento asignados.' : 'Aún no hay planes registrados. Cree el primero para iniciar la formulación.'}</Alert>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
            {plans.map((plan) => (
              <Paper
                key={plan.id}
                elevation={0}
                sx={{
                  p: 0, borderRadius: 4.5, border: '1px solid #dce5f0', overflow: 'hidden', position: 'relative',
                  background: 'linear-gradient(155deg, #ffffff 0%, #fbfdff 68%, #f5f9ff 100%)',
                  boxShadow: '0 10px 30px rgba(15,23,42,.045)', transition: 'all .25s ease',
                  '&:hover': { transform: 'translateY(-5px)', borderColor: '#93c5fd', boxShadow: '0 22px 48px rgba(37,99,235,.11)' }
                }}
              >
                <Box sx={{ height: 6, background: `linear-gradient(90deg, ${statusTone(visiblePlanState(plan)).color}, #38bdf8)` }} />
                <Box sx={{ p: { xs: 2.4, md: 3 } }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
                    <Stack direction="row" spacing={1.7} alignItems="center" sx={{ minWidth: 0 }}>
                      <Box sx={{ width: 54, height: 54, borderRadius: 3, display: 'grid', placeItems: 'center', color: '#1d4ed8', bgcolor: '#eff6ff', border: '1px solid #dbeafe', flexShrink: 0 }}><ProgramIcon sx={{ fontSize: 30 }} /></Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Stack direction="row" spacing={0.7} sx={{ mb: 1 }}><Chip size="small" label={statusTone(visiblePlanState(plan)).label} sx={{ height: 24, fontWeight: 900, bgcolor: statusTone(visiblePlanState(plan)).soft, color: statusTone(visiblePlanState(plan)).color, border: `1px solid ${statusTone(visiblePlanState(plan)).border}` }} /></Stack>
                        <Typography variant="h6" sx={{ fontWeight: 950, color: '#0f172a', lineHeight: 1.25, textTransform: 'uppercase' }}>{plan.programa}</Typography>
                        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ mt: 0.7, color: '#64748b' }}><CalendarIcon sx={{ fontSize: 17 }} /><Typography variant="body2" sx={{ fontWeight: 700 }}>{plan.periodo_inicio} – {plan.periodo_fin}</Typography></Stack>
                      </Box>
                    </Stack>
                    {!executionMode && <Stack direction="row" spacing={0.7}>
                      <Tooltip title={plan.asignacion?.usuario ? 'Cambiar responsable de ejecución' : 'Asignar responsable de ejecución'}>
                        <IconButton size="small" onClick={() => setAssignmentPlan(plan)} sx={{ color: '#1d4ed8', bgcolor: '#eff6ff', border: '1px solid #dbeafe', '&:hover': { bgcolor: '#dbeafe' } }}><PersonAddIcon fontSize="small" /></IconButton>
                      </Tooltip>
                      <Tooltip title="Eliminar plan"><IconButton size="small" onClick={() => remove(plan.id)} sx={{ color: '#e11d48', bgcolor: '#fff1f2', border: '1px solid #ffe4e6', '&:hover': { bgcolor: '#ffe4e6' } }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                    </Stack>}
                  </Stack>

                  <Box sx={{ mt: 2, px: 1.4, py: 1.1, borderRadius: 2.5, bgcolor: plan.asignacion?.usuario ? '#ecfdf5' : '#f8fafc', border: `1px solid ${plan.asignacion?.usuario ? '#a7f3d0' : '#e2e8f0'}` }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <PersonIcon sx={{ fontSize: 20, color: plan.asignacion?.usuario ? '#047857' : '#94a3b8' }} />
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 850 }}>Responsable de ejecución</Typography>
                        <Typography variant="body2" sx={{ color: '#0f172a', fontWeight: 900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {plan.asignacion?.usuario ? `${plan.asignacion.usuario.nombre} · CC ${plan.asignacion.usuario.documento || 'sin documento'}` : 'Sin asignar'}
                        </Typography>
                      </Box>
                    </Stack>
                  </Box>

                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1.2, my: 2.7 }}>
                    {[
                      { label: 'Objetivos', value: plan.resumen?.objetivos || 0, icon: <ObjectiveIcon />, color: '#2563eb', soft: '#eff6ff' },
                      { label: 'Avance', value: `${Number(plan.resumen?.avance || 0).toFixed(1)}%`, icon: <ProgressIcon />, color: '#7c3aed', soft: '#f5f3ff' },
                      { label: 'Presupuesto', value: money.format(plan.resumen?.presupuesto || 0), icon: <BudgetIcon />, color: '#d97706', soft: '#fff7ed' }
                    ].map((metric) => (
                      <Box key={metric.label} sx={{ p: 1.4, borderRadius: 2.7, bgcolor: metric.soft, border: `1px solid ${metric.color}18`, minWidth: 0 }}>
                        <Stack direction="row" spacing={0.7} alignItems="center" sx={{ color: metric.color, mb: 0.5 }}>{React.cloneElement(metric.icon, { sx: { fontSize: 17 } })}<Typography variant="caption" sx={{ fontWeight: 900 }}>{metric.label}</Typography></Stack>
                        <Typography sx={{ fontWeight: 950, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{metric.value}</Typography>
                      </Box>
                    ))}
                  </Box>

                  <Box sx={{ mb: 2.5 }}>
                    <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.7 }}><Typography variant="caption" sx={{ color: '#64748b', fontWeight: 800 }}>Progreso general</Typography><Typography variant="caption" sx={{ color: '#7c3aed', fontWeight: 950 }}>{Number(plan.resumen?.avance || 0).toFixed(1)}%</Typography></Stack>
                    <LinearProgress variant="determinate" value={Math.min(100, Number(plan.resumen?.avance || 0))} sx={{ height: 8, borderRadius: 8, bgcolor: '#ede9fe', '& .MuiLinearProgress-bar': { borderRadius: 8, background: 'linear-gradient(90deg, #7c3aed, #2563eb)' } }} />
                  </Box>

                  <Stack direction="row" spacing={1.2}>
                    <Button fullWidth variant="contained" startIcon={<EditIcon />} onClick={() => openPlan(plan.id)} sx={{ py: 1.15, borderRadius: 2.7, textTransform: 'none', fontWeight: 900, boxShadow: '0 7px 18px rgba(37,99,235,.18)' }}>Abrir plan</Button>
                    {!plan.asignacion?.esColaborador && <Button fullWidth variant="outlined" disabled={exportingPlanId !== null} startIcon={exportingPlanId === plan.id ? <CircularProgress size={18} /> : <DownloadIcon />} onClick={() => exportExcel(plan.id, plan.programa)} sx={{ py: 1.15, borderRadius: 2.7, textTransform: 'none', fontWeight: 900, bgcolor: 'white' }}>{exportingPlanId === plan.id ? 'Generando…' : 'Exportar Excel'}</Button>}
                  </Stack>
                </Box>
              </Paper>
            ))}
          </Box>
        )}
        <Dialog open={Boolean(assignmentPlan)} onClose={() => !workflowBusy && setAssignmentPlan(null)} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 4, overflow: 'visible' } }}>
          <Box sx={{ p: { xs: 2.5, md: 3 } }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.8 }}>
              <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#eff6ff', color: '#1d4ed8' }}><PersonAddIcon /></Box>
              <Box><Typography variant="h6" sx={{ fontWeight: 950 }}>Asignar responsable de ejecución</Typography><Typography variant="body2" sx={{ color: '#64748b' }}>{assignmentPlan?.programa}</Typography></Box>
            </Stack>
            <Alert severity="info" sx={{ my: 2 }}>Busque al líder por nombre o número de documento. Al seleccionarlo se habilitará automáticamente el módulo de ejecución en su SIAC.</Alert>
            <ResponsibleAutocomplete
              activity={assignmentPlan?.asignacion?.usuario ? {
                responsableId: assignmentPlan.asignacion.usuario.id,
                responsableNombre: assignmentPlan.asignacion.usuario.nombre,
                responsableDocumento: assignmentPlan.asignacion.usuario.documento,
                responsableEmail: assignmentPlan.asignacion.usuario.email,
                cargoResponsable: assignmentPlan.asignacion.usuario.cargo,
                responsableDependencia: assignmentPlan.asignacion.usuario.dependencia,
                responsableVicerrectoria: assignmentPlan.asignacion.usuario.vicerrectoria
              } : {}}
              onChange={assignResponsibleFromCard}
            />
            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}><Button disabled={workflowBusy} onClick={() => setAssignmentPlan(null)} sx={{ textTransform: 'none', fontWeight: 850 }}>Cancelar</Button></Stack>
          </Box>
        </Dialog>
      </Box>
    );
  }

  return (
    <Dialog
      open
      fullScreen
      onClose={() => setEditor(null)}
      PaperProps={{ sx: { bgcolor: '#f5f7fb', backgroundImage: 'linear-gradient(180deg, #f8fbff 0%, #f5f7fb 100%)' } }}
    >
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', overflow: 'visible', p: { xs: 1.5, md: 2.5 } }}>
      <Paper elevation={0} sx={{ p: { xs: 1.7, md: 2.2 }, borderRadius: 3.5, border: '1px solid #dbeafe', mb: 1.5, flexShrink: 0, bgcolor: 'rgba(255,255,255,.97)', backdropFilter: 'blur(12px)', boxShadow: '0 8px 26px rgba(15,23,42,.06)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} spacing={2}>
          <Stack direction="row" alignItems="center" spacing={1.2}>
            <IconButton onClick={() => setEditor(null)}><ArrowBackIcon /></IconButton>
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 950, color: '#0f172a' }}>{executionMode ? 'Ejecución del plan de mejoramiento' : editor.id ? 'Editar plan de mejoramiento' : 'Nuevo plan de mejoramiento'}</Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'flex-start', sm: 'center' }}>
                <Typography variant="body2" color="text.secondary">Los cambios se guardan automáticamente mientras trabaja.</Typography>
                <Chip
                  size="small"
                  label={saveTone(saveStatus).label}
                  onClick={saveStatus === 'error' ? save : undefined}
                  sx={{ height: 24, fontWeight: 850, color: saveTone(saveStatus).color, bgcolor: saveTone(saveStatus).soft, border: `1px solid ${saveTone(saveStatus).border}`, cursor: saveStatus === 'error' ? 'pointer' : 'default' }}
                />
              </Stack>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1}>{!collaboratorMode && <Button disabled={!editor.id || exportingPlanId !== null} startIcon={exportingPlanId !== null ? <CircularProgress size={18} /> : <DownloadIcon />} onClick={() => exportExcel(editor.id, editor.programa, true)} sx={{ textTransform: 'none', fontWeight: 850 }}>{exportingPlanId !== null ? 'Actualizando Excel…' : 'Exportar Excel'}</Button>}<Button variant="contained" disabled={saving || executionLocked} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />} onClick={save} sx={{ textTransform: 'none', fontWeight: 900 }}>{saving ? 'Guardando…' : 'Guardar ahora'}</Button></Stack>
        </Stack>
      </Paper>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 1.2, mb: 1.5, flexShrink: 0 }}>
        <Metric icon={<PlanIcon />} label="Objetivos" value={stats.objectives} color="#2563eb" />
        <Metric icon={<CheckIcon />} label="Actividades" value={stats.activities} color="#0f766e" />
        <Metric icon={<ProgressIcon />} label="Avance" value={`${stats.progress.toFixed(1)}%`} color="#7c3aed" />
        <Metric icon={<BudgetIcon />} label="Presupuesto" value={money.format(stats.budget)} color="#d97706" />
      </Box>

      {editor.id && (
        <Paper elevation={0} sx={{ p: 1.25, mb: 1.5, borderRadius: 3, border: '1px solid #dbe3ee', bgcolor: '#fff', flexShrink: 0, boxShadow: '0 5px 18px rgba(15,23,42,.035)' }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5} alignItems={{ lg: 'center' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ minWidth: 0, flex: 1 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2.2, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: assignedUser ? '#ecfdf5' : '#f1f5f9', color: assignedUser ? '#047857' : '#64748b', border: `1px solid ${assignedUser ? '#a7f3d0' : '#e2e8f0'}` }}>
                <PersonIcon sx={{ fontSize: 21 }} />
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap">
                  <Typography variant="caption" sx={{ fontWeight: 900, color: '#64748b', textTransform: 'uppercase', letterSpacing: '.03em' }}>Responsable de ejecución</Typography>
                  <Chip size="small" label={workflowTone(workflowState).label} color={workflowTone(workflowState).color} sx={{ height: 22, fontWeight: 850 }} />
                </Stack>
                <Typography variant="body2" noWrap title={assignedUser?.nombre || ''} sx={{ mt: 0.15, color: '#0f172a', fontWeight: 900 }}>
                  {assignedUser?.nombre || 'Sin responsable asignado'}
                </Typography>
                <Typography variant="caption" noWrap sx={{ display: 'block', color: '#64748b' }}>
                  {assignedUser ? [assignedUser.documento && `CC ${assignedUser.documento}`, assignedUser.cargo].filter(Boolean).join(' · ') : 'Asigne un responsable para iniciar la ejecución del plan.'}
                </Typography>
              </Box>
            </Stack>
            {!executionMode && (
              <Box sx={{ width: { xs: '100%', lg: 430 }, flexShrink: 0 }}>
                <ResponsibleAutocomplete size="small" activity={assignmentResponsible} onChange={assignExecutionResponsible} label="Asignar o reasignar responsable" />
              </Box>
            )}
            {executionMode && !collaboratorMode && (
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                {['asignado', 'devuelto'].includes(workflowState) && <Button variant="contained" disabled={workflowBusy} onClick={() => executeWorkflowAction('iniciar')} sx={{ textTransform: 'none', fontWeight: 900 }}>Iniciar ejecución</Button>}
                {['en_ejecucion', 'devuelto'].includes(workflowState) && <Button variant="contained" color="warning" disabled={workflowBusy} onClick={() => executeWorkflowAction('enviar_revision')} sx={{ textTransform: 'none', fontWeight: 900 }}>Enviar a revisión</Button>}
                {workflowState === 'en_revision' && <Alert severity="warning" sx={{ py: 0 }}>En revisión por Autoevaluación. La edición está bloqueada.</Alert>}
                {workflowState === 'en_firme' && <Alert severity="success" sx={{ py: 0 }}>Plan aprobado y en firme.</Alert>}
              </Stack>
            )}
            {executionMode && collaboratorMode && <Alert severity="info" sx={{ py: 0 }}>Vista de colaborador: gestione únicamente las actividades que el líder le delegó.</Alert>}
            {(editor.asignacion?.historial || []).length > 0 && (
              <Button
                size="small"
                onClick={() => setExpandedTraceability((current) => !current)}
                endIcon={<ExpandMoreIcon sx={{ transform: expandedTraceability ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />}
                sx={{ minWidth: 'max-content', color: '#475569', textTransform: 'none', fontWeight: 850 }}
              >
                Historial ({editor.asignacion.historial.length})
              </Button>
            )}
          </Stack>
          {editor.asignacion?.ultima_observacion && <Typography variant="caption" sx={{ display: 'block', mt: 0.6, ml: { lg: 6.2 }, color: '#9a3412', fontWeight: 750 }}>Última observación: {editor.asignacion.ultima_observacion}</Typography>}
          {!executionMode && workflowState === 'en_revision' && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 1.5 }}>
              <TextField fullWidth size="small" label="Observación de la revisión" value={workflowObservation} onChange={(event) => setWorkflowObservation(event.target.value)} />
              <Button color="warning" variant="outlined" disabled={workflowBusy} onClick={() => executeWorkflowAction('devolver')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Devolver para corrección</Button>
              <Button color="success" variant="contained" disabled={workflowBusy} onClick={() => executeWorkflowAction('aprobar')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Aprobar y dejar en firme</Button>
            </Stack>
          )}
          {!executionMode && workflowState === 'en_firme' && (
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} sx={{ mt: 1.5 }}>
              <TextField fullWidth size="small" label="Motivo obligatorio para reabrir" value={workflowObservation} onChange={(event) => setWorkflowObservation(event.target.value)} />
              <Button color="warning" variant="outlined" disabled={workflowBusy} onClick={() => executeWorkflowAction('reabrir')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Reabrir ejecución</Button>
            </Stack>
          )}
          <Collapse in={expandedTraceability} timeout="auto" unmountOnExit>
            <Box sx={{ mt: 1, pt: 1, borderTop: '1px solid #e2e8f0' }}>
              <Stack direction="row" spacing={0.8} sx={{ overflowX: 'auto', pb: 0.2 }}>
                {(editor.asignacion?.historial || []).map((item) => <Chip key={item.id} size="small" variant="outlined" label={`${workflowTone(item.estado_nuevo).label} · ${item.actor_nombre || 'Usuario'} · ${item.createdAt ? new Date(item.createdAt).toLocaleString('es-CO') : ''}${item.observacion ? ` · ${item.observacion}` : ''}`} sx={{ flexShrink: 0, maxWidth: 520, bgcolor: '#f8fafc' }} />)}
              </Stack>
            </Box>
          </Collapse>
        </Paper>
      )}

      <Paper elevation={0} sx={{ borderRadius: 3.5, border: '1px solid #dbe3ee', overflow: 'visible', display: 'flex', flexDirection: 'column', boxShadow: '0 12px 35px rgba(15,23,42,.05)' }}>
        <Box sx={{ p: { xs: 1, md: 1.3 }, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', overflowX: 'auto', flexShrink: 0 }}>
        <Tabs
          value={tab}
          onChange={(_, value) => {
            if (!executionMode || value === 4 || (!collaboratorMode && value > 0)) setTab(value);
          }}
          variant="fullWidth"
          TabIndicatorProps={{ sx: { display: 'none' } }}
          sx={{
            minWidth: { xs: 760, md: 0 }, minHeight: 52,
            '& .MuiTabs-flexContainer': { gap: 1 },
            '& .MuiTab-root': {
              minHeight: 52, borderRadius: 2.5, textTransform: 'none', fontWeight: 850, color: '#64748b',
              border: '1px solid transparent', transition: 'all .2s ease', fontSize: 15
            },
            '& .MuiTab-root:hover': { bgcolor: '#ffffff', color: '#1d4ed8' },
            '& .Mui-selected': { bgcolor: '#ffffff', color: '#1d4ed8 !important', borderColor: '#bfdbfe', boxShadow: '0 5px 16px rgba(37,99,235,.10)' }
          }}
        >
          <Tab disabled={executionMode} label="01 · Identificación" /><Tab disabled={executionMode && collaboratorMode} label="02 · Lista de mejoramiento" /><Tab disabled={executionMode && collaboratorMode} label="03 · Objetivos y actividades" /><Tab disabled={executionMode && collaboratorMode} label="04 · Presupuesto" /><Tab label="05 · Seguimiento" />
        </Tabs>
        </Box>

        <Box sx={{ p: { xs: 2, md: 3 }, bgcolor: '#ffffff', borderRadius: '0 0 14px 14px' }}>
          {tab === 0 && (
            <Stack spacing={2.2}>
              <Alert severity="info">El plan se formula para un periodo de tres años, siguiendo las fases Planear, Hacer, Verificar y Actuar.</Alert>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr 1fr 1fr' }, gap: 2 }}>
                <TextField select label="Programa o dependencia" value={editor.programa} onChange={(event) => setEditor({ ...editor, programa: event.target.value })} required>
                  {withCurrent((catalogs.programs || []).map((item) => item.name), editor.programa).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                </TextField>
                <TextField label="Año inicial" type="number" value={editor.periodoInicio} onChange={(event) => setEditor({ ...editor, periodoInicio: event.target.value })} />
                <TextField label="Año final" type="number" value={editor.periodoFin} onChange={(event) => setEditor({ ...editor, periodoFin: event.target.value })} />
                <TextField select disabled label="Estado (automático)" value={editor.estado} helperText="Cambia al asignar y aprobar el plan"><MenuItem value="borrador">Borrador</MenuItem><MenuItem value="en_ejecucion">En ejecución</MenuItem><MenuItem value="cerrado">Cerrado</MenuItem></TextField>
              </Box>
              {editor.programa && loadingOpportunities && <Alert severity="info" icon={<CircularProgress size={20} />}>Consultando resultados de Autoevaluación para este programa…</Alert>}
              {editor.programa && !loadingOpportunities && opportunities.length > 0 && (
                <Alert severity="info">
                  Se cargaron {opportunities.length} aspectos evaluados: {opportunities.filter((item) => Number(item.calificacion) < 4).length} de mejoramiento y {opportunities.filter((item) => Number(item.calificacion) >= 4).length} de fortalecimiento. Quedan {pendingOpportunities().length} pendientes de asociar.
                </Alert>
              )}
              {editor.programa && !loadingOpportunities && opportunities.length === 0 && <Alert severity="info">Este programa todavía no tiene aspectos calificados en Autoevaluación.</Alert>}
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1.5}>
              <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} spacing={1.2}>
                <Paper elevation={0} sx={{ display: 'flex', gap: 0.7, p: 0.55, borderRadius: 2.5, bgcolor: '#f1f5f9', border: '1px solid #e2e8f0', width: { xs: '100%', lg: 'auto' } }}>
                  <Button
                    fullWidth
                    size="small"
                    onClick={() => setImprovementScoreFilter((current) => current === 'improvement' ? 'all' : 'improvement')}
                    sx={{ px: 2, borderRadius: 2, textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 900, color: improvementScoreFilter === 'improvement' ? '#9a3412' : '#475569', bgcolor: improvementScoreFilter === 'improvement' ? '#fff7ed' : 'transparent', boxShadow: improvementScoreFilter === 'improvement' ? '0 2px 8px rgba(154,52,18,.10)' : 'none', '&:hover': { bgcolor: '#fff7ed' } }}
                  >
                    Mejoramiento · &lt; 4 ({pendingOpportunities().filter((item) => Number(item.calificacion) < 4).length})
                  </Button>
                  <Button
                    fullWidth
                    size="small"
                    onClick={() => setImprovementScoreFilter((current) => current === 'strengthening' ? 'all' : 'strengthening')}
                    sx={{ px: 2, borderRadius: 2, textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 900, color: improvementScoreFilter === 'strengthening' ? '#047857' : '#475569', bgcolor: improvementScoreFilter === 'strengthening' ? '#ecfdf5' : 'transparent', boxShadow: improvementScoreFilter === 'strengthening' ? '0 2px 8px rgba(4,120,87,.10)' : 'none', '&:hover': { bgcolor: '#ecfdf5' } }}
                  >
                    Fortalecimiento · ≥ 4 ({pendingOpportunities().filter((item) => Number(item.calificacion) >= 4).length})
                  </Button>
                </Paper>
                <TextField
                  size="small"
                  value={improvementSearch}
                  onChange={(event) => setImprovementSearch(event.target.value)}
                  label="Buscar factor, característica o aspecto"
                  sx={{ width: { xs: '100%', md: 390 } }}
                />
              </Stack>
              {loadingOpportunities ? (
                <Box sx={{ py: 8, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>
              ) : filteredImprovementOpportunities.length === 0 ? (
                <Alert severity={pendingOpportunities().length ? 'info' : 'success'}>{pendingOpportunities().length ? 'No hay resultados para el filtro seleccionado.' : 'No hay aspectos pendientes de asociación para este programa.'}</Alert>
              ) : (
                <TableContainer component={Paper} elevation={0} sx={{ maxHeight: 560, border: '1px solid #dbe3ee', borderRadius: 3, overflow: 'auto' }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ minWidth: 190, fontWeight: 950, bgcolor: '#f8fafc' }}>Factor</TableCell>
                        <TableCell sx={{ minWidth: 220, fontWeight: 950, bgcolor: '#f8fafc' }}>Característica</TableCell>
                        <TableCell sx={{ minWidth: 360, fontWeight: 950, bgcolor: '#f8fafc' }}>Aspecto</TableCell>
                        <TableCell align="center" sx={{ minWidth: 135, fontWeight: 950, bgcolor: '#f8fafc' }}>Calificación</TableCell>
                        <TableCell align="center" sx={{ minWidth: 150, fontWeight: 950, bgcolor: '#f8fafc' }}>Tipo</TableCell>
                        <TableCell align="center" sx={{ minWidth: 210, fontWeight: 950, bgcolor: '#f8fafc' }}>Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredImprovementOpportunities.map((item) => {
                        const improvement = Number(item.calificacion) < 4;
                        return (
                          <TableRow key={item.id} hover>
                            <TableCell sx={{ color: '#334155', fontWeight: 750 }}>{item.factor || 'Sin factor'}</TableCell>
                            <TableCell sx={{ color: '#475569' }}>{item.caracteristica || 'Sin característica'}</TableCell>
                            <TableCell sx={{ color: '#334155', lineHeight: 1.55 }}>{item.aspecto}</TableCell>
                            <TableCell align="center"><Chip size="small" label={Number(item.calificacion).toFixed(2)} sx={{ fontWeight: 950, bgcolor: improvement ? '#fef3c7' : '#dcfce7', color: improvement ? '#a16207' : '#15803d' }} /></TableCell>
                            <TableCell align="center"><Chip size="small" label={improvement ? 'Mejoramiento' : 'Fortalecimiento'} sx={{ fontWeight: 850, bgcolor: improvement ? '#fff7ed' : '#ecfdf5', color: improvement ? '#b45309' : '#047857' }} /></TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={0.7} justifyContent="center">
                                <Tooltip title="Consultar evidencias"><IconButton size="small" onClick={() => setEvidenceOpportunity(item)} sx={{ color: '#2563eb', bgcolor: '#eff6ff' }}><AttachIcon fontSize="small" /></IconButton></Tooltip>
                                <Button size="small" variant="contained" onClick={() => openObjectiveAssociation(item)} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Asociar con objetivo</Button>
                              </Stack>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          )}

          {tab === 2 && (
            <Stack spacing={2.5}>
              {editor.objetivos.length === 0 && (
                <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                  Los aspectos trasladados están disponibles como insumos. Cree un objetivo y seleccione el factor, la característica y el aspecto que desea trabajar.
                </Alert>
              )}
              {editor.objetivos.map((objective, objectiveIndex) => (
                <Paper key={`${objective.codigo}-${objectiveIndex}`} elevation={0} sx={{ p: { xs: 1.5, md: 2 }, borderRadius: 3, border: '1px solid #cbd5e1', bgcolor: '#fbfdff' }}>
                  <Stack
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    onClick={() => setExpandedObjective((current) => current === objectiveIndex ? null : objectiveIndex)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Chip label={objective.codigo} color="primary" sx={{ fontWeight: 900 }} />
                      {objective.origenAutoevaluacion?.id && <Chip size="small" label="Importado de Autoevaluación" sx={{ bgcolor: '#dcfce7', color: '#166534', fontWeight: 850 }} />}
                      <Box>
                        <Typography sx={{ fontWeight: 900 }}>{objective.objetivo?.trim() || `Objetivo de mejoramiento ${objectiveIndex + 1}`}</Typography>
                        <Typography variant="caption" sx={{ color: '#64748b' }}>{objective.factor || 'Sin factor'} · {objective.caracteristica || 'Sin característica'}</Typography>
                      </Box>
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center">
                      <Tooltip title="Eliminar objetivo"><IconButton color="error" onClick={(event) => { event.stopPropagation(); removeObjective(objectiveIndex); }}><DeleteIcon /></IconButton></Tooltip>
                      <IconButton size="small" sx={{ transform: expandedObjective === objectiveIndex ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}><ExpandMoreIcon /></IconButton>
                    </Stack>
                  </Stack>
                  <Collapse in={expandedObjective === objectiveIndex} timeout="auto" unmountOnExit>
                  <Box sx={{ pt: 2 }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' }, gap: 1.5 }}>
                    <TextField label="Código" value={objective.codigo} onChange={(e) => updateObjective(objectiveIndex, 'codigo', e.target.value)} sx={{ gridColumn: { md: 'span 2' } }} />
                    <TextField select label="Factor / condición" value={objective.factor} onChange={(e) => changeObjectiveFactor(objectiveIndex, e.target.value)} sx={{ gridColumn: { md: 'span 5' } }}>
                      {withCurrent(Array.from(new Set(pendingOpportunities().map((item) => item.factor).filter(Boolean))), objective.factor).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                    </TextField>
                    <TextField select label="Característica" value={objective.caracteristica} onChange={(e) => changeObjectiveCharacteristic(objectiveIndex, e.target.value)} sx={{ gridColumn: { md: 'span 5' } }} disabled={!objective.factor}>
                      {withCurrent(Array.from(new Set(pendingOpportunities().filter((item) => item.factor === objective.factor).map((item) => item.caracteristica).filter(Boolean))), objective.caracteristica).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                    </TextField>
                    <TextField
                      select
                      label="Agregar aspectos / hallazgos pendientes"
                      value={[]}
                      onChange={(e) => {
                        const values = Array.isArray(e.target.value) ? e.target.value : String(e.target.value).split(',');
                        const options = aspectOptionsForObjective(objective);
                        const optionIds = options.map((item) => String(item.id));
                        addObjectiveAspects(objectiveIndex, values.includes('__ALL__') ? optionIds : values);
                      }}
                      SelectProps={{
                        multiple: true,
                        displayEmpty: true,
                        renderValue: () => `${aspectOptionsForObjective(objective).length} aspecto${aspectOptionsForObjective(objective).length === 1 ? '' : 's'} pendiente${aspectOptionsForObjective(objective).length === 1 ? '' : 's'}`
                      }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ gridColumn: { md: 'span 12' } }}
                      disabled={!objective.caracteristica}
                    >
                      {aspectOptionsForObjective(objective).length > 0 && <MenuItem value="__ALL__">
                        <Checkbox checked={false} />
                        <Typography sx={{ fontWeight: 900 }}>Agregar todos los aspectos pendientes</Typography>
                      </MenuItem>}
                      {aspectOptionsForObjective(objective).map((item) => (
                        <MenuItem key={item.id} value={String(item.id)}>
                          <Checkbox checked={false} />
                          <Box>
                            <Typography variant="body2">{item.aspecto}</Typography>
                            <Typography variant="caption" sx={{ color: '#64748b' }}>Calificación: {item.calificacion}</Typography>
                          </Box>
                        </MenuItem>
                      ))}
                      {aspectOptionsForObjective(objective).length === 0 && <MenuItem disabled>No quedan aspectos pendientes en esta característica</MenuItem>}
                    </TextField>
                  </Box>
                  {(objective.aspectosAutoevaluacion || []).length > 0 && (
                    <Box sx={{ mt: 1.25 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1, color: '#334155', fontWeight: 900 }}>
                        Detalle de los aspectos asociados al objetivo
                      </Typography>
                      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #dbe3ee', borderRadius: 2.5, overflow: 'hidden' }}>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ bgcolor: '#f8fafc' }}>
                              <TableCell sx={{ fontWeight: 900 }}>Aspecto</TableCell>
                              <TableCell align="center" sx={{ width: 125, fontWeight: 900 }}>Calificación</TableCell>
                              <TableCell align="center" sx={{ width: 170, fontWeight: 900 }}>Tipo de acción</TableCell>
                              <TableCell align="center" sx={{ width: 90, fontWeight: 900 }}>Acción</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {objective.aspectosAutoevaluacion.map((aspect) => {
                              const aspectActionType = actionTypeForScore(aspect.calificacion);
                              const improvement = aspectActionType === 'Mejoramiento';
                              return (
                                <TableRow key={aspect.id} hover>
                                  <TableCell sx={{ color: '#334155' }}>{aspect.aspecto}</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 900 }}>{Number.isFinite(Number(aspect.calificacion)) ? Number(aspect.calificacion).toFixed(2) : 'Sin calificar'}</TableCell>
                                  <TableCell align="center">
                                    <Chip
                                      size="small"
                                      label={aspectActionType}
                                      sx={{ fontWeight: 850, bgcolor: improvement ? '#fff7ed' : '#ecfdf5', color: improvement ? '#b45309' : '#047857' }}
                                    />
                                  </TableCell>
                                  <TableCell align="center">
                                    <Tooltip title="Retirar del objetivo y devolver a pendientes">
                                      <IconButton size="small" color="error" onClick={() => removeObjectiveAspect(objectiveIndex, aspect.id)}>
                                        <DeleteIcon fontSize="small" />
                                      </IconButton>
                                    </Tooltip>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                  <TextField
                    fullWidth
                    label="Objetivo"
                    value={objective.objetivo}
                    onChange={(e) => updateObjective(objectiveIndex, 'objetivo', e.target.value)}
                    multiline
                    minRows={2}
                    sx={{ mt: 1.5 }}
                  />
                  <Divider sx={{ my: 2.5 }} />
                  <Stack spacing={2}>
                    {objective.actividades.map((activity, activityIndex) => (
                      <Paper key={activityIndex} elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px dashed #94a3b8', bgcolor: 'white' }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}><Typography sx={{ fontWeight: 900, color: '#1d4ed8' }}>Actividad {activityIndex + 1}</Typography>{objective.actividades.length > 1 && <IconButton size="small" color="error" onClick={() => removeActivity(objectiveIndex, activityIndex)}><DeleteIcon /></IconButton>}</Stack>
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' }, gap: 1.5 }}>
                          <TextField label="Nombre de la actividad" value={activity.nombre} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'nombre', e.target.value)} sx={{ gridColumn: { md: 'span 6' } }} />
                          <TextField label="Indicador" value={activity.indicador} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'indicador', e.target.value)} sx={{ gridColumn: { md: 'span 4' } }} />
                          <TextField label="Meta" type="number" value={activity.meta} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'meta', e.target.value)} sx={{ gridColumn: { md: 'span 2' } }} />
                          <TextField label="Descripción" value={activity.descripcion} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'descripcion', e.target.value)} multiline minRows={2} sx={{ gridColumn: { md: 'span 8' } }} />
                          <TextField label="Recursos" value={activity.recursos} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'recursos', e.target.value)} sx={{ gridColumn: { md: 'span 4' } }} />
                          <TextField label="Fecha inicio" type="date" InputLabelProps={{ shrink: true }} value={activity.fechaInicio} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'fechaInicio', e.target.value)} sx={{ gridColumn: { md: 'span 3' } }} />
                          <TextField label="Fecha fin" type="date" InputLabelProps={{ shrink: true }} value={activity.fechaFin} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'fechaFin', e.target.value)} sx={{ gridColumn: { md: 'span 3' } }} />
                          <TextField select label="Proceso responsable" value={activity.procesoResponsable} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'procesoResponsable', e.target.value)} sx={{ gridColumn: { md: 'span 3' } }}>{withCurrent(catalogs.processes?.length ? catalogs.processes : PROCESSES, activity.procesoResponsable).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
                          <Box sx={{ gridColumn: { md: 'span 3' } }}>
                            <ResponsibleAutocomplete activity={activity} onChange={(user) => updateActivityResponsible(objectiveIndex, activityIndex, user)} />
                          </Box>
                          {activity.responsableId && (
                            <Paper elevation={0} sx={{ gridColumn: { md: 'span 12' }, px: 1.5, py: 1.15, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #dbeafe' }}>
                              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 1.5 }}>
                                {[
                                  ['Dependencia', activity.responsableDependencia],
                                  ['Cargo', activity.cargoResponsable]
                                ].map(([label, value]) => (
                                  <Box key={label} sx={{ minWidth: 0 }}>
                                    <Typography variant="caption" sx={{ display: 'block', color: '#64748b', fontWeight: 850 }}>{label}</Typography>
                                    <Typography variant="body2" title={value || ''} sx={{ color: '#0f172a', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis' }}>{value || 'Sin información'}</Typography>
                                  </Box>
                                ))}
                              </Box>
                            </Paper>
                          )}
                          <TextField select label="Alcance" value={activity.alcance} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'alcance', e.target.value)} sx={{ gridColumn: { md: 'span 3' } }}><MenuItem value="PROGRAMA">Programa</MenuItem><MenuItem value="INSTITUCIONAL">Institucional</MenuItem></TextField>
                          <TextField select label="Objetivo estratégico" value={activity.objetivoEstrategico} onChange={(e) => setEditor((previous) => ({ ...previous, objetivos: previous.objetivos.map((obj, oi) => oi !== objectiveIndex ? obj : { ...obj, actividades: obj.actividades.map((act, ai) => ai === activityIndex ? { ...act, objetivoEstrategico: e.target.value, proyectoPdi: '' } : act) }) }))} sx={{ gridColumn: { md: 'span 4' } }}>{withCurrent(catalogs.strategicObjectives, activity.objetivoEstrategico).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
                          <TextField select label="Lineamiento estratégico" value={activity.proyectoPdi} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'proyectoPdi', e.target.value)} sx={{ gridColumn: { md: 'span 5' } }} disabled={!activity.objetivoEstrategico}>{withCurrent(catalogs.objectiveProjects?.[activity.objetivoEstrategico], activity.proyectoPdi).map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}</TextField>
                          <Autocomplete
                            multiple
                            disableCloseOnSelect
                            options={withCurrentMany((catalogs.institutionalPolicies || []).map((policy) => policy.name), activity.politicasInstitucionales)}
                            value={asStringArray(activity.politicasInstitucionales)}
                            onChange={(_event, values) => updateActivityPolicies(objectiveIndex, activityIndex, values)}
                            renderOption={(props, option, { selected }) => <li {...props}><Checkbox checked={selected} sx={{ mr: 1 }} />{option}</li>}
                            renderInput={(params) => <TextField {...params} label="Políticas institucionales" helperText={(catalogs.institutionalPolicies || []).length ? 'Puede seleccionar una o varias políticas.' : 'No hay políticas institucionales vigentes registradas.'} />}
                            sx={{ gridColumn: { md: 'span 6' } }}
                          />
                          <Autocomplete
                            multiple
                            disableCloseOnSelect
                            options={policyActionLines(activity.politicasInstitucionales)}
                            value={asStringArray(activity.lineasAccionPolitica).filter((line) => policyActionLines(activity.politicasInstitucionales).includes(line))}
                            onChange={(_event, values) => updateActivity(objectiveIndex, activityIndex, 'lineasAccionPolitica', values)}
                            disabled={!asStringArray(activity.politicasInstitucionales).length}
                            renderOption={(props, option, { selected }) => <li {...props}><Checkbox checked={selected} sx={{ mr: 1 }} />{option}</li>}
                            renderInput={(params) => <TextField {...params} label="Líneas de acción de las políticas" helperText={asStringArray(activity.politicasInstitucionales).length ? 'Solo se muestran las líneas de las políticas seleccionadas.' : 'Seleccione primero una o varias políticas.'} />}
                            sx={{ gridColumn: { md: 'span 6' } }}
                          />
                        </Box>
                      </Paper>
                    ))}
                    <Button startIcon={<AddIcon />} onClick={() => addActivity(objectiveIndex)} sx={{ alignSelf: 'start', textTransform: 'none', fontWeight: 850 }}>Agregar actividad</Button>
                  </Stack>
                  </Box>
                  </Collapse>
                </Paper>
              ))}
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addObjective} sx={{ alignSelf: 'start', textTransform: 'none', fontWeight: 900 }}>Crear objetivo de mejoramiento</Button>
            </Stack>
          )}

          {tab === 3 && (
            <Stack spacing={2}>
              <Alert severity="info">Cada rubro se asigna a un código de objetivo. El valor total y el consolidado se calculan automáticamente.</Alert>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #bfdbfe', bgcolor: '#f8fbff' }}>
                <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', lg: 'center' }} spacing={2}>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography sx={{ fontWeight: 950, color: '#0f172a' }}>Catálogo institucional de tarifas</Typography>
                      <Chip size="small" label={`Vigencia ${catalogs.tariffVersion?.vigencia || 'base'}`} sx={{ fontWeight: 900, bgcolor: '#dbeafe', color: '#1d4ed8' }} />
                    </Stack>
                    <Typography variant="body2" sx={{ color: '#64748b', mt: 0.5 }}>
                      {catalogs.tariffVersion?.nombre || 'Tarifas base de la plantilla institucional'}. Las nuevas tarifas solo se aplican a rubros seleccionados después de la actualización.
                    </Typography>
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems="center">
                    <TextField size="small" type="number" label="Vigencia" value={tariffYear} onChange={(event) => setTariffYear(event.target.value)} sx={{ width: { xs: '100%', sm: 125 } }} />
                    <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTariffTemplate} sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 850 }}>Descargar plantilla</Button>
                    <Button variant="contained" startIcon={importingTariffs ? <CircularProgress size={17} color="inherit" /> : <AddIcon />} disabled={importingTariffs} onClick={() => tariffInputRef.current?.click()} sx={{ whiteSpace: 'nowrap', textTransform: 'none', fontWeight: 900 }}>{importingTariffs ? 'Actualizando…' : 'Cargar nuevas tarifas'}</Button>
                    <input ref={tariffInputRef} hidden type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={importTariffFile} />
                  </Stack>
                </Stack>
                <Alert severity="success" icon={false} sx={{ mt: 1.5, py: 0.4, border: '1px solid #bbf7d0' }}>
                  Los rubros ya guardados conservan su valor histórico. La actualización no recalcula ni modifica planes anteriores.
                </Alert>
              </Paper>
              {editor.presupuesto.map((item, index) => (
                <Paper key={index} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.2fr 1.3fr .9fr 1.8fr 1.8fr .8fr 1fr 1fr auto' }, gap: 1.3, alignItems: 'center' }}>
                    <TextField select size="small" label="Tipo de recurso" value={item.categoria} onChange={(e) => changeBudgetCategory(index, e.target.value)}>{BUDGET_TYPES.map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
                    <TextField select size="small" label="Subcategoría" value={item.subcategoria || BUDGET_SUBCATEGORIES[item.categoria]?.[0]?.[0] || item.categoria} onChange={(e) => changeBudgetSubcategory(index, e.target.value)}>{(BUDGET_SUBCATEGORIES[item.categoria] || []).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
                    <TextField select size="small" label="Objetivo" value={item.codigoObjetivo} onChange={(e) => updateBudget(index, 'codigoObjetivo', e.target.value)}>{editor.objetivos.map((objective) => <MenuItem key={objective.codigo} value={objective.codigo}>{objective.codigo}</MenuItem>)}</TextField>
                    {(catalogs.budgetCatalogs?.[item.categoria] || []).filter((entry) => !entry.group || entry.group === item.subcategoria).length ? (
                      <TextField select size="small" label="Concepto" value={item.concepto} onChange={(e) => selectBudgetConcept(index, e.target.value)}>
                        {withCurrent((catalogs.budgetCatalogs?.[item.categoria] || []).filter((entry) => !entry.group || entry.group === item.subcategoria).map((entry) => entry.label), item.concepto).map((label) => <MenuItem key={label} value={label}>{label}</MenuItem>)}
                      </TextField>
                    ) : <TextField size="small" label="Concepto" value={item.concepto} onChange={(e) => updateBudget(index, 'concepto', e.target.value)} />}
                    <TextField size="small" label="Descripción del rubro" value={item.descripcion} onChange={(e) => updateBudget(index, 'descripcion', e.target.value)} />
                    <TextField size="small" label="Cantidad" type="number" value={item.cantidad} onChange={(e) => updateBudget(index, 'cantidad', e.target.value)} />
                    <TextField size="small" label="Valor unitario" type="number" value={item.valorUnitario} onChange={(e) => updateBudget(index, 'valorUnitario', e.target.value)} />
                    <TextField size="small" label="Total calculado" value={money.format(budgetItemTotal(item))} InputProps={{ readOnly: true }} />
                    <Tooltip title="Eliminar rubro"><IconButton color="error" onClick={() => removeBudget(index)}><DeleteIcon /></IconButton></Tooltip>
                  </Box>
                  {item.categoria === 'personal' && ['docente_tc', 'docente_mt'].includes(item.subcategoria) && <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>Incluye automáticamente el factor prestacional 1,51852 definido en la plantilla.</Typography>}
                  {item.categoria === 'espacios' && <Typography variant="caption" sx={{ color: '#64748b', mt: 1, display: 'block' }}>Descuento automático por cantidad de horas: {(spaceDiscount(item.cantidad) * 100).toFixed(0)}%.</Typography>}
                  {item.tarifaVigencia && <Chip size="small" label={`Tarifa histórica aplicada · Vigencia ${item.tarifaVigencia}`} sx={{ mt: 1, fontWeight: 800, bgcolor: '#f1f5f9', color: '#475569' }} />}
                </Paper>
              ))}
              <Button variant="outlined" startIcon={<AddIcon />} onClick={addBudget} sx={{ alignSelf: 'start', textTransform: 'none', fontWeight: 900 }}>Agregar rubro presupuestal</Button>
            </Stack>
          )}

          {tab === 4 && (
            <Stack spacing={2.2}>
              <Alert severity="info">Las actividades formuladas se cargan automáticamente. Registre cada corte de seguimiento, adjunte su evidencia y verifique el cumplimiento; los registros anteriores permanecen en la trazabilidad.</Alert>
              <Alert
                severity={driveSyncStatus === 'error' ? 'warning' : driveSyncStatus === 'synced' ? 'success' : 'info'}
                icon={driveSyncStatus === 'syncing' ? <CircularProgress size={20} /> : <CloudSyncIcon />}
                action={driveSyncStatus === 'error' ? (
                  <Button color="inherit" size="small" onClick={() => syncEvidenceRepository({ notify: true, force: true })} sx={{ fontWeight: 900 }}>Reintentar</Button>
                ) : null}
              >
                {driveSyncStatus === 'syncing'
                  ? 'Creando y verificando las carpetas de evidencias en Google Drive…'
                  : driveSyncMessage || 'El enlace de cada actividad se genera automáticamente en el Drive exclusivo de Planes de Mejoramiento.'}
              </Alert>
              {editor.objetivos.map((objective, objectiveIndex) => (
                <Paper key={objective.codigo || objectiveIndex} elevation={0} sx={{ p: 2.3, borderRadius: 3.5, border: '1px solid #bfdbfe', bgcolor: '#f8fbff' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1.5} onClick={() => setExpandedFollowUpObjective((current) => current === objectiveIndex ? null : objectiveIndex)} sx={{ mb: expandedFollowUpObjective === objectiveIndex ? 1.5 : 0, cursor: 'pointer' }}>
                    <Box><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={objective.codigo} color="primary" sx={{ fontWeight: 900 }} /><Typography sx={{ fontWeight: 950 }}>{objective.objetivo || 'Objetivo pendiente de formulación'}</Typography></Stack><Typography variant="body2" sx={{ color: '#64748b', mt: 0.6 }}>{objective.actividades.length} actividad{objective.actividades.length === 1 ? '' : 'es'} · Cada actividad aporta {activityWeight(objective).toFixed(1)}% al resultado del objetivo.</Typography></Box>
                    <Stack direction="row" spacing={1} alignItems="center"><Box sx={{ minWidth: { xs: 200, md: 230 } }}><Stack direction="row" justifyContent="space-between"><Typography variant="caption" sx={{ fontWeight: 850, color: '#64748b' }}>Resultado del objetivo</Typography><Typography variant="caption" sx={{ fontWeight: 950, color: '#1d4ed8' }}>{objectiveProgress(objective).toFixed(1)}%</Typography></Stack><LinearProgress variant="determinate" value={objectiveProgress(objective)} sx={{ mt: 0.6, height: 9, borderRadius: 8 }} /></Box><IconButton size="small" sx={{ transform: expandedFollowUpObjective === objectiveIndex ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}><ExpandMoreIcon /></IconButton></Stack>
                  </Stack>
                  <Collapse in={expandedFollowUpObjective === objectiveIndex} timeout="auto" unmountOnExit>
                  <Stack spacing={1.5}>
                  {objective.actividades.map((activity, activityIndex) => (
                <Paper key={activity.uid || `${objectiveIndex}-${activityIndex}`} elevation={0} sx={{ p: 2.1, borderRadius: 3, border: '1px solid #dbe3ee', bgcolor: 'white' }}>
                  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1} onClick={() => { if (!collaboratorActivityIsEditable(activity)) setExpandedFollowUpActivity((current) => current === (activity.uid || `${objectiveIndex}-${activityIndex}`) ? null : (activity.uid || `${objectiveIndex}-${activityIndex}`)); }} sx={{ mb: followUpActivityIsExpanded(activity, objectiveIndex, activityIndex) ? 1.5 : 0, cursor: collaboratorActivityIsEditable(activity) ? 'default' : 'pointer' }}>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap"><Chip size="small" label={`Actividad ${activityIndex + 1}`} sx={{ fontWeight: 900, bgcolor: '#e0f2fe', color: '#0369a1' }} /><Typography sx={{ fontWeight: 950 }}>{activity.nombre || 'Actividad pendiente de nombrar'}</Typography></Stack>
                      <Typography variant="body2" sx={{ color: '#64748b', mt: 0.35 }}>{activity.indicador || 'Indicador pendiente'} · Meta: {activity.meta || 0} · Periodo: {activity.fechaInicio || '—'} a {activity.fechaFin || '—'} · Responsable: {activity.responsableNombre || activity.cargoResponsable || 'Pendiente'}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.8} alignItems="center"><Stack spacing={0.7} alignItems={{ xs: 'flex-start', md: 'flex-end' }}><Chip label={`${percent(activity).toFixed(1)}% ejecutado`} sx={{ fontWeight: 900, bgcolor: percent(activity) >= 100 ? '#dcfce7' : '#fff7ed', color: percent(activity) >= 100 ? '#166534' : '#9a3412' }} /><Typography variant="caption" sx={{ fontWeight: 850, color: '#475569' }}>Aporte al objetivo: {activityContribution(objective, activity).toFixed(1)} de {activityWeight(objective).toFixed(1)}%</Typography></Stack><IconButton size="small" disabled={collaboratorActivityIsEditable(activity)} sx={{ transform: followUpActivityIsExpanded(activity, objectiveIndex, activityIndex) ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform .2s' }}><ExpandMoreIcon /></IconButton></Stack>
                  </Stack>
                  <Collapse in={followUpActivityIsExpanded(activity, objectiveIndex, activityIndex)} timeout="auto" unmountOnExit>
                  <Box>
                  {executionMode && (() => {
                    const task = activityAssignment(activity);
                    if (!task && collaboratorMode) return null;
                    const taskUser = task?.usuario;
                    const taskState = task?.estado_flujo || '';
                    const taskLabels = { asignada: 'Asignada', en_ejecucion: 'En ejecución', entregada: 'Entregada al líder', devuelta: 'Devuelta con ajustes', aprobada: 'Aprobada por el líder' };
                    const taskResponsible = taskUser ? { responsableId: taskUser.id, responsableNombre: taskUser.nombre, responsableDocumento: taskUser.documento, responsableEmail: taskUser.email, cargoResponsable: taskUser.cargo, responsableDependencia: taskUser.dependencia, responsableVicerrectoria: taskUser.vicerrectoria } : {};
                    return (
                      <Paper elevation={0} sx={{ p: 1.5, mb: 1.7, borderRadius: 2.5, border: '1px solid #c7d2fe', bgcolor: '#f8faff' }}>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ md: 'center' }} justifyContent="space-between">
                          <Box>
                            <Stack direction="row" spacing={0.8} alignItems="center"><Typography sx={{ fontWeight: 900 }}>Ejecución delegada</Typography><Chip size="small" label={taskLabels[taskState] || 'Sin delegar'} color={taskState === 'aprobada' ? 'success' : taskState === 'devuelta' ? 'error' : taskState === 'entregada' ? 'warning' : 'info'} sx={{ fontWeight: 850 }} /></Stack>
                            {taskUser && <Typography variant="body2" sx={{ color: '#64748b' }}>{taskUser.nombre} · CC {taskUser.documento || 'sin documento'} · {taskUser.cargo || 'cargo no registrado'}</Typography>}
                            {task?.ultima_observacion && <Typography variant="caption" sx={{ color: '#b45309', fontWeight: 800 }}>Retroalimentación: {task.ultima_observacion}</Typography>}
                          </Box>
                          {!collaboratorMode && <Box sx={{ width: { xs: '100%', md: 440 } }}><ResponsibleAutocomplete activity={taskResponsible} onChange={(user) => assignActivityResponsible(activity, user)} label="Colaborador de esta actividad (nombre o cédula)" helperText="Este usuario solo verá y gestionará esta actividad." /></Box>}
                          {collaboratorMode && (
                            <Stack direction="row" spacing={1}>
                              {['asignada', 'devuelta'].includes(taskState) && <Button variant="contained" disabled={workflowBusy} onClick={() => executeActivityWorkflowAction(activity, 'iniciar')} sx={{ textTransform: 'none', fontWeight: 900 }}>Iniciar actividad</Button>}
                              {['en_ejecucion', 'devuelta'].includes(taskState) && <Button color="warning" variant="contained" disabled={workflowBusy} onClick={() => executeActivityWorkflowAction(activity, 'entregar')} sx={{ textTransform: 'none', fontWeight: 900 }}>Enviar a revisión del líder</Button>}
                            </Stack>
                          )}
                        </Stack>
                        {!collaboratorMode && taskState === 'entregada' && (
                          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1} sx={{ mt: 1.2 }}>
                            <TextField fullWidth size="small" label="Retroalimentación para el colaborador" value={activityWorkflowObservations[activity.uid] || ''} onChange={(event) => setActivityWorkflowObservations((previous) => ({ ...previous, [activity.uid]: event.target.value }))} />
                            <Button color="warning" variant="outlined" disabled={workflowBusy} onClick={() => executeActivityWorkflowAction(activity, 'devolver')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Devolver con ajustes</Button>
                            <Button color="success" variant="contained" disabled={workflowBusy} onClick={() => executeActivityWorkflowAction(activity, 'aprobar')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Aprobar actividad</Button>
                          </Stack>
                        )}
                        {(task?.correcciones || []).length > 0 && (
                          <Box sx={{ mt: 1.5, pt: 1.3, borderTop: '1px solid #cbd5e1' }}>
                            <Typography sx={{ fontWeight: 950, color: '#334155', mb: 1 }}>Bitácora de correcciones ({task.correcciones.length})</Typography>
                            <Stack spacing={1}>
                              {task.correcciones.map((correction, correctionIndex) => {
                                const correctionTone = correction.estado === 'validada' ? { label: 'Validada', color: 'success' } : correction.estado === 'corregida' ? { label: 'Corregida · pendiente de validar', color: 'info' } : { label: 'Pendiente', color: 'warning' };
                                return (
                                  <Paper key={correction.id || correctionIndex} elevation={0} sx={{ p: 1.3, borderRadius: 2.2, border: '1px solid #e2e8f0', bgcolor: correction.estado === 'pendiente' ? '#fffbeb' : correction.estado === 'validada' ? '#f0fdf4' : '#eff6ff' }}>
                                    <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                                      <Box>
                                        <Stack direction="row" spacing={0.8} alignItems="center" flexWrap="wrap"><Chip size="small" label={`Corrección ${correctionIndex + 1}`} sx={{ fontWeight: 850 }} /><Chip size="small" label={correctionTone.label} color={correctionTone.color} sx={{ fontWeight: 850 }} /></Stack>
                                        <Typography variant="body2" sx={{ mt: 0.7, color: '#0f172a', fontWeight: 750 }}>{correction.descripcion}</Typography>
                                        <Typography variant="caption" sx={{ color: '#64748b' }}>Solicitada por {correction.creadoPor || 'Líder'} · {correction.creadoAt ? new Date(correction.creadoAt).toLocaleString('es-CO') : ''}</Typography>
                                        {correction.respuesta && <Typography variant="body2" sx={{ mt: 0.5, color: '#1d4ed8' }}><strong>Respuesta:</strong> {correction.respuesta}</Typography>}
                                        {correction.reapertura && <Typography variant="body2" sx={{ mt: 0.5, color: '#b45309' }}><strong>Motivo de reapertura:</strong> {correction.reapertura}</Typography>}
                                      </Box>
                                      {collaboratorMode && correction.estado === 'pendiente' && (
                                        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} sx={{ minWidth: { md: 520 } }}>
                                          <TextField fullWidth size="small" label="Qué se corrigió" value={correctionResponses[correction.id] || ''} onChange={(event) => setCorrectionResponses((previous) => ({ ...previous, [correction.id]: event.target.value }))} />
                                          <Button variant="contained" color="success" disabled={workflowBusy} onClick={() => executeCorrectionAction(activity, correction, 'marcar_corregida')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Marcar corregida</Button>
                                        </Stack>
                                      )}
                                      {!collaboratorMode && correction.estado === 'corregida' && (
                                        <Stack direction="row" spacing={0.8} alignItems="center"><Button variant="contained" color="success" disabled={workflowBusy} onClick={() => executeCorrectionAction(activity, correction, 'validar')} sx={{ textTransform: 'none', fontWeight: 900 }}>Validar</Button></Stack>
                                      )}
                                    </Stack>
                                    {!collaboratorMode && ['corregida', 'validada'].includes(correction.estado) && (
                                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={0.8} sx={{ mt: 1 }}>
                                        <TextField fullWidth size="small" label="Nueva observación para reabrir esta corrección" value={correctionResponses[correction.id] || ''} onChange={(event) => setCorrectionResponses((previous) => ({ ...previous, [correction.id]: event.target.value }))} />
                                        <Button variant="outlined" color="warning" disabled={workflowBusy} onClick={() => executeCorrectionAction(activity, correction, 'reabrir')} sx={{ textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>Reabrir corrección</Button>
                                      </Stack>
                                    )}
                                  </Paper>
                                );
                              })}
                            </Stack>
                          </Box>
                        )}
                        {(task?.historial || []).length > 0 && <Stack direction="row" spacing={0.7} sx={{ mt: 1, overflowX: 'auto' }}>{task.historial.map((record, index) => <Chip key={`${record.fecha}-${index}`} size="small" variant="outlined" label={`${taskLabels[record.estadoNuevo] || record.accion} · ${record.actor || 'Usuario'}${record.observacion ? ` · ${record.observacion}` : ''}`} sx={{ flexShrink: 0 }} />)}</Stack>}
                      </Paper>
                    );
                  })()}
                  <LinearProgress variant="determinate" value={percent(activity)} sx={{ mb: 2, height: 8, borderRadius: 8, bgcolor: '#e2e8f0', '& .MuiLinearProgress-bar': { borderRadius: 8, bgcolor: percent(activity) >= 100 ? '#16a34a' : '#2563eb' } }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(12, 1fr)' }, gap: 1.5 }}>
                    <TextField disabled={executionLocked || (collaboratorMode && !['en_ejecucion', 'devuelta'].includes(activityAssignment(activity)?.estado_flujo))} label="Valor alcanzado" type="number" value={activity.metaAlcanzada} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'metaAlcanzada', e.target.value)} sx={{ gridColumn: { md: 'span 2' } }} />
                    <TextField disabled={executionLocked || (collaboratorMode && !['en_ejecucion', 'devuelta'].includes(activityAssignment(activity)?.estado_flujo))} label="Fecha del corte" type="date" InputLabelProps={{ shrink: true }} value={activity.fechaSeguimiento} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'fechaSeguimiento', e.target.value)} sx={{ gridColumn: { md: 'span 2' } }} />
                    <TextField disabled={executionMode || executionLocked} select label="Verificación de Autoevaluación" value={activity.verificacionSeguimiento || 'pendiente'} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'verificacionSeguimiento', e.target.value)} sx={{ gridColumn: { md: 'span 3' } }}>
                      <MenuItem value="pendiente">Pendiente de verificación</MenuItem><MenuItem value="verificado">Cumplimiento verificado</MenuItem><MenuItem value="requiere_ajustes">Requiere ajustes</MenuItem>
                    </TextField>
                    <TextField
                      label="Carpeta automática de evidencias en Google Drive"
                      value={activity.evidenceFolderUrl || ''}
                      placeholder={driveSyncStatus === 'syncing' ? 'Creando carpeta…' : 'Pendiente de sincronización'}
                      InputProps={{ readOnly: true }}
                      InputLabelProps={{ shrink: true }}
                      sx={{ gridColumn: { md: 'span 4' } }}
                    />
                    <Button
                      component="a"
                      href={activity.evidenceFolderUrl || undefined}
                      target="_blank"
                      rel="noreferrer"
                      disabled={!activity.evidenceFolderUrl}
                      variant="outlined"
                      startIcon={<FolderOpenIcon />}
                      sx={{ gridColumn: { md: 'span 1' }, minHeight: 56, textTransform: 'none', fontWeight: 900 }}
                    >
                      Abrir
                    </Button>
                    <TextField disabled={executionLocked || (collaboratorMode && !['en_ejecucion', 'devuelta'].includes(activityAssignment(activity)?.estado_flujo))} label="Observaciones y retroalimentación" value={activity.observaciones} onChange={(e) => updateActivity(objectiveIndex, activityIndex, 'observaciones', e.target.value)} multiline minRows={2} sx={{ gridColumn: { md: 'span 12' } }} />
                  </Box>
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mt: 1.5 }}>
                    <Button disabled={executionLocked || (collaboratorMode && !['en_ejecucion', 'devuelta'].includes(activityAssignment(activity)?.estado_flujo))} component="label" variant="outlined" startIcon={<AttachIcon />} sx={{ textTransform: 'none', fontWeight: 850 }}>
                      {evidenceFiles[activity.uid || `${objectiveIndex}_${activityIndex}`]?.name || 'Adjuntar evidencia'}
                      <input hidden type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip" onChange={(event) => setEvidenceFiles((previous) => ({ ...previous, [activity.uid || `${objectiveIndex}_${activityIndex}`]: event.target.files?.[0] || null }))} />
                    </Button>
                    <Button variant="contained" disabled={executionLocked || (collaboratorMode && !['en_ejecucion', 'devuelta'].includes(activityAssignment(activity)?.estado_flujo)) || recordingFollowUp === (activity.uid || `${objectiveIndex}_${activityIndex}`)} onClick={() => registerFollowUp(objectiveIndex, activityIndex)} sx={{ textTransform: 'none', fontWeight: 900 }}>
                      {recordingFollowUp === (activity.uid || `${objectiveIndex}_${activityIndex}`) ? 'Registrando…' : 'Registrar corte de seguimiento'}
                    </Button>
                  </Stack>
                  {(activity.seguimientos || []).length > 0 && (
                    <Box sx={{ mt: 2.2 }}>
                      <Typography sx={{ mb: 1, fontWeight: 950, color: '#334155' }}>Historial y trazabilidad ({activity.seguimientos.length})</Typography>
                      <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5 }}>
                        <Table size="small">
                          <TableHead><TableRow sx={{ bgcolor: '#f8fafc' }}><TableCell sx={{ fontWeight: 900 }}>Fecha</TableCell><TableCell sx={{ fontWeight: 900 }}>Avance</TableCell><TableCell sx={{ fontWeight: 900 }}>Verificación</TableCell><TableCell sx={{ fontWeight: 900 }}>Evidencia</TableCell><TableCell sx={{ fontWeight: 900 }}>Observaciones</TableCell><TableCell sx={{ fontWeight: 900 }}>Registrado por</TableCell></TableRow></TableHead>
                          <TableBody>{activity.seguimientos.map((record) => (
                            <TableRow key={record.id}>
                              <TableCell>{record.fecha}</TableCell>
                              <TableCell><strong>{Number(record.porcentaje || 0).toFixed(1)}%</strong><Typography variant="caption" display="block">{record.valorAlcanzado} de {record.metaPlaneada}</Typography><Typography variant="caption" display="block">Aporte: {Number(record.aporteObjetivo ?? (Number(record.porcentaje || 0) * activityWeight(objective) / 100)).toFixed(1)}%</Typography></TableCell>
                              <TableCell><Chip size="small" label={record.verificacion === 'verificado' ? 'Verificado' : record.verificacion === 'requiere_ajustes' ? 'Requiere ajustes' : 'Pendiente'} color={record.verificacion === 'verificado' ? 'success' : record.verificacion === 'requiere_ajustes' ? 'warning' : 'default'} /></TableCell>
                              <TableCell>{record.evidenciaUrl ? <Button component="a" href={record.evidenciaUrl} target="_blank" rel="noreferrer" size="small" startIcon={<AttachIcon />} sx={{ textTransform: 'none' }}>Ver soporte</Button> : '—'}</TableCell>
                              <TableCell>{record.observaciones || '—'}</TableCell>
                              <TableCell>{record.registradoPor || 'Usuario del sistema'}<Typography variant="caption" display="block">{record.registradoAt ? new Date(record.registradoAt).toLocaleString('es-CO') : ''}</Typography></TableCell>
                            </TableRow>
                          ))}</TableBody>
                        </Table>
                      </TableContainer>
                    </Box>
                  )}
                  </Box>
                  </Collapse>
                </Paper>
                  ))}
                  </Stack>
                  </Collapse>
                </Paper>
              ))}
            </Stack>
          )}
        </Box>
      </Paper>
      <Dialog open={Boolean(associationOpportunity)} onClose={() => { setAssociationOpportunity(null); setAssociationNewObjectiveText(''); }} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3.5 } }}>
        <Box sx={{ p: { xs: 2.2, md: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 950, color: '#0f172a' }}>Asociar aspecto con un objetivo</Typography>
          <Typography variant="body2" sx={{ mt: 0.5, color: '#64748b' }}>{associationOpportunity?.aspecto}</Typography>
          <Alert severity={Number(associationOpportunity?.calificacion) < 4 ? 'warning' : 'success'} sx={{ my: 2 }}>
            Calificación {Number(associationOpportunity?.calificacion || 0).toFixed(2)} · {actionTypeForScore(associationOpportunity?.calificacion)}
          </Alert>
          <TextField
            select
            fullWidth
            label="Objetivo de destino"
            value={associationObjectiveIndex}
            onChange={(event) => setAssociationObjectiveIndex(event.target.value)}
          >
            {availableObjectives.map(({ objective, index }) => (
              <MenuItem key={`${objective.codigo}-${index}`} value={String(index)}>{objective.codigo} · {objective.objetivo || `Objetivo de mejoramiento ${index + 1}`}</MenuItem>
            ))}
            <MenuItem value="new">+ Crear nuevo objetivo · {nextAssociationObjectiveCode}</MenuItem>
          </TextField>
          {associationObjectiveIndex === 'new' ? (
            <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'flex-start' }}>
                <Chip label={nextAssociationObjectiveCode} color="primary" sx={{ mt: { sm: 0.7 }, fontWeight: 900 }} />
                <TextField
                  fullWidth
                  autoFocus
                  multiline
                  minRows={2}
                  label="Redactar nuevo objetivo"
                  value={associationNewObjectiveText}
                  onChange={(event) => setAssociationNewObjectiveText(event.target.value)}
                  placeholder="Escriba el objetivo de mejoramiento que agrupará este aspecto"
                />
              </Stack>
            </Paper>
          ) : (() => {
            const selectedObjective = editor?.objetivos?.[Number(associationObjectiveIndex)];
            return selectedObjective ? (
              <Paper elevation={0} sx={{ mt: 1.5, p: 1.5, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                <Typography sx={{ color: '#0f172a', fontWeight: 900 }}>{selectedObjective.objetivo || `Objetivo de mejoramiento ${Number(associationObjectiveIndex) + 1}`}</Typography>
                <Typography variant="caption" sx={{ display: 'block', mt: 0.35, color: '#64748b' }}>{selectedObjective.factor || 'Sin factor'} · {(selectedObjective.aspectosAutoevaluacion || []).length} aspecto(s) asociado(s)</Typography>
              </Paper>
            ) : null;
          })()}
          <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 2.5 }}>
            <Button onClick={() => { setAssociationOpportunity(null); setAssociationNewObjectiveText(''); }} sx={{ textTransform: 'none', fontWeight: 850 }}>Cancelar</Button>
            <Button variant="contained" disabled={associationObjectiveIndex === 'new' && !associationNewObjectiveText.trim()} onClick={associateOpportunityToObjective} sx={{ textTransform: 'none', fontWeight: 900 }}>{associationObjectiveIndex === 'new' ? 'Crear y asociar' : 'Confirmar asociación'}</Button>
          </Stack>
        </Box>
      </Dialog>
      <Dialog open={Boolean(evidenceOpportunity)} onClose={() => setEvidenceOpportunity(null)} fullWidth maxWidth="md" PaperProps={{ sx: { borderRadius: 3.5 } }}>
        <Box sx={{ p: { xs: 2.2, md: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: 950, color: '#0f172a' }}>Evidencias del aspecto</Typography>
          <Typography variant="body2" sx={{ mt: 0.6, color: '#64748b' }}>{evidenceOpportunity?.aspecto}</Typography>
          <Paper elevation={0} sx={{ mt: 2, p: 2, borderRadius: 2.5, border: '1px solid #dbe3ee', bgcolor: '#f8fafc' }}>
            <Typography variant="body2" sx={{ color: '#334155', whiteSpace: 'pre-wrap' }}>{evidenceOpportunity?.evidencia || 'No hay evidencias registradas para este aspecto.'}</Typography>
          </Paper>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}><Button variant="contained" onClick={() => setEvidenceOpportunity(null)} sx={{ textTransform: 'none', fontWeight: 900 }}>Cerrar</Button></Stack>
        </Box>
      </Dialog>
    </Box>
    </Dialog>
  );
}

export default PlanMejoramiento;
