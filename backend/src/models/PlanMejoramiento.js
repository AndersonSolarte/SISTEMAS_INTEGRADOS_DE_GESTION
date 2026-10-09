const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanMejoramiento = sequelize.define('planes_mejoramiento', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  programa: { type: DataTypes.STRING(500), allowNull: false },
  periodo_inicio: { type: DataTypes.INTEGER, allowNull: false },
  periodo_fin: { type: DataTypes.INTEGER, allowNull: false },
  estado: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'borrador' },
  contenido: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
}, {
  indexes: [
    { fields: ['programa'] },
    { fields: ['estado'] },
    { fields: ['periodo_inicio', 'periodo_fin'] }
  ]
});

module.exports = PlanMejoramiento;
