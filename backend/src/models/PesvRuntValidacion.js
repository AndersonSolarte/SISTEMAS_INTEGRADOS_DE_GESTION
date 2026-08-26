const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PesvRuntValidacion = sequelize.define('pesv_runt_validaciones', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  parqueadero_registro_id: { type: DataTypes.INTEGER, allowNull: false },
  token_hash: { type: DataTypes.STRING(64), allowNull: false, unique: true },
  estado: {
    type: DataTypes.ENUM('PENDIENTE', 'ABIERTA', 'CAPTURADA', 'CONFIRMADA', 'CANCELADA', 'ERROR'),
    allowNull: false,
    defaultValue: 'PENDIENTE'
  },
  resultado: { type: DataTypes.JSONB, allowNull: true },
  error_detalle: { type: DataTypes.TEXT, allowNull: true },
  pagina_origen: { type: DataTypes.STRING(500), allowNull: true },
  expira_en: { type: DataTypes.DATE, allowNull: false },
  abierta_en: { type: DataTypes.DATE, allowNull: true },
  capturada_en: { type: DataTypes.DATE, allowNull: true },
  confirmada_en: { type: DataTypes.DATE, allowNull: true },
  iniciada_por: { type: DataTypes.INTEGER, allowNull: false },
  confirmada_por: { type: DataTypes.INTEGER, allowNull: true }
}, {
  indexes: [
    { fields: ['parqueadero_registro_id', 'created_at'] },
    { fields: ['estado'] },
    { fields: ['expira_en'] }
  ]
});

module.exports = PesvRuntValidacion;
