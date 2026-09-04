/**
 * Proyección Social Strategy
 * Define el flujo exclusivo para solicitudes de Proyección Social.
 *
 * Secuencia:
 * 1. Radicación -> Notifica al Jefe Inmediato asignado (estado: pendiente_aprobacion_jefe).
 * 2. Visto Bueno Jefe Inmediato -> Notifica a Coordinación de Proyección Social y Extensión con sus botones (estado: pendiente_aprobacion_proyeccion_social).
 * 3. Visto Bueno Proyección Social -> Pasa a Vicerrectoría Académica (si docente >= 1/2 día) o directamente a Gestión Humana (si menos de media jornada).
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
   * Determina la autoridad requerida después de la etapa actual.
   */
  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { getSolicitudSalida, getSolicitudLaboral, isDocenteCargo } = helpers;
    const salida = getSolicitudSalida ? getSolicitudSalida(solicitud) : (solicitud.datos_formulario?.salida || {});
    const laboral = getSolicitudLaboral ? getSolicitudLaboral(solicitud) : (solicitud.datos_formulario?.laboral || {});
    const solicitante = solicitud.solicitante_snapshot || {};
    const estadoActual = solicitud.estado || '';
    const proyeccionSocialEmail = getReporteSalidaRecipients().proyeccionSocial;

    const isLeaderSelf = isProyeccionSocialLeaderSolicitud(solicitud);
    const hasApprovedProyeccionSocial =
      estadoActual === 'pendiente_aprobacion_proyeccion_social' ||
      Boolean(solicitud.proyeccion_social_aprobado_at) ||
      (Array.isArray(solicitud.trazabilidad) && solicitud.trazabilidad.some(t => ['aprobada_proyeccion_social', 'visto_bueno_proyeccion_social'].includes(t?.event)));

    // Si la solicitud está en etapa de Jefe Inmediato y no ha pasado por Proyección Social (y no es auto-solicitud de la líder):
    // La primera autoridad después del jefe inmediato es la Coordinación de Proyección Social
    if (estadoActual === 'pendiente_aprobacion_jefe' && !isLeaderSelf && !hasApprovedProyeccionSocial) {
      return {
        stage: 'proyeccion_social',
        estado: 'pendiente_aprobacion_proyeccion_social',
        tokenColumn: 'aprobacion_proyeccion_social_token_hash',
        correoColumn: 'correo_proyeccion_social_enviado_at',
        name: 'Coordinación de Proyección Social y Extensión',
        email: proyeccionSocialEmail,
        label: 'Coordinación de Proyección Social y Extensión'
      };
    }

    // Una vez aprobada Proyección Social (o para auto-solicitudes de la líder):
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

    if (dependenciaEmail) {
      pushTarget(dependenciaEmail, dependencia, 'dependencia');
    }

    return targets;
  }
}

module.exports = ProyeccionSocialWorkflowStrategy;
