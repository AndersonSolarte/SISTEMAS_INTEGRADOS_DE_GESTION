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
  Header,
  Footer,
  ExternalHyperlink,
  AlignmentType,
  VerticalAlign,
  WidthType,
  BorderStyle,
  ShadingType,
  PageOrientation,
  TableLayoutType
} = require('docx');
const { _internals: pdfInternals } = require('./councilMinutePdfService');

const {
  formatCouncilDateLabel,
  formatActaHeading,
  formatMemberDisplayLine,
  formatSignerUpperName,
  resolveCouncilGroups
} = pdfInternals;

const HEADER_IMG_PATH = path.join(__dirname, '..', 'assets', 'fr012-header.png');
const FOOTER_IMG_PATH = path.join(__dirname, '..', 'assets', 'fr012-footer.png');

const PAGE_WIDTH_TWIPS = 12240;
const PAGE_HEIGHT_TWIPS = 15840;
const PAGE_MARGIN_TOP_TWIPS = 1800;
const PAGE_MARGIN_BOTTOM_TWIPS = 1600;
const PAGE_MARGIN_SIDE_TWIPS = 1440;
const CONTENT_WIDTH_TWIPS = PAGE_WIDTH_TWIPS - PAGE_MARGIN_SIDE_TWIPS * 2;

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER
};

const thinBorder = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
const LIGHT_GRAY = 'F2F2F2';

const textRun = (text, opts = {}) =>
  new TextRun({
    text: text === undefined || text === null ? '' : String(text),
    bold: Boolean(opts.bold),
    italics: Boolean(opts.italics),
    underline: opts.underline ? {} : undefined,
    size: opts.size || 22,
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

const decodeHtml = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

const plainHtml = (value = '') => decodeHtml(
  String(value).replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')
).trim();

const wordColor = (value = '') => {
  const hex = String(value).match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex) return hex.toUpperCase();
  const rgb = String(value).match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
  return rgb
    ? rgb.slice(1).map((part) => Math.min(255, Number(part)).toString(16).padStart(2, '0')).join('').toUpperCase()
    : '000000';
};

const inlineRunsFromHtml = (value = '', { bold: initialBold = false, italics: initialItalics = false, size: initialSize = 22 } = {}) => {
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
      if (rawColor) color = wordColor(rawColor.trim());
      if (rawFont && /^(Arial|Georgia|Times New Roman|Verdana|sans-serif)$/i.test(rawFont.trim())) font = rawFont.trim();
      if (rawSize) size = Math.round(Number(rawSize[1]) * (rawSize[2].toLowerCase() === 'px' ? 1.5 : 2));
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
  return runs.length ? runs : [textRun('', { size: 22 })];
};

const alignmentFromAttributes = (attributes = '', fallback = AlignmentType.JUSTIFIED) => {
  const alignment = /text-align\s*:\s*(left|center|right|justify)/i.exec(attributes)?.[1]?.toLowerCase();
  return alignment === 'center' ? AlignmentType.CENTER
    : alignment === 'right' ? AlignmentType.RIGHT
      : alignment === 'justify' ? AlignmentType.JUSTIFIED
        : alignment === 'left' ? AlignmentType.LEFT
          : fallback;
};

const richTableFromHtml = (html = '') => {
  const rows = [];
  for (const rowMatch of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)([^>]*)>([\s\S]*?)<\/\1>/gi)) {
      const isHeader = cellMatch[1].toLowerCase() === 'th';
      cells.push(new TableCell({
        shading: isHeader ? { type: ShadingType.CLEAR, color: 'auto', fill: LIGHT_GRAY } : undefined,
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        children: [
          paragraph(inlineRunsFromHtml(cellMatch[3], { bold: isHeader }), {
            alignment: alignmentFromAttributes(cellMatch[2], isHeader ? AlignmentType.CENTER : AlignmentType.LEFT)
          })
        ]
      }));
    }
    if (cells.length) rows.push(new TableRow({ children: cells }));
  }
  if (!rows.length) return null;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: {
      top: thinBorder,
      bottom: thinBorder,
      left: thinBorder,
      right: thinBorder,
      insideHorizontal: thinBorder,
      insideVertical: thinBorder
    },
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
  normalized = normalized.replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listBody) => (
    [...listBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((item) => `<p>• ${item[1]}</p>`).join('')
  ));
  normalized = normalized.replace(/<hr\s*\/?\s*>/gi, '<p>────────────────────────</p>').replace(/<br\s*\/?\s*>/gi, '<p></p>');
  const blockPattern = /<(h2|h3|p|div|li|blockquote)([^>]*)>([\s\S]*?)<\/\1>/gi;
  let cursor = 0;
  for (const match of normalized.matchAll(blockPattern)) {
    const before = normalized.slice(cursor, match.index);
    if (plainHtml(before)) nodes.push(paragraph(inlineRunsFromHtml(before), { alignment: AlignmentType.JUSTIFIED, after: 80 }));
    const tag = match[1].toLowerCase();
    const prefix = tag === 'li' ? [textRun('• ', { bold: true, size: 22 })] : [];
    nodes.push(paragraph([...prefix, ...inlineRunsFromHtml(match[3], { bold: tag === 'h2' || tag === 'h3' })], {
      alignment: alignmentFromAttributes(match[2], AlignmentType.JUSTIFIED),
      after: 80
    }));
    cursor = match.index + match[0].length;
  }
  const after = normalized.slice(cursor);
  if (plainHtml(after)) nodes.push(paragraph(inlineRunsFromHtml(after), { alignment: AlignmentType.JUSTIFIED, after: 80 }));
  return nodes;
};

