const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanMejoramientoFlujoHistorial = sequelize.define('plan_mejoramiento_flujo_historial', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  asignacion_id: { type: DataTypes.INTEGER, allowNull: false },
  plan_id: { type: DataTypes.INTEGER, allowNull: false },
  actor_user_id: { type: DataTypes.INTEGER, allowNull: true },
  accion: { type: DataTypes.STRING(60), allowNull: false },
  estado_anterior: { type: DataTypes.STRING(40), allowNull: true },
  estado_nuevo: { type: DataTypes.STRING(40), allowNull: false },
  observacion: { type: DataTypes.TEXT, allowNull: true },
  actor_nombre: { type: DataTypes.STRING(160), allowNull: true }
}, {
  indexes: [
    { fields: ['asignacion_id', 'created_at'] },
    { fields: ['plan_id'] }
  ]
});

module.exports = PlanMejoramientoFlujoHistorial;
