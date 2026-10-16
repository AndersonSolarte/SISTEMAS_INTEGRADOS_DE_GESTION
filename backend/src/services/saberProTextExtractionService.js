const { spawnSync } = require('child_process');
const zlib = require('zlib');
const pdfParse = require('pdf-parse');
const { recognizeImage } = require('./saberProOcrService');
const { parseEvaluatedData } = require('./saberProDocumentParser');

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([lenBuf, crcInput, crcBuf]);
}

function encodeRgbToPng({ width, height, data }) {
  const rowBytes = width * 3;
  const raw = Buffer.alloc((rowBytes + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (rowBytes + 1);
    raw[rawOffset] = 0;
    const srcOffset = y * rowBytes;
    Buffer.from(data.buffer, data.byteOffset + srcOffset, rowBytes).copy(raw, rawOffset + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  const compressed = zlib.deflateSync(raw);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0))
  ]);
}

function parsePpmBuffer(buffer) {
  if (!buffer || buffer.length < 16 || buffer[0] !== 0x50 || buffer[1] !== 0x36) {
    return null;
  }
  let offset = 2;
  const tokens = [];
  while (tokens.length < 3 && offset < buffer.length) {
    while (offset < buffer.length && /\s/.test(String.fromCharCode(buffer[offset]))) offset += 1;
    if (buffer[offset] === 0x23) {
      while (offset < buffer.length && buffer[offset] !== 0x0a) offset += 1;
      continue;
    }
    let token = '';
    while (offset < buffer.length && !/\s/.test(String.fromCharCode(buffer[offset]))) {
      token += String.fromCharCode(buffer[offset]);
      offset += 1;
    }
    if (token) tokens.push(Number(token));
  }
  offset += 1; // single whitespace after maxval
  const [width, height] = tokens;
  const byteLength = width * height * 3;
  if (!width || !height || offset + byteLength > buffer.length) return null;
  return {
    width,
    height,
    data: new Uint8Array(buffer.buffer, buffer.byteOffset + offset, byteLength)
  };
}

function cropRgb(img, startRatio, endRatio) {
  const startY = Math.floor(img.height * startRatio);
  const endY = Math.ceil(img.height * endRatio);
  const height = Math.max(1, endY - startY);
  const rowBytes = img.width * 3;
  return {
    width: img.width,
    height,
    data: img.data.subarray(startY * rowBytes, (startY + height) * rowBytes)
  };
}

function cropRgbRegion(img, startXRatio, startYRatio, endXRatio, endYRatio) {
  const startX = Math.floor(img.width * startXRatio);
  const startY = Math.floor(img.height * startYRatio);
  const endX = Math.ceil(img.width * endXRatio);
  const endY = Math.ceil(img.height * endYRatio);
  const width = Math.max(1, endX - startX);
  const height = Math.max(1, endY - startY);
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    const sourceStart = ((startY + y) * img.width + startX) * 3;
    out.set(img.data.subarray(sourceStart, sourceStart + (width * 3)), y * width * 3);
  }
  return { width, height, data: out };
}

function thresholdRgb(img, threshold = 200) {
  const out = new Uint8Array(img.data.length);
  for (let i = 0; i < img.data.length; i += 3) {
    const gray = (0.299 * img.data[i]) + (0.587 * img.data[i + 1]) + (0.114 * img.data[i + 2]);
    const val = gray < threshold ? 0 : 255;
    out[i] = val;
    out[i + 1] = val;
    out[i + 2] = val;
  }
  return { width: img.width, height: img.height, data: out };
}

function rotateRgb90(img, clockwise = true) {
  const width = img.height;
  const height = img.width;
  const out = new Uint8Array(width * height * 3);
  for (let y = 0; y < img.height; y += 1) {
    for (let x = 0; x < img.width; x += 1) {
      const srcIdx = (y * img.width + x) * 3;
      const dstX = clockwise ? (img.height - 1 - y) : y;
      const dstY = clockwise ? x : (img.width - 1 - x);
      const dstIdx = (dstY * width + dstX) * 3;
      out[dstIdx] = img.data[srcIdx];
      out[dstIdx + 1] = img.data[srcIdx + 1];
      out[dstIdx + 2] = img.data[srcIdx + 2];
    }
  }
  return { width, height, data: out };
}

function rotationRgbCandidates(img, clockwise) {
  const rotated = rotateRgb90(img, clockwise);
  return [
    encodeRgbToPng(cropRgb(rotated, 0, 0.48)),
    encodeRgbToPng(cropRgb(rotated, 0.48, 1)),
    encodeRgbToPng(rotated)
  ];
}

let pdftoppmAvailable = null;
function hasPdftoppm() {
  if (pdftoppmAvailable !== null) return pdftoppmAvailable;
  const check = spawnSync('pdftoppm', ['-v'], { stdio: 'ignore' });
  pdftoppmAvailable = !check.error && check.status === 0;
  return pdftoppmAvailable;
}

function renderPageWithPdftoppm(buffer, pageNumber, dpi) {
  const result = spawnSync(
    'pdftoppm',
    ['-r', String(dpi), '-f', String(pageNumber), '-l', String(pageNumber), '-singlefile'],
    { input: buffer, maxBuffer: 120 * 1024 * 1024 }
  );
  if (result.error || result.status !== 0 || !result.stdout?.length) return null;
  return parsePpmBuffer(result.stdout);
}