const richContentNodes = (bodyLines = []) => {
  const source = (Array.isArray(bodyLines) ? bodyLines : [bodyLines]).filter(Boolean).join('<br>');
  if (!source) return [paragraph(textRun('', { size: 22 }), { after: 80 })];
  if (!/<[a-z][\s\S]*>/i.test(source)) {
    return source.split(/\r?\n/).map((line) => paragraph(textRun(line, { size: 22 }), { alignment: AlignmentType.JUSTIFIED, after: 80 }));
  }
  const nodes = [];
  for (const segment of source.split(/(<table[^>]*>[\s\S]*?<\/table>)/gi)) {
    if (!segment) continue;
    if (/^<table/i.test(segment)) {
      const table = richTableFromHtml(segment);
      if (table) nodes.push(table);
    } else {
      nodes.push(...richParagraphsFromHtml(segment));
    }
  }
  return nodes.length ? nodes : [paragraph(textRun(plainHtml(source), { size: 22 }), { after: 80 })];
};

const buildMetadataRow = (label, valueParagraphs) =>
  new TableRow({
    children: [
      new TableCell({
        width: { size: 1900, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        borders: NO_BORDERS,
        children: [paragraph(textRun(label, { bold: true, size: 22 }), { after: 60 })]
      }),
      new TableCell({
        width: { size: CONTENT_WIDTH_TWIPS - 1900, type: WidthType.DXA },
        verticalAlign: VerticalAlign.TOP,
        borders: NO_BORDERS,
        children: valueParagraphs
      })
    ]
  });

const buildMemberParagraphs = (members = []) => {
  const lines = members.map(formatMemberDisplayLine).filter(Boolean);
  if (!lines.length) {
    return [paragraph(textRun('', { size: 22 }), { after: 60 })];
  }
  return lines.map((line) => paragraph(textRun(line, { size: 22 }), { after: 40 }));
};

const buildPopulationTable = (title, members = [], emptyText = '') => {
  const columnWidths = [600, 4300, CONTENT_WIDTH_TWIPS - 4900];
  const cell = (text, index, { bold = false, alignment = AlignmentType.LEFT, shading } = {}) => new TableCell({
    width: { size: columnWidths[index], type: WidthType.DXA },
    borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
    verticalAlign: VerticalAlign.CENTER,
    shading: shading ? { fill: shading, type: ShadingType.CLEAR } : undefined,
    children: [paragraph(textRun(text, { bold, size: 18 }), { alignment, after: 20, before: 20 })]
  });
  const rows = [
    new TableRow({
      tableHeader: true,
      children: [
        cell('N°', 0, { bold: true, alignment: AlignmentType.CENTER, shading: LIGHT_GRAY }),
        cell('NOMBRES Y APELLIDOS', 1, { bold: true, shading: LIGHT_GRAY }),
        cell('CARGO / REPRESENTACIÓN', 2, { bold: true, shading: LIGHT_GRAY })
      ]
    })
  ];
  if (members.length) {
    members.forEach((member, index) => {
      rows.push(new TableRow({
        children: [
          cell(String(index + 1), 0, { alignment: AlignmentType.CENTER }),
          cell(formatPersonName(member.nombre || member.name || ''), 1, { bold: true }),
          cell(member.cargo_acta || member.cargo || member.role_title || member.organization || '', 2)
        ]
      }));
    });
  } else {
    rows.push(new TableRow({
      children: [new TableCell({
        columnSpan: 3,
        width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
        borders: { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder },
        children: [paragraph(textRun(emptyText, { italics: true, size: 18, color: '64748B' }), { alignment: AlignmentType.CENTER, after: 30, before: 30 })]
      })]
    }));
  }
  return [
    paragraph(textRun(title, { bold: true, size: 20 }), { before: 100, after: 60 }),
    new Table({
      width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths,
      rows
    })
  ];
};

const buildSignatureCellContent = (participant = {}) => {
  const signatureMatch = String(participant.firma_data_url || '').match(/^data:image\/(?:png|jpeg);base64,([A-Za-z0-9+/=]+)$/);
  const isSigned = participant.status === 'signed' || String(participant.firma || '').toUpperCase().includes('FIRMADO');
  const signatureParagraph = signatureMatch
    ? new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 120, after: 40 },
      children: [
        new ImageRun({
          data: Buffer.from(signatureMatch[1], 'base64'),
          transformation: { width: 130, height: 42 }
        })
      ]
    })
    : paragraph(
      textRun(isSigned ? 'ORIGINAL FIRMADO' : (participant.firma || ''), {
        bold: isSigned,
        italics: !isSigned,
        color: isSigned ? '166534' : '64748B',
        size: 18
      }),
      { alignment: AlignmentType.CENTER, before: 240, after: 40 }
    );

  return [
    signatureParagraph,
    paragraph(textRun(formatSignerUpperName(participant), { bold: true, size: 22 }), {
      alignment: AlignmentType.CENTER,
      before: 40,
      after: 20
    }),
    paragraph(textRun(String(participant.cargo || '').trim(), { size: 22 }), {
      alignment: AlignmentType.CENTER,
      after: 180
    })
  ];
};

