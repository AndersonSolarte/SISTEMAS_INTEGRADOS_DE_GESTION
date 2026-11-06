import { indicatorErrors, planIndicatorErrors } from './activityIndicatorRules';
test('prevents saving an active incomplete indicator and locates the activity', () => {
  const errors = planIndicatorErrors([{ codigo: 'OPM_02', actividades: [{ indicadorLogroActivo: true }] }]);
  expect(errors).toHaveLength(4);
  expect(errors[0].message).toContain('OPM_02');
});
test('validates each indicator date range and ignores removed indicators', () => {
  const activity = { indicadorLogroActivo: true, indicadorLogro: 'Entregas', metaLogro: 'Nivel A', fechaInicioLogro: '2026-11-01', fechaFinLogro: '2026-11-20' };
  expect(indicatorErrors(activity)).toEqual({});
  expect(indicatorErrors({ ...activity, fechaFinLogro: '2026-10-01' }).fechaFinLogro).toBeTruthy();
  expect(indicatorErrors({ ...activity, indicadorLogroActivo: false, fechaFinLogro: '' })).toEqual({});
});
