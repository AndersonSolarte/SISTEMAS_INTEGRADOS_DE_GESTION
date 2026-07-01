const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const UserActivityLog = require('../models/UserActivityLog');
const Documento = require('../models/Documento');

/* ── helpers ── */
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
};

/* GET /api/admin/activity/stats */
const getStats = async (req, res) => {
  try {
    const days = Math.min(Number(req.query.days) || 30, 90);
    const moduleFilter = req.query.module;
    const roleFilter = req.query.role;
    
    const since = daysAgo(days);
    const today = daysAgo(0);

    const baseWhere = { created_at: { [Op.gte]: since } };
    if (moduleFilter) baseWhere.module = moduleFilter;
    if (roleFilter) baseWhere.user_role = roleFilter;

    const [
      totalEvents,
      todayEvents,
      activeUsers7d,
      loginEvents,
      byModule,
      byRole,
      byDay,
      byHour,
      topUsers,
      recent,
      byAction,
      errorEvents,
      downloadEvents,
      rawDownloads,
      rawSearches,
      topLogins,
      failedAttempts
    ] = await Promise.all([
      /* total events in range */
      UserActivityLog.count({ where: baseWhere }),

      /* today */
      UserActivityLog.count({ where: { ...baseWhere, created_at: { [Op.gte]: today } } }),

      /* distinct users last 7 days */
      UserActivityLog.count({
        distinct: true,
        col: 'user_id',
        where: { ...baseWhere, created_at: { [Op.gte]: daysAgo(7) }, user_id: { [Op.ne]: null } }
      }),

      /* login events in range */
      UserActivityLog.count({
        where: { ...baseWhere, action: 'Inicio de sesión' }
      }),

      /* events by module */
      UserActivityLog.findAll({
        attributes: ['module', [fn('COUNT', col('id')), 'total']],
        where: baseWhere,
        group: ['module'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true
      }),

      /* events by role */
      UserActivityLog.findAll({
        attributes: ['user_role', [fn('COUNT', col('id')), 'total']],
        where: baseWhere,
        group: ['user_role'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true
      }),

      /* events per day — PostgreSQL: DATE_TRUNC('day', created_at) */
      UserActivityLog.findAll({
        attributes: [
          [literal(`DATE_TRUNC('day', "created_at")`), 'date'],
          [fn('COUNT', col('id')), 'total']
        ],
        where: baseWhere,
        group: [literal(`DATE_TRUNC('day', "created_at")`)],
        order: [[literal(`DATE_TRUNC('day', "created_at")`), 'ASC']],
        raw: true
      }),

      /* events by hour of day — PostgreSQL: EXTRACT(HOUR FROM created_at) */
      UserActivityLog.findAll({
        attributes: [
          [literal(`EXTRACT(HOUR FROM "created_at")`), 'hora'],
          [fn('COUNT', col('id')), 'total']
        ],
        where: baseWhere,
        group: [literal(`EXTRACT(HOUR FROM "created_at")`)],
        order: [[literal(`EXTRACT(HOUR FROM "created_at")`), 'ASC']],
        raw: true
      }),

      /* top 10 users */
      UserActivityLog.findAll({
        attributes: [
          'user_id', 'user_name', 'user_email', 'user_role',
          [fn('COUNT', col('id')), 'total'],
          [fn('MAX', col('created_at')), 'ultima_actividad']
        ],
        where: { ...baseWhere, user_id: { [Op.ne]: null } },
        group: ['user_id', 'user_name', 'user_email', 'user_role'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 10,
        raw: true
      }),

      /* last 50 events */
      UserActivityLog.findAll({
        where: baseWhere,
        order: [['created_at', 'DESC']],
        limit: 50,
        raw: true
      }),

      /* events by action */
      UserActivityLog.findAll({
        attributes: ['action', [fn('COUNT', col('id')), 'total']],
        where: baseWhere,
        group: ['action'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true
      }),

      /* error events */
      UserActivityLog.count({
        where: { ...baseWhere, action: { [Op.like]: 'Error%' } }
      }),

      /* download events */
      UserActivityLog.count({
        where: { ...baseWhere, action: 'Descarga' }
      }),

      /* Raw downloads to extract Top Documents */
      UserActivityLog.findAll({
        where: { ...baseWhere, action: 'Descarga', endpoint: { [Op.like]: '%/descargar/%' } },
        attributes: ['endpoint'],
        raw: true
      }),

      /* Raw searches to extract Top Terms */
      UserActivityLog.findAll({
        where: { ...baseWhere, endpoint: { [Op.like]: '%search=%' } },
        attributes: ['endpoint'],
        raw: true
      }),

      /* Logins by user */
      UserActivityLog.findAll({
        attributes: [
          'user_id', 'user_name', 'user_email', 'user_role',
          [fn('COUNT', col('id')), 'total_logins'],
          [fn('MAX', col('created_at')), 'ultimo_acceso']
        ],
        where: { ...baseWhere, user_id: { [Op.ne]: null }, action: 'Inicio de sesión' },
        group: ['user_id', 'user_name', 'user_email', 'user_role'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 50,
        raw: true
      }),

      /* Failed / Unauthorized attempts */
      UserActivityLog.findAll({
        attributes: ['id', 'user_email', 'user_role', 'action', 'endpoint', 'ip_address', 'created_at'],
        where: { 
          ...baseWhere, 
          [Op.or]: [
            { action: 'Acceso Denegado' },
            { action: { [Op.like]: 'Error%' } },
            { endpoint: { [Op.like]: '%login%' }, action: { [Op.not]: 'Inicio de sesión' } }
          ]
        },
        order: [['created_at', 'DESC']],
        limit: 20,
        raw: true
      })
    ]);

    // Parse top downloads
    const dlMap = {};
    rawDownloads.forEach(r => {
      const match = r.endpoint.match(/\/descargar\/(\d+)/);
      if (match) {
        const id = match[1];
        dlMap[id] = (dlMap[id] || 0) + 1;
      }
    });

    const topDocIds = Object.keys(dlMap).sort((a, b) => dlMap[b] - dlMap[a]).slice(0, 10);
    let topDescargas = [];
    if (topDocIds.length > 0) {
      const docs = await Documento.findAll({
        where: { id: topDocIds },
        attributes: ['id', 'titulo', 'codigo', 'tipo_documento'],
        raw: true
      });
      topDescargas = docs.map(d => ({
        ...d,
        total: dlMap[d.id]
      })).sort((a, b) => b.total - a.total);
    }

    // Identificar Documentos Inactivos (0 descargas en el periodo)
    const allActiveDocs = await Documento.findAll({
      where: { estado: 'vigente' },
      attributes: ['id', 'titulo', 'codigo', 'tipo_documento', 'autor', 'fecha_creacion'],
      raw: true
    });
    const documentosInactivos = allActiveDocs.filter(d => !dlMap[d.id] || dlMap[d.id] === 0);

    // Parse top search terms
    const searchMap = {};
    rawSearches.forEach(r => {
      try {
        const urlObj = new URL(r.endpoint, 'http://localhost');
        const q = urlObj.searchParams.get('search');
        if (q && q.trim().length > 2) {
          const term = q.trim().toLowerCase();
          searchMap[term] = (searchMap[term] || 0) + 1;
        }
      } catch (e) {}
    });

    const topBusquedas = Object.entries(searchMap)
      .map(([term, total]) => ({ term, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return res.json({
      success: true,
      days,
      stats: { 
        totalEvents, todayEvents, activeUsers7d, loginEvents, errorEvents, downloadEvents, 
        byModule, byRole, byDay, byHour, topUsers, recent, byAction,
        topDescargas, topBusquedas, topLogins, documentosInactivos, failedAttempts
      }
    });
  } catch (err) {
    console.error('[activityController.getStats]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener estadísticas de actividad.' });
  }
};

module.exports = { getStats };
