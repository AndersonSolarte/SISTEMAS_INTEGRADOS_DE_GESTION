/**
 * Vicerrectoría de Investigación y Posgrados Strategy
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { getDependencyEmail, RECTORIA_EMAIL } = require('../../../config/dependencyEmails');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));

class InvestigacionWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('vicerrectoria_investigacion');
  }

  /**
   * Determina los destinatarios informativos de la dependencia al radicar.
   * Exclusivo para Investigaciones: la Vicerrectoría (viceinvestiga@unicesmag.edu.co)
   * recibe SIEMPRE el correo con botones de aprobación (forceApproval = true).
   */
  getDependencyNotificationTargets(solicitud = {}, helpers = {}) {
    const { getSolicitudLaboral } = helpers;
    const solicitante = solicitud.solicitante_snapshot || {};
    const laboral = getSolicitudLaboral(solicitud);
    const dependencia = laboral.dependencia || solicitante.dependencia || '';
    const vicerrectoria = laboral.vicerrectoria || solicitante.vicerrectoria || '';
    const dependenciaEmail = getDependencyEmail(dependencia);
    const vicerrectoriaEmail = getDependencyEmail(vicerrectoria);

    const targets = [];

    const pushTarget = (email, label, source, forceApproval = false) => {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return;
      if (sameExactEmail(cleanEmail, RECTORIA_EMAIL)) return;
      
      const existing = targets.find((t) => sameExactEmail(t.email, cleanEmail));
      if (existing) {
        if (forceApproval) existing.forceApproval = true;
        return;
      }

      targets.push({
        email: cleanEmail,
        label: label || source || 'Dependencia',
        source,
        forceApproval
      });
    };

    pushTarget(dependenciaEmail, dependencia, 'dependencia');
    if (vicerrectoria && vicerrectoriaEmail) {
      // Vicerrectoría de Investigación recibe correo con botones de aprobación (forceApproval = true)
      pushTarget(vicerrectoriaEmail, vicerrectoria, 'vicerrectoria', true);
    }

    return targets;
  }
}

module.exports = InvestigacionWorkflowStrategy;
