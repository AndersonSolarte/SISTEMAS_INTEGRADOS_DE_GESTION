const crypto = require('crypto');
const { Op } = require('sequelize');
const { SystemSetting } = require('../../models');

// Cola durable: contiene referencias y estado de entrega, nunca documentos.
const PREFIX = 'viaticos_legalizacion_presentacion_';
const LEASE_MS = 10 * 60 * 1000;
let running = null;
let timer = null;

const enqueueSubmissionEmail = (legalizacionId, { transaction } = {}) => SystemSetting.create({
  key: `${PREFIX}${legalizacionId}`,
  value: { legalizacionId, status: 'queued', attempts: 0, nextAttemptAt: new Date().toISOString() }
}, { transaction });

const enqueueWorkflowEmail = (legalizacionId, kind, { transaction, context = {} } = {}) => SystemSetting.create({
  key: `${PREFIX}${legalizacionId}_${kind}_${crypto.randomUUID()}`,
  value: { legalizacionId, kind, context, status: 'queued', attempts: 0, nextAttemptAt: new Date().toISOString() }
}, { transaction });

const processJob = async (job, sendNotification, now) => {
  const previous = job.value;
  const claim = {
    ...previous, status: 'processing', attempts: Number(previous.attempts || 0) + 1,
    leaseUntil: new Date(now.getTime() + LEASE_MS).toISOString(), claimId: crypto.randomUUID()
  };
  // Comparar el JSON completo impide que dos instancias reclamen el mismo envío.
  const [claimed] = await SystemSetting.update({ value: claim }, {
    where: { key: job.key, value: { [Op.eq]: previous } }
  });
  if (!claimed) return 'skipped';
  try {
    const result = await sendNotification(previous.legalizacionId, previous.kind, previous.context, job.key);
    if (!result?.success) throw new Error(result?.error || 'El servicio de correo no confirmó el envío.');
    await SystemSetting.destroy({ where: { key: job.key, value: { [Op.eq]: claim } } });
    return 'sent';
  } catch (error) {
    const delay = Math.min(60 * 60 * 1000, 30000 * (2 ** Math.min(claim.attempts - 1, 7)));
    await SystemSetting.update({ value: {
      legalizacionId: previous.legalizacionId, kind: previous.kind, context: previous.context, status: 'retry', attempts: claim.attempts,
      lastError: String(error.message || error).slice(0, 1000),
      lastAttemptAt: new Date().toISOString(), nextAttemptAt: new Date(Date.now() + delay).toISOString()
    } }, { where: { key: job.key, value: { [Op.eq]: claim } } });
    console.warn(`[legalizacion-envios] Envío ${previous.legalizacionId} pendiente de reintento: ${error.message}`);
    return 'retry';
  }
};

const runSubmissionEmails = ({ now = new Date(), sendNotification } = {}) => {
  if (running) return running;
  running = (async () => {
    const send = sendNotification || ((id, kind, context, key) => kind
      ? require('./legalizacionAccountingWorkflow').sendQueuedNotification(id, kind, context, key)
      : require('../../controllers/legalizacionViaticosController').enviarCorreoPresentacion(id));
    const jobs = await SystemSetting.findAll({
      where: {
        key: { [Op.like]: `${PREFIX}%` },
        [Op.or]: [
          { 'value.status': { [Op.in]: ['queued', 'retry'] }, 'value.nextAttemptAt': { [Op.lte]: now.toISOString() } },
          { 'value.status': 'processing', 'value.leaseUntil': { [Op.lte]: now.toISOString() } }
        ]
      },
      order: [['updated_at', 'ASC']], limit: 20
    });
    const outcomes = [];
    // Límite de concurrencia para no saturar conexiones SMTP ni cargar todos los anexos en memoria.
    for (let index = 0; index < jobs.length; index += 2) {
      outcomes.push(...await Promise.all(jobs.slice(index, index + 2).map((job) => processJob(job, send, now))));
    }
    return outcomes;
  })().finally(() => { running = null; });
  return running;
};

const kickSubmissionEmails = () => {
  setImmediate(() => runSubmissionEmails().catch((error) => console.error('[legalizacion-envios]', error.message)));
};

const startSubmissionEmailWorker = () => {
  if (timer) return;
  kickSubmissionEmails();
  timer = setInterval(kickSubmissionEmails, 10000);
  timer.unref?.();
};

module.exports = { enqueueSubmissionEmail, enqueueWorkflowEmail, kickSubmissionEmails, runSubmissionEmails, startSubmissionEmailWorker };
