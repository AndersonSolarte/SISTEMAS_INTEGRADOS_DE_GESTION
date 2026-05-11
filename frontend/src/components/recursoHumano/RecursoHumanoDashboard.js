import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  FormControl,
  Grid,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  Typography,
  Fade
} from '@mui/material';
import {
  FilterAltOff as FilterAltOffIcon,
  Groups as GroupsIcon,
  Refresh as RefreshIcon,
  School as SchoolIcon,
  Work as WorkIcon
} from '@mui/icons-material';
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip
} from 'recharts';
import { useSnackbar } from 'notistack';
import gestionInformacionService from '../../services/gestionInformacionService';

const BLUE = '#1f73e8';
const LIGHT_BLUE = '#b8cae9';
const BORDER_BLUE = '#6aa3ff';
const TEXT_BLUE = '#1764c9';

const numberFmt = new Intl.NumberFormat('es-CO');

const emptyFilters = {
  anio: '',
  periodo: '',
  programa: '',
  escalafon: '',
  tipoVinculacion: ''
};

const normalizeText = (value) => String(value || '').trim();
const normalizeUpper = (value) => normalizeText(value).toUpperCase();

const normalizeGender = (value) => {
  const raw = normalizeUpper(value);
  if (['M', 'MASCULINO', 'HOMBRE'].includes(raw)) return 'Masculino';
  if (['F', 'FEMENINO', 'MUJER'].includes(raw)) return 'Femenino';
  return raw ? raw.charAt(0) + raw.slice(1).toLowerCase() : 'Sin información';
};

const normalizeCargoGroup = (value) => {
  const raw = normalizeUpper(value);
  if (raw.includes('ADMIN')) return 'ADMINISTRATIVOS';
  if (raw.includes('PROF') || raw.includes('DOCENT')) return 'PROFESORES';
  return raw || 'SIN CARGO';
};

const rowWeight = (row) => {
  const total = Number(row.total_docentes || row.peso || 0);
  return Number.isFinite(total) && total > 0 ? total : 1;
};

const uniqueSorted = (rows, getter) =>
  Array.from(new Set(rows.map((row) => normalizeText(getter(row))).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'));

const latestValue = (values) => {
  const numeric = values.map((value) => Number(value)).filter((value) => Number.isFinite(value));
  if (numeric.length) return String(Math.max(...numeric));
  return values[values.length - 1] || '';
};

const getPercent = (value, total) => {
  if (!total) return 0;
  return (Number(value || 0) / total) * 100;
};

const DonutLabel = ({ cx, cy, midAngle, outerRadius, value, total }) => {
  if (!value || !total) return null;
  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const percent = getPercent(value, total);

  return (
    <text
      x={x}
      y={y}
      fill="#0f172a"
      textAnchor={x > cx ? 'start' : 'end'}
      dominantBaseline="central"
      style={{ fontSize: 12, fontWeight: 800 }}
    >
      {`${numberFmt.format(value)} (${percent.toFixed(1).replace('.', ',')}%)`}
    </text>
  );
};

const GenderDonut = ({ data, total }) => {
  const chartData = data.filter((item) => Number(item.value || 0) > 0);
  const colors = [BLUE, LIGHT_BLUE, '#7dd3fc', '#c4b5fd'];

  if (!chartData.length) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: 128 }}>
        <Typography variant="body2" sx={{ color: '#64748b' }}>Sin distribución</Typography>
      </Stack>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: 128 }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={33}
            outerRadius={56}
            paddingAngle={1}
            labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
            label={(props) => <DonutLabel {...props} total={total} />}
            isAnimationActive
            animationDuration={900}
          >
            {chartData.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} stroke="#ffffff" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(value, name) => [numberFmt.format(Number(value || 0)), name]} />
        </PieChart>
      </ResponsiveContainer>
      <Stack
        alignItems="center"
        justifyContent="center"
        sx={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
      >
        <Typography sx={{ color: BLUE, fontSize: 30, fontWeight: 500, lineHeight: 1 }}>
          {numberFmt.format(total)}
        </Typography>
      </Stack>
    </Box>
  );
};

