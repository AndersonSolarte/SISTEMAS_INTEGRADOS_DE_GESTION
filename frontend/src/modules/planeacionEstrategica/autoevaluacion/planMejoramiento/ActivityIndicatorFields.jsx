import React, { useState } from 'react';
import { Box, Button, IconButton, Menu, MenuItem, Stack, TextField, Tooltip, Typography } from '@mui/material';
import DeleteOutline from '@mui/icons-material/DeleteOutline';
import Add from '@mui/icons-material/Add';
import AssessmentOutlined from '@mui/icons-material/AssessmentOutlined';

import { resolveActivityIndicators, indicatorErrors } from './activityIndicatorRules';
export { resolveActivityIndicators } from './activityIndicatorRules';

export default function ActivityIndicatorFields({ activity, onChange }) {
  const values = resolveActivityIndicators(activity);
  const errors = indicatorErrors(activity);
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
      <Box key={field} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr) 36px', sm: 'repeat(2, minmax(0, 1fr)) 36px', lg: '85px minmax(0, 1fr) minmax(130px, 17%) 170px 170px 36px' }, gap: 1.25, alignItems: 'start', p: 1.5, bgcolor: '#fff', borderTop: '1px solid #e9eef5' }}>
        <Stack sx={{ gridColumn: { xs: '1 / -1', lg: 'auto' }, pt: { lg: 1 } }}>
          <Typography sx={{ fontSize: 13, fontWeight: 800, color, textTransform: 'capitalize' }}>{label}</Typography>
        </Stack>
        <TextField label={`Indicador de ${label}`} inputProps={{ 'aria-label': `Indicador de ${label}` }} required error={Boolean(errors[field])} title={errors[field] || undefined} fullWidth size="small" multiline minRows={1} InputLabelProps={{ shrink: true }} value={values[field]} onChange={(event) => onChange(field, event.target.value)} sx={{ ...inputStyle, gridColumn: { xs: '1 / -1', lg: 'auto' } }} />
          <TextField label={`Meta de ${label}`} inputProps={{ 'aria-label': `Meta de ${label}` }} required error={Boolean(errors[target])} title={errors[target] || undefined} fullWidth size="small" multiline minRows={1} InputLabelProps={{ shrink: true }} value={values[target]} onChange={(event) => onChange(target, event.target.value)} sx={{ ...inputStyle, gridColumn: { xs: '1', sm: 'auto' } }} />
          {['Inicio', 'Fin'].map((phase) => {
            const dateField = `fecha${phase}${label[0].toUpperCase()}${label.slice(1)}`;
            return <TextField key={dateField} label={`Fecha ${phase.toLowerCase()} de ${label}`} inputProps={{ 'aria-label': `Fecha ${phase.toLowerCase()} de ${label}` }} required error={Boolean(errors[dateField])} title={errors[dateField] || undefined} type="date" fullWidth size="small" InputLabelProps={{ shrink: true }} value={values[dateField]} onChange={(event) => onChange(dateField, event.target.value)} sx={inputStyle} />;
          })}
          <Tooltip title={`Quitar indicador de ${label}`}><IconButton size="small" aria-label={`Quitar indicador de ${label}`} onClick={() => onChange(`${field}Activo`, false)} sx={{ color: '#64748b', gridColumn: { xs: 2, sm: 3, lg: 'auto' }, gridRow: { xs: 3, sm: 3, lg: 'auto' } }}><DeleteOutline fontSize="small" /></IconButton></Tooltip>
      </Box>
      : null
    )}
  </Box>;
}
