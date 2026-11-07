import React from 'react';
import { Autocomplete, Checkbox, TextField } from '@mui/material';

const resourceOptions = ['Financieros', 'Físicos', 'Tecnológicos', 'Humanos'];
const normalize = (value) => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
export const parseResources = (value) => [...new Set((Array.isArray(value) ? value : String(value || '').split(';'))
  .map((item) => String(item).trim()).filter(Boolean)
  .map((item) => resourceOptions.find((option) => normalize(option) === normalize(item)) || item))];

export default function ActivityResourceField({ value, onChange }) {
  const selected = parseResources(value);
  return <Autocomplete multiple disableCloseOnSelect size="small"
    options={[...new Set([...resourceOptions, ...selected])]}
    value={selected}
    onChange={(_event, next) => onChange(next.join('; '))}
    renderOption={(props, option, { selected: checked }) => <li {...props}><Checkbox checked={checked} sx={{ mr: 1 }} />{option}</li>}
    renderInput={(params) => <TextField {...params} label="Recursos" placeholder={selected.length ? 'Agregar recurso' : 'Seleccione uno o varios recursos'} />}
    sx={{ gridColumn: '1 / -1', minWidth: 0 }} />;
}
