const { resolveActivityIndicators } = require('./activityIndicatorRules');
const kinds = ['Resultado', 'Logro', 'Impacto'];
const clamp = (value) => Math.min(100, Math.max(0, Number(value) || 0));
const activeKinds = (activity) => {
  const values = resolveActivityIndicators(activity);
  return kinds.filter((kind) => values[`indicador${kind}Activo`]);
};
const indicatorProgress = (activity, kind) => {
  const record = activity.seguimientoIndicadores?.[kind];
  return record?.evidencias?.length ? clamp(record.porcentaje) : 0;
};
const trackingProgress = (activity) => {
  const active = activeKinds(activity);
  return active.length ? active.reduce((sum, kind) => sum + indicatorProgress(activity, kind), 0) / active.length : 0;
};
const scheduleStatus = (activity, kind, today) => {
  const values = resolveActivityIndicators(activity);
  const start = values[`fechaInicio${kind}`];
  const end = values[`fechaFin${kind}`];
  if (indicatorProgress(activity, kind) >= 100) return end && activity.seguimientoIndicadores?.[kind]?.fecha > end ? 'Cumplido fuera de plazo' : 'Cumplido';
  if (!start || !end) return 'Sin programación';
  if (today < start) return 'Por iniciar';
  return today > end ? 'Vencido' : 'En plazo';
};
const validateTracking = (activity) => {
  if (!activity.seguimientoIndicadores) return;
  for (const kind of activeKinds(activity)) {
    const record = activity.seguimientoIndicadores[kind];
    if (!record || record.porcentaje === '' || record.porcentaje == null) continue;
    const value = Number(record.porcentaje);
    const values = resolveActivityIndicators(activity);
    if (!Number.isFinite(value) || value < 0 || value > 100) throw Object.assign(new Error(`${kind}: el cumplimiento debe estar entre 0 y 100%.`), { status: 422 });
    const date = new Date(`${record.fecha}T00:00:00Z`);
    const validDate = /^\d{4}-\d{2}-\d{2}$/.test(record.fecha || '') && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === record.fecha;
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Bogota' });
    if (value > 0 && (!record.evidencias?.length || !validDate || record.fecha < values[`fechaInicio${kind}`] || record.fecha > today)) {
      throw Object.assign(new Error(`${kind}: adjunte evidencia e indique una fecha de corte desde el inicio programado.`), { status: 422 });
    }
  }
};
module.exports = { activeKinds, indicatorProgress, trackingProgress, scheduleStatus, validateTracking };
