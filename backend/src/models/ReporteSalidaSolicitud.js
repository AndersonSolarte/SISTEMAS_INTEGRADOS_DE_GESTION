const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const ReporteSalidaSolicitud = sequelize.define('reporte_salida_solicitudes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  consecutivo: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  documento_id: { type: DataTypes.INTEGER, allowNull: false },
  jefe_inmediato_user_id: { type: DataTypes.INTEGER, allowNull: false },
  estado: {
    type: DataTypes.ENUM(
      'pendiente_aprobacion_jefe',
      'aprobada_jefe',
      'pendiente_aprobacion_gestion_humana',
      'aprobada_gestion_humana',
      'finalizada',
      'no_aprobada'
    ),
    allowNull: false,
    defaultValue: 'pendiente_aprobacion_jefe'
  },
  solicitante_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  jefe_snapshot: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  datos_formulario: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  tiempo_solicitado_minutos: { type: DataTypes.INTEGER, allowNull: true },
  reposicion_aplica: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  reposicion_minutos: { type: DataTypes.INTEGER, allowNull: true },
  reposicion_estado: {
    type: DataTypes.ENUM('no_aplica', 'pendiente', 'programada', 'cumplida', 'incumplida'),
    allowNull: false,
    defaultValue: 'no_aplica'
  },
  jefe_aprobado_at: { type: DataTypes.DATE, allowNull: true },
  gestion_humana_aprobado_at: { type: DataTypes.DATE, allowNull: true },
  enviado_sst_at: { type: DataTypes.DATE, allowNull: true },
  finalizado_at: { type: DataTypes.DATE, allowNull: true },
  pdf_generado_at: { type: DataTypes.DATE, allowNull: true },
  aprobacion_jefe_token_hash: { type: DataTypes.STRING(128), allowNull: true },
  aprobacion_gh_token_hash: { type: DataTypes.STRING(128), allowNull: true },
  correo_jefe_enviado_at: { type: DataTypes.DATE, allowNull: true },
  correo_gh_enviado_at: { type: DataTypes.DATE, allowNull: true },
  correo_usuario_enviado_at: { type: DataTypes.DATE, allowNull: true },
  correo_sst_enviado_at: { type: DataTypes.DATE, allowNull: true },
  observacion_gestion_humana: { type: DataTypes.TEXT, allowNull: true },
  trazabilidad: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = ReporteSalidaSolicitud;
