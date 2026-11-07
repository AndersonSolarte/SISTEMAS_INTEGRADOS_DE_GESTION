const clampProgress = (value) => Math.min(100, Math.max(0, Number(String(value ?? 0).replace(',', '.').replace('%', '')) || 0));

const parseDateParts = (rawDate, defaultYear) => {
  if (!rawDate) {
    const now = new Date();
    return { year: defaultYear || now.getFullYear(), month: now.getMonth() + 1 };
  }
  const s = String(rawDate).trim();
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) return { year: Number(isoMatch[1]), month: Number(isoMatch[2]) };
  const dmyMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmyMatch) return { year: Number(dmyMatch[3]), month: Number(dmyMatch[2]) };
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return { year: parsed.getFullYear(), month: parsed.getMonth() + 1 };
  }
  const now = new Date();
  return { year: defaultYear || now.getFullYear(), month: now.getMonth() + 1 };
};

const periodCuts = (activity, year) => {
  const cuts = new Map();
  const records = (activity.seguimientos || []).filter((r) => !String(r.id).startsWith('seg-pa-') && r.origen !== 'plan_accion');
  const source = records.length ? records : (activity.seguimientos || []).some((r) => r.origen === 'plan_accion') ? [] : activity.fechaSeguimiento && activity.metaAlcanzada !== ''
    ? [{ fecha: activity.fechaSeguimiento, porcentaje: activity.metaAlcanzada, observaciones: activity.observaciones }] : [];
  const live = activity.seguimientoActual;
  for (const record of [...source, ...(live ? [live] : [])]) {
    const { year: recYear, month } = parseDateParts(record.fecha, year);
    if (year && Number(recYear) !== Number(year)) continue;
    if (month < 1 || month > 12) continue;
    const position = month <= 7 ? 1 : 2;
    const previous = cuts.get(position);
    if (record === live || !previous || `${record.fecha}|${record.registradoAt || ''}` >= `${previous.fecha}|${previous.registradoAt || ''}`) {
      cuts.set(position, { ...record, porcentaje: clampProgress(record.porcentaje ?? record.valorAlcanzado) });
    }
  }
  return cuts;
};

const latestResult = (results, periods) => results.filter((r) => !r.deleted_at)
  .filter((r) => periods.some((p) => String(p.id) === String(r.monitoring_period_id)))
  .sort((a, b) => Number(periods.find((p) => String(p.id) === String(b.monitoring_period_id)).position)
    - Number(periods.find((p) => String(p.id) === String(a.monitoring_period_id)).position))[0];

const fulfillment = (results) => clampProgress(results.filter((r) => !r.deleted_at)
  .reduce((sum, r) => sum + Number(r.physical_progress || 0), 0));

const periodContribution = (cumulative, otherPeriods) => {
  const other = fulfillment(otherPeriods);
  const total = clampProgress(cumulative);
  if (total < other) throw Object.assign(new Error(`El cumplimiento no puede ser menor al ${other}% ya registrado en el otro monitoreo.`), { status: 422 });
  return Math.round((total - other) * 100) / 100;
};

const trackCurrentFollowup = (stored = {}, incoming = {}, timestamp = new Date().toISOString()) => {
  const previous = new Map((stored.objetivos || []).flatMap((o) => o.actividades || []).map((a) => [String(a.uid), a]));
  return { ...incoming, objetivos: (incoming.objetivos || []).map((objective) => ({ ...objective,
    actividades: (objective.actividades || []).map((activity) => {
      const old = previous.get(String(activity.uid));
      const changed = old && (['metaAlcanzada', 'fechaSeguimiento', 'observaciones'].some((key) => String(old[key] ?? '') !== String(activity[key] ?? '')) || JSON.stringify(old.seguimientoIndicadores) !== JSON.stringify(activity.seguimientoIndicadores));
      const hasProgress = activity.metaAlcanzada !== '' && activity.metaAlcanzada != null && !isNaN(Number(String(activity.metaAlcanzada).replace(',', '.').replace('%', '')));
      const valid = hasProgress;
      const parsedDate = parseDateParts(activity.fechaSeguimiento);
      const normalizedDate = activity.fechaSeguimiento && /^\d{4}-\d{2}-\d{2}$/.test(activity.fechaSeguimiento)
        ? activity.fechaSeguimiento
        : `${parsedDate.year}-${String(parsedDate.month).padStart(2, '0')}-01`;
      return { ...activity, seguimientoActual: changed && valid ? {
        id: `actual-${activity.uid}`, fecha: normalizedDate,
        porcentaje: clampProgress(activity.metaAlcanzada), observaciones: activity.observaciones || '', registradoAt: timestamp,
        ...(activity.seguimientoIndicadores ? { seguimientoIndicadores: activity.seguimientoIndicadores } : {})
      } : old?.seguimientoActual };
    })
  })) };
};

module.exports = { clampProgress, parseDateParts, periodCuts, latestResult, fulfillment, periodContribution, trackCurrentFollowup };
