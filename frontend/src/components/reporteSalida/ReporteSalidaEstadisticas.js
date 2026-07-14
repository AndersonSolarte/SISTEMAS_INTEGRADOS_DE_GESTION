import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Box, Paper, Stack, Typography, Grid, MenuItem, TextField, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Chip, ToggleButton, ToggleButtonGroup, IconButton } from '@mui/material';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BarChartIcon from '@mui/icons-material/BarChart';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import HealingIcon from '@mui/icons-material/Healing';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import AssignmentIcon from '@mui/icons-material/Assignment';
import TimelineIcon from '@mui/icons-material/Timeline';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import DateRangeIcon from '@mui/icons-material/DateRange';
import HistoryIcon from '@mui/icons-material/History';
import DownloadIcon from '@mui/icons-material/Download';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, LabelList } from 'recharts';

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

const exportToExcel = (title, dataRows) => {
  const STATUS_LABELS = {
    borrador: 'Borrador',
    pendiente_jefe: 'Pendiente Jefe',
    no_aprobada: 'Rechazada',
    pendiente_aprobacion_gestion_humana: 'Pendiente GH',
    finalizada: 'Aprobada'
  };

  const headers = [
    'Consecutivo', 'Fecha Radicación', 'Colaborador(a)', 'Documento', 'Dependencia', 'Cargo', 
    'Jefe Inmediato', 'Segmento', 'Tipo Permiso', 'Motivo / Detalles', 'Estado', 
    'Requiere Reposicion', 'Estado Reposicion', 'Tiempo Solicitado (Min)'
  ];

  const data = dataRows.map(row => {
    const f = row.datos_formulario || {};
    const tipo = f.salida?.tipo || 'N/A';
    let segmentoText = 'N/A';
    if (['cita_eps', 'cita_particular', 'terapias'].includes(tipo)) segmentoText = 'Salud y Bienestar';
    else if (['diligencia_personal', 'calamidad'].includes(tipo)) segmentoText = 'Actividades personales';
    else if (['reunion_institucional', 'evento_institucional', 'ponencia'].includes(tipo)) segmentoText = 'Actividades propias del cargo (Misionales)';

    return [
      row.consecutivo,
      new Date(row.created_at).toLocaleString('es-CO'),
      row.solicitante?.nombre || 'N/A',
      f.laboral?.cedula || 'N/A',
      f.laboral?.dependencia || 'N/A',
      f.laboral?.cargo || 'N/A',
      row.jefe?.nombre || 'N/A',
      segmentoText,
      tipo,
      f.salida?.motivo || f.salida?.otraDescripcion || '',
      STATUS_LABELS[row.estado] || row.estado,
      row.reposicion_aplica ? 'SI' : 'NO',
      row.reposicion_aplica ? row.reposicion_estado : 'N/A',
      row.tiempo_solicitado_minutos || 0
    ];
  });

  const worksheet = XLSX.utils.aoa_to_sheet([headers, ...data]);
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  if (worksheet['!ref']) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!worksheet[address]) continue;
      worksheet[address].s = {
        fill: { fgColor: { rgb: "0F172A" } },
        font: { color: { rgb: "FFFFFF" }, bold: true },
        alignment: { horizontal: "center" }
      };
    }
  }
  worksheet['!cols'] = [
    { wch: 18 }, { wch: 20 }, { wch: 35 }, { wch: 15 }, { wch: 25 }, { wch: 25 }, 
    { wch: 35 }, { wch: 25 }, { wch: 25 }, { wch: 50 }, { wch: 15 }, 
    { wch: 18 }, { wch: 18 }, { wch: 15 }
  ];
  
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos');
  XLSX.writeFile(workbook, `${title.replace(/[^a-z0-9]/gi, '_')}.xlsx`);
};

