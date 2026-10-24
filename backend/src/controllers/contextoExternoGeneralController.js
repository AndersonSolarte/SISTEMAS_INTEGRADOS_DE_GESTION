const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { sequelize } = require('../config/database');
const {
  GestionInformacionCarga,
  PoblacionalContextoExternoGeneral
} = require('../models');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateContextoExternoGeneralPdf } = require('../services/contextoExternoGeneralPdfService');

let divipolaGeoIndex = null;
const getDivipolaGeoIndex = () => {
  if (divipolaGeoIndex) return divipolaGeoIndex;
  try {
    const geoMunicipalityPath = path.resolve(__dirname, '../../../frontend/public/geodata/divipola_municipios.json');
    if (fs.existsSync(geoMunicipalityPath)) {
      const data = JSON.parse(fs.readFileSync(geoMunicipalityPath, 'utf8'));
      const depts = new Set();
      const munis = new Map();
      data.forEach((item) => {
        const depNorm = normalizeKey(item.department_name_normalized || item.department_name);
        const munNorm = normalizeKey(item.name_normalized || item.name);
        depts.add(depNorm);
        if (!munis.has(munNorm)) munis.set(munNorm, []);
        munis.get(munNorm).push(item);
      });
      divipolaGeoIndex = { depts, munis };
    }
  } catch (err) {
    console.error('Error loading divipola for geo normalization:', err);
  }
  return divipolaGeoIndex;
};

const normalizeGeoOffer = (rawMun, rawDept, institucion = '') => {
  let mun = cleanText(rawMun);
  let dept = cleanText(rawDept);
  if (!mun && !dept) return { municipio: null, departamento: null };

  const geo = getDivipolaGeoIndex();
  if (!geo) return { municipio: mun, departamento: dept };

  const munKey = normalizeKey(mun);
  const deptKey = normalizeKey(dept);

  const munIsDept = geo.depts.has(munKey) && munKey !== 'BOGOTA_D_C';
  const deptIsMuni = geo.munis.has(deptKey);
  const deptIsDept = geo.depts.has(deptKey);

  if (munIsDept && dept && (deptIsMuni || !deptIsDept)) {
    const temp = mun;
    mun = dept;
    dept = temp;
  }

  if (normalizeKey(mun) === 'CALDAS' && String(institucion || '').toUpperCase().includes('LASALLISTA')) {
    dept = 'Antioquia';
  } else if (mun && (!dept || dept === mun)) {
    const candidates = geo.munis.get(normalizeKey(mun));
    if (candidates && candidates.length === 1) {
      dept = candidates[0].department_name;
    }
  }

  return { municipio: mun, departamento: dept };
};

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
        const rawMun = cleanText(valueOf(row, 'MUNICIPIO_OFERTA_PROGRAMA', 'MUNICIPIO'));
        const rawDept = cleanText(valueOf(row, 'DEPARTAMENTO', 'DEPARTAMENTO_OFERTA_PROGRAMA'));
        const { municipio, departamento } = normalizeGeoOffer(rawMun, rawDept, institucion);
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
          municipio,
          georeferencia: cleanText(valueOf(row, 'GEOREFERENCIA')),
          departamento
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
  const openAiKey = process.env.OPENAI_API_KEY || process.env.OPENAI_KEY;
  if (openAiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openAiKey.trim()}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.5,
          max_tokens: 650
        })
      });
      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content?.trim();
      if (content) return content;
    } catch (err) {
      console.warn('Error en llamada a OpenAI para análisis de contexto:', err.message);
    }
  }

  const geminiKey = process.env.GEMINI_API_KEY || process.env.GEMINI_KEY;
  if (geminiKey) {
    try {
      const genAI = new GoogleGenerativeAI(geminiKey.trim());
      const model = genAI.getGenerativeModel({
        model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
        systemInstruction: systemPrompt
      });
      const result = await model.generateContent(userPrompt);
      const content = result?.response?.text()?.trim();
      if (content) return content;
    } catch (err) {
      console.warn('Error en llamada a Gemini para análisis de contexto:', err.message);
    }
  }

  return null;
};

