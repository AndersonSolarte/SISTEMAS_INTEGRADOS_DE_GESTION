const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RegistroCalificadoResolucion = sequelize.define('registros_calificados_resoluciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  consecutivo: { type: DataTypes.STRING(30), allowNull: true },
  nivel_formacion: { type: DataTypes.STRING(160), allowNull: true },
  codigo_snies: { type: DataTypes.STRING(60), allowNull: true },
  nombre_programa: { type: DataTypes.STRING(500), allowNull: false },
  numero_estudiantes: { type: DataTypes.INTEGER, allowNull: true },
  creditos: { type: DataTypes.INTEGER, allowNull: true },
  semestres: { type: DataTypes.INTEGER, allowNull: true },
  numero_resolucion: { type: DataTypes.STRING(160), allowNull: true },
  enlace_resolucion: { type: DataTypes.TEXT, allowNull: true },
  fecha_rrc: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_vencimiento_rc: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_maxima_documento_rrc: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_sugerida_radicar_saces: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_maxima_radicar_saces: { type: DataTypes.STRING(120), allowNull: true },
  fecha_registro_calificado: { type: DataTypes.STRING(120), allowNull: true },
  novedades_vigencia: { type: DataTypes.TEXT, allowNull: true },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  estado_ciclo: { type: DataTypes.STRING(80), allowNull: true },
  decision_tipo: { type: DataTypes.STRING(80), allowNull: true },
  acto_administrativo_no_renovacion: { type: DataTypes.STRING(255), allowNull: true },
  fecha_acto_administrativo: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_limite_radicar_contingencia: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_radicacion_contingencia: { type: DataTypes.DATEONLY, allowNull: true },
  estado_contingencia: { type: DataTypes.STRING(80), allowNull: true },
  fecha_inicio_contingencia: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_fin_contingencia: { type: DataTypes.DATEONLY, allowNull: true },
  contingencia_observaciones: { type: DataTypes.TEXT, allowNull: true },
  resolucion_renovacion_nueva: { type: DataTypes.STRING(160), allowNull: true },
  fecha_renovacion_nueva: { type: DataTypes.DATEONLY, allowNull: true },
  conserva_denominacion: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
  historial_denominaciones: { type: DataTypes.JSONB, allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RegistroCalificadoResolucion;
