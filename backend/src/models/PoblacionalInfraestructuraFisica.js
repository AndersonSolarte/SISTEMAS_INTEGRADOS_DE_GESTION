const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalInfraestructuraFisica = sequelize.define('poblacional_infraestructura_fisicas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  campus: { type: DataTypes.STRING(120), allowNull: false },
  componente: { type: DataTypes.STRING(200), allowNull: true },
  tipo_area: { type: DataTypes.STRING(120), allowNull: true },
  tenencia: { type: DataTypes.STRING(120), allowNull: true },
  ubicacion: { type: DataTypes.STRING(255), allowNull: true },
  nomenclatura: { type: DataTypes.STRING(120), allowNull: true },
  piso_no: { type: DataTypes.INTEGER, allowNull: true },
  tipo_espacio: { type: DataTypes.STRING(200), allowNull: true },
  asignacion: { type: DataTypes.STRING(255), allowNull: true },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  funcion_especifica: { type: DataTypes.STRING(255), allowNull: true },
  capacidad_fisica: { type: DataTypes.INTEGER, allowNull: true, defaultValue: 0 },
  area_metros2: { type: DataTypes.DECIMAL(12, 4), allowNull: true, defaultValue: 0.0 },
  fecha_actualizacion: { type: DataTypes.STRING(120), allowNull: true },
  acceso_autonomo: { type: DataTypes.STRING(20), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalInfraestructuraFisica;
