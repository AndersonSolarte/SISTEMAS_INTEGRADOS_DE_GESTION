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
  diligencia_personal: 'Diligencia personal'
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
    horaSalida: salida.horaInicio || '',
    fechaRegreso: formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha),
    horaRegreso: salida.horaFin || '',
    tipo: salida.tipo || '',
    reposicionFecha: formatDate(reposicion.fecha),
    reposicionFechaFin: formatDate(reposicion.fechaFin || reposicion.fecha),
    reposicionInicio: reposicion.horaInicio || '',
    reposicionFin: reposicion.horaFin || '',
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
  set(16, 0, values.tipo === 'diligencia_personal' ? 'X' : '');
  set(17, 0, ` Fecha:  ${values.reposicionFecha}${values.reposicionFechaFin && values.reposicionFechaFin !== values.reposicionFecha ? ` a ${values.reposicionFechaFin}` : ''}`);
  set(17, 1, ` Hora inicio: ${values.reposicionInicio}`);
  set(17, 2, ` Hora fin: ${values.reposicionFin}`);
  set(21, 1, ` Nombres y apellidos: ${values.jefeNombre}`);
  set(22, 1, ` Cargo: ${values.jefeCargo}`);
  set(23, 1, ` Cedula: ${values.jefeDocumento}`);
  set(25, 1, `RECIBIDO (Gestion Humana)\n\nFirma: ______________________________       Fecha:  ${values.ghFecha || '_________________________'}`);

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
    `Hora inicio: ${salida.horaInicio || ''}`,
    `Hora fin: ${salida.horaFin || ''}`,
    `Tiempo solicitado: ${formatMinutes(solicitud.tiempo_solicitado_minutos)}`,
    `Motivo / observacion: ${salida.motivo || ''}`,
    '',
    'REPOSICION DE TIEMPO',
    `Aplica reposicion: ${solicitud.reposicion_aplica ? 'SI' : 'NO'}`,
    `Fecha inicio reposicion: ${formatDate(reposicion.fecha)}`,
    `Fecha fin reposicion: ${formatDate(reposicion.fechaFin || reposicion.fecha)}`,
    `Hora inicio reposicion: ${reposicion.horaInicio || ''}`,
    `Hora fin reposicion: ${reposicion.horaFin || ''}`,
    `Tiempo reposicion: ${formatMinutes(solicitud.reposicion_minutos)}`,
    `Estado reposicion: ${solicitud.reposicion_estado || 'no_aplica'}`,
    '',
    'APROBACIONES',
    `Jefe inmediato: ${jefe.nombre || ''} - ${jefe.email || ''}`,
    `Aprobacion jefe: ${solicitud.jefe_aprobado_at ? formatDate(solicitud.jefe_aprobado_at) : 'Pendiente'}`,
    `Aprobacion Gestion Humana: ${solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : 'Pendiente'}`,
    '',
    'Este PDF fue generado automaticamente desde SIAC UNICESMAG con la informacion diligenciada en el formulario digital.'
  ];
};

