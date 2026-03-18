const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const RecursoHumanoAdministrativo = sequelize.define('recurso_humano_administrativos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  periodo: { type: DataTypes.STRING(40), allowNull: true },
  numero_cedula: { type: DataTypes.STRING(80), allowNull: true },
  estado_laboral: { type: DataTypes.STRING(40), allowNull: true },
  nombre_empleado: { type: DataTypes.STRING(220), allowNull: true },
  cargo_especifico: { type: DataTypes.STRING(220), allowNull: true },
  dependencia: { type: DataTypes.STRING(220), allowNull: true },
  vicerectoria: { type: DataTypes.STRING(220), allowNull: true },
  clase_contrato: { type: DataTypes.STRING(120), allowNull: true },
  genero_biologico: { type: DataTypes.STRING(60), allowNull: true },
  tipo_cotizante: { type: DataTypes.STRING(120), allowNull: true },
  fecha_inicio: { type: DataTypes.STRING(80), allowNull: true },
  fecha_terminacion: { type: DataTypes.STRING(80), allowNull: true },
  sueldo_anual: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  sueldo_mes: { type: DataTypes.DECIMAL(14, 2), allowNull: true },
  raw_data: { type: DataTypes.JSONB, allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = RecursoHumanoAdministrativo;
