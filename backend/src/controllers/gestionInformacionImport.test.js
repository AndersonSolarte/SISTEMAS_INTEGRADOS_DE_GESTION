const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const XLSX = require('xlsx');

test('imports historical and resolution workbooks using the selected sheet outside the reader block', async () => {
  const controllerPath = path.join(__dirname, 'gestionInformacionController.js');
  const controllerRequire = createRequire(controllerPath);
  const writes = [];
  const removals = [];
  const model = (name) => ({
    sync: async () => {},
    destroy: async () => { removals.push(name); },
    create: async (payload) => { writes.push({ name, payload }); },
    sequelize: { getQueryInterface: () => ({
      describeTable: async () => ({}),
      addColumn: async () => {}
    }) }
  });
  const models = {
    ...controllerRequire('../models'),
    RegistroCalificadoHistorico: model('historico'),
    RegistroCalificadoResolucion: model('resoluciones'),
    GestionInformacionCarga: model('historial')
  };
  const sandbox = {
    require: (name) => name === '../models' ? models : controllerRequire(name),
    module: { exports: {} }, console, process, Buffer, setTimeout, clearTimeout
  };
  vm.runInNewContext(fs.readFileSync(controllerPath, 'utf8'), sandbox, { filename: controllerPath });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-import-'));
  try {
    for (const [subcategoria, sheet, expectedModel] of [
      ['Historico_RC', 'Historico_RC', 'historico'],
      ['Resoluciones', 'Resoluciones', 'resoluciones'],
      ['Historico_RC', 'RESOLUCIONES', 'resoluciones']
    ]) {
      writes.length = 0;
      removals.length = 0;
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([
        ['Programa académico', 'Nivel'], ['Ingeniería de Sistemas', 'Pregrado']
      ]), sheet);
      const filePath = path.join(directory, 'import.xlsx');
      XLSX.writeFile(workbook, filePath);
      let status = 200;
      let response;
      await sandbox.module.exports.importFromExcel({
        body: { categoria: 'Registros Calificados y Acreditación', subcategoria },
        file: { path: filePath, originalname: 'import.xlsx' }, user: { id: 1 }
      }, {
        status(value) { status = value; return this; },
        json(value) { response = value; return this; }
      });
      assert.equal(status, 200, response?.message);
      assert.equal(response.success, true);
      assert.equal(response.data.importados, 1, JSON.stringify(response.data.errores));
      assert.deepEqual(removals, ['historial', expectedModel]);
      assert.equal(writes[0].name, expectedModel);
      assert.equal(writes[1].name, 'historial');
      assert.equal(fs.existsSync(filePath), false);
    }
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
