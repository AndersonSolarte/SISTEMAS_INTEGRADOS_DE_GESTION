const text = (value) => String(value ?? '').normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();
const present = (value) => value !== null && value !== undefined && value !== '';
const isLegacyItem = (item) => item.custom_values?.application_created !== true && !/^ACT-/i.test(item.code || '')
  && (/^LEGACY-\d+$/.test(item.code || '') || present(item.custom_values?.legacy_plan_accion_id));
const stripLegacyProvenance = (values) => Object.fromEntries(Object.entries(values || {}).filter(([key]) => !/^legacy_/i.test(key) && key !== 'official_observations'));
const { sourceScope, dependencyCode, normalize } = require('./legacyActionScope');
const activityText = (value) => normalize(String(value || '').trim().replace(/^A-\d+\s+/i, ''));
const indicatorText = (value, row, source = false) => {
  const original = String(value || '').trim();
  const match = original.match(/^(?:[RLI]-)?(20\d{2})-(R\d+)-\d+\s+([\s\S]+)$/i);
  if (match && (source || (Number(match[1]) === Number(row.anio)
    && dependencyCode(match[2]) === dependencyCode(row.responsable)))) return normalize(match[3]);
  return normalize(original);
};

// The source table is replaced on every Excel import. Its numeric IDs are not identities.
const sameLegacyActivity = (item, row) => {
  if (!isLegacyItem(item) || !text(row.actividad) || !text(row.indicador)) return false;
  if (present(item.custom_values?.responsible) && present(row.responsable)
    && sourceScope({ anio: row.anio, responsable: item.custom_values.responsible }) !== sourceScope(row)) return false;
  return activityText(item.activity) === activityText(row.actividad)
    && (normalize(item.indicator) === normalize(row.indicador)
      || indicatorText(item.indicator, row) === indicatorText(row.indicador, row, true))
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

module.exports = { sameLegacyActivity, fillMissing, isLegacyItem, schemaLegacyValues, stripLegacyProvenance, indicatorText };
