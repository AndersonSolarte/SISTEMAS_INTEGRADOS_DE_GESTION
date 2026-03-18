const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Estadistica = sequelize.define('estadisticas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  categoria: { type: DataTypes.STRING(120), allowNull: false },
  subcategoria: { type: DataTypes.STRING(120), allowNull: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  programa: { type: DataTypes.STRING(500), allowNull: true },
  dependencia: { type: DataTypes.STRING(500), allowNull: true },
  indicador: { type: DataTypes.STRING(500), allowNull: false },
  valor: { type: DataTypes.DECIMAL(14, 2), allowNull: false, defaultValue: 0 },
  unidad: { type: DataTypes.STRING(60), allowNull: true },
  fuente: { type: DataTypes.STRING(500), allowNull: true },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = Estadistica;
