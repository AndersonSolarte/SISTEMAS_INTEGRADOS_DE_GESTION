const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentForm = sequelize.define('instrument_forms', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  title: { type: DataTypes.STRING(300), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  objective: { type: DataTypes.TEXT, allowNull: true },
  program_id: { type: DataTypes.INTEGER, allowNull: true },
  program_name: { type: DataTypes.STRING(300), allowNull: true },
  area_id: { type: DataTypes.INTEGER, allowNull: true },
  area_name: { type: DataTypes.STRING(300), allowNull: true },
  year: { type: DataTypes.INTEGER, allowNull: true },
  period: { type: DataTypes.STRING(80), allowNull: true },
  type: { type: DataTypes.STRING(120), allowNull: true },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'borrador' },
  version: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
  is_anonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  allow_multiple_responses: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  response_limit: { type: DataTypes.INTEGER, allowNull: true },
  opens_at: { type: DataTypes.DATE, allowNull: true },
  closes_at: { type: DataTypes.DATE, allowNull: true },
  public_code: { type: DataTypes.STRING(40), allowNull: false, unique: true },
  public_url: { type: DataTypes.STRING(500), allowNull: true },
  qr_code: { type: DataTypes.TEXT, allowNull: true },
  theme_config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  personal_fields_config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  attachment_config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  thank_you_message: { type: DataTypes.TEXT, allowNull: true },
  closed_message: { type: DataTypes.TEXT, allowNull: true },
  evidence_context: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  updated_by: { type: DataTypes.INTEGER, allowNull: true },
  published_at: { type: DataTypes.DATE, allowNull: true },
  closed_at: { type: DataTypes.DATE, allowNull: true },
  archived_at: { type: DataTypes.DATE, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['created_by'] },
    { fields: ['status'] },
    { fields: ['public_code'] },
    { fields: ['year', 'period'] }
  ]
});

module.exports = InstrumentForm;
