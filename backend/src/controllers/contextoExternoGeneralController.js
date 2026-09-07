const fs = require('fs');
const XLSX = require('xlsx');
const { sequelize } = require('../config/database');
const {
  GestionInformacionCarga,
  PoblacionalContextoExternoGeneral
} = require('../models');
const { generateContextoExternoGeneralPdf } = require('../services/contextoExternoGeneralPdfService');

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
  if (missingSheets.length) throw new Error(`El archivo debe contener las cuatro hojas de Contexto Externo General. Faltan: ${missingSheets.join(', ')}.`);

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
    rows.forEach((row) => {
      if (row.seccion === 'oferta') oferta.push(row);
      else if (row.seccion === 'poblacional') poblacional.push(row);
    });
    return res.json({
      success: true,
      data: {
        oferta,
        poblacional,
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
      OFERTA: []
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

const fetchOpenAI = async (systemPrompt, userPrompt) => {
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey) return null;
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey.trim()}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.65,
      max_tokens: 500
    })
  });
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
};

const systemPrompt = `Eres un analista senior de planeación estratégica universitaria en Colombia. Tu objetivo es redactar los análisis de contexto externo universitario rigurosos, formales y fluidos de 2 a 3 párrafos bien estructurados para el Ministerio de Educación / SNIES.
REGLAS ESTRICTAS DE REDACCIÓN:
1. DEBES escribir en párrafos continuos y elegantes (2 a 3 párrafos máximo).
2. NUNCA uses listas con viñetas, ni números, ni asteriscos, ni emojis, ni encabezados internos dentro del texto.
3. Utiliza conectores formales colombianos: 'En la oferta académica...', 'Respecto a las modalidades de oferta...', 'En cuanto a las denominaciones...', 'Asimismo...', 'Por otra parte...', 'En cuanto a su distribución geográfica...', 'A nivel regional...', 'Los indicadores de inscritos, admitidos y matriculados...', 'El comportamiento de la matrícula...', 'La evolución del número de graduados...'.
4. Incorpora de manera fluida en la narrativa las cifras y datos cuantitativos específicos que se te suministran.`;

const buildOfferStats = (rows) => {
  const total = rows.length;
  if (!total) return null;
  const privado = rows.filter((r) => String(r.sector || '').toUpperCase().includes('PRIVAD')).length;
  const oficial = total - privado;
  const semestres = rows.map((r) => Number(r.numero_semestres)).filter((n) => n > 0);
  const semestresModa = semestres.length ? Math.round(semestres.reduce((a, b) => a + b, 0) / semestres.length) : 2;
  const modalitiesMap = {};
  rows.forEach((r) => { const mod = String(r.modalidad || 'Presencial').trim(); modalitiesMap[mod] = (modalitiesMap[mod] || 0) + 1; });
  const modalidadesStr = Object.entries(modalitiesMap).map(([m, c]) => `${m} (${c})`).join(', ');
  const creditos = rows.map((r) => Number(r.numero_creditos)).filter((n) => n > 0);
  const minCred = creditos.length ? Math.min(...creditos) : 20;
  const maxCred = creditos.length ? Math.max(...creditos) : 36;
  const avgCred = creditos.length ? (creditos.reduce((a, b) => a + b, 0) / creditos.length).toFixed(1) : 29;
  const titlesMap = {};
  rows.forEach((r) => { const title = String(r.nombre_del_programa || r.nombre_programa || '').trim(); if (title) titlesMap[title] = (titlesMap[title] || 0) + 1; });
  const sortedTitles = Object.entries(titlesMap).sort((a, b) => b[1] - a[1]);
  const topTitles = sortedTitles.slice(0, 5).map(([t, c]) => `${t} con ${c}`).join(', ');
  const otherTitles = sortedTitles.slice(5, 12).map(([t, c]) => `${t} (${c})`).join(', ');
  const citiesMap = {};
  rows.forEach((r) => { const city = String(r.municipio_oferta_programa || r.municipio || r.georeferencia || '').trim(); if (city) citiesMap[city] = (citiesMap[city] || 0) + 1; });
  const sortedCities = Object.entries(citiesMap).sort((a, b) => b[1] - a[1]);
  const topCities = sortedCities.slice(0, 6).map(([c, cnt]) => `${c} (${cnt})`).join(', ');

  return { total, privado, oficial, semestresModa, modalidadesStr, minCred, maxCred, avgCred, topTitles, otherTitles, topCities };
};

