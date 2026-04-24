const path = require('path');
const fs = require('fs');
const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  AlignmentType,
  VerticalAlign,
  WidthType,
  BorderStyle,
  HeightRule,
  ShadingType,
  PageOrientation,
  TableLayoutType
} = require('docx');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo-cesmag.png');

const ACTA_HEADER = {
  codigo: 'COM-IF-FR-002',
  version: '1',
  fecha: '6/MAR/2020',
  titulo: 'REGISTRO DE ASISTENCIA Y REUNIÓN'
};

const PAGE_WIDTH_TWIPS = 12240;
const PAGE_HEIGHT_TWIPS = 15840;
const PAGE_MARGIN_TWIPS = 720;
const CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - PAGE_MARGIN_TWIPS * 2;

const GRID_COLOR = '000000';
const GRAY_SHADING = 'D9D9D9';
const LIGHT_GRAY = 'F2F2F2';

const thin = { style: BorderStyle.SINGLE, size: 6, color: GRID_COLOR };
const ALL_BORDERS = {
  top: thin,
  bottom: thin,
  left: thin,
  right: thin
};

const textRun = (text, opts = {}) =>
  new TextRun({
    text: text === undefined || text === null ? '' : String(text),
    bold: Boolean(opts.bold),
    italics: Boolean(opts.italics),
    size: opts.size || 20,
    font: opts.font || 'Arial',
    color: opts.color || '000000'
  });

const paragraph = (runs = [], opts = {}) =>
  new Paragraph({
    alignment: opts.alignment || AlignmentType.LEFT,
    spacing: { before: opts.before || 0, after: opts.after || 0, line: opts.line || 276 },
    children: Array.isArray(runs) ? runs : [runs]
  });

const buildTable = ({ columnWidths, rows }) =>
  new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths,
    borders: {
      top: thin,
      bottom: thin,
      left: thin,
      right: thin,
      insideHorizontal: thin,
      insideVertical: thin
    },
    rows
  });

const cell = ({ children, columnSpan, verticalAlign = VerticalAlign.CENTER, width, shading }) =>
  new TableCell({
    children,
    columnSpan,
    verticalAlign,
    width: width ? { size: width, type: WidthType.DXA } : undefined,
    shading: shading ? { type: ShadingType.CLEAR, color: 'auto', fill: shading } : undefined,
    borders: ALL_BORDERS
  });

const sectionHeaderRow = (label, { columns = 4 } = {}) =>
  new TableRow({
    tableHeader: true,
    height: { value: 280, rule: HeightRule.ATLEAST },
    children: [
      cell({
        columnSpan: columns,
        shading: GRAY_SHADING,
        children: [
          paragraph(textRun(label, { bold: true, size: 22 }), { alignment: AlignmentType.CENTER })
        ]
      })
    ]
  });

const buildHeaderTable = () => {
  const logoParagraph = fs.existsSync(LOGO_PATH)
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: fs.readFileSync(LOGO_PATH),
            transformation: { width: 85, height: 85 }
          })
        ]
      })
    : paragraph(textRun('CESMAG', { bold: true, size: 22 }), { alignment: AlignmentType.CENTER });

  const columnWidths = [2200, 6400, 2200];

  return buildTable({
    columnWidths,
    rows: [
      new TableRow({
        height: { value: 1700, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: columnWidths[0],
            children: [logoParagraph]
          }),
          cell({
            width: columnWidths[1],
            verticalAlign: VerticalAlign.CENTER,
            children: [
              paragraph(textRun(ACTA_HEADER.titulo, { bold: true, size: 28 }), {
                alignment: AlignmentType.CENTER
              })
            ]
          }),
          cell({
            width: columnWidths[2],
            children: [
              paragraph(textRun(`CÓDIGO: ${ACTA_HEADER.codigo}`, { bold: true, size: 18 })),
              paragraph(textRun(`VERSIÓN: ${ACTA_HEADER.version}`, { bold: true, size: 18 })),
              paragraph(textRun(`FECHA: ${ACTA_HEADER.fecha}`, { bold: true, size: 18 }))
            ]
          })
        ]
      })
    ]
  });
};

const buildBasicsTable = ({ responsables, dependencia }) => {
  const columnWidths = [CONTENT_WIDTH_TWIPS];
  return buildTable({
    columnWidths,
    rows: [
      new TableRow({
        height: { value: 420, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: columnWidths[0],
            children: [
              paragraph([
                textRun('Responsable(s): ', { bold: true, size: 20 }),
                textRun(responsables || '', { size: 20 })
              ])
            ]
          })
        ]
      }),
      new TableRow({
        height: { value: 420, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: columnWidths[0],
            children: [
              paragraph([
                textRun('Dependencia que cita: ', { bold: true, size: 20 }),
                textRun(dependencia || '', { size: 20 })
              ])
            ]
          })
        ]
      })
    ]
  });
};

