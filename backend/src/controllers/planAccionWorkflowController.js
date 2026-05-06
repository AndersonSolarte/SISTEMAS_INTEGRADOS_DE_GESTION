const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { PlanAccion, User } = require('../models');
const { ROLES } = require('../constants/roles');

// === Estados del workflow ===
const ESTADOS = {
  BORRADOR: 'Borrador',
  EN_REVISION_ESTRATEGICA: 'EnRevisionEstrategica',
  REVISADO_POR_ESTRATEGICA: 'RevisadoPorEstrategica',
  EN_REVISION_RESPONSABLE: 'EnRevisionResponsable',
  REVISADO_POR_RESPONSABLE: 'RevisadoPorResponsable',
  APROBADO: 'Aprobado'
};

// === Transiciones permitidas ===
const TRANSICIONES = {
  enviar_a_estrategica: {
    from: ESTADOS.BORRADOR,
    to: ESTADOS.EN_REVISION_ESTRATEGICA,
    role: ROLES.PLANEACION_EFECTIVIDAD,
    fechaCol: 'fecha_envio_estrategica'
  },
  marcar_revisado_estrategica: {
    from: ESTADOS.EN_REVISION_ESTRATEGICA,
    to: ESTADOS.REVISADO_POR_ESTRATEGICA,
    role: ROLES.PLANEACION_ESTRATEGICA,
    fechaCol: 'fecha_revisado_estrategica',
    setRevisorEstrategico: true
  },
  enviar_a_responsable: {
    from: ESTADOS.REVISADO_POR_ESTRATEGICA,
    to: ESTADOS.EN_REVISION_RESPONSABLE,
    role: ROLES.PLANEACION_EFECTIVIDAD,
    fechaCol: 'fecha_envio_responsable',
    requiereResponsable: true
  },
  marcar_revisado_responsable: {
    from: ESTADOS.EN_REVISION_RESPONSABLE,
    to: ESTADOS.REVISADO_POR_RESPONSABLE,
    role: ROLES.CONSULTA,
    fechaCol: 'fecha_revisado_responsable',
    requiereSerResponsable: true
  },
  aprobar: {
    from: ESTADOS.REVISADO_POR_RESPONSABLE,
    to: ESTADOS.APROBADO,
    role: ROLES.PLANEACION_EFECTIVIDAD,
    fechaCol: 'fecha_aprobado',
    setAprobador: true
  }
};

// === Permisos para EDITAR contenido del plan ===
// P&E puede editar en cualquier estado (excepto Aprobado donde usamos guardarSeguimiento).
const PERMISOS_EDICION = {
  [ESTADOS.BORRADOR]: [ROLES.PLANEACION_EFECTIVIDAD, ROLES.ADMINISTRADOR],
  [ESTADOS.EN_REVISION_ESTRATEGICA]: [ROLES.PLANEACION_ESTRATEGICA, ROLES.PLANEACION_EFECTIVIDAD, ROLES.ADMINISTRADOR],
  [ESTADOS.REVISADO_POR_ESTRATEGICA]: [ROLES.PLANEACION_EFECTIVIDAD, ROLES.ADMINISTRADOR],
  [ESTADOS.EN_REVISION_RESPONSABLE]: [ROLES.CONSULTA, ROLES.PLANEACION_EFECTIVIDAD, ROLES.ADMINISTRADOR],
  [ESTADOS.REVISADO_POR_RESPONSABLE]: [ROLES.PLANEACION_EFECTIVIDAD, ROLES.ADMINISTRADOR],
  [ESTADOS.APROBADO]: [ROLES.PLANEACION_EFECTIVIDAD, ROLES.ADMINISTRADOR]
};

// === Helpers ===

const slugify = (text) => String(text || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '_')
  .replace(/^_|_$/g, '')
  .slice(0, 60);

const generarPlanCodigo = (anio, dependencia) => {
  const slug = slugify(dependencia);
  return `PA-${anio}-${slug}`.toUpperCase();
};

const findPlanCabecera = async (planCodigo) => {
  return PlanAccion.findOne({
    where: { plan_codigo: planCodigo, deleted_at: null },
    raw: true
  });
};

const puedeVerPlan = (cabecera, userId, role) => {
  if (role === ROLES.ADMINISTRADOR) return true;
  if (role === ROLES.PLANEACION_EFECTIVIDAD) return true;
  if (role === ROLES.PLANEACION_ESTRATEGICA) return true;
  if (role === ROLES.CONSULTA) return Number(cabecera.responsable_id) === Number(userId);
  return false;
};

