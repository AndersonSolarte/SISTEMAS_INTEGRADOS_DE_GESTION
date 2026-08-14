const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ViaticosLegalizacionAdjunto = sequelize.define('viaticos_legalizacion_adjuntos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  legalizacion_id: { type: DataTypes.INTEGER, allowNull: false },
  concepto_id: { type: DataTypes.STRING(120), allowNull: true },
  detalle: { type: DataTypes.STRING(500), allowNull: true },
  storage_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  nombre_original: { type: DataTypes.STRING(500), allowNull: false },
  mime_type: { type: DataTypes.STRING(120), allowNull: false },
  extension: { type: DataTypes.STRING(20), allowNull: true },
  tamano_bytes: { type: DataTypes.BIGINT, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  contenido: { type: DataTypes.BLOB, allowNull: false },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['legalizacion_id'] },
    { fields: ['concepto_id'] },
    { unique: true, fields: ['storage_key'] },
    { fields: ['sha256'] }
  ]
});

module.exports = ViaticosLegalizacionAdjunto;
