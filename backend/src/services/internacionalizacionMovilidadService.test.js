const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  NONE_FILTER_VALUE,
  prepareMovilidadRows,
  buildMasterCatalogos,
  buildMasterCatalogosWithCounts,
  buildMovilidadDashboardPayload
} = require('./internacionalizacionMovilidadService');

const sampleRows = [
  {
    periodo: '2024-1',
    alcance_movilidad: 'Nacional',
    direccion_movilidad: 'Saliente',
    tipo_persona: 'ESTUDIANTE',
    pais_extranjero: 'Colombia',
    programa_dependencia: 'Ingeniería de Sistemas',
    actividad_movilidad: 'Ponencia',
    tipo_movilidad: 'Asistencia a eventos',
    modalidad: 'Presencial',
    institucion_extranjera: 'Universidad Nacional',
    codigo_convenio: 'CONV-01',
    movilidad_por_convenio: 'Si',
    estado_provincia_departamento: 'Cundinamarca',
    ciudad_municipio: 'Bogotá'
  },
  {
    periodo: '2024-2',
    alcance_movilidad: 'Internacional',
    direccion_movilidad: 'Entrante',
    tipo_persona: 'DOCENTE',
    pais_extranjero: 'ESCUADOR',
    programa_dependencia: 'Derecho',
    actividad_movilidad: 'Clase espejo',
    tipo_movilidad: 'Misión',
    modalidad: 'Virtual',
    institucion_extranjera: 'Universidad Central',
    codigo_convenio: 'CONV-02',
    movilidad_por_convenio: 'Si',
    estado_provincia_departamento: 'Pichincha',
    ciudad_municipio: 'Quito'
  },
  {
    periodo: '2025-1',
    alcance_movilidad: 'Internacional',
    direccion_movilidad: 'Saliente',
    tipo_persona: 'ADMINISTRATIVO',
    pais_extranjero: '218 ECU',
    programa_dependencia: 'Administración de Empresas',
    actividad_movilidad: 'Capacitación',
    tipo_movilidad: 'Curso corto',
    modalidad: 'Presencial',
    institucion_extranjera: 'ESPOL',
    codigo_convenio: '',
    movilidad_por_convenio: 'No',
    estado_provincia_departamento: 'Guayas',
    ciudad_municipio: 'Guayaquil'
  }
];

test('sin filtros devuelve catalogos iguales a masterCatalogos y conteos completos', () => {
  const prepared = prepareMovilidadRows(sampleRows);
  const { catalogos: masterCatalogos, catalogosCounts: masterCounts } = buildMasterCatalogosWithCounts(prepared);

  const payload = buildMovilidadDashboardPayload(prepared, masterCatalogos, {}, masterCounts);

  assert.equal(payload.total, 3);
  assert.deepEqual(payload.catalogos, payload.masterCatalogos);
  assert.deepEqual(payload.catalogosCounts, masterCounts);
  assert.deepEqual(payload.catalogosCounts.alcances, { Internacional: 2, Nacional: 1 });
  assert.deepEqual(payload.catalogosCounts.paises, { Colombia: 1, Ecuador: 2 });
});

test('filtrar alcance = Nacional aplica faceteo N-1 reduciendo demás filtros y preservando masterCatalogos', () => {
  const prepared = prepareMovilidadRows(sampleRows);
  const { catalogos: masterCatalogos, catalogosCounts: masterCounts } = buildMasterCatalogosWithCounts(prepared);

  const payload = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    alcance: 'Nacional'
  }, masterCounts);

  assert.equal(payload.total, 1);
  assert.deepEqual(payload.byAlcance, [{ name: 'Nacional', value: 1 }]);
  assert.deepEqual(payload.catalogos.alcances, ['Internacional', 'Nacional']);
  assert.deepEqual(payload.catalogosCounts.alcances, { Internacional: 2, Nacional: 1 });
  assert.deepEqual(payload.catalogos.paises, ['Colombia']);
  assert.deepEqual(payload.catalogosCounts.paises, { Colombia: 1 });
  assert.deepEqual(payload.catalogos.periodos, ['2024-1']);
  assert.deepEqual(payload.catalogos.direcciones, ['Saliente']);
  assert.deepEqual(payload.catalogos.tiposPersona, ['ESTUDIANTE']);
  assert.deepEqual(payload.masterCatalogos.paises, ['Colombia', 'Ecuador']);
  assert.deepEqual(payload.masterCatalogos.periodos, ['2024-1', '2024-2', '2025-1']);
});

test('bidireccionalidad inversa: filtrar pais = Ecuador captura alias y reduce alcances y periodos', () => {
  const prepared = prepareMovilidadRows(sampleRows);
  const masterCatalogos = buildMasterCatalogos(prepared);

  const payload = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    pais: 'Ecuador'
  });

  assert.equal(payload.total, 2);
  assert.deepEqual(payload.byPais, [{ name: 'Ecuador', value: 2 }]);
  assert.deepEqual(payload.catalogos.paises, ['Colombia', 'Ecuador']);
  assert.deepEqual(payload.catalogos.alcances, ['Internacional']);
  assert.deepEqual(payload.catalogosCounts.alcances, { Internacional: 2 });
  assert.deepEqual(payload.catalogos.periodos, ['2024-2', '2025-1']);
  assert.equal(payload.sniesPersonDirection.docentes.entrantes, 1);
  assert.equal(payload.sniesPersonDirection.administrativos.salientes, 1);
});

