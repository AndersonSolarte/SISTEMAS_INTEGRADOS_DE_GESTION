const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const { Op } = require('sequelize');
const { Autoevaluacion, AutoevaluacionPrograma, PlanMejoramiento, PlanMejoramientoTarifaVersion, PlanMejoramientoAsignacion, PlanMejoramientoFlujoHistorial, User, UserModulePermission } = require('../models');

const ALLOWED_ROLES = new Set(['administrador', 'planeacion_estrategica', 'autoevaluacion']);
const VALID_STATES = new Set(['borrador', 'en_ejecucion', 'cerrado']);
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
  proyectoPdi: '', metaAlcanzada: '', fechaSeguimiento: '', evidencia: '', observaciones: ''
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
  const meaningfulActivityFields = ['nombre', 'descripcion', 'meta', 'fechaInicio', 'fechaFin', 'recursos', 'procesoResponsable', 'cargoResponsable', 'ejeEstrategico', 'objetivoEstrategico', 'proyectoPdi', 'metaAlcanzada', 'fechaSeguimiento', 'evidencia', 'observaciones'];
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
    if (ALLOWED_ROLES.has(req.user?.role)) {
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
    if (permissions.some((item) => ['autoevaluacion', 'autoevaluacion.plan_mejoramiento'].includes(item.module_key))) {
      req.planMejoramientoManager = true;
      return next();
    }
    const assigned = await PlanMejoramientoAsignacion.count({ where: { user_id: req.user?.id, activo: true } });
    if (assigned > 0 || permissions.some((item) => item.module_key === 'autoevaluacion_ejecucion')) {
      req.planExecutionOnly = true;
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
  return Boolean(await PlanMejoramientoAsignacion.count({ where: { plan_id: planId, user_id: req.user?.id, activo: true } }));
};

const mergeExecutionContent = (stored = {}, incoming = {}) => ({
  ...stored,
  objetivos: array(stored.objetivos).map((objective, objectiveIndex) => {
    const incomingObjective = array(incoming.objetivos)[objectiveIndex] || {};
    return {
      ...objective,
      actividades: array(objective.actividades).map((activity, activityIndex) => {
        const update = array(incomingObjective.actividades)[activityIndex] || {};
        return {
          ...activity,
          metaAlcanzada: update.metaAlcanzada ?? activity.metaAlcanzada,
          fechaSeguimiento: update.fechaSeguimiento ?? activity.fechaSeguimiento,
          evidencia: update.evidencia ?? activity.evidencia,
          observaciones: update.observaciones ?? activity.observaciones,
          verificacionSeguimiento: update.verificacionSeguimiento ?? activity.verificacionSeguimiento,
          seguimientos: array(update.seguimientos).length >= array(activity.seguimientos).length ? array(update.seguimientos) : array(activity.seguimientos)
        };
      })
    };
  })
});

const assignmentData = async (planId) => {
  const assignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: planId, activo: true }, order: [['id', 'DESC']], raw: true });
  if (!assignment) return null;
  const [user, history] = await Promise.all([
    User.findByPk(assignment.user_id, { attributes: ['id', 'nombre', 'username', 'email', 'cargo', 'dependencia', 'vicerrectoria'], raw: true }),
    PlanMejoramientoFlujoHistorial.findAll({ where: { asignacion_id: assignment.id }, order: [['createdAt', 'ASC'], ['id', 'ASC']], raw: true })
  ]);
  return {
    ...assignment,
    usuario: user ? { ...user, documento: user.username } : null,
    historial: history
  };
};

const serializeWithAssignment = async (plan) => ({ ...serialize(plan), asignacion: await assignmentData(plan.id) });

