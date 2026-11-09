import { aspectKey, uniqueAspects, pendingAspects } from './aspectIdentity';
test('deduplicates transferred aspects by content rather than source row ID', () => {
  const first = { id: 1, factor: 'F1', caracteristica: 'C1', aspecto: 'A2. Análisis de necesidades' };
  const duplicate = { ...first, id: 100, aspecto: ' A2. ANALISIS de  necesidades ' };
  expect(uniqueAspects([first, duplicate])).toEqual([first]);
  expect(aspectKey(first)).toBe(aspectKey(duplicate));
  expect(aspectKey({ ...first, caracteristica: 'C2' })).not.toBe(aspectKey(first));
});

test('keeps factors and characteristics available until their last aspect is assigned', () => {
  const first = { id: 1, factor: 'F1', caracteristica: 'C1', aspecto: 'A1' };
  const second = { id: 2, factor: 'F1', caracteristica: 'C1', aspecto: 'A2' };
  const third = { id: 3, factor: 'F1', caracteristica: 'C2', aspecto: 'A3' };
  const all = [first, second, third];
  expect(pendingAspects(all, [{ aspectosAutoevaluacion: [first] }])).toEqual([second, third]);
  expect(pendingAspects(all, [{ aspectosAutoevaluacion: [first, second] }])).toEqual([third]);
  expect(pendingAspects(all, [{ aspectosAutoevaluacion: all }])).toEqual([]);
  expect(pendingAspects(all, [{ aspectosAutoevaluacion: [first] }])).toContainEqual(second);
});

test('does not hide unrelated aspects with reused IDs and restores released aspects', () => {
  const first = { id: 1, factor: 'F1', caracteristica: 'C1', aspecto: 'A1' };
  const other = { ...first, factor: 'F2', caracteristica: 'C2', aspecto: 'A20' };
  expect(pendingAspects([first, other], [{ aspectosAutoevaluacion: [first] }])).toEqual([other]);
  expect(pendingAspects([first, other], [])).toEqual([first, other]);
});
