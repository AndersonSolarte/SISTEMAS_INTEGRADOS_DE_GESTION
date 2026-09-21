const path = require('path');
const fs = require('fs');
const { formatPersonName } = require('../utils/formatPersonName');
const {
  Document,
  Packer,
  Paragraph,
  Table,
  TableRow,
  TableCell,
  TextRun,
  ImageRun,
  ExternalHyperlink,
  AlignmentType,
  VerticalAlign,
  WidthType,
  BorderStyle,
  HeightRule,
  ShadingType,
  PageOrientation,
  TableLayoutType
} = require('docx');

const LOGO_PATH = path.join(__dirname, '..', 'assets', 'logo_formatos.jpg');

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
    underline: opts.underline ? {} : undefined,
    size: opts.size || 20,
    font: opts.font || 'Arial',
    color: opts.color || '000000'
  });

const paragraph = (runs = [], opts = {}) =>
  new Paragraph({
    alignment: opts.alignment || AlignmentType.LEFT,
    indent: opts.indent ? { left: opts.indent } : undefined,
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

const buildHeaderTable = (header = {}) => {
  const resolvedHeader = { ...ACTA_HEADER, ...(header || {}) };
  const logoParagraph = fs.existsSync(LOGO_PATH)
    ? new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 0 },
        children: [
          new ImageRun({
            data: fs.readFileSync(LOGO_PATH),
            transformation: { width: 150, height: 54 }
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
              paragraph(textRun(resolvedHeader.titulo, { bold: true, size: 28 }), {
                alignment: AlignmentType.CENTER
              })
            ]
          }),
          cell({
            width: columnWidths[2],
            children: [
              paragraph(textRun(`CÓDIGO: ${resolvedHeader.codigo}`, { bold: true, size: 18 })),
              paragraph(textRun(`VERSIÓN: ${resolvedHeader.version}`, { bold: true, size: 18 })),
              paragraph(textRun(`FECHA: ${resolvedHeader.fecha}`, { bold: true, size: 18 }))
            ]
          })
        ]
      })
    ]
  });
};

