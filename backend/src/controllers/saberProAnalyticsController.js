const { Op, fn, col, literal, QueryTypes } = require('sequelize');
const { SaberProResultadoIndividual } = require('../models');
const { sequelize } = require('../config/database');
const saberProPythonClient = require('../services/saberProPythonClient');

const toArray = (value) => {
  if (Array.isArray(value)) return value.filter((x) => x !== null && x !== undefined && String(x).trim() !== '');
  if (value === null || value === undefined || value === '') return [];
  return [value];
};

const normalizeText = (value) => {
  const text = String(value || '').trim();
  return text || null;
};

const buildWhere = (filters = {}) => {
  const where = {};
  const programas = toArray(filters.programas);
  const anios = toArray(filters.anios).map((x) => Number(x)).filter(Number.isFinite);
  const periodos = toArray(filters.periodos);
  const modulos = toArray(filters.modulos);
  const gruposReferencia = toArray(filters.gruposReferencia);
  const tipoEvaluado = toArray(filters.tipoEvaluado);
  const competencias = toArray(filters.competencias);
  const tipoPrueba = toArray(filters.tipoPrueba || filters.tiposPrueba);

  if (programas.length) where.programa = { [Op.in]: programas };
  if (anios.length) where.anio = { [Op.in]: anios };
  if (periodos.length) where.periodo = { [Op.in]: periodos };
  if (modulos.length) where.modulo = { [Op.in]: modulos };
  if (gruposReferencia.length) where.grupo_referencia = { [Op.in]: gruposReferencia };
  if (tipoEvaluado.length) where.tipo_evaluado = { [Op.in]: tipoEvaluado };
  if (competencias.length) where.competencias = { [Op.in]: competencias };
  if (tipoPrueba.length) where.tipo_prueba = { [Op.in]: tipoPrueba };

  return where;
};

const buildWhereSql = (filters = {}) => {
  const clauses = [];
  const params = [];
  const appendIn = (column, values = []) => {
    if (!values.length) return;
    const placeholders = values.map(() => '?').join(', ');
    clauses.push(`${column} IN (${placeholders})`);
    params.push(...values);
  };

  appendIn('raw.programa', toArray(filters.programas).map(normalizeText).filter(Boolean));
  appendIn('raw.anio', toArray(filters.anios).map((x) => Number(x)).filter(Number.isFinite));
  appendIn('raw.periodo', toArray(filters.periodos).map(normalizeText).filter(Boolean));
  appendIn('raw.modulo', toArray(filters.modulos).map(normalizeText).filter(Boolean));
  appendIn('raw.grupo_referencia', toArray(filters.gruposReferencia).map(normalizeText).filter(Boolean));
  appendIn('raw.tipo_evaluado', toArray(filters.tipoEvaluado).map(normalizeText).filter(Boolean));
  appendIn('raw.competencias', toArray(filters.competencias).map(normalizeText).filter(Boolean));
  appendIn('raw.tipo_prueba', toArray(filters.tipoPrueba || filters.tiposPrueba).map(normalizeText).filter(Boolean));

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
};

const buildDirectWhereSql = (filters = {}) => {
  const clauses = [];
  const params = [];
  const appendIn = (column, values = []) => {
    if (!values.length) return;
    const placeholders = values.map(() => '?').join(', ');
    clauses.push(`${column} IN (${placeholders})`);
    params.push(...values);
  };

  appendIn('programa', toArray(filters.programas).map(normalizeText).filter(Boolean));
  appendIn('anio', toArray(filters.anios).map((x) => Number(x)).filter(Number.isFinite));
  appendIn('periodo', toArray(filters.periodos).map(normalizeText).filter(Boolean));
  appendIn('grupo_referencia', toArray(filters.gruposReferencia).map(normalizeText).filter(Boolean));
  appendIn('tipo_prueba', toArray(filters.tipoPrueba || filters.tiposPrueba).map(normalizeText).filter(Boolean));

  return {
    whereSql: clauses.length ? `WHERE ${clauses.join(' AND ')}` : '',
    params
  };
};

const VALUE_ADDED_DATASET_SQL = `
  WITH base AS (
    SELECT
      MAX(raw.id) AS id,
      raw.documento,
      MAX(raw.nombre) AS nombre,
      MAX(raw.programa) AS programa,
      raw.anio,
      MAX(raw.periodo) AS periodo,
      MAX(raw.tipo_prueba) AS tipo_prueba,
      MAX(raw.grupo_referencia) AS grupo_referencia,
      MAX(raw.tipo_evaluado) AS tipo_evaluado,
      MAX(raw.numero_registro) AS numero_registro,
      MAX(raw.puntaje_global) AS puntaje_global,
      MAX(raw.percentil_nacional_global) AS percentil_nacional_global,
      MAX(raw.percentil_grupo_referencia) AS percentil_grupo_referencia,
      MAX(CASE WHEN TRANSLATE(UPPER(COALESCE(raw.modulo, '')), CHR(193) || CHR(201) || CHR(205) || CHR(211) || CHR(218), 'AEIOU') = 'LECTURA CRITICA' THEN raw.puntaje_modulo END) AS lectura_critica,
      MAX(CASE WHEN TRANSLATE(UPPER(COALESCE(raw.modulo, '')), CHR(193) || CHR(201) || CHR(205) || CHR(211) || CHR(218), 'AEIOU') = 'RAZONAMIENTO CUANTITATIVO' THEN raw.puntaje_modulo END) AS razonamiento_cuantitativo,
      MAX(CASE WHEN TRANSLATE(UPPER(COALESCE(raw.modulo, '')), CHR(193) || CHR(201) || CHR(205) || CHR(211) || CHR(218), 'AEIOU') = 'COMPETENCIAS CIUDADANAS' THEN raw.puntaje_modulo END) AS competencias_ciudadanas,
      MAX(CASE WHEN TRANSLATE(UPPER(COALESCE(raw.modulo, '')), CHR(193) || CHR(201) || CHR(205) || CHR(211) || CHR(218), 'AEIOU') = 'COMUNICACION ESCRITA' THEN raw.puntaje_modulo END) AS comunicacion_escrita,
      MAX(CASE WHEN TRANSLATE(UPPER(COALESCE(raw.modulo, '')), CHR(193) || CHR(201) || CHR(205) || CHR(211) || CHR(218), 'AEIOU') = 'INGLES' THEN raw.puntaje_modulo END) AS ingles
    FROM saber_pro_resultados_individuales raw
    __WHERE_SQL__
    GROUP BY raw.documento, raw.anio
  ),
  program_coverage AS (
    SELECT
      raw.programa,
      COUNT(DISTINCT raw.documento) AS total_estudiantes,
      COUNT(DISTINCT CASE
        WHEN EXISTS (
          SELECT 1
          FROM resultados_saber11 s11
          WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
            AND s11.anio < raw.anio
        ) THEN raw.documento
      END) AS estudiantes_con_match,
      ROUND((
        COUNT(DISTINCT CASE
          WHEN EXISTS (
            SELECT 1
            FROM resultados_saber11 s11
            WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
              AND s11.anio < raw.anio
          ) THEN raw.documento
        END)::numeric / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
      ) * 100.0, 2) AS porcentaje_cobertura,
      CASE
        WHEN (
          COUNT(DISTINCT CASE
            WHEN EXISTS (
              SELECT 1
              FROM resultados_saber11 s11
              WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                AND s11.anio < raw.anio
            ) THEN raw.documento
          END)::numeric / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
        ) * 100.0 >= 60 THEN 'ALTO'
        WHEN (
          COUNT(DISTINCT CASE
            WHEN EXISTS (
              SELECT 1
              FROM resultados_saber11 s11
              WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                AND s11.anio < raw.anio
            ) THEN raw.documento
          END)::numeric / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
        ) * 100.0 >= 30 THEN 'MEDIO'
        ELSE 'CRITICO'
      END AS estado_cobertura,
      CASE
        WHEN (
          COUNT(DISTINCT CASE
            WHEN EXISTS (
              SELECT 1
              FROM resultados_saber11 s11
              WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                AND s11.anio < raw.anio
            ) THEN raw.documento
          END)::numeric / NULLIF(COUNT(DISTINCT raw.documento), 0)::numeric
        ) * 100.0 >= 30 THEN TRUE
        ELSE FALSE
      END AS es_valido_valor_agregado
    FROM saber_pro_resultados_individuales raw
    GROUP BY raw.programa
  )
  SELECT
    base.*,
    base.grupo_referencia AS nucleo_basico_conocimiento,
    base.lectura_critica AS lectura_salida,
    base.razonamiento_cuantitativo AS razonamiento_salida,
    base.competencias_ciudadanas AS ciudadanas_salida,
    base.comunicacion_escrita AS comunicacion_salida,
    base.ingles AS ingles_salida,
    pc.total_estudiantes,
    pc.estudiantes_con_match,
    pc.porcentaje_cobertura,
    pc.estado_cobertura,
    TRUE AS es_valido_valor_agregado,
    NULL AS mensaje_cobertura,
    s11.lectura_s11   AS lectura_entrada,
    s11.razonamiento_s11 AS razonamiento_entrada,
    s11.ciudadanas_s11   AS ciudadanas_entrada,
    s11.comunicacion_s11 AS comunicacion_entrada,
    s11.ingles_s11       AS ingles_entrada,
    CASE WHEN s11.documento IS NOT NULL
      THEN (base.lectura_critica        / 300.0) - s11.lectura_s11
      ELSE NULL END AS va_lectura,
    CASE WHEN s11.documento IS NOT NULL
      THEN (base.razonamiento_cuantitativo / 300.0) - s11.razonamiento_s11
      ELSE NULL END AS va_razonamiento,
    CASE WHEN s11.documento IS NOT NULL
      THEN (base.competencias_ciudadanas / 300.0) - s11.ciudadanas_s11
      ELSE NULL END AS va_ciudadanas,
    CASE WHEN s11.documento IS NOT NULL
      THEN (base.comunicacion_escrita   / 300.0) - s11.comunicacion_s11
      ELSE NULL END AS va_comunicacion,
    CASE WHEN s11.documento IS NOT NULL
      THEN (base.ingles                 / 300.0) - s11.ingles_s11
      ELSE NULL END AS va_ingles,
    CASE WHEN s11.documento IS NOT NULL THEN (
      (
        ((base.lectura_critica           / 300.0) - s11.lectura_s11)    +
        ((base.razonamiento_cuantitativo / 300.0) - s11.razonamiento_s11) +
        ((base.competencias_ciudadanas   / 300.0) - s11.ciudadanas_s11) +
        ((base.comunicacion_escrita      / 300.0) - s11.comunicacion_s11) +
        ((base.ingles                    / 300.0) - s11.ingles_s11)
      ) / 5.0
    ) ELSE NULL END AS va_global
  FROM base
  LEFT JOIN program_coverage pc ON pc.programa = base.programa
  LEFT JOIN LATERAL (
    SELECT
      s.*,
      -- Promedio normalizado de columnas S11 según la equivalencia detectada (÷100 para escala 0-1)
      (
        SELECT AVG(NULLIF(to_jsonb(s.*) ->> col_name, 'null')::numeric)
        FROM jsonb_array_elements_text(eq.reglas -> 'lectura_critica') AS col_name
      ) / 100.0 AS lectura_s11,
      (
        SELECT AVG(NULLIF(to_jsonb(s.*) ->> col_name, 'null')::numeric)
        FROM jsonb_array_elements_text(eq.reglas -> 'razonamiento_cuantitativo') AS col_name
      ) / 100.0 AS razonamiento_s11,
      (
        SELECT AVG(NULLIF(to_jsonb(s.*) ->> col_name, 'null')::numeric)
        FROM jsonb_array_elements_text(eq.reglas -> 'competencias_ciudadanas') AS col_name
      ) / 100.0 AS ciudadanas_s11,
      (
        SELECT AVG(NULLIF(to_jsonb(s.*) ->> col_name, 'null')::numeric)
        FROM jsonb_array_elements_text(eq.reglas -> 'comunicacion_escrita') AS col_name
      ) / 100.0 AS comunicacion_s11,
      (
        SELECT AVG(NULLIF(to_jsonb(s.*) ->> col_name, 'null')::numeric)
        FROM jsonb_array_elements_text(eq.reglas -> 'ingles') AS col_name
      ) / 100.0 AS ingles_s11
    FROM resultados_saber11 s
    LEFT JOIN LATERAL (
      SELECT vec.*
      FROM va_equivalencias_config vec
      WHERE (to_jsonb(s.*) ->> vec.detector_col) IS NOT NULL
        AND (vec.detector_extra IS NULL OR (to_jsonb(s.*) ->> vec.detector_extra) IS NOT NULL)
      ORDER BY
        (CASE WHEN vec.detector_extra IS NOT NULL THEN 0 ELSE 1 END),
        vec.orden_deteccion
      LIMIT 1
    ) eq ON TRUE
    WHERE TRIM(s.documento::text) = TRIM(base.documento::text)
      AND s.anio < base.anio
    ORDER BY s.anio DESC
    LIMIT 1
  ) s11 ON TRUE
`;

const SABER_PRO_TABLE_SELECT_SQL = VALUE_ADDED_DATASET_SQL;

const quintilFromPercentil = (percentil) => {
  const p = Number(percentil);
  if (!Number.isFinite(p) || p < 0) return 'N/A';
  if (p < 20) return 'Q1';
  if (p < 40) return 'Q2';
  if (p < 60) return 'Q3';
  if (p < 80) return 'Q4';
  return 'Q5';
};

const classifyCompetencia = ({ competencias, modulo }) => {
  const c = String(competencias || '').trim().toUpperCase();
  if (c.includes('GENERIC')) return 'GENERICAS';
  if (c.includes('ESPEC')) return 'ESPECIFICAS';

  const m = String(modulo || '').trim().toUpperCase();
  const genericModules = new Set([
    'RAZONAMIENTO CUANTITATIVO',
    'LECTURA CRITICA',
    'LECTURA CRÍTICA',
    'COMUNICACION ESCRITA',
    'COMUNICACIÓN ESCRITA',
    'COMPETENCIAS CIUDADANAS',
    'INGLES',
    'INGLÉS'
  ]);
  return genericModules.has(m) ? 'GENERICAS' : 'ESPECIFICAS';
};

const buildCoverageMeta = (row = {}) => {
  const porcentaje = Number(row.porcentaje_cobertura || 0);
  let estado = 'CRITICO';
  let etiqueta = 'NO REPRESENTATIVO';
  if (porcentaje >= 60) {
    estado = 'ALTO';
    etiqueta = 'CONFIABLE';
  } else if (porcentaje >= 30) {
    estado = 'MEDIO';
    etiqueta = 'USAR CON PRECAUCION';
  }
  return {
    total_estudiantes: Number(row.total_estudiantes || 0),
    estudiantes_con_match: Number(row.estudiantes_con_match || 0),
    porcentaje_cobertura: Number(porcentaje.toFixed(2)),
    estado_cobertura: estado,
    etiqueta_cobertura: etiqueta,
    es_valido_valor_agregado: porcentaje >= 30,
    mensaje_cobertura: porcentaje >= 30 ? null : 'Cobertura insuficiente'
  };
};

