const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentQuestionBank = sequelize.define('instrument_question_bank', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  question_text: { type: DataTypes.TEXT, allowNull: false },
  question_type: { type: DataTypes.STRING(80), allowNull: false },
  category: { type: DataTypes.STRING(160), allowNull: true },
  area_id: { type: DataTypes.INTEGER, allowNull: true },
  area_name: { type: DataTypes.STRING(300), allowNull: true },
  program_id: { type: DataTypes.INTEGER, allowNull: true },
  program_name: { type: DataTypes.STRING(300), allowNull: true },
  config: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  options: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  created_by: { type: DataTypes.INTEGER, allowNull: false },
  is_public: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['created_by'] }, { fields: ['question_type'] }]
});

module.exports = InstrumentQuestionBank;
