import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Grid, LinearProgress, MenuItem, Paper, Stack, Switch,
  InputAdornment, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import {
  AccountTree, Add, Analytics, ArrowBack, AssignmentTurnedIn, CalendarMonth, CheckCircleOutline, CloudSync,
  DeleteOutline, Description, Download, EditOutlined, Folder, GridView, LockOutlined, Payments, Search,
  Settings, SwapHoriz, TableRows, Timeline, UploadFile
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../services/strategicPlanningService';
import StrategicActionPlanEditor from './StrategicActionPlanEditor';

const SPACES = [
  { key: 'configuration', label: '1. PED', icon: <Settings /> },
  { key: 'planning', label: '2. Campos', icon: <AccountTree /> },
  { key: 'references', label: '3. Dependencias', icon: <AssignmentTurnedIn /> },
  { key: 'actions', label: '4. Planes de Acción', icon: <AssignmentTurnedIn /> },
  { key: 'monitoring', label: 'Informes', icon: <Timeline /> },
  { key: 'budget', label: 'Presupuesto', icon: <Payments /> },
  { key: 'analytics', label: 'Resultados', icon: <Analytics /> }
];

const TERM_STATUS_LABEL = {
  active: 'Activa', closed: 'Cerrada', planned: 'Programada', draft: 'Borrador', inactive: 'Eliminada'
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
    <Box>{step && <Typography variant="overline" color="primary" fontWeight={900} letterSpacing={1}>{`PASO ${step} DE 4`}</Typography>}<Typography variant="h5" fontWeight={900}>{title}</Typography>{description && <Typography color="text.secondary" mt={0.25}>{description}</Typography>}</Box>
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
  const [termForm, setTermForm] = useState({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned' });
  const [fieldForm, setFieldForm] = useState({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '' });
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
  const terms = plan?.terms || [];
  const selectedTerm = terms.find((term) => String(term.id) === String(form.term_id));
  const units = (plan?.catalogItems || []).filter((item) => ['dependency', 'organizational_unit'].includes(item.catalog_type) && item.active);
  const visiblePlans = plans.filter((item) => item.term?.strategicPlan?.id === plan?.id);
  const actionTerms = [...terms].filter((term) => term.status !== 'inactive').sort((a, b) => a.year - b.year);
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

  const saveTerm = async () => {
    if (!termForm.year || !termForm.starts_on || !termForm.ends_on) return enqueueSnackbar('Complete el año y sus fechas.', { variant: 'warning' });
    setSaving(true);
    try {
      const payload = { year: Number(termForm.year), name: `Año ${termForm.year}`, starts_on: termForm.starts_on, ends_on: termForm.ends_on, status: termForm.status };
      if (termForm.id) await strategicPlanningService.updateTerm(termForm.id, { ...payload, justification: 'Edición desde configuración' });
      else {
        const year = Number(termForm.year);
        await strategicPlanningService.createTerm(plan.id, { ...payload, periods: [
          { code: 'S1', name: 'Seguimiento 1', starts_on: `${year}-01-01`, ends_on: `${year}-06-30`, weight: 0.5, status: termForm.status },
          { code: 'S2', name: 'Seguimiento 2 / Cierre', starts_on: `${year}-07-01`, ends_on: `${year}-12-31`, weight: 0.5, status: termForm.status }
        ] });
      }
      const wasEditing = Boolean(termForm.id); setOpenTerm(false); setTermForm({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned' }); await load();
      enqueueSnackbar(wasEditing ? 'Año actualizado.' : 'Año y periodos creados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el año.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const saveField = async () => {
    if (!fieldForm.key.trim() || !fieldForm.label.trim() || !fieldForm.data_type) return enqueueSnackbar('Complete nombre, código y tipo del campo.', { variant: 'warning' });
    setSaving(true);
    try {
      const payload = { key: fieldForm.key, label: fieldForm.label, data_type: fieldForm.data_type, required: fieldForm.required, options: fieldForm.options_text.split('\n').map((item) => item.trim()).filter(Boolean), formula: fieldForm.formula || null, validation_rules: fieldForm.catalog_type ? { catalog_type: fieldForm.catalog_type } : {} };
      if (fieldForm.id) await strategicPlanningService.updateField(plan.id, fieldForm.id, { ...payload, justification: 'Edición desde constructor de campos' });
      else await strategicPlanningService.createField(plan.id, payload);
      const wasEditing = Boolean(fieldForm.id); setOpenField(false); setFieldForm({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '' }); await load();
      enqueueSnackbar(wasEditing ? 'Campo actualizado.' : 'Campo agregado al Plan de Acción.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el campo.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const openFieldEditor = (field) => {
    setFieldForm({ id: field.id, key: field.key, label: field.label, data_type: field.data_type, required: field.required, options_text: (field.options || []).join('\n'), formula: field.formula || '', catalog_type: field.validation_rules?.catalog_type || '' });
    setOpenField(true);
  };

  const deleteField = async (field) => {
    if (!window.confirm(`¿Eliminar el campo "${field.label}" de las nuevas versiones del Plan de Acción?`)) return;
    try { await strategicPlanningService.deleteField(plan.id, field.id); await load(); enqueueSnackbar('Campo eliminado sin alterar planes anteriores.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el campo.', { variant: 'error' }); }
  };

  const previewFieldSchema = async (file) => {
    if (!file) return;
    const body = new FormData(); body.append('file', file);
    try {
      const response = await strategicPlanningService.previewFieldSchema(plan.id, body);
      setFieldSchemaPreview({ ...response.data, fields: response.data.parsed_data?.fields || [] });
      setReplaceSchemaFields(false);
      enqueueSnackbar(`Se detectaron ${response.data.summary?.detected || 0} columnas. Revíselas antes de continuar.`, { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible leer los encabezados del Excel.', { variant: 'error' }); }
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
            <Chip label="NUEVA PLATAFORMA · INDEPENDIENTE" sx={{ mb: 1.5, ml: onBack ? { xs: 0, sm: 1 } : 0, color: 'white', border: '1px solid rgba(255,255,255,.4)', fontWeight: 800 }} />
            <Typography sx={{ fontSize: { xs: 24, sm: 28, lg: 32 }, lineHeight: 1.15, fontWeight: 950, maxWidth: 1050 }}>Gestión, Seguimiento y Evaluación de la Planeación Estratégica Institucional</Typography>
            <Typography sx={{ mt: 1, opacity: .9, fontSize: { xs: 14, sm: 16 } }}>{pedWorkspaceOpen ? `${plan.name} · Fuente oficial SIAC · Expediente definitivo en Drive` : 'Cree un nuevo PED o continúe trabajando en uno existente.'}</Typography>
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
        <SectionHeader step="2" title="Diseñe las columnas de este PED" description="Cada PED puede tener campos diferentes. No es obligatorio usar objetivos ni lineamientos." action={<Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button component="label" variant="contained" startIcon={<UploadFile />}>Leer columnas de un Excel<input hidden type="file" accept=".xlsx" onChange={(event) => { previewFieldSchema(event.target.files?.[0]); event.target.value = ''; }} /></Button><Button variant="outlined" startIcon={<Add />} onClick={() => { setFieldForm({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '' }); setOpenField(true); }}>Agregar campo manual</Button></Stack>} />

        <Alert severity="info" sx={{ mb: 2, borderRadius: 2.5 }}><strong>Ejemplo:</strong> en el formato 2026 el sistema puede convertir “Objetivos Estratégicos”, “Actividades”, “Indicador”, “Meta” y “Observaciones” en campos. En otro PED podrá leer nombres completamente diferentes.</Alert>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3,1fr)' }, gap: 1.25, mb: 2.5 }}>
          {[
            ['1', 'Seleccione el Excel', 'Puede usar el formato actual; el sistema busca automáticamente la fila de encabezados.'],
            ['2', 'Revise las columnas', 'Quite las que no necesita y cambie el nombre, el tipo de dato o si es obligatorio.'],
            ['3', 'Cree la tabla dinámica', 'Los mismos campos se usarán en la interfaz y en la plantilla de carga masiva.']
          ].map(([number, title, text]) => <Paper key={number} variant="outlined" sx={{ p: 1.75, borderRadius: 3, bgcolor: '#fbfdff' }}><Stack direction="row" gap={1.1}><Box sx={{ width: 30, height: 30, flex: '0 0 30px', borderRadius: '50%', bgcolor: '#eaf2ff', color: '#2563eb', display: 'grid', placeItems: 'center', fontWeight: 950 }}>{number}</Box><Box><Typography fontWeight={900}>{title}</Typography><Typography variant="body2" color="text.secondary" mt={0.25}>{text}</Typography></Box></Stack></Paper>)}
        </Box>

        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ px: { xs: 2, md: 2.5 }, py: 2, borderBottom: '1px solid #e2e8f0' }}><Box><Typography variant="h6" fontWeight={950}>Columnas configuradas</Typography><Typography variant="body2" color="text.secondary">{activeFieldDefinitions.length ? `${activeFieldDefinitions.length} campos formarán la tabla de captura de este PED.` : 'Aún no hay campos. Importe un Excel o cree el primero manualmente.'}</Typography></Box><Chip color={activeFieldDefinitions.length ? 'success' : 'default'} label={activeFieldDefinitions.length ? 'Tabla lista' : 'Pendiente'} sx={{ fontWeight: 850 }} /></Stack>
          {!activeFieldDefinitions.length ? <Box sx={{ px: 2, py: 5, textAlign: 'center' }}><Description color="primary" sx={{ fontSize: 44 }} /><Typography fontWeight={900} mt={1}>Comience con el Excel que ya utiliza</Typography><Typography variant="body2" color="text.secondary" mb={2}>No tiene que escribir todos los nombres nuevamente.</Typography><Button component="label" variant="contained" startIcon={<UploadFile />}>Seleccionar formato Excel<input hidden type="file" accept=".xlsx" onChange={(event) => { previewFieldSchema(event.target.files?.[0]); event.target.value = ''; }} /></Button></Box> :
            <TableContainer sx={{ maxHeight: 520 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Orden</TableCell><TableCell>Nombre visible</TableCell><TableCell>Tipo de información</TableCell><TableCell>Obligatorio</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{[...activeFieldDefinitions].sort((a,b) => a.position-b.position).map((field) => <TableRow key={field.id} hover><TableCell>{field.position}</TableCell><TableCell><Typography fontWeight={850}>{field.label}</Typography><Typography variant="caption" color="text.secondary">{field.key}</Typography></TableCell><TableCell><Chip size="small" variant="outlined" label={FIELD_TYPE_LABEL[field.data_type] || field.data_type} /></TableCell><TableCell>{field.required ? 'Sí' : 'No'}</TableCell><TableCell align="right"><Button size="small" onClick={() => openFieldEditor(field)}>Editar</Button><Button size="small" color="error" onClick={() => deleteField(field)}>Quitar</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
        </Paper>

        <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3, overflow: 'hidden', borderColor: '#dbeafe' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5} sx={{ p: 2.25, bgcolor: '#f8fbff', borderBottom: '1px solid #dbeafe' }}><Box><Typography variant="h6" fontWeight={950}>Listas precargadas del formulario</Typography><Typography variant="body2" color="text.secondary">Aquí define las opciones que después aparecerán como listas al registrar cada actividad.</Typography></Box><Button variant="outlined" startIcon={<Add />} onClick={() => { setFieldForm({ id: null, key: '', label: '', data_type: 'list', required: false, options_text: '', formula: '', catalog_type: '' }); setOpenField(true); }}>Crear campo con lista</Button></Stack>
          {!choiceFieldDefinitions.length ? <Box sx={{ p: 3, textAlign: 'center' }}><Typography fontWeight={900}>Todavía no hay campos con opciones</Typography><Typography variant="body2" color="text.secondary">Cree un campo de tipo “Lista desplegable” o “Referencia institucional”.</Typography></Box> : <Box sx={{ p: 2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))', xl: 'repeat(3,minmax(0,1fr))' }, gap: 1.25 }}>
            {choiceFieldDefinitions.map((field) => {
              const catalogType = field.validation_rules?.catalog_type;
              const choices = catalogType ? (plan.catalogItems || []).filter((item) => item.catalog_type === catalogType && item.active) : (field.options || []);
              return <Paper key={field.id} elevation={0} sx={{ p: 1.75, borderRadius: 2.75, border: '1px solid #e2e8f0', bgcolor: '#fff' }}><Stack direction="row" justifyContent="space-between" gap={1}><Box sx={{ minWidth: 0 }}><Typography fontWeight={950}>{field.label}</Typography><Typography variant="caption" color="text.secondary">{catalogType ? 'Tabla reutilizable' : 'Lista propia'} · {choices.length} opciones</Typography></Box><Chip size="small" color={choices.length ? 'success' : 'warning'} label={choices.length ? 'Lista lista' : 'Sin opciones'} /></Stack><Stack direction="row" gap={0.6} flexWrap="wrap" mt={1.25} minHeight={28}>{choices.slice(0, 4).map((option) => <Chip key={option.id || option} size="small" variant="outlined" label={option.name || option} />)}{choices.length > 4 && <Chip size="small" label={`+${choices.length - 4}`} />}</Stack><Button fullWidth size="small" variant="outlined" sx={{ mt: 1.4, borderRadius: 2, textTransform: 'none', fontWeight: 850 }} onClick={() => { if (catalogType) { setManagedListFieldId(field.id); setCatalogType(catalogType); setEditingReferenceId(null); setNewReference({ code: '', name: '' }); } else openFieldEditor(field); }}>{catalogType ? 'Administrar opciones' : 'Editar opciones'}</Button></Paper>;
            })}
          </Box>}
        </Paper>

        {managedListField && managedCatalogType && <Paper variant="outlined" sx={{ mt: 2, p: 2.25, borderRadius: 3, borderColor: '#c4b5fd', bgcolor: '#fcfbff' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" gap={1} mb={2}><Box><Typography variant="h6" fontWeight={950}>Opciones de “{managedListField.label}”</Typography><Typography variant="body2" color="text.secondary">Todo registro activo aparecerá automáticamente en el formulario y en el Excel dinámico.</Typography></Box><Button size="small" onClick={() => setManagedListFieldId('')}>Cerrar</Button></Stack><Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(150px,.35fr) minmax(260px,1fr) auto' }, gap: 1.25 }}><TextField size="small" disabled label="Código automático" value={newReference.code} /><TextField size="small" label="Nombre de la opción" value={newReference.name} onChange={(event) => { const name = event.target.value; const code = editingReferenceId ? newReference.code : name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50); setNewReference({ code, name }); }} /><Button variant="contained" startIcon={<Add />} disabled={!newReference.code.trim() || !newReference.name.trim()} onClick={saveReference}>{editingReferenceId ? 'Guardar cambio' : 'Agregar opción'}</Button></Box><TableContainer sx={{ mt: 1.5, maxHeight: 280 }}><Table size="small" stickyHeader><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Opción</TableCell><TableCell>Estado</TableCell><TableCell align="right">Acciones</TableCell></TableRow></TableHead><TableBody>{managedCatalogItems.sort((a,b) => a.name.localeCompare(b.name,'es')).map((item) => <TableRow key={item.id}><TableCell>{item.code}</TableCell><TableCell><Typography fontWeight={800}>{item.name}</Typography></TableCell><TableCell><Chip size="small" color={item.active ? 'success' : 'default'} label={item.active ? 'Visible' : 'Oculta'} /></TableCell><TableCell align="right"><Button size="small" onClick={() => { setEditingReferenceId(item.id); setNewReference({ code: item.code, name: item.name }); }}>Editar</Button><Button size="small" color={item.active ? 'warning' : 'success'} onClick={() => toggleReference(item)}>{item.active ? 'Ocultar' : 'Mostrar'}</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper>}
        <StepNavigation onBack={() => setSpace('configuration')} onNext={activeFieldDefinitions.length ? () => setSpace('references') : null} nextLabel="Continuar a dependencias" />
      </Box>}

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
              ['Inicio', plan.starts_on, <CalendarMonth fontSize="small" />],
              ['Finaliza', plan.ends_on, <CalendarMonth fontSize="small" />],
              ['Vigencias', terms.length, <Timeline fontSize="small" />]
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
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ p: 2 }}><Typography variant="h6" fontWeight={900}>Vigencias e informes S1–S2</Typography><Button variant="outlined" startIcon={<Add />} onClick={() => { setTermForm({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned' }); setOpenTerm(true); }}>Agregar año excepcional</Button></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Año</TableCell><TableCell>Estado</TableCell><TableCell>Informes</TableCell><TableCell>Conservación</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{[...terms].filter((term) => term.status !== 'inactive').sort((a,b) => a.year-b.year).map((term) => <TableRow key={term.id}><TableCell>{term.year}</TableCell><TableCell><Chip size="small" color={term.status === 'active' ? 'success' : 'default'} label={TERM_STATUS_LABEL[term.status] || term.status} /></TableCell><TableCell>{term.monitoringPeriods?.map((p) => p.code).join(' y ')}</TableCell><TableCell>Historial permanente</TableCell><TableCell><Button size="small" onClick={() => { setTermForm({ id: term.id, year: term.year, starts_on: term.starts_on, ends_on: term.ends_on, status: term.status }); setOpenTerm(true); }}>Editar</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper>
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
        <SectionHeader step="4" title="Planes de Acción por vigencia" description="Seleccione primero un año. Después cree o abra el plan de cada dependencia." />

        <Paper variant="outlined" sx={{ p: { xs: 1.75, md: 2.25 }, borderRadius: 3.5, borderColor: '#dbe3ee', bgcolor: '#fff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} mb={2}><Box><Typography variant="h6" fontWeight={950}>1. Seleccione el año de ejecución</Typography><Typography variant="body2" color="text.secondary">Cada vigencia conserva sus propios Planes de Acción.</Typography></Box><Chip variant="outlined" color="primary" label={`${actionTerms.length} vigencias`} sx={{ fontWeight: 850 }} /></Stack>
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
              return <Paper key={term.id} component="button" type="button" onClick={() => { setSelectedActionTermId(term.id); setDependencySearch(''); }} elevation={0} sx={{ appearance: 'none', font: 'inherit', textAlign: 'left', cursor: 'pointer', minWidth: { xs: 190, md: 0 }, p: 1.6, borderRadius: 2.75, border: '1px solid', borderColor: selected ? '#2563eb' : '#dce3ed', bgcolor: selected ? '#eff6ff' : '#fff', boxShadow: selected ? '0 8px 20px rgba(37,99,235,.12)' : 'none', transition: 'all .2s', '&:hover': { borderColor: '#60a5fa', transform: 'translateY(-2px)' } }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start"><Box><Typography variant="caption" color={selected ? 'primary' : 'text.secondary'} fontWeight={900}>VIGENCIA</Typography><Typography sx={{ fontSize: 26, lineHeight: 1.1, fontWeight: 950 }}>{term.year}</Typography></Box><Box sx={{ width: 34, height: 34, borderRadius: 2, bgcolor: selected ? '#2563eb' : '#f1f5f9', color: selected ? '#fff' : '#64748b', display: 'grid', placeItems: 'center' }}><CalendarMonth fontSize="small" /></Box></Stack>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1.5} mb={0.7}><Typography variant="caption" fontWeight={850}>{createdPlansCount} de {expectedPlansCount} planes</Typography><Chip size="small" color={term.status === 'active' ? 'success' : 'default'} label={TERM_STATUS_LABEL[term.status] || term.status} sx={{ height: 21, fontSize: 11 }} /></Stack><LinearProgress variant="determinate" value={percentage} sx={{ height: 6, borderRadius: 10, bgcolor: '#e2e8f0' }} />
              </Paper>;
            })}
          </Box>}
        </Paper>

        {selectedActionTerm && <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3.5, overflow: 'hidden', borderColor: '#dbe3ee' }}>
          <Box sx={{ px: { xs: 1.75, md: 2.5 }, py: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" alignItems={{ lg: 'center' }} gap={1.5}>
              <Box>
                <Typography variant="h6" fontWeight={950}>2. Dependencias de la vigencia {selectedActionTerm.year}</Typography>
                <Typography variant="body2" color="text.secondary">Seleccione una dependencia para crear o gestionar su Plan de Acción.</Typography>
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
              return <Paper key={unit.id} elevation={0} sx={{ p: 1.75, borderRadius: 2.75, border: '1px solid', borderColor: actionPlan ? '#bbf7d0' : '#e2e8f0', bgcolor: actionPlan ? '#f7fef9' : '#fff', display: 'flex', flexDirection: 'column', minHeight: 188 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}><Box sx={{ width: 38, height: 38, flex: '0 0 38px', borderRadius: 2, bgcolor: actionPlan ? '#dcfce7' : '#eff6ff', color: actionPlan ? '#15803d' : '#2563eb', display: 'grid', placeItems: 'center' }}><AccountTree fontSize="small" /></Box><Chip size="small" color={actionPlan ? 'success' : 'default'} variant={actionPlan ? 'filled' : 'outlined'} label={actionPlan ? 'Plan creado' : 'Pendiente'} sx={{ fontWeight: 850 }} /></Stack>
                <Typography fontWeight={950} mt={1.2} lineHeight={1.3}>{unit.name}</Typography><Typography variant="caption" color="text.secondary">{unit.code}</Typography>
                <Box sx={{ flex: 1, mt: 1 }}>{actionPlan ? <><Typography variant="caption" color="text.secondary">{actionPlan.code} · {actionPlan.items?.length || 0} registros</Typography><Typography variant="caption" display="block" color="text.secondary" noWrap>{actionPlan.responsibleUser?.nombre || 'Sin líder asignado'}</Typography></> : <Typography variant="caption" color="text.secondary">{suggestedLeader ? `Responsable: ${suggestedLeader.name}` : 'Configure primero el responsable de esta vigencia.'}</Typography>}</Box>
                {actionPlan ? <Stack direction="row" gap={0.75} mt={1.25}><Button fullWidth size="small" variant="contained" onClick={() => setEditorPlanId(actionPlan.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>Abrir plan</Button><Button size="small" variant="outlined" onClick={() => setTransfer({ plan: actionPlan, user_id: '', reason: '' })} sx={{ minWidth: 42, borderRadius: 2 }}><SwapHoriz fontSize="small" /></Button></Stack> : <Button fullWidth size="small" variant="outlined" startIcon={<Add />} disabled={selectedActionTerm.status === 'closed'} onClick={() => openActionPlanCreation(selectedActionTerm, unit)} sx={{ mt: 1.25, borderRadius: 2, textTransform: 'none', fontWeight: 900 }}>{selectedActionTerm.status === 'closed' ? 'Vigencia cerrada' : 'Crear Plan de Acción'}</Button>}
              </Paper>;
            })}
          </Box> : <Box sx={{ bgcolor: '#f6f9fd' }}>
            <Box sx={{ height: 4, background: 'linear-gradient(90deg,#204698,#2563eb 58%,#593cf0)' }} />
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ px: 2.25, py: 1.15, bgcolor: '#fff', borderBottom: '1px solid #dbe5f0' }}>
              <Typography variant="body2" color="#52657b"><strong>{visibleActionUnits.length}</strong> dependencias encontradas</Typography>
              <Typography variant="caption" color="#718096">Vigencia {selectedActionTerm.year}</Typography>
            </Stack>
            <TableContainer sx={{ maxHeight: 650 }}>
            <Table stickyHeader size="small" sx={{ minWidth: 1570, tableLayout: 'fixed', '& td, & th': { borderRight: '1px solid #e1e9f2' }, '& td:last-of-type, & th:last-of-type': { borderRight: 0 } }}>
              <TableHead>
                <TableRow>
                  {[
                    ['Dependencia', 250], ['Código', 95], ['Responsable', 235], ['Cédula', 135], ['Cargo', 220],
                    ['Correo', 245], ['Estado', 130], ['Registros', 100], ['Acción', 220]
                  ].map(([heading, width]) => <TableCell key={heading} align={['Registros', 'Acción'].includes(heading) ? 'center' : 'left'} sx={{ width, bgcolor: '#244f91', color: '#ffffff', fontWeight: 950, fontSize: 11.5, letterSpacing: '.055em', textTransform: 'uppercase', whiteSpace: 'nowrap', py: 1.45, borderBottom: '1px solid #173b73', borderRightColor: 'rgba(255,255,255,.16) !important' }}>{heading}</TableCell>)}
                </TableRow>
              </TableHead>
              <TableBody>
                {visibleActionUnits.map((unit) => {
                  const actionPlan = selectedYearPlans.find((item) => String(item.catalog_item_id || item.organizationalUnit?.id) === String(unit.id));
                  const responsible = unit.annualAssignment?.responsible || {};
                  const responsibleName = responsible.name || actionPlan?.responsibleUser?.nombre || 'Sin responsable';
                  const initials = responsibleName === 'Sin responsable' ? '—' : responsibleName.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join('').toUpperCase();
                  return <TableRow key={unit.id} hover sx={{ bgcolor: '#ffffff', '&:nth-of-type(even)': { bgcolor: '#f9fbfe' }, '&:hover': { bgcolor: '#eef6ff !important' }, '& td': { py: 1.45, borderBottom: '1px solid #dfe7f0', verticalAlign: 'middle' } }}>
                    <TableCell><Stack direction="row" alignItems="center" gap={1.15}><Box sx={{ width: 34, height: 34, flex: '0 0 34px', borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: actionPlan ? '#dcfce7' : '#e8f2ff', color: actionPlan ? '#15803d' : '#2563eb' }}><AccountTree sx={{ fontSize: 19 }} /></Box><Box minWidth={0}><Typography fontWeight={900} fontSize={13.5} lineHeight={1.25} title={unit.name}>{unit.name}</Typography><Typography variant="caption" color="text.secondary" noWrap display="block" title={responsible.dependency || ''}>{responsible.dependency || 'Unidad institucional'}</Typography></Box></Stack></TableCell>
                    <TableCell><Chip size="small" label={unit.code || '—'} sx={{ height: 25, bgcolor: '#edf3fa', color: '#425b78', fontWeight: 900, borderRadius: 1.5 }} /></TableCell>
                    <TableCell><Stack direction="row" alignItems="center" gap={1}><Box sx={{ width: 31, height: 31, flex: '0 0 31px', borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: '#e9edff', color: '#455db5', fontWeight: 950, fontSize: 10.5 }}>{initials}</Box><Typography fontWeight={850} fontSize={12.8} lineHeight={1.3}>{responsibleName}</Typography></Stack></TableCell>
                    <TableCell sx={{ fontFamily: 'monospace', fontWeight: 750, color: '#42566f' }}>{responsible.document || '—'}</TableCell>
                    <TableCell><Typography fontSize={12.8} lineHeight={1.35}>{responsible.position || actionPlan?.responsibleUser?.cargo || '—'}</Typography></TableCell>
                    <TableCell><Typography component={responsible.email || actionPlan?.responsibleUser?.email ? 'a' : 'span'} href={(responsible.email || actionPlan?.responsibleUser?.email) ? `mailto:${responsible.email || actionPlan?.responsibleUser?.email}` : undefined} fontSize={12.5} color="#315f9d" sx={{ textDecoration: 'none', '&:hover': { textDecoration: 'underline' }, wordBreak: 'break-word' }}>{responsible.email || actionPlan?.responsibleUser?.email || '—'}</Typography></TableCell>
                    <TableCell><Chip size="small" color={actionPlan ? 'success' : 'default'} variant={actionPlan ? 'filled' : 'outlined'} label={actionPlan ? 'Plan creado' : 'Pendiente'} sx={{ fontWeight: 850 }} /></TableCell>
                    <TableCell align="center"><Box sx={{ width: 32, height: 32, mx: 'auto', borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: actionPlan?.items?.length ? '#e8f2ff' : '#f1f5f9', color: actionPlan?.items?.length ? '#245ab5' : '#64748b', fontWeight: 950 }}>{actionPlan?.items?.length || 0}</Box></TableCell>
                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>{actionPlan ? <Stack direction="row" justifyContent="center" gap={0.75}><Button size="small" variant="contained" onClick={() => setEditorPlanId(actionPlan.id)} sx={{ minWidth: 112, height: 36, borderRadius: 1.75, textTransform: 'none', fontWeight: 900 }}>Abrir plan</Button><Button size="small" variant="outlined" title="Cambiar responsable" onClick={() => setTransfer({ plan: actionPlan, user_id: '', reason: '' })} sx={{ minWidth: 40, width: 40, height: 36, borderRadius: 1.75 }}><SwapHoriz fontSize="small" /></Button></Stack> : <Button size="small" variant="outlined" startIcon={<Add />} disabled={selectedActionTerm.status === 'closed'} onClick={() => openActionPlanCreation(selectedActionTerm, unit)} sx={{ minWidth: 160, height: 36, borderRadius: 1.75, textTransform: 'none', fontWeight: 900 }}>{selectedActionTerm.status === 'closed' ? 'Vigencia cerrada' : 'Crear plan'}</Button>}</TableCell>
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
        <SectionHeader title="Diligencie los informes semestrales" description="Abra un plan y registre sus avances y evidencias en S1 o S2." />
        {!visiblePlans.length ? <Alert severity="warning">Todavía no hay Planes de Acción para este PED.</Alert> : <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Año</TableCell><TableCell>Dependencia</TableCell><TableCell>Plan de Acción</TableCell><TableCell>Actividades</TableCell><TableCell>Avance general</TableCell><TableCell /></TableRow></TableHead><TableBody>{visiblePlans.map((actionPlan) => { const actionItems=actionPlan.items || []; const progress=actionItems.length ? actionItems.reduce((sum, row) => sum + Number(row.current_progress || 0), 0) / actionItems.length : 0; return <TableRow key={actionPlan.id}><TableCell>{actionPlan.term?.year}</TableCell><TableCell>{actionPlan.organizationalUnit?.name}</TableCell><TableCell><Typography fontWeight={800}>{actionPlan.title}</Typography><Typography variant="caption">{actionPlan.code}</Typography></TableCell><TableCell>{actionItems.length}</TableCell><TableCell sx={{ minWidth: 160 }}><Typography variant="body2" fontWeight={800}>{progress.toFixed(1)}%</Typography><LinearProgress variant="determinate" value={progress} /></TableCell><TableCell><Button variant="contained" size="small" onClick={() => setEditorPlanId(actionPlan.id)}>Llenar informe</Button></TableCell></TableRow>; })}</TableBody></Table></TableContainer>}
        {!!syncJobs.length && <Alert severity="success" icon={<Folder />} sx={{ mt: 2 }}>Las evidencias se conservan y se sincronizan automáticamente con el expediente institucional.</Alert>}
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

      <Dialog open={Boolean(fieldSchemaPreview)} onClose={() => !saving && setFieldSchemaPreview(null)} fullWidth maxWidth="lg" PaperProps={{ sx: { borderRadius: 3.5, maxHeight: '92vh' } }}>
        <DialogTitle sx={{ px: { xs: 2, md: 3 }, pt: 2.5, pb: 1 }}><Typography variant="h5" fontWeight={950}>Revise las columnas encontradas</Typography><Typography variant="body2" color="text.secondary" mt={0.5}>Hoja “{fieldSchemaPreview?.parsed_data?.sheet_name}”, encabezados en la fila {fieldSchemaPreview?.parsed_data?.header_row}. Nada se guardará hasta que pulse Crear tabla.</Typography></DialogTitle>
        <DialogContent sx={{ px: { xs: 2, md: 3 }, pt: '14px !important' }}>
          <Alert severity="info" sx={{ mb: 2 }}>Active únicamente las columnas que desea diligenciar. Puede cambiar sus nombres y tipos; “No.” se reconoce como consecutivo automático y no necesita crearlo.</Alert>
          <Stack spacing={1.1}>
            {(fieldSchemaPreview?.fields || []).map((field, index) => <Paper key={`${field.source_column}-${field.key}`} variant="outlined" sx={{ p: 1.4, borderRadius: 2.5, opacity: field.include && !field.system ? 1 : 0.62, bgcolor: field.include && !field.system ? '#fff' : '#f8fafc' }}>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '125px minmax(220px,1.4fr) minmax(190px,1fr) minmax(160px,.8fr)' }, gap: 1.25, alignItems: 'center' }}>
                <FormControlLabel control={<Switch checked={field.include && !field.system} disabled={field.system} onChange={(event) => updatePreviewField(index, { include: event.target.checked })} />} label={field.system ? 'Automático' : 'Usar campo'} />
                <TextField size="small" label="Nombre visible" value={field.label} disabled={field.system || !field.include} onChange={(event) => updatePreviewField(index, { label: event.target.value })} />
                <TextField size="small" select label="Tipo de información" value={field.data_type} disabled={field.system || !field.include} onChange={(event) => updatePreviewField(index, { data_type: event.target.value })}>{Object.entries(FIELD_TYPE_LABEL).filter(([value]) => value !== 'strategic_relation').map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField>
                <Box><FormControlLabel control={<Switch checked={field.required === true} disabled={field.system || !field.include} onChange={(event) => updatePreviewField(index, { required: event.target.checked })} />} label="Obligatorio" />{field.sample_values?.length > 0 && <Typography variant="caption" color="text.secondary" display="block" noWrap title={field.sample_values.join(' · ')}>Ejemplo: {field.sample_values.join(' · ')}</Typography>}</Box>
              </Box>
            </Paper>)}
          </Stack>
          {!!activeFieldDefinitions.length && <Paper variant="outlined" sx={{ p: 1.5, mt: 2, borderRadius: 2.5, bgcolor: '#fffbeb', borderColor: '#fde68a' }}><FormControlLabel control={<Switch checked={replaceSchemaFields} onChange={(event) => setReplaceSchemaFields(event.target.checked)} />} label="Reemplazar el diseño actual por estas columnas" /><Typography variant="caption" color="text.secondary" display="block">Si lo deja desactivado, las columnas importadas se agregarán o actualizarán sin retirar las existentes. El historial ya diligenciado siempre se conserva.</Typography></Paper>}
        </DialogContent>
        <DialogActions sx={{ px: { xs: 2, md: 3 }, py: 2 }}><Button onClick={() => setFieldSchemaPreview(null)} disabled={saving}>Cancelar</Button><Button variant="contained" onClick={confirmFieldSchema} disabled={saving || !(fieldSchemaPreview?.fields || []).some((field) => field.include && !field.system)} sx={{ px: 3, borderRadius: 2.5, fontWeight: 900 }}>{saving ? 'Creando tabla…' : `Crear tabla con ${(fieldSchemaPreview?.fields || []).filter((field) => field.include && !field.system).length} campos`}</Button></DialogActions>
      </Dialog>

      <Dialog open={openField} onClose={() => setOpenField(false)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={900}>{fieldForm.id ? 'Editar campo del Plan de Acción' : 'Agregar campo al Plan de Acción'}</DialogTitle>
        <DialogContent><Grid container spacing={2} mt={0.25}>
          <Grid item xs={12} md={7}><TextField required fullWidth label="Nombre que verá el usuario" placeholder="Por ejemplo: Resultado esperado" value={fieldForm.label} onChange={(e) => { const label=e.target.value; setFieldForm({ ...fieldForm, label, key: fieldForm.id ? fieldForm.key : label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') }); }} /></Grid>
          <Grid item xs={12} md={5}><TextField required fullWidth disabled={Boolean(fieldForm.id)} label="Código interno" value={fieldForm.key} onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })} /></Grid>
          <Grid item xs={12} md={7}><TextField required fullWidth select label="Tipo de información" value={fieldForm.data_type} onChange={(e) => setFieldForm({ ...fieldForm, data_type: e.target.value, catalog_type: ['catalog','catalog_multi'].includes(e.target.value) ? fieldForm.catalog_type : '', options_text: e.target.value === 'list' ? fieldForm.options_text : '' })}>{Object.entries(FIELD_TYPE_LABEL).map(([value,label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={5}><FormControlLabel control={<Switch checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} />} label="Campo obligatorio" /></Grid>
          {fieldForm.data_type === 'list' && <Grid item xs={12}><Alert severity="info" sx={{ mb: 1.25 }}>Use esta opción para una lista exclusiva de este campo. Por ejemplo: Gestión, Resultado, Producto e Impacto.</Alert><TextField fullWidth multiline minRows={5} label="Opciones que aparecerán en el formulario" placeholder={'Gestión\nResultado\nProducto\nImpacto'} helperText="Escriba una opción por línea. Se mostrarán automáticamente como una lista desplegable." value={fieldForm.options_text} onChange={(e) => setFieldForm({ ...fieldForm, options_text: e.target.value })} /></Grid>}
          {['catalog','catalog_multi'].includes(fieldForm.data_type) && <Grid item xs={12}><Alert severity="info" sx={{ mb: 1.25 }}>Use una tabla reutilizable cuando varias partes del PED deban compartir y actualizar las mismas opciones.</Alert><Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><TextField fullWidth select label="Tabla que alimentará este campo" value={fieldForm.catalog_type} onChange={(e) => setFieldForm({ ...fieldForm, catalog_type: e.target.value })} helperText="Los registros activos aparecerán automáticamente."><MenuItem value="">Seleccione una tabla</MenuItem>{catalogOptions.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField><Button variant="outlined" startIcon={<Add />} onClick={() => setOpenCatalog(true)} sx={{ minWidth: 190, alignSelf: 'flex-start', minHeight: 56 }}>Crear nueva tabla</Button></Stack></Grid>}
          {fieldForm.data_type === 'formula' && <Grid item xs={12}><TextField fullWidth label="Fórmula" placeholder="avance_periodo_1 + avance_periodo_2" value={fieldForm.formula} onChange={(e) => setFieldForm({ ...fieldForm, formula: e.target.value })} /></Grid>}
          <Grid item xs={12}><Alert severity="info">Este campo se aplicará a los nuevos Planes de Acción del PED seleccionado. Las versiones anteriores conservarán su estructura.</Alert></Grid>
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setOpenField(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !fieldForm.key.trim() || !fieldForm.label.trim()} onClick={saveField}>{saving ? 'Guardando…' : fieldForm.id ? 'Actualizar campo' : 'Crear campo'}</Button></DialogActions>
      </Dialog>

      <Dialog open={openTerm} onClose={() => setOpenTerm(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={900}>{termForm.id ? 'Editar año del PED' : 'Agregar año al PED'}</DialogTitle>
        <DialogContent><Grid container spacing={2} mt={0.25}>
          <Grid item xs={12} md={6}><TextField required fullWidth type="number" label="Año" value={termForm.year} onChange={(e) => { const year = e.target.value; setTermForm({ ...termForm, year, starts_on: termForm.id ? termForm.starts_on : `${year}-01-01`, ends_on: termForm.id ? termForm.ends_on : `${year}-12-31` }); }} /></Grid>
          <Grid item xs={12} md={6}><TextField select fullWidth label="Estado" value={termForm.status} onChange={(e) => setTermForm({ ...termForm, status: e.target.value })}><MenuItem value="planned">Programada</MenuItem><MenuItem value="active">Activa</MenuItem><MenuItem value="closed">Cerrada</MenuItem></TextField></Grid>
          <Grid item xs={12} md={6}><TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha inicial" value={termForm.starts_on} onChange={(e) => setTermForm({ ...termForm, starts_on: e.target.value })} /></Grid>
          <Grid item xs={12} md={6}><TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha final" value={termForm.ends_on} onChange={(e) => setTermForm({ ...termForm, ends_on: e.target.value })} /></Grid>
          {!termForm.id && <Grid item xs={12}><Alert severity="info">Se crearán inicialmente dos periodos: Seguimiento 1 (enero–junio) y Seguimiento 2 / Cierre (julio–diciembre).</Alert></Grid>}
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setOpenTerm(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !termForm.year || !termForm.starts_on || !termForm.ends_on} onClick={saveTerm}>{saving ? 'Guardando…' : termForm.id ? 'Actualizar año' : 'Crear año'}</Button></DialogActions>
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
                <TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha inicial" value={strategicPlanForm.starts_on} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, starts_on: e.target.value })} />
                <TextField required fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha final" value={strategicPlanForm.ends_on} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, ends_on: e.target.value })} />
                <TextField select fullWidth label="Estado del PED" value={strategicPlanForm.status} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, status: e.target.value })}><MenuItem value="draft">Borrador</MenuItem><MenuItem value="active">Activo</MenuItem><MenuItem value="planned">Planeado</MenuItem><MenuItem value="closed">Cerrado / histórico</MenuItem></TextField>
              </Box>
            </Box>

            <Box sx={{ pt: 2.25, borderTop: '1px solid #e2e8f0' }}>
              <Typography variant="subtitle2" fontWeight={900} color="#334155" mb={1.25}>Información administrativa</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.5fr 1fr 1fr' }, gap: 2 }}>
                <TextField fullWidth label="Acto administrativo" placeholder="Ejemplo: Acuerdo 012 de 2029" value={strategicPlanForm.administrative_act} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, administrative_act: e.target.value })} />
                <TextField fullWidth type="date" InputLabelProps={{ shrink: true }} label="Fecha de aprobación" value={strategicPlanForm.approved_on} onChange={(e) => setStrategicPlanForm({ ...strategicPlanForm, approved_on: e.target.value })} />
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
      <StrategicActionPlanEditor open={Boolean(editorPlanId)} planId={editorPlanId} platformPlan={plan} workflow={boot?.workflow} onClose={() => setEditorPlanId(null)} onChanged={load} />
    </Stack>
  );
}
