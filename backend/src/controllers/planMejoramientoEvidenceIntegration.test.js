const { test } = require('node:test');
const assert = require('node:assert/strict');
const { PlanMejoramiento } = require('../models');
const drive = require('../services/planMejoramientoDriveService');
const preview = require('../services/improvementEvidencePreview');
const controller = require('./planMejoramientoController');

test('upload route forwards the indicator and persists its evidence in that lane', async () => {
  const originals = [PlanMejoramiento.findByPk, drive.uploadActivityEvidence];
  const activity = { uid: 'activity', indicadorResultadoActivo: true, indicadorResultado: 'Informes' };
  let saved;
  const plan = { id: 1, contenido: { objetivos: [{ actividades: [activity] }] }, async update(values) { saved = values.contenido; } };
  PlanMejoramiento.findByPk = async () => plan;
  drive.uploadActivityEvidence = async (actualPlan, uid, file, kind) => {
    assert.equal(actualPlan, plan);
    assert.equal(uid, 'activity');
    assert.equal(kind, 'Resultado');
    assert.ok(file.buffer);
    return { content: JSON.parse(JSON.stringify(plan.contenido)), evidence: { driveFileId: 'file', nombre: '[Evidencia de resultado] informe.pdf' } };
  };
  const res = { status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  try {
    await controller.uploadActivityEvidence({ params: { id: 1, uid: 'activity' }, body: { indicator_kind: 'Resultado' }, user: { id: 3 }, file: { originalname: 'informe.pdf', buffer: Buffer.from('test') } }, res);
    assert.equal(res.code, 201, JSON.stringify(res.body));
    assert.equal(saved.objetivos[0].actividades[0].seguimientoIndicadores.Resultado.evidencias[0].driveFileId, 'file');
    assert.equal(saved.objetivos[0].actividades[0].metaAlcanzada, 0);
  } finally { [PlanMejoramiento.findByPk, drive.uploadActivityEvidence] = originals; }
});

test('authenticated preview route serves the converted document instead of the raw Word stream', async () => {
  const originals = [PlanMejoramiento.findByPk, drive.readActivityEvidence, preview.previewEvidence];
  PlanMejoramiento.findByPk = async () => ({ id: 1, contenido: { objetivos: [{ actividades: [{ uid: 'activity' }] }] } });
  drive.readActivityEvidence = async () => ({ mimeType: 'docx', stream: {} });
  preview.previewEvidence = async () => '<html><body>Vista de Word</body></html>';
  const res = { headers: {}, setHeader(key, value) { this.headers[key] = value; }, type(value) { this.contentType = value; return this; }, send(value) { this.body = value; return this; }, status(value) { this.code = value; return this; }, json(value) { this.body = value; return this; } };
  try {
    await controller.readActivityEvidence({ params: { id: 1, uid: 'activity', fileId: 'file' }, query: { preview: '1' }, user: { id: 3 } }, res);
    assert.equal(res.contentType, 'html');
    assert.match(res.body, /Vista de Word/);
    assert.equal(res.headers['Cache-Control'], 'private, no-store');
  } finally { [PlanMejoramiento.findByPk, drive.readActivityEvidence, preview.previewEvidence] = originals; }
});
