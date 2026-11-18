/* Prueba aislada: HTML y rutas reales, Chrome y CSP de producción; sin BD ni SMTP. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '../..');
// Solo el servidor de prueba local: comprobar también la configuración restrictiva.
process.env.NODE_ENV = process.env.VIATICOS_TEST_ENV || 'production';
// Credencial efímera del proceso de prueba; nunca lee ni cambia secretos reales.
process.env.JWT_SECRET = require('node:crypto').randomBytes(48).toString('hex');
const express = require(path.join(root, 'backend/node_modules/express'));
const cors = require(path.join(root, 'backend/node_modules/cors'));
const { corsOptionsForRequest } = require(path.join(root, 'backend/src/middlewares/security'));
const { handlePublicEmailCorsError } = require(path.join(root, 'backend/src/middlewares/publicEmailError'));
const { _internals } = require(path.join(root, 'backend/src/controllers/desplazamientoViaticosController'));

async function main() {
  const chrome = [process.env.VALIDATION_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean).find(fs.existsSync);
  assert.ok(chrome, 'Se requiere Chrome o Edge para probar CSP y digitación real.');
  const nginx = fs.readFileSync(path.join(root, 'frontend/security-headers.conf'), 'utf8').match(/add_header Content-Security-Policy "([^"]+)"/)[1];
  const backend = fs.readFileSync(path.join(root, 'backend/src/controllers/desplazamientoViaticosController.js'), 'utf8').match(/res.setHeader\("Content-Security-Policy", "([^"]+)"\)/)[1];
  const solicitud = {
    id: 42, consecutivo: 'PRUEBA-LOCAL-SIN-CORREOS', estado: 'pendiente',
    solicitante_snapshot: { nombre: 'PRUEBA LOCAL', documento: '123', email: 'prueba@example.invalid' },
    datos_laborales: { dependencia: 'Prueba', cargo: 'Prueba' }, datos_salida: {},
    datos_viaticos: { numeroDiasSolicitados: 2, centroCosto: 'CC-TEST', alojamiento: 'Hotel', tipoCuenta: 'Ahorros', entidadBancaria: 'Bancolombia', numeroCuenta: '123456' },
    plan_aprobacion: [], trazabilidad: [],
    liquidacion: { detalles: [{ detalle: 'Manutención', valorDiario: 50000, dias: 1, valorTotal: 50000 }], totalAnticipo: 50000 }
  };
  const submitted = [];
  const previewPdf = await require(path.join(root, 'backend/src/services/desplazamientoViaticos/pdfService')).buildLiquidationPdfBuffer(solicitud);
  const previewImage = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII=', 'base64');
  const app = express();
  app.use(cors(corsOptionsForRequest));
  app.use(express.urlencoded({ extended: false }));
  app.use((_req, res, next) => {
    res.setHeader('Content-Security-Policy', [nginx, backend]);
    res.setHeader('Referrer-Policy', 'no-referrer'); next();
  });
  app.get('/tecnico', (_req, res) => res.send(_internals.liquidacionForm(solicitud, 'aaa.bbb.ccc', 'nonce')));
  app.get('/tesoreria', (_req, res) => res.send(_internals.treasuryForm(solicitud, 'aaa.bbb.ccc')));
  app.get('/aprobar', (_req, res) => res.send(_internals.approvalForm(solicitud, {
    key: 'jefe', label: 'Director de Programa', alternateAccessSource: 'programa_alterno', alternateApprovalLabel: 'Programa Académico - Fisioterapia'
  }, 'aaa.bbb.ccc', { accessSource: 'programa_alterno' })));
  app.get('/bloqueado', (_req, res) => res.send('<script>window.inlineProbe=true</script>'));
  app.get('/api/desplazamientos-viaticos/accion/aaa.bbb.ccc/adjuntos', (_req, res) => res.json({ files: [
    { id: 'soporte', name: 'Oficio de prueba.pdf', url: '/api/desplazamientos-viaticos/accion/aaa.bbb.ccc/adjuntos/soporte' },
    { id: 'imagen', name: 'Soporte de prueba.png', url: '/api/desplazamientos-viaticos/accion/aaa.bbb.ccc/adjuntos/imagen' }
  ] }));
  app.get('/api/desplazamientos-viaticos/accion/aaa.bbb.ccc/adjuntos/:file', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.type(req.params.file === 'soporte' ? 'application/pdf' : 'image/png').send(req.params.file === 'soporte' ? previewPdf : previewImage);
  });
  app.post('/api/desplazamientos-viaticos/accion/aaa.bbb.ccc', (req, res) => {
    if (req.body.accion === 'aprobar') {
      submitted.push({ accion: req.body.accion, observacion: req.body.observacion, origin: req.headers.origin });
      return res.send('<p id="resultado">Visto bueno de prueba registrado sin correos.</p>');
    }
    const result = _internals.parseLiquidationBody(req.body);
    assert.equal(result.error, undefined);
    submitted.push({ accion: req.body.accion, result, origin: req.headers.origin });
    res.send('<p id="resultado">Envío local validado, sin BD ni correos.</p>');
  });
  // Montar el router real comprueba el acceso público y MIME del nuevo archivo.
  app.use('/api/desplazamientos-viaticos', require(path.join(root, 'backend/src/routes/desplazamientoViaticosRoutes')));
  app.use((error, req, res, _next) => {
    if (!handlePublicEmailCorsError(error, req, res)) res.status(403).json({ message: 'Origen rechazado' });
  });
  const server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'siac-viaticos-browser-'));
  const child = spawn(chrome, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync',
    `--user-data-dir=${profile}`, '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1',
    '--proxy-server=http://127.0.0.1:9', '--proxy-bypass-list=127.0.0.1;localhost', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let socket;
  const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
  try {
    let debugPort;
    for (let i = 0; i < 100; i++) {
      try { debugPort = fs.readFileSync(path.join(profile, 'DevToolsActivePort'), 'utf8').split('\n')[0]; } catch (_) {}
      if (debugPort) break;
      await wait(100);
    }
    assert.ok(debugPort, 'Chrome no inició.');
    const targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
    socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`Timeout: ${method}`)); }, 10000);
      pending.set(id, { resolve, reject, timeout }); socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data), item = pending.get(message.id);
      if (!item) return;
      pending.delete(message.id); clearTimeout(item.timeout);
      if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
    });
    const evaluate = async expression => {
      const result = await send('Runtime.evaluate', { expression, returnByValue: true });
      assert.ok(!result.exceptionDetails, JSON.stringify(result.exceptionDetails)); return result.result.value;
    };
    const until = async expression => {
      for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await wait(100); }
      throw new Error(`No se cumplió: ${expression}`);
    };
    const navigate = async pathname => {
      await send('Page.navigate', { url: origin + pathname });
      await until(`location.pathname === ${JSON.stringify(pathname)} && document.readyState === 'complete'`);
    };
    const type = async (name, value) => {
      const position = await evaluate(`(() => {const el=document.querySelector('[name="${name}"]'); if(!el||el.disabled||el.readOnly)return null;el.scrollIntoView({block:'center'});const rect=el.getBoundingClientRect();return {x:rect.x+rect.width/2,y:rect.y+rect.height/2};})()`);
      assert.ok(position, `Campo no editable: ${name}`);
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', button: 'left', clickCount: 1, ...position });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', button: 'left', clickCount: 1, ...position });
      assert.equal(await evaluate('document.activeElement.name'), name, `No se puede hacer clic en ${name}`);
      await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
      await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'a', code: 'KeyA', modifiers: 2, windowsVirtualKeyCode: 65 });
      await send('Input.insertText', { text: value });
      assert.equal(await evaluate(`document.querySelector('[name="${name}"]').value`), value);
    };
    await send('Page.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.cspErrors=[];addEventListener('securitypolicyviolation',e=>window.cspErrors.push(e.effectiveDirective));" });
    await navigate('/bloqueado');
    await until('window.cspErrors.length > 0');
    assert.equal(await evaluate('window.inlineProbe === undefined'), true, 'La CSP debe seguir bloqueando scripts incrustados.');

    await navigate('/tecnico');
    await until("document.getElementById('liquidacion-form').dataset.calculatorReady === 'true'");
    assert.equal(await evaluate("document.querySelectorAll('#liquidacion-detalles').length"), 1);
    await type('valorDiario0', '43000');
    assert.equal(await evaluate("document.querySelector('[name=dias0]').value"), '0');
    await type('observaciones', 'Nota local que debe conservarse al cerrar el visor.');
    await evaluate("document.querySelector('[data-open-attachments]').click()");
    await until("document.querySelector('.attachment-dialog').open && !!document.querySelector('.attachment-content iframe')");
    await wait(500);
    const screenshot = await send('Page.captureScreenshot', { format: 'png' });
    const previewDirectory = path.join(root, 'tmp/viaticos-oficio-preview');
    fs.mkdirSync(previewDirectory, { recursive: true });
    fs.writeFileSync(path.join(previewDirectory, 'visor-adjuntos.png'), Buffer.from(screenshot.data, 'base64'));
    await evaluate("document.querySelector('[data-file-id=imagen]').click()");
    await until("document.querySelector('.attachment-content img')?.naturalWidth === 1");
    await evaluate("document.querySelector('[data-close-attachments]').click()");
    assert.equal(await evaluate("document.querySelector('.attachment-dialog').open"), false);
    assert.equal(await evaluate("document.querySelector('[name=observaciones]').value"), 'Nota local que debe conservarse al cerrar el visor.');
    assert.equal(await evaluate("document.querySelector('[name=valorDiario0]').value"), '43000');
    await evaluate("document.querySelector('[value=liquidar]').click()");
    assert.equal(submitted.length, 0);
    assert.equal(await evaluate('document.activeElement.name'), 'dias0');
    assert.equal(await evaluate("document.activeElement.getAttribute('aria-invalid')"), 'true');
    await type('dias0', '2');
    assert.match(await evaluate("document.getElementById('total-anticipo').textContent"), /86.000/);
    await evaluate("document.getElementById('agregar-concepto').click()");
    await type('extraDetalle0', 'Taxi'); await type('extraValorDiario0', '10000');
    await evaluate("document.querySelector('[value=liquidar]').click()");
    assert.equal(submitted.length, 0); assert.equal(await evaluate('document.activeElement.name'), 'extraDias0');
    await type('extraDias0', '1'); await type('extraValorDiario0', '0');
    await evaluate("document.querySelector('[value=liquidar]').click()");
    assert.equal(submitted.length, 0); assert.equal(await evaluate('document.activeElement.name'), 'extraValorDiario0');
    await type('extraValorDiario0', '10000');
    assert.deepEqual(await evaluate('window.cspErrors'), []);
    await evaluate("document.querySelector('[value=liquidar]').click()");
    await until("!!document.getElementById('resultado')");
    assert.equal(submitted.length, 1); assert.equal(submitted[0].accion, 'liquidar'); assert.equal(submitted[0].result.totalAnticipo, 96000);
    assert.equal(submitted[0].origin, 'null', 'Reproduce la aprobación con Origin: null y no-referrer.');

    await navigate('/tesoreria');
    await until("document.getElementById('liquidacion-detalles').dataset.calculatorReady === 'true'");
    await type('valorDiario0', '45000'); await type('dias0', '2');
    assert.match(await evaluate("document.getElementById('total-anticipo-val').textContent"), /90.000/);
    await evaluate("document.getElementById('agregar-concepto').click()");
    await type('extraDetalle0', 'Taxi'); await type('extraValorDiario0', '10000'); await type('extraDias0', '1');
    assert.deepEqual(await evaluate('window.cspErrors'), []);
    await evaluate("document.querySelector('[value=autorizar_pago]').click()");
    await until("!!document.getElementById('resultado')");
    assert.equal(submitted.length, 2); assert.equal(submitted[1].accion, 'autorizar_pago'); assert.equal(submitted[1].result.totalAnticipo, 100000);
    assert.equal(submitted[1].origin, 'null');
    await navigate('/aprobar');
    assert.equal(await evaluate("document.querySelector('[name=observacion]').required"), false);
    await evaluate("document.querySelector('[value=aprobar]').click()");
    await until("!!document.getElementById('resultado')");
    assert.equal(submitted.length, 3); assert.equal(submitted[2].accion, 'aprobar');
    assert.equal(submitted[2].observacion, ''); assert.equal(submitted[2].origin, 'null');
    console.log(`OK Chrome (${process.env.NODE_ENV}): visor PDF/imagen sin perder datos, doble CSP, no-referrer, CORS real, digitación, cálculos y aprobación alterna sin observación con Origin: null. Sin BD ni SMTP.`);
  } finally {
    if (socket) socket.close();
    child.kill();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    // El perfil aislado queda en la carpeta temporal del SO; no toca datos del usuario.
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
