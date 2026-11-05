const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/\s+/g, ' ');

// Se evalúa el cargo de la cuenta institucional, nunca el cargo enviado en el formulario.
const isRectorUser = (user = {}) => normalize(user?.cargo) === 'rector';
const isRectorSolicitud = (solicitud = {}) => isRectorUser(solicitud.solicitante_snapshot)
  || solicitud.datos_formulario?.sin_jefe_por_maxima_autoridad === true;

const requiresRectorSst = (solicitud = {}) => {
  if (!isRectorSolicitud(solicitud)) return false;
  const salida = solicitud.datos_formulario?.salida || {};
  if (salida.tipo === 'salida_campus') return false;
  const alcance = normalize(salida.alcance);
  if (alcance === 'internacional') return true;
  const municipio = normalize(salida.municipio).replace(/[^a-z]/g, '');
  if (municipio) return !['pasto', 'sanjuandepasto'].includes(municipio);
  return ['regional', 'nacional'].includes(alcance);
};

const buildRectorInitialTrace = (actor, at = new Date().toISOString()) => ({
  event: 'jefe_no_aplica_rector', actor, at,
  detail: { observacion: 'El Rector no tiene jefe inmediato. La solicitud se remite directamente a Gestión del Talento Humano.' }
});

module.exports = { isRectorUser, isRectorSolicitud, requiresRectorSst, buildRectorInitialTrace };
