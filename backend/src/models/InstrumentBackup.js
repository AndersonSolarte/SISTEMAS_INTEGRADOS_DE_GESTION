const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentBackup = sequelize.define('instrument_backups', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  scope: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'own' },
  form_id: { type: DataTypes.INTEGER, allowNull: true },
  file_path: { type: DataTypes.STRING(500), allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['created_by'] }, { fields: ['form_id'] }]
});

module.exports = InstrumentBackup;
