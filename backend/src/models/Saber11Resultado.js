const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Saber11Resultado = sequelize.define('resultados_saber11', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  documento: { type: DataTypes.STRING(80), allowNull: false },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  tipo_examen: { type: DataTypes.STRING(40), allowNull: true },
  lectura_critica: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  matematicas: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  sociales: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  biologia: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  fisica: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  quimica: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  lenguaje: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  filosofia: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  historia: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  geografia: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  ingles: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  /* Columnas para tipos de examen adicionales */
  espanol_y_literatura: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  conocimiento_matematico: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  aptitud_matematica: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  electiva: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  ciencias_naturales: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  razonamiento_cuantitativo: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  competencias_ciudadanas: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  sociales_y_ciudadana: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  global: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  tipo_prueba: { type: DataTypes.STRING(20), allowNull: true },
  fecha_carga: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  usuario: { type: DataTypes.STRING(160), allowNull: true },
  nombre_archivo: { type: DataTypes.STRING(260), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
}, {
  indexes: [
    { unique: true, fields: ['documento', 'anio'], name: 'uq_resultados_saber11_documento_anio' },
    { fields: ['anio'], name: 'idx_resultados_saber11_anio' },
    { fields: ['tipo_prueba'], name: 'idx_resultados_saber11_tipo_prueba' }
  ]
});

module.exports = Saber11Resultado;
