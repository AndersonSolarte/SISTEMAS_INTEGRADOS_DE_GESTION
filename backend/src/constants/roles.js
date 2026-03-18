const ROLES = {
  ADMINISTRADOR: 'administrador',
  CONSULTA: 'consulta',
  GESTION_PROCESOS: 'gestion_por_procesos',
  PLANEACION_ESTRATEGICA: 'planeacion_estrategica',
  PLANEACION_EFECTIVIDAD: 'planeacion_efectividad',
  AUTOEVALUACION: 'autoevaluacion',
  GESTION_INFORMACION: 'gestion_informacion'
};

const ROLES_PLANEACION = [
  ROLES.ADMINISTRADOR,
  ROLES.PLANEACION_ESTRATEGICA,
  ROLES.PLANEACION_EFECTIVIDAD,
  ROLES.AUTOEVALUACION,
  ROLES.GESTION_INFORMACION
];

module.exports = {
  ROLES,
  ROLES_PLANEACION
};
