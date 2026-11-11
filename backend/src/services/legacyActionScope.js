const normalize = (value) => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toLowerCase().replace(/\s+/g, ' ').trim();
const dependencyCode = (value) => {
  const match = String(value || '').trim().replace(/^LEG-/i, '').match(/^R0*(\d+)(?=$|[\s_-])/i);
  return match ? `R${Number(match[1])}` : null;
};
const historicalYear = (value) => Number.isInteger(Number(value)) && Number(value) >= 2022 && Number(value) <= 2026;
const chooseLegacyUnit = (units, responsible) => {
  const prefix = dependencyCode(responsible);
  const name = normalize(String(responsible || '').replace(/^R\d+\s*[_-]?\s*/i, ''));
  // A retired official dependency still identifies its historical activities.
  // This does not reactivate it or assign it to a future year.
  const available = units.filter((unit) => !unit.metadata?.superseded_by);
  const coded = prefix ? available.filter((unit) => dependencyCode(unit.code) === prefix) : [];
  // Official codes win over both old LEG codes and coincidentally equal names.
  const official = coded.filter((unit) => /^R\d+$/i.test(unit.code));
  if (official.length > 1) throw new Error(`Código de dependencia ambiguo: ${prefix}`);
  if (official.length) return official[0];
  if (coded.length === 1) return coded[0];
  const named = available.filter((unit) => unit.active !== false && normalize(unit.name) === name
    && (!prefix || !dependencyCode(unit.code) || dependencyCode(unit.code) === prefix));
  if (named.length > 1 || coded.length > 1) throw new Error(`Dependencia ambigua: ${responsible}`);
  return named[0] || null;
};
const sourceScope = (row) => `${Number(row.anio)}:${dependencyCode(row.responsable) || normalize(row.responsable)}`;
const scopeFromPlanCode = (value) => {
  const match = String(value || '').match(/^(?:LEGACY-)?(20\d{2})-(R\d+)(?:$|-)/i);
  return match ? sourceScope({ anio: match[1], responsable: match[2] }) : null;
};
module.exports = { dependencyCode, historicalYear, chooseLegacyUnit, sourceScope, scopeFromPlanCode, normalize };
