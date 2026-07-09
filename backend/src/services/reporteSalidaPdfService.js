const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const JSZip = require('jszip');
const { getReporteSalidaTemplatePath } = require('../config/reporteSalidaConfig');

const execFileAsync = promisify(execFile);

const escapePdfText = (value) =>
  String(value ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\r?\n/g, ' ');

const escapeXmlText = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const stripAccents = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const formatDate = (value) => {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = value.getFullYear();
    return `${day}/${month}/${year}`;
  }
  const text = String(value).slice(0, 10);
  const [year, month, day] = text.split('-');
  return year && month && day ? `${day}/${month}/${year}` : text;
};

const formatDateTime = (value) => {
  if (!value) return '';
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) return value;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  let hours = dateObj.getHours();
  const ampm = hours >= 12 ? 'p. m.' : 'a. m.';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const mins = String(dateObj.getMinutes()).padStart(2, '0');
  const secs = String(dateObj.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${mins}:${secs} ${ampm}`;
};

const formatTimeAmPm = (timeString) => {
  if (!timeString) return '';
  const [h, m] = timeString.split(':');
  if (!h || !m) return timeString;
  let hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  hour = hour ? hour : 12; 
  return `${String(hour).padStart(2, '0')}:${m} ${ampm}`;
};

const formatMinutes = (minutes) => {
  const total = Number(minutes || 0);
  if (!Number.isFinite(total) || total <= 0) return '0h 00m';
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}h ${String(m).padStart(2, '0')}m`;
};

const getTipoSalidaLabel = (tipo) => ({
  cita_eps: 'Cita medica por EPS',
  cita_particular: 'Cita medica particular',
  diligencia_personal: 'Diligencia personal',
  compensatorio: 'Compensatorio',
  voto_jurado: 'Permiso: Jurado de votación',
  voto_sufragante: 'Permiso: Sufragante',
  calamidad_domestica: 'Permiso: Calamidad doméstica',
  entierro_companero: 'Permiso: Entierro compañeros',
  comision_sindical: 'Permiso: Comisiones sindicales',
  matrimonio: 'Permiso: Matrimonio',
  lactancia: 'Permiso: Lactancia',
  luto_conyuge: 'Licencia luto: Cónyuge',
  luto_companero: 'Licencia luto: Compañero(a)',
  luto_familiar: 'Licencia luto: Familiar',
  actos_funebres: 'Licencia: Actos fúnebres',
  cuidado_ninez: 'Licencia: Cuidado niñez',
  calidad_servicio: 'Mejora en la calidad del servicio',
  jurado_votacion: 'Permiso: Jurado de votación',
  sufragante: 'Permiso: Sufragante',
  cargos_oficiales_transitorios: 'Permiso: Desempeño de cargos oficiales transitorios',
  comisiones_sindicales: 'Permiso: Comisiones sindicales',
  obligaciones_escolares: 'Permiso: Obligaciones escolares',
  citaciones_judiciales: 'Permiso: Citaciones judiciales, administrativas y de policía',
  cuidado_hijo_ley_2174: 'Permiso: Cuidado de hijo(a) - Ley 2174 de 2021'
}[tipo] || tipo || '');

const replaceOnce = (xml, search, replacement) => {
  const index = xml.indexOf(search);
  if (index < 0) return xml;
  return `${xml.slice(0, index)}${replacement}${xml.slice(index + search.length)}`;
};

const buildDocxData = (solicitud) => {
  const data = solicitud?.datos_formulario || {};
  const solicitante = solicitud?.solicitante_snapshot || {};
  const jefe = solicitud?.jefe_snapshot || {};
  const salida = data.salida || {};
  const reposicion = data.reposicion || {};
  const laboral = data.laboral || {};
  const personal = data.personal || {};
  return {
    fechaReporte: formatDate(new Date().toISOString()),
    nombre: solicitante.nombre || personal.nombre || '',
    documento: solicitante.username || personal.documento || '',
    cargo: laboral.cargo || '',
    dependencia: laboral.dependencia || '',
    fechaSalida: formatDate(salida.fecha),
    horaSalida: formatTimeAmPm(salida.horaInicio),
    fechaRegreso: formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha),
    horaRegreso: formatTimeAmPm(salida.horaFin),
    tipo: salida.tipo || '',
    reposicionFecha: formatDate(reposicion.fecha),
    reposicionFechaFin: formatDate(reposicion.fechaFin || reposicion.fecha),
    reposicionInicio: formatTimeAmPm(reposicion.horaInicio),
    reposicionFin: formatTimeAmPm(reposicion.horaFin),
    jefeNombre: jefe.nombre || '',
    jefeCargo: jefe.cargo || '',
    jefeDocumento: jefe.username || '',
    ghFecha: solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : ''
  };
};

