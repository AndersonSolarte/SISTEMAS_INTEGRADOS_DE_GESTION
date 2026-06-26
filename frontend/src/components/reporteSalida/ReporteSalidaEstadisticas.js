import React, { useState, useMemo } from 'react';
import { Box, Paper, Stack, Typography, Grid, MenuItem, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BarChartIcon from '@mui/icons-material/BarChart';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import HealingIcon from '@mui/icons-material/Healing';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TimelineIcon from '@mui/icons-material/Timeline';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip } from 'recharts';

const formatElapsed = (minutes) => {
  const total = Number(minutes);
  if (!Number.isFinite(total)) return '-';
  const days = Math.floor(total / 1440);
  const hours = Math.floor((total % 1440) / 60);
  const mins = total % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
};

const renderTable = (title, icon, data, isTime = false, color = '#1d4ed8', bg = '#eff6ff') => (
  <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', height: '100%' }}>
    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
      <Stack direction="row" alignItems="center" spacing={1}>
        {icon}
        <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 14 }}>{title}</Typography>
      </Stack>
    </Box>
    <TableContainer sx={{ maxHeight: 300 }}>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontSize: 11 }}>#</TableCell>
            <TableCell sx={{ fontSize: 11 }}>Colaborador</TableCell>
            <TableCell align="right" sx={{ fontSize: 11 }}>{isTime ? 'Tiempo Acumulado' : 'Solicitudes'}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 && (
            <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: '#64748b' }}>No hay registros.</TableCell></TableRow>
          )}
          {data.map((item, idx) => (
            <TableRow key={idx} hover>
              <TableCell sx={{ fontWeight: 800, color: '#64748b' }}>{idx + 1}</TableCell>
              <TableCell sx={{ fontSize: 12 }}>{item.name}</TableCell>
              <TableCell align="right">
                <Chip size="small" label={isTime ? formatElapsed(item.value) : item.value} sx={{ bgcolor: bg, color, fontWeight: 900 }} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  </Paper>
);

export default function ReporteSalidaEstadisticas({ rows = [] }) {
  const [estadoFiltro, setEstadoFiltro] = useState('');

  const filteredRows = useMemo(() => {
    let result = rows;
    if (estadoFiltro) {
      result = result.filter(r => r.estado === estadoFiltro);
    }
    return result;
  }, [rows, estadoFiltro]);

  const indicators = useMemo(() => {
    const countsMap = {};
    const timeMap = {};
    const typeMaps = {};

    filteredRows.forEach(row => {
      const uId = row.solicitante?.userId || row.solicitante?.id || 'Desconocido';
      const name = row.solicitante?.nombre || 'Desconocido';
      const mins = row.tiempo_solicitado_minutos || 0;
      const tipo = row.datos_formulario?.salida?.tipo || 'otro';

      const init = (map) => {
        if (!map[uId]) map[uId] = { name, value: 0 };
      };

      // Frecuencia y Tiempo General
      init(countsMap); countsMap[uId].value += 1;
      init(timeMap); timeMap[uId].value += mins;

      // Por tipo dinámico
      if (!typeMaps[tipo]) typeMaps[tipo] = {};
      init(typeMaps[tipo]); typeMaps[tipo][uId].value += 1;
    });

    const sortMap = (map) => Object.values(map).sort((a, b) => b.value - a.value).slice(0, 10);

    const dynamicTables = Object.keys(typeMaps).map(tipo => {
      let label = tipo.replace(/_/g, ' ').toUpperCase();
      let icon = <AssignmentIcon sx={{ color: '#be123c' }} />;
      let color = '#be123c';
      let bg = '#ffe4e6';

      if (tipo === 'cita_eps') { label = 'CITAS MÉDICAS EPS'; icon = <LocalHospitalIcon sx={{ color: '#15803d' }} />; color = '#15803d'; bg = '#dcfce7'; }
      if (tipo === 'cita_particular') { label = 'CITAS ESPEC. / PART.'; icon = <MedicalServicesIcon sx={{ color: '#0369a1' }} />; color = '#0369a1'; bg = '#e0f2fe'; }
      if (tipo === 'terapias') { label = 'TERAPIAS'; icon = <HealingIcon sx={{ color: '#7e22ce' }} />; color = '#7e22ce'; bg = '#f3e8ff'; }
      if (tipo === 'diligencia_personal' || tipo === 'calamidad') { label = tipo === 'calamidad' ? 'CALAMIDAD DOMÉSTICA' : 'DILIGENCIAS PERSONALES'; icon = <AssignmentIcon sx={{ color: '#be123c' }} />; color = '#be123c'; bg = '#ffe4e6'; }
      if (tipo === 'reunion_institucional' || tipo === 'evento_institucional' || tipo === 'ponencia') { icon = <AssignmentIcon sx={{ color: '#64748b' }} />; color = '#64748b'; bg = '#f1f5f9'; }

      return {
        id: tipo,
        label: `Ausentismo - ${label}`,
        icon, color, bg,
        data: sortMap(typeMaps[tipo])
      };
    });

    const dailyMap = {};
    filteredRows.forEach(row => {
      const fecha = row.datos_formulario?.salida?.fecha || row.createdAt?.split('T')[0];
      if (fecha) {
        if (!dailyMap[fecha]) dailyMap[fecha] = { date: fecha, solicitudes: 0 };
        dailyMap[fecha].solicitudes += 1;
      }
    });
    const dailyChart = Object.values(dailyMap).sort((a, b) => new Date(a.date) - new Date(b.date));

    return {
      topCount: sortMap(countsMap),
      topTime: sortMap(timeMap),
      dynamicTables: dynamicTables.sort((a, b) => b.data.length - a.data.length),
      dailyChart
    };
  }, [filteredRows]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <TextField select size="small" label="Filtrar por Estado de Solicitud" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} sx={{ minWidth: 300, bgcolor: '#fff' }}>
          <MenuItem value="">Mostrar Todos los Estados</MenuItem>
          <MenuItem value="finalizada">Solo Aprobadas / Finalizadas</MenuItem>
          <MenuItem value="no_aprobada">Solo Rechazadas</MenuItem>
        </TextField>
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12}>
          <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', p: 3, mb: 1, bgcolor: '#fff' }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
              <TimelineIcon sx={{ color: '#0ea5e9' }} />
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 16 }}>Flujo Diario de Ausentismo</Typography>
            </Stack>
            <Box sx={{ width: '100%', height: 300 }}>
              {indicators.dailyChart.length > 0 ? (
                <ResponsiveContainer>
                  <AreaChart data={indicators.dailyChart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorSolicitudes" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#64748b' }} tickLine={false} axisLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      labelStyle={{ fontWeight: 700, color: '#334155', marginBottom: '4px' }}
                    />
                    <Area type="monotone" dataKey="solicitudes" name="Solicitudes" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorSolicitudes)" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <Stack alignItems="center" justifyContent="center" height="100%">
                  <Typography sx={{ color: '#94a3b8' }}>No hay datos suficientes para graficar.</Typography>
                </Stack>
              )}
            </Box>
          </Paper>
        </Grid>
        <Grid item xs={12} md={6} lg={6} xl={6}>
          {renderTable('Índice de Severidad (Total Horas)', <AccessTimeIcon sx={{ color: '#b45309' }} />, indicators.topTime, true, '#b45309', '#fef3c7')}
        </Grid>
        <Grid item xs={12} md={6} lg={6} xl={6}>
          {renderTable('Índice de Frecuencia (Total Permisos)', <BarChartIcon sx={{ color: '#1d4ed8' }} />, indicators.topCount, false, '#1d4ed8', '#eff6ff')}
        </Grid>
        {indicators.dynamicTables.map(tbl => (
          <Grid item xs={12} md={6} lg={6} xl={6} key={tbl.id}>
            {renderTable(tbl.label, tbl.icon, tbl.data, false, tbl.color, tbl.bg)}
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
