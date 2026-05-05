const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentResponse = sequelize.define('instrument_responses', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_id: { type: DataTypes.INTEGER, allowNull: false },
  respondent_code: { type: DataTypes.STRING(80), allowNull: false },
  respondent_data: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  is_anonymous: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  submitted_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  metadata: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: false,
  indexes: [{ fields: ['form_id'] }, { fields: ['respondent_code'] }]
});

module.exports = InstrumentResponse;
