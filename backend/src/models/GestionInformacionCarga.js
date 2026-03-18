const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GestionInformacionCarga = sequelize.define('gestion_informacion_cargas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  categoria: { type: DataTypes.STRING(120), allowNull: false },
  subcategoria: { type: DataTypes.STRING(120), allowNull: true },
  variable: { type: DataTypes.STRING(500), allowNull: false },
  archivo_nombre: { type: DataTypes.STRING(260), allowNull: true },
  total_plantilla: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_cargados: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  total_omitidos: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  porcentaje_cargado: { type: DataTypes.DECIMAL(5, 2), allowNull: false, defaultValue: 0 },
  estado: { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'parcial' },
  detalle: { type: DataTypes.TEXT, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = GestionInformacionCarga;
