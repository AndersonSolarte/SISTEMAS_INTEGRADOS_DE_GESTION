const { Op } = require('sequelize');
const {
  StrategicPlan,
  StrategicTerm,
  StrategicCatalogItem,
  StrategicActionPlan,
  StrategicActionItem,
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

/**
 * Obtiene las estadísticas consolidadas en tiempo real de un PED y sus planes de acción.
 */
const getPlanStatistics = async ({ planId = null, termId = null, year = null, catalogItemId = null } = {}) => {
  // 1. Obtener lista de todos los PEDs disponibles
  const allPlans = await StrategicPlan.findAll({
    where: { deleted_at: null },
    order: [['starts_on', 'DESC']],
    attributes: ['id', 'name', 'code', 'starts_on', 'ends_on', 'status']
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
      { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'cargo', 'dependencia'] },
      { model: StrategicTerm, as: 'term', attributes: ['id', 'year', 'status'] }
    ],
    order: [['created_at', 'DESC']]
  });

  const planIds = actionPlans.map((p) => p.id);
  const actionPlanMap = new Map(actionPlans.map((p) => [String(p.id), p]));

  // 5. Buscar Actividades (ActionItems)
  const items = planIds.length
    ? await StrategicActionItem.findAll({
        where: { action_plan_id: planIds, deleted_at: null },
        include: [{ model: StrategicElement, as: 'strategicElement', required: false }],
        order: [['code', 'ASC']]
      })
    : [];

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

    // Fila estructurada para tablas detalladas
    rows.push({
      id: item.id,
      code: item.code,
      objetivo_estrategico: objName,
      lineamiento_estrategico: guidName,
      macroactividad: macroVal,
      actividad: item.activity || custom.activity || 'Sin descripción',
      indicador: indicatorText || '—',
      meta: item.target || custom.target || '—',
      anio: yearVal,
      dependencia: actionPlan?.organizationalUnit?.name || 'Dependencia Institucional',
      responsable: actionPlan?.responsibleUser?.nombre || custom.responsible || 'Responsable Asignado',
      avance_total: progressVal,
      estado
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

  // Sumar avances de actividades por dependencia
  items.forEach((item) => {
    const actionPlan = actionPlanMap.get(String(item.action_plan_id));
    if (actionPlan) {
      const depKey = actionPlan.organizationalUnit?.id || actionPlan.catalog_item_id || actionPlan.id;
      if (dependenciesProgressMap.has(depKey)) {
        const depData = dependenciesProgressMap.get(depKey);
        depData.activitiesCount++;
        let p = percent(item.current_progress);
        if (p === null) p = percent(item.custom_values?.total_progress);
        depData.progressSum += Number(p || 0);
      }
    }
  });

  const dependenciesProgress = Array.from(dependenciesProgressMap.values()).map((dep) => ({
    ...dep,
    avgProgress: dep.activitiesCount ? Number((dep.progressSum / dep.activitiesCount).toFixed(2)) : 0
  })).sort((a, b) => b.activitiesCount - a.activitiesCount);

  const termsProgress = Array.from(termsProgressMap.values()).map((t) => ({
    ...t,
    avgProgress: t.activitiesCount ? Number((t.progressSum / t.activitiesCount).toFixed(2)) : 0
  })).sort((a, b) => a.year - b.year);

  const globalAvg = itemsCount ? Number((totalProgressSum / itemsCount).toFixed(2)) : 0;
  const totalLineamientosCount = objectives.reduce((acc, o) => acc + (o.guidelines?.length || 0), 0);

  return {
    plan: {
      id: selectedPlan.id,
      name: selectedPlan.name,
      code: selectedPlan.code,
      starts_on: selectedPlan.starts_on,
      ends_on: selectedPlan.ends_on,
      status: selectedPlan.status
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
      status: t.status
    })),
    kpis: {
      totalObjetivos: objectives.length,
      totalLineamientos: totalLineamientosCount,
      totalActividades: itemsCount,
      totalIndicadores,
      totalPlanes: actionPlans.length,
      ejecucionGeneral: globalAvg,
      sinIniciar,
      enEjecucion,
      completadas
    },
    objectives,
    termsProgress,
    dependenciesProgress,
    rows
  };
};

module.exports = {
  getPlanStatistics
};
