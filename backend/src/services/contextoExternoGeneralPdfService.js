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
  {
    table: {
      widths: ['*'],
      body: [
        [{ text: title, color: '#ffffff', fillColor: RED, bold: true, fontSize: 11, alignment: 'center', margin: [0, 4, 0, 4] }],
        [{ text: program, color: BLUE, bold: true, fontSize: 11, alignment: 'center', margin: [0, 4, 0, 4] }]
      ]
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 8]
  }
]);

const aiAnalysisBox = (analysisText, customTitle) => {
  const contentText = text(analysisText);
  if (!contentText) return [];
  const titleText = text(customTitle) || 'ANÁLISIS DESCRIPTIVO E INTERPRETACIÓN DE DATOS (IA)';

  const paragraphs = contentText
    .split(/\n\s*\n|\n/)
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => ({
      text: p,
      fontSize: 8.8,
      color: '#334155',
      alignment: 'justify',
      lineHeight: 1.22,
      margin: [0, 0, 0, 4]
    }));

  return [
    {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: titleText.toUpperCase(),
                  fontSize: 9.5,
                  bold: true,
                  color: '#082b66',
                  margin: [0, 0, 0, 4]
                },
                ...paragraphs
              ],
              fillColor: '#f3f7fd',
              margin: [10, 7, 10, 5]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0,
        vLineWidth: (i) => (i === 0 ? 4 : 0),
        vLineColor: () => '#2f6fed',
        paddingLeft: () => 0,
        paddingRight: () => 0,
        paddingTop: () => 0,
        paddingBottom: () => 0
      },
      margin: [0, 4, 0, 0]
    }
  ];
};

const generateOfferAnalysis = (rows, regionalRows, scope = 'Nacional') => {
  const isRegional = scope.toUpperCase() === 'REGIONAL';
  const targetRows = isRegional ? regionalRows : rows;
  const count = targetRows.length;
  const sectors = labelCountRows(targetRows, 'sector');
  const modalities = labelCountRows(targetRows, 'modalidad');
  const credits = targetRows.map((r) => number(r.numero_creditos)).filter((v) => v > 0);
  const mainSector = sectors[0]?.label || 'Oficial/Privado';
  const mainModality = modalities[0]?.label || 'Presencial';
  const minCred = credits.length ? Math.min(...credits) : 'N/A';
  const maxCred = credits.length ? Math.max(...credits) : 'N/A';
  const avgCred = credits.length ? Math.round(credits.reduce((a, b) => a + b, 0) / credits.length) : 'N/A';

  return `El análisis detallado de la oferta académica a escala ${scope.toLowerCase()} consolida un registro total de ${count} programas educativos afines. La estructura institucional refleja una participación predominante del sector ${mainSector.toLowerCase()} (${sectors[0]?.value || 0} programas), impartidos prioritariamente bajo la modalidad ${mainModality.toLowerCase()} (${modalities[0]?.value || 0} programas).\n\nEn cuanto a la carga académica, la duración y la distribución de créditos oscilan entre un mínimo de ${minCred} y un máximo de ${maxCred} créditos (promedio ponderado de ${avgCred} créditos), lo que garantiza coherencia con los parámetros regulatorios del Ministerio de Educación Nacional (MEN). Esta configuración respalda el posicionamiento competitivo del programa frente a las demandas cambiantes del entorno socioeconómico y las expectativas formativas de la región.`;
};

const generateOfferTablesAnalysis = (nationalRows, regionalRows) => {
  const natCount = nationalRows.reduce((a, b) => a + number(b.value), 0);
  const regCount = regionalRows.reduce((a, b) => a + number(b.value), 0);
  const ratio = natCount > 0 ? ((regCount / natCount) * 100).toFixed(1) : '0';
  const topNat = nationalRows.slice(0, 3).map((r) => `${r.label} (${r.value})`).join(', ');

  return `La comparativa entre la oferta nacional (${natCount} programas) y la oferta regional (${regCount} programas) refleja la dinámica de concentración de la oferta de educación superior. Los programas con mayor representación a nivel nacional corresponden a: ${topNat || 'programas principales'}.\n\nLa cuota de participación de la oferta regional representa el ${ratio}% del mercado nacional. Esta métrica es fundamental para evaluar el margen de competencia directa y las oportunidades de diferenciación curricular e innovación pedagógica en el área de influencia de la institución.`;
};

const generateGeoAnalysis = (type, scope, mapRows) => {
  const isMunicipality = type === 'municipality';
  const topTerritories = mapRows.slice(0, 4).map((r) => `${r.label} (${format.format(r.value)})`).join(', ');
  const totalPrograms = mapRows.reduce((acc, row) => acc + number(row.value), 0);
  const territoryCount = mapRows.length;

  return `La caracterización cartográfica y de densidad territorial en el ámbito ${scope.toLowerCase()} por ${isMunicipality ? 'municipios' : 'departamentos'} identifica un total de ${totalPrograms} programas distribuidos en ${territoryCount} entidades territoriales. Los principales focos de concentración geográfica corresponden a: ${topTerritories || 'los principales centros urbanos'}.\n\nLa dispersión espacial evidencia la focalización estratégica en zonas con alta densidad poblacional y fuerte demanda del mercado laboral, sugiriendo a su vez oportunidades de ampliación de cobertura mediante modalidades virtuales o a distancia en zonas periféricas.`;
};

const generateIntakeAnalysis = (data, scope) => {
  const isReg = scope.toLowerCase() === 'regional';
  const totalInscritos = sum(data, isReg ? 'inscritos_regional' : 'inscritos_nacional');
  const totalAdmitidos = sum(data, isReg ? 'admitidos_regional' : 'admitidos_nacional');
  const totalPrimerCurso = sum(data, isReg ? 'primer_curso_regional' : 'primer_curso_nacional');
  const selectividad = totalInscritos > 0 ? ((totalAdmitidos / totalInscritos) * 100).toFixed(1) : '0';
  const absorcion = totalAdmitidos > 0 ? ((totalPrimerCurso / totalAdmitidos) * 100).toFixed(1) : '0';
  const conversionTotal = totalInscritos > 0 ? ((totalPrimerCurso / totalInscritos) * 100).toFixed(1) : '0';

  return `El análisis del embudo de ingreso (${scope}) en la serie histórica evaluada evidencia una demanda total de ${format.format(totalInscritos)} aspirantes inscritos, de los cuales ${format.format(totalAdmitidos)} alcanzaron el estado de admitidos y ${format.format(totalPrimerCurso)} formalizaron su matrícula en primer curso.\n\nEn términos de eficiencia del proceso, se registra una tasa de selectividad del ${selectividad}% (admitidos / inscritos) y una tasa de absorción institucional del ${absorcion}% (primer curso / admitidos). El índice de conversión global (primer curso / inscritos) del ${conversionTotal}% permite monitorear la capacidad de atracción y efectividad en la consolidación de la matrícula inicial por cohorte.`;
};

const generateEnrolledAnalysis = (data, scope) => {
  const isReg = scope.toLowerCase() === 'regional';
  const field = isReg ? 'matriculados_regional' : 'matriculados_nacional';
  const totalMatriculados = sum(data, field);
  const periods = data.filter((row) => number(row[field]) > 0);
  const periodsCount = periods.length;
  const avg = periodsCount > 0 ? Math.round(totalMatriculados / periodsCount) : 0;
  const maxPeriod = periods.reduce((max, r) => (number(r[field]) > number(max[field] || 0) ? r : max), {});

  return `El comportamiento de la población matriculada (${scope}) reporta un acumulado histórico de ${format.format(totalMatriculados)} estudiantes activos a lo largo de ${periodsCount} períodos académicos analizados, registrando un promedio semestral de ${format.format(avg)} matriculados.\n\nEl pico máximo de matrícula se alcanzó en el período ${maxPeriod.periodo || 'N/A'} con ${format.format(number(maxPeriod[field]))} estudiantes. La tendencia general refleja la capacidad de retención del programa, la estabilidad de la cohorte activa y la continuidad de la oferta formativa institucional.`;
};

const generateGraduateAnalysis = (data, scope) => {
  const isReg = scope.toLowerCase() === 'regional';
  const field = isReg ? 'graduados_regional' : 'graduados_nacional';
  const totalGraduados = sum(data, field);
  const periods = data.filter((row) => number(row[field]) > 0);
  const periodsCount = periods.length;
  const avg = periodsCount > 0 ? Math.round(totalGraduados / periodsCount) : 0;
  const maxPeriod = periods.reduce((max, r) => (number(r[field]) > number(max[field] || 0) ? r : max), {});

  return `El monitoreo del indicador de graduados (${scope}) consolida un total de ${format.format(totalGraduados)} egresados titulados durante los períodos evaluados, con una media de ${format.format(avg)} graduados por cohorte semestral.\n\nEl mayor volumen de graduación se registró en el período ${maxPeriod.periodo || 'N/A'} con ${format.format(number(maxPeriod[field]))} graduados. Estos resultados certifican la efectividad del proceso de formación académica, el logro de la titulación oportuna y la entrega de profesionales cualificados al entorno laboral regional y nacional.`;
};

const formatProgramNameSvg = (programStr) => {
  const cleanStr = (programStr || '').trim();
  if (!cleanStr) return { lines: ['-'], fontSize: 18, yPositions: [216], cardHeight: 72 };

  const len = cleanStr.length;

  if (len <= 38) {
    const fontSize = len > 28 ? 16 : 18;
    return {
      lines: [cleanStr],
      fontSize,
      yPositions: [216],
      cardHeight: 72
    };
  }

  const splitIntoLines = (str, maxLen) => {
    const words = str.split(/\s+/);
    const lines = [];
    let cur = '';
    words.forEach(w => {
      if ((cur ? cur + ' ' + w : w).length <= maxLen) {
        cur = cur ? cur + ' ' + w : w;
      } else {
        if (cur) lines.push(cur);
        cur = w;
      }
    });
    if (cur) lines.push(cur);
    return lines;
  };

  if (len <= 85) {
    const targetPerLine = Math.ceil(len / 2) + 3;
    const lines = splitIntoLines(cleanStr, targetPerLine);
    const fontSize = len > 65 ? 13.5 : 14.5;
    if (lines.length <= 2) {
      return {
        lines,
        fontSize,
        yPositions: [205, 224],
        cardHeight: 74
      };
    }
  }

  const lines = splitIntoLines(cleanStr, 48);
  const fontSize = lines.length > 3 ? 11 : 12.5;
  const startY = lines.length > 3 ? 196 : 200;
  const lineHeight = lines.length > 3 ? 13 : 15;
  const yPositions = lines.map((_, i) => startY + i * lineHeight);
  const cardHeight = Math.max(74, 52 + lines.length * lineHeight);

  return { lines, fontSize, yPositions, cardHeight };
};

