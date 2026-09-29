const fs = require('fs');
const path = require('path');
const PdfPrinter = require('pdfmake');
const { PRIVACY_POLICY_PARAGRAPHS, PRIVACY_POLICY_URL } = require('../constants/privacyPolicy');
const { formatPersonName } = require('../utils/formatPersonName');

const printer = new PdfPrinter({
  SIAC: { normal: 'Helvetica', bold: 'Helvetica-Bold', italics: 'Helvetica-Oblique', bolditalics: 'Helvetica-BoldOblique' }
});

const logoPath = path.join(__dirname, '..', 'assets', 'logo_formatos.jpg');
const logo = fs.existsSync(logoPath) ? `data:image/jpeg;base64,${fs.readFileSync(logoPath).toString('base64')}` : null;

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

const decodeHtml = (value = '') => String(value)
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");

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
        return /^[•\-]\s+/.test(line) ? `${text}\n${line}` : `${text} ${line}`;
      }, ''))
    .filter(Boolean);

  return paragraphs.reduce((result, paragraph) => {
    if (!result.length) return [paragraph];
    const previous = result[result.length - 1];
    const standaloneListMarker = /^(?:\d+[.)]?|[•.\-])$/u.test(previous.trim());
    const previousCompletesParagraph = /[.!?;:]$/u.test(previous.trim());
    const nextStartsListItem = /^(?:[•\-]\s+|\d+[.)]\s+)/u.test(paragraph);
    if (standaloneListMarker || (!previousCompletesParagraph && !nextStartsListItem)) {
      result[result.length - 1] = `${previous} ${paragraph}`;
    } else {
      result.push(paragraph);
    }
    return result;
  }, []).join('\n\n');
};

const plainHtml = (value = '') => {
  const text = decodeHtml(String(value)
    .replace(/<(p|div)[^>]*>\s*(?:<br\s*\/?\s*>|&nbsp;|\s)*<\/\1>/gi, '\n\n')
    .replace(/<br\s*\/?\s*>/gi, '\n')
    .replace(/<\/\s*div\s*>/gi, '\n')
    .replace(/<\/\s*(p|h2|h3|blockquote)\s*>/gi, '\n\n')
    .replace(/<\/\s*li\s*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, ''));
  return joinSoftWrappedLines(text).trim();
};

const richTable = (html = '') => {
  const body = [];
  let maxCells = 0;
  for (const rowMatch of String(html).matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const row = [];
    for (const cellMatch of rowMatch[1].matchAll(/<(th|td)[^>]*>([\s\S]*?)<\/\1>/gi)) {
      const header = cellMatch[1].toLowerCase() === 'th';
      row.push({ text: plainHtml(cellMatch[2]), bold: header, fillColor: header ? '#f2f2f2' : undefined, alignment: header ? 'center' : 'left' });
    }
    if (row.length) { maxCells = Math.max(maxCells, row.length); body.push(row); }
  }
  if (!body.length) return null;
  for (const row of body) while (row.length < maxCells) row.push('');
  return { table: { widths: Array(maxCells).fill('*'), body, dontBreakRows: true }, layout: borderLayout, margin: [0, 3, 0, 5] };
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
      if (text) nodes.push({ text, lineHeight: 1.25, alignment: 'left', margin: [0, 2, 0, 4] });
    }
  }
  return nodes.length ? nodes : [{ text: plainHtml(source), margin: [0, 2] }];
};

const section = (title, lines) => ({
  table: {
    widths: ['*'],
    body: [
      [{ text: title, bold: true, alignment: 'center', fillColor: '#d9d9d9' }],
      [{ stack: richNodes(lines), minHeight: 65 }]
    ]
  },
  layout: borderLayout,
  margin: [0, 0, 0, 8]
});

const buildHeaderMetadata = (header = {}, meetingDate = '') => ({
  table: {
    widths: ['*'],
    body: [
      [{ text: `CÓDIGO: ${header.codigo || 'COM-IF-FR-002'}`, bold: true, fontSize: 8 }],
      [{ text: `VERSIÓN: ${header.version || '1'}`, bold: true, fontSize: 8 }],
      [{ text: `FECHA: ${header.fecha || meetingDate || '6/MAR/2020'}`, bold: true, fontSize: 8 }]
    ]
  },
  layout: {
    hLineWidth: (index, node) => (index > 0 && index < node.table.body.length ? 0.7 : 0),
    vLineWidth: () => 0,
    hLineColor: () => '#111111',
    paddingLeft: () => 5,
    paddingRight: () => 5,
    paddingTop: () => 5,
    paddingBottom: () => 5
  }
});

