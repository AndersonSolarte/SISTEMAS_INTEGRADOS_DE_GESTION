const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PesvRtmHistorico = sequelize.define('pesv_rtm_historicos', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  validacion_id: { type: DataTypes.INTEGER, allowNull: false },
  parqueadero_registro_id: { type: DataTypes.INTEGER, allowNull: false },
  estado: { type: DataTypes.STRING(60), allowNull: true },
  vigente: { type: DataTypes.BOOLEAN, allowNull: true },
  tipo_revision: { type: DataTypes.STRING(180), allowNull: true },
  fecha_expedicion: { type: DataTypes.DATEONLY, allowNull: true },
  fecha_vigencia: { type: DataTypes.DATEONLY, allowNull: true },
  numero_certificado: { type: DataTypes.STRING(140), allowNull: true },
  cda: { type: DataTypes.STRING(220), allowNull: true },
  datos_fuente: { type: DataTypes.JSONB, allowNull: true }
});

module.exports = PesvRtmHistorico;