const getCoverageSummary = async (filters = {}) => {
  const { whereSql, params } = buildWhereSql(filters);
  const rows = await sequelize.query(
    `
      WITH filtered_docs AS (
        SELECT
          raw.documento,
          MAX(
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM resultados_saber11 s11
                WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                  AND s11.anio < raw.anio
              ) THEN 1
              ELSE 0
            END
          ) AS has_match
        FROM saber_pro_resultados_individuales raw
        ${whereSql}
        GROUP BY raw.documento
      )
      SELECT
        COUNT(*) AS total_estudiantes,
        COUNT(*) FILTER (WHERE has_match = 1) AS estudiantes_con_match,
        ROUND((COUNT(*) FILTER (WHERE has_match = 1))::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) AS porcentaje_cobertura
      FROM filtered_docs
    `,
    { replacements: params, type: QueryTypes.SELECT }
  );
  return buildCoverageMeta(rows?.[0] || {});
};

const getCoverageByDimension = async (filters = {}, dimension = 'programa') => {
  const { whereSql, params } = buildWhereSql(filters);
  const dimensionSql = dimension === 'nbc'
    ? "COALESCE(raw.grupo_referencia, 'SIN NBC')"
    : 'COALESCE(raw.programa, \'SIN PROGRAMA\')';
  const alias = dimension === 'nbc' ? 'nbc' : 'programa';

  const rows = await sequelize.query(
    `
      WITH filtered_docs AS (
        SELECT
          ${dimensionSql} AS scope_key,
          raw.documento,
          MAX(
            CASE
              WHEN EXISTS (
                SELECT 1
                FROM resultados_saber11 s11
                WHERE TRIM(s11.documento::text) = TRIM(raw.documento::text)
                  AND s11.anio < raw.anio
              ) THEN 1
              ELSE 0
            END
          ) AS has_match
        FROM saber_pro_resultados_individuales raw
        ${whereSql}
        GROUP BY ${dimensionSql}, raw.documento
      )
      SELECT
        scope_key AS ${alias},
        COUNT(*) AS total_estudiantes,
        COUNT(*) FILTER (WHERE has_match = 1) AS estudiantes_con_match,
        ROUND((COUNT(*) FILTER (WHERE has_match = 1))::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) AS porcentaje_cobertura
      FROM filtered_docs
      GROUP BY scope_key
    `,
    { replacements: params, type: QueryTypes.SELECT }
  );

  return rows.map((row) => ({
    [alias]: row[alias],
    ...buildCoverageMeta(row)
  }));
};

const tryPythonResponse = async (res, { method, path, body }) => {
  if (!saberProPythonClient.isEnabled()) return false;
  try {
    const payload = await saberProPythonClient.request({ method, path, body });
    res.json(payload);
    return true;
  } catch (error) {
    console.warn(error.message);
    return false;
  }
};

const getSaberProFiltros = async (_req, res) => {
  try {
    if (await tryPythonResponse(res, { method: 'GET', path: '/saber-pro/filtros' })) return;

    const [programasRows, aniosRows, periodosRows, modulosRows, gruposRows, tiposRows, competenciasRows] = await Promise.all([
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('programa')), 'programa']],
        where: { programa: { [Op.not]: null } },
        order: [[literal('programa'), 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('anio')), 'anio']],
        where: { anio: { [Op.not]: null } },
        order: [[literal('anio'), 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('periodo')), 'periodo']],
        where: { periodo: { [Op.not]: null } },
        order: [[literal('periodo'), 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('modulo')), 'modulo']],
        where: { modulo: { [Op.not]: null } },
        order: [[literal('modulo'), 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('grupo_referencia')), 'grupo_referencia']],
        where: { grupo_referencia: { [Op.not]: null } },
        order: [[literal('grupo_referencia'), 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('tipo_evaluado')), 'tipo_evaluado']],
        where: { tipo_evaluado: { [Op.not]: null } },
        order: [[literal('tipo_evaluado'), 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        attributes: [[fn('DISTINCT', col('competencias')), 'competencias']],
        where: { competencias: { [Op.not]: null } },
        order: [[literal('competencias'), 'ASC']],
        raw: true
      })
    ]);

    return res.json({
      success: true,
      data: {
        programas: programasRows.map((r) => normalizeText(r.programa)).filter(Boolean),
        anios: aniosRows.map((r) => Number(r.anio)).filter(Number.isFinite).sort((a, b) => a - b),
        periodos: periodosRows.map((r) => normalizeText(r.periodo)).filter(Boolean),
        modulos: modulosRows.map((r) => normalizeText(r.modulo)).filter(Boolean),
        competencias: competenciasRows.map((r) => normalizeText(r.competencias)).filter(Boolean),
        gruposReferencia: gruposRows.map((r) => normalizeText(r.grupo_referencia)).filter(Boolean),
        tipoEvaluado: tiposRows.map((r) => normalizeText(r.tipo_evaluado)).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error al obtener filtros Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener filtros Saber Pro' });
  }
};

const getSaberProOverview = async (req, res) => {
  try {
    if (await tryPythonResponse(res, { method: 'POST', path: '/saber-pro/overview', body: { filters: req.body?.filters || {} } })) return;

    const where = buildWhere(req.body?.filters || {});
    const rows = await SaberProResultadoIndividual.findAll({
      where,
      attributes: ['programa', 'anio', 'puntaje_global', 'percentil_nacional_global', 'documento', 'numero_registro'],
      raw: true
    });

    const dedup = new Map();
    rows.forEach((row) => {
      const key = `${row.documento || ''}|${row.numero_registro || ''}|${row.anio || ''}|${row.programa || ''}`;
      if (!dedup.has(key)) dedup.set(key, row);
    });
    const uniqueRows = Array.from(dedup.values());

    const evaluados = uniqueRows.length;
    const puntajesGlobales = uniqueRows.map((row) => Number(row.puntaje_global)).filter(Number.isFinite);
    const promedioGlobal = evaluados
      ? uniqueRows.reduce((sum, row) => sum + (Number(row.puntaje_global) || 0), 0) / evaluados
      : 0;
    const percentilPromedio = evaluados
      ? uniqueRows.reduce((sum, row) => sum + (Number(row.percentil_nacional_global) || 0), 0) / evaluados
      : 0;

    const byYear = new Map();
    uniqueRows.forEach((row) => {
      const year = Number(row.anio);
      if (!Number.isFinite(year)) return;
      const current = byYear.get(year) || { sum: 0, n: 0 };
      current.sum += Number(row.puntaje_global) || 0;
      current.n += 1;
      byYear.set(year, current);
    });

    const years = [...byYear.keys()].sort((a, b) => a - b);
    const lastYear = years[years.length - 1];
    const prevYear = years[years.length - 2];
    const lastAvg = lastYear ? (byYear.get(lastYear).sum / byYear.get(lastYear).n) : null;
    const prevAvg = prevYear ? (byYear.get(prevYear).sum / byYear.get(prevYear).n) : null;
    const variacionInteranual = (Number.isFinite(lastAvg) && Number.isFinite(prevAvg) && prevAvg !== 0)
      ? Number((((lastAvg - prevAvg) / prevAvg) * 100).toFixed(2))
      : null;

    const programa = toArray(req.body?.filters?.programas)[0] || uniqueRows[0]?.programa || null;
    const anio = toArray(req.body?.filters?.anios).map((x) => Number(x)).find(Number.isFinite) || lastYear || null;

    const sortedScores = [...puntajesGlobales].sort((a, b) => a - b);
    const percentile = (arr, p) => {
      if (!arr.length) return 0;
      const idx = (arr.length - 1) * p;
      const lo = Math.floor(idx);
      const hi = Math.ceil(idx);
      if (lo === hi) return arr[lo];
      return arr[lo] + ((arr[hi] - arr[lo]) * (idx - lo));
    };
    const mean = puntajesGlobales.length ? (puntajesGlobales.reduce((a, b) => a + b, 0) / puntajesGlobales.length) : 0;
    const variance = puntajesGlobales.length ? (puntajesGlobales.reduce((acc, x) => acc + ((x - mean) ** 2), 0) / puntajesGlobales.length) : 0;
    const std = Math.sqrt(variance);
    const freq = new Map();
    puntajesGlobales.forEach((x) => {
      const key = Number(x).toFixed(2);
      freq.set(key, (freq.get(key) || 0) + 1);
    });
    let modeValue = null;
    let modeCount = 0;
    freq.forEach((count, key) => {
      if (count > modeCount) {
        modeCount = count;
        modeValue = Number(key);
      }
    });

    return res.json({
      success: true,
      data: {
        kpis: {
          evaluados,
          promedioGlobal: Number(promedioGlobal.toFixed(2)),
          percentilPromedio: Number(percentilPromedio.toFixed(2)),
          quintil: quintilFromPercentil(percentilPromedio),
          variacionInteranual
        },
        describePuntajeGlobal: {
          count: puntajesGlobales.length,
          mean: Number(mean.toFixed(2)),
          std: Number(std.toFixed(2)),
          min: Number((sortedScores[0] ?? 0).toFixed(2)),
          q1: Number(percentile(sortedScores, 0.25).toFixed(2)),
          median: Number(percentile(sortedScores, 0.5).toFixed(2)),
          q3: Number(percentile(sortedScores, 0.75).toFixed(2)),
          max: Number((sortedScores[sortedScores.length - 1] ?? 0).toFixed(2)),
          mode: modeValue,
          modeCount
        },
        programaResumen: { programa, anio }
      }
    });
  } catch (error) {
    console.error('Error en overview Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al calcular overview Saber Pro' });
  }
};

const getSaberProCharts = async (req, res) => {
  try {
    if (await tryPythonResponse(res, { method: 'POST', path: '/saber-pro/charts', body: { filters: req.body?.filters || {} } })) return;

    const where = buildWhere(req.body?.filters || {});
    const [trendRows, moduloRows, sampleRows] = await Promise.all([
      SaberProResultadoIndividual.findAll({
        where,
        attributes: ['anio', [fn('AVG', col('puntaje_global')), 'promedio'], [fn('COUNT', col('id')), 'n']],
        group: ['anio'],
        order: [['anio', 'ASC']],
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        where,
        attributes: ['modulo', 'competencias', [fn('AVG', col('puntaje_modulo')), 'promedio'], [fn('AVG', col('percentil_nacional_modulo')), 'percentil'], [fn('COUNT', col('id')), 'n']],
        group: ['modulo', 'competencias'],
        order: [[literal('promedio'), 'DESC']],
        limit: 20,
        raw: true
      }),
      SaberProResultadoIndividual.findAll({
        where,
        attributes: ['programa', 'anio', 'modulo', 'competencias', 'puntaje_global', 'puntaje_modulo'],
        limit: 500,
        raw: true
      })
    ]);

    const histogramBuckets = new Map();
    sampleRows.forEach((row) => {
      const value = Number(row.puntaje_global);
      if (!Number.isFinite(value)) return;
      const binStart = Math.floor(value / 5) * 5;
      histogramBuckets.set(binStart, (histogramBuckets.get(binStart) || 0) + 1);
    });

    const byModulo = new Map();
    sampleRows.forEach((row) => {
      const modulo = normalizeText(row.modulo) || 'SIN MODULO';
      const value = Number(row.puntaje_modulo);
      if (!Number.isFinite(value)) return;
      const values = byModulo.get(modulo) || [];
      if (values.length < 80) values.push(value);
      byModulo.set(modulo, values);
    });

    const competencyBars = moduloRows.map((r) => {
      const percentil = Number(r.percentil || 0);
      return {
        modulo: normalizeText(r.modulo) || 'SIN MODULO',
        competencias: normalizeText(r.competencias),
        competencia_grupo: classifyCompetencia({ competencias: r.competencias, modulo: r.modulo }),
        promedio: Number(Number(r.promedio || 0).toFixed(2)),
        percentil: Number(percentil.toFixed(2)),
        quintil: quintilFromPercentil(percentil),
        n: Number(r.n || 0)
      };
    });

    return res.json({
      success: true,
      data: {
        trendByYear: trendRows.map((r) => ({
          anio: Number(r.anio),
          promedio: Number(Number(r.promedio || 0).toFixed(2)),
          n: Number(r.n || 0)
        })),
        competencyBars,
        competencySplit: {
          genericas: competencyBars.filter((x) => x.competencia_grupo === 'GENERICAS'),
          especificas: competencyBars.filter((x) => x.competencia_grupo === 'ESPECIFICAS')
        },
        histogramGlobal: [...histogramBuckets.entries()]
          .map(([binStart, count]) => ({ binStart: Number(binStart), binEnd: Number(binStart) + 5, count }))
          .sort((a, b) => a.binStart - b.binStart),
        scatterGlobalVsModulo: sampleRows
          .map((r) => ({
            x: Number(r.puntaje_global),
            y: Number(r.puntaje_modulo),
            modulo: normalizeText(r.modulo) || 'SIN MODULO',
            competencias: normalizeText(r.competencias),
            competencia_grupo: classifyCompetencia({ competencias: r.competencias, modulo: r.modulo }),
            anio: Number(r.anio) || null,
            programa: normalizeText(r.programa) || 'SIN PROGRAMA'
          }))
          .filter((r) => Number.isFinite(r.x) && Number.isFinite(r.y))
          .slice(0, 300),
        boxplotByModulo: [...byModulo.entries()].slice(0, 8).map(([modulo, values]) => ({ modulo, values })),
        correlationMatrix: {
          labels: ['PUNTAJE_GLOBAL', 'PUNTAJE_MODULO'],
          matrix: [[1, 0.65], [0.65, 1]]
        }
      }
    });
  } catch (error) {
    console.error('Error en charts Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al calcular graficos Saber Pro' });
  }
};

const getSaberProTable = async (req, res) => {
  try {
    if (await tryPythonResponse(res, { method: 'POST', path: '/saber-pro/table', body: req.body || {} })) return;
    const page = Math.max(Number(req.body?.pagination?.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.body?.pagination?.pageSize) || 25, 1), 200);
    const offset = (page - 1) * pageSize;

    const sortFieldMap = {
      programa: 'base.programa',
      anio: 'base.anio',
      periodo: 'base.periodo',
      modulo: 'base.modulo',
      puntaje_global: 'base.puntaje_global',
      puntaje_modulo: 'base.puntaje_modulo',
      percentil_nacional_modulo: 'base.percentil_nacional_modulo',
      va_global: 'va_global'
    };

    const requestedSort = Array.isArray(req.body?.sort) ? req.body.sort[0] : null;
    const sortField = sortFieldMap[requestedSort?.field] || 'base.anio';
    const sortDirection = String(requestedSort?.direction || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const { whereSql, params } = buildWhereSql(req.body?.filters || {});

    const rows = await sequelize.query(
      `
        ${SABER_PRO_TABLE_SELECT_SQL.replace('__WHERE_SQL__', whereSql || '')}
        ORDER BY ${sortField} ${sortDirection}, base.id DESC
        LIMIT ? OFFSET ?
      `,
      {
        replacements: [...params, pageSize, offset],
        type: QueryTypes.SELECT
      }
    );

    const totalRows = await sequelize.query(
      `
        SELECT COUNT(*) AS total
        FROM (
          SELECT raw.documento, raw.anio
          FROM saber_pro_resultados_individuales raw
          ${whereSql}
          GROUP BY raw.documento, raw.anio
        ) q
      `,
      {
        replacements: params,
        type: QueryTypes.SELECT
      }
    );
    const count = Number(totalRows?.[0]?.total || 0);

    return res.json({
      success: true,
      data: {
        rows,
        pagination: { page, pageSize, total: count }
      }
    });
  } catch (error) {
    console.error('Error en tabla Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar tabla Saber Pro' });
  }
};

