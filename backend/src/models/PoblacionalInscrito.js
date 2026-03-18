const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalInscrito = sequelize.define('poblacional_inscritos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  ies: { type: DataTypes.STRING(180), allowNull: true },
  documento: { type: DataTypes.STRING(80), allowNull: true },
  id_tipo_documento: { type: DataTypes.STRING(80), allowNull: true },
  primer_nombre: { type: DataTypes.STRING(120), allowNull: true },
  segundo_nombre: { type: DataTypes.STRING(120), allowNull: true },
  primer_apellido: { type: DataTypes.STRING(120), allowNull: true },
  segundo_apellido: { type: DataTypes.STRING(120), allowNull: true },
  programa: { type: DataTypes.STRING(180), allowNull: true },
  genero_biologico: { type: DataTypes.STRING(80), allowNull: true },
  conteo: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  periodo: { type: DataTypes.STRING(20), allowNull: true },
  facultad: { type: DataTypes.STRING(180), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalInscrito;
