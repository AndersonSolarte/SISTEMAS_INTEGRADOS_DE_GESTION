const fs = require('fs');
const XLSX = require('xlsx');
const { sequelize } = require('../config/database');
const {
  GestionInformacionCarga,
  PoblacionalContextoExternoGeneral
} = require('../models');

const DATASET_LABEL = 'CONTEXTO EXTERNO GENERAL';
const SHEETS = [
  {
    name: 'INS,ADM, PC',
    seccion: 'poblacional',
    headers: ['AÑOS', 'INSCRITOS NACIONAL', 'INSCRITOS REGIONAL', 'ADMITIDOS NACIONAL', 'ADMITIDOS REGIONAL', 'PRIMER CURSO NACIONAL', 'PRIMER CURSO REGIONAL', 'PROGRAMA']
  },
  {
    name: 'MATRICULADOS',
    seccion: 'poblacional',
    headers: ['AÑOS', 'MATRICULADOS NACIONAL', 'MATRICULADOS REGIONAL', 'PROGRAMA']
  },
  {
    name: 'GRADUADOS',
    seccion: 'poblacional',
    headers: ['AÑOS', 'GRADUADOS COLOMBIA', 'GRADUADOS REGIONAL', 'PROGRAMA']
  },
  {
    name: 'OFERTA',
    seccion: 'oferta',
    headers: ['SECTOR', 'RECONOCIMIENTO MEN', 'ÁREA DEL CONOCIMIENTO', 'NOMBRE_INSTITUCIÓN', 'NOMBRE_DEL_PROGRAMA', 'MODALIDAD', 'NÚMERO_CRÉDITOS', 'NÚMERO_SEMESTRES', 'MUNICIPIO_OFERTA_PROGRAMA', 'GEOREFERENCIA', 'DEPARTAMENTO']
  },
  {
    name: 'DEPAR',
    seccion: 'departamento',
    headers: ['DEPARTAMENTO', 'VALOR', 'PAIS']
  }
];

const normalizeKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, '_')
  .replace(/^_+|_+$/g, '');

const cleanText = (value) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const toInteger = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(number) ? Math.round(number) : null;
};

const toDecimal = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(String(value).replace(/\s/g, '').replace(/,/g, ''));
  return Number.isFinite(number) ? number : null;
};

const getPeriod = (value) => {
  let year = null;
  let month = null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    year = value.getUTCFullYear();
    month = value.getUTCMonth() + 1;
  } else if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) {
      year = parsed.y;
      month = parsed.m;
    }
  } else {
    const text = String(value || '').trim();
    const match = text.match(/(19|20)\d{2}/);
    if (match) year = Number(match[0]);
    const semesterMatch = text.match(/(?:^|[-/\s])(1|2)(?:$|[-/\s])/);
    if (semesterMatch) month = Number(semesterMatch[1]) === 2 ? 7 : 1;
    if (!month) {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime())) month = date.getUTCMonth() + 1;
    }
  }
  if (!year) return { anio: null, semestre: null, periodo_referencia: null };
  const semestre = month && month > 6 ? 2 : 1;
  return { anio: year, semestre, periodo_referencia: `${year}-${semestre}` };
};

const findSheet = (workbook, expectedName) => {
  const expected = normalizeKey(expectedName);
  return workbook.SheetNames.find((name) => normalizeKey(name) === expected) || null;
};

const normalizeRow = (row) => Object.fromEntries(
  Object.entries(row || {}).map(([key, value]) => [normalizeKey(key), value])
);

const valueOf = (row, ...aliases) => {
  for (const alias of aliases) {
    const value = row[normalizeKey(alias)];
    if (value !== undefined && value !== null && String(value).trim() !== '') return value;
  }
  return null;
};

const validateHeaders = (sheetName, rows, headers) => {
  if (!rows.length) throw new Error(`La hoja ${sheetName} no contiene encabezados.`);
  const available = new Set(Object.keys(rows[0]).map(normalizeKey));
  const missing = headers.filter((header) => {
    const key = normalizeKey(header);
    if (key === 'RECONOCIMIENTO_MEN') return !available.has(key) && !available.has('RECOMOCIMIENTO_MEN');
    if (key === 'AREA_DEL_CONOCIMIENTO') return !available.has(key) && !available.has('AREA_DEL_CONOCIMIENTO') && !available.has('AREA_DEL_CONOCIMIENTO');
    return !available.has(key);
  });
  if (missing.length) throw new Error(`La hoja ${sheetName} no coincide con la plantilla. Faltan: ${missing.join(', ')}.`);
};

