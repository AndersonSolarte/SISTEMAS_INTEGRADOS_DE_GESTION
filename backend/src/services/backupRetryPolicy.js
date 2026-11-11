const MAX_ATTEMPTS = 3;
const RETRY_DELAY_MS = 15 * 60 * 1000;

// Las ejecuciones son las programadas del dia actual, leidas del historial persistente.
const backupRetryDecision = (runs, now = new Date()) => {
  if (runs.some((run) => run.status === 'completed')) return 'completed';
  if (runs.some((run) => ['queued', 'running'].includes(run.status))) return 'running';
  if (runs.length >= MAX_ATTEMPTS) return 'exhausted';
  if (!runs.length) return 'run';
  const lastEnd = Math.max(...runs.map((run) => new Date(run.finished_at || run.started_at).getTime()));
  if (!Number.isFinite(lastEnd) || now.getTime() - lastEnd < RETRY_DELAY_MS) return 'waiting';
  return 'run';
};

module.exports = { backupRetryDecision, MAX_ATTEMPTS, RETRY_DELAY_MS };