async function* renderPdfCandidatesWithPdftoppm(buffer) {
  for (let pageNumber = 1; pageNumber <= 3; pageNumber += 1) {
    const dpi = pageNumber === 1 ? 324 : 151;
    const img = renderPageWithPdftoppm(buffer, pageNumber, dpi);
    if (!img) break;
    if (pageNumber === 1) {
      const band = cropRgb(img, 0.58, 0.92);
      yield encodeRgbToPng(thresholdRgb(band, 200));

      const highResolution = renderPageWithPdftoppm(buffer, pageNumber, 396);
      if (highResolution) {
        const identificationBand = cropRgbRegion(highResolution, 0.25, 0.18, 0.80, 0.56);
        yield encodeRgbToPng(thresholdRgb(identificationBand, 175));
        yield encodeRgbToPng(thresholdRgb(identificationBand, 220));
      }

      yield encodeRgbToPng(thresholdRgb(band, 215));
      yield encodeRgbToPng(cropRgb(img, 0, 0.58));
    } else {
      yield encodeRgbToPng(cropRgb(img, 0, 0.58));
    }
    yield encodeRgbToPng(cropRgb(img, 0.42, 1));
    for (const candidate of rotationRgbCandidates(img, true)) yield candidate;
    for (const candidate of rotationRgbCandidates(img, false)) yield candidate;
  }
}

async function* renderPdfCandidatesWithCanvas(buffer) {
  const { createCanvas, loadImage } = require('@napi-rs/canvas');

  const cropCanvasRegion = (source, startXRatio, startYRatio, endXRatio, endYRatio) => {
    const startX = Math.floor(source.width * startXRatio);
    const startY = Math.floor(source.height * startYRatio);
    const endX = Math.ceil(source.width * endXRatio);
    const endY = Math.ceil(source.height * endYRatio);
    const target = createCanvas(endX - startX, endY - startY);
    target.getContext('2d').drawImage(
      source, startX, startY, endX - startX, endY - startY,
      0, 0, endX - startX, endY - startY
    );
    return target.toBuffer('image/png');
  };

  const cropCanvas = (source, startRatio, endRatio) => {
    return cropCanvasRegion(source, 0, startRatio, 1, endRatio);
  };

  const thresholdImage = (image, threshold = 200) => {
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
  };

  const rotateCanvas = (source, radians) => {
    const target = createCanvas(source.height, source.width);
    const context = target.getContext('2d');
    context.translate(target.width / 2, target.height / 2);
    context.rotate(radians);
    context.drawImage(source, -source.width / 2, -source.height / 2);
    return target;
  };

  const rotationCandidates = (source, radians) => {
    const rotated = rotateCanvas(source, radians);
    return [
      cropCanvas(rotated, 0, 0.48),
      cropCanvas(rotated, 0.48, 1),
      rotated.toBuffer('image/png')
    ];
  };

  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(buffer), disableWorker: true }).promise;
  const pageLimit = Math.min(pdf.numPages, 3);
  for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const scale = pageNumber === 1 ? 4.5 : 2.1;
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    if (pageNumber === 1) {
      // La fecha se conserva a 4.5x: a mayor escala algunos trazos de los
      // certificados escaneados se unen y Tesseract altera el año.
      const dateBand = cropCanvas(canvas, 0.58, 0.92);
      yield thresholdImage(await loadImage(dateBand), 200);

      // La cédula, en cambio, requiere más resolución. Se procesa únicamente
      // la franja superior central para no encarecer el OCR de toda la página.
      const idViewport = page.getViewport({ scale: 5.5 });
      const idCanvas = createCanvas(Math.ceil(idViewport.width), Math.ceil(idViewport.height));
      await page.render({ canvasContext: idCanvas.getContext('2d'), viewport: idViewport }).promise;
      const identificationBand = cropCanvasRegion(idCanvas, 0.25, 0.18, 0.80, 0.56);
      yield thresholdImage(await loadImage(identificationBand), 175);
      yield thresholdImage(await loadImage(identificationBand), 220);

      yield thresholdImage(await loadImage(dateBand), 215);
      yield cropCanvas(canvas, 0, 0.58);
    } else {
      yield cropCanvas(canvas, 0, 0.58);
    }
    yield cropCanvas(canvas, 0.42, 1);
    for (const candidate of rotationCandidates(canvas, Math.PI / 2)) yield candidate;
    for (const candidate of rotationCandidates(canvas, -Math.PI / 2)) yield candidate;
  }
}

async function* renderPdfCandidates(buffer) {
  if (hasPdftoppm()) {
    yield* renderPdfCandidatesWithPdftoppm(buffer);
    return;
  }
  yield* renderPdfCandidatesWithCanvas(buffer);
}

function complete(text, hints) {
  return parseEvaluatedData(text, hints).readComplete;
}

async function extractPdfBuffer(buffer, hints = {}) {
  const parsedPdf = await pdfParse(buffer);
  const directText = parsedPdf.text || '';
  if (complete(directText, hints) || String(process.env.OCR_ENABLED || 'true').toLowerCase() !== 'true') {
    return { text: directText, method: 'PDF_TEXT' };
  }
  let ocrText = '';
  for await (const image of renderPdfCandidates(buffer)) {
    ocrText += `\n${await recognizeImage(image)}`;
    if (complete(`${directText}\n${ocrText}`, hints)) break;
  }
  return { text: `${directText}\n${ocrText}`, method: 'OCR' };
}

module.exports = { extractPdfBuffer };