const parseResponsablesList = (payload = {}) => {
  if (Array.isArray(payload.responsables_data) && payload.responsables_data.length > 0) {
    return payload.responsables_data;
  }
  if (typeof payload.responsables === 'string' && payload.responsables.trim()) {
    const lines = payload.responsables.split('\n').map((l) => l.replace(/^[•\-\*\s]+/, '').trim()).filter(Boolean);
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

const buildResponsablesPdfContent = (payload = {}) => {
  const list = parseResponsablesList(payload);
  if (!list.length) {
    return [{ text: [{ text: 'Responsable(s): ', bold: true }, { text: payload.responsables || '(Sin asignar)', italics: !payload.responsables, color: payload.responsables ? '#0f172a' : '#64748b' }] }];
  }

  const cards = list.map((r, idx) => {
    const isPrimary = Boolean(r.is_primary) || idx === 0;
    const roleOrg = [r.role_title, r.organization].filter(Boolean).join(' · ');
    return {
      table: {
        widths: ['*'],
        body: [
          [
            {
              stack: [
                {
                  text: isPrimary ? 'RESPONSABLE PRINCIPAL' : 'CO-RESPONSABLE',
                  fontSize: 7,
                  bold: true,
                  color: isPrimary ? '#1e3a8a' : '#475569',
                  margin: [0, 0, 0, 1.5]
                },
                {
                  text: formatPersonName(r.name || ''),
                  fontSize: 9.5,
                  bold: true,
                  color: '#0f172a'
                },
                ...(roleOrg ? [{
                  text: roleOrg,
                  fontSize: 8,
                  color: '#475569',
                  margin: [0, 1.5, 0, 0]
                }] : [])
              ],
              fillColor: isPrimary ? '#f8fafc' : '#ffffff'
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0.6,
        vLineWidth: () => 0.6,
        hLineColor: () => '#94a3b8',
        vLineColor: () => '#94a3b8',
        paddingLeft: () => 6,
        paddingRight: () => 6,
        paddingTop: () => 3.5,
        paddingBottom: () => 3.5
      }
    };
  });

  let cardLayout;
  if (cards.length === 1) {
    cardLayout = cards[0];
  } else if (cards.length === 2) {
    cardLayout = { columns: [cards[0], cards[1]], columnGap: 6, margin: [0, 2, 0, 0] };
  } else {
    const rows = [];
    for (let i = 0; i < cards.length; i += 2) {
      if (i + 1 < cards.length) {
        rows.push({ columns: [cards[i], cards[i + 1]], columnGap: 6, margin: [0, 1.5, 0, 1.5] });
      } else {
        rows.push({ ...cards[i], margin: [0, 1.5, 0, 1.5] });
      }
    }
    cardLayout = { stack: rows };
  }

  return [
    { text: 'Responsable(s):', bold: true, fontSize: 9.5, margin: [0, 0, 0, 3] },
    cardLayout
  ];
};

const generateStrategicMinutePdf = async ({
  minute,
  signatures = [],
  validationUrl = '',
  qrDataUrl = '',
  hideGraphicSignatures = false
}) => {
  const content = minute.content || {};
  const header = content.header || {};
  const meetingDate = content.fecha || '';

  // Indexar firmas
  const sigMapByParticipant = new Map();
  const sigMapByName = new Map();
  for (const s of signatures) {
    if (s.participant_id) sigMapByParticipant.set(String(s.participant_id), s);
    if (s.signer_name) sigMapByName.set(String(s.signer_name).trim().toLowerCase(), s);
    if (s.signer_email) sigMapByName.set(String(s.signer_email).trim().toLowerCase(), s);
  }

  // Lista de participantes normalizada
  const rawParticipants = Array.isArray(content.participants) && content.participants.length
    ? content.participants
    : (Array.isArray(content.participantes) && content.participantes.length ? content.participantes : []);

  const participantRows = [];

  if (rawParticipants.length > 0) {
    rawParticipants.forEach((p, index) => {
      const pName = p.name || p.nombre || '';
      const pRole = p.role_title || p.cargo || '';
      const pOrg = p.organization || p.dependencia || '';
      const pCargo = [pRole, pOrg].filter(Boolean).join(' / ') || pRole || pOrg || '—';

      // Buscar firma
      const sig = sigMapByParticipant.get(String(p.id))
        || sigMapByName.get(String(pName).trim().toLowerCase())
        || (p.email ? sigMapByName.get(String(p.email).trim().toLowerCase()) : null);

      const isSigned = p.status === 'signed' || Boolean(sig);

      let signatureCell;
      if (!hideGraphicSignatures && sig?.signature_storage_key && fs.existsSync(sig.signature_storage_key)) {
        try {
          const mime = /\.jpe?g$/i.test(sig.signature_storage_key) ? 'image/jpeg' : 'image/png';
          const imgBase64 = `data:${mime};base64,${fs.readFileSync(sig.signature_storage_key).toString('base64')}`;
          signatureCell = { image: imgBase64, fit: [92, 32], alignment: 'center' };
        } catch (_) {
          signatureCell = { text: 'Firmado electrónicamente', alignment: 'center', color: '#166534', bold: true, fontSize: 8.5 };
        }
      } else if (isSigned) {
        signatureCell = { text: 'ORIGINAL FIRMADO', alignment: 'center', color: '#166534', bold: true, fontSize: 8.5 };
      } else {
        signatureCell = { text: 'Pendiente', alignment: 'center', color: '#64748b', bold: true, fontSize: 8.5 };
      }

      participantRows.push([
        { text: String(index + 1), alignment: 'center', bold: true },
        formatPersonName(pName),
        pCargo,
        signatureCell
      ]);
    });
  } else if (signatures.length > 0) {
    signatures.forEach((sig, index) => {
      const pName = sig.signer_name || 'Participante';
      const pRole = sig.signer_role || '';
      const pOrg = sig.signer_organization || '';
      const pCargo = [pRole, pOrg].filter(Boolean).join(' / ') || pRole || pOrg || '—';

      let signatureCell;
      if (!hideGraphicSignatures && sig.signature_storage_key && fs.existsSync(sig.signature_storage_key)) {
        try {
          const mime = /\.jpe?g$/i.test(sig.signature_storage_key) ? 'image/jpeg' : 'image/png';
          const imgBase64 = `data:${mime};base64,${fs.readFileSync(sig.signature_storage_key).toString('base64')}`;
          signatureCell = { image: imgBase64, fit: [92, 32], alignment: 'center' };
        } catch (_) {
          signatureCell = { text: 'Firmado electrónicamente', alignment: 'center', color: '#166534', bold: true, fontSize: 8.5 };
        }
      } else {
        signatureCell = { text: 'ORIGINAL FIRMADO', alignment: 'center', color: '#166534', bold: true, fontSize: 8.5 };
      }

      participantRows.push([
        { text: String(index + 1), alignment: 'center', bold: true },
        formatPersonName(pName),
        pCargo,
        signatureCell
      ]);
    });
  } else {
    participantRows.push([
      { text: '1', alignment: 'center', bold: true },
      formatPersonName(content.responsables || 'Participante'),
      content.dependencia || '',
      { text: 'Pendiente', alignment: 'center', color: '#64748b', bold: true, fontSize: 8.5 }
    ]);
  }

  const contentItems = [
    // Encabezado institucional
    {
      table: {
        widths: [155, '*', 130],
        body: [[
          logo ? { image: logo, fit: [145, 54], alignment: 'center', margin: [0, 4] } : { text: 'UNIVERSIDAD CESMAG', bold: true, alignment: 'center' },
          { text: 'REGISTRO DE ASISTENCIA Y REUNIÓN', bold: true, fontSize: 14, alignment: 'center', margin: [0, 18, 0, 0] },
          buildHeaderMetadata(header, meetingDate)
        ]]
      },
      layout: {
        ...borderLayout,
        paddingLeft: (index) => (index === 2 ? 0 : 5),
        paddingRight: (index) => (index === 2 ? 0 : 5),
        paddingTop: (index) => (index === 2 ? 0 : 4),
        paddingBottom: (index) => (index === 2 ? 0 : 4)
      }
    },

    // Responsables y Dependencia
    {
      table: {
        widths: ['*'],
        body: [
          [{ stack: buildResponsablesPdfContent(content) }],
          [{ text: [{ text: 'Dependencia que cita: ', bold: true }, content.dependencia || ''] }]
        ]
      },
      layout: borderLayout
    },

    // Información de la reunión
    {
      table: {
        widths: ['*'],
        body: [
          [{ text: 'Información de la Reunión', bold: true, alignment: 'center', fillColor: '#d9d9d9' }],
          [{ text: [{ text: 'Lugar: ', bold: true }, content.lugar || ''] }]
        ]
      },
      layout: borderLayout
    },
    {
      table: {
        widths: ['*', 150],
        body: [
          [
            { text: [{ text: 'Fecha: ', bold: true }, meetingDate || ''] },
            { text: [{ text: 'Horario: ', bold: true }, content.horario || ''] }
          ]
        ]
      },
      layout: borderLayout
    },

    // Tabla de Participantes
    {
      table: {
        headerRows: 2,
        widths: [28, '*', 180, 115],
        body: [
          [{ text: 'Participantes', colSpan: 4, bold: true, alignment: 'center', fillColor: '#d9d9d9' }, {}, {}, {}],
          [
            { text: '', fillColor: '#f2f2f2' },
            { text: 'Nombres y Apellidos', bold: true, alignment: 'center', fillColor: '#f2f2f2' },
            { text: 'Entidad / Cargo', bold: true, alignment: 'center', fillColor: '#f2f2f2' },
            { text: 'Firma', bold: true, alignment: 'center', fillColor: '#f2f2f2' }
          ],
          ...participantRows
        ],
        dontBreakRows: true
      },
      layout: borderLayout,
      margin: [0, 0, 0, 8]
    },

    // Secciones de contenido estructurado
    section('Objetivo', content.objetivo),
    section('Desarrollo', content.desarrollo),
    section('Conclusiones / Compromisos', content.conclusiones)
  ];

  // Bloque de Validación SIAC con código QR
  if (validationUrl || qrDataUrl || minute.content_hash) {
    contentItems.push({
      table: {
        widths: [75, '*'],
        body: [
          [
            qrDataUrl ? { image: qrDataUrl, fit: [70, 70], alignment: 'center' } : { text: '' },
            {
              stack: [
                { text: 'VALIDACIÓN DE AUTENTICIDAD SIAC', bold: true, fontSize: 8.5, color: '#17345f', margin: [0, 0, 0, 2] },
                { text: `Enlace de verificación: ${validationUrl || 'Disponible en SIAC'}`, fontSize: 7.5, color: '#1d5fd1', margin: [0, 0, 0, 2] },
                { text: `Huella digital SHA-256: ${minute.content_hash || ''}`, fontSize: 7, color: '#475569', margin: [0, 0, 0, 2] },
                { text: 'Firma electrónica institucional con trazabilidad SIAC. No corresponde a una firma digital certificada.', italics: true, fontSize: 7, color: '#64748b' }
              ],
              margin: [4, 2, 0, 2]
            }
          ]
        ]
      },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        hLineColor: () => '#cbd5e1',
        vLineColor: () => '#cbd5e1',
        paddingLeft: () => 4,
        paddingRight: () => 4,
        paddingTop: () => 4,
        paddingBottom: () => 4
      },
      margin: [0, 2, 0, 6]
    });
  }

  // Aviso de Tratamiento de Datos Personales
  contentItems.push({
    unbreakable: false,
    margin: [0, 4, 0, 0],
    stack: [
      { text: 'TRATAMIENTO DE DATOS PERSONALES', bold: true, color: '#174ea6', fontSize: 8, margin: [0, 0, 0, 3] },
      ...PRIVACY_POLICY_PARAGRAPHS.map((paragraph) => ({ text: paragraph, fontSize: 6.8, color: '#475569', lineHeight: 1.15, margin: [0, 0, 0, 3] })),
      { text: 'Consultar la política institucional completa', link: PRIVACY_POLICY_URL, decoration: 'underline', color: '#174ea6', fontSize: 6.8 }
    ]
  });

  const definition = {
    pageSize: 'LETTER',
    pageMargins: [30, 32, 30, 38],
    footer: (current, total) => ({
      text: `SIAC UNICESMAG  ·  Página ${current} de ${total}`,
      alignment: 'center',
      color: '#64748b',
      fontSize: 7,
      margin: [0, 10, 0, 0]
    }),
    content: contentItems,
    defaultStyle: { font: 'SIAC', fontSize: 9, color: '#111111' }
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

module.exports = { generateStrategicMinutePdf };
