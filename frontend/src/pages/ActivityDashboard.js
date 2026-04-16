import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Stack, Chip, CircularProgress,
  Select, MenuItem, Table, TableBody, TableCell, TableHead,
  TableRow, TableContainer, Avatar, Tooltip as MuiTooltip,
  FormControl, InputLabel, Alert
} from '@mui/material';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import PeopleRoundedIcon        from '@mui/icons-material/PeopleRounded';
import TodayRoundedIcon         from '@mui/icons-material/TodayRounded';
import InsightsRoundedIcon      from '@mui/icons-material/InsightsRounded';
import BoltRoundedIcon          from '@mui/icons-material/BoltRounded';
import AccessTimeRoundedIcon    from '@mui/icons-material/AccessTimeRounded';
import LoginRoundedIcon         from '@mui/icons-material/LoginRounded';
import api from '../services/api';

/* ── constants ── */
const ROLE_LABELS = {
  administrador:          'Administrador',
  planeacion_estrategica: 'Planeación Est.',
  planeacion_efectividad: 'Planeación y Efectividad',
  autoevaluacion:         'Autoevaluación',
  gestion_informacion:    'Gestión Información',
  gestion_procesos:       'Gestión Procesos',
};

const MODULE_COLORS = [
  '#2563eb','#7c3aed','#0891b2','#10b981','#f59e0b',
  '#ef4444','#ec4899','#14b8a6','#6366f1','#84cc16',
];

const ROLE_COLORS = {
  administrador:          '#2563eb',
  planeacion_estrategica: '#7c3aed',
  planeacion_efectividad: '#0891b2',
  autoevaluacion:         '#10b981',
  gestion_informacion:    '#f59e0b',
  gestion_procesos:       '#ef4444',
};

const fmtTime = (d) => {
  if (!d) return '—';
  const dt = new Date(d);
  return dt.toLocaleString('es-CO', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' });
};

const initials = (name = '') =>
  name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';

/* ── KPI Card ── */
const KpiCard = ({ label, value, icon: Icon, color, sub }) => (
  <Paper elevation={0} sx={{
    p: 2.2, borderRadius: 3, border: `1.5px solid ${color}20`,
    background: `linear-gradient(145deg,#fff 0%,${color}06 100%)`,
    flex: 1, minWidth: 160
  }}>
    <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 1 }}>
      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: `${color}15`,
        display: 'grid', placeItems: 'center' }}>
        <Icon sx={{ fontSize: 20, color }} />
      </Box>
      <Typography sx={{ fontSize: 11.5, fontWeight: 700, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
    </Stack>
    <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
      {value ?? '—'}
    </Typography>
    {sub && <Typography sx={{ fontSize: 11, color: '#94a3b8', mt: 0.5 }}>{sub}</Typography>}
  </Paper>
);

/* ── Section header ── */
const SectionHeader = ({ title, sub }) => (
  <Box sx={{ mb: 2 }}>
    <Typography sx={{ fontWeight: 800, fontSize: 14, color: '#1e293b' }}>{title}</Typography>
    {sub && <Typography sx={{ fontSize: 11.5, color: '#94a3b8' }}>{sub}</Typography>}
  </Box>
);

/* ── Custom tooltip for charts ── */
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <Paper elevation={4} sx={{ p: 1.5, borderRadius: 2, minWidth: 120 }}>
      {label && <Typography sx={{ fontSize: 11, fontWeight: 700, color:'#64748b', mb:0.5 }}>{label}</Typography>}
      {payload.map((p, i) => (
        <Typography key={i} sx={{ fontSize: 12, fontWeight: 700, color: p.color }}>
          {p.name}: {p.value}
        </Typography>
      ))}
    </Paper>
  );
};