const generateCoverAnalysis = (program, natCount, regCount, poblacional = []) => {
  const periods = poblacional.map((r) => text(r.periodo_referencia)).filter(Boolean).sort();
  const minPeriod = periods[0] || '2019-1';
  const maxPeriod = periods[periods.length - 1] || '2025-2';

  return `De acuerdo a la información oficial recopilada del Sistema Nacional de Información de la Educación Superior (SNIES), con el fin de recopilar e interpretar la información acerca de los programas académicos afines a ${program}, se consolida una ventana de observación de los períodos ${minPeriod} a ${maxPeriod}.\n\nEl estudio integra la caracterización de ${natCount} programas afines a nivel nacional y ${regCount} programas a nivel regional, abarcando variables de reconocimiento del MEN, sector institucional, modalidades de estudio, duración en semestres, rango de créditos académicos y distribución geográfica municipal, junto con la dinámica poblacional de inscritos, admitidos, matriculados y graduados.`;
};

const reportCoverPage = ({ program, nationalOffer, regionalOffer, aiAnalysis = {}, poblacional = [] }) => {
  const generatedAt = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Bogota' }).format(new Date());
  const formattedProgram = formatProgramNameSvg(program);
  const programTexts = formattedProgram.lines.map((line, idx) =>
    `<text x="58" y="${formattedProgram.yPositions[idx]}" font-family="Helvetica" font-size="${formattedProgram.fontSize}" font-weight="bold" fill="#082b66">${escapeXml(line)}</text>`
  ).join('');

  const coverSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="955" height="350" viewBox="0 0 955 350">
    <defs>
      <linearGradient id="cover-bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#061f4f"/><stop offset=".62" stop-color="#123b7a"/><stop offset="1" stop-color="#1f58c7"/></linearGradient>
      <filter id="cover-shadow"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#061f4f" flood-opacity=".18"/></filter>
    </defs>
    <rect width="955" height="350" rx="18" fill="#f4f7fc"/>
    <path d="M0 18Q0 0 18 0H937Q955 0 955 18V210H0Z" fill="url(#cover-bg)"/>
    <circle cx="913" cy="28" r="91" fill="#fff" fill-opacity=".045"/><circle cx="913" cy="28" r="62" fill="none" stroke="#fff" stroke-opacity=".08" stroke-width="18"/>
    <path d="M0 185L150 150L300 185L475 139L650 181L800 133L955 172V210H0Z" fill="#2f6fed" fill-opacity=".2"/>
    <rect x="34" y="24" width="144" height="23" rx="11.5" fill="#fff" fill-opacity=".13" stroke="#fff" stroke-opacity=".3"/><circle cx="48" cy="35.5" r="4" fill="#f43f5e"/>
    <text x="59" y="39" font-family="Helvetica" font-size="8" font-weight="bold" letter-spacing="1.2" fill="#fff">INFORME INSTITUCIONAL</text>
    <text x="34" y="74" font-family="Helvetica" font-size="10" font-weight="bold" letter-spacing="2.2" fill="#bfd3fb">ANÁLISIS INTEGRAL</text>
    <text x="34" y="104" font-family="Helvetica" font-size="24" font-weight="bold" fill="#fff">CONTEXTO EXTERNO</text>
    <text x="34" y="125" font-family="Helvetica" font-size="9" fill="#e5edfb">Oferta académica, territorio e información poblacional</text>
    <g transform="translate(480, 26)">
      <line x1="0" y1="8" x2="0" y2="106" stroke="#bfd3fb" stroke-opacity="0.4" stroke-width="1.5"/>
      <text x="14" y="19" font-family="Helvetica" font-size="7" font-weight="bold" letter-spacing="1" fill="#93c5fd">FUENTE DE DATOS</text>
      <text x="14" y="32" font-family="Helvetica" font-size="8.5" font-weight="bold" fill="#ffffff">SNIES (MINEDUCACIÓN)</text>
      <text x="14" y="54" font-family="Helvetica" font-size="7" font-weight="bold" letter-spacing="1" fill="#93c5fd">ELABORADO POR</text>
      <text x="14" y="67" font-family="Helvetica" font-size="8.5" font-weight="bold" fill="#ffffff">DIRECCIÓN DE PLANEACIÓN Y ASEGURAMIENTO DE LA CALIDAD</text>
      <text x="14" y="89" font-family="Helvetica" font-size="7" font-weight="bold" letter-spacing="1" fill="#93c5fd">FECHA DE EXPORTACIÓN</text>
      <text x="14" y="102" font-family="Helvetica" font-size="8.5" font-weight="bold" fill="#ffffff">${escapeXml(generatedAt)}</text>
    </g>
    <g filter="url(#cover-shadow)"><rect x="34" y="160" width="887" height="${formattedProgram.cardHeight}" rx="13" fill="#fff"/><rect x="34" y="160" width="7" height="${formattedProgram.cardHeight}" rx="3.5" fill="#b5123f"/><text x="58" y="179" font-family="Helvetica" font-size="7.5" font-weight="bold" letter-spacing="1.3" fill="#708299">PROGRAMA ACADÉMICO ANALIZADO</text>${programTexts}</g>
    <g filter="url(#cover-shadow)"><rect x="34" y="255" width="428" height="70" rx="12" fill="#fff" stroke="#cbd9ea"/><rect x="34" y="255" width="8" height="70" rx="4" fill="#173f96"/><circle cx="70" cy="290" r="21" fill="#eaf1fb"/><text x="70" y="295" text-anchor="middle" font-family="Helvetica" font-size="14" font-weight="bold" fill="#173f96">N</text><text x="102" y="278" font-family="Helvetica" font-size="7.3" font-weight="bold" letter-spacing=".7" fill="#64748b">OFERTA NACIONAL</text><text x="102" y="309" font-family="Helvetica" font-size="26" font-weight="bold" fill="#173f96">${format.format(nationalOffer.length)}</text><text x="390" y="304" text-anchor="end" font-family="Helvetica" font-size="7" fill="#64748b">PROGRAMAS</text><path d="M401 274h29v5h-29zm0 11h29v5h-29zm0 11h29v5h-29z" fill="#173f96" fill-opacity=".2"/></g>
    <g filter="url(#cover-shadow)"><rect x="493" y="255" width="428" height="70" rx="12" fill="#fff" stroke="#e3cad3"/><rect x="493" y="255" width="8" height="70" rx="4" fill="#b5123f"/><circle cx="529" cy="290" r="21" fill="#faeaf0"/><text x="529" y="295" text-anchor="middle" font-family="Helvetica" font-size="14" font-weight="bold" fill="#b5123f">R</text><text x="561" y="278" font-family="Helvetica" font-size="7.3" font-weight="bold" letter-spacing=".7" fill="#64748b">OFERTA REGIONAL</text><text x="561" y="309" font-family="Helvetica" font-size="26" font-weight="bold" fill="#b5123f">${format.format(regionalOffer.length)}</text><text x="849" y="304" text-anchor="end" font-family="Helvetica" font-size="7" fill="#64748b">PROGRAMAS</text><path d="M860 274h29v5h-29zm0 11h29v5h-29zm0 11h29v5h-29z" fill="#b5123f" fill-opacity=".18"/></g>
    <rect x="34" y="340" width="887" height="2" rx="1" fill="#d7e1ee"/>
  </svg>`;

  const coverAnalysisText = aiAnalysis.cover_analysis || aiAnalysis.contexto_introductorio || generateCoverAnalysis(program, nationalOffer.length, regionalOffer.length, poblacional);

  return [
    ...(fs.existsSync(headerPath) ? [{ image: headerPath, fit: [955, 75], alignment: 'center', margin: [0, 0, 0, 10] }] : []),
    { svg: coverSvg, width: 955, alignment: 'center', margin: [0, 0, 0, 8] },
    ...aiAnalysisBox(coverAnalysisText, 'MARCO DE REFERENCIA Y CONTEXTO EXTERNO GENERAL (SNIES)'),
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

const stackedBarChartSvg = ({ data, series, width = 690, height = 260, title = '', subtitle = '', scope = '' }) => {
  const visibleData = data.filter((row) => series.some((item) => number(row[item.key]) > 0));
  const margin = { left: 48, right: 12, top: 62, bottom: 46 };
  const chartW = width - margin.left - margin.right;
  const chartH = height - margin.top - margin.bottom;
  const maxStack = Math.max(1, ...visibleData.map((row) => series.reduce((total, item) => total + number(row[item.key]), 0)));
  const maxValue = maxStack * 1.08;
  const slotWidth = chartW / Math.max(1, visibleData.length);
  const barWidth = Math.max(18, Math.min(72, slotWidth * 0.88));
  const x = (index) => margin.left + slotWidth * index + slotWidth / 2;
  const y = (value) => margin.top + chartH - (number(value) / maxValue) * chartH;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const gy = margin.top + (index * chartH) / 4;
    const value = Math.round(maxValue * (1 - index / 4));
    const compact = Math.abs(value) >= 1000 ? `${(value / 1000).toLocaleString('es-CO', { maximumFractionDigits: 1 })}k` : format.format(value);
    return `<line x1="${margin.left}" y1="${gy}" x2="${margin.left + chartW}" y2="${gy}" stroke="#e5eaf1" stroke-dasharray="3 4"/><text x="${margin.left - 7}" y="${gy + 3.5}" text-anchor="end" font-size="9" font-weight="bold" fill="#52657c">${escapeXml(compact)}</text>`;
  }).join('');
  const bars = visibleData.map((row, rowIndex) => {
    let cumulative = 0;
    const lastActiveIndex = series.reduce((lastIdx, item, idx) => (number(row[item.key]) > 0 ? idx : lastIdx), -1);
    return series.map((item, seriesIndex) => {
      const value = number(row[item.key]);
      const top = y(cumulative + value);
      const bottom = y(cumulative);
      const segmentHeight = Math.max(0, bottom - top);
      cumulative += value;
      if (!value) return '';
      const bx = x(rowIndex) - barWidth / 2;
      const isTopSegment = seriesIndex === lastActiveIndex;
      const r = Math.min(4, Math.min(barWidth / 2, segmentHeight));
      const color = item.color || COLORS[seriesIndex];
      const segmentShape = isTopSegment && r > 0
        ? `<path d="M ${bx} ${top + segmentHeight} V ${top + r} A ${r} ${r} 0 0 1 ${bx + r} ${top} H ${bx + barWidth - r} A ${r} ${r} 0 0 1 ${bx + barWidth} ${top + r} V ${top + segmentHeight} Z" fill="${color}"/>`
        : `<rect x="${bx}" y="${top}" width="${barWidth}" height="${segmentHeight}" fill="${color}"/>`;
      const formatted = format.format(value);
      const externalLabelWidth = Math.max(22, formatted.length * 5 + 8);
      const labelY = (top + segmentHeight / 2 + (segmentHeight < 18 ? 2.2 : 2.5)).toFixed(1);
      const label = segmentHeight >= 12 && barWidth >= 22
        ? `<text x="${x(rowIndex)}" y="${labelY}" text-anchor="middle" font-size="${segmentHeight < 18 ? 7.2 : 8.2}" font-weight="bold" fill="#ffffff">${escapeXml(formatted)}</text>`
        : `<line x1="${x(rowIndex) + barWidth / 2}" y1="${top + Math.max(3, segmentHeight / 2)}" x2="${x(rowIndex) + barWidth / 2 + 4}" y2="${top + Math.max(3, segmentHeight / 2)}" stroke="#64748b" stroke-width=".8"/><rect x="${x(rowIndex) + barWidth / 2 + 4}" y="${top + Math.max(3, segmentHeight / 2) - 6}" width="${externalLabelWidth}" height="12" rx="3" fill="#fff" stroke="#94a3b8" stroke-width=".6"/><text x="${x(rowIndex) + barWidth / 2 + 4 + externalLabelWidth / 2}" y="${(top + Math.max(3, segmentHeight / 2) + 2.5).toFixed(1)}" text-anchor="middle" font-size="7.8" font-weight="bold" fill="#1e293b">${escapeXml(formatted)}</text>`;
      return `${segmentShape}${label}`;
    }).join('');
  }).join('');
  const labels = visibleData.map((row, index) => {
    const [year, semester] = text(row.periodo).split('-');
    const semesterLabel = semester === '1' ? 'I' : semester === '2' ? 'II' : semester || '—';
    return `<rect x="${x(index) - 11}" y="${height - 38}" width="22" height="15" rx="7.5" fill="#e7edf5"/><text x="${x(index)}" y="${height - 27.5}" text-anchor="middle" font-size="8" font-weight="bold" fill="#52657c">${escapeXml(semesterLabel)}</text><text x="${x(index)}" y="${height - 12}" text-anchor="middle" font-size="9" font-weight="bold" fill="#102a4c">${escapeXml(year)}</text>`;
  }).join('');
  const legendWidth = series.length * 115;
  const legend = series.map((item, index) => {
    const lx = width / 2 - legendWidth / 2 + index * 115;
    return `<circle cx="${lx}" cy="52" r="4.5" fill="${item.color || COLORS[index]}"/><text x="${lx + 8}" y="55.5" font-size="9.5" font-weight="bold" fill="#334155">${escapeXml(item.label)}</text>`;
  }).join('');
  const scopeWidth = 68;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#ffffff" stroke="#cbd9ea"/><text x="18" y="24" font-size="12" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text><text x="18" y="39" font-size="8.5" fill="#64748b">${escapeXml(subtitle)}</text><rect x="${width - scopeWidth - 18}" y="15" width="${scopeWidth}" height="22" rx="11" fill="#2f6fed"/><text x="${width - scopeWidth / 2 - 18}" y="29" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#ffffff">${escapeXml(scope)}</text>${legend}${grid}<line x1="${margin.left}" y1="${margin.top + chartH}" x2="${margin.left + chartW}" y2="${margin.top + chartH}" stroke="#91a4bd"/>${bars}${labels}</svg>`;
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
      return `<circle cx="${x(index)}" cy="${y(value)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.3"/><text x="${x(index)}" y="${y(value) - 8}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${color}">${escapeXml(format.format(value))}</text>`;
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
      return `<polygon points="${points}" fill="${item.color}" stroke="#fff" stroke-width="1.3"/><text x="${centerX}" y="${topY + stageHeight / 2 + 2}" text-anchor="middle" font-size="${fontSize}" font-weight="bold" fill="#fff">${escapeXml(format.format(value))}</text>`;
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
    const dots = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="${item.color}" stroke="#fff" stroke-width="1.2"/><text x="${x(index)}" y="${y(value) - 6}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="${item.color}">${escapeXml(format.format(value))}</text>`).join('');
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
    const nodes = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="10" fill="${item.color}" stroke="#fff" stroke-width="1.5"/><text x="${x(index)}" y="${y(value) + 3}" text-anchor="middle" font-size="5.5" font-weight="bold" fill="#fff">${rowIndex === 0 ? 'I' : rowIndex === 1 ? 'A' : 'PC'}</text><text x="${x(index)}" y="${y(value) + 21}" text-anchor="middle" font-size="6.5" font-weight="bold" fill="${item.color}">${escapeXml(format.format(value))}</text>`).join('');
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
    return `<text x="${x(index)}" y="${centerY + 2.2}" text-anchor="middle" font-size="${visibleData.length > 16 ? 4.5 : 5.7}" font-weight="bold" fill="#fff">${escapeXml(format.format(value))}</text>`;
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

const geoFeatureCenter = (rings = []) => {
  const ring = rings.reduce((largest, current) => (current.length > largest.length ? current : largest), rings[0] || []);
  if (!ring.length) return null;
  const lons = ring.map(([lon]) => lon);
  const lats = ring.map(([, lat]) => lat);
  return {
    lon: (Math.min(...lons) + Math.max(...lons)) / 2,
    lat: (Math.min(...lats) + Math.max(...lats)) / 2
  };
};

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
    if (!municipalities.has(municipalityKey)) municipalities.set(municipalityKey, { key: municipalityKey, label: text(resolved?.name || source), value: 0, latitude: Number(resolved?.latitude), longitude: Number(resolved?.longitude), departmentKey: normalizeGeo(resolved?.department_name || row.departamento) });
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

const isRegionalRow = (row) => {
  const geo = text(row.georeferencia || row.georreferencia || row.cobertura || '').toUpperCase();
  const dep = text(row.departamento || '').toUpperCase();
  const mun = text(row.municipio || row.municipio_oferta_programa || '').toUpperCase();

  if (geo === 'REGIONAL' || geo.includes('REGION') || geo.includes('SUROCCIDENTE') || geo === 'SI') return true;
  if (['NARIÑO', 'VALLE DEL CAUCA', 'CAUCA', 'PUTUMAYO'].includes(dep)) return true;
  if (['PASTO', 'SANTIAGO DE CALI', 'CALI', 'POPAYAN', 'POPAYÁN', 'MOCOA'].includes(mun)) return true;
  return false;
};

const geoMapSvg = ({ geo, rows, type, color, title, width = 478, height = 390 }) => {
  const map = new Map(rows.map((row) => [row.key, row]));
  const showDepartmentWatermarks = text(title).toUpperCase().includes('REGIONAL');
  const activeDepartmentKeys = new Set(type === 'department'
    ? rows.filter((row) => number(row.value) > 0).map((row) => normalizeGeo(row.key || row.label))
    : rows.filter((row) => number(row.value) > 0).map((row) => normalizeGeo(row.departmentKey)));
  const max = Math.max(1, ...rows.map((row) => row.value));
  const VIBRANT_PALETTE = ['#e83e8c', '#00c0ef', '#fd7e14', '#6f42c1', '#20c997', '#007bff', '#dc3545', '#17a2b8', '#ffc107', '#28a745'];

  let bbox = geo.bbox;
  if (showDepartmentWatermarks && rows.length > 0) {
    const located = rows.filter((r) => Number.isFinite(r.longitude) && Number.isFinite(r.latitude));
    if (located.length > 0) {
      const lons = located.map((r) => r.longitude);
      const lats = located.map((r) => r.latitude);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const paddingLon = Math.max(0.6, (maxLon - minLon) * 0.45);
      const paddingLat = Math.max(0.6, (maxLat - minLat) * 0.45);
      bbox = {
        minLon: minLon - paddingLon,
        maxLon: maxLon + paddingLon,
        minLat: minLat - paddingLat,
        maxLat: maxLat + paddingLat
      };
    }
  }

  const defs = `<defs>
    <linearGradient id="pdf-land-grad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#d9e8c8"/>
      <stop offset="38%" stop-color="#eef0d2"/>
      <stop offset="70%" stop-color="#d5dfbd"/>
      <stop offset="100%" stop-color="#c4d8bd"/>
    </linearGradient>
  </defs>`;

  const paths = geo.features.map((feature) => {
    const datum = map.get(feature.key);
    const ratio = number(datum?.value) / max;
    const medium = color === RED ? '#ec86a4' : '#79aaf5';
    const light = color === RED ? '#f8bfd0' : '#c6dbfb';
    const fill = type === 'department'
      ? (datum ? (ratio > .66 ? color : ratio > .33 ? medium : light) : '#eaf4db')
      : 'url(#pdf-land-grad)';
    const strokeColor = datum ? color : '#93aa9b';
    const strokeWidth = datum ? (type === 'department' ? 1.2 : 0.8) : 0.45;
    return `<path d="${geoPath(feature.rings, bbox, width, height)}" fill="${fill}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
  }).join('');

  const departmentWatermarks = geo.features.map((feature) => {
    if (!showDepartmentWatermarks) return '';
    if (!activeDepartmentKeys.has(feature.key)) return '';
    const center = geoFeatureCenter(feature.rings);
    if (!center) return '';
    const point = projectGeo({ ...center, bbox, width, height });
    if (point.x < 16 || point.x > width - 16 || point.y < 34 || point.y > height - 14) return '';
    const label = text(feature.label).toLocaleUpperCase('es-CO');
    const fontSize = label.length > 18 ? 3.8 : label.length > 12 ? 4.3 : 4.8;
    return `<text x="${point.x.toFixed(1)}" y="${point.y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-family="ReportFont, Arial, sans-serif" font-size="${fontSize}" font-weight="bold" letter-spacing=".45" fill="#31545b" fill-opacity=".46" stroke="#ffffff" stroke-opacity=".88" stroke-width="1.15" paint-order="stroke">${escapeXml(label)}</text>`;
  }).join('');

  const bubbles = type === 'municipality' ? rows.filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude)).map((row, index) => {
    const point = projectGeo({ lon: row.longitude, lat: row.latitude, bbox, width, height });
    const radius = 4 + Math.sqrt(row.value / max) * 8.5;
    const pinColor = VIBRANT_PALETTE[index % VIBRANT_PALETTE.length];
    return `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="${radius.toFixed(1)}" fill="${pinColor}" fill-opacity=".85" stroke="#ffffff" stroke-width="1.4"/>`;
  }).join('') : '';

  const occupied = [];
  const locatedRows = rows.filter((row) => Number.isFinite(row.longitude) && Number.isFinite(row.latitude));
  const municipalityLabelLimit = locatedRows.length <= 22 ? locatedRows.length : locatedRows.length <= 30 ? 15 : 13;
  const labelRows = type === 'municipality'
    ? locatedRows.slice(0, municipalityLabelLimit)
    : [];
  const municipalityLabels = labelRows.map((row, index) => {
    const point = projectGeo({ lon: row.longitude, lat: row.latitude, bbox, width, height });
    const label = text(row.label).length > 19 ? `${text(row.label).slice(0, 18)}…` : text(row.label);
    const dense = labelRows.length > 16;
    const boxHeight = dense ? 13 : 15;
    const boxWidth = Math.max(42, Math.min(dense ? 88 : 98, label.length * (dense ? 3.25 : 3.65) + 24));
    const verticalOffsets = [-18, 7, -34, 23, -50, 39, -66, 55];
    const candidates = verticalOffsets.flatMap((offset) => [[9, offset], [-boxWidth - 9, offset]]);
    let selected = candidates[index % candidates.length];
    for (const candidate of candidates) {
      const x = Math.max(4, Math.min(width - boxWidth - 4, point.x + candidate[0]));
      const y = Math.max(24, Math.min(height - boxHeight - 4, point.y + candidate[1]));
      const overlaps = occupied.some((box) => x < box.x + box.w + 3 && x + boxWidth + 3 > box.x && y < box.y + box.h + 3 && y + boxHeight + 3 > box.y);
      if (!overlaps) { selected = [x - point.x, y - point.y]; break; }
    }
    const x = Math.max(4, Math.min(width - boxWidth - 4, point.x + selected[0]));
    const y = Math.max(24, Math.min(height - boxHeight - 4, point.y + selected[1]));
    occupied.push({ x, y, w: boxWidth, h: boxHeight });
    const anchorX = x > point.x ? x : x + boxWidth;
    const leaderLine = `<line x1="${point.x.toFixed(1)}" y1="${point.y.toFixed(1)}" x2="${anchorX.toFixed(1)}" y2="${(y + boxHeight / 2).toFixed(1)}" stroke="#475569" stroke-width=".8" stroke-dasharray="2 2"/>`;
    const badge = `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxWidth.toFixed(1)}" height="${boxHeight}" rx="4" fill="#0f172a" fill-opacity=".94" stroke="#ffffff" stroke-width=".8"/><rect x="${(x + boxWidth - 23).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="22" height="${boxHeight - 2}" rx="3" fill="${color}"/><text x="${(x + 6).toFixed(1)}" y="${(y + boxHeight / 2 + 2.2).toFixed(1)}" font-size="${dense ? 5 : 5.8}" font-weight="bold" fill="#ffffff">${escapeXml(label)}</text><text x="${(x + boxWidth - 12).toFixed(1)}" y="${(y + boxHeight / 2 + 2.2).toFixed(1)}" text-anchor="middle" font-size="${dense ? 5.2 : 6.2}" font-weight="bold" fill="#ffffff">${format.format(row.value)}</text>`;
    return leaderLine + badge;
  }).join('');

  const departmentFeatures = type === 'department'
    ? geo.features.filter((feature) => map.has(feature.key)).sort((a, b) => number(map.get(b.key)?.value) - number(map.get(a.key)?.value))
    : [];
  const departmentLabelLimit = departmentFeatures.length <= 20 ? departmentFeatures.length : 16;
  const departmentLabels = type === 'department' ? departmentFeatures.slice(0, departmentLabelLimit).map((feature, index) => {
    const datum = map.get(feature.key);
    const allPoints = feature.rings.flat();
    const lons = allPoints.map((point) => point[0]);
    const lats = allPoints.map((point) => point[1]);
    const point = projectGeo({ lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2, bbox, width, height });
    const label = text(datum.label).length > 16 ? `${text(datum.label).slice(0, 15)}…` : text(datum.label);
    const boxWidth = Math.max(50, Math.min(105, label.length * 4.2 + 27));
    const candidates = [[-boxWidth / 2, -8], [8, -8], [-boxWidth - 8, -8], [-boxWidth / 2, 10], [8, 10], [-boxWidth - 8, 10], [-boxWidth / 2, -25], [-boxWidth / 2, 27]];
    let selected = candidates[index % candidates.length];
    for (const candidate of candidates) {
      const candidateX = Math.max(3, Math.min(width - boxWidth - 3, point.x + candidate[0]));
      const candidateY = Math.max(23, Math.min(height - 18, point.y + candidate[1]));
      const overlaps = occupied.some((box) => candidateX < box.x + box.w + 2 && candidateX + boxWidth + 2 > box.x && candidateY < box.y + box.h + 2 && candidateY + 17 + 2 > box.y);
      if (!overlaps) { selected = candidate; break; }
    }
    const x = Math.max(3, Math.min(width - boxWidth - 3, point.x + selected[0]));
    const y = Math.max(23, Math.min(height - 18, point.y + selected[1]));
    occupied.push({ x, y, w: boxWidth, h: 17 });
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${boxWidth.toFixed(1)}" height="17" rx="4" fill="#0f172a" fill-opacity=".94" stroke="#ffffff" stroke-width=".8"/><rect x="${(x + boxWidth - 22).toFixed(1)}" y="${(y + 1).toFixed(1)}" width="21" height="15" rx="3" fill="${color}"/><text x="${(x + 5).toFixed(1)}" y="${(y + 11.5).toFixed(1)}" font-size="5.4" font-weight="bold" fill="#ffffff">${escapeXml(label)}</text><text x="${(x + boxWidth - 11.5).toFixed(1)}" y="${(y + 11.5).toFixed(1)}" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#ffffff">${format.format(datum.value)}</text>`;
  }).join('') : '';

  const availableLabels = type === 'municipality' ? locatedRows.length : departmentFeatures.length;
  const displayedLabels = type === 'municipality' ? labelRows.length : departmentLabelLimit;
  const territoryName = type === 'municipality' ? 'municipios' : 'departamentos';
  const labelNote = availableLabels > displayedLabels
    ? `Se muestran ${displayedLabels} de ${availableLabels} ${territoryName}; el resto se consolida en el ranking.`
    : 'Se muestran todas las etiquetas territoriales disponibles.';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${defs}<rect width="100%" height="100%" rx="12" fill="#eef5f8" stroke="#cbd9ea"/><text x="16" y="18" font-size="9" font-weight="bold" fill="${BLUE}">${escapeXml(title)}</text><text x="16" y="31" font-size="6" fill="#64748b">${escapeXml(labelNote)}</text><g transform="translate(0 12)">${paths}${departmentWatermarks}${bubbles}${municipalityLabels}${departmentLabels}</g></svg>`;
};

const territoryRankingSvg = ({ title, rows, color, width = 250, height = 405 }) => {
  const total = rows.reduce((acc, row) => acc + number(row.value), 0);
  const visibleLimit = rows.length <= 18 ? rows.length : 17;
  const visibleRows = rows.slice(0, visibleLimit);
  if (rows.length > visibleLimit) {
    visibleRows.push({ label: `Otros ${rows.length - visibleLimit} territorios`, value: rows.slice(visibleLimit).reduce((acc, row) => acc + number(row.value), 0), summarized: true });
  }
  const safeRows = visibleRows.length ? visibleRows : [{ label: 'Sin registros', value: 0 }];
  const max = Math.max(1, ...safeRows.map((row) => number(row.value)));
  const startY = 93;
  const footerHeight = 42;
  const rowHeight = Math.min(17, (height - startY - footerHeight - 8) / safeRows.length);
  const truncate = (value) => text(value).length > 24 ? `${text(value).slice(0, 23)}…` : text(value);
  const innerW = width - 4;
  const rowW = width - 20;
  const badgeW = 34;
  const badgeX = width - 44;
  const rowMarkup = safeRows.map((row, index) => {
    const y = startY + index * rowHeight;
    const barWidth = number(row.value) > 0 ? Math.max(3, (number(row.value) / max) * (rowW - 100)) : 0;
    const rankFill = row.summarized ? '#64748b' : color;
    return `<rect x="10" y="${y.toFixed(1)}" width="${rowW}" height="${(rowHeight - 1).toFixed(1)}" rx="4" fill="${index % 2 ? '#f8fafc' : '#fff'}"/><circle cx="21" cy="${(y + rowHeight / 2).toFixed(1)}" r="6.5" fill="${rankFill}" fill-opacity=".12"/><text x="21" y="${(y + rowHeight / 2 + 2.1).toFixed(1)}" text-anchor="middle" font-size="4.8" font-weight="bold" fill="${rankFill}">${row.summarized ? '+' : index + 1}</text><text x="32" y="${(y + rowHeight / 2 + 2).toFixed(1)}" font-size="5.7" font-weight="${row.summarized ? 'bold' : 'normal'}" fill="#29415f">${escapeXml(truncate(row.label))}</text><rect x="${badgeX}" y="${(y + 2.5).toFixed(1)}" width="${badgeW}" height="${Math.max(10, rowHeight - 6).toFixed(1)}" rx="5" fill="${rankFill}"/><text x="${badgeX + badgeW / 2}" y="${(y + rowHeight / 2 + 2).toFixed(1)}" text-anchor="middle" font-size="5.7" font-weight="bold" fill="#fff">${format.format(row.value)}</text><rect x="32" y="${(y + rowHeight - 3).toFixed(1)}" width="${rowW - 100}" height="1.6" rx=".8" fill="#e2e8f0"/><rect x="32" y="${(y + rowHeight - 3).toFixed(1)}" width="${barWidth.toFixed(1)}" height="1.6" rx=".8" fill="${rankFill}"/>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><filter id="rank-shadow"><feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#0f294f" flood-opacity=".12"/></filter></defs><rect x="2" y="2" width="${innerW}" height="${height - 4}" rx="13" fill="#fff" stroke="#d5dfeb" filter="url(#rank-shadow)"/><path d="M15 2H${width - 15}Q${width - 2} 2 ${width - 2} 15V65H2V15Q2 2 15 2Z" fill="${color}"/><circle cx="24" cy="25" r="12" fill="#fff" fill-opacity=".14"/><path d="M18 25h12M24 19v12" stroke="#fff" stroke-width="2" stroke-linecap="round"/><text x="43" y="22" font-size="7.4" font-weight="bold" fill="#fff">RANKING TERRITORIAL</text><text x="43" y="37" font-size="5.5" font-weight="bold" fill="#fff" fill-opacity=".82">${escapeXml(text(title).slice(0, 32))}</text><rect x="13" y="49" width="95" height="19" rx="9.5" fill="#fff"/><text x="60.5" y="62" text-anchor="middle" font-size="5.8" font-weight="bold" fill="${color}">${rows.length} TERRITORIOS</text><rect x="${width - 110}" y="49" width="95" height="19" rx="9.5" fill="#fff" fill-opacity=".14"/><text x="${width - 62.5}" y="62" text-anchor="middle" font-size="5.8" font-weight="bold" fill="#fff">${format.format(total)} PROGRAMAS</text><text x="12" y="84" font-size="5.4" font-weight="bold" letter-spacing=".5" fill="#64748b">TERRITORIO</text><text x="${width - 25}" y="84" text-anchor="middle" font-size="5.4" font-weight="bold" fill="#64748b">TOTAL</text>${rowMarkup}<rect x="10" y="${height - 39}" width="${rowW}" height="29" rx="8" fill="${color}" fill-opacity=".08"/><text x="20" y="${height - 21}" font-size="6.5" font-weight="bold" fill="#183552">TOTAL GENERAL</text><text x="${width - 20}" y="${height - 21}" text-anchor="end" font-size="8.5" font-weight="bold" fill="${color}">${format.format(total)}</text></svg>`;
};

