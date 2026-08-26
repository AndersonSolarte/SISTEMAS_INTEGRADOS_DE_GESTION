/**
 * Motor Despachador de Flujos por Vicerrectoría / Dependencia
 * Aísla y encamina cada solicitud a su estrategia de negocio correspondiente.
 */

const BaseWorkflowStrategy = require('./strategies/baseStrategy');
const AcademicaWorkflowStrategy = require('./strategies/academicaStrategy');
const FinancieraWorkflowStrategy = require('./strategies/financieraStrategy');
const EvangelizacionWorkflowStrategy = require('./strategies/evangelizacionStrategy');
const InvestigacionWorkflowStrategy = require('./strategies/investigacionStrategy');
const RectoriaWorkflowStrategy = require('./strategies/rectoriaStrategy');
const ProyeccionSocialWorkflowStrategy = require('./strategies/proyeccionSocialStrategy');

const strategies = {
  base: new BaseWorkflowStrategy(),
  academica: new AcademicaWorkflowStrategy(),
  financiera: new FinancieraWorkflowStrategy(),
  evangelizacion: new EvangelizacionWorkflowStrategy(),
  investigacion: new InvestigacionWorkflowStrategy(),
  rectoria: new RectoriaWorkflowStrategy(),
  proyeccionSocial: new ProyeccionSocialWorkflowStrategy()
};

/**
  * Selecciona la estrategia adecuada basada en la vicerrectoría o autoridad.
  */
const getWorkflowStrategy = (solicitud = {}, helpers = {}) => {
  const {
    getSolicitudSalida,
    getSolicitudVicerrectoria,
    isVicerrectoriaAcademica,
    isEvangelizacionVicerrectoria,
    isInvestigacionVicerrectoria,
    isFinancieraVicerrectoria,
    isRectoriaAuthority
  } = helpers;

  const salida = getSolicitudSalida ? getSolicitudSalida(solicitud) : (solicitud.datos_formulario?.salida || {});
  if (salida && (salida.tipo === 'proyeccion_social' || salida.tipo === 'proyeccion_social_extension')) {
    return strategies.proyeccionSocial;
  }

  const vicerrectoriaName = getSolicitudVicerrectoria ? getSolicitudVicerrectoria(solicitud) : '';

  if (isVicerrectoriaAcademica && isVicerrectoriaAcademica(vicerrectoriaName)) {
    return strategies.academica;
  }
  if (isFinancieraVicerrectoria && isFinancieraVicerrectoria(vicerrectoriaName)) {
    return strategies.financiera;
  }
  if (isEvangelizacionVicerrectoria && isEvangelizacionVicerrectoria(vicerrectoriaName)) {
    return strategies.evangelizacion;
  }
  if (isInvestigacionVicerrectoria && isInvestigacionVicerrectoria(vicerrectoriaName)) {
    return strategies.investigacion;
  }
  if (isRectoriaAuthority && isRectoriaAuthority(vicerrectoriaName)) {
    return strategies.rectoria;
  }

  return strategies.base;
};

/**
  * Despacha la búsqueda de autoridad siguiente después del jefe.
  */
const getAuthorityAfterBoss = (solicitud = {}, helpers = {}) => {
  const strategy = getWorkflowStrategy(solicitud, helpers);
  return strategy.getAuthorityAfterBoss(solicitud, helpers);
};

/**
  * Despacha la construcción de destinatarios informativos al radicar.
  */
const getDependencyNotificationTargets = (solicitud = {}, helpers = {}) => {
  const strategy = getWorkflowStrategy(solicitud, helpers);
  return strategy.getDependencyNotificationTargets(solicitud, helpers);
};

/**
  * Despacha la verificación de envío de copia final.
  */
const shouldSendFinalCopy = (solicitud = {}, recipientType = 'dependencia', helpers = {}) => {
  const strategy = getWorkflowStrategy(solicitud, helpers);
  return strategy.shouldSendFinalCopy(solicitud, recipientType, helpers);
};

module.exports = {
  getWorkflowStrategy,
  getAuthorityAfterBoss,
  getDependencyNotificationTargets,
  shouldSendFinalCopy,
  strategies
};
