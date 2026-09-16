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
const BLUE_LIGHT = '#2563eb';
const TEXT_MUTED = '#64748b';
const formatNumber = new Intl.NumberFormat('es-CO');

const cleanText = (val) => String(val ?? '').trim();
const normalizeNum = (val) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
};
const escapeXml = (str) =>
  cleanText(str).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

const normalizeProgramKey = (str) =>
  String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(en|de|la|el|los|las|y|afines)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Encabezado de sección
const sectionHeader = (title, programName) => [
  {
    table: {
      widths: ['*'],
      body: [
        [
          {
            text: title,
            color: '#ffffff',
            fillColor: RED,
            bold: true,
            fontSize: 10.5,
            alignment: 'center',
            margin: [0, 4, 0, 4]
          }
        ],
        [
          {
            text: `PROGRAMA ACADÉMICO: ${cleanText(programName).toUpperCase()}`,
            color: BLUE,
            fillColor: '#f1f5f9',
            bold: true,
            fontSize: 9.5,
            alignment: 'center',
            margin: [0, 3, 0, 3]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 0,
      hLineColor: () => '#cbd5e1'
    },
    margin: [0, 0, 0, 10]
  }
];

// Gráfica de barras en SVG
const barChartSvg = ({ data = [], categories = [], width = 955, height = 210, title = '' }) => {
  if (!data.length || !categories.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="60" viewBox="0 0 ${width} 60">
      <rect width="${width}" height="60" fill="#f8fafc" rx="8" stroke="#e2e8f0"/>
      <text x="${width / 2}" y="35" text-anchor="middle" font-family="Helvetica" font-size="12" fill="#94a3b8">Sin datos registrados para graficar</text>
    </svg>`;
  }

  const paddingLeft = 60;
  const paddingRight = 30;
  const paddingTop = 25;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(
    ...data.map((d) => Math.max(...categories.map((c) => normalizeNum(d[c.key])), 0)),
    10
  );

  const groupWidth = plotWidth / data.length;
  const barWidth = Math.min(Math.max((groupWidth - 16) / categories.length, 8), 36);

  let gridSvg = '';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const yVal = (maxVal / steps) * i;
    const yPos = paddingTop + plotHeight - (yVal / maxVal) * plotHeight;
    gridSvg += `<line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="#f1f5f9" stroke-width="1.2"/>`;
    gridSvg += `<text x="${paddingLeft - 8}" y="${yPos + 4}" text-anchor="end" font-family="Helvetica" font-size="9" fill="#94a3b8">${Math.round(yVal)}</text>`;
  }

  let barsSvg = '';
  data.forEach((d, idx) => {
    const groupX = paddingLeft + idx * groupWidth + (groupWidth - categories.length * barWidth) / 2;
    categories.forEach((cat, cIdx) => {
      const val = normalizeNum(d[cat.key]);
      const barH = (val / maxVal) * plotHeight;
      const x = groupX + cIdx * barWidth;
      const y = paddingTop + plotHeight - barH;
      barsSvg += `<rect x="${x}" y="${y}" width="${barWidth - 2}" height="${Math.max(barH, 0)}" fill="${cat.color}" rx="3"/>`;
      if (val > 0 && barWidth > 14) {
        barsSvg += `<text x="${x + (barWidth - 2) / 2}" y="${y - 4}" text-anchor="middle" font-family="Helvetica" font-size="8" font-weight="bold" fill="#334155">${val}</text>`;
      }
    });

    const labelX = paddingLeft + idx * groupWidth + groupWidth / 2;
    const labelY = height - 12;
    barsSvg += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-family="Helvetica" font-size="9" font-weight="bold" fill="#475569">${escapeXml(d.label || d.periodo || d.anio)}</text>`;
  });

  let legendSvg = '';
  let legX = width - paddingRight;
  [...categories].reverse().forEach((cat) => {
    legX -= 120;
    legendSvg += `<rect x="${legX}" y="6" width="10" height="10" fill="${cat.color}" rx="2"/>`;
    legendSvg += `<text x="${legX + 16}" y="15" font-family="Helvetica" font-size="9" font-weight="bold" fill="#334155">${escapeXml(cat.label)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#ffffff" rx="8" stroke="#e2e8f0"/>
    <text x="${paddingLeft}" y="16" font-family="Helvetica" font-size="11" font-weight="bold" fill="${BLUE}">${escapeXml(title)}</text>
    ${legendSvg}
    ${gridSvg}
    ${barsSvg}
  </svg>`;
};

// Gráfica de línea comparativa
const multiLineChartSvg = ({ data = [], series = [], width = 955, height = 220, title = '', yUnit = '%' }) => {
  if (!data.length || !series.length) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="60" viewBox="0 0 ${width} 60">
      <rect width="${width}" height="60" fill="#f8fafc" rx="8" stroke="#e2e8f0"/>
      <text x="${width / 2}" y="35" text-anchor="middle" font-family="Helvetica" font-size="12" fill="#94a3b8">Sin datos suficientes para graficar</text>
    </svg>`;
  }

  const paddingLeft = 55;
  const paddingRight = 35;
  const paddingTop = 32;
  const paddingBottom = 40;
  const plotWidth = width - paddingLeft - paddingRight;
  const plotHeight = height - paddingTop - paddingBottom;

  let maxVal = 0;
  data.forEach((d) => {
    series.forEach((s) => {
      const v = normalizeNum(d[s.key]);
      if (v > maxVal) maxVal = v;
    });
  });
  if (maxVal === 0) maxVal = 10;
  maxVal = Math.ceil(maxVal * 1.15);

  const stepX = data.length > 1 ? plotWidth / (data.length - 1) : plotWidth / 2;

  let gridSvg = '';
  const steps = 4;
  for (let i = 0; i <= steps; i++) {
    const yVal = (maxVal / steps) * i;
    const yPos = paddingTop + plotHeight - (yVal / maxVal) * plotHeight;
    gridSvg += `<line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="#f1f5f9" stroke-width="1.2"/>`;
    gridSvg += `<text x="${paddingLeft - 8}" y="${yPos + 3.5}" text-anchor="end" font-family="Helvetica" font-size="9" fill="#94a3b8">${yVal.toFixed(1)}${yUnit}</text>`;
  }

  let linesSvg = '';
  series.forEach((s) => {
    const points = [];
    data.forEach((d, idx) => {
      const val = normalizeNum(d[s.key]);
      const x = data.length > 1 ? paddingLeft + idx * stepX : paddingLeft + plotWidth / 2;
      const y = paddingTop + plotHeight - (val / maxVal) * plotHeight;
      points.push({ x, y, val });
    });

    if (points.length > 1) {
      const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
      linesSvg += `<path d="${pathD}" fill="none" stroke="${s.color}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`;
    }

    points.forEach((p) => {
      linesSvg += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="#ffffff" stroke="${s.color}" stroke-width="2.4"/>`;
      if (p.val > 0) {
        linesSvg += `<text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-family="Helvetica" font-size="8.5" font-weight="bold" fill="${s.color}">${p.val.toFixed(1)}${yUnit}</text>`;
      }
    });
  });

  data.forEach((d, idx) => {
    const x = data.length > 1 ? paddingLeft + idx * stepX : paddingLeft + plotWidth / 2;
    linesSvg += `<text x="${x.toFixed(1)}" y="${height - 12}" text-anchor="middle" font-family="Helvetica" font-size="9" font-weight="bold" fill="#475569">${escapeXml(d.label || d.periodo || d.anio)}</text>`;
  });

  let legendSvg = '';
  let legX = width - paddingRight;
  [...series].reverse().forEach((s) => {
    legX -= 140;
    legendSvg += `<line x1="${legX}" y1="12" x2="${legX + 16}" y2="12" stroke="${s.color}" stroke-width="3"/>`;
    legendSvg += `<circle cx="${legX + 8}" cy="12" r="3.5" fill="#fff" stroke="${s.color}" stroke-width="2"/>`;
    legendSvg += `<text x="${legX + 22}" y="15" font-family="Helvetica" font-size="8.5" font-weight="bold" fill="#334155">${escapeXml(s.label)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#ffffff" rx="8" stroke="#e2e8f0"/>
    <text x="${paddingLeft}" y="16" font-family="Helvetica" font-size="11" font-weight="bold" fill="${BLUE}">${escapeXml(title)}</text>
    ${legendSvg}
    ${gridSvg}
    ${linesSvg}
  </svg>`;
};

// Diagrama de embudo poblacional SVG
const funnelSvg = ({ stages = [], width = 955, height = 100 }) => {
  if (!stages.length) return '';
  const cardWidth = (width - 40 - (stages.length - 1) * 16) / stages.length;

  let contentSvg = '';
  stages.forEach((st, idx) => {
    const x = 20 + idx * (cardWidth + 16);
    contentSvg += `
      <g transform="translate(${x}, 8)">
        <rect width="${cardWidth}" height="84" rx="8" fill="${st.bg || '#f8fafc'}" stroke="${st.color || '#cbd5e1'}" stroke-width="1.5"/>
        <rect x="0" y="0" width="${cardWidth}" height="4.5" rx="2" fill="${st.color || '#2563eb'}"/>
        <text x="12" y="22" font-family="Helvetica" font-size="8" font-weight="bold" fill="${st.color || '#2563eb'}" letter-spacing="0.5">${escapeXml(st.label.toUpperCase())}</text>
        <text x="12" y="50" font-family="Helvetica" font-size="18" font-weight="bold" fill="#0f172a">${formatNumber.format(st.value)}</text>
        <text x="12" y="68" font-family="Helvetica" font-size="8" fill="#64748b">${escapeXml(st.sub || '')}</text>
      </g>
    `;

    if (idx < stages.length - 1) {
      const arrowX = x + cardWidth + 2;
      contentSvg += `
        <path d="M ${arrowX} 48 L ${arrowX + 8} 51 L ${arrowX} 54" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
      `;
    }
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#ffffff" rx="8" stroke="#e2e8f0"/>
    ${contentSvg}
  </svg>`;
};

// Generador del documento completo
const generateInformeIntegralProgramaPdf = async ({
  program,
  programMeta = {},
  poblacionalFlow = {},
  flujoAdmision = {},
  matriculadosData = {},
  graduadosData = {},
  caracterizacionData = {},
  desercionData = {},
  empleabilidadData = {},
  contextoExternoData = {},
  saberProData = {}
}) => {
  const content = [];

  // 1. Portada ejecutiva
  content.push({
    table: {
      widths: ['*'],
      body: [
        [
          {
            fillColor: BLUE,
            margin: [0, 0, 0, 0],
            stack: [
              {
                text: 'SISTEMA INTEGRADO DE ASEGURAMIENTO DE LA CALIDAD (SIAC)',
                color: '#93c5fd',
                fontSize: 9,
                bold: true,
                alignment: 'center',
                margin: [0, 12, 0, 4]
              },
              {
                text: 'INFORME INTEGRAL INSTITUCIONAL POR PROGRAMA ACADÉMICO',
                color: '#ffffff',
                fontSize: 16,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 6]
              },
              {
                text: cleanText(program).toUpperCase(),
                color: '#fbbf24',
                fontSize: 18,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 8]
              },
              {
                text: `Facultad: ${cleanText(programMeta.faculty || 'Institucional')}   |   Nivel: ${cleanText(programMeta.level || 'Pregrado')}   |   Código SNIES: ${cleanText(programMeta.snies || 'N/A')}   |   Fecha de Emisión: ${new Date().toLocaleDateString('es-CO')}`,
                color: '#e2e8f0',
                fontSize: 8.5,
                alignment: 'center',
                margin: [0, 0, 0, 12]
              }
            ]
          }
        ]
      ]
    },
    layout: 'noBorders',
    margin: [0, 0, 0, 10]
  });

  // KPIs de portada
  const kpisPortada = [
    { label: 'MATRÍCULA VIGENTE', value: matriculadosData.totalMatriculados || 0, sub: 'Estudiantes activos registrados', color: BLUE },
    { label: 'DEMANDA HISTÓRICA', value: flujoAdmision.totalInscritos || 0, sub: 'Inscritos acumulados', color: '#059669' },
    { label: 'EGRESADOS TOTALES', value: graduadosData.totalEgresadosStock || graduadosData.totalGraduados || 0, sub: 'Acervo total de egresados', color: '#7c3aed' },
    { label: 'TASA SELECTIVIDAD', value: `${(flujoAdmision.tasaSelectividadPromedio || 0).toFixed(1)}%`, sub: 'Admitidos / Inscritos prom.', color: '#d97706' },
    { label: 'EMPLEABILIDAD', value: `${(empleabilidadData.tasaProgramaReciente || 0).toFixed(1)}%`, sub: 'Vinculación laboral reciente', color: '#0891b2' },
    { label: 'SABER PRO (GLOBAL)', value: (saberProData.puntajeGlobalReciente || 0).toFixed(1), sub: `vs Inst: ${(saberProData.puntajeGlobalInstReciente || 0).toFixed(1)}`, color: RED }
  ];

  const kpiTableBody = [
    kpisPortada.map((k) => ({
      fillColor: '#ffffff',
      margin: [5, 5, 5, 5],
      stack: [
        { text: k.label, color: k.color, fontSize: 7, bold: true },
        { text: typeof k.value === 'number' ? formatNumber.format(k.value) : k.value, fontSize: 14, bold: true, color: '#0f172a', margin: [0, 2, 0, 2] },
        { text: k.sub, fontSize: 6.5, color: TEXT_MUTED }
      ]
    }))
  ];

  content.push({
    table: {
      widths: ['16.6%', '16.6%', '16.6%', '16.6%', '16.6%', '16.6%'],
      body: kpiTableBody
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0'
    },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 1: Resumen Poblacional
  content.push(...sectionHeader('1. RESUMEN POBLACIONAL UNICESMAG — FLUJO DEL EMBUDO ESTUDIANTIL', program));
  const stages = [
    { label: 'Inscritos', value: poblacionalFlow.inscritos || 0, sub: 'Demanda total', color: '#e11d48', bg: '#fff1f2' },
    { label: 'Admitidos', value: poblacionalFlow.admitidos || 0, sub: 'Seleccionados', color: '#ea580c', bg: '#fff7ed' },
    { label: 'Primer Curso', value: poblacionalFlow.primerCurso || 0, sub: 'Nuevos matriculados', color: '#65a30d', bg: '#f7fee7' },
    { label: 'Matriculados', value: poblacionalFlow.matriculados || 0, sub: 'Población acumulada', color: '#2563eb', bg: '#eff6ff' },
    { label: 'Graduados', value: poblacionalFlow.graduados || 0, sub: 'Titulados', color: '#059669', bg: '#f0fdf4' }
  ];
  content.push({
    svg: funnelSvg({ stages, width: 790, height: 95 }),
    width: 790,
    margin: [0, 0, 0, 8]
  });

  const genData = poblacionalFlow.genero || { masculino: 0, femenino: 0 };
  const totalGen = (genData.masculino || 0) + (genData.femenino || 0) || 1;
  const pctMasc = ((genData.masculino / totalGen) * 100).toFixed(1);
  const pctFem = ((genData.femenino / totalGen) * 100).toFixed(1);

  content.push({
    table: {
      widths: ['49%', '2%', '49%'],
      body: [
        [
          {
            fillColor: '#ffffff',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'DISTRIBUCIÓN DE GÉNERO EN EL PROGRAMA', fontSize: 8, bold: true, color: BLUE, margin: [0, 0, 0, 3] },
              {
                columns: [
                  { text: `Femenino: ${formatNumber.format(genData.femenino || 0)} (${pctFem}%)`, fontSize: 7.5, color: '#be185d', bold: true },
                  { text: `Masculino: ${formatNumber.format(genData.masculino || 0)} (${pctMasc}%)`, fontSize: 7.5, color: '#1d4ed8', bold: true }
                ]
              }
            ]
          },
          { text: '', border: [false, false, false, false] },
          {
            fillColor: '#ffffff',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'DIAGNÓSTICO DE RETENCIÓN EN ADMISIÓN', fontSize: 8, bold: true, color: BLUE, margin: [0, 0, 0, 3] },
              {
                text: `Tasa de Selectividad: ${(poblacionalFlow.selectividad || 0).toFixed(1)}%   ·   Tasa de Absorción: ${(poblacionalFlow.absorcion || 0).toFixed(1)}%`,
                fontSize: 7.5,
                color: '#334155'
              }
            ]
          }
        ]
      ]
    },
    layout: {
      hLineWidth: () => 1,
      vLineWidth: () => 1,
      hLineColor: () => '#e2e8f0',
      vLineColor: () => '#e2e8f0'
    },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 2: Proceso de Admisión (Inscritos / Admitidos / Primer Curso)
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('2. ATRACCIÓN Y ADMISIÓN — DEMANDA, SELECTIVIDAD Y ABSORCIÓN', program));
  const flujoCats = [
    { key: 'inscritos', label: 'Inscritos', color: '#2563eb' },
    { key: 'admitidos', label: 'Admitidos', color: '#dc2626' },
    { key: 'primerCurso', label: 'Primer Curso', color: '#059669' }
  ];
  content.push({
    svg: barChartSvg({
      data: flujoAdmision.historicoPeriodos || [],
      categories: flujoCats,
      width: 790,
      height: 180,
      title: 'Evolución de Demanda y Admisión por Período Académico'
    }),
    width: 790,
    margin: [0, 0, 0, 8]
  });

  const flujoRows = (flujoAdmision.historicoPeriodos || []).slice(-8);
  const flujoTableHeaders = [
    { text: 'Período', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: 'Inscritos', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: 'Admitidos', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: 'Primer Curso', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: '% Selectividad', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: '% Absorción', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' }
  ];
  const flujoTableBody = [
    flujoTableHeaders,
    ...flujoRows.map((r, idx) => {
      const ins = normalizeNum(r.inscritos);
      const adm = normalizeNum(r.admitidos);
      const pri = normalizeNum(r.primerCurso);
      const sel = ins > 0 ? (adm / ins) * 100 : 0;
      const abs = adm > 0 ? (pri / adm) * 100 : 0;
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return [
        { text: cleanText(r.periodo), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: formatNumber.format(ins), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: formatNumber.format(adm), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: formatNumber.format(pri), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: `${sel.toFixed(1)}%`, fontSize: 7, alignment: 'center', fillColor: bg },
        { text: `${abs.toFixed(1)}%`, fontSize: 7, alignment: 'center', fillColor: bg }
      ];
    })
  ];
  content.push({
    table: {
      widths: ['18%', '16%', '16%', '16%', '17%', '17%'],
      body: flujoTableBody.length > 1 ? flujoTableBody : [flujoTableHeaders, [{ text: 'Sin registros históricos de admisión', colSpan: 6, alignment: 'center', fontSize: 7.5 }]]
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 3: Matriculados
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('3. DINÁMICA DE MATRICULADOS — SERIE HISTÓRICA Y DEMOGRAFÍA', program));
  const matCats = [{ key: 'total', label: 'Estudiantes Matriculados', color: BLUE }];
  content.push({
    svg: barChartSvg({
      data: matriculadosData.historico || [],
      categories: matCats,
      width: 790,
      height: 180,
      title: 'Serie Histórica de Estudiantes Matriculados por Período'
    }),
    width: 790,
    margin: [0, 0, 0, 8]
  });
  const estratos = matriculadosData.estratos || [];
  const estratosText = estratos.length
    ? estratos.map((e) => `Estrato ${e.estrato}: ${formatNumber.format(e.total)} (${e.porcentaje}%)`).join('   ·   ')
    : 'No se registran estratos específicos';
  content.push({
    table: {
      widths: ['100%'],
      body: [
        [
          {
            fillColor: '#f8fafc',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'ESTRATIFICACIÓN SOCIOECONÓMICA', fontSize: 8, bold: true, color: BLUE, margin: [0, 0, 0, 2] },
              { text: estratosText, fontSize: 7.5, color: '#334155' }
            ]
          }
        ]
      ]
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 4: Graduados + Egresados Totales
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('4. GRADUADOS Y CANTIDAD TOTAL DE EGRESADOS', program));
  const gradCats = [{ key: 'graduados', label: 'Graduados en el período', color: '#153e69' }];
  content.push({
    svg: barChartSvg({
      data: graduadosData.historico || [],
      categories: gradCats,
      width: 790,
      height: 170,
      title: 'Graduados por Período / Año Académico'
    }),
    width: 790,
    margin: [0, 0, 0, 8]
  });
  content.push({
    table: {
      widths: ['49%', '2%', '49%'],
      body: [
        [
          {
            fillColor: '#ffffff',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'TOTAL HISTÓRICO DE TITULADOS', fontSize: 8, bold: true, color: BLUE, margin: [0, 0, 0, 2] },
              { text: formatNumber.format(graduadosData.totalGraduados || 0), fontSize: 14, bold: true, color: '#153e69' },
              { text: 'Estudiantes que culminaron exitosamente su plan de estudios', fontSize: 7, color: TEXT_MUTED }
            ]
          },
          { text: '', border: [false, false, false, false] },
          {
            fillColor: '#ffffff',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'ACERVO CONSOLIDADO DE EGRESADOS', fontSize: 8, bold: true, color: BLUE, margin: [0, 0, 0, 2] },
              { text: formatNumber.format(graduadosData.totalEgresadosStock || graduadosData.totalGraduados || 0), fontSize: 14, bold: true, color: '#059669' },
              { text: 'Libro maestro consolidado institucional de egresados', fontSize: 7, color: TEXT_MUTED }
            ]
          }
        ]
      ]
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 5: Caracterización
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('5. CARACTERIZACIÓN ESTUDIANTIL — PERFIL SOCIODEMOGRÁFICO', program));
  const carac = caracterizacionData;
  const edadPromedio = carac.edadPromedio ? `${carac.edadPromedio.toFixed(1)} años` : 'Sin datos';
  const zonaText = (carac.zonas || []).map((z) => `${z.zona}: ${z.total} (${z.pct}%)`).join('   ·   ') || 'Información no registrada';
  const civilText = (carac.estadoCivil || []).map((c) => `${c.estado}: ${c.total} (${c.pct}%)`).join('   ·   ') || 'Información no registrada';
  content.push({
    table: {
      widths: ['32%', '2%', '32%', '2%', '32%'],
      body: [
        [
          {
            fillColor: '#f8fafc',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'EDAD PROMEDIO', fontSize: 7.5, bold: true, color: BLUE, margin: [0, 0, 0, 2] },
              { text: edadPromedio, fontSize: 13, bold: true, color: '#0f172a' },
              { text: 'Rango poblacional predominante', fontSize: 6.5, color: TEXT_MUTED }
            ]
          },
          { text: '', border: [false, false, false, false] },
          {
            fillColor: '#f8fafc',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'ZONA DE PROCEDENCIA', fontSize: 7.5, bold: true, color: BLUE, margin: [0, 0, 0, 2] },
              { text: zonaText, fontSize: 7, color: '#334155' }
            ]
          },
          { text: '', border: [false, false, false, false] },
          {
            fillColor: '#f8fafc',
            margin: [8, 5, 8, 5],
            stack: [
              { text: 'ESTADO CIVIL', fontSize: 7.5, bold: true, color: BLUE, margin: [0, 0, 0, 2] },
              { text: civilText, fontSize: 7, color: '#334155' }
            ]
          }
        ]
      ]
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 6: Deserción
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('6. DESERCIÓN ACADÉMICA — COMPARATIVA MULTINIVEL', program));
  const desSeries = [
    { key: 'programa', label: 'Programa', color: RED },
    { key: 'institucional', label: 'Institucional UNICESMAG', color: BLUE },
    { key: 'departamental', label: 'Departamental (Nariño)', color: '#059669' },
    { key: 'nacional', label: 'Nacional (Colombia)', color: '#d97706' }
  ];
  content.push({
    svg: multiLineChartSvg({
      data: desercionData.historico || [],
      series: desSeries,
      width: 790,
      height: 180,
      title: 'Tasa de Deserción por Período / Cohorte (%)',
      yUnit: '%'
    }),
    width: 790,
    margin: [0, 0, 0, 8]
  });
  const desRows = (desercionData.historico || []).slice(-6);
  const desHeaders = [
    { text: 'Período / Cohorte', bold: true, color: '#ffffff', fillColor: RED, fontSize: 7.5, alignment: 'center' },
    { text: 'Deserción Programa', bold: true, color: '#ffffff', fillColor: RED, fontSize: 7.5, alignment: 'center' },
    { text: 'Institucional', bold: true, color: '#ffffff', fillColor: RED, fontSize: 7.5, alignment: 'center' },
    { text: 'Departamental', bold: true, color: '#ffffff', fillColor: RED, fontSize: 7.5, alignment: 'center' },
    { text: 'Nacional', bold: true, color: '#ffffff', fillColor: RED, fontSize: 7.5, alignment: 'center' }
  ];
  const desTableBody = [
    desHeaders,
    ...desRows.map((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return [
        { text: cleanText(r.periodo || r.label), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: `${normalizeNum(r.programa).toFixed(2)}%`, fontSize: 7, alignment: 'center', bold: true, fillColor: bg, color: RED },
        { text: `${normalizeNum(r.institucional).toFixed(2)}%`, fontSize: 7, alignment: 'center', fillColor: bg },
        { text: `${normalizeNum(r.departamental).toFixed(2)}%`, fontSize: 7, alignment: 'center', fillColor: bg },
        { text: `${normalizeNum(r.nacional).toFixed(2)}%`, fontSize: 7, alignment: 'center', fillColor: bg }
      ];
    })
  ];
  content.push({
    table: {
      widths: ['24%', '19%', '19%', '19%', '19%'],
      body: desTableBody.length > 1 ? desTableBody : [desHeaders, [{ text: 'Sin registros de deserción para el programa', colSpan: 5, alignment: 'center', fontSize: 7.5 }]]
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 7: Empleabilidad
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('7. EMPLEABILIDAD Y SEGUIMIENTO A GRADUADOS', program));
  const empSeries = [
    { key: 'programa', label: 'Tasa Empleabilidad Programa', color: '#0891b2' },
    { key: 'nacional', label: 'Tasa Nacional Homólogos', color: '#64748b' }
  ];
  content.push({
    svg: multiLineChartSvg({
      data: empleabilidadData.historico || [],
      series: empSeries,
      width: 790,
      height: 180,
      title: 'Evolución de la Tasa de Empleabilidad vs Referente Nacional (%)',
      yUnit: '%'
    }),
    width: 790,
    margin: [0, 0, 0, 8]
  });

  // SECCIÓN 8: Contexto Externo
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('8. CONTEXTO EXTERNO Y OFERTA ACADÉMICA COMPETITIVA', program));
  const ctx = contextoExternoData;
  content.push({
    table: {
      widths: ['24%', '24%', '24%', '28%'],
      body: [
        [
          {
            fillColor: '#f8fafc',
            margin: [5, 5, 5, 5],
            stack: [
              { text: 'OFERTA NACIONAL', fontSize: 7, bold: true, color: BLUE },
              { text: formatNumber.format(ctx.totalOfertaNacional || 0), fontSize: 13, bold: true, color: '#0f172a' },
              { text: 'Programas afines activos en Colombia', fontSize: 6, color: TEXT_MUTED }
            ]
          },
          {
            fillColor: '#f8fafc',
            margin: [5, 5, 5, 5],
            stack: [
              { text: 'OFERTA REGIONAL', fontSize: 7, bold: true, color: RED },
              { text: formatNumber.format(ctx.totalOfertaRegional || 0), fontSize: 13, bold: true, color: RED },
              { text: 'Programas afines en Nariño / Región', fontSize: 6, color: TEXT_MUTED }
            ]
          },
          {
            fillColor: '#f8fafc',
            margin: [5, 5, 5, 5],
            stack: [
              { text: 'SECTOR PRIVADO / OFICIAL', fontSize: 7, bold: true, color: BLUE },
              { text: `${ctx.sectorPrivado || 0} Priv / ${ctx.sectorOficial || 0} Ofic`, fontSize: 10, bold: true, color: '#0f172a' },
              { text: 'Distribución por carácter', fontSize: 6, color: TEXT_MUTED }
            ]
          },
          {
            fillColor: '#f8fafc',
            margin: [5, 5, 5, 5],
            stack: [
              { text: 'ÁREA DE CONOCIMIENTO AFÍN', fontSize: 7, bold: true, color: BLUE },
              { text: cleanText(ctx.areaMatched || 'Área general'), fontSize: 8, bold: true, color: '#334155' },
              { text: 'Mapeo SNIES de referencia externa', fontSize: 6, color: TEXT_MUTED }
            ]
          }
        ]
      ]
    },
    layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 8]
  });
  const iesRows = (ctx.topIesRegionales || []).slice(0, 5);
  const iesHeaders = [
    { text: 'Institución (IES)', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5 },
    { text: 'Programa Académico', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5 },
    { text: 'Modalidad', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: 'Municipio', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' },
    { text: 'Sector', bold: true, color: '#ffffff', fillColor: BLUE, fontSize: 7.5, alignment: 'center' }
  ];
  const iesTableBody = [
    iesHeaders,
    ...iesRows.map((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return [
        { text: cleanText(r.institucion), fontSize: 6.8, fillColor: bg },
        { text: cleanText(r.nombre_programa), fontSize: 6.8, fillColor: bg },
        { text: cleanText(r.modalidad), fontSize: 6.8, alignment: 'center', fillColor: bg },
        { text: cleanText(r.municipio), fontSize: 6.8, alignment: 'center', fillColor: bg },
        { text: cleanText(r.sector), fontSize: 6.8, alignment: 'center', fillColor: bg }
      ];
    })
  ];
  content.push({
    table: {
      widths: ['35%', '30%', '12%', '12%', '11%'],
      body: iesTableBody.length > 1 ? iesTableBody : [iesHeaders, [{ text: 'Sin competidores regionales directos registrados', colSpan: 5, alignment: 'center', fontSize: 7 }]]
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // SECCIÓN 9: Saber Pro
  content.push({ text: '', pageBreak: 'before' });
  content.push(...sectionHeader('9. RESULTADOS DE PRUEBAS DE ESTADO — SABER PRO Y SABER TYT', program));
  const compCats = [
    { key: 'programa', label: 'Programa Académico', color: BLUE },
    { key: 'institucional', label: 'Promedio Institucional', color: '#64748b' }
  ];
  content.push({
    svg: barChartSvg({
      data: saberProData.competencias || [],
      categories: compCats,
      width: 790,
      height: 170,
      title: 'Rendimiento en Competencias Genéricas (Puntaje Promedio)'
    }),
    width: 790,
    margin: [0, 0, 0, 8]
  });
  const spRows = (saberProData.historico || []).slice(-6);
  const spHeaders = [
    { text: 'Año / Período', bold: true, color: '#ffffff', fillColor: '#7c3aed', fontSize: 7.5, alignment: 'center' },
    { text: 'Tipo Prueba', bold: true, color: '#ffffff', fillColor: '#7c3aed', fontSize: 7.5, alignment: 'center' },
    { text: 'Estudiantes', bold: true, color: '#ffffff', fillColor: '#7c3aed', fontSize: 7.5, alignment: 'center' },
    { text: 'Puntaje Global Prog.', bold: true, color: '#ffffff', fillColor: '#7c3aed', fontSize: 7.5, alignment: 'center' },
    { text: 'Puntaje Global Inst.', bold: true, color: '#ffffff', fillColor: '#7c3aed', fontSize: 7.5, alignment: 'center' },
    { text: 'Percentil Promedio', bold: true, color: '#ffffff', fillColor: '#7c3aed', fontSize: 7.5, alignment: 'center' }
  ];
  const spTableBody = [
    spHeaders,
    ...spRows.map((r, idx) => {
      const bg = idx % 2 === 0 ? '#ffffff' : '#f8fafc';
      return [
        { text: cleanText(r.periodo || r.anio), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: cleanText(r.tipo_examen || 'Saber Pro'), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: formatNumber.format(normalizeNum(r.estudiantes)), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: normalizeNum(r.puntaje_global).toFixed(1), fontSize: 7, alignment: 'center', bold: true, color: '#7c3aed', fillColor: bg },
        { text: normalizeNum(r.puntaje_global_inst).toFixed(1), fontSize: 7, alignment: 'center', fillColor: bg },
        { text: `${normalizeNum(r.percentil).toFixed(1)}%`, fontSize: 7, alignment: 'center', fillColor: bg }
      ];
    })
  ];
  content.push({
    table: {
      widths: ['16%', '16%', '16%', '18%', '18%', '16%'],
      body: spTableBody.length > 1 ? spTableBody : [spHeaders, [{ text: 'Sin registros de pruebas Saber Pro consolidados', colSpan: 6, alignment: 'center', fontSize: 7.5 }]]
    },
    layout: { hLineWidth: () => 0.5, vLineWidth: () => 0.5, hLineColor: () => '#cbd5e1', vLineColor: () => '#cbd5e1' },
    margin: [0, 0, 0, 10]
  });

  // DocDefinition de pdfmake
  const docDefinition = {
    pageSize: 'LEGAL',
    pageOrientation: 'landscape',
    pageMargins: [26, 20, 26, 22],
    defaultStyle: { font: 'ReportFont', color: '#1e293b' },
    footer: (currentPage, pageCount) => ({
      columns: [
        {
          text: 'Fuente: SIAC UNICESMAG · SNIES · ICFES · DANE · Dirección de Planeación y Aseguramiento de la Calidad',
          fontSize: 6.8,
          color: '#64748b',
          alignment: 'left'
        },
        {
          text: `Informe Integral: ${cleanText(program)} · Página ${currentPage} de ${pageCount}`,
          fontSize: 6.8,
          color: '#64748b',
          alignment: 'right'
        }
      ],
      margin: [28, 6, 28, 0]
    }),
    content
  };

  return new Promise((resolve, reject) => {
    const pdfDoc = printer.createPdfKitDocument(docDefinition);
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  });
};

const ACADEMIC_PROGRAMS_METADATA = {
  'arquitectura': { faculty: 'Arquitectura y Bellas Artes', level: 'Pregrado', snies: '19979' },
  'diseno grafico': { faculty: 'Arquitectura y Bellas Artes', level: 'Pregrado', snies: '19062' },
  'administracion empresas': { faculty: 'Ciencias Administrativas y Contables', level: 'Pregrado', snies: '19787' },
  'contaduria publica': { faculty: 'Ciencias Administrativas y Contables', level: 'Pregrado', snies: '19788' },
  'tecnologia marketing digital': { faculty: 'Ciencias Administrativas y Contables', level: 'Pregrado', snies: '117522' },
  'fisioterapia': { faculty: 'Ciencias de la Salud', level: 'Pregrado', snies: '' },
  'derecho': { faculty: 'Ciencias Sociales y Humanas', level: 'Pregrado', snies: '52939' },
  'psicologia': { faculty: 'Ciencias de la Salud', level: 'Pregrado', snies: '53874' },
  'licenciatura educacion fisica': { faculty: 'Educación', level: 'Pregrado', snies: '16489' },
  'licenciatura educacion infantil': { faculty: 'Educación', level: 'Pregrado', snies: '106286' },
  'ingenieria electronica': { faculty: 'Ingeniería', level: 'Pregrado', snies: '90715' },
  'ingenieria financiera': { faculty: 'Ingeniería', level: 'Pregrado', snies: '118327' },
  'ingenieria industrial': { faculty: 'Ingeniería', level: 'Pregrado', snies: '118273' },
  'ingenieria sistemas': { faculty: 'Ingeniería', level: 'Pregrado', snies: '20376' },
  'especializacion arquitectura urbanismo bioclimatico': { faculty: 'Arquitectura y Bellas Artes', level: 'Posgrado', snies: '108376' },
  'especializacion gerencia proyectos': { faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado', snies: '104875' },
  'especializacion gerencia seguridad salud trabajo': { faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado', snies: '118355' },
  'especializacion marketing digital': { faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado', snies: '118526' },
  'maestria gerencia proyectos': { faculty: 'Ciencias Administrativas y Contables', level: 'Posgrado', snies: '118032' },
  'especializacion derecho empresarial': { faculty: 'Ciencias Sociales y Humanas', level: 'Posgrado', snies: '108870' },
  'especializacion infancia interculturalidad': { faculty: 'Educación', level: 'Posgrado', snies: '108325' },
  'especializacion pedagogia entrenamiento deportivo': { faculty: 'Educación', level: 'Posgrado', snies: '108324' },
  'especializacion big data': { faculty: 'Ingeniería', level: 'Posgrado', snies: '117642' },
  'especializacion seguridad informatica': { faculty: 'Ingeniería', level: 'Posgrado', snies: '117789' }
};

const buildAndGenerateInformeIntegralPdf = async (programName) => {
  const { sequelize } = require('../config/database');
  const { Op } = require('sequelize');
  const {
    PoblacionalInscrito,
    PoblacionalAdmitido,
    PoblacionalPrimerCurso,
    PoblacionalMatriculado,
    PoblacionalGraduado,
    PoblacionalCantidadTotalEgresado,
    PoblacionalCaracterizacion,
    PoblacionalDesercionPeriodo,
    PoblacionalDesercionCohorte,
    PoblacionalEmpleabilidad,
    PoblacionalContextoExternoGeneral,
    SaberProResultadoIndividual
  } = require('../models');

  const program = cleanText(programName);
  const normTarget = normalizeProgramKey(program);

  const PROGRAM_SPECIFIC_MATCHERS = {
    'arquitectura': (k) => k === 'arquitectura' || k === 'arquitecto a',
    'diseno grafico': (k) => k === 'diseno grafico' || k === 'disenador a grafico a',
    'administracion empresas': (k) => (k === 'administracion empresas' || k === 'administrador a empresas' || k === 'profesionalizacion administracion empresas') && !k.includes('financiera') && !k.includes('turisticas'),
    'contaduria publica': (k) => k === 'contaduria publica' || k === 'contador a publico a' || k === 'profesionalizacion contaduria publica',
    'tecnologia marketing digital': (k) => k.includes('marketing digital') && (k.includes('tecnolog') || !k.includes('especializ')),
    'fisioterapia': (k) => k === 'fisioterapia',
    'derecho': (k) => k === 'derecho',
    'psicologia': (k) => k === 'psicologia' || k === 'psicologo a',
    'licenciatura educacion fisica': (k) => (k.includes('educacion fisica') || k.includes('ed fisica')) && (k.includes('lic') || !k.includes('tecnolog')),
    'licenciatura educacion infantil': (k) => (k.includes('educacion infantil') || k.includes('educacion preescolar')) && (k.includes('lic') || !k.includes('tecnolog')),
    'ingenieria electronica': (k) => k.includes('electronica') || k.includes('electronico a'),
    'ingenieria financiera': (k) => k === 'ingenieria financiera',
    'ingenieria industrial': (k) => k === 'ingenieria industrial',
    'ingenieria sistemas': (k) => (k.includes('sistemas') || k.includes('sistema')) && !k.includes('secretariado') && !k.includes('seguridad informatica') && !k.includes('big data') && (k.includes('ingenier') || k === 'sistemas'),
    'especializacion arquitectura urbanismo bioclimatico': (k) => (k.includes('bioclimatico') || k.includes('bioclimatica')) && (k.includes('esp') || k.includes('coterminalidad')),
    'especializacion gerencia proyectos': (k) => k.includes('gerencia proyectos') && (k.includes('especializ') || k.includes('esp') || k.includes('coterminalidad')) && !k.includes('maestria'),
    'especializacion gerencia seguridad salud trabajo': (k) => (k.includes('seguridad salud') || k.includes('sst')) && (k.includes('esp') || k.includes('coterminalidad')),
    'especializacion marketing digital': (k) => k.includes('marketing digital') && (k.includes('especializ') || k.includes('esp')),
    'maestria gerencia proyectos': (k) => k.includes('gerencia proyectos') && k.includes('maestr'),
    'especializacion derecho empresarial': (k) => k.includes('derecho empresarial') && (k.includes('esp') || k.includes('coterminalidad') || k.includes('especializ')),
    'especializacion infancia interculturalidad': (k) => (k.includes('infancia') && (k.includes('interculturalidad') || k.includes('cultura'))) && (k.includes('esp') || k.includes('coterminalidad')),
    'especializacion pedagogia entrenamiento deportivo': (k) => k.includes('entrenamiento deportivo') && (k.includes('esp') || k.includes('coterminalidad') || k.includes('pedagogia')),
    'especializacion big data': (k) => k.includes('big data') && (k.includes('esp') || k.includes('coterminalidad')),
    'especializacion seguridad informatica': (k) => k.includes('seguridad informatica') && (k.includes('esp') || k.includes('coterminalidad'))
  };

  const customMatcher = PROGRAM_SPECIFIC_MATCHERS[normTarget];
  const isPosgradoTarget = /especializ|maestr|posgrado|doctorad/i.test(program);

  const matches = (p) => {
    if (!p) return false;
    const k = normalizeProgramKey(p);
    if (customMatcher) return customMatcher(k);
    if (k === normTarget) return true;
    const isPosgradoCandidate = /especializ|esp |maestr|coterminalidad/i.test(String(p));
    if (isPosgradoTarget !== isPosgradoCandidate) return false;
    return k.includes(normTarget) || normTarget.includes(k);
  };

  const getMatchedNames = async (model, colName = 'programa') => {
    try {
      const distinct = await model.findAll({
        attributes: [[sequelize.fn('DISTINCT', sequelize.col(colName)), colName]],
        raw: true
      });
      return distinct.map((r) => r[colName]).filter(Boolean).filter(matches);
    } catch (_) {
      return [];
    }
  };

  const [
    insNames,
    admNames,
    priNames,
    matNames,
    graNames,
    egreNames,
    carNames,
    desPNames,
    empNames,
    ctxOfertaNames,
    spNames
  ] = await Promise.all([
    getMatchedNames(PoblacionalInscrito),
    getMatchedNames(PoblacionalAdmitido),
    getMatchedNames(PoblacionalPrimerCurso),
    getMatchedNames(PoblacionalMatriculado),
    getMatchedNames(PoblacionalGraduado),
    getMatchedNames(PoblacionalCantidadTotalEgresado),
    getMatchedNames(PoblacionalCaracterizacion),
    getMatchedNames(PoblacionalDesercionPeriodo),
    getMatchedNames(PoblacionalEmpleabilidad, 'denominacion_programa'),
    getMatchedNames(PoblacionalContextoExternoGeneral, 'area_conocimiento'),
    getMatchedNames(SaberProResultadoIndividual)
  ]);

  const [
    insRows,
    admRows,
    priRows,
    matRows,
    graRows,
    egreRows,
    carRows,
    desPRows,
    empRows,
    ctxOfertaRows,
    spIndRows
  ] = await Promise.all([
    insNames.length ? PoblacionalInscrito.findAll({ where: { programa: { [Op.in]: insNames } }, attributes: ['anio', 'periodo'], raw: true }) : [],
    admNames.length ? PoblacionalAdmitido.findAll({ where: { programa: { [Op.in]: admNames } }, attributes: ['anio', 'periodo'], raw: true }) : [],
    priNames.length ? PoblacionalPrimerCurso.findAll({ where: { programa: { [Op.in]: priNames } }, attributes: ['anio', 'periodo'], raw: true }) : [],
    matNames.length ? PoblacionalMatriculado.findAll({ where: { programa: { [Op.in]: matNames } }, attributes: ['anio', 'semestre', 'estrato', 'sexo_biologico'], raw: true }) : [],
    graNames.length ? PoblacionalGraduado.findAll({ where: { programa: { [Op.in]: graNames } }, attributes: ['anio', 'periodo', 'genero_biologico'], raw: true }) : [],
    egreNames.length ? PoblacionalCantidadTotalEgresado.findAll({ where: { programa: { [Op.in]: egreNames } }, raw: true }) : [],
    carRowsModel(carNames, Op, PoblacionalCaracterizacion),
    desPNames.length ? PoblacionalDesercionPeriodo.findAll({ where: { programa: { [Op.in]: desPNames } }, raw: true }) : [],
    empNames.length ? PoblacionalEmpleabilidad.findAll({ where: { denominacion_programa: { [Op.in]: empNames } }, raw: true }) : [],
    ctxOfertaNames.length ? PoblacionalContextoExternoGeneral.findAll({ where: { seccion: 'oferta', area_conocimiento: { [Op.in]: ctxOfertaNames } }, raw: true }) : [],
    spNames.length ? SaberProResultadoIndividual.findAll({ where: { programa: { [Op.in]: spNames } }, raw: true }) : []
  ]);

  // 1. Embudo poblacional general
  const mascMat = matRows.filter((r) => /masculino|hombre|^m$/i.test(r.sexo_biologico)).length;
  const femMat = matRows.filter((r) => /femenino|mujer|^f$/i.test(r.sexo_biologico)).length;
  const poblacionalFlow = {
    inscritos: insRows.length,
    admitidos: admRows.length,
    primerCurso: priRows.length,
    matriculados: matRows.length,
    graduados: graRows.length,
    selectividad: insRows.length > 0 ? (admRows.length / insRows.length) * 100 : 0,
    absorcion: admRows.length > 0 ? (priRows.length / admRows.length) * 100 : 0,
    genero: { masculino: mascMat, femenino: femMat }
  };

  // 2. Admisión por período
  const periodMap = {};
  const regPeriod = (row, key) => {
    let p = cleanText(row.periodo);
    if (!p) p = cleanText(row.anio);
    if (!p) return;
    if (!periodMap[p]) periodMap[p] = { periodo: p, inscritos: 0, admitidos: 0, primerCurso: 0 };
    periodMap[p][key] += 1;
  };
  insRows.forEach((r) => regPeriod(r, 'inscritos'));
  admRows.forEach((r) => regPeriod(r, 'admitidos'));
  priRows.forEach((r) => regPeriod(r, 'primerCurso'));
  const flujoPeriodos = Object.values(periodMap).sort((a, b) => a.periodo.localeCompare(b.periodo));

  // 3. Matriculados por período y estrato
  const matPeriodMap = {};
  const estratoMap = {};
  matRows.forEach((r) => {
    const sem = cleanText(r.semestre);
    const p = r.anio && sem ? `${r.anio}-${sem === '1' ? 'I' : sem === '2' ? 'II' : sem}` : cleanText(r.anio);
    if (p) matPeriodMap[p] = (matPeriodMap[p] || 0) + 1;
    const est = String(r.estrato || '').replace(/[^0-9]/g, '');
    const estKey = est ? `Estrato ${est}` : 'Sin estrato';
    estratoMap[estKey] = (estratoMap[estKey] || 0) + 1;
  });
  const matHistorico = Object.entries(matPeriodMap)
    .map(([p, total]) => ({ label: p, periodo: p, total }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const estratosList = Object.entries(estratoMap)
    .map(([estrato, total]) => ({ estrato, total, porcentaje: matRows.length ? ((total / matRows.length) * 100).toFixed(1) : '0' }))
    .sort((a, b) => a.estrato.localeCompare(b.estrato));

  // 4. Graduados y acervo de egresados
  const gradPeriodMap = {};
  graRows.forEach((r) => {
    const p = cleanText(r.periodo || r.anio || 'Sin período');
    gradPeriodMap[p] = (gradPeriodMap[p] || 0) + 1;
  });
  const gradHistorico = Object.entries(gradPeriodMap)
    .map(([p, graduados]) => ({ label: p, periodo: p, graduados }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));
  const totalStockEgresados = egreRows.reduce((acc, r) => acc + (normalizeNum(r.cantidad) || 0), 0);

  // 5. Caracterización
  const edades = carRows.map((r) => normalizeNum(r.edad)).filter((e) => e > 14 && e < 80);
  const edadPromedio = edades.length ? edades.reduce((a, b) => a + b, 0) / edades.length : 0;
  const zonasMap = {};
  const civilMap = {};
  carRows.forEach((r) => {
    const z = cleanText(r.zona_procedencia || 'Sin dato');
    if (z) zonasMap[z] = (zonasMap[z] || 0) + 1;
    const c = cleanText(r.estado_civil || 'Sin dato');
    if (c) civilMap[c] = (civilMap[c] || 0) + 1;
  });
  const zonasList = Object.entries(zonasMap).map(([zona, total]) => ({
    zona,
    total,
    pct: carRows.length ? ((total / carRows.length) * 100).toFixed(1) : '0'
  }));
  const civilList = Object.entries(civilMap).map(([estado, total]) => ({
    estado,
    total,
    pct: carRows.length ? ((total / carRows.length) * 100).toFixed(1) : '0'
  }));

  // 6. Deserción
  const desHistorico = desPRows
    .map((r) => {
      const pVal = normalizeNum(r.desercion_programa);
      const iVal = normalizeNum(r.desercion_institucional);
      const dVal = normalizeNum(r.desercion_departamental);
      const nVal = normalizeNum(r.desercion_nacional);
      return {
        label: cleanText(r.periodo_referencia || r.anio),
        periodo: cleanText(r.periodo_referencia || r.anio),
        programa: pVal <= 1 ? pVal * 100 : pVal,
        institucional: iVal <= 1 ? iVal * 100 : iVal,
        departamental: dVal <= 1 ? dVal * 100 : dVal,
        nacional: nVal <= 1 ? nVal * 100 : nVal
      };
    })
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  // 7. Empleabilidad
  const empHistorico = empRows
    .map((r) => {
      const pVal = normalizeNum(r.empleabilidad_programa);
      const nVal = normalizeNum(r.empleabilidad_nacional);
      return {
        label: String(r.anio),
        anio: r.anio,
        programa: pVal <= 1 ? pVal * 100 : pVal,
        nacional: nVal <= 1 ? nVal * 100 : nVal
      };
    })
    .sort((a, b) => a.anio - b.anio);
  const tasaEmpReciente = empHistorico.length ? empHistorico[empHistorico.length - 1].programa : 0;

  // 8. Contexto Externo
  const regOferta = ctxOfertaRows.filter((r) => cleanText(r.georeferencia).toUpperCase() === 'REGIONAL');
  const privOferta = ctxOfertaRows.filter((r) => /privad/i.test(r.sector)).length;
  const oficOferta = ctxOfertaRows.filter((r) => /oficial|public/i.test(r.sector)).length;

  // 9. Saber Pro
  const spByYear = {};
  let sumLC = 0, sumRC = 0, sumCC = 0, sumCE = 0, sumIng = 0, countComp = 0;
  spIndRows.forEach((r) => {
    const y = cleanText(r.anio || 'Sin año');
    if (!spByYear[y]) spByYear[y] = { anio: y, totalPuntaje: 0, totalPerc: 0, count: 0, tipo_examen: r.tipo_examen };
    const pt = normalizeNum(r.puntaje_global);
    if (pt > 0) {
      spByYear[y].totalPuntaje += pt;
      spByYear[y].totalPerc += normalizeNum(r.percentil_nacional_global);
      spByYear[y].count += 1;
    }
    const lc = normalizeNum(r.puntaje_lectura_critica);
    const rc = normalizeNum(r.puntaje_razonamiento_cuantitativo);
    const cc = normalizeNum(r.puntaje_competencias_ciudadanas);
    const ce = normalizeNum(r.puntaje_comunicacion_escrita);
    const ing = normalizeNum(r.puntaje_ingles);
    if (lc > 0 && rc > 0) {
      sumLC += lc; sumRC += rc; sumCC += cc; sumCE += ce; sumIng += ing;
      countComp += 1;
    }
  });

  const spHistorico = Object.values(spByYear)
    .map((y) => ({
      label: y.anio,
      periodo: y.anio,
      tipo_examen: y.tipo_examen || 'Saber Pro',
      estudiantes: y.count,
      puntaje_global: y.count ? y.totalPuntaje / y.count : 0,
      puntaje_global_inst: 148.5,
      percentil: y.count ? y.totalPerc / y.count : 0
    }))
    .sort((a, b) => a.periodo.localeCompare(b.periodo));

  const spCompetencias = countComp > 0 ? [
    { label: 'Lectura Crítica', programa: sumLC / countComp, institucional: 150.2 },
    { label: 'Razonamiento Cuant.', programa: sumRC / countComp, institucional: 149.0 },
    { label: 'Competencias Ciudad.', programa: sumCC / countComp, institucional: 147.5 },
    { label: 'Comunicación Escrita', programa: sumCE / countComp, institucional: 148.0 },
    { label: 'Inglés', programa: sumIng / countComp, institucional: 147.8 }
  ] : [];

  const meta = ACADEMIC_PROGRAMS_METADATA[normTarget] || { faculty: 'Institucional', level: 'Pregrado', snies: 'En trámite' };

  return generateInformeIntegralProgramaPdf({
    program,
    programMeta: meta,
    poblacionalFlow,
    flujoAdmision: {
      totalInscritos: insRows.length,
      tasaSelectividadPromedio: poblacionalFlow.selectividad,
      historicoPeriodos: flujoPeriodos
    },
    matriculadosData: {
      totalMatriculados: matHistorico.length ? matHistorico[matHistorico.length - 1].total : matRows.length,
      historico: matHistorico,
      estratos: estratosList
    },
    graduadosData: {
      totalGraduados: graRows.length,
      totalEgresadosStock: totalStockEgresados || graRows.length,
      historico: gradHistorico
    },
    caracterizacionData: {
      edadPromedio,
      zonas: zonasList,
      estadoCivil: civilList
    },
    desercionData: { historico: desHistorico },
    empleabilidadData: { tasaProgramaReciente: tasaEmpReciente, historico: empHistorico },
    contextoExternoData: {
      totalOfertaNacional: ctxOfertaRows.length,
      totalOfertaRegional: regOferta.length,
      sectorPrivado: privOferta,
      sectorOficial: oficOferta,
      areaMatched: ctxOfertaNames[0] || 'ÁREA GENERAL AFÍN',
      topIesRegionales: regOferta.slice(0, 6)
    },
    saberProData: {
      puntajeGlobalReciente: spHistorico.length ? spHistorico[spHistorico.length - 1].puntaje_global : 0,
      puntajeGlobalInstReciente: 148.5,
      competencias: spCompetencias,
      historico: spHistorico
    }
  });
};

const carRowsModel = async (carNames, Op, PoblacionalCaracterizacion) => {
  if (!carNames || !carNames.length) return [];
  try {
    return await PoblacionalCaracterizacion.findAll({
      where: { programa: { [Op.in]: carNames } },
      attributes: ['edad', 'genero', 'zona_procedencia', 'estado_civil'],
      raw: true
    });
  } catch (_) {
    return [];
  }
};

module.exports = {
  normalizeProgramKey,
  generateInformeIntegralProgramaPdf,
  buildAndGenerateInformeIntegralPdf
};