const renderTable = (title, icon, data, isTime = false, color = '#1d4ed8', bg = '#eff6ff', rawData = null) => (
  <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', height: '100%' }}>
    <Box sx={{ p: 2, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <Stack direction="row" alignItems="center" spacing={1.5}>
        {icon}
        <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 16 }}>{title}</Typography>
      </Stack>
      {rawData && (
        <IconButton size="small" onClick={() => exportToExcel(title, rawData)} sx={{ color: color, bgcolor: bg, '&:hover': { bgcolor: color, color: '#fff' } }}>
          <DownloadIcon fontSize="small" />
        </IconButton>
      )}
    </Box>
    <TableContainer sx={{ maxHeight: 450 }}>
      <Table stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontSize: 13, fontWeight: 800 }}>#</TableCell>
            <TableCell sx={{ fontSize: 13, fontWeight: 800 }}>Colaborador(a)</TableCell>
            <TableCell align="right" sx={{ fontSize: 13, fontWeight: 800 }}>{isTime ? 'Tiempo Acumulado' : 'Solicitudes'}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.length === 0 && (
            <TableRow><TableCell colSpan={3} align="center" sx={{ py: 3, color: '#64748b' }}>No hay registros.</TableCell></TableRow>
          )}
          {data.map((item, idx) => (
            <TableRow key={idx} hover>
              <TableCell sx={{ fontWeight: 800, color: '#64748b', fontSize: 14 }}>{idx + 1}</TableCell>
              <TableCell sx={{ fontSize: 14, fontWeight: 600 }}>{item.name}</TableCell>
              <TableCell align="right">
                <Chip size="small" label={isTime ? formatElapsed(item.value) : item.value} sx={{ bgcolor: bg, color, fontWeight: 900, fontSize: 13, px: 1, py: 2 }} />
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
  const [segmentoFiltro, setSegmentoFiltro] = useState('');
  const [chartTimeFilter, setChartTimeFilter] = useState('all');

  const filteredRows = useMemo(() => {
    let result = rows;
    if (estadoFiltro) {
      result = result.filter(r => r.estado === estadoFiltro);
    }
    if (segmentoFiltro) {
      result = result.filter(r => {
        const tipo = r.datos_formulario?.salida?.tipo;
        if (segmentoFiltro === 'salud') return ['cita_eps', 'cita_particular', 'terapias'].includes(tipo);
        if (segmentoFiltro === 'personales') return ['diligencia_personal', 'calamidad'].includes(tipo);
        if (segmentoFiltro === 'institucionales') return ['reunion_institucional', 'evento_institucional', 'ponencia'].includes(tipo);
        return tipo === segmentoFiltro;
      });
    }
    return result;
  }, [rows, estadoFiltro, segmentoFiltro]);

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

  const filteredDailyChart = useMemo(() => {
    if (chartTimeFilter === 'all' || indicators.dailyChart.length === 0) return indicators.dailyChart;
    const latestDate = new Date(indicators.dailyChart[indicators.dailyChart.length - 1].date);
    const msPerDay = 1000 * 60 * 60 * 24;
    const days = chartTimeFilter === 'weekly' ? 7 : 30;
    const cutoff = new Date(latestDate.getTime() - (days * msPerDay));
    return indicators.dailyChart.filter(d => new Date(d.date) >= cutoff);
  }, [indicators.dailyChart, chartTimeFilter]);

  return (
    <Box sx={{ p: { xs: 1, md: 2 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField select size="small" label="Segmento (Motivo)" value={segmentoFiltro} onChange={(e) => setSegmentoFiltro(e.target.value)} sx={{ minWidth: 320, bgcolor: '#fff' }}>
          <MenuItem value="">Todos los Segmentos</MenuItem>
          <MenuItem value="institucionales">Actividades propias del cargo (Misionales)</MenuItem>
          <MenuItem value="salud">Salud y Bienestar</MenuItem>
          <MenuItem value="personales">Actividades personales</MenuItem>
        </TextField>

        <TextField select size="small" label="Filtrar por Estado de Solicitud" value={estadoFiltro} onChange={(e) => setEstadoFiltro(e.target.value)} sx={{ minWidth: 300, bgcolor: '#fff' }}>
          <MenuItem value="">Mostrar Todos los Estados</MenuItem>
          <MenuItem value="finalizada">Solo Aprobadas / Finalizadas</MenuItem>
          <MenuItem value="no_aprobada">Solo Rechazadas</MenuItem>
        </TextField>
      </Stack>

      <Box sx={{ mb: 3 }}>
        <Paper elevation={0} sx={{ border: '1px solid #e2e8f0', borderRadius: 3, overflow: 'hidden', p: 3, bgcolor: '#fff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
            <Stack direction="row" alignItems="center" spacing={1}>
              <TimelineIcon sx={{ color: '#0ea5e9', fontSize: 28 }} />
              <Typography sx={{ fontWeight: 900, color: '#0f172a', fontSize: 18 }}>Flujo Diario de Ausentismo</Typography>
            </Stack>
            <ToggleButtonGroup
              size="small"
              value={chartTimeFilter}
              exclusive
              onChange={(e, val) => val && setChartTimeFilter(val)}
              sx={{
                bgcolor: '#f8fafc',
                '& .MuiToggleButton-root': {
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#64748b',
                  border: '1px solid #e2e8f0',
                  px: 2,
                  '&.Mui-selected': { bgcolor: '#e0f2fe', color: '#0284c7', borderColor: '#bae6fd' }
                }
              }}
            >
              <ToggleButton value="weekly"><DateRangeIcon sx={{ mr: 0.5, fontSize: 18 }} /> Últimos 7 Días</ToggleButton>
              <ToggleButton value="monthly"><CalendarMonthIcon sx={{ mr: 0.5, fontSize: 18 }} /> Últimos 30 Días</ToggleButton>
              <ToggleButton value="all"><HistoryIcon sx={{ mr: 0.5, fontSize: 18 }} /> Histórico</ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Box sx={{ width: '100%', height: 350 }}>
            {filteredDailyChart.length > 0 ? (
              <ResponsiveContainer>
                <AreaChart data={filteredDailyChart} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorSolicitudes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} tickLine={false} axisLine={false} />
                  <RechartsTooltip 
                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                    labelStyle={{ fontWeight: 800, color: '#334155', marginBottom: '4px' }}
                    itemStyle={{ fontWeight: 700 }}
                  />
                  <Area 
                    type="linear" 
                    dataKey="solicitudes" 
                    name="Solicitudes" 
                    stroke="#0ea5e9" 
                    strokeWidth={3.5} 
                    fillOpacity={1} 
                    fill="url(#colorSolicitudes)"
                    activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2, fill: '#0284c7' }}
                    dot={{ r: 4, stroke: '#fff', strokeWidth: 2, fill: '#0ea5e9' }}
                  >
                    <LabelList dataKey="solicitudes" position="top" offset={10} style={{ fontSize: 12, fontWeight: 800, fill: '#0284c7' }} />
                  </Area>
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Stack alignItems="center" justifyContent="center" height="100%">
                <Typography sx={{ color: '#94a3b8' }}>No hay datos suficientes para graficar.</Typography>
              </Stack>
            )}
          </Box>
        </Paper>
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 3 }}>
        {renderTable('Tiempo Total Fuera (Horas Acumuladas)', <AccessTimeIcon sx={{ color: '#b45309' }} />, indicators.topTime, true, '#b45309', '#fef3c7', filteredRows)}
        {renderTable('Total de Permisos Solicitados (Cantidad)', <BarChartIcon sx={{ color: '#1d4ed8' }} />, indicators.topCount, false, '#1d4ed8', '#eff6ff', filteredRows)}
        {indicators.dynamicTables.map(tbl => (
          <React.Fragment key={tbl.id}>
            {renderTable(tbl.label, tbl.icon, tbl.data, false, tbl.color, tbl.bg, filteredRows.filter(r => r.datos_formulario?.salida?.tipo === tbl.id))}
          </React.Fragment>
        ))}
      </Box>
    </Box>
  );
}
