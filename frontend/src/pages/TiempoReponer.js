import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Button,
  Stack,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api from '../services/api';


function TabPanel(props) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const formatDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};



const getHorasPendientes = (row) => {
  if (!row) return '0 hrs';
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  return pendientes > 0 ? (pendientes / 60).toFixed(1) + ' hrs' : '0 hrs';
};

const getJefeObservacion = (row) => {
  if (!row || !Array.isArray(row.trazabilidad)) return null;
  const trace = row.trazabilidad.find(t => 
    (t.event === 'no_aprobada' || t.event === 'aprobada_jefe') && 
    (t.detail?.justificacion || t.detail?.observacion)
  );
  return trace?.detail?.justificacion || trace?.detail?.observacion || null;
};

const formatElapsed = (minutes) => {
  if (!minutes) return '0h';
  const hrs = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
};

export default function TiempoReponer() {
  const [tabIndex, setTabIndex] = useState(0);
  const [misReposiciones, setMisReposiciones] = useState([]);
  const [equipoReposiciones, setEquipoReposiciones] = useState([]);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedRep, setSelectedRep] = useState(null);
  const [updateEstado, setUpdateEstado] = useState('programada');
  const [updateObservacion, setUpdateObservacion] = useState('');
  const [updateHorasAbonadas, setUpdateHorasAbonadas] = useState('');

  const fetchMisReposiciones = async () => {
    try {
      const res = await api.get('/reporte-salida/reposiciones/mis-reposiciones');
      if (res.data.success) setMisReposiciones(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchEquipoReposiciones = async () => {
    try {
      const res = await api.get('/reporte-salida/reposiciones/equipo');
      if (res.data.success) setEquipoReposiciones(res.data.data);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchMisReposiciones(), fetchEquipoReposiciones()]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedRep) return;
    const totalMinutos = selectedRep.reposicion_minutos || selectedRep.tiempo_solicitado_minutos || 0;
    const minutosPagados = selectedRep.datos_formulario?.reposicion_minutos_pagados || 0;
    const minutosPendientes = totalMinutos - minutosPagados;
    const minutosAbonar = Math.round((parseFloat(updateHorasAbonadas) || 0) * 60);
    if (minutosPendientes - minutosAbonar <= 0) {
      setUpdateEstado('cumplida');
    } else {
      setUpdateEstado('pendiente');
    }
  }, [updateHorasAbonadas, selectedRep]);

  const handleUpdateClick = (rep) => {
    setSelectedRep(rep);
    setUpdateEstado(rep.reposicion_estado === 'cumplida' ? 'cumplida' : 'pendiente');
    setUpdateObservacion('');
    setUpdateHorasAbonadas('');
    setOpenDialog(true);
  };

  const handleSaveUpdate = async () => {
    if (!selectedRep) return;
    if (!updateHorasAbonadas || Number(updateHorasAbonadas) <= 0) {
      enqueueSnackbar('La cantidad de horas a abonar debe ser mayor que cero.', { variant: 'error' });
      return;
    }
    const totalMinutos = selectedRep.reposicion_minutos || selectedRep.tiempo_solicitado_minutos || 0;
    const minutosPagados = selectedRep.reposicion_minutos_pagados || selectedRep.datos_formulario?.reposicion_minutos_pagados || 0;
    const minutosPendientes = totalMinutos - minutosPagados;
    if (Number(updateHorasAbonadas) > (minutosPendientes / 60)) {
      enqueueSnackbar('La cantidad de horas a abonar no puede exceder el tiempo pendiente.', { variant: 'error' });
      return;
    }
    const minutosAbonar = Math.round(Number(updateHorasAbonadas) * 60);
    if (minutosPendientes - minutosAbonar <= 0 && updateEstado === 'pendiente') {
      enqueueSnackbar('No se puede guardar como "Pendiente" si se ha repuesto la totalidad de las horas.', { variant: 'error' });
      return;
    }

    try {
      const res = await api.patch(`/reporte-salida/solicitudes/${selectedRep.id}/reposicion`, {
        estado: updateEstado,
        observacion: updateObservacion,
        horasAbonadas: updateHorasAbonadas
      });
      if (res.data.success) {
        enqueueSnackbar('Reposición actualizada', { variant: 'success' });
        setOpenDialog(false);
        fetchEquipoReposiciones();
        fetchMisReposiciones();
      }
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al actualizar', { variant: 'error' });
    }
  };

  const renderTable = (data, isEquipo = false) => (
    <TableContainer component={Paper} elevation={0} variant="outlined">
      <Table size="small">
        <TableHead sx={{ bgcolor: '#f1f5f9' }}>
          <TableRow>
            <TableCell><strong>Consecutivo</strong></TableCell>
            {isEquipo && <TableCell><strong>Colaborador(a)</strong></TableCell>}
            <TableCell><strong>Fecha de Salida</strong></TableCell>
            <TableCell><strong>Reposición</strong></TableCell>
            <TableCell><strong>Observaciones</strong></TableCell>
            {isEquipo && <TableCell><strong>Acción</strong></TableCell>}
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 ? (
            <TableRow>
              <TableCell colSpan={isEquipo ? 6 : 4} align="center" sx={{ py: 3 }}>
                <Typography variant="body2" color="text.secondary">No hay reposiciones registradas.</Typography>
              </TableCell>
            </TableRow>
          ) : (
            data.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.consecutivo}</TableCell>
                {isEquipo && <TableCell>{row.datos_formulario?.personal?.nombre || row.solicitante_snapshot?.nombre}</TableCell>}
                <TableCell>{formatDate(row.datos_formulario?.salida?.fecha)}</TableCell>
                <TableCell sx={{ minWidth: 155 }}>
                  <Stack spacing={0.6}>
                    <Chip
                      size="small"
                      label={row.reposicion_estado === 'cumplida' ? 'Cumplida' : 'Pendiente'}
                      sx={{
                        bgcolor: row.reposicion_estado === 'cumplida' ? '#d1fae5' : '#fef3c7',
                        color: row.reposicion_estado === 'cumplida' ? '#065f46' : '#92400e',
                        fontWeight: 800,
                        width: 'fit-content'
                      }}
                    />
                    <Box sx={{ fontSize: 11, lineHeight: 1.4, color: '#334155' }}>
                      <div><strong>Total:</strong> {formatElapsed(row.reposicion_minutos || row.tiempo_solicitado_minutos || 0)}</div>
                      <div><strong>Abonado:</strong> {formatElapsed(row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0)}</div>
                      <div><strong>Pendiente:</strong> {(() => {
                        const total = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
                        const pagado = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
                        return formatElapsed(Math.max(0, total - pagado));
                      })()}</div>
                    </Box>
                  </Stack>
                </TableCell>
                <TableCell sx={{ minWidth: 200, maxWidth: 300 }}>
                  {(() => {
                    const jefeObs = getJefeObservacion(row);
                    const ghObs = row.observacion_gestion_humana || '';
                    return (
                      <Stack spacing={0.8}>
                        {jefeObs && (
                          <Box>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#475569', display: 'inline-block', mr: 0.5 }}>Jefe:</Typography>
                            <Typography sx={{ fontSize: 10.5, color: '#64748b', fontStyle: 'italic', display: 'inline' }}>"{jefeObs}"</Typography>
                          </Box>
                        )}
                        {ghObs ? (
                          <Box>
                            <Typography sx={{ fontSize: 10.5, fontWeight: 700, color: '#0f766e', mb: 0.3 }}>Talento Humano:</Typography>
                            <Box sx={{ fontSize: 10.5, color: '#334155', maxHeight: 80, overflowY: 'auto', bgcolor: '#f8fafc', p: 0.5, borderRadius: 1, border: '1px solid #e2e8f0' }}>
                              {ghObs.split('\n').map((line, idx) => (
                                <Typography key={idx} sx={{ fontSize: 10, lineHeight: 1.3, borderBottom: idx < ghObs.split('\n').length - 1 ? '1px dashed #e2e8f0' : 'none', pb: 0.3, mb: 0.3 }}>
                                  {line}
                                </Typography>
                              ))}
                            </Box>
                          </Box>
                        ) : (
                          !jefeObs && <Typography sx={{ fontSize: 10.5, color: '#94a3b8', fontStyle: 'italic' }}>Sin observaciones</Typography>
                        )}
                      </Stack>
                    );
                  })()}
                </TableCell>
                {isEquipo && (
                  <TableCell>
                    {row.estado === 'finalizada' ? (
                      <Button size="small" variant="outlined" onClick={() => handleUpdateClick(row)}>Gestionar</Button>
                    ) : (
                      <Typography variant="caption" color="text.secondary">En proceso</Typography>
                    )}
                  </TableCell>
                )}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Typography variant="h5" sx={{ mb: 3, fontWeight: 700, color: '#0f172a' }}>
        Tiempo por Reponer
      </Typography>

      <Paper sx={{ mb: 3, borderRadius: 2 }}>
        {misReposiciones.length > 0 && equipoReposiciones.length === 0 && (
          <Box sx={{ p: 3 }}>
            {renderTable(misReposiciones, false)}
          </Box>
        )}
        {equipoReposiciones.length > 0 && misReposiciones.length === 0 && (
          <Box sx={{ p: 3 }}>
            {renderTable(equipoReposiciones, true)}
          </Box>
        )}
        {misReposiciones.length > 0 && equipoReposiciones.length > 0 && (
          <>
            <Tabs
              value={tabIndex}
              onChange={(e, val) => setTabIndex(val)}
              indicatorColor="primary"
              textColor="primary"
              sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
              <Tab label="Mis Reposiciones" />
              <Tab label="Equipo / Gestión" />
            </Tabs>
            <TabPanel value={tabIndex} index={0}>
              {renderTable(misReposiciones, false)}
            </TabPanel>
            <TabPanel value={tabIndex} index={1}>
              {renderTable(equipoReposiciones, true)}
            </TabPanel>
          </>
        )}
        {misReposiciones.length === 0 && equipoReposiciones.length === 0 && (
          <Box sx={{ p: 3 }}>
             <Typography variant="body2" color="text.secondary" align="center">No hay reposiciones registradas.</Typography>
          </Box>
        )}
      </Paper>

      {/* Dialogo de Actualizacion */}
      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Gestionar Reposición</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2">Consecutivo: {selectedRep?.consecutivo}</Typography>
            <Typography variant="body2">Colaborador(a): {selectedRep?.datos_formulario?.personal?.nombre || selectedRep?.solicitante_snapshot?.nombre}</Typography>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>Saldo pendiente: {getHorasPendientes(selectedRep)}</Typography>
          </Box>

          <TextField
            label="Horas a abonar (Repuestas hoy)"
            type="number"
            value={updateHorasAbonadas}
            onChange={(e) => setUpdateHorasAbonadas(e.target.value.replace(/[^0-9]/g, ''))}
            fullWidth
            margin="normal"
            size="small"
            inputProps={{ min: 0, step: 1 }}
            helperText="Ingrese las horas repuestas como número entero (ej: 2). El saldo se descontará automáticamente."
          />

          <TextField
            select
            label="Estado de Reposición"
            value={updateEstado}
            onChange={(e) => setUpdateEstado(e.target.value)}
            fullWidth
            margin="normal"
            size="small"
          >
            <MenuItem value="pendiente">Pendiente</MenuItem>
            <MenuItem value="cumplida">Cumplida</MenuItem>
          </TextField>

          <TextField
            label="Observación (opcional)"
            value={updateObservacion}
            onChange={(e) => setUpdateObservacion(e.target.value)}
            fullWidth
            margin="normal"
            size="small"
            multiline
            rows={3}
          />

          {(() => {
            const jefeObs = getJefeObservacion(selectedRep);
            const ghObs = selectedRep?.observacion_gestion_humana;
            if (!jefeObs && !ghObs) return null;
            return (
              <Box sx={{ mt: 2, p: 1.5, bgcolor: '#f8fafc', borderRadius: 2, border: '1px solid #e2e8f0' }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1, fontSize: 12, color: '#475569' }}>
                  Historial de observaciones registradas:
                </Typography>
                {jefeObs && (
                  <Box sx={{ mb: 1.5 }}>
                    <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: '#64748b' }}>Jefe Inmediato:</Typography>
                    <Typography sx={{ fontSize: 11.5, color: '#475569', fontStyle: 'italic' }}>"{jefeObs}"</Typography>
                  </Box>
                )}
                {ghObs && (
                  <Box>
                    <Typography sx={{ fontSize: 11, fontWeight: 'bold', color: '#0f766e', mb: 0.5 }}>Talento Humano:</Typography>
                    {ghObs.split('\n').map((line, idx) => (
                      <Typography key={idx} sx={{ fontSize: 11, color: '#334155', lineHeight: 1.4, mb: 0.8, borderBottom: idx < ghObs.split('\n').length - 1 ? '1px dashed #e2e8f0' : 'none', pb: 0.5 }}>
                        {line}
                      </Typography>
                    ))}
                  </Box>
                )}
              </Box>
            );
          })()}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveUpdate}
            disabled={(() => {
              if (!selectedRep) return true;
              const totalMinutos = selectedRep.reposicion_minutos || selectedRep.tiempo_solicitado_minutos || 0;
              const minutosPagados = selectedRep.reposicion_minutos_pagados || selectedRep.datos_formulario?.reposicion_minutos_pagados || 0;
              const minutosPendientes = totalMinutos - minutosPagados;
              if (minutosPendientes <= 0) return true;
              if (!updateHorasAbonadas || Number(updateHorasAbonadas) <= 0) return true;
              if (Number(updateHorasAbonadas) > (minutosPendientes / 60)) return true;
              if (minutosPendientes - (Number(updateHorasAbonadas) * 60) <= 0 && updateEstado === 'pendiente') return true;
              return false;
            })()}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
