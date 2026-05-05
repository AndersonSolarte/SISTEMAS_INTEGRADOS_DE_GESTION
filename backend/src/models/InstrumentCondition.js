const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentCondition = sequelize.define('instrument_conditions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_id: { type: DataTypes.INTEGER, allowNull: false },
  source_question_id: { type: DataTypes.INTEGER, allowNull: true },
  target_type: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'question' },
  target_id: { type: DataTypes.INTEGER, allowNull: true },
  condition_logic: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  action: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'show' }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['form_id'] }]
});

module.exports = InstrumentCondition;
