const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalCantidadTotalEgresado = sequelize.define('cantidad_total_egresados', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  programa: { type: DataTypes.STRING(220), allowNull: true },
  cantidad: { type: DataTypes.INTEGER, allowNull: true },
  detalle: { type: DataTypes.STRING(220), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalCantidadTotalEgresado;
