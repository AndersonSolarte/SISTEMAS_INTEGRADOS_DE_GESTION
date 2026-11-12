import React, { useId, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material';

export default function ActivityTableText({ value, label = 'Contenido completo', sx = {} }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const text = Array.isArray(value) ? value.join(', ') : String(value ?? '');
  const long = text.length > 120 || text.includes('\n');
  return (
    <Box sx={{ minWidth: 0, width: '100%' }}>
      <Typography sx={{ fontSize: 12.5, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3,
        WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere', ...sx }}>{text || '—'}</Typography>
      {long && <Button size="small" onClick={() => setOpen(true)} aria-label={`Ver completo: ${label}`}
        sx={{ textTransform: 'none', fontSize: 11, p: 0, mt: 0.35, minWidth: 0 }}>Ver completo</Button>}
      {open && <Dialog open onClose={() => setOpen(false)} maxWidth="md" fullWidth aria-labelledby={id}>
        <DialogTitle id={id}>{label}</DialogTitle>
        <DialogContent><Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{text}</Typography></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cerrar</Button></DialogActions>
      </Dialog>}
    </Box>
  );
}
