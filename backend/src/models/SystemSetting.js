const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SystemSetting = sequelize.define('system_settings', {
  key: { type: DataTypes.STRING(120), primaryKey: true },
  value: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  updated_by: { type: DataTypes.INTEGER, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at'
});

module.exports = SystemSetting;