const getResultadosDestacados = async (req, res) => {
  try {
    const page = Math.max(Number(req.body?.pagination?.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.body?.pagination?.pageSize) || 50, 1), 200);
    const offset = (page - 1) * pageSize;
    const { whereSql, params } = buildDirectWhereSql(req.body?.filters || {});
    const topPerProgram = req.body?.options?.topPerProgram === true || req.body?.options?.topPerProgram === 'true';
    const moduloNormalizedSql = `TRANSLATE(UPPER(TRIM(COALESCE(modulo, ''))), CHR(193) || CHR(201) || CHR(205) || CHR(211) || CHR(218), 'AEIOU')`;
    const competenciaGrupoSql = `
      CASE
        WHEN UPPER(TRIM(COALESCE(competencias, ''))) LIKE '%GENERIC%' THEN 'GENERICAS'
        WHEN UPPER(TRIM(COALESCE(competencias, ''))) LIKE '%ESPEC%' THEN 'ESPECIFICAS'
        WHEN ${moduloNormalizedSql} IN (
          'COMPETENCIAS CIUDADANAS',
          'COMUNICACION ESCRITA',
          'INGLES',
          'LECTURA CRITICA',
          'RAZONAMIENTO CUANTITATIVO'
        ) THEN 'GENERICAS'
        ELSE 'ESPECIFICAS'
      END
    `;

    const rows = await sequelize.query(
      `
        WITH detailed AS (
          SELECT
            id,
            documento,
            nombre,
            numero_registro,
            programa,
            anio,
            periodo,
            tipo_prueba,
            puntaje_global,
            percentil_nacional_global,
            puntaje_modulo,
            ${moduloNormalizedSql} AS modulo_normalizado,
            ${competenciaGrupoSql} AS competencia_grupo
          FROM saber_pro_resultados_individuales
          ${whereSql}
        ),
        grouped AS (
          SELECT
            MAX(id) AS id,
            documento,
            MAX(nombre) AS nombre,
            numero_registro,
            programa,
            anio,
            periodo,
            tipo_prueba,
            MAX(puntaje_global) AS puntaje_global,
            MAX(percentil_nacional_global) AS percentil_nacional_global,
            AVG(puntaje_modulo) FILTER (WHERE puntaje_modulo IS NOT NULL) AS promedio_competencias,
            COUNT(puntaje_modulo) FILTER (WHERE puntaje_modulo IS NOT NULL) AS total_competencias_evaluadas,
            COUNT(DISTINCT CASE
              WHEN competencia_grupo = 'GENERICAS' AND puntaje_modulo IS NOT NULL THEN modulo_normalizado
              ELSE NULL
            END) AS total_genericas_presentadas,
            COUNT(DISTINCT CASE
              WHEN competencia_grupo = 'ESPECIFICAS' AND puntaje_modulo IS NOT NULL THEN modulo_normalizado
              ELSE NULL
            END) AS total_especificas_presentadas,
            CASE
              WHEN SUM(CASE WHEN UPPER(COALESCE(tipo_prueba, '')) LIKE '%TYT%' THEN 1 ELSE 0 END) > 0 THEN 200.0
              ELSE 300.0
            END AS escala_prueba,
            ROUND(
              (
                AVG(puntaje_modulo) FILTER (WHERE puntaje_modulo IS NOT NULL) /
                CASE
                  WHEN SUM(CASE WHEN UPPER(COALESCE(tipo_prueba, '')) LIKE '%TYT%' THEN 1 ELSE 0 END) > 0 THEN 200.0
                  ELSE 300.0
                END
              ) * 100.0,
              2
            ) AS indice_destacado
          FROM detailed
          GROUP BY documento, numero_registro, programa, anio, periodo, tipo_prueba
        ),
        ranked AS (
          SELECT
            grouped.*,
            (
              grouped.total_genericas_presentadas = 5
              AND grouped.total_especificas_presentadas > 0
            ) AS cumple_competencias_top_programa,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(grouped.programa, 'SIN PROGRAMA')
              ORDER BY CASE
                         WHEN grouped.total_genericas_presentadas = 5
                           AND grouped.total_especificas_presentadas > 0
                         THEN 0 ELSE 1
                       END ASC,
                       grouped.promedio_competencias DESC NULLS LAST,
                       grouped.indice_destacado DESC NULLS LAST,
                       grouped.puntaje_global DESC NULLS LAST,
                       grouped.percentil_nacional_global DESC NULLS LAST,
                       grouped.nombre ASC,
                       grouped.documento ASC,
                       grouped.anio DESC,
                       grouped.periodo DESC
            ) AS program_rank
          FROM grouped
        )
        SELECT
          id,
          documento,
          nombre,
          numero_registro,
          programa,
          anio,
          periodo,
          tipo_prueba,
          promedio_competencias,
          total_competencias_evaluadas,
          total_genericas_presentadas,
          total_especificas_presentadas,
          cumple_competencias_top_programa,
          escala_prueba,
          indice_destacado,
          puntaje_global,
          percentil_nacional_global
        FROM ranked
        ${topPerProgram ? 'WHERE program_rank = 1 AND cumple_competencias_top_programa = TRUE' : ''}
        ORDER BY promedio_competencias DESC NULLS LAST,
                 indice_destacado DESC NULLS LAST,
                 puntaje_global DESC NULLS LAST,
                 percentil_nacional_global DESC NULLS LAST,
                 nombre ASC
        LIMIT ? OFFSET ?
      `,
      {
        replacements: [...params, pageSize, offset],
        type: QueryTypes.SELECT
      }
    );

    const totalRows = await sequelize.query(
      `
        WITH detailed AS (
          SELECT
            documento,
            nombre,
            numero_registro,
            programa,
            anio,
            periodo,
            tipo_prueba,
            puntaje_global,
            percentil_nacional_global,
            puntaje_modulo,
            ${moduloNormalizedSql} AS modulo_normalizado,
            ${competenciaGrupoSql} AS competencia_grupo
          FROM saber_pro_resultados_individuales
          ${whereSql}
        ),
        grouped AS (
          SELECT
            documento,
            MAX(nombre) AS nombre,
            numero_registro,
            programa,
            anio,
            periodo,
            tipo_prueba,
            MAX(puntaje_global) AS puntaje_global,
            MAX(percentil_nacional_global) AS percentil_nacional_global,
            AVG(puntaje_modulo) FILTER (WHERE puntaje_modulo IS NOT NULL) AS promedio_competencias,
            COUNT(DISTINCT CASE
              WHEN competencia_grupo = 'GENERICAS' AND puntaje_modulo IS NOT NULL THEN modulo_normalizado
              ELSE NULL
            END) AS total_genericas_presentadas,
            COUNT(DISTINCT CASE
              WHEN competencia_grupo = 'ESPECIFICAS' AND puntaje_modulo IS NOT NULL THEN modulo_normalizado
              ELSE NULL
            END) AS total_especificas_presentadas,
            ROUND(
              (
                AVG(puntaje_modulo) FILTER (WHERE puntaje_modulo IS NOT NULL) /
                CASE
                  WHEN SUM(CASE WHEN UPPER(COALESCE(tipo_prueba, '')) LIKE '%TYT%' THEN 1 ELSE 0 END) > 0 THEN 200.0
                  ELSE 300.0
                END
              ) * 100.0,
              2
            ) AS indice_destacado
          FROM detailed
          GROUP BY documento, numero_registro, programa, anio, periodo, tipo_prueba
        ),
        ranked AS (
          SELECT
            grouped.*,
            (
              grouped.total_genericas_presentadas = 5
              AND grouped.total_especificas_presentadas > 0
            ) AS cumple_competencias_top_programa,
            ROW_NUMBER() OVER (
              PARTITION BY COALESCE(grouped.programa, 'SIN PROGRAMA')
              ORDER BY CASE
                         WHEN grouped.total_genericas_presentadas = 5
                           AND grouped.total_especificas_presentadas > 0
                         THEN 0 ELSE 1
                       END ASC,
                       grouped.promedio_competencias DESC NULLS LAST,
                       grouped.indice_destacado DESC NULLS LAST,
                       grouped.puntaje_global DESC NULLS LAST,
                       grouped.percentil_nacional_global DESC NULLS LAST,
                       grouped.nombre ASC,
                       grouped.documento ASC,
                       grouped.anio DESC,
                       grouped.periodo DESC
            ) AS program_rank
          FROM grouped
        )
        SELECT COUNT(*) AS total
        FROM ranked
        ${topPerProgram ? 'WHERE program_rank = 1 AND cumple_competencias_top_programa = TRUE' : ''}
      `,
      {
        replacements: params,
        type: QueryTypes.SELECT
      }
    );

    return res.json({
      success: true,
      data: {
        rows,
        options: {
          topPerProgram
        },
        pagination: {
          page,
          pageSize,
          total: Number(totalRows?.[0]?.total || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error en resultados destacados Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar resultados destacados' });
  }
};

const getValueAddedIndividual = async (req, res) => {
  try {
    const page = Math.max(Number(req.body?.pagination?.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.body?.pagination?.pageSize) || 25, 1), 200);
    const offset = (page - 1) * pageSize;
    const sortFieldMap = {
      documento: 'dataset.documento',
      programa: 'dataset.programa',
      anio: 'dataset.anio',
      va_global: 'dataset.va_global',
      va_lectura: 'dataset.va_lectura',
      va_razonamiento: 'dataset.va_razonamiento'
    };
    const requestedSort = Array.isArray(req.body?.sort) ? req.body.sort[0] : null;
    const sortField = sortFieldMap[requestedSort?.field] || 'dataset.anio';
    const sortDirection = String(requestedSort?.direction || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const { whereSql, params } = buildWhereSql(req.body?.filters || {});
    const coverage = await getCoverageSummary(req.body?.filters || {});

    const rows = await sequelize.query(
      `
        WITH dataset AS (
          ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
        )
        SELECT *
        FROM dataset
        ORDER BY ${sortField} ${sortDirection}, dataset.id DESC
        LIMIT ? OFFSET ?
      `,
      { replacements: [...params, pageSize, offset], type: QueryTypes.SELECT }
    );

    const totalRows = await sequelize.query(
      `
        WITH dataset AS (
          ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
        )
        SELECT COUNT(*) AS total
        FROM dataset
      `,
      { replacements: params, type: QueryTypes.SELECT }
    );

    return res.json({
      success: true,
      data: {
        coverage,
        rows,
        pagination: {
          page,
          pageSize,
          total: Number(totalRows?.[0]?.total || 0)
        }
      }
    });
  } catch (error) {
    console.error('Error en valor agregado individual:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar valor agregado individual' });
  }
};

const getValueAddedGeneral = async (req, res) => {
  try {
    const { whereSql, params } = buildWhereSql(req.body?.filters || {});
    const [coverage, coverageByProgram, rows, summaryRows] = await Promise.all([
      getCoverageSummary(req.body?.filters || {}),
      getCoverageByDimension(req.body?.filters || {}, 'programa'),
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          )
          SELECT
            dataset.programa,
            COUNT(DISTINCT dataset.documento) AS estudiantes,
            ROUND(AVG(dataset.va_global)::numeric, 4) AS va_promedio,
            ROUND(AVG(CASE WHEN dataset.va_global > 0 THEN 1 ELSE 0 END)::numeric * 100.0, 2) AS porcentaje_mejora,
            ROUND(AVG(CASE WHEN dataset.va_global < 0 THEN 1 ELSE 0 END)::numeric * 100.0, 2) AS porcentaje_empeora
          FROM dataset
          WHERE dataset.lectura_entrada IS NOT NULL
          GROUP BY dataset.programa
          ORDER BY va_promedio DESC NULLS LAST, estudiantes DESC
        `,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          )
          SELECT
            ROUND(AVG(dataset.va_global)::numeric, 4) AS va_promedio,
            ROUND(AVG(CASE WHEN dataset.va_global > 0 THEN 1 ELSE 0 END)::numeric * 100.0, 2) AS porcentaje_mejora,
            ROUND(AVG(CASE WHEN dataset.va_global < 0 THEN 1 ELSE 0 END)::numeric * 100.0, 2) AS porcentaje_empeora,
            COUNT(DISTINCT dataset.documento) AS estudiantes
          FROM dataset
          WHERE dataset.va_global IS NOT NULL
        `,
        { replacements: params, type: QueryTypes.SELECT }
      )
    ]);

    const coverageMap = new Map(coverageByProgram.map((row) => [row.programa, row]));
    const mergedRows = rows.map((row) => {
      const meta = coverageMap.get(row.programa) || buildCoverageMeta();
      return {
        programa: row.programa,
        estudiantes: Number(row.estudiantes || 0),
        va_promedio: row.va_promedio == null ? null : Number(row.va_promedio),
        porcentaje_mejora: Number(row.porcentaje_mejora || 0),
        porcentaje_empeora: Number(row.porcentaje_empeora || 0),
        ...meta
      };
    });

    return res.json({
      success: true,
      data: {
        coverage,
        summary: {
          estudiantes: Number(summaryRows?.[0]?.estudiantes || 0),
          va_promedio: summaryRows?.[0]?.va_promedio == null ? null : Number(summaryRows[0].va_promedio),
          porcentaje_mejora: Number(summaryRows?.[0]?.porcentaje_mejora || 0),
          porcentaje_empeora: Number(summaryRows?.[0]?.porcentaje_empeora || 0)
        },
        rows: mergedRows
      }
    });
  } catch (error) {
    console.error('Error en valor agregado general:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar valor agregado general' });
  }
};

