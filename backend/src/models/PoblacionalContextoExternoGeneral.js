const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalContextoExternoGeneral = sequelize.define('poblacional_contexto_externo_general', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  seccion: { type: DataTypes.STRING(30), allowNull: false },
  hoja_fuente: { type: DataTypes.STRING(40), allowNull: false },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  semestre: { type: DataTypes.INTEGER, allowNull: true },
  periodo_referencia: { type: DataTypes.STRING(20), allowNull: true },
  programa: { type: DataTypes.STRING(320), allowNull: true },
  inscritos_nacional: { type: DataTypes.BIGINT, allowNull: true },
  inscritos_regional: { type: DataTypes.BIGINT, allowNull: true },
  admitidos_nacional: { type: DataTypes.BIGINT, allowNull: true },
  admitidos_regional: { type: DataTypes.BIGINT, allowNull: true },
  primer_curso_nacional: { type: DataTypes.BIGINT, allowNull: true },
  primer_curso_regional: { type: DataTypes.BIGINT, allowNull: true },
  matriculados_nacional: { type: DataTypes.BIGINT, allowNull: true },
  matriculados_regional: { type: DataTypes.BIGINT, allowNull: true },
  graduados_nacional: { type: DataTypes.BIGINT, allowNull: true },
  graduados_regional: { type: DataTypes.BIGINT, allowNull: true },
  sector: { type: DataTypes.STRING(80), allowNull: true },
  reconocimiento_men: { type: DataTypes.STRING(160), allowNull: true },
  area_conocimiento: { type: DataTypes.STRING(320), allowNull: true },
  institucion: { type: DataTypes.STRING(320), allowNull: true },
  nombre_programa: { type: DataTypes.STRING(320), allowNull: true },
  modalidad: { type: DataTypes.STRING(80), allowNull: true },
  numero_creditos: { type: DataTypes.INTEGER, allowNull: true },
  numero_semestres: { type: DataTypes.INTEGER, allowNull: true },
  municipio: { type: DataTypes.STRING(160), allowNull: true },
  georeferencia: { type: DataTypes.STRING(40), allowNull: true },
  departamento: { type: DataTypes.STRING(160), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalContextoExternoGeneral;
