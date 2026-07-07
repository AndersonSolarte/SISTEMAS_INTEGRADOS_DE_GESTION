const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const UserActivityLog = require('../models/UserActivityLog');
const Documento = require('../models/Documento');
const User = require('../models/User');

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

    const allUsers = await User.findAll({ attributes: ['id', 'username', 'nombre', 'email', 'dependencia'], raw: true });

    const [
      totalEvents,
      todayEvents,
      activeUsers7d,
      byModule,
      byRole,
      byDay,
      byHour,
      topUsers,
      recent,
      byAction,
      topDocIdsQuery,
      activeDocIdsQuery,
      topSearchTermsQuery,
      topLogins,
      failedAttempts,
      loginsByDay,
      rawUserActions,
      loginsByRole,
      topErrors,
      topVulnerabilidades
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

      /* Top downloads aggregated in DB */
      UserActivityLog.findAll({
        attributes: [
          [literal(`SUBSTRING(endpoint FROM '/descargar/([0-9]+)')`), 'doc_id'],
          [fn('COUNT', col('id')), 'total']
        ],
        where: {
          ...baseWhere,
          action: 'Descarga',
          endpoint: { [Op.like]: '%/descargar/%' }
        },
        group: [literal(`SUBSTRING(endpoint FROM '/descargar/([0-9]+)')`)],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 10,
        raw: true
      }),

      /* Active downloads check to determine documents inactive status */
      UserActivityLog.findAll({
        attributes: [
          [literal(`SUBSTRING(endpoint FROM '/descargar/([0-9]+)')`), 'doc_id']
        ],
        where: {
          ...baseWhere,
          action: 'Descarga',
          endpoint: { [Op.like]: '%/descargar/%' }
        },
        group: [literal(`SUBSTRING(endpoint FROM '/descargar/([0-9]+)')`)],
        raw: true
      }),

      /* Top search terms aggregated in DB */
      UserActivityLog.findAll({
        attributes: [
          [literal(`LOWER(SUBSTRING(endpoint FROM 'search=([^&]+)'))`), 'term'],
          [fn('COUNT', col('id')), 'total']
        ],
        where: {
          ...baseWhere,
          endpoint: { [Op.like]: '%search=%' }
        },
        group: [literal(`LOWER(SUBSTRING(endpoint FROM 'search=([^&]+)'))`)],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 10,
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
      }),

      /* Logins per day */
      UserActivityLog.findAll({
        attributes: [
          [literal(`DATE_TRUNC('day', "created_at")`), 'date'],
          [fn('COUNT', col('id')), 'total']
        ],
        where: { ...baseWhere, action: 'Inicio de sesión' },
        group: [literal(`DATE_TRUNC('day', "created_at")`)],
        order: [[literal(`DATE_TRUNC('day', "created_at")`), 'ASC']],
        raw: true
      }),

      /* Raw user actions for pivot chart */
      UserActivityLog.findAll({
        attributes: [
          'user_id',
          'user_name',
          'action',
          [fn('COUNT', col('id')), 'total']
        ],
        where: { ...baseWhere, user_name: { [Op.ne]: null } },
        group: ['user_id', 'user_name', 'action'],
        raw: true
      }),

      /* logins by role */
      UserActivityLog.findAll({
        attributes: ['user_role', [fn('COUNT', col('id')), 'total']],
        where: { ...baseWhere, action: 'Inicio de sesión' },
        group: ['user_role'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true
      }),

      /* top errores */
      UserActivityLog.findAll({
        attributes: ['action', 'endpoint', [fn('COUNT', col('id')), 'total']],
        where: { ...baseWhere, action: { [Op.like]: 'Error%' } },
        group: ['action', 'endpoint'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 10,
        raw: true
      }),

      /* top vulnerabilidades (Acceso Denegado) */
      UserActivityLog.findAll({
        attributes: ['user_name', 'user_email', 'ip_address', [fn('COUNT', col('id')), 'total']],
        where: { ...baseWhere, action: 'Acceso Denegado' },
        group: ['user_name', 'user_email', 'ip_address'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 10,
        raw: true
      })
    ]);

    // Calculate aggregated metrics from byAction query in-memory
    const loginRow = byAction.find(r => r.action === 'Inicio de sesión');
    const loginEvents = loginRow ? Number(loginRow.total) : 0;

    const downloadRow = byAction.find(r => r.action === 'Descarga');
    const downloadEvents = downloadRow ? Number(downloadRow.total) : 0;

    const errorEvents = byAction
      .filter(r => r.action && r.action.startsWith('Error'))
      .reduce((sum, r) => sum + Number(r.total), 0);

    // Map top downloads
    const dlMap = {};
    topDocIdsQuery.forEach(r => {
      if (r.doc_id) {
        dlMap[r.doc_id] = Number(r.total || 0);
      }
    });

    const topDocIds = Object.keys(dlMap);
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

    // Set of active document IDs in the period to find documents with 0 activity
    const activeDocIds = new Set(activeDocIdsQuery.map(r => r.doc_id).filter(Boolean));

    // Identificar Documentos Inactivos (0 descargas en el periodo y más de un mes de antigüedad)
    const allActiveDocs = await Documento.findAll({
      where: { estado: 'vigente' },
      attributes: ['id', 'titulo', 'codigo', 'tipo_documento', 'autor', 'fecha_creacion', 'link_acceso'],
      raw: true
    });
    
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    const documentosInactivos = allActiveDocs.filter(d => {
      // Filtrar aquellos que tienen menos de un mes de creados
      const docDate = new Date(d.fecha_creacion);
      if (docDate > oneMonthAgo) return false;

      const isInactive = !activeDocIds.has(String(d.id));
      const isNotPolicy = d.tipo_documento && !d.tipo_documento.toUpperCase().includes('POLÍTICA') && !d.tipo_documento.toUpperCase().includes('POLITICA');
      return isInactive && isNotPolicy;
    });

    // Map top search terms
    const topBusquedas = topSearchTermsQuery
      .map(r => {
        let term = r.term || '';
        try {
          term = decodeURIComponent(term);
        } catch (e) {}
        return { term, total: Number(r.total || 0) };
      })
      .filter(item => item.term.trim().length > 2)
      .slice(0, 10);

    // Pivot user actions & build dependencies and consulting users
    const userMap = {};
    const depMap = {};
    const userToDep = {};
    
    allUsers.forEach(u => {
      userToDep[u.id] = u.dependencia || 'Sin dependencia';
      if (u.email) userToDep[u.email] = u.dependencia || 'Sin dependencia';
      if (u.username) userToDep[u.username] = u.dependencia || 'Sin dependencia';
      if (u.nombre) userToDep[u.nombre] = u.dependencia || 'Sin dependencia';
    });

    rawUserActions.forEach(row => {
      const u = row.user_name || 'Desconocido';
      if (!userMap[u]) userMap[u] = { user_name: u, totalActivity: 0 };
      userMap[u][row.action] = Number(row.total);
      userMap[u].totalActivity += Number(row.total);
      
      const dep = userToDep[row.user_id] || userToDep[row.user_name] || 'Sin dependencia';
      // Solo contar "Inicio de sesión" para el gráfico/tabla de dependencias
      if (row.action === 'Inicio de sesión') {
        depMap[dep] = (depMap[dep] || 0) + Number(row.total);
      }
    });
    
    const userActionsPivot = Object.values(userMap)
      .sort((a, b) => b.totalActivity - a.totalActivity)
      .slice(0, 10);
      
    const byDependencia = Object.entries(depMap)
      .map(([dependencia, total]) => ({ dependencia, total }))
      .sort((a, b) => b.total - a.total);
      
    const topConsultingUsers = Object.values(userMap)
      .filter(u => u['Consulta'] > 0)
      .map(u => ({ user_name: u.user_name, total: u['Consulta'] }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    return res.json({
      success: true,
      days,
      stats: { 
        totalEvents, todayEvents, activeUsers7d, loginEvents, errorEvents, downloadEvents, 
        byModule, byRole, byDay, byHour, topUsers, recent, byAction,
        topDescargas, topBusquedas, topLogins, documentosInactivos, failedAttempts,
        loginsByDay, userActionsPivot, byDependencia, topConsultingUsers, loginsByRole,
        topErrors, topVulnerabilidades
      }
    });
  } catch (err) {
    console.error('[activityController.getStats]', err);
    return res.status(500).json({ 
      success: false, 
      message: `Error al obtener estadísticas de actividad: ${err.message}` 
    });
  }
};

module.exports = { getStats };
