const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const assert = require('assert/strict');
const { spawn } = require('child_process');

module.exports = async ({ root, directory, url, certificate, port, check }) => {
  const candidates = [process.env.VALIDATION_BROWSER, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].filter(Boolean);
  const executable = candidates.find((filename) => fs.existsSync(filename));
  if (!executable) throw new Error('No hay navegador local disponible para comprobar CSP.');
  const proxy = http.createServer((_request, response) => { response.writeHead(403); response.end(); });
  proxy.on('connection', (socket) => socket.on('error', () => {}));
  proxy.on('connect', (_request, socket) => { socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); });
  await new Promise((resolve) => proxy.listen(0, '127.0.0.1', resolve));
  const debugPort = await port();
  const cert = new crypto.X509Certificate(fs.readFileSync(certificate));
  const spki = crypto.createHash('sha256').update(cert.publicKey.export({ type: 'spki', format: 'der' })).digest('base64');
  const child = spawn(executable, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--disable-component-update', '--disable-sync',
    `--user-data-dir=${path.join(directory, 'browser-profile')}`, `--remote-debugging-port=${debugPort}`, '--remote-debugging-address=127.0.0.1',
    `--proxy-server=http://127.0.0.1:${proxy.address().port}`, '--proxy-bypass-list=127.0.0.1;localhost',
    `--ignore-certificate-errors-spki-list=${spki}`, 'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  let socket;
  try {
    let targets;
    for (let attempt = 0; attempt < 60; attempt++) {
      try { targets = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json(); } catch (_) {}
      if (targets?.some((target) => target.type === 'page')) break;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    const target = targets?.find((entry) => entry.type === 'page');
    assert.ok(target, 'No se pudo iniciar el navegador aislado.');
    socket = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { socket.addEventListener('open', resolve, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    let sequence = 0;
    const pending = new Map();
    const send = (method, params = {}) => new Promise((resolve, reject) => {
      const id = ++sequence;
      const timeout = setTimeout(() => { pending.delete(id); reject(new Error(`CDP excedio tiempo: ${method}`)); }, 20000);
      pending.set(id, { resolve, reject, timeout });
      socket.send(JSON.stringify({ id, method, params }));
    });
    socket.addEventListener('message', ({ data }) => {
      const message = JSON.parse(data);
      if (message.id && pending.has(message.id)) {
        const item = pending.get(message.id); pending.delete(message.id); clearTimeout(item.timeout);
        if (message.error) item.reject(new Error(message.error.message)); else item.resolve(message.result);
      } else if (message.method === 'Fetch.requestPaused') {
        const requestUrl = new URL(message.params.request.url);
        const local = ['127.0.0.1', 'localhost'].includes(requestUrl.hostname);
        send(local ? 'Fetch.continueRequest' : 'Fetch.failRequest', local
          ? { requestId: message.params.requestId } : { requestId: message.params.requestId, errorReason: 'BlockedByClient' }).catch(() => {});
      }
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await send('Fetch.enable', { patterns: [{ urlPattern: '*' }] });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: "window.__validationCsp=[]; addEventListener('securitypolicyviolation', e => window.__validationCsp.push({directive:e.effectiveDirective, blocked:e.blockedURI}));" });
    await send('Page.navigate', { url: `${url}/index.html` });
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
      const status = await send('Runtime.evaluate', { expression: "document.readyState === 'complete' && document.getElementById('root')?.innerText.includes('cuenta Google institucional')", returnByValue: true });
      if (status.result.value) { ready = true; break; }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'La interfaz no se renderizo en el navegador.');
    await send('Runtime.evaluate', { expression: `(() => {
      window.__validationCsp=[];
      window.__validationImageLoaded=false; window.__validationPreviewLoaded=false;
      const image=new Image(); image.onload=()=>{window.__validationImageLoaded=true;}; image.src=URL.createObjectURL(new Blob([Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aVZkAAAAASUVORK5CYII='), c=>c.charCodeAt(0))],{type:'image/png'})); document.body.append(image);
      const preview=document.createElement('iframe');preview.onload=()=>{window.__validationPreviewLoaded=preview.contentDocument?.body?.textContent.includes('fixture')===true;};preview.src=URL.createObjectURL(new Blob(['<!doctype html><body>fixture</body>'],{type:'text/html'}));document.body.append(preview);
      for (const src of [location.origin+'/api/health','https://maps.google.com/maps?fixture','https://view.officeapps.live.com/op/fixture']) { const frame=document.createElement('iframe');frame.src=src;document.body.append(frame); }
      fetch('https://accounts.google.com/gsi/fixture-validation').catch(()=>{});
      return true;
    })()`, returnByValue: true });
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const violations = (await send('Runtime.evaluate', { expression: 'window.__validationCsp', returnByValue: true })).result.value;
    fs.writeFileSync(path.join(root, 'tmp/release-validation/browser-csp.json'), JSON.stringify({ allowedResourceViolations: violations, externalRequestsBlockedByTest: true }, null, 2));
    assert.deepEqual(violations, [], 'CSP bloquea funciones requeridas del aplicativo.');
    const previews = (await send('Runtime.evaluate', { expression: '({image:window.__validationImageLoaded,preview:window.__validationPreviewLoaded})', returnByValue: true })).result.value;
    assert.deepEqual(previews, { image: true, preview: true }, 'No se renderizaron las vistas previas locales.');
    await send('Runtime.evaluate', { expression: "fetch('https://blocked.example.invalid/fixture').catch(()=>{})" });
    await new Promise((resolve) => setTimeout(resolve, 300));
    const rejected = (await send('Runtime.evaluate', { expression: 'window.__validationCsp', returnByValue: true })).result.value;
    assert.ok(rejected.some((entry) => entry.directive === 'connect-src' && entry.blocked.includes('blocked.example.invalid')));
    fs.writeFileSync(path.join(root, 'tmp/release-validation/browser-csp.json'), JSON.stringify({
      passed: true, loginScreenRendered: true, imagePreviewRendered: previews.image, iframePreviewRendered: previews.preview,
      allowedResourceViolations: violations, unknownOriginRejected: true, externalRequestsBlockedByTest: true
    }, null, 2));
    check('Navegador: interfaz renderizada, previews locales y origenes requeridos admitidos; conexiones ajenas bloqueadas');
    await send('Browser.close').catch(() => {});
  } finally {
    if (socket) socket.close();
    if (child.exitCode === null) { child.kill(); await new Promise((resolve) => setTimeout(resolve, 1000)); }
    await new Promise((resolve) => proxy.close(resolve));
  }
};
