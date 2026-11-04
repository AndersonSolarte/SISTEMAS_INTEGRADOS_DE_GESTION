import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import institutionalPolicyService from '../../services/institutionalPolicyService';

export default function InstitutionalPoliciesDialog({ open, onClose }) {
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    setLoading(true);
    setError('');
    institutionalPolicyService.list().then((data) => { if (active) setPolicies(data); })
      .catch(() => { if (active) setError('No fue posible consultar el catálogo institucional.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [open]);
  const rows = useMemo(() => policies.flatMap((policy) => policy.actionLines.map((line) => ({ policy: policy.name, line })))
    .filter((row) => `${row.policy} ${row.line}`.toLocaleLowerCase('es').includes(search.trim().toLocaleLowerCase('es'))), [policies, search]);
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
    <DialogTitle>Políticas institucionales</DialogTitle>
    <DialogContent dividers>
      <TextField fullWidth size="small" label="Buscar política o línea de acción" value={search} onChange={(event) => setSearch(event.target.value)} sx={{ mb: 2 }} />
      {loading ? <CircularProgress aria-label="Cargando políticas" /> : error ? <Alert severity="error">{error}</Alert> : <>
        <Typography variant="body2" sx={{ mb: 1 }}>{policies.length} políticas · {rows.length} líneas</Typography>
        <TableContainer sx={{ maxHeight: '60vh' }}><Table stickyHeader size="small">
          <TableHead><TableRow><TableCell>Política institucional</TableCell><TableCell>Línea de acción</TableCell></TableRow></TableHead>
          <TableBody>{rows.map((row, index) => <TableRow key={`${row.policy}-${index}`}><TableCell sx={{ width: '40%' }}>{row.policy}</TableCell><TableCell>{row.line}</TableCell></TableRow>)}</TableBody>
        </Table></TableContainer>
      </>}
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Cerrar</Button></DialogActions>
  </Dialog>;
}
