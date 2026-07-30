const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { Op } = require('sequelize');
const { DatabaseBackupRun, SystemSetting } = require('../models');

const SETTING_KEY = 'database_backup_automation';
const SCHEDULE_HOUR = Math.min(23, Math.max(0, Number(process.env.SIAC_BACKUP_HOUR || 18)));
const SCHEDULE_MINUTE = Math.min(59, Math.max(0, Number(process.env.SIAC_BACKUP_MINUTE || 0)));
const TIMEZONE = 'America/Bogota';
const CHECK_INTERVAL_MS = 30000;
const HISTORY_LIMIT = 50;

let activeRunPromise = null;
let schedulerTimer = null;
let lastScheduleKey = '';
let backupBlocked = false;

const automaticBackupsConfigured = () => String(process.env.SIAC_AUTOMATIC_BACKUP_ENABLED || 'true').toLowerCase() !== 'false';

const storageDirectory = () => {
  if (process.env.SIAC_BACKUP_STORAGE_DIR) return path.resolve(process.env.SIAC_BACKUP_STORAGE_DIR);
  if (process.env.SIAC_BACKUP_DIR) return path.resolve(process.env.SIAC_BACKUP_DIR);
  if (process.platform === 'win32') return 'D:\\SIAC_COPIAS_DE_SEGURIDAD';
  return path.resolve(process.cwd(), 'backups');
};

const findExecutable = (kind) => {
  const isDump = kind === 'dump';
  const configured = process.env[isDump ? 'PG_DUMP_PATH' : 'PG_RESTORE_PATH'];
  const filename = isDump ? 'pg_dump.exe' : 'pg_restore.exe';
  const command = isDump ? 'pg_dump' : 'pg_restore';
  const candidates = [
    configured,
    `C:\\Program Files\\PostgreSQL\\18\\bin\\${filename}`,
    `C:\\Program Files\\PostgreSQL\\17\\bin\\${filename}`,
    `C:\\Program Files\\PostgreSQL\\16\\bin\\${filename}`,
    command
  ].filter(Boolean);
  return candidates.find((candidate) => candidate === command || fs.existsSync(candidate)) || command;
};

const getBogotaParts = (date = new Date()) => Object.fromEntries(
  new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE,
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date).filter((part) => part.type !== 'literal').map((part) => [part.type, part.value])
);

const getNextRunAt = (now = new Date()) => {
  const parts = getBogotaParts(now);
  const candidate = new Date(Date.UTC(
    Number(parts.year), Number(parts.month) - 1, Number(parts.day),
    SCHEDULE_HOUR + 5, SCHEDULE_MINUTE, 0, 0
  ));
  if (candidate <= now) candidate.setUTCDate(candidate.getUTCDate() + 1);
  return candidate;
};

const getBogotaDayRange = (parts) => {
  const start = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), 5, 0, 0, 0));
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 1);
  return { start, end };
};

const getSettings = async () => {
  const defaults = { paused: false };
  const [setting] = await SystemSetting.findOrCreate({
    where: { key: SETTING_KEY },
    defaults: { key: SETTING_KEY, value: defaults }
  });
  return { setting, value: { ...defaults, ...(setting.value || {}) } };
};

const describeFailure = (error) => {
  const raw = String(error?.message || error || 'Error desconocido');
  if (/ENOENT|not recognized|not found/i.test(raw)) return 'La herramienta pg_dump no está disponible en el servidor.';
  if (/EACCES|permission denied/i.test(raw)) return 'El servidor no tiene permiso para escribir la copia de seguridad.';
  if (/no space left|ENOSPC/i.test(raw)) return 'No hay espacio suficiente en el almacenamiento de respaldos.';
  if (/password authentication failed/i.test(raw)) return 'PostgreSQL rechazó las credenciales configuradas para el respaldo.';
  if (/could not connect|connection refused|timeout expired/i.test(raw)) return 'No fue posible conectarse a PostgreSQL durante el respaldo.';
  return raw.replace(/(?:[A-Za-z]:\\|\/)[^\s]+/g, '[ruta protegida]').slice(0, 600);
};

