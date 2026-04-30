const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const AutoevaluacionPrograma = sequelize.define('autoevaluacion_programas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  programa: { type: DataTypes.STRING(500), allowNull: false },
  proceso_autoevaluacion: { type: DataTypes.STRING(180), allowNull: true },
  facultad: { type: DataTypes.STRING(500), allowNull: true },
  nivel_formacion: { type: DataTypes.STRING(180), allowNull: true },
  renovacion_registro_calificado: { type: DataTypes.STRING(180), allowNull: true },
  codigo_snies: { type: DataTypes.STRING(80), allowNull: true },
  titulo_otorga: { type: DataTypes.STRING(500), allowNull: true },
  email_programa: { type: DataTypes.STRING(300), allowNull: true },
  duracion_formacion: { type: DataTypes.STRING(180), allowNull: true },
  numero_creditos: { type: DataTypes.STRING(80), allowNull: true },
  estudiantes_primer_curso: { type: DataTypes.STRING(80), allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = AutoevaluacionPrograma;
