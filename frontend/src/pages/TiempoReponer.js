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
  MenuItem,
  Alert
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

const parseLogLine = (line) => {
  let timestamp = '';
  let rest = line;
  if (line.startsWith('[')) {
    const endBracket = line.indexOf(']');
    if (endBracket !== -1) {
      timestamp = line.substring(1, endBracket);
      rest = line.substring(endBracket + 1).trim();
    }
  }
  
  const colonIndex = rest.indexOf(':');
  let actor = '';
  let actionAndComment = rest;
  if (colonIndex !== -1) {
    actor = rest.substring(0, colonIndex).trim();
    actionAndComment = rest.substring(colonIndex + 1).trim();
  }
  
  let action = actionAndComment;
  let comment = '';
  const commentIndex = actionAndComment.indexOf(' - "');
  if (commentIndex !== -1) {
    action = actionAndComment.substring(0, commentIndex).trim();
    const rawComment = actionAndComment.substring(commentIndex + 4).trim();
    comment = rawComment.endsWith('"') ? rawComment.substring(0, rawComment.length - 1) : rawComment;
  }
  
  return { timestamp, actor, action, comment };
};

const renderObservationHistory = (jefeObs, ghObs, row) => {
  if (!jefeObs && !ghObs) return null;

  const items = [];

  if (jefeObs) {
    items.push({
      type: 'jefe',
      roleLabel: 'Jefe Inmediato',
      actor: row?.jefe?.nombre || 'Jefe Inmediato',
      timestamp: row?.jefe_aprobado_at ? new Date(row.jefe_aprobado_at).toLocaleString('es-CO') : '',
      action: row?.estado === 'no_aprobada' ? 'Rechazó la solicitud' : 'Aprobó la solicitud',
      comment: jefeObs,
      bgColor: '#eff6ff',
      borderColor: '#bfdbfe',
      badgeColor: '#1d4ed8',
      badgeBg: '#dbeafe'
    });
  }

  if (ghObs) {
    ghObs.split('\n').forEach((line) => {
      if (!line.trim()) return;
      const parsed = parseLogLine(line);
      items.push({
        type: 'gh',
        roleLabel: 'Talento Humano',
        actor: parsed.actor || 'Gestión del Talento Humano',
        timestamp: parsed.timestamp || '',
        action: parsed.action,
        comment: parsed.comment,
        bgColor: '#f0fdf4',
        borderColor: '#bbf7d0',
        badgeColor: '#15803d',
        badgeBg: '#dcfce7'
      });
    });
  }

  return (
    <Box sx={{ mt: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 900, fontSize: 13, color: '#334155', borderBottom: '2px solid #e2e8f0', pb: 0.5 }}>
        Historial de Observaciones y Acciones
      </Typography>
      <Stack spacing={1.5}>
        {items.map((item, idx) => (
          <Box
            key={idx}
            sx={{
              p: 1.5,
              bgcolor: item.bgColor,
              border: `1px solid ${item.borderColor}`,
              borderRadius: 2.5,
              boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.02)'
            }}
          >
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
              <Chip
                label={item.roleLabel}
                size="small"
                sx={{
                  bgcolor: item.badgeBg,
                  color: item.badgeColor,
                  fontWeight: 900,
                  fontSize: 10,
                  height: 20
                }}
              />
              {item.timestamp && (
                <Typography variant="caption" sx={{ color: '#64748b', fontWeight: 600 }}>
                  {item.timestamp}
                </Typography>
              )}
            </Stack>
            
            <Typography variant="body2" sx={{ fontWeight: 800, color: '#1e293b', mb: item.comment ? 0.5 : 0 }}>
              {item.actor} &raquo; <span style={{ color: '#475569', fontWeight: 600 }}>{item.action}</span>
            </Typography>

            {item.comment && (
              <Box sx={{ mt: 1, p: 1, bgcolor: 'rgba(255, 255, 255, 0.7)', borderRadius: 1.5, borderLeft: `3px solid ${item.badgeColor}` }}>
                <Typography variant="body2" sx={{ fontStyle: 'italic', color: '#334155', fontSize: 11.5 }}>
                  "{item.comment}"
                </Typography>
              </Box>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
};

const getHorasPendientes = (row) => {
  if (!row) return '0 h';
  const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
  const minutosPagados = row.datos_formulario?.reposicion_minutos_pagados || 0;
  const pendientes = totalMinutos - minutosPagados;
  return pendientes > 0 ? formatElapsed(pendientes) : '0 h';
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
  const total = Math.round(Number(minutes));
  if (!Number.isFinite(total) || total <= 0) return '0h';
  const hours = Math.floor(total / 60);
  const remainingMinutes = total % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
};

const getAbonoMinutes = (hours, minutes) => (
  ((Number(hours) || 0) * 60) + (Number(minutes) || 0)
);

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
  const [updateMinutosAbonados, setUpdateMinutosAbonados] = useState('');

  const fetchMisReposiciones = async () => {
    try {
      const res = await api.get('/reporte-salida/reposiciones/mis-reposiciones');
      if (res.data.success) {
        const pending = res.data.data.filter(r => r.reposicion_estado !== 'cumplida');
        setMisReposiciones(pending);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const fetchEquipoReposiciones = async () => {
    try {
      const res = await api.get('/reporte-salida/reposiciones/equipo');
      if (res.data.success) {
        const pending = res.data.data.filter(r => r.reposicion_estado !== 'cumplida');
        setEquipoReposiciones(pending);
      }
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
    const minutosAbonar = getAbonoMinutes(updateHorasAbonadas, updateMinutosAbonados);
    if (minutosPendientes - minutosAbonar <= 0) {
      setUpdateEstado('cumplida');
    } else {
      setUpdateEstado('pendiente');
    }
  }, [updateHorasAbonadas, updateMinutosAbonados, selectedRep]);

  const handleUpdateClick = (rep) => {
    setSelectedRep(rep);
    setUpdateEstado(rep.reposicion_estado === 'cumplida' ? 'cumplida' : 'pendiente');
    setUpdateObservacion('');
    setUpdateHorasAbonadas('');
    setUpdateMinutosAbonados('');
    setOpenDialog(true);
  };

  const handleSaveUpdate = async () => {
    if (!selectedRep) return;
    const minutosAbonar = getAbonoMinutes(updateHorasAbonadas, updateMinutosAbonados);
    if (minutosAbonar <= 0) {
      enqueueSnackbar('El tiempo a abonar debe ser mayor que cero.', { variant: 'error' });
      return;
    }
    const totalMinutos = selectedRep.reposicion_minutos || selectedRep.tiempo_solicitado_minutos || 0;
    const minutosPagados = selectedRep.reposicion_minutos_pagados || selectedRep.datos_formulario?.reposicion_minutos_pagados || 0;
    const minutosPendientes = totalMinutos - minutosPagados;
    if (minutosAbonar > minutosPendientes) {
      enqueueSnackbar('El tiempo a abonar no puede exceder el saldo pendiente.', { variant: 'error' });
      return;
    }
    if (minutosPendientes - minutosAbonar <= 0 && updateEstado === 'pendiente') {
      enqueueSnackbar('No se puede guardar como "Pendiente" si se ha repuesto la totalidad de las horas.', { variant: 'error' });
      return;
    }

    try {
      const res = await api.patch(`/reporte-salida/solicitudes/${selectedRep.id}/reposicion`, {
        estado: updateEstado,
        observacion: updateObservacion,
        unidadReposicion: 'tiempo',
        horasAbonadas: Number(updateHorasAbonadas || 0),
        minutosAbonados: Number(updateMinutosAbonados || 0)
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

          {(() => {
            if (!selectedRep) return null;
            const totalMinutos = selectedRep.reposicion_minutos || selectedRep.tiempo_solicitado_minutos || 0;
            const minutosPagados = selectedRep.reposicion_minutos_pagados || selectedRep.datos_formulario?.reposicion_minutos_pagados || 0;
            const minutosPendientes = totalMinutos - minutosPagados;
            const minutosAbono = getAbonoMinutes(updateHorasAbonadas, updateMinutosAbonados);

            if (minutosPendientes <= 0) {
              return (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                  El/la colaborador(a) ya repuso la totalidad del tiempo pendiente para esta salida.
                </Alert>
              );
            }

            if (minutosAbono <= 0) {
              return (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                  Ingrese las horas o minutos repuestos por el colaborador (no puede ser vacío ni 0).
                </Alert>
              );
            }

            if (minutosAbono > minutosPendientes) {
              return (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  El tiempo ingresado supera el saldo pendiente de {formatElapsed(minutosPendientes)}.
                </Alert>
              );
            }

            const restante = minutosPendientes - minutosAbono;
            return restante === 0 ? (
              <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }}>
                Correcto. La deuda quedará totalmente saldada.
              </Alert>
            ) : (
              <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
                Correcto. Quedará un saldo pendiente de {formatElapsed(restante)}.
              </Alert>
            );
          })()}

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 2 }}>
            <TextField
              label="Horas repuestas"
              type="number"
              value={updateHorasAbonadas}
              onChange={(e) => setUpdateHorasAbonadas(e.target.value.replace(/[^0-9]/g, ''))}
              fullWidth
              size="small"
              inputProps={{ min: 0, step: 1 }}
            />
            <TextField
              label="Minutos adicionales"
              type="number"
              value={updateMinutosAbonados}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9]/g, '');
                if (value === '' || Number(value) <= 59) setUpdateMinutosAbonados(value);
              }}
              fullWidth
              size="small"
              inputProps={{ min: 0, max: 59, step: 1 }}
              helperText="De 0 a 59 minutos."
            />
          </Stack>

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

          {renderObservationHistory(getJefeObservacion(selectedRep), selectedRep?.observacion_gestion_humana, selectedRep)}
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
              const minutosAbono = getAbonoMinutes(updateHorasAbonadas, updateMinutosAbonados);
              if (minutosPendientes <= 0) return true;
              if (minutosAbono <= 0 || minutosAbono > minutosPendientes) return true;
              if (minutosPendientes - minutosAbono <= 0 && updateEstado === 'pendiente') return true;
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