const buildCellTextXml = (text) => {
  const lines = String(text ?? '').split(/\r?\n/);
  return lines.map((line, index) => {
    const breakXml = index === 0 ? '' : '<w:br/>';
    return `<w:r>${breakXml}<w:t xml:space="preserve">${escapeXmlText(line)}</w:t></w:r>`;
  }).join('');
};

const setCellText = (cellXml, text) => {
  const tcPr = (cellXml.match(/<w:tcPr[\s\S]*?<\/w:tcPr>/) || [''])[0];
  return `<w:tc>${tcPr}<w:p>${buildCellTextXml(text)}</w:p></w:tc>`;
};

const updateRowCell = (rowXml, cellIndex, text) => {
  const cells = rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || [];
  if (!cells[cellIndex]) return rowXml;
  cells[cellIndex] = setCellText(cells[cellIndex], text);
  let updated = rowXml;
  (rowXml.match(/<w:tc[\s\S]*?<\/w:tc>/g) || []).forEach((cell, index) => {
    updated = replaceOnce(updated, cell, cells[index]);
  });
  return updated;
};

const fillReporteSalidaRows = (xml, values) => {
  const originalRows = xml.match(/<w:tr[\s\S]*?<\/w:tr>/g) || [];
  const rows = [...originalRows];
  const set = (rowIndex, cellIndex, text) => {
    if (!rows[rowIndex]) return;
    rows[rowIndex] = updateRowCell(rows[rowIndex], cellIndex, text);
  };

  set(0, 0, `  Fecha de reporte: ${values.fechaReporte}`);
  set(2, 0, `Nombres y apellidos: ${values.nombre}`);
  set(3, 0, `  Numero de documento de identidad: ${values.documento}`);
  set(4, 0, `Cargo: ${values.cargo}`);
  set(4, 1, `Dependencia: ${values.dependencia}`);
  set(5, 0, `Fecha de salida: ${values.fechaSalida}`);
  set(5, 1, `Hora de salida: ${values.horaSalida}`);
  set(6, 0, `Fecha de regreso: ${values.fechaRegreso}`);
  set(6, 1, `  Hora de regreso: ${values.horaRegreso}`);
  set(15, 0, values.tipo === 'cita_eps' ? 'X' : '');
  set(15, 2, values.tipo === 'cita_particular' ? 'X' : '');
  const isPersonalPermission = [
    'diligencia_personal', 'compensatorio',
    'voto_jurado', 'voto_sufragante', 'comision_sindical', 'matrimonio', 'lactancia', 'luto_conyuge', 'luto_companero', 'luto_familiar', 'actos_funebres', 'cuidado_ninez',
    'jurado_votacion', 'sufragante', 'cargos_oficiales_transitorios', 'calamidad_domestica', 'entierro_companero', 'comisiones_sindicales', 'obligaciones_escolares', 'citaciones_judiciales', 'cuidado_hijo_ley_2174'
  ].includes(values.tipo);
  set(16, 0, isPersonalPermission ? 'X' : '');
  set(17, 0, ` Fecha:  ${values.reposicionFecha}${values.reposicionFechaFin && values.reposicionFechaFin !== values.reposicionFecha ? ` a ${values.reposicionFechaFin}` : ''}`);
  set(17, 1, ` Hora inicio: ${values.reposicionInicio}`);
  set(17, 2, ` Hora fin: ${values.reposicionFin}`);
  set(21, 1, ` Nombres y apellidos: ${values.jefeNombre}`);
  set(22, 1, ` Cargo: ${values.jefeCargo}`);
  set(23, 1, ` Cedula: ${values.jefeDocumento}`);
  set(25, 1, `RECIBIDO (Gestión del Talento Humano)\n\nFirma: ______________________________       Fecha:  ${values.ghFecha || '_________________________'}`);

  let updatedXml = xml;
  originalRows.forEach((row, index) => {
    updatedXml = replaceOnce(updatedXml, row, rows[index]);
  });
  return updatedXml;
};

const buildFilledDocxBuffer = async (solicitud) => {
  const templatePath = getReporteSalidaTemplatePath()
    || path.resolve(__dirname, '../../templates/reporte-salida/FR-002 REPORTE DE SALIDA v3.docx');
  const template = await fs.promises.readFile(templatePath);
  const zip = await JSZip.loadAsync(template);
  const file = zip.file('word/document.xml');
  if (!file) throw new Error('La plantilla FR-002 no contiene word/document.xml');
  const values = buildDocxData(solicitud);
  let xml = await file.async('string');
  xml = fillReporteSalidaRows(xml, values);

  zip.file('word/document.xml', xml);
  return zip.generateAsync({ type: 'nodebuffer' });
};

const findGeneratedPdfPath = async (outDir, docxPath) => {
  const expected = path.join(outDir, `${path.basename(docxPath, path.extname(docxPath))}.pdf`);
  try {
    await fs.promises.access(expected, fs.constants.R_OK);
    return expected;
  } catch (_) {
    const files = await fs.promises.readdir(outDir);
    const pdf = files
      .filter((file) => file.toLowerCase().endsWith('.pdf'))
      .map((file) => path.join(outDir, file))
      .sort()
      .pop();
    return pdf || '';
  }
};

const convertDocxToPdf = async (docxPath, targetPdfPath) => {
  const outDir = path.dirname(targetPdfPath);
  const profileDir = path.join(outDir, '.libreoffice-profile');
  await fs.promises.mkdir(profileDir, { recursive: true });

  const configured = String(process.env.LIBREOFFICE_BIN || '').trim();
  const candidates = configured ? [configured] : ['libreoffice', 'soffice'];
  let lastError = null;

  for (const binary of candidates) {
    try {
      await execFileAsync(binary, [
        `-env:UserInstallation=file:///${profileDir.replace(/\\/g, '/')}`,
        '--headless',
        '--nologo',
        '--nofirststartwizard',
        '--convert-to',
        'pdf',
        '--outdir',
        outDir,
        docxPath
      ], { timeout: 120000 });

      const generatedPdf = await findGeneratedPdfPath(outDir, docxPath);
      if (!generatedPdf) throw new Error('LibreOffice no genero el archivo PDF esperado.');
      if (path.resolve(generatedPdf) !== path.resolve(targetPdfPath)) {
        await fs.promises.copyFile(generatedPdf, targetPdfPath);
      }
      return true;
    } catch (error) {
      lastError = error;
      if (error.code !== 'ENOENT') break;
    }
  }

  console.warn('No fue posible convertir el DOCX FR-002 a PDF con LibreOffice:', lastError?.message || lastError);
  return false;
};

const buildLines = (solicitud) => {
  const data = solicitud?.datos_formulario || {};
  const solicitante = solicitud?.solicitante_snapshot || {};
  const jefe = solicitud?.jefe_snapshot || {};
  const salida = data.salida || {};
  const reposicion = data.reposicion || {};
  const laboral = data.laboral || {};
  const personal = data.personal || {};

  return [
    'UNIVERSIDAD CESMAG',
    'FR-002 REPORTE DE SALIDA v3',
    `Solicitud: ${solicitud.consecutivo || solicitud.id}`,
    '',
    'DATOS DEL COLABORADOR',
    `Nombre: ${solicitante.nombre || personal.nombre || ''}`,
    `Documento: ${solicitante.username || personal.documento || ''}`,
    `Correo: ${solicitante.email || ''}`,
    `Cargo: ${laboral.cargo || ''}`,
    `Dependencia: ${laboral.dependencia || ''}`,
    '',
    'DATOS DE SALIDA',
    `Tipo de salida: ${salida.tipo || ''}`,
    `Fecha salida: ${formatDate(salida.fecha)}`,
    `Fecha regreso: ${formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha)}`,
    `Hora inicio: ${formatTimeAmPm(salida.horaInicio)}`,
    `Hora fin: ${formatTimeAmPm(salida.horaFin)}`,
    `Tiempo solicitado: ${formatMinutes(solicitud.tiempo_solicitado_minutos)}`,
    `Motivo / observacion: ${salida.motivo || ''}`,
    '',
    'DATOS DE REPOSICION',
    `Fecha reposicion: ${formatDate(reposicion.fecha)}`,
    `Fecha fin reposicion: ${formatDate(reposicion.fechaFin || reposicion.fecha)}`,
    `Hora inicio reposicion: ${formatTimeAmPm(reposicion.horaInicio)}`,
    `Hora fin reposicion: ${formatTimeAmPm(reposicion.horaFin)}`,
    `Tiempo reposicion: ${formatMinutes(solicitud.reposicion_minutos)}`,
    `Estado reposicion: ${solicitud.reposicion_estado || 'no_aplica'}`,
    '',
    'APROBACIONES',
    `Jefe inmediato: ${jefe.nombre || ''} - ${jefe.email || ''}`,
    `Aprobacion jefe: ${solicitud.jefe_aprobado_at ? formatDate(solicitud.jefe_aprobado_at) : 'Pendiente'}`,
    `Aprobacion Gestión del Talento Humano: ${solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : 'Pendiente'}`,
    '',
    'Este PDF fue generado automaticamente desde SIAC UNICESMAG con la informacion diligenciada en el formulario digital.'
  ];
};

