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
import DeleteSweepRoundedIcon from '@mui/icons-material/DeleteSweepRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import api from '../../services/api';

const BASE_URL = '/planeacion/gestion-informacion/saber-pro/consulta/documentos-masivos';

const STATUS_LABELS = {
  PENDING: 'Pendiente',
  EXTRACTED: 'Extraído',
  CORRECTED: 'Corregido',
  INCOMPLETE: 'Revisar',
  ERROR: 'Error',
  NOT_FOUND: 'No encontrado',
  NO_PDF: 'Sin PDF',
  INVALID: 'Inválido'
};

const statusColor = (status) => ({
  EXTRACTED: 'success',
  CORRECTED: 'info',
  PENDING: 'default',
  INCOMPLETE: 'warning',
  ERROR: 'error',
  NOT_FOUND: 'warning',
  NO_PDF: 'warning',
  INVALID: 'error'
}[status] || 'default');

function displayDate(value) {
  const isoMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return `${isoMatch[3]}/${isoMatch[2]}/${isoMatch[1]}`;
  const slashMatch = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return slashMatch ? `${slashMatch[1]}/${slashMatch[2]}/${slashMatch[3]}` : '';
}

function toIsoFromDisplay(value) {
  const isoMatch = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return value;
  const slashMatch = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return slashMatch ? `${slashMatch[3]}-${slashMatch[2]}-${slashMatch[1]}` : '';
}

function enrichItem(rawItem) {
  const msg = String(rawItem?.message || '');
  const refEkMatch = msg.match(/Referencia BD:(?:.*?doc\s+(\d+|sin dato)\s*·)?\s*EK\s+([A-Z0-9]+|sin dato)\s*·\s*fecha\s+(\d{2}\/\d{2}\/\d{4}|\d{4}-\d{2}-\d{2}|sin dato)/i);
  const parsedDbEk = refEkMatch && refEkMatch[2] && refEkMatch[2].toLowerCase() !== 'sin dato'
    ? refEkMatch[2].toUpperCase() : null;
  const parsedDbDateRaw = refEkMatch && refEkMatch[3] && refEkMatch[3].toLowerCase() !== 'sin dato'
    ? refEkMatch[3] : null;
  const parsedDbDate = toIsoFromDisplay(parsedDbDateRaw) || null;

  const dbIdentification = rawItem.dbIdentification || rawItem.identification || null;
  const pdfIdMismatchMatch = msg.match(/(?:cédula|documento)\s+le[íi]d[oa]\s+en\s+el\s+PDF\s*\((\d+)\)/i);
  const pdfIdentification = rawItem.pdfIdentification
    || (pdfIdMismatchMatch ? pdfIdMismatchMatch[1] : null)
    || (!msg.includes('Cédula no legible') && !msg.includes('No se pudo leer el número de documento') && rawItem.registrationNumber ? rawItem.identification : null);

  const dbRegistrationNumber = rawItem.dbRegistrationNumber !== undefined
    ? rawItem.dbRegistrationNumber
    : parsedDbEk;
  const registrationNumber = rawItem.registrationNumber || null;

  const dbExamDate = rawItem.dbExamDate !== undefined
    ? rawItem.dbExamDate
    : parsedDbDate;
  const examDate = rawItem.examDate || null;

  const identificationMatch = Boolean(dbIdentification && pdfIdentification && dbIdentification === pdfIdentification);
  const registrationMatch = Boolean(dbRegistrationNumber && registrationNumber && dbRegistrationNumber === registrationNumber);
  const examDateMatch = Boolean(dbExamDate && examDate && dbExamDate === examDate);

  const hasMissingOrMismatch = !dbIdentification || !pdfIdentification
    || !dbRegistrationNumber || !registrationNumber
    || !dbExamDate || !examDate
    || !identificationMatch || !registrationMatch || !examDateMatch;
  const effectiveStatus = rawItem.status === 'EXTRACTED' && hasMissingOrMismatch ? 'INCOMPLETE' : rawItem.status;

  return {
    ...rawItem,
    status: effectiveStatus,
    hasMissingOrMismatch,
    dbIdentification,
    pdfIdentification,
    identificationMatch,
    dbRegistrationNumber,
    registrationNumber,
    registrationMatch,
    dbExamDate,
    examDate,
    examDateMatch
  };
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

function ComparisonValue({ value, matches, emptyLabel = '—' }) {
  const hasValue = Boolean(value);
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {hasValue ? (
        matches ? (
          <CheckCircleRoundedIcon sx={{ fontSize: 14, color: '#16a34a', flexShrink: 0 }} />
        ) : (
          <WarningAmberRoundedIcon sx={{ fontSize: 14, color: '#d97706', flexShrink: 0 }} />
        )
      ) : (
        <WarningAmberRoundedIcon sx={{ fontSize: 14, color: '#dc2626', flexShrink: 0 }} />
      )}
      <Typography
        sx={{
          fontSize: 12,
          fontWeight: matches ? 700 : 800,
          color: !hasValue ? '#dc2626' : matches ? '#15803d' : '#b45309',
          whiteSpace: 'nowrap'
        }}
      >
        {value || emptyLabel}
      </Typography>
    </Stack>
  );
}

