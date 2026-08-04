const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DesplazamientoViaticosSolicitud = sequelize.define('desplazamiento_viaticos_solicitudes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  consecutivo: { type: DataTypes.STRING(50), allowNull: false, unique: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  documento_id: { type: DataTypes.INTEGER, allowNull: true },
  jefe_inmediato_user_id: { type: DataTypes.INTEGER, allowNull: true },
  estado: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'pendiente_aprobacion_jefe' },
  paso_actual: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  solicitante_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  jefe_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  datos_laborales: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  datos_salida: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  datos_viaticos: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  plan_aprobacion: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  liquidacion: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  token_accion_hash: { type: DataTypes.STRING(128), allowNull: true },
  token_etapa: { type: DataTypes.STRING(50), allowNull: true },
  trazabilidad: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  finalizado_at: { type: DataTypes.DATE, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['estado'] },
    { fields: ['created_at'] }
  ]
});

module.exports = DesplazamientoViaticosSolicitud;
