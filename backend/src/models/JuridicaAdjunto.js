const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JuridicaAdjunto = sequelize.define('juridica_adjuntos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  caso_id: { type: DataTypes.BIGINT, allowNull: false },
  usuario_id: { type: DataTypes.INTEGER, allowNull: true },
  tipo: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'soporte' },
  nombre_original: { type: DataTypes.STRING(500), allowNull: false },
  mime_type: { type: DataTypes.STRING(150), allowNull: false },
  tamano_bytes: { type: DataTypes.BIGINT, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  contenido: { type: DataTypes.BLOB, allowNull: false }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['caso_id'] }, { fields: ['usuario_id'] }, { fields: ['sha256'] }]
});

module.exports = JuridicaAdjunto;
