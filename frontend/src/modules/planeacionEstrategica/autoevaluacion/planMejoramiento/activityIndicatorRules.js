const resolveActivityIndicators = (activity = {}) => {
  const legacyField = activity.tipoIndicador === 'Logro' ? 'indicadorLogro' : activity.tipoIndicador === 'Impacto' ? 'indicadorImpacto' : 'indicadorResultado';
  const indicators = Object.fromEntries(['indicadorResultado', 'indicadorLogro', 'indicadorImpacto'].map((field) => [field,
    activity[field] ?? (field === legacyField ? activity.indicador || '' : '')]));
  const legacyTarget = legacyField.replace('indicador', 'meta');
  const scheduling = Object.fromEntries(['Resultado', 'Logro', 'Impacto'].flatMap((kind) => [
    [`fechaEntrega${kind}`, String(activity[`fechaFin${kind}`] ?? activity[`fechaEntrega${kind}`] ?? '')],
    [`fechaInicio${kind}`, String(activity[`fechaInicio${kind}`] || '')],
    [`fechaFin${kind}`, String(activity[`fechaFin${kind}`] ?? activity[`fechaEntrega${kind}`] ?? '')],
    [`indicador${kind}Activo`, activity[`indicador${kind}Activo`] ?? Boolean(String(indicators[`indicador${kind}`] || activity[`meta${kind}`] || activity[`fechaEntrega${kind}`] || activity[`fechaInicio${kind}`] || activity[`fechaFin${kind}`] || '').trim())]
  ]));
  return { ...indicators, ...scheduling, ...Object.fromEntries(['metaResultado', 'metaLogro', 'metaImpacto'].map((field) => [field, String(activity[field] ?? (field === legacyTarget ? activity.meta ?? '' : ''))])) };
};
const indicatorErrors = (activity = {}) => {
  const values = resolveActivityIndicators(activity);
  const errors = {};
  const validDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
  for (const kind of ['Resultado', 'Logro', 'Impacto']) {
    if (!values[`indicador${kind}Activo`]) continue;
    for (const [prefix, label] of [['indicador', 'Indicador'], ['meta', 'Meta'], ['fechaInicio', 'Fecha inicio'], ['fechaFin', 'Fecha fin']]) {
      const field = `${prefix}${kind}`;
      if (!String(values[field] ?? '').trim()) errors[field] = `${label} de ${kind.toLowerCase()}: campo obligatorio.`;
      else if (prefix.startsWith('fecha') && !validDate(values[field])) errors[field] = `${label} de ${kind.toLowerCase()}: fecha inválida.`;
    }
    const start = values[`fechaInicio${kind}`];
    const end = values[`fechaFin${kind}`];
    if (validDate(start) && validDate(end) && end < start) errors[`fechaFin${kind}`] = `La fecha fin de ${kind.toLowerCase()} no puede ser anterior al inicio.`;
  }
  return errors;
};
const planIndicatorErrors = (objectives = []) => objectives.flatMap((objective, objectiveIndex) => (objective.actividades || []).flatMap((activity, activityIndex) => Object.entries(indicatorErrors(activity)).map(([field, message]) => ({ objectiveIndex, activityIndex, field, message: `${objective.codigo || `Objetivo ${objectiveIndex + 1}`} · Actividad ${activityIndex + 1}: ${message}` }))));


export { resolveActivityIndicators, indicatorErrors, planIndicatorErrors };
