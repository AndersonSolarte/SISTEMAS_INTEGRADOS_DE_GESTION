const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DigitalMeetingParticipant = sequelize.define('DigitalMeetingParticipant', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  minute_id: { type: DataTypes.UUID, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
  document: { type: DataTypes.STRING(100), allowNull: true },
  name: { type: DataTypes.STRING(240), allowNull: false },
  email: { type: DataTypes.STRING(254), allowNull: true },
  organization: { type: DataTypes.STRING(240), allowNull: true },
  role_title: { type: DataTypes.STRING(220), allowNull: true },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'invited' },
  otp_hash: { type: DataTypes.STRING(64), allowNull: true },
  otp_expires_at: { type: DataTypes.DATE, allowNull: true },
  otp_attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  email_verified_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'digital_meeting_participants',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['minute_id', 'email'] }]
});

module.exports = DigitalMeetingParticipant;
