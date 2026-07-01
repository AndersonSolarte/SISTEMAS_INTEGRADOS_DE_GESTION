import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Typography, Stack, CircularProgress, Chip,
  Select, MenuItem, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Avatar, Tooltip,
  FormControl, InputLabel, Alert, Button, Switch, FormControlLabel,
  Paper, Grid, IconButton, Fade, Zoom
} from '@mui/material';
import {
  AreaChart, Area, PieChart, Pie, Cell, ResponsiveContainer, 
  Tooltip as RechartsTooltip, Legend, CartesianGrid, XAxis, YAxis
} from 'recharts';

import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import PeopleRoundedIcon from '@mui/icons-material/PeopleRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import FileDownloadRoundedIcon from '@mui/icons-material/FileDownloadRounded';
import WarningRoundedIcon from '@mui/icons-material/WarningRounded';
import RefreshIcon from '@mui/icons-material/Refresh';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import api from '../services/api';

/* ── Constants ── */
const ROLE_LABELS = {
  administrador:          'Administrador',
  planeacion_estrategica: 'Planeación Est.',
  planeacion_efectividad: 'Planeación y Efectividad',
  autoevaluacion:         'Autoevaluación',
  gestion_informacion:    'Gestión Información',
  gestion_procesos:       'Gestión Procesos',
};

const MODULE_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

