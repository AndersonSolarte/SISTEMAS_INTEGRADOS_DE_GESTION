const path = require('path');

const formatConsentDate = (value) => new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
}).format(new Date(value));

const buildSaludConsentimientoPdfSection = (solicitud) => {
  const data = solicitud?.datos_formulario || {};
  const record = data.consentimiento_salud;
  // Los documentos anteriores conservan su evidencia original: no se presume aceptación.
  if (!record?.accepted || !record.policy) return [];
  const { policy, actor } = record;
  return [
    { text: policy.title, bold: true, color: '#173b60', fontSize: 11, alignment: 'center', pageBreak: 'before', margin: [0, 0, 0, 14] },
    ...policy.paragraphs.map((text) => ({ text, fontSize: 9.3, lineHeight: 1.12, alignment: 'justify', margin: [0, 0, 0, 8] })),
    {
      unbreakable: true,
      stack: [
        { text: policy.declarationTitle, bold: true, margin: [0, 4, 0, 8] },
        { text: `[X] ${policy.declaration}`, margin: [0, 0, 0, 10] },
        { text: `Nombre: ${actor.nombre}` },
        { text: `Documento de identidad: ${actor.documento}` },
        { text: `Firma: aceptación electrónica mediante ${record.method}` },
        { text: `Cuenta institucional: ${actor.correo}` },
        { text: `Fecha: ${formatConsentDate(record.acceptedAt)} (America/Bogota)` },
        { text: `Solicitud: ${solicitud.consecutivo || solicitud.id || ''}` },
        { text: `ID de transacción del reporte: ${data.tx_id || ''}`, fontSize: 8 },
        { text: `ID de aceptación: ${record.transactionId}`, fontSize: 8 },
        { text: `Versión del texto: ${policy.version}`, fontSize: 8 },
        { text: `SHA-256 del texto: ${policy.hash}`, fontSize: 7 },
        { text: `SHA-256 de la evidencia: ${record.evidenceHash}`, fontSize: 7 }
      ],
      fontSize: 9
    }
  ];
};

// El anexo usa sus propios márgenes y membrete sin alterar las páginas del reporte.
const appendSaludConsentimientoPdf = (pdf, solicitud, fonts) => {
  const section = buildSaludConsentimientoPdfSection(solicitud);
  if (!section.length) return;
  const letterhead = path.join(__dirname, '../assets/fr013-carta-bg.png');
  const left = 55;
  const width = 502;
  const bottom = 672;
  const drawLetterhead = () => {
    const { x, y } = pdf;
    pdf.save().image(letterhead, 0, 0, { width: 612, height: 792 }).restore();
    pdf.x = x;
    pdf.y = y;
  };
  const addPage = () => pdf.addPage({ size: 'LETTER', margins: { top: 100, bottom: 120, left, right: 55 } });
  pdf.on('pageAdded', drawLetterhead);
  try {
    addPage();
    const title = section[0];
    pdf.font(fonts.bold).fontSize(11).fillColor('#173b60').text(title.text, left, pdf.y, { width, align: title.alignment, lineGap: 2 });
    pdf.moveDown(0.6);
    pdf.save().strokeColor('#d6dfe8').lineWidth(0.6).moveTo(left, pdf.y).lineTo(left + width, pdf.y).stroke().restore();
    pdf.moveDown(0.8);
    for (const node of section.slice(1, -1)) {
      pdf.font(node.bold ? fonts.bold : fonts.normal).fontSize(node.bold ? 9.5 : 9.3).fillColor(node.bold ? '#173b60' : '#263343');
      pdf.text(node.text, left, pdf.y, { width, align: node.alignment || 'left', lineGap: 1.5 });
      pdf.moveDown(0.65);
    }

    const lines = section[section.length - 1].stack;
    // Mantener juntos la manifestación, los datos de la persona y la evidencia.
    const rows = [[lines[0]], [lines[1]], [lines[2], lines[3]], [lines[4]], [lines[5], lines[6]], ...lines.slice(7).map((line) => [line])];
    const heights = rows.map((row) => {
      const columnWidth = (width - 20 - (row.length - 1) * 16) / row.length;
      return Math.max(...row.map((line) => {
        pdf.font(line.bold ? fonts.bold : fonts.normal).fontSize(line.fontSize || 8.7);
        return pdf.heightOfString(line.text, { width: columnWidth, lineGap: 1 });
      })) + 2;
    });
    const blockHeight = heights.reduce((total, height) => total + height, 0) + 20;
    if (pdf.y + blockHeight > bottom) addPage();
    const top = pdf.y + 4;
    pdf.save().roundedRect(left, top, width, blockHeight, 4).fillAndStroke('#f8fafc', '#d6dfe8').restore();
    pdf.y = top + 10;
    rows.forEach((row, index) => {
      const columnWidth = (width - 20 - (row.length - 1) * 16) / row.length;
      const y = pdf.y;
      row.forEach((line, column) => {
        pdf.font(line.bold ? fonts.bold : fonts.normal).fontSize(line.fontSize || 8.7).fillColor(line.bold ? '#173b60' : (line.fontSize ? '#526277' : '#263343'));
        pdf.text(line.text, left + 10 + column * (columnWidth + 16), y, { width: columnWidth, lineGap: 1 });
      });
      pdf.y = y + heights[index];
    });
  } finally {
    pdf.removeListener('pageAdded', drawLetterhead);
  }
};

module.exports = { buildSaludConsentimientoPdfSection, appendSaludConsentimientoPdf };
