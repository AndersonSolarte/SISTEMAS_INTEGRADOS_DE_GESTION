const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RefMunicipio = sequelize.define('ref_municipios', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo_dane: { type: DataTypes.STRING(5), allowNull: false, unique: true },
  codigo_departamento: { type: DataTypes.STRING(2), allowNull: false },
  nombre_oficial: { type: DataTypes.STRING(220), allowNull: false },
  nombre_normalizado: { type: DataTypes.STRING(220), allowNull: false },
  tipo: { type: DataTypes.STRING(60), allowNull: true },
  latitud: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(11, 8), allowNull: true },
  activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  vigencia_desde: { type: DataTypes.DATEONLY, allowNull: true },
  vigencia_hasta: { type: DataTypes.DATEONLY, allowNull: true },
  version_carga: { type: DataTypes.STRING(40), allowNull: true }
});

module.exports = RefMunicipio;