const systemPrompt = `Eres un asesor directivo senior de Planeación Estratégica y Aseguramiento de la Calidad de Educación Superior en Colombia, especializado en análisis institucional del SNIES (Ministerio de Educación Nacional).
Tu objetivo es redactar análisis e interpretaciones ejecutivas de alto nivel profesional para el Consejo Académico, Rectoría y comités de autoevaluación institucional.

ESTÁNDARES DE CALIDAD Y ESTILO DIRECTIVO:
1. TONO Y REGISTRO: Formal, analítico, riguroso y estratégico. No te limites a describir o parafrasear números obvios; aporta interpretación contextual del mercado educativo, pertinencia académica, sostenibilidad del programa y ventajas competitivas.
2. ESTRUCTURA: Redacta exactamente 2 párrafos continuos, sólidos y fluidos (sin subtítulos, sin viñetas, sin listas numeradas, sin asteriscos ni markdown).
   - Primer párrafo: Diagnóstico estratégico y lectura de la estructura o tendencia de los datos proporcionados, contextualizando magnitudes clave y patrones predominantes.
   - Segundo párrafo: Implicaciones directivas, pertinencia curricular, balance competitivo (sector oficial vs. privado / nacional vs. regional) y recomendaciones o conclusiones estratégicas para la toma de decisiones institucionales.
3. LENGUAJE TÉCNICO COLOMBIANO: Usa con naturalidad y precisión términos del Sistema de Aseguramiento de la Calidad (ej. pertinencia social y curricular, área de influencia territorial, masa crítica de matrícula, selectividad y absorción vocacional, eficiencia terminal, retención estudiantil, diversificación formativa).
4. INTEGRACIÓN DE CIFRAS: Teje las cifras suministradas dentro del análisis como soporte probatorio, sin saturar ni hacer listados mecánicos.`;

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
  const hasAiKey = !!(process.env.OPENAI_API_KEY || process.env.OPENAI_KEY || process.env.GEMINI_API_KEY || process.env.GEMINI_KEY);
  if (!hasAiKey || Object.keys(aiAnalysis).length > 0) return aiAnalysis;

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
          `Programa analizado: ${program}.
DATOS OFICIALES SNIES DE DENOMINACIONES Y OFERTA ACADÉMICA AFÍN:
- Universo nacional: ${natStats.total} programas afines identificados.
- Denominaciones con mayor frecuencia nacional: ${natStats.topTitles}.
- Otras denominaciones con presencia específica en el país: ${natStats.otherTitles}.
- Oferta en la región (suroccidente): ${regStats ? regStats.total : 0} programas afines (denominaciones principales: ${regStats ? regStats.topTitles : 'Sin registros regionales adicionales'}).

INSTRUCCIÓN ESPECÍFICA:
Redacta un análisis directivo y riguroso sobre las tendencias de denominación y afinidad curricular del programa. Analiza si la oferta nacional converge en titulaciones convencionales o evoluciona hacia especializaciones aplicadas, y concluye con las implicaciones para la diferenciación académica y competitividad del programa en el contexto regional.`
        ).then((res) => { if (res) aiAnalysis.offer_tables = res; })
      );

      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
DATOS OFICIALES SNIES DE LA CARACTERIZACIÓN DE OFERTA NACIONAL:
- Total programas afines vigentes: ${natStats.total}.
- Composición sectorial: ${natStats.privado} programas del sector privado frente a ${natStats.oficial} del sector público/oficial.
- Duración promedio curricular: ${natStats.semestresModa} semestres.
- Modalidades de formación: ${natStats.modalidadesStr}.
- Estructura crediticia: oscila entre ${natStats.minCred} y ${natStats.maxCred} créditos académicos (promedio de ${natStats.avgCred} créditos).
- Nodos territoriales de concentración: ${natStats.topCities}.

