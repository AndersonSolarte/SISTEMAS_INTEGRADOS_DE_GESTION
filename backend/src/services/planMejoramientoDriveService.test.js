const test = require('node:test');
const assert = require('node:assert/strict');
const { cleanName, findOrCreateFolder } = require('./planMejoramientoDriveService');

test('normaliza nombres seguros para la estructura de evidencias', () => {
  assert.equal(cleanName('  C10: Número / dedicación * docente  '), 'C10- Numero - dedicacion - docente');
});

test('reutiliza una carpeta de actividad existente en lugar de duplicarla', async () => {
  let createCalls = 0;
  const drive = {
    files: {
      list: async () => ({ data: { files: [{ id: 'folder-1', name: 'ACT_01 - Informe', appProperties: { siacPlanMejoramientoKey: 'activity-1' } }] } }),
      create: async () => { createCalls += 1; return { data: { id: 'folder-new' } }; },
      update: async () => ({ data: { id: 'folder-1' } })
    }
  };
  const id = await findOrCreateFolder(drive, { parentId: 'root', name: 'ACT_01 - Informe', key: 'activity-1' });
  assert.equal(id, 'folder-1');
  assert.equal(createCalls, 0);
});
