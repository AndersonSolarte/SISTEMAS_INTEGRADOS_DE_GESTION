const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalEdificacionReferencia = sequelize.define('poblacional_edificaciones_referencia', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  espacio: { type: DataTypes.STRING(200), allowNull: false, unique: true },
  ubicacion: { type: DataTypes.STRING(120), allowNull: true },
  direccion: { type: DataTypes.STRING(255), allowNull: true },
  calidad: { type: DataTypes.STRING(120), allowNull: true }
});

module.exports = PoblacionalEdificacionReferencia;
