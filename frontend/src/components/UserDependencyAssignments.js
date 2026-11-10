import React from 'react';
import { Autocomplete, Box, Button, Stack, TextField, Typography } from '@mui/material';

const key = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const dependencyAssignments = (profile) => {
  const items = [profile, ...(profile.dependencias_asignadas || [])];
  return items.filter((item, index) => item.dependencia && items.findIndex((other) => key(other.dependencia) === key(item.dependencia)) === index)
    .map(({ dependencia, vicerrectoria = '', jefe_inmediato = '', cargo = profile.cargo || '' }) => ({ dependencia, vicerrectoria, jefe_inmediato, cargo }));
};

export default function UserDependencyAssignments({ profile, onChange, options, relations = [], bosses = [], vicerrectorias = [], cargos = [], error = '' }) {
  const empty = { dependencia: '', vicerrectoria: '', jefe_inmediato: '', cargo: '' };
  const assignments = [{ dependencia: profile.dependencia || '', vicerrectoria: profile.vicerrectoria || '', jefe_inmediato: profile.jefe_inmediato || '', cargo: profile.cargo || '' }, ...(profile.dependencias_asignadas || []).map((item) => ({ ...item, cargo: item.cargo || profile.cargo || '' }))];
  const rector = key(profile.cargo) === 'rector';
  const save = (items) => onChange({ ...profile, ...(items[0] || empty), dependencias_asignadas: items.slice(1) });
  const update = (index, values) => save(assignments.map((item, i) => i === index ? { ...item, ...values } : item));
  const complete = assignments.every((item) => item.dependencia && item.vicerrectoria && item.cargo && (rector || item.jefe_inmediato));
  return <Stack spacing={1.5} sx={{ mb: 2 }}>
    {assignments.map((item, index) => <Box key={index} sx={{ p: 2, border: '1px solid #dbe4f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle2">Dependencia {index + 1}{index === 0 ? ' · Principal' : ''}</Typography>
        {assignments.length > 1 && <Button size="small" color="error" aria-label={`Quitar dependencia ${index + 1}`} onClick={() => save(assignments.filter((_, i) => i !== index))}>Quitar</Button>}
      </Stack>
      <Stack spacing={1.5}>
        <Autocomplete options={options.filter((option) => !assignments.some((other, i) => i !== index && key(other.dependencia) === key(option)))} value={item.dependencia || null}
          isOptionEqualToValue={(a, b) => key(a) === key(b)}
          onChange={(_, value) => {
            const matches = relations.filter((row) => key(row.dependencia) === key(value) && row.jefe_inmediato);
            const suggested = new Set(matches.map((row) => key(row.jefe_inmediato))).size === 1 ? matches[0] : {};
            update(index, { dependencia: value || '', vicerrectoria: suggested.vicerrectoria || '', jefe_inmediato: suggested.jefe_inmediato || '', cargo: item.cargo || profile.cargo || '' });
          }}
          renderInput={(params) => <TextField {...params} required label={`Dependencia ${index + 1}`} error={index === 0 && Boolean(error)} helperText={index === 0 ? error : ''} />} />
        <Autocomplete freeSolo options={vicerrectorias} value={item.vicerrectoria || ''} inputValue={item.vicerrectoria || ''}
          onChange={(_, value) => update(index, { vicerrectoria: value || '' })}
          onInputChange={(_, value, reason) => { if (reason === 'input' || reason === 'clear') update(index, { vicerrectoria: value || '' }); }}
          renderInput={(params) => <TextField {...params} required label={`Vicerrectoría de la dependencia ${index + 1}`} />} />
        <Autocomplete freeSolo options={cargos} value={item.cargo || ''} inputValue={item.cargo || ''}
          onChange={(_, value) => update(index, { cargo: value || '' })}
          onInputChange={(_, value, reason) => { if (reason === 'input' || reason === 'clear') update(index, { cargo: value || '' }); }}
          renderInput={(params) => <TextField {...params} required label={`Cargo de la dependencia ${index + 1}`} />} />
        {!rector && <Autocomplete freeSolo options={bosses} value={item.jefe_inmediato || ''} inputValue={item.jefe_inmediato || ''}
          onChange={(_, value) => update(index, { jefe_inmediato: value || '' })}
          onInputChange={(_, value, reason) => { if (reason === 'input' || reason === 'clear') update(index, { jefe_inmediato: value || '' }); }}
          renderInput={(params) => <TextField {...params} required label={`Jefe inmediato de la dependencia ${index + 1}`} />} />}
      </Stack>
    </Box>)}
    <Box>
      <Button variant="outlined" size="small" disabled={!complete} onClick={() => save([...assignments, { ...empty }])}>Agregar otra dependencia</Button>
      {!complete && <Typography variant="caption" display="block" sx={{ mt: 0.5, color: 'text.secondary' }}>Complete esta dependencia antes de agregar otra.</Typography>}
    </Box>
  </Stack>;
}
