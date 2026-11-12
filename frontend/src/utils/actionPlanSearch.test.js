import { filterActionPlanUnits } from './actionPlanSearch';

const units = [
  { id: 'innovation', code: 'R95', name: 'Coordinación de Innovación', annualAssignment: { responsible: {
    name: 'Diego Villarreal', dependency: 'Sistemas', position: 'Ingeniero de Sistemas'
  } } },
  { id: 'software', code: 'R91', name: 'Coordinación de Proyectos de Desarrollo de Software' },
  { id: 'office', code: 'R33', name: 'Oficina de Desarrollo de Sistemas de Información' },
  { id: 'program', code: 'R68', name: 'Programa Académico - Ingeniería de Sistemas' }
];
const plans = [
  { catalog_item_id: 'software', code: '2026-R91', responsibleUser: { nombre: 'Andrés Tarapuez', dependencia: 'Sistemas' } },
  { catalog_item_id: 'office', code: '2026-R33', responsibleUser: { nombre: 'Estefanny Pantoja', email: 'epantoja@unicesmag.edu.co' } }
];
const search = (query) => filterActionPlanUnits(units, plans, query).map((unit) => unit.id);

test.each(['sistemas', 'SISTEMAS', 'Sistemas', 'sIsTemas', '   SISTEMAS   ', 'sistémas'])(
  'finds the same matching plan names for %s without unrelated profile dependencies', (query) => {
    expect(search(query)).toEqual(['office', 'program']);
  }
);

test.each(['sSIETMAS', 'sisteams', 'sitemas'])(
  'tolerates small spelling errors when no exact keyword matches: %s', (query) => {
    expect(search(query)).toEqual(['office', 'program']);
  }
);

test('keywords can appear in any order, with different accents, spaces and punctuation', () => {
  expect(search('SISTEMAS ingeniería')).toEqual(['program']);
  expect(search('  ingeniería,   SISTEMAS ')).toEqual(['program']);
  expect(search('informacion DESARROLLO')).toEqual(['office']);
});

test('still searches the responsible person, code, email and document', () => {
  expect(search('PANTOJA')).toEqual(['office']);
  expect(search('epantoja@unicesmag.edu.co')).toEqual(['office']);
  expect(search('r33')).toEqual(['office']);
  expect(search('2026-r91')).toEqual(['software']);
  const withDocument = [{ id: 'one', name: 'Oficina', annualAssignment: { responsible: { document: '123456789' } } }];
  expect(filterActionPlanUnits(withDocument, [], '123456789')).toEqual(withDocument);
});

test('does not search another dependency from the assigned user profile', () => {
  const unrelated = [{ id: 'x', name: 'Deporte y Cultura', annualAssignment: { responsible: { dependency: 'Sistemas' } } }];
  const unrelatedPlans = [{ catalog_item_id: 'x', responsibleUser: { dependencia: 'Sistemas' } }];
  expect(filterActionPlanUnits(unrelated, unrelatedPlans, 'sistemas')).toEqual([]);
});

test('does not fuzzily match codes or unrelated words and restores all plans when cleared', () => {
  expect(search('R34')).toEqual([]);
  expect(search('astronomia')).toEqual([]);
  expect(filterActionPlanUnits(units, plans, '')).toBe(units);
  expect(filterActionPlanUnits(units, plans, '   ')).toBe(units);
});

test('keeps source order and does not mutate plans or dependencies', () => {
  const before = JSON.stringify({ units, plans });
  search('sistemas');
  search('sSIETMAS');
  expect(JSON.stringify({ units, plans })).toBe(before);
});
