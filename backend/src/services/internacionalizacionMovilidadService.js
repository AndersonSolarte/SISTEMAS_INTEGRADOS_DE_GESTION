const { InternacionalizacionMovilidad } = require('../models');

const MOVILIDAD_DASHBOARD_ATTRIBUTES = [
  'periodo',
  'alcance_movilidad',
  'direccion_movilidad',
  'tipo_persona',
  'pais_extranjero',
  'programa_dependencia',
  'actividad_movilidad',
  'tipo_movilidad',
  'modalidad',
  'institucion_extranjera',
  'codigo_convenio',
  'movilidad_por_convenio',
  'estado_provincia_departamento',
  'ciudad_municipio'
];

const NONE_FILTER_VALUE = '__NONE__';
const MOVILIDAD_ROWS_CACHE_TTL_MS = 2 * 60 * 1000;

const normalizeFilterKey = (value = '') => String(value || '')
  .toUpperCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9 ]/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const COUNTRY_DISPLAY_NAMES = {
  COLOMBIA: 'Colombia',
  ECUADOR: 'Ecuador',
  MEXICO: 'México',
  PERU: 'Perú',
  CHILE: 'Chile',
  'EL SALVADOR': 'El Salvador',
  BRASIL: 'Brasil',
  ARGENTINA: 'Argentina',
  PANAMA: 'Panamá',
  CANADA: 'Canadá',
  ESPANA: 'España',
  'ESTADOS UNIDOS': 'Estados Unidos'
};

const COUNTRY_VALUE_OVERRIDES = {
  NARINO: 'Colombia',
  NO: 'Colombia',
  'UNIVERSIDAD DEL VALLE': 'Colombia',
  'INFOTEC SOLUCIONES S A S': 'Colombia',
  'UNIVERSIDAD CATOLICA': 'Colombia',
  'COLOMBIA PERU': 'Colombia',
  'MEXICO ECUADOR BRASIL': 'México',
  'ECUADOR PERU MEXICO': 'Ecuador',
  ESCUADOR: 'Ecuador',
  SALVADOR: 'El Salvador',
  '32 ARGENTINA': 'Argentina',
  '862 VEN': 'Venezuela',
  '840 ESTADOS UNIDOS': 'Estados Unidos',
  'E E U U': 'Estados Unidos',
  '484 MEX': 'México',
  'CHILE 152': 'Chile'
};

const COUNTRY_MATCHERS = [
  { name: 'Colombia', patterns: [/COLOMBIA/, /170\s*COL$/, /^COL$/, /^CO$/, /^170$/] },
  { name: 'Ecuador', patterns: [/ECUADOR/, /ESCUADOR/, /(^|[^A-Z])ECU([^A-Z]|$)/, /218\s*ECU/, /^EC$/, /^218$/] },
  { name: 'México', patterns: [/MEXICO/, /(^|[^A-Z])MEX([^A-Z]|$)/, /484\s*MEX/, /^484$/] },
  { name: 'Perú', patterns: [/PERU/, /604\s*PER/, /^604$/] },
  { name: 'Chile', patterns: [/CHILE/, /152\s*CHI/, /^152$/, /^CL$/] },
  { name: 'El Salvador', patterns: [/EL SALVADOR/, /^SALVADOR$/] },
  { name: 'Brasil', patterns: [/BRASIL/, /BRAZIL/, /^76$/] },
  { name: 'Argentina', patterns: [/ARGENTINA/, /^32$/] },
  { name: 'Honduras', patterns: [/HONDURAS/, /^340$/] },
  { name: 'Uruguay', patterns: [/URUGUAY/, /^858$/] },
  { name: 'España', patterns: [/ESPANA/, /724\s*ESP/, /^724$/] },
  { name: 'Estados Unidos', patterns: [/ESTADOS UNIDOS/, /^E E U U$/, /^EEUU$/, /^USA$/, /840\s*ESTADOS UNIDOS/, /^840$/] },
  { name: 'Venezuela', patterns: [/VENEZUELA/, /862\s*VEN$/, /^VEN$/, /^862$/] },
  { name: 'Italia', patterns: [/ITALIA/, /^380$/] },
  { name: 'Costa Rica', patterns: [/COSTA RICA/, /^188$/] },
  { name: 'Cuba', patterns: [/CUBA/, /^192$/] },
  { name: 'Guatemala', patterns: [/GUATEMALA/, /^320$/] },
  { name: 'Panamá', patterns: [/PANAMA/, /^591$/] },
  { name: 'Alemania', patterns: [/ALEMANIA/, /^276$/] },
  { name: 'Marruecos', patterns: [/MARRUECOS/, /^504$/] }
];

