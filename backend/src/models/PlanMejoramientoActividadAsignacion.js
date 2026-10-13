const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanMejoramientoActividadAsignacion = sequelize.define('plan_mejoramiento_actividad_asignaciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plan_id: { type: DataTypes.INTEGER, allowNull: false },
  actividad_uid: { type: DataTypes.STRING(120), allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  estado_flujo: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'asignada' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  asignado_por: { type: DataTypes.INTEGER, allowNull: true },
  ultima_observacion: { type: DataTypes.TEXT, allowNull: true },
  historial: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  correcciones: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
}, {
  indexes: [
    { name: 'pm_act_plan_uid_active_idx', fields: ['plan_id', 'actividad_uid', 'activo'] },
    { name: 'pm_act_user_active_idx', fields: ['user_id', 'activo'] },
    { name: 'pm_act_state_idx', fields: ['estado_flujo'] }
  ]
});

module.exports = PlanMejoramientoActividadAsignacion;
