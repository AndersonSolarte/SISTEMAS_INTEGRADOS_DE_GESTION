const PdfPrinter = require('pdfmake');
const path = require('path');

const printer = new PdfPrinter({
  ReportFont: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
});

const logoPath = path.join(__dirname, '../../assets/logo_formatos.jpg');
const backendUrl = (process.env.BACKEND_PUBLIC_URL || process.env.API_PUBLIC_URL || process.env.FRONTEND_URL || 'http://localhost:5000').replace(/\/$/, '');
const value = (input) => String(input ?? '').trim();
const money = (input) => `$${Number(input || 0).toLocaleString('es-CO')}`;
const dateLabel = (input) => {
  const raw = value(input).slice(0, 10);
  if (!raw) return '';
  const date = new Date(`${raw}T12:00:00`);
  return Number.isNaN(date.getTime()) ? raw : date.toLocaleDateString('es-CO');
};
const label = (text) => ({ text, bold: true, color: '#0b3a6f', fillColor: '#e8eef6', margin: [5, 4] });
const cell = (text, options = {}) => ({ text: value(text), margin: [5, 4], ...options });

const buildLegalizacionDefinition = (legalizacion, solicitud) => {
  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const detalles = legalizacion.detalles || [];
  const alojamiento = value(viaticos.alojamiento);
  const transporte = value(viaticos.transporte);
  const mark = (checked) => checked ? 'X' : '—';
  const totalAnticipo = detalles.reduce((sum, row) => sum + Number(row.valorAnticipo || 0), 0);
  const totalLegalizado = detalles.reduce((sum, row) => sum + Number(row.valorLegalizado || 0), 0);
  const diferencia = totalAnticipo - totalLegalizado;
  const saldoUniversidad = Math.max(diferencia, 0);
  const saldoEmpleado = Math.max(-diferencia, 0);
  const transactionId = value(legalizacion.codigo_verificacion).toUpperCase();
  const verifyUrl = `${backendUrl}/api/legalizacion-viaticos/verificar/${legalizacion.codigo_verificacion}`;
  const collaboratorTrace = (legalizacion.trazabilidad || []).find((entry) => entry.event === 'legalizacion_presentada');
  const technicianTrace = (legalizacion.trazabilidad || []).find((entry) => entry.event === 'legalizacion_validada');
  const traceRows = [
    { label: 'Habilitación de la legalización', entry: (legalizacion.trazabilidad || []).find((entry) => entry.event === 'pago_autorizado'), fallback: 'SIAC UNICESMAG' },
    { label: 'Presentación del colaborador', entry: collaboratorTrace, fallback: personal.nombre },
    { label: 'Validación del Técnico Contable', entry: technicianTrace, fallback: 'Técnico Contable' }
  ];
  const signature = ({ title, trace, fallbackName, cargo, document }) => ([
    { text: title, bold: true, alignment: 'center', fillColor: '#eaf4ff', color: '#0b3a6f', fontSize: 8.5, margin: [5, 5] },
    {
      text: [
        { text: trace ? 'Firmado electrónicamente por:\n' : 'Pendiente de firma\n', bold: true, fontSize: 8 },
        { text: `${value(trace?.actor?.nombre || fallbackName || trace?.actor?.email)}\n`, fontSize: 9 },
        ...(document ? [{ text: `Documento: ${value(document)}\n`, fontSize: 7.4 }] : []),
        { text: `Cargo/Rol: ${value(cargo)}\n`, fontSize: 7.4 },
        ...(trace?.actor?.email ? [{ text: `Correo: ${value(trace.actor.email)}\n`, fontSize: 7.4 }] : []),
        { text: `Fecha y hora: ${trace?.at ? new Date(trace.at).toLocaleString('es-CO') : 'Pendiente'}\n`, fontSize: 7.4 },
        { text: trace ? `ID Transacción: ${transactionId}` : '', fontSize: 6.8, color: '#64748b' }
      ],
      margin: [7, 7]
    }
  ]);
  const collaboratorSignature = signature({ title: 'FIRMA DEL TRABAJADOR SOLICITANTE', trace: collaboratorTrace, fallbackName: personal.nombre, cargo: laboral.cargo || 'Colaborador', document: personal.documento });
  const technicianSignature = signature({ title: 'VALIDACIÓN DEL TÉCNICO CONTABLE', trace: technicianTrace, fallbackName: 'Técnico Contable', cargo: 'Técnico Contable' });

  return {
    pageSize: 'LETTER',
    pageMargins: [34, 30, 34, 34],
    defaultStyle: { font: 'ReportFont', fontSize: 9, color: '#172033' },
    footer: (page, pages) => ({ text: `SIAC UNICESMAG · ${solicitud.consecutivo} · Legalización · Página ${page} de ${pages}`, alignment: 'center', fontSize: 7, color: '#64748b' }),
    content: [
      {
        table: {
          widths: [120, '*', 125],
          body: [[
            { image: logoPath, fit: [105, 48], alignment: 'center', margin: [4, 6] },
            { text: 'LEGALIZACIÓN DE VIÁTICOS', bold: true, fontSize: 16, color: '#0b3a6f', alignment: 'center', margin: [4, 18] },
            { text: 'CÓDIGO: ADF-PP-FR-005\nVERSIÓN: 5\nFECHA: 11/FEB/2025', bold: true, fontSize: 8, margin: [6, 9] }
          ]]
        }
      },
      {
        table: {
          widths: [105, '*', 105, '*'],
          body: [
            [label('Fecha de legalización'), cell(dateLabel(legalizacion.presentado_at || new Date())), label('Programa / Dependencia'), cell(laboral.dependencia)],
            [label('Nombre del empleado'), { ...cell(personal.nombre), colSpan: 3 }, {}, {}],
            [label('Documento de identidad'), cell(personal.documento), label('Cargo'), cell(laboral.cargo)],
            [label('Lugar visitado'), cell(viaticos.lugarVisitar), label('No. días / Periodo'), cell(`${value(viaticos.numeroDiasSolicitados)} día(s) · Del ${dateLabel(salida.fecha)} al ${dateLabel(salida.fechaRegreso)}`)],
            [label('Alojamiento'), cell(`Hotel [${mark(alojamiento === 'Hotel')}]  Casa de Familia [${mark(alojamiento === 'Casa de familia')}]  No requiere [${mark(alojamiento === 'No requiere')}]`), label('Transporte'), cell(`Terrestre [${mark(['Terrestre', 'Mixto'].includes(transporte))}]  Aéreo [${mark(['Aéreo', 'Mixto'].includes(transporte))}]`)]
          ]
        }
      },
      { text: `Consecutivo: ${solicitud.consecutivo}`, bold: true, alignment: 'right', margin: [0, 5, 0, 0] },
      { text: 'DETALLE DE LA LEGALIZACIÓN', bold: true, color: '#0b3a6f', fontSize: 11, margin: [0, 14, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 105, 105, 105],
          body: [
            [label('Detalle'), label('Valor anticipo'), label('Valor legalizado'), label('Diferencia')],
            ...detalles.map((row) => [cell(row.detalle), cell(money(row.valorAnticipo), { alignment: 'right' }), cell(money(row.valorLegalizado), { alignment: 'right' }), cell(money(Number(row.valorAnticipo || 0) - Number(row.valorLegalizado || 0)), { alignment: 'right' })]),
            [{ text: 'TOTALES', colSpan: 1, bold: true, fillColor: '#dbeafe', margin: [5, 6] }, cell(money(totalAnticipo), { bold: true, alignment: 'right', fillColor: '#dbeafe' }), cell(money(totalLegalizado), { bold: true, alignment: 'right', fillColor: '#dbeafe' }), cell(money(diferencia), { bold: true, alignment: 'right', fillColor: '#dbeafe' })]
          ]
        },
        layout: 'lightHorizontalLines'
      },
      {
        table: {
          widths: [145, '*', 145, '*'],
          body: [[
            label('SALDO A FAVOR DE UNICESMAG'),
            cell(money(saldoUniversidad), { bold: true, alignment: 'right' }),
            label('SALDO A FAVOR DEL EMPLEADO'),
            cell(money(saldoEmpleado), { bold: true, alignment: 'right' })
          ]]
        },
        margin: [0, 8, 0, 12]
      },
      { text: 'OBSERVACIONES', bold: true, color: '#0b3a6f', margin: [0, 0, 0, 5] },
      { text: value(legalizacion.observaciones) || 'Sin observaciones', fillColor: '#f8fafc', margin: [8, 8] },
      { text: 'ANEXOS PRESENTADOS', bold: true, color: '#0b3a6f', margin: [0, 14, 0, 5] },
      (legalizacion.adjuntos || []).length
        ? { ul: (legalizacion.adjuntos || []).map((file) => `${file.detalle}: ${file.originalName}`), fontSize: 8.5 }
        : { text: 'No se presentaron soportes anexos.', italics: true, color: '#64748b', fontSize: 8.5 },
      { text: 'FIRMAS ELECTRÓNICAS', bold: true, color: '#0b3a6f', margin: [0, 16, 0, 5] },
      {
        table: {
          widths: ['50%', '50%'],
          body: [
            [collaboratorSignature[0], technicianSignature[0]],
            [collaboratorSignature[1], technicianSignature[1]]
          ]
        }
      },
      { text: 'TRAZABILIDAD DE LA LEGALIZACIÓN', bold: true, color: '#0b3a6f', margin: [0, 16, 0, 5] },
      {
        table: {
          headerRows: 1,
          widths: ['*', 75, 125, 95, 100],
          body: [
            [label('Actuación'), label('Estado'), label('Responsable'), label('Fecha y hora'), label('ID transacción')],
            ...traceRows.map(({ label: actionLabel, entry, fallback }) => [
              cell(actionLabel),
              cell(entry ? 'Registrada' : 'Pendiente', { color: entry ? '#166534' : '#92400e', bold: true }),
              cell(entry?.actor?.nombre || entry?.actor?.email || fallback),
              cell(entry?.at ? new Date(entry.at).toLocaleString('es-CO') : 'Pendiente'),
              cell(entry ? transactionId : 'Pendiente', { fontSize: 6.5, color: '#64748b' })
            ])
          ]
        },
        layout: 'lightHorizontalLines'
      },
      {
        columns: [
          { width: 90, qr: verifyUrl, fit: 78, margin: [4, 10, 10, 0] },
          { width: '*', stack: [
            { text: 'VERIFICACIÓN DE AUTENTICIDAD', bold: true, color: '#0b3a6f', margin: [0, 14, 0, 5] },
            { text: 'Escanee el código QR o consulte el enlace para confirmar la existencia y estado de esta legalización.', fontSize: 8.5 },
            { text: `Código de validación transaccional: ${transactionId}`, bold: true, fontSize: 8, color: '#334155', margin: [0, 5, 0, 0] },
            { text: verifyUrl, link: verifyUrl, color: '#005baa', decoration: 'underline', fontSize: 8, margin: [0, 5, 0, 0] }
          ] }
        ],
        margin: [0, 8, 0, 0]
      }
    ]
  };
};

const buildLegalizacionPdfBuffer = (legalizacion, solicitud) => new Promise((resolve, reject) => {
  try {
    const document = printer.createPdfKitDocument(buildLegalizacionDefinition(legalizacion, solicitud));
    const chunks = [];
    document.on('data', (chunk) => chunks.push(chunk));
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.on('error', reject);
    document.end();
  } catch (error) {
    reject(error);
  }
});

module.exports = { buildLegalizacionDefinition, buildLegalizacionPdfBuffer };
