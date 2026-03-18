const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalDesercionCohorte = sequelize.define('poblacional_desercion_cohorte', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  periodo_referencia: { type: DataTypes.STRING(80), allowNull: true },
  tipo_desercion: { type: DataTypes.STRING(40), allowNull: true },
  corte_informacion: { type: DataTypes.STRING(120), allowNull: true },
  programa: { type: DataTypes.STRING(220), allowNull: true },
  desercion_nacional: { type: DataTypes.DECIMAL(14, 6), allowNull: true },
  desercion_departamental: { type: DataTypes.DECIMAL(14, 6), allowNull: true },
  desercion_institucional: { type: DataTypes.DECIMAL(14, 6), allowNull: true },
  desercion_programa: { type: DataTypes.DECIMAL(14, 6), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalDesercionCohorte;
