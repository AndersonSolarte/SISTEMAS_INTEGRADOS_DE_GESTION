const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const DigitalMeetingSignature = sequelize.define('DigitalMeetingSignature', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  minute_id: { type: DataTypes.UUID, allowNull: false },
  participant_id: { type: DataTypes.UUID, allowNull: false },
  signer_name: { type: DataTypes.STRING(240), allowNull: false },
  signer_email: { type: DataTypes.STRING(254), allowNull: true },
  signature_storage_key: { type: DataTypes.STRING(500), allowNull: false },
  signature_hash: { type: DataTypes.STRING(64), allowNull: false },
  content_hash: { type: DataTypes.STRING(64), allowNull: false },
  signed_at: { type: DataTypes.DATE, allowNull: false },
  privacy_accepted_at: { type: DataTypes.DATE, allowNull: true },
  privacy_policy_version: { type: DataTypes.STRING(40), allowNull: true },
  ip_address: { type: DataTypes.STRING(80), allowNull: true },
  user_agent: { type: DataTypes.STRING(500), allowNull: true }
}, {
  tableName: 'digital_meeting_signatures',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ unique: true, fields: ['minute_id', 'participant_id'] }]
});

module.exports = DigitalMeetingSignature;