const buildPopStats = (poblacionalRows, fieldPrefix, scope) => {
  const isReg = scope.toLowerCase() === 'regional';
  const suffix = isReg ? '_regional' : '_nacional';
  if (!poblacionalRows || !poblacionalRows.length) return null;
  if (fieldPrefix === 'ingreso') {
    const rows = poblacionalRows.map((r) => ({
      periodo: r.periodo || r.periodo_referencia || `${r.anio}-${r.semestre}`,
      inscritos: Number(r[`inscritos${suffix}`] || 0),
      admitidos: Number(r[`admitidos${suffix}`] || 0),
      primerCurso: Number(r[`primer_curso${suffix}`] || 0)
    })).filter((r) => r.inscritos > 0 || r.admitidos > 0 || r.primerCurso > 0);
    return rows.map((r) => `${r.periodo}: Inscritos ${r.inscritos}, Admitidos ${r.admitidos}, 1er Curso ${r.primerCurso}`).join('; ');
  }
  const field = `${fieldPrefix}${suffix}`;
  const rows = poblacionalRows.map((r) => ({
    periodo: r.periodo || r.periodo_referencia || `${r.anio}-${r.semestre}`,
    value: Number(r[field] || 0)
  })).filter((r) => r.value > 0);
  return rows.map((r) => `${r.periodo}: ${r.value}`).join('; ');
};

