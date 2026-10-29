const { Op } = require('sequelize');
const {
  ViaticosLegalizacion,
  DesplazamientoViaticosSolicitud,
  User
} = require('../../models');
const { sendInstitutionalEmail, renderInstitutionalTemplate, escapeHtml } = require('../emailService');
const { addColombiaBusinessDays } = require('../../utils/colombiaBusinessDays');
const { normalizeEmail } = require('../../config/desplazamientoViaticosConfig');

const TIMEZONE = 'America/Bogota';
const SCHEDULE_HOUR = Math.min(23, Math.max(0, Number(process.env.LEGALIZACION_NOTIFICATION_HOUR || 7)));

let schedulerTimer = null;
let lastRunKey = '';
let activeRun = null;

const bogotaParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
  timeZone: TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
}).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));

const bogotaDateIso = (date = new Date()) => {
  const parts = bogotaParts(date);
  return `${parts.year}-${parts.month}-${parts.day}`;
};

const formatDateEs = (isoDate) => {
  if (!isoDate) return 'No especificada';
  try {
    const [year, month, day] = String(isoDate).slice(0, 10).split('-').map(Number);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
    return new Intl.DateTimeFormat('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      timeZone: 'UTC'
    }).format(date);
  } catch (_) {
    return String(isoDate).slice(0, 10);
  }
};

const currency = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

const controlledTestRecipients = (solicitud) => {
  if (!solicitud?.datos_viaticos?.pruebaControlada) return null;
  const configured = Array.isArray(solicitud.datos_viaticos.correosPrueba)
    ? solicitud.datos_viaticos.correosPrueba
    : [];
  return [...new Set(configured.map(normalizeEmail).filter(Boolean))];
};

const getRecipientsForLegalizacion = (legalizacion) => {
  const sol = legalizacion.solicitud;
  const testRecipients = controlledTestRecipients(sol);
  if (testRecipients && testRecipients.length > 0) return testRecipients;
  const collaboratorEmail = normalizeEmail(sol?.solicitante_snapshot?.email || legalizacion.colaborador?.email);
  return collaboratorEmail ? [collaboratorEmail] : [];
};

