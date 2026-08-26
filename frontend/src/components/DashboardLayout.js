import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, List, Typography, IconButton, ListItemButton, ListItemIcon, ListItemText, Menu, MenuItem, Avatar, Chip, Divider, Tooltip, Collapse, Badge } from '@mui/material';
import {
  Menu as MenuIcon, DashboardCustomize as DashboardIcon,
  Verified as CheckIcon, Logout as LogoutIcon, Settings as SettingsIcon,
  GroupOutlined as PeopleIcon, ManageSearch as ExploreIcon,
  Insights as InsightsIcon, Timeline as TimelineIcon, FactCheck as FactCheckIcon,
  ExpandLess as ExpandLessIcon, ExpandMore as ExpandMoreIcon,
  Storage as StorageIcon, QueryStats as QueryStatsIcon,
  Hub as HubIcon,
  Favorite as FavoriteIcon,
  AssignmentTurnedIn as AssignmentTurnedInIcon
  ,ReceiptLong as ReceiptLongIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, ROLES } from '../constants/roles';
import VigiladaMineducacion from './VigiladaMineducacion';
import planAccionWorkflowService from '../services/planAccionWorkflowService';
import reporteSalidaService from '../services/reporteSalidaService';
import { getEstadoLegalizacion } from '../services/legalizacionViaticosService';

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
  const [reposicionBadge, setReposicionBadge] = useState(null);
  const [legalizacionesPendientes, setLegalizacionesPendientes] = useState(0);

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

  const refrescarBadgeReposicion = useCallback(async () => {
    if (!user) return;
    try {
      const resp = await reporteSalidaService.getSeguimientoBadge();
      setReposicionBadge(resp?.data?.access || null);
    } catch (err) {
      setReposicionBadge(null);
    }
  }, [user]);

  const refrescarLegalizaciones = useCallback(async () => {
    if (!user) return;
    try {
      const response = await getEstadoLegalizacion();
      setLegalizacionesPendientes(Number(response?.active || 0));
    } catch (_) {
      setLegalizacionesPendientes(0);
    }
  }, [user]);

  useEffect(() => {
    refrescarBadgePlanAccion();
    refrescarBadgeReposicion();
    refrescarLegalizaciones();
  }, [refrescarBadgePlanAccion, refrescarBadgeReposicion, refrescarLegalizaciones, location.pathname]);

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

  const navigateFromMenu = (path) => {
    if (!path) return;
    setMobileOpen(false);
    window.location.assign(path);
  };

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
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=estadistica', label: 'Tableros estadísticos', icon: <QueryStatsIcon /> }
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
    { key: 'favoritos', path: '/dashboard/favoritos', label: 'Documentos Favoritos', icon: <FavoriteIcon /> }
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
        { key: 'estadistica_documental', path: '/dashboard/gestion-informacion?tab=estadistica&module=gestion_procesos&panel=estadistica_documental', label: 'Estadística Documental', icon: <InsightsIcon /> },
        { key: 'aseguramiento_calidad', path: '/dashboard/aseguramiento-calidad', label: 'Administración del Sistema Documental', icon: <CheckIcon /> },
        { key: 'buscar_documentos', path: '/dashboard/buscar-documentos', label: 'Consulta de documentos', icon: <ExploreIcon /> },
        { key: 'gestion_usuarios', path: '/dashboard/gestion-usuarios', label: 'Gestión de Usuarios', icon: <PeopleIcon /> }
      ]
    }
  ];

  const assignedGestionInfoModules = Array.isArray(user?.allowedModules)
    ? user.allowedModules.map((key) => String(key || '').trim()).filter(Boolean)
    : [];
  const hasDatabaseCenterPermission = assignedGestionInfoModules.some((key) => key === 'gestion_bases_datos' || key.startsWith('gestion_bases_datos.'));
  const hasOtherGestionInfoPermission = assignedGestionInfoModules.some((key) => key !== 'gestion_bases_datos' && !key.startsWith('gestion_bases_datos.'));

  const menuCatalog = [
    { key: 'dashboard', path: '/dashboard', label: 'Inicio', icon: <DashboardIcon /> },
    { key: 'planeacion_estrategica', path: '/dashboard/planeacion-estrategica', label: 'Planeación Estratégica', icon: <InsightsIcon /> },
    { key: 'registros_calificados', path: '/dashboard/planeacion-estrategica?view=registros-calificados', label: 'Registros Calificados y Acreditación', icon: <CheckIcon /> },
    { key: 'aseguramiento_calidad', path: '/dashboard/aseguramiento-calidad', label: 'Administración del Sistema Documental', icon: <CheckIcon /> },
    {
      key: 'gestion_informacion',
      path: hasDatabaseCenterPermission && !hasOtherGestionInfoPermission
        ? '/dashboard/gestion-informacion?tab=gestion_bases'
        : '/dashboard/gestion-informacion',
      label: hasDatabaseCenterPermission && !hasOtherGestionInfoPermission
        ? 'Gestión de Bases de Datos'
        : 'Gestión de la Información',
      icon: hasDatabaseCenterPermission && !hasOtherGestionInfoPermission ? <StorageIcon /> : <InsightsIcon />
    },
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

  const explicitProcesosDashboards = useMemo(() => {
    if (!Array.isArray(user?.allowedGestionProcesosDashboards)) return [];
    return user.allowedGestionProcesosDashboards.map((k) => String(k || '').trim()).filter(Boolean);
  }, [user?.allowedGestionProcesosDashboards]);

  if (explicitMenuPermissions.length > 0 && user?.role !== ROLES.ADMINISTRADOR) {
    const hasUserMgmt = explicitMenuPermissions.includes('gestion_usuarios') ||
      explicitProcesosDashboards.some((k) => k.startsWith('gestion_usuarios'));

    const hasRealGIModules = (Array.isArray(user?.allowedModules) && user.allowedModules.length > 0) ||
      (Array.isArray(user?.allowedPoblacionalDashboards) && user.allowedPoblacionalDashboards.length > 0) ||
      (Array.isArray(user?.allowedSaberProDashboards) && user.allowedSaberProDashboards.length > 0) ||
      (Array.isArray(user?.allowedRecursoHumanoDashboards) && user.allowedRecursoHumanoDashboards.length > 0) ||
      (Array.isArray(user?.allowedInfraestructuraFisicaDashboards) && user.allowedInfraestructuraFisicaDashboards.length > 0) ||
      (Array.isArray(user?.allowedPlanAccionDashboards) && user.allowedPlanAccionDashboards.length > 0) ||
      (Array.isArray(user?.allowedInternacionalizacionDashboards) && user.allowedInternacionalizacionDashboards.length > 0) ||
      explicitProcesosDashboards.some((k) => !k.startsWith('gestion_usuarios'));

    const gestionProcesosBaseMenu = ['dashboard', 'aseguramiento_calidad', 'buscar_documentos', 'favoritos', 'gestion_usuarios'];
    let effectiveMenuPermissions = user?.role === ROLES.GESTION_PROCESOS
      ? [...new Set([...gestionProcesosBaseMenu, ...explicitMenuPermissions])]
      : [...explicitMenuPermissions];

    if (hasUserMgmt && !effectiveMenuPermissions.includes('gestion_usuarios')) {
      effectiveMenuPermissions.push('gestion_usuarios');
    }

    if (!hasRealGIModules) {
      effectiveMenuPermissions = effectiveMenuPermissions.filter((k) => k !== 'gestion_informacion');
    }

    menuItems = menuCatalog.filter((item) => effectiveMenuPermissions.includes(item.key));

    if (
      effectiveMenuPermissions.includes('gestion_informacion')
      && hasDatabaseCenterPermission
      && hasOtherGestionInfoPermission
    ) {
      const gestionInformacionIndex = menuItems.findIndex((item) => item.key === 'gestion_informacion');
      if (gestionInformacionIndex >= 0) {
        menuItems = [
          ...menuItems.slice(0, gestionInformacionIndex + 1),
          {
            key: 'gestion_bases_datos',
            path: '/dashboard/gestion-informacion?tab=gestion_bases',
            label: 'Gestión de Bases de Datos',
            icon: <StorageIcon />
          },
          ...menuItems.slice(gestionInformacionIndex + 1)
        ];
      }
    }

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
      const planeacionChildren = planeacionSectionItems.filter((child) => effectiveMenuPermissions.includes(child.key));
      const giChildren = [
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=gestion_bases', label: 'Gestión de Bases de Datos', icon: <StorageIcon /> },
        { key: 'gestion_informacion', path: '/dashboard/gestion-informacion?tab=estadistica', label: 'Tableros estadísticos', icon: <QueryStatsIcon /> }
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

    const actualProcesosDashboards = explicitProcesosDashboards.filter((k) => !k.startsWith('gestion_usuarios'));
    if (user?.role === ROLES.GESTION_PROCESOS || (user?.role === ROLES.CONSULTA && actualProcesosDashboards.length > 0)) {
      const procesosKeys = ['estadistica_documental', 'aseguramiento_calidad', 'buscar_documentos'];
      const visibleChildren = gestionProcesosMenuItems
        .filter((item) => item.section)
        .flatMap((section) => section.items)
        .filter((child) => (
          child.key === 'estadistica_documental'
            ? actualProcesosDashboards.includes('estadistica_documental') || user?.role === ROLES.GESTION_PROCESOS
            : child.key !== 'gestion_usuarios' && effectiveMenuPermissions.includes(child.key)
        ));

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

  if (legalizacionesPendientes > 0) {
    const item = {
      key: 'legalizacion_viaticos',
      path: '/dashboard/legalizacion-viaticos',
      label: 'Legalización de viáticos',
      icon: <ReceiptLongIcon />,
      badge: legalizacionesPendientes
    };
    const inicioIdx = menuItems.findIndex((entry) => entry.key === 'dashboard');
    menuItems = inicioIdx >= 0
      ? [...menuItems.slice(0, inicioIdx + 1), item, ...menuItems.slice(inicioIdx + 1)]
      : [item, ...menuItems];
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

  const mostrarReposicion = reposicionBadge?.canView;
  const totalReposiciones = (reposicionBadge?.counts?.ownPending || 0) + (reposicionBadge?.counts?.bossPending || 0);

  if (mostrarReposicion && totalReposiciones > 0) {
    const reposicionItem = { 
      key: 'tiempo_reponer', 
      path: '/dashboard/tiempo-reponer', 
      label: 'Tiempo por reponer', 
      icon: <AssignmentTurnedInIcon />,
      badge: totalReposiciones > 0 ? totalReposiciones : undefined
    };
    
    // Insert before Favoritos if it exists
    const favoritosIdx = menuItems.findIndex(it => it.key === 'favoritos');
    if (favoritosIdx >= 0) {
      menuItems = [
        ...menuItems.slice(0, favoritosIdx),
        reposicionItem,
        ...menuItems.slice(favoritosIdx)
      ];
    } else {
      menuItems = [...menuItems, reposicionItem];
    }
  }

  const hasExplicitMovilidadPerm = Boolean(
    (Array.isArray(user?.allowedModules) && user.allowedModules.includes('practica_integral_movilidad')) ||
    (Array.isArray(user?.modulos_autorizados) && user.modulos_autorizados.includes('practica_integral_movilidad')) ||
    (Array.isArray(user?.permissions) && user.permissions.includes('practica_integral_movilidad')) ||
    (Array.isArray(explicitMenuPermissions) && explicitMenuPermissions.includes('practica_integral_movilidad'))
  );

  const isMovilidadAuthorizedRole = Boolean(
    user?.role === ROLES.ADMINISTRADOR ||
    user?.role === ROLES.GESTION_PROCESOS ||
    user?.role === ROLES.PLANEACION_ESTRATEGICA ||
    (user?.cargo && /director|decano|coordinador|lider|docente|profesor|tutor|vicerrec|academica|financiera/i.test(user.cargo)) ||
    (user?.dependencia && /licenciatura|programa|facultad|escuela|departamento|practica|movilidad|vicerrec|academica|financiera/i.test(user.dependencia))
  );

  const canAccessMovilidad = hasExplicitMovilidadPerm || isMovilidadAuthorizedRole;

  if (canAccessMovilidad) {
    const movilidadItem = {
      key: 'practica_integral_movilidad',
      path: '/dashboard/practica-integral-movilidad',
      label: 'Práctica Integral de Movilidad',
      icon: <AssignmentTurnedInIcon />
    };
    if (!menuItems.some((it) => it.key === 'practica_integral_movilidad')) {
      menuItems = [...menuItems, movilidadItem];
    }
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
            component="div"
            sx={{
              color: '#ffffff',
              fontWeight: 800,
              lineHeight: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              position: 'relative',
              pt: 0.2
            }}
          >
            <Box sx={{
              minWidth: 122,
              px: 1.6,
              py: 0.95,
              borderRadius: 3,
              border: '1px solid rgba(147,197,253,0.22)',
              background: 'linear-gradient(180deg, rgba(15,32,64,0.86), rgba(8,18,39,0.34))',
              boxShadow: '0 12px 30px rgba(2,8,23,0.24), inset 0 1px 0 rgba(255,255,255,0.07)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center'
            }}>
              <Box component="span" sx={{
                fontSize: 19,
                letterSpacing: 1.5,
                lineHeight: 1,
                textTransform: 'uppercase',
                color: '#ffffff',
                textShadow: '0 2px 14px rgba(96,165,250,0.35)'
              }}>
                SIAC
              </Box>
              <Box component="span" sx={{
                display: 'block',
                mt: 0.75,
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: 1.8,
                color: '#bfdbfe',
                textTransform: 'uppercase'
              }}>
                UNICESMAG
              </Box>
              <Box sx={{
                width: 54,
                height: 2,
                mt: 0.9,
                borderRadius: 999,
                background: 'linear-gradient(90deg, rgba(96,165,250,0), #93c5fd, rgba(96,165,250,0))'
              }} />
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
                          onClick={() => navigateFromMenu(child.path)}
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
              onClick={() => navigateFromMenu(item.path)}
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

