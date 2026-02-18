const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MacroProceso = sequelize.define('macro_procesos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(200), allowNull: false, unique: true }
}, { timestamps: false });

module.exports = MacroProceso;