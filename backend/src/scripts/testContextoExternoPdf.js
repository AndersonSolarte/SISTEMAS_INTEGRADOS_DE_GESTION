const assert = require('node:assert/strict');
const { Resvg } = require('@resvg/resvg-js');
const parsePdf = require('pdf-parse');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const radialCategories = require('../assets/contextoExternoRadial.json');
const { offerSummaryVisualSvg, offerSummaryPdfBlock, stackedBarChartSvg, populationChartPdfBlock, generateContextoExternoGeneralPdf } = require('../services/contextoExternoGeneralPdfService');

const oferta = Array.from({ length: 10 }, (_, i) => ({
  nombre_programa: 'Programa de prueba',
  reconocimiento_men: i < 7 ? 'REGISTRO CALIFICADO' : 'ACREDITACIÓN DE ALTA CALIDAD',
  sector: i < 5 ? 'PRIVADA' : 'PÚBLICO', modalidad: 'PRESENCIAL',
  numero_semestres: i < 6 ? 6 : i < 9 ? 8 : 9,
  numero_creditos: [66, 146, 85, 85, 85, 85, 85, 85, 85, 106][i],
  georeferencia: 'REGIONAL'
}));
const poblacional = ['2024-1', '2024-2', '2025-1', '2025-2'].map((periodo_referencia, i) => ({
  periodo_referencia,
  ...Object.fromEntries(['nacional', 'regional'].flatMap((scope) =>
    ['inscritos', 'admitidos', 'primer_curso', 'matriculados', 'graduados'].map((metric, j) =>
      [`${metric}_${scope}`, (i + 1) * (j + 2) * 10])))
}));

async function verifyPopulationPdfRendering() {
  const fs = require('node:fs');
  const path = require('node:path');
  const nativeCanvas = require('@napi-rs/canvas');
  Object.assign(global, { DOMMatrix: nativeCanvas.DOMMatrix, Path2D: nativeCanvas.Path2D, ImageData: nativeCanvas.ImageData });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const sample = Array.from({ length: 14 }, (_, i) => ({
    periodo_referencia: `${2019 + Math.floor(i / 2)}-${i % 2 + 1}`,
    inscritos_nacional: 24 + i * 4, admitidos_nacional: 24 + i * 2, primer_curso_nacional: 23 + i,
    inscritos_regional: i === 5 ? 1 : i === 13 ? 9 : 2 + i % 5,
    admitidos_regional: i === 5 ? 1 : i === 13 ? 9 : 2 + i % 5,
    primer_curso_regional: i === 5 ? 1 : i === 13 ? 9 : 2 + i % 5,
    matriculados_nacional: 222 + i * 4, matriculados_regional: 27 + i % 8,
    graduados_nacional: 17 + i % 14, graduados_regional: i === 5 ? 1 : 2 + i % 5
  }));
  for (const group of ['ingreso', 'matriculados', 'graduados']) {
    const pdf = await generateContextoExternoGeneralPdf({ program: 'DOCTORADO EN FILOSOFÍA Y AFINES', poblacional: sample, section: 'poblacional', populationGroup: group, visualizations: { [group]: { chartType: 'stacked', scope: 'ambos' } }, includeAnalysis: false });
    const doc = await pdfjs.getDocument({ data: new Uint8Array(pdf), useSystemFonts: false, disableFontFace: true, standardFontDataUrl: path.resolve(__dirname, '../../node_modules/pdfjs-dist/standard_fonts') + '/' }).promise;
    assert.equal(doc.numPages, 2);
    for (let pageNumber = 1; pageNumber <= 2; pageNumber++) {
      const scope = pageNumber === 1 ? 'nacional' : 'regional';
      const page = await doc.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
      const context = canvas.getContext('2d');
      await page.render({ canvasContext: context, viewport }).promise;
      const text = await page.getTextContent();
      const years = text.items.filter((item) => /^20(19|2[0-5])$/.test(item.str));
      const semesters = text.items.filter((item) => /^II?$/.test(item.str));
      assert.equal(years.length, 14, `${group}/${scope}: todos los años`);
      assert.equal(semesters.length, 14, `${group}/${scope}: todos los semestres`);
      // Check actual pixels, because PDF text extraction can include clipped text.
      for (const item of [...years, ...semesters]) {
        const [x, y] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
        const pixels = context.getImageData(Math.floor(x), Math.floor(y - item.height * viewport.scale - 2), Math.ceil(item.width * viewport.scale + 2), Math.ceil(item.height * viewport.scale + 5)).data;
        assert(pixels.some((value, i) => i % 4 !== 3 && value < 150), `${group}/${scope}: etiqueta ${item.str} visible sin recorte`);
      }
      if (group === 'graduados' && scope === 'regional') assert(text.items.some((item) => item.str === '1'), 'Graduados regional: valor 1 visible');
      if (process.argv.includes('--preview')) {
        const output = path.resolve(__dirname, '../../../entregables/contexto-externo-validacion');
        fs.mkdirSync(output, { recursive: true });
        fs.writeFileSync(path.join(output, `${group}-${scope}-corregido.png`), canvas.toBuffer('image/png'));
      }
      console.log(`OK PDF renderizado ${group}/${scope}: 14 barras, años y semestres completos`);
    }
    await doc.destroy();
  }
}

