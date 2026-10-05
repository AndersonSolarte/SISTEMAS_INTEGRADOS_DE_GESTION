const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');

const HEADER_BANNER_PATH = path.join(__dirname, '..', 'assets', 'Encabezado_correos.png');

const COLORS = {
  headerBlueFill: 'FF2F5597',
  headerBlueBorder: 'FF1F3864',
  headerRedFill: 'FFC00000',
  headerWineFill: 'FF800000',
  headerWhiteFont: 'FFFFFFFF',
  instructionsFill: 'FFD9E2F3',
  codeBlockFill: 'FFD9E2F3',
  dataBlueFill: 'FFD9E2F3',
  dataWhiteFill: 'FFFFFFFF',
  greenOk: 'FF548235',
  redEmpty: 'FFFF0000',
  yellowMid: 'FFFFEB9C',
  borderGrid: 'FF2F5597',
  titleFont: 'FF000000',
  softBorder: 'FF8EA9DB'
};

const HEADER_ROWS_BEFORE_DATA = 6;

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

const applyHeaderStyle = (cell, { color = 'blue' } = {}) => {
  let bgColor = COLORS.headerBlueFill;
  if (color === 'red') bgColor = COLORS.headerRedFill;
  else if (color === 'wine') bgColor = COLORS.headerWineFill;

  cell.font = {
    name: 'Calibri',
    bold: true,
    italic: true,
    size: 10,
    color: { argb: COLORS.headerWhiteFont }
  };
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  fillCell(cell, bgColor);
  setBorders(cell, COLORS.borderGrid);
};

