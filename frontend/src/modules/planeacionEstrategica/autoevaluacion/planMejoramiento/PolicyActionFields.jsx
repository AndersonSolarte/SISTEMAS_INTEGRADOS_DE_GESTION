import React, { useState } from 'react';
import { Autocomplete, Box, Checkbox, ClickAwayListener, TextField } from '@mui/material';

export default function PolicyActionFields({ policies = [], selectedPolicies = [], selectedLines = [], onPolicyChange, onLinesChange, onRefresh }) {
  const [linesOpen, setLinesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [lineQuery, setLineQuery] = useState('');
  const [lineDriven, setLineDriven] = useState(!selectedPolicies.length);
  const [manualPolicies, setManualPolicies] = useState(selectedPolicies);
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  const selected = [...new Set(selectedPolicies.map((name) => policies.find((item) => normalize(item.name) === normalize(name))?.name || name))];
  const selectedKeys = new Set(selected.map(normalize));
  const query = normalize(lineQuery);
  const relatedPolicies = policies.filter((item) => {
    const ownLines = item.actionLines || [];
    if (query) return ownLines.some((line) => normalize(line).includes(query));
    return !selectedLines.length || ownLines.some((line) => selectedLines.some((chosen) => normalize(chosen) === normalize(line)));
  });
  const options = [...new Set([...relatedPolicies.map((item) => item.name), ...selected])];
  const lines = [...new Set(policies.filter((item) => lineDriven || !selected.length || selectedKeys.has(normalize(item.name))).flatMap((item) => item.actionLines || []))];
  const refresh = async () => {
    if (!onRefresh || loading) return;
    setLoading(true);
    try { await onRefresh(); } finally { setLoading(false); }
  };
  return <ClickAwayListener onClickAway={() => setLinesOpen(false)}>
    <Box onKeyDown={(event) => { if (event.key === 'Escape') setLinesOpen(false); }} sx={{ gridColumn: '1 / -1', display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(12, minmax(0, 1fr))' }, gap: 1.5, minWidth: 0 }}>
    <Autocomplete
      multiple
      size="small"
      forcePopupIcon
      options={options}
      value={selected}
      loading={loading}
      loadingText="Cargando políticas..."
      noOptionsText={selectedLines.length || query ? 'No hay políticas asociadas a estas líneas' : 'No hay políticas disponibles'}
      onOpen={refresh}
      onChange={(_event, names) => {
        setManualPolicies(names);
        setLineDriven(!names.length);
        onPolicyChange(names);
        setLineQuery('');
        setLinesOpen(names.length > 0);
      }}
      renderOption={(props, option, { selected: checked }) => <li {...props}><Checkbox checked={checked} sx={{ mr: 1 }} />{option}</li>}
      renderInput={(params) => <TextField {...params} label="Políticas institucionales" placeholder={selected.length ? 'Agregar política' : 'Seleccione una o varias políticas'} />}
      sx={{ gridColumn: { md: 'span 6' }, minWidth: 0, '& .MuiChip-root': { height: 'auto', maxWidth: '100%' }, '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: .5 } }}
    />
    <Autocomplete
      multiple
      size="small"
      forcePopupIcon
      disableCloseOnSelect
      options={lines}
      value={selectedLines}
      open={linesOpen}
      onOpen={() => { setLinesOpen(true); refresh(); }}
      onClose={() => setLinesOpen(false)}
      onInputChange={(_event, value, reason) => { if (reason === 'input' || reason === 'clear' || reason === 'reset') setLineQuery(value); }}
      onChange={(_event, values) => {
        const owners = policies.filter((policy) => (policy.actionLines || []).some((line) => values.some((chosen) => normalize(chosen) === normalize(line)))).map((policy) => policy.name);
        const names = [...new Set([...manualPolicies, ...owners])];
        onPolicyChange(names);
        onLinesChange(values);
      }}
      noOptionsText="Esta política no tiene líneas registradas"
      renderOption={(props, option, { selected: checked }) => <li {...props}><Checkbox checked={checked} sx={{ mr: 1 }} />{option}</li>}
      renderInput={(params) => <TextField {...params} label="Líneas de acción" placeholder={selected.length ? 'Seleccione una o varias líneas' : 'Todas las líneas disponibles'} />}
      sx={{ gridColumn: { md: 'span 6' }, minWidth: 0, '& .MuiChip-root': { height: 'auto', maxWidth: '100%' }, '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: .5 } }}
    />
    </Box>
  </ClickAwayListener>;
}