const parseWorkbook = (filePath) => {
  const workbook = XLSX.readFile(filePath, { cellDates: true, cellFormula: false, cellHTML: false });
  const missingSheets = SHEETS.filter((definition) => !findSheet(workbook, definition.name)).map((definition) => definition.name);
  if (missingSheets.length) throw new Error(`El archivo debe contener las cinco hojas de Contexto Externo General. Faltan: ${missingSheets.join(', ')}.`);

  const records = [];
  const counts = {};
  for (const definition of SHEETS) {
    const actualName = findSheet(workbook, definition.name);
    const sheet = workbook.Sheets[actualName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true, blankrows: false });
    validateHeaders(actualName, rawRows, definition.headers);
    let accepted = 0;

    rawRows.forEach((sourceRow) => {
      const row = normalizeRow(sourceRow);
      if (definition.name === 'INS,ADM, PC') {
        const programa = cleanText(valueOf(row, 'PROGRAMA'));
        const period = getPeriod(valueOf(row, 'AÑOS', 'ANOS'));
        if (!programa || !period.anio) return;
        records.push({
          seccion: definition.seccion, hoja_fuente: definition.name, ...period, programa,
          inscritos_nacional: toInteger(valueOf(row, 'INSCRITOS NACIONAL')),
          inscritos_regional: toInteger(valueOf(row, 'INSCRITOS REGIONAL')),
          admitidos_nacional: toInteger(valueOf(row, 'ADMITIDOS NACIONAL')),
          admitidos_regional: toInteger(valueOf(row, 'ADMITIDOS REGIONAL')),
          primer_curso_nacional: toInteger(valueOf(row, 'PRIMER CURSO NACIONAL')),
          primer_curso_regional: toInteger(valueOf(row, 'PRIMER CURSO REGIONAL'))
        });
      } else if (definition.name === 'MATRICULADOS') {
        const programa = cleanText(valueOf(row, 'PROGRAMA'));
        const period = getPeriod(valueOf(row, 'AÑOS', 'ANOS'));
        if (!programa || !period.anio) return;
        records.push({
          seccion: definition.seccion, hoja_fuente: definition.name, ...period, programa,
          matriculados_nacional: toInteger(valueOf(row, 'MATRICULADOS NACIONAL')),
          matriculados_regional: toInteger(valueOf(row, 'MATRICULADOS REGIONAL'))
        });
      } else if (definition.name === 'GRADUADOS') {
        const programa = cleanText(valueOf(row, 'PROGRAMA'));
        const period = getPeriod(valueOf(row, 'AÑOS', 'ANOS'));
        if (!programa || !period.anio) return;
        records.push({
          seccion: definition.seccion, hoja_fuente: definition.name, ...period, programa,
          graduados_nacional: toInteger(valueOf(row, 'GRADUADOS COLOMBIA', 'GRADUADOS NACIONAL')),
          graduados_regional: toInteger(valueOf(row, 'GRADUADOS REGIONAL'))
        });
      } else if (definition.name === 'OFERTA') {
        const institucion = cleanText(valueOf(row, 'NOMBRE_INSTITUCIÓN', 'NOMBRE INSTITUCION'));
        const nombrePrograma = cleanText(valueOf(row, 'NOMBRE_DEL_PROGRAMA', 'NOMBRE DEL PROGRAMA'));
        if (!institucion || !nombrePrograma) return;
        records.push({
          seccion: definition.seccion,
          hoja_fuente: definition.name,
          sector: cleanText(valueOf(row, 'SECTOR')),
          reconocimiento_men: cleanText(valueOf(row, 'RECONOCIMIENTO MEN', 'RECOMOCIMIENTO MEN')),
          area_conocimiento: cleanText(valueOf(row, 'ÁREA DEL CONOCIMIENTO', 'AREÁ DEL CONOCIMIENTO', 'AREA DEL CONOCIMIENTO')),
          institucion,
          nombre_programa: nombrePrograma,
          modalidad: cleanText(valueOf(row, 'MODALIDAD')),
          numero_creditos: toInteger(valueOf(row, 'NÚMERO CRÉDITOS', 'NUMERO CREDITOS')),
          numero_semestres: toInteger(valueOf(row, 'NÚMERO SEMESTRES', 'NUMERO SEMESTRES')),
          municipio: cleanText(valueOf(row, 'MUNICIPIO_OFERTA_PROGRAMA')),
          georeferencia: cleanText(valueOf(row, 'GEOREFERENCIA')),
          departamento: cleanText(valueOf(row, 'DEPARTAMENTO'))
        });
      } else {
        const departamento = cleanText(valueOf(row, 'DEPARTAMENTO'));
        if (!departamento || normalizeKey(departamento) === 'FUENTES') return;
        records.push({
          seccion: definition.seccion,
          hoja_fuente: definition.name,
          departamento,
          valor_departamento: toDecimal(valueOf(row, 'VALOR')),
          pais: cleanText(valueOf(row, 'PAIS'))
        });
      }
      accepted += 1;
    });
    counts[definition.name] = accepted;
  }

  if (!records.length) throw new Error('No se encontraron filas válidas para importar.');
  return { records, counts };
};