const normalizeCountryName = (value = '') => {
  const key = normalizeFilterKey(value);
  if (!key || ['N A', 'NA', 'N/A', 'SIN DATO', 'REGIONAL', 'OTRO', 'OTROS', 'NO APLICA'].includes(key)) return 'Sin dato';
  if (COUNTRY_VALUE_OVERRIDES[key]) return COUNTRY_VALUE_OVERRIDES[key];
  const matches = COUNTRY_MATCHERS
    .filter((country) => country.patterns.some((pattern) => pattern.test(key)))
    .map((country) => country.name);
  const uniqueMatches = [...new Set(matches)];
  if (uniqueMatches.length === 1) return uniqueMatches[0];
  if (uniqueMatches.length > 1) return 'Sin dato';
  return COUNTRY_DISPLAY_NAMES[key] || 'Sin dato';
};

const cleanMobilityTypeKey = (value = '') => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/^\s*\d+\s*\.?\s*/g, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const MOBILITY_TYPE_NAMES = {
  'ASISTENCIA A EVENTOS': 'Asistencia a eventos',
  'ASISTENCIA EVENTOS': 'Asistencia a eventos',
  'CURSO CORTO': 'Curso corto',
  'PASANTIA O PRACTICA': 'Pasantía o práctica',
  PASANTIA: 'Pasantía',
  MISION: 'Misión',
  'SECTOR EMPRESARIAL': 'Sector empresarial',
  'EDUCACION CONTINUADA': 'Educación continuada',
  SEMINARIOS: 'Seminarios',
  SIMPOSIOS: 'Simposios',
  CONGRESOS: 'Congresos',
  'GESTION DE CONVENIOS': 'Gestión de convenios',
  'SEMESTRE ACADEMICO DE INTERCAMBIO': 'Semestre académico de intercambio',
  'PAR ACADEMICO': 'Par académico',
  PONENCIA: 'Ponencia',
  'VISITA EMPRESARIAL': 'Visita empresarial',
  ACADEMICA: 'Académica',
  ENTRANTE: 'Entrante',
  SALIENTE: 'Saliente'
};

const normalizeMobilityType = (value = '') => {
  const key = cleanMobilityTypeKey(value);
  if (!key || ['N A', 'NA', 'N/A', 'SIN DATO'].includes(key)) return 'Sin dato';
  return MOBILITY_TYPE_NAMES[key] || key.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const classifyPerson = (value = '') => {
  const key = normalizeFilterKey(value);
  if (key.includes('ESTUD')) return 'estudiantes';
  if (key.includes('DOCEN') || key.includes('PROFES')) return 'docentes';
  if (key.includes('ADMIN')) return 'administrativos';
  return 'otros';
};

const classifyDirection = (value = '') => {
  const key = normalizeFilterKey(value);
  if (key.includes('ENTR')) return 'entrantes';
  if (key.includes('SAL')) return 'salientes';
  return 'sin_direccion';
};

const countSpanishAccents = (value = '') => (String(value).match(/[áéíóúüñÁÉÍÓÚÜÑ]/g) || []).length;

const buildCanonicalLabelMap = (rawRows = [], field) => {
  const groups = new Map();
  for (let i = 0; i < rawRows.length; i += 1) {
    const raw = String(rawRows[i]?.[field] || '').trim().replace(/\s+/g, ' ');
    if (!raw) continue;
    const key = normalizeFilterKey(raw);
    if (!key) continue;
    let variantCounts = groups.get(key);
    if (!variantCounts) {
      variantCounts = new Map();
      groups.set(key, variantCounts);
    }
    variantCounts.set(raw, (variantCounts.get(raw) || 0) + 1);
  }
  const canonicalMap = new Map();
  groups.forEach((variantCounts, key) => {
    const sorted = Array.from(variantCounts.entries()).sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const accDiff = countSpanishAccents(b[0]) - countSpanishAccents(a[0]);
      if (accDiff !== 0) return accDiff;
      return a[0].localeCompare(b[0], 'es');
    });
    canonicalMap.set(key, sorted[0][0]);
  });
  return canonicalMap;
};

