/**
 * Rectoría / Secretaría General Strategy
 */

const BaseWorkflowStrategy = require('./baseStrategy');
const { RECTORIA_EMAIL } = require('../../../config/dependencyEmails');

class RectoriaWorkflowStrategy extends BaseWorkflowStrategy {
  constructor() {
    super('rectoria');
  }

  getAuthorityAfterBoss(solicitud = {}, helpers = {}) {
    const { isOficioSolicitud, isPermisoElectoralSinVicerrectoria, getSolicitudSalida } = helpers;

    if (!isOficioSolicitud(solicitud)) return null;
    if (isPermisoElectoralSinVicerrectoria(solicitud)) return null;

    if (getSolicitudSalida(solicitud).duracionTipo === '3_mas_dias') {
      return null;
    }

    return {
      stage: 'rectoria',
      estado: 'pendiente_aprobacion_rectoria',
      tokenColumn: 'aprobacion_rectoria_token_hash',
      correoColumn: 'correo_rectoria_enviado_at',
      name: 'Rectoria',
      email: RECTORIA_EMAIL,
      label: 'Rectoria'
    };
  }
}

module.exports = RectoriaWorkflowStrategy;
