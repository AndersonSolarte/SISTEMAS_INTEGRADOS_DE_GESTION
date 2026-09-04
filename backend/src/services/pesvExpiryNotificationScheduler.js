const { Op } = require('sequelize');
const { PesvParqueaderoRegistro } = require('../models');
const { sendMailDirect, renderInstitutionalTemplate, escapeHtml } = require('./emailService');

const TIMEZONE = 'America/Bogota';
const PESV_REPLY_TO = String(process.env.PESV_REPLY_TO_EMAIL || 'seguridadysalud@unicesmag.edu.co').trim().toLowerCase();
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
  const isLicencia = tipo === 'licencia';
  const isRtm = tipo === 'tecnomecanica';
  const documentName = isLicencia ? 'licencia de conducción' : isRtm ? 'certificado de revisión técnico-mecánica (RTM)' : 'Seguro Obligatorio de Accidentes de Tránsito (SOAT)';
  const documentTitle = isLicencia ? 'Licencia de Conducción' : isRtm ? 'Revisión Técnico-Mecánica y de Emisiones Contaminantes (RTM)' : 'SOAT';
  const plateLabel = row.placa || row.identificacion || 'Sin placa registrada';
  const notificationTitle = isLicencia
    ? `Plan Estratégico de Seguridad Vial - Licencia de Conducción - ${row.nombres_apellidos}`
    : `Plan Estratégico de Seguridad Vial - ${documentTitle} - Placa ${plateLabel}`;
  const date = row[isLicencia ? 'licencia_vencimiento' : isRtm ? 'tecnomecanica_vigencia' : 'soat_vigencia'];
  const days = daysBetween(bogotaDateIso(), date);
  const dateLabel = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${date}T00:00:00Z`));
  const daysLabel = `${days} ${Math.abs(days) === 1 ? 'día' : 'días'}`;
  const expiresToday = days === 0;
  const isExpired = days < 0;
  const statusText = expiresToday
    ? `vence hoy, ${dateLabel}`
    : isExpired
      ? `se encuentra vencido desde el ${dateLabel}`
      : `está próximo a vencer. Su vigencia finaliza el ${dateLabel} (faltan ${daysLabel})`;
  const recommendationText = expiresToday
    ? 'le recomendamos iniciar la gestión de renovación a partir del día de hoy'
    : isExpired
      ? 'le recomendamos gestionar la renovación a la mayor brevedad posible'
      : 'le recomendamos programar oportunamente la renovación antes de la fecha de vencimiento';
  const body = `
    <p>Saludo de Paz y Bien,</p>
    <p>Estimado(a) <strong>${escapeHtml(row.nombres_apellidos)}</strong>:</p>
    <p>En cumplimiento del <strong>Plan Estratégico de Seguridad Vial de la Universidad CESMAG</strong>, nos permitimos informarle que su <strong>${escapeHtml(documentName)}</strong> ${row.licencia_categorias ? `(Categoría: ${escapeHtml(row.licencia_categorias)})` : ''} ${escapeHtml(statusText)}.</p>
    <p>En este sentido, ${escapeHtml(recommendationText)}.</p>
    <p>Cuando haya finalizado la renovación de su documento, le agradecemos <strong>responder a este mismo correo</strong> confirmando la actualización para mantener al día el registro en el sistema institucional.</p>
    <p>Al seleccionar <strong>Responder</strong>, su mensaje será dirigido automáticamente a <a href="mailto:${escapeHtml(PESV_REPLY_TO)}" style="color:#0b3a6f;font-weight:bold;">${escapeHtml(PESV_REPLY_TO)}</a>.</p>
    <p>La vigencia de su licencia de conducción es un requisito obligatorio para la asignación y uso del cupo de parqueadero institucional.</p>
    <p>Agradecemos su atención y quedamos atentos a su confirmación.</p>
  `;
  const threadId = `<pesv-parqueadero-${row.id}@unicesmag.edu.co>`;
  return sendMailDirect({
    to: row.correo,
    subject: notificationTitle,
    replyTo: PESV_REPLY_TO,
    inReplyTo: threadId,
    references: threadId,
    headers: { 'In-Reply-To': threadId, References: threadId },
    text: `Saludo de Paz y Bien. Estimado(a) ${row.nombres_apellidos}: En cumplimiento del Plan Estratégico de Seguridad Vial de la Universidad CESMAG, informamos que su ${documentName} ${row.licencia_categorias ? `(Categoría: ${row.licencia_categorias})` : ''} ${statusText}. En este sentido, ${recommendationText}. Cuando haya renovado su documento, agradecemos responder a este correo confirmando la actualización. La respuesta será dirigida automáticamente a ${PESV_REPLY_TO}. La vigencia de su licencia es fundamental para el uso del cupo de parqueadero. Fraternalmente, Seguridad y Salud en el Trabajo.`,
    html: renderInstitutionalTemplate({ title: notificationTitle, introHtml: '', bodyHtml: body, senderHtml })
  });
};

const sendPesvRuntUpdateConfirmation = async (row, { soat = null, rtm = null } = {}) => {
  if (!String(row?.correo || '').trim()) return { success: false, error: 'El registro no tiene correo electrónico' };
  const plateLabel = row.placa || row.identificacion || 'Sin placa registrada';
  const confirmedDocuments = [soat && 'SOAT', rtm && 'Revisión Técnico-Mecánica (RTM)'].filter(Boolean).join(' y ');
  const title = `Plan Estratégico de Seguridad Vial - Actualización ${confirmedDocuments || 'documental'} - Placa ${plateLabel}`;
  const formatDate = (value) => value
    ? new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00Z`))
    : '';
  const details = [
    soat && `<li><strong>SOAT:</strong> ${soat.fecha_fin ? `vigencia registrada hasta el ${escapeHtml(formatDate(soat.fecha_fin))}` : escapeHtml(soat.estado || 'información registrada')}.</li>`,
    rtm && `<li><strong>Revisión Técnico-Mecánica (RTM):</strong> ${rtm.fecha_vigencia ? `vigencia registrada hasta el ${escapeHtml(formatDate(rtm.fecha_vigencia))}` : escapeHtml(rtm.estado === 'NO_EXIGIBLE' ? 'no exigible a la fecha según la información consultada' : rtm.estado || 'información registrada')}.</li>`
  ].filter(Boolean).join('');
  const body = `
    <p>Saludo de Paz y Bien,</p>
    <p>Estimado(a) <strong>${escapeHtml(row.nombres_apellidos)}</strong>:</p>
    <p>Le confirmamos que la información documental del vehículo de placa <strong>${escapeHtml(plateLabel)}</strong> fue consultada en RUNT y actualizada en el sistema institucional.</p>
    ${details ? `<ul>${details}</ul>` : ''}
    <p>No es necesario enviar ni adjuntar documentos. El registro queda sujeto al seguimiento periódico del Plan Estratégico de Seguridad Vial.</p>
    <p>Agradecemos su confirmación y la actualización oportuna de la información.</p>
  `;
  return sendMailDirect({
    to: row.correo,
    subject: title,
    replyTo: PESV_REPLY_TO,
    text: `Saludo de Paz y Bien. Estimado(a) ${row.nombres_apellidos}: Le confirmamos que la información de ${confirmedDocuments || 'los documentos'} del vehículo de placa ${plateLabel} fue consultada en RUNT y actualizada en el sistema institucional. No es necesario enviar ni adjuntar documentos. Fraternalmente, Seguridad y Salud en el Trabajo.`,
    html: renderInstitutionalTemplate({ title, introHtml: '', bodyHtml: body, senderHtml })
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
          { tecnomecanica_vigencia: { [Op.between]: [today, limit] } },
          { licencia_vencimiento: { [Op.between]: [today, limit] } }
        ]
      }
    });
    const result = { reviewed: rows.length, sent: 0, failed: 0, skipped: 0 };
    const configs = [
      { tipo: 'soat', dateField: 'soat_vigencia', notificationField: 'ultima_notificacion_soat' },
      { tipo: 'tecnomecanica', dateField: 'tecnomecanica_vigencia', notificationField: 'ultima_notificacion_tecnomecanica' },
      { tipo: 'licencia', dateField: 'licencia_vencimiento', notificationField: 'ultima_notificacion_licencia' }
    ];
    for (const row of rows) {
      if (!String(row.correo || '').trim()) continue;
      for (const config of configs) {
        if ((config.tipo === 'soat' || config.tipo === 'tecnomecanica') && isBicycleVehicle(row)) continue;
        const outcome = await claimAndSend(row, config, now);
        result[outcome] += 1;
      }
    }
    console.log(`[pesv-notificaciones] Revisión finalizada: ${result.sent} enviadas, ${result.failed} fallidas, ${result.skipped} omitidas.`);
    return result;
  })();
  try { return await activeRun; } finally { activeRun = null; }
};

