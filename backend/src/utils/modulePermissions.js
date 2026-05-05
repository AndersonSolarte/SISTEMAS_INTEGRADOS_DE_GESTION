const { ROLES } = require('../constants/roles');
const { UserModulePermission } = require('../models');

const MENU_KEYS = new Set([
  'dashboard',
  'planeacion_estrategica',
  'aseguramiento_calidad',
  'gestion_informacion',
  'gestion_usuarios',
  'buscar_documentos',
  'planeacion_efectividad',
  'autoevaluacion',
  'registros_calificados'
]);

const GESTION_INFO_MODULE_KEYS = new Set([
  'gestion_bases_datos',
  'estadistica_institucional',
  'autoevaluacion.instrumentos.access',
  'seguridad_aplicativa.ver',
  'seguridad_aplicativa.escanear',
  'seguridad_aplicativa.ver_hallazgos',
  'seguridad_aplicativa.gestionar_hallazgos',
  'seguridad_aplicativa.analizar_remediacion',
  'seguridad_aplicativa.exportar',
  'seguridad_aplicativa.configurar'
]);

const GESTION_PROCESOS_DASHBOARD_KEYS = new Set([
  'estadistica_documental'
]);

const LEGACY_GI_STATS_KEYS = new Set([
  'poblacional',
  'biblioteca',
  'medios_educativos',
  'internacionalizacion',
  'investigacion',
  'proyectos_convenios',
  'recurso_humano',
  'saber_pro',
  'gestion_procesos'
]);

const POBLACIONAL_DASHBOARD_KEYS = new Set([
  'poblacional_flujo',
  'poblacional_matriculados',
  'poblacional_graduados',
  'poblacional_caracterizacion',
  'poblacional_resumen_estadistico',
  'poblacional_desercion',
  'poblacional_empleabilidad',
  'poblacional_saber_pro'
]);

const SABER_PRO_DASHBOARD_KEYS = new Set([
  'saber_pro_consulta_individual',
  'saber_pro_validacion_masiva',
  'saber_pro_individuales_general',
  'saber_pro_individuales_saber_pro',
  'saber_pro_individuales_tyt',
  'saber_pro_individuales_destacados',
  'saber_pro_individuales_competencias',
  'saber_pro_individuales_becas',
  'saber_pro_agregados_general',
  'saber_pro_agregados_competencias_especificas',
  'saber_pro_agregados_competencias_genericas',
  'saber_pro_agregados_comparativo_general',
  'saber_pro_agregados_comparativo_especificas',
  'saber_pro_valor_agregado_individual',
  'saber_pro_valor_agregado_resultado_general',
  'saber_pro_valor_agregado_estadistica_general',
  'saber_pro_valor_agregado_nbc',
  'saber_pro_valor_agregado_programas',
  'saber_pro_valor_agregado_institucional'
]);

const getDefaultPermissionsByRole = (role) => {
  if ([ROLES.ADMINISTRADOR].includes(role)) {
    return {
      menuPermissions: [
        'dashboard',
        'planeacion_estrategica',
        'planeacion_efectividad',
        'autoevaluacion',
        'registros_calificados',
        'aseguramiento_calidad',
        'gestion_informacion',
        'gestion_usuarios',
        'buscar_documentos'
      ],
      allowedModules: ['gestion_bases_datos', 'estadistica_institucional'],
      allowedGestionProcesosDashboards: Array.from(GESTION_PROCESOS_DASHBOARD_KEYS),
      allowedPoblacionalDashboards: Array.from(POBLACIONAL_DASHBOARD_KEYS),
      allowedSaberProDashboards: Array.from(SABER_PRO_DASHBOARD_KEYS)
    };
  }

  if ([ROLES.GESTION_PROCESOS].includes(role)) {
    return {
      menuPermissions: [
        'dashboard',
        'aseguramiento_calidad',
        'buscar_documentos',
        'gestion_usuarios',
        'gestion_informacion'
      ],
      allowedModules: ['estadistica_institucional'],
      allowedGestionProcesosDashboards: ['estadistica_documental'],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: []
    };
  }

  if ([ROLES.PLANEACION_ESTRATEGICA].includes(role)) {
    return {
      menuPermissions: [
        'dashboard',
        'planeacion_estrategica',
        'planeacion_efectividad',
        'autoevaluacion',
        'registros_calificados',
        'gestion_informacion',
        'buscar_documentos'
      ],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: []
    };
  }

  if ([ROLES.PLANEACION_EFECTIVIDAD].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'planeacion_efectividad', 'buscar_documentos'],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: []
    };
  }

  if ([ROLES.REGISTROS_CALIFICADOS].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'registros_calificados', 'buscar_documentos'],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: []
    };
  }

  if ([ROLES.AUTOEVALUACION].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'autoevaluacion', 'buscar_documentos'],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: []
    };
  }

  if ([ROLES.GESTION_INFORMACION].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'gestion_informacion', 'buscar_documentos'],
      allowedModules: ['estadistica_institucional'],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: ['poblacional_flujo', 'poblacional_matriculados', 'poblacional_graduados', 'poblacional_caracterizacion', 'poblacional_resumen_estadistico'],
      allowedSaberProDashboards: [
        'saber_pro_consulta_individual',
        'saber_pro_validacion_masiva',
        'saber_pro_individuales_general',
        'saber_pro_individuales_saber_pro',
        'saber_pro_individuales_tyt',
        'saber_pro_individuales_destacados',
        'saber_pro_individuales_competencias',
        'saber_pro_individuales_becas',
        'saber_pro_agregados_general',
        'saber_pro_agregados_competencias_especificas',
        'saber_pro_agregados_competencias_genericas',
        'saber_pro_agregados_comparativo_general',
        'saber_pro_agregados_comparativo_especificas',
        'saber_pro_valor_agregado_individual',
        'saber_pro_valor_agregado_resultado_general',
        'saber_pro_valor_agregado_estadistica_general',
        'saber_pro_valor_agregado_nbc',
        'saber_pro_valor_agregado_programas',
        'saber_pro_valor_agregado_institucional'
      ]
    };
  }

  return {
    menuPermissions: ['dashboard', 'buscar_documentos'],
    allowedModules: [],
    allowedGestionProcesosDashboards: [],
    allowedPoblacionalDashboards: ['poblacional_flujo', 'poblacional_matriculados', 'poblacional_graduados', 'poblacional_caracterizacion', 'poblacional_resumen_estadistico'],
    allowedSaberProDashboards: []
  };
};

