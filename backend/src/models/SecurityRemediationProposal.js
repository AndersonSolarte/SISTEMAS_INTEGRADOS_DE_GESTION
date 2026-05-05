const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const SecurityRemediationProposal = sequelize.define('security_remediation_proposals', {
  id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
  finding_id: { type: DataTypes.INTEGER, allowNull: false },
  current_code: { type: DataTypes.TEXT, allowNull: true },
  proposed_code: { type: DataTypes.TEXT, allowNull: true },
  explanation: { type: DataTypes.TEXT, allowNull: true },
  risk_mitigated: { type: DataTypes.TEXT, allowNull: true },
  functional_impact: { type: DataTypes.TEXT, allowNull: true },
  recommended_tests: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
  status: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'propuesta' },
  generated_by: { type: DataTypes.INTEGER, allowNull: true },
  reviewed_by: { type: DataTypes.INTEGER, allowNull: true }
}, {
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [{ fields: ['finding_id'] }]
});

module.exports = SecurityRemediationProposal;
