import React from 'react';
import { Autocomplete, Box, Stack, TextField, Typography } from '@mui/material';

const key = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const dependencyAssignments = (profile) => {
  const items = [profile, ...(profile.dependencias_asignadas || [])];
  return items.filter((item, index) => item.dependencia && items.findIndex((other) => key(other.dependencia) === key(item.dependencia)) === index)
    .map(({ dependencia, vicerrectoria = '', jefe_inmediato = '' }) => ({ dependencia, vicerrectoria, jefe_inmediato }));
};

export default function UserDependencyAssignments({ profile, onChange, options, relations = [], bosses = [], error = '' }) {
  const assignments = dependencyAssignments(profile);
  const updateExtra = (index, field, value) => onChange({ ...profile, dependencias_asignadas: assignments.slice(1).map((item, i) => i === index ? { ...item, [field]: value } : item) });
  return <Box sx={{ mb: 2 }}>
    <Autocomplete multiple disableCloseOnSelect options={options} value={assignments.map((item) => item.dependencia)}
      isOptionEqualToValue={(a, b) => key(a) === key(b)}
      onChange={(_, names) => {
        const next = names.map((dependencia) => {
          const existing = assignments.find((item) => key(item.dependencia) === key(dependencia));
          if (existing) return existing;
          const matches = relations.filter((item) => key(item.dependencia) === key(dependencia) && item.jefe_inmediato);
          const uniqueBosses = [...new Set(matches.map((item) => key(item.jefe_inmediato)))];
          const suggested = uniqueBosses.length === 1 ? matches[0] : {};
          return { dependencia, vicerrectoria: suggested.vicerrectoria || '', jefe_inmediato: suggested.jefe_inmediato || '' };
        });
        const primary = next[0] || { dependencia: '', vicerrectoria: '', jefe_inmediato: '' };
        onChange({ ...profile, ...primary, dependencias_asignadas: next.slice(1) });
      }}
      renderInput={(params) => <TextField {...params} label="Dependencias asignadas" error={Boolean(error)} helperText={error || 'Seleccione una o varias. La primera será la dependencia principal.'} />} />
    {assignments.slice(1).map((item, index) => <Box key={item.dependencia} sx={{ mt: 1.5, p: 2, border: '1px solid #dbe4f0', borderRadius: 2, bgcolor: '#f8fafc' }}>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{item.dependencia}</Typography>
      <Stack spacing={1.5}>
        <TextField size="small" label="Vicerrectoría de la dependencia" value={item.vicerrectoria} onChange={(event) => updateExtra(index, 'vicerrectoria', event.target.value)} />
        <Autocomplete options={bosses} value={item.jefe_inmediato || null} onChange={(_, value) => updateExtra(index, 'jefe_inmediato', value || '')}
          renderInput={(params) => <TextField {...params} size="small" required label="Jefe inmediato de la dependencia" />} />
      </Stack>
    </Box>)}
  </Box>;
}
