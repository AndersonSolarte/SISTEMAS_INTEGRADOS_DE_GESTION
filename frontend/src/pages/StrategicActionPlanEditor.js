import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, Grid, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, TextField, Typography
} from '@mui/material';
import { Add, CloudUpload, Description, Download, Event, PlayArrow, Refresh } from '@mui/icons-material';
import { useSnackbar } from 'notistack';
import strategicPlanningService from '../services/strategicPlanningService';

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
const emptyItem = { strategic_objective: '', guideline: '', macroactivity: '', activity: '', indicator_type: '', starts_on: '', ends_on: '', indicator: '', target: '', co_responsibles: '', budget: '', custom_values: {} };
const CORE_FIELD_KEYS = new Set(['strategic_objective','strategic_guideline','activity','indicator_type','starts_on','ends_on','indicator','target','responsible','co_responsibles','progress_s1','observations_s1','progress_s2','observations_s2','total_progress']);
const emptyMeeting = { starts_at: '', ends_at: '', location: '', modality: 'Presencial', objective: '', development: '', participants_text: '' };

export default function StrategicActionPlanEditor({ open, planId, platformPlan, workflow, onClose, onChanged }) {
  const { enqueueSnackbar } = useSnackbar();
  const [tab, setTab] = useState('activities');
  const [detail, setDetail] = useState(null);
  const [structure, setStructure] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [item, setItem] = useState(emptyItem);
  const [meeting, setMeeting] = useState(emptyMeeting);
  const [monitoring, setMonitoring] = useState({ item_id: '', period_id: '', physical_progress: '', observations: '', file: null, description: '' });
  const [published, setPublished] = useState(null);

  const load = useCallback(async () => {
    if (!planId) return; setLoading(true);
    try {
      const [planResponse, structureResponse] = await Promise.all([
        strategicPlanningService.getActionPlan(planId), strategicPlanningService.listStructure(platformPlan.id)
      ]);
      setDetail(planResponse.data); setStructure(structureResponse.data || []);
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar el formulario del plan.', { variant: 'error' }); }
    finally { setLoading(false); }
  }, [planId, platformPlan?.id, enqueueSnackbar]);
  useEffect(() => { if (open) load(); }, [open, load]);

  const levels = [...(platformPlan?.levels || [])].sort((a, b) => a.position - b.position);
  const objectives = structure.filter((element) => element.level_id === levels[0]?.id && element.active);
  const guidelines = structure.filter((element) => element.level_id === levels[1]?.id && element.active);
  const macroactivities = (platformPlan?.catalogItems || []).filter((entry) => entry.catalog_type === 'macroactivity' && entry.active);
  const locations = (platformPlan?.catalogItems || []).filter((entry) => entry.catalog_type === 'meeting_location' && entry.active);
  const periods = detail?.term?.monitoringPeriods || [];
  const customFields = [...(platformPlan?.fieldDefinitions || [])].filter((field) => field.active !== false && !CORE_FIELD_KEYS.has(field.key) && field.data_type !== 'formula').sort((a,b) => a.position-b.position);
  const availableTransitions = useMemo(() => (workflow?.transitions || []).filter((entry) => entry.from === detail?.status), [workflow, detail?.status]);

  const saveItem = async () => {
    if (!item.activity.trim() || !item.indicator.trim() || !item.target.trim()) return enqueueSnackbar('Actividad, indicador y meta son obligatorios.', { variant: 'warning' });
    setSaving(true);
    try {
      const selectedMacro = macroactivities.find((entry) => entry.id === item.macroactivity);
      await strategicPlanningService.addItem(planId, {
        code: `ACT-${String((detail.items?.length || 0) + 1).padStart(3, '0')}`,
        activity: item.activity, indicator_type: item.indicator_type, indicator: item.indicator,
        target: item.target, starts_on: item.starts_on || null, ends_on: item.ends_on || null,
        co_responsibles: item.co_responsibles.split(',').map((value) => value.trim()).filter(Boolean),
        custom_values: { ...(item.custom_values || {}), strategic_objective: item.strategic_objective, guideline: item.guideline, macroactivity_id: selectedMacro?.id || null, macroactivity: selectedMacro?.name || '', budget: item.budget }
      });
      setItem(emptyItem); await load(); onChanged?.(); enqueueSnackbar('Actividad agregada al plan.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible guardar la actividad.', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const parseParticipants = () => meeting.participants_text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const [name, email, organization, role_title] = line.split('|').map((value) => String(value || '').trim());
    return { name, email: email || null, organization: organization || null, role_title: role_title || null, signature_required: true };
  });
  const saveMeeting = async () => {
    if (!meeting.starts_at || !meeting.objective.trim()) return enqueueSnackbar('Fecha y objetivo son obligatorios.', { variant: 'warning' });
    setSaving(true);
    try {
      await strategicPlanningService.createMeeting(planId, { ...meeting, type: 'formulation', participants: parseParticipants(), commitments: [] });
      setMeeting(emptyMeeting); await load(); enqueueSnackbar('Reunión y participantes registrados.', { variant: 'success' });
    } catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible programar la reunión.', { variant: 'error' }); }
    finally { setSaving(false); }
  };
  const generateMinute = async (meetingId) => {
    try { await strategicPlanningService.createMinute(meetingId); await load(); enqueueSnackbar('Borrador institucional COM-IF-FR-002 generado.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible generar el acta.', { variant: 'error' }); }
  };
  const publishMinute = async (minuteId) => {
    try { const response = await strategicPlanningService.publishMinute(minuteId); setPublished(response.data); await load(); enqueueSnackbar('Acta congelada y QR habilitado.', { variant: 'success' }); }
    catch (error) { enqueueSnackbar(error.response?.data?.message || 'No fue posible publicar el acta.', { variant: 'error' }); }
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

  return <Dialog open={open} onClose={onClose} fullScreen><DialogTitle sx={{ borderBottom: '1px solid #e2e8f0', py: 1.5 }}><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} gap={1}><Box><Typography variant="h5" fontWeight={950}>{detail?.title || 'Formulario del Plan de Acción'}</Typography>{detail && <Typography color="text.secondary">{detail.code} · {detail.organizationalUnit?.name} · {detail.term?.year}</Typography>}</Box><Stack direction="row" gap={1}><Chip color="primary" label={STATUS_LABELS[detail?.status] || detail?.status || 'Cargando'} /><Button onClick={load} startIcon={<Refresh />}>Actualizar</Button><Button variant="outlined" onClick={onClose}>Cerrar</Button></Stack></Stack></DialogTitle>
    <DialogContent sx={{ p: { xs: 1.5, md: 3 }, bgcolor: '#f8fafc' }}>{loading || !detail ? <Stack alignItems="center" py={10}><CircularProgress /></Stack> : <Stack gap={2}>
      <Paper variant="outlined" sx={{ borderRadius: 3 }}><Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable"><Tab value="activities" label={`1. Formulación (${detail.items?.length || 0})`} /><Tab value="meeting" label={`2. Reunión y acta (${detail.meetings?.length || 0})`} /><Tab value="workflow" label="3. Revisión y aprobación" /><Tab value="followup" label="4. Seguimiento y evidencias" /></Tabs></Paper>

      {tab === 'activities' && <><Alert severity="info">Registre cada fila del formato DIR-PE-FR-003. Puede agregar varias actividades antes de enviar el plan a revisión.</Alert><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Typography variant="h6" fontWeight={900} mb={2}>Nueva actividad</Typography><Grid container spacing={2}>
        <Grid item xs={12} md={6}><TextField fullWidth select label="Objetivo estratégico" value={item.strategic_objective} onChange={(e) => setItem({ ...item, strategic_objective: e.target.value })}>{objectives.map((entry) => <MenuItem key={entry.id} value={`${entry.code} ${entry.name}`}>{entry.code} · {entry.name}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} md={6}><TextField fullWidth select label="Lineamiento estratégico" value={item.guideline} onChange={(e) => setItem({ ...item, guideline: e.target.value })}>{guidelines.map((entry) => <MenuItem key={entry.id} value={`${entry.code} ${entry.name}`}>{entry.code} · {entry.name}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12}><TextField fullWidth select label="Macroactividad" value={item.macroactivity} onChange={(e) => setItem({ ...item, macroactivity: e.target.value })}>{macroactivities.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.code} · {entry.name}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12}><TextField fullWidth required multiline minRows={2} label="Actividad específica" value={item.activity} onChange={(e) => setItem({ ...item, activity: e.target.value })} /></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth select label="Tipo de indicador" value={item.indicator_type} onChange={(e) => setItem({ ...item, indicator_type: e.target.value })}>{['Gestión','Resultado','Producto','Impacto'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="date" label="Fecha inicial" InputLabelProps={{ shrink: true }} value={item.starts_on} onChange={(e) => setItem({ ...item, starts_on: e.target.value })} /></Grid><Grid item xs={12} md={4}><TextField fullWidth type="date" label="Fecha final" InputLabelProps={{ shrink: true }} value={item.ends_on} onChange={(e) => setItem({ ...item, ends_on: e.target.value })} /></Grid>
        <Grid item xs={12} md={8}><TextField fullWidth required multiline label="Indicador y forma de medición" value={item.indicator} onChange={(e) => setItem({ ...item, indicator: e.target.value })} /></Grid><Grid item xs={12} md={4}><TextField fullWidth required label="Meta" value={item.target} onChange={(e) => setItem({ ...item, target: e.target.value })} /></Grid>
        <Grid item xs={12} md={8}><TextField fullWidth label="Corresponsables, separados por coma" value={item.co_responsibles} onChange={(e) => setItem({ ...item, co_responsibles: e.target.value })} /></Grid><Grid item xs={12} md={4}><TextField fullWidth type="number" label="Presupuesto estimado" value={item.budget} onChange={(e) => setItem({ ...item, budget: e.target.value })} /></Grid>
        {customFields.map((field) => <Grid item xs={12} md={['long_text','file'].includes(field.data_type) ? 12 : 6} key={field.id}><TextField fullWidth required={field.required} select={['list','catalog','catalog_multi'].includes(field.data_type) && (field.options || []).length > 0} multiline={field.data_type === 'long_text'} minRows={field.data_type === 'long_text' ? 3 : undefined} type={field.data_type === 'date' ? 'date' : ['number','percentage','currency'].includes(field.data_type) ? 'number' : 'text'} InputLabelProps={field.data_type === 'date' ? { shrink: true } : undefined} label={field.label} value={item.custom_values?.[field.key] || ''} onChange={(e) => setItem({ ...item, custom_values: { ...(item.custom_values || {}), [field.key]: e.target.value } })}>{['list','catalog','catalog_multi'].includes(field.data_type) && (field.options || []).map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}</TextField></Grid>)}
      </Grid><Button sx={{ mt: 2 }} variant="contained" startIcon={<Add />} disabled={saving} onClick={saveItem}>Agregar actividad al plan</Button></Paper>
      <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Código</TableCell><TableCell>Actividad</TableCell><TableCell>Indicador</TableCell><TableCell>Meta</TableCell><TableCell>Fechas</TableCell></TableRow></TableHead><TableBody>{(detail.items || []).map((row) => <TableRow key={row.id}><TableCell>{row.code}</TableCell><TableCell>{row.activity}</TableCell><TableCell>{row.indicator}</TableCell><TableCell>{row.target}</TableCell><TableCell>{row.starts_on || '—'} / {row.ends_on || '—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer></>}

      {tab === 'meeting' && <><Alert severity="info">Registre la reunión de concertación. Un participante por línea con: Nombre | correo | entidad | cargo.</Alert><Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}><Grid container spacing={2}><Grid item xs={12} md={6}><TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Inicio" value={meeting.starts_at} onChange={(e) => setMeeting({ ...meeting, starts_at: e.target.value })} /></Grid><Grid item xs={12} md={6}><TextField fullWidth type="datetime-local" InputLabelProps={{ shrink: true }} label="Fin" value={meeting.ends_at} onChange={(e) => setMeeting({ ...meeting, ends_at: e.target.value })} /></Grid><Grid item xs={12} md={6}><TextField fullWidth select label="Lugar" value={meeting.location} onChange={(e) => setMeeting({ ...meeting, location: e.target.value })}>{locations.map((entry) => <MenuItem key={entry.id} value={entry.name}>{entry.name}</MenuItem>)}</TextField></Grid><Grid item xs={12} md={6}><TextField fullWidth select label="Modalidad" value={meeting.modality} onChange={(e) => setMeeting({ ...meeting, modality: e.target.value })}>{['Presencial','Virtual','Híbrida'].map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField></Grid><Grid item xs={12}><TextField fullWidth required multiline label="Objetivo de la reunión" value={meeting.objective} onChange={(e) => setMeeting({ ...meeting, objective: e.target.value })} /></Grid><Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Desarrollo" value={meeting.development} onChange={(e) => setMeeting({ ...meeting, development: e.target.value })} /></Grid><Grid item xs={12}><TextField fullWidth multiline minRows={4} label="Participantes" placeholder="María Pérez | maria@unicesmag.edu.co | UNICESMAG | Directora" value={meeting.participants_text} onChange={(e) => setMeeting({ ...meeting, participants_text: e.target.value })} /></Grid></Grid><Button sx={{ mt: 2 }} variant="contained" startIcon={<Event />} onClick={saveMeeting}>Guardar reunión</Button></Paper>
      {(detail.meetings || []).map((row) => { const minute = [...(row.minuteVersions || [])].sort((a,b) => b.version-a.version)[0]; return <Paper key={row.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction={{ xs:'column',md:'row' }} justifyContent="space-between" gap={1}><Box><Typography fontWeight={900}>{new Date(row.starts_at).toLocaleString('es-CO')} · {row.location}</Typography><Typography color="text.secondary">{row.objective} · {row.participants?.length || 0} participantes</Typography></Box><Stack direction="row" gap={1}>{!minute ? <Button startIcon={<Description />} onClick={() => generateMinute(row.id)}>Generar acta</Button> : <><Chip label={`Acta V${minute.version} · ${minute.status}`} /><Button disabled={minute.status !== 'draft'} onClick={() => publishMinute(minute.id)}>Publicar y crear QR</Button></>}</Stack></Stack></Paper>; })}
      {published && <Paper variant="outlined" sx={{ p:2,textAlign:'center' }}><Typography fontWeight={900}>QR para firmas</Typography><img src={published.qr_data_url} alt="QR de firma" width="220" /><Typography sx={{ wordBreak:'break-all' }}>{published.signing_url}</Typography></Paper>}</>}

      {tab === 'workflow' && <><Alert severity="warning">Estado actual: <strong>{STATUS_LABELS[detail.status] || detail.status}</strong>. Cada cambio queda auditado con usuario, fecha e IP.</Alert><Paper variant="outlined" sx={{ p:3,borderRadius:3 }}><Typography variant="h6" fontWeight={900} mb={2}>Siguiente acción disponible</Typography>{availableTransitions.length ? <Stack direction={{xs:'column',sm:'row'}} gap={2}>{availableTransitions.map((entry) => <Button key={entry.action} variant="contained" startIcon={<PlayArrow />} onClick={() => transition(entry.action)}>{ACTION_LABELS[entry.action] || entry.action}</Button>)}</Stack> : <Alert severity="info">No hay transiciones disponibles desde este estado.</Alert>}</Paper><TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Fecha</TableCell><TableCell>Estado anterior</TableCell><TableCell>Nuevo estado</TableCell><TableCell>Acción</TableCell><TableCell>Comentario</TableCell></TableRow></TableHead><TableBody>{[...(detail.workflowEvents || [])].reverse().map((event) => <TableRow key={event.id}><TableCell>{new Date(event.created_at).toLocaleString('es-CO')}</TableCell><TableCell>{event.from_state || 'Inicio'}</TableCell><TableCell>{event.to_state}</TableCell><TableCell>{ACTION_LABELS[event.action] || event.action}</TableCell><TableCell>{event.comment || '—'}</TableCell></TableRow>)}</TableBody></Table></TableContainer></>}

      {tab === 'followup' && <><Alert severity="info">Seleccione una actividad y el periodo. Puede guardar avance y adjuntar la evidencia en la misma operación.</Alert><Paper variant="outlined" sx={{ p:2.5,borderRadius:3 }}><Grid container spacing={2}><Grid item xs={12} md={6}><TextField fullWidth select label="Actividad" value={monitoring.item_id} onChange={(e) => setMonitoring({ ...monitoring, item_id:e.target.value })}>{(detail.items || []).map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.code} · {entry.activity}</MenuItem>)}</TextField></Grid><Grid item xs={12} md={3}><TextField fullWidth select label="Periodo" value={monitoring.period_id} onChange={(e) => setMonitoring({ ...monitoring, period_id:e.target.value })}>{periods.map((entry) => <MenuItem key={entry.id} value={entry.id}>{entry.code} · {entry.name}</MenuItem>)}</TextField></Grid><Grid item xs={12} md={3}><TextField fullWidth type="number" inputProps={{min:0,max:100}} label="Avance físico %" value={monitoring.physical_progress} onChange={(e) => setMonitoring({ ...monitoring, physical_progress:e.target.value })} /></Grid><Grid item xs={12}><TextField fullWidth multiline minRows={3} label="Observaciones" value={monitoring.observations} onChange={(e) => setMonitoring({ ...monitoring, observations:e.target.value })} /></Grid><Grid item xs={12} md={6}><Button component="label" fullWidth variant="outlined" startIcon={<CloudUpload />}>{monitoring.file?.name || 'Seleccionar evidencia'}<input hidden type="file" onChange={(e) => setMonitoring({ ...monitoring, file:e.target.files?.[0] || null })} /></Button></Grid><Grid item xs={12} md={6}><TextField fullWidth label="Descripción de la evidencia" value={monitoring.description} onChange={(e) => setMonitoring({ ...monitoring, description:e.target.value })} /></Grid></Grid><Button sx={{mt:2}} variant="contained" disabled={saving} onClick={saveFollowUp}>Guardar seguimiento</Button></Paper></>}
    </Stack>}</DialogContent><DialogActions sx={{ borderTop:'1px solid #e2e8f0' }}><Button startIcon={<Download />} onClick={exportPlan}>Exportar DIR-PE-FR-003</Button><Button onClick={onClose}>Cerrar formulario</Button></DialogActions>
  </Dialog>;
}
