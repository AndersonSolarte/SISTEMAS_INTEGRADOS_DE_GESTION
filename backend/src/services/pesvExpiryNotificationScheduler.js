const { Op } = require('sequelize');
const { PesvParqueaderoRegistro } = require('../models');
const { sendMailDirect, renderInstitutionalTemplate, escapeHtml } = require('./emailService');

const TIMEZONE = 'America/Bogota';
const NOTIFICATION_DAYS = Math.max(1, Number(process.env.PESV_NOTIFICATION_DAYS_BEFORE || 15));
const SCHEDULE_HOUR = Math.min(23, Math.max(0, Number(process.env.PESV_NOTIFICATION_HOUR || 7)));

let schedulerTimer = null;
let lastRunKey = '';
let activeRun = null;

const bogotaParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
}).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

const bogotaDateIso = (date = new Date()) => {
  const parts = bogotaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};
const addDaysIso = (isoDate, days) => {
  const [year, month, day] = String(isoDate).split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
};
const daysBetween = (fromIso, toIso) => Math.round((new Date(`${toIso}T00:00:00Z`) - new Date(`${fromIso}T00:00:00Z`)) / 86400000);
const isBicycleVehicle = (row = {}) => [row.tipo_vehiculo, row.vehiculo_clase]
  .some((value) => /\b(BICI|BICICLETA|CICLA)\b/.test(String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()));

const getNotificationMilestone = ({ expiryDate, now = new Date() }) => {
  if (!expiryDate) return false;
  const today = bogotaDateIso(now);
  const days = daysBetween(today, expiryDate);
  if (days === NOTIFICATION_DAYS) return { key: 'ADVANCE_NOTICE', date: today, days };
  if (days === 0) return { key: 'EXPIRY_DAY', date: today, days };
  return null;
};
const shouldNotifyDocument = ({ expiryDate, lastNotifiedAt, now = new Date() }) => {
  const milestone = getNotificationMilestone({ expiryDate, now });
  if (!milestone) return false;
  return !lastNotifiedAt || bogotaDateIso(new Date(lastNotifiedAt)) < milestone.date;
};

const senderHtml = `
  <p style="margin: 0; font-weight: bold; color: #0b3a6f;">Seguridad y Salud en el Trabajo</p>
  <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">Plan Estratégico de Seguridad Vial · UNICESMAG</p>
  <p style="margin: 2px 0 0 0; font-size: 11.5px; color: #64748b;">Hombres nuevos para tiempos nuevos</p>
`;

const sendPesvExpiryNotification = async (row, tipo) => {
  const isRtm = tipo === 'tecnomecanica';
  const documentType = isRtm ? 'tecnomecánica' : 'SOAT';
  const date = row[isRtm ? 'tecnomecanica_vigencia' : 'soat_vigencia'];
  const days = daysBetween(bogotaDateIso(), date);
  const dateLabel = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const daysLabel = `${days} ${Math.abs(days) === 1 ? 'día' : 'días'}`;
  const expiresToday = days === 0;
  const statusText = expiresToday ? `vence hoy, ${dateLabel}` : days < 0 ? `se encuentra vencido desde el ${dateLabel}` : `vence el ${dateLabel} (${daysLabel})`;
  const actionText = expiresToday
    ? 'Este es el último día de vigencia. Le solicitamos gestionar la renovación y actualizar la información institucional para evitar que el documento quede vencido.'
    : 'Le agradecemos realizar la renovación y actualizar oportunamente la información institucional.';
  const body = `<p>Saludo cordial, <strong>${escapeHtml(row.nombres_apellidos)}</strong>.</p><p>Desde el Plan Estratégico de Seguridad Vial de UNICESMAG informamos que el documento <strong>${escapeHtml(documentType)}</strong> asociado al vehículo de placa <strong>${escapeHtml(row.placa || 'sin placa registrada')}</strong> ${escapeHtml(statusText)}.</p><p>${escapeHtml(actionText)}</p>`;
  const threadId = `<pesv-parqueadero-${row.id}@unicesmag.edu.co>`;
  return sendMailDirect({
    to: row.correo,
    subject: `[PESV UNICESMAG] Vigencias Documentales · Placa ${row.placa || row.identificacion || 'Vehículo'}`,
    inReplyTo: threadId,
    references: threadId,
    headers: { 'In-Reply-To': threadId, References: threadId },
    text: `Saludo cordial, ${row.nombres_apellidos}. Su ${documentType} asociado a la placa ${row.placa || 'sin placa'} ${statusText}. ${actionText} Fraternalmente, Seguridad y Salud en el Trabajo, Plan Estratégico de Seguridad Vial de UNICESMAG.`,
    html: renderInstitutionalTemplate({ title: `Aviso de vigencia ${documentType}`, introHtml: '', bodyHtml: body, senderHtml })
  });
};