const puedeEditarPlan = (cabecera, userId, role) => {
  const rolesPermitidos = PERMISOS_EDICION[cabecera.estado_workflow] || [];
  if (!rolesPermitidos.includes(role)) return false;
  if (role === ROLES.CONSULTA && cabecera.estado_workflow === ESTADOS.EN_REVISION_RESPONSABLE) {
    return Number(cabecera.responsable_id) === Number(userId);
  }
  return true;
};

const buildActividadRow = (a = {}) => ({
  objetivo_estrategico: a.objetivo_estrategico || null,
  lineamiento_estrategico: a.lineamiento_estrategico || null,
  macroactividad: a.macroactividad || null,
  actividad: a.actividad || null,
  tipo_indicador: a.tipo_indicador || null,
  fecha_inicio: a.fecha_inicio || null,
  fecha_fin: a.fecha_fin || null,
  indicador: a.indicador || null,
  meta: a.meta || null,
  responsable: a.responsable || null,
  corresponsable: a.corresponsable || null,
  avance_ip: a.avance_ip === '' || a.avance_ip === undefined || a.avance_ip === null ? null : Number(a.avance_ip),
  observaciones_ip: a.observaciones_ip || null,
  avance_iip: a.avance_iip === '' || a.avance_iip === undefined || a.avance_iip === null ? null : Number(a.avance_iip),
  observaciones_iip: a.observaciones_iip || null,
  total_ejecucion: a.total_ejecucion === '' || a.total_ejecucion === undefined || a.total_ejecucion === null ? null : Number(a.total_ejecucion)
});

// === Endpoints ===

const listarMisPlanes = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const where = { deleted_at: null };

    if (role === ROLES.ADMINISTRADOR) {
      // ve todos
    } else if (role === ROLES.PLANEACION_EFECTIVIDAD) {
      // ve todos los activos en cualquier estado
    } else if (role === ROLES.PLANEACION_ESTRATEGICA) {
      where.estado_workflow = { [Op.in]: [ESTADOS.EN_REVISION_ESTRATEGICA, ESTADOS.REVISADO_POR_ESTRATEGICA, ESTADOS.APROBADO] };
    } else if (role === ROLES.CONSULTA) {
      const numericUserId = Number(userId);
      if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return res.json({ success: true, data: [] });
      }
      where.responsable_id = numericUserId;
      // Consulta solo ve su plan vigente: aprobado o pendiente de su revisión.
      where.estado_workflow = { [Op.in]: [ESTADOS.EN_REVISION_RESPONSABLE, ESTADOS.APROBADO] };
    } else {
      return res.json({ success: true, data: [] });
    }

    const rows = await PlanAccion.findAll({
      where,
      attributes: [
        'plan_codigo', 'anio', 'dependencia', 'ped',
        'estado_workflow', 'responsable_id', 'creado_por', 'aprobado_por', 'revisor_estrategico_id',
        'fecha_envio_estrategica', 'fecha_revisado_estrategica',
        'fecha_envio_responsable', 'fecha_revisado_responsable', 'fecha_aprobado',
        'cabecera_plan', 'createdAt', 'updatedAt'
      ],
      order: [['updatedAt', 'DESC']],
      raw: true
    });

    const map = new Map();
    for (const row of rows) {
      if (!row.plan_codigo) continue;
      // Defensa adicional para Consulta: NUNCA exponer un plan donde no sea el responsable asignado.
      if (role === ROLES.CONSULTA && Number(row.responsable_id) !== Number(userId)) continue;
      if (!map.has(row.plan_codigo)) map.set(row.plan_codigo, row);
    }
    return res.json({ success: true, data: Array.from(map.values()) });
  } catch (error) {
    console.error('Error listarMisPlanes:', error);
    return res.status(500).json({ success: false, message: 'Error al listar planes' });
  }
};

