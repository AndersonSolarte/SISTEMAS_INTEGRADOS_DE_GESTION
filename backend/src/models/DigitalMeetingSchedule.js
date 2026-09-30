const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DigitalMeetingSchedule = sequelize.define('DigitalMeetingSchedule', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  minute_id: { type: DataTypes.UUID, allowNull: false },
  organizer_email: { type: DataTypes.STRING(254), allowNull: false },
  summary: { type: DataTypes.STRING(240), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  location: { type: DataTypes.STRING(500), allowNull: true },
  start_at: { type: DataTypes.DATE, allowNull: false },
  end_at: { type: DataTypes.DATE, allowNull: false },
  timezone: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'America/Bogota' },
  attendees: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  google_event_id: { type: DataTypes.STRING(255), allowNull: true },
  google_event_url: { type: DataTypes.TEXT, allowNull: true },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'scheduled' },
  last_error: { type: DataTypes.TEXT, allowNull: true },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  updated_by: { type: DataTypes.INTEGER, allowNull: true }
}, {
  tableName: 'digital_meeting_schedules',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['minute_id'] },
    { fields: ['organizer_email', 'start_at'] },
    { fields: ['status'] }
  ]
});

module.exports = DigitalMeetingSchedule;
