const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaberProResultadoIndividual = sequelize.define('saber_pro_resultados_individuales', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  tipo_prueba: { type: DataTypes.STRING(30), allowNull: true },
  tipo_documento: { type: DataTypes.STRING(40), allowNull: true },
  documento: { type: DataTypes.STRING(80), allowNull: true },
  nombre: { type: DataTypes.STRING(220), allowNull: true },
  numero_registro: { type: DataTypes.STRING(80), allowNull: true },
  tipo_evaluado: { type: DataTypes.STRING(20), allowNull: true },
  snies_programa_academico: { type: DataTypes.STRING(40), allowNull: true },
  programa: { type: DataTypes.STRING(220), allowNull: true },
  ciudad: { type: DataTypes.STRING(120), allowNull: true },
  grupo_referencia: { type: DataTypes.STRING(180), allowNull: true },
  puntaje_global: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  percentil_nacional_global: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  percentil_grupo_referencia: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  modulo: { type: DataTypes.STRING(180), allowNull: true },
  puntaje_modulo: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  nivel_desempeno: { type: DataTypes.STRING(40), allowNull: true },
  percentil_nacional_modulo: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  percentil_grupo_referencia_modulo: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  novedades: { type: DataTypes.STRING(220), allowNull: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo: { type: DataTypes.STRING(40), allowNull: true },
  periodo_icfes: { type: DataTypes.STRING(40), allowNull: true },
  lugar_presentacion: { type: DataTypes.STRING(180), allowNull: true },
  modalidad: { type: DataTypes.STRING(120), allowNull: true },
  competencias: { type: DataTypes.STRING(120), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = SaberProResultadoIndividual;