const listarPendientes = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    const where = { deleted_at: null };

    if (role === ROLES.ADMINISTRADOR) {
      where.estado_workflow = { [Op.ne]: ESTADOS.APROBADO };
    } else if (role === ROLES.PLANEACION_EFECTIVIDAD) {
      where.estado_workflow = { [Op.in]: [ESTADOS.BORRADOR, ESTADOS.REVISADO_POR_ESTRATEGICA, ESTADOS.REVISADO_POR_RESPONSABLE] };
    } else if (role === ROLES.PLANEACION_ESTRATEGICA) {
      where.estado_workflow = ESTADOS.EN_REVISION_ESTRATEGICA;
    } else if (role === ROLES.CONSULTA) {
      const numericUserId = Number(userId);
      if (!Number.isFinite(numericUserId) || numericUserId <= 0) {
        return res.json({ success: true, data: [] });
      }
      where.responsable_id = numericUserId;
      where.estado_workflow = { [Op.in]: [ESTADOS.EN_REVISION_RESPONSABLE, ESTADOS.APROBADO] };
    } else {
      return res.json({ success: true, data: [] });
    }

    const rows = await PlanAccion.findAll({
      where,
      attributes: [
        'plan_codigo', 'anio', 'dependencia', 'ped',
        'estado_workflow', 'responsable_id', 'creado_por',
        'fecha_envio_estrategica', 'fecha_envio_responsable', 'fecha_aprobado',
        'cabecera_plan', 'updatedAt'
      ],
      order: [['updatedAt', 'DESC']],
      raw: true
    });

    const map = new Map();
    for (const row of rows) {
      if (!row.plan_codigo) continue;
      // Defensa adicional para Consulta: NUNCA exponer un plan cuyo responsable_id no sea el del usuario.
      if (role === ROLES.CONSULTA && Number(row.responsable_id) !== Number(userId)) continue;
      if (!map.has(row.plan_codigo)) map.set(row.plan_codigo, row);
    }
    return res.json({ success: true, data: Array.from(map.values()) });
  } catch (error) {
    console.error('Error listarPendientes:', error);
    return res.status(500).json({ success: false, message: 'Error al listar pendientes' });
  }
};

const obtenerPlan = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { id: userId, role } = req.user;

    const rows = await PlanAccion.findAll({
      where: { plan_codigo: planCodigo, deleted_at: null },
      order: [['id', 'ASC']],
      raw: true
    });

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    }

    const cab = rows[0];
    if (!puedeVerPlan(cab, userId, role)) {
      return res.status(403).json({ success: false, message: 'No puedes ver este plan' });
    }

    const actividades = rows
      .filter((r) => r.actividad || r.objetivo_estrategico || r.indicador)
      .map((r) => ({
        id: r.id,
        objetivo_estrategico: r.objetivo_estrategico,
        lineamiento_estrategico: r.lineamiento_estrategico,
        macroactividad: r.macroactividad,
        actividad: r.actividad,
        tipo_indicador: r.tipo_indicador,
        fecha_inicio: r.fecha_inicio,
        fecha_fin: r.fecha_fin,
        indicador: r.indicador,
        meta: r.meta,
        responsable: r.responsable,
        corresponsable: r.corresponsable,
        avance_ip: r.avance_ip,
        observaciones_ip: r.observaciones_ip,
        avance_iip: r.avance_iip,
        observaciones_iip: r.observaciones_iip,
        total_ejecucion: r.total_ejecucion
      }));

    return res.json({
      success: true,
      data: {
        plan_codigo: cab.plan_codigo,
        anio: cab.anio,
        ped: cab.ped,
        dependencia: cab.dependencia,
        estado_workflow: cab.estado_workflow,
        revisor_estrategico_id: cab.revisor_estrategico_id,
        responsable_id: cab.responsable_id,
        aprobado_por: cab.aprobado_por,
        creado_por: cab.creado_por,
        fecha_envio_estrategica: cab.fecha_envio_estrategica,
        fecha_revisado_estrategica: cab.fecha_revisado_estrategica,
        fecha_envio_responsable: cab.fecha_envio_responsable,
        fecha_revisado_responsable: cab.fecha_revisado_responsable,
        fecha_aprobado: cab.fecha_aprobado,
        cabecera_plan: cab.cabecera_plan || {},
        actividades,
        puedeEditar: puedeEditarPlan(cab, userId, role)
      }
    });
  } catch (error) {
    console.error('Error obtenerPlan:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener plan' });
  }
};

