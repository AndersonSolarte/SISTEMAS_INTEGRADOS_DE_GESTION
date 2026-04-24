const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-cesmag.png');

const COLORS = {
  headerBlueFill: 'FFD9E2F3',
  headerBlueBorder: 'FF4472C4',
  headerRedFill: 'FFC00000',
  headerRedFont: 'FFFFFFFF',
  instructionsFill: 'FFD9E2F3',
  codeBlockFill: 'FFD9E2F3',
  greenOk: 'FFB7E1CD',
  redEmpty: 'FFF4B7B7',
  yellowMid: 'FFFFF2CC',
  borderGrid: 'FF4472C4',
  titleFont: 'FF000000',
  softBorder: 'FF8EA9DB'
};

const HEADER_ROWS_BEFORE_DATA = 6;
const MIN_DATA_ROWS = 20;

const thinBorder = (color = COLORS.borderGrid) => ({ style: 'thin', color: { argb: color } });

const setBorders = (cell, color = COLORS.borderGrid) => {
  cell.border = {
    top: thinBorder(color),
    left: thinBorder(color),
    bottom: thinBorder(color),
    right: thinBorder(color)
  };
};

const fillCell = (cell, argb) => {
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

const applyHeaderStyle = (cell, { red = false } = {}) => {
  cell.font = {
    name: 'Calibri',
    bold: true,
    italic: true,
    size: 11,
    color: { argb: red ? COLORS.headerRedFont : COLORS.titleFont }
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  fillCell(cell, red ? COLORS.headerRedFill : COLORS.headerBlueFill);
  setBorders(cell);
};

const applyDataStyle = (cell, { center = false, number = false, percent = false } = {}) => {
  cell.font = { name: 'Calibri', size: 10, color: { argb: COLORS.titleFont } };
  cell.alignment = {
    vertical: 'middle',
    horizontal: center ? 'center' : 'left',
    wrapText: true
  };
  if (percent) {
    cell.numFmt = '0%';
    cell.alignment.horizontal = 'center';
  } else if (number) {
    cell.numFmt = '0';
    cell.alignment.horizontal = 'center';
  }
  setBorders(cell, COLORS.softBorder);
};

const normalizePercentValue = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num > 1) return Number((num / 100).toFixed(4));
  if (num < 0) return 0;
  return Number(num.toFixed(4));
};

const formatDate = (value) => {
  if (!value) return '';
  try {
    if (typeof value === 'string') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    if (value instanceof Date) return value;
  } catch (_) { /* noop */ }
  return String(value);
};

const FOOTER_VERSION = {
  codigo: 'DIR-PE-FR-003',
  version: '5',
  fecha: '11/FEB/2026'
};

const INSTRUCCIONES = [
  'INSTRUCCIONES PARA EL DILIGENCIAMIENTO:',
  '1. No alterar la estructura del formato.',
  '2. No combinar celdas horizontal o verticalmente; si requiere asociar varios indicadores a una actividad, debe repetirse partida en las filas que sean necesarias.',
  '3. Utilizar las listas de selección en las columnas cuya cabecera está resaltada con fondo rojo.',
  '4. Diligenciar completamente las columnas para cada actividad.'
];

const COLUMN_WIDTHS = [
  { col: 'A', w: 3 },
  { col: 'B', w: 5 },
  { col: 'C', w: 26 },
  { col: 'D', w: 26 },
  { col: 'E', w: 34 },
  { col: 'F', w: 14 },
  { col: 'G', w: 12 },
  { col: 'H', w: 12 },
  { col: 'I', w: 30 },
  { col: 'J', w: 12 },
  { col: 'K', w: 22 },
  { col: 'L', w: 22 },
  { col: 'M', w: 13 },
  { col: 'N', w: 24 },
  { col: 'O', w: 2 },
  { col: 'P', w: 13 },
  { col: 'Q', w: 24 },
  { col: 'R', w: 10 }
];

