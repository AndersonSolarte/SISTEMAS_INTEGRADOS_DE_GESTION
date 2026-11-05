import { aspectKey, uniqueAspects } from './aspectIdentity';
test('deduplicates transferred aspects by content rather than source row ID', () => {
  const first = { id: 1, factor: 'F1', caracteristica: 'C1', aspecto: 'A2. Análisis de necesidades' };
  const duplicate = { ...first, id: 100, aspecto: ' A2. ANALISIS de  necesidades ' };
  expect(uniqueAspects([first, duplicate])).toEqual([first]);
  expect(aspectKey(first)).toBe(aspectKey(duplicate));
  expect(aspectKey({ ...first, caracteristica: 'C2' })).not.toBe(aspectKey(first));
});