const crearPlan = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    if (role !== ROLES.PLANEACION_EFECTIVIDAD && role !== ROLES.ADMINISTRADOR) {
      return res.status(403).json({ success: false, message: 'Solo Planeación y Efectividad puede crear planes' });
    }

    const { anio, dependencia, ped, cabecera_plan, actividades } = req.body || {};
    if (!anio || !dependencia) {
      return res.status(400).json({ success: false, message: 'anio y dependencia son obligatorios' });
    }

    const planCodigo = generarPlanCodigo(anio, dependencia);
    const existing = await findPlanCabecera(planCodigo);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un plan para esta dependencia y año',
        plan_codigo: planCodigo
      });
    }

    const lista = Array.isArray(actividades) && actividades.length > 0 ? actividades : [{}];
    const filas = lista.map((a) => ({
      anio: Number(anio),
      ped: ped || null,
      dependencia,
      plan_codigo: planCodigo,
      estado_workflow: ESTADOS.BORRADOR,
      cabecera_plan: cabecera_plan || {},
      creado_por: userId,
      actualizado_por: userId,
      ...buildActividadRow(a)
    }));

    await PlanAccion.bulkCreate(filas);

    return res.status(201).json({
      success: true,
      data: { plan_codigo: planCodigo, estado_workflow: ESTADOS.BORRADOR }
    });
  } catch (error) {
    console.error('Error crearPlan:', error);
    return res.status(500).json({ success: false, message: 'Error al crear plan' });
  }
};

const guardarPlan = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { cabecera_plan, actividades } = req.body || {};
    const { id: userId, role } = req.user;

    const cab = await findPlanCabecera(planCodigo);
    if (!cab) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    if (!puedeEditarPlan(cab, userId, role)) {
      return res.status(403).json({ success: false, message: 'No puedes editar este plan en su estado actual' });
    }

    const lista = Array.isArray(actividades) && actividades.length > 0 ? actividades : [{}];
    const filas = lista.map((a) => ({
      anio: cab.anio,
      ped: cab.ped,
      dependencia: cab.dependencia,
      plan_codigo: planCodigo,
      estado_workflow: cab.estado_workflow,
      revisor_estrategico_id: cab.revisor_estrategico_id,
      responsable_id: cab.responsable_id,
      aprobado_por: cab.aprobado_por,
      fecha_envio_estrategica: cab.fecha_envio_estrategica,
      fecha_revisado_estrategica: cab.fecha_revisado_estrategica,
      fecha_envio_responsable: cab.fecha_envio_responsable,
      fecha_revisado_responsable: cab.fecha_revisado_responsable,
      fecha_aprobado: cab.fecha_aprobado,
      cabecera_plan: cabecera_plan !== undefined ? cabecera_plan : (cab.cabecera_plan || {}),
      creado_por: cab.creado_por,
      actualizado_por: userId,
      ...buildActividadRow(a)
    }));

    await sequelize.transaction(async (t) => {
      await PlanAccion.destroy({
        where: { plan_codigo: planCodigo },
        force: true,
        transaction: t
      });
      await PlanAccion.bulkCreate(filas, { transaction: t });
    });

    return res.json({
      success: true,
      data: { plan_codigo: planCodigo, count: filas.length }
    });
  } catch (error) {
    console.error('Error guardarPlan:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar plan' });
  }
};

