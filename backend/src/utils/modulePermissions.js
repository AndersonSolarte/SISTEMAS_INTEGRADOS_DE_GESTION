const { ROLES } = require('../constants/roles');
const { ACADEMIC_PROGRAM_PERMISSION_KEYS } = require('../constants/academicPrograms');
const { UserModulePermission } = require('../models');

const MENU_KEYS = new Set([
  'dashboard',
  'planeacion_estrategica',
  'aseguramiento_calidad',
  'gestion_informacion',
  'gestion_usuarios',
  'buscar_documentos',
  'favoritos',
  'planeacion_efectividad',
  'autoevaluacion',
  'registros_calificados'
]);

const GESTION_INFO_MODULE_KEYS = new Set([
  'gestion_bases_datos',
  'gestion_bases_datos.respaldo_descargar',
  'gestion_bases_datos.restaurar',
  'gestion_bases_datos.datos_exportar',
  'gestion_bases_datos.importar',
  'estadistica_institucional',
  'poblacional',
  'georreferencia',
  'biblioteca',
  'medios_educativos',
  'internacionalizacion',
  'gestion_riesgo_ambiente',
  'gestion_riesgo_ambiente.seguridad_salud_trabajo',
  'gestion_riesgo_ambiente.gestion_ambiental',
  'gestion_riesgo_ambiente.seguridad_vial',
  'investigacion',
  'proyectos_convenios',
  'recurso_humano',
  'saber_pro',
  'gestion_procesos',
  'plan_accion',
  'autoevaluacion',
  'registros_calificados_acreditacion',
  'autoevaluacion.instrumentos.access',
  'infraestructura_fisica.gestionar',
  'infraestructura_fisica.ver',
  'infraestructura_fisica',
  'seguridad_aplicativa.ver',
  'seguridad_aplicativa.escanear',
  'seguridad_aplicativa.ver_hallazgos',
  'seguridad_aplicativa.gestionar_hallazgos',
  'seguridad_aplicativa.analizar_remediacion',
  'seguridad_aplicativa.exportar',
  'seguridad_aplicativa.configurar',
  'monitor_actividad',
  'seguridad_aplicativa',
  'vicerrectoria_academica',
  ...ACADEMIC_PROGRAM_PERMISSION_KEYS,
  'vicerrectoria_financiera',
  'vicerrectoria_financiera.viaticos',
  'vicerrectoria_financiera.viaticos.gestion',
  'vicerrectoria_financiera.viaticos.estadistica'
]);

