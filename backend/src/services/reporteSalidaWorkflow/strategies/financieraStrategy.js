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

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   * Para la Vicerrectoría Financiera: Garantiza que el correo de aprobación
   * sea enviado a la Vicerrectoría Financiera (viceadfin@unicesmag.edu.co) y nunca a la Académica.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudLaboral } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const vicerrectoriaName = laboral.vicerrectoria || 'Vicerrectoria Financiera y de Desarrollo Institucional';
    const email = getDependencyEmail(vicerrectoriaName) || 'viceadfin@unicesmag.edu.co';

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

module.exports = FinancieraWorkflowStrategy;
