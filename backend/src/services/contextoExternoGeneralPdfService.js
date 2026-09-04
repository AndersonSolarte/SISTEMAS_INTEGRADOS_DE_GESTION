const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');

const printer = new PdfPrinter({
  ReportFont: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
});

const headerPath = path.join(__dirname, '../assets/Encabezado_correos.png');
const BLUE = '#082b66';
const RED = '#b5123f';
const GRID = '#dbe4f0';
const COLORS = ['#173f96', '#b5123f', '#64748b', '#0f766e', '#d97706', '#7c3aed'];
const format = new Intl.NumberFormat('es-CO');
const geoDepartmentPath = path.resolve(__dirname, '../../../frontend/public/geodata/colombia_adm1.geojson');
const geoMunicipalityPath = path.resolve(__dirname, '../../../frontend/public/geodata/divipola_municipios.json');
let geoCache = null;

const text = (value) => String(value ?? '').trim();
const number = (value) => Number(value || 0);
const escapeXml = (value) => text(value).replace(/[<>&"']/g, (char) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[char]));
const normalizeGeo = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').replace(/\s+/g, ' ').trim();
const sum = (rows, field) => rows.reduce((total, row) => total + number(row[field]), 0);
const periodLabel = (value) => {
  const [year, semester] = text(value).split('-');
  return `${year}-${semester === '1' ? 'I' : semester === '2' ? 'II' : semester || ''}`;
};

const sectionHeader = (title, program) => ([
  ...(fs.existsSync(headerPath) ? [{ image: headerPath, fit: [690, 58], alignment: 'center', margin: [0, 0, 0, 6] }] : []),
  {
    table: { widths: ['*'], body: [[{ text: title, color: '#ffffff', fillColor: RED, bold: true, fontSize: 13, alignment: 'center', margin: [0, 6, 0, 6] }]] },
    layout: 'noBorders'
  },
  { text: program, color: BLUE, bold: true, fontSize: 15, alignment: 'center', margin: [0, 7, 0, 10] }
]);

const reportCoverPage = ({ program, nationalOffer, regionalOffer, poblacional }) => {
  const periods = new Set(poblacional.map((row) => text(row.periodo_referencia)).filter(Boolean));
  const generatedAt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date());
  return [
    ...(fs.existsSync(headerPath) ? [{ image: headerPath, fit: [690, 76], alignment: 'center', margin: [0, 4, 0, 22] }] : []),
    {
      table: {
        widths: ['*'],
        body: [[{
          stack: [
            { text: 'INFORME INTEGRAL', color: '#ffffff', bold: true, fontSize: 12, characterSpacing: 1.8, alignment: 'center', margin: [0, 12, 0, 5] },
            { text: 'CONTEXTO EXTERNO GENERAL', color: '#ffffff', bold: true, fontSize: 25, alignment: 'center', margin: [0, 0, 0, 7] },
            { text: 'Oferta académica e información poblacional nacional y regional', color: '#dce8fb', fontSize: 10, alignment: 'center', margin: [0, 0, 0, 14] }
          ],
          fillColor: BLUE
        }]]
      },
      layout: 'noBorders',
      margin: [0, 0, 0, 20]
    },
    { text: program, color: BLUE, bold: true, fontSize: 21, alignment: 'center', margin: [20, 0, 20, 20] },
    {
      columns: [
        card('PROGRAMAS EN LA OFERTA NACIONAL', nationalOffer.length),
        card('PROGRAMAS EN LA OFERTA REGIONAL', regionalOffer.length),
        card('PERÍODOS ACADÉMICOS ANALIZADOS', periods.size)
      ],
      columnGap: 12,
      margin: [45, 0, 45, 22]
    },
    { text: 'El documento reúne la visualización de oferta seleccionada, los mapas territoriales y los gráficos poblacionales de ambos alcances conservando datos, etiquetas y colores.', alignment: 'center', color: '#52657c', fontSize: 9, margin: [60, 0, 60, 12] },
    { text: `Generado: ${generatedAt}`, alignment: 'center', color: '#7b8ca3', fontSize: 8 },
    { text: '', pageBreak: 'after' }
  ];
};

const card = (label, value) => ({
  table: {
    widths: ['*'],
    body: [[{ text: label, color: '#52657c', bold: true, fontSize: 7.5, alignment: 'center', margin: [2, 3] }], [{ text: format.format(number(value)), color: BLUE, bold: true, fontSize: 16, alignment: 'center', margin: [2, 5] }]]
  },
  layout: { hLineColor: () => GRID, vLineColor: () => GRID }
});

const labelCountRows = (rows, field) => {
  const counts = new Map();
  rows.forEach((row) => {
    const key = text(row[field]);
    if (!key) return;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  return Array.from(counts, ([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
};

const compactTable = (title, rows, maxRows = 12) => {
  const visibleRows = rows.slice(0, maxRows);
  const total = rows.reduce((acc, row) => acc + number(row.value), 0);
  return ({
  stack: [
    { text: title, color: '#ffffff', fillColor: BLUE, bold: true, fontSize: 8, alignment: 'center', margin: [2, 4] },
    {
      table: {
        headerRows: 1,
        widths: ['*', 58],
        body: [
          [{ text: 'Categoría', bold: true, fontSize: 7 }, { text: 'Total', bold: true, alignment: 'right', fontSize: 7 }],
          ...visibleRows.map((row) => [{ text: row.label, fontSize: 7 }, { text: format.format(row.value), alignment: 'right', fontSize: 7 }]),
          [{ text: 'Total', bold: true, fontSize: 7 }, { text: format.format(total), bold: true, alignment: 'right', fontSize: 7 }]
        ]
      },
      layout: { hLineColor: () => GRID, vLineColor: () => GRID }
    }
  ]
  });
};

const stackedBarChartSvg = ({ data, series, width = 690, height = 350, title = '', subtitle = '', scope = '' }) => {
  const visibleData = data.filter((row) => series.some((item) => number(row[item.key]) > 0));
  const margin = { left: 54, right: 18, top: 72, bottom: 55 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxStack = Math.max(1, ...visibleData.map((row) => series.reduce((total, item) => total + number(row[item.key]), 0)));
  const maxValue = maxStack * 1.08;
  const slotWidth = chartW / Math.max(1, visibleData.length);
  const barWidth = Math.max(12, Math.min(42, slotWidth * 0.62));
  const x = (index) => margin.left + slotWidth * index + slotWidth / 2;
  const y = (value) => margin.top + chartH - (number(value) / maxValue) * chartH;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const gy = margin.top + (index * chartH) / 4;
    const value = Math.round(maxValue * (1 - index / 4));
    const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}k` : format.format(value);
    return `<line x1="${margin.left}" y1="${gy}" x2="${margin.left + chartW}" y2="${gy}" stroke="#e5eaf1" stroke-dasharray="3 4"/><text x="${margin.left - 7}" y="${gy + 3}" text-anchor="end" font-size="8" font-weight="bold" fill="#52657c">${escapeXml(compact)}</text>`;
  }).join('');
  const bars = visibleData.map((row, rowIndex) => {
    let cumulative = 0;
    return series.map((item, seriesIndex) => {
      const value = number(row[item.key]);
      const top = y(cumulative + value);
      const bottom = y(cumulative);
      const segmentHeight = Math.max(0, bottom - top);
      cumulative += value;
      if (!value) return '';
      const radius = seriesIndex === series.length - 1 ? ' rx="4"' : '';
      const formatted = format.format(value);
      const externalLabelWidth = Math.max(18, formatted.length * 4.2 + 7);
      const label = segmentHeight >= 9 && barWidth >= 22
        ? `<text x="${x(rowIndex)}" y="${top + segmentHeight / 2 + (segmentHeight < 16 ? 2.2 : 3)}" text-anchor="middle" font-size="${segmentHeight < 16 ? 5.8 : 7.2}" font-weight="bold" fill="#ffffff">${escapeXml(formatted)}</text>`
        : `<line x1="${x(rowIndex) + barWidth / 2}" y1="${top + Math.max(3, segmentHeight / 2)}" x2="${x(rowIndex) + barWidth / 2 + 4}" y2="${top + Math.max(3, segmentHeight / 2)}" stroke="#64748b" stroke-width=".6"/><rect x="${x(rowIndex) + barWidth / 2 + 4}" y="${top + Math.max(3, segmentHeight / 2) - 5.5}" width="${externalLabelWidth}" height="11" rx="3" fill="#fff" stroke="#94a3b8" stroke-width=".5"/><text x="${x(rowIndex) + barWidth / 2 + 4 + externalLabelWidth / 2}" y="${top + Math.max(3, segmentHeight / 2) + 2}" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#263b55">${escapeXml(formatted)}</text>`;
      return `<rect x="${x(rowIndex) - barWidth / 2}" y="${top}" width="${barWidth}" height="${segmentHeight}" fill="${item.color || COLORS[seriesIndex]}"${radius}/>${label}`;
    }).join('');
  }).join('');
  const labels = visibleData.map((row, index) => {
    const [year, semester] = text(row.periodo).split('-');
    const semesterLabel = semester === '1' ? 'I' : semester === '2' ? 'II' : semester || '—';
    return `<rect x="${x(index) - 10}" y="${height - 45}" width="20" height="15" rx="7.5" fill="#e7edf5"/><text x="${x(index)}" y="${height - 34}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#52657c">${escapeXml(semesterLabel)}</text><text x="${x(index)}" y="${height - 17}" text-anchor="middle" font-size="8" font-weight="bold" fill="#102a4c">${escapeXml(year)}</text>`;
  }).join('');
  const legendWidth = series.length * 106;
  const legend = series.map((item, index) => {
    const lx = width / 2 - legendWidth / 2 + index * 106;
    return `<circle cx="${lx}" cy="52" r="4" fill="${item.color || COLORS[index]}"/><text x="${lx + 7}" y="55" font-size="8" font-weight="bold" fill="#334155">${escapeXml(item.label)}</text>`;
  }).join('');
  const scopeWidth = 64;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#ffffff" stroke="#cbd9ea"/><text x="18" y="24" font-size="11" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text><text x="18" y="38" font-size="8" fill="#64748b">${escapeXml(subtitle)}</text><rect x="${width - scopeWidth - 18}" y="15" width="${scopeWidth}" height="20" rx="10" fill="#2f6fed"/><text x="${width - scopeWidth / 2 - 18}" y="28.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#ffffff">${escapeXml(scope)}</text>${legend}${grid}<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="#91a4bd"/>${bars}${labels}</svg>`;
};

const trendLineChartSvg = ({ data, series, width = 690, height = 350, subtitle = '', scope = '' }) => {
  const visibleData = data.filter((row) => series.some((item) => number(row[item.key]) > 0));
  const margin = { left: 54, right: 28, top: 88, bottom: 48 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxRaw = Math.max(1, ...visibleData.flatMap((row) => series.map((item) => number(row[item.key]))));
  const maxValue = maxRaw * 1.12;
  const x = (index) => margin.left + (visibleData.length <= 1 ? chartW / 2 : (index * chartW) / (visibleData.length - 1));
  const y = (value) => margin.top + chartH - (number(value) / maxValue) * chartH;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const gy = margin.top + (index * chartH) / 4;
    const value = Math.round(maxValue * (1 - index / 4));
    const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}k` : format.format(value);
    return `<line x1="${margin.left}" y1="${gy}" x2="${margin.left + chartW}" y2="${gy}" stroke="#e5eaf1" stroke-dasharray="3 4"/><text x="${margin.left - 7}" y="${gy + 3}" text-anchor="end" font-size="8" font-weight="bold" fill="#52657c">${escapeXml(compact)}</text>`;
  }).join('');
  const paths = series.map((item, seriesIndex) => {
    const color = item.color || COLORS[seriesIndex];
    const points = visibleData.map((row, index) => `${x(index)},${y(row[item.key])}`).join(' ');
    const dots = visibleData.map((row, index) => {
      const value = number(row[item.key]);
      return `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.3"/><text x="${x(index)}" y="${y(value) - 8}" text-anchor="middle" font-size="7" font-weight="bold" fill="${color}" stroke="#fff" stroke-width="2.4" paint-order="stroke">${escapeXml(format.format(value))}</text>`;
    }).join('');
    return `<polyline points="${points}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="miter" stroke-linecap="square"/>${dots}`;
  }).join('');
  const labels = visibleData.map((row, index) => `<text x="${x(index)}" y="${height - 34}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#52657c">${escapeXml(text(row.periodo).replace('-', ' · '))}</text>`).join('');
  const legendWidth = series.length * 112;
  const legend = series.map((item, index) => {
    const lx = width / 2 - legendWidth / 2 + index * 112;
    return `<line x1="${lx}" y1="${height - 14}" x2="${lx + 15}" y2="${height - 14}" stroke="${item.color || COLORS[index]}" stroke-width="2.5"/><circle cx="${lx + 7.5}" cy="${height - 14}" r="3" fill="${item.color || COLORS[index]}"/><text x="${lx + 20}" y="${height - 11}" font-size="8" font-weight="bold" fill="#334155">${escapeXml(item.label)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#ffffff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">ANÁLISIS HISTÓRICO</text><text x="18" y="37" font-size="8" fill="#64748b">${escapeXml(subtitle)}</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><rect x="1" y="47" width="${width - 2}" height="23" fill="#082b66"/><text x="${width / 2}" y="62" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff">LÍNEAS DE TENDENCIA</text>${grid}<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="#91a4bd"/>${paths}${labels}${legend}</svg>`;
};

const funnelChartSvg = ({ data, series, width = 690, height = 310, scope = '' }) => {
  const visibleData = data.filter((row) => series.some((item) => number(row[item.key]) > 0));
  const maxValue = Math.max(1, ...visibleData.flatMap((row) => series.map((item) => number(row[item.key]))));
  const left = 112;
  const chartW = width - left - 16;
  const slot = chartW / Math.max(1, visibleData.length);
  const stageTop = 84;
  const stageHeight = 55;
  const gap = 5;
  const legends = series.map((item, index) => {
    const centerY = stageTop + index * (stageHeight + gap) + stageHeight / 2;
    return `<rect x="12" y="${centerY - 16}" width="88" height="32" rx="8" fill="#fff" stroke="${item.color}" stroke-opacity=".3"/><circle cx="25" cy="${centerY}" r="6" fill="${item.color}"/><text x="36" y="${centerY - 1}" font-size="7" font-weight="bold" fill="${item.color}">${escapeXml(item.label.toUpperCase())}</text><text x="36" y="${centerY + 9}" font-size="5.8" fill="#64748b">Etapa ${index + 1}</text>`;
  }).join('');
  const funnels = visibleData.map((row, rowIndex) => {
    const centerX = left + slot * rowIndex + slot / 2;
    const [year, semester] = text(row.periodo).split('-');
    const divider = rowIndex > 0 ? `<line x1="${left + slot * rowIndex}" y1="53" x2="${left + slot * rowIndex}" y2="${height - 13}" stroke="#e5edf6" stroke-dasharray="2 4"/>` : '';
    const header = `${divider}<text x="${centerX}" y="60" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#102a4c">${escapeXml(year)}</text><rect x="${centerX - 8}" y="65" width="16" height="12" rx="6" fill="#e7edf5"/><text x="${centerX}" y="73.8" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#52657c">${escapeXml(semester === '1' ? 'I' : semester === '2' ? 'II' : semester)}</text>`;
    const stages = series.map((item, stageIndex) => {
      const value = number(row[item.key]);
      const segmentWidth = Math.max(16, Math.sqrt(value / maxValue) * Math.min(42, slot * .78));
      const nextValue = stageIndex < series.length - 1 ? number(row[series[stageIndex + 1].key]) : value * .72;
      const bottomWidth = Math.max(13, Math.min(segmentWidth - 2.5, Math.sqrt(nextValue / maxValue) * Math.min(38, slot * .7)));
      const topY = stageTop + stageIndex * (stageHeight + gap);
      const points = `${centerX - segmentWidth / 2},${topY} ${centerX + segmentWidth / 2},${topY} ${centerX + bottomWidth / 2},${topY + stageHeight} ${centerX - bottomWidth / 2},${topY + stageHeight}`;
      const fontSize = segmentWidth < 25 ? 5 : 5.8;
      return `<polygon points="${points}" fill="${item.color}" stroke="#fff" stroke-width="1.3"/><text x="${centerX}" y="${topY + stageHeight / 2 + 2}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#fff" stroke="${item.color}" stroke-width="1" paint-order="stroke">${escapeXml(format.format(value))}</text>`;
    }).join('');
    return `${header}${stages}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">TRAYECTORIA DE ACCESO POR PERÍODO</text><text x="18" y="37" font-size="8" fill="#64748b">Comparación visual de inscritos, admitidos y estudiantes que ingresan a primer curso.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><rect x="1" y="47" width="${width - 2}" height="23" fill="#082b66"/><text x="${width / 2}" y="62" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff">EMBUDO COMPARATIVO</text>${legends}${funnels}</svg>`;
};

const indicatorTrendBoardSvg = ({ data, series, width = 690, height = 295, scope = '' }) => {
  const years = data
    .filter((row) => series.some((item) => number(row[item.key]) > 0))
    .map((row) => ({ ...row, year: periodLabel(row.periodo) }));
  if (!years.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const left = 148;
  const trendWidth = 92;
  const right = 12;
  const yearWidth = (width - left - trendWidth - right) / years.length;
  const headerY = 75;
  const rowHeight = 52;
  const header = years.map((row, index) => `<text x="${left + index * yearWidth + yearWidth / 2}" y="${headerY + 18}" text-anchor="middle" font-size="${years.length > 14 ? 5.1 : 7.5}" font-weight="bold" fill="#334155">${escapeXml(row.year)}</text>`).join('');
  const rows = series.map((item, rowIndex) => {
    const values = years.map((row) => number(row[item.key]));
    const first = values.find((value) => value > 0) || 0;
    const last = [...values].reverse().find((value) => value > 0) || 0;
    const variation = first > 0 ? ((last - first) / first) * 100 : 0;
    const trendColor = variation >= 0 ? '#15803d' : '#dc2626';
    const y = headerY + 28 + rowIndex * rowHeight;
    const cells = values.map((value, index) => `<line x1="${left + index * yearWidth}" y1="${y}" x2="${left + index * yearWidth}" y2="${y + rowHeight}" stroke="#edf1f6"/><text x="${left + index * yearWidth + yearWidth / 2}" y="${y + 29}" text-anchor="middle" font-size="7.2" font-weight="bold" fill="${item.color}">${escapeXml(format.format(value))}</text>`).join('');
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const sparkX = width - trendWidth + 13;
    const sparkY = y + 28;
    const points = values.map((value, index) => `${sparkX + index * 54 / Math.max(1, values.length - 1)},${sparkY + 13 - ((value - min) / range) * 17}`).join(' ');
    const dots = values.map((value, index) => `<circle cx="${sparkX + index * 54 / Math.max(1, values.length - 1)}" cy="${sparkY + 13 - ((value - min) / range) * 17}" r="1.5" fill="${trendColor}"/>`).join('');
    const label = rowIndex === 2
      ? `<text x="46" y="${y + 24}" font-size="6.4" font-weight="bold" fill="${item.color}">MATRICULADOS A</text><text x="46" y="${y + 34}" font-size="6.4" font-weight="bold" fill="${item.color}">PRIMER CURSO</text>`
      : `<text x="46" y="${y + 29}" font-size="7.2" font-weight="bold" fill="${item.color}">${escapeXml(item.label.toUpperCase())}</text>`;
    return `<rect x="10" y="${y}" width="${width - 20}" height="${rowHeight}" fill="${rowIndex % 2 ? '#fbfdff' : '#fff'}"/><rect x="10" y="${y}" width="${left - 10}" height="${rowHeight}" fill="${item.soft || '#eef4fb'}"/><rect x="10" y="${y}" width="4" height="${rowHeight}" fill="${item.color}"/><circle cx="29" cy="${y + 26}" r="11" fill="${item.color}"/>${label}${cells}<line x1="${width - trendWidth}" y1="${y}" x2="${width - trendWidth}" y2="${y + rowHeight}" stroke="#d8e3f0"/><text x="${sparkX}" y="${y + 15}" font-size="7.3" font-weight="bold" fill="${trendColor}">${variation >= 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}%</text><polyline points="${points}" fill="none" stroke="${trendColor}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${dots}<line x1="10" y1="${y + rowHeight}" x2="${width - 10}" y2="${y + rowHeight}" stroke="#e2e8f0"/>`;
  }).join('');
  const legend = series.map((item, index) => `<line x1="${190 + index * 135}" y1="280" x2="${207 + index * 135}" y2="280" stroke="${item.color}" stroke-width="3"/><text x="${213 + index * 135}" y="283" font-size="6.5" font-weight="bold" fill="#52657c">${escapeXml(index === 2 ? 'Matriculados a primer curso' : item.label)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">TABLERO DE INDICADORES CON TENDENCIAS</text><text x="18" y="38" font-size="7.5" fill="#64748b">Valores por período y variación acumulada del primero al último período visible.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><rect x="10" y="${headerY}" width="${width - 20}" height="28" rx="7" fill="#f4f7fb"/><text x="22" y="${headerY + 18}" font-size="7" font-weight="bold" fill="#52657c">INDICADOR</text>${header}<text x="${width - trendWidth / 2}" y="${headerY + 12}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#52657c">TENDENCIA</text><text x="${width - trendWidth / 2}" y="${headerY + 21}" text-anchor="middle" font-size="5.8" fill="#64748b">${escapeXml(years[0].year)}–${escapeXml(years[years.length - 1].year)}</text>${rows}<rect x="10" y="266" width="${width - 20}" height="22" rx="6" fill="#f7f9fc"/>${legend}</svg>`;
};

const shadedTrendChartSvg = ({ data, series, width = 690, height = 285, scope = '' }) => {
  const years = data
    .filter((row) => series.some((item) => number(row[item.key]) > 0))
    .map((row) => ({ ...row, year: periodLabel(row.periodo) }));
  if (!years.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const chartLeft = 112;
  const chartRight = width - 92;
  const plotWidth = chartRight - chartLeft;
  const rowTop = 71;
  const rowHeight = 61;
  const x = (index) => chartLeft + index * plotWidth / Math.max(1, years.length - 1);
  const gradients = series.map((item, index) => `<linearGradient id="pdf-shade-${index}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${item.color}" stop-opacity=".26"/><stop offset="100%" stop-color="${item.color}" stop-opacity=".03"/></linearGradient>`).join('');
  const rows = series.map((item, seriesIndex) => {
    const values = years.map((row) => number(row[item.key]));
    const max = Math.max(1, ...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const top = rowTop + seriesIndex * rowHeight;
    const baseline = top + 42;
    const y = (value) => top + 5 + (1 - (value - min) / range) * 25;
    const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const area = `${chartLeft},${baseline} ${points} ${chartRight},${baseline}`;
    const first = values.find((value) => value > 0) || 0;
    const last = [...values].reverse().find((value) => value > 0) || 0;
    const variation = first > 0 ? ((last - first) / first) * 100 : 0;
    const trendColor = variation >= 0 ? '#15803d' : '#dc2626';
    const dots = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="${item.color}" stroke="#fff" stroke-width="1.2"/><text x="${x(index)}" y="${y(value) - 6}" text-anchor="middle" font-size="5.8" font-weight="bold" fill="${item.color}" stroke="#fff" stroke-width="2" paint-order="stroke">${escapeXml(format.format(value))}</text>`).join('');
    return `<line x1="${chartLeft}" y1="${baseline}" x2="${chartRight}" y2="${baseline}" stroke="#d9e3ef"/><rect x="12" y="${top + 5}" width="91" height="36" rx="8" fill="#fff" stroke="${item.color}" stroke-opacity=".3"/><circle cx="27" cy="${top + 23}" r="9" fill="${item.color}"/><text x="42" y="${top + 26}" font-size="6.8" font-weight="bold" fill="${item.color}">${escapeXml(item.label.toUpperCase())}</text><polygon points="${area}" fill="url(#pdf-shade-${seriesIndex})"/><polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/>${dots}<line x1="${chartRight + 7}" y1="${top + 23}" x2="${chartRight + 22}" y2="${top + 23}" stroke="${trendColor}" stroke-dasharray="3 3"/><circle cx="${chartRight + 50}" cy="${top + 23}" r="18" fill="${variation >= 0 ? '#f0fdf4' : '#fff5f5'}" stroke="${trendColor}" stroke-width="1.5" stroke-dasharray="3 2"/><text x="${chartRight + 50}" y="${top + 26}" text-anchor="middle" font-size="7" font-weight="bold" fill="${trendColor}">${variation >= 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}%</text>`;
  }).join('');
  const yearLabels = years.map((row, index) => `<text x="${x(index)}" y="${height - 14}" text-anchor="middle" font-size="${years.length > 14 ? 5.1 : 7}" font-weight="bold" fill="#334155">${escapeXml(row.year)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs>${gradients}</defs><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">LÍNEAS DE TENDENCIA CON ÁREAS SOMBREADAS</text><text x="18" y="38" font-size="7.5" fill="#64748b">Evolución por período y variación acumulada por indicador.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><text x="${chartRight + 50}" y="53" text-anchor="middle" font-size="6.5" font-weight="bold" fill="#52657c">VARIACIÓN</text><text x="${chartRight + 50}" y="63" text-anchor="middle" font-size="5.5" fill="#64748b">${escapeXml(years[0].year)}–${escapeXml(years[years.length - 1].year)}</text>${rows}${yearLabels}</svg>`;
};

const bubbleMatrixChartSvg = ({ data, series, width = 690, height = 260, scope = '' }) => {
  const years = data
    .filter((row) => series.some((item) => number(row[item.key]) > 0))
    .map((row) => ({ ...row, year: periodLabel(row.periodo) }));
  if (!years.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const chartLeft = 114;
  const chartRight = width - 12;
  const slot = (chartRight - chartLeft) / years.length;
  const globalMax = Math.max(1, ...years.flatMap((row) => series.map((item) => number(row[item.key]))));
  const radius = (value) => value > 0 ? 4.5 + Math.sqrt(value / globalMax) * 12.5 : 0;
  const headers = years.map((row, index) => `<text x="${chartLeft + index * slot + slot / 2}" y="76" text-anchor="middle" font-size="${years.length > 14 ? 5.1 : 7.5}" font-weight="bold" fill="#263b56">${escapeXml(row.year)}</text>`).join('');
  const rows = series.map((item, rowIndex) => {
    const cy = 111 + rowIndex * 55;
    const values = years.map((row, index) => {
      const value = number(row[item.key]);
      const cx = chartLeft + index * slot + slot / 2;
      const r = radius(value);
      return `${value > 0 ? `<circle cx="${cx}" cy="${cy - 5}" r="${r}" fill="${item.color}" fill-opacity=".94" stroke="#fff" stroke-width="1.2"/>` : ''}<text x="${cx}" y="${cy + 22}" text-anchor="middle" font-size="6.7" font-weight="bold" fill="${item.color}">${escapeXml(format.format(value))}</text>`;
    }).join('');
    const firstLine = rowIndex === 2 ? 'MATRICULADOS A' : item.label.toUpperCase();
    const secondLine = rowIndex === 2 ? `<text x="43" y="${cy + 7}" font-size="5.8" font-weight="bold" fill="${item.color}">PRIMER CURSO</text>` : '';
    return `<rect x="10" y="${cy - 30}" width="${width - 20}" height="50" rx="8" fill="${rowIndex % 2 ? '#fff' : '#fbfdff'}" stroke="#e4ebf4"/><rect x="16" y="${cy - 22}" width="91" height="36" rx="8" fill="${item.soft || '#eef4fb'}"/><circle cx="30" cy="${cy - 4}" r="9" fill="${item.color}"/><text x="43" y="${cy + (rowIndex === 2 ? -3 : 0)}" font-size="6.2" font-weight="bold" fill="${item.color}">${escapeXml(firstLine)}</text>${secondLine}${values}`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">CÍRCULOS PROPORCIONALES</text><text x="18" y="38" font-size="7.5" fill="#64748b">El área de cada círculo representa la magnitud del indicador en cada período.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><rect x="10" y="57" width="${width - 20}" height="27" rx="7" fill="#f3f7fc"/><text x="22" y="75" font-size="6.8" font-weight="bold" fill="#52657c">INDICADOR</text>${headers}${rows}</svg>`;
};

const periodCardsChartSvg = ({ data, series, width = 690, height = 350, scope = '' }) => {
  const visibleData = data.filter((row) => series.some((item) => number(row[item.key]) > 0));
  if (!visibleData.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const columns = visibleData.length > 18 ? 7 : 6;
  const gap = 6;
  const marginX = 10;
  const top = 58;
  const availableHeight = height - top - 12;
  const rowCount = Math.ceil(visibleData.length / columns);
  const cardWidth = (width - marginX * 2 - gap * (columns - 1)) / columns;
  const cardHeight = Math.min(88, (availableHeight - gap * (rowCount - 1)) / rowCount);
  const cards = visibleData.map((row, index) => {
    const col = index % columns;
    const line = Math.floor(index / columns);
    const x = marginX + col * (cardWidth + gap);
    const y = top + line * (cardHeight + gap);
    const values = series.map((item) => number(row[item.key]));
    const absorption = values[1] > 0 ? values[2] / values[1] * 100 : 0;
    const gauge = Math.max(0, Math.min(100, absorption));
    const [year, semester] = text(row.periodo).split('-');
    const period = `${year}-${semester === '1' ? 'I' : semester === '2' ? 'II' : semester}`;
    const metricY = [y + 35, y + 49, y + 63];
    const metrics = series.map((item, metricIndex) => `<circle cx="${x + 12}" cy="${metricY[metricIndex] - 2}" r="4.2" fill="${item.color}"/><text x="${x + 20}" y="${metricY[metricIndex]}" font-size="5.8" font-weight="bold" fill="#52657c">${escapeXml(metricIndex === 2 ? 'Primer curso' : item.label)}</text><text x="${x + cardWidth - 7}" y="${metricY[metricIndex]}" text-anchor="end" font-size="6.5" font-weight="bold" fill="${item.color}">${escapeXml(format.format(values[metricIndex]))}</text>`).join('');
    return `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="8" fill="#fff" stroke="#cdd9e8"/><path d="M ${x} ${y + 8} Q ${x} ${y} ${x + 8} ${y} H ${x + cardWidth - 8} Q ${x + cardWidth} ${y} ${x + cardWidth} ${y + 8} V ${y + 23} H ${x} Z" fill="#082b66"/><text x="${x + cardWidth / 2}" y="${y + 16}" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">${escapeXml(period)}</text>${metrics}<path d="M ${x + 13} ${y + cardHeight - 6} A ${cardWidth / 2 - 13} ${cardWidth / 2 - 13} 0 0 1 ${x + cardWidth - 13} ${y + cardHeight - 6}" fill="none" stroke="#e4ebf4" stroke-width="5" stroke-linecap="round" pathLength="100"/><path d="M ${x + 13} ${y + cardHeight - 6} A ${cardWidth / 2 - 13} ${cardWidth / 2 - 13} 0 0 1 ${x + cardWidth - 13} ${y + cardHeight - 6}" fill="none" stroke="#1593a5" stroke-width="5" stroke-linecap="round" pathLength="100" stroke-dasharray="${gauge} 100"/><text x="${x + cardWidth / 2}" y="${y + cardHeight - 5}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#082b66">${Math.round(absorption)}%</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">TARJETAS POR PERIODO ACADÉMICO</text><text x="18" y="38" font-size="7.5" fill="#64748b">Lectura individual del flujo de ingreso y su tasa de absorción.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text>${cards}</svg>`;
};

const studentJourneyChartSvg = ({ data, series, width = 690, height = 285, scope = '' }) => {
  const years = data
    .filter((row) => series.some((item) => number(row[item.key]) > 0))
    .map((row) => ({ ...row, year: periodLabel(row.periodo) }));
  if (!years.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const left = 112;
  const right = width - 18;
  const plotWidth = right - left;
  const x = (index) => left + index * plotWidth / Math.max(1, years.length - 1);
  const headers = years.map((row, index) => `<text x="${x(index)}" y="66" text-anchor="middle" font-size="${years.length > 14 ? 5.1 : 7.5}" font-weight="bold" fill="#263b56">${escapeXml(row.year)}</text>`).join('');
  const lanes = series.map((item, rowIndex) => {
    const values = years.map((row) => number(row[item.key]));
    const min = Math.min(...values);
    const max = Math.max(1, ...values);
    const range = max - min || 1;
    const baseY = 103 + rowIndex * 57;
    const y = (value) => baseY + 5 - ((value - min) / range) * 10;
    const points = values.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const nodes = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="10" fill="${item.color}" stroke="#fff" stroke-width="1.5"/><text x="${x(index)}" y="${y(value) + 3}" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#fff">${rowIndex === 0 ? 'I' : rowIndex === 1 ? 'A' : 'PC'}</text><text x="${x(index)}" y="${y(value) + 21}" text-anchor="middle" font-size="6.2" font-weight="bold" fill="${item.color}" stroke="#fff" stroke-width="1.8" paint-order="stroke">${escapeXml(format.format(value))}</text>`).join('');
    const label = rowIndex === 2 ? `<text x="43" y="${baseY - 2}" font-size="6.2" font-weight="bold" fill="${item.color}">MATRICULADOS A</text><text x="43" y="${baseY + 8}" font-size="6.2" font-weight="bold" fill="${item.color}">PRIMER CURSO</text>` : `<text x="43" y="${baseY + 3}" font-size="7" font-weight="bold" fill="${item.color}">${escapeXml(item.label.toUpperCase())}</text>`;
    return `<rect x="10" y="${baseY - 24}" width="${width - 20}" height="47" rx="9" fill="${rowIndex % 2 ? '#fff' : '#fbfdff'}" stroke="#e5edf6"/><rect x="16" y="${baseY - 18}" width="88" height="35" rx="8" fill="${item.soft || '#eef4fb'}"/><circle cx="30" cy="${baseY}" r="9" fill="${item.color}"/>${label}<polyline points="${points}" fill="none" stroke="${item.color}" stroke-opacity=".22" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>${nodes}`;
  }).join('');
  const legend = series.map((item, index) => `<line x1="${184 + index * 145}" y1="271" x2="${202 + index * 145}" y2="271" stroke="${item.color}" stroke-width="2.5"/><circle cx="${193 + index * 145}" cy="271" r="3" fill="${item.color}"/><text x="${208 + index * 145}" y="274" font-size="6.2" font-weight="bold" fill="#52657c">${escapeXml(index === 2 ? 'Matriculados a primer curso' : item.label)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">CAMINO DEL ESTUDIANTE</text><text x="18" y="38" font-size="7.5" fill="#64748b">Trayectoria por período desde la inscripción hasta el ingreso a primer curso.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><rect x="10" y="50" width="${width - 20}" height="25" rx="7" fill="#f3f7fc"/><text x="22" y="66" font-size="6.8" font-weight="bold" fill="#52657c">ETAPA</text>${headers}${lanes}${legend}</svg>`;
};

const annualTimelineChartSvg = ({ data, series, width = 690, height = 300, scope = '' }) => {
  const years = data
    .filter((row) => series.some((item) => number(row[item.key]) > 0))
    .map((row) => ({ ...row, year: periodLabel(row.periodo) }));
  if (!years.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const left = 18;
  const right = width - 18;
  const slot = (right - left) / years.length;
  const cardWidth = Math.max(26, Math.min(86, slot - 4));
  const cardTop = 67;
  const cardHeight = 170;
  const timelineY = 260;
  const centerX = (index) => left + index * slot + slot / 2;
  const cards = years.map((row, index) => {
    const cx = centerX(index);
    const cardX = cx - cardWidth / 2;
    const compact = cardWidth < 62;
    const metrics = series.map((item, metricIndex) => {
      const cy = cardTop + 55 + metricIndex * 38;
      const value = number(row[item.key]);
      return `<circle cx="${cardX + (compact ? 10 : 14)}" cy="${cy - 3}" r="${compact ? 6 : 7}" fill="${item.color}"/><text x="${cardX + (compact ? 10 : 14)}" y="${cy - 1}" text-anchor="middle" font-size="${metricIndex === 2 ? 3.8 : 5}" font-weight="bold" fill="#fff">${metricIndex === 0 ? 'I' : metricIndex === 1 ? 'A' : 'PC'}</text>${compact ? '' : `<text x="${cardX + 25}" y="${cy - 7}" font-size="4.8" font-weight="bold" fill="#64748b">${escapeXml(metricIndex === 2 ? 'Primer curso' : item.label)}</text>`}<text x="${compact ? cx : cardX + 25}" y="${cy + (compact ? 11 : 4)}" text-anchor="${compact ? 'middle' : 'start'}" font-size="${compact ? 5.5 : 6.5}" font-weight="bold" fill="${item.color}">${escapeXml(format.format(value))}</text>`;
    }).join('');
    return `<rect x="${cardX}" y="${cardTop}" width="${cardWidth}" height="${cardHeight}" rx="9" fill="#fff" stroke="#ced9e7"/><path d="M ${cardX} ${cardTop + 9} Q ${cardX} ${cardTop} ${cardX + 9} ${cardTop} H ${cardX + cardWidth - 9} Q ${cardX + cardWidth} ${cardTop} ${cardX + cardWidth} ${cardTop + 9} V ${cardTop + 34} H ${cardX} Z" fill="#082b66"/><text x="${cx}" y="${cardTop + 22}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="#fff">${escapeXml(row.year)}</text>${metrics}<line x1="${cx}" y1="${cardTop + cardHeight}" x2="${cx}" y2="${timelineY - 6}" stroke="#9fb2ca"/><circle cx="${cx}" cy="${timelineY}" r="4.5" fill="#fff" stroke="#123b7a" stroke-width="2"/><circle cx="${cx}" cy="${timelineY}" r="1.5" fill="#2f6fed"/>`;
  }).join('');
  const lastX = centerX(years.length - 1);
  const legend = series.map((item, index) => `<circle cx="${205 + index * 145}" cy="282" r="3" fill="${item.color}"/><text x="${213 + index * 145}" y="285" font-size="6.2" font-weight="bold" fill="#52657c">${escapeXml(index === 2 ? 'Matriculados a primer curso' : item.label)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">HISTORIA POR PERÍODO EN TARJETAS</text><text x="18" y="38" font-size="7.5" fill="#64748b">Secuencia cronológica del recorrido de ingreso por período académico.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><line x1="${centerX(0)}" y1="${timelineY}" x2="${lastX + 14}" y2="${timelineY}" stroke="#9fb2ca" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M ${lastX + 14} ${timelineY - 4} L ${lastX + 22} ${timelineY} L ${lastX + 14} ${timelineY + 4} Z" fill="#123b7a"/>${cards}${legend}</svg>`;
};

const conversionIndicatorsChartSvg = ({ data, series, width = 690, height = 340, scope = '' }) => {
  const years = data
    .map((row) => ({
      year: periodLabel(row.periodo),
      inscritos: number(row[series[0].key]),
      admitidos: number(row[series[1].key]),
      primerCurso: number(row[series[2].key])
    }))
    .filter((row) => row.inscritos > 0 || row.admitidos > 0 || row.primerCurso > 0)
    .map((row) => ({ ...row, selectividad: row.inscritos > 0 ? row.admitidos / row.inscritos * 100 : 0, absorcion: row.admitidos > 0 ? row.primerCurso / row.admitidos * 100 : 0, conversion: row.inscritos > 0 ? row.primerCurso / row.inscritos * 100 : 0 }));
  if (!years.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const left = 150;
  const right = width - 14;
  const slot = (right - left) / years.length;
  const gaugeRadius = Math.max(13, Math.min(19, slot * .25));
  const circumference = 2 * Math.PI * gaugeRadius;
  const rows = [
    { field: 'selectividad', title: 'SELECTIVIDAD', formula: 'Admitidos ÷ Inscritos', color: '#245fc7', y: 115 },
    { field: 'absorcion', title: 'ABSORCIÓN', formula: 'Primer curso ÷ Admitidos', color: '#239447', y: 188 }
  ];
  const headers = years.map((row, index) => `<text x="${left + index * slot + slot / 2}" y="68" text-anchor="middle" font-size="${years.length > 14 ? 5 : 7}" font-weight="bold" fill="#263b56">${escapeXml(row.year)}</text>`).join('');
  const gauges = rows.map((definition) => {
    const circles = years.map((row, index) => {
      const value = number(row[definition.field]);
      const progress = Math.max(0, Math.min(100, value));
      const cx = left + index * slot + slot / 2;
      return `<circle cx="${cx}" cy="${definition.y}" r="${gaugeRadius}" fill="#f1f5f9" stroke="#e1e8f1"/><circle cx="${cx}" cy="${definition.y}" r="${gaugeRadius}" fill="none" stroke="${definition.color}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${progress / 100 * circumference} ${circumference}" transform="rotate(-90 ${cx} ${definition.y})"/><text x="${cx}" y="${definition.y + 2.5}" text-anchor="middle" font-size="${slot < 50 ? 5 : 6.3}" font-weight="bold" fill="${definition.color}">${value.toFixed(1).replace('.', ',')}%</text>`;
    }).join('');
    return `<rect x="10" y="${definition.y - 30}" width="${width - 20}" height="60" rx="9" fill="#fff" stroke="#e1e9f3"/><rect x="17" y="${definition.y - 23}" width="123" height="46" rx="8" fill="${definition.color}" fill-opacity=".08" stroke="${definition.color}" stroke-opacity=".22"/><circle cx="32" cy="${definition.y}" r="9" fill="${definition.color}"/><text x="32" y="${definition.y + 3}" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">%</text><text x="48" y="${definition.y - 2}" font-size="7" font-weight="bold" fill="${definition.color}">${definition.title}</text><text x="48" y="${definition.y + 10}" font-size="5.6" fill="#64748b">${definition.formula}</text>${circles}`;
  }).join('');
  const latest = years[years.length - 1];
  const comments = [
    { title: `SELECTIVIDAD ${latest.year}`, value: latest.selectividad, text: `De cada 100 inscritos, ${Math.round(latest.selectividad)} fueron admitidos.`, color: '#245fc7' },
    { title: `ABSORCIÓN ${latest.year}`, value: latest.absorcion, text: `De cada 100 admitidos, ${Math.round(latest.absorcion)} ingresaron a primer curso.`, color: '#239447' },
    { title: `CONVERSIÓN TOTAL ${latest.year}`, value: latest.conversion, text: `De cada 100 inscritos, ${Math.round(latest.conversion)} llegaron a primer curso.`, color: '#0f766e' }
  ].map((item, index) => {
    const x = 10 + index * 227;
    return `<rect x="${x}" y="233" width="217" height="86" rx="9" fill="${item.color}" fill-opacity=".055" stroke="${item.color}" stroke-opacity=".28"/><rect x="${x}" y="233" width="4" height="86" rx="2" fill="${item.color}"/><text x="${x + 13}" y="251" font-size="6.5" font-weight="bold" fill="${item.color}">${escapeXml(item.title)}</text><rect x="${x + 158}" y="240" width="48" height="18" rx="9" fill="#fff" stroke="${item.color}" stroke-opacity=".25"/><text x="${x + 182}" y="252" text-anchor="middle" font-size="7" font-weight="bold" fill="${item.color}">${item.value.toFixed(1).replace('.', ',')}%</text><text x="${x + 13}" y="275" font-size="6.2" fill="#52657c">${escapeXml(item.text)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">INDICADORES DE CONVERSIÓN POR PERÍODO</text><text x="18" y="38" font-size="7.5" fill="#64748b">Inscritos representa la base del 100% para analizar el avance del proceso.</text><rect x="${width - 169}" y="14" width="76" height="20" rx="10" fill="#eaf1fb"/><text x="${width - 131}" y="27" text-anchor="middle" font-size="6.8" font-weight="bold" fill="#123b7a">INSCRITOS = 100%</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text><rect x="10" y="51" width="${width - 20}" height="25" rx="7" fill="#f3f7fc"/><text x="22" y="68" font-size="6.8" font-weight="bold" fill="#52657c">INDICADOR</text>${headers}${gauges}${comments}</svg>`;
};

const stackedAreaChartSvg = ({ data, series, width = 690, height = 330, scope = '' }) => {
  const layers = [
    { ...series[2], label: 'Primer curso', color: '#69a83a' },
    { ...series[1], label: 'Admitidos', color: '#1695a6' },
    { ...series[0], label: 'Inscritos', color: '#2f6fed' }
  ];
  const visibleData = data.filter((row) => layers.some((item) => number(row[item.key]) > 0));
  if (!visibleData.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const margin = { left: 42, right: 13, top: 70, bottom: 48 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxStack = Math.max(1, ...visibleData.map((row) => layers.reduce((total, item) => total + number(row[item.key]), 0)));
  const maxValue = maxStack * 1.08;
  const x = (index) => margin.left + index * chartW / Math.max(1, visibleData.length - 1);
  const y = (value) => margin.top + chartH - value / maxValue * chartH;
  const cumulative = visibleData.map(() => 0);
  const computedLayers = layers.map((item) => {
    const bottoms = [...cumulative];
    const tops = visibleData.map((row, index) => {
      cumulative[index] += number(row[item.key]);
      return cumulative[index];
    });
    return { ...item, bottoms, tops };
  });
  const grid = Array.from({ length: 6 }, (_, index) => {
    const gridValue = maxValue * (1 - index / 5);
    const gridY = margin.top + index * chartH / 5;
    return `<line x1="${margin.left}" y1="${gridY}" x2="${width - margin.right}" y2="${gridY}" stroke="#dfe7f1" stroke-dasharray="3 4"/><text x="${margin.left - 7}" y="${gridY + 3}" text-anchor="end" font-size="6.5" font-weight="bold" fill="#52657c">${escapeXml(format.format(Math.round(gridValue)))}</text>`;
  }).join('');
  const polygons = computedLayers.map((item) => {
    const topPoints = item.tops.map((value, index) => `${x(index)},${y(value)}`).join(' ');
    const bottomPoints = item.bottoms.map((value, index) => `${x(index)},${y(value)}`).reverse().join(' ');
    return `<polygon points="${topPoints} ${bottomPoints}" fill="${item.color}" fill-opacity=".9" stroke="${item.color}" stroke-width="1" stroke-linejoin="miter"/>`;
  }).join('');
  const values = computedLayers.map((item) => visibleData.map((row, index) => {
    const value = number(row[item.key]);
    if (!value) return '';
    const centerY = (y(item.tops[index]) + y(item.bottoms[index])) / 2;
    return `<text x="${x(index)}" y="${centerY + 2.2}" text-anchor="middle" font-size="${visibleData.length > 16 ? 4.5 : 5.7}" font-weight="bold" fill="#fff" stroke="${item.color}" stroke-width="1.4" paint-order="stroke">${escapeXml(format.format(value))}</text>`;
  }).join('')).join('');
  const periods = visibleData.map((row, index) => {
    const [year, semester] = text(row.periodo).split('-');
    return `<line x1="${x(index)}" y1="${margin.top + chartH}" x2="${x(index)}" y2="${margin.top + chartH + 5}" stroke="#8ea2bc"/><text x="${x(index)}" y="${height - 28}" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#315275">${escapeXml(semester === '1' ? 'I' : semester === '2' ? 'II' : semester)}</text><text x="${x(index)}" y="${height - 15}" text-anchor="middle" font-size="6.2" font-weight="bold" fill="#0f2f5e">${escapeXml(year)}</text>`;
  }).join('');
  const legend = [...layers].reverse().map((item, index) => `<rect x="${205 + index * 110}" y="50" width="9" height="9" rx="2" fill="${item.color}"/><text x="${219 + index * 110}" y="58" font-size="6.8" font-weight="bold" fill="#334155">${escapeXml(item.label)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">ÁREA APILADA POR PERIODO</text><text x="18" y="38" font-size="7.5" fill="#64748b">Composición semestral del flujo de ingreso en una sola superficie comparativa.</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="#2f6fed"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text>${legend}${grid}${polygons}${values}<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${width - margin.right}" y2="${margin.top + chartH}" stroke="#8ea2bc"/>${periods}</svg>`;
};

const barChartSvg = ({ data, width = 690, height = 225, title = '', color = BLUE }) => {
  const rows = data.slice(0, 16);
  const margin = { left: 145, right: 38, top: 30, bottom: 16 };
  const chartW = width - margin.left - margin.right;
  const rowH = (height - margin.top - margin.bottom) / Math.max(1, rows.length);
  const maxValue = Math.max(1, ...rows.map((row) => number(row.value)));
  const bars = rows.map((row, index) => {
    const y = margin.top + index * rowH + 2;
    const barW = (number(row.value) / maxValue) * chartW;
    const shortLabel = text(row.label).length > 28 ? `${text(row.label).slice(0, 27)}…` : text(row.label);
    return `<text x="${margin.left - 7}" y="${y + rowH * 0.6}" text-anchor="end" font-size="7.5" fill="#334155">${escapeXml(shortLabel)}</text><rect x="${margin.left}" y="${y}" width="${barW}" height="${Math.max(5, rowH - 5)}" rx="2" fill="${color}"/><text x="${margin.left + barW + 5}" y="${y + rowH * 0.6}" font-size="7.5" fill="#334155">${format.format(row.value)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="white"/><text x="${width / 2}" y="14" text-anchor="middle" font-size="10" font-weight="bold" fill="${BLUE}">${escapeXml(title)}</text>${bars}</svg>`;
};

const loadGeoData = () => {
  if (geoCache) return geoCache;
  if (!fs.existsSync(geoDepartmentPath) || !fs.existsSync(geoMunicipalityPath)) return null;
  const geojson = JSON.parse(fs.readFileSync(geoDepartmentPath, 'utf8'));
  const municipalities = JSON.parse(fs.readFileSync(geoMunicipalityPath, 'utf8'));
  let minLon = Infinity; let maxLon = -Infinity; let minLat = Infinity; let maxLat = -Infinity;
  const features = (geojson.features || []).map((feature) => {
    const geometry = feature.geometry || {};
    const rings = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : (geometry.coordinates || []).map((polygon) => polygon[0]);
    rings.forEach((ring) => ring.forEach(([lon, lat]) => {
      minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
      minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
    }));
    const label = text(feature.properties?.shapeName || feature.properties?.NOMBRE_DPT);
    return { key: normalizeGeo(label), label, rings };
  });
  const municipalityIndex = new Map();
  const add = (key, item) => {
    if (!key) return;
    if (!municipalityIndex.has(key)) municipalityIndex.set(key, []);
    if (!municipalityIndex.get(key).some((candidate) => candidate.code === item.code)) municipalityIndex.get(key).push(item);
  };
  municipalities.forEach((item) => {
    const key = normalizeGeo(item.name_normalized || item.name);
    add(key, item);
    if (key.startsWith('SANTIAGO DE ')) add(key.replace(/^SANTIAGO DE /, ''), item);
    if (key.startsWith('EL ')) add(key.replace(/^EL /, ''), item);
    if (key === 'SAN JOSE DE CUCUTA') add('CUCUTA', item);
    if (key === 'CARTAGENA DE INDIAS') add('CARTAGENA', item);
  });
  geoCache = { features, bbox: { minLon, maxLon, minLat, maxLat }, municipalityIndex };
  return geoCache;
};

const projectGeo = ({ lon, lat, bbox, width, height, padding = 12 }) => {
  const usableW = width - padding * 2; const usableH = height - padding * 2;
  const lonRange = bbox.maxLon - bbox.minLon || 1; const latRange = bbox.maxLat - bbox.minLat || 1;
  const scale = Math.min(usableW / lonRange, usableH / latRange);
  return {
    x: padding + (usableW - lonRange * scale) / 2 + (lon - bbox.minLon) * scale,
    y: padding + (usableH - latRange * scale) / 2 + (bbox.maxLat - lat) * scale
  };
};

const geoPath = (rings, bbox, width, height) => rings.map((ring) => `M ${ring.map(([lon, lat]) => { const point = projectGeo({ lon, lat, bbox, width, height }); return `${point.x.toFixed(1)},${point.y.toFixed(1)}`; }).join(' L ')} Z`).join(' ');

const aggregateGeography = (rows, geo) => {
  const hints = new Map(rows.filter((row) => normalizeGeo(row.municipio) && normalizeGeo(row.departamento)).map((row) => [normalizeGeo(row.municipio), normalizeGeo(row.departamento)]));
  const municipalities = new Map(); const departments = new Map();
  rows.forEach((row) => {
    const source = text(row.municipio); const sourceKey = normalizeGeo(source);
    if (!sourceKey) return;
    let candidates = geo.municipalityIndex.get(sourceKey) || [];
    if (!candidates.length) {
      const words = sourceKey.split(' ');
      for (let length = words.length - 1; length > 0 && !candidates.length; length -= 1) candidates = geo.municipalityIndex.get(words.slice(0, length).join(' ')) || [];
    }
    const departmentHint = normalizeGeo(row.departamento) || hints.get(sourceKey);
    const resolved = candidates.length <= 1 ? candidates[0] : candidates.find((candidate) => normalizeGeo(candidate.department_name_normalized || candidate.department_name) === departmentHint);
    const municipalityKey = resolved?.code || sourceKey;
    if (!municipalities.has(municipalityKey)) municipalities.set(municipalityKey, { key: municipalityKey, label: text(resolved?.name || source), value: 0, latitude: Number(resolved?.latitude), longitude: Number(resolved?.longitude) });
    municipalities.get(municipalityKey).value += 1;
    const departmentLabel = text(resolved?.department_name || row.departamento);
    const departmentKey = normalizeGeo(departmentLabel);
    if (departmentKey) {
      if (!departments.has(departmentKey)) departments.set(departmentKey, { key: departmentKey, label: departmentLabel, value: 0 });
      departments.get(departmentKey).value += 1;
    }
  });
  const sort = (values) => Array.from(values.values()).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label, 'es'));
  return { municipalities: sort(municipalities), departments: sort(departments) };
};

const geoMapSvg = ({ geo, rows, type, color, title, width = 478, height = 390 }) => {
  const map = new Map(rows.map((row) => [row.key, row]));
  const max = Math.max(1, ...rows.map((row) => row.value));
  const paths = geo.features.map((feature) => {
    const datum = map.get(feature.key);
    const ratio = number(datum?.value) / max;
    const medium = color === RED ? '#ec86a4' : '#79aaf5';
    const light = color === RED ? '#f8bfd0' : '#c6dbfb';
    const fill = type === 'department' && datum ? (ratio > .66 ? color : ratio > .33 ? medium : light) : '#e5edf7';
    return `<path d="${geoPath(feature.rings, geo.bbox, width, height)}" fill="${fill}" stroke="${datum ? color : '#b9c8d9'}" stroke-width="${datum ? 0.8 : 0.35}"/>`;
  }).join('');
  const bubbles = type === 'municipality' ? rows.filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude)).map((row) => {
    const point = projectGeo({ lon: row.longitude, lat: row.latitude, bbox: geo.bbox, width, height });
    const radius = 2.5 + Math.sqrt(row.value / max) * 7;
    return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${color}" fill-opacity=".82" stroke="#fff" stroke-width="1"/>`;
  }).join('') : '';
  const occupied = [];
  const labelRows = type === 'municipality'
    ? rows.filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude)).slice(0, 14)
    : [];
  const municipalityLabels = labelRows.map((row, index) => {
    const point = projectGeo({ lon: row.longitude, lat: row.latitude, bbox: geo.bbox, width, height });
    const label = text(row.label).length > 19 ? `${text(row.label).slice(0, 18)}…` : text(row.label);
    const boxWidth = Math.max(48, Math.min(112, label.length * 4.3 + 28));
    const candidates = [[10, -18], [10, 8], [-boxWidth - 10, -18], [-boxWidth - 10, 8], [10, -34], [-boxWidth - 10, -34]];
    let selected = candidates[index % candidates.length];
    for (const candidate of candidates) {
      const x = Math.max(4, Math.min(width - boxWidth - 4, point.x + candidate[0]));
      const y = Math.max(24, Math.min(height - 19, point.y + candidate[1]));
      const overlaps = occupied.some((box) => x < box.x + box.w + 3 && x + boxWidth + 3 > box.x && y < box.y + 21 && y + 21 > box.y);
      if (!overlaps) { selected = [x - point.x, y - point.y]; break; }
    }
    const x = Math.max(4, Math.min(width - boxWidth - 4, point.x + selected[0]));
    const y = Math.max(24, Math.min(height - 19, point.y + selected[1]));
    occupied.push({ x, y, w: boxWidth });
    const anchorX = x > point.x ? x : x + boxWidth;
    return `<line x1="${point.x.toFixed(1)}" y1="${point.y.toFixed(1)}" x2="${anchorX.toFixed(1)}" y2="${(y + 9).toFixed(1)}" stroke="${color}" stroke-width=".7" stroke-dasharray="2 2"/><rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxWidth.toFixed(1)}" height="18" rx="5" fill="#fff" stroke="${color}" stroke-width=".7"/><rect x="${(x + boxWidth - 23).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="22" height="16" rx="4" fill="${color}"/><text x="${(x + 6).toFixed(1)}" y="${(y + 12).toFixed(1)}" font-size="5.7" font-weight="bold" fill="#183552">${escapeXml(label)}</text><text x="${(x + boxWidth - 12).toFixed(1)}" y="${(y + 12).toFixed(1)}" text-anchor="middle" font-size="6" font-weight="bold" fill="#fff">${format.format(row.value)}</text>`;
  }).join('');
  const departmentLabels = type === 'department' ? geo.features.map((feature) => {
    const datum = map.get(feature.key);
    if (!datum) return '';
    const allPoints = feature.rings.flat();
    const lons = allPoints.map((point) => point[0]);
    const lats = allPoints.map((point) => point[1]);
    const point = projectGeo({ lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2, bbox: geo.bbox, width, height });
    const label = text(datum.label).length > 16 ? `${text(datum.label).slice(0, 15)}…` : text(datum.label);
    const boxWidth = Math.max(50, Math.min(105, label.length * 4.2 + 27));
    const x = Math.max(3, Math.min(width - boxWidth - 3, point.x - boxWidth / 2));
    const y = Math.max(23, Math.min(height - 18, point.y - 8));
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxWidth.toFixed(1)}" height="17" rx="5" fill="#fff" fill-opacity=".94" stroke="${color}" stroke-width=".65"/><rect x="${(x + boxWidth - 22).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="21" height="15" rx="4" fill="${color}"/><text x="${(x + 5).toFixed(1)}" y="${(y + 11.5).toFixed(1)}" font-size="5.4" font-weight="bold" fill="#183552">${escapeXml(label)}</text><text x="${(x + boxWidth - 11.5).toFixed(1)}" y="${(y + 11.5).toFixed(1)}" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#fff">${format.format(datum.value)}</text>`;
  }).join('') : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" rx="12" fill="#f4f8fd"/><text x="16" y="18" font-size="9" font-weight="bold" fill="${BLUE}">${escapeXml(title)}</text><text x="16" y="31" font-size="6" fill="#64748b">Las etiquetas muestran el territorio y la cantidad de programas.</text><g transform="translate(0 12)">${paths}${bubbles}${municipalityLabels}${departmentLabels}</g></svg>`;
};

const geographyPages = ({ rows, regionalRows, program }) => {
  const geo = loadGeoData();
  if (!geo) return [];
  const national = aggregateGeography(rows, geo); const regional = aggregateGeography(regionalRows, geo);
  const page = (heading, mapRows, type, color, tableTitle) => [
    { text: '', pageBreak: 'before' },
    ...sectionHeader(heading, program),
    {
      columns: [
        { svg: geoMapSvg({ geo, rows: mapRows, type, color, title: heading, width: 478, height: 405 }), width: 478 },
        { stack: [compactTable(tableTitle, mapRows, 18)], width: 202 }
      ],
      columnGap: 10
    }
  ];
  return [
    ...page('MAPA DE MUNICIPIOS · NACIONAL', national.municipalities, 'municipality', '#173f96', 'MUNICIPIOS DESTACADOS'),
    ...page('MAPA DE MUNICIPIOS · REGIONAL', regional.municipalities, 'municipality', RED, 'MUNICIPIOS REGIONALES'),
    ...page('MAPA DE DEPARTAMENTOS · NACIONAL', national.departments, 'department', '#173f96', 'DEPARTAMENTOS DESTACADOS'),
    ...page('MAPA DE DEPARTAMENTOS · REGIONAL', regional.departments, 'department', RED, 'DEPARTAMENTOS REGIONALES')
  ];
};

const aggregatePeriods = (rows, fields) => {
  const map = new Map();
  rows.forEach((row) => {
    const period = text(row.periodo_referencia);
    if (!period) return;
    if (!map.has(period)) map.set(period, { periodo: period });
    const target = map.get(period);
    fields.forEach((field) => { target[field] = number(target[field]) + number(row[field]); });
  });
  return Array.from(map.values()).sort((a, b) => text(a.periodo).localeCompare(text(b.periodo)));
};

const offerSummaryVisualSvg = ({ rows, view = 'sequence', width = 690, height = 360 }) => {
  const credits = rows.map((row) => number(row.numero_creditos)).filter((value) => value > 0);
  const semesterRows = labelCountRows(rows, 'numero_semestres').map((row) => ({ ...row, label: `${row.label} semestres` }));
  const groups = [
    { title: 'RECONOCIMIENTO MEN', color: '#173f96', items: labelCountRows(rows, 'reconocimiento_men') },
    { title: 'SECTOR', color: '#3a9626', items: labelCountRows(rows, 'sector') },
    { title: 'MODALIDADES', color: '#92278f', items: labelCountRows(rows, 'modalidad') },
    { title: 'NÚMERO DE SEMESTRES', color: '#0891a5', items: semesterRows },
    { title: 'RANGO DE CRÉDITOS', color: '#ea6a0a', items: credits.length ? [
      { label: 'Mínimo', value: Math.min(...credits) },
      { label: 'Máximo', value: Math.max(...credits) },
      { label: 'Promedio', value: Math.round(credits.reduce((a, b) => a + b, 0) / credits.length) }
    ] : [] }
  ];
  const card = (group, x, y, w, h, compact = false) => {
    const items = group.items.slice(0, compact ? 3 : 5);
    const startY = y + (compact ? 35 : 43);
    const step = Math.max(15, Math.min(compact ? 19 : 27, (h - (compact ? 42 : 53)) / Math.max(1, items.length)));
    const body = items.length ? items.map((item, index) => {
      const iy = startY + index * step;
      const label = text(item.label).length > 25 ? `${text(item.label).slice(0, 24)}…` : text(item.label);
      return `<circle cx="${x + 13}" cy="${iy - 2}" r="2.5" fill="${group.color}"/><text x="${x + 21}" y="${iy}" font-size="${compact ? 5.4 : 6.5}" font-weight="bold" fill="#465b75">${escapeXml(label)}</text><rect x="${x + w - 43}" y="${iy - 10}" width="33" height="15" rx="4" fill="#fff" stroke="${group.color}" stroke-opacity=".35"/><text x="${x + w - 26.5}" y="${iy}" text-anchor="middle" font-size="${compact ? 5.8 : 7}" font-weight="bold" fill="${group.color}">${escapeXml(format.format(item.value))}</text>`;
    }).join('') : `<text x="${x + w / 2}" y="${y + h / 2 + 10}" text-anchor="middle" font-size="7" fill="#94a3b8">Sin información</text>`;
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="11" fill="#fff" stroke="${group.color}" stroke-opacity=".32"/><rect x="${x}" y="${y}" width="${w}" height="27" rx="11" fill="${group.color}"/><rect x="${x}" y="${y + 18}" width="${w}" height="9" fill="${group.color}"/><text x="${x + w / 2}" y="${y + 18}" text-anchor="middle" font-size="${compact ? 6 : 7.2}" font-weight="bold" fill="#fff">${escapeXml(group.title)}</text>${body}`;
  };
  let body = '';
  if (view === 'radial') {
    body = `<circle cx="143" cy="196" r="93" fill="#fff" stroke="#afbdd0" stroke-width="2" stroke-dasharray="5 4"/><circle cx="143" cy="196" r="73" fill="#f3f7fc" stroke="#d5e0ee"/><text x="143" y="181" text-anchor="middle" font-size="12" font-weight="bold" fill="#082b66">OFERTA DE</text><text x="143" y="198" text-anchor="middle" font-size="12" font-weight="bold" fill="#082b66">PROGRAMAS</text><text x="143" y="228" text-anchor="middle" font-size="24" font-weight="bold" fill="#173f96">${format.format(rows.length)}</text>${groups.map((group, index) => `${card(group, 280, 54 + index * 57, 390, 50, true)}<line x1="218" y1="${125 + index * 26}" x2="280" y2="${79 + index * 57}" stroke="${group.color}" stroke-width="1.5"/>`).join('')}`;
  } else if (view === 'orbit') {
    const positions = [[18, 60, 192, 102], [480, 60, 192, 102], [480, 220, 192, 102], [18, 220, 192, 102], [249, 250, 192, 82]];
    body = `<circle cx="345" cy="171" r="73" fill="#fff" stroke="#b6c6da" stroke-width="2"/><circle cx="345" cy="171" r="57" fill="#eef4fb"/><text x="345" y="159" text-anchor="middle" font-size="11" font-weight="bold" fill="#082b66">TOTAL PROGRAMAS</text><text x="345" y="190" text-anchor="middle" font-size="25" font-weight="bold" fill="#173f96">${format.format(rows.length)}</text>${groups.map((group, index) => card(group, ...positions[index], true)).join('')}`;
  } else if (view === 'panel') {
    const positions = [[12, 58, 327, 112], [351, 58, 327, 112], [12, 182, 214, 158], [238, 182, 214, 158], [464, 182, 214, 158]];
    body = groups.map((group, index) => card(group, ...positions[index])).join('');
  } else if (view === 'executive') {
    const positions = [[12, 104, 327, 105], [351, 104, 327, 105], [12, 221, 214, 124], [238, 221, 214, 124], [464, 221, 214, 124]];
    body = `<path d="M18 57H625L675 81L625 105H18Z" fill="#082b66"/><text x="42" y="85" font-size="10" font-weight="bold" fill="#fff">TOTAL DE PROGRAMAS ANALIZADOS</text><rect x="285" y="66" width="72" height="30" rx="5" fill="#fff"/><text x="321" y="87" text-anchor="middle" font-size="17" font-weight="bold" fill="#082b66">${format.format(rows.length)}</text>${groups.map((group, index) => card(group, ...positions[index], true)).join('')}`;
  } else {
    body = groups.map((group, index) => card(group, 8 + index * 136, 75, 128, 265)).join('');
  }
  const viewLabels = { sequence: 'VISTA SECUENCIAL', panel: 'VISTA PANEL', orbit: 'VISTA ÓRBITA', radial: 'VISTA RADIAL', executive: 'VISTA EJECUTIVA' };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="summary-shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#123b7a" flood-opacity=".12"/></filter></defs><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="15" fill="#f8fbff" stroke="#cbd9ea"/><text x="18" y="25" font-size="12" font-weight="bold" fill="#082b66">ANÁLISIS DE CONTEXTO EXTERNO · OFERTA ACADÉMICA</text><text x="18" y="41" font-size="7.5" fill="#64748b">Indicadores calculados con la tabla OFERTA y los filtros del programa seleccionado.</text><rect x="${width - 107}" y="14" width="89" height="21" rx="10.5" fill="#173f96"/><text x="${width - 62.5}" y="28" text-anchor="middle" font-size="6.8" font-weight="bold" fill="#fff">${viewLabels[view] || viewLabels.sequence}</text><g filter="url(#summary-shadow)">${body}</g></svg>`;
};

const offerPage = ({ rows, regionalRows, program, view }) => {
  const analyzedPrograms = labelCountRows(rows, 'nombre_programa');
  const regionalPrograms = labelCountRows(regionalRows, 'nombre_programa');
  return [
    ...sectionHeader('OFERTA NACIONAL Y REGIONAL DE PROGRAMAS ACADÉMICOS SIMILARES', program),
    { columns: [compactTable('OFERTA NACIONAL · PROGRAMAS ANALIZADOS', analyzedPrograms, 10), compactTable('OFERTA REGIONAL · PROGRAMAS ANALIZADOS', regionalPrograms, 10)], columnGap: 10, margin: [0, 0, 0, 10] },
    { text: '', pageBreak: 'before' },
    ...sectionHeader('RESUMEN VISUAL DE LA OFERTA ACADÉMICA', program),
    { svg: offerSummaryVisualSvg({ rows, view }), width: 690 }
  ];
};

const singleMetricCardsChartSvg = ({ data, series, width = 690, height = 300, scope = '', annual = false }) => {
  const item = series[0];
  let rows;
  if (annual) {
    rows = data.map((row) => ({ periodo: text(row.periodo), value: number(row[item.key]) }))
      .filter((row) => row.value > 0)
      .sort((a, b) => text(a.periodo).localeCompare(text(b.periodo)));
  } else {
    rows = data
      .map((row) => ({ periodo: text(row.periodo), value: number(row[item.key]) }))
      .filter((row) => row.value > 0);
  }
  if (!rows.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const columns = rows.length > 14 ? 7 : rows.length > 8 ? 6 : Math.min(rows.length, 5);
  const gap = 8;
  const marginX = 12;
  const top = 60;
  const rowCount = Math.ceil(rows.length / columns);
  const cardWidth = (width - marginX * 2 - gap * (columns - 1)) / columns;
  const cardHeight = Math.min(92, (height - top - 14 - gap * (rowCount - 1)) / rowCount);
  const maxValue = Math.max(1, ...rows.map((row) => row.value));
  const cards = rows.map((row, index) => {
    const x = marginX + (index % columns) * (cardWidth + gap);
    const y = top + Math.floor(index / columns) * (cardHeight + gap);
    const previous = rows[index - 1]?.value || 0;
    const change = previous > 0 ? ((row.value - previous) / previous) * 100 : null;
    const changeColor = change === null || change >= 0 ? '#15803d' : '#dc2626';
    const periodParts = text(row.periodo).split('-');
    const period = `${periodParts[0]}-${periodParts[1] === '1' ? 'I' : periodParts[1] === '2' ? 'II' : periodParts[1] || ''}`;
    const progress = Math.max(3, row.value / maxValue * (cardWidth - 20));
    return `<rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="9" fill="#fff" stroke="${item.color}" stroke-opacity=".28"/><rect x="${x}" y="${y}" width="${cardWidth}" height="25" rx="9" fill="${item.color}"/><rect x="${x}" y="${y + 17}" width="${cardWidth}" height="8" fill="${item.color}"/><text x="${x + cardWidth / 2}" y="${y + 17}" text-anchor="middle" font-size="7.3" font-weight="bold" fill="#fff">${escapeXml(period)}</text><text x="${x + 10}" y="${y + 45}" font-size="5.8" font-weight="bold" fill="#64748b">${escapeXml(item.label.toUpperCase())}</text><text x="${x + 10}" y="${y + 62}" font-size="10" font-weight="bold" fill="${item.color}">${escapeXml(format.format(row.value))}</text>${change === null ? '' : `<text x="${x + cardWidth - 9}" y="${y + 61}" text-anchor="end" font-size="5.8" font-weight="bold" fill="${changeColor}">${change >= 0 ? '+' : ''}${change.toFixed(1).replace('.', ',')}%</text>`}<rect x="${x + 10}" y="${y + cardHeight - 12}" width="${cardWidth - 20}" height="5" rx="2.5" fill="#e8eef6"/><rect x="${x + 10}" y="${y + cardHeight - 12}" width="${progress}" height="5" rx="2.5" fill="${item.color}"/>`;
  }).join('');
  const title = annual ? 'HISTORIA POR PERÍODO EN TARJETAS' : 'TARJETAS POR PERIODO ACADÉMICO';
  const subtitle = annual ? `Evolución de ${item.label.toLowerCase()} por período académico.` : `Lectura individual de ${item.label.toLowerCase()} y variación frente al periodo anterior.`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">${title}</text><text x="18" y="38" font-size="7.5" fill="#64748b">${escapeXml(subtitle)}</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="${item.color}"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text>${cards}</svg>`;
};

const singleMetricSpecialChartSvg = ({ data, series, type, width = 690, height = 285, scope = '' }) => {
  const item = series[0];
  const periodRows = data.map((row) => ({ periodo: text(row.periodo), value: number(row[item.key]) })).filter((row) => row.value > 0);
  if (!periodRows.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const annualRows = periodRows.map((row) => ({ ...row, periodo: periodLabel(row.periodo) }));
  const titles = {
    funnel: [`${item.label.toUpperCase()} · EMBUDO COMPARATIVO`, 'Comparación proporcional entre los períodos visibles.'],
    indicators: [`${item.label.toUpperCase()} · TABLERO DE INDICADORES`, 'Resumen ejecutivo calculado con el alcance seleccionado.'],
    journey: [`${item.label.toUpperCase()} · CAMINO HISTÓRICO`, 'Trayectoria por período y cambios de dirección del indicador.'],
    conversion: [`${item.label.toUpperCase()} · ÍNDICES DE EVOLUCIÓN`, 'El primer período visible representa la base 100.'],
    stackedArea: [`${item.label.toUpperCase()} · ÁREA ACUMULADA`, 'Magnitud de cada período representada como una superficie continua.']
  };
  const [title, subtitle] = titles[type];
  const frame = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text><text x="18" y="38" font-size="7.5" fill="#64748b">${escapeXml(subtitle)}</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="${item.color}"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text>${body}</svg>`;
  if (type === 'indicators') {
    const values = periodRows.map((row) => row.value); const latest = values[values.length - 1]; const previous = values[values.length - 2] || 0; const variation = previous > 0 ? (latest - previous) / previous * 100 : 0;
    const cards = [['ÚLTIMO PERÍODO', latest, item.color], ['TOTAL ACUMULADO', values.reduce((a, b) => a + b, 0), '#123b7a'], ['PROMEDIO', Math.round(values.reduce((a, b) => a + b, 0) / values.length), '#0f766e'], ['VALOR MÁXIMO', Math.max(...values), '#15803d'], ['VALOR MÍNIMO', Math.min(...values), '#b45309'], ['VARIACIÓN RECIENTE', `${variation >= 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}%`, variation >= 0 ? '#15803d' : '#dc2626']].map(([label, value, color], index) => { const x = 14 + (index % 3) * 222; const y = 62 + Math.floor(index / 3) * 94; return `<rect x="${x}" y="${y}" width="210" height="82" rx="10" fill="#fff" stroke="#d7e1ed"/><rect x="${x}" y="${y}" width="5" height="82" rx="2.5" fill="${color}"/><text x="${x + 16}" y="${y + 25}" font-size="6.5" font-weight="bold" fill="#64748b">${escapeXml(label)}</text><text x="${x + 16}" y="${y + 57}" font-size="15" font-weight="bold" fill="${color}">${escapeXml(typeof value === 'number' ? format.format(value) : value)}</text>`; }).join('');
    return frame(cards);
  }
  const rows = ['journey', 'conversion'].includes(type) ? annualRows : periodRows;
  const left = 48; const right = width - 22; const top = 72; const bottom = height - 45; const plotW = right - left; const max = Math.max(1, ...rows.map((row) => row.value)); const x = (index) => left + index * plotW / Math.max(1, rows.length - 1); const y = (value) => bottom - value / (max * 1.12) * (bottom - top);
  if (type === 'funnel') {
    const slot = plotW / rows.length;
    const shapes = rows.map((row, index) => { const cx = left + index * slot + slot / 2; const factor = row.value / max; const halfTop = Math.max(7, slot * .38 * factor); const halfBottom = Math.max(5, halfTop * .7); const [year, semester] = row.periodo.split('-'); return `<polygon points="${cx - halfTop},82 ${cx + halfTop},82 ${cx + halfBottom},${bottom - 8} ${cx - halfBottom},${bottom - 8}" fill="${item.color}" fill-opacity=".9" stroke="#fff"/><text x="${cx}" y="${(82 + bottom - 8) / 2}" text-anchor="middle" font-size="${rows.length > 16 ? 4.7 : 6}" font-weight="bold" fill="#fff">${escapeXml(format.format(row.value))}</text><text x="${cx}" y="${height - 27}" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#52657c">${escapeXml(semester === '1' ? 'I' : semester === '2' ? 'II' : '')}</text><text x="${cx}" y="${height - 14}" text-anchor="middle" font-size="6" font-weight="bold" fill="#0f2f5e">${escapeXml(year)}</text>`; }).join('');
    return frame(shapes);
  }
  if (type === 'conversion') {
    const base = rows[0].value || 1; const slot = plotW / rows.length; const radius = Math.max(12, Math.min(21, slot * .28)); const circumference = 2 * Math.PI * radius;
    const gauges = rows.map((row, index) => { const cx = left + index * slot + slot / 2; const value = row.value / base * 100; const progress = Math.min(100, value); return `<text x="${cx}" y="75" text-anchor="middle" font-size="7" font-weight="bold" fill="#315275">${escapeXml(row.periodo)}</text><circle cx="${cx}" cy="140" r="${radius}" fill="#f1f5f9" stroke="#e1e8f1"/><circle cx="${cx}" cy="140" r="${radius}" fill="none" stroke="${item.color}" stroke-width="6" stroke-linecap="round" stroke-dasharray="${progress / 100 * circumference} ${circumference}" transform="rotate(-90 ${cx} 140)"/><text x="${cx}" y="143" text-anchor="middle" font-size="6.3" font-weight="bold" fill="${item.color}">${Math.round(value)}</text><text x="${cx}" y="184" text-anchor="middle" font-size="6.3" font-weight="bold" fill="#52657c">${escapeXml(format.format(row.value))}</text>`; }).join('');
    return frame(`<rect x="14" y="54" width="${width - 28}" height="154" rx="10" fill="#fff" stroke="#e1e9f3"/>${gauges}<text x="${width / 2}" y="235" text-anchor="middle" font-size="7" font-weight="bold" fill="#64748b">ÍNDICE BASE: ${escapeXml(rows[0].periodo)} = 100</text>`);
  }
  const points = rows.map((row, index) => `${x(index)},${y(row.value)}`).join(' '); const labels = rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.value)}" r="${type === 'journey' ? 7 : 3.5}" fill="${item.color}" stroke="#fff" stroke-width="1.5"/><text x="${x(index)}" y="${y(row.value) - 10}" text-anchor="middle" font-size="6" font-weight="bold" fill="${item.color}" stroke="#fff" stroke-width="2" paint-order="stroke">${escapeXml(format.format(row.value))}</text><text x="${x(index)}" y="${height - 17}" text-anchor="middle" font-size="6" font-weight="bold" fill="#315275">${escapeXml(row.periodo.replace('-', '·'))}</text>`).join('');
  if (type === 'journey') return frame(`<polyline points="${points}" fill="none" stroke="${item.color}" stroke-opacity=".15" stroke-width="14" stroke-linejoin="miter"/><polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.4" stroke-linejoin="miter"/>${labels}`);
  return frame(`<polygon points="${left},${bottom} ${points} ${right},${bottom}" fill="${item.color}" fill-opacity=".76"/><polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.5" stroke-linejoin="miter"/>${labels}`);
};

const populationPage = ({ title, program, data, charts, selection = {}, pageBreak = false }) => {
  const selectedScope = text(selection.scope || 'nacional').toLowerCase();
  if (selectedScope === 'ambos') {
    return charts.flatMap((item, index) => populationPage({
      title: `${title} · ${text(item.scope).toUpperCase()}`,
      program,
      data,
      charts,
      selection: { ...selection, scope: text(item.scope).toLowerCase() },
      pageBreak: pageBreak || index > 0
    }));
  }
  const chart = charts.find((item) => text(item.scope).toLowerCase() === selectedScope) || charts[0];
  const requestedType = text(selection.chartType || 'stacked');
  const supportedType = chart.funnelSeries
    ? requestedType
    : ['stacked', 'trend', 'funnel', 'indicators', 'shaded', 'bubbles', 'periodCards', 'journey', 'timeline', 'conversion', 'stackedArea'].includes(requestedType) ? requestedType : 'stacked';
  const styledSeries = (colors, softColors = []) => chart.funnelSeries.map((item, index) => ({ ...item, color: colors[index], soft: softColors[index] }));
  let height = 350;
  let svg;

  if (supportedType === 'trend') {
    svg = trendLineChartSvg({ data, series: chart.trendSeries || chart.series, width: 690, height, subtitle: chart.trendSubtitle || chart.subtitle, scope: chart.scope });
  } else if (supportedType === 'funnel') {
    height = 310;
    svg = chart.funnelSeries
      ? funnelChartSvg({ data, series: chart.funnelSeries, width: 690, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'indicators') {
    height = 295;
    svg = chart.funnelSeries
      ? indicatorTrendBoardSvg({ data, series: styledSeries(['#123b7a', '#1f67bd', '#239447'], ['#eaf1fb', '#eaf4ff', '#ecf8ef']), width: 690, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'shaded') {
    height = chart.funnelSeries ? 285 : 180;
    svg = shadedTrendChartSvg({ data, series: chart.funnelSeries ? styledSeries(['#123b7a', '#2f6fed', '#239447']) : chart.series, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'bubbles') {
    height = chart.funnelSeries ? 260 : 180;
    svg = bubbleMatrixChartSvg({ data, series: chart.funnelSeries ? styledSeries(['#123b7a', '#2f6fed', '#27a861'], ['#edf3fb', '#eff5ff', '#edf9f1']) : chart.series, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'periodCards') {
    height = chart.funnelSeries ? 350 : 300;
    svg = chart.funnelSeries
      ? periodCardsChartSvg({ data, series: styledSeries(['#123b7a', '#1593a5', '#239447']), width: 690, height, scope: chart.scope })
      : singleMetricCardsChartSvg({ data, series: chart.series, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'journey') {
    height = 285;
    svg = chart.funnelSeries
      ? studentJourneyChartSvg({ data, series: styledSeries(['#123b7a', '#2f6fed', '#239447'], ['#edf3fb', '#eff5ff', '#edf9f1']), width: 690, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'timeline') {
    height = 300;
    svg = chart.funnelSeries
      ? annualTimelineChartSvg({ data, series: styledSeries(['#123b7a', '#2f6fed', '#239447']), width: 690, height, scope: chart.scope })
      : singleMetricCardsChartSvg({ data, series: chart.series, width: 690, height, scope: chart.scope, annual: true });
  } else if (supportedType === 'conversion') {
    height = 340;
    svg = chart.funnelSeries
      ? conversionIndicatorsChartSvg({ data, series: styledSeries(['#123b7a', '#2f6fed', '#239447']), width: 690, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: 690, height, scope: chart.scope });
  } else if (supportedType === 'stackedArea') {
    height = 330;
    svg = chart.funnelSeries
      ? stackedAreaChartSvg({ data, series: chart.funnelSeries, width: 690, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: 690, height, scope: chart.scope });
  } else {
    svg = stackedBarChartSvg({ data, series: chart.series, width: 690, height, title: chart.title, subtitle: chart.subtitle, scope: chart.scope });
  }

  return [
    ...(pageBreak ? [{ text: '', pageBreak: 'before' }] : []),
    ...sectionHeader(title, program),
    { svg, width: 690, margin: [0, 2, 0, 0] }
  ];
};

const generateContextoExternoGeneralPdf = async ({ program, oferta = [], poblacional = [], section = 'completo', populationGroup = 'ingreso', visualizations = {}, offerView = 'sequence' }) => {
  // El reporte de referencia denomina "Oferta nacional" al universo completo
  // y muestra la oferta regional como un subconjunto de ese mismo universo.
  const nationalOffer = oferta;
  const regionalOffer = oferta.filter((row) => text(row.georeferencia).toUpperCase() === 'REGIONAL');
  const intakeData = aggregatePeriods(poblacional, ['inscritos_nacional', 'admitidos_nacional', 'primer_curso_nacional', 'inscritos_regional', 'admitidos_regional', 'primer_curso_regional']);
  const enrolledData = aggregatePeriods(poblacional, ['matriculados_nacional', 'matriculados_regional']);
  const graduateData = aggregatePeriods(poblacional, ['graduados_nacional', 'graduados_regional']);

  const populationSections = {
    ingreso: populationPage({
      title: 'INSCRITOS, ADMITIDOS Y PRIMER CURSO', program, data: intakeData, selection: section === 'completo' ? { ...visualizations.ingreso, scope: 'ambos' } : visualizations.ingreso,
      charts: [
        { title: 'Flujo apilado por período', subtitle: 'Inscritos, admitidos y primer curso en una lectura consolidada.', trendSubtitle: 'Comportamiento histórico de inscritos, admitidos y estudiantes de primer curso.', scope: 'Nacional', series: [['inscritos_nacional', 'Inscritos', '#2f6fed'], ['admitidos_nacional', 'Admitidos', '#df2426'], ['primer_curso_nacional', 'Primer curso', '#687b94']].map(([key, label, color]) => ({ key, label, color })), trendSeries: [['inscritos_nacional', 'Inscritos', '#2f6fed'], ['admitidos_nacional', 'Admitidos', '#1494a8'], ['primer_curso_nacional', 'Primer curso', '#5b8f45']].map(([key, label, color]) => ({ key, label, color })), funnelSeries: [['inscritos_nacional', 'Inscritos', '#082b66'], ['admitidos_nacional', 'Admitidos', '#1f67bd'], ['primer_curso_nacional', 'Primer curso', '#27a861']].map(([key, label, color]) => ({ key, label, color })) },
        { title: 'Flujo apilado por período', subtitle: 'Inscritos, admitidos y primer curso en una lectura consolidada.', trendSubtitle: 'Comportamiento histórico de inscritos, admitidos y estudiantes de primer curso.', scope: 'Regional', series: [['inscritos_regional', 'Inscritos', '#2f6fed'], ['admitidos_regional', 'Admitidos', '#df2426'], ['primer_curso_regional', 'Primer curso', '#687b94']].map(([key, label, color]) => ({ key, label, color })), trendSeries: [['inscritos_regional', 'Inscritos', '#2f6fed'], ['admitidos_regional', 'Admitidos', '#1494a8'], ['primer_curso_regional', 'Primer curso', '#5b8f45']].map(([key, label, color]) => ({ key, label, color })), funnelSeries: [['inscritos_regional', 'Inscritos', '#082b66'], ['admitidos_regional', 'Admitidos', '#1f67bd'], ['primer_curso_regional', 'Primer curso', '#27a861']].map(([key, label, color]) => ({ key, label, color })) }
      ]
    }),
    matriculados: populationPage({
      title: 'MATRICULADOS', program, data: enrolledData, selection: section === 'completo' ? { ...visualizations.matriculados, scope: 'ambos' } : visualizations.matriculados,
      charts: [
        { title: 'Matriculados por período', subtitle: 'Evolución de estudiantes matriculados según el alcance seleccionado.', scope: 'Nacional', series: [{ key: 'matriculados_nacional', label: 'Matriculados', color: '#2f6fed' }] },
        { title: 'Matriculados por período', subtitle: 'Evolución de estudiantes matriculados según el alcance seleccionado.', scope: 'Regional', series: [{ key: 'matriculados_regional', label: 'Matriculados', color: '#b5123f' }] }
      ]
    }),
    graduados: populationPage({
      title: 'GRADUADOS', program, data: graduateData, selection: section === 'completo' ? { ...visualizations.graduados, scope: 'ambos' } : visualizations.graduados,
      charts: [
        { title: 'Graduados por período', subtitle: 'Evolución de graduados según el alcance seleccionado.', scope: 'Nacional', series: [{ key: 'graduados_nacional', label: 'Graduados', color: '#173f96' }] },
        { title: 'Graduados por período', subtitle: 'Evolución de graduados según el alcance seleccionado.', scope: 'Regional', series: [{ key: 'graduados_regional', label: 'Graduados', color: '#b5123f' }] }
      ]
    })
  };
  const offerContent = [
    ...offerPage({ rows: nationalOffer, regionalRows: regionalOffer, program, view: offerView }),
    ...geographyPages({ rows: nationalOffer, regionalRows: regionalOffer, program })
  ];
  const completeContent = [
    ...reportCoverPage({ program, nationalOffer, regionalOffer, poblacional }),
    ...offerContent,
    { text: '', pageBreak: 'before' },
    ...populationSections.ingreso,
    { text: '', pageBreak: 'before' },
    ...populationSections.matriculados,
    { text: '', pageBreak: 'before' },
    ...populationSections.graduados
  ];
  const content = section === 'completo'
    ? completeContent
    : section === 'poblacional' ? populationSections[populationGroup] : offerContent;

  const definition = {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [28, 22, 28, 24],
    defaultStyle: { font: 'ReportFont', color: '#1e293b' },
    footer: (currentPage, pageCount) => ({ text: `SIAC UNICESMAG · Contexto Externo General · Página ${currentPage} de ${pageCount}`, alignment: 'center', fontSize: 7, color: '#64748b', margin: [0, 8, 0, 0] }),
    content
  };

  return new Promise((resolve, reject) => {
    const pdf = printer.createPdfKitDocument(definition);
    const chunks = [];
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
};

module.exports = { generateContextoExternoGeneralPdf };
