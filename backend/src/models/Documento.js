const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Documento = sequelize.define('documentos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  subproceso_id: { type: DataTypes.INTEGER, allowNull: false },
  tipo_documentacion_id: { type: DataTypes.INTEGER, allowNull: false },
  macroproceso: DataTypes.STRING(255),
  proceso_texto: { type: DataTypes.STRING(255), field: 'proceso' },
  subproceso_texto: { type: DataTypes.STRING(255), field: 'subproceso' },
  tipo_documento: DataTypes.STRING(200),
  codigo: { type: DataTypes.STRING(50), allowNull: false },
  titulo: { type: DataTypes.STRING(300), allowNull: false },
  version: DataTypes.STRING(20),
  fecha_creacion: DataTypes.DATEONLY,
  revisa: DataTypes.STRING(200),
  aprueba: DataTypes.STRING(200),
  fecha_aprobacion: DataTypes.DATEONLY,
  autor: DataTypes.STRING(200),
  estado: { type: DataTypes.ENUM('vigente', 'obsoleto', 'en_revision'), allowNull: false, defaultValue: 'vigente' },
  link_acceso: DataTypes.TEXT,
  observaciones: DataTypes.TEXT,
  orden_origen: DataTypes.INTEGER,
  fila_origen: DataTypes.INTEGER,
  datos_originales: DataTypes.JSONB
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = Documento;
