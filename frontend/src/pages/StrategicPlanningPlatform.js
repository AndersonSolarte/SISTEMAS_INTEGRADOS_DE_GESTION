import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, CircularProgress, Dialog, DialogActions,
  DialogContent, DialogTitle, FormControlLabel, Grid, LinearProgress, MenuItem, Paper, Stack, Switch, Tab, Tabs,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import {
  AccountTree, Add, Analytics, ArrowBack, AssignmentTurnedIn, CalendarMonth, CheckCircleOutline, CloudSync,
  Description, Download, EditOutlined, Folder, LockOutlined, Payments, Settings, SwapHoriz, Timeline, UploadFile
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../services/strategicPlanningService';
import StrategicActionPlanEditor from './StrategicActionPlanEditor';

const SPACES = [
  { key: 'configuration', label: '1. PED', icon: <Settings /> },
  { key: 'planning', label: '2. Estructura', icon: <AccountTree /> },
  { key: 'instrument', label: '3. Formulario', icon: <Description /> },
  { key: 'actions', label: '4. Planes de Acción', icon: <AssignmentTurnedIn /> },
  { key: 'monitoring', label: '5. Informes', icon: <Timeline /> },
  { key: 'budget', label: 'Presupuesto', icon: <Payments /> },
  { key: 'analytics', label: 'Resultados', icon: <Analytics /> }
];

const STATUS_LABEL = {
  convocation: 'Convocatoria', meeting_scheduled: 'Reunión programada', formulation: 'Formulación',
  preliminary_minutes: 'Acta preliminar', technical_review: 'Revisión técnica', adjustments: 'Ajustes',
  owner_validation: 'Validación responsable', rectorate_notification: 'Información a Rectoría',
  active: 'Plan activo', monitoring: 'Seguimientos', closed: 'Cierre de vigencia'
};

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
    <Box>{step && <Typography variant="overline" color="primary" fontWeight={900} letterSpacing={1}>{`PASO ${step} DE 5`}</Typography>}<Typography variant="h5" fontWeight={900}>{title}</Typography>{description && <Typography color="text.secondary" mt={0.25}>{description}</Typography>}</Box>
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
  const [transfer, setTransfer] = useState(null);
  const [catalogType, setCatalogType] = useState('organizational_unit');
  const [newReference, setNewReference] = useState({ code: '', name: '' });
  const [editingReferenceId, setEditingReferenceId] = useState(null);
  const [newCatalog, setNewCatalog] = useState({ code: '', name: '', scope: 'action_plans' });
  const [strategicPlanForm, setStrategicPlanForm] = useState(emptyStrategicPlanForm);
  const [editorPlanId, setEditorPlanId] = useState(null);
  const [structure, setStructure] = useState([]);
  const [structureLoading, setStructureLoading] = useState(false);
  const [openLevel, setOpenLevel] = useState(false);
  const [openElement, setOpenElement] = useState(false);
  const [openTerm, setOpenTerm] = useState(false);
  const [openField, setOpenField] = useState(false);
  const [levelForm, setLevelForm] = useState({ id: null, name: '' });
  const [elementForm, setElementForm] = useState({ id: null, level_id: '', parent_id: '', code: '', name: '', description: '' });
  const [termForm, setTermForm] = useState({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned' });
  const [fieldForm, setFieldForm] = useState({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [bootstrapResponse, strategicPlanResponse, planResponse] = await Promise.all([
        strategicPlanningService.bootstrap(), strategicPlanningService.listPlans(), strategicPlanningService.listActionPlans()
      ]);
      const availablePlans = strategicPlanResponse.data || [];
      setBoot(bootstrapResponse.data); setStrategicPlans(availablePlans); setPlans(planResponse.data || []);
      setSelectedPlanId((current) => availablePlans.some((item) => item.id === current) ? current : (bootstrapResponse.data?.plan?.id || availablePlans[0]?.id || ''));
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible abrir la nueva plataforma.', { variant: 'error' });
    } finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (space === 'analytics') strategicPlanningService.analytics().then((r) => setAnalytics(r.data)).catch(() => null);
    if (space === 'monitoring') strategicPlanningService.syncJobs().then((r) => setSyncJobs(r.data || [])).catch(() => null);
  }, [space]);

  const plan = strategicPlans.find((item) => item.id === selectedPlanId) || boot?.plan;
  const terms = plan?.terms || [];
  const selectedTerm = terms.find((term) => String(term.id) === String(form.term_id));
  const units = (plan?.catalogItems || []).filter((item) => ['dependency', 'organizational_unit'].includes(item.catalog_type) && item.active);
  const visiblePlans = plans.filter((item) => item.term?.strategicPlan?.id === plan?.id);
  const standardCatalogs = [
    ['organizational_unit','Dependencias'], ['position','Cargos'], ['actor','Actores'],
    ['macroactivity','Macroactividades'], ['meeting_location','Lugares de reunión'], ['reference_status','Estados de referencia']
  ];
  const customCatalogs = Array.isArray(plan?.settings?.referenceCatalogs) ? plan.settings.referenceCatalogs : [];
  const catalogOptions = [...standardCatalogs, ...customCatalogs.map((item) => [item.code, item.name])]
    .filter((item, index, source) => source.findIndex((candidate) => candidate[0] === item[0]) === index);
  const metrics = useMemo(() => ({
    years: terms.length, units: units.length, plans: visiblePlans.length,
    activities: visiblePlans.reduce((sum, item) => sum + (item.items?.length || 0), 0)
  }), [visiblePlans, terms.length, units.length]);
  const institutionalListsReady = units.length > 0 && leaders.length > 0;
  const activeFieldDefinitions = (plan?.fieldDefinitions || []).filter((field) => field.active !== false);
  const newPedStartYear = Number(String(strategicPlanForm.starts_on || '').slice(0, 4));
  const newPedEndYear = newPedStartYear && Number(strategicPlanForm.duration_years) > 0
    ? newPedStartYear + Number(strategicPlanForm.duration_years) : null;

  useEffect(() => {
    if (!plan?.id) return;
    strategicPlanningService.leaderOptions(plan.id).then((response) => setLeaders(response.data || [])).catch(() => setLeaders([]));
    const activeTerm = terms.find((term) => term.status === 'active') || terms[0];
    setForm((current) => ({ ...current, term_id: activeTerm?.id || '', catalog_item_id: '' }));
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
      enqueueSnackbar(wasEditing ? 'Nivel actualizado.' : 'Nivel jerárquico creado.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el nivel.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const deleteStructureLevel = async (level) => {
    if (!window.confirm(`¿Eliminar el nivel "${level.name}"?`)) return;
    try { await strategicPlanningService.deleteLevel(plan.id, level.id); await load(); await loadStructure(); enqueueSnackbar('Nivel eliminado.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el nivel.', { variant: 'error' }); }
  };

  const saveStructureElement = async () => {
    if (!elementForm.level_id || !elementForm.code.trim() || !elementForm.name.trim()) return enqueueSnackbar('Seleccione el nivel y complete código y nombre.', { variant: 'warning' });
    setSaving(true);
    try {
      const payload = { ...elementForm, parent_id: elementForm.parent_id || null, position: structure.filter((item) => item.level_id === elementForm.level_id).length + 1 };
      if (elementForm.id) await strategicPlanningService.updateElement(plan.id, elementForm.id, payload);
      else await strategicPlanningService.createElement(plan.id, payload);
      const wasEditing = Boolean(elementForm.id); setElementForm({ id: null, level_id: '', parent_id: '', code: '', name: '', description: '' }); setOpenElement(false); await loadStructure();
      enqueueSnackbar(wasEditing ? 'Elemento actualizado.' : 'Elemento estratégico creado y vinculado al PED.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar el elemento.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const deleteStructureElement = async (element) => {
    if (!window.confirm(`¿Eliminar el elemento "${element.name}"?`)) return;
    try { await strategicPlanningService.deleteElement(plan.id, element.id); await loadStructure(); enqueueSnackbar('Elemento eliminado.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el elemento.', { variant: 'error' }); }
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
      await load(); setSelectedPlanId(response.data.id);
      enqueueSnackbar(wasEditing ? 'PED actualizado correctamente.' : 'PED creado con sus años y semestres. Ya puede diseñar su estructura.', { variant: 'success' });
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

  const applyInstitutionalTemplate = async () => {
    if (!window.confirm('¿Aplicar a este PED los niveles y campos del formato institucional DIR-PE-FR-003 versión 5? No se duplicarán los existentes.')) return;
    setSaving(true);
    try { await strategicPlanningService.applyInstitutionalTemplate(plan.id); await load(); await loadStructure(); enqueueSnackbar('Plantilla institucional aplicada. Ya puede revisar y modificar sus campos.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible aplicar la plantilla.', { variant: 'error' }); }
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

  const deleteField = async (field) => {
    if (!window.confirm(`¿Eliminar el campo "${field.label}" de las nuevas versiones del Plan de Acción?`)) return;
    try { await strategicPlanningService.deleteField(plan.id, field.id); await load(); enqueueSnackbar('Campo eliminado sin alterar planes anteriores.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible eliminar el campo.', { variant: 'error' }); }
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
    try { const response = await strategicPlanningService.createActionPlan({ ...form, position_catalog_item_id: leader?.position_catalog_item_id || null }); setOpenPlan(false); setLeaderDocument(''); setLeaderLookup(null); await load(); setEditorPlanId(response.data.id); enqueueSnackbar('Plan creado. Complete ahora sus actividades, reunión y aprobación.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible crear el plan.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const selectLeader = (leader) => {
    if (!leader) { setForm((current) => ({ ...current, responsible_user_id: '' })); setLeaderLookup(null); return; }
    setForm((current) => ({ ...current, responsible_user_id: leader.id, catalog_item_id: leader.dependency_catalog_item_id || current.catalog_item_id }));
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
      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4, color: 'white', background: 'linear-gradient(120deg,#173b8f,#2563eb 58%,#7c3aed)' }}>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={2}>
          <Box>
            {onBack && <Button onClick={onBack} startIcon={<ArrowBack />} sx={{ mb: 1.5, color: 'white', border: '1px solid rgba(255,255,255,.45)', borderRadius: 3, textTransform: 'none', fontWeight: 800 }}>Volver a submódulos</Button>}
            <Chip label="NUEVA PLATAFORMA · INDEPENDIENTE" sx={{ mb: 1.5, ml: onBack ? { xs: 0, sm: 1 } : 0, color: 'white', border: '1px solid rgba(255,255,255,.4)', fontWeight: 800 }} />
            <Typography variant="h4" fontWeight={950}>Gestión, Seguimiento y Evaluación de la Planeación Estratégica Institucional</Typography>
            <Typography sx={{ mt: 1, opacity: .9 }}>{plan.name} · Fuente oficial SIAC · Expediente definitivo en Drive</Typography>
          </Box>
        </Stack>
      </Paper>

      <Paper elevation={0} sx={{ border: '1px solid #dbeafe', borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={space} onChange={(_, value) => setSpace(value)} variant="scrollable" scrollButtons="auto">
          {SPACES.map((item) => <Tab key={item.key} value={item.key} icon={item.icon} iconPosition="start" label={item.label} sx={{ textTransform: 'none', fontWeight: 800, minHeight: 62 }} />)}
        </Tabs>
      </Paper>

      {space === 'planning' && <Box>
        <SectionHeader step="2" title="Diseñe la estructura propia del PED" description="Cree los niveles que este plan necesita: proyectos, programas, productos, objetivos u otra organización." action={<Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button variant="outlined" startIcon={<Add />} onClick={() => { setLevelForm({ id: null, name: '' }); setOpenLevel(true); }}>Agregar nivel</Button><Button variant="contained" startIcon={<Add />} disabled={!(plan.levels || []).length} onClick={() => { setElementForm({ id: null, level_id: '', parent_id: '', code: '', name: '', description: '' }); setOpenElement(true); }}>Agregar elemento</Button></Stack>} />
        <Grid container spacing={2}>{[
          ['Años configurados', metrics.years], ['Dependencias', metrics.units], ['Planes de Acción', metrics.plans], ['Actividades', metrics.activities]
        ].map(([label, value]) => <Grid item xs={12} sm={6} md={3} key={label}><Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Typography color="text.secondary" fontWeight={700}>{label}</Typography><Typography variant="h4" fontWeight={950} color="primary">{value}</Typography></CardContent></Card></Grid>)}</Grid>
        <Paper variant="outlined" sx={{ mt: 2, p: 2.5, borderRadius: 3 }}>
          <Typography variant="h6" fontWeight={900}>Niveles jerárquicos configurados</Typography>
          <Typography color="text.secondary" mb={2}>{(plan.levels || []).length ? (plan.levels || []).sort((a, b) => a.position - b.position).map((l) => l.name).join(' → ') : 'Aún no existen niveles. Cree el primero para comenzar.'}</Typography>
          <Stack gap={1}>{[...(plan.levels || [])].sort((a, b) => a.position - b.position).map((level) => <Stack key={level.id} direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} justifyContent="space-between" gap={1} sx={{ p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Chip color="primary" variant="outlined" label={`${level.position}. ${level.name} · ${structure.filter((item) => item.level_id === level.id).length} elementos`} /><Stack direction="row" gap={1}><Button size="small" onClick={() => { setLevelForm({ id: level.id, name: level.name }); setOpenLevel(true); }}>Editar</Button><Button size="small" color="error" onClick={() => deleteStructureLevel(level)}>Eliminar</Button></Stack></Stack>)}</Stack>
        </Paper>

        <Paper variant="outlined" sx={{ mt: 2, borderRadius: 3, overflow: 'hidden' }}>
          <Box sx={{ p: 2.5, borderBottom: '1px solid', borderColor: 'divider' }}><Typography variant="h6" fontWeight={900}>Elementos estratégicos del PED</Typography><Typography color="text.secondary">Objetivos, lineamientos, ejes, programas o cualquier nivel que haya definido.</Typography></Box>
          {structureLoading ? <LinearProgress /> : !structure.length ? <Box sx={{ p: 4, textAlign: 'center' }}><AccountTree color="primary" sx={{ fontSize: 48 }} /><Typography variant="h6" fontWeight={900} mt={1}>La estructura todavía está vacía</Typography><Typography color="text.secondary" mb={2}>Puede copiar la estructura del formato institucional actual o construir una diferente para este nuevo PED.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={1.5}><Button variant="contained" onClick={applyInstitutionalTemplate}>Usar plantilla actual DIR-PE-FR-003</Button><Button variant="outlined" startIcon={<Add />} onClick={() => { if ((plan.levels || []).length) { setElementForm({ id: null, level_id: '', parent_id: '', code: '', name: '', description: '' }); setOpenElement(true); } else { setLevelForm({ id: null, name: '' }); setOpenLevel(true); } }}>Configurar desde cero</Button></Stack></Box> :
            <TableContainer sx={{ maxHeight: 480 }}><Table stickyHeader><TableHead><TableRow><TableCell>Nivel</TableCell><TableCell>Código</TableCell><TableCell>Elemento estratégico</TableCell><TableCell>Depende de</TableCell><TableCell>Estado</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{[...(plan.levels || [])].sort((a,b) => a.position-b.position).flatMap((level) => structure.filter((item) => item.level_id === level.id).map((item) => <TableRow key={item.id} hover><TableCell><Chip size="small" variant="outlined" label={level.name} /></TableCell><TableCell><strong>{item.code}</strong></TableCell><TableCell><Typography fontWeight={800}>{item.name}</Typography>{item.description && <Typography variant="body2" color="text.secondary">{item.description}</Typography>}</TableCell><TableCell>{structure.find((parent) => parent.id === item.parent_id)?.name || <Typography color="text.secondary">Nivel raíz</Typography>}</TableCell><TableCell><Chip size="small" color={item.active === false ? 'default' : 'success'} label={item.active === false ? 'Inactivo' : 'Activo'} /></TableCell><TableCell><Stack direction="row" gap={1}><Button size="small" onClick={() => { setElementForm({ id: item.id, level_id: item.level_id, parent_id: item.parent_id || '', code: item.code, name: item.name, description: item.description || '' }); setOpenElement(true); }}>Editar</Button><Button size="small" color="error" onClick={() => deleteStructureElement(item)}>Eliminar</Button></Stack></TableCell></TableRow>))}</TableBody></Table></TableContainer>}
        </Paper>
        <StepNavigation onBack={() => setSpace('configuration')} onNext={() => setSpace('instrument')} nextLabel="Continuar al formulario" />
      </Box>}

      {space === 'instrument' && <Box>
        <SectionHeader step="3" title="Diseñe el formulario de este PED" description="Agregue únicamente los campos que necesita. El sistema construirá el formulario automáticamente." action={<Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button variant="outlined" onClick={applyInstitutionalTemplate}>Usar formato institucional</Button><Button variant="contained" startIcon={<Add />} onClick={() => { setFieldForm({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '' }); setOpenField(true); }}>Agregar campo</Button></Stack>} />
        {!activeFieldDefinitions.length ? <Paper variant="outlined" sx={{ p: 4, borderRadius: 3, textAlign: 'center' }}><Description color="primary" sx={{ fontSize: 52 }} /><Typography variant="h6" fontWeight={900}>Este PED todavía no tiene un formulario</Typography><Typography color="text.secondary" mb={2}>Utilice la plantilla institucional actual o agregue los campos uno por uno.</Typography><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="center" gap={1.5}><Button variant="contained" onClick={applyInstitutionalTemplate}>Aplicar DIR-PE-FR-003 versión 5</Button><Button variant="outlined" onClick={() => { setFieldForm({ id: null, key: '', label: '', data_type: 'text', required: false, options_text: '', formula: '', catalog_type: '' }); setOpenField(true); }}>Crear primer campo</Button></Stack></Paper> :
          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, maxHeight: 600 }}><Table stickyHeader><TableHead><TableRow><TableCell>Orden</TableCell><TableCell>Campo</TableCell><TableCell>Tipo de dato</TableCell><TableCell>Obligatorio</TableCell><TableCell>Opciones / fuente</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{[...activeFieldDefinitions].sort((a,b) => a.position-b.position).map((field) => <TableRow key={field.id} hover><TableCell>{field.position}</TableCell><TableCell><Typography fontWeight={900}>{field.label}</Typography><Typography variant="caption" color="text.secondary">{field.key}</Typography></TableCell><TableCell><Chip size="small" variant="outlined" label={FIELD_TYPE_LABEL[field.data_type] || field.data_type} /></TableCell><TableCell><Chip size="small" color={field.required ? 'success' : 'default'} label={field.required ? 'Sí' : 'No'} /></TableCell><TableCell>{field.validation_rules?.catalog_type ? catalogOptions.find(([code]) => code === field.validation_rules.catalog_type)?.[1] || field.validation_rules.catalog_type : field.data_type === 'formula' ? field.formula : (field.options || []).join(', ') || '—'}</TableCell><TableCell><Stack direction="row" gap={1}><Button size="small" onClick={() => { setFieldForm({ id: field.id, key: field.key, label: field.label, data_type: field.data_type, required: field.required, options_text: (field.options || []).join('\n'), formula: field.formula || '', catalog_type: field.validation_rules?.catalog_type || '' }); setOpenField(true); }}>Editar</Button><Button size="small" color="error" onClick={() => deleteField(field)}>Eliminar</Button></Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
        <StepNavigation onBack={() => setSpace('planning')} onNext={() => setSpace('actions')} nextLabel="Continuar a Planes de Acción" />
      </Box>}

      {space === 'configuration' && <Box>
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
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderRadius: 3, color: 'white', background: 'linear-gradient(110deg,#1d4ed8,#4f46e5)' }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}><Box><Typography fontWeight={950} fontSize={20}>¿Este es el PED correcto?</Typography><Typography sx={{ opacity: .9 }}>El siguiente paso es decidir si tendrá proyectos, programas, objetivos u otros niveles.</Typography></Box><Button variant="contained" onClick={() => setSpace('planning')} sx={{ bgcolor: 'white', color: '#1d4ed8', px: 3, py: 1.25, borderRadius: 2.5, fontWeight: 950, textTransform: 'none', '&:hover': { bgcolor: '#eff6ff' } }}>Continuar a diseñar la estructura →</Button></Stack></Paper>

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
        <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3, bgcolor: '#f5f3ff', borderColor: '#c4b5fd' }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1.5}><Box><Typography fontWeight={950} color="#4c1d95">¿Busca la plantilla de respuestas creada con sus campos?</Typography><Typography variant="body2" color="text.secondary">Primero diseñe la estructura y el formulario. Después cree un Plan de Acción y ábralo; allí aparecerán “Descargar plantilla dinámica” y “Subir plantilla diligenciada”.</Typography></Box><Stack direction={{ xs: 'column', sm: 'row' }} gap={1}><Button variant="outlined" onClick={() => setSpace('planning')}>Ir a Estructura</Button><Button variant="contained" onClick={() => setSpace('instrument')}>Ir al Formulario</Button></Stack></Stack></Paper>
        <SubstepHeader number="B" title="Vigencias creadas automáticamente" description="Opcional: los años y los informes S1–S2 ya fueron creados; modifíquelos solo si existe una excepción." />
        <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} gap={1} sx={{ p: 2 }}><Typography variant="h6" fontWeight={900}>Vigencias e informes S1–S2</Typography><Button variant="outlined" startIcon={<Add />} onClick={() => { setTermForm({ id: null, year: '', starts_on: '', ends_on: '', status: 'planned' }); setOpenTerm(true); }}>Agregar año excepcional</Button></Stack><TableContainer><Table><TableHead><TableRow><TableCell>Año</TableCell><TableCell>Estado</TableCell><TableCell>Informes</TableCell><TableCell>Conservación</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{[...terms].filter((term) => term.status !== 'inactive').sort((a,b) => a.year-b.year).map((term) => <TableRow key={term.id}><TableCell>{term.year}</TableCell><TableCell><Chip size="small" color={term.status === 'active' ? 'success' : 'default'} label={TERM_STATUS_LABEL[term.status] || term.status} /></TableCell><TableCell>{term.monitoringPeriods?.map((p) => p.code).join(' y ')}</TableCell><TableCell>Historial permanente</TableCell><TableCell><Button size="small" onClick={() => { setTermForm({ id: term.id, year: term.year, starts_on: term.starts_on, ends_on: term.ends_on, status: term.status }); setOpenTerm(true); }}>Editar</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer></Paper>
        <Paper variant="outlined" sx={{ mt: 2, p: 2.5, borderRadius: 3 }}><Typography variant="h6" fontWeight={900} mb={0.5}>Administración manual de listas</Typography><Typography variant="body2" color="text.secondary" mb={2}>Opcional: úsela solamente para corregir o agregar un registro específico.</Typography><Grid container spacing={1.5} alignItems="center"><Grid item xs={12} md={4}><TextField fullWidth select label="Tabla de referencia" value={catalogType} onChange={(e) => { if (e.target.value === '__create_catalog__') setOpenCatalog(true); else { setCatalogType(e.target.value); setEditingReferenceId(null); setNewReference({ code: '', name: '' }); } }}>{catalogOptions.map(([value,label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}<MenuItem value="__create_catalog__" sx={{ color: 'primary.main', fontWeight: 900, borderTop: '1px solid', borderColor: 'divider' }}><Add fontSize="small" sx={{ mr: 1 }} />Otra / Crear nueva tabla</MenuItem></TextField></Grid><Grid item xs={12} md={2}><TextField fullWidth disabled={Boolean(editingReferenceId)} label="Código del registro" value={newReference.code} onChange={(e) => setNewReference({ ...newReference, code: e.target.value })} /></Grid><Grid item xs={12} md={4}><TextField fullWidth label="Nombre del registro" value={newReference.name} onChange={(e) => setNewReference({ ...newReference, name: e.target.value })} /></Grid><Grid item xs={12} md={2}><Button fullWidth variant="contained" startIcon={<Add />} disabled={!newReference.code.trim() || !newReference.name.trim()} onClick={saveReference}>{editingReferenceId ? 'Actualizar' : 'Agregar registro'}</Button></Grid></Grid>
          {customCatalogs.find((item) => item.code === catalogType) && <Alert severity="info" sx={{ mt: 2 }}>Tabla personalizada: <strong>{customCatalogs.find((item) => item.code === catalogType)?.name}</strong>. Se usará en: <strong>{{ action_plans: 'Planes de Acción', activities: 'Actividades', meetings: 'Reuniones y actas', monitoring: 'Seguimiento', budget: 'Presupuesto', analytics: 'Analítica', general: 'Uso general' }[customCatalogs.find((item) => item.code === catalogType)?.scope] || 'Uso general'}</strong>.</Alert>}
          <TableContainer sx={{ mt: 2, maxHeight: 330 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Referencia</TableCell><TableCell>Estado</TableCell><TableCell>Acciones</TableCell></TableRow></TableHead><TableBody>{(plan.catalogItems || []).filter((item) => item.catalog_type === catalogType).sort((a,b) => a.name.localeCompare(b.name,'es')).map((item) => <TableRow key={item.id}><TableCell>{item.code}</TableCell><TableCell>{item.name}</TableCell><TableCell><Chip size="small" color={item.active ? 'success' : 'default'} label={item.active ? 'Activa' : 'Inactiva'} /></TableCell><TableCell><Stack direction="row" gap={0.5}><Button size="small" onClick={() => { setEditingReferenceId(item.id); setNewReference({ code: item.code, name: item.name }); }}>Editar</Button><Button size="small" color={item.active ? 'warning' : 'success'} onClick={() => toggleReference(item)}>{item.active ? 'Desactivar' : 'Reactivar'}</Button><Button size="small" color="error" disabled={!item.active} onClick={() => deleteReference(item)}>Eliminar</Button></Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>
        </Paper>
        <StepNavigation onNext={() => setSpace('planning')} nextLabel="Continuar a la estructura" />
      </Box>}

      {space === 'actions' && <Box>
        <SectionHeader step="4" title="Cree los Planes de Acción" description="Seleccione el año, la dependencia y su líder." action={<Button variant="contained" startIcon={<Add />} onClick={() => setOpenPlan(true)}>Crear Plan de Acción</Button>} />
        {!visiblePlans.length ? <Alert severity="info">Este PED aún no tiene Planes de Acción. Pulse “Crear Plan de Acción”, seleccione el año, la dependencia y el líder. Después ábralo para registrar datos individualmente o mediante Excel.</Alert> :
          <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Dependencia</TableCell><TableCell>Líder actual</TableCell><TableCell>Vigencia</TableCell><TableCell>Estado</TableCell><TableCell>Actividades</TableCell><TableCell /></TableRow></TableHead><TableBody>{visiblePlans.map((item) => <TableRow key={item.id} hover><TableCell><strong>{item.code}</strong></TableCell><TableCell>{item.organizationalUnit?.name}</TableCell><TableCell>{item.responsibleUser ? <Box><strong>{item.responsibleUser.nombre}</strong><Typography variant="caption" display="block" color="text.secondary">{item.responsibleUser.cargo || 'Sin cargo'} · {item.responsibleUser.email}</Typography></Box> : <Chip size="small" color="warning" label="Sin asignar" />}</TableCell><TableCell>{item.term?.year}</TableCell><TableCell><Chip size="small" color="primary" variant="outlined" label={STATUS_LABEL[item.status] || item.status} /></TableCell><TableCell>{item.items?.length || 0}</TableCell><TableCell><Stack direction="row" gap={1}><Button size="small" variant="contained" onClick={() => setEditorPlanId(item.id)}>Abrir / cargar Excel</Button><Button size="small" startIcon={<SwapHoriz />} onClick={() => setTransfer({ plan: item, user_id: '', reason: '' })}>Transferir</Button></Stack></TableCell></TableRow>)}</TableBody></Table></TableContainer>}
        <StepNavigation onBack={() => setSpace('instrument')} onNext={() => setSpace('monitoring')} nextLabel="Continuar a informes" />
      </Box>}

      {space === 'monitoring' && <Box>
        <SectionHeader step="5" title="Diligencie los informes semestrales" description="Abra un plan y registre sus avances y evidencias en S1 o S2." />
        {!visiblePlans.length ? <Alert severity="warning">Todavía no hay Planes de Acción para este PED.</Alert> : <TableContainer component={Paper} variant="outlined"><Table><TableHead><TableRow><TableCell>Año</TableCell><TableCell>Dependencia</TableCell><TableCell>Plan de Acción</TableCell><TableCell>Actividades</TableCell><TableCell>Avance general</TableCell><TableCell /></TableRow></TableHead><TableBody>{visiblePlans.map((actionPlan) => { const actionItems=actionPlan.items || []; const progress=actionItems.length ? actionItems.reduce((sum, row) => sum + Number(row.current_progress || 0), 0) / actionItems.length : 0; return <TableRow key={actionPlan.id}><TableCell>{actionPlan.term?.year}</TableCell><TableCell>{actionPlan.organizationalUnit?.name}</TableCell><TableCell><Typography fontWeight={800}>{actionPlan.title}</Typography><Typography variant="caption">{actionPlan.code}</Typography></TableCell><TableCell>{actionItems.length}</TableCell><TableCell sx={{ minWidth: 160 }}><Typography variant="body2" fontWeight={800}>{progress.toFixed(1)}%</Typography><LinearProgress variant="determinate" value={progress} /></TableCell><TableCell><Button variant="contained" size="small" onClick={() => setEditorPlanId(actionPlan.id)}>Llenar informe</Button></TableCell></TableRow>; })}</TableBody></Table></TableContainer>}
        {!!syncJobs.length && <Alert severity="success" icon={<Folder />} sx={{ mt: 2 }}>Las evidencias se conservan y se sincronizan automáticamente con el expediente institucional.</Alert>}
        <StepNavigation onBack={() => setSpace('actions')} onNext={() => setSpace('analytics')} nextLabel="Ver resultados" />
      </Box>}

      {space === 'budget' && <Box>
        <SectionHeader title="Presupuesto" description="Importación controlada; movimientos físicos y financieros permanecen separados." />
        <Stack direction={{ xs: 'column', sm: 'row' }} gap={2}>
          <Button component="label" variant="contained" startIcon={<UploadFile />}>Validar presupuesto Excel<input hidden type="file" accept=".xlsx" onChange={(e) => previewFile(e.target.files?.[0], 'budget')} /></Button>
          <Button component="label" variant="outlined" startIcon={<Description />}>Validar DIR-PE-FR-003<input hidden type="file" accept=".xlsx" onChange={(e) => previewFile(e.target.files?.[0], 'historical')} /></Button>
        </Stack>
        {importPreview && <Alert severity={(importPreview.error_report || importPreview.errors || []).length ? 'warning' : 'success'} sx={{ mt: 2 }}>Archivo: {importPreview.original_name}. Filas: {(importPreview.rows || []).length}. Errores: {(importPreview.error_report || importPreview.errors || []).length}. Esta vista previa es reversible y aún no confirma información.</Alert>}
      </Box>}

      {space === 'analytics' && <Box>
        <SectionHeader title="Analítica" description="Navegación ejecutiva sin mezclar cumplimiento físico y ejecución financiera." />
        <Grid container spacing={2}>{[
          ['Planes', analytics?.plans || 0], ['Actividades', analytics?.activities || 0], ['Avance físico', `${Number(analytics?.physical_progress || 0).toFixed(1)}%`], ['Evidencias pendientes', analytics?.evidence?.pending || 0]
        ].map(([label, value]) => <Grid item xs={12} sm={6} md={3} key={label}><Card variant="outlined" sx={{ borderRadius: 3 }}><CardContent><Typography color="text.secondary">{label}</Typography><Typography variant="h4" fontWeight={900}>{value}</Typography></CardContent></Card></Grid>)}</Grid>
        <Alert severity="info" sx={{ mt: 2 }} icon={<CloudSync />}>Drive se identifica por IDs internos, no únicamente por nombres. Una resincronización crea lo faltante y actualiza versiones sin eliminar automáticamente.</Alert>
      </Box>}

      <Dialog open={openField} onClose={() => setOpenField(false)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={900}>{fieldForm.id ? 'Editar campo del Plan de Acción' : 'Agregar campo al Plan de Acción'}</DialogTitle>
        <DialogContent><Grid container spacing={2} mt={0.25}>
          <Grid item xs={12} md={7}><TextField required fullWidth label="Nombre que verá el usuario" placeholder="Por ejemplo: Resultado esperado" value={fieldForm.label} onChange={(e) => { const label=e.target.value; setFieldForm({ ...fieldForm, label, key: fieldForm.id ? fieldForm.key : label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_|_$/g,'') }); }} /></Grid>
          <Grid item xs={12} md={5}><TextField required fullWidth disabled={Boolean(fieldForm.id)} label="Código interno" value={fieldForm.key} onChange={(e) => setFieldForm({ ...fieldForm, key: e.target.value })} /></Grid>
          <Grid item xs={12} md={7}><TextField required fullWidth select label="Tipo de información" value={fieldForm.data_type} onChange={(e) => setFieldForm({ ...fieldForm, data_type: e.target.value })}>{Object.entries(FIELD_TYPE_LABEL).map(([value,label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={5}><FormControlLabel control={<Switch checked={fieldForm.required} onChange={(e) => setFieldForm({ ...fieldForm, required: e.target.checked })} />} label="Campo obligatorio" /></Grid>
          {fieldForm.data_type === 'list' && <Grid item xs={12}><TextField fullWidth multiline minRows={4} label="Opciones de la lista" helperText="Escriba una opción por línea." value={fieldForm.options_text} onChange={(e) => setFieldForm({ ...fieldForm, options_text: e.target.value })} /></Grid>}
          {['catalog','catalog_multi'].includes(fieldForm.data_type) && <Grid item xs={12}><TextField fullWidth select label="Tabla que alimentará este campo" value={fieldForm.catalog_type} onChange={(e) => setFieldForm({ ...fieldForm, catalog_type: e.target.value })} helperText="Las opciones aparecerán automáticamente desde la tabla seleccionada."><MenuItem value="">Seleccione una tabla</MenuItem>{catalogOptions.map(([value, label]) => <MenuItem key={value} value={value}>{label}</MenuItem>)}</TextField></Grid>}
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
        <DialogTitle fontWeight={900}>{levelForm.id ? 'Editar nivel jerárquico' : 'Agregar nivel jerárquico'}</DialogTitle>
        <DialogContent><Stack gap={2} mt={1}><Alert severity="info">Los niveles determinan el orden de la estructura. Ejemplos: Objetivo → Lineamiento o Eje → Programa → Proyecto.</Alert><TextField autoFocus required label="Nombre del nivel" placeholder="Por ejemplo: Programa estratégico" value={levelForm.name} onChange={(e) => setLevelForm({ ...levelForm, name: e.target.value })} helperText={levelForm.id ? 'Modifique el nombre y guarde los cambios.' : `Se creará en la posición ${(plan.levels || []).length + 1}.`} /></Stack></DialogContent>
        <DialogActions><Button onClick={() => setOpenLevel(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !levelForm.name.trim()} onClick={saveStructureLevel}>{saving ? 'Guardando…' : levelForm.id ? 'Actualizar nivel' : 'Crear nivel'}</Button></DialogActions>
      </Dialog>

      <Dialog open={openElement} onClose={() => setOpenElement(false)} fullWidth maxWidth="md">
        <DialogTitle fontWeight={900}>{elementForm.id ? 'Editar elemento estratégico' : 'Agregar elemento estratégico'}</DialogTitle>
        <DialogContent><Grid container spacing={2} mt={0.25}>
          <Grid item xs={12} md={6}><TextField required fullWidth select label="Nivel jerárquico" value={elementForm.level_id} onChange={(e) => setElementForm({ ...elementForm, level_id: e.target.value, parent_id: '' })}>{[...(plan.levels || [])].sort((a,b) => a.position-b.position).map((level) => <MenuItem key={level.id} value={level.id}>{level.position}. {level.name}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth select disabled={!elementForm.level_id || !parentCandidates.length} label="Elemento superior" value={elementForm.parent_id} onChange={(e) => setElementForm({ ...elementForm, parent_id: e.target.value })}><MenuItem value="">Sin elemento superior</MenuItem>{parentCandidates.map((item) => <MenuItem key={item.id} value={item.id}>{item.code} · {item.name}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={3}><TextField required fullWidth label="Código" placeholder="OBJ-01" value={elementForm.code} onChange={(e) => setElementForm({ ...elementForm, code: e.target.value })} /></Grid>
          <Grid item xs={12} md={9}><TextField required fullWidth label="Nombre" value={elementForm.name} onChange={(e) => setElementForm({ ...elementForm, name: e.target.value })} /></Grid>
          <Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Descripción" value={elementForm.description} onChange={(e) => setElementForm({ ...elementForm, description: e.target.value })} /></Grid>
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setOpenElement(false)}>Cancelar</Button><Button variant="contained" disabled={saving || !elementForm.level_id || !elementForm.code.trim() || !elementForm.name.trim()} onClick={saveStructureElement}>{saving ? 'Guardando…' : elementForm.id ? 'Actualizar elemento' : 'Crear elemento'}</Button></DialogActions>
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
        <DialogActions sx={{ px: 3, py: 2, borderTop: '1px solid', borderColor: 'divider', gap: 1 }}><Button onClick={() => { setOpenStrategicPlan(false); setEditingPlanId(null); }} sx={{ textTransform: 'none', fontWeight: 800 }}>Cancelar</Button><Button variant="contained" disabled={saving || (!editingPlanId && (!strategicPlanForm.starts_on || !strategicPlanForm.duration_years))} onClick={saveStrategicPlan} sx={{ minWidth: 220, borderRadius: 2.5, py: 1, textTransform: 'none', fontWeight: 900 }}>{saving ? 'Creando PED…' : editingPlanId ? 'Guardar cambios' : 'Crear PED y diseñar estructura'}</Button></DialogActions>
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

      <Dialog open={openPlan} onClose={() => setOpenPlan(false)} fullWidth maxWidth="sm">
        <DialogTitle fontWeight={900}>Crear Plan de Acción</DialogTitle><DialogContent><Stack gap={2} mt={1}>
          <TextField select required label="Año del Plan de Acción" value={form.term_id} onChange={(e) => setForm((current) => ({ ...current, term_id: e.target.value }))} SelectProps={{ MenuProps: { PaperProps: { sx: { maxHeight: 320 } } } }}>{[...terms].sort((a,b) => a.year-b.year).map((term) => <MenuItem key={term.id} value={term.id}>{term.year} · {TERM_STATUS_LABEL[term.status] || term.status}</MenuItem>)}</TextField>
          {selectedTerm && <Alert severity={selectedTerm.status === 'closed' ? 'warning' : selectedTerm.status === 'active' ? 'success' : 'info'}>Año seleccionado: <strong>{selectedTerm.year}</strong>. Estado: <strong>{TERM_STATUS_LABEL[selectedTerm.status] || selectedTerm.status}</strong>{selectedTerm.status === 'closed' ? '. Este año pertenece al histórico.' : selectedTerm.status === 'planned' ? '. Puede formular el Plan de Acción antes de activarlo.' : '. Disponible para formulación.'}</Alert>}
          <Stack direction={{ xs: 'column', sm: 'row' }} gap={1} alignItems="stretch"><TextField fullWidth autoFocus label="Cédula o número de documento del líder" value={leaderDocument} onChange={(e) => { setLeaderDocument(e.target.value.replace(/[^0-9]/g, '')); setLeaderLookup(null); setForm((current) => ({ ...current, responsible_user_id: '' })); }} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); searchLeaderByDocument(); } }} inputProps={{ inputMode: 'numeric', maxLength: 15 }} helperText="Digite el documento y presione Buscar o Enter." /><Button variant="contained" sx={{ minWidth: 120 }} disabled={!leaderDocument.trim()} onClick={searchLeaderByDocument}>Buscar</Button></Stack>
          {leaderLookup && <Alert severity={leaderLookup.found ? 'success' : 'warning'}>{leaderLookup.found ? <Box><Typography fontWeight={900}>{leaderLookup.leader.name}</Typography><Typography variant="body2">Documento: {leaderLookup.leader.document} · {leaderLookup.leader.email}</Typography><Typography variant="body2">Cargo: {leaderLookup.leader.position || 'Sin cargo registrado'} · Dependencia: {leaderLookup.leader.dependency || 'Sin dependencia registrada'}</Typography>{leaderLookup.leader.dependency_catalog_item_id ? <Typography variant="body2" fontWeight={800}>La dependencia fue seleccionada automáticamente.</Typography> : <Typography variant="body2">Seleccione manualmente la dependencia porque no existe una coincidencia exacta en el catálogo.</Typography>}</Box> : leaderLookup.message}</Alert>}
          <TextField select required label="Dependencia del Plan de Acción" value={form.catalog_item_id} onChange={(e) => setForm((current) => ({ ...current, catalog_item_id: e.target.value }))} helperText={leaderLookup?.found && leaderLookup.leader.dependency_catalog_item_id ? 'Asignada automáticamente según los datos del usuario. Puede cambiarla si corresponde.' : 'Seleccione la dependencia responsable.'}>{units.map((unit) => <MenuItem key={unit.id} value={unit.id}>{unit.code} · {unit.name}</MenuItem>)}</TextField>
          <Autocomplete options={leaders} value={leaders.find((leader) => String(leader.id) === String(form.responsible_user_id)) || null} onChange={(_, leader) => selectLeader(leader)} filterOptions={(options, state) => { const query=state.inputValue.toLowerCase().trim(); return options.filter((leader) => `${leader.document || ''} ${leader.name} ${leader.position || ''} ${leader.email} ${leader.dependency || ''}`.toLowerCase().includes(query)); }} getOptionLabel={(leader) => `${leader.document || 'Sin documento'} · ${leader.name} · ${leader.position || 'Sin cargo'}`} renderInput={(params) => <TextField {...params} label="O buscar por documento, nombre, cargo, correo o dependencia" />} />
          <TextField label="Nombre opcional" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </Stack></DialogContent><DialogActions><Button onClick={() => setOpenPlan(false)}>Cancelar</Button><Button variant="contained" disabled={saving} onClick={createActionPlan}>{saving ? 'Creando…' : 'Crear'}</Button></DialogActions>
      </Dialog>
      <Dialog open={Boolean(transfer)} onClose={() => setTransfer(null)} fullWidth maxWidth="sm"><DialogTitle fontWeight={900}>Transferir liderazgo del plan</DialogTitle><DialogContent><Stack gap={2} mt={1}><Alert severity="info">El plan seguirá anclado a la dependencia. Se cerrará la asignación anterior y se conservarán persona, cargo, fechas y motivo en el histórico.</Alert><Autocomplete options={leaders} value={leaders.find((leader) => String(leader.id) === String(transfer?.user_id)) || null} onChange={(_, leader) => setTransfer({ ...transfer, user_id: leader?.id || '' })} getOptionLabel={(leader) => `${leader.name} · ${leader.position || 'Sin cargo'} · ${leader.email}`} renderInput={(params) => <TextField {...params} label="Buscar nuevo responsable" />} /><TextField required multiline minRows={3} label="Motivo de la transferencia" value={transfer?.reason || ''} onChange={(e) => setTransfer({ ...transfer, reason: e.target.value })} /></Stack></DialogContent><DialogActions><Button onClick={() => setTransfer(null)}>Cancelar</Button><Button variant="contained" disabled={!transfer?.user_id || !transfer?.reason?.trim()} onClick={executeTransfer}>Confirmar transferencia</Button></DialogActions></Dialog>
      <StrategicActionPlanEditor open={Boolean(editorPlanId)} planId={editorPlanId} platformPlan={plan} workflow={boot?.workflow} onClose={() => setEditorPlanId(null)} onChanged={load} />
    </Stack>
  );
}
