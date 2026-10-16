const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaberProDocumentImport = sequelize.define('SaberProDocumentImport', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PROCESSING' },
  original_file_name: { type: DataTypes.STRING(255), allowNull: false },
  total_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  processed_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  extracted_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  corrected_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  not_found_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  no_pdf_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  error_items: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  created_by: { type: DataTypes.INTEGER, allowNull: true },
  finished_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'saber_pro_document_imports',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['status'] },
    { fields: ['created_at'] }
  ]
});

module.exports = SaberProDocumentImport;
