const { createWorker } = require('tesseract.js');
const spanishData = require('@tesseract.js-data/spa');

const workerPromises = [];
const recognitionQueues = [];
let nextWorker = 0;

function poolSize() {
  return Math.max(1, Math.min(4, Number(process.env.OCR_CONCURRENCY || 3)));
}

async function getWorker(index) {
  if (!workerPromises[index]) {
    workerPromises[index] = createWorker(spanishData.code, 1, {
      langPath: spanishData.langPath,
      gzip: spanishData.gzip,
      cacheMethod: 'readOnly',
      errorHandler: () => {}
    });
  }
  return workerPromises[index];
}

async function runRecognition(index, image) {
  try {
    const worker = await getWorker(index);
    const { data } = await worker.recognize(image);
    return data.text || '';
  } catch (error) {
    const failedWorker = workerPromises[index];
    workerPromises[index] = null;
    if (failedWorker) {
      const worker = await failedWorker.catch(() => null);
      await worker?.terminate().catch(() => {});
    }
    throw error;
  }
}

function recognizeImage(image) {
  const index = nextWorker % poolSize();
  nextWorker += 1;
  const queue = recognitionQueues[index] || Promise.resolve();
  const task = queue.then(() => runRecognition(index, image));
  recognitionQueues[index] = task.catch(() => {});
  return task;
}

async function shutdownOcr() {
  await Promise.all(recognitionQueues.map((queue) => queue?.catch(() => {})));
  await Promise.all(workerPromises.map(async (workerPromise, index) => {
    if (!workerPromise) return;
    const worker = await workerPromise.catch(() => null);
    await worker?.terminate().catch(() => {});
    workerPromises[index] = null;
  }));
  recognitionQueues.length = 0;
  nextWorker = 0;
}

module.exports = { recognizeImage, shutdownOcr };
