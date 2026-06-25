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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem
} from '@mui/material';
import { useSnackbar } from 'notistack';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

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

const estadoColors = {
  pendiente: 'warning',
  programada: 'info',
  cumplida: 'success',
  incumplida: 'error'
};

const estadoLabels = {
  pendiente: 'Pendiente',
  programada: 'Programada',
  cumplida: 'Cumplida',
  incumplida: 'Incumplida'
};

const getHorasPendientes = (row) => {
  if (!row) return '0 hrs';
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  return pendientes > 0 ? (pendientes / 60).toFixed(1) + ' hrs' : '0 hrs';
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

  const handleUpdateClick = (rep) => {
    setSelectedRep(rep);
    setUpdateEstado(rep.reposicion_estado !== 'no_aplica' ? rep.reposicion_estado : 'pendiente');
    setUpdateObservacion('');
    setUpdateHorasAbonadas('');
    setOpenDialog(true);
  };

  const handleSaveUpdate = async () => {
    if (!selectedRep) return;
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
            {isEquipo && <TableCell><strong>Colaborador</strong></TableCell>}
            <TableCell><strong>Fecha de Salida</strong></TableCell>
            <TableCell><strong>Horas Pendientes</strong></TableCell>
            <TableCell><strong>Estado</strong></TableCell>
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
                <TableCell>{getHorasPendientes(row)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={estadoLabels[row.reposicion_estado] || row.reposicion_estado}
                    color={estadoColors[row.reposicion_estado] || 'default'}
                  />
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
            <Typography variant="body2">Colaborador: {selectedRep?.datos_formulario?.personal?.nombre || selectedRep?.solicitante_snapshot?.nombre}</Typography>
            <Typography variant="body2" sx={{ mt: 1, fontWeight: 'bold' }}>Saldo pendiente: {getHorasPendientes(selectedRep)}</Typography>
          </Box>

          <TextField
            label="Horas a abonar (Repuestas hoy)"
            type="number"
            value={updateHorasAbonadas}
            onChange={(e) => setUpdateHorasAbonadas(e.target.value)}
            fullWidth
            margin="normal"
            size="small"
            inputProps={{ min: 0, step: 0.5 }}
            helperText="Ingrese las horas repuestas, ej: 1.5. El saldo se descontará automáticamente."
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
            <MenuItem value="programada">Programada</MenuItem>
            <MenuItem value="cumplida">Cumplida</MenuItem>
            <MenuItem value="incumplida">Incumplida</MenuItem>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSaveUpdate}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
