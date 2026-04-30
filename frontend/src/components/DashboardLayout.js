import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, Typography, IconButton, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Avatar, Chip, Divider, Tooltip, Collapse, Button, Badge } from '@mui/material';
import {
  Menu as MenuIcon, DashboardCustomize as DashboardIcon,
  Verified as CheckIcon, Logout as LogoutIcon, Settings as SettingsIcon,
  GroupOutlined as PeopleIcon, ManageSearch as ExploreIcon,
  Insights as InsightsIcon, Timeline as TimelineIcon, FactCheck as FactCheckIcon,
  ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon, QueryStats as QueryStatsIcon,
  Hub as HubIcon, ArrowBack as ArrowBackIcon,
  Favorite as FavoriteIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, ROLES } from '../constants/roles';
import VigiladaMineducacion from './VigiladaMineducacion';
import planAccionWorkflowService from '../services/planAccionWorkflowService';

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
  const [planAccionPendientes, setPlanAccionPendientes] = useState(0);

  const refrescarBadgePlanAccion = useCallback(async () => {
    if (!user?.role) return;
    const rolesQueVenBadge = [ROLES.PLANEACION_ESTRATEGICA, ROLES.CONSULTA];
    if (!rolesQueVenBadge.includes(user.role)) return;
    try {
      const resp = await planAccionWorkflowService.obtenerBadge();
      const value = Number(resp?.data?.count || 0);
      setPlanAccionPendientes(Number.isFinite(value) ? value : 0);
    } catch (err) {
      setPlanAccionPendientes(0);
    }
  }, [user?.role]);

  useEffect(() => {
    refrescarBadgePlanAccion();
  }, [refrescarBadgePlanAccion, location.pathname]);

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
      '/dashboard/buscar-documentos': 'Consulta de documentos',
      '/dashboard/gestion-usuarios': 'Administración del Sistema / Gestión de Usuarios',
      '/dashboard/plan-accion-revision': 'Planeación Estratégica / Revisión Planes de Acción',
      '/dashboard/plan-accion-mi-plan': 'Plan de Acción'
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
      key: 'registros_calificados',
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
        { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> }
      ]
    }
  ];

  const consultaMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
  ];

  const planeacionMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    {
      section: 'Planeación Estratégica',
      collapsible: true,
      openKey: 'planeacion_estrategica',
      items: planeacionSectionItems
    },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
  ];

  const planeacionEfectividadMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'planeacion_efectividad', path: '/dashboard/planeacion-efectividad', label: 'Planeación y Efectividad', icon: <TimelineIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
  ];

  const autoevaluacionMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'autoevaluacion', path: '/dashboard/autoevaluacion', label: 'Autoevaluación', icon: <FactCheckIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
  ];

  const registrosCalificadosMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'registros_calificados', path: '/dashboard/planeacion-estrategica?view=registros-calificados', label: 'Registros Calificados y Acreditación', icon: <CheckIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
  ];

  const gestionInformacionMenuItems = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'gestion_informacion', path: '/dashboard/gestion-informacion', label: 'Gestión de la Información', icon: <InsightsIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
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
        { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
        { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> },
        { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> }
      ]
    }
  ];

  const menuCatalog = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'planeacion_estrategica', path: '/dashboard/planeacion-estrategica', label: 'Planeación Estratégica', icon: <InsightsIcon /> },
    { key: 'registros_calificados', path: '/dashboard/planeacion-estrategica?view=registros-calificados', label: 'Registros Calificados y Acreditación', icon: <CheckIcon /> },
    { key: 'aseguramiento_calidad', path: '/dashboard/aseguramiento-calidad', label: 'Administración del Sistema Documental', icon: <CheckIcon /> },
    { key: 'gestion_informacion', path: '/dashboard/gestion-informacion', label: 'Gestión de la Información', icon: <InsightsIcon /> },
    { key: 'planeacion_efectividad', path: '/dashboard/planeacion-efectividad', label: 'Planeación y Efectividad', icon: <TimelineIcon /> },
    { key: 'autoevaluacion', path: '/dashboard/autoevaluacion', label: 'Autoevaluación', icon: <FactCheckIcon /> },
    { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> },
    { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
    { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
  ];

  let menuItems = consultaMenuItems;
  if (user?.role === ROLES.ADMINISTRADOR) menuItems = adminMenuItems;
  if (user?.role === ROLES.PLANEACION_ESTRATEGICA) menuItems = planeacionMenuItems;
  if (user?.role === ROLES.PLANEACION_EFECTIVIDAD) menuItems = planeacionEfectividadMenuItems;
  if (user?.role === ROLES.AUTOEVALUACION) menuItems = autoevaluacionMenuItems;
  if (user?.role === ROLES.REGISTROS_CALIFICADOS) menuItems = registrosCalificadosMenuItems;
  if (user?.role === ROLES.GESTION_INFORMACION) menuItems = gestionInformacionMenuItems;
  if (user?.role === ROLES.GESTION_PROCESOS) menuItems = gestionProcesosMenuItems;

  const explicitMenuPermissions = useMemo(() => {
    if (!Array.isArray(user?.menuPermissions)) return [];
    return user.menuPermissions.map((k) => String(k || '').trim()).filter(Boolean);
  }, [user?.menuPermissions]);

  if (explicitMenuPermissions.length > 0 && user?.role !== ROLES.ADMINISTRADOR) {
    menuItems = menuCatalog.filter((item) => explicitMenuPermissions.includes(item.key));

    if (user?.role === ROLES.ADMINISTRADOR) {
      const procesosKeys = ['aseguramiento_calidad', 'buscar_documentos'];
      const planeacionKeys = ['planeacion_estrategica', 'planeacion_efectividad', 'autoevaluacion', 'registros_calificados', 'gestion_informacion'];
      const adminSistemaKeys = ['gestion_usuarios'];
      const visibleChildren = adminMenuItems
        .filter((item) => item.section && item.openKey === 'gestion_procesos')
        .flatMap((section) => section.items)
        .filter((child) => explicitMenuPermissions.includes(child.key));
      const adminSistemaChildren = [
        { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> }
      ].filter((child) => explicitMenuPermissions.includes(child.key));
      const planeacionChildren = planeacionSectionItems.filter((child) => explicitMenuPermissions.includes(child.key));
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
      const groupedKeys = ['planeacion_estrategica', 'planeacion_efectividad', 'autoevaluacion', 'registros_calificados', 'gestion_informacion'];
      const planeacionChildren = planeacionSectionItems.filter((child) => explicitMenuPermissions.includes(child.key));
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
      const procesosKeys = ['gestion_informacion', 'aseguramiento_calidad', 'buscar_documentos', 'gestion_usuarios'];
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

  // === Inyección dinámica del módulo "Plan de Acción" según rol y pendientes ===
  if (planAccionPendientes > 0) {
    if (user?.role === ROLES.CONSULTA) {
      const planAccionItem = {
        key: 'plan_accion_consulta',
        path: '/dashboard/plan-accion-mi-plan',
        label: 'Plan de Acción',
        icon: <AssignmentTurnedInIcon />,
        badge: planAccionPendientes
      };
      const inicioIdx = menuItems.findIndex((it) => it.key === 'dashboard');
      if (inicioIdx >= 0) {
        menuItems = [
          ...menuItems.slice(0, inicioIdx + 1),
          planAccionItem,
          ...menuItems.slice(inicioIdx + 1)
        ];
      } else {
        menuItems = [planAccionItem, ...menuItems];
      }
    }

  }

  // Para Planeación Estratégica: reemplazar "Planeación y Efectividad" (constructor de PyE)
  // por "Planes de Acción" (bandeja propia), siempre visible, con badge si hay pendientes.
  if (user?.role === ROLES.PLANEACION_ESTRATEGICA) {
    menuItems = menuItems.map((item) => {
      if (item.section && item.openKey === 'planeacion_estrategica') {
        const sinConstructor = item.items.filter(
          (c) => c.key !== 'planeacion_efectividad' && c.key !== 'plan_accion_revision'
        );
        return {
          ...item,
          items: [
            {
              key: 'planes_accion_revision',
              path: '/dashboard/plan-accion-revision',
              label: 'Planes de Acción',
              icon: <AssignmentTurnedInIcon />,
              badge: planAccionPendientes > 0 ? planAccionPendientes : undefined
            },
            ...sinConstructor
          ]
        };
      }
      return item;
    });
  }

  menuItems = normalizeMenuByBlocks(menuItems);

  // "Documentos Favoritos" se activa automáticamente cuando el usuario tiene "Consulta de documentos"
  const tieneBuscarDocs = menuItems.some(
    (it) => it.key === 'buscar_documentos' ||
    (Array.isArray(it.items) && it.items.some((c) => c.key === 'buscar_documentos'))
  );
  const yaTieneFavorito = menuItems.some(
    (it) => it.key === 'favoritos' ||
    (Array.isArray(it.items) && it.items.some((c) => c.key === 'favoritos'))
  );
  if (tieneBuscarDocs && !yaTieneFavorito) {
    menuItems = [...menuItems, { key: 'favoritos', path: '/dashboard?section=favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }];
  }

  const drawer = (
    <Box sx={{ height: '100dvh', display: 'flex', flexDirection: 'column', bgcolor: '#0f1f3a', overflow: 'hidden' }}>
      <Toolbar
        sx={{
          bgcolor: '#0b1730',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 1.1,
          px: 2,
          py: 2,
          minHeight: 228,
          height: 228,
          flexShrink: 0,
          boxSizing: 'border-box'
        }}
      >
        <Box
          sx={{
            width: 118,
            height: 118,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
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
        <Box sx={{ textAlign: 'center', lineHeight: 1.25, width: '100%' }}>
          <Typography
            variant="h6"
            sx={{
              color: '#ffffff',
              fontWeight: 800,
              fontSize: 16,
              letterSpacing: 0.15,
              lineHeight: 1.25,
              overflowWrap: 'anywhere'
            }}
          >
            Sistema de Gestión por
            <Box component="span" sx={{ display: 'block', fontWeight: 700 }}>
              Procesos
            </Box>
          </Typography>
        </Box>
      </Toolbar>
      
      <Divider sx={{ borderColor: '#27406b', flexShrink: 0 }} />
      
      <List
        sx={{
          px: 2,
          py: 2,
          flex: '1 1 auto',
          minHeight: 0,
          overflowY: 'auto',
          overflowX: 'hidden',
          bgcolor: '#0f1f3a',
          scrollbarWidth: 'thin',
          scrollbarColor: '#365783 #0f1f3a',
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-track': { bgcolor: '#0f1f3a' },
          '&::-webkit-scrollbar-thumb': { bgcolor: '#365783', borderRadius: 8 }
        }}
      >
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
                            {child.badge ? (
                              <Badge badgeContent={child.badge} color="error" overlap="circular" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16, fontWeight: 800 } }}>
                                {child.icon}
                              </Badge>
                            ) : child.icon}
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
                {item.badge ? (
                  <Badge badgeContent={item.badge} color="error" overlap="circular" sx={{ '& .MuiBadge-badge': { fontSize: 10, minWidth: 16, height: 16, fontWeight: 800 } }}>
                    {item.icon}
                  </Badge>
                ) : item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{ fontSize: 14, fontWeight: isContextualActive(item) ? 700 : 400 }}
              />
            </ListItemButton>
          );
        })}
      </List>

      <Divider sx={{ borderColor: '#27406b', flexShrink: 0 }} />
      
      <Box sx={{ p: 2, flexShrink: 0 }}>
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
      <Box sx={{ pb: 1.8, pt: 0.5, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
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
      
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 1.5, sm: 2, md: 2.5, lg: 3 }, width: { sm: `calc(100% - ${drawerWidth}px)` }, bgcolor: '#f8fafc', minHeight: '100vh', boxSizing: 'border-box' }}>
        <Toolbar variant="dense" />
        <Outlet />
      </Box>
    </Box>
  );
}

export default DashboardLayout;

