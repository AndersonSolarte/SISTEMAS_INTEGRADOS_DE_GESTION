const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const { PRIVACY_POLICY_PARAGRAPHS, PRIVACY_POLICY_URL } = require('../constants/privacyPolicy');
const { formatPersonName } = require('../utils/formatPersonName');

const printer = new PdfPrinter({
  SIAC: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
});

const headerImgPath = path.join(__dirname, '..', 'assets', 'fr012-header.png');
const footerImgPath = path.join(__dirname, '..', 'assets', 'fr012-footer.png');

const headerImage = fs.existsSync(headerImgPath)
  ? `data:image/png;base64,${fs.readFileSync(headerImgPath).toString('base64')}`
  : null;
const footerImage = fs.existsSync(footerImgPath)
  ? `data:image/png;base64,${fs.readFileSync(footerImgPath).toString('base64')}`
  : null;

const SPANISH_MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const formatCouncilDateLabel = (ciudad = 'San Juan de Pasto', fecha = '', fechaTexto = '') => {
  if (fechaTexto && String(fechaTexto).trim()) {
    return String(fechaTexto).trim();
  }
  const cleanCity = String(ciudad || 'San Juan de Pasto').trim() || 'San Juan de Pasto';
  const rawDate = String(fecha || '').trim();
  const match = rawDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    const day = Number(match[3]);
    const monthName = SPANISH_MONTHS[monthIndex] || match[2];
    return `${cleanCity}, ${day} de ${monthName} de ${year}`;
  }
  if (rawDate) {
    return cleanCity ? `${cleanCity}, ${rawDate}` : rawDate;
  }
  return cleanCity;
};

const formatActaHeading = (numeroActa = '') => {
  const clean = String(numeroActa || '').trim();
  if (!clean) return 'ACTA';
  if (/^ACTA\b/i.test(clean)) return clean.toLocaleUpperCase('es');
  return `ACTA  ${clean.toLocaleUpperCase('es')}`;
};

const formatMemberDisplayLine = (member = {}) => {
  const rawName = formatPersonName(member.nombre || member.name || '');
  const cargo = String(member.cargo || member.role_title || '').trim();
  if (!rawName && !cargo) return '';
  return [rawName, cargo].filter(Boolean).join(', ');
};

const formatSignerUpperName = (member = {}) => {
  const rawName = String(member.nombre || member.name || '').replace(/\s+/g, ' ').trim();
  return rawName.toLocaleUpperCase('es');
};

const decodeHtml = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;/gi, "'");

const joinSoftWrappedLines = (value = '') => {
  const paragraphs = String(value)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .reduce((text, line) => {
        if (!text) return line;
        return /^(?:[•\-]\s+|\d+[.)]\s+)/.test(line) ? `${text}\n${line}` : `${text} ${line}`;
      }, ''))
    .filter(Boolean);

  return paragraphs.join('\n\n');
};

const plainHtml = (value = '') => {
  const raw = String(value || '')
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (_, listBody) => {
      let idx = 0;
      return [...listBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((item) => `<p>${++idx}. ${item[1]}</p>`)
        .join('');
    })
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (_, listBody) => (
      [...listBody.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)]
        .map((item) => `<p>• ${item[1]}</p>`)
        .join('')
    ))
    .replace(/<(p|div)[^>]*>\s*(?:<br\s*\/?\s*>|&nbsp;|\s)*<\/\1>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*(p|h2|h3|blockquote)\s*>/gi, '\n\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');
  return joinSoftWrappedLines(decodeHtml(raw)).trim();
};

const borderLayout = {
  hLineWidth: () => 0.7,
  vLineWidth: () => 0.7,
  hLineColor: () => '#111111',
  vLineColor: () => '#111111',
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => 4,
  paddingBottom: () => 4
};

const noBorderMetadataLayout = {
  hLineWidth: () => 0,
  vLineWidth: () => 0,
  paddingLeft: () => 0,
  paddingRight: () => 6,
  paddingTop: () => 3,
  paddingBottom: () => 3
};

const richTable = (html = '') => {
  const body = [];
  let maxCells = 0;
  for (const rowMatch of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const header = cellMatch[1].toLowerCase() === 'th';
      row.push({
        text: plainHtml(cellMatch[2]),
        bold: header,
        fillColor: header ? '#f2f2f2' : undefined,
        alignment: header ? 'center' : 'left'
      });
    }
    if (row.length) {
      maxCells = Math.max(maxCells, row.length);
      body.push(row);
    }
  }
  if (!body.length) return null;
  for (const row of body) while (row.length < maxCells) row.push('');
  return {
    table: { widths: Array(maxCells).fill('*'), body, dontBreakRows: true },
    layout: borderLayout,
    margin: [0, 4, 0, 6]
  };
};