const isProductionEnvironment = () => process.env.NODE_ENV === 'production';

const schedulerTick = async () => {
  const isProd = isProductionEnvironment();
  const defaultEnabled = isProd ? 'true' : 'false';
  const isEnabled = String(process.env.PESV_AUTOMATIC_NOTIFICATIONS_ENABLED || defaultEnabled).toLowerCase() === 'true';
  if (!isEnabled) return;

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
  const isProd = isProductionEnvironment();
  const defaultEnabled = isProd ? 'true' : 'false';
  const isEnabled = String(process.env.PESV_AUTOMATIC_NOTIFICATIONS_ENABLED || defaultEnabled).toLowerCase() === 'true';
  if (!isEnabled) {
    console.log('[pesv-notificaciones] Programador automático deshabilitado en entorno local de desarrollo.');
    return;
  }
  schedulerTick().catch((error) => console.error('[pesv-notificaciones] Error inicial:', error.message));
  scheduleNextTick();
  console.log(`[pesv-notificaciones] Programador listo: avisos a ${NOTIFICATION_DAYS} días y el día del vencimiento, revisión diaria desde las ${String(SCHEDULE_HOUR).padStart(2, '0')}:00 ${TIMEZONE}.`);
};

module.exports = {
  startPesvExpiryNotificationScheduler,
  runPesvExpiryNotifications,
  sendPesvExpiryNotification,
  sendPesvRuntUpdateConfirmation,
  isBicycleVehicle,
  _internals: { shouldNotifyDocument, getNotificationMilestone, millisecondsUntilNextRun, bogotaDateIso, addDaysIso, daysBetween, NOTIFICATION_DAYS }
};
