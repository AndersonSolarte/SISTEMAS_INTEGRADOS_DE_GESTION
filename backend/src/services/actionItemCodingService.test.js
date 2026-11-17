const test = require('node:test');
const assert = require('node:assert/strict');
const { ACTIVITY_CODE, codedValues, indicatorCode, nextCode, description, planPrefix } = require('./actionItemCodingService');

test('the activity owns the sequence and all three indicators share its base code', () => {
  const values = codedValues({ indicator: '2026-R76-001 Política aprobada', indicator_type: 'Logro', custom_values: {
    indicadorResultado: 'Política formulada', indicadorLogro: 'Política aprobada', indicadorImpacto: 'Comunidad beneficiada',
    observations_s1: 'Conservar', official_observations: { s1: { text: 'Concepto' } }
  } }, '2026-R76-001');
  assert.equal(values.code, '2026-R76-001');
  assert.equal(values.indicator, 'L-2026-R76-001 Política aprobada');
  assert.equal(values.custom_values.indicadorResultado, 'R-2026-R76-001 Política formulada');
  assert.equal(values.custom_values.indicadorLogro, 'L-2026-R76-001 Política aprobada');
  assert.equal(values.custom_values.indicadorImpacto, 'I-2026-R76-001 Comunidad beneficiada');
  assert.equal(values.custom_values.official_observations.s1.text, 'Concepto');
  assert.equal(values.custom_values.observations_s1, 'Conservar');
  assert.deepEqual(codedValues(values, values.code), values);
});

test('numbers continue after deleted codes and are independent of another plan and year', () => {
  const rows = [{ code: '2026-R76-001' }, { code: '2026-R76-004', deleted_at: new Date() },
    { code: '2027-R76-999' }, { code: '2026-R75-999' }, { code: 'LEGACY-17671' }];
  assert.equal(nextCode('2026-R76', rows), '2026-R76-005');
  assert.equal(nextCode('2027-R33', rows), '2027-R33-001');
  assert.equal(nextCode('2026-R76', [{ code: '2026-R76-999' }]), '2026-R76-1000');
});

test('descriptions retain multiline content and old prefixes do not accumulate', () => {
  assert.equal(description('R-2025-R02-010 Descripción\nCompleta'), 'Descripción\nCompleta');
  const values = codedValues({ indicator_type: 'Impacto', indicator: 'R-2025-R02-010 Descripción\nCompleta' }, '2027-R76-002');
  assert.equal(values.indicator, 'I-2027-R76-002 Descripción\nCompleta');
  assert.equal(indicatorCode('2027-R76-002', 'logro'), 'L-2027-R76-002');
  assert.ok(ACTIVITY_CODE.test('2027-R02-001'));
  assert.equal(ACTIVITY_CODE.test('LEGACY-17671'), false);
});

test('empty or disabled indicator descriptions are never invented', () => {
  const values = codedValues({ indicator: '', custom_values: { indicadorLogro: '', indicadorLogroActivo: false, target: '10' } }, '2026-R76-001');
  assert.equal(values.indicator, '');
  assert.equal(values.custom_values.indicadorLogro, '');
  assert.equal(values.custom_values.indicadorLogroActivo, false);
  assert.deepEqual(values.custom_values.indicator_codes, {});
});

test('dependency-created DEP-Rxx plans resolve their official activity prefix without legacy metadata', async () => {
  const { StrategicActionPlan, StrategicTerm, StrategicCatalogItem } = require('../models');
  const originals = [StrategicActionPlan.findByPk, StrategicTerm.findByPk, StrategicCatalogItem.findByPk];
  let plan; let unit;
  StrategicActionPlan.findByPk = async () => plan;
  StrategicTerm.findByPk = async () => ({ year: 2027 });
  StrategicCatalogItem.findByPk = async () => unit;
  try {
    for (const [unitCode, planCode, expected] of [
      ['DEP-R02-VICERRECTORIA-ACADEMICA', '2027-DEP-R02-VICERRECTORIA-ACADEMICA', '2027-R02'],
      ['DEP-GENERIC', '2027-DEP-R02-VICERRECTORIA-ACADEMICA', '2027-R02'],
      ['dep-r76-salud', '2027-DEP-R76-SALUD', '2027-R76'],
      ['R02', '2027-R02', '2027-R02'],
      ['LEG-R74', 'LEGACY-2027-R74', '2027-R74'],
      ['R02_Academica', '2027-R02', '2027-R02'],
      ['R02 Academica', '2027-R02', '2027-R02'],
      ['R03', '2027-DEP-R02-ACADEMICA', '2027-R03']
    ]) {
      plan = { code: planCode, term_id: 'term', catalog_item_id: 'unit', metadata: {} };
      unit = { code: unitCode, metadata: { source: 'DEPENDENCIAS_POR_VIGENCIA' } };
      assert.equal(await planPrefix('plan'), expected, planCode);
    }
    // The year is always that of the destination term, not text in an old plan code.
    plan.code = '2025-DEP-R02-ACADEMICA'; unit.code = 'DEP-GENERIC';
    assert.equal(await planPrefix('plan'), '2027-R02');
    for (const invalid of ['DEP-002', 'DEP-R02X', 'DEP-AREA-R02', 'DEP-VICERRECTORIA']) {
      plan.code = '2027-' + invalid; unit.code = invalid;
      await assert.rejects(planPrefix('plan', null, { custom_values: { responsible: 'SANDRA LUCIA' } }), { statusCode: 422 });
    }
  } finally {
    [StrategicActionPlan.findByPk, StrategicTerm.findByPk, StrategicCatalogItem.findByPk] = originals;
  }
});
