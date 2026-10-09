const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JuridicaHistorial = sequelize.define('juridica_historial', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  caso_id: { type: DataTypes.BIGINT, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  evento: { type: DataTypes.STRING(80), allowNull: false },
  estado_anterior: { type: DataTypes.STRING(60), allowNull: true },
  estado_nuevo: { type: DataTypes.STRING(60), allowNull: true },
  comentario: { type: DataTypes.TEXT, allowNull: true },
  datos: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['caso_id'] }, { fields: ['usuario_id'] }]
});

module.exports = JuridicaHistorial;
