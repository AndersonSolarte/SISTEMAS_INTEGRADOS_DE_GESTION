import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Box, TextField } from '@mui/material';
import institutionalPolicyService from '../services/institutionalPolicyService';

export const availablePolicyLines = (policies, selected) => [...new Set(
  policies.filter((policy) => !selected || policy.name === selected)
    .flatMap((policy) => policy.actionLines || [])
)];

export default function InstitutionalPolicyActivityField({ field, values, onChange }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const active = useRef(false);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (pending.current) return;
    pending.current = true;
    try {
      const data = await institutionalPolicyService.list();
      if (active.current) { setPolicies(data); setError(false); }
    } catch (_) {
      if (active.current) setError(true);
    } finally {
      pending.current = false;
      if (active.current) setLoading(false);
    }
  }, []);
  useEffect(() => {
    active.current = true;
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const interval = setInterval(onVisible, 15000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active.current = false;
      clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);
  const lines = field.validation_rules.role === 'lines';
  const policyKey = field.validation_rules.policy_key;
  const selected = values[policyKey] || '';
  const rawValue = values[field.key];
  const value = lines ? (Array.isArray(rawValue) ? rawValue : rawValue ? [rawValue] : []) : rawValue || '';
  return <Box sx={{ minWidth: 0 }}>
    <Autocomplete freeSolo autoSelect multiple={lines} loading={loading} filterSelectedOptions onOpen={refresh}
      options={lines ? availablePolicyLines(policies, selected) : policies.map((policy) => policy.name)}
      value={value}
      onChange={(_, next) => {
        const changes = { [field.key]: next };
        if (!lines && next !== selected) {
          const allowed = availablePolicyLines(policies, next);
          changes.institutional_policy_lines = (Array.isArray(values.institutional_policy_lines) ? values.institutional_policy_lines : []).filter((line) => allowed.includes(line));
        }
        onChange(changes);
      }}
      renderInput={(params) => <TextField {...params} size="small" required={field.required} label={field.label}
        helperText={lines ? 'Seleccione o escriba una línea y pulse Enter.' : 'Seleccione o escriba una política.'} />} />
    {error && <Alert severity="warning">No se pudo cargar el catálogo. Puede escribir el valor.</Alert>}
  </Box>;
}
