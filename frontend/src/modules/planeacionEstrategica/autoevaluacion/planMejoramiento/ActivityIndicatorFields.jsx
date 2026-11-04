import React from 'react';
import { TextField } from '@mui/material';

export const resolveActivityIndicators = (activity = {}) => {
  const legacyField = activity.tipoIndicador === 'Logro' ? 'indicadorLogro' : activity.tipoIndicador === 'Impacto' ? 'indicadorImpacto' : 'indicadorResultado';
  return Object.fromEntries(['indicadorResultado', 'indicadorLogro', 'indicadorImpacto'].map((field) => [field,
    activity[field] ?? (field === legacyField ? activity.indicador || '' : '')]));
};

export default function ActivityIndicatorFields({ activity, onChange }) {
  const values = resolveActivityIndicators(activity);
  return <>{[['Indicador de resultado', 'indicadorResultado'], ['Indicador de logro', 'indicadorLogro'], ['Indicador de impacto', 'indicadorImpacto']].map(([label, field]) =>
    <TextField key={field} label={label} multiline minRows={2} value={values[field]} onChange={(event) => onChange(field, event.target.value)} sx={{ gridColumn: '1 / -1' }} />
  )}</>;
}
