const fs = require('fs');
const path = require('path');

const targetPath = path.resolve('src/services/reporteSalidaPdfService.js');
let content = fs.readFileSync(targetPath, 'utf8');

const newCode = `const PdfPrinter = require('pdfmake');

const buildPdfBuffer = async (solicitud) => {
  return new Promise((resolve, reject) => {
    try {
      const fonts = {
        Roboto: {
          normal: 'Helvetica',
          bold: 'Helvetica-Bold',
          italics: 'Helvetica-Oblique',
          bolditalics: 'Helvetica-BoldOblique'
        }
      };
      const printer = new PdfPrinter(fonts);

      const data = solicitud?.datos_formulario || {};
      const solicitante = solicitud?.solicitante_snapshot || {};
      const jefe = solicitud?.jefe_snapshot || {};
      const salida = data.salida || {};
      const reposicion = data.reposicion || {};
      const laboral = data.laboral || {};
      const personal = data.personal || {};

      const isSalidaMultiple = Boolean(data.isSalidaMultiple);
      const participantes = data.participantes || [];

      let motivoStr = salida.motivo || getTipoSalidaLabel(salida.tipo);
      if (salida.tipo === 'salida_campus' && salida.campusSalida && salida.campusDestino) {
        motivoStr = \`Salida entre campus (\${salida.campusSalida} a \${salida.campusDestino})\${salida.motivo ? \` - \${salida.motivo}\` : ''}\`;
      } else if (salida.tipo === 'terapias' && salida.terapiasList?.length) {
        motivoStr = \`Terapias (\${salida.terapiasList.length}). \${salida.motivo || ''}\`;
      } else if (['cita_eps', 'cita_particular'].includes(salida.tipo) && salida.especialidadMedica) {
        motivoStr = \`\${getTipoSalidaLabel(salida.tipo)} (\${salida.especialidadMedica})\${salida.motivo ? \` - \${salida.motivo}\` : ''}\`;
      }

      const docDefinition = {
        defaultStyle: { font: 'Roboto', fontSize: 10, color: '#333333' },
        content: [
          {
            table: {
              widths: ['*'],
              body: [
                [
                  {
                    text: [
                      { text: 'UNIVERSIDAD CESMAG\\n', fontSize: 14, bold: true, alignment: 'center' },
                      { text: 'FR-002 REPORTE DE SALIDA DIGITAL v3\\n', fontSize: 11, bold: true, alignment: 'center' },
                      { text: \`Solicitud: \${solicitud.consecutivo || solicitud.id} | Fecha: \${formatDate(new Date().toISOString())}\`, fontSize: 9, alignment: 'center', color: '#666' }
                    ],
                    fillColor: '#f2f2f2',
                    margin: [0, 10, 0, 10],
                    border: [true, true, true, true]
                  }
                ]
              ]
            },
            margin: [0, 0, 0, 10]
          },
          {
            table: {
              widths: ['*'],
              body: [
                [ { text: '1. Información del Trabajador', bold: true, fillColor: '#e0e0e0', margin: [5, 5, 5, 5] } ]
              ]
            },
            margin: [0, 0, 0, 5]
          },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                [
                  { text: 'Nombres y apellidos:', bold: true },
                  { text: solicitante.nombre || personal.nombre || '' },
                  { text: 'Documento:', bold: true },
                  { text: solicitante.username || personal.documento || '' }
                ],
                [
                  { text: 'Cargo:', bold: true },
                  { text: laboral.cargo || '' },
                  { text: 'Dependencia:', bold: true },
                  { text: laboral.dependencia || '' }
                ],
                [
                  { text: 'Correo:', bold: true },
                  { text: solicitante.email || personal.correo || '', colSpan: 3 },
                  {}, {}
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 15]
          },
          {
            table: {
              widths: ['*'],
              body: [
                [ { text: '2. Datos de Salida', bold: true, fillColor: '#e0e0e0', margin: [5, 5, 5, 5] } ]
              ]
            },
            margin: [0, 0, 0, 5]
          },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                [
                  { text: 'Fecha de salida:', bold: true },
                  { text: formatDate(salida.fecha) },
                  { text: 'Hora de salida:', bold: true },
                  { text: salida.horaInicio || '' }
                ],
                [
                  { text: 'Fecha de regreso:', bold: true },
                  { text: formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha) },
                  { text: 'Hora de regreso:', bold: true },
                  { text: salida.horaFin || '' }
                ],
                [
                  { text: 'Tiempo solicitado:', bold: true },
                  { text: formatMinutes(solicitud.tiempo_solicitado_minutos) },
                  { text: 'Categoría:', bold: true },
                  { text: getTipoSalidaLabel(salida.tipo) }
                ],
                [
                  { text: 'Detalle/Motivo:', bold: true },
                  { text: motivoStr, colSpan: 3 },
                  {}, {}
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 15]
          }
        ]
      };

      if (salida.tipo === 'terapias' && salida.terapiasList?.length) {
         docDefinition.content.push({
           text: 'Fechas de Terapias:', bold: true, margin: [0, 0, 0, 5]
         });
         docDefinition.content.push({
           ul: salida.terapiasList.map(t => \`\${formatDate(t.fecha)} - \${t.horaInicio} a \${t.horaFin}\`),
           margin: [10, 0, 0, 15]
         });
      }

      if (isSalidaMultiple && participantes.length > 0) {
        docDefinition.content.push({
          table: {
            widths: ['*'],
            body: [
              [ { text: \`3. Participantes de Salida Grupal (\${participantes.length})\`, bold: true, fillColor: '#e0e0e0', margin: [5, 5, 5, 5] } ]
            ]
          },
          margin: [0, 0, 0, 5]
        });

        const pBody = [
          [
            { text: 'Documento', bold: true, fillColor: '#f8f8f8' },
            { text: 'Nombre', bold: true, fillColor: '#f8f8f8' },
            { text: 'Cargo / Dependencia', bold: true, fillColor: '#f8f8f8' }
          ]
        ];
        participantes.forEach(p => {
          pBody.push([
            p.documento || p.username || '',
            p.nombre || p.nombres || '',
            \`\${p.cargo || ''} / \${p.dependencia || ''}\`
          ]);
        });

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['20%', '40%', '40%'],
            body: pBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 15]
        });
      }

      if (reposicion.fecha) {
        docDefinition.content.push({
          table: {
            widths: ['*'],
            body: [
              [ { text: '4. Plan de Reposición', bold: true, fillColor: '#e0e0e0', margin: [5, 5, 5, 5] } ]
            ]
          },
          margin: [0, 0, 0, 5]
        });
        docDefinition.content.push({
          table: {
            widths: ['25%', '25%', '25%', '25%'],
            body: [
              [
                { text: 'Fecha Inicio:', bold: true },
                { text: formatDate(reposicion.fecha) },
                { text: 'Fecha Fin:', bold: true },
                { text: formatDate(reposicion.fechaFin || reposicion.fecha) }
              ],
              [
                { text: 'Hora Inicio:', bold: true },
                { text: reposicion.horaInicio || '' },
                { text: 'Hora Fin:', bold: true },
                { text: reposicion.horaFin || '' }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 15]
        });
      }

      docDefinition.content.push({
        table: {
          widths: ['*'],
          body: [
            [ { text: '5. Control de Aprobaciones', bold: true, fillColor: '#e0e0e0', margin: [5, 5, 5, 5] } ]
          ]
        },
        margin: [0, 0, 0, 5]
      });

      docDefinition.content.push({
        table: {
          widths: ['33%', '33%', '34%'],
          body: [
            [
              { text: 'Firma Solicitante', bold: true, alignment: 'center', fillColor: '#f8f8f8' },
              { text: 'Autorización Jefe Inmediato', bold: true, alignment: 'center', fillColor: '#f8f8f8' },
              { text: 'Revisión Gestión Humana', bold: true, alignment: 'center', fillColor: '#f8f8f8' }
            ],
            [
              { text: \`\\n\${solicitante.nombre || personal.nombre || ''}\\nC.C. \${solicitante.username || personal.documento || ''}\\n\\n\`, alignment: 'center' },
              { text: \`\\n\${solicitud.jefe_aprobado_at ? 'FIRMADO DIGITALMENTE' : 'PENDIENTE'}\\n\${jefe.nombre || ''}\\n\${solicitud.jefe_aprobado_at ? formatDate(solicitud.jefe_aprobado_at) : ''}\\n\`, alignment: 'center', color: solicitud.jefe_aprobado_at ? 'green' : 'red' },
              { text: \`\\n\${solicitud.gestion_humana_aprobado_at ? 'FIRMADO DIGITALMENTE' : 'PENDIENTE'}\\nGestión Humana\\n\${solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : ''}\\n\`, alignment: 'center', color: solicitud.gestion_humana_aprobado_at ? 'green' : 'red' }
            ]
          ]
        },
        layout: 'borders',
        margin: [0, 0, 0, 15]
      });

      docDefinition.content.push({
        text: 'Documento generado automáticamente desde SIAC UNICESMAG con la información diligenciada en el formulario digital.',
        fontSize: 8,
        color: '#888',
        alignment: 'center'
      });

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const docChunks = [];
      pdfDoc.on('data', chunk => docChunks.push(chunk));
      pdfDoc.on('end', () => resolve(Buffer.concat(docChunks)));
      pdfDoc.on('error', err => reject(err));
      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
};

const ensureReporteSalidaPdf = async (solicitud, docxAttachment = null) => {
  const outDir = path.resolve(__dirname, '../../uploads/reporte-salida');
  await fs.promises.mkdir(outDir, { recursive: true });
  const filename = \`\${String(solicitud.consecutivo || solicitud.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-FR-002-digital.pdf\`;
  const filePath = path.join(outDir, filename);
  const docx = docxAttachment || await ensureReporteSalidaDocx(solicitud);
  const converted = await convertDocxToPdf(docx.path, filePath);
  if (!converted) {
    const buffer = await buildPdfBuffer(solicitud);
    await fs.promises.writeFile(filePath, buffer);
  }
  return {
    filename,
    path: filePath,
    contentType: 'application/pdf'
  };
};`;

// Use regex to replace from "const buildPdfBuffer = (solicitud) => {"
// to "const ensureReporteSalidaDocx = async (solicitud) => {"
const pattern = /const buildPdfBuffer = \(solicitud\) => \{[\s\S]*?const ensureReporteSalidaDocx = async \(solicitud\) => \{/g;
content = content.replace(pattern, \`\${newCode}\\n\\nconst ensureReporteSalidaDocx = async (solicitud) => {\`);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('File successfully updated programmatically!');
