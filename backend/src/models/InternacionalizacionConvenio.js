const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InternacionalizacionConvenio = sequelize.define('internacionalizacion_convenios', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  convenio_entidad: { type: DataTypes.STRING(400), allowNull: true },
  tipo_convenio: { type: DataTypes.STRING(180), allowNull: true },
  programa_gestor: { type: DataTypes.STRING(300), allowNull: true },
  objeto_convenio: { type: DataTypes.TEXT, allowNull: true },
  fecha_inicio: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_terminacion: { type: DataTypes.DATEONLY, allowNull: true },
  link_anexo: { type: DataTypes.TEXT, allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = InternacionalizacionConvenio;
