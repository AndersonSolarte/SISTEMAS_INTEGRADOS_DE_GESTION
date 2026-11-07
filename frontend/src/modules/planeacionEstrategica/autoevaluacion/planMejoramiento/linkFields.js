const excluded = new Set(['progress_s1', 'observations_s1', 'progress_s2', 'observations_s2', 'total_progress', 'avance_a_ip_2026', 'avance_a_iip_2026', 'observaciones', 'observaciones_2', 'total']);
const aliases = [
  ['activity', 'actividad', 'nombre', 'nombre_actividad', 'nombreActividad'], ['indicator', 'indicador'], ['indicator_type', 'tipoIndicador', 'tipo_indicador'],
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
const prefillLinkFields = (fields, values) => Object.fromEntries((fields || []).map((field) => {
  if (field.validation_rules?.shared_catalog === 'institutional_policies') {
    const source = field.validation_rules.role === 'lines' ? values.lineasAccion : values.politicas?.[0];
    return [field.key, linkFieldValue(field.key, values) ?? source ?? (field.validation_rules.role === 'lines' ? [] : '')];
  }
  const label = String(field.label || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
  const canonical = ['actividad', 'actividades', 'nombre de la actividad', 'nombre actividad'].includes(label) ? 'activity'
    : ['descripcion', 'descripcion de la actividad'].includes(label) ? 'descripcion'
    : label.includes('objetivo estrategico') ? 'strategic_objective'
    : label.includes('lineamiento estrategico') ? 'strategic_guideline' : field.key;
  return [field.key, linkFieldValue(field.key, values) ?? linkFieldValue(canonical, values) ?? ''];
}));
const resolveLinkStrategy = (values, catalog) => {
  if (!catalog?.strategicRelations?.length) return {};
  const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
  const matches = (row, value) => {
    const candidate = normalize(value);
    const code = normalize(row.code);
    return candidate === normalize(row.label) || Boolean(code && (candidate === code || candidate.startsWith(`${code} `) || candidate.startsWith(`${code}:`)));
  };
  const objective = linkFieldValue('strategic_objective', values);
  const relation = catalog.strategicRelations.find((row) => matches(row, objective));
  if (!relation) return {};
  const guideline = (relation.guidelines || []).find((row) => matches(row, linkFieldValue('strategic_guideline', values)));
  return { strategic_objective: relation.label, objetivoEstrategico: relation.label, objetivo_estrategico: relation.label,
    strategic_guideline: guideline?.label || '', lineamientoEstrategico: guideline?.label || '', lineamiento_estrategico: guideline?.label || '' };
};
export { missingLinkFields, linkFieldValue, prefillLinkFields, resolveLinkStrategy };
