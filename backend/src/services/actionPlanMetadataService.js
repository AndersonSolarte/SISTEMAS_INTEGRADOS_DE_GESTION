const { Op } = require('sequelize');
const { sequelize } = require('../config/database');
const { StrategicActionPlan, StrategicResponsibility, User } = require('../models');
const failure = (message, statusCode = 422) => Object.assign(new Error(message), { statusCode });

async function updateActionPlanMetadata({ id, body, actorId, onAudit }) {
  try {
    return await sequelize.transaction(async transaction => {
      const plan = await StrategicActionPlan.findByPk(id, { transaction, lock: transaction.LOCK.UPDATE });
      if (!plan || plan.deleted_at) throw failure('Plan no encontrado.', 404);
      const previous = plan.toJSON();
      const code = Object.hasOwn(body, 'code') ? String(body.code || '').trim().toUpperCase() : plan.code;
      const title = Object.hasOwn(body, 'title') ? String(body.title || '').trim() : plan.title;
      if (!code || code.length > 80) throw failure('El código del plan debe tener entre 1 y 80 caracteres.');
      if (!title || title.length > 300) throw failure('El título del plan debe tener entre 1 y 300 caracteres.');
      if (code !== plan.code) {
        const collision = await StrategicActionPlan.findOne({ where: { code, id: { [Op.ne]: plan.id } }, transaction });
        if (collision) throw failure(`El código ${code} ya pertenece a otro plan. Para asignar el responsable, conserve el código actual (${plan.code}) o elija un código diferente.`, 409);
      }
      let user = null;
      if (Object.hasOwn(body, 'responsible_user_id')) {
        const userId = Number(body.responsible_user_id);
        if (!Number.isSafeInteger(userId) || userId <= 0) throw failure('Seleccione un líder responsable activo de la lista.');
        user = await User.findOne({ where: { id: userId, estado: 'activo' }, transaction });
        if (!user) throw failure('El responsable seleccionado no existe o no está activo. Seleccione otro usuario.');
      }
      let leader = null;
      if (user) {
        // Keep the annual reference and the plan-specific assignment coherent.
        // Closing previous assignments preserves who was responsible before.
        await sequelize.query('SELECT pg_advisory_xact_lock(hashtext(:key))', { replacements: { key: `action-plan-leader:${plan.term_id}:${plan.catalog_item_id}` }, transaction });
        const today = new Date().toISOString().slice(0, 10);
        for (const [type, planId] of [['reference_leader', null], ['action_plan_leader', plan.id]]) {
          const active = await StrategicResponsibility.findAll({ where: { term_id: plan.term_id, catalog_item_id: plan.catalog_item_id, action_plan_id: planId, responsibility_type: type, status: 'active' }, order: [['created_at', 'DESC']], transaction, lock: transaction.LOCK.UPDATE });
          let selected = active.find(row => Number(row.user_id) === user.id);
          const predecessor = active.find(row => String(row.id) === String(plan.responsibility_id)) || active[0];
          for (const row of active) if (!selected || row.id !== selected.id) await row.update({ status: 'transferred', ends_on: today, transferred_at: new Date(), ended_by: actorId, transfer_reason: 'Actualización de responsable desde el plan de acción' }, { transaction });
          if (!selected) selected = await StrategicResponsibility.create({ term_id: plan.term_id, catalog_item_id: plan.catalog_item_id, action_plan_id: planId, responsibility_type: type, user_id: user.id, starts_on: today, ends_on: null, status: 'active', predecessor_id: predecessor?.id || null, created_by: actorId }, { transaction });
          if (type === 'action_plan_leader') leader = selected;
        }
      }
      const metadata = body.metadata ? { ...plan.metadata, ...body.metadata, form_schema: plan.metadata?.form_schema } : plan.metadata;
      await plan.update({ code, title, ...(user ? { responsible_user_id: user.id, responsibility_id: leader.id } : {}), metadata, updated_by: actorId }, { transaction });
      if (onAudit) await onAudit(previous, plan, transaction);
      return plan;
    });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') throw failure('El código del plan ya está registrado. Conserve el código actual para asignar el responsable o elija uno diferente.', 409);
    throw error;
  }
}
module.exports = { updateActionPlanMetadata };
