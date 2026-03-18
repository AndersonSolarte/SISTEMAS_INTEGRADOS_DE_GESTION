const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalEmpleabilidad = sequelize.define('poblacional_empleabilidad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  ies: { type: DataTypes.STRING(220), allowNull: true },
  empleabilidad_programa: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
  empleabilidad_nacional: { type: DataTypes.DECIMAL(14, 4), allowNull: true },
  denominacion_programa: { type: DataTypes.STRING(260), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalEmpleabilidad;
