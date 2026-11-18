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

// Los fallos previos al controlador deben seguir siendo legibles en páginas
// públicas, sin revelar el token, rutas del servidor ni la traza del error.
const handlePublicEmailCorsError = (error, req, res) => {
  if (error?.code !== 'CORS_ORIGIN_DENIED') return false;
  const pathname = String(req.originalUrl || req.url || '').split('?')[0];
  const publicPage = pathname.length <= 4300 && /^\/api\/desplazamientos-viaticos\/(?:accion|prueba\/(?:liquidacion|tesoreria|financiera))\/[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\/?$/.test(pathname);
  const headers = req.headers || {};
  if (!publicPage || headers['sec-fetch-mode'] !== 'navigate' || !['document', 'iframe'].includes(headers['sec-fetch-dest'])) return false;
  res.setHeader('Cache-Control', 'no-store');
  res.status(403).type('html').send(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Revise el acceso a la solicitud · SIAC</title></head><body style="margin:0;padding:24px;background:#f1f5f9;font-family:Arial,sans-serif;color:#334155"><main style="max-width:760px;margin:32px auto;background:white;border:1px solid #dbeafe;border-radius:16px;overflow:hidden"><header style="background:#0b3a6f;color:white;padding:22px"><strong>SIAC UNICESMAG</strong><div>Sistema Interno de Aseguramiento de la Calidad</div></header><section style="padding:26px;line-height:1.6"><h1 style="color:#0b3a6f;font-size:24px">No se pudo completar este intento</h1><p>Saludo de Paz y Bien.</p><p>No se pudo validar el origen del acceso. Abra el enlace original del correo institucional en una pestaña del navegador y vuelva a intentarlo.</p><p><strong>No se registró ninguna decisión con este intento.</strong> Si el inconveniente continúa, comuníquese con el administrador del SIAC e indique el consecutivo de la solicitud.</p><p>Fraternalmente,<br><strong>SIAC UNICESMAG</strong></p></section></main></body></html>`);
  return true;
};

module.exports = { publicEmailErrorReference, handlePublicEmailCorsError };
