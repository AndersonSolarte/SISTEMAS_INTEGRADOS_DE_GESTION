import { indicatorErrors, planIndicatorErrors, activityIndicatorPeriod } from './activityIndicatorRules';

test('link dates use earliest start and latest end of active indicators for this activity', () => {
  expect(activityIndicatorPeriod({
    indicadorResultadoActivo: true, fechaInicioResultado: '2026-04-10', fechaFinResultado: '2026-06-20',
    indicadorLogroActivo: true, fechaInicioLogro: '2026-02-01', fechaFinLogro: '2026-10-31',
    indicadorImpactoActivo: false, fechaInicioImpacto: '2025-01-01', fechaFinImpacto: '2028-12-31'
  })).toEqual({ starts_on: '2026-02-01', ends_on: '2026-10-31' });
  expect(activityIndicatorPeriod({})).toEqual({ starts_on: '', ends_on: '' });
});
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