async function main() {
  await verifyPopulationPdfRendering();
  const tinySeries = [
    { key: 'inscritos', label: 'Inscritos', color: '#2f6fed' },
    { key: 'admitidos', label: 'Admitidos', color: '#df2426' },
    { key: 'primer_curso', label: 'Primer curso', color: '#687b94' }
  ];
  const tinyData = [
    { periodo: '2024-1', inscritos: 100, admitidos: 60, primer_curso: 40 },
    { periodo: '2024-2', inscritos: 1, admitidos: 1, primer_curso: 1 },
    { periodo: '2025-1', inscritos: 40, admitidos: 1, primer_curso: 0 },
    { periodo: '2025-2', inscritos: 1, admitidos: 0, primer_curso: 0 }
  ];
  const tinySvg = stackedBarChartSvg({ data: tinyData, series: tinySeries, width: 955, height: 300 });
  const valueLabels = [...tinySvg.matchAll(/data-stack-value="([\d-]+)"[^>]*>([^<]+)<\/text>/g)];
  assert.equal(valueLabels.length, 9, 'Una etiqueta por cada segmento positivo');
  assert.equal(valueLabels.filter((match) => match[2] === '1').length, 5, 'Todos los valores de uno tienen etiqueta');
  const levels = new Map();
  for (const match of tinySvg.matchAll(/<text data-stack-value="([\d-]+)" data-segment-top="([\d.]+)" data-segment-height="([\d.]+)" x="([\d.]+)" y="([\d.]+)"[^>]*font-size="([\d.]+)"[^>]*fill="#ffffff"/g)) {
    const [, key, top, height, x, baseline, font] = match;
    assert(Number(baseline) - Number(font) * .72 >= Number(top), `${key}: etiqueta dentro de su nivel`);
    assert(Number(baseline) <= Number(top) + Number(height), `${key}: etiqueta sobre la base del segmento`);
    levels.set(key, { x: Number(x), baseline: Number(baseline) });
  }
  assert.equal(levels.size, 9, 'Todas las etiquetas permanecen dentro de las barras');
  const valueFontSizes = [...tinySvg.matchAll(/data-stack-value="[\d-]+"[^>]*font-size="([\d.]+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual([...new Set(valueFontSizes)], [9], 'Todos los números tienen exactamente el mismo tamaño legible');
  assert.equal(levels.get('1-0').x, levels.get('1-1').x);
  assert.equal(levels.get('1-1').x, levels.get('1-2').x);
  assert(levels.get('1-0').baseline > levels.get('1-1').baseline && levels.get('1-1').baseline > levels.get('1-2').baseline, 'Los tres unos están en niveles distintos de la misma barra');
  const fitted = populationChartPdfBlock(tinySvg);
  const nativeHeight = Number(tinySvg.match(/<svg[^>]*height="([\d.]+)"/)[1]);
  assert(fitted.svg.includes(`viewBox="0 0 955 ${nativeHeight}"`), 'Escala todo el gráfico en lugar de recortarlo');
  assert.equal(fitted.height, nativeHeight * fitted.width / 955, 'Altura de impresión proporcional');
  assert(fitted.height <= 460.01, 'El gráfico ampliado cabe en la página');
  assert(fitted.svg.includes('2025'), 'Período final incluido');
  console.log('OK barras: etiquetas de valores 1, segmentos mixtos, ceros y escalado completo');
  assert.deepEqual(radialCategories, require('../../../frontend/src/data/contextoExternoRadial.json'), 'Mismos colores y ángulos en pantalla y PDF');
  const radialSvg = offerSummaryVisualSvg({ rows: oferta, view: 'radial', program: 'Programa' });
  const center = radialSvg.match(/<circle cx="([\d.]+)" cy="([\d.]+)" r="79"/);
  assert(center, 'Anillo radial presente');
  const rendered = await loadImage(new Resvg(radialSvg).render().asPng());
  const canvas = createCanvas(rendered.width, rendered.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(rendered, 0, 0);
  for (const category of radialCategories) {
    assert(category.angle > category.startAngle && category.angle < category.endAngle, `Unión ${category.slot} dentro de su tramo`);
    for (const part of ['arc', 'link']) {
      assert(radialSvg.match(new RegExp(`data-radial-${part}="${category.slot}"[^>]*stroke="${category.color}"`)), `Color ${category.slot}/${part}`);
    }
    const angle = category.angle * Math.PI / 180;
    const pixel = ctx.getImageData(Math.round(Number(center[1]) + 79 * Math.cos(angle)), Math.round(Number(center[2]) + 79 * Math.sin(angle)), 1, 1).data;
    const expected = category.color.slice(1).match(/../g).map((hex) => parseInt(hex, 16));
    expected.forEach((channel, i) => assert(Math.abs(pixel[i] - channel) < 12, `Unión ${category.slot}: color renderizado correcto`));
  }
  console.log('OK radial: cada unión coincide con su tarjeta y tramo del anillo, en pantalla y PDF');
  const orbitSvg = offerSummaryVisualSvg({ rows: oferta, view: 'orbit', program: 'Programa' });
  const orbitCenter = orbitSvg.match(/data-orbit-center="true" cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/);
  const orbitCards = [...orbitSvg.matchAll(/data-orbit-card="\d+" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)].map((m) => m.slice(1).map(Number));
  assert.equal(orbitCards.length, 5);
  const [circleX, circleY, radius] = orbitCenter.slice(1).map(Number);
  const lastCard = orbitCards.at(-1);
  assert.equal((circleX - radius + lastCard[0] + lastCard[2]) / 2, 955 / 2, 'Composición centrada horizontalmente');
  assert.equal(circleY, (orbitCards[0][1] + lastCard[1] + lastCard[3]) / 2, 'Círculo centrado respecto a las cinco tarjetas');
  for (const match of orbitSvg.matchAll(/data-orbit-value="(\d+)-\d+" x="([\d.]+)" y="([\d.]+)" width="([\d.]+)" height="([\d.]+)"/g)) {
    const [, index, x, y, w, h] = match.map(Number);
    const card = orbitCards[index];
    assert(x >= card[0] && x + w <= card[0] + card[2], 'Valor dentro del ancho de la tarjeta');
    assert(y >= card[1] && y + h <= card[1] + card[3] - 8, 'Margen inferior de los valores');
  }
  for (const view of ['sequence', 'panel', 'orbit', 'radial', 'executive']) {
    for (const scope of ['Nacional', 'Regional']) {
      const svg = offerSummaryVisualSvg({ rows: oferta, view, scope, program: 'DOCTORADO EN FILOSOFÍA Y AFINES' });
      const labels = [...svg.matchAll(/<text\b[^>]*>(.*?)<\/text>/g)].map((match) => match[1]).join(' ');
      assert(labels.includes('ACREDITACIÓN DE ALTA CALIDAD'), `${view}: etiqueta completa`);
      assert(labels.includes('91,30'), `${view}: promedio con dos decimales`);
      assert(!labels.includes('…') && !labels.includes('OTRAS'), `${view}: todas las categorías`);
      assert(new Resvg(svg).render().asPng().length > 0, `${view}: renderizado`);
    }
    const block = offerSummaryPdfBlock({ rows: oferta, view, program: 'Programa' });
    const dimensions = block.svg.match(/<svg[^>]*width="([\d.]+)" height="([\d.]+)"/);
    const printedHeight = Number(dimensions[2]) * block.width / Number(dimensions[1]);
    assert(printedHeight <= 460.01, `${view}: cabe en la altura de impresión`);
    assert(Math.abs(block.margin[0] + block.width / 2 - 480) < 0.01, `${view}: centrado en la página`);
    const pdf = await generateContextoExternoGeneralPdf({ program: 'Programa', oferta, offerView: view, section: 'oferta', includeAnalysis: false });
    const parsed = await parsePdf(pdf);
    assert(parsed.text.includes('91,30'), `${view}: promedio conservado en PDF`);
    assert(!parsed.text.includes('OTRAS'), `${view}: categorías conservadas en PDF`);
    assert.equal(parsed.numpages, 3, `${view}: tablas y dos resúmenes sin páginas adicionales`);
    console.log(`OK resumen ${view}: nacional, regional y PDF (${parsed.numpages} páginas)`);
  }
  const chartTypes = ['stacked', 'trend', 'funnel', 'indicators', 'shaded', 'bubbles', 'periodCards', 'journey', 'timeline', 'conversion', 'stackedArea'];
  for (const chartType of chartTypes) {
    for (const populationGroup of ['ingreso', 'matriculados', 'graduados']) {
      const pdf = await generateContextoExternoGeneralPdf({ program: 'Programa', poblacional, section: 'poblacional', populationGroup, visualizations: { [populationGroup]: { chartType, scope: 'ambos' } }, includeAnalysis: false });
      const parsed = await parsePdf(pdf);
      assert.equal(parsed.numpages, 2, `${chartType}/${populationGroup}: un gráfico por página sin desbordamientos`);
      if (chartType !== 'indicators' || populationGroup === 'ingreso') {
        assert(parsed.text.includes('2024'), `${chartType}/${populationGroup}: períodos conservados`);
      } else {
        assert(parsed.text.includes('TOTAL ACUMULADO'), `${populationGroup}: indicadores conservados`);
      }
    }
    console.log(`OK poblacional ${chartType}: ingreso, matriculados y graduados`);
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
