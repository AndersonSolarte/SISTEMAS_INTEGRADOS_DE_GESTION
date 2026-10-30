const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { Autoevaluacion, AutoevaluacionPrograma, Documento, PlanMejoramiento, PlanMejoramientoTarifaVersion, PlanMejoramientoAsignacion, PlanMejoramientoFlujoHistorial, PlanMejoramientoActividadAsignacion, User, UserModulePermission, StrategicPlan, StrategicTerm, StrategicCatalogItem, StrategicResponsibility, StrategicActionPlan, StrategicActionItem, StrategicMonitoringPeriod, StrategicMonitoringResult, StrategicEvidence } = require('../models');
const planMejoramientoDriveService = require('../services/planMejoramientoDriveService');
const { ensureActivityFoldersInDrive } = require('../services/strategicPlanningDriveService');
const { syncSinglePlanOfficialWorkbook } = require('../services/actionPlanRepositoryDriveService');

const PLAN_MANAGER_ROLES = new Set([
  'administrador',
  'autoevaluacion',
  'planeacion_estrategica',
  'planeacion_efectividad'
]);
const VALID_STATES = new Set(['borrador', 'en_ejecucion', 'cerrado']);
const ACTIONABLE_PLAN_STATES = ['asignado', 'en_ejecucion', 'devuelto'];
const ACTIONABLE_ACTIVITY_STATES = ['asignada', 'en_ejecucion', 'devuelta'];
const TEMPLATE_PATH = path.join(__dirname, '../templates/plan_mejoramiento_2026.xlsx');

const text = (value) => String(value ?? '').trim();
const array = (value) => (Array.isArray(value) ? value : []);
const number = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const payrollSubcategories = new Set(['docente_tc', 'docente_mt']);
const spaceDiscount = (quantity) => {
  const value = number(quantity);
  if (value <= 10) return 0;
  if (value <= 40) return 0.1;
  if (value <= 80) return 0.2;
  if (value <= 130) return 0.4;
  if (value <= 180) return 0.5;
  return 0.6;
};
const budgetItemTotal = (item = {}) => {
  const base = number(item.cantidad) * number(item.valorUnitario);
  if (item.categoria === 'personal' && payrollSubcategories.has(item.subcategoria)) return base * 1.51852;
  if (item.categoria === 'espacios') return base * (1 - spaceDiscount(item.cantidad));
  return base;
};

const emptyActivity = (indicator = '') => ({
  nombre: '', descripcion: '', indicador: text(indicator), meta: '', fechaInicio: '', fechaFin: '', recursos: '',
  procesoResponsable: '', cargoResponsable: '', alcance: 'PROGRAMA', ejeEstrategico: '', objetivoEstrategico: '',
  proyectoPdi: '', politicasInstitucionales: [], lineasAccionPolitica: [],
  metaAlcanzada: '', fechaSeguimiento: '', evidencia: '', observaciones: ''
});
const opportunityFromAutoevaluacion = (row, transferMode) => ({
  id: row.id,
  factor: text(row.factor), caracteristica: text(row.caracteristica), aspecto: text(row.aspectos_por_evaluar),
  calificacion: row.calificacion_indicador === null ? '' : number(row.calificacion_indicador),
  programa: text(row.programa), indicador: text(row.indicador), evidencia: text(row.evidencias),
  componente: text(row.componente), informacion: text(row.informacion_para_tener_en_cuenta),
  modoTraslado: transferMode, trasladadoAt: new Date().toISOString()
});

const opportunityFromObjective = (objective = {}) => ({
  id: objective?.origenAutoevaluacion?.id,
  factor: text(objective.factor), caracteristica: text(objective.caracteristica), aspecto: text(objective.aspecto),
  calificacion: objective.calificacion,
  programa: text(objective?.origenAutoevaluacion?.programa),
  indicador: text(objective?.origenAutoevaluacion?.indicador || objective?.actividades?.[0]?.indicador),
  evidencia: text(objective?.origenAutoevaluacion?.evidencia), componente: text(objective?.origenAutoevaluacion?.componente),
  informacion: text(objective?.origenAutoevaluacion?.informacion),
  modoTraslado: objective?.origenAutoevaluacion?.modoTraslado || 'migrado',
  trasladadoAt: objective?.origenAutoevaluacion?.trasladadoAt || new Date().toISOString()
});

const opportunitiesFromObjective = (objective = {}) => {
  if (array(objective.aspectosAutoevaluacion).length) return array(objective.aspectosAutoevaluacion);
  return objective?.origenAutoevaluacion?.id ? [opportunityFromObjective(objective)] : [];
};

const isUnformulatedImportedObjective = (objective = {}) => {
  if (!objective?.origenAutoevaluacion?.id || !objective?.origenAutoevaluacion?.modoTraslado || text(objective.objetivo)) return false;
  const meaningfulActivityFields = ['nombre', 'descripcion', 'meta', 'fechaInicio', 'fechaFin', 'recursos', 'procesoResponsable', 'cargoResponsable', 'ejeEstrategico', 'objetivoEstrategico', 'proyectoPdi', 'politicasInstitucionales', 'lineasAccionPolitica', 'metaAlcanzada', 'fechaSeguimiento', 'evidencia', 'observaciones'];
  return !array(objective.actividades).some((activity) => meaningfulActivityFields.some((field) => text(activity?.[field])));
};

const mergeAutoevaluacionRows = (plan, rows, transferMode) => {
  const content = plan.contenido && typeof plan.contenido === 'object' ? plan.contenido : {};
  const current = array(content.objetivos);
  const migratedObjectives = current.filter(isUnformulatedImportedObjective);
  const retainedObjectives = current.filter((objective) => !isUnformulatedImportedObjective(objective));
  const storedOpportunities = array(content.oportunidadesAutoevaluacion);
  const storedOpportunityIds = new Set(storedOpportunities.map((item) => String(item?.id || '')).filter(Boolean));
  const objectiveOpportunities = current.flatMap(opportunitiesFromObjective);
  const recovered = objectiveOpportunities.filter((item) => !storedOpportunityIds.has(String(item.id))).length;
  const opportunityMap = new Map();
  [...storedOpportunities, ...objectiveOpportunities].forEach((item) => {
    if (item?.id) opportunityMap.set(String(item.id), item);
  });
  const existingIds = new Set(opportunityMap.keys());
  const pending = rows.filter((row) => !existingIds.has(String(row.id)));
  pending.forEach((row) => opportunityMap.set(String(row.id), opportunityFromAutoevaluacion(row, transferMode)));
  return {
    added: pending.length,
    skipped: rows.length - pending.length,
    migrated: migratedObjectives.length,
    recovered,
    content: {
      ...content,
      programa: plan.programa,
      objetivos: retainedObjectives,
      oportunidadesAutoevaluacion: Array.from(opportunityMap.values()),
      presupuesto: array(content.presupuesto)
    }
  };
};

const findOrCreateProgramPlan = async (programa, userId) => {
  const currentYear = new Date().getFullYear();
  let plan = await PlanMejoramiento.findOne({
    where: { programa: { [Op.iLike]: text(programa) }, estado: { [Op.ne]: 'cerrado' } },
    order: [['updatedAt', 'DESC'], ['id', 'DESC']]
  });
  if (!plan) {
    plan = await PlanMejoramiento.create({
      programa: text(programa), periodo_inicio: currentYear, periodo_fin: currentYear + 2, estado: 'borrador',
      contenido: { programa: text(programa), periodoInicio: currentYear, periodoFin: currentYear + 2, objetivos: [], oportunidadesAutoevaluacion: [], presupuesto: [], origen: 'autoevaluacion' },
      creado_por: userId, actualizado_por: userId
    });
  }
  return plan;
};

const ensureAccess = async (req, res, next) => {
  try {
    if (PLAN_MANAGER_ROLES.has(req.user?.role)) {
      req.planMejoramientoManager = true;
      return next();
    }
    const permissions = await UserModulePermission.findAll({
      where: {
        user_id: req.user?.id,
        module_key: { [Op.in]: ['autoevaluacion', 'autoevaluacion.plan_mejoramiento', 'autoevaluacion_ejecucion'] },
        can_view: true
      },
      attributes: ['module_key'], raw: true
    });
    if (permissions.some((item) => item.module_key === 'autoevaluacion.plan_mejoramiento')) {
      req.planMejoramientoManager = true;
      return next();
    }
    const [assigned, delegated] = await Promise.all([
      PlanMejoramientoAsignacion.count({ where: { user_id: req.user?.id, activo: true, estado_flujo: { [Op.in]: ACTIONABLE_PLAN_STATES } } }),
      PlanMejoramientoActividadAsignacion.count({ where: { user_id: req.user?.id, activo: true, estado_flujo: { [Op.in]: ACTIONABLE_ACTIVITY_STATES } } })
    ]);
    if (assigned > 0 || delegated > 0) {
      req.planExecutionOnly = true;
      req.planCollaboratorOnly = assigned === 0 && delegated > 0;
      return next();
    }
    return res.status(403).json({ success: false, message: 'No tienes acceso al Plan de mejoramiento' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible validar el acceso' });
  }
};
const ensureManager = (req, res, next) => req.planMejoramientoManager
  ? next()
  : res.status(403).json({ success: false, message: 'Esta acción corresponde al equipo de Autoevaluación' });

const canAccessPlan = async (req, planId) => {
  if (!req.planExecutionOnly) return true;
  const [leader, collaborator] = await Promise.all([
    PlanMejoramientoAsignacion.count({ where: { plan_id: planId, user_id: req.user?.id, activo: true, estado_flujo: { [Op.in]: ACTIONABLE_PLAN_STATES } } }),
    PlanMejoramientoActividadAsignacion.count({ where: { plan_id: planId, user_id: req.user?.id, activo: true, ...(req.planCollaboratorOnly ? { estado_flujo: { [Op.in]: ACTIONABLE_ACTIVITY_STATES } } : {}) } })
  ]);
  return Boolean(leader || collaborator);
};

const mergeExecutionContent = (stored = {}, incoming = {}, allowedActivityUids = null) => {
  const incomingByUid = new Map(array(incoming.objetivos).flatMap((objective) => array(objective.actividades)).filter((activity) => activity?.uid).map((activity) => [String(activity.uid), activity]));
  return ({
  ...stored,
  objetivos: array(stored.objetivos).map((objective, objectiveIndex) => {
    const incomingObjective = array(incoming.objetivos)[objectiveIndex] || {};
    return {
      ...objective,
      actividades: array(objective.actividades).map((activity, activityIndex) => {
        const update = incomingByUid.get(String(activity.uid || '')) || array(incomingObjective.actividades)[activityIndex] || {};
        if (allowedActivityUids && !allowedActivityUids.has(String(activity.uid || ''))) return activity;
        return {
          ...activity,
          metaAlcanzada: update.metaAlcanzada ?? activity.metaAlcanzada,
          fechaSeguimiento: update.fechaSeguimiento ?? activity.fechaSeguimiento,
          evidencia: update.evidencia ?? activity.evidencia,
          observaciones: update.observaciones ?? activity.observaciones,
          verificacionSeguimiento: allowedActivityUids ? activity.verificacionSeguimiento : (update.verificacionSeguimiento ?? activity.verificacionSeguimiento),
          seguimientos: array(update.seguimientos).length >= array(activity.seguimientos).length ? array(update.seguimientos) : array(activity.seguimientos)
        };
      })
    };
  })
  });
};

const mergeLeaderExecutionContent = (stored = {}, incoming = {}) => ({
  ...stored,
  objetivos: array(incoming.objetivos),
  presupuesto: array(incoming.presupuesto),
  oportunidadesAutoevaluacion: array(stored.oportunidadesAutoevaluacion),
  origen: stored.origen || incoming.origen
});

const assignmentData = async (planId) => {
  const assignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: planId, activo: true }, order: [['id', 'DESC']], raw: true });
  const activityAssignments = await PlanMejoramientoActividadAsignacion.findAll({ where: { plan_id: planId, activo: true }, order: [['id', 'ASC']], raw: true });
  if (!assignment && !activityAssignments.length) return null;
  const userIds = Array.from(new Set([assignment?.user_id, ...activityAssignments.map((item) => item.user_id)].filter(Boolean)));
  const [users, history] = await Promise.all([
    User.findAll({ where: { id: { [Op.in]: userIds }, estado: 'activo' }, attributes: ['id', 'nombre', 'username', 'email', 'cargo', 'dependencia', 'vicerrectoria'], raw: true }),
    PlanMejoramientoFlujoHistorial.findAll({ where: { plan_id: planId }, order: [['createdAt', 'ASC'], ['id', 'ASC']], raw: true })
  ]);
  const userMap = new Map(users.map((item) => [String(item.id), { ...item, documento: item.username }]));
  return {
    ...assignment,
    usuario: assignment ? userMap.get(String(assignment.user_id)) || null : null,
    historial: history,
    actividades: activityAssignments.map((item) => ({ ...item, usuario: userMap.get(String(item.user_id)) || null }))
  };
};

const planStateForAssignment = (currentState, assignment) => {
  if (assignment?.usuario?.id) return assignment.estado_flujo === 'en_firme' ? 'cerrado' : 'en_ejecucion';
  return currentState === 'en_ejecucion' ? 'borrador' : currentState;
};

const serializeWithAssignment = async (plan) => {
  const assignment = await assignmentData(plan.id);
  const expectedState = planStateForAssignment(plan.estado, assignment);
  if (expectedState !== plan.estado) {
    try {
      await plan.update({ estado: expectedState });
    } catch (error) {
      console.error(`[plan-mejoramiento] No se pudo reconciliar el estado del plan ${plan.id}:`, error.message);
      plan.setDataValue('estado', expectedState);
    }
  }
  return { ...serialize(plan), asignacion: assignment };
};
const ensureActivityUids = async (plan) => {
  const content = plan.contenido && typeof plan.contenido === 'object' ? plan.contenido : {};
  let changed = false;
  const objectives = array(content.objetivos).map((objective) => ({
    ...objective,
    actividades: array(objective.actividades).map((activity) => {
      if (activity?.uid) return activity;
      changed = true;
      return { ...activity, uid: crypto.randomUUID() };
    })
  }));
  if (changed) await plan.update({ contenido: { ...content, objetivos: objectives } });
  return plan;
};
const serializeForRequest = async (plan, req) => {
  await ensureActivityUids(plan);
  const result = await serializeWithAssignment(plan);
  if (!req.planCollaboratorOnly) return result;
  const activityAssignments = array(result.asignacion?.actividades).filter((item) => item.user_id === req.user?.id && item.activo && ACTIONABLE_ACTIVITY_STATES.includes(item.estado_flujo));
  const allowed = new Set(activityAssignments.map((item) => String(item.actividad_uid)));
  const filteredObjectives = array(result.contenido?.objetivos).map((objective) => ({
    ...objective,
    actividades: array(objective.actividades).filter((activity) => allowed.has(String(activity.uid || '')))
  })).filter((objective) => objective.actividades.length);
  result.contenido = { ...result.contenido, objetivos: filteredObjectives, presupuesto: [] };
  result.resumen = {
    ...result.resumen,
    objetivos: filteredObjectives.length,
    actividades: filteredObjectives.reduce((sum, objective) => sum + objective.actividades.length, 0),
    presupuesto: 0
  };
  result.asignacion.actividades = activityAssignments;
  result.asignacion.esColaborador = true;
  return result;
};