const downloadContextoExternoGeneralTemplate = async (_req, res) => {
  const workbook = XLSX.utils.book_new();
  SHEETS.forEach((definition) => {
    const worksheet = XLSX.utils.aoa_to_sheet([definition.headers]);
    worksheet['!cols'] = definition.headers.map((header) => ({ wch: Math.max(14, Math.min(38, header.length + 5)) }));
    XLSX.utils.book_append_sheet(workbook, worksheet, definition.name);
  });
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename=plantilla_contexto_externo_general.xlsx');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  return res.send(buffer);
};

const replaceContextoExternoGeneralData = async ({ records, counts, filename, userId = null }) => {
  const preparedRecords = records.map((record) => ({
    ...record,
    creado_por: userId,
    actualizado_por: userId
  }));
  await sequelize.transaction(async (transaction) => {
    await PoblacionalContextoExternoGeneral.destroy({ where: {}, transaction });
    for (let offset = 0; offset < preparedRecords.length; offset += 1000) {
      await PoblacionalContextoExternoGeneral.bulkCreate(preparedRecords.slice(offset, offset + 1000), {
        transaction,
        validate: true
      });
    }
    await GestionInformacionCarga.destroy({
      where: { categoria: 'Poblacional', subcategoria: 'Contexto Externo', variable: DATASET_LABEL },
      transaction
    });
    await GestionInformacionCarga.create({
      categoria: 'Poblacional',
      subcategoria: 'Contexto Externo',
      variable: DATASET_LABEL,
      archivo_nombre: filename,
      total_plantilla: preparedRecords.length,
      total_cargados: preparedRecords.length,
      total_omitidos: 0,
      porcentaje_cargado: 100,
      estado: 'completo',
      detalle: JSON.stringify({ hojas: counts, modo: 'reemplazo_total' }),
      creado_por: userId
    }, { transaction });
  });
  return preparedRecords.length;
};

const importContextoExternoGeneral = async (req, res) => {
  const filePath = req.file?.path;
  if (!filePath) return res.status(400).json({ success: false, message: 'Adjunta un archivo Excel .xlsx.' });
  try {
    const { records, counts } = parseWorkbook(filePath);
    const userId = req.user?.id || null;
    await replaceContextoExternoGeneralData({ records, counts, filename: req.file.originalname, userId });

    return res.json({
      success: true,
      message: `Contexto Externo General actualizado: ${records.length.toLocaleString('es-CO')} registros cargados.`,
      data: { imported: records.length, sheets: counts, replacement: true }
    });
  } catch (error) {
    console.error('Error importando Contexto Externo General:', error);
    return res.status(400).json({ success: false, message: error.message || 'No fue posible importar Contexto Externo General.' });
  } finally {
    fs.promises.unlink(filePath).catch(() => {});
  }
};

const getContextoExternoGeneralDashboard = async (_req, res) => {
  try {
    const [rows, lastUpload] = await Promise.all([
      PoblacionalContextoExternoGeneral.findAll({ order: [['seccion', 'ASC'], ['anio', 'ASC'], ['semestre', 'ASC'], ['id', 'ASC']], raw: true }),
      GestionInformacionCarga.findOne({
        where: { categoria: 'Poblacional', subcategoria: 'Contexto Externo', variable: DATASET_LABEL },
        order: [['createdAt', 'DESC']],
        raw: true
      })
    ]);
    const oferta = [];
    const poblacional = [];
    const departamentos = [];
    rows.forEach((row) => {
      if (row.seccion === 'oferta') oferta.push(row);
      else if (row.seccion === 'poblacional') poblacional.push(row);
      else if (row.seccion === 'departamento') departamentos.push(row);
    });
    return res.json({
      success: true,
      data: {
        oferta,
        poblacional,
        departamentos,
        metadata: {
          total: rows.length,
          lastUpload: lastUpload?.createdAt || null,
          filename: lastUpload?.archivo_nombre || null
        }
      }
    });
  } catch (error) {
    console.error('Error consultando Contexto Externo General:', error);
    return res.status(500).json({ success: false, message: 'No fue posible cargar el dashboard de Contexto Externo General.' });
  }
};

