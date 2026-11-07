const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const previewEvidence = async (result) => {
  if (result.mimeType !== DOCX) return null;
  const chunks = [];
  let size = 0;
  for await (const chunk of result.stream) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) throw Object.assign(new Error('El documento supera el límite de vista previa.'), { statusCode: 413 });
    chunks.push(Buffer.from(chunk));
  }
  const converted = await require('mammoth').convertToHtml({ buffer: Buffer.concat(chunks) }, { externalFileAccess: false });
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; form-action 'none'; base-uri 'none'"><style>body{font:16px/1.65 Arial,sans-serif;color:#1e293b;max-width:900px;margin:24px auto;padding:0 24px;overflow-wrap:anywhere}img{max-width:100%;height:auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #cbd5e1;padding:8px}h1,h2,h3{line-height:1.3}</style></head><body>${converted.value || '<p>El documento no contiene contenido visible.</p>'}</body></html>`;
};
module.exports = { previewEvidence };
