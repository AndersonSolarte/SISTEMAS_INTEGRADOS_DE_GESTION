const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanMejoramientoTarifaVersion = sequelize.define('plan_mejoramiento_tarifa_versiones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(160), allowNull: false },
  vigencia: { type: DataTypes.INTEGER, allowNull: false },
  archivo_nombre: { type: DataTypes.STRING(255), allowNull: true },
  catalogo: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true }
}, {
  indexes: [
    { fields: ['activo'] },
    { fields: ['vigencia'] }
  ]
});

module.exports = PlanMejoramientoTarifaVersion;
