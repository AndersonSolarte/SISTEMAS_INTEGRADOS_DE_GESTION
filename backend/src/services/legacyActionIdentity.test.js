const test = require('node:test');
const assert = require('node:assert/strict');
const { sameLegacyActivity, fillMissing, schemaLegacyValues } = require('./legacyActionIdentity');

const row = { id: 200, actividad: 'Estudio de deserción', indicador: '2026-R74-001 Estudio', meta: '100%' };
const item = { id: 'existing', code: 'LEGACY-100', activity: row.actividad, indicator: row.indicador, target: row.meta,
  starts_on: '2026-02-16', ends_on: '2026-11-30', custom_values: { legacy_plan_accion_id: 100 } };

test('recognizes a reimport with new IDs and omitted dates', () => {
  assert.equal(sameLegacyActivity(item, { ...row, actividad: '  Estudio de   deserción ' }), true);
  assert.equal(sameLegacyActivity(item, { ...row, id: 300 }), true);
});
test('preserves manual activities and distinct indicators, schedules and targets', () => {
  assert.equal(sameLegacyActivity({ ...item, code: 'ACT-006', custom_values: {} }, row), false);
  for (const changes of [{ indicador: 'Otro indicador' }, { meta: '50%' }, { fecha_inicio: '2026-03-01' }, { actividad: '' }, { indicador: '' }]) {
    assert.equal(sameLegacyActivity(item, { ...row, ...changes }), false);
  }
});
test('fills missing data without overwriting edits, zero progress or custom fields', () => {
  assert.deepEqual(fillMissing({ objective: '', progress: 0, note: 'Editada', extra: 'X' }, {
    objective: 'OE1', progress: 90, note: 'Importada', missing: null
  }), { objective: 'OE1', progress: 0, note: 'Editada', extra: 'X' });
});
test('maps Excel schema keys for objectives and guidelines without inventing policy data', () => {
  const mapped = schemaLegacyValues([
    { key: 'objetivos_estrategicos', label: 'OBJETIVOS ESTRATÉGICOS' },
    { key: 'lineamientos_estrategicos', label: 'LINEAMIENTOS ESTRATÉGICOS' },
    { key: 'macroactividad', label: 'MACROACTIVIDAD' },
    { key: 'seguimiento_politicas', label: 'SEGUIMIENTO POLITICAS' }
  ], { strategic_objective: 'OE1', strategic_guideline: 'LE4', macroactivity: 'A18' });
  assert.equal(mapped.objetivos_estrategicos, 'OE1');
  assert.equal(mapped.lineamientos_estrategicos, 'LE4');
  assert.equal(mapped.macroactividad, 'A18');
  assert.equal(mapped.seguimiento_politicas, undefined);
});
