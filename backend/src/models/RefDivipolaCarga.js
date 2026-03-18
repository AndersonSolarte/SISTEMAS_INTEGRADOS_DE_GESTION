const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefDivipolaCarga = sequelize.define('ref_divipola_cargas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  version_carga: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  fuente_archivo: { type: DataTypes.STRING(320), allowNull: false },
  hash_archivo: { type: DataTypes.STRING(128), allowNull: false },
  total_departamentos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_municipios: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  estado: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'completado' },
  detalle: { type: DataTypes.TEXT, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RefDivipolaCarga;
