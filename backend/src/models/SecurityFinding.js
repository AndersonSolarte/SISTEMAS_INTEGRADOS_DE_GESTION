const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityFinding = sequelize.define('security_findings', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  scan_id: { type: DataTypes.INTEGER, allowNull: false },
  finding_code: { type: DataTypes.STRING(100), allowNull: false },
  title: { type: DataTypes.STRING(300), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  severity: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Informativo' },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'Detectado' },
  affected_component: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'Configuracion' },
  affected_file: { type: DataTypes.STRING(600), allowNull: true },
  affected_line: { type: DataTypes.INTEGER, allowNull: true },
  evidence: { type: DataTypes.TEXT, allowNull: true },
  recommendation: { type: DataTypes.TEXT, allowNull: true },
  responsible_user_id: { type: DataTypes.INTEGER, allowNull: true },
  detected_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  closed_at: { type: DataTypes.DATE, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['scan_id'] },
    { fields: ['severity'] },
    { fields: ['status'] },
    { fields: ['affected_component'] }
  ]
});

module.exports = SecurityFinding;
