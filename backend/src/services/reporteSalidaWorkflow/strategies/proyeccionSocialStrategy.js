/**
 * Proyección Social Strategy
 * Define el flujo exclusivo para solicitudes de Proyección Social.
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { ACADEMIC_VICERRECTORIA_EMAIL, getDependencyEmail } = require('../../../config/dependencyEmails');
const { getReporteSalidaRecipients, isProyeccionSocialLeaderSolicitud } = require('../../../config/reporteSalidaConfig');

const normalizeEmail = (email = '') => String(email || '').trim().toLowerCase();
const sameExactEmail = (a = '', b = '') => Boolean(normalizeEmail(a) && normalizeEmail(a) === normalizeEmail(b));

class ProyeccionSocialWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('proyeccion_social');
  }

  /**
   * Determina la autoridad requerida después del jefe inmediato.
   * - Si radica Mery (Coordinadora): Va a su jefe (Vicerrectoría de Investigaciones) y luego directamente a SST / Gestión Humana (retorna null).
   * - Si radica Docente / Colaborador:
   *   - Menos de media jornada: No requiere Vicerrectoría Académica.
   *   - 1 o más días (entre 1 y 2 días, 3 o más días): Pasa a Vicerrectoría Académica.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { getSolicitudSalida, getSolicitudLaboral, isDocenteCargo } = helpers;
    const salida = getSolicitudSalida ? getSolicitudSalida(solicitud) : (solicitud.datos_formulario?.salida || {});
    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const solicitante = solicitud.solicitante_snapshot || {};

    if (salida.duracionTipo === 'menos_media_jornada') {
      return null;
    }

    const cargo = laboral.cargo || solicitante.cargo || '';
    const esDocente = isDocenteCargo ? isDocenteCargo(cargo) : /\bdocente\b/i.test(cargo);

    if (esDocente) {
      return {
        stage: 'vicerrectoria_academica',
        estado: 'pendiente_aprobacion_vicerrectoria_academica',
        tokenColumn: 'aprobacion_vicerrectoria_token_hash',
        correoColumn: 'correo_vicerrectoria_enviado_at',
        name: 'Vicerrectoría Académica',
        email: ACADEMIC_VICERRECTORIA_EMAIL,
        label: 'Vicerrectoría Académica'
      };
    }

    // Para administrativos: Pasa a su propia Vicerrectoría / Secretaría / Rectoría según su dependencia
    return super.getAuthorityAfterBoss(solicitud, helpers);
  }

  /**
   * Determina los destinatarios informativos / de visto bueno al radicar.
   */
  getDependencyNotificationTargets(solicitud = {}, helpers = {}) {
    const { getSolicitudLaboral } = helpers;
    const solicitante = solicitud.solicitante_snapshot || {};
    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const dependencia = laboral.dependencia || solicitante.dependencia || '';
    const dependenciaEmail = getDependencyEmail(dependencia);
    const proyeccionSocialEmail = getReporteSalidaRecipients().proyeccionSocial;

    const targets = [];

    const pushTarget = (email, label, source, forceApproval = false) => {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return;
      if (targets.some((target) => sameExactEmail(target.email, cleanEmail))) return;

      targets.push({
        email: cleanEmail,
        label: label || source || 'Dependencia',
        source,
        forceApproval
      });
    };

    if (!isProyeccionSocialLeaderSolicitud(solicitud)) {
      pushTarget(proyeccionSocialEmail, 'Coordinación de Proyección Social y Extensión', 'proyeccion_social', true);
    }
    pushTarget(dependenciaEmail, dependencia, 'dependencia');

    return targets;
  }
}

module.exports = ProyeccionSocialWorkflowStrategy;