const prepareMovilidadRows = (rawRows = []) => {
  const canonicalProgramaMap = buildCanonicalLabelMap(rawRows, 'programa_dependencia');
  return rawRows.map((row) => {
    const paisNormalized = normalizeCountryName(row.pais_extranjero);
    const programaKey = normalizeFilterKey(row.programa_dependencia);
    const programaNormalized = programaKey ? (canonicalProgramaMap.get(programaKey) || '') : '';
    return {
      ...row,
      _periodoKey: normalizeFilterKey(row.periodo),
      _alcanceKey: normalizeFilterKey(row.alcance_movilidad),
      _direccionKey: normalizeFilterKey(row.direccion_movilidad),
      _tipoPersonaKey: normalizeFilterKey(row.tipo_persona),
      _paisNormalized: paisNormalized,
      _paisKey: paisNormalized !== 'Sin dato' ? normalizeFilterKey(paisNormalized) : '',
      _rawPaisKey: normalizeFilterKey(row.pais_extranjero),
      _programaKey: programaKey,
      _programaNormalized: programaNormalized,
      _tipoMovilidadNormalized: normalizeMobilityType(row.tipo_movilidad),
      _personClass: classifyPerson(row.tipo_persona),
      _directionClass: classifyDirection(row.direccion_movilidad)
    };
  });
};

const createEmptyFacetMaps = () => ({
  periodos: {},
  alcances: {},
  direcciones: {},
  tiposPersona: {},
  paises: {},
  programas: {}
});

const incrementFacetDim = (facetMaps, dim, value) => {
  if (!value) return;
  facetMaps[dim][value] = (facetMaps[dim][value] || 0) + 1;
};

const incrementAllFacets = (facetMaps, row) => {
  incrementFacetDim(facetMaps, 'periodos', row.periodo);
  incrementFacetDim(facetMaps, 'alcances', row.alcance_movilidad);
  incrementFacetDim(facetMaps, 'direcciones', row.direccion_movilidad);
  incrementFacetDim(facetMaps, 'tiposPersona', row.tipo_persona);
  if (row._paisNormalized && row._paisNormalized !== 'Sin dato') {
    incrementFacetDim(facetMaps, 'paises', row._paisNormalized);
  }
  incrementFacetDim(facetMaps, 'programas', row._programaNormalized);
};

const sortFacetEntries = (countMap = {}, isPeriod = false) => {
  const values = Object.keys(countMap)
    .filter((key) => Number(countMap[key] || 0) > 0)
    .sort((a, b) => (
      isPeriod
        ? String(a).localeCompare(String(b), undefined, { numeric: true })
        : String(a).localeCompare(String(b), 'es')
    ));
  const counts = {};
  values.forEach((key) => {
    counts[key] = Number(countMap[key] || 0);
  });
  return { values, counts };
};

const finalizeFacets = (facetMaps) => {
  const per = sortFacetEntries(facetMaps.periodos, true);
  const alc = sortFacetEntries(facetMaps.alcances);
  const dir = sortFacetEntries(facetMaps.direcciones);
  const tp = sortFacetEntries(facetMaps.tiposPersona);
  const pai = sortFacetEntries(facetMaps.paises);
  const pro = sortFacetEntries(facetMaps.programas);

  return {
    catalogos: {
      periodos: per.values,
      alcances: alc.values,
      direcciones: dir.values,
      tiposPersona: tp.values,
      paises: pai.values,
      programas: pro.values
    },
    catalogosCounts: {
      periodos: per.counts,
      alcances: alc.counts,
      direcciones: dir.counts,
      tiposPersona: tp.counts,
      paises: pai.counts,
      programas: pro.counts
    }
  };
};

