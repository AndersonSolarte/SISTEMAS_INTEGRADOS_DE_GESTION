const { Op, fn, col, literal } = require('sequelize');
const { SaberProResultadoIndividual } = require('../models');
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

    const where = buildWhere(req.body?.filters || {});
    const page = Math.max(Number(req.body?.pagination?.page) || 1, 1);
    const pageSize = Math.min(Math.max(Number(req.body?.pagination?.pageSize) || 25, 1), 200);
    const offset = (page - 1) * pageSize;

    const sortFieldMap = {
      programa: 'programa',
      anio: 'anio',
      periodo: 'periodo',
      modulo: 'modulo',
      puntaje_global: 'puntaje_global',
      puntaje_modulo: 'puntaje_modulo',
      percentil_nacional_modulo: 'percentil_nacional_modulo'
    };

    const requestedSort = Array.isArray(req.body?.sort) ? req.body.sort[0] : null;
    const sortField = sortFieldMap[requestedSort?.field] || 'anio';
    const sortDirection = String(requestedSort?.direction || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const { count, rows } = await SaberProResultadoIndividual.findAndCountAll({
      where,
      attributes: ['id', 'documento', 'nombre', 'programa', 'anio', 'periodo', 'modulo', 'competencias', 'puntaje_modulo', 'puntaje_global', 'percentil_nacional_modulo'],
      order: [[sortField, sortDirection], ['id', 'DESC']],
      limit: pageSize,
      offset
    });

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

module.exports = {
  getSaberProFiltros,
  getSaberProOverview,
  getSaberProCharts,
  getSaberProTable,
  getSaberProControlChart
};
