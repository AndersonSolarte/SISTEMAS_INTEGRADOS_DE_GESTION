import React, { useEffect, useState, useMemo } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  InputAdornment,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import VisibilityIcon from '@mui/icons-material/Visibility';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import { useSnackbar } from 'notistack';
import { getMisLegalizaciones, presentarLegalizacion } from '../services/legalizacionViaticosService';
import LegalizacionViaticosFormat from '../components/viaticos/LegalizacionViaticosFormat';

const labels = {
  pendiente_habilitacion: 'Pendiente de fecha de regreso',
  pendiente_legalizacion: 'Habilitada para legalizar',
  legalizacion_vencida: 'Legalización vencida',
  en_revision: 'En revisión del Técnico Contable',
  finalizada: 'Legalización finalizada'
};

const stateConfigs = {
  pendiente_habilitacion: { color: 'warning', bg: '#fff7ed', border: '#fdba74', icon: HourglassEmptyIcon, label: 'En viaje / Pendiente regreso' },
  pendiente_legalizacion: { color: 'primary', bg: '#eff6ff', border: '#93c5fd', icon: EventAvailableIcon, label: 'Habilitada para legalizar' },
  legalizacion_vencida: { color: 'error', bg: '#fef2f2', border: '#fca5a5', icon: WarningAmberIcon, label: 'Legalización vencida' },
  en_revision: { color: 'secondary', bg: '#faf5ff', border: '#d8b4fe', icon: HourglassEmptyIcon, label: 'En revisión' },
  finalizada: { color: 'success', bg: '#f0fdf4', border: '#86efac', icon: CheckCircleOutlineIcon, label: 'Finalizada' }
};

const formatCop = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

