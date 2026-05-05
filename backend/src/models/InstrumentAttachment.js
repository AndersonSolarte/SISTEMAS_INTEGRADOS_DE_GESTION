const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentAttachment = sequelize.define('instrument_attachments', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  response_id: { type: DataTypes.INTEGER, allowNull: false },
  question_id: { type: DataTypes.INTEGER, allowNull: true },
  file_name: { type: DataTypes.STRING(300), allowNull: true },
  file_type: { type: DataTypes.STRING(120), allowNull: true },
  file_size: { type: DataTypes.INTEGER, allowNull: true },
  storage_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'external_url' },
  local_path: { type: DataTypes.STRING(500), allowNull: true },
  external_url: { type: DataTypes.TEXT, allowNull: true },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['response_id'] }]
});

module.exports = InstrumentAttachment;
