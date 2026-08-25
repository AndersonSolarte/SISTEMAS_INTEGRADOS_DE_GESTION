const { Op } = require('sequelize');
const { UserModulePermission } = require('../models');

const requireStrategicPermission = (...keys) => async (req, res, next) => {
  if (!req.user) return res.status(401).json({ success: false, message: 'No autorizado' });
  if (req.user.role === 'administrador') return next();
  const requested = Array.from(new Set(keys.length ? keys : ['plan_accion_nuevo']));
  const permission = await UserModulePermission.findOne({
    where: { user_id: req.user.id, module_key: { [Op.in]: requested }, can_view: true }
  }).catch(() => null);
  const planningRoles = ['planeacion_efectividad', 'planeacion_estrategica'];
  const hasExplicitPeiConfiguration = await UserModulePermission.count({
    where: { user_id: req.user.id, module_key: { [Op.like]: 'pei_%' } }
  }).catch(() => 0);
  if (permission || (!hasExplicitPeiConfiguration && planningRoles.includes(req.user.role))) return next();
  return res.status(403).json({ success: false, message: 'No tiene el permiso requerido para esta operación de Planeación Estratégica.' });
};

module.exports = { requireStrategicPermission };