const transicionarPlan = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { accion, responsable_id, comentarios } = req.body || {};
    const { id: userId, role } = req.user;

    const transicion = TRANSICIONES[accion];
    if (!transicion) return res.status(400).json({ success: false, message: 'Acción inválida' });

    const cab = await findPlanCabecera(planCodigo);
    if (!cab) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    if (role !== ROLES.ADMINISTRADOR && role !== transicion.role) {
      return res.status(403).json({ success: false, message: 'Tu rol no puede ejecutar esta transición' });
    }

    if (cab.estado_workflow !== transicion.from) {
      return res.status(409).json({
        success: false,
        message: `Estado actual (${cab.estado_workflow}) no permite la acción "${accion}"`
      });
    }

    if (transicion.requiereSerResponsable && Number(cab.responsable_id) !== Number(userId)) {
      return res.status(403).json({ success: false, message: 'Solo el responsable asignado puede marcar como revisado' });
    }

    const updates = {
      estado_workflow: transicion.to,
      [transicion.fechaCol]: new Date(),
      actualizado_por: userId
    };

    if (transicion.requiereResponsable) {
      const targetId = Number(responsable_id);
      if (!targetId) return res.status(400).json({ success: false, message: 'Debes asignar un responsable' });
      const target = await User.findByPk(targetId);
      if (!target || target.role !== ROLES.CONSULTA || target.estado !== 'activo') {
        return res.status(400).json({ success: false, message: 'El responsable seleccionado no es un Usuario Consulta activo' });
      }
      updates.responsable_id = targetId;
    }

    if (transicion.setRevisorEstrategico) {
      updates.revisor_estrategico_id = userId;
    }

    if (transicion.setAprobador) {
      updates.aprobado_por = userId;
    }

    // Guardar comentarios/observaciones del revisor en cabecera_plan
    if (comentarios && typeof comentarios === 'string' && comentarios.trim()) {
      const cabeceraActual = cab.cabecera_plan || {};
      const comentariosKey = accion === 'marcar_revisado_estrategica' ? 'comentarios_estrategica'
        : accion === 'marcar_revisado_responsable' ? 'comentarios_responsable' : null;
      if (comentariosKey) {
        updates.cabecera_plan = {
          ...cabeceraActual,
          [comentariosKey]: comentarios.trim(),
          [`fecha_${comentariosKey}`]: new Date().toISOString()
        };
      }
    }

    await PlanAccion.update(updates, {
      where: { plan_codigo: planCodigo, deleted_at: null }
    });

    return res.json({
      success: true,
      data: {
        plan_codigo: planCodigo,
        estado_workflow: transicion.to,
        responsable_id: updates.responsable_id || cab.responsable_id || null
      }
    });
  } catch (error) {
    console.error('Error transicionarPlan:', error);
    return res.status(500).json({ success: false, message: 'Error al cambiar estado del plan' });
  }
};

const eliminarPlan = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { role } = req.user;

    if (role !== ROLES.PLANEACION_EFECTIVIDAD && role !== ROLES.ADMINISTRADOR) {
      return res.status(403).json({ success: false, message: 'Solo Planeación y Efectividad puede eliminar' });
    }

    const cab = await findPlanCabecera(planCodigo);
    if (!cab) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    if (cab.estado_workflow !== ESTADOS.BORRADOR && role !== ROLES.ADMINISTRADOR) {
      return res.status(409).json({ success: false, message: 'Solo se puede eliminar planes en Borrador' });
    }

    await PlanAccion.update(
      { deleted_at: new Date() },
      { where: { plan_codigo: planCodigo } }
    );

    return res.json({ success: true, data: { plan_codigo: planCodigo } });
  } catch (error) {
    console.error('Error eliminarPlan:', error);
    return res.status(500).json({ success: false, message: 'Error al eliminar plan' });
  }
};

// Devuelve las actividades aprobadas en las que el usuario figura como CORRESPONSABLE
// (en planes ajenos, donde no es el responsable principal). Match por nombre del usuario
// dentro del campo libre `corresponsable` (case-insensitive substring).
const obtenerMisCorresponsabilidades = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    if (role !== ROLES.CONSULTA && role !== ROLES.ADMINISTRADOR) {
      return res.json({ success: true, data: [] });
    }

    const user = await User.findByPk(userId, { attributes: ['id', 'nombre', 'email'] });
    if (!user || !user.nombre) return res.json({ success: true, data: [] });

    const nombreLimpio = String(user.nombre).trim();
    if (!nombreLimpio) return res.json({ success: true, data: [] });

    const dialect = sequelize.getDialect();
    const likeOp = dialect === 'postgres' ? Op.iLike : Op.like;

    const rows = await PlanAccion.findAll({
      where: {
        deleted_at: null,
        estado_workflow: ESTADOS.APROBADO,
        corresponsable: { [likeOp]: `%${nombreLimpio}%` }
      },
      attributes: [
        'id', 'plan_codigo', 'anio', 'dependencia', 'ped',
        'objetivo_estrategico', 'lineamiento_estrategico', 'macroactividad',
        'actividad', 'tipo_indicador', 'fecha_inicio', 'fecha_fin',
        'indicador', 'meta', 'responsable', 'corresponsable',
        'avance_ip', 'observaciones_ip', 'avance_iip', 'observaciones_iip', 'total_ejecucion'
      ],
      order: [['plan_codigo', 'ASC'], ['id', 'ASC']],
      raw: true
    });

    // Defensivo: descartar filas donde el plan sea EL PROPIO del usuario
    // (no queremos duplicar las actividades de su plan principal en "corresponsabilidad").
    const propios = await PlanAccion.findAll({
      where: { deleted_at: null, responsable_id: userId, estado_workflow: ESTADOS.APROBADO },
      attributes: ['plan_codigo'],
      group: ['plan_codigo'],
      raw: true
    });
    const codigosPropios = new Set(propios.map((r) => r.plan_codigo));
    const filtradas = rows.filter((r) => !codigosPropios.has(r.plan_codigo));

    return res.json({ success: true, data: filtradas });
  } catch (error) {
    console.error('Error obtenerMisCorresponsabilidades:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener corresponsabilidades' });
  }
};

