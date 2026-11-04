import React from 'react';
import { Autocomplete, TextField } from '@mui/material';

const code = (value) => String(value || '').match(/^(OE\d+|LE-?\d+)/i)?.[0].toUpperCase().replace(/^LE(\d)/, 'LE-$1');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
const matches = (option, value) => value && (normalize(option.label) === normalize(value)
  || normalize(option.name) === normalize(value) || (code(value) && option.code === code(value)));

export default function StrategicObjectiveFields({ relations = [], objective, guideline, onObjectiveChange, onGuidelineChange }) {
  const selected = relations.find((item) => matches(item, objective)) || null;
  const lines = selected?.guidelines || [];
  const selectedLine = lines.find((item) => matches(item, guideline)) || null;
  return <>
    <Autocomplete
      options={relations}
      value={selected}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      onChange={(_event, value) => onObjectiveChange(value?.label || '', value?.guidelines?.length === 1 ? value.guidelines[0].label : '')}
      noOptionsText="No hay objetivos configurados en Plan de Acción"
      renderInput={(params) => <TextField {...params} label="Objetivo estratégico" />}
      sx={{ gridColumn: { md: 'span 4' } }}
    />
    <Autocomplete
      options={lines}
      value={selectedLine}
      getOptionLabel={(option) => option.label}
      isOptionEqualToValue={(option, value) => option.id === value.id}
      disabled={!selected}
      onChange={(_event, value) => onGuidelineChange(value?.label || '')}
      noOptionsText="Este objetivo no tiene lineamientos configurados"
      renderInput={(params) => <TextField {...params} label="Lineamiento estratégico" />}
      sx={{ gridColumn: { md: 'span 5' } }}
    />
  </>;
}
