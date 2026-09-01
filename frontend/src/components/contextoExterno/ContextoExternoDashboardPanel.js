import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis
} from 'recharts';
import gestionInformacionService from '../../services/gestionInformacionService';
import encabezadoCorreosImg from '../../assets/Encabezado_correos.png';

const ALL = 'TODOS';
const numberFormat = new Intl.NumberFormat('es-CO');

const normalize = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .trim();

const unique = (rows, field) => [
  ALL,
  ...Array.from(new Set(rows.map((row) => String(row[field] || '').trim()).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b, 'es'))
];

const sum = (rows, field) => rows.reduce((total, row) => total + Number(row[field] || 0), 0);

const periodSort = (a, b) => {
  const [ay, as] = String(a.periodo || '').split('-').map(Number);
  const [by, bs] = String(b.periodo || '').split('-').map(Number);
  return (ay - by) || (as - bs);
};

const metricGroups = [
  {
    label: 'Inscritos, admitidos y primer curso',
    fields: [
      ['inscritos_nacional', 'Inscritos nacional', '#1d4ed8'],
      ['inscritos_regional', 'Inscritos regional', '#60a5fa'],
      ['admitidos_nacional', 'Admitidos nacional', '#be123c'],
      ['admitidos_regional', 'Admitidos regional', '#fb7185'],
      ['primer_curso_nacional', 'Primer curso nacional', '#047857'],
      ['primer_curso_regional', 'Primer curso regional', '#34d399']
    ]
  },
  {
    label: 'Matriculados',
    fields: [
      ['matriculados_nacional', 'Matriculados nacional', '#1d4ed8'],
      ['matriculados_regional', 'Matriculados regional', '#f59e0b']
    ]
  },
  {
    label: 'Graduados',
    fields: [
      ['graduados_nacional', 'Graduados Colombia', '#7c3aed'],
      ['graduados_regional', 'Graduados regional', '#ec4899']
    ]
  }
];

function MetricCard({ icon: Icon, label, value, color = '#2563eb' }) {
  return (
    <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3, minHeight: 108 }}>
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box sx={{ width: 42, height: 42, borderRadius: 2.2, display: 'grid', placeItems: 'center', bgcolor: `${color}14`, color }}>
          <Icon />
        </Box>
        <Box>
          <Typography sx={{ color: '#64748b', fontSize: 12, fontWeight: 800 }}>{label}</Typography>
          <Typography sx={{ color: '#0f172a', fontSize: 25, lineHeight: 1.15, fontWeight: 900 }}>{numberFormat.format(value)}</Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <TextField select size="small" fullWidth label={label} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <MenuItem key={option} value={option}>{option === ALL ? 'Todos' : option}</MenuItem>)}
    </TextField>
  );
}

