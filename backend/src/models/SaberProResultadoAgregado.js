const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaberProResultadoAgregado = sequelize.define('saber_pro_resultados_agregados', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  anio: { type: DataTypes.INTEGER, allowNull: true },
  programa: { type: DataTypes.STRING(220), allowNull: true },
  competencia: { type: DataTypes.STRING(180), allowNull: true },
  puntaje_programa: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  puntaje_institucion: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  puntaje_grupo_referencia: { type: DataTypes.DECIMAL(10, 2), allowNull: true },
  tipo_prueba: { type: DataTypes.STRING(120), allowNull: true },
  creado_por: { type: DataTypes.INTEGER, allowNull: true },
  actualizado_por: { type: DataTypes.INTEGER, allowNull: true }
});

module.exports = SaberProResultadoAgregado;
