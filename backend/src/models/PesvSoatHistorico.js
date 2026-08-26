const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PesvSoatHistorico = sequelize.define('pesv_soat_historicos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  validacion_id: { type: DataTypes.INTEGER, allowNull: false },
  parqueadero_registro_id: { type: DataTypes.INTEGER, allowNull: false },
  estado: { type: DataTypes.STRING(60), allowNull: true },
  fecha_expedicion: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_inicio: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_fin: { type: DataTypes.DATEONLY, allowNull: true },
  numero_poliza: { type: DataTypes.STRING(120), allowNull: true },
  entidad: { type: DataTypes.STRING(220), allowNull: true },
  codigo_tarifa: { type: DataTypes.STRING(80), allowNull: true },
  datos_fuente: { type: DataTypes.JSONB, allowNull: true }
});

module.exports = PesvSoatHistorico;