export default function ContextoExternoDashboardPanel({ onBack }) {
  const [mainTab, setMainTab] = useState(0);
  const [populationTab, setPopulationTab] = useState(0);
  const [payload, setPayload] = useState({ oferta: [], poblacional: [], departamentos: [], metadata: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [offerSearch, setOfferSearch] = useState('');
  const [area, setArea] = useState(ALL);
  const [sector, setSector] = useState(ALL);
  const [modality, setModality] = useState(ALL);
  const [geo, setGeo] = useState(ALL);
  const [municipality, setMunicipality] = useState(ALL);

  const [program, setProgram] = useState(ALL);
  const [period, setPeriod] = useState(ALL);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await gestionInformacionService.getContextoExternoGeneralDashboard();
      setPayload(response?.data || { oferta: [], poblacional: [], departamentos: [], metadata: {} });
    } catch (requestError) {
      setError(requestError?.response?.data?.message || 'No fue posible cargar Contexto Externo General.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const oferta = useMemo(() => payload.oferta || [], [payload.oferta]);
  const poblacional = useMemo(() => payload.poblacional || [], [payload.poblacional]);

  const offerOptions = useMemo(() => ({
    areas: unique(oferta, 'area_conocimiento'),
    sectors: unique(oferta, 'sector'),
    modalities: unique(oferta, 'modalidad'),
    geos: unique(oferta, 'georeferencia'),
    municipalities: unique(oferta, 'municipio')
  }), [oferta]);

  const filteredOffer = useMemo(() => {
    const search = normalize(offerSearch);
    return oferta.filter((row) => {
      if (area !== ALL && row.area_conocimiento !== area) return false;
      if (sector !== ALL && row.sector !== sector) return false;
      if (modality !== ALL && row.modalidad !== modality) return false;
      if (geo !== ALL && row.georeferencia !== geo) return false;
      if (municipality !== ALL && row.municipio !== municipality) return false;
      if (!search) return true;
      return [row.nombre_programa, row.institucion, row.area_conocimiento, row.municipio]
        .some((value) => normalize(value).includes(search));
    });
  }, [oferta, area, sector, modality, geo, municipality, offerSearch]);

  const offerMetrics = useMemo(() => ({
    rows: filteredOffer.length,
    programs: new Set(filteredOffer.map((row) => row.nombre_programa).filter(Boolean)).size,
    institutions: new Set(filteredOffer.map((row) => row.institucion).filter(Boolean)).size,
    municipalities: new Set(filteredOffer.map((row) => row.municipio).filter(Boolean)).size
  }), [filteredOffer]);

  const topAreas = useMemo(() => {
    const counts = new Map();
    filteredOffer.forEach((row) => counts.set(row.area_conocimiento || 'SIN CLASIFICAR', (counts.get(row.area_conocimiento || 'SIN CLASIFICAR') || 0) + 1));
    return Array.from(counts, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [filteredOffer]);

  const offerDistribution = useMemo(() => {
    const counts = new Map();
    filteredOffer.forEach((row) => counts.set(row.modalidad || 'SIN MODALIDAD', (counts.get(row.modalidad || 'SIN MODALIDAD') || 0) + 1));
    return Array.from(counts, ([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [filteredOffer]);

  const programOptions = useMemo(() => unique(poblacional, 'programa'), [poblacional]);
  const periodOptions = useMemo(() => [ALL, ...Array.from(new Set(poblacional.map((row) => row.periodo_referencia).filter(Boolean))).sort()], [poblacional]);
  const activeGroup = metricGroups[populationTab];

  const populationRows = useMemo(() => poblacional.filter((row) => {
    if (program !== ALL && row.programa !== program) return false;
    if (period !== ALL && row.periodo_referencia !== period) return false;
    return activeGroup.fields.some(([field]) => row[field] !== null && row[field] !== undefined);
  }), [poblacional, program, period, activeGroup]);

  const populationChart = useMemo(() => {
    const byPeriod = new Map();
    populationRows.forEach((row) => {
      const key = row.periodo_referencia;
      if (!key) return;
      if (!byPeriod.has(key)) byPeriod.set(key, { periodo: key });
      const target = byPeriod.get(key);
      activeGroup.fields.forEach(([field]) => { target[field] = Number(target[field] || 0) + Number(row[field] || 0); });
    });
    return Array.from(byPeriod.values()).sort(periodSort);
  }, [populationRows, activeGroup]);

  const populationTotals = useMemo(() => activeGroup.fields.map(([field, label, color]) => ({
    field, label, color, value: sum(populationRows, field)
  })), [populationRows, activeGroup]);

  const lastUploadLabel = payload.metadata?.lastUpload
    ? new Date(payload.metadata.lastUpload).toLocaleString('es-CO')
    : 'Sin cargues registrados';

  if (loading) {
    return <Box sx={{ minHeight: 460, display: 'grid', placeItems: 'center' }}><Stack alignItems="center" spacing={2}><CircularProgress /><Typography>Cargando Contexto Externo General…</Typography></Stack></Box>;
  }

  return (
    <Stack spacing={2.5} sx={{ width: '100%', pb: 6 }}>
      <Paper elevation={0} sx={{ border: '1px solid #cbd5e1', borderRadius: 3.5, overflow: 'hidden' }}>
        <Box component="img" src={encabezadoCorreosImg} alt="UNICESMAG" sx={{ width: '100%', height: { xs: 62, md: 78 }, objectFit: 'contain', bgcolor: '#fff' }} />
        <Box sx={{ px: { xs: 2, md: 3 }, py: 2, color: '#fff', background: 'linear-gradient(135deg, #173f96 0%, #2563eb 100%)' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }} spacing={1.5}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Button onClick={onBack} sx={{ minWidth: 42, color: '#fff', borderColor: 'rgba(255,255,255,.5)' }} variant="outlined"><ArrowBackRoundedIcon /></Button>
              <Box>
                <Typography sx={{ fontWeight: 900, fontSize: { xs: 17, md: 21 } }}>CONTEXTO EXTERNO GENERAL</Typography>
                <Typography sx={{ opacity: 0.86, fontSize: 12.5 }}>Oferta académica y series históricas nacional/regional</Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip label={`Actualización: ${lastUploadLabel}`} sx={{ color: '#fff', bgcolor: 'rgba(255,255,255,.16)', fontWeight: 700 }} />
              <Button onClick={loadData} startIcon={<RefreshRoundedIcon />} variant="contained" sx={{ bgcolor: '#fff', color: '#1d4ed8', fontWeight: 800, '&:hover': { bgcolor: '#eff6ff' } }}>Actualizar</Button>
            </Stack>
          </Stack>
        </Box>
        <Tabs value={mainTab} onChange={(_, value) => setMainTab(value)} variant="fullWidth" sx={{ p: 1, '& .MuiTab-root': { fontWeight: 900, textTransform: 'none' } }}>
          <Tab icon={<SchoolRoundedIcon />} iconPosition="start" label="Oferta académica" />
          <Tab icon={<GroupsRoundedIcon />} iconPosition="start" label="Información poblacional" />
        </Tabs>
      </Paper>

      {error && <Alert severity="error" action={<Button onClick={loadData}>Reintentar</Button>}>{error}</Alert>}
      {!error && !oferta.length && !poblacional.length && (
        <Alert severity="info">Aún no hay datos. Descarga la plantilla “Contexto Externo General” desde Gestión de Bases de Datos y carga el libro diligenciado.</Alert>
      )}

      {mainTab === 0 && (
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 2.2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900, mb: 2 }}>Filtros de oferta académica</Typography>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '2fr repeat(5, minmax(145px, 1fr))' } }}>
              <TextField size="small" label="Programa, institución o palabra clave" value={offerSearch} onChange={(event) => setOfferSearch(event.target.value)} />
              <FilterSelect label="Área" value={area} onChange={setArea} options={offerOptions.areas} />
              <FilterSelect label="Sector" value={sector} onChange={setSector} options={offerOptions.sectors} />
              <FilterSelect label="Modalidad" value={modality} onChange={setModality} options={offerOptions.modalities} />
              <FilterSelect label="Cobertura" value={geo} onChange={setGeo} options={offerOptions.geos} />
              <FilterSelect label="Municipio" value={municipality} onChange={setMunicipality} options={offerOptions.municipalities} />
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: 'repeat(4, 1fr)' } }}>
            <MetricCard icon={PublicRoundedIcon} label="Registros de oferta" value={offerMetrics.rows} />
            <MetricCard icon={SchoolRoundedIcon} label="Programas distintos" value={offerMetrics.programs} color="#7c3aed" />
            <MetricCard icon={AccountBalanceRoundedIcon} label="Instituciones" value={offerMetrics.institutions} color="#047857" />
            <MetricCard icon={PublicRoundedIcon} label="Municipios" value={offerMetrics.municipalities} color="#ea580c" />
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.5fr 1fr' } }}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Áreas con mayor oferta</Typography>
              <Box sx={{ height: 340 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={topAreas} layout="vertical" margin={{ left: 20, right: 20 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" /><YAxis dataKey="name" type="category" width={180} tick={{ fontSize: 10 }} /><RechartsTooltip /><Bar dataKey="total" name="Programas ofertados" fill="#2563eb" radius={[0, 6, 6, 0]} /></BarChart></ResponsiveContainer></Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Distribución por modalidad</Typography>
              <Box sx={{ height: 340 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={offerDistribution}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 10 }} /><YAxis /><RechartsTooltip /><Bar dataKey="total" name="Programas" fill="#0f766e" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer></Box>
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Detalle de oferta ({numberFormat.format(filteredOffer.length)})</Typography>
            <TableContainer sx={{ maxHeight: 480 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Institución</TableCell><TableCell>Programa</TableCell><TableCell>Área</TableCell><TableCell>Sector</TableCell><TableCell>Modalidad</TableCell><TableCell>Municipio</TableCell><TableCell>Cobertura</TableCell><TableCell align="right">Créditos</TableCell><TableCell align="right">Semestres</TableCell></TableRow></TableHead><TableBody>
              {filteredOffer.slice(0, 300).map((row) => <TableRow hover key={row.id}><TableCell>{row.institucion}</TableCell><TableCell sx={{ fontWeight: 700, color: '#1d4ed8' }}>{row.nombre_programa}</TableCell><TableCell>{row.area_conocimiento}</TableCell><TableCell>{row.sector}</TableCell><TableCell>{row.modalidad}</TableCell><TableCell>{row.municipio}</TableCell><TableCell><Chip size="small" label={row.georeferencia || '—'} /></TableCell><TableCell align="right">{row.numero_creditos ?? '—'}</TableCell><TableCell align="right">{row.numero_semestres ?? '—'}</TableCell></TableRow>)}
            </TableBody></Table></TableContainer>
          </Paper>
        </Stack>
      )}

      {mainTab === 1 && (
        <Stack spacing={2.5}>
          <Paper elevation={0} sx={{ p: 1, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Tabs value={populationTab} onChange={(_, value) => setPopulationTab(value)} variant="fullWidth" sx={{ '& .MuiTab-root': { fontWeight: 800, textTransform: 'none' } }}>
              {metricGroups.map((group) => <Tab key={group.label} label={group.label} />)}
            </Tabs>
          </Paper>
          <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' } }}>
              <FilterSelect label="Programa académico" value={program} onChange={setProgram} options={programOptions} />
              <FilterSelect label="Periodo" value={period} onChange={setPeriod} options={periodOptions} />
            </Box>
          </Paper>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr 1fr', lg: `repeat(${Math.min(activeGroup.fields.length, 3)}, 1fr)` } }}>
            {populationTotals.map((metric) => <MetricCard key={metric.field} icon={GroupsRoundedIcon} label={metric.label} value={metric.value} color={metric.color} />)}
          </Box>

          <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', xl: '1fr 1fr' } }}>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Tendencia histórica nacional y regional</Typography>
              <Box sx={{ height: 380 }}><ResponsiveContainer width="100%" height="100%"><LineChart data={populationChart} margin={{ left: 10, right: 20, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="periodo" angle={-30} textAnchor="end" height={60} /><YAxis /><RechartsTooltip formatter={(value) => numberFormat.format(value)} /><Legend />{activeGroup.fields.map(([field, label, color]) => <Line key={field} type="monotone" dataKey={field} name={label} stroke={color} strokeWidth={2.5} dot={{ r: 3 }} connectNulls />)}</LineChart></ResponsiveContainer></Box>
            </Paper>
            <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
              <Typography sx={{ fontWeight: 900, mb: 1 }}>Comparación por periodo</Typography>
              <Box sx={{ height: 380 }}><ResponsiveContainer width="100%" height="100%"><BarChart data={populationChart} margin={{ left: 10, right: 20, bottom: 20 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="periodo" angle={-30} textAnchor="end" height={60} /><YAxis /><RechartsTooltip formatter={(value) => numberFormat.format(value)} /><Legend />{activeGroup.fields.map(([field, label, color]) => <Bar key={field} dataKey={field} name={label} fill={color} radius={[4, 4, 0, 0]} />)}</BarChart></ResponsiveContainer></Box>
            </Paper>
          </Box>

          <Paper elevation={0} sx={{ p: 2, border: '1px solid #dbe5f2', borderRadius: 3 }}>
            <Typography sx={{ fontWeight: 900, mb: 1.5 }}>Series fuente ({numberFormat.format(populationRows.length)})</Typography>
            <TableContainer sx={{ maxHeight: 480 }}><Table stickyHeader size="small"><TableHead><TableRow><TableCell>Periodo</TableCell><TableCell>Programa</TableCell>{activeGroup.fields.map(([field, label]) => <TableCell key={field} align="right">{label}</TableCell>)}</TableRow></TableHead><TableBody>
              {populationRows.slice(0, 500).map((row) => <TableRow key={row.id} hover><TableCell sx={{ whiteSpace: 'nowrap', fontWeight: 800 }}>{row.periodo_referencia}</TableCell><TableCell>{row.programa}</TableCell>{activeGroup.fields.map(([field]) => <TableCell key={field} align="right">{row[field] === null || row[field] === undefined ? '—' : numberFormat.format(row[field])}</TableCell>)}</TableRow>)}
            </TableBody></Table></TableContainer>
          </Paper>
        </Stack>
      )}
    </Stack>
  );
}
