/**
 * Vicerrectoría para la Evangelización Strategy
 * Encapsula las reglas específicas para Pastoral / Vicerrectoría para la Evangelización.
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { getDependencyEmail, RECTORIA_EMAIL } = require('../../../config/dependencyEmails');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));
const sameEmail = (a = '', b = '') => sameExactEmail(a, b);

class EvangelizacionWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('vicerrectoria_evangelizacion');
  }

  /**
   * Determina los destinatarios informativos de la dependencia al radicar.
   * Fuerza el envío de notificación de aprobación a la Vicerrectoría de Evangelización (forceApproval = true).
   */
  getDependencyNotificationTargets(solicitud = {}, helpers = {}) {
    const { getSolicitudLaboral, getInitialApprovalRecipientEmail } = helpers;
    const solicitante = solicitud.solicitante_snapshot || {};
    const laboral = getSolicitudLaboral(solicitud);
    const dependencia = laboral.dependencia || solicitante.dependencia || '';
    const vicerrectoria = laboral.vicerrectoria || solicitante.vicerrectoria || '';
    const dependenciaEmail = getDependencyEmail(dependencia);
    const vicerrectoriaEmail = getDependencyEmail(vicerrectoria);
    const bossEmail = getInitialApprovalRecipientEmail ? getInitialApprovalRecipientEmail(solicitud) : null;

    const targets = [];

    const pushTarget = (email, label, source, forceApproval = false) => {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return;
      if (targets.some((target) => sameExactEmail(target.email, cleanEmail))) return;
      if (sameExactEmail(cleanEmail, RECTORIA_EMAIL)) return;
      if (!forceApproval && bossEmail && sameEmail(cleanEmail, bossEmail)) return;

      targets.push({
        email: cleanEmail,
        label: label || source || 'Dependencia',
        source,
        forceApproval
      });
    };

    pushTarget(dependenciaEmail, dependencia, 'dependencia');
    if (vicerrectoria && vicerrectoriaEmail) {
      pushTarget(vicerrectoriaEmail, vicerrectoria, 'vicerrectoria', true);
    }

    return targets;
  }

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   * Para Evangelización: Garantiza que el correo sea enviado a vicebien@unicesmag.edu.co.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudLaboral } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const vicerrectoriaName = laboral.vicerrectoria || 'Vicerrectoría para la Evangelizacion de las Culturas';
    const email = getDependencyEmail(vicerrectoriaName) || 'vicebien@unicesmag.edu.co';

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

module.exports = EvangelizacionWorkflowStrategy;