const buildMasterCatalogosWithCounts = (preparedRows = []) => {
  const facetMaps = createEmptyFacetMaps();
  for (let i = 0; i < preparedRows.length; i += 1) {
    incrementAllFacets(facetMaps, preparedRows[i]);
  }
  return finalizeFacets(facetMaps);
};

const buildMasterCatalogos = (preparedRows = []) => buildMasterCatalogosWithCounts(preparedRows).catalogos;

const toFilterValues = (value, knownValues = null) => {
  if (Array.isArray(value)) {
    return value.map((item) => String(item ?? '').trim()).filter(Boolean);
  }
  const str = String(value ?? '').trim();
  if (!str) return [];
  if (knownValues && knownValues.length) {
    if (knownValues.includes(str)) return [str];
    const strKey = normalizeFilterKey(str);
    if (strKey && knownValues.some((item) => normalizeFilterKey(item) === strKey)) {
      return [str];
    }
  }
  return str.split(',').map((item) => item.trim()).filter(Boolean);
};

const createEmptySniesMatrix = () => ({
  estudiantes: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 },
  docentes: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 },
  administrativos: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 },
  otros: { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 }
});

const createEmptyPopulationProfileBucket = () => ({
  total: 0,
  entidades: [],
  convenios: [],
  actividades: [],
  tiposMovilidad: [],
  paises: [],
  departamentos: [],
  municipios: []
});

const createEmptyPopulationProfiles = () => ({
  estudiantes: {
    total: 0,
    entrantes: createEmptyPopulationProfileBucket(),
    salientes: createEmptyPopulationProfileBucket()
  },
  docentes: {
    total: 0,
    entrantes: createEmptyPopulationProfileBucket(),
    salientes: createEmptyPopulationProfileBucket()
  },
  administrativos: {
    total: 0,
    entrantes: createEmptyPopulationProfileBucket(),
    salientes: createEmptyPopulationProfileBucket()
  }
});

const initPopulationProfileRaw = () => ({
  total: 0,
  entrantes: { total: 0, entidades: {}, convenios: {}, actividades: {}, tiposMovilidad: {}, paises: {}, departamentos: {}, municipios: {} },
  salientes: { total: 0, entidades: {}, convenios: {}, actividades: {}, tiposMovilidad: {}, paises: {}, departamentos: {}, municipios: {} },
  sin_direccion: { total: 0, entidades: {}, convenios: {}, actividades: {}, tiposMovilidad: {}, paises: {}, departamentos: {}, municipios: {} }
});

const addProfileCount = (target, key, fallback = 'Sin dato') => {
  const value = String(key || '').trim() || fallback;
  if (['Sin dato', 'N/A', 'NA', 'N A'].includes(value)) return;
  target[value] = (target[value] || 0) + 1;
};

const topFromObject = (obj = {}, limit = 6) => Object.entries(obj)
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value || String(a.name).localeCompare(String(b.name), 'es'))
  .slice(0, limit);

const countField = (items, key) => items.reduce((acc, row) => {
  const label = row[key] || 'Sin dato';
  acc[label] = (acc[label] || 0) + 1;
  return acc;
}, {});

const countPrecomputedField = (items, key) => items.reduce((acc, row) => {
  const label = row[key] || 'Sin dato';
  acc[label] = (acc[label] || 0) + 1;
  return acc;
}, {});

const toSortedArr = (obj) => Object.entries(obj)
  .map(([name, value]) => ({ name, value }))
  .sort((a, b) => b.value - a.value);

const crossCount = (items, rowKey, colKey) => items.reduce((acc, r) => {
  const row = r[rowKey] || 'Sin dato';
  const col = r[colKey] || 'Sin dato';
  if (!acc[row]) acc[row] = {};
  acc[row][col] = (acc[row][col] || 0) + 1;
  return acc;
}, {});

