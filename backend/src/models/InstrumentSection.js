const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const InstrumentSection = sequelize.define('instrument_sections', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  form_id: { type: DataTypes.INTEGER, allowNull: false },
  title: { type: DataTypes.STRING(300), allowNull: false },
  description: { type: DataTypes.TEXT, allowNull: true },
  order_index: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['form_id'] }]
});

module.exports = InstrumentSection;
