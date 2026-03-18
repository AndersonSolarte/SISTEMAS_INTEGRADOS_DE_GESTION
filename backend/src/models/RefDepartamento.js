const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefDepartamento = sequelize.define('ref_departamentos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo_dane: { type: DataTypes.STRING(2), allowNull: false, unique: true },
  nombre_oficial: { type: DataTypes.STRING(180), allowNull: false },
  nombre_normalizado: { type: DataTypes.STRING(180), allowNull: false },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  vigencia_desde: { type: DataTypes.DATEONLY, allowNull: true },
  vigencia_hasta: { type: DataTypes.DATEONLY, allowNull: true },
  version_carga: { type: DataTypes.STRING(40), allowNull: true }
});

module.exports = RefDepartamento;
