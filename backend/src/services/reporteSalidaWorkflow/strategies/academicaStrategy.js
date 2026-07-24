/**
 * Vicerrectoría Académica Strategy
 * Encapsula todas las reglas específicas de la Vicerrectoría Académica.
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { ACADEMIC_VICERRECTORIA_EMAIL, getDependencyEmail } = require('../../../config/dependencyEmails');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));
const sameEmail = (a = '', b = '') => sameExactEmail(a, b);

class AcademicaWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('vicerrectoria_academica');
  }

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   * - Solicitudes de menos de media jornada: Salta vicerrectoría.
   * - Oficios / Salidas de 3+ días: Requieren la aprobación de la Vicerrectora Académica.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudVicerrectoria } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    const vicerrectoriaName = getSolicitudVicerrectoria(solicitud);

    return {
      stage: 'vicerrectoria_academica',
      estado: 'pendiente_aprobacion_vicerrectoria_academica',
      tokenColumn: 'aprobacion_vicerrectoria_token_hash',
      correoColumn: 'correo_vicerrectoria_enviado_at',
      name: vicerrectoriaName || 'Vicerrectoría Académica',
      email: getDependencyEmail(vicerrectoriaName) || ACADEMIC_VICERRECTORIA_EMAIL,
      label: vicerrectoriaName || 'Vicerrectoría Académica'
    };
  }

  /**
   * Determina los destinatarios informativos de la dependencia al radicar.
   * Excluye viceacad@unicesmag.edu.co al radicar si la persona pertenece directamente a la vicerrectoría.
   */
  getDependencyNotificationTargets(solicitud = {}, helpers = {}) {
    const { getSolicitudLaboral, getInitialApprovalRecipientEmail } = helpers;
    const solicitante = solicitud.solicitante_snapshot || {};
    const laboral = getSolicitudLaboral(solicitud);
    const dependencia = laboral.dependencia || solicitante.dependencia || '';
    const dependenciaEmail = getDependencyEmail(dependencia);
    const bossEmail = getInitialApprovalRecipientEmail ? getInitialApprovalRecipientEmail(solicitud) : null;

    const targets = [];

    const pushTarget = (email, label, source) => {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return;
      if (targets.some((target) => sameExactEmail(target.email, cleanEmail))) return;
      if (sameExactEmail(cleanEmail, ACADEMIC_VICERRECTORIA_EMAIL)) return;
      if (bossEmail && sameEmail(cleanEmail, bossEmail)) return;

      targets.push({
        email: cleanEmail,
        label: label || source || 'Dependencia',
        source
      });
    };

    pushTarget(dependenciaEmail, dependencia, 'dependencia');
    return targets;
  }

  /**
   * Determina si se envía copia final a la Vicerrectoría Académica al cerrar la solicitud.
   * Únicamente si el solicitante es Docente.
   */
  shouldSendFinalCopy(solicitud = {}, recipientType = 'dependencia', helpers = {}) {
    if (recipientType === 'vicerrectoria_academica' || recipientType === 'dependencia') {
      return Boolean(helpers.isAcademicTeacherSolicitud && helpers.isAcademicTeacherSolicitud(solicitud));
    }
    return false;
  }
}

module.exports = AcademicaWorkflowStrategy;
