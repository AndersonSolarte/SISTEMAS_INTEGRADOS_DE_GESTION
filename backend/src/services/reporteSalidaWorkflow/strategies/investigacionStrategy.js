/**
 * Vicerrectoría de Investigación y Posgrados Strategy
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { getDependencyEmail, RECTORIA_EMAIL } = require('../../../config/dependencyEmails');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));

const INVESTIGATION_VICERRECTOR_EMAIL = process.env.REPORTE_SALIDA_VICERRECTORIA_INVESTIGACION_EMAIL || 'jajimenez@unicesmag.edu.co';

class InvestigacionWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('vicerrectoria_investigacion');
  }

  /**
   * Determina los destinatarios informativos de la dependencia al radicar.
   * Exclusivo para Investigaciones: los botones de aprobación de la Vicerrectoría (forceApproval = true)
   * se envían ÚNICAMENTE al correo personal del Vicerrector Javier Jiménez (jajimenez@unicesmag.edu.co).
   */
  getDependencyNotificationTargets(solicitud = {}, helpers = {}) {
    const { getSolicitudLaboral } = helpers;
    const solicitante = solicitud.solicitante_snapshot || {};
    const laboral = getSolicitudLaboral(solicitud);
    const dependencia = laboral.dependencia || solicitante.dependencia || '';
    const vicerrectoria = laboral.vicerrectoria || solicitante.vicerrectoria || '';
    const dependenciaEmail = getDependencyEmail(dependencia);
    const vicerrectoriaEmail = INVESTIGATION_VICERRECTOR_EMAIL;

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

    if (dependenciaEmail && !sameExactEmail(dependenciaEmail, INVESTIGATION_VICERRECTOR_EMAIL)) {
      pushTarget(dependenciaEmail, dependencia, 'dependencia');
    }

    if (vicerrectoria && vicerrectoriaEmail) {
      // Vicerrectoría de Investigación recibe correo con botones de aprobación (forceApproval = true) solo al correo personal de Javier Jiménez
      pushTarget(vicerrectoriaEmail, vicerrectoria, 'vicerrectoria', true);
    }

    return targets;
  }

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   * Para Investigación: Garantiza que los botones de aprobación sean enviados al correo personal de Javier Jiménez (jajimenez@unicesmag.edu.co).
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudLaboral } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const vicerrectoriaName = laboral.vicerrectoria || 'Vicerrectoria de Investigacion y Extension';
    const email = INVESTIGATION_VICERRECTOR_EMAIL;

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
