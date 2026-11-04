import React, { useState } from 'react';
import { Autocomplete, Checkbox, TextField } from '@mui/material';

export default function PolicyActionFields({ policies = [], selectedPolicies = [], selectedLines = [], onPolicyChange, onLinesChange, onRefresh, onCreate }) {
  const [linesOpen, setLinesOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
  const savedName = selectedPolicies[0] || null;
  const policy = policies.find((item) => normalize(item.name) === normalize(savedName));
  const selected = policy?.name || savedName;
  const options = [...new Set(policies.map((item) => item.name))];
  const lines = [...new Set([...(policy?.actionLines || []), ...selectedLines])];
  const choosePolicy = async (_event, value) => {
    const name = String(value || '').trim();
    setError('');
    if (!name) { onPolicyChange([]); setLinesOpen(false); return; }
    const existing = policies.find((item) => normalize(item.name) === normalize(name));
    if (existing) { onPolicyChange([existing.name]); setLinesOpen(true); return; }
    setSaving(true);
    try {
      const created = await onCreate(name, []);
      onPolicyChange([created.name]);
      setLinesOpen(true);
    } catch (failure) {
      setError(failure.response?.data?.message || 'No fue posible crear la política.');
    } finally { setSaving(false); }
  };
  const chooseLines = async (_event, values) => {
    const clean = [...new Set(values.map((value) => value.trim()).filter(Boolean))];
    const additions = clean.filter((line) => !lines.some((item) => normalize(item) === normalize(line)));
    setError('');
    if (!additions.length) { onLinesChange(clean); return; }
    setSaving(true);
    try {
      const updated = await onCreate(selected, additions);
      onLinesChange(clean.map((line) => updated.actionLines.find((item) => normalize(item) === normalize(line)) || line));
    } catch (failure) {
      setError(failure.response?.data?.message || 'No fue posible crear la línea de acción.');
    } finally { setSaving(false); }
  };
  const refresh = async () => {
    if (!onRefresh || loading) return;
    setLoading(true);
    try { await onRefresh(); } finally { setLoading(false); }
  };
  return <>
    <Autocomplete
      freeSolo
      forcePopupIcon
      disabled={saving}
      options={options}
      value={selected}
      loading={loading || saving}
      loadingText="Cargando políticas..."
      noOptionsText="No hay políticas disponibles"
      onOpen={refresh}
      onChange={choosePolicy}
      renderInput={(params) => <TextField {...params} label="Política institucional" placeholder="Seleccione o escriba una política" error={Boolean(error)} helperText={error || 'Para crear una política, escriba el nombre y pulse Enter.'} />}
      sx={{ gridColumn: { md: 'span 6' } }}
    />
    <Autocomplete
      multiple
      freeSolo
      forcePopupIcon
      disableCloseOnSelect
      options={lines}
      value={selectedLines.filter((line) => lines.includes(line))}
      disabled={!selected || saving}
      open={Boolean(selected) && linesOpen}
      onOpen={() => setLinesOpen(true)}
      onClose={() => setLinesOpen(false)}
      onChange={chooseLines}
      noOptionsText="Esta política no tiene líneas registradas"
      renderOption={(props, option, { selected: checked }) => <li {...props}><Checkbox checked={checked} sx={{ mr: 1 }} />{option}</li>}
      renderInput={(params) => <TextField {...params} label="Líneas de acción" placeholder={selected ? 'Seleccione o escriba una línea' : 'Seleccione una política primero'} helperText={selected ? 'Para añadir una línea, escríbala y pulse Enter.' : undefined} />}
      sx={{ gridColumn: { md: 'span 6' } }}
    />
  </>;
}
