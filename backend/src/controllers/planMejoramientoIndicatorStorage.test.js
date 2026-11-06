const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PlanMejoramiento } = require('../models');
const catalog = require('../services/institutionalPolicyCatalogService');
const controller = require('./planMejoramientoController');

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
