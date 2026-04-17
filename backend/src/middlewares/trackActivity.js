const UserActivityLog = require('../models/UserActivityLog');

/* Derive a human-readable module name from the request URL */
const detectModule = (url = '', method = '') => {
  const u = url.toLowerCase();
  if (u.includes('/saber-pro/consulta/masiva'))    return 'Validación Masiva';
  if (u.includes('/saber-pro/consulta/individual')) return 'Consulta Individual';
  if (u.includes('/saber-pro/consulta'))            return 'Consulta y Validación';
  if (u.includes('/saber-pro'))                     return 'Saber Pro Analytics';
  if (u.includes('/matriculados'))                  return 'Matriculados';
  if (u.includes('/gestion-informacion'))           return 'Gestión de Información';
  if (u.includes('/documentos'))                    return 'Documentos';
  if (u.includes('/users'))                         return 'Administración Usuarios';
  if (u.includes('/import'))                        return 'Importación de Datos';
  if (u.includes('/catalogo') || u.includes('/macroprocesos')) return 'Catálogo de Procesos';
  if (u.includes('/activity'))                      return 'Monitor de Actividad';
  if (u.includes('/auth/profile'))                  return 'Sistema';
  return 'General';
};

const detectAction = (method = '', url = '') => {
  const u = url.toLowerCase();
  if (u.includes('/masiva') || u.includes('/import')) return 'Carga de archivo';
  if (u.includes('/consulta') || u.includes('/buscar')) return 'Consulta';
  if (method === 'GET')    return 'Visualización';
  if (method === 'POST')   return 'Creación';
  if (method === 'PUT' || method === 'PATCH') return 'Actualización';
  if (method === 'DELETE') return 'Eliminación';
  return 'Acceso';
};

/**
 * Fire-and-forget activity logger middleware.
 * Attach AFTER auth middleware on routes you want to track.
 */
const trackActivity = (req, res, next) => {
  // Only track authenticated users; skip activity-stats calls to avoid noise
  if (!req.user || req.originalUrl.includes('/activity/')) {
    return next();
  }

  setImmediate(async () => {
    try {
      await UserActivityLog.create({
        user_id:    req.user.id,
        user_name:  req.user.nombre || req.user.name || null,
        user_email: req.user.email  || null,
        user_role:  req.user.role   || null,
        module:     detectModule(req.originalUrl, req.method),
        action:     detectAction(req.method, req.originalUrl),
        method:     req.method,
        endpoint:   req.originalUrl?.slice(0, 600),
        ip_address: (req.headers['x-forwarded-for'] || req.ip || '').toString().slice(0, 60),
        user_agent: (req.headers['user-agent'] || '').slice(0, 500),
      });
    } catch (_) { /* silent — never break the request pipeline */ }
  });

  next();
};

module.exports = trackActivity;
