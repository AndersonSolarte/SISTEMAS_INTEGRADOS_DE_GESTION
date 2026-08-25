const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const CronogramaMovilidadActividad = sequelize.define('cronograma_movilidad_actividades', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  id_cronograma: { type: DataTypes.INTEGER, allowNull: false },
  fecha_salida: { type: DataTypes.DATEONLY, allowNull: false },
  fecha_regreso: { type: DataTypes.DATEONLY, allowNull: false },
  funciones: { type: DataTypes.TEXT, allowNull: false },
  alcance: { type: DataTypes.STRING(50), allowNull: true, defaultValue: 'Regional' },
  pais: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'COLOMBIA' },
  departamento: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'NARIÑO' },
  municipio: { type: DataTypes.STRING(100), allowNull: true },
  localidad_texto: { type: DataTypes.STRING(250), allowNull: false },
  entidad_destino: { type: DataTypes.STRING(255), allowNull: true, defaultValue: '' },
  contexto_practica: { type: DataTypes.TEXT, allowNull: false },
  responsables: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  estudiantes: { type: DataTypes.JSON, allowNull: false, defaultValue: [] },
  hora_salida: { type: DataTypes.STRING(20), allowNull: true, defaultValue: '06:00 AM' },
  hora_regreso: { type: DataTypes.STRING(20), allowNull: true, defaultValue: '06:00 PM' },
  requiere_viaticos: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: true },
  alojamiento: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Hotel / Hospedaje en destino' },
  transporte: { type: DataTypes.STRING(100), allowNull: true, defaultValue: 'Terrestre Intermunicipal' },
  estado_actividad: {
    type: DataTypes.ENUM('programada', 'en_ejecucion', 'cumplida', 'cancelada'),
    allowNull: false,
    defaultValue: 'programada'
  }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  freezeTableName: true
});

module.exports = CronogramaMovilidadActividad;