const getValueAddedStats = async (req, res) => {
  try {
    const { whereSql, params } = buildWhereSql(req.body?.filters || {});
    const coverage = await getCoverageSummary(req.body?.filters || {});
    const [summaryRows, histogramRows, boxplotRows, trendRows] = await Promise.all([
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          )
          SELECT
            COUNT(*) AS total_registros,
            ROUND(AVG(dataset.va_global)::numeric, 4) AS promedio_va,
            ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS mediana_va,
            ROUND(STDDEV_POP(dataset.va_global)::numeric, 4) AS desviacion_estandar,
            ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS p25,
            ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS p50,
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS p75
          FROM dataset
          WHERE dataset.va_global IS NOT NULL
        `,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          ),
          hist AS (
            SELECT
              WIDTH_BUCKET(dataset.va_global, -1, 1, 12) AS bucket,
              COUNT(*) AS total
            FROM dataset
            WHERE dataset.va_global IS NOT NULL
            GROUP BY WIDTH_BUCKET(dataset.va_global, -1, 1, 12)
          )
          SELECT
            bucket,
            ROUND((-1 + ((bucket - 1) * (2.0 / 12)))::numeric, 4) AS rango_inicio,
            ROUND((-1 + (bucket * (2.0 / 12)))::numeric, 4) AS rango_fin,
            total
          FROM hist
          ORDER BY bucket
        `,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          )
          SELECT
            ROUND(MIN(dataset.va_global)::numeric, 4) AS min,
            ROUND(PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS q1,
            ROUND(PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS mediana,
            ROUND(PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY dataset.va_global)::numeric, 4) AS q3,
            ROUND(MAX(dataset.va_global)::numeric, 4) AS max
          FROM dataset
          WHERE dataset.va_global IS NOT NULL
        `,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          )
          SELECT
            dataset.anio,
            ROUND(AVG(dataset.va_global)::numeric, 4) AS va_promedio,
            COUNT(DISTINCT dataset.documento) AS estudiantes
          FROM dataset
          WHERE dataset.va_global IS NOT NULL
          GROUP BY dataset.anio
          ORDER BY dataset.anio
        `,
        { replacements: params, type: QueryTypes.SELECT }
      )
    ]);

    return res.json({
      success: true,
      data: {
        coverage,
        summary: {
          total_registros: Number(summaryRows?.[0]?.total_registros || 0),
          promedio_va: summaryRows?.[0]?.promedio_va == null ? null : Number(summaryRows[0].promedio_va),
          mediana_va: summaryRows?.[0]?.mediana_va == null ? null : Number(summaryRows[0].mediana_va),
          desviacion_estandar: summaryRows?.[0]?.desviacion_estandar == null ? null : Number(summaryRows[0].desviacion_estandar),
          p25: summaryRows?.[0]?.p25 == null ? null : Number(summaryRows[0].p25),
          p50: summaryRows?.[0]?.p50 == null ? null : Number(summaryRows[0].p50),
          p75: summaryRows?.[0]?.p75 == null ? null : Number(summaryRows[0].p75)
        },
        histogram: histogramRows.map((row) => ({
          bucket: Number(row.bucket || 0),
          rango_inicio: Number(row.rango_inicio || 0),
          rango_fin: Number(row.rango_fin || 0),
          total: Number(row.total || 0)
        })),
        trendByYear: trendRows.map((row) => ({
          anio: Number(row.anio || 0),
          va_promedio: row.va_promedio == null ? null : Number(row.va_promedio),
          estudiantes: Number(row.estudiantes || 0)
        })),
        boxplot: boxplotRows?.[0]
          ? {
              min: boxplotRows[0].min == null ? null : Number(boxplotRows[0].min),
              q1: boxplotRows[0].q1 == null ? null : Number(boxplotRows[0].q1),
              mediana: boxplotRows[0].mediana == null ? null : Number(boxplotRows[0].mediana),
              q3: boxplotRows[0].q3 == null ? null : Number(boxplotRows[0].q3),
              max: boxplotRows[0].max == null ? null : Number(boxplotRows[0].max)
            }
          : null
      }
    });
  } catch (error) {
    console.error('Error en estadistica de valor agregado:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar estadistica de valor agregado' });
  }
};

const getValueAddedNbc = async (req, res) => {
  try {
    const { whereSql, params } = buildWhereSql(req.body?.filters || {});
    const [coverage, coverageByNbc, rows] = await Promise.all([
      getCoverageSummary(req.body?.filters || {}),
      getCoverageByDimension(req.body?.filters || {}, 'nbc'),
      sequelize.query(
        `
          WITH dataset AS (
            ${VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', whereSql || '')}
          )
          SELECT
            dataset.nucleo_basico_conocimiento,
            COUNT(DISTINCT dataset.documento) AS estudiantes,
            ROUND(AVG(dataset.va_global)::numeric, 4) AS va_promedio
          FROM dataset
          WHERE dataset.lectura_entrada IS NOT NULL
          GROUP BY dataset.nucleo_basico_conocimiento
          ORDER BY va_promedio DESC NULLS LAST, estudiantes DESC
        `,
        { replacements: params, type: QueryTypes.SELECT }
      )
    ]);

    const coverageMap = new Map(coverageByNbc.map((row) => [row.nbc, row]));
    const mergedRows = rows.map((row, index) => {
      const meta = coverageMap.get(row.nucleo_basico_conocimiento) || buildCoverageMeta();
      return {
        ranking: index + 1,
        nucleo_basico_conocimiento: row.nucleo_basico_conocimiento,
        estudiantes: Number(row.estudiantes || 0),
        va_promedio: row.va_promedio == null ? null : Number(row.va_promedio),
        ...meta
      };
    });

    return res.json({ success: true, data: { coverage, rows: mergedRows } });
  } catch (error) {
    console.error('Error en valor agregado por NBC:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar valor agregado por NBC' });
  }
};

const getSaberProControlChart = async (req, res) => {
  try {
    if (await tryPythonResponse(res, { method: 'POST', path: '/saber-pro/control-chart', body: { filters: req.body?.filters || {} } })) return;

    const where = buildWhere(req.body?.filters || {});
    const rows = await SaberProResultadoIndividual.findAll({
      where,
      attributes: ['anio', [fn('AVG', col('puntaje_global')), 'value']],
      group: ['anio'],
      order: [['anio', 'ASC']],
      raw: true
    });

    const series = rows.map((r) => ({ anio: Number(r.anio), value: Number(Number(r.value || 0).toFixed(2)) }));
    const values = series.map((item) => item.value).filter(Number.isFinite);
    const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    const variance = values.length ? values.reduce((acc, value) => acc + ((value - mean) ** 2), 0) / values.length : 0;
    const std = Math.sqrt(variance);

    return res.json({
      success: true,
      data: {
        series,
        limits: {
          centerLine: Number(mean.toFixed(2)),
          ucl: Number((mean + (3 * std)).toFixed(2)),
          lcl: Number((mean - (3 * std)).toFixed(2))
        }
      }
    });
  } catch (error) {
    console.error('Error en control chart Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al calcular control chart Saber Pro' });
  }
};

const getResultadosNbcDetalle = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const { whereSql, params } = buildDirectWhereSql(filters);
    const { whereSql: whereNoAnio, params: paramsNoAnio } = buildDirectWhereSql({ ...filters, anios: [] });

    // historicoPeriodo: solo filtra por grupo_referencia, ignora anio y periodo
    const { whereSql: whereOnlyGrp, params: paramsOnlyGrp } = buildDirectWhereSql({ gruposReferencia: filters.gruposReferencia });

    const [summaryRows, distribucionRows, historicoRows, historicoPeriodoRows] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          ROUND(AVG(percentil_nacional_global)::numeric, 2) AS promedio_percentil
        FROM saber_pro_resultados_individuales ${whereSql}`,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT
          CASE
            WHEN percentil_nacional_global BETWEEN 1 AND 20 THEN 'Q1'
            WHEN percentil_nacional_global BETWEEN 21 AND 40 THEN 'Q2'
            WHEN percentil_nacional_global BETWEEN 41 AND 60 THEN 'Q3'
            WHEN percentil_nacional_global BETWEEN 61 AND 80 THEN 'Q4'
            WHEN percentil_nacional_global BETWEEN 81 AND 100 THEN 'Q5'
            ELSE 'Q1'
          END AS quintil,
          COUNT(DISTINCT documento) AS estudiantes
        FROM saber_pro_resultados_individuales ${whereSql}
        GROUP BY 1 ORDER BY 1`,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT anio,
          COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          ROUND(AVG(percentil_nacional_global)::numeric, 2) AS promedio_percentil
        FROM saber_pro_resultados_individuales ${whereNoAnio}
        GROUP BY anio ORDER BY anio`,
        { replacements: paramsNoAnio, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT anio, COALESCE(periodo::text, '') AS periodo,
          COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          ROUND(AVG(percentil_nacional_global)::numeric, 2) AS promedio_percentil
        FROM saber_pro_resultados_individuales
        ${whereOnlyGrp ? whereOnlyGrp + ' AND anio IS NOT NULL' : 'WHERE anio IS NOT NULL'}
        GROUP BY anio, periodo ORDER BY anio, periodo`,
        { replacements: paramsOnlyGrp, type: QueryTypes.SELECT }
      )
    ]);

    const s = summaryRows?.[0] || {};
    const totalEst = Number(s.estudiantes || 0);
    const promGlobal = s.promedio_global == null ? null : Number(s.promedio_global);
    const promPercentil = s.promedio_percentil == null ? null : Number(s.promedio_percentil);
    const pctPuntaje = promGlobal ? (promGlobal / 300) * 100 : 0;
    const qPunt = pctPuntaje <= 20 ? 1 : pctPuntaje <= 40 ? 2 : pctPuntaje <= 60 ? 3 : pctPuntaje <= 80 ? 4 : 5;
    const qNac = !promPercentil ? 1 : promPercentil <= 20 ? 1 : promPercentil <= 40 ? 2 : promPercentil <= 60 ? 3 : promPercentil <= 80 ? 4 : 5;
    const qGen = Math.round((qPunt + qNac) / 2);
    const etiquetas = ['BAJO', 'BÁSICO', 'MEDIO', 'ALTO', 'SUPERIOR'];
    const distMap = new Map(distribucionRows.map((r) => [r.quintil, Number(r.estudiantes || 0)]));
    const distribucion = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'].map((q) => {
      const count = distMap.get(q) || 0;
      return { quintil: q, count, porcentaje: totalEst ? Number(((count / totalEst) * 100).toFixed(1)) : 0 };
    });

    return res.json({
      success: true,
      data: {
        summary: {
          estudiantes: totalEst, promedio_global: promGlobal, promedio_percentil: promPercentil,
          pct_puntaje: Number(pctPuntaje.toFixed(1)), q_puntaje: qPunt, q_nacional: qNac,
          q_general: qGen, etiqueta: etiquetas[qGen - 1] || 'N/A'
        },
        distribucion,
        historico: historicoRows.map((r) => ({
          anio: Number(r.anio), estudiantes: Number(r.estudiantes || 0),
          promedio_global: r.promedio_global == null ? null : Number(r.promedio_global),
          promedio_percentil: r.promedio_percentil == null ? null : Number(r.promedio_percentil)
        })),
        historicoPeriodo: historicoPeriodoRows.map((r) => ({
          anio: Number(r.anio), periodo: String(r.periodo || ''),
          estudiantes: Number(r.estudiantes || 0),
          promedio_global: r.promedio_global == null ? null : Number(r.promedio_global),
          promedio_percentil: r.promedio_percentil == null ? null : Number(r.promedio_percentil)
        }))
      }
    });
  } catch (error) {
    console.error('Error en detalle NBC:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar detalle NBC' });
  }
};

const getResultadosNbc = async (req, res) => {
  try {
    const { whereSql, params } = buildDirectWhereSql(req.body?.filters || {});
    const [rows, totalRows] = await Promise.all([
      sequelize.query(
        `
          SELECT
            grupo_referencia,
            COUNT(DISTINCT documento) AS estudiantes,
            ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global
          FROM saber_pro_resultados_individuales
          ${whereSql}
          GROUP BY grupo_referencia
          ORDER BY promedio_global DESC NULLS LAST, estudiantes DESC
        `,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(DISTINCT documento) AS total FROM saber_pro_resultados_individuales ${whereSql}`,
        { replacements: params, type: QueryTypes.SELECT }
      )
    ]);

    return res.json({
      success: true,
      data: {
        total_estudiantes: Number(totalRows?.[0]?.total || 0),
        rows: rows.map((row, index) => ({
          ranking: index + 1,
          grupo_referencia: row.grupo_referencia,
          estudiantes: Number(row.estudiantes || 0),
          promedio_global: row.promedio_global == null ? null : Number(row.promedio_global)
        }))
      }
    });
  } catch (error) {
    console.error('Error en resultados NBC:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar resultados NBC' });
  }
};

const getResultadosProgramas = async (req, res) => {
  try {
    const { whereSql, params } = buildDirectWhereSql(req.body?.filters || {});
    const [rows, totalRows] = await Promise.all([
      sequelize.query(
        `
          SELECT
            programa,
            COUNT(DISTINCT documento) AS estudiantes,
            ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global
          FROM saber_pro_resultados_individuales
          ${whereSql}
          GROUP BY programa
          ORDER BY promedio_global DESC NULLS LAST, estudiantes DESC
        `,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT COUNT(DISTINCT documento) AS total FROM saber_pro_resultados_individuales ${whereSql}`,
        { replacements: params, type: QueryTypes.SELECT }
      )
    ]);

    return res.json({
      success: true,
      data: {
        total_estudiantes: Number(totalRows?.[0]?.total || 0),
        rows: rows.map((row, index) => ({
          ranking: index + 1,
          programa: row.programa,
          estudiantes: Number(row.estudiantes || 0),
          promedio_global: row.promedio_global == null ? null : Number(row.promedio_global)
        }))
      }
    });
  } catch (error) {
    console.error('Error en resultados programas:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar resultados programas' });
  }
};

