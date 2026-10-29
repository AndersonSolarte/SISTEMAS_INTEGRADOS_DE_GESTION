import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, InputAdornment, LinearProgress, Paper, Stack, TextField, Typography } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';
import { useSnackbar } from 'notistack';
import { getMisLegalizaciones, presentarLegalizacion } from '../services/legalizacionViaticosService';
import LegalizacionViaticosFormat from '../components/viaticos/LegalizacionViaticosFormat';

const pendingStates = ['pendiente_legalizacion', 'legalizacion_vencida'];
const formatCop = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00Z`)) : 'Sin registrar';
const advanceTotal = (row) => Number(row.solicitud?.liquidacion?.totalAnticipo) || (row.legalizacion?.detalles || []).reduce((sum, item) => sum + Number(item.valorAnticipo || 0), 0);

export default function LegalizacionViaticos() {
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('ALL');
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [selectedConcepts, setSelectedConcepts] = useState({});
  const [observaciones, setObservaciones] = useState('');
  const [sending, setSending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const result = await getMisLegalizaciones();
      setRows((result.data || []).filter((row) => pendingStates.includes(row.legalizacion?.estado)));
      window.dispatchEvent(new CustomEvent('legalizacion:updated'));
    } catch (error) {
      setLoadError(true);
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las legalizaciones.', { variant: 'error' });
    } finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const filteredRows = useMemo(() => {
    const search = searchTerm.toLocaleLowerCase('es').trim();
    return rows.filter((row) => {
      const sol = row.solicitud || {};
      const searchable = `${sol.consecutivo || ''} ${sol.datos_viaticos?.lugarVisitar || sol.datos_salida?.municipio || ''}`.toLocaleLowerCase('es');
      return (!search || searchable.includes(search)) && (filterState === 'ALL' || row.legalizacion.estado === filterState);
    }).sort((a, b) => String(a.legalizacion.fecha_limite || '9999').localeCompare(String(b.legalizacion.fecha_limite || '9999')));
  }, [rows, searchTerm, filterState]);

  const overdue = rows.filter((row) => row.legalizacion.estado === 'legalizacion_vencida').length;
  const openRow = (row) => {
    setSelectedRow(row);
    setValues({}); setFiles({}); setSelectedConcepts({});
    setObservaciones(row.legalizacion.observaciones || '');
  };

  const submit = async () => {
    if (!selectedRow || sending) return;
    const details = selectedRow.legalizacion.detalles || [];
    const invalid = details.find((item) => values[item.id] === undefined || values[item.id] === '' || !Number.isFinite(Number(values[item.id])) || Number(values[item.id]) < 0);
    if (invalid) return enqueueSnackbar(`Ingrese un valor válido para ${invalid.detalle}.`, { variant: 'warning' });
    const missing = details.find((item) => selectedConcepts[item.id] && !files[item.id]);
    if (missing) return enqueueSnackbar(`Adjunte el soporte de ${missing.detalle} o desmarque "Incluir soporte".`, { variant: 'warning' });
    const form = new FormData();
    form.append('detalles', JSON.stringify(details.map((item) => ({ id: item.id, valorLegalizado: Number(values[item.id]) }))));
    form.append('observaciones', observaciones);
    details.forEach((item) => { if (selectedConcepts[item.id] && files[item.id]) form.append(`soporte_${item.id}`, files[item.id]); });
    setUploadProgress(0);
    setSending(true);
    try {
      const result = await presentarLegalizacion(selectedRow.legalizacion.id, form, ({ loaded, total }) => {
        if (total > 0) setUploadProgress(Math.min(100, Math.round(loaded * 100 / total)));
      });
      enqueueSnackbar(result.message || 'Legalización presentada al Técnico Contable.', { variant: result.emailSent === false ? 'warning' : 'success' });
      setRows((current) => current.filter((row) => row.legalizacion.id !== selectedRow.legalizacion.id));
      setSelectedRow(null);
      window.dispatchEvent(new CustomEvent('legalizacion:updated'));
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible presentar la legalización.', { variant: 'error' });
    } finally { setSending(false); }
  };

  if (loading) return <Box role="status" aria-label="Cargando legalizaciones" sx={{ minHeight: 380, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (loadError) return <Alert severity="error" action={<Button color="inherit" onClick={load}>Reintentar</Button>}>No pudimos consultar sus pendientes. Intente nuevamente.</Alert>;

  if (selectedRow) {
    const { solicitud, legalizacion } = selectedRow;
    return (
      <Box sx={{ width: '100%', minWidth: 0, pb: 3 }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} alignItems={{ xs: 'stretch', lg: 'center' }} gap={2} sx={{ mb: 3 }}>
          <Button disabled={sending} startIcon={<ArrowBackIcon />} onClick={() => setSelectedRow(null)} variant="outlined" sx={{ alignSelf: 'flex-start', borderRadius: 3, textTransform: 'none' }}>Volver a pendientes</Button>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="h1" sx={{ fontWeight: 900, color: '#0b3a6f', fontSize: { xs: 21, md: 28 }, overflowWrap: 'anywhere' }}>Legalizar {solicitud.consecutivo}</Typography>
            <Typography color="text.secondary" variant="body2">Registre lo utilizado en cada concepto autorizado y adjunte los soportes correspondientes.</Typography>
          </Box>
          <Chip icon={<EventAvailableIcon />} label={`Fecha límite: ${formatDate(legalizacion.fecha_limite)}`} sx={{ alignSelf: 'flex-start', maxWidth: '100%' }} />
        </Stack>
        {legalizacion.estado === 'legalizacion_vencida' && <Alert severity="warning" sx={{ mb: 2, borderRadius: 3 }}>El plazo registrado venció. Aún puede presentar su legalización para completar la obligación.</Alert>}
        <LegalizacionViaticosFormat solicitud={solicitud} legalizacion={legalizacion} mode="collaborator" editable={!sending}
          values={values} onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
          selectedConcepts={selectedConcepts} onConceptToggle={(id, checked) => setSelectedConcepts((current) => ({ ...current, [id]: checked }))}
          files={files} onFileChange={(id, file) => setFiles((current) => ({ ...current, [id]: file }))}
          observations={observaciones} onObservationsChange={setObservaciones} />
        <Paper elevation={0} sx={{ mt: 2, p: { xs: 2, md: 3 }, borderRadius: 3, border: '1px solid #dbe5f1' }}>
          {sending && <Box role="status" sx={{ mb: 2 }}><Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{uploadProgress < 100 ? `Cargando datos y soportes: ${uploadProgress}%` : 'Guardando su legalización. La confirmación llegará sin esperar el envío del correo.'}</Typography><LinearProgress variant={uploadProgress < 100 ? 'determinate' : 'indeterminate'} value={uploadProgress} sx={{ borderRadius: 2 }} /></Box>}
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} gap={2}>
            <Box sx={{ flex: 1 }}><Typography fontWeight={800}>¿Todo está listo?</Typography><Typography variant="body2" color="text.secondary">Al enviar, el Técnico Contable revisará la legalización. Esta solicitud saldrá de sus pendientes.</Typography></Box>
            <Button onClick={submit} disabled={sending} variant="contained" size="large" startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <ReceiptLongRoundedIcon />} sx={{ borderRadius: 3, textTransform: 'none', px: 3, py: 1.5, fontWeight: 800 }}>Enviar al Técnico Contable</Button>
          </Stack>
        </Paper>
      </Box>
    );
  }

  if (rows.length === 0) return (
    <Paper elevation={0} sx={{ width: '100%', boxSizing: 'border-box', py: { xs: 5, md: 9 }, px: 3, textAlign: 'center', borderRadius: 4, border: '1px solid #dbe5f1' }}>
      <CheckCircleOutlineIcon sx={{ fontSize: 62, color: '#059669', mb: 2 }} />
      <Typography component="h1" variant="h5" fontWeight={900} color="#0b3a6f">Está al día con sus legalizaciones</Typography>
      <Typography sx={{ mt: 1, maxWidth: 580, mx: 'auto', color: 'text.secondary' }}>No tiene legalizaciones pendientes por presentar. Esta opción se oculta del menú y volverá a aparecer si tiene una nueva comisión habilitada para legalizar.</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Las copias de sus documentos se envían a su correo institucional.</Typography>
      <Button variant="contained" onClick={() => navigate('/dashboard')} sx={{ mt: 3, borderRadius: 3, textTransform: 'none' }}>Volver al inicio</Button>
    </Paper>
  );

  return (
    <Box sx={{ width: '100%', minWidth: 0, pb: 3 }}>
      <Paper elevation={0} sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4, mb: 3, color: '#fff', background: 'linear-gradient(120deg,#0b284f 0%,#124b86 65%,#2563eb 100%)' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} alignItems={{ sm: 'center' }} gap={2}>
          <Box sx={{ display: 'grid', placeItems: 'center', p: 1.5, borderRadius: 3, bgcolor: '#ffffff20', alignSelf: 'flex-start' }}><ReceiptLongRoundedIcon sx={{ fontSize: 34 }} /></Box>
          <Box sx={{ flex: 1 }}><Typography sx={{ fontSize: 11, letterSpacing: 1.2, fontWeight: 800, color: '#bfdbfe', textTransform: 'uppercase' }}>Mi espacio · SIAC</Typography><Typography component="h1" sx={{ fontSize: { xs: 25, md: 34 }, fontWeight: 900, mt: .5 }}>Legalización de viáticos</Typography><Typography sx={{ mt: .8, color: '#dbeafe', fontSize: 14 }}>Complete sus pendientes de viaje. Seleccione una comisión para registrar los gastos y enviar sus soportes.</Typography></Box>
          <Button color="inherit" variant="outlined" startIcon={<RefreshRoundedIcon />} onClick={load} sx={{ alignSelf: { xs: 'flex-start', sm: 'center' }, borderColor: '#ffffff60', borderRadius: 3, textTransform: 'none' }}>Actualizar</Button>
        </Stack>
      </Paper>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3,minmax(0,1fr))' }, gap: 2, mb: 3 }}>
        {[
          { label: 'Pendientes por presentar', value: rows.length, icon: ReceiptLongRoundedIcon, color: '#1d4ed8', bg: '#eff6ff' },
          { label: 'Con plazo vencido', value: overdue, icon: WarningAmberIcon, color: '#b45309', bg: '#fffbeb' },
          { label: 'Anticipo por legalizar', value: formatCop(rows.reduce((sum, row) => sum + advanceTotal(row), 0)), icon: EventAvailableIcon, color: '#0b3a6f', bg: '#f1f5f9' }
        ].map(({ label, value, icon: Icon, color, bg }) => <Paper key={label} elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, border: '1px solid #dbe5f1', display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}><Box sx={{ p: 1.2, display: 'flex', borderRadius: 3, bgcolor: bg, color }}><Icon /></Box><Box sx={{ minWidth: 0 }}><Typography sx={{ color: 'text.secondary', fontSize: 12, fontWeight: 700 }}>{label}</Typography><Typography sx={{ fontSize: { xs: 23, lg: 28 }, fontWeight: 900, color, overflowWrap: 'anywhere' }}>{value}</Typography></Box></Paper>)}
      </Box>
      <Paper elevation={0} sx={{ p: 2, mb: 3, borderRadius: 3, border: '1px solid #dbe5f1' }}>
        <Stack direction={{ xs: 'column', lg: 'row' }} gap={2} alignItems={{ lg: 'center' }}>
          <TextField fullWidth size="small" label="Buscar comisión" placeholder="Consecutivo o destino" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon /></InputAdornment> }} sx={{ flex: 1, minWidth: 0, '& .MuiOutlinedInput-root': { borderRadius: 2.5 } }} />
          <Stack direction="row" flexWrap="wrap" gap={1}>
            {[['ALL', 'Todas las pendientes'], ['pendiente_legalizacion', 'En plazo'], ['legalizacion_vencida', 'Plazo vencido']].map(([key, label]) => <Chip key={key} label={label} onClick={() => setFilterState(key)} color={filterState === key ? 'primary' : 'default'} variant={filterState === key ? 'filled' : 'outlined'} sx={{ fontWeight: 700 }} />)}
          </Stack>
        </Stack>
      </Paper>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 2 }}><Typography component="h2" fontWeight={900} color="#0b3a6f" fontSize={19}>Sus comisiones pendientes</Typography><Typography variant="body2" color="text.secondary">{filteredRows.length} de {rows.length}</Typography></Stack>
      {filteredRows.length === 0 ? <Alert severity="info" sx={{ borderRadius: 3 }}>No hay pendientes que coincidan con su búsqueda o filtro.</Alert> : (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0,1fr)', md: 'repeat(2,minmax(0,1fr))', xl: 'repeat(3,minmax(0,1fr))' }, gap: 2.5 }}>
          {filteredRows.map((row) => {
            const sol = row.solicitud || {}, leg = row.legalizacion;
            const expired = leg.estado === 'legalizacion_vencida';
            return <Paper component="article" key={leg.id} elevation={0} sx={{ display: 'flex', flexDirection: 'column', minWidth: 0, p: { xs: 2, md: 2.5 }, borderRadius: 4, border: '1px solid #dbe5f1', borderTop: `3px solid ${expired ? '#f59e0b' : '#2563eb'}`, transition: 'box-shadow .2s', '&:hover': { boxShadow: '0 8px 28px #0b3a6f10' } }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1} sx={{ mb: 2 }}><Typography variant="caption" fontWeight={800} color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{sol.consecutivo}</Typography><Chip size="small" label={expired ? 'Plazo vencido' : 'En plazo'} color={expired ? 'warning' : 'primary'} variant="outlined" sx={{ flexShrink: 0, fontWeight: 700 }} /></Stack>
              <Stack direction="row" gap={1} alignItems="flex-start"><PlaceOutlinedIcon sx={{ color: '#2563eb', mt: .2 }} /><Typography component="h3" sx={{ fontSize: 18, fontWeight: 800, color: '#0b3a6f', overflowWrap: 'anywhere' }}>{sol.datos_viaticos?.lugarVisitar || sol.datos_salida?.municipio || 'Destino sin registrar'}</Typography></Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1, mb: 2 }}>{formatDate(sol.datos_salida?.fecha)} — {formatDate(sol.datos_salida?.fechaRegreso)}</Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2,minmax(0,1fr))', gap: 2, p: 1.5, borderRadius: 2.5, bgcolor: '#f8fafc', mb: 2 }}>
                <Box><Typography variant="caption" color="text.secondary">Anticipo recibido</Typography><Typography fontWeight={900} color="#0b3a6f" sx={{ mt: .5, overflowWrap: 'anywhere' }}>{formatCop(advanceTotal(row))}</Typography></Box>
                <Box><Typography variant="caption" color="text.secondary">Fecha límite</Typography><Typography fontWeight={800} sx={{ mt: .5, color: expired ? '#b45309' : '#0b3a6f' }}>{formatDate(leg.fecha_limite)}</Typography></Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, flex: 1 }}>{expired ? 'Puede completar la legalización aunque el plazo haya vencido.' : 'Registre los gastos ejecutados y adjunte sus soportes.'}</Typography>
              <Button fullWidth variant="contained" endIcon={<ArrowForwardRoundedIcon />} onClick={() => openRow(row)} aria-label={`Legalizar ${sol.consecutivo}`} sx={{ py: 1.2, borderRadius: 2.5, textTransform: 'none', fontWeight: 800, boxShadow: 'none' }}>Legalizar comisión</Button>
            </Paper>;
          })}
        </Box>
      )}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 3 }}>Este espacio muestra únicamente solicitudes pendientes de su actuación. Los documentos se envían a su correo institucional.</Typography>
    </Box>
  );
}
