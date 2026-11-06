import { missingLinkFields } from './linkFields';
test('link confirmation rejects blank required fields and accepts blank optional ones', () => {
  const fields = [{ key: 'strategic_objective', required: true }, { key: 'custom_policy', required: true }, { key: 'optional', required: false }];
  expect(missingLinkFields(fields, { objetivoEstrategico: 'OE1' }).map((f) => f.key)).toEqual(['custom_policy']);
  expect(missingLinkFields(fields, { objetivoEstrategico: 'OE1', custom_policy: ['Política'] })).toEqual([]);
});