const generateOpenAIAnalysis = async (program, oferta, poblacional, aiAnalysisInput = {}) => {
  let aiAnalysis = { ...aiAnalysisInput };
  const apiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (!apiKey || Object.keys(aiAnalysis).length > 0) return aiAnalysis;

  try {
    const natStats = buildOfferStats(oferta);
    const regStats = buildOfferStats(oferta.filter((r) => String(r.georeferencia || '').toUpperCase() === 'REGIONAL'));
    const intakeNat = buildPopStats(poblacional, 'ingreso', 'nacional');
    const intakeReg = buildPopStats(poblacional, 'ingreso', 'regional');
    const enrolledNat = buildPopStats(poblacional, 'matriculados', 'nacional');
    const enrolledReg = buildPopStats(poblacional, 'matriculados', 'regional');
    const gradNat = buildPopStats(poblacional, 'graduados', 'nacional');
    const gradReg = buildPopStats(poblacional, 'graduados', 'regional');

    const promises = [];

    if (natStats) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis institucional de denominaciones de programas afines a ${program}.\nCifras SNIES:\n- Total nacional: ${natStats.total} programas.\n- Principales denominaciones: ${natStats.topTitles}.\n- Otras denominaciones con menor presencia: ${natStats.otherTitles}.\n- En la región: ${regStats ? regStats.total : 0} programas (${regStats ? regStats.topTitles : ''}).\n\nModelo de estilo esperado:\n'En cuanto a las denominaciones, se evidencia una alta concentración de la oferta en torno a la gestión, la gerencia y el derecho tributario. La denominación con mayor frecuencia es [Denominación] con [N] programas, seguida de... En un segundo nivel se encuentran... Asimismo, se observa una amplia diversidad de denominaciones con menor presencia...'`
        ).then((res) => { if (res) aiAnalysis.offer_tables = res; })
      );

      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis de caracterización y distribución de la oferta nacional para ${program}.\nCifras SNIES:\n- Total programas afines nacional: ${natStats.total} (${natStats.privado} del sector privado, ${natStats.oficial} del sector público/oficial).\n- Duración: la totalidad tiene una duración de ${natStats.semestresModa} semestres.\n- Modalidades: ${natStats.modalidadesStr}.\n- Créditos académicos: oscilan entre ${natStats.minCred} y ${natStats.maxCred} créditos, con promedio de ${natStats.avgCred} créditos.\n- Distribución geográfica principal: ${natStats.topCities}.\n\nModelo de estilo esperado:\n'En la oferta académica nacional se identifican ${natStats.total} programas afines a ${program}, de los cuales ${natStats.privado} son ofrecidos por instituciones universitarias del sector privado y ${natStats.oficial} por el sector oficial. La totalidad de estos programas tiene una duración de dos semestres. Respecto a las modalidades de oferta, predomina la... En cuanto a su distribución geográfica, la oferta presenta una importante concentración en las ciudades de mayor tamaño del país...'`
        ).then((res) => { if (res) aiAnalysis.offer_nacional = res; })
      );
    }

    if (regStats) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis de oferta a nivel regional para ${program}.\nCifras SNIES:\n- Total regional: ${regStats.total} programas (${regStats.privado} privadas, ${regStats.oficial} pública).\n- Duración: ${regStats.semestresModa} semestres.\n- Modalidades: ${regStats.modalidadesStr}. Créditos: entre ${regStats.minCred} y ${regStats.maxCred} créditos (promedio ${regStats.avgCred}).\n- Denominaciones en la región: ${regStats.topTitles}.\n- Lugares de oferta en la región: ${regStats.topCities}.\n\nModelo de estilo esperado:\n'En la región (suroccidente colombiano), la oferta está conformada por ${regStats.total} programas afines, de los cuales ${regStats.privado} son ofrecidos por IES privadas y ${regStats.oficial} por el sector público. Respecto a las denominaciones... En cuanto a los lugares de oferta a nivel regional...'`
        ).then((res) => { if (res) aiAnalysis.offer_regional = res; })
      );
    }

    if (intakeNat) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis de inscritos, admitidos y matriculados a primer curso a nivel nacional para ${program}.\nSerie histórica por período: ${intakeNat}.\n\nModelo de estilo esperado:\n'Los indicadores de inscritos, admitidos y matriculados a primer curso a nivel nacional, evidencian una tendencia favorable desde [Año], periodo en el que se consolida... El periodo... mantiene esta dinámica... Tras la disminución observada en... representa una recuperación importante... Finalmente, concentra el mejor desempeño...'`
        ).then((res) => { if (res) aiAnalysis.ingreso_nacional = res; })
      );
    }

    if (intakeReg) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis de inscritos, admitidos y matriculados a primer curso a nivel regional para ${program}.\nSerie histórica regional: ${intakeReg}.\n\nModelo de estilo esperado:\n'A nivel regional, los inscritos, admitidos y matriculados a primer curso presentan un comportamiento favorable desde... En [periodo] se mantienen resultados positivos... A partir de... se observa una recuperación progresiva con resultados cada vez más favorables...'`
        ).then((res) => { if (res) aiAnalysis.ingreso_regional = res; })
      );
    }

    if (enrolledNat) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis del total de matriculados a nivel nacional para ${program}.\nSerie histórica nacional: ${enrolledNat}.\n\nModelo de estilo esperado:\n'El número de matriculados a nivel nacional presenta una tendencia favorable a lo largo del periodo analizado. Tras la disminución registrada entre... a partir de... se evidencia una recuperación que se consolida... Finalmente, concentra los resultados más altos...'`
        ).then((res) => { if (res) aiAnalysis.matriculados_nacional = res; })
      );
    }

    if (enrolledReg) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis del total de matriculados a nivel regional para ${program}.\nSerie histórica regional: ${enrolledReg}.\n\nModelo de estilo esperado:\n'El comportamiento de la matrícula a nivel regional muestra una trayectoria de crecimiento durante los últimos años. Después de la variación observada... marca un punto de recuperación a partir del cual la matrícula inicia una dinámica ascendente...'`
        ).then((res) => { if (res) aiAnalysis.matriculados_regional = res; })
      );
    }

    if (gradNat) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis de graduados a nivel nacional para ${program}.\nSerie histórica nacional: ${gradNat}.\n\nModelo de estilo esperado:\n'La evolución del número de graduados a nivel nacional evidencia una tendencia creciente a lo largo de la serie analizada... Este comportamiento se caracteriza por una mayor concentración de graduados en los segundos periodos de cada año...'`
        ).then((res) => { if (res) aiAnalysis.graduados_nacional = res; })
      );
    }

    if (gradReg) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Redacta el análisis de graduados a nivel regional para ${program}.\nSerie histórica regional: ${gradReg}.\n\nModelo de estilo esperado:\n'El comportamiento de los graduados a nivel regional muestra una evolución ascendente... los resultados más destacados tienden a concentrarse en los segundos periodos académicos...'`
        ).then((res) => { if (res) aiAnalysis.graduados_regional = res; })
      );
    }

    await Promise.all(promises);
  } catch (err) {
    console.warn('Error generando análisis automático con OpenAI:', err.message);
  }

  return aiAnalysis;
};

const downloadContextoExternoGeneralPdf = async (req, res) => {
  try {
    const program = cleanText(req.query?.programa);
    if (!program || normalizeKey(program) === 'TODOS') {
      return res.status(400).json({ success: false, message: 'Selecciona un programa para generar el informe PDF.' });
    }
    const rows = await PoblacionalContextoExternoGeneral.findAll({ raw: true });
    const programKey = normalizeKey(program);
    const requestedSection = normalizeKey(req.query?.seccion).toLowerCase();
    const section = requestedSection === 'completo'
      ? 'completo'
      : requestedSection === 'poblacional' ? 'poblacional' : 'oferta';
    const populationGroup = ['ingreso', 'matriculados', 'graduados'].includes(normalizeKey(req.query?.grupo).toLowerCase())
      ? normalizeKey(req.query?.grupo).toLowerCase()
      : 'ingreso';
    const exactFilter = (rowValue, queryValue) => !cleanText(queryValue) || normalizeKey(rowValue) === normalizeKey(queryValue);
    const searchKey = normalizeKey(req.query?.busqueda);
    const searchFields = ['nombre_programa', 'institucion', 'area_conocimiento', 'municipio'];
    const oferta = rows.filter((row) => (
      row.seccion === 'oferta'
      && normalizeKey(row.area_conocimiento) === programKey
      && (section === 'completo' || exactFilter(row.sector, req.query?.sector))
      && (section === 'completo' || exactFilter(row.modalidad, req.query?.modalidad))
      && (section === 'completo' || exactFilter(row.municipio, req.query?.municipio))
      && (section === 'completo' || !searchKey || searchFields.some((field) => normalizeKey(row[field]).includes(searchKey)))
    ));
    const poblacional = rows.filter((row) => (
      row.seccion === 'poblacional'
      && normalizeKey(row.programa) === programKey
      && (section === 'completo' || exactFilter(row.periodo_referencia, req.query?.periodo))
    ));
    const hasVisibleData = section === 'completo'
      ? oferta.length + poblacional.length
      : section === 'oferta' ? oferta.length : poblacional.length;
    if (!hasVisibleData) {
      return res.status(404).json({ success: false, message: `No hay información disponible para ${program}.` });
    }
    const scopes = ['nacional', 'regional'];
    const intakeCharts = ['stacked', 'trend', 'funnel', 'indicators', 'shaded', 'bubbles', 'periodCards', 'journey', 'timeline', 'conversion', 'stackedArea'];
    const simpleCharts = ['stacked', 'trend', 'funnel', 'indicators', 'shaded', 'bubbles', 'periodCards', 'journey', 'timeline', 'conversion', 'stackedArea'];
    const readVisualization = (group, allowedCharts) => {
      const chartType = cleanText(req.query?.[`grafico_${group}`]);
      const scope = cleanText(req.query?.[`alcance_${group}`]).toLowerCase();
      return {
        chartType: allowedCharts.includes(chartType) ? chartType : 'stacked',
        scope: scopes.includes(scope) ? scope : 'nacional'
      };
    };
    const visualizations = {
      ingreso: readVisualization('ingreso', intakeCharts),
      matriculados: readVisualization('matriculados', simpleCharts),
      graduados: readVisualization('graduados', simpleCharts)
    };
    const offerViews = ['sequence', 'panel', 'orbit', 'radial', 'executive'];
    const offerView = offerViews.includes(cleanText(req.query?.vista_oferta)) ? cleanText(req.query?.vista_oferta) : 'sequence';
    let aiAnalysisInput = {};
    try {
      if (req.body?.aiAnalysis) {
        aiAnalysisInput = typeof req.body.aiAnalysis === 'string' ? JSON.parse(req.body.aiAnalysis) : req.body.aiAnalysis;
      } else if (req.query?.aiAnalysis) {
        aiAnalysisInput = typeof req.query.aiAnalysis === 'string' ? JSON.parse(req.query.aiAnalysis) : req.query.aiAnalysis;
      }
    } catch (e) {
      console.warn('Error parseando aiAnalysis para PDF:', e);
    }

    const aiAnalysis = await generateOpenAIAnalysis(program, oferta, poblacional, aiAnalysisInput);

    const buffer = await generateContextoExternoGeneralPdf({
      program,
      oferta,
      poblacional,
      section,
      populationGroup,
      visualizations,
      offerView,
      aiAnalysis
    });
    const slug = normalizeKey(program).toLowerCase().replace(/_+/g, '_');
    res.setHeader('Content-Disposition', `attachment; filename=contexto_externo_${slug}.pdf`);
    res.setHeader('Content-Type', 'application/pdf');
    return res.send(buffer);
  } catch (error) {
    console.error('Error generando PDF de Contexto Externo General:', error);
    return res.status(500).json({ success: false, message: 'No fue posible generar el informe PDF.' });
  }
};

module.exports = {
  DATASET_LABEL,
  parseContextoExternoGeneralWorkbook: parseWorkbook,
  replaceContextoExternoGeneralData,
  downloadContextoExternoGeneralTemplate,
  downloadContextoExternoGeneralData,
  downloadContextoExternoGeneralPdf,
  importContextoExternoGeneral,
  getContextoExternoGeneralDashboard
};