test('combinacion de dos filtros (alcance = Internacional + direccion = Entrante) cruza facetas N-1 con precision', () => {
  const prepared = prepareMovilidadRows(sampleRows);
  const { catalogos: masterCatalogos, catalogosCounts: masterCounts } = buildMasterCatalogosWithCounts(prepared);

  const payload = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    alcance: 'Internacional',
    direccion: 'Entrante'
  }, masterCounts);

  assert.equal(payload.total, 1);
  assert.deepEqual(payload.catalogos.alcances, ['Internacional']);
  assert.deepEqual(payload.catalogos.direcciones, ['Entrante', 'Saliente']);
  assert.deepEqual(payload.catalogosCounts.direcciones, { Entrante: 1, Saliente: 1 });
  assert.deepEqual(payload.catalogos.periodos, ['2024-2']);
  assert.deepEqual(payload.catalogos.paises, ['Ecuador']);
  assert.deepEqual(payload.catalogos.tiposPersona, ['DOCENTE']);
});

test('filtro explicito __NONE__ retorna total 0 preservando catalogos coherentes', () => {
  const prepared = prepareMovilidadRows(sampleRows);
  const { catalogos: masterCatalogos, catalogosCounts: masterCounts } = buildMasterCatalogosWithCounts(prepared);

  const payloadOnlyNone = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    alcance: [NONE_FILTER_VALUE]
  }, masterCounts);

  assert.equal(payloadOnlyNone.total, 0);
  assert.deepEqual(payloadOnlyNone.byPeriodo, []);
  assert.deepEqual(payloadOnlyNone.byPais, []);
  assert.deepEqual(payloadOnlyNone.heatmapPeriodoDireccion, {});
  assert.deepEqual(payloadOnlyNone.catalogos, masterCatalogos);
  assert.deepEqual(payloadOnlyNone.masterCatalogos, masterCatalogos);

  const payloadWithOtherFilter = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    alcance: 'Nacional',
    direccion: [NONE_FILTER_VALUE]
  }, masterCounts);

  assert.equal(payloadWithOtherFilter.total, 0);
  assert.deepEqual(payloadWithOtherFilter.catalogos.paises, ['Colombia']);
  assert.deepEqual(payloadWithOtherFilter.catalogos.direcciones, ['Saliente']);
  assert.deepEqual(payloadWithOtherFilter.masterCatalogos, masterCatalogos);
});

test('filtrar por programa aplica faceteo N-1, unifica variantes con tildes y soporta comas en el nombre', () => {
  const rowsWithVariants = [
    ...sampleRows,
    {
      ...sampleRows[0],
      periodo: '2025-2',
      programa_dependencia: 'Contaduria Publica'
    },
    {
      ...sampleRows[1],
      periodo: '2025-2',
      programa_dependencia: 'CONTADURÍA PÚBLICA'
    },
    {
      ...sampleRows[2],
      periodo: '2025-2',
      programa_dependencia: 'Crédito, Cartera y Cobranzas'
    }
  ];

  const prepared = prepareMovilidadRows(rowsWithVariants);
  const { catalogos: masterCatalogos, catalogosCounts: masterCounts } = buildMasterCatalogosWithCounts(prepared);

  assert.equal(masterCounts.programas['CONTADURÍA PÚBLICA'], 2);
  assert.equal(masterCounts.programas['Contaduria Publica'], undefined);
  assert.ok(masterCatalogos.programas.includes('Crédito, Cartera y Cobranzas'));

  const payloadContaduria = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    programa: 'CONTADURÍA PÚBLICA'
  }, masterCounts);

  assert.equal(payloadContaduria.total, 2);
  assert.deepEqual(payloadContaduria.catalogos.periodos, ['2025-2']);
  assert.deepEqual(payloadContaduria.catalogos.paises, ['Colombia', 'Ecuador']);
  assert.equal(payloadContaduria.catalogos.programas.length, masterCatalogos.programas.length);

  const payloadConComa = buildMovilidadDashboardPayload(prepared, masterCatalogos, {
    programa: 'Crédito, Cartera y Cobranzas'
  }, masterCounts);

  assert.equal(payloadConComa.total, 1);
  assert.deepEqual(payloadConComa.catalogos.periodos, ['2025-2']);
  assert.deepEqual(payloadConComa.catalogos.tiposPersona, ['ADMINISTRATIVO']);
  assert.deepEqual(payloadConComa.byPrograma, [{ name: 'Crédito, Cartera y Cobranzas', value: 1 }]);
});
