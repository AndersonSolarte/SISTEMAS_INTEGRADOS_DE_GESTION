const { Op } = require('sequelize');
const {
  StrategicPlan,
  StrategicLevel,
  StrategicTerm,
  StrategicCatalogItem,
  StrategicResponsibility,
  StrategicActionPlan,
  StrategicActionItem,
  StrategicFieldDefinition,
  StrategicElement,
  User
} = require('../models');

const percent = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return numeric > 0 && numeric <= 1 ? Number((numeric * 100).toFixed(2)) : Number(numeric.toFixed(2));
};

const resolveEstado = (val) => {
  const p = percent(val);
  if (p === null) return 'Sin dato';
  if (p <= 0) return 'Sin iniciar';
  if (p >= 99.5) return 'Completado';
  return 'En ejecución';
};

// Caché en memoria de corta duración (30s) para respuestas instantáneas
const statsCache = new Map();
const STATS_CACHE_TTL_MS = 30 * 1000;

const REDUNDANT_DYNAMIC_KEYS = new Set([
  'strategic_objective',
  'objetivo_estrategico',
  'objetivos_estrategicos',
  'strategic_guideline',
  'lineamiento_estrategico',
  'lineamientos_estrategicos',
  'guideline',
  'macroactivity',
  'macroactividad',
  'activity',
  'actividad',
  'indicator_type',
  'tipo_indicador',
  'indicator',
  'indicador',
  'target',
  'meta',
  'starts_on',
  'fecha_inicio',
  'ends_on',
  'fecha_fin',
  'responsible',
  'responsable',
  'progress_s1',
  'avance_ip',
  'progress_s2',
  'avance_iip',
  'total_progress',
  'avance_total',
  'legacy_plan_accion_id'
]);

/**
 * Obtiene las estadísticas consolidadas y tablas de referencia de un PED y sus planes de acción.
 */
