const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DigitalMeetingMinute = sequelize.define('DigitalMeetingMinute', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  documento_id: { type: DataTypes.INTEGER, allowNull: false },
  code: { type: DataTypes.STRING(80), allowNull: false, unique: true },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'draft' },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  content: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  content_hash: { type: DataTypes.STRING(64), allowNull: true },
  public_token_hash: { type: DataTypes.STRING(64), allowNull: true, unique: true },
  token_expires_at: { type: DataTypes.DATE, allowNull: true },
  published_at: { type: DataTypes.DATE, allowNull: true },
  finalized_at: { type: DataTypes.DATE, allowNull: true },
  distributed_at: { type: DataTypes.DATE, allowNull: true },
  distribution_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
  deleted_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'digital_meeting_minutes',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['created_by', 'created_at'] }, { fields: ['status'] }]
});

module.exports = DigitalMeetingMinute;
