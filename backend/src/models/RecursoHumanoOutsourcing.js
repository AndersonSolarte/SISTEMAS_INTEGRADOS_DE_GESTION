const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecursoHumanoOutsourcing = sequelize.define('recurso_humano_outsourcing', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo: { type: DataTypes.STRING(40), allowNull: true },
  cargo: { type: DataTypes.STRING(220), allowNull: true },
  genero_biologico: { type: DataTypes.STRING(60), allowNull: true },
  cantidad: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RecursoHumanoOutsourcing;
