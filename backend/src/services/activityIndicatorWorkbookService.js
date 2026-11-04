const { resolveActivityIndicators } = require('./activityIndicators');
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
    { header: 'INDICADOR DE IMPACTO', key: 'indicadorImpacto', width: 60 }
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
    }
  });
};

module.exports = { writeActivityIndicators, readActivityIndicators };
