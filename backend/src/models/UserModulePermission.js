const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const UserModulePermission = sequelize.define('user_module_permissions', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  user_id: { type: DataTypes.INTEGER, allowNull: false },
  module_key: { type: DataTypes.STRING(100), allowNull: false },
  can_view: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  can_manage: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['user_id', 'module_key']
    }
  ]
});

module.exports = UserModulePermission;