const buildReminderEmail = (legalizacion) => {
  const sol = legalizacion.solicitud || {};
  const isTest = Boolean(controlledTestRecipients(sol));
  const testPrefix = isTest ? 'PRUEBA CONTROLADA | ' : '';
  const frontendUrl = (process.env.PUBLIC_FRONTEND_URL || process.env.FRONTEND_URL || 'https://siac.unicesmag.edu.co').replace(/\/+$/, '');
  const portalUrl = `${frontendUrl}/dashboard/legalizacion-viaticos`;

  const solicitanteNombre = sol.solicitante_snapshot?.nombre || legalizacion.colaborador?.nombre || 'Colaborador(a)';
  const consecutivo = sol.consecutivo || `REG-${legalizacion.id}`;
  const destino = sol.datos_viaticos?.lugarVisitar || sol.datos_salida?.municipio || 'Destino institucional';
  const fechaSalida = sol.datos_salida?.fecha || 'No especificada';
  const fechaRegreso = sol.datos_salida?.fechaRegreso || legalizacion.fecha_habilitacion;
  const fechaLimite = legalizacion.fecha_limite || addColombiaBusinessDays(fechaRegreso, 3);
  const totalAnticipo = Number(sol.liquidacion?.totalAnticipo) || (legalizacion.detalles || []).reduce((acc, row) => acc + Number(row.valorAnticipo || 0), 0);

  const subject = `${testPrefix}Recordatorio: Habilitada legalización de viáticos | ${consecutivo}`;
  const messageId = `<recordatorio-legalizacion-${legalizacion.id}-${legalizacion.codigo_verificacion}-${legalizacion.fecha_habilitacion}@siac.unicesmag.edu.co>`;

  const bodyHtml = `
    <p style="margin: 0 0 12px 0;">Saludo de paz y bien,</p>
    <p style="margin: 0 0 14px 0;">
      Estimado(a) <strong>${escapeHtml(solicitanteNombre)}</strong>:
    </p>
    <p style="margin: 0 0 14px 0; line-height: 1.6;">
      Le informamos que a partir de su regreso de la comisión institucional, se encuentra habilitado en el sistema institucional <strong>SIAC</strong> el módulo de <strong>Legalización de viáticos</strong> correspondiente a su solicitud <strong>${escapeHtml(consecutivo)}</strong> con destino a <strong>${escapeHtml(destino)}</strong>.
    </p>
    <p style="margin: 0 0 16px 0; line-height: 1.6; color: #0b3a6f; font-weight: 700;">
      De conformidad con la reglamentación institucional (Acuerdo 001 de 2013), dispone de un plazo de tres (3) días hábiles (hasta el ${escapeHtml(formatDateEs(fechaLimite))}) a partir de esta notificación para realizar la legalización de los recursos otorgados y adjuntar los respectivos soportes.
    </p>

    <!-- Resumen de la Comisión -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse: separate; border: 1px solid #dce6f2; border-radius: 12px; overflow: hidden; background-color: #ffffff; margin: 18px 0; box-shadow: 0 4px 14px rgba(11, 58, 111, 0.05); font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">
      <tr>
        <td style="padding: 14px 18px; background-color: #0b3a6f; color: #ffffff;">
          <div style="font-size: 11px; font-weight: 800; letter-spacing: 0.8px; text-transform: uppercase; color: #bfdbfe; margin-bottom: 2px;">INFORMACIÓN DEL DESPLAZAMIENTO</div>
          <div style="font-size: 16px; font-weight: 800; color: #ffffff;">${escapeHtml(consecutivo)}</div>
        </td>
      </tr>
      <tr>
        <td style="padding: 16px 18px; background-color: #f8fbff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td width="50%" valign="top" style="padding-bottom: 10px;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Lugar de destino</div>
                <div style="font-size: 13.5px; font-weight: 700; color: #1e293b;">${escapeHtml(destino)}</div>
              </td>
              <td width="50%" valign="top" style="padding-bottom: 10px;">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Total anticipo recibido</div>
                <div style="font-size: 14px; font-weight: 800; color: #0b3a6f;">${escapeHtml(currency(totalAnticipo))}</div>
              </td>
            </tr>
            <tr>
              <td width="50%" valign="top">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 3px;">Fechas de la comisión</div>
                <div style="font-size: 12.5px; font-weight: 600; color: #334155;">Del ${escapeHtml(fechaSalida)} al ${escapeHtml(fechaRegreso)}</div>
              </td>
              <td width="50%" valign="top">
                <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; color: #b91c1c; margin-bottom: 3px;">Plazo máximo de legalización</div>
                <div style="font-size: 13px; font-weight: 800; color: #b91c1c;">${escapeHtml(formatDateEs(fechaLimite))}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <p style="margin: 0 0 16px 0; font-size: 13.5px; line-height: 1.6; color: #334155;">
      En el sistema <strong>SIAC</strong> encontrará el módulo <strong>«Legalización de viáticos»</strong> visible y activo en su menú lateral mientras tenga obligaciones pendientes. Una vez presentada la legalización y validada por el Técnico Contable, este módulo se desactivará automáticamente de su panel.
    </p>

    <!-- Botón de acción -->
    <div style="text-align: center; margin: 26px 0 20px 0;">
      <a href="${escapeHtml(portalUrl)}" style="display: inline-block; background-color: #0b3a6f; color: #ffffff; text-decoration: none; padding: 13px 28px; border-radius: 8px; font-size: 14px; font-weight: 800; letter-spacing: 0.3px; box-shadow: 0 4px 12px rgba(11, 58, 111, 0.25);">
        Ingresar al SIAC y legalizar viáticos
      </a>
    </div>

    <p style="margin: 0; font-size: 12px; color: #64748b; text-align: center;">
      Si ya presentó los soportes o la comisión fue cancelada, por favor comuníquese con el Técnico Contable de la Vicerrectoría Financiera.
    </p>
  `;

  return {
    subject,
    messageId,
    html: renderInstitutionalTemplate({
      title: 'Plazo para legalización de viáticos',
      introHtml: '',
      bodyHtml
    }),
    text: `Saludo de paz y bien. Estimado(a) ${solicitanteNombre}: Le informamos que a partir de su regreso de la comisión a ${destino} (${consecutivo}), se encuentra activo en el sistema SIAC el módulo de Legalización de viáticos. Dispone de tres (3) días hábiles (hasta el ${formatDateEs(fechaLimite)}) para registrar la legalización. Puede ingresar directamente en: ${portalUrl}`
  };
};

