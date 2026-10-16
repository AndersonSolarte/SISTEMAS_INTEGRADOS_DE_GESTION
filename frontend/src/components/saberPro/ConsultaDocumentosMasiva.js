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
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
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
  INCOMPLETE: 'error', ERROR: 'error', NOT_FOUND: 'warning',
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
  const [examDay, setExamDay] = useState('');
  const [examMonth, setExamMonth] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const inputRef = useRef(null);
  const calendarInputRef = useRef(null);
  const expectedExamYear = registrationYear(registrationNumber);
  const registrationFormatInvalid = Boolean(registrationNumber && !expectedExamYear);
  const numericDay = Number(examDay);
  const numericMonth = Number(examMonth);
  const maxExamDay = expectedExamYear && numericMonth
    ? new Date(expectedExamYear, numericMonth, 0).getDate() : 31;
  const examDatePartsValid = Boolean(expectedExamYear
    && numericMonth >= 1 && numericMonth <= 12
    && numericDay >= 1 && numericDay <= maxExamDay);
  const examDateInvalid = Boolean((examDay || examMonth) && !examDatePartsValid);
  const examDate = examDatePartsValid
    ? `${expectedExamYear}-${String(numericMonth).padStart(2, '0')}-${String(numericDay).padStart(2, '0')}` : '';

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
  const pendingCount = counts.PENDING || 0;
  const retryButtonCount = retryCount || (data?.status !== 'PROCESSING' ? pendingCount : 0);
  const progress = data?.totalItems ? Math.round((Number(data.processedItems || 0) / data.totalItems) * 100) : 0;
  const reviewHasIdentificationMismatch = String(reviewItem?.message || '')
    .includes('no coincide con la cédula consultada');

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
      setNotice({ severity: 'info', text: 'Se reanudó el procesamiento de filas pendientes y con novedad.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible reintentar las filas.' });
    } finally {
      setBusy(false);
    }
  }

  async function openReview(item) {
    setReviewItem(item);
    setRegistrationNumber(item.registrationNumber || '');
    const currentDate = String(item.examDate || '');
    setExamMonth(currentDate.match(/^\d{4}-(\d{2})-\d{2}$/)?.[1] || '');
    setExamDay(currentDate.match(/^\d{4}-\d{2}-(\d{2})$/)?.[1] || '');
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

  function selectCalendarDate(event) {
    const value = event.target.value;
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match || Number(match[1]) !== expectedExamYear) return;
    setExamMonth(match[2]);
    setExamDay(match[3]);
  }

  function openCalendar() {
    const input = calendarInputRef.current;
    if (!input || !expectedExamYear) return;
    if (typeof input.showPicker === 'function') input.showPicker();
    else input.click();
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
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid #dbe5ef', borderRadius: 3 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} alignItems={{ lg: 'center' }} justifyContent="space-between" spacing={1.5}>
          <Stack direction="row" spacing={1.2} alignItems="center">
            <Box sx={{ p: .8, borderRadius: 2, bgcolor: '#f3e8ff', color: '#7c3aed', display: 'flex' }}>
              <FindInPageRoundedIcon />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: 20, color: '#0f172a', lineHeight: 1.2 }}>Consulta masiva de documentos</Typography>
              <Typography sx={{ color: '#64748b', mt: .25, fontSize: 12.5 }}>
                Valida cédula, código EK y fecha · procesamiento temporal en memoria
              </Typography>
            </Box>
          </Stack>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap alignItems="center">
            <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />} onClick={downloadTemplate}>Plantilla</Button>
            <Button size="small" component="label" variant="outlined" startIcon={<UploadFileRoundedIcon />} disabled={data?.status === 'PROCESSING'}>
              Seleccionar Excel
              <input ref={inputRef} hidden type="file" accept=".xlsx,.xls,.csv" onChange={(event) => setFile(event.target.files?.[0] || null)} />
            </Button>
            <Button size="small" variant="contained" onClick={upload} disabled={!file || busy || data?.status === 'PROCESSING'}>
              {busy ? <CircularProgress size={18} color="inherit" /> : 'Procesar'}
            </Button>
          </Stack>
        </Stack>

        {file && <Chip sx={{ mt: 1.5 }} size="small" color="info" variant="outlined" label={file.name} onDelete={() => setFile(null)} />}
        {notice && <Alert sx={{ mt: 1.5, py: 0 }} severity={notice.severity} onClose={() => setNotice(null)}>{notice.text}</Alert>}

        {data && (
          <>
            <Stack direction={{ xs: 'column', xl: 'row' }} justifyContent="space-between" alignItems={{ xl: 'center' }}
              spacing={1.5} sx={{ mt: 2, p: 1.25, bgcolor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap>
                <Chip size="small" label={`Total ${data.totalItems || 0}`} />
                <Chip size="small" color="success" label={`Extraídos ${data.extractedItems || 0}`} />
                <Chip size="small" color="info" label={`Corregidos ${data.correctedItems || 0}`} />
                <Chip size="small" color="warning" label={`Sin PDF ${data.noPdfItems || 0}`} />
                <Chip size="small" color="error" variant="outlined" label={`Novedades ${data.errorItems || 0}`} />
              </Stack>
              <Stack direction="row" spacing={.75} flexWrap="wrap" useFlexGap alignItems="center">
                <FormControl size="small" sx={{ minWidth: 190, bgcolor: '#fff' }}>
                  <InputLabel>Estado</InputLabel>
                  <Select value={filter} label="Estado" onChange={(event) => setFilter(event.target.value)}>
                    <MenuItem value="ALL">Todos ({items.length})</MenuItem>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <MenuItem key={value} value={value}>{label} ({counts[value] || 0})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                {retryButtonCount > 0 && (
                  <Button size="small" color="error" variant="outlined" startIcon={<RefreshRoundedIcon />}
                    disabled={data.status === 'PROCESSING' || busy} onClick={retry}>
                    Reprocesar novedades ({retryButtonCount})
                  </Button>
                )}
                <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
                  disabled={data.status === 'PROCESSING'} onClick={exportResults}>
                  Exportar
                </Button>
              </Stack>
            </Stack>

            {data.status === 'PROCESSING' && (
              <Box sx={{ mt: 1.5 }}>
                <Stack direction="row" justifyContent="space-between" sx={{ mb: .5 }}>
                  <Typography sx={{ fontSize: 12, fontWeight: 700 }}>Procesando {data.processedItems} de {data.totalItems}</Typography>
                  <Typography sx={{ fontSize: 12, color: '#64748b' }}>{progress}% · puede cerrar esta pantalla</Typography>
                </Stack>
                <LinearProgress variant="determinate" value={progress} sx={{ height: 6, borderRadius: 4 }} />
              </Box>
            )}

            <TableContainer sx={{ mt: 1.5, maxHeight: 570, border: '1px solid #e2e8f0', borderRadius: 2 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Fila</TableCell>
                    <TableCell>Identificación</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>EK leído (PDF)</TableCell>
                    <TableCell>Fecha leída (PDF)</TableCell>
                    <TableCell>Validación contra BD</TableCell>
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
              <Alert severity={reviewHasIdentificationMismatch ? 'error' : 'warning'}>
                {reviewHasIdentificationMismatch
                  ? 'La cédula del PDF pertenece a otra persona. Este registro no puede guardarse como corregido.'
                  : 'Verifique visualmente el documento antes de guardar. La corrección quedará registrada.'}
              </Alert>
              <TextField
                label="Número de registro EK (el año está en las posiciones 2 a 5)"
                value={registrationNumber}
                onChange={(event) => setRegistrationNumber(event.target.value.toUpperCase())}
                error={registrationFormatInvalid}
                helperText={registrationFormatInvalid
                  ? 'Use un código EK válido; sus cuatro primeros dígitos indican el año.'
                  : expectedExamYear ? `Año esperado para la fecha: ${expectedExamYear}` : 'Ejemplo: EK202531184043'}
              />
              <Box>
                <Typography sx={{ mb: 1, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                  Fecha del examen (día/mes/año)
                </Typography>
                <Stack direction="row" spacing={1} alignItems="flex-start">
                  <TextField
                    label="Día"
                    value={examDay}
                    onChange={(event) => setExamDay(event.target.value.replace(/\D/g, '').slice(0, 2))}
                    error={examDateInvalid}
                    inputProps={{ inputMode: 'numeric', min: 1, max: maxExamDay }}
                    sx={{ width: 86 }}
                  />
                  <TextField
                    select
                    label="Mes"
                    value={examMonth}
                    onChange={(event) => setExamMonth(event.target.value)}
                    error={examDateInvalid}
                    sx={{ minWidth: 105 }}
                  >
                    {Array.from({ length: 12 }, (_, index) => index + 1).map((month) => (
                      <MenuItem key={month} value={String(month).padStart(2, '0')}>
                        {String(month).padStart(2, '0')}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Año según EK"
                    value={expectedExamYear || ''}
                    InputProps={{ readOnly: true }}
                    sx={{ width: 145 }}
                  />
                  <Tooltip title="Elegir fecha en calendario">
                    <span>
                      <IconButton onClick={openCalendar} disabled={!expectedExamYear}
                        sx={{ mt: 0.8, border: '1px solid #cbd5e1', borderRadius: 2 }}>
                        <CalendarMonthRoundedIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                  <input
                    ref={calendarInputRef}
                    type="date"
                    value={examDate}
                    onChange={selectCalendarDate}
                    min={expectedExamYear ? `${expectedExamYear}-01-01` : undefined}
                    max={expectedExamYear ? `${expectedExamYear}-12-31` : undefined}
                    tabIndex={-1}
                    aria-hidden="true"
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }}
                  />
                </Stack>
                <Typography sx={{ mt: 0.75, fontSize: 12, color: examDateInvalid ? '#d32f2f' : '#64748b' }}>
                  {examDateInvalid
                    ? `Ingrese un día válido para el mes seleccionado de ${expectedExamYear}.`
                    : expectedExamYear
                      ? `El año ${expectedExamYear} fue colocado automáticamente desde el EK y no puede modificarse.`
                      : 'Primero ingrese un número de registro EK válido.'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: '#64748b' }}>Comparación automática: {reviewItem?.message || '—'}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReview}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={saveCorrection}
            disabled={busy || !registrationNumber || !expectedExamYear || !examDate
              || registrationFormatInvalid || examDateInvalid || reviewHasIdentificationMismatch}
          >
            Guardar corrección
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
