import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Typography } from '@mui/material';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import { obtenerAdjuntoLegalizacion } from '../../services/legalizacionViaticosService';

export default function LegalizacionSupportPreview({ document, onClose }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    setPreview(null);
    setError('');
    if (!document) return undefined;
    const controller = new AbortController();
    let active = true;
    let url;
    obtenerAdjuntoLegalizacion(document.legalizacionId, document.support.id, controller.signal).then((blob) => {
      if (!active) return;
      const mime = blob.type || document.support.mimetype || (/\.pdf$/i.test(document.support.originalName || '') ? 'application/pdf' : '');
      url = URL.createObjectURL(blob);
      setPreview({ url, mime });
    }).catch(() => {
      if (active) setError('No fue posible cargar el documento. Verifique sus permisos o intente nuevamente.');
    });
    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [document, attempt]);

  const filename = document?.support.originalName || 'Documento adjunto';
  return (
    <Dialog open={Boolean(document)} onClose={onClose} fullWidth maxWidth="xl" aria-labelledby="legalizacion-preview-title" PaperProps={{ sx: { m: { xs: 1, sm: 3 }, width: { xs: 'calc(100% - 16px)', sm: 'calc(100% - 48px)' }, height: '90dvh', maxHeight: '94dvh', borderRadius: 3 } }}>
      <DialogTitle id="legalizacion-preview-title" sx={{ bgcolor: '#0b3a6f', color: 'white', py: 2 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
          <Box sx={{ minWidth: 0 }}><Typography variant="caption" sx={{ color: '#bfdbfe', fontWeight: 800 }}>VISTA PREVIA · SIAC</Typography><Typography component="h2" fontWeight={800} sx={{ overflowWrap: 'anywhere' }}>{filename}</Typography></Box>
          <Button color="inherit" startIcon={<CloseRoundedIcon />} onClick={onClose} sx={{ flexShrink: 0, textTransform: 'none' }}>Cerrar vista previa</Button>
        </Stack>
      </DialogTitle>
      <DialogContent sx={{ p: 0, display: 'flex', minHeight: 0, bgcolor: '#eef2f6' }}>
        {error ? <Alert severity="error" sx={{ m: 3, width: '100%', alignSelf: 'flex-start' }} action={<Button color="inherit" onClick={() => setAttempt((value) => value + 1)}>Reintentar</Button>}>{error}</Alert>
          : !preview ? <Box role="status" aria-label="Cargando documento" sx={{ display: 'grid', placeItems: 'center', width: '100%' }}><CircularProgress /></Box>
          : preview.mime.startsWith('image/') ? <Box sx={{ width: '100%', overflow: 'auto', p: 2, textAlign: 'center' }}><Box component="img" src={preview.url} alt={filename} sx={{ maxWidth: '100%', height: 'auto' }} /></Box>
          : <Box component="iframe" title={`Vista previa de ${filename}`} src={`${preview.url}#toolbar=1`} sx={{ border: 0, width: '100%', height: '100%', minHeight: 300 }} />}
      </DialogContent>
      <DialogActions sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto' }}>Al cerrar volverá a la revisión, conservando los datos diligenciados.</Typography>
        {preview && <Button component="a" href={preview.url} download={filename} startIcon={<DownloadRoundedIcon />} sx={{ textTransform: 'none' }}>Descargar</Button>}
      </DialogActions>
    </Dialog>
  );
}