INSTRUCCIÓN ESPECÍFICA:
Redacta un análisis ejecutivo caracterizando el ecosistema de oferta a nivel nacional. Interpreta el equilibrio sectorial (privado vs. oficial), la penetración de modalidades presenciales y virtuales, la consistencia de la carga crediticia bajo lineamientos MEN y la centralidad geográfica en nodos urbanos principales. Concluye con la lectura estratégica de madurez y competitividad del campo disciplinar.`
        ).then((res) => { if (res) aiAnalysis.offer_nacional = res; })
      );
    }

    if (regStats) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
DATOS OFICIALES SNIES DE LA OFERTA ACADÉMICA REGIONAL (Suroccidente Colombiano):
- Total programas afines en la región: ${regStats.total} (${natStats ? ((regStats.total / natStats.total) * 100).toFixed(1) : 0}% del mercado nacional).
- Composición sectorial regional: ${regStats.privado} privadas vs. ${regStats.oficial} públicas.
- Duración curricular: ${regStats.semestresModa} semestres.
- Modalidades en la región: ${regStats.modalidadesStr}.
- Rango de créditos en la región: entre ${regStats.minCred} y ${regStats.maxCred} créditos (promedio regional: ${regStats.avgCred}).
- Principales denominaciones regionales: ${regStats.topTitles}.
- Asientos municipales de la oferta regional: ${regStats.topCities}.

INSTRUCCIÓN ESPECÍFICA:
Redacta un informe analítico ejecutivo sobre la configuración competitiva en el área de influencia directa. Diagnostica la concentración de la oferta en los polos urbanos regionales, la cuota de mercado regional y el grado de competencia directa. Concluye con la pertinencia curricular y los nichos estratégicos de oportunidad para la institución.`
        ).then((res) => { if (res) aiAnalysis.offer_regional = res; })
      );
    }

    if (intakeNat) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
SERIE HISTÓRICA SNIES DE DEMANDA Y EMBUDO DE INGRESO A NIVEL NACIONAL:
Detalle por período (Inscritos, Admitidos y Primer Curso): ${intakeNat}.

INSTRUCCIÓN ESPECÍFICA:
Redacta una evaluación analítica ejecutiva del embudo vocacional nacional. Examina la evolución histórica de la atracción (aspirantes inscritos), la selectividad en la admisión y la tasa de conversión efectiva a primer curso (absorción institucional). Concluye sobre la estabilidad de la demanda vocacional en Colombia para esta disciplina formativa.`
        ).then((res) => { if (res) aiAnalysis.ingreso_nacional = res; })
      );
    }

    if (intakeReg) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
SERIE HISTÓRICA SNIES DE DEMANDA Y EMBUDO DE INGRESO A NIVEL REGIONAL:
Detalle por período (Inscritos, Admitidos y Primer Curso): ${intakeReg}.

INSTRUCCIÓN ESPECÍFICA:
Elabora un análisis directivo del comportamiento del flujo de ingreso en la región suroccidental. Analiza la capacidad de atracción de nuevos aspirantes en el territorio, la efectividad de absorción de cohortes y las fluctuaciones entre períodos semestrales. Concluye con la lectura de sostenibilidad de la demanda en el área de influencia y recomendaciones para la gestión de matrícula.`
        ).then((res) => { if (res) aiAnalysis.ingreso_regional = res; })
      );
    }

    if (enrolledNat) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
SERIE HISTÓRICA SNIES DE ESTUDIANTES MATRICULADOS ACTIVOS A NIVEL NACIONAL:
Totales por período académico: ${enrolledNat}.

