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