const GESTION_PROCESOS_DASHBOARD_KEYS = new Set([
  'estadistica_documental',
  'gestion_usuarios_consulta',
  'gestion_usuarios_crear_individual',
  'gestion_usuarios_crear_masivo'
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
  'poblacional_resumen_poblacional',
  'poblacional_resumen',
  'poblacional_flujo',
  'poblacional_matriculados',
  'poblacional_graduados',
  'poblacional_caracterizacion',
  'poblacional_resumen_estadistico',
  'poblacional_desercion',
  'poblacional_empleabilidad',
  'poblacional_contexto_externo',
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


const INFRAESTRUCTURA_FISICA_DASHBOARD_KEYS = new Set([
  'infraestructura_fisica_crud',
  'infraestructura_fisica_estadistica',
  'infraestructura_fisica_informes'
]);

const PLAN_ACCION_DASHBOARD_KEYS = new Set([
  'plan_accion_estadistica',
  'plan_accion_gestion',
  'plan_accion_nuevo',
  'pei_configurar',
  'pei_formular',
  'pei_revision_tecnica',
  'pei_validar_responsable',
  'pei_seguimiento',
  'pei_presupuesto',
  'pei_consulta_ejecutiva',
  'pei_auditoria',
  'pei_drive'
]);

const INTERNACIONALIZACION_DASHBOARD_KEYS = new Set([
  'internacionalizacion_gestion',
  'internacionalizacion_estadistica',
  'internacionalizacion_convenios'
]);

const RECURSO_HUMANO_DASHBOARD_KEYS = new Set([
  'recurso_humano_profesores',
  'recurso_humano_administrativos',
  'recurso_humano_seguimiento',
  'recurso_humano_reporte_salida',
  'recurso_humano_indicadores_ausentismo'
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
      allowedModules: Array.from(GESTION_INFO_MODULE_KEYS),
      allowedGestionProcesosDashboards: Array.from(GESTION_PROCESOS_DASHBOARD_KEYS),
      allowedPoblacionalDashboards: Array.from(POBLACIONAL_DASHBOARD_KEYS),
      allowedSaberProDashboards: Array.from(SABER_PRO_DASHBOARD_KEYS),
      allowedRecursoHumanoDashboards: Array.from(RECURSO_HUMANO_DASHBOARD_KEYS),
      allowedInfraestructuraFisicaDashboards: Array.from(INFRAESTRUCTURA_FISICA_DASHBOARD_KEYS),
      allowedPlanAccionDashboards: Array.from(PLAN_ACCION_DASHBOARD_KEYS),
      allowedInternacionalizacionDashboards: Array.from(INTERNACIONALIZACION_DASHBOARD_KEYS)
    };
  }

  if ([ROLES.GESTION_PROCESOS].includes(role)) {
    return {
      menuPermissions: [
        'dashboard',
        'aseguramiento_calidad',
        'buscar_documentos',
        'gestion_usuarios'
      ],
      allowedModules: ['estadistica_institucional', 'gestion_procesos'],
      allowedGestionProcesosDashboards: ['estadistica_documental'],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: [],
      allowedRecursoHumanoDashboards: [],
      allowedInfraestructuraFisicaDashboards: [],
      allowedPlanAccionDashboards: [],
      allowedInternacionalizacionDashboards: []
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
      allowedSaberProDashboards: [],
      allowedRecursoHumanoDashboards: [],
      allowedInfraestructuraFisicaDashboards: [],
      allowedPlanAccionDashboards: [],
      allowedInternacionalizacionDashboards: []
    };
  }

  if ([ROLES.PLANEACION_EFECTIVIDAD].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'planeacion_efectividad', 'buscar_documentos'],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: [],
      allowedRecursoHumanoDashboards: [],
      allowedInfraestructuraFisicaDashboards: [],
      allowedPlanAccionDashboards: Array.from(PLAN_ACCION_DASHBOARD_KEYS),
      allowedInternacionalizacionDashboards: []
    };
  }

  if ([ROLES.REGISTROS_CALIFICADOS].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'registros_calificados', 'buscar_documentos'],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: [],
      allowedRecursoHumanoDashboards: [],
      allowedInfraestructuraFisicaDashboards: [],
      allowedPlanAccionDashboards: [],
      allowedInternacionalizacionDashboards: []
    };
  }

  if ([ROLES.AUTOEVALUACION].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'autoevaluacion', 'buscar_documentos'],
      allowedModules: [],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: [],
      allowedSaberProDashboards: [],
      allowedRecursoHumanoDashboards: [],
      allowedInfraestructuraFisicaDashboards: [],
      allowedPlanAccionDashboards: [],
      allowedInternacionalizacionDashboards: []
    };
  }

  if ([ROLES.GESTION_INFORMACION].includes(role)) {
    return {
      menuPermissions: ['dashboard', 'gestion_informacion', 'buscar_documentos'],
      allowedModules: ['estadistica_institucional', 'infraestructura_fisica.ver'],
      allowedGestionProcesosDashboards: [],
      allowedPoblacionalDashboards: ['poblacional_flujo', 'poblacional_matriculados', 'poblacional_graduados', 'poblacional_caracterizacion', 'poblacional_resumen_estadistico', 'poblacional_contexto_externo'],
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
        'saber_pro_valor_agregado_institucional'
      ],
      allowedRecursoHumanoDashboards: [
        'recurso_humano_profesores',
        'recurso_humano_administrativos',
        'recurso_humano_seguimiento'
      ]
    };
  }

  return {
    menuPermissions: ['dashboard', 'buscar_documentos'],
    allowedModules: [],
    allowedGestionProcesosDashboards: [],
    allowedPoblacionalDashboards: [],
    allowedSaberProDashboards: [],
    allowedRecursoHumanoDashboards: [],
      allowedInfraestructuraFisicaDashboards: [],
      allowedPlanAccionDashboards: [],
      allowedInternacionalizacionDashboards: []
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

  let menuPermissions = Array.from(new Set(keys.filter((k) => MENU_KEYS.has(k))));
  let allowedModules = Array.from(new Set(keys.filter((k) => GESTION_INFO_MODULE_KEYS.has(k))));
  if (allowedModules.some((key) => key.startsWith('gestion_bases_datos.')) && !allowedModules.includes('gestion_bases_datos')) {
    allowedModules.push('gestion_bases_datos');
  }
  if (allowedModules.some((key) => key.startsWith('seguridad_aplicativa.')) && !allowedModules.includes('seguridad_aplicativa')) {
    allowedModules.push('seguridad_aplicativa');
  }
  if (allowedModules.some((key) => key.startsWith('vicerrectoria_academica.')) && !allowedModules.includes('vicerrectoria_academica')) {
    allowedModules.push('vicerrectoria_academica');
  }
  if (allowedModules.some((key) => key.startsWith('vicerrectoria_financiera.viaticos.')) && !allowedModules.includes('vicerrectoria_financiera.viaticos')) {
    allowedModules.push('vicerrectoria_financiera.viaticos');
  }
  if (allowedModules.some((key) => key.startsWith('vicerrectoria_financiera.viaticos')) && !allowedModules.includes('vicerrectoria_financiera')) {
    allowedModules.push('vicerrectoria_financiera');
  }
  if (allowedModules.includes('autoevaluacion.instrumentos.access') && !allowedModules.includes('autoevaluacion')) {
    allowedModules.push('autoevaluacion');
  }
  if (allowedModules.some((key) => key.startsWith('gestion_riesgo_ambiente.')) && !allowedModules.includes('gestion_riesgo_ambiente')) {
    allowedModules.push('gestion_riesgo_ambiente');
  }
  const hasStatisticalModule = allowedModules.some((key) => (
    key !== 'estadistica_institucional'
    && key !== 'gestion_bases_datos'
    && !key.startsWith('gestion_bases_datos.')
  ));
  if (hasStatisticalModule && !allowedModules.includes('estadistica_institucional')) {
    allowedModules.push('estadistica_institucional');
  }
  const allowedGestionProcesosDashboards = Array.from(new Set(keys.filter((k) => GESTION_PROCESOS_DASHBOARD_KEYS.has(k))));
  const allowedPoblacionalDashboards = Array.from(new Set(keys.filter((k) => POBLACIONAL_DASHBOARD_KEYS.has(k))));
  const allowedSaberProDashboards = Array.from(new Set(keys.filter((k) => SABER_PRO_DASHBOARD_KEYS.has(k))));
  const allowedRecursoHumanoDashboards = Array.from(new Set(keys.filter((k) => RECURSO_HUMANO_DASHBOARD_KEYS.has(k))));
  const allowedInfraestructuraFisicaDashboards = Array.from(new Set(keys.filter((k) => INFRAESTRUCTURA_FISICA_DASHBOARD_KEYS.has(k))));
  const allowedPlanAccionDashboards = Array.from(new Set(keys.filter((k) => PLAN_ACCION_DASHBOARD_KEYS.has(k))));
  const allowedInternacionalizacionDashboards = Array.from(new Set(keys.filter((k) => INTERNACIONALIZACION_DASHBOARD_KEYS.has(k))));
  const hasLegacyStatsPermission = keys.some((k) => LEGACY_GI_STATS_KEYS.has(k));

  // "Inicio" debe estar disponible para la navegación base.
  if (!menuPermissions.includes('dashboard')) {
    menuPermissions.unshift('dashboard');
  }

  // Los usuarios de consulta deben conservar acceso a búsqueda documental.
  if ([ROLES.CONSULTA, ROLES.PRUEBA].includes(role) && !menuPermissions.includes('buscar_documentos')) {
    menuPermissions.push('buscar_documentos');
  }

  // Si se asignan submódulos de Gestión de Usuarios, el menú principal debe conservarse o agregarse.
  const hasUserManagementPermission = keys.some((k) => [
    'gestion_usuarios',
    'gestion_usuarios_crear_individual',
    'gestion_usuarios_crear_masivo',
    'gestion_usuarios_consulta'
  ].includes(k));

  if ([ROLES.CONSULTA, ROLES.PRUEBA].includes(role) && !hasUserManagementPermission) {
    const userManagementIndex = menuPermissions.indexOf('gestion_usuarios');
    if (userManagementIndex >= 0) menuPermissions.splice(userManagementIndex, 1);
  } else if (hasUserManagementPermission) {
    if (!menuPermissions.includes('gestion_usuarios')) {
      menuPermissions.push('gestion_usuarios');
    }
  }

  const actualGIModules = allowedModules.filter((k) => !['gestion_procesos', 'estadistica_institucional'].includes(k));
  const actualProcesosDashboards = allowedGestionProcesosDashboards.filter((k) => !k.startsWith('gestion_usuarios'));
  const hasActualGIDashboards = actualProcesosDashboards.length > 0 || allowedPoblacionalDashboards.length > 0 || allowedSaberProDashboards.length > 0 || allowedRecursoHumanoDashboards.length > 0 || allowedInfraestructuraFisicaDashboards.length > 0 || allowedPlanAccionDashboards.length > 0 || allowedInternacionalizacionDashboards.length > 0;

  if (!actualGIModules.length && !hasActualGIDashboards) {
    const giIdx = menuPermissions.indexOf('gestion_informacion');
    if (giIdx >= 0) menuPermissions.splice(giIdx, 1);
    allowedModules = actualGIModules;
  } else if (allowedModules.length > 0 && !menuPermissions.includes('gestion_informacion')) {
    menuPermissions.push('gestion_informacion');
  }

  if (actualProcesosDashboards.length > 0) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
    if (!allowedModules.includes('gestion_procesos')) allowedModules.push('gestion_procesos');
  }

  if (allowedPoblacionalDashboards.length > 0) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
    if (!allowedModules.includes('poblacional')) allowedModules.push('poblacional');
  }

  if (hasLegacyStatsPermission) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
  }

  if (allowedSaberProDashboards.length > 0) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
    if (!allowedModules.includes('saber_pro')) allowedModules.push('saber_pro');
  }

  if (allowedRecursoHumanoDashboards.length > 0) {
    if (!menuPermissions.includes('gestion_informacion')) menuPermissions.push('gestion_informacion');
    if (!allowedModules.includes('estadistica_institucional')) allowedModules.push('estadistica_institucional');
    if (!allowedModules.includes('recurso_humano')) allowedModules.push('recurso_humano');
  }

  if (role === ROLES.GESTION_PROCESOS) {
    [
      'dashboard',
      'aseguramiento_calidad',
      'buscar_documentos',
      'favoritos',
      'gestion_usuarios'
    ].forEach((key) => {
      if (!menuPermissions.includes(key)) menuPermissions.push(key);
    });

    ['estadistica_institucional', 'gestion_procesos'].forEach((key) => {
      if (!allowedModules.includes(key)) allowedModules.push(key);
    });

    if (!allowedGestionProcesosDashboards.includes('estadistica_documental')) {
      allowedGestionProcesosDashboards.push('estadistica_documental');
    }
  }

  const restrictedMenusByRole = {
    [ROLES.PLANEACION_EFECTIVIDAD]: ['dashboard', 'planeacion_efectividad', 'buscar_documentos'],
    [ROLES.AUTOEVALUACION]: ['dashboard', 'autoevaluacion', 'buscar_documentos'],
    [ROLES.REGISTROS_CALIFICADOS]: ['dashboard', 'registros_calificados', 'buscar_documentos']
  };
  const restrictedMenu = restrictedMenusByRole[role];
  if (restrictedMenu) {
    const restrictedAllowedModules = role === ROLES.AUTOEVALUACION
      ? allowedModules.filter((key) => key === 'autoevaluacion.instrumentos.access')
      : [];
    const restrictedAllowedPlanAccion = role === ROLES.PLANEACION_EFECTIVIDAD
      ? Array.from(PLAN_ACCION_DASHBOARD_KEYS)
      : [];

    const finalMenuPermissions = [...restrictedMenu];
    if (menuPermissions.includes('gestion_informacion')) {
      finalMenuPermissions.push('gestion_informacion');
    }

    const finalAllowedModules = [...restrictedAllowedModules];
    allowedModules.forEach((mod) => {
      if (!finalAllowedModules.includes(mod)) {
        finalAllowedModules.push(mod);
      }
    });

    return {
      menuPermissions: finalMenuPermissions,
      allowedModules: finalAllowedModules,
      allowedGestionProcesosDashboards: allowedGestionProcesosDashboards,
      allowedPoblacionalDashboards: allowedPoblacionalDashboards,
      allowedSaberProDashboards: allowedSaberProDashboards,
      allowedRecursoHumanoDashboards: allowedRecursoHumanoDashboards,
      allowedInfraestructuraFisicaDashboards: allowedInfraestructuraFisicaDashboards,
      allowedPlanAccionDashboards: Array.from(new Set([...restrictedAllowedPlanAccion, ...allowedPlanAccionDashboards])),
      allowedInternacionalizacionDashboards: allowedInternacionalizacionDashboards
    };
  }

  return {
    menuPermissions,
    allowedModules,
    allowedGestionProcesosDashboards,
    allowedPoblacionalDashboards,
    allowedSaberProDashboards,
    allowedRecursoHumanoDashboards,
    allowedInfraestructuraFisicaDashboards,
    allowedPlanAccionDashboards,
    allowedInternacionalizacionDashboards
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
    allowedSaberProDashboards: perms.allowedSaberProDashboards,
    allowedRecursoHumanoDashboards: perms.allowedRecursoHumanoDashboards,
    allowedInfraestructuraFisicaDashboards: perms.allowedInfraestructuraFisicaDashboards || [],
    allowedPlanAccionDashboards: perms.allowedPlanAccionDashboards || [],
    allowedInternacionalizacionDashboards: perms.allowedInternacionalizacionDashboards || []
  };
};

module.exports = {
  MENU_KEYS,
  GESTION_INFO_MODULE_KEYS,
  GESTION_PROCESOS_DASHBOARD_KEYS,
  POBLACIONAL_DASHBOARD_KEYS,
  SABER_PRO_DASHBOARD_KEYS,
  RECURSO_HUMANO_DASHBOARD_KEYS,
  getDefaultPermissionsByRole,
  getUserModulePermissions,
  buildUserPayloadWithPermissions
};
