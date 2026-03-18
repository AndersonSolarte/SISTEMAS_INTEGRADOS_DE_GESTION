require('dotenv').config();
const { Op } = require('sequelize');
const { sequelize, testConnection } = require('../../config/database');
const {
  PoblacionalMatriculado,
  RefDepartamento,
  RefMunicipio,
  MatriculadosUbicacionIncidencia
} = require('../../models');

const BATCH_SIZE = 2000;

const stripDiacritics = (value = '') =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const normalizeText = (value = '') =>
  stripDiacritics(String(value || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isColombia = (pais = '') => {
  const token = normalizeText(pais);
  return !token || token === 'COLOMBIA' || token === 'REPUBLICA DE COLOMBIA';
};

const DEPARTAMENTO_ALIASES = new Map([
  ['BOGOTA D C', '11'],
  ['BOGOTA DC', '11'],
  ['BOGOTA', '11'],
  ['ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA', '88']
]);

const MUNICIPIO_ALIASES_BY_DEPTO = new Map([
  ['76|CALI', 'SANTIAGO DE CALI'],
  ['11|BOGOTA', 'BOGOTA D C'],
  ['11|BOGOTA DC', 'BOGOTA D C'],
  ['11|BOGOTA D C', 'BOGOTA D C']
]);

const diceCoefficient = (a = '', b = '') => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i += 1) {
    const bi = a.slice(i, i + 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i += 1) {
    const bi = b.slice(i, i + 2);
    const count = bigrams.get(bi) || 0;
    if (count > 0) {
      bigrams.set(bi, count - 1);
      intersection += 1;
    }
  }
  return (2 * intersection) / ((a.length - 1) + (b.length - 1));
};

const getBestFuzzy = (target, candidates = []) => {
  let best = null;
  candidates.forEach((c) => {
    const score = diceCoefficient(target, c.key);
    if (!best || score > best.score) best = { ...c, score };
  });
  return best;
};

const run = async () => {
  await testConnection();

  const departamentos = await RefDepartamento.findAll({
    where: { activo: true },
    attributes: ['codigo_dane', 'nombre_normalizado'],
    raw: true
  });
  const municipios = await RefMunicipio.findAll({
    where: { activo: true },
    attributes: ['codigo_dane', 'codigo_departamento', 'nombre_normalizado'],
    raw: true
  });

  const deptByName = new Map();
  const deptFuzzy = [];
  departamentos.forEach((d) => {
    const key = normalizeText(d.nombre_normalizado);
    if (key) deptByName.set(key, d.codigo_dane);
    deptFuzzy.push({ key, codigo_dane: d.codigo_dane });
  });

  const muniByDeptAndName = new Map();
  const muniFuzzyByDept = new Map();
  municipios.forEach((m) => {
    const keyName = normalizeText(m.nombre_normalizado);
    const key = `${m.codigo_departamento}|${keyName}`;
    muniByDeptAndName.set(key, m.codigo_dane);
    if (!muniFuzzyByDept.has(m.codigo_departamento)) muniFuzzyByDept.set(m.codigo_departamento, []);
    muniFuzzyByDept.get(m.codigo_departamento).push({ key: keyName, codigo_dane: m.codigo_dane });
  });

  await MatriculadosUbicacionIncidencia.destroy({ where: {}, truncate: true });

  let lastId = 0;
  let updated = 0;
  let exact = 0;
  let fuzzy = 0;
  let unresolved = 0;

  while (true) {
    const rows = await PoblacionalMatriculado.findAll({
      where: { id: { [Op.gt]: lastId } },
      attributes: ['id', 'anio', 'semestre', 'departamento', 'municipio', 'codigo_departamento', 'codigo_dane'],
      order: [['id', 'ASC']],
      limit: BATCH_SIZE,
      raw: true
    });
    if (!rows.length) break;

    const incidences = [];
    for (const row of rows) {
      lastId = row.id;
      const depKey = normalizeText(row.departamento);
      const munKey = normalizeText(row.municipio);
      const incomingDeptCode = String(row.codigo_departamento || '').trim() || null;
      const incomingMuniCode = String(row.codigo_dane || '').trim() || null;

      let codigoDepto = null;
      let codigoMuni = null;
      let confianza = null;
      let metodo = null;
      let score = null;

      codigoDepto = incomingDeptCode || deptByName.get(depKey) || DEPARTAMENTO_ALIASES.get(depKey) || null;
      if (incomingMuniCode && !codigoDepto) {
        const muniRef = municipios.find((item) => item.codigo_dane === incomingMuniCode);
        if (muniRef) codigoDepto = muniRef.codigo_departamento;
      }
      if (!codigoDepto && depKey) {
        const bestDept = getBestFuzzy(depKey, deptFuzzy);
        if (bestDept && bestDept.score >= 0.86) {
          codigoDepto = bestDept.codigo_dane;
          score = Number(bestDept.score.toFixed(3));
          metodo = 'fuzzy_departamento';
        }
      }

      if (codigoDepto) {
        const munAlias = MUNICIPIO_ALIASES_BY_DEPTO.get(`${codigoDepto}|${munKey}`) || munKey;
        codigoMuni = incomingMuniCode || muniByDeptAndName.get(`${codigoDepto}|${munAlias}`) || null;
        if (codigoMuni) {
          confianza = incomingMuniCode ? 'alta' : (score ? 'media' : 'alta');
          metodo = incomingMuniCode ? 'codigo_dane' : (score ? metodo : 'exacto_departamento_municipio');
          score = score || 1;
        } else if (munKey) {
          const candidates = muniFuzzyByDept.get(codigoDepto) || [];
          const bestMuni = getBestFuzzy(munKey, candidates);
          if (bestMuni && bestMuni.score >= 0.88) {
            codigoMuni = bestMuni.codigo_dane;
            confianza = 'media';
            metodo = 'fuzzy_municipio';
            score = Number(bestMuni.score.toFixed(3));
          }
        }
      }

      if (!codigoDepto && !codigoMuni) {
        confianza = 'sin_match';
        metodo = 'sin_match';
      } else if (!codigoMuni) {
        confianza = 'baja';
        metodo = metodo || 'solo_departamento';
        score = score || 0.7;
      }

      await PoblacionalMatriculado.update(
        {
          codigo_departamento: codigoDepto,
          codigo_dane: codigoMuni,
          match_confianza_ubicacion: confianza,
          match_metodo_ubicacion: metodo,
          match_score_ubicacion: score,
          match_actualizado_en: new Date()
        },
        { where: { id: row.id } }
      );

      updated += 1;
      if (metodo === 'exacto_departamento_municipio') exact += 1;
      else if (metodo && metodo.startsWith('fuzzy')) fuzzy += 1;
      if (confianza === 'sin_match' || confianza === 'baja') {
        unresolved += 1;
        incidences.push({
          matriculado_id: row.id,
          anio: row.anio,
          periodo: row.semestre,
          departamento_fuente: row.departamento,
          municipio_fuente: row.municipio,
          codigo_departamento_sugerido: codigoDepto,
          codigo_municipio_sugerido: codigoMuni,
          confianza,
          metodo,
          score,
          estado: 'pendiente',
          observacion: confianza === 'sin_match' ? 'Sin match automatico con catalogo DIVIPOLA' : 'Match parcial: requiere revision manual'
        });
      }
    }

    if (incidences.length) {
      await MatriculadosUbicacionIncidencia.bulkCreate(incidences);
    }
  }

  console.log(`[divipola:enrich] Registros evaluados: ${updated}`);
  console.log(`[divipola:enrich] Match exacto: ${exact}`);
  console.log(`[divipola:enrich] Match fuzzy: ${fuzzy}`);
  console.log(`[divipola:enrich] Incidencias: ${unresolved}`);
  await sequelize.close();
};

run().catch((error) => {
  console.error('[divipola:enrich] Error:', error.message);
  process.exit(1);
});
