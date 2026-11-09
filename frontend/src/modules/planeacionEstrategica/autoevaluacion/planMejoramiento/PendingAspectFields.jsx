import React from 'react';
import { MenuItem, TextField } from '@mui/material';

export default function PendingAspectFields({ pending, factor = '', characteristic = '', onFactorChange, onCharacteristicChange }) {
  const factors = [...new Set(pending.map((item) => item.factor).filter(Boolean))];
  const characteristics = [...new Set(pending.filter((item) => item.factor === factor).map((item) => item.caracteristica).filter(Boolean))];
  return <>
    <TextField select label="Factor / condición" value={factor} onChange={(event) => onFactorChange(event.target.value)} sx={{ gridColumn: { md: 'span 5' } }} disabled={!factor && !factors.length}>
      {/* Keep the stored selection valid without offering an exhausted option. */}
      {factor && !factors.includes(factor) && <MenuItem value={factor} disabled sx={{ display: 'none' }}>{factor}</MenuItem>}
      {factors.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
      {!factors.length && <MenuItem disabled>No quedan factores con aspectos pendientes</MenuItem>}
    </TextField>
    <TextField select label="Característica" value={characteristic} onChange={(event) => onCharacteristicChange(event.target.value)} sx={{ gridColumn: { md: 'span 5' } }} disabled={!factor || (!characteristic && !characteristics.length)}>
      {characteristic && !characteristics.includes(characteristic) && <MenuItem value={characteristic} disabled sx={{ display: 'none' }}>{characteristic}</MenuItem>}
      {characteristics.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
      {!characteristics.length && <MenuItem disabled>No quedan características con aspectos pendientes</MenuItem>}
    </TextField>
  </>;
}
