const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GeorreferenciaMunicipio = sequelize.define('georreferencia_municipios', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  codigo_departamento: { type: DataTypes.STRING(10), allowNull: false },
  codigo_municipio: { type: DataTypes.STRING(10), allowNull: false },
  nombre_municipio: { type: DataTypes.STRING(160), allowNull: false },
  nombre_normalizado: { type: DataTypes.STRING(160), allowNull: false },
  latitud: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
  longitud: { type: DataTypes.DECIMAL(10, 6), allowNull: true },
  fuente: { type: DataTypes.STRING(120), allowNull: true },
  vigente: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = GeorreferenciaMunicipio;
