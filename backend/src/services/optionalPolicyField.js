const optionalPolicyField = (field) => {
  const text = `${field.key || ''} ${field.label || ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const policy = /politic|policy|policies/.test(text) || field.validation_rules?.shared_catalog === 'institutional_policies'
    || Boolean(field.validation_rules?.policy_key) || ['lineas_de_accion', 'lineasAccionPolitica'].includes(field.key);
  return policy ? { ...field, required: false } : { ...field };
};
module.exports = { optionalPolicyField };
