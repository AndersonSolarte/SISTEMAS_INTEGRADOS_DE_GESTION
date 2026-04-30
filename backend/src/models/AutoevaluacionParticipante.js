const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutoevaluacionParticipante = sequelize.define('autoevaluacion_participantes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  programa: { type: DataTypes.STRING(500), allowNull: false },
  alcance_autoevaluacion: { type: DataTypes.STRING(120), allowNull: false },
  acta_inicio_url: { type: DataTypes.TEXT, allowNull: true },
  cronograma_url: { type: DataTypes.TEXT, allowNull: true },
  nombres_completos: { type: DataTypes.STRING(500), allowNull: false },
  documento: { type: DataTypes.STRING(40), allowNull: true },
  cargo: { type: DataTypes.STRING(300), allowNull: true },
  rol_en_proceso: { type: DataTypes.STRING(300), allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = AutoevaluacionParticipante;
