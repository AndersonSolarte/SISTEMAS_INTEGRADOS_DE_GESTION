const resolveActivityIndicators = (activity = {}) => {
  const legacyField = activity.tipoIndicador === 'Logro' ? 'indicadorLogro' : activity.tipoIndicador === 'Impacto' ? 'indicadorImpacto' : 'indicadorResultado';
  return Object.fromEntries(['indicadorResultado', 'indicadorLogro', 'indicadorImpacto'].map((field) => [field,
    activity[field] ?? (field === legacyField ? activity.indicador || '' : '')]));
};
const formatActivityIndicators = (activity) => {
  const values = resolveActivityIndicators(activity);
  return [['Resultado', 'indicadorResultado'], ['Logro', 'indicadorLogro'], ['Impacto', 'indicadorImpacto']]
    .filter(([, field]) => String(values[field]).trim()).map(([label, field]) => `${label}: ${values[field]}`).join('\n');
};
module.exports = { resolveActivityIndicators, formatActivityIndicators };
