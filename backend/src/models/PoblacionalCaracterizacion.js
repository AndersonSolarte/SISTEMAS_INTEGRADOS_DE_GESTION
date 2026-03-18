const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PoblacionalCaracterizacion = sequelize.define('poblacional_caracterizacion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  periodo: { type: DataTypes.STRING(30), allowNull: true },
  no_identificacion: { type: DataTypes.STRING(80), allowNull: true },
  tipo_documentacion: { type: DataTypes.STRING(80), allowNull: true },
  programa: { type: DataTypes.STRING(220), allowNull: true },
  codigo: { type: DataTypes.STRING(80), allowNull: true },
  semestre: { type: DataTypes.STRING(40), allowNull: true },
  apellidos_nombres: { type: DataTypes.STRING(220), allowNull: true },
  genero: { type: DataTypes.STRING(80), allowNull: true },
  victima_conflicto_armado: { type: DataTypes.STRING(80), allowNull: true },
  correo_electronico: { type: DataTypes.STRING(220), allowNull: true },
  personas_a_cargo: { type: DataTypes.STRING(40), allowNull: true },
  estado_civil: { type: DataTypes.STRING(80), allowNull: true },
  grupo_etnico: { type: DataTypes.STRING(120), allowNull: true },
  eps: { type: DataTypes.STRING(180), allowNull: true },
  municipio_residencia: { type: DataTypes.STRING(140), allowNull: true },
  departamento_residencia: { type: DataTypes.STRING(180), allowNull: true },
  pais_residencia: { type: DataTypes.STRING(140), allowNull: true },
  discapacidad: { type: DataTypes.STRING(120), allowNull: true },
  nucleo_familiar: { type: DataTypes.STRING(40), allowNull: true },
  estrato: { type: DataTypes.STRING(20), allowNull: true },
  ingresos_familiares: { type: DataTypes.STRING(80), allowNull: true },
  ingresos_familiares_2: { type: DataTypes.STRING(80), allowNull: true },
  institucion: { type: DataTypes.STRING(220), allowNull: true },
  titulo_obtenido: { type: DataTypes.STRING(220), allowNull: true },
  tipo_credito: { type: DataTypes.STRING(120), allowNull: true },
  edad: { type: DataTypes.INTEGER, allowNull: true },
  zona_procedencia: { type: DataTypes.STRING(120), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PoblacionalCaracterizacion;
