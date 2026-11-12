const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../models');
const { auditLegacyActionScope } = require('./legacyActionScopeAudit');

test('audit resolves duplicated R86 identities using the same annual plan as the repair', async () => {
  const restore = [];
  const stub = (object, key, value) => { restore.push([object, key, object[key]]); object[key] = value; };
  const source = { anio: 2026, responsable: 'R86_Semilleros', actividad: 'Formación', indicador: 'Informe', meta: '1' };
  const term = { id: 'term', year: 2026, strategic_plan_id: 'ped' };
  const unit = { id: 'correct', code: 'LEG-R86', strategic_plan_id: 'ped' };
  stub(models.PlanAccion, 'findAll', async () => [source]);
  stub(models.StrategicActionPlan, 'findAll', async () => [{
    code: '2026-R86', term_id: term.id, catalog_item_id: unit.id, term, organizationalUnit: unit,
    items: [{ code: 'LEGACY-1', activity: source.actividad, indicator: source.indicador, target: source.meta,
      custom_values: { responsible: source.responsable, legacy_plan_accion_id: 1 } }]
  }]);
  stub(models.StrategicCatalogItem, 'findAll', async () => [unit,
    { id: 'old', code: 'DEP-086', strategic_plan_id: 'ped', metadata: { legacy_dependency_code: 'R86' } }
  ]);
  try {
    const result = await auditLegacyActionScope();
    assert.equal(result.sourceRows, 1);
    assert.equal(result.importedItems, 1);
    assert.deepEqual(result.misplaced, []);
    assert.deepEqual(result.differences, []);
  } finally {
    for (const [object, key, value] of restore.reverse()) object[key] = value;
  }
});
