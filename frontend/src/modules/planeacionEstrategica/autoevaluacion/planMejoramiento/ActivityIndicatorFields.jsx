import React, { useState } from 'react';
import { Box, Button, IconButton, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Add from '@mui/icons-material/Add';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';

export const resolveActivityIndicators = (activity = {}) => {
  const legacyField = activity.tipoIndicador === 'Logro' ? 'indicadorLogro' : activity.tipoIndicador === 'Impacto' ? 'indicadorImpacto' : 'indicadorResultado';
  const indicators = Object.fromEntries(['indicadorResultado', 'indicadorLogro', 'indicadorImpacto'].map((field) => [field,
    activity[field] ?? (field === legacyField ? activity.indicador || '' : '')]));
  const legacyTarget = legacyField.replace('indicador', 'meta');
  const scheduling = Object.fromEntries(['Resultado', 'Logro', 'Impacto'].flatMap((kind) => [
    [`fechaEntrega${kind}`, String(activity[`fechaEntrega${kind}`] || '')],
    [`indicador${kind}Activo`, activity[`indicador${kind}Activo`] ?? Boolean(String(indicators[`indicador${kind}`] || activity[`meta${kind}`] || activity[`fechaEntrega${kind}`] || '').trim())]
  ]));
  return { ...indicators, ...scheduling, ...Object.fromEntries(['metaResultado', 'metaLogro', 'metaImpacto'].map((field) => [field, String(activity[field] ?? (field === legacyTarget ? activity.meta ?? '' : ''))])) };
};

export default function ActivityIndicatorFields({ activity, onChange }) {
  const values = resolveActivityIndicators(activity);
  const [anchor, setAnchor] = useState(null);
  const kinds = ['resultado', 'logro', 'impacto'];
  const inputStyle = {
    '& .MuiOutlinedInput-root': { alignItems: 'flex-start', bgcolor: '#fff', borderRadius: 1.5, fontSize: 13, lineHeight: 1.6 },
    '& .MuiOutlinedInput-notchedOutline': { borderColor: '#dce4ef' },
    '& .MuiInputLabel-root': { fontSize: 13, fontWeight: 600 }
  };
  return <Box component="section" aria-label="Indicadores y metas" sx={{ gridColumn: '1 / -1', minWidth: 0, border: '1px solid #dce4ef', borderRadius: 3, overflow: 'hidden', my: 0.5 }}>
    <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 1.5, py: 1, bgcolor: '#f5f8fc' }}>
      <AssessmentOutlined sx={{ fontSize: 20, color: '#2457b8' }} />
      <Typography component="h3" sx={{ flex: 1, fontSize: 14, fontWeight: 800, color: '#233653' }}>Indicadores y metas</Typography>
      <Button size="small" startIcon={<Add />} onClick={(event) => setAnchor(event.currentTarget)} sx={{ textTransform: 'none' }}>Agregar indicador</Button>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {kinds.map((kind) => {
          const field = `indicador${kind[0].toUpperCase()}${kind.slice(1)}Activo`;
          return <MenuItem key={kind} disabled={values[field]} onClick={() => { onChange(field, true); setAnchor(null); }} sx={{ textTransform: 'capitalize' }}>{kind}</MenuItem>;
        })}
      </Menu>
    </Stack>
    {[
      ['resultado', 'indicadorResultado', 'metaResultado', '#285bc0', '#edf3ff'],
      ['logro', 'indicadorLogro', 'metaLogro', '#147a73', '#edf8f5'],
      ['impacto', 'indicadorImpacto', 'metaImpacto', '#7650a6', '#f5f0fb']
    ].map(([label, field, target, color]) => values[`${field}Activo`] ?
      <Box key={field} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) 36px', sm: 'repeat(2, minmax(0, 1fr)) 36px', lg: '85px minmax(0, 1fr) minmax(150px, 20%) 175px 36px' }, gap: 1.25, alignItems: 'start', p: 1.5, bgcolor: '#fff', borderTop: '1px solid #e9eef5' }}>
        <Stack sx={{ gridColumn: { xs: '1 / -1', lg: 'auto' }, pt: { lg: 1 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color, textTransform: 'capitalize' }}>{label}</Typography>
        </Stack>
        <TextField label={`Indicador de ${label}`} fullWidth size="small" multiline minRows={2} InputLabelProps={{ shrink: true }} value={values[field]} onChange={(event) => onChange(field, event.target.value)} sx={{ ...inputStyle, gridColumn: { xs: '1 / -1', lg: 'auto' } }} />
          <TextField label={`Meta de ${label}`} fullWidth size="small" multiline minRows={2} InputLabelProps={{ shrink: true }} value={values[target]} onChange={(event) => onChange(target, event.target.value)} sx={{ ...inputStyle, gridColumn: { xs: '1', sm: 'auto' } }} />
          <TextField label={`Fecha de entrega de ${label}`} type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={values[`fechaEntrega${label[0].toUpperCase()}${label.slice(1)}`]} onChange={(event) => onChange(`fechaEntrega${label[0].toUpperCase()}${label.slice(1)}`, event.target.value)} sx={inputStyle} />
          <Tooltip title={`Quitar indicador de ${label}`}><IconButton size="small" aria-label={`Quitar indicador de ${label}`} onClick={() => onChange(`${field}Activo`, false)} sx={{ color: '#64748b', gridColumn: { xs: 2, sm: 3, lg: 'auto' }, gridRow: { xs: 3, sm: 3, lg: 'auto' } }}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
      </Box>
      : null
    )}
  </Box>;
}
