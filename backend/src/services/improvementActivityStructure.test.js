const { test } = require('node:test');
const assert = require('node:assert/strict');
const { stripContentActivityDates, migrateLegacyActivityDates } = require('./improvementActivityStructure');
test('removes only retired activity dates, keeping indicator schedules and progress', () => {
  const activity = { uid: 'one', fechaInicio: '2026-01-01', fechaFin: '2026-12-31', fechaEntregaResultado: '2026-11-20', metaResultado: '12 reportes', metaAlcanzada: 73 };
  const content = { programa: 'Prueba', objetivos: [{ actividades: [activity] }] };
  const result = stripContentActivityDates(content);
  assert.equal(result.objetivos[0].actividades[0].fechaInicio, undefined);
  assert.equal(result.objetivos[0].actividades[0].fechaFin, undefined);
  assert.equal(result.objetivos[0].actividades[0].fechaEntregaResultado, '2026-11-20');
  assert.equal(result.objetivos[0].actividades[0].metaAlcanzada, 73);
  assert.equal(activity.fechaInicio, '2026-01-01');
  assert.deepEqual(stripContentActivityDates(result), result);
});
test('migration cleans existing JSONB once and preserves all other information', async () => {
  const { sequelize } = require('../config/database');
  const { PlanMejoramiento } = require('../models');
  const original = [sequelize.transaction, PlanMejoramiento.findAll];
  let updates = 0;
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const row = { id: 1, contenido: { objetivos: [{ actividades: [{ fechaInicio: '2026-01-01', fechaFin: '2026-12-31', fechaEntregaLogro: '2026-11-20' }] }] },
    async update(values, options) { assert.equal(options.transaction, transaction); this.contenido = values.contenido; updates += 1; } };
  sequelize.transaction = async (fn) => fn(transaction);
  let calls = 0;
  PlanMejoramiento.findAll = async () => (++calls % 2 ? [row] : []);
  try {
    assert.equal(await migrateLegacyActivityDates(), 1);
    assert.equal(await migrateLegacyActivityDates(), 0);
    assert.equal(updates, 1);
    assert.equal(row.contenido.objetivos[0].actividades[0].fechaEntregaLogro, '2026-11-20');
  } finally { [sequelize.transaction, PlanMejoramiento.findAll] = original; }
});
