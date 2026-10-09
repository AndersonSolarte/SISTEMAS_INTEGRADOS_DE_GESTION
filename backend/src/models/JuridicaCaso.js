const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const JuridicaCaso = sequelize.define('juridica_casos', {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  nri: { type: DataTypes.STRING(80), allowNull: false },
  radicado: { type: DataTypes.STRING(120), allowNull: true },
  fecha_ingreso: { type: DataTypes.DATEONLY, allowNull: false },
  accion: { type: DataTypes.STRING(250), allowNull: true },
  detalle: { type: DataTypes.STRING(250), allowNull: true },
  asunto: { type: DataTypes.TEXT, allowNull: false },
  grupo: { type: DataTypes.STRING(180), allowNull: true },
  clase: { type: DataTypes.STRING(180), allowNull: true },
  interesado: { type: DataTypes.STRING(300), allowNull: false },
  descripcion: { type: DataTypes.TEXT, allowNull: true },
  nivel: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'Media' },
  dependencia_solicitante: { type: DataTypes.STRING(300), allowNull: true },
  oficina: { type: DataTypes.STRING(300), allowNull: true },
  forma_recepcion: { type: DataTypes.STRING(80), allowNull: true },
  fecha_limite: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_asignacion: { type: DataTypes.DATE, allowNull: true },
  fecha_entrega_asesor: { type: DataTypes.DATE, allowNull: true },
  fecha_atencion: { type: DataTypes.DATE, allowNull: true },
  fecha_cierre: { type: DataTypes.DATE, allowNull: true },
  despacho: { type: DataTypes.STRING(300), allowNull: true },
  acta: { type: DataTypes.STRING(180), allowNull: true },
  observaciones: { type: DataTypes.TEXT, allowNull: true },
  origen: { type: DataTypes.STRING(120), allowNull: true },
  resultado: { type: DataTypes.TEXT, allowNull: true },
  devolucion: { type: DataTypes.TEXT, allowNull: true },
  estado: { type: DataTypes.STRING(60), allowNull: false, defaultValue: 'pendiente_clasificacion' },
  solicitante_id: { type: DataTypes.INTEGER, allowNull: true },
  responsable_id: { type: DataTypes.INTEGER, allowNull: true },
  secretario_id: { type: DataTypes.INTEGER, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['anio', 'nri'] },
    { fields: ['estado'] },
    { fields: ['responsable_id'] },
    { fields: ['fecha_ingreso'] },
    { fields: ['dependencia_solicitante'] }
  ]
});

module.exports = JuridicaCaso;
