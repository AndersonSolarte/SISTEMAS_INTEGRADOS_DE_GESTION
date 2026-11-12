import React, { useId, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { ChatBubbleOutline } from '@mui/icons-material';
import { periodObservation } from '../utils/periodObservation';

export default function PeriodObservationButton({ activity, period, onEdit, onSave }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState('view');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const observation = periodObservation(activity, period);
  const periodName = [period.code, period.name].filter(Boolean).join(' · ') || `Período ${period.position || ''}`;
  const persist = async (value) => {
    setBusy(true); setError('');
    try { await onSave(value); setOpen(false); setMode('view'); }
    catch (failure) { setError(failure?.response?.data?.message || 'No fue posible guardar la observación. Intente nuevamente.'); }
    finally { setBusy(false); }
  };
  return (
    <Box sx={{ mt: 0.75 }}>
      <Button size="small" variant={observation ? 'outlined' : 'text'}
        startIcon={<ChatBubbleOutline sx={{ fontSize: '13px !important' }} />}
        aria-label={`Observaciones ${period.code || period.name} de ${activity.code || activity.activity}`}
        onClick={(event) => {
          event.stopPropagation();
          setMode('view'); setError('');
          if (onEdit && !observation) onEdit();
          else setOpen(true);
        }}
        sx={{ textTransform: 'none', fontSize: 9.5, fontWeight: 750, borderRadius: 1.5, px: 0.65, py: 0.35,
          minWidth: 0, color: observation ? '#1d4ed8' : '#64748b', '& .MuiButton-startIcon': { mr: 0.4, ml: 0 } }}>
        Observaciones
      </Button>
      {open && (
        <Dialog open onClose={() => !busy && setOpen(false)} maxWidth="sm" fullWidth aria-labelledby={titleId}
          PaperProps={{ sx: { borderRadius: 3 } }} onClick={(event) => event.stopPropagation()}>
          <DialogTitle id={titleId} sx={{ fontSize: 17, fontWeight: 800 }}>Observaciones de Planeación y Efectividad</DialogTitle>
          <DialogContent>
            <Stack spacing={2}>
              <Box sx={{ p: 1.5, bgcolor: '#f8fafc', borderRadius: 2 }}>
                <Chip label={activity.code || 'Actividad'} size="small" sx={{ mb: 1 }} />
                <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{activity.activity || activity.actividad}</Typography>
              </Box>
              <Box>
                <Typography sx={{ fontWeight: 800, fontSize: 13 }}>{periodName}</Typography>
                {(period.starts_on || period.ends_on) && (
                  <Typography variant="caption" color="text.secondary">{period.starts_on || '—'} al {period.ends_on || '—'}</Typography>
                )}
              </Box>
              {error && <Alert severity="error">{error}</Alert>}
              {mode === 'delete' && <Alert severity="warning">
                ¿Eliminar la observación de {period.code || period.name} para esta actividad? El avance y las evidencias se conservarán.
              </Alert>}
              {mode === 'edit' ? <TextField multiline minRows={4} fullWidth autoFocus
                label="Observación oficial" value={draft} disabled={busy}
                onChange={(event) => setDraft(event.target.value)} /> : observation ? (
                <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 14 }}>{observation}</Typography>
              ) : <Alert severity="info">No hay observaciones registradas para esta actividad en este corte.</Alert>}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2 }}>
            <Button disabled={busy} onClick={() => mode === 'view' ? setOpen(false) : setMode('view')}>
              {mode === 'view' ? 'Cerrar' : 'Cancelar'}
            </Button>
            {onSave && mode === 'view' && <>
              {observation && <Button color="error" onClick={() => setMode('delete')}>Eliminar observación</Button>}
              <Button variant="contained" onClick={() => { setDraft(observation); setMode('edit'); }}>
                {observation ? 'Editar observación' : 'Agregar observación'}
              </Button>
            </>}
            {onSave && mode === 'edit' && <Button variant="contained" disabled={busy || !draft.trim()}
              onClick={() => persist(draft.trim())}>{busy ? 'Guardando…' : 'Guardar observación'}</Button>}
            {onSave && mode === 'delete' && <Button color="error" variant="contained" disabled={busy}
              onClick={() => persist('')}>{busy ? 'Eliminando…' : 'Confirmar eliminación'}</Button>}
            {!onSave && onEdit && <Button variant="contained" onClick={() => { setOpen(false); onEdit(); }}>
              {observation ? 'Editar valoración' : 'Registrar valoración'}
            </Button>}
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}