const buildInformacionReunionTable = ({ lugar, fecha, horario }) => {
  const columnWidths = [6000, 2400, 2400];
  return buildTable({
    columnWidths,
    rows: [
      sectionHeaderRow('Información de la Reunión', { columns: 3 }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          cell({
            columnSpan: 3,
            width: CONTENT_WIDTH_TWIPS,
            children: [
              paragraph([
                textRun('Lugar: ', { bold: true, size: 20 }),
                textRun(lugar || '', { size: 20 })
              ])
            ]
          })
        ]
      }),
      new TableRow({
        height: { value: 400, rule: HeightRule.ATLEAST },
        children: [
          cell({
            columnSpan: 2,
            width: columnWidths[0] + columnWidths[1],
            children: [
              paragraph([
                textRun('Fecha: ', { bold: true, size: 20 }),
                textRun(fecha || '', { size: 20 })
              ])
            ]
          }),
          cell({
            width: columnWidths[2],
            children: [
              paragraph([
                textRun('Horario: ', { bold: true, size: 20 }),
                textRun(horario || '', { size: 20 })
              ])
            ]
          })
        ]
      })
    ]
  });
};

const buildParticipantesTable = (participantes = []) => {
  const columnWidths = [700, 5300, 2400, 2400];
  const minimo = 10;
  const total = Math.max(minimo, participantes.length);
  const filas = [];

  for (let i = 0; i < total; i += 1) {
    const p = participantes[i] || {};
    filas.push(new TableRow({
      height: { value: 360, rule: HeightRule.ATLEAST },
      children: [
        cell({
          width: columnWidths[0],
          children: [paragraph(textRun(String(i + 1), { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })]
        }),
        cell({
          width: columnWidths[1],
          children: [paragraph(textRun(p.nombre || '', { size: 20 }))]
        }),
        cell({
          width: columnWidths[2],
          children: [paragraph(textRun(p.cargo || '', { size: 20 }))]
        }),
        cell({
          width: columnWidths[3],
          children: [paragraph(textRun('', { size: 20 }))]
        })
      ]
    }));
  }

  return buildTable({
    columnWidths,
    rows: [
      sectionHeaderRow('Participantes', { columns: 4 }),
      new TableRow({
        tableHeader: true,
        height: { value: 320, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: columnWidths[0],
            shading: LIGHT_GRAY,
            children: [paragraph(textRun('', { bold: true }), { alignment: AlignmentType.CENTER })]
          }),
          cell({
            width: columnWidths[1],
            shading: LIGHT_GRAY,
            children: [paragraph(textRun('Nombres y Apellidos', { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })]
          }),
          cell({
            width: columnWidths[2],
            shading: LIGHT_GRAY,
            children: [paragraph(textRun('Cargo', { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })]
          }),
          cell({
            width: columnWidths[3],
            shading: LIGHT_GRAY,
            children: [paragraph(textRun('Firma', { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })]
          })
        ]
      }),
      ...filas
    ]
  });
};

const buildBlockTable = (title, bodyLines = []) => {
  const columnWidths = [CONTENT_WIDTH_TWIPS];
  const lines = bodyLines.length ? bodyLines : [''];
  const paragraphs = lines.map((line) =>
    paragraph(textRun(line, { size: 20 }), { alignment: AlignmentType.JUSTIFIED })
  );

  return buildTable({
    columnWidths,
    rows: [
      sectionHeaderRow(title, { columns: 1 }),
      new TableRow({
        height: { value: 1600, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: columnWidths[0],
            verticalAlign: VerticalAlign.TOP,
            children: paragraphs
          })
        ]
      })
    ]
  });
};

const spacerParagraph = () => new Paragraph({ spacing: { before: 0, after: 0, line: 60 }, children: [textRun('')] });

const buildActaDocument = (payload = {}) => {
  const {
    responsables = '',
    dependencia = '',
    lugar = '',
    fecha = '',
    horario = '',
    participantes = [],
    objetivo = [],
    desarrollo = [],
    conclusiones = []
  } = payload;

  const children = [
    buildHeaderTable(),
    buildBasicsTable({ responsables, dependencia }),
    buildInformacionReunionTable({ lugar, fecha, horario }),
    buildParticipantesTable(participantes),
    buildBlockTable('Objetivo', objetivo),
    buildBlockTable('Desarrollo', desarrollo),
    buildBlockTable('Conclusiones / Compromisos', conclusiones),
    spacerParagraph()
  ];

  return new Document({
    creator: 'Sistema de Gestión por Procesos - Universidad CESMAG',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 20 }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_WIDTH_TWIPS,
              height: PAGE_HEIGHT_TWIPS,
              orientation: PageOrientation.PORTRAIT
            },
            margin: {
              top: PAGE_MARGIN_TWIPS,
              right: PAGE_MARGIN_TWIPS,
              bottom: PAGE_MARGIN_TWIPS,
              left: PAGE_MARGIN_TWIPS
            }
          }
        },
        children
      }
    ]
  });
};

const generateActaBuffer = async (payload = {}) => {
  const doc = buildActaDocument(payload);
  return Packer.toBuffer(doc);
};

module.exports = {
  generateActaBuffer
};