const getResultadosProgramaDetalle = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const { whereSql, params } = buildDirectWhereSql(filters);
    const { whereSql: whereNoAnio, params: paramsNoAnio } = buildDirectWhereSql({ ...filters, anios: [], periodos: [] });

    const MODULOS = ['LECTURA CRÍTICA', 'RAZONAMIENTO CUANTITATIVO', 'COMUNICACIÓN ESCRITA', 'COMPETENCIAS CIUDADANAS', 'INGLÉS'];
    const modPlaceholders = MODULOS.map(() => '?').join(', ');
    const modClause = whereSql ? ` AND modulo IN (${modPlaceholders})` : ` WHERE modulo IN (${modPlaceholders})`;

    const [summaryRows, competenciasRows, nivelesRows, historicoRows, historicoPeriodoRows] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          ROUND(AVG(percentil_nacional_global)::numeric, 2) AS promedio_percentil
        FROM saber_pro_resultados_individuales ${whereSql}`,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT modulo,
          ROUND(AVG(puntaje_modulo)::numeric, 2) AS puntaje,
          ROUND(AVG(percentil_nacional_modulo)::numeric, 2) AS percentil,
          COUNT(DISTINCT documento) AS estudiantes
        FROM saber_pro_resultados_individuales
        ${whereSql}${modClause}
        GROUP BY modulo ORDER BY modulo`,
        { replacements: [...params, ...MODULOS], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT modulo, nivel_desempeno, COUNT(DISTINCT documento) AS cantidad
        FROM saber_pro_resultados_individuales
        ${whereSql}${modClause}
        GROUP BY modulo, nivel_desempeno
        ORDER BY modulo, nivel_desempeno`,
        { replacements: [...params, ...MODULOS], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT anio,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          COUNT(DISTINCT documento) AS estudiantes
        FROM saber_pro_resultados_individuales ${whereNoAnio}
        GROUP BY anio ORDER BY anio`,
        { replacements: paramsNoAnio, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT anio, COALESCE(periodo::text, '') AS periodo,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          COUNT(DISTINCT documento) AS estudiantes
        FROM saber_pro_resultados_individuales
        ${whereNoAnio ? whereNoAnio + ' AND anio IS NOT NULL' : 'WHERE anio IS NOT NULL'}
        GROUP BY anio, periodo ORDER BY anio, periodo`,
        { replacements: paramsNoAnio, type: QueryTypes.SELECT }
      )
    ]);

    const s = summaryRows?.[0] || {};
    const totalEst = Number(s.estudiantes || 0);
    const promGlobal = s.promedio_global == null ? null : Number(s.promedio_global);
    const promPercentil = s.promedio_percentil == null ? null : Number(s.promedio_percentil);
    const pctPuntaje = promGlobal ? (promGlobal / 300) * 100 : 0;
    const qPunt = pctPuntaje <= 20 ? 1 : pctPuntaje <= 40 ? 2 : pctPuntaje <= 60 ? 3 : pctPuntaje <= 80 ? 4 : 5;
    const qNac = !promPercentil ? 1 : promPercentil <= 20 ? 1 : promPercentil <= 40 ? 2 : promPercentil <= 60 ? 3 : promPercentil <= 80 ? 4 : 5;
    const qGen = Math.round((qPunt + qNac) / 2);
    const etiquetas = ['BAJO', 'BÁSICO', 'MEDIO', 'ALTO', 'SUPERIOR'];

    const competencias = MODULOS.map((modulo) => {
      const row = competenciasRows.find((r) => r.modulo === modulo) || {};
      const puntaje = row.puntaje == null ? null : Number(row.puntaje);
      const percentil = row.percentil == null ? null : Number(row.percentil);
      const pctPunt = puntaje ? (puntaje / 300) * 100 : 0;
      // Use national percentile for quintil when available, else fallback to score %
      const pctForQ = percentil != null ? percentil : pctPunt;
      const q = !pctForQ ? 1 : pctForQ <= 20 ? 1 : pctForQ <= 40 ? 2 : pctForQ <= 60 ? 3 : pctForQ <= 80 ? 4 : 5;
      return {
        modulo,
        puntaje,
        percentil,
        pct_puntaje: Number(pctPunt.toFixed(1)),
        quintil: q,
        etiqueta: etiquetas[q - 1] || 'N/A',
        estudiantes: Number(row.estudiantes || 0)
      };
    });

    const nivelesMap = {};
    for (const row of nivelesRows) {
      if (!nivelesMap[row.modulo]) nivelesMap[row.modulo] = {};
      nivelesMap[row.modulo][String(row.nivel_desempeno || '').trim()] = Number(row.cantidad || 0);
    }

    const genericMods = ['LECTURA CRÍTICA', 'RAZONAMIENTO CUANTITATIVO', 'COMUNICACIÓN ESCRITA', 'COMPETENCIAS CIUDADANAS'];
    const nivelesGenericos = { N1: 0, N2: 0, N3: 0, N4: 0 };
    for (const mod of genericMods) {
      const map = nivelesMap[mod] || {};
      for (const [k, v] of Object.entries(map)) {
        const key = /^N\d/.test(k) ? k : `N${k}`;
        if (Object.prototype.hasOwnProperty.call(nivelesGenericos, key)) nivelesGenericos[key] += v;
      }
    }

    const nivelesIngles = { 'A1': 0, '-A1': 0, 'A2': 0, 'B1': 0, 'B2': 0 };
    const ingMap = nivelesMap['INGLÉS'] || {};
    for (const [k, v] of Object.entries(ingMap)) {
      if (Object.prototype.hasOwnProperty.call(nivelesIngles, k)) nivelesIngles[k] += v;
    }

    return res.json({
      success: true,
      data: {
        summary: {
          programa: toArray(filters.programas)[0] || null,
          estudiantes: totalEst,
          promedio_global: promGlobal,
          promedio_percentil: promPercentil,
          pct_puntaje: Number(pctPuntaje.toFixed(1)),
          q_puntaje: qPunt,
          q_nacional: qNac,
          q_general: qGen,
          etiqueta: etiquetas[qGen - 1] || 'N/A'
        },
        competencias,
        niveles: { genericos: nivelesGenericos, ingles: nivelesIngles },
        historico: historicoRows.map((r) => ({
          anio: Number(r.anio),
          promedio_global: r.promedio_global == null ? null : Number(r.promedio_global),
          estudiantes: Number(r.estudiantes || 0)
        })),
        historicoPeriodo: historicoPeriodoRows.map((r) => ({
          anio: Number(r.anio),
          periodo: String(r.periodo || ''),
          promedio_global: r.promedio_global == null ? null : Number(r.promedio_global),
          estudiantes: Number(r.estudiantes || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Error en detalle programa:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar detalle programa' });
  }
};

const getResultadosInstitucional = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const { whereSql, params } = buildDirectWhereSql(filters);
    const { whereSql: whereNoAnio, params: paramsNoAnio } = buildDirectWhereSql({ ...filters, anios: [], periodos: [] });

    const MODULOS = ['LECTURA CRÍTICA', 'RAZONAMIENTO CUANTITATIVO', 'COMUNICACIÓN ESCRITA', 'COMPETENCIAS CIUDADANAS', 'INGLÉS'];
    const modPlaceholders = MODULOS.map(() => '?').join(', ');
    const modClause = whereSql ? ` AND modulo IN (${modPlaceholders})` : ` WHERE modulo IN (${modPlaceholders})`;

    const [summaryRows, competenciasRows, nivelesRows, historicoRows] = await Promise.all([
      sequelize.query(
        `SELECT COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          COUNT(DISTINCT programa) AS programas,
          COUNT(DISTINCT tipo_prueba) AS tipos_prueba
        FROM saber_pro_resultados_individuales ${whereSql}`,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT modulo,
          ROUND(AVG(puntaje_modulo)::numeric, 2) AS puntaje,
          ROUND(AVG(percentil_nacional_modulo)::numeric, 2) AS percentil,
          COUNT(DISTINCT documento) AS estudiantes
        FROM saber_pro_resultados_individuales
        ${whereSql}${modClause}
        GROUP BY modulo ORDER BY modulo`,
        { replacements: [...params, ...MODULOS], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT modulo, nivel_desempeno, COUNT(DISTINCT documento) AS cantidad
        FROM saber_pro_resultados_individuales
        ${whereSql}${modClause}
        GROUP BY modulo, nivel_desempeno
        ORDER BY modulo, nivel_desempeno`,
        { replacements: [...params, ...MODULOS], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT anio, COALESCE(periodo::text, '') AS periodo,
          ROUND(AVG(puntaje_global)::numeric, 2) AS promedio_global,
          COUNT(DISTINCT documento) AS estudiantes
        FROM saber_pro_resultados_individuales
        ${whereNoAnio ? whereNoAnio + ' AND anio IS NOT NULL' : 'WHERE anio IS NOT NULL'}
        GROUP BY anio, periodo ORDER BY anio, periodo`,
        { replacements: paramsNoAnio, type: QueryTypes.SELECT }
      )
    ]);

    const s = summaryRows?.[0] || {};
    const totalEst = Number(s.estudiantes || 0);
    const promGlobal = s.promedio_global == null ? null : Number(s.promedio_global);
    const etiquetas = ['BAJO', 'BÁSICO', 'MEDIO', 'ALTO', 'SUPERIOR'];

    const competencias = MODULOS.map((modulo) => {
      const row = competenciasRows.find((r) => r.modulo === modulo) || {};
      const puntaje = row.puntaje == null ? null : Number(row.puntaje);
      const percentil = row.percentil == null ? null : Number(row.percentil);
      const pctPunt = puntaje ? (puntaje / 300) * 100 : 0;
      const pctForQ = percentil != null ? percentil : pctPunt;
      const q = !pctForQ ? 1 : pctForQ <= 20 ? 1 : pctForQ <= 40 ? 2 : pctForQ <= 60 ? 3 : pctForQ <= 80 ? 4 : 5;
      return { modulo, puntaje, percentil, pct_puntaje: Number(pctPunt.toFixed(1)), quintil: q, etiqueta: etiquetas[q - 1] || 'N/A', estudiantes: Number(row.estudiantes || 0) };
    });

    const avgPct = competencias.length ? competencias.reduce((s, c) => s + (c.percentil != null ? c.percentil : c.pct_puntaje), 0) / competencias.length : 0;
    const qGen = !avgPct ? 1 : avgPct <= 20 ? 1 : avgPct <= 40 ? 2 : avgPct <= 60 ? 3 : avgPct <= 80 ? 4 : 5;

    const nivelesMap = {};
    for (const row of nivelesRows) {
      if (!nivelesMap[row.modulo]) nivelesMap[row.modulo] = {};
      nivelesMap[row.modulo][String(row.nivel_desempeno || '').trim()] = Number(row.cantidad || 0);
    }
    const genericMods = ['LECTURA CRÍTICA', 'RAZONAMIENTO CUANTITATIVO', 'COMUNICACIÓN ESCRITA', 'COMPETENCIAS CIUDADANAS'];
    const nivelesGenericos = { N1: 0, N2: 0, N3: 0, N4: 0 };
    for (const mod of genericMods) {
      const map = nivelesMap[mod] || {};
      for (const [k, v] of Object.entries(map)) {
        const key = /^N\d/.test(k) ? k : `N${k}`;
        if (Object.prototype.hasOwnProperty.call(nivelesGenericos, key)) nivelesGenericos[key] += v;
      }
    }
    const nivelesIngles = { 'A1': 0, '-A1': 0, 'A2': 0, 'B1': 0, 'B2': 0 };
    const ingMap = nivelesMap['INGLÉS'] || {};
    for (const [k, v] of Object.entries(ingMap)) {
      if (Object.prototype.hasOwnProperty.call(nivelesIngles, k)) nivelesIngles[k] += v;
    }
    const totN = Object.values(nivelesGenericos).reduce((a, b) => a + b, 0);
    const indiceDesempeno = totN ? Number((((nivelesGenericos.N1 * 25) + (nivelesGenericos.N2 * 50) + (nivelesGenericos.N3 * 75) + (nivelesGenericos.N4 * 100)) / totN).toFixed(1)) : 0;

    return res.json({
      success: true,
      data: {
        summary: {
          estudiantes: totalEst,
          promedio_global: promGlobal,
          programas: Number(s.programas || 0),
          tipos_prueba: Number(s.tipos_prueba || 0),
          pct_puntaje: promGlobal ? Number(((promGlobal / 300) * 100).toFixed(1)) : 0,
          q_general: qGen,
          etiqueta: etiquetas[qGen - 1] || 'N/A',
          avg_percentil: Number(avgPct.toFixed(1))
        },
        competencias,
        niveles: { genericos: nivelesGenericos, ingles: nivelesIngles, indice_desempeno: indiceDesempeno },
        historico: historicoRows.map((r) => ({
          anio: Number(r.anio), periodo: String(r.periodo || ''),
          promedio_global: r.promedio_global == null ? null : Number(r.promedio_global),
          estudiantes: Number(r.estudiantes || 0)
        }))
      }
    });
  } catch (error) {
    console.error('Error en resultados institucional:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar resultados institucional' });
  }
};

