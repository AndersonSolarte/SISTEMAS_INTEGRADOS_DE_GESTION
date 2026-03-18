const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DocumentoFavorito = sequelize.define('documento_favoritos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  documento_id: { type: DataTypes.INTEGER, allowNull: false }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['user_id', 'documento_id'] }
  ]
});

module.exports = DocumentoFavorito;
