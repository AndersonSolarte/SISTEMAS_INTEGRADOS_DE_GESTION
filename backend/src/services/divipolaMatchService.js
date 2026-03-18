'use strict';

/**
 * divipolaMatchService.js
 *
 * Servicio centralizado de normalización territorial DIVIPOLA.
 * Carga el catálogo ref_departamentos / ref_municipios una sola vez por
 * proceso (caché en módulo) y resuelve la ubicación de cada registro usando:
 *   1. Código DANE exacto (cuando viene en el archivo fuente)
 *   2. Coincidencia exacta de nombre normalizado
 *   3. Alias conocidos (Bogotá, Cali, San Andrés…)
 *   4. Fuzzy matching con coeficiente Dice (umbral depto 0.86 / muni 0.88)
 */

const { RefDepartamento, RefMunicipio } = require('../models');

/* ── Umbrales de confianza fuzzy ─────────────────────────────────────────── */
const DICE_THRESHOLD_DEPTO = 0.86;
const DICE_THRESHOLD_MUNI  = 0.88;

/* ── Alias conocidos ─────────────────────────────────────────────────────── */
const DEPARTAMENTO_ALIASES = new Map([
  ['BOGOTA D C',  '11'],
  ['BOGOTA DC',   '11'],
  ['BOGOTA',      '11'],
  ['ARCHIPIELAGO DE SAN ANDRES PROVIDENCIA Y SANTA CATALINA', '88']
]);

const MUNICIPIO_ALIASES_BY_DEPTO = new Map([
  ['76|CALI',        'SANTIAGO DE CALI'],
  ['11|BOGOTA',      'BOGOTA D C'],
  ['11|BOGOTA DC',   'BOGOTA D C'],
  ['11|BOGOTA D C',  'BOGOTA D C']
]);

/* ── Helpers de texto ────────────────────────────────────────────────────── */
const stripDiacritics = (v = '') =>
  String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

const normalizeForMatch = (v = '') =>
  stripDiacritics(String(v || ''))
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isColombia = (pais = '') => {
  const t = normalizeForMatch(pais);
  return !t || t === 'COLOMBIA' || t === 'REPUBLICA DE COLOMBIA';
};

const padCode = (value, len) => {
  const digits = String(value ?? '').replace(/[^0-9]/g, '');
  if (!digits) return null;
  return digits.replace(/^0+/, '').padStart(len, '0').slice(-len);
};

