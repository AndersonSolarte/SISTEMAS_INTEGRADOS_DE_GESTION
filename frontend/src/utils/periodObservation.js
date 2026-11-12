export const periodObservation = (activity, period) => {
  if (!period?.id) return '';
  const result = (activity?.monitoringResults || []).find((row) => !row.deleted_at
    && String(row.monitoring_period_id) === String(period.id));
  // A saved empty observation is authoritative: do not restore old imported text.
  if (result) return String(result.observations ?? '').trim();
  const code = String(period.code || '').toUpperCase();
  const position = /^S[12]$/.test(code) ? Number(code.slice(1)) : Number(period.position);
  return [1, 2].includes(position) ? String(activity?.custom_values?.[`observations_s${position}`] ?? '').trim() : '';
};
