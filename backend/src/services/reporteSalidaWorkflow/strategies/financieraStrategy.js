/**
 * Vicerrectoría Administrativa y Financiera Strategy
 * Encapsula todas las reglas específicas de la Vicerrectoría Administrativa y Financiera.
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { getDependencyEmail, RECTORIA_EMAIL } = require('../../../config/dependencyEmails');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));

class FinancieraWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('vicerrectoria_financiera');
  }

  /**
   * Determina los destinatarios informativos de la dependencia al radicar.
   * Para Financiera: NO se excluye la vicerrectoría aunque coincida con el correo del jefe.
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

      targets.push({
        email: cleanEmail,
        label: label || source || 'Dependencia',
        source,
        forceApproval
      });
    };

    pushTarget(dependenciaEmail, dependencia, 'dependencia');
    if (vicerrectoria && vicerrectoriaEmail) {
      // Vicerrectoría Financiera recibe correo con botones de aprobación
      pushTarget(vicerrectoriaEmail, vicerrectoria, 'vicerrectoria', true);
    }

    return targets;
  }
}

module.exports = FinancieraWorkflowStrategy;
