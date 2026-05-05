const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityScan = sequelize.define('security_scans', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  scan_code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  scan_type: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'static_rules' },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'completed' },
  started_at: { type: DataTypes.DATE, allowNull: false },
  finished_at: { type: DataTypes.DATE, allowNull: true },
  executed_by: { type: DataTypes.INTEGER, allowNull: true },
  total_findings: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  critical_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  high_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  medium_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  low_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  informational_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['scan_code'] }, { fields: ['started_at'] }]
});

module.exports = SecurityScan;