const parseResponsablesFromText = (responsables, responsablesData) => {
  if (Array.isArray(responsablesData) && responsablesData.length > 0) {
    return responsablesData;
  }
  if (typeof responsables === 'string' && responsables.trim()) {
    const lines = responsables.split('\n').map((l) => l.replace(/^[•\-\*\s]+/, '').trim()).filter(Boolean);
    return lines.map((line, idx) => {
      const match = line.match(/^([^(]+)(?:\((.*)\))?$/);
      if (match) {
        return { name: match[1].trim(), role_title: (match[2] || '').trim(), is_primary: idx === 0 };
      }
      return { name: line, role_title: '', is_primary: idx === 0 };
    });
  }
  return [];
};

const buildBasicsTable = ({ responsables, responsables_data, dependencia }) => {
  const columnWidths = [CONTENT_WIDTH_TWIPS];
  const items = parseResponsablesFromText(responsables, responsables_data);

  const responsablesChildren = [
    paragraph([textRun('Responsable(s):', { bold: true, size: 20 })], { after: items.length ? 60 : 0 })
  ];

  if (!items.length) {
    responsablesChildren.push(
      paragraph([textRun('(Sin asignar)', { size: 20, italics: true, color: '64748B' })])
    );
  } else {
    const subRows = items.map((r, idx) => {
      const isPrimary = Boolean(r.is_primary) || idx === 0;
      const roleOrg = [r.role_title, r.organization].filter(Boolean).join(' · ');
      const tag = isPrimary ? 'RESPONSABLE PRINCIPAL' : 'CO-RESPONSABLE';

      return new TableRow({
        children: [
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS - 240, type: WidthType.DXA },
            shading: { type: ShadingType.CLEAR, color: 'auto', fill: isPrimary ? 'F8FAFC' : 'FFFFFF' },
            borders: {
              top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
              bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
              left: { style: BorderStyle.SINGLE, size: isPrimary ? 16 : 8, color: isPrimary ? '1E3A8A' : '64748B' },
              right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' }
            },
            children: [
              paragraph([
                textRun(tag, { bold: true, size: 16, color: isPrimary ? '1E3A8A' : '475569' })
              ], { before: 40, after: 20, indent: 80 }),
              paragraph([
                textRun(formatPersonName(r.name || ''), { bold: true, size: 20, color: '0F172A' })
              ], { before: 0, after: roleOrg ? 20 : 40, indent: 80 }),
              ...(roleOrg ? [
                paragraph([
                  textRun(roleOrg, { size: 18, color: '475569' })
                ], { before: 0, after: 40, indent: 80 })
              ] : [])
            ]
          })
        ]
      });
    });

    const subTable = new Table({
      width: { size: CONTENT_WIDTH_TWIPS - 240, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [CONTENT_WIDTH_TWIPS - 240],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE }
      },
      rows: subRows
    });

    responsablesChildren.push(subTable);
    responsablesChildren.push(paragraph([], { after: 30 }));
  }

  return buildTable({
    columnWidths,
    rows: [
      new TableRow({
        height: { value: 420, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: columnWidths[0],
            children: responsablesChildren
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
    const signatureMatch = String(p.firma_data_url || '').match(/^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
    const isSigned = p.status === 'signed' || String(p.firma || '').toUpperCase().includes('FIRMADO');
    const signatureText = isSigned ? 'ORIGINAL FIRMADO' : (p.firma || '');
    const signatureParagraph = signatureMatch
      ? new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 0, after: 0 }, children: [new ImageRun({ data: Buffer.from(signatureMatch[1], 'base64'), transformation: { width: 105, height: 34 } })] })
      : paragraph(textRun(signatureText, { bold: isSigned, color: isSigned ? '166534' : '64748b', size: 18 }), { alignment: AlignmentType.CENTER });
    filas.push(new TableRow({
      height: { value: 360, rule: HeightRule.ATLEAST },
      children: [
        cell({
          width: columnWidths[0],
          children: [paragraph(textRun(String(i + 1), { bold: true, size: 20 }), { alignment: AlignmentType.CENTER })]
        }),
        cell({
          width: columnWidths[1],
          children: [paragraph(textRun(formatPersonName(p.nombre || ''), { size: 20 }))]
        }),
        cell({
          width: columnWidths[2],
          children: [paragraph(textRun(p.cargo || '', { size: 20 }))]
        }),
        cell({
          width: columnWidths[3],
          children: [signatureParagraph]
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

const decodeHtml = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

const plainHtml = (value = '') => decodeHtml(String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')).trim();

const wordColor = (value = '') => {
  const hex = String(value).match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) return hex.toUpperCase();
  const rgb = String(value).match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  return rgb ? rgb.slice(1).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('').toUpperCase() : '000000';
};

const inlineRunsFromHtml = (value = '', { bold: initialBold = false, italics: initialItalics = false, size: initialSize = 20 } = {}) => {
  const tokens = String(value).split(/(<[^>]+>)/g);
  let bold = initialBold;
  let italics = initialItalics;
  let underline = false;
  let color = '000000';
  let font = 'Arial';
  let size = initialSize;
  let link = '';
  const runs = [];
  for (const token of tokens) {
    if (/^<(strong|b)(?:\s[^>]*)?>$/i.test(token)) { bold = true; continue; }
    if (/^<\/(strong|b)>$/i.test(token)) { bold = initialBold; continue; }
    if (/^<(em|i)(?:\s[^>]*)?>$/i.test(token)) { italics = true; continue; }
    if (/^<\/(em|i)>$/i.test(token)) { italics = initialItalics; continue; }
    if (/^<u(?:\s[^>]*)?>$/i.test(token)) { underline = true; continue; }
    if (/^<\/u>$/i.test(token)) { underline = false; continue; }
    if (/^<a\b/i.test(token)) { link = /href=["']([^"']+)["']/i.exec(token)?.[1] || ''; underline = true; color = '1D5FD1'; continue; }
    if (/^<\/a>$/i.test(token)) { link = ''; underline = false; color = '000000'; continue; }
    if (/^<(font|span)\b/i.test(token)) {
      const rawColor = /color\s*:\s*([^;"']+)/i.exec(token)?.[1] || /\bcolor=["']([^"']+)["']/i.exec(token)?.[1];
      const rawFont = /font-family\s*:\s*([^;"']+)/i.exec(token)?.[1] || /\bface=["']([^"']+)["']/i.exec(token)?.[1];
      const rawSize = /font-size\s*:\s*(\d{1,2})(px|pt)/i.exec(token);
      const legacySize = Number(/\bsize=["']?([1-7])/i.exec(token)?.[1] || 0);
      if (rawColor) color = wordColor(rawColor.trim());
      if (rawFont && /^(Arial|Georgia|Times New Roman|Verdana|sans-serif)$/i.test(rawFont.trim())) font = rawFont.trim();
      if (rawSize) size = Math.round(Number(rawSize[1]) * (rawSize[2].toLowerCase() === 'px' ? 1.5 : 2));
      if (legacySize) size = [0, 16, 18, 20, 24, 28, 32, 36][legacySize];
      continue;
    }
    if (/^<\/(font|span)>$/i.test(token)) { color = '000000'; font = 'Arial'; size = initialSize; continue; }
    if (/^<[^>]+>$/.test(token)) continue;
    const text = decodeHtml(token.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, ''));
    if (text) {
      const run = textRun(text, { size, bold, italics, underline, color, font });
      runs.push(link ? new ExternalHyperlink({ link, children: [run] }) : run);
    }
  }
  return runs.length ? runs : [textRun('', { size: 20 })];
};

const alignmentFromAttributes = (attributes = '') => {
  const alignment = /text-align\s*:\s*(left|center|right|justify)/i.exec(attributes)?.[1]?.toLowerCase();
  return alignment === 'center' ? AlignmentType.CENTER
    : alignment === 'right' ? AlignmentType.RIGHT
      : alignment === 'justify' ? AlignmentType.JUSTIFIED
        : AlignmentType.LEFT;
};

const richTableFromHtml = (html = '') => {
  const rows = [];
  for (const rowMatch of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      const isHeader = cellMatch[1].toLowerCase() === 'th';
      cells.push(cell({
        shading: isHeader ? LIGHT_GRAY : undefined,
        children: [paragraph(inlineRunsFromHtml(cellMatch[3], { bold: isHeader }), { alignment: alignmentFromAttributes(cellMatch[2]) })]
      }));
    }
    if (cells.length) rows.push(new TableRow({ children: cells }));
  }
  if (!rows.length) return null;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin },
    rows
  });
};

const richParagraphsFromHtml = (html = '') => {
  const nodes = [];
  let normalized = String(html);
  normalized = normalized.replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listBody) => {
    let index = 0;
    return [...listBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => `<p>${++index}. ${item[1]}</p>`).join('');
  });
  normalized = normalized.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listBody) => [...listBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => `<p>• ${item[1]}</p>`).join(''));
  normalized = normalized.replace(/<hr\s*\/?\s*>/gi, '<p>────────────────────────</p>').replace(/<br\s*\/?\s*>/gi, '<p></p>');
  const blockPattern = /<(h2|h3|p|div|li|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let cursor = 0;
  for (const match of normalized.matchAll(blockPattern)) {
    const before = normalized.slice(cursor, match.index);
    if (plainHtml(before)) nodes.push(paragraph(inlineRunsFromHtml(before)));
    const tag = match[1].toLowerCase();
    const prefix = tag === 'li' ? [textRun('• ', { bold: true, size: 20 })] : tag === 'blockquote' ? [textRun('“ ', { bold: true, size: 22, color: '64748B' })] : [];
    const indentPixels = Number(/margin-left\s*:\s*(\d{1,3})px/i.exec(match[2])?.[1] || 0);
    nodes.push(paragraph([...prefix, ...inlineRunsFromHtml(match[3], { bold: tag === 'h2' || tag === 'h3', italics: tag === 'blockquote', size: tag === 'h2' || tag === 'h3' ? 24 : 20 })], {
      alignment: alignmentFromAttributes(match[2]),
      indent: indentPixels ? indentPixels * 15 : tag === 'blockquote' ? 360 : 0,
      before: tag === 'h2' || tag === 'h3' ? 80 : 0,
      after: 40
    }));
    cursor = match.index + match[0].length;
  }
  const after = normalized.slice(cursor);
  if (plainHtml(after)) nodes.push(paragraph(inlineRunsFromHtml(after)));
  return nodes;
};

const richContentNodes = (bodyLines = []) => {
  const source = (Array.isArray(bodyLines) ? bodyLines : [bodyLines]).filter(Boolean).join('<br>');
  if (!source) return [paragraph(textRun('', { size: 20 }))];
  if (!/<[a-z][\s\S]*>/i.test(source)) return source.split(/\r?\n/).map((line) => paragraph(textRun(line, { size: 20 }), { alignment: AlignmentType.JUSTIFIED }));
  const nodes = [];
  for (const segment of source.split(/(<table[^>]*>[\s\S]*?<\/table>)/gi)) {
    if (!segment) continue;
    if (/^<table/i.test(segment)) {
      const table = richTableFromHtml(segment);
      if (table) nodes.push(table);
    } else nodes.push(...richParagraphsFromHtml(segment));
  }
  return nodes.length ? nodes : [paragraph(textRun(plainHtml(source), { size: 20 }))];
};

const buildBlockTable = (title, bodyLines = []) => {
  const columnWidths = [CONTENT_WIDTH_TWIPS];
  const contentNodes = richContentNodes(bodyLines);

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
            children: contentNodes
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
    responsables_data = [],
    dependencia = '',
    lugar = '',
    fecha = '',
    horario = '',
    participantes = [],
    objetivo = [],
    desarrollo = [],
    conclusiones = [],
    header = null
  } = payload;

  const children = [
    buildHeaderTable(header),
    buildBasicsTable({ responsables, responsables_data, dependencia }),
    buildInformacionReunionTable({ lugar, fecha, horario }),
    buildParticipantesTable(participantes),
    buildBlockTable('Objetivo', objetivo),
    spacerParagraph(),
    buildBlockTable('Desarrollo', desarrollo),
    spacerParagraph(),
    buildBlockTable('Conclusiones / Compromisos', conclusiones),
    spacerParagraph()
  ];

  return new Document({
    creator: 'SIAC UNICESMAG - Sistema Interno de Aseguramiento de la Calidad',
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