const applyDataStyle = (cell, { center = false, number = false, percent = false, isBlueCol = false } = {}) => {
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
  if (isBlueCol) {
    fillCell(cell, COLORS.dataBlueFill);
  } else {
    fillCell(cell, COLORS.dataWhiteFill);
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
  fecha: '17/10/2024'
};

const INSTRUCCIONES = [
  'INSTRUCCIONES PARA EL DILIGENCIAMIENTO:',
  '1. No alterar la estructura del formato.',
  '2. No combinar celdas horizontal o verticalmente, en caso de que se requiera asociar varios individuos a una actividad se debe repetir su puntualidad en las filas que sean necesarias.',
  '3. Utilizar las listas de selección en los campos que se active cada celda en cada una de las columnas.',
  '4. Diligenciar completamente los campos para cada actividad.'
];

const COLUMN_WIDTHS = [
  { col: 'A', w: 3 },
  { col: 'B', w: 6 },
  { col: 'C', w: 26 },
  { col: 'D', w: 26 },
  { col: 'E', w: 34 },
  { col: 'F', w: 14 },
  { col: 'G', w: 12 },
  { col: 'H', w: 12 },
  { col: 'I', w: 30 },
  { col: 'J', w: 14 },
  { col: 'K', w: 24 },
  { col: 'L', w: 24 },
  { col: 'M', w: 14 },
  { col: 'N', w: 24 },
  { col: 'O', w: 2 },
  { col: 'P', w: 14 },
  { col: 'Q', w: 24 },
  { col: 'R', w: 12 }
];

const buildPlanAccionWorkbook = async ({ planData = {}, actividades = [], corresponsabilidades = [] } = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIAC UNICESMAG - Sistema Interno de Aseguramiento de la Calidad';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('PLAN DE ACCION', {
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 },
    views: [{ state: 'frozen', ySplit: HEADER_ROWS_BEFORE_DATA }]
  });

  COLUMN_WIDTHS.forEach(({ col, w }) => {
    sheet.getColumn(col).width = w;
  });

  sheet.getRow(1).height = 10;
  sheet.getRow(2).height = 80;
  sheet.getRow(3).height = 20;
  sheet.getRow(4).height = 42;
  sheet.getRow(5).height = 26;
  sheet.getRow(6).height = 44;

  if (fs.existsSync(HEADER_BANNER_PATH)) {
    const imageId = workbook.addImage({
      filename: HEADER_BANNER_PATH,
      extension: 'png'
    });
    sheet.addImage(imageId, {
      tl: { col: 1, row: 1 },
      ext: { width: 850, height: 100 }
    });
  }

  sheet.mergeCells('B2:R2');
  const bannerBox = sheet.getCell('B2');
  setBorders(bannerBox, COLORS.softBorder);

  sheet.mergeCells('B3:E4');
  const titleCell = sheet.getCell('B3');
  const currentYear = planData.anio || new Date().getFullYear();
  titleCell.value = `PLAN DE ACCIÓN INSTITUCIONAL\nAÑO: ${currentYear}`;
  titleCell.font = { name: 'Calibri', bold: true, size: 14, color: { argb: 'FF1F3864' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  setBorders(titleCell);

  sheet.mergeCells('F3:H3');
  sheet.mergeCells('F4:H4');
  const codigoCell = sheet.getCell('F3');
  codigoCell.value = `CÓDIGO: ${FOOTER_VERSION.codigo}   |   VERSIÓN: ${FOOTER_VERSION.version}`;
  const fechaCell = sheet.getCell('F4');
  fechaCell.value = `FECHA DE EMISIÓN: ${FOOTER_VERSION.fecha}`;
  [codigoCell, fechaCell].forEach((c) => {
    c.font = { name: 'Calibri', bold: true, size: 9.5, color: { argb: 'FF1F3864' } };
    c.alignment = { vertical: 'middle', horizontal: 'center' };
    setBorders(c);
  });

  sheet.mergeCells('I3:R4');
  const instructionsCell = sheet.getCell('I3');
  instructionsCell.value = INSTRUCCIONES.join('\n');
  instructionsCell.font = { name: 'Calibri', bold: false, size: 8.5 };
  instructionsCell.alignment = { vertical: 'top', horizontal: 'left', wrapText: true, indent: 1 };
  fillCell(instructionsCell, COLORS.instructionsFill);
  setBorders(instructionsCell);

  sheet.mergeCells('B5:R5');
  const codePlanCell = sheet.getCell('B5');
  const planCodeText = planData.responsable
    ? `${planData.codigoPlan || 'RXX'}_ ${planData.responsable.toUpperCase()}`
    : (planData.codigoPlan || 'RXX_ XXXXXXXXXXX').toUpperCase();
  codePlanCell.value = planCodeText;
  codePlanCell.font = { name: 'Calibri', bold: true, size: 11, color: { argb: 'FF1F3864' } };
  codePlanCell.alignment = { vertical: 'middle', horizontal: 'center' };
  fillCell(codePlanCell, COLORS.codeBlockFill);
  setBorders(codePlanCell, COLORS.borderGrid);

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
    { col: 'K', label: 'Responsable de Ejecución', color: 'red' },
    { col: 'L', label: 'Corresponsable', color: 'wine' },
    { col: 'M', label: `Avance a IP- ${currentYear}` },
    { col: 'N', label: 'Observaciones' },
    { col: 'P', label: `Avance a IIP- ${currentYear}` },
    { col: 'Q', label: 'Observaciones' },
    { col: 'R', label: 'Total' }
  ];

  headers.forEach(({ col, label, color = 'blue' }) => {
    const cell = sheet.getCell(`${col}6`);
    cell.value = label;
    applyHeaderStyle(cell, { color });
  });

  const validActividades = (actividades || []).filter((a) => a && (a.actividad || a.indicador || a.meta || a.objetivo_estrategico || a.lineamiento_estrategico));
  const validCorresponsabilidades = (corresponsabilidades || []).filter((a) => a && (a.actividad || a.indicador || a.meta));
  const tieneCorresponsabilidades = validCorresponsabilidades.length > 0;
  const totalRows = validActividades.length;
  const firstDataRow = HEADER_ROWS_BEFORE_DATA + 1;

  const writeActivityRow = (activity = {}, rowNumber, idx) => {
    const row = sheet.getRow(rowNumber);

    const lenC = String(activity.objetivo_estrategico || '').length;
    const lenD = String(activity.lineamiento_estrategico || '').length;
    const lenE = String(activity.actividad || '').length;
    const lenI = String(activity.indicador || '').length;
    const lenN = String(activity.observaciones_ip || '').length;
    const lenQ = String(activity.observaciones_iip || '').length;

    const maxLines = Math.max(
      1,
      Math.ceil(lenC / 24),
      Math.ceil(lenD / 24),
      Math.ceil(lenE / 32),
      Math.ceil(lenI / 28),
      Math.ceil(lenN / 22),
      Math.ceil(lenQ / 22)
    );
    row.height = Math.max(34, Math.min(maxLines * 16 + 10, 140));

    const avanceIp = normalizePercentValue(activity.avance_ip);
    const avanceIip = normalizePercentValue(activity.avance_iip);

    const cells = [
      { col: 'B', value: idx + 1, opts: { center: true, number: true, isBlueCol: true } },
      { col: 'C', value: activity.objetivo_estrategico || '', opts: { isBlueCol: true } },
      { col: 'D', value: activity.lineamiento_estrategico || '', opts: { isBlueCol: true } },
      { col: 'E', value: activity.actividad || '', opts: { isBlueCol: true } },
      { col: 'F', value: activity.tipo_indicador || '', opts: { center: true, isBlueCol: true } },
      { col: 'G', value: formatDate(activity.fecha_inicio), opts: { center: true, isBlueCol: true } },
      { col: 'H', value: formatDate(activity.fecha_fin), opts: { center: true, isBlueCol: true } },
      { col: 'I', value: activity.indicador || '', opts: { isBlueCol: true } },
      { col: 'J', value: activity.meta || '', opts: { center: true, isBlueCol: true } },
      { col: 'K', value: activity.responsable || planData.responsable || '', opts: { isBlueCol: false } },
      { col: 'L', value: activity.corresponsable || planData.corresponsable || '', opts: { isBlueCol: false } },
      { col: 'M', value: avanceIp, opts: { percent: true, isBlueCol: false } },
      { col: 'N', value: activity.observaciones_ip || '', opts: { isBlueCol: false } },
      { col: 'P', value: avanceIip, opts: { percent: true, isBlueCol: false } },
      { col: 'Q', value: activity.observaciones_iip || '', opts: { isBlueCol: false } }
    ];

    cells.forEach(({ col, value, opts }) => {
      const cell = sheet.getCell(`${col}${rowNumber}`);
      cell.value = value === null ? null : value;
      applyDataStyle(cell, opts);
    });

    const totalCell = sheet.getCell(`R${rowNumber}`);
    const calcResult = avanceIp !== null || avanceIip !== null
      ? Number(Math.min((avanceIp || 0) + (avanceIip || 0), 1).toFixed(4))
      : null;

    totalCell.value = {
      formula: `IFERROR(IF(AND(ISBLANK(M${rowNumber}),ISBLANK(P${rowNumber})),"",ROUND(MIN(IF(ISNUMBER(M${rowNumber}),M${rowNumber},0)+IF(ISNUMBER(P${rowNumber}),P${rowNumber},0),1),4)),"")`,
      result: calcResult
    };
    applyDataStyle(totalCell, { percent: true, isBlueCol: false });
    if (calcResult !== null) {
      if (calcResult >= 1) {
        fillCell(totalCell, COLORS.greenOk);
        totalCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      } else if (calcResult >= 0.5) {
        fillCell(totalCell, COLORS.yellowMid);
        totalCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FF9C5700' } };
      } else {
        fillCell(totalCell, COLORS.redEmpty);
        totalCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
      }
    } else {
      fillCell(totalCell, COLORS.redEmpty);
      totalCell.font = { name: 'Calibri', bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
    }
  };

  for (let i = 0; i < totalRows; i += 1) {
    writeActivityRow(validActividades[i], firstDataRow + i, i);
  }

  const directLastDataRow = totalRows > 0 ? (firstDataRow + totalRows - 1) : null;
  let corrFirstDataRow = null;
  let corrLastDataRow = null;

  if (tieneCorresponsabilidades) {
    const titleRowNumber = (directLastDataRow || (firstDataRow - 1)) + 1;
    sheet.getRow(titleRowNumber).height = 24;
    sheet.mergeCells(`B${titleRowNumber}:R${titleRowNumber}`);
    const title = sheet.getCell(`B${titleRowNumber}`);
    title.value = 'ACTIVIDADES EN CORRESPONSABILIDAD';
    title.font = { name: 'Calibri', bold: true, italic: true, size: 12, color: { argb: 'FF92400E' } };
    title.alignment = { vertical: 'middle', horizontal: 'center' };
    fillCell(title, COLORS.yellowMid);
    setBorders(title, COLORS.softBorder);

    validCorresponsabilidades.forEach((activity, idx) => {
      const rowNumber = titleRowNumber + 1 + idx;
      writeActivityRow(activity, rowNumber, idx);
      ['B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R'].forEach((col) => {
        fillCell(sheet.getCell(`${col}${rowNumber}`), 'FFFFFBEB');
      });
    });

    corrFirstDataRow = titleRowNumber + 1;
    corrLastDataRow = titleRowNumber + validCorresponsabilidades.length;
  }

  const addTotalConditionalFormatting = (startRow, endRow) => {
    if (!startRow || !endRow || endRow < startRow) return;
    sheet.addConditionalFormatting({
      ref: `R${startRow}:R${endRow}`,
      rules: [
        {
          type: 'expression',
          formulae: [`AND(ISNUMBER(R${startRow}),R${startRow}>=1)`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.greenOk } },
            font: { bold: true }
          },
          priority: 1
        },
        {
          type: 'expression',
          formulae: [`AND(ISNUMBER(R${startRow}),R${startRow}>=0.5,R${startRow}<1)`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.yellowMid } },
            font: { bold: true }
          },
          priority: 2
        },
        {
          type: 'expression',
          formulae: [`OR(NOT(ISNUMBER(R${startRow})),R${startRow}<0.5)`],
          style: {
            fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: COLORS.redEmpty } }
          },
          priority: 3
        }
      ]
    });
  };

  if (directLastDataRow) {
    addTotalConditionalFormatting(firstDataRow, directLastDataRow);
  }
  if (corrFirstDataRow && corrLastDataRow) {
    addTotalConditionalFormatting(corrFirstDataRow, corrLastDataRow);
  }

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
