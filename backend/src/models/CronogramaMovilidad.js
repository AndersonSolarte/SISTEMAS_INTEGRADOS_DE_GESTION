const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CronogramaMovilidad = sequelize.define('cronograma_movilidad', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_director: { type: DataTypes.INTEGER, allowNull: false },
  nombre_director: { type: DataTypes.STRING(200), allowNull: false },
  email_director: { type: DataTypes.STRING(200), allowNull: false },
  programa_academico: { type: DataTypes.STRING(250), allowNull: false },
  facultad: { type: DataTypes.STRING(250), allowNull: true },
  codigo_oficio: { type: DataTypes.STRING(100), allowNull: true },
  asunto_oficio: { type: DataTypes.TEXT, allowNull: true },
  cuerpo_oficio: { type: DataTypes.TEXT, allowNull: true },
  coordinador_practica: { type: DataTypes.STRING(200), allowNull: true },
  email_coordinador: { type: DataTypes.STRING(200), allowNull: true },
  telefono_coordinador: { type: DataTypes.STRING(50), allowNull: true },
  estado: {
    type: DataTypes.ENUM(
      'borrador',
      'radicado',
      'en_revision_academica',
      'en_revision_financiera',
      'devuelto_correccion',
      'aprobado',
      'cumplido',
      'cancelado'
    ),
    allowNull: false,
    defaultValue: 'borrador'
  },
  observaciones_correccion: { type: DataTypes.TEXT, allowNull: true },
  radicado_at: { type: DataTypes.DATE, allowNull: true },
  visto_bueno_academica_at: { type: DataTypes.DATE, allowNull: true },
  visto_bueno_academica_by: { type: DataTypes.STRING(200), allowNull: true },
  aprobado_financiera_at: { type: DataTypes.DATE, allowNull: true },
  aprobado_financiera_by: { type: DataTypes.STRING(200), allowNull: true },
  pdf_oficio_path: { type: DataTypes.STRING(500), allowNull: true },
  trazabilidad: { type: DataTypes.JSON, allowNull: true, defaultValue: [] }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true
});

module.exports = CronogramaMovilidad;
