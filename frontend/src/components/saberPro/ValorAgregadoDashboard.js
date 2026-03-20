import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  OutlinedInput,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography
} from '@mui/material';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import saberProAnalyticsService from '../../services/saberProAnalyticsService';

const BASE_FILTERS = { programas: [], anios: [], periodos: [], gruposReferencia: [] };
const SELECT_MENU_PROPS = { PaperProps: { style: { maxHeight: 360 } } };

const formatNumber = (value, digits = 2) => {
  if (value === null || value === undefined || value === '') return '—';
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return num.toLocaleString('es-CO', { minimumFractionDigits: digits, maximumFractionDigits: digits });
};

const coverageColor = (estado) => {
  if (estado === 'ALTO') return { bg: '#ecfdf5', fg: '#047857', border: '#a7f3d0' };
  if (estado === 'MEDIO') return { bg: '#fffbeb', fg: '#b45309', border: '#fde68a' };
  return { bg: '#fef2f2', fg: '#b91c1c', border: '#fecaca' };
};

function CoverageBadge({ coverage }) {
  const palette = coverageColor(coverage?.estado_cobertura);
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Chip
        size="small"
        label={`${coverage?.etiqueta_cobertura || 'NO REPRESENTATIVO'} · ${formatNumber(coverage?.porcentaje_cobertura || 0)}%`}
        sx={{ bgcolor: palette.bg, color: palette.fg, border: `1px solid ${palette.border}`, fontWeight: 800 }}
      />
      <Typography variant="caption" sx={{ color: '#475569', fontWeight: 700 }}>
        {`${coverage?.estudiantes_con_match || 0}/${coverage?.total_estudiantes || 0} estudiantes con match`}
      </Typography>
    </Stack>
  );
}

