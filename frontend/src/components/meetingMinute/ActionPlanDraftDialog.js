import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import meetingMinuteService from '../../services/meetingMinuteService';
import RichTextEditor, { sanitizeRichHtml } from './RichTextEditor';
import { minuteScrollStyles } from './minuteScrollStyles';

const values = row => ({ title: row.title || '', starts_at: row.starts_at || '', ends_at: row.ends_at || '', location: row.location || '', modality: row.modality || '', objective: row.objective || '', development: row.development || '', conclusions: (row.commitments || []).map(c => typeof c === 'string' ? c : c.description || '').join('\n') });
const localDate = date => { if (!date) return ''; const d = new Date(date); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const isDraft = row => row?.status === 'draft' && (row.minuteVersions || []).every(v => v.status === 'draft');

export default function ActionPlanDraftDialog() {
  const location = useLocation();
  const navigate = useNavigate();
  const [id, setId] = useState(null);
  const [row, setRow] = useState(null);
  const [form, setForm] = useState({});
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [myMinutes, setMyMinutes] = useState([]);
  const baseline = useRef(null);
  const local = useRef({});
  const saving = useRef(false);
  const conflict = useRef(false);
  const generation = useRef(0);
  const apply = data => { baseline.current = data; local.current = values(data); setRow(data); setForm(local.current); };
  useEffect(() => {
    const requested = new URLSearchParams(location.search).get('planMinute');
    if (requested) setId(requested);
  }, [location.search]);
  useEffect(() => {
    const open = e => setId(e.detail.meetingId);
    window.addEventListener('open-action-plan-minute', open);
    return () => window.removeEventListener('open-action-plan-minute', open);
  }, []);
  useEffect(() => {
    if (!id) return undefined;
    const epoch = ++generation.current;
    baseline.current = null; conflict.current = false; setRow(null); setMessage('');
    meetingMinuteService.listActionPlanDrafts().then(response => { if (generation.current === epoch) setMyMinutes(response.data || []); }).catch(() => {});
    const refresh = async () => {
      if (saving.current || document.hidden) return;
      try {
        const response = await meetingMinuteService.getActionPlanDraft(id);
        if (generation.current !== epoch) return;
        const dirty = baseline.current && JSON.stringify(local.current) !== JSON.stringify(values(baseline.current));
        if (!dirty) apply(response.data);
        else if (!isDraft(response.data)) { baseline.current = response.data; setRow(response.data); conflict.current = true; setMessage('El acta ya fue enviada a firmas. Su texto local se conserva para consulta.'); }
      } catch (e) { if (generation.current === epoch) setMessage(e.response?.data?.message || 'No se pudo consultar el acta.'); }
    };
    refresh(); const timer = setInterval(refresh, 3000);
    return () => { generation.current++; clearInterval(timer); };
  }, [id]);
  const save = async () => {
    const base = baseline.current;
    if (!base || !isDraft(base) || saving.current || conflict.current) return;
    const snapshot = { ...local.current };
    const original = values(base);
    const changes = {};
    for (const key of Object.keys(snapshot)) if (snapshot[key] !== original[key]) {
      if (key === 'conclusions') changes.commitments = snapshot[key] ? [snapshot[key]] : [];
      else changes[key] = snapshot[key];
    }
    if (!Object.keys(changes).length) return;
    saving.current = true; setBusy(true); setMessage('Guardando...');
    const epoch = generation.current;
    try {
      const response = await meetingMinuteService.updateActionPlanDraft(id, { expected_updated_at: base.updated_at, changes });
      if (generation.current !== epoch) return;
      const next = values(response.data);
      for (const key of Object.keys(snapshot)) if (local.current[key] !== snapshot[key]) next[key] = local.current[key];
      baseline.current = response.data; local.current = next; setRow(response.data); setForm(next); setMessage('Cambios guardados.');
    } catch (e) {
      if (generation.current !== epoch) return;
      conflict.current = e.response?.status === 409;
      setMessage(e.response?.data?.message || 'No se pudo guardar. Su texto permanece en el formulario.');
    } finally { saving.current = false; setBusy(false); }
  };
  useEffect(() => {
    if (!id || !row || conflict.current) return undefined;
    const timer = setTimeout(save, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, id, row]);
  const change = (key, value) => { local.current = { ...local.current, [key]: value }; setForm(local.current); };
  const close = async () => {
    if (saving.current) return;
    const dirty = baseline.current && JSON.stringify(local.current) !== JSON.stringify(values(baseline.current));
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Cerrar y descartarlos?')) return;
    setId(null);
    const params = new URLSearchParams(location.search); params.delete('planMinute');
    navigate({ pathname: location.pathname, search: params.toString() }, { replace: true });
  };
  const disabled = !row || !isDraft(row);
  return <Dialog open={Boolean(id)} onClose={close} fullWidth maxWidth="xl">
    <DialogTitle>Actas del Plan de Acción · {row?.actionPlan?.code || ''}<Typography component="span" display="block" variant="subtitle2">{row?.title || 'Cargando acta...'}</Typography></DialogTitle>
    <DialogContent sx={{ ...minuteScrollStyles }}>
      {myMinutes.length > 0 && <TextField select fullWidth sx={{ mb: 2 }} label="Mis actas del Plan de Acción" value={myMinutes.some(m => m.id === id) ? id : ''} onChange={e => { if (baseline.current && JSON.stringify(local.current) !== JSON.stringify(values(baseline.current)) && !window.confirm('Hay cambios sin guardar. Cambiar de acta los descartara. Continuar?')) return; setId(e.target.value); }} disabled={busy}>{myMinutes.map(m => <MenuItem key={m.id} value={m.id}>{m.title} - {m.actionPlan?.code}</MenuItem>)}</TextField>}
      <Alert severity="info" sx={{ mb: 2 }}>Borrador compartido con el responsable principal y los corresponsables. Los cambios se guardan automáticamente y se actualizan cada 3 segundos. La edición termina al enviar a firmas.</Alert>
      {message && <Alert severity={conflict.current ? 'warning' : 'info'} sx={{ mb: 2 }}>{message}</Alert>}
      {conflict.current && <Button onClick={async () => { if (!window.confirm('Se reemplazará el texto local por la versión guardada. Copie primero lo que necesite conservar.')) return; try { const res = await meetingMinuteService.getActionPlanDraft(id); conflict.current = false; apply(res.data); setMessage('Versión actualizada.'); } catch (_) { setMessage('No se pudo actualizar. El texto local se conserva.'); } }}>Cargar versión reciente</Button>}
      {row && <Stack spacing={2}>
        <TextField label="Título del acta" value={form.title} disabled={disabled} onChange={e => change('title', e.target.value)} />
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
          {['starts_at', 'ends_at'].map(key => <TextField key={key} label={key === 'starts_at' ? 'Inicio' : 'Fin'} type="datetime-local" value={localDate(form[key])} InputLabelProps={{ shrink: true }} disabled={disabled} onChange={e => change(key, e.target.value ? new Date(e.target.value).toISOString() : '')} />)}
          <TextField label="Lugar" value={form.location} disabled={disabled} onChange={e => change('location', e.target.value)} />
          <TextField label="Modalidad" value={form.modality} disabled={disabled} onChange={e => change('modality', e.target.value)} />
        </Stack>
        <Typography variant="body2">{(row.participants || []).filter(p => ['principal', 'co_responsible'].includes(p.meeting_role)).map(p => `${p.name} (${p.meeting_role === 'principal' ? 'Responsable principal' : 'Corresponsable'})`).join(' · ')}</Typography>
        {[['objective', 'Objetivo'], ['development', 'Desarrollo'], ['conclusions', 'Conclusiones / Compromisos']].map(([key, label]) => disabled ? <Box key={key}><Typography fontWeight={800}>{label}</Typography><Box dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(form[key]) }} /></Box> : <RichTextEditor key={key} id={`shared-minute-${key}`} label={label} value={form[key]} onChange={value => change(key, value)} minHeight={120} />)}
      </Stack>}
    </DialogContent>
    <DialogActions><Button disabled={busy} onClick={close}>Cerrar</Button><Button disabled={busy || disabled || conflict.current} onClick={save}>Guardar cambios</Button></DialogActions>
  </Dialog>;
}
