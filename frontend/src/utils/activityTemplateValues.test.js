import { mergeActivityTemplateValues } from './activityTemplateValues';

test('reusing a historical template keeps destination identity, dates and responsible user', () => {
  const current = { plan_id: 'current', responsible: 'Current leader', fecha_inicio: '2027-02-01', codigo: '2027-R76-001' };
  const result = mergeActivityTemplateValues(current, {
    plan_id: 'source', responsible: 'Old leader', fecha_inicio: '2024-01-01', codigo: '2024-R75-009',
    indicadorResultado: 'R-2024-R75-009 Coverage', metaResultado: '80%', macroactividad: 'Macro',
    official_observations: { s1: 'Old assessment' }, current_progress: 100, legacy_plan_accion_id: 22,
    indicador_observaciones: 'Do not copy', indicator_codes: { principal: 'old' }, evidencia: 'old-file'
  });
  expect(result).toEqual({ ...current, indicadorResultado: 'Coverage', metaResultado: '80%', macroactividad: 'Macro' });
  expect(current.indicadorResultado).toBeUndefined();
});
test('template content fills blanks without overwriting work already entered', () => {
  expect(mergeActivityTemplateValues({ metaResultado: 'My goal', indicadorResultado: '' }, {
    metaResultado: 'Source goal', indicadorResultado: 'R-2026-R75-004 Source indicator', indicadorResultadoActivo: true
  })).toEqual({ metaResultado: 'My goal', indicadorResultado: 'Source indicator', indicadorResultadoActivo: true });
});