const richNodes = (lines = []) => {
  const source = (Array.isArray(lines) ? lines : [lines]).filter(Boolean).join('<br><br>');
  if (!source) return [{ text: '', margin: [0, 2] }];
  const nodes = [];
  for (const segment of source.split(/(<table[^>]*>[\s\S]*?<\/table>)/gi)) {
    if (!segment) continue;
    if (/^<table/i.test(segment)) {
      const table = richTable(segment);
      if (table) nodes.push(table);
    } else {
      const text = plainHtml(segment);
      if (text) {
        nodes.push({
          text,
          lineHeight: 1.3,
          alignment: 'justify',
          margin: [0, 2, 0, 6]
        });
      }
    }
  }
  return nodes.length ? nodes : [{ text: plainHtml(source), margin: [0, 2] }];
};

const resolveCouncilGroups = (payload = {}) => {
  const participants = Array.isArray(payload.participantes) ? payload.participantes : [];
  const asistentes = [];
  const invitadosConFirma = [];

  for (const p of participants) {
    const kind = String(p.member_kind || (String(p.attendance_type || p.tipo_asistencia || '').toLowerCase() === 'invitado' ? 'invitado' : 'miembro')).toLowerCase().trim();
    if (kind === 'invitado') {
      invitadosConFirma.push(p);
    } else {
      asistentes.push(p);
    }
  }

  const listaInicial = Array.isArray(payload.invitados_sin_firma_data)
    ? payload.invitados_sin_firma_data
    : [];
  const invitadosSinFirma = listaInicial.filter((item) => item.member_kind === 'invitado');
  const pendientes = listaInicial.filter((item) => item.member_kind !== 'invitado');
  const ausentes = Array.isArray(payload.ausentes_data)
    ? payload.ausentes_data.filter((item) => item.member_kind !== 'invitado')
    : [];

  return {
    asistentes,
    invitados: [...invitadosConFirma, ...invitadosSinFirma],
    pendientes,
    ausentes,
    firmantes: participants.filter((participant) => participant.requires_signature !== false)
  };
};

const buildMemberListStack = (members = [], emptyFallback = '') => {
  const lines = members.map(formatMemberDisplayLine).filter(Boolean);
  if (!lines.length) {
    return [{ text: emptyFallback, color: '#475569', italics: Boolean(emptyFallback) }];
  }
  return lines.map((line) => ({
    text: line,
    margin: [0, 0, 0, 2],
    lineHeight: 1.18
  }));
};

const buildPopulationTable = (title, members = [], emptyText = '') => {
  const body = [[
    { text: 'N°', bold: true, alignment: 'center', fillColor: '#f1f5f9' },
    { text: 'NOMBRES Y APELLIDOS', bold: true, fillColor: '#f1f5f9' },
    { text: 'CARGO / REPRESENTACIÓN', bold: true, fillColor: '#f1f5f9' }
  ]];
  if (members.length) {
    members.forEach((member, index) => {
      body.push([
        { text: String(index + 1), alignment: 'center' },
        { text: formatPersonName(member.nombre || member.name || ''), bold: true },
        String(member.cargo_acta || member.cargo || member.role_title || member.organization || '')
      ]);
    });
  } else {
    body.push([
      { text: emptyText, colSpan: 3, alignment: 'center', color: '#64748b', italics: true }, {}, {}
    ]);
  }
  return {
    margin: [0, 0, 0, 10],
    stack: [
      { text: title, bold: true, fontSize: 9.5, fillColor: '#dbe5f0', margin: [5, 4, 5, 4] },
      {
        table: { headerRows: 1, widths: [24, '*', 170], body },
        layout: {
          hLineColor: () => '#64748b',
          vLineColor: () => '#64748b',
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          paddingLeft: () => 4,
          paddingRight: () => 4,
          paddingTop: () => 3,
          paddingBottom: () => 3
        },
        fontSize: 8.5
      }
    ]
  };
};

const buildSignatureBlock = (participant = {}, options = {}) => {
  const signature = String(participant.firma_data_url || '');
  const isSigned = participant.status === 'signed' || String(participant.firma || '').toUpperCase().includes('FIRMADO');

  let signatureVisual;
  if (!options.hideSignatures && /^data:image\/(png|jpeg);base64,/i.test(signature)) {
    signatureVisual = { image: signature, fit: [130, 42], alignment: 'center', margin: [0, 0, 0, 4] };
  } else if (isSigned) {
    signatureVisual = {
      text: 'ORIGINAL FIRMADO',
      alignment: 'center',
      color: '#166534',
      bold: true,
      fontSize: 9,
      margin: [0, 14, 0, 6]
    };
  } else {
    signatureVisual = {
      text: participant.firma || 'Pendiente de firma',
      alignment: 'center',
      color: '#64748b',
      italics: true,
      fontSize: 8.5,
      margin: [0, 14, 0, 6]
    };
  }

  return {
    unbreakable: true,
    margin: [0, 10, 0, 14],
    stack: [
      signatureVisual,
      {
        canvas: [
          { type: 'line', x1: 25, y1: 0, x2: 205, y2: 0, lineWidth: 0.6, lineColor: '#334155' }
        ],
        alignment: 'center',
        margin: [0, 0, 0, 4]
      },
      {
        text: formatSignerUpperName(participant),
        bold: true,
        fontSize: 10,
        alignment: 'center'
      },
      {
        text: String(participant.cargo || '').trim(),
        fontSize: 9.5,
        alignment: 'center',
        margin: [0, 1, 0, 0]
      }
    ]
  };
};

const buildSignaturesGrid = (firmantes = [], options = {}) => {
  if (!firmantes.length) {
    return [{ text: 'Sin asistentes firmantes registrados.', italics: true, color: '#64748b', margin: [0, 8, 0, 8] }];
  }
  const rows = [];
  for (let i = 0; i < firmantes.length; i += 2) {
    if (i + 1 < firmantes.length) {
      rows.push({
        columns: [
          { width: '*', ...buildSignatureBlock(firmantes[i], options) },
          { width: '*', ...buildSignatureBlock(firmantes[i + 1], options) }
        ],
        columnGap: 24
      });
    } else {
      rows.push({
        columns: [
          { width: '*', text: '' },
          { width: 240, ...buildSignatureBlock(firmantes[i], options) },
          { width: '*', text: '' }
        ]
      });
    }
  }
  return rows;
};