const CargoCard = ({ title, total, genderData, icon }) => (
  <Paper
    elevation={0}
    sx={{
      width: '100%',
      maxWidth: 255,
      border: `1px solid ${BORDER_BLUE}`,
      borderRadius: 1,
      overflow: 'visible',
      background: '#ffffff',
      boxShadow: '0 10px 22px rgba(31,115,232,.18)'
    }}
  >
    <Box sx={{ bgcolor: BLUE, px: 2, pt: 1.3, pb: 1.8, position: 'relative' }}>
      <Box
        sx={{
          border: '1px solid rgba(255,255,255,.9)',
          borderRadius: 999,
          height: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontSize: 12,
          fontWeight: 900,
          textTransform: 'uppercase'
        }}
      >
        {title}
      </Box>
      <Box sx={{ position: 'absolute', right: 12, top: 12, color: 'rgba(255,255,255,.9)' }}>{icon}</Box>
    </Box>
    <Box sx={{ px: 1.5, py: 0.8 }}>
      <GenderDonut data={genderData} total={total} />
      <Stack direction="row" spacing={1.2} justifyContent="center" sx={{ mt: 0.2 }}>
        {genderData.slice(0, 2).map((item, index) => (
          <Stack key={item.name} direction="row" spacing={0.4} alignItems="center">
            <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: index === 0 ? BLUE : LIGHT_BLUE }} />
            <Typography sx={{ fontSize: 9, color: '#64748b', textTransform: 'uppercase' }}>{item.name}</Typography>
          </Stack>
        ))}
      </Stack>
    </Box>
  </Paper>
);

