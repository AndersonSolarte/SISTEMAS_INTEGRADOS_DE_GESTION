const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RegistroCalificadoHistorico = sequelize.define('registros_calificados_historico_rc', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  programa_academico: { type: DataTypes.STRING(500), allowNull: false },
  nivel: { type: DataTypes.STRING(160), allowNull: true },
  tipo_aprobacion: { type: DataTypes.STRING(260), allowNull: true },
  resolucion_men: { type: DataTypes.STRING(80), allowNull: true },
  fecha_resolucion: { type: DataTypes.DATEONLY, allowNull: true },
  resolucion_rc: { type: DataTypes.STRING(500), allowNull: true },
  plan_estudios: { type: DataTypes.STRING(500), allowNull: true },
  enlace: { type: DataTypes.TEXT, allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RegistroCalificadoHistorico;