const computeRowsAndFacets = (preparedRows = [], keySets) => {
  const {
    periodoKeys,
    alcanceKeys,
    direccionKeys,
    tipoPersonaKeys,
    paisKeys,
    programaKeys
  } = keySets;
  const matchedRows = [];
  const facetMaps = createEmptyFacetMaps();

  for (let i = 0; i < preparedRows.length; i += 1) {
    const row = preparedRows[i];
    const mPeriodo = !periodoKeys.size || periodoKeys.has(row._periodoKey);
    const mAlcance = !alcanceKeys.size || alcanceKeys.has(row._alcanceKey);
    const mDireccion = !direccionKeys.size || direccionKeys.has(row._direccionKey);
    const mTipoPersona = !tipoPersonaKeys.size || tipoPersonaKeys.has(row._tipoPersonaKey);
    const mPais = !paisKeys.size || paisKeys.has(row._paisKey) || paisKeys.has(row._rawPaisKey);
    const mPrograma = !programaKeys.size || programaKeys.has(row._programaKey);

    const failCount =
      (mPeriodo ? 0 : 1) +
      (mAlcance ? 0 : 1) +
      (mDireccion ? 0 : 1) +
      (mTipoPersona ? 0 : 1) +
      (mPais ? 0 : 1) +
      (mPrograma ? 0 : 1);

    if (failCount === 0) {
      matchedRows.push(row);
      incrementAllFacets(facetMaps, row);
    } else if (failCount === 1) {
      if (!mPeriodo) incrementFacetDim(facetMaps, 'periodos', row.periodo);
      else if (!mAlcance) incrementFacetDim(facetMaps, 'alcances', row.alcance_movilidad);
      else if (!mDireccion) incrementFacetDim(facetMaps, 'direcciones', row.direccion_movilidad);
      else if (!mTipoPersona) incrementFacetDim(facetMaps, 'tiposPersona', row.tipo_persona);
      else if (!mPais && row._paisNormalized && row._paisNormalized !== 'Sin dato') {
        incrementFacetDim(facetMaps, 'paises', row._paisNormalized);
      } else if (!mPrograma) incrementFacetDim(facetMaps, 'programas', row._programaNormalized);
    }
  }

  return {
    rows: matchedRows,
    ...finalizeFacets(facetMaps)
  };
};

