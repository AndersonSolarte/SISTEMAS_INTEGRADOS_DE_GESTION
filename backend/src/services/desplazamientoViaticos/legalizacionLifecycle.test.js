const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../models');
const { ROLES } = require('../../constants/roles');
const controllerPath = require.resolve('../../controllers/legalizacionViaticosController');
const response = () => ({ statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; } });
const loadController = () => { delete require.cache[controllerPath]; return require(controllerPath); };

test('la lista del colaborador y el badge usan solo pendientes; el historial administrativo permanece', async (t) => {
  const states = ['pendiente_legalizacion', 'legalizacion_vencida', 'en_revision', 'finalizada', 'pendiente_habilitacion', 'en_revision_contabilidad', 'devuelta_tecnico'];
  const entries = states.map((estado, i) => ({ id: i + 1, estado, fecha_habilitacion: i === 4 ? '2099-01-01' : '2000-01-01', fecha_limite: i === 0 ? '2099-01-01' : '2000-01-05', adjuntos: [] }));
  const solicitudes = entries.map((legalizacion) => ({ legalizacion, toJSON() { return { id: legalizacion.id, legalizacion }; } }));
  t.mock.method(models.DesplazamientoViaticosSolicitud, 'findAll', async (options) => {
    if (options.where?.user_id !== undefined) assert.equal(options.where.user_id, 7);
    return solicitudes;
  });
  t.mock.method(models.ViaticosLegalizacion, 'findAll', async (options) => { assert.equal(options.where.user_id, 7); return entries; });
  const ctrl = loadController();
  const own = response(); await ctrl.listarPropias({ user: { id: 7 } }, own);
  assert.deepEqual(own.body.data.map((row) => row.legalizacion.id), [1, 2]);
  const badge = response(); await ctrl.estadoPropio({ user: { id: 7 } }, badge);
  assert.equal(badge.body.active, 2);
  const admin = response(); await ctrl.listarGestion({ user: { id: 1, role: ROLES.ADMINISTRADOR }, query: {} }, admin);
  assert.equal(admin.body.data.length, 7);
  entries[0].estado = 'en_revision'; entries[1].estado = 'finalizada';
  const cleared = response(); await ctrl.estadoPropio({ user: { id: 7 } }, cleared);
  assert.equal(cleared.body.active, 0);
});
