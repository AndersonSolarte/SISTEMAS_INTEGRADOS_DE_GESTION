const { resolveActivityIndicators } = require('./activityIndicators');
const readDeliveryDate = (value) => {
  if (value === null || value === undefined || value === '') return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  let date = String(value).trim();
  const local = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (local) date = `${local[3]}-${local[2]}-${local[1]}`;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw Object.assign(new Error('Fecha de entrega inválida en INDICADORES. Use AAAA-MM-DD o DD/MM/AAAA.'), { status: 422 });
  }
  return date;
};
const writeActivityIndicators = (workbook, objectives) => {
  const previous = workbook.getWorksheet('INDICADORES');
  if (previous) workbook.removeWorksheet(previous.id);
  const sheet = workbook.addWorksheet('INDICADORES', { views: [{ state: 'frozen', ySplit: 1 }] });
  sheet.columns = [
    { header: 'OBJETIVO', key: 'objective', width: 18 },
    { header: 'NÚMERO ACTIVIDAD', key: 'position', width: 22 },
    { header: 'ACTIVIDAD', key: 'activity', width: 45 },
    { header: 'INDICADOR DE RESULTADO', key: 'indicadorResultado', width: 60 },
    { header: 'INDICADOR DE LOGRO', key: 'indicadorLogro', width: 60 },
    { header: 'INDICADOR DE IMPACTO', key: 'indicadorImpacto', width: 60 },
    { header: 'META DE RESULTADO', key: 'metaResultado', width: 35 },
    { header: 'META DE LOGRO', key: 'metaLogro', width: 35 },
    { header: 'META DE IMPACTO', key: 'metaImpacto', width: 35 },
    { header: 'FIN RESULTADO', key: 'fechaFinResultado', width: 22 },
    { header: 'FIN LOGRO', key: 'fechaFinLogro', width: 22 },
    { header: 'FIN IMPACTO', key: 'fechaFinImpacto', width: 22 },
    { header: 'RESULTADO ACTIVO', key: 'indicadorResultadoActivo', width: 22 },
    { header: 'LOGRO ACTIVO', key: 'indicadorLogroActivo', width: 22 },
    { header: 'IMPACTO ACTIVO', key: 'indicadorImpactoActivo', width: 22 },
    { header: 'INICIO RESULTADO', key: 'fechaInicioResultado', width: 22 },
    { header: 'INICIO LOGRO', key: 'fechaInicioLogro', width: 22 },
    { header: 'INICIO IMPACTO', key: 'fechaInicioImpacto', width: 22 }
  ];
  sheet.getRow(1).font = { bold: true };
  for (const objective of objectives || []) {
    (objective.actividades || []).forEach((activity, index) => sheet.addRow({
      objective: objective.codigo, position: index + 1, activity: activity.nombre,
      ...resolveActivityIndicators(activity)
    }));
  }
};

const readActivityIndicators = (workbook, objectives) => {
  const sheet = workbook.getWorksheet('INDICADORES');
  if (!sheet) return;
  sheet.eachRow((row, number) => {
    if (number === 1) return;
    const objective = objectives.find((item) => item.codigo === String(row.getCell(1).value || '').trim());
    const index = Number(row.getCell(2).value) - 1;
    const activity = Number.isInteger(index) ? objective?.actividades?.[index] : null;
    if (!activity) return;
    if (String(sheet.getCell('D1').value).includes('TIPO')) {
      activity.tipoIndicador = String(row.getCell(4).value || 'Resultado').trim();
      activity.indicador = String(row.getCell(5).value || activity.indicador || '');
      Object.assign(activity, resolveActivityIndicators(activity));
    } else {
      activity.indicadorResultado = String(row.getCell(4).value || '');
      activity.indicadorLogro = String(row.getCell(5).value || '');
      activity.indicadorImpacto = String(row.getCell(6).value || '');
      activity.indicador = activity.indicadorResultado;
      for (const [field, column] of [['metaResultado', 7], ['metaLogro', 8], ['metaImpacto', 9]]) {
        if (String(sheet.getRow(1).getCell(column).value || '').startsWith('META')) {
          activity[field] = String(row.getCell(column).value ?? '');
        }
      }
      ['Resultado', 'Logro', 'Impacto'].forEach((kind, index) => {
        if (/^(ENTREGA|FIN)/.test(String(sheet.getRow(1).getCell(10 + index).value || ''))) {
          activity[`fechaFin${kind}`] = readDeliveryDate(row.getCell(10 + index).value);
          activity[`fechaEntrega${kind}`] = activity[`fechaFin${kind}`];
        }
        if (String(sheet.getRow(1).getCell(16 + index).value || '').startsWith('INICIO')) {
          activity[`fechaInicio${kind}`] = readDeliveryDate(row.getCell(16 + index).value);
        }
        if (String(sheet.getRow(1).getCell(13 + index).value || '').includes('ACTIVO')) {
          const value = row.getCell(13 + index).value;
          if (value !== null && value !== undefined && value !== '') {
            activity[`indicador${kind}Activo`] = ![false, 0, 'false', 'FALSE', '0', 'NO', 'no'].includes(value);
          }
        }
      });
    }
  });
};

module.exports = { writeActivityIndicators, readActivityIndicators };
