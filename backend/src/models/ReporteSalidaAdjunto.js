const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReporteSalidaAdjunto = sequelize.define('reporte_salida_adjuntos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  solicitud_id: { type: DataTypes.INTEGER, allowNull: true },
  uploaded_by_user_id: { type: DataTypes.INTEGER, allowNull: true },
  storage_key: { type: DataTypes.STRING(255), allowNull: false, unique: true },
  nombre_original: { type: DataTypes.STRING(500), allowNull: false },
  mime_type: { type: DataTypes.STRING(120), allowNull: false },
  extension: { type: DataTypes.STRING(20), allowNull: true },
  tamano_bytes: { type: DataTypes.BIGINT, allowNull: false },
  sha256: { type: DataTypes.STRING(64), allowNull: false },
  contenido: { type: DataTypes.BLOB, allowNull: false },
  origen: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'formulario' },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['solicitud_id'] },
    { fields: ['uploaded_by_user_id'] },
    { unique: true, fields: ['storage_key'] },
    { fields: ['sha256'] }
  ]
});

module.exports = ReporteSalidaAdjunto;
