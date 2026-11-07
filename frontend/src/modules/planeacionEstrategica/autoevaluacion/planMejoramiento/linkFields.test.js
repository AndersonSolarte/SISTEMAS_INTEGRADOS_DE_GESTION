import { missingLinkFields, prefillLinkFields, resolveLinkStrategy } from './linkFields';

const strategicCatalog = { strategicRelations: [
  { code: 'OE3', label: 'OE3 Objetivo vigente', guidelines: [{ code: 'LE-011', label: 'LE-011 Lineamiento vigente' }] },
  { code: 'OE2', label: 'OE2 Otro objetivo', guidelines: [{ code: 'LE-005', label: 'LE-005 Otro lineamiento' }] }
] };

test('preselects objective and guideline by their codes using destination labels', () => {
  const result = resolveLinkStrategy({ objetivoEstrategico: 'OE3 Texto anterior', lineamientoEstrategico: 'LE-011 Texto anterior' }, strategicCatalog);
  expect(result.strategic_objective).toBe('OE3 Objetivo vigente');
  expect(result.strategic_guideline).toBe('LE-011 Lineamiento vigente');
  expect(prefillLinkFields([{ key: 'custom_guideline', label: 'Lineamiento Estratégico' }], result).custom_guideline).toBe('LE-011 Lineamiento vigente');
});

test('does not select a guideline belonging to a different objective or discard data before catalog arrives', () => {
  expect(resolveLinkStrategy({ objetivoEstrategico: 'OE3', strategic_guideline: 'LE-005' }, strategicCatalog).strategic_guideline).toBe('');
  expect(resolveLinkStrategy({ objetivoEstrategico: 'OE3', strategic_guideline: 'LE-011' }, undefined)).toEqual({});
});

test('preloads activity, description and institutional references using the actual destination keys', () => {
  expect(prefillLinkFields([
    { key: 'nombre_actividad', label: 'Actividad' },
    { key: 'custom_description', label: 'Descripción de la actividad' },
    { key: 'institutional_policy_lines', validation_rules: { shared_catalog: 'institutional_policies', role: 'lines' } }
  ], { activity: 'Generar reportes', descripcion: 'Preparar informe', lineasAccion: ['Innovación'] }))
    .toEqual({ nombre_actividad: 'Generar reportes', custom_description: 'Preparar informe', institutional_policy_lines: ['Innovación'] });
});
test('link confirmation rejects blank required fields and accepts blank optional ones', () => {
  const fields = [{ key: 'strategic_objective', required: true }, { key: 'custom_policy', required: true }, { key: 'optional', required: false }];
  expect(missingLinkFields(fields, { objetivoEstrategico: 'OE1' }).map((f) => f.key)).toEqual(['custom_policy']);
  expect(missingLinkFields(fields, { objetivoEstrategico: 'OE1', custom_policy: ['Política'] })).toEqual([]);
});
