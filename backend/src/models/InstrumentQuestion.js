const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentQuestion = sequelize.define('instrument_questions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_id: { type: DataTypes.INTEGER, allowNull: false },
  section_id: { type: DataTypes.INTEGER, allowNull: true },
  question_text: { type: DataTypes.TEXT, allowNull: false },
  question_description: { type: DataTypes.TEXT, allowNull: true },
  question_type: { type: DataTypes.STRING(80), allowNull: false, defaultValue: 'texto_corto' },
  is_required: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  validation_rules: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['form_id'] }, { fields: ['section_id'] }]
});

module.exports = InstrumentQuestion;
