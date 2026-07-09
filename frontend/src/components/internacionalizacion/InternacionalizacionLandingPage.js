import React, { useEffect, useState } from 'react';
import { ROLES } from '../../constants/roles';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Fade,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FlightIcon from '@mui/icons-material/Flight';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PublicIcon from '@mui/icons-material/Public';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import BusinessCenterRoundedIcon from '@mui/icons-material/BusinessCenterRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import SchoolRoundedIcon from '@mui/icons-material/SchoolRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import TravelExploreRoundedIcon from '@mui/icons-material/TravelExploreRounded';
import gestionInformacionService from '../../services/gestionInformacionService';
import InternacionalizacionGestionPanel from './InternacionalizacionGestionPanel';
import InternacionalizacionMovilidadDashboard from './InternacionalizacionMovilidadDashboard';
import InternacionalizacionConveniosDashboard from './InternacionalizacionConveniosDashboard';

const SUB_CARDS = [
  {
    key: 'gestion',
    label: 'Gestión Estadística',
    description: 'Carga y administra la información de internacionalización: descarga la plantilla, complétala y sube los datos de movilidad y convenios paso a paso.',
    icon: UploadFileIcon,
    color: '#0891b2',
    gradient: 'linear-gradient(135deg, #0891b2 0%, #0e7490 100%)',
    shadow: 'rgba(8,145,178,0.12)',
    bgLight: '#ecfeff',
    titleColor: '#164e63',
    btnLabel: 'Ir a cargue de datos'
  },
  {
    key: 'movilidad',
    label: 'Estadística de Movilidad',
    description: 'Dashboard interactivo con indicadores, gráficas y filtros estratégicos sobre movilidad nacional e internacional por período, país, tipo de persona y actividad.',
    icon: FlightIcon,
    color: '#2563eb',
    gradient: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
    shadow: 'rgba(37,99,235,0.12)',
    bgLight: '#eff6ff',
    titleColor: '#1e3a8a',
    btnLabel: 'Abrir dashboard'
  },
  {
    key: 'convenios',
    label: 'Convenios',
    description: 'Consulta el catálogo de convenios de internacionalización con búsqueda inteligente, filtros por tipo y año, y acceso directo a los documentos adjuntos.',
    icon: HandshakeIcon,
    color: '#7c3aed',
    gradient: 'linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)',
    shadow: 'rgba(124,58,237,0.12)',
    bgLight: '#f5f3ff',
    titleColor: '#4c1d95',
    btnLabel: 'Abrir módulo'
  }
];

const STRATEGIC_SCOPE = [
  {
    title: 'Movilidad estudiantil',
    icon: SchoolRoundedIcon,
    color: '#2563eb',
    items: ['Entrante y saliente', 'Programa, institución, ciudad y país', 'Alcance, modalidad y tipo de movilidad']
  },
  {
    title: 'Movilidad docente',
    icon: GroupsRoundedIcon,
    color: '#059669',
    items: ['Entrante y saliente', 'Facultad o programa', 'Docencia, investigación, ponencias y capacitación']
  },
  {
    title: 'Movilidad administrativa',
    icon: BusinessCenterRoundedIcon,
    color: '#d97706',
    items: ['Entrante y saliente', 'Dependencia receptora', 'Actividad, modalidad y alcance geográfico']
  },
  {
    title: 'Convenios y cooperación',
    icon: HandshakeIcon,
    color: '#7c3aed',
    items: ['Institución aliada, ciudad y país', 'Tipo, vigencia y estado', 'Convenios activos y ejecutados']
  }
];

const CURRENT_COVERAGE = [
  'Carga y administración de datos de movilidad y convenios.',
  'Dashboard con filtros por período, país, alcance, dirección y tipo de persona.',
  'Indicadores de salientes, entrantes, países destino y tendencias históricas.',
  'Catálogo de convenios con consulta y documentos adjuntos.'
];

const CLARITY_PENDING = [
  'Separar con precisión los indicadores SNIES por estudiante, docente y administrativo.',
  'Confirmar campos obligatorios para IP y IIP en cada año académico.',
  'Definir cómo se cuentan clase espejo, proyectos colaborativos y otras modalidades.',
  'Cruzar convenios activos con movilidades ejecutadas para medir impacto.'
];

const TRACKING_MATRIX = [
  'Movilidades estudiantiles entrantes',
  'Movilidades estudiantiles salientes',
  'Movilidades docentes entrantes',
  'Movilidades docentes salientes',
  'Movilidades administrativas',
  'Convenios activos',
  'Países vinculados',
  'Instituciones aliadas',
  'Modalidades desarrolladas'
];

const formatMetric = (value) => Number(value || 0).toLocaleString('es-CO');

const cleanKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase();

const sumRowsBy = (rows = [], matcher) => rows.reduce((sum, row) => (
  matcher(cleanKey(row.name)) ? sum + Number(row.value || 0) : sum
), 0);

const sortPeriodRows = (rows = []) => [...rows].sort((a, b) => (
  String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true })
));

const uniqueCount = (items = []) => new Set(items.map((item) => String(item || '').trim()).filter(Boolean)).size;

const countByList = (items = [], selector, limit = 6) => Object.entries(items.reduce((acc, item) => {
  const value = String(selector(item) || '').trim();
  if (!value) return acc;
  acc[value] = (acc[value] || 0) + 1;
  return acc;
}, {}))
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name), 'es'))
  .slice(0, limit);

const isConventionActive = (row) => {
  if (!row?.fecha_terminacion) return true;
  const end = new Date(row.fecha_terminacion);
  if (Number.isNaN(end.getTime())) return true;
  return end >= new Date();
};


