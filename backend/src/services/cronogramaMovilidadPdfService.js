const PdfPrinter = require('pdfmake');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const fonts = {
  ReportFont: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique'
  }
};

const printer = new PdfPrinter(fonts);
const headerPath = path.join(__dirname, '../assets/Encabezado_correos.png');
const footerPath = path.join(__dirname, '../assets/pie_de_pag.png');

const formatDateFormal = (dateVal) => {
  if (!dateVal) return '';
  const date = new Date(dateVal);
  if (Number.isNaN(date.getTime())) return String(dateVal);
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
};

const formatDateTimeFormal = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;
  const strHours = String(hours).padStart(2, '0');
  return `${day}/${month}/${year}, ${strHours}:${minutes} ${ampm}`;
};

const generateCronogramaPdfBuffer = async (cronograma = {}, actividades = []) => {
  let headerDataUrl = null;
  if (fs.existsSync(headerPath)) {
    const base64 = fs.readFileSync(headerPath).toString('base64');
    headerDataUrl = `data:image/png;base64,${base64}`;
  }

  let footerDataUrl = null;
  if (fs.existsSync(footerPath)) {
    const base64 = fs.readFileSync(footerPath).toString('base64');
    footerDataUrl = `data:image/png;base64,${base64}`;
  }

  const programaNombre = cronograma.programa_academico || 'Licenciatura en Educación Infantil';
  const facultadNombre = cronograma.facultad || 'FACULTAD DE EDUCACIÓN';
  const directorNombre = cronograma.nombre_director || 'Director de Programa';
  const directorEmail = cronograma.email_director || '';
  const coordNombre = cronograma.coordinador_practica || 'Coordinador(a) de Práctica';
  const coordEmail = cronograma.email_coordinador || '';
  const fechaActualStr = formatDateFormal(cronograma.radicado_at || cronograma.created_at || new Date());

  // Generación de Hash Hexadecimal SHA-256 de Autenticidad del Documento
  const seedString = `CRONOGRAMA-${cronograma.id || 1}-${cronograma.created_at || new Date().toISOString()}-${programaNombre}`;
  const documentHash = crypto.createHash('sha256').update(seedString).digest('hex').toUpperCase();
  const verificationUrl = `https://sgc.unicesmag.edu.co/validar/cronograma/CRON-${cronograma.id || 1}`;

  const docDefinition = {
    pageSize: 'LETTER',
    pageMargins: [35, 20, 35, 75],
    footer: (currentPage, pageCount) => {
      if (!footerDataUrl) return null;
      return {
        image: footerDataUrl,
        width: 542,
        alignment: 'center',
        margin: [0, 0, 0, 0]
      };
    },
    content: [
      // Encabezado institucional
      ...(headerDataUrl ? [{
        image: headerDataUrl,
        width: 542,
        alignment: 'center',
        margin: [0, 0, 0, 10]
      }] : []),

      // Encabezado del Oficio
      {
        table: {
          widths: ['*'],
          body: [[
            {
              text: `San Juan de Pasto, ${fechaActualStr}`,
              bold: true,
              fontSize: 9,
              alignment: 'right',
              border: [false, false, false, false],
              margin: [0, 0, 0, 8]
            }
          ]]
        }
      },

      // Destinatario
      { text: 'Doctor', fontSize: 9.5, bold: true },
      { text: 'JUAN CARLOS NÁNDAR', fontSize: 10, bold: true, color: '#1e3a8a' },
      { text: 'Vicerrector Financiero y de Desarrollo Institucional', fontSize: 9, color: '#334155' },
      { text: 'Universidad CESMAG', fontSize: 9, color: '#334155', margin: [0, 0, 0, 12] },

      // Asunto
      {
        text: [
          { text: 'ASUNTO: ', bold: true, color: '#1e3a8a' },
          { text: cronograma.asunto_oficio || `Solicitud aprobación de cronograma de salidas práctica integral de movilidad ${programaNombre}`, bold: true }
        ],
        fontSize: 9.5,
        margin: [0, 0, 0, 12]
      },

      // Saludo
      { text: 'Estimado doctor.\n', fontSize: 9.5 },

      // Cuerpo del Oficio
      {
        text: cronograma.cuerpo_oficio || `Por medio de la presente, se remite la solicitud para la aprobación del cronograma de salidas, correspondiente a la práctica integral de movilidad del programa de ${programaNombre}, que tiene como propósito fundamental la movilidad de los docentes en ambientes de formación educativa en los contextos.\n\nAsimismo, se informa que los docentes responsabless se desempeñarán como encargados de la movilidad desde la asignación de su rol de práctica. Ante ello, se anexan las fechas estimadas para la monitoría de la práctica en los diferentes escenarios que se encuentran fuera del municipio de Pasto (N), las cuales han sido debidamente revisadas y aprobadas desde la dirección del programa y la coordinación de práctica.\n\nA continuación, se detalla el cronograma de actividades correspondiente:`,
        fontSize: 9.5,
        alignment: 'justify',
        margin: [0, 0, 0, 12]
      },

      // Título del Cronograma dentro del Oficio (Solo Código y Título Limpio)
      { text: `CRONOGRAMA DE VISITAS A ESCENARIOS DE PRÁCTICA - CÓDIGO: CRON-${cronograma.id || 1}`, fontSize: 9.5, bold: true, alignment: 'center', color: '#1e3a8a', margin: [0, 4, 0, 8] },

      // Tabla de Actividades con Encabezado Institucional Azul y Zebra Rows
      {
        table: {
          headerRows: 1,
          widths: [70, 90, 85, 95, 85, 117],
          body: [
            [
              { text: 'FECHAS Y HORARIOS', bold: true, fontSize: 7, alignment: 'center', fillColor: '#1e3a8a', color: '#ffffff' },
              { text: 'DESTINO Y ENTIDAD RECEPTORA', bold: true, fontSize: 7, alignment: 'center', fillColor: '#1e3a8a', color: '#ffffff' },
              { text: 'FUNCIONES Y OBJETIVOS', bold: true, fontSize: 7, alignment: 'center', fillColor: '#1e3a8a', color: '#ffffff' },
              { text: 'LOGÍSTICA Y VIÁTICOS', bold: true, fontSize: 7, alignment: 'center', fillColor: '#1e3a8a', color: '#ffffff' },
              { text: 'CONTEXTO DE PRÁCTICA', bold: true, fontSize: 7, alignment: 'center', fillColor: '#1e3a8a', color: '#ffffff' },
              { text: 'TUTOR(ES) Y ESTUDIANTES', bold: true, fontSize: 7, alignment: 'center', fillColor: '#1e3a8a', color: '#ffffff' }
            ],
            ...actividades.map((act, idx) => {
              const respNames = Array.isArray(act.responsables)
                ? act.responsables.map((r) => r.nombre || r.email || r).join(', ')
                : String(act.responsables || '');
              const cantEst = Array.isArray(act.estudiantes) ? act.estudiantes.length : 0;
              const rowFill = idx % 2 === 0 ? '#ffffff' : '#f8fafc';

              const viaticosText = act.requiere_viaticos === false
                ? 'No requiere viáticos'
                : `Alojamiento: ${act.alojamiento || 'Pre-autorizado'}\nTransporte: ${act.transporte || 'Pre-autorizado'}`;

              return [
                {
                  text: [
                    { text: `Salida: `, bold: true, fontSize: 6.8 },
                    { text: `${formatDateFormal(act.fecha_salida)} (${act.hora_salida || '07:00 AM'})\n`, fontSize: 6.8 },
                    { text: `Regreso: `, bold: true, fontSize: 6.8 },
                    { text: `${formatDateFormal(act.fecha_regreso)} (${act.hora_regreso || '04:00 PM'})`, fontSize: 6.8 }
                  ],
                  fillColor: rowFill
                },
                {
                  text: [
                    { text: `${act.entidad_destino || 'Escenario no especificado'}\n`, bold: true, fontSize: 7.2, color: '#1e3a8a' },
                    { text: `${act.localidad_texto || `${act.municipio || ''} - ${act.departamento || ''}`} (${act.alcance || 'Regional'})`, fontSize: 6.8, color: '#334155' }
                  ],
                  fillColor: rowFill
                },
                { text: act.funciones || '', fontSize: 6.8, fillColor: rowFill },
                { text: viaticosText, fontSize: 6.8, fillColor: rowFill },
                { text: act.contexto_practica || '', fontSize: 6.8, fillColor: rowFill },
                {
                  text: [
                    { text: `Tutores: `, bold: true, fontSize: 6.8 },
                    { text: `${respNames || 'Sin asignar'}\n`, fontSize: 6.8 },
                    { text: `Estudiantes: `, bold: true, fontSize: 6.8 },
                    { text: `${cantEst} matriculados asociados`, fontSize: 6.8, color: '#2563eb' }
                  ],
                  fillColor: rowFill
                }
              ];
            })
          ]
        },
        layout: {
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1'
        },
        margin: [0, 0, 0, 14]
      },

      // Cierre del Oficio
      { text: 'De antemano, agradezco la atención prestada.', fontSize: 9.5, margin: [0, 0, 0, 4] },
      { text: 'Fraternalmente,', fontSize: 9.5, margin: [0, 0, 0, 14] },

      // TABLA INSTITUCIONAL DE FIRMAS ELECTRÓNICAS (Dynamic 2, 3, or 4 columns)
      (() => {
        const hasAcademica = Boolean(cronograma.visto_bueno_academica_at);
        const hasFinanciera = Boolean(cronograma.aprobado_financiera_at);

        let tableWidths = ['50%', '50%'];
        if (hasAcademica && hasFinanciera) {
          tableWidths = ['25%', '25%', '25%', '25%'];
        } else if (hasAcademica) {
          tableWidths = ['33%', '33%', '34%'];
        }

        return {
          table: {
            widths: tableWidths,
            body: [
              [
                { text: 'DIRECTOR(A) DE PROGRAMA', bold: true, fontSize: 6.8, alignment: 'center', fillColor: '#dbeafe', color: '#1e3a8a' },
                { text: 'COORDINACIÓN DE PRÁCTICA', bold: true, fontSize: 6.8, alignment: 'center', fillColor: '#dbeafe', color: '#1e3a8a' },
                ...(hasAcademica ? [
                  { text: 'VISTO BUENO ACADÉMICO', bold: true, fontSize: 6.8, alignment: 'center', fillColor: '#dbeafe', color: '#1e3a8a' }
                ] : []),
                ...(hasFinanciera ? [
                  { text: 'APROBACIÓN FINANCIERA', bold: true, fontSize: 6.8, alignment: 'center', fillColor: '#dbeafe', color: '#1e3a8a' }
                ] : [])
              ],
              [
                {
                  stack: [
                    { text: 'Firmado electrónicamente por:', bold: true, fontSize: 6, color: '#475569' },
                    { text: directorNombre, bold: true, fontSize: 7.5, color: '#1e3a8a', margin: [0, 1, 0, 1] },
                    { text: `Cargo: Director(a) ${programaNombre}`, fontSize: 5.8, color: '#334155' },
                    { text: `Correo: ${directorEmail}`, fontSize: 5.8, color: '#2563eb' },
                    { text: `Fecha: ${formatDateTimeFormal(cronograma.radicado_at || cronograma.created_at)}`, fontSize: 5.8, color: '#475569', margin: [0, 1, 0, 0] }
                  ],
                  margin: [3, 3, 3, 3],
                  fillColor: '#f8fafc'
                },
                {
                  stack: [
                    { text: 'Firmado electrónicamente por:', bold: true, fontSize: 6, color: '#475569' },
                    { text: coordNombre, bold: true, fontSize: 7.5, color: '#1e3a8a', margin: [0, 1, 0, 1] },
                    { text: 'Cargo: Coordinador(a) de Práctica', fontSize: 5.8, color: '#334155' },
                    { text: `Correo: ${coordEmail}`, fontSize: 5.8, color: '#2563eb' },
                    { text: `Fecha: ${formatDateTimeFormal(cronograma.radicado_at || cronograma.created_at)}`, fontSize: 5.8, color: '#475569', margin: [0, 1, 0, 0] }
                  ],
                  margin: [3, 3, 3, 3],
                  fillColor: '#f8fafc'
                },
                ...(hasAcademica ? [
                  {
                    stack: [
                      { text: 'Firmado electrónicamente por:', bold: true, fontSize: 6, color: '#475569' },
                      { text: cronograma.visto_bueno_academica_by || 'Vicerrectoría Académica', bold: true, fontSize: 7.5, color: '#1e3a8a', margin: [0, 1, 0, 1] },
                      { text: 'Cargo: Vicerrectoría Académica', fontSize: 5.8, color: '#334155' },
                      { text: `Estado: Visto Bueno Concedido`, fontSize: 5.8, color: '#1e40af', bold: true },
                      { text: `Fecha: ${formatDateTimeFormal(cronograma.visto_bueno_academica_at)}`, fontSize: 5.8, color: '#475569', margin: [0, 1, 0, 0] }
                    ],
                    margin: [3, 3, 3, 3],
                    fillColor: '#f8fafc'
                  }
                ] : []),
                ...(hasFinanciera ? [
                  {
                    stack: [
                      { text: 'Aprobado electrónicamente por:', bold: true, fontSize: 6, color: '#475569' },
                      { text: cronograma.aprobado_financiera_by || 'Dr. Juan Carlos Nándar', bold: true, fontSize: 7.5, color: '#1e3a8a', margin: [0, 1, 0, 1] },
                      { text: 'Cargo: Vicerrector Financiero y D.I.', fontSize: 5.8, color: '#334155' },
                      { text: `Estado: Aprobado Institucionalmente`, fontSize: 5.8, color: '#1e40af', bold: true },
                      { text: `Fecha: ${formatDateTimeFormal(cronograma.aprobado_financiera_at)}`, fontSize: 5.8, color: '#475569', margin: [0, 1, 0, 0] }
                    ],
                    margin: [3, 3, 3, 3],
                    fillColor: '#f8fafc'
                  }
                ] : [])
              ]
            ]
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#cbd5e1',
            vLineColor: () => '#cbd5e1'
          },
          margin: [0, 0, 0, 10]
        };
      })(),

      // RECUADRO DE FIRMA DIGITAL, CÓDIGO QR Y VALIDACIÓN SHA-256
      {
        table: {
          widths: [75, '*'],
          body: [[
            {
              qr: verificationUrl,
              fit: 70,
              alignment: 'center',
              margin: [2, 4, 2, 4]
            },
            {
              stack: [
                { text: 'FIRMA DIGITAL Y VALIDACIÓN DE INTEGRIDAD INSTITUCIONAL SIAC', bold: true, fontSize: 8, color: '#1e3a8a' },
                { text: `Registro Único: CRON-${cronograma.id || 1} | Programa: ${programaNombre}`, fontSize: 7.5, color: '#334155', margin: [0, 2, 0, 2] },
                { text: documentHash, fontSize: 6, color: '#0f172a', margin: [0, 1, 0, 2] },
                { text: [
                    { text: 'Link de Consulta y Validación: ', bold: true, fontSize: 7, color: '#475569' },
                    { text: verificationUrl, fontSize: 7, color: '#2563eb', decoration: 'underline' }
                  ],
                  margin: [0, 1, 0, 0]
                }
              ],
              margin: [6, 4, 4, 4]
            }
          ]]
        },
        layout: {
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => '#cbd5e1',
          vLineColor: () => '#cbd5e1',
          fillColor: () => '#f8fafc'
        },
        margin: [0, 8, 0, 8]
      },

      // AVISO INSTITUCIONAL OBLIGATORIO DE REPORTE DE SALIDA Y COBERTURA ARL
      {
        table: {
          widths: ['*'],
          body: [
            [
              {
                text: 'NOTA IMPORTANTE DE CUMPLIMIENTO INSTITUCIONAL Y COBERTURA ARL',
                bold: true,
                fontSize: 7.5,
                alignment: 'center',
                fillColor: '#fff7ed',
                color: '#c2410c',
                margin: [4, 3, 4, 3]
              }
            ],
            [
              {
                stack: [
                  {
                    text: [
                      { text: '⚠️ AVISO REGULATORIO: ', bold: true, color: '#9a3412' },
                      { text: 'La presente aprobación institucional del cronograma marco NO EXIME ni reemplaza el licenciamiento individual del Reporte de Salida. ', bold: true, color: '#9a3412' },
                      { text: 'El día en que los docentes y tutores responsables vayan a realizar la movilidad o visita al escenario de práctica, ', color: '#431407' },
                      { text: 'DEBERÁN DILIGENCIAR OBLIGATORIAMENTE el formulario de Reporte de Salida en el sistema SIAC ', bold: true, color: '#9a3412' },
                      { text: 'previo al desplazamiento. Este trámite es de estricto cumplimiento para la vinculación oficial de estudiantes y la formalización de la cobertura ante la Administradora de Riesgos Laborales (ARL).', color: '#431407' }
                    ],
                    fontSize: 6.8,
                    alignment: 'justify',
                    margin: [6, 4, 6, 4]
                  }
                ],
                fillColor: '#fffbeb'
              }
            ]
          ]
        },
        layout: {
          hLineWidth: () => 0.6,
          vLineWidth: () => 0.6,
          hLineColor: () => '#fde68a',
          vLineColor: () => '#fde68a'
        },
        margin: [0, 4, 0, 6]
      }
    ],
    defaultStyle: {
      font: 'ReportFont'
    }
  };

  const pdfDoc = printer.createPdfKitDocument(docDefinition);
  const chunks = [];
  return new Promise((resolve, reject) => {
    pdfDoc.on('data', (chunk) => chunks.push(chunk));
    pdfDoc.on('end', () => resolve(Buffer.concat(chunks)));
    pdfDoc.on('error', (err) => reject(err));
    pdfDoc.end();
  });
};

module.exports = {
  generateCronogramaPdfBuffer
};
