const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentAnswer = sequelize.define('instrument_answers', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  response_id: { type: DataTypes.INTEGER, allowNull: false },
  question_id: { type: DataTypes.INTEGER, allowNull: false },
  answer_value: { type: DataTypes.JSONB, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['response_id'] }, { fields: ['question_id'] }]
});

module.exports = InstrumentAnswer;