const spawnToFile = (executable, args, outputPath) => new Promise((resolve, reject) => {
  const output = fs.createWriteStream(outputPath, { flags: 'wx', mode: 0o600 });
  const child = spawn(executable, args, {
    env: { ...process.env, PGPASSWORD: process.env.DB_PASSWORD },
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let stderr = '';
  let settled = false;
  const finish = (error) => {
    if (settled) return;
    settled = true;
    if (error) reject(error); else resolve();
  };
  child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  child.on('error', finish);
  output.on('error', (error) => { child.kill(); finish(error); });
  child.stdout.pipe(output);
  child.on('close', (code) => {
    output.end(() => finish(code === 0 ? null : new Error(stderr || `pg_dump finalizó con código ${code}`)));
  });
});

const validateDump = async (filePath) => {
  const signature = Buffer.alloc(5);
  const handle = fs.openSync(filePath, 'r');
  try { fs.readSync(handle, signature, 0, 5, 0); } finally { fs.closeSync(handle); }
  if (signature.toString('ascii') !== 'PGDMP') throw new Error('La copia generada no tiene una firma PostgreSQL válida.');
  await new Promise((resolve, reject) => {
    const child = spawn(findExecutable('restore'), ['--list', filePath], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => code === 0 ? resolve() : reject(new Error(stderr || 'pg_restore no pudo validar la copia.')));
  });
};

const executeBackup = async ({ trigger = 'manual', requestedBy = null } = {}) => {
  if (backupBlocked) {
    const error = new Error('La copia no puede iniciar mientras existe otra operación de base de datos en curso.');
    error.status = 409;
    throw error;
  }
  if (activeRunPromise) {
    const error = new Error('Ya existe una copia de seguridad en ejecución.');
    error.status = 409;
    throw error;
  }

  const task = (async () => {
    const startedAt = new Date();
    const run = await DatabaseBackupRun.create({
      status: 'running', trigger, phase: 'preparing', progress: 4,
      started_at: startedAt, requested_by: requestedBy
    });
    let partialPath = '';
    let progressTimer;
    try {
      const directory = storageDirectory();
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      fs.accessSync(directory, fs.constants.W_OK);
      const stamp = new Intl.DateTimeFormat('en-CA', {
        timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
      }).format(startedAt).replace(/[^0-9]/g, '-');
      const filename = `sgc_completo_${stamp}.dump`;
      const finalPath = path.join(directory, filename);
      partialPath = `${finalPath}.partial`;
      await run.update({ phase: 'generating', progress: 10, file_name: filename });
      progressTimer = setInterval(async () => {
        try {
          await run.reload();
          if (run.status === 'running' && Number(run.progress) < 90) {
            await run.update({ progress: Math.min(90, Number(run.progress) + 2) });
          }
        } catch (_error) { /* el resultado final conserva la prioridad */ }
      }, 3000);
      const args = [
        '--format=custom', '--compress=6', '--no-owner', '--no-privileges',
        '--host', process.env.DB_HOST || 'localhost',
        '--port', String(process.env.DB_PORT || 5432),
        '--username', process.env.DB_USER,
        '--dbname', process.env.DB_NAME
      ];
      await spawnToFile(findExecutable('dump'), args, partialPath);
      clearInterval(progressTimer);
      progressTimer = null;
      await run.update({ phase: 'validating', progress: 94 });
      await validateDump(partialPath);
      await run.update({ phase: 'finalizing', progress: 98 });
      fs.renameSync(partialPath, finalPath);
      partialPath = '';
      const stats = fs.statSync(finalPath);
      const finishedAt = new Date();
      await run.update({
        status: 'completed', phase: 'completed', progress: 100,
        finished_at: finishedAt, size_bytes: stats.size,
        duration_ms: finishedAt.getTime() - startedAt.getTime(), error_message: null
      });
      return run;
    } catch (error) {
      if (progressTimer) clearInterval(progressTimer);
      if (partialPath && fs.existsSync(partialPath)) {
        try { fs.unlinkSync(partialPath); } catch (_cleanupError) { /* archivo parcial no reutilizable */ }
      }
      const finishedAt = new Date();
      await run.update({
        status: 'failed', phase: 'failed',
        finished_at: finishedAt, duration_ms: finishedAt.getTime() - startedAt.getTime(),
        error_message: describeFailure(error)
      });
      throw error;
    }
  })();

  activeRunPromise = task;
  task.finally(() => { activeRunPromise = null; }).catch(() => null);
  return task;
};

const serializeRun = (row) => row ? {
  id: row.id,
  status: row.status,
  trigger: row.trigger,
  phase: row.phase,
  progress: Number(row.progress || 0),
  progressEstimated: Boolean(row.progress_estimated),
  startedAt: row.started_at,
  finishedAt: row.finished_at,
  fileName: row.file_name,
  sizeBytes: row.size_bytes === null ? null : Number(row.size_bytes),
  durationMs: row.duration_ms === null ? null : Number(row.duration_ms),
  errorMessage: row.error_message,
  requestedBy: row.requested_by
} : null;

const getMonitorStatus = async () => {
  const { value } = await getSettings();
  const [historyRows, successfulRuns, failedRuns] = await Promise.all([
    DatabaseBackupRun.findAll({ order: [['created_at', 'DESC']], limit: HISTORY_LIMIT }),
    DatabaseBackupRun.count({ where: { status: 'completed' } }),
    DatabaseBackupRun.count({ where: { status: 'failed' } })
  ]);
  const currentRun = historyRows.find((row) => ['queued', 'running'].includes(row.status)) || null;
  const completed = historyRows.filter((row) => row.status === 'completed');
  const failed = historyRows.filter((row) => row.status === 'failed');
  const configured = automaticBackupsConfigured();
  return {
    configured,
    enabled: configured && !value.paused,
    paused: Boolean(value.paused),
    schedule: {
      time: `${String(SCHEDULE_HOUR).padStart(2, '0')}:${String(SCHEDULE_MINUTE).padStart(2, '0')}`,
      timezone: TIMEZONE,
      nextRunAt: configured && !value.paused ? getNextRunAt() : null
    },
    currentRun: serializeRun(currentRun),
    summary: {
      lastSuccessAt: completed[0]?.finished_at || null,
      lastFailureAt: failed[0]?.finished_at || null,
      successfulRuns,
      failedRuns
    },
    history: historyRows.map(serializeRun)
  };
};

const isBackupRunning = () => Boolean(activeRunPromise);
const setBackupBlocked = (blocked) => { backupBlocked = Boolean(blocked); };

const setPaused = async (paused, userId = null) => {
  const { setting, value } = await getSettings();
  await setting.update({ value: { ...value, paused: Boolean(paused) }, updated_by: userId });
  return getMonitorStatus();
};

const schedulerTick = async () => {
  if (!automaticBackupsConfigured() || activeRunPromise || backupBlocked) return;
  const { value } = await getSettings();
  if (value.paused) return;
  const parts = getBogotaParts();
  const key = `${parts.year}-${parts.month}-${parts.day}`;
  const currentMinutes = (Number(parts.hour) * 60) + Number(parts.minute);
  const scheduledMinutes = (SCHEDULE_HOUR * 60) + SCHEDULE_MINUTE;
  if (currentMinutes < scheduledMinutes || lastScheduleKey === key) return;
  const { start, end } = getBogotaDayRange(parts);
  const alreadyAttempted = await DatabaseBackupRun.count({
    where: {
      trigger: 'scheduled',
      started_at: { [Op.gte]: start, [Op.lt]: end }
    }
  });
  if (alreadyAttempted) {
    lastScheduleKey = key;
    return;
  }
  lastScheduleKey = key;
  executeBackup({ trigger: 'scheduled' }).catch((error) => console.error('[backup] Copia programada fallida:', describeFailure(error)));
};

const startDatabaseBackupScheduler = async () => {
  await DatabaseBackupRun.update(
    { status: 'failed', phase: 'failed', finished_at: new Date(), error_message: 'La ejecución fue interrumpida por un reinicio del servidor.' },
    { where: { status: { [Op.in]: ['queued', 'running'] } } }
  );
  if (schedulerTimer) clearInterval(schedulerTimer);
  schedulerTimer = setInterval(() => schedulerTick().catch((error) => console.error('[backup] Error del programador:', error.message)), CHECK_INTERVAL_MS);
  schedulerTimer.unref?.();
  await schedulerTick();
  console.log(`[backup] Monitor listo: ${String(SCHEDULE_HOUR).padStart(2, '0')}:${String(SCHEDULE_MINUTE).padStart(2, '0')} ${TIMEZONE}.`);
};

module.exports = {
  executeBackup,
  getMonitorStatus,
  setPaused,
  startDatabaseBackupScheduler,
  describeFailure,
  isBackupRunning,
  setBackupBlocked
};