const getPlanStatistics = async ({ planId = null, termId = null, year = null, catalogItemId = null, forceRefresh = false } = {}) => {
  const cacheKey = `${planId || 'default'}:${termId || 'all'}:${year || 'all'}:${catalogItemId || 'all'}`;
  if (!forceRefresh && statsCache.has(cacheKey)) {
    const cached = statsCache.get(cacheKey);
    if (Date.now() - cached.timestamp < STATS_CACHE_TTL_MS) {
      return cached.data;
    }
  }

  // 1. Obtener lista de todos los PEDs disponibles (priorizando el PED activo)
  const rawPlans = await StrategicPlan.findAll({
    where: { deleted_at: null, status: { [Op.ne]: 'deleted' } },
    order: [['starts_on', 'DESC']],
    raw: true,
    attributes: [
      'id',
      'name',
      'code',
      'description',
      'starts_on',
      'ends_on',
      'status',
      'approval_document',
      'administrative_act',
      'approved_on',
      'global_budget',
      'configuration_version',
      'created_at',
      'updated_at'
    ]
  });

  const allPlans = [...rawPlans].sort((a, b) => {
    const aActive = a.status === 'active' ? 0 : 1;
    const bActive = b.status === 'active' ? 0 : 1;
    if (aActive !== bActive) return aActive - bActive;
    return String(b.starts_on || '').localeCompare(String(a.starts_on || ''));
  });

  // 2. Determinar el PED objetivo
  let selectedPlan = null;
  if (planId) {
    selectedPlan = allPlans.find((p) => String(p.id) === String(planId));
  }
  if (!selectedPlan) {
    // Tomar el PED activo, o el primero por defecto
    selectedPlan = allPlans.find((p) => p.status === 'active') || allPlans[0] || null;
  }

  if (!selectedPlan) {
    return {
      plan: null,
      availablePlans: [],
      terms: [],
      kpis: { totalObjetivos: 0, totalLineamientos: 0, totalActividades: 0, totalIndicadores: 0, totalPlanes: 0, ejecucionGeneral: 0, sinIniciar: 0, enEjecucion: 0, completadas: 0 },
      objectives: [],
      termsProgress: [],
      dependenciesProgress: [],
      termDependencies: [],
      actionPlansList: [],
      fieldDefinitions: [],
      rows: []
    };
  }

  // 3. Obtener todas las vigencias del PED seleccionado
  const terms = await StrategicTerm.findAll({
    where: { strategic_plan_id: selectedPlan.id },
    order: [['year', 'ASC']],
    raw: true
  });

  const termMap = new Map(terms.map((t) => [String(t.id), t]));
  let targetTermIds = terms.map((t) => t.id);

  if (termId && termId !== 'all') {
    targetTermIds = targetTermIds.filter((id) => String(id) === String(termId));
  } else if (year && year !== 'all') {
    const matchedTerm = terms.find((t) => Number(t.year) === Number(year));
    if (matchedTerm) targetTermIds = [matchedTerm.id];
  }

  // 4. Buscar Planes de Acción asociados
  const actionPlanWhere = {
    term_id: targetTermIds,
    deleted_at: null
  };
  if (catalogItemId && catalogItemId !== 'all') {
    actionPlanWhere.catalog_item_id = catalogItemId;
  }

  const actionPlans = await StrategicActionPlan.findAll({
    where: actionPlanWhere,
    include: [
      { model: StrategicCatalogItem, as: 'organizationalUnit', attributes: ['id', 'code', 'name', 'catalog_type'] },
      { model: User, as: 'responsibleUser', attributes: ['id', 'username', 'nombre', 'email', 'cargo', 'dependencia'] },
      { model: StrategicTerm, as: 'term', attributes: ['id', 'year', 'status'] }
    ],
    order: [['created_at', 'DESC']],
    raw: true,
    nest: true
  });

  const planIds = actionPlans.map((p) => p.id);
  const actionPlanMap = new Map(actionPlans.map((p) => [String(p.id), p]));

  // 5. Buscar Actividades (ActionItems) y catálogos en paralelo con raw: true
  const [items, catalogItems, responsibilityRows, planLevels, planElements, fieldRows] = await Promise.all([
    planIds.length
      ? StrategicActionItem.findAll({
          where: { action_plan_id: planIds, deleted_at: null },
          attributes: [
            'id',
            'code',
            'action_plan_id',
            'strategic_element_id',
            'activity',
            'indicator_type',
            'indicator',
            'target',
            'starts_on',
            'ends_on',
            'current_progress',
            'custom_values'
          ],
          include: [{ model: StrategicElement, as: 'strategicElement', required: false, attributes: ['id', 'code', 'name'] }],
          order: [['code', 'ASC']],
          raw: true,
          nest: true
        })
      : [],
    StrategicCatalogItem.findAll({
      where: { strategic_plan_id: selectedPlan.id, active: true },
      order: [['catalog_type', 'ASC'], ['name', 'ASC']],
      raw: true
    }),
    targetTermIds.length
      ? StrategicResponsibility.findAll({
          where: {
            term_id: { [Op.in]: targetTermIds },
            action_plan_id: null,
            responsibility_type: 'reference_leader',
            status: 'active'
          },
          include: [
            { model: StrategicCatalogItem, as: 'organizationalUnit', required: false, attributes: ['id', 'code', 'name', 'catalog_type'] },
            { model: User, as: 'responsibleUser', required: false, attributes: ['id', 'username', 'nombre', 'email', 'dependencia', 'cargo'] }
          ],
          order: [['created_at', 'ASC']],
          raw: true,
          nest: true
        })
      : [],
    StrategicLevel.findAll({
      where: { strategic_plan_id: selectedPlan.id, active: true },
      order: [['position', 'ASC']],
      raw: true
    }),
    StrategicElement.findAll({
      where: { strategic_plan_id: selectedPlan.id, active: true, deleted_at: null },
      order: [['position', 'ASC'], ['code', 'ASC']],
      raw: true
    }),
    StrategicFieldDefinition.findAll({
      where: { strategic_plan_id: selectedPlan.id, active: true },
      order: [['configuration_version', 'DESC'], ['updated_at', 'DESC'], ['position', 'ASC']],
      raw: true
    })
  ]);
  const fieldsByKey = new Map();
  fieldRows.forEach((field) => {
    if (!fieldsByKey.has(field.key)) fieldsByKey.set(field.key, field);
  });
  const fieldDefinitions = Array.from(fieldsByKey.values()).sort((a, b) => (a.position || 0) - (b.position || 0));

  // 6. Consolidar métricas y objetivos
  const objectivesMap = new Map();
  const termsProgressMap = new Map();
  const dependenciesProgressMap = new Map();
  const rows = [];

  let totalProgressSum = 0;
  let itemsCount = 0;
  let sinIniciar = 0;
  let enEjecucion = 0;
  let completadas = 0;
  let totalIndicadores = 0;

  // Inicializar mapa de vigencias con los términos del PED
  terms.forEach((t) => {
    termsProgressMap.set(Number(t.year), {
      year: Number(t.year),
      termId: t.id,
      status: t.status,
      plansCount: 0,
      activitiesCount: 0,
      progressSum: 0,
      avgProgress: 0
    });
  });

  // Procesar cada actividad viva
  items.forEach((item) => {
    const actionPlan = actionPlanMap.get(String(item.action_plan_id));
    const term = actionPlan ? termMap.get(String(actionPlan.term_id)) : null;
    const yearVal = term ? Number(term.year) : null;

    const custom = item.custom_values || {};
    const objName = (custom.strategic_objective || item.strategicElement?.name || 'Objetivo Institucional General').trim();
    const guidName = (custom.strategic_guideline || 'Lineamiento General').trim();
    const macroVal = (custom.macroactivity || item.code || 'Macroactividad General').trim();

    // Determinar avance
    let progressVal = percent(item.current_progress);
    if (progressVal === null) progressVal = percent(custom.total_progress);
    if (progressVal === null && (custom.progress_s1 !== undefined || custom.progress_s2 !== undefined)) {
      const s1 = Number(custom.progress_s1 || 0);
      const s2 = Number(custom.progress_s2 || 0);
      progressVal = Number(((s1 + s2) / 2).toFixed(2));
    }
    if (progressVal === null) progressVal = 0;

    totalProgressSum += progressVal;
    itemsCount++;

    const estado = resolveEstado(progressVal);
    if (estado === 'Sin iniciar') sinIniciar++;
    else if (estado === 'En ejecución') enEjecucion++;
    else if (estado === 'Completado') completadas++;

    const indicatorText = (item.indicator || custom.indicator || '').trim();
    if (indicatorText) totalIndicadores++;

    // Agrupar en Objetivos -> Lineamientos
    if (!objectivesMap.has(objName)) {
      objectivesMap.set(objName, {
        name: objName,
        totalActivities: 0,
        progressSum: 0,
        avgProgress: 0,
        sinIniciar: 0,
        enEjecucion: 0,
        completadas: 0,
        guidelinesMap: new Map()
      });
    }
    const objData = objectivesMap.get(objName);
    objData.totalActivities++;
    objData.progressSum += progressVal;
    if (estado === 'Sin iniciar') objData.sinIniciar++;
    else if (estado === 'En ejecución') objData.enEjecucion++;
    else if (estado === 'Completado') objData.completadas++;

    if (!objData.guidelinesMap.has(guidName)) {
      objData.guidelinesMap.set(guidName, {
        name: guidName,
        totalActivities: 0,
        progressSum: 0,
        avgProgress: 0,
        sinIniciar: 0,
        enEjecucion: 0,
        completadas: 0
      });
    }
    const guidData = objData.guidelinesMap.get(guidName);
    guidData.totalActivities++;
    guidData.progressSum += progressVal;
    if (estado === 'Sin iniciar') guidData.sinIniciar++;
    else if (estado === 'En ejecución') guidData.enEjecucion++;
    else if (estado === 'Completado') guidData.completadas++;

    // Agrupar en Términos
    if (yearVal && termsProgressMap.has(yearVal)) {
      const termProg = termsProgressMap.get(yearVal);
      termProg.activitiesCount++;
      termProg.progressSum += progressVal;
    }

    // Compactar campos_dinamicos eliminando claves duplicadas que ya van en primer nivel
    const compactDynamic = {};
    for (const [k, v] of Object.entries(custom)) {
      if (!REDUNDANT_DYNAMIC_KEYS.has(k) && v !== null && v !== undefined && v !== '') {
        compactDynamic[k] = v;
      }
    }

    // Fila estructurada para tablas detalladas
    rows.push({
      id: item.id,
      code: item.code,
      plan_id: actionPlan?.id || item.action_plan_id,
      plan_code: actionPlan?.code || '—',
      plan_title: actionPlan?.title || '—',
      plan_status: actionPlan?.status || '—',
      objetivo_estrategico: objName,
      lineamiento_estrategico: guidName,
      macroactividad: macroVal,
      actividad: item.activity || custom.activity || 'Sin descripción',
      tipo_indicador: item.indicator_type || custom.indicator_type || '—',
      indicador: indicatorText || '—',
      meta: item.target || custom.target || '—',
      starts_on: item.starts_on || custom.starts_on || null,
      ends_on: item.ends_on || custom.ends_on || null,
      anio: yearVal,
      dependencia: actionPlan?.organizationalUnit?.name || 'Dependencia Institucional',
      dependencia_codigo: actionPlan?.organizationalUnit?.code || '—',
      responsable: actionPlan?.responsibleUser?.nombre || custom.responsible || 'Responsable Asignado',
      responsable_cedula: actionPlan?.responsibleUser?.username || '—',
      responsable_cargo: actionPlan?.responsibleUser?.cargo || '—',
      responsable_unidad_siac: actionPlan?.responsibleUser?.dependencia || '—',
      responsable_correo: actionPlan?.responsibleUser?.email || '—',
      avance_total: progressVal,
      avance_ip: custom.progress_s1 !== undefined ? custom.progress_s1 : null,
      avance_iip: custom.progress_s2 !== undefined ? custom.progress_s2 : null,
      estado,
      campos_dinamicos: compactDynamic
    });
  });

  // Calcular promedios en Objetivos y Lineamientos
  const objectives = Array.from(objectivesMap.values()).map((obj) => {
    const avgProgress = obj.totalActivities ? Number((obj.progressSum / obj.totalActivities).toFixed(2)) : 0;
    const guidelines = Array.from(obj.guidelinesMap.values()).map((g) => ({
      name: g.name,
      totalActivities: g.totalActivities,
      avgProgress: g.totalActivities ? Number((g.progressSum / g.totalActivities).toFixed(2)) : 0,
      sinIniciar: g.sinIniciar,
      enEjecucion: g.enEjecucion,
      completadas: g.completadas
    }));
    return {
      name: obj.name,
      totalActivities: obj.totalActivities,
      avgProgress,
      sinIniciar: obj.sinIniciar,
      enEjecucion: obj.enEjecucion,
      completadas: obj.completadas,
      guidelines
    };
  });

  // Mapa de métricas por plan de acción individual
  const planMetricsMap = new Map();
  actionPlans.forEach((plan) => {
    planMetricsMap.set(String(plan.id), {
      itemsCount: 0,
      progressSum: 0,
      sinIniciar: 0,
      enEjecucion: 0,
      completadas: 0
    });
  });

  // Contar planes por año en termsProgress
  actionPlans.forEach((plan) => {
    const term = termMap.get(String(plan.term_id));
    if (term && termsProgressMap.has(Number(term.year))) {
      termsProgressMap.get(Number(term.year)).plansCount++;
    }

    // Progreso por dependencia
    const depKey = plan.organizationalUnit?.id || plan.catalog_item_id || plan.id;
    const depName = plan.organizationalUnit?.name || plan.title || 'Dependencia';
    if (!dependenciesProgressMap.has(depKey)) {
      dependenciesProgressMap.set(depKey, {
        id: depKey,
        name: depName,
        code: plan.organizationalUnit?.code || '',
        plansCount: 0,
        planCodes: [],
        year: term?.year || null,
        responsible: plan.responsibleUser?.nombre || '—',
        responsibleDocument: plan.responsibleUser?.username || '—',
        responsibleCargo: plan.responsibleUser?.cargo || '—',
        responsibleUnitSiac: plan.responsibleUser?.dependencia || '—',
        responsibleEmail: plan.responsibleUser?.email || '—',
        activitiesCount: 0,
        progressSum: 0,
        avgProgress: 0,
        status: plan.status
      });
    }
    const depData = dependenciesProgressMap.get(depKey);
    depData.plansCount++;
    depData.planCodes.push(plan.code);
  });

  // Sumar avances de actividades por dependencia y por plan de acción
  items.forEach((item) => {
    const actionPlan = actionPlanMap.get(String(item.action_plan_id));
    let p = percent(item.current_progress);
    if (p === null) p = percent(item.custom_values?.total_progress);
    if (p === null && (item.custom_values?.progress_s1 !== undefined || item.custom_values?.progress_s2 !== undefined)) {
      const s1 = Number(item.custom_values?.progress_s1 || 0);
      const s2 = Number(item.custom_values?.progress_s2 || 0);
      p = Number(((s1 + s2) / 2).toFixed(2));
    }
    const val = Number(p || 0);
    const est = resolveEstado(val);

    if (actionPlan) {
      const depKey = actionPlan.organizationalUnit?.id || actionPlan.catalog_item_id || actionPlan.id;
      if (dependenciesProgressMap.has(depKey)) {
        const depData = dependenciesProgressMap.get(depKey);
        depData.activitiesCount++;
        depData.progressSum += val;
      }
      const pm = planMetricsMap.get(String(actionPlan.id));
      if (pm) {
        pm.itemsCount++;
        pm.progressSum += val;
        if (est === 'Sin iniciar') pm.sinIniciar++;
        else if (est === 'En ejecución') pm.enEjecucion++;
        else if (est === 'Completado') pm.completadas++;
      }
    }
  });

  const dependenciesProgress = Array.from(dependenciesProgressMap.values()).map((dep) => ({
    ...dep,
    avgProgress: dep.activitiesCount ? Number((dep.progressSum / dep.activitiesCount).toFixed(2)) : 0
  })).sort((a, b) => b.activitiesCount - a.activitiesCount);

  // Construir lista completa de Planes de Acción
  const actionPlansList = actionPlans.map((plan) => {
    const term = termMap.get(String(plan.term_id));
    const pm = planMetricsMap.get(String(plan.id)) || { itemsCount: 0, progressSum: 0, sinIniciar: 0, enEjecucion: 0, completadas: 0 };
    const avgProgress = pm.itemsCount ? Number((pm.progressSum / pm.itemsCount).toFixed(2)) : 0;
    return {
      id: plan.id,
      code: plan.code,
      title: plan.title,
      status: plan.status,
      term_id: plan.term_id,
      year: term?.year || plan.term?.year || null,
      dependency_id: plan.organizationalUnit?.id || plan.catalog_item_id,
      dependency_code: plan.organizationalUnit?.code || '—',
      dependency_name: plan.organizationalUnit?.name || plan.title || 'Dependencia',
      responsible_id: plan.responsibleUser?.id || plan.responsible_user_id || null,
      responsible_name: plan.responsibleUser?.nombre || 'Sin responsable',
      responsible_document: plan.responsibleUser?.username || '—',
      responsible_unit_siac: plan.responsibleUser?.dependencia || '—',
      responsible_position: plan.responsibleUser?.cargo || '—',
      responsible_email: plan.responsibleUser?.email || '—',
      workflow_version: plan.workflow_version || 1,
      instrument_version: plan.instrument_version || 1,
      items_count: pm.itemsCount,
      avg_progress: avgProgress,
      sin_iniciar: pm.sinIniciar,
      en_ejecucion: pm.enEjecucion,
      completadas: pm.completadas,
      activated_at: plan.activated_at || null,
      closed_at: plan.closed_at || null,
      created_at: plan.createdAt || plan.created_at || null,
      updated_at: plan.updatedAt || plan.updated_at || null
    };
  }).sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return String(a.dependency_name || '').localeCompare(String(b.dependency_name || ''), 'es');
  });

  // Construir tabla completa de Dependencias por vigencia (termDependencies) con búsqueda O(1)
  const actionPlanByTermDep = new Map();
  actionPlansList.forEach((ap) => {
    actionPlanByTermDep.set(`${ap.term_id}:${ap.dependency_id}`, ap);
  });

  const termDependenciesKeyMap = new Map();
  responsibilityRows.forEach((resp) => {
    const term = termMap.get(String(resp.term_id));
    const depId = resp.organizationalUnit?.id || resp.catalog_item_id;
    const key = `${resp.term_id}:${depId}`;
    const linkedPlan = actionPlanByTermDep.get(key);
    termDependenciesKeyMap.set(key, {
      id: resp.id,
      term_id: resp.term_id,
      year: term?.year || null,
      dependency_id: depId,
      dependency_code: resp.organizationalUnit?.code || linkedPlan?.dependency_code || '—',
      dependency_name: resp.organizationalUnit?.name || linkedPlan?.dependency_name || 'Dependencia',
      responsible_id: resp.responsibleUser?.id || resp.user_id || null,
      responsible_name: resp.responsibleUser?.nombre || linkedPlan?.responsible_name || 'Sin responsable',
      responsible_document: resp.responsibleUser?.username || linkedPlan?.responsible_document || '—',
      responsible_unit_siac: resp.responsibleUser?.dependencia || linkedPlan?.responsible_unit_siac || '—',
      responsible_position: resp.responsibleUser?.cargo || linkedPlan?.responsible_position || '—',
      responsible_email: resp.responsibleUser?.email || linkedPlan?.responsible_email || '—',
      has_action_plan: Boolean(linkedPlan),
      action_plan_id: linkedPlan?.id || null,
      action_plan_code: linkedPlan?.code || 'Sin plan creado',
      action_plan_status: linkedPlan?.status || 'pending',
      items_count: linkedPlan?.items_count || 0,
      avg_progress: linkedPlan?.avg_progress || 0
    });
  });

  // Asegurar que cualquier plan de acción cuya dependencia no tuviera registro en pei_responsibilities también aparezca
  actionPlansList.forEach((ap) => {
    const key = `${ap.term_id}:${ap.dependency_id}`;
    if (!termDependenciesKeyMap.has(key)) {
      termDependenciesKeyMap.set(key, {
        id: `ap-${ap.id}`,
        term_id: ap.term_id,
        year: ap.year,
        dependency_id: ap.dependency_id,
        dependency_code: ap.dependency_code,
        dependency_name: ap.dependency_name,
        responsible_id: ap.responsible_id,
        responsible_name: ap.responsible_name,
        responsible_document: ap.responsible_document,
        responsible_unit_siac: ap.responsible_unit_siac,
        responsible_position: ap.responsible_position,
        responsible_email: ap.responsible_email,
        has_action_plan: true,
        action_plan_id: ap.id,
        action_plan_code: ap.code,
        action_plan_status: ap.status,
        items_count: ap.items_count,
        avg_progress: ap.avg_progress
      });
    }
  });

  const termDependencies = Array.from(termDependenciesKeyMap.values()).sort((a, b) => {
    if ((b.year || 0) !== (a.year || 0)) return (b.year || 0) - (a.year || 0);
    return String(a.dependency_name || '').localeCompare(String(b.dependency_name || ''), 'es');
  });

  const termsProgress = Array.from(termsProgressMap.values()).map((t) => {
    const depsInYear = termDependencies.filter((d) => Number(d.year) === Number(t.year)).length;
    return {
      ...t,
      dependenciesCount: depsInYear,
      avgProgress: t.activitiesCount ? Number((t.progressSum / t.activitiesCount).toFixed(2)) : 0
    };
  }).sort((a, b) => a.year - b.year);

  const globalAvg = itemsCount ? Number((totalProgressSum / itemsCount).toFixed(2)) : 0;
  const totalLineamientosCount = objectives.reduce((acc, o) => acc + (o.guidelines?.length || 0), 0);

  // Agrupar catalogItems por tipo para enriquecer fieldDefinitions
  const catalogByType = new Map();
  catalogItems.forEach((item) => {
    if (!catalogByType.has(item.catalog_type)) catalogByType.set(item.catalog_type, []);
    catalogByType.get(item.catalog_type).push(item);
  });

  const objLevel = planLevels.find((l) => Number(l.position) === 1);
  const guidLevel = planLevels.find((l) => Number(l.position) === 2);
  const elementObjectives = planElements
    .filter((el) => objLevel && String(el.level_id) === String(objLevel.id))
    .map((el) => `${el.code} ${el.name}`.trim());
  const elementGuidelines = planElements
    .filter((el) => guidLevel && String(el.level_id) === String(guidLevel.id))
    .map((el) => `${el.code} ${el.name}`.trim());

  const resolveRowFieldVal = (row, key) => {
    const customVal = row.campos_dinamicos?.[key];
    if (customVal !== undefined && customVal !== null && customVal !== '') {
      if (Array.isArray(customVal)) return customVal.join('; ');
      if (typeof customVal === 'object') return customVal.label || customVal.name || customVal.value || JSON.stringify(customVal);
      return String(customVal);
    }
    const directMap = {
      objetivos_estrategicos: row.objetivo_estrategico,
      strategic_objective: row.objetivo_estrategico,
      lineamientos_estrategicos: row.lineamiento_estrategico,
      strategic_guideline: row.lineamiento_estrategico,
      guideline: row.lineamiento_estrategico,
      macroactividad: row.macroactividad,
      macroactivity: row.macroactividad,
      activity: row.actividad,
      actividad: row.actividad,
      indicator_type: row.tipo_indicador,
      tipo_indicador: row.tipo_indicador,
      indicator: row.indicador,
      indicador: row.indicador,
      target: row.meta,
      meta: row.meta,
      starts_on: row.starts_on,
      fecha_inicio: row.starts_on,
      ends_on: row.ends_on,
      fecha_fin: row.ends_on,
      progress_s1: row.avance_ip,
      avance_ip: row.avance_ip,
      progress_s2: row.avance_iip,
      avance_iip: row.avance_iip,
      total_progress: row.avance_total,
      avance_total: row.avance_total,
      responsible: row.responsable,
      responsable: row.responsable
    };
    const fallback = directMap[key];
    if (fallback !== undefined && fallback !== null && fallback !== '' && fallback !== '—') {
      return String(fallback);
    }
    return '';
  };

  const result = {
    plan: {
      id: selectedPlan.id,
      name: selectedPlan.name,
      code: selectedPlan.code,
      description: selectedPlan.description || '',
      starts_on: selectedPlan.starts_on,
      ends_on: selectedPlan.ends_on,
      status: selectedPlan.status,
      approval_document: selectedPlan.approval_document || '',
      administrative_act: selectedPlan.administrative_act || '',
      approved_on: selectedPlan.approved_on || null,
      global_budget: selectedPlan.global_budget || null,
      configuration_version: selectedPlan.configuration_version || 1,
      created_at: selectedPlan.createdAt || selectedPlan.created_at || null,
      updated_at: selectedPlan.updatedAt || selectedPlan.updated_at || null
    },
    availablePlans: allPlans.map((p) => ({
      id: p.id,
      name: p.name,
      code: p.code,
      status: p.status,
      period: `${p.starts_on?.slice(0, 4)}–${p.ends_on?.slice(0, 4)}`
    })),
    terms: terms.map((t) => ({
      id: t.id,
      year: t.year,
      name: t.name,
      starts_on: t.starts_on,
      ends_on: t.ends_on,
      status: t.status,
      closed_at: t.closed_at || null
    })),
    kpis: {
      totalObjetivos: objectives.length || elementObjectives.length,
      totalLineamientos: totalLineamientosCount || elementGuidelines.length,
      totalActividades: itemsCount,
      totalIndicadores,
      totalPlanes: actionPlans.length,
      totalDependencias: termDependencies.length,
      ejecucionGeneral: globalAvg,
      sinIniciar,
      enEjecucion,
      completadas
    },
    objectives,
    termsProgress,
    dependenciesProgress,
    termDependencies,
    actionPlansList,
    fieldDefinitions: fieldDefinitions.map((field) => {
      const inferredCatalogType =
        field.validation_rules?.catalog_type ||
        (field.key === 'macroactividad' || field.key === 'macroactivity' ? 'macroactivity' : null) ||
        (field.key === 'responsible' || field.key === 'responsable_de_ejecucion' ? 'organizational_unit' : null) ||
        (field.key === 'co_responsibles' ? 'organizational_unit' : null);

      let rawOptions = Array.isArray(field.options) && field.options.length ? field.options : [];
      if (!rawOptions.length && inferredCatalogType && catalogByType.has(inferredCatalogType)) {
        rawOptions = (catalogByType.get(inferredCatalogType) || []).map((ci) => ({
          code: ci.code,
          label: ci.code && !String(ci.name || '').startsWith(ci.code) ? `${ci.code} - ${ci.name}` : ci.name,
          value: ci.name
        }));
      }
      if (!rawOptions.length && ['strategic_objective', 'objetivos_estrategicos'].includes(field.key) && elementObjectives.length) {
        rawOptions = elementObjectives;
      }
      if (!rawOptions.length && ['strategic_guideline', 'lineamientos_estrategicos'].includes(field.key) && elementGuidelines.length) {
        rawOptions = elementGuidelines;
      }

      const optionLabels = rawOptions
        .map((opt) => {
          if (typeof opt === 'string' || typeof opt === 'number') return String(opt).trim();
          if (opt && typeof opt === 'object') return String(opt.label || opt.name || opt.value || opt.code || '').trim();
          return '';
        })
        .filter(Boolean);

      const observedMap = new Map();
      let filledCount = 0;
      rows.forEach((row) => {
        const val = resolveRowFieldVal(row, field.key);
        if (val !== '') {
          filledCount += 1;
          observedMap.set(val, (observedMap.get(val) || 0) + 1);
        }
      });

      const observedValues = Array.from(observedMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 30)
        .map(([label, count]) => ({ label, count }));

      const isChoice = ['list', 'catalog', 'catalog_multi'].includes(field.data_type);
      const allOptionNames = optionLabels.length
        ? optionLabels
        : isChoice
          ? observedValues.map((item) => item.label)
          : [];

      const coveragePct = rows.length ? Number(((filledCount / rows.length) * 100).toFixed(2)) : 0;

      return {
        id: field.id,
        key: field.key,
        label: field.label,
        data_type: field.data_type,
        required: field.required,
        position: field.position,
        active: field.active,
        formula: field.formula || null,
        validation_rules: field.validation_rules || {},
        catalog_type: inferredCatalogType,
        option_labels: optionLabels,
        all_option_names: allOptionNames,
        observed_values: observedValues,
        filled_count: filledCount,
        empty_count: Math.max(0, rows.length - filledCount),
        coverage_pct: coveragePct,
        options_count: allOptionNames.length,
        configuration_version: field.configuration_version || 1,
        updated_at: field.updated_at || null
      };
    }),
    rows
  };

  statsCache.set(cacheKey, { timestamp: Date.now(), data: result });
  return result;
};

module.exports = {
  getPlanStatistics
};
