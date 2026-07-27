/**
 * Rectoría / Secretaría General Strategy
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { RECTORIA_EMAIL } = require('../../../config/dependencyEmails');

class RectoriaWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('rectoria');
  }

  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    // Rectoría le delega el proceso de revisión y aprobación a Gestión del Talento Humano
    return null;
  }
}

module.exports = RectoriaWorkflowStrategy;
