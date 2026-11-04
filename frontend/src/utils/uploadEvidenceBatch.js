export const uploadEvidenceBatch = async (selectedFiles, { upload, onStart, onUploaded }) => {
  const files = Array.from(selectedFiles || []);
  let last;
  for (let index = 0; index < files.length; index += 1) {
    onStart?.(files[index], index, files.length);
    last = await upload(files[index]);
    onUploaded?.(last, files[index], index, files);
  }
  return last;
};
