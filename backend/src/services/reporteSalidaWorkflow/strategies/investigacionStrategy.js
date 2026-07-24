/**
 * Vicerrectoría de Investigación y Posgrados Strategy
 */

const BaseWorkflowStrategy = require('./baseStrategy');

class InvestigacionWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('vicerrectoria_investigacion');
  }
}

module.exports = InvestigacionWorkflowStrategy;
