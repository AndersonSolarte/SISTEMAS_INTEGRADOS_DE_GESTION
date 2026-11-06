const excluded = new Set(['progress_s1', 'observations_s1', 'progress_s2', 'observations_s2', 'total_progress', 'avance_a_ip_2026', 'avance_a_iip_2026', 'observaciones', 'observaciones_2', 'total']);
const aliases = [
  ['activity', 'actividad', 'nombre'], ['indicator', 'indicador'], ['indicator_type', 'tipoIndicador', 'tipo_indicador'],
  ['target', 'meta'], ['starts_on', 'fechaInicio', 'fecha_inicio'], ['ends_on', 'fechaFin', 'fecha_fin'],
  ['strategic_objective', 'objetivoEstrategico', 'objetivo_estrategico'], ['strategic_guideline', 'lineamientoEstrategico', 'lineamiento_estrategico'],
  ['macroactivity', 'macroactividad'], ['deliverable', 'entregable'], ['responsible', 'responsable', 'responsable_de_ejecucion'],
  ['co_responsibles', 'co_responsible', 'corresponsable'],
  ['indicadores_metas', 'indicadorResultado', 'indicador', 'indicator']
];
const emptyValue = (value) => value === null || value === undefined || (Array.isArray(value) ? !value.length || value.every(emptyValue) : typeof value === 'string' ? !value.trim() : false);
const linkFieldValue = (key, values) => {
  const keys = aliases.find((group) => group.includes(key)) || [key];
  return [key, ...keys].map((name) => values[name]).find((value) => !emptyValue(value));
};
const missingLinkFields = (fields, values) => (fields || []).filter((field) => field.active !== false && field.required === true && field.data_type !== 'formula' && !excluded.has(field.key) && emptyValue(linkFieldValue(field.key, values)));
module.exports = { missingLinkFields, linkFieldValue };