INSTRUCCIÓN ESPECÍFICA:
Redacta un análisis institucional ejecutivo sobre la masa crítica de matrícula activa en Colombia para esta área. Evalúa la trayectoria temporal, los puntos de inflexión o consolidación de la matrícula, y la capacidad de permanencia del estudiantado en el sistema nacional. Concluye sobre la solidez y perspectivas de permanencia del campo disciplinar.`
        ).then((res) => { if (res) aiAnalysis.matriculados_nacional = res; })
      );
    }

    if (enrolledReg) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
SERIE HISTÓRICA SNIES DE ESTUDIANTES MATRICULADOS ACTIVOS A NIVEL REGIONAL:
Totales por período académico: ${enrolledReg}.

INSTRUCCIÓN ESPECÍFICA:
Elabora una lectura ejecutiva sobre la dinámica y estabilidad de la matrícula activa en la región. Analiza el comportamiento de la comunidad estudiantil a lo largo de los períodos observados, la retención en el programa y el peso del programa dentro del entorno regional. Concluye sobre el impacto en la viabilidad académica y operativa institucional.`
        ).then((res) => { if (res) aiAnalysis.matriculados_regional = res; })
      );
    }

    if (gradNat) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
SERIE HISTÓRICA SNIES DE GRADUADOS TITULADOS A NIVEL NACIONAL:
Totales por período académico: ${gradNat}.

INSTRUCCIÓN ESPECÍFICA:
Redacta una evaluación ejecutiva sobre la eficiencia terminal y titulación a nivel nacional. Analiza la regularidad en el egreso, los patrones de graduación por período y el aporte acumulado de profesionales titulados a los sectores productivos y sociales de Colombia. Concluye destacando el valor de la titulación oportuna en los procesos de acreditación de alta calidad.`
        ).then((res) => { if (res) aiAnalysis.graduados_nacional = res; })
      );
    }

    if (gradReg) {
      promises.push(
        fetchOpenAI(
          systemPrompt,
          `Programa analizado: ${program}.
SERIE HISTÓRICA SNIES DE GRADUADOS TITULADOS A NIVEL REGIONAL:
Totales por período académico: ${gradReg}.

INSTRUCCIÓN ESPECÍFICA:
Elabora un análisis ejecutivo del indicador de graduación en el entorno regional. Examina el flujo de egresados titulados aportados a la región suroccidental, su correspondencia con las necesidades del entorno productivo y social local, y el impacto de la comunidad de graduados en el posicionamiento y huella social de la institución.`
        ).then((res) => { if (res) aiAnalysis.graduados_regional = res; })
      );
    }

    await Promise.all(promises);
  } catch (err) {
    console.warn('Error generando análisis automático con IA:', err.message);
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
    const rawIncludeAnalysis = req.query?.incluir_analisis ?? req.body?.incluir_analisis;
    const includeAnalysis = rawIncludeAnalysis === undefined
      ? true
      : (String(rawIncludeAnalysis).trim() === 'true' || String(rawIncludeAnalysis).trim() === '1');

    let aiAnalysisInput = {};
    if (includeAnalysis) {
      try {
        if (req.body?.aiAnalysis) {
          aiAnalysisInput = typeof req.body.aiAnalysis === 'string' ? JSON.parse(req.body.aiAnalysis) : req.body.aiAnalysis;
        } else if (req.query?.aiAnalysis) {
          aiAnalysisInput = typeof req.query.aiAnalysis === 'string' ? JSON.parse(req.query.aiAnalysis) : req.query.aiAnalysis;
        }
      } catch (e) {
        console.warn('Error parseando aiAnalysis para PDF:', e);
      }
    }

    const aiAnalysis = includeAnalysis
      ? await generateOpenAIAnalysis(program, oferta, poblacional, aiAnalysisInput)
      : {};

    const buffer = await generateContextoExternoGeneralPdf({
      program,
      oferta,
      poblacional,
      section,
      populationGroup,
      visualizations,
      offerView,
      aiAnalysis,
      includeAnalysis
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
