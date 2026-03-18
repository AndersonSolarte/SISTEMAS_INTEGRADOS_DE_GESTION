const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserActivityLog = sequelize.define('UserActivityLog', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  user_id:    { type: DataTypes.INTEGER, allowNull: true },
  user_name:  { type: DataTypes.STRING(200), allowNull: true },
  user_email: { type: DataTypes.STRING(200), allowNull: true },
  user_role:  { type: DataTypes.STRING(80),  allowNull: true },
  module:     { type: DataTypes.STRING(120), allowNull: true },
  action:     { type: DataTypes.STRING(80),  allowNull: true },
  method:     { type: DataTypes.STRING(10),  allowNull: true },
  endpoint:   { type: DataTypes.STRING(600), allowNull: true },
  ip_address: { type: DataTypes.STRING(60),  allowNull: true },
  user_agent: { type: DataTypes.STRING(500), allowNull: true },
}, {
  tableName: 'user_activity_logs',
  timestamps: true,
  createdAt:  'created_at',
  updatedAt:  false,
});

module.exports = UserActivityLog;
