import { actionPlanFormFields } from './actionPlanFormFields';

test('official form and linking retain every configured capture field, including type and custom fields', () => {
  const fields = [
    { key: 'activity', position: 2, required: true },
    { key: 'indicator_type', position: 3, data_type: 'list' },
    { key: 'new_field', position: 4 },
    { key: 'total_progress', data_type: 'formula' },
    { key: 'progress_s1' }, { key: 'inactive', active: false }
  ];
  expect(actionPlanFormFields(fields).map((field) => field.key)).toEqual(['activity', 'indicator_type', 'new_field']);
  expect(actionPlanFormFields(fields, [{ key: 'new_field', label: 'Updated', required: true, position: 4 }])[2]).toMatchObject({ label: 'Updated', required: true });
});

test('all recommended policy fields remain optional even in an old schema or a required PED definition', () => {
  const fields = [
    { key: 'activity', label: 'Actividad', required: true },
    { key: 'seguimiento_politicas', label: 'Seguimiento políticas', required: true },
    { key: 'institutional_policy', label: 'Política institucional', required: true },
    { key: 'lineas_de_accion', label: 'Líneas de acción', required: true },
    { key: 'custom_lines', validation_rules: { policy_key: 'institutional_policy' }, required: true },
    { key: 'other_required', label: 'Entregable', required: true }
  ];
  const result = actionPlanFormFields(fields, [{ key: 'seguimiento_politicas', required: true }]);
  expect(result.filter((field) => !['activity', 'other_required'].includes(field.key)).every((field) => field.required === false)).toBe(true);
  expect(result.find((field) => field.key === 'activity').required).toBe(true);
  expect(result.find((field) => field.key === 'other_required').required).toBe(true);
  expect(fields[1].required).toBe(true);
});
