const ExcelJS = require('exceljs');

const AUTHORIZATION_TEXT = 'Autorizo a la Universidad CESMAG para que descuente de mi salario, prestaciones sociales a la fecha consignadas en los fondos de cesantías y/o cualquier otra acreencia relacionada con honorarios o servicios, el valor recibido o al que mi cargo diera lugar la no oportuna legalización de este anticipo.';
const LEGALIZATION_NOTICE = 'IMPORTANTE: El Acuerdo 001 de 2013 exige la legalización de este anticipo dentro de los tres días hábiles siguientes al regreso de la comisión.';

const formatDate = (value) => {
  if (!value) return '';
  const raw = String(value).trim();
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}/.test(raw)
      ? new Date(`${raw.slice(0, 10)}T12:00:00`)
      : new Date(raw);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString('es-CO');
};

const calculateDays = (salida = {}, requestedDays = null) => {
  const explicitDays = Number(requestedDays);
  if (Number.isInteger(explicitDays) && explicitDays > 0) return explicitDays;
  const start = new Date(`${salida.fecha || ''}T${salida.horaInicio || '00:00'}`);
  const end = new Date(`${salida.fechaRegreso || ''}T${salida.horaFin || '23:59'}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return '';
  return Math.max(1, Math.ceil((end - start) / 86400000));
};

const currency = (value) => Number(value || 0);

const getVisibleLiquidationDetails = (liquidacion = {}) => (liquidacion.detalles || []).filter((detail) => {
  const v = Number(detail?.valorDiario || 0);
  const d = Number(detail?.dias || 0);
  const t = Number(detail?.valorTotal || 0);
  return t > 0 || (v > 0 && d > 0);
});

const mergeAndSet = (sheet, range, value, style = {}) => {
  sheet.mergeCells(range);
  const cell = sheet.getCell(range.split(':')[0]);
  cell.value = value ?? '';
  Object.assign(cell, style);
  return cell;
};

const labelStyle = { font: { bold: true, size: 9 }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD9E0E8' } }, alignment: { vertical: 'middle', wrapText: true } };
const valueStyle = { font: { size: 9 }, alignment: { vertical: 'middle', wrapText: true } };
const border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };

const applyBorders = (sheet, fromRow, toRow, fromCol = 1, toCol = 18) => {
  for (let row = fromRow; row <= toRow; row += 1) {
    for (let col = fromCol; col <= toCol; col += 1) sheet.getCell(row, col).border = border;
  }
};

const traceActor = (solicitud, stage) => {
  const item = [...(solicitud.trazabilidad || [])].reverse().find((entry) => entry.event === `aprobado_${stage}` || entry.event === `completado_${stage}`);
  if (!item) return '';
  return `${item.actor?.nombre || item.actor?.email || stage}\n${formatDate(item.at)}`;
};

const addTraceabilitySheet = (workbook, solicitud) => {
  const sheet = workbook.addWorksheet('Aprobaciones');
  sheet.columns = [
    { header: 'Etapa', key: 'etapa', width: 38 },
    { header: 'Estado', key: 'estado', width: 18 },
    { header: 'Responsable', key: 'responsable', width: 34 },
    { header: 'Correo', key: 'correo', width: 36 },
    { header: 'Fecha', key: 'fecha', width: 24 },
    { header: 'Observación', key: 'observacion', width: 55 }
  ];
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B3A6F' } };
  const traces = solicitud.trazabilidad || [];
  (solicitud.plan_aprobacion || []).forEach((step) => {
    const approved = [...traces].reverse().find((entry) => entry.event === `aprobado_${step.key}` || entry.event === `completado_${step.key}`);
    const rejected = [...traces].reverse().find((entry) => entry.event === `no_aprobado_${step.key}`);
    const trace = rejected || approved;
    let obsText = trace?.detail?.observacion || '';
    if (step.key === 'tesoreria' && trace?.detail?.liquidacionModificada) {
      const prev = trace.detail.totalAnticipoAnterior ? `$${Number(trace.detail.totalAnticipoAnterior).toLocaleString('es-CO')}` : 'N/A';
      const fin = trace.detail.totalAnticipoFinal ? `$${Number(trace.detail.totalAnticipoFinal).toLocaleString('es-CO')}` : 'N/A';
      obsText = `[Liquidación ajustada en Tesorería: de ${prev} a ${fin}] ${obsText}`.trim();
    }
    sheet.addRow({
      etapa: step.label,
      estado: rejected ? 'No aprobado' : approved ? 'Aprobado / completado' : 'Pendiente',
      responsable: trace?.actor?.nombre || '',
      correo: trace?.actor?.email || step.email || '',
      fecha: trace?.at ? new Date(trace.at).toLocaleString('es-CO') : '',
      observacion: obsText
    });
  });
  sheet.addRow([]);
  sheet.addRow(['Autorización del solicitante', solicitud.datos_viaticos?.autorizacionAceptada ? 'Aceptada electrónicamente' : 'Pendiente']);
  sheet.addRow([AUTHORIZATION_TEXT]);
  sheet.mergeCells(`A${sheet.rowCount}:F${sheet.rowCount}`);
  sheet.getCell(`A${sheet.rowCount}`).alignment = { wrapText: true, vertical: 'top' };
  sheet.addRow([LEGALIZATION_NOTICE]);
  sheet.mergeCells(`A${sheet.rowCount}:F${sheet.rowCount}`);
  sheet.getCell(`A${sheet.rowCount}`).font = { bold: true, color: { argb: 'FFC00000' } };
  sheet.getCell(`A${sheet.rowCount}`).alignment = { wrapText: true };
  sheet.eachRow((row) => { row.eachCell((cell) => { cell.border = border; cell.alignment = { ...cell.alignment, vertical: 'middle', wrapText: true }; }); });
};

const buildWorkbook = async (solicitud, { includeFinancial = true } = {}) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIAC UNICESMAG';
  const sheet = workbook.addWorksheet('FR-004', { pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1 } });
  sheet.columns = Array.from({ length: 18 }, () => ({ width: 9 }));
  sheet.getColumn(1).width = 17;
  sheet.getColumn(4).width = 14;
  sheet.getColumn(10).width = 15;
  sheet.getColumn(14).width = 14;

  const personal = solicitud.solicitante_snapshot || {};
  const laboral = solicitud.datos_laborales || {};
  const salida = solicitud.datos_salida || {};
  const viaticos = solicitud.datos_viaticos || {};
  const liquidacion = solicitud.liquidacion || {};

  mergeAndSet(sheet, 'A1:C3', 'UNIVERSIDAD CESMAG', { font: { bold: true, size: 11 }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true } });
  mergeAndSet(sheet, 'D1:O3', 'SOLICITUD DE DESPLAZAMIENTO FUERA DE LA CIUDAD', { font: { bold: true, size: 14 }, alignment: { horizontal: 'center', vertical: 'middle' } });
  mergeAndSet(sheet, 'P1:R1', 'CÓDIGO: ADF-PP-FR-004', labelStyle);
  mergeAndSet(sheet, 'P2:R2', 'VERSIÓN: 6', labelStyle);
  mergeAndSet(sheet, 'P3:R3', 'FECHA: 14/ENE/2025', labelStyle);
  mergeAndSet(sheet, 'A4:R4', `Consecutivo: ${solicitud.consecutivo}`, { font: { bold: true }, alignment: { horizontal: 'right' } });

  mergeAndSet(sheet, 'A5:B5', 'Fecha de solicitud', labelStyle); mergeAndSet(sheet, 'C5:H5', formatDate(solicitud.created_at || new Date()), valueStyle);
  mergeAndSet(sheet, 'I5:K5', 'Programa / Dependencia', labelStyle); mergeAndSet(sheet, 'L5:R5', laboral.dependencia || '', valueStyle);
  mergeAndSet(sheet, 'A6:B6', 'Nombre del Empleado', labelStyle); mergeAndSet(sheet, 'C6:K6', personal.nombre || '', valueStyle);
  mergeAndSet(sheet, 'L6:O6', 'No. Documento de Identidad', labelStyle); mergeAndSet(sheet, 'P6:R6', personal.documento || '', valueStyle);
  mergeAndSet(sheet, 'A7:B7', 'Cargo', labelStyle); mergeAndSet(sheet, 'C7:H7', laboral.cargo || '', valueStyle);
  mergeAndSet(sheet, 'I7:J7', 'Correo electrónico', labelStyle); mergeAndSet(sheet, 'K7:R7', personal.email || personal.correo || '', valueStyle);
  mergeAndSet(sheet, 'A8:B8', 'Lugar a visitar', labelStyle); mergeAndSet(sheet, 'C8:H8', viaticos.lugarVisitar || salida.entidadDestino || salida.municipio || salida.pais || '', valueStyle);
  mergeAndSet(sheet, 'I8:J8', 'Fecha evento', labelStyle); mergeAndSet(sheet, 'K8:R8', formatDate(viaticos.fechaEvento || salida.fecha), valueStyle);
  mergeAndSet(sheet, 'A9:B9', 'No. Días solicitados', labelStyle); mergeAndSet(sheet, 'C9:E9', calculateDays(salida, viaticos.numeroDiasSolicitados), valueStyle);
  mergeAndSet(sheet, 'F9:H9', 'Día de salida', labelStyle); mergeAndSet(sheet, 'I9:J9', formatDate(salida.fecha), valueStyle);
  sheet.getCell('K9').value = 'Hora'; Object.assign(sheet.getCell('K9'), labelStyle); mergeAndSet(sheet, 'L9:M9', salida.horaInicio || '', valueStyle);
  mergeAndSet(sheet, 'N9:O9', 'Día de regreso', labelStyle); mergeAndSet(sheet, 'P9:Q9', formatDate(salida.fechaRegreso), valueStyle); sheet.getCell('R9').value = salida.horaFin || '';
  mergeAndSet(sheet, 'A10:E10', 'Objeto de la comisión', labelStyle); mergeAndSet(sheet, 'F10:R10', viaticos.objetoComision || salida.motivo || '', valueStyle);
  mergeAndSet(sheet, 'A11:E11', 'Observaciones especiales', labelStyle); mergeAndSet(sheet, 'F11:R11', viaticos.observacionesEspeciales || '', valueStyle);
  mergeAndSet(sheet, 'A12:F12', 'Centro de costos asignado', labelStyle); mergeAndSet(sheet, 'G12:R12', viaticos.centroCosto || '', valueStyle);
  sheet.getCell('A13').value = 'Alojamiento'; Object.assign(sheet.getCell('A13'), labelStyle); mergeAndSet(sheet, 'B13:H13', viaticos.alojamiento || '', valueStyle);
  mergeAndSet(sheet, 'I13:J13', 'Transporte', labelStyle); mergeAndSet(sheet, 'K13:R13', viaticos.transporte || '', valueStyle);
  mergeAndSet(sheet, 'A14:C14', 'Consignación cuenta bancaria', labelStyle); mergeAndSet(sheet, 'D14:H14', viaticos.tipoCuenta || '', valueStyle);
  mergeAndSet(sheet, 'I14:L14', 'Entidad bancaria', labelStyle); mergeAndSet(sheet, 'M14:R14', `${viaticos.entidadBancaria || ''} · ${viaticos.numeroCuenta || ''}`, valueStyle);
  mergeAndSet(sheet, 'A15:G15', `Firma solicitante\nAceptación electrónica: ${viaticos.autorizacionAceptada ? 'SÍ' : 'NO'}\n${personal.nombre || ''}`, valueStyle);
  mergeAndSet(sheet, 'H15:I15', 'AUTORIZACIÓN', labelStyle); mergeAndSet(sheet, 'J15:R15', AUTHORIZATION_TEXT, { font: { size: 8 }, alignment: { wrapText: true, vertical: 'middle' } });
  mergeAndSet(sheet, 'A16:C16', `Visto Bueno Jefe Inmediato\n${traceActor(solicitud, 'jefe')}`, valueStyle);
  mergeAndSet(sheet, 'D16:J16', `Vicerrector Financiero y Desarrollo Institucional\n${traceActor(solicitud, 'financiera_final')}`, valueStyle);
  mergeAndSet(sheet, 'K16:N16', `Vicerrector Dependencia\n${traceActor(solicitud, 'vicerrectoria_dependencia')}`, valueStyle);
  mergeAndSet(sheet, 'O16:R16', `Visto Bueno Rector\n${traceActor(solicitud, 'rectoria')}`, valueStyle);
  mergeAndSet(sheet, 'A17:R17', LEGALIZATION_NOTICE, { font: { bold: true, size: 9, color: { argb: 'FFC00000' } }, alignment: { wrapText: true, vertical: 'middle' } });
  addTraceabilitySheet(workbook, solicitud);
  if (!includeFinancial) {
    sheet.getRow(15).height = 68; sheet.getRow(16).height = 56; sheet.getRow(17).height = 28;
    applyBorders(sheet, 1, 17);
    sheet.pageSetup.printArea = 'A1:R17';
    return workbook;
  }
  mergeAndSet(sheet, 'A18:R18', 'LIQUIDACIÓN DE VIÁTICOS Y GASTOS DE VIAJE', { font: { bold: true, size: 12 }, fill: labelStyle.fill, alignment: { horizontal: 'center', vertical: 'middle' } });
  mergeAndSet(sheet, 'A19:H19', 'Detalle', labelStyle); mergeAndSet(sheet, 'I19:K19', 'Valor Diario', labelStyle); mergeAndSet(sheet, 'L19:M19', 'No. Días', labelStyle); mergeAndSet(sheet, 'N19:R19', 'Valor Total', labelStyle);
  const details = getVisibleLiquidationDetails(liquidacion);
  const outputDetails = details;
  outputDetails.forEach((detail, index) => {
    const row = 20 + index;
    mergeAndSet(sheet, `A${row}:H${row}`, detail.detalle || '', valueStyle);
    mergeAndSet(sheet, `I${row}:K${row}`, currency(detail.valorDiario), valueStyle).numFmt = '$#,##0';
    mergeAndSet(sheet, `L${row}:M${row}`, Number(detail.dias || 0), valueStyle);
    mergeAndSet(sheet, `N${row}:R${row}`, currency(detail.valorTotal), valueStyle).numFmt = '$#,##0';
  });
  const totalRow = 20 + outputDetails.length;
  const observationsStartRow = totalRow + 1;
  const observationsEndRow = observationsStartRow + 2;
  mergeAndSet(sheet, `A${totalRow}:M${totalRow}`, 'TOTAL ANTICIPO', labelStyle); mergeAndSet(sheet, `N${totalRow}:R${totalRow}`, currency(liquidacion.totalAnticipo), valueStyle).numFmt = '$#,##0';
  mergeAndSet(sheet, `A${observationsStartRow}:R${observationsEndRow}`, `Observaciones a la liquidación:\n${liquidacion.observaciones || ''}\n\nTécnico contable: ${traceActor(solicitud, 'tecnico_contable')}`, valueStyle);

  [1, 2, 3, 4, 17, 18, 19, totalRow].forEach((row) => { sheet.getRow(row).height = 22; });
  sheet.getRow(15).height = 68; sheet.getRow(16).height = 56; sheet.getRow(observationsStartRow).height = 70;
  applyBorders(sheet, 1, observationsEndRow);
  sheet.pageSetup.printArea = `A1:R${observationsEndRow}`;
  return workbook;
};

const buildXlsxAttachment = async (solicitud, options = {}) => {
  const workbook = await buildWorkbook(solicitud, options);
  const content = Buffer.from(await workbook.xlsx.writeBuffer());
  return { filename: `${solicitud.consecutivo}.xlsx`, content, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
};

module.exports = { AUTHORIZATION_TEXT, LEGALIZATION_NOTICE, buildWorkbook, buildXlsxAttachment, calculateDays, getVisibleLiquidationDetails };