const generateCouncilMinutePdf = async (payload = {}, options = {}) => {
  const header = payload.header || {};
  const { asistentes, invitados, pendientes, ausentes, firmantes } = resolveCouncilGroups(payload);
  const totalConvocados = asistentes.length + pendientes.length + ausentes.length;
  const quorumMinimo = totalConvocados ? Math.floor(totalConvocados / 2) + 1 : 0;
  const quorumLabel = pendientes.length
    ? `${pendientes.length} PENDIENTE(S) POR CLASIFICAR`
    : (asistentes.length >= quorumMinimo && totalConvocados ? 'HAY QUÓRUM' : 'NO HAY QUÓRUM');
  const councilName = String(
    payload.nombre_consejo || payload.dependencia || 'CONSEJO O COMITÉ INSTITUCIONAL'
  ).trim().toLocaleUpperCase('es');
  const actaHeading = formatActaHeading(payload.numero_acta);
  const fechaDisplay = formatCouncilDateLabel(payload.ciudad, payload.fecha, payload.fecha_texto);
  const ordenDelDiaSource = payload.orden_del_dia || payload.objetivo || '';
  const compromisosSource = payload.compromisos || payload.conclusiones || '';
  const anexoText = String(payload.anexo || '').trim();

  const metadataRows = [
    [
      { text: 'FECHA:', bold: true, fontSize: 10.5 },
      { text: fechaDisplay, fontSize: 10.5 }
    ],
    [
      { text: 'HORA:', bold: true, fontSize: 10.5 },
      { text: payload.horario || '', fontSize: 10.5 }
    ],
    [
      { text: 'LUGAR:', bold: true, fontSize: 10.5 },
      { text: payload.lugar || '', fontSize: 10.5 }
    ]
  ];

  const codeLabel = `${header.codigo || 'COM-GD-FR-012'}. - V.${header.version || '2'} - ${header.fecha || '15/SEP/2023'}`;

  const definition = {
    pageSize: 'LETTER',
    pageMargins: [56, 98, 56, 108],
    header: () => ({
      margin: [56, 18, 56, 0],
      stack: [
        headerImage
          ? { image: headerImage, fit: [480, 68], alignment: 'center' }
          : { text: 'UNIVERSIDAD CESMAG', bold: true, fontSize: 12, alignment: 'center', margin: [0, 16, 0, 0] }
      ]
    }),
    footer: (current, total) => ({
      margin: [56, 4, 56, 12],
      stack: [
        {
          text: `Página ${current} de ${total}`,
          bold: true,
          fontSize: 8.5,
          alignment: 'right',
          margin: [0, 0, 0, 3]
        },
        ...(footerImage
          ? [{ image: footerImage, fit: [495, 50], alignment: 'center', margin: [0, 0, 0, 2] }]
          : []),
        {
          text: 'Carrera 20A 14-54, PBX 7244434 – Pasto, Nariño, Colombia – correspondencia@unicesmag.edu.co – www.unicesmag.edu.co',
          fontSize: 7.5,
          color: '#002060',
          alignment: 'center',
          margin: [0, 1, 0, 1]
        },
        {
          text: codeLabel,
          fontSize: 7.5,
          color: '#808080',
          alignment: 'center'
        }
      ]
    }),
    content: [
      {
        text: councilName,
        bold: true,
        fontSize: 11.5,
        alignment: 'center',
        margin: [0, 4, 0, 12]
      },
      {
        text: actaHeading,
        bold: true,
        fontSize: 11.5,
        alignment: 'center',
        margin: [0, 0, 0, 16]
      },
      {
        table: {
          widths: [95, '*'],
          body: metadataRows
        },
        layout: noBorderMetadataLayout,
        margin: [0, 0, 0, 10]
      },
      buildPopulationTable('ASISTENTES', asistentes, 'Sin asistentes registrados'),
      buildPopulationTable('INVITADOS', invitados, 'Sin invitados registrados'),
      ...(pendientes.length ? [buildPopulationTable('PENDIENTES POR CLASIFICAR', pendientes, '')] : []),
      buildPopulationTable('AUSENTES', ausentes, 'Sin ausentes registrados'),
      {
        text: [
          { text: 'CONTROL DE QUÓRUM: ', bold: true },
          `${asistentes.length} asistentes de ${totalConvocados} convocados · mínimo requerido ${quorumMinimo} · `,
          { text: quorumLabel, bold: true }
        ],
        fontSize: 9,
        fillColor: '#f1f5f9',
        margin: [6, 5, 6, 10]
      },
      {
        text: 'ORDEN DEL DÍA:',
        bold: true,
        fontSize: 10.5,
        margin: [0, 6, 0, 6]
      },
      ...richNodes(ordenDelDiaSource),
      {
        text: 'DESARROLLO:',
        bold: true,
        fontSize: 10.5,
        margin: [0, 10, 0, 6]
      },
      ...richNodes(payload.desarrollo),
      {
        text: 'COMPROMISOS.',
        bold: true,
        fontSize: 10.5,
        margin: [0, 10, 0, 6]
      },
      ...richNodes(compromisosSource),
      {
        text: 'FIRMAS DE LOS ASISTENTES',
        bold: true,
        fontSize: 10.5,
        margin: [0, 16, 0, 8]
      },
      ...buildSignaturesGrid(firmantes, options),
      ...(anexoText
        ? [{
          text: [{ text: 'Anexo: ', bold: false }, { text: anexoText }],
          fontSize: 10,
          margin: [0, 10, 0, 8]
        }]
        : []),
      {
        unbreakable: false,
        margin: [0, 14, 0, 0],
        stack: [
          { text: 'TRATAMIENTO DE DATOS PERSONALES', bold: true, color: '#174ea6', fontSize: 8.5, margin: [0, 0, 0, 4] },
          ...PRIVACY_POLICY_PARAGRAPHS.map((paragraph) => ({
            text: paragraph,
            fontSize: 7,
            color: '#475569',
            lineHeight: 1.18,
            margin: [0, 0, 0, 4]
          })),
          {
            text: 'Consultar la política institucional completa',
            link: PRIVACY_POLICY_URL,
            decoration: 'underline',
            color: '#174ea6',
            fontSize: 7
          }
        ]
      }
    ],
    defaultStyle: {
      font: 'SIAC',
      fontSize: 10,
      color: '#111111'
    }
  };

  const pdf = printer.createPdfKitDocument(definition);
  const chunks = [];
  return new Promise((resolve, reject) => {
    pdf.on('data', (chunk) => chunks.push(chunk));
    pdf.on('end', () => resolve(Buffer.concat(chunks)));
    pdf.on('error', reject);
    pdf.end();
  });
};

module.exports = {
  generateCouncilMinutePdf,
  _internals: {
    formatCouncilDateLabel,
    formatActaHeading,
    formatMemberDisplayLine,
    formatSignerUpperName,
    resolveCouncilGroups,
    plainHtml
  }
};