const buildPdfBuffer = (solicitud) => {
  const chunks = [];
  const data = solicitud?.datos_formulario || {};
  const solicitante = solicitud?.solicitante_snapshot || {};
  const jefe = solicitud?.jefe_snapshot || {};
  const salida = data.salida || {};
  const reposicion = data.reposicion || {};
  const laboral = data.laboral || {};
  const personal = data.personal || {};
  const nombre = solicitante.nombre || personal.nombre || '';
  const documento = solicitante.username || personal.documento || '';
  const correo = solicitante.email || personal.correo || '';
  const tipo = salida.tipo || '';

  const text = (value, x, y, size = 9, bold = false, max = 95) => {
    chunks.push('BT');
    chunks.push(`/${bold ? 'F2' : 'F1'} ${size} Tf`);
    chunks.push(`1 0 0 1 ${x} ${y} Tm`);
    chunks.push(`(${escapePdfText(stripAccents(value)).slice(0, max)}) Tj`);
    chunks.push('ET');
  };
  const line = (x1, y1, x2, y2) => chunks.push(`0.5 w ${x1} ${y1} m ${x2} ${y2} l S`);
  const rect = (x, y, w, h) => chunks.push(`0.5 w ${x} ${y} ${w} ${h} re S`);
  const fillRect = (x, y, w, h, gray = 0.9) => chunks.push(`${gray} ${gray} ${gray} rg ${x} ${y} ${w} ${h} re f 0 0 0 rg 0 0 0 RG`);
  const checkbox = (x, y, checked, label) => {
    rect(x, y - 2, 9, 9);
    if (checked) {
      line(x + 2, y + 2, x + 4, y - 1);
      line(x + 4, y - 1, x + 8, y + 6);
    }
    text(label, x + 15, y, 8.5);
  };

  fillRect(42, 795, 511, 22, 0.86);
  rect(42, 70, 511, 747);
  text('UNIVERSIDAD CESMAG', 54, 802, 13, true);
  text('FR-002 REPORTE DE SALIDA v3', 226, 802, 10, true);
  text(`Solicitud: ${solicitud.consecutivo || solicitud.id}`, 405, 802, 8.5, true);
  text(`Fecha de reporte: ${formatDate(new Date().toISOString())}`, 54, 779, 9, true);

  fillRect(42, 748, 511, 18, 0.92);
  rect(42, 748, 511, 18);
  text('Informacion del trabajador', 205, 754, 10, true);
  rect(42, 682, 511, 66);
  line(42, 726, 553, 726);
  line(42, 704, 553, 704);
  line(298, 682, 298, 748);
  text('Nombres y apellidos:', 52, 733, 8.5, true);
  text(nombre, 155, 733, 8.5, false, 42);
  text('Documento:', 308, 733, 8.5, true);
  text(documento, 370, 733, 8.5, false, 24);
  text('Cargo:', 52, 711, 8.5, true);
  text(laboral.cargo || '', 92, 711, 8.5, false, 45);
  text('Dependencia:', 308, 711, 8.5, true);
  text(laboral.dependencia || '', 382, 711, 8.5, false, 37);
  text('Correo:', 52, 689, 8.5, true);
  text(correo, 95, 689, 8.5, false, 50);

  fillRect(42, 646, 511, 18, 0.92);
  rect(42, 646, 511, 18);
  text('Datos de salida', 236, 652, 10, true);
  rect(42, 586, 511, 60);
  line(42, 626, 553, 626);
  line(42, 606, 553, 606);
  line(298, 586, 298, 646);
  text(`Fecha de salida: ${formatDate(salida.fecha)}`, 52, 633, 8.5, true);
  text(`Hora de salida: ${salida.horaInicio || ''}`, 308, 633, 8.5, true);
  text(`Fecha de regreso: ${formatDate(salida.fechaRegreso || salida.fechaFin || salida.fecha)}`, 52, 613, 8.5, true);
  text(`Hora de regreso: ${salida.horaFin || ''}`, 308, 613, 8.5, true);
  text(`Tiempo solicitado: ${formatMinutes(solicitud.tiempo_solicitado_minutos)}`, 52, 593, 8.5, true);
  text(`Motivo: ${salida.motivo || getTipoSalidaLabel(tipo)}`, 308, 593, 8.5, false, 43);

  fillRect(42, 546, 511, 18, 0.86);
  rect(42, 546, 511, 18);
  text('Salida por actividades propias del cargo', 178, 552, 10, true);
  rect(42, 490, 511, 56);
  checkbox(58, 527, false, 'Ponencia');
  checkbox(180, 527, false, 'Visita a otras IES');
  checkbox(325, 527, false, 'Capacitacion');
  checkbox(58, 507, false, 'Proyecto de investigacion');
  checkbox(180, 507, false, 'Asistente a congreso');
  checkbox(325, 507, false, 'Practica academica');
  checkbox(58, 489, false, 'Participante en torneo deportivo');
  text('Otra, cual?:', 325, 489, 8.5, true);

  fillRect(42, 450, 511, 18, 0.86);
  rect(42, 450, 511, 18);
  text('Salida por actividades diferentes a las laborales', 166, 456, 10, true);
  rect(42, 374, 511, 76);
  checkbox(58, 429, tipo === 'cita_eps', 'Cita medica por EPS');
  checkbox(230, 429, tipo === 'cita_particular', 'Cita medica particular');
  checkbox(410, 429, tipo === 'diligencia_personal', 'Diligencia personal');
  text('Nota: Para diligencias personales indicar fecha y hora de reposicion', 58, 405, 8.5, true, 80);
  line(42, 398, 553, 398);
  line(212, 374, 212, 398);
  line(382, 374, 382, 398);
  text(`Fecha: ${formatDate(reposicion.fecha)}${(reposicion.fechaFin && reposicion.fechaFin !== reposicion.fecha) ? ` a ${formatDate(reposicion.fechaFin)}` : ''}`, 52, 383, 8.5, true);
  text(`Hora inicio: ${reposicion.horaInicio || ''}`, 222, 383, 8.5, true);
  text(`Hora fin: ${reposicion.horaFin || ''}`, 392, 383, 8.5, true);

  fillRect(42, 334, 511, 18, 0.92);
  rect(42, 334, 511, 18);
  text('Control de aprobaciones', 213, 340, 10, true);
  rect(42, 230, 511, 104);
  line(42, 282, 553, 282);
  line(298, 230, 298, 334);
  text('Firma del trabajador solicitante', 82, 315, 9, true);
  text(nombre, 82, 298, 8.5);
  line(82, 292, 258, 292);
  text('Autorizacion del jefe inmediato', 334, 315, 9, true);
  text(jefe.nombre || '', 334, 298, 8.5, false, 34);
  line(334, 292, 510, 292);
  text(`Firma: ${solicitud.jefe_aprobado_at ? 'Aprobado por correo' : 'Pendiente'}`, 334, 266, 8.5);
  text(`Cargo: ${jefe.cargo || ''}`, 334, 250, 8.5, false, 35);
  text(`Cedula: ${jefe.username || ''}`, 334, 234, 8.5);

  fillRect(42, 190, 511, 18, 0.92);
  rect(42, 190, 511, 18);
  text('RECIBIDO - Gestion Humana', 218, 196, 10, true);
  rect(42, 122, 511, 68);
  text(`Estado Gestion Humana: ${solicitud.gestion_humana_aprobado_at ? 'Aprobado' : 'Pendiente'}`, 58, 166, 8.5, true);
  text(`Fecha: ${solicitud.gestion_humana_aprobado_at ? formatDate(solicitud.gestion_humana_aprobado_at) : ''}`, 360, 166, 8.5, true);
  text('Firma:', 58, 138, 8.5, true);
  line(96, 138, 286, 138);
  text('Documento generado automaticamente desde SIAC UNICESMAG con la informacion diligenciada en el formulario digital.', 58, 92, 7.5, false, 110);

  const stream = chunks.join('\n');
  const objects = [
    '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj',
    '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj',
    '3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 6 0 R >>\nendobj',
    '4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj',
    '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj',
    `6 0 obj\n<< /Length ${Buffer.byteLength(stream, 'utf8')} >>\nstream\n${stream}\nendstream\nendobj`
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${obj}\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return Buffer.from(pdf, 'utf8');
};

const ensureReporteSalidaPdf = async (solicitud, docxAttachment = null) => {
  const outDir = path.resolve(__dirname, '../../uploads/reporte-salida');
  await fs.promises.mkdir(outDir, { recursive: true });
  const filename = `${String(solicitud.consecutivo || solicitud.id).replace(/[^a-zA-Z0-9_-]/g, '_')}-FR-002-digital.pdf`;
  const filePath = path.join(outDir, filename);
  const docx = docxAttachment || await ensureReporteSalidaDocx(solicitud);
  const converted = await convertDocxToPdf(docx.path, filePath);
  if (!converted) {
    const buffer = buildPdfBuffer(solicitud);
    await fs.promises.writeFile(filePath, buffer);
  }
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
