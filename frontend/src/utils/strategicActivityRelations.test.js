const { relationRole, relationCode, matchingRelations, filterRelatedOptions, relatedChanges } = require('./strategicActivityRelations');
const rows = require('../data/strategicActivityRelations.json');
const fields = ['objective', 'guideline', 'macroactivity'].map((role, i) => ({
  key: ['objetivos_estrategicos', 'lineamientos_estrategicos', 'macroactividad'][i],
  label: role, options: [...new Set(rows.map((row) => row[role]))]
}));
const values = (selected) => (field) => selected[field.key] || '';

test('all 35 Excel relationships are complete and unambiguous', () => {
  expect(rows).toHaveLength(35);
  expect(new Set(rows.map((r) => relationCode(r.objective, 'objective'))).size).toBe(3);
  expect(new Set(rows.map((r) => relationCode(r.guideline, 'guideline'))).size).toBe(13);
  rows.forEach((row) => expect(matchingRelations({ macroactivity: row.macroactivity })).toEqual([row]));
});
test('recognizes manual identifiers and normalized codes', () => {
  expect(relationRole({ key: 'campo_12', label: 'Objetivos Estratégicos' })).toBe('objective');
  expect(relationCode('OE 3 Descripción', 'objective')).toBe('OE3');
  expect(relationCode('LE-001 Innovación', 'guideline')).toBe('LE1');
});
test('filters in every direction and excludes the field itself', () => {
  fields.forEach((source) => {
    fields.forEach((target) => {
      const selected = { [source.key]: source.options[0] };
      const options = target.options.map((value) => ({ value }));
      const filtered = filterRelatedOptions(target, options, fields, values(selected));
      if (source === target) expect(filtered).toEqual(options);
      else expect(filtered.every((o) => matchingRelations({ [relationRole(source)]: source.options[0], [relationRole(target)]: o.value }).length)).toBe(true);
    });
  });
});
test('macroactivity completes parents and changing objective clears incompatible children', () => {
  const changes = relatedChanges(fields[2], rows[0].macroactivity, fields, values({}));
  expect(changes[fields[0].key]).toBe(rows[0].objective);
  expect(changes[fields[1].key]).toBe(rows[0].guideline);
  const next = relatedChanges(fields[0], rows[34].objective, fields, values(changes));
  expect(next[fields[1].key]).toBe('');
  expect(next[fields[2].key]).toBe('');
});
test('hidden fields do not constrain options or receive automatic values', () => {
  const active = [fields[0], fields[2]];
  const changes = relatedChanges(fields[2], rows[0].macroactivity, active, values({}));
  expect(changes).not.toHaveProperty(fields[1].key);
  expect(filterRelatedOptions(fields[2], [{ value: rows[0].macroactivity }], active, values({ [fields[1].key]: rows[34].guideline }))).toHaveLength(1);
});
test('rejects incompatible selections', () => {
  expect(matchingRelations({ objective: rows[0].objective, macroactivity: rows[34].macroactivity })).toEqual([]);
});
