import React, { useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import { useSnackbar } from 'notistack';
import { getMisLegalizaciones, presentarLegalizacion } from '../services/legalizacionViaticosService';
import LegalizacionViaticosFormat from '../components/viaticos/LegalizacionViaticosFormat';

const labels = {
  pendiente_habilitacion: 'Pendiente de fecha de regreso',
  pendiente_legalizacion: 'Pendiente de legalización',
  legalizacion_vencida: 'Legalización vencida',
  en_revision: 'En revisión del Técnico Contable',
  finalizada: 'Finalizada'
};

export default function LegalizacionViaticos() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [selectedConcepts, setSelectedConcepts] = useState({});
  const [observaciones, setObservaciones] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getMisLegalizaciones();
      setRows(result.data || []);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las legalizaciones.', { variant: 'error' });
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const active = rows.find((row) => ['pendiente_legalizacion', 'legalizacion_vencida'].includes(row.legalizacion?.estado)) || rows[0];
  const submit = async () => {
    if (!active) return;
    const details = active.legalizacion.detalles || [];
    const missingValue = details.find((item) => values[item.id] === undefined || values[item.id] === '');
    if (missingValue) return enqueueSnackbar(`Ingrese el valor legalizado de ${missingValue.detalle}.`, { variant: 'warning' });
    const selectedWithoutFile = details.find((item) => selectedConcepts[item.id] && !files[item.id]);
    if (selectedWithoutFile) return enqueueSnackbar(`Seleccione el archivo de soporte de ${selectedWithoutFile.detalle} o desmarque “Incluir soporte”.`, { variant: 'warning' });
    const form = new FormData();
    form.append('detalles', JSON.stringify(details.map((item) => ({ id: item.id, valorLegalizado: Number(values[item.id]) }))));
    form.append('observaciones', observaciones);
    details.forEach((item) => {
      if (selectedConcepts[item.id] && files[item.id]) form.append(`soporte_${item.id}`, files[item.id]);
    });
    setSending(true);
    try {
      const result = await presentarLegalizacion(active.legalizacion.id, form);
      enqueueSnackbar(result.message, { variant: 'success' });
      await load();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible presentar la legalización.', { variant: 'error' });
    } finally { setSending(false); }
  };

  if (loading) return <Box sx={{ minHeight: 300, display: 'grid', placeItems: 'center' }}><CircularProgress /></Box>;
  if (!active) return <Alert severity="info">No tiene legalizaciones de viáticos pendientes.</Alert>;
  const editable = ['pendiente_legalizacion', 'legalizacion_vencida'].includes(active.legalizacion.estado);

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={2} sx={{ mb: 2.5 }}>
        <Box><Typography variant="h4" sx={{ fontWeight: 900, color: '#0b3a6f' }}>Legalización de viáticos</Typography><Typography color="text.secondary">Registre los valores ejecutados y un soporte por cada concepto autorizado.</Typography></Box>
        <Chip color={active.legalizacion.estado === 'legalizacion_vencida' ? 'error' : 'primary'} label={labels[active.legalizacion.estado] || active.legalizacion.estado} sx={{ fontWeight: 800 }} />
      </Stack>
      {active.legalizacion.estado === 'legalizacion_vencida' && <Alert severity="error" sx={{ mb: 2 }}>El plazo de tres días hábiles venció. La obligación continúa pendiente y puede legalizarla ahora.</Alert>}
      {active.legalizacion.estado === 'pendiente_habilitacion' && <Alert severity="info">El formulario se habilitará el {active.legalizacion.fecha_habilitacion}.</Alert>}
      <LegalizacionViaticosFormat
        solicitud={active.solicitud}
        legalizacion={active.legalizacion}
        mode="collaborator"
        editable={editable}
        values={values}
        onValueChange={(id, value) => setValues((current) => ({ ...current, [id]: value }))}
        selectedConcepts={selectedConcepts}
        onConceptToggle={(id, checked) => setSelectedConcepts((current) => ({ ...current, [id]: checked }))}
        files={files}
        onFileChange={(id, file) => setFiles((current) => ({ ...current, [id]: file }))}
        observations={observaciones}
        onObservationsChange={setObservaciones}
      />
      {editable && <Button onClick={submit} disabled={sending} variant="contained" size="large" startIcon={sending ? <CircularProgress size={18} color="inherit" /> : <ReceiptLongRoundedIcon />} sx={{ mt: 2.5, borderRadius: 2.5, textTransform: 'none', fontWeight: 850 }}>Enviar legalización al Técnico Contable</Button>}
    </Box>
  );
}