export default function LegalizacionViaticos() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [selectedRow, setSelectedRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('PENDING');

  // Form states when viewing a single legalización
  const [values, setValues] = useState({});
  const [files, setFiles] = useState({});
  const [selectedConcepts, setSelectedConcepts] = useState({});
  const [observaciones, setObservaciones] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getMisLegalizaciones();
      const list = result.data || [];
      setRows(list);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible cargar las legalizaciones.', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Filtered rows for the list table
  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      const sol = row.solicitud || {};
      const leg = row.legalizacion || {};
      const search = searchTerm.toLowerCase().trim();
      const matchSearch = !search ||
        (sol.consecutivo || '').toLowerCase().includes(search) ||
        (sol.datos_viaticos?.lugarVisitar || sol.datos_salida?.municipio || '').toLowerCase().includes(search);
      let matchState = true;
      if (filterState === 'PENDING') {
        matchState = leg.estado !== 'finalizada';
      } else if (filterState !== 'ALL') {
        matchState = leg.estado === filterState;
      }
      return matchSearch && matchState;
    });
  }, [rows, searchTerm, filterState]);

  // Statistics counts
  const stats = useMemo(() => {
    const total = rows.length;
    const pendientes = rows.filter((r) => ['pendiente_legalizacion', 'legalizacion_vencida', 'pendiente_habilitacion'].includes(r.legalizacion?.estado)).length;
    const enRevision = rows.filter((r) => r.legalizacion?.estado === 'en_revision').length;
    const finalizadas = rows.filter((r) => r.legalizacion?.estado === 'finalizada').length;
    return { total, pendientes, enRevision, finalizadas };
  }, [rows]);

  const handleOpenRow = (row) => {
    setSelectedRow(row);
    setValues({});
    setFiles({});
    setSelectedConcepts({});
    setObservaciones(row.legalizacion?.observaciones || '');
  };

  const handleBackToList = () => {
    setSelectedRow(null);
  };

  const submit = async () => {
    if (!selectedRow) return;
    const details = selectedRow.legalizacion.detalles || [];
    const missingValue = details.find((item) => values[item.id] === undefined || values[item.id] === '');
    if (missingValue) {
      return enqueueSnackbar(`Ingrese el valor legalizado de ${missingValue.detalle}.`, { variant: 'warning' });
    }
    const selectedWithoutFile = details.find((item) => selectedConcepts[item.id] && !files[item.id]);
    if (selectedWithoutFile) {
      return enqueueSnackbar(`Seleccione el archivo de soporte de ${selectedWithoutFile.detalle} o desmarque "Incluir soporte".`, { variant: 'warning' });
    }
    const form = new FormData();
    form.append('detalles', JSON.stringify(details.map((item) => ({ id: item.id, valorLegalizado: Number(values[item.id]) }))));
    form.append('observaciones', observaciones);
    details.forEach((item) => {
      if (selectedConcepts[item.id] && files[item.id]) form.append(`soporte_${item.id}`, files[item.id]);
    });

    setSending(true);
    try {
      const result = await presentarLegalizacion(selectedRow.legalizacion.id, form);
      enqueueSnackbar(result.message || 'Legalización enviada con éxito.', { variant: 'success' });
      setSelectedRow(null);
      await load();
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'No fue posible presentar la legalización.', { variant: 'error' });
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: 380, display: 'grid', placeItems: 'center' }}>
        <CircularProgress size={44} />
      </Box>
    );
  }

  // -------------------------------------------------------------
  // VIEW MODE: Single Legalización Form
  // -------------------------------------------------------------
  if (selectedRow) {
    const active = selectedRow;
    const editable = ['pendiente_legalizacion', 'legalizacion_vencida', 'pendiente_habilitacion'].includes(active.legalizacion.estado);
    const cfg = stateConfigs[active.legalizacion.estado] || {};

    return (
      <Box sx={{ maxWidth: 1140, mx: 'auto' }}>
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 2.5 }}>
          <Button
            startIcon={<ArrowBackIcon />}
            onClick={handleBackToList}
            variant="outlined"
            sx={{ borderRadius: '10px', textTransform: 'none', fontWeight: 700, borderColor: '#cbd5e1', color: '#0b3a6f' }}
          >
            Volver a mis legalizaciones
          </Button>
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0b3a6f' }}>
              Legalización {active.solicitud.consecutivo}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Lugar: {active.solicitud.datos_viaticos?.lugarVisitar || active.solicitud.datos_salida?.municipio || 'No registrado'}
            </Typography>
          </Box>
          <Chip
            color={cfg.color || 'primary'}
            label={labels[active.legalizacion.estado] || active.legalizacion.estado}
            sx={{ fontWeight: 800, fontSize: 13, py: 0.5 }}
          />
        </Stack>

        {active.legalizacion.estado === 'legalizacion_vencida' && (
          <Alert severity="error" sx={{ mb: 2.5, borderRadius: '8px', border: '1px solid #fca5a5' }}>
            <strong>Plazo vencido:</strong> El plazo de tres (3) días hábiles siguientes al regreso venció. La obligación continúa pendiente y debe ser legalizada a la brevedad conforme al Acuerdo 001 de 2013.
          </Alert>
        )}
        {active.legalizacion.estado === 'pendiente_habilitacion' && (
          <Alert severity="info" sx={{ mb: 2.5, borderRadius: '8px', border: '1px solid #93c5fd' }}>
            <strong>Desplazamiento en curso:</strong> El formulario de legalización se habilitará en la fecha de regreso ({active.legalizacion.fecha_habilitacion}).
          </Alert>
        )}
        {active.legalizacion.estado === 'en_revision' && (
          <Alert severity="warning" sx={{ mb: 2.5, borderRadius: '8px', border: '1px solid #fdba74' }}>
            <strong>En revisión:</strong> Esta legalización se encuentra en revisión por parte del Técnico Contable.
          </Alert>
        )}
        {active.legalizacion.estado === 'finalizada' && (
          <Alert severity="success" sx={{ mb: 2.5, borderRadius: '8px', border: '1px solid #86efac' }}>
            <strong>Legalización finalizada:</strong> La legalización fue aprobada y cerrada formalmente en el sistema.
          </Alert>
        )}

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

        {editable && (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Button
              onClick={submit}
              disabled={sending}
              variant="contained"
              size="large"
              startIcon={sending ? <CircularProgress size={20} color="inherit" /> : <ReceiptLongRoundedIcon />}
              sx={{
                py: 1.5,
                px: 4,
                borderRadius: '10px',
                textTransform: 'none',
                fontWeight: 850,
                fontSize: 15,
                background: 'linear-gradient(135deg,#0b3a6f,#1e40af)',
                boxShadow: '0 4px 14px rgba(11,58,111,0.35)',
                '&:hover': { background: 'linear-gradient(135deg,#1e40af,#1d4ed8)' }
              }}
            >
              Enviar legalización al Técnico Contable
            </Button>
          </Box>
        )}
      </Box>
    );
  }

  // -------------------------------------------------------------
  // DASHBOARD LIST MODE: Table of Legalizaciones
  // -------------------------------------------------------------
  return (
    <Box sx={{ maxWidth: 1140, mx: 'auto' }}>
      {/* Header section */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} gap={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 900, color: '#0b3a6f', letterSpacing: '-0.5px' }}>
            Legalización de viáticos
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Consulte y gestione la legalización de sus anticipos de viáticos y gastos de viaje.
          </Typography>
        </Box>
      </Stack>

      {/* KPI Cards Summary */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#64748b', textTransform: 'uppercase' }}>Total Legalizaciones</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#0b3a6f', mt: 0.5 }}>{stats.total}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '12px', border: '1.5px solid #93c5fd', bgcolor: '#eff6ff', boxShadow: '0 2px 8px rgba(37,99,235,0.06)' }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#1e40af', textTransform: 'uppercase' }}>Por Legalizar / En Viaje</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#1d4ed8', mt: 0.5 }}>{stats.pendientes}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '12px', border: '1.5px solid #d8b4fe', bgcolor: '#faf5ff', boxShadow: '0 2px 8px rgba(147,51,234,0.06)' }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#6b21a8', textTransform: 'uppercase' }}>En Revisión</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#7e22ce', mt: 0.5 }}>{stats.enRevision}</Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ borderRadius: '12px', border: '1.5px solid #86efac', bgcolor: '#f0fdf4', boxShadow: '0 2px 8px rgba(22,101,52,0.06)' }}>
            <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="caption" sx={{ fontWeight: 800, color: '#166534', textTransform: 'uppercase' }}>Finalizadas</Typography>
              <Typography variant="h4" sx={{ fontWeight: 900, color: '#15803d', mt: 0.5 }}>{stats.finalizadas}</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Filters and Search Bar */}
      <Paper sx={{ p: 2, mb: 3, borderRadius: '12px', border: '1px solid #cbd5e1', boxShadow: '0 2px 10px rgba(0,0,0,0.03)' }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Buscar por consecutivo o lugar de destino..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon sx={{ color: '#64748b' }} />
                  </InputAdornment>
                )
              }}
              sx={{ '& .MuiOutlinedInput-root': { borderRadius: '8px' } }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Stack direction="row" spacing={1} justifyContent={{ xs: 'flex-start', md: 'flex-end' }} flexWrap="wrap" gap={0.5}>
              <Chip
                label="Todas"
                onClick={() => setFilterState('ALL')}
                color={filterState === 'ALL' ? 'primary' : 'default'}
                variant={filterState === 'ALL' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label="Habilitadas"
                onClick={() => setFilterState('pendiente_legalizacion')}
                color={filterState === 'pendiente_legalizacion' ? 'primary' : 'default'}
                variant={filterState === 'pendiente_legalizacion' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label="En revisión"
                onClick={() => setFilterState('en_revision')}
                color={filterState === 'en_revision' ? 'secondary' : 'default'}
                variant={filterState === 'en_revision' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700 }}
              />
              <Chip
                label="Finalizadas"
                onClick={() => setFilterState('finalizada')}
                color={filterState === 'finalizada' ? 'success' : 'default'}
                variant={filterState === 'finalizada' ? 'filled' : 'outlined'}
                sx={{ fontWeight: 700 }}
              />
            </Stack>
          </Grid>
        </Grid>
      </Paper>

      {/* Main Table */}
      {filteredRows.length === 0 ? (
        <Alert severity="info" sx={{ borderRadius: '10px' }}>
          {rows.length === 0
            ? 'No tiene solicitudes de desplazamiento pendientes o legalizadas.'
            : 'No se encontraron legalizaciones con el criterio de búsqueda.'}
        </Alert>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: '12px', border: '1.5px solid #0b3a6f', boxShadow: '0 4px 16px rgba(11,58,111,0.08)', overflow: 'hidden' }}>
          <Table sx={{ minWidth: 700 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: '#0b3a6f' }}>
                <TableCell sx={{ color: '#ffffff', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', py: 1.5 }}>Consecutivo</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', py: 1.5 }}>Destino / Lugar</TableCell>
                <TableCell sx={{ color: '#ffffff', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', py: 1.5 }}>Fechas del Viaje</TableCell>
                <TableCell align="right" sx={{ color: '#ffffff', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', py: 1.5 }}>Total Anticipo</TableCell>
                <TableCell align="center" sx={{ color: '#ffffff', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', py: 1.5 }}>Estado</TableCell>
                <TableCell align="center" sx={{ color: '#ffffff', fontWeight: 800, fontSize: 12.5, textTransform: 'uppercase', py: 1.5 }}>Acción</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredRows.map((row) => {
                const sol = row.solicitud || {};
                const leg = row.legalizacion || {};
                const editable = ['pendiente_legalizacion', 'legalizacion_vencida', 'pendiente_habilitacion'].includes(leg.estado);
                const cfg = stateConfigs[leg.estado] || {};
                const total = Number(sol.liquidacion?.totalAnticipo) || (leg.detalles || []).reduce((s, i) => s + Number(i.valorAnticipo || 0), 0);

                return (
                  <TableRow
                    key={leg.id || sol.id}
                    hover
                    sx={{
                      '&:hover': { bgcolor: '#f8fafc' },
                      transition: 'background-color 0.2s'
                    }}
                  >
                    <TableCell sx={{ fontWeight: 800, color: '#0b3a6f', fontSize: 13 }}>
                      {sol.consecutivo || `REG-${leg.id}`}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 700, color: '#1e293b', fontSize: 13 }}>
                      {sol.datos_viaticos?.lugarVisitar || sol.datos_salida?.municipio || 'No registrado'}
                    </TableCell>
                    <TableCell sx={{ fontSize: 12.5, color: '#334155' }}>
                      <Box sx={{ fontWeight: 700, color: '#0f172a' }}>{sol.datos_salida?.fecha || ''}</Box>
                      <Box sx={{ fontSize: 11, color: '#64748b' }}>hasta {sol.datos_salida?.fechaRegreso || ''}</Box>
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: 900, color: '#0b3a6f', fontSize: 13.5 }}>
                      {formatCop(total)}
                    </TableCell>
                    <TableCell align="center">
                      <Chip
                        color={cfg.color || 'default'}
                        label={labels[leg.estado] || leg.estado}
                        size="small"
                        sx={{ fontWeight: 800, fontSize: 11.5 }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      {editable ? (
                        <Button
                          variant="contained"
                          size="small"
                          startIcon={<ReceiptLongRoundedIcon />}
                          onClick={() => handleOpenRow(row)}
                          sx={{
                            borderRadius: '8px',
                            textTransform: 'none',
                            fontWeight: 800,
                            fontSize: 12,
                            px: 2,
                            background: leg.estado === 'legalizacion_vencida'
                              ? 'linear-gradient(135deg,#dc2626,#b91c1c)'
                              : 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                            boxShadow: '0 2px 8px rgba(37,99,235,0.25)'
                          }}
                        >
                          Legalizar
                        </Button>
                      ) : (
                        <Tooltip title="Ver detalle de la legalización">
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<VisibilityIcon />}
                            onClick={() => handleOpenRow(row)}
                            sx={{
                              borderRadius: '8px',
                              textTransform: 'none',
                              fontWeight: 700,
                              fontSize: 12,
                              borderColor: '#cbd5e1',
                              color: '#0b3a6f'
                            }}
                          >
                            Ver detalle
                          </Button>
                        </Tooltip>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
