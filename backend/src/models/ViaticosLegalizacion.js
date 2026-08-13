const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ViaticosLegalizacion = sequelize.define('viaticos_legalizaciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  solicitud_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  codigo_verificacion: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
  estado: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'pendiente_habilitacion' },
  fecha_habilitacion: { type: DataTypes.DATEONLY, allowNull: false },
  fecha_limite: { type: DataTypes.DATEONLY, allowNull: false },
  detalles: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  adjuntos: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  trazabilidad: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  presentado_at: { type: DataTypes.DATE, allowNull: true },
  revisado_at: { type: DataTypes.DATE, allowNull: true },
  revisado_por: { type: DataTypes.INTEGER, allowNull: true },
  finalizado_at: { type: DataTypes.DATE, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['solicitud_id'], unique: true },
    { fields: ['user_id'] },
    { fields: ['estado'] },
    { fields: ['fecha_limite'] }
  ]
});

module.exports = ViaticosLegalizacion;
