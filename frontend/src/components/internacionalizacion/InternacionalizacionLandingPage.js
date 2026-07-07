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
      </Stack>
    </Fade>
  );
}

export default InternacionalizacionLandingPage;
