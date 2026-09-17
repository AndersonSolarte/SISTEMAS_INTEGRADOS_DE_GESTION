const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const { PRIVACY_POLICY_PARAGRAPHS, PRIVACY_POLICY_URL } = require('../constants/privacyPolicy');

const printer = new PdfPrinter({
  SIAC: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' }
});

const logoPath = path.join(__dirname, '..', 'assets', 'logo_formatos.jpg');
const logo = fs.existsSync(logoPath) ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;
const borderLayout = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => '#111111',
  vLineColor: () => '#111111',
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4
};
const decodeHtml = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
const plainHtml = (value = '') => decodeHtml(String(value)
  .replace(/<br\s*\/?\s*>/gi, '\n')
  .replace(/<\/\s*(p|div|h2|h3|li|blockquote)\s*>/gi, '\n')
  .replace(/<li[^>]*>/gi, '• ')
  .replace(/<[^>]+>/g, ''))
  .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

const richTable = (html = '') => {
  const body = [];
  let maxCells = 0;
  for (const rowMatch of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const header = cellMatch[1].toLowerCase() === 'th';
      row.push({ text: plainHtml(cellMatch[2]), bold: header, fillColor: header ? '#f2f2f2' : undefined, alignment: header ? 'center' : 'left' });
    }
    if (row.length) { maxCells = Math.max(maxCells, row.length); body.push(row); }
  }
  if (!body.length) return null;
  for (const row of body) while (row.length < maxCells) row.push('');
  return { table: { widths: Array(maxCells).fill('*'), body, dontBreakRows: true }, layout: borderLayout, margin: [0, 3, 0, 5] };
};

const richNodes = (lines = []) => {
  const source = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).join('<br>');
  if (!source) return [{ text: '', margin: [0, 2] }];
  const nodes = [];
  for (const segment of source.split(/(<table[^>]*>[\s\S]*?<\/table>)/gi)) {
    if (!segment) continue;
    if (/^<table/i.test(segment)) {
      const table = richTable(segment);
      if (table) nodes.push(table);
    } else {
      const text = plainHtml(segment);
      if (text) nodes.push({ text, lineHeight: 1.25, margin: [0, 2, 0, 4] });
    }
  }
  return nodes.length ? nodes : [{ text: plainHtml(source), margin: [0, 2] }];
};

const section = (title, lines) => ({
  table: {
    widths: ['*'],
    body: [
      [{ text: title, bold: true, alignment: 'center', fillColor: '#d9d9d9' }],
      [{ stack: richNodes(lines), minHeight: 70 }]
    ]
  },
  layout: borderLayout,
  margin: [0, 0, 0, 8]
});

const generateMeetingMinutePdf = async (payload = {}) => {
  const header = payload.header || {};
  const participants = Array.isArray(payload.participantes) ? payload.participantes : [];
  const participantRows = participants.map((participant, index) => {
    const signature = String(participant.firma_data_url || '');
    const signatureCell = /^data:image\/(png|jpeg);base64,/i.test(signature)
      ? { image: signature, fit: [92, 32], alignment: 'center' }
      : { text: participant.firma || 'Pendiente', alignment: 'center', color: '#64748b', bold: true };
    return [{ text: String(index + 1), alignment: 'center', bold: true }, participant.nombre || '', participant.cargo || '', signatureCell];
  });
  const definition = {
    pageSize: 'LETTER',
    pageMargins: [30, 32, 30, 38],
    footer: (current, total) => ({ text: `SIAC UNICESMAG  ·  Página ${current} de ${total}`, alignment: 'center', color: '#64748b', fontSize: 7, margin: [0, 12, 0, 0] }),
    content: [
      {
        table: { widths: [155, '*', 130], body: [[
          logo ? { image: logo, fit: [145, 54], alignment: 'center', margin: [0, 4] } : { text: 'UNIVERSIDAD CESMAG', bold: true, alignment: 'center' },
          { text: 'REGISTRO DE ASISTENCIA Y REUNIÓN', bold: true, fontSize: 14, alignment: 'center', margin: [0, 18, 0, 0] },
          { text: `CÓDIGO: ${header.codigo || 'COM-ID-FR-002'}\nVERSIÓN: ${header.version || '1'}\nFECHA: ${header.fecha || payload.fecha || ''}`, bold: true, fontSize: 8, margin: [2, 9, 0, 0] }
        ]] }, layout: borderLayout
      },
      { table: { widths: ['*'], body: [[{ text: [{ text: 'Responsable(s): ', bold: true }, payload.responsables || ''] }], [{ text: [{ text: 'Dependencia que cita: ', bold: true }, payload.dependencia || ''] }]] }, layout: borderLayout },
      { table: { widths: ['*'], body: [[{ text: 'Información de la Reunión', bold: true, alignment: 'center', fillColor: '#d9d9d9' }], [{ text: [{ text: 'Lugar: ', bold: true }, payload.lugar || ''] }]] }, layout: borderLayout },
      { table: { widths: ['*', 150], body: [[{ text: [{ text: 'Fecha: ', bold: true }, payload.fecha || ''] }, { text: [{ text: 'Horario: ', bold: true }, payload.horario || ''] }]] }, layout: borderLayout },
      {
        table: {
          headerRows: 2,
          widths: [28, '*', 180, 115],
          body: [
            [{ text: 'Participantes', colSpan: 4, bold: true, alignment: 'center', fillColor: '#d9d9d9' }, {}, {}, {}],
            [{ text: '', fillColor: '#f2f2f2' }, { text: 'Nombres y Apellidos', bold: true, alignment: 'center', fillColor: '#f2f2f2' }, { text: 'Entidad / Cargo', bold: true, alignment: 'center', fillColor: '#f2f2f2' }, { text: 'Firma', bold: true, alignment: 'center', fillColor: '#f2f2f2' }],
            ...participantRows
          ],
          dontBreakRows: true
        },
        layout: borderLayout,
        margin: [0, 0, 0, 8]
      },
      section('Objetivo', payload.objetivo),
      section('Desarrollo', payload.desarrollo),
      section('Conclusiones / Compromisos', payload.conclusiones),
      {
        unbreakable: false,
        margin: [0, 8, 0, 0],
        stack: [
          { text: 'TRATAMIENTO DE DATOS PERSONALES', bold: true, color: '#174ea6', fontSize: 9, margin: [0, 0, 0, 5] },
          ...PRIVACY_POLICY_PARAGRAPHS.map((paragraph) => ({ text: paragraph, fontSize: 7.5, color: '#475569', lineHeight: 1.2, margin: [0, 0, 0, 5] })),
          { text: 'Consultar la política institucional completa', link: PRIVACY_POLICY_URL, decoration: 'underline', color: '#174ea6', fontSize: 7.5 }
        ]
      }
    ],
    defaultStyle: { font: 'SIAC', fontSize: 9, color: '#111111' }
  };
  const pdf = printer.createPdfKitDocument(definition);
  const chunks = [];
  return new Promise((resolve, reject) => {
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
};

module.exports = { generateMeetingMinutePdf, _internals: { plainHtml, richTable } };
