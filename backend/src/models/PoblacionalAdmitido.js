const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalAdmitido = sequelize.define('poblacional_admitidos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  nombre_ies: { type: DataTypes.STRING(180), allowNull: true },
  programa: { type: DataTypes.STRING(180), allowNull: true },
  tipo_documento: { type: DataTypes.STRING(80), allowNull: true },
  numero_documento: { type: DataTypes.STRING(80), allowNull: true },
  genero_biologico: { type: DataTypes.STRING(80), allowNull: true },
  conteo: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  periodo: { type: DataTypes.STRING(20), allowNull: true },
  facultad: { type: DataTypes.STRING(180), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalAdmitido;
