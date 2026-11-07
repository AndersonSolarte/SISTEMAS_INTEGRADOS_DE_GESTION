import React from 'react';
import { Box, Button, Chip, IconButton, InputAdornment, LinearProgress, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AttachFile from '@mui/icons-material/AttachFile';
import ContentCopy from '@mui/icons-material/ContentCopy';
import Visibility from '@mui/icons-material/Visibility';
import { resolveActivityIndicators } from './activityIndicatorRules';
import { activeKinds, indicatorProgress, scheduleStatus } from './indicatorTracking';

export default function IndicatorTrackingFields({ activity, disabled, busy, onChange, onUpload, onRegister, onPreview, onCopy }) {
  const values = resolveActivityIndicators(activity);
  const active = activeKinds(activity);
  const today = new Date().toLocaleDateString('sv-SE');
  return <Stack spacing={1.5}>
    {Number(activity.cumplimientoAnterior ?? (!activity.seguimientoIndicadores ? activity.metaAlcanzada : 0)) > 0 && <Typography variant="caption" color="text.secondary">Cumplimiento anterior conservado: {activity.cumplimientoAnterior ?? activity.metaAlcanzada}%. El nuevo avance se registra por indicador.</Typography>}
    {active.map((kind) => {
      const record = activity.seguimientoIndicadores?.[kind] || {};
      const progress = indicatorProgress(activity, kind);
      const latestEvidence = record.evidencias?.slice(-1)[0];
      const evidenceUrl = latestEvidence?.indicatorFolderUrl || activity.indicatorEvidenceFolders?.[kind]?.folderUrl || latestEvidence?.carpetaUrl || activity.evidenceFolderUrl || latestEvidence?.url || '';
      const update = (changes) => onChange(kind, { fecha: record.fecha || today, ...record, ...changes });
      return <Box key={kind} sx={{ border: '1px solid #dce4ef', borderRadius: 2.5, p: 2 }}>
        <Stack direction="row" justifyContent="space-between" spacing={1} alignItems="center">
          <Typography fontWeight={800}>{kind}</Typography>
          <Stack direction="row" spacing={1}><Chip size="small" label={scheduleStatus(activity, kind, today)} /><Typography fontWeight={800}>{progress.toFixed(1)}%</Typography></Stack>
        </Stack>
        <Typography sx={{ mt: 1 }}>{values[`indicador${kind}`]}</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Meta: {values[`meta${kind}`]} · {values[`fechaInicio${kind}`]} a {values[`fechaFin${kind}`]} · Peso: {(100 / active.length).toFixed(1)}%</Typography>
        <LinearProgress variant="determinate" value={progress} sx={{ my: 1.5, height: 6, borderRadius: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '180px 190px 1fr' }, gap: 1.5 }}>
          <TextField size="small" label="Cumplimiento (%)" type="number" inputProps={{ min: 0, max: 100 }} disabled={disabled || busy || !record.evidencias?.length} value={record.porcentaje ?? ''} onChange={(e) => update({ porcentaje: e.target.value === '' ? '' : Math.min(100, Math.max(0, Number(e.target.value))) })} />
          <TextField size="small" label="Fecha del corte" type="date" InputLabelProps={{ shrink: true }} inputProps={{ min: values[`fechaInicio${kind}`], max: today }} disabled={disabled || busy} value={record.fecha || ''} onChange={(e) => update({ fecha: e.target.value })} />
          <TextField size="small" multiline minRows={1} label="Observaciones" disabled={disabled || busy} value={record.observaciones || ''} onChange={(e) => update({ observaciones: e.target.value })} />
        </Box>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.5 }}>
          <Button variant="outlined" component="label" startIcon={<AttachFile />} disabled={disabled || busy}>Adjuntar evidencias de {kind.toLowerCase()}
            <input hidden multiple type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.webp,.zip" onChange={(event) => { const files = Array.from(event.target.files || []); event.target.value = ''; onUpload(kind, files); }} />
          </Button>
          <Button variant="contained" disabled={disabled || busy || !record.evidencias?.length} onClick={() => onRegister(kind)}>Registrar corte</Button>
          <TextField size="small" label="Enlace de evidencias" value={evidenceUrl} placeholder="Pendiente de sincronización" sx={{ flex: 1, minWidth: { sm: 240 } }}
            inputProps={{ 'aria-label': `Enlace de evidencias de ${kind.toLowerCase()}` }}
            InputProps={{ readOnly: true, endAdornment: <InputAdornment position="end">
              <Tooltip title="Copiar URL"><span><IconButton color="primary" aria-label={`Copiar URL de ${kind.toLowerCase()}`} disabled={!evidenceUrl} onClick={() => onCopy?.(evidenceUrl)}><ContentCopy fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Previsualizar evidencias"><span><IconButton color="primary" aria-label={`Previsualizar evidencias de ${kind.toLowerCase()}`} disabled={!evidenceUrl && !latestEvidence} onClick={() => onPreview(latestEvidence, kind)}><Visibility fontSize="small" /></IconButton></span></Tooltip>
            </InputAdornment> }} />
        </Stack>
        {!!record.evidencias?.length && <Stack spacing={0.5} sx={{ mt: 1 }}>{record.evidencias.map((evidence, index) => <Button key={evidence.driveFileId || evidence.url || index} sx={{ justifyContent: 'flex-start', textTransform: 'none', overflowWrap: 'anywhere' }} onClick={() => onPreview(evidence)}>{/^\[Evidencia de /i.test(evidence.nombre || '') ? evidence.nombre : `Evidencia de ${kind.toLowerCase()} · ${evidence.nombre || `Archivo ${index + 1}`}`}</Button>)}</Stack>}
      </Box>;
    })}
  </Stack>;
}
