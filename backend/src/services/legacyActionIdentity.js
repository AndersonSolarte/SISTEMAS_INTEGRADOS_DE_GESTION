const text = (value) => String(value ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const present = (value) => value !== null && value !== undefined && value !== '';
const isLegacyItem = (item) => /^LEGACY-\d+$/.test(item.code || '') || present(item.custom_values?.legacy_plan_accion_id);

// The source table is replaced on every Excel import. Its numeric IDs are not identities.
const sameLegacyActivity = (item, row) => {
  if (!isLegacyItem(item) || !text(row.actividad) || !text(row.indicador)) return false;
  return text(item.activity) === text(row.actividad)
    && text(item.indicator) === text(row.indicador)
    && ['starts_on', 'ends_on', 'target'].every((key) => {
      const other = row[{ starts_on: 'fecha_inicio', ends_on: 'fecha_fin', target: 'meta' }[key]];
      return !present(item[key]) || !present(other) || text(item[key]) === text(other);
    });
};

const fillMissing = (current, source) => {
  const result = { ...current };
  for (const [key, value] of Object.entries(source)) {
    if (!present(result[key]) && present(value)) result[key] = value;
  }
  return result;
};

// Excel-derived schemas may use Spanish labels as keys, while the bridge uses English keys.
const schemaLegacyValues = (fields, values) => {
  const aliases = {
    'objetivos estrategicos': 'strategic_objective', 'objetivo estrategico': 'strategic_objective',
    'lineamientos estrategicos': 'strategic_guideline', 'lineamiento estrategico': 'strategic_guideline',
    macroactividad: 'macroactivity', 'responsable de ejecucion': 'responsible',
    corresponsable: 'co_responsible', corresponsables: 'co_responsible'
  };
  const result = { ...values };
  for (const field of fields || []) {
    const label = text(field.label).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const key = aliases[label] || aliases[text(field.key).replace(/_/g, ' ')];
    if (key && present(values[key])) result[field.key] = values[key];
  }
  return result;
};

module.exports = { sameLegacyActivity, fillMissing, isLegacyItem, schemaLegacyValues };
