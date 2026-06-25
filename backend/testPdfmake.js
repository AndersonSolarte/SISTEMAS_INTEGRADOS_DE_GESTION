const PdfPrinter = require('pdfmake');

const fonts = {
  Roboto: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);

const docDefinition = {
  defaultStyle: { font: 'Roboto' },
  content: [
    'First paragraph',
    'Another paragraph'
  ]
};

try {
  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  console.log('PDF doc created successfully with standard fonts');
} catch (e) {
  console.error('Error:', e.message);
}