/* ── Coeficiente Dice (bigrams) ──────────────────────────────────────────── */
const diceCoefficient = (a = '', b = '') => {
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Map();
  for (let i = 0; i < a.length - 1; i++) {
    const bi = a.slice(i, i + 2);
    bigrams.set(bi, (bigrams.get(bi) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bi = b.slice(i, i + 2);
    const cnt = bigrams.get(bi) || 0;
    if (cnt > 0) { bigrams.set(bi, cnt - 1); intersection++; }
  }
  return (2 * intersection) / ((a.length - 1) + (b.length - 1));
};

const getBestFuzzy = (target, candidates = []) => {
  let best = null;
  for (const c of candidates) {
    const score = diceCoefficient(target, c.key);
    if (!best || score > best.score) best = { ...c, score };
  }
  return best;
};

/* ── Catálogo en memoria (se invalida llamando a invalidateCatalog) ───────── */
let _catalog = null;

/**
 * Carga el catálogo DIVIPOLA desde la BD y lo retiene en módulo.
 * Llama a `invalidateCatalog()` antes de una nueva carga de DIVIPOLA.
 */
const loadCatalog = async () => {
  if (_catalog) return _catalog;

  const departamentos = await RefDepartamento.findAll({
    where: { activo: true },
    attributes: ['codigo_dane', 'nombre_oficial', 'nombre_normalizado'],
    raw: true
  });
  const municipios = await RefMunicipio.findAll({
    where: { activo: true },
    attributes: ['codigo_dane', 'codigo_departamento', 'nombre_oficial', 'nombre_normalizado'],
    raw: true
  });

  const deptByCode  = new Map();
  const deptByName  = new Map();
  const deptFuzzy   = [];

  for (const d of departamentos) {
    deptByCode.set(d.codigo_dane, d);
    const key = normalizeForMatch(d.nombre_normalizado);
    if (key) deptByName.set(key, d);
    deptFuzzy.push({ key, ref: d });
  }

  const muniByCode       = new Map();
  const muniByDeptAndName = new Map();
  const muniFuzzyByDept  = new Map();

  for (const m of municipios) {
    muniByCode.set(m.codigo_dane, m);
    const keyName = normalizeForMatch(m.nombre_normalizado);
    muniByDeptAndName.set(`${m.codigo_departamento}|${keyName}`, m);
    if (!muniFuzzyByDept.has(m.codigo_departamento)) {
      muniFuzzyByDept.set(m.codigo_departamento, []);
    }
    muniFuzzyByDept.get(m.codigo_departamento).push({ key: keyName, ref: m });
  }

  _catalog = { deptByCode, deptByName, deptFuzzy, muniByCode, muniByDeptAndName, muniFuzzyByDept };
  return _catalog;
};

/** Fuerza la recarga del catálogo en la próxima llamada a resolveUbicacion. */
const invalidateCatalog = () => { _catalog = null; };

/**
 * Resuelve la ubicación territorial DIVIPOLA para un registro de matriculado.
 *
 * @param {object} params
 * @param {string} [params.pais]              - País de nacimiento
 * @param {string} [params.departamento]      - Nombre de departamento (fuente)
 * @param {string} [params.municipio]         - Nombre de municipio (fuente)
 * @param {string} [params.codigoDaneMuni]    - Código DANE municipio 5 dígitos (opcional)
 * @param {string} [params.codigoDaneDepto]   - Código DANE departamento 2 dígitos (opcional)
 *
 * @returns {Promise<{
 *   codigoDepto:  string|null,
 *   codigoMuni:   string|null,
 *   nombreDepto:  string|null,
 *   nombreMuni:   string|null,
 *   confianza:    string,
 *   metodo:       string,
 *   score:        number|null
 * }>}
 */
const resolveUbicacion = async ({ pais, departamento, municipio, codigoDaneMuni, codigoDaneDepto } = {}) => {
  /* ── País no Colombia → sin normalización ── */
  if (!isColombia(pais)) {
    return {
      codigoDepto: null, codigoMuni: null,
      nombreDepto: null, nombreMuni: null,
      confianza: 'internacional', metodo: 'pais_no_colombia', score: null
    };
  }

  const catalog = await loadCatalog();
  const { deptByCode, deptByName, deptFuzzy, muniByCode, muniByDeptAndName, muniFuzzyByDept } = catalog;

  const depKey           = normalizeForMatch(departamento);
  const munKey           = normalizeForMatch(municipio);
  const incomingDeptCode = padCode(codigoDaneDepto, 2);
  const incomingMuniCode = padCode(codigoDaneMuni,  5);

  let deptRef = null;
  let muniRef = null;
  let metodo  = null;
  let score   = null;

  /* ── 1. Resolver departamento ──────────────────────────────────────────── */

  // 1a. Código DANE de departamento exacto
  if (incomingDeptCode && deptByCode.has(incomingDeptCode)) {
    deptRef = deptByCode.get(incomingDeptCode);
    metodo  = 'codigo_dane_depto';

  // 1b. Derivar depto desde código DANE de municipio
  } else if (incomingMuniCode && muniByCode.has(incomingMuniCode)) {
    const muniFromCode = muniByCode.get(incomingMuniCode);
    deptRef = deptByCode.get(muniFromCode.codigo_departamento) || null;
    metodo  = 'codigo_dane_muni';

  // 1c. Nombre exacto normalizado
  } else if (depKey && deptByName.has(depKey)) {
    deptRef = deptByName.get(depKey);

  // 1d. Alias conocidos
  } else if (DEPARTAMENTO_ALIASES.has(depKey)) {
    const aliasCode = DEPARTAMENTO_ALIASES.get(depKey);
    deptRef = deptByCode.get(aliasCode) || null;

  // 1e. Fuzzy matching
  } else if (depKey) {
    const best = getBestFuzzy(depKey, deptFuzzy);
    if (best && best.score >= DICE_THRESHOLD_DEPTO) {
      deptRef = best.ref;
      score   = Number(best.score.toFixed(3));
      metodo  = 'fuzzy_departamento';
    }
  }

  /* ── 2. Resolver municipio ─────────────────────────────────────────────── */

  if (deptRef) {
    const codigoDepto = deptRef.codigo_dane;

    // 2a. Código DANE de municipio exacto
    if (incomingMuniCode && muniByCode.has(incomingMuniCode)) {
      muniRef = muniByCode.get(incomingMuniCode);
      if (!metodo || metodo === 'fuzzy_departamento') metodo = 'codigo_dane';
      score = score || 1;

    } else {
      // 2b. Aplicar alias de municipio si corresponde
      const munAlias = MUNICIPIO_ALIASES_BY_DEPTO.get(`${codigoDepto}|${munKey}`) || munKey;
      const exactKey = `${codigoDepto}|${munAlias}`;

      if (muniByDeptAndName.has(exactKey)) {
        muniRef = muniByDeptAndName.get(exactKey);
        if (!metodo) metodo = 'exacto_departamento_municipio';
        score = score || 1;

      // 2c. Fuzzy municipio dentro del departamento
      } else if (munKey) {
        const candidates = muniFuzzyByDept.get(codigoDepto) || [];
        const best = getBestFuzzy(munKey, candidates);
        if (best && best.score >= DICE_THRESHOLD_MUNI) {
          muniRef = best.ref;
          metodo  = metodo === 'fuzzy_departamento' ? 'fuzzy_departamento_municipio' : 'fuzzy_municipio';
          score   = Number(best.score.toFixed(3));
        }
      }
    }
  }

  /* ── 3. Determinar nivel de confianza ──────────────────────────────────── */
  let confianza;

  if (!deptRef && !muniRef) {
    confianza = 'sin_match';
    metodo    = metodo || 'sin_match';
  } else if (!muniRef) {
    confianza = 'baja';
    metodo    = metodo || 'solo_departamento';
    score     = score || 0.7;
  } else if (
    metodo === 'codigo_dane'      ||
    metodo === 'codigo_dane_muni' ||
    metodo === 'codigo_dane_depto'
  ) {
    confianza = 'alta';
  } else if (metodo && metodo.startsWith('fuzzy')) {
    confianza = 'media';
  } else {
    confianza = 'alta';
  }

  return {
    codigoDepto: deptRef?.codigo_dane || null,
    codigoMuni:  muniRef?.codigo_dane || null,
    nombreDepto: deptRef?.nombre_oficial || null,
    nombreMuni:  muniRef?.nombre_oficial || null,
    confianza,
    metodo,
    score
  };
};

module.exports = { loadCatalog, invalidateCatalog, resolveUbicacion };