const findActivity = (plan, uid) => array(plan?.contenido?.objetivos).flatMap((objective) => array(objective.actividades)).find((activity) => String(activity.uid || '') === String(uid));

const assignActivity = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    const leader = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: plan.id, user_id: req.user?.id, activo: true } });
    if (!req.planMejoramientoManager && !leader) return res.status(403).json({ success: false, message: 'Solo el líder del plan puede delegar actividades' });
    const activityUid = text(req.params.uid);
    await ensureActivityUids(plan);
    if (!activityUid || !findActivity(plan, activityUid)) return res.status(404).json({ success: false, message: 'No se encontró la actividad indicada' });
    const selectedUser = req.body?.userId
      ? await User.findOne({ where: { id: Number(req.body.userId), estado: 'activo' } })
      : await User.findOne({ where: { username: { [Op.iLike]: text(req.body?.documento) }, estado: 'activo' } });
    if (!selectedUser) return res.status(404).json({ success: false, message: 'No se encontró un colaborador interno activo' });
    const currentAssignment = await PlanMejoramientoActividadAsignacion.findOne({ where: { plan_id: plan.id, actividad_uid: activityUid, activo: true } });
    if (currentAssignment?.user_id === selectedUser.id) return res.json({ success: true, data: await assignmentData(plan.id), message: `${selectedUser.nombre} ya está asignado a esta actividad` });
    const previousAssignments = await PlanMejoramientoActividadAsignacion.findAll({ where: { plan_id: plan.id, actividad_uid: activityUid, activo: true }, attributes: ['user_id', 'historial', 'correcciones'], raw: true });
    const previousUserIds = Array.from(new Set(previousAssignments.map((item) => item.user_id).filter((id) => id !== selectedUser.id)));
    const previousHistory = previousAssignments.flatMap((item) => array(item.historial));
    const previousCorrections = previousAssignments.flatMap((item) => array(item.correcciones));
    await PlanMejoramientoActividadAsignacion.update({ activo: false }, { where: { plan_id: plan.id, actividad_uid: activityUid, activo: true } });
    await PlanMejoramientoActividadAsignacion.create({
      plan_id: plan.id, actividad_uid: activityUid, user_id: selectedUser.id, estado_flujo: 'asignada', activo: true,
      asignado_por: req.user?.id, ultima_observacion: text(req.body?.observacion) || null,
      historial: [...previousHistory, { accion: previousAssignments.length ? 'reasignar' : 'asignar', estadoNuevo: 'asignada', observacion: text(req.body?.observacion) || `Asignada a ${selectedUser.nombre}`, actorId: req.user?.id, actor: req.user?.nombre || req.user?.email, fecha: new Date().toISOString() }],
      correcciones: previousCorrections
    });
    await UserModulePermission.upsert({ user_id: selectedUser.id, module_key: 'autoevaluacion_ejecucion', can_view: true, can_manage: true });
    for (const previousUserId of previousUserIds) {
      const [remainingPlans, remainingActivities] = await Promise.all([
        PlanMejoramientoAsignacion.count({ where: { user_id: previousUserId, activo: true } }),
        PlanMejoramientoActividadAsignacion.count({ where: { user_id: previousUserId, activo: true } })
      ]);
      if (!remainingPlans && !remainingActivities) await UserModulePermission.update({ can_view: false, can_manage: false }, { where: { user_id: previousUserId, module_key: 'autoevaluacion_ejecucion' } });
    }
    return res.status(201).json({ success: true, data: await assignmentData(plan.id), message: `Actividad asignada a ${selectedUser.nombre}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'No fue posible asignar la actividad' });
  }
};

const activityWorkflowAction = async (req, res) => {
  try {
    const task = await PlanMejoramientoActividadAsignacion.findOne({ where: { plan_id: req.params.id, actividad_uid: text(req.params.uid), activo: true }, order: [['id', 'DESC']] });
    if (!task) return res.status(404).json({ success: false, message: 'La actividad no tiene colaborador asignado' });
    const leader = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: req.params.id, user_id: req.user?.id, activo: true } });
    const isCollaborator = task.user_id === req.user?.id;
    const isReviewer = Boolean(req.planMejoramientoManager || leader);
    const action = text(req.body?.accion);
    const observation = text(req.body?.observacion);
    const transitions = {
      iniciar: { from: ['asignada', 'devuelta'], to: 'en_ejecucion', collaborator: true },
      entregar: { from: ['en_ejecucion', 'devuelta'], to: 'entregada', collaborator: true },
      devolver: { from: ['entregada'], to: 'devuelta', reviewer: true, observation: true },
      aprobar: { from: ['entregada'], to: 'aprobada', reviewer: true }
    };
    const transition = transitions[action];
    if (!transition || (transition.collaborator && !isCollaborator) || (transition.reviewer && !isReviewer)) return res.status(403).json({ success: false, message: 'No tiene permiso para realizar esta acción' });
    if (!transition.from.includes(task.estado_flujo)) return res.status(409).json({ success: false, message: `No se puede ejecutar esta acción desde ${task.estado_flujo}` });
    if (transition.observation && !observation) return res.status(400).json({ success: false, message: 'La observación de devolución es obligatoria' });
    const corrections = array(task.correcciones);
    if (action === 'entregar' && corrections.some((item) => item.estado === 'pendiente')) return res.status(409).json({ success: false, message: 'Marque como corregidas todas las observaciones pendientes antes de enviar a revisión' });
    if (action === 'aprobar' && corrections.some((item) => item.estado === 'pendiente')) return res.status(409).json({ success: false, message: 'La actividad todavía tiene correcciones pendientes' });
    const history = [...array(task.historial), { accion: action, estadoAnterior: task.estado_flujo, estadoNuevo: transition.to, observacion: observation, actorId: req.user?.id, actor: req.user?.nombre || req.user?.email, fecha: new Date().toISOString() }];
    const nextCorrections = action === 'devolver'
      ? [...corrections, { id: crypto.randomUUID(), descripcion: observation, estado: 'pendiente', creadoAt: new Date().toISOString(), creadoPorId: req.user?.id, creadoPor: req.user?.nombre || req.user?.email }]
      : action === 'aprobar'
        ? corrections.map((item) => item.estado === 'corregida' ? { ...item, estado: 'validada', validadaAt: new Date().toISOString(), validadaPorId: req.user?.id, validadaPor: req.user?.nombre || req.user?.email } : item)
        : corrections;
    await task.update({ estado_flujo: transition.to, ultima_observacion: observation || task.ultima_observacion, historial: history, correcciones: nextCorrections });
    return res.json({ success: true, data: await assignmentData(task.plan_id), message: `Actividad actualizada a ${transition.to.replace(/_/g, ' ')}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible actualizar el flujo de la actividad' });
  }
};

const activityCorrectionAction = async (req, res) => {
  try {
    const task = await PlanMejoramientoActividadAsignacion.findOne({ where: { plan_id: req.params.id, actividad_uid: text(req.params.uid), activo: true }, order: [['id', 'DESC']] });
    if (!task) return res.status(404).json({ success: false, message: 'La actividad no tiene colaborador asignado' });
    const leader = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: req.params.id, user_id: req.user?.id, activo: true } });
    const isCollaborator = task.user_id === req.user?.id;
    const isReviewer = Boolean(req.planMejoramientoManager || leader);
    const action = text(req.body?.accion);
    const responseText = text(req.body?.respuesta);
    const corrections = array(task.correcciones);
    const correctionIndex = corrections.findIndex((item) => String(item.id) === String(req.params.correctionId));
    if (correctionIndex < 0) return res.status(404).json({ success: false, message: 'No se encontró la corrección indicada' });
    const current = corrections[correctionIndex];
    let updated;
    if (action === 'marcar_corregida' && isCollaborator && current.estado === 'pendiente') {
      updated = { ...current, estado: 'corregida', respuesta: responseText, corregidaAt: new Date().toISOString(), corregidaPorId: req.user?.id, corregidaPor: req.user?.nombre || req.user?.email };
    } else if (action === 'validar' && isReviewer && current.estado === 'corregida') {
      updated = { ...current, estado: 'validada', validadaAt: new Date().toISOString(), validadaPorId: req.user?.id, validadaPor: req.user?.nombre || req.user?.email };
    } else if (action === 'reabrir' && isReviewer && ['corregida', 'validada'].includes(current.estado)) {
      if (!responseText) return res.status(400).json({ success: false, message: 'Indique el motivo para reabrir la corrección' });
      updated = { ...current, estado: 'pendiente', reapertura: responseText, reabiertaAt: new Date().toISOString(), reabiertaPorId: req.user?.id, reabiertaPor: req.user?.nombre || req.user?.email };
    } else {
      return res.status(409).json({ success: false, message: 'La acción no corresponde al estado actual de la corrección' });
    }
    const nextCorrections = corrections.map((item, index) => index === correctionIndex ? updated : item);
    const history = [...array(task.historial), { accion: `correccion_${action}`, observacion: responseText || current.descripcion, actorId: req.user?.id, actor: req.user?.nombre || req.user?.email, fecha: new Date().toISOString(), correccionId: current.id }];
    await task.update({ correcciones: nextCorrections, historial: history, estado_flujo: action === 'reabrir' ? 'devuelta' : task.estado_flujo, ultima_observacion: action === 'reabrir' ? responseText : task.ultima_observacion });
    return res.json({ success: true, data: await assignmentData(task.plan_id), message: 'Bitácora de correcciones actualizada' });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible actualizar la corrección' });
  }
};

const assignPlan = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    const document = text(req.body?.documento);
    const selectedUser = req.body?.userId
      ? await User.findOne({ where: { id: Number(req.body.userId), estado: 'activo' } })
      : await User.findOne({ where: { username: { [Op.iLike]: document }, estado: 'activo' } });
    if (!selectedUser) return res.status(404).json({ success: false, message: 'No se encontró un usuario interno activo con ese documento' });

    const currentAssignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: plan.id, activo: true } });
    if (currentAssignment?.user_id === selectedUser.id) {
      if (plan.estado === 'borrador') await plan.update({ estado: 'en_ejecucion', actualizado_por: req.user?.id });
      return res.json({ success: true, data: { ...(await assignmentData(plan.id)), planEstado: plan.estado }, message: `${selectedUser.nombre} ya es el responsable de este plan` });
    }

    const transaction = await PlanMejoramientoAsignacion.sequelize.transaction();
    let assignment;
    let previousUserIds = [];
    try {
      const previous = await PlanMejoramientoAsignacion.findAll({ where: { plan_id: plan.id, activo: true }, transaction });
      previousUserIds = previous.map((item) => item.user_id).filter((id) => id !== selectedUser.id);
      await PlanMejoramientoAsignacion.update({ activo: false }, { where: { plan_id: plan.id, activo: true }, transaction });
      assignment = await PlanMejoramientoAsignacion.create({
        plan_id: plan.id,
        user_id: selectedUser.id,
        estado_flujo: 'asignado',
        activo: true,
        asignado_por: req.user?.id,
        asignado_at: new Date(),
        ultima_observacion: text(req.body?.observacion) || null
      }, { transaction });
      await PlanMejoramientoFlujoHistorial.create({
        asignacion_id: assignment.id,
        plan_id: plan.id,
        actor_user_id: req.user?.id,
        actor_nombre: req.user?.nombre || req.user?.email,
        accion: 'asignar',
        estado_anterior: null,
        estado_nuevo: 'asignado',
        observacion: text(req.body?.observacion) || `Responsable asignado: ${selectedUser.nombre}`
      }, { transaction });
      await UserModulePermission.upsert({ user_id: selectedUser.id, module_key: 'autoevaluacion_ejecucion', can_view: true, can_manage: true }, { transaction });
      if (plan.estado === 'borrador') await plan.update({ estado: 'en_ejecucion', actualizado_por: req.user?.id }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    for (const previousUserId of previousUserIds) {
      const [remainingPlans, remainingActivities] = await Promise.all([
        PlanMejoramientoAsignacion.count({ where: { user_id: previousUserId, activo: true } }),
        PlanMejoramientoActividadAsignacion.count({ where: { user_id: previousUserId, activo: true } })
      ]);
      if (!remainingPlans && !remainingActivities) await UserModulePermission.update({ can_view: false, can_manage: false }, { where: { user_id: previousUserId, module_key: 'autoevaluacion_ejecucion' } });
    }
    return res.status(201).json({ success: true, data: { ...(await assignmentData(plan.id)), planEstado: plan.estado }, message: `Plan asignado a ${selectedUser.nombre} y puesto en ejecución` });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'No fue posible asignar el plan' });
  }
};