function InternacionalizacionLandingPage({ user, onBack }) {
  const [subView, setSubView] = useState(null);
  const [overview, setOverview] = useState({ loading: true, movilidad: null, convenios: null, error: false });

  const isAdminOrPlaneacion = [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA].includes(user?.role);
  
  const canViewGestion = isAdminOrPlaneacion || (user?.allowedInternacionalizacionDashboards || []).includes('internacionalizacion_gestion');
  const canViewEstadistica = isAdminOrPlaneacion || (user?.allowedInternacionalizacionDashboards || []).includes('internacionalizacion_estadistica');
  const canViewConvenios = isAdminOrPlaneacion || (user?.allowedInternacionalizacionDashboards || []).includes('internacionalizacion_convenios');

  const VISIBLE_CARDS = SUB_CARDS.filter(card => {
    if (card.key === 'gestion') return canViewGestion;
    if (card.key === 'movilidad') return canViewEstadistica;
    if (card.key === 'convenios') return canViewConvenios;
    return false;
  });

  useEffect(() => {
    let active = true;

    const loadOverview = async () => {
      if (!canViewEstadistica && !canViewConvenios) {
        setOverview({ loading: false, movilidad: null, convenios: null, error: false });
        return;
      }

      setOverview((prev) => ({ ...prev, loading: true, error: false }));
      try {
        const [movilidadResult, conveniosResult] = await Promise.all([
          canViewEstadistica ? gestionInformacionService.getMovilidadDashboard() : Promise.resolve(null),
          canViewConvenios ? gestionInformacionService.getConveniosDashboard() : Promise.resolve(null)
        ]);

        if (!active) return;
        setOverview({
          loading: false,
          movilidad: movilidadResult?.data || null,
          convenios: conveniosResult?.data || null,
          error: false
        });
      } catch (error) {
        console.error(error);
        if (!active) return;
        setOverview((prev) => ({ ...prev, loading: false, error: true }));
      }
    };

    loadOverview();
    return () => { active = false; };
  }, [canViewEstadistica, canViewConvenios]);

  const movilidad = overview.movilidad;
  const convenios = overview.convenios;
  const conveniosRows = convenios?.rows || [];
  const periodRows = sortPeriodRows(movilidad?.byPeriodo || []);
  const periodBars = periodRows.slice(-6);
  const maxPeriodValue = Math.max(1, ...periodBars.map((row) => Number(row.value || 0)));
  const latestPeriod = periodRows[periodRows.length - 1];
  const activeConvenios = conveniosRows.filter(isConventionActive).length;
  const studentMobility = sumRowsBy(movilidad?.byTipoPersona || [], (name) => name.includes('estudiante'));
  const teacherMobility = sumRowsBy(movilidad?.byTipoPersona || [], (name) => name.includes('docente'));
  const adminMobility = sumRowsBy(movilidad?.byTipoPersona || [], (name) => name.includes('administr'));
  const outboundMobility = sumRowsBy(movilidad?.byDireccion || [], (name) => name.includes('saliente'));
  const inboundMobility = sumRowsBy(movilidad?.byDireccion || [], (name) => name.includes('entrante'));
  const uniqueCountries = (movilidad?.byPais || []).filter((row) => Number(row.value || 0) > 0).length;
  const sniesMatrix = movilidad?.sniesPersonDirection || {};
  const getSniesValue = (group, key) => Number(sniesMatrix?.[group]?.[key] || 0);
  const alliedInstitutions = uniqueCount([
    ...(movilidad?.institucionesMovilidad || []),
    ...conveniosRows.map((row) => row.convenio_entidad)
  ]);
  const modalityRows = (movilidad?.byModalidad || []).filter((row) => cleanKey(row.name) && !['sin dato', 'n a', 'na'].includes(cleanKey(row.name)));
  const mobilityTypeRows = (movilidad?.byTipoMovilidad || []).filter((row) => cleanKey(row.name) && !['sin dato', 'n a', 'na'].includes(cleanKey(row.name)));
  const uniqueModalities = uniqueCount([
    ...modalityRows.map((row) => row.name),
    ...mobilityTypeRows.map((row) => row.name)
  ]);
  const sniesIndicators = [
    { label: 'Movilidades estudiantiles entrantes', value: getSniesValue('estudiantes', 'entrantes'), base: movilidad?.total || 0, scope: 'Estudiantes / entrante', color: '#2563eb' },
    { label: 'Movilidades estudiantiles salientes', value: getSniesValue('estudiantes', 'salientes'), base: movilidad?.total || 0, scope: 'Estudiantes / saliente', color: '#2563eb' },
    { label: 'Movilidades docentes entrantes', value: getSniesValue('docentes', 'entrantes'), base: movilidad?.total || 0, scope: 'Docentes / entrante', color: '#059669' },
    { label: 'Movilidades docentes salientes', value: getSniesValue('docentes', 'salientes'), base: movilidad?.total || 0, scope: 'Docentes / saliente', color: '#059669' },
    { label: 'Movilidades administrativas', value: getSniesValue('administrativos', 'total'), base: movilidad?.total || 0, scope: 'Administrativos total', color: '#d97706' },
    { label: 'Convenios activos', value: activeConvenios, base: convenios?.total || conveniosRows.length, scope: 'Vigentes por fecha de terminación', color: '#7c3aed' },
    { label: 'Países vinculados', value: uniqueCountries, base: uniqueCountries, scope: 'Países con movilidad registrada', color: '#0891b2' },
    { label: 'Instituciones aliadas', value: alliedInstitutions, base: alliedInstitutions, scope: 'Movilidad + convenios', color: '#4f46e5' },
    { label: 'Modalidades desarrolladas', value: uniqueModalities, base: uniqueModalities, scope: 'Modalidad + tipo de movilidad', color: '#0d9488' }
  ];
  const topMobilityTypes = mobilityTypeRows.slice(0, 5);
  const topCountries = (movilidad?.byPais || []).slice(0, 5);
  const populationProfiles = movilidad?.populationProfiles || {};
  const populationSchema = [
    { key: 'estudiantes', title: 'Estudiantes', icon: SchoolRoundedIcon, color: '#2563eb', profile: populationProfiles.estudiantes || {} },
    { key: 'docentes', title: 'Docentes', icon: GroupsRoundedIcon, color: '#059669', profile: populationProfiles.docentes || {} },
    { key: 'administrativos', title: 'Administrativos', icon: BusinessCenterRoundedIcon, color: '#d97706', profile: populationProfiles.administrativos || {} }
  ];
  const convenioSchema = [
    { title: 'Por tipo de convenio', rows: countByList(conveniosRows, (row) => row.tipo_convenio) },
    { title: 'Por programa gestor', rows: countByList(conveniosRows, (row) => row.programa_gestor) },
    { title: 'Por año', rows: countByList(conveniosRows, (row) => row.anio) }
  ];
  const statisticalCards = [
    { label: 'Total movilidades', value: movilidad?.total || 0, sub: 'Registros consolidados', color: '#2563eb', icon: TravelExploreRoundedIcon },
    { label: 'Salientes', value: outboundMobility, sub: 'Movilidad hacia otras instituciones', color: '#059669', icon: FlightIcon },
    { label: 'Entrantes', value: inboundMobility, sub: 'Movilidad recibida por la institución', color: '#7c3aed', icon: PublicIcon },
    { label: 'Convenios activos', value: activeConvenios, sub: `${formatMetric(convenios?.total || conveniosRows.length)} convenios registrados`, color: '#d97706', icon: HandshakeIcon },
    { label: 'Países vinculados', value: uniqueCountries, sub: 'Destinos u orígenes identificados', color: '#0891b2', icon: TravelExploreRoundedIcon },
    { label: 'Último período', value: latestPeriod?.value || 0, sub: latestPeriod?.name ? `Movilidades en ${latestPeriod.name}` : 'Sin período disponible', color: '#4f46e5', icon: TimelineRoundedIcon }
  ];
  const peopleStats = [
    { label: 'Estudiantes', value: studentMobility, color: '#2563eb' },
    { label: 'Docentes', value: teacherMobility, color: '#059669' },
    { label: 'Administrativos', value: adminMobility, color: '#d97706' }
  ];


  if (subView === 'gestion') {
    return <InternacionalizacionGestionPanel onBack={() => setSubView(null)} />;
  }

  if (subView === 'movilidad') {
    return (
      <InternacionalizacionMovilidadDashboard
        onBack={() => setSubView(null)}
        onNavigateConvenios={() => setSubView('convenios')}
        activeView="movilidad"
      />
    );
  }

  if (subView === 'convenios') {
    return (
      <InternacionalizacionConveniosDashboard
        onBack={() => setSubView(null)}
        onNavigateMovilidad={() => setSubView('movilidad')}
        activeView="convenios"
      />
    );
  }

  return (
    <Fade in timeout={300}>
      <Stack spacing={2.5}>
        <Paper elevation={0} sx={{ p: 1.4, border: '1px solid #dbe6f5', borderRadius: 2.5, bgcolor: '#f8fbff' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Button
              variant="outlined"
              startIcon={<ArrowBackRoundedIcon />}
              onClick={onBack}
              sx={{ fontWeight: 800 }}
            >
              Volver a Estadística Institucional
            </Button>
          </Stack>
        </Paper>

        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 2, md: 2.5 }, 
            borderRadius: 3.5, 
            background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)',
            boxShadow: '0 6px 20px rgba(15, 23, 42, 0.08)',
            border: 'none',
            color: '#fff'
          }}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Box sx={{ p: 1.2, borderRadius: 2, bgcolor: 'rgba(255, 255, 255, 0.15)', display: 'grid', placeItems: 'center' }}>
              <PublicIcon sx={{ fontSize: 28, color: '#fff' }} />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 900, color: '#ffffff', fontSize: { xs: 20, md: 22 }, letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                Panel de Internacionalización
              </Typography>
              <Typography sx={{ color: 'rgba(255, 255, 255, 0.85)', fontSize: 13.5, mt: 0.5, fontWeight: 500, lineHeight: 1.25 }}>
                Consolidado de movilidad, convenios y gestión estadística institucional.
              </Typography>
            </Box>
          </Stack>
        </Paper>

        <Box>
          <Typography variant="h5" sx={{ fontWeight: 900, color: '#0f172a', mb: 3.5, mt: 1.5, textAlign: 'center', letterSpacing: -0.5 }}>
            Seleccione un submódulo para ingresar
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gap: 3,
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(auto-fit, minmax(290px, 1fr))',
                md: 'repeat(3, 1fr)'
              },
              maxWidth: 1100,
              margin: '0 auto',
              px: 1,
              width: '100%',
              alignItems: 'stretch'
            }}
          >
            {VISIBLE_CARDS.length === 0 && (
              <Paper elevation={0} sx={{ p: 3, gridColumn: '1 / -1', borderRadius: 2.5, border: '1px solid #f8ecc8', bgcolor: '#fffcf2' }}>
                <Stack direction='row' spacing={1.5} alignItems='center'>
                  <Typography sx={{ color: '#b45309', fontWeight: 700, fontSize: 14, width: '100%', textAlign: 'center' }}>
                    Usted no tiene asignado ningún submódulo para la visualización de la Internacionalización. Por favor, contacte con el administrador si considera que esto es un error.
                  </Typography>
                </Stack>
              </Paper>
            )}
            {VISIBLE_CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <Paper
                  key={card.key}
                  elevation={0}
                  onClick={() => setSubView(card.key)}
                  sx={{
                    p: 4.5,
                    borderRadius: 5,
                    border: '1px solid #e2e8f0',
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    boxShadow: '0 10px 25px rgba(15,23,42,0.03)',
                    cursor: 'pointer',
                    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': {
                      transform: 'translateY(-6px)',
                      boxShadow: `0 25px 50px ${card.shadow}`,
                      borderColor: card.color,
                      '& .icon-container': {
                        background: card.gradient,
                        color: '#ffffff',
                        transform: 'scale(1.1) rotate(5deg)'
                      },
                      '& .action-btn': {
                        background: card.gradient,
                        boxShadow: `0 8px 22px ${card.shadow}`
                      }
                    }
                  }}
                >
                  <Box
                    className="icon-container"
                    sx={{
                      width: 84,
                      height: 84,
                      borderRadius: 4.5,
                      background: card.bgLight,
                      color: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      mb: 3.5,
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      boxShadow: `0 8px 16px ${card.shadow}`
                    }}
                  >
                    <Icon sx={{ fontSize: 44 }} />
                  </Box>

                  <Typography variant="h6" sx={{ fontWeight: 900, color: card.titleColor, mb: 1.8, fontSize: 20 }}>
                    {card.label}
                  </Typography>

                  <Typography sx={{ color: '#64748b', fontSize: 14.5, mb: 4, flexGrow: 1, lineHeight: 1.6, px: 2 }}>
                    {card.description}
                  </Typography>

                  <Button
                    variant="contained"
                    className="action-btn"
                    sx={{
                      textTransform: 'none',
                      borderRadius: 3,
                      px: 3.5,
                      py: 1.2,
                      fontWeight: 800,
                      background: card.gradient,
                      boxShadow: `0 4px 12px ${card.shadow}`,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {card.btnLabel}
                  </Button>
                </Paper>
              );
            })}
          </Box>
        </Box>

        <Paper
          elevation={0}
          sx={{
            mt: 1,
            borderRadius: 4,
            border: '1px solid #dbe6f5',
            overflow: 'hidden',
            background: '#ffffff',
            boxShadow: '0 18px 45px rgba(15, 23, 42, 0.06)'
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1.15fr 0.85fr' },
              minHeight: 310
            }}
          >
            <Box sx={{ p: { xs: 3, md: 4.2 }, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
                {['SNIES', 'Autoevaluaci\u00f3n', 'Acreditaci\u00f3n', 'Cooperaci\u00f3n'].map((label) => (
                  <Chip
                    key={label}
                    label={label}
                    size="small"
                    sx={{
                      bgcolor: '#eff6ff',
                      color: '#1d4ed8',
                      fontWeight: 800,
                      border: '1px solid #bfdbfe'
                    }}
                  />
                ))}
              </Stack>

              <Typography sx={{ fontSize: { xs: 26, md: 34 }, fontWeight: 950, color: '#0f172a', lineHeight: 1.05, mb: 1.5 }}>
                Mapa institucional de internacionalización
              </Typography>
              <Typography sx={{ color: '#475569', fontSize: { xs: 14, md: 15.5 }, lineHeight: 1.65, maxWidth: 720 }}>
                Consolidar y organizar la información de movilidad académica, cooperación interinstitucional y convenios nacionales e internacionales para evidenciar trayectoria, evolución e impacto institucional por período académico.
              </Typography>

              <Box
                sx={{
                  mt: 3,
                  display: 'grid',
                  gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
                  gap: 1.4
                }}
              >
                {[
                  { icon: TimelineRoundedIcon, value: 'IP / IIP', label: 'Lectura por período' },
                  { icon: TravelExploreRoundedIcon, value: 'Movilidad', label: 'Entrante y saliente' },
                  { icon: ApartmentRoundedIcon, value: 'Convenios', label: 'Aliados y vigencias' }
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Box
                      key={item.value}
                      sx={{
                        p: 1.6,
                        borderRadius: 2.5,
                        border: '1px solid #e2e8f0',
                        bgcolor: '#f8fafc',
                        display: 'flex',
                        gap: 1.2,
                        alignItems: 'center',
                        minWidth: 0
                      }}
                    >
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, bgcolor: '#dbeafe', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon sx={{ color: '#1d4ed8', fontSize: 20 }} />
                      </Box>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 13.5 }}>{item.value}</Typography>
                        <Typography sx={{ color: '#64748b', fontSize: 11.5, lineHeight: 1.25 }}>{item.label}</Typography>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <Box
              sx={{
                minHeight: { xs: 260, md: '100%' },
                bgcolor: '#f8fafc',
                position: 'relative',
                display: 'grid',
                placeItems: 'center',
                borderLeft: { xs: 'none', md: '1px solid #e2e8f0' },
                borderTop: { xs: '1px solid #e2e8f0', md: 'none' },
                overflow: 'hidden'
              }}
            >
              <Box
                component="img"
                src="/internacionalizacion-mapa.png"
                alt="Mapa visual de internacionalizaci\u00f3n ORI"
                sx={{
                  width: { xs: '82%', md: '88%' },
                  maxWidth: 390,
                  display: 'block',
                  filter: 'drop-shadow(0 22px 34px rgba(15, 23, 42, 0.18))'
                }}
              />
            </Box>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3.5, border: '1px solid #dbe6f5', bgcolor: '#ffffff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2.4 }}>
            <Box sx={{ width: 44, height: 44, borderRadius: 2, bgcolor: '#eff6ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <TravelExploreRoundedIcon sx={{ color: '#2563eb', fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: { xs: 21, md: 25 }, fontWeight: 950, color: '#0f172a', lineHeight: 1.08 }}>
                Esquema estadístico por población
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.4 }}>
                Lectura ordenada de estudiantes, docentes y administrativos: entrantes, salientes, entidades, convenios, actividades, países, departamentos y municipios.
              </Typography>
            </Box>
            <Chip label="Formato SNIES" size="small" sx={{ bgcolor: '#eef2ff', color: '#4338ca', fontWeight: 900 }} />
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', xl: 'repeat(3, 1fr)' }, gap: 1.8 }}>
            {populationSchema.map((section) => {
              const Icon = section.icon;
              const directions = [
                { key: 'entrantes', title: 'Movilidad entrante', color: '#2563eb', data: section.profile.entrantes || {} },
                { key: 'salientes', title: 'Movilidad saliente', color: '#059669', data: section.profile.salientes || {} }
              ];
              return (
                <Paper key={section.key} elevation={0} sx={{ p: 2, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fbfdff' }}>
                  <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 1.8 }}>
                    <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: `${section.color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon sx={{ color: section.color, fontSize: 22 }} />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 0 }}>
                      <Typography sx={{ color: '#0f172a', fontSize: 17, fontWeight: 950 }}>{section.title}</Typography>
                      <Typography sx={{ color: '#64748b', fontSize: 12 }}>{formatMetric(section.profile.total)} registros consolidados</Typography>
                    </Box>
                  </Stack>

                  <Stack spacing={1.6}>
                    {directions.map((direction) => {
                      const rows = [
                        { label: 'Entidades', values: direction.data.entidades || [] },
                        { label: 'Convenios', values: direction.data.convenios || [] },
                        { label: 'Tipo de actividad', values: direction.data.actividades || [] },
                        { label: 'Tipo de movilidad', values: direction.data.tiposMovilidad || [] },
                        { label: direction.key === 'entrantes' ? 'Países de procedencia' : 'País destino', values: direction.data.paises || [] },
                        { label: 'Departamentos', values: direction.data.departamentos || [] },
                        { label: 'Municipios', values: direction.data.municipios || [] }
                      ];
                      return (
                        <Box key={direction.key} sx={{ border: '1px solid #e8eef8', borderRadius: 2.5, overflow: 'hidden', bgcolor: '#fff' }}>
                          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 1.5, py: 1, bgcolor: `${direction.color}0f`, borderBottom: '1px solid #e8eef8' }}>
                            <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 13 }}>{direction.title}</Typography>
                            <Typography sx={{ color: direction.color, fontWeight: 950, fontSize: 18, lineHeight: 1 }}>{formatMetric(direction.data.total)}</Typography>
                          </Stack>
                          <Stack spacing={1} sx={{ p: 1.5 }}>
                            {rows.map((group) => {
                              const first = group.values?.[0];
                              return (
                                <Box key={group.label}>
                                  <Typography sx={{ color: '#64748b', fontSize: 10.5, fontWeight: 950, textTransform: 'uppercase', mb: 0.5 }}>
                                    {group.label}
                                  </Typography>
                                  {first ? (
                                    <Stack spacing={0.45}>
                                      {group.values.slice(0, 3).map((item) => (
                                        <Stack key={`${group.label}-${item.name}`} direction="row" spacing={0.8} alignItems="center">
                                          <Typography sx={{ flex: 1, color: '#334155', fontSize: 12, fontWeight: 700 }} noWrap>{item.name}</Typography>
                                          <Chip label={formatMetric(item.value)} size="small" sx={{ height: 20, bgcolor: '#f1f5f9', color: '#0f172a', fontSize: 10, fontWeight: 900 }} />
                                        </Stack>
                                      ))}
                                    </Stack>
                                  ) : (
                                    <Typography sx={{ color: '#94a3b8', fontSize: 12 }}>Sin registros</Typography>
                                  )}
                                </Box>
                              );
                            })}
                          </Stack>
                        </Box>
                      );
                    })}
                  </Stack>
                </Paper>
              );
            })}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3.5, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: '#f5f3ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <HandshakeIcon sx={{ color: '#7c3aed', fontSize: 23 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: { xs: 20, md: 23 }, fontWeight: 950, color: '#0f172a', lineHeight: 1.08 }}>
                Convenios y cooperación interinstitucional
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.4 }}>
                Organización estadística por tipo de convenio, programa gestor y año de registro.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Chip label={`${formatMetric(convenios?.total || conveniosRows.length)} registrados`} size="small" sx={{ bgcolor: '#f5f3ff', color: '#7c3aed', fontWeight: 900 }} />
              <Chip label={`${formatMetric(activeConvenios)} activos`} size="small" sx={{ bgcolor: '#f0fdf4', color: '#15803d', fontWeight: 900 }} />
            </Stack>
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 1.6 }}>
            {convenioSchema.map((block) => (
              <Box key={block.title} sx={{ p: 1.8, borderRadius: 2.5, border: '1px solid #e8eef8', bgcolor: '#fbfdff' }}>
                <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 14, mb: 1.3 }}>
                  {block.title}
                </Typography>
                <Stack spacing={0.8}>
                  {block.rows.length === 0 && <Typography sx={{ color: '#94a3b8', fontSize: 12 }}>Sin registros</Typography>}
                  {block.rows.map((item) => {
                    const pct = Math.round((Number(item.value || 0) / Math.max(1, convenios?.total || conveniosRows.length)) * 100);
                    return (
                      <Box key={item.name}>
                        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.35 }}>
                          <Typography sx={{ color: '#334155', fontSize: 12.5, fontWeight: 800 }} noWrap>{item.name}</Typography>
                          <Typography sx={{ color: '#7c3aed', fontSize: 12, fontWeight: 950 }}>{formatMetric(item.value)}</Typography>
                        </Stack>
                        <Box sx={{ height: 7, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                          <Box sx={{ width: `${Math.max(5, pct)}%`, height: '100%', bgcolor: '#7c3aed', borderRadius: 999 }} />
                        </Box>
                      </Box>
                    );
                  })}
                </Stack>
              </Box>
            ))}
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ display: 'none', p: { xs: 2.5, md: 3 }, borderRadius: 3.5, border: '1px solid #dbe6f5', bgcolor: '#ffffff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2.4 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: '#eff6ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <InsightsRoundedIcon sx={{ color: '#2563eb', fontSize: 24 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: { xs: 20, md: 24 }, fontWeight: 950, color: '#0f172a', lineHeight: 1.08 }}>
                Resumen estadístico de internacionalización
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.4 }}>
                Vista rápida con datos reales cargados en movilidad y convenios.
              </Typography>
            </Box>
            {overview.loading && (
              <Stack direction="row" spacing={1} alignItems="center">
                <CircularProgress size={18} thickness={4} />
                <Typography sx={{ fontSize: 12, color: '#64748b', fontWeight: 700 }}>Actualizando cifras</Typography>
              </Stack>
            )}
            {overview.error && (
              <Chip label="No se pudieron cargar las cifras" size="small" sx={{ bgcolor: '#fef2f2', color: '#dc2626', fontWeight: 800 }} />
            )}
          </Stack>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(6, 1fr)' }, gap: 1.3, mb: 2.2 }}>
            {statisticalCards.map((card) => {
              const Icon = card.icon;
              return (
                <Box key={card.label} sx={{ p: 1.7, borderRadius: 2.5, border: '1px solid #e2e8f0', bgcolor: '#f8fafc', minHeight: 130 }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.2 }}>
                    <Typography sx={{ fontSize: 11, color: '#64748b', fontWeight: 900, textTransform: 'uppercase', lineHeight: 1.15 }}>
                      {card.label}
                    </Typography>
                    <Box sx={{ width: 30, height: 30, borderRadius: 1.7, bgcolor: `${card.color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                      <Icon sx={{ color: card.color, fontSize: 18 }} />
                    </Box>
                  </Stack>
                  <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: { xs: 28, md: 30 }, lineHeight: 1 }}>
                    {formatMetric(card.value)}
                  </Typography>
                  <Typography sx={{ color: '#64748b', fontSize: 11.5, mt: 0.8, lineHeight: 1.25 }}>
                    {card.sub}
                  </Typography>
                </Box>
              );
            })}
          </Box>

          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1.25fr 0.75fr' }, gap: 2 }}>
            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e8eef8', bgcolor: '#fbfdff' }}>
              <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 14, mb: 1.6 }}>
                Evolución por período académico
              </Typography>
              <Stack spacing={1.1}>
                {periodBars.length === 0 && (
                  <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Aún no hay períodos para graficar.</Typography>
                )}
                {periodBars.map((row) => {
                  const pct = Math.max(6, (Number(row.value || 0) / maxPeriodValue) * 100);
                  return (
                    <Stack key={row.name} direction="row" spacing={1.2} alignItems="center">
                      <Typography sx={{ width: 72, color: '#475569', fontSize: 12, fontWeight: 800, flexShrink: 0 }}>{row.name}</Typography>
                      <Box sx={{ flex: 1, height: 12, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                        <Box sx={{ width: `${pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg, #2563eb, #06b6d4)' }} />
                      </Box>
                      <Typography sx={{ width: 54, textAlign: 'right', color: '#0f172a', fontSize: 12, fontWeight: 900 }}>{formatMetric(row.value)}</Typography>
                    </Stack>
                  );
                })}
              </Stack>
            </Box>

            <Box sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e8eef8', bgcolor: '#fbfdff' }}>
              <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 14, mb: 1.6 }}>
                Movilidad por tipo de persona
              </Typography>
              <Stack spacing={1.4}>
                {peopleStats.map((item) => {
                  const totalPeople = Math.max(1, studentMobility + teacherMobility + adminMobility);
                  const pct = Math.round((Number(item.value || 0) / totalPeople) * 100);
                  return (
                    <Box key={item.label}>
                      <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                        <Typography sx={{ color: '#475569', fontSize: 12.5, fontWeight: 800 }}>{item.label}</Typography>
                        <Typography sx={{ color: '#0f172a', fontSize: 12.5, fontWeight: 900 }}>{formatMetric(item.value)} · {pct}%</Typography>
                      </Stack>
                      <Box sx={{ height: 8, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                        <Box sx={{ width: `${Math.max(4, pct)}%`, height: '100%', bgcolor: item.color, borderRadius: 999 }} />
                      </Box>
                    </Box>
                  );
                })}
              </Stack>
            </Box>
          </Box>
        </Paper>

        <Paper elevation={0} sx={{ display: 'none', p: { xs: 2.5, md: 3 }, borderRadius: 3.5, border: '1px solid #dbe6f5', bgcolor: '#ffffff' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.4} alignItems={{ xs: 'flex-start', md: 'center' }} sx={{ mb: 2.2 }}>
            <Box sx={{ width: 42, height: 42, borderRadius: 2, bgcolor: '#f5f3ff', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <TimelineRoundedIcon sx={{ color: '#7c3aed', fontSize: 23 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography sx={{ fontSize: { xs: 20, md: 23 }, fontWeight: 950, color: '#0f172a', lineHeight: 1.08 }}>
                Matriz estadística SNIES por período académico
              </Typography>
              <Typography sx={{ fontSize: 13, color: '#64748b', mt: 0.4 }}>
                Indicadores consolidados para movilidad, cooperación, convenios, países, aliados y modalidades.
              </Typography>
            </Box>
            <Chip label="IP / IIP histórico" size="small" sx={{ bgcolor: '#eef2ff', color: '#4338ca', fontWeight: 900 }} />
          </Stack>

          <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2.5, overflow: 'hidden' }}>
            <Box sx={{ display: { xs: 'none', md: 'grid' }, gridTemplateColumns: '52px 1.5fr 120px 1fr 96px', gap: 1.2, px: 1.8, py: 1.1, bgcolor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              {['No.', 'Indicador requerido', 'Valor', 'Cobertura', '%'].map((label) => (
                <Typography key={label} sx={{ color: '#64748b', fontSize: 11, fontWeight: 950, textTransform: 'uppercase' }}>
                  {label}
                </Typography>
              ))}
            </Box>
            {sniesIndicators.map((row, index) => {
              const denominator = Math.max(1, Number(row.base || row.value || 0));
              const pct = row.base ? Math.round((Number(row.value || 0) / denominator) * 100) : 100;
              return (
                <Box
                  key={row.label}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: { xs: '34px 1fr', md: '52px 1.5fr 120px 1fr 96px' },
                    gap: { xs: 0.8, md: 1.2 },
                    alignItems: 'center',
                    px: 1.8,
                    py: 1.15,
                    bgcolor: index % 2 === 0 ? '#ffffff' : '#f8fafc',
                    borderBottom: index === sniesIndicators.length - 1 ? 'none' : '1px solid #edf2f7'
                  }}
                >
                  <Typography sx={{ color: '#94a3b8', fontSize: 11, fontWeight: 950 }}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ color: '#0f172a', fontSize: 13.2, fontWeight: 900, lineHeight: 1.2 }}>
                      {row.label}
                    </Typography>
                    <Typography sx={{ display: { xs: 'block', md: 'none' }, color: '#64748b', fontSize: 11.5, mt: 0.35 }}>
                      {row.scope}
                    </Typography>
                  </Box>
                  <Typography sx={{ color: row.color, fontSize: { xs: 22, md: 18 }, fontWeight: 950, textAlign: { xs: 'left', md: 'right' } }}>
                    {formatMetric(row.value)}
                  </Typography>
                  <Box sx={{ display: { xs: 'none', md: 'block' }, minWidth: 0 }}>
                    <Typography sx={{ color: '#475569', fontSize: 12, fontWeight: 700, mb: 0.45 }}>
                      {row.scope}
                    </Typography>
                    <Box sx={{ height: 7, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(4, Math.min(100, pct))}%`, height: '100%', bgcolor: row.color, borderRadius: 999 }} />
                    </Box>
                  </Box>
                  <Chip label={`${pct}%`} size="small" sx={{ display: { xs: 'none', md: 'inline-flex' }, justifySelf: 'end', bgcolor: `${row.color}14`, color: row.color, fontWeight: 900, minWidth: 58 }} />
                </Box>
              );
            })}
          </Box>
        </Paper>

        <Box sx={{ display: 'none', gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' }, gap: 2.2 }}>
          <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 17, mb: 1.7 }}>
              Top países vinculados
            </Typography>
            <Stack spacing={1.2}>
              {topCountries.length === 0 && <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin países registrados.</Typography>}
              {topCountries.map((row, index) => {
                const pct = Math.round((Number(row.value || 0) / Math.max(1, movilidad?.total || 0)) * 100);
                return (
                  <Stack key={row.name} direction="row" spacing={1.2} alignItems="center">
                    <Typography sx={{ width: 24, color: '#94a3b8', fontSize: 11, fontWeight: 900 }}>{index + 1}</Typography>
                    <Typography sx={{ flex: 1, color: '#334155', fontWeight: 800, fontSize: 13 }} noWrap>{row.name}</Typography>
                    <Box sx={{ width: { xs: 88, sm: 160 }, height: 8, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(5, pct)}%`, height: '100%', bgcolor: '#0891b2', borderRadius: 999 }} />
                    </Box>
                    <Typography sx={{ width: 54, textAlign: 'right', color: '#0f172a', fontSize: 12, fontWeight: 900 }}>{formatMetric(row.value)}</Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
            <Typography sx={{ color: '#0f172a', fontWeight: 950, fontSize: 17, mb: 1.7 }}>
              Top tipos de movilidad
            </Typography>
            <Stack spacing={1.2}>
              {topMobilityTypes.length === 0 && <Typography sx={{ color: '#94a3b8', fontSize: 13 }}>Sin tipos de movilidad registrados.</Typography>}
              {topMobilityTypes.map((row, index) => {
                const pct = Math.round((Number(row.value || 0) / Math.max(1, movilidad?.total || 0)) * 100);
                return (
                  <Stack key={row.name} direction="row" spacing={1.2} alignItems="center">
                    <Typography sx={{ width: 24, color: '#94a3b8', fontSize: 11, fontWeight: 900 }}>{index + 1}</Typography>
                    <Typography sx={{ flex: 1, color: '#334155', fontWeight: 800, fontSize: 13 }} noWrap>{row.name}</Typography>
                    <Box sx={{ width: { xs: 88, sm: 160 }, height: 8, borderRadius: 999, bgcolor: '#e2e8f0', overflow: 'hidden' }}>
                      <Box sx={{ width: `${Math.max(5, pct)}%`, height: '100%', bgcolor: '#7c3aed', borderRadius: 999 }} />
                    </Box>
                    <Typography sx={{ width: 54, textAlign: 'right', color: '#0f172a', fontSize: 12, fontWeight: 900 }}>{formatMetric(row.value)}</Typography>
                  </Stack>
                );
              })}
            </Stack>
          </Paper>
        </Box>

        {false && (<>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', lg: '1.05fr 0.95fr' },
            gap: 2.2
          }}
        >
          <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#ecfeff', display: 'grid', placeItems: 'center' }}>
                <InsightsRoundedIcon sx={{ color: '#0891b2', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  Alcance de información requerida
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                  Estructura base para reporte institucional y evolución histórica.
                </Typography>
              </Box>
            </Stack>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)' }, gap: 1.4 }}>
              {STRATEGIC_SCOPE.map((block) => {
                const Icon = block.icon;
                return (
                  <Box key={block.title} sx={{ p: 2, borderRadius: 2.5, border: '1px solid #e8eef8', bgcolor: '#f8fafc', minHeight: 168 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.3 }}>
                      <Box sx={{ width: 32, height: 32, borderRadius: 1.8, bgcolor: `${block.color}18`, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                        <Icon sx={{ color: block.color, fontSize: 19 }} />
                      </Box>
                      <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 14 }}>{block.title}</Typography>
                    </Stack>
                    <Stack spacing={0.8}>
                      {block.items.map((item) => (
                        <Stack key={item} direction="row" spacing={0.8} alignItems="flex-start">
                          <CheckCircleRoundedIcon sx={{ color: block.color, fontSize: 15, mt: '2px', flexShrink: 0 }} />
                          <Typography sx={{ color: '#475569', fontSize: 12.5, lineHeight: 1.35 }}>{item}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Box>
                );
              })}
            </Box>
          </Paper>

          <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#fff' }}>
            <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
              <Box sx={{ width: 38, height: 38, borderRadius: 2, bgcolor: '#f5f3ff', display: 'grid', placeItems: 'center' }}>
                <TimelineRoundedIcon sx={{ color: '#7c3aed', fontSize: 22 }} />
              </Box>
              <Box>
                <Typography sx={{ fontSize: 18, fontWeight: 900, color: '#0f172a' }}>
                  Matriz de seguimiento histórico
                </Typography>
                <Typography sx={{ fontSize: 12.5, color: '#64748b' }}>
                  Lectura consolidada por período académico IP y IIP.
                </Typography>
              </Box>
            </Stack>

            <Box sx={{ border: '1px solid #e8eef8', borderRadius: 2.5, overflow: 'hidden' }}>
              {TRACKING_MATRIX.map((item, index) => (
                <Stack
                  key={item}
                  direction="row"
                  spacing={1.4}
                  alignItems="center"
                  sx={{
                    px: 1.8,
                    py: 1.1,
                    bgcolor: index % 2 === 0 ? '#f8fafc' : '#ffffff',
                    borderBottom: index === TRACKING_MATRIX.length - 1 ? 'none' : '1px solid #edf2f7'
                  }}
                >
                  <Typography sx={{ width: 30, color: '#94a3b8', fontSize: 11, fontWeight: 900, flexShrink: 0 }}>
                    {String(index + 1).padStart(2, '0')}
                  </Typography>
                  <Typography sx={{ flex: 1, color: '#334155', fontWeight: 700, fontSize: 12.8, lineHeight: 1.25 }}>
                    {item}
                  </Typography>
                  <Chip label="IP / IIP" size="small" sx={{ bgcolor: '#eef2ff', color: '#4338ca', fontWeight: 800, fontSize: 10.5 }} />
                </Stack>
              ))}
            </Box>
          </Paper>
        </Box>

        <Paper elevation={0} sx={{ p: { xs: 2.5, md: 3 }, borderRadius: 3, border: '1px solid #e2e8f0', bgcolor: '#ffffff' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2.4 }}>
            <Box>
              <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 1.8 }}>
                <CheckCircleRoundedIcon sx={{ color: '#059669' }} />
                <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 17 }}>
                  Lo que ya está encaminado
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {CURRENT_COVERAGE.map((item) => (
                  <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#059669', mt: '7px', flexShrink: 0 }} />
                    <Typography sx={{ color: '#475569', fontSize: 13.5, lineHeight: 1.45 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>

            <Box>
              <Stack direction="row" spacing={1.1} alignItems="center" sx={{ mb: 1.8 }}>
                <HelpOutlineRoundedIcon sx={{ color: '#d97706' }} />
                <Typography sx={{ color: '#0f172a', fontWeight: 900, fontSize: 17 }}>
                  Lo que falta aclarar o completar
                </Typography>
              </Stack>
              <Stack spacing={1}>
                {CLARITY_PENDING.map((item) => (
                  <Stack key={item} direction="row" spacing={1} alignItems="flex-start">
                    <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#d97706', mt: '7px', flexShrink: 0 }} />
                    <Typography sx={{ color: '#475569', fontSize: 13.5, lineHeight: 1.45 }}>{item}</Typography>
                  </Stack>
                ))}
              </Stack>
            </Box>
          </Box>

          <Divider sx={{ my: 2.4 }} />

          <Typography sx={{ color: '#64748b', fontSize: 12.5, lineHeight: 1.45 }}>
            Resultado esperado: reportar indicadores SNIES con oportunidad, fortalecer autoevaluación y acreditación, identificar tendencias por período, medir impacto de convenios y apoyar decisiones de cooperación académica y visibilidad internacional.
          </Typography>
        </Paper>
        </>)}
      </Stack>
    </Fade>
  );
}

export default InternacionalizacionLandingPage;
