const { Op } = require('sequelize');
const { UserModulePermission } = require('../models');

const requireStrategicPermission = (...keys) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'No autorizado' });
  if (req.user.role === 'administrador') return next();
  if (keys.length === 0) return next();
  const requested = Array.from(new Set(keys));
  const permission = await UserModulePermission.findOne({
    where: { user_id: req.user.id, module_key: { [Op.in]: requested }, can_view: true }
  }).catch(() => null);
  const planningRoles = ['planeacion_efectividad', 'planeacion_estrategica'];
  const hasExplicitPeiConfiguration = await UserModulePermission.count({
    where: { user_id: req.user.id, module_key: { [Op.like]: 'pei_%' } }
  }).catch(() => 0);
  if (permission || (!hasExplicitPeiConfiguration && planningRoles.includes(req.user.role))) return next();

  // Si la operación es sobre un ítem o plan y el usuario autenticado es el responsable asignado:
  if (req.params.itemId || req.params.id) {
    try {
      const { StrategicActionItem, StrategicActionPlan } = require('../models');
      let plan = null;
      if (req.params.itemId) {
        const item = await StrategicActionItem.findByPk(req.params.itemId, {
          include: [{ model: StrategicActionPlan, as: 'actionPlan' }]
        });
        plan = item?.actionPlan;
      } else if (req.params.id) {
        plan = await StrategicActionPlan.findByPk(req.params.id);
      }
      if (plan && (String(plan.responsible_user_id) === String(req.user.id) || String(plan.user_id) === String(req.user.id))) {
        return next();
      }
    } catch (_) {}
  }

  return res.status(403).json({ success: false, message: 'No tiene el permiso requerido para esta operación de Planeación Estratégica.' });
};

module.exports = { requireStrategicPermission };
