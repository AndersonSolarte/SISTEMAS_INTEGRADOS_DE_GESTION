import React, { useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import AutoFixHighRoundedIcon from '@mui/icons-material/AutoFixHighRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CleaningServicesRoundedIcon from '@mui/icons-material/CleaningServicesRounded';
import DatasetRoundedIcon from '@mui/icons-material/DatasetRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import ThumbDownAltRoundedIcon from '@mui/icons-material/ThumbDownAltRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import VerifiedRoundedIcon from '@mui/icons-material/VerifiedRounded';
import gestionInformacionService from '../../services/gestionInformacionService';


const readBlobError = async (error) => {
  const data = error?.response?.data;
  if (data instanceof Blob) {
    try {
      const payload = JSON.parse(await data.text());
      return payload?.message || payload?.detail || 'No fue posible limpiar el archivo.';
    } catch (_) {
      return 'No fue posible limpiar el archivo.';
    }
  }
  return data?.message || data?.detail || 'No fue posible limpiar el archivo.';
};

const headerNumber = (headers, key) => Number(headers?.[key] || 0);

function ContextoExternoGestionPanel({ listas = [], onBack, onOpenImporter, enqueueSnackbar }) {
  const [lista, setLista] = useState('');
  const [file, setFile] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => () => {
    if (result?.downloadUrl) window.URL.revokeObjectURL(result.downloadUrl);
  }, [result?.downloadUrl]);

  const resetFile = (nextFile) => {
    setFile(nextFile || null);
    setResult(null);
    setErrorMessage('');
  };

  const handleClean = async () => {
    if (!lista || !file) {
      enqueueSnackbar('Selecciona una lista y adjunta el archivo original.', { variant: 'warning' });
      return;
    }

    setProcessing(true);
    setResult(null);
    setErrorMessage('');
    try {
      const response = await gestionInformacionService.cleanContextoExterno(file, lista);
      const disposition = response.headers?.['content-disposition'] || '';
      const filename = disposition.match(/filename="?([^";]+)"?/i)?.[1]
        || `contexto_externo_limpio_${lista.toLowerCase().replace(/\s+/g, '_')}.xlsx`;
      const cleanBlob = new Blob([response.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(cleanBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();

      const summary = {
        inputRows: headerNumber(response.headers, 'x-input-rows'),
        outputRows: headerNumber(response.headers, 'x-output-rows'),
        duplicates: headerNumber(response.headers, 'x-duplicates-removed'),
        emptyRows: headerNumber(response.headers, 'x-empty-rows-removed'),
        matchedColumns: headerNumber(response.headers, 'x-matched-columns'),
        corrections: headerNumber(response.headers, 'x-corrections-count'),
        savedRules: headerNumber(response.headers, 'x-saved-rules'),
        reviewId: response.headers?.['x-review-id'] || '',
        reviewStatus: response.headers?.['x-review-status'] || 'pending',
        sourceSheet: response.headers?.['x-source-sheet'] || 'Archivo cargado',
        filename,
        downloadUrl: url
      };
      setResult(summary);
      enqueueSnackbar(
        'Archivo preparado para revisión. Descárguelo y valide el reporte antes de aprobar.',
        { variant: 'success' }
      );
      if (response.headers?.['x-rules-warning']) {
        enqueueSnackbar(response.headers['x-rules-warning'], { variant: 'warning' });
      }
    } catch (error) {
      const message = await readBlobError(error);
      setErrorMessage(message);
      enqueueSnackbar(message, { variant: 'error' });
    } finally {
      setProcessing(false);
    }
  };

  const handleApproveReview = async () => {
    if (!result?.reviewId) return;
    setReviewing(true);
    try {
      const response = await gestionInformacionService.approveContextoExternoReview(result.reviewId);
      setResult((prev) => ({
        ...prev,
        reviewStatus: 'approved',
        savedRules: Number(response?.data?.savedRules || 0)
      }));
      enqueueSnackbar(response?.message || 'Correcciones aprobadas y guardadas.', { variant: 'success' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible aprobar las correcciones.', { variant: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  const handleRejectReview = async () => {
    if (!result?.reviewId) return;
    const confirmed = window.confirm('¿Confirmas que esta revisión no es correcta? El diccionario no será modificado.');
    if (!confirmed) return;
    setReviewing(true);
    try {
      const response = await gestionInformacionService.rejectContextoExternoReview(result.reviewId);
      setResult((prev) => ({ ...prev, reviewStatus: 'rejected', savedRules: 0 }));
      enqueueSnackbar(response?.message || 'Revisión no aprobada.', { variant: 'info' });
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No fue posible rechazar la revisión.', { variant: 'error' });
    } finally {
      setReviewing(false);
    }
  };

  return (
    <Stack spacing={2.3}>
      <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
        <Button variant="outlined" startIcon={<ArrowBackRoundedIcon />} onClick={onBack} sx={{ fontWeight: 800 }}>
          Volver a Contexto Externo
        </Button>
      </Paper>

      <Paper elevation={0} sx={{ p: { xs: 2.2, md: 3 }, borderRadius: 3.5, color: '#fff', background: 'linear-gradient(135deg,#164e63,#0891b2)' }}>
        <Stack direction="row" spacing={1.6} alignItems="center">
          <Box sx={{ width: 50, height: 50, borderRadius: 2.5, bgcolor: 'rgba(255,255,255,.16)', display: 'grid', placeItems: 'center' }}>
            <CleaningServicesRoundedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 900, fontSize: { xs: 20, md: 24 } }}>Gestión de base de datos de Contexto Externo</Typography>
            <Typography sx={{ color: 'rgba(255,255,255,.86)', mt: 0.3 }}>
              Limpia, normaliza y prepara los archivos antes de importarlos al sistema.
            </Typography>
          </Box>
        </Stack>
      </Paper>

      <Alert severity="info" sx={{ borderRadius: 2.5 }}>
        La limpieza conserva los textos legibles, pero compara sin tildes, signos, caracteres especiales ni diferencias de espacios para detectar duplicados equivalentes.
      </Alert>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(3, minmax(0, 1fr))' }, gap: 1.6 }}>
        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe6f5', borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="1" color="primary" sx={{ fontWeight: 900 }} />
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Seleccionar estructura</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>Define cómo debe quedar el archivo final.</Typography>
            </Box>
          </Stack>
          <FormControl fullWidth>
            <InputLabel>Lista Contexto Externo</InputLabel>
            <Select value={lista} label="Lista Contexto Externo" onChange={(event) => { setLista(event.target.value); setResult(null); }}>
              <MenuItem value=""><em>Sin seleccionar</em></MenuItem>
              {listas.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
            </Select>
          </FormControl>
        </Paper>

        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe6f5', borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="2" color="primary" sx={{ fontWeight: 900 }} />
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Adjuntar base original</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>Preparado para archivos Excel o CSV de gran tamaño.</Typography>
            </Box>
          </Stack>
          <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} sx={{ py: 1.45, fontWeight: 800 }}>
            {file ? 'Cambiar archivo' : 'Seleccionar archivo'}
            <input hidden type="file" accept=".xlsx,.xls,.csv,text/csv" onChange={(event) => resetFile(event.target.files?.[0])} />
          </Button>
          {file && (
            <Box sx={{ mt: 1.4, p: 1.2, borderRadius: 2, bgcolor: '#f0fdfa', border: '1px solid #99f6e4' }}>
              <Typography sx={{ color: '#115e59', fontWeight: 800, fontSize: 13, wordBreak: 'break-word' }}>{file.name}</Typography>
              <Typography variant="caption" sx={{ color: '#0f766e' }}>{(file.size / (1024 * 1024)).toFixed(2)} MB</Typography>
            </Box>
          )}
        </Paper>

        <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe6f5', borderRadius: 3, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 2 }}>
            <Chip label="3" color="primary" sx={{ fontWeight: 900 }} />
            <Box>
              <Typography sx={{ fontWeight: 900 }}>Limpiar y descargar</Typography>
              <Typography variant="caption" sx={{ color: '#64748b' }}>Python valida la estructura y elimina duplicados.</Typography>
            </Box>
          </Stack>
          <Button
            variant="contained"
            startIcon={processing ? <AutoFixHighRoundedIcon /> : <CleaningServicesRoundedIcon />}
            disabled={!lista || !file || processing}
            onClick={handleClean}
            sx={{ mt: 'auto', py: 1.45, fontWeight: 900, background: 'linear-gradient(135deg,#0891b2,#0e7490)' }}
          >
            {processing ? 'Limpiando archivo...' : 'Limpiar y preparar archivo'}
          </Button>
        </Paper>
      </Box>

      {processing && (
        <Alert severity="info" sx={{ borderRadius: 2.5 }}>
          Procesando la base completa. Los archivos grandes pueden tardar varios minutos; no cierres ni recargues esta página.
        </Alert>
      )}

      {errorMessage && !processing && (
        <Alert severity="error" sx={{ borderRadius: 2.5 }}>
          {errorMessage}
        </Alert>
      )}

      {result && (
        <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, border: `1px solid ${result.reviewStatus === 'approved' ? '#86efac' : result.reviewStatus === 'rejected' ? '#fca5a5' : '#93c5fd'}`, borderRadius: 3, bgcolor: result.reviewStatus === 'approved' ? '#f0fdf4' : result.reviewStatus === 'rejected' ? '#fff7f7' : '#eff6ff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'stretch', md: 'center' }}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                {result.reviewStatus === 'approved' ? <CheckCircleRoundedIcon sx={{ color: '#16a34a' }} /> : <DatasetRoundedIcon sx={{ color: result.reviewStatus === 'rejected' ? '#dc2626' : '#2563eb' }} />}
                <Typography sx={{ color: result.reviewStatus === 'approved' ? '#166534' : result.reviewStatus === 'rejected' ? '#991b1b' : '#1e3a8a', fontWeight: 900, fontSize: 18 }}>
                  {result.reviewStatus === 'approved'
                    ? 'Base validada y lista para cargar'
                    : result.reviewStatus === 'rejected'
                      ? 'Revisión no aprobada'
                      : 'Archivo preparado para revisión'}
                </Typography>
              </Stack>
              <Typography variant="body2" sx={{ color: '#475569', mt: 0.5 }}>{result.filename}</Typography>
              {result.reviewStatus === 'pending' && (
                <Typography variant="body2" sx={{ color: '#1e40af', mt: 0.8, maxWidth: 720 }}>
                  Descarga el archivo y revisa la hoja de datos y la hoja REPORTE_NORMALIZACION. El diccionario todavía no ha sido modificado.
                </Typography>
              )}
              {result.reviewStatus === 'rejected' && (
                <Typography variant="body2" sx={{ color: '#991b1b', mt: 0.8 }}>
                  Las correcciones no se guardaron. Ajusta las reglas o indícanos qué valores deben cambiar antes de procesar nuevamente.
                </Typography>
              )}
              <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" sx={{ mt: 1.3 }}>
                <Chip size="small" icon={<DatasetRoundedIcon />} label={`${result.inputRows} filas recibidas`} />
                <Chip size="small" label={`${result.outputRows} registros limpios`} color="success" variant="outlined" />
                <Chip size="small" label={`${result.duplicates} duplicados eliminados`} color="warning" variant="outlined" />
                <Chip size="small" label={`${result.emptyRows} filas vacías eliminadas`} variant="outlined" />
                <Chip size="small" label={`${result.corrections} tipos de corrección`} color="info" variant="outlined" />
                {result.reviewStatus === 'approved' && <Chip size="small" label={`${result.savedRules} reglas nuevas guardadas`} color="secondary" variant="outlined" />}
              </Stack>
            </Box>
            <Stack spacing={1} sx={{ minWidth: { md: 250 } }}>
              <Button
                variant="contained"
                startIcon={<DownloadRoundedIcon />}
                component="a"
                href={result.downloadUrl}
                download={result.filename}
                sx={{ py: 1.25, px: 2.5, fontWeight: 900, whiteSpace: 'nowrap' }}
              >
                {result.reviewStatus === 'approved' ? 'Descargar base lista para cargar' : 'Descargar archivo para revisión'}
              </Button>
              {result.reviewStatus === 'pending' && (
                <>
                  <Button variant="contained" color="success" startIcon={<VerifiedRoundedIcon />} disabled={reviewing} onClick={handleApproveReview} sx={{ py: 1.1, px: 2.5, fontWeight: 900 }}>
                    {reviewing ? 'Guardando reglas...' : 'Aprobar correcciones'}
                  </Button>
                  <Button variant="outlined" color="error" startIcon={<ThumbDownAltRoundedIcon />} disabled={reviewing} onClick={handleRejectReview} sx={{ py: 1.1, px: 2.5, fontWeight: 900 }}>
                    No aprobar
                  </Button>
                </>
              )}
              {result.reviewStatus === 'approved' && (
                <Button variant="outlined" startIcon={<UploadFileRoundedIcon />} onClick={() => onOpenImporter(lista)} sx={{ py: 1.1, px: 2.5, fontWeight: 900, whiteSpace: 'nowrap' }}>
                  Ir al panel de importación
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}

export default ContextoExternoGestionPanel;