const buildMovilidadDashboardPayload = (
  rowsInput = [],
  masterCatalogosInput = null,
  query = {},
  masterCatalogosCountsInput = null
) => {
  const preparedRows = rowsInput.length && Object.prototype.hasOwnProperty.call(rowsInput[0], '_periodoKey')
    ? rowsInput
    : prepareMovilidadRows(rowsInput);

  let masterCatalogos = masterCatalogosInput;
  let masterCatalogosCounts = masterCatalogosCountsInput;
  if (!masterCatalogos || !masterCatalogosCounts) {
    const computedMaster = buildMasterCatalogosWithCounts(preparedRows);
    masterCatalogos = masterCatalogos || computedMaster.catalogos;
    masterCatalogosCounts = masterCatalogosCounts || computedMaster.catalogosCounts;
  }

  const periodoVals = toFilterValues(query.periodo, masterCatalogos.periodos);
  const alcanceVals = toFilterValues(query.alcance, masterCatalogos.alcances);
  const direccionVals = toFilterValues(query.direccion, masterCatalogos.direcciones);
  const tipoPersonaVals = toFilterValues(query.tipo_persona, masterCatalogos.tiposPersona);
  const paisVals = toFilterValues(query.pais, masterCatalogos.paises);
  const programaVals = toFilterValues(query.programa, masterCatalogos.programas);

  const hasExplicitNone = [
    periodoVals,
    alcanceVals,
    direccionVals,
    tipoPersonaVals,
    paisVals,
    programaVals
  ].some((vals) => vals.includes(NONE_FILTER_VALUE));

  const buildNormalizedKeySet = (values, isCountry = false) => new Set(
    values
      .filter((item) => item !== NONE_FILTER_VALUE)
      .map((item) => {
        if (!isCountry) return normalizeFilterKey(item);
        const normalized = normalizeCountryName(item);
        return normalizeFilterKey(normalized !== 'Sin dato' ? normalized : item);
      })
      .filter(Boolean)
  );

  const keySets = {
    periodoKeys: buildNormalizedKeySet(periodoVals),
    alcanceKeys: buildNormalizedKeySet(alcanceVals),
    direccionKeys: buildNormalizedKeySet(direccionVals),
    tipoPersonaKeys: buildNormalizedKeySet(tipoPersonaVals),
    paisKeys: buildNormalizedKeySet(paisVals, true),
    programaKeys: buildNormalizedKeySet(programaVals)
  };

  const hasAnyNonNoneFilter = Object.values(keySets).some((set) => set.size > 0);

  if (hasExplicitNone) {
    const facets = hasAnyNonNoneFilter
      ? computeRowsAndFacets(preparedRows, keySets)
      : { catalogos: masterCatalogos, catalogosCounts: masterCatalogosCounts };

    return {
      total: 0,
      byPeriodo: [],
      byAlcance: [],
      byDireccion: [],
      byTipoPersona: [],
      byPais: [],
      byActividad: [],
      byTipoMovilidad: [],
      byPrograma: [],
      byModalidad: [],
      heatmapPeriodoDireccion: {},
      sniesPersonDirection: createEmptySniesMatrix(),
      populationProfiles: createEmptyPopulationProfiles(),
      institucionesMovilidad: [],
      catalogos: facets.catalogos,
      catalogosCounts: facets.catalogosCounts,
      masterCatalogos
    };
  }

  let rows = preparedRows;
  let catalogos = masterCatalogos;
  let catalogosCounts = masterCatalogosCounts;

  if (hasAnyNonNoneFilter) {
    const computed = computeRowsAndFacets(preparedRows, keySets);
    rows = computed.rows;
    catalogos = computed.catalogos;
    catalogosCounts = computed.catalogosCounts;
  }

  const sniesPersonDirection = rows.reduce((acc, row) => {
    const person = row._personClass;
    const direction = row._directionClass;
    if (!acc[person]) acc[person] = { entrantes: 0, salientes: 0, sin_direccion: 0, total: 0 };
    acc[person][direction] = (acc[person][direction] || 0) + 1;
    acc[person].total += 1;
    return acc;
  }, createEmptySniesMatrix());

  const populationProfilesRaw = {
    estudiantes: initPopulationProfileRaw(),
    docentes: initPopulationProfileRaw(),
    administrativos: initPopulationProfileRaw()
  };

  rows.forEach((row) => {
    const person = row._personClass;
    if (!populationProfilesRaw[person]) return;
    const direction = row._directionClass;
    const bucket = populationProfilesRaw[person][direction] || populationProfilesRaw[person].sin_direccion;
    populationProfilesRaw[person].total += 1;
    bucket.total += 1;
    addProfileCount(bucket.entidades, row.institucion_extranjera);
    addProfileCount(bucket.convenios, row.codigo_convenio || row.movilidad_por_convenio);
    addProfileCount(bucket.actividades, row.actividad_movilidad);
    addProfileCount(bucket.tiposMovilidad, row._tipoMovilidadNormalized);
    addProfileCount(bucket.paises, row._paisNormalized);
    addProfileCount(bucket.departamentos, row.estado_provincia_departamento);
    addProfileCount(bucket.municipios, row.ciudad_municipio);
  });

  const populationProfiles = Object.fromEntries(
    Object.entries(populationProfilesRaw).map(([key, value]) => [
      key,
      {
        total: value.total,
        entrantes: {
          total: value.entrantes.total,
          entidades: topFromObject(value.entrantes.entidades),
          convenios: topFromObject(value.entrantes.convenios),
          actividades: topFromObject(value.entrantes.actividades),
          tiposMovilidad: topFromObject(value.entrantes.tiposMovilidad),
          paises: topFromObject(value.entrantes.paises),
          departamentos: topFromObject(value.entrantes.departamentos),
          municipios: topFromObject(value.entrantes.municipios)
        },
        salientes: {
          total: value.salientes.total,
          entidades: topFromObject(value.salientes.entidades),
          convenios: topFromObject(value.salientes.convenios),
          actividades: topFromObject(value.salientes.actividades),
          tiposMovilidad: topFromObject(value.salientes.tiposMovilidad),
          paises: topFromObject(value.salientes.paises),
          departamentos: topFromObject(value.salientes.departamentos),
          municipios: topFromObject(value.salientes.municipios)
        }
      }
    ])
  );

  const byPeriodo = toSortedArr(countField(rows, 'periodo'));
  const byAlcance = toSortedArr(countField(rows, 'alcance_movilidad'));
  const byDireccion = toSortedArr(countField(rows, 'direccion_movilidad'));
  const byTipoPersona = toSortedArr(countField(rows, 'tipo_persona'));
  const byPais = toSortedArr(countPrecomputedField(rows, '_paisNormalized')).filter((row) => row.name !== 'Sin dato');
  const byActividad = toSortedArr(countField(rows, 'actividad_movilidad'));
  const byTipoMovilidad = toSortedArr(countPrecomputedField(rows, '_tipoMovilidadNormalized'));
  const byPrograma = toSortedArr(countPrecomputedField(rows, '_programaNormalized')).filter((row) => row.name !== 'Sin dato').slice(0, 20);
  const byModalidad = toSortedArr(countField(rows, 'modalidad'));
  const heatmapPeriodoDireccion = crossCount(rows, 'direccion_movilidad', 'periodo');
  const institucionesMovilidad = [...new Set(rows.map((r) => String(r.institucion_extranjera || '').trim()).filter(Boolean))].sort();

  return {
    total: rows.length,
    byPeriodo,
    byAlcance,
    byDireccion,
    byTipoPersona,
    byPais,
    byActividad,
    byTipoMovilidad,
    byPrograma,
    byModalidad,
    heatmapPeriodoDireccion,
    sniesPersonDirection,
    populationProfiles,
    institucionesMovilidad,
    catalogos,
    catalogosCounts,
    masterCatalogos
  };
};

