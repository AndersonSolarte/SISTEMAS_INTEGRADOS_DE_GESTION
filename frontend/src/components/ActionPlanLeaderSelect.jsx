import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, CircularProgress, Stack, TextField } from '@mui/material';
import strategicPlanningService from '../services/strategicPlanningService';
import { leaderProfile } from '../utils/actionPlanLeader';

const normalize = text => String(text || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function ActionPlanLeaderSelect({ planId, value, currentLeader, onChange, onOptionsLoaded, disabled }) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const onLoaded = useRef(onOptionsLoaded);
  onLoaded.current = onOptionsLoaded;
  const load = useCallback(async () => {
    const generation = ++request.current;
    if (!planId) { setLoading(false); setError('No se pudo identificar el PED. Cierre y abra el formulario.'); return; }
    setLoading(true); setError('');
    try {
      const response = await strategicPlanningService.leaderOptions(planId);
      if (generation !== request.current) return;
      if (!Array.isArray(response.data)) throw new Error('Respuesta de usuarios inválida.');
      setOptions(response.data);
      onLoaded.current?.(response.data);
    } catch (e) {
      if (generation === request.current) setError(e.response?.data?.message || 'No se pudieron cargar los usuarios. Puede reintentar o retirar al responsable actual.');
    } finally {
      if (generation === request.current) setLoading(false);
    }
  }, [planId]);
  useEffect(() => { setOptions([]); load(); return () => { request.current++; }; }, [load]);
  const selected = !value ? null : options.find(option => String(option.id) === String(value))
    || (String(currentLeader?.id) === String(value) ? leaderProfile(currentLeader) : null)
    || { id: value, name: 'Usuario asignado (ID ' + value + ')' };
  const available = selected && !options.some(option => String(option.id) === String(selected.id)) ? [selected, ...options] : options;
  return <Stack spacing={1}>
    <Autocomplete options={available} value={selected} disabled={disabled}
      loading={loading} loadingText="Cargando usuarios…" noOptionsText="No se encontraron usuarios con esa búsqueda."
      isOptionEqualToValue={(option, candidate) => String(option.id) === String(candidate.id)}
      getOptionLabel={option => [option.document, option.name || option.nombre, option.position || option.cargo].filter(Boolean).join(' · ')}
      filterOptions={(rows, state) => {
        const words = normalize(state.inputValue).split(/[^a-z0-9]+/).filter(Boolean);
        return rows.filter(row => words.every(word => normalize([row.document, row.name, row.nombre, row.position, row.email, row.dependency].join(' ')).includes(word))).slice(0, 60);
      }}
      onChange={(_, selectedUser) => onChange(selectedUser || null)}
      renderInput={params => <TextField {...params} label="Líder responsable" placeholder="Buscar por nombre, cédula, cargo o correo"
        helperText={value ? 'Puede cambiarlo o retirarlo para guardar el plan sin responsable.' : 'Sin responsable. Puede guardar así y asignarlo después.'}
        InputProps={{ ...params.InputProps, endAdornment: <>{loading && <CircularProgress size={16} />}{params.InputProps.endAdornment}</> }} />}
    />
    {value && <Button disabled={disabled} size="small" onClick={() => onChange(null)} sx={{ alignSelf: 'flex-start' }}>Retirar responsable</Button>}
    {error && <Alert severity="warning" action={<Button color="inherit" disabled={loading} onClick={load}>Reintentar</Button>}>{error}</Alert>}
  </Stack>;
}