const assignPlan = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    const document = text(req.body?.documento);
    const selectedUser = req.body?.userId
      ? await User.findOne({ where: { id: Number(req.body.userId), estado: 'activo' } })
      : await User.findOne({ where: { username: { [Op.iLike]: document }, estado: 'activo' } });
    if (!selectedUser) return res.status(404).json({ success: false, message: 'No se encontró un usuario interno activo con ese documento' });

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
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    for (const previousUserId of previousUserIds) {
      const remaining = await PlanMejoramientoAsignacion.count({ where: { user_id: previousUserId, activo: true } });
      if (!remaining) await UserModulePermission.update({ can_view: false, can_manage: false }, { where: { user_id: previousUserId, module_key: 'autoevaluacion_ejecucion' } });
    }
    return res.status(201).json({ success: true, data: await assignmentData(plan.id), message: `Plan asignado a ${selectedUser.nombre}` });
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
    const previousState = assignment.estado_flujo;
    await assignment.update({ estado_flujo: transition.to, ultima_observacion: observation || assignment.ultima_observacion });
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
    return res.json({ success: true, data: await assignmentData(plan.id), message: `Plan actualizado a ${transition.to.replace(/_/g, ' ')}` });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible actualizar el flujo del plan' });
  }
};

const executionBadge = async (req, res) => {
  try {
    const where = req.planExecutionOnly ? { user_id: req.user?.id, activo: true } : { activo: true };
    const rows = await PlanMejoramientoAsignacion.findAll({ where, attributes: ['estado_flujo'], raw: true });
    const pending = rows.filter((item) => req.planExecutionOnly
      ? ['asignado', 'en_ejecucion', 'devuelto'].includes(item.estado_flujo)
      : item.estado_flujo === 'en_revision').length;
    return res.json({ success: true, data: { access: rows.length > 0 || Boolean(req.planMejoramientoManager), pending, executionOnly: Boolean(req.planExecutionOnly) } });
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
    if (!programa) return res.json({ success: true, data: { aspectIds: [] } });
    const plan = await PlanMejoramiento.findOne({
      where: { programa: { [Op.iLike]: programa }, estado: { [Op.ne]: 'cerrado' } },
      order: [['updatedAt', 'DESC'], ['id', 'DESC']]
    });
    const opportunities = array(plan?.contenido?.oportunidadesAutoevaluacion);
    const aspectIds = opportunities
      .filter((item) => number(item.calificacion) >= 4 && item.modoTraslado === 'manual')
      .map((item) => Number(item.id))
      .filter(Number.isInteger);
    return res.json({ success: true, data: { aspectIds } });
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
      const assignments = await PlanMejoramientoAsignacion.findAll({ where: { user_id: req.user?.id, activo: true }, attributes: ['plan_id'], raw: true });
      where.id = { [Op.in]: assignments.map((item) => item.plan_id) };
    }
    if (text(req.query.programa)) where.programa = { [Op.iLike]: `%${text(req.query.programa)}%` };
    if (VALID_STATES.has(req.query.estado)) where.estado = req.query.estado;
    const rows = await PlanMejoramiento.findAll({ where, order: [['updatedAt', 'DESC'], ['id', 'DESC']] });
    return res.json({ success: true, data: await Promise.all(rows.map(serializeWithAssignment)) });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'No fue posible consultar los planes de mejoramiento' });
  }
};

const get = async (req, res) => {
  const plan = await PlanMejoramiento.findByPk(req.params.id);
  if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
  if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
  return res.json({ success: true, data: await serializeWithAssignment(plan) });
};