const buildPlanAccionWorkbook = async ({ planData = {}, actividades = [] } = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistema de Gestión por Procesos - Universidad CESMAG';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('PLAN DE ACCION', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: 'frozen', ySplit: HEADER_ROWS_BEFORE_DATA }]
  });

  COLUMN_WIDTHS.forEach(({ col, w }) => {
    sheet.getColumn(col).width = w;
  });

  sheet.getRow(1).height = 12;
  sheet.getRow(2).height = 22;
  sheet.getRow(3).height = 22;
  sheet.getRow(4).height = 22;
  sheet.getRow(5).height = 22;
  sheet.getRow(6).height = 46;

  if (fs.existsSync(LOGO_PATH)) {
    const imageId = workbook.addImage({
      filename: LOGO_PATH,
      extension: 'png'
    });
    sheet.addImage(imageId, {
      tl: { col: 1, row: 1 },
      ext: { width: 92, height: 78 }
    });
  }

  sheet.mergeCells('B2:B4');

  sheet.mergeCells('C2:F4');
  const titleCell = sheet.getCell('C2');
  const currentYear = planData.anio || new Date().getFullYear();
  titleCell.value = `PLAN DE ACCIÓN\nAÑO: ${currentYear}`;
  titleCell.font = { name: 'Calibri', bold: true, size: 18, color: { argb: COLORS.titleFont } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  setBorders(titleCell);

  sheet.mergeCells('G2:H2');
  sheet.mergeCells('G3:H3');
  sheet.mergeCells('G4:H4');
  const codigoCell = sheet.getCell('G2');
  codigoCell.value = `CÓDIGO: ${FOOTER_VERSION.codigo}`;
  const versionCell = sheet.getCell('G3');
  versionCell.value = `VERSIÓN: ${FOOTER_VERSION.version}`;
  const fechaCell = sheet.getCell('G4');
  fechaCell.value = `FECHA: ${FOOTER_VERSION.fecha}`;
  [codigoCell, versionCell, fechaCell].forEach((c) => {
    c.font = { name: 'Calibri', bold: true, size: 10 };
    c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    setBorders(c);
  });

  sheet.mergeCells('I2:R4');
  const instructionsCell = sheet.getCell('I2');
  instructionsCell.value = INSTRUCCIONES.join('\n');
  instructionsCell.font = { name: 'Calibri', bold: false, size: 9 };
  instructionsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
  fillCell(instructionsCell, COLORS.instructionsFill);
  setBorders(instructionsCell);

  sheet.mergeCells('C5:H5');
  const codePlanCell = sheet.getCell('C5');
  codePlanCell.value = (planData.codigoPlan || 'RXX_ XXXXXXXXXXX').toUpperCase();
  codePlanCell.font = { name: 'Calibri', bold: true, size: 12 };
  codePlanCell.alignment = { vertical: 'middle', horizontal: 'center' };
  fillCell(codePlanCell, COLORS.codeBlockFill);
  setBorders(codePlanCell);

  const headers = [
    { col: 'B', label: 'No.' },
    { col: 'C', label: 'Objetivos Estratégicos' },
    { col: 'D', label: 'Lineamientos Estratégicos' },
    { col: 'E', label: 'Actividades' },
    { col: 'F', label: 'Tipo de Indicador' },
    { col: 'G', label: 'Fecha inicio' },
    { col: 'H', label: 'Fecha fin' },
    { col: 'I', label: 'Indicador' },
    { col: 'J', label: 'Meta' },
    { col: 'K', label: 'Responsable de Ejecución', red: true },
    { col: 'L', label: 'Corresponsable', red: true },
    { col: 'M', label: `Avance a IP- ${currentYear}` },
    { col: 'N', label: 'Observaciones' },
    { col: 'P', label: `Avance a IIP- ${currentYear}` },
    { col: 'Q', label: 'Observaciones' },
    { col: 'R', label: 'Total' }
  ];

  headers.forEach(({ col, label, red }) => {
    const cell = sheet.getCell(`${col}6`);
    cell.value = label;
    applyHeaderStyle(cell, { red: Boolean(red) });
  });

  const totalRows = Math.max(MIN_DATA_ROWS, actividades.length);
  const firstDataRow = HEADER_ROWS_BEFORE_DATA + 1;

  for (let i = 0; i < totalRows; i += 1) {
    const rowNumber = firstDataRow + i;
    const row = sheet.getRow(rowNumber);
    row.height = 42;

    const activity = actividades[i] || {};
    const avanceIp = normalizePercentValue(activity.avance_ip);
    const avanceIip = normalizePercentValue(activity.avance_iip);

    const cells = [
      { col: 'B', value: i + 1, opts: { center: true, number: true } },
      { col: 'C', value: activity.objetivo_estrategico || '' },
      { col: 'D', value: activity.lineamiento_estrategico || '' },
      { col: 'E', value: activity.actividad || '' },
      { col: 'F', value: activity.tipo_indicador || '', opts: { center: true } },
      { col: 'G', value: formatDate(activity.fecha_inicio), opts: { center: true } },
      { col: 'H', value: formatDate(activity.fecha_fin), opts: { center: true } },
      { col: 'I', value: activity.indicador || '' },
      { col: 'J', value: activity.meta || '', opts: { center: true } },
      { col: 'K', value: activity.responsable || planData.responsable || '' },
      { col: 'L', value: activity.corresponsable || planData.corresponsable || '' },
      { col: 'M', value: avanceIp, opts: { percent: true } },
      { col: 'N', value: activity.observaciones_ip || '' },
      { col: 'P', value: avanceIip, opts: { percent: true } },
      { col: 'Q', value: activity.observaciones_iip || '' }
    ];

    cells.forEach(({ col, value, opts }) => {
      const cell = sheet.getCell(`${col}${rowNumber}`);
      cell.value = value === null ? null : value;
      applyDataStyle(cell, opts);
    });

    const totalCell = sheet.getCell(`R${rowNumber}`);
    totalCell.value = {
      formula: `IFERROR(IF(AND(ISBLANK(M${rowNumber}),ISBLANK(P${rowNumber})),"",ROUND((IF(ISNUMBER(M${rowNumber}),M${rowNumber},0)+IF(ISNUMBER(P${rowNumber}),P${rowNumber},0))/2,4)),"")`,
      result: avanceIp !== null || avanceIip !== null
        ? Number((((avanceIp || 0) + (avanceIip || 0)) / 2).toFixed(4))
        : null
    };
    applyDataStyle(totalCell, { percent: true });
    totalCell.font = { name: 'Calibri', bold: true, size: 10 };
  }

  const lastDataRow = firstDataRow + totalRows - 1;

  sheet.addConditionalFormatting({
    ref: `R${firstDataRow}:R${lastDataRow}`,
    rules: [
      {
        type: 'expression',
        formulae: [`AND(ISNUMBER(R${firstDataRow}),R${firstDataRow}>=1)`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.greenOk } },
          font: { bold: true }
        },
        priority: 1
      },
      {
        type: 'expression',
        formulae: [`AND(ISNUMBER(R${firstDataRow}),R${firstDataRow}>=0.5,R${firstDataRow}<1)`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.yellowMid } },
          font: { bold: true }
        },
        priority: 2
      },
      {
        type: 'expression',
        formulae: [`OR(NOT(ISNUMBER(R${firstDataRow})),R${firstDataRow}<0.5)`],
        style: {
          fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.redEmpty } }
        },
        priority: 3
      }
    ]
  });

  sheet.pageSetup.margins = { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 };

  return workbook;
};

const generatePlanAccionBuffer = async (payload = {}) => {
  const workbook = await buildPlanAccionWorkbook(payload);
  return workbook.xlsx.writeBuffer();
};

module.exports = {
  generatePlanAccionBuffer
};
