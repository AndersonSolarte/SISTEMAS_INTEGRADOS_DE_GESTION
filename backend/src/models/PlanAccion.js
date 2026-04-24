const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PlanAccion = sequelize.define('plan_accion', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: false },
  ped: { type: DataTypes.STRING(200), allowNull: true },
  objetivo_estrategico: { type: DataTypes.TEXT, allowNull: true },
  lineamiento_estrategico: { type: DataTypes.TEXT, allowNull: true },
  macroactividad: { type: DataTypes.TEXT, allowNull: true },
  actividad: { type: DataTypes.TEXT, allowNull: true },
  tipo_indicador: { type: DataTypes.STRING(120), allowNull: true },
  fecha_inicio: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_fin: { type: DataTypes.DATEONLY, allowNull: true },
  indicador: { type: DataTypes.TEXT, allowNull: true },
  meta: { type: DataTypes.STRING(300), allowNull: true },
  responsable: { type: DataTypes.STRING(400), allowNull: true },
  corresponsable: { type: DataTypes.STRING(400), allowNull: true },
  avance_ip: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  observaciones_ip: { type: DataTypes.TEXT, allowNull: true },
  avance_iip: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  observaciones_iip: { type: DataTypes.TEXT, allowNull: true },
  total_ejecucion: { type: DataTypes.DECIMAL(6, 2), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = PlanAccion;
