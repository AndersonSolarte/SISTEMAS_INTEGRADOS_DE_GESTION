const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanMejoramientoAsignacion = sequelize.define('plan_mejoramiento_asignaciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  plan_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  estado_flujo: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'asignado' },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  asignado_por: { type: DataTypes.INTEGER, allowNull: true },
  asignado_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  ultima_observacion: { type: DataTypes.TEXT, allowNull: true }
}, {
  indexes: [
    { fields: ['plan_id', 'activo'] },
    { fields: ['user_id', 'activo'] },
    { fields: ['estado_flujo'] }
  ]
});

module.exports = PlanMejoramientoAsignacion;