/* ════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════ */
export default function ActivityDashboard({ embedded = false }) {
  const [days, setDays]     = useState(30);
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async (d) => {
    setLoading(true); setError(null);
    try {
      const { data: res } = await api.get(`/admin/activity/stats?days=${d}`);
      if (res.success) setData(res.stats);
      else setError(res.message || 'Error al cargar datos.');
    } catch (e) {
      setError(e.response?.data?.message || 'Error de conexión.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(days); }, [days, load]);

  const topModule = data?.byModule?.[0]?.module || '—';

  return (
    <Box sx={{ bgcolor: embedded ? 'transparent' : '#f1f5f9', minHeight: embedded ? 0 : '100vh', pb: embedded ? 0 : 5 }}>

      {/* ── Header (only when standalone) ── */}
      {!embedded && (
        <Box sx={{
          background: 'linear-gradient(135deg,#0f172a 0%,#1e3a5f 60%,#1d4ed8 100%)',
          px: { xs: 2, md: 4 }, py: 3,
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={2}>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                <InsightsRoundedIcon sx={{ color: '#60a5fa', fontSize: 22 }} />
                <Typography sx={{ fontWeight: 900, fontSize: 18, color: '#fff' }}>
                  Monitor de Actividad
                </Typography>
                <Chip label="Admin" size="small" sx={{ bgcolor: '#1d4ed8', color:'#bfdbfe', fontWeight:700, fontSize:10, height:18 }} />
              </Stack>
              <Typography sx={{ fontSize: 12.5, color: 'rgba(203,213,225,0.8)' }}>
                Seguimiento de interacción de usuarios con el sistema
              </Typography>
            </Box>
            <FormControl size="small" sx={{ minWidth: 150 }}>
              <InputLabel sx={{ color: '#94a3b8', fontSize: 12 }}>Período</InputLabel>
              <Select
                value={days}
                label="Período"
                onChange={(e) => setDays(e.target.value)}
                sx={{
                  color: '#fff', fontSize: 13, fontWeight: 700,
                  '.MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.2)' },
                  '.MuiSvgIcon-root': { color: '#94a3b8' },
                  bgcolor: 'rgba(255,255,255,0.06)'
                }}
              >
                {[7,15,30,60,90].map(d => (
                  <MenuItem key={d} value={d}>Últimos {d} días</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Stack>
        </Box>
      )}

      {/* ── Embedded period selector ── */}
      {embedded && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" flexWrap="wrap" gap={1.5} sx={{ mb: 2.5 }}>
          <Stack direction="row" spacing={1} alignItems="center">
            <InsightsRoundedIcon sx={{ color: '#2563eb', fontSize: 20 }} />
            <Typography sx={{ fontWeight: 800, fontSize: 15, color: '#1e293b' }}>
              Estadísticas de uso del sistema
            </Typography>
            <Chip label="Solo Admin" size="small" sx={{ bgcolor: '#eff6ff', color:'#1d4ed8', fontWeight:700, fontSize:10, height:20, border:'1px solid #bfdbfe' }} />
          </Stack>
          <FormControl size="small" sx={{ minWidth: 145 }}>
            <InputLabel sx={{ fontSize: 12 }}>Período</InputLabel>
            <Select value={days} label="Período" onChange={(e) => setDays(e.target.value)} sx={{ fontSize: 13, fontWeight: 700 }}>
              {[7,15,30,60,90].map(d => (
                <MenuItem key={d} value={d}>Últimos {d} días</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      )}

      <Box sx={{ px: embedded ? 0 : { xs: 2, md: 4 }, pt: embedded ? 0 : 3 }}>

        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

        {loading ? (
          <Box sx={{ display:'flex', justifyContent:'center', alignItems:'center', height: 320 }}>
            <Stack alignItems="center" spacing={2}>
              <CircularProgress size={44} thickness={3} />
              <Typography sx={{ color:'#64748b', fontSize:13 }}>Cargando estadísticas...</Typography>
            </Stack>
          </Box>
        ) : data && (
          <>
            {/* ── KPIs ── */}
            <Stack direction={{ xs:'column', sm:'row' }} spacing={2} sx={{ mb: 3 }} flexWrap="wrap" useFlexGap>
              <KpiCard label="Total Eventos"        value={data.totalEvents?.toLocaleString()}   color="#2563eb" icon={InsightsRoundedIcon} sub={`Últimos ${days} días`} />
              <KpiCard label="Eventos Hoy"          value={data.todayEvents?.toLocaleString()}   color="#7c3aed" icon={TodayRoundedIcon}    sub="Desde las 00:00 h" />
              <KpiCard label="Inicios de Sesión"    value={data.loginEvents?.toLocaleString()}   color="#0891b2" icon={LoginRoundedIcon}    sub={`Últimos ${days} días`} />
              <KpiCard label="Usuarios Activos"     value={data.activeUsers7d?.toLocaleString()} color="#10b981" icon={PeopleRoundedIcon}   sub="Últimos 7 días" />
              <KpiCard label="Módulo Más Usado"     value={topModule}                            color="#f59e0b" icon={BoltRoundedIcon}     sub={`${data.byModule?.[0]?.total ?? 0} eventos`} />
            </Stack>

            {/* ── Actividad por día + módulo ── */}
            <Box sx={{ display:'grid', gap:2.5, gridTemplateColumns:{ xs:'1fr', lg:'1.6fr 1fr' }, mb:2.5 }}>

              {/* Area chart — eventos por día */}
              <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:'1px solid #e2e8f0' }}>
                <SectionHeader title="Eventos por Día" sub={`Actividad de los últimos ${days} días`} />
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={data.byDay} margin={{ top:4, right:8, bottom:0, left:-20 }}>
                    <defs>
                      <linearGradient id="colorEvts" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor="#2563eb" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#2563eb" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="date" tick={{ fontSize:10, fill:'#94a3b8' }} tickFormatter={v => v?.slice(5)} />
                    <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} allowDecimals={false} />
                    <Tooltip content={<ChartTip />} />
                    <Area type="monotone" dataKey="total" name="Eventos" stroke="#2563eb" strokeWidth={2}
                      fill="url(#colorEvts)" dot={false} activeDot={{ r:4, fill:'#2563eb' }} />
                  </AreaChart>
                </ResponsiveContainer>
              </Paper>

              {/* Pie chart — por rol */}
              <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:'1px solid #e2e8f0' }}>
                <SectionHeader title="Distribución por Rol" sub="Proporción de uso según rol" />
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={data.byRole}
                      dataKey="total"
                      nameKey="user_role"
                      cx="50%" cy="50%"
                      innerRadius={55} outerRadius={85}
                      paddingAngle={3}
                    >
                      {data.byRole.map((entry, i) => (
                        <Cell key={i} fill={ROLE_COLORS[entry.user_role] || MODULE_COLORS[i % MODULE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v, n) => [v, ROLE_LABELS[n] || n]} />
                    <Legend formatter={(v) => ROLE_LABELS[v] || v} iconSize={10}
                      wrapperStyle={{ fontSize:11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </Paper>
            </Box>

            {/* ── Bar chart módulos ── */}
            <Paper elevation={0} sx={{ p:2.5, borderRadius:3, border:'1px solid #e2e8f0', mb:2.5 }}>
              <SectionHeader title="Uso por Módulo" sub="Módulos más accedidos en el período" />
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data.byModule} margin={{ top:4, right:8, bottom:24, left:-20 }} barSize={28}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="module" tick={{ fontSize:10, fill:'#94a3b8' }} angle={-20} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize:10, fill:'#94a3b8' }} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="total" name="Eventos" radius={[4,4,0,0]}>
                    {data.byModule.map((_, i) => (
                      <Cell key={i} fill={MODULE_COLORS[i % MODULE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Paper>

            {/* ── Top usuarios ── */}
            <Paper elevation={0} sx={{ borderRadius:3, border:'1px solid #e2e8f0', mb:2.5, overflow:'hidden' }}>
              <Box sx={{ px:2.5, py:1.8, borderBottom:'1px solid #f1f5f9', bgcolor:'#f8fafc',
                display:'flex', alignItems:'center', gap:1.2 }}>
                <PeopleRoundedIcon sx={{ fontSize:18, color:'#2563eb' }} />
                <Box>
                  <Typography sx={{ fontWeight:800, fontSize:13, color:'#1e293b' }}>Usuarios más Activos</Typography>
                  <Typography sx={{ fontSize:11, color:'#94a3b8' }}>Top 10 por eventos en el período</Typography>
                </Box>
              </Box>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ bgcolor:'#f8fafc' }}>
                      {['#','Usuario','Correo','Rol','Eventos','Última actividad'].map(h => (
                        <TableCell key={h} sx={{ fontWeight:800, fontSize:10.5, color:'#64748b',
                          textTransform:'uppercase', letterSpacing:'0.04em', py:1 }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.topUsers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign:'center', py:3, color:'#94a3b8' }}>
                          Sin datos para el período seleccionado.
                        </TableCell>
                      </TableRow>
                    )}
                    {data.topUsers.map((u, i) => (
                      <TableRow key={i} sx={{ '&:hover':{ bgcolor:'#f8fafc' } }}>
                        <TableCell sx={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>{i+1}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Avatar sx={{ width:26, height:26, fontSize:11, fontWeight:700,
                              bgcolor: ROLE_COLORS[u.user_role] || '#2563eb' }}>
                              {initials(u.user_name || u.user_email || '?')}
                            </Avatar>
                            <Typography sx={{ fontSize:12.5, fontWeight:700, color:'#1e293b' }}>
                              {u.user_name || '—'}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontSize:11.5, color:'#475569' }}>{u.user_email || '—'}</TableCell>
                        <TableCell>
                          <Chip size="small" label={ROLE_LABELS[u.user_role] || u.user_role || '—'}
                            sx={{ fontSize:10, fontWeight:700, height:18,
                              bgcolor: `${ROLE_COLORS[u.user_role] || '#2563eb'}18`,
                              color:    ROLE_COLORS[u.user_role] || '#2563eb' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize:13, fontWeight:900, color:'#2563eb' }}>
                          {Number(u.total).toLocaleString()}
                        </TableCell>
                        <TableCell sx={{ fontSize:11.5, color:'#64748b', whiteSpace:'nowrap' }}>
                          {fmtTime(u.ultima_actividad)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>

            {/* ── Actividad reciente ── */}
            <Paper elevation={0} sx={{ borderRadius:3, border:'1px solid #e2e8f0', overflow:'hidden' }}>
              <Box sx={{ px:2.5, py:1.8, borderBottom:'1px solid #f1f5f9', bgcolor:'#f8fafc',
                display:'flex', alignItems:'center', gap:1.2 }}>
                <AccessTimeRoundedIcon sx={{ fontSize:18, color:'#7c3aed' }} />
                <Box>
                  <Typography sx={{ fontWeight:800, fontSize:13, color:'#1e293b' }}>Actividad Reciente</Typography>
                  <Typography sx={{ fontSize:11, color:'#94a3b8' }}>Últimos 50 eventos registrados</Typography>
                </Box>
              </Box>
              <TableContainer sx={{ maxHeight:380 }}>
                <Table stickyHeader size="small">
                  <TableHead>
                    <TableRow>
                      {['#','Usuario','Rol','Módulo','Acción','Fecha y Hora'].map(h => (
                        <TableCell key={h} sx={{ fontWeight:800, fontSize:10.5, color:'#64748b',
                          bgcolor:'#f8fafc', textTransform:'uppercase', letterSpacing:'0.04em',
                          py:1, whiteSpace:'nowrap' }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {data.recent.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ textAlign:'center', py:3, color:'#94a3b8' }}>
                          Sin actividad registrada.
                        </TableCell>
                      </TableRow>
                    )}
                    {data.recent.map((r, i) => (
                      <TableRow key={i} sx={{ '&:hover':{ bgcolor:'#f8fafc' } }}>
                        <TableCell sx={{ fontSize:11, color:'#94a3b8', fontWeight:600 }}>{i+1}</TableCell>
                        <TableCell>
                          <MuiTooltip title={r.user_email || ''}>
                            <Stack direction="row" spacing={0.8} alignItems="center">
                              <Avatar sx={{ width:22, height:22, fontSize:9, fontWeight:700,
                                bgcolor: ROLE_COLORS[r.user_role] || '#64748b' }}>
                                {initials(r.user_name || r.user_email || '?')}
                              </Avatar>
                              <Typography sx={{ fontSize:12, fontWeight:700, color:'#334155' }}>
                                {r.user_name || r.user_email || '—'}
                              </Typography>
                            </Stack>
                          </MuiTooltip>
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={ROLE_LABELS[r.user_role] || r.user_role || '—'}
                            sx={{ fontSize:9.5, fontWeight:700, height:16,
                              bgcolor:`${ROLE_COLORS[r.user_role]||'#64748b'}18`,
                              color: ROLE_COLORS[r.user_role] || '#64748b' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize:11.5, fontWeight:700, color:'#1e293b', whiteSpace:'nowrap' }}>
                          {r.module || '—'}
                        </TableCell>
                        <TableCell>
                          <Chip size="small" label={r.action || r.method || '—'}
                            sx={{ fontSize:9.5, fontWeight:600, height:16,
                              bgcolor:'#f1f5f9', color:'#475569' }} />
                        </TableCell>
                        <TableCell sx={{ fontSize:11, color:'#64748b', whiteSpace:'nowrap' }}>
                          {fmtTime(r.created_at)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </>
        )}
      </Box>
    </Box>
  );
}
