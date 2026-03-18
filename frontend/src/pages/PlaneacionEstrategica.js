import React, { useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Card, CardContent, Stack, Typography, Button, Fade, Chip, Paper, Alert } from '@mui/material';
import {
  Insights as InsightsIcon,
  Timeline as TimelineIcon,
  FactCheck as FactCheckIcon,
  Search as SearchIcon,
  Verified as VerifiedIcon,
  Hub as HubIcon
} from '@mui/icons-material';

function PlaneacionEstrategica() {
  const navigate = useNavigate();
  const location = useLocation();
  const view = useMemo(() => new URLSearchParams(location.search).get('view') || '', [location.search]);
  const gpPanel = useMemo(() => new URLSearchParams(location.search).get('panel') || '', [location.search]);
  const isConstructionView = ['planeacion-efectividad', 'autoevaluacion', 'registros-calificados'].includes(view);
  const isGestionProcesosInfoView = view === 'gestion-procesos-informacion';
  const isGestionProcesosModulesView = isGestionProcesosInfoView && gpPanel === 'gestion_procesos';

  const headerConfig = useMemo(() => {
    if (isGestionProcesosModulesView) {
      return {
        title: 'Gestión por Procesos',
        subtitle: 'Selecciona el módulo operativo institucional habilitado para este perfil.',
        icon: <HubIcon sx={{ color: '#1d4ed8' }} />
      };
    }
    if (view === 'planeacion-efectividad') {
      return {
        title: 'Planeación y Efectividad',
        subtitle: 'Seguimiento, control y resultados del módulo estratégico.',
        icon: <TimelineIcon sx={{ color: '#1d4ed8' }} />
      };
    }
    if (view === 'autoevaluacion') {
      return {
        title: 'Autoevaluación',
        subtitle: 'Planeación de mejora y evaluación continua del módulo.',
        icon: <FactCheckIcon sx={{ color: '#1d4ed8' }} />
      };
    }
    if (view === 'registros-calificados') {
      return {
        title: 'Registros Calificados y Acreditación',
        subtitle: 'Gestión estratégica de evidencias, renovaciones y acreditación.',
        icon: <VerifiedIcon sx={{ color: '#1d4ed8' }} />
      };
    }
    if (isGestionProcesosInfoView) {
      return {
        title: 'Gestión por Procesos y la Información',
        subtitle: 'Visualización estratégica y acceso organizado a módulos institucionales.',
        icon: <HubIcon sx={{ color: '#1d4ed8' }} />
      };
    }
    return {
      title: 'Módulo Planeación Estratégica',
      subtitle: 'Administra submódulos, consolidados y resultados institucionales.',
      icon: <InsightsIcon sx={{ color: '#1d4ed8' }} />
    };
  }, [isGestionProcesosInfoView, isGestionProcesosModulesView, view]);

  const modules = [
    {
      title: 'Planeación y Efectividad',
      description: 'Planes de acción, seguimiento y dashboard de cumplimiento.',
      path: '/dashboard/planeacion-estrategica?view=planeacion-efectividad',
      icon: <TimelineIcon sx={{ fontSize: 44 }} />,
      active: true,
      construction: true
    },
    {
      title: 'Autoevaluación',
      description: 'Planes de mejoramiento y tableros de autoevaluación.',
      path: '/dashboard/planeacion-estrategica?view=autoevaluacion',
      icon: <FactCheckIcon sx={{ fontSize: 44 }} />,
      active: true,
      construction: true
    },
    {
      title: 'Registros Calificados y Acreditación',
      description: 'Seguimiento de evidencias, renovaciones y acreditación institucional.',
      path: '/dashboard/planeacion-estrategica?view=registros-calificados',
      icon: <VerifiedIcon sx={{ fontSize: 44 }} />,
      active: true,
      construction: true
    },
    {
      title: 'Gestión por Procesos y la Información',
      description: 'Acceso a tableros estadísticos y consulta documental.',
      path: '/dashboard/planeacion-estrategica?view=gestion-procesos-informacion',
      icon: <HubIcon sx={{ fontSize: 44 }} />,
      active: true
    }
  ];

  return (
    <Fade in={true}>
      <Box>
        <Paper
          elevation={0}
          sx={{
            mb: 3,
            p: { xs: 2, md: 3 },
            borderRadius: 2.5,
            border: '1px solid #dbeafe',
            background: 'linear-gradient(135deg, #0f1f3a 0%, #1d4ed8 55%, #2563eb 100%)',
            color: 'white',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <Box sx={{ position: 'absolute', right: -60, top: -50, width: 220, height: 220, borderRadius: '50%', background: 'rgba(255,255,255,0.09)' }} />
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 0.8, position: 'relative', zIndex: 1 }}>
            <Box sx={{ color: 'white' }}>{headerConfig.icon}</Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'white', letterSpacing: -0.2 }}>
              {headerConfig.title}
            </Typography>
          </Stack>
          <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.92)', position: 'relative', zIndex: 1 }}>
            {headerConfig.subtitle}
          </Typography>
        </Paper>

        {!isConstructionView && !isGestionProcesosInfoView && (
          <Box
            sx={{
              display: 'grid',
              gap: 2.2,
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              alignItems: 'stretch'
            }}
          >
            {modules.map((module) => (
              <Card
                key={module.title}
                sx={{
                  borderRadius: 3,
                  border: '1px solid #e2e8f0',
                  height: '100%',
                  opacity: module.active ? 1 : 0.95,
                  display: 'flex',
                  minHeight: { xs: 260, md: 300 }
                }}
              >
                <CardContent sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 2 }}>
                    <Box sx={{ color: '#1d4ed8' }}>{module.icon}</Box>
                    {module.construction && <Chip label="En construcción" size="small" color="warning" />}
                  </Stack>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                    {module.title}
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                    {module.description}
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate(module.path)}
                    sx={{ borderRadius: 2, mt: 'auto' }}
                  >
                    Ingresar
                  </Button>
                </CardContent>
              </Card>
            ))}
          </Box>
        )}

        {isConstructionView && (
          <Box sx={{ mt: 3 }}>
            <Alert severity="info">
              Este módulo está en construcción. Ya quedó habilitado en menú y con acceso para ir organizándolo por fases.
            </Alert>
          </Box>
        )}

        {isGestionProcesosInfoView && !isGestionProcesosModulesView && (
          <Box sx={{ mt: 3, width: '100%' }}>
            <Box
              sx={{
                display: 'grid',
                gap: 2.2,
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                alignItems: 'stretch'
              }}
            >
                <Card
                  sx={{
                    borderRadius: 3,
                    border: '1px solid #dbeafe',
                    background: 'linear-gradient(165deg, #ffffff 0%, #f8fbff 100%)',
                    boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
                    height: '100%',
                    display: 'flex',
                    minHeight: { xs: 270, md: 310 },
                    width: '100%'
                  }}
                >
                  <CardContent sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 2 }}>
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: 2,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: '#dbeafe',
                          color: '#1d4ed8',
                          border: '1px solid #bfdbfe'
                        }}
                      >
                        <InsightsIcon sx={{ fontSize: 30 }} />
                      </Box>
                      <Chip label="Disponible" size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                      Gestión de la Información
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
                      Visualización de módulos estadísticos institucionales.
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => navigate('/dashboard/gestion-informacion?tab=estadistica&source=planeacion_gpinfo')}
                      sx={{
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 800,
                        background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                        boxShadow: '0 8px 20px rgba(37,99,235,.25)'
                      , mt: 'auto' }}
                    >
                      Ingresar
                    </Button>
                  </CardContent>
                </Card>
              <Card
                sx={{
                  borderRadius: 3,
                  border: '1px solid #dbeafe',
                  background: 'linear-gradient(165deg, #ffffff 0%, #f8fbff 100%)',
                  boxShadow: '0 8px 20px rgba(15,23,42,0.06)',
                  height: '100%',
                  display: 'flex',
                  minHeight: { xs: 270, md: 310 },
                  width: '100%'
                }}
              >
                <CardContent sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                  <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: 2,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: '#dbeafe',
                        color: '#1d4ed8',
                        border: '1px solid #bfdbfe'
                      }}
                    >
                      <HubIcon sx={{ fontSize: 30 }} />
                    </Box>
                    <Chip label="Disponible" size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                  </Stack>
                  <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                    Gestión por Procesos
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748b', mb: 1.5 }}>
                    Acceso a estadística documental y búsqueda de documentos.
                  </Typography>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => navigate('/dashboard/planeacion-estrategica?view=gestion-procesos-informacion&panel=gestion_procesos')}
                    sx={{
                      borderRadius: 2,
                      textTransform: 'none',
                      fontWeight: 800,
                      background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                      boxShadow: '0 8px 20px rgba(37,99,235,.25)'
                    , mt: 'auto' }}
                  >
                    Ingresar
                  </Button>
                </CardContent>
              </Card>
            </Box>
          </Box>
        )}

        {isGestionProcesosModulesView && (
          <Box sx={{ mt: 3, width: '100%' }}>
            <Paper elevation={0} sx={{ p: 2.2, mb: 2.2, borderRadius: 3, border: '1px solid #dbeafe', bgcolor: '#f8fbff' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
                <Typography sx={{ fontWeight: 800, color: '#1e293b' }}>
                  Gestión por Procesos: Módulos Disponibles
                </Typography>
              </Stack>
            </Paper>
            <Box
              sx={{
                display: 'grid',
                gap: 2.2,
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                alignItems: 'stretch'
              }}
            >
              <Card sx={{ borderRadius: 3, border: '1px solid #dbeafe', background: 'linear-gradient(165deg, #ffffff 0%, #f8fbff 100%)', boxShadow: '0 8px 20px rgba(15,23,42,0.06)', display: 'flex', height: '100%', minHeight: { xs: 270, md: 310 }, width: '100%' }}>
                  <CardContent sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 2 }}>
                      <Box sx={{ width: 52, height: 52, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        <HubIcon sx={{ fontSize: 30 }} />
                      </Box>
                      <Chip label="Disponible" size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                      Estadística Documental
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
                      Tablero de análisis documental por tipo, macroproceso y periodo institucional.
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      onClick={() => {
                        window.location.assign('/dashboard/gestion-informacion?tab=estadistica&module=gestion_procesos&panel=estadistica_documental&source=planeacion_gpinfo');
                      }}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)', boxShadow: '0 8px 20px rgba(37,99,235,.25)', mt: 'auto' }}
                    >
                      Ingresar
                    </Button>
                  </CardContent>
                </Card>
              <Card sx={{ borderRadius: 3, border: '1px solid #dbeafe', background: 'linear-gradient(165deg, #ffffff 0%, #f8fbff 100%)', boxShadow: '0 8px 20px rgba(15,23,42,0.06)', display: 'flex', height: '100%', minHeight: { xs: 270, md: 310 }, width: '100%' }}>
                  <CardContent sx={{ p: 3, width: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="start" sx={{ mb: 2 }}>
                      <Box sx={{ width: 52, height: 52, borderRadius: 2, display: 'grid', placeItems: 'center', bgcolor: '#dbeafe', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                        <SearchIcon sx={{ fontSize: 30 }} />
                      </Box>
                      <Chip label="Disponible" size="small" sx={{ bgcolor: '#dbeafe', color: '#1d4ed8', fontWeight: 700 }} />
                    </Stack>
                    <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                      Consulta de documentos
                    </Typography>
                    <Typography variant="body2" sx={{ color: '#64748b', mb: 2.5 }}>
                      Consulta documental institucional con filtros por macroproceso, proceso, subproceso y tipo.
                    </Typography>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => navigate('/dashboard/buscar-documentos?readonly=1&source=planeacion')}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 800, mt: 'auto' }}
                    >
                      Ingresar
                    </Button>
                  </CardContent>
                </Card>
            </Box>
          </Box>
        )}

        {!isGestionProcesosInfoView && (
          <Box sx={{ mt: 3 }}>
          <Button
            variant="outlined"
            startIcon={<SearchIcon />}
            onClick={() => navigate('/dashboard/buscar-documentos')}
            sx={{ borderRadius: 2 }}
          >
            Consulta de documentos
          </Button>
          </Box>
        )}
      </Box>
    </Fade>
  );
}

export default PlaneacionEstrategica;