const uploadEvidence = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    if (req.planExecutionOnly) {
      const assignment = await PlanMejoramientoAsignacion.findOne({ where: { plan_id: plan.id, user_id: req.user?.id, activo: true } });
      if (!assignment || !['asignado', 'en_ejecucion', 'devuelto'].includes(assignment.estado_flujo)) return res.status(409).json({ success: false, message: 'El plan está bloqueado mientras se encuentra en revisión o en firme' });
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
      if (!assignment || !['asignado', 'en_ejecucion', 'devuelto'].includes(assignment.estado_flujo)) return res.status(409).json({ success: false, message: 'El plan está bloqueado mientras se encuentra en revisión o en firme' });
      payload.programa = plan.programa;
      payload.periodo_inicio = plan.periodo_inicio;
      payload.periodo_fin = plan.periodo_fin;
      payload.estado = plan.estado;
      payload.contenido = mergeExecutionContent(plan.contenido || {}, payload.contenido || {});
    }
    await plan.update({ ...payload, actualizado_por: req.user?.id });
    return res.json({ success: true, data: await serializeWithAssignment(plan) });
  } catch (error) {
    return res.status(error.status || 500).json({ success: false, message: error.message || 'No fue posible actualizar el plan' });
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
    return res.json({ success: true, data: await catalogsPromise });
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

const exportExcel = async (req, res) => {
  try {
    const plan = await PlanMejoramiento.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan de mejoramiento no encontrado' });
    if (!(await canAccessPlan(req, plan.id))) return res.status(403).json({ success: false, message: 'Este plan no está asignado a tu usuario' });
    if (!fs.existsSync(TEMPLATE_PATH)) {
      return res.status(500).json({ success: false, message: 'No se encontró la plantilla institucional de exportación' });
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(TEMPLATE_PATH);
    const sheet = workbook.getWorksheet('PM');
    const contenido = plan.contenido || {};
    const rows = activityRows(contenido);
    if (rows.length > 130) {
      return res.status(422).json({ success: false, message: 'La plantilla admite hasta 130 actividades por archivo de exportación' });
    }
    setCell(sheet, 'E5', `${plan.periodo_inicio} - ${plan.periodo_fin}`);
    setCell(sheet, 'E7', plan.programa);

    for (let row = 11; row <= 140; row += 1) {
      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'Q', 'R', 'S', 'T', 'U', 'V'].forEach((column) => setCell(sheet, `${column}${row}`, ''));
    }
    rows.forEach((item, index) => {
      const row = 11 + index;
      const values = [item.code, item.factor, item.characteristic, item.aspect, item.score || '', item.actionType,
        item.objective, text(item.nombre), text(item.descripcion), text(item.indicador), number(item.meta) || '',
        item.fechaInicio ? new Date(item.fechaInicio) : '', item.fechaFin ? new Date(item.fechaFin) : '', text(item.recursos),
        budgetFor(contenido, item.code), text(item.procesoResponsable), text(item.cargoResponsable), text(item.alcance),
        text(item.ejeEstrategico), text(item.objetivoEstrategico), text(item.proyectoPdi)];
      values.forEach((value, offset) => setCell(sheet, `${String.fromCharCode(66 + offset)}${row}`, value));
      sheet.getCell(`M${row}`).numFmt = 'dd/mm/yyyy';
      sheet.getCell(`N${row}`).numFmt = 'dd/mm/yyyy';
      sheet.getCell(`P${row}`).numFmt = '$#,##0.00';
      sheet.getRow(row).height = 60;
    });

    fillBudgetSheets(workbook, contenido);
    const perObjectiveSheet = workbook.getWorksheet('Presupuesto x Objetivo');
    if (perObjectiveSheet) setCell(perObjectiveSheet, 'H8', rows[0]?.code || '');
    addFollowUpSheet(workbook, rows);
    addBudgetSummarySheet(workbook, contenido);
    workbook.calcProperties.fullCalcOnLoad = true;
    const safeName = plan.programa.replace(/[^a-z0-9áéíóúñ_-]+/gi, '_').slice(0, 70);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Plan_mejoramiento_${safeName}_${plan.periodo_inicio}_${plan.periodo_fin}.xlsx"`);
    await workbook.xlsx.write(res);
    return res.end();
  } catch (error) {
    return res.status(500).json({ success: false, message: `No fue posible generar el Excel: ${error.message}` });
  }
};

module.exports = { ensureAccess, ensureManager, getCatalogs, downloadTariffTemplate, importTariffs, searchResponsables, syncAutoevaluacion, linkedAutoevaluacion, unlinkAutoevaluacion, executionBadge, assignPlan, workflowAction, list, get, create, update, remove, uploadEvidence, exportExcel };
