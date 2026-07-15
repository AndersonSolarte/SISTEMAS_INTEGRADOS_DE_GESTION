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
  if (!Number.isFinite(total) || total <= 0) return '0h';
  const hours = total / 60;
  const formatted = Number(hours.toFixed(1));
  return `${formatted}h`;
};

const exportToExcel = (title, summaryData, isTime, rawData) => {
  const STATUS_LABELS = {
    borrador: 'Borrador',
    pendiente_aprobacion_jefe: 'Pendiente Jefe',
    no_aprobada: 'Rechazada',
    pendiente_aprobacion_gestion_humana: 'Pendiente GH',
    pendiente_aprobacion_sst: 'Pendiente SST',
    finalizada: 'Aprobada'
  };

  const TYPE_LABELS = {
    cita_eps: 'Cita Médica EPS',
    cita_particular: 'Cita Especialista / Particular',
    terapias: 'Terapias',
    urgencia_medica: 'Urgencia Médica',
    diligencia_personal: 'Diligencia Personal',
    calamidad: 'Calamidad Doméstica',
    jurado_votacion: 'Jurado de Votación',
    sufragante: 'Sufragante',
    voto_jurado: 'Jurado de Votación (Voto)',
    voto_sufragante: 'Sufragante (Voto)',
    reunion_institucional: 'Reunión Institucional',
    evento_institucional: 'Evento Institucional',
    ponencia: 'Ponencia / Exposición',
    visita_ies: 'Visita IES / Par Académico',
    salida_campus: 'Salida de Campus'
  };

  // -------------------------------------------------------------
  // HOJA 1: RESUMEN DE LA CARD (Muestra la tabla del Top 10)
  // -------------------------------------------------------------
  const headersSummary = ['Puesto', 'Colaborador(a)', isTime ? 'Tiempo Acumulado (Hrs)' : 'Solicitudes (Cantidad)'];
  const dataSummary = summaryData.map((item, idx) => [
    idx + 1,
    item.name,
    isTime ? (Number(item.value) / 60).toFixed(1) : item.value
  ]);

  const worksheetSummary = XLSX.utils.aoa_to_sheet([headersSummary, ...dataSummary]);

  // -------------------------------------------------------------
  // HOJA 2: DETALLE Y TRAZABILIDAD (Muestra las filas crudas asociadas)
  // -------------------------------------------------------------
  const hasReposicion = (rawData || []).some(row => row.reposicion_aplica);

  const headersDetail = [
    'Consecutivo', 
    'Colaborador(a)', 
    'Documento', 
    'Dependencia', 
    'Cargo', 
    'Jefe Inmediato', 
    'Segmento', 
    'Tipo Permiso',
    'Motivo / Detalles', 
    'Estado Solicitud',
    'Fecha Salida',
    'Fecha Regreso',
    'Hora Salida',
    'Hora Regreso',
    'Campus Salida',
    'Campus Destino',
    'Alcance',
    'País',
    'Departamento',
    'Municipio',
    'Entidad Destino',
    'Especialidad Médica',
    'Detalle Terapias (Citas)'
  ];

  if (hasReposicion) {
    headersDetail.push(
      'Requiere Reposición', 
      'Estado Reposición', 
      'Tiempo Solicitado (Min)', 
      'Tiempo Solicitado (Hrs)', 
      'Tiempo Repuesto / Abonado (Hrs)', 
      'Saldo Pendiente (Hrs)'
    );
  }

  headersDetail.push(
    'Fecha Creación', 
    'Fecha Aprobación Jefe', 
    'Fecha Aprobación GH', 
    'Fecha Radicación (Finalización)', 
    'Observación Jefe', 
    'Historial Observaciones GH / Abonos', 
    'Trazabilidad Histórica Completa'
  );

  const dataDetail = (rawData || []).map(row => {
    const f = row.datos_formulario || {};
    const s = f.salida || {};
    const p = f.personal || {};
    const l = f.laboral || {};
    const tipo = s.tipo || 'N/A';
    
    let segmentoText = 'N/A';
    const rowCat = s.categoria;
    if (rowCat === 'salud') segmentoText = 'Salud y Bienestar';
    else if (rowCat === 'personales') segmentoText = 'Trámites, Permisos y Licencias';
    else if (rowCat === 'propias_cargo') segmentoText = 'Actividades propias del cargo (Misionales)';
    else {
      if (['cita_eps', 'cita_particular', 'terapias', 'urgencia_medica'].includes(tipo)) segmentoText = 'Salud y Bienestar';
      else if (['diligencia_personal', 'calamidad', 'jurado_votacion', 'sufragante'].includes(tipo)) segmentoText = 'Trámites, Permisos y Licencias';
      else if (['reunion_institucional', 'evento_institucional', 'ponencia', 'visita_ies', 'salida_campus'].includes(tipo)) segmentoText = 'Actividades propias del cargo (Misionales)';
    }

    const typeLabel = TYPE_LABELS[tipo] || tipo.replace(/_/g, ' ').toUpperCase();

    // Detalle de Terapias
    let terapiasStr = 'N/A';
    if (tipo === 'terapias' && Array.isArray(s.terapiasList)) {
      terapiasStr = s.terapiasList.map((t, idx) => {
        return `[Terapia ${idx + 1}] Fecha: ${t.fecha || 'N/A'}, Hora: ${t.horaInicio || 'N/A'} - ${t.horaFin || 'N/A'}`;
      }).join('\n');
    }

    const rowData = [
      row.consecutivo,
      row.solicitante?.nombre || 'N/A',
      p.documento || row.solicitante?.username || 'N/A',
      l.dependencia || 'N/A',
      l.cargo || 'N/A',
      row.jefe?.nombre || 'N/A',
      segmentoText,
      typeLabel,
      s.motivo || s.otraDescripcion || '',
      STATUS_LABELS[row.estado] || row.estado,
      s.fecha || 'N/A',
      s.fechaRegreso || s.fecha || 'N/A',
      s.horaInicio || 'N/A',
      s.horaFin || 'N/A',
      s.campusSalida || 'N/A',
      s.campusDestino || 'N/A',
      s.alcance || 'N/A',
      s.pais || 'N/A',
      s.departamento || 'N/A',
      s.municipio || 'N/A',
      s.entidadDestino || 'N/A',
      s.especialidadMedica || 'N/A',
      terapiasStr
    ];

    if (hasReposicion) {
      const totalMinutos = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
      const minutosPagados = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
      const pendientes = totalMinutos - minutosPagados;

      const hrsSolicitadas = (totalMinutos / 60).toFixed(1);
      const hrsPagadas = (minutosPagados / 60).toFixed(1);
      const hrsPendientes = (pendientes / 60).toFixed(1);

      rowData.push(
        row.reposicion_aplica ? 'SI' : 'NO',
        row.reposicion_aplica ? (row.reposicion_estado === 'cumplida' ? 'Cumplida' : 'Pendiente') : 'N/A',
        row.tiempo_solicitado_minutos || 0,
        hrsSolicitadas,
        hrsPagadas,
        hrsPendientes
      );
    }

    let trazabilidadStr = '';
    if (Array.isArray(row.trazabilidad)) {
      trazabilidadStr = row.trazabilidad.map(t => {
        const dateStr = t.timestamp ? new Date(t.timestamp).toLocaleString('es-CO') : '';
        const userStr = t.actor || t.userId || 'Sistema';
        return `[${dateStr}] ${userStr}: ${t.event}`;
      }).join('\n');
    }

    rowData.push(
      row.created_at ? new Date(row.created_at).toLocaleString('es-CO') : 'N/A',
      row.jefe_aprobado_at ? new Date(row.jefe_aprobado_at).toLocaleString('es-CO') : 'Pendiente',
      row.gestion_humana_aprobado_at ? new Date(row.gestion_humana_aprobado_at).toLocaleString('es-CO') : 'Pendiente',
      row.finalizado_at ? new Date(row.finalizado_at).toLocaleString('es-CO') : 'Pendiente',
      row.trazabilidad?.find(t => (t.event === 'no_aprobada' || t.event === 'aprobada_jefe'))?.detail?.observacion || '',
      row.observacion_gestion_humana || '',
      trazabilidadStr
    );

    return rowData;
  });

  const worksheetDetail = XLSX.utils.aoa_to_sheet([headersDetail, ...dataDetail]);

  // Aplicar estilos y anchos de columna dinámicamente
  const applyHeaderStyles = (ws, headers) => {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_cell({ r: 0, c: C });
      if (!ws[address]) continue;
      ws[address].s = {
        font: { bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "0F172A" } },
        alignment: { horizontal: "center", vertical: "center" }
      };
    }
    
    const cols = [];
    for (let C = range.s.c; C <= range.e.c; ++C) {
      let maxLen = headers[C]?.length || 10;
      for (let R = range.s.r; R <= range.e.r; ++R) {
        const address = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = ws[address];
        if (cell && cell.v) {
          const lines = String(cell.v).split('\n');
          const maxLine = Math.max(...lines.map(l => l.length));
          if (maxLine > maxLen) maxLen = maxLine;
        }
      }
      cols.push({ wch: Math.min(Math.max(maxLen + 3, 12), 45) });
    }
    ws['!cols'] = cols;
  };

  applyHeaderStyles(worksheetSummary, headersSummary);
  applyHeaderStyles(worksheetDetail, headersDetail);

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheetSummary, "Resumen");
  XLSX.utils.book_append_sheet(workbook, worksheetDetail, "Detalle y Trazabilidad");
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
        <IconButton size="small" onClick={() => exportToExcel(title, data, isTime, rawData)} sx={{ color: color, bgcolor: bg, '&:hover': { bgcolor: color, color: '#fff' } }}>
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
      if (row.reposicion_aplica) {
        init(timeMap);
        const totalMins = row.reposicion_minutos || row.tiempo_solicitado_minutos || 0;
        const paidMins = row.reposicion_minutos_pagados || row.datos_formulario?.reposicion_minutos_pagados || 0;
        const pendingMins = Math.max(0, totalMins - paidMins);
        timeMap[uId].value += pendingMins;
      }

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
