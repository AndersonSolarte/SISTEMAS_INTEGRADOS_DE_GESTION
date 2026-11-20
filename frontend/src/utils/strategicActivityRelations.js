const relations = require('../data/strategicActivityRelations.json');
const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function relationRole(field) {
  const text = normalize(`${field.key} ${field.label}`);
  if (/macroactiv/.test(text)) return 'macroactivity';
  if (/lineamiento|guideline/.test(text)) return 'guideline';
  if (/objetivo|objective/.test(text)) return 'objective';
  return null;
}

function relationCode(value, role) {
  const prefix = { objective: 'OE', guideline: 'LE', macroactivity: 'A' }[role];
  const match = String(value || '').trim().match(new RegExp(`^${prefix}\\s*-?\\s*0*(\\d+)(?=\\D|$)`, 'i'));
  return match ? `${prefix}${Number(match[1])}` : normalize(value);
}

function matchingRelations(selections) {
  return relations.filter((row) => Object.entries(selections).every(([role, value]) =>
    !value || relationCode(row[role], role) === relationCode(value, role)));
}

function filterRelatedOptions(field, options, fields, getValue) {
  const role = relationRole(field);
  if (!role) return options;
  const selections = {};
  fields.forEach((other) => {
    const otherRole = relationRole(other);
    if (otherRole && otherRole !== role && getValue(other)) selections[otherRole] = getValue(other);
  });
  if (!Object.keys(selections).length) return options;
  const rows = matchingRelations(selections);
  return options.filter((option) => rows.some((row) => relationCode(row[role], role) === relationCode(option.value, role)));
}

// The changed field takes precedence; incompatible selections are cleared.
// Only visible/configured fields are completed, using their own option labels.
function relatedChanges(field, value, fields, getValue) {
  const role = relationRole(field);
  const changes = { [field.key]: value };
  if (!role || !value) return changes;
  let rows = matchingRelations({ [role]: value });
  if (!rows.length) return changes;
  const others = fields.filter((other) => relationRole(other) && relationRole(other) !== role);
  others.forEach((other) => {
    const otherRole = relationRole(other);
    const current = getValue(other);
    if (!current) return;
    const compatible = rows.filter((row) => relationCode(row[otherRole], otherRole) === relationCode(current, otherRole));
    if (compatible.length) rows = compatible;
    else changes[other.key] = '';
  });
  others.forEach((other) => {
    const otherRole = relationRole(other);
    const codes = new Set(rows.map((row) => relationCode(row[otherRole], otherRole)));
    if (codes.size !== 1) return;
    const options = Array.isArray(other.options) ? other.options : [];
    const option = options.find((entry) => codes.has(relationCode(entry, otherRole)));
    if (option) changes[other.key] = option;
  });
  return changes;
}

module.exports = { relationRole, relationCode, matchingRelations, filterRelatedOptions, relatedChanges };
