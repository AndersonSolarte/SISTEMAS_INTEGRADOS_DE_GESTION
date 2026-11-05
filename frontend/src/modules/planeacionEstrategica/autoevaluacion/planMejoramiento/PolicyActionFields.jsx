import React, { useState } from 'react';
import { Autocomplete, Box, Checkbox, ClickAwayListener, TextField } from '@mui/material';

export default function PolicyActionFields({ policies = [], selectedPolicies = [], selectedLines = [], onPolicyChange, onLinesChange, onRefresh }) {
  const [linesOpen, setLinesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  const savedName = selectedPolicies[0] || null;
  const policy = policies.find((item) => normalize(item.name) === normalize(savedName));
  const selected = policy?.name || savedName;
  const options = [...new Set(policies.map((item) => item.name))];
  const lines = selected ? policy?.actionLines || [] : [...new Set(policies.flatMap((item) => item.actionLines || []))];
  const refresh = async () => {
    if (!onRefresh || loading) return;
    setLoading(true);
    try { await onRefresh(); } finally { setLoading(false); }
  };
  return <ClickAwayListener onClickAway={() => setLinesOpen(false)}>
    <Box onKeyDown={(event) => { if (event.key === 'Escape') setLinesOpen(false); }} sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' }, gap: 1.5, minWidth: 0 }}>
    <Autocomplete
      forcePopupIcon
      options={options}
      value={selected}
      loading={loading}
      loadingText="Cargando políticas..."
      noOptionsText="No hay políticas disponibles"
      onOpen={refresh}
      onChange={(_event, name) => {
        onPolicyChange(name ? [name] : []);
        setLinesOpen(Boolean(name));
      }}
      renderInput={(params) => <TextField {...params} label="Política institucional" placeholder="Seleccione una política" />}
      sx={{ gridColumn: { md: 'span 6' } }}
    />
    <Autocomplete
      multiple
      forcePopupIcon
      disableCloseOnSelect
      options={lines}
      value={selectedLines}
      open={linesOpen}
      onOpen={() => { setLinesOpen(true); refresh(); }}
      onClose={() => setLinesOpen(false)}
      onChange={(_event, values) => onLinesChange(values)}
      noOptionsText="Esta política no tiene líneas registradas"
      renderOption={(props, option, { selected: checked }) => <li {...props}><Checkbox checked={checked} sx={{ mr: 1 }} />{option}</li>}
      renderInput={(params) => <TextField {...params} label="Líneas de acción" placeholder={selected ? 'Seleccione sus líneas' : 'Todas las líneas disponibles'} />}
      sx={{ gridColumn: { md: 'span 6' } }}
    />
    </Box>
  </ClickAwayListener>;
}
