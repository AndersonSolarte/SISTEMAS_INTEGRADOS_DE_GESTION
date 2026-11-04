const { test } = require('node:test');
const assert = require('node:assert/strict');
const XLSX = require('xlsx');
const { sequelize } = require('../config/database');
const { GestionInformacionCarga, UserModulePermission } = require('../models');
const catalog = require('../services/institutionalPolicyCatalogService');
const controller = require('./institutionalPolicyController');
const router = require('../routes/institutionalPolicyRoutes');
const { auth } = require('../middlewares/auth');
const response = () => ({ headers: {}, statusCode: 200,
  setHeader(key, value) { this.headers[key] = value; },
  status(code) { this.statusCode = code; return this; },
  json(value) { this.body = value; return this; },
  send(value) { this.body = value; return this; }
});

test('empty template contains the exact columns used by the shared importer', () => {
  const res = response();
  controller.template({}, res);
  const book = XLSX.read(res.body, { type: 'buffer' });
  const rows = XLSX.utils.sheet_to_json(book.Sheets[book.SheetNames[0]], { header: 1 });
  assert.deepEqual(rows, [['Políticas', 'Líneas de Acción']]);
});

test('Excel export round-trips all policies and their own action lines', async () => {
  const original = catalog.listPolicies;
  catalog.listPolicies = async () => [{ id: 1, name: 'Política A', actionLines: ['Línea 1', 'Línea 2'] }, { id: 2, name: 'Política B', actionLines: ['Línea 3'] }];
  try {
    const res = response();
    await controller.exportData({ query: { format: 'xlsx' } }, res);
    const parsed = catalog.parsePolicyWorkbook(res.body);
    assert.deepEqual(parsed.map(({ name, actionLines }) => ({ name, actionLines })), (await catalog.listPolicies()).map(({ name, actionLines }) => ({ name, actionLines })));
  } finally { catalog.listPolicies = original; }
});

test('CSV export can be imported and JSON returns the same shared catalog', async () => {
  const original = catalog.listPolicies;
  catalog.listPolicies = async () => [{ id: 1, name: 'Política institucional', actionLines: ['Línea institucional'] }];
  try {
    const csv = response();
    await controller.exportData({ query: { format: 'csv' } }, csv);
    assert.equal(catalog.parsePolicyWorkbook(Buffer.from(csv.body))[0].name, 'Política institucional');
    const json = response();
    await controller.exportData({ query: { format: 'json' } }, json);
    assert.deepEqual(JSON.parse(json.body), await catalog.listPolicies());
    const list = response();
    await controller.list({}, list);
    assert.deepEqual(list.body.data, JSON.parse(json.body));
  } finally { catalog.listPolicies = original; }
});

test('central import and its load history use the same database transaction', async () => {
  const originalTransaction = sequelize.transaction;
  const originalImport = catalog.importPolicies;
  const originalHistory = GestionInformacionCarga.create;
  const transaction = { marker: 'shared' };
  let history;
  sequelize.transaction = async (apply) => apply(transaction);
  catalog.importPolicies = async (policies, options) => {
    assert.equal(options.transaction, transaction);
    assert.equal(policies[0].name, 'Política A');
    return { importedPolicies: 1, created: 1, addedLines: 1 };
  };
  GestionInformacionCarga.create = async (data, options) => { assert.equal(options.transaction, transaction); history = data; };
  try {
    const res = response();
    await controller.importData({ user: { id: 10 }, file: { originalname: 'catalogo.xlsx', buffer: XLSX.write(controller.buildWorkbook([{ name: 'Política A', actionLines: ['Línea 1'] }]), { type: 'buffer', bookType: 'xlsx' }) } }, res);
    assert.equal(res.body.success, true);
    assert.equal(history.categoria, 'Políticas institucionales');
    assert.equal(history.total_cargados, 1);
  } finally { sequelize.transaction = originalTransaction; catalog.importPolicies = originalImport; GestionInformacionCarga.create = originalHistory; }
});

test('central import/export require database capabilities and all reads require authentication', async () => {
  assert.equal(router.stack[0].handle, auth);
  const original = UserModulePermission.count;
  UserModulePermission.count = async () => 0;
  try {
    for (const path of ['/plantilla', '/importar', '/exportar']) {
      const check = router.stack.find((layer) => layer.route?.path === path).route.stack[0].handle;
      const denied = response();
      await check({ user: { id: 11, role: 'autoevaluacion' } }, denied, () => assert.fail('Module role must not grant database write/export access'));
      assert.equal(denied.statusCode, 403);
      let allowed = false;
      await check({ user: { id: 1, role: 'administrador' } }, response(), () => { allowed = true; });
      assert.equal(allowed, true);
    }
  } finally { UserModulePermission.count = original; }
});
