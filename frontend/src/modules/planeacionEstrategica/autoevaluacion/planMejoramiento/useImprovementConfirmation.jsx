import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Stack, Typography } from '@mui/material';
import CloseRounded from '@mui/icons-material/CloseRounded';
import LinkOffRounded from '@mui/icons-material/LinkOffRounded';
import DeleteOutlineRounded from '@mui/icons-material/DeleteOutlineRounded';

export default function useImprovementConfirmation() {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);
  const id = useId();
  const finish = useCallback((accepted) => {
    const resolve = resolver.current;
    resolver.current = null;
    setRequest(null);
    resolve?.(accepted);
  }, []);
  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current?.(false);
    resolver.current = resolve;
    setRequest(options);
  }), []);
  useEffect(() => () => { resolver.current?.(false); }, []);
  const destructive = request?.kind === 'delete';
  const dialog = <Dialog open={Boolean(request)} onClose={() => finish(false)} fullWidth maxWidth="xs"
    aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
    PaperProps={{ role: 'alertdialog', sx: { borderRadius: 3, border: '1px solid #e2e8f0', boxShadow: '0 24px 72px rgba(15,23,42,.2)' } }}>
    <DialogTitle id={`${id}-title`} sx={{ p: 2.5, pb: 1.5 }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2, flexShrink: 0, display: 'grid', placeItems: 'center', bgcolor: destructive ? '#fff1f2' : '#fff7ed', color: destructive ? '#be123c' : '#b45309' }}>
          {destructive ? <DeleteOutlineRounded /> : <LinkOffRounded />}
        </Box>
        <Typography component="span" sx={{ flex: 1, fontSize: 18, fontWeight: 800, color: '#162941' }}>{request?.title}</Typography>
        <IconButton aria-label="Cerrar confirmación" size="small" onClick={() => finish(false)}><CloseRounded fontSize="small" /></IconButton>
      </Stack>
    </DialogTitle>
    <DialogContent sx={{ px: 2.5, pb: 2.5 }}>
      <Typography id={`${id}-description`} variant="body2" sx={{ color: '#52637a', lineHeight: 1.7 }}>{request?.description}</Typography>
      {request?.name && <Box sx={{ mt: 2, p: 1.5, borderRadius: 2, bgcolor: '#f7f9fc', border: '1px solid #e8edf4' }}>
        <Typography variant="caption" sx={{ color: '#64748b' }}>{destructive ? 'Plan de mejoramiento' : 'Actividad'}</Typography>
        <Typography variant="body2" sx={{ fontWeight: 700, color: '#24364f', overflowWrap: 'anywhere' }}>{request.name}</Typography>
        {request.context && <Typography variant="caption" sx={{ display: 'block', mt: .5, color: '#64748b', overflowWrap: 'anywhere' }}>{request.context}</Typography>}
      </Box>}
    </DialogContent>
    <DialogActions sx={{ px: 2.5, py: 2, borderTop: '1px solid #edf1f6', gap: 1 }}>
      <Button autoFocus onClick={() => finish(false)} sx={{ textTransform: 'none', color: '#475569', fontWeight: 700 }}>Cancelar</Button>
      <Button variant="contained" disableElevation color={destructive ? 'error' : 'warning'} onClick={() => finish(true)} sx={{ textTransform: 'none', fontWeight: 750, borderRadius: 2, px: 2.5 }}>{request?.confirmLabel}</Button>
    </DialogActions>
  </Dialog>;
  return { confirm, dialog };
}