const runLegalizacionReturnReminders = async ({ now = new Date(), force = false } = {}) => {
  if (activeRun && !force) return activeRun;

  activeRun = (async () => {
    const today = bogotaDateIso(now);
    const summary = {
      processed: 0,
      sent: 0,
      failed: 0,
      skipped: 0,
      errors: []
    };

    try {
      const pending = await ViaticosLegalizacion.findAll({
        where: {
          notificacion_retorno_at: null,
          fecha_habilitacion: { [Op.lte]: today },
          estado: { [Op.in]: ['pendiente_habilitacion', 'pendiente_legalizacion', 'legalizacion_vencida'] }
        },
        include: [
          {
            model: DesplazamientoViaticosSolicitud,
            as: 'solicitud',
            required: true,
            where: {
              estado: { [Op.ne]: 'no_aprobada' }
            }
          },
          {
            model: User,
            as: 'colaborador',
            required: false
          }
        ],
        order: [['fecha_habilitacion', 'ASC'], ['id', 'ASC']]
      });

      for (const legalizacion of pending) {
        summary.processed += 1;
        const recipients = getRecipientsForLegalizacion(legalizacion);
        const sol = legalizacion.solicitud;

        if (!recipients || recipients.length === 0) {
          summary.skipped += 1;
          summary.errors.push({
            id: legalizacion.id,
            consecutivo: sol.consecutivo,
            error: 'Sin correo electrónico del colaborador'
          });
          continue;
        }

        try {
          const emailData = buildReminderEmail(legalizacion);
          const mailResult = await sendInstitutionalEmail({
            to: recipients,
            subject: emailData.subject,
            messageId: emailData.messageId,
            text: emailData.text,
            html: emailData.html
          });

          if (mailResult.success) {
            summary.sent += 1;
            const nowIso = new Date().toISOString();
            const currentTrace = legalizacion.trazabilidad || [];
            await legalizacion.update({
              notificacion_retorno_at: new Date(),
              estado: legalizacion.estado === 'pendiente_habilitacion' ? 'pendiente_legalizacion' : legalizacion.estado,
              trazabilidad: [
                ...currentTrace,
                {
                  event: 'recordatorio_retorno_enviado',
                  actor: { nombre: 'Sistema SIAC', rol: 'Notificación automática' },
                  detail: {
                    destinatarios: recipients,
                    fecha_habilitacion: legalizacion.fecha_habilitacion,
                    fecha_limite: legalizacion.fecha_limite
                  },
                  at: nowIso
                }
              ]
            });
          } else {
            summary.failed += 1;
            summary.errors.push({
              id: legalizacion.id,
              consecutivo: sol.consecutivo,
              error: mailResult.error || 'Fallo de entrega de correo'
            });
          }
        } catch (err) {
          summary.failed += 1;
          summary.errors.push({
            id: legalizacion.id,
            consecutivo: sol.consecutivo,
            error: err.message
          });
        }
      }

      console.log(`[legalizacion-recordatorios] Lote procesado: ${summary.processed} revisadas, ${summary.sent} enviadas, ${summary.failed} fallidas, ${summary.skipped} omitidas.`);
      return summary;
    } catch (globalError) {
      console.error('[legalizacion-recordatorios] Error crítico en lote:', globalError);
      summary.criticalError = globalError.message;
      return summary;
    }
  })();

  try {
    return await activeRun;
  } finally {
    activeRun = null;
  }
};

const isProductionEnvironment = () => process.env.NODE_ENV === 'production';

const millisecondsUntilNextRun = (now = new Date()) => {
  const parts = bogotaParts(now);
  const currentLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
  let targetLocal = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), SCHEDULE_HOUR, 0, 0);
  if (targetLocal <= currentLocal) targetLocal += 86400000;
  return Math.max(1000, targetLocal - currentLocal);
};

const schedulerTick = async () => {
  const isProd = isProductionEnvironment();
  const defaultEnabled = isProd ? 'true' : 'false';
  const isEnabled = String(process.env.LEGALIZACION_AUTOMATIC_NOTIFICATIONS_ENABLED || defaultEnabled).toLowerCase() === 'true';
  if (!isEnabled) return;

  const parts = bogotaParts();
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  if (Number(parts.hour) < SCHEDULE_HOUR || lastRunKey === key) return;
  lastRunKey = key;
  await runLegalizacionReturnReminders();
};

const scheduleNextTick = () => {
  if (schedulerTimer) clearTimeout(schedulerTimer);
  schedulerTimer = setTimeout(async () => {
    try {
      await schedulerTick();
    } catch (error) {
      console.error('[legalizacion-recordatorios] Error del programador:', error.message);
    } finally {
      scheduleNextTick();
    }
  }, millisecondsUntilNextRun());
  schedulerTimer.unref?.();
};

const startLegalizacionReminderScheduler = () => {
  const isProd = isProductionEnvironment();
  const defaultEnabled = isProd ? 'true' : 'false';
  const isEnabled = String(process.env.LEGALIZACION_AUTOMATIC_NOTIFICATIONS_ENABLED || defaultEnabled).toLowerCase() === 'true';
  if (!isEnabled) {
    console.log('[legalizacion-recordatorios] Programador automático deshabilitado en entorno local de desarrollo.');
    return;
  }
  schedulerTick().catch((error) => console.error('[legalizacion-recordatorios] Error inicial:', error.message));
  scheduleNextTick();
  console.log(`[legalizacion-recordatorios] Programador listo: recordatorio diario a las ${String(SCHEDULE_HOUR).padStart(2, '0')}:00 ${TIMEZONE} en fecha de regreso.`);
};

module.exports = {
  startLegalizacionReminderScheduler,
  runLegalizacionReturnReminders,
  buildReminderEmail,
  getRecipientsForLegalizacion,
  _internals: {
    bogotaParts,
    bogotaDateIso,
    millisecondsUntilNextRun,
    formatDateEs,
    SCHEDULE_HOUR
  }
};