const geographyPages = ({ rows, regionalRows, program, aiAnalysis = {} }) => {
  const geo = loadGeoData();
  if (!geo) return [];
  const national = aggregateGeography(rows, geo);
  const regional = aggregateGeography(regionalRows, geo);
  const page = (heading, mapRows, type, color, tableTitle, geoKey) => [
    { text: '', pageBreak: 'before', pageOrientation: 'landscape' },
    ...sectionHeader(heading, program),
    {
      columns: [
        { svg: geoMapSvg({ geo, rows: mapRows, type, color, title: heading, width: 695, height: 405 }), width: 695 },
        { svg: territoryRankingSvg({ title: tableTitle, rows: mapRows, color, width: 250, height: 405 }), width: 250 }
      ],
      columnGap: 10,
      alignment: 'center'
    },
    { text: '', pageBreak: 'before' },
    ...sectionHeader(heading, program),
    ...aiAnalysisBox(
      aiAnalysis[geoKey] || generateGeoAnalysis(type, heading.includes('REGIONAL') ? 'REGIONAL' : 'NACIONAL', mapRows)
    )
  ];
  return [
    ...page('MAPA DE MUNICIPIOS · NACIONAL', national.municipalities, 'municipality', '#173f96', 'MUNICIPIOS DESTACADOS', 'geo_municipios_nacional'),
    ...page('MAPA DE MUNICIPIOS · REGIONAL', regional.municipalities, 'municipality', RED, 'MUNICIPIOS REGIONALES', 'geo_municipios_regional'),
    ...page('MAPA DE DEPARTAMENTOS · NACIONAL', national.departments, 'department', '#173f96', 'DEPARTAMENTOS DESTACADOS', 'geo_departamentos_nacional'),
    ...page('MAPA DE DEPARTAMENTOS · REGIONAL', regional.departments, 'department', RED, 'DEPARTAMENTOS REGIONALES', 'geo_departamentos_regional')
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

const renderIconSvg = (type, x, y, color) => {
  if (type === 'bank') {
    return `<g transform="translate(${x}, ${y})" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-5 4h10M-4 0h8M-3 -3l3 -2l3 2M-3 0v4M0 0v4M3 0v4"/></g>`;
  }
  if (type === 'building') {
    return `<g transform="translate(${x}, ${y})" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-4 -5h8v10h-8zM-2 -3h1M1 -3h1M-2 0h1M1 0h1M-2 3h1M1 3h1"/></g>`;
  }
  if (type === 'ribbon') {
    return `<g transform="translate(${x}, ${y})" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><circle cx="0" cy="-2" r="3.5"/><path d="M-2 1.5l-1.5 5.5l3.5 -1.8l3.5 1.8l-1.5 -5.5"/></g>`;
  }
  if (type === 'calendar') {
    return `<g transform="translate(${x}, ${y})" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-4 -3h8v8h-8zM-2 -5v2M2 -5v2M-4 -1h8"/></g>`;
  }
  if (type === 'laptop') {
    return `<g transform="translate(${x}, ${y})" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" fill="none"><path d="M-3 -4h6v5h-6zM-5 3h10"/></g>`;
  }
  return '';
};

const offerSummaryVisualSvg = ({ rows, view = 'sequence', scope = 'Nacional', program = '', width = 955, height = 380 }) => {
  const viewLabels = { sequence: 'VISTA SECUENCIAL', panel: 'VISTA PANEL', orbit: 'VISTA ÓRBITA', radial: 'VISTA RADIAL', executive: 'VISTA EJECUTIVA' };
  const scopeLabel = text(scope).toUpperCase();
  const scopeColor = scopeLabel === 'REGIONAL' ? RED : '#173f96';
  const credits = rows.map((row) => number(row.numero_creditos)).filter((value) => value > 0);
  const semesterRows = labelCountRows(rows, 'numero_semestres').map((row) => ({ ...row, label: `${row.label} semestres` }));
  const groups = [
    { title: 'Reconocimiento MEN', color: '#173f96', items: labelCountRows(rows, 'reconocimiento_men'), icon: 'bank' },
    { title: 'Sector', color: '#3a9626', items: labelCountRows(rows, 'sector'), icon: 'building' },
    { title: 'Modalidades', color: '#92278f', items: labelCountRows(rows, 'modalidad'), icon: 'laptop' },
    { title: 'Número de semestres', color: '#0891a5', items: semesterRows, icon: 'calendar' },
    { title: 'Rango de créditos académicos', color: '#ea6a0a', items: credits.length ? [
      { label: 'Mínimo de créditos', value: Math.min(...credits) },
      { label: 'Máximo de créditos', value: Math.max(...credits) },
      { label: 'Promedio de créditos', value: Math.round(credits.reduce((a, b) => a + b, 0) / credits.length) }
    ] : [], icon: 'ribbon' }
  ];
  const card = (group, x, y, w, h, compact = false) => {
    const availableSlots = compact
      ? Math.max(2, Math.floor((h - 34) / 13))
      : Math.max(2, Math.floor((h - 46) / 16));
    const shouldSummarize = view !== 'orbit' && group.items.length > availableSlots;
    const visibleItems = shouldSummarize ? group.items.slice(0, availableSlots - 1) : group.items;
    const hiddenItems = shouldSummarize ? group.items.slice(availableSlots - 1) : [];
    const items = shouldSummarize ? [
      ...visibleItems,
      {
        label: `OTRAS ${hiddenItems.length} CATEGORÍAS`,
        value: hiddenItems.reduce((total, item) => total + number(item.value), 0)
      }
    ] : visibleItems;
    const startY = y + (compact ? (view === 'orbit' ? 30 : 36) : 43);
    const step = compact ? (view === 'orbit' ? 16 : (h < 90 ? 13.5 : 15.5)) : Math.max(16, Math.min(28, (h - 53) / Math.max(1, items.length)));
    const headerHeight = compact ? 22 : 28;
    const headerTextY = y + (compact ? 15 : 19);
    const body = items.length ? items.map((item, index) => {
      const iy = startY + index * step;
      const label = text(item.label).length > 28 ? `${text(item.label).slice(0, 27)}…` : text(item.label);
      return `<circle cx="${x + 14}" cy="${iy - 2.5}" r="${compact ? 2.5 : 3}" fill="${group.color}"/><text x="${x + 23}" y="${iy}" font-size="${compact ? 7.8 : 9}" font-weight="bold" fill="#334155">${escapeXml(label)}</text><rect x="${x + w - 48}" y="${iy - (compact ? 8.5 : 11)}" width="38" height="${compact ? 12.5 : 16}" rx="${compact ? 4 : 5}" fill="#fff" stroke="${group.color}" stroke-opacity=".4"/><text x="${x + w - 29}" y="${iy + 0.5}" text-anchor="middle" font-size="${compact ? 8.2 : 9.5}" font-weight="bold" fill="${group.color}">${escapeXml(format.format(item.value))}</text>`;
    }).join('') : `<text x="${x + w / 2}" y="${y + h / 2 + 10}" text-anchor="middle" font-size="8.5" fill="#94a3b8">Sin información</text>`;
    if (view === 'orbit') {
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="${group.color}" stroke-width="1.4" stroke-opacity=".45"/><text x="${x + 16}" y="${y + 16}" font-size="9" font-weight="bold" fill="${group.color}">${escapeXml(group.title)}</text>${body}`;
    }
    return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="${group.color}" stroke-opacity=".35"/><rect x="${x}" y="${y}" width="${w}" height="${headerHeight}" rx="12" fill="${group.color}"/><rect x="${x}" y="${y + headerHeight - 9}" width="${w}" height="9" fill="${group.color}"/><text x="${x + w / 2}" y="${headerTextY}" text-anchor="middle" font-size="${compact ? 7.5 : 8.5}" font-weight="bold" fill="#fff">${escapeXml(group.title)}</text>${body}`;
  };
  let body = '';
  let calculatedHeight = height;

  if (view === 'radial') {
    const cx = 478;
    const cy = 185;

    const getCardH = (group) => Math.max(56, 34 + (group.items.length || 1) * 22);
    const h0 = getCardH(groups[0]);
    const h1 = getCardH(groups[1]);
    const h2 = getCardH(groups[2]);
    const h4 = getCardH(groups[4]);
    const h3 = getCardH(groups[3]);

    const radialCardsConfig = [
      {
        group: groups[0],
        title: 'Reconocimiento MEN',
        icon: 'bank',
        card: { x: 25, y: 25, w: 250, h: h0 },
        badge: { x: 150, y: 13 },
        dot: { x: 420, y: 134 },
        line: `M 275 65 L 350 65 L 420 134`
      },
      {
        group: groups[1],
        title: 'Sector',
        icon: 'building',
        card: { x: 680, y: 25, w: 250, h: h1 },
        badge: { x: 805, y: 13 },
        dot: { x: 536, y: 134 },
        line: `M 680 65 L 605 65 L 536 134`
      },
      {
        group: groups[2],
        title: 'Modalidades',
        icon: 'laptop',
        card: { x: 25, y: 155, w: 250, h: h2 },
        badge: { x: 150, y: 143 },
        dot: { x: 410, y: 185 },
        line: `M 275 185 L 410 185`
      },
      {
        group: groups[4],
        title: 'Rango de créditos académicos',
        icon: 'ribbon',
        card: { x: 680, y: 155, w: 250, h: h4 },
        badge: { x: 805, y: 143 },
        dot: { x: 546, y: 210 },
        line: `M 680 210 L 605 210 L 546 210`
      },
      {
        group: groups[3],
        title: 'Número de semestres',
        icon: 'calendar',
        card: { x: 353, y: 300, w: 250, h: h3 },
        badge: { x: 478, y: 287 },
        dot: { x: 478, y: 253 },
        line: `M 478 253 L 478 287`
      }
    ];

    calculatedHeight = Math.max(380, 300 + h3 + 15);

    const cardsMarkup = radialCardsConfig.map(({ group, title, icon, card: c, badge, dot, line }) => {
      const { x, y, w, h } = c;
      const startY = y + 34;
      const items = group.items;
      const step = 22;

      const bodyMarkup = items.length ? items.map((item, index) => {
        const iy = startY + index * step + 12;
        const label = text(item.label);
        return `<circle cx="${x + 14}" cy="${iy - 2.8}" r="3" fill="${group.color}"/><text x="${x + 23}" y="${iy}" font-size="8.5" font-weight="bold" fill="#334155">${escapeXml(label)}</text><rect x="${x + w - 48}" y="${iy - 10.5}" width="38" height="15" rx="5" fill="#fff" stroke="${group.color}" stroke-opacity=".4"/><text x="${x + w - 29}" y="${iy + 0.5}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${group.color}">${escapeXml(format.format(item.value))}</text>`;
      }).join('') : `<text x="${x + w / 2}" y="${y + h / 2 + 5}" text-anchor="middle" font-size="8.5" fill="#94a3b8">Sin información</text>`;

      return `
        <path d="${line}" fill="none" stroke="${group.color}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>
        <circle cx="${dot.x}" cy="${dot.y}" r="4.8" fill="${group.color}" stroke="#fff" stroke-width="1.8"/>
        <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="#fff" stroke="${group.color}" stroke-opacity=".35"/>
        <rect x="${x}" y="${y}" width="${w}" height="24" rx="12" fill="${group.color}"/>
        <rect x="${x}" y="${y + 15}" width="${w}" height="9" fill="${group.color}"/>
        <text x="${x + w / 2}" y="${y + 16.5}" text-anchor="middle" font-size="9" font-weight="bold" fill="#fff">${escapeXml(title)}</text>
        ${bodyMarkup}
        <circle cx="${badge.x}" cy="${badge.y}" r="13" fill="#fff" stroke="${group.color}" stroke-width="2"/>
        ${renderIconSvg(icon, badge.x, badge.y, group.color)}
      `;
    }).join('');

    const donutArcs = `
      <path d="M 420 134 A 68 68 0 0 1 536 134" fill="none" stroke="#173f96" stroke-width="9"/>
      <path d="M 536 134 A 68 68 0 0 1 546 210" fill="none" stroke="#3a9626" stroke-width="9"/>
      <path d="M 546 210 A 68 68 0 0 1 478 253" fill="none" stroke="#ea6a0a" stroke-width="9"/>
      <path d="M 478 253 A 68 68 0 0 1 410 185" fill="none" stroke="#0891a5" stroke-width="9"/>
      <path d="M 410 185 A 68 68 0 0 1 420 134" fill="none" stroke="#92278f" stroke-width="9"/>
    `;

    const centerCircle = `
      <circle cx="${cx}" cy="${cy}" r="58" fill="#fff" stroke="#f1f5f9"/>
      <text x="${cx}" y="${cy - 18}" text-anchor="middle" font-size="9" font-weight="bold" fill="#082b66" letter-spacing="1">TOTAL</text>
      <text x="${cx}" y="${cy - 3}" text-anchor="middle" font-size="12" font-weight="900" fill="#082b66" letter-spacing="0.5">PROGRAMAS</text>
      <text x="${cx}" y="${cy + 25}" text-anchor="middle" font-size="25" font-weight="900" fill="${scopeColor}">${format.format(rows.length)}</text>
    `;

    body = `<g>${donutArcs}${centerCircle}${cardsMarkup}</g>`;
  } else if (view === 'orbit') {
    let currentY = 44;
    const cardGap = 12;
    const circleCenterX = Math.round(width * 0.195);
    const badgeX = Math.round(width * 0.41);
    const cardX = Math.round(width * 0.43);
    const cardWidth = Math.max(260, width - cardX - 18);

    const cardLayouts = groups.map((group) => {
      const itemsCount = Math.max(1, group.items.length);
      const cardH = Math.max(62, 32 + itemsCount * 17);
      const y = currentY;
      currentY += cardH + cardGap;
      const badgeY = Math.round(y + cardH / 2);
      return { group, y, height: cardH, badgeY };
    });

    calculatedHeight = Math.max(380, currentY + 16);
    const circleCenterY = Math.round((44 + currentY - cardGap) / 2);

    const orbitCards = cardLayouts.map(({ group, y, height: cardH, badgeY }, index) => {
      const angle = (index - 2) * 20 * (Math.PI / 180);
      const circleEdgeX = Math.round(circleCenterX + 100 * Math.cos(angle));
      const circleEdgeY = Math.round(circleCenterY + 100 * Math.sin(angle));
      const iconType = group.icon || 'bank';
      return `<polyline points="${circleEdgeX},${circleEdgeY} ${badgeX - 25},${badgeY} ${badgeX},${badgeY}" fill="none" stroke="${group.color}" stroke-width="2"/><circle cx="${circleEdgeX}" cy="${circleEdgeY}" r="5" fill="${group.color}" stroke="#fff" stroke-width="2"/><circle cx="${badgeX}" cy="${badgeY}" r="16" fill="${group.color}" stroke="#fff" stroke-width="2.5"/><circle cx="${badgeX}" cy="${badgeY}" r="16" fill="none" stroke="${group.color}" stroke-width="1.2"/>${renderIconSvg(iconType, badgeX, badgeY, '#ffffff')}${card(group, cardX, y, cardWidth, cardH, true)}`;
    }).join('');

    body = `<circle cx="${circleCenterX}" cy="${circleCenterY}" r="100" fill="#fff" stroke="#aeb9c7" stroke-width="1.8" stroke-dasharray="5 4"/><circle cx="${circleCenterX}" cy="${circleCenterY}" r="83" fill="#f8fafc" stroke="#d7e0eb"/><path d="M${circleCenterX - 22} ${circleCenterY - 40}l22-12 22 12-22 12zM${circleCenterX - 16} ${circleCenterY - 31}v13h32v-13M${circleCenterX - 9} ${circleCenterY - 16}v8h18v-8" fill="none" stroke="#082b66" stroke-width="3" stroke-linejoin="round"/><text x="${circleCenterX}" y="${circleCenterY + 13}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#082b66">OFERTA DE PROGRAMAS</text><text x="${circleCenterX}" y="${circleCenterY + 29}" text-anchor="middle" font-size="10.5" font-weight="bold" fill="#082b66">ACADÉMICOS</text><rect x="${circleCenterX - 29}" y="${circleCenterY + 41}" width="58" height="26" rx="8" fill="${scopeColor}"/><text x="${circleCenterX}" y="${circleCenterY + 59}" text-anchor="middle" font-size="16" font-weight="bold" fill="#fff">${format.format(rows.length)}</text>${orbitCards}`;
  } else if (view === 'panel') {
    const positions = [[12, 48, 460, 112], [482, 48, 460, 112], [12, 172, 302, 158], [326, 172, 302, 158], [640, 172, 302, 158]];
    body = groups.map((group, index) => card(group, ...positions[index])).join('');
  } else if (view === 'executive') {
    const positions = [[12, 84, 460, 105], [482, 84, 460, 105], [12, 201, 302, 124], [326, 201, 302, 124], [640, 201, 302, 124]];
    body = `<path d="M18 37H890L940 61L890 85H18Z" fill="#082b66"/><text x="42" y="65" font-size="10" font-weight="bold" fill="#fff">TOTAL DE PROGRAMAS ANALIZADOS</text><rect x="415" y="46" width="72" height="30" rx="5" fill="#fff"/><text x="451" y="67" text-anchor="middle" font-size="17" font-weight="bold" fill="#082b66">${format.format(rows.length)}</text>${groups.map((group, index) => card(group, ...positions[index], true)).join('')}`;
  } else {
    // VISTA SECUENCIAL (Compact layout matching UI data, with no duplicate inner header titles)
    const cardWidth = 174;
    const marginX = 18;
    const gap = 16;
    const cardY = 98;

    const maxItems = Math.max(...groups.map((g) => g.items.length || 1));
    const cardHeight = Math.max(125, 30 + maxItems * 22);
    calculatedHeight = cardY + cardHeight + 10;

    const headerMarkup = `
      <rect x="${width / 2 - 75}" y="10" width="150" height="20" rx="10" fill="#082b66"/>
      <text x="${width / 2}" y="23.5" text-anchor="middle" font-size="8.5" font-weight="bold" fill="#fff">${format.format(rows.length)} programas analizados</text>
      <line x1="105" y1="86" x2="850" y2="86" stroke="#aeb9c8" stroke-width="2"/>
    `;

    const nodesMarkup = groups.map((group, index) => {
      const cx = marginX + index * (cardWidth + gap) + cardWidth / 2;
      const x = cx - cardWidth / 2;
      const iconType = group.icon || 'bank';

      // Hexagon polygon (centered at cx, top y=33, height=44)
      const hexPoints = `${cx - 13},33 ${cx + 13},33 ${cx + 22},55 ${cx + 13},77 ${cx - 13},77 ${cx - 22},55`;
      const hexagon = `<polygon points="${hexPoints}" fill="${group.color}"/><g transform="translate(0, 0)">${renderIconSvg(iconType, cx, 55, '#ffffff')}</g>`;

      // Connector line & Dot on line at y=86
      const connectorLine = `<line x1="${cx}" y1="77" x2="${cx}" y2="98" stroke="${group.color}" stroke-width="2"/>`;
      const dot = `<circle cx="${cx}" cy="86" r="6" fill="${group.color}" stroke="#ffffff" stroke-width="2"/>`;

      // Card below
      const items = group.items;
      const itemsMarkup = items.length ? items.map((item, itemIdx) => {
        const iy = cardY + 34 + itemIdx * 20;
        const itemLabel = text(item.label).length > 24 ? `${text(item.label).slice(0, 23)}…` : text(item.label);
        return `<circle cx="${x + 10}" cy="${iy - 3}" r="2.2" fill="${group.color}"/><text x="${x + 17}" y="${iy}" font-size="7.8" font-weight="bold" fill="#334155">${escapeXml(itemLabel)}</text><rect x="${x + cardWidth - 38}" y="${iy - 9}" width="30" height="13" rx="3" fill="#fcfdff" stroke="#bdc8d6"/><text x="${x + cardWidth - 23}" y="${iy + 1}" text-anchor="middle" font-size="8" font-weight="900" fill="#102a4c">${format.format(item.value)}</text>`;
      }).join('') : `<text x="${cx}" y="${cardY + cardHeight / 2}" text-anchor="middle" font-size="8.5" fill="#94a3b8">Sin información</text>`;

      const cardBox = `
        <rect x="${x}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="10" fill="#ffffff" stroke="${group.color}" stroke-opacity=".6" stroke-width="1.3"/>
        <text x="${cx}" y="${cardY + 16}" text-anchor="middle" font-size="8.5" font-weight="900" fill="${group.color}">${escapeXml(group.title)}</text>
        ${itemsMarkup}
      `;

      return `<g>${hexagon}${connectorLine}${dot}${cardBox}</g>`;
    }).join('');

    body = `<g>${headerMarkup}${nodesMarkup}</g>`;
  }

  if (view === 'radial') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${calculatedHeight}" viewBox="0 0 ${width} ${calculatedHeight}" preserveAspectRatio="xMidYMid meet"><rect width="100%" height="100%" fill="#ffffff"/><g>${body}</g></svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${calculatedHeight}" viewBox="0 0 ${width} ${calculatedHeight}" preserveAspectRatio="xMidYMid meet"><rect x=".5" y=".5" width="${width - 1}" height="${calculatedHeight - 1}" rx="15" fill="#f8fbff" stroke="#cbd9ea"/><rect x="1" y="1" width="6" height="${calculatedHeight - 2}" rx="3" fill="${scopeColor}"/><g>${body}</g></svg>`;
};

const offerSingleProgramTableSvg = ({ rows, scope = 'Nacional', width = 580 }) => {
  const maxVisibleRows = 10;
  const summarizeRows = (r) => r.length <= maxVisibleRows ? r : [
    ...r.slice(0, maxVisibleRows - 1),
    {
      label: `OTROS ${r.length - maxVisibleRows + 1} PROGRAMAS`,
      value: r.slice(maxVisibleRows - 1).reduce((total, row) => total + number(row.value), 0)
    }
  ];
  const visibleRows = summarizeRows(rows);
  const color = scope.toLowerCase() === 'regional' ? RED : '#082b66';
  const title = scope.toLowerCase() === 'regional' ? 'OFERTA REGIONAL' : 'OFERTA NACIONAL';
  const total = rows.reduce((acc, row) => acc + number(row.value), 0);

  const splitLabel = (str, maxLen = 54) => {
    const clean = text(str);
    if (clean.length <= maxLen) return [clean];
    const words = clean.split(/\s+/);
    let line1 = '';
    let line2 = '';
    words.forEach((w) => {
      if ((line1 ? line1 + ' ' + w : w).length <= maxLen && !line2) {
        line1 = line1 ? line1 + ' ' + w : w;
      } else {
        line2 = line2 ? line2 + ' ' + w : w;
      }
    });
    if (!line2) return [line1];
    return [line1, line2];
  };

  const createPanelData = ({ x, y = 6, color, title, rows, totalValue, panelWidth = 576 }) => {
    const headerY = y;
    const columnY = y + 42;
    const rowsY = y + 68;
    let currentY = rowsY;

    const rowMarkup = rows.length ? rows.map((row, index) => {
      const label = text(row.label);
      const lines = splitLabel(label, 54);
      const isMultiLine = lines.length > 1;
      const rh = isMultiLine ? 34 : 22;
      const ry = currentY;
      currentY += rh;
      const fill = index % 2 ? '#f7f9fc' : '#ffffff';

      const labelMarkup = isMultiLine
        ? `<text x="${x + 14}" y="${ry + 13}" font-size="7.5" font-weight="bold" fill="#203b5d">${escapeXml(lines[0])}</text><text x="${x + 14}" y="${ry + 25}" font-size="7.5" font-weight="bold" fill="#203b5d">${escapeXml(lines[1])}</text>`
        : `<text x="${x + 14}" y="${ry + 15}" font-size="7.5" font-weight="bold" fill="#203b5d">${escapeXml(label)}</text>`;

      const badgeY = ry + (rh - 15) / 2;
      const badgeTextY = badgeY + 10.5;

      return `<rect x="${x + 1}" y="${ry}" width="${panelWidth - 2}" height="${rh}" fill="${fill}"/><line x1="${x + 1}" y1="${ry + rh}" x2="${x + panelWidth - 1}" y2="${ry + rh}" stroke="#e4eaf2"/>${labelMarkup}<rect x="${x + panelWidth - 51}" y="${badgeY}" width="37" height="15" rx="6" fill="${color}" fill-opacity=".09"/><text x="${x + panelWidth - 32.5}" y="${badgeTextY}" text-anchor="middle" font-size="7.5" font-weight="bold" fill="${color}">${format.format(row.value)}</text>`;
    }).join('') : `<rect x="${x + 1}" y="${rowsY}" width="${panelWidth - 2}" height="24" fill="#fff"/><text x="${x + panelWidth / 2}" y="${rowsY + 15.5}" text-anchor="middle" font-size="7.5" fill="#94a3b8">Sin registros para este alcance</text>`;

    const adjustedTotalY = rows.length ? currentY : rowsY + 24;
    const totalRowHeight = 28;
    const adjustedPanelHeight = adjustedTotalY + totalRowHeight - headerY;
    const totalCount = number(totalValue);

    const svg = `<g><rect x="${x}" y="${headerY}" width="${panelWidth}" height="${adjustedPanelHeight}" rx="13" fill="#fff" stroke="#d5dfeb"/><path d="M${x + 13} ${headerY}H${x + panelWidth - 13}Q${x + panelWidth} ${headerY} ${x + panelWidth} ${headerY + 13}V${columnY}H${x}V${headerY + 13}Q${x} ${headerY} ${x + 13} ${headerY}Z" fill="${color}"/><text x="${x + 14}" y="${headerY + 25}" font-size="9.5" font-weight="bold" fill="#fff">${escapeXml(title)}</text><rect x="${x + panelWidth - 91}" y="${headerY + 11}" width="77" height="20" rx="10" fill="#fff" fill-opacity=".16"/><text x="${x + panelWidth - 52.5}" y="${headerY + 24.5}" text-anchor="middle" font-size="7" font-weight="bold" fill="#fff">${format.format(totalCount)} REGISTROS</text><rect x="${x + 1}" y="${columnY}" width="${panelWidth - 2}" height="26" fill="#edf3fa"/><text x="${x + 14}" y="${columnY + 17}" font-size="7" font-weight="bold" letter-spacing=".45" fill="#405674">PROGRAMAS ACADÉMICOS ANALIZADOS</text><text x="${x + panelWidth - 32}" y="${columnY + 17}" text-anchor="middle" font-size="7" font-weight="bold" fill="#405674">TOTAL</text>${rowMarkup}<rect x="${x + 1}" y="${adjustedTotalY}" width="${panelWidth - 2}" height="${totalRowHeight}" fill="${color}" fill-opacity=".08"/><text x="${x + 14}" y="${adjustedTotalY + 18}" font-size="8" font-weight="bold" fill="#102f59">TOTAL GENERAL</text><text x="${x + panelWidth - 32}" y="${adjustedTotalY + 18}" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${color}">${format.format(totalCount)}</text></g>`;

    return { svg, height: adjustedPanelHeight };
  };

  const panel = createPanelData({ x: 2, y: 6, color, title, rows: visibleRows, totalValue: total, panelWidth: width - 4 });
  const calculatedHeight = panel.height + 14;

  return {
    height: calculatedHeight,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${calculatedHeight}" viewBox="0 0 ${width} ${calculatedHeight}" preserveAspectRatio="xMidYMid meet"><rect width="${width}" height="${calculatedHeight}" rx="14" fill="#f6f9fd"/>${panel.svg}</svg>`
  };
};

const offerPage = ({ rows, regionalRows, program, view, aiAnalysis = {} }) => {
  const analyzedPrograms = labelCountRows(rows, 'nombre_programa');
  const regionalPrograms = labelCountRows(regionalRows, 'nombre_programa');
  const nationalTable = offerSingleProgramTableSvg({ rows: analyzedPrograms, scope: 'Nacional', width: 690 });
  const regionalTable = offerSingleProgramTableSvg({ rows: regionalPrograms, scope: 'Regional', width: 690 });
  const tablesAnalysisText = aiAnalysis.offer_tables || aiAnalysis.oferta_tablas || generateOfferTablesAnalysis(analyzedPrograms, regionalPrograms);

  return [
    ...sectionHeader('PROGRAMAS ACADÉMICOS SIMILARES · OFERTA NACIONAL', program),
    { svg: nationalTable.svg, width: 690, alignment: 'center', margin: [0, 4, 0, 8] },
    { text: '', pageBreak: 'before' },
    ...sectionHeader('PROGRAMAS ACADÉMICOS SIMILARES · OFERTA NACIONAL', program),
    ...aiAnalysisBox(tablesAnalysisText),
    { text: '', pageBreak: 'before' },
    ...sectionHeader('PROGRAMAS ACADÉMICOS SIMILARES · OFERTA REGIONAL', program),
    { svg: regionalTable.svg, width: 690, alignment: 'center', margin: [0, 4, 0, 8] },
    { text: '', pageBreak: 'before' },
    ...sectionHeader('PROGRAMAS ACADÉMICOS SIMILARES · OFERTA REGIONAL', program),
    ...aiAnalysisBox(tablesAnalysisText),
    { text: '', pageBreak: 'before' },
    ...sectionHeader('ANÁLISIS DE CONTEXTO EXTERNO · OFERTA NACIONAL', program),
    { svg: offerSummaryVisualSvg({ rows, view, scope: 'Nacional', program, width: 690 }), width: 690, alignment: 'center', margin: [0, 4, 0, 8] },
    { text: '', pageBreak: 'before' },
    ...sectionHeader('ANÁLISIS DE CONTEXTO EXTERNO · OFERTA NACIONAL', program),
    ...aiAnalysisBox(
      aiAnalysis.offer_nacional || aiAnalysis.oferta_nacional || generateOfferAnalysis(rows, regionalRows, 'Nacional')
    ),
    { text: '', pageBreak: 'before' },
    ...sectionHeader('ANÁLISIS DE CONTEXTO EXTERNO · OFERTA REGIONAL', program),
    { svg: offerSummaryVisualSvg({ rows: regionalRows, view, scope: 'Regional', program, width: 690 }), width: 690, alignment: 'center', margin: [0, 4, 0, 8] },
    { text: '', pageBreak: 'before' },
    ...sectionHeader('ANÁLISIS DE CONTEXTO EXTERNO · OFERTA REGIONAL', program),
    ...aiAnalysisBox(
      aiAnalysis.offer_regional || aiAnalysis.oferta_regional || generateOfferAnalysis(rows, regionalRows, 'Regional')
    )
  ];
};

const singleMetricCardsChartSvg = ({ data, series, width = 580, height = 300, scope = '', annual = false }) => {
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

const singleMetricSpecialChartSvg = ({ data, series, type, width = 580, height = 285, scope = '' }) => {
  const item = series[0];
  const periodRows = data.map((row) => ({ periodo: text(row.periodo), value: number(row[item.key]) })).filter((row) => row.value > 0);
  if (!periodRows.length) return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#fff"/><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="11" fill="#64748b">No existen datos para el alcance seleccionado.</text></svg>`;
  const annualRows = periodRows.map((row) => ({ ...row, periodo: periodLabel(row.periodo) }));
  const titles = {
    funnel: [`${item.label.toUpperCase()} · EMBUDO COMPARATIVO`, 'Comparación proporcional entre los períodos visibles.'],
    indicators: [`${item.label.toUpperCase()} · TABLERO DE INDICADORES`, 'Resumen ejecutivo calculated con el alcance seleccionado.'],
    journey: [`${item.label.toUpperCase()} · CAMINO HISTÓRICO`, 'Trayectoria por período y cambios de dirección del indicador.'],
    conversion: [`${item.label.toUpperCase()} · ÍNDICES DE EVOLUCIÓN`, 'El primer período visible representa la base 100.'],
    stackedArea: [`${item.label.toUpperCase()} · ÁREA ACUMULADA`, 'Magnitud de cada período representada como una superficie continua.']
  };
  const [title, subtitle] = titles[type];
  const frame = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="13" fill="#fbfdff" stroke="#cbd9ea"/><text x="18" y="23" font-size="11" font-weight="bold" fill="#0f172a">${escapeXml(title)}</text><text x="18" y="38" font-size="7.5" fill="#64748b">${escapeXml(subtitle)}</text><rect x="${width - 82}" y="14" width="64" height="20" rx="10" fill="${item.color}"/><text x="${width - 50}" y="27.5" text-anchor="middle" font-size="8" font-weight="bold" fill="#fff">${escapeXml(scope)}</text>${body}</svg>`;
  if (type === 'indicators') {
    const values = periodRows.map((row) => row.value); const latest = values[values.length - 1]; const previous = values[values.length - 2] || 0; const variation = previous > 0 ? (latest - previous) / previous * 100 : 0;
    const cardW = (width - 28 - 2 * 14) / 3;
    const cards = [['ÚLTIMO PERÍODO', latest, item.color], ['TOTAL ACUMULADO', values.reduce((a, b) => a + b, 0), '#123b7a'], ['PROMEDIO', Math.round(values.reduce((a, b) => a + b, 0) / values.length), '#0f766e'], ['VALOR MÁXIMO', Math.max(...values), '#15803d'], ['VALOR MÍNIMO', Math.min(...values), '#b45309'], ['VARIACIÓN RECIENTE', `${variation >= 0 ? '+' : ''}${variation.toFixed(1).replace('.', ',')}%`, variation >= 0 ? '#15803d' : '#dc2626']].map(([label, value, color], index) => { const x = 14 + (index % 3) * (cardW + 14); const y = 62 + Math.floor(index / 3) * 94; return `<rect x="${x}" y="${y}" width="${cardW}" height="82" rx="10" fill="#fff" stroke="#d7e1ed"/><rect x="${x}" y="${y}" width="5" height="82" rx="2.5" fill="${color}"/><text x="${x + 16}" y="${y + 25}" font-size="6.5" font-weight="bold" fill="#64748b">${escapeXml(label)}</text><text x="${x + 16}" y="${y + 57}" font-size="15" font-weight="bold" fill="${color}">${escapeXml(typeof value === 'number' ? format.format(value) : value)}</text>`; }).join('');
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
  const points = rows.map((row, index) => `${x(index)},${y(row.value)}`).join(' '); const labels = rows.map((row, index) => `<circle cx="${x(index)}" cy="${y(row.value)}" r="${type === 'journey' ? 7 : 3.5}" fill="${item.color}" stroke="#fff" stroke-width="1.5"/><text x="${x(index)}" y="${y(row.value) - 10}" text-anchor="middle" font-size="6" font-weight="bold" fill="${item.color}" stroke="#fff" stroke-width="2" paint-order="stroke">${escapeXml(format.format(row.value))}</text><text x="${x(index)}" y="${height - 17}" text-anchor="middle" font-size="6" font-weight="bold" fill="${315275}">${escapeXml(row.periodo.replace('-', '·'))}</text>`).join('');
  if (type === 'journey') return frame(`<polyline points="${points}" fill="none" stroke="${item.color}" stroke-opacity=".15" stroke-width="14" stroke-linejoin="miter"/><polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.4" stroke-linejoin="miter"/>${labels}`);
  return frame(`<polygon points="${left},${bottom} ${points} ${right},${bottom}" fill="${item.color}" fill-opacity=".76"/><polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="2.5" stroke-linejoin="miter"/>${labels}`);
};

const populationPage = ({ title, program, data, charts, selection = {}, pageBreak = false, aiAnalysis = {}, aiGroup = 'ingreso' }) => {
  const selectedScope = text(selection.scope || 'nacional').toLowerCase();
  if (selectedScope === 'ambos') {
    return charts.flatMap((item, index) => populationPage({
      title: `${title} · ${text(item.scope).toUpperCase()}`,
      program,
      data,
      charts,
      selection: { ...selection, scope: text(item.scope).toLowerCase() },
      pageBreak: pageBreak || index > 0,
      aiAnalysis,
      aiGroup
    }));
  }
  const chart = charts.find((item) => text(item.scope).toLowerCase() === selectedScope) || charts[0];
  const scopeName = text(chart.scope).toLowerCase();
  const analysisKey = `${aiGroup}_${scopeName}`;
  const customAnalysisText = aiAnalysis[analysisKey];

  let defaultAnalysisText = '';
  if (aiGroup === 'ingreso') {
    defaultAnalysisText = generateIntakeAnalysis(data, chart.scope);
  } else if (aiGroup === 'matriculados') {
    defaultAnalysisText = generateEnrolledAnalysis(data, chart.scope);
  } else if (aiGroup === 'graduados') {
    defaultAnalysisText = generateGraduateAnalysis(data, chart.scope);
  }

  const requestedType = text(selection.chartType || 'stacked');
  const supportedType = chart.funnelSeries
    ? requestedType
    : ['stacked', 'trend', 'funnel', 'indicators', 'shaded', 'bubbles', 'periodCards', 'journey', 'timeline', 'conversion', 'stackedArea'].includes(requestedType) ? requestedType : 'stacked';
  const styledSeries = (colors, softColors = []) => chart.funnelSeries.map((item, index) => ({ ...item, color: colors[index], soft: softColors[index] }));
  let height = 260;
  let svg;
  const chartWidth = 690;

  if (supportedType === 'trend') {
    svg = trendLineChartSvg({ data, series: chart.trendSeries || chart.series, width: chartWidth, height, subtitle: chart.trendSubtitle || chart.subtitle, scope: chart.scope });
  } else if (supportedType === 'funnel') {
    height = 310;
    svg = chart.funnelSeries
      ? funnelChartSvg({ data, series: chart.funnelSeries, width: chartWidth, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'indicators') {
    height = 295;
    svg = chart.funnelSeries
      ? indicatorTrendBoardSvg({ data, series: styledSeries(['#123b7a', '#1f67bd', '#239447'], ['#eaf1fb', '#eaf4ff', '#ecf8ef']), width: chartWidth, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'shaded') {
    height = chart.funnelSeries ? 285 : 180;
    svg = shadedTrendChartSvg({ data, series: chart.funnelSeries ? styledSeries(['#123b7a', '#2f6fed', '#239447']) : chart.series, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'bubbles') {
    height = chart.funnelSeries ? 260 : 180;
    svg = bubbleMatrixChartSvg({ data, series: chart.funnelSeries ? styledSeries(['#123b7a', '#2f6fed', '#27a861'], ['#edf3fb', '#eff5ff', '#edf9f1']) : chart.series, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'periodCards') {
    height = chart.funnelSeries ? 350 : 300;
    svg = chart.funnelSeries
      ? periodCardsChartSvg({ data, series: styledSeries(['#123b7a', '#1593a5', '#239447']), width: chartWidth, height, scope: chart.scope })
      : singleMetricCardsChartSvg({ data, series: chart.series, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'journey') {
    height = 285;
    svg = chart.funnelSeries
      ? studentJourneyChartSvg({ data, series: styledSeries(['#123b7a', '#2f6fed', '#239447'], ['#edf3fb', '#eff5ff', '#edf9f1']), width: chartWidth, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'timeline') {
    height = 300;
    svg = chart.funnelSeries
      ? annualTimelineChartSvg({ data, series: styledSeries(['#123b7a', '#2f6fed', '#239447']), width: chartWidth, height, scope: chart.scope })
      : singleMetricCardsChartSvg({ data, series: chart.series, width: chartWidth, height, scope: chart.scope, annual: true });
  } else if (supportedType === 'conversion') {
    height = 340;
    svg = chart.funnelSeries
      ? conversionIndicatorsChartSvg({ data, series: styledSeries(['#123b7a', '#2f6fed', '#239447']), width: chartWidth, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: chartWidth, height, scope: chart.scope });
  } else if (supportedType === 'stackedArea') {
    height = 330;
    svg = chart.funnelSeries
      ? stackedAreaChartSvg({ data, series: chart.funnelSeries, width: chartWidth, height, scope: chart.scope })
      : singleMetricSpecialChartSvg({ data, series: chart.series, type: supportedType, width: chartWidth, height, scope: chart.scope });
  } else {
    svg = stackedBarChartSvg({ data, series: chart.series, width: chartWidth, height, title: chart.title, subtitle: chart.subtitle, scope: chart.scope });
  }

  return [
    ...(pageBreak ? [{ text: '', pageBreak: 'before' }] : []),
    ...sectionHeader(title, program),
    { svg, width: 690, alignment: 'center', margin: [0, 4, 0, 8] },
    { text: '', pageBreak: 'before' },
    ...sectionHeader(title, program),
    ...aiAnalysisBox(customAnalysisText || defaultAnalysisText)
  ];
};

const generateContextoExternoGeneralPdf = async ({ program, oferta = [], poblacional = [], section = 'completo', populationGroup = 'ingreso', visualizations = {}, offerView = 'sequence', aiAnalysis = {} }) => {
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
      ],
      aiAnalysis,
      aiGroup: 'ingreso'
    }),
    matriculados: populationPage({
      title: 'MATRICULADOS', program, data: enrolledData, selection: section === 'completo' ? { ...visualizations.matriculados, scope: 'ambos' } : visualizations.matriculados,
      charts: [
        { title: 'Matriculados por período', subtitle: 'Evolución de estudiantes matriculados según el alcance seleccionado.', scope: 'Nacional', series: [{ key: 'matriculados_nacional', label: 'Matriculados', color: '#2f6fed' }] },
        { title: 'Matriculados por período', subtitle: 'Evolución de estudiantes matriculados según el alcance seleccionado.', scope: 'Regional', series: [{ key: 'matriculados_regional', label: 'Matriculados', color: '#b5123f' }] }
      ],
      aiAnalysis,
      aiGroup: 'matriculados'
    }),
    graduados: populationPage({
      title: 'GRADUADOS', program, data: graduateData, selection: section === 'completo' ? { ...visualizations.graduados, scope: 'ambos' } : visualizations.graduados,
      charts: [
        { title: 'Graduados por período', subtitle: 'Evolución de graduados según el alcance seleccionado.', scope: 'Nacional', series: [{ key: 'graduados_nacional', label: 'Graduados', color: '#173f96' }] },
        { title: 'Graduados por período', subtitle: 'Evolución de graduados según el alcance seleccionado.', scope: 'Regional', series: [{ key: 'graduados_regional', label: 'Graduados', color: '#b5123f' }] }
      ],
      aiAnalysis,
      aiGroup: 'graduados'
    })
  };
  const offerContent = [
    ...offerPage({ rows: nationalOffer, regionalRows: regionalOffer, program, view: offerView, aiAnalysis }),
    ...geographyPages({ rows: nationalOffer, regionalRows: regionalOffer, program, aiAnalysis })
  ];
  const completeContent = [
    ...reportCoverPage({ program, nationalOffer, regionalOffer, aiAnalysis, poblacional }),
    ...offerContent,
    { text: '', pageBreak: 'before', pageOrientation: 'landscape' },
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
    pageSize: 'LEGAL',
    pageOrientation: 'landscape',
    pageMargins: [24, 18, 24, 20],
    defaultStyle: { font: 'ReportFont', color: '#1e293b' },
    footer: (currentPage, pageCount) => ({
      columns: [
        { text: 'Fuente: SNIES (MEN) · Realizado por: Dirección de Planeación y Aseguramiento de la Calidad', fontSize: 6.8, color: '#64748b', alignment: 'left' },
        { text: `SIAC UNICESMAG · Página ${currentPage} de ${pageCount}`, fontSize: 6.8, color: '#64748b', alignment: 'right' }
      ],
      margin: [28, 6, 28, 0]
    }),
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

module.exports = {
  generateContextoExternoGeneralPdf,
  headerPath,
  formatProgramNameSvg,
  generateCoverAnalysis,
  offerSingleProgramTableSvg,
  offerSummaryVisualSvg,
  aggregatePeriods,
  labelCountRows,
  stackedBarChartSvg,
  trendLineChartSvg,
  funnelChartSvg,
  indicatorTrendBoardSvg,
  shadedTrendChartSvg,
  bubbleMatrixChartSvg,
  periodCardsChartSvg,
  studentJourneyChartSvg,
  annualTimelineChartSvg,
  conversionIndicatorsChartSvg,
  stackedAreaChartSvg,
  singleMetricCardsChartSvg,
  singleMetricSpecialChartSvg
};
