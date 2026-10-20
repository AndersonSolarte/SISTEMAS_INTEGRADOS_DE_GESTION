const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SaberProDocumentImportItem = sequelize.define('SaberProDocumentImportItem', {
  id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
  import_id: { type: DataTypes.BIGINT, allowNull: false },
  row_number: { type: DataTypes.INTEGER, allowNull: false },
  identification: { type: DataTypes.STRING(30), allowNull: false },
  pdf_identification: { type: DataTypes.STRING(30), allowNull: true },
  db_identification: { type: DataTypes.STRING(30), allowNull: true },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'PENDING' },
  registration_number: { type: DataTypes.STRING(40), allowNull: true },
  db_registration_number: { type: DataTypes.STRING(40), allowNull: true },
  exam_date: { type: DataTypes.DATEONLY, allowNull: true },
  db_exam_date: { type: DataTypes.DATEONLY, allowNull: true },
  document_path: { type: DataTypes.STRING(1000), allowNull: true },
  message: { type: DataTypes.STRING(700), allowNull: true },
  corrected_by: { type: DataTypes.INTEGER, allowNull: true },
  corrected_at: { type: DataTypes.DATE, allowNull: true }
}, {
  tableName: 'saber_pro_document_import_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['import_id'] },
    { fields: ['identification'] },
    { fields: ['status'] },
    { unique: true, fields: ['import_id', 'row_number'] }
  ]
});

module.exports = SaberProDocumentImportItem;
