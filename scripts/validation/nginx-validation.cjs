const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');
const assert = require('assert/strict');
const { spawn } = require('child_process');

module.exports = async ({ root, work, backendPort, port, run, check }) => {
  // Si la compilacion se esta ejecutando, esperar sus artefactos completos antes
  // de servirlos. No se considera un index inexistente un fallo del aplicativo.
  let buildReady = false;
  for (let attempt = 0; attempt < 600; attempt++) {
    try {
      const manifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/build/asset-manifest.json')));
      buildReady = fs.existsSync(path.join(root, 'frontend/build/index.html'))
        && fs.statSync(path.join(root, 'frontend/build', manifest.files['main.js'].replace(/^\//, ''))).size > 0;
    } catch (_) {}
    if (buildReady) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(buildReady, 'Falta una compilacion completa para comprobar Nginx.');
  const directory = path.join(work, 'nginx');
  fs.mkdirSync(path.join(directory, 'logs'), { recursive: true });
  fs.mkdirSync(path.join(directory, 'temp'), { recursive: true });
  const installed = path.join(root, 'tmp/validation-tools/nginx-1.30.6');
  const executable = path.join(installed, 'nginx.exe');
  const openssl = process.env.VALIDATION_OPENSSL || 'C:/Users/adsolarte/AppData/Local/Programs/Git/mingw64/bin/openssl.exe';
  if (!fs.existsSync(executable) || !fs.existsSync(openssl)) throw new Error('Faltan Nginx/OpenSSL portatiles para validar HTTPS.');
  const certificate = path.join(directory, 'localhost.pem');
  const key = path.join(directory, 'localhost.key');
  const opensslConfig = path.join(directory, 'openssl.cnf');
  fs.writeFileSync(opensslConfig, '[req]\ndistinguished_name=dn\n[dn]\nCN=localhost\n');
  await run(openssl, ['req', '-config', opensslConfig, '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', key, '-out', certificate,
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost,IP:127.0.0.1', '-days', '1']);
  const httpPort = await port();
  const httpsPort = await port();
  const unix = (value) => value.replaceAll('\\', '/');
  let config = fs.readFileSync(path.join(root, 'frontend/nginx.conf'), 'utf8')
    .replace('listen 80;', `listen 127.0.0.1:${httpPort};`)
    .replace('listen 443 ssl;', `listen 127.0.0.1:${httpsPort} ssl;`)
    .replaceAll('/var/log/nginx/access.log', unix(path.join(directory, 'access.log')))
    .replaceAll('/usr/share/nginx/html', unix(path.join(root, 'frontend/build')))
    .replaceAll('/etc/nginx/certs/fullchain.pem', unix(certificate))
    .replaceAll('/etc/nginx/certs/Cert_planeacion.key', unix(key))
    .replaceAll('/etc/nginx/snippets/siac-security-headers.conf', unix(path.join(root, 'frontend/security-headers.conf')))
    .replaceAll('http://backend:5000', `http://127.0.0.1:${backendPort}`);
  config = `worker_processes 1;\npid logs/nginx.pid;\nerror_log logs/error.log;\nevents { worker_connections 128; }\nhttp {\ninclude ${unix(path.join(installed, 'conf/mime.types'))};\n${config}\n}\n`;
  const configPath = path.join(directory, 'nginx.conf');
  fs.writeFileSync(configPath, config);
  const args = ['-p', `${unix(directory)}/`, '-c', unix(configPath)];
  await run(executable, [...args, '-t']);
  check('Nginx 1.30: sintaxis y directivas de configuracion');
  const processHandle = spawn(executable, [...args, '-g', 'daemon off;'], { windowsHide: true, stdio: 'ignore' });
  const stop = async () => {
    try { await run(executable, [...args, '-s', 'quit'], { resolveOnExit: true }); }
    finally { if (processHandle.exitCode === null) await Promise.race([new Promise((resolve) => processHandle.once('exit', resolve)), new Promise((resolve) => setTimeout(resolve, 5000))]); }
  };
  const get = (url, protocol = 'TLSv1.3') => new Promise((resolve, reject) => {
    const request = https.get({ hostname: '127.0.0.1', port: httpsPort, path: url, servername: 'localhost',
      ca: fs.readFileSync(certificate), minVersion: protocol, maxVersion: protocol, agent: false }, (response) => {
      let body = '';
      response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, body }));
    });
    request.setTimeout(20000, () => request.destroy(new Error('Tiempo de espera HTTPS agotado.')));
    request.on('error', reject);
  });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try { ready = (await get('/api/health')).status === 200; } catch (_) {}
      if (ready) break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.ok(ready, 'Nginx no pudo servir el backend por HTTPS.');
    for (const version of ['TLSv1.2', 'TLSv1.3']) assert.equal((await get('/api/health', version)).status, 200);
    const index = await get('/index.html');
    assert.equal(index.status, 200);
    assert.match(index.headers['content-security-policy'] || '', /default-src 'self'/);
    assert.equal(index.headers['x-content-type-options'], 'nosniff');
    assert.match(index.headers['strict-transport-security'] || '', /max-age=/);
    for (const url of ['/.env', '/.git/config', '/package.json', '/backend/src/server.js', '/src/fixture.jsx', '/static/js/fixture.js.map', '/api/uploads/temp/fixture.csv']) {
      assert.ok([403, 404].includes((await get(url)).status), url);
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'frontend/build/asset-manifest.json')));
    const js = await get(manifest.files['main.js']);
    assert.equal(js.status, 200);
    assert.match(js.headers['content-type'] || '', /javascript/);
    const redirected = await new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${httpPort}/`, (response) => { response.resume(); resolve(response); }).on('error', reject);
    });
    assert.equal(redirected.statusCode, 301);
    assert.match(redirected.headers.location, /^https:/);
    if (process.env.VALIDATION_BROWSER_SMOKE === 'true') {
      await require('./browser-validation.cjs')({ root, directory, url: `https://127.0.0.1:${httpsPort}`, certificate, port, check });
    }
    check('HTTPS TLS 1.2/1.3, frontend compilado y proxy HTTP');
    check('Cabeceras CSP/HSTS y rechazo HTTP de fuentes, mapas y secretos');
  } finally { await stop(); }
};