// Resetea un plan a estado Borrador (devuelve a "Creación"). NO borra el contenido,
// solo limpia el flujo de revisión/aprobación. Solo Admin o PyE.
const resetearPlanABorrador = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { id: userId, role } = req.user;

    if (role !== ROLES.ADMINISTRADOR && role !== ROLES.PLANEACION_EFECTIVIDAD) {
      return res.status(403).json({ success: false, message: 'Solo Admin o Planeación y Efectividad pueden devolver el plan a Creación.' });
    }

    const cab = await findPlanCabecera(planCodigo);
    if (!cab) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    if (cab.estado_workflow === ESTADOS.BORRADOR) {
      return res.json({
        success: true,
        data: { plan_codigo: planCodigo, estado_workflow: ESTADOS.BORRADOR, info: 'El plan ya estaba en Borrador.' }
      });
    }

    await PlanAccion.update({
      estado_workflow: ESTADOS.BORRADOR,
      fecha_envio_estrategica: null,
      fecha_revisado_estrategica: null,
      fecha_envio_responsable: null,
      fecha_revisado_responsable: null,
      fecha_aprobado: null,
      responsable_id: null,
      revisor_estrategico_id: null,
      aprobado_por: null,
      actualizado_por: userId
    }, {
      where: { plan_codigo: planCodigo, deleted_at: null }
    });

    return res.json({
      success: true,
      data: { plan_codigo: planCodigo, estado_workflow: ESTADOS.BORRADOR }
    });
  } catch (error) {
    console.error('Error resetearPlanABorrador:', error);
    return res.status(500).json({ success: false, message: 'Error al devolver el plan a Creación' });
  }
};

const obtenerBadgePendientes = async (req, res) => {
  try {
    const { id: userId, role } = req.user;
    let count = 0;

    if (role === ROLES.PLANEACION_ESTRATEGICA) {
      const rows = await PlanAccion.findAll({
        where: { deleted_at: null, estado_workflow: ESTADOS.EN_REVISION_ESTRATEGICA },
        attributes: ['plan_codigo'],
        group: ['plan_codigo'],
        raw: true
      });
      count = rows.length;
    } else if (role === ROLES.CONSULTA) {
      const numericUserId = Number(userId);
      if (Number.isFinite(numericUserId) && numericUserId > 0) {
        const rows = await PlanAccion.findAll({
          where: {
            deleted_at: null,
            responsable_id: numericUserId,
            estado_workflow: { [Op.in]: [ESTADOS.EN_REVISION_RESPONSABLE, ESTADOS.APROBADO] }
          },
          attributes: ['plan_codigo'],
          group: ['plan_codigo'],
          raw: true
        });
        count = rows.length;
      }
    }

    return res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error obtenerBadgePendientes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener pendientes' });
  }
};

const guardarCumplimientoConsulta = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { id: userId, role } = req.user;
    const { items } = req.body || {};

    if (role !== ROLES.CONSULTA && role !== ROLES.ADMINISTRADOR) {
      return res.status(403).json({ success: false, message: 'Solo el responsable puede actualizar el cumplimiento' });
    }

    const cab = await findPlanCabecera(planCodigo);
    if (!cab) return res.status(404).json({ success: false, message: 'Plan no encontrado' });

    if (role === ROLES.CONSULTA && Number(cab.responsable_id) !== Number(userId)) {
      return res.status(403).json({ success: false, message: 'No eres el responsable de este plan' });
    }

    if (cab.estado_workflow !== ESTADOS.APROBADO) {
      return res.status(409).json({ success: false, message: 'El cumplimiento solo se puede marcar en planes aprobados' });
    }

    const cabecera = { ...(cab.cabecera_plan || {}) };
    const cumplimiento = { ...(cabecera.cumplimiento_consulta || {}) };
    const userKey = String(userId);
    const prev = cumplimiento[userKey] || {};
    const next = { ...prev };

    for (const [actividadId, payload] of Object.entries(items || {})) {
      next[actividadId] = {
        cumplido: !!payload?.cumplido,
        fecha: payload?.cumplido ? (payload?.fecha || new Date().toISOString()) : null,
        observaciones: payload?.observaciones || ''
      };
    }

    cumplimiento[userKey] = next;
    cabecera.cumplimiento_consulta = cumplimiento;

    await PlanAccion.update(
      { cabecera_plan: cabecera, actualizado_por: userId },
      { where: { plan_codigo: planCodigo, deleted_at: null } }
    );

    return res.json({ success: true, data: cumplimiento[userKey] });
  } catch (error) {
    console.error('Error guardarCumplimientoConsulta:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar cumplimiento' });
  }
};

