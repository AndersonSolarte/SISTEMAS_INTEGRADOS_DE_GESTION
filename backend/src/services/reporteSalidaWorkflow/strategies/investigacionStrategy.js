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

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   * Para Investigación: Garantiza que el correo sea enviado a viceinvestiga@unicesmag.edu.co.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudLaboral } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const vicerrectoriaName = laboral.vicerrectoria || 'Vicerrectoria de Investigacion y Extension';
    const email = getDependencyEmail(vicerrectoriaName) || 'viceinvestiga@unicesmag.edu.co';

    return {
      stage: 'vicerrectoria_academica',
      estado: 'pendiente_aprobacion_vicerrectoria_academica',
      tokenColumn: 'aprobacion_vicerrectoria_token_hash',
      correoColumn: 'correo_vicerrectoria_enviado_at',
      name: vicerrectoriaName,
      email: email,
      label: vicerrectoriaName
    };
  }
}

module.exports = InvestigacionWorkflowStrategy;
