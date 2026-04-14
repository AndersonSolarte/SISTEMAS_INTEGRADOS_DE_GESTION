import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fade,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  AutoGraph as AutoGraphIcon,
  Clear as ClearIcon,
  FilterAlt as FilterAltIcon,
  Search as SearchIcon,
  WorkspacePremium as WorkspacePremiumIcon
} from '@mui/icons-material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { useSnackbar } from 'notistack';
import documentoService from '../services/documentoService';
import catalogoService from '../services/catalogoService';

const CHART_COLORS = ['#2563eb', '#0f766e', '#dc2626', '#7c3aed', '#0891b2', '#ca8a04', '#475569', '#16a34a'];

const emptyData = {
  periodosDisponibles: [],
  resumen: {
    totalDocumentos: 0,
    totalTipos: 0,
    totalMacroProcesos: 0,
    periodoSeleccionado: 'Todos',
    tipoMasFrecuente: null,
    macroMasFrecuente: null
  },
  distribucion: {
    porTipoDocumento: [],
    porMacroProceso: []
  }
};

function CompactFilter({ label, options = [], value, onChange, disabled, placeholder = 'Buscar...' }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const handler = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const selected = options.find((item) => String(item.value) === String(value));
  const filteredOptions = options.filter((item) =>
    String(item.label || '').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Box ref={ref} sx={{ position: 'relative', opacity: disabled ? 0.55 : 1, pointerEvents: disabled ? 'none' : 'auto' }}>
      <Box
        onClick={() => setOpen((prev) => !prev)}
        sx={{
          minHeight: 54,
          px: 1.5,
          py: 1,
          borderRadius: 2,
          bgcolor: selected ? '#e0f2fe' : '#ffffff',
          border: `1.5px solid ${selected ? '#0891b2' : '#dbe6f5'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          cursor: 'pointer',
          transition: 'all 0.18s ease',
          '&:hover': { borderColor: '#0891b2', bgcolor: selected ? '#bae6fd' : '#f8fafc' }
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 10, fontWeight: 900, color: '#0f766e', letterSpacing: 0.6, textTransform: 'uppercase' }}>
            {label}
          </Typography>
          <Typography sx={{ mt: 0.2, fontSize: 13, fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected?.label || 'Todos'}
          </Typography>
        </Box>
        <Box sx={{ color: '#0891b2', fontWeight: 900, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s ease' }}>
          ▾
        </Box>
      </Box>

      {open && (
        <Box
          sx={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            zIndex: 1500,
            width: '100%',
            minWidth: 260,
            bgcolor: '#fff',
            borderRadius: 2,
            border: '1px solid #dbe6f5',
            boxShadow: '0 16px 38px rgba(15, 23, 42, 0.16)',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ p: 1.2, borderBottom: '1px solid #eef2f7' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1, py: 0.8, borderRadius: 1.5, bgcolor: '#f8fafc', border: '1px solid #e2e8f0' }}>
              <SearchIcon sx={{ fontSize: 16, color: '#94a3b8' }} />
              <input
                autoFocus
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={placeholder}
                style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, minWidth: 0, fontSize: 12, color: '#334155' }}
              />
            </Box>
          </Box>
          <Box sx={{ maxHeight: 260, overflowY: 'auto', p: 0.7 }}>
            <Box
              onClick={() => { onChange(''); setOpen(false); setSearch(''); }}
              sx={{
                px: 1.2,
                py: 1,
                borderRadius: 1.5,
                fontSize: 13,
                fontWeight: value ? 600 : 900,
                color: value ? '#334155' : '#0f766e',
                cursor: 'pointer',
                '&:hover': { bgcolor: '#f0fdfa' }
              }}
            >
              Todos
            </Box>
            {filteredOptions.map((item) => {
              const active = String(item.value) === String(value);
              return (
                <Box
                  key={item.value}
                  onClick={() => { onChange(item.value); setOpen(false); setSearch(''); }}
                  sx={{
                    mt: 0.3,
                    px: 1.2,
                    py: 1,
                    borderRadius: 1.5,
                    fontSize: 13,
                    fontWeight: active ? 900 : 600,
                    color: active ? '#075985' : '#334155',
                    bgcolor: active ? '#e0f2fe' : '#fff',
                    cursor: 'pointer',
                    '&:hover': { bgcolor: active ? '#bae6fd' : '#f8fafc' }
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
            {filteredOptions.length === 0 && (
              <Typography sx={{ px: 1.2, py: 1.4, color: '#64748b', fontSize: 13 }}>
                Sin resultados.
              </Typography>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}

function KpiCard({ label, value, helper, tone = '#2563eb' }) {
  return (
    <Paper elevation={0} sx={{ p: 2.2, height: '100%', borderRadius: 2.5, border: '1px solid #dbe6f5', bgcolor: '#ffffff' }}>
      <Typography sx={{ color: '#475569', fontSize: 11, fontWeight: 900, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {label}
      </Typography>
      <Typography sx={{ color: '#0f172a', fontSize: { xs: 28, md: 34 }, lineHeight: 1.1, fontWeight: 950, mt: 0.7 }}>
        {value}
      </Typography>
      {helper && (
        <Typography sx={{ mt: 0.8, color: tone, fontWeight: 800, fontSize: 12 }}>
          {helper}
        </Typography>
      )}
    </Paper>
  );
}

function RankingList({ title, rows = [], nameKey }) {
  const max = Math.max(...rows.map((row) => Number(row.cantidad || 0)), 1);
  return (
    <Paper elevation={0} sx={{ p: 2.4, height: '100%', borderRadius: 2.5, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
      <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 18, mb: 1.7 }}>
        {title}
      </Typography>
      <Stack spacing={1.3}>
        {rows.slice(0, 6).map((row, index) => {
          const pct = Math.round((Number(row.cantidad || 0) / max) * 100);
          return (
            <Box key={`${row[nameKey]}-${index}`}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                <Typography sx={{ color: '#1e293b', fontWeight: 800, fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {index + 1}. {row[nameKey]}
                </Typography>
                <Chip size="small" label={row.cantidad} sx={{ bgcolor: '#e0f2fe', color: '#075985', fontWeight: 900, height: 24 }} />
              </Stack>
              <Box sx={{ mt: 0.7, height: 7, borderRadius: 99, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: CHART_COLORS[index % CHART_COLORS.length], borderRadius: 99 }} />
              </Box>
            </Box>
          );
        })}
        {rows.length === 0 && <Alert severity="info">Sin datos para mostrar.</Alert>}
      </Stack>
    </Paper>
  );
}

export function EstadisticaDocumentalPanel({ embedded = false }) {
  const { enqueueSnackbar } = useSnackbar();
  const [filters, setFilters] = useState({ macro_proceso_id: '', tipo_documentacion_id: '', periodo: '' });
  const [macroProcesos, setMacroProcesos] = useState([]);
  const [tiposDocumentacion, setTiposDocumentacion] = useState([]);
  const [data, setData] = useState(emptyData);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  const loadCatalogs = useCallback(async () => {
    const [macroRes, tipoRes] = await Promise.all([
      catalogoService.getMacroProcesos(),
      catalogoService.getTiposDocumentacion()
    ]);
    setMacroProcesos(macroRes?.data?.macroProcesos || []);
    setTiposDocumentacion(tipoRes?.data?.tipos || []);
  }, []);

  const loadDashboard = useCallback(async (currentFilters) => {
    setLoading(true);
    try {
      const response = await documentoService.getEstadisticaDocumental(currentFilters);
      setData(response?.data || emptyData);
    } catch (error) {
      enqueueSnackbar(error?.response?.data?.message || 'No se pudo cargar la estadística documental', { variant: 'error' });
      setData(emptyData);
    } finally {
      setLoading(false);
      setInitialLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    const initialFilters = { macro_proceso_id: '', tipo_documentacion_id: '', periodo: '' };
    Promise.all([loadCatalogs(), loadDashboard(initialFilters)]).catch(() => {
      setInitialLoading(false);
    });
  }, [loadCatalogs, loadDashboard]);

  const handleSearch = () => loadDashboard(filters);
  const handleClear = () => {
    const clean = { macro_proceso_id: '', tipo_documentacion_id: '', periodo: '' };
    setFilters(clean);
    loadDashboard(clean);
  };

  const macroOptions = useMemo(() => macroProcesos.map((item) => ({ value: item.id, label: item.nombre })), [macroProcesos]);
  const tipoOptions = useMemo(() => tiposDocumentacion.map((item) => ({ value: item.id, label: item.nombre })), [tiposDocumentacion]);
  const periodoOptions = useMemo(
    () => (data?.periodosDisponibles || []).map((item) => ({ value: item.value, label: `${item.label} (${item.cantidad})` })),
    [data?.periodosDisponibles]
  );

  const resumen = data?.resumen || emptyData.resumen;
  const tipos = data?.distribucion?.porTipoDocumento || [];
  const macros = data?.distribucion?.porMacroProceso || [];
  const topTipos = tipos.slice(0, 10);
  const total = Number(resumen.totalDocumentos || 0);
  const topTipo = resumen?.tipoMasFrecuente;
  const topMacro = resumen?.macroMasFrecuente;
  const topTipoPct = total > 0 && topTipo?.cantidad ? Math.round((Number(topTipo.cantidad) / total) * 100) : 0;
  const topMacroPct = total > 0 && topMacro?.cantidad ? Math.round((Number(topMacro.cantidad) / total) * 100) : 0;

  const activeChips = [
    filters.macro_proceso_id && {
      key: 'macro',
      label: macroOptions.find((item) => String(item.value) === String(filters.macro_proceso_id))?.label,
      onDelete: () => setFilters((prev) => ({ ...prev, macro_proceso_id: '' }))
    },
    filters.tipo_documentacion_id && {
      key: 'tipo',
      label: tipoOptions.find((item) => String(item.value) === String(filters.tipo_documentacion_id))?.label,
      onDelete: () => setFilters((prev) => ({ ...prev, tipo_documentacion_id: '' }))
    },
    filters.periodo && {
      key: 'periodo',
      label: periodoOptions.find((item) => String(item.value) === String(filters.periodo))?.label,
      onDelete: () => setFilters((prev) => ({ ...prev, periodo: '' }))
    }
  ].filter(Boolean);

  const content = (
    <Box sx={{ pb: 2 }}>
      <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, mb: 3, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff' }}>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
          <FilterAltIcon sx={{ color: '#0f766e' }} />
          <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 18 }}>Filtros del dashboard</Typography>
        </Stack>
        <Grid container spacing={1.5}>
          <Grid item xs={12} md={4}>
            <CompactFilter label="Macroproceso" options={macroOptions} value={filters.macro_proceso_id} onChange={(value) => setFilters((prev) => ({ ...prev, macro_proceso_id: value }))} disabled={loading} placeholder="Buscar macroproceso..." />
          </Grid>
          <Grid item xs={12} md={4}>
            <CompactFilter label="Tipo de documento" options={tipoOptions} value={filters.tipo_documentacion_id} onChange={(value) => setFilters((prev) => ({ ...prev, tipo_documentacion_id: value }))} disabled={loading} placeholder="Buscar tipo..." />
          </Grid>
          <Grid item xs={12} md={4}>
            <CompactFilter label="Periodo académico" options={periodoOptions} value={filters.periodo} onChange={(value) => setFilters((prev) => ({ ...prev, periodo: value }))} disabled={loading} placeholder="Buscar periodo..." />
          </Grid>
        </Grid>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} alignItems={{ xs: 'stretch', md: 'center' }} sx={{ mt: 2 }}>
          <Button variant="contained" startIcon={<SearchIcon />} onClick={handleSearch} disabled={loading} sx={{ minHeight: 46, flex: 1, borderRadius: 2, fontWeight: 900, textTransform: 'none', bgcolor: '#0f766e', '&:hover': { bgcolor: '#0d9488' } }}>
            Aplicar filtros
          </Button>
          <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClear} disabled={loading} sx={{ minHeight: 46, flex: 1, borderRadius: 2, fontWeight: 900, textTransform: 'none', color: '#0f766e', borderColor: '#99f6e4', bgcolor: '#f0fdfa', '&:hover': { bgcolor: '#ccfbf1', borderColor: '#5eead4' } }}>
            Limpiar filtros
          </Button>
        </Stack>
        {activeChips.length > 0 && (
          <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 1.6 }}>
            {activeChips.map((chip) => (
              <Chip key={chip.key} size="small" label={chip.label} onDelete={chip.onDelete} sx={{ bgcolor: '#f0fdfa', color: '#0f766e', border: '1px solid #99f6e4', fontWeight: 800 }} />
            ))}
          </Stack>
        )}
      </Paper>

      {loading && initialLoading ? (
        <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 6, textAlign: 'center' }}>
          <CircularProgress />
          <Typography sx={{ mt: 2, color: '#64748b' }}>Cargando dashboard...</Typography>
        </Paper>
      ) : (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Total documentos" value={resumen.totalDocumentos} helper="Documentos en el alcance actual" tone="#0f766e" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Tipos activos" value={resumen.totalTipos} helper="Categorías con registros" tone="#2563eb" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Macroprocesos" value={resumen.totalMacroProcesos} helper="Frentes institucionales" tone="#dc2626" />
            </Grid>
            <Grid item xs={12} sm={6} lg={3}>
              <KpiCard label="Periodo" value={resumen.periodoSeleccionado} helper="Filtro temporal aplicado" tone="#7c3aed" />
            </Grid>
          </Grid>

          <Grid container spacing={2.5} sx={{ mb: 3 }}>
            <Grid item xs={12} xl={8}>
              <Paper elevation={0} sx={{ p: { xs: 2, md: 2.5 }, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: { xs: 520, md: 560 } }}>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                  <AutoGraphIcon sx={{ color: '#2563eb' }} />
                  <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 20 }}>Documentos por tipo</Typography>
                </Stack>
                {topTipos.length === 0 ? (
                  <Alert severity="info">No hay información para los filtros seleccionados.</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height="90%">
                    <BarChart data={topTipos} layout="vertical" margin={{ top: 10, right: 36, left: 20, bottom: 10 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#475569', fontSize: 12 }} allowDecimals={false} />
                      <YAxis type="category" dataKey="tipo_documento" width={190} tick={{ fill: '#0f172a', fontSize: 12, fontWeight: 700 }} tickFormatter={(value) => (String(value).length > 26 ? `${String(value).slice(0, 26)}...` : value)} />
                      <Tooltip formatter={(value) => [`${value} documentos`, 'Cantidad']} />
                      <Bar dataKey="cantidad" radius={[0, 8, 8, 0]} barSize={24}>
                        {topTipos.map((entry, index) => (
                          <Cell key={`bar-${entry.tipo_documento}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>

            <Grid item xs={12} xl={4}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6} xl={12}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#ffffff' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                      <WorkspacePremiumIcon sx={{ color: '#0f766e' }} />
                      <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 18 }}>Tipo líder</Typography>
                    </Stack>
                    <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 20, lineHeight: 1.25 }}>{topTipo?.tipo_documento || 'N/A'}</Typography>
                    <Typography sx={{ mt: 1, color: '#64748b', fontWeight: 700 }}>{topTipo?.cantidad || 0} documentos · {topTipoPct}% del total filtrado</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12} md={6} xl={12}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#ffffff' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.2 }}>
                      <WorkspacePremiumIcon sx={{ color: '#dc2626' }} />
                      <Typography sx={{ fontWeight: 950, color: '#0f172a', fontSize: 18 }}>Macroproceso líder</Typography>
                    </Stack>
                    <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 20, lineHeight: 1.25 }}>{topMacro?.macro_proceso || 'N/A'}</Typography>
                    <Typography sx={{ mt: 1, color: '#64748b', fontWeight: 700 }}>{topMacro?.cantidad || 0} documentos · {topMacroPct}% del total filtrado</Typography>
                  </Paper>
                </Grid>
                <Grid item xs={12}>
                  <RankingList title="Ranking por macroproceso" rows={macros} nameKey="macro_proceso" />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={5}>
              <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #dbe6f5', bgcolor: '#fff', height: 420 }}>
                <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 20, mb: 1.5 }}>Distribución por macroproceso</Typography>
                {macros.length === 0 ? (
                  <Alert severity="info">Sin datos.</Alert>
                ) : (
                  <ResponsiveContainer width="100%" height="88%">
                    <PieChart>
                      <Pie data={macros} dataKey="cantidad" nameKey="macro_proceso" innerRadius={78} outerRadius={120} paddingAngle={2}>
                        {macros.map((item, index) => (
                          <Cell key={`macro-pie-${item.macro_proceso}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} documentos`, 'Cantidad']} />
                      <Legend verticalAlign="bottom" height={40} iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </Paper>
            </Grid>
            <Grid item xs={12} lg={7}>
              <RankingList title="Tipos documentales más usados" rows={tipos} nameKey="tipo_documento" />
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );

  if (embedded) return content;
  return (
    <Fade in={true}>
      <Box>
        <Paper elevation={0} sx={{ mb: 3, p: { xs: 2.5, md: 3.5 }, borderRadius: 3, border: '1px solid #d7e3f5', background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 48%, #be123c 100%)', color: 'white' }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
            <Box sx={{ width: 76, height: 76, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.42)' }}>
              <AnalyticsIcon sx={{ fontSize: 38 }} />
            </Box>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 950, letterSpacing: 0.2, fontSize: { xs: 25, md: 34 } }}>Estadística Documental</Typography>
              <Typography sx={{ mt: 0.8, color: 'rgba(255,255,255,0.9)', fontSize: { xs: 14, md: 16 } }}>
                Lectura ejecutiva de volumen, concentración documental y macroprocesos con mayor carga institucional.
              </Typography>
            </Box>
          </Stack>
        </Paper>
        {content}
      </Box>
    </Fade>
  );
}

export default EstadisticaDocumentalPanel;
