const excluded = new Set(['progress_s1', 'observations_s1', 'progress_s2', 'observations_s2', 'total_progress', 'avance_a_ip_2026', 'avance_a_iip_2026', 'observaciones', 'observaciones_2', 'total']);
export const optionalPolicyField = (field) => {
  const text = `${field.key || ''} ${field.label || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const policy = /politic|policy|policies/.test(text) || field.validation_rules?.shared_catalog === 'institutional_policies'
    || Boolean(field.validation_rules?.policy_key) || ['lineas_de_accion', 'lineasAccionPolitica'].includes(field.key);
  return policy ? { ...field, required: false } : { ...field };
};

export function actionPlanFormFields(schemaFields = [], pedFields = [], fallback = []) {
  const merged = new Map();
  schemaFields.filter((field) => field && field.active !== false).forEach((field) => merged.set(field.key, { ...field }));
  pedFields.filter(Boolean).forEach((field) => {
    if (field.active === false) { merged.delete(field.key); return; }
    const previous = merged.get(field.key) || {};
    merged.set(field.key, { ...previous, ...field,
      options: field.options?.length ? field.options : previous.options || [],
      validation_rules: { ...previous.validation_rules, ...field.validation_rules }
    });
  });
  return (merged.size ? [...merged.values()] : fallback)
    .filter((field) => field.active !== false && field.data_type !== 'formula' && !excluded.has(field.key))
    .map(optionalPolicyField)
    .sort((a, b) => (a.position || 0) - (b.position || 0));
}
