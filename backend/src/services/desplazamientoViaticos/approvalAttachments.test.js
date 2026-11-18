const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { encryptPayload } = require('../../utils/secureUrlToken');
const models = require('../../models');
const controller = require('../../controllers/desplazamientoViaticosController');
const { resolveApprovalSupport } = require('./approvalAttachments');
const root = path.resolve(__dirname, '../../../uploads/desplazamientos_viaticos');

const response = () => ({
  headers: {}, code: 200, setHeader(name, value) { this.headers[name] = value; },
  status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; },
  sendFile(filename) { this.filepath = filename; return this; }
});
const setup = t => {
  const token = encryptPayload({ purpose: 'desplazamiento_viaticos_action', solicitudId: 42, stage: 'jefe', accessSource: 'primary' }, 300);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const solicitud = { id: 42, paso_actual: 0, token_etapa: 'jefe', token_accion_hash: hash,
    plan_aprobacion: [{ key: 'jefe', label: 'Jefe inmediato', actionTokenHashes: [{ hash }] }],
    datos_viaticos: { soporteAdjunto: { filename: 'oficio-firmado.pdf', originalName: 'Oficio firmado.pdf' } },
    solicitante_snapshot: {}, datos_laborales: {}, datos_salida: {}, trazabilidad: [] };
  const lookup = t.mock.method(models.DesplazamientoViaticosSolicitud, 'findByPk', async id => Number(id) === 42 ? solicitud : null);
  const originalRealpath = fs.realpathSync;
  const originalStat = fs.statSync;
  t.mock.method(fs, 'realpathSync', input => String(input).startsWith(root) ? String(input) : originalRealpath(input));
  t.mock.method(fs, 'statSync', input => input === path.join(root, 'oficio-firmado.pdf') ? { isFile: () => true } : originalStat(input));
  return { token, solicitud, lookup };
};

test('el enlace activo lista el oficio sin exponer rutas internas y lo sirve inline con MIME seguro', async t => {
  const { token } = setup(t);
  const manifest = response();
  await controller.listarAdjuntosAccion({ params: { token } }, manifest);
  assert.equal(manifest.code, 200); assert.equal(manifest.body.files.length, 1);
  assert.equal(manifest.body.files[0].name, 'Oficio firmado.pdf');
  assert.ok(!JSON.stringify(manifest.body).includes(root));
  assert.equal(manifest.headers['Cache-Control'], 'no-store');
  const file = response();
  await controller.verAdjuntoAccion({ params: { token, adjuntoId: 'soporte' } }, file);
  assert.equal(file.filepath, path.join(root, 'oficio-firmado.pdf'));
  assert.equal(file.headers['Content-Type'], 'application/pdf');
  assert.match(file.headers['Content-Disposition'], /^inline;/);
  assert.equal(file.headers['X-Content-Type-Options'], 'nosniff');
  assert.match(file.headers['Content-Security-Policy'], /sandbox/);
});

test('un token consumido, reenviado o de otra solicitud no permite consultar archivos', async t => {
  const { token, solicitud } = setup(t);
  for (const invalidate of [
    () => { solicitud.token_etapa = 'sst'; },
    () => { solicitud.token_etapa = 'jefe'; solicitud.token_accion_hash = null; solicitud.plan_aprobacion[0].actionTokenHashes = []; }
  ]) {
    invalidate();
    for (const action of [controller.listarAdjuntosAccion, controller.verAdjuntoAccion]) {
      const res = response(); await action({ params: { token, adjuntoId: 'soporte' } }, res);
      assert.equal(res.code, 410); assert.equal(res.filepath, undefined);
    }
  }
  const expired = encryptPayload({ purpose: 'desplazamiento_viaticos_action', solicitudId: 42, stage: 'jefe' }, -10);
  const invalid = response(); await controller.listarAdjuntosAccion({ params: { token: expired } }, invalid);
  assert.equal(invalid.code, 410);
});

test('no admite rutas arbitrarias, tipos activos ni enlaces simbólicos fuera del directorio', t => {
  const { solicitud } = setup(t);
  for (const filename of ['../../secreto.pdf', '..\\secreto.pdf', 'archivo.html', 'script.svg', 'desconocido.pdf']) {
    solicitud.datos_viaticos.soporteAdjunto.filename = filename;
    assert.equal(resolveApprovalSupport(solicitud), null, filename);
  }
  solicitud.datos_viaticos.soporteAdjunto.filename = 'oficio-firmado.pdf';
  t.mock.method(fs, 'realpathSync', input => input === root ? root : path.resolve(root, '../otro/archivo.pdf'));
  assert.equal(resolveApprovalSupport(solicitud), null);
});

test('el botón de cabecera y el visor se incluyen en las etapas reales sin scripts incrustados', t => {
  const { token, solicitud } = setup(t);
  const html = controller._internals.approvalForm(solicitud, solicitud.plan_aprobacion[0], token);
  const header = html.slice(html.indexOf('class="brand-bar"'), html.indexOf('<section class="body">'));
  assert.match(header, /Visualizar documentos adjuntos/);
  assert.match(html, /<dialog[^>]+aria-labelledby="attachment-title"/);
  assert.match(html, /assets\/adjuntos.js\?v=\d+" defer/);
  assert.doesNotMatch(html, /\sonclick=/);
  const demo = controller._internals.liquidacionForm(solicitud, token, 'nonce', { demo: true });
  assert.ok(!demo.includes('data-open-attachments'));
});
