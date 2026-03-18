const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const TipoDocumentacion = sequelize.define('tipos_documentacion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  nombre: { type: DataTypes.STRING(100), allowNull: false, unique: true }
}, { timestamps: false });

module.exports = TipoDocumentacion;