function KpiCard({ label, value, tone = '#2563eb' }) {
  return (
    <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5' }}>
      <Typography sx={{ fontSize: 12, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        {label}
      </Typography>
      <Typography sx={{ mt: 0.7, fontSize: 24, fontWeight: 900, color: tone }}>
        {value}
      </Typography>
    </Paper>
  );
}

function ValueTable({ columns, rows }) {
  return (
    <TableContainer component={Paper} elevation={0} sx={{ borderRadius: 3, border: '1px solid #dbe6f5' }}>
      <Table size="small">
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.key} sx={{ fontWeight: 800, color: '#1e293b', bgcolor: '#f8fafc' }}>
                {column.label}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, index) => (
            <TableRow key={`${row.documento || row.programa || row.nucleo_basico_conocimiento || 'row'}-${index}`} hover>
              {columns.map((column) => (
                <TableCell key={column.key}>
                  {column.render ? column.render(row[column.key], row) : row[column.key]}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {rows.length === 0 && (
            <TableRow>
              <TableCell colSpan={columns.length} sx={{ py: 4, textAlign: 'center', color: '#64748b' }}>
                No hay datos disponibles para la selección actual.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

function BlockedCoverage({ coverage }) {
  return (
    <Alert severity="warning" sx={{ borderRadius: 3 }}>
      <Typography sx={{ fontWeight: 800 }}>Cobertura insuficiente</Typography>
      <Typography variant="body2">
        La cobertura actual es {formatNumber(coverage?.porcentaje_cobertura || 0)}%. El dashboard se bloquea hasta superar el 30%.
      </Typography>
    </Alert>
  );
}

function ValorAgregadoDashboard({ initialSection = 'va_individual' }) {
  const [catalogs, setCatalogs] = useState({ programas: [], anios: [], periodos: [], gruposReferencia: [] });
  const [filters, setFilters] = useState(BASE_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState(initialSection);
  const [payload, setPayload] = useState({ coverage: buildEmptyCoverage(), rows: [], summary: null, histogram: [], boxplot: null, pagination: { total: 0 } });

  function buildEmptyCoverage() {
    return {
      total_estudiantes: 0,
      estudiantes_con_match: 0,
      porcentaje_cobertura: 0,
      estado_cobertura: 'CRITICO',
      etiqueta_cobertura: 'NO REPRESENTATIVO',
      es_valido_valor_agregado: false,
      mensaje_cobertura: 'Cobertura insuficiente'
    };
  }

  useEffect(() => {
    setSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    let active = true;
    saberProAnalyticsService.getFiltros()
      .then((response) => {
        if (!active) return;
        const data = response?.data || {};
        setCatalogs({
          programas: data.programas || [],
          anios: data.anios || [],
          periodos: data.periodos || [],
          gruposReferencia: data.gruposReferencia || []
        });
      })
      .catch(() => {
        if (!active) return;
        setCatalogs({ programas: [], anios: [], periodos: [], gruposReferencia: [] });
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        let response;
        if (section === 'va_individual') {
          response = await saberProAnalyticsService.getValueAddedIndividual({
            filters,
            pagination: { page: 1, pageSize: 40 },
            sort: [{ field: 'anio', direction: 'desc' }]
          });
        } else if (section === 'va_general') {
          response = await saberProAnalyticsService.getValueAddedGeneral(filters);
        } else if (section === 'va_estadistica') {
          response = await saberProAnalyticsService.getValueAddedStats(filters);
        } else {
          response = await saberProAnalyticsService.getValueAddedNbc(filters);
        }
        if (!active) return;
        setPayload(response?.data || { coverage: buildEmptyCoverage(), rows: [] });
      } catch (err) {
        if (!active) return;
        setError(err?.response?.data?.message || 'No fue posible cargar el dashboard de valor agregado.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [filters, section]);

  const coverage = payload.coverage || buildEmptyCoverage();
  const isBlocked = !coverage.es_valido_valor_agregado;

  const individualColumns = useMemo(() => ([
    { key: 'documento', label: 'Documento' },
    { key: 'programa', label: 'Programa' },
    { key: 'anio', label: 'Año' },
    { key: 'lectura_entrada', label: 'Lectura E', render: (v) => formatNumber(v, 3) },
    { key: 'lectura_salida', label: 'Lectura S', render: (v) => formatNumber(v, 3) },
    { key: 'va_lectura', label: 'VA Lectura', render: (v) => formatNumber(v, 3) },
    { key: 'razonamiento_entrada', label: 'Raz. E', render: (v) => formatNumber(v, 3) },
    { key: 'razonamiento_salida', label: 'Raz. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_razonamiento', label: 'VA Raz.', render: (v) => formatNumber(v, 3) },
    { key: 'ciudadanas_entrada', label: 'Ciud. E', render: (v) => formatNumber(v, 3) },
    { key: 'ciudadanas_salida', label: 'Ciud. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_ciudadanas', label: 'VA Ciud.', render: (v) => formatNumber(v, 3) },
    { key: 'comunicacion_entrada', label: 'Com. E', render: (v) => formatNumber(v, 3) },
    { key: 'comunicacion_salida', label: 'Com. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_comunicacion', label: 'VA Com.', render: (v) => formatNumber(v, 3) },
    { key: 'ingles_entrada', label: 'Ing. E', render: (v) => formatNumber(v, 3) },
    { key: 'ingles_salida', label: 'Ing. S', render: (v) => formatNumber(v, 3) },
    { key: 'va_ingles', label: 'VA Ing.', render: (v) => formatNumber(v, 3) },
    { key: 'va_global', label: 'VA Global', render: (v) => formatNumber(v, 3) }
  ]), []);

  const generalChartData = (payload.rows || []).slice(0, 12).map((row) => ({
    programa: row.programa,
    va_promedio: Number(row.va_promedio || 0)
  }));

  const nbcChartData = (payload.rows || []).slice(0, 12).map((row) => ({
    nbc: row.nucleo_basico_conocimiento,
    va_promedio: Number(row.va_promedio || 0)
  }));

  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={2.2}>
        <Paper elevation={0} sx={{ p: 2.2, borderRadius: 4, border: '1px solid #e9d5ff', background: 'linear-gradient(135deg, #ffffff 0%, #faf5ff 100%)' }}>
          <Stack spacing={1.8}>
            <Stack direction={{ xs: 'column', lg: 'row' }} justifyContent="space-between" spacing={1.5}>
              <Box>
                <Typography sx={{ fontSize: 28, fontWeight: 900, color: '#312e81', letterSpacing: '-0.03em' }}>
                  Dashboards de Valor Agregado
                </Typography>
                <Typography sx={{ mt: 0.8, color: '#6b7280', maxWidth: 840 }}>
                  El sistema cruza dinámicamente `resultados_individuales` y `resultados_saber11`, recalcula cobertura y habilita o bloquea visualizaciones según representatividad.
                </Typography>
              </Box>
              <CoverageBadge coverage={coverage} />
            </Stack>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Programas</InputLabel>
                  <Select
                    multiple
                    value={filters.programas}
                    onChange={(e) => setFilters((prev) => ({ ...prev, programas: e.target.value }))}
                    input={<OutlinedInput label="Programas" />}
                    MenuProps={SELECT_MENU_PROPS}
                    renderValue={(selected) => selected.length ? `${selected.length} seleccionados` : 'Todos'}
                  >
                    {catalogs.programas.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Años</InputLabel>
                  <Select
                    multiple
                    value={filters.anios}
                    onChange={(e) => setFilters((prev) => ({ ...prev, anios: e.target.value }))}
                    input={<OutlinedInput label="Años" />}
                    MenuProps={SELECT_MENU_PROPS}
                    renderValue={(selected) => selected.length ? `${selected.length} seleccionados` : 'Todos'}
                  >
                    {catalogs.anios.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>Periodos</InputLabel>
                  <Select
                    multiple
                    value={filters.periodos}
                    onChange={(e) => setFilters((prev) => ({ ...prev, periodos: e.target.value }))}
                    input={<OutlinedInput label="Periodos" />}
                    MenuProps={SELECT_MENU_PROPS}
                    renderValue={(selected) => selected.length ? `${selected.length} seleccionados` : 'Todos'}
                  >
                    {catalogs.periodos.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth size="small">
                  <InputLabel>NBC</InputLabel>
                  <Select
                    multiple
                    value={filters.gruposReferencia}
                    onChange={(e) => setFilters((prev) => ({ ...prev, gruposReferencia: e.target.value }))}
                    input={<OutlinedInput label="NBC" />}
                    MenuProps={SELECT_MENU_PROPS}
                    renderValue={(selected) => selected.length ? `${selected.length} seleccionados` : 'Todos'}
                  >
                    {catalogs.gruposReferencia.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Stack direction="row" spacing={1} flexWrap="wrap">
              {[
                ['va_individual', 'Individual'],
                ['va_general', 'Resultado General'],
                ['va_estadistica', 'Estadística General'],
                ['va_nbc', 'NBC']
              ].map(([key, label]) => (
                <Chip
                  key={key}
                  label={label}
                  onClick={() => setSection(key)}
                  sx={{
                    bgcolor: section === key ? '#7c3aed' : '#ffffff',
                    color: section === key ? '#fff' : '#5b21b6',
                    border: '1px solid #ddd6fe',
                    fontWeight: 800,
                    cursor: 'pointer'
                  }}
                />
              ))}
            </Stack>
          </Stack>
        </Paper>

        {loading && <LinearProgress sx={{ borderRadius: 999 }} />}
        {error && <Alert severity="error" sx={{ borderRadius: 3 }}>{error}</Alert>}
        {isBlocked && <BlockedCoverage coverage={coverage} />}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <KpiCard label="Cobertura" value={`${formatNumber(coverage.porcentaje_cobertura)}%`} tone="#7c3aed" />
          </Grid>
          <Grid item xs={12} md={4}>
            <KpiCard label="Estudiantes con Match" value={coverage.estudiantes_con_match} tone="#047857" />
          </Grid>
          <Grid item xs={12} md={4}>
            <KpiCard label="Estado" value={coverage.etiqueta_cobertura} tone={coverage.estado_cobertura === 'CRITICO' ? '#b91c1c' : '#1d4ed8'} />
          </Grid>
        </Grid>

        {!isBlocked && section === 'va_individual' && (
          <ValueTable columns={individualColumns} rows={payload.rows || []} />
        )}

        {!isBlocked && section === 'va_general' && (
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height: 380 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>VA promedio por programa</Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={generalChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="programa" tick={{ fontSize: 11 }} hide />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="va_promedio" fill="#7c3aed" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
            <ValueTable
              columns={[
                { key: 'programa', label: 'Programa' },
                { key: 'estudiantes', label: 'Estudiantes' },
                { key: 'va_promedio', label: 'VA Promedio', render: (v) => formatNumber(v, 3) },
                { key: 'porcentaje_mejora', label: '% Mejora', render: (v) => formatNumber(v, 2) },
                { key: 'porcentaje_empeora', label: '% Empeora', render: (v) => formatNumber(v, 2) },
                { key: 'porcentaje_cobertura', label: '% Cobertura', render: (v) => formatNumber(v, 2) },
                { key: 'etiqueta_cobertura', label: 'Estado' }
              ]}
              rows={payload.rows || []}
            />
          </Stack>
        )}

        {!isBlocked && section === 'va_estadistica' && (
          <Stack spacing={2}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4}><KpiCard label="Promedio VA" value={formatNumber(payload.summary?.promedio_va, 3)} tone="#7c3aed" /></Grid>
              <Grid item xs={12} md={4}><KpiCard label="Mediana VA" value={formatNumber(payload.summary?.mediana_va, 3)} tone="#2563eb" /></Grid>
              <Grid item xs={12} md={4}><KpiCard label="Desv. Estándar" value={formatNumber(payload.summary?.desviacion_estandar, 3)} tone="#0f766e" /></Grid>
            </Grid>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height: 360 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>Distribución de VA global</Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={payload.histogram || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="bucket" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value) => [value, 'Registros']} labelFormatter={(label) => `Bucket ${label}`} />
                  <Bar dataKey="total" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
            <ValueTable
              columns={[
                { key: 'label', label: 'Métrica' },
                { key: 'value', label: 'Valor' }
              ]}
              rows={[
                { label: 'P25', value: formatNumber(payload.summary?.p25, 3) },
                { label: 'P50', value: formatNumber(payload.summary?.p50, 3) },
                { label: 'P75', value: formatNumber(payload.summary?.p75, 3) },
                { label: 'Boxplot Min', value: formatNumber(payload.boxplot?.min, 3) },
                { label: 'Boxplot Q1', value: formatNumber(payload.boxplot?.q1, 3) },
                { label: 'Boxplot Mediana', value: formatNumber(payload.boxplot?.mediana, 3) },
                { label: 'Boxplot Q3', value: formatNumber(payload.boxplot?.q3, 3) },
                { label: 'Boxplot Max', value: formatNumber(payload.boxplot?.max, 3) }
              ]}
            />
          </Stack>
        )}

        {!isBlocked && section === 'va_nbc' && (
          <Stack spacing={2}>
            <Paper elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #dbe6f5', height: 380 }}>
              <Typography sx={{ fontWeight: 800, color: '#0f172a', mb: 1 }}>Ranking de valor agregado por NBC</Typography>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={nbcChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="nbc" tick={{ fontSize: 11 }} hide />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="va_promedio" fill="#6d28d9" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Paper>
            <ValueTable
              columns={[
                { key: 'ranking', label: 'Ranking' },
                { key: 'nucleo_basico_conocimiento', label: 'NBC' },
                { key: 'estudiantes', label: 'Estudiantes' },
                { key: 'va_promedio', label: 'VA Promedio', render: (v) => formatNumber(v, 3) },
                { key: 'porcentaje_cobertura', label: '% Cobertura', render: (v) => formatNumber(v, 2) },
                { key: 'etiqueta_cobertura', label: 'Estado' }
              ]}
              rows={payload.rows || []}
            />
          </Stack>
        )}
      </Stack>
    </Box>
  );
}

export default ValorAgregadoDashboard;
