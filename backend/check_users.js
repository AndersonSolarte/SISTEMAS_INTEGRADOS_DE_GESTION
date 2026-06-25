const fs = require('fs');
const path = require('path');
const JSZip = require('jszip');

async function run() {
  try {
    const docxPath = path.resolve(__dirname, './templates/reporte-salida/FR-002 REPORTE DE SALIDA v3.docx');
    const template = await fs.promises.readFile(docxPath);
    const zip = await JSZip.loadAsync(template);
    const file = zip.file('word/document.xml');
    if (!file) throw new Error('Not document.xml');
    const xml = await file.async('string');
    const rows = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
    console.log(`Total rows in table: ${rows.length}`);
    rows.forEach((row, i) => {
      const cells = row.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
      const textArray = cells.map(cell => {
        const textMatch = cell.match(/<w:t[\s\S]*?>([\s\S]*?)<\/w:t>/g) || [];
        return textMatch.map(t => t.replace(/<[^>]*>/g, '')).join(' ');
      });
      console.log(`Row ${i}: Cells count = ${cells.length} ->`, textArray);
    });
  } catch (err) {
    console.error(err);
  }
}

run();