const ACTION_COLORS = {
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
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Evolución de Actividad</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Volumen de interacciones a lo largo del período seleccionado</Typography>
                  </Box>
                </Box>
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={data.byDay} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
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
                    <Area type="monotone" dataKey="total" name="Interacciones" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorTotal)" />
                  </AreaChart>
                </ResponsiveContainer>
              </GlassCard>
            </Box>
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={700} sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Distribución de Tareas</Typography>
                  <Typography sx={{ fontSize: 13, color: '#64748b' }}>¿Qué acciones realizan más los usuarios?</Typography>
                </Box>
                <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ResponsiveContainer width="100%" height={320}>
                    <PieChart>
                      <Pie
                        data={data.byAction} dataKey="total" nameKey="action"
                        cx="50%" cy="45%" innerRadius={70} outerRadius={100} paddingAngle={5} stroke="none"
                      >
                        {data.byAction?.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={ACTION_COLORS[entry.action] || MODULE_COLORS[index % MODULE_COLORS.length]} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)', fontWeight: 700 }}
                        itemStyle={{ color: '#0f172a', fontWeight: 900 }}
                      />
                      <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: 13, fontWeight: 700 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              </GlassCard>
            </Box>
          </Box>

          {/* ── Premium Data Tables ── */}
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'repeat(2, 1fr)' }, gap: 3 }}>
            {/* Ranking de Usuarios */}
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={800} sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Directorio de Usuarios</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Nombre, Correo y Rol de acceso</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topLogins, `usuarios_${days}d`, ['Nombre','Correo','Rol','Accesos','Último Acceso'], u => [u.user_name, u.user_email, ROLE_LABELS[u.user_role]||u.user_role, u.total_logins, fmtTime(u.ultimo_acceso)])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, minHeight: 250, maxHeight: 400 }}>
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
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={900} sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Archivos Más Demandados</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Top de descargas documentales</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topDescargas, `documentos_top_${days}d`, ['Código','Título','Tipo','Descargas'], d => [d.codigo, d.titulo, d.tipo_documento, d.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, minHeight: 250, maxHeight: 400 }}>
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
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={950} sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Módulos Más Utilizados</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Distribución de interacciones por sección</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.byModule, `modulos_${days}d`, ['Módulo','Interacciones'], m => [m.module, m.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, minHeight: 250, maxHeight: 400 }}>
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

            {/* Términos de Búsqueda */}
            <Box sx={{ display: 'flex' }}>
              <GlassCard delay={1000} sx={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Términos de Búsqueda Frecuentes</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>¿Qué buscan los usuarios?</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.topBusquedas, `busquedas_${days}d`, ['Término','Búsquedas'], b => [b.term, b.total])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar CSV
                  </Button>
                </Box>
                <TableContainer sx={{ flexGrow: 1, minHeight: 250, maxHeight: 400 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Término Buscado</HeadCell>
                        <HeadCell>Total de Consultas</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.topBusquedas || data.topBusquedas.length === 0) && (
                        <TableRow><TableCell colSpan={2} align="center" sx={{ py: 5 }}><Typography sx={{ fontWeight: 700, color: '#94a3b8' }}>Sin búsquedas registradas.</Typography></TableCell></TableRow>
                      )}
                      {data.topBusquedas?.map((b, i) => (
                        <TableRow key={i} sx={{ '&:hover': { bgcolor: 'rgba(139,92,246,0.05)' }, transition: 'all 0.2s' }}>
                          <TableCell>
                            <Chip size="small" label={`"${b.term}"`} sx={{ fontSize: 12, fontWeight: 800, bgcolor: '#f3e8ff', color: '#7c3aed', borderRadius: 1.5 }} />
                          </TableCell>
                          <TableCell>
                            <Typography sx={{ fontSize: 16, fontWeight: 900, color: '#8b5cf6' }}>{Number(b.total).toLocaleString()}</Typography>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </GlassCard>
            </Box>

            {/* Bitácora en Vivo */}
            <Box>
              <GlassCard delay={1050} sx={{ display: 'flex', flexDirection: 'column' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#0f172a' }}>Bitácora Analítica (Log de Auditoría)</Typography>
                    <Typography sx={{ fontSize: 13, color: '#64748b' }}>Registro detallado de los últimos 50 eventos</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.recent, `bitacora_${days}d`, ['Usuario','Módulo','Acción','Endpoint','Fecha'], r => [r.user_name||r.user_email, r.module, r.action, r.endpoint, fmtTime(r.created_at)])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#0f172a', '&:hover': { bgcolor: '#1e293b' } }}>
                    Exportar Auditoría Completa
                  </Button>
                </Box>
                <TableContainer sx={{ maxHeight: 400 }}>
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
            <Box>
              <GlassCard delay={1100} sx={{ border: '2px solid rgba(239, 68, 68, 0.2)', background: 'linear-gradient(to right, rgba(255, 255, 255, 0.9), rgba(254, 242, 242, 0.9))' }}>
                <Box sx={{ p: 3, borderBottom: '1px solid rgba(239,68,68,0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#991b1b' }}>Auditoría: Documentos Sin Actividad</Typography>
                    <Typography sx={{ fontSize: 13, color: '#b91c1c' }}>Archivos vigentes sin descargas en el período</Typography>
                  </Box>
                  <Button size="small" variant="contained" onClick={() => exportCSV(data.documentosInactivos, `documentos_inactivos_${days}d`, ['Código','Título','Tipo','Autor','Fecha Creación'], d => [d.codigo, d.titulo, d.tipo_documento, d.autor, d.fecha_creacion])} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, bgcolor: '#dc2626', '&:hover': { bgcolor: '#991b1b' } }}>
                    Descargar Reporte Crítico
                  </Button>
                </Box>
                <TableContainer sx={{ maxHeight: 350 }}>
                  <Table stickyHeader>
                    <TableHead>
                      <TableRow>
                        <HeadCell>Documento y Código</HeadCell>
                        <HeadCell>Tipo</HeadCell>
                        <HeadCell>Autor</HeadCell>
                        <HeadCell>Fecha Creación</HeadCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {(!data.documentosInactivos || data.documentosInactivos.length === 0) && (
                        <TableRow><TableCell colSpan={4} align="center" sx={{ py: 4 }}><Typography sx={{ fontWeight: 800, color: '#059669' }}>¡Excelente! Todos los documentos tienen actividad.</Typography></TableCell></TableRow>
                      )}
                      {data.documentosInactivos?.slice(0, 100).map((d, i) => (
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
