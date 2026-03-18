const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SubProceso = sequelize.define('subprocesos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  proceso_id: { type: DataTypes.INTEGER, allowNull: false, references: { model: 'procesos', key: 'id' } },
  nombre: { type: DataTypes.STRING(200), allowNull: false }
}, { timestamps: false });

module.exports = SubProceso;