/**
 * Base Workflow Strategy (Fallback)
 * Define las reglas por defecto para cualquier vicerrectoría, secretaría o dependencia.
 */

const {
  ACADEMIC_VICERRECTORIA_EMAIL,
  RECTORIA_EMAIL,
  getDependencyEmail
} = require('../../../config/dependencyEmails');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));
const sameEmail = (a = '', b = '') => sameExactEmail(a, b);

class BaseWorkflowStrategy {
  constructor(key = 'base') {
    this.key = key;
  }

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudSalida, getSolicitudVicerrectoria, isRectoriaAuthority } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    const vicerrectoriaName = getSolicitudVicerrectoria(solicitud);

    if (getSolicitudSalida(solicitud).duracionTipo === '3_mas_dias' && isRectoriaAuthority(vicerrectoriaName)) {
      return null;
    }

    if (isRectoriaAuthority(vicerrectoriaName)) {
      return null;
    }

    if (vicerrectoriaName) {
      const { isInvestigacionVicerrectoria } = helpers;
      let email = getDependencyEmail(vicerrectoriaName) || ACADEMIC_VICERRECTORIA_EMAIL;
      if (isInvestigacionVicerrectoria && isInvestigacionVicerrectoria(vicerrectoriaName)) {
        email = process.env.REPORTE_SALIDA_VICERRECTORIA_INVESTIGACION_EMAIL || 'jajimenez@unicesmag.edu.co';
      }
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

    return null;
  }

  /**
   * Determina los destinatarios informativos de la dependencia al radicar.
   */
  getDependencyNotificationTargets(solicitud = {}, helpers = {}) {
    const { getSolicitudLaboral, isRectoriaAuthority, isVicerrectoriaAcademica, getInitialApprovalRecipientEmail } = helpers;
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
      if (sameExactEmail(cleanEmail, ACADEMIC_VICERRECTORIA_EMAIL)) return;
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
    if (!isVicerrectoriaAcademica(vicerrectoria) && !isRectoriaAuthority(vicerrectoria)) {
      pushTarget(vicerrectoriaEmail, vicerrectoria, 'vicerrectoria');
    }

    return targets;
  }

  /**
   * Determina si se debe adjuntar copia final en sendFinalEmails para la vicerrectoría.
   */
  shouldSendFinalCopy(solicitud = {}, recipientType = 'dependencia', helpers = {}) {
    return false;
  }
}

module.exports = BaseWorkflowStrategy;
