const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

const printer = new PdfPrinter({
  SIAC: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' }
});

const text = (value) => String(value ?? '').trim();
const paragraphs = (value) => (Array.isArray(value) ? value : [value]).filter(Boolean).map((line) => ({ text: text(line), margin: [0, 2, 0, 2] }));
const logoPath = path.join(__dirname, '..', 'assets', 'logo_formatos.jpg');
const formatLogo = fs.existsSync(logoPath) ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;

const generateStrategicMinutePdf = ({ minute, signatures = [], validationUrl = '', qrDataUrl = '' }) => {
  const content = minute.content || {};
  const body = [
    [{ text: 'Participante', bold: true }, { text: 'Entidad / cargo', bold: true }, { text: 'Firma electrónica', bold: true }, { text: 'Fecha', bold: true }],
    ...signatures.map((signature) => {
      let image = null;
      if (signature.signature_storage_key && fs.existsSync(signature.signature_storage_key)) {
        const mime = /\.jpe?g$/i.test(signature.signature_storage_key) ? 'image/jpeg' : 'image/png';
        image = `data:${mime};base64,${fs.readFileSync(signature.signature_storage_key).toString('base64')}`;
      }
      return [text(signature.signer_name), `${text(signature.signer_organization)}\n${text(signature.signer_role)}`, image ? { image, fit: [110, 45] } : 'Registrada', new Date(signature.signed_at).toLocaleString('es-CO')];
    })
  ];
  const definition = {
    pageSize: 'LETTER', pageMargins: [40, 40, 40, 45],
    content: [
      { table: { widths: [155, '*', 120], body: [[formatLogo ? { image: formatLogo, fit: [145, 54], alignment: 'center', margin: [0, 3] } : '', { text: 'REGISTRO DE ASISTENCIA Y REUNIÓN', bold: true, fontSize: 15, alignment: 'center', margin: [0, 15] }, { text: 'CÓDIGO: COM-IF-FR-002\nVERSIÓN: 1\nFECHA: 6/MAR/2020', bold: true, fontSize: 8, margin: [2, 7] }]] } },
      { text: `Acta versión ${minute.version}`, bold: true, fontSize: 12, margin: [0, 14, 0, 8] },
      { columns: [{ text: `Responsable(s): ${text(content.responsables)}` }, { text: `Dependencia: ${text(content.dependencia)}` }] },
      { text: `Lugar: ${text(content.lugar)}   Fecha: ${text(content.fecha)}   Horario: ${text(content.horario)}`, margin: [0, 7] },
      { text: 'Objetivo', bold: true, margin: [0, 10, 0, 3] }, ...paragraphs(content.objetivo),
      { text: 'Desarrollo', bold: true, margin: [0, 10, 0, 3] }, ...paragraphs(content.desarrollo),
      { text: 'Conclusiones / Compromisos', bold: true, margin: [0, 10, 0, 3] }, ...paragraphs(content.conclusiones),
      { text: 'Firmas vinculadas a esta versión', bold: true, margin: [0, 14, 0, 5] },
      { table: { headerRows: 1, widths: ['*', '*', 115, 85], body }, layout: 'lightHorizontalLines' },
      { columns: [qrDataUrl ? { image: qrDataUrl, width: 95, margin: [0, 15, 10, 0] } : {}, { stack: [{ text: 'Validación SIAC', bold: true, margin: [0, 20, 0, 3] }, { text: validationUrl, fontSize: 8 }, { text: `Huella del contenido: ${minute.content_hash}`, fontSize: 7, margin: [0, 5, 0, 0] }] }] },
      { text: 'Firma electrónica con trazabilidad SIAC. No corresponde a una firma digital certificada.', italics: true, fontSize: 8, margin: [0, 12, 0, 0] }
    ], defaultStyle: { font: 'SIAC', fontSize: 9 }
  };
  const document = printer.createPdfKitDocument(definition); const chunks = [];
  return new Promise((resolve, reject) => { document.on('data', (chunk) => chunks.push(chunk)); document.on('end', () => resolve(Buffer.concat(chunks))); document.on('error', reject); document.end(); });
};

module.exports = { generateStrategicMinutePdf };
