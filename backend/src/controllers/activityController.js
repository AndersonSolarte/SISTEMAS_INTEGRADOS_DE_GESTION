const { Op, fn, col, literal } = require('sequelize');
const { sequelize } = require('../config/database');
const UserActivityLog = require('../models/UserActivityLog');

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
    const since = daysAgo(days);
    const today = daysAgo(0);

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
      recent
    ] = await Promise.all([
      /* total events in range */
      UserActivityLog.count({ where: { created_at: { [Op.gte]: since } } }),

      /* today */
      UserActivityLog.count({ where: { created_at: { [Op.gte]: today } } }),

      /* distinct users last 7 days */
      UserActivityLog.count({
        distinct: true,
        col: 'user_id',
        where: { created_at: { [Op.gte]: daysAgo(7) }, user_id: { [Op.ne]: null } }
      }),

      /* login events in range */
      UserActivityLog.count({
        where: { action: 'Inicio de sesión', created_at: { [Op.gte]: since } }
      }),

      /* events by module */
      UserActivityLog.findAll({
        attributes: ['module', [fn('COUNT', col('id')), 'total']],
        where: { created_at: { [Op.gte]: since } },
        group: ['module'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        raw: true
      }),

      /* events by role */
      UserActivityLog.findAll({
        attributes: ['user_role', [fn('COUNT', col('id')), 'total']],
        where: { created_at: { [Op.gte]: since } },
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
        where: { created_at: { [Op.gte]: since } },
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
        where: { created_at: { [Op.gte]: since } },
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
        where: { created_at: { [Op.gte]: since }, user_id: { [Op.ne]: null } },
        group: ['user_id', 'user_name', 'user_email', 'user_role'],
        order: [[fn('COUNT', col('id')), 'DESC']],
        limit: 10,
        raw: true
      }),

      /* last 50 events */
      UserActivityLog.findAll({
        where: { created_at: { [Op.gte]: since } },
        order: [['created_at', 'DESC']],
        limit: 50,
        raw: true
      })
    ]);

    return res.json({
      success: true,
      days,
      stats: { totalEvents, todayEvents, activeUsers7d, loginEvents, byModule, byRole, byDay, byHour, topUsers, recent }
    });
  } catch (err) {
    console.error('[activityController.getStats]', err);
    return res.status(500).json({ success: false, message: 'Error al obtener estadísticas de actividad.' });
  }
};

module.exports = { getStats };
