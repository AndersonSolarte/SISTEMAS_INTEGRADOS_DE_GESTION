const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecursoHumanoOnda = sequelize.define('recurso_humano_ondas', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo: { type: DataTypes.STRING(40), allowNull: true },
  nombre: { type: DataTypes.STRING(220), allowNull: true },
  genero: { type: DataTypes.STRING(60), allowNull: true },
  fecha_corte: { type: DataTypes.STRING(80), allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RecursoHumanoOnda;
