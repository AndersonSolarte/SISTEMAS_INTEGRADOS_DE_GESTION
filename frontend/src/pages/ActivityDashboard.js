import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stack, CircularProgress, Chip,
  Select, MenuItem, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Avatar, Tooltip,
  FormControl, InputLabel, Alert, Button, Switch, FormControlLabel,
  Paper, Grid, IconButton, Fade, Zoom, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, 
  BarChart, Bar, LabelList, Tooltip as RechartsTooltip, Legend, CartesianGrid, XAxis, YAxis
} from 'recharts';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import VisibilityIcon from '@mui/icons-material/Visibility';
import DownloadIcon from '@mui/icons-material/Download';

import api from '../services/api';

/* ── Constants ── */
const ROLE_LABELS = {
  'ADMINISTRADOR': 'Administrador',
  'CONSULTA': 'Consulta',
  'GESTION_PROCESOS': 'Gestión por Procesos',
  'PLANEACION_ESTRATEGICA': 'Planeación Estratégica',
  'PLANEACION_EFECTIVIDAD': 'Planeación y Efectividad',
  'AUTOEVALUACION': 'Autoevaluación',
  'GESTION_INFORMACION': 'Gestión de la Información',
  'REGISTROS_CALIFICADOS': 'Registros Calificados y Acreditación'
};

const MODULE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

const ACTION_COLORS = {
  'Inicio de sesión': '#3b82f6',
  'Consulta': '#3b82f6',
  'Creación': '#10b981',
  'Actualización': '#f59e0b',
  'Eliminación': '#ef4444',
  'Visita / Visualización': '#8b5cf6',
  'Inicio de sesión': '#06b6d4',
  'Carga de archivo': '#f97316',
  'Descarga': '#ec4899',
  'Error del Sistema': '#ef4444',
  'Error de Cliente': '#f43f5e',
  'Acceso Denegado': '#be123c',
  'Acceso Denegado': '#be123c',
};

/* ── Custom XAxis Tick ── */
const MultilineTick = (props) => {
  const { x, y, payload } = props;
  const label = ROLE_LABELS[payload.value] || payload.value || '';
  const words = label.split(' ');
  const lines = [];
  let currentLine = '';
  words.forEach(word => {
    if ((currentLine + word).length > 12) {
      if (currentLine) lines.push(currentLine.trim());
      currentLine = word + ' ';
    } else {
      currentLine += word + ' ';
    }
  });
  if (currentLine) lines.push(currentLine.trim());

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={0} dy={16} textAnchor="middle" fill="#94a3b8" fontSize={10} fontWeight={600}>
        {lines.map((line, index) => (
          <tspan x={0} dy={index === 0 ? 0 : 12} key={index}>{line}</tspan>
        ))}
      </text>
    </g>
  );
};

const fmtTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
};

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

/* ── Styled Components (Premium Glassmorphism) ── */
const GlassCard = ({ children, delay = 0, sx = {} }) => (
  <Zoom in={true} style={{ transitionDelay: `${delay}ms` }} timeout={500}>
    <Paper elevation={0} sx={{
      background: 'rgba(255, 255, 255, 0.7)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255, 255, 255, 0.8)',
      borderRadius: 4,
      boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.05)',
      transition: 'all 0.3s ease',
      position: 'relative',
      overflow: 'hidden',
      '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: '0 15px 45px 0 rgba(31, 38, 135, 0.1)',
        background: 'rgba(255, 255, 255, 0.85)',
      },
      ...sx
    }}>
      {/* Decorative gradient orb */}
      <Box sx={{
        position: 'absolute', top: -50, right: -50, width: 150, height: 150,
        background: 'radial-gradient(circle, rgba(59,130,246,0.1) 0%, rgba(255,255,255,0) 70%)',
        borderRadius: '50%', pointerEvents: 'none'
      }} />
      {children}
    </Paper>
  </Zoom>
);

const KPIWidget = ({ title, value, subtitle, icon: Icon, color, delay }) => (
  <GlassCard delay={delay} sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
    <Box sx={{
      width: 64, height: 64, borderRadius: 4,
      background: `linear-gradient(135deg, ${color} 0%, ${color}99 100%)`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: `0 8px 24px ${color}40`,
      color: '#fff'
    }}>
      <Icon sx={{ fontSize: 32 }} />
    </Box>
    <Box>
      <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1 }}>{title}</Typography>
      <Typography sx={{ fontSize: 36, fontWeight: 900, color: '#0f172a', lineHeight: 1.1, my: 0.5 }}>{value}</Typography>
      <Typography sx={{ fontSize: 12, fontWeight: 600, color: color }}>{subtitle}</Typography>
    </Box>
  </GlassCard>
);

const HeadCell = ({ children }) => (
  <TableCell sx={{ fontWeight: 800, fontSize: 11, color: '#64748b', bgcolor: 'transparent', textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '2px solid rgba(0,0,0,0.05)' }}>
    {children}
  </TableCell>
);

export default function ActivityDashboard({ embedded = false }) {
  const [days, setDays] = useState(30);
  const [moduleFilter, setModuleFilter] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const load = useCallback(async (d, silent = false) => {
    if (!silent) { setLoading(true); setError(null); }
    try {
      let url = `/admin/activity/stats?days=${d}`;
      if (moduleFilter) url += `&module=${encodeURIComponent(moduleFilter)}`;
      if (roleFilter) url += `&role=${encodeURIComponent(roleFilter)}`;
      const { data: res } = await api.get(url);
      if (res.success) {
        // Fix data formats for charts
        const parsed = { ...res.stats };
        if (parsed.byAction) parsed.byAction = parsed.byAction.map(x => ({ ...x, total: Number(x.total) }));
        if (parsed.byDay) parsed.byDay = parsed.byDay.map(x => ({ 
          ...x, 
          total: Number(x.total),
          dateFormatted: new Date(x.date).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
        }));
        if (parsed.loginsByDay) parsed.loginsByDay = parsed.loginsByDay.map(x => ({
          ...x,
          total: Number(x.total),
          dateFormatted: new Date(x.date).toLocaleDateString('es-ES', { day:'2-digit', month:'short' })
        }));
        if (parsed.topConsultingUsers) {
          const totalConsultas = parsed.topConsultingUsers.reduce((sum, item) => sum + Number(item.total), 0);
          parsed.topConsultingUsers = parsed.topConsultingUsers.map(x => ({
            ...x,
            porcentaje: totalConsultas > 0 ? parseFloat(((Number(x.total) / totalConsultas) * 100).toFixed(1)) : 0
          }));
        }
        setData(parsed);
      } else {
        setError(res.message || 'Error al cargar datos.');
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Error de conexión.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [moduleFilter, roleFilter]);

  useEffect(() => { load(days); }, [days, load]);

  useEffect(() => {
    let interval;
    if (autoRefresh) interval = setInterval(() => load(days, true), 15000);
    return () => clearInterval(interval);
  }, [autoRefresh, days, load]);

  const exportCSV = (dataList, filename, headers, mapper) => {
    if (!dataList || !dataList.length) return;
    const csvRows = [headers.join(',')];
    dataList.forEach(row => {
      const values = mapper(row).map(v => `"${String(v ?? '').replace(/"/g, '""')}"`);
      csvRows.push(values.join(','));
    });
    const blob = new Blob(['\uFEFF' + csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
  };

  return (
    <Box sx={{ minHeight: '100vh', background: 'radial-gradient(circle at 10% 20%, #eff6ff 0%, #f1f5f9 100%)', p: { xs: 2, md: 4 }, overflow: 'hidden' }}>
      
      {/* ── Premium Header ── */}
      <GlassCard delay={100} sx={{ p: 2.5, mb: 4, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center', justifyContent: 'space-between', borderRadius: 5 }}>
        <Stack direction="row" spacing={2.5} alignItems="center">
          <Box sx={{ width: 50, height: 50, borderRadius: 3, background: 'linear-gradient(135deg, #2563eb, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 8px 16px rgba(37, 99, 235, 0.25)' }}>
            <AnalyticsOutlinedIcon sx={{ fontSize: 28 }} />
          </Box>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', background: 'linear-gradient(90deg, #0f172a, #334155)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Monitor Interactivo de Actividad
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', fontWeight: 600 }}>
              Tablero de análisis inteligente y comportamiento de usuarios
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={<Switch checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} color="primary" />}
            label={<Typography variant="body2" sx={{ fontWeight: 800, color: autoRefresh ? '#2563eb' : '#64748b' }}>En Vivo (15s)</Typography>}
            sx={{ m: 0, bgcolor: autoRefresh ? 'rgba(37,99,235,0.1)' : 'transparent', px: 2, py: 0.5, borderRadius: 10, transition: 'all 0.3s' }}
          />
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontWeight: 700 }}>Rol de Usuario</InputLabel>
            <Select value={roleFilter} label="Rol de Usuario" onChange={(e) => setRoleFilter(e.target.value)} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              <MenuItem value="">Todos los Roles</MenuItem>
              {Object.keys(ROLE_LABELS).map(k => <MenuItem key={k} value={k}>{ROLE_LABELS[k]}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel sx={{ fontWeight: 700 }}>Módulo</InputLabel>
            <Select value={moduleFilter} label="Módulo" onChange={(e) => setModuleFilter(e.target.value)} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              <MenuItem value="">Todo el Sistema</MenuItem>
              {['Validación Masiva','Consulta Individual','Matriculados','Gestión de Información','Documentos','Administración Usuarios','Catálogo de Procesos','Sistema'].map(m => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel sx={{ fontWeight: 700 }}>Período</InputLabel>
            <Select value={days} label="Período" onChange={(e) => setDays(e.target.value)} sx={{ borderRadius: 3, bgcolor: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>
              {[1, 7, 15, 30, 90].map(d => <MenuItem key={d} value={d}>{d === 1 ? 'Hoy' : `Últimos ${d} días`}</MenuItem>)}
            </Select>
          </FormControl>
          <IconButton onClick={() => load(days)} sx={{ bgcolor: 'rgba(37,99,235,0.1)', color: '#2563eb', '&:hover': { bgcolor: '#2563eb', color: '#fff' } }}>
            <RefreshIcon />
          </IconButton>
        </Stack>
      </GlassCard>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 3 }}>{error}</Alert>}

      {loading && !data ? (
        <Box sx={{ display:'flex', justifyContent:'center', py: 10 }}>
          <CircularProgress size={60} thickness={4} />
        </Box>
      ) : data && (
        <Stack spacing={4}>
          
          {/* ── KPI Widgets (The WOW factor) ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)' }, gap: 3 }}>
            <Box>
              <KPIWidget delay={100} title="Usuarios (7d)" value={data.activeUsers7d?.toLocaleString() || 0} subtitle="Activos recientes" icon={PeopleRoundedIcon} color="#ec4899" />
            </Box>
            <Box>
              <KPIWidget delay={200} title="Interacciones" value={data.totalEvents?.toLocaleString()} subtitle={`~${Math.round(data.totalEvents / days).toLocaleString()}/día`} icon={TrendingUpIcon} color="#3b82f6" />
            </Box>
            <Box>
              <KPIWidget delay={300} title="Accesos" value={data.loginEvents?.toLocaleString()} subtitle={`~${Math.round(data.loginEvents / days).toLocaleString()}/día`} icon={LoginRoundedIcon} color="#8b5cf6" />
            </Box>
            <Box>
              <KPIWidget delay={400} title="Descargas" value={data.downloadEvents?.toLocaleString() || 0} subtitle="Exportaciones" icon={FileDownloadRoundedIcon} color="#10b981" />
            </Box>
            <Box>
              <KPIWidget delay={500} title="Errores" value={data.errorEvents?.toLocaleString() || 0} subtitle="Excepciones" icon={WarningRoundedIcon} color={data.errorEvents > 0 ? '#ef4444' : '#64748b'} />
            </Box>
          </Box>

          {/* ── Beautiful Charts ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={600} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Ingresos al Sistema por Día</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Volumen de inicios de sesión a lo largo del período seleccionado</Typography>
                  </Box>
                  <ToggleButtonGroup
                    value={days}
                    exclusive
                    onChange={(e, val) => { if (val) setDays(val); }}
                    size="small"
                    sx={{ bgcolor: 'rgba(255,255,255,0.5)', borderRadius: 2 }}
                  >
                    <ToggleButton value={7} sx={{ fontWeight: 700, textTransform: 'none', px: 2 }}>Semana</ToggleButton>
                    <ToggleButton value={15} sx={{ fontWeight: 700, textTransform: 'none', px: 2 }}>Quincena</ToggleButton>
                    <ToggleButton value={30} sx={{ fontWeight: 700, textTransform: 'none', px: 2 }}>Mes</ToggleButton>
                  </ToggleButtonGroup>
                </Box>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.loginsByDay} margin={{ top: 20, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="dateFormatted" tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                    <RechartsTooltip 
                      contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 700 }}
                      itemStyle={{ color: '#3b82f6', fontWeight: 900 }}
                    />
                    <Area type="monotone" dataKey="total" name="Ingresos" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorLogins)">
                      <LabelList dataKey="total" position="top" fill="#3b82f6" fontSize={12} fontWeight={700} />
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </GlassCard>
            </Box>
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={700} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Uso Colectivo por Roles</Typography>
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>Conteo de ingresos al sistema agrupado por perfil</Typography>
                </Box>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <BarChart data={data.loginsByRole} margin={{ top: 20, right: 20, left: -20, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                      <XAxis dataKey="user_role" axisLine={false} tickLine={false} interval={0} tick={<MultilineTick />} />
                      <YAxis tick={{ fontSize: 12, fill: '#94a3b8', fontWeight: 600 }} axisLine={false} tickLine={false} />
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 700 }}
                        itemStyle={{ color: '#10b981', fontWeight: 900 }}
                        labelFormatter={(lbl) => ROLE_LABELS[lbl] || lbl}
                      />
                      <Bar dataKey="total" name="Total Interacciones" fill="#10b981" radius={[4, 4, 0, 0]}>
                        <LabelList dataKey="total" position="top" fill="#10b981" fontSize={12} fontWeight={700} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </Box>
              </GlassCard>
            </Box>
          </Box>

          {/* ── Premium Data Tables ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
            {/* Ranking de Usuarios (Conexiones) */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={800} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Conexiones por Usuario</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Estadística de accesos al sistema</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topLogins, `usuarios_${days}d`, ['Nombre','Correo','Rol','Accesos','Último Acceso'], u => [u.user_name, u.user_email, ROLE_LABELS[u.user_role]||u.user_role, u.total_logins, fmtTime(u.ultimo_acceso)])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Nombre y Correo</HeadCell>
                        <HeadCell>Rol Asignado</HeadCell>
                        <HeadCell>Accesos</HeadCell>
                        <HeadCell>Último Ingreso</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.topLogins?.map((u, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(59,130,246,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Stack direction="row" spacing={2} alignItems="center">
                              <Avatar sx={{ width: 36, height: 36, bgcolor: `rgba(59,130,246,${0.1 + (i*0.05)})`, color: '#2563eb', fontWeight: 800 }}>
                                {initials(u.user_name || u.user_email)}
                              </Avatar>
                              <Box>
                                <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{u.user_name || 'Desconocido'}</Typography>
                                <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{u.user_email || 'Sin correo'}</Typography>
                              </Box>
                            </Stack>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={ROLE_LABELS[u.user_role] || u.user_role} sx={{ fontSize: 10, fontWeight: 800, bgcolor: '#f1f5f9', color: '#475569', borderRadius: 2 }} />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#3b82f6' }}>{Number(u.total_logins).toLocaleString()}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>{fmtTime(u.ultimo_acceso)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Documentos */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={900} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Archivos Más Demandados</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Top de descargas documentales</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topDescargas, `documentos_top_${days}d`, ['Código','Título','Tipo','Descargas'], d => [d.codigo, d.titulo, d.tipo_documento, d.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Documento</HeadCell>
                        <HeadCell>Código</HeadCell>
                        <HeadCell>Tipo</HeadCell>
                        <HeadCell>Descargas</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.topDescargas || data.topDescargas.length === 0) && (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>Sin descargas en este período.</Typography></TableCell></TableRow>
                      )}
                      {data.topDescargas?.map((d, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(16,185,129,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell sx={{ maxWidth: 250 }}>
                            <Typography noWrap sx={{ fontSize: 14, fontWeight: 800, color: '#0f172a' }}>{d.titulo || 'Sin Título'}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>{d.codigo || '—'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={d.tipo_documento || 'N/A'} sx={{ fontSize: 10, fontWeight: 800, bgcolor: '#ecfdf5', color: '#059669', borderRadius: 1.5 }} />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>{Number(d.total).toLocaleString()}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>
          
            {/* Módulos Más Utilizados */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={950} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Módulos Más Utilizados</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Distribución de interacciones por sección</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.byModule, `modulos_${days}d`, ['Módulo','Interacciones'], m => [m.module, m.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Módulo del Sistema</HeadCell>
                        <HeadCell>Total Interacciones</HeadCell>
                        <HeadCell>Frecuencia Relativa</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.byModule || data.byModule.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>Sin datos de módulos.</Typography></TableCell></TableRow>
                      )}
                      {data.byModule?.map((m, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(59,130,246,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{m.module || 'Global'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#3b82f6' }}>{Number(m.total).toLocaleString()}</Typography>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ width: '100%', bgcolor: '#e2e8f0', borderRadius: 5, height: 8, overflow: 'hidden' }}>
                              <Box sx={{ width: `${Math.min(100, (Number(m.total) / (data.totalEvents || 1)) * 100)}%`, bgcolor: '#3b82f6', height: '100%', borderRadius: 5 }} />
                            </Box>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>



            {/* Dependencias con mayor uso */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={1000} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Dependencias con más ingresos</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Conteo de inicios de sesión clasificados por dependencia</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.byDependencia, `dependencias_${days}d`, ['Dependencia','Ingresos'], d => [d.dependencia, d.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Dependencia</HeadCell>
                        <HeadCell>Total Ingresos</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.byDependencia || data.byDependencia.length === 0) && (
                        <TableRow><TableCell colSpan={2} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>Sin datos de dependencias.</Typography></TableCell></TableRow>
                      )}
                      {data.byDependencia?.map((d, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(59,130,246,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{d.dependencia || 'Sin dependencia'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#3b82f6' }}>{Number(d.total).toLocaleString()}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Usuarios con más consultas */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={1020} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Usuarios más Consultores</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Usuarios con mayor número de 'Consultas'</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topConsultingUsers, `consultores_${days}d`, ['Usuario','Consultas'], u => [u.user_name, u.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Usuario</HeadCell>
                        <HeadCell>Total Consultas</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.topConsultingUsers || data.topConsultingUsers.length === 0) && (
                        <TableRow><TableCell colSpan={2} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>Nadie ha realizado consultas.</Typography></TableCell></TableRow>
                      )}
                      {data.topConsultingUsers?.map((u, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(59,130,246,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#1e293b' }}>{u.user_name || 'Desconocido'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#10b981' }}>{Number(u.total).toLocaleString()}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Errores más frecuentes */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={1030} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#9a3412' }}>Errores más frecuentes del sistema</Typography>
                    <Typography sx={{ fontSize: 13, color: '#c2410c' }}>Listado de fallos y errores recurrentes</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topErrors, `errores_${days}d`, ['Error','Endpoint','Eventos'], e => [e.action, e.endpoint, e.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#9a3412', '&:hover': { bgcolor: '#7c2d12' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Descripción del Error</HeadCell>
                        <HeadCell>Endpoint Afectado</HeadCell>
                        <HeadCell>Total de Veces</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.topErrors || data.topErrors.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#10b981' }}>¡Sin errores registrados en este período!</Typography></TableCell></TableRow>
                      )}
                      {data.topErrors?.map((e, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(249,115,22,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#7c2d12' }}>{e.action || 'Desconocido'}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, color: '#ea580c' }}>{e.endpoint || '—'}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#ea580c' }}>{Number(e.total).toLocaleString()}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Vulnerabilidades (Acceso Denegado) */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={1040} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#991b1b' }}>Vulneraciones al sistema</Typography>
                    <Typography sx={{ fontSize: 13, color: '#b91c1c' }}>Intentos de Acceso Denegado bloqueados</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topVulnerabilidades, `vulneraciones_${days}d`, ['Usuario','Email','Dirección IP','Intentos Bloqueados'], v => [v.user_name, v.user_email, v.ip_address, v.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#dc2626', '&:hover': { bgcolor: '#991b1b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Usuario Involucrado</HeadCell>
                        <HeadCell>Dirección IP</HeadCell>
                        <HeadCell>Intentos Bloqueados</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.topVulnerabilidades || data.topVulnerabilidades.length === 0) && (
                        <TableRow><TableCell colSpan={3} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#10b981' }}>¡No se detectaron accesos denegados!</Typography></TableCell></TableRow>
                      )}
                      {data.topVulnerabilidades?.map((v, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(239,68,68,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Typography sx={{ fontSize: 14, fontWeight: 800, color: '#7f1d1d' }}>{v.user_name || 'Desconocido'}</Typography>
                            <Typography sx={{ fontSize: 11, color: '#b91c1c' }}>{v.user_email || 'Sin correo'}</Typography>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, color: '#dc2626', fontWeight: 600 }}>{v.ip_address || '—'}</TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#dc2626' }}>{Number(v.total).toLocaleString()}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Bitácora en Vivo */}
            <Box sx={{ display: 'flex', minWidth: 0 }}>
              <GlassCard delay={1050} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Bitácora Analítica (Log de Auditoría)</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Registro detallado de los últimos 50 eventos</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.recent, `bitacora_${days}d`, ['Usuario','Módulo','Acción','Endpoint','Fecha'], r => [r.user_name||r.user_email, r.module, r.action, r.endpoint, fmtTime(r.created_at)])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Fecha y Hora</HeadCell>
                        <HeadCell>Usuario Operador</HeadCell>
                        <HeadCell>Módulo Afectado</HeadCell>
                        <HeadCell>Acción Registrada</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.recent?.map((r, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(241,245,249,0.8)' }, transition: 'all 0.2s' }}>
                          <TableCell sx={{ fontSize: 12, color: '#64748b', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtTime(r.created_at)}</TableCell>
                          <TableCell>
                            <Stack direction="row" spacing={1.5} alignItems="center">
                              <Avatar sx={{ width: 26, height: 26, fontSize: 11, fontWeight: 800, bgcolor: '#e2e8f0', color: '#475569' }}>
                                {initials(r.user_name || r.user_email)}
                              </Avatar>
                              <Typography sx={{ fontSize: 13, fontWeight: 800, color: '#1e293b' }}>
                                {r.user_name || r.user_email?.split('@')[0] || '—'}
                              </Typography>
                            </Stack>
                          </TableCell>
                          <TableCell sx={{ fontSize: 13, fontWeight: 700, color: '#475569' }}>{r.module || '—'}</TableCell>
                          <TableCell>
                            <Chip size="small" label={r.action || r.method} sx={{ fontSize: 11, fontWeight: 800, bgcolor: `${ACTION_COLORS[r.action] || '#94a3b8'}20`, color: ACTION_COLORS[r.action] || '#475569', borderRadius: 2 }} />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Documentos Inactivos */}
            <Box sx={{ display: 'flex', gridColumn: { lg: '1 / -1' }, minWidth: 0 }}>
              <GlassCard delay={1100} sx={{ width: '100%', height: 420, display: 'flex', flexDirection: 'column', border: '2px solid rgba(239, 68, 68, 0.2)', background: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(254, 242, 242, 0.9))' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(239,68,68,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#991b1b' }}>Auditoría: Documentos Sin Actividad</Typography>
                    <Typography sx={{ fontSize: 13, color: '#b91c1c' }}>Archivos vigentes sin descargas en el período</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.documentosInactivos, `documentos_inactivos_${days}d`, ['Código','Título','Tipo','Autor','Fecha Creación'], d => [d.codigo, d.titulo, d.tipo_documento, d.autor, d.fecha_creacion])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#dc2626', '&:hover': { bgcolor: '#991b1b' }, whiteSpace: 'nowrap' }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, overflow: 'auto' }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Documento y Código</HeadCell>
                        <HeadCell>Tipo</HeadCell>
                        <HeadCell>Autor</HeadCell>
                        <HeadCell>Fecha Creación</HeadCell>
                        <HeadCell align="center">Acciones</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.documentosInactivos || data.documentosInactivos.length === 0) && (
                        <TableRow><TableCell colSpan={5} align="center" sx={{ py: 4 }}><Typography sx={{ fontWeight: 800, color: '#059669' }}>¡Excelente! Todos los documentos tienen actividad.</Typography></TableCell></TableRow>
                      )}
                      {data.documentosInactivos?.map((d, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(239,68,68,0.05)' } }}>
                          <TableCell sx={{ maxWidth: 300 }}>
                            <Typography noWrap sx={{ fontSize: 13, fontWeight: 800, color: '#7f1d1d' }}>{d.titulo || 'Sin Título'}</Typography>
                            <Typography sx={{ fontSize: 11, color: '#b91c1c', fontWeight: 600 }}>{d.codigo || '—'}</Typography>
                          </TableCell>
                          <TableCell>
                            <Chip size="small" label={d.tipo_documento || 'N/A'} sx={{ fontSize: 10, fontWeight: 800, bgcolor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 1.5 }} />
                          </TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#7f1d1d', fontWeight: 700 }}>{d.autor || '—'}</TableCell>
                          <TableCell sx={{ fontSize: 12, color: '#991b1b', fontWeight: 600 }}>{d.fecha_creacion || '—'}</TableCell>
                          <TableCell align="center">
                            <Stack direction="row" spacing={1} justifyContent="center">
                              <Tooltip title="Previsualizar Documento">
                                <span>
                                  <IconButton size="small" disabled={!d.link_acceso} onClick={() => window.open(d.link_acceso, '_blank')} sx={{ color: '#0f172a', bgcolor: 'rgba(0,0,0,0.05)', '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }}>
                                    <VisibilityIcon fontSize="small" />
                                  </IconButton>
                                </span>
                              </Tooltip>
                              <Tooltip title="Descargar Documento">
                                <IconButton size="small" onClick={() => window.open(`${api.defaults.baseURL || 'http://localhost:4000/api'}/documentos/descargar/${d.id}?token=${encodeURIComponent(localStorage.getItem('token') || '')}`, '_self')} sx={{ color: '#0f172a', bgcolor: 'rgba(0,0,0,0.05)', '&:hover': { bgcolor: 'rgba(0,0,0,0.1)' } }}>
                                  <DownloadIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>
          </Box>
        </Stack>
      )}
    </Box>
  );
}