const buildSignaturesSection = (firmantes = []) => {
  if (!firmantes.length) {
    return [paragraph(textRun('', { size: 22 }))];
  }
  const halfWidth = Math.floor(CONTENT_WIDTH_TWIPS / 2);
  const rows = [];
  for (let i = 0; i < firmantes.length; i += 2) {
    if (i + 1 < firmantes.length) {
      rows.push(new TableRow({
        children: [
          new TableCell({
            width: { size: halfWidth, type: WidthType.DXA },
            borders: NO_BORDERS,
            children: buildSignatureCellContent(firmantes[i])
          }),
          new TableCell({
            width: { size: CONTENT_WIDTH_TWIPS - halfWidth, type: WidthType.DXA },
            borders: NO_BORDERS,
            children: buildSignatureCellContent(firmantes[i + 1])
          })
        ]
      }));
    } else {
      rows.push(new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
            borders: NO_BORDERS,
            children: buildSignatureCellContent(firmantes[i])
          })
        ]
      }));
    }
  }

  return [
    new Table({
      width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
      layout: TableLayoutType.FIXED,
      columnWidths: [halfWidth, CONTENT_WIDTH_TWIPS - halfWidth],
      borders: NO_BORDERS,
      rows
    })
  ];
};

const buildCouncilDocument = (payload = {}) => {
  const header = payload.header || {};
  const { asistentes, invitados, ausentes, firmantes } = resolveCouncilGroups(payload);
  const totalConvocados = asistentes.length + ausentes.length;
  const quorumMinimo = totalConvocados ? Math.floor(totalConvocados / 2) + 1 : 0;
  const quorumLabel = asistentes.length >= quorumMinimo && totalConvocados ? 'HAY QUÓRUM' : 'NO HAY QUÓRUM';
  const councilName = String(
    payload.nombre_consejo || payload.dependencia || 'CONSEJO O COMITÉ INSTITUCIONAL'
  ).trim().toLocaleUpperCase('es');
  const actaHeading = formatActaHeading(payload.numero_acta);
  const fechaDisplay = formatCouncilDateLabel(payload.ciudad, payload.fecha, payload.fecha_texto);
  const ordenDelDiaSource = payload.orden_del_dia || payload.objetivo || '';
  const compromisosSource = payload.compromisos || payload.conclusiones || '';
  const anexoText = String(payload.anexo || '').trim();
  const codeLabel = `${header.codigo || 'COM-GD-FR-012'}. - V.${header.version || '2'} - ${header.fecha || '15/SEP/2023'}`;

  const metadataTable = new Table({
    width: { size: CONTENT_WIDTH_TWIPS, type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    columnWidths: [1900, CONTENT_WIDTH_TWIPS - 1900],
    borders: NO_BORDERS,
    rows: [
      buildMetadataRow('FECHA:', [paragraph(textRun(fechaDisplay, { size: 22 }), { after: 60 })]),
      buildMetadataRow('HORA:', [paragraph(textRun(payload.horario || '', { size: 22 }), { after: 60 })]),
      buildMetadataRow('LUGAR:', [paragraph(textRun(payload.lugar || '', { size: 22 }), { after: 60 })])
    ]
  });

  const headerChildren = fs.existsSync(HEADER_IMG_PATH)
    ? [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 0, after: 120 },
        children: [
          new ImageRun({
            data: fs.readFileSync(HEADER_IMG_PATH),
            transformation: { width: 560, height: 84 }
          })
        ]
      })
    ]
    : [paragraph(textRun('UNIVERSIDAD CESMAG', { bold: true, size: 24 }), { alignment: AlignmentType.CENTER })];

  const footerChildren = [
    ...(fs.existsSync(FOOTER_IMG_PATH)
      ? [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [
            new ImageRun({
              data: fs.readFileSync(FOOTER_IMG_PATH),
              transformation: { width: 560, height: 58 }
            })
          ]
        })
      ]
      : []),
    paragraph(
      textRun('Carrera 20A 14-54, PBX 7244434 – Pasto, Nariño, Colombia – correspondencia@unicesmag.edu.co – www.unicesmag.edu.co', {
        size: 16,
        color: '002060'
      }),
      { alignment: AlignmentType.CENTER, after: 20 }
    ),
    paragraph(textRun(codeLabel, { size: 16, color: '808080' }), { alignment: AlignmentType.CENTER })
  ];

  const children = [
    paragraph(textRun(councilName, { bold: true, size: 22 }), {
      alignment: AlignmentType.CENTER,
      before: 80,
      after: 200
    }),
    paragraph(textRun(actaHeading, { bold: true, size: 22 }), {
      alignment: AlignmentType.CENTER,
      after: 260
    }),
    metadataTable,
    ...buildPopulationTable('ASISTENTES', asistentes, 'Sin asistentes registrados'),
    ...buildPopulationTable('INVITADOS', invitados, 'Sin invitados registrados'),
    ...buildPopulationTable('AUSENTES', ausentes, 'Sin ausentes registrados'),
    paragraph([
      textRun('CONTROL DE QUÓRUM: ', { bold: true, size: 19 }),
      textRun(`${asistentes.length} asistentes de ${totalConvocados} convocados · mínimo requerido ${quorumMinimo} · `, { size: 19 }),
      textRun(quorumLabel, { bold: true, size: 19 })
    ], { before: 100, after: 120 }),
    paragraph(textRun('ORDEN DEL DÍA:', { bold: true, size: 22 }), {
      before: 220,
      after: 120
    }),
    ...richContentNodes(ordenDelDiaSource),
    paragraph(textRun('DESARROLLO:', { bold: true, size: 22 }), {
      before: 220,
      after: 120
    }),
    ...richContentNodes(payload.desarrollo),
    paragraph(textRun('COMPROMISOS.', { bold: true, size: 22 }), {
      before: 220,
      after: 120
    }),
    ...richContentNodes(compromisosSource),
    paragraph(textRun('FIRMAS DE LOS ASISTENTES', { bold: true, size: 22 }), {
      before: 260,
      after: 160
    }),
    ...buildSignaturesSection(firmantes),
    ...(anexoText
      ? [
        paragraph([
          textRun('Anexo: ', { size: 22 }),
          textRun(anexoText, { size: 22 })
        ], { before: 160, after: 120 })
      ]
      : [])
  ];

  return new Document({
    creator: 'SIAC UNICESMAG - Sistema Interno de Aseguramiento de la Calidad',
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 }
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
              top: PAGE_MARGIN_TOP_TWIPS,
              right: PAGE_MARGIN_SIDE_TWIPS,
              bottom: PAGE_MARGIN_BOTTOM_TWIPS,
              left: PAGE_MARGIN_SIDE_TWIPS
            }
          }
        },
        headers: {
          default: new Header({ children: headerChildren })
        },
        footers: {
          default: new Footer({ children: footerChildren })
        },
        children
      }
    ]
  });
};

const generateCouncilActaBuffer = async (payload = {}) => {
  const doc = buildCouncilDocument(payload);
  return Packer.toBuffer(doc);
};

module.exports = {
  generateCouncilActaBuffer
};
