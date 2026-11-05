const resolveActivityIndicators = (activity = {}) => {
  const legacyField = activity.tipoIndicador === 'Logro' ? 'indicadorLogro' : activity.tipoIndicador === 'Impacto' ? 'indicadorImpacto' : 'indicadorResultado';
  const indicators = Object.fromEntries(['indicadorResultado', 'indicadorLogro', 'indicadorImpacto'].map((field) => [field,
    activity[field] ?? (field === legacyField ? activity.indicador || '' : '')]));
  const legacyTarget = legacyField.replace('indicador', 'meta');
  const scheduling = Object.fromEntries(['Resultado', 'Logro', 'Impacto'].flatMap((kind) => [
    [`fechaEntrega${kind}`, String(activity[`fechaEntrega${kind}`] || '')],
    [`indicador${kind}Activo`, activity[`indicador${kind}Activo`] ?? Boolean(String(indicators[`indicador${kind}`] || activity[`meta${kind}`] || activity[`fechaEntrega${kind}`] || '').trim())]
  ]));
  return { ...indicators, ...scheduling, ...Object.fromEntries(['metaResultado', 'metaLogro', 'metaImpacto'].map((field) => [field, String(activity[field] ?? (field === legacyTarget ? activity.meta ?? '' : ''))])) };
};
const formatActivityIndicators = (activity) => {
  const values = resolveActivityIndicators(activity);
  return [['Resultado', 'indicadorResultado'], ['Logro', 'indicadorLogro'], ['Impacto', 'indicadorImpacto']]
    .filter(([, field]) => values[`${field}Activo`] && String(values[field]).trim()).map(([label, field]) => `${label}: ${values[field]}`).join('\n');
};
module.exports = { resolveActivityIndicators, formatActivityIndicators };
