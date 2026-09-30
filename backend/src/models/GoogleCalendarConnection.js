const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const GoogleCalendarConnection = sequelize.define('GoogleCalendarConnection', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false, unique: true },
  google_email: { type: DataTypes.STRING(254), allowNull: false },
  refresh_token_encrypted: { type: DataTypes.TEXT, allowNull: false },
  scopes: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  status: { type: DataTypes.STRING(24), allowNull: false, defaultValue: 'connected' },
  connected_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  last_used_at: { type: DataTypes.DATE, allowNull: true },
  last_error: { type: DataTypes.TEXT, allowNull: true }
}, {
  tableName: 'google_calendar_connections',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { unique: true, fields: ['user_id'] },
    { fields: ['google_email'] },
    { fields: ['status'] }
  ]
});

module.exports = GoogleCalendarConnection;
