import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Fade,
  Grid,
  Paper,
  Stack,
  Typography
} from '@mui/material';
import {
  AccountTree as ProcessIcon,
  Assessment as AssessmentIcon,
  CheckCircle as CheckIcon,
  Description as DescriptionIcon,
  EnergySavingsLeaf as EcoIcon,
  ManageSearch as SearchIcon,
  PolicyOutlined as PolicyIcon,
  Security as SecurityIcon,
  SummarizeOutlined as DocsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import documentoService from '../services/documentoService';

function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [quickDocs, setQuickDocs] = useState([]);

  useEffect(() => {
    if (user?.role !== 'consulta') return;

    documentoService
      .getDocumentos({}, 1, 12)
      .then((response) => {
        const docs = response?.data?.documentos || [];
        setQuickDocs(docs.slice(0, 6));
      })
      .catch(() => setQuickDocs([]));
  }, [user?.role]);

  const commonSearches = useMemo(
    () => [
      { label: 'Manuales', titulo: 'Manual' },
      { label: 'Procedimientos', titulo: 'Procedimiento' },
      { label: 'Formatos', titulo: 'Formato' },
      { label: 'Instructivos', titulo: 'Instructivo' }
    ],
    []
  );

  if (user?.role === 'consulta') {
    return (
      <Container maxWidth="xl">
        <Fade in={true} timeout={500}>
          <Box>
            <Paper
              elevation={0}
              sx={{
                mb: 4,
                p: { xs: 2.5, md: 4 },
                borderRadius: 4,
                border: '1px solid #d7e3f5',
                background: 'linear-gradient(135deg, #0f172a 0%, #1d4ed8 40%, #be123c 100%)',
                color: 'white',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems={{ md: 'center' }} sx={{ position: 'relative', zIndex: 1 }}>
                <Box sx={{ width: 96, height: 96, borderRadius: '50%', border: '3px solid #fff', overflow: 'hidden', bgcolor: 'white', boxShadow: '0 8px 26px rgba(15, 23, 42, 0.35)' }}>
                  <Box
                    component="img"
                    src="/escudo.png"
                    alt="Escudo Universidad CESMAG"
                    sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                </Box>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="h4" sx={{ fontWeight: 900, mb: 1, letterSpacing: 0.2 }}>
                    Inicio de Consulta Documental
                  </Typography>
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Accede al mapa de procesos y encuentra documentos institucionales de forma rápida y clara.
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  startIcon={<SearchIcon />}
                  onClick={() => navigate('/dashboard/buscar-documentos')}
                  sx={{
                    textTransform: 'none',
                    fontWeight: 800,
                    borderRadius: 2.5,
                    px: 3,
                    bgcolor: '#fff',
                    color: '#0b1e46',
                    '&:hover': { bgcolor: '#f1f5f9' }
                  }}
                >
                  Buscar Documentos
                </Button>
              </Stack>
            </Paper>

            <Grid container spacing={3}>
              <Grid item xs={12} lg={8}>
                <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                    <ProcessIcon sx={{ color: '#1d4ed8' }} />
                    <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                      Mapa de Procesos Institucional
                    </Typography>
                  </Stack>
                  <Box
                    sx={{
                      borderRadius: 2,
                      overflow: 'hidden',
                      border: '1px solid #93c5fd',
                      minHeight: { xs: 260, md: 460 },
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: '#f8fafc',
                      boxShadow: 'inset 0 0 0 1px rgba(29, 78, 216, 0.08)'
                    }}
                  >
                    <Box
                      component="img"
                      src="/mapa_procesos.png"
                      alt="Mapa de procesos CESMAG"
                      sx={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </Box>
                </Paper>
              </Grid>

              <Grid item xs={12} lg={4}>
                <Stack spacing={2.5}>
                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <PolicyIcon sx={{ color: '#be123c' }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                        Consulta Rápida
                      </Typography>
                    </Stack>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {commonSearches.map((item) => (
                        <Chip
                          key={item.label}
                          label={item.label}
                          icon={<DescriptionIcon />}
                          onClick={() => navigate(`/dashboard/buscar-documentos?titulo=${encodeURIComponent(item.titulo)}`)}
                          sx={{
                            fontWeight: 700,
                            bgcolor: '#eff6ff',
                            color: '#1d4ed8',
                            border: '1px solid #bfdbfe',
                            '&:hover': { bgcolor: '#dbeafe' }
                          }}
                        />
                      ))}
                    </Stack>
                  </Paper>

                  <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid #e2e8f0' }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2 }}>
                      <DocsIcon sx={{ color: '#1d4ed8' }} />
                      <Typography variant="h6" sx={{ fontWeight: 800, color: '#1e293b' }}>
                        Documentos Recientes
                      </Typography>
                    </Stack>
                    {quickDocs.length === 0 ? (
                      <Alert severity="info">Aún no hay resultados para mostrar.</Alert>
                    ) : (
                      <Stack spacing={1}>
                        {quickDocs.map((doc) => (
                          <Card key={doc.id} variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent sx={{ py: '10px !important' }}>
                              <Typography sx={{ fontWeight: 700, color: '#0f172a', fontSize: 14 }}>
                                {doc.codigo} - {doc.titulo}
                              </Typography>
                              <Typography variant="caption" sx={{ color: '#64748b' }}>
                                {doc?.tipoDocumentacion?.nombre || 'Tipo no definido'}
                              </Typography>
                            </CardContent>
                          </Card>
                        ))}
                      </Stack>
                    )}
                  </Paper>
                </Stack>
              </Grid>
            </Grid>
          </Box>
        </Fade>
      </Container>
    );
  }

  const modules = [
    {
      title: 'Aseguramiento de la Calidad',
      description: 'Gestiona documentos, manuales, procedimientos y formatos del sistema de calidad',
      icon: <CheckIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      path: '/dashboard/aseguramiento-calidad',
      active: true
    },
    {
      title: 'Sistema Ambiental',
      description: 'Próximamente: Gestión ambiental y sostenibilidad',
      icon: <EcoIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)',
      path: null,
      active: false
    },
    {
      title: 'Seguridad y Salud',
      description: 'Próximamente: SST y gestión de riesgos laborales',
      icon: <SecurityIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
      path: null,
      active: false
    },
    {
      title: 'Indicadores',
      description: 'Próximamente: Dashboard de indicadores y KPIs',
      icon: <AssessmentIcon sx={{ fontSize: 60 }} />,
      color: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
      path: null,
      active: false
    }
  ];

  return (
    <Container maxWidth="xl">
      <Fade in={true} timeout={500}>
        <Box>
          <Box sx={{ 
            mb: 6, 
            p: 4, 
            borderRadius: 4, 
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            boxShadow: '0 8px 32px rgba(102, 126, 234, 0.3)'
          }}>
            <Typography variant="h3" sx={{ fontWeight: 800, color: 'white', mb: 1 }}>
              Bienvenido, {user?.nombre}
            </Typography>
            <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)', fontWeight: 400 }}>
              Sistema Integrado de Gestión - Calidad, Ambiente, SST
            </Typography>
          </Box>

          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                boxShadow: '0 4px 14px rgba(102, 126, 234, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>MÓDULOS ACTIVOS</Typography>
                  <Typography variant="h2" sx={{ fontWeight: 800, color: 'white', my: 1 }}>1</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>de 4 disponibles</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                boxShadow: '0 4px 14px rgba(240, 147, 251, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>USUARIO</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', my: 1 }}>{user?.role === 'administrador' ? 'Administrador' : 'Consulta'}</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Nivel de acceso</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                boxShadow: '0 4px 14px rgba(79, 172, 254, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>ESTADO</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', my: 1 }}>Activo</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Sistema operativo</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <Card sx={{ 
                borderRadius: 3, 
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                boxShadow: '0 4px 14px rgba(67, 233, 123, 0.3)'
              }}>
                <CardContent>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>VERSIÓN</Typography>
                  <Typography variant="h5" sx={{ fontWeight: 700, color: 'white', my: 1 }}>1.0.0</Typography>
                  <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }}>Última actualización</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Box sx={{ mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
              Módulos del Sistema
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748b', mb: 3 }}>
              Accede a las diferentes áreas del sistema integrado de gestión
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {modules.map((module) => (
              <Grid item xs={12} sm={6} md={6} lg={3} key={module.title}>
                <Card 
                  sx={{ 
                    height: '100%',
                    borderRadius: 4,
                    border: '2px solid',
                    borderColor: module.active ? 'transparent' : '#e2e8f0',
                    boxShadow: module.active ? '0 8px 24px rgba(102, 126, 234, 0.2)' : 'none',
                    transition: 'all 0.3s',
                    opacity: module.active ? 1 : 0.6,
                    position: 'relative',
                    overflow: 'hidden',
                    '&:hover': { boxShadow: module.active ? '0 12px 32px rgba(102, 126, 234, 0.3)' : 'none' }
                  }}
                >
                  {!module.active && (
                    <Box sx={{ 
                      position: 'absolute', 
                      top: 16, 
                      right: 16, 
                      bgcolor: '#f59e0b', 
                      color: 'white', 
                      px: 2, 
                      py: 0.5, 
                      borderRadius: 2,
                      fontSize: 11,
                      fontWeight: 700
                    }}>
                      PRÓXIMAMENTE
                    </Box>
                  )}
                  <Box
                    sx={{ height: '100%', p: 3, cursor: module.active ? 'pointer' : 'default' }}
                    onClick={() => module.active && navigate(module.path)}
                  >
                    <CardContent>
                      <Box sx={{ 
                        width: 80, 
                        height: 80, 
                        borderRadius: 3, 
                        background: module.color,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        mb: 3,
                        boxShadow: '0 4px 14px rgba(0,0,0,0.1)'
                      }}>
                        <Box sx={{ color: 'white' }}>
                          {module.icon}
                        </Box>
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 1 }}>
                        {module.title}
                      </Typography>
                      <Typography variant="body2" sx={{ color: '#64748b', lineHeight: 1.6 }}>
                        {module.description}
                      </Typography>
                    </CardContent>
                  </Box>
                </Card>
              </Grid>
            ))}
          </Grid>

          <Box sx={{ mt: 6, p: 4, bgcolor: '#f8fafc', borderRadius: 3, border: '1px solid #e2e8f0' }}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                  Recursos Disponibles
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Gestión documental completa
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Filtros jerárquicos inteligentes
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Importación masiva desde Excel
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  • Control de versiones y estados
                </Typography>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#1e293b', mb: 2 }}>
                  Próximas Actualizaciones
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Sistema de gestión ambiental
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Módulo de seguridad y salud en el trabajo
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b', mb: 1 }}>
                  • Dashboard de indicadores de desempeño
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748b' }}>
                  • Reportes y analytics avanzados
                </Typography>
              </Grid>
            </Grid>
          </Box>
        </Box>
      </Fade>
    </Container>
  );
}

export default Dashboard;
