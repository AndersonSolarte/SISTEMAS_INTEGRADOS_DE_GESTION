import React, { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, Typography, IconButton, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Avatar, Chip, Divider, Tooltip, Collapse, Button } from '@mui/material';
import {
  Menu as MenuIcon, DashboardCustomize as DashboardIcon,
  Verified as CheckIcon, Logout as LogoutIcon, Settings as SettingsIcon,
  GroupOutlined as PeopleIcon, DescriptionOutlined as DescriptionIcon, ManageSearch as ExploreIcon,
  Insights as InsightsIcon, Timeline as TimelineIcon, FactCheck as FactCheckIcon,
  ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon, QueryStats as QueryStatsIcon,
  Hub as HubIcon, ArrowBack as ArrowBackIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, ROLES } from '../constants/roles';
import VigiladaMineducacion from './VigiladaMineducacion';

const drawerWidth = 280;
const FIXED_SECTION_ORDER = [
  'planeacion_estrategica',
  'gestion_informacion',
  'gestion_procesos',
  'administracion_sistema'
];

function DashboardLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const [openPlaneacionEstrategica, setOpenPlaneacionEstrategica] = useState(false);
  const [openGestionInformacion, setOpenGestionInformacion] = useState(false);
  const [openGestionProcesos, setOpenGestionProcesos] = useState(false);
  const [openAdministracionSistema, setOpenAdministracionSistema] = useState(false);

  const getContextTrail = () => {
    const params = new URLSearchParams(location.search || '');
    const source = params.get('source');
    if (source === 'planeacion_gpinfo' && location.pathname === '/dashboard/gestion-informacion') {
      return 'Planeación Estratégica / Gestión por Procesos y la Información / Gestión de la Información';
    }
    if (source === 'planeacion' && location.pathname === '/dashboard/buscar-documentos') {
      return 'Planeación Estratégica / Gestión por Procesos y la Información / Consulta de documentos';
    }

    const pathLabels = {
      '/dashboard': 'Inicio',
      '/dashboard/planeacion-estrategica': 'Planeación Estratégica',
      '/dashboard/planeacion-efectividad': 'Planeación y Efectividad',
      '/dashboard/autoevaluacion': 'Autoevaluación',
      '/dashboard/gestion-informacion': 'Gestión de la Información',
      '/dashboard/aseguramiento-calidad': 'Administración del Sistema Documental',
      '/dashboard/gestion-documentos': 'Gestión individual de documentos',
      '/dashboard/buscar-documentos': 'Consulta de documentos',
      '/dashboard/gestion-usuarios': 'Administración del Sistema / Gestión de Usuarios'
    };

    return pathLabels[location.pathname] || 'Módulo institucional';
  };

  const normalizeMenuByBlocks = (items) => {
    if (!Array.isArray(items)) return [];
    const dashboardItems = items.filter((item) => !item.section && item.key === 'dashboard');
    const nonDashboardTopItems = items.filter((item) => !item.section && item.key !== 'dashboard');
    const sections = items.filter((item) => item.section);

    const rankSection = (section) => {
      const idx = FIXED_SECTION_ORDER.indexOf(section?.openKey);
      return idx === -1 ? FIXED_SECTION_ORDER.length : idx;
    };

    const orderedSections = [...sections].sort((a, b) => {
      const rankDiff = rankSection(a) - rankSection(b);
      if (rankDiff !== 0) return rankDiff;
      return String(a.section || '').localeCompare(String(b.section || ''));
    });

    return [...dashboardItems, ...orderedSections, ...nonDashboardTopItems];
  };

  const handleLogout = () => {
    setAnchorEl(null);
    logout();
    navigate('/login');
  };

  const handleGoBack = () => {
    const historyIdx = window?.history?.state?.idx;
    if (typeof historyIdx === 'number' && historyIdx > 0) {
      navigate(-1);
      return;
    }
    if ((window?.history?.length || 0) > 1) {
      navigate(-1);
      return;
    }
    navigate('/dashboard');
  };
  const hideTopNavForPlaneacionInicio = user?.role === ROLES.PLANEACION_ESTRATEGICA
    && location.pathname === '/dashboard/planeacion-estrategica'
    && !new URLSearchParams(location.search || '').get('view');
  const isActive = (path) => {
    const target = String(path || '');
    const [pathname, query] = target.split('?');
    if (location.pathname !== pathname) return false;
    if (!query) return true;
    const currentQuery = new URLSearchParams(location.search || '');
    const targetQuery = new URLSearchParams(query);
    return currentQuery.toString() === targetQuery.toString();
  };

  const isContextualActive = (item = {}) => {
    const path = String(item?.path || '');
    if (!path) return false;
    if (isActive(path)) return true;

    const currentParams = new URLSearchParams(location.search || '');
    const source = currentParams.get('source');
    const pathname = location.pathname;

    const isPlaneacionGpInfoParent = path.includes('/dashboard/planeacion-estrategica?view=gestion-procesos-informacion');
    const openedFromPlaneacionGpInfo =
      source === 'planeacion_gpinfo' || (source === 'planeacion' && pathname === '/dashboard/buscar-documentos');

    if (isPlaneacionGpInfoParent && openedFromPlaneacionGpInfo) {
      return true;
    }

    return false;
  };

  const planeacionSectionItems = [
    {
      key: 'planeacion_efectividad',
      path: '/dashboard/planeacion-estrategica?view=planeacion-efectividad',
      label: 'Planeación y Efectividad',
      icon: <TimelineIcon />
    },
    {
      key: 'autoevaluacion',
      path: '/dashboard/planeacion-estrategica?view=autoevaluacion',
      label: 'Autoevaluación',
      icon: <FactCheckIcon />
    },
    {
      key: 'planeacion_estrategica',
      path: '/dashboard/planeacion-estrategica?view=registros-calificados',
      label: 'Registros Calificados y Acreditación',
      icon: <CheckIcon />
    },
    {
      key: 'gestion_informacion',
      path: '/dashboard/planeacion-estrategica?view=gestion-procesos-informacion',
      label: 'Gestión por Procesos y la Información',
      icon: <HubIcon />
    }
  ];

  const adminMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    {
      section: 'Planeación Estratégica',
      collapsible: true,
      openKey: 'planeacion_estrategica',
      items: planeacionSectionItems
    },
    {
      section: 'Gestión de la Información',
      collapsible: true,
      openKey: 'gestion_informacion',
      items: [
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=gestion_bases', label: 'Gestión de Bases de Datos', icon: <StorageIcon /> },
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=estadistica', label: 'Estadística Institucional', icon: <QueryStatsIcon /> }
      ]
    },
    {
      section: 'Administración del Sistema',
      collapsible: true,
      openKey: 'administracion_sistema',
      items: [
        { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> }
      ]
    },
    {
      section: 'Gestión por Procesos',
      collapsible: true,
      openKey: 'gestion_procesos',
      items: [
        { key: 'aseguramiento_calidad', path: '/dashboard/aseguramiento-calidad', label: 'Administración del Sistema Documental', icon: <CheckIcon /> },
        { key: 'gestion_documentos', path: '/dashboard/gestion-documentos', label: 'Gestión individual de documentos', icon: <DescriptionIcon /> },
        { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
      ]
    }
  ];

  const consultaMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
  ];

  const planeacionMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    {
      section: 'Planeación Estratégica',
      collapsible: true,
      openKey: 'planeacion_estrategica',
      items: planeacionSectionItems
    },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
  ];

  const planeacionEfectividadMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'planeacion_efectividad', path: '/dashboard/planeacion-efectividad', label: 'Planeación y Efectividad', icon: <TimelineIcon /> },
    { key: 'gestion_informacion', path: '/dashboard/gestion-informacion', label: 'Estadística Institucional', icon: <InsightsIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
  ];

  const autoevaluacionMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'autoevaluacion', path: '/dashboard/autoevaluacion', label: 'Autoevaluación', icon: <FactCheckIcon /> },
    { key: 'gestion_informacion', path: '/dashboard/gestion-informacion', label: 'Estadística Institucional', icon: <InsightsIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
  ];

  const gestionInformacionMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'gestion_informacion', path: '/dashboard/gestion-informacion', label: 'Gestión de la Información', icon: <InsightsIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
  ];

  const gestionProcesosMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    {
      section: 'Gestión por Procesos',
      collapsible: true,
      openKey: 'gestion_procesos',
      items: [
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=estadistica&module=gestion_procesos&panel=estadistica_documental', label: 'Estadística Documental', icon: <InsightsIcon /> },
        { key: 'aseguramiento_calidad', path: '/dashboard/aseguramiento-calidad', label: 'Administración del Sistema Documental', icon: <CheckIcon /> },
        { key: 'gestion_documentos', path: '/dashboard/gestion-documentos', label: 'Gestión individual de documentos', icon: <DescriptionIcon /> },
        { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
        { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> }
      ]
    }
  ];

  const menuCatalog = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'planeacion_estrategica', path: '/dashboard/planeacion-estrategica', label: 'Planeación Estratégica', icon: <InsightsIcon /> },
    { key: 'aseguramiento_calidad', path: '/dashboard/aseguramiento-calidad', label: 'Administración del Sistema Documental', icon: <CheckIcon /> },
    { key: 'gestion_informacion', path: '/dashboard/gestion-informacion', label: 'Gestión de la Información', icon: <InsightsIcon /> },
    { key: 'planeacion_efectividad', path: '/dashboard/planeacion-efectividad', label: 'Planeación y Efectividad', icon: <TimelineIcon /> },
    { key: 'autoevaluacion', path: '/dashboard/autoevaluacion', label: 'Autoevaluación', icon: <FactCheckIcon /> },
    { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> },
    { key: 'gestion_documentos', path: '/dashboard/gestion-documentos', label: 'Gestión individual de documentos', icon: <DescriptionIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
  ];

  let menuItems = consultaMenuItems;
  if (user?.role === ROLES.ADMINISTRADOR) menuItems = adminMenuItems;
  if (user?.role === ROLES.PLANEACION_ESTRATEGICA) menuItems = planeacionMenuItems;
  if (user?.role === ROLES.PLANEACION_EFECTIVIDAD) menuItems = planeacionEfectividadMenuItems;
  if (user?.role === ROLES.AUTOEVALUACION) menuItems = autoevaluacionMenuItems;
  if (user?.role === ROLES.GESTION_INFORMACION) menuItems = gestionInformacionMenuItems;
  if (user?.role === ROLES.GESTION_PROCESOS) menuItems = gestionProcesosMenuItems;

  const explicitMenuPermissions = useMemo(() => {
    if (!Array.isArray(user?.menuPermissions)) return [];
    return user.menuPermissions.map((k) => String(k || '').trim()).filter(Boolean);
  }, [user?.menuPermissions]);

  if (explicitMenuPermissions.length > 0) {
    menuItems = menuCatalog.filter((item) => explicitMenuPermissions.includes(item.key));

    if (user?.role === ROLES.ADMINISTRADOR) {
      const procesosKeys = ['aseguramiento_calidad', 'gestion_documentos', 'buscar_documentos'];
      const planeacionKeys = ['planeacion_estrategica', 'planeacion_efectividad', 'autoevaluacion', 'gestion_informacion'];
      const adminSistemaKeys = ['gestion_usuarios'];
      const visibleChildren = adminMenuItems
        .filter((item) => item.section && item.openKey === 'gestion_procesos')
        .flatMap((section) => section.items)
        .filter((child) => explicitMenuPermissions.includes(child.key));
      const adminSistemaChildren = [
        { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> }
      ].filter((child) => explicitMenuPermissions.includes(child.key));
      const planeacionChildren = planeacionSectionItems;
      const giChildren = [
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=gestion_bases', label: 'Gestión de Bases de Datos', icon: <StorageIcon /> },
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=estadistica', label: 'Estadística Institucional', icon: <QueryStatsIcon /> }
      ].filter((child) => explicitMenuPermissions.includes(child.key));

      menuItems = [
        ...menuItems.filter((item) => !procesosKeys.includes(item.key) && !planeacionKeys.includes(item.key) && !adminSistemaKeys.includes(item.key)),
        ...(planeacionChildren.length > 0
          ? [{
              section: 'Planeación Estratégica',
              collapsible: true,
              openKey: 'planeacion_estrategica',
              items: planeacionChildren
            }]
          : []),
        ...(adminSistemaChildren.length > 0
          ? [{
              section: 'Administración del Sistema',
              collapsible: true,
              openKey: 'administracion_sistema',
              items: adminSistemaChildren
            }]
          : []),
        ...(giChildren.length > 0
          ? [{
              section: 'Gestión de la Información',
              collapsible: true,
              openKey: 'gestion_informacion',
              items: giChildren
            }]
          : []),
        ...(visibleChildren.length > 0
          ? [{
              section: 'Gestión por Procesos',
              collapsible: true,
              openKey: 'gestion_procesos',
              items: visibleChildren
            }]
          : [])
      ];
    }

    if (user?.role === ROLES.PLANEACION_ESTRATEGICA) {
      const groupedKeys = ['planeacion_estrategica', 'planeacion_efectividad', 'autoevaluacion', 'gestion_informacion'];
      const planeacionChildren = planeacionSectionItems;
      menuItems = [
        ...menuItems.filter((item) => !groupedKeys.includes(item.key)),
        ...(planeacionChildren.length > 0
          ? [{
              section: 'Planeación Estratégica',
              collapsible: true,
              openKey: 'planeacion_estrategica',
              items: planeacionChildren
            }]
          : [])
      ];
    }

    if (user?.role === ROLES.GESTION_PROCESOS) {
      const procesosKeys = ['gestion_informacion', 'aseguramiento_calidad', 'gestion_documentos', 'buscar_documentos', 'gestion_usuarios'];
      const visibleChildren = gestionProcesosMenuItems
        .filter((item) => item.section)
        .flatMap((section) => section.items)
        .filter((child) => explicitMenuPermissions.includes(child.key));

      menuItems = [
        ...menuItems.filter((item) => !procesosKeys.includes(item.key)),
        ...(visibleChildren.length > 0
          ? [{
              section: 'Gestión por Procesos',
              collapsible: true,
              openKey: 'gestion_procesos',
              items: visibleChildren
            }]
          : [])
      ];
    }
  }

  menuItems = normalizeMenuByBlocks(menuItems);

  const drawer = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#0f1f3a' }}>
      <Toolbar
        sx={{
          bgcolor: '#0b1730',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0.8,
          py: 2.6,
          minHeight: 188
        }}
      >
        <Box
          sx={{
            width: 132,
            height: 132,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Box
            component="img"
            src="/Logo Universidad CESMAG.png"
            alt="Logo Universidad CESMAG"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </Box>
        <Box sx={{ textAlign: 'center', lineHeight: 1.15 }}>
          <Typography variant="h6" sx={{ color: '#ffffff', fontWeight: 700, fontSize: 16, letterSpacing: 0.15 }}>
            Sistema de Gestión{' '}
            <Box component="span" sx={{ fontWeight: 500 }}>
              por Procesos
            </Box>
          </Typography>
        </Box>
      </Toolbar>
      
      <Divider sx={{ borderColor: '#27406b' }} />
      
      <List sx={{ px: 2, py: 2, flexGrow: 1, bgcolor: '#0f1f3a' }}>
        {menuItems.map((item) => {
          if (item.section) {
            const isSectionActive = Array.isArray(item.items) && item.items.some((child) => isContextualActive(child));
            const sectionOpen = item.openKey === 'gestion_procesos'
              ? openGestionProcesos
              : item.openKey === 'administracion_sistema'
                ? openAdministracionSistema
              : item.openKey === 'planeacion_estrategica'
                ? openPlaneacionEstrategica
              : item.openKey === 'gestion_informacion'
                ? openGestionInformacion
                : true;
            const sectionHighlighted = isSectionActive;
            return (
              <Box key={item.section} sx={{ mt: 1 }}>
                <ListItemButton
                  onClick={() => {
                    if (item.openKey === 'gestion_procesos') {
                      setOpenGestionProcesos((prev) => !prev);
                    }
                    if (item.openKey === 'gestion_informacion') {
                      setOpenGestionInformacion((prev) => !prev);
                    }
                    if (item.openKey === 'planeacion_estrategica') {
                      setOpenPlaneacionEstrategica((prev) => !prev);
                    }
                    if (item.openKey === 'administracion_sistema') {
                      setOpenAdministracionSistema((prev) => !prev);
                    }
                  }}
                  sx={{
                    borderRadius: 2,
                    color: sectionHighlighted ? 'white' : '#d7e2f1',
                    background: sectionHighlighted ? 'linear-gradient(90deg, rgba(37,99,235,0.28), rgba(59,130,246,0.16))' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': { bgcolor: '#1f3358' }
                  }}
                >
                  <ListItemText
                    primary={item.section}
                    primaryTypographyProps={{
                      fontSize: 12,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: 0.8,
                      color: sectionHighlighted ? '#e2e8f0' : '#93a7c6'
                    }}
                  />
                  {item.collapsible ? (sectionOpen ? <ExpandLessIcon sx={{ color: '#93a7c6' }} /> : <ExpandMoreIcon sx={{ color: '#93a7c6' }} />) : null}
                </ListItemButton>
                <Collapse in={sectionOpen} timeout="auto" unmountOnExit>
                  <Box sx={{ mt: 1, bgcolor: '#0f1f3a' }}>
                    {item.items.map((child) => {
                      const childActive = isContextualActive(child);
                      return (
                        <ListItemButton
                          key={child.path}
                          onClick={() => { navigate(child.path); setMobileOpen(false); }}
                          disabled={Boolean(child.disabled)}
                          sx={{
                            mb: 1,
                            borderRadius: 2,
                            color: childActive ? '#f8fafc' : '#d7e2f1',
                            background: childActive ? 'linear-gradient(90deg, rgba(37,99,235,0.35), rgba(59,130,246,0.22))' : 'transparent',
                            '&.Mui-disabled': {
                              opacity: 1,
                              color: '#8fa5c7',
                              background: 'transparent'
                            },
                            transition: 'all 0.2s',
                            '&:hover': {
                              bgcolor: childActive ? 'rgba(37,99,235,0.32)' : '#1f3358',
                              transform: 'translateX(4px)'
                            }
                          }}
                        >
                          <ListItemIcon sx={{ color: childActive ? '#e2e8f0' : '#9fb5d6', minWidth: 40 }}>
                            {child.icon}
                          </ListItemIcon>
                          <ListItemText
                            primary={child.label}
                            primaryTypographyProps={{ fontSize: 14, fontWeight: childActive ? 700 : 400 }}
                          />
                        </ListItemButton>
                      );
                    })}
                  </Box>
                </Collapse>
              </Box>
            );
          }

          return (
            <ListItemButton
              key={item.path}
              onClick={() => { navigate(item.path); setMobileOpen(false); }}
              disabled={Boolean(item.disabled)}
              sx={{
                mb: 1,
                borderRadius: 2,
                color: isContextualActive(item) ? '#f8fafc' : '#d7e2f1',
                background: isContextualActive(item) ? 'linear-gradient(90deg, rgba(37,99,235,0.35), rgba(59,130,246,0.22))' : 'transparent',
                '&.Mui-disabled': {
                  opacity: 1,
                  color: '#8fa5c7',
                  background: 'transparent'
                },
                transition: 'all 0.2s',
                '&:hover': {
                  bgcolor: isContextualActive(item) ? 'rgba(37,99,235,0.32)' : '#1f3358',
                  transform: 'translateX(4px)'
                }
              }}
            >
              <ListItemIcon sx={{ color: isContextualActive(item) ? '#e2e8f0' : '#9fb5d6', minWidth: 40 }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText 
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: isContextualActive(item) ? 700 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#27406b' }} />
      
      <Box sx={{ p: 2 }}>
        <Box sx={{ bgcolor: '#081227', borderRadius: 2, p: 2, border: '1px solid #1f3358' }}>
          <Typography variant="caption" sx={{ color: '#9fb5d6', display: 'block', mb: 1 }}>Usuario activo</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: '#3b82f6', fontSize: 14 }}>
              {user?.nombre?.charAt(0) || 'U'}
            </Avatar>
            <Box sx={{ flexGrow: 1 }}>
              <Typography sx={{ color: 'white', fontSize: 13, fontWeight: 500 }}>{user?.nombre}</Typography>
              <Chip 
                label={ROLE_LABELS[user?.role] || user?.role || 'Sin rol'}
                size="small" 
                sx={{ height: 18, fontSize: 10, bgcolor: user?.role === 'administrador' ? '#10b981' : '#6366f1', color: 'white' }} 
              />
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Sello Vigilada MINEDUCACIÓN */}
      <Box sx={{ pb: 1.8, pt: 0.5, display: 'flex', justifyContent: 'center' }}>
        <VigiladaMineducacion variant="dark" size="sm" />
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" elevation={0} sx={{ width: { sm: `calc(100% - ${drawerWidth}px)` }, ml: { sm: `${drawerWidth}px` }, bgcolor: 'white', borderBottom: '1px solid #e2e8f0' }}>
        <Toolbar variant="dense" sx={{ minHeight: 56 }}>
          <IconButton color="primary" edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ mr: 2, display: { sm: 'none' } }}>
            <MenuIcon />
          </IconButton>
          {!hideTopNavForPlaneacionInicio && (
            <>
              <Button
                onClick={handleGoBack}
                startIcon={<ArrowBackIcon />}
                variant="outlined"
                size="small"
                sx={{
                  borderRadius: 2,
                  textTransform: 'none',
                  fontWeight: 700,
                  color: '#1e3a8a',
                  borderColor: '#bfdbfe',
                  bgcolor: '#f8fbff',
                  '&:hover': { borderColor: '#93c5fd', bgcolor: '#eff6ff' }
                }}
              >
                Volver
              </Button>
              <Typography
                sx={{
                  ml: 1.5,
                  px: 1.2,
                  py: 0.5,
                  borderRadius: 1.5,
                  border: '1px solid #dbeafe',
                  bgcolor: '#f8fbff',
                  color: '#1e3a8a',
                  fontSize: 12,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: { xs: 170, sm: 420, md: 560 }
                }}
                title={getContextTrail()}
              >
                {getContextTrail()}
              </Typography>
            </>
          )}
          <Box sx={{ flexGrow: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Tooltip title="Configuración">
              <IconButton size="small" sx={{ color: '#64748b' }}>
                <SettingsIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Mi cuenta">
              <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0 }}>
                <Avatar sx={{ width: 36, height: 36, bgcolor: '#3b82f6' }}>
                  {user?.nombre?.charAt(0) || 'U'}
                </Avatar>
              </IconButton>
            </Tooltip>
          </Box>
          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)} transformOrigin={{ horizontal: 'right', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}>
            <MenuItem disabled>
              <Box>
                <Typography variant="subtitle2">{user?.nombre}</Typography>
                <Typography variant="caption" color="text.secondary">{user?.email}</Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1, fontSize: 20 }} />
              Cerrar Sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      
      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(!mobileOpen)} ModalProps={{ keepMounted: true }} sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', bgcolor: '#0f1f3a' } }}>
          {drawer}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: drawerWidth, border: 'none', bgcolor: '#0f1f3a' } }} open>
          {drawer}
        </Drawer>
      </Box>
      
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 2.5 }, width: { sm: `calc(100% - ${drawerWidth}px)` }, bgcolor: '#f8fafc', minHeight: '100vh' }}>
        <Toolbar variant="dense" />
        <Outlet />
      </Box>
    </Box>
  );
}

export default DashboardLayout;

