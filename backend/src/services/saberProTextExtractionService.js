const pdfParse = require('pdf-parse');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { recognizeImage } = require('./saberProOcrService');
const { parseEvaluatedData } = require('./saberProDocumentParser');

function cropCanvas(source, startRatio, endRatio) {
  const startY = Math.floor(source.height * startRatio);
  const endY = Math.ceil(source.height * endRatio);
  const target = createCanvas(source.width, endY - startY);
  target.getContext('2d').drawImage(source, 0, startY, source.width, endY - startY,
    0, 0, source.width, endY - startY);
  return target.toBuffer('image/png');
}

function thresholdImage(image, threshold = 200) {
  const source = createCanvas(image.width, image.height);
  const context = source.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, source.width, source.height);
  for (let index = 0; index < pixels.data.length; index += 4) {
    const gray = (0.299 * pixels.data[index])
      + (0.587 * pixels.data[index + 1])
      + (0.114 * pixels.data[index + 2]);
    const value = gray < threshold ? 0 : 255;
    pixels.data[index] = value;
    pixels.data[index + 1] = value;
    pixels.data[index + 2] = value;
  }
  context.putImageData(pixels, 0, 0);
  return source.toBuffer('image/png');
}

function rotateCanvas(source, radians) {
  const target = createCanvas(source.height, source.width);
  const context = target.getContext('2d');
  context.translate(target.width / 2, target.height / 2);
  context.rotate(radians);
  context.drawImage(source, -source.width / 2, -source.height / 2);
  return target;
}

function rotationCandidates(source, radians) {
  const rotated = rotateCanvas(source, radians);
  return [
    cropCanvas(rotated, 0, 0.48),
    cropCanvas(rotated, 0.48, 1),
    rotated.toBuffer('image/png')
  ];
}

async function renderPdfCandidates(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const candidates = [];
  const pageLimit = Math.min(pdf.numPages, 3);
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const scale = pageNumber === 1 ? 4.5 : 2.1;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (pageNumber === 1) {
      candidates.push(thresholdImage(await loadImage(cropCanvas(canvas, 0.58, 0.92)), 200));
    }
    candidates.push(cropCanvas(canvas, 0, 0.58));
    candidates.push(cropCanvas(canvas, 0.42, 1));
    candidates.push(...rotationCandidates(canvas, Math.PI / 2));
    candidates.push(...rotationCandidates(canvas, -Math.PI / 2));
  }
  return candidates;
}

function complete(text, hints) {
  return parseEvaluatedData(text, hints).complete;
}

async function extractPdfBuffer(buffer, hints = {}) {
  const parsedPdf = await pdfParse(buffer);
  const directText = parsedPdf.text || '';
  if (complete(directText, hints) || String(process.env.OCR_ENABLED || 'true').toLowerCase() !== 'true') {
    return { text: directText, method: 'PDF_TEXT' };
  }
  const candidates = await renderPdfCandidates(buffer);
  let ocrText = '';
  for (const image of candidates) {
    ocrText += `\n${await recognizeImage(image)}`;
    if (complete(`${directText}\n${ocrText}`, hints)) break;
  }
  return { text: `${directText}\n${ocrText}`, method: 'OCR' };
}

module.exports = { extractPdfBuffer };