const claimAndSend = async (row, config, now) => {
  const expiryDate = row[config.dateField];
  const previousNotification = row[config.notificationField];
  if (!shouldNotifyDocument({ expiryDate, lastNotifiedAt: previousNotification, now })) return 'skipped';

  const milestone = getNotificationMilestone({ expiryDate, now });
  if (!milestone) return 'skipped';
  const threshold = new Date(`${milestone.date}T00:00:00-05:00`);
  const claimAt = new Date();
  const [claimed] = await PesvParqueaderoRegistro.update(
    { [config.notificationField]: claimAt },
    { where: { id: row.id, [Op.or]: [{ [config.notificationField]: null }, { [config.notificationField]: { [Op.lt]: threshold } }] } }
  );
  if (!claimed) return 'skipped';

  const result = await sendPesvExpiryNotification(row, config.tipo);
  if (result.success) return 'sent';
  await PesvParqueaderoRegistro.update(
    { [config.notificationField]: previousNotification || null },
    { where: { id: row.id, [config.notificationField]: claimAt } }
  );
  console.error(`[pesv-notificaciones] No se pudo enviar ${config.tipo} a ${row.correo}: ${result.error}`);
  return 'failed';
};

const runPesvExpiryNotifications = async ({ now = new Date() } = {}) => {
  if (activeRun) return activeRun;
  activeRun = (async () => {
    const today = bogotaDateIso(now);
    const limit = addDaysIso(today, NOTIFICATION_DAYS);
    const rows = await PesvParqueaderoRegistro.findAll({
      where: {
        correo: { [Op.ne]: null },
        [Op.or]: [
          { soat_vigencia: { [Op.between]: [today, limit] } },
          { tecnomecanica_vigencia: { [Op.between]: [today, limit] } }
        ]
      }
    });
    const result = { reviewed: rows.length, sent: 0, failed: 0, skipped: 0 };
    const configs = [
      { tipo: 'soat', dateField: 'soat_vigencia', notificationField: 'ultima_notificacion_soat' },
      { tipo: 'tecnomecanica', dateField: 'tecnomecanica_vigencia', notificationField: 'ultima_notificacion_tecnomecanica' }
    ];
    for (const row of rows) {
      if (isBicycleVehicle(row) || !String(row.correo || '').trim()) continue;
      for (const config of configs) {
        const outcome = await claimAndSend(row, config, now);
        result[outcome] += 1;
      }
    }
    console.log(`[pesv-notificaciones] Revisión finalizada: ${result.sent} enviadas, ${result.failed} fallidas, ${result.skipped} omitidas.`);
    return result;
  })();
  try { return await activeRun; } finally { activeRun = null; }
};

const schedulerTick = async () => {
  if (String(process.env.PESV_AUTOMATIC_NOTIFICATIONS_ENABLED || 'true').toLowerCase() === 'false') return;
  const parts = bogotaParts();
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) < SCHEDULE_HOUR || lastRunKey === key) return;
  lastRunKey = key;
  await runPesvExpiryNotifications();
};

const millisecondsUntilNextRun = (now = new Date()) => {
  const parts = bogotaParts(now);
  const currentLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  let targetLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), SCHEDULE_HOUR, 0, 0);
  if (targetLocal <= currentLocal) targetLocal += 86400000;
  return Math.max(1000, targetLocal - currentLocal);
};

const scheduleNextTick = () => {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = setTimeout(async () => {
    try { await schedulerTick(); }
    catch (error) { console.error('[pesv-notificaciones] Error del programador:', error.message); }
    finally { scheduleNextTick(); }
  }, millisecondsUntilNextRun());
  schedulerTimer.unref?.();
};

const startPesvExpiryNotificationScheduler = () => {
  schedulerTick().catch((error) => console.error('[pesv-notificaciones] Error inicial:', error.message));
  scheduleNextTick();
  console.log(`[pesv-notificaciones] Programador listo: avisos a ${NOTIFICATION_DAYS} días y el día del vencimiento, revisión diaria desde las ${String(SCHEDULE_HOUR).padStart(2, '0')}:00 ${TIMEZONE}.`);
};

module.exports = {
  startPesvExpiryNotificationScheduler,
  runPesvExpiryNotifications,
  sendPesvExpiryNotification,
  isBicycleVehicle,
  _internals: { shouldNotifyDocument, getNotificationMilestone, millisecondsUntilNextRun, bogotaDateIso, addDaysIso, daysBetween, NOTIFICATION_DAYS }
};
