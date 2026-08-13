const PdfPrinter = require('pdfmake');
const path = require('path');
const { AUTHORIZATION_TEXT, LEGALIZATION_NOTICE, calculateDays, getVisibleLiquidationDetails } = require('./formatService');

const fonts = {
  ReportFont: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);
const formatLogoPath = path.join(__dirname, '../../assets/logo_formatos.jpg');

const text = (value) => String(value ?? '').trim();
const formatDate = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? new Date(`${raw.slice(0, 10)}T12:00:00`)
      : new Date(raw);
  return Number.isNaN(date.getTime()) ? text(value) : date.toLocaleDateString('es-CO');
};
const formatTime = (value) => {
  const raw = text(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!match) return raw;
  const hour = Number(match[1]);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return raw;
  const period = hour < 12 ? 'a. m.' : 'p. m.';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${match[2]} ${period}`;
};
const formatMoney = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;
const cell = (value, style = '') => ({ text: text(value), style, margin: [4, 3, 4, 3] });
const label = (value) => ({ text: value, bold: true, fillColor: '#e8eef6', color: '#24364b', margin: [4, 3, 4, 3] });
const financialCell = (value, options = {}) => ({
  text: text(value),
  fontSize: 11,
  margin: [7, 7, 7, 7],
  ...options
});
const financialLabel = (value) => ({
  text: value,
  bold: true,
  fontSize: 11,
  color: '#ffffff',
  fillColor: '#0b3a6f',
  margin: [7, 8, 7, 8]
});

const findTrace = (solicitud, key) => [...(solicitud.trazabilidad || [])].reverse().find((entry) => (
  entry.event === `aprobado_${key}`
  || entry.event === `completado_${key}`
  || entry.event === `no_aprobado_${key}`
  || (key === 'jefe' && entry.event === 'aprobada_jefe')
  || (key === 'financiera_previa' && entry.event === 'aprobada_vicerrectoria_financiera')
  || (key === 'vicerrectoria_dependencia' && entry.event === 'aprobada_vicerrectoria_academica')
  || (key === 'sst' && entry.event === 'aprobada_sst')
  || (key === 'rectoria' && entry.event === 'aprobada_rectoria')
  || (key === 'gestion_humana' && entry.event === 'aprobada_gestion_humana')
));

const buildApprovalTable = (solicitud) => {
  const radication = (solicitud.trazabilidad || []).find((entry) => entry.event === 'radicada');
  const collaborator = solicitud.solicitante_snapshot || {};
  return ({
  margin: [0, 10, 0, 0],
  table: {
    headerRows: 1,
    widths: ['*', 90, 135, 100],
    body: [
      [label('Etapa'), label('Estado'), label('Responsable'), label('Fecha')],
      [
        cell('Radicación y aceptación de la autorización por el colaborador'),
        cell(radication ? 'Firmado electrónicamente' : 'Pendiente'),
        cell(radication?.actor?.nombre || collaborator.nombre || collaborator.email || ''),
        cell(radication?.at ? new Date(radication.at).toLocaleString('es-CO') : '')
      ],
      ...(solicitud.plan_aprobacion || []).map((step) => {
        const trace = findTrace(solicitud, step.key);
        const rejected = trace?.event === `no_aprobado_${step.key}`;
        return [
          cell(step.label),
          cell(rejected ? 'No aprobado' : trace ? 'Aprobado / completado' : 'Pendiente'),
          cell(trace?.actor?.nombre || trace?.actor?.email || ''),
          cell(trace?.at ? new Date(trace.at).toLocaleString('es-CO') : '')
        ];
      })
    ]
  },
  layout: 'lightHorizontalLines'
  });
};

const FINANCIAL_SIGNATURE_STAGES = [
  { key: 'tecnico_contable', label: 'Técnico contable' },
  { key: 'tesoreria', label: 'Tesorería / Pagaduría – autorización de pago' }
];

const buildFinancialSteps = (solicitud) => FINANCIAL_SIGNATURE_STAGES.map((stage) => {
  const configured = (solicitud.plan_aprobacion || []).find((step) => step.key === stage.key);
  return { ...stage, ...(configured || {}) };
});

const financialSignatureCell = (solicitud, stage, transactionId) => {
  const trace = findTrace(solicitud, stage.key);
  const actor = trace?.actor || {};
  const signed = Boolean(trace);
  return {
    stack: [
      { text: stage.label, bold: true, fontSize: 9.5, color: '#0b3a6f', margin: [0, 0, 0, 8] },
      { text: signed ? 'FIRMADO ELECTRÓNICAMENTE' : 'PENDIENTE', bold: true, fontSize: 8, color: signed ? '#166534' : '#92400e', margin: [0, 0, 0, 5] },
      { text: text(actor.nombre || actor.email || stage.email) || 'Sin registrar', fontSize: 8.5, margin: [0, 0, 0, 2] },
      { text: signed && actor.email && actor.nombre ? actor.email : '', fontSize: 7.5, color: '#475569', margin: [0, 0, 0, 4] },
      { text: trace?.at ? new Date(trace.at).toLocaleString('es-CO') : 'Fecha pendiente', fontSize: 7.5, color: '#475569' },
      { text: signed ? `ID de transacción: ${transactionId}` : '', fontSize: 6.8, color: '#64748b', margin: [0, 5, 0, 0] }
    ],
    fillColor: signed ? '#f0fdf4' : '#fffbeb',
    margin: [8, 8, 8, 8]
  };
};

const buildFinancialTraceabilityTable = (solicitud, steps) => ({
  table: {
    headerRows: 1,
    dontBreakRows: true,
    widths: [160, 90, '*', 125],
    body: [
      [label('Etapa'), label('Estado'), label('Responsable'), label('Fecha y hora')],
      ...steps.map((stage) => {
        const trace = findTrace(solicitud, stage.key);
        const rejected = trace?.event === `no_aprobado_${stage.key}`;
        return [
          cell(stage.label),
          cell(rejected ? 'No aprobado' : trace ? 'Firmado / completado' : 'Pendiente'),
          cell(trace?.actor?.nombre || trace?.actor?.email || stage.email || 'Sin registrar'),
          cell(trace?.at ? new Date(trace.at).toLocaleString('es-CO') : 'Pendiente')
        ];
      })
    ]
  },
  layout: 'lightHorizontalLines',
  margin: [0, 4, 0, 12]
});

const buildDefinition = (solicitud, { includeFinancial = true } = {}) => {
  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const liquidacion = solicitud.liquidacion || {};
  const permitSteps = (solicitud.plan_aprobacion || []).filter((step) => ['jefe', 'financiera_previa', 'vicerrectoria_dependencia', 'sst', 'rectoria', 'gestion_humana'].includes(step.key));
  const content = [
    {
      table: {
        widths: [95, '*', 150],
        body: [[
          { text: 'UNIVERSIDAD\nCESMAG', bold: true, alignment: 'center', margin: [4, 10] },
          { text: 'SOLICITUD DE DESPLAZAMIENTO FUERA DE LA CIUDAD', bold: true, fontSize: 14, color: '#0b3a6f', alignment: 'center', margin: [4, 12] },
          { text: 'CÓDIGO: ADF-PP-FR-004\nVERSIÓN: 6\nFECHA: 14/ENE/2025', bold: true, fontSize: 8, margin: [5, 5] }
        ]]
      }
    },
    { text: `Consecutivo: ${solicitud.consecutivo}`, bold: true, alignment: 'right', margin: [0, 5, 0, 5] },
    {
      table: {
        widths: [95, '*', 105, '*'],
        body: [
          [label('Fecha de solicitud'), cell(formatDate(solicitud.created_at || new Date())), label('Programa / Dependencia'), cell(laboral.dependencia)],
          [label('Nombre del empleado'), cell(personal.nombre), label('Documento'), cell(personal.documento)],
          [label('Cargo'), cell(laboral.cargo), label('Correo electrónico'), cell(personal.email || personal.correo)],
          [label('Lugar a visitar'), cell(viaticos.lugarVisitar), label('Fecha del evento'), cell(formatDate(viaticos.fechaEvento))],
          [label('No. días solicitados'), cell(calculateDays(salida, viaticos.numeroDiasSolicitados)), label('Salida'), cell(`${formatDate(salida.fecha)} · ${formatTime(salida.horaInicio)}`)],
          [label('Regreso'), cell(`${formatDate(salida.fechaRegreso)} · ${formatTime(salida.horaFin)}`), label('Centro de costos'), cell(viaticos.centroCosto)]
        ]
      }
    },
    { text: 'Objeto de la comisión', style: 'sectionTitle', margin: [0, 7, 0, 2] },
    { text: text(viaticos.objetoComision), style: 'textBox' },
    { text: 'Observaciones especiales', style: 'sectionTitle', margin: [0, 6, 0, 2] },
    { text: text(viaticos.observacionesEspeciales) || 'Sin observaciones', style: 'textBox' },
    {
      margin: [0, 7, 0, 0],
      table: {
        widths: [75, '*', 75, '*', 75, '*'],
        body: [
          [label('Alojamiento'), cell(viaticos.alojamiento), label('Transporte'), cell(viaticos.transporte), label('Tipo cuenta'), cell(viaticos.tipoCuenta)],
          [label('Banco'), cell(viaticos.entidadBancaria), label('No. cuenta'), cell(viaticos.numeroCuenta), label('Aceptación'), cell(viaticos.autorizacionAceptada ? 'Sí' : 'No')]
        ]
      }
    },
    { text: 'AUTORIZACIÓN', bold: true, color: '#0b3a6f', margin: [0, 9, 0, 2] },
    { text: AUTHORIZATION_TEXT, fontSize: 8.5, color: '#334155', margin: [0, 0, 0, 6] },
    { text: LEGALIZATION_NOTICE, bold: true, fontSize: 9, color: '#b45309', fillColor: '#fff7ed', margin: [6, 5, 6, 5] },
    { text: 'APROBACIONES Y TRAZABILIDAD', style: 'sectionTitle', margin: [0, 10, 0, 0] },
    buildApprovalTable({ ...solicitud, plan_aprobacion: permitSteps })
  ];

  if (includeFinancial) {
    const detailRows = getVisibleLiquidationDetails(liquidacion).map((item) => [
      financialCell(item.detalle),
      financialCell(formatMoney(item.valorDiario), { alignment: 'right' }),
      financialCell(item.dias, { alignment: 'center' }),
      financialCell(formatMoney(item.valorTotal), { alignment: 'right', bold: true })
    ]);
    content.push(
      { text: 'LIQUIDACIÓN DE VIÁTICOS Y GASTOS DE VIAJE', fontSize: 18, bold: true, color: '#0b3a6f', alignment: 'center', pageBreak: 'before', margin: [0, 4, 0, 16] },
      {
        table: {
          headerRows: 1,
          dontBreakRows: true,
          widths: ['*', 125, 80, 130],
          body: [
            [financialLabel('DETALLE'), financialLabel('VALOR DIARIO'), financialLabel('No. DÍAS'), financialLabel('VALOR TOTAL')],
            ...detailRows,
            [
              { text: 'TOTAL ANTICIPO', bold: true, fontSize: 12.5, color: '#0b3a6f', fillColor: '#dbeafe', colSpan: 3, alignment: 'right', margin: [8, 9, 8, 9] },
              {},
              {},
              { text: formatMoney(liquidacion.totalAnticipo), bold: true, fontSize: 13, color: '#0b3a6f', fillColor: '#dbeafe', alignment: 'right', margin: [8, 9, 8, 9] }
            ]
          ]
        },
        layout: 'lightHorizontalLines'
      },
      { text: 'OBSERVACIONES A LA LIQUIDACIÓN', bold: true, fontSize: 12, color: '#0b3a6f', margin: [0, 18, 0, 6] },
      { text: text(liquidacion.observaciones) || 'Sin observaciones', fontSize: 11, margin: [8, 8, 8, 8], fillColor: '#f8fafc' }
    );
  }

  return {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [28, 24, 28, 24],
    defaultStyle: { font: 'ReportFont', fontSize: 8.5, color: '#172033' },
    styles: {
      pageTitle: { fontSize: 14, bold: true, color: '#0b3a6f', alignment: 'center' },
      sectionTitle: { fontSize: 9.5, bold: true, color: '#0b3a6f' },
      textBox: { fontSize: 8.5, margin: [5, 4, 5, 4], fillColor: '#f8fafc' }
    },
    content,
    footer: (currentPage, pageCount) => ({ text: `SIAC UNICESMAG · ${solicitud.consecutivo} · Página ${currentPage} de ${pageCount}`, alignment: 'center', fontSize: 7, color: '#64748b', margin: [0, 7, 0, 0] })
  };
};

const buildPdfBuffer = (solicitud, options = {}) => new Promise((resolve, reject) => {
  try {
    const pdfDoc = printer.createPdfKitDocument(buildDefinition(solicitud, options));
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  } catch (error) {
    reject(error);
  }
});

const buildLiquidationDefinition = (solicitud) => {
  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const liquidacion = solicitud.liquidacion || {};
  const financialSteps = buildFinancialSteps(solicitud);
  const transactionId = text(solicitud.consecutivo || solicitud.id);
  const frontendUrl = process.env.FRONTEND_URL || 'https://planeaciongp.unicesmag.edu.co';
  const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/verificar/${encodeURIComponent(transactionId)}`;
  const isDemo = transactionId.toUpperCase().startsWith('PRUEBA-');
  const detailRows = getVisibleLiquidationDetails(liquidacion).map((item) => [
    financialCell(item.detalle),
    financialCell(formatMoney(item.valorDiario), { alignment: 'right' }),
    financialCell(item.dias, { alignment: 'center' }),
    financialCell(formatMoney(item.valorTotal), { alignment: 'right', bold: true })
  ]);
  const content = [
    {
      table: {
        widths: [170, '*', 145],
        body: [[
          { image: formatLogoPath, width: 145, alignment: 'center', margin: [5, 5, 5, 5] },
          { text: 'LIQUIDACIÓN DE VIÁTICOS\nY GASTOS DE VIAJE', fontSize: 17, bold: true, color: '#0b3a6f', alignment: 'center', margin: [5, 13, 5, 8] },
          { text: 'CÓDIGO: ADF-PP-FR-004\nVERSIÓN: 6\nFECHA: 14/ENE/2025', bold: true, fontSize: 8.5, margin: [7, 10, 7, 7] }
        ]]
      },
      layout: {
        hLineWidth: () => 1,
        vLineWidth: () => 1,
        hLineColor: () => '#94a3b8',
        vLineColor: () => '#94a3b8',
        paddingLeft: () => 3,
        paddingRight: () => 3,
        paddingTop: () => 3,
        paddingBottom: () => 3
      },
      margin: [0, 0, 0, 14]
    },
    {
      table: {
        widths: [105, '*', 105, '*'],
        body: [
          [label('Consecutivo'), cell(solicitud.consecutivo), label('Fecha de solicitud'), cell(formatDate(solicitud.created_at || new Date()))],
          [label('Colaborador'), cell(personal.nombre), label('Documento'), cell(personal.documento)],
          [label('Dependencia'), cell(laboral.dependencia), label('Cargo'), cell(laboral.cargo)],
          [label('Lugar a visitar'), cell(viaticos.lugarVisitar), label('No. días'), cell(calculateDays(salida, viaticos.numeroDiasSolicitados))],
          [label('Salida'), cell(`${formatDate(salida.fecha)} · ${formatTime(salida.horaInicio)}`), label('Regreso'), cell(`${formatDate(salida.fechaRegreso)} · ${formatTime(salida.horaFin)}`)],
          [label('Objeto de la comisión'), { ...cell(viaticos.objetoComision), colSpan: 3 }, {}, {}]
        ]
      },
      margin: [0, 0, 0, 14]
    },
    {
      table: {
        headerRows: 1,
        dontBreakRows: true,
        widths: ['*', 125, 80, 130],
        body: [
          [financialLabel('DETALLE'), financialLabel('VALOR DIARIO'), financialLabel('No. DÍAS'), financialLabel('VALOR TOTAL')],
          ...detailRows,
          [
            { text: 'TOTAL ANTICIPO', bold: true, fontSize: 12.5, color: '#0b3a6f', fillColor: '#dbeafe', colSpan: 3, alignment: 'right', margin: [8, 9, 8, 9] },
            {},
            {},
            { text: formatMoney(liquidacion.totalAnticipo), bold: true, fontSize: 13, color: '#0b3a6f', fillColor: '#dbeafe', alignment: 'right', margin: [8, 9, 8, 9] }
          ]
        ]
      },
      layout: 'lightHorizontalLines'
    },
    { text: 'OBSERVACIONES A LA LIQUIDACIÓN', bold: true, fontSize: 12, color: '#0b3a6f', margin: [0, 18, 0, 6] },
    { text: text(liquidacion.observaciones) || 'Sin observaciones', fontSize: 11, margin: [8, 8, 8, 8], fillColor: '#f8fafc' },
    { text: 'FIRMAS ELECTRÓNICAS DEL FLUJO FINANCIERO', style: 'sectionTitle', margin: [0, 16, 0, 6] },
    {
      unbreakable: true,
      table: {
        widths: ['50%', '50%'],
        body: [[...financialSteps.map((stage) => financialSignatureCell(solicitud, stage, transactionId))]]
      },
      layout: {
        hLineColor: () => '#cbd5e1',
        vLineColor: () => '#cbd5e1',
        hLineWidth: () => 1,
        vLineWidth: () => 1
      },
      margin: [0, 0, 0, 12]
    },
    { text: 'TRAZABILIDAD DE LA LIQUIDACIÓN', style: 'sectionTitle', margin: [0, 4, 0, 4] },
    buildFinancialTraceabilityTable(solicitud, financialSteps),
    {
      unbreakable: true,
      columns: [
        { width: 92, qr: verifyUrl, fit: 82, margin: [4, 0, 10, 0] },
        {
          width: '*',
          stack: [
            { text: 'VERIFICACIÓN DE AUTENTICIDAD E INTEGRIDAD', bold: true, fontSize: 10, color: '#0b3a6f', margin: [0, 5, 0, 5] },
            { text: isDemo ? 'Este documento corresponde a una prueba controlada y no acredita una solicitud institucional real.' : 'Este documento fue generado por SIAC UNICESMAG. Escanee el código QR o consulte el enlace para confirmar la existencia y el estado de la solicitud asociada.', fontSize: 8.5, color: '#334155', margin: [0, 0, 0, 5] },
            { text: `ID de transacción: ${transactionId}`, bold: true, fontSize: 8, color: '#334155', margin: [0, 0, 0, 3] },
            { text: verifyUrl, link: verifyUrl, fontSize: 8, color: '#005baa', decoration: 'underline' }
          ],
          margin: [0, 1, 0, 0]
        }
      ],
      margin: [0, 4, 0, 4]
    }
  ];
  return {
    pageSize: 'LETTER',
    pageOrientation: 'landscape',
    pageMargins: [28, 24, 28, 24],
    defaultStyle: { font: 'ReportFont', fontSize: 9, color: '#172033' },
    styles: { sectionTitle: { fontSize: 11, bold: true, color: '#0b3a6f' } },
    content,
    footer: (currentPage, pageCount) => ({ text: `SIAC UNICESMAG · ${solicitud.consecutivo} · Liquidación · Página ${currentPage} de ${pageCount}`, alignment: 'center', fontSize: 7, color: '#64748b', margin: [0, 7, 0, 0] })
  };
};

const buildLiquidationPdfBuffer = (solicitud) => new Promise((resolve, reject) => {
  try {
    const pdfDoc = printer.createPdfKitDocument(buildLiquidationDefinition(solicitud));
    const chunks = [];
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', reject);
    pdfDoc.end();
  } catch (error) {
    reject(error);
  }
});

const buildPdfAttachment = async (solicitud, options = {}) => ({
  filename: `REPORTE-SALIDA-${solicitud.consecutivo}.pdf`,
  content: await buildPdfBuffer(solicitud, options),
  contentType: 'application/pdf'
});

const buildLiquidationPdfAttachment = async (solicitud) => ({
  filename: `LIQUIDACION-VIATICOS-${solicitud.consecutivo}.pdf`,
  content: await buildLiquidationPdfBuffer(solicitud),
  contentType: 'application/pdf'
});

module.exports = {
  buildDefinition,
  buildLiquidationDefinition,
  buildLiquidationPdfAttachment,
  buildLiquidationPdfBuffer,
  buildPdfAttachment,
  buildPdfBuffer
};