let movilidadCache = null;
let movilidadCachePromise = null;

const clearInternacionalizacionMovilidadCache = () => {
  movilidadCache = null;
  movilidadCachePromise = null;
};

const loadPreparedMovilidadCache = async (forceRefresh = false) => {
  const now = Date.now();
  if (!forceRefresh && movilidadCache && (now - movilidadCache.createdAt) < MOVILIDAD_ROWS_CACHE_TTL_MS) {
    return movilidadCache;
  }

  if (!forceRefresh && movilidadCachePromise) {
    return movilidadCachePromise;
  }

  movilidadCachePromise = InternacionalizacionMovilidad.findAll({
    attributes: MOVILIDAD_DASHBOARD_ATTRIBUTES,
    raw: true,
    order: [['periodo', 'ASC'], ['id', 'ASC']]
  })
    .then((rawRows) => {
      const preparedRows = prepareMovilidadRows(rawRows);
      const {
        catalogos: masterCatalogos,
        catalogosCounts: masterCatalogosCounts
      } = buildMasterCatalogosWithCounts(preparedRows);
      movilidadCache = {
        createdAt: Date.now(),
        preparedRows,
        masterCatalogos,
        masterCatalogosCounts
      };
      return movilidadCache;
    })
    .finally(() => {
      movilidadCachePromise = null;
    });

  return movilidadCachePromise;
};

const getMovilidadDashboardData = async (query = {}) => {
  const forceRefresh = ['1', 'true', 'si'].includes(String(query.force_refresh || '').trim().toLowerCase());
  const { preparedRows, masterCatalogos, masterCatalogosCounts } = await loadPreparedMovilidadCache(forceRefresh);
  return buildMovilidadDashboardPayload(preparedRows, masterCatalogos, query, masterCatalogosCounts);
};

module.exports = {
  MOVILIDAD_DASHBOARD_ATTRIBUTES,
  NONE_FILTER_VALUE,
  normalizeFilterKey,
  normalizeCountryName,
  normalizeMobilityType,
  prepareMovilidadRows,
  buildMasterCatalogos,
  buildMasterCatalogosWithCounts,
  buildMovilidadDashboardPayload,
  getMovilidadDashboardData,
  clearInternacionalizacionMovilidadCache
};