const PdfPrinter = require('pdfmake');

const buildPdfBuffer = async (solicitud) => {
  let ghDirectorNombre = '';
  let ghDirectorCargo = 'Jefe de Gestión del Talento Humano';
  if (solicitud.gestion_humana_aprobado_at) {
    try {
      const { User } = require('../models');
      const { Op } = require('sequelize');
      const ghUser = await User.findOne({
        where: {
          dependencia: { [Op.in]: ['Gestión del Talento Humano', 'Gestión del Talento Humano'] },
          cargo: { [Op.in]: ['Jefe Gestión del Talento Humano', 'Jefe de Gestión del Talento Humano', 'Jefe de Gestión del Talento Humano', 'Jefe Gestión del Talento Humano'] }
        }
      });
      if (ghUser) {
        ghDirectorNombre = ghUser.nombre;
        ghDirectorCargo = ghUser.cargo;
      }
    } catch (err) {
      console.error('Error fetching GH user for PDF:', err);
    }
  }

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
      const isPropiasCargo = salida.categoria === 'propias_cargo' && salida.tipo !== 'salida_campus';
      const alcance = isPropiasCargo ? (salida.alcance || 'Local') : 'Local';
      let ubicacionStr = alcance;
      if (isPropiasCargo) {
        if (alcance === 'Internacional' && salida.pais) {
          ubicacionStr = `${alcance} (${salida.pais})`;
        } else if (alcance === 'Nacional' && salida.departamento && salida.municipio) {
          ubicacionStr = `${alcance} (${salida.municipio}, ${salida.departamento})`;
        } else if (alcance === 'Regional' && salida.municipio) {
          ubicacionStr = `${alcance} (${salida.municipio}, Nariño)`;
        }
      }

      let motivoStr = salida.motivo || getTipoSalidaLabel(salida.tipo);
      if (salida.tipo === 'salida_campus' && salida.campusSalida && salida.campusDestino) {
        motivoStr = `Salida entre campus (${salida.campusSalida} a ${salida.campusDestino})${salida.motivo ? ` - ${salida.motivo}` : ''}`;
      } else if (salida.tipo === 'terapias' && salida.terapiasList?.length) {
        motivoStr = `Terapias (${salida.terapiasList.length}). ${salida.motivo || ''}`;
      } else if (['cita_eps', 'cita_particular'].includes(salida.tipo) && salida.especialidadMedica) {
        motivoStr = `${getTipoSalidaLabel(salida.tipo)} (${salida.especialidadMedica})${salida.motivo ? ` - ${salida.motivo}` : ''}`;
      }

      const docDefinition = {
        pageMargins: [35, 25, 35, 25],
        defaultStyle: { font: 'Roboto', fontSize: 9.5, color: '#333333' },
        content: [
          {
            table: {
              widths: ['22%', '50%', '28%'],
              body: [
                [
                  {
                    image: path.join(__dirname, '../assets/logo_formatos.jpg'),
                    width: 100,
                    alignment: 'center',
                    margin: [0, 5, 0, 5]
                  },
                  {
                    text: '\nREPORTE DE SALIDA DURANTE LA\nJORNADA LABORAL',
                    alignment: 'center',
                    fontSize: 12,
                    bold: true,
                    margin: [0, 10, 0, 0]
                  },
                  {
                    table: {
                      widths: ['*'],
                      body: [
                        [ { text: 'CÓDIGO: THM-DP-FR-002', bold: true, fontSize: 9 } ],
                        [ { text: 'VERSIÓN: 3', bold: true, fontSize: 9 } ],
                        [ { text: 'FECHA: 15/FEB/2023', bold: true, fontSize: 9 } ]
                      ]
                    },
                    layout: {
                      hLineWidth: (i, node) => (i === 0 || i === node.table.body.length) ? 0 : 1,
                      vLineWidth: () => 0,
                      paddingLeft: () => 4,
                      paddingRight: () => 4,
                      paddingTop: () => 2,
                      paddingBottom: () => 2
                    },
                    margin: [-4, -2, -4, -2]
                  }
                ]
              ]
            },
            layout: 'borders',
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              widths: ['*'],
              body: [
                [ { text: '1. Información del Trabajador', bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
              ]
            },
            margin: [0, 0, 0, 3]
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
            margin: [0, 0, 0, 8]
          },
          {
            table: {
              widths: ['*'],
              body: [
                [ { text: '2. Datos de Salida', bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
              ]
            },
            margin: [0, 0, 0, 3]
          },
          {
            table: {
              widths: ['25%', '25%', '25%', '25%'],
              body: [
                ...(salida.tipo !== 'terapias' ? [
                  [
                    { text: 'Fecha de salida:', bold: true },
                    { text: formatDate(salida.fecha) },
                    { text: 'Hora de salida:', bold: true },
                    { text: formatTimeAmPm(salida.horaInicio) }
                  ],
                  [
                    { text: 'Fecha de regreso:', bold: true },
                    { text: formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha) },
                    { text: 'Hora de regreso:', bold: true },
                    { text: formatTimeAmPm(salida.horaFin) }
                  ]
                ] : []),
                [
                  { text: 'Alcance:', bold: true },
                  { text: ubicacionStr },
                  { text: 'Categoría:', bold: true },
                  { text: getTipoSalidaLabel(salida.tipo) }
                ],
                [
                  { text: 'Tiempo solicitado:', bold: true },
                  { text: formatMinutes(solicitud.tiempo_solicitado_minutos) },
                  { text: 'Detalle/Motivo:', bold: true },
                  { text: motivoStr }
                ]
              ]
            },
            layout: 'lightHorizontalLines',
            margin: [0, 0, 0, 8]
          }
        ]
      };

      if (salida.tipo === 'terapias' && salida.terapiasList?.length) {
         const tBody = [
           [
             { text: 'Nº', bold: true, fillColor: '#f8f8f8' },
             { text: 'Fecha', bold: true, fillColor: '#f8f8f8' },
             { text: 'Hora inicio', bold: true, fillColor: '#f8f8f8' },
             { text: 'Hora fin', bold: true, fillColor: '#f8f8f8' }
           ]
         ];
         salida.terapiasList.forEach((t, i) => {
           tBody.push([
             (i + 1).toString(),
             formatDate(t.fecha),
             formatTimeAmPm(t.horaInicio),
             formatTimeAmPm(t.horaFin)
           ]);
         });
         
         tBody.push([
           { text: 'Tiempo total autorizado:', colSpan: 3, alignment: 'right', bold: true, fillColor: '#f8f8f8' },
           {},
           {},
           { text: formatMinutes(solicitud.tiempo_solicitado_minutos), bold: true, fillColor: '#f8f8f8', alignment: 'center' }
         ]);

         docDefinition.content.push({
           table: {
             widths: ['*'],
             body: [
               [ { text: `3. Cronograma de Terapias (${salida.terapiasList.length})`, bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
             ]
           },
           margin: [0, 0, 0, 3]
         });

         docDefinition.content.push({
           table: {
             headerRows: 1,
             widths: ['10%', '30%', '30%', '30%'],
             body: tBody
           },
           layout: 'lightHorizontalLines',
           margin: [0, 0, 0, 8]
         });
      }

      if (isSalidaMultiple && participantes.length > 0) {
        docDefinition.content.push({
          table: {
            widths: ['*'],
            body: [
              [ { text: `3. Participantes de Salida Grupal (${participantes.length})`, bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
            ]
          },
          margin: [0, 0, 0, 3]
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
            `${p.cargo || ''} / ${p.dependencia || ''}`
          ]);
        });

        docDefinition.content.push({
          table: {
            headerRows: 1,
            widths: ['20%', '40%', '40%'],
            body: pBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8]
        });
      }

      if (reposicion.fecha) {
        docDefinition.content.push({
          table: {
            widths: ['*'],
            body: [
              [ { text: '4. Plan de Reposición', bold: true, fillColor: '#e0e0e0', margin: [5, 3, 5, 3] } ]
            ]
          },
          margin: [0, 0, 0, 3]
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
                { text: formatTimeAmPm(reposicion.horaInicio) },
                { text: 'Hora Fin:', bold: true },
                { text: formatTimeAmPm(reposicion.horaFin) }
              ]
            ]
          },
          layout: 'lightHorizontalLines',
          margin: [0, 0, 0, 8]
        });
      }

      const ghDirectorCargo = solicitud.jefe_snapshot?.director_gh_cargo || 'Jefe de Gestión del Talento Humano';
      const txId = solicitud.datos_formulario?.tx_id || String(solicitud.consecutivo || solicitud.id);
      const reqDate = formatDateTime(solicitud.createdAt || new Date());
      const jefeDate = solicitud.jefe_aprobado_at ? formatDateTime(solicitud.jefe_aprobado_at) : 'Pendiente';
      const ghDate = solicitud.gestion_humana_aprobado_at ? formatDateTime(solicitud.gestion_humana_aprobado_at) : 'Pendiente';

      const isPropiasCargoSubtype = ['ponencia', 'visita_ies', 'capacitacion', 'proyecto_investigacion', 'asistente_congreso', 'practica_academica', 'torneo_deportivo', 'salida_campus', 'otra'].includes(salida.tipo) || String(salida.tipo).startsWith('otra:');
      const requiresSst = isPropiasCargoSubtype && ['Nacional', 'Internacional'].includes(alcance);

      const sstEvent = Array.isArray(solicitud.trazabilidad)
        ? solicitud.trazabilidad.find(t => t.event === 'aprobada_sst')
        : null;
      const sstApprovedAt = sstEvent ? new Date(sstEvent.at) : null;
      const sstDate = sstApprovedAt ? formatDateTime(sstApprovedAt) : 'Pendiente';
      const sstActorName = sstEvent?.actor?.nombre || 'Seguridad y Salud en el Trabajo';

      const signatureTableBody = [
        [
          { text: 'Firma del trabajador Solicitante', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
          { text: 'Autorización del Jefe inmediato', bold: true, alignment: 'center', fillColor: '#e0e0e0' }
        ],
        [
          {
            text: [
              { text: 'Firmado electrónicamente por:\n', bold: true, fontSize: 9 },
              { text: `${solicitante.nombre || personal.nombre || ''}\n`, fontSize: 10 },
              { text: `Documento: ${solicitante.username || personal.documento || ''}\n`, fontSize: 8 },
              { text: `Fecha y hora: ${reqDate}\n`, fontSize: 8 },
              { text: `ID Transacción: ${txId}\n`, fontSize: 7, color: 'gray' }
            ],
            margin: [5, 5, 5, 5]
          },
          {
            text: [
              { text: solicitud.jefe_aprobado_at ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
              { text: `${solicitud.jefe_aprobado_at ? (jefe.nombre || '') : 'Pendiente'}\n`, fontSize: 10 },
              { text: `Cargo: ${jefe.cargo || ''}\n`, fontSize: 8 },
              { text: `Fecha y hora: ${jefeDate}\n`, fontSize: 8 },
              { text: solicitud.jefe_aprobado_at ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
            ],
            margin: [5, 5, 5, 5]
          }
        ]
      ];

      if (requiresSst) {
        signatureTableBody.push([
          { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', fillColor: '#e0e0e0' },
          { text: 'APROBADO (Seguridad y Salud en el Trabajo)', bold: true, alignment: 'center', fillColor: '#e0e0e0' }
        ]);
        signatureTableBody.push([
          {
            text: [
              { text: solicitud.gestion_humana_aprobado_at ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
              { text: `${solicitud.gestion_humana_aprobado_at ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
              { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
              { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
              { text: solicitud.gestion_humana_aprobado_at ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
            ],
            margin: [5, 5, 5, 5]
          },
          {
            text: [
              { text: sstApprovedAt ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
              { text: `${sstApprovedAt ? sstActorName : 'Pendiente'}\n`, fontSize: 10 },
              { text: `Cargo: Coordinador SST\n`, fontSize: 8 },
              { text: `Fecha y hora: ${sstDate}\n`, fontSize: 8 },
              { text: sstApprovedAt ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
            ],
            margin: [5, 5, 5, 5]
          }
        ]);
      } else {
        signatureTableBody.push([
          { text: 'RECIBIDO (Gestión del Talento Humano)', bold: true, alignment: 'center', colSpan: 2, fillColor: '#e0e0e0' },
          {}
        ]);
        signatureTableBody.push([
          {
            text: [
              { text: solicitud.gestion_humana_aprobado_at ? 'Firmado electrónicamente por:\n' : '\n', bold: true, fontSize: 9 },
              { text: `${solicitud.gestion_humana_aprobado_at ? ghDirectorNombre : 'Pendiente'}\n`, fontSize: 10 },
              { text: `Cargo: ${ghDirectorCargo}\n`, fontSize: 8 },
              { text: `Fecha y hora: ${ghDate}\n`, fontSize: 8 },
              { text: solicitud.gestion_humana_aprobado_at ? `ID Transacción: ${txId}\n` : '\n', fontSize: 7, color: 'gray' }
            ],
            margin: [5, 5, 5, 5],
            alignment: 'center',
            colSpan: 2
          },
          {}
        ]);
      }

      docDefinition.content.push({
        table: {
          widths: ['50%', '50%'],
          body: signatureTableBody
        },
        layout: 'borders',
        margin: [0, 0, 0, 8]
      });

      let trazabilidad = solicitud?.trazabilidad || [];
      if (typeof trazabilidad === 'string') {
        try { trazabilidad = JSON.parse(trazabilidad); } catch (e) { trazabilidad = []; }
      }
      if (!Array.isArray(trazabilidad)) trazabilidad = [];

      if (trazabilidad.length > 0) {
        const traceEventLabels = {
          'radicada': 'Radicación inicial',
          'radicada_grupal': 'Radicación de salida grupal',
          'correo_jefe_enviado': 'Notificación a Jefe Inmediato',
          'correo_jefe_error': 'Error al notificar a Jefe Inmediato',
          'aprobada_jefe': 'Aprobación de Jefe Inmediato',
          'rechazada_jefe': 'Rechazada por Jefe Inmediato',
          'correo_gestion_humana_enviado': 'Notificación a Gestión del Talento Humano',
          'correo_gestion_humana_error': 'Error al notificar a Gestión del Talento Humano',
          'aprobada_gestion_humana': 'Aprobación de Gestión del Talento Humano',
          'rechazada_gestion_humana': 'Rechazada por Gestión del Talento Humano',
          'correo_sst_enviado': 'Notificación a SST',
          'correo_sst_error': 'Error al notificar a SST',
          'aprobada_sst': 'Aprobación de SST',
          'rechazada_sst': 'Rechazada por SST',
          'notificacion_final_enviada': 'Notificación final enviada',
          'reposicion_cumplida': 'Reposición marcada como cumplida',
          'reposicion_incumplida': 'Reposición marcada como incumplida',
          'reposicion_pendiente': 'Reposición marcada como pendiente'
        };

        const traceBody = [
          [
            { text: 'Fecha / Hora', bold: true, fillColor: '#f4f4f5' },
            { text: 'Evento', bold: true, fillColor: '#f4f4f5' },
            { text: 'Actor', bold: true, fillColor: '#f4f4f5' },
            { text: 'Detalle', bold: true, fillColor: '#f4f4f5' }
          ]
        ];

        trazabilidad.forEach(t => {
          const dateStr = t.at ? new Date(t.at).toLocaleString('es-CO') : '';
          const eventStr = traceEventLabels[t.event] || t.event;
          
          let actorStr = t.actor?.nombre || t.actor?.username || '';
          if (!actorStr) {
            if (t.event.includes('_jefe')) {
              actorStr = solicitud?.jefe_snapshot?.nombre || 'Jefe Inmediato';
            } else if (t.event.includes('_gestion_humana')) {
              actorStr = 'Gestión del Talento Humano';
            } else if (t.event.includes('_sst')) {
              actorStr = 'Seguridad y Salud en el Trabajo';
            } else if (t.event.includes('correo_') || t.event.includes('notificacion_')) {
              actorStr = 'Sistema Automático';
            } else {
              actorStr = 'Sistema Automático';
            }
          }
          
          let detailStr = '';
          if (t.motivo) detailStr = t.motivo;
          if (t.observacion) detailStr = t.observacion;
          if (t.error) detailStr = `Error: ${t.error}`;
          if (t.justificacion) detailStr = `Justificación: ${t.justificacion}`;

          if (!detailStr) {
            if (t.event.includes('radicada')) detailStr = 'Se registró la solicitud en el sistema.';
            else if (t.event.includes('correo_')) detailStr = 'Correo electrónico enviado exitosamente.';
            else if (t.event.includes('notificacion_final')) detailStr = 'Correos finales de cierre enviados al colaborador, dependencia, Gestión del Talento Humano y Seguridad y Salud en el Trabajo (SST).';
            else if (t.event.includes('aprobada_')) detailStr = 'Aprobado sin observaciones adicionales.';
            else if (t.event.includes('rechazada_')) detailStr = 'Rechazado sin justificación adicional.';
            else detailStr = 'Procesado exitosamente.';
          }

          traceBody.push([
            { text: dateStr, fontSize: 8 },
            { text: eventStr, fontSize: 8 },
            { text: actorStr, fontSize: 8 },
            { text: detailStr, fontSize: 8 }
          ]);
        });

        docDefinition.content.push({
          table: {
            widths: ['20%', '30%', '25%', '25%'],
            body: traceBody
          },
          layout: 'lightHorizontalLines',
          margin: [0, 5, 0, 8]
        });
      }

      docDefinition.content.push({
        text: [
          'Documento generado automáticamente desde SIAC UNICESMAG con la información diligenciada en el formulario digital.\n',
          'Toda la información personal suministrada en este reporte será tratada de forma estrictamente confidencial, en cumplimiento y de acuerdo con la Política de Tratamiento de Datos Personales de UNICESMAG, garantizando su uso exclusivo para los fines administrativos e institucionales correspondientes.'
        ],
        fontSize: 8,
        color: '#71717a',
        alignment: 'center',
        margin: [20, 5, 20, 0]
      });

      const frontendUrl = process.env.FRONTEND_URL || 'https://planeaciongp.unicesmag.edu.co';
      const verifyUrl = `${frontendUrl.replace(/\/$/, '')}/verificar/${txId}`;
      docDefinition.content.push({
        unbreakable: true,
        columns: [
          {
            width: 105,
            qr: verifyUrl,
            fit: 95,
            margin: [0, 0, 10, 0]
          },
          {
            width: '*',
            text: [
              { text: 'Verificación de Autenticidad e Integridad\n', bold: true, fontSize: 9 },
              { text: 'Este documento ha sido firmado electrónicamente. Para verificar su validez legal y confirmar que no ha sido alterado, escanee el código QR o ingrese a:\n', fontSize: 8 },
              { text: verifyUrl, fontSize: 8, color: 'blue', link: verifyUrl }
            ],
            margin: [0, 5, 0, 0]
          }
        ],
        margin: [20, 10, 20, 5]
      });

      const pdfOptions = {
        userPassword: '', 
        ownerPassword: process.env.PDF_OWNER_PASSWORD || 'UNICESMAG-SECURE-2026',
        permissions: {
          modifying: false,
          copying: false,
          annotating: false,
          fillingForms: false
        }
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition, pdfOptions);
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
  const filename = `${String(solicitud.consecutivo || solicitud.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-FR-002-digital.pdf`;
  const filePath = path.join(outDir, filename);

  const buffer = await buildPdfBuffer(solicitud);
  await fs.promises.writeFile(filePath, buffer);
  
  return {
    filename,
    path: filePath,
    contentType: 'application/pdf'
  };
};

const ensureReporteSalidaDocx = async (solicitud) => {
  const outDir = path.resolve(__dirname, '../../uploads/reporte-salida');
  await fs.promises.mkdir(outDir, { recursive: true });
  const base = String(solicitud.consecutivo || solicitud.id).replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `${base}-FR-002-diligenciado.docx`;
  const filePath = path.join(outDir, filename);
  const buffer = await buildFilledDocxBuffer(solicitud);
  await fs.promises.writeFile(filePath, buffer);
  return {
    filename,
    path: filePath,
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };
};

module.exports = {
  ensureReporteSalidaDocx,
  ensureReporteSalidaPdf,
  formatMinutes
};
