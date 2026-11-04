const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

module.exports = sequelize.define('InstitutionalPolicy', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  name: { type: DataTypes.TEXT, allowNull: false },
  normalized_key: { type: DataTypes.TEXT, allowNull: false, unique: true },
  action_lines: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  source: { type: DataTypes.STRING(255), allowNull: true },
  updated_by: { type: DataTypes.INTEGER, allowNull: true }
}, { tableName: 'institutional_policies', underscored: true });