const downloadContextoExternoGeneralData = async (_req, res) => {
  try {
    const rows = await PoblacionalContextoExternoGeneral.findAll({
      order: [['seccion', 'ASC'], ['anio', 'ASC'], ['semestre', 'ASC'], ['id', 'ASC']],
      raw: true
    });
    if (!rows.length) return res.status(404).json({ success: false, message: 'No hay datos de Contexto Externo General para exportar.' });

    const bySheet = {
      'INS,ADM, PC': [],
      MATRICULADOS: [],
      GRADUADOS: [],
      OFERTA: [],
      DEPAR: []
    };
    rows.forEach((row) => {
      if (row.hoja_fuente === 'INS,ADM, PC') bySheet['INS,ADM, PC'].push({
        'AÑOS': row.periodo_referencia,
        'INSCRITOS NACIONAL': row.inscritos_nacional,
        'INSCRITOS REGIONAL': row.inscritos_regional,
        'ADMITIDOS NACIONAL': row.admitidos_nacional,
        'ADMITIDOS REGIONAL': row.admitidos_regional,
        'PRIMER CURSO NACIONAL': row.primer_curso_nacional,
        'PRIMER CURSO REGIONAL': row.primer_curso_regional,
        PROGRAMA: row.programa
      });
      else if (row.hoja_fuente === 'MATRICULADOS') bySheet.MATRICULADOS.push({
        'AÑOS': row.periodo_referencia,
        'MATRICULADOS NACIONAL': row.matriculados_nacional,
        'MATRICULADOS REGIONAL': row.matriculados_regional,
        PROGRAMA: row.programa
      });
      else if (row.hoja_fuente === 'GRADUADOS') bySheet.GRADUADOS.push({
        'AÑOS': row.periodo_referencia,
        'GRADUADOS COLOMBIA': row.graduados_nacional,
        'GRADUADOS REGIONAL': row.graduados_regional,
        PROGRAMA: row.programa
      });
      else if (row.hoja_fuente === 'OFERTA') bySheet.OFERTA.push({
        SECTOR: row.sector,
        'RECONOCIMIENTO MEN': row.reconocimiento_men,
        'ÁREA DEL CONOCIMIENTO': row.area_conocimiento,
        'NOMBRE_INSTITUCIÓN': row.institucion,
        NOMBRE_DEL_PROGRAMA: row.nombre_programa,
        MODALIDAD: row.modalidad,
        'NÚMERO_CRÉDITOS': row.numero_creditos,
        'NÚMERO_SEMESTRES': row.numero_semestres,
        MUNICIPIO_OFERTA_PROGRAMA: row.municipio,
        GEOREFERENCIA: row.georeferencia,
        DEPARTAMENTO: row.departamento
      });
      else if (row.hoja_fuente === 'DEPAR') bySheet.DEPAR.push({
        Departamento: row.departamento,
        Valor: row.valor_departamento,
        PAIS: row.pais
      });
    });

    const workbook = XLSX.utils.book_new();
    SHEETS.forEach((definition) => {
      const data = bySheet[definition.name] || [];
      const worksheet = data.length
        ? XLSX.utils.json_to_sheet(data, { header: definition.headers })
        : XLSX.utils.aoa_to_sheet([definition.headers]);
      worksheet['!cols'] = definition.headers.map((header) => ({ wch: Math.max(14, Math.min(38, header.length + 5)) }));
      XLSX.utils.book_append_sheet(workbook, worksheet, definition.name);
    });
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=contexto_externo_general.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return res.send(buffer);
  } catch (error) {
    console.error('Error exportando Contexto Externo General:', error);
    return res.status(500).json({ success: false, message: 'No fue posible exportar Contexto Externo General.' });
  }
};

module.exports = {
  DATASET_LABEL,
  parseContextoExternoGeneralWorkbook: parseWorkbook,
  replaceContextoExternoGeneralData,
  downloadContextoExternoGeneralTemplate,
  downloadContextoExternoGeneralData,
  importContextoExternoGeneral,
  getContextoExternoGeneralDashboard
};