function RecursoHumanoDashboard() {
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState(emptyFilters);

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const response = await gestionInformacionService.getEstadisticas({
        categoria: 'Recurso Humano',
        aggregate: 'recurso_humano_dashboard'
      });
      setData(response?.data || null);
    } catch (error) {
      enqueueSnackbar(error.response?.data?.message || 'Error al cargar Recurso Humano', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const docenteRows = useMemo(() => data?.docentes?.rows || [], [data]);

  const filterOptions = useMemo(() => ({
    anios: uniqueSorted(docenteRows, (row) => row.anio),
    periodos: uniqueSorted(docenteRows, (row) => row.periodo),
    programas: uniqueSorted(docenteRows, (row) => row.programa),
    escalafones: uniqueSorted(docenteRows, (row) => row.escalafon),
    vinculaciones: uniqueSorted(docenteRows, (row) => row.tipo_vinculacion)
  }), [docenteRows]);

  const filteredRows = useMemo(() => docenteRows.filter((row) => {
    if (filters.anio && String(row.anio || '') !== String(filters.anio)) return false;
    if (filters.periodo && normalizeText(row.periodo) !== filters.periodo) return false;
    if (filters.programa && normalizeText(row.programa) !== filters.programa) return false;
    if (filters.escalafon && normalizeText(row.escalafon) !== filters.escalafon) return false;
    if (filters.tipoVinculacion && normalizeText(row.tipo_vinculacion) !== filters.tipoVinculacion) return false;
    return true;
  }), [docenteRows, filters]);

  const dashboardMetrics = useMemo(() => {
    const groups = new Map();

    filteredRows.forEach((row) => {
      const groupKey = normalizeCargoGroup(row.cargo);
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          key: groupKey,
          total: 0,
          genders: new Map()
        });
      }

      const group = groups.get(groupKey);
      const amount = rowWeight(row);
      const gender = normalizeGender(row.genero || row.genero_biologico);
      group.total += amount;
      group.genders.set(gender, (group.genders.get(gender) || 0) + amount);
    });

    const cards = Array.from(groups.values())
      .filter((group) => ['ADMINISTRATIVOS', 'PROFESORES'].includes(group.key) && group.total > 0)
      .map((group) => ({
        ...group,
        genders: ['Masculino', 'Femenino']
          .map((name) => ({ name, value: Number(group.genders.get(name) || 0) }))
          .concat(
            Array.from(group.genders.entries())
              .filter(([name]) => !['Masculino', 'Femenino'].includes(name))
              .map(([name, value]) => ({ name, value: Number(value || 0) }))
          )
      }))
      .sort((a, b) => {
        const order = { ADMINISTRATIVOS: 1, PROFESORES: 2 };
        return (order[a.key] || 9) - (order[b.key] || 9);
      });

    return {
      total: cards.reduce((acc, item) => acc + Number(item.total || 0), 0),
      cards
    };
  }, [filteredRows]);

  const titleYear = filters.anio || latestValue(filterOptions.anios);
  const titlePeriod = filters.periodo || latestValue(filterOptions.periodos);
  const activeCargoLabel = dashboardMetrics.cards.length === 1 ? dashboardMetrics.cards[0].key : 'RECURSO HUMANO';

  const hasFilters = Object.values(filters).some(Boolean);

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px solid #dbeafe', borderRadius: 2 }}>
        <Typography sx={{ fontWeight: 900, mb: 1, color: TEXT_BLUE }}>Cargando dashboard de Recurso Humano...</Typography>
        <LinearProgress sx={{ borderRadius: 999 }} />
      </Paper>
    );
  }

  if (!data) {
    return (
      <Paper elevation={0} sx={{ p: 3, border: '1px dashed #bfdbfe', borderRadius: 2 }}>
        <Typography sx={{ color: '#475569' }}>No fue posible cargar el dashboard de Recurso Humano.</Typography>
      </Paper>
    );
  }

  return (
    <Fade in timeout={350}>
      <Box sx={{ background: '#ffffff', minHeight: 420 }}>
        <Paper
          elevation={0}
          sx={{
            mb: 1.4,
            border: `1px solid ${BORDER_BLUE}`,
            borderRadius: 1,
            overflow: 'hidden',
            background: '#ffffff'
          }}
        >
          <Box sx={{ px: 2, py: 0.9, textAlign: 'center', borderBottom: `1px solid ${BORDER_BLUE}` }}>
            <Typography sx={{ color: TEXT_BLUE, fontSize: { xs: 28, md: 36 }, lineHeight: 1.05, fontWeight: 400 }}>
              {[titleYear, titlePeriod].filter(Boolean).join(' ') || 'Recurso Humano'}
            </Typography>
          </Box>

          <Box sx={{ bgcolor: BLUE, px: { xs: 1.5, md: 7 }, py: 1.2 }}>
            <Box
              sx={{
                mx: 'auto',
                height: 36,
                border: '1px solid rgba(255,255,255,.9)',
                borderRadius: 999,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                letterSpacing: 0,
                textTransform: 'uppercase'
              }}
            >
              {activeCargoLabel}
            </Box>
          </Box>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            mb: 1.6,
            border: '1px solid #dbeafe',
            borderRadius: 2,
            background: '#fbfdff'
          }}
        >
          <Grid container spacing={1.2} alignItems="center">
            <Grid item xs={12} sm={6} md={2.2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Año</InputLabel>
                <Select value={filters.anio} label="Año" onChange={(event) => handleFilterChange('anio', event.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {filterOptions.anios.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel>Periodo</InputLabel>
                <Select value={filters.periodo} label="Periodo" onChange={(event) => handleFilterChange('periodo', event.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {filterOptions.periodos.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2.6}>
              <FormControl size="small" fullWidth>
                <InputLabel>Programa</InputLabel>
                <Select value={filters.programa} label="Programa" onChange={(event) => handleFilterChange('programa', event.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {filterOptions.programas.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Escalafón</InputLabel>
                <Select value={filters.escalafon} label="Escalafón" onChange={(event) => handleFilterChange('escalafon', event.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {filterOptions.escalafones.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.3}>
              <FormControl size="small" fullWidth>
                <InputLabel>Tipo de vinculación</InputLabel>
                <Select value={filters.tipoVinculacion} label="Tipo de vinculación" onChange={(event) => handleFilterChange('tipoVinculacion', event.target.value)}>
                  <MenuItem value="">Todos</MenuItem>
                  {filterOptions.vinculaciones.map((value) => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={0.6}>
              <Button
                fullWidth
                variant="outlined"
                title="Limpiar filtros"
                onClick={() => setFilters(emptyFilters)}
                disabled={!hasFilters}
                sx={{ minWidth: 44, height: 40, px: 0 }}
              >
                <FilterAltOffIcon fontSize="small" />
              </Button>
            </Grid>
          </Grid>
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1, flexWrap: 'wrap' }}>
            <Chip size="small" label={`Registros filtrados: ${numberFmt.format(filteredRows.length)}`} />
            <Chip size="small" color="primary" variant="outlined" label={`Total: ${numberFmt.format(dashboardMetrics.total)}`} />
            <Button size="small" startIcon={<RefreshIcon />} onClick={fetchDashboard}>Actualizar</Button>
          </Stack>
        </Paper>

        {dashboardMetrics.cards.length === 0 ? (
          <Paper elevation={0} sx={{ p: 3, border: '1px dashed #bfdbfe', borderRadius: 2, textAlign: 'center' }}>
            <Typography sx={{ color: '#475569', fontWeight: 700 }}>
              No hay registros con cargo Administrativo o Docente para los filtros seleccionados.
            </Typography>
          </Paper>
        ) : (
          <Grid container spacing={2} alignItems="center" justifyContent="center">
            <Grid item xs={12} md={3.2}>
              {dashboardMetrics.cards.find((item) => item.key === 'ADMINISTRATIVOS') ? (
                <Stack alignItems="center">
                  <CargoCard
                    title="Administrativos"
                    total={dashboardMetrics.cards.find((item) => item.key === 'ADMINISTRATIVOS').total}
                    genderData={dashboardMetrics.cards.find((item) => item.key === 'ADMINISTRATIVOS').genders}
                    icon={<WorkIcon fontSize="small" />}
                  />
                </Stack>
              ) : null}
            </Grid>

            <Grid item xs={12} md={3.4}>
              <Paper
                elevation={0}
                sx={{
                  mx: 'auto',
                  minHeight: 170,
                  maxWidth: 310,
                  border: `1px solid ${BORDER_BLUE}`,
                  borderRadius: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'radial-gradient(circle, #ffffff 0%, #ffffff 48%, #f3f7ff 100%)',
                  boxShadow: '0 0 34px rgba(31,115,232,.18)'
                }}
              >
                <Stack alignItems="center" spacing={0.5}>
                  <GroupsIcon sx={{ color: BLUE, fontSize: 26 }} />
                  <Typography sx={{ color: BLUE, fontSize: { xs: 48, md: 56 }, fontWeight: 500, lineHeight: 1 }}>
                    {numberFmt.format(dashboardMetrics.total)}
                  </Typography>
                </Stack>
              </Paper>
            </Grid>

            <Grid item xs={12} md={3.2}>
              {dashboardMetrics.cards.find((item) => item.key === 'PROFESORES') ? (
                <Stack alignItems="center">
                  <CargoCard
                    title="Profesores"
                    total={dashboardMetrics.cards.find((item) => item.key === 'PROFESORES').total}
                    genderData={dashboardMetrics.cards.find((item) => item.key === 'PROFESORES').genders}
                    icon={<SchoolIcon fontSize="small" />}
                  />
                </Stack>
              ) : null}
            </Grid>
          </Grid>
        )}
      </Box>
    </Fade>
  );
}

export default RecursoHumanoDashboard;
