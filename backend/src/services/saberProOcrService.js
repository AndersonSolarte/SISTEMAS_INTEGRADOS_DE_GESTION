const { createWorker } = require('tesseract.js');
const spanishData = require('@tesseract.js-data/spa');

let workerPromise;
let recognitionQueue = Promise.resolve();

async function getWorker() {
  if (!workerPromise) {
    workerPromise = createWorker(spanishData.code, 1, {
      langPath: spanishData.langPath,
      gzip: spanishData.gzip,
      cacheMethod: 'readOnly',
      errorHandler: () => {}
    });
  }
  return workerPromise;
}

async function runRecognition(image) {
  try {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return data.text || '';
  } catch (error) {
    const failedWorker = workerPromise;
    workerPromise = null;
    if (failedWorker) {
      const worker = await failedWorker.catch(() => null);
      await worker?.terminate().catch(() => {});
    }
    throw error;
  }
}

function recognizeImage(image) {
  const task = recognitionQueue.then(() => runRecognition(image));
  recognitionQueue = task.catch(() => {});
  return task;
}

async function shutdownOcr() {
  await recognitionQueue.catch(() => {});
  if (!workerPromise) return;
  const worker = await workerPromise.catch(() => null);
  await worker?.terminate().catch(() => {});
  workerPromise = null;
}

module.exports = { recognizeImage, shutdownOcr };