const workflowAction = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    const assignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: plan.id, activo: true }, order: [['id', 'DESC']] });
    if (!assignment) return res.status(409).json({ success: false, message: 'El plan todavía no tiene responsable asignado' });
    const isManager = Boolean(req.planMejoramientoManager);
    const isExecutor = assignment.user_id === req.user?.id;
    if (!isManager && !isExecutor) return res.status(403).json({ success: false, message: 'No tienes acceso a este flujo' });
    const action = text(req.body?.accion);
    const observation = text(req.body?.observacion);
    const transitions = {
      iniciar: { from: ['asignado', 'devuelto'], to: 'en_ejecucion', executor: true },
      enviar_revision: { from: ['en_ejecucion', 'devuelto'], to: 'en_revision', executor: true },
      devolver: { from: ['en_revision'], to: 'devuelto', manager: true, observation: true },
      aprobar: { from: ['en_revision'], to: 'en_firme', manager: true },
      reabrir: { from: ['en_firme'], to: 'en_ejecucion', manager: true, observation: true }
    };
    const transition = transitions[action];
    if (!transition || (transition.manager && !isManager) || (transition.executor && !isExecutor && !isManager)) {
      return res.status(403).json({ success: false, message: 'La transición solicitada no está permitida para tu usuario' });
    }
    if (!transition.from.includes(assignment.estado_flujo)) return res.status(409).json({ success: false, message: `No se puede ejecutar esta acción desde el estado ${assignment.estado_flujo}` });
    if (transition.observation && !observation) return res.status(400).json({ success: false, message: 'La observación es obligatoria' });
    if (action === 'enviar_revision') {
      const pendingActivities = await PlanMejoramientoActividadAsignacion.count({ where: { plan_id: plan.id, activo: true, estado_flujo: { [Op.ne]: 'aprobada' } } });
      if (pendingActivities) return res.status(409).json({ success: false, message: `Hay ${pendingActivities} actividad(es) delegada(s) pendientes de aprobación por el líder` });
    }
    const previousState = assignment.estado_flujo;
    await assignment.update({ estado_flujo: transition.to, ultima_observacion: observation || assignment.ultima_observacion });
    const nextPlanState = transition.to === 'en_firme' ? 'cerrado' : transition.to === 'en_ejecucion' ? 'en_ejecucion' : null;
    if (nextPlanState && plan.estado !== nextPlanState) await plan.update({ estado: nextPlanState, actualizado_por: req.user?.id });
    await PlanMejoramientoFlujoHistorial.create({
      asignacion_id: assignment.id,
      plan_id: plan.id,
      actor_user_id: req.user?.id,
      actor_nombre: req.user?.nombre || req.user?.email,
      accion: action,
      estado_anterior: previousState,
      estado_nuevo: transition.to,
      observacion: observation || null
    });
    return res.json({ success: true, data: { ...(await assignmentData(plan.id)), planEstado: plan.estado }, message: `Plan actualizado a ${transition.to.replace(/_/g, ' ')}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible actualizar el flujo del plan' });
  }
};

const executionBadge = async (req, res) => {
  try {
    const where = req.planExecutionOnly
      ? { user_id: req.user?.id, activo: true, estado_flujo: { [Op.in]: ACTIONABLE_PLAN_STATES } }
      : { activo: true };
    const taskWhere = req.planCollaboratorOnly ? { ...where, estado_flujo: { [Op.in]: ACTIONABLE_ACTIVITY_STATES } } : where;
    const [rows, tasks] = await Promise.all([
      PlanMejoramientoAsignacion.findAll({ where, attributes: ['estado_flujo'], raw: true }),
      PlanMejoramientoActividadAsignacion.findAll({ where: taskWhere, attributes: ['estado_flujo'], raw: true })
    ]);
    const pending = rows.filter((item) => req.planExecutionOnly
      ? ['asignado', 'en_ejecucion', 'devuelto'].includes(item.estado_flujo)
      : item.estado_flujo === 'en_revision').length + tasks.filter((item) => req.planCollaboratorOnly
      ? ['asignada', 'en_ejecucion', 'devuelta'].includes(item.estado_flujo)
      : item.estado_flujo === 'entregada').length;
    return res.json({ success: true, data: { access: rows.length > 0 || tasks.length > 0 || Boolean(req.planMejoramientoManager), pending, executionOnly: Boolean(req.planExecutionOnly), collaboratorOnly: Boolean(req.planCollaboratorOnly) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar la bandeja de ejecución' });
  }
};

const normalizePayload = (body = {}) => {
  const currentYear = new Date().getFullYear();
  const contenido = body.contenido && typeof body.contenido === 'object' ? body.contenido : {};
  const programa = text(body.programa || contenido.programa);
  const periodoInicio = Number(body.periodo_inicio || contenido.periodoInicio || currentYear);
  const periodoFin = Number(body.periodo_fin || contenido.periodoFin || periodoInicio + 2);
  const estado = VALID_STATES.has(body.estado) ? body.estado : 'borrador';

  if (!programa) {
    const error = new Error('El programa o dependencia es obligatorio');
    error.status = 400;
    throw error;
  }
  if (!Number.isInteger(periodoInicio) || !Number.isInteger(periodoFin) || periodoFin < periodoInicio) {
    const error = new Error('El periodo de ejecución no es válido');
    error.status = 400;
    throw error;
  }

  return {
    programa,
    periodo_inicio: periodoInicio,
    periodo_fin: periodoFin,
    estado,
    contenido: { ...contenido, programa, periodoInicio, periodoFin }
  };
};

const serialize = (plan) => {
  const plain = plan.toJSON ? plan.toJSON() : plan;
  const objectives = array(plain.contenido?.objetivos);
  const activities = objectives.reduce((sum, objective) => sum + Math.max(array(objective.actividades).length, 1), 0);
  const budgets = array(plain.contenido?.presupuesto);
  const totalBudget = budgets.reduce((sum, item) => sum + budgetItemTotal(item), 0);
  const objectiveProgressValues = objectives.map((objective) => {
    const objectiveActivities = array(objective.actividades);
    if (!objectiveActivities.length) return 0;
    return objectiveActivities.reduce((sum, activity) => {
      const meta = number(activity.meta);
      return sum + (meta > 0 ? Math.min(100, Math.max(0, (number(activity.metaAlcanzada) / meta) * 100)) : 0);
    }, 0) / objectiveActivities.length;
  });
  return {
    ...plain,
    resumen: {
      objetivos: objectives.length,
      actividades: activities,
      presupuesto: totalBudget,
      avance: objectiveProgressValues.length ? objectiveProgressValues.reduce((sum, value) => sum + value, 0) / objectiveProgressValues.length : 0
    }
  };
};

const syncAutoevaluacion = async (req, res) => {
  try {
    const requestedIds = Array.from(new Set(array(req.body?.aspectIds).map((id) => Number(id)).filter(Number.isInteger)));
    const manual = requestedIds.length > 0 || req.body?.mode === 'manual';
    const programFilter = text(req.body?.programa);
    const where = {};
    if (requestedIds.length) where.id = { [Op.in]: requestedIds };
    if (programFilter) where.programa = { [Op.iLike]: programFilter };
    where.calificacion_indicador = manual ? { [Op.gte]: 4 } : { [Op.lt]: 4 };

    const [aspectRows, programRows, programCatalogRows] = await Promise.all([
      Autoevaluacion.findAll({ where, order: [['programa', 'ASC'], ['factor', 'ASC'], ['caracteristica', 'ASC'], ['id', 'ASC']] }),
      programFilter ? Promise.resolve([]) : AutoevaluacionPrograma.findAll({ attributes: ['programa'], group: ['programa'], raw: true }),
      programFilter ? Promise.resolve([]) : Autoevaluacion.findAll({ attributes: ['programa'], group: ['programa'], raw: true })
    ]);
    const grouped = new Map();
    aspectRows.forEach((row) => {
      const key = text(row.programa);
      if (!key) return;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(row);
    });
    if (!manual) {
      [...programRows, ...programCatalogRows].forEach((row) => {
        const key = text(row.programa);
        if (key && !grouped.has(key)) grouped.set(key, []);
      });
    }
    if (programFilter && !grouped.has(programFilter)) grouped.set(programFilter, []);

    const result = { programsCreatedOrUpdated: 0, aspectsAdded: 0, duplicatesSkipped: 0, plans: [] };
    for (const [programa, rows] of grouped.entries()) {
      const plan = await findOrCreateProgramPlan(programa, req.user?.id);
      const merged = mergeAutoevaluacionRows(plan, rows, manual ? 'manual' : 'automatico_menor_4');
      if (merged.added > 0 || merged.migrated > 0 || merged.recovered > 0) await plan.update({ contenido: merged.content, actualizado_por: req.user?.id });
      result.programsCreatedOrUpdated += 1;
      result.aspectsAdded += merged.added;
      result.duplicatesSkipped += merged.skipped;
      result.plans.push({ id: plan.id, programa: plan.programa, added: merged.added, skipped: merged.skipped });
    }
    return res.json({ success: true, data: result });
  } catch (error) {
    console.error('[plan-mejoramiento] Error sincronizando autoevaluacion:', error);
    return res.status(500).json({ success: false, message: 'No fue posible sincronizar Autoevaluación con el Plan de mejoramiento' });
  }
};

const linkedAutoevaluacion = async (req, res) => {
  try {
    const programa = text(req.query.programa);
    if (!programa) return res.json({ success: true, data: { aspectIds: [], associatedAspectIds: [] } });
    const plan = await PlanMejoramiento.findOne({
      where: { programa: { [Op.iLike]: programa }, estado: { [Op.ne]: 'cerrado' } },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']]
    });
    const opportunities = array(plan?.contenido?.oportunidadesAutoevaluacion);
    const aspectIds = opportunities
      .filter((item) => number(item.calificacion) >= 4 && item.modoTraslado === 'manual')
      .map((item) => Number(item.id))
      .filter(Number.isInteger);
    const associatedAspectIds = Array.from(new Set(array(plan?.contenido?.objetivos)
      .flatMap(opportunitiesFromObjective)
      .filter((item) => number(item.calificacion) >= 4)
      .map((item) => Number(item.id))
      .filter(Number.isInteger)));
    return res.json({ success: true, data: { aspectIds, associatedAspectIds } });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar los aspectos vinculados' });
  }
};

const searchResponsables = async (req, res) => {
  try {
    const query = text(req.query.q);
    if (query.length < 2) return res.json({ success: true, data: [] });
    const rows = await User.findAll({
      where: {
        estado: 'activo',
        [Op.or]: [
          { nombre: { [Op.iLike]: `%${query}%` } },
          { username: { [Op.iLike]: `%${query}%` } },
          { email: { [Op.iLike]: `%${query}%` } },
          { cargo: { [Op.iLike]: `%${query}%` } },
          { dependencia: { [Op.iLike]: `%${query}%` } }
        ]
      },
      attributes: ['id', 'nombre', 'username', 'email', 'cargo', 'dependencia', 'vicerrectoria'],
      order: [['nombre', 'ASC']],
      limit: 20,
      raw: true
    });
    return res.json({
      success: true,
      data: rows.map((row) => ({
        id: row.id,
        nombre: row.nombre,
        documento: row.username,
        email: row.email,
        cargo: row.cargo,
        dependencia: row.dependencia,
        vicerrectoria: row.vicerrectoria
      }))
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar los responsables internos' });
  }
};

const unlinkAutoevaluacion = async (req, res) => {
  try {
    const programa = text(req.body?.programa);
    const requestedIds = Array.from(new Set(array(req.body?.aspectIds).map(Number).filter(Number.isInteger)));
    if (!programa || !requestedIds.length) return res.status(400).json({ success: false, message: 'Programa y aspectos son obligatorios' });

    const eligibleRows = await Autoevaluacion.findAll({
      where: { id: { [Op.in]: requestedIds }, programa: { [Op.iLike]: programa }, calificacion_indicador: { [Op.gte]: 4 } },
      attributes: ['id'], raw: true
    });
    const removableIds = new Set(eligibleRows.map((row) => String(row.id)));
    const plan = await PlanMejoramiento.findOne({
      where: { programa: { [Op.iLike]: programa }, estado: { [Op.ne]: 'cerrado' } },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']]
    });
    if (!plan) return res.status(404).json({ success: false, message: 'No se encontró un plan activo para el programa' });

    const content = plan.contenido && typeof plan.contenido === 'object' ? plan.contenido : {};
    const opportunities = array(content.oportunidadesAutoevaluacion);
    const manualIds = new Set(opportunities
      .filter((item) => item.modoTraslado === 'manual' && removableIds.has(String(item.id)))
      .map((item) => String(item.id)));
    const nextOpportunities = opportunities.filter((item) => !manualIds.has(String(item.id)));
    const nextObjectives = array(content.objetivos).map((objective) => {
      const selected = opportunitiesFromObjective(objective).filter((item) => !manualIds.has(String(item.id)));
      const hadRemoved = opportunitiesFromObjective(objective).length !== selected.length;
      if (!hadRemoved) return objective;
      if (!selected.length) {
        return { ...objective, factor: '', caracteristica: '', aspecto: '', calificacion: '', tipoAccion: '', origenAutoevaluacion: undefined, aspectosAutoevaluacion: [] };
      }
      const scores = selected.map((item) => Number(item.calificacion)).filter(Number.isFinite);
      return {
        ...objective,
        factor: selected[0].factor,
        caracteristica: selected[0].caracteristica,
        aspecto: selected.map((item) => item.aspecto).join('\n'),
        calificacion: scores.length ? Math.min(...scores) : '',
        tipoAccion: scores.some((score) => score < 4) ? 'Mejoramiento' : 'Fortalecimiento',
        origenAutoevaluacion: { ...selected[0], id: selected[0].id },
        aspectosAutoevaluacion: selected
      };
    });
    await plan.update({
      contenido: { ...content, objetivos: nextObjectives, oportunidadesAutoevaluacion: nextOpportunities },
      actualizado_por: req.user?.id
    });
    return res.json({ success: true, data: { removed: manualIds.size, aspectIds: Array.from(manualIds).map(Number) } });
  } catch (error) {
    console.error('[plan-mejoramiento] Error desvinculando autoevaluación:', error);
    return res.status(500).json({ success: false, message: 'No fue posible desvincular los aspectos del Plan de mejoramiento' });
  }
};

const list = async (req, res) => {
  try {
    const where = {};
    if (req.planExecutionOnly) {
      const [assignments, tasks] = await Promise.all([
        PlanMejoramientoAsignacion.findAll({ where: { user_id: req.user?.id, activo: true, estado_flujo: { [Op.in]: ACTIONABLE_PLAN_STATES } }, attributes: ['plan_id'], raw: true }),
        PlanMejoramientoActividadAsignacion.findAll({ where: { user_id: req.user?.id, activo: true, ...(req.planCollaboratorOnly ? { estado_flujo: { [Op.in]: ACTIONABLE_ACTIVITY_STATES } } : {}) }, attributes: ['plan_id'], raw: true })
      ]);
      where.id = { [Op.in]: Array.from(new Set([...assignments, ...tasks].map((item) => item.plan_id))) };
    }
    if (text(req.query.programa)) where.programa = { [Op.iLike]: `%${text(req.query.programa)}%` };
    if (VALID_STATES.has(req.query.estado)) where.estado = req.query.estado;
    const rows = await PlanMejoramiento.findAll({ where, order: [['updatedAt', 'DESC'], ['id', 'DESC']] });
    return res.json({ success: true, data: await Promise.all(rows.map((row) => serializeForRequest(row, req))) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar los planes de mejoramiento' });
  }
};

const get = async (req, res) => {
  const plan = await PlanMejoramiento.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
  if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
  return res.json({ success: true, data: await serializeForRequest(plan, req) });
};

const uploadEvidence = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    if (req.planExecutionOnly) {
      const assignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: plan.id, user_id: req.user?.id, activo: true } });
      const task = await PlanMejoramientoActividadAsignacion.findOne({ where: { plan_id: plan.id, user_id: req.user?.id, activo: true } });
      if (assignment && !['asignado', 'en_ejecucion', 'devuelto'].includes(assignment.estado_flujo)) return res.status(409).json({ success: false, message: 'El plan está bloqueado mientras se encuentra en revisión o en firme' });
      if (!assignment && (!task || !['asignada', 'en_ejecucion', 'devuelta'].includes(task.estado_flujo))) return res.status(409).json({ success: false, message: 'La actividad está bloqueada hasta que el líder la devuelva o habilite' });
    }
    if (!req.file?.buffer) return res.status(400).json({ success: false, message: 'Seleccione un archivo de evidencia' });
    const extension = path.extname(req.file.originalname || '').toLowerCase().slice(0, 12);
    const storedName = `${Date.now()}_${crypto.randomUUID()}${extension}`;
    const relativeDirectory = path.join('plan-mejoramiento', String(plan.id));
    const absoluteDirectory = path.join(__dirname, '../../uploads', relativeDirectory);
    await fs.promises.mkdir(absoluteDirectory, { recursive: true });
    await fs.promises.writeFile(path.join(absoluteDirectory, storedName), req.file.buffer);
    return res.status(201).json({
      success: true,
      data: {
        nombre: text(req.file.originalname),
        nombreAlmacenado: storedName,
        url: `/api/uploads/${relativeDirectory.replace(/\\/g, '/')}/${storedName}`,
        tipo: req.file.mimetype,
        tamano: req.file.size,
        cargadoAt: new Date().toISOString(),
        cargadoPor: req.user?.nombre || req.user?.email || `Usuario ${req.user?.id}`,
        cargadoPorId: req.user?.id
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible cargar la evidencia' });
  }
};

const canManageActivityEvidence = async (req, planId, activityUid) => {
  if (!req.planExecutionOnly || !req.planCollaboratorOnly) return true;
  return Boolean(await PlanMejoramientoActividadAsignacion.count({
    where: {
      plan_id: planId,
      actividad_uid: text(activityUid),
      user_id: req.user?.id,
      activo: true,
      estado_flujo: { [Op.in]: ACTIONABLE_ACTIVITY_STATES }
    }
  }));
};

const syncDriveRepository = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    const synchronized = await planMejoramientoDriveService.ensurePlanRepository(plan);
    await plan.update({ contenido: synchronized.content, actualizado_por: req.user?.id });
    return res.json({
      success: true,
      message: 'Repositorio de evidencias sincronizado con Google Drive',
      data: { repository: synchronized.repository, activities: synchronized.activities }
    });
  } catch (error) {
    console.error('[plan-mejoramiento-drive] Error sincronizando repositorio:', error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'No fue posible sincronizar el repositorio de evidencias' });
  }
};

const uploadActivityEvidence = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    const activityUid = text(req.params.uid);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    if (!(await canManageActivityEvidence(req, plan.id, activityUid))) {
      return res.status(403).json({ success: false, message: 'Esta actividad no está asignada a tu usuario' });
    }
    if (!req.file?.buffer) return res.status(400).json({ success: false, message: 'Seleccione un archivo de evidencia' });

    const uploaded = await planMejoramientoDriveService.uploadActivityEvidence(plan, activityUid, req.file);
    await plan.update({ contenido: uploaded.content, actualizado_por: req.user?.id });
    // Sincronizar evidencia con Plan de Acción si la actividad está vinculada
    try {
      let linkedItemId = null;
      for (const obj of array(uploaded.content?.objetivos)) {
        const a = array(obj.actividades).find((x) => String(x.uid) === String(activityUid));
        if (a?.linkedActionItemId) {
          linkedItemId = a.linkedActionItemId;
          break;
        }
      }
      if (linkedItemId) {
        const actionItem = await StrategicActionItem.findByPk(linkedItemId, {
          include: [{ model: StrategicActionPlan, as: 'actionPlan' }]
        });
        if (actionItem?.actionPlan?.term_id) {
          const cutMonth = new Date().getMonth() + 1;
          const targetPos = cutMonth <= 7 ? 1 : 2;
          const period = (await StrategicMonitoringPeriod.findOne({
            where: { term_id: actionItem.actionPlan.term_id, position: targetPos }
          })) || (await StrategicMonitoringPeriod.findOne({ where: { term_id: actionItem.actionPlan.term_id } }));

          if (period) {
            await StrategicEvidence.create({
              action_item_id: actionItem.id,
              monitoring_period_id: period.id,
              original_name: req.file.originalname,
              stored_name: req.file.originalname,
              storage_key: `pm-evidence-${plan.id}-${activityUid}-${Date.now()}`,
              mime_type: req.file.mimetype || 'application/octet-stream',
              size_bytes: req.file.size || 0,
              sha256: crypto.createHash('sha256').update(req.file.buffer).digest('hex'),
              drive_file_id: uploaded.evidence?.driveFileId || null,
              sync_status: 'synced',
              uploaded_by: req.user.id
            });
          }
        }
      }
    } catch (syncEvErr) {
      console.warn('[Sync StrategicEvidence error]:', syncEvErr.message);
    }
    return res.status(201).json({
      success: true,
      data: {
        ...uploaded.evidence,
        cargadoPor: req.user?.nombre || req.user?.email || `Usuario ${req.user?.id}`,
        cargadoPorId: req.user?.id
      }
    });
  } catch (error) {
    console.error('[plan-mejoramiento-drive] Error cargando evidencia:', error.message);
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'No fue posible cargar la evidencia en Google Drive' });
  }
};

const create = async (req, res) => {
  try {
    if (req.planExecutionOnly) return res.status(403).json({ success: false, message: 'El ejecutor no puede crear planes de mejoramiento' });
    const payload = normalizePayload(req.body);
    const plan = await PlanMejoramiento.create({ ...payload, creado_por: req.user?.id, actualizado_por: req.user?.id });
    return res.status(201).json({ success: true, data: serialize(plan) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'No fue posible crear el plan' });
  }
};

const update = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    const payload = normalizePayload(req.body);
    if (req.planExecutionOnly) {
      const assignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: plan.id, user_id: req.user?.id, activo: true } });
      const delegated = await PlanMejoramientoActividadAsignacion.findAll({ where: { plan_id: plan.id, user_id: req.user?.id, activo: true }, attributes: ['actividad_uid', 'estado_flujo'], raw: true });
      if (assignment && !['asignado', 'en_ejecucion', 'devuelto'].includes(assignment.estado_flujo)) return res.status(409).json({ success: false, message: 'El plan está bloqueado mientras se encuentra en revisión o en firme' });
      if (!assignment && !delegated.some((item) => ['asignada', 'en_ejecucion', 'devuelta'].includes(item.estado_flujo))) return res.status(409).json({ success: false, message: 'Las actividades están bloqueadas hasta que el líder las devuelva o habilite' });
      payload.programa = plan.programa;
      payload.periodo_inicio = plan.periodo_inicio;
      payload.periodo_fin = plan.periodo_fin;
      payload.estado = plan.estado;
      payload.contenido = assignment
        ? mergeLeaderExecutionContent(plan.contenido || {}, payload.contenido || {})
        : mergeExecutionContent(plan.contenido || {}, payload.contenido || {}, new Set(delegated.filter((item) => ['asignada', 'en_ejecucion', 'devuelta'].includes(item.estado_flujo)).map((item) => String(item.actividad_uid))));
    }
    await plan.update({ ...payload, actualizado_por: req.user?.id });
    syncLinkedActionPlansTracking(plan, req).catch((err) => console.warn('[syncLinkedActionPlansTracking error]:', err.message));
    return res.json({ success: true, data: await serializeForRequest(plan, req) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'No fue posible actualizar el plan' });
  }
};


// ============================================================================
// INTEROPERABILIDAD BIDIRECCIONAL: PLAN DE MEJORAMIENTO <-> PLAN DE ACCIÓN
// ============================================================================

const syncLinkedActionPlansTracking = async (plan, req) => {
  try {
    const objetivos = array(plan.contenido?.objetivos);
    for (const obj of objetivos) {
      for (const act of array(obj.actividades)) {
        if (!act.linkedActionItemId) continue;

        const actionItem = await StrategicActionItem.findByPk(act.linkedActionItemId, {
          include: [{
            model: StrategicActionPlan,
            as: 'actionPlan',
            include: [{ model: StrategicTerm, as: 'term' }]
          }]
        });
        if (!actionItem || !actionItem.actionPlan?.term_id) continue;

        const rawProgress = Number(act.metaAlcanzada ?? 0);
        const progressClamped = Math.min(100, Math.max(0, Math.round(Number.isFinite(rawProgress) ? rawProgress : 0)));

        let cutMonth = 1;
        if (act.fechaSeguimiento) {
          const parts = String(act.fechaSeguimiento).split('-');
          if (parts.length >= 2) cutMonth = parseInt(parts[1], 10) || 1;
        } else {
          cutMonth = new Date().getMonth() + 1;
        }
        const isS1 = cutMonth <= 7;
        const targetPosition = isS1 ? 1 : 2;

        const periods = await StrategicMonitoringPeriod.findAll({
          where: { term_id: actionItem.actionPlan.term_id },
          order: [['position', 'ASC'], ['starts_on', 'ASC']]
        });
        const targetPeriod = periods.find((p) => p.position === targetPosition) || periods[isS1 ? 0 : Math.min(1, periods.length - 1)];

        if (targetPeriod) {
          const [result] = await StrategicMonitoringResult.findOrCreate({
            where: { action_item_id: actionItem.id, monitoring_period_id: targetPeriod.id },
            defaults: {
              action_item_id: actionItem.id,
              monitoring_period_id: targetPeriod.id,
              created_by: req?.user?.id || 1
            }
          });

          await result.update({
            physical_progress: progressClamped,
            observations: act.observaciones || 'Seguimiento registrado desde Plan de Mejoramiento',
            status: 'submitted',
            updated_by: req?.user?.id || 1
          });

          const custom = { ...(actionItem.custom_values || {}) };
          if (isS1) {
            custom.progress_s1 = progressClamped;
            custom.observations_s1 = act.observaciones || '';
          } else {
            custom.progress_s2 = progressClamped;
            custom.observations_s2 = act.observaciones || '';
          }

          const allResults = await StrategicMonitoringResult.findAll({
            where: { action_item_id: actionItem.id, deleted_at: null }
          });
          const avg = allResults.length
            ? allResults.reduce((s, r) => s + Number(r.physical_progress || 0), 0) / allResults.length
            : progressClamped;

          await actionItem.update({
            custom_values: custom,
            current_progress: avg,
            updated_by: req?.user?.id || 1
          });

          syncSinglePlanOfficialWorkbook(actionItem.action_plan_id).catch((err) =>
            console.warn('[Auto-sync official workbook error]:', err.message)
          );
        }
      }
    }
  } catch (err) {
    console.error('[syncLinkedActionPlansTracking error]:', err.message);
  }
};

const getActionPlanCandidates = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });

    const activityUid = text(req.params.uid);
    let targetActivity = null;
    for (const obj of array(plan.contenido?.objetivos)) {
      const found = array(obj.actividades).find((a) => String(a.uid) === activityUid);
      if (found) { targetActivity = found; break; }
    }
    if (!targetActivity) return res.status(404).json({ success: false, message: 'Actividad no encontrada' });

    let year = Number(plan.periodo_inicio) || new Date().getFullYear();
    if (targetActivity.fechaInicio) {
      const match = String(targetActivity.fechaInicio).match(/(\d{4})/);
      if (match) year = parseInt(match[1], 10);
    }

    const { Op } = require('sequelize');

    // 1. Obtener los IDs de términos para ese año
    const terms = await StrategicTerm.findAll({
      where: { year },
      attributes: ['id', 'year']
    });
    const termIds = terms.map((t) => t.id);

    // 2. Construir condiciones de búsqueda amplias para no descartar planes del mismo responsable ni de la vigencia
    const orConditions = [
      ...(termIds.length ? [{ term_id: { [Op.in]: termIds } }] : []),
      { code: { [Op.like]: `%${year}%` } }
    ];

    if (targetActivity.responsableId) {
      orConditions.push({ responsible_user_id: targetActivity.responsableId });
    }
    if (plan.asignacion?.usuario_id) {
      orConditions.push({ responsible_user_id: plan.asignacion.usuario_id });
    }
    if (req.user?.id) {
      orConditions.push({ responsible_user_id: req.user.id });
    }

    const actionPlans = await StrategicActionPlan.findAll({
      where: {
        [Op.or]: orConditions,
        deleted_at: null
      },
      include: [
        { model: StrategicTerm, as: 'term', attributes: ['id', 'year', 'strategic_plan_id'], required: false },
        { model: StrategicCatalogItem, as: 'organizationalUnit', required: false },
        { model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'dependencia', 'cargo', 'username'], required: false },
        {
          model: StrategicResponsibility,
          as: 'currentResponsibility',
          required: false,
          include: [{ model: User, as: 'responsibleUser', attributes: ['id', 'nombre', 'email', 'cargo', 'dependencia', 'username'], required: false }]
        }
      ],
      order: [['code', 'ASC']]
    });

    const normalize = (str) =>
      String(str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, ' ')
        .trim();

    const progNorm = normalize(plan.programa);
    const actRespNorm = normalize(targetActivity.responsableNombre);
    const planRespNorm = normalize(plan.asignacion?.usuario_nombre);
    const userSessionNorm = normalize(req.user?.nombre);
    const actDoc = String(targetActivity.responsableDocumento || targetActivity.responsableUsername || '').trim();
    const planDoc = String(plan.asignacion?.usuario_documento || plan.asignacion?.usuario_username || '').trim();
    const userSessionDoc = String(req.user?.username || req.user?.documento || '').trim();

    const mappedPlans = await Promise.all(actionPlans.map(async (p) => {
      const unitName = p.organizationalUnit?.name || p.title || '';
      const unitNorm = normalize(unitName);
      const leader = p.responsibleUser || p.currentResponsibility?.responsibleUser;
      const leaderName = leader?.nombre || 'Director / Líder asignado';
      const leaderNorm = normalize(leaderName);
      const leaderDoc = String(leader?.username || '').trim();
      const leaderId = p.responsible_user_id || p.currentResponsibility?.responsible_user_id || leader?.id;

      // Coincidencia por Responsable (Mismo responsable)
      const sameResponsible = Boolean(
        (targetActivity.responsableId && leaderId && String(targetActivity.responsableId) === String(leaderId)) ||
        (plan.asignacion?.usuario_id && leaderId && String(plan.asignacion.usuario_id) === String(leaderId)) ||
        (req.user?.id && leaderId && String(req.user.id) === String(leaderId)) ||
        (actDoc && leaderDoc && actDoc === leaderDoc) ||
        (planDoc && leaderDoc && planDoc === leaderDoc) ||
        (userSessionDoc && leaderDoc && userSessionDoc === leaderDoc) ||
        (actRespNorm && leaderNorm && (actRespNorm.includes(leaderNorm) || leaderNorm.includes(actRespNorm))) ||
        (planRespNorm && leaderNorm && (planRespNorm.includes(leaderNorm) || leaderNorm.includes(planRespNorm))) ||
        (userSessionNorm && leaderNorm && (userSessionNorm.includes(leaderNorm) || leaderNorm.includes(userSessionNorm)))
      );

      // Coincidencia por Programa o Dependencia
      const matchesProgram = Boolean(
        progNorm && (unitNorm.includes(progNorm) || progNorm.includes(unitNorm))
      );

      const isRecommended = sameResponsible || matchesProgram;
      let recommendationReason = '';
      if (sameResponsible) {
        recommendationReason = `Mismo responsable: ${leaderName}`;
      } else if (matchesProgram) {
        recommendationReason = `Programa coincidente: ${plan.programa}`;
      }

      let schema = p.metadata?.form_schema || null;
      if (!schema && p.term?.strategic_plan_id) {
        try {
          const { captureActionPlanSchema } = require('../services/strategicActionPlanSchemaService');
          schema = await captureActionPlanSchema(p.term.strategic_plan_id);
        } catch (_) {}
      }

      return {
        id: p.id,
        code: p.code,
        title: p.title,
        name: p.title || p.code,
        unit_name: unitName,
        leader_name: leaderName,
        responsible_name: leaderName,
        leader_email: leader?.email || '',
        leader_cargo: leader?.cargo || '',
        year: p.term?.year || year,
        is_recommended: Boolean(isRecommended),
        recommendation_reason: recommendationReason,
        same_responsible: sameResponsible,
        form_schema: schema
      };
    }));

    // Ordenar: primero los del mismo responsable, luego los del programa coincidente, luego por código
    mappedPlans.sort((a, b) => {
      if (a.same_responsible && !b.same_responsible) return -1;
      if (!a.same_responsible && b.same_responsible) return 1;
      if (a.is_recommended && !b.is_recommended) return -1;
      if (!a.is_recommended && b.is_recommended) return 1;
      return (a.code || '').localeCompare(b.code || '');
    });

    return res.json({
      success: true,
      data: {
        year,
        activity: {
          uid: targetActivity.uid,
          nombre: targetActivity.nombre,
          indicador: targetActivity.indicador,
          meta: targetActivity.meta,
          fechaInicio: targetActivity.fechaInicio,
          fechaFin: targetActivity.fechaFin,
          linkedActionPlanId: targetActivity.linkedActionPlanId || null,
          linkedActionItemId: targetActivity.linkedActionItemId || null
        },
        program: plan.programa,
        plans: mappedPlans
      }
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Error consultando planes candidatos' });
  }
};

const linkActivityToActionPlan = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });

    const activityUid = text(req.params.uid);
    let targetActivity = null;

    const content = JSON.parse(JSON.stringify(plan.contenido || {}));
    for (const obj of array(content.objetivos)) {
      const found = array(obj.actividades).find((a) => String(a.uid) === activityUid);
      if (found) {
        targetActivity = found;
        break;
      }
    }
    if (!targetActivity) return res.status(404).json({ success: false, message: 'Actividad no encontrada en el plan' });

    const actionPlanId = req.body.action_plan_id;
    if (!actionPlanId) return res.status(400).json({ success: false, message: 'Seleccione el Plan de Acción destino' });

    const actionPlan = await StrategicActionPlan.findByPk(actionPlanId, {
      include: [
        { model: StrategicTerm, as: 'term', required: false },
        { model: StrategicCatalogItem, as: 'organizationalUnit', required: false },
        { model: User, as: 'responsibleUser', required: false },
        {
          model: StrategicResponsibility,
          as: 'currentResponsibility',
          required: false,
          include: [{ model: User, as: 'responsibleUser', required: false }]
        }
      ]
    });
    if (!actionPlan) return res.status(404).json({ success: false, message: 'Plan de Acción no encontrado' });

    const existingItems = await StrategicActionItem.findAll({
      where: { action_plan_id: actionPlan.id, deleted_at: null },
      attributes: ['code']
    });
    const existingCodes = new Set(existingItems.map((it) => it.code));
    let maxNum = 0;
    for (const code of existingCodes) {
      const match = String(code).match(/^ACT-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    let nextNum = Math.max(maxNum + 1, existingItems.length + 1);
    let candidateCode = `ACT-${String(nextNum).padStart(3, '0')}`;
    while (existingCodes.has(candidateCode)) {
      nextNum += 1;
      candidateCode = `ACT-${String(nextNum).padStart(3, '0')}`;
    }

    const leaderName =
      actionPlan.responsibleUser?.nombre ||
      actionPlan.currentResponsibility?.responsibleUser?.nombre ||
      actionPlan.organizationalUnit?.name ||
      'Director del Programa';

    const formValues = req.body.form_values || req.body.activity_data || {};
    const activityName = text(formValues.actividad || formValues.nombre || targetActivity.nombre);
    const indicatorName = text(formValues.indicador || targetActivity.indicador);
    const indicatorType = text(formValues.tipoIndicador || formValues.tipo_indicador || 'Resultado');
    const targetVal = String(formValues.meta || targetActivity.meta || '1');
    const startDate = formValues.fechaInicio || formValues.fecha_inicio || targetActivity.fechaInicio || `${actionPlan.term?.year || 2026}-01-01`;
    const endDate = formValues.fechaFin || formValues.fecha_fin || targetActivity.fechaFin || `${actionPlan.term?.year || 2026}-12-31`;
    const strategicObjective = text(formValues.objetivoEstrategico || targetActivity.objetivoEstrategico);
    const strategicGuideline = text(formValues.lineamientoEstrategico || targetActivity.proyectoPdi);
    const macroactivity = text(formValues.macroactividad);
    const deliverable = text(formValues.entregable || targetActivity.descripcion);
    const coResponsible = text(formValues.corresponsable);

    // Normalizar objetivo estratégico contra las opciones oficiales del PED
    let finalStrategicObjective = strategicObjective;
    if (finalStrategicObjective) {
      if (/^OE1/i.test(finalStrategicObjective)) {
        finalStrategicObjective = 'OE1 Diseñar e implementar estrategias integrales e innovadoras, para arraigar la identidad Universidad CESMAG.';
      } else if (/^OE2/i.test(finalStrategicObjective)) {
        finalStrategicObjective = 'OE2 Articular las labores institucionales (formativas, académicas, docentes, científicas, culturales, extensión, financieras y administrativas) desde una óptica transformadora de la persona para impactar la sociedad desde el reconocimiento de las culturas y las comunidades.';
      } else if (/^OE3/i.test(finalStrategicObjective)) {
        finalStrategicObjective = 'OE3 Desarrollar una arquitectura institucional bajo los principios de ética y buen gobierno';
      }
    }

    let actionItem;
    if (targetActivity.linkedActionItemId) {
      actionItem = await StrategicActionItem.findByPk(targetActivity.linkedActionItemId);
    }

    const customValuesPayload = {
      ...(actionItem?.custom_values || {}),
      activity: activityName,
      indicator: indicatorName,
      indicador: indicatorName,
      indicator_type: indicatorType,
      tipo_indicador: indicatorType,
      target: targetVal,
      meta: targetVal,
      starts_on: startDate,
      fecha_inicio: startDate,
      ends_on: endDate,
      fecha_fin: endDate,
      strategic_objective: finalStrategicObjective,
      objetivo_estrategico: finalStrategicObjective,
      strategic_guideline: strategicGuideline,
      lineamiento_estrategico: strategicGuideline,
      macroactivity: macroactivity,
      macroactividad: macroactivity,
      deliverable: deliverable,
      entregable: deliverable,
      co_responsible: coResponsible,
      corresponsable: coResponsible,
      co_responsibles: coResponsible ? [coResponsible] : [],
      responsible: leaderName,
      responsable: leaderName,
      responsable_de_ejecucion: leaderName,
      source_module: 'plan_mejoramiento',
      pm_plan_id: plan.id,
      pm_actividad_uid: targetActivity.uid,
      pm_programa: plan.programa,
      drive_subfolder: `Plan de Mejoramiento - ${plan.programa}`
    };

    if (actionItem && !actionItem.deleted_at) {
      await actionItem.update({
        activity: activityName,
        indicator: indicatorName,
        indicator_type: indicatorType,
        target: targetVal,
        starts_on: startDate,
        ends_on: endDate,
        custom_values: customValuesPayload,
        updated_by: req.user.id
      });
    } else {
      actionItem = await StrategicActionItem.create({
        action_plan_id: actionPlan.id,
        code: candidateCode,
        activity: activityName,
        indicator: indicatorName,
        indicator_type: indicatorType,
        target: targetVal,
        starts_on: startDate,
        ends_on: endDate,
        responsible_catalog_item_id: actionPlan.catalog_item_id || null,
        custom_values: customValuesPayload,
        version: 1,
        status: 'active',
        created_by: req.user.id
      });
    }

    let driveFolderUrl = '';
    try {
      const folderRes = await ensureActivityFoldersInDrive(actionItem.id);
      if (Array.isArray(folderRes) && folderRes[0]?.folderUrl) {
        driveFolderUrl = folderRes[0].folderUrl;
      }
    } catch (driveErr) {
      console.warn('[ensureActivityFoldersInDrive Warning]:', driveErr.message);
    }

    targetActivity.linkedActionPlanId = actionPlan.id;
    targetActivity.linkedActionPlanCode = actionPlan.code;
    targetActivity.linkedActionPlanTitle = actionPlan.title;
    targetActivity.linkedActionItemId = actionItem.id;
    targetActivity.linkedActionItemCode = actionItem.code;
    targetActivity.linkedAt = new Date().toISOString();
    if (driveFolderUrl) {
      targetActivity.evidenceFolderUrl = driveFolderUrl;
    }

    await plan.update({ contenido: content, actualizado_por: req.user.id });

    syncSinglePlanOfficialWorkbook(actionPlan.id).catch((err) =>
      console.warn('[Sync Official Workbook warning]:', err.message)
    );

    return res.json({
      success: true,
      message: `Actividad vinculada con éxito al Plan de Acción (${actionPlan.code})`,
      data: {
        activity: targetActivity,
        actionItem: {
          id: actionItem.id,
          code: actionItem.code,
          activity: actionItem.activity
        },
        actionPlan: {
          id: actionPlan.id,
          code: actionPlan.code,
          title: actionPlan.title,
          leader: leaderName
        },
        evidenceFolderUrl: driveFolderUrl
      }
    });
  } catch (error) {
    console.error('[linkActivityToActionPlan Error]:', error);
    return res.status(500).json({ success: false, message: error.message || 'Error al vincular actividad con Plan de Acción' });
  }
};

const repairLinkedActionItems = async () => {
  try {
    const { Op } = require('sequelize');
    const items = await StrategicActionItem.findAll({
      where: {
        custom_values: {
          [Op.ne]: null
        }
      }
    });

    for (const item of items) {
      const cv = item.custom_values || {};
      if (cv.source_module === 'plan_mejoramiento' && (!cv.strategic_objective || cv.strategic_objective === '-' || !cv.macroactividad || item.deleted_at)) {
        const pmPlan = await PlanMejoramiento.findByPk(cv.pm_plan_id);
        if (!pmPlan) continue;
        let targetAct = null;
        for (const obj of array(pmPlan.contenido?.objetivos)) {
          const found = array(obj.actividades).find((a) => String(a.uid) === String(cv.pm_actividad_uid));
          if (found) { targetAct = found; break; }
        }
        if (!targetAct) continue;

        let objStr = targetAct.objetivoEstrategico || '';
        if (/^OE1/i.test(objStr)) objStr = 'OE1 Diseñar e implementar estrategias integrales e innovadoras, para arraigar la identidad Universidad CESMAG.';
        else if (/^OE2/i.test(objStr)) objStr = 'OE2 Articular las labores institucionales (formativas, académicas, docentes, científicas, culturales, extensión, financieras y administrativas) desde una óptica transformadora de la persona para impactar la sociedad desde el reconocimiento de las culturas y las comunidades.';
        else if (/^OE3/i.test(objStr)) objStr = 'OE3 Desarrollar una arquitectura institucional bajo los principios de ética y buen gobierno';

        const macroVal = cv.macroactivity || cv.macroactividad || 'A-005 Actualización curricular de los espacios académicos existentes articulando competencias asociadas a la identidad institucional.';
        const lineamientoVal = cv.strategic_guideline || cv.lineamiento_estrategico || targetAct.proyectoPdi || 'LE-005 Evidenciar la trazabilidad de los resultados de aprendizaje en el macro, meso y micro currículo';

        const updatedCv = {
          ...cv,
          strategic_objective: objStr,
          objetivo_estrategico: objStr,
          strategic_guideline: lineamientoVal,
          lineamiento_estrategico: lineamientoVal,
          macroactivity: macroVal,
          macroactividad: macroVal,
          indicator_type: cv.indicator_type || 'Resultado'
        };
        await item.update({
          status: 'active',
          deleted_at: null,
          custom_values: updatedCv
        });
      }
    }
  } catch (err) {
    console.warn('[repairLinkedActionItems warning]:', err.message);
  }
};
setTimeout(() => repairLinkedActionItems(), 3000);

const unlinkActivityFromActionPlan = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });

    const activityUid = text(req.params.uid);
    let targetActivity = null;

    const content = JSON.parse(JSON.stringify(plan.contenido || {}));
    for (const obj of array(content.objetivos)) {
      const found = array(obj.actividades).find((a) => String(a.uid) === activityUid);
      if (found) { targetActivity = found; break; }
    }
    if (!targetActivity) return res.status(404).json({ success: false, message: 'Actividad no encontrada' });

    if (targetActivity.linkedActionItemId) {
      const actionItem = await StrategicActionItem.findByPk(targetActivity.linkedActionItemId);
      if (actionItem) {
        await actionItem.update({
          deleted_at: new Date(),
          status: 'deleted',
          updated_by: req.user.id
        });
        syncSinglePlanOfficialWorkbook(actionItem.action_plan_id).catch(() => {});
      }
    }

    targetActivity.linkedActionPlanId = null;
    targetActivity.linkedActionPlanCode = null;
    targetActivity.linkedActionPlanTitle = null;
    targetActivity.linkedActionItemId = null;
    targetActivity.linkedActionItemCode = null;
    targetActivity.linkedAt = null;

    await plan.update({ contenido: content, actualizado_por: req.user.id });

    return res.json({
      success: true,
      message: 'Actividad desvinculada del Plan de Acción',
      data: targetActivity
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Error al desvincular actividad' });
  }
};

const remove = async (req, res) => {
  if (req.planExecutionOnly) return res.status(403).json({ success: false, message: 'El ejecutor no puede eliminar planes' });
  const plan = await PlanMejoramiento.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
  await plan.destroy();
  return res.json({ success: true });
};

let catalogsPromise = null;
const cellText = (cell) => text(cell?.text || cell?.value?.result || cell?.value);
const columnValues = (sheet, column, start, end) => {
  const values = [];
  for (let row = start; row <= end; row += 1) {
    const value = cellText(sheet.getCell(`${column}${row}`));
    if (value) values.push(value);
  }
  return values;
};
const priceValues = (sheet, start, end, group) => {
  const values = [];
  for (let row = start; row <= end; row += 1) {
    const label = cellText(sheet.getCell(`A${row}`));
    const price = number(sheet.getCell(`B${row}`).value?.result ?? sheet.getCell(`B${row}`).value);
    if (label && price > 0) values.push({ label, value: price, group });
  }
  return values;
};

const normalizeKey = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

const catalogValues = (value) => {
  if (Array.isArray(value)) return value.flatMap(catalogValues);
  if (value && typeof value === 'object') return Object.values(value).flatMap(catalogValues);
  return text(value).split(/\r?\n|;|\|/).map(text).filter(Boolean);
};

const readInstitutionalPolicies = async () => {
  try {
    const documents = await Documento.findAll({
      attributes: ['titulo', 'estado', 'datos_originales'],
      where: { estado: 'vigente' },
      order: [['titulo', 'ASC']]
    });
    const policies = new Map();
    documents.forEach((document) => {
      if (normalizeKey(document.estado) !== 'vigente') return;
      let source = document.datos_originales && typeof document.datos_originales === 'object' ? document.datos_originales : {};
      if (!Object.keys(source).length && typeof document.datos_originales === 'string') {
        try { source = JSON.parse(document.datos_originales); } catch (_) { source = {}; }
      }
      const sheet = normalizeKey(source.hoja);
      const policyFields = Object.entries(source).filter(([key]) => {
        const normalized = normalizeKey(key);
        return normalized === 'politica' || normalized === 'politica_institucional' || normalized === 'nombre_politica';
      });
      const isPolicyDocument = sheet === 'politicas' || policyFields.length > 0;
      if (!isPolicyDocument) return;

      const name = text(policyFields[0]?.[1] || document.titulo);
      if (!name) return;
      const actionLines = Object.entries(source)
        .filter(([key]) => {
          const normalized = normalizeKey(key);
          return normalized.includes('linea') && normalized.includes('accion');
        })
        .flatMap(([, value]) => catalogValues(value));
      const current = policies.get(name) || new Set();
      actionLines.forEach((line) => current.add(line));
      policies.set(name, current);
    });
    return Array.from(policies.entries()).map(([name, actionLines]) => ({
      name,
      actionLines: Array.from(actionLines).sort((a, b) => a.localeCompare(b, 'es'))
    }));
  } catch (_) {
    return [];
  }
};
const tariffCategories = new Set(['personal', 'activos', 'publicidad', 'papeleria', 'espacios', 'diversos']);
const parseTariffWorkbook = (workbook) => {
  const sheet = workbook.getWorksheet('TARIFAS') || workbook.worksheets[0];
  if (!sheet) throw Object.assign(new Error('El archivo no contiene una hoja de tarifas'), { status: 422 });
  const headers = {};
  sheet.getRow(1).eachCell((cell, column) => { headers[normalizeKey(cellText(cell))] = column; });
  const categoryColumn = headers.categoria;
  const subcategoryColumn = headers.subcategoria;
  const conceptColumn = headers.concepto;
  const valueColumn = headers.valor_unitario || headers.valor || headers.tarifa;
  if (!categoryColumn || !subcategoryColumn || !conceptColumn || !valueColumn) {
    throw Object.assign(new Error('La plantilla debe contener las columnas CATEGORIA, SUBCATEGORIA, CONCEPTO y VALOR_UNITARIO'), { status: 422 });
  }
  const catalog = { personal: [], activos: [], publicidad: [], papeleria: [], espacios: [], diversos: [] };
  for (let row = 2; row <= sheet.rowCount; row += 1) {
    const category = normalizeKey(cellText(sheet.getCell(row, categoryColumn)));
    const group = normalizeKey(cellText(sheet.getCell(row, subcategoryColumn)));
    const label = cellText(sheet.getCell(row, conceptColumn));
    const rawValue = sheet.getCell(row, valueColumn).value;
    const value = number(rawValue?.result ?? rawValue);
    if (!category && !group && !label && !value) continue;
    if (!tariffCategories.has(category)) throw Object.assign(new Error(`Categoría no válida en la fila ${row}: ${category || 'vacía'}`), { status: 422 });
    if (!group || !label || value <= 0) throw Object.assign(new Error(`Datos incompletos o tarifa inválida en la fila ${row}`), { status: 422 });
    catalog[category].push({ label, value, group });
  }
  const total = Object.values(catalog).reduce((sum, rows) => sum + rows.length, 0);
  if (!total) throw Object.assign(new Error('La plantilla no contiene tarifas para importar'), { status: 422 });
  return catalog;
};

const readCatalogs = async () => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(TEMPLATE_PATH);
  const lists = workbook.getWorksheet('Listas');
  const auxiliar = workbook.getWorksheet('Hoja2');
  const programsSheet = workbook.getWorksheet('PROGRAMAS Y DEPENDENCIAS');
  const rates = workbook.getWorksheet('2025');
  const factors = columnValues(lists, 'A', 4, 15);
  const factorCharacteristics = {};
  for (let column = 3; column <= 14; column += 1) {
    const factor = factors[column - 3];
    if (factor) factorCharacteristics[factor] = columnValues(lists, lists.getColumn(column).letter, 4, 16);
  }
  const characteristicAspects = {};
  for (let column = 15; column <= 62; column += 1) {
    const header = cellText(lists.getCell(3, column));
    if (!header) continue;
    const characteristic = Object.values(factorCharacteristics).flat().find((item) => item.startsWith(`${header}.`));
    if (characteristic) characteristicAspects[characteristic] = columnValues(lists, lists.getColumn(column).letter, 4, 16);
  }
  const strategicObjectives = columnValues(lists, 'BO', 4, 16);
  const objectiveProjects = {};
  ['BP', 'BQ', 'BR'].forEach((column, index) => {
    if (strategicObjectives[index]) objectiveProjects[strategicObjectives[index]] = columnValues(lists, column, 4, 16);
  });
  const programs = [];
  for (let row = 5; row <= programsSheet.rowCount; row += 1) {
    const name = cellText(programsSheet.getCell(`C${row}`));
    if (name) programs.push({ name, costCenter: cellText(programsSheet.getCell(`A${row}`)), subCostCenter: cellText(programsSheet.getCell(`B${row}`)) });
  }
  const baseBudgetCatalogs = {
    personal: [
      ...priceValues(rates, 148, 161, 'docente_tc'),
      ...priceValues(rates, 167, 170, 'docente_mt')
    ],
    publicidad: priceValues(rates, 233, 235, 'publicidad'),
    espacios: [
      ...priceValues(rates, 61, 86, 'auditorios'),
      ...priceValues(rates, 90, 91, 'aulas'),
      ...priceValues(rates, 92, 97, 'otros_institucionales'),
      ...priceValues(rates, 103, 116, 'deportivos')
    ]
  };
  let tariffVersion = null;
  try {
    tariffVersion = await PlanMejoramientoTarifaVersion.findOne({ where: { activo: true }, order: [['createdAt', 'DESC'], ['id', 'DESC']] });
  } catch (_) {
    tariffVersion = null;
  }
  return {
    source: { template: path.basename(TEMPLATE_PATH), tariffSheet: tariffVersion ? `Vigencia ${tariffVersion.vigencia}` : '2025', sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, hidden: sheet.state !== 'visible' })) },
    tariffVersion: tariffVersion ? {
      id: tariffVersion.id,
      nombre: tariffVersion.nombre,
      vigencia: tariffVersion.vigencia,
      archivoNombre: tariffVersion.archivo_nombre,
      createdAt: tariffVersion.createdAt
    } : { id: null, nombre: 'Tarifas base de la plantilla institucional', vigencia: 2025, archivoNombre: path.basename(TEMPLATE_PATH) },
    factors,
    factorCharacteristics,
    characteristicAspects,
    actionTypes: columnValues(lists, 'BL', 4, 16),
    processes: columnValues(lists, 'BM', 4, 16),
    strategicAxes: columnValues(auxiliar, 'A', 40, 48),
    strategicObjectives,
    objectiveProjects,
    programs,
    budgetCatalogs: tariffVersion?.catalogo || baseBudgetCatalogs
  };
};

const getCatalogs = async (req, res) => {
  try {
    if (!catalogsPromise) catalogsPromise = readCatalogs().catch((error) => { catalogsPromise = null; throw error; });
    const [catalogs, institutionalPolicies] = await Promise.all([catalogsPromise, readInstitutionalPolicies()]);
    return res.json({ success: true, data: { ...catalogs, institutionalPolicies } });
  } catch (error) {
    return res.status(500).json({ success: false, message: `No fue posible leer los catálogos de la plantilla: ${error.message}` });
  }
};

const downloadTariffTemplate = async (_req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('TARIFAS', { views: [{ state: 'frozen', ySplit: 1 }] });
    sheet.columns = [
      { header: 'CATEGORIA', key: 'categoria', width: 22 },
      { header: 'SUBCATEGORIA', key: 'subcategoria', width: 28 },
      { header: 'CONCEPTO', key: 'concepto', width: 58 },
      { header: 'VALOR_UNITARIO', key: 'valor', width: 22 }
    ];
    sheet.getRow(1).eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1D4ED8' } };
      cell.alignment = { horizontal: 'center' };
    });
    sheet.getColumn('valor').numFmt = '$#,##0.00';
    const instructions = workbook.addWorksheet('INSTRUCCIONES');
    instructions.getColumn('A').width = 110;
    instructions.addRows([
      ['Complete una fila por tarifa. No cambie los nombres de las cuatro columnas de la hoja TARIFAS.'],
      ['Categorías permitidas: personal, activos, publicidad, papeleria, espacios y diversos.'],
      ['Al importar, esta versión será la vigente para rubros nuevos. Los rubros históricos conservarán el valor con el que fueron creados.'],
      ['Ejemplo: personal | docente_tc | Docente tiempo completo | 1000000'],
      ['Ejemplo: espacios | auditorios | Auditorio principal | 150000']
    ]);
    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Plantilla_actualizacion_tarifas.xlsx"');
    return res.send(Buffer.from(buffer));
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible generar la plantilla de tarifas' });
  }
};

const importTariffs = async (req, res) => {
  try {
    if (!req.file?.buffer) return res.status(400).json({ success: false, message: 'Seleccione una plantilla Excel' });
    const vigencia = Number(req.body?.vigencia);
    if (!Number.isInteger(vigencia) || vigencia < 2000 || vigencia > 2200) {
      return res.status(400).json({ success: false, message: 'Ingrese una vigencia válida' });
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const catalog = parseTariffWorkbook(workbook);
    const total = Object.values(catalog).reduce((sum, rows) => sum + rows.length, 0);
    const transaction = await PlanMejoramientoTarifaVersion.sequelize.transaction();
    let version;
    try {
      await PlanMejoramientoTarifaVersion.update({ activo: false }, { where: { activo: true }, transaction });
      version = await PlanMejoramientoTarifaVersion.create({
        nombre: `Tarifas ${vigencia}`,
        vigencia,
        archivo_nombre: text(req.file.originalname).slice(0, 255),
        catalogo: catalog,
        activo: true,
        creado_por: req.user?.id
      }, { transaction });
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    catalogsPromise = null;
    return res.status(201).json({ success: true, data: { id: version.id, nombre: version.nombre, vigencia, total }, message: `${total} tarifas actualizadas para la vigencia ${vigencia}` });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'No fue posible importar las tarifas' });
  }
};

const activityRows = (contenido = {}) => array(contenido.objetivos).flatMap((objective, objectiveIndex) => {
  const activities = array(objective.actividades);
  const normalized = activities.length ? activities : [{}];
  const currentObjectiveProgress = normalized.reduce((sum, activity) => {
    const goal = number(activity.meta);
    return sum + (goal > 0 ? Math.min(1, Math.max(0, number(activity.metaAlcanzada) / goal)) : 0);
  }, 0) / normalized.length;
  const selectedAspects = opportunitiesFromObjective(objective);
  return normalized.map((activity) => ({
    code: text(objective.codigo) || `OPM_${String(objectiveIndex + 1).padStart(2, '0')}`,
    factor: text(objective.factor),
    characteristic: text(objective.caracteristica),
    aspect: selectedAspects.length ? selectedAspects.map((item) => text(item.aspecto)).filter(Boolean).join('\n') : text(objective.aspecto),
    score: selectedAspects.length ? selectedAspects.map((item) => item.calificacion).filter((value) => value !== '' && value !== null && value !== undefined).join(' / ') : number(objective.calificacion),
    actionType: text(objective.tipoAccion),
    objective: text(objective.objetivo),
    activityCount: normalized.length,
    activityWeight: 1 / normalized.length,
    objectiveProgress: currentObjectiveProgress,
    ...activity
  }));
});

const budgetFor = (contenido, code) => array(contenido.presupuesto)
  .filter((item) => text(item.codigoObjetivo) === code)
  .reduce((sum, item) => sum + budgetItemTotal(item), 0);

const setCell = (sheet, address, value) => {
  const cell = sheet.getCell(address);
  cell.value = value === undefined || value === null ? '' : value;
};

const planBudgetFormula = (row) => (
  `SUMIF(PERSONAL!H:H,PM!B${row},PERSONAL!G:G)`
  + `+SUMIF('ADQUISICIÓN DE ACTIVOS'!H:H,PM!B${row},'ADQUISICIÓN DE ACTIVOS'!G:G)`
  + `+SUMIF(PUBLICIDAD!H:H,PM!B${row},PUBLICIDAD!G:G)`
  + `+SUMIF('ÚTILES Y PAPELERÍA'!H:H,PM!B${row},'ÚTILES Y PAPELERÍA'!G:G)`
  + `+SUMIF('ESPACIOS FÍSICOS y EQUIP'!I:I,PM!B${row},'ESPACIOS FÍSICOS y EQUIP'!H:H)`
  + `+SUMIF(DIVERSOS!H:H,PM!B${row},DIVERSOS!G:G)`
);

const fillPlanSheet = (sheet, plan, contenido, rows) => {
  if (!sheet) throw Object.assign(new Error('La plantilla institucional no contiene la hoja PM'), { status: 500 });
  setCell(sheet, 'E5', `${plan.periodo_inicio} - ${plan.periodo_fin}`);
  setCell(sheet, 'E7', plan.programa);
  setCell(sheet, 'V10', 'LINEAMIENTO ESTRATÉGICO');

  const editableColumns = ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'Q', 'R', 'S', 'T', 'U', 'V'];
  for (let row = 11; row <= 140; row += 1) {
    editableColumns.forEach((column) => setCell(sheet, `${column}${row}`, ''));
    setCell(sheet, `P${row}`, { formula: planBudgetFormula(row), result: 0 });
  }

  rows.forEach((item, index) => {
    const row = 11 + index;
    const values = {
      B: item.code,
      C: item.factor,
      D: item.characteristic,
      E: item.aspect,
      F: item.score || '',
      G: item.actionType,
      H: item.objective,
      I: text(item.nombre),
      J: text(item.descripcion),
      K: text(item.indicador),
      L: number(item.meta) || '',
      M: item.fechaInicio ? new Date(item.fechaInicio) : '',
      N: item.fechaFin ? new Date(item.fechaFin) : '',
      O: text(item.recursos),
      Q: text(item.procesoResponsable),
      R: text(item.cargoResponsable),
      S: text(item.alcance),
      T: text(item.ejeEstrategico),
      U: text(item.objetivoEstrategico),
      V: text(item.proyectoPdi)
    };
    Object.entries(values).forEach(([column, value]) => setCell(sheet, `${column}${row}`, value));
    setCell(sheet, `P${row}`, {
      formula: planBudgetFormula(row),
      result: budgetFor(contenido, item.code)
    });
    sheet.getCell(`M${row}`).numFmt = 'dd/mm/yyyy';
    sheet.getCell(`N${row}`).numFmt = 'dd/mm/yyyy';
    sheet.getCell(`P${row}`).numFmt = '$#,##0.00';
    sheet.getRow(row).height = 60;
  });
};

const addPolicyAlignmentSheet = (workbook, rows) => {
  const selectedRows = rows.filter((row) => array(row.politicasInstitucionales).length || array(row.lineasAccionPolitica).length);
  const previous = workbook.getWorksheet('POLÍTICAS Y LÍNEAS');
  if (previous) workbook.removeWorksheet(previous.id);
  if (!selectedRows.length) return;

  const sheet = workbook.addWorksheet('POLÍTICAS Y LÍNEAS', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'CÓDIGO OBJETIVO', key: 'code', width: 21 },
    { header: 'ACTIVIDAD', key: 'activity', width: 44 },
    { header: 'OBJETIVO ESTRATÉGICO', key: 'strategicObjective', width: 48 },
    { header: 'LINEAMIENTO ESTRATÉGICO', key: 'strategicGuideline', width: 48 },
    { header: 'POLÍTICAS INSTITUCIONALES', key: 'policies', width: 58 },
    { header: 'LÍNEAS DE ACCIÓN', key: 'actionLines', width: 68 }
  ];
  selectedRows.forEach((row) => sheet.addRow({
    code: row.code,
    activity: text(row.nombre),
    strategicObjective: text(row.objetivoEstrategico),
    strategicGuideline: text(row.proyectoPdi),
    policies: array(row.politicasInstitucionales).map(text).filter(Boolean).join('\n'),
    actionLines: array(row.lineasAccionPolitica).map(text).filter(Boolean).join('\n')
  }));
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (index > 1) row.height = 48;
  });
  sheet.autoFilter = `A1:F${Math.max(2, sheet.rowCount)}`;
};

const fillBudgetSheets = (workbook, contenido) => {
  const range = (start, end) => Array.from({ length: end - start + 1 }, (_, index) => start + index);
  const layouts = {
    personal: { sheet: 'PERSONAL', rows: [...range(17, 41), ...range(46, 58), ...range(64, 80), ...range(90, 104)], rowsBySubcategory: { docente_tc: range(17, 41), docente_mt: range(46, 58), otro_personal: range(64, 80), honorarios: range(90, 104) }, concept: 'C', description: 'D', quantity: 'E', unit: 'F', total: 'G', code: 'H' },
    activos: { sheet: 'ADQUISICIÓN DE ACTIVOS', rows: range(21, 44), concept: 'C', description: 'D', quantity: 'E', unit: 'F', total: 'G', code: 'H' },
    publicidad: { sheet: 'PUBLICIDAD', rows: range(17, 52), concept: 'C', description: 'D', quantity: 'E', unit: 'F', total: 'G', code: 'H' },
    papeleria: { sheet: 'ÚTILES Y PAPELERÍA', rows: range(19, 47), concept: 'C', description: 'D', quantity: 'E', unit: 'F', total: 'G', code: 'H' },
    espacios: { sheet: 'ESPACIOS FÍSICOS y EQUIP', rows: [...range(18, 21), ...range(25, 27), ...range(31, 34), ...range(38, 41), ...range(45, 49), ...range(55, 59)], rowsBySubcategory: { auditorios: range(18, 21), aulas: range(25, 27), otros_institucionales: range(31, 34), deportivos: range(38, 41), equipos: range(45, 49), otros: range(55, 59) }, concept: 'C', description: 'D', quantity: 'E', discount: 'F', unit: 'G', total: 'H', code: 'I' },
    diversos: { sheet: 'DIVERSOS', rows: range(15, 32), concept: 'C', description: 'D', quantity: 'E', unit: 'F', total: 'G', code: 'H' }
  };

  Object.values(layouts).forEach((layout) => {
    const sheet = workbook.getWorksheet(layout.sheet);
    if (!sheet) return;
    layout.rows.forEach((row) => {
      [layout.concept, layout.description, layout.quantity, layout.discount, layout.unit, layout.total, layout.code]
        .filter(Boolean)
        .forEach((column) => setCell(sheet, `${column}${row}`, ''));
    });
  });

  const nextIndex = {};
  array(contenido.presupuesto).forEach((item) => {
    const layout = layouts[item.categoria];
    const sheet = layout ? workbook.getWorksheet(layout.sheet) : null;
    if (!sheet) return;
    const subcategory = text(item.subcategoria);
    const indexKey = `${item.categoria}:${subcategory}`;
    const availableRows = layout.rowsBySubcategory?.[subcategory] || layout.rows;
    const index = nextIndex[indexKey] || 0;
    const row = availableRows[index];
    if (!row) return;
    nextIndex[indexKey] = index + 1;
    const discount = item.categoria === 'espacios' ? spaceDiscount(item.cantidad) : 0;
    const effectiveUnit = number(item.valorUnitario) * (1 - discount);
    setCell(sheet, `${layout.concept}${row}`, text(item.concepto));
    setCell(sheet, `${layout.description}${row}`, text(item.descripcion));
    setCell(sheet, `${layout.quantity}${row}`, number(item.cantidad));
    if (layout.discount) setCell(sheet, `${layout.discount}${row}`, discount);
    setCell(sheet, `${layout.unit}${row}`, item.categoria === 'espacios' ? effectiveUnit : number(item.valorUnitario));
    setCell(sheet, `${layout.total}${row}`, {
      formula: item.categoria === 'personal' && payrollSubcategories.has(subcategory)
        ? `(${layout.quantity}${row}*${layout.unit}${row})*1.51852`
        : `${layout.quantity}${row}*${layout.unit}${row}`,
      result: budgetItemTotal(item)
    });
    setCell(sheet, `${layout.code}${row}`, text(item.codigoObjetivo));
  });
};

const addFollowUpSheet = (workbook, rows) => {
  const previous = workbook.getWorksheet('SEGUIMIENTO');
  if (previous) workbook.removeWorksheet(previous.id);
  const sheet = workbook.addWorksheet('SEGUIMIENTO', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'CÓDIGO OBJETIVO', key: 'code', width: 20 },
    { header: 'OBJETIVO', key: 'objective', width: 48 },
    { header: 'ACTIVIDAD', key: 'activity', width: 42 },
    { header: 'INDICADOR', key: 'indicator', width: 32 },
    { header: 'META', key: 'goal', width: 14 },
    { header: 'META CUMPLIDA / AVANCE', key: 'achieved', width: 24 },
    { header: '% AVANCE', key: 'progress', width: 16 },
    { header: 'PONDERACIÓN ACTIVIDAD', key: 'weight', width: 22 },
    { header: 'APORTE AL OBJETIVO', key: 'contribution', width: 22 },
    { header: 'RESULTADO DEL OBJETIVO', key: 'objectiveProgress', width: 24 },
    { header: 'EVIDENCIA DE CUMPLIMIENTO', key: 'evidence', width: 48 },
    { header: 'OBSERVACIONES', key: 'observations', width: 48 },
    { header: 'FECHA DE SEGUIMIENTO', key: 'date', width: 22 },
    { header: 'VERIFICACIÓN', key: 'verification', width: 24 },
    { header: 'REGISTRADO POR', key: 'registeredBy', width: 32 },
    { header: 'FECHA DE REGISTRO', key: 'registeredAt', width: 24 }
  ];
  rows.forEach((row) => {
    const history = array(row.seguimientos);
    const records = history.length ? history : [{
      metaPlaneada: row.meta, valorAlcanzado: row.metaAlcanzada, evidenciaUrl: row.evidencia,
      observaciones: row.observaciones, fecha: row.fechaSeguimiento, verificacion: row.verificacionSeguimiento
    }];
    records.forEach((record) => {
      const goal = number(record.metaPlaneada ?? row.meta);
      const achieved = number(record.valorAlcanzado ?? row.metaAlcanzada);
      const progress = goal > 0 ? Math.min(1, Math.max(0, achieved / goal)) : 0;
      const weight = number(record.ponderacionActividad) > 0 ? number(record.ponderacionActividad) / 100 : number(row.activityWeight);
      sheet.addRow({
        code: row.code,
        objective: row.objective,
        activity: text(row.nombre),
        indicator: text(record.indicadorPlaneado || row.indicador),
        goal,
        achieved,
        progress,
        weight,
        contribution: number(record.aporteObjetivo) > 0 ? number(record.aporteObjetivo) / 100 : progress * weight,
        objectiveProgress: number(record.avanceObjetivo) > 0 ? number(record.avanceObjetivo) / 100 : number(row.objectiveProgress),
        evidence: text(record.evidenciaUrl || row.evidencia),
        observations: text(record.observaciones),
        date: text(record.fecha || row.fechaSeguimiento),
        verification: text(record.verificacion || row.verificacionSeguimiento),
        registeredBy: text(record.registradoPor),
        registeredAt: text(record.registradoAt)
      });
    });
  });
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  sheet.getColumn('progress').numFmt = '0.00%';
  sheet.getColumn('weight').numFmt = '0.00%';
  sheet.getColumn('contribution').numFmt = '0.00%';
  sheet.getColumn('objectiveProgress').numFmt = '0.00%';
  sheet.eachRow((row, index) => {
    row.alignment = { vertical: 'top', wrapText: true };
    if (index > 1) row.height = 42;
  });
  sheet.autoFilter = 'A1:P1';
};

const addBudgetSummarySheet = (workbook, contenido) => {
  const previous = workbook.getWorksheet('RESUMEN PRESUPUESTO');
  if (previous) workbook.removeWorksheet(previous.id);
  const sheet = workbook.addWorksheet('RESUMEN PRESUPUESTO', { views: [{ state: 'frozen', ySplit: 1 }] });
  const categoryKeys = ['personal', 'activos', 'publicidad', 'papeleria', 'espacios', 'diversos'];
  const categoryLabels = ['PERSONAL', 'ACTIVOS', 'PUBLICIDAD', 'ÚTILES Y PAPELERÍA', 'ESPACIOS Y EQUIPOS', 'DIVERSOS'];
  sheet.columns = [
    { header: 'CÓDIGO OBJETIVO', key: 'code', width: 22 },
    ...categoryLabels.map((label, index) => ({ header: label, key: categoryKeys[index], width: 21 })),
    { header: 'TOTAL OBJETIVO', key: 'total', width: 22 }
  ];
  array(contenido.objetivos).forEach((objective, index) => {
    const code = text(objective.codigo) || `OPM_${String(index + 1).padStart(2, '0')}`;
    const values = { code };
    categoryKeys.forEach((category) => {
      values[category] = array(contenido.presupuesto)
        .filter((item) => text(item.codigoObjetivo) === code && item.categoria === category)
        .reduce((sum, item) => sum + budgetItemTotal(item), 0);
    });
    values.total = categoryKeys.reduce((sum, category) => sum + values[category], 0);
    sheet.addRow(values);
  });
  const totalRow = sheet.addRow({ code: 'TOTAL PLAN' });
  for (let column = 2; column <= 8; column += 1) {
    totalRow.getCell(column).value = { formula: `SUM(${sheet.getColumn(column).letter}2:${sheet.getColumn(column).letter}${Math.max(2, totalRow.number - 1)})` };
  }
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  totalRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } };
  for (let column = 2; column <= 8; column += 1) sheet.getColumn(column).numFmt = '$#,##0.00';
  sheet.autoFilter = `A1:H${Math.max(2, totalRow.number - 1)}`;
};

const buildPlanMejoramientoWorkbook = async (plan, templatePath = TEMPLATE_PATH) => {
  if (!fs.existsSync(templatePath)) {
    throw Object.assign(new Error('No se encontró la plantilla institucional de exportación'), { status: 500 });
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(templatePath);
  const contenido = plan.contenido || {};
  const rows = activityRows(contenido);
  if (rows.length > 130) {
    throw Object.assign(new Error('La plantilla admite hasta 130 actividades por archivo de exportación'), { status: 422 });
  }

  fillPlanSheet(workbook.getWorksheet('PM'), plan, contenido, rows);
  fillBudgetSheets(workbook, contenido);
  const perObjectiveSheet = workbook.getWorksheet('Presupuesto x Objetivo');
  if (perObjectiveSheet) setCell(perObjectiveSheet, 'H8', rows[0]?.code || '');
  addFollowUpSheet(workbook, rows);
  addBudgetSummarySheet(workbook, contenido);
  addPolicyAlignmentSheet(workbook, rows);
  workbook.calcProperties.fullCalcOnLoad = true;
  workbook.calcProperties.forceFullCalc = true;
  workbook.calcProperties.calcMode = 'auto';
  return workbook;
};

const exportExcel = async (req, res) => {
  try {
    if (req.planCollaboratorOnly) return res.status(403).json({ success: false, message: 'El colaborador solo puede consultar y entregar las actividades asignadas' });
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    const workbook = await buildPlanMejoramientoWorkbook(plan);
    const safeName = plan.programa.replace(/[^a-z0-9áéíóúñ_-]+/gi, '_').slice(0, 70);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Plan_mejoramiento_${safeName}_${plan.periodo_inicio}_${plan.periodo_fin}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: `No fue posible generar el Excel: ${error.message}` });
  }
};

const downloadPlanTemplate = async (req, res) => {
  try {
    if (req.planCollaboratorOnly) return res.status(403).json({ success: false, message: 'No tiene permiso para descargar la plantilla' });
    const currentYear = new Date().getFullYear();
    const programaName = text(req.query.programa) || 'PROGRAMA ACADÉMICO';
    const blankPlan = {
      periodo_inicio: currentYear,
      periodo_fin: currentYear + 2,
      programa: programaName,
      contenido: {
        programa: programaName,
        periodoInicio: currentYear,
        periodoFin: currentYear + 2,
        objetivos: [],
        presupuesto: []
      }
    };
    const workbook = await buildPlanMejoramientoWorkbook(blankPlan);
    const safeName = programaName.replace(/[^a-z0-9áéíóúñ_-]+/gi, '_').slice(0, 70);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Plantilla_Plan_Mejoramiento_${safeName}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    console.error('[plan-mejoramiento] Error al generar plantilla:', error);
    return res.status(500).json({ success: false, message: `No fue posible generar la plantilla: ${error.message}` });
  }
};

const importPlanExcel = async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ success: false, message: 'Seleccione un archivo Excel (.xlsx) para importar' });
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);

    const pmSheet = workbook.getWorksheet('PM');
    if (!pmSheet) {
      return res.status(422).json({ success: false, message: 'El archivo Excel no contiene la hoja requerida "PM"' });
    }

    const rawPeriod = text(pmSheet.getCell('E5').value);
    const periodParts = rawPeriod.split(/[-–—/]/).map((p) => Number(text(p))).filter(Boolean);
    const periodoInicio = periodParts[0] || new Date().getFullYear();
    const periodoFin = periodParts[1] || periodoInicio + 2;
    const programa = text(pmSheet.getCell('E7').value) || text(req.body.programa);

    if (!programa || programa === 'PROGRAMA ACADÉMICO') {
      return res.status(422).json({ success: false, message: 'Por favor indique el nombre del programa en la celda E7 de la hoja PM' });
    }

    const objectivesMap = new Map();
    let currentObjective = null;

    for (let r = 11; r <= 250; r += 1) {
      const row = pmSheet.getRow(r);
      const code = text(row.getCell('B').value);
      const factor = text(row.getCell('C').value);
      const characteristic = text(row.getCell('D').value);
      const aspect = text(row.getCell('E').value);
      const score = row.getCell('F').value;
      const actionType = text(row.getCell('G').value);
      const objectiveText = text(row.getCell('H').value);
      const activityName = text(row.getCell('I').value);

      if (!code && !objectiveText && !activityName) continue;

      const objectiveKey = code.includes('-') ? code.split('-')[0].trim() : (code || `OBJ_${objectivesMap.size + 1}`);

      if (!objectivesMap.has(objectiveKey)) {
        currentObjective = {
          codigo: objectiveKey,
          factor: factor || '',
          caracteristica: characteristic || '',
          aspecto: aspect || '',
          calificacion: score !== null && score !== undefined && score !== '' ? Number(score) : '',
          tipoAccion: actionType || 'MEJORA',
          objetivo: objectiveText || '',
          actividades: []
        };
        objectivesMap.set(objectiveKey, currentObjective);
      } else {
        currentObjective = objectivesMap.get(objectiveKey);
        if (objectiveText && !currentObjective.objetivo) currentObjective.objetivo = objectiveText;
        if (factor && !currentObjective.factor) currentObjective.factor = factor;
        if (characteristic && !currentObjective.caracteristica) currentObjective.caracteristica = characteristic;
        if (aspect && !currentObjective.aspecto) currentObjective.aspecto = aspect;
      }

      if (activityName) {
        const rawStart = row.getCell('M').value;
        const rawEnd = row.getCell('N').value;
        const startDate = rawStart instanceof Date ? rawStart.toISOString().slice(0, 10) : text(rawStart);
        const endDate = rawEnd instanceof Date ? rawEnd.toISOString().slice(0, 10) : text(rawEnd);

        currentObjective.actividades.push({
          uid: crypto.randomUUID(),
          codigo: code,
          nombre: activityName,
          descripcion: text(row.getCell('J').value),
          indicador: text(row.getCell('K').value),
          meta: text(row.getCell('L').value),
          fechaInicio: startDate,
          fechaFin: endDate,
          recursos: text(row.getCell('O').value),
          procesoResponsable: text(row.getCell('Q').value),
          cargoResponsable: text(row.getCell('R').value),
          alcance: text(row.getCell('S').value) || 'PROGRAMA',
          ejeEstrategico: text(row.getCell('T').value),
          objetivoEstrategico: text(row.getCell('U').value),
          proyectoPdi: text(row.getCell('V').value),
          politicasInstitucionales: [],
          lineasAccionPolitica: [],
          seguimientos: []
        });
      }
    }

    const compiledObjectives = Array.from(objectivesMap.values());
    if (!compiledObjectives.length) {
      return res.status(422).json({ success: false, message: 'No se encontraron objetivos ni actividades registrados en la hoja PM' });
    }

    const policySheet = workbook.getWorksheet('POLÍTICAS Y LÍNEAS');
    if (policySheet) {
      policySheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const code = text(row.getCell(1).value);
        const actName = text(row.getCell(2).value);
        const policies = text(row.getCell(5).value).split('\n').map(text).filter(Boolean);
        const actionLines = text(row.getCell(6).value).split('\n').map(text).filter(Boolean);

        compiledObjectives.forEach((obj) => {
          obj.actividades.forEach((act) => {
            if ((code && (act.codigo === code || obj.codigo === code)) || (actName && act.nombre === actName)) {
              if (policies.length) act.politicasInstitucionales = policies;
              if (actionLines.length) act.lineasAccionPolitica = actionLines;
            }
          });
        });
      });
    }

    const budgetLayouts = [
      { sheetName: 'PERSONAL', categoria: 'personal', defaultSub: 'docente_tc', conceptCol: 'C', descCol: 'D', qtyCol: 'E', unitCol: 'F', codeCol: 'H', rows: [17, 104] },
      { sheetName: 'ADQUISICIÓN DE ACTIVOS', categoria: 'activos', defaultSub: 'equipos', conceptCol: 'C', descCol: 'D', qtyCol: 'E', unitCol: 'F', codeCol: 'H', rows: [21, 44] },
      { sheetName: 'PUBLICIDAD', categoria: 'publicidad', defaultSub: 'medios', conceptCol: 'C', descCol: 'D', qtyCol: 'E', unitCol: 'F', codeCol: 'H', rows: [17, 52] },
      { sheetName: 'ÚTILES Y PAPELERÍA', categoria: 'papeleria', defaultSub: 'papeleria_general', conceptCol: 'C', descCol: 'D', qtyCol: 'E', unitCol: 'F', codeCol: 'H', rows: [19, 47] },
      { sheetName: 'ESPACIOS FÍSICOS y EQUIP', categoria: 'espacios', defaultSub: 'aulas', conceptCol: 'C', descCol: 'D', qtyCol: 'E', unitCol: 'G', codeCol: 'I', rows: [18, 59] },
      { sheetName: 'DIVERSOS', categoria: 'diversos', defaultSub: 'otros', conceptCol: 'C', descCol: 'D', qtyCol: 'E', unitCol: 'F', codeCol: 'H', rows: [15, 32] }
    ];

    const compiledBudget = [];
    budgetLayouts.forEach((layout) => {
      const sheet = workbook.getWorksheet(layout.sheetName);
      if (!sheet) return;
      for (let r = layout.rows[0]; r <= layout.rows[1]; r += 1) {
        const row = sheet.getRow(r);
        const concept = text(row.getCell(layout.conceptCol).value);
        const description = text(row.getCell(layout.descCol).value);
        const qty = number(row.getCell(layout.qtyCol).value);
        const unitVal = number(row.getCell(layout.unitCol).value);
        const objCode = text(row.getCell(layout.codeCol).value);

        if (concept || description || (qty > 0 && unitVal > 0)) {
          compiledBudget.push({
            id: crypto.randomUUID(),
            categoria: layout.categoria,
            subcategoria: layout.defaultSub,
            concepto: concept || 'Rubro presupuestal',
            descripcion: description,
            cantidad: qty || 1,
            valorUnitario: unitVal,
            codigoObjetivo: objCode || compiledObjectives[0]?.codigo || 'OPM_01'
          });
        }
      }
    });

    const followUpSheet = workbook.getWorksheet('SEGUIMIENTO');
    if (followUpSheet) {
      followUpSheet.eachRow((row, rowNumber) => {
        if (rowNumber <= 1) return;
        const code = text(row.getCell(1).value);
        const actName = text(row.getCell(3).value);
        const achieved = text(row.getCell(6).value);
        const evidence = text(row.getCell(11).value);
        const observations = text(row.getCell(12).value);
        const dateRaw = row.getCell(13).value;
        const followDate = dateRaw instanceof Date ? dateRaw.toISOString().slice(0, 10) : text(dateRaw);
        const verification = text(row.getCell(14).value);

        if (achieved || evidence || observations || followDate) {
          compiledObjectives.forEach((obj) => {
            obj.actividades.forEach((act) => {
              if ((code && (act.codigo === code || obj.codigo === code)) || (actName && act.nombre === actName)) {
                act.metaAlcanzada = achieved || act.metaAlcanzada;
                act.fechaSeguimiento = followDate || act.fechaSeguimiento;
                act.evidencia = evidence || act.evidencia;
                act.observaciones = observations || act.observaciones;
                act.verificacionSeguimiento = verification || act.verificacionSeguimiento;
                act.seguimientos.push({
                  id: crypto.randomUUID(),
                  metaPlaneada: act.meta,
                  valorAlcanzado: achieved,
                  evidenciaUrl: evidence,
                  observaciones: observations,
                  fecha: followDate,
                  verificacion: verification
                });
              }
            });
          });
        }
      });
    }

    const requestedPlanId = req.params.id || req.body.planId;
    let targetPlan = null;
    if (requestedPlanId) {
      targetPlan = await PlanMejoramiento.findByPk(requestedPlanId);
    }
    if (!targetPlan && programa) {
      targetPlan = await PlanMejoramiento.findOne({
        where: { programa: { [Op.iLike]: programa }, estado: { [Op.ne]: 'cerrado' } },
        order: [['updatedAt', 'DESC']]
      });
    }

    const currentContent = targetPlan?.contenido && typeof targetPlan.contenido === 'object' ? targetPlan.contenido : {};
    const updatedContent = {
      ...currentContent,
      programa,
      periodoInicio,
      periodoFin,
      objetivos: compiledObjectives,
      presupuesto: compiledBudget.length ? compiledBudget : array(currentContent.presupuesto),
      oportunidadesAutoevaluacion: array(currentContent.oportunidadesAutoevaluacion)
    };

    if (targetPlan) {
      await targetPlan.update({
        programa,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        contenido: updatedContent,
        actualizado_por: req.user?.id
      });
    } else {
      targetPlan = await PlanMejoramiento.create({
        programa,
        periodo_inicio: periodoInicio,
        periodo_fin: periodoFin,
        estado: 'borrador',
        contenido: updatedContent,
        creado_por: req.user?.id,
        actualizado_por: req.user?.id
      });
    }

    const totalActivities = compiledObjectives.reduce((sum, obj) => sum + obj.actividades.length, 0);

    return res.json({
      success: true,
      message: `Plan de mejoramiento compilado exitosamente: ${compiledObjectives.length} objetivos, ${totalActivities} actividades y ${compiledBudget.length} rubros presupuestales.`,
      data: {
        id: targetPlan.id,
        programa: targetPlan.programa,
        periodo: `${periodoInicio} - ${periodoFin}`,
        objetivosCount: compiledObjectives.length,
        actividadesCount: totalActivities,
        rubrosPresupuestoCount: compiledBudget.length
      }
    });
  } catch (error) {
    console.error('[plan-mejoramiento] Error al importar plantilla Excel:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'No fue posible compilar la información de la plantilla Excel'
    });
  }
};

module.exports = {
  getActionPlanCandidates, linkActivityToActionPlan, unlinkActivityFromActionPlan, syncLinkedActionPlansTracking, ensureAccess, ensureManager, getCatalogs, downloadTariffTemplate, importTariffs, searchResponsables, syncAutoevaluacion, linkedAutoevaluacion, unlinkAutoevaluacion, executionBadge, assignPlan, workflowAction, assignActivity, activityWorkflowAction, activityCorrectionAction, list, get, create, update, remove, uploadEvidence, syncDriveRepository, uploadActivityEvidence, exportExcel, downloadPlanTemplate, importPlanExcel, buildPlanMejoramientoWorkbook, readInstitutionalPolicies, mergeLeaderExecutionContent, planStateForAssignment };
