const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const MatriculadosUbicacionIncidencia = sequelize.define('matriculados_ubicacion_incidencias', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  matriculado_id: { type: DataTypes.INTEGER, allowNull: false },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo: { type: DataTypes.STRING(20), allowNull: true },
  departamento_fuente: { type: DataTypes.STRING(220), allowNull: true },
  municipio_fuente: { type: DataTypes.STRING(220), allowNull: true },
  codigo_departamento_sugerido: { type: DataTypes.STRING(2), allowNull: true },
  codigo_municipio_sugerido: { type: DataTypes.STRING(5), allowNull: true },
  confianza: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'sin_match' },
  metodo: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'sin_match' },
  score: { type: DataTypes.DECIMAL(6, 3), allowNull: true },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'pendiente' },
  observacion: { type: DataTypes.TEXT, allowNull: true },
  resuelto_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = MatriculadosUbicacionIncidencia;
