import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, IconButton, InputLabel, LinearProgress, MenuItem, Paper,
  Select, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography
} from '@mui/material';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import FindInPageRoundedIcon from '@mui/icons-material/FindInPageRounded';
import api from '../../services/api';

const BASE_URL = '/planeacion/gestion-informacion/saber-pro/consulta/documentos-masivos';

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  EXTRACTED: 'Extraído',
  CORRECTED: 'Corregido manualmente',
  INCOMPLETE: 'Incompleto',
  ERROR: 'Error',
  NOT_FOUND: 'No encontrado',
  NO_PDF: 'Sin PDF',
  INVALID: 'Inválido'
};

const statusColor = (status) => ({
  EXTRACTED: 'success', CORRECTED: 'info', PENDING: 'default',
  INCOMPLETE: 'warning', ERROR: 'error', NOT_FOUND: 'warning',
  NO_PDF: 'warning', INVALID: 'error'
}[status] || 'default');

function displayDate(value) {
  const match = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
}

function registrationYear(value) {
  const match = String(value || '').replace(/\s/g, '').toUpperCase().match(/^EKA?(\d{4})\d{4,}$/);
  return match ? Number(match[1]) : null;
}

function saveBlob(response, fileName) {
  const url = URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function ConsultaDocumentosMasiva() {
  const [data, setData] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [notice, setNotice] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [examDate, setExamDate] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const inputRef = useRef(null);
  const expectedExamYear = registrationYear(registrationNumber);
  const selectedExamYear = examDate ? Number(examDate.slice(0, 4)) : null;
  const registrationFormatInvalid = Boolean(registrationNumber && !expectedExamYear);
  const examDateYearMismatch = Boolean(expectedExamYear && selectedExamYear && expectedExamYear !== selectedExamYear);

  const loadLatest = useCallback(async () => {
    try {
      const response = await api.get(`${BASE_URL}/latest`);
      setData(response.data.data);
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible cargar la consulta.' });
    }
  }, []);

  useEffect(() => { loadLatest(); }, [loadLatest]);

  useEffect(() => {
    if (!data?.id || data.status !== 'PROCESSING') return undefined;
    const timer = window.setInterval(async () => {
      try {
        const response = await api.get(`${BASE_URL}/${data.id}`);
        setData(response.data.data);
      } catch (_error) {
        // El proceso continúa en el servidor; el siguiente ciclo vuelve a consultar.
      }
    }, 2000);
    return () => window.clearInterval(timer);
  }, [data?.id, data?.status]);

  useEffect(() => () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
  }, [pdfUrl]);

  const items = data?.items || [];
  const counts = useMemo(() => items.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {}), [items]);
  const visibleItems = useMemo(
    () => filter === 'ALL' ? items : items.filter((item) => item.status === filter),
    [filter, items]
  );
  const retryCount = (counts.INCOMPLETE || 0) + (counts.ERROR || 0);
  const progress = data?.totalItems ? Math.round((Number(data.processedItems || 0) / data.totalItems) * 100) : 0;

  async function upload() {
    if (!file) return;
    setBusy(true);
    setNotice(null);
    try {
      const form = new FormData();
      form.append('archivo', file);
      const response = await api.post(BASE_URL, form);
      setData(response.data.data);
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setNotice({ severity: 'success', text: 'Consulta iniciada. Puede salir de esta pantalla; el proceso continuará en el servidor.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible iniciar la consulta.' });
    } finally {
      setBusy(false);
    }
  }

  async function downloadTemplate() {
    try {
      const response = await api.get(`${BASE_URL}/template`, { responseType: 'blob' });
      saveBlob(response, 'plantilla_consulta_documental.xlsx');
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible descargar la plantilla.' });
    }
  }

  async function exportResults() {
    try {
      const response = await api.get(`${BASE_URL}/${data.id}/export`, { responseType: 'blob' });
      saveBlob(response, `consulta_documental_${data.id}.xlsx`);
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible exportar los resultados.' });
    }
  }

  async function retry() {
    setBusy(true);
    setNotice(null);
    try {
      const response = await api.post(`${BASE_URL}/${data.id}/retry`);
      setData(response.data.data);
      setNotice({ severity: 'info', text: 'Se reprocesarán únicamente las filas incompletas y con error.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible reintentar las filas.' });
    } finally {
      setBusy(false);
    }
  }

  async function openReview(item) {
    setReviewItem(item);
    setRegistrationNumber(item.registrationNumber || '');
    setExamDate(item.examDate || '');
    setPdfLoading(true);
    setPdfUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous);
      return '';
    });
    try {
      const response = await api.get(`${BASE_URL}/items/${item.id}/pdf`, { responseType: 'blob' });
      setPdfUrl(URL.createObjectURL(new Blob([response.data], { type: 'application/pdf' })));
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible visualizar el PDF.' });
    } finally {
      setPdfLoading(false);
    }
  }

  function closeReview() {
    setReviewItem(null);
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setPdfUrl('');
  }

  async function saveCorrection() {
    setBusy(true);
    try {
      await api.patch(`${BASE_URL}/items/${reviewItem.id}`, { registrationNumber, examDate });
      const response = await api.get(`${BASE_URL}/${data.id}`);
      setData(response.data.data);
      setNotice({ severity: 'success', text: 'Corrección guardada y registrada.' });
      closeReview();
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible guardar la corrección.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 3 }, border: '1px solid #dbe5ef', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Stack direction="row" spacing={1.2} alignItems="center">
              <FindInPageRoundedIcon sx={{ color: '#7c3aed', fontSize: 30 }} />
              <Typography sx={{ fontWeight: 900, fontSize: 22, color: '#0f172a' }}>Consulta masiva de documentos</Typography>
            </Stack>
            <Typography sx={{ color: '#64748b', mt: .7 }}>
              Consulte cédulas, lea los PDF institucionales en memoria y extraiga número EK y fecha del examen.
            </Typography>
            <Typography sx={{ color: '#0f766e', mt: .5, fontSize: 12.5, fontWeight: 700 }}>
              Los PDF no se guardan en SIAC ni se descargan al disco del servidor.
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            <Button variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadTemplate}>Plantilla</Button>
            <Button component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={data?.status === 'PROCESSING'}>
              Seleccionar Excel
              <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </Button>
            <Button variant="contained" onClick={upload} disabled={!file || busy || data?.status === 'PROCESSING'}>
              {busy ? <CircularProgress size={20} color="inherit" /> : 'Consultar documentos'}
            </Button>
          </Stack>
        </Stack>

        {file && <Alert sx={{ mt: 2 }} severity="info">Archivo seleccionado: {file.name}</Alert>}
        {notice && <Alert sx={{ mt: 2 }} severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

        {data && (
          <>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={2} sx={{ mt: 3 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Chip label={`Total: ${data.totalItems || 0}`} />
                <Chip color="success" label={`Extraídos: ${data.extractedItems || 0}`} />
                <Chip color="info" label={`Corregidos: ${data.correctedItems || 0}`} />
                <Chip color="warning" label={`Sin PDF: ${data.noPdfItems || 0}`} />
                <Chip color="error" variant="outlined" label={`Con novedad: ${data.errorItems || 0}`} />
              </Stack>
              <Stack direction="row" spacing={1}>
                <Button variant="outlined" startIcon={<RefreshRoundedIcon />} disabled={!retryCount || data.status === 'PROCESSING' || busy} onClick={retry}>
                  Reintentar incompletos ({retryCount})
                </Button>
                <Button variant="outlined" startIcon={<DownloadRoundedIcon />} disabled={data.status === 'PROCESSING'} onClick={exportResults}>
                  Exportar Excel
                </Button>
              </Stack>
            </Stack>

            {data.status === 'PROCESSING' && (
              <Box sx={{ mt: 2 }}>
                <Typography sx={{ fontSize: 12.5, mb: .6 }}>Procesando {data.processedItems}/{data.totalItems} ({progress}%)</Typography>
                <LinearProgress variant="determinate" value={progress} />
                <Typography sx={{ mt: .7, fontSize: 11.5, color: '#64748b' }}>Puede cerrar esta pantalla; el backend continuará el trabajo.</Typography>
              </Box>
            )}

            <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}>
              <FormControl size="small" sx={{ minWidth: 240 }}>
                <InputLabel>Filtrar por estado</InputLabel>
                <Select value={filter} label="Filtrar por estado" onChange={(event) => setFilter(event.target.value)}>
                  <MenuItem value="ALL">Todos ({items.length})</MenuItem>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>{label} ({counts[value] || 0})</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Stack>

            <TableContainer sx={{ mt: 2, maxHeight: 570, border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fila</TableCell>
                    <TableCell>Identificación</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>Número de registro</TableCell>
                    <TableCell>Fecha del examen</TableCell>
                    <TableCell>Detalle</TableCell>
                    <TableCell align="center">Revisar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleItems.map((item) => {
                    const reviewable = ['INCOMPLETE', 'ERROR'].includes(item.status) && item.hasDocument;
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell>{item.rowNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 800 }}>{item.identification}</TableCell>
                        <TableCell><Chip size="small" color={statusColor(item.status)} label={STATUS_LABELS[item.status] || item.status} /></TableCell>
                        <TableCell>{item.registrationNumber || '—'}</TableCell>
                        <TableCell>{displayDate(item.examDate) || '—'}</TableCell>
                        <TableCell sx={{ minWidth: 280 }}>{item.message || '—'}</TableCell>
                        <TableCell align="center">
                          {reviewable ? (
                            <Tooltip title="Visualizar PDF y corregir información">
                              <IconButton color="primary" onClick={() => openReview(item)}><VisibilityRoundedIcon /></IconButton>
                            </Tooltip>
                          ) : '—'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </>
        )}
      </Paper>

      <Dialog open={Boolean(reviewItem)} onClose={closeReview} fullWidth maxWidth="xl">
        <DialogTitle>Revisar documento — {reviewItem?.identification}</DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ minHeight: 620 }}>
            <Box sx={{ flex: 1.6, bgcolor: '#eef2f7', borderRadius: 2, overflow: 'hidden', minHeight: 600 }}>
              {pdfLoading && <Stack alignItems="center" justifyContent="center" sx={{ height: 600 }}><CircularProgress /></Stack>}
              {!pdfLoading && pdfUrl && <iframe title="Documento institucional" src={pdfUrl} width="100%" height="620" style={{ border: 0 }} />}
              {!pdfLoading && !pdfUrl && <Alert severity="error">No fue posible cargar el PDF.</Alert>}
            </Box>
            <Stack spacing={2} sx={{ flex: .8, minWidth: { lg: 340 } }}>
              <Alert severity="warning">Verifique visualmente el documento antes de guardar. La corrección quedará registrada.</Alert>
              <TextField
                label="Número de registro EK"
                value={registrationNumber}
                onChange={(event) => setRegistrationNumber(event.target.value.toUpperCase())}
                error={registrationFormatInvalid}
                helperText={registrationFormatInvalid
                  ? 'Use un código EK válido; sus cuatro primeros dígitos indican el año.'
                  : expectedExamYear ? `Año esperado para la fecha: ${expectedExamYear}` : 'Ejemplo: EK202531184043'}
              />
              <TextField
                label="Fecha del examen"
                type="date"
                value={examDate}
                onChange={(event) => setExamDate(event.target.value)}
                error={examDateYearMismatch}
                InputLabelProps={{ shrink: true }}
                inputProps={expectedExamYear ? {
                  min: `${expectedExamYear}-01-01`,
                  max: `${expectedExamYear}-12-31`
                } : {}}
                helperText={examDateYearMismatch
                  ? `La fecha debe pertenecer al año ${expectedExamYear}, según el EK.`
                  : expectedExamYear
                    ? `Seleccione una fecha de ${expectedExamYear}. Se mostrará como día/mes/año.`
                    : 'Primero ingrese un número de registro EK válido.'}
              />
              <Typography sx={{ fontSize: 12, color: '#64748b' }}>Detalle automático: {reviewItem?.message || '—'}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReview}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={saveCorrection}
            disabled={busy || !registrationNumber || !expectedExamYear || !examDate
              || registrationFormatInvalid || examDateYearMismatch}
          >
            Guardar corrección
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
