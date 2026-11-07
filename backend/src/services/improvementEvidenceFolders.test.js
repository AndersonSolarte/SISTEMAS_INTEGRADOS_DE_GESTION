const { test } = require('node:test');
const assert = require('node:assert/strict');
const { google } = require('googleapis');
const { Readable } = require('node:stream');
const { evidenceName } = require('./improvementEvidenceLabels');
const { ensurePlanRepository, uploadActivityEvidence, readActivityEvidence } = require('./planMejoramientoDriveService');

test('ordered indicator folders are reused, files retain their IDs and private reads include only activity subfolders', async () => {
  const keys = ['PLAN_IMPROVEMENT_GOOGLE_CLIENT_ID', 'PLAN_IMPROVEMENT_GOOGLE_CLIENT_SECRET', 'PLAN_IMPROVEMENT_GOOGLE_REFRESH_TOKEN', 'SIAC_PLAN_IMPROVEMENT_DRIVE_ROOT_ID'];
  const previous = keys.map((key) => process.env[key]);
  keys.forEach((key, index) => { process.env[key] = index === 2 ? '1//test' : index === 3 ? 'root' : 'test'; });
  const originalDrive = google.drive;
  const folderMime = 'application/vnd.google-apps.folder';
  const objects = new Map([['root', { id: 'root', mimeType: folderMime, parents: [] }]]);
  let counter = 0;
  google.drive = () => ({ files: {
    get: async ({ fileId, alt }) => {
      if (alt) return { data: Readable.from(['content']) };
      if (!objects.has(fileId)) throw Object.assign(new Error('Missing'), { code: 404 });
      return { data: { ...objects.get(fileId) } };
    },
    list: async ({ q }) => {
      const parent = q.match(/^'([^']+)' in parents/)[1];
      const marker = q.match(/and value='([^']+)'/);
      const files = [...objects.values()].filter((object) => object.parents.includes(parent) && (marker ? Object.values(object.appProperties || {}).includes(marker[1]) : object.mimeType !== folderMime));
      return { data: { files } };
    },
    create: async ({ requestBody }) => {
      const object = { ...requestBody, id: `id-${++counter}`, mimeType: requestBody.mimeType || 'application/pdf' };
      objects.set(object.id, object);
      return { data: object };
    },
    update: async ({ fileId, requestBody, addParents, removeParents }) => {
      const object = objects.get(fileId);
      Object.assign(object, requestBody);
      if (removeParents) object.parents = object.parents.filter((id) => id !== removeParents);
      if (addParents) object.parents.push(addParents);
      return { data: object };
    }
  } });
  try {
    const plan = { id: 1, periodo_inicio: 2026, periodo_fin: 2028, programa: 'Derecho', contenido: { objetivos: [{ codigo: 'OPM_01', actividades: [{ uid: 'activity', nombre: 'Informar', indicadorResultadoActivo: true, indicadorLogroActivo: true, indicadorImpactoActivo: true }] }] } };
    const first = await ensurePlanRepository(plan);
    const names = Object.values(first.activities[0].indicatorFolders).map((folder) => objects.get(folder.folderId).name);
    assert.deepEqual(names, ['01 - Evidencias de resultado', '02 - Evidencias de logro', '03 - Evidencias de impacto']);
    const count = counter;
    await ensurePlanRepository(plan);
    assert.equal(counter, count);
    const uploaded = await uploadActivityEvidence(plan, 'activity', { originalname: 'informe.pdf', mimetype: 'application/pdf', buffer: Buffer.from('test') }, 'Logro');
    const fileId = uploaded.evidence.driveFileId;
    assert.equal(objects.get(fileId).name, '[Evidencia de logro] informe.pdf');
    assert.deepEqual(objects.get(fileId).parents, [first.activities[0].indicatorFolders.Logro.folderId]);
    const activity = uploaded.content.objetivos[0].actividades[0];
    assert.equal((await readActivityEvidence(activity))[0].indicatorKind, 'Logro');
    assert.equal((await readActivityEvidence(activity, fileId)).mimeType, 'application/pdf');
    objects.set('outside', { id: 'outside', mimeType: folderMime, parents: ['another-activity'] });
    activity.indicatorEvidenceFolders.Impacto = { folderId: 'outside' };
    objects.set('secret', { id: 'secret', mimeType: 'application/pdf', parents: ['outside'] });
    await assert.rejects(readActivityEvidence(activity, 'secret'), { statusCode: 404 });
    // A known legacy file is moved rather than copied; its URL/ID stay valid.
    objects.get(fileId).parents = [activity.evidenceFolderId];
    objects.get(fileId).name = 'informe.pdf';
    activity.seguimientoIndicadores = { Logro: { evidencias: [{ driveFileId: fileId, nombre: 'informe.pdf' }] } };
    await ensurePlanRepository({ ...plan, contenido: uploaded.content });
    assert.deepEqual(objects.get(fileId).parents, [first.activities[0].indicatorFolders.Logro.folderId]);
    assert.equal(objects.get(fileId).name, '[Evidencia de logro] informe.pdf');
  } finally {
    google.drive = originalDrive;
    keys.forEach((key, index) => { if (previous[index] === undefined) delete process.env[key]; else process.env[key] = previous[index]; });
  }
});

test('labels preserve file extension and do not duplicate tags', () => {
  assert.equal(evidenceName('[Evidencia de resultado] informe.docx', 'Resultado'), '[Evidencia de resultado] informe.docx');
  const name = evidenceName(`${'a'.repeat(170)}.docx`, 'Impacto');
  assert.ok(name.length <= 180);
  assert.ok(name.endsWith('.docx'));
});
