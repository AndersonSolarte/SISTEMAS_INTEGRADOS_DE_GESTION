import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  Checkbox, DialogContent, DialogTitle, Divider, FormControlLabel, Grid, IconButton, LinearProgress, MenuItem, Paper, Stack, Switch,
  InputAdornment, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import {
  AccessTimeOutlined, Add, Analytics, ArrowBack, AssessmentOutlined, AssignmentOutlined, CalendarTodayOutlined, Close, MoreTime, CheckCircleOutline, CloudSync, CorporateFare,
  DeleteOutline, Description, Download, EditOutlined, FolderOutlined, GridView, LockOutlined, Payments, Search,
  SettingsOutlined, SwapHoriz, TableRows, Timeline, UploadFile, ViewWeekOutlined
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../services/strategicPlanningService';
import StrategicActionPlanEditor from './StrategicActionPlanEditor';

const SPACES = [
  { key: 'configuration', label: '1. PED', icon: <SettingsOutlined /> },
  { key: 'planning', label: '2. Campos', icon: <ViewWeekOutlined /> },
  { key: 'references', label: '3. Dependencias', icon: <CorporateFare /> },
  { key: 'actions', label: '4. Planes de Acción', icon: <AssignmentOutlined /> },
  { key: 'monitoring', label: 'Informes', icon: <AssessmentOutlined /> },
  { key: 'budget', label: 'Presupuesto', icon: <Payments /> },
  { key: 'analytics', label: 'Resultados', icon: <Analytics /> }
];

const TERM_STATUS_LABEL = {
  active: 'Activa', closed: 'Cerrada', planned: 'Programada', draft: 'Borrador', inactive: 'Eliminada', archived: 'Archivada'
};

const ACTION_PLAN_STATUS_INFO = {
  convocation: { label: 'Convocatoria', color: 'default' },
  meeting_scheduled: { label: 'Reunión prog.', color: 'info' },
  formulation: { label: 'En formulación', color: 'info' },
  preliminary_minutes: { label: 'Acta preliminar', color: 'warning' },
  technical_review: { label: 'Revisión técnica', color: 'warning' },
  adjustments: { label: 'En ajustes (Líder)', color: 'error' },
  owner_validation: { label: 'En firmas líder', color: 'warning' },
  active: { label: 'En ejecución', color: 'success' },
  monitoring: { label: 'En seguimiento', color: 'primary' },
  closed: { label: 'Cerrado', color: 'default' }
};

const PLAN_STATUS_LABEL = {
  active: 'Activo', closed: 'Cerrado', planned: 'Programado', draft: 'Borrador', historical: 'Histórico'
};

const FIELD_TYPE_LABEL = {
  text: 'Texto corto', long_text: 'Texto largo', number: 'Número', percentage: 'Porcentaje',
  date: 'Fecha', currency: 'Moneda', list: 'Lista desplegable', catalog: 'Referencia institucional',
  catalog_multi: 'Selección múltiple', strategic_relation: 'Relación con la estructura del PED',
  file: 'Archivo o evidencia', formula: 'Fórmula'
};

const SectionHeader = ({ step, title, description, action }) => (
  <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2} mb={2.5}>
    <Box><Typography variant="h5" fontWeight={900}>{title}</Typography>{description && <Typography color="text.secondary" mt={0.25} fontSize={13.5}>{description}</Typography>}</Box>
    {action}
  </Stack>
);

const StepNavigation = ({ onBack, onNext, nextLabel }) => (
  <Stack direction="row" justifyContent={onBack ? 'space-between' : 'flex-end'} alignItems="center" mt={3} pt={2} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
    {onBack && <Button variant="text" onClick={onBack} sx={{ textTransform: 'none', fontWeight: 800 }}>Anterior</Button>}
    {onNext && <Button variant="contained" onClick={onNext} sx={{ borderRadius: 2.5, px: 3, textTransform: 'none', fontWeight: 900 }}>{nextLabel || 'Continuar'}</Button>}
  </Stack>
);

const SubstepHeader = ({ number, title, description, action }) => (
  <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1.5} mb={1.5} mt={number === 1 ? 0 : 3}>
    <Stack direction="row" alignItems="center" gap={1.25}>
      <Box sx={{ width: 34, height: 34, flex: '0 0 34px', borderRadius: '50%', bgcolor: '#2563eb', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 950, boxShadow: '0 5px 12px rgba(37,99,235,.18)' }}>{number}</Box>
      <Box><Typography fontWeight={950} fontSize={18}>{title}</Typography>{description && <Typography variant="body2" color="text.secondary">{description}</Typography>}</Box>
    </Stack>
    {action}
  </Stack>
);

const emptyStrategicPlanForm = {
  code: '', name: '', description: '', starts_on: '', ends_on: '', duration_years: 7,
  status: 'draft', administrative_act: '', approved_on: '', global_budget: '', setup_mode: 'blank'
};

const copDigits = (value) => {
  const text = String(value ?? '').trim();
  if (/^\d+\.\d{1,2}$/.test(text)) return text.split('.')[0];
  return text.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
};

const formatCop = (value) => {
  const digits = copDigits(value);
  return digits ? `$ ${digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}` : '';
};

const formatIsoDate = (value) => {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : '';
};

