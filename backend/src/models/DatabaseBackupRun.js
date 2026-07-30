const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DatabaseBackupRun = sequelize.define('database_backup_runs', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'queued' },
  trigger: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'scheduled' },
  phase: { type: DataTypes.STRING(48), allowNull: false, defaultValue: 'queued' },
  progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  progress_estimated: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  started_at: { type: DataTypes.DATE, allowNull: true },
  finished_at: { type: DataTypes.DATE, allowNull: true },
  file_name: { type: DataTypes.STRING(255), allowNull: true },
  size_bytes: { type: DataTypes.BIGINT, allowNull: true },
  duration_ms: { type: DataTypes.BIGINT, allowNull: true },
  error_message: { type: DataTypes.TEXT, allowNull: true },
  requested_by: { type: DataTypes.INTEGER, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['started_at'] }
  ]
});

module.exports = DatabaseBackupRun;