const getUserModulePermissions = async (userId, role) => {
  const defaults = getDefaultPermissionsByRole(role);

  if (role === ROLES.ADMINISTRADOR) return defaults;

  if (!UserModulePermission) return defaults;

  const rows = await UserModulePermission.findAll({
    where: { user_id: userId, can_view: true },
    attributes: ['module_key']
  });

  if (!rows.length) return defaults;

  const keys = rows
    .map((row) => String(row.module_key || '').trim())
    .filter(Boolean);

  const menuPermissions = Array.from(new Set(keys.filter((k) => MENU_KEYS.has(k))));
  const allowedModules = Array.from(new Set(keys.filter((k) => GESTION_INFO_MODULE_KEYS.has(k))));
  const allowedGestionProcesosDashboards = Array.from(new Set(keys.filter((k) => GESTION_PROCESOS_DASHBOARD_KEYS.has(k))));
  const allowedPoblacionalDashboards = Array.from(new Set(keys.filter((k) => POBLACIONAL_DASHBOARD_KEYS.has(k))));
  const allowedSaberProDashboards = Array.from(new Set(keys.filter((k) => SABER_PRO_DASHBOARD_KEYS.has(k))));
  const hasLegacyStatsPermission = keys.some((k) => LEGACY_GI_STATS_KEYS.has(k));

  // "Inicio" debe estar disponible para la navegación base.
  if (!menuPermissions.includes('dashboard')) {
    menuPermissions.unshift('dashboard');
  }

  // Los usuarios de consulta deben conservar acceso a búsqueda documental.
  if (role === ROLES.CONSULTA && !menuPermissions.includes('buscar_documentos')) {
    menuPermissions.push('buscar_documentos');
  }

  // Si se asignan submódulos de Gestión de la Información, el acceso al menú principal
  // debe aparecer aunque no se haya marcado explícitamente.
  if (allowedModules.length > 0 && !menuPermissions.includes('gestion_informacion')) {
    menuPermissions.push('gestion_informacion');
  }

  if (allowedGestionProcesosDashboards.length > 0) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
  }

  if (allowedPoblacionalDashboards.length > 0 || hasLegacyStatsPermission) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
  }

  if (allowedSaberProDashboards.length > 0) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
  }

  const restrictedMenusByRole = {
    [ROLES.PLANEACION_EFECTIVIDAD]: ['dashboard', 'planeacion_efectividad', 'buscar_documentos'],
    [ROLES.AUTOEVALUACION]: ['dashboard', 'autoevaluacion', 'buscar_documentos'],
    [ROLES.REGISTROS_CALIFICADOS]: ['dashboard', 'registros_calificados', 'buscar_documentos']
  };
  const restrictedMenu = restrictedMenusByRole[role];
  if (restrictedMenu) {
    return {
      menuPermissions: restrictedMenu,
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: []
    };
  }

  return {
    menuPermissions,
    allowedModules,
    allowedGestionProcesosDashboards,
    allowedPoblacionalDashboards,
    allowedSaberProDashboards
  };
};

const buildUserPayloadWithPermissions = async (user) => {
  const perms = await getUserModulePermissions(user.id, user.role);
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    username: user.username,
    role: user.role,
    must_change_password: Boolean(user.must_change_password),
    menuPermissions: perms.menuPermissions,
    allowedModules: perms.allowedModules,
    allowedGestionProcesosDashboards: perms.allowedGestionProcesosDashboards,
    allowedPoblacionalDashboards: perms.allowedPoblacionalDashboards,
    allowedSaberProDashboards: perms.allowedSaberProDashboards
  };
};

module.exports = {
  MENU_KEYS,
  GESTION_INFO_MODULE_KEYS,
  GESTION_PROCESOS_DASHBOARD_KEYS,
  POBLACIONAL_DASHBOARD_KEYS,
  SABER_PRO_DASHBOARD_KEYS,
  getDefaultPermissionsByRole,
  getUserModulePermissions,
  buildUserPayloadWithPermissions
};
