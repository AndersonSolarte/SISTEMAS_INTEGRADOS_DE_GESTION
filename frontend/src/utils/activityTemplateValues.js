// A bank suggestion supplies editable content, never another year's execution data.
export const mergeActivityTemplateValues = (current, source) => {
  const result = { ...current };
  for (const [key, value] of Object.entries(source || {})) {
    const name = key.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (/(legacy|respons|observ|progress|avance|evidenc|firma|signature|source|_id$|codigo|code|fecha|starts_on|ends_on)/.test(name)) continue;
    if (!/(objetiv|objective|lineamiento|guideline|macro|politic|policy|linea|indicador|indicator|meta|target|entregable|deliverable)/.test(name)) continue;
    if (!value || result[key]) continue;
    result[key] = /indicador|indicator/.test(name) && typeof value === 'string'
      ? value.replace(/^(?:(?:[RLI]-)?20\d{2}-R\d+-\d+\s+)+/i, '').trim() : value;
  }
  return result;
};