const listarUsuariosConsulta = async (req, res) => {
  try {
    const users = await User.findAll({
      where: { role: ROLES.CONSULTA, estado: 'activo' },
      attributes: ['id', 'nombre', 'email'],
      order: [['nombre', 'ASC']],
      raw: true
    });
    return res.json({ success: true, data: users });
  } catch (error) {
    console.error('Error listarUsuariosConsulta:', error);
    return res.status(500).json({ success: false, message: 'Error al listar usuarios consulta' });
  }
};

// Actualiza solo los campos de seguimiento (avances, observaciones) de las actividades
// de un plan aprobado. Usa UPDATE por id de fila en vez de DELETE+INSERT.
const guardarSeguimiento = async (req, res) => {
  try {
    const { planCodigo } = req.params;
    const { actividades } = req.body || {};
    const { id: userId, role } = req.user;

    const ROLES_SEGUIMIENTO = [ROLES.ADMINISTRADOR, ROLES.PLANEACION_EFECTIVIDAD];
    if (!ROLES_SEGUIMIENTO.includes(role)) {
      return res.status(403).json({ success: false, message: 'Sin permiso para registrar seguimiento' });
    }

    const cab = await findPlanCabecera(planCodigo);
    if (!cab) return res.status(404).json({ success: false, message: 'Plan no encontrado' });
    if (cab.estado_workflow !== ESTADOS.APROBADO) {
      return res.status(400).json({ success: false, message: 'Solo se puede registrar seguimiento en planes aprobados' });
    }

    if (!Array.isArray(actividades) || actividades.length === 0) {
      return res.status(400).json({ success: false, message: 'Se requiere el arreglo de actividades' });
    }

    await sequelize.transaction(async (t) => {
      for (const a of actividades) {
        if (!a.id) continue;
        const avIP = a.avance_ip === '' || a.avance_ip === undefined || a.avance_ip === null ? null : Number(a.avance_ip);
        const avIIP = a.avance_iip === '' || a.avance_iip === undefined || a.avance_iip === null ? null : Number(a.avance_iip);
        const total = (avIP !== null && avIIP !== null)
          ? Math.min(Math.round((avIP + avIIP) * 100) / 100, 100)
          : (avIP !== null ? avIP : (avIIP !== null ? avIIP : null));
        const updateData = {
          avance_ip: avIP,
          observaciones_ip: a.observaciones_ip || null,
          avance_iip: avIIP,
          observaciones_iip: a.observaciones_iip || null,
          total_ejecucion: total,
          actualizado_por: userId
        };
        if (a.actividad !== undefined) updateData.actividad = a.actividad || null;
        if (a.indicador !== undefined) updateData.indicador = a.indicador || null;
        if (a.meta !== undefined) updateData.meta = a.meta || null;
        await PlanAccion.update(updateData, { where: { id: a.id, plan_codigo: planCodigo }, transaction: t });
      }
    });

    return res.json({ success: true, data: { plan_codigo: planCodigo } });
  } catch (error) {
    console.error('Error guardarSeguimiento:', error);
    return res.status(500).json({ success: false, message: 'Error al guardar seguimiento' });
  }
};

module.exports = {
  listarMisPlanes,
  listarPendientes,
  obtenerPlan,
  crearPlan,
  guardarPlan,
  guardarSeguimiento,
  transicionarPlan,
  eliminarPlan,
  listarUsuariosConsulta,
  obtenerBadgePendientes,
  guardarCumplimientoConsulta,
  resetearPlanABorrador,
  obtenerMisCorresponsabilidades,
  ESTADOS,
  TRANSICIONES
};