export default function StrategicPlanningPlatform({ onBack }) {
  const { enqueueSnackbar } = useSnackbar();
  const [space, setSpace] = useState('configuration');
  const [loading, setLoading] = useState(true);
  const [boot, setBoot] = useState(null);
  const [strategicPlans, setStrategicPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [plans, setPlans] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [syncJobs, setSyncJobs] = useState([]);
  const [openPlan, setOpenPlan] = useState(false);
  const [openStrategicPlan, setOpenStrategicPlan] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState(null);
  const [openCatalog, setOpenCatalog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ term_id: '', catalog_item_id: '', title: '' });
  const [importPreview, setImportPreview] = useState(null);
  const [leaders, setLeaders] = useState([]);
  const [leaderDocument, setLeaderDocument] = useState('');
  const [leaderLookup, setLeaderLookup] = useState(null);
  const [referencePreview, setReferencePreview] = useState(null);
  const [termDependencies, setTermDependencies] = useState([]);
  const [selectedReferenceTermId, setSelectedReferenceTermId] = useState('');
  const [termDependencyPreview, setTermDependencyPreview] = useState(null);
  const [termDependencyForm, setTermDependencyForm] = useState({ dependency: '', document: '' });
  const [transfer, setTransfer] = useState(null);
  const [catalogType, setCatalogType] = useState('organizational_unit');
  const [newReference, setNewReference] = useState({ code: '', name: '' });
  const [editingReferenceId, setEditingReferenceId] = useState(null);
  const [newCatalog, setNewCatalog] = useState({ code: '', name: '', scope: 'action_plans' });
  const [strategicPlanForm, setStrategicPlanForm] = useState(emptyStrategicPlanForm);
  const [editorPlanId, setEditorPlanId] = useState(null);
  const [structure, setStructure] = useState([]);
  const [, setStructureLoading] = useState(false);
  const [openLevel, setOpenLevel] = useState(false);
  const [openElement, setOpenElement] = useState(false);
  const [openTerm, setOpenTerm] = useState(false);
  const [openField, setOpenField] = useState(false);
  const [levelForm, setLevelForm] = useState({ id: null, name: '' });
  const [elementForm, setElementForm] = useState({ id: null, level_id: '', parent_id: '', code: '', name: '', description: '' });
  const [termForm, setTermForm] = useState({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned', formulation_starts_on: '', formulation_ends_on: '', propagate_to_plans: false });
  const [generalTimelineModal, setGeneralTimelineModal] = useState({ open: false, term: null, starts_on: '', ends_on: '', saving: false });
  const [fieldForm, setFieldForm] = useState({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '', list_source: 'manual', selected_level_id: '', selected_element_ids: [] });
  const [fieldSchemaPreview, setFieldSchemaPreview] = useState(null);
  const [replaceSchemaFields, setReplaceSchemaFields] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState(null);
  const [showAdvancedConfig, setShowAdvancedConfig] = useState(false);
  const [pedWorkspaceOpen, setPedWorkspaceOpen] = useState(false);
  const [selectedActionTermId, setSelectedActionTermId] = useState('');
  const [dependencySearch, setDependencySearch] = useState('');
  const [dependencyView, setDependencyView] = useState('cards');
  const [actionPlanCreationContext, setActionPlanCreationContext] = useState(null);
  const [managedListFieldId, setManagedListFieldId] = useState('');
  const [dependencyToRemove, setDependencyToRemove] = useState(null);
  const [repositorySyncing, setRepositorySyncing] = useState(false);
  const [repositoryResult, setRepositoryResult] = useState(null);
  const [deleteActionPlanCandidate, setDeleteActionPlanCandidate] = useState(null);
  const [bulkDeleteCandidate, setBulkDeleteCandidate] = useState(null);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');
  const [editActionPlanCandidate, setEditActionPlanCandidate] = useState(null);
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bootstrapResponse, strategicPlanResponse, planResponse] = await Promise.all([
        strategicPlanningService.bootstrap(), strategicPlanningService.listPlans(), strategicPlanningService.listActionPlans()
      ]);
      const availablePlans = strategicPlanResponse.data || [];
      setBoot(bootstrapResponse.data); setStrategicPlans(availablePlans); setPlans(planResponse.data || []);
      setSelectedPlanId((current) => {
        const remembered = localStorage.getItem('siac:selected-strategic-plan');
        if (availablePlans.some((item) => item.id === current)) return current;
        if (availablePlans.some((item) => item.id === remembered)) return remembered;
        return availablePlans[0]?.id || bootstrapResponse.data?.plan?.id || '';
      });
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible abrir la nueva plataforma.', { variant: 'error' });
    } finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (selectedPlanId) localStorage.setItem('siac:selected-strategic-plan', selectedPlanId); }, [selectedPlanId]);
  useEffect(() => {
    if (space === 'analytics') strategicPlanningService.analytics().then((r) => setAnalytics(r.data)).catch(() => null);
    if (space === 'monitoring') strategicPlanningService.syncJobs().then((r) => setSyncJobs(r.data || [])).catch(() => null);
  }, [space]);

  const plan = strategicPlans.find((item) => item.id === selectedPlanId) || boot?.plan;
  const planStartYear = Number(String(plan?.starts_on || '').slice(0, 4)) || null;
  const planEndYear = Number(String(plan?.ends_on || '').slice(0, 4)) || null;
  const isTermInPlanRange = (term) => {
    const year = Number(term?.year);
    if (!year) return false;
    if (planStartYear && year < planStartYear) return false;
    if (planEndYear && year > planEndYear) return false;
    return true;
  };
  const terms = plan?.terms || [];
  const selectedTerm = terms.find((term) => String(term.id) === String(form.term_id));
  const units = (plan?.catalogItems || []).filter((item) => ['dependency', 'organizational_unit'].includes(item.catalog_type) && item.active);
  const visiblePlans = plans.filter((item) => item.term?.strategicPlan?.id === plan?.id);
  const actionTerms = [...terms]
    .filter((term) => term.status !== 'inactive' && term.status !== 'archived' && isTermInPlanRange(term))
    .sort((a, b) => a.year - b.year);
  const selectedActionTerm = actionTerms.find((term) => String(term.id) === String(selectedActionTermId)) || actionTerms.find((term) => term.status === 'active') || actionTerms[0];
  const selectedYearPlans = visiblePlans.filter((item) => String(item.term_id || item.term?.id) === String(selectedActionTerm?.id));
  const normalizedDependencySearch = dependencySearch.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const selectedTermAssignments = termDependencies.filter((item) => String(item.term_id) === String(selectedActionTerm?.id));
  const selectedActionUnitsById = new Map();
  selectedTermAssignments.forEach((item) => {
    if (item.dependency?.id) selectedActionUnitsById.set(String(item.dependency.id), { ...item.dependency, annualAssignment: item });
  });
  // Un plan ya guardado siempre debe poder abrirse, incluso si proviene del
  // módulo histórico o si su antigua asignación anual no existe todavía.
  selectedYearPlans.forEach((actionPlan) => {
    const unit = actionPlan.organizationalUnit;
    if (!unit?.id || selectedActionUnitsById.has(String(unit.id))) return;
    const responsibleUser = actionPlan.responsibleUser;
    selectedActionUnitsById.set(String(unit.id), {
      ...unit,
      annualAssignment: {
        term_id: actionPlan.term_id || actionPlan.term?.id,
        dependency: unit,
        inheritedFromPlan: true,
        responsible: responsibleUser ? {
          id: responsibleUser.id, name: responsibleUser.nombre, email: responsibleUser.email,
          dependency: responsibleUser.dependencia, position: responsibleUser.cargo
        } : null
      }
    });
  });
  const selectedActionUnits = [...selectedActionUnitsById.values()].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es'));
  const visibleActionUnits = selectedActionUnits
    .filter((unit) => {
      if (!normalizedDependencySearch) return true;
      const responsible = unit.annualAssignment?.responsible || {};
      const actionPlan = selectedYearPlans.find((item) => String(item.catalog_item_id || item.organizationalUnit?.id) === String(unit.id));
      const planResponsible = actionPlan?.responsibleUser || {};
      const searchable = [
        unit.code, unit.name, responsible.document, responsible.name, responsible.email,
        responsible.dependency, responsible.position, actionPlan?.code, actionPlan?.title,
        actionPlan?.status, planResponsible.nombre, planResponsible.email,
        planResponsible.dependencia, planResponsible.cargo,
        actionPlan ? 'plan creado abierto' : 'pendiente crear plan'
      ].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      return searchable.includes(normalizedDependencySearch);
    });
  const standardCatalogs = [
    ['organizational_unit','Dependencias'], ['position','Cargos'], ['actor','Actores'],
    ['macroactivity','Macroactividades'], ['meeting_location','Lugares de reunión'], ['reference_status','Estados de referencia']
  ];
  const customCatalogs = Array.isArray(plan?.settings?.referenceCatalogs) ? plan.settings.referenceCatalogs : [];
  const catalogOptions = [...standardCatalogs, ...customCatalogs.map((item) => [item.code, item.name])]
    .filter((item, index, source) => source.findIndex((candidate) => candidate[0] === item[0]) === index);
  const configuredTermIds = new Set(termDependencies.map((item) => String(item.term_id)));
  const institutionalListsReady = actionTerms.length > 0 && actionTerms.every((term) => configuredTermIds.has(String(term.id)));
  const selectedReferenceTerm = actionTerms.find((term) => String(term.id) === String(selectedReferenceTermId)) || actionTerms[0];
  const selectedReferenceAssignments = termDependencies.filter((item) => String(item.term_id) === String(selectedReferenceTerm?.id));
  const annualLeaderDocument = String(termDependencyForm.document || '').replace(/\D/g, '');
  const selectedAnnualLeader = annualLeaderDocument ? leaders.find((item) => String(item.document || '').replace(/\D/g, '') === annualLeaderDocument) : null;
  const activeFieldDefinitions = (plan?.fieldDefinitions || []).filter((field) => field.active !== false);
  const choiceFieldDefinitions = activeFieldDefinitions.filter((field) => ['list', 'catalog', 'catalog_multi'].includes(field.data_type));
  const managedListField = choiceFieldDefinitions.find((field) => String(field.id) === String(managedListFieldId));
  const managedCatalogType = managedListField?.validation_rules?.catalog_type || '';
  const managedCatalogItems = managedCatalogType ? (plan?.catalogItems || []).filter((item) => item.catalog_type === managedCatalogType) : [];
  const activeLevels = (plan?.levels || []).filter((level) => level.active !== false);
  const setupSteps = [
    { number: 1, title: 'Datos del PED', description: `${plan?.code || 'PED'} · ${plan?.starts_on || ''} a ${plan?.ends_on || ''}`, complete: Boolean(plan?.id), action: () => editStrategicPlan(), actionLabel: 'Revisar datos' },
    { number: 2, title: 'Definir los campos de la tabla', description: activeFieldDefinitions.length ? `${activeFieldDefinitions.length} columnas configuradas para este PED` : 'Importe los encabezados de un Excel o cree cada campo manualmente.', complete: activeFieldDefinitions.length > 0, action: () => setSpace('planning'), actionLabel: activeFieldDefinitions.length ? 'Revisar campos' : 'Configurar ahora' },
    { number: 3, title: 'Configurar dependencias por año', description: `${configuredTermIds.size} de ${actionTerms.length} vigencias configuradas`, complete: institutionalListsReady, action: () => setSpace('references'), actionLabel: institutionalListsReady ? 'Revisar vigencias' : 'Configurar ahora' },
    { number: 4, title: 'Crear el primer Plan de Acción', description: visiblePlans.length ? `${visiblePlans.length} planes creados para este PED` : 'Seleccione año, dependencia y responsable para comenzar.', complete: visiblePlans.length > 0, action: () => setSpace('actions'), actionLabel: visiblePlans.length ? 'Abrir planes' : 'Crear ahora' }
  ];
  const completedSetupSteps = setupSteps.filter((step) => step.complete).length;
  const setupReady = completedSetupSteps === setupSteps.length;
  const nextSetupStep = setupSteps.find((step) => !step.complete) || setupSteps[setupSteps.length - 1];
  const newPedStartYear = Number(String(strategicPlanForm.starts_on || '').slice(0, 4));
  const newPedEndYear = newPedStartYear && Number(strategicPlanForm.duration_years) > 0
    ? newPedStartYear + Number(strategicPlanForm.duration_years) : null;
  const administrativeDateInvalid = Boolean(
    strategicPlanForm.approved_on
    && strategicPlanForm.starts_on
    && strategicPlanForm.approved_on < strategicPlanForm.starts_on
  );

  useEffect(() => {
    if (!plan?.id) return;
    strategicPlanningService.leaderOptions(plan.id).then((response) => setLeaders(response.data || [])).catch(() => setLeaders([]));
    strategicPlanningService.termDependencies(plan.id).then((response) => setTermDependencies(response.data || [])).catch(() => setTermDependencies([]));
    const activeTerm = terms.find((term) => term.status === 'active') || terms[0];
    setForm((current) => ({ ...current, term_id: activeTerm?.id || '', catalog_item_id: '' }));
    setSelectedActionTermId(activeTerm?.id || ''); setDependencySearch('');
    setSelectedReferenceTermId(activeTerm?.id || ''); setTermDependencyPreview(null);
    setLeaderDocument(''); setLeaderLookup(null);
  }, [plan?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStructure = useCallback(async () => {
    if (!plan?.id) return;
    setStructureLoading(true);
    try { const response = await strategicPlanningService.listStructure(plan.id); setStructure(response.data || []); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar la estructura del PED.', { variant: 'error' }); }
    finally { setStructureLoading(false); }
  }, [plan?.id, enqueueSnackbar]);

  useEffect(() => { loadStructure(); }, [loadStructure]);

  const saveStructureLevel = async () => {
    if (!levelForm.name.trim()) return enqueueSnackbar('Escriba el nombre del nivel.', { variant: 'warning' });
    setSaving(true);
    try {
      const nextPosition = Math.max(0, ...(plan.levels || []).map((item) => Number(item.position || 0))) + 1;
      if (levelForm.id) await strategicPlanningService.updateLevel(plan.id, levelForm.id, { name: levelForm.name.trim() });
      else await strategicPlanningService.createLevel(plan.id, { name: levelForm.name.trim(), position: nextPosition });
      const wasEditing = Boolean(levelForm.id); setLevelForm({ id: null, name: '' }); setOpenLevel(false); await load(); await loadStructure();
      enqueueSnackbar(wasEditing ? 'Tipo de contenido actualizado.' : 'Tipo de contenido creado. Ahora agregue sus registros.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el nivel.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const saveStructureElement = async () => {
    if (!elementForm.level_id || !elementForm.code.trim() || !elementForm.name.trim()) return enqueueSnackbar('Seleccione el nivel y complete código y nombre.', { variant: 'warning' });
    setSaving(true);
    try {
      const payload = { ...elementForm, parent_id: elementForm.parent_id || null, position: structure.filter((item) => item.level_id === elementForm.level_id).length + 1 };
      if (elementForm.id) await strategicPlanningService.updateElement(plan.id, elementForm.id, payload);
      else await strategicPlanningService.createElement(plan.id, payload);
      const wasEditing = Boolean(elementForm.id); setElementForm({ id: null, level_id: '', parent_id: '', code: '', name: '', description: '' }); setOpenElement(false); await loadStructure();
      enqueueSnackbar(wasEditing ? 'Contenido actualizado.' : 'Contenido agregado al PED.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el elemento.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const selectedElementLevel = (plan?.levels || []).find((item) => item.id === elementForm.level_id);
  const parentCandidates = structure.filter((item) => Number(item.level?.position || 0) < Number(selectedElementLevel?.position || 0));

  const saveStrategicPlan = async () => {
    const wasEditing = Boolean(editingPlanId);
    if ((!wasEditing && (!strategicPlanForm.starts_on || !strategicPlanForm.duration_years)) || (wasEditing && (!strategicPlanForm.code.trim() || !strategicPlanForm.name.trim() || !strategicPlanForm.starts_on || !strategicPlanForm.ends_on))) {
      return enqueueSnackbar(wasEditing ? 'Complete código, nombre y fechas del PED.' : 'Seleccione la fecha inicial y la duración del PED.', { variant: 'warning' });
    }
    if (administrativeDateInvalid) {
      return enqueueSnackbar('La fecha del acto administrativo debe ser igual o posterior a la fecha inicial del PED.', { variant: 'warning' });
    }
    setSaving(true);
    try {
      const response = wasEditing ? await strategicPlanningService.updatePlan(editingPlanId, {
        ...strategicPlanForm,
        approved_on: strategicPlanForm.approved_on || null,
        global_budget: strategicPlanForm.global_budget === '' ? null : strategicPlanForm.global_budget,
        administrative_act: strategicPlanForm.administrative_act.trim() || null,
        justification: 'Actualización desde configuración'
      }) : await strategicPlanningService.createPlan({ ...strategicPlanForm, template_plan_id: strategicPlanForm.setup_mode === 'blank' ? null : (plan?.id || null) });
      setOpenStrategicPlan(false);
      setEditingPlanId(null);
      setStrategicPlanForm(emptyStrategicPlanForm);
      await load(); setSelectedPlanId(response.data.id); setPedWorkspaceOpen(true); setSpace('configuration');
      enqueueSnackbar(wasEditing ? 'PED actualizado correctamente.' : 'PED creado con sus años y semestres. Ya puede definir sus campos.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el PED.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const editStrategicPlan = () => {
    setEditingPlanId(plan.id);
    setStrategicPlanForm({ code: plan.code || '', name: plan.name || '', description: plan.description || '', starts_on: plan.starts_on || '', ends_on: plan.ends_on || '', duration_years: '', status: plan.status || 'draft', administrative_act: plan.administrative_act || '', approved_on: plan.approved_on || '', global_budget: copDigits(plan.global_budget) });
    setOpenStrategicPlan(true);
  };

  const handlePlanDateChange = (field, value) => {
    const nextStartsOn = field === 'starts_on' ? value : strategicPlanForm.starts_on;
    const nextEndsOn = field === 'ends_on' ? value : strategicPlanForm.ends_on;
    const startYear = String(nextStartsOn || '').slice(0, 4);
    const endYear = String(nextEndsOn || '').slice(0, 4);

    let nextCode = strategicPlanForm.code;
    let nextName = strategicPlanForm.name;

    if (!nextCode && /^\d{4}$/.test(startYear) && /^\d{4}$/.test(endYear)) {
      nextCode = `PED-${startYear}-${endYear}`;
    }
    if (!nextName && /^\d{4}$/.test(startYear) && /^\d{4}$/.test(endYear)) {
      nextName = `Plan Estratégico de Desarrollo ${startYear}–${endYear}`;
    }

    setStrategicPlanForm((prev) => ({
      ...prev,
      [field]: value,
      code: nextCode,
      name: nextName
    }));
  };


  const openGeneralTimelineModal = (term) => {
    setGeneralTimelineModal({
      open: true,
      term,
      starts_on: term.metadata?.formulation_starts_on || `${term.year}-01-01`,
      ends_on: term.metadata?.formulation_ends_on || `${term.year}-03-31`,
      saving: false
    });
  };

  const handleAddDaysToGeneralTimeline = (days) => {
    const base = generalTimelineModal.ends_on ? new Date(generalTimelineModal.ends_on + 'T00:00:00') : new Date();
    base.setDate(base.getDate() + days);
    setGeneralTimelineModal((prev) => ({ ...prev, ends_on: base.toISOString().slice(0, 10) }));
  };

  const handleSetEndOfMonthGeneralTimeline = () => {
    const now = generalTimelineModal.ends_on ? new Date(generalTimelineModal.ends_on + 'T00:00:00') : new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setGeneralTimelineModal((prev) => ({ ...prev, ends_on: endOfMonth.toISOString().slice(0, 10) }));
  };

  const handleSaveGeneralTimeline = async () => {
    if (!generalTimelineModal.ends_on) return enqueueSnackbar('Indique la fecha límite de cierre general.', { variant: 'warning' });
    setGeneralTimelineModal((prev) => ({ ...prev, saving: true }));
    try {
      await strategicPlanningService.updateTerm(generalTimelineModal.term.id, {
        formulation_starts_on: generalTimelineModal.starts_on,
        formulation_ends_on: generalTimelineModal.ends_on,
        propagate_to_plans: true,
        justification: 'Ajuste general de plazo de formulación de la vigencia'
      });
      enqueueSnackbar(`Plazo general de la vigencia ${generalTimelineModal.term.year} actualizado y aplicado a los planes. Las prórrogas individuales mayores fueron respetadas.`, { variant: 'success' });
      setGeneralTimelineModal({ open: false, term: null, starts_on: '', ends_on: '', saving: false });
      await load();
    } catch (err) {
      enqueueSnackbar(err?.response?.data?.message || 'No fue posible actualizar el plazo general.', { variant: 'error' });
      setGeneralTimelineModal((prev) => ({ ...prev, saving: false }));
    }
  };

  const saveTerm = async () => {
    if (!termForm.year || !termForm.starts_on || !termForm.ends_on) return enqueueSnackbar('Complete el año y sus fechas.', { variant: 'warning' });
    setSaving(true);
    try {
      const year = Number(termForm.year);
      const payload = {
        year,
        name: `Año ${termForm.year}`,
        starts_on: termForm.starts_on,
        ends_on: termForm.ends_on,
        status: termForm.status,
        formulation_starts_on: termForm.formulation_starts_on || `${year}-01-01`,
        formulation_ends_on: termForm.formulation_ends_on || `${year}-03-31`,
        propagate_to_plans: Boolean(termForm.propagate_to_plans)
      };
      if (termForm.id) await strategicPlanningService.updateTerm(termForm.id, { ...payload, justification: 'Edición desde configuración' });
      else {
        await strategicPlanningService.createTerm(plan.id, { ...payload, periods: [
          { code: 'S1', name: 'Seguimiento 1', starts_on: `${year}-01-01`, ends_on: `${year}-06-30`, weight: 0.5, status: termForm.status },
          { code: 'S2', name: 'Seguimiento 2 / Cierre', starts_on: `${year}-07-01`, ends_on: `${year}-12-31`, weight: 0.5, status: termForm.status }
        ] });
      }
      const wasEditing = Boolean(termForm.id); setOpenTerm(false); setTermForm({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned', formulation_starts_on: '', formulation_ends_on: '', propagate_to_plans: false }); await load();
      enqueueSnackbar(wasEditing ? 'Año y plazos actualizados.' : 'Año, plazos y periodos creados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el año.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const saveField = async () => {
    if (!fieldForm.key.trim() || !fieldForm.label.trim() || !fieldForm.data_type) return enqueueSnackbar('Complete nombre, código y tipo del campo.', { variant: 'warning' });
    setSaving(true);
    try {
      const options = fieldForm.options_text.split('\n').map((item) => item.trim()).filter(Boolean);
      const payload = { key: fieldForm.key, label: fieldForm.label, data_type: fieldForm.data_type, required: fieldForm.required, options, formula: fieldForm.formula || null, validation_rules: fieldForm.catalog_type ? { catalog_type: fieldForm.catalog_type } : {} };
      if (fieldForm.id) await strategicPlanningService.updateField(plan.id, fieldForm.id, { ...payload, justification: 'Edición desde constructor de campos' });
      else await strategicPlanningService.createField(plan.id, payload);
      const wasEditing = Boolean(fieldForm.id); setOpenField(false); setFieldForm({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '', list_source: 'manual', selected_level_id: '', selected_element_ids: [] }); await load();
      enqueueSnackbar(wasEditing ? 'Campo actualizado.' : 'Campo agregado al Plan de Acción.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el campo.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const openFieldEditor = (field) => {
    setFieldForm({ id: field.id, key: field.key, label: field.label, data_type: field.data_type, required: field.required, options_text: (field.options || []).join('\n'), formula: field.formula || '', catalog_type: field.validation_rules?.catalog_type || '', list_source: field.validation_rules?.list_source || 'manual', selected_level_id: field.validation_rules?.selected_level_id || '', selected_element_ids: field.validation_rules?.selected_element_ids || [] });
    setOpenField(true);
  };

  const deleteField = async (field) => {
    if (!window.confirm(`¿Eliminar el campo "${field.label}" de las nuevas versiones del Plan de Acción?`)) return;
    try { await strategicPlanningService.deleteField(plan.id, field.id); await load(); enqueueSnackbar('Campo eliminado sin alterar planes anteriores.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el campo.', { variant: 'error' }); }
  };

  const previewFieldSchema = async (file) => {
    if (!file) return;
    if (!plan?.id) {
      enqueueSnackbar('Seleccione primero un PED para configurar sus columnas.', { variant: 'warning' });
      return;
    }
    const body = new FormData();
    body.append('file', file);
    try {
      const response = await strategicPlanningService.previewFieldSchema(plan.id, body);
      setFieldSchemaPreview({ ...response.data, fields: response.data.parsed_data?.fields || [] });
      setReplaceSchemaFields(false);
      enqueueSnackbar(`Se detectaron ${response.data.summary?.detected || 0} columnas. Revíselas antes de continuar.`, { variant: 'success' });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || 'No fue posible leer los encabezados del Excel. Verifique que el archivo sea un Excel (.xlsx) válido con encabezados de columna.';
      enqueueSnackbar(msg, { variant: 'error' });
    }
  };

  const updatePreviewField = (index, changes) => setFieldSchemaPreview((current) => ({
    ...current, fields: current.fields.map((field, fieldIndex) => fieldIndex === index ? { ...field, ...changes } : field)
  }));

  const confirmFieldSchema = async () => {
    const selected = (fieldSchemaPreview?.fields || []).filter((field) => field.include && !field.system);
    if (!selected.length) return enqueueSnackbar('Seleccione por lo menos una columna.', { variant: 'warning' });
    setSaving(true);
    try {
      await strategicPlanningService.confirmFieldSchema(fieldSchemaPreview.id, { fields: fieldSchemaPreview.fields, replace_existing: replaceSchemaFields });
      setFieldSchemaPreview(null); await load();
      enqueueSnackbar('La tabla y el formulario dinámico del PED quedaron configurados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible crear los campos.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const deleteDraftPlan = async () => {
    if (!deleteCandidate) return;
    setSaving(true);
    try {
      await strategicPlanningService.deletePlan(deleteCandidate.id);
      if (String(selectedPlanId) === String(deleteCandidate.id)) {
        localStorage.removeItem('siac:selected-strategic-plan'); setSelectedPlanId('');
      }
      setDeleteCandidate(null); await load();
      enqueueSnackbar('El PED en borrador fue eliminado.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el PED.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const createCatalog = async () => {
    const code = newCatalog.code.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
    if (!code || !newCatalog.name.trim()) return enqueueSnackbar('Escriba el nombre y el código de la nueva tabla.', { variant: 'warning' });
    if (catalogOptions.some(([value]) => value === code)) return enqueueSnackbar('Ya existe una tabla con ese código.', { variant: 'warning' });
    try {
      const referenceCatalogs = [...customCatalogs, { code, name: newCatalog.name.trim(), scope: newCatalog.scope || 'action_plans' }];
      await strategicPlanningService.updatePlan(plan.id, { settings: { referenceCatalogs }, justification: 'Creación de tabla de referencia' });
      setCatalogType(code); setNewCatalog({ code: '', name: '', scope: 'action_plans' }); setOpenCatalog(false); await load();
      enqueueSnackbar('Tabla creada. Ya puede agregar sus registros.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible crear la tabla.', { variant: 'error' }); }
  };

  const createActionPlan = async () => {
    if (!form.term_id || !form.catalog_item_id || !form.responsible_user_id) return enqueueSnackbar('Seleccione año, dependencia y líder del Plan de Acción.', { variant: 'warning' });
    setSaving(true);
    const leader = leaders.find((item) => String(item.id) === String(form.responsible_user_id));
    try { const response = await strategicPlanningService.createActionPlan({ ...form, position_catalog_item_id: leader?.position_catalog_item_id || null }); setOpenPlan(false); setActionPlanCreationContext(null); setLeaderDocument(''); setLeaderLookup(null); await load(); setEditorPlanId(response.data.id); enqueueSnackbar('Plan creado. Complete ahora sus actividades, reunión y aprobación.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible crear el plan.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const openActionPlanCreation = (term, unit) => {
    const assignedUserId = unit.annualAssignment?.responsible?.id;
    const suggestedLeader = leaders.find((leader) => String(leader.id) === String(assignedUserId));
    setForm({ term_id: term.id, catalog_item_id: unit.id, responsible_user_id: suggestedLeader?.id || '', title: `Plan de Acción ${unit.name} ${term.year}` });
    setLeaderDocument(suggestedLeader?.document || '');
    setLeaderLookup(suggestedLeader ? { found: true, leader: suggestedLeader } : null);
    setActionPlanCreationContext({ term, unit });
    setOpenPlan(true);
  };

  const syncActionRepository = async () => {
    if (!selectedActionTerm || repositorySyncing) return;
    setRepositorySyncing(true);
    setRepositoryResult(null);
    try {
      const response = await strategicPlanningService.syncActionRepository(selectedActionTerm.id);
      setRepositoryResult(response.data);
      enqueueSnackbar(
        response.data?.files_deferred
          ? `Estructura de carpetas de ${selectedActionTerm.year} preparada. Los archivos se subirán al habilitar OAuth.`
          : `Repositorio de ${selectedActionTerm.year} sincronizado correctamente.`,
        { variant: response.data?.files_deferred ? 'warning' : 'success' }
      );
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible sincronizar el repositorio con Drive.', { variant: 'error' });
    } finally { setRepositorySyncing(false); }
  };

  const confirmDeleteActionPlan = async () => {
    if (!deleteActionPlanCandidate) return;
    setSaving(true);
    try {
      await strategicPlanningService.deleteActionPlan(deleteActionPlanCandidate.id);
      enqueueSnackbar(`Plan ${deleteActionPlanCandidate.code || ''} y dependencia retirados de la vigencia.`, { variant: 'success' });
      setDeleteActionPlanCandidate(null);
      await Promise.all([load(), refreshTermDependencies()]);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el plan.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const confirmBulkDeleteActionPlans = async () => {
    if (!bulkDeleteCandidate) return;
    setBulkActionLoading(true);
    try {
      const response = await strategicPlanningService.bulkDeleteActionPlans(bulkDeleteCandidate.id);
      enqueueSnackbar(response.message || `Se eliminaron los planes y dependencias de la vigencia ${bulkDeleteCandidate.year}.`, { variant: 'success' });
      setBulkDeleteCandidate(null);
      setBulkDeleteConfirmText('');
      await Promise.all([load(), refreshTermDependencies()]);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar los planes.', { variant: 'error' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleBulkCreateActionPlans = async () => {
    if (!selectedActionTerm) return;
    setBulkActionLoading(true);
    try {
      const response = await strategicPlanningService.bulkCreateActionPlans(selectedActionTerm.id);
      enqueueSnackbar(response.message || `Planes creados exitosamente para la vigencia ${selectedActionTerm.year}.`, { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible crear los planes masivamente.', { variant: 'error' });
    } finally {
      setBulkActionLoading(false);
    }
  };

  const confirmUpdateActionPlanMeta = async () => {
    if (!editActionPlanCandidate) return;
    setSaving(true);
    try {
      await strategicPlanningService.updateActionPlan(editActionPlanCandidate.id, {
        code: editActionPlanCandidate.code,
        title: editActionPlanCandidate.title,
        responsible_user_id: editActionPlanCandidate.responsible_user_id
      });
      enqueueSnackbar('Plan de Acción actualizado correctamente.', { variant: 'success' });
      setEditActionPlanCandidate(null);
      await load();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar el plan.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const selectLeader = (leader) => {
    if (!leader) { setForm((current) => ({ ...current, responsible_user_id: '' })); setLeaderLookup(null); return; }
    setForm((current) => ({ ...current, responsible_user_id: leader.id, catalog_item_id: actionPlanCreationContext?.unit?.id || leader.dependency_catalog_item_id || current.catalog_item_id }));
    setLeaderDocument(leader.document || ''); setLeaderLookup({ found: true, leader });
  };

  const searchLeaderByDocument = () => {
    const document = String(leaderDocument || '').replace(/\D/g, '');
    if (!document) return setLeaderLookup({ found: false, message: 'Escriba el número de documento.' });
    const leader = leaders.find((item) => String(item.document || '').replace(/\D/g, '') === document);
    if (!leader) {
      setForm((current) => ({ ...current, responsible_user_id: '' }));
      return setLeaderLookup({ found: false, message: 'No existe un usuario activo con ese número de documento.' });
    }
    selectLeader(leader);
  };

  const previewFile = async (file, kind) => {
    if (!file) return; const body = new FormData(); body.append('file', file);
    const activeTerm = terms.find((term) => term.status === 'active'); body.append('term_id', activeTerm?.id || '');
    if (kind === 'historical') { body.append('strategic_plan_id', plan.id); body.append('format_code', 'DIR-PE-FR-003'); body.append('format_version', '5'); }
    try {
      const response = kind === 'budget' ? await strategicPlanningService.previewBudget(body) : await strategicPlanningService.previewHistorical(body);
      setImportPreview({ kind, ...response.data }); enqueueSnackbar('Vista previa generada; aún no se modificaron datos.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible validar el archivo.', { variant: 'error' }); }
  };

  const previewReferences = async (file) => {
    if (!file) return; const body = new FormData(); body.append('file', file);
    try { const response = await strategicPlanningService.previewReferences(plan.id, body); setReferencePreview(response.data); enqueueSnackbar('Tablas analizadas. Revise el cruce de responsables antes de confirmar.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible analizar las tablas.', { variant: 'error' }); }
  };
  const downloadReferenceTemplate = async () => {
    try {
      const blob = await strategicPlanningService.downloadReferenceTemplate(plan.id);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `LISTAS_INSTITUCIONALES_${plan.code}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
      enqueueSnackbar('Plantilla descargada. Edítela y vuelva a subirla en el paso 2.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible descargar la plantilla.', { variant: 'error' }); }
  };
  const confirmReferences = async () => {
    try { await strategicPlanningService.confirmReferences(referencePreview.id); setReferencePreview(null); await load(); enqueueSnackbar('Referencias dinámicas cargadas correctamente.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible confirmar las referencias.', { variant: 'error' }); }
  };
  const refreshTermDependencies = async () => {
    if (!plan?.id) return;
    const response = await strategicPlanningService.termDependencies(plan.id);
    setTermDependencies(response.data || []);
  };
  const downloadAnnualDependencies = async () => {
    if (!selectedReferenceTerm) return;
    try {
      const blob = await strategicPlanningService.downloadTermDependencyTemplate(selectedReferenceTerm.id);
      const url = URL.createObjectURL(blob); const anchor = document.createElement('a');
      anchor.href = url; anchor.download = `DEPENDENCIAS_${selectedReferenceTerm.year}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
      enqueueSnackbar(`Plantilla de ${selectedReferenceTerm.year} descargada.`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible descargar la plantilla.', { variant: 'error' }); }
  };
  const previewAnnualDependencies = async (file) => {
    if (!file || !selectedReferenceTerm) return;
    const body = new FormData(); body.append('file', file);
    try {
      const response = await strategicPlanningService.previewTermDependencies(selectedReferenceTerm.id, body);
      setTermDependencyPreview(response.data);
      enqueueSnackbar('Archivo revisado. Confirme solamente si todos los responsables son correctos.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible revisar el archivo.', { variant: 'error' }); }
  };
  const confirmAnnualDependencies = async () => {
    setSaving(true);
    try {
      await strategicPlanningService.confirmTermDependencies(termDependencyPreview.id);
      setTermDependencyPreview(null); await refreshTermDependencies(); await load();
      enqueueSnackbar(`Dependencias de ${selectedReferenceTerm.year} actualizadas.`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar la vigencia.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
  const addAnnualDependency = async () => {
    if (!selectedReferenceTerm || !termDependencyForm.dependency.trim() || !termDependencyForm.document.trim()) return enqueueSnackbar('Escriba la dependencia y la cédula.', { variant: 'warning' });
    setSaving(true);
    try {
      await strategicPlanningService.addTermDependency(selectedReferenceTerm.id, termDependencyForm);
      setTermDependencyForm({ dependency: '', document: '' }); await refreshTermDependencies(); await load();
      enqueueSnackbar(`Dependencia agregada a ${selectedReferenceTerm.year}.`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible agregar la dependencia.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
  const removeAnnualDependency = (assignment) => setDependencyToRemove({ assignment, year: selectedReferenceTerm?.year });
  const confirmRemoveAnnualDependency = async () => {
    if (!dependencyToRemove?.assignment || saving) return;
    setSaving(true);
    try {
      await strategicPlanningService.removeTermDependency(selectedReferenceTerm.id, dependencyToRemove.assignment.id); await refreshTermDependencies(); await load();
      setDependencyToRemove(null);
      enqueueSnackbar('Dependencia retirada de esta vigencia.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible retirar la dependencia.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
  const executeTransfer = async () => {
    const leader = leaders.find((item) => String(item.id) === String(transfer.user_id));
    try { await strategicPlanningService.transferLeader(transfer.plan.id, { user_id: transfer.user_id, position_catalog_item_id: leader?.position_catalog_item_id || null, reason: transfer.reason }); setTransfer(null); await load(); enqueueSnackbar('Responsable transferido; el anterior permanece en el histórico.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible transferir el liderazgo.', { variant: 'error' }); }
  };
  const saveReference = async () => {
    if (!newReference.code.trim() || !newReference.name.trim()) return;
    try {
      if (editingReferenceId) await strategicPlanningService.updateCatalog(plan.id, editingReferenceId, { name: newReference.name, justification: 'Edición desde configuración' });
      else await strategicPlanningService.upsertCatalog(plan.id, { catalog_type: catalogType, code: newReference.code, name: newReference.name });
      const wasEditing = Boolean(editingReferenceId); setNewReference({ code: '', name: '' }); setEditingReferenceId(null); await load(); enqueueSnackbar(wasEditing ? 'Referencia actualizada.' : 'Referencia agregada.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar la referencia.', { variant: 'error' }); }
  };
  const toggleReference = async (item) => {
    try { await strategicPlanningService.updateCatalog(plan.id, item.id, { active: !item.active, justification: item.active ? 'Desactivación desde configuración PEI' : 'Reactivación desde configuración PEI' }); await load(); enqueueSnackbar(item.active ? 'Referencia desactivada sin borrar el histórico.' : 'Referencia reactivada.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible actualizar la referencia.', { variant: 'error' }); }
  };
  const deleteReference = async (item) => {
    if (!window.confirm(`¿Eliminar la referencia "${item.name}"? Podrá reactivarla posteriormente.`)) return;
    try { await strategicPlanningService.deleteCatalog(plan.id, item.id); await load(); enqueueSnackbar('Referencia eliminada de forma lógica.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar la referencia.', { variant: 'error' }); }
  };

  if (loading) return <Stack alignItems="center" py={10} gap={2}><CircularProgress /><Typography>Cargando plataforma institucional…</Typography></Stack>;
  if (!plan) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Reintentar</Button>}>No se pudo inicializar el PED. Verifique la conexión con el backend y vuelva a intentar.</Alert>;

  return (
    <Stack spacing={2.5}>
      <Paper elevation={0} sx={{ p: { xs: 2.25, sm: 3, lg: pedWorkspaceOpen ? 3.5 : 3 }, borderRadius: { xs: 3, md: 4 }, color: 'white', background: 'linear-gradient(118deg,#173b8f 0%,#2563eb 58%,#6d3cf0 100%)', boxShadow: '0 18px 45px rgba(37,99,235,.16)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
          <Box>
            {onBack && <Button onClick={onBack} startIcon={<ArrowBack />} sx={{ mb: 1.5, color: 'white', border: '1px solid rgba(255,255,255,.45)', borderRadius: 3, textTransform: 'none', fontWeight: 800 }}>Volver a submódulos</Button>}

            <Typography sx={{ fontSize: { xs: 24, sm: 28, lg: 32 }, lineHeight: 1.15, fontWeight: 950, maxWidth: 1050 }}>Gestión, Seguimiento y Evaluación de la Planeación Estratégica Institucional</Typography>

          </Box>
        </Stack>
      </Paper>

      {pedWorkspaceOpen && <Paper elevation={0} sx={{ px: 2, py: 1.25, border: '1px solid #dbeafe', borderRadius: 3 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1}><Button startIcon={<ArrowBack />} onClick={() => { setPedWorkspaceOpen(false); setSpace('configuration'); setShowAdvancedConfig(false); }} sx={{ textTransform: 'none', fontWeight: 850 }}>Volver a todos los PED</Button><Stack direction="row" alignItems="center" gap={1}><Typography variant="body2" color="text.secondary">Etapa actual:</Typography><Chip color="primary" label={SPACES.find((item) => item.key === space)?.label || 'Configuración'} sx={{ fontWeight: 900 }} /></Stack></Stack></Paper>}

      {!pedWorkspaceOpen && <Stack spacing={{ xs: 2, md: 2.5 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'flex-end' }} gap={1}><Box><Typography variant="overline" color="primary" fontWeight={900} letterSpacing={1}>PRIMERA ETAPA</Typography><Typography sx={{ fontSize: { xs: 25, md: 30 }, lineHeight: 1.15, fontWeight: 950 }}>Planes Estratégicos de Desarrollo</Typography><Typography color="text.secondary" mt={0.5}>Cree un periodo nuevo o abra uno existente para continuar.</Typography></Box><Chip variant="outlined" color="primary" label={`${strategicPlans.length} PED disponibles`} sx={{ fontWeight: 850 }} /></Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px,.8fr) minmax(0,1.7fr)' }, gap: { xs: 2, md: 2.5 }, alignItems: 'stretch' }}>
          <Paper variant="outlined" sx={{ p: { xs: 2.25, md: 2.6 }, borderRadius: 3.5, borderColor: '#bfdbfe', bgcolor: '#fff', boxShadow: '0 12px 32px rgba(15,23,42,.06)', position: 'relative', overflow: 'hidden' }}><Box sx={{ position: 'absolute', inset: '0 auto 0 0', width: 5, bgcolor: '#2563eb' }} /><Stack height="100%" justifyContent="space-between" gap={2.5}><Box><Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.75}><Box sx={{ width: 46, height: 46, borderRadius: 2.5, bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}><Add sx={{ fontSize: 28 }} /></Box><Chip size="small" label="NUEVO" color="primary" variant="outlined" sx={{ fontWeight: 900 }} /></Stack><Typography variant="h5" fontWeight={950}>Crear un PED</Typography><Typography color="text.secondary" sx={{ mt: 0.75, lineHeight: 1.55 }}>Inicie un nuevo periodo institucional mediante una configuración guiada.</Typography><Stack spacing={0.75} mt={1.75}>{['Fecha y duración', 'Campos definidos por cada PED', 'Formulario y Excel dinámicos'].map((label) => <Stack key={label} direction="row" alignItems="center" gap={0.9}><CheckCircleOutline sx={{ color: '#2563eb', fontSize: 18 }} /><Typography variant="body2" fontWeight={750}>{label}</Typography></Stack>)}</Stack></Box><Button fullWidth variant="contained" startIcon={<Add />} onClick={() => { setEditingPlanId(null); setStrategicPlanForm(emptyStrategicPlanForm); setOpenStrategicPlan(true); }} sx={{ py: 1.15, borderRadius: 2.5, fontWeight: 950, textTransform: 'none' }}>Crear nuevo PED</Button></Stack></Paper>

          <Paper variant="outlined" sx={{ minWidth: 0, p: { xs: 2, md: 2.5 }, borderRadius: 3.5, borderColor: '#dfe7f3', bgcolor: '#fff', boxShadow: '0 12px 32px rgba(15,23,42,.045)' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={2}>
              <Box><Typography variant="h5" fontWeight={950}>PED existentes</Typography><Typography variant="body2" color="text.secondary" mt={0.35}>Abra un periodo para continuar o elimine únicamente los borradores que ya no necesita.</Typography></Box>
              <Chip size="small" variant="outlined" label={`${strategicPlans.length} registrados`} sx={{ fontWeight: 850 }} />
            </Stack>
            <Stack spacing={1.15} sx={{ maxHeight: { lg: 390 }, overflowY: { lg: 'auto' }, pr: { lg: 0.5 } }}>
              {strategicPlans.map((item) => {
                const selected = String(item.id) === String(selectedPlanId);
                const isDraft = item.status === 'draft';
                return <Paper key={item.id} elevation={0} sx={{ position: 'relative', overflow: 'hidden', p: { xs: 1.5, sm: 1.75 }, borderRadius: 2.75, border: '1px solid', borderColor: selected ? '#93c5fd' : '#e2e8f0', bgcolor: selected ? '#f8fbff' : '#fff', transition: 'all .2s ease', '&:hover': { borderColor: '#93c5fd', boxShadow: '0 8px 20px rgba(37,99,235,.07)', transform: 'translateY(-1px)' } }}>
                  <Box sx={{ position: 'absolute', inset: '0 auto 0 0', width: 4, bgcolor: isDraft ? '#94a3b8' : item.status === 'active' ? '#10b981' : '#2563eb' }} />
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '44px minmax(0,1fr) auto' }, alignItems: 'center', gap: { xs: 1.25, md: 1.5 }, pl: 0.5 }}>
                    <Box sx={{ display: { xs: 'none', md: 'grid' }, width: 42, height: 42, placeItems: 'center', borderRadius: 2.25, bgcolor: isDraft ? '#f1f5f9' : '#eff6ff', color: isDraft ? '#64748b' : '#2563eb' }}>{isDraft ? <EditOutlined fontSize="small" /> : <LockOutlined fontSize="small" />}</Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Stack direction="row" alignItems="center" gap={0.8} flexWrap="wrap"><Typography fontWeight={950} sx={{ lineHeight: 1.25 }}>{item.name}</Typography><Chip size="small" color={item.status === 'active' ? 'success' : 'default'} label={PLAN_STATUS_LABEL[item.status] || item.status} sx={{ height: 23, fontWeight: 850 }} /></Stack>
                      <Stack direction={{ xs: 'column', sm: 'row' }} gap={{ xs: 0.2, sm: 1 }} mt={0.55} color="text.secondary"><Typography variant="caption" fontWeight={750}>{item.code}</Typography><Typography variant="caption">{item.starts_on} → {item.ends_on}</Typography>{!isDraft && <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}><LockOutlined sx={{ fontSize: 13 }} />Protegido</Typography>}</Stack>
                    </Box>
                    <Stack direction={{ xs: 'column-reverse', sm: 'row' }} gap={0.8} sx={{ width: { xs: '100%', md: 'auto' } }}>
                      {isDraft && <Button color="error" variant="text" startIcon={<DeleteOutline />} onClick={() => setDeleteCandidate(item)} sx={{ minWidth: 105, textTransform: 'none', fontWeight: 850 }}>Eliminar</Button>}
                      <Button variant={selected ? 'contained' : 'outlined'} onClick={() => { setSelectedPlanId(item.id); setPedWorkspaceOpen(true); setSpace('configuration'); setShowAdvancedConfig(false); }} sx={{ width: { xs: '100%', sm: 'auto' }, minWidth: 125, borderRadius: 2.25, textTransform: 'none', fontWeight: 900 }}>Abrir PED</Button>
                    </Stack>
                  </Box>
                </Paper>;
              })}
            </Stack>
          </Paper>
        </Box>
      </Stack>}

      {pedWorkspaceOpen && space === 'planning' && <Box>
        <SectionHeader
          step="2"
          title="Diseño de columnas del PED"
          description="Estructura dinámica de este PED. Cada columna aquí definida se mostrará en el formulario individual y en la plantilla Excel masiva."
          action={
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.25}>
              <Button
                component="label"
                variant="contained"
                startIcon={<UploadFile />}
                sx={{ borderRadius: 2.25, fontWeight: 800, textTransform: 'none', px: 2.5 }}
              >
                Cargar columnas desde Excel
                <input
                  hidden
                  type="file"
                  accept=".xlsx"
                  onChange={(event) => {
                    previewFieldSchema(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </Button>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => {
                  setFieldForm({
                    id: null,
                    key: '',
                    label: '',
                    data_type: 'text',
                    required: false,
                    options_text: '',
                    formula: '',
                    catalog_type: '',
                    list_source: 'manual',
                    selected_level_id: '',
                    selected_element_ids: []
                  });
                  setOpenField(true);
                }}
                sx={{ borderRadius: 2.25, fontWeight: 800, textTransform: 'none' }}
              >
                Nuevo campo manual
              </Button>
            </Stack>
          }
        />

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', mt: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            justifyContent="space-between"
            alignItems={{ sm: 'center' }}
            gap={1}
            sx={{ px: { xs: 2, md: 2.5 }, py: 1.75, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}
          >
            <Box>
              <Typography variant="subtitle1" fontWeight={900} color="#0f172a">
                Columnas configuradas ({activeFieldDefinitions.length})
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {activeFieldDefinitions.length
                  ? 'Estas columnas componen la tabla de captura para todos los planes de acción de este PED.'
                  : 'Aún no hay columnas configuradas para este PED.'}
              </Typography>
            </Box>
            <Chip
              size="small"
              color={activeFieldDefinitions.length ? 'success' : 'warning'}
              label={activeFieldDefinitions.length ? `${activeFieldDefinitions.length} columnas listas` : 'Sin columnas'}
              sx={{ fontWeight: 800 }}
            />
          </Stack>

          {!activeFieldDefinitions.length ? (
            <Box sx={{ px: 3, py: 6, textAlign: 'center' }}>
              <Description color="primary" sx={{ fontSize: 52, opacity: 0.8, mb: 1 }} />
              <Typography variant="h6" fontWeight={900} color="#0f172a">
                Configure las columnas de su PED
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 520, mx: 'auto', mt: 0.5, mb: 2.5 }}>
                Suba su archivo Excel oficial y el sistema detectará automáticamente los encabezados para crear la tabla en segundos, o agregue los campos uno a uno de forma manual.
              </Typography>
              <Stack direction="row" spacing={1.5} justifyContent="center" flexWrap="wrap" gap={1}>
                <Button
                  component="label"
                  variant="contained"
                  startIcon={<UploadFile />}
                  sx={{ borderRadius: 2.25, fontWeight: 800, textTransform: 'none', px: 3 }}
                >
                  Seleccionar archivo Excel (.xlsx)
                  <input
                    hidden
                    type="file"
                    accept=".xlsx"
                    onChange={(event) => {
                      previewFieldSchema(event.target.files?.[0]);
                      event.target.value = '';
                    }}
                  />
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<Add />}
                  onClick={() => {
                    setFieldForm({
                      id: null,
                      key: '',
                      label: '',
                      data_type: 'text',
                      required: false,
                      options_text: '',
                      formula: '',
                      catalog_type: '',
                      list_source: 'manual',
                      selected_level_id: '',
                      selected_element_ids: []
                    });
                    setOpenField(true);
                  }}
                  sx={{ borderRadius: 2.25, fontWeight: 800, textTransform: 'none' }}
                >
                  Crear campo manual
                </Button>
              </Stack>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 520 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800, width: 70 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Nombre visible / Identificador</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Tipo de información</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Opciones / Lista</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Obligatorio</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[...activeFieldDefinitions]
                    .sort((a, b) => a.position - b.position)
                    .map((field) => {
                      const isChoice = ['list', 'catalog', 'catalog_multi'].includes(field.data_type);
                      const catalogType = field.validation_rules?.catalog_type;
                      const choices = catalogType
                        ? (plan.catalogItems || []).filter((item) => item.catalog_type === catalogType && item.active)
                        : (field.options || []);

                      return (
                        <TableRow key={field.id} hover>
                          <TableCell sx={{ fontWeight: 800, color: 'text.secondary' }}>{field.position}</TableCell>
                          <TableCell>
                            <Typography fontWeight={800} fontSize={14}>{field.label}</Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                              {field.key}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              variant="outlined"
                              label={FIELD_TYPE_LABEL[field.data_type] || field.data_type}
                              sx={{ fontWeight: 600, fontSize: 12 }}
                            />
                          </TableCell>
                          <TableCell>
                            {isChoice ? (
                              <Stack direction="row" spacing={0.75} alignItems="center">
                                <Chip
                                  size="small"
                                  color={choices.length ? 'default' : 'warning'}
                                  label={`${choices.length} opciones`}
                                  sx={{ fontSize: 11 }}
                                />
                                {catalogType ? (
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => {
                                      setManagedListFieldId(field.id);
                                      setCatalogType(catalogType);
                                      setEditingReferenceId(null);
                                      setNewReference({ code: '', name: '' });
                                    }}
                                    sx={{ textTransform: 'none', fontSize: 12, p: 0.5, fontWeight: 700 }}
                                  >
                                    Ver opciones
                                  </Button>
                                ) : (
                                  <Button
                                    size="small"
                                    variant="text"
                                    onClick={() => openFieldEditor(field)}
                                    sx={{ textTransform: 'none', fontSize: 12, p: 0.5, fontWeight: 700 }}
                                  >
                                    Editar opciones
                                  </Button>
                                )}
                              </Stack>
                            ) : (
                              <Typography variant="caption" color="text.secondary">Estándar</Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={field.required ? 'Obligatorio' : 'Opcional'}
                              color={field.required ? 'primary' : 'default'}
                              variant={field.required ? 'filled' : 'outlined'}
                              sx={{ fontSize: 11, fontWeight: 600 }}
                            />
                          </TableCell>
                          <TableCell align="right">
                            <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                              <Button size="small" onClick={() => openFieldEditor(field)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                                Editar
                              </Button>
                              <Button size="small" color="error" onClick={() => deleteField(field)} sx={{ textTransform: 'none', fontWeight: 700 }}>
                                Quitar
                              </Button>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>

        {managedListField && managedCatalogType && (
          <Paper variant="outlined" sx={{ mt: 2, p: 2.25, borderRadius: 3, borderColor: '#c4b5fd', bgcolor: '#fcfbff' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={2}>
              <Box>
                <Typography variant="h6" fontWeight={950}>Opciones de “{managedListField.label}”</Typography>
                <Typography variant="body2" color="text.secondary">
                  Todo registro activo aparecerá en el formulario individual y en las listas desplegables del Excel.
                </Typography>
              </Box>
              <Button size="small" onClick={() => setManagedListFieldId('')} sx={{ textTransform: 'none' }}>
                Cerrar panel de opciones
              </Button>
            </Stack>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(150px,.35fr) minmax(260px,1fr) auto' }, gap: 1.25 }}>
              <TextField size="small" disabled label="Código automático" value={newReference.code} />
              <TextField
                size="small"
                label="Nombre de la opción"
                value={newReference.name}
                onChange={(event) => {
                  const name = event.target.value;
                  const code = editingReferenceId
                    ? newReference.code
                    : name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
                  setNewReference({ code, name });
                }}
              />
              <Button
                variant="contained"
                startIcon={<Add />}
                disabled={!newReference.code.trim() || !newReference.name.trim()}
                onClick={saveReference}
                sx={{ textTransform: 'none', fontWeight: 800 }}
              >
                {editingReferenceId ? 'Guardar cambio' : 'Agregar opción'}
              </Button>
            </Box>
            <TableContainer sx={{ mt: 1.5, maxHeight: 280 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Código</TableCell>
                    <TableCell>Opción</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell align="right">Acciones</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {managedCatalogItems.sort((a,b) => a.name.localeCompare(b.name,'es')).map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>{item.code}</TableCell>
                      <TableCell><Typography fontWeight={800}>{item.name}</Typography></TableCell>
                      <TableCell><Chip size="small" color={item.active ? 'success' : 'default'} label={item.active ? 'Visible' : 'Oculta'} /></TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => { setEditingReferenceId(item.id); setNewReference({ code: item.code, name: item.name }); }}>Editar</Button>
                        <Button size="small" color={item.active ? 'warning' : 'success'} onClick={() => toggleReference(item)}>{item.active ? 'Ocultar' : 'Mostrar'}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        )}

        <StepNavigation onBack={() => setSpace('configuration')} onNext={activeFieldDefinitions.length ? () => setSpace('references') : null} nextLabel="Continuar a dependencias" />
      </Box>
      }

      {pedWorkspaceOpen && space === 'configuration' && <Box>
        {!showAdvancedConfig ? <Stack spacing={2.5}>
          <Box><Typography variant="overline" color="primary" fontWeight={900} letterSpacing={1}>CONFIGURACIÓN GUIADA</Typography><Typography variant="h4" fontWeight={950}>Prepare este PED paso a paso</Typography><Typography color="text.secondary" mt={0.5}>El sistema recuerda lo que ya configuró y le indica qué debe hacer ahora.</Typography></Box>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, borderColor: '#cbd5e1' }}><Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} gap={2}><Box sx={{ flex: 1, width: '100%' }}><Typography variant="caption" color="text.secondary" fontWeight={900}>PED CON EL QUE ESTÁ TRABAJANDO</Typography><TextField select fullWidth size="small" value={plan?.id || ''} onChange={(event) => setSelectedPlanId(event.target.value)} sx={{ mt: 0.75, maxWidth: 900 }}><MenuItem value="" disabled>Seleccione un PED</MenuItem>{strategicPlans.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name} · {PLAN_STATUS_LABEL[item.status] || item.status}</MenuItem>)}</TextField><Typography variant="body2" color="text.secondary" mt={0.75}>Todo el progreso mostrado abajo corresponde únicamente a <strong>{plan?.code}</strong>.</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button variant="outlined" startIcon={<EditOutlined />} onClick={editStrategicPlan}>Editar este PED</Button><Button variant="contained" startIcon={<Add />} onClick={() => { setEditingPlanId(null); setStrategicPlanForm(emptyStrategicPlanForm); setOpenStrategicPlan(true); }}>Crear nuevo PED</Button></Stack></Stack></Paper>

          <Paper variant="outlined" sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, borderColor: '#dbeafe', bgcolor: '#f8fbff' }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={1}><Typography fontWeight={900}>Progreso de configuración</Typography><Typography color="primary" fontWeight={950}>{completedSetupSteps} de {setupSteps.length} pasos completos</Typography></Stack>
            <LinearProgress variant="determinate" value={(completedSetupSteps / setupSteps.length) * 100} sx={{ height: 9, borderRadius: 10 }} />
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, bgcolor: setupReady ? '#f0fdf4' : '#eff6ff', border: `1px solid ${setupReady ? '#bbf7d0' : '#bfdbfe'}` }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}><Stack direction="row" gap={1.5} alignItems="flex-start"><Box sx={{ width: 42, height: 42, flex: '0 0 42px', borderRadius: '50%', bgcolor: setupReady ? '#16a34a' : '#2563eb', color: 'white', display: 'grid', placeItems: 'center', fontWeight: 950 }}>{setupReady ? <CheckCircleOutline /> : nextSetupStep.number}</Box><Box><Typography variant="caption" color={setupReady ? 'success.main' : 'primary'} fontWeight={900}>{setupReady ? 'CONFIGURACIÓN COMPLETA' : 'LO QUE DEBE HACER AHORA'}</Typography><Typography variant="h6" fontWeight={950}>{setupReady ? 'El PED está listo para operar' : nextSetupStep.title}</Typography><Typography color="text.secondary">{setupReady ? 'Puede abrir los Planes de Acción y continuar con su diligenciamiento.' : nextSetupStep.description}</Typography></Box></Stack><Button variant="contained" color={setupReady ? 'success' : 'primary'} onClick={nextSetupStep.action} sx={{ px: 3, py: 1.1, borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}>{setupReady ? 'Abrir Planes de Acción →' : 'Continuar con este paso →'}</Button></Stack></Paper>

          <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden', borderColor: '#dbe3ee', boxShadow: '0 8px 24px rgba(15,23,42,.035)' }}>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: 'minmax(0,1fr) 120px 168px', alignItems: 'center', px: 2.5, py: 1.15, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <Typography variant="caption" color="text.secondary" fontWeight={900} letterSpacing={0.7}>ETAPA DE CONFIGURACIÓN</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={900} letterSpacing={0.7} textAlign="center">ESTADO</Typography>
              <Typography variant="caption" color="text.secondary" fontWeight={900} letterSpacing={0.7} textAlign="center">ACCIÓN</Typography>
            </Box>
            {setupSteps.map((step, index) => {
              const isCurrent = !setupReady && nextSetupStep.number === step.number;
              return <Box key={step.number} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0,1fr) 120px 168px' }, alignItems: 'center', gap: { xs: 1.4, md: 0 }, px: { xs: 2, md: 2.5 }, py: { xs: 1.75, md: 1.6 }, minHeight: { md: 91 }, borderBottom: index < setupSteps.length - 1 ? '1px solid #e2e8f0' : 0, bgcolor: isCurrent ? '#f8fbff' : 'white', transition: 'background-color .2s', '&:hover': { bgcolor: '#fafcff' } }}>
                <Stack direction="row" gap={1.4} alignItems="center" sx={{ minWidth: 0 }}>
                  <Box sx={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 2.25, bgcolor: step.complete ? '#dcfce7' : isCurrent ? '#dbeafe' : '#f1f5f9', color: step.complete ? '#15803d' : isCurrent ? '#2563eb' : '#64748b', display: 'grid', placeItems: 'center', fontWeight: 950 }}>{step.complete ? <CheckCircleOutline fontSize="small" /> : step.number}</Box>
                  <Box sx={{ minWidth: 0 }}><Typography fontWeight={950} sx={{ lineHeight: 1.3 }}>{step.number}. {step.title}</Typography><Typography variant="body2" color="text.secondary" mt={0.25}>{step.description}</Typography></Box>
                </Stack>
                <Box sx={{ justifySelf: { xs: 'start', md: 'center' }, pl: { xs: 6.7, md: 0 } }}><Chip size="small" color={step.complete ? 'success' : isCurrent ? 'primary' : 'default'} variant={step.complete ? 'filled' : 'outlined'} label={step.complete ? 'Completo' : isCurrent ? 'Siguiente' : 'Pendiente'} sx={{ minWidth: 88, fontWeight: 850 }} /></Box>
                <Box sx={{ width: { xs: 'calc(100% - 54px)', md: 148 }, ml: { xs: 6.7, md: 'auto' }, justifySelf: { md: 'end' } }}><Button fullWidth size="small" variant={isCurrent || step.number === setupSteps.length ? 'contained' : 'outlined'} onClick={step.action} sx={{ minHeight: 38, borderRadius: 2.15, textTransform: 'none', fontWeight: 900, whiteSpace: 'nowrap' }}>{step.actionLabel}</Button></Box>
              </Box>;
            })}
          </Paper>

        </Stack> : <>
        <Button startIcon={<ArrowBack />} onClick={() => setShowAdvancedConfig(false)} sx={{ mb: 2, textTransform: 'none', fontWeight: 850 }}>Volver a la configuración guiada</Button>
        <SectionHeader step="1" title="Seleccione el PED con el que va a trabajar" description="Si el PED que aparece abajo es correcto, no debe configurar nada más aquí: pulse el botón Continuar." />
        <SubstepHeader number={1} title="PED seleccionado" description="Puede cambiarlo en la lista o crear uno nuevo solamente cuando comience otro periodo institucional." action={<Button variant="outlined" startIcon={<Add />} onClick={() => { setEditingPlanId(null); setStrategicPlanForm(emptyStrategicPlanForm); setOpenStrategicPlan(true); }}>Crear otro PED</Button>} />
        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2, borderRadius: 3, borderColor: '#dbe3f0', boxShadow: '0 6px 18px rgba(15,23,42,.035)', overflow: 'hidden' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
            <TextField select fullWidth label="Seleccione el PED que desea consultar" value={plan?.id || ''} onChange={(event) => setSelectedPlanId(event.target.value)} sx={{ maxWidth: 880 }}>
              {strategicPlans.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name} · {PLAN_STATUS_LABEL[item.status] || item.status}</MenuItem>)}
            </TextField>
            <Chip size="small" color={plan.status === 'active' ? 'success' : 'default'} label={PLAN_STATUS_LABEL[plan.status] || plan.status} sx={{ px: 0.5, fontWeight: 800 }} />
          </Stack>

          <Box sx={{ mt: 1.75, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(280px,1.7fr) repeat(3,minmax(125px,.55fr))' }, gap: 1, alignItems: 'stretch' }}>
            <Box sx={{ px: 1.75, py: 1.4, borderRadius: 2.5, color: '#1e3a8a', background: 'linear-gradient(135deg,#eff6ff,#f5f3ff)', border: '1px solid #dbeafe' }}>
              <Typography variant="caption" sx={{ color: '#2563eb', fontWeight: 900, letterSpacing: .7 }}>PED SELECCIONADO</Typography>
              <Typography fontWeight={900} lineHeight={1.25} mt={0.35}>{plan.name}</Typography>
              <Typography variant="caption" color="text.secondary">{plan.code}</Typography>
            </Box>
            {[
              ['Inicio', plan.starts_on, <CalendarTodayOutlined fontSize="small" />],
              ['Finaliza', plan.ends_on, <CalendarTodayOutlined fontSize="small" />],
              ['Vigencias', actionTerms.length, <Timeline fontSize="small" />]
            ].map(([label, value, icon]) => <Box key={label} sx={{ px: 1.5, py: 1.25, borderRadius: 2.5, bgcolor: '#fafcff', border: '1px solid #e5eaf2', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><Stack direction="row" alignItems="center" gap={0.6} color="#5b75a5">{icon}<Typography variant="caption" fontWeight={800} textTransform="uppercase">{label}</Typography></Stack><Typography mt={0.35} fontWeight={900} fontSize={16}>{value}</Typography></Box>)}
          </Box>

          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mt={1.5} pt={1.25} sx={{ borderTop: '1px solid #edf0f5' }}><Stack direction="row" alignItems="center" gap={0.75} color="text.secondary"><LockOutlined sx={{ fontSize: 18 }} /><Typography variant="caption">Historial institucional protegido · Versión {plan.configuration_version}</Typography></Stack><Button size="small" variant="text" startIcon={<EditOutlined />} onClick={editStrategicPlan} sx={{ textTransform: 'none', fontWeight: 850 }}>Editar información</Button></Stack>
        </Paper>
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderRadius: 3, color: 'white', background: 'linear-gradient(110deg,#1d4ed8,#4f46e5)' }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}><Box><Typography fontWeight={950} fontSize={20}>¿Este es el PED correcto?</Typography><Typography sx={{ opacity: .9 }}>El siguiente paso es definir las columnas que tendrá su tabla, sin nombres obligatorios.</Typography></Box><Button variant="contained" onClick={() => setSpace('planning')} sx={{ bgcolor: 'white', color: '#1d4ed8', px: 3, py: 1.25, borderRadius: 2.5, fontWeight: 950, textTransform: 'none', '&:hover': { bgcolor: '#eff6ff' } }}>Continuar a definir los campos →</Button></Stack></Paper>

        <Box sx={{ mb: 1.5 }}><Typography variant="overline" color="text.secondary" fontWeight={900} letterSpacing={1}>CONFIGURACIÓN OPCIONAL</Typography><Typography variant="body2" color="text.secondary">Puede revisar estas opciones ahora o regresar después. No impiden continuar.</Typography></Box>
        <SubstepHeader number="A" title="Dependencias y responsables" description="Opcional: utilice este Excel solamente cuando necesite actualizar las listas institucionales." />
        <Paper variant="outlined" sx={{ px: 2, py: 1.5, mb: 1.5, borderRadius: 3, borderColor: institutionalListsReady ? '#bbf7d0' : '#fde68a', bgcolor: institutionalListsReady ? '#f0fdf4' : '#fffbeb' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}>
            <Stack direction="row" alignItems="center" gap={1.25}>
              <CheckCircleOutline sx={{ color: institutionalListsReady ? '#16a34a' : '#d97706' }} />
              <Box><Typography fontWeight={900}>{institutionalListsReady ? 'Listas disponibles para usar' : 'Falta completar las listas'}</Typography><Typography variant="body2" color="text.secondary">{institutionalListsReady ? `${units.length} dependencias registradas y ${leaders.length} usuarios activos de SIAC. Puede continuar o actualizar estos datos con Excel.` : 'Descargue la plantilla, complétela y vuelva a subirla antes de crear Planes de Acción.'}</Typography></Box>
            </Stack>
            {institutionalListsReady && <Chip size="small" color="success" label="Completado" sx={{ fontWeight: 900 }} />}
          </Stack>
        </Paper>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 1, mb: 1.5 }}>
          {[
            ['1', 'Descargue las listas', 'Incluye dependencias y una hoja con usuarios activos de SIAC.'],
            ['2', 'Edítela en Excel', 'Cambie nombres, agregue filas y no renombre las hojas.'],
            ['3', 'Súbala y confirme', 'Primero verá una vista previa; nada cambia sin confirmar.']
          ].map(([number, title, text]) => <Box key={number} sx={{ px: 1.5, py: 1.25, borderRadius: 2.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}><Stack direction="row" gap={1}><Chip size="small" color="primary" label={number} sx={{ fontWeight: 900 }} /><Box><Typography variant="body2" fontWeight={900}>{title}</Typography><Typography variant="caption" color="text.secondary">{text}</Typography></Box></Stack></Box>)}
        </Box>
        <Typography variant="caption" color="text.secondary" fontWeight={800}>PLANTILLA DE LISTAS OPERATIVAS</Typography>
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={1.5} mt={0.5} mb={2}>
          <Button variant="outlined" startIcon={<Download />} onClick={downloadReferenceTemplate}>Descargar dependencias y responsables</Button>
          <Button component="label" variant="contained" startIcon={<UploadFile />}>{institutionalListsReady ? 'Actualizar estas listas' : 'Subir listas completadas'}<input hidden type="file" accept=".xlsx" onChange={(e) => { previewReferences(e.target.files?.[0]); e.target.value = ''; }} /></Button>
        </Stack>
        {referencePreview && <Alert severity={referencePreview.summary?.unmatched_leaders ? 'warning' : 'success'} sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={confirmReferences}>Confirmar actualización</Button>}>Vista previa: {referencePreview.summary?.dependencies} dependencias; {referencePreview.summary?.matched_leaders} responsables vinculados; {referencePreview.summary?.unmatched_leaders} pendientes. Los datos todavía no se han modificado.</Alert>}
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: '#f5f3ff', borderColor: '#c4b5fd' }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}><Box><Typography fontWeight={950} color="#4c1d95">¿Busca la plantilla de respuestas creada con sus campos?</Typography><Typography variant="body2" color="text.secondary">Primero defina los campos. Después cree un Plan de Acción y ábralo; allí podrá descargar o subir la plantilla dinámica.</Typography></Box><Button variant="contained" onClick={() => setSpace('planning')}>Ir a definir campos</Button></Stack></Paper>
        <SubstepHeader number="B" title="Vigencias creadas automáticamente" description="Opcional: los años y los informes S1–S2 ya fueron creados; modifíquelos solo si existe una excepción." />
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ p: 2 }}><Typography variant="h6" fontWeight={900}>Vigencias e informes S1–S2</Typography><Button variant="outlined" startIcon={<Add />} onClick={() => { setTermForm({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned' }); setOpenTerm(true); }}>Agregar año excepcional</Button></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Año</TableCell><TableCell>Estado</TableCell><TableCell>Informes</TableCell><TableCell>Conservación</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{[...terms].filter((term) => term.status !== 'inactive').sort((a,b) => a.year-b.year).map((term) => {
          const isOutside = !isTermInPlanRange(term) || term.status === 'archived';
          return (
            <TableRow key={term.id}>
              <TableCell>
                <Stack direction="row" alignItems="center" gap={1}>
                  <Typography fontWeight={isOutside ? 600 : 900}>{term.year}</Typography>
                  {isOutside && <Chip size="small" variant="outlined" color="warning" label="Fuera de rango" sx={{ height: 20, fontSize: 10 }} />}
                </Stack>
              </TableCell>
              <TableCell><Chip size="small" color={term.status === 'active' ? 'success' : term.status === 'archived' ? 'warning' : 'default'} label={TERM_STATUS_LABEL[term.status] || term.status} /></TableCell>
              <TableCell>{term.monitoringPeriods?.map((p) => p.code).join(' y ') || '—'}</TableCell>
              <TableCell>{term.status === 'archived' ? 'Historial protegido (archivado)' : 'Historial permanente'}</TableCell>
              <TableCell><Button size="small" onClick={() => { setTermForm({ id: term.id, year: term.year, starts_on: term.starts_on, ends_on: term.ends_on, status: term.status, formulation_starts_on: term.metadata?.formulation_starts_on || `${term.year}-01-01`, formulation_ends_on: term.metadata?.formulation_ends_on || `${term.year}-03-31`, propagate_to_plans: false }); setOpenTerm(true); }}>Editar</Button></TableCell>
            </TableRow>
          );
        })}</TableBody></Table></TableContainer></Paper>

        <Paper variant="outlined" sx={{ mt: 2, p: 2.5, borderRadius: 3 }}><Typography variant="h6" fontWeight={900} mb={0.5}>Administración manual de listas</Typography><Typography variant="body2" color="text.secondary" mb={2}>Opcional: úsela solamente para corregir o agregar un registro específico.</Typography><Grid container spacing={1.5} alignItems="center"><Grid item xs={12} md={4}><TextField fullWidth select label="Tabla de referencia" value={catalogType} onChange={(e) => { if (e.target.value === '__create_catalog__') setOpenCatalog(true); else { setCatalogType(e.target.value); setEditingReferenceId(null); setNewReference({ code: '', name: '' }); } }}>{catalogOptions.map(([value,label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}<MenuItem value="__create_catalog__" sx={{ color: 'primary.main', fontWeight: 900, borderTop: '1px solid', borderColor: 'divider' }}><Add fontSize="small" sx={{ mr: 1 }} />Otra / Crear nueva tabla</MenuItem></TextField></Grid><Grid item xs={12} md={2}><TextField fullWidth disabled={Boolean(editingReferenceId)} label="Código del registro" value={newReference.code} onChange={(e) => setNewReference({ ...newReference, code: e.target.value })} /></Grid><Grid item xs={12} md={4}><TextField fullWidth label="Nombre del registro" value={newReference.name} onChange={(e) => setNewReference({ ...newReference, name: e.target.value })} /></Grid><Grid item xs={12} md={2}><Button fullWidth variant="contained" startIcon={<Add />} disabled={!newReference.code.trim() || !newReference.name.trim()} onClick={saveReference}>{editingReferenceId ? 'Actualizar' : 'Agregar registro'}</Button></Grid></Grid>
          {customCatalogs.find((item) => item.code === catalogType) && <Alert severity="info" sx={{ mt: 2 }}>Tabla personalizada: <strong>{customCatalogs.find((item) => item.code === catalogType)?.name}</strong>. Se usará en: <strong>{{ action_plans: 'Planes de Acción', activities: 'Actividades', meetings: 'Reuniones y actas', monitoring: 'Seguimiento', budget: 'Presupuesto', analytics: 'Analítica', general: 'Uso general' }[customCatalogs.find((item) => item.code === catalogType)?.scope] || 'Uso general'}</strong>.</Alert>}
          <TableContainer sx={{ mt: 2, maxHeight: 330 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Referencia</TableCell><TableCell>Estado</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{(plan.catalogItems || []).filter((item) => item.catalog_type === catalogType).sort((a,b) => a.name.localeCompare(b.name,'es')).map((item) => <TableRow key={item.id}><TableCell>{item.code}</TableCell><TableCell>{item.name}</TableCell><TableCell><Chip size="small" color={item.active ? 'success' : 'default'} label={item.active ? 'Activa' : 'Inactiva'} /></TableCell><TableCell><Stack direction="row" gap={0.5}><Button size="small" onClick={() => { setEditingReferenceId(item.id); setNewReference({ code: item.code, name: item.name }); }}>Editar</Button><Button size="small" color={item.active ? 'warning' : 'success'} onClick={() => toggleReference(item)}>{item.active ? 'Desactivar' : 'Reactivar'}</Button><Button size="small" color="error" disabled={!item.active} onClick={() => deleteReference(item)}>Eliminar</Button></Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>
        </Paper>
        <StepNavigation onNext={() => setSpace('planning')} nextLabel="Continuar a definir los campos" />
        </>}
      </Box>}

      {pedWorkspaceOpen && space === 'references' && <Box>
        <SectionHeader step="3" title="Configure las dependencias de cada año" description="Cada vigencia puede tener una cantidad diferente de dependencias y responsables." />

        <Paper variant="outlined" sx={{ p: { xs: 1.5, md: 2 }, mb: 2, borderRadius: 3.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={1.5}><Box><Typography variant="h6" fontWeight={950}>1. Elija la vigencia</Typography><Typography variant="body2" color="text.secondary">Los cambios se aplicarán solamente al año seleccionado.</Typography></Box><Chip variant="outlined" color="primary" label={`${configuredTermIds.size} de ${actionTerms.length} configuradas`} /></Stack>
          <Box sx={{ display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5 }}>
            {actionTerms.map((term) => {
              const count = termDependencies.filter((item) => String(item.term_id) === String(term.id)).length;
              const selected = String(selectedReferenceTerm?.id) === String(term.id);
              return <Button key={term.id} variant={selected ? 'contained' : 'outlined'} onClick={() => { setSelectedReferenceTermId(term.id); setTermDependencyPreview(null); setTermDependencyForm({ dependency: '', document: '' }); }} sx={{ minWidth: 142, py: 1.15, borderRadius: 2.5, textTransform: 'none', fontWeight: 900 }}><Stack><Typography fontWeight={950}>{term.year}</Typography><Typography variant="caption" sx={{ opacity: .85 }}>{count} {count === 1 ? 'dependencia' : 'dependencias'}</Typography></Stack></Button>;
            })}
          </Box>
        </Paper>

        {selectedReferenceTerm && <>
          <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 2, borderRadius: 3.5, border: '1px solid #bfdbfe', bgcolor: '#f8fbff' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} gap={2.5} alignItems={{ lg: 'flex-start' }}>
              <Box sx={{ flex: 1 }}><Typography variant="h6" fontWeight={950}>2. Agregue una dependencia a {selectedReferenceTerm.year}</Typography><Typography variant="body2" color="text.secondary" mb={2}>Digite la cédula y SIAC completará los datos del responsable.</Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(240px,1fr) minmax(210px,.65fr) auto' }, gap: 1.25, alignItems: 'start' }}>
                  <TextField size="small" label="Nombre de la dependencia" placeholder="Ejemplo: Rectoría" value={termDependencyForm.dependency} onChange={(event) => setTermDependencyForm({ ...termDependencyForm, dependency: event.target.value })} />
                  <TextField size="small" label="Cédula del responsable" inputProps={{ inputMode: 'numeric' }} value={termDependencyForm.document} onChange={(event) => setTermDependencyForm({ ...termDependencyForm, document: event.target.value.replace(/\D/g, '') })} helperText={annualLeaderDocument && !selectedAnnualLeader ? 'No encontrada en usuarios activos' : 'Consulta automática en SIAC'} error={Boolean(annualLeaderDocument && !selectedAnnualLeader)} />
                  <Button variant="contained" startIcon={<Add />} disabled={saving || !selectedAnnualLeader || !termDependencyForm.dependency.trim()} onClick={addAnnualDependency} sx={{ minHeight: 40, borderRadius: 2.25, textTransform: 'none', fontWeight: 900 }}>Agregar</Button>
                </Box>
                {selectedAnnualLeader && <Alert severity="success" sx={{ mt: 1.5 }}><strong>{selectedAnnualLeader.name}</strong> · {selectedAnnualLeader.position || 'Cargo no registrado'} · {selectedAnnualLeader.email || 'Correo no registrado'}<br /><Typography component="span" variant="caption">Unidad registrada en SIAC: {selectedAnnualLeader.dependency || 'Sin dato'}</Typography></Alert>}
              </Box>
              <Box sx={{ width: { xs: '100%', lg: 360 }, borderLeft: { lg: '1px solid #dbeafe' }, pl: { lg: 2.5 } }}><Typography fontWeight={950}>Carga masiva por Excel</Typography><Typography variant="body2" color="text.secondary" mb={1.5}>La plantilla solo pide dependencia y cédula. Al confirmar reemplaza la lista de {selectedReferenceTerm.year}, sin cambiar otros años.</Typography><Stack direction={{ xs: 'column', sm: 'row', lg: 'column' }} gap={1}><Button variant="outlined" startIcon={<Download />} onClick={downloadAnnualDependencies}>Descargar Excel de {selectedReferenceTerm.year}</Button><Button component="label" variant="contained" startIcon={<UploadFile />}>Subir y revisar Excel<input hidden type="file" accept=".xlsx" onChange={(event) => { previewAnnualDependencies(event.target.files?.[0]); event.target.value = ''; }} /></Button></Stack></Box>
            </Stack>
          </Paper>

          {termDependencyPreview && <Paper variant="outlined" sx={{ mb: 2, borderRadius: 3.5, overflow: 'hidden', borderColor: termDependencyPreview.summary?.errors ? '#fecaca' : '#bbf7d0' }}><Box sx={{ p: 2, bgcolor: termDependencyPreview.summary?.errors ? '#fef2f2' : '#f0fdf4' }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1}><Box><Typography fontWeight={950}>3. Revise antes de confirmar</Typography><Typography variant="body2" color="text.secondary">{termDependencyPreview.summary?.matched} responsables encontrados · {termDependencyPreview.summary?.errors} errores</Typography></Box><Button variant="contained" color="success" disabled={saving || Boolean(termDependencyPreview.summary?.errors)} onClick={confirmAnnualDependencies}>Confirmar lista de {selectedReferenceTerm.year}</Button></Stack></Box><TableContainer sx={{ maxHeight: 330 }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell>Fila</TableCell><TableCell>Dependencia</TableCell><TableCell>Cédula</TableCell><TableCell>Responsable encontrado</TableCell><TableCell>Unidad en SIAC</TableCell><TableCell>Cargo</TableCell><TableCell>Correo</TableCell><TableCell>Validación</TableCell></TableRow></TableHead><TableBody>{(termDependencyPreview.parsed_data?.rows || []).map((row) => <TableRow key={row.row_number}><TableCell>{row.row_number}</TableCell><TableCell>{row.dependency}</TableCell><TableCell>{row.document}</TableCell><TableCell>{row.responsible?.nombre || '—'}</TableCell><TableCell>{row.responsible?.dependencia || '—'}</TableCell><TableCell>{row.responsible?.cargo || '—'}</TableCell><TableCell>{row.responsible?.email || '—'}</TableCell><TableCell><Chip size="small" color={row.errors?.length ? 'error' : 'success'} label={row.errors?.length ? row.errors.join(' ') : 'Correcto'} /></TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper>}

          <Paper variant="outlined" sx={{ borderRadius: 3.5, overflow: 'hidden' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ p: 2, borderBottom: '1px solid #e2e8f0' }}><Box><Typography variant="h6" fontWeight={950}>Dependencias de {selectedReferenceTerm.year}</Typography><Typography variant="body2" color="text.secondary">Estas son las únicas que aparecerán al crear Planes de Acción para este año.</Typography></Box><Chip color={selectedReferenceAssignments.length ? 'success' : 'warning'} label={`${selectedReferenceAssignments.length} configuradas`} sx={{ fontWeight: 900 }} /></Stack>
            {!selectedReferenceAssignments.length ? <Alert severity="info" sx={{ m: 2 }}>Todavía no hay dependencias en esta vigencia. Agréguelas arriba o cargue el Excel.</Alert> : <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Dependencia</TableCell><TableCell>Responsable</TableCell><TableCell>Cédula</TableCell><TableCell>Unidad en SIAC</TableCell><TableCell>Cargo</TableCell><TableCell>Correo</TableCell><TableCell align="right">Acción</TableCell></TableRow></TableHead><TableBody>{selectedReferenceAssignments.map((assignment) => <TableRow key={assignment.id} hover><TableCell><Typography fontWeight={850}>{assignment.dependency?.name}</Typography></TableCell><TableCell>{assignment.responsible?.name}</TableCell><TableCell>{assignment.responsible?.document}</TableCell><TableCell>{assignment.responsible?.dependency || '—'}</TableCell><TableCell>{assignment.responsible?.position || '—'}</TableCell><TableCell>{assignment.responsible?.email || '—'}</TableCell><TableCell align="right"><Button color="error" size="small" startIcon={<DeleteOutline />} onClick={() => removeAnnualDependency(assignment)}>Retirar</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
          </Paper>
        </>}
        <StepNavigation onBack={() => setSpace('configuration')} onNext={() => setSpace('actions')} nextLabel="Continuar a Planes de Acción" />
      </Box>}

      {pedWorkspaceOpen && space === 'actions' && <Box>
        <SectionHeader title="Planes de Acción por vigencia" />

        <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2.25 }, borderRadius: 3.5, borderColor: '#dbe3ee', bgcolor: '#fff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={2}><Typography variant="h6" fontWeight={950}>1. Seleccione el año de ejecución</Typography><Chip variant="outlined" color="primary" label={`${actionTerms.length} vigencias`} sx={{ fontWeight: 850 }} /></Stack>
          {!actionTerms.length ? <Alert severity="warning">Este PED no tiene años configurados.</Alert> : <Box sx={{ display: { xs: 'flex', md: 'grid' }, gridTemplateColumns: { md: 'repeat(auto-fit,minmax(175px,1fr))' }, gap: 1.25, overflowX: { xs: 'auto', md: 'visible' }, pb: { xs: 1, md: 0 } }}>
            {actionTerms.map((term) => {
              const yearDependencies = termDependencies.filter((item) => String(item.term_id) === String(term.id));
              const yearPlans = visiblePlans.filter((item) => String(item.term_id || item.term?.id) === String(term.id));
              const createdUnitIds = new Set(yearPlans.map((item) => String(item.catalog_item_id || item.organizationalUnit?.id || '')).filter(Boolean));
              const expectedUnitIds = new Set([
                ...yearDependencies.map((item) => String(item.catalog_item_id || item.dependency?.id || '')).filter(Boolean),
                ...createdUnitIds
              ]);
              const createdPlansCount = createdUnitIds.size;
              const expectedPlansCount = expectedUnitIds.size;
              const selected = String(term.id) === String(selectedActionTerm?.id);
              const percentage = expectedPlansCount ? Math.min(100, (createdPlansCount / expectedPlansCount) * 100) : 0;
              return <Paper key={term.id} component="button" type="button" onClick={() => { setSelectedActionTermId(term.id); setDependencySearch(''); setRepositoryResult(null); }} elevation={0} sx={{ appearance: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', minWidth: { xs: 190, md: 0 }, p: 1.6, borderRadius: 2.75, border: '1px solid', borderColor: selected ? '#2563eb' : '#dce3ed', bgcolor: selected ? '#eff6ff' : '#fff', boxShadow: selected ? '0 8px 20px rgba(37,99,235,.12)' : 'none', transition: 'all .2s', '&:hover': { borderColor: '#60a5fa', transform: 'translateY(-2px)' } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="caption" color={selected ? 'primary' : 'text.secondary'} fontWeight={900}>VIGENCIA</Typography><Typography sx={{ fontSize: 26, lineHeight: 1.1, fontWeight: 950 }}>{term.year}</Typography></Box><Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: selected ? '#2563eb' : '#f1f5f9', color: selected ? '#fff' : '#64748b', display: 'grid', placeItems: 'center' }}><CalendarTodayOutlined sx={{ fontSize: 17 }} /></Box></Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5} mb={0.7}><Typography variant="caption" fontWeight={850}>{createdPlansCount} de {expectedPlansCount} planes</Typography><Chip size="small" color={term.status === 'active' ? 'success' : 'default'} label={TERM_STATUS_LABEL[term.status] || term.status} sx={{ height: 21, fontSize: 11 }} /></Stack><LinearProgress variant="determinate" value={percentage} sx={{ height: 6, borderRadius: 10, bgcolor: '#e2e8f0' }} />
              </Paper>;
            })}
          </Box>}
        </Paper>

        {/* BARRA DE VIGENCIA Y PLAZO GENERAL DE FORMULACIÓN (ETAPA 1) */}
        {selectedActionTerm && (() => {
          const generalStartsOn = selectedActionTerm.metadata?.formulation_starts_on || `${selectedActionTerm.year}-01-01`;
          const generalEndsOn = selectedActionTerm.metadata?.formulation_ends_on || `${selectedActionTerm.year}-03-31`;
          const todayIso = new Date().toISOString().slice(0, 10);
          const isTermExpired = generalEndsOn && todayIso > generalEndsOn;
          const isTermNotStarted = generalStartsOn && todayIso < generalStartsOn;
          const isTermOpen = !isTermExpired && !isTermNotStarted;
          const daysLeft = generalEndsOn ? Math.ceil((new Date(generalEndsOn + 'T23:59:59') - new Date()) / (1000 * 60 * 60 * 24)) : null;

          return (
            <Paper
              variant="outlined"
              sx={{
                mt: 2,
                p: { xs: 1.75, md: 2.25 },
                borderRadius: 3.5,
                borderColor: isTermExpired ? '#fed7aa' : '#bbf7d0',
                bgcolor: isTermExpired ? '#fffbeb' : '#f0fdf4',
                boxShadow: '0 4px 15px rgba(0,0,0,.03)'
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }} gap={2}>
                <Stack direction="row" alignItems="center" gap={1.5}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      flex: '0 0 44px',
                      borderRadius: 2.5,
                      bgcolor: isTermExpired ? '#fef3c7' : '#dcfce7',
                      color: isTermExpired ? '#d97706' : '#16a34a',
                      display: 'grid',
                      placeItems: 'center'
                    }}
                  >
                    {isTermExpired ? <LockOutlined sx={{ fontSize: 20 }} /> : <AccessTimeOutlined sx={{ fontSize: 20 }} />}
                  </Box>
                  <Box>
                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                      <Typography fontWeight={950} sx={{ fontSize: 15, color: '#0f172a' }}>
                        Plazo General de Formulación · Vigencia {selectedActionTerm.year}
                      </Typography>
                      {isTermOpen && (
                        <Chip
                          size="small"
                          icon={<CheckCircleOutline sx={{ fontSize: '14px !important', color: '#15803d !important' }} />}
                          label={`Formulación Abierta · Vence ${generalEndsOn}${daysLeft !== null ? ` (${daysLeft} días restantes)` : ''}`}
                          sx={{ bgcolor: '#dcfce7', color: '#15803d', fontWeight: 800, fontSize: 11, pl: 0.5 }}
                        />
                      )}
                      {isTermExpired && (
                        <Chip
                          size="small"
                          icon={<LockOutlined sx={{ fontSize: '13px !important', color: '#b45309 !important' }} />}
                          label={`Plazo Vencido (${generalEndsOn})`}
                          sx={{ bgcolor: '#fef3c7', color: '#b45309', fontWeight: 800, fontSize: 11, pl: 0.5 }}
                        />
                      )}
                      {isTermNotStarted && (
                        <Chip
                          size="small"
                          icon={<AccessTimeOutlined sx={{ fontSize: '13px !important', color: '#475569 !important' }} />}
                          label={`Inicia el ${generalStartsOn}`}
                          sx={{ bgcolor: '#f1f5f9', color: '#475569', fontWeight: 800, fontSize: 11, pl: 0.5 }}
                        />
                      )}
                    </Stack>
                    <Typography variant="body2" color="#64748b" sx={{ mt: 0.2, fontSize: 12.5 }}>
                      Periodo oficial: <strong>{generalStartsOn}</strong> al <strong>{generalEndsOn}</strong>
                    </Typography>
                  </Box>
                </Stack>

                <Button
                  variant="contained"
                  startIcon={<MoreTime />}
                  onClick={() => openGeneralTimelineModal(selectedActionTerm)}
                  sx={{
                    height: 42,
                    borderRadius: 2.25,
                    textTransform: 'none',
                    fontWeight: 900,
                    px: 2.5,
                    bgcolor: '#1e40af',
                    '&:hover': { bgcolor: '#1d4ed8' },
                    flexShrink: 0
                  }}
                >
                  Programar / Ajustar Plazo General
                </Button>
              </Stack>
            </Paper>
          );
        })()}

        {selectedActionTerm && <Paper variant="outlined" sx={{ mt: 2, p: { xs: 1.75, md: 2.25 }, borderRadius: 3.5, borderColor: '#bfdbfe', background: 'linear-gradient(110deg,#f8fbff 0%,#eff6ff 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
            <Stack direction="row" alignItems="flex-start" gap={1.5}>
              <Box sx={{ width: 40, height: 40, flex: '0 0 40px', borderRadius: 2, bgcolor: '#eff6ff', color: '#2563eb', display: 'grid', placeItems: 'center' }}><FolderOutlined sx={{ fontSize: 22 }} /></Box>
              <Box>
                <Typography fontWeight={900} fontSize={15}>Repositorio Digital {selectedActionTerm.year}</Typography>
                <Typography variant="caption" color="text.secondary">Expediente en Google Drive</Typography>
              </Box>
            </Stack>
            <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="center" flexWrap="wrap">
              <Button
                variant="outlined"
                color="primary"
                disabled={bulkActionLoading || selectedActionTerm.status === 'closed'}
                onClick={handleBulkCreateActionPlans}
                sx={{ height: 44, borderRadius: 2.25, textTransform: 'none', fontWeight: 900 }}
              >
                {bulkActionLoading ? 'Generando…' : 'Generar todos los planes'}
              </Button>
              {selectedYearPlans.length > 0 && (
                <Button
                  variant="outlined"
                  color="error"
                  disabled={bulkActionLoading || selectedActionTerm.status === 'closed'}
                  onClick={() => { setBulkDeleteCandidate(selectedActionTerm); setBulkDeleteConfirmText(''); }}
                  sx={{ height: 44, borderRadius: 2.25, textTransform: 'none', fontWeight: 900 }}
                >
                  Limpiar vigencia ({selectedYearPlans.length})
                </Button>
              )}
              <Button variant="contained" startIcon={repositorySyncing ? <CircularProgress size={18} color="inherit" /> : <CloudSync />} disabled={repositorySyncing || !selectedActionUnits.length} onClick={syncActionRepository} sx={{ minWidth: 200, height: 44, borderRadius: 2.25, textTransform: 'none', fontWeight: 900 }}>
                {repositorySyncing ? 'Sincronizando…' : 'Sincronizar con Drive'}
              </Button>
            </Stack>
          </Stack>
          {!selectedActionUnits.length && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Configure por lo menos una dependencia para esta vigencia.</Typography>}
          {repositoryResult && <Alert severity={repositoryResult.files_deferred ? 'warning' : 'success'} sx={{ mt: 1.75, borderRadius: 2.25 }} action={<Button color="inherit" size="small" href={repositoryResult.folder_url} target="_blank" rel="noreferrer" sx={{ fontWeight: 900 }}>Abrir Drive</Button>}>
            <strong>{repositoryResult.files_deferred ? 'Estructura de carpetas preparada:' : 'Sincronización completa:'}</strong> {repositoryResult.ped_folder_name ? `${repositoryResult.ped_folder_name} → ` : ''}Planes de Acción {repositoryResult.year}. {repositoryResult.dependencies ?? repositoryResult.plans} dependencias preparadas ({repositoryResult.plans} con plan y {repositoryResult.pending_plans ?? 0} pendientes), {repositoryResult.activities} actividades y {repositoryResult.folders_created} carpetas nuevas.{repositoryResult.files_deferred ? ' Los Excel, actas y evidencias se incorporarán cuando Planeación autorice OAuth.' : ` ${repositoryResult.evidence} evidencias y ${repositoryResult.minutes} actas; ${repositoryResult.files_created} archivos creados.`}
          </Alert>}
        </Paper>}

        {selectedActionTerm && <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3.5, overflow: 'hidden', borderColor: '#dbe3ee' }}>
          <Box sx={{ px: { xs: 1.75, md: 2.5 }, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} gap={1.5}>
              <Box>
                <Typography variant="h6" fontWeight={950}>2. Dependencias ({visibleActionUnits.length})</Typography>

              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={1} sx={{ width: { xs: '100%', lg: 'auto' } }}>
                <TextField
                  size="small"
                  value={dependencySearch}
                  onChange={(event) => setDependencySearch(event.target.value)}
                  placeholder="Buscar por dependencia, cédula, nombre, cargo, correo o estado…"
                  InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" sx={{ color: '#64748b' }} /></InputAdornment> }}
                  sx={{ width: { xs: '100%', sm: 470 }, bgcolor: '#fff', '& .MuiOutlinedInput-root': { borderRadius: 2.25 } }}
                />
                <Paper variant="outlined" sx={{ display: 'flex', p: 0.4, borderRadius: 2.25, bgcolor: '#eef3f8', borderColor: '#d6e0ea', flexShrink: 0 }}>
                  <Button size="small" startIcon={<GridView />} onClick={() => setDependencyView('cards')} variant={dependencyView === 'cards' ? 'contained' : 'text'} sx={{ minWidth: 105, borderRadius: 1.75, textTransform: 'none', fontWeight: 850, boxShadow: dependencyView === 'cards' ? '0 3px 9px rgba(37,99,235,.18)' : 'none' }}>Tarjetas</Button>
                  <Button size="small" startIcon={<TableRows />} onClick={() => setDependencyView('table')} variant={dependencyView === 'table' ? 'contained' : 'text'} sx={{ minWidth: 95, borderRadius: 1.75, textTransform: 'none', fontWeight: 850, boxShadow: dependencyView === 'table' ? '0 3px 9px rgba(37,99,235,.18)' : 'none' }}>Tabla</Button>
                </Paper>
              </Stack>
            </Stack>
          </Box>
          {dependencyView === 'cards' ? <Box sx={{ p: { xs: 1.5, md: 2 }, display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', xl: 'repeat(3,minmax(0,1fr))' }, gap: 1.25, maxHeight: 650, overflowY: 'auto' }}>
            {visibleActionUnits.map((unit) => {
              const actionPlan = selectedYearPlans.find((item) => String(item.catalog_item_id || item.organizationalUnit?.id) === String(unit.id));
              const suggestedLeader = unit.annualAssignment?.responsible;
              return <Paper
                key={unit.id}
                elevation={0}
                onClick={() => {
                  if (actionPlan) {
                    setEditorPlanId(actionPlan.id);
                  } else if (selectedActionTerm.status !== 'closed') {
                    openActionPlanCreation(selectedActionTerm, unit);
                  }
                }}
                sx={{
                  p: 1.75,
                  borderRadius: 2.75,
                  border: '1.5px solid',
                  borderColor: actionPlan ? '#bbf7d0' : '#e2e8f0',
                  bgcolor: actionPlan ? '#f7fef9' : '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 188,
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    borderColor: actionPlan ? '#16a34a' : '#2563eb',
                    boxShadow: actionPlan ? '0 10px 24px -4px rgba(22, 163, 74, 0.18)' : '0 10px 24px -4px rgba(37, 99, 235, 0.16)',
                    transform: 'translateY(-2px)',
                    bgcolor: actionPlan ? '#f0fdf4' : '#f8fafc'
                  }
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                  <Box sx={{ width: 36, height: 36, flex: '0 0 36px', borderRadius: 2, bgcolor: actionPlan ? '#eff6ff' : '#f8fafc', color: actionPlan ? '#1e40af' : '#64748b', border: '1px solid', borderColor: actionPlan ? '#bfdbfe' : '#e2e8f0', display: 'grid', placeItems: 'center' }}>
                    <CorporateFare sx={{ fontSize: 20 }} />
                  </Box>
                  <Stack direction="row" alignItems="center" gap={0.3}>
                    {actionPlan && (
                      <>
                        <Tooltip title="Editar datos del plan">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setEditActionPlanCandidate({ id: actionPlan.id, code: actionPlan.code, title: actionPlan.title, responsible_user_id: actionPlan.responsible_user_id, unit_name: unit.name, year: selectedActionTerm.year }); }}
                            sx={{ width: 28, height: 28, color: '#64748b', '&:hover': { bgcolor: '#eff6ff', color: '#2563eb' } }}
                          >
                            <EditOutlined sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Eliminar plan y retirar dependencia">
                          <IconButton
                            size="small"
                            onClick={(e) => { e.stopPropagation(); setDeleteActionPlanCandidate(actionPlan); }}
                            sx={{ width: 28, height: 28, color: '#ef4444', '&:hover': { bgcolor: '#fef2f2', color: '#dc2626' } }}
                          >
                            <DeleteOutline sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}
                    <Chip size="small" color={actionPlan ? (ACTION_PLAN_STATUS_INFO[actionPlan.status]?.color || 'success') : 'default'} variant={actionPlan ? 'filled' : 'outlined'} label={actionPlan ? (ACTION_PLAN_STATUS_INFO[actionPlan.status]?.label || 'Plan creado') : 'Pendiente'} sx={{ fontWeight: 850 }} />
                  </Stack>
                </Stack>
                <Typography fontWeight={950} mt={1.2} lineHeight={1.3}>{unit.name}</Typography><Typography variant="caption" color="text.secondary">{unit.code}</Typography>
                <Box sx={{ flex: 1, mt: 1 }}>{actionPlan ? <><Typography variant="caption" color="text.secondary">{actionPlan.code} · {actionPlan.items?.length || 0} registros</Typography><Typography variant="caption" display="block" color="text.secondary" noWrap>{actionPlan.responsibleUser?.nombre || 'Sin líder asignado'}</Typography></> : <Typography variant="caption" color="text.secondary">{suggestedLeader ? `Responsable: ${suggestedLeader.name}` : 'Configure primero el responsable de esta vigencia.'}</Typography>}</Box>
                {actionPlan ? (
                  <Stack direction="row" gap={0.75} mt={1.25}>
                    <Button fullWidth size="small" variant="contained" onClick={(e) => { e.stopPropagation(); setEditorPlanId(actionPlan.id); }} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>Abrir plan</Button>
                    <Button size="small" variant="outlined" title="Cambiar responsable" onClick={(e) => { e.stopPropagation(); setTransfer({ plan: actionPlan, user_id: '', reason: '' }); }} sx={{ minWidth: 42, borderRadius: 2 }}><SwapHoriz fontSize="small" /></Button>
                  </Stack>
                ) : (
                  <Button fullWidth size="small" variant="outlined" startIcon={<Add />} disabled={selectedActionTerm.status === 'closed'} onClick={(e) => { e.stopPropagation(); openActionPlanCreation(selectedActionTerm, unit); }} sx={{ mt: 1.25, borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>{selectedActionTerm.status === 'closed' ? 'Vigencia cerrada' : 'Crear Plan de Acción'}</Button>
                )}
              </Paper>;
            })}
          </Box> : <Box sx={{ bgcolor: '#f6f9fd' }}>
            <Box sx={{ height: 4, background: 'linear-gradient(90deg,#204698,#2563eb 58%,#593cf0)' }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.25, py: 1.15, bgcolor: '#fff', borderBottom: '1px solid #dbe5f0' }}>
              <Typography variant="body2" color="#52657b"><strong>{visibleActionUnits.length}</strong> dependencias encontradas</Typography>
              <Typography variant="caption" color="#718096">Vigencia {selectedActionTerm.year}</Typography>
            </Stack>
            <TableContainer sx={{ maxHeight: 650 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1600, tableLayout: 'fixed', '& td, & th': { borderRight: '1px solid #e1e9f2' }, '& td:last-of-type, & th:last-of-type': { borderRight: 0 } }}>
              <TableHead>
                <TableRow>
                  {[
                    ['Dependencia', 250], ['Código', 95], ['Responsable', 235], ['Cédula', 135], ['Cargo', 220],
                    ['Correo', 245], ['Estado', 130], ['Registros', 90], ['Acción', 270]
                  ].map(([heading, width]) => <TableCell key={heading} align={['Registros', 'Acción'].includes(heading) ? 'center' : 'left'} sx={{ width, bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.055em', textTransform: 'uppercase', whiteSpace: 'nowrap', py: 1.45, borderBottom: '1px solid #173b73', borderRightColor: 'rgba(255,255,255,.16) !important' }}>{heading}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleActionUnits.map((unit) => {
                  const actionPlan = selectedYearPlans.find((item) => String(item.catalog_item_id || item.organizationalUnit?.id) === String(unit.id));
                  const responsible = unit.annualAssignment?.responsible || {};
                  const responsibleName = responsible.name || actionPlan?.responsibleUser?.nombre || 'Sin responsable';
                  const initials = responsibleName === 'Sin responsable' ? '—' : responsibleName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
                  return <TableRow
                    key={unit.id}
                    hover
                    onClick={() => {
                      if (actionPlan) {
                        setEditorPlanId(actionPlan.id);
                      } else if (selectedActionTerm.status !== 'closed') {
                        openActionPlanCreation(selectedActionTerm, unit);
                      }
                    }}
                    sx={{ cursor: 'pointer', bgcolor: '#ffffff', '&:nth-of-type(even)': { bgcolor: '#f9fbfe' }, '&:hover': { bgcolor: '#eef6ff !important' }, '& td': { py: 1.45, borderBottom: '1px solid #dfe7f0', verticalAlign: 'middle' } }}
                  >
                    <TableCell><Stack direction="row" alignItems="center" gap={1.15}><Box sx={{ width: 32, height: 32, flex: '0 0 32px', borderRadius: 1.75, display: 'grid', placeItems: 'center', bgcolor: actionPlan ? '#eff6ff' : '#f8fafc', color: actionPlan ? '#1e40af' : '#64748b', border: '1px solid', borderColor: actionPlan ? '#bfdbfe' : '#e2e8f0' }}><CorporateFare sx={{ fontSize: 18 }} /></Box><Box minWidth={0}><Typography fontWeight={900} fontSize={13.5} lineHeight={1.25} title={unit.name}>{unit.name}</Typography><Typography variant="caption" color="text.secondary" noWrap display="block" title={responsible.dependency || ''}>{responsible.dependency || 'Unidad institucional'}</Typography></Box></Stack></TableCell>
                    <TableCell><Chip size="small" label={unit.code || '—'} sx={{ height: 25, bgcolor: '#edf3fa', color: '#425b78', fontWeight: 900, borderRadius: 1.5 }} /></TableCell>
                    <TableCell><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 31, height: 31, flex: '0 0 31px', borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#e9edff', color: '#455db5', fontWeight: 950, fontSize: 10.5 }}>{initials}</Box><Typography fontWeight={850} fontSize={12.8} lineHeight={1.3}>{responsibleName}</Typography></Stack></TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 750, color: '#42566f' }}>{responsible.document || '—'}</TableCell>
                    <TableCell><Typography fontSize={12.8} lineHeight={1.35}>{responsible.position || actionPlan?.responsibleUser?.cargo || '—'}</Typography></TableCell>
                    <TableCell><Typography component={responsible.email || actionPlan?.responsibleUser?.email ? 'a' : 'span'} href={(responsible.email || actionPlan?.responsibleUser?.email) ? `mailto:${responsible.email || actionPlan?.responsibleUser?.email}` : undefined} onClick={(e) => e.stopPropagation()} fontSize={12.5} color="#315f9d" sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, wordBreak: 'break-word' }}>{responsible.email || actionPlan?.responsibleUser?.email || '—'}</Typography></TableCell>
                    <TableCell><Chip size="small" color={actionPlan ? (ACTION_PLAN_STATUS_INFO[actionPlan.status]?.color || 'success') : 'default'} variant={actionPlan ? 'filled' : 'outlined'} label={actionPlan ? (ACTION_PLAN_STATUS_INFO[actionPlan.status]?.label || 'Plan creado') : 'Pendiente'} sx={{ fontWeight: 850 }} /></TableCell>
                    <TableCell align="center"><Box sx={{ width: 32, height: 32, mx: 'auto', borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: actionPlan?.items?.length ? '#e8f2ff' : '#f1f5f9', color: actionPlan?.items?.length ? '#245ab5' : '#64748b', fontWeight: 950 }}>{actionPlan?.items?.length || 0}</Box></TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{actionPlan ? <Stack direction="row" justifyContent="center" alignItems="center" gap={0.5}><Button size="small" variant="contained" onClick={(e) => { e.stopPropagation(); setEditorPlanId(actionPlan.id); }} sx={{ minWidth: 85, height: 34, borderRadius: 1.75, textTransform: 'none', fontWeight: 900 }}>Abrir plan</Button>{['owner_validation', 'formulation', 'adjustments'].includes(actionPlan.status) && <Button size="small" variant="contained" color="success" onClick={async (e) => { e.stopPropagation(); try { await strategicPlanningService.transition(actionPlan.id, { action: 'activate', comment: 'Plan ejecutado directamente desde la plataforma institucional' }); enqueueSnackbar(`Plan ${actionPlan.code} pasado a Ejecución Oficial.`, { variant: 'success' }); await load(); } catch (err) { enqueueSnackbar(err?.response?.data?.message || 'No fue posible activar el plan.', { variant: 'error' }); } }} sx={{ height: 34, borderRadius: 1.75, textTransform: 'none', fontWeight: 900, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}>Ejecutar</Button>}<Button size="small" variant="outlined" title="Editar datos del plan" onClick={(e) => { e.stopPropagation(); setEditActionPlanCandidate({ id: actionPlan.id, code: actionPlan.code, title: actionPlan.title, responsible_user_id: actionPlan.responsible_user_id, unit_name: unit.name, year: selectedActionTerm.year }); }} sx={{ minWidth: 34, width: 34, height: 34, borderRadius: 1.75, p: 0 }}><EditOutlined fontSize="small" /></Button><Button size="small" variant="outlined" title="Cambiar responsable" onClick={(e) => { e.stopPropagation(); setTransfer({ plan: actionPlan, user_id: '', reason: '' }); }} sx={{ minWidth: 34, width: 34, height: 34, borderRadius: 1.75, p: 0 }}><SwapHoriz fontSize="small" /></Button><Button size="small" variant="outlined" color="error" title="Eliminar plan" onClick={(e) => { e.stopPropagation(); setDeleteActionPlanCandidate(actionPlan); }} sx={{ minWidth: 34, width: 34, height: 34, borderRadius: 1.75, p: 0, borderColor: '#fca5a5', color: '#dc2626', '&:hover': { bgcolor: '#fef2f2', borderColor: '#ef4444' } }}><DeleteOutline fontSize="small" /></Button></Stack> : <Button size="small" variant="outlined" startIcon={<Add />} disabled={selectedActionTerm.status === 'closed'} onClick={(e) => { e.stopPropagation(); openActionPlanCreation(selectedActionTerm, unit); }} sx={{ minWidth: 150, height: 34, borderRadius: 1.75, textTransform: 'none', fontWeight: 900 }}>{selectedActionTerm.status === 'closed' ? 'Vigencia cerrada' : 'Crear plan'}</Button>}</TableCell>
                  </TableRow>;
                })}
              </TableBody>
            </Table>
          </TableContainer></Box>}
          {!visibleActionUnits.length && <Box sx={{ p: 4, textAlign: 'center' }}><Typography fontWeight={900}>{selectedActionUnits.length ? 'No se encontraron dependencias' : `Aún no hay dependencias ni planes en ${selectedActionTerm.year}`}</Typography><Typography variant="body2" color="text.secondary">{selectedActionUnits.length ? 'Cambie el texto de búsqueda.' : 'Configure las dependencias que participarán en esta vigencia.'}</Typography>{!selectedActionUnits.length && <Button sx={{ mt: 1.5 }} variant="outlined" onClick={() => { setSelectedReferenceTermId(selectedActionTerm.id); setSpace('references'); }}>Configurar dependencias</Button>}</Box>}
        </Paper>}
        <StepNavigation onBack={() => setSpace('references')} onNext={() => setSpace('monitoring')} nextLabel="Continuar a informes" />
      </Box>}

      {pedWorkspaceOpen && space === 'monitoring' && <Box>
        <SectionHeader title="Seguimiento y Estado de los Planes de Acción" description="Tablero integral para la Dirección de Planeación y Aseguramiento de la Calidad. Controle el estado de cada plan, firmas, ajustes y avances semestrales." />
        {(() => {
          const totalCount = visiblePlans.length;
          const enFirmasCount = visiblePlans.filter((p) => p.status === 'owner_validation').length;
          const enAjustesCount = visiblePlans.filter((p) => p.status === 'adjustments').length;
          const enEjecucionCount = visiblePlans.filter((p) => ['active', 'monitoring'].includes(p.status)).length;
          const enFormulacionCount = visiblePlans.filter((p) => ['convocation', 'meeting_scheduled', 'formulation', 'technical_review'].includes(p.status)).length;

          return (
            <Stack spacing={2.5}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#ffffff' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">Total Planes</Typography>
                      <Typography variant="h4" fontWeight={950} color="#1e3a8a">{totalCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#f8fafc' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="text.secondary" fontWeight={800} textTransform="uppercase">En Formulación</Typography>
                      <Typography variant="h4" fontWeight={950} color="#475569">{enFormulacionCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#fffbeb', borderColor: '#fde68a' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="#b45309" fontWeight={800} textTransform="uppercase">En Firmas / Líder</Typography>
                      <Typography variant="h4" fontWeight={950} color="#b45309">{enFirmasCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: enAjustesCount > 0 ? '#fef2f2' : '#ffffff', borderColor: enAjustesCount > 0 ? '#fecaca' : '#e2e8f0' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color={enAjustesCount > 0 ? '#b91c1c' : 'text.secondary'} fontWeight={800} textTransform="uppercase">En Ajustes (Líder)</Typography>
                      <Typography variant="h4" fontWeight={950} color={enAjustesCount > 0 ? '#dc2626' : '#64748b'}>{enAjustesCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={2.4}>
                  <Card variant="outlined" sx={{ borderRadius: 3, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="caption" color="#15803d" fontWeight={800} textTransform="uppercase">En Ejecución Oficial</Typography>
                      <Typography variant="h4" fontWeight={950} color="#16a34a">{enEjecucionCount}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              {enAjustesCount > 0 && (
                <Alert severity="error" sx={{ borderRadius: 2.5 }}>
                  Hay <strong>{enAjustesCount}</strong> plan(es) devuelto(s) por el Líder de Dependencia solicitando ajustes. Revise las observaciones, ajuste las actividades y vuelva a enviarlo o ejecútelo.
                </Alert>
              )}

              {!visiblePlans.length ? (
                <Alert severity="warning">Todavía no hay Planes de Acción para este PED.</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3 }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#f8fafc' }}>
                        <TableCell sx={{ fontWeight: 900 }}>Vigencia</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Dependencia</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Responsable</TableCell>
                        <TableCell sx={{ fontWeight: 900 }}>Código Plan</TableCell>
                        <TableCell sx={{ fontWeight: 900 }} align="center">Estado Actual</TableCell>
                        <TableCell sx={{ fontWeight: 900 }} align="center">Actividades</TableCell>
                        <TableCell sx={{ fontWeight: 900, minWidth: 150 }}>Avance Físico</TableCell>
                        <TableCell sx={{ fontWeight: 900 }} align="center">Acciones</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {visiblePlans.map((actionPlan) => {
                        const actionItems = actionPlan.items || [];
                        const progress = actionItems.length ? actionItems.reduce((sum, row) => sum + Number(row.current_progress || 0), 0) / actionItems.length : 0;
                        const statusObj = ACTION_PLAN_STATUS_INFO[actionPlan.status] || { label: actionPlan.status, color: 'default' };

                        return (
                          <TableRow key={actionPlan.id} hover>
                            <TableCell sx={{ fontWeight: 700 }}>{actionPlan.term?.year || '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 800 }}>{actionPlan.organizationalUnit?.name || '—'}</TableCell>
                            <TableCell>
                              <Typography variant="body2" fontWeight={700}>{actionPlan.responsibleUser?.nombre || 'Sin asignar'}</Typography>
                              <Typography variant="caption" color="text.secondary">{actionPlan.responsibleUser?.cargo || ''}</Typography>
                            </TableCell>
                            <TableCell><Chip size="small" label={actionPlan.code} sx={{ fontWeight: 800, bgcolor: '#f1f5f9' }} /></TableCell>
                            <TableCell align="center">
                              <Chip size="small" color={statusObj.color} label={statusObj.label} sx={{ fontWeight: 900 }} />
                            </TableCell>
                            <TableCell align="center" sx={{ fontWeight: 800 }}>{actionItems.length}</TableCell>
                            <TableCell>
                              <Stack spacing={0.5}>
                                <Typography variant="caption" fontWeight={900}>{progress.toFixed(1)}%</Typography>
                                <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 3 }} />
                              </Stack>
                            </TableCell>
                            <TableCell align="center">
                              <Stack direction="row" spacing={1} justifyContent="center">
                                <Button variant="outlined" size="small" onClick={() => setEditorPlanId(actionPlan.id)} sx={{ textTransform: 'none', fontWeight: 800, borderRadius: 2 }}>
                                  Abrir
                                </Button>
                                {['owner_validation', 'formulation', 'adjustments'].includes(actionPlan.status) && (
                                  <Button
                                    variant="contained"
                                    color="success"
                                    size="small"
                                    onClick={async () => {
                                      try {
                                        await strategicPlanningService.transition(actionPlan.id, {
                                          action: 'activate',
                                          comment: 'Plan ejecutado desde seguimiento institucional'
                                        });
                                        enqueueSnackbar(`Plan ${actionPlan.code} pasado a Ejecución Oficial.`, { variant: 'success' });
                                        await load();
                                      } catch (err) {
                                        enqueueSnackbar(err?.response?.data?.message || 'No fue posible ejecutar el plan.', { variant: 'error' });
                                      }
                                    }}
                                    sx={{ textTransform: 'none', fontWeight: 900, borderRadius: 2, bgcolor: '#10b981', '&:hover': { bgcolor: '#059669' } }}
                                  >
                                    Ejecutar Plan
                                  </Button>
                                )}
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
          );
        })()}
        {!!syncJobs.length && <Alert severity="success" icon={<FolderOutlined />} sx={{ mt: 2 }}>Las evidencias se conservan y se sincronizan automáticamente con el expediente institucional.</Alert>}
        <StepNavigation onBack={() => setSpace('actions')} onNext={() => setSpace('analytics')} nextLabel="Ver resultados" />
      </Box>}

      {pedWorkspaceOpen && space === 'budget' && <Box>
        <SectionHeader title="Presupuesto" description="Importación controlada; movimientos físicos y financieros permanecen separados." />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <Button component="label" variant="contained" startIcon={<UploadFile />}>Validar presupuesto Excel<input hidden type="file" accept=".xlsx" onChange={(e) => previewFile(e.target.files?.[0], 'budget')} /></Button>
          <Button component="label" variant="outlined" startIcon={<Description />}>Validar DIR-PE-FR-003<input hidden type="file" accept=".xlsx" onChange={(e) => previewFile(e.target.files?.[0], 'historical')} /></Button>
        </Stack>
        {importPreview && <Alert severity={(importPreview.error_report || importPreview.errors || []).length ? 'warning' : 'success'} sx={{ mt: 2 }}>Archivo: {importPreview.original_name}. Filas: {(importPreview.rows || []).length}. Errores: {(importPreview.error_report || importPreview.errors || []).length}. Esta vista previa es reversible y aún no confirma información.</Alert>}
      </Box>}

      {pedWorkspaceOpen && space === 'analytics' && <Box>
        <SectionHeader title="Analítica" description="Navegación ejecutiva sin mezclar cumplimiento físico y ejecución financiera." />
        <Grid container spacing={2}>{[
          ['Planes', analytics?.plans || 0], ['Actividades', analytics?.activities || 0], ['Avance físico', `${Number(analytics?.physical_progress || 0).toFixed(1)}%`], ['Evidencias pendientes', analytics?.evidence?.pending || 0]
        ].map(([label, value]) => <Grid item xs={12} sm={6} md={3} key={label}><Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h4" fontWeight={900}>{value}</Typography></CardContent></Card></Grid>)}</Grid>
        <Alert severity="info" sx={{ mt: 2 }} icon={<CloudSync />}>Drive se identifica por IDs internos, no únicamente por nombres. Una resincronización crea lo faltante y actualiza versiones sin eliminar automáticamente.</Alert>
      </Box>}

      <Dialog open={Boolean(deleteCandidate)} onClose={() => !saving && setDeleteCandidate(null)} fullWidth maxWidth="xs" PaperProps={{ sx: { borderRadius: 3.5 } }}>
        <DialogTitle sx={{ px: 3, pt: 3, pb: 1 }}><Stack direction="row" gap={1.25} alignItems="center"><Box sx={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#fef2f2', color: '#dc2626' }}><DeleteOutline /></Box><Box><Typography variant="h6" fontWeight={950}>Eliminar PED en borrador</Typography><Typography variant="caption" color="text.secondary">Esta opción solo existe para borradores.</Typography></Box></Stack></DialogTitle>
        <DialogContent sx={{ px: 3, pt: '14px !important' }}><Typography>Se retirará <strong>{deleteCandidate?.name}</strong> de la lista de PED.</Typography><Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 2.5, bgcolor: '#f8fafc' }}><Typography variant="caption" color="text.secondary">PED QUE SE ELIMINARÁ</Typography><Typography fontWeight={900}>{deleteCandidate?.code}</Typography><Typography variant="body2" color="text.secondary">{deleteCandidate?.starts_on} → {deleteCandidate?.ends_on}</Typography></Paper><Alert severity="warning" sx={{ mt: 2 }}>Los PED activos, terminados o históricos están protegidos y nunca muestran esta opción.</Alert></DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, pt: 1.5 }}><Button onClick={() => setDeleteCandidate(null)} disabled={saving}>Conservar borrador</Button><Button color="error" variant="contained" startIcon={<DeleteOutline />} onClick={deleteDraftPlan} disabled={saving || deleteCandidate?.status !== 'draft'} sx={{ borderRadius: 2.25, fontWeight: 900 }}>{saving ? 'Eliminando…' : 'Sí, eliminar'}</Button></DialogActions>
      </Dialog>

      {/* DIÁLOGO: VISTA PREVIA Y CONFIRMACIÓN DE COLUMNAS LEÍDAS DEL EXCEL */}
      <Dialog open={Boolean(fieldSchemaPreview)} onClose={() => !saving && setFieldSchemaPreview(null)} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 3.5, maxHeight: '92vh' } }}>
        <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1 }}>
          <Typography variant="h5" fontWeight={950}>Columnas detectadas en el archivo Excel</Typography>
          <Typography variant="body2" color="text.secondary" mt={0.5}>
            Hoja: “{fieldSchemaPreview?.parsed_data?.sheet_name}” · Fila de encabezados: {fieldSchemaPreview?.parsed_data?.header_row}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, pt: '14px !important' }}>
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            Seleccione las columnas que conformarán la tabla de actividades del PED. Puede renombrarlas, cambiar su tipo de dato o marcarlas como obligatorias.
          </Alert>
          <Stack spacing={1.1}>
            {(fieldSchemaPreview?.fields || []).map((field, index) => (
              <Paper key={`${field.source_column}-${field.key}`} variant="outlined" sx={{ p: 1.4, borderRadius: 2.5, opacity: field.include && !field.system ? 1 : 0.62, bgcolor: field.include && !field.system ? '#fff' : '#f8fafc' }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '130px minmax(220px,1.4fr) minmax(190px,1fr) minmax(160px,.8fr)' }, gap: 1.25, alignItems: 'center' }}>
                  <FormControlLabel control={<Switch checked={field.include && !field.system} disabled={field.system} onChange={(event) => updatePreviewField(index, { include: event.target.checked })} />} label={field.system ? 'Automático' : 'Usar columna'} />
                  <TextField size="small" label="Nombre visible" value={field.label} disabled={field.system || !field.include} onChange={(event) => updatePreviewField(index, { label: event.target.value })} />
                  <TextField size="small" select label="Tipo de información" value={field.data_type} disabled={field.system || !field.include} onChange={(event) => updatePreviewField(index, { data_type: event.target.value })}>{Object.entries(FIELD_TYPE_LABEL).filter(([value]) => value !== 'strategic_relation').map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
                  <Box>
                    <FormControlLabel control={<Switch checked={field.required === true} disabled={field.system || !field.include} onChange={(event) => updatePreviewField(index, { required: event.target.checked })} />} label="Obligatorio" />
                    {field.sample_values?.length > 0 && <Typography variant="caption" color="text.secondary" display="block" noWrap title={field.sample_values.join(' · ')}>Ejemplo: {field.sample_values.join(' · ')}</Typography>}
                  </Box>
                </Box>
              </Paper>
            ))}
          </Stack>
          {!!activeFieldDefinitions.length && (
            <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 2.5, bgcolor: '#fffbeb', borderColor: '#fde68a' }}>
              <FormControlLabel control={<Switch checked={replaceSchemaFields} onChange={(event) => setReplaceSchemaFields(event.target.checked)} />} label="Reemplazar el diseño actual por estas columnas" />
              <Typography variant="caption" color="text.secondary" display="block">
                Si lo deja desactivado, las columnas leídas se sumarán a las que ya tiene configuradas sin borrar nada.
              </Typography>
            </Paper>
          )}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 2 }}>
          <Button onClick={() => setFieldSchemaPreview(null)} disabled={saving}>Cancelar</Button>
          <Button variant="contained" onClick={confirmFieldSchema} disabled={saving || !(fieldSchemaPreview?.fields || []).some((field) => field.include && !field.system)} sx={{ px: 3, borderRadius: 2.5, fontWeight: 900 }}>
            {saving ? 'Guardando columnas…' : `Confirmar y guardar ${(fieldSchemaPreview?.fields || []).filter((field) => field.include && !field.system).length} columnas`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: AGREGAR O EDITAR CAMPO INDIVIDUAL */}
      <Dialog open={openField} onClose={() => setOpenField(false)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={900}>{fieldForm.id ? 'Editar columna del Plan de Acción' : 'Agregar nueva columna al Plan de Acción'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} mt={0.25}>
            <Grid item xs={12} md={7}>
              <TextField required fullWidth label="Nombre visible para el usuario" placeholder="Ejemplo: Resultado esperado" value={fieldForm.label} onChange={(e) => { const label = e.target.value; setFieldForm({ ...fieldForm, label, key: fieldForm.id ? fieldForm.key : label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') }); }} />
            </Grid>
            <Grid item xs={12} md={5}>
              <TextField required fullWidth disabled={Boolean(fieldForm.id)} label="Código interno" value={fieldForm.key} onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })} helperText="Identificador en base de datos" />
            </Grid>
            <Grid item xs={12} md={7}>
              <TextField required fullWidth select label="Tipo de dato" value={fieldForm.data_type} onChange={(e) => setFieldForm({ ...fieldForm, data_type: e.target.value, catalog_type: ['catalog', 'catalog_multi'].includes(e.target.value) ? fieldForm.catalog_type : '', options_text: e.target.value === 'list' ? fieldForm.options_text : '' })}>
                {Object.entries(FIELD_TYPE_LABEL).map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} md={5}>
              <FormControlLabel control={<Switch checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} />} label="Campo obligatorio" />
            </Grid>
            {fieldForm.data_type === 'list' && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 1.25 }}>Escriba las opciones de la lista desplegable (una opción por cada línea).</Alert>
                <TextField fullWidth multiline minRows={5} label="Opciones que aparecerán en la lista" placeholder={'Gestión\nResultado\nProducto\nImpacto'} helperText="Escriba una opción por línea." value={fieldForm.options_text} onChange={(e) => setFieldForm({ ...fieldForm, options_text: e.target.value })} />
              </Grid>
            )}
            {['catalog', 'catalog_multi'].includes(fieldForm.data_type) && (
              <Grid item xs={12}>
                <Alert severity="info" sx={{ mb: 1.25 }}>Seleccione una tabla institucional para alimentar las opciones disponibles.</Alert>
                <Stack direction={{ xs: 'column', sm: 'row' }} gap={1}>
                  <TextField fullWidth select label="Tabla que alimentará este campo" value={fieldForm.catalog_type} onChange={(e) => setFieldForm({ ...fieldForm, catalog_type: e.target.value })} helperText="Las opciones activas aparecerán automáticamente en el formulario.">
                    <MenuItem value="">Seleccione una tabla</MenuItem>
                    {catalogOptions.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}
                  </TextField>
                  <Button variant="outlined" startIcon={<Add />} onClick={() => setOpenCatalog(true)} sx={{ minWidth: 190, alignSelf: 'flex-start', minHeight: 56 }}>Crear nueva tabla</Button>
                </Stack>
              </Grid>
            )}
            {fieldForm.data_type === 'formula' && (
              <Grid item xs={12}>
                <TextField fullWidth label="Fórmula" placeholder="avance_periodo_1 + avance_periodo_2" value={fieldForm.formula} onChange={(e) => setFieldForm({ ...fieldForm, formula: e.target.value })} />
              </Grid>
            )}
            <Grid item xs={12}>
              <Alert severity="info">Este campo se aplicará a los Planes de Acción del PED seleccionado.</Alert>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenField(false)}>Cancelar</Button>
          <Button variant="contained" disabled={saving || !fieldForm.key.trim() || !fieldForm.label.trim()} onClick={saveField}>
            {saving ? 'Guardando…' : fieldForm.id ? 'Actualizar campo' : 'Crear campo'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openTerm} onClose={() => setOpenTerm(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={900}>{termForm.id ? 'Editar año del PED' : 'Agregar año al PED'}</DialogTitle>
        <DialogContent><Grid container spacing={2} mt={0.25}>
          <Grid item xs={12} md={6}><TextField required fullWidth type="number" label="Año" value={termForm.year} onChange={(e) => { const year = e.target.value; setTermForm({ ...termForm, year, starts_on: termForm.id ? termForm.starts_on : `${year}-01-01`, ends_on: termForm.id ? termForm.ends_on : `${year}-12-31` }); }} /></Grid>
          <Grid item xs={12} md={6}><TextField select fullWidth label="Estado" value={termForm.status} onChange={(e) => setTermForm({ ...termForm, status: e.target.value })}><MenuItem value="planned">Programada</MenuItem><MenuItem value="active">Activa</MenuItem><MenuItem value="closed">Cerrada</MenuItem></TextField></Grid>
          <Grid item xs={12} md={6}><TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha inicial vigencia" value={termForm.starts_on} onChange={(e) => setTermForm({ ...termForm, starts_on: e.target.value })} /></Grid>
          <Grid item xs={12} md={6}><TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha final vigencia" value={termForm.ends_on} onChange={(e) => setTermForm({ ...termForm, ends_on: e.target.value })} /></Grid>

          <Grid item xs={12}><Divider sx={{ my: 0.5 }} /><Typography variant="subtitle2" fontWeight={900} color="#1e293b" sx={{ mt: 0.5 }}>Plazo General de Formulación (Etapa 1: Plan y actividades)</Typography><Typography variant="caption" color="text.secondary" display="block">Ventana oficial por defecto en la que todas las dependencias formulan y registran sus actividades.</Typography></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth type="date" InputLabelProps={{ shrink: true }} label="Inicio formulación Etapa 1" value={termForm.formulation_starts_on || ''} onChange={(e) => setTermForm({ ...termForm, formulation_starts_on: e.target.value })} helperText="Por defecto: 01 de enero" /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth type="date" InputLabelProps={{ shrink: true }} label="Cierre general Etapa 1" value={termForm.formulation_ends_on || ''} onChange={(e) => setTermForm({ ...termForm, formulation_ends_on: e.target.value })} helperText="Fecha límite general para todas las dependencias" /></Grid>
          {termForm.id && (
            <Grid item xs={12}>
              <FormControlLabel
                control={<Checkbox checked={Boolean(termForm.propagate_to_plans)} onChange={(e) => setTermForm({ ...termForm, propagate_to_plans: e.target.checked })} color="primary" />}
                label={<Typography variant="body2" sx={{ fontSize: 13, color: '#334155', fontWeight: 600 }}>Sincronizar y aplicar estas fechas a todos los planes de acción de esta vigencia (excepto los que ya tienen prórroga individual)</Typography>}
              />
            </Grid>
          )}

          {!termForm.id && <Grid item xs={12}><Alert severity="info">Se crearán inicialmente dos periodos: Seguimiento 1 (enero–junio) y Seguimiento 2 / Cierre (julio–diciembre).</Alert></Grid>}
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setOpenTerm(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !termForm.year || !termForm.starts_on || !termForm.ends_on} onClick={saveTerm}>{saving ? 'Guardando…' : termForm.id ? 'Actualizar año y plazos' : 'Crear año y plazos'}</Button></DialogActions>
      </Dialog>

      <Dialog open={openLevel} onClose={() => setOpenLevel(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={900}>{levelForm.id ? 'Cambiar tipo de contenido' : 'Crear un tipo de contenido'}</DialogTitle>
        <DialogContent><Stack gap={2} mt={1}><Alert severity="info">Escriba cómo se llamará un grupo de información del PED. Ejemplos: Proyecto, Programa, Producto, Objetivo o Línea estratégica.</Alert><TextField autoFocus required label="Nombre del tipo de contenido" placeholder="Ejemplo: Proyecto" value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} helperText={levelForm.id ? 'Cambie el nombre y guarde.' : 'Después podrá agregar los registros que pertenecen a este tipo.'} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setOpenLevel(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !levelForm.name.trim()} onClick={saveStructureLevel}>{saving ? 'Guardando…' : levelForm.id ? 'Guardar cambio' : 'Crear tipo'}</Button></DialogActions>
      </Dialog>

      <Dialog open={openElement} onClose={() => setOpenElement(false)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={900}>{elementForm.id ? 'Editar contenido del PED' : 'Agregar contenido al PED'}</DialogTitle>
        <DialogContent><Grid container spacing={2} mt={0.25}>
          <Grid item xs={12}><Alert severity="info">Ejemplo: seleccione “Proyecto”, escriba el código PRO-01 y el nombre “Modernización de laboratorios”.</Alert></Grid>
          <Grid item xs={12} md={6}><TextField required fullWidth select label="¿Qué tipo de contenido va a agregar?" value={elementForm.level_id} onChange={(e) => setElementForm({ ...elementForm, level_id: e.target.value, parent_id: '' })}>{[...activeLevels].sort((a,b) => a.position-b.position).map((level) => <MenuItem key={level.id} value={level.id}>{level.name}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth select disabled={!elementForm.level_id || !parentCandidates.length} label="¿Depende de otro registro? (opcional)" value={elementForm.parent_id} onChange={(e) => setElementForm({ ...elementForm, parent_id: e.target.value })}><MenuItem value="">No depende de otro</MenuItem>{parentCandidates.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={3}><TextField required fullWidth label="Código corto" placeholder="PRO-01" value={elementForm.code} onChange={(e) => setElementForm({ ...elementForm, code: e.target.value })} /></Grid>
          <Grid item xs={12} md={9}><TextField required fullWidth label="Nombre del contenido" placeholder="Ejemplo: Modernización de laboratorios" value={elementForm.name} onChange={(e) => setElementForm({ ...elementForm, name: e.target.value })} /></Grid>
          <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Descripción (opcional)" value={elementForm.description} onChange={(e) => setElementForm({ ...elementForm, description: e.target.value })} /></Grid>
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setOpenElement(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !elementForm.level_id || !elementForm.code.trim() || !elementForm.name.trim()} onClick={saveStructureElement}>{saving ? 'Guardando…' : elementForm.id ? 'Guardar cambios' : 'Agregar contenido'}</Button></DialogActions>
      </Dialog>

      <Dialog open={openStrategicPlan} onClose={() => setOpenStrategicPlan(false)} fullWidth maxWidth={editingPlanId ? 'md' : 'sm'} PaperProps={{ sx: { borderRadius: 4, overflow: 'hidden' } }}>
        <DialogTitle sx={{ px: 3, pt: 2.5, pb: 1, fontWeight: 900 }}>{editingPlanId ? 'Editar Plan Estratégico de Desarrollo' : 'Crear Plan Estratégico de Desarrollo'}</DialogTitle>
        <DialogContent sx={{ px: 3, pt: '16px !important', pb: 3 }}>
          {!editingPlanId ? <Stack spacing={2.25}>
            <Alert severity="info" sx={{ borderRadius: 2.5, alignItems: 'center', py: 0.75 }}>Defina el periodo y elija cómo iniciará este PED. Sus niveles, listas y campos pertenecerán únicamente a este plan.</Alert>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha de inicio" value={strategicPlanForm.starts_on} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, starts_on: e.target.value })} helperText="Ejemplo: 01/01/2030" />
              <TextField required fullWidth type="number" inputProps={{ min: 1, max: 30 }} label="Años hasta finalizar" value={strategicPlanForm.duration_years} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, duration_years: e.target.value })} helperText="Ejemplo: 5 crea el PED 2030–2035" />
            </Box>

            {newPedEndYear && <Paper variant="outlined" sx={{ px: 2.25, py: 1.75, borderRadius: 2.5, bgcolor: '#f5f3ff', borderColor: '#c4b5fd' }}><Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={0.5}><Box><Typography fontWeight={900} color="primary">PED {newPedStartYear}–{newPedEndYear}</Typography><Typography variant="body2" color="text.secondary">{Number(strategicPlanForm.duration_years) + 1} vigencias con informes S1 y S2</Typography></Box><Chip size="small" color="secondary" label="Configuración automática" /></Stack></Paper>}

            <TextField select fullWidth label="¿Cómo desea construir la estructura?" value={strategicPlanForm.setup_mode} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, setup_mode: e.target.value })} helperText={{ blank: 'Empieza sin objetivos ni lineamientos. Usted crea los niveles y campos desde la interfaz.', institutional: 'Usa Objetivo → Lineamiento y el formulario institucional como punto de partida.', copy: `Copia niveles, elementos, campos y listas del PED seleccionado: ${plan?.code || 'anterior'}.` }[strategicPlanForm.setup_mode]}>
              <MenuItem value="blank">Crear una estructura nueva desde cero</MenuItem>
              <MenuItem value="institutional">Usar la estructura institucional actual</MenuItem>
              <MenuItem value="copy" disabled={!plan?.id}>Copiar la estructura del PED seleccionado</MenuItem>
            </TextField>

            <TextField fullWidth multiline minRows={2} maxRows={4} label="Descripción o lema (opcional)" placeholder="Ejemplo: La meta es transformar" value={strategicPlanForm.description} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, description: e.target.value })} />
          </Stack> : <Stack spacing={2.5}>
            <Box>
              <Typography variant="subtitle2" fontWeight={900} color="#334155" mb={1.25}>Información general</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(190px,.8fr) minmax(320px,2fr)' }, gap: 2 }}>
                <TextField required fullWidth label="Código del PED" value={strategicPlanForm.code} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, code: e.target.value })} />
                <TextField required fullWidth label="Nombre del PED" value={strategicPlanForm.name} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, name: e.target.value })} />
              </Box>
              <TextField sx={{ mt: 2 }} fullWidth multiline minRows={2} maxRows={4} label="Descripción o lema" value={strategicPlanForm.description} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, description: e.target.value })} />
            </Box>

            <Box sx={{ pt: 2.25, borderTop: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" fontWeight={900} color="#334155" mb={1.25}>Vigencia y estado</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 2 }}>
                <TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha inicial" value={strategicPlanForm.starts_on} onChange={(e) => handlePlanDateChange('starts_on', e.target.value)} />
                <TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha final" value={strategicPlanForm.ends_on} onChange={(e) => handlePlanDateChange('ends_on', e.target.value)} />
                <TextField select fullWidth label="Estado del PED" value={strategicPlanForm.status} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, status: e.target.value })}><MenuItem value="draft">Borrador</MenuItem><MenuItem value="active">Activo</MenuItem><MenuItem value="planned">Planeado</MenuItem><MenuItem value="closed">Cerrado / histórico</MenuItem></TextField>
              </Box>
              {Boolean(editingPlanId && strategicPlanForm.starts_on && strategicPlanForm.ends_on) && (() => {
                const sYear = Number(String(strategicPlanForm.starts_on).slice(0, 4));
                const eYear = Number(String(strategicPlanForm.ends_on).slice(0, 4));
                const count = (sYear && eYear && eYear >= sYear) ? (eYear - sYear + 1) : 0;
                if (!count) return null;
                return (
                  <Paper variant="outlined" sx={{ mt: 1.5, px: 2, py: 1.25, borderRadius: 2, bgcolor: '#f0fdf4', borderColor: '#bbf7d0' }}>
                    <Typography variant="body2" color="#166534" fontWeight={850}>
                      {count} {count === 1 ? 'vigencia' : 'vigencias'} ({sYear} a {eYear}) · Código y nombre ajustados automáticamente.
                    </Typography>
                  </Paper>
                );
              })()}
            </Box>


            <Box sx={{ pt: 2.25, borderTop: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" fontWeight={900} color="#334155" mb={1.25}>Información administrativa</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr 1fr' }, gap: 2 }}>
                <TextField fullWidth label="Acto administrativo" placeholder="Ejemplo: Acuerdo 012 de 2029" value={strategicPlanForm.administrative_act} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, administrative_act: e.target.value })} />
                <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} inputProps={{ min: strategicPlanForm.starts_on || undefined }} label="Fecha del acto administrativo" value={strategicPlanForm.approved_on} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, approved_on: e.target.value })} error={administrativeDateInvalid} helperText={administrativeDateInvalid ? 'No puede ser anterior al inicio del PED.' : strategicPlanForm.starts_on ? `Disponible desde ${formatIsoDate(strategicPlanForm.starts_on)}.` : 'Primero defina la fecha inicial del PED.'} />
                <TextField fullWidth type="text" label="Presupuesto general" value={formatCop(strategicPlanForm.global_budget)} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, global_budget: copDigits(e.target.value) })} inputProps={{ inputMode: 'numeric' }} helperText="Pesos colombianos (COP)" placeholder="$ 0" />
              </Box>
            </Box>
          </Stack>}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}><Button onClick={() => { setOpenStrategicPlan(false); setEditingPlanId(null); }} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancelar</Button><Button variant="contained" disabled={saving || (!editingPlanId && (!strategicPlanForm.starts_on || !strategicPlanForm.duration_years))} onClick={saveStrategicPlan} sx={{ minWidth: 220, borderRadius: 2.5, py: 1, textTransform: 'none', fontWeight: 900 }}>{saving ? 'Creando PED…' : editingPlanId ? 'Guardar cambios' : 'Crear PED y definir campos'}</Button></DialogActions>
      </Dialog>

      <Dialog
        open={Boolean(dependencyToRemove)}
        onClose={() => !saving && setDependencyToRemove(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3.5, overflow: 'hidden', boxShadow: '0 24px 70px rgba(15,23,42,.24)' } }}
      >
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.25 } }}>
          <Stack alignItems="center" textAlign="center" spacing={1.5}>
            <Box sx={{ width: 54, height: 54, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#fff1f2', color: '#be123c' }}><DeleteOutline sx={{ fontSize: 29 }} /></Box>
            <Box>
              <Typography variant="h5" fontWeight={950} color="#172033">Retirar dependencia</Typography>
              <Typography color="#52657b" mt={0.5}>Esta asignación dejará de participar en la vigencia.</Typography>
            </Box>
            <Paper variant="outlined" sx={{ width: '100%', p: 1.75, borderRadius: 2.5, borderColor: '#dbe4ef', bgcolor: '#f8fafc' }}>
              <Typography fontWeight={950} color="#172033">{dependencyToRemove?.assignment?.dependency?.name}</Typography>
              <Stack direction="row" justifyContent="center" gap={0.75} mt={1} flexWrap="wrap">
                <Chip size="small" label={`Vigencia ${dependencyToRemove?.year || ''}`} sx={{ fontWeight: 850, bgcolor: '#dbeafe', color: '#174ea6' }} />
                <Chip size="small" label="Solo este año" sx={{ fontWeight: 850, bgcolor: '#ecfdf5', color: '#047857' }} />
              </Stack>
            </Paper>
            <Typography variant="body2" color="#64748b">Los demás años no cambiarán.</Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3.25, pb: 3, pt: 0, gap: 1 }}>
          <Button fullWidth variant="outlined" disabled={saving} onClick={() => setDependencyToRemove(null)} sx={{ minHeight: 44, borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>Volver</Button>
          <Button fullWidth variant="contained" color="error" disabled={saving} onClick={confirmRemoveAnnualDependency} sx={{ minHeight: 44, borderRadius: 2, textTransform: 'none', fontWeight: 900, boxShadow: 'none' }}>{saving ? 'Retirando…' : 'Sí, retirar'}</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCatalog} onClose={() => setOpenCatalog(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={900}>Crear tabla de referencia</DialogTitle>
        <DialogContent><Stack gap={2} mt={1}>
          <Alert severity="info">La nueva tabla pertenecerá al PED seleccionado y podrá utilizarse posteriormente como lista desplegable.</Alert>
          <TextField required label="Nombre de la tabla" placeholder="Por ejemplo: Programas académicos" value={newCatalog.name} onChange={(e) => setNewCatalog({ ...newCatalog, name: e.target.value })} />
          <TextField required label="Código interno" placeholder="programa_academico" helperText="Use un código corto; el sistema reemplazará espacios por guiones bajos." value={newCatalog.code} onChange={(e) => setNewCatalog({ ...newCatalog, code: e.target.value })} />
          <TextField select label="¿Dónde se utilizará como lista o filtro?" value={newCatalog.scope} onChange={(e) => setNewCatalog({ ...newCatalog, scope: e.target.value })}>
            <MenuItem value="action_plans">Planes de Acción</MenuItem><MenuItem value="activities">Actividades</MenuItem><MenuItem value="meetings">Reuniones y actas</MenuItem><MenuItem value="monitoring">Seguimiento</MenuItem><MenuItem value="budget">Presupuesto</MenuItem><MenuItem value="analytics">Analítica</MenuItem><MenuItem value="general">Uso general</MenuItem>
          </TextField>
        </Stack></DialogContent>
        <DialogActions><Button onClick={() => setOpenCatalog(false)}>Cancelar</Button><Button variant="contained" onClick={createCatalog}>Crear tabla</Button></DialogActions>
      </Dialog>

      <Dialog open={openPlan} onClose={() => { setOpenPlan(false); setActionPlanCreationContext(null); }} fullWidth maxWidth="sm" PaperProps={{ sx: { borderRadius: 3.5 } }}>
        <DialogTitle sx={{ px: 3, pt: 2.75, pb: 1 }}><Typography variant="h5" fontWeight={950}>Crear Plan de Acción</Typography><Typography variant="body2" color="text.secondary">Complete el responsable para la combinación seleccionada.</Typography></DialogTitle><DialogContent sx={{ px: 3, pt: '14px !important' }}><Stack gap={2}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '.7fr 1.3fr' }, gap: 1 }}><Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: '#f8fafc' }}><Typography variant="caption" color="text.secondary" fontWeight={850}>AÑO DE EJECUCIÓN</Typography><Typography variant="h6" fontWeight={950}>{actionPlanCreationContext?.term?.year || selectedTerm?.year}</Typography><Chip size="small" label={TERM_STATUS_LABEL[actionPlanCreationContext?.term?.status || selectedTerm?.status] || actionPlanCreationContext?.term?.status || selectedTerm?.status} /></Paper><Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, bgcolor: '#f8fafc', minWidth: 0 }}><Typography variant="caption" color="text.secondary" fontWeight={850}>DEPENDENCIA</Typography><Typography fontWeight={950} noWrap title={actionPlanCreationContext?.unit?.name}>{actionPlanCreationContext?.unit?.name}</Typography><Typography variant="caption" color="text.secondary">{actionPlanCreationContext?.unit?.code}</Typography></Paper></Box>
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch"><TextField fullWidth autoFocus label="Cédula o número de documento del líder" value={leaderDocument} onChange={(e) => { setLeaderDocument(e.target.value.replace(/[^0-9]/g, '')); setLeaderLookup(null); setForm((current) => ({ ...current, responsible_user_id: '' })); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchLeaderByDocument(); } }} inputProps={{ inputMode: 'numeric', maxLength: 15 }} helperText="Digite el documento y presione Buscar o Enter." /><Button variant="contained" sx={{ minWidth: 120 }} disabled={!leaderDocument.trim()} onClick={searchLeaderByDocument}>Buscar</Button></Stack>
          {leaderLookup && <Alert severity={leaderLookup.found ? 'success' : 'warning'}>{leaderLookup.found ? <Box><Typography fontWeight={900}>{leaderLookup.leader.name}</Typography><Typography variant="body2">Documento: {leaderLookup.leader.document} · {leaderLookup.leader.email}</Typography><Typography variant="body2">Cargo: {leaderLookup.leader.position || 'Sin cargo registrado'} · Dependencia registrada: {leaderLookup.leader.dependency || 'Sin dependencia'}</Typography></Box> : leaderLookup.message}</Alert>}
          <Autocomplete options={leaders} value={leaders.find((leader) => String(leader.id) === String(form.responsible_user_id)) || null} onChange={(_, leader) => selectLeader(leader)} filterOptions={(options, state) => { const query=state.inputValue.toLowerCase().trim(); return options.filter((leader) => `${leader.document || ''} ${leader.name} ${leader.position || ''} ${leader.email} ${leader.dependency || ''}`.toLowerCase().includes(query)); }} getOptionLabel={(leader) => `${leader.document || 'Sin documento'} · ${leader.name} · ${leader.position || 'Sin cargo'}`} renderInput={(params) => <TextField {...params} label="O buscar por documento, nombre, cargo, correo o dependencia" />} />
          <TextField label="Nombre opcional" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Stack></DialogContent><DialogActions sx={{ px: 3, py: 2 }}><Button onClick={() => { setOpenPlan(false); setActionPlanCreationContext(null); }}>Cancelar</Button><Button variant="contained" disabled={saving || !form.responsible_user_id} onClick={createActionPlan} sx={{ px: 3, borderRadius: 2.25, fontWeight: 900 }}>{saving ? 'Creando…' : 'Crear Plan de Acción'}</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(transfer)} onClose={() => setTransfer(null)} fullWidth maxWidth="sm"><DialogTitle fontWeight={900}>Transferir liderazgo del plan</DialogTitle><DialogContent><Stack gap={2} mt={1}><Alert severity="info">El plan seguirá anclado a la dependencia. Se cerrará la asignación anterior y se conservarán persona, cargo, fechas y motivo en el histórico.</Alert><Autocomplete options={leaders} value={leaders.find((leader) => String(leader.id) === String(transfer?.user_id)) || null} onChange={(_, leader) => setTransfer({ ...transfer, user_id: leader?.id || '' })} getOptionLabel={(leader) => `${leader.name} · ${leader.position || 'Sin cargo'} · ${leader.email}`} renderInput={(params) => <TextField {...params} label="Buscar nuevo responsable" />} /><TextField required multiline minRows={3} label="Motivo de la transferencia" value={transfer?.reason || ''} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={() => setTransfer(null)}>Cancelar</Button><Button variant="contained" disabled={!transfer?.user_id || !transfer?.reason?.trim()} onClick={executeTransfer}>Confirmar transferencia</Button></DialogActions></Dialog>
      {/* Diálogo para eliminar plan de acción individual */}
      <Dialog
        open={Boolean(deleteActionPlanCandidate)}
        onClose={() => !saving && setDeleteActionPlanCandidate(null)}
        fullWidth
        maxWidth="xs"
        PaperProps={{ sx: { borderRadius: 3.5, overflow: 'hidden', boxShadow: '0 24px 70px rgba(15,23,42,.24)' } }}
      >
        <DialogContent sx={{ p: { xs: 2.5, sm: 3.25 } }}>
          <Stack alignItems="center" textAlign="center" spacing={1.5}>
            <Box sx={{ width: 54, height: 54, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: '#fff1f2', color: '#be123c' }}>
              <DeleteOutline sx={{ fontSize: 29 }} />
            </Box>
            <Box>
              <Typography variant="h5" fontWeight={950} color="#172033">Eliminar Plan de Acción</Typography>
              <Typography color="#52657b" mt={0.5}>Esta acción eliminará el plan de acción, sus actividades asociadas y retirará la dependencia de la vigencia (Paso 3).</Typography>
            </Box>
            <Paper variant="outlined" sx={{ width: '100%', p: 1.75, borderRadius: 2.5, borderColor: '#dbe4ef', bgcolor: '#f8fafc' }}>
              <Typography fontWeight={950} color="#172033">{deleteActionPlanCandidate?.code || 'Plan de Acción'}</Typography>
              <Typography variant="body2" color="text.secondary" mt={0.25}>{deleteActionPlanCandidate?.title}</Typography>
              <Stack direction="row" justifyContent="center" gap={0.75} mt={1} flexWrap="wrap">
                <Chip size="small" label={`Vigencia ${deleteActionPlanCandidate?.term?.year || ''}`} sx={{ fontWeight: 850, bgcolor: '#dbeafe', color: '#174ea6' }} />
                <Chip size="small" label={`${deleteActionPlanCandidate?.items?.length || 0} actividades`} sx={{ fontWeight: 850 }} />
              </Stack>
            </Paper>
            <Typography variant="caption" color="#dc2626" fontWeight={700}>
              Esta acción no se puede deshacer.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3.25, pb: 3, pt: 0, gap: 1 }}>
          <Button fullWidth variant="outlined" disabled={saving} onClick={() => setDeleteActionPlanCandidate(null)} sx={{ minHeight: 44, borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>
            Cancelar
          </Button>
          <Button fullWidth variant="contained" color="error" disabled={saving} onClick={confirmDeleteActionPlan} sx={{ minHeight: 44, borderRadius: 2, textTransform: 'none', fontWeight: 900, boxShadow: 'none' }}>
            {saving ? 'Eliminando…' : 'Sí, eliminar plan y retirar dependencia'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para limpiar vigencia / borrado masivo de planes */}
      <Dialog
        open={Boolean(bulkDeleteCandidate)}
        onClose={() => !bulkActionLoading && setBulkDeleteCandidate(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3.5, overflow: 'hidden' } }}
      >
        <DialogTitle sx={{ px: 3, pt: 2.75, pb: 1 }}>
          <Typography variant="h5" fontWeight={950} color="#dc2626">Limpiar vigencia {bulkDeleteCandidate?.year}</Typography>
          <Typography variant="body2" color="text.secondary">Eliminación masiva de todos los planes de acción y retiro de dependencias de este año.</Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: '14px !important' }}>
          <Stack spacing={2}>
            <Alert severity="error" sx={{ borderRadius: 2.5 }}>
              <strong>¡Advertencia!</strong> Se eliminarán todos los planes de acción correspondientes a la vigencia <strong>{bulkDeleteCandidate?.year}</strong> junto con sus actividades y se retirarán las dependencias configuradas en este año (Paso 3). Podrá volver a configurar dependencias y generar planes cuando lo desee.
            </Alert>
            <Typography variant="body2" color="#334155">
              Para confirmar la eliminación, escriba la palabra <strong>ELIMINAR</strong> a continuación:
            </Typography>
            <TextField
              fullWidth
              autoFocus
              size="small"
              placeholder="ELIMINAR"
              value={bulkDeleteConfirmText}
              onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button disabled={bulkActionLoading} onClick={() => setBulkDeleteCandidate(null)} sx={{ textTransform: 'none', fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={bulkActionLoading || bulkDeleteConfirmText.trim().toUpperCase() !== 'ELIMINAR'}
            onClick={confirmBulkDeleteActionPlans}
            sx={{ minWidth: 180, borderRadius: 2.25, fontWeight: 900, textTransform: 'none' }}
          >
            {bulkActionLoading ? 'Eliminando planes…' : 'Confirmar y borrar todos'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo para editar metadatos del plan de acción */}
      <Dialog
        open={Boolean(editActionPlanCandidate)}
        onClose={() => !saving && setEditActionPlanCandidate(null)}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: 3.5 } }}
      >
        <DialogTitle sx={{ px: 3, pt: 2.75, pb: 1 }}>
          <Typography variant="h5" fontWeight={950}>Editar Plan de Acción</Typography>
          <Typography variant="body2" color="text.secondary">
            {editActionPlanCandidate?.unit_name} · Vigencia {editActionPlanCandidate?.year}
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ px: 3, pt: '14px !important' }}>
          <Stack spacing={2}>
            <TextField
              label="Código del Plan"
              value={editActionPlanCandidate?.code || ''}
              onChange={(e) => setEditActionPlanCandidate({ ...editActionPlanCandidate, code: e.target.value })}
              fullWidth
              helperText="Código identificador institucional (ej. 2026-VICERREC)"
            />
            <TextField
              label="Título o nombre del Plan"
              value={editActionPlanCandidate?.title || ''}
              onChange={(e) => setEditActionPlanCandidate({ ...editActionPlanCandidate, title: e.target.value })}
              fullWidth
            />
            <Autocomplete
              options={leaders}
              value={leaders.find((l) => String(l.id) === String(editActionPlanCandidate?.responsible_user_id)) || null}
              onChange={(_, leader) => setEditActionPlanCandidate({ ...editActionPlanCandidate, responsible_user_id: leader?.id || '' })}
              getOptionLabel={(leader) => `${leader.document || 'Sin documento'} · ${leader.name} · ${leader.position || 'Sin cargo'}`}
              renderInput={(params) => <TextField {...params} label="Líder responsable" />}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid #e2e8f0', gap: 1 }}>
          <Button disabled={saving} onClick={() => setEditActionPlanCandidate(null)} sx={{ textTransform: 'none', fontWeight: 800 }}>
            Cancelar
          </Button>
          <Button
            variant="contained"
            disabled={saving || !editActionPlanCandidate?.title?.trim()}
            onClick={confirmUpdateActionPlanMeta}
            sx={{ px: 3, borderRadius: 2.25, fontWeight: 900, textTransform: 'none' }}
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIÁLOGO: AJUSTAR PLAZO GENERAL DE FORMULACIÓN DE LA VIGENCIA */}
      <Dialog
        open={Boolean(generalTimelineModal.open)}
        onClose={() => !generalTimelineModal.saving && setGeneralTimelineModal({ open: false, term: null, starts_on: '', ends_on: '', saving: false })}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: 'hidden',
            boxShadow: '0 24px 60px -12px rgba(15, 23, 42, 0.22)',
            border: '1px solid #e2e8f0'
          }
        }}
      >
        <DialogTitle
          sx={{
            px: { xs: 2.5, sm: 3 },
            py: 2.25,
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
              <AccessTimeOutlined sx={{ fontSize: 22 }} />
            </Box>
            <Box>
              <Typography fontWeight={900} color="#0f172a" sx={{ fontSize: 17, lineHeight: 1.25 }}>
                Plazo General de Formulación · Vigencia {generalTimelineModal.term?.year}
              </Typography>
              <Typography variant="caption" color="#64748b" sx={{ fontSize: 12.5, display: 'block', mt: 0.2 }}>
                Etapa 1: Programación oficial para todas las dependencias
              </Typography>
            </Box>
          </Stack>
          <IconButton
            size="small"
            onClick={() => !generalTimelineModal.saving && setGeneralTimelineModal({ open: false, term: null, starts_on: '', ends_on: '', saving: false })}
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
                Al configurar esta fecha, todos los planes de acción de la vigencia <strong>{generalTimelineModal.term?.year}</strong> se actualizarán con este plazo. Si alguna dependencia cuenta con una <strong>prórroga individual mayor</strong>, su plazo se mantendrá protegido y no se recortará.
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
                  onClick={() => handleAddDaysToGeneralTimeline(7)}
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
                  onClick={() => handleAddDaysToGeneralTimeline(15)}
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
                  onClick={() => handleAddDaysToGeneralTimeline(30)}
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
                  onClick={handleSetEndOfMonthGeneralTimeline}
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
                    Fecha de inicio general
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={generalTimelineModal.starts_on}
                    onChange={(e) => setGeneralTimelineModal((prev) => ({ ...prev, starts_on: e.target.value }))}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        bgcolor: '#ffffff',
                        fontSize: 13.5
                      }
                    }}
                  />
                  <Typography variant="caption" sx={{ color: '#94a3b8', fontSize: 11.5, display: 'block', mt: 0.5 }}>
                    Inicio de la etapa de formulación
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box>
                  <Typography sx={{ fontSize: 12.5, fontWeight: 750, color: '#334155', mb: 0.75 }}>
                    Fecha límite general (cierre)
                  </Typography>
                  <TextField
                    fullWidth
                    size="small"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={generalTimelineModal.ends_on}
                    onChange={(e) => setGeneralTimelineModal((prev) => ({ ...prev, ends_on: e.target.value }))}
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
                    Límite para concertar actividades
                  </Typography>
                </Box>
              </Grid>
            </Grid>
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
            onClick={() => setGeneralTimelineModal({ open: false, term: null, starts_on: '', ends_on: '', saving: false })}
            disabled={generalTimelineModal.saving}
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
            onClick={handleSaveGeneralTimeline}
            disabled={generalTimelineModal.saving || !generalTimelineModal.ends_on}
            startIcon={generalTimelineModal.saving ? <CircularProgress size={16} color="inherit" /> : <CheckCircleOutline sx={{ fontSize: 18 }} />}
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
            {generalTimelineModal.saving ? 'Guardando y aplicando…' : 'Guardar y Aplicar a Todos los Planes'}
          </Button>
        </DialogActions>
      </Dialog>

      <StrategicActionPlanEditor open={Boolean(editorPlanId)} planId={editorPlanId} platformPlan={plan} workflow={boot?.workflow} onClose={() => setEditorPlanId(null)} onChanged={load} onPlanReplaced={setEditorPlanId} />
    </Stack>
  );
}
