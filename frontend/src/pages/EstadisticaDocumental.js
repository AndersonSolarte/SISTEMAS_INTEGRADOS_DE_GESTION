import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Fade,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography
} from '@mui/material';
import {
  Analytics as AnalyticsIcon,
  AutoGraph as AutoGraphIcon,
  Clear as ClearIcon,
  FilterAlt as FilterAltIcon,
  Search as SearchIcon
} from '@mui/icons-material';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSnackbar } from 'notistack';
import documentoService from '../services/documentoService';
import catalogoService from '../services/catalogoService';

const CHART_COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#0ea5e9', '#0284c7', '#0369a1'];

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

export function EstadisticaDocumentalPanel({ embedded = false }) {
  const { enqueueSnackbar } = useSnackbar();
  const [filters, setFilters] = useState({
    macro_proceso_id: '',
    tipo_documentacion_id: '',
    periodo: ''
  });
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

  const handleSearch = () => {
    loadDashboard(filters);
  };

  const handleClear = () => {
    const clean = { macro_proceso_id: '', tipo_documentacion_id: '', periodo: '' };
    setFilters(clean);
    loadDashboard(clean);
  };

  const topTipos = useMemo(
    () => (data?.distribucion?.porTipoDocumento || []).slice(0, 8),
    [data]
  );

  const resumen = data?.resumen || emptyData.resumen;
  const topTipoNombre = resumen?.tipoMasFrecuente?.tipo_documento || 'N/A';
  const topTipoCantidad = resumen?.tipoMasFrecuente?.cantidad || 0;
  const topMacroNombre = resumen?.macroMasFrecuente?.macro_proceso || 'N/A';
  const topMacroCantidad = resumen?.macroMasFrecuente?.cantidad || 0;

  const content = (
    <Box>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2.5, sm: 3, md: 3.5 },
            borderRadius: { xs: 3, md: 3.5 },
            border: '1px solid #d7e3f5',
            background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #be123c 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ position: 'absolute', inset: 0, opacity: 0.22, background: 'radial-gradient(circle at 15% 10%, rgba(255,255,255,0.18), transparent 45%)' }} />
          <Box sx={{ position: 'absolute', right: -80, bottom: -80, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={{ xs: 2, sm: 2.5 }} alignItems={{ sm: 'center' }} sx={{ position: 'relative', zIndex: 1 }}>
            <Box sx={{ width: { xs: 64, md: 78 }, height: { xs: 64, md: 78 }, borderRadius: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.45)', boxShadow: '0 8px 26px rgba(15, 23, 42, 0.35)' }}>
              <AnalyticsIcon sx={{ fontSize: { xs: 30, md: 38 }, color: 'white' }} />
            </Box>
            <Box sx={{ flexGrow: 1 }}>
              <Typography variant="h4" sx={{ fontWeight: 900, mb: 0.8, letterSpacing: 0.2, fontSize: { xs: 24, sm: 28, md: 34 } }}>
                Estadística Documental
              </Typography>
              <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 13, sm: 14, md: 16 } }}>
                Dashboard inteligente por tipo de documento, macroproceso y periodo académico institucional.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2, sm: 2.5, md: 3 }, mb: 3, borderRadius: 3, border: '1px solid #bfdbfe', borderTop: '4px solid #2563eb', bgcolor: '#f8fbff' }}>
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="center" sx={{ mb: 2 }}>
            <FilterAltIcon sx={{ color: '#1d4ed8' }} />
            <Typography variant="subtitle1" sx={{ textAlign: 'center', fontWeight: 800, color: '#1e3a8a' }}>
              Filtros del Dashboard
            </Typography>
          </Stack>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Macroproceso</InputLabel>
                <Select
                  value={filters.macro_proceso_id}
                  label="Macroproceso"
                  onChange={(e) => setFilters((prev) => ({ ...prev, macro_proceso_id: e.target.value }))}
                  sx={{ borderRadius: 2, bgcolor: 'white' }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {macroProcesos.map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Tipo Documento</InputLabel>
                <Select
                  value={filters.tipo_documentacion_id}
                  label="Tipo Documento"
                  onChange={(e) => setFilters((prev) => ({ ...prev, tipo_documentacion_id: e.target.value }))}
                  sx={{ borderRadius: 2, bgcolor: 'white' }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {tiposDocumentacion.map((item) => (
                    <MenuItem key={item.id} value={item.id}>{item.nombre}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel>Periodo Académico</InputLabel>
                <Select
                  value={filters.periodo}
                  label="Periodo Académico"
                  onChange={(e) => setFilters((prev) => ({ ...prev, periodo: e.target.value }))}
                  sx={{ borderRadius: 2, bgcolor: 'white' }}
                >
                  <MenuItem value="">Todos</MenuItem>
                  {(data?.periodosDisponibles || []).map((item) => (
                    <MenuItem key={item.value} value={item.value}>{item.label}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} justifyContent="center" sx={{ mt: 2.5 }}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={handleSearch}
              disabled={loading}
              sx={{
                minWidth: { xs: '100%', sm: 220 },
                borderRadius: 2,
                py: 1.35,
                textTransform: 'none',
                fontWeight: 800,
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                boxShadow: '0 8px 20px rgba(37,99,235,0.28)',
                '&:hover': { background: 'linear-gradient(135deg, #1d4ed8 0%, #1e40af 100%)' }
              }}
            >
              Aplicar filtros
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={handleClear}
              disabled={loading}
              sx={{
                minWidth: { xs: '100%', sm: 200 },
                borderRadius: 2,
                py: 1.35,
                textTransform: 'none',
                fontWeight: 700,
                color: '#1d4ed8',
                borderColor: '#93c5fd',
                bgcolor: '#eff6ff',
                '&:hover': { borderColor: '#60a5fa', bgcolor: '#dbeafe' }
              }}
            >
              Limpiar filtros
            </Button>
          </Stack>
        </Paper>

        {loading && initialLoading ? (
          <Paper elevation={0} sx={{ borderRadius: 3, border: '1px solid #e2e8f0', p: 6, textAlign: 'center' }}>
            <CircularProgress />
            <Typography sx={{ mt: 2, color: '#64748b' }}>Cargando dashboard...</Typography>
          </Paper>
        ) : (
          <>
            <Grid container spacing={2.5} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#eff6ff' }}>
                  <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase' }}>Total Documentos</Typography>
                  <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 900, mt: 0.5 }}>{resumen.totalDocumentos}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#eff6ff' }}>
                  <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase' }}>Tipos Activos</Typography>
                  <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 900, mt: 0.5 }}>{resumen.totalTipos}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#eff6ff' }}>
                  <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase' }}>Macroprocesos</Typography>
                  <Typography variant="h4" sx={{ color: '#0f172a', fontWeight: 900, mt: 0.5 }}>{resumen.totalMacroProcesos}</Typography>
                </Paper>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Paper elevation={0} sx={{ p: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#eff6ff' }}>
                  <Typography variant="caption" sx={{ color: '#1e3a8a', fontWeight: 700, textTransform: 'uppercase' }}>Periodo</Typography>
                  <Typography variant="h6" sx={{ color: '#0f172a', fontWeight: 900, mt: 0.5 }}>{resumen.periodoSeleccionado}</Typography>
                </Paper>
              </Grid>
            </Grid>

            <Grid container spacing={2.5}>
              <Grid item xs={12} lg={8}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', height: 420 }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                    <AutoGraphIcon sx={{ color: '#1d4ed8' }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                      Documentos por Tipo
                    </Typography>
                  </Stack>
                  {topTipos.length === 0 ? (
                    <Alert severity="info">No hay información para los filtros seleccionados.</Alert>
                  ) : (
                    <ResponsiveContainer width="100%" height="90%">
                      <BarChart data={topTipos} margin={{ top: 10, right: 18, left: -8, bottom: 32 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                        <XAxis dataKey="tipo_documento" angle={-18} textAnchor="end" interval={0} height={70} tick={{ fill: '#334155', fontSize: 11 }} />
                        <YAxis tick={{ fill: '#334155', fontSize: 12 }} allowDecimals={false} />
                        <Tooltip formatter={(value) => [`${value}`, 'Cantidad']} />
                        <Bar dataKey="cantidad" radius={[8, 8, 0, 0]}>
                          {topTipos.map((entry, index) => (
                            <Cell key={`bar-${entry.tipo_documento}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </Paper>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', mb: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
                    Tipo más frecuente
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 0.8 }}>{topTipoNombre}</Typography>
                  <Chip label={`${topTipoCantidad} documentos`} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                </Paper>

                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', mb: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
                    Macroproceso líder
                  </Typography>
                  <Typography sx={{ fontWeight: 700, color: '#0f172a', mb: 0.8 }}>{topMacroNombre}</Typography>
                  <Chip label={`${topMacroCantidad} documentos`} sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                </Paper>

                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0', height: 260 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: '#1e3a8a', mb: 1 }}>
                    Distribución por Macroproceso
                  </Typography>
                  {(data?.distribucion?.porMacroProceso || []).length === 0 ? (
                    <Alert severity="info">Sin datos.</Alert>
                  ) : (
                    <ResponsiveContainer width="100%" height="88%">
                      <PieChart>
                        <Pie
                          data={data.distribucion.porMacroProceso}
                          dataKey="cantidad"
                          nameKey="macro_proceso"
                          innerRadius={52}
                          outerRadius={84}
                          paddingAngle={2}
                        >
                          {data.distribucion.porMacroProceso.map((item, index) => (
                            <Cell key={`macro-pie-${item.macro_proceso}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [`${value}`, 'Cantidad']} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </Paper>
              </Grid>
            </Grid>
          </>
        )}
      </Box>
  );

  if (embedded) return content;
  return <Fade in={true}>{content}</Fade>;
}

function EstadisticaDocumental() {
  return <EstadisticaDocumentalPanel embedded={false} />;
}

export default EstadisticaDocumental;
