import { uploadEvidenceBatch } from './uploadEvidenceBatch';

test('uploads every selected file in order, without an application count limit', async () => {
  const files = Array.from({ length: 125 }, (_, index) => ({ name: `${index}.pdf` }));
  const upload = jest.fn(async (file) => ({ name: file.name }));
  const result = await uploadEvidenceBatch(files, { upload });
  expect(upload).toHaveBeenCalledTimes(125);
  expect(upload.mock.calls.map(([file]) => file.name)).toEqual(files.map((file) => file.name));
  expect(result.name).toBe('124.pdf');
});

test('keeps successfully uploaded files and leaves the failed file queued for retry', async () => {
  const files = [{ name: 'first' }, { name: 'second' }, { name: 'third' }];
  let remaining = files;
  const upload = jest.fn(async (file) => {
    if (file.name === 'second') throw new Error('Connection interrupted');
    return file;
  });
  await expect(uploadEvidenceBatch(files, {
    upload, onUploaded: (_result, _file, index) => { remaining = files.slice(index + 1); }
  })).rejects.toThrow('Connection interrupted');
  expect(remaining.map((file) => file.name)).toEqual(['second', 'third']);
  expect(upload).toHaveBeenCalledTimes(2);
});

test('subsequent attachments do not replace files already stored', async () => {
  const stored = [];
  const upload = async (file) => { stored.push(file); return file; };
  await uploadEvidenceBatch(['first', 'second'], { upload });
  await uploadEvidenceBatch(['third'], { upload });
  expect(stored).toEqual(['first', 'second', 'third']);
});