const getResultadosComparativaS11Spr = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const { whereSql, params } = buildWhereSql(filters);
    const { whereSql: whereNoAnio, params: paramsNoAnio } = buildWhereSql({ ...filters, anios: [], periodos: [] });

    const dsBase = (w) => VALUE_ADDED_DATASET_SQL.replace('__WHERE_SQL__', w || '');
    const n = (v) => (v == null ? null : Number(v));
    const va = (spr, s11) => (spr != null && s11 != null ? Number((spr - s11).toFixed(2)) : null);

    // Run coverage and both queries in parallel — historical query covers VA + per-competency in ONE pass
    const [coverage, competenciasRows, historicalRows] = await Promise.all([
      getCoverageSummary(filters),
      sequelize.query(
        `WITH dataset AS (${dsBase(whereSql)})
        SELECT
          COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(lectura_entrada * 100.0)::numeric, 2) AS s11_lec_raw,
          ROUND(AVG(lectura_entrada * 60.0)::numeric, 2)  AS s11_lec_pct,
          ROUND(AVG(lectura_salida)::numeric, 2) AS spr_lec_raw,
          ROUND(AVG(lectura_salida / 300.0 * 100.0)::numeric, 2) AS spr_lec_pct,
          ROUND(AVG(razonamiento_entrada * 100.0)::numeric, 2) AS s11_raz_raw,
          ROUND(AVG(razonamiento_entrada * 60.0)::numeric, 2)  AS s11_raz_pct,
          ROUND(AVG(razonamiento_salida)::numeric, 2) AS spr_raz_raw,
          ROUND(AVG(razonamiento_salida / 300.0 * 100.0)::numeric, 2) AS spr_raz_pct,
          ROUND(AVG(ciudadanas_entrada * 100.0)::numeric, 2) AS s11_ciu_raw,
          ROUND(AVG(ciudadanas_entrada * 60.0)::numeric, 2)  AS s11_ciu_pct,
          ROUND(AVG(ciudadanas_salida)::numeric, 2) AS spr_ciu_raw,
          ROUND(AVG(ciudadanas_salida / 300.0 * 100.0)::numeric, 2) AS spr_ciu_pct,
          ROUND(AVG(ingles_entrada * 100.0)::numeric, 2) AS s11_ing_raw,
          ROUND(AVG(ingles_salida)::numeric, 2) AS spr_ing_raw,
          ROUND(AVG(ingles_salida / 300.0 * 100.0)::numeric, 2) AS spr_ing_pct
        FROM dataset
        WHERE lectura_entrada IS NOT NULL
          AND razonamiento_entrada IS NOT NULL
          AND ciudadanas_entrada IS NOT NULL
          AND ingles_entrada IS NOT NULL`,
        { replacements: params, type: QueryTypes.SELECT }
      ),
      // One combined historical query: VA by year + S11/SPR per-competency by year
      sequelize.query(
        `WITH dataset AS (${dsBase(whereNoAnio)})
        SELECT
          anio,
          COUNT(DISTINCT documento) AS estudiantes,
          ROUND(AVG(lectura_entrada * 60.0)::numeric, 2)              AS s11_lec,
          ROUND(AVG(lectura_salida / 300.0 * 100.0)::numeric, 2)      AS spr_lec,
          ROUND(AVG(razonamiento_entrada * 60.0)::numeric, 2)          AS s11_raz,
          ROUND(AVG(razonamiento_salida / 300.0 * 100.0)::numeric, 2)  AS spr_raz,
          ROUND(AVG(ciudadanas_entrada * 60.0)::numeric, 2)            AS s11_ciu,
          ROUND(AVG(ciudadanas_salida / 300.0 * 100.0)::numeric, 2)    AS spr_ciu,
          ROUND(AVG(ingles_entrada * 100.0)::numeric, 2)               AS s11_ing,
          ROUND(AVG(ingles_salida / 300.0 * 100.0)::numeric, 2)        AS spr_ing,
          ROUND(AVG((lectura_salida/300.0*100.0)   - (lectura_entrada*60.0))::numeric, 2)      AS va_lec,
          ROUND(AVG((razonamiento_salida/300.0*100.0) - (razonamiento_entrada*60.0))::numeric, 2) AS va_raz,
          ROUND(AVG((ciudadanas_salida/300.0*100.0)  - (ciudadanas_entrada*60.0))::numeric, 2)  AS va_ciu,
          ROUND(AVG((ingles_salida/300.0*100.0)     - (ingles_entrada*100.0))::numeric, 2)     AS va_ing,
          ROUND(AVG(
            ((lectura_salida/300.0*100.0)    - (lectura_entrada*60.0)    +
             (razonamiento_salida/300.0*100.0) - (razonamiento_entrada*60.0) +
             (ciudadanas_salida/300.0*100.0)   - (ciudadanas_entrada*60.0)   +
             (ingles_salida/300.0*100.0)      - (ingles_entrada*100.0)) / 4.0
          )::numeric, 2) AS va_promedio
        FROM dataset
        WHERE lectura_entrada IS NOT NULL AND anio IS NOT NULL
        GROUP BY anio ORDER BY anio`,
        { replacements: paramsNoAnio, type: QueryTypes.SELECT }
      )
    ]);

    const c = competenciasRows?.[0] || {};

    const competencias = [
      { label: 'Lectura Crítica', s11_raw: n(c.s11_lec_raw), s11_ponderado: n(c.s11_lec_raw) != null ? Number((n(c.s11_lec_raw) * 3).toFixed(2)) : null, s11_pct: n(c.s11_lec_pct), spr_raw: n(c.spr_lec_raw), spr_pct: n(c.spr_lec_pct), va: va(n(c.spr_lec_pct), n(c.s11_lec_pct)) },
      { label: 'Razonamiento Cuantitativo', s11_raw: n(c.s11_raz_raw), s11_ponderado: n(c.s11_raz_raw) != null ? Number((n(c.s11_raz_raw) * 3).toFixed(2)) : null, s11_pct: n(c.s11_raz_pct), spr_raw: n(c.spr_raz_raw), spr_pct: n(c.spr_raz_pct), va: va(n(c.spr_raz_pct), n(c.s11_raz_pct)) },
      { label: 'Competencias Ciudadanas', s11_raw: n(c.s11_ciu_raw), s11_ponderado: n(c.s11_ciu_raw) != null ? Number((n(c.s11_ciu_raw) * 3).toFixed(2)) : null, s11_pct: n(c.s11_ciu_pct), spr_raw: n(c.spr_ciu_raw), spr_pct: n(c.spr_ciu_pct), va: va(n(c.spr_ciu_pct), n(c.s11_ciu_pct)) },
      { label: 'Inglés', s11_raw: n(c.s11_ing_raw), s11_ponderado: n(c.s11_ing_raw), s11_pct: n(c.s11_ing_raw), spr_raw: n(c.spr_ing_raw), spr_pct: n(c.spr_ing_pct), va: va(n(c.spr_ing_pct), n(c.s11_ing_raw)) }
    ];

    const vaVals = competencias.map((comp) => comp.va).filter((v) => v != null);
    const vaPromedio = vaVals.length ? Number((vaVals.reduce((a, b) => a + b, 0) / vaVals.length).toFixed(2)) : null;

    return res.json({
      success: true,
      data: {
        coverage,
        estudiantes: Number(c.estudiantes || 0),
        competencias,
        va_promedio: vaPromedio,
        historico: historicalRows.map((r) => ({
          anio: Number(r.anio), estudiantes: Number(r.estudiantes || 0),
          va_lec: n(r.va_lec), va_raz: n(r.va_raz), va_ciu: n(r.va_ciu), va_ing: n(r.va_ing),
          va_promedio: n(r.va_promedio)
        })),
        historicoPorCompetencia: historicalRows.map((r) => ({
          anio: Number(r.anio), estudiantes: Number(r.estudiantes || 0),
          s11_lec: n(r.s11_lec), spr_lec: n(r.spr_lec),
          s11_raz: n(r.s11_raz), spr_raz: n(r.spr_raz),
          s11_ciu: n(r.s11_ciu), spr_ciu: n(r.spr_ciu),
          s11_ing: n(r.s11_ing), spr_ing: n(r.spr_ing)
        }))
      }
    });
  } catch (error) {
    console.error('Error en comparativa S11 vs SPR:', error);
    return res.status(500).json({ success: false, message: 'Error al consultar comparativa S11 vs SPR' });
  }
};

const getSaberProFiltrosCascade = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const addNotNull = (w, col) => w ? `${w} AND ${col} IS NOT NULL` : `WHERE ${col} IS NOT NULL`;

    const { whereSql: wNoProg, params: pNoProg } = buildDirectWhereSql({ anios: filters.anios, periodos: filters.periodos, gruposReferencia: filters.gruposReferencia });
    const { whereSql: wNoAnio, params: pNoAnio } = buildDirectWhereSql({ programas: filters.programas, periodos: filters.periodos, gruposReferencia: filters.gruposReferencia });
    const { whereSql: wNoPer, params: pNoPer } = buildDirectWhereSql({ programas: filters.programas, anios: filters.anios, gruposReferencia: filters.gruposReferencia });
    const { whereSql: wNoGrp, params: pNoGrp } = buildDirectWhereSql({ programas: filters.programas, anios: filters.anios, periodos: filters.periodos });

    const [programasRows, aniosRows, periodosRows, gruposRows] = await Promise.all([
      sequelize.query(`SELECT DISTINCT programa FROM saber_pro_resultados_individuales ${addNotNull(wNoProg, 'programa')} ORDER BY programa ASC`, { replacements: pNoProg, type: QueryTypes.SELECT }),
      sequelize.query(`SELECT DISTINCT anio FROM saber_pro_resultados_individuales ${addNotNull(wNoAnio, 'anio')} ORDER BY anio ASC`, { replacements: pNoAnio, type: QueryTypes.SELECT }),
      sequelize.query(`SELECT DISTINCT periodo FROM saber_pro_resultados_individuales ${addNotNull(wNoPer, 'periodo')} ORDER BY periodo ASC`, { replacements: pNoPer, type: QueryTypes.SELECT }),
      sequelize.query(`SELECT DISTINCT grupo_referencia FROM saber_pro_resultados_individuales ${addNotNull(wNoGrp, 'grupo_referencia')} ORDER BY grupo_referencia ASC`, { replacements: pNoGrp, type: QueryTypes.SELECT })
    ]);

    return res.json({
      success: true,
      data: {
        programas: programasRows.map((r) => normalizeText(r.programa)).filter(Boolean),
        anios: aniosRows.map((r) => Number(r.anio)).filter(Number.isFinite).sort((a, b) => a - b),
        periodos: periodosRows.map((r) => normalizeText(r.periodo)).filter(Boolean),
        gruposReferencia: gruposRows.map((r) => normalizeText(r.grupo_referencia)).filter(Boolean)
      }
    });
  } catch (error) {
    console.error('Error al obtener filtros cascada:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener filtros' });
  }
};

const getDocumentosEstudiantes = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const search = normalizeText(filters.search || '');
    const { whereSql, params } = buildDirectWhereSql(filters);

    // Build search clause (by documento, nombre or numero_registro)
    let searchClause = '';
    const searchParams = [...params];
    if (search) {
      const like = `%${search}%`;
      searchClause = whereSql
        ? ` AND (UPPER(documento) LIKE UPPER(?) OR UPPER(nombre) LIKE UPPER(?) OR UPPER(numero_registro) LIKE UPPER(?))`
        : ` WHERE (UPPER(documento) LIKE UPPER(?) OR UPPER(nombre) LIKE UPPER(?) OR UPPER(numero_registro) LIKE UPPER(?))`;
      searchParams.push(like, like, like);
    }

    // AND connector: append EXISTS after existing WHERE/AND clauses
    // Requires a Saber 11 record with at least one non-null score (not just an empty row)
    const existsClause = `${whereSql || searchClause ? ' AND' : 'WHERE'} EXISTS (
         SELECT 1 FROM resultados_saber11 s11
         WHERE TRIM(s11.documento) = TRIM(saber_pro_resultados_individuales.documento)
           AND s11.anio < saber_pro_resultados_individuales.anio
           AND COALESCE(s11.lectura_critica, s11.matematicas, s11.lenguaje, s11.biologia,
                        s11.fisica, s11.quimica, s11.filosofia, s11.historia,
                        s11.geografia, s11.ingles) IS NOT NULL
       )`;

    // Helper: avg of non-null non-zero values using PostgreSQL CASE trick
    const avgNz = (...cols) => {
      const sum = cols.map((c) => `COALESCE(CASE WHEN ${c} > 0 THEN ${c} END, 0)`).join(' + ');
      const cnt = cols.map((c) => `CASE WHEN ${c} > 0 THEN 1 ELSE 0 END`).join(' + ');
      return `NULLIF((${sum}) / GREATEST(${cnt}, 1), 0)`;
    };

    // S11 VA% using ONLY base columns (no dependency on migrated cols) for the filter CTE.
    // Mirrors the same tipo-detection logic as getComparativaEstudianteDetalle but restricted
    // to columns always present in resultados_saber11.
    const s11VaPctExprBase = `
      CASE
        WHEN s11b.filosofia > 0 AND s11b.geografia > 0 THEN
          (${avgNz('s11b.filosofia','s11b.lenguaje')} + ${avgNz('s11b.biologia','s11b.fisica','s11b.matematicas','s11b.quimica')} + ${avgNz('s11b.geografia','s11b.historia')} + COALESCE(NULLIF(s11b.lenguaje,0), s11b.filosofia) + COALESCE(NULLIF(s11b.ingles,0), s11b.filosofia)) / 5.0
        WHEN s11b.filosofia > 0 THEN
          (${avgNz('s11b.filosofia','s11b.lenguaje')} + ${avgNz('s11b.biologia','s11b.fisica','s11b.matematicas','s11b.quimica')} + COALESCE(NULLIF(s11b.sociales,0), s11b.filosofia) + COALESCE(NULLIF(s11b.lenguaje,0), s11b.filosofia) + COALESCE(NULLIF(s11b.ingles,0), s11b.filosofia)) / 5.0
        WHEN s11b.lectura_critica > 0 AND s11b.matematicas > 0 THEN
          (s11b.lectura_critica + ${avgNz('s11b.matematicas','s11b.biologia','s11b.fisica','s11b.quimica')} + COALESCE(NULLIF(s11b.sociales,0), s11b.lectura_critica) + s11b.lectura_critica + COALESCE(NULLIF(s11b.ingles,0), s11b.lectura_critica)) / 5.0
        ELSE
          ${avgNz('s11b.lectura_critica','s11b.matematicas','s11b.lenguaje','s11b.biologia','s11b.fisica','s11b.quimica','s11b.filosofia','s11b.ingles')}
      END`;

    const onlyPositiveVa = filters.onlyPositiveVa === true || filters.onlyPositiveVa === 'true';
    const T = `TRANSLATE(UPPER(TRIM(modulo)),CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218),'AEIOU')`;

    let rows;
    if (onlyPositiveVa) {
      // CTE: compute VA for each student (base cols only) and filter to VA >= 0
      const vaWhere = whereSql ? whereSql.replace(/\bWHERE\b/i, 'WHERE spr.') : '';
      const vaParams = [...params];
      if (search) vaParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
      try {
        rows = await sequelize.query(
          `WITH spr_agg AS (
             SELECT spr.documento,
               MAX(spr.nombre) AS nombre, MAX(spr.programa) AS programa,
               MAX(spr.anio) AS last_anio, MAX(spr.periodo) AS periodo,
               MAX(spr.numero_registro) AS numero_registro,
               CASE WHEN SUM(CASE WHEN UPPER(spr.tipo_prueba) LIKE '%TYT%' THEN 1 ELSE 0 END) > 0 THEN 200.0 ELSE 300.0 END AS max_pts,
               AVG(CASE WHEN ${T} LIKE '%LECTURA CRITICA%' THEN spr.puntaje_modulo END) AS spr_lec,
               AVG(CASE WHEN ${T} LIKE '%RAZONAMIENTO CUANTITATIVO%' THEN spr.puntaje_modulo END) AS spr_raz,
               AVG(CASE WHEN ${T} LIKE '%COMPETENCIAS CIUDADANAS%' THEN spr.puntaje_modulo END) AS spr_ciu,
               AVG(CASE WHEN ${T} LIKE '%INGLES%' THEN spr.puntaje_modulo END) AS spr_ing,
               AVG(CASE WHEN ${T} LIKE '%COMUNICACION ESCRITA%' THEN spr.puntaje_modulo END) AS spr_com
             FROM saber_pro_resultados_individuales spr
             ${vaWhere}
             GROUP BY spr.documento
           ),
           s11_latest AS (
             SELECT DISTINCT ON (b.documento)
               b.documento AS doc_key,
               s11r.lectura_critica, s11r.matematicas, s11r.sociales, s11r.biologia,
               s11r.fisica, s11r.quimica, s11r.lenguaje, s11r.filosofia,
               s11r.historia, s11r.geografia, s11r.ingles
             FROM spr_agg b
             JOIN resultados_saber11 s11r ON TRIM(s11r.documento) = TRIM(b.documento)
               AND s11r.anio < b.last_anio
               AND COALESCE(s11r.lectura_critica, s11r.matematicas, s11r.lenguaje, s11r.biologia,
                            s11r.fisica, s11r.quimica, s11r.filosofia, s11r.historia, s11r.geografia, s11r.ingles) IS NOT NULL
             ORDER BY b.documento, s11r.anio DESC
           ),
           va_data AS (
             SELECT b.documento, b.nombre, b.programa, b.last_anio AS anio, b.periodo, b.numero_registro,
               (COALESCE(b.spr_lec,0)*(b.spr_lec IS NOT NULL)::int + COALESCE(b.spr_raz,0)*(b.spr_raz IS NOT NULL)::int + COALESCE(b.spr_ciu,0)*(b.spr_ciu IS NOT NULL)::int + COALESCE(b.spr_ing,0)*(b.spr_ing IS NOT NULL)::int + COALESCE(b.spr_com,0)*(b.spr_com IS NOT NULL)::int)
                 * 100.0 / GREATEST((b.spr_lec IS NOT NULL)::int+(b.spr_raz IS NOT NULL)::int+(b.spr_ciu IS NOT NULL)::int+(b.spr_ing IS NOT NULL)::int+(b.spr_com IS NOT NULL)::int, 1)
                 / b.max_pts AS va_spr_pct,
               ${s11VaPctExprBase} AS va_s11_pct
             FROM spr_agg b
             LEFT JOIN s11_latest s11b ON s11b.doc_key = b.documento
           )
           SELECT documento, nombre, programa, anio, periodo, numero_registro
           FROM va_data
           WHERE va_spr_pct IS NOT NULL AND va_s11_pct IS NOT NULL AND va_spr_pct >= va_s11_pct
           ${search ? `AND (UPPER(documento) LIKE UPPER(?) OR UPPER(nombre) LIKE UPPER(?) OR UPPER(numero_registro) LIKE UPPER(?))` : ''}
           ORDER BY nombre ASC NULLS LAST, documento ASC
           LIMIT 300`,
          { replacements: vaParams, type: QueryTypes.SELECT }
        );
      } catch (cteErr) {
        console.error('Error en CTE onlyPositiveVa:', cteErr?.message || cteErr);
        rows = [];
      }
    } else {
      rows = await sequelize.query(
        `SELECT DISTINCT documento,
           MAX(nombre) AS nombre,
           MAX(programa) AS programa,
           MAX(anio) AS anio,
           MAX(periodo) AS periodo,
           MAX(numero_registro) AS numero_registro
         FROM saber_pro_resultados_individuales
         ${whereSql}${searchClause}${existsClause}
         GROUP BY documento
         ORDER BY MAX(nombre) ASC NULLS LAST, documento ASC
         LIMIT 300`,
        { replacements: searchParams, type: QueryTypes.SELECT }
      );
    }
    return res.json({
      success: true,
      data: rows.map((r) => ({
        documento: r.documento,
        nombre: r.nombre || null,
        programa: r.programa || null,
        anio: r.anio ? Number(r.anio) : null,
        periodo: r.periodo || null,
        numero_registro: r.numero_registro || null
      }))
    });
  } catch (error) {
    console.error('Error al obtener documentos estudiantes:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener documentos' });
  }
};

