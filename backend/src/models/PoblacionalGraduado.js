const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalGraduado = sequelize.define('poblacional_graduados', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  nombre_ies: { type: DataTypes.STRING(180), allowNull: true },
  tipo_documento: { type: DataTypes.STRING(80), allowNull: true },
  numero_documento: { type: DataTypes.STRING(80), allowNull: true },
  primer_nombre: { type: DataTypes.STRING(120), allowNull: true },
  segundo_nombre: { type: DataTypes.STRING(120), allowNull: true },
  primer_apellido: { type: DataTypes.STRING(120), allowNull: true },
  segundo_apellido: { type: DataTypes.STRING(120), allowNull: true },
  programa: { type: DataTypes.STRING(180), allowNull: true },
  departamento: { type: DataTypes.STRING(120), allowNull: true },
  municipio: { type: DataTypes.STRING(120), allowNull: true },
  no_acta_grado: { type: DataTypes.STRING(120), allowNull: true },
  fecha_grado: { type: DataTypes.STRING(80), allowNull: true },
  folio: { type: DataTypes.STRING(60), allowNull: true },
  verificado: { type: DataTypes.STRING(40), allowNull: true },
  genero_biologico: { type: DataTypes.STRING(80), allowNull: true },
  periodo: { type: DataTypes.STRING(20), allowNull: true },
  facultad: { type: DataTypes.STRING(180), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalGraduado;
