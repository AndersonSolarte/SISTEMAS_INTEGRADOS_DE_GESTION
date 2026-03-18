const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecursoHumanoDocente = sequelize.define('recurso_humano_docentes', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo: { type: DataTypes.STRING(40), allowNull: true },
  identificacion: { type: DataTypes.STRING(80), allowNull: true },
  docente: { type: DataTypes.STRING(220), allowNull: true },
  genero_biologico: { type: DataTypes.STRING(60), allowNull: true },
  departamento_dependencia: { type: DataTypes.STRING(220), allowNull: true },
  programa: { type: DataTypes.STRING(220), allowNull: true },
  tipo_vinculacion: { type: DataTypes.STRING(120), allowNull: true },
  contrato: { type: DataTypes.STRING(120), allowNull: true },
  cargo: { type: DataTypes.STRING(180), allowNull: true },
  escalafon: { type: DataTypes.STRING(120), allowNull: true },
  total_horas: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  total_docentes: { type: DataTypes.DECIMAL(12, 2), allowNull: true },
  fecha_ingreso: { type: DataTypes.STRING(80), allowNull: true },
  fecha_nacimiento: { type: DataTypes.STRING(80), allowNull: true },
  edad: { type: DataTypes.INTEGER, allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RecursoHumanoDocente;
