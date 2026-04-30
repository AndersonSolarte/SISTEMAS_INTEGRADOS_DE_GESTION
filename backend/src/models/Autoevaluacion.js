const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Autoevaluacion = sequelize.define('autoevaluacion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  acuerdo_men: { type: DataTypes.STRING(300), allowNull: true },
  programa: { type: DataTypes.STRING(500), allowNull: true },
  factor: { type: DataTypes.TEXT, allowNull: true },
  caracteristica: { type: DataTypes.TEXT, allowNull: true },
  aspectos_por_evaluar: { type: DataTypes.TEXT, allowNull: true },
  indicador: { type: DataTypes.TEXT, allowNull: true },
  instrumento: { type: DataTypes.STRING(300), allowNull: true },
  scrit: { type: DataTypes.STRING(300), allowNull: true },
  componente: { type: DataTypes.STRING(500), allowNull: true },
  calificacion_indicador: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  evidencias: { type: DataTypes.TEXT, allowNull: true },
  informacion_para_tener_en_cuenta: { type: DataTypes.TEXT, allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = Autoevaluacion;