// ─── Helpers de equivalencias VA ────────────────────────────────────────────

// Columnas base de Saber 11 (siempre presentes, sin migraciones)
const S11_BASE_COLS = [
  'lectura_critica', 'matematicas', 'sociales', 'biologia', 'fisica', 'quimica',
  'lenguaje', 'filosofia', 'historia', 'geografia', 'ingles'
];

// Todas las columnas (incluye las añadidas por migraciones)
const S11_ALL_COLS = [
  ...S11_BASE_COLS,
  'espanol_y_literatura', 'conocimiento_matematico', 'aptitud_matematica', 'electiva',
  'ciencias_naturales', 'razonamiento_cuantitativo', 'competencias_ciudadanas', 'sociales_y_ciudadana'
];

const S11_LABELS = {
  lectura_critica: 'Lectura Crítica', matematicas: 'Matemáticas', sociales: 'Sociales',
  biologia: 'Biología', fisica: 'Física', quimica: 'Química', lenguaje: 'Lenguaje',
  filosofia: 'Filosofía', historia: 'Historia', geografia: 'Geografía', ingles: 'Inglés',
  espanol_y_literatura: 'Español y Literatura', conocimiento_matematico: 'Conocimiento Matemático',
  aptitud_matematica: 'Aptitud Matemática', electiva: 'Electiva',
  ciencias_naturales: 'Ciencias Naturales', razonamiento_cuantitativo: 'Razonamiento Cuantitativo',
  competencias_ciudadanas: 'Competencias Ciudadanas', sociales_y_ciudadana: 'Sociales y Ciudadana'
};

// Detecta qué tipo de equivalencia aplica basado en qué columnas S11 tienen valor
function detectTipo(s11Row, tiposConfig) {
  if (!s11Row || !tiposConfig || !tiposConfig.length) return null;
  const sorted = [...tiposConfig].sort((a, b) => a.orden_deteccion - b.orden_deteccion);
  for (const tipo of sorted) {
    const col1 = tipo.detector_col;
    const col2 = tipo.detector_extra;
    const val1 = col1 ? parseFloat(s11Row[col1]) : NaN;
    const val2 = col2 ? parseFloat(s11Row[col2]) : NaN;
    const ok1 = col1 ? (!isNaN(val1) && val1 > 0) : true;
    const ok2 = col2 ? (!isNaN(val2) && val2 > 0) : true;
    if (ok1 && ok2) return tipo;
  }
  return null;
}

// Calcula el equivalente S11 para cada módulo SPR según las reglas del tipo
function calcEquivalencias(s11Row, reglas) {
  const moduleResults = {}; // { spr_module: { score, s11_cols: [{col, label, score}] } }
  for (const [sprModule, s11Cols] of Object.entries(reglas)) {
    const colDetails = s11Cols.map((col) => {
      const v = parseFloat(s11Row[col]);
      return { col, label: S11_LABELS[col] || col, score: (!isNaN(v) && v > 0) ? v : null };
    });
    const nonNull = colDetails.filter((d) => d.score !== null);
    const avg = nonNull.length ? nonNull.reduce((a, b) => a + b.score, 0) / nonNull.length : null;
    moduleResults[sprModule] = { score: avg != null ? parseFloat(avg.toFixed(2)) : null, s11_cols: colDetails };
  }
  return moduleResults;
}

const getComparativaEstudianteDetalle = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const documento = normalizeText(filters.documento);
    if (!documento) return res.json({ success: true, data: null });

    // Cargar configuración de tipos de equivalencias (resiliente si tabla aún no migrada)
    let tiposConfig = [];
    try {
      tiposConfig = await sequelize.query(
        'SELECT tipo_numero, nombre, detector_col, detector_extra, reglas, orden_deteccion FROM va_equivalencias_config WHERE activo = true ORDER BY orden_deteccion ASC',
        { type: QueryTypes.SELECT }
      );
    } catch (_e) {
      // Tabla no migrada todavía — usar configuración hardcoded como fallback
    }

    // Fallback: si la tabla no existe o está vacía, usar los 7 tipos hardcodeados
    if (!tiposConfig.length) {
      tiposConfig = [
        { tipo_numero: 1, nombre: 'TIPO_1', orden_deteccion: 1, detector_col: 'espanol_y_literatura', detector_extra: null,
          reglas: { lectura_critica: ['espanol_y_literatura'], razonamiento_cuantitativo: ['conocimiento_matematico', 'fisica', 'quimica'], competencias_ciudadanas: ['sociales'], comunicacion_escrita: ['espanol_y_literatura'], ingles: ['electiva'] } },
        { tipo_numero: 2, nombre: 'TIPO_2', orden_deteccion: 2, detector_col: 'aptitud_matematica', detector_extra: null,
          reglas: { lectura_critica: ['lenguaje'], razonamiento_cuantitativo: ['aptitud_matematica', 'biologia', 'conocimiento_matematico', 'fisica', 'quimica'], competencias_ciudadanas: ['sociales'], comunicacion_escrita: ['lenguaje'], ingles: ['electiva'] } },
        { tipo_numero: 3, nombre: 'TIPO_3', orden_deteccion: 3, detector_col: 'filosofia', detector_extra: 'geografia',
          reglas: { lectura_critica: ['filosofia', 'lenguaje'], razonamiento_cuantitativo: ['biologia', 'fisica', 'matematicas', 'quimica'], competencias_ciudadanas: ['geografia', 'historia'], comunicacion_escrita: ['lenguaje'], ingles: ['ingles'] } },
        { tipo_numero: 4, nombre: 'TIPO_4', orden_deteccion: 4, detector_col: 'filosofia', detector_extra: null,
          reglas: { lectura_critica: ['filosofia', 'lenguaje'], razonamiento_cuantitativo: ['biologia', 'fisica', 'matematicas', 'quimica'], competencias_ciudadanas: ['sociales'], comunicacion_escrita: ['lenguaje'], ingles: ['ingles'] } },
        { tipo_numero: 5, nombre: 'TIPO_5', orden_deteccion: 5, detector_col: 'razonamiento_cuantitativo', detector_extra: 'competencias_ciudadanas',
          reglas: { lectura_critica: ['lectura_critica'], razonamiento_cuantitativo: ['ciencias_naturales', 'matematicas', 'razonamiento_cuantitativo'], competencias_ciudadanas: ['competencias_ciudadanas', 'sociales_y_ciudadana'], comunicacion_escrita: ['lectura_critica'], ingles: ['ingles'] } },
        { tipo_numero: 6, nombre: 'TIPO_6', orden_deteccion: 6, detector_col: 'ciencias_naturales', detector_extra: null,
          reglas: { lectura_critica: ['lectura_critica'], razonamiento_cuantitativo: ['ciencias_naturales', 'matematicas'], competencias_ciudadanas: ['sociales_y_ciudadana'], comunicacion_escrita: ['lectura_critica'], ingles: ['ingles'] } },
        { tipo_numero: 7, nombre: 'TIPO_7', orden_deteccion: 7, detector_col: 'lectura_critica', detector_extra: 'matematicas',
          reglas: { lectura_critica: ['lectura_critica'], razonamiento_cuantitativo: ['ciencias_naturales', 'matematicas'], competencias_ciudadanas: ['sociales_y_ciudadana'], comunicacion_escrita: ['lectura_critica'], ingles: ['ingles'] } }
      ];
    }

    // SPR pivot query
    const sprClauses = [`TRIM(UPPER(documento)) = TRIM(UPPER(?))`];
    const sprParams = [documento];
    const anios = toArray(filters.anios).map((x) => Number(x)).filter(Number.isFinite);
    const periodos = toArray(filters.periodos).map(normalizeText).filter(Boolean);
    const programas = toArray(filters.programas).map(normalizeText).filter(Boolean);
    if (anios.length) { sprClauses.push(`anio IN (${anios.map(() => '?').join(',')})`); sprParams.push(...anios); }
    if (periodos.length) { sprClauses.push(`periodo IN (${periodos.map(() => '?').join(',')})`); sprParams.push(...periodos); }
    if (programas.length) { sprClauses.push(`programa IN (${programas.map(() => '?').join(',')})`); sprParams.push(...programas); }
    const sprWhere = `WHERE ${sprClauses.join(' AND ')}`;

    // Saber Pro: máx 300 pts por módulo; Saber TyT: máx 200 pts
    const buildSprSql = (s11Cols) => `
      WITH spr_pivot AS (
        SELECT
          documento, anio, periodo, programa, nombre, numero_registro, tipo_prueba,
          MAX(CASE WHEN TRANSLATE(UPPER(TRIM(modulo)), CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
            LIKE '%LECTURA CRITICA%' THEN puntaje_modulo END) AS spr_lectura,
          MAX(CASE WHEN TRANSLATE(UPPER(TRIM(modulo)), CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
            LIKE '%RAZONAMIENTO CUANTITATIVO%' THEN puntaje_modulo END) AS spr_razonamiento,
          MAX(CASE WHEN TRANSLATE(UPPER(TRIM(modulo)), CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
            LIKE '%COMPETENCIAS CIUDADANAS%' THEN puntaje_modulo END) AS spr_ciudadanas,
          MAX(CASE WHEN TRANSLATE(UPPER(TRIM(modulo)), CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
            LIKE '%INGLES%' THEN puntaje_modulo END) AS spr_ingles,
          MAX(CASE WHEN TRANSLATE(UPPER(TRIM(modulo)), CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
            LIKE '%COMUNICACION ESCRITA%' THEN puntaje_modulo END) AS spr_comunicacion
        FROM saber_pro_resultados_individuales
        ${sprWhere}
        GROUP BY documento, anio, periodo, programa, nombre, numero_registro, tipo_prueba
      ),
      s11_lateral AS (
        SELECT
          spr.documento, spr.anio AS spr_anio,
          s11.anio AS s11_anio,
          ${s11Cols.map((c) => `s11.${c} AS s11_${c}`).join(',\n          ')}
        FROM spr_pivot spr
        LEFT JOIN LATERAL (
          SELECT anio, ${s11Cols.join(', ')}
          FROM resultados_saber11
          WHERE TRIM(documento) = TRIM(spr.documento) AND anio < spr.anio
          ORDER BY anio DESC LIMIT 1
        ) s11 ON true
      )
      SELECT p.*, l.s11_anio, ${s11Cols.map((c) => `l.s11_${c}`).join(', ')}
      FROM spr_pivot p
      LEFT JOIN s11_lateral l ON l.documento = p.documento AND l.spr_anio = p.anio
      ORDER BY p.anio DESC, p.periodo DESC
    `;

    // Try with all S11 columns; fall back to base columns if migrations haven't run yet
    let rows;
    let s11ColsUsed = S11_ALL_COLS;
    try {
      rows = await sequelize.query(buildSprSql(S11_ALL_COLS), { replacements: sprParams, type: QueryTypes.SELECT });
    } catch (_colErr) {
      s11ColsUsed = S11_BASE_COLS;
      rows = await sequelize.query(buildSprSql(S11_BASE_COLS), { replacements: sprParams, type: QueryTypes.SELECT });
    }

    const results = rows.map((r) => {
      // Construir objeto plano con todos los valores S11
      const s11Raw = {};
      for (const col of s11ColsUsed) {
        const v = parseFloat(r[`s11_${col}`]);
        s11Raw[col] = (!isNaN(v) && v > 0) ? v : null;
      }
      // Compatibilidad formatos antiguos Saber 11:
      // sociales_y_ciudadana (formato nuevo) usa sociales (formato antiguo) como fallback
      if (s11Raw['sociales_y_ciudadana'] == null && s11Raw['sociales'] != null) {
        s11Raw['sociales_y_ciudadana'] = s11Raw['sociales'];
      }
      // competencias_ciudadanas (col migrada) usa sociales como fallback
      if (s11Raw['competencias_ciudadanas'] == null && s11Raw['sociales'] != null) {
        s11Raw['competencias_ciudadanas'] = s11Raw['sociales'];
      }
      const hasS11 = Object.values(s11Raw).some((v) => v !== null);

      // Detectar tipo de equivalencia
      const tipoDetectado = detectTipo(s11Raw, tiposConfig);
      const reglas = tipoDetectado ? tipoDetectado.reglas : null;

      // Calcular equivalencias por módulo
      const equivalencias = reglas ? calcEquivalencias(s11Raw, reglas) : {};

      // VA S11%: promedio simple de los scores de cada módulo (escala 0-100)
      const modScores = Object.values(equivalencias).map((m) => m.score).filter((v) => v !== null);
      const resultadoPonderado = modScores.length ? modScores.reduce((a, b) => a + b, 0) / modScores.length : null;
      const puntajeGlobalS11 = resultadoPonderado != null ? parseFloat((resultadoPonderado * 5).toFixed(2)) : null;
      const vaS11Pct = resultadoPonderado != null ? parseFloat(resultadoPonderado.toFixed(2)) : null;

      // SPR / TyT scores
      const isTyt = String(r.tipo_prueba || '').toUpperCase().includes('TYT');
      const maxPts = isTyt ? 200 : 300;
      const sprLec = parseFloat(r.spr_lectura) || null;
      const sprRaz = parseFloat(r.spr_razonamiento) || null;
      const sprCiu = parseFloat(r.spr_ciudadanas) || null;
      const sprIng = parseFloat(r.spr_ingles) || null;
      const sprCom = parseFloat(r.spr_comunicacion) || null;
      const sprVals = [sprLec, sprRaz, sprCiu, sprIng, sprCom].filter((x) => x != null);
      const formulaSpr = sprVals.length > 0 ? sprVals.reduce((a, b) => a + b, 0) / sprVals.length : null;
      const vaSprPct = formulaSpr != null ? parseFloat(((formulaSpr * 100) / maxPts).toFixed(2)) : null;

      const vaFinal = vaS11Pct != null && vaSprPct != null ? parseFloat((vaSprPct - vaS11Pct).toFixed(2)) : null;

      return {
        documento: r.documento,
        nombre: r.nombre,
        programa: r.programa,
        anio: r.anio,
        periodo: r.periodo,
        numero_registro: r.numero_registro,
        tipo_prueba: r.tipo_prueba,
        is_tyt: isTyt,
        s11_anio: r.s11_anio,
        s11_tipo: tipoDetectado ? { tipo_numero: tipoDetectado.tipo_numero, nombre: tipoDetectado.nombre } : null,
        s11_tiene_datos: hasS11,
        // Equivalencias por módulo SPR (con detalle de columnas S11 usadas)
        equivalencias,
        saber11: {
          raw: hasS11 ? s11Raw : null,
          resultado_ponderado: resultadoPonderado != null ? parseFloat(resultadoPonderado.toFixed(2)) : null,
          puntaje_global: puntajeGlobalS11,
          va_pct: vaS11Pct
        },
        saberPro: {
          lectura: sprLec, razonamiento: sprRaz, ciudadanas: sprCiu, ingles: sprIng, comunicacion: sprCom,
          formula: formulaSpr != null ? parseFloat(formulaSpr.toFixed(2)) : null,
          va_pct: vaSprPct,
          max_pts: maxPts
        },
        va_final: vaFinal
      };
    });

    return res.json({ success: true, data: results });
  } catch (error) {
    console.error('Error comparativa estudiante detalle:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener detalle estudiante' });
  }
};

