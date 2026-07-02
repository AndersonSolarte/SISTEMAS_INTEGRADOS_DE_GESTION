import React, { useState } from 'react';
import { ROLES } from '../../constants/roles';
import {
  Box,
  Button,
  Chip,
  Fade,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import FlightIcon from '@mui/icons-material/Flight';
import HandshakeIcon from '@mui/icons-material/Handshake';
import PublicIcon from '@mui/icons-material/Public';
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
    gradient: 'linear-gradient(145deg,#0891b2,#0e7490 55%,#164e63)',
    shadow: 'rgba(8,145,178,0.22)',
    chip: 'Gestión de datos',
    btnLabel: 'Ir a cargue de datos'
  },
  {
    key: 'movilidad',
    label: 'Estadística de Movilidad',
    description: 'Dashboard interactivo con indicadores, gráficas y filtros estratégicos sobre movilidad nacional e internacional por período, país, tipo de persona y actividad.',
    icon: FlightIcon,
    color: '#1d4ed8',
    gradient: 'linear-gradient(145deg,#1d4ed8,#1e40af 55%,#1e3a8a)',
    shadow: 'rgba(29,78,216,0.22)',
    chip: 'Dashboard',
    btnLabel: 'Abrir dashboard'
  },
  {
    key: 'convenios',
    label: 'Convenios',
    description: 'Consulta el catálogo de convenios de internacionalización con búsqueda inteligente, filtros por tipo y año, y acceso directo a los documentos adjuntos.',
    icon: HandshakeIcon,
    color: '#7c3aed',
    gradient: 'linear-gradient(145deg,#7c3aed,#6d28d9 55%,#5b21b6)',
    shadow: 'rgba(124,58,237,0.22)',
    chip: 'Consulta',
    btnLabel: 'Abrir módulo'
  }
];


function InternacionalizacionLandingPage({ user, onBack }) {
  const [subView, setSubView] = useState(null);

  const isAdminOrPlaneacion = [ROLES.ADMINISTRADOR, ROLES.PLANEACION_ESTRATEGICA].includes(user?.role);
  const userPermissions = user?.permissions || [];
  
  const canViewGestion = isAdminOrPlaneacion || (user?.allowedInternacionalizacionDashboards || []).includes('internacionalizacion_gestion');
  const canViewEstadistica = isAdminOrPlaneacion || (user?.allowedInternacionalizacionDashboards || []).includes('internacionalizacion_estadistica');
  const canViewConvenios = isAdminOrPlaneacion || (user?.allowedInternacionalizacionDashboards || []).includes('internacionalizacion_convenios');

  const VISIBLE_CARDS = SUB_CARDS.filter(card => {
    if (card.key === 'gestion') return canViewGestion;
    if (card.key === 'movilidad') return canViewEstadistica;
    if (card.key === 'convenios') return canViewConvenios;
    return false;
  });


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

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.8, md: 2.5 },
            borderRadius: 4,
            border: '1px solid #dbe6f5',
            bgcolor: '#f8fbff'
          }}
        >
          <Box
            sx={{
              display: 'grid',
              gap: 2.5,
              gridTemplateColumns: {
                xs: '1fr',
                md: 'repeat(auto-fit, minmax(280px, 1fr))'
              },
              alignItems: 'stretch',
              width: '100%'
            }}
          >
          {VISIBLE_CARDS.length === 0 && (
            <Paper elevation={0} sx={{ p: 3, gridColumn: '1 / -1', borderRadius: 2.5, border: '1px solid #f8ecc8', bgcolor: '#fffcf2' }}>
              <Stack direction='row' spacing={1.5} alignItems='center'>
                <Typography sx={{ color: '#b45309', fontWeight: 700, fontSize: 14 }}>
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
                sx={{
                  borderRadius: 4,
                  p: { xs: 2.2, md: 2.8 },
                  border: '1px solid #dbe6f5',
                  minHeight: { xs: 230, md: 280 },
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  background: 'linear-gradient(180deg,#f8fbff 0%,#ffffff 100%)',
                  boxShadow: '0 10px 28px rgba(15,23,42,0.04)',
                  transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                  '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: `0 14px 34px ${card.shadow}`,
                    borderColor: '#bfd4fb'
                  }
                }}
              >
                <Stack spacing={1.8}>
                  <Stack direction="row" alignItems="flex-start" justifyContent="space-between">
                    <Box
                      sx={{
                        width: 74,
                        height: 74,
                        borderRadius: 2.5,
                        background: card.gradient,
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: `0 10px 22px ${card.shadow}`
                      }}
                    >
                      <Icon sx={{ color: '#fff', fontSize: 36 }} />
                    </Box>
                    <Chip
                      size="small"
                      label={card.chip}
                      sx={{
                        bgcolor: '#f0fdf4',
                        color: '#15803d',
                        border: '1px solid #bbf7d0',
                        fontWeight: 800,
                        fontSize: 11
                      }}
                    />
                  </Stack>

                  <Box sx={{ minHeight: 90 }}>
                    <Typography
                      sx={{
                        fontSize: { xs: 20, md: 23 },
                        fontWeight: 900,
                        color: '#0f172a',
                        lineHeight: 1.08,
                        letterSpacing: '-0.02em'
                      }}
                    >
                      {card.label}
                    </Typography>
                    <Typography
                      sx={{
                        mt: 0.8,
                        color: '#475569',
                        lineHeight: 1.35,
                        fontSize: { xs: 13, md: 14 }
                      }}
                    >
                      {card.description}
                    </Typography>
                  </Box>
                </Stack>

                <Box sx={{ pt: 1 }}>
                  <Button
                    fullWidth
                    variant="contained"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => setSubView(card.key)}
                    sx={{
                      mt: 1,
                      borderRadius: 999,
                      py: 1.15,
                      textTransform: 'none',
                      fontWeight: 800,
                      letterSpacing: '-0.01em',
                      background: card.gradient,
                      boxShadow: `0 10px 22px ${card.shadow}`,
                      '&:hover': { background: card.gradient, filter: 'brightness(1.08)' }
                    }}
                  >
                    {card.btnLabel}
                  </Button>
                </Box>
              </Paper>
            );
          })}
          </Box>
        </Paper>
      </Stack>
    </Fade>
  );
}

export default InternacionalizacionLandingPage;
