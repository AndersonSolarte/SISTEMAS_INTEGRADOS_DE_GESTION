import React, { useMemo } from 'react';
import { Alert, Box, Button, Checkbox, Chip, FormControlLabel, Paper, Stack, TextField, Typography } from '@mui/material';
import AttachFileRoundedIcon from '@mui/icons-material/AttachFileRounded';
import UploadFileRoundedIcon from '@mui/icons-material/UploadFileRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import logoFormatos from '../../assets/logoFormatos';

const currency = (value) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(value || 0));
const formatDate = (value) => value ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium' }).format(new Date(`${String(value).slice(0, 10)}T12:00:00`)) : 'Sin registrar';

export default function LegalizacionViaticosFormat({
  solicitud,
  legalizacion,
  mode = 'collaborator',
  editable = false,
  values = {},
  onValueChange,
  selectedConcepts = {},
  onConceptToggle,
  files = {},
  onFileChange,
  observations = '',
  onObservationsChange,
  onOpenSupport,
  demo = false
}) {
  const details = legalizacion?.detalles || [];
  const attachments = legalizacion?.adjuntos || [];
  const salida = solicitud?.datos_salida || {};
  const viaticos = solicitud?.datos_viaticos || {};
  const lodging = String(viaticos.alojamiento || '');
  const transport = String(viaticos.transporte || '');
  const summaryFields = [
    { label: 'Fecha de legalización', value: formatDate(legalizacion?.presentado_at || new Date().toISOString()), span: 1 },
    { label: 'Programa / Dependencia', value: solicitud?.datos_laborales?.dependencia, span: 2 },
    { label: 'Días empleados', value: viaticos.numeroDiasSolicitados ? `${viaticos.numeroDiasSolicitados} día(s)` : '', span: 1 },
    { label: 'Nombre del empleado', value: solicitud?.solicitante_snapshot?.nombre, span: 2 },
    { label: 'Documento de identidad', value: solicitud?.solicitante_snapshot?.documento, span: 1 },
    { label: 'Cargo', value: solicitud?.datos_laborales?.cargo, span: 1 },
    { label: 'Lugar visitado', value: viaticos.lugarVisitar, span: 2 },
    { label: 'Fecha de salida', value: formatDate(salida.fecha), span: 1 },
    { label: 'Fecha de regreso', value: formatDate(salida.fechaRegreso), span: 1 }
  ];
  const totals = useMemo(() => {
    const advance = details.reduce((sum, item) => sum + Number(item.valorAnticipo || 0), 0);
    const legalized = details.reduce((sum, item) => sum + Number(values[item.id] ?? item.valorLegalizado ?? 0), 0);
    const difference = advance - legalized;
    return {
      advance,
      legalized,
      difference,
      universityBalance: Math.max(difference, 0),
      employeeBalance: Math.max(-difference, 0)
    };
  }, [details, values]);
  const collaboratorMode = mode === 'collaborator';

  return (
    <Paper variant="outlined" sx={{ borderRadius: { xs: 2.5, md: 3.5 }, overflow: 'hidden', bgcolor: '#fff', borderColor: '#cbd5e1' }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '210px 1fr 220px' }, borderBottom: '2px solid #0b3a6f' }}>
        <Box sx={{ p: 1.1, minHeight: 86, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRight: { md: '1px solid #cbd5e1' }, bgcolor: '#fff' }}>
          <Box
            component="img"
            src={logoFormatos}
            alt="Logo institucional Universidad CESMAG para formatos"
            sx={{ display: 'block', width: '100%', maxWidth: 205, maxHeight: 68, objectFit: 'contain' }}
          />
        </Box>
        <Box sx={{ p: 1.6, display: 'grid', placeItems: 'center', textAlign: 'center', borderRight: { md: '1px solid #cbd5e1' } }}><Typography sx={{ color: '#0b3a6f', fontWeight: 950, fontSize: { xs: 18, md: 21 }, lineHeight: 1.15 }}>LEGALIZACIÓN DE VIÁTICOS</Typography></Box>
        <Box sx={{ p: 1.4, bgcolor: '#f8fafc', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><Typography variant="caption" display="block" fontWeight={900}>CÓDIGO: ADF-PP-FR-005</Typography><Typography variant="caption" display="block"><strong>VERSIÓN:</strong> 5</Typography><Typography variant="caption" display="block"><strong>FECHA:</strong> 11/FEB/2025</Typography><Typography variant="caption" display="block"><strong>ESTADO:</strong> {legalizacion?.estado || 'Pendiente'}</Typography></Box>
      </Box>

      <Box sx={{ p: { xs: 1.7, md: 2.5 } }}>
        {demo && <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>Formato demostrativo. Puede probar la edición de valores, pero los cambios no se guardan ni generan actuaciones reales.</Alert>}
        <Paper elevation={0} sx={{ mb: 2.2, p: { xs: 1.5, md: 2 }, borderRadius: 3, border: '1px solid #dbe5f1', bgcolor: '#f8fbff' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1.5 }}>
            <Box><Typography sx={{ color: '#0b3a6f', fontWeight: 950, fontSize: 17 }}>Datos de la comisión</Typography><Typography variant="body2" color="text.secondary">Información precargada desde la solicitud de desplazamiento aprobada.</Typography></Box>
            <Chip label={solicitud?.consecutivo || 'Sin consecutivo'} size="small" sx={{ bgcolor: '#e0ecff', color: '#1d4ed8', fontWeight: 900 }} />
          </Stack>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 1 }}>
            {summaryFields.map((field) => <Box key={field.label} sx={{ gridColumn: { xs: 'span 1', sm: field.span === 2 ? 'span 2' : 'span 1', lg: `span ${field.span}` }, minWidth: 0, minHeight: 68, p: 1.25, borderRadius: 2, border: '1px solid #dbe5f1', bgcolor: '#fff', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}><Typography sx={{ color: '#64748b', fontSize: 10.5, fontWeight: 900, letterSpacing: .35, textTransform: 'uppercase' }}>{field.label}</Typography><Typography sx={{ mt: .45, color: '#172033', fontSize: 13.5, lineHeight: 1.35, fontWeight: 800, overflowWrap: 'anywhere' }}>{field.value || 'Sin registrar'}</Typography></Box>)}
          </Box>
          <Box sx={{ mt: 1.2, display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2,minmax(0,1fr))' }, gap: 1 }}>
            <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid #dbe5f1', bgcolor: '#fff' }}><Typography sx={{ mb: .8, color: '#64748b', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase' }}>Alojamiento seleccionado</Typography><Stack direction="row" flexWrap="wrap" gap={.7}>{lodging ? <Chip size="small" label={lodging} color="primary" sx={{ fontWeight: 850 }} /> : <Typography variant="body2" color="text.secondary">Sin registrar</Typography>}</Stack></Box>
            <Box sx={{ p: 1.25, borderRadius: 2, border: '1px solid #dbe5f1', bgcolor: '#fff' }}><Typography sx={{ mb: .8, color: '#64748b', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase' }}>Transporte seleccionado</Typography><Stack direction="row" flexWrap="wrap" gap={.7}>{transport ? (transport === 'Mixto' ? ['Terrestre', 'Aéreo'] : [transport]).map((option) => <Chip key={option} size="small" label={option} color="secondary" sx={{ fontWeight: 850 }} />) : <Typography variant="body2" color="text.secondary">Sin registrar</Typography>}</Stack></Box>
          </Box>
        </Paper>

        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', sm: 'center' }} gap={1} sx={{ mb: 1.2 }}>
          <Box><Typography sx={{ color: '#0b3a6f', fontWeight: 950, fontSize: 17 }}>Detalle de la legalización</Typography><Typography variant="body2" color="text.secondary">Revise el valor ejecutado y el soporte correspondiente a cada concepto autorizado.</Typography></Box>
          <Stack direction="row" gap={.7} flexWrap="wrap">
            <Chip icon={<AttachFileRoundedIcon />} label={`${attachments.length} soporte(s)`} variant="outlined" sx={{ color: '#172033', borderColor: '#94a3b8', fontWeight: 850, '& .MuiChip-icon': { color: '#172033' } }} />
            <Chip icon={editable ? <EditRoundedIcon /> : <LockRoundedIcon />} label={editable ? 'Edición habilitada' : 'Solo lectura'} variant="outlined" sx={{ color: '#172033', borderColor: '#94a3b8', fontWeight: 850, '& .MuiChip-icon': { color: '#172033' } }} />
          </Stack>
        </Stack>

        <Stack sx={{ border: '1px solid #94a3b8', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
          <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '1.3fr .65fr .75fr .65fr 1.3fr', bgcolor: '#f8fafc', color: '#172033', borderBottom: '1px solid #94a3b8' }}>{['Concepto', 'Anticipo', 'Legalizado', 'Diferencia', 'Soporte'].map((label, index) => <Box key={label} sx={{ px: 1.5, py: 1.15, borderRight: index < 4 ? '1px solid #cbd5e1' : 0 }}><Typography variant="caption" fontWeight={900}>{label.toUpperCase()}</Typography>{label === 'Legalizado' && editable && <EditRoundedIcon sx={{ ml: .6, fontSize: 14, verticalAlign: 'middle' }} />}</Box>)}</Box>
          {details.map((item) => {
            const legalized = Number(values[item.id] ?? item.valorLegalizado ?? 0);
            const difference = Number(item.valorAnticipo || 0) - legalized;
            const support = attachments.find((file) => file.conceptoId === item.id);
            const cellSx = { p: 1.4, minWidth: 0, height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: { md: '1px solid #cbd5e1' } };
            return <Box key={item.id} sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.3fr .65fr .75fr .65fr 1.3fr' }, alignItems: 'stretch', bgcolor: '#fff', borderBottom: '1px solid #cbd5e1', '&:last-child': { borderBottom: 0 } }}>
              <Box sx={cellSx}><Typography fontWeight={850}>{item.detalle}</Typography><Typography sx={{ display: { md: 'none' } }} variant="caption" color="text.secondary">Concepto autorizado</Typography></Box>
              <Box sx={cellSx}><Typography sx={{ display: { md: 'none' } }} variant="caption" color="text.secondary">Anticipo</Typography><Typography fontWeight={800} color="#172033">{currency(item.valorAnticipo)}</Typography></Box>
              <Box sx={cellSx}><TextField label={editable ? 'Valor legalizado' : undefined} type="number" size="small" disabled={!editable} value={values[item.id] ?? item.valorLegalizado ?? ''} onChange={(event) => onValueChange?.(item.id, event.target.value)} inputProps={{ min: 0, step: 1 }} /></Box>
              <Box sx={cellSx}><Typography sx={{ display: { md: 'none' } }} variant="caption" color="text.secondary">Diferencia</Typography><Typography fontWeight={900} color="#172033">{currency(difference)}</Typography></Box>
              <Box sx={{ ...cellSx, borderRight: 0 }}>{collaboratorMode ? <Stack spacing={.4}><FormControlLabel sx={{ m: 0 }} control={<Checkbox checked={Boolean(selectedConcepts[item.id])} onChange={(event) => onConceptToggle?.(item.id, event.target.checked)} disabled={!editable} />} label="Incluir soporte (opcional)" /><Button component="label" variant={files[item.id] ? 'contained' : 'outlined'} startIcon={<UploadFileRoundedIcon />} disabled={!editable || !selectedConcepts[item.id]} sx={{ textTransform: 'none', justifyContent: 'flex-start' }}>{files[item.id]?.name || 'Adjuntar soporte'}<input hidden type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => onFileChange?.(item.id, event.target.files?.[0])} /></Button></Stack> : <Button variant="outlined" disabled={!support} startIcon={<AttachFileRoundedIcon />} onClick={() => support && onOpenSupport?.(support)} sx={{ color: '#172033', borderColor: '#94a3b8', textTransform: 'none', justifyContent: 'flex-start', overflow: 'hidden', '&:hover': { borderColor: '#172033', bgcolor: '#f8fafc' } }}>{support?.originalName || 'Sin soporte adjunto'}</Button>}</Box>
            </Box>;
          })}
          {details.length === 0 && <Alert severity="warning" sx={{ m: 1.5 }}>No hay conceptos registrados en esta legalización.</Alert>}
        </Stack>

        <Box sx={{ mt: 1.5, border: '1px solid #94a3b8', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff', display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,1fr)', lg: 'repeat(4,1fr)' } }}>{[
          ['Total anticipo', totals.advance],
          ['Total legalizado', totals.legalized],
          ['Saldo a favor de UNICESMAG', totals.universityBalance],
          ['Saldo a favor del empleado', totals.employeeBalance]
        ].map(([label, amount], index) => <Box key={label} sx={{ p: 1.5, borderRight: { lg: index < 3 ? '1px solid #cbd5e1' : 0 }, borderBottom: { xs: index < 3 ? '1px solid #cbd5e1' : 0, sm: index < 2 ? '1px solid #cbd5e1' : 0, lg: 0 } }}><Typography sx={{ color: '#475569', fontSize: 10.5, fontWeight: 900, textTransform: 'uppercase' }}>{label}</Typography><Typography sx={{ mt: .3, color: '#172033', fontWeight: 900 }}>{currency(amount)}</Typography></Box>)}</Box>
        <TextField fullWidth multiline minRows={3} label={collaboratorMode ? 'Observaciones de la legalización' : 'Observaciones de la revisión del Técnico Contable'} sx={{ mt: 2 }} disabled={!editable} value={observations} onChange={(event) => onObservationsChange?.(event.target.value)} />
      </Box>
    </Paper>
  );
}
