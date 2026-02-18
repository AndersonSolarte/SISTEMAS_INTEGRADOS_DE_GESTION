const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Proceso = sequelize.define('procesos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  macro_proceso_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'macro_procesos', key: 'id' } },
  nombre: { type: DataTypes.STRING(200), allowNull: false }
}, { timestamps: false });

module.exports = Proceso;