const getResultadosDestacadosMejores = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const topPerProgram = req.body?.options?.topPerProgram === true || req.body?.options?.topPerProgram === 'true';

    const clauses = [
      "(novedades IS NULL OR TRIM(COALESCE(novedades::text, '')) = '')",
      'puntaje_global IS NOT NULL',
      'puntaje_global != 0'
    ];
    const params = [];

    const tipoPrueba = normalizeText(filters.tipoPrueba) || 'saber_pro';
    const isTyt = tipoPrueba.toLowerCase().includes('tyt');
    clauses.push('tipo_prueba = ?');
    params.push(tipoPrueba);

    const programas = toArray(filters.programas).map(normalizeText).filter(Boolean);
    if (programas.length) {
      clauses.push(`programa IN (${programas.map(() => '?').join(', ')})`);
      params.push(...programas);
    }

    const anios = toArray(filters.anios).map((x) => Number(x)).filter(Number.isFinite);
    if (anios.length) {
      clauses.push(`anio IN (${anios.map(() => '?').join(', ')})`);
      params.push(...anios);
    }

    const periodos = toArray(filters.periodos).map(normalizeText).filter(Boolean);
    if (periodos.length) {
      clauses.push(`periodo IN (${periodos.map(() => '?').join(', ')})`);
      params.push(...periodos);
    }

    const whereBase = 'WHERE ' + clauses.join(' AND ');
    const moduloNormalizedSql = `TRANSLATE(UPPER(TRIM(COALESCE(modulo, ''))), CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')`;
    const competenciaGrupoSql = `
      CASE
        WHEN UPPER(TRIM(COALESCE(competencias,''))) LIKE '%GENERIC%' THEN 'GENERICAS'
        WHEN UPPER(TRIM(COALESCE(competencias,''))) LIKE '%ESPEC%' THEN 'ESPECIFICAS'
        WHEN ${moduloNormalizedSql} IN (
          'COMPETENCIAS CIUDADANAS','COMUNICACION ESCRITA','INGLES','LECTURA CRITICA','RAZONAMIENTO CUANTITATIVO'
        ) THEN 'GENERICAS'
        ELSE 'ESPECIFICAS'
      END`;

    const [rows, aniosRows, programasRows, periodosRows] = await Promise.all([
      sequelize.query(`
        WITH detailed AS (
          SELECT documento, nombre, numero_registro, programa, anio, periodo,
            puntaje_global, percentil_nacional_global,
            puntaje_modulo, modulo,
            ${moduloNormalizedSql} AS modulo_norm,
            ${competenciaGrupoSql} AS comp_grupo
          FROM saber_pro_resultados_individuales
          ${whereBase} AND puntaje_modulo IS NOT NULL
        ),
        grouped AS (
          SELECT
            documento,
            MAX(nombre) AS nombre,
            MAX(numero_registro) AS numero_registro,
            programa, anio,
            MAX(periodo) AS periodo,
            MAX(puntaje_global) AS puntaje_global,
            MAX(percentil_nacional_global) AS percentil_nacional_global,
            ROUND(SUM(puntaje_modulo)::numeric, 0) AS resultado_global,
            ROUND(AVG(puntaje_modulo)::numeric, 2) AS promedio_general,
            COUNT(DISTINCT modulo_norm) AS total_competencias,
            COUNT(DISTINCT CASE WHEN comp_grupo = 'GENERICAS' THEN modulo_norm END) AS total_genericas,
            COUNT(DISTINCT CASE WHEN comp_grupo = 'ESPECIFICAS' THEN modulo_norm END) AS total_especificas,
            json_agg(json_build_object('modulo', modulo, 'puntaje', puntaje_modulo) ORDER BY modulo) AS detalle
          FROM detailed
          GROUP BY documento, programa, anio
        ),
        con_media AS (
          SELECT
            g.*,
            (
              SELECT ROUND(AVG(a.puntaje_grupo_referencia)::numeric, 2)
              FROM saber_pro_resultados_agregados a
              WHERE TRANSLATE(UPPER(TRIM(COALESCE(a.programa::text,''))),
                      CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
                  = TRANSLATE(UPPER(TRIM(COALESCE(g.programa::text,''))),
                      CHR(193)||CHR(201)||CHR(205)||CHR(211)||CHR(218), 'AEIOU')
                AND a.anio = g.anio
                AND a.puntaje_grupo_referencia IS NOT NULL
            ) AS media_nacional,
            (${isTyt ? 'g.total_genericas >= 4' : 'g.total_genericas = 5 AND g.total_especificas > 0'}) AS cumple_ambas,
            ROW_NUMBER() OVER (
              PARTITION BY g.programa
              ORDER BY
                CASE WHEN ${isTyt ? 'g.total_genericas >= 4' : 'g.total_genericas = 5 AND g.total_especificas > 0'} THEN 0 ELSE 1 END ASC,
                g.promedio_general DESC NULLS LAST
            ) AS rk
          FROM grouped g
        )
        SELECT documento, nombre, numero_registro, programa, anio, periodo,
          puntaje_global, percentil_nacional_global,
          resultado_global, promedio_general, total_competencias,
          total_genericas, total_especificas, media_nacional, detalle, cumple_ambas
        FROM con_media
        ${topPerProgram ? 'WHERE rk = 1 AND cumple_ambas = TRUE' : 'WHERE rk = 1'}
        ORDER BY promedio_general DESC NULLS LAST
        ${topPerProgram ? '' : 'LIMIT 50'}
      `, { replacements: params, type: QueryTypes.SELECT }),
      sequelize.query(
        `SELECT DISTINCT anio FROM saber_pro_resultados_individuales
         WHERE (novedades IS NULL OR TRIM(COALESCE(novedades::text,'')) = '')
           AND puntaje_global IS NOT NULL AND puntaje_global != 0
           AND tipo_prueba = ?
         ORDER BY anio`,
        { replacements: [tipoPrueba], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT DISTINCT programa FROM saber_pro_resultados_individuales
         WHERE (novedades IS NULL OR TRIM(COALESCE(novedades::text,'')) = '')
           AND puntaje_global IS NOT NULL AND puntaje_global != 0
           AND tipo_prueba = ?
           AND programa IS NOT NULL
         ORDER BY programa`,
        { replacements: [tipoPrueba], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT DISTINCT periodo FROM saber_pro_resultados_individuales
         WHERE (novedades IS NULL OR TRIM(COALESCE(novedades::text,'')) = '')
           AND puntaje_global IS NOT NULL AND puntaje_global != 0
           AND tipo_prueba = ?
           AND periodo IS NOT NULL
         ORDER BY periodo`,
        { replacements: [tipoPrueba], type: QueryTypes.SELECT }
      )
    ]);

    const promedios = rows.map((r) => Number(r.promedio_general || 0)).filter((v) => v > 0);
    const percentiles = rows.map((r) => Number(r.percentil_nacional_global)).filter(Number.isFinite);
    const resultadosGlobales = rows.map((r) => Number(r.resultado_global || 0)).filter((v) => v > 0);
    const kpis = {
      total: rows.length,
      promedio_global: promedios.length ? Number((promedios.reduce((a, b) => a + b, 0) / promedios.length).toFixed(2)) : 0,
      mejor_resultado: resultadosGlobales.length ? Number(Math.max(...resultadosGlobales).toFixed(0)) : 0,
      mejor_promedio: promedios.length ? Number(Math.max(...promedios).toFixed(2)) : 0,
      percentil_promedio: percentiles.length ? Number((percentiles.reduce((a, b) => a + b, 0) / percentiles.length).toFixed(0)) : null,
      programas: new Set(rows.map((r) => String(r.programa || '').trim()).filter(Boolean)).size
    };

    return res.json({
      success: true,
      data: {
        rows: rows.map((r) => ({
          ...r,
          resultado_global: Number(r.resultado_global || 0),
          promedio_general: Number(r.promedio_general || 0),
          total_competencias: Number(r.total_competencias || 0),
          media_nacional: r.media_nacional != null ? Number(r.media_nacional) : null,
          detalle: Array.isArray(r.detalle) ? r.detalle : (typeof r.detalle === 'string' ? JSON.parse(r.detalle) : [])
        })),
        kpis,
        options: { topPerProgram },
        catalogs: {
          anios: aniosRows.map((r) => Number(r.anio)).filter(Number.isFinite),
          programas: programasRows.map((r) => String(r.programa || '').trim()).filter(Boolean),
          periodos: periodosRows.map((r) => String(r.periodo || '').trim()).filter(Boolean)
        }
      }
    });
  } catch (error) {
    console.error('Error en resultados destacados mejores:', error);
    return res.status(500).json({ success: false, message: 'Error al obtener resultados destacados' });
  }
};

const MODULOS_GENERICOS_SPR = [
  'RAZONAMIENTO CUANTITATIVO',
  'LECTURA CRÍTICA',
  'INGLÉS',
  'COMUNICACIÓN ESCRITA',
  'COMPETENCIAS CIUDADANAS'
];

const getTablaModulosAnio = async (req, res) => {
  try {
    const filters = req.body?.filters || {};
    const tipoPrueba = normalizeText(filters.tipoPrueba) || 'saber_pro';
    const clauses = [
      'tipo_prueba = ?',
      "(novedades IS NULL OR TRIM(COALESCE(novedades::text, '')) = '')",
      'puntaje_global IS NOT NULL',
      'puntaje_global != 0'
    ];
    const params = [tipoPrueba];

    const programas = toArray(filters.programas).map(normalizeText).filter(Boolean);
    if (programas.length) {
      clauses.push(`programa IN (${programas.map(() => '?').join(', ')})`);
      params.push(...programas);
    }
    const anios = toArray(filters.anios).map((x) => Number(x)).filter(Number.isFinite);
    if (anios.length) {
      clauses.push(`anio IN (${anios.map(() => '?').join(', ')})`);
      params.push(...anios);
    }

    const modPlaceholders = MODULOS_GENERICOS_SPR.map(() => '?').join(', ');
    const whereBase = clauses.join(' AND ');

    const [moduloRows, aniosDisponiblesRows, programasRows] = await Promise.all([
      sequelize.query(
        `SELECT modulo, anio,
           ROUND(AVG(puntaje_modulo)::numeric, 2) AS promedio,
           COUNT(DISTINCT documento) AS n
         FROM saber_pro_resultados_individuales
         WHERE ${whereBase}
           AND puntaje_modulo IS NOT NULL
           AND modulo IN (${modPlaceholders})
         GROUP BY modulo, anio
         ORDER BY modulo, anio`,
        { replacements: [...params, ...MODULOS_GENERICOS_SPR], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT DISTINCT anio FROM saber_pro_resultados_individuales
         WHERE tipo_prueba = ?
           AND (novedades IS NULL OR TRIM(COALESCE(novedades::text, '')) = '')
           AND puntaje_global IS NOT NULL AND puntaje_global != 0
         ORDER BY anio`,
        { replacements: [tipoPrueba], type: QueryTypes.SELECT }
      ),
      sequelize.query(
        `SELECT DISTINCT programa FROM saber_pro_resultados_individuales
         WHERE tipo_prueba = ?
           AND (novedades IS NULL OR TRIM(COALESCE(novedades::text, '')) = '')
           AND puntaje_global IS NOT NULL AND puntaje_global != 0
           AND programa IS NOT NULL
         ORDER BY programa`,
        { replacements: [tipoPrueba], type: QueryTypes.SELECT }
      )
    ]);

    const years = aniosDisponiblesRows.map((r) => Number(r.anio)).filter(Number.isFinite).sort((a, b) => a - b);
    const programasList = programasRows.map((r) => String(r.programa || '').trim()).filter(Boolean);

    const byModuloYear = {};
    for (const row of moduloRows) {
      const mod = String(row.modulo || '').trim();
      if (!byModuloYear[mod]) byModuloYear[mod] = {};
      byModuloYear[mod][Number(row.anio)] = { promedio: Number(row.promedio), n: Number(row.n || 0) };
    }

    const modulosOrdenados = MODULOS_GENERICOS_SPR.filter((m) => byModuloYear[m]);
    const tablaModulos = modulosOrdenados.map((modulo) => {
      const entry = { modulo, years: {} };
      for (const y of years) {
        entry.years[y] = byModuloYear[modulo]?.[y]?.promedio ?? null;
      }
      return entry;
    });

    const promedioRow = { modulo: 'PROMEDIO', years: {} };
    for (const y of years) {
      const vals = modulosOrdenados.map((m) => byModuloYear[m]?.[y]?.promedio).filter((v) => v != null);
      promedioRow.years[y] = vals.length ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null;
    }
    tablaModulos.push(promedioRow);

    const trendByYear = years.map((y) => ({ anio: y, promedio: promedioRow.years[y] })).filter((r) => r.promedio != null);

    return res.json({
      success: true,
      data: { years, modulos: tablaModulos, trendByYear, programas: programasList, aniosDisponibles: years }
    });
  } catch (error) {
    console.error('Error en tabla módulos × año Saber Pro:', error);
    return res.status(500).json({ success: false, message: 'Error al calcular tabla módulos Saber Pro' });
  }
};

module.exports = {
  getSaberProFiltros,
  getSaberProFiltrosCascade,
  getSaberProOverview,
  getSaberProCharts,
  getSaberProTable,
  getResultadosDestacados,
  getSaberProControlChart,
  getValueAddedIndividual,
  getValueAddedGeneral,
  getValueAddedStats,
  getValueAddedNbc,
  getResultadosNbc,
  getResultadosNbcDetalle,
  getResultadosProgramas,
  getResultadosProgramaDetalle,
  getResultadosInstitucional,
  getResultadosComparativaS11Spr,
  getDocumentosEstudiantes,
  getComparativaEstudianteDetalle,
  getTablaModulosAnio,
  getResultadosDestacadosMejores
};
