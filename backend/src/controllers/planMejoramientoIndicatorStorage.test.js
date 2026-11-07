const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PlanMejoramiento } = require('../models');
const catalog = require('../services/institutionalPolicyCatalogService');
const controller = require('./planMejoramientoController');

test('server stores the equal-weight evidenced indicator average instead of trusting a client total', async () => {
  const originals = [PlanMejoramiento.create, catalog.listPolicies];
  let stored;
  PlanMejoramiento.create = async (values) => { stored = values; return { id: 1, toJSON: () => ({ id: 1, ...values }) }; };
  catalog.listPolicies = async () => [];
  const activity = { indicadorResultadoActivo: true, indicadorResultado: 'Informes', metaResultado: 'Uno', fechaInicioResultado: '2026-01-01', fechaFinResultado: '2026-12-31',
    indicadorLogroActivo: true, indicadorLogro: 'Cobertura', metaLogro: 'Total', fechaInicioLogro: '2026-01-01', fechaFinLogro: '2026-12-31', metaAlcanzada: 999,
    seguimientoIndicadores: { Resultado: { porcentaje: 100, fecha: '2026-01-02', evidencias: [{ driveFileId: 'r' }] }, Logro: { porcentaje: 50, fecha: '2026-01-02', evidencias: [{ driveFileId: 'l' }] } } };
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  try {
    await controller.create({ user: { id: 3 }, body: { programa: 'Prueba', contenido: { objetivos: [{ actividades: [activity] }] } } }, res);
    assert.equal(res.code, 201, JSON.stringify(res.body));
    assert.equal(stored.contenido.objetivos[0].actividades[0].metaAlcanzada, 75);
    assert.equal(res.body.data.resumen.avance, 75);
  } finally { [PlanMejoramiento.create, catalog.listPolicies] = originals; }
});

test('server rejects an incomplete active indicator before creating a database record', async () => {
  const original = PlanMejoramiento.create;
  let writes = 0;
  PlanMejoramiento.create = async () => { writes += 1; };
  try {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await controller.create({ user: { id: 1 }, body: { programa: 'Prueba', contenido: { objetivos: [{ actividades: [{ indicadorLogroActivo: true }] }] } } }, res);
    assert.equal(res.code, 422);
    assert.equal(writes, 0);
    assert.match(res.body.message, /obligatorio/);
  } finally { PlanMejoramiento.create = original; }
});

test('creation writes independent indicators, text targets, dates and inactive flags to JSONB', async () => {
  const original = [PlanMejoramiento.create, catalog.listPolicies];
  const activity = {
    uid: 'activity-1', nombre: 'Reportes',
    indicadorResultado: 'Informes entregados', metaResultado: '12 informes', fechaEntregaResultado: '2026-12-10', fechaInicioResultado: '2026-11-01', indicadorResultadoActivo: true,
    indicadorLogro: 'Cobertura', metaLogro: 'Nivel A2', fechaEntregaLogro: '2026-12-11', indicadorLogroActivo: false,
    indicadorImpacto: '', metaImpacto: '', fechaEntregaImpacto: '', indicadorImpactoActivo: false
  };
  let stored;
  PlanMejoramiento.create = async (values) => {
    // JSON serialization mirrors the shape sent to PostgreSQL's JSONB column.
    stored = JSON.parse(JSON.stringify(values));
    return { ...stored, id: 1, toJSON() { return { ...stored, id: 1 }; } };
  };
  catalog.listPolicies = async () => [];
  try {
    const res = { status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } };
    await controller.create({ user: { id: 1 }, body: { programa: 'Prueba', periodo_inicio: 2026, periodo_fin: 2028,
      contenido: { objetivos: [{ codigo: 'OPM_01', actividades: [{ ...activity, fechaInicio: '2026-01-01', fechaFin: '2026-12-31' }] }] } } }, res);
    assert.equal(res.code, 201, JSON.stringify(res.body));
    const saved = stored.contenido.objetivos[0].actividades[0];
    for (const [key, value] of Object.entries(activity)) assert.deepEqual(saved[key], value, key);
    assert.equal(Object.hasOwn(saved, 'fechaInicio'), false);
    assert.equal(Object.hasOwn(saved, 'fechaFin'), false);
  } finally {
    [PlanMejoramiento.create, catalog.listPolicies] = original;
  }
});
