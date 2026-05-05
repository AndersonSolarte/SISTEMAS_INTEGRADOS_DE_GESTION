const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityFindingComment = sequelize.define('security_finding_comments', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  finding_id: { type: DataTypes.INTEGER, allowNull: false },
  user_id: { type: DataTypes.INTEGER, allowNull: true },
  comment: { type: DataTypes.TEXT, allowNull: false }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false,
  indexes: [{ fields: ['finding_id'] }]
});

module.exports = SecurityFindingComment;