export default function ConsultaDocumentosMasiva() {
  const [data, setData] = useState(null);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('ALL');
  const [notice, setNotice] = useState(null);
  const [reviewItem, setReviewItem] = useState(null);
  const [pdfIdentification, setPdfIdentification] = useState('');
  const [registrationNumber, setRegistrationNumber] = useState('');
  const [examDay, setExamDay] = useState('');
  const [examMonth, setExamMonth] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const inputRef = useRef(null);
  const calendarInputRef = useRef(null);

  const expectedDbIdentification = String(reviewItem?.dbIdentification || reviewItem?.identification || '').replace(/\D/g, '');
  const normalizedPdfIdentification = String(pdfIdentification || '').replace(/\D/g, '');
  const pdfIdentificationInvalid = Boolean(!normalizedPdfIdentification || (expectedDbIdentification && normalizedPdfIdentification !== expectedDbIdentification));

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

  const items = useMemo(() => (data?.items || []).map(enrichItem), [data?.items]);
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
      setNotice({ severity: 'info', text: 'Se reanudó el procesamiento de filas pendientes y por revisar.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible reintentar las filas.' });
    } finally {
      setBusy(false);
    }
  }

  async function clearConsultation() {
    setBusy(true);
    setNotice(null);
    try {
      await api.delete(BASE_URL);
      setData(null);
      setFilter('ALL');
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
      setClearConfirmOpen(false);
      setNotice({ severity: 'success', text: 'La consulta temporal fue eliminada de SIAC.' });
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible limpiar la consulta.' });
    } finally {
      setBusy(false);
    }
  }

  async function openReview(item) {
    setReviewItem(item);
    setPdfIdentification(item.pdfIdentification || item.dbIdentification || item.identification || '');
    setRegistrationNumber(item.registrationNumber || item.dbRegistrationNumber || '');
    const currentDate = String(item.examDate || item.dbExamDate || '');
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
      await api.patch(`${BASE_URL}/items/${reviewItem.id}`, {
        pdfIdentification: normalizedPdfIdentification,
        registrationNumber,
        examDate
      });
      const response = await api.get(`${BASE_URL}/${data.id}`);
      setData(response.data.data);
      setNotice({ severity: 'success', text: 'Validación y corrección guardada.' });
      closeReview();
    } catch (error) {
      setNotice({ severity: 'error', text: error.response?.data?.message || 'No fue posible guardar la validación.' });
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
                <Chip size="small" label={`Total ${items.length}`} />
                <Chip size="small" color="success" label={`Extraídos ${counts.EXTRACTED || 0}`} />
                <Chip size="small" color="info" label={`Corregidos ${counts.CORRECTED || 0}`} />
                <Chip size="small" color="warning" label={`Sin PDF ${counts.NO_PDF || 0}`} />
                <Chip size="small" color="error" variant="outlined" label={`Revisar ${(counts.INCOMPLETE || 0) + (counts.ERROR || 0) + (counts.INVALID || 0)}`} />
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
                  <Button size="small" color="warning" variant="outlined" startIcon={<RefreshRoundedIcon />}
                    disabled={data.status === 'PROCESSING' || busy} onClick={retry}>
                    Reprocesar por revisar ({retryButtonCount})
                  </Button>
                )}
                <Button size="small" variant="outlined" startIcon={<DownloadRoundedIcon />}
                  disabled={data.status === 'PROCESSING'} onClick={exportResults}>
                  Exportar
                </Button>
                <Button size="small" color="error" variant="outlined" startIcon={<DeleteSweepRoundedIcon />}
                  disabled={data.status === 'PROCESSING' || busy} onClick={() => setClearConfirmOpen(true)}>
                  Limpiar
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
              <Table stickyHeader size="small" sx={{ '& th, & td': { px: 1.25, py: 0.9 } }}>
                <TableHead>
                  <TableRow sx={{ '& th': { whiteSpace: 'nowrap', fontSize: 11.5, fontWeight: 800, color: '#475569' } }}>
                    <TableCell>Fila</TableCell>
                    <TableCell>Doc. BD</TableCell>
                    <TableCell>Doc. PDF</TableCell>
                    <TableCell>Estado</TableCell>
                    <TableCell>EK BD</TableCell>
                    <TableCell>EK PDF</TableCell>
                    <TableCell>Fecha BD</TableCell>
                    <TableCell>Fecha PDF</TableCell>
                    <TableCell>Validación</TableCell>
                    <TableCell align="center">Revisar</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {visibleItems.map((item) => {
                    const reviewable = item.hasDocument && (
                      ['INCOMPLETE', 'ERROR', 'CORRECTED'].includes(item.status) || item.hasMissingOrMismatch
                    );
                    return (
                      <TableRow key={item.id} hover>
                        <TableCell sx={{ fontSize: 12 }}>{item.rowNumber}</TableCell>
                        <TableCell sx={{ fontWeight: 800, fontSize: 12.5, color: '#0f172a', whiteSpace: 'nowrap' }}>
                          {item.dbIdentification || item.identification}
                        </TableCell>
                        <TableCell>
                          {item.hasDocument ? (
                            <ComparisonValue
                              value={item.pdfIdentification}
                              matches={item.identificationMatch}
                              emptyLabel="No leído"
                            />
                          ) : '—'}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColor(item.status)}
                            label={STATUS_LABELS[item.status] || item.status}
                            sx={{ fontWeight: 700, height: 22, fontSize: 11.5 }}
                          />
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, color: item.dbRegistrationNumber ? '#334155' : '#dc2626', whiteSpace: 'nowrap' }}>
                          {item.dbRegistrationNumber || 'Sin dato'}
                        </TableCell>
                        <TableCell>
                          {item.hasDocument ? (
                            <ComparisonValue
                              value={item.registrationNumber}
                              matches={item.registrationMatch}
                              emptyLabel="No leído"
                            />
                          ) : '—'}
                        </TableCell>
                        <TableCell sx={{ fontWeight: 700, fontSize: 12, color: item.dbExamDate ? '#334155' : '#dc2626', whiteSpace: 'nowrap' }}>
                          {displayDate(item.dbExamDate) || 'Sin dato'}
                        </TableCell>
                        <TableCell>
                          {item.hasDocument ? (
                            <ComparisonValue
                              value={displayDate(item.examDate)}
                              matches={item.examDateMatch}
                              emptyLabel="No leída"
                            />
                          ) : '—'}
                        </TableCell>
                        <TableCell sx={{ minWidth: 210, fontSize: 11.5, color: '#334155' }}>
                          {item.message || '—'}
                        </TableCell>
                        <TableCell align="center">
                          {reviewable ? (
                            <Tooltip title="Visualizar PDF, validar y corregir información">
                              <IconButton size="small" color="primary" onClick={() => openReview(item)}>
                                <VisibilityRoundedIcon fontSize="small" />
                              </IconButton>
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

      <Dialog open={clearConfirmOpen} onClose={() => !busy && setClearConfirmOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Limpiar consulta temporal</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mt: 1 }}>
            Se eliminarán de SIAC todas las filas y resultados temporales de la consulta. Esta acción no modifica
            la base institucional ni elimina los PDF del servidor de consulta.
          </Alert>
        </DialogContent>
        <DialogActions>
          <Button disabled={busy} onClick={() => setClearConfirmOpen(false)}>Cancelar</Button>
          <Button color="error" variant="contained" startIcon={<DeleteSweepRoundedIcon />}
            disabled={busy} onClick={clearConsultation}>
            {busy ? <CircularProgress size={18} color="inherit" /> : 'Sí, limpiar'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(reviewItem)} onClose={closeReview} fullWidth maxWidth="xl">
        <DialogTitle>
          Revisar y validar documento — {reviewItem?.dbIdentification || reviewItem?.identification}
        </DialogTitle>
        <DialogContent dividers>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ minHeight: 620 }}>
            <Box sx={{ flex: 1.6, bgcolor: '#eef2f7', borderRadius: 2, overflow: 'hidden', minHeight: 600 }}>
              {pdfLoading && <Stack alignItems="center" justifyContent="center" sx={{ height: 600 }}><CircularProgress /></Stack>}
              {!pdfLoading && pdfUrl && <iframe title="Documento institucional" src={pdfUrl} width="100%" height="620" style={{ border: 0 }} />}
              {!pdfLoading && !pdfUrl && <Alert severity="error">No fue posible cargar el PDF.</Alert>}
            </Box>
            <Stack spacing={2} sx={{ flex: .85, minWidth: { lg: 370 } }}>
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: '#f8fafc', borderColor: '#e2e8f0' }}>
                <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#0f172a', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Comparación BD Externa vs PDF
                </Typography>
                <Stack spacing={0.8}>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>Doc. BD:</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {reviewItem?.dbIdentification || reviewItem?.identification || 'Sin dato'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>Doc. PDF:</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: reviewItem?.identificationMatch ? '#16a34a' : '#dc2626' }}>
                      {reviewItem?.pdfIdentification || 'No leído'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>EK BD:</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: reviewItem?.dbRegistrationNumber ? '#0f172a' : '#dc2626' }}>
                      {reviewItem?.dbRegistrationNumber || 'Sin dato'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>EK PDF:</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: reviewItem?.registrationMatch ? '#16a34a' : '#d97706' }}>
                      {reviewItem?.registrationNumber || 'No leído'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>Fecha BD:</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: reviewItem?.dbExamDate ? '#0f172a' : '#dc2626' }}>
                      {displayDate(reviewItem?.dbExamDate) || 'Sin dato'}
                    </Typography>
                  </Stack>
                  <Stack direction="row" justifyContent="space-between">
                    <Typography sx={{ fontSize: 12, color: '#64748b' }}>Fecha PDF:</Typography>
                    <Typography sx={{ fontSize: 12, fontWeight: 800, color: reviewItem?.examDateMatch ? '#16a34a' : '#d97706' }}>
                      {displayDate(reviewItem?.examDate) || 'No leída'}
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

              <Alert severity={pdfIdentificationInvalid ? 'error' : 'info'}>
                {pdfIdentificationInvalid
                  ? `El documento del PDF debe coincidir con Doc. BD (${expectedDbIdentification}).`
                  : 'Verifique visualmente el PDF y confirme o corrija el documento, código EK y fecha.'}
              </Alert>

              <TextField
                label="Documento visto en el PDF"
                value={pdfIdentification}
                onChange={(event) => setPdfIdentification(event.target.value.replace(/\D/g, ''))}
                error={pdfIdentificationInvalid}
                helperText={pdfIdentificationInvalid
                  ? `No coincide con Doc. BD (${expectedDbIdentification}).`
                  : `Coincide con Doc. BD (${expectedDbIdentification}).`}
              />

              <TextField
                label="Código EK visto en el PDF"
                value={registrationNumber}
                onChange={(event) => setRegistrationNumber(event.target.value.toUpperCase())}
                error={registrationFormatInvalid}
                helperText={registrationFormatInvalid
                  ? 'Use un código EK válido; sus cuatro primeros dígitos indican el año.'
                  : expectedExamYear
                    ? `Año esperado: ${expectedExamYear} · EK BD: ${reviewItem?.dbRegistrationNumber || 'Sin dato'}`
                    : 'Ejemplo: EK202431498237'}
              />

              <Box>
                <Typography sx={{ mb: 1, fontSize: 13, fontWeight: 700, color: '#334155' }}>
                  Fecha del examen según PDF (día/mes/año)
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
                      ? `Fecha BD: ${displayDate(reviewItem?.dbExamDate) || 'Sin dato'}`
                      : 'Primero ingrese un número de registro EK válido.'}
                </Typography>
              </Box>
              <Typography sx={{ fontSize: 12, color: '#64748b' }}>Detalle actual: {reviewItem?.message || '—'}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeReview}>Cancelar</Button>
          <Button variant="contained" startIcon={<SaveRoundedIcon />} onClick={saveCorrection}
            disabled={busy || !registrationNumber || !expectedExamYear || !examDate
              || registrationFormatInvalid || examDateInvalid || pdfIdentificationInvalid}
          >
            Guardar validación
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
