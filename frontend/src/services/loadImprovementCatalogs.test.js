import { loadImprovementCatalogs, catalogFailureMessage } from './loadImprovementCatalogs';

afterEach(() => jest.useRealTimers());

test('recovers a temporary network failure', async () => {
  const request = jest.fn().mockRejectedValueOnce({ code: 'ERR_NETWORK' }).mockResolvedValue({ strategicObjectives: ['OE1'] });
  const result = loadImprovementCatalogs(request);
  await expect(result).resolves.toEqual({ strategicObjectives: ['OE1'] });
  expect(request).toHaveBeenCalledTimes(2);
});

test('does not retry permission or programming errors', async () => {
  for (const error of [{ response: { status: 403 } }, new ReferenceError('missing variable')]) {
    const request = jest.fn().mockRejectedValue(error);
    await expect(loadImprovementCatalogs(request)).rejects.toBe(error);
    expect(request).toHaveBeenCalledTimes(1);
  }
});

test('reports the actual server or transport cause', () => {
  expect(catalogFailureMessage({ response: { data: { message: 'Catálogo no disponible' } } })).toBe('Catálogo no disponible');
  expect(catalogFailureMessage({ code: 'ERR_NETWORK' })).toContain('conexión');
  expect(catalogFailureMessage({ response: { status: 500 } })).toContain('HTTP 500');
});
