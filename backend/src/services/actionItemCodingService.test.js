const test = require('node:test');
const assert = require('node:assert/strict');
const { ACTIVITY_CODE, codedValues, indicatorCode, nextCode, description } = require('./actionItemCodingService');

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
