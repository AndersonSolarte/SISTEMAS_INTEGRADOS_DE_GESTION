const { randomUUID } = require('crypto');

// Diagnóstico de fallos anteriores al controlador, sin registrar el enlace secreto.
const publicEmailErrorReference = (req, error, status) => {
  const route = String(req.originalUrl || '').match(/^\/api\/(?:reporte-salida|reportes-salida)\/(aprobar(?:-grupo)?|rechazar(?:-grupo)?|documento(?:-grupo)?|soporte(?:-grupo)?)\//);
  if (status !== 500 || !route) return undefined;
  const reference = randomUUID();
  console.error('[reporte-salida] Error en acceso público desde correo:', {
    reference, action: route[1], method: req.method,
    name: error?.name, code: error?.code || '',
    frames: String(error?.stack || '').split('\n').slice(1, 4)
  });
  return reference;
};

module.exports = { publicEmailErrorReference };
