// Artefactos visuales sintéticos. No consulta BD, envía correos ni sustituye documentos reales.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '../..');
const PdfPrinter = require(path.join(root, 'backend/node_modules/pdfmake'));
const canvasLibrary = require(path.join(root, 'backend/node_modules/@napi-rs/canvas'));
const { buildOficioPdfDefinition } = require(path.join(root, 'backend/src/services/reporteSalidaPdfService'));

async function main() {
  const plan = [{ key: 'jefe', label: 'Jefe inmediato' }, { key: 'financiera_previa', label: 'Vicerrectoría Financiera' },
    { key: 'sst', label: 'Seguridad y Salud en el Trabajo' }, { key: 'gestion_humana', label: 'Gestión del Talento Humano' }];
  const events = ['aprobada_jefe', 'aprobada_vicerrectoria_financiera', 'aprobada_sst', 'aprobada_gestion_humana', 'pago_autorizado_tesoreria'];
  const solicitud = { id: 1, consecutivo: 'PRUEBA-VISUAL-SIN-VALIDEZ', estado: 'finalizada', created_at: '2026-11-18T14:00:00Z',
    solicitante_snapshot: { nombre: 'COLABORADOR DE EJEMPLO', username: '0000000000', email: 'colaborador@example.invalid' },
    jefe_snapshot: { nombre: 'DIRECTOR DE EJEMPLO', cargo: 'Director de dependencia' },
    datos_formulario: { origen_flujo: 'desplazamiento_viaticos', tx_id: 'prueba-visual-sin-validez',
      laboral: { dependencia: 'Dependencia de Ejemplo', cargo: 'Profesional universitario' },
      salida: { tipo: 'visita_ies', categoria: 'propias_cargo', alcance: 'Nacional', entidadDestino: 'Universidad de Ejemplo', municipio: 'Medellín',
        fecha: '2026-11-20', fechaRegreso: '2026-11-21', horaInicio: '06:00', horaFin: '19:00', motivo: 'Participación en una jornada de cooperación académica.' },
      viaticos: { requiereViaticos: true, numeroDiasSolicitados: 2, fechaEvento: '2026-11-20', transporte: 'Aéreo', alojamiento: 'Hotel',
        objetoComision: 'Presentar la propuesta institucional e intercambiar experiencias para fortalecer la cooperación entre instituciones de educación superior.',
        observacionesEspeciales: 'Desplazamiento sujeto a la agenda institucional registrada y a los conceptos autorizados en el FR-004.' },
      plan_aprobacion_normal: plan },
    trazabilidad: [{ event: 'radicada', at: '2026-11-18T14:00:00Z' }, ...events.map((event, index) => ({ event, at: `2026-11-18T15:0${index}:00Z`,
      actor: { nombre: `RESPONSABLE DE PRUEBA ${index + 1}`, cargo: plan[index]?.label || 'Tesorería / Pagaduría', email: `responsable${index + 1}@example.invalid` },
      detail: index === 0 ? { observacion: 'Se recomienda atender la agenda prevista y coordinar la continuidad de las actividades de la dependencia.' } : {} }))] };
  const definition = buildOficioPdfDefinition(solicitud);
  definition.content.unshift({ text: 'VISTA DE PRUEBA · DATOS FICTICIOS · SIN VALIDEZ INSTITUCIONAL', color: '#b91c1c', bold: true, fontSize: 8, margin: [0, 0, 0, 8] });
  const fonts = process.platform === 'win32'
    ? { normal: 'C:/Windows/Fonts/arial.ttf', bold: 'C:/Windows/Fonts/arialbd.ttf', italics: 'C:/Windows/Fonts/ariali.ttf', bolditalics: 'C:/Windows/Fonts/arialbi.ttf' }
    : { normal: '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', bold: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', italics: '/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf', bolditalics: '/usr/share/fonts/truetype/dejavu/DejaVuSans-BoldOblique.ttf' };
  const printer = new PdfPrinter({ ReportFont: fonts });
  const buffer = await new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(definition), chunks = [];
    doc.on('data', chunk => chunks.push(chunk)); doc.on('end', () => resolve(Buffer.concat(chunks))); doc.on('error', reject); doc.end();
  });
  const output = path.join(root, 'tmp/viaticos-oficio-preview');
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'oficio-salida-ejemplo.pdf'), buffer);
  Object.assign(globalThis, { DOMMatrix: canvasLibrary.DOMMatrix, Path2D: canvasLibrary.Path2D, ImageData: canvasLibrary.ImageData });
  const pdfjs = await import(pathToFileURL(path.join(root, 'backend/node_modules/pdfjs-dist/legacy/build/pdf.mjs')).href);
  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer), useSystemFonts: true }).promise;
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber), viewport = page.getViewport({ scale: 1.4 });
    const canvas = canvasLibrary.createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    fs.writeFileSync(path.join(output, `pagina-${pageNumber}.png`), canvas.toBuffer('image/png'));
  }
  console.log(`Vista de prueba: ${document.numPages} páginas. ${path.join(output, 'oficio-salida-ejemplo.pdf')}`);
  await document.destroy();